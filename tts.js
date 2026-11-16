/* Sprachausgabe: Piper-Stimmen vom eigenen Server (POST /tts, je zwei Stimmen für Englisch und Spanisch).
   Wenn der Dienst fehlt, überlastet oder offline ist (oder der Browser das Abspielen blockiert),
   spricht stattdessen die Stimme des Browsers – die App funktioniert also immer. */
const Voice = (() => {
  const MAX_CHARS = 300;            // so viel nimmt der Server an; Längeres übernimmt der Browser
  const CACHE_MAX = 60;             // bereits geladene Sätze (pro Sitzung)
  const cache = new Map();          // "lang|stimme|text" -> Promise<Blob|null>
  let queue = [], stopCurrent = null, gen = 0, running = false, downUntil = 0;

  const kind = code => /^en/i.test(code) ? 'en' : /^es/i.test(code) ? 'es' : null;

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

  const browserSpeak = it => new Promise(res => {
    if(!('speechSynthesis' in window)) return res();
    const u = new SpeechSynthesisUtterance(it.text);
    u.lang = it.code; u.rate = .9; u.pitch = it.pitch;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });

  const playBlob = blob => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), a = new Audio(url);
    let over = false;
    const finish = fn => { if(over) return; over = true; URL.revokeObjectURL(url); if(stopCurrent === stop) stopCurrent = null; fn(); };
    const stop = () => { try{ a.pause(); }catch(e){} finish(res); };
    stopCurrent = stop;
    a.onended = () => finish(res);
    a.onerror = () => finish(() => rej(new Error('audio')));
    a.play().catch(e => finish(() => rej(e)));
  });

  async function run(){
    if(running) return;
    running = true;
    const mine = gen;
    while(queue.length && mine === gen){
      const it = queue.shift();
      let ok = false;
      if(it.blob){
        const blob = await it.blob;
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
    const it = {text, code, pitch: o.pitch || 1, blob: null};
    if(lang && text.length <= MAX_CHARS && Date.now() >= downUntil) it.blob = fetchAudio(lang, voice, text);
    queue.push(it);
    run();
  }

  function cancel(){
    gen++; queue = [];
    if(stopCurrent) stopCurrent();
    if('speechSynthesis' in window) speechSynthesis.cancel();
  }

  return {say, cancel};
})();
