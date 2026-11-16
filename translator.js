/* Übersetzer mit Spracheingabe (Deutsch ⇄ Englisch ⇄ Spanisch) */
(function(){
const LANGS = {de:{n:'Deutsch',code:'de-DE'}, en:{n:'Englisch',code:'en-US'}, es:{n:'Spanisch',code:'es-ES'}};
const q = s => document.querySelector(s);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const HK = 'workLingoHistory';
let recog = null, last = null;

function fillSel(sel, val){ sel.innerHTML = Object.entries(LANGS).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join(''); sel.value = val; }
fillSel(q('#tsrc'),'de'); fillSel(q('#tdst'),'en');

const status = (t, bad) => { const s=q('#tstat'); s.textContent=t||''; s.className='tstat'+(bad?' bad':''); };
const decode = s => { const t=document.createElement('textarea'); t.innerHTML=s; return t.value; };
const nrm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.,!?;:"¿¡']/g,'').replace(/\s+/g,' ').trim();

/* Offline-Fallback: bekannte Wörter/Sätze aus den Kursen */
let DICT = null;
function dict(){
  if(DICT) return DICT;
  DICT = {en:{f2de:new Map(),de2f:new Map()}, es:{f2de:new Map(),de2f:new Map()}};
  const add = (lang, units) => units.forEach(u=>u.lessons.forEach(l=>{
    [...l.w, ...l.s.map(s=>[s[0],s[1]]), ...l.g.map(g=>[g[0].replace('___',g[1]),g[3]])].forEach(([f,d])=>{
      DICT[lang].f2de.set(nrm(f), d); DICT[lang].de2f.set(nrm(d.replace(/^(der|die|das) /,'')), f); DICT[lang].de2f.set(nrm(d), f);
    });
  }));
  add('en', UNITS.concat(UNITS_CLOUD)); add('es', UNITS_ES);
  return DICT;
}
function lookup(text, src, dst){
  const k = nrm(text), D = dict();
  let de = src==='de' ? text : (D[src] && D[src].f2de.get(k));
  if(!de) return null;
  if(dst==='de') return de;
  return (D[dst] && D[dst].de2f.get(nrm(de))) || null;
}

async function translate(text, src, dst){
  if(src===dst) return {text, via:'gleiche Sprache'};
  try{
    const ctl = new AbortController(), to = setTimeout(()=>ctl.abort(), 9000);
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${dst}`, {signal:ctl.signal});
    clearTimeout(to);
    const j = await r.json(), t = j && j.responseData && j.responseData.translatedText;
    if(j.responseStatus==200 && t && !/QUERY LENGTH|MYMEMORY WARNING|PLEASE SELECT/i.test(t)) return {text:decode(t).trim(), via:'online (MyMemory)'};
  }catch(e){}
  const l = lookup(text, src, dst);
  return l ? {text:l, via:'offline (aus deinen Kursen)'} : null;
}

function speakText(t, lang){
  Voice.cancel(); Voice.say(t, {lang:LANGS[lang].code});
}
function loadHist(){ try{ return JSON.parse(localStorage.getItem(HK))||[]; }catch(e){ return []; } }
function saveHist(h){ try{ localStorage.setItem(HK, JSON.stringify(h.slice(0,8))); }catch(e){} }
function drawHist(){
  const h = loadHist(), box = q('#thist');
  box.innerHTML = h.length ? '<h3>Zuletzt übersetzt</h3>' : '';
  h.forEach((x,i)=>{ const b=document.createElement('button'); b.className='hitem'; b.textContent=`${x.a}  →  ${x.b}`; b.onclick=()=>{ q('#tsrc').value=x.s; q('#tdst').value=x.d; q('#tin').value=x.a; show(x.b,x.d,'gespeichert'); last={t:x.b,l:x.d}; }; box.appendChild(b); });
}
function show(t, lang, via){
  q('#tout').textContent = t; q('#tvia').textContent = via ? 'Quelle: '+via : '';
  q('#tres').classList.remove('hidden');
}

async function go(){
  const text = q('#tin').value.trim(), src=q('#tsrc').value, dst=q('#tdst').value;
  if(!text){ status('Bitte sprich oder tippe zuerst etwas.', true); return; }
  status('Übersetze…'); q('#tgo').disabled = true;
  const r = await translate(text, src, dst);
  q('#tgo').disabled = false;
  if(!r){ status('Keine Übersetzung möglich (offline?). Offline kenne ich nur Wörter und Sätze aus deinen Kursen.', true); return; }
  status(''); last = {t:r.text, l:dst}; show(r.text, dst, r.via);
  const h = loadHist().filter(x=>!(x.a===text&&x.s===src&&x.d===dst)); h.unshift({a:text,b:r.text,s:src,d:dst}); saveHist(h); drawHist();
  if(q('#tauto').checked) speakText(r.text, dst);
}

function listen(){
  if(!SR){ status('Spracheingabe wird von diesem Browser nicht unterstützt – bitte Chrome oder Edge nutzen. Tippen geht trotzdem.', true); return; }
  if(recog){ try{ recog.stop(); }catch(e){} return; }
  recog = new SR(); recog.lang = LANGS[q('#tsrc').value].code; recog.interimResults = true; recog.maxAlternatives = 1;
  q('#tmic').classList.add('rec'); q('#tmic').textContent = '⏹ Ich höre zu… (tippen zum Stoppen)'; status('');
  let finalText = '';
  recog.onresult = e => { let t=''; for(const res of e.results) t += res[0].transcript; q('#tin').value = t; finalText = t; };
  recog.onerror = e => status(e.error==='not-allowed' ? 'Mikrofon blockiert – bitte im Browser erlauben (am besten über http://localhost öffnen).' : 'Spracheingabe fehlgeschlagen ('+e.error+').', true);
  recog.onend = () => { recog=null; q('#tmic').classList.remove('rec'); q('#tmic').textContent='🎤 Sprechen'; if(finalText.trim()) go(); };
  try{ recog.start(); }catch(e){ recog=null; }
}

q('#tmic').onclick = listen;
q('#tgo').onclick = go;
q('#tswap').onclick = () => { const a=q('#tsrc'), b=q('#tdst'); [a.value,b.value]=[b.value,a.value]; if(last){ q('#tin').value = last.t; q('#tout').textContent=''; q('#tres').classList.add('hidden'); } };
q('#tspeak').onclick = () => { if(last) speakText(last.t, last.l); };
q('#tcopy').onclick = async () => { try{ await navigator.clipboard.writeText(q('#tout').textContent); status('Kopiert ✅'); }catch(e){ status('Kopieren nicht möglich.', true); } };
q('#tclear').onclick = () => { q('#tin').value=''; q('#tres').classList.add('hidden'); status(''); };
q('#tin').addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); go(); } });
q('#tsrc').onchange = q('#tdst').onchange = () => status('');
q('#openTrans').onclick = () => { q('#home').classList.add('hidden'); q('#trans').classList.remove('hidden'); drawHist(); };
q('#tclose').onclick = () => { if(recog){ try{recog.stop();}catch(e){} } Voice.cancel(); q('#trans').classList.add('hidden'); q('#home').classList.remove('hidden'); };
window.__translate = translate; window.__lookup = lookup;
})();
