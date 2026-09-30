# FotoApp: herlancering met v1.0.4 (30 september 2026)

Zelfde afspraken als bij Whenly, Evenly en BuildCalc: contact alleen via GitHub issues, nergens een e-mailadres, nooit om upvotes vragen, één kanaal per dag, Claude plaatst niets en maakt geen accounts aan.

## Status

| Onderdeel | Stand |
|---|---|
| Code v1.0.4 op `main` | Klaar en getest: 350/350 unit, plus browser-E2E (32/32 stappen) en upgrade van een oude database (13/13). |
| Release v1.0.4 (installers) | **Nog niet gebouwd.** Jij start de build, zie stap 1. |
| Doneerknoppen | Gerepareerd: wezen naar `paypal.me/ABoullbahaiem` (bestaat niet). Nu `ABoulbahaiem`. In de app pas na v1.0.4; README, FUNDING.yml en website zijn al goed. |
| Website (GitHub Pages) | Doneerknoppen waren dood (GitHub Sponsors niet actief, Ko-fi zonder account). Nu één PayPal-knop. |
| Privé e-mailadres | Uit alle bestanden van de repo gehaald. Staat nog in de auteur van oudere commits (zie "Jouw acties"). |
| Tractie tot nu | v1.0.3: 31 Windows-, 8 Mac-, 13 Linux-downloads. 0 sterren. 58 views in 14 dagen. Awesome-PR's (pluja #870, awesome-windows #198, awesome-free-software #131, open-source-mac-os-apps #1160) staan nog open. |

## Wat v1.0.4 oplost (belangrijk om eerlijk te kunnen posten)

- **Beveiliging:** de lokale server luisterde op alle netwerkinterfaces. Iedereen op hetzelfde wifi kon via poort 3000 je fotobibliotheek bekijken en bestanden naar de prullenbak sturen; elke website kon de WebSocket openen. Nu alleen 127.0.0.1, plus Host- en Origin-controle.
- **XSS:** een bestand met een HTML-naam kon script uitvoeren in de app. Alle tekst uit bestandsnamen, EXIF en geocoding wordt nu ge-escaped.
- **v1.0.4 was onbruikbaar zonder deze fixes:** alleen het dashboard opende, en na een upgrade zag je een lege bibliotheek (databasebestand hernoemd). Beide opgelost.
- Engelse interface als standaard, NL/FR/DE blijven. Datums volgen de taal.

## Stap 1: release bouwen (jij, 5 minuten)

1. GitHub → repo fotoApp → **Actions** → "Build alle platformen" → **Run workflow** (branch `main`).
2. Wacht tot de 3 jobs groen zijn (±15 min). electron-builder maakt een **draft**-release `v1.0.4` met de installers.
3. **Releases** → draft v1.0.4 → plak de release notes hieronder → **Publish release** (als latest).
4. Test zelf de upgrade op je eigen pc: maak eerst een kopie van `~/.config/fotoapp/fotoapp-data/fotos.db`, installeer dan de nieuwe `.deb` of AppImage en kijk of al je foto's er nog zijn.

### Release notes (plakken)

> **FotoApp 1.0.4**
>
> **Security (please update)**
> - The built-in server now only listens on 127.0.0.1 and rejects requests from other hosts and websites. Before, devices on the same network could reach it on port 3000.
> - File names, EXIF fields and place names are now escaped everywhere in the interface.
>
> **Changes**
> - English is now the default interface language (Dutch, French and German are still available). Dates follow the chosen language.
> - Clicking a photo on the Ignored page restores it.
> - The donate buttons work again.
>
> Your existing library is migrated automatically on first start. Tip: back up your database file first (Linux: `~/.config/fotoapp/fotoapp-data/fotos.db`).

## Stap 2: herlancering (na de release, één kanaal per dag)

De eerste lancering (juni/juli) leverde weinig op. Nieuwe hoek: **"privacy-first photo organizer, now security-hardened, looking for testers on Windows and Mac"**. Eerlijk vermelden wat het netwerk op gaat: GPS-coördinaten en plaatsnamen die je zelf zoekt naar OpenStreetMap Nominatim, kaarttegels van CARTO en de kaartbibliotheek Leaflet van unpkg. Geen foto's, geen telemetrie. HN en r/privacy vragen daar gegarandeerd naar.

| Dag | Kanaal | Tekst |
|---|---|---|
| 1 | r/selfhosted: wekelijkse "New Project Megathread" (als comment, niet als eigen post) | posts.md, r/selfhosted, met de v1.0.4-regel hieronder erbij |
| 2 | r/degoogle | posts.md §degoogle |
| 4 | r/DataHoarder (lees de regels: zelfpromotie vaak alleen op bepaalde dagen) | korte versie, focus op duplicaten over meerdere schijven |
| 6 | r/privacy | posts.md §privacy, plus de eerlijke netwerkregel |
| week 2 | AlternativeTo (alternatief voor Google Photos, digiKam, Czkawka) | posts.md §AlternativeTo |
| later | Show HN | pas met een HN-account met wat geschiedenis; je huidige account mag geen Show HN plaatsen |

**Regel om toe te voegen aan elke post:**

> v1.0.4 just shipped: the local server now only listens on 127.0.0.1, and everything from file names and EXIF is escaped. The only network calls: GPS coordinates (and place searches you type) to OpenStreetMap's Nominatim for place names, map tiles from CARTO and the Leaflet library from unpkg. No photos ever leave your machine, no telemetry.

## Visuals

- Nieuwe schermafbeeldingen (Engelse interface, demodata): `docs/promote/assets/v104-dashboard.png`, `v104-photos.png`, `v104-duplicates.png`.
- Beste visual blijft je eigen "✨ Photo life"-kaart (Download als afbeelding), met echte cijfers.
- De kaart-screenshot moet je zelf maken: in de testomgeving waren de kaarttegels niet bereikbaar.

## Jouw acties (alleen jij kan dit)

1. Stap 1 hierboven (release).
2. **GitHub-token intrekken:** er staat een persoonlijk GitHub-token in platte tekst in de git-remote van `~/Claude/fotoApp` en van `~/Claude/Fabriek`. Iedereen of elk programma dat die mappen leest, kan ermee in je GitHub-account. GitHub → Settings → Developer settings → Personal access tokens → intrekken; `gh auth login` volstaat voor pushen.
3. **E-mail in commits verbergen:** GitHub → Settings → Emails → "Keep my email addresses private" en "Block command line pushes that expose my email". Oude commits van Whenly, FotoApp en BuildCalc tonen je Gmail-adres nog in de auteur; dat kan alleen weg door de geschiedenis te herschrijven (force push). Zeg het als je dat wilt.
4. Je lokale map `~/Claude/fotoApp` loopt niet meer gelijk met GitHub (de geschiedenis is ooit via de API herschreven). Ik raad aan hem opnieuw te clonen; je lokale `data/` blijft buiten git.
