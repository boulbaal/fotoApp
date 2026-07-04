# 🚀 Launchdag-draaiboek — FotoApp

> Eén bestand, alles wat je op de dag zelf nodig hebt. Kopiëren, plakken, klaar.
> Alle losse teksten staan ook in `posts.md` en `launch-posts.md` — dit is de **definitieve, ingekorte versie voor de dag zelf**, met de nieuwe ✨ Foto-leven-hook erin verwerkt.

---

## 0. Vóór de dag (15 min, avond ervoor)

- [ ] Controleer dat de download werkt: open https://github.com/boulbaal/fotoApp/releases/latest en klik elke installer aan (Windows/Mac/Linux).
- [ ] Maak je **eigen** Foto-leven-plaatje: open de app → **✨ Foto-leven** → **Download als afbeelding**. Dit is je beste visual (échte cijfers, kleuren-emoji). Bewaar als `foto-leven.png`.
- [ ] Maak 2–3 schermafbeeldingen: het dashboard, de GPS-kaart, en het duplicaten-scherm. (Zie capture-gids onderaan.)
- [ ] Optioneel: een korte GIF (10–15 sec) van scannen → kaart → Foto-leven. (Zie capture-gids.)
- [ ] Leg klaar: een fallback-voorbeeldplaatje staat al in `docs/promote/assets/foto-leven-voorbeeld.png` als je geen eigen wilt gebruiken.

**Waarom de visual cruciaal is:** posts met een sterke afbeelding krijgen op Reddit en HN véél meer kliks. Het Foto-leven-plaatje is de hook die mensen doet doorklikken én delen.

---

## 1. Tijdschema (doordeweekse dag)

Kies een **dinsdag, woensdag of donderdag**. Niet maandag/vrijdag/weekend.

| Tijd (NL) | Actie |
|---|---|
| 14:00 | **Show HN** posten (= 08:00 US Eastern, beste tijd voor de voorpagina) |
| 14:05 | **r/selfhosted** posten |
| 14:10 | Eigen Foto-leven-plaatje posten op **Mastodon** + **Twitter/X** |
| 14:00–17:00 | **Blijf actief.** Beantwoord elke reactie binnen minuten. Dit bepaalt of je stijgt of zakt. |
| Volgende dag | **r/degoogle** posten |
| Dag 3 | **r/privacy** posten |
| Dag 4 | **r/DataHoarder** posten |

> ⚠️ **Nooit dezelfde tekst in meerdere subs op dezelfde dag** — Reddit's spamfilter bant je dan. Spreid het, en pas titel + intro per community aan (hieronder al gedaan).

---

## 2. Show HN (post om 14:00 NL)

**Titel:**
```
Show HN: FotoApp – Local, private photo manager with a shareable "year in photos" card
```

**Tekst (in het eerste commentaar plaatsen, niet als URL-only post):**
```
I had 27,000+ photos scattered across drives, USB sticks and phone backups, with
no good way to find duplicates or see where they were taken — without uploading
everything to Google or Apple. So I built FotoApp.

It runs entirely on your machine (Node.js + SQLite + Electron). No cloud, no
account, no telemetry.

What it does:
- Duplicate detection across all your drives via MD5 hash
- GPS map of every geotagged photo (Leaflet/OpenStreetMap — no Google API)
- RAW thumbnails (Canon, Nikon, Sony, Fuji) via exiftool
- Automatic geocoding: GPS → city/country (Nominatim, no API key)
- Google Takeout import — reads the JSON to recover dates/GPS Google strips out
- Smart export: Netherlands_Amsterdam_15_06_2023.jpg, sorted by year/month
- A "Mijn foto-leven" screen that summarizes your whole collection into one
  shareable image (the thing that finally made organizing feel rewarding)

Installers for Windows, Mac and Linux:
https://github.com/boulbaal/fotoApp/releases/latest

Open source (GPLv3). Happy to answer anything — I built this solo.
```

**Na het posten:** voeg in een eigen comment de Foto-leven-afbeelding toe (HN ondersteunt geen inline images — link naar het plaatje, bv. de release-pagina of een imgur-link).

---

## 3. r/selfhosted (post direct na Show HN)

**Titel:**
```
I built a free, local-only photo manager — duplicate detection, GPS map, RAW, Google Takeout import, and a shareable "year in photos" card (no cloud, no account)
```

**Tekst:** gebruik de volledige r/selfhosted-tekst uit `posts.md`, en voeg dit blok toe net vóór de download-link:

```
One feature I didn't expect to love: a "Mijn foto-leven" screen that turns your
whole collection into a single shareable card — total photos, countries, cities,
busiest month, top countries. One click exports it as an image. (Picture in the
comments.)
```

**In de comments:** plaats je Foto-leven-plaatje als eerste comment.

---

## 4. r/degoogle (dag 2)

**Titel:**
```
I built a free local photo manager to finally get my photos off Google Photos — reads your Takeout export to recover dates & GPS
```

**Tekst:** gebruik de r/degoogle-tekst uit `posts.md`. Sterkste hoek hier = de **Google Takeout import** die datums/GPS terughaalt die Google uit de bestanden weghaalt. Voeg het Foto-leven-plaatje toe in de comments.

---

## 5. r/privacy (dag 3)

**Titel:**
```
Free open-source tool to move your photos off Google Photos / iCloud onto your own computer — 100% local, no telemetry
```

**Tekst:** gebruik de r/privacy-tekst uit `posts.md`. Sterkste hoek = **geen telemetrie, enige netwerk-call is optionele geocoding (alleen coördinaten, geen foto's)**.

---

## 6. Sociale kanalen (zelfde dag als Show HN)

**Mastodon / Twitter-X** — gebruik de teksten uit `posts.md` en **hang het Foto-leven-plaatje eraan**. Op deze kanalen is de afbeelding het halve werk.

Hashtags: `#FOSS #OpenSource #Photography #Privacy #SelfHosted #deGoogle`

---

## 7. Listings (geen tijdsdruk, doe in de dagen erna)

Volgorde van impact (blijvend verkeer, niet eendaags):

1. **AlternativeTo.net** — meld FotoApp aan als alternatief voor Google Photos / Apple Photos / digiKam / Shotwell. Tekst staat in `posts.md`.
2. **awesome-privacy** / **awesome-degoogle** / **awesome-humane-tech** — PR's (zie `distributie-checklist.md`). NB: awesome-selfhosted is voor server-software en weigert desktop-apps waarschijnlijk.
3. **winget** — manifest staat klaar in `docs/promote/winget/` (SHA256 invullen na release).
4. **Product Hunt** — alleen als je een dag hebt om het goed te begeleiden; anders overslaan.

---

## 8. Capture-gids (schermafbeeldingen + GIF)

**Schermafbeelding (Linux):**
- Hele venster: `gnome-screenshot -w` of toets `Alt+PrintScreen`.
- Selectie: `gnome-screenshot -a`.

**GIF maken (Linux):**
- Installeer Peek: `sudo apt install peek` → start Peek, sleep het kader over het app-venster, klik **Record as GIF**.
- Of `byzanz-record --duration=15 --x=0 --y=0 --width=1280 --height=800 demo.gif`.
- Houd 'm kort (10–15 sec) en laat één duidelijk verhaal zien: **bron toevoegen → scannen → kaart → ✨ Foto-leven**.

**Tips voor goede shots:**
- Maak het app-venster ruim (≥1280 breed) zodat tekst scherp is.
- Zorg dat er data in zit (de demo met lege database oogt zwak).
- Het Foto-leven-scherm is je sterkste enkele beeld — gebruik dat als hoofd-visual.

---

## 9. Antwoord-spiekbriefje (voor de eerste uren)

Verwachte vragen en korte antwoorden:

- **"Why not digiKam/PhotoPrism/Immich?"** → Die zijn krachtig maar zwaar (server, Docker, leercurve). FotoApp is één installer, draait meteen, gericht op opruimen + dedupe + export. Geen server nodig.
- **"Is it really offline?"** → Ja. Enige netwerk-call is optionele reverse-geocoding via OpenStreetMap (stuurt alleen coördinaten). Uit te zetten.
- **"Mac/Windows unsigned warning?"** → Klopt, nog niet code-signed (zie `code-signing-beslissing.md`). Rechtsklik → Open (Mac) / "More info → Run anyway" (Windows). Source is open, te controleren.
- **"How do I support it?"** → Sponsor-knop op GitHub (PayPal). Gratis en blijft gratis.

---

## 10. Na de launch

- [ ] Noteer welke post het beste liep → daar de volgende keer op focussen.
- [ ] Reageer nog 1–2 dagen op late comments (Reddit-posts blijven dagen verkeer trekken).
- [ ] Bij >50 sterren: awesome-lijst PR's hebben dan meer kans.
- [ ] Overweeg pas code-signing ($9,99/mnd Azure) bij honderden downloads.
