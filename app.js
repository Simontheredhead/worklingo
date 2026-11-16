/* ============ Helfer / Speicher ============ */
const $ = s => document.querySelector(s);
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pickOf = a => a[Math.floor(Math.random()*a.length)];
const LS = 'workEnglishPro';
const fresh = () => ({course:'en',xp:0,streak:0,last:null,done:{},vocab:{},today:{d:'',xp:0}});
let S = fresh();
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(LS))); } catch(e) {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e) {} };
const dayKey = d => d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
const DAILY_GOAL = 40;
const LEVELS = [[0,'Newcomer'],[60,'Trainee'],[150,'Associate'],[300,'Specialist'],[500,'Senior'],[750,'Expert'],[1000,'English Pro']];
const levelOf = xp => { let i=0; LEVELS.forEach((l,k)=>{ if(xp>=l[0]) i=k; }); return i; };
const lvName = i => (C && C.levels) ? C.levels[i] : LEVELS[i][1];

function speak(t, pitch=1){ Voice.say(C.arabic ? (AR.get(t)||t) : t, {lang:C.lang, voice:pitch>1?1:0, pitch}); }   // pitch>1 = zweiter Sprecher (Stimme 1)
const canAudio = () => !(C && C.arabic) || Voice.canSpeak(C.lang);   // Arabisch braucht eine arabische Stimme auf dem Gerät
function speakNow(t){ Voice.cancel(); speak(t); }

/* ============ Soundeffekte (per WebAudio erzeugt, keine Dateien nötig) ============ */
let AC = null;
function tone(freq, start, dur, type='sine', vol=.18){
  const t0 = AC.currentTime + start, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0+0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0+dur+0.02);
}
const SFX = {
  ok:  () => { tone(659,0,.14,'triangle'); tone(880,.1,.18,'triangle'); tone(1319,.2,.28,'triangle',.15); },
  pair:() => { tone(784,0,.12,'triangle',.14); },
  bad: () => { tone(220,0,.18,'sawtooth',.12); tone(165,.14,.30,'sawtooth',.12); },
  miss:() => { tone(196,0,.12,'square',.07); },
  win: () => { [523,659,784,1047,1319].forEach((f,i)=>tone(f,i*.11,.26,'triangle',.16)); tone(1047,.6,.5,'sine',.12); },
  lose:() => { [392,330,262,196].forEach((f,i)=>tone(f,i*.17,.3,'sawtooth',.1)); }
};
function sfx(name){
  if(S.mute) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended') AC.resume();
    SFX[name]();
  }catch(e){}
}
function updMute(){ document.querySelectorAll('.mute-btn').forEach(b=>{ b.textContent = S.mute ? '🔇' : '🔔'; b.title = S.mute ? 'Töne einschalten' : 'Töne ausschalten'; b.setAttribute('aria-label', b.title); }); }
document.addEventListener('click', e=>{ const b=e.target.closest('.mute-btn'); if(!b) return; S.mute=!S.mute; save(); updMute(); if(!S.mute) sfx('pair'); });

/* Normalisierung fürs Tippen */
const CONTR = [[/\bcan't\b/g,'can not'],[/\bcannot\b/g,'can not'],[/\bwon't\b/g,'will not'],[/\blet's\b/g,'let us'],[/n't\b/g,' not'],[/'m\b/g,' am'],[/'re\b/g,' are'],[/'ve\b/g,' have'],[/'ll\b/g,' will'],[/'d\b/g,' would'],[/'s\b/g,' is']];
const norm = s => { s=s.toLowerCase().replace(/[’‘]/g,"'"); CONTR.forEach(([r,t])=>{s=s.replace(r,t)}); return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.,!?;:"¿¡]/g,'').replace(/\s+/g,' ').trim(); };
const normW = s => norm(s).replace(/^to /,'');
function lev(a,b){ const m=[]; for(let i=0;i<=a.length;i++){m[i]=[i]} for(let j=0;j<=b.length;j++){m[0][j]=j}
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return m[a.length][b.length]; }

const rec = (w, ok) => { const v = S.vocab[w] || (S.vocab[w]={ok:0,bad:0}); ok ? v.ok++ : v.bad++; };

/* Wortpools für Ablenker */
const pick = (pool, correct, n=3) => shuffle([correct, ...shuffle([...new Set(pool.filter(x=>x!==correct))]).slice(0,n-1)]);

/* Kurse (Englisch behält seine alten Speicher-Schlüssel ohne Präfix) */
const COURSES = {
  en:{id:'en',flag:'🇬🇧',name:'Business-Englisch',lang:'en-US',auf:'Englisch',ins:'Englische',units:UNITS,prefix:''},
  cloud:{id:'cloud',flag:'☁️',name:'Cloud-Englisch',lang:'en-US',auf:'Englisch',ins:'Englische',units:UNITS_CLOUD,prefix:'cl:'},
  es:{id:'es',flag:'🇪🇸',name:'Spanisch',lang:'es-ES',auf:'Spanisch',ins:'Spanische',units:UNITS_ES,prefix:'es:'},
  // Darija: Umschrift + arabische Schrift; keine Tipp-/Mikrofon-Übungen (uneinheitliche Schreibweise, keine Spracherkennung)
  ma:{id:'ma',flag:'🇲🇦',name:'Darija',lang:'ar-MA',auf:'Darija',ins:'Darija',units:UNITS_MA,prefix:'ma:',arabic:true,noType:true,
      levels:['Neuling','Tourist','Entdecker','Stammgast','Souk-Profi','Kenner','Marokko-Profi']}
};
let C, CU, ALL_EN, ALL_DE, NODES, AR = new Map();   // AR: Umschrift -> arabische Schrift (nur Darija)
function setCourse(id){
  C = COURSES[id] || COURSES.en; CU = C.units; S.course = C.id;
  ALL_EN = CU.flatMap(u=>u.lessons.flatMap(l=>l.w.map(w=>w[0])));
  ALL_DE = CU.flatMap(u=>u.lessons.flatMap(l=>l.w.map(w=>w[1])));
  AR = new Map();
  if(C.arabic) CU.forEach(u=>u.lessons.forEach(l=>{
    l.w.forEach(w=>{ if(w[2]) AR.set(w[0],w[2]); });
    l.s.forEach(s=>{ if(s[3]) AR.set(s[0],s[3]); });
    l.d.l.forEach(x=>{ if(x[2]) AR.set(x[1],x[2]); });
  }));
  NODES = [];
  CU.forEach((u,ui)=>{ u.lessons.forEach((l,li)=>NODES.push({key:C.prefix+ui+'-'+li,ui,li,type:'lesson'})); NODES.push({key:C.prefix+ui+'-b',ui,type:'boss'}); });
}

/* ============ Startseite ============ */
function learnedWords(){ const out=[]; CU.forEach((u,ui)=>u.lessons.forEach((l,li)=>{ if(S.done[C.prefix+ui+'-'+li]) out.push(...l.w); })); return out; }
function renderHome(){
  const now = new Date(), y = new Date(now.getTime()-864e5);
  const streak = (S.last===dayKey(now)||S.last===dayKey(y)) ? S.streak : 0;
  const li = levelOf(S.xp), next = LEVELS[li+1];
  const pct = next ? Math.round((S.xp-LEVELS[li][0])/(next[0]-LEVELS[li][0])*100) : 100;
  const tx = S.today.d===dayKey(now) ? S.today.xp : 0;
  const learned = learnedWords().length;
  const doneN = NODES.filter(n=>S.done[n.key]).length;
  let html = `<div class="ctabs">${Object.values(COURSES).map(c=>`<button class="ctab ${c.id===C.id?'on':''}" data-c="${c.id}">${c.flag} ${c.name}</button>`).join('')}</div>
    <div class="summary">
      <div class="srow"><div><div class="lvl">${lvName(li)}</div><div class="mute">${next?`${S.xp} / ${next[0]} XP bis „${lvName(li+1)}“`:`${S.xp} XP · Höchste Stufe erreicht 🎓`}</div></div>
        <div class="stats"><div title="Tage in Folge">🔥 ${streak}</div><div title="XP">⚡ ${S.xp}</div></div></div>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <div class="srow small"><span>🎯 Tagesziel: ${Math.min(tx,DAILY_GOAL)}/${DAILY_GOAL} XP ${tx>=DAILY_GOAL?'✅':''}</span><span>📚 ${learned} Wörter gelernt · ${doneN}/${NODES.length} Stationen</span></div>
      <button class="btn blue wide" id="train" ${learned<6?'disabled':''}>🏋️ Training: Schwächen wiederholen</button>
      ${learned<6?'<div class="mute small">Schließe eine Lektion ab, um das Training freizuschalten.</div>':''}
    </div>`;
  CU.forEach((u,ui)=>{
    html += `<div class="unit" style="background:${u.color}"><div><h2>${u.icon} ${ui+1}. ${u.title}</h2><p>${u.sub}</p></div><span class="badge">${u.lvl}</span></div><div class="path">`;
    NODES.filter(n=>n.ui===ui).forEach(n=>{
      const idx = NODES.indexOf(n), done = !!S.done[n.key], unlocked = idx===0 || S.done[NODES[idx-1].key];
      const label = n.type==='boss' ? 'Kapitel-Test' : u.lessons[n.li].t;
      html += `<div class="wrap-node"><button class="node ${done?'done':''} ${unlocked?'':'locked'}" data-k="${n.key}"
        style="--bg-c:${n.type==='boss'?'#ffb100':u.color};--sh:${n.type==='boss'?'#c88a00':u.dark}" ${unlocked?'':'disabled'} aria-label="${esc(label)}">${unlocked?(n.type==='boss'?'🏆':u.icon):'🔒'}</button>
        <div class="node-label">${esc(label)}</div></div>`;
    });
    html += `</div>`;
  });
  html += `<button class="reset" id="reset">Fortschritt zurücksetzen</button>`;
  $('#units').innerHTML = html;
}
$('#units').addEventListener('click', e=>{
  const ct = e.target.closest('.ctab'); if(ct){ setCourse(ct.dataset.c); save(); renderHome(); return; }
  if(e.target.id==='reset'){ if(confirm('Wirklich alles zurücksetzen (alle Kurse)?')){ S=fresh(); setCourse('en'); save(); renderHome(); } return; }
  if(e.target.id==='train'){ if(!e.target.disabled) begin({title:'Training',list:buildTraining,hearts:5,xp:h=>8+h,key:null}); return; }
  const b = e.target.closest('.node'); if(!b || b.disabled) return;
  const n = NODES.find(x=>x.key===b.dataset.k);
  if(n.type==='boss') begin({title:'Kapitel-Test',list:()=>buildBoss(CU[n.ui]),hearts:3,xp:h=>40+h*5,key:n.key});
  else begin({title:CU[n.ui].lessons[n.li].t,list:()=>buildLesson(CU[n.ui].lessons[n.li]),hearts:5,xp:h=>15+h*3,key:n.key});
});

/* ============ Übungen erzeugen ============ */
const MK = {
  enDe:(w,pool)=>({type:'choice',q:`Was bedeutet „${w[0]}“?`,say:w[0],ar:C.arabic?(w[2]||AR.get(w[0])):null,opts:pick((pool?pool.map(x=>x[1]):[]).concat(shuffle(ALL_DE).slice(0,3)),w[1],3),ans:w[1],wk:w[0]}),
  deEn:(w,pool)=>({type:'choice',q:`Wie sagt man „${w[1]}“ auf ${C.auf}?`,opts:pick((pool?pool.map(x=>x[0]):[]).concat(shuffle(ALL_EN).slice(0,3)),w[0],3),ans:w[0],wk:w[0]}),
  hear:(w,pool)=>({type:'choice',q:'Was hörst du?',hear:w[0],opts:pick((pool?pool.map(x=>x[0]):[]).concat(shuffle(ALL_EN).slice(0,3)),w[0],3),ans:w[0],wk:w[0]}),
  typeW:w=>({type:'type',q:`Schreibe auf ${C.auf}`,prompt:w[1],ans:w[0],word:true,wk:w[0],hint:`${w[0].length} Zeichen · beginnt mit „${w[0][0]}“`}),
  typeS:s=>({type:'type',q:`Übersetze ins ${C.ins}`,prompt:s[1],ans:s[0],hint:`${s[0].split(' ').length} Wörter`}),
  bank:(s,listen)=>({type:'bank',listen,en:s[0],de:s[1],tokens:shuffle([...s[0].split(' '),...s[2]])}),
  gap:g=>({type:'gap',s:g[0],ans:g[1],opts:shuffle([g[1],...g[2]]),de:g[3]}),
  fix:f=>({type:'fix',opts:shuffle([f[0],f[1]]),ans:f[1],why:f[2]}),
  dialog:d=>({type:'dialog',lines:d.l,q:d.q,opts:d.o,ans:d.o[d.a]}),
  match:pairs=>({type:'match',pairs}),
  speak:s=>({type:'speak',en:s[0],de:s[1]})
};
function buildLesson(l){
  const W=l.w, T=l.s, G=l.g, F=l.f;
  if(C.noType){
    const au = canAudio();             // ohne passende Stimme: Hörübungen durch Leseübungen ersetzen
    return [
      {type:'tip',title:l.t,text:l.tip},
      MK.enDe(W[0],W), MK.deEn(W[1],W), MK.match(shuffle(W).slice(0,5)),
      MK.bank(T[0],false), MK.gap(G[0]), MK.bank(T[1],au), au?MK.hear(W[2],W):MK.enDe(W[2],W),
      MK.fix(F[0]), MK.bank(T[2],false), MK.gap(G[1]), MK.dialog(l.d),
      MK.deEn(W[3],W), MK.fix(F[1]), MK.gap(G[2]), MK.bank(T[0],au), MK.enDe(W[4],W), MK.deEn(W[5],W)
    ];
  }
  return [
    {type:'tip',title:l.t,text:l.tip},
    MK.enDe(W[0],W), MK.deEn(W[1],W), MK.match(shuffle(W).slice(0,5)),
    MK.bank(T[0],false), MK.gap(G[0]), MK.bank(T[1],true), MK.hear(W[2],W),
    MK.fix(F[0]), MK.typeS(T[0]), MK.gap(G[1]), MK.dialog(l.d),
    MK.typeW(W[3]), MK.fix(F[1]), MK.gap(G[2]), MK.typeS(T[2]), MK.speak(T[1])
  ];
}
function buildBoss(u){
  const L = u.lessons, all = k => L.flatMap(l=>l[k]);
  const W = all('w'), T = all('s'), G = all('g'), F = all('f');
  if(C.noType){
    const au = canAudio();
    return shuffle([
      ...shuffle(T).slice(0,2).map(s=>MK.bank(s,false)), ...shuffle(W).slice(0,3).map(w=>MK.deEn(w,W)),
      ...shuffle(F).slice(0,2).map(MK.fix), ...shuffle(G).slice(0,2).map(MK.gap),
      MK.dialog(pickOf(L).d), MK.bank(pickOf(T),au), MK.match(shuffle(W).slice(0,5)), MK.enDe(pickOf(W),W)
    ]);
  }
  const list = [
    ...shuffle(T).slice(0,2).map(MK.typeS), ...shuffle(W).slice(0,3).map(MK.typeW),
    ...shuffle(F).slice(0,2).map(MK.fix), ...shuffle(G).slice(0,2).map(MK.gap),
    MK.dialog(pickOf(L).d), MK.bank(pickOf(T),true), MK.match(shuffle(W).slice(0,5)), MK.speak(pickOf(T))
  ];
  return shuffle(list);
}
function buildTraining(){
  const ws = learnedWords().map(w=>{ const v=S.vocab[w[0]]||{ok:0,bad:0}; return {w,score:v.bad*2-v.ok+Math.random()*3}; })
    .sort((a,b)=>b.score-a.score).slice(0,10).map(x=>x.w);
  const kinds = C.noType ? ['enDe','deEn',canAudio()?'hear':'enDe','deEn','enDe'] : ['typeW','enDe','deEn','hear','typeW'];
  return shuffle(ws).map((w,i)=>MK[kinds[i%kinds.length]](w));
}

/* ============ Lektion ============ */
let L = null, cur = null, answered = false;
function begin(spec){
  Voice.cancel();
  const list = spec.list();
  L = {spec, queue:[...list], total:list.filter(e=>e.type!=='tip').length, correct:0, hearts:spec.hearts, wrong:0, endAction:null};
  $('#home').classList.add('hidden'); $('#lesson').classList.remove('hidden');
  $('#title').textContent = spec.title;
  $('#hearts').textContent = L.hearts; $('#prog').style.width='0%';
  nextExercise();
}
function setMain(label, cls, enabled){ const m=$('#main'); m.textContent=label; m.className='btn '+(cls||''); m.disabled=!enabled; }
function nextExercise(){
  if(!L.queue.length) return finish();
  answered = false; cur = L.queue[0];
  $('#foot').className='foot'; $('#fb').innerHTML='';
  setMain('Prüfen','',false);
  $('#stage').onclick = null;
  $('#stage').scrollTop = 0;
  RENDER[cur.type](cur);
}
const setReady = v => { if(!answered) $('#main').disabled = !v; };
const optBtns = () => [...$('#stage').querySelectorAll('.opt')];

function renderOptions(ex, onSel){
  optBtns().forEach(b=>b.onclick=()=>{
    if(answered) return;
    optBtns().forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); onSel(ex.opts[+b.dataset.i], b); setReady(true);
  });
}
const optsHtml = ex => `<div class="opts">${ex.opts.map((o,i)=>`<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
function checkOptions(ex, sel){
  optBtns().forEach(b=>{ b.disabled=true; const v=ex.opts[+b.dataset.i]; if(v===ex.ans) b.classList.add('ok'); else if(v===sel) b.classList.add('bad'); });
}

const RENDER = {
  tip(ex){
    $('#stage').innerHTML = `<div class="tipbox"><div class="tipicon">💡</div><h1>${esc(ex.title)}</h1><p>${esc(ex.text)}</p></div>`;
    setMain('Los geht\'s','blue',true);
  },
  choice(ex){
    const au = canAudio();
    $('#stage').innerHTML = `<h1>${esc(ex.q)}</h1>
      ${(ex.say||ex.hear)?`<div class="say">${au?'<button class="spk" id="spk" aria-label="Anhören">🔊</button>':''}${ex.say?`<div class="bubble">${esc(ex.say)}${ex.ar?`<div class="ar" dir="rtl" lang="ar">${esc(ex.ar)}</div>`:''}</div>`:''}</div>`:''}
      ${optsHtml(ex)}`;
    const t = ex.say||ex.hear;
    if(t && au){ $('#spk').onclick=()=>speakNow(t); if(ex.hear) speakNow(t); }
    let sel=null; renderOptions(ex, v=>sel=v);
    ex.check = () => { checkOptions(ex, sel); return {ok:sel===ex.ans, answer:ex.ans}; };
  },
  gap(ex){
    const [a,b] = ex.s.split('___');
    $('#stage').innerHTML = `<h1>Ergänze den Satz</h1>
      <div class="sentence">${esc(a)}<span class="gap" id="gp">&nbsp;</span>${esc(b)}</div><div class="hint">${esc(ex.de)}</div>${optsHtml(ex)}`;
    let sel=null; renderOptions(ex, v=>{ sel=v; $('#gp').textContent=v; });
    ex.check = () => { checkOptions(ex, sel); return {ok:sel===ex.ans, answer:ex.s.replace('___',ex.ans)}; };
  },
  fix(ex){
    $('#stage').innerHTML = `<h1>Welcher Satz ist richtig?</h1>${optsHtml(ex)}`;
    let sel=null; renderOptions(ex, v=>sel=v);
    ex.check = () => { checkOptions(ex, sel); return {ok:sel===ex.ans, answer:ex.ans, why:ex.why}; };
  },
  dialog(ex){
    const au = canAudio();
    $('#stage').innerHTML = `<h1>${au?'Hörverstehen':'Dialog lesen'}</h1>
      ${au?`<div class="say"><button class="spk" id="spk">▶</button><div class="hint" style="margin:0">Dialog anhören (so oft du willst)</div></div>
      <button class="link" id="showtxt">Text anzeigen</button>`:`<div class="hint">Auf diesem Gerät gibt es keine arabische Stimme. Lies den Dialog:</div>`}
      <div id="dlg" class="dlg ${au?'hidden':''}">${ex.lines.map(l=>`<p><b>${esc(l[0])}:</b> ${esc(l[1])}${l[2]?`<span class="ar" dir="rtl" lang="ar">${esc(l[2])}</span>`:''}</p>`).join('')}</div>
      <h2 class="q">${esc(ex.q)}</h2>${optsHtml(ex)}`;
    const play = () => { Voice.cancel(); const names=[...new Set(ex.lines.map(l=>l[0]))]; ex.lines.forEach(l=>speak(l[1], names.indexOf(l[0])%2?1.35:0.9)); };
    if(au){ $('#spk').onclick = play; $('#showtxt').onclick = () => { $('#dlg').classList.toggle('hidden'); }; play(); }
    let sel=null; renderOptions(ex, v=>sel=v);
    ex.check = () => { checkOptions(ex, sel); $('#dlg').classList.remove('hidden'); return {ok:sel===ex.ans, answer:ex.ans}; };
  },
  type(ex){
    $('#stage').innerHTML = `<h1>${esc(ex.q)}</h1><div class="say"><div class="bubble big">${esc(ex.prompt)}</div></div>
      <input id="inp" class="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${C.auf} eintippen…">
      <div class="hint">Tipp: ${esc(ex.hint)}</div>`;
    const inp = $('#inp'); inp.focus();
    inp.oninput = () => setReady(inp.value.trim().length>0);
    ex.check = () => {
      inp.disabled = true;
      const f = ex.word ? normW : norm, got = f(inp.value), want = f(ex.ans);
      if(got===want) return {ok:true};
      const d = lev(got,want), tol = want.length>=35 ? 2 : (want.length>=14 ? 1 : 0);
      if(d<=tol) return {ok:true, note:`Kleiner Tippfehler – richtig: ${ex.ans}`};
      return {ok:false, answer:ex.ans};
    };
  },
  bank(ex){
    $('#stage').innerHTML = `<h1>${ex.listen?'Schreib, was du hörst':'Übersetze diesen Satz'}</h1>
      <div class="say">${ex.listen?`<button class="spk" id="spk" aria-label="Anhören">🔊</button><div class="hint" style="margin:0">Tippe auf den Lautsprecher</div>`:`<div class="bubble">${esc(ex.de)}</div>`}</div>
      <div class="answer" id="ans"></div><div class="bank" id="bank"></div>`;
    if(ex.listen){ $('#spk').onclick=()=>speakNow(ex.en); speakNow(ex.en); }
    let chosen = [];
    const draw = () => {
      $('#ans').innerHTML = chosen.map(i=>`<button class="chip" data-a="${i}">${esc(ex.tokens[i])}</button>`).join('');
      $('#bank').innerHTML = ex.tokens.map((t,i)=>`<button class="chip ${chosen.includes(i)?'used':''}" data-b="${i}">${esc(t)}</button>`).join('');
      setReady(chosen.length>0);
    };
    $('#stage').onclick = e => {
      if(answered) return;
      const c = e.target.closest('.chip'); if(!c) return;
      if(c.dataset.b!==undefined && !c.classList.contains('used')) chosen.push(+c.dataset.b);
      else if(c.dataset.a!==undefined) chosen.splice(chosen.indexOf(+c.dataset.a),1);
      draw();
    };
    draw();
    ex.check = () => ({ok: norm(chosen.map(i=>ex.tokens[i]).join(' '))===norm(ex.en), answer:ex.en});
  },
  match(ex){
    const left = ex.pairs.map(p=>p[0]), right = shuffle(ex.pairs.map(p=>p[1]));
    $('#stage').innerHTML = `<h1>Finde die Paare</h1><div class="match">
      <div class="col" id="cl">${left.map(t=>`<button class="opt" data-s="l">${esc(t)}</button>`).join('')}</div>
      <div class="col" id="cr">${right.map(t=>`<button class="opt" data-s="r">${esc(t)}</button>`).join('')}</div></div>`;
    let a=null, remaining=ex.pairs.length, errors=0;
    $('#stage').onclick = e => {
      const b = e.target.closest('.opt'); if(!b || b.disabled || answered) return;
      const side = b.dataset.s;
      if(a && a.dataset.s===side){ a.classList.remove('sel'); a=b; b.classList.add('sel'); return; }
      if(!a){ a=b; b.classList.add('sel'); if(side==='l') speakNow(b.textContent); return; }
      const l = side==='l'?b:a, r = side==='r'?b:a;
      const ok = ex.pairs.some(p=>p[0]===l.textContent && p[1]===r.textContent);
      a.classList.remove('sel');
      if(ok){
        rec(l.textContent,true); sfx('pair'); [l,r].forEach(x=>{x.classList.add('ok'); x.disabled=true;}); remaining--;
        if(!remaining){ answered=true; showResult(errors>=3 ? {ok:true, penalty:true, note:'Zu viele Fehlversuche: −1 ❤️'} : {ok:true}); }
      } else {
        errors++; rec(l.textContent,false); sfx('miss');
        [l,r].forEach(x=>{x.classList.add('bad','shake'); setTimeout(()=>x.classList.remove('bad','shake'),400);});
      }
      a = null;
    };
    ex.check = () => ({ok:true});
  },
  speak(ex){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    $('#stage').innerHTML = `<h1>Sprich nach</h1>
      <div class="say"><button class="spk" id="spk" aria-label="Anhören">🔊</button><div class="bubble">${esc(ex.en)}</div></div>
      ${SR?`<button class="mic" id="mic">🎤 Aufnahme starten</button><div class="heard" id="heard"></div>`:`<div class="hint">Dein Browser unterstützt keine Spracherkennung (Chrome/Edge probieren). Sprich den Satz einfach laut nach.</div>`}
      <button class="link" id="skip">Überspringen</button>`;
    $('#spk').onclick = () => speakNow(ex.en);
    $('#skip').onclick = () => { if(answered) return; L.correct++; L.queue.shift(); $('#prog').style.width=Math.round(L.correct/L.total*100)+'%'; nextExercise(); };
    let heard = '';
    if(SR){
      $('#mic').onclick = () => {
        if(answered) return;
        const r = new SR(); r.lang=C.lang; r.interimResults=false; r.maxAlternatives=1;
        $('#mic').textContent='🎙️ Ich höre zu…';
        r.onresult = e => { heard = e.results[0][0].transcript; $('#heard').textContent = `Verstanden: „${heard}“`; setReady(true); $('#mic').textContent='🎤 Nochmal versuchen'; };
        r.onerror = () => { $('#heard').textContent='Keine Aufnahme möglich (Mikrofon erlaubt?). Du kannst überspringen.'; $('#mic').textContent='🎤 Nochmal versuchen'; };
        r.onend = () => { if(!heard) $('#mic').textContent='🎤 Nochmal versuchen'; };
        try { r.start(); } catch(e) {}
      };
    }
    ex.check = () => {
      const want = norm(ex.en).split(' '), got = norm(heard).split(' ');
      const hit = want.filter(w=>got.includes(w)).length / want.length;
      return hit>=0.7 ? {ok:true, msg:'Gut gesprochen! 🎤'} : {ok:true, msg:'Fast!', note:`Verstanden: „${heard}“ · Ziel: ${ex.en}`};
    };
  }
};

function showResult(r){
  answered = true;
  const foot = $('#foot');
  if(cur.wk && cur.type!=='match') rec(cur.wk, r.ok);
  let html;
  if(r.ok){
    if(!r.skip) sfx('ok');
    if(!r.skip) L.correct++;
    L.queue.shift();
    if(r.penalty){ L.hearts--; $('#hearts').textContent=L.hearts; }
    foot.className='foot ok';
    html = '✅ '+(r.msg||pickOf(['Richtig!','Super!','Sehr gut!','Genau!','Stark!']));
    if(r.note) html += `<small>${esc(r.note)}</small>`;
    if(r.why) html += `<small>💡 ${esc(r.why)}</small>`;
    setMain('Weiter','',true);
  } else {
    sfx('bad');
    L.hearts--; L.wrong++; $('#hearts').textContent = L.hearts;
    L.queue.push(L.queue.shift());
    foot.className='foot bad';
    html = `❌ Richtige Antwort:<small>${esc(r.answer)}</small>`;
    if(r.why) html += `<small>💡 ${esc(r.why)}</small>`;
    setMain('Weiter','red',true);
  }
  $('#fb').innerHTML = html;
  $('#prog').style.width = Math.round(L.correct/L.total*100)+'%';
  if(cur.type==='match'){ const c=cur; setTimeout(()=>{ if(L && cur===c && answered) advance(); }, 700); }
}
function advance(){
  if(L.hearts<=0) return fail();
  nextExercise();
}
$('#main').onclick = () => {
  if(!L) return;
  if(L.endAction) return L.endAction();
  if(cur.type==='tip'){ L.queue.shift(); return nextExercise(); }
  if(!answered) showResult(cur.check()); else advance();
};
document.addEventListener('keydown', e=>{
  if(e.key==='Enter' && L && !$('#lesson').classList.contains('hidden') && !$('#main').disabled && e.target.id!=='main'){ e.preventDefault(); $('#main').click(); }
});
$('#quit').onclick = () => { if(confirm('Lektion beenden? Dein Fortschritt in dieser Lektion geht verloren.')) closeLesson(); };
function closeLesson(){ Voice.cancel(); L=null; cur=null; $('#lesson').classList.add('hidden'); $('#home').classList.remove('hidden'); save(); renderHome(); window.scrollTo(0,0); }

function fail(){
  sfx('lose');
  $('#stage').onclick = null;
  $('#stage').innerHTML = `<div class="end"><div class="big">💔</div><h1>Keine Herzen mehr</h1><p class="hint">Kein Problem – Wiederholung macht den Meister. Versuch es gleich nochmal!</p></div>`;
  $('#foot').className='foot'; $('#fb').innerHTML='';
  setMain('Nochmal','blue',true);
  const spec = L.spec; L.endAction = () => begin(spec);
}
function finish(){
  sfx('win');
  const xp = L.spec.xp(Math.max(0,L.hearts));
  S.xp += xp;
  if(L.spec.key) S.done[L.spec.key] = true;
  const now = new Date(), t = dayKey(now), y = dayKey(new Date(now.getTime()-864e5));
  if(S.last!==t){ S.streak = (S.last===y) ? S.streak+1 : 1; S.last = t; }
  if(S.today.d!==t) S.today = {d:t, xp:0};
  S.today.xp += xp;
  save();
  const acc = Math.round((L.total/(L.total+L.wrong))*100);
  const lv = levelOf(S.xp), up = lv > levelOf(S.xp-xp);
  $('#prog').style.width='100%'; $('#stage').onclick = null;
  $('#stage').innerHTML = `<div class="end"><div class="big">${L.spec.key&&L.spec.key.endsWith('b')?'🏆':'🎉'}</div><h1>${esc(L.spec.title)} geschafft!</h1>
    ${up?`<p class="levelup">🆙 Neue Stufe: ${lvName(lv)}</p>`:''}
    <div class="cards"><div class="card"><b>XP</b><div>⚡ ${xp}</div></div><div class="card" style="border-color:var(--green)"><b style="background:var(--green)">Genauigkeit</b><div>${acc}%</div></div>
    <div class="card" style="border-color:var(--red)"><b style="background:var(--red)">Herzen</b><div>❤️ ${L.hearts}</div></div></div>
    <p class="hint">🔥 ${S.streak} ${S.streak===1?'Tag':'Tage'} in Folge</p></div>`;
  $('#foot').className='foot ok'; $('#fb').innerHTML='';
  setMain('Fertig','',true); answered=true; L.endAction = closeLesson;
}

/* Mobile: Overlays an die sichtbare Fläche anpassen (Tastatur!) */
function fitViewport(){
  const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0;
  ['#lesson','#trans'].forEach(s=>{ const el=$(s); if(el){ el.style.height=h+'px'; el.style.transform=`translateY(${top}px)`; } });
}
if(window.visualViewport){ visualViewport.addEventListener('resize',fitViewport); visualViewport.addEventListener('scroll',fitViewport); }
window.addEventListener('resize',fitViewport); fitViewport();
document.addEventListener('focusin', e=>{ if(e.target.matches('input,textarea')) setTimeout(()=>e.target.scrollIntoView({block:'center'}),250); });

setCourse(S.course);
updMute();
renderHome();
