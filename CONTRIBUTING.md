# Bijdragen aan FotoApp / Contributing to FotoApp

Dank je voor je interesse in FotoApp! Bijdragen zijn welkom, maar alle wijzigingen worden **persoonlijk beoordeeld en goedgekeurd door de beheerder (Ali)** voordat ze worden samengevoegd.

*Thank you for your interest in FotoApp! Contributions are welcome, but all changes are **personally reviewed and approved by the maintainer (Ali)** before being merged.*

---

## 🇳🇱 Nederlands

### Hoe bijdragen?

1. **Fork** de repository
2. **Maak een branch** aan voor je wijziging: `git checkout -b feat/mijn-functie`
3. **Schrijf tests** voor je code (verplicht — zie de testregel in `CLAUDE.md`)
4. **Controleer** dat alle tests slagen: `node tests/run-tests.js`
5. **Commit** met een duidelijke boodschap: `feat: beschrijving van de wijziging`
6. **Open een Pull Request** met een goede beschrijving van wat je hebt gedaan en waarom

### Spelregels

- **Geen directe commits op `main`** — altijd via een Pull Request
- **Tests zijn verplicht** — nieuwe code zonder tests wordt niet goedgekeurd
- **Respecteer de architectuur** — lees `CLAUDE.md` voor de projectfilosofie
- **Privacy first** — geen externe API's met privédata, geen cloud-afhankelijkheden
- **Scope** — bespreek grote nieuwe functies eerst via een Issue voordat je begint

### Wat is welkom?

- 🐛 Bugfixes
- 📖 Documentatieverbeteringen
- 🌍 Vertalingen
- ⚡ Prestatieverbeteringen
- 🧪 Extra tests
- 💡 Nieuwe functies (na overleg via een Issue)

### Wat wordt niet geaccepteerd?

- Cloud-integraties of externe diensten met privédata
- Verwijdering van bestaande foto's van schijf
- Betaalde of premium functies
- Wijzigingen die bestaande tests breken

---

## 🇬🇧 English

### How to contribute?

1. **Fork** the repository
2. **Create a branch** for your change: `git checkout -b feat/my-feature`
3. **Write tests** for your code (mandatory — see the test rule in `CLAUDE.md`)
4. **Verify** all tests pass: `node tests/run-tests.js`
5. **Commit** with a clear message: `feat: description of change`
6. **Open a Pull Request** with a clear description of what you did and why

### Rules

- **No direct commits to `main`** — always via a Pull Request
- **Tests are mandatory** — new code without tests will not be approved
- **Respect the architecture** — read `CLAUDE.md` for the project philosophy
- **Privacy first** — no external APIs with private data, no cloud dependencies
- **Scope** — discuss large new features first via an Issue before starting

### What is welcome?

- 🐛 Bug fixes
- 📖 Documentation improvements
- 🌍 Translations
- ⚡ Performance improvements
- 🧪 Additional tests
- 💡 New features (after discussion via an Issue)

### What will not be accepted?

- Cloud integrations or external services with private data
- Permanent deletion of photos from disk
- Paid or premium features
- Changes that break existing tests

---

## 📬 Contact

Questions? Open an [Issue](https://github.com/boulbaal/fotoApp/issues) or contact Ali via [aboulbahaiem@gmail.com](mailto:aboulbahaiem@gmail.com).

> **Note:** All pull requests require explicit approval from Ali before merging. This is not automatic — please be patient.
