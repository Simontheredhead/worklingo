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
| `sw.js`, `sw-register.js`, `manifest.webmanifest`, `icon*` | Offline-Cache und Installation (PWA) |
| `tts.js`, `voice/` | Sprachausgabe mit Piper-Stimmen (siehe unten) |
| `Dockerfile`, `docker-compose.yml`, `docker/`, `deploy/` | Betrieb auf dem Server (siehe unten) |

Neue Lektionen: einen Block im jeweiligen `content-*.js` ergänzen (Format steht am Dateianfang von `content.js`).

## Datenschutz
Der Fortschritt liegt nur im Browser (`localStorage`). Der Übersetzer sendet den eingegebenen Text an den Dienst
[MyMemory](https://mymemory.translated.net); die Spracherkennung läuft über den Dienst des Browsers.

## Betrieb auf dem Server (Docker)
Es laufen zwei Container: nginx ohne Root-Rechte (liefert die statischen Dateien aus, rund 82 MB Image, etwa 5 MB RAM) und die Sprachausgabe `worklingo-voice` (siehe unten).

**Gehärtet:** Benutzer `nginx` (UID 101), schreibgeschütztes Dateisystem, alle Linux-Capabilities entfernt,
`no-new-privileges`, Grenzen für RAM (64 MB), CPU und Prozesse, nur GET/HEAD erlaubt, Anfragen pro Adresse begrenzt,
strenge Sicherheits-Header (CSP, `nosniff`, `X-Frame-Options`, Permissions-Policy). Die CSP erlaubt nur eigene Dateien
und die Übersetzungs-API von MyMemory.

**Stabil:** `restart: unless-stopped`, Healthcheck (`/healthz`), begrenzte Logs (3 × 5 MB).

Es gibt bewusst keinen öffentlichen Port. HTTPS übernimmt der Caddy des Geisterstunde-Stacks; dafür ist
`deploy/Caddyfile.worklingo` als Vorlage da. Ohne eigene Domain dient `lingo.<IP-mit-Bindestrichen>.sslip.io` als Adresse;
mit eigener Domain den Hostnamen ersetzen und einen DNS-A-Eintrag auf die Server-IP setzen.

```bash
docker compose up -d --build     # Container bauen und starten
docker compose ps                # Status und Health
docker compose logs -f           # Logs
```

Der Container hängt im Docker-Netz `geisterstunde_default` (änderbar über `PROXY_NETWORK`), damit der Caddy ihn als `worklingo:8080` erreicht.
Das Mikrofon und die Installation als App funktionieren nur über HTTPS.

## Sprachausgabe (Piper)
Vorgelesen wird mit [Piper](https://github.com/OHF-Voice/piper1-gpl) (offline, CPU) statt mit der Stimme des Browsers, damit es auf jedem Gerät gleich klingt.
Der Browser fragt per `POST /tts` (`{"lang":"en"|"es","voice":0|1,"text":"…"}`) und bekommt WAV-Audio zurück.

| Sprache | Stimme 0 (weiblich) | Stimme 1 (männlich) |
| --- | --- | --- |
| Englisch (US) | `en_US-lessac-high` | `en_US-ryan-high` |
| Spanisch (Spanien) | `es_ES-sharvard-medium`, Sprecherin | `es_ES-davefx-medium` |

Beide englischen Stimmen laufen in der höchsten Piper-Qualitätsstufe (`high`). Für Spanisch aus Spanien gibt es nur `medium`; die `high`-Stimmen
(`es_MX-claude-high`, `es_AR-daniela-high`) sind lateinamerikanisch und haben nur einen Sprecher. Alle Modelle geben 22.050 Hz aus.

Stimme 1 spricht den zweiten Sprecher in den Hörverstehen-Dialogen. Die Modelle werden beim Bauen aus einer festen Version von
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) geladen und per MD5 geprüft (Image rund 1,3 GB).

**Safari und iPhone:** Safari spielt Ton nur ab, wenn er direkt durch ein Tippen ausgelöst wird. Die Sätze kommen aber erst nach dem Laden vom Server.
Deshalb nutzt `tts.js` genau ein Audio-Element, das beim ersten Tippen stumm freigeschaltet wird und danach beliebig oft abspielen darf
(dasselbe gilt für die Browser-Stimme als Ersatz). Die Seite hat dafür die iOS-Angaben (`apple-touch-icon`, Statusleiste, `safe-area`).
Fortschritt liegt im `localStorage`; Safari löscht ihn bei Webseiten nach etwa 7 Tagen ohne Besuch, außer die App wurde über
„Teilen → Zum Home-Bildschirm“ installiert.

**Fallback:** Ist der Dienst nicht erreichbar, überlastet, offline oder blockiert der Browser das Abspielen, spricht automatisch die Browser-Stimme.
Deutsch (Übersetzer-Ausgabe) und Texte über 300 Zeichen laufen ebenfalls über den Browser.

**Abgesichert:** Der Dienst hängt nur im internen Docker-Netz `worklingo_intern` (kein Zugang nach außen, kein öffentlicher Port) und ist nur über nginx
erreichbar. nginx lässt nur `POST /tts` durch (2 KB, 4 Anfragen pro Sekunde und Adresse), der Dienst prüft Sprache, Stimme und Länge, begrenzt gleichzeitige
Synthesen und protokolliert keine Texte. Container: ohne Root, schreibgeschützt, ohne Capabilities, 1,5 GB RAM und 1,5 CPU als Grenze.
