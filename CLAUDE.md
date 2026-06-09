# FotoApp — Project Geheugen

> Dit bestand is het geheugen van het project. Lees dit als eerste bij elke sessie.
> Geen uitleg nodig — alles wat je moet weten staat hier.

---

## 🚨 TESTREGEL — NIET ONDERHANDELEN, ALTIJD UITVOEREN

**Dit is een permanente opdracht van Ali. Nooit overslaan, nooit vergeten.**

1. **Bij elke aanpassing aan de code** → schrijf eerst of tegelijk tests die de aanpassing afdekken
2. **Na elke code-uitvoering of wijziging** → voer de volledige testsuite uit: `node tests/run-tests.js`
3. **Controleer dat alle eerder bestaande tests nog steeds slagen** — nieuwe code mag geen bestaande tests breken
4. **Commit nooit code zonder dat alle tests groen zijn**
5. **Na elke taak altijd committen** — geen uitzondering, ook niet voor kleine wijzigingen

```bash
# Altijd uitvoeren na elke wijziging:
cd /home/one/Claude/fotoApp && node tests/run-tests.js
# Daarna altijd committen:
git add -A && git commit -m "type: beschrijving"
```

Huidig testresultaat bij schrijven van deze regel: **105/105 geslaagd**

---

## 🎯 Wat is dit project?

Een **lokale foto-beheer webapplicatie** voor Ali. Draait op `localhost:3000`. Geen cloud, geen externe diensten, alles blijft op de eigen machine.

**Het probleem dat opgelost wordt:**
Ali heeft ~27.000+ foto's verspreid over meerdere locaties (Linux PC, externe SSD, usb-sticks, etc.). Hij wil ze kunnen vinden, filteren, organiseren en duplicaten opsporen — zonder technische kennis nodig te hebben voor dagelijks gebruik.

---

## 👤 Gebruikersvereisten (permanent — nooit opnieuw vragen)

- **Lokaal only** — geen cloud, geen uploads naar externe servers
- **Privacy first** — GPS-data, gezichten, metadata blijft intern
- **Begrijpbaar voor niet-technici** — duidelijke UI, geen jargon
- **Eerlijke feedback** — liever "bezig met verwerken..." dan valse "klaar!" meldingen
- **Snel resultaat** — niet wachten op perfectie, iteratief werken
- **Testen voor starten** — `start.sh` voert tests uit vóór de app opstart
- **Landen in het Engels** — geen Japanse/Arabische tekens in de statistieken

---

## 🏗️ Wat is gebouwd (huidige staat)

### Backend
| Bestand | Wat het doet |
|---|---|
| `index.js` | HTTP server + WebSocket (folder picker + live logs) |
| `src/database.js` | SQLite schema: bronnen, fotos, scan_log + automatische migraties |
| `src/scanner.js` | Recursief scannen, EXIF, GPS (EN), MD5 hash, thumbnails (sharp+exiftool), duplicaatdetectie, wachtrij, stop-vlag, **post-scan geocode pass** |
| `src/api.js` | REST API: bronnen CRUD, fotos paginering, scan beheer, stats, duplicaten, mapbrowser |

### Frontend
| Bestand | Wat het doet |
|---|---|
| `public/index.html` | HTML structuur + script/link tags |
| `public/css/style.css` | Alle stijlen |
| `public/js/app.js` | Pagina-navigatie + resize onderbalk (CSS var `--balk-h`) |
| `public/js/bronnen.js` | Bronnen beheren, scan starten, bewerken modal |
| `public/js/dashboard.js` | Statistieken + klikbare grafieken + **vlag emoji per land** |
| `public/js/fotos.js` | Foto-gallerij, filters, paginering, detail modal (datum_bron, vlag) |
| `public/js/duplicaten.js` | Duplicaten-overzicht |
| `public/js/scanner.js` | Scan UI: voortgangsbalk, polling, ticker, stop, **geocode-voortgangsbalk** |
| `public/js/mapkiezer.js` | WebSocket client: folder picker + twee log-panelen (client/server) |
| `public/js/gpskaart.js` | Leaflet kaart voor handmatig GPS toewijzen (Nominatim reverse geocoding) |
| `public/js/utils.js` | Hulpfuncties: formatGrootte, formatDatum, landVlag(), landVlagVanNaam(), LAND_CODES |

### UI Functies
- **Dashboard**: statistieken kaarten + klikbare balkgrafieken (jaar, camera, landen met 🏳️ vlag, per bron)
- **Bronnen**: bronnen toevoegen/bewerken/verwijderen, scan starten, wachtrij
- **Foto's**: 200/pagina, filter op jaar/camera/bron/land, detail modal met GPS kaart, datum_bron label
- **Duplicaten**: groepen tonen
- **Onderbalk** (altijd zichtbaar, fixed bottom, hoogte instelbaar):
  - Scan voortgangsbalk (filmstrip stijl, 📷 camera icoon)
  - Geocode voortgangsbalk (verschijnt na scan, toont locaties ophalen)
  - Twee log-panelen naast elkaar: 📱 Client (cyaan) | 🖥 Server (groen)
  - Sleep-handle om hoogte aan te passen (onthouden via localStorage)

### Scripts & Tests
| Bestand | Wat het doet |
|---|---|
| `start.sh` | Tests uitvoeren → poort vrijmaken → app starten |
| `stop.sh` | App stoppen via PID |
| `fix-landen.js` | Eenmalige migratie: niet-Engelse landnamen + gps_land_code via Nominatim (nu ook automatisch na scan) |
| `tests/run-tests.js` | Test runner met kleurrijke output, ⚠ voor niet-fatale fouten |
| `tests/database.test.js` | DB tests (5x) — ⚠ niet-fataal bij Node versie mismatch |
| `tests/scanner.test.js` | Scanner tests (15x) — code-analyse + UI checks |
| `tests/api.test.js` | API tests — alleen met `--api` flag (vereist draaiende server) |

---

## 📦 Dependencies

```json
"better-sqlite3": "^12.x",
"exifr": "^7.x",
"express": "^5.x",
"sharp": "^0.34.x",
"ws": "^8.x",
"chokidar": "^5.x",
"node-cron": "^4.x"
```

---

## 🗺️ Faseplanning

### ✅ Fase 1 — MVP (voltooid)
- Scanner met EXIF, GPS, hashing, thumbnails
- Database met bronnen/fotos/scan_log
- Volledige REST API
- Web UI met dashboard, bronnen, foto's, duplicaten
- WebSocket voor folder picker en live logs
- Twee-kolom log systeem met resize
- Tests + start/stop scripts

### ✅ Fase 2 — Verbetering (voltooid)
- Scan knop direct visuele feedback ✅
- Twee log-panelen ✅
- Resize onderbalk (CSS var `--balk-h`) ✅
- RAW thumbnail extractie via exiftool ✅
- Google Takeout JSON ondersteuning ✅
- GPS handmatig toewijzen via Leaflet kaart ✅
- Post-scan geocode pass (automatisch, achtergrond) ✅
- Vlag emoji in Landen-grafiek en detail modal ✅
- Datum-fallback keten + datum_bron label ✅
- gps_land_code opgeslagen in DB ✅
- Filmstrip scan voortgangsbalk ✅

### 🚀 Fase 3 — Uitbreiding (gepland)
- Kaart/map view met geotagged foto's
- Foto detail lightbox (volledige EXIF weergave)
- Batchbewerkingen (meerdere foto's verwijderen/verplaatsen)
- Export/backup functionaliteit
- Geplande auto-scan (cron)
- Tekstzoekfunctie
- Mobiel-vriendelijke layout

---

## 📱 Google Takeout JSON ondersteuning

Google Takeout exporteert naast elke foto een `{bestandsnaam}.jpg.json` met extra metadata.

**Wat we lezen uit de JSON:**
| Veld | Gebruik |
|---|---|
| `photoTakenTime.timestamp` | Datum fallback (als EXIF geen datum heeft) |
| `geoData.latitude/longitude` | GPS fallback (als EXIF geen GPS heeft) |
| `description` | Opgeslagen in `google_description` kolom |
| `googlePhotosOrigin.deviceType` | Opgeslagen in `google_device_type` kolom |

**Prioriteitsregel:** EXIF heeft altijd voorrang. Google JSON is enkel fallback.

**DB-kolommen toegevoegd aan `fotos` tabel:**
- `google_description TEXT`
- `google_device_type TEXT`

---

## 🌍 GPS & Geocoding procedure

**Hoe GPS-data in de app terechtkomt:**

1. **Tijdens scan** — EXIF GPS-coördinaten worden uitgelezen. Als die aanwezig zijn, roept de scanner meteen Nominatim aan voor stad/land/land_code.
2. **Google Takeout fallback** — Als geen EXIF GPS, kijkt de scanner in het `.jpg.json` bestand.
3. **Post-scan geocode pass** — Na elke scan draait automatisch een achtergrondproces dat alle foto's met GPS-coords maar zonder gps_land bijwerkt. Zichtbaar als groene balk in de UI.
4. **Handmatig via kaart** — In het detail modal kan GPS handmatig worden ingegeven via Leaflet kaart.
5. **Manuele geocode trigger** — `POST /api/scan/geocode` start de geocode pass handmatig.

**Vlag emoji systeem:**
- `landVlag(code)` — ISO 2-letter code → 🇧🇪 (Unicode Regional Indicators)
- `landVlagVanNaam(naam)` — Engelse landnaam → code via `LAND_CODES` lookup (~90 landen)
- Vlaggen worden getoond in: dashboard Landen-grafiek, foto detail modal (Locatie rij)
- `gps_land_code TEXT` kolom in DB opgeslagen bij scan en geocode pass

**Datum-fallback keten (in volgorde):**
1. EXIF `DateTimeOriginal` / `CreateDate`
2. Google Takeout JSON `photoTakenTime.timestamp`
3. Datum uit bestandsnaam (regex: `YYYYMMDD` patroon — bijv. `IMG-20250728-WA...`)
4. Bestandsaanmaakdatum (`stat.birthtime`)
5. Bestandswijzigingsdatum (`stat.mtime`)

De gebruikte bron wordt opgeslagen in `datum_bron TEXT` en getoond in het detail modal.

---

## 🔧 Technische beslissingen (niet opnieuw bespreken)

| Beslissing | Reden |
|---|---|
| SQLite ipv PostgreSQL | Lokaal-first, geen server nodig |
| WebSocket ipv HTTP polling | Nodig voor folder picker (zenity) + live logs |
| Vanilla JS ipv React | Geen build tool, direct begrijpbaar |
| zenity voor folder picker | Native GTK dialog op Linux |
| MD5 ipv SHA256 voor hashing | Sneller, voldoende voor duplicaatdetectie |
| Nominatim voor GPS → adres | Gratis, privacy-vriendelijk, geen API key |
| Tests vóór app start | Garantie dat code niet gebroken is |

---

## 📌 Git-werkwijze

Na **elke wijziging** een commit uitvoeren met gepaste boodschap:

```bash
git add -A
git commit -m "type: korte beschrijving

- detail 1
- detail 2"
```

**Commit types:**
- `feat:` — nieuwe functionaliteit
- `fix:` — bugfix
- `refactor:` — code herstructurering zonder gedragswijziging
- `test:` — tests toevoegen of aanpassen
- `chore:` — onderhoud (deps, config, cleanup)
- `docs:` — documentatie

**Regels:**
- Alleen lokale commits — **nooit pushen** tenzij expliciet gevraagd
- Git config is ingesteld: `Ali <aboulbahaiem@gmail.com>`
- Eén commit per logische wijziging — niet alles samenvoegen

---

## 🚫 Wat we nooit doen

- Geen cloud uploads of externe API's met privédata
- Geen echte foto's verwijderen via de app (enkel DB-records)
- Geen afhankelijkheid van betaalde diensten
- Geen scope creep zonder overleg

---

## 🎭 Agent-rollen (hoe ik keuzes maak)

Bij elke beslissing denk ik vanuit drie perspectieven:

**👤 Gebruiker (Ali's perspectief)**
_"Is dit begrijpbaar? Krijg ik eerlijke feedback? Werkt het zonder technische kennis?"_
→ Prioriteit: duidelijkheid, eerlijkheid, eenvoud

**🔧 Developer (technisch perspectief)**
_"Is de code onderhoudbaar? Zijn er tests? Zijn er edge cases?"_
→ Prioriteit: robuustheid, tests, geen stilte bij fouten

**📋 Project (scope perspectief)**
_"Past dit in de huidige fase? Is het nodig of nice-to-have?"_
→ Prioriteit: focus, geen scope creep, fase-bewust

---

## ▶️ App starten

```bash
cd /home/one/Claude/fotoApp
sh start.sh        # tests + starten
sh stop.sh         # stoppen
node fix-landen.js # landen migratie uitvoeren
node tests/run-tests.js --api  # ook API tests (server moet draaien)
```

App draait op: **http://localhost:3000**

---

## 📝 Sessie-notities

- Desktop Commander MCP valt periodiek weg (bekend Cowork-probleem)
- Database tests geven ⚠ waarschuwing in sandbox (Node versie mismatch) — werkt correct op Ali's machine
- Google Takeout JSON ondersteuning volledig geïmplementeerd (4 juni 2026) ✅
- Post-scan geocode pass geïmplementeerd (7 juni 2026) — fix-landen.js is nu overbodig voor nieuwe scans ✅
- Ali wist de DB regelmatig opnieuw en herscant alles — het systeem is ontworpen om dit te ondersteunen
- Geocode pass: ~505 unieke locaties in de DB, ~9 minuten bij 1.1s/locatie (Nominatim policy)
