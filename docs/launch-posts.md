# Lanceringsmateriaal — Reddit & communities

## r/selfhosted (2.1M leden) — EERSTE POST

**Titel:**
I built a free, local-only photo organizer for people leaving Google Photos — no cloud, no account, no subscription

**Tekst:**
After spending weeks trying to organize 27,000+ photos scattered across multiple hard drives, USB sticks and phone backups, I built FotoApp — a desktop app that runs entirely on your own machine.

**What it does:**
- Scans multiple sources at once (PC, external drive, USB, phone backup)
- Detects duplicates across all sources using MD5 hashing
- Maps GPS coordinates to city/country names (via OpenStreetMap — no API key, no Google)
- Exports to a clean structure: `France_Paris_15_07_2023.jpg` organized by year/month
- Writes GPS data back into the exported files' EXIF

**What it doesn't do:**
- Send anything to the cloud
- Require an account
- Cost money (ever)

It's open source and non-commercial. Built for people who want their memories back from Big Tech.

👉 GitHub: https://github.com/boulbaal/fotoApp

Happy to answer questions. Still early but fully functional on Linux — Windows/Mac installer coming soon.

---

## r/privacy (1.8M leden)

**Titel:**
Free open-source tool to get your photos off Google Photos/iCloud and onto your own computer

**Tekst:**
Google Photos changed its terms again. iCloud prices went up. Microsoft is training AI on OneDrive content.

I got tired of it and built a local-only photo organizer called FotoApp. It runs on your own computer, needs no internet connection (except for optional reverse geocoding via OpenStreetMap), and never touches a cloud server.

Features that matter for privacy folks:
- 100% local — your photos never leave your machine
- No account, no tracking, no telemetry
- Open source — you can read every line of code
- Non-commercial license — no company can monetize this

Free forever. GitHub: https://github.com/boulbaal/fotoApp

---

## r/DataHoarder (1M leden)

**Titel:**
Built a local photo deduplicator + organizer for hoarding 27,000+ photos across multiple drives

**Tekst:**
Fellow hoarders — I had photos on 6 different drives with massive duplication. Built a tool to fix this.

FotoApp scans all your sources simultaneously, finds duplicates via MD5 hash (even across drives), lets you review them and mark what to keep, then exports everything to a clean year/month structure with location-based filenames.

The duplicate cascade is my favorite feature: mark one photo as "ignore" and all copies in the same hash group are automatically ignored too.

Tech stack: Node.js + SQLite + Vanilla JS. Runs in browser (localhost). Currently Linux, Windows/Mac coming.

GitHub: https://github.com/boulbaal/fotoApp

---

## ProductHunt (lanceringstekst)

**Naam:** FotoApp
**Tagline:** Get your photos back from Big Tech — free, local, open source

**Beschrijving:**
FotoApp is a free, open-source desktop app that helps you organize thousands of photos on your own computer — no cloud, no subscription, no account needed.

Scan multiple drives at once, find duplicates, assign GPS locations, and export everything as `Country_City_DD_MM_YYYY.jpg` organized by year and month. Your photos stay on your machine, forever.

Built for people who are tired of paying Google, Apple and Microsoft to store their own memories.

**Links:**
- Website: https://boulbaal.github.io/fotoApp
- GitHub: https://github.com/boulbaal/fotoApp

---

## Tweakers.net (Nederlandstalig)

**Titel:**
FotoApp: gratis lokale foto-organizer — geen cloud, geen abonnement, open source

**Tekst:**
Na jaren foto's verspreid over meerdere schijven en USB-sticks heb ik een tool gebouwd om dit op te lossen: FotoApp.

Het scant meerdere bronnen tegelijk, detecteert duplicaten via MD5, haalt GPS-locaties op via OpenStreetMap (privacy-first, geen Google-API), en exporteert alles naar een nette mapstructuur met bestandsnamen als `Belgie_Gent_14_06_2023.jpg`.

Volledig lokaal — geen cloud, geen account, geen abonnement. Open source en niet-commercieel.

GitHub: https://github.com/boulbaal/fotoApp
Momenteel Linux, Windows/Mac installer in de maak.
