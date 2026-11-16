/* Sprachausgabe: Piper-Stimmen vom eigenen Server (POST /tts, je zwei Stimmen für Englisch und Spanisch).
   Wenn der Dienst fehlt, überlastet oder offline ist (oder der Browser das Abspielen blockiert),
   spricht stattdessen die Stimme des Browsers – die App funktioniert also immer.

   Safari/iPhone: Dort darf Ton nur abgespielt werden, wenn er direkt durch ein Tippen ausgelöst wird. Unsere Sätze kommen
   aber erst nach dem Laden vom Server. Deshalb gibt es genau ein Audio-Element, das beim ersten Tippen kurz (stumm)
   "freigeschaltet" wird; danach darf es später beliebig neue Sätze abspielen. Dasselbe gilt für die Browser-Stimme. */
const Voice = (() => {
  const MAX_CHARS = 300;            // so viel nimmt der Server an; Längeres übernimmt der Browser
  const CACHE_MAX = 60;             // bereits geladene Sätze (pro Sitzung)
  const cache = new Map();          // "lang|stimme|text" -> Promise<Blob|null>
  let queue = [], stopCurrent = null, gen = 0, running = false, downUntil = 0, busy = false;

  const kind = code => /^en/i.test(code) ? 'en' : /^es/i.test(code) ? 'es' : null;

  // ---- ein gemeinsames Audio-Element, das beim ersten Tippen freigeschaltet wird -------------------------------
  const player = new Audio();
  player.preload = 'auto';
  player.setAttribute('playsinline', '');

  function silence(){               // 0,1 s Stille als WAV (22,05 kHz, 16 Bit, mono)
    const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const txt = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, 'data'); v.setUint32(40, n * 2, true);
    return new Blob([buf], {type: 'audio/wav'});
  }

  let unlocked = false;
  const unlockEvents = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
  function unlock(){
    if(unlocked) return;
    try{
      const url = URL.createObjectURL(silence());
      if(!busy) player.src = url;
      const done = () => { if(!busy){ try{ player.pause(); }catch(e){} } URL.revokeObjectURL(url); };
      const p = busy ? null : player.play();
      if(p && p.then) p.then(() => { unlocked = true; done(); }, done);   // bei Fehler beim nächsten Tippen noch einmal
      else if(busy) unlocked = true;                                     // es spielt ohnehin schon etwas
    }catch(e){ /* nächster Versuch beim nächsten Tippen */ }
    try{                            // auch die Browser-Stimme (Ersatz) freischalten
      if('speechSynthesis' in window){ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    }catch(e){}
    if(unlocked) unlockEvents.forEach(ev => removeEventListener(ev, unlock, true));
  }
  unlockEvents.forEach(ev => addEventListener(ev, unlock, {capture: true, passive: true}));

  // ---- Laden, Abspielen, Warteschlange --------------------------------------------------------------------------
  function fetchAudio(lang, voice, text){
    const key = lang + '|' + voice + '|' + text;
    if(cache.has(key)) return cache.get(key);
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
    const p = fetch('tts', {method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
                            body: JSON.stringify({lang, voice, text}), signal: ctl.signal})
      .then(r => r.ok ? r.blob() : null).catch(() => null)
      .then(b => { clearTimeout(to); if(!b){ cache.delete(key); downUntil = Date.now() + 15000; } return b; });
    cache.set(key, p);
    if(cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  }

  // Passende Browser-Stimme suchen: undefined = Stimmenliste noch nicht geladen, null = keine passende vorhanden.
  const voiceFor = code => {
    try{
      const vs = speechSynthesis.getVoices();
      if(!vs.length) return undefined;
      const fix = s => String(s).toLowerCase().replace('_', '-'), c = fix(code), p = c.slice(0, 2);
      return vs.find(v => fix(v.lang) === c) || vs.find(v => fix(v.lang).startsWith(p)) || null;
    }catch(e){ return undefined; }
  };
  const isArabic = code => /^ar/i.test(code);

  const browserSpeak = it => new Promise(res => {
    if(!('speechSynthesis' in window)) return res();
    const v = isArabic(it.code) ? voiceFor(it.code) : undefined;
    if(v === null) return res();        // Arabisch ohne arabische Stimme: lieber still als mit einer falschen Stimme
    const u = new SpeechSynthesisUtterance(it.text);
    if(v) u.voice = v;
    u.lang = it.code; u.rate = .9; u.pitch = it.pitch;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });

  const playBlob = blob => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    let over = false;
    const finish = fn => {
      if(over) return; over = true; busy = false;
      player.onended = player.onerror = null;
      URL.revokeObjectURL(url);
      if(stopCurrent === stop) stopCurrent = null;
      fn();
    };
    const stop = () => { try{ player.pause(); }catch(e){} finish(res); };
    busy = true; stopCurrent = stop;
    player.onended = () => finish(res);
    player.onerror = () => finish(() => rej(new Error('audio')));
    player.src = url;
    player.play().catch(e => finish(() => rej(e)));
  });

  const warm = () => queue.slice(0, 1).forEach(it => it.load());     // Vorlauf: nur der nächste Satz (der Server rechnet höchstens zwei gleichzeitig)

  async function run(){
    if(running) return;
    running = true;
    const mine = gen;
    while(queue.length && mine === gen){
      const it = queue.shift();
      const loading = it.load();          // holt diesen Satz (falls noch nicht geschehen) ...
      warm();                             // ... und den nächsten, solange dieser läuft
      let ok = false;
      if(loading){
        const blob = await loading;
        if(mine !== gen) break;
        if(blob){ try{ await playBlob(blob); ok = true; }catch(e){ /* Browser-Stimme als Ersatz */ } }
      }
      if(!ok && mine === gen) await browserSpeak(it);
    }
    running = false;
    if(queue.length) run();          // nach einem Abbruch geht es mit den neuen Sätzen weiter
  }

  function say(text, o = {}){
    text = String(text || '').trim();
    if(!text) return;
    const code = o.lang || 'en-US', lang = kind(code), voice = o.voice ? 1 : 0;
    const it = {text, code, pitch: o.pitch || 1, blob: null,
      load(){   // Audio erst anfordern, wenn der Satz bald dran ist (der Server rechnet nur wenige Sätze gleichzeitig)
        if(!it.blob && lang && text.length <= MAX_CHARS && Date.now() >= downUntil) it.blob = fetchAudio(lang, voice, text);
        return it.blob;
      }};
    queue.push(it);
    warm();
    run();
  }

  function cancel(){
    gen++; queue = [];
    if(stopCurrent) stopCurrent();
    if('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // Kann dieses Gerät die Sprache sprechen? (Englisch/Spanisch immer, Arabisch nur mit arabischer Browser-Stimme)
  function canSpeak(code){
    if(!isArabic(code)) return true;
    if(!('speechSynthesis' in window)) return false;
    return voiceFor(code) !== null;
  }

  return {say, cancel, canSpeak};
})();
