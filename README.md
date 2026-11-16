# WorkLingo

Sprachlern-App im Duolingo-Stil (Deutsch als Ausgangssprache), als reine statische Webseite ohne Build-Schritt.

## Kurse
- **Business-Englisch** (B1–C1): Meetings, E-Mails, Telefonieren, Verhandlungen, Finanzen & Recht u. v. m.
- **Cloud-Englisch** (B2–C1): Stand-ups, Incidents, CI/CD, Security, Kundenkommunikation, Doku lesen
- **Spanisch** (A1–A2): Alltag, Essen, Reisen, Arbeit, Vergangenheit und Zukunft

Übungstypen: Multiple Choice, Lückentext, Satzbau, Paare, Tippen, Fehlerkorrektur, Hörverstehen, Aussprache (Mikrofon).
Dazu: XP, Streak, Herzen, Kapitel-Tests, Trainingsmodus, Soundeffekte und ein **Übersetzer mit Spracheingabe** (Deutsch ⇄ Englisch ⇄ Spanisch).

## Starten
Lokal (am besten über localhost, damit das Mikrofon funktioniert):

```bash
python3 -m http.server 8765
```

Dann `http://localhost:8765` in Chrome oder Edge öffnen.
Die App ist als PWA installierbar (nur über HTTPS bzw. localhost).

## Dateien
| Datei | Inhalt |
| --- | --- |
| `index.html` | Seite und Styles |
| `app.js` | Lern-Engine (Übungen, Fortschritt, Sounds) |
| `translator.js` | Übersetzer mit Spracheingabe |
| `content.js`, `content-more.js` | Kurs Business-Englisch |
| `content-cloud.js` | Kurs Cloud-Englisch |
| `content-es.js` | Kurs Spanisch |
| `sw.js`, `manifest.webmanifest`, `icon*` | Offline-Cache und Installation (PWA) |

Neue Lektionen: einen Block im jeweiligen `content-*.js` ergänzen (Format steht am Dateianfang von `content.js`).

## Datenschutz
Der Fortschritt liegt nur im Browser (`localStorage`). Der Übersetzer sendet den eingegebenen Text an den Dienst
[MyMemory](https://mymemory.translated.net); die Spracherkennung läuft über den Dienst des Browsers.
