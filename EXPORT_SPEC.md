# Fase 3 — Export specificatie

## 1. Wat gebeurt er met elke foto?

### Concreet voorbeeld

**Situatie in de database:**

| Veld | Waarde |
|---|---|
| `volledig_pad` | `/home/one/Pictures/vakantie/PXL_20230715_093042.jpg` |
| `bestandsnaam` | `PXL_20230715_093042.jpg` |
| `bestandsgrootte` | 4.200.000 bytes (4,2 MB) |
| `is_duplicaat` | `0` (dit is het origineel) |
| `duplicaat_groep` | `a3f8c2...` (er bestaat ook een kopie op de USB) |
| `genegeerd` | `0` (status: MEENEMEN) |
| `datum_foto` | `2023-07-15` |
| `gps_stad` | `Paris` |
| `gps_land` | `France` |

**Kopie op USB (zelfde foto):**

| Veld | Waarde |
|---|---|
| `volledig_pad` | `/media/usb/backup/PXL_20230715_093042.jpg` |
| `is_duplicaat` | `1` (dit is de kopie) |
| `genegeerd` | `0` |

**Wat de export doet:**

1. Origineel (`is_duplicaat = 0`, `genegeerd = 0`) → **wordt gekopieerd** naar exportmap
2. Kopie op USB (`is_duplicaat = 1`) → **wordt overgeslagen**, altijd, automatisch
3. Het **originele bestand wordt nooit verplaatst of verwijderd** — enkel gekopieerd
4. De database wordt bijgewerkt met `geexporteerd = 1` zodat je later weet wat al gedaan is

---

### Selectieregels — welke foto's gaan mee?

```
MEENEMEN als:
  genegeerd = 0
  EN (is_duplicaat = 0 OF is_duplicaat IS NULL)

OVERGESLAGEN als:
  genegeerd = 1                    → handmatig uitgesloten door gebruiker
  OF is_duplicaat = 1              → kopie, automatisch overgeslagen
```

**Noot:** Als een foto op NEGEREN wordt gezet, worden automatisch alle duplicaten in dezelfde groep ook op NEGEREN gezet. Er kunnen dus geen situaties meer ontstaan waarbij het origineel genegeerd is maar een kopie niet.

---

## 2. Bestandsnaamconventie

### Nieuwe naam bij export

De bestanden krijgen een nieuwe naam op basis van locatie en datum:

```
locatieLand_locatieStad_dd_mm_yyyy.jpg
```

**Voorbeelden:**

| Situatie | Bestandsnaam |
|---|---|
| GPS aanwezig | `France_Paris_15_07_2023.jpg` |
| Alleen land, geen stad | `Belgium__14_03_2021.jpg` |
| Geen GPS | `onbekend__22_11_2020.jpg` |
| Geen datum | `France_Paris_onbekend.jpg` |

**Naamconflicten** (twee foto's met dezelfde naam):
- Eerste: `France_Paris_15_07_2023.jpg`
- Tweede: `France_Paris_15_07_2023_2.jpg`
- Derde: `France_Paris_15_07_2023_3.jpg`

Nooit overschrijven, altijd suffix toevoegen.

---

## 3. Doelmap en mappenstructuur

### Doelmap kiezen
De gebruiker kiest een lege map via de mapkiezer (zenity).
Aanbeveling: een nieuwe lege map op de nieuwe schijf, bv. `/media/nieuweschijf/FotoArchief/`

### Hoe worden de bestanden georganiseerd?

**Structuur: jaar / maand**

```
FotoArchief/
├── 2019/
│   ├── 01/
│   ├── 07/
│   │   └── Belgium_Gent_15_07_2019.jpg
│   └── 12/
├── 2020/
├── 2023/
│   └── 07/
│       └── France_Paris_15_07_2023.jpg   ← ons voorbeeld
└── onbekend/                              ← foto's zonder datum
```

---

## 4. Schijfruimte berekening

**Vóór de export wordt automatisch berekend:**

```
Aantal te exporteren foto's:
  SELECT COUNT(*) FROM fotos
  WHERE genegeerd = 0
  AND (is_duplicaat = 0 OR is_duplicaat IS NULL)

Totale grootte:
  SELECT SUM(bestandsgrootte) FROM fotos
  WHERE genegeerd = 0
  AND (is_duplicaat = 0 OR is_duplicaat IS NULL)

Vrije ruimte op doelschijf:
  df -BK [doelmap]  → beschikbare bytes
```

**Scherm vóór export start:**

```
┌─────────────────────────────────────────────┐
│  📦 Exportoverzicht                          │
│                                              │
│  Te exporteren:   18.432 foto's             │
│  Totale grootte:  87,4 GB                   │
│                                              │
│  Doelmap:  /media/nieuweschijf/FotoArchief  │
│  Vrije ruimte:    234 GB  ✅                │
│                                              │
│  [Annuleren]          [▶ Export starten]    │
└─────────────────────────────────────────────┘
```

Als er **niet genoeg ruimte** is:
```
  Vrije ruimte:    45 GB   ❌  (tekort: 42,4 GB)
  [Export starten] is uitgeschakeld
```

---

## 5. Tijdens de export

**Voortgangsbalk met tekstinfo:**
```
Kopiëren... 4.821 / 18.432  (26%)
████████░░░░░░░░░░░░░░░░░░░░░░
Bezig met: France_Paris_15_07_2023.jpg
```

- Kan gestopt worden (Stop-knop)
- Bij stroomuitval of stop: hervatten mogelijk (exportstatus per foto bijgehouden)
- Fouten worden gelogd maar stoppen de export niet

**Na afloop:**
```
✅ Export voltooid

  Gekopieerd:    18.432 foto's  (87,4 GB)
  Fouten:            0

  Locatie: /media/nieuweschijf/FotoArchief/
  [Map openen]  [Exportrapport bekijken]
```

---

## 6. Wat wordt NIET gekopieerd

| Wat | Reden |
|---|---|
| Duplicaten (`is_duplicaat = 1`) | Automatisch overgeslagen, altijd |
| Genegeerde foto's (`genegeerd = 1`) | Handmatig uitgesloten door gebruiker |
| Thumbnails | Worden niet meegenomen, zijn alleen voor de app |
| De database (`fotos.db`) | Hoort bij de app, niet bij het archief |

---

## 7. Samenvatting

```
Origineel bestand op schijf
        │
        │  genegeerd = 0?          JA → kopiëren naar doelmap/jaar/maand/
        │  is_duplicaat = 0?            nieuwe naam: Land_Stad_dd_mm_yyyy.jpg
        │                          NEE → overslaan
        │
        └──────────────────────────────────────────────────
                                   origineel blijft onaangeroerd
```

De export is altijd **veilig en omkeerbaar**: originelen blijven staan, er wordt alleen gekopieerd.
