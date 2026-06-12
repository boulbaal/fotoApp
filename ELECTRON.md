# FotoApp — Electron Build Instructies

## Vereisten

### Op alle platformen
- **Node.js** 18 of hoger
- **npm** 8 of hoger

### Optionele systeemtools (voor extra functies)
| Tool | Functie | Opmerking |
|------|---------|-----------|
| `exiftool` | RAW/video metadata lezen | Sterk aanbevolen |
| `ffmpeg` | Video thumbnails genereren | Sterk aanbevolen |

#### Installeren:
- **Windows**: Chocolatey: `choco install exiftool ffmpeg`
- **macOS**: Homebrew: `brew install exiftool ffmpeg`
- **Linux (Ubuntu/Debian)**: `sudo apt install libimage-exiftool-perl ffmpeg`

---

## Dev-modus (testen zonder build)

```bash
# 1. Installeer alle dependencies (inclusief Electron)
npm install

# 2. Rebuild native modules voor Electron
npm run rebuild

# 3. Start in Electron dev-modus
npm run electron
```

---

## Productiebuild

```bash
# Installeer dependencies
npm install

# Bouw voor alle platformen (cross-platform build vereist Docker of CI)
npm run build

# Of specifiek per platform:
npm run build:win    # → dist/FotoApp Setup x.x.x.exe
npm run build:mac    # → dist/FotoApp-x.x.x.dmg
npm run build:linux  # → dist/FotoApp-x.x.x.AppImage + .deb
```

### Output (in `dist/`):
| Platform | Bestand |
|----------|---------|
| Windows  | `FotoApp Setup 1.0.0.exe` (NSIS installer) |
| macOS    | `FotoApp-1.0.0.dmg` (disk image) |
| Linux    | `FotoApp-1.0.0.AppImage` + `fotoapp_1.0.0_amd64.deb` |

---

## Data-locatie (gepackagede app)

De database en data worden opgeslagen in de systeem-userData map:

| Platform | Pad |
|----------|-----|
| Windows  | `%APPDATA%\FotoApp\fotoapp-data\fotos.db` |
| macOS    | `~/Library/Application Support/FotoApp/fotoapp-data/fotos.db` |
| Linux    | `~/.config/FotoApp/fotoapp-data/fotos.db` |

---

## Iconen aanpassen

Vervang de bestanden in `build/`:
- `build/icon.png` — 512×512 px PNG (voor Linux)
- `build/icon.icns` — macOS formaat (gebruik `electron-icon-builder` of `icnsify`)
- `build/icon.ico` — Windows formaat (gebruik `electron-icon-builder`)

```bash
# npm tool om automatisch alle formaten te genereren vanuit één PNG:
npx electron-icon-builder --input build/icon.png --output build/
```

---

## Bekende beperkingen

- **Cross-platform build**: macOS apps bouwen kan alleen op macOS (Apple beperking). Gebruik GitHub Actions of een Mac.
- **Codesigning**: Zonder signature verschijnen er waarschuwingen op Windows/macOS. Voor productie: stel `CSC_LINK` en `CSC_KEY_PASSWORD` in.
- **exiftool/ffmpeg**: Niet gebundeld — moeten apart geïnstalleerd zijn. De app werkt zonder, maar zonder RAW-support en video-thumbnails.

---

## Troubleshooting

**"App kan server niet bereiken"**  
→ Poort 3000 is bezet. Herstart de app.

**"better-sqlite3 / sharp module error"**  
→ Native modules zijn niet gerebuilt voor de Electron versie. Voer `npm run rebuild` uit.

**Video's spelen niet af**  
→ Klik "Openen in systeemspeler" — de ingebouwde browser heeft beperkte codec-ondersteuning.
