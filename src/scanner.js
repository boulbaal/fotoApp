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
  running: false,
  source_id: null,
  total: 0,
  processed: 0,
  new_files: 0,
  skipped: 0,
  errors: 0,
  current_file: '',
  started: null,
  log_id: null,
  queue: []
};

// Geocoding pass — runs in the background after every scan
let geocodeStatus = {
  running: false,
  total: 0,
  done: 0,
  current_country: ''
};

function getScanStatus() {
  return { ...scanStatus, queue: [...queue], geocode: { ...geocodeStatus } };
}

function getGeocodeStatus() {
  return { ...geocodeStatus };
}

// Shares GPS data (city/country/code) from one copy to all others in the same duplicate group
function propagateGpsInGroups() {
  const db = getDb();
  try {
  const groups = db.prepare(`
    SELECT duplicate_group,
           MAX(gps_lat) as lat, MAX(gps_lon) as lon,
           MAX(gps_city) as city, MAX(gps_country) as country,
           MAX(gps_country_code) as land_code, MAX(gps_address) as adres
    FROM photos
    WHERE duplicate_group IS NOT NULL
      AND gps_lat IS NOT NULL
      AND gps_country IS NOT NULL AND gps_country != ''
    GROUP BY duplicate_group
  `).all();

  const propagateStmt = db.prepare(`
    UPDATE photos SET gps_lat = ?, gps_lon = ?, gps_city = ?, gps_country = ?,
                     gps_country_code = ?, gps_address = ?
    WHERE duplicate_group = ?
      AND (gps_country IS NULL OR gps_country = '')
  `);
  let updated = 0;
  for (const g of groups) {
    const info = propagateStmt.run(g.lat, g.lon, g.city, g.country, g.land_code, g.adres, g.duplicate_group);
    updated += info.changes;
  }
  if (updated > 0) console.log(`🔗 GPS shared in ${groups.length} duplicate groups: ${updated} photos updated`);
  return updated;
  } finally {
    db.close();
  }
}

// Start geocoding pass in the background — fills in gps_country/city for all photos missing it
async function startGeocodePass() {
  if (geocodeStatus.running) return; // already running
  geocodeStopRequested = false; // fresh start — own flag, separate from scanStopRequested
  geocodeStatus.running = true;
  geocodeStatus.done = 0;
  geocodeStatus.current_country = '';

  const db = getDb();

  // All unique locations without gps_country (rounded to 3 decimals)
  const locations = db.prepare(`
    SELECT ROUND(gps_lat, 3) as lat, ROUND(gps_lon, 3) as lon, COUNT(*) as n
    FROM photos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      AND (gps_country IS NULL OR gps_country = '')
    GROUP BY ROUND(gps_lat, 3), ROUND(gps_lon, 3)
    ORDER BY n DESC
  `).all();

  geocodeStatus.total = locations.length;
  db.close();

  if (locations.length === 0) {
    // No new locations to geocode, but do share GPS within duplicate groups
    propagateGpsInGroups();
    geocodeStatus.running = false;
    return;
  }

  console.log(`🌍 Geocode pass started: ${locations.length} unique locations to process`);

  const updateLocation = (address, lat, lon) => {
    if (!address || !address.gps_country) return;
    const db2 = getDb();
    try {
      db2.prepare(`
        UPDATE photos SET gps_city = ?, gps_country = ?, gps_country_code = ?, gps_address = ?
        WHERE ROUND(gps_lat, 3) = ? AND ROUND(gps_lon, 3) = ?
          AND (gps_country IS NULL OR gps_country = '')
      `).run(address.gps_city || null, address.gps_country, address.gps_country_code || null, address.gps_address || null, lat, lon);
    } finally {
      db2.close();
    }
  };

  for (const loc of locations) {
    if (geocodeStopRequested) break; // Own geocode stop flag (not the scan flag)
    const address = await fetchGpsAddress(loc.lat, loc.lon);
    geocodeStatus.done++;
    geocodeStatus.current_country = address?.gps_country || '';
    updateLocation(address, loc.lat, loc.lon);
    console.log(`🌍 Geocode ${geocodeStatus.done}/${geocodeStatus.total}: ${address?.gps_country || 'no result'}`);
  }

  // Share GPS data within duplicate groups (originals without a country now also get the copy's country)
  propagateGpsInGroups();

  geocodeStatus.running = false;
  geocodeStatus.current_country = '';
  console.log(`✅ Geocode pass done: ${geocodeStatus.done} locations processed`);
}

async function addToQueue(sourceId, options = {}) {
  const db = getDb();
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  db.close();
  if (!source) throw new Error('Source not found');

  // Not twice in the queue
  if (queue.find(w => w.id === sourceId)) {
    throw new Error('Bron staat al in de queue');
  }
  // Not if already running
  if (scanStatus.running && scanStatus.source_id === sourceId) {
    throw new Error('Bron is al aan het scannen');
  }

  // Hidden folders: explicit option wins, otherwise the per-source setting.
  const includeHidden = options.includeHidden !== undefined
    ? !!options.includeHidden
    : !!source.include_hidden;

  queue.push({ id: sourceId, name: source.name, path: source.path, options: { includeHidden } });
  console.log(`📋 Queue: ${queue.map(w => w.name).join(' → ')}`);

  // Start processing if nothing is running
  if (!scanStatus.running) processQueue();

  return getScanStatus();
}

async function processQueue() {
  if (scanStatus.running || queue.length === 0) return;

  const next = queue.shift();
  console.log(`▶ Next in queue: ${next.name}`);
  await _startScan(next.id, next.options || {});
}

function removeFromQueue(sourceId) {
  queue = queue.filter(w => w.id !== sourceId);
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
  const photos = [];

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
          photos.push(fullPath);
        }
      }
    }
  }

  await search(startPath);
  return photos;
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
      date: date,
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

    // Property names mirror the DB columns of the `photos` table — keep as-is.
    return {
      photo_date: photoDate,
      year: photoDate ? new Date(photoDate).getFullYear() : null,
      month: photoDate ? new Date(photoDate).getMonth() + 1 : null,
      day: photoDate ? new Date(photoDate).getDate() : null,
      gps_lat: exif.latitude || null,
      gps_lon: exif.longitude || null,
      camera_make: exif.Make || null,
      camera_model: exif.Model || null,
      lens: exif.LensModel || exif.Lens || null,
      software: exif.Software || null,
      width: exif.ImageWidth || exif.ExifImageWidth || null,
      height: exif.ImageHeight || exif.ExifImageHeight || null,
      orientation: exif.Orientation || null,
      iso: exif.ISO || null,
      shutter_speed: exif.ExposureTime ? String(exif.ExposureTime) : null,
      aperture: exif.FNumber ? String(exif.FNumber) : null,
      focal_length: exif.FocalLength ? String(exif.FocalLength) : null,
      flash: exif.Flash ? String(exif.Flash) : null,
      color_space: exif.ColorSpace ? String(exif.ColorSpace) : null
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
                gps_address: json.display_name || null,
                gps_city: cleanName(addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || null),
                gps_country: cleanName(addr.country || null),
                gps_country_code: (addr.country_code || '').toUpperCase() || null
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
    if (result && result.gps_country) {
      gpsCache.set(cacheKey, result);
    }
    // Nominatim policy: max 1 request per second. Cool down extra long on 429.
    await new Promise(r => setTimeout(r, status === 429 ? 5000 : 1100));
    return result;
  } catch (e) {
    return {};
  }
}

async function _startScan(sourceId, options = {}) {
  gpsCache.clear(); // Empty the cache at every new scan
  const db = getDb();
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  if (!source) { db.close(); return; }

  const logResult = db.prepare(`
    INSERT INTO scan_log (source_id, started, status) VALUES (?, datetime('now'), 'running')
  `).run(sourceId);

  scanStatus = {
    running: true,
    source_id: sourceId,
    source_name: source.name,
    total: 0,
    processed: 0,
    new_files: 0,
    skipped: 0,
    errors: 0,
    current_file: 'Searching files...',
    started: new Date().toISOString(),
    log_id: logResult.lastInsertRowid,
    queue: [...queue]
  };

  db.close();
  scanStopRequested = false;
  scanAsync(sourceId, source.path, logResult.lastInsertRowid, options).catch(console.error);
  return scanStatus;
}

async function startScan(sourceId, options = {}) {
  return addToQueue(sourceId, options);
}

async function scanAsync(sourceId, startPath, logId, options = {}) {
  console.log(`🔍 Scan started: ${startPath}${options.includeHidden ? ' (incl. hidden folders)' : ''}`);

  try {
    // Find all photos
    scanStatus.current_file = 'Inventorying files...';
    const allPhotos = await findAllPhotos(startPath, options);
    scanStatus.total = allPhotos.length;
    console.log(`📷 ${allPhotos.length} photos found`);

    const db = getDb();
    const insertPhoto = db.prepare(`
      INSERT OR IGNORE INTO photos (
        source_id, filename, full_path, hash, file_size, file_type,
        photo_date, file_date, date_source, year, month, day,
        gps_lat, gps_lon, gps_address, gps_city, gps_country, gps_country_code,
        camera_make, camera_model, lens, software,
        width, height, orientation, iso, shutter_speed, aperture,
        focal_length, flash, color_space, thumbnail,
        google_description, google_device_type,
        is_video, duration
      ) VALUES (
        @source_id, @filename, @full_path, @hash, @file_size, @file_type,
        @photo_date, @file_date, @date_source, @year, @month, @day,
        @gps_lat, @gps_lon, @gps_address, @gps_city, @gps_country, @gps_country_code,
        @camera_make, @camera_model, @lens, @software,
        @width, @height, @orientation, @iso, @shutter_speed, @aperture,
        @focal_length, @flash, @color_space, @thumbnail,
        @google_description, @google_device_type,
        @is_video, @duration
      )
    `);

    const alreadyExists = db.prepare('SELECT id FROM photos WHERE full_path = ?');

    for (let i = 0; i < allPhotos.length; i++) {
      const photoPath = allPhotos[i];
      scanStatus.processed = i + 1;
      scanStatus.current_file = path.basename(photoPath);

      // Stopped?
      if (scanStopRequested) {
        console.log('⏹ Scan stopped by user');
        break;
      }

      try {
        // Already in db?
        if (alreadyExists.get(photoPath)) {
          scanStatus.skipped++;
          continue;
        }

        const stat = fs.statSync(photoPath);
        const hash = computeHash(photoPath);
        const meta = await readMetadata(photoPath);
        const googleJson = readGoogleJson(photoPath);
        const thumbnail = await createThumbnail(photoPath);

        // EXIF takes precedence; Google JSON is fallback; filename and creation date as last resort
        // (The dateSource values are stored in the date_source DB column — keep them.)
        let photoDate, dateSource;
        if (meta.photo_date)                                    { photoDate = meta.photo_date;                                             dateSource = 'EXIF'; }
        else if (googleJson.date)                              { photoDate = googleJson.date;                                            dateSource = 'Google Takeout'; }
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
          source_id: sourceId,
          filename: path.basename(photoPath),
          full_path: photoPath,
          hash: hash,
          file_size: stat.size,
          file_type: path.extname(photoPath).toLowerCase().slice(1),
          photo_date: photoDate,
          file_date: stat.mtime.toISOString(),
          date_source: dateSource,
          year: dateObj ? dateObj.getFullYear() : null,
          month: dateObj ? dateObj.getMonth() + 1 : null,
          day: dateObj ? dateObj.getDate() : null,
          gps_lat: gpsLat,
          gps_lon: gpsLon,
          gps_address: gpsAddress.gps_address || null,
          gps_city: gpsAddress.gps_city || null,
          gps_country: gpsAddress.gps_country || null,
          gps_country_code: gpsAddress.gps_country_code || null,
          camera_make: meta.camera_make || null,
          camera_model: meta.camera_model || null,
          lens: meta.lens || null,
          software: meta.software || null,
          width: meta.width || null,
          height: meta.height || null,
          orientation: meta.orientation || null,
          iso: meta.iso || null,
          shutter_speed: meta.shutter_speed || null,
          aperture: meta.aperture || null,
          focal_length: meta.focal_length || null,
          flash: meta.flash || null,
          color_space: meta.color_space || null,
          thumbnail: thumbnail,
          google_description: googleJson.google_description || null,
          google_device_type: googleJson.google_device_type || null,
          is_video: isVideo ? 1 : 0,
          duration: videoDuration
        });

        scanStatus.new_files++;

      } catch (e) {
        scanStatus.errors++;
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
    scanStatus.current_file = 'Detecting duplicates...';
    await detectDuplicates(db, sourceId);

    // Update the source
    db.prepare(`
      UPDATE sources SET last_scan = datetime('now'), total_photos = (
        SELECT COUNT(*) FROM photos WHERE source_id = ?
      ) WHERE id = ?
    `).run(sourceId, sourceId);

    // Close the log
    db.prepare(`
      UPDATE scan_log SET completed = datetime('now'), total = ?, new_files = ?,
      skipped = ?, errors = ?, status = 'completed'
      WHERE id = ?
    `).run(scanStatus.total, scanStatus.new_files, scanStatus.skipped, scanStatus.errors, logId);

    db.close();

    console.log(`✅ Scan completed: ${scanStatus.new_files} new, ${scanStatus.skipped} skipped, ${scanStatus.errors} errors`);

  } catch (e) {
    console.error('Scan error:', e);
  } finally {
    scanStatus.running = false;
    scanStatus.current_file = scanStopRequested ? 'Gestopt' : 'Scan completed';
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
    if (scanStatus.running) return;
    await startVideoThumbnailPass();
    if (scanStatus.running) return;
    await startVideoGpsPass();
  } catch (e) {
    console.error('Background pass error:', e.message);
  }
}

async function detectDuplicates(db, sourceId) {
  // Reset duplicates for this source
  db.prepare('UPDATE photos SET is_duplicate = 0, duplicate_group = NULL WHERE source_id = ?').run(sourceId);

  // Find all hashes occurring more than once (across all sources)
  const duplicateHashes = db.prepare(`
    SELECT hash, COUNT(*) as count FROM photos
    WHERE hash IS NOT NULL
    GROUP BY hash HAVING COUNT(*) > 1
  `).all();

  // With thousands of duplicate groups this loop used to run through in one
  // synchronous go and blocked the main process. Now we give the event loop
  // some air every 200 groups so the window stays responsive.
  const updateStmt = db.prepare('UPDATE photos SET is_duplicate = 1, duplicate_group = ? WHERE hash = ?');
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
  scanStatus.current_file = 'Gestopt door gebruiker...';
  if (clearQueue) queue = [];
  console.log('⏹ Stop requested');
}

// Stops only the geocode background pass, without touching a running scan.
function stopGeocode() {
  geocodeStopRequested = true;
  console.log('⏹ Geocode pass stop requested');
}

// === VIDEO THUMBNAIL PASS ===

let videoThumbPassStatus = { running: false, done: 0, total: 0, error: 0 };

function getVideoThumbStatus() {
  return videoThumbPassStatus;
}

async function startVideoThumbnailPass() {
  if (videoThumbPassStatus.running) return;

  const db = getDb();
  const videos = db.prepare(
    "SELECT id, full_path FROM photos WHERE is_video = 1 AND thumbnail IS NULL"
  ).all();
  db.close();

  if (videos.length === 0) return; // nothing to do

  videoThumbPassStatus = { running: true, done: 0, total: videos.length, error: 0 };
  console.log(`🎬 Video thumbnail pass started — ${videos.length} videos to process`);
  console.log('   ℹ️  This runs quietly in the background. The app keeps working normally.');
  console.log('   ⏳ Be patient — thumbnails appear automatically in the gallery.');

  // Return a promise so runBackgroundPasses() can really wait for it.
  // API callers don't await, so for them it remains fire-and-forget.
  return (async () => {
    for (const v of videos) {
      // Stop if a new scan has started
      if (scanStatus.running) {
        console.log('🎬 Video thumbnail pass paused — scan active');
        videoThumbPassStatus.running = false;
        return;
      }

      try {
        const thumb = await createVideoThumbnail(v.full_path);
        if (thumb) {
          const db2 = getDb();
          db2.prepare('UPDATE photos SET thumbnail = ? WHERE id = ?').run(thumb, v.id);
          db2.close();
        } else {
          videoThumbPassStatus.error++;
        }
      } catch (_) {
        videoThumbPassStatus.error++;
      }

      videoThumbPassStatus.done++;

      // Progress in the server log every 25 videos
      if (videoThumbPassStatus.done % 25 === 0) {
        const remaining = videoThumbPassStatus.total - videoThumbPassStatus.done;
        console.log(`🎬 Thumbnails: ${videoThumbPassStatus.done}/${videoThumbPassStatus.total} done — ${remaining} to go`);
      }

      // Small pause so the server does not get overloaded
      await new Promise(r => setTimeout(r, 50));
    }

    const { done, total, error } = videoThumbPassStatus;
    videoThumbPassStatus.running = false;
    console.log(`✅ Video thumbnail pass completed: ${done - error}/${total} created${error > 0 ? `, ${error} failed (no problem)` : ''}`);
  })();
}

// ─── VIDEO GPS PASS ──────────────────────────────────────────────────────────
// Reads GPS from existing videos via exiftool (fallback for containers exifr misses)

let videoGpsPassStatus = { running: false, done: 0, total: 0, gevonden: 0 };

function getVideoGpsStatus() {
  return { ...videoGpsPassStatus };
}

async function startVideoGpsPass() {
  if (videoGpsPassStatus.running) return;

  const db = getDb();
  const videos = db.prepare(
    "SELECT id, full_path FROM photos WHERE is_video = 1 AND (gps_lat IS NULL OR gps_lat = 0)"
  ).all();
  db.close();

  if (videos.length === 0) return;

  videoGpsPassStatus = { running: true, done: 0, total: videos.length, gevonden: 0 };
  console.log(`📍 Video GPS pass started — checking ${videos.length} videos for GPS`);
  console.log('   ℹ️  This runs quietly in the background. Be patient.');

  // Return a promise so runBackgroundPasses() can really wait for it.
  return (async () => {
    for (const v of videos) {
      if (scanStatus.running) {
        console.log('📍 Video GPS pass paused — scan active');
        videoGpsPassStatus.running = false;
        return;
      }

      try {
        const gps = await readGpsFromVideo(v.full_path);
        if (gps.gps_lat && gps.gps_lon) {
          // GPS found — fetch city/country and store
          const address = await fetchGpsAddress(gps.gps_lat, gps.gps_lon);
          const db2 = getDb();
          db2.prepare(`
            UPDATE photos SET gps_lat=?, gps_lon=?, gps_city=?, gps_country=?, gps_country_code=?, gps_address=?
            WHERE id=?
          `).run(gps.gps_lat, gps.gps_lon, address.gps_city||null, address.gps_country||null, address.gps_country_code||null, address.gps_address||null, v.id);
          db2.close();
          videoGpsPassStatus.gevonden++;
          if (videoGpsPassStatus.gevonden % 10 === 0) {
            console.log(`📍 Video GPS: ${videoGpsPassStatus.gevonden} locations found (${videoGpsPassStatus.done}/${videoGpsPassStatus.total} processed)`);
          }
        }
      } catch (_) {}

      videoGpsPassStatus.done++;
      await new Promise(r => setTimeout(r, 20)); // light pause
    }

    videoGpsPassStatus.running = false;
    const { gevonden, total } = videoGpsPassStatus;
    if (gevonden > 0) {
      console.log(`✅ Video GPS pass done: ${gevonden} new locations found in ${total} videos`);
    } else {
      console.log(`📍 Video GPS pass done: no new GPS data found in ${total} videos (location not stored in container)`);
    }
  })();
}

module.exports = {
  startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propagateGpsInGroups,
  stopScan, stopGeocode, computeHash, removeFromQueue,
  createThumbnailForVideo: createVideoThumbnail, startVideoThumbnailPass, getVideoThumbStatus,
  startVideoGpsPass, getVideoGpsStatus
};
