const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb, getSharedDb } = require('./database');
const { startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propagateGpsInGroups, stopScan, stopGeocode, removeFromQueue, startVideoThumbnailPass, getVideoThumbStatus, startVideoGpsPass, getVideoGpsStatus } = require('./scanner');
const { calculatePreview, startExport, stopExport, getStatus: getExportStatus, resetExport } = require('./export');
const { readPriority, writePriority, determineKeeper, keeperIds } = require('./keeper');

const router = express.Router();

// === VERSION ===
// Single source of truth: the version lives in package.json. The frontend
// fetches it here to show in the title AND to refresh the favicon cache (?v=...).
// This way the version never needs manual updating on a release.
router.get('/version', (req, res) => {
  let version = '';
  try { version = require('../package.json').version || ''; } catch (_) {}
  res.json({ version: version });
});

// === SOURCES ===

router.get('/sources', (req, res) => {
  const db = getDb();
  const sources = db.prepare(`
    SELECT b.*,
      sl.started as scan_gestart,
      sl.completed as scan_voltooid,
      ROUND((JULIANDAY(sl.completed) - JULIANDAY(sl.started)) * 86400) as scan_duur_seconden
    FROM sources b
    LEFT JOIN scan_log sl ON sl.id = (
      SELECT id FROM scan_log WHERE source_id = b.id AND status = 'completed' ORDER BY id DESC LIMIT 1
    )
    ORDER BY b.created_at DESC
  `).all();
  db.close();
  res.json(sources);
});

router.post('/sources', (req, res) => {
  const { name, type, path, icon, include_hidden } = req.body;
  if (!name || !path) return res.status(400).json({ error: 'name and path are required' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sources (name, type, path, icon, include_hidden) VALUES (?, ?, ?, ?, ?)
  `).run(name, type || 'pc', path, icon || '💻', include_hidden ? 1 : 0);
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.json(source);
});

router.put('/sources/:id', (req, res) => {
  const { name, path, type, icon, include_hidden } = req.body;
  const db = getDb();
  db.prepare('UPDATE sources SET name = ?, path = ?, type = ?, icon = ?, include_hidden = ? WHERE id = ?')
    .run(name, path, type, icon, include_hidden ? 1 : 0, req.params.id);
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  db.close();
  res.json(source);
});

// Quick toggle from the source card: only the "scan hidden folders" flag
router.patch('/sources/:id/hidden', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE sources SET include_hidden = ? WHERE id = ?')
    .run(req.body.include_hidden ? 1 : 0, req.params.id);
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  db.close();
  res.json(source);
});

router.delete('/sources/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM photos WHERE source_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

// === SCAN ===

router.post('/scan/:sourceId', async (req, res) => {
  try {
    // By default the setting comes from the source itself; an explicit flag in
    // the body can override it per scan (otherwise the scanner falls back to the source).
    const hasFlag = req.body && req.body.verborgenMeenemen !== undefined;
    const options = hasFlag ? { includeHidden: !!req.body.verborgenMeenemen } : {};
    const status = await startScan(parseInt(req.params.sourceId), options);
    res.json(status);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/scan/status', (req, res) => {
  res.json(getScanStatus());
});

router.post('/scan/stop', (req, res) => {
  stopScan(true); // also empties the queue
  res.json({ ok: true });
});

router.delete('/scan/queue/:sourceId', (req, res) => {
  removeFromQueue(parseInt(req.params.sourceId));
  res.json(getScanStatus());
});

router.get('/scan/geocode', (req, res) => {
  res.json(getGeocodeStatus());
});

router.post('/scan/geocode', async (req, res) => {
  startGeocodePass(); // starts in the background, returns immediately
  res.json({ ok: true, message: 'Geocode pass started' });
});

// Stops only the geocode background pass — a running scan keeps going.
router.post('/scan/geocode/stop', (req, res) => {
  stopGeocode();
  res.json({ ok: true, message: 'Geocode pass stop requested' });
});

// Video thumbnail pass — started manually or automatically after a scan
router.post('/scan/video-thumbnails', (req, res) => {
  startVideoThumbnailPass();
  res.json({ ok: true, status: getVideoThumbStatus() });
});

router.get('/scan/video-thumbnails/status', (req, res) => {
  res.json(getVideoThumbStatus());
});

// Auto-start at boot if there are videos without a thumbnail
setTimeout(() => startVideoThumbnailPass(), 5000);

// Video GPS pass — reads GPS from video containers via exiftool (fallback for exifr)
router.post('/scan/video-gps', (req, res) => {
  startVideoGpsPass();
  res.json({ ok: true, status: getVideoGpsStatus() });
});

router.get('/scan/video-gps/status', (req, res) => {
  res.json(getVideoGpsStatus());
});

// Auto-start 15s after boot (after the thumbnail pass)
setTimeout(() => startVideoGpsPass(), 15000);

// === STATISTICS ===
// Note: the local variable names below double as the JSON response field names
// (frontend contract) — deliberately left as-is until phase B.

router.get('/stats', (req, res) => {
  const db = getDb();

  const total      = db.prepare('SELECT COUNT(*) as n FROM photos').get().n;
  const totalPhotos = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0) = 0').get().n;
  const totalVideos= db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video = 1').get().n;
  const withGps     = db.prepare('SELECT COUNT(*) as n FROM photos WHERE gps_lat IS NOT NULL AND gps_lat != 0').get().n;
  const withoutGps  = db.prepare('SELECT COUNT(*) as n FROM photos WHERE gps_lat IS NULL OR gps_lat = 0').get().n;
  const duplicates = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_duplicate = 1').get().n;
  const duplicateGroups = db.prepare('SELECT COUNT(DISTINCT duplicate_group) as n FROM photos WHERE duplicate_group IS NOT NULL').get().n;
  const totalSize = db.prepare('SELECT SUM(file_size) as n FROM photos').get().n || 0;

  // Photo-specific
  const photosUnique     = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0)=0 AND COALESCE(is_duplicate,0)=0').get().n;
  const photosDuplicate    = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0)=0 AND is_duplicate=1').get().n;
  const photosWithGps    = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0)=0 AND gps_lat IS NOT NULL AND gps_lat!=0').get().n;
  const photosWithoutGps = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0)=0 AND (gps_lat IS NULL OR gps_lat=0)').get().n;

  // Video-specific
  const videosUnique     = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video=1 AND COALESCE(is_duplicate,0)=0').get().n;
  const videosDuplicate    = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video=1 AND is_duplicate=1').get().n;
  const videosWithGps    = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video=1 AND gps_lat IS NOT NULL AND gps_lat!=0').get().n;
  const videosWithoutGps = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video=1 AND (gps_lat IS NULL OR gps_lat=0)').get().n;

  const perYearVideo = db.prepare('SELECT year, COUNT(*) as count FROM photos WHERE is_video=1 AND year IS NOT NULL GROUP BY year ORDER BY year').all();

  const perSource = db.prepare(`
    SELECT b.id as source_id, b.name, b.icon, COUNT(f.id) as count, SUM(f.file_size) as size
    FROM sources b LEFT JOIN photos f ON b.id = f.source_id
    GROUP BY b.id
  `).all();

  const perYear = db.prepare(`
    SELECT year, COUNT(*) as count FROM photos
    WHERE year IS NOT NULL GROUP BY year ORDER BY year
  `).all();

  const perCamera = db.prepare(`
    SELECT camera_make, camera_model, COUNT(*) as count FROM photos
    WHERE camera_make IS NOT NULL AND COALESCE(is_video,0)=0
    GROUP BY camera_make, camera_model ORDER BY count DESC LIMIT 10
  `).all();

  const perCameraVideo = db.prepare(`
    SELECT camera_make, camera_model, COUNT(*) as count FROM photos
    WHERE camera_make IS NOT NULL AND is_video=1
    GROUP BY camera_make, camera_model ORDER BY count DESC LIMIT 10
  `).all();

  const perCountry = db.prepare(`
    SELECT gps_country, MAX(gps_country_code) as gps_country_code, COUNT(*) as count FROM photos
    WHERE gps_country IS NOT NULL AND gps_country != '' AND COALESCE(is_video,0)=0
    GROUP BY gps_country ORDER BY count DESC LIMIT 10
  `).all();

  const perCountryVideo = db.prepare(`
    SELECT gps_country, MAX(gps_country_code) as gps_country_code, COUNT(*) as count FROM photos
    WHERE gps_country IS NOT NULL AND gps_country != '' AND is_video=1
    GROUP BY gps_country ORDER BY count DESC LIMIT 10
  `).all();

  db.close();

  res.json({
    total, totalPhotos, totalVideos,
    withGps, withoutGps, duplicates, duplicateGroups,
    photosUnique, photosDuplicate, photosWithGps, photosWithoutGps,
    videosUnique, videosDuplicate, videosWithGps, videosWithoutGps,
    totalSize, perSource, perYear, perYearVideo, perCamera, perCameraVideo, perCountry, perCountryVideo
  });
});

// === CLEANUP DASHBOARD ===
// Overview of space that can be freed: duplicate copies (based on the stored
// keeper priority) + ignored files. Read-only.
router.get('/cleanup/overview', (req, res) => {
  const db = getDb();
  try {
    const { sourceOrder, manual } = readPriority(db);
    const plan = collectDuplicatePlan(db, sourceOrder, manual);
    const dupBytes = plan.toDelete.reduce((s, f) => s + (f.file_size || 0), 0);

    const ignored = db.prepare(
      'SELECT COUNT(*) as n, COALESCE(SUM(file_size), 0) as bytes FROM photos WHERE ignored = 1'
    ).get();

    res.json({
      duplicates: {
        bestanden: plan.toDelete.length,     // copies that can already be removed
        bytes: dupBytes,
        groupsReady: plan.groupsReady,      // groups with a chosen keeper
        choiceNeeded: plan.choiceNeeded        // groups that still require a choice
      },
      ignored: {
        bestanden: ignored.n,
        bytes: ignored.bytes
      },
      totaalVrijTeMaken: dupBytes + ignored.bytes
    });
  } catch (e) {
    res.status(500).json({ error: 'overview failed', detail: e.message });
  } finally {
    db.close();
  }
});

// === WRAPPED / PHOTO LIFE (shareable summary screen) ===
// Variable names double as response field names (frontend contract) — keep as-is.
router.get('/wrapped', (req, res) => {
  const db = getDb();

  const totalPhotos  = db.prepare('SELECT COUNT(*) as n FROM photos WHERE COALESCE(is_video,0)=0').get().n;
  const totalVideos = db.prepare('SELECT COUNT(*) as n FROM photos WHERE is_video=1').get().n;
  const countryCount = db.prepare("SELECT COUNT(DISTINCT gps_country) as n FROM photos WHERE gps_country IS NOT NULL AND gps_country != ''").get().n;
  const cityCount = db.prepare("SELECT COUNT(DISTINCT gps_city) as n FROM photos WHERE gps_city IS NOT NULL AND gps_city != ''").get().n;
  const withGps       = db.prepare('SELECT COUNT(*) as n FROM photos WHERE gps_lat IS NOT NULL AND gps_lat != 0').get().n;
  const totalSize = db.prepare('SELECT SUM(file_size) as n FROM photos').get().n || 0;

  const topYear = db.prepare(`
    SELECT year, COUNT(*) as count FROM photos
    WHERE year IS NOT NULL GROUP BY year ORDER BY count DESC LIMIT 1
  `).get() || null;

  const busiestMonth = db.prepare(`
    SELECT year, month, COUNT(*) as count FROM photos
    WHERE year IS NOT NULL AND month IS NOT NULL
    GROUP BY year, month ORDER BY count DESC LIMIT 1
  `).get() || null;

  const yearRange = db.prepare('SELECT MIN(year) as from_year, MAX(year) as to_year FROM photos WHERE year IS NOT NULL').get() || { from_year: null, to_year: null };

  const topCountries = db.prepare(`
    SELECT gps_country, MAX(gps_country_code) as gps_country_code, COUNT(*) as count FROM photos
    WHERE gps_country IS NOT NULL AND gps_country != ''
    GROUP BY gps_country ORDER BY count DESC LIMIT 5
  `).all();

  db.close();

  res.json({
    totalPhotos, totalVideos, countryCount, cityCount,
    withGps, totalSize, topYear, busiestMonth, yearRange, topCountries
  });
});

// === PHOTOS ===

router.get('/photos', (req, res) => {
  const db = getDb();
  const { page = 1, per_page = 50, source_id, year, search, without_thumbnail, country, camera_make, camera_model, without_copies, without_gps, with_gps, duplicates_only, unique_only, ignored, is_video } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(per_page);

  let where = '1=1';
  const params = [];

  if (source_id)      { where += ' AND f.source_id = ?';      params.push(source_id); }
  if (year)         { where += ' AND f.year = ?';          params.push(year); }
  if (country)         { where += ' AND f.gps_country = ?';      params.push(country); }
  if (camera_make)  { where += ' AND f.camera_make = ?';   params.push(camera_make); }
  if (camera_model) { where += ' AND f.camera_model = ?';  params.push(camera_model); }
  if (search) {
    // Text search across name, location (city + country) and camera (brand + model)
    where += ' AND (f.filename LIKE ? OR f.gps_city LIKE ? OR f.gps_country LIKE ? OR f.camera_make LIKE ? OR f.camera_model LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
  }
  if (without_gps === '1') { where += ' AND (f.gps_lat IS NULL OR f.gps_lat = 0)'; }
  if (with_gps === '1')    { where += ' AND f.gps_lat IS NOT NULL AND f.gps_lat != 0'; }
  if (duplicates_only === '1') { where += ' AND f.is_duplicate = 1'; }
  if (unique_only === '1')  { where += ' AND COALESCE(f.is_duplicate,0) = 0'; }
  if (ignored === '1')  { where += ' AND f.ignored = 1'; }
  if (ignored === '0')  { where += ' AND (f.ignored IS NULL OR f.ignored = 0)'; }
  if (is_video === '1')   { where += ' AND f.is_video = 1'; }
  if (is_video === '0')   { where += ' AND (f.is_video IS NULL OR f.is_video = 0)'; }

  // Hide copies: show the best copy per group that also matches active filters.
  // When a country/camera filter is active: pick the best copy WITH that country,
  // so originals without GPS data don't block the copy that has GPS data.
  if (without_copies === '1') {
    const countrySubquery = country         ? ' AND f2.gps_country = ?'        : '';
    const brandSubquery   = camera_make  ? ' AND f2.camera_make = ?'     : '';
    const modelSubquery   = camera_model ? ' AND f2.camera_model = ?'    : '';

    where += ` AND (
      f.is_duplicate = 0
      OR f.id = (
        SELECT f2.id FROM photos f2
        JOIN sources b2 ON f2.source_id = b2.id
        WHERE f2.duplicate_group = f.duplicate_group${countrySubquery}${brandSubquery}${modelSubquery}
        ORDER BY CASE b2.type WHEN 'pc' THEN 1 WHEN 'gsm' THEN 2 WHEN 'usb' THEN 3 ELSE 4 END, f2.id ASC
        LIMIT 1
      )
    )`;

    if (country)         params.push(country);
    if (camera_make)  params.push(camera_make);
    if (camera_model) params.push(camera_model);
  }

  const columns = without_thumbnail === '1'
    ? 'f.id, f.filename, f.full_path, f.file_size, f.file_type, f.photo_date, f.year, f.month, f.day, f.gps_lat, f.gps_lon, f.gps_city, f.gps_country, f.camera_make, f.camera_model, f.is_duplicate, f.duplicate_group, f.is_video, f.duration, f.exported, (f.thumbnail IS NOT NULL) as has_thumbnail, b.name as source_name, b.icon as source_icon'
    : 'f.*, (f.thumbnail IS NOT NULL) as has_thumbnail, b.name as source_name, b.icon as source_icon';

  const photos = db.prepare(`
    SELECT ${columns} FROM photos f
    JOIN sources b ON f.source_id = b.id
    WHERE ${where}
    ORDER BY f.photo_date DESC NULLS LAST, f.file_date DESC
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(per_page), offset]);

  const total = db.prepare(`SELECT COUNT(*) as n FROM photos f WHERE ${where}`).get(params).n;

  db.close();
  res.json({ photos: photos, total: total, page: parseInt(page), per_page: parseInt(per_page) });
});

router.get('/photos/:id', (req, res) => {
  const db = getDb();
  const photo = db.prepare(`
    SELECT f.*, b.name as source_name, b.icon as source_icon
    FROM photos f JOIN sources b ON f.source_id = b.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ error: 'Photo not found' }); }

  // If duplicate: fetch all copies (including the current one) to determine the original
  let duplicateLocations = [];
  let isOriginal = false;

  if (photo.duplicate_group) {
    const allCopies = db.prepare(`
      SELECT f.id, f.source_id, f.full_path, f.file_size, b.name as source_name, b.icon as source_icon, b.type as source_type
      FROM photos f JOIN sources b ON f.source_id = b.id
      WHERE f.duplicate_group = ?
    `).all(photo.duplicate_group);

    // Determine the kept copy via the shared keeper logic (same choice as the
    // duplicates page AND the export). required=true: there is always exactly
    // one kept copy, even when no source has been ranked yet.
    const { sourceOrder, manual } = readPriority(db);
    const originalId = determineKeeper(allCopies, sourceOrder, manual[photo.duplicate_group], { required: true });
    isOriginal = photo.id === originalId;

    // Other locations = all copies except the current one
    duplicateLocations = allCopies
      .filter(e => e.id !== photo.id)
      .map(e => ({ ...e, is_original: e.id === originalId }));
  }

  db.close();
  res.json({ ...photo, duplicate_locations: duplicateLocations, is_original: isOriginal });
});

// Serve the original photo/video with Range support (for video streaming)
router.get('/photos/:id/file', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT full_path, file_type, is_video FROM photos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo || !fs.existsSync(photo.full_path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Videos: send with Range support so the browser can seek and stream
  if (photo.is_video) {
    const ext = path.extname(photo.full_path).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4', '.m4v': 'video/mp4',
      '.mov': 'video/quicktime', '.qt': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.3gp': 'video/3gpp', '.3g2': 'video/3gpp2',
      '.mts': 'video/MP2T', '.m2ts': 'video/MP2T',
      '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.m2v': 'video/mpeg',
      '.ogv': 'video/ogg', '.ogg': 'video/ogg',
    };
    const contentType = mimeTypes[ext] || 'video/mp4';
    const stat = fs.statSync(photo.full_path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(photo.full_path, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(photo.full_path).pipe(res);
    }
    return;
  }

  // Photos: plain sendFile
  res.sendFile(photo.full_path);
});

// Open a file in the system player — in the foreground, on the screen where the mouse is
router.post('/photos/:id/open-external', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT full_path FROM photos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo || !fs.existsSync(photo.full_path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Electron: use shell.openPath (works on Windows, Mac AND Linux)
  if (global.electronOpenExternal) {
    global.electronOpenExternal(photo.full_path).then(err => {
      if (err) console.warn('shell.openPath error:', err);
    });
    return res.json({ ok: true, methode: 'electron' });
  }

  // Standalone Linux: VLC or xdg-open
  const { spawn, spawnSync, execFileSync } = require('child_process');

  const env = {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':0',
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS
      || `unix:path=/run/user/${process.getuid?.() || 1000}/bus`,
  };

  let vlcAvailable = false;
  try { execFileSync('which', ['vlc'], { env, stdio: 'pipe' }); vlcAvailable = true; } catch (_) {}

  const mouseX = parseInt(req.body?.mouseX) || null;
  const mouseY = parseInt(req.body?.mouseY) || null;

  if (vlcAvailable) {
    const child = spawn('vlc', ['--started-from-file', photo.full_path], {
      detached: true, stdio: 'ignore', env,
    });
    child.unref();

    setTimeout(() => {
      const xdotoolAvailable = spawnSync('which', ['xdotool'], { env, stdio: 'pipe' }).status === 0;
      if (xdotoolAvailable) {
        spawnSync('xdotool', [
          'search', '--name', 'VLC media player',
          'windowactivate', '--sync', 'windowraise',
        ], { env, stdio: 'ignore', timeout: 3000 });

        if (mouseX !== null && mouseY !== null) {
          const wmctrlAvailable = spawnSync('which', ['wmctrl'], { env, stdio: 'pipe' }).status === 0;
          if (wmctrlAvailable) {
            const x = Math.max(0, mouseX - 640);
            const y = Math.max(0, mouseY - 360);
            spawnSync('wmctrl', ['-a', 'VLC media player', '-e', `0,${x},${y},-1,-1`],
              { env, stdio: 'ignore' });
          }
        }
      }
    }, 900);
  } else {
    const child = spawn('xdg-open', [photo.full_path], {
      detached: true, stdio: 'ignore', env,
    });
    child.unref();
  }

  res.json({ ok: true, vlc: vlcAvailable });
});

// Show a file in the file manager (open folder + select the file).
// Works for the main path AND every duplicate location. Cross-platform.
router.post('/photos/:id/show-in-folder', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT full_path FROM photos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const targetPath = photo.full_path;
  const exists = targetPath && fs.existsSync(targetPath);
  // If the file itself is gone, we open the surrounding folder so the user
  // still sees the location and can check what's left there.
  const folderPath = exists ? path.dirname(targetPath) : (targetPath ? path.dirname(targetPath) : null);
  if (!folderPath || !fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Location not found on this computer', path: targetPath });
  }

  // Electron: shell.showItemInFolder selects the file in the file manager
  if (global.electronRevealInFolder && exists) {
    try { global.electronRevealInFolder(targetPath); return res.json({ ok: true, methode: 'electron', geselecteerd: true }); }
    catch (e) { console.warn('reveal error:', e.message); }
  }

  const { spawn, spawnSync } = require('child_process');
  const env = {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':0',
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS
      || `unix:path=/run/user/${process.getuid?.() || 1000}/bus`,
  };

  const platform = process.platform;
  try {
    if (platform === 'win32') {
      // Windows: open Explorer with the file selected
      if (exists) spawn('explorer', ['/select,', targetPath], { detached: true, stdio: 'ignore' }).unref();
      else spawn('explorer', [folderPath], { detached: true, stdio: 'ignore' }).unref();
      return res.json({ ok: true, methode: 'explorer', geselecteerd: exists });
    }
    if (platform === 'darwin') {
      // macOS: open Finder with the file selected (-R = reveal)
      if (exists) spawn('open', ['-R', targetPath], { detached: true, stdio: 'ignore' }).unref();
      else spawn('open', [folderPath], { detached: true, stdio: 'ignore' }).unref();
      return res.json({ ok: true, methode: 'open', geselecteerd: exists });
    }
    // Linux: try to select the file via the freedesktop standard
    if (exists) {
      const uri = 'file://' + encodeURI(targetPath).replace(/#/g, '%23');
      const dbus = spawnSync('dbus-send', [
        '--session', '--print-reply', '--dest=org.freedesktop.FileManager1',
        '--type=method_call', '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1.ShowItems',
        `array:string:${uri}`, 'string:',
      ], { env, stdio: 'ignore', timeout: 4000 });
      if (dbus.status === 0) return res.json({ ok: true, methode: 'dbus', geselecteerd: true });
    }
    // Fallback (Linux or when dbus fails): open the folder without selection
    spawn('xdg-open', [folderPath], { detached: true, stdio: 'ignore', env }).unref();
    return res.json({ ok: true, methode: 'xdg-open', geselecteerd: false });
  } catch (e) {
    return res.status(500).json({ error: 'could not open file manager', detail: e.message });
  }
});

// === EDIT PHOTO ===

router.put('/photos/:id', (req, res) => {
  const { gps_lat, gps_lon, gps_city, gps_country, gps_country_code, gps_address, photo_date, google_description } = req.body;
  const db = getDb();

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ error: 'Photo not found' }); }

  // Date parsing
  let year = null, month = null, day = null;
  if (photo_date) {
    const d = new Date(photo_date);
    if (!isNaN(d)) { year = d.getFullYear(); month = d.getMonth() + 1; day = d.getDate(); }
  }

  // Use the value that was sent if present (including null = clear); otherwise keep the DB value
  const finalLat         = gps_lat       !== undefined ? gps_lat       : photo.gps_lat;
  const finalLon         = gps_lon       !== undefined ? gps_lon       : photo.gps_lon;
  const finalCity        = gps_city      !== undefined ? gps_city      : photo.gps_city;
  const finalCountry     = gps_country      !== undefined ? gps_country      : photo.gps_country;
  const finalCountryCode = gps_country_code !== undefined ? gps_country_code : photo.gps_country_code;
  const finalAddress     = gps_address     !== undefined ? gps_address     : photo.gps_address;

  db.prepare(`
    UPDATE photos SET
      gps_lat = ?, gps_lon = ?, gps_city = ?, gps_country = ?, gps_country_code = ?, gps_address = ?,
      photo_date = ?, year = ?, month = ?, day = ?,
      google_description = ?
    WHERE id = ?
  `).run(
    finalLat, finalLon, finalCity, finalCountry, finalCountryCode, finalAddress,
    photo_date ?? photo.photo_date,
    year ?? photo.year,
    month ?? photo.month,
    day ?? photo.day,
    google_description ?? photo.google_description,
    req.params.id
  );

  // Propagate the GPS change to all duplicates in the same group
  const hasGpsUpdate = [gps_lat, gps_lon, gps_city, gps_country, gps_country_code, gps_address].some(v => v !== undefined);
  if (hasGpsUpdate && photo.duplicate_group) {
    const dupUpdate = db.prepare(`
      UPDATE photos SET gps_lat = ?, gps_lon = ?, gps_city = ?, gps_country = ?, gps_country_code = ?, gps_address = ?
      WHERE duplicate_group = ? AND id != ?
    `);
    dupUpdate.run(finalLat, finalLon, finalCity, finalCountry, finalCountryCode, finalAddress, photo.duplicate_group, req.params.id);
  }

  const updated = db.prepare(`
    SELECT f.*, b.name as source_name, b.icon as source_icon
    FROM photos f JOIN sources b ON f.source_id = b.id WHERE f.id = ?
  `).get(req.params.id);
  db.close();
  res.json(updated);
});

// Assign GPS to a photo + all duplicates in the same group
router.post('/photos/:id/gps', (req, res) => {
  const { gps_lat, gps_lon, gps_city, gps_country, gps_country_code, gps_address } = req.body;
  if (!gps_lat || !gps_lon) return res.status(400).json({ error: 'gps_lat and gps_lon are required' });

  const db = getDb();
  const photo = db.prepare('SELECT id, duplicate_group FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ error: 'Photo not found' }); }

  const updateGps = db.prepare(`
    UPDATE photos SET gps_lat = ?, gps_lon = ?, gps_city = ?, gps_country = ?, gps_country_code = ?, gps_address = ?
    WHERE id = ?
  `);

  let updatedCount = 0;

  if (photo.duplicate_group) {
    // Assign GPS to all duplicates in the same group
    const duplicates = db.prepare('SELECT id FROM photos WHERE duplicate_group = ?').all(photo.duplicate_group);
    for (const dup of duplicates) {
      updateGps.run(gps_lat, gps_lon, gps_city || null, gps_country || null, gps_country_code || null, gps_address || null, dup.id);
      updatedCount++;
    }
  } else {
    updateGps.run(gps_lat, gps_lon, gps_city || null, gps_country || null, gps_country_code || null, gps_address || null, photo.id);
    updatedCount = 1;
  }

  db.close();
  res.json({ ok: true, updated: updatedCount });
});

// GPS propagation via the scanner function (also shares to originals without gps_lat)
router.post('/scan/gps-propagate', (req, res) => {
  try {
    const updated = propagateGpsInGroups();
    res.json({ ok: true, updated: updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Automatically share GPS within all duplicate groups
router.post('/duplicates/gps-share', (req, res) => {
  const db = getDb();

  // Find all groups where at least one photo has GPS
  const groups = db.prepare(`
    SELECT duplicate_group, MAX(gps_lat) as lat, MAX(gps_lon) as lon,
           MAX(gps_city) as city, MAX(gps_country) as country,
           MAX(gps_country_code) as land_code, MAX(gps_address) as adres
    FROM photos
    WHERE duplicate_group IS NOT NULL AND gps_lat IS NOT NULL
      AND gps_country IS NOT NULL AND gps_country != ''
    GROUP BY duplicate_group
  `).all();

  const update = db.prepare(`
    UPDATE photos SET gps_lat = ?, gps_lon = ?, gps_city = ?, gps_country = ?,
                     gps_country_code = ?, gps_address = ?
    WHERE duplicate_group = ? AND (gps_country IS NULL OR gps_country = '')
  `);

  let totalUpdated = 0;
  for (const g of groups) {
    const info = update.run(g.lat, g.lon, g.city, g.country, g.land_code, g.adres, g.duplicate_group);
    totalUpdated += info.changes;
  }

  db.close();
  console.log(`🌍 GPS shared: ${totalUpdated} photos updated in ${groups.length} groups`);
  res.json({ ok: true, updated: totalUpdated, groups: groups.length });
});

// Restore the date for photos without one — via filename or file creation date
router.post('/photos/restore-date', (req, res) => {
  const db = getDb();
  const withoutDate = db.prepare("SELECT id, filename, full_path FROM photos WHERE photo_date IS NULL").all();

  let updated = 0;
  const update = db.prepare("UPDATE photos SET photo_date = ?, year = ?, month = ?, day = ? WHERE id = ?");

  for (const photo of withoutDate) {
    // Step 1: date from the filename
    let date = parseDateFromFilename(photo.filename);

    // Step 2: file creation date (birthtime or mtime)
    if (!date) {
      try {
        const stat = require('fs').statSync(photo.full_path);
        date = (stat.birthtime || stat.mtime).toISOString();
      } catch (_) {}
    }

    if (date) {
      const d = new Date(date);
      update.run(date, d.getFullYear(), d.getMonth() + 1, d.getDate(), photo.id);
      updated++;
    }
  }

  db.close();
  console.log(`📅 Date restored: ${updated} / ${withoutDate.length} photos updated`);
  res.json({ ok: true, total: withoutDate.length, updated: updated });
});

function parseDateFromFilename(name) {
  const match = name.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00.000Z`;
}

// === DUPLICATES ===

router.get('/duplicates', (req, res) => {
  const db = getDb();
  const { page = 1, per_page = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(per_page);

  const groups = db.prepare(`
    SELECT duplicate_group, COUNT(*) as count,
           MIN(photo_date) as date, MIN(filename) as voorbeeld_naam
    FROM photos WHERE duplicate_group IS NOT NULL
    GROUP BY duplicate_group
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(per_page), offset);

  const totalGroups = db.prepare(`
    SELECT COUNT(*) as n FROM (
      SELECT duplicate_group FROM photos WHERE duplicate_group IS NOT NULL
      GROUP BY duplicate_group HAVING COUNT(*) > 1
    )
  `).get().n;

  // Fetch the photos per group
  const result = groups.map(group => {
    const photos = db.prepare(`
      SELECT f.id, f.filename, f.full_path, f.file_size,
             f.photo_date, f.thumbnail, f.source_id, f.gps_lat, f.gps_city, f.gps_country,
             b.name as source_name, b.icon as source_icon, b.type as source_type
      FROM photos f JOIN sources b ON f.source_id = b.id
      WHERE f.duplicate_group = ?
    `).all(group.duplicate_group);
    return { ...group, photos: photos };
  });

  db.close();
  res.json({ groups: result, totaal_groepen: totalGroups, page: parseInt(page) });
});

// Determine which copy in a duplicate group is the original (= kept one).
// Delegates to the shared keeper logic (src/keeper.js) so that backend,
// export AND frontend make exactly the same choice. required=false: returns
// null ("choice needed") when no source in the group has been ranked —
// the deletion flow then safely skips such groups.
function determineOriginal(photos, sourceOrder, manualId) {
  return determineKeeper(photos, sourceOrder, manualId, { required: false });
}

// Collect per group the keeper + copies to delete, based on priority/manual choice.
// groupFilter (optional): only process this hash.
function collectDuplicatePlan(db, sourceOrder, manual, groupFilter) {
  const where = groupFilter
    ? 'WHERE f.duplicate_group = ?'
    : 'WHERE f.duplicate_group IS NOT NULL';
  const rows = groupFilter
    ? db.prepare(`SELECT f.id, f.source_id, f.duplicate_group, f.full_path, f.file_size FROM photos f ${where}`).all(groupFilter)
    : db.prepare(`SELECT f.id, f.source_id, f.duplicate_group, f.full_path, f.file_size FROM photos f ${where}`).all();

  const perGroup = new Map();
  for (const r of rows) {
    if (!perGroup.has(r.duplicate_group)) perGroup.set(r.duplicate_group, []);
    perGroup.get(r.duplicate_group).push(r);
  }

  const toDelete = [];          // photo objects headed for the trash
  let choiceNeeded = 0;         // number of groups that still require a choice
  let groupsReady = 0;
  for (const [group, photos] of perGroup) {
    const keeper = determineOriginal(photos, sourceOrder, manual ? manual[group] : undefined);
    if (keeper == null) { choiceNeeded++; continue; }
    groupsReady++;
    for (const f of photos) if (f.id !== keeper) toDelete.push(f);
  }
  return { toDelete, choiceNeeded, groupsReady };
}

// Clean up duplicate leftovers: if a group has <= 1 photo left, that photo is
// no longer a duplicate → is_duplicate=0 and duplicate_group=NULL.
// groups: array of duplicate_group hashes that may need cleaning up.
function cleanupDuplicateGroups(db, groups) {
  let cleaned = 0;
  const unique = [...new Set((groups || []).filter(Boolean))];
  const countPrep = db.prepare('SELECT COUNT(*) as n FROM photos WHERE duplicate_group = ?');
  const clearPrep = db.prepare('UPDATE photos SET is_duplicate = 0, duplicate_group = NULL WHERE duplicate_group = ?');
  for (const g of unique) {
    if (countPrep.get(g).n <= 1) cleaned += clearPrep.run(g).changes;
  }
  return cleaned;
}

// Determine the priority to use for a request.
// - Does the priority come along in the body? Use it AND store it in the DB (sync).
// - Otherwise: read the stored priority from the DB.
// This keeps frontend (localStorage) and backend/export always consistent.
function resolvePriority(db, body) {
  const hasSource = body && Array.isArray(body.sourceOrder);
  const hasManual = body && body.manual && typeof body.manual === 'object';
  if (hasSource || hasManual) {
    writePriority(db, hasSource ? body.sourceOrder : undefined, hasManual ? body.manual : undefined);
  }
  return readPriority(db);
}

// === DUPLICATE PRIORITY (shared between frontend and backend) ===

router.get('/duplicates/priority', (req, res) => {
  const db = getDb();
  try {
    res.json(readPriority(db));
  } finally {
    db.close();
  }
});

router.post('/duplicates/priority', (req, res) => {
  const db = getDb();
  try {
    const { sourceOrder, manual } = req.body || {};
    writePriority(db, sourceOrder, manual);
    res.json({ ok: true, ...readPriority(db) });
  } catch (e) {
    res.status(500).json({ error: 'save failed', detail: e.message });
  } finally {
    db.close();
  }
});

// Preview of what would be deleted (for the confirmation) — deletes nothing.
router.post('/duplicates/delete-preview', (req, res) => {
  const db = getDb();
  try {
    const { group = null } = req.body || {};
    const { sourceOrder, manual } = resolvePriority(db, req.body);
    const { toDelete, choiceNeeded, groupsReady } = collectDuplicatePlan(db, sourceOrder, manual, group);
    const bytes = toDelete.reduce((s, f) => s + (f.file_size || 0), 0);
    db.close();
    res.json({ ok: true, bestanden: toDelete.length, bytes, groupsReady: groupsReady, choiceNeeded: choiceNeeded });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ error: 'preview failed', detail: e.message });
  }
});

// Delete the duplicates (all copies except the original) → trash + out of the database.
// Groups that still require a choice are skipped.
router.post('/duplicates/delete', async (req, res) => {
  const db = getDb();
  try {
    const { group = null } = req.body || {};
    const { sourceOrder, manual } = resolvePriority(db, req.body);
    const { toDelete, choiceNeeded } = collectDuplicatePlan(db, sourceOrder, manual, group);

    if (toDelete.length === 0) {
      db.close();
      return res.json({ ok: true, deleted: 0, movedToTrash: 0, bytesVrij: 0, skipped: choiceNeeded });
    }

    // Split existing vs. already missing files
    const existing = [], missingIds = [];
    for (const f of toDelete) {
      if (f.full_path && fs.existsSync(f.full_path)) existing.push(f);
      else missingIds.push(f.id);
    }

    let trash;
    try { trash = require('trash'); }
    catch (e) { db.close(); return res.status(500).json({ error: 'trash module not available', detail: e.message }); }

    const trashedIds = [];
    let freedBytes = 0;
    if (existing.length) {
      try {
        await trash(existing.map(f => f.full_path));
        for (const f of existing) { trashedIds.push(f.id); freedBytes += f.file_size || 0; }
      } catch (batchErr) {
        for (const f of existing) {
          try { await trash(f.full_path); trashedIds.push(f.id); freedBytes += f.file_size || 0; }
          catch (_) { /* skip this file */ }
        }
      }
    }

    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM photos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up keeper(s) of affected groups: no copy left = no longer a duplicate
    const removedSet = new Set(toRemove);
    const affectedGroups = toDelete.filter(f => removedSet.has(f.id)).map(f => f.duplicate_group);
    cleanupDuplicateGroups(db, affectedGroups);

    db.close();
    res.json({
      ok: true,
      deleted: toRemove.length,
      movedToTrash: trashedIds.length,
      bytesVrij: freedBytes,
      skipped: choiceNeeded
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ error: 'delete failed', detail: e.message });
  }
});

// === CLEAR DATABASE ===

router.post('/database/delete', (req, res) => {
  const db = getDb();
  db.exec(`
    DELETE FROM photos;
    DELETE FROM scan_log;
    UPDATE sources SET total_photos = 0, last_scan = NULL;
    DELETE FROM settings WHERE key IN ('dup_source_order', 'dup_manual');
  `);
  db.close();
  console.log('🗑️  Database cleared by user (sources kept, duplicate priority reset)');
  res.json({ ok: true });
});

// === FOLDER BROWSER ===

router.get('/folders', (req, res) => {
  const dirPath = req.query.path || require('os').homedir();
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders = items
      .filter(i => i.isDirectory() && !i.name.startsWith('.'))
      .map(i => ({ name: i.name, path: path.join(dirPath, i.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null;
    res.json({ current: dirPath, parent: parent, folders: folders });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// === MAP DATA ===

// Serve the thumbnail as a real image (the browser caches this)
router.get('/photos/:id/thumbnail', (req, res) => {
  // Shared, long-lived read connection: this endpoint is called ~50x per page;
  // opening a new connection every time made the app freeze.
  const db = getSharedDb();
  const photo = db.prepare('SELECT thumbnail FROM photos WHERE id = ?').get(req.params.id);
  if (!photo?.thumbnail) return res.status(404).send('No thumbnail');
  const [header, b64] = photo.thumbnail.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(b64, 'base64'));
});

// Location clusters for the map (grouped on a ~1km grid)
router.get('/map/locations', (req, res) => {
  const { is_video } = req.query;
  const db = getDb();
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (is_video IS NULL OR is_video = 0)';

  const locations = db.prepare(`
    SELECT
      ROUND(gps_lat, 2) as lat,
      ROUND(gps_lon, 2) as lon,
      MAX(gps_city)      as gps_city,
      MAX(gps_country)      as gps_country,
      MAX(gps_country_code) as gps_country_code,
      MIN(year)          as jaar_min,
      MAX(year)          as jaar_max,
      COUNT(*)           as count,
      SUM(CASE WHEN is_video = 1 THEN 1 ELSE 0 END) as aantal_videos,
      MIN(id)            as voorbeeld_id
    FROM photos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      ${typeFilter}
      AND (duplicate_group IS NULL
           OR id = (SELECT MIN(id) FROM photos f2 WHERE f2.duplicate_group = photos.duplicate_group))
    GROUP BY ROUND(gps_lat, 2), ROUND(gps_lon, 2)
    ORDER BY count DESC
  `).all();
  db.close();
  res.json(locations);
});

// Photos at a specific location (for the slide-up panel)
router.get('/map/photos', (req, res) => {
  const { lat, lon, limit = 40, without_copies = '1', is_video } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  const db = getDb();

  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Keeper set via the shared logic → the kept copy on the map matches the
  // detail view, the duplicates page AND the export.
  const keepers = keeperIds(db);

  const rows = db.prepare(`
    SELECT f.id, f.filename, f.photo_date, f.gps_city, f.gps_country, f.gps_country_code,
           f.is_duplicate, f.is_video, f.duration, f.duplicate_group,
           f.camera_model, b.name as source_name, b.icon as source_icon, b.type as source_type
    FROM photos f JOIN sources b ON f.source_id = b.id
    WHERE ROUND(f.gps_lat, 2) = ROUND(?, 2)
      AND ROUND(f.gps_lon, 2) = ROUND(?, 2)
      ${typeFilter}
    ORDER BY f.photo_date ASC NULLS LAST
  `).all(parseFloat(lat), parseFloat(lon));
  db.close();

  let photos = rows.map(f => ({
    ...f,
    is_original: f.duplicate_group && keepers.has(f.id) ? 1 : 0
  }));
  // Hide copies: show non-duplicates + the kept copy per group
  if (without_copies === '1') {
    photos = photos.filter(f => !f.is_duplicate || f.is_original);
  }
  photos = photos.slice(0, parseInt(limit));
  res.json(photos);
});

// === GPS BULK ASSIGN ===

// GET /api/gps/groups — group photos without GPS by time block (2h gap = new group)
router.get('/gps/groups', (req, res) => {
  const db = getDb();

  // Type filter: '' = everything, '0' = photos only, '1' = videos only
  const { is_video } = req.query;
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Only show originals — copies are updated along via GPS propagation
  const originalFilter = `
    AND (f.duplicate_group IS NULL
      OR f.id = (SELECT MIN(id) FROM photos WHERE duplicate_group = f.duplicate_group))
  `;

  const withDate = db.prepare(`
    SELECT f.id, f.photo_date, f.thumbnail IS NOT NULL as has_thumb
    FROM photos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND f.photo_date IS NOT NULL AND f.photo_date != ''
      ${typeFilter}
      ${originalFilter}
    ORDER BY f.photo_date ASC
  `).all();

  const withoutDate = db.prepare(`
    SELECT f.id, f.thumbnail IS NOT NULL as has_thumb
    FROM photos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND (f.photo_date IS NULL OR f.photo_date = '')
      ${typeFilter}
      ${originalFilter}
    ORDER BY f.id ASC
  `).all();

  db.close();

  const GAP_MS = 2 * 60 * 60 * 1000; // 2 hours
  const groups = [];
  let currentGroup = null;

  for (const photo of withDate) {
    const ts = new Date(photo.photo_date).getTime();
    if (isNaN(ts)) continue;
    if (!currentGroup || ts - currentGroup.lastTs > GAP_MS) {
      currentGroup = { dateStart: photo.photo_date, dateEnd: photo.photo_date, lastTs: ts, ids: [], samples: [] };
      groups.push(currentGroup);
    }
    currentGroup.dateEnd = photo.photo_date;
    currentGroup.lastTs = ts;
    currentGroup.ids.push(photo.id);
    if (currentGroup.samples.length < 6 && photo.has_thumb) currentGroup.samples.push(photo.id);
  }

  const result = groups.map((g, i) => ({
    group_id: i,
    date_start: g.dateStart,
    date_end: g.dateEnd,
    count: g.ids.length,
    ids: g.ids,
    samples: g.samples
  }));

  if (withoutDate.length > 0) {
    result.push({
      group_id: result.length,
      date_start: null,
      date_end: null,
      count: withoutDate.length,
      ids: withoutDate.map(f => f.id),
      samples: withoutDate.filter(f => f.has_thumb).slice(0, 6).map(f => f.id)
    });
  }

  res.json(result);
});

// POST /api/gps/bulk-assign — assign a location to multiple photos + their duplicates
router.post('/gps/bulk-assign', (req, res) => {
  const { ids, gps_city, gps_country, gps_lat, gps_lon, gps_country_code, gps_address } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }
  const db = getDb();

  // Collect all duplicate_group values of the given photos
  const placeholders = ids.map(() => '?').join(',');
  const groups = db.prepare(
    `SELECT DISTINCT duplicate_group FROM photos WHERE id IN (${placeholders}) AND duplicate_group IS NOT NULL`
  ).all(...ids).map(r => r.duplicate_group);

  const gpsFields = [gps_city || null, gps_country || null, gps_lat || null, gps_lon || null, gps_country_code || null, gps_address || null];

  const updateById = db.prepare('UPDATE photos SET gps_city=?, gps_country=?, gps_lat=?, gps_lon=?, gps_country_code=?, gps_address=? WHERE id=?');
  const updateDuplicates = groups.length > 0
    ? db.prepare(`UPDATE photos SET gps_city=?, gps_country=?, gps_lat=?, gps_lon=?, gps_country_code=?, gps_address=? WHERE duplicate_group IN (${groups.map(() => '?').join(',')})`)
    : null;

  const updateAll = db.transaction(() => {
    // Assign to the given photos
    for (const id of ids) updateById.run(...gpsFields, id);
    // Propagate to all duplicates in the same groups
    if (updateDuplicates) updateDuplicates.run(...gpsFields, ...groups);
  });

  updateAll();
  // Count the total updated records (direct + duplicates)
  const total = db.prepare(`SELECT COUNT(*) as n FROM photos WHERE id IN (${placeholders})${groups.length ? ` OR duplicate_group IN (${groups.map(() => '?').join(',')})` : ''}`).get(...ids, ...groups).n;
  db.close();
  res.json({ updated: total, duplicaten_bijgewerkt: groups.length > 0 });
});

// === PHASE ===

router.get('/phase', (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'phase'").get();
  db.close();
  res.json({ phase: parseInt(row?.value || '1') });
});

router.post('/phase', (req, res) => {
  const { phase } = req.body;
  if (![1, 2, 3].includes(phase)) return res.status(400).json({ error: 'phase must be 1, 2 or 3' });
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('phase', ?)").run(String(phase));
  db.close();
  res.json({ phase });
});

// Mark a photo as "location unknown" (and propagate to duplicates)
router.post('/photos/:id/location-unknown', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ error: 'not found' }); }
  db.prepare('UPDATE photos SET location_unknown = 1 WHERE id = ?').run(photo.id);
  if (photo.duplicate_group) {
    db.prepare('UPDATE photos SET location_unknown = 1 WHERE duplicate_group = ?').run(photo.duplicate_group);
  }
  db.close();
  res.json({ ok: true });
});

// Mark a photo as ignored (phase 2) — cascades to all duplicates in the same group
router.post('/photos/:id/ignore', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ error: 'not found' }); }
  const value = req.body.ignored !== false ? 1 : 0;

  // Always set the clicked photo
  db.prepare('UPDATE photos SET ignored = ? WHERE id = ?').run(value, photo.id);

  // If the photo is part of a duplicate group: cascade to all group members
  let changedCount = 1;
  if (photo.duplicate_group) {
    const result = db.prepare(
      'UPDATE photos SET ignored = ? WHERE duplicate_group = ? AND id != ?'
    ).run(value, photo.duplicate_group, photo.id);
    changedCount += result.changes;
  }

  db.close();
  res.json({ ok: true, ignored: value === 1, changedCount: changedCount });
});

// Bulk: mark multiple photos at once as ignored / not ignored (phase C batch).
// Body: { ids: [..], ignored: true|false }. Cascades per photo over the duplicate
// group, so an entire group is consistently ignored along (same rule as /photos/:id/ignore).
router.post('/photos/ignore-bulk', (req, res) => {
  const db = getDb();
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) { return res.status(400).json({ error: 'no ids' }); }
    const value = req.body.ignored !== false ? 1 : 0;

    const setPhoto = db.prepare('UPDATE photos SET ignored = ? WHERE id = ?');
    const setGroup = db.prepare('UPDATE photos SET ignored = ? WHERE duplicate_group = ? AND id != ?');
    const getPhoto = db.prepare('SELECT id, duplicate_group FROM photos WHERE id = ?');

    let changedCount = 0;
    const tx = db.transaction(() => {
      for (const id of ids) {
        const photo = getPhoto.get(id);
        if (!photo) continue;
        setPhoto.run(value, photo.id);
        changedCount += 1;
        if (photo.duplicate_group) {
          changedCount += setGroup.run(value, photo.duplicate_group, photo.id).changes;
        }
      }
    });
    tx();

    res.json({ ok: true, ignored: value === 1, requestedCount: ids.length, changedCount: changedCount });
  } finally {
    db.close();
  }
});

// Permanently remove ALL ignored photos: to trash + out of the database
// - selects all ignored=1 photos
// - cascade: the entire duplicate group of every ignored photo is included
// - files go to the system trash (recoverable), not permanently deleted
// - DB records are removed so they won't be scanned again
router.post('/ignored/delete', async (req, res) => {
  const db = getDb();
  try {
    // 1. All ignored photos
    const ignored = db.prepare('SELECT id, full_path, duplicate_group FROM photos WHERE ignored = 1').all();

    // 2. Cascade: add all members of the affected duplicate groups
    const groups = [...new Set(ignored.map(f => f.duplicate_group).filter(Boolean))];
    const idMap = new Map();
    for (const f of ignored) idMap.set(f.id, f);
    if (groups.length) {
      const ph = groups.map(() => '?').join(',');
      const members = db.prepare(
        `SELECT id, full_path, duplicate_group FROM photos WHERE duplicate_group IN (${ph})`
      ).all(...groups);
      for (const f of members) idMap.set(f.id, f);
    }

    const all = [...idMap.values()];
    if (all.length === 0) {
      db.close();
      return res.json({ ok: true, deleted: 0, movedToTrash: 0, missing: 0 });
    }

    // 3. Split into files that still exist vs. already missing
    const existing = [];
    const missingIds = [];
    for (const f of all) {
      if (f.full_path && fs.existsSync(f.full_path)) existing.push(f);
      else missingIds.push(f.id);
    }

    // 4. Move existing files to the trash
    let trash;
    try {
      trash = require('trash');
    } catch (e) {
      db.close();
      return res.status(500).json({ error: 'trash module not available', detail: e.message });
    }

    const trashedIds = [];
    const failed = [];
    if (existing.length) {
      try {
        // Batch: everything to the trash in one go
        await trash(existing.map(f => f.full_path));
        for (const f of existing) trashedIds.push(f.id);
      } catch (batchErr) {
        // Fallback: file by file, so one error doesn't lose everything
        for (const f of existing) {
          try { await trash(f.full_path); trashedIds.push(f.id); }
          catch (e) { failed.push({ id: f.id, path: f.full_path, error: e.message }); }
        }
      }
    }

    // 5. Remove DB records: everything trashed + everything already missing
    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM photos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up any leftovers of the affected groups (e.g. after a failed trash)
    cleanupDuplicateGroups(db, groups);

    db.close();
    res.json({
      ok: true,
      deleted: toRemove.length,
      movedToTrash: trashedIds.length,
      missing: missingIds.length,
      failed: failed
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ error: 'delete failed', detail: e.message });
  }
});

// Permanently remove ONE photo: file to trash + DB record gone
// (recoverable via the system trash, not permanently deleted)
router.post('/photos/:id/delete', async (req, res) => {
  const db = getDb();
  try {
    const photo = db.prepare('SELECT id, full_path, duplicate_group FROM photos WHERE id = ?').get(req.params.id);
    if (!photo) { db.close(); return res.status(404).json({ error: 'not found' }); }

    let trashed = false;
    if (photo.full_path && fs.existsSync(photo.full_path)) {
      let trash;
      try { trash = require('trash'); }
      catch (e) { db.close(); return res.status(500).json({ error: 'trash module not available', detail: e.message }); }
      try { await trash(photo.full_path); trashed = true; }
      catch (e) { db.close(); return res.status(500).json({ error: 'could not move file to trash', detail: e.message }); }
    }

    db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
    // Clean up the remainder of the duplicate group: 1 left = no longer a duplicate
    if (photo.duplicate_group) cleanupDuplicateGroups(db, [photo.duplicate_group]);
    db.close();
    res.json({ ok: true, movedToTrash: trashed, missing: !trashed });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ error: 'delete failed', detail: e.message });
  }
});

// Permanently remove a LIST of photos in one go: files to trash + DB records gone
// Used a.o. by the GPS-assign page to delete a whole group of bad photos at once.
// - cascade: the entire duplicate group of every photo is included (same rule as /ignored/delete)
// - files go to the system trash (recoverable), never permanently deleted
// - DB records are removed so they won't be scanned again
router.post('/photos/delete-bulk', async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'no ids provided' });

  const db = getDb();
  try {
    // 1. Fetch the requested photos
    const ph0 = ids.map(() => '?').join(',');
    const requested = db.prepare(
      `SELECT id, full_path, duplicate_group FROM photos WHERE id IN (${ph0})`
    ).all(...ids);

    // 2. Cascade: add all members of the affected duplicate groups
    const groups = [...new Set(requested.map(f => f.duplicate_group).filter(Boolean))];
    const idMap = new Map();
    for (const f of requested) idMap.set(f.id, f);
    if (groups.length) {
      const ph = groups.map(() => '?').join(',');
      const members = db.prepare(
        `SELECT id, full_path, duplicate_group FROM photos WHERE duplicate_group IN (${ph})`
      ).all(...groups);
      for (const f of members) idMap.set(f.id, f);
    }

    const all = [...idMap.values()];
    if (all.length === 0) {
      db.close();
      return res.json({ ok: true, deleted: 0, movedToTrash: 0, missing: 0 });
    }

    // 3. Split into files that still exist vs. already missing
    const existing = [];
    const missingIds = [];
    for (const f of all) {
      if (f.full_path && fs.existsSync(f.full_path)) existing.push(f);
      else missingIds.push(f.id);
    }

    // 4. Move existing files to the trash
    let trash;
    try {
      trash = require('trash');
    } catch (e) {
      db.close();
      return res.status(500).json({ error: 'trash module not available', detail: e.message });
    }

    const trashedIds = [];
    const failed = [];
    if (existing.length) {
      try {
        await trash(existing.map(f => f.full_path));
        for (const f of existing) trashedIds.push(f.id);
      } catch (batchErr) {
        for (const f of existing) {
          try { await trash(f.full_path); trashedIds.push(f.id); }
          catch (e) { failed.push({ id: f.id, path: f.full_path, error: e.message }); }
        }
      }
    }

    // 5. Remove DB records: everything trashed + everything already missing
    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM photos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up any leftovers of the affected groups
    cleanupDuplicateGroups(db, groups);

    db.close();
    res.json({
      ok: true,
      deleted: toRemove.length,
      movedToTrash: trashedIds.length,
      missing: missingIds.length,
      failed: failed
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ error: 'delete failed', detail: e.message });
  }
});

// Stats for the phase 1 todo
router.get('/phase1/todo', (req, res) => {
  const db = getDb();
  const zonderLocatie = db.prepare(`
    SELECT COUNT(*) as n FROM photos
    WHERE gps_lat IS NULL AND gps_city IS NULL
      AND (location_unknown IS NULL OR location_unknown = 0)
      AND (duplicate_group IS NULL OR id = (SELECT MIN(id) FROM photos f2 WHERE f2.duplicate_group = photos.duplicate_group))
  `).get().n;
  db.close();
  res.json({ zonderLocatie });
});

// === PHASE 3: EXPORT ===

// Calculate what will be exported (preview)
router.get('/export/preview', (req, res) => {
  const target_folder = req.query.target_folder || '';
  try {
    const preview = calculatePreview(target_folder || null);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the export
router.post('/export/start', async (req, res) => {
  const { target_folder } = req.body;
  if (!target_folder) return res.status(400).json({ error: 'target folder is required' });
  try {
    const result = await startExport(target_folder);
    if (result.error) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch the export status (polling)
router.get('/export/status', (req, res) => {
  res.json(getExportStatus());
});

// Stop the export
router.post('/export/stop', (req, res) => {
  res.json(stopExport());
});

// Reset the export (after completion or an error)
router.post('/export/reset', (req, res) => {
  res.json(resetExport());
});

module.exports = router;
