# Code-signing & vertrouwen — beslisdocument

**Het probleem:** de huidige downloads zijn niet ondertekend. Windows toont "Windows heeft je pc beschermd" (SmartScreen) en Mac toont "kan niet worden geopend, onbekende ontwikkelaar". Voor een privacy-app is dat juist de groep die het meest afhaakt. Dit is de #1 adoptiedrempel.

Er zijn drie niveaus, van gratis tot betaald. Je hoeft niet alles te doen — kies bewust.

---

## Niveau 0 — Gratis: drempel verzachten zonder te tekenen

Geen kosten, doe dit sowieso:

- **Duidelijke install-uitleg** in README en op de website ("Bij SmartScreen: Meer informatie → Toch uitvoeren"). ✅ staat al in de README.
- **Via winget publiceren** (zie distributie-checklist). Microsoft indexeert het pakket; voor gebruikers voelt `winget install` betrouwbaarder dan een losse .exe.
- **Op Mac**: rechtsklik → Openen omzeilt de melding. ✅ staat in de README.
- **VirusTotal-scan** van de installer als badge/screenshot tonen ("0/70 detecties") wekt vertrouwen.

Beperking: de SmartScreen-waarschuwing blijft. Het verzacht, het lost het niet op.

---

## Niveau 1 — Windows tekenen: Azure Artifact Signing (aanrader)

Sinds 2026 heet "Trusted Signing" nu **Azure Artifact Signing**. Dit is veruit de goedkoopste legitieme route:

- **Kosten: $9,99/maand** (tot 5.000 handtekeningen, 1 certificaatprofiel).
- **Geschiktheid:** open voor EU-bedrijven én **zelfstandigen/zzp** — geen 3 jaar bedrijfshistorie meer vereist. Nederland valt hieronder.
- **Effect:** SmartScreen-reputatie bouwt snel op; de "onbekende uitgever"-waarschuwing verdwijnt na verloop van tijd.
- **Integratie:** werkt direct met GitHub Actions, dus je `build-all.yml` kan automatisch tekenen.

Traditioneel alternatief (klassieke CA's zoals Sectigo/DigiCert): **OV ~$200–400/jaar**, EV duurder. Azure is goedkoper en eenvoudiger; alleen overwegen als Azure-onboarding niet lukt.

**Beslissing voor jou:** $9,99/mnd uitgeven? Bij een gratis hobby-project is dat de enige terugkerende kost die ik zou aanraden zodra er echte gebruikers/downloads zijn. Tot die tijd kan Niveau 0 volstaan.

---

## Niveau 2 — Mac tekenen + notariseren: Apple Developer Program

- **Kosten: $99/jaar.**
- Nodig om de "onbekende ontwikkelaar"-melding op macOS volledig weg te halen (signing + notarization).
- Zonder dit blijft de rechtsklik→Openen-workaround nodig (werkt, maar drempel).

**Beslissing voor jou:** alleen doen als je merkt dat een serieus deel van je gebruikers op Mac zit. Begin zonder; de README-workaround dekt het af.

---

## Aanbevolen volgorde

1. **Nu (gratis):** Niveau 0 — install-uitleg ✅, winget, VirusTotal-badge.
2. **Bij ~honderden downloads:** Azure Artifact Signing voor Windows ($9,99/mnd).
3. **Als Mac-aandeel groeit:** Apple Developer ($99/jr).

Kort samengevat: niet meteen geld uitgeven. Eerst adoptie aantonen met de gratis verzachters; tekenen zodra het volume het rechtvaardigt. De $9,99/mnd Windows-route is dan de meest kosteneffectieve eerste investering.

---

## Bronnen
- Azure Artifact Signing (voorheen Trusted Signing) — prijs & geschiktheid: https://azure.microsoft.com/en-us/pricing/details/artifact-signing/
- Trusted Signing open voor individuele ontwikkelaars: https://techcommunity.microsoft.com/blog/microsoft-security-blog/trusted-signing-is-now-open-for-individual-developers-to-sign-up-in-public-previ/4273554
- Achtergrond code signing met Azure: https://melatonin.dev/blog/code-signing-on-windows-with-azure-trusted-signing/
