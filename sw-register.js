/* Registriert den Service Worker (eigene Datei, damit die CSP keine Inline-Skripte erlauben muss). */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
