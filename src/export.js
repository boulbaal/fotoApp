// === FASE 3: EXPORT ===

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { getDb } = require('./database');
const { keeperIds } = require('./keeper');

// Export-status (in geheugen — herstart = nieuwe status)
let exportStatus = {
  bezig: false,
  gestopt: false,
  totaal: 0,
  gedaan: 0,
  fouten: 0,
  huidigBestand: '',
  doelmap: '',
  gestart: null,
  klaar: false,
  foutLog: []
};

// ─── Hulpfuncties ────────────────────────────────────────

function maakBestandsnaam(foto) {
  const land  = saniteer(foto.gps_land  || 'onbekend');
  const stad  = saniteer(foto.gps_stad  || '');
  const datum = formatDatumBestandsnaam(foto.datum_foto);
  const ext   = (path.extname(foto.bestandsnaam) || '.jpg').toLowerCase();
  return `${land}_${stad}_${datum}${ext}`;
}

function saniteer(tekst) {
  return tekst.replace(/[^a-zA-Z0-9À-ÿ\-]/g, '').trim();
}

function formatDatumBestandsnaam(datum) {
  if (!datum) return 'onbekend';
  // datum kan zijn: "2023-07-15" of "2023-07-15T..." of "2023:07:15..."
  const match = String(datum).match(/(\d{4})[-:](\d{2})[-:](\d{2})/);
  if (!match) return 'onbekend';
  return `${match[3]}_${match[2]}_${match[1]}`; // dd_mm_yyyy
}

function uniekePad(doelmap, submap, basisnaam) {
  const volledigDir = path.join(doelmap, submap);
  fs.mkdirSync(volledigDir, { recursive: true });

  const ext  = path.extname(basisnaam);
  const base = path.basename(basisnaam, ext);

  let kandidaat = path.join(volledigDir, basisnaam);
  let teller = 2;
  while (fs.existsSync(kandidaat)) {
    kandidaat = path.join(volledigDir, `${base}_${teller}${ext}`);
    teller++;
  }
  return kandidaat;
}

function submapVanDatum(datum) {
  if (!datum) return 'onbekend';
  const match = String(datum).match(/(\d{4})[-:](\d{2})/);
  if (!match) return 'onbekend';
  return path.join(match[1], match[2]); // "2023/07"
}

function vrijevRuimte(map) {
  try {
    // df -BK geeft blokken van 1K, we willen bytes
    const uitvoer = execSync(`df -B1 "${map}" 2>/dev/null | tail -1`, { encoding: 'utf8' });
    const delen = uitvoer.trim().split(/\s+/);
    return parseInt(delen[3], 10) || 0; // kolom 4 = Available
  } catch {
    return -1; // onbekend
  }
}

// ─── GPS terugschrijven via exiftool ─────────────────────

function schrijfGpsNaarBestand(doelPad, foto) {
  if (!foto.gps_lat || !foto.gps_lon) return; // geen GPS, niets te doen

  const lat    = Math.abs(foto.gps_lat);
  const lon    = Math.abs(foto.gps_lon);
  const latRef = foto.gps_lat >= 0 ? 'N' : 'S';
  const lonRef = foto.gps_lon >= 0 ? 'E' : 'W';

  const args = [
    `-GPSLatitude=${lat}`,
    `-GPSLatitudeRef=${latRef}`,
    `-GPSLongitude=${lon}`,
    `-GPSLongitudeRef=${lonRef}`,
    '-overwrite_original'
  ];

  // Voeg stad en land toe als XMP als die beschikbaar zijn
  if (foto.gps_stad)  args.push(`-XMP:City=${foto.gps_stad}`);
  if (foto.gps_land)  args.push(`-XMP:Country=${foto.gps_land}`);

  args.push(doelPad);

  try {
    spawnSync('exiftool', args, { timeout: 10000 });
  } catch {
    // Fout bij GPS schrijven is niet fataal — bestand is al gekopieerd
  }
}

// ─── Export selectie query ────────────────────────────────

// Selecteer alles wat geëxporteerd moet worden:
//   - niet genegeerd
//   - alle niet-duplicaten
//   - PLUS precies één "keeper" per duplicaatgroep (op basis van de opgeslagen prioriteit)
//
// Voorheen filterde deze query op `is_duplicaat = 0`, waardoor ALLE leden van een
// duplicaatgroep (óók het te behouden exemplaar) uit de export vielen. Daardoor
// verdwenen foto's die maar op één plek "uniek" hoorden te zijn. Nu nemen we de
// keeper expliciet mee zodat elke groep met precies één exemplaar geëxporteerd wordt.
function selecteerFotos() {
  const db = getDb();
  const keepers = keeperIds(db);
  const fotos = db.prepare(`
    SELECT id, volledig_pad, bestandsnaam, bestandsgrootte,
           datum_foto, gps_land, gps_stad, gps_lat, gps_lon, geexporteerd, is_duplicaat
    FROM fotos
    WHERE (genegeerd = 0 OR genegeerd IS NULL)
    ORDER BY datum_foto ASC NULLS LAST
  `).all();
  db.close();
  return fotos.filter(f => !f.is_duplicaat || keepers.has(f.id));
}

// ─── Preview (vóór export) ────────────────────────────────

function berekenPreview(doelmap) {
  const fotos = selecteerFotos();
  const totaalFotos  = fotos.length;
  const totaalBytes  = fotos.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);
  const reedsDone    = fotos.filter(f => f.geexporteerd).length;
  const nogTeDoen    = totaalFotos - reedsDone;

  let ruimte = -1;
  let ruimteOk = null;
  if (doelmap) {
    // Map hoeft nog niet te bestaan — gebruik parent als dat zo is
    let checkMap = doelmap;
    while (checkMap !== path.dirname(checkMap) && !fs.existsSync(checkMap)) {
      checkMap = path.dirname(checkMap);
    }
    ruimte = vrijevRuimte(checkMap);
    ruimteOk = ruimte === -1 ? null : ruimte >= totaalBytes;
  }

  return {
    totaalFotos,
    totaalBytes,
    reedsDone,
    nogTeDoen,
    ruimte,
    ruimteOk,
    tekort: ruimteOk === false ? totaalBytes - ruimte : 0
  };
}

// ─── Export uitvoeren ─────────────────────────────────────

async function startExport(doelmap) {
  if (exportStatus.bezig) return { fout: 'Export is al bezig' };

  exportStatus = {
    bezig: true,
    gestopt: false,
    totaal: 0,
    gedaan: 0,
    fouten: 0,
    huidigBestand: '',
    doelmap,
    gestart: new Date().toISOString(),
    klaar: false,
    foutLog: []
  };

  const fotos = selecteerFotos().filter(f => !f.geexporteerd);
  exportStatus.totaal = fotos.length;

  // Draai asynchroon
  setImmediate(() => voerExportUit(fotos, doelmap));

  return { ok: true, totaal: fotos.length };
}

async function voerExportUit(fotos, doelmap) {
  const db = getDb();
  const updateStmt = db.prepare('UPDATE fotos SET geexporteerd = 1 WHERE id = ?');

  for (const foto of fotos) {
    if (exportStatus.gestopt) break;

    const basisnaam = maakBestandsnaam(foto);
    const submap    = submapVanDatum(foto.datum_foto);

    exportStatus.huidigBestand = basisnaam;

    try {
      if (!fs.existsSync(foto.volledig_pad)) {
        throw new Error('Bronbestand niet gevonden');
      }
      const doel = uniekePad(doelmap, submap, basisnaam);
      fs.copyFileSync(foto.volledig_pad, doel);
      schrijfGpsNaarBestand(doel, foto);
      updateStmt.run(foto.id);
      exportStatus.gedaan++;
    } catch (err) {
      exportStatus.fouten++;
      exportStatus.foutLog.push({ id: foto.id, bestand: foto.volledig_pad, fout: err.message });
    }
  }

  db.close();
  exportStatus.bezig  = false;
  exportStatus.klaar  = !exportStatus.gestopt;
  exportStatus.huidigBestand = '';
}

function stopExport() {
  exportStatus.gestopt = true;
  return { ok: true };
}

function getStatus() {
  return { ...exportStatus };
}

function resetExport() {
  if (exportStatus.bezig) return { fout: 'Export is bezig, stop eerst' };
  exportStatus = {
    bezig: false, gestopt: false, totaal: 0, gedaan: 0,
    fouten: 0, huidigBestand: '', doelmap: '',
    gestart: null, klaar: false, foutLog: []
  };
  return { ok: true };
}

module.exports = {
  berekenPreview,
  startExport,
  stopExport,
  getStatus,
  resetExport,
  // Geëxporteerd voor tests
  maakBestandsnaam,
  formatDatumBestandsnaam,
  submapVanDatum
};
