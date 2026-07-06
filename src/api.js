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
router.get('/versie', (req, res) => {
  let version = '';
  try { version = require('../package.json').version || ''; } catch (_) {}
  res.json({ versie: version });
});

// === SOURCES ===

router.get('/bronnen', (req, res) => {
  const db = getDb();
  const sources = db.prepare(`
    SELECT b.*,
      sl.gestart as scan_gestart,
      sl.voltooid as scan_voltooid,
      ROUND((JULIANDAY(sl.voltooid) - JULIANDAY(sl.gestart)) * 86400) as scan_duur_seconden
    FROM bronnen b
    LEFT JOIN scan_log sl ON sl.id = (
      SELECT id FROM scan_log WHERE bron_id = b.id AND status = 'voltooid' ORDER BY id DESC LIMIT 1
    )
    ORDER BY b.aangemaakt_op DESC
  `).all();
  db.close();
  res.json(sources);
});

router.post('/bronnen', (req, res) => {
  const { naam, type, pad, icoon, verborgen_meenemen } = req.body;
  if (!naam || !pad) return res.status(400).json({ fout: 'name and path are required' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO bronnen (naam, type, pad, icoon, verborgen_meenemen) VALUES (?, ?, ?, ?, ?)
  `).run(naam, type || 'pc', pad, icoon || '💻', verborgen_meenemen ? 1 : 0);
  const source = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.json(source);
});

router.put('/bronnen/:id', (req, res) => {
  const { naam, pad, type, icoon, verborgen_meenemen } = req.body;
  const db = getDb();
  db.prepare('UPDATE bronnen SET naam = ?, pad = ?, type = ?, icoon = ?, verborgen_meenemen = ? WHERE id = ?')
    .run(naam, pad, type, icoon, verborgen_meenemen ? 1 : 0, req.params.id);
  const source = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(req.params.id);
  db.close();
  res.json(source);
});

// Quick toggle from the source card: only the "scan hidden folders" flag
router.patch('/bronnen/:id/verborgen', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE bronnen SET verborgen_meenemen = ? WHERE id = ?')
    .run(req.body.verborgen_meenemen ? 1 : 0, req.params.id);
  const source = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(req.params.id);
  db.close();
  res.json(source);
});

router.delete('/bronnen/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM fotos WHERE bron_id = ?').run(req.params.id);
  db.prepare('DELETE FROM bronnen WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

// === SCAN ===

router.post('/scan/:bronId', async (req, res) => {
  try {
    // By default the setting comes from the source itself; an explicit flag in
    // the body can override it per scan (otherwise the scanner falls back to the source).
    const hasFlag = req.body && req.body.verborgenMeenemen !== undefined;
    const options = hasFlag ? { includeHidden: !!req.body.verborgenMeenemen } : {};
    const status = await startScan(parseInt(req.params.bronId), options);
    res.json(status);
  } catch (e) {
    res.status(400).json({ fout: e.message });
  }
});

router.get('/scan/status', (req, res) => {
  res.json(getScanStatus());
});

router.post('/scan/stop', (req, res) => {
  stopScan(true); // also empties the queue
  res.json({ ok: true });
});

router.delete('/scan/wachtrij/:bronId', (req, res) => {
  removeFromQueue(parseInt(req.params.bronId));
  res.json(getScanStatus());
});

router.get('/scan/geocode', (req, res) => {
  res.json(getGeocodeStatus());
});

router.post('/scan/geocode', async (req, res) => {
  startGeocodePass(); // starts in the background, returns immediately
  res.json({ ok: true, bericht: 'Geocode pass started' });
});

// Stops only the geocode background pass — a running scan keeps going.
router.post('/scan/geocode/stop', (req, res) => {
  stopGeocode();
  res.json({ ok: true, bericht: 'Geocode pass stop requested' });
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

  const totaal      = db.prepare('SELECT COUNT(*) as n FROM fotos').get().n;
  const totaalFotos = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0) = 0').get().n;
  const totaalVideos= db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video = 1').get().n;
  const metGps     = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE gps_lat IS NOT NULL AND gps_lat != 0').get().n;
  const zonderGps  = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE gps_lat IS NULL OR gps_lat = 0').get().n;
  const duplicaten = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_duplicaat = 1').get().n;
  const duplicaatGroepen = db.prepare('SELECT COUNT(DISTINCT duplicaat_groep) as n FROM fotos WHERE duplicaat_groep IS NOT NULL').get().n;
  const totalGrootte = db.prepare('SELECT SUM(bestandsgrootte) as n FROM fotos').get().n || 0;

  // Photo-specific
  const fotosUniek     = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND COALESCE(is_duplicaat,0)=0').get().n;
  const fotosDubbel    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND is_duplicaat=1').get().n;
  const fotosMetGps    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND gps_lat IS NOT NULL AND gps_lat!=0').get().n;
  const fotosZonderGps = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND (gps_lat IS NULL OR gps_lat=0)').get().n;

  // Video-specific
  const videosUniek     = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video=1 AND COALESCE(is_duplicaat,0)=0').get().n;
  const videosDubbel    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video=1 AND is_duplicaat=1').get().n;
  const videosMetGps    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video=1 AND gps_lat IS NOT NULL AND gps_lat!=0').get().n;
  const videosZonderGps = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video=1 AND (gps_lat IS NULL OR gps_lat=0)').get().n;

  const perJaarVideo = db.prepare('SELECT jaar, COUNT(*) as aantal FROM fotos WHERE is_video=1 AND jaar IS NOT NULL GROUP BY jaar ORDER BY jaar').all();

  const perBron = db.prepare(`
    SELECT b.id as bron_id, b.naam, b.icoon, COUNT(f.id) as aantal, SUM(f.bestandsgrootte) as grootte
    FROM bronnen b LEFT JOIN fotos f ON b.id = f.bron_id
    GROUP BY b.id
  `).all();

  const perJaar = db.prepare(`
    SELECT jaar, COUNT(*) as aantal FROM fotos
    WHERE jaar IS NOT NULL GROUP BY jaar ORDER BY jaar
  `).all();

  const perCamera = db.prepare(`
    SELECT camera_merk, camera_model, COUNT(*) as aantal FROM fotos
    WHERE camera_merk IS NOT NULL AND COALESCE(is_video,0)=0
    GROUP BY camera_merk, camera_model ORDER BY aantal DESC LIMIT 10
  `).all();

  const perCameraVideo = db.prepare(`
    SELECT camera_merk, camera_model, COUNT(*) as aantal FROM fotos
    WHERE camera_merk IS NOT NULL AND is_video=1
    GROUP BY camera_merk, camera_model ORDER BY aantal DESC LIMIT 10
  `).all();

  const perLand = db.prepare(`
    SELECT gps_land, MAX(gps_land_code) as gps_land_code, COUNT(*) as aantal FROM fotos
    WHERE gps_land IS NOT NULL AND gps_land != '' AND COALESCE(is_video,0)=0
    GROUP BY gps_land ORDER BY aantal DESC LIMIT 10
  `).all();

  const perLandVideo = db.prepare(`
    SELECT gps_land, MAX(gps_land_code) as gps_land_code, COUNT(*) as aantal FROM fotos
    WHERE gps_land IS NOT NULL AND gps_land != '' AND is_video=1
    GROUP BY gps_land ORDER BY aantal DESC LIMIT 10
  `).all();

  db.close();

  res.json({
    totaal, totaalFotos, totaalVideos,
    metGps, zonderGps, duplicaten, duplicaatGroepen,
    fotosUniek, fotosDubbel, fotosMetGps, fotosZonderGps,
    videosUniek, videosDubbel, videosMetGps, videosZonderGps,
    totalGrootte, perBron, perJaar, perJaarVideo, perCamera, perCameraVideo, perLand, perLandVideo
  });
});

// === CLEANUP DASHBOARD ===
// Overview of space that can be freed: duplicate copies (based on the stored
// keeper priority) + ignored files. Read-only.
router.get('/opschoon/overzicht', (req, res) => {
  const db = getDb();
  try {
    const { bronVolgorde, handmatig } = readPriority(db);
    const plan = collectDuplicatePlan(db, bronVolgorde, handmatig);
    const dupBytes = plan.toDelete.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);

    const ignored = db.prepare(
      'SELECT COUNT(*) as n, COALESCE(SUM(bestandsgrootte), 0) as bytes FROM fotos WHERE genegeerd = 1'
    ).get();

    res.json({
      duplicaten: {
        bestanden: plan.toDelete.length,     // copies that can already be removed
        bytes: dupBytes,
        groepenKlaar: plan.groupsReady,      // groups with a chosen keeper
        keuzeNodig: plan.choiceNeeded        // groups that still require a choice
      },
      genegeerd: {
        bestanden: ignored.n,
        bytes: ignored.bytes
      },
      totaalVrijTeMaken: dupBytes + ignored.bytes
    });
  } catch (e) {
    res.status(500).json({ fout: 'overview failed', detail: e.message });
  } finally {
    db.close();
  }
});

// === WRAPPED / PHOTO LIFE (shareable summary screen) ===
// Variable names double as response field names (frontend contract) — keep as-is.
router.get('/wrapped', (req, res) => {
  const db = getDb();

  const totaalFotos  = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0').get().n;
  const totaalVideos = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE is_video=1').get().n;
  const aantalLanden = db.prepare("SELECT COUNT(DISTINCT gps_land) as n FROM fotos WHERE gps_land IS NOT NULL AND gps_land != ''").get().n;
  const aantalSteden = db.prepare("SELECT COUNT(DISTINCT gps_stad) as n FROM fotos WHERE gps_stad IS NOT NULL AND gps_stad != ''").get().n;
  const metGps       = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE gps_lat IS NOT NULL AND gps_lat != 0').get().n;
  const totalGrootte = db.prepare('SELECT SUM(bestandsgrootte) as n FROM fotos').get().n || 0;

  const topJaar = db.prepare(`
    SELECT jaar, COUNT(*) as aantal FROM fotos
    WHERE jaar IS NOT NULL GROUP BY jaar ORDER BY aantal DESC LIMIT 1
  `).get() || null;

  const druksteMaand = db.prepare(`
    SELECT jaar, maand, COUNT(*) as aantal FROM fotos
    WHERE jaar IS NOT NULL AND maand IS NOT NULL
    GROUP BY jaar, maand ORDER BY aantal DESC LIMIT 1
  `).get() || null;

  const reeks = db.prepare('SELECT MIN(jaar) as van, MAX(jaar) as tot FROM fotos WHERE jaar IS NOT NULL').get() || { van: null, tot: null };

  const topLanden = db.prepare(`
    SELECT gps_land, MAX(gps_land_code) as gps_land_code, COUNT(*) as aantal FROM fotos
    WHERE gps_land IS NOT NULL AND gps_land != ''
    GROUP BY gps_land ORDER BY aantal DESC LIMIT 5
  `).all();

  db.close();

  res.json({
    totaalFotos, totaalVideos, aantalLanden, aantalSteden,
    metGps, totalGrootte, topJaar, druksteMaand, reeks, topLanden
  });
});

// === PHOTOS ===

router.get('/fotos', (req, res) => {
  const db = getDb();
  const { pagina = 1, per_pagina = 50, bron_id, jaar, zoek, zonder_thumbnail, land, camera_merk, camera_model, zonder_kopien, zonder_gps, met_gps, alleen_dubbel, alleen_uniek, genegeerd, is_video } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(per_pagina);

  let where = '1=1';
  const params = [];

  if (bron_id)      { where += ' AND f.bron_id = ?';      params.push(bron_id); }
  if (jaar)         { where += ' AND f.jaar = ?';          params.push(jaar); }
  if (land)         { where += ' AND f.gps_land = ?';      params.push(land); }
  if (camera_merk)  { where += ' AND f.camera_merk = ?';   params.push(camera_merk); }
  if (camera_model) { where += ' AND f.camera_model = ?';  params.push(camera_model); }
  if (zoek) {
    // Text search across name, location (city + country) and camera (brand + model)
    where += ' AND (f.bestandsnaam LIKE ? OR f.gps_stad LIKE ? OR f.gps_land LIKE ? OR f.camera_merk LIKE ? OR f.camera_model LIKE ?)';
    const q = `%${zoek}%`;
    params.push(q, q, q, q, q);
  }
  if (zonder_gps === '1') { where += ' AND (f.gps_lat IS NULL OR f.gps_lat = 0)'; }
  if (met_gps === '1')    { where += ' AND f.gps_lat IS NOT NULL AND f.gps_lat != 0'; }
  if (alleen_dubbel === '1') { where += ' AND f.is_duplicaat = 1'; }
  if (alleen_uniek === '1')  { where += ' AND COALESCE(f.is_duplicaat,0) = 0'; }
  if (genegeerd === '1')  { where += ' AND f.genegeerd = 1'; }
  if (genegeerd === '0')  { where += ' AND (f.genegeerd IS NULL OR f.genegeerd = 0)'; }
  if (is_video === '1')   { where += ' AND f.is_video = 1'; }
  if (is_video === '0')   { where += ' AND (f.is_video IS NULL OR f.is_video = 0)'; }

  // Hide copies: show the best copy per group that also matches active filters.
  // When a country/camera filter is active: pick the best copy WITH that country,
  // so originals without GPS data don't block the copy that has GPS data.
  if (zonder_kopien === '1') {
    const countrySubquery = land         ? ' AND f2.gps_land = ?'        : '';
    const brandSubquery   = camera_merk  ? ' AND f2.camera_merk = ?'     : '';
    const modelSubquery   = camera_model ? ' AND f2.camera_model = ?'    : '';

    where += ` AND (
      f.is_duplicaat = 0
      OR f.id = (
        SELECT f2.id FROM fotos f2
        JOIN bronnen b2 ON f2.bron_id = b2.id
        WHERE f2.duplicaat_groep = f.duplicaat_groep${countrySubquery}${brandSubquery}${modelSubquery}
        ORDER BY CASE b2.type WHEN 'pc' THEN 1 WHEN 'gsm' THEN 2 WHEN 'usb' THEN 3 ELSE 4 END, f2.id ASC
        LIMIT 1
      )
    )`;

    if (land)         params.push(land);
    if (camera_merk)  params.push(camera_merk);
    if (camera_model) params.push(camera_model);
  }

  const columns = zonder_thumbnail === '1'
    ? 'f.id, f.bestandsnaam, f.volledig_pad, f.bestandsgrootte, f.bestandstype, f.datum_foto, f.jaar, f.maand, f.dag, f.gps_lat, f.gps_lon, f.gps_stad, f.gps_land, f.camera_merk, f.camera_model, f.is_duplicaat, f.duplicaat_groep, f.is_video, f.duur, f.geexporteerd, (f.thumbnail IS NOT NULL) as heeft_thumbnail, b.naam as bron_naam, b.icoon as bron_icoon'
    : 'f.*, (f.thumbnail IS NOT NULL) as heeft_thumbnail, b.naam as bron_naam, b.icoon as bron_icoon';

  const photos = db.prepare(`
    SELECT ${columns} FROM fotos f
    JOIN bronnen b ON f.bron_id = b.id
    WHERE ${where}
    ORDER BY f.datum_foto DESC NULLS LAST, f.datum_bestand DESC
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(per_pagina), offset]);

  const total = db.prepare(`SELECT COUNT(*) as n FROM fotos f WHERE ${where}`).get(params).n;

  db.close();
  res.json({ fotos: photos, totaal: total, pagina: parseInt(pagina), per_pagina: parseInt(per_pagina) });
});

router.get('/fotos/:id', (req, res) => {
  const db = getDb();
  const photo = db.prepare(`
    SELECT f.*, b.naam as bron_naam, b.icoon as bron_icoon
    FROM fotos f JOIN bronnen b ON f.bron_id = b.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ fout: 'Photo not found' }); }

  // If duplicate: fetch all copies (including the current one) to determine the original
  let duplicateLocations = [];
  let isOriginal = false;

  if (photo.duplicaat_groep) {
    const allCopies = db.prepare(`
      SELECT f.id, f.bron_id, f.volledig_pad, f.bestandsgrootte, b.naam as bron_naam, b.icoon as bron_icoon, b.type as bron_type
      FROM fotos f JOIN bronnen b ON f.bron_id = b.id
      WHERE f.duplicaat_groep = ?
    `).all(photo.duplicaat_groep);

    // Determine the kept copy via the shared keeper logic (same choice as the
    // duplicates page AND the export). required=true: there is always exactly
    // one kept copy, even when no source has been ranked yet.
    const { bronVolgorde, handmatig } = readPriority(db);
    const originalId = determineKeeper(allCopies, bronVolgorde, handmatig[photo.duplicaat_groep], { required: true });
    isOriginal = photo.id === originalId;

    // Other locations = all copies except the current one
    duplicateLocations = allCopies
      .filter(e => e.id !== photo.id)
      .map(e => ({ ...e, is_origineel: e.id === originalId }));
  }

  db.close();
  res.json({ ...photo, duplicaat_locaties: duplicateLocations, is_origineel: isOriginal });
});

// Serve the original photo/video with Range support (for video streaming)
router.get('/fotos/:id/bestand', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT volledig_pad, bestandstype, is_video FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo || !fs.existsSync(photo.volledig_pad)) {
    return res.status(404).json({ fout: 'File not found' });
  }

  // Videos: send with Range support so the browser can seek and stream
  if (photo.is_video) {
    const ext = path.extname(photo.volledig_pad).toLowerCase();
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
    const stat = fs.statSync(photo.volledig_pad);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(photo.volledig_pad, { start, end });
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
      fs.createReadStream(photo.volledig_pad).pipe(res);
    }
    return;
  }

  // Photos: plain sendFile
  res.sendFile(photo.volledig_pad);
});

// Open a file in the system player — in the foreground, on the screen where the mouse is
router.post('/fotos/:id/open-extern', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT volledig_pad FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo || !fs.existsSync(photo.volledig_pad)) {
    return res.status(404).json({ fout: 'File not found' });
  }

  // Electron: use shell.openPath (works on Windows, Mac AND Linux)
  if (global.electronOpenExternal) {
    global.electronOpenExternal(photo.volledig_pad).then(err => {
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
    const child = spawn('vlc', ['--started-from-file', photo.volledig_pad], {
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
    const child = spawn('xdg-open', [photo.volledig_pad], {
      detached: true, stdio: 'ignore', env,
    });
    child.unref();
  }

  res.json({ ok: true, vlc: vlcAvailable });
});

// Show a file in the file manager (open folder + select the file).
// Works for the main path AND every duplicate location. Cross-platform.
router.post('/fotos/:id/toon-in-map', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT volledig_pad FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!photo) return res.status(404).json({ fout: 'Photo not found' });

  const targetPath = photo.volledig_pad;
  const exists = targetPath && fs.existsSync(targetPath);
  // If the file itself is gone, we open the surrounding folder so the user
  // still sees the location and can check what's left there.
  const folderPath = exists ? path.dirname(targetPath) : (targetPath ? path.dirname(targetPath) : null);
  if (!folderPath || !fs.existsSync(folderPath)) {
    return res.status(404).json({ fout: 'Location not found on this computer', pad: targetPath });
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
    return res.status(500).json({ fout: 'could not open file manager', detail: e.message });
  }
});

// === EDIT PHOTO ===

router.put('/fotos/:id', (req, res) => {
  const { gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres, datum_foto, google_description } = req.body;
  const db = getDb();

  const photo = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ fout: 'Photo not found' }); }

  // Date parsing
  let year = null, month = null, day = null;
  if (datum_foto) {
    const d = new Date(datum_foto);
    if (!isNaN(d)) { year = d.getFullYear(); month = d.getMonth() + 1; day = d.getDate(); }
  }

  // Use the value that was sent if present (including null = clear); otherwise keep the DB value
  const finalLat         = gps_lat       !== undefined ? gps_lat       : photo.gps_lat;
  const finalLon         = gps_lon       !== undefined ? gps_lon       : photo.gps_lon;
  const finalCity        = gps_stad      !== undefined ? gps_stad      : photo.gps_stad;
  const finalCountry     = gps_land      !== undefined ? gps_land      : photo.gps_land;
  const finalCountryCode = gps_land_code !== undefined ? gps_land_code : photo.gps_land_code;
  const finalAddress     = gps_adres     !== undefined ? gps_adres     : photo.gps_adres;

  db.prepare(`
    UPDATE fotos SET
      gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?,
      datum_foto = ?, jaar = ?, maand = ?, dag = ?,
      google_description = ?
    WHERE id = ?
  `).run(
    finalLat, finalLon, finalCity, finalCountry, finalCountryCode, finalAddress,
    datum_foto ?? photo.datum_foto,
    year ?? photo.jaar,
    month ?? photo.maand,
    day ?? photo.dag,
    google_description ?? photo.google_description,
    req.params.id
  );

  // Propagate the GPS change to all duplicates in the same group
  const hasGpsUpdate = [gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres].some(v => v !== undefined);
  if (hasGpsUpdate && photo.duplicaat_groep) {
    const dupUpdate = db.prepare(`
      UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
      WHERE duplicaat_groep = ? AND id != ?
    `);
    dupUpdate.run(finalLat, finalLon, finalCity, finalCountry, finalCountryCode, finalAddress, photo.duplicaat_groep, req.params.id);
  }

  const updated = db.prepare(`
    SELECT f.*, b.naam as bron_naam, b.icoon as bron_icoon
    FROM fotos f JOIN bronnen b ON f.bron_id = b.id WHERE f.id = ?
  `).get(req.params.id);
  db.close();
  res.json(updated);
});

// Assign GPS to a photo + all duplicates in the same group
router.post('/fotos/:id/gps', (req, res) => {
  const { gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres } = req.body;
  if (!gps_lat || !gps_lon) return res.status(400).json({ fout: 'gps_lat and gps_lon are required' });

  const db = getDb();
  const photo = db.prepare('SELECT id, duplicaat_groep FROM fotos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ fout: 'Photo not found' }); }

  const updateGps = db.prepare(`
    UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
    WHERE id = ?
  `);

  let updatedCount = 0;

  if (photo.duplicaat_groep) {
    // Assign GPS to all duplicates in the same group
    const duplicates = db.prepare('SELECT id FROM fotos WHERE duplicaat_groep = ?').all(photo.duplicaat_groep);
    for (const dup of duplicates) {
      updateGps.run(gps_lat, gps_lon, gps_stad || null, gps_land || null, gps_land_code || null, gps_adres || null, dup.id);
      updatedCount++;
    }
  } else {
    updateGps.run(gps_lat, gps_lon, gps_stad || null, gps_land || null, gps_land_code || null, gps_adres || null, photo.id);
    updatedCount = 1;
  }

  db.close();
  res.json({ ok: true, bijgewerkt: updatedCount });
});

// GPS propagation via the scanner function (also shares to originals without gps_lat)
router.post('/scan/gps-propageren', (req, res) => {
  try {
    const updated = propagateGpsInGroups();
    res.json({ ok: true, bijgewerkt: updated });
  } catch (e) {
    res.status(500).json({ ok: false, fout: e.message });
  }
});

// Automatically share GPS within all duplicate groups
router.post('/duplicaten/gps-delen', (req, res) => {
  const db = getDb();

  // Find all groups where at least one photo has GPS
  const groups = db.prepare(`
    SELECT duplicaat_groep, MAX(gps_lat) as lat, MAX(gps_lon) as lon,
           MAX(gps_stad) as stad, MAX(gps_land) as land,
           MAX(gps_land_code) as land_code, MAX(gps_adres) as adres
    FROM fotos
    WHERE duplicaat_groep IS NOT NULL AND gps_lat IS NOT NULL
      AND gps_land IS NOT NULL AND gps_land != ''
    GROUP BY duplicaat_groep
  `).all();

  const update = db.prepare(`
    UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?,
                     gps_land_code = ?, gps_adres = ?
    WHERE duplicaat_groep = ? AND (gps_land IS NULL OR gps_land = '')
  `);

  let totalUpdated = 0;
  for (const g of groups) {
    const info = update.run(g.lat, g.lon, g.stad, g.land, g.land_code, g.adres, g.duplicaat_groep);
    totalUpdated += info.changes;
  }

  db.close();
  console.log(`🌍 GPS shared: ${totalUpdated} photos updated in ${groups.length} groups`);
  res.json({ ok: true, bijgewerkt: totalUpdated, groepen: groups.length });
});

// Restore the date for photos without one — via filename or file creation date
router.post('/fotos/herstel-datum', (req, res) => {
  const db = getDb();
  const withoutDate = db.prepare("SELECT id, bestandsnaam, volledig_pad FROM fotos WHERE datum_foto IS NULL").all();

  let updated = 0;
  const update = db.prepare("UPDATE fotos SET datum_foto = ?, jaar = ?, maand = ?, dag = ? WHERE id = ?");

  for (const photo of withoutDate) {
    // Step 1: date from the filename
    let date = parseDateFromFilename(photo.bestandsnaam);

    // Step 2: file creation date (birthtime or mtime)
    if (!date) {
      try {
        const stat = require('fs').statSync(photo.volledig_pad);
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
  res.json({ ok: true, totaal: withoutDate.length, bijgewerkt: updated });
});

function parseDateFromFilename(name) {
  const match = name.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00.000Z`;
}

// === DUPLICATES ===

router.get('/duplicaten', (req, res) => {
  const db = getDb();
  const { pagina = 1, per_pagina = 20 } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(per_pagina);

  const groups = db.prepare(`
    SELECT duplicaat_groep, COUNT(*) as aantal,
           MIN(datum_foto) as datum, MIN(bestandsnaam) as voorbeeld_naam
    FROM fotos WHERE duplicaat_groep IS NOT NULL
    GROUP BY duplicaat_groep
    HAVING COUNT(*) > 1
    ORDER BY aantal DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(per_pagina), offset);

  const totalGroups = db.prepare(`
    SELECT COUNT(*) as n FROM (
      SELECT duplicaat_groep FROM fotos WHERE duplicaat_groep IS NOT NULL
      GROUP BY duplicaat_groep HAVING COUNT(*) > 1
    )
  `).get().n;

  // Fetch the photos per group
  const result = groups.map(group => {
    const photos = db.prepare(`
      SELECT f.id, f.bestandsnaam, f.volledig_pad, f.bestandsgrootte,
             f.datum_foto, f.thumbnail, f.bron_id, f.gps_lat, f.gps_stad, f.gps_land,
             b.naam as bron_naam, b.icoon as bron_icoon, b.type as bron_type
      FROM fotos f JOIN bronnen b ON f.bron_id = b.id
      WHERE f.duplicaat_groep = ?
    `).all(group.duplicaat_groep);
    return { ...group, fotos: photos };
  });

  db.close();
  res.json({ groepen: result, totaal_groepen: totalGroups, pagina: parseInt(pagina) });
});

// Determine which copy in a duplicate group is the original (= kept one).
// Delegates to the shared keeper logic (src/keeper.js) so that backend,
// export AND frontend make exactly the same choice. required=false: returns
// null ("choice needed") when no source in the group has been ranked —
// the deletion flow then safely skips such groups.
function determineOriginal(fotos, bronVolgorde, handmatigId) {
  return determineKeeper(fotos, bronVolgorde, handmatigId, { required: false });
}

// Collect per group the keeper + copies to delete, based on priority/manual choice.
// groupFilter (optional): only process this hash.
function collectDuplicatePlan(db, bronVolgorde, handmatig, groupFilter) {
  const where = groupFilter
    ? 'WHERE f.duplicaat_groep = ?'
    : 'WHERE f.duplicaat_groep IS NOT NULL';
  const rows = groupFilter
    ? db.prepare(`SELECT f.id, f.bron_id, f.duplicaat_groep, f.volledig_pad, f.bestandsgrootte FROM fotos f ${where}`).all(groupFilter)
    : db.prepare(`SELECT f.id, f.bron_id, f.duplicaat_groep, f.volledig_pad, f.bestandsgrootte FROM fotos f ${where}`).all();

  const perGroup = new Map();
  for (const r of rows) {
    if (!perGroup.has(r.duplicaat_groep)) perGroup.set(r.duplicaat_groep, []);
    perGroup.get(r.duplicaat_groep).push(r);
  }

  const toDelete = [];          // photo objects headed for the trash
  let choiceNeeded = 0;         // number of groups that still require a choice
  let groupsReady = 0;
  for (const [group, photos] of perGroup) {
    const keeper = determineOriginal(photos, bronVolgorde, handmatig ? handmatig[group] : undefined);
    if (keeper == null) { choiceNeeded++; continue; }
    groupsReady++;
    for (const f of photos) if (f.id !== keeper) toDelete.push(f);
  }
  return { toDelete, choiceNeeded, groupsReady };
}

// Clean up duplicate leftovers: if a group has <= 1 photo left, that photo is
// no longer a duplicate → is_duplicaat=0 and duplicaat_groep=NULL.
// groups: array of duplicaat_groep hashes that may need cleaning up.
function cleanupDuplicateGroups(db, groups) {
  let cleaned = 0;
  const unique = [...new Set((groups || []).filter(Boolean))];
  const countPrep = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE duplicaat_groep = ?');
  const clearPrep = db.prepare('UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL WHERE duplicaat_groep = ?');
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
  const hasSource = body && Array.isArray(body.bronVolgorde);
  const hasManual = body && body.handmatig && typeof body.handmatig === 'object';
  if (hasSource || hasManual) {
    writePriority(db, hasSource ? body.bronVolgorde : undefined, hasManual ? body.handmatig : undefined);
  }
  return readPriority(db);
}

// === DUPLICATE PRIORITY (shared between frontend and backend) ===

router.get('/duplicaten/prioriteit', (req, res) => {
  const db = getDb();
  try {
    res.json(readPriority(db));
  } finally {
    db.close();
  }
});

router.post('/duplicaten/prioriteit', (req, res) => {
  const db = getDb();
  try {
    const { bronVolgorde, handmatig } = req.body || {};
    writePriority(db, bronVolgorde, handmatig);
    res.json({ ok: true, ...readPriority(db) });
  } catch (e) {
    res.status(500).json({ fout: 'save failed', detail: e.message });
  } finally {
    db.close();
  }
});

// Preview of what would be deleted (for the confirmation) — deletes nothing.
router.post('/duplicaten/wis-preview', (req, res) => {
  const db = getDb();
  try {
    const { groep = null } = req.body || {};
    const { bronVolgorde, handmatig } = resolvePriority(db, req.body);
    const { toDelete, choiceNeeded, groupsReady } = collectDuplicatePlan(db, bronVolgorde, handmatig, groep);
    const bytes = toDelete.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);
    db.close();
    res.json({ ok: true, bestanden: toDelete.length, bytes, groepenKlaar: groupsReady, keuzeNodig: choiceNeeded });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'preview failed', detail: e.message });
  }
});

// Delete the duplicates (all copies except the original) → trash + out of the database.
// Groups that still require a choice are skipped.
router.post('/duplicaten/wis', async (req, res) => {
  const db = getDb();
  try {
    const { groep = null } = req.body || {};
    const { bronVolgorde, handmatig } = resolvePriority(db, req.body);
    const { toDelete, choiceNeeded } = collectDuplicatePlan(db, bronVolgorde, handmatig, groep);

    if (toDelete.length === 0) {
      db.close();
      return res.json({ ok: true, verwijderd: 0, naarPrullenbak: 0, bytesVrij: 0, overgeslagen: choiceNeeded });
    }

    // Split existing vs. already missing files
    const existing = [], missingIds = [];
    for (const f of toDelete) {
      if (f.volledig_pad && fs.existsSync(f.volledig_pad)) existing.push(f);
      else missingIds.push(f.id);
    }

    let trash;
    try { trash = require('trash'); }
    catch (e) { db.close(); return res.status(500).json({ fout: 'trash module not available', detail: e.message }); }

    const trashedIds = [];
    let freedBytes = 0;
    if (existing.length) {
      try {
        await trash(existing.map(f => f.volledig_pad));
        for (const f of existing) { trashedIds.push(f.id); freedBytes += f.bestandsgrootte || 0; }
      } catch (batchErr) {
        for (const f of existing) {
          try { await trash(f.volledig_pad); trashedIds.push(f.id); freedBytes += f.bestandsgrootte || 0; }
          catch (_) { /* skip this file */ }
        }
      }
    }

    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM fotos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up keeper(s) of affected groups: no copy left = no longer a duplicate
    const removedSet = new Set(toRemove);
    const affectedGroups = toDelete.filter(f => removedSet.has(f.id)).map(f => f.duplicaat_groep);
    cleanupDuplicateGroups(db, affectedGroups);

    db.close();
    res.json({
      ok: true,
      verwijderd: toRemove.length,
      naarPrullenbak: trashedIds.length,
      bytesVrij: freedBytes,
      overgeslagen: choiceNeeded
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'delete failed', detail: e.message });
  }
});

// === CLEAR DATABASE ===

router.post('/database/wis', (req, res) => {
  const db = getDb();
  db.exec(`
    DELETE FROM fotos;
    DELETE FROM scan_log;
    UPDATE bronnen SET totaal_fotos = 0, laatste_scan = NULL;
    DELETE FROM instellingen WHERE sleutel IN ('dup_bron_volgorde', 'dup_handmatig');
  `);
  db.close();
  console.log('🗑️  Database cleared by user (sources kept, duplicate priority reset)');
  res.json({ ok: true });
});

// === FOLDER BROWSER ===

router.get('/mappen', (req, res) => {
  const pad = req.query.pad || require('os').homedir();
  try {
    const items = fs.readdirSync(pad, { withFileTypes: true });
    const folders = items
      .filter(i => i.isDirectory() && !i.name.startsWith('.'))
      .map(i => ({ naam: i.name, pad: path.join(pad, i.name) }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
    const parent = path.dirname(pad) !== pad ? path.dirname(pad) : null;
    res.json({ huidig: pad, ouder: parent, mappen: folders });
  } catch (e) {
    res.status(400).json({ fout: e.message });
  }
});

// === MAP DATA ===

// Serve the thumbnail as a real image (the browser caches this)
router.get('/fotos/:id/thumbnail', (req, res) => {
  // Shared, long-lived read connection: this endpoint is called ~50x per page;
  // opening a new connection every time made the app freeze.
  const db = getSharedDb();
  const photo = db.prepare('SELECT thumbnail FROM fotos WHERE id = ?').get(req.params.id);
  if (!photo?.thumbnail) return res.status(404).send('Geen thumbnail');
  const [header, b64] = photo.thumbnail.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(b64, 'base64'));
});

// Location clusters for the map (grouped on a ~1km grid)
router.get('/kaart/locaties', (req, res) => {
  const { is_video } = req.query;
  const db = getDb();
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (is_video IS NULL OR is_video = 0)';

  const locations = db.prepare(`
    SELECT
      ROUND(gps_lat, 2) as lat,
      ROUND(gps_lon, 2) as lon,
      MAX(gps_stad)      as gps_stad,
      MAX(gps_land)      as gps_land,
      MAX(gps_land_code) as gps_land_code,
      MIN(jaar)          as jaar_min,
      MAX(jaar)          as jaar_max,
      COUNT(*)           as aantal,
      SUM(CASE WHEN is_video = 1 THEN 1 ELSE 0 END) as aantal_videos,
      MIN(id)            as voorbeeld_id
    FROM fotos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      ${typeFilter}
      AND (duplicaat_groep IS NULL
           OR id = (SELECT MIN(id) FROM fotos f2 WHERE f2.duplicaat_groep = fotos.duplicaat_groep))
    GROUP BY ROUND(gps_lat, 2), ROUND(gps_lon, 2)
    ORDER BY aantal DESC
  `).all();
  db.close();
  res.json(locations);
});

// Photos at a specific location (for the slide-up panel)
router.get('/kaart/fotos', (req, res) => {
  const { lat, lon, limit = 40, zonder_kopien = '1', is_video } = req.query;
  if (!lat || !lon) return res.status(400).json({ fout: 'lat and lon required' });
  const db = getDb();

  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Keeper set via the shared logic → the kept copy on the map matches the
  // detail view, the duplicates page AND the export.
  const keepers = keeperIds(db);

  const rows = db.prepare(`
    SELECT f.id, f.bestandsnaam, f.datum_foto, f.gps_stad, f.gps_land, f.gps_land_code,
           f.is_duplicaat, f.is_video, f.duur, f.duplicaat_groep,
           f.camera_model, b.naam as bron_naam, b.icoon as bron_icoon, b.type as bron_type
    FROM fotos f JOIN bronnen b ON f.bron_id = b.id
    WHERE ROUND(f.gps_lat, 2) = ROUND(?, 2)
      AND ROUND(f.gps_lon, 2) = ROUND(?, 2)
      ${typeFilter}
    ORDER BY f.datum_foto ASC NULLS LAST
  `).all(parseFloat(lat), parseFloat(lon));
  db.close();

  let photos = rows.map(f => ({
    ...f,
    is_origineel: f.duplicaat_groep && keepers.has(f.id) ? 1 : 0
  }));
  // Hide copies: show non-duplicates + the kept copy per group
  if (zonder_kopien === '1') {
    photos = photos.filter(f => !f.is_duplicaat || f.is_origineel);
  }
  photos = photos.slice(0, parseInt(limit));
  res.json(photos);
});

// === GPS BULK ASSIGN ===

// GET /api/gps/groepen — group photos without GPS by time block (2h gap = new group)
router.get('/gps/groepen', (req, res) => {
  const db = getDb();

  // Type filter: '' = everything, '0' = photos only, '1' = videos only
  const { is_video } = req.query;
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Only show originals — copies are updated along via GPS propagation
  const originalFilter = `
    AND (f.duplicaat_groep IS NULL
      OR f.id = (SELECT MIN(id) FROM fotos WHERE duplicaat_groep = f.duplicaat_groep))
  `;

  const withDate = db.prepare(`
    SELECT f.id, f.datum_foto, f.thumbnail IS NOT NULL as heeft_thumb
    FROM fotos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND f.datum_foto IS NOT NULL AND f.datum_foto != ''
      ${typeFilter}
      ${originalFilter}
    ORDER BY f.datum_foto ASC
  `).all();

  const withoutDate = db.prepare(`
    SELECT f.id, f.thumbnail IS NOT NULL as heeft_thumb
    FROM fotos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND (f.datum_foto IS NULL OR f.datum_foto = '')
      ${typeFilter}
      ${originalFilter}
    ORDER BY f.id ASC
  `).all();

  db.close();

  const GAP_MS = 2 * 60 * 60 * 1000; // 2 hours
  const groups = [];
  let currentGroup = null;

  for (const photo of withDate) {
    const ts = new Date(photo.datum_foto).getTime();
    if (isNaN(ts)) continue;
    if (!currentGroup || ts - currentGroup.lastTs > GAP_MS) {
      currentGroup = { dateStart: photo.datum_foto, dateEnd: photo.datum_foto, lastTs: ts, ids: [], samples: [] };
      groups.push(currentGroup);
    }
    currentGroup.dateEnd = photo.datum_foto;
    currentGroup.lastTs = ts;
    currentGroup.ids.push(photo.id);
    if (currentGroup.samples.length < 6 && photo.heeft_thumb) currentGroup.samples.push(photo.id);
  }

  const result = groups.map((g, i) => ({
    groep_id: i,
    datum_start: g.dateStart,
    datum_eind: g.dateEnd,
    aantal: g.ids.length,
    ids: g.ids,
    voorbeelden: g.samples
  }));

  if (withoutDate.length > 0) {
    result.push({
      groep_id: result.length,
      datum_start: null,
      datum_eind: null,
      aantal: withoutDate.length,
      ids: withoutDate.map(f => f.id),
      voorbeelden: withoutDate.filter(f => f.heeft_thumb).slice(0, 6).map(f => f.id)
    });
  }

  res.json(result);
});

// POST /api/gps/bulk-toewijzen — assign a location to multiple photos + their duplicates
router.post('/gps/bulk-toewijzen', (req, res) => {
  const { ids, gps_stad, gps_land, gps_lat, gps_lon, gps_land_code, gps_adres } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ fout: 'ids required' });
  }
  const db = getDb();

  // Collect all duplicaat_groep values of the given photos
  const placeholders = ids.map(() => '?').join(',');
  const groups = db.prepare(
    `SELECT DISTINCT duplicaat_groep FROM fotos WHERE id IN (${placeholders}) AND duplicaat_groep IS NOT NULL`
  ).all(...ids).map(r => r.duplicaat_groep);

  const gpsFields = [gps_stad || null, gps_land || null, gps_lat || null, gps_lon || null, gps_land_code || null, gps_adres || null];

  const updateById = db.prepare('UPDATE fotos SET gps_stad=?, gps_land=?, gps_lat=?, gps_lon=?, gps_land_code=?, gps_adres=? WHERE id=?');
  const updateDuplicates = groups.length > 0
    ? db.prepare(`UPDATE fotos SET gps_stad=?, gps_land=?, gps_lat=?, gps_lon=?, gps_land_code=?, gps_adres=? WHERE duplicaat_groep IN (${groups.map(() => '?').join(',')})`)
    : null;

  const updateAll = db.transaction(() => {
    // Assign to the given photos
    for (const id of ids) updateById.run(...gpsFields, id);
    // Propagate to all duplicates in the same groups
    if (updateDuplicates) updateDuplicates.run(...gpsFields, ...groups);
  });

  updateAll();
  // Count the total updated records (direct + duplicates)
  const total = db.prepare(`SELECT COUNT(*) as n FROM fotos WHERE id IN (${placeholders})${groups.length ? ` OR duplicaat_groep IN (${groups.map(() => '?').join(',')})` : ''}`).get(...ids, ...groups).n;
  db.close();
  res.json({ bijgewerkt: total, duplicaten_bijgewerkt: groups.length > 0 });
});

// === PHASE ===

router.get('/fase', (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT waarde FROM instellingen WHERE sleutel = 'fase'").get();
  db.close();
  res.json({ fase: parseInt(row?.waarde || '1') });
});

router.post('/fase', (req, res) => {
  const { fase } = req.body;
  if (![1, 2, 3].includes(fase)) return res.status(400).json({ fout: 'phase must be 1, 2 or 3' });
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO instellingen (sleutel, waarde) VALUES ('fase', ?)").run(String(fase));
  db.close();
  res.json({ fase });
});

// Mark a photo as "location unknown" (and propagate to duplicates)
router.post('/fotos/:id/locatie-onbekend', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ fout: 'not found' }); }
  db.prepare('UPDATE fotos SET locatie_onbekend = 1 WHERE id = ?').run(photo.id);
  if (photo.duplicaat_groep) {
    db.prepare('UPDATE fotos SET locatie_onbekend = 1 WHERE duplicaat_groep = ?').run(photo.duplicaat_groep);
  }
  db.close();
  res.json({ ok: true });
});

// Mark a photo as ignored (phase 2) — cascades to all duplicates in the same group
router.post('/fotos/:id/negeer', (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!photo) { db.close(); return res.status(404).json({ fout: 'not found' }); }
  const value = req.body.genegeerd !== false ? 1 : 0;

  // Always set the clicked photo
  db.prepare('UPDATE fotos SET genegeerd = ? WHERE id = ?').run(value, photo.id);

  // If the photo is part of a duplicate group: cascade to all group members
  let changedCount = 1;
  if (photo.duplicaat_groep) {
    const result = db.prepare(
      'UPDATE fotos SET genegeerd = ? WHERE duplicaat_groep = ? AND id != ?'
    ).run(value, photo.duplicaat_groep, photo.id);
    changedCount += result.changes;
  }

  db.close();
  res.json({ ok: true, genegeerd: value === 1, aantalGewijzigd: changedCount });
});

// Bulk: mark multiple photos at once as ignored / not ignored (phase C batch).
// Body: { ids: [..], genegeerd: true|false }. Cascades per photo over the duplicate
// group, so an entire group is consistently ignored along (same rule as /fotos/:id/negeer).
router.post('/fotos/negeer-bulk', (req, res) => {
  const db = getDb();
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) { return res.status(400).json({ fout: 'no ids' }); }
    const value = req.body.genegeerd !== false ? 1 : 0;

    const setPhoto = db.prepare('UPDATE fotos SET genegeerd = ? WHERE id = ?');
    const setGroup = db.prepare('UPDATE fotos SET genegeerd = ? WHERE duplicaat_groep = ? AND id != ?');
    const getPhoto = db.prepare('SELECT id, duplicaat_groep FROM fotos WHERE id = ?');

    let changedCount = 0;
    const tx = db.transaction(() => {
      for (const id of ids) {
        const photo = getPhoto.get(id);
        if (!photo) continue;
        setPhoto.run(value, photo.id);
        changedCount += 1;
        if (photo.duplicaat_groep) {
          changedCount += setGroup.run(value, photo.duplicaat_groep, photo.id).changes;
        }
      }
    });
    tx();

    res.json({ ok: true, genegeerd: value === 1, aantalGevraagd: ids.length, aantalGewijzigd: changedCount });
  } finally {
    db.close();
  }
});

// Permanently remove ALL ignored photos: to trash + out of the database
// - selects all genegeerd=1 photos
// - cascade: the entire duplicate group of every ignored photo is included
// - files go to the system trash (recoverable), not permanently deleted
// - DB records are removed so they won't be scanned again
router.post('/genegeerd/verwijder', async (req, res) => {
  const db = getDb();
  try {
    // 1. All ignored photos
    const ignored = db.prepare('SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE genegeerd = 1').all();

    // 2. Cascade: add all members of the affected duplicate groups
    const groups = [...new Set(ignored.map(f => f.duplicaat_groep).filter(Boolean))];
    const idMap = new Map();
    for (const f of ignored) idMap.set(f.id, f);
    if (groups.length) {
      const ph = groups.map(() => '?').join(',');
      const members = db.prepare(
        `SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE duplicaat_groep IN (${ph})`
      ).all(...groups);
      for (const f of members) idMap.set(f.id, f);
    }

    const all = [...idMap.values()];
    if (all.length === 0) {
      db.close();
      return res.json({ ok: true, verwijderd: 0, naarPrullenbak: 0, ontbrak: 0 });
    }

    // 3. Split into files that still exist vs. already missing
    const existing = [];
    const missingIds = [];
    for (const f of all) {
      if (f.volledig_pad && fs.existsSync(f.volledig_pad)) existing.push(f);
      else missingIds.push(f.id);
    }

    // 4. Move existing files to the trash
    let trash;
    try {
      trash = require('trash');
    } catch (e) {
      db.close();
      return res.status(500).json({ fout: 'trash module not available', detail: e.message });
    }

    const trashedIds = [];
    const failed = [];
    if (existing.length) {
      try {
        // Batch: everything to the trash in one go
        await trash(existing.map(f => f.volledig_pad));
        for (const f of existing) trashedIds.push(f.id);
      } catch (batchErr) {
        // Fallback: file by file, so one error doesn't lose everything
        for (const f of existing) {
          try { await trash(f.volledig_pad); trashedIds.push(f.id); }
          catch (e) { failed.push({ id: f.id, pad: f.volledig_pad, fout: e.message }); }
        }
      }
    }

    // 5. Remove DB records: everything trashed + everything already missing
    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM fotos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up any leftovers of the affected groups (e.g. after a failed trash)
    cleanupDuplicateGroups(db, groups);

    db.close();
    res.json({
      ok: true,
      verwijderd: toRemove.length,
      naarPrullenbak: trashedIds.length,
      ontbrak: missingIds.length,
      mislukt: failed
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'delete failed', detail: e.message });
  }
});

// Permanently remove ONE photo: file to trash + DB record gone
// (recoverable via the system trash, not permanently deleted)
router.post('/fotos/:id/verwijder', async (req, res) => {
  const db = getDb();
  try {
    const photo = db.prepare('SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE id = ?').get(req.params.id);
    if (!photo) { db.close(); return res.status(404).json({ fout: 'not found' }); }

    let trashed = false;
    if (photo.volledig_pad && fs.existsSync(photo.volledig_pad)) {
      let trash;
      try { trash = require('trash'); }
      catch (e) { db.close(); return res.status(500).json({ fout: 'trash module not available', detail: e.message }); }
      try { await trash(photo.volledig_pad); trashed = true; }
      catch (e) { db.close(); return res.status(500).json({ fout: 'could not move file to trash', detail: e.message }); }
    }

    db.prepare('DELETE FROM fotos WHERE id = ?').run(photo.id);
    // Clean up the remainder of the duplicate group: 1 left = no longer a duplicate
    if (photo.duplicaat_groep) cleanupDuplicateGroups(db, [photo.duplicaat_groep]);
    db.close();
    res.json({ ok: true, naarPrullenbak: trashed, ontbrak: !trashed });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'delete failed', detail: e.message });
  }
});

// Permanently remove a LIST of photos in one go: files to trash + DB records gone
// Used a.o. by the GPS-assign page to delete a whole group of bad photos at once.
// - cascade: the entire duplicate group of every photo is included (same rule as /genegeerd/verwijder)
// - files go to the system trash (recoverable), never permanently deleted
// - DB records are removed so they won't be scanned again
router.post('/fotos/verwijder-bulk', async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ fout: 'no ids provided' });

  const db = getDb();
  try {
    // 1. Fetch the requested photos
    const ph0 = ids.map(() => '?').join(',');
    const requested = db.prepare(
      `SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE id IN (${ph0})`
    ).all(...ids);

    // 2. Cascade: add all members of the affected duplicate groups
    const groups = [...new Set(requested.map(f => f.duplicaat_groep).filter(Boolean))];
    const idMap = new Map();
    for (const f of requested) idMap.set(f.id, f);
    if (groups.length) {
      const ph = groups.map(() => '?').join(',');
      const members = db.prepare(
        `SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE duplicaat_groep IN (${ph})`
      ).all(...groups);
      for (const f of members) idMap.set(f.id, f);
    }

    const all = [...idMap.values()];
    if (all.length === 0) {
      db.close();
      return res.json({ ok: true, verwijderd: 0, naarPrullenbak: 0, ontbrak: 0 });
    }

    // 3. Split into files that still exist vs. already missing
    const existing = [];
    const missingIds = [];
    for (const f of all) {
      if (f.volledig_pad && fs.existsSync(f.volledig_pad)) existing.push(f);
      else missingIds.push(f.id);
    }

    // 4. Move existing files to the trash
    let trash;
    try {
      trash = require('trash');
    } catch (e) {
      db.close();
      return res.status(500).json({ fout: 'trash module not available', detail: e.message });
    }

    const trashedIds = [];
    const failed = [];
    if (existing.length) {
      try {
        await trash(existing.map(f => f.volledig_pad));
        for (const f of existing) trashedIds.push(f.id);
      } catch (batchErr) {
        for (const f of existing) {
          try { await trash(f.volledig_pad); trashedIds.push(f.id); }
          catch (e) { failed.push({ id: f.id, pad: f.volledig_pad, fout: e.message }); }
        }
      }
    }

    // 5. Remove DB records: everything trashed + everything already missing
    const toRemove = [...trashedIds, ...missingIds];
    if (toRemove.length) {
      const ph = toRemove.map(() => '?').join(',');
      db.prepare(`DELETE FROM fotos WHERE id IN (${ph})`).run(...toRemove);
    }

    // Clean up any leftovers of the affected groups
    cleanupDuplicateGroups(db, groups);

    db.close();
    res.json({
      ok: true,
      verwijderd: toRemove.length,
      naarPrullenbak: trashedIds.length,
      ontbrak: missingIds.length,
      mislukt: failed
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'delete failed', detail: e.message });
  }
});

// Stats for the phase 1 todo
router.get('/fase1/todo', (req, res) => {
  const db = getDb();
  const zonderLocatie = db.prepare(`
    SELECT COUNT(*) as n FROM fotos
    WHERE gps_lat IS NULL AND gps_stad IS NULL
      AND (locatie_onbekend IS NULL OR locatie_onbekend = 0)
      AND (duplicaat_groep IS NULL OR id = (SELECT MIN(id) FROM fotos f2 WHERE f2.duplicaat_groep = fotos.duplicaat_groep))
  `).get().n;
  db.close();
  res.json({ zonderLocatie });
});

// === PHASE 3: EXPORT ===

// Calculate what will be exported (preview)
router.get('/export/preview', (req, res) => {
  const doelmap = req.query.doelmap || '';
  try {
    const preview = calculatePreview(doelmap || null);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ fout: err.message });
  }
});

// Start the export
router.post('/export/start', async (req, res) => {
  const { doelmap } = req.body;
  if (!doelmap) return res.status(400).json({ fout: 'target folder is required' });
  try {
    const result = await startExport(doelmap);
    if (result.fout) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ fout: err.message });
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
