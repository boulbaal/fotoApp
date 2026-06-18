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

const VIDEO_EXTENSIES = new Set([
  '.mp4', '.m4v', '.mov', '.qt',
  '.avi', '.wmv', '.flv',
  '.mkv', '.webm',
  '.3gp', '.3g2',
  '.mts', '.m2ts',
  '.mpg', '.mpeg', '.m2v',
  '.ogv', '.ogg',
]);

// Mappen die we overslaan (geen echte foto's)
const SKIP_MAPPEN = [
  '.cache', '.thumbnails', 'thumbnails',
  'node_modules', '.git', '.local/share/ov',
  'omni.physx', 'omni.blockworld', 'textures'
];

let scanStoppen = false;
// Aparte stop-vlag voor de geocode-pass: stoppen van een scan en stoppen van
// de (langlopende) geocode-achtergrondpass zijn losgekoppeld.
let geocodeStoppen = false;
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
  try {
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
  if (bijgewerkt > 0) console.log(`🔗 GPS gedeeld in ${groepen.length} duplicaatgroepen: ${bijgewerkt} foto's bijgewerkt`);
  return bijgewerkt;
  } finally {
    db.close();
  }
}

// Start geocoding pass op de achtergrond — vult gps_land/stad in voor alle foto's die dat missen
async function startGeocodePass() {
  if (geocodeStatus.bezig) return; // al bezig
  geocodeStoppen = false; // verse start — eigen vlag, los van scanStoppen
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
    try {
      db2.prepare(`
        UPDATE fotos SET gps_stad = ?, gps_land = ?, gps_land_code = ?, gps_adres = ?
        WHERE ROUND(gps_lat, 3) = ? AND ROUND(gps_lon, 3) = ?
          AND (gps_land IS NULL OR gps_land = '')
      `).run(adres.gps_stad || null, adres.gps_land, adres.gps_land_code || null, adres.gps_adres || null, lat, lon);
    } finally {
      db2.close();
    }
  };

  for (const loc of locaties) {
    if (geocodeStoppen) break; // Eigen geocode stop-vlag (niet de scan-vlag)
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
          if (FOTO_EXTENSIES.has(ext) || VIDEO_EXTENSIES.has(ext)) {
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
  let fd;
  try {
    const stat = fs.statSync(bestandsPad);
    // 0-byte bestanden krijgen géén hash: anders delen ze allemaal dezelfde
    // lege-MD5 en zouden ze onterecht als duplicaten van elkaar gelden.
    // detecteerDuplicaten negeert hash IS NULL, dus null = "niet meedoen".
    if (!stat.size) return null;

    const hash = crypto.createHash('md5');
    fd = fs.openSync(bestandsPad, 'r');
    const buffer = Buffer.alloc(1024 * 1024); // 1 MB chunks — streamt zonder hele bestand in geheugen
    let gelezen;
    while ((gelezen = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(gelezen === buffer.length ? buffer : buffer.subarray(0, gelezen));
    }
    return hash.digest('hex');
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

function leesVideoDuur(bestandsPad) {
  try {
    const result = spawnSync('exiftool', ['-Duration#', '-b', bestandsPad], {
      encoding: 'utf8', timeout: 5000
    });
    const duur = parseFloat(result.stdout);
    return isNaN(duur) ? null : Math.round(duur);
  } catch (_) { return null; }
}

// Lees GPS uit video via exiftool — exifr ondersteunt MP4/MOV GPS niet goed
// Werkt voor iPhone MOV, sommige Android MP4, GoPro, etc.
function leesGpsUitVideo(bestandsPad) {
  try {
    const result = spawnSync('exiftool', [
      '-GPSLatitude#', '-GPSLongitude#',
      '-Keys:GPSCoordinates',
      '-n', '-j',
      bestandsPad
    ], { encoding: 'utf8', timeout: 8000, stdio: 'pipe' });

    if (result.status !== 0 || !result.stdout) return { gps_lat: null, gps_lon: null };

    const data = JSON.parse(result.stdout)[0] || {};

    // Keys:GPSCoordinates formaat: "+35.6927+139.7010+0.000/" of "+lat+lon+alt/"
    if (data['Keys:GPSCoordinates']) {
      const match = data['Keys:GPSCoordinates'].match(/([+-]\d+\.?\d*)\s*([+-]\d+\.?\d*)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) return { gps_lat: lat, gps_lon: lon };
      }
    }

    // Standaard EXIF GPS tags (ook in sommige MP4)
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

async function maakVideoThumbnail(bestandsPad) {
  // Bereken seek-positie: 30% van de duur, min 2s, max 60s
  // -ss VOOR -i = keyframe seeking = geen overhead ongeacht hoe ver we springen
  let seekSec = 3; // standaard fallback
  const duur = leesVideoDuur(bestandsPad);
  if (duur && duur > 4) {
    seekSec = Math.min(Math.round(duur * 0.3), 60);
  }

  try {
    const tmpPad = `/tmp/fotoapp_thumb_${Date.now()}.jpg`;
    const result = spawnSync('ffmpeg', [
      '-ss', String(seekSec),   // vóór -i: snelle keyframe seek
      '-i', bestandsPad,
      '-vframes', '1',
      '-q:v', '5',
      '-y', tmpPad
    ], { timeout: 15000 });

    if (result.status === 0 && fs.existsSync(tmpPad)) {
      const buffer = await sharp(tmpPad)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
      fs.unlinkSync(tmpPad);
      return 'data:image/jpeg;base64,' + buffer.toString('base64');
    }
    if (fs.existsSync(tmpPad)) fs.unlinkSync(tmpPad);
  } catch (_) {}

  // Fallback: exiftool embedded thumbnail
  for (const tag of ['-ThumbnailImage', '-PreviewImage', '-OtherImage', '-CoverArt']) {
    try {
      const result = spawnSync('exiftool', [tag, '-b', bestandsPad], {
        maxBuffer: 10 * 1024 * 1024, timeout: 8000
      });
      if (result.stdout && result.stdout.length > 500) {
        const buffer = await sharp(result.stdout)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        return 'data:image/jpeg;base64,' + buffer.toString('base64');
      }
    } catch (_) {}
  }

  return null;
}

async function maakThumbnail(bestandsPad) {
  // Video: apart pad
  const ext = path.extname(bestandsPad).toLowerCase();
  if (VIDEO_EXTENSIES.has(ext)) {
    return maakVideoThumbnail(bestandsPad);
  }

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
    const { resultaat, status } = await new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const req = https.get(url, {
        headers: { 'User-Agent': 'FotoApp/1.0', 'Accept-Language': 'en' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 429 (rate limit) of serverfout → tijdelijke fout, niet cachen
          if (res.statusCode === 429 || res.statusCode >= 500) {
            resolve({ resultaat: {}, status: res.statusCode });
            return;
          }
          try {
            const json = JSON.parse(data);
            const addr = json.address || {};
            // Strip niet-Latijnse delen (bijv. "Malha - مالحة" → "Malha")
            const reinigNaam = (s) => {
              if (!s) return null;
              // Splits op " - " of " / " en neem het eerste deel met Latijnse tekens
              const delen = s.split(/\s*[-\/]\s*/);
              const latijn = delen.find(d => /[a-zA-Z]/.test(d));
              return ((latijn || delen[0] || s).trim()) || null;
            };
            resolve({
              resultaat: {
                gps_adres: json.display_name || null,
                gps_stad: reinigNaam(addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || null),
                gps_land: reinigNaam(addr.country || null),
                gps_land_code: (addr.country_code || '').toUpperCase() || null
              },
              status: res.statusCode
            });
          } catch { resolve({ resultaat: {}, status: res.statusCode }); }
        });
      });
      req.on('error', () => resolve({ resultaat: {}, status: 0 }));
      req.setTimeout(8000, () => { req.destroy(); resolve({ resultaat: {}, status: 0 }); });
    });

    // Alleen succesvolle resultaten (met een land) cachen. Lege antwoorden door
    // 429/timeout/netwerkfout NIET cachen, zodat een latere geocode-pass het opnieuw probeert.
    if (resultaat && resultaat.gps_land) {
      gpsCache.set(sleutel, resultaat);
    }
    // Nominatim policy: max 1 request per seconde. Bij 429 extra lang afkoelen.
    await new Promise(r => setTimeout(r, status === 429 ? 5000 : 1100));
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
        // GPS: exifr → Google JSON → exiftool (voor MP4/MOV containers)
        let gpsLat = meta.gps_lat || googleJson.gps_lat || null;
        let gpsLon = meta.gps_lon || googleJson.gps_lon || null;
        if (!gpsLat && VIDEO_EXTENSIES.has(path.extname(fotoPad).toLowerCase())) {
          const videoGps = leesGpsUitVideo(fotoPad);
          if (videoGps.gps_lat) { gpsLat = videoGps.gps_lat; gpsLon = videoGps.gps_lon; }
        }

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
          google_device_type: googleJson.google_device_type || null,
          is_video: VIDEO_EXTENSIES.has(path.extname(fotoPad).toLowerCase()) ? 1 : 0,
          duur: VIDEO_EXTENSIES.has(path.extname(fotoPad).toLowerCase()) ? leesVideoDuur(fotoPad) : null
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
    // Video thumbnail pass op de achtergrond starten
    setTimeout(() => startVideoThumbnailPass(), 3000);
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

// Stopt alleen de geocode-achtergrondpass, zonder een lopende scan te raken.
function stopGeocode() {
  geocodeStoppen = true;
  console.log('⏹ Geocode-pass stoppen aangevraagd');
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

  if (videos.length === 0) return; // niets te doen

  videoThumbPassStatus = { bezig: true, gedaan: 0, totaal: videos.length, fout: 0 };
  console.log(`🎬 Video thumbnail pass gestart — ${videos.length} video's te verwerken`);
  console.log('   ℹ️  Dit draait rustig op de achtergrond. De app werkt gewoon verder.');
  console.log('   ⏳ Heb geduld — thumbnails verschijnen automatisch in de galerij.');

  (async () => {
    for (const v of videos) {
      // Stop als een nieuwe scan gestart is
      if (scanStatus.bezig) {
        console.log('🎬 Video thumbnail pass gepauzeerd — scan actief');
        videoThumbPassStatus.bezig = false;
        return;
      }

      try {
        const thumb = await maakVideoThumbnail(v.volledig_pad);
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

      // Voortgang in server log elke 25 videos
      if (videoThumbPassStatus.gedaan % 25 === 0) {
        const over = videoThumbPassStatus.totaal - videoThumbPassStatus.gedaan;
        console.log(`🎬 Thumbnails: ${videoThumbPassStatus.gedaan}/${videoThumbPassStatus.totaal} klaar — nog ${over} te gaan`);
      }

      // Kleine pauze zodat de server niet overbelast raakt
      await new Promise(r => setTimeout(r, 50));
    }

    const { gedaan, totaal, fout } = videoThumbPassStatus;
    videoThumbPassStatus.bezig = false;
    console.log(`✅ Video thumbnail pass voltooid: ${gedaan - fout}/${totaal} aangemaakt${fout > 0 ? `, ${fout} mislukt (geen erg)` : ''}`);
  })();
}

// ─── VIDEO GPS PASS ──────────────────────────────────────────────────────────
// Leest GPS uit bestaande video's via exiftool (fallback voor containers die exifr mist)

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
  console.log(`📍 Video GPS pass gestart — ${videos.length} video's controleren op GPS`);
  console.log('   ℹ️  Dit draait rustig op de achtergrond. Heb geduld.');

  (async () => {
    for (const v of videos) {
      if (scanStatus.bezig) {
        console.log('📍 Video GPS pass gepauzeerd — scan actief');
        videoGpsPassStatus.bezig = false;
        return;
      }

      try {
        const gps = leesGpsUitVideo(v.volledig_pad);
        if (gps.gps_lat && gps.gps_lon) {
          // GPS gevonden — haal stad/land op en sla op
          const adres = await haalGpsAdresOp(gps.gps_lat, gps.gps_lon);
          const db2 = getDb();
          db2.prepare(`
            UPDATE fotos SET gps_lat=?, gps_lon=?, gps_stad=?, gps_land=?, gps_land_code=?, gps_adres=?
            WHERE id=?
          `).run(gps.gps_lat, gps.gps_lon, adres.gps_stad||null, adres.gps_land||null, adres.gps_land_code||null, adres.gps_adres||null, v.id);
          db2.close();
          videoGpsPassStatus.gevonden++;
          if (videoGpsPassStatus.gevonden % 10 === 0) {
            console.log(`📍 Video GPS: ${videoGpsPassStatus.gevonden} locaties gevonden (${videoGpsPassStatus.gedaan}/${videoGpsPassStatus.totaal} verwerkt)`);
          }
        }
      } catch (_) {}

      videoGpsPassStatus.gedaan++;
      await new Promise(r => setTimeout(r, 20)); // lichte pauze
    }

    videoGpsPassStatus.bezig = false;
    const { gevonden, totaal } = videoGpsPassStatus;
    if (gevonden > 0) {
      console.log(`✅ Video GPS pass klaar: ${gevonden} nieuwe locaties gevonden in ${totaal} video's`);
    } else {
      console.log(`📍 Video GPS pass klaar: geen nieuwe GPS-data gevonden in ${totaal} video's (locatie niet opgeslagen in container)`);
    }
  })();
}

module.exports = {
  startScan, getScanStatus, getGeocodeStatus, startGeocodePass, propageerGpsInGroepen,
  stopScan, stopGeocode, berekenHash, verwijderUitWachtrij,
  maakThumbnailVoorVideo: maakVideoThumbnail, startVideoThumbnailPass, getVideoThumbStatus,
  startVideoGpsPass, getVideoGpsStatus
};
