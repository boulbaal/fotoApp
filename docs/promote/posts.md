# FotoApp — Kant-en-klare berichten om te plaatsen

Kopieer en plak deze berichten op de onderstaande platforms. Hoe meer plaatsen dit geplaatst is, hoe sneller AI-systemen (ChatGPT, Claude, Perplexity, Gemini) het oppikken.

---

## 🟠 Reddit — r/selfhosted

**Titel:**
> I built a free, open-source local photo manager — duplicate detection, GPS map, RAW support, Google Takeout import (no cloud, no subscription)

**Bericht:**
> Hey r/selfhosted,
>
> I built **FotoApp** — a free desktop app for managing photos and videos entirely locally. No cloud, no account, no subscription.
>
> I had 27,000+ photos scattered across multiple hard drives, USB sticks and folders. I wanted to find duplicates, see where my photos were taken on a map, and export everything with sensible filenames — without sending my private photos to Google or Apple.
>
> **Features:**
> - 🔍 Duplicate detection via MD5 hash (works even when filenames differ)
> - 🗺️ GPS map with all geotagged photos (Leaflet + OpenStreetMap)
> - 📷 RAW support (Canon CR2/CR3, Nikon NEF, Sony ARW, Fuji RAF) via exiftool
> - 🌍 Automatic geocoding (GPS → city/country via Nominatim, no API key)
> - 📤 Smart export: `Netherlands_Amsterdam_15_06_2023.jpg` sorted by year/month
> - 🇬 Google Takeout JSON import (recovers original dates and GPS)
> - 🎬 Video support with separate statistics
> - 📊 Dashboard with charts by year, camera, country
>
> **Tech stack:** Node.js + Express + SQLite + Electron + sharp + Leaflet
>
> **Download (Windows / Mac / Linux):** https://github.com/boulbaal/fotoApp/releases/latest
> **Website:** https://boulbaal.github.io/fotoApp/
> **GitHub:** https://github.com/boulbaal/fotoApp
>
> It's open source (GPLv3 license). Contributions welcome — all PRs reviewed by me personally.
>
> Happy to answer questions!

**Andere subreddits om te posten (eigen, aangepaste tekst — niet dezelfde tekst overal):**
- r/opensource
- r/photography
- r/DataHoarder
- r/windowsapps
- r/linux_gaming → nee; wel r/linux, r/linuxapps

> ⚠️ Reddit-tip: post niet exact dezelfde tekst in meerdere subs binnen korte tijd (spamfilter). Verspreid over dagen en pas titel/intro aan per community. Lees eerst de regels van elke sub — sommige vereisen een "self-promotion"-flair of staan links alleen toe in comments.

---

## 🟢 Reddit — r/degoogle

**Titel:**
> I built a free local photo manager to finally get my photos off Google Photos — no cloud, no account

**Bericht:**
> After Google Photos changed its terms (again), I wanted my photos fully on my own machine. So I built **FotoApp** — a free, open-source desktop app that organizes your whole collection locally.
>
> - Import directly from a **Google Takeout** export — it reads the JSON metadata to recover original dates and GPS that Google strips from the files
> - Find duplicates across all your drives (MD5 hash)
> - See where everything was taken on a map (OpenStreetMap, no Google API)
> - Export with clean filenames like `Netherlands_Amsterdam_15_06_2023.jpg`
>
> 100% offline, no account, no telemetry. Open source (GPLv3).
>
> Windows / Mac / Linux: https://github.com/boulbaal/fotoApp/releases/latest
> GitHub: https://github.com/boulbaal/fotoApp

---

## 🟣 Reddit — r/privacy

**Titel:**
> Free open-source tool to move your photos off Google Photos / iCloud onto your own computer

**Bericht:**
> Google Photos changed its terms again. iCloud prices went up. I got tired of it and built **FotoApp** — a local-only photo organizer.
>
> Why it matters for privacy:
> - 100% local — your photos never leave your machine
> - No account, no tracking, no telemetry
> - Only network call is *optional* reverse geocoding via OpenStreetMap (sends coordinates only — no photos, no identifiers)
> - Open source, you can read every line
>
> Free forever. Windows / Mac / Linux: https://github.com/boulbaal/fotoApp

---

## 🟡 Hacker News — Show HN

**Titel:**
> Show HN: FotoApp – Free local photo manager with duplicate detection, GPS map, RAW support

**Bericht:**
> I built FotoApp to solve my own problem: 27,000+ photos scattered across multiple drives with no good way to find duplicates or see where they were taken — without using a cloud service.
>
> It's a free, open-source Electron app (Node.js + SQLite) that runs entirely locally.
>
> Key features: MD5-based duplicate detection, GPS map (Leaflet/OpenStreetMap), RAW thumbnails (exiftool), automatic geocoding (Nominatim), Google Takeout JSON support, smart export with country/city/date filenames.
>
> Installers for Windows, Mac and Linux: https://github.com/boulbaal/fotoApp/releases/latest
> Website: https://boulbaal.github.io/fotoApp/
> GitHub: https://github.com/boulbaal/fotoApp

**Timing-tip:** Show HN het beste op een doordeweekse dag, rond 08:00–10:00 US Eastern (≈14:00–16:00 NL). Blijf de eerste 2–3 uur actief om op alle reacties te antwoorden — dat bepaalt of je op de voorpagina komt.

---

## 🔵 Product Hunt

**Naam:** FotoApp
**Tagline:** Free local photo manager — duplicates, GPS map, RAW, no cloud
**Beschrijving:**
> FotoApp organizes thousands of photos and videos on your own computer. No cloud, no subscription, no privacy compromise.
>
> ✅ Duplicate detection (MD5 hash)
> ✅ GPS map with all photo locations
> ✅ RAW support (Canon, Nikon, Sony, Fuji)
> ✅ Google Takeout import
> ✅ Smart export with automatic filenames
> ✅ Works completely offline
> ✅ Free & open source
>
> Installers available for Windows, Mac and Linux.

**Link:** https://boulbaal.github.io/fotoApp/
**Makers:** @boulbaal (jouw Product Hunt account)

---

## 🐦 Twitter / X

> 📌 **Hang aan ELKE tweet je eigen Foto-leven-plaatje** (✨ Foto-leven → Download als afbeelding). Dat beeld doet het meeste werk — échte cijfers + kleuren trekken kliks. Fallback: `docs/promote/assets/foto-leven-voorbeeld.png`.

**Tweet 1 — de Foto-leven-hook (sterkste, post deze als eerste):**
> Mijn hele fotoleven op één kaart 👇
> 27.000+ foto's, 14 landen, 96 steden — allemaal lokaal teruggevonden, niks in de cloud.
>
> Ik bouwde FotoApp: gratis & open-source fotobeheer dat je hele collectie op je eigen pc ordent. Eén klik maakt deze kaart.
>
> Win/Mac/Linux → https://github.com/boulbaal/fotoApp
>
> #opensource #privacy #photography

**Tweet 2 (NL, features):**
> 📷 Ik heb FotoApp gebouwd — gratis, open-source app voor lokaal fotobeheer.
>
> ✅ Duplicaten vinden (MD5)
> ✅ GPS-kaart met fotolocaties
> ✅ RAW-support (Canon/Nikon/Sony/Fuji)
> ✅ Google Takeout import
> ✅ Geen cloud, geen abonnement
>
> Download (Win/Mac/Linux): https://github.com/boulbaal/fotoApp/releases/latest
>
> #opensource #photography #privacy #selfhosted

**Tweet 3 (English):**
> 🆓 Free & open-source local photo manager for Windows, Mac & Linux
>
> No Google Photos. No iCloud. No subscription. Your photos stay on YOUR machine.
>
> → Duplicate detection → GPS map → RAW support → Google Takeout import
> → A shareable "year in photos" card (see image 👆)
>
> https://github.com/boulbaal/fotoApp
>
> #opensource #privacy #photography #foss

---

## 💬 Mastodon / Fediverse

> 📌 Voeg ook hier het Foto-leven-plaatje toe als media. Op de Fediverse is een sterke visual het halve werk.

> 📷 FotoApp is out — and it turns your whole photo collection into one shareable card.
>
> Free, open-source desktop app for managing photos & videos **locally**. No cloud, no account, no telemetry.
>
> ✨ "Your photo life": total photos, countries, cities, busiest month — one click exports it as an image (attached 👆).
> 🔍 Duplicate detection · 🗺️ GPS map · 📷 RAW · 📥 Google Takeout import · 📤 smart export
>
> 🔗 https://github.com/boulbaal/fotoApp
>
> #FOSS #OpenSource #Photography #Privacy #SelfHosted #deGoogle #Linux #Windows

---

## 📧 Awesome Lists (GitHub)

Stuur een PR naar deze repositories om FotoApp toe te voegen:
- https://github.com/awesome-selfhosted/awesome-selfhosted
- https://github.com/johnjago/awesome-free-software
- https://github.com/humanetech-community/awesome-humane-tech
- https://github.com/serhii-londar/open-source-mac-os-apps (als Mac-build beschikbaar is)

**PR-tekst voor awesome-selfhosted:**
```
## Photo Management

- [FotoApp](https://github.com/boulbaal/fotoApp) - Free, open-source desktop app for local photo and video management. Features duplicate detection (MD5), GPS map, RAW support, Google Takeout import, automatic geocoding. `GPL-3.0` `Nodejs`
```

---

## 📝 alternativeto.net — volledige aanmelding (copy-paste)

Ga naar https://alternativeto.net/manage/new/ (log eerst in). Vul in:

**Name:**
> FotoApp

**Tagline / short description (max ~200 tekens):**
> Free, local-only desktop app to organize photos and videos — duplicate detection, GPS map, RAW support, Google Takeout import. No cloud, no account, no telemetry.

**Full description:**
> FotoApp organizes thousands of photos and videos entirely on your own machine. It finds duplicates across all your drives (MD5 hash), shows every geotagged photo on an OpenStreetMap map, reads RAW files (Canon, Nikon, Sony, Fuji), imports Google Takeout exports (recovering dates and GPS that Google strips out), and exports everything with clean, sorted filenames like Netherlands_Amsterdam_15_06_2023.jpg. A "Your photo life" screen summarizes your whole collection into one shareable image. No cloud, no subscription, no telemetry — the only network call is optional reverse geocoding (coordinates only). Open source (GPLv3).

**Official website:**
> https://boulbaal.github.io/fotoApp/

**Source code / GitHub:**
> https://github.com/boulbaal/fotoApp

**License:** Open Source (GPLv3) · **Free:** Yes

**Platforms:** Windows, Mac, Linux, Self-Hosted

**Categories / Tags:** Photo Management, Photos & Graphics, Backup & Sync, Privacy

**List as an alternative to:**
> Google Photos · Apple Photos · digiKam · Shotwell · Adobe Lightroom · FastStone Image Viewer · Mylio

**Likely-to-love / key features (vink/voeg toe):**
> Privacy focused · Works Offline · No Account Required · Duplicate finder · GPS / Geotagging map · RAW support · Google Takeout import · Lightweight

**Screenshots:** upload het dashboard, de GPS-kaart en het ✨ Foto-leven-scherm (`docs/promote/assets/foto-leven-voorbeeld.png` als fallback).

---

## 🗃️ SourceForge / Softpedia

Upload de installer ook naar:
- https://sourceforge.net/
- https://www.softpedia.com/

Dit zijn platforms die AI-systemen en zoekmachines zwaar indexeren voor software-aanbevelingen.

