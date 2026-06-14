# FotoApp — Promotieplan

> Doel: veel gebruikers, en daardoor (kleine) donaties. Volgorde is bewust: **eerst adoptie, dan donaties.** Donaties volgen pas bij voldoende actieve gebruikers, en dan nog in kleine bedragen. Wie nu vol op de donatieknop inzet, optimaliseert het verkeerde.

## De strategie in één alinea

De grootste rem op gebruik is **vertrouwen + installatiegemak**, niet zichtbaarheid van een donatieknop. We verlagen die drempel (kant-en-klare Mac/Linux-builds, duidelijke install-uitleg, later code signing), zorgen dat de app vindbaar is op de plekken waar de doelgroep zoekt (awesome-lijsten, AlternativeTo, winget), doen één gecoördineerde launch-push (Show HN + Reddit), en maken doneren laagdrempelig met een eerlijk verhaal.

---

## Wat al klaar is (deze sessie)

- **FUNDING.yml** — PayPal als `custom`-link, zodat de **Sponsor-knop** bovenaan de repo direct werkt zonder nieuw account. Ko-fi/BMC staan klaar als optionele placeholders.
- **README** — Mac- en Linux-downloads toegevoegd (niet langer "zelf bouwen"), plus een eerlijke **❤️ Steun-sectie** met framing ("bespaarde het je een cloud-abonnement?").
- **Launch-teksten** (`posts.md`, `launch-posts.md`) — "Windows/Mac coming soon" verwijderd; nu cross-platform. Nieuwe **r/degoogle** en **r/privacy** posts + Show HN timing-tip.
- **Distributie-checklist** (`distributie-checklist.md`) — copy-paste entries voor awesome-lijsten, AlternativeTo, Product Hunt, winget, Flathub.
- **winget-manifest** templates (`winget/`).
- **Code-signing beslisdoc** (`code-signing-beslissing.md`) — gratis vs betaalde vertrouwenspaden.

---

## ✅ Actielijst voor Ali (alleen jij kunt dit)

**Beslissingen:**
1. **Code signing?** Wil je $9,99/mnd uitgeven aan Azure Artifact Signing voor Windows? (Aanrader: pas zodra er honderden downloads zijn.) Zie `code-signing-beslissing.md`.
2. **Ko-fi / Buy Me a Coffee aanmaken?** Laagdrempeliger dan PayPal. Maak account → geef mij de gebruikersnaam → ik zet 'm in FUNDING.yml + app.

**Accounts / indienen (15 min elk):**
3. **AlternativeTo** — FotoApp aanmelden als alternatief voor Google Photos e.d. (tekst staat klaar).
4. **GitHub Sponsors** activeren op https://github.com/sponsors (optioneel, voor de knop).
5. **awesome-privacy + degoogle PR's** — of laat mij ze via de GitHub-API voor je klaarzetten.

**Launch-dag (kies één goede dag, doordeweeks):**
6. **Show HN** posten ~09:00 NL, daarna 2–3 uur actief reageren.
7. Same day of gespreid: **Reddit** r/degoogle, r/privacy, r/selfhosted (eigen tekst per sub, niet copy-paste-spam).
8. **Product Hunt** met 3–5 screenshots + korte demo-GIF (GPS-kaart + duplicaten).

---

## Realistische verwachting

Donatie-conversie bij gratis FOSS ligt rond **0,1–1% van actieve gebruikers**, in kleine bedragen. Bij 1.000 actieve gebruikers: misschien een handvol koffies per maand. De échte winst is dat de app gebruikt en gewaardeerd wordt; geld is een bonus, geen doel. Houd de verwachtingen laag en het plezier hoog.

## Volgende kansen (later)

- Korte demo-GIF/video voor README, Product Hunt en Reddit (verhoogt conversie sterk).
- YouTubers in de self-host/privacy-niche benaderen (TechHut, DB Tech, Wolfgang's Channel).
- Flathub-publicatie (auto-updates + groot Linux-bereik).
- In-app handleiding (staat al op de CLAUDE.md TODO).
