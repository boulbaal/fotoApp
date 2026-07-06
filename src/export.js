// === PHASE 3: EXPORT ===

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { getDb } = require('./database');
const { keeperIds } = require('./keeper');

// Export status (in memory — restart = fresh status).
// Property names are the /api/export/status response contract — keep as-is.
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

// ─── Helpers ─────────────────────────────────────────────

function createFilename(foto) {
  const country = sanitize(foto.gps_land  || 'onbekend');
  const city    = sanitize(foto.gps_stad  || '');
  const date    = formatDateForFilename(foto.datum_foto);
  const ext     = (path.extname(foto.bestandsnaam) || '.jpg').toLowerCase();
  return `${country}_${city}_${date}${ext}`;
}

function sanitize(text) {
  return text.replace(/[^a-zA-Z0-9À-ÿ\-]/g, '').trim();
}

function formatDateForFilename(date) {
  if (!date) return 'onbekend';
  // date can be: "2023-07-15" or "2023-07-15T..." or "2023:07:15..."
  const match = String(date).match(/(\d{4})[-:](\d{2})[-:](\d{2})/);
  if (!match) return 'onbekend';
  return `${match[3]}_${match[2]}_${match[1]}`; // dd_mm_yyyy
}

function uniquePath(targetFolder, subfolder, baseName) {
  const fullDir = path.join(targetFolder, subfolder);
  fs.mkdirSync(fullDir, { recursive: true });

  const ext  = path.extname(baseName);
  const base = path.basename(baseName, ext);

  let candidate = path.join(fullDir, baseName);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(fullDir, `${base}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}

function subfolderFromDate(date) {
  if (!date) return 'onbekend';
  const match = String(date).match(/(\d{4})[-:](\d{2})/);
  if (!match) return 'onbekend';
  return path.join(match[1], match[2]); // "2023/07"
}

function freeSpace(folder) {
  try {
    // df -B1 reports in bytes
    const output = execSync(`df -B1 "${folder}" 2>/dev/null | tail -1`, { encoding: 'utf8' });
    const parts = output.trim().split(/\s+/);
    return parseInt(parts[3], 10) || 0; // column 4 = Available
  } catch {
    return -1; // unknown
  }
}

// ─── Write GPS back via exiftool ─────────────────────────

function writeGpsToFile(targetPath, foto) {
  if (!foto.gps_lat || !foto.gps_lon) return; // no GPS, nothing to do

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

  // Add city and country as XMP if available
  if (foto.gps_stad)  args.push(`-XMP:City=${foto.gps_stad}`);
  if (foto.gps_land)  args.push(`-XMP:Country=${foto.gps_land}`);

  args.push(targetPath);

  try {
    spawnSync('exiftool', args, { timeout: 10000 });
  } catch {
    // Failing to write GPS is not fatal — the file has already been copied
  }
}

// ─── Export selection query ──────────────────────────────

// Select everything that must be exported:
//   - not ignored
//   - all non-duplicates
//   - PLUS exactly one "keeper" per duplicate group (based on the stored priority)
//
// Previously this query filtered on `is_duplicaat = 0`, which dropped ALL members
// of a duplicate group (including the copy to keep) from the export. That made
// photos disappear that were supposed to be "unique" in one place. Now we include
// the keeper explicitly so every group is exported with exactly one copy.
function selectPhotos() {
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

// ─── Preview (before export) ─────────────────────────────

function calculatePreview(targetFolder) {
  const fotos = selectPhotos();
  const totalPhotos = fotos.length;
  const totalBytes  = fotos.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);
  const alreadyDone = fotos.filter(f => f.geexporteerd).length;
  const stillToDo   = totalPhotos - alreadyDone;

  let space = -1;
  let spaceOk = null;
  if (targetFolder) {
    // Folder may not exist yet — walk up to an existing parent
    let checkFolder = targetFolder;
    while (checkFolder !== path.dirname(checkFolder) && !fs.existsSync(checkFolder)) {
      checkFolder = path.dirname(checkFolder);
    }
    space = freeSpace(checkFolder);
    spaceOk = space === -1 ? null : space >= totalBytes;
  }

  // Response field names are the frontend contract — keep as-is.
  return {
    totaalFotos: totalPhotos,
    totaalBytes: totalBytes,
    reedsDone: alreadyDone,
    nogTeDoen: stillToDo,
    ruimte: space,
    ruimteOk: spaceOk,
    tekort: spaceOk === false ? totalBytes - space : 0
  };
}

// ─── Run the export ──────────────────────────────────────

async function startExport(targetFolder) {
  if (exportStatus.bezig) return { fout: 'Export already running' };

  exportStatus = {
    bezig: true,
    gestopt: false,
    totaal: 0,
    gedaan: 0,
    fouten: 0,
    huidigBestand: '',
    doelmap: targetFolder,
    gestart: new Date().toISOString(),
    klaar: false,
    foutLog: []
  };

  const fotos = selectPhotos().filter(f => !f.geexporteerd);
  exportStatus.totaal = fotos.length;

  // Run asynchronously
  setImmediate(() => runExport(fotos, targetFolder));

  return { ok: true, totaal: fotos.length };
}

async function runExport(fotos, targetFolder) {
  const db = getDb();
  const updateStmt = db.prepare('UPDATE fotos SET geexporteerd = 1 WHERE id = ?');

  for (const foto of fotos) {
    if (exportStatus.gestopt) break;

    const baseName  = createFilename(foto);
    const subfolder = subfolderFromDate(foto.datum_foto);

    exportStatus.huidigBestand = baseName;

    try {
      if (!fs.existsSync(foto.volledig_pad)) {
        throw new Error('Source file not found');
      }
      const target = uniquePath(targetFolder, subfolder, baseName);
      fs.copyFileSync(foto.volledig_pad, target);
      writeGpsToFile(target, foto);
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
  if (exportStatus.bezig) return { fout: 'Export is running, stop it first' };
  exportStatus = {
    bezig: false, gestopt: false, totaal: 0, gedaan: 0,
    fouten: 0, huidigBestand: '', doelmap: '',
    gestart: null, klaar: false, foutLog: []
  };
  return { ok: true };
}

module.exports = {
  calculatePreview,
  startExport,
  stopExport,
  getStatus,
  resetExport,
  // Exported for tests
  createFilename,
  formatDateForFilename,
  subfolderFromDate
};
