# FotoApp — Distributie & listings checklist

Doel: FotoApp vindbaar maken op de plekken waar de doelgroep (privacy-bewuste mensen, self-hosters, mensen die weg willen van Google Photos) daadwerkelijk zoekt. Hoe meer plekken, hoe meer organisch verkeer én hoe vaker AI-assistenten (ChatGPT, Claude, Perplexity) het aanbevelen.

Legenda: 🟢 = Claude kan voorbereiden · 🔴 = alleen Ali (account/inloggen/indienen)

---

## 1. Awesome-lijsten (GitHub PR's) — grootste gratis verkeersbron

> ⚠️ Belangrijk: **awesome-selfhosted is voor server-software die je over een netwerk host.** Een desktop-app (Electron) wordt daar vaak afgewezen. Richt je op lijsten die wél bij een lokale desktop-app passen:

| Lijst | Past het? | Repo |
|---|---|---|
| **awesome-privacy** | ✅ ja | github.com/pluja/awesome-privacy |
| **awesome-degoogle / no-more-google** | ✅ ja (Takeout-import!) | github.com/tycrek/degoogle · github.com/nm-google/nomoreGoogle |
| **awesome-foss / awesome-open-source** | ✅ ja | diverse |
| **awesome-humane-tech** | ✅ ja | github.com/humanetech-community/awesome-humane-tech |
| **open-source-mac-os-apps** | ✅ zodra Mac-build live is | github.com/serhii-londar/open-source-mac-os-apps |
| **awesome-selfhosted** | ⚠️ waarschijnlijk afgewezen | github.com/awesome-selfhosted/awesome-selfhosted |

**🟢 Kant-en-klare entry (awesome-privacy / degoogle stijl):**
```markdown
- [FotoApp](https://github.com/boulbaal/fotoApp) - Free, local-only desktop app to organize photos and videos. Duplicate detection (MD5), GPS map (OpenStreetMap), RAW support, Google Takeout import, smart export. No cloud, no account, no telemetry. `ISC` `Electron/Node.js`
```

**🔴 Stappen per lijst (Ali, met GitHub-account):** fork → voeg regel toe in juiste categorie (alfabetisch) → lees CONTRIBUTING van die repo → commit → open PR. Claude kan de PR ook via de GitHub-API voor je klaarzetten als je dat wilt.

---

## 2. AlternativeTo.net — 🔴 Ali (account nodig)

Hoog in Google + door AI veel geciteerd. Meld FotoApp aan als alternatief voor: **Google Photos, Apple Photos, digiKam, Shotwell, Mylio, FastStone**.

- URL: https://alternativeto.net/manage/new/
- Naam: FotoApp
- Licentie: Open Source / Free
- Platforms: Windows, Mac, Linux
- Korte omschrijving (🟢 klaar):
  > FotoApp is a free, open-source desktop app for organizing thousands of photos and videos entirely on your own machine. Duplicate detection, GPS map, RAW support, Google Takeout import, smart export — no cloud, no account, no subscription.
- Tags: photo-management, privacy, offline, open-source, deduplication, exif

---

## 3. Product Hunt — 🔴 Ali (account + timing)

Tekst staat klaar in `docs/promote/posts.md`. Tips:
- Launch op **dinsdag–donderdag, 00:01 PST** (= 09:01 NL). Dan heb je een volle dag voor upvotes.
- Heb 3–5 screenshots + een korte demo-GIF klaar (de GPS-kaart en duplicatenweergave doen het goed).
- Vraag van tevoren een paar mensen om die dag te upvoten/commenten (eerste uur telt het zwaarst).
- Reageer de hele dag op elke comment.

---

## 4. winget (Windows Package Manager) — 🟢 manifest klaar, 🔴 PR door Ali

Hierdoor kunnen mensen `winget install FotoApp` typen, en het verhoogt vertrouwen (Microsoft indexeert het). Manifest-template staat in `docs/promote/winget/`. PR naar github.com/microsoft/winget-pkgs.

> Let op: winget verifieert de SHA256 van het exact gepubliceerde `.exe`. Vul die in nadat de release live staat (`certutil -hashfile FotoApp-Setup-1.0.0.exe SHA256`).

---

## 5. Flathub (Linux) — 🔴 Ali, meer werk

Flathub is dé vindplek voor Linux-apps en geeft veel vertrouwen + auto-updates. Vereist een eigen manifest-repo en review. Grotere klus; goede kandidaat voor een volgende sessie. Alternatief op korte termijn: de AppImage aanmelden bij **AppImageHub** (github.com/AppImage/appimage.github.io) — veel laagdrempeliger.

---

## 6. Softpedia / SourceForge — 🔴 Ali (optioneel)

Worden zwaar geïndexeerd door zoekmachines en AI. Upload de installer als mirror. Laagdrempelig, weinig onderhoud.

---

## Prioriteit (advies)

1. **awesome-privacy + degoogle PR's** (gratis, hoog rendement) — Claude zet ze klaar
2. **AlternativeTo** (15 min werk, blijvend Google-verkeer)
3. **Show HN + Reddit r/degoogle/r/privacy** (zie posts.md) — gecoördineerd op één goede dag
4. **Product Hunt** met screenshots/GIF
5. **winget** (vertrouwen + makkelijk installeren)
6. Later: Flathub, Softpedia, SourceForge
