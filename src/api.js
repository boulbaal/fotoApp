const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb, getSharedDb } = require('./database');
const { startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propageerGpsInGroepen, stopScan, stopGeocode, verwijderUitWachtrij, startVideoThumbnailPass, getVideoThumbStatus, startVideoGpsPass, getVideoGpsStatus } = require('./scanner');
const { berekenPreview, startExport, stopExport, getStatus: getExportStatus, resetExport } = require('./export');
const { leesPrioriteit, schrijfPrioriteit, bepaalKeeper, keeperIds } = require('./keeper');

const router = express.Router();

// === VERSIE ===
// Eén bron van waarheid: de versie staat in package.json. De frontend haalt 'm
// hier op om in de titel te tonen én om de favicon-cache te verversen (?v=...).
// Zo hoeft de versie nergens handmatig bijgewerkt te worden bij een release.
router.get('/versie', (req, res) => {
  let versie = '';
  try { versie = require('../package.json').version || ''; } catch (_) {}
  res.json({ versie });
});

// === BRONNEN ===

router.get('/bronnen', (req, res) => {
  const db = getDb();
  const bronnen = db.prepare(`
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
  res.json(bronnen);
});

router.post('/bronnen', (req, res) => {
  const { naam, type, pad, icoon, verborgen_meenemen } = req.body;
  if (!naam || !pad) return res.status(400).json({ fout: 'naam en pad zijn verplicht' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO bronnen (naam, type, pad, icoon, verborgen_meenemen) VALUES (?, ?, ?, ?, ?)
  `).run(naam, type || 'pc', pad, icoon || '💻', verborgen_meenemen ? 1 : 0);
  const bron = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.json(bron);
});

router.put('/bronnen/:id', (req, res) => {
  const { naam, pad, type, icoon, verborgen_meenemen } = req.body;
  const db = getDb();
  db.prepare('UPDATE bronnen SET naam = ?, pad = ?, type = ?, icoon = ?, verborgen_meenemen = ? WHERE id = ?')
    .run(naam, pad, type, icoon, verborgen_meenemen ? 1 : 0, req.params.id);
  const bron = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(req.params.id);
  db.close();
  res.json(bron);
});

// Snelle toggle vanuit de bron-kaart: alleen de "verborgen mappen meescannen"-vlag
router.patch('/bronnen/:id/verborgen', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE bronnen SET verborgen_meenemen = ? WHERE id = ?')
    .run(req.body.verborgen_meenemen ? 1 : 0, req.params.id);
  const bron = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(req.params.id);
  db.close();
  res.json(bron);
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
    // Standaard komt de instelling van de bron zelf; een expliciete vlag in de
    // body kan dat per scan overrulen (de scanner valt anders terug op de bron).
    const heeftVlag = req.body && req.body.verborgenMeenemen !== undefined;
    const opties = heeftVlag ? { verborgenMeenemen: !!req.body.verborgenMeenemen } : {};
    const status = await startScan(parseInt(req.params.bronId), opties);
    res.json(status);
  } catch (e) {
    res.status(400).json({ fout: e.message });
  }
});

router.get('/scan/status', (req, res) => {
  res.json(getScanStatus());
});

router.post('/scan/stop', (req, res) => {
  stopScan(true); // leegt ook wachtrij
  res.json({ ok: true });
});

router.delete('/scan/wachtrij/:bronId', (req, res) => {
  verwijderUitWachtrij(parseInt(req.params.bronId));
  res.json(getScanStatus());
});

router.get('/scan/geocode', (req, res) => {
  res.json(getGeocodeStatus());
});

router.post('/scan/geocode', async (req, res) => {
  startGeocodePass(); // start op achtergrond, return meteen
  res.json({ ok: true, bericht: 'Geocode pass gestart' });
});

// Stopt enkel de geocode-achtergrondpass — een lopende scan blijft draaien.
router.post('/scan/geocode/stop', (req, res) => {
  stopGeocode();
  res.json({ ok: true, bericht: 'Geocode pass stoppen aangevraagd' });
});

// Video thumbnail pass — start handmatig of wordt automatisch gestart na scan
router.post('/scan/video-thumbnails', (req, res) => {
  startVideoThumbnailPass();
  res.json({ ok: true, status: getVideoThumbStatus() });
});

router.get('/scan/video-thumbnails/status', (req, res) => {
  res.json(getVideoThumbStatus());
});

// Auto-start bij opstart als er videos zonder thumbnail zijn
setTimeout(() => startVideoThumbnailPass(), 5000);

// Video GPS pass — leest GPS uit video-containers via exiftool (fallback voor exifr)
router.post('/scan/video-gps', (req, res) => {
  startVideoGpsPass();
  res.json({ ok: true, status: getVideoGpsStatus() });
});

router.get('/scan/video-gps/status', (req, res) => {
  res.json(getVideoGpsStatus());
});

// Auto-start 15s na opstart (na thumbnail pass)
setTimeout(() => startVideoGpsPass(), 15000);

// === STATISTIEKEN ===

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

  // Foto-specifiek
  const fotosUniek     = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND COALESCE(is_duplicaat,0)=0').get().n;
  const fotosDubbel    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND is_duplicaat=1').get().n;
  const fotosMetGps    = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND gps_lat IS NOT NULL AND gps_lat!=0').get().n;
  const fotosZonderGps = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE COALESCE(is_video,0)=0 AND (gps_lat IS NULL OR gps_lat=0)').get().n;

  // Video-specifiek
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

// === OPSCHOON-DASHBOARD ===
// Overzicht van ruimte die vrijgemaakt kan worden: duplicaat-kopieën (op basis
// van de opgeslagen keeper-prioriteit) + genegeerde bestanden. Puur lezen.
router.get('/opschoon/overzicht', (req, res) => {
  const db = getDb();
  try {
    const { bronVolgorde, handmatig } = leesPrioriteit(db);
    const plan = verzamelDuplicaatPlan(db, bronVolgorde, handmatig);
    const dupBytes = plan.teWissen.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);

    const gen = db.prepare(
      'SELECT COUNT(*) as n, COALESCE(SUM(bestandsgrootte), 0) as bytes FROM fotos WHERE genegeerd = 1'
    ).get();

    res.json({
      duplicaten: {
        bestanden: plan.teWissen.length,   // kopieën die nu al weg kunnen
        bytes: dupBytes,
        groepenKlaar: plan.groepenKlaar,   // groepen met een gekozen keeper
        keuzeNodig: plan.keuzeNodig        // groepen die nog een keuze vereisen
      },
      genegeerd: {
        bestanden: gen.n,
        bytes: gen.bytes
      },
      totaalVrijTeMaken: dupBytes + gen.bytes
    });
  } catch (e) {
    res.status(500).json({ fout: 'overzicht mislukt', detail: e.message });
  } finally {
    db.close();
  }
});

// === WRAPPED / FOTO-LEVEN (deelbaar samenvattingsscherm) ===
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

// === FOTO'S ===

router.get('/fotos', (req, res) => {
  const db = getDb();
  const { pagina = 1, per_pagina = 50, bron_id, jaar, zoek, zonder_thumbnail, land, camera_merk, camera_model, zonder_kopien, zonder_gps, met_gps, alleen_dubbel, alleen_uniek, genegeerd, is_video } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(per_pagina);

  let waar = '1=1';
  const params = [];

  if (bron_id)      { waar += ' AND f.bron_id = ?';      params.push(bron_id); }
  if (jaar)         { waar += ' AND f.jaar = ?';          params.push(jaar); }
  if (land)         { waar += ' AND f.gps_land = ?';      params.push(land); }
  if (camera_merk)  { waar += ' AND f.camera_merk = ?';   params.push(camera_merk); }
  if (camera_model) { waar += ' AND f.camera_model = ?';  params.push(camera_model); }
  if (zoek) {
    // Tekstzoeken over naam, locatie (stad + land) en camera (merk + model)
    waar += ' AND (f.bestandsnaam LIKE ? OR f.gps_stad LIKE ? OR f.gps_land LIKE ? OR f.camera_merk LIKE ? OR f.camera_model LIKE ?)';
    const q = `%${zoek}%`;
    params.push(q, q, q, q, q);
  }
  if (zonder_gps === '1') { waar += ' AND (f.gps_lat IS NULL OR f.gps_lat = 0)'; }
  if (met_gps === '1')    { waar += ' AND f.gps_lat IS NOT NULL AND f.gps_lat != 0'; }
  if (alleen_dubbel === '1') { waar += ' AND f.is_duplicaat = 1'; }
  if (alleen_uniek === '1')  { waar += ' AND COALESCE(f.is_duplicaat,0) = 0'; }
  if (genegeerd === '1')  { waar += ' AND f.genegeerd = 1'; }
  if (genegeerd === '0')  { waar += ' AND (f.genegeerd IS NULL OR f.genegeerd = 0)'; }
  if (is_video === '1')   { waar += ' AND f.is_video = 1'; }
  if (is_video === '0')   { waar += ' AND (f.is_video IS NULL OR f.is_video = 0)'; }

  // Verberg kopieën: toon het beste exemplaar per groep dat ook voldoet aan actieve filters
  // Als land/camera filter actief is: kies de beste kopie MET dat land, zodat originelen zonder
  // GPS-data de kopie met GPS-data niet blokkeren.
  if (zonder_kopien === '1') {
    const landSubquery   = land         ? ' AND f2.gps_land = ?'        : '';
    const merkSubquery   = camera_merk  ? ' AND f2.camera_merk = ?'     : '';
    const modelSubquery  = camera_model ? ' AND f2.camera_model = ?'    : '';

    waar += ` AND (
      f.is_duplicaat = 0
      OR f.id = (
        SELECT f2.id FROM fotos f2
        JOIN bronnen b2 ON f2.bron_id = b2.id
        WHERE f2.duplicaat_groep = f.duplicaat_groep${landSubquery}${merkSubquery}${modelSubquery}
        ORDER BY CASE b2.type WHEN 'pc' THEN 1 WHEN 'gsm' THEN 2 WHEN 'usb' THEN 3 ELSE 4 END, f2.id ASC
        LIMIT 1
      )
    )`;

    if (land)         params.push(land);
    if (camera_merk)  params.push(camera_merk);
    if (camera_model) params.push(camera_model);
  }

  const kolommen = zonder_thumbnail === '1'
    ? 'f.id, f.bestandsnaam, f.volledig_pad, f.bestandsgrootte, f.bestandstype, f.datum_foto, f.jaar, f.maand, f.dag, f.gps_lat, f.gps_lon, f.gps_stad, f.gps_land, f.camera_merk, f.camera_model, f.is_duplicaat, f.duplicaat_groep, f.is_video, f.duur, f.geexporteerd, (f.thumbnail IS NOT NULL) as heeft_thumbnail, b.naam as bron_naam, b.icoon as bron_icoon'
    : 'f.*, (f.thumbnail IS NOT NULL) as heeft_thumbnail, b.naam as bron_naam, b.icoon as bron_icoon';

  const fotos = db.prepare(`
    SELECT ${kolommen} FROM fotos f
    JOIN bronnen b ON f.bron_id = b.id
    WHERE ${waar}
    ORDER BY f.datum_foto DESC NULLS LAST, f.datum_bestand DESC
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(per_pagina), offset]);

  const totaal = db.prepare(`SELECT COUNT(*) as n FROM fotos f WHERE ${waar}`).get(params).n;

  db.close();
  res.json({ fotos, totaal, pagina: parseInt(pagina), per_pagina: parseInt(per_pagina) });
});

router.get('/fotos/:id', (req, res) => {
  const db = getDb();
  const foto = db.prepare(`
    SELECT f.*, b.naam as bron_naam, b.icoon as bron_icoon
    FROM fotos f JOIN bronnen b ON f.bron_id = b.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!foto) { db.close(); return res.status(404).json({ fout: 'Foto niet gevonden' }); }

  // Als duplicaat: alle exemplaren ophalen (inclusief huidige) om origineel te bepalen
  let duplicaatLocaties = [];
  let isOrigineel = false;

  if (foto.duplicaat_groep) {
    const alleExemplaren = db.prepare(`
      SELECT f.id, f.bron_id, f.volledig_pad, f.bestandsgrootte, b.naam as bron_naam, b.icoon as bron_icoon, b.type as bron_type
      FROM fotos f JOIN bronnen b ON f.bron_id = b.id
      WHERE f.duplicaat_groep = ?
    `).all(foto.duplicaat_groep);

    // Behouden exemplaar bepalen via de gedeelde keeper-logica (dezelfde keuze
    // als de duplicaten-pagina én de export). verplicht=true: er is altijd
    // precies één behouden exemplaar, ook als er nog geen bron gerangschikt is.
    const { bronVolgorde, handmatig } = leesPrioriteit(db);
    const origineelId = bepaalKeeper(alleExemplaren, bronVolgorde, handmatig[foto.duplicaat_groep], { verplicht: true });
    isOrigineel = foto.id === origineelId;

    // Andere locaties = alle exemplaren behalve de huidige
    duplicaatLocaties = alleExemplaren
      .filter(e => e.id !== foto.id)
      .map(e => ({ ...e, is_origineel: e.id === origineelId }));
  }

  db.close();
  res.json({ ...foto, duplicaat_locaties: duplicaatLocaties, is_origineel: isOrigineel });
});

// Originele foto/video serveren met Range-support (voor video streaming)
router.get('/fotos/:id/bestand', (req, res) => {
  const db = getDb();
  const foto = db.prepare('SELECT volledig_pad, bestandstype, is_video FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!foto || !fs.existsSync(foto.volledig_pad)) {
    return res.status(404).json({ fout: 'Bestand niet gevonden' });
  }

  // Video's: stuur met Range-support zodat de browser kan zoeken en streamen
  if (foto.is_video) {
    const ext = path.extname(foto.volledig_pad).toLowerCase();
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
    const stat = fs.statSync(foto.volledig_pad);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(foto.volledig_pad, { start, end });
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
      fs.createReadStream(foto.volledig_pad).pipe(res);
    }
    return;
  }

  // Foto's: gewoon sendFile
  res.sendFile(foto.volledig_pad);
});

// Bestand openen in systeemspeler — op voorgrond, op het scherm waar de muis is
router.post('/fotos/:id/open-extern', (req, res) => {
  const db = getDb();
  const foto = db.prepare('SELECT volledig_pad FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!foto || !fs.existsSync(foto.volledig_pad)) {
    return res.status(404).json({ fout: 'Bestand niet gevonden' });
  }

  // Electron: gebruik shell.openPath (werkt op Windows, Mac én Linux)
  if (global.electronOpenExtern) {
    global.electronOpenExtern(foto.volledig_pad).then(err => {
      if (err) console.warn('shell.openPath fout:', err);
    });
    return res.json({ ok: true, methode: 'electron' });
  }

  // Standalone Linux: VLC of xdg-open
  const { spawn, spawnSync, execFileSync } = require('child_process');

  const env = {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':0',
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS
      || `unix:path=/run/user/${process.getuid?.() || 1000}/bus`,
  };

  let vlcBeschikbaar = false;
  try { execFileSync('which', ['vlc'], { env, stdio: 'pipe' }); vlcBeschikbaar = true; } catch (_) {}

  const mouseX = parseInt(req.body?.mouseX) || null;
  const mouseY = parseInt(req.body?.mouseY) || null;

  if (vlcBeschikbaar) {
    const child = spawn('vlc', ['--started-from-file', foto.volledig_pad], {
      detached: true, stdio: 'ignore', env,
    });
    child.unref();

    setTimeout(() => {
      const xdotoolBeschikbaar = spawnSync('which', ['xdotool'], { env, stdio: 'pipe' }).status === 0;
      if (xdotoolBeschikbaar) {
        spawnSync('xdotool', [
          'search', '--name', 'VLC media player',
          'windowactivate', '--sync', 'windowraise',
        ], { env, stdio: 'ignore', timeout: 3000 });

        if (mouseX !== null && mouseY !== null) {
          const wmctrlBeschikbaar = spawnSync('which', ['wmctrl'], { env, stdio: 'pipe' }).status === 0;
          if (wmctrlBeschikbaar) {
            const x = Math.max(0, mouseX - 640);
            const y = Math.max(0, mouseY - 360);
            spawnSync('wmctrl', ['-a', 'VLC media player', '-e', `0,${x},${y},-1,-1`],
              { env, stdio: 'ignore' });
          }
        }
      }
    }, 900);
  } else {
    const child = spawn('xdg-open', [foto.volledig_pad], {
      detached: true, stdio: 'ignore', env,
    });
    child.unref();
  }

  res.json({ ok: true, vlc: vlcBeschikbaar });
});

// Toon een bestand in de bestandsbeheerder (map openen + bestand geselecteerd).
// Werkt voor het hoofdpad én elke duplicaat-locatie. Cross-platform.
router.post('/fotos/:id/toon-in-map', (req, res) => {
  const db = getDb();
  const foto = db.prepare('SELECT volledig_pad FROM fotos WHERE id = ?').get(req.params.id);
  db.close();
  if (!foto) return res.status(404).json({ fout: 'Foto niet gevonden' });

  const doelPad = foto.volledig_pad;
  const bestaat = doelPad && fs.existsSync(doelPad);
  // Als het bestand zelf weg is, openen we de map eromheen zodat de gebruiker
  // toch de locatie ziet en kan kijken wat er nog staat.
  const mapPad = bestaat ? path.dirname(doelPad) : (doelPad ? path.dirname(doelPad) : null);
  if (!mapPad || !fs.existsSync(mapPad)) {
    return res.status(404).json({ fout: 'Locatie niet gevonden op deze computer', pad: doelPad });
  }

  // Electron: shell.showItemInFolder selecteert het bestand in de verkenner
  if (global.electronRevealInFolder && bestaat) {
    try { global.electronRevealInFolder(doelPad); return res.json({ ok: true, methode: 'electron', geselecteerd: true }); }
    catch (e) { console.warn('reveal fout:', e.message); }
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
      // Windows: verkenner openen met het bestand geselecteerd
      if (bestaat) spawn('explorer', ['/select,', doelPad], { detached: true, stdio: 'ignore' }).unref();
      else spawn('explorer', [mapPad], { detached: true, stdio: 'ignore' }).unref();
      return res.json({ ok: true, methode: 'explorer', geselecteerd: bestaat });
    }
    if (platform === 'darwin') {
      // macOS: Finder openen met het bestand geselecteerd (-R = reveal)
      if (bestaat) spawn('open', ['-R', doelPad], { detached: true, stdio: 'ignore' }).unref();
      else spawn('open', [mapPad], { detached: true, stdio: 'ignore' }).unref();
      return res.json({ ok: true, methode: 'open', geselecteerd: bestaat });
    }
    // Linux: probeer via de freedesktop-standaard het bestand te selecteren
    if (bestaat) {
      const uri = 'file://' + encodeURI(doelPad).replace(/#/g, '%23');
      const dbus = spawnSync('dbus-send', [
        '--session', '--print-reply', '--dest=org.freedesktop.FileManager1',
        '--type=method_call', '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1.ShowItems',
        `array:string:${uri}`, 'string:',
      ], { env, stdio: 'ignore', timeout: 4000 });
      if (dbus.status === 0) return res.json({ ok: true, methode: 'dbus', geselecteerd: true });
    }
    // Fallback (Linux of als dbus faalt): map openen zonder selectie
    spawn('xdg-open', [mapPad], { detached: true, stdio: 'ignore', env }).unref();
    return res.json({ ok: true, methode: 'xdg-open', geselecteerd: false });
  } catch (e) {
    return res.status(500).json({ fout: 'kon bestandsbeheerder niet openen', detail: e.message });
  }
});

// === FOTO BEWERKEN ===

router.put('/fotos/:id', (req, res) => {
  const { gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres, datum_foto, google_description } = req.body;
  const db = getDb();

  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) { db.close(); return res.status(404).json({ fout: 'Foto niet gevonden' }); }

  // Datum parsing
  let jaar = null, maand = null, dag = null;
  if (datum_foto) {
    const d = new Date(datum_foto);
    if (!isNaN(d)) { jaar = d.getFullYear(); maand = d.getMonth() + 1; dag = d.getDate(); }
  }

  // Gebruik de gestuurde waarde als die aanwezig is (ook null = wis); anders houd de DB-waarde
  const eindLat      = gps_lat       !== undefined ? gps_lat       : foto.gps_lat;
  const eindLon      = gps_lon       !== undefined ? gps_lon       : foto.gps_lon;
  const eindStad     = gps_stad      !== undefined ? gps_stad      : foto.gps_stad;
  const eindLand     = gps_land      !== undefined ? gps_land      : foto.gps_land;
  const eindLandCode = gps_land_code !== undefined ? gps_land_code : foto.gps_land_code;
  const eindAdres    = gps_adres     !== undefined ? gps_adres     : foto.gps_adres;

  db.prepare(`
    UPDATE fotos SET
      gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?,
      datum_foto = ?, jaar = ?, maand = ?, dag = ?,
      google_description = ?
    WHERE id = ?
  `).run(
    eindLat, eindLon, eindStad, eindLand, eindLandCode, eindAdres,
    datum_foto ?? foto.datum_foto,
    jaar ?? foto.jaar,
    maand ?? foto.maand,
    dag ?? foto.dag,
    google_description ?? foto.google_description,
    req.params.id
  );

  // Propageer GPS-wijziging naar alle duplicaten in dezelfde groep
  const heeftGpsUpdate = [gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres].some(v => v !== undefined);
  if (heeftGpsUpdate && foto.duplicaat_groep) {
    const dupUpdate = db.prepare(`
      UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
      WHERE duplicaat_groep = ? AND id != ?
    `);
    dupUpdate.run(eindLat, eindLon, eindStad, eindLand, eindLandCode, eindAdres, foto.duplicaat_groep, req.params.id);
  }

  const bijgewerkt = db.prepare(`
    SELECT f.*, b.naam as bron_naam, b.icoon as bron_icoon
    FROM fotos f JOIN bronnen b ON f.bron_id = b.id WHERE f.id = ?
  `).get(req.params.id);
  db.close();
  res.json(bijgewerkt);
});

// GPS toewijzen aan foto + alle duplicaten in zelfde groep
router.post('/fotos/:id/gps', (req, res) => {
  const { gps_lat, gps_lon, gps_stad, gps_land, gps_land_code, gps_adres } = req.body;
  if (!gps_lat || !gps_lon) return res.status(400).json({ fout: 'gps_lat en gps_lon zijn verplicht' });

  const db = getDb();
  const foto = db.prepare('SELECT id, duplicaat_groep FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) { db.close(); return res.status(404).json({ fout: 'Foto niet gevonden' }); }

  const updateGps = db.prepare(`
    UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
    WHERE id = ?
  `);

  let aantalBijgewerkt = 0;

  if (foto.duplicaat_groep) {
    // Wijs GPS toe aan alle duplicaten in dezelfde groep
    const duplicaten = db.prepare('SELECT id FROM fotos WHERE duplicaat_groep = ?').all(foto.duplicaat_groep);
    for (const dup of duplicaten) {
      updateGps.run(gps_lat, gps_lon, gps_stad || null, gps_land || null, gps_land_code || null, gps_adres || null, dup.id);
      aantalBijgewerkt++;
    }
  } else {
    updateGps.run(gps_lat, gps_lon, gps_stad || null, gps_land || null, gps_land_code || null, gps_adres || null, foto.id);
    aantalBijgewerkt = 1;
  }

  db.close();
  res.json({ ok: true, bijgewerkt: aantalBijgewerkt });
});

// GPS propagatie via scanner functie (deelt ook naar originelen zonder gps_lat)
router.post('/scan/gps-propageren', (req, res) => {
  try {
    const bijgewerkt = propageerGpsInGroepen();
    res.json({ ok: true, bijgewerkt });
  } catch (e) {
    res.status(500).json({ ok: false, fout: e.message });
  }
});

// GPS automatisch delen binnen alle duplicaatgroepen
router.post('/duplicaten/gps-delen', (req, res) => {
  const db = getDb();

  // Vind alle groepen waar minstens één foto GPS heeft
  const groepen = db.prepare(`
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

  let totaalBijgewerkt = 0;
  for (const g of groepen) {
    const info = update.run(g.lat, g.lon, g.stad, g.land, g.land_code, g.adres, g.duplicaat_groep);
    totaalBijgewerkt += info.changes;
  }

  db.close();
  console.log(`🌍 GPS gedeeld: ${totaalBijgewerkt} foto's bijgewerkt in ${groepen.length} groepen`);
  res.json({ ok: true, bijgewerkt: totaalBijgewerkt, groepen: groepen.length });
});

// Datum herstellen voor foto's zonder datum — via bestandsnaam of bestandsaanmaakdatum
router.post('/fotos/herstel-datum', (req, res) => {
  const db = getDb();
  const zonderDatum = db.prepare("SELECT id, bestandsnaam, volledig_pad FROM fotos WHERE datum_foto IS NULL").all();

  let bijgewerkt = 0;
  const update = db.prepare("UPDATE fotos SET datum_foto = ?, jaar = ?, maand = ?, dag = ? WHERE id = ?");

  for (const foto of zonderDatum) {
    // Stap 1: datum uit bestandsnaam
    let datum = parseDatumUitBestandsnaam(foto.bestandsnaam);

    // Stap 2: bestandsaanmaakdatum (birthtime of mtime)
    if (!datum) {
      try {
        const stat = require('fs').statSync(foto.volledig_pad);
        datum = (stat.birthtime || stat.mtime).toISOString();
      } catch (_) {}
    }

    if (datum) {
      const d = new Date(datum);
      update.run(datum, d.getFullYear(), d.getMonth() + 1, d.getDate(), foto.id);
      bijgewerkt++;
    }
  }

  db.close();
  console.log(`📅 Datum hersteld: ${bijgewerkt} / ${zonderDatum.length} foto's bijgewerkt`);
  res.json({ ok: true, totaal: zonderDatum.length, bijgewerkt });
});

function parseDatumUitBestandsnaam(naam) {
  const match = naam.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
  if (!match) return null;
  const [, jaar, maand, dag] = match.map(Number);
  if (jaar < 1950 || jaar > 2100 || maand < 1 || maand > 12 || dag < 1 || dag > 31) return null;
  return `${jaar}-${String(maand).padStart(2,'0')}-${String(dag).padStart(2,'0')}T00:00:00.000Z`;
}

// === DUPLICATEN ===

router.get('/duplicaten', (req, res) => {
  const db = getDb();
  const { pagina = 1, per_pagina = 20 } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(per_pagina);

  const groepen = db.prepare(`
    SELECT duplicaat_groep, COUNT(*) as aantal,
           MIN(datum_foto) as datum, MIN(bestandsnaam) as voorbeeld_naam
    FROM fotos WHERE duplicaat_groep IS NOT NULL
    GROUP BY duplicaat_groep
    HAVING COUNT(*) > 1
    ORDER BY aantal DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(per_pagina), offset);

  const totaalGroepen = db.prepare(`
    SELECT COUNT(*) as n FROM (
      SELECT duplicaat_groep FROM fotos WHERE duplicaat_groep IS NOT NULL
      GROUP BY duplicaat_groep HAVING COUNT(*) > 1
    )
  `).get().n;

  // Per groep de foto's ophalen
  const result = groepen.map(groep => {
    const fotos = db.prepare(`
      SELECT f.id, f.bestandsnaam, f.volledig_pad, f.bestandsgrootte,
             f.datum_foto, f.thumbnail, f.bron_id, f.gps_lat, f.gps_stad, f.gps_land,
             b.naam as bron_naam, b.icoon as bron_icoon, b.type as bron_type
      FROM fotos f JOIN bronnen b ON f.bron_id = b.id
      WHERE f.duplicaat_groep = ?
    `).all(groep.duplicaat_groep);
    return { ...groep, fotos };
  });

  db.close();
  res.json({ groepen: result, totaal_groepen: totaalGroepen, pagina: parseInt(pagina) });
});

// Bepaal welk exemplaar in een duplicaatgroep het origineel (= behouden) is.
// Delegeert naar de gedeelde keeper-logica (src/keeper.js) zodat backend,
// export én frontend exact dezelfde keuze maken. verplicht=false: geeft null
// terug ("keuze nodig") als geen enkele bron in de groep gerangschikt is —
// het wisflow slaat zulke groepen dan veilig over.
function bepaalOrigineel(fotos, bronVolgorde, handmatigId) {
  return bepaalKeeper(fotos, bronVolgorde, handmatigId, { verplicht: false });
}

// Verzamel per groep de keeper + te-wissen kopieën, op basis van prioriteit/handmatige keuze.
// groepFilter (optioneel): enkel deze hash verwerken.
function verzamelDuplicaatPlan(db, bronVolgorde, handmatig, groepFilter) {
  const waar = groepFilter
    ? 'WHERE f.duplicaat_groep = ?'
    : 'WHERE f.duplicaat_groep IS NOT NULL';
  const rijen = groepFilter
    ? db.prepare(`SELECT f.id, f.bron_id, f.duplicaat_groep, f.volledig_pad, f.bestandsgrootte FROM fotos f ${waar}`).all(groepFilter)
    : db.prepare(`SELECT f.id, f.bron_id, f.duplicaat_groep, f.volledig_pad, f.bestandsgrootte FROM fotos f ${waar}`).all();

  const perGroep = new Map();
  for (const r of rijen) {
    if (!perGroep.has(r.duplicaat_groep)) perGroep.set(r.duplicaat_groep, []);
    perGroep.get(r.duplicaat_groep).push(r);
  }

  const teWissen = [];          // foto-objecten die naar de prullenbak gaan
  let keuzeNodig = 0;           // aantal groepen dat nog een keuze vereist
  let groepenKlaar = 0;
  for (const [groep, fotos] of perGroep) {
    const keeper = bepaalOrigineel(fotos, bronVolgorde, handmatig ? handmatig[groep] : undefined);
    if (keeper == null) { keuzeNodig++; continue; }
    groepenKlaar++;
    for (const f of fotos) if (f.id !== keeper) teWissen.push(f);
  }
  return { teWissen, keuzeNodig, groepenKlaar };
}

// Schoon duplicaat-restanten op: als een groep nog maar <= 1 foto telt,
// is die foto geen duplicaat meer → is_duplicaat=0 en duplicaat_groep=NULL.
// groepen: array van duplicaat_groep-hashes die mogelijk opgeschoond moeten worden.
function schoonDuplicaatGroepenOp(db, groepen) {
  let opgeschoond = 0;
  const uniek = [...new Set((groepen || []).filter(Boolean))];
  const telPrep = db.prepare('SELECT COUNT(*) as n FROM fotos WHERE duplicaat_groep = ?');
  const wisPrep = db.prepare('UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL WHERE duplicaat_groep = ?');
  for (const g of uniek) {
    if (telPrep.get(g).n <= 1) opgeschoond += wisPrep.run(g).changes;
  }
  return opgeschoond;
}

// Bepaal de te gebruiken prioriteit voor een request.
// - Komt de prioriteit in de body mee? Gebruik die én sla ze op in de DB (sync).
// - Anders: lees de opgeslagen prioriteit uit de DB.
// Zo zijn frontend (localStorage) en backend/export altijd consistent.
function resolvePrioriteit(db, body) {
  const heeftBron = body && Array.isArray(body.bronVolgorde);
  const heeftHand = body && body.handmatig && typeof body.handmatig === 'object';
  if (heeftBron || heeftHand) {
    schrijfPrioriteit(db, heeftBron ? body.bronVolgorde : undefined, heeftHand ? body.handmatig : undefined);
  }
  return leesPrioriteit(db);
}

// === DUPLICATEN PRIORITEIT (gedeeld tussen frontend en backend) ===

router.get('/duplicaten/prioriteit', (req, res) => {
  const db = getDb();
  try {
    res.json(leesPrioriteit(db));
  } finally {
    db.close();
  }
});

router.post('/duplicaten/prioriteit', (req, res) => {
  const db = getDb();
  try {
    const { bronVolgorde, handmatig } = req.body || {};
    schrijfPrioriteit(db, bronVolgorde, handmatig);
    res.json({ ok: true, ...leesPrioriteit(db) });
  } catch (e) {
    res.status(500).json({ fout: 'opslaan mislukt', detail: e.message });
  } finally {
    db.close();
  }
});

// Voorbeeld van wat er gewist zou worden (voor de bevestiging) — wist niets.
router.post('/duplicaten/wis-preview', (req, res) => {
  const db = getDb();
  try {
    const { groep = null } = req.body || {};
    const { bronVolgorde, handmatig } = resolvePrioriteit(db, req.body);
    const { teWissen, keuzeNodig, groepenKlaar } = verzamelDuplicaatPlan(db, bronVolgorde, handmatig, groep);
    const bytes = teWissen.reduce((s, f) => s + (f.bestandsgrootte || 0), 0);
    db.close();
    res.json({ ok: true, bestanden: teWissen.length, bytes, groepenKlaar, keuzeNodig });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'preview mislukt', detail: e.message });
  }
});

// Wis de duplicaten (alle kopieën behalve het origineel) → prullenbak + uit database.
// Groepen die nog een keuze vereisen worden overgeslagen.
router.post('/duplicaten/wis', async (req, res) => {
  const db = getDb();
  try {
    const { groep = null } = req.body || {};
    const { bronVolgorde, handmatig } = resolvePrioriteit(db, req.body);
    const { teWissen, keuzeNodig } = verzamelDuplicaatPlan(db, bronVolgorde, handmatig, groep);

    if (teWissen.length === 0) {
      db.close();
      return res.json({ ok: true, verwijderd: 0, naarPrullenbak: 0, bytesVrij: 0, overgeslagen: keuzeNodig });
    }

    // Splits bestaande vs. al ontbrekende bestanden
    const bestaande = [], ontbrekendeIds = [];
    for (const f of teWissen) {
      if (f.volledig_pad && fs.existsSync(f.volledig_pad)) bestaande.push(f);
      else ontbrekendeIds.push(f.id);
    }

    let trash;
    try { trash = require('trash'); }
    catch (e) { db.close(); return res.status(500).json({ fout: 'prullenbak-module niet beschikbaar', detail: e.message }); }

    const naarPrullenbakIds = [];
    let bytesVrij = 0;
    if (bestaande.length) {
      try {
        await trash(bestaande.map(f => f.volledig_pad));
        for (const f of bestaande) { naarPrullenbakIds.push(f.id); bytesVrij += f.bestandsgrootte || 0; }
      } catch (batchErr) {
        for (const f of bestaande) {
          try { await trash(f.volledig_pad); naarPrullenbakIds.push(f.id); bytesVrij += f.bestandsgrootte || 0; }
          catch (_) { /* dit bestand overslaan */ }
        }
      }
    }

    const teVerwijderen = [...naarPrullenbakIds, ...ontbrekendeIds];
    if (teVerwijderen.length) {
      const ph = teVerwijderen.map(() => '?').join(',');
      db.prepare(`DELETE FROM fotos WHERE id IN (${ph})`).run(...teVerwijderen);
    }

    // Keeper(s) van getroffen groepen opschonen: geen kopie meer = geen duplicaat meer
    const verwijderdeSet = new Set(teVerwijderen);
    const getroffenGroepen = teWissen.filter(f => verwijderdeSet.has(f.id)).map(f => f.duplicaat_groep);
    schoonDuplicaatGroepenOp(db, getroffenGroepen);

    db.close();
    res.json({
      ok: true,
      verwijderd: teVerwijderen.length,
      naarPrullenbak: naarPrullenbakIds.length,
      bytesVrij,
      overgeslagen: keuzeNodig
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'wissen mislukt', detail: e.message });
  }
});

// === DATABASE WIS ===

router.post('/database/wis', (req, res) => {
  const db = getDb();
  db.exec(`
    DELETE FROM fotos;
    DELETE FROM scan_log;
    UPDATE bronnen SET totaal_fotos = 0, laatste_scan = NULL;
    DELETE FROM instellingen WHERE sleutel IN ('dup_bron_volgorde', 'dup_handmatig');
  `);
  db.close();
  console.log('🗑️  Database gewist door gebruiker (bronnen behouden, duplicaat-prioriteit gereset)');
  res.json({ ok: true });
});

// === MAP BROWSER ===

router.get('/mappen', (req, res) => {
  const pad = req.query.pad || require('os').homedir();
  try {
    const items = fs.readdirSync(pad, { withFileTypes: true });
    const mappen = items
      .filter(i => i.isDirectory() && !i.name.startsWith('.'))
      .map(i => ({ naam: i.name, pad: path.join(pad, i.name) }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
    const ouder = path.dirname(pad) !== pad ? path.dirname(pad) : null;
    res.json({ huidig: pad, ouder, mappen });
  } catch (e) {
    res.status(400).json({ fout: e.message });
  }
});

// === KAART DATA ===

// Thumbnail als echte afbeelding serveren (browser cached dit)
router.get('/fotos/:id/thumbnail', (req, res) => {
  // Gedeelde, langlevende leesverbinding: dit endpoint wordt per pagina ~50x
  // aangeroepen; telkens een nieuwe verbinding openen liet de app vastlopen.
  const db = getSharedDb();
  const foto = db.prepare('SELECT thumbnail FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto?.thumbnail) return res.status(404).send('Geen thumbnail');
  const [header, b64] = foto.thumbnail.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(b64, 'base64'));
});

// Locatie-clusters voor de kaart (gegroepeerd op ~1km raster)
router.get('/kaart/locaties', (req, res) => {
  const { is_video } = req.query;
  const db = getDb();
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (is_video IS NULL OR is_video = 0)';

  const locaties = db.prepare(`
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
  res.json(locaties);
});

// Foto's op een specifieke locatie (voor het slide-up panel)
router.get('/kaart/fotos', (req, res) => {
  const { lat, lon, limit = 40, zonder_kopien = '1', is_video } = req.query;
  if (!lat || !lon) return res.status(400).json({ fout: 'lat en lon vereist' });
  const db = getDb();

  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Keeper-set via de gedeelde logica → het behouden exemplaar op de kaart
  // komt overeen met het detailvenster, de duplicaten-pagina én de export.
  const keepers = keeperIds(db);

  const rijen = db.prepare(`
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

  let fotos = rijen.map(f => ({
    ...f,
    is_origineel: f.duplicaat_groep && keepers.has(f.id) ? 1 : 0
  }));
  // Kopieën verbergen: toon niet-duplicaten + het behouden exemplaar per groep
  if (zonder_kopien === '1') {
    fotos = fotos.filter(f => !f.is_duplicaat || f.is_origineel);
  }
  fotos = fotos.slice(0, parseInt(limit));
  res.json(fotos);
});

// === GPS BULK TOEWIJZEN ===

// GET /api/gps/groepen — groepeer foto's zonder GPS op tijdblok (2u gap = nieuwe groep)
router.get('/gps/groepen', (req, res) => {
  const db = getDb();

  // Type-filter: '' = alles, '0' = alleen foto's, '1' = alleen video's
  const { is_video } = req.query;
  let typeFilter = '';
  if (is_video === '1') typeFilter = 'AND f.is_video = 1';
  else if (is_video === '0') typeFilter = 'AND (f.is_video IS NULL OR f.is_video = 0)';

  // Alleen originelen tonen — kopieën worden via GPS propagatie meegewijzigd
  const origineelFilter = `
    AND (f.duplicaat_groep IS NULL
      OR f.id = (SELECT MIN(id) FROM fotos WHERE duplicaat_groep = f.duplicaat_groep))
  `;

  const metDatum = db.prepare(`
    SELECT f.id, f.datum_foto, f.thumbnail IS NOT NULL as heeft_thumb
    FROM fotos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND f.datum_foto IS NOT NULL AND f.datum_foto != ''
      ${typeFilter}
      ${origineelFilter}
    ORDER BY f.datum_foto ASC
  `).all();

  const zonderDatum = db.prepare(`
    SELECT f.id, f.thumbnail IS NOT NULL as heeft_thumb
    FROM fotos f
    WHERE (f.gps_lat IS NULL OR f.gps_lat = 0)
      AND (f.datum_foto IS NULL OR f.datum_foto = '')
      ${typeFilter}
      ${origineelFilter}
    ORDER BY f.id ASC
  `).all();

  db.close();

  const GAP_MS = 2 * 60 * 60 * 1000; // 2 uur
  const groepen = [];
  let huidigeGroep = null;

  for (const foto of metDatum) {
    const ts = new Date(foto.datum_foto).getTime();
    if (isNaN(ts)) continue;
    if (!huidigeGroep || ts - huidigeGroep.lastTs > GAP_MS) {
      huidigeGroep = { datumStart: foto.datum_foto, datumEind: foto.datum_foto, lastTs: ts, ids: [], voorbeelden: [] };
      groepen.push(huidigeGroep);
    }
    huidigeGroep.datumEind = foto.datum_foto;
    huidigeGroep.lastTs = ts;
    huidigeGroep.ids.push(foto.id);
    if (huidigeGroep.voorbeelden.length < 6 && foto.heeft_thumb) huidigeGroep.voorbeelden.push(foto.id);
  }

  const result = groepen.map((g, i) => ({
    groep_id: i,
    datum_start: g.datumStart,
    datum_eind: g.datumEind,
    aantal: g.ids.length,
    ids: g.ids,
    voorbeelden: g.voorbeelden
  }));

  if (zonderDatum.length > 0) {
    result.push({
      groep_id: result.length,
      datum_start: null,
      datum_eind: null,
      aantal: zonderDatum.length,
      ids: zonderDatum.map(f => f.id),
      voorbeelden: zonderDatum.filter(f => f.heeft_thumb).slice(0, 6).map(f => f.id)
    });
  }

  res.json(result);
});

// POST /api/gps/bulk-toewijzen — wijs locatie toe aan meerdere foto's + hun duplicaten
router.post('/gps/bulk-toewijzen', (req, res) => {
  const { ids, gps_stad, gps_land, gps_lat, gps_lon, gps_land_code, gps_adres } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ fout: 'ids verplicht' });
  }
  const db = getDb();

  // Verzamel alle duplicaat_groep waarden van de opgegeven foto's
  const placeholders = ids.map(() => '?').join(',');
  const groepen = db.prepare(
    `SELECT DISTINCT duplicaat_groep FROM fotos WHERE id IN (${placeholders}) AND duplicaat_groep IS NOT NULL`
  ).all(...ids).map(r => r.duplicaat_groep);

  const gpsVelden = [gps_stad || null, gps_land || null, gps_lat || null, gps_lon || null, gps_land_code || null, gps_adres || null];

  const updateById = db.prepare('UPDATE fotos SET gps_stad=?, gps_land=?, gps_lat=?, gps_lon=?, gps_land_code=?, gps_adres=? WHERE id=?');
  const updateDuplicaten = groepen.length > 0
    ? db.prepare(`UPDATE fotos SET gps_stad=?, gps_land=?, gps_lat=?, gps_lon=?, gps_land_code=?, gps_adres=? WHERE duplicaat_groep IN (${groepen.map(() => '?').join(',')})`)
    : null;

  const updateAll = db.transaction(() => {
    // Wijs toe aan opgegeven foto's
    for (const id of ids) updateById.run(...gpsVelden, id);
    // Propageer naar alle duplicaten in dezelfde groepen
    if (updateDuplicaten) updateDuplicaten.run(...gpsVelden, ...groepen);
  });

  updateAll();
  // Tel totaal bijgewerkte records (directe + duplicaten)
  const totaal = db.prepare(`SELECT COUNT(*) as n FROM fotos WHERE id IN (${placeholders})${groepen.length ? ` OR duplicaat_groep IN (${groepen.map(() => '?').join(',')})` : ''}`).get(...ids, ...groepen).n;
  db.close();
  res.json({ bijgewerkt: totaal, duplicaten_bijgewerkt: groepen.length > 0 });
});

// === FASE ===

router.get('/fase', (req, res) => {
  const db = getDb();
  const rij = db.prepare("SELECT waarde FROM instellingen WHERE sleutel = 'fase'").get();
  db.close();
  res.json({ fase: parseInt(rij?.waarde || '1') });
});

router.post('/fase', (req, res) => {
  const { fase } = req.body;
  if (![1, 2, 3].includes(fase)) return res.status(400).json({ fout: 'fase moet 1, 2 of 3 zijn' });
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO instellingen (sleutel, waarde) VALUES ('fase', ?)").run(String(fase));
  db.close();
  res.json({ fase });
});

// Markeer foto als "locatie onbekend" (en propageer naar duplicaten)
router.post('/fotos/:id/locatie-onbekend', (req, res) => {
  const db = getDb();
  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) { db.close(); return res.status(404).json({ fout: 'niet gevonden' }); }
  db.prepare('UPDATE fotos SET locatie_onbekend = 1 WHERE id = ?').run(foto.id);
  if (foto.duplicaat_groep) {
    db.prepare('UPDATE fotos SET locatie_onbekend = 1 WHERE duplicaat_groep = ?').run(foto.duplicaat_groep);
  }
  db.close();
  res.json({ ok: true });
});

// Markeer foto als genegeerd (fase 2) — cascadeert naar alle duplicaten in dezelfde groep
router.post('/fotos/:id/negeer', (req, res) => {
  const db = getDb();
  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) { db.close(); return res.status(404).json({ fout: 'niet gevonden' }); }
  const waarde = req.body.genegeerd !== false ? 1 : 0;

  // Zet altijd de aangeklikte foto
  db.prepare('UPDATE fotos SET genegeerd = ? WHERE id = ?').run(waarde, foto.id);

  // Als de foto deel uitmaakt van een duplicaatgroep: cascade naar alle groepsleden
  let aantalGewijzigd = 1;
  if (foto.duplicaat_groep) {
    const result = db.prepare(
      'UPDATE fotos SET genegeerd = ? WHERE duplicaat_groep = ? AND id != ?'
    ).run(waarde, foto.duplicaat_groep, foto.id);
    aantalGewijzigd += result.changes;
  }

  db.close();
  res.json({ ok: true, genegeerd: waarde === 1, aantalGewijzigd });
});

// Bulk: markeer meerdere foto's tegelijk als genegeerd / niet-genegeerd (fase C batch).
// Body: { ids: [..], genegeerd: true|false }. Cascadeert per foto over de duplicaatgroep,
// zodat een hele groep consistent mee-genegeerd wordt (zelfde regel als /fotos/:id/negeer).
router.post('/fotos/negeer-bulk', (req, res) => {
  const db = getDb();
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) { return res.status(400).json({ fout: 'geen ids' }); }
    const waarde = req.body.genegeerd !== false ? 1 : 0;

    const zetFoto   = db.prepare('UPDATE fotos SET genegeerd = ? WHERE id = ?');
    const zetGroep  = db.prepare('UPDATE fotos SET genegeerd = ? WHERE duplicaat_groep = ? AND id != ?');
    const haalFoto  = db.prepare('SELECT id, duplicaat_groep FROM fotos WHERE id = ?');

    let aantalGewijzigd = 0;
    const tx = db.transaction(() => {
      for (const id of ids) {
        const foto = haalFoto.get(id);
        if (!foto) continue;
        zetFoto.run(waarde, foto.id);
        aantalGewijzigd += 1;
        if (foto.duplicaat_groep) {
          aantalGewijzigd += zetGroep.run(waarde, foto.duplicaat_groep, foto.id).changes;
        }
      }
    });
    tx();

    res.json({ ok: true, genegeerd: waarde === 1, aantalGevraagd: ids.length, aantalGewijzigd });
  } finally {
    db.close();
  }
});

// Verwijder ALLE genegeerde foto's definitief: naar prullenbak + uit database
// - selecteert alle genegeerd=1 foto's
// - cascade: hele duplicaatgroep van elke genegeerde foto wordt meegenomen
// - bestanden gaan naar de systeem-prullenbak (herstelbaar), niet permanent gewist
// - DB-records worden verwijderd zodat ze niet opnieuw gescand worden
router.post('/genegeerd/verwijder', async (req, res) => {
  const db = getDb();
  try {
    // 1. Alle genegeerde foto's
    const genegeerd = db.prepare('SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE genegeerd = 1').all();

    // 2. Cascade: voeg alle leden van betrokken duplicaatgroepen toe
    const groepen = [...new Set(genegeerd.map(f => f.duplicaat_groep).filter(Boolean))];
    const idMap = new Map();
    for (const f of genegeerd) idMap.set(f.id, f);
    if (groepen.length) {
      const ph = groepen.map(() => '?').join(',');
      const leden = db.prepare(
        `SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE duplicaat_groep IN (${ph})`
      ).all(...groepen);
      for (const f of leden) idMap.set(f.id, f);
    }

    const alle = [...idMap.values()];
    if (alle.length === 0) {
      db.close();
      return res.json({ ok: true, verwijderd: 0, naarPrullenbak: 0, ontbrak: 0 });
    }

    // 3. Splits in bestanden die nog bestaan vs. al ontbrekend
    const bestaande = [];
    const ontbrekendeIds = [];
    for (const f of alle) {
      if (f.volledig_pad && fs.existsSync(f.volledig_pad)) bestaande.push(f);
      else ontbrekendeIds.push(f.id);
    }

    // 4. Verplaats bestaande bestanden naar de prullenbak
    let trash;
    try {
      trash = require('trash');
    } catch (e) {
      db.close();
      return res.status(500).json({ fout: 'prullenbak-module niet beschikbaar', detail: e.message });
    }

    const naarPrullenbakIds = [];
    const mislukt = [];
    if (bestaande.length) {
      try {
        // Batch: alles in één keer naar de prullenbak
        await trash(bestaande.map(f => f.volledig_pad));
        for (const f of bestaande) naarPrullenbakIds.push(f.id);
      } catch (batchErr) {
        // Fallback: bestand voor bestand, zo verliezen we niet alles bij één fout
        for (const f of bestaande) {
          try { await trash(f.volledig_pad); naarPrullenbakIds.push(f.id); }
          catch (e) { mislukt.push({ id: f.id, pad: f.volledig_pad, fout: e.message }); }
        }
      }
    }

    // 5. Verwijder DB-records: alles wat naar prullenbak ging + alles wat al ontbrak
    const teVerwijderen = [...naarPrullenbakIds, ...ontbrekendeIds];
    if (teVerwijderen.length) {
      const ph = teVerwijderen.map(() => '?').join(',');
      db.prepare(`DELETE FROM fotos WHERE id IN (${ph})`).run(...teVerwijderen);
    }

    // Eventuele restanten van betrokken groepen opschonen (bv. bij mislukte trash)
    schoonDuplicaatGroepenOp(db, groepen);

    db.close();
    res.json({
      ok: true,
      verwijderd: teVerwijderen.length,
      naarPrullenbak: naarPrullenbakIds.length,
      ontbrak: ontbrekendeIds.length,
      mislukt
    });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'verwijderen mislukt', detail: e.message });
  }
});

// Verwijder ÉÉN foto definitief: bestand naar prullenbak + DB-record weg
// (herstelbaar via systeem-prullenbak, niet permanent gewist)
router.post('/fotos/:id/verwijder', async (req, res) => {
  const db = getDb();
  try {
    const foto = db.prepare('SELECT id, volledig_pad, duplicaat_groep FROM fotos WHERE id = ?').get(req.params.id);
    if (!foto) { db.close(); return res.status(404).json({ fout: 'niet gevonden' }); }

    let naarPrullenbak = false;
    if (foto.volledig_pad && fs.existsSync(foto.volledig_pad)) {
      let trash;
      try { trash = require('trash'); }
      catch (e) { db.close(); return res.status(500).json({ fout: 'prullenbak-module niet beschikbaar', detail: e.message }); }
      try { await trash(foto.volledig_pad); naarPrullenbak = true; }
      catch (e) { db.close(); return res.status(500).json({ fout: 'kon bestand niet naar prullenbak verplaatsen', detail: e.message }); }
    }

    db.prepare('DELETE FROM fotos WHERE id = ?').run(foto.id);
    // Restant van de duplicaatgroep opschonen: 1 over = geen duplicaat meer
    if (foto.duplicaat_groep) schoonDuplicaatGroepenOp(db, [foto.duplicaat_groep]);
    db.close();
    res.json({ ok: true, naarPrullenbak, ontbrak: !naarPrullenbak });
  } catch (e) {
    try { db.close(); } catch (_) {}
    res.status(500).json({ fout: 'verwijderen mislukt', detail: e.message });
  }
});

// Stats voor fase 1 todo
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

// === FASE 3: EXPORT ===

// Bereken wat er geëxporteerd gaat worden (preview)
router.get('/export/preview', (req, res) => {
  const doelmap = req.query.doelmap || '';
  try {
    const preview = berekenPreview(doelmap || null);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ fout: err.message });
  }
});

// Start de export
router.post('/export/start', async (req, res) => {
  const { doelmap } = req.body;
  if (!doelmap) return res.status(400).json({ fout: 'doelmap is verplicht' });
  try {
    const result = await startExport(doelmap);
    if (result.fout) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ fout: err.message });
  }
});

// Exportstatus opvragen (polling)
router.get('/export/status', (req, res) => {
  res.json(getExportStatus());
});

// Export stoppen
router.post('/export/stop', (req, res) => {
  res.json(stopExport());
});

// Export resetten (na afloop of fout)
router.post('/export/reset', (req, res) => {
  res.json(resetExport());
});

module.exports = router;
