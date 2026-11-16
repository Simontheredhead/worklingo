/* Offline-Cache: App-Dateien werden beim ersten Besuch gespeichert. */
const CACHE = 'worklingo-v6';
const FILES = ['./','index.html','app.js','content.js','content-es.js','content-more.js','content-cloud.js','content-ma.js','translator.js','tts.js','sw-register.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;   // Übersetzungs-API u. a. nie cachen
  e.respondWith(
    fetch(e.request).then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; })
      .catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html')))
  );
});
