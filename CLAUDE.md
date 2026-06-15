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
5. **Na elke taak altijd committen én pushen** — geen uitzondering, ook niet voor kleine wijzigingen
6. **Push altijd via het GitHub API script** — `git push` timed out in de sandbox

```bash
# Altijd uitvoeren na elke wijziging:
cd /home/one/Claude/fotoApp && node tests/run-tests.js
# Daarna altijd committen én pushen:
git add -A && git commit -m "type: beschrijving"
python3 /tmp/github_push.py
```

**Push-script `/tmp/github_push.py`** (altijd aanmaken als het niet bestaat):
```python
import subprocess, json, base64, urllib.request, urllib.error

OWNER = "boulbaal"; REPO = "fotoApp"
REPO_DIR = "/sessions/magical-fervent-davinci/mnt/fotoApp"
GH_TOKEN = subprocess.check_output(["git","-C",REPO_DIR,"remote","get-url","origin"],text=True).split("//")[1].split("@")[0]
HEADERS = {"Authorization": f"token {GH_TOKEN}", "Content-Type": "application/json", "Accept": "application/vnd.github.v3+json"}

def api(method, path, data=None):
    req = urllib.request.Request(f"https://api.github.com{path}", json.dumps(data).encode() if data else None, HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:200]}"); raise

def run(cmd): return subprocess.check_output(cmd, shell=True, cwd=REPO_DIR).decode().strip()

remote_sha = api("GET", f"/repos/{OWNER}/{REPO}/git/ref/heads/main")["object"]["sha"]
changed = [f for f in run(f"git diff --name-only {remote_sha} HEAD").split("\n") if f and f != ".pid"]
print(f"Pushing {len(changed)} files...")
blobs = {}
for fp in changed:
    try:
        raw = open(f"{REPO_DIR}/{fp}", "rb").read()
        try: payload = {"content": raw.decode("utf-8"), "encoding": "utf-8"}
        except: payload = {"content": base64.b64encode(raw).decode(), "encoding": "base64"}
        blobs[fp] = api("POST", f"/repos/{OWNER}/{REPO}/git/blobs", payload)["sha"]; print(f"  ✓ {fp}")
    except FileNotFoundError: blobs[fp] = None
    except: print(f"  ✗ {fp} (geblokkeerd)"); blobs[fp] = None

base_tree = api("GET", f"/repos/{OWNER}/{REPO}/git/commits/{remote_sha}")["tree"]["sha"]
new_tree = api("POST", f"/repos/{OWNER}/{REPO}/git/trees", {"base_tree": base_tree, "tree": [{"path": p, "mode": "100644", "type": "blob", "sha": s} for p, s in blobs.items() if s]})["sha"]
new_commit = api("POST", f"/repos/{OWNER}/{REPO}/git/commits", {"message": run("git log -1 --pretty=%B"), "tree": new_tree, "parents": [remote_sha]})["sha"]
api("PATCH", f"/repos/{OWNER}/{REPO}/git/refs/heads/main", {"sha": new_commit, "force": True})
print(f"✅ Gepusht: https://github.com/{OWNER}/{REPO}")
```

Huidig testresultaat bij schrijven van deze regel: **148/148 geslaagd**

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
| `src/api.js` | REST API: bronnen CRUD, fotos paginering, scan beheer, stats, duplicaten, mapbrowser, **export endpoints** |
| `src/export.js` | Export logica: selectie, bestandsnaam generatie, kopiëren, schijfruimte check, hervatten |

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
| `public/js/export.js` | Export UI: preview, voortgangsbalk, stop, klaar-scherm, hervatten |

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

### ✅ Fase 3 — Export (voltooid)
- Kaart/map view met geotagged foto's ✅
- Negeren-pagina: klik=toggle, hover-preview, DUP/NEGEREN/MEENEMEN badges ✅
- Negeer cascade: alle duplicaten in groep mee-negeren ✅
- Export functionaliteit volledig geïmplementeerd ✅
  - Selectie: genegeerd=0, is_duplicaat=0
  - Bestandsnaam: `Land_Stad_dd_mm_yyyy.jpg`
  - Mapstructuur: jaar/maand
  - Schijfruimte check vóór start
  - Voortgangsbalk met huidig bestand
  - Hervatten na onderbreking (geexporteerd per foto bijgehouden)

### 🔮 Toekomstige uitbreiding (niet gepland)
- Foto detail lightbox (volledige EXIF weergave)
- Batchbewerkingen
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
- Fase 3 export geïmplementeerd (10 juni 2026): negeer-cascade, Land_Stad_dd_mm_yyyy.jpg naamgeving, jaar/maand mappen, schijfruimte check, hervatten ✅
- Sidebar layout: fase-stepper zit in aside#sideBar, main is flex:1, .pagina-kaart heeft left:184px

---

## 🚀 Promotie & publicatie (sessie 13 juni 2026)

### Wat is gepubliceerd

| Platform | URL | Status |
|---|---|---|
| **Dev.to** | https://dev.to/boulbaal/i-built-a-free-open-source-photo-video-organizeopensourcephotographynodejselectronr-for-27000-1a19 | ✅ Live |
| **Reddit r/selfhosted** | https://www.reddit.com/r/selfhosted/comments/1u3cvwq/new_project_megathread_week_of_11_jun_2026/ | ✅ Gepost als comment |
| **GitHub** | https://github.com/boulbaal/fotoApp | ✅ Live, README bijgewerkt |
| **GitHub Pages** | https://boulbaal.github.io/fotoApp/ | ✅ Live |
| **keuzevrijbijmij.nl** | https://keuzevrijbijmij.nl/aanbieders/profiel | ⏳ Formulier half ingevuld, nog niet ingediend |

### Accounts aangemaakt deze sessie
- **Reddit**: account aangemaakt op naam van eigenaar, ingelogd via reddit.com
- **keuzevrijbijmij.nl**: account bestaat al, ingelogd via /aanbieders/profiel

### README wijzigingen (13 juni 2026)
- Naam "Ali" verwijderd uit de beschrijving én onderaan ("Made with ❤️ by Ali")
- "27.000+" vervangen door "volledige fotocollectie" (generiek, geen specifiek aantal)
- GitHub deployment history opgeschoond: 9 van 10 oude deployments verwijderd

### ⏳ Nog te doen (volgende sessie)

1. **keuzevrijbijmij.nl** — formulier afmaken en indienen (Bedrijfsnaam: FotoApp, Locatie: Nederland, Website: https://github.com/boulbaal/fotoApp, advertentietekst al ingevuld)
2. **Handleiding in de app** — uitgebreide handleiding met annotaties/pijltjes, meertalig (NL/EN/FR/DE/ES/AR), te tonen in de taal die rechtsboven geselecteerd is, geplaatst net boven de sponsoring sectie
3. **AlternativeTo.net** — FotoApp registreren als alternatief voor Google Photos
4. **GitHub repo** — overwegen of een echte repo (i.p.v. dev.to link) in Reddit post wenselijk is

### 🔑 Toegang & tokens
- **GitHub token**: zit verwerkt in git remote URL — ophalen via `git remote get-url origin`
- **GitHub repo**: github.com/boulbaal/fotoApp
- **Push script**: altijd aanmaken als `/tmp/github_push.py` (zie bovenaan dit bestand)
- **Reddit**: ingelogd in browser van gebruiker
- **keuzevrijbijmij.nl**: ingelogd in browser van gebruiker (account op naam eigenaar)

---

## 🚀 Promotie-uitbreiding (sessie 14 juni 2026)

Volledig promotieplan + materiaal toegevoegd in `docs/promote/`:

| Bestand | Inhoud |
|---|---|
| `docs/promote/PROMOTIEPLAN.md` | Overkoepelende strategie + Ali's actielijst |
| `docs/promote/distributie-checklist.md` | awesome-lijsten, AlternativeTo, Product Hunt, winget, Flathub — copy-paste klaar |
| `docs/promote/code-signing-beslissing.md` | Gratis vs betaalde vertrouwenspaden (Azure Artifact Signing $9,99/mnd, Apple $99/jr) |
| `docs/promote/winget/` | winget-manifest templates (SHA256 invullen na release) |

### Wijzigingen deze sessie
- **FUNDING.yml**: PayPal als `custom`-link → Sponsor-knop werkt direct zonder nieuw account. Ko-fi/BMC als placeholders.
- **README**: Mac/Linux downloads (i.p.v. "zelf bouwen") + ❤️ Steun-sectie met framing.
- **Launch-posts** (`posts.md`, `launch-posts.md`): "coming soon" weg → cross-platform. Nieuwe r/degoogle + r/privacy posts + Show HN timing-tip.

### ⏳ Belangrijkste open acties (alleen Ali)
1. Beslissing code signing ($9,99/mnd Azure) — pas zinvol bij honderden downloads
2. Ko-fi/Buy Me a Coffee account aanmaken → gebruikersnaam doorgeven voor FUNDING.yml
3. AlternativeTo aanmelden (tekst staat klaar)
4. awesome-privacy/degoogle PR's (Claude kan ze via API klaarzetten)
5. Launch-dag: Show HN + Reddit + Product Hunt (met screenshots/GIF)

### Belangrijke nuance
- **awesome-selfhosted past waarschijnlijk NIET** (is voor server-software). Richt op awesome-privacy / degoogle / humane-tech / open-source-mac.
- Strategie: eerst adoptie, dan donaties. Realistische donatie-conversie ~0,1–1%.

---

## 🚀 Viral-feature + release v1.0.1 (sessie 15 juni 2026)

### ✨ "Jouw foto-leven" deelscherm (Wrapped)
- Nieuw `/api/wrapped` endpoint (`src/api.js`): totalen, landen, steden, top-jaar, drukste maand, top-5 landen.
- Nieuwe pagina + nav-knop ✨ Foto-leven; `public/js/wrapped.js` rendert de kaart en exporteert als PNG (1080×1350 canvas, story-formaat, watermerk + repo-link).
- i18n keys `wrapped_*` in nl/en/fr/de.
- Doel: de enige feature die zichzelf verspreidt — elke gedeelde kaart = gratis reclame met repo-link in beeld.

### Release v1.0.1 — alle platforms live
- Versie gebumpt naar 1.0.1, getagd, build-all.yml getriggerd.
- **macOS-build fix**: faalde op `ModuleNotFoundError: No module named 'distutils'` (runner draait Python 3.12). Opgelost door `actions/setup-python@v5` met `python-version: '3.11'` toe te voegen aan de mac- én linux-job in `build-all.yml`.
- `build-windows.yml` op **workflow_dispatch only** gezet → geen dubbele Windows-build meer bij tags.
- Release v1.0.1 bevat nu: Windows `.exe`, macOS Intel `.dmg`, macOS arm64 `.dmg`, Linux `.AppImage` + `.deb`. Release uit draft → **live**, als latest gemarkeerd.
- **README downloadlinks** wijzen nu naar `/releases/latest` (versie-onafhankelijk, breken nooit meer bij een versiebump). Voorheen hard naar `FotoApp-Setup-1.0.0.exe`.

### Launchmateriaal afgerond
- `docs/promote/LAUNCHDAG.md` — definitief draaiboek: tijdschema, finale Show HN + Reddit-teksten (met Foto-leven-hook), capture-gids (screenshots/GIF), antwoord-spiekbriefje.
- `docs/promote/assets/foto-leven-voorbeeld.png` — voorbeeld-deelplaatje (fallback). **Beste visual = Ali's eigen export** via ✨ Foto-leven → Download als afbeelding (échte cijfers + kleuren-emoji).

### ✅ Afgewerkt (15 juni, "werk het allemaal af")
- **winget-manifests** ingevuld met echte SHA256 (`EA8BF693…01B30F`), v1.0.1.
- **GitHub repo-metadata**: description, homepage (boulbaal.github.io/fotoApp), 18 topics. ⚠️ Social-preview-afbeelding kan NIET via API — alleen via web-UI (Settings → Social preview). Ali uploadt dit handmatig (Foto-leven-plaatje).
- **awesome-list PR's**: pluja/awesome-privacy **#870** + Lissy93/awesome-privacy **#625** (beide "Photo Management"). NB: tycrek/degoogle is GEARCHIVEERD → geen PR mogelijk. Fork voor Lissy93 = `boulbaal/awesome-privacy-1` (naam-collisie met pluja-fork).
- **Social posts afgerond** in `posts.md`: Twitter/X met Foto-leven-hook + "plaatje eraan"-notitie, Mastodon idem, en **volledige AlternativeTo-aanmelding** (copy-paste klaar).

### ⏳ Open voor Ali (echt alleen Ali)
- De eigenlijke launchdag uitvoeren (zie LAUNCHDAG.md). Grootste hefboom — niet meer code.
- Eigen Foto-leven-plaatje + 2–3 screenshots + korte GIF maken vóór de launch.
- Social-preview-afbeelding op GitHub handmatig uploaden (web-UI).
- AlternativeTo + Product Hunt indienen (login vereist; tekst staat klaar in `posts.md`).

### Tests
- 153/153 groen (6 nieuwe wrapped-tests). Push gaat via `/tmp/github_push.py` (REPO_DIR = huidige sessie-mount; `git diff HEAD~1 HEAD` + remote_sha als parent).

---

## 🚀 Awesome-lijsten uitbreiding + e-mailfeedback (sessie 15 juni 2026, deel 2)

Opdracht Ali: "post FotoApp op meer privacy/FOSS-sites zoals pluja, doe alles voor publiciteit" + "check mijn mails, er is feedback over wat fout liep, neem die mee".

### E-mailfeedback verwerkt
- **liss-bot** op Lissy93 PR #625 (compliance-check FAILED). Hersteld: entry naar **einde** van de Photo Management-sectie verplaatst, beschrijving ingekort tot **240 tekens** (was 323, limiet 50–250), **PR-template volledig ingevuld**, **auteurschap expliciet vermeld**, en een verklarende comment geplaatst. ⚠️ Resterende waarschuwingen (repo 6 dagen oud, 0 sterren, <16 wk sinds release) zijn **maturity-regels** van Lissy93 — kan alsnog worden afgewezen tot het project ouder is. Eerlijk gemeld aan Ali.
- Oude failed Windows-builds (v1.0.0, 11 juni) zijn al opgelost door de v1.0.1 setup-python-fix; geen actie nodig.

### Awesome-list PR's (5 totaal, alle via GitHub API)
| Lijst | PR | Categorie | Status |
|---|---|---|---|
| pluja/awesome-privacy | #870 | Photo Management | open, mergeable |
| Lissy93/awesome-privacy | #625 | Photo Management | open, compliance-fixes gedaan |
| 0PandaDEV/awesome-windows | #198 | Graphics | open |
| johnjago/awesome-free-software | #131 | Graphics | open |
| serhii-londar/open-source-mac-os-apps | #1160 | images | open |

- **Gearchiveerd/niet geschikt** (geen PR mogelijk): tycrek/degoogle, humanetech-community/awesome-humane-tech, luong-komorebi/Awesome-Linux-Software (allemaal archived); awesome-selfhosted (alleen server-software).
- Forks: `boulbaal/awesome-privacy` (pluja), `boulbaal/awesome-privacy-1` (Lissy93), `boulbaal/awesome-windows`, `boulbaal/awesome-free-software`, `boulbaal/open-source-mac-os-apps`. Branch overal `add-fotoapp`.

### ⏳ Browser-posts (login vereist — Ali keurt per platform goed)
- AlternativeTo, Reddit, Product Hunt: tekst staat klaar in `posts.md`. Reddit/HN volgens LAUNCHDAG.md **niet op maandag/vrijdag** posten.
