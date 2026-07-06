// === PHASE 3: EXPORT ===

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { getDb } = require('./database');
const { keeperIds } = require('./keeper');

// Export status (in memory — restart = fresh status).
// Property names are the /api/export/status response contract — keep as-is.
let exportStatus = {
  running: false,
  stopped: false,
  total: 0,
  done: 0,
  errors: 0,
  currentFile: '',
  target_folder: '',
  started: null,
  ready: false,
  foutLog: []
};

// ─── Helpers ─────────────────────────────────────────────

function createFilename(foto) {
  const country = sanitize(foto.gps_country  || 'unknown');
  const city    = sanitize(foto.gps_city  || '');
  const date    = formatDateForFilename(foto.photo_date);
  const ext     = (path.extname(foto.filename) || '.jpg').toLowerCase();
  return `${country}_${city}_${date}${ext}`;
}

function sanitize(text) {
  return text.replace(/[^a-zA-Z0-9À-ÿ\-]/g, '').trim();
}

function formatDateForFilename(date) {
  if (!date) return 'unknown';
  // date can be: "2023-07-15" or "2023-07-15T..." or "2023:07:15..."
  const match = String(date).match(/(\d{4})[-:](\d{2})[-:](\d{2})/);
  if (!match) return 'unknown';
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
  if (!date) return 'unknown';
  const match = String(date).match(/(\d{4})[-:](\d{2})/);
  if (!match) return 'unknown';
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
  if (foto.gps_city)  args.push(`-XMP:City=${foto.gps_city}`);
  if (foto.gps_country)  args.push(`-XMP:Country=${foto.gps_country}`);

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
// Previously this query filtered on `is_duplicate = 0`, which dropped ALL members
// of a duplicate group (including the copy to keep) from the export. That made
// photos disappear that were supposed to be "unique" in one place. Now we include
// the keeper explicitly so every group is exported with exactly one copy.
function selectPhotos() {
  const db = getDb();
  const keepers = keeperIds(db);
  const photos = db.prepare(`
    SELECT id, full_path, filename, file_size,
           photo_date, gps_country, gps_city, gps_lat, gps_lon, exported, is_duplicate
    FROM photos
    WHERE (ignored = 0 OR ignored IS NULL)
    ORDER BY photo_date ASC NULLS LAST
  `).all();
  db.close();
  return photos.filter(f => !f.is_duplicate || keepers.has(f.id));
}

// ─── Preview (before export) ─────────────────────────────

function calculatePreview(targetFolder) {
  const photos = selectPhotos();
  const totalPhotos = photos.length;
  const totalBytes  = photos.reduce((s, f) => s + (f.file_size || 0), 0);
  const alreadyDone = photos.filter(f => f.exported).length;
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
    totalPhotos: totalPhotos,
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
  if (exportStatus.running) return { error: 'Export already running' };

  exportStatus = {
    running: true,
    stopped: false,
    total: 0,
    done: 0,
    errors: 0,
    currentFile: '',
    target_folder: targetFolder,
    started: new Date().toISOString(),
    ready: false,
    foutLog: []
  };

  const photos = selectPhotos().filter(f => !f.exported);
  exportStatus.total = photos.length;

  // Run asynchronously
  setImmediate(() => runExport(photos, targetFolder));

  return { ok: true, total: photos.length };
}

async function runExport(photos, targetFolder) {
  const db = getDb();
  const updateStmt = db.prepare('UPDATE photos SET exported = 1 WHERE id = ?');

  for (const foto of photos) {
    if (exportStatus.stopped) break;

    const baseName  = createFilename(foto);
    const subfolder = subfolderFromDate(foto.photo_date);

    exportStatus.currentFile = baseName;

    try {
      if (!fs.existsSync(foto.full_path)) {
        throw new Error('Source file not found');
      }
      const target = uniquePath(targetFolder, subfolder, baseName);
      fs.copyFileSync(foto.full_path, target);
      writeGpsToFile(target, foto);
      updateStmt.run(foto.id);
      exportStatus.done++;
    } catch (err) {
      exportStatus.errors++;
      exportStatus.foutLog.push({ id: foto.id, bestand: foto.full_path, error: err.message });
    }
  }

  db.close();
  exportStatus.running  = false;
  exportStatus.ready  = !exportStatus.stopped;
  exportStatus.currentFile = '';
}

function stopExport() {
  exportStatus.stopped = true;
  return { ok: true };
}

function getStatus() {
  return { ...exportStatus };
}

function resetExport() {
  if (exportStatus.running) return { error: 'Export is running, stop it first' };
  exportStatus = {
    running: false, stopped: false, total: 0, done: 0,
    errors: 0, currentFile: '', target_folder: '',
    started: null, ready: false, foutLog: []
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
