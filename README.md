# 📷 FotoApp

> **Jouw foto's. Jouw computer. Jouw controle.**
> Gratis, open source, zonder cloud, zonder abonnement.

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/boulbaal/fotoApp?style=social)](https://github.com/boulbaal/fotoApp/stargazers)
[![License: Non-Commercial](https://img.shields.io/badge/license-Non--Commercial-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20Mac-lightgrey)](https://github.com/boulbaal/fotoApp/releases)

### ❤️ Vind je dit project waardevol? Steun het met een donatie.

[![Doneer via PayPal](https://img.shields.io/badge/Doneer-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate?business=aboulbahaiem%40gmail.com&currency_code=EUR&item_name=FotoApp+ondersteunen)
[![Supporter Edition](https://img.shields.io/badge/Supporter_Edition-€19_eenmalig-FF6B35?style=for-the-badge)](mailto:aboulbahaiem@gmail.com?subject=Supporter%20Edition)

*Elke donatie, hoe klein ook, helpt dit project levend te houden.*

</div>

---

## 📢 Waarom bestaat FotoApp?

Je kent het verhaal. Duizenden foto's op Google Photos. Op iCloud. Op OneDrive.
En elke maand betaal je meer om ze daar te houden — of ze worden gebruikt om AI te trainen.

**Ze zijn van jou. Maar voelen ze nog zo?**

In 2024–2025 veranderde Google Photos zijn voorwaarden opnieuw. Apple verhoogde opslagprijzen. Microsoft gebruikt je OneDrive-inhoud voor AI-training. Miljoenen mensen hangen met hun meest persoonlijke herinneringen aan systemen die ze niet controleren — en waarvan ze de echte prijs niet kennen.

FotoApp is het antwoord op die vraag: **wat als je je foto's gewoon op je eigen computer beheert?**

Geen account. Geen abonnement. Geen server van ons. Geen AI die je gezicht leert kennen.
Je foto's blijven op jouw harde schijf — en nergens anders.

---

## ✨ Wat doet FotoApp?

FotoApp helpt je in drie stappen:

### 1️⃣ Organiseren
- Scan meerdere bronnen tegelijk: je pc, externe harde schijf, USB-stick, smartphone-backup
- Detecteert automatisch dubbele foto's (ook al staan ze op verschillende schijven)
- Haalt datum, camera en GPS-locatie op uit de foto's zelf
- Toont alles op een kaart — zie meteen waar en wanneer je hebt gefotografeerd
- Werkt ook met Google Takeout exports en RAW-bestanden

### 2️⃣ Selecteren
- Bekijk al je foto's en markeer wat je wil bewaren of weggooien
- Grote hover-preview zodat je goed kunt beoordelen
- Duplicaten worden automatisch gegroepeerd — jij kiest welke je houdt

### 3️⃣ Exporteren
- Kopiëert je foto's naar een nieuwe schijf of map
- Automatische naamgeving: `Frankrijk_Parijs_15_07_2023.jpg`
- Gesorteerd op jaar en maand
- **Originelen worden nooit verwijderd** — je kunt altijd terugkeren
- GPS-data wordt teruggeschreven naar de foto's zelf

---

## 🔒 Privacy — geen compromissen

| Wat | FotoApp | Google Photos | iCloud |
|---|---|---|---|
| Draait lokaal | ✅ | ❌ | ❌ |
| Geen account nodig | ✅ | ❌ | ❌ |
| Geen abonnement | ✅ | ❌ | ❌ |
| Data blijft op jouw machine | ✅ | ❌ | ❌ |
| Open source (controleerbaar) | ✅ | ❌ | ❌ |
| Gebruikt je foto's voor AI | ❌ | ✅ | ✅ |

---

## 💻 Download & Installeren

> ⚠️ **Let op:** FotoApp vereist momenteel Node.js. Een klik-en-klaar installer voor Windows, Mac en Linux is in ontwikkeling.

```bash
# Vereisten: Node.js 18+ en Git
git clone https://github.com/boulbaal/fotoApp.git
cd fotoApp
npm install
sh start.sh
```

Ga naar **http://localhost:3000** in je browser.

---

## ❤️ Steun dit project

FotoApp is en blijft gratis. Geen betaalwal, geen premium features achter een slot.

Maar software onderhouden kost tijd. Als FotoApp jou uren werk heeft bespaard, of als je gewoon gelooft in het idee dat mensen hun eigen foto's moeten kunnen beheren zonder een techbedrijf daarvoor te betalen — dan kun je dit project steunen.

### 💳 Doneer via PayPal
Elk bedrag helpt, ook €2 of €5.

**[➡️ Doneer via PayPal](https://www.paypal.com/donate?business=aboulbahaiem%40gmail.com&currency_code=EUR&item_name=FotoApp+ondersteunen)**

Of stuur rechtstreeks naar: `aboulbahaiem@gmail.com` via PayPal.

### 🌟 Supporter Edition — €19 eenmalig
Wil je iets meer doen? Stuur een mail naar [aboulbahaiem@gmail.com](mailto:aboulbahaiem@gmail.com?subject=Supporter%20Edition) en word vermeld als officiële supporter in de app en in de credits. Exact dezelfde software — maar met de warme wetenschap dat je dit project mee mogelijk maakt.

### ⭐ Gratis steunen
- Geef een **ster op GitHub** — dat helpt anderen het project vinden
- Deel FotoApp met iemand die het nodig heeft
- Meld bugs of stel verbeteringen voor via [GitHub Issues](https://github.com/boulbaal/fotoApp/issues)

---

## 🤝 Bijdragen aan de code

FotoApp is open source en verwelkomt bijdragen. Of je nu een developer bent die een feature wil toevoegen, of iemand die een vertaling wil maken — alles helpt.

Lees [CONTRIBUTING.md](CONTRIBUTING.md) voor hoe je kunt bijdragen.

---

## 📋 Licentie

FotoApp is **gratis voor persoonlijk gebruik en non-profitorganisaties**.
Commercieel gebruik door bedrijven is niet toegestaan zonder toestemming.

Zie [LICENSE](LICENSE) voor de volledige voorwaarden.

Commerciële licentie nodig? Mail naar [aboulbahaiem@gmail.com](mailto:aboulbahaiem@gmail.com).

---

## 🏗️ Technologie

| Component | Technologie |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (lokaal, geen server) |
| Frontend | Vanilla JavaScript |
| Kaarten | Leaflet + OpenStreetMap |
| Geocoding | Nominatim (privacy-first, geen API key) |
| EXIF | exifr + exiftool |
| Thumbnails | sharp |

---

<div align="center">

**Gemaakt door [Ali Boulbahaiem](mailto:aboulbahaiem@gmail.com)**
*Van de mens, voor de mens.*

[![Doneer via PayPal](https://img.shields.io/badge/Doneer-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate?business=aboulbahaiem%40gmail.com&currency_code=EUR&item_name=FotoApp+ondersteunen)

</div>
