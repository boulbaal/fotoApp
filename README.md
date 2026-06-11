# FotoApp — Lokale foto- en videobeheer

[![Build Windows](https://github.com/boulbaal/fotoApp/actions/workflows/build-windows.yml/badge.svg)](https://github.com/boulbaal/fotoApp/actions/workflows/build-windows.yml)
[![Release](https://img.shields.io/github/v/release/boulbaal/fotoApp)](https://github.com/boulbaal/fotoApp/releases/latest)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> **Gratis, privé, lokaal.** Geen cloud, geen abonnement, geen gedoe.

**[⬇️ Download voor Windows](https://github.com/boulbaal/fotoApp/releases/latest)** | **[🌐 Website](https://boulbaal.github.io/fotoApp/)**

---

## Wat is FotoApp?

FotoApp is een **gratis desktopapplicatie** voor het organiseren van duizenden foto's en video's op je eigen computer. Gebouwd voor mensen die:

- Foto's hebben verspreid over meerdere schijven, USB-sticks en mappen
- Geen cloudabonnement willen voor hun privéfoto's
- Duplicaten willen opsporen en verwijderen
- GPS-locaties willen zien op een kaart
- RAW-bestanden en Google Takeout exports willen verwerken

**Ondersteunde formaten:** JPG, PNG, HEIC, RAW (CR2, CR3, NEF, ARW), MP4, MOV, AVI en meer.

---

## Functies

| Functie | Beschrijving |
|---------|-------------|
| **Duplicaatdetectie** | Vindt exact dubbele bestanden op basis van MD5-hash |
| **GPS-kaart** | Interactieve kaart met fotolocaties (Leaflet + OpenStreetMap) |
| **Geocoding** | Automatisch stad en land ophalen uit GPS-coördinaten (Nominatim) |
| **EXIF-data** | Datum, camera, lens, belichting, ISO — alles leesbaar |
| **RAW-support** | Thumbnails via exiftool (Canon, Nikon, Sony, Fuji, enz.) |
| **Google Takeout** | JSON-bestanden inlezen voor datum en GPS-fallback |
| **Dashboard** | Statistieken per jaar, camera, land — voor foto's én video's |
| **Slimme export** | Bestandsnamen: `Nederland_Amsterdam_15_06_2023.jpg`, geordend per jaar/maand |
| **Video-support** | Aparte statistieken en grafieken voor video's |
| **Negeren** | Foto's markeren als te negeren, duplicaten cascade-negeren |

---

## Download & Installatie

### Windows (installer)

1. Download **[FotoApp-Setup-1.0.0.exe](https://github.com/boulbaal/fotoApp/releases/latest)** (~95 MB)
2. Dubbelklik op het bestand
3. Bij SmartScreen-waarschuwing: klik **"Meer informatie"** → **"Toch uitvoeren"** *(app is niet gesigneerd)*
4. Open FotoApp via het startmenu

### Mac & Linux (zelf bouwen)

```bash
git clone https://github.com/boulbaal/fotoApp.git
cd fotoApp
npm install
npm run electron        # Dev-modus
npm run build:mac       # macOS DMG bouwen
npm run build:linux     # Linux AppImage + deb bouwen
```

Zie [ELECTRON.md](ELECTRON.md) voor meer details.

---

## Lokaal draaien (zonder Electron)

```bash
npm install
sh start.sh             # Tests uitvoeren + app starten
# Open http://localhost:3000 in je browser
```

**Optionele extra's (sterk aanbevolen):**
```bash
# Windows (Chocolatey):
choco install exiftool ffmpeg

# macOS (Homebrew):
brew install exiftool ffmpeg

# Linux:
sudo apt install libimage-exiftool-perl ffmpeg
```

---

## Privacybeleid

- Geen data wordt verstuurd naar externe servers
- GPS-coördinaten worden via Nominatim omgezet naar adressen (alleen coördinaten, geen foto's)
- Alle data blijft lokaal op jouw machine

---

## Technische details

- **Frontend:** Vanilla JavaScript, HTML, CSS (geen framework)
- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3`
- **Thumbnails:** `sharp` + `exiftool`
- **Desktop:** Electron
- **Build:** electron-builder (NSIS voor Windows, DMG voor Mac, AppImage voor Linux)

---

## English

**FotoApp** is a free, open-source desktop application for managing photos and videos locally. No cloud, no subscription.

**Key features:** duplicate detection, GPS map, EXIF viewer, RAW support (Canon/Nikon/Sony), Google Takeout import, smart export with automatic file naming, dashboard with statistics per year/camera/country.

**Download:** [GitHub Releases](https://github.com/boulbaal/fotoApp/releases/latest)  
**Website:** [boulbaal.github.io/fotoApp](https://boulbaal.github.io/fotoApp/)

*Search terms: free photo organizer, duplicate photo finder, local photo management, offline photo software, EXIF viewer, GPS photo map, RAW photo browser, Google Takeout import, photo backup Windows*

---

## Tests

```bash
node tests/run-tests.js          # Unit tests (148 tests)
node tests/run-tests.js --api    # Inclusief API tests (server moet draaien)
```

Huidig testresultaat: **148/148 geslaagd**

---

Gemaakt door Ali · [aboulbahaiem@gmail.com](mailto:aboulbahaiem@gmail.com)
