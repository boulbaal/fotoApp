const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync, execFile } = require('child_process');
const sharp = require('sharp');
const exifr = require('exifr');
const { getDb } = require('./database');

// ── Memory management ────────────────────────────────────────────────────────
// During a heavy scan (especially with an empty database) EVERY photo gets
// decoded. libvips (the engine under sharp) uses one thread per CPU core by
// default plus an operation cache of ~50 MB. Large RAW/HEIC photos decode into
// a raw pixel buffer (a 50MP photo ≈ 150 MB uncompressed). With all cores at
// once, memory climbed so high that Ubuntu performed an OOM kill.
// Therefore: no pixel cache and at most 2 concurrent libvips threads.
sharp.cache(false);
sharp.concurrency(2);

// Default options for EVERY sharp call. A libvips worker can die with a hard
// native crash (SIGTRAP / int3 trap) when it tries to decode a corrupt or
// absurdly large image — that crash takes down the WHOLE app and cannot be
// caught with try/catch. Therefore:
//   • failOn:'none'      → tolerate truncated/damaged files instead of aborting
//   • limitInputPixels   → reject absurd dimensions (broken header claiming
//                          billions of pixels) as a clean JS error instead of an alloc abort
const SHARP_OPTS = { failOn: 'none', limitInputPixels: 300000000 }; // ~300 MP ceiling

// Async subprocess helper. spawnSync blocked the ENTIRE Node event loop while
// exiftool/ffmpeg ran — 0.1–8s per video. During the background passes
// (e.g. checking 900+ videos for GPS) the loop kept stalling and no HTTP
// request (thumbnails, pages) could be served → Electron showed
// "fotoapp is not responding". execFile runs asynchronously: the loop stays free
// so the UI keeps loading smoothly while the pass works quietly in the background.
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, {
      encoding: opts.encoding,                 // undefined = 'utf8' (string), 'buffer' = Buffer
      timeout: opts.timeout || 8000,
      maxBuffer: opts.maxBuffer || 10 * 1024 * 1024
    }, (err, stdout, stderr) => {
      resolve({ status: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr });
    });
  });
}

const PHOTO_EXTENSIONS = new Set([
  // JPEG variants
  '.jpg', '.jpeg', '.jpe', '.jfif', '.jif',
  // PNG, GIF, BMP, WebP, TIFF
  '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif',
  // Modern
  '.avif', '.heic', '.heif',
  // JPEG 2000
  '.jp2', '.j2k', '.jpx', '.jpf',
  // RAW — Canon
  '.cr2', '.cr3', '.crw',
  // RAW — Nikon
  '.nef', '.nrw',
  // RAW — Sony
  '.arw', '.srf', '.sr2',
  // RAW — Adobe / universal
  '.dng', '.raw',
  // RAW — Olympus
  '.orf',
  // RAW — Panasonic / Leica
  '.rw2', '.rwl',
  // RAW — Pentax
  '.pef', '.ptx',
  // RAW — Samsung
  '.srw',
  // RAW — Fujifilm
  '.raf',
  // RAW — Sigma
  '.x3f',
  // RAW — Hasselblad
  '.3fr', '.fff',
  // RAW — Minolta / Konica
  '.mrw', '.mdc',
  // RAW — Kodak
  '.kdc', '.k25', '.dcs', '.dcr',
  // RAW — Epson
  '.erf',
  // RAW — Mamiya / Phase One
  '.mef', '.iiq', '.cap',
  // RAW — Casio
  '.bay',
  // RAW — Leaf
  '.mos',
  // Other
  '.svg', '.ico', '.psd', '.psb',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mov', '.qt',
  '.avi', '.wmv', '.flv',
  '.mkv', '.webm',
  '.3gp', '.3g2',
  '.mts', '.m2ts',
  '.mpg', '.mpeg', '.m2v',
  '.ogv', '.ogg',
]);

// Folders we skip (no real photos)
const SKIP_FOLDERS = [
  '.cache', '.thumbnails', 'thumbnails',
  'node_modules', '.git', '.local/share/ov',
  'omni.physx', 'omni.blockworld', 'textures'
];

let scanStopRequested = false;
// Separate stop flag for the geocode pass: stopping a scan and stopping the
// (long-running) geocode background pass are decoupled.
let geocodeStopRequested = false;
let queue = [];

// Property names of the status objects below are the /api/scan/status
// response contract (read by the frontend) — keep them as-is until phase B.
let scanStatus = {
  bezig: false,
  bron_id: null,
  totaal: 0,
  verwerkt: 0,
  nieuw: 0,
  overgeslagen: 0,
  fouten: 0,
  huidig_bestand: '',
  gestart: null,
  log_id: null,
  wachtrij: []
};

// Geocoding pass — runs in the background after every scan
let geocodeStatus = {
  bezig: false,
  totaal: 0,
  gedaan: 0,
  huidig_land: ''
};

function getScanStatus() {
  return { ...scanStatus, wachtrij: [...queue], geocode: { ...geocodeStatus } };
}

function getGeocodeStatus() {
  return { ...geocodeStatus };
}

// Shares GPS data (city/country/code) from one copy to all others in the same duplicate group
function propagateGpsInGroups() {
  const db = getDb();
  try {
  const groups = db.prepare(`
    SELECT duplicaat_groep,
           MAX(gps_lat) as lat, MAX(gps_lon) as lon,
           MAX(gps_stad) as stad, MAX(gps_land) as land,
           MAX(gps_land_code) as land_code, MAX(gps_adres) as adres
    FROM fotos
    WHERE duplicaat_groep IS NOT NULL
      AND gps_lat IS NOT NULL
      AND gps_land IS NOT NULL AND gps_land != ''
    GROUP BY duplicaat_groep
  `).all();

  const propagateStmt = db.prepare(`
    UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?,
                     gps_land_code = ?, gps_adres = ?
    WHERE duplicaat_groep = ?
      AND (gps_land IS NULL OR gps_land = '')
  `);
  let updated = 0;
  for (const g of groups) {
    const info = propagateStmt.run(g.lat, g.lon, g.stad, g.land, g.land_code, g.adres, g.duplicaat_groep);
    updated += info.changes;
  }
  if (updated > 0) console.log(`🔗 GPS shared in ${groups.length} duplicate groups: ${updated} photos updated`);
  return updated;
  } finally {
    db.close();
  }
}

// Start geocoding pass in the background — fills in gps_land/city for all photos missing it
async function startGeocodePass() {
  if (geocodeStatus.bezig) return; // already running
  geocodeStopRequested = false; // fresh start — own flag, separate from scanStopRequested
  geocodeStatus.bezig = true;
  geocodeStatus.gedaan = 0;
  geocodeStatus.huidig_land = '';

  const db = getDb();

  // All unique locations without gps_land (rounded to 3 decimals)
  const locations = db.prepare(`
    SELECT ROUND(gps_lat, 3) as lat, ROUND(gps_lon, 3) as lon, COUNT(*) as n
    FROM fotos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      AND (gps_land IS NULL OR gps_land = '')
    GROUP BY ROUND(gps_lat, 3), ROUND(gps_lon, 3)
    ORDER BY n DESC
  `).all();

  geocodeStatus.totaal = locations.length;
  db.close();

  if (locations.length === 0) {
    // No new locations to geocode, but do share GPS within duplicate groups
    propagateGpsInGroups();
    geocodeStatus.bezig = false;
    return;
  }

  console.log(`🌍 Geocode pass started: ${locations.length} unique locations to process`);

  const updateLocation = (address, lat, lon) => {
    if (!address || !address.gps_land) return;
    const db2 = getDb();
    try {
      db2.prepare(`
        UPDATE fotos SET gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
        WHERE ROUND(gps_lat, 3) = ? AND ROUND(gps_lon, 3) = ?
          AND (gps_land IS NULL OR gps_land = '')
      `).run(address.gps_stad || null, address.gps_land, address.gps_land_code || null, address.gps_adres || null, lat, lon);
    } finally {
      db2.close();
    }
  };

  for (const loc of locations) {
    if (geocodeStopRequested) break; // Own geocode stop flag (not the scan flag)
    const address = await fetchGpsAddress(loc.lat, loc.lon);
    geocodeStatus.gedaan++;
    geocodeStatus.huidig_land = address?.gps_land || '';
    updateLocation(address, loc.lat, loc.lon);
    console.log(`🌍 Geocode ${geocodeStatus.gedaan}/${geocodeStatus.totaal}: ${address?.gps_land || 'no result'}`);
  }

  // Share GPS data within duplicate groups (originals without a country now also get the copy's country)
  propagateGpsInGroups();

  geocodeStatus.bezig = false;
  geocodeStatus.huidig_land = '';
  console.log(`✅ Geocode pass done: ${geocodeStatus.gedaan} locations processed`);
}

async function addToQueue(bronId, options = {}) {
  const db = getDb();
  const source = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(bronId);
  db.close();
  if (!source) throw new Error('Bron niet gevonden');

  // Not twice in the queue
  if (queue.find(w => w.id === bronId)) {
    throw new Error('Bron staat al in de wachtrij');
  }
  // Not if already running
  if (scanStatus.bezig && scanStatus.bron_id === bronId) {
    throw new Error('Bron is al aan het scannen');
  }

  // Hidden folders: explicit option wins, otherwise the per-source setting.
  const includeHidden = options.includeHidden !== undefined
    ? !!options.includeHidden
    : !!source.verborgen_meenemen;

  queue.push({ id: bronId, naam: source.naam, pad: source.pad, options: { includeHidden } });
  console.log(`📋 Queue: ${queue.map(w => w.naam).join(' → ')}`);

  // Start processing if nothing is running
  if (!scanStatus.bezig) processQueue();

  return getScanStatus();
}

async function processQueue() {
  if (scanStatus.bezig || queue.length === 0) return;

  const next = queue.shift();
  console.log(`▶ Next in queue: ${next.naam}`);
  await _startScan(next.id, next.options || {});
}

function removeFromQueue(bronId) {
  queue = queue.filter(w => w.id !== bronId);
}

function shouldSkip(folderPath) {
  const lowered = folderPath.toLowerCase();
  return SKIP_FOLDERS.some(skip => lowered.includes(skip));
}

async function findAllPhotos(startPath, options = {}) {
  // Hidden folders (name starts with '.') are skipped by default — they mostly
  // contain app/system files (icons, caches, .git), not photos.
  // With includeHidden=true they are scanned anyway.
  const includeHidden = !!options.includeHidden;
  const fotos = [];

  // The inventory used to run fully synchronously (readdirSync) and thereby
  // blocked the Electron main process for its entire duration — with large
  // folders that triggered a "not responding" message. Now we read folders
  // asynchronously and give the event loop some air every few folders
  // (setImmediate), so the window stays responsive while inventorying.
  let foldersSinceYield = 0;

  async function search(dirPath) {
    if (scanStopRequested) return; // ← also stop during inventory
    if (shouldSkip(dirPath)) return;

    // Breather for the event loop every 20 folders → UI stays smooth.
    if (++foldersSinceYield % 20 === 0) {
      await new Promise(r => setImmediate(r));
    }

    let items;
    try {
      items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      return; // folder not readable, skip
    }
    for (const item of items) {
      if (scanStopRequested) return;
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        if (!includeHidden && item.name.startsWith('.')) continue; // skip hidden folder
        await search(fullPath);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (PHOTO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
          fotos.push(fullPath);
        }
      }
    }
  }

  await search(startPath);
  return fotos;
}

// Extract date from filename — e.g. IMG-20250728-WA0010.jpg → 2025-07-28
function parseDateFromFilename(name) {
  // Look for pattern: 4-digit year + optional separator + 2 month + 2 day
  const match = name.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  // Validate as a real date
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00.000Z`;
}

function computeHash(filePath) {
  let fd;
  try {
    const stat = fs.statSync(filePath);
    // 0-byte files get NO hash: otherwise they would all share the same
    // empty-MD5 and wrongly count as duplicates of each other.
    // detectDuplicates ignores hash IS NULL, so null = "does not participate".
    if (!stat.size) return null;

    const hash = crypto.createHash('md5');
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1024 * 1024); // 1 MB chunks — streams without the whole file in memory
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead));
    }
    return hash.digest('hex');
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

async function readVideoDuration(filePath) {
  try {
    const result = await runCmd('exiftool', ['-Duration#', '-b', filePath], {
      encoding: 'utf8', timeout: 5000
    });
    const duration = parseFloat(result.stdout);
    return isNaN(duration) ? null : Math.round(duration);
  } catch (_) { return null; }
}

// Read GPS from video via exiftool — exifr does not support MP4/MOV GPS well
// Works for iPhone MOV, some Android MP4, GoPro, etc.
async function readGpsFromVideo(filePath) {
  try {
    const result = await runCmd('exiftool', [
      '-GPSLatitude#', '-GPSLongitude#',
      '-Keys:GPSCoordinates',
      '-n', '-j',
      filePath
    ], { encoding: 'utf8', timeout: 8000 });

    if (result.status !== 0 || !result.stdout) return { gps_lat: null, gps_lon: null };

    const data = JSON.parse(result.stdout)[0] || {};

    // Keys:GPSCoordinates format: "+35.6927+139.7010+0.000/" or "+lat+lon+alt/"
    if (data['Keys:GPSCoordinates']) {
      const match = data['Keys:GPSCoordinates'].match(/([+-]\d+\.?\d*)\s*([+-]\d+\.?\d*)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) return { gps_lat: lat, gps_lon: lon };
      }
    }

    // Standard EXIF GPS tags (also present in some MP4)
    const lat = parseFloat(data['GPSLatitude']);
    const lon = parseFloat(data['GPSLongitude']);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) {
      return { gps_lat: lat, gps_lon: lon };
    }

    return { gps_lat: null, gps_lon: null };
  } catch (_) {
    return { gps_lat: null, gps_lon: null };
  }
}

async function createVideoThumbnail(filePath) {
  // Compute seek position: 30% of the duration, min 2s, max 60s
  // -ss BEFORE -i = keyframe seeking = no overhead regardless of how far we jump
  let seekSec = 3; // default fallback
  const duration = await readVideoDuration(filePath);
  if (duration && duration > 4) {
    seekSec = Math.min(Math.round(duration * 0.3), 60);
  }

  try {
    const tmpPath = `/tmp/fotoapp_thumb_${Date.now()}.jpg`;
    const result = await runCmd('ffmpeg', [
      '-ss', String(seekSec),   // before -i: fast keyframe seek
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '5',
      '-y', tmpPath
    ], { encoding: 'buffer', timeout: 15000 });

    if (result.status === 0 && fs.existsSync(tmpPath)) {
      const buffer = await sharp(tmpPath, SHARP_OPTS)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
      fs.unlinkSync(tmpPath);
      return 'data:image/jpeg;base64,' + buffer.toString('base64');
    }
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch (_) {}

  // Fallback: exiftool embedded thumbnail
  for (const tag of ['-ThumbnailImage', '-PreviewImage', '-OtherImage', '-CoverArt']) {
    try {
      const result = await runCmd('exiftool', [tag, '-b', filePath], {
        encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 8000
      });
      if (result.stdout && result.stdout.length > 500) {
        const buffer = await sharp(result.stdout, SHARP_OPTS)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        return 'data:image/jpeg;base64,' + buffer.toString('base64');
      }
    } catch (_) {}
  }

  return null;
}

async function createThumbnail(filePath) {
  // Video: separate path
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) {
    return createVideoThumbnail(filePath);
  }

  // Step 1: try sharp (works for jpg/png/webp/heic/tiff/...)
  try {
    const buffer = await sharp(filePath, SHARP_OPTS)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return 'data:image/jpeg;base64,' + buffer.toString('base64');
  } catch (_) {}

  // Step 2: extract embedded JPEG preview from RAW via exiftool
  // RAW files always contain a camera-generated preview
  for (const tag of ['PreviewImage', 'JpgFromRaw', 'ThumbnailImage']) {
    try {
      const result = await runCmd('exiftool', ['-' + tag, '-b', filePath], {
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000,
      });
      const previewBuffer = result.stdout;
      if (previewBuffer && previewBuffer.length > 1000) {
        const resized = await sharp(previewBuffer, SHARP_OPTS)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        return 'data:image/jpeg;base64,' + resized.toString('base64');
      }
    } catch (_) {}
  }

  return null;
}

function readGoogleJson(filePath) {
  // Look for a companion JSON file (Google Takeout format)
  const jsonPath = filePath + '.json';
  if (!fs.existsSync(jsonPath)) return {};

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    let date = null;
    if (data.photoTakenTime && data.photoTakenTime.timestamp) {
      const ts = parseInt(data.photoTakenTime.timestamp, 10);
      if (!isNaN(ts)) {
        const d = new Date(ts * 1000);
        if (!isNaN(d)) date = d.toISOString();
      }
    }

    let gps_lat = null, gps_lon = null;
    const geo = data.geoData || data.geoDataExif;
    if (geo && geo.latitude && geo.longitude && Math.abs(geo.latitude) > 0.001) {
      gps_lat = geo.latitude;
      gps_lon = geo.longitude;
    }

    return {
      datum: date,
      gps_lat: gps_lat,
      gps_lon: gps_lon,
      google_description: data.description || null,
      google_device_type: data.googlePhotosOrigin?.deviceType || null
    };
  } catch (e) {
    return {};
  }
}

// Files that we read into a buffer ourselves (instead of giving exifr a path)
// stay below this limit. Larger files — big RAW, videos — get the path so
// exifr reads chunked and we don't pull a giant buffer into memory.
const META_MAX_BUFFER_BYTES = 64 * 1024 * 1024; // 64 MB

async function readMetadata(filePath) {
  try {
    // Determine the EXIF source. We read the file into a buffer OURSELVES and
    // close the file descriptor explicitly (try/finally), instead of giving
    // exifr a path. Otherwise exifr internally opens a FileHandle that it
    // sometimes only closes at garbage collection — the Node warning DEP0137
    // ("Closing file descriptor N on garbage collection"). With 22,000+ photos
    // those open descriptors pile up during the scan. Large/too-large files are
    // NOT read fully: then we fall back to the path (exifr reads chunked).
    let source = filePath;
    let fd;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0 && stat.size <= META_MAX_BUFFER_BYTES) {
        fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(stat.size);
        fs.readSync(fd, buf, 0, stat.size, 0);
        source = buf;
      }
    } catch (_) {
      source = filePath; // read error → fall back to the path
    } finally {
      if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
    }

    const exif = await exifr.parse(source, {
      tiff: true, exif: true, gps: true, ifd1: true,
      translateKeys: true, translateValues: true
    });

    if (!exif) return {};

    // Determine date
    let photoDate = null;
    const dateFields = [
      exif.DateTimeOriginal, exif.CreateDate,
      exif.DateTime, exif.ModifyDate
    ];
    for (const d of dateFields) {
      if (d instanceof Date && !isNaN(d)) {
        photoDate = d.toISOString();
        break;
      }
    }

    // Property names mirror the DB columns of the `fotos` table — keep as-is.
    return {
      datum_foto: photoDate,
      jaar: photoDate ? new Date(photoDate).getFullYear() : null,
      maand: photoDate ? new Date(photoDate).getMonth() + 1 : null,
      dag: photoDate ? new Date(photoDate).getDate() : null,
      gps_lat: exif.latitude || null,
      gps_lon: exif.longitude || null,
      camera_merk: exif.Make || null,
      camera_model: exif.Model || null,
      lens: exif.LensModel || exif.Lens || null,
      software: exif.Software || null,
      breedte: exif.ImageWidth || exif.ExifImageWidth || null,
      hoogte: exif.ImageHeight || exif.ExifImageHeight || null,
      orientatie: exif.Orientation || null,
      iso: exif.ISO || null,
      sluitertijd: exif.ExposureTime ? String(exif.ExposureTime) : null,
      diafragma: exif.FNumber ? String(exif.FNumber) : null,
      brandpuntsafstand: exif.FocalLength ? String(exif.FocalLength) : null,
      flits: exif.Flash ? String(exif.Flash) : null,
      kleurruimte: exif.ColorSpace ? String(exif.ColorSpace) : null
    };
  } catch (e) {
    return {};
  }
}

// Cache: prevents duplicate Nominatim calls for the same location during a scan
const gpsCache = new Map();

async function fetchGpsAddress(lat, lon) {
  // Round to 3 decimals (~100m accuracy) as cache key
  const cacheKey = `${Math.round(lat * 1000) / 1000},${Math.round(lon * 1000) / 1000}`;
  if (gpsCache.has(cacheKey)) return gpsCache.get(cacheKey);

  try {
    const https = require('https');
    const { result, status } = await new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const req = https.get(url, {
        headers: { 'User-Agent': 'FotoApp/1.0', 'Accept-Language': 'en' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 429 (rate limit) or server error → temporary failure, don't cache
          if (res.statusCode === 429 || res.statusCode >= 500) {
            resolve({ result: {}, status: res.statusCode });
            return;
          }
          try {
            const json = JSON.parse(data);
            const addr = json.address || {};
            // Strip non-Latin parts (e.g. "Malha - مالحة" → "Malha")
            const cleanName = (s) => {
              if (!s) return null;
              // Split on " - " or " / " and take the first part with Latin characters
              const parts = s.split(/\s*[-\/]\s*/);
              const latinPart = parts.find(d => /[a-zA-Z]/.test(d));
              return ((latinPart || parts[0] || s).trim()) || null;
            };
            resolve({
              result: {
                gps_adres: json.display_name || null,
                gps_stad: cleanName(addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || null),
                gps_land: cleanName(addr.country || null),
                gps_land_code: (addr.country_code || '').toUpperCase() || null
              },
              status: res.statusCode
            });
          } catch { resolve({ result: {}, status: res.statusCode }); }
        });
      });
      req.on('error', () => resolve({ result: {}, status: 0 }));
      req.setTimeout(8000, () => { req.destroy(); resolve({ result: {}, status: 0 }); });
    });

    // Only cache successful results (with a country). Empty answers caused by
    // 429/timeout/network error are NOT cached, so a later geocode pass retries them.
    if (result && result.gps_land) {
      gpsCache.set(cacheKey, result);
    }
    // Nominatim policy: max 1 request per second. Cool down extra long on 429.
    await new Promise(r => setTimeout(r, status === 429 ? 5000 : 1100));
    return result;
  } catch (e) {
    return {};
  }
}

async function _startScan(bronId, options = {}) {
  gpsCache.clear(); // Empty the cache at every new scan
  const db = getDb();
  const source = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(bronId);
  if (!source) { db.close(); return; }

  const logResult = db.prepare(`
    INSERT INTO scan_log (bron_id, gestart, status) VALUES (?, datetime('now'), 'bezig')
  `).run(bronId);

  scanStatus = {
    bezig: true,
    bron_id: bronId,
    bron_naam: source.naam,
    totaal: 0,
    verwerkt: 0,
    nieuw: 0,
    overgeslagen: 0,
    fouten: 0,
    huidig_bestand: 'Searching files...',
    gestart: new Date().toISOString(),
    log_id: logResult.lastInsertRowid,
    wachtrij: [...queue]
  };

  db.close();
  scanStopRequested = false;
  scanAsync(bronId, source.pad, logResult.lastInsertRowid, options).catch(console.error);
  return scanStatus;
}

async function startScan(bronId, options = {}) {
  return addToQueue(bronId, options);
}

async function scanAsync(bronId, startPath, logId, options = {}) {
  console.log(`🔍 Scan started: ${startPath}${options.includeHidden ? ' (incl. hidden folders)' : ''}`);

  try {
    // Find all photos
    scanStatus.huidig_bestand = 'Inventorying files...';
    const allPhotos = await findAllPhotos(startPath, options);
    scanStatus.totaal = allPhotos.length;
    console.log(`📷 ${allPhotos.length} photos found`);

    const db = getDb();
    const insertPhoto = db.prepare(`
      INSERT OR IGNORE INTO fotos (
        bron_id, bestandsnaam, volledig_pad, hash, bestandsgrootte, bestandstype,
        datum_foto, datum_bestand, datum_bron, jaar, maand, dag,
        gps_lat, gps_lon, gps_adres, gps_stad, gps_land, gps_land_code,
        camera_merk, camera_model, lens, software,
        breedte, hoogte, orientatie, iso, sluitertijd, diafragma,
        brandpuntsafstand, flits, kleurruimte, thumbnail,
        google_description, google_device_type,
        is_video, duur
      ) VALUES (
        @bron_id, @bestandsnaam, @volledig_pad, @hash, @bestandsgrootte, @bestandstype,
        @datum_foto, @datum_bestand, @datum_bron, @jaar, @maand, @dag,
        @gps_lat, @gps_lon, @gps_adres, @gps_stad, @gps_land, @gps_land_code,
        @camera_merk, @camera_model, @lens, @software,
        @breedte, @hoogte, @orientatie, @iso, @sluitertijd, @diafragma,
        @brandpuntsafstand, @flits, @kleurruimte, @thumbnail,
        @google_description, @google_device_type,
        @is_video, @duur
      )
    `);

    const alreadyExists = db.prepare('SELECT id FROM fotos WHERE volledig_pad = ?');

    for (let i = 0; i < allPhotos.length; i++) {
      const photoPath = allPhotos[i];
      scanStatus.verwerkt = i + 1;
      scanStatus.huidig_bestand = path.basename(photoPath);

      // Stopped?
      if (scanStopRequested) {
        console.log('⏹ Scan stopped by user');
        break;
      }

      try {
        // Already in db?
        if (alreadyExists.get(photoPath)) {
          scanStatus.overgeslagen++;
          continue;
        }

        const stat = fs.statSync(photoPath);
        const hash = computeHash(photoPath);
        const meta = await readMetadata(photoPath);
        const googleJson = readGoogleJson(photoPath);
        const thumbnail = await createThumbnail(photoPath);

        // EXIF takes precedence; Google JSON is fallback; filename and creation date as last resort
        // (The dateSource values are stored in the datum_bron DB column — keep them.)
        let photoDate, dateSource;
        if (meta.datum_foto)                                    { photoDate = meta.datum_foto;                                             dateSource = 'EXIF'; }
        else if (googleJson.datum)                              { photoDate = googleJson.datum;                                            dateSource = 'Google Takeout'; }
        else if (parseDateFromFilename(path.basename(photoPath))) { photoDate = parseDateFromFilename(path.basename(photoPath));          dateSource = 'Bestandsnaam'; }
        else if (stat.birthtime && stat.birthtime.getTime() !== stat.mtime.getTime()) { photoDate = stat.birthtime.toISOString();          dateSource = 'Aanmaakdatum'; }
        else                                                    { photoDate = stat.mtime.toISOString();                                   dateSource = 'Wijzigingsdatum'; }
        // GPS: exifr → Google JSON → exiftool (for MP4/MOV containers)
        let gpsLat = meta.gps_lat || googleJson.gps_lat || null;
        let gpsLon = meta.gps_lon || googleJson.gps_lon || null;
        if (!gpsLat && VIDEO_EXTENSIONS.has(path.extname(photoPath).toLowerCase())) {
          const videoGps = await readGpsFromVideo(photoPath);
          if (videoGps.gps_lat) { gpsLat = videoGps.gps_lat; gpsLon = videoGps.gps_lon; }
        }

        const isVideo = VIDEO_EXTENSIONS.has(path.extname(photoPath).toLowerCase());
        const videoDuration = isVideo ? await readVideoDuration(photoPath) : null;

        const dateObj = photoDate ? new Date(photoDate) : null;

        // Fetch GPS address (only when GPS is available)
        let gpsAddress = {};
        if (gpsLat && gpsLon) {
          gpsAddress = await fetchGpsAddress(gpsLat, gpsLon);
          // The delay lives inside fetchGpsAddress itself (1.1s, only on cache miss)
        }

        insertPhoto.run({
          bron_id: bronId,
          bestandsnaam: path.basename(photoPath),
          volledig_pad: photoPath,
          hash: hash,
          bestandsgrootte: stat.size,
          bestandstype: path.extname(photoPath).toLowerCase().slice(1),
          datum_foto: photoDate,
          datum_bestand: stat.mtime.toISOString(),
          datum_bron: dateSource,
          jaar: dateObj ? dateObj.getFullYear() : null,
          maand: dateObj ? dateObj.getMonth() + 1 : null,
          dag: dateObj ? dateObj.getDate() : null,
          gps_lat: gpsLat,
          gps_lon: gpsLon,
          gps_adres: gpsAddress.gps_adres || null,
          gps_stad: gpsAddress.gps_stad || null,
          gps_land: gpsAddress.gps_land || null,
          gps_land_code: gpsAddress.gps_land_code || null,
          camera_merk: meta.camera_merk || null,
          camera_model: meta.camera_model || null,
          lens: meta.lens || null,
          software: meta.software || null,
          breedte: meta.breedte || null,
          hoogte: meta.hoogte || null,
          orientatie: meta.orientatie || null,
          iso: meta.iso || null,
          sluitertijd: meta.sluitertijd || null,
          diafragma: meta.diafragma || null,
          brandpuntsafstand: meta.brandpuntsafstand || null,
          flits: meta.flits || null,
          kleurruimte: meta.kleurruimte || null,
          thumbnail: thumbnail,
          google_description: googleJson.google_description || null,
          google_device_type: googleJson.google_device_type || null,
          is_video: isVideo ? 1 : 0,
          duur: videoDuration
        });

        scanStatus.nieuw++;

      } catch (e) {
        scanStatus.fouten++;
        console.error(`Error at ${photoPath}:`, e.message);
      }

      // Throttle: short breather every 50 files. This gives the garbage
      // collector air to clean up the buffers/decode leftovers of the previous
      // 50 before the next batch — keeping the RAM peak low (less chance of an
      // OOM kill). Also keeps the event loop free so the UI stays smooth.
      if ((i + 1) % 50 === 0) {
        await new Promise(r => setTimeout(r, 30));
        if (typeof global.gc === 'function') { try { global.gc(); } catch (_) {} }
      }
    }

    // Detect duplicates
    scanStatus.huidig_bestand = 'Detecting duplicates...';
    await detectDuplicates(db, bronId);

    // Update the source
    db.prepare(`
      UPDATE bronnen SET laatste_scan = datetime('now'), totaal_fotos = (
        SELECT COUNT(*) FROM fotos WHERE bron_id = ?
      ) WHERE id = ?
    `).run(bronId, bronId);

    // Close the log
    db.prepare(`
      UPDATE scan_log SET voltooid = datetime('now'), totaal = ?, nieuw = ?,
      overgeslagen = ?, fouten = ?, status = 'voltooid'
      WHERE id = ?
    `).run(scanStatus.totaal, scanStatus.nieuw, scanStatus.overgeslagen, scanStatus.fouten, logId);

    db.close();

    console.log(`✅ Scan completed: ${scanStatus.nieuw} new, ${scanStatus.overgeslagen} skipped, ${scanStatus.fouten} errors`);

  } catch (e) {
    console.error('Scan error:', e);
  } finally {
    scanStatus.bezig = false;
    scanStatus.huidig_bestand = scanStopRequested ? 'Gestopt' : 'Scan voltooid';
    scanStopRequested = false;
    // Start the next one in the queue
    setTimeout(() => processQueue(), 500);
    // Do NOT start the background passes right after one another — otherwise
    // geocode, video thumbnails and video GPS pile up memory on top of a
    // possible scan. They are run neatly one after the other (each pass waits
    // for the previous one).
    setTimeout(() => runBackgroundPasses(), 1000);
  }
}

// Runs the background passes strictly one AFTER the other so they don't gobble
// memory and subprocesses at the same time. Stops as soon as a new scan begins.
async function runBackgroundPasses() {
  try {
    await startGeocodePass();
    if (scanStatus.bezig) return;
    await startVideoThumbnailPass();
    if (scanStatus.bezig) return;
    await startVideoGpsPass();
  } catch (e) {
    console.error('Background pass error:', e.message);
  }
}

async function detectDuplicates(db, bronId) {
  // Reset duplicates for this source
  db.prepare('UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL WHERE bron_id = ?').run(bronId);

  // Find all hashes occurring more than once (across all sources)
  const duplicateHashes = db.prepare(`
    SELECT hash, COUNT(*) as aantal FROM fotos
    WHERE hash IS NOT NULL
    GROUP BY hash HAVING COUNT(*) > 1
  `).all();

  // With thousands of duplicate groups this loop used to run through in one
  // synchronous go and blocked the main process. Now we give the event loop
  // some air every 200 groups so the window stays responsive.
  const updateStmt = db.prepare('UPDATE fotos SET is_duplicaat = 1, duplicaat_groep = ? WHERE hash = ?');
  for (let i = 0; i < duplicateHashes.length; i++) {
    updateStmt.run(duplicateHashes[i].hash, duplicateHashes[i].hash);
    if ((i + 1) % 200 === 0) {
      await new Promise(r => setImmediate(r));
    }
  }

  console.log(`🔍 ${duplicateHashes.length} duplicate groups found`);
}

function stopScan(clearQueue = false) {
  scanStopRequested = true;
  scanStatus.huidig_bestand = 'Gestopt door gebruiker...';
  if (clearQueue) queue = [];
  console.log('⏹ Stop requested');
}

// Stops only the geocode background pass, without touching a running scan.
function stopGeocode() {
  geocodeStopRequested = true;
  console.log('⏹ Geocode pass stop requested');
}

// === VIDEO THUMBNAIL PASS ===

let videoThumbPassStatus = { bezig: false, gedaan: 0, totaal: 0, fout: 0 };

function getVideoThumbStatus() {
  return videoThumbPassStatus;
}

async function startVideoThumbnailPass() {
  if (videoThumbPassStatus.bezig) return;

  const db = getDb();
  const videos = db.prepare(
    "SELECT id, volledig_pad FROM fotos WHERE is_video = 1 AND thumbnail IS NULL"
  ).all();
  db.close();

  if (videos.length === 0) return; // nothing to do

  videoThumbPassStatus = { bezig: true, gedaan: 0, totaal: videos.length, fout: 0 };
  console.log(`🎬 Video thumbnail pass started — ${videos.length} videos to process`);
  console.log('   ℹ️  This runs quietly in the background. The app keeps working normally.');
  console.log('   ⏳ Be patient — thumbnails appear automatically in the gallery.');

  // Return a promise so runBackgroundPasses() can really wait for it.
  // API callers don't await, so for them it remains fire-and-forget.
  return (async () => {
    for (const v of videos) {
      // Stop if a new scan has started
      if (scanStatus.bezig) {
        console.log('🎬 Video thumbnail pass paused — scan active');
        videoThumbPassStatus.bezig = false;
        return;
      }

      try {
        const thumb = await createVideoThumbnail(v.volledig_pad);
        if (thumb) {
          const db2 = getDb();
          db2.prepare('UPDATE fotos SET thumbnail = ? WHERE id = ?').run(thumb, v.id);
          db2.close();
        } else {
          videoThumbPassStatus.fout++;
        }
      } catch (_) {
        videoThumbPassStatus.fout++;
      }

      videoThumbPassStatus.gedaan++;

      // Progress in the server log every 25 videos
      if (videoThumbPassStatus.gedaan % 25 === 0) {
        const remaining = videoThumbPassStatus.totaal - videoThumbPassStatus.gedaan;
        console.log(`🎬 Thumbnails: ${videoThumbPassStatus.gedaan}/${videoThumbPassStatus.totaal} done — ${remaining} to go`);
      }

      // Small pause so the server does not get overloaded
      await new Promise(r => setTimeout(r, 50));
    }

    const { gedaan, totaal, fout } = videoThumbPassStatus;
    videoThumbPassStatus.bezig = false;
    console.log(`✅ Video thumbnail pass completed: ${gedaan - fout}/${totaal} created${fout > 0 ? `, ${fout} failed (no problem)` : ''}`);
  })();
}

// ─── VIDEO GPS PASS ──────────────────────────────────────────────────────────
// Reads GPS from existing videos via exiftool (fallback for containers exifr misses)

let videoGpsPassStatus = { bezig: false, gedaan: 0, totaal: 0, gevonden: 0 };

function getVideoGpsStatus() {
  return { ...videoGpsPassStatus };
}

async function startVideoGpsPass() {
  if (videoGpsPassStatus.bezig) return;

  const db = getDb();
  const videos = db.prepare(
    "SELECT id, volledig_pad FROM fotos WHERE is_video = 1 AND (gps_lat IS NULL OR gps_lat = 0)"
  ).all();
  db.close();

  if (videos.length === 0) return;

  videoGpsPassStatus = { bezig: true, gedaan: 0, totaal: videos.length, gevonden: 0 };
  console.log(`📍 Video GPS pass started — checking ${videos.length} videos for GPS`);
  console.log('   ℹ️  This runs quietly in the background. Be patient.');

  // Return a promise so runBackgroundPasses() can really wait for it.
  return (async () => {
    for (const v of videos) {
      if (scanStatus.bezig) {
        console.log('📍 Video GPS pass paused — scan active');
        videoGpsPassStatus.bezig = false;
        return;
      }

      try {
        const gps = await readGpsFromVideo(v.volledig_pad);
        if (gps.gps_lat && gps.gps_lon) {
          // GPS found — fetch city/country and store
          const address = await fetchGpsAddress(gps.gps_lat, gps.gps_lon);
          const db2 = getDb();
          db2.prepare(`
            UPDATE fotos SET gps_lat=?, gps_lon=?, gps_stad=?, gps_land=?, gps_land_code=?, gps_adres=?
            WHERE id=?
          `).run(gps.gps_lat, gps.gps_lon, address.gps_stad||null, address.gps_land||null, address.gps_land_code||null, address.gps_adres||null, v.id);
          db2.close();
          videoGpsPassStatus.gevonden++;
          if (videoGpsPassStatus.gevonden % 10 === 0) {
            console.log(`📍 Video GPS: ${videoGpsPassStatus.gevonden} locations found (${videoGpsPassStatus.gedaan}/${videoGpsPassStatus.totaal} processed)`);
          }
        }
      } catch (_) {}

      videoGpsPassStatus.gedaan++;
      await new Promise(r => setTimeout(r, 20)); // light pause
    }

    videoGpsPassStatus.bezig = false;
    const { gevonden, totaal } = videoGpsPassStatus;
    if (gevonden > 0) {
      console.log(`✅ Video GPS pass done: ${gevonden} new locations found in ${totaal} videos`);
    } else {
      console.log(`📍 Video GPS pass done: no new GPS data found in ${totaal} videos (location not stored in container)`);
    }
  })();
}

module.exports = {
  startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propagateGpsInGroups,
  stopScan, stopGeocode, computeHash, removeFromQueue,
  createThumbnailForVideo: createVideoThumbnail, startVideoThumbnailPass, getVideoThumbStatus,
  startVideoGpsPass, getVideoGpsStatus
};
