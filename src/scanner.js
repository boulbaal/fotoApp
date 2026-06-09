const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');
const sharp = require('sharp');
const exifr = require('exifr');
const { getDb } = require('./database');

const FOTO_EXTENSIES = new Set([
  // JPEG varianten
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
  // RAW — Adobe / universeel
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
  // Overige
  '.svg', '.ico', '.psd', '.psb',
]);

// Mappen die we overslaan (geen echte foto's)
const SKIP_MAPPEN = [
  '.cache', '.thumbnails', 'thumbnails',
  'node_modules', '.git', '.local/share/ov',
  'omni.physx', 'omni.blockworld', 'textures'
];

let scanStoppen = false;
let wachtrij = [];

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

// Geocoding pass — loopt op de achtergrond na elke scan
let geocodeStatus = {
  bezig: false,
  totaal: 0,
  gedaan: 0,
  huidig_land: ''
};

function getScanStatus() {
  return { ...scanStatus, wachtrij: [...wachtrij], geocode: { ...geocodeStatus } };
}

function getGeocodeStatus() {
  return { ...geocodeStatus };
}

// Deelt GPS-data (stad/land/code) van één exemplaar naar alle andere in dezelfde duplicaatgroep
function propageerGpsInGroepen() {
  const db = getDb();
  const groepen = db.prepare(`
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

  const propageer = db.prepare(`
    UPDATE fotos SET gps_lat = ?, gps_lon = ?, gps_stad = ?, gps_land = ?,
                     gps_land_code = ?, gps_adres = ?
    WHERE duplicaat_groep = ?
      AND (gps_land IS NULL OR gps_land = '')
  `);
  let bijgewerkt = 0;
  for (const g of groepen) {
    const info = propageer.run(g.lat, g.lon, g.stad, g.land, g.land_code, g.adres, g.duplicaat_groep);
    bijgewerkt += info.changes;
  }
  db.close();
  if (bijgewerkt > 0) console.log(`🔗 GPS gedeeld in ${groepen.length} duplicaatgroepen: ${bijgewerkt} foto's bijgewerkt`);
  return bijgewerkt;
}

// Start geocoding pass op de achtergrond — vult gps_land/stad in voor alle foto's die dat missen
async function startGeocodePass() {
  if (geocodeStatus.bezig) return; // al bezig
  geocodeStatus.bezig = true;
  geocodeStatus.gedaan = 0;
  geocodeStatus.huidig_land = '';

  const db = getDb();

  // Alle unieke locaties zonder gps_land (afgerond op 3 decimalen)
  const locaties = db.prepare(`
    SELECT ROUND(gps_lat, 3) as lat, ROUND(gps_lon, 3) as lon, COUNT(*) as n
    FROM fotos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      AND (gps_land IS NULL OR gps_land = '')
    GROUP BY ROUND(gps_lat, 3), ROUND(gps_lon, 3)
    ORDER BY n DESC
  `).all();

  geocodeStatus.totaal = locaties.length;
  db.close();

  if (locaties.length === 0) {
    // Geen nieuwe locaties te geocoden, maar wel GPS delen binnen duplicaatgroepen
    propageerGpsInGroepen();
    geocodeStatus.bezig = false;
    return;
  }

  console.log(`🌍 Geocode pass gestart: ${locaties.length} unieke locaties te verwerken`);

  const updateLocatie = (adres, lat, lon) => {
    if (!adres || !adres.gps_land) return;
    const db2 = getDb();
    db2.prepare(`
      UPDATE fotos SET gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
      WHERE ROUND(gps_lat, 3) = ? AND ROUND(gps_lon, 3) = ?
        AND (gps_land IS NULL OR gps_land = '')
    `).run(adres.gps_stad || null, adres.gps_land, adres.gps_land_code || null, adres.gps_adres || null, lat, lon);
    db2.close();
  };

  for (const loc of locaties) {
    if (scanStoppen) break; // Respect stop-vlag
    const adres = await haalGpsAdresOp(loc.lat, loc.lon);
    geocodeStatus.gedaan++;
    geocodeStatus.huidig_land = adres?.gps_land || '';
    updateLocatie(adres, loc.lat, loc.lon);
    console.log(`🌍 Geocode ${geocodeStatus.gedaan}/${geocodeStatus.totaal}: ${adres?.gps_land || 'geen resultaat'}`);
  }

  // GPS-data delen binnen duplicaatgroepen (ook originelen zonder land krijgen nu het land van de kopie)
  propageerGpsInGroepen();

  geocodeStatus.bezig = false;
  geocodeStatus.huidig_land = '';
  console.log(`✅ Geocode pass klaar: ${geocodeStatus.gedaan} locaties verwerkt`);
}

async function voegToeAanWachtrij(bronId) {
  const db = getDb();
  const bron = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(bronId);
  db.close();
  if (!bron) throw new Error('Bron niet gevonden');

  // Niet dubbel in wachtrij
  if (wachtrij.find(w => w.id === bronId)) {
    throw new Error('Bron staat al in de wachtrij');
  }
  // Niet als al bezig
  if (scanStatus.bezig && scanStatus.bron_id === bronId) {
    throw new Error('Bron is al aan het scannen');
  }

  wachtrij.push({ id: bronId, naam: bron.naam, pad: bron.pad });
  console.log(`📋 Wachtrij: ${wachtrij.map(w => w.naam).join(' → ')}`);

  // Start verwerking als niets bezig
  if (!scanStatus.bezig) verwerkWachtrij();

  return getScanStatus();
}

async function verwerkWachtrij() {
  if (scanStatus.bezig || wachtrij.length === 0) return;

  const volgende = wachtrij.shift();
  console.log(`▶ Volgende in wachtrij: ${volgende.naam}`);
  await _startScan(volgende.id);
}

function verwijderUitWachtrij(bronId) {
  wachtrij = wachtrij.filter(w => w.id !== bronId);
}

function moetOverslaan(mapPad) {
  const lager = mapPad.toLowerCase();
  return SKIP_MAPPEN.some(skip => lager.includes(skip));
}

function vindAlleFotos(startPad) {
  const fotos = [];

  function zoek(pad) {
    if (scanStoppen) return; // ← stop ook tijdens inventarisatie
    if (moetOverslaan(pad)) return;
    try {
      const items = fs.readdirSync(pad, { withFileTypes: true });
      for (const item of items) {
        if (scanStoppen) return;
        const volledigPad = path.join(pad, item.name);
        if (item.isDirectory()) {
          zoek(volledigPad);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (FOTO_EXTENSIES.has(ext)) {
            fotos.push(volledigPad);
          }
        }
      }
    } catch (e) {
      // map niet leesbaar, overslaan
    }
  }

  zoek(startPad);
  return fotos;
}

// Extraheer datum uit bestandsnaam — bijv. IMG-20250728-WA0010.jpg → 2025-07-28
function parseDatumUitBestandsnaam(naam) {
  // Zoek patroon: 4 cijfers jaar + optioneel scheidingsteken + 2 maand + 2 dag
  const match = naam.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
  if (!match) return null;
  const [, jaar, maand, dag] = match.map(Number);
  // Valideer als echte datum
  if (jaar < 1950 || jaar > 2100 || maand < 1 || maand > 12 || dag < 1 || dag > 31) return null;
  return `${jaar}-${String(maand).padStart(2,'0')}-${String(dag).padStart(2,'0')}T00:00:00.000Z`;
}

function berekenHash(bestandsPad) {
  try {
    const data = fs.readFileSync(bestandsPad);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch (e) {
    return null;
  }
}

async function maakThumbnail(bestandsPad) {
  // Stap 1: probeer sharp (werkt voor jpg/png/webp/heic/tiff/...)
  try {
    const buffer = await sharp(bestandsPad)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return 'data:image/jpeg;base64,' + buffer.toString('base64');
  } catch (_) {}

  // Stap 2: extraheer ingebedde JPEG preview uit RAW via exiftool
  // RAW bestanden bevatten altijd een camera-gegenereerde preview
  for (const tag of ['PreviewImage', 'JpgFromRaw', 'ThumbnailImage']) {
    try {
      const result = spawnSync('exiftool', ['-' + tag, '-b', bestandsPad], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000,
      });
      const previewBuffer = result.stdout;
      if (previewBuffer && previewBuffer.length > 1000) {
        const verkleind = await sharp(previewBuffer)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        return 'data:image/jpeg;base64,' + verkleind.toString('base64');
      }
    } catch (_) {}
  }

  return null;
}

function leesGoogleJson(bestandsPad) {
  // Zoek naar companion JSON bestand (Google Takeout formaat)
  const jsonPad = bestandsPad + '.json';
  if (!fs.existsSync(jsonPad)) return {};

  try {
    const data = JSON.parse(fs.readFileSync(jsonPad, 'utf8'));

    let datum = null;
    if (data.photoTakenTime && data.photoTakenTime.timestamp) {
      const ts = parseInt(data.photoTakenTime.timestamp, 10);
      if (!isNaN(ts)) {
        const d = new Date(ts * 1000);
        if (!isNaN(d)) datum = d.toISOString();
      }
    }

    let gps_lat = null, gps_lon = null;
    const geo = data.geoData || data.geoDataExif;
    if (geo && geo.latitude && geo.longitude && Math.abs(geo.latitude) > 0.001) {
      gps_lat = geo.latitude;
      gps_lon = geo.longitude;
    }

    return {
      datum: datum,
      gps_lat: gps_lat,
      gps_lon: gps_lon,
      google_description: data.description || null,
      google_device_type: data.googlePhotosOrigin?.deviceType || null
    };
  } catch (e) {
    return {};
  }
}

async function leesMetadata(bestandsPad) {
  try {
    const exif = await exifr.parse(bestandsPad, {
      tiff: true, exif: true, gps: true, ifd1: true,
      translateKeys: true, translateValues: true
    });

    if (!exif) return {};

    // Datum bepalen
    let datumFoto = null;
    const datumVelden = [
      exif.DateTimeOriginal, exif.CreateDate,
      exif.DateTime, exif.ModifyDate
    ];
    for (const d of datumVelden) {
      if (d instanceof Date && !isNaN(d)) {
        datumFoto = d.toISOString();
        break;
      }
    }

    return {
      datum_foto: datumFoto,
      jaar: datumFoto ? new Date(datumFoto).getFullYear() : null,
      maand: datumFoto ? new Date(datumFoto).getMonth() + 1 : null,
      dag: datumFoto ? new Date(datumFoto).getDate() : null,
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

// Cache: voorkomt dubbele Nominatim-calls voor dezelfde locatie tijdens een scan
const gpsCache = new Map();

async function haalGpsAdresOp(lat, lon) {
  // Rond af op 3 decimalen (~100m nauwkeurigheid) als cache-sleutel
  const sleutel = `${Math.round(lat * 1000) / 1000},${Math.round(lon * 1000) / 1000}`;
  if (gpsCache.has(sleutel)) return gpsCache.get(sleutel);

  try {
    const https = require('https');
    const resultaat = await new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const req = https.get(url, {
        headers: { 'User-Agent': 'FotoApp/1.0', 'Accept-Language': 'en' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const addr = json.address || {};
            resolve({
              gps_adres: json.display_name || null,
              gps_stad: addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || null,
              gps_land: addr.country || null,
              gps_land_code: (addr.country_code || '').toUpperCase() || null
            });
          } catch { resolve({}); }
        });
      });
      req.on('error', () => resolve({}));
      req.setTimeout(8000, () => { req.destroy(); resolve({}); });
    });

    gpsCache.set(sleutel, resultaat);
    // Nominatim policy: max 1 request per seconde — wacht alleen als het geen cache-hit was
    await new Promise(r => setTimeout(r, 1100));
    return resultaat;
  } catch (e) {
    return {};
  }
}

async function _startScan(bronId) {
  gpsCache.clear(); // Cache leegmaken bij elke nieuwe scan
  const db = getDb();
  const bron = db.prepare('SELECT * FROM bronnen WHERE id = ?').get(bronId);
  if (!bron) { db.close(); return; }

  const logResult = db.prepare(`
    INSERT INTO scan_log (bron_id, gestart, status) VALUES (?, datetime('now'), 'bezig')
  `).run(bronId);

  scanStatus = {
    bezig: true,
    bron_id: bronId,
    bron_naam: bron.naam,
    totaal: 0,
    verwerkt: 0,
    nieuw: 0,
    overgeslagen: 0,
    fouten: 0,
    huidig_bestand: 'Bestanden zoeken...',
    gestart: new Date().toISOString(),
    log_id: logResult.lastInsertRowid,
    wachtrij: [...wachtrij]
  };

  db.close();
  scanStoppen = false;
  scanAsync(bronId, bron.pad, logResult.lastInsertRowid).catch(console.error);
  return scanStatus;
}

async function startScan(bronId) {
  return voegToeAanWachtrij(bronId);
}

async function scanAsync(bronId, startPad, logId) {
  console.log(`🔍 Scan gestart: ${startPad}`);

  try {
    // Alle foto's vinden
    scanStatus.huidig_bestand = 'Bestanden inventariseren...';
    const alleFotos = vindAlleFotos(startPad);
    scanStatus.totaal = alleFotos.length;
    console.log(`📷 ${alleFotos.length} foto's gevonden`);

    const db = getDb();
    const insertFoto = db.prepare(`
      INSERT OR IGNORE INTO fotos (
        bron_id, bestandsnaam, volledig_pad, hash, bestandsgrootte, bestandstype,
        datum_foto, datum_bestand, datum_bron, jaar, maand, dag,
        gps_lat, gps_lon, gps_adres, gps_stad, gps_land, gps_land_code,
        camera_merk, camera_model, lens, software,
        breedte, hoogte, orientatie, iso, sluitertijd, diafragma,
        brandpuntsafstand, flits, kleurruimte, thumbnail,
        google_description, google_device_type
      ) VALUES (
        @bron_id, @bestandsnaam, @volledig_pad, @hash, @bestandsgrootte, @bestandstype,
        @datum_foto, @datum_bestand, @datum_bron, @jaar, @maand, @dag,
        @gps_lat, @gps_lon, @gps_adres, @gps_stad, @gps_land, @gps_land_code,
        @camera_merk, @camera_model, @lens, @software,
        @breedte, @hoogte, @orientatie, @iso, @sluitertijd, @diafragma,
        @brandpuntsafstand, @flits, @kleurruimte, @thumbnail,
        @google_description, @google_device_type
      )
    `);

    const bestaatAl = db.prepare('SELECT id FROM fotos WHERE volledig_pad = ?');

    for (let i = 0; i < alleFotos.length; i++) {
      const fotoPad = alleFotos[i];
      scanStatus.verwerkt = i + 1;
      scanStatus.huidig_bestand = path.basename(fotoPad);

      // Gestopt?
      if (scanStoppen) {
        console.log('⏹ Scan gestopt door gebruiker');
        break;
      }

      try {
        // Al in db?
        if (bestaatAl.get(fotoPad)) {
          scanStatus.overgeslagen++;
          continue;
        }

        const stat = fs.statSync(fotoPad);
        const hash = berekenHash(fotoPad);
        const meta = await leesMetadata(fotoPad);
        const googleJson = leesGoogleJson(fotoPad);
        const thumbnail = await maakThumbnail(fotoPad);

        // EXIF heeft voorrang; Google JSON is fallback; bestandsnaam en aanmaakdatum als laatste redmiddel
        let datumFoto, datumBron;
        if (meta.datum_foto)                                    { datumFoto = meta.datum_foto;                                             datumBron = 'EXIF'; }
        else if (googleJson.datum)                              { datumFoto = googleJson.datum;                                            datumBron = 'Google Takeout'; }
        else if (parseDatumUitBestandsnaam(path.basename(fotoPad))) { datumFoto = parseDatumUitBestandsnaam(path.basename(fotoPad));       datumBron = 'Bestandsnaam'; }
        else if (stat.birthtime && stat.birthtime.getTime() !== stat.mtime.getTime()) { datumFoto = stat.birthtime.toISOString();          datumBron = 'Aanmaakdatum'; }
        else                                                    { datumFoto = stat.mtime.toISOString();                                    datumBron = 'Wijzigingsdatum'; }
        const gpsLat = meta.gps_lat || googleJson.gps_lat || null;
        const gpsLon = meta.gps_lon || googleJson.gps_lon || null;

        const datumObj = datumFoto ? new Date(datumFoto) : null;

        // GPS adres ophalen (alleen als GPS beschikbaar)
        let gpsAdres = {};
        if (gpsLat && gpsLon) {
          gpsAdres = await haalGpsAdresOp(gpsLat, gpsLon);
          // Vertraging zit in haalGpsAdresOp zelf (1.1s, enkel bij cache-miss)
        }

        insertFoto.run({
          bron_id: bronId,
          bestandsnaam: path.basename(fotoPad),
          volledig_pad: fotoPad,
          hash: hash,
          bestandsgrootte: stat.size,
          bestandstype: path.extname(fotoPad).toLowerCase().slice(1),
          datum_foto: datumFoto,
          datum_bestand: stat.mtime.toISOString(),
          datum_bron: datumBron,
          jaar: datumObj ? datumObj.getFullYear() : null,
          maand: datumObj ? datumObj.getMonth() + 1 : null,
          dag: datumObj ? datumObj.getDate() : null,
          gps_lat: gpsLat,
          gps_lon: gpsLon,
          gps_adres: gpsAdres.gps_adres || null,
          gps_stad: gpsAdres.gps_stad || null,
          gps_land: gpsAdres.gps_land || null,
          gps_land_code: gpsAdres.gps_land_code || null,
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
          google_device_type: googleJson.google_device_type || null
        });

        scanStatus.nieuw++;

      } catch (e) {
        scanStatus.fouten++;
        console.error(`Fout bij ${fotoPad}:`, e.message);
      }
    }

    // Duplicaten detecteren
    scanStatus.huidig_bestand = 'Duplicaten detecteren...';
    detecteerDuplicaten(db, bronId);

    // Bron bijwerken
    db.prepare(`
      UPDATE bronnen SET laatste_scan = datetime('now'), totaal_fotos = (
        SELECT COUNT(*) FROM fotos WHERE bron_id = ?
      ) WHERE id = ?
    `).run(bronId, bronId);

    // Log afsluiten
    db.prepare(`
      UPDATE scan_log SET voltooid = datetime('now'), totaal = ?, nieuw = ?,
      overgeslagen = ?, fouten = ?, status = 'voltooid'
      WHERE id = ?
    `).run(scanStatus.totaal, scanStatus.nieuw, scanStatus.overgeslagen, scanStatus.fouten, logId);

    db.close();

    console.log(`✅ Scan voltooid: ${scanStatus.nieuw} nieuw, ${scanStatus.overgeslagen} overgeslagen, ${scanStatus.fouten} fouten`);

  } catch (e) {
    console.error('Scan fout:', e);
  } finally {
    scanStatus.bezig = false;
    scanStatus.huidig_bestand = scanStoppen ? 'Gestopt' : 'Scan voltooid';
    scanStoppen = false;
    // Volgende in wachtrij starten
    setTimeout(() => verwerkWachtrij(), 500);
    // Geocoding pass op de achtergrond starten (na wachtrij-verwerking)
    setTimeout(() => startGeocodePass(), 1000);
  }
}

function detecteerDuplicaten(db, bronId) {
  // Reset duplicaten voor deze bron
  db.prepare('UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL WHERE bron_id = ?').run(bronId);

  // Vind alle hashes die meer dan 1 keer voorkomen (over alle bronnen)
  const duplicaatHashes = db.prepare(`
    SELECT hash, COUNT(*) as aantal FROM fotos
    WHERE hash IS NOT NULL
    GROUP BY hash HAVING COUNT(*) > 1
  `).all();

  for (const rij of duplicaatHashes) {
    db.prepare(`
      UPDATE fotos SET is_duplicaat = 1, duplicaat_groep = ?
      WHERE hash = ?
    `).run(rij.hash, rij.hash);
  }

  console.log(`🔍 ${duplicaatHashes.length} duplicaatgroepen gevonden`);
}

function stopScan(leegWachtrij = false) {
  scanStoppen = true;
  scanStatus.huidig_bestand = 'Gestopt door gebruiker...';
  if (leegWachtrij) wachtrij = [];
  console.log('⏹ Stop aangevraagd');
}

module.exports = { startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propageerGpsInGroepen, stopScan, verwijderUitWachtrij };
