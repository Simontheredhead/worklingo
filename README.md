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
| `Dockerfile`, `docker-compose.yml`, `docker/`, `deploy/` | Betrieb auf dem Server (siehe unten) |

Neue Lektionen: einen Block im jeweiligen `content-*.js` ergänzen (Format steht am Dateianfang von `content.js`).

## Datenschutz
Der Fortschritt liegt nur im Browser (`localStorage`). Der Übersetzer sendet den eingegebenen Text an den Dienst
[MyMemory](https://mymemory.translated.net); die Spracherkennung läuft über den Dienst des Browsers.

## Betrieb auf dem Server (Docker)
Das Image besteht aus nginx ohne Root-Rechte und liefert nur die statischen Dateien aus (rund 82 MB, im Betrieb etwa 5 MB RAM).

**Gehärtet:** Benutzer `nginx` (UID 101), schreibgeschütztes Dateisystem, alle Linux-Capabilities entfernt,
`no-new-privileges`, Grenzen für RAM (64 MB), CPU und Prozesse, nur GET/HEAD erlaubt, Anfragen pro Adresse begrenzt,
strenge Sicherheits-Header (CSP, `nosniff`, `X-Frame-Options`, Permissions-Policy). Die CSP erlaubt nur eigene Dateien
und die Übersetzungs-API von MyMemory.

**Stabil:** `restart: unless-stopped`, Healthcheck (`/healthz`), begrenzte Logs (3 × 5 MB).

Es gibt bewusst keinen öffentlichen Port. HTTPS übernimmt der Caddy des Geisterstunde-Stacks; dafür ist
`deploy/Caddyfile.worklingo` als Vorlage da (Subdomain eintragen, DNS-A-Eintrag auf die Server-IP setzen).

```bash
docker compose up -d --build     # Container bauen und starten
docker compose ps                # Status und Health
docker compose logs -f           # Logs
```

Der Container hängt im Docker-Netz `geisterstunde_default` (änderbar über `PROXY_NETWORK`), damit der Caddy ihn als `worklingo:8080` erreicht.
Das Mikrofon und die Installation als App funktionieren nur über HTTPS.
