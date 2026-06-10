# 📷 FotoApp

**Lokale foto-beheer applicatie** — foto's organiseren, duplicaten opruimen en migreren naar een nieuwe schijf. Geen cloud, geen uploads, alles blijft op je eigen computer.

🔗 **Code:** [github.com/boulbaal/fotoApp](https://github.com/boulbaal/fotoApp)

---

## Wat doet de app?

Je hebt foto's verspreid over meerdere locaties: je PC, een externe harde schijf, usb-sticks, Google Photos exports. De app helpt je om:

1. **Alles in kaart te brengen** — bronnen scannen, duplicaten opsporen, GPS-locaties invullen
2. **Te selecteren wat je wil bewaren** — foto's die je niet nodig hebt markeer je als "negeren"
3. **Te exporteren naar één nieuwe schijf** — alleen de foto's die je wil bewaren

De app draait volledig lokaal. Je opent hem in je browser op `http://localhost:3000`.

---

## Hoe werkt het? De drie fasen

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│   FASE 1 — Organiseren        FASE 2 — Selecteren                │
│   ─────────────────────       ──────────────────                  │
│                                                                   │
│   📁 Bronnen toevoegen        🚫 Foto's markeren die             │
│      (PC, SSD, USB)               je NIET wil bewaren            │
│          │                                                        │
│          ▼                    📋 Overzicht van alles             │
│   🔍 Scannen                      wat je negeert                 │
│      • metadata lezen                                             │
│      • duplicaten vinden                                          │
│      • GPS-locaties ophalen                                       │
│          │                                                        │
│          ▼                    FASE 3 — Exporteren (gepland)      │
│   🗺️  Kaart bekijken          ─────────────────────────          │
│      GPS handmatig toewijzen                                      │
│      Duplicaten bekijken      📦 Alleen bewaarde foto's          │
│                                   kopiëren naar nieuwe schijf    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architectuur — alles lokaal

```
┌──────────────────────────────────────────────────────────┐
│                    JE COMPUTER                           │
│                                                          │
│   Browser              Node.js server                   │
│   ──────────           ─────────────────                │
│   localhost:3000  ◄──► index.js + api.js                │
│                         Express + WebSocket              │
│                              │                           │
│                    ┌─────────┴──────────┐               │
│                    ▼                    ▼               │
│              SQLite DB           Foto's op schijf       │
│              data/fotos.db       ~/Pictures, SSD, USB   │
│              (metadata,          (originelen blijven     │
│               thumbnails,         altijd waar ze zijn)  │
│               GPS-data)                                  │
└──────────────────────────────────────────────────────────┘

GitHub (github.com/boulbaal/fotoApp)
  └── alleen de CODE — nooit foto's of database
```

**Wat staat op GitHub:** alleen de broncode (`src/`, `public/`, `tests/`, `index.js`, ...)

**Wat staat NIET op GitHub:** de database (`data/fotos.db`), thumbnails, foto's, en `node_modules/`

---

## Installatie

### Vereisten
- [Node.js](https://nodejs.org/) versie 18 of hoger
- Linux (Ubuntu/Debian) — de app gebruikt `zenity` voor de mapkiezer

```bash
# Installeer zenity (mapkiezer)
sudo apt install zenity

# Clone de code
git clone git@github.com:boulbaal/fotoApp.git
cd fotoApp

# Installeer dependencies
npm install
```

---

## Starten en stoppen

```bash
# App starten (voert eerst tests uit, dan start de server)
sh start.sh

# App stoppen
sh stop.sh
```

De app is daarna bereikbaar op: **http://localhost:3000**

---

## Projectstructuur

```
fotoApp/
├── index.js              ← server (Express + WebSocket)
├── src/
│   ├── api.js            ← REST API endpoints
│   ├── scanner.js        ← foto's scannen, EXIF, GPS, duplicaten
│   └── database.js       ← SQLite schema en migraties
├── public/
│   ├── index.html        ← de webpagina
│   ├── css/style.css     ← stijlen
│   └── js/               ← frontend JavaScript per pagina
├── tests/
│   └── run-tests.js      ← testsuite (148 tests)
├── data/
│   └── fotos.db          ← SQLite database (niet op GitHub)
├── start.sh              ← start de app
└── stop.sh               ← stop de app
```

---

## Wat wordt gescand?

Per foto leest de app:
- **EXIF-metadata** — datum, camera, instellingen
- **GPS-coördinaten** → automatisch omgezet naar stad + land
- **MD5-hash** → duplicaten detecteren
- **Google Takeout JSON** → datum en GPS uit Google Photos exports
- **Thumbnail** → snel voorbeeld via `sharp` of `exiftool`

Datum-fallback (in volgorde): EXIF → Google JSON → bestandsnaam → aanmaakdatum → wijzigingsdatum

---

## Technische keuzes

| Keuze | Reden |
|---|---|
| SQLite | Lokaal-first, geen aparte database server |
| Vanilla JS | Geen build-stap, direct begrijpbaar |
| WebSocket | Live scanvoortgang + mapkiezer |
| Nominatim | GPS → stad/land, gratis en privacy-vriendelijk |
| MD5-hash | Snel, voldoende voor duplicaatdetectie |
| zenity | Native mapkiezer op Linux |

---

## Privacy

- Foto's verlaten nooit je computer
- GPS-data wordt lokaal vertaald via [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) — geen commerciële API
- Geen accounts, geen tracking, geen analytics
