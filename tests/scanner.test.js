const fs   = require('fs');
const path = require('path');

module.exports = async function testScanner() {
  const resultaten = [];

  function test(naam, fn) {
    try {
      fn();
      resultaten.push({ naam, ok: true });
    } catch (e) {
      resultaten.push({ naam, ok: false, fout: e.message });
    }
  }

  const scannerPath    = path.join(__dirname, '../src/scanner.js');
  const scannerCode    = fs.readFileSync(scannerPath, 'utf8');
  const uiScannerPath  = path.join(__dirname, '../public/js/scanner.js');
  const uiScannerCode  = fs.readFileSync(uiScannerPath, 'utf8');
  const uiMapkiezerPath = path.join(__dirname, '../public/js/mapkiezer.js');
  const uiMapkiezerCode = fs.readFileSync(uiMapkiezerPath, 'utf8');
  const uiDashboardPath = path.join(__dirname, '../public/js/dashboard.js');
  const uiDashboardCode = fs.readFileSync(uiDashboardPath, 'utf8');
  const utilsPath       = path.join(__dirname, '../public/js/utils.js');
  const utilsCode       = fs.readFileSync(utilsPath, 'utf8');
  const fotosPath       = path.join(__dirname, '../public/js/fotos.js');
  const fotosCode       = fs.readFileSync(fotosPath, 'utf8');
  const dbPath          = path.join(__dirname, '../src/database.js');
  const dbCode          = fs.readFileSync(dbPath, 'utf8');
  const apiPath         = path.join(__dirname, '../src/api.js');
  const apiCode         = fs.readFileSync(apiPath, 'utf8');

  // ─── BESTANDSSTRUCTUUR ────────────────────────────────────────────────────

  test('scanner.js bestand bestaat', () => {
    if (!fs.existsSync(scannerPath)) throw new Error('scanner.js niet gevonden');
  });

  // ─── EXTENSIES ────────────────────────────────────────────────────────────

  test('FOTO_EXTENSIES bevat .jpg', () => {
    if (!scannerCode.includes("'.jpg'")) throw new Error('.jpg niet in extensies');
  });

  test('FOTO_EXTENSIES bevat .heic (iPhone)', () => {
    if (!scannerCode.includes("'.heic'")) throw new Error('.heic niet in extensies');
  });

  test('FOTO_EXTENSIES bevat .raw (camera)', () => {
    if (!scannerCode.includes("'.raw'")) throw new Error('.raw niet in extensies');
  });

  test('FOTO_EXTENSIES bevat .cr2 (Canon RAW)', () => {
    if (!scannerCode.includes("'.cr2'")) throw new Error('.cr2 niet in extensies');
  });

  test('FOTO_EXTENSIES bevat .nef (Nikon RAW)', () => {
    if (!scannerCode.includes("'.nef'")) throw new Error('.nef niet in extensies');
  });

  // ─── SCAN VEILIGHEID ──────────────────────────────────────────────────────

  test('SKIP_MAPPEN bevat node_modules', () => {
    if (!scannerCode.includes('node_modules')) throw new Error('node_modules niet in skip lijst');
  });

  test('scanStoppen check aanwezig in vindAlleFotos', () => {
    if (!scannerCode.includes('if (scanStoppen) return')) throw new Error('Stop check ontbreekt in vindAlleFotos');
  });

  // ─── GPS & GEOCODING ──────────────────────────────────────────────────────

  test('GPS adres ophaling gebruikt accept-language=en', () => {
    if (!scannerCode.includes('accept-language=en')) throw new Error('Engelse landnamen niet geconfigureerd');
  });

  test('haalGpsAdresOp functie aanwezig', () => {
    if (!scannerCode.includes('async function haalGpsAdresOp')) throw new Error('haalGpsAdresOp niet gevonden');
  });

  test('GPS cache aanwezig (voorkomt dubbele Nominatim-calls)', () => {
    if (!scannerCode.includes('gpsCache')) throw new Error('GPS cache ontbreekt');
  });

  test('gps_land_code wordt opgeslagen bij geocoding', () => {
    if (!scannerCode.includes('gps_land_code')) throw new Error('gps_land_code niet gevonden in scanner');
  });

  test('Post-scan geocode pass aanwezig', () => {
    if (!scannerCode.includes('async function startGeocodePass')) throw new Error('startGeocodePass niet gevonden');
  });

  test('Geocode pass wordt na scan gestart', () => {
    if (!scannerCode.includes('startGeocodePass')) throw new Error('startGeocodePass wordt niet aangeroepen na scan');
  });

  test('geocodeStatus object aanwezig', () => {
    if (!scannerCode.includes('geocodeStatus')) throw new Error('geocodeStatus object niet gevonden');
  });

  test('getGeocodeStatus geëxporteerd', () => {
    if (!scannerCode.includes('getGeocodeStatus')) throw new Error('getGeocodeStatus niet geëxporteerd');
  });

  // ─── DUPLICATEN ───────────────────────────────────────────────────────────

  test('Duplicate detectie aanwezig', () => {
    if (!scannerCode.includes('detecteerDuplicaten')) throw new Error('detecteerDuplicaten functie niet gevonden');
  });

  // ─── THUMBNAILS ───────────────────────────────────────────────────────────

  test('Thumbnail generatie via sharp aanwezig', () => {
    if (!scannerCode.includes('sharp(')) throw new Error('sharp() niet gevonden');
  });

  test('RAW thumbnail fallback via exiftool aanwezig', () => {
    if (!scannerCode.includes('PreviewImage')) throw new Error('exiftool RAW preview fallback ontbreekt');
  });

  // ─── HASHING ──────────────────────────────────────────────────────────────

  test('Hash berekening via MD5 aanwezig', () => {
    if (!scannerCode.includes('md5')) throw new Error('MD5 hash niet gevonden');
  });

  // ─── DATUM FALLBACK KETEN ─────────────────────────────────────────────────

  test('EXIF heeft voorrang boven Google JSON (datum)', () => {
    // Keten: EXIF → Google JSON → bestandsnaam → birthtime → mtime
    if (!scannerCode.includes("datumBron = 'EXIF'")) throw new Error('EXIF datum-prioriteit niet geïmplementeerd');
    if (!scannerCode.includes("datumBron = 'Google Takeout'")) throw new Error('Google Takeout datum-fallback ontbreekt');
  });

  test('datum_bron wordt opgeslagen in database', () => {
    if (!scannerCode.includes('datum_bron: datumBron')) throw new Error('datum_bron wordt niet opgeslagen');
  });

  test('parseDatumUitBestandsnaam functie aanwezig', () => {
    if (!scannerCode.includes('function parseDatumUitBestandsnaam')) throw new Error('parseDatumUitBestandsnaam niet gevonden');
  });

  test('Datum uit bestandsnaam als fallback gebruikt', () => {
    if (!scannerCode.includes("datumBron = 'Bestandsnaam'")) throw new Error('Bestandsnaam datum-fallback ontbreekt');
  });

  test('Aanmaakdatum (birthtime) als fallback gebruikt', () => {
    if (!scannerCode.includes("datumBron = 'Aanmaakdatum'")) throw new Error('birthtime fallback ontbreekt');
  });

  test('Wijzigingsdatum (mtime) als laatste fallback', () => {
    if (!scannerCode.includes("datumBron = 'Wijzigingsdatum'")) throw new Error('mtime fallback ontbreekt');
  });

  // ─── GOOGLE TAKEOUT ───────────────────────────────────────────────────────

  test('leesGoogleJson functie aanwezig', () => {
    if (!scannerCode.includes('function leesGoogleJson')) throw new Error('leesGoogleJson functie niet gevonden');
  });

  test('Google JSON leest photoTakenTime.timestamp', () => {
    if (!scannerCode.includes('photoTakenTime')) throw new Error('photoTakenTime niet gelezen uit Google JSON');
  });

  test('Google JSON leest geoData als GPS fallback', () => {
    if (!scannerCode.includes('geoData')) throw new Error('geoData niet gelezen uit Google JSON');
  });

  test('EXIF heeft voorrang boven Google JSON (GPS)', () => {
    if (!scannerCode.includes('meta.gps_lat || googleJson.gps_lat')) throw new Error('EXIF GPS-prioriteit niet geïmplementeerd');
  });

  test('google_description kolom wordt opgeslagen', () => {
    if (!scannerCode.includes('google_description')) throw new Error('google_description niet opgeslagen');
  });

  test('google_device_type kolom wordt opgeslagen', () => {
    if (!scannerCode.includes('google_device_type')) throw new Error('google_device_type niet opgeslagen');
  });

  // ─── DATABASE SCHEMA ──────────────────────────────────────────────────────

  test('DB migratie: gps_land_code kolom', () => {
    if (!dbCode.includes('gps_land_code')) throw new Error('gps_land_code migratie ontbreekt in database.js');
  });

  test('DB migratie: datum_bron kolom', () => {
    if (!dbCode.includes('datum_bron')) throw new Error('datum_bron migratie ontbreekt in database.js');
  });

  test('DB migratie: google_description kolom', () => {
    if (!dbCode.includes('google_description')) throw new Error('google_description migratie ontbreekt in database.js');
  });

  // ─── API ENDPOINTS ────────────────────────────────────────────────────────

  test('API: GET /api/scan/geocode endpoint aanwezig', () => {
    if (!apiCode.includes("'/scan/geocode'")) throw new Error('GET /api/scan/geocode ontbreekt');
  });

  test('API: POST /api/scan/geocode endpoint aanwezig', () => {
    if (!apiCode.includes('startGeocodePass')) throw new Error('POST /api/scan/geocode ontbreekt in api.js');
  });

  test('API: PUT /fotos/:id slaat gps_land_code op', () => {
    if (!apiCode.includes('gps_land_code')) throw new Error('gps_land_code niet opgeslagen in PUT /fotos/:id');
  });

  test('API: POST /fotos/:id/gps slaat gps_land_code op', () => {
    const gpsRoute = apiCode.includes("'/fotos/:id/gps'");
    if (!gpsRoute) throw new Error('POST /fotos/:id/gps niet gevonden');
  });

  test('API: stats geeft gps_land_code mee per land', () => {
    if (!apiCode.includes('gps_land_code') || !apiCode.includes('perLand')) throw new Error('gps_land_code niet in stats perLand');
  });

  // ─── UI: SCAN BALK ────────────────────────────────────────────────────────

  test('UI: startScan geeft onmiddellijke knop-feedback', () => {
    if (!uiScannerCode.includes('knop.disabled = true')) throw new Error('Geen directe knop-feedback in startScan');
  });

  test('UI: scanBalk toont Klaar-status wanneer niet bezig', () => {
    if (!uiScannerCode.includes("stat_ready") && !uiScannerCode.includes("titel.textContent    = 'Klaar'")) throw new Error('Scan balk toont geen Klaar-status');
  });

  test('Utils: formatDuur toont "< 1s" voor scans korter dan 1 seconde', () => {
    const utilsCode = fs.readFileSync(path.join(__dirname, '../public/js/utils.js'), 'utf8');
    if (!utilsCode.includes("'< 1s'")) throw new Error('formatDuur toont geen "< 1s" voor snelle scans');
    if (!utilsCode.includes('seconden === null')) throw new Error('formatDuur controleert niet op null — 0 wordt verkeerd behandeld');
  });

  test('Bronnen JS: scan_duur_seconden check is null-safe (0 = "< 1s", niet leeg)', () => {
    const bronnenCode = fs.readFileSync(path.join(__dirname, '../public/js/bronnen.js'), 'utf8');
    if (!bronnenCode.includes('scan_duur_seconden != null')) {
      throw new Error('bronnen.js gebruikt truthy check voor scan_duur_seconden — 0 seconden wordt niet getoond');
    }
  });

  test('UI: startScanPolling initialiseert vorigeBericht zodat snelle scans worden herkend', () => {
    // Bug: als scan < 1.5s duurt, ziet eerste poll al status.bezig=false terwijl vorigeBericht nog '' is.
    // Fix: vorigeBericht op 'gestart' zetten bij start polling.
    if (!uiScannerCode.includes("vorigeBericht = 'gestart'")) {
      throw new Error("startScanPolling() initialiseert vorigeBericht niet — snelle scans worden niet herkend als voltooid");
    }
  });

  test('UI: geocode voortgangsbalk aanwezig', () => {
    if (!uiScannerCode.includes('toonGeocodeBalk')) throw new Error('toonGeocodeBalk functie ontbreekt in scanner.js');
  });

  test('UI: geocode polling aanwezig', () => {
    if (!uiScannerCode.includes('startGeocodePolling')) throw new Error('startGeocodePolling ontbreekt in scanner.js');
  });

  // ─── UI: LOG PANELEN ──────────────────────────────────────────────────────

  test('UI: client logs gaan naar logBodyClient', () => {
    if (!uiMapkiezerCode.includes('logBodyClient')) throw new Error('Geen logBodyClient panel voor client logs');
  });

  test('UI: server logs gaan naar logBodyServer', () => {
    if (!uiMapkiezerCode.includes('logBodyServer')) throw new Error('Geen logBodyServer panel voor server logs');
  });

  test('UI: toggleLog accepteert paneel-parameter', () => {
    if (!uiMapkiezerCode.includes("function toggleLog(paneel)")) throw new Error('toggleLog heeft geen paneel-parameter');
  });

  // ─── UI: VLAGGEN ──────────────────────────────────────────────────────────

  test('Utils: landVlag() functie aanwezig', () => {
    if (!utilsCode.includes('function landVlag')) throw new Error('landVlag() niet gevonden in utils.js');
  });

  test('Utils: landVlagVanNaam() functie aanwezig', () => {
    if (!utilsCode.includes('function landVlagVanNaam')) throw new Error('landVlagVanNaam() niet gevonden in utils.js');
  });

  test('Utils: LAND_CODES lookup tabel aanwezig', () => {
    if (!utilsCode.includes('LAND_CODES')) throw new Error('LAND_CODES niet gevonden in utils.js');
  });

  test('Utils: parseDatumUitBestandsnaam klopt voor YYYYMMDD patroon', () => {
    // Directe regex test zonder de module te laden
    const match = 'IMG-20250728-WA0010.jpg'.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
    if (!match) throw new Error('Regex herkent YYYYMMDD patroon niet');
    const [, jaar, maand, dag] = match.map(Number);
    if (jaar !== 2025 || maand !== 7 || dag !== 28) throw new Error(`Datum fout: ${jaar}-${maand}-${dag}`);
  });

  test('Dashboard: vlag emoji in Landen-grafiek', () => {
    if (!uiDashboardCode.includes('landVlag') && !uiDashboardCode.includes('landVlagVanNaam')) {
      throw new Error('Vlag emoji niet gebruikt in dashboard Landen-grafiek');
    }
  });

  test('Fotos: datum_bron getoond in detail modal', () => {
    if (!fotosCode.includes('datum_bron')) throw new Error('datum_bron niet getoond in detail modal');
  });

  test('Fotos: vlag emoji in Locatie rij', () => {
    if (!fotosCode.includes('landVlag') && !fotosCode.includes('landVlagVanNaam')) {
      throw new Error('Vlag emoji niet gebruikt in foto detail modal');
    }
  });

  test('Fotos: duplicaatlocaties worden getoond in detail modal', () => {
    if (!fotosCode.includes('duplicaat_locaties')) throw new Error('duplicaat_locaties niet verwerkt in fotos.js');
    if (!fotosCode.includes('modalDuplicaten')) throw new Error('modalDuplicaten element niet gebruikt');
  });

  test('API: GET /fotos/:id geeft duplicaat_locaties mee', () => {
    if (!apiCode.includes('duplicaat_locaties')) throw new Error('duplicaat_locaties niet teruggegeven in GET /fotos/:id');
  });

  // ─── GALERIJ TOONT ALTIJD ORIGINELEN ─────────────────────────────────────

  test('Fotos: zonder_kopien altijd meegegeven (geen toggle, hardcoded)', () => {
    if (!fotosCode.includes('zonder_kopien: 1')) throw new Error('zonder_kopien niet hardcoded op 1 in fotos.js — toggle is verwijderd, altijd originelen tonen');
    if (fotosCode.includes('verbergKopieen')) throw new Error('verbergKopieen variabele gevonden — toggle moet verwijderd zijn');
    if (fotosCode.includes('toggleVerbergKopieen')) throw new Error('toggleVerbergKopieen() nog aanwezig — toggle moet verwijderd zijn');
  });

  test('HTML: toggle knop verwijderd uit galerij filters', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (htmlCode.includes('toggleKopieenKnop')) throw new Error('toggleKopieenKnop nog aanwezig in index.html — moet verwijderd zijn');
    if (htmlCode.includes('toggleVerbergKopieen')) throw new Error('toggleVerbergKopieen() onclick nog aanwezig in index.html');
  });

  test('App: updateToggleKnop() niet meer aangeroepen (toggle verwijderd)', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (appCode.includes('updateToggleKnop()')) throw new Error('updateToggleKnop() nog aangeroepen in app.js — toggle is verwijderd');
  });

  test('API: zonder_kopien filter aanwezig in GET /fotos', () => {
    if (!apiCode.includes('zonder_kopien')) throw new Error('zonder_kopien filter niet gevonden in api.js');
  });

  test('API: correlated subquery voor origineel selectie aanwezig', () => {
    if (!apiCode.includes('duplicaat_groep') || !apiCode.includes('LIMIT 1')) {
      throw new Error('Correlated subquery voor origineel selectie niet gevonden in api.js');
    }
  });

  test('API: GPS groepen filtert duplicaten — toont alleen originelen', () => {
    const groepBlok = apiCode.slice(apiCode.indexOf("'/gps/groepen'"));
    if (!groepBlok.includes('origineelFilter') && !groepBlok.includes('MIN(id)')) {
      throw new Error('/gps/groepen filtert duplicaten niet — toont alle kopieën in GPS bulk pagina');
    }
  });

  // ─── GPS PROPAGATIE BINNEN DUPLICAATGROEPEN ────────────────────────────────

  test('Scanner: propageerGpsInGroepen() als aparte functie aanwezig', () => {
    if (!scannerCode.includes('function propageerGpsInGroepen')) {
      throw new Error('propageerGpsInGroepen() niet gevonden als aparte functie in scanner.js');
    }
  });

  test('Scanner: propageerGpsInGroepen() geëxporteerd', () => {
    if (!scannerCode.includes('propageerGpsInGroepen')) {
      throw new Error('propageerGpsInGroepen niet geëxporteerd in module.exports');
    }
    const exportRegel = scannerCode.match(/module\.exports\s*=\s*\{([^}]+)\}/)?.[1] || '';
    if (!exportRegel.includes('propageerGpsInGroepen')) {
      throw new Error('propageerGpsInGroepen ontbreekt in module.exports');
    }
  });

  test('Scanner: GPS propagatie loopt ook als locaties.length === 0', () => {
    const vroegReturn = scannerCode.match(/locaties\.length === 0[\s\S]{0,200}return/);
    if (!vroegReturn) throw new Error('Vroege return bij locaties.length === 0 niet gevonden');
    if (!vroegReturn[0].includes('propageerGpsInGroepen')) {
      throw new Error('propageerGpsInGroepen() wordt niet aangeroepen bij vroege return (locaties.length === 0)');
    }
  });

  test('Scanner: GPS propagatie omvat gps_land_code', () => {
    const propageerBlok = scannerCode.slice(scannerCode.indexOf('function propageerGpsInGroepen'));
    if (!propageerBlok.includes('land_code')) {
      throw new Error('gps_land_code wordt niet meegenomen bij GPS propagatie in propageerGpsInGroepen()');
    }
  });

  test('API: nieuw endpoint POST /scan/gps-propageren aanwezig', () => {
    if (!apiCode.includes('/scan/gps-propageren')) {
      throw new Error('Endpoint POST /api/scan/gps-propageren niet gevonden in api.js');
    }
  });

  test('API: propageerGpsInGroepen geïmporteerd in api.js', () => {
    const importRegel = apiCode.match(/require\('\.\/scanner'\)/)?.[0];
    if (!importRegel) throw new Error('scanner niet geïmporteerd in api.js');
    const destructure = apiCode.match(/const\s*\{([^}]+)\}\s*=\s*require\('\.\/scanner'\)/)?.[1] || '';
    if (!destructure.includes('propageerGpsInGroepen')) {
      throw new Error('propageerGpsInGroepen niet geïmporteerd uit scanner in api.js');
    }
  });

  test('API: GPS delen condition werkt op gps_land IS NULL (niet alleen gps_lat IS NULL)', () => {
    if (!apiCode.includes("gps_land IS NULL OR gps_land = ''")) {
      throw new Error('GPS delen endpoint werkt enkel op gps_lat IS NULL — zou ook fotos zonder gps_land moeten updaten');
    }
  });

  test('API: zonder_kopien subquery past land filter toe zodat origineel+land filter correct samenwerken', () => {
    const subqueryBlok = apiCode.slice(apiCode.indexOf('zonder_kopien'));
    if (!subqueryBlok.includes('landSubquery')) {
      throw new Error('zonder_kopien subquery gebruikt geen landSubquery — combinatie met land filter werkt incorrect');
    }
    if (!subqueryBlok.includes('f2.gps_land = ?')) {
      throw new Error('f2.gps_land ontbreekt in zonder_kopien subquery');
    }
  });

  test('API: zonder_kopien subquery past camera_merk filter toe', () => {
    const subqueryBlok = apiCode.slice(apiCode.indexOf('zonder_kopien'));
    if (!subqueryBlok.includes('merkSubquery') || !subqueryBlok.includes('f2.camera_merk = ?')) {
      throw new Error('camera_merk filter ontbreekt in zonder_kopien subquery');
    }
  });


  test('Bronnen JS: propageerGps() functie aanwezig', () => {
    const bronnenCode = fs.readFileSync(path.join(__dirname, '../public/js/bronnen.js'), 'utf8');
    if (!bronnenCode.includes('function propageerGps') && !bronnenCode.includes('async function propageerGps')) {
      throw new Error('propageerGps() functie niet gevonden in bronnen.js');
    }
    if (!bronnenCode.includes('/api/scan/gps-propageren')) {
      throw new Error('propageerGps() roept niet het juiste endpoint aan in bronnen.js');
    }
  });

  // ─── KAART PAGINA ────────────────────────────────────────────────────────────

  test('Kaart: kaart.js bestand bestaat', () => {
    const p = path.join(__dirname, '../public/js/kaart.js');
    if (!fs.existsSync(p)) throw new Error('kaart.js niet gevonden');
  });

  test('Kaart: laadKaart() functie aanwezig', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('function laadKaart') && !kaartCode.includes('async function laadKaart')) {
      throw new Error('laadKaart() functie niet gevonden in kaart.js');
    }
  });

  test('Kaart: herlaadLocaties() wordt altijd aangeroepen bij navigatie (ook als kaart al bestaat)', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    // Controleer dat herlaadLocaties() ook wordt aangeroepen in het if(kaartInstantie) blok
    const bestaatBlok = kaartCode.slice(kaartCode.indexOf('if (kaartInstantie)'), kaartCode.indexOf('if (kaartInstantie)') + 200);
    if (!bestaatBlok.includes('herlaadLocaties')) {
      throw new Error('herlaadLocaties() wordt niet aangeroepen als kaart al bestaat — nieuwe GPS markers verschijnen pas na pagina-herlaad');
    }
  });

  test('Kaart: dark tile layer gebruikt (CartoDB dark)', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('cartocdn') && !kaartCode.includes('dark')) {
      throw new Error('Geen dark tile layer in kaart.js');
    }
  });

  test('Kaart: MarkerCluster wordt gebruikt', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('markerClusterGroup')) throw new Error('MarkerCluster niet gebruikt in kaart.js');
  });

  test('Kaart: slide-up panel aanwezig (toonLocatiePanel)', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('toonLocatiePanel')) throw new Error('toonLocatiePanel() niet gevonden in kaart.js');
    if (!kaartCode.includes('kaartPanel')) throw new Error('kaartPanel element niet gebruikt in kaart.js');
  });

  test('Kaart: bekijkLocatieInFotos() navigeert naar Foto\'s pagina', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('bekijkLocatieInFotos')) throw new Error('bekijkLocatieInFotos() niet gevonden');
    if (!kaartCode.includes("toonPagina('fotos'")) throw new Error('navigeert niet naar fotos pagina');
  });

  test('API: GET /kaart/locaties endpoint aanwezig', () => {
    if (!apiCode.includes('/kaart/locaties')) throw new Error('/kaart/locaties endpoint niet gevonden in api.js');
  });

  test('API: GET /kaart/fotos endpoint aanwezig', () => {
    if (!apiCode.includes('/kaart/fotos')) throw new Error('/kaart/fotos endpoint niet gevonden in api.js');
  });

  test('API: GET /fotos/:id/thumbnail endpoint aanwezig', () => {
    if (!apiCode.includes("'/fotos/:id/thumbnail'")) throw new Error('/fotos/:id/thumbnail endpoint niet gevonden in api.js');
  });

  test('HTML: Kaart nav-knop aanwezig', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!htmlCode.includes("toonPagina('kaart')")) throw new Error('Kaart nav-knop niet gevonden in index.html');
    if (!htmlCode.includes('paginaKaart')) throw new Error('paginaKaart element niet gevonden in index.html');
  });

  test('HTML: MarkerCluster JS geladen', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!htmlCode.includes('markercluster')) throw new Error('MarkerCluster library niet geladen in index.html');
  });

  // ─── ZONDER GPS FILTER ────────────────────────────────────────────────────────

  test('API: zonder_gps filter aanwezig in GET /fotos', () => {
    if (!apiCode.includes('zonder_gps')) {
      throw new Error('zonder_gps filter niet gevonden in api.js');
    }
    if (!apiCode.includes('gps_lat IS NULL OR gps_lat = 0')) {
      throw new Error('zonder_gps SQL filter incorrect — verwacht: gps_lat IS NULL OR gps_lat = 0');
    }
  });

  test('API: zonderGps count aanwezig in stats endpoint', () => {
    const statsBlok = apiCode.slice(apiCode.indexOf("'/stats'"));
    if (!statsBlok.includes('zonderGps')) {
      throw new Error('zonderGps ontbreekt in /api/stats response');
    }
  });

  test('HTML: statZonderGps stat-kaart aanwezig en klikbaar', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // Nieuwe structuur: statFotosZonderGps en statVideosZonderGps vervangen het oude statZonderGps
    if (!htmlCode.includes('statFotosZonderGps') && !htmlCode.includes('statZonderGps')) {
      throw new Error('statFotosZonderGps (of statZonderGps) element niet gevonden in index.html');
    }
    if (!htmlCode.includes('zonder_gps')) {
      throw new Error('zonder_gps onclick niet gevonden in index.html stat-kaart');
    }
  });

  test('Fotos JS: setActieveFilter ondersteunt zonder_gps', () => {
    const fotosCode = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!fotosCode.includes('zonderGps') || !fotosCode.includes('zonder_gps')) {
      throw new Error('setActieveFilter/getActieveFilter ondersteunt geen zonder_gps filter in fotos.js');
    }
  });

  test('App JS: toonPagina verwerkt zonder_gps extraFilter', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('zonder_gps')) {
      throw new Error('toonPagina() verwerkt geen zonder_gps in app.js');
    }
  });

  // ─── GPS BULK TOEWIJZEN ───────────────────────────────────────────────────────

  test('API: GET /gps/groepen endpoint aanwezig', () => {
    if (!apiCode.includes("'/gps/groepen'")) throw new Error('/gps/groepen endpoint niet gevonden in api.js');
  });

  test('API: POST /gps/bulk-toewijzen endpoint aanwezig', () => {
    if (!apiCode.includes("'/gps/bulk-toewijzen'")) throw new Error('/gps/bulk-toewijzen endpoint niet gevonden in api.js');
  });

  test('API: groepering op 2-uur tijdblok aanwezig', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/groepen'));
    if (!blok.includes('GAP_MS') && !blok.includes('2 * 60 * 60')) {
      throw new Error('2-uur tijdblok groepering niet gevonden in /gps/groepen');
    }
  });

  test('API: bulk-toewijzen slaat gps_stad, gps_land, gps_lat, gps_lon op', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/bulk-toewijzen'));
    if (!blok.includes('gps_stad') || !blok.includes('gps_lat')) {
      throw new Error('GPS velden ontbreken in bulk-toewijzen endpoint');
    }
  });

  test('API: /gps/groepen ondersteunt is_video type-filter', () => {
    const blok = apiCode.slice(apiCode.indexOf("'/gps/groepen'"), apiCode.indexOf("'/gps/bulk-toewijzen'"));
    if (!blok.includes('is_video')) throw new Error('is_video type-filter ontbreekt in /gps/groepen');
    if (!blok.includes('f.is_video = 1')) throw new Error('video-filter (f.is_video = 1) ontbreekt in /gps/groepen');
  });

  test('HTML: GPS-pagina heeft type-filter knoppen (Alles/Foto/Video)', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    ['gpsTypeAlles', 'gpsTypeFotos', 'gpsTypeVideos'].forEach(id => {
      if (!htmlCode.includes(id)) throw new Error(id + ' ontbreekt in index.html');
    });
    if (!htmlCode.includes("setGpsBulkType('1')")) throw new Error('setGpsBulkType-aanroep voor video ontbreekt');
  });

  test('GPS Bulk JS: setGpsBulkType stuurt is_video mee in fetch', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('function setGpsBulkType')) throw new Error('setGpsBulkType() ontbreekt in gpsbulk.js');
    if (!code.includes('is_video=')) throw new Error('is_video querystring ontbreekt in gpsbulk.js fetch');
  });

  test('GPS Bulk JS: gpsbulk.js bestand bestaat', () => {
    const p = path.join(__dirname, '../public/js/gpsbulk.js');
    if (!fs.existsSync(p)) throw new Error('gpsbulk.js niet gevonden');
  });

  test('GPS Bulk JS: laadGpsBulk() functie aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('function laadGpsBulk') && !code.includes('async function laadGpsBulk')) {
      throw new Error('laadGpsBulk() niet gevonden in gpsbulk.js');
    }
  });

  test('GPS Bulk JS: bevestigBulkLocatie() roept bulk-toewijzen API aan', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('/api/gps/bulk-toewijzen')) {
      throw new Error('bulk-toewijzen API call niet gevonden in gpsbulk.js');
    }
  });

  test('HTML: paginaGpsbulk pagina en nav-knop aanwezig', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!htmlCode.includes('paginaGpsbulk')) throw new Error('paginaGpsbulk niet gevonden in index.html');
    if (!htmlCode.includes("toonPagina('gpsbulk')")) throw new Error('GPS bulk nav-knop niet gevonden in index.html');
  });

  test('App JS: gpsbulk pagina in namen array en laadGpsBulk() aangeroepen', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes("'gpsbulk'")) throw new Error("'gpsbulk' niet in namen array in app.js");
    if (!appCode.includes('laadGpsBulk')) throw new Error('laadGpsBulk() niet aangeroepen in app.js');
  });

  // ─── GPS BULK: DRAG & DROP + DUPLICATEN ──────────────────────────────────────

  test('API: bulk-toewijzen propageert GPS naar duplicaten via duplicaat_groep', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/bulk-toewijzen'));
    if (!blok.includes('duplicaat_groep')) {
      throw new Error('bulk-toewijzen propageert niet naar duplicaten — duplicaat_groep ontbreekt');
    }
  });

  test('GPS Bulk JS: drag & drop handlers aanwezig (onDragStart, onDrop)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('onDragStart')) throw new Error('onDragStart niet gevonden in gpsbulk.js');
    if (!code.includes('onDrop')) throw new Error('onDrop niet gevonden in gpsbulk.js');
  });

  test('GPS Bulk JS: multi-select via geselecteerd Set', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('geselecteerd') || !code.includes('new Set')) {
      throw new Error('Multi-select via Set niet gevonden in gpsbulk.js');
    }
  });

  test('GPS Bulk JS: hold zone aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('isHold') || !code.includes('hold zone')) {
      throw new Error('Hold zone niet gevonden in gpsbulk.js');
    }
  });

  test('GPS Bulk JS: nieuwe groep aanmaken (nieuweGroep)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('function nieuweGroep')) throw new Error('nieuweGroep() niet gevonden in gpsbulk.js');
    if (!code.includes('isHandmatig')) throw new Error('isHandmatig markering ontbreekt in nieuweGroep()');
  });

  test('GPS Bulk JS: sleepData bevat vanGroepId en fotoId', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('vanGroepId') || !code.includes('sleepData')) {
      throw new Error('sleepData structuur (vanGroepId/fotoId) niet gevonden in gpsbulk.js');
    }
  });

  // ─── GPS BULK KAARTPICKER ────────────────────────────────────────────────────

  test('GPS Bulk JS: openBulkKaart() functie aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('function openBulkKaart')) throw new Error('openBulkKaart() niet gevonden in gpsbulk.js');
  });

  test('GPS Bulk JS: kaartknop in picker HTML aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('openBulkKaart')) throw new Error('openBulkKaart aanroep niet gevonden in pickerKaartHtml');
  });

  test('GPS Bulk JS: bevestigBulkKaartLocatie() koppelt kaartlocatie aan groep', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('function bevestigBulkKaartLocatie')) throw new Error('bevestigBulkKaartLocatie() niet gevonden');
    if (!code.includes('bulkKaartActieveGroep')) throw new Error('bulkKaartActieveGroep niet gebruikt in kaartpicker');
  });

  test('GPS Bulk JS: reverse geocode via Nominatim in kaart klik handler', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('nominatim.openstreetmap.org/reverse')) throw new Error('Nominatim reverse geocode niet gevonden in gpsbulk.js');
  });

  test('HTML: bulkKaartOverlay modal aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('bulkKaartOverlay')) throw new Error('bulkKaartOverlay niet gevonden in index.html');
    if (!html.includes('bulkKaartContainer')) throw new Error('bulkKaartContainer niet gevonden in index.html');
  });

  test('CLAUDE.md: tests + commit regel verankerd', () => {
    const md = fs.readFileSync(path.join(__dirname, '../CLAUDE.md'), 'utf8');
    if (!md.includes('git add -A && git commit')) throw new Error('commit regel niet gevonden in CLAUDE.md');
  });

  // ─── HOVER PREVIEW ───────────────────────────────────────────────────────────

  test('GPS Bulk JS: hover preview handlers aanwezig (bindHoverPreview)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('bindHoverPreview')) throw new Error('bindHoverPreview() niet gevonden in gpsbulk.js');
    if (!code.includes('onThumbHoverIn')) throw new Error('onThumbHoverIn handler niet gevonden');
    if (!code.includes('toonPreview')) throw new Error('toonPreview() niet gevonden in gpsbulk.js');
  });

  test('GPS Bulk JS: preview verborgen bij dragstart', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('verbergPreview')) throw new Error('verbergPreview() niet gevonden — preview blijft zichtbaar bij slepen');
  });

  test('HTML: bulkThumbPreview element aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('bulkThumbPreview')) throw new Error('bulkThumbPreview div niet gevonden in index.html');
  });

  test('GPS Bulk JS: auto-promote hold zone als geen normale groepen meer', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('heeftNormaleGroepen')) throw new Error('heeftNormaleGroepen check ontbreekt — hold zone wordt niet auto-gepromoot');
    if (!code.includes('Auto-promote hold zone')) throw new Error('Auto-promote logica niet gevonden in onDrop()');
  });

  // ─── GPS PROPAGATIE VIA PUT /fotos/:id ───────────────────────────────────────

  test('API: PUT /fotos/:id propageert GPS naar duplicaten in zelfde groep', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/fotos/:id'"));
    if (!putBlok.includes('duplicaat_groep')) {
      throw new Error('PUT /fotos/:id controleert duplicaat_groep niet — GPS wordt niet gepropageerd naar duplicaten');
    }
    if (!putBlok.includes('heeftGpsUpdate')) {
      throw new Error('heeftGpsUpdate check ontbreekt in PUT /fotos/:id');
    }
  });

  test('API: PUT /fotos/:id propageert alleen als GPS velden aanwezig zijn in request', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/fotos/:id'"));
    if (!putBlok.includes('some(v => v !== undefined)')) {
      throw new Error('GPS-update detectie (some(v => v !== undefined)) ontbreekt in PUT /fotos/:id');
    }
  });

  test('API: PUT /fotos/:id gebruikt undefined-check zodat null GPS velden gewist worden', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/fotos/:id'"));
    if (!putBlok.includes('!== undefined ? gps_lat')) {
      throw new Error('PUT /fotos/:id gebruikt ?? i.p.v. undefined-check — null kan GPS velden niet wissen');
    }
  });

  test('Fotos JS: lege stad+land wist ook GPS coördinaten', () => {
    if (!fotosCode.includes('wisGps')) throw new Error('wisGps logica ontbreekt in slaaBewerkingOpFoto()');
    if (!fotosCode.includes('gps_lat:       wisGps ? null : undefined')) throw new Error('gps_lat wordt niet gewist bij leeg stad+land');
  });

  test('Fotos JS: land_code afgeleid uit LAND_CODES bij tekstinvoer', () => {
    if (!fotosCode.includes('LAND_CODES[land]')) throw new Error('LAND_CODES lookup ontbreekt bij opslaan via tekstveld');
  });

  test('Fotos JS: GPS kaart invalidateSize na heropen', () => {
    if (!fotosCode.includes('invalidateSize')) throw new Error('gpsKaart.invalidateSize() niet aangeroepen in openGpsKaart()');
  });

  test('Fotos JS: kaart-panel herlaadt na opslaan als het open is', () => {
    if (!fotosCode.includes('kaartPanelOverlay')) throw new Error('kaartPanelOverlay check ontbreekt in slaaBewerkingOpFoto');
    if (!fotosCode.includes('laadPanelFotos')) throw new Error('laadPanelFotos() niet aangeroepen na opslaan');
    if (!fotosCode.includes('herlaadLocaties')) throw new Error('herlaadLocaties() niet aangeroepen na wissen GPS');
  });

  // ─── DATABASE WIS BEHOUDT BRONNEN ────────────────────────────────────────────

  test('API: database/wis verwijdert geen bronnen', () => {
    const wisBlok = apiCode.slice(apiCode.indexOf("'/database/wis'"));
    if (wisBlok.slice(0, 300).includes('DELETE FROM bronnen')) {
      throw new Error('database/wis wist nog steeds bronnen — bronnen moeten bewaard blijven');
    }
  });

  test('API: database/wis reset totaal_fotos en laatste_scan op bronnen', () => {
    const wisBlok = apiCode.slice(apiCode.indexOf("'/database/wis'"));
    if (!wisBlok.slice(0, 300).includes('UPDATE bronnen SET totaal_fotos = 0')) {
      throw new Error('database/wis reset totaal_fotos niet op bronnen na wissen');
    }
  });

  test('HTML: database wis knop zegt "Wis foto-records" (niet bronnen)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('Bronnen blijven bewaard')) {
      throw new Error('UI tekst vermeldt niet dat bronnen bewaard blijven na database wis');
    }
  });

  test('Fotos JS: auto-close modal na opslaan (setTimeout 1000ms)', () => {
    if (!fotosCode.includes('setTimeout') || !fotosCode.includes('modalOverlay')) {
      throw new Error('Auto-close na opslaan ontbreekt in slaaBewerkingOpFoto');
    }
    if (!fotosCode.includes('1000')) throw new Error('1 seconde vertraging ontbreekt bij auto-close');
  });

  test('Fotos JS: lege rijen verborgen in metadatatabel', () => {
    if (!fotosCode.includes(".filter(([k, v]) => v && v !== '—')")) {
      throw new Error('Filter op lege rijen ontbreekt in renderModal');
    }
  });

  test('Fotos JS: bewerkformulier in tabelstijl (meta-input)', () => {
    if (!fotosCode.includes('meta-input')) throw new Error('meta-input klasse ontbreekt in bewerkformulier');
    if (!fotosCode.includes('bewerk-tabel')) throw new Error('bewerk-tabel klasse ontbreekt in bewerkformulier');
  });

  test('CSS: modal heeft max-height ipv vaste height', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    // Zoek naar vaste height (niet max-height) via regex
    if (/(?<!max-)height: calc\(100vh - var\(--balk-h\) - 32px\)/.test(css)) {
      throw new Error('Modal gebruikt nog vaste height — moet max-height zijn');
    }
    if (!css.includes('max-height: calc(100vh - var(--balk-h) - 32px)')) {
      throw new Error('max-height ontbreekt op .modal');
    }
  });

  // Fase navigatie tests
  test('DB: instellingen tabel aanwezig in database.js', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('instellingen')) throw new Error('instellingen tabel ontbreekt in database.js');
    if (!dbCode.includes("'fase'")) throw new Error('standaard fase instelling ontbreekt');
  });

  test('DB: locatie_onbekend kolom migratie aanwezig', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('locatie_onbekend')) throw new Error('locatie_onbekend migratie ontbreekt');
  });

  test('DB: genegeerd kolom migratie aanwezig', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('genegeerd')) throw new Error('genegeerd migratie ontbreekt');
  });

  test('API: GET /fase endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/fase'")) throw new Error('GET /fase endpoint ontbreekt');
  });

  test('API: POST /fase endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'POST', '/fase'") && !apiCode.includes("router.post('/fase'")) throw new Error('POST /fase endpoint ontbreekt');
  });

  test('API: POST /fotos/:id/locatie-onbekend endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('locatie-onbekend')) throw new Error('locatie-onbekend endpoint ontbreekt');
  });

  test('API: POST /fotos/:id/negeer endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('/negeer')) throw new Error('negeer endpoint ontbreekt');
  });

  test('API: GET /fase1/todo endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('fase1/todo')) throw new Error('fase1/todo endpoint ontbreekt');
  });

  test('API: genegeerd filter aanwezig in GET /fotos', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("genegeerd === '1'")) throw new Error('genegeerd filter ontbreekt in GET /fotos');
  });

  test('HTML: fase stepper aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('faseStepper')) throw new Error('faseStepper element ontbreekt');
    if (!html.includes('stapFase1')) throw new Error('stapFase1 ontbreekt');
  });

  test('HTML: fase 2 paginas aanwezig (negeren, genegeerd)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('paginaNegeren')) throw new Error('paginaNegeren ontbreekt');
    if (!html.includes('paginaGenegeerd')) throw new Error('paginaGenegeerd ontbreekt');
  });

  test('HTML: fase1Todo checklist aanwezig op dashboard', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('fase1Todo')) throw new Error('fase1Todo checklist ontbreekt');
  });

  test('App JS: laadFase() functie aanwezig', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('laadFase')) throw new Error('laadFase() ontbreekt in app.js');
  });

  test('App JS: zetFase() en gaaNaarFase() aanwezig', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('zetFase')) throw new Error('zetFase() ontbreekt');
    if (!appCode.includes('gaaNaarFase')) throw new Error('gaaNaarFase() ontbreekt');
  });

  test('App JS: updateNavFase() past nav-fase1 en nav-fase2 aan', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('nav-fase1')) throw new Error('nav-fase1 toggle ontbreekt');
    if (!appCode.includes('nav-fase2')) throw new Error('nav-fase2 toggle ontbreekt');
  });

  test('Negeren JS: laadNegeren() en toggleNegeer() aanwezig', () => {
    const negerenCode = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!negerenCode.includes('laadNegeren')) throw new Error('laadNegeren() ontbreekt');
    if (!negerenCode.includes('toggleNegeer')) throw new Error('toggleNegeer() ontbreekt');
  });

  test('Negeren JS: genegeerde foto verdwijnt uit de review-lijst', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!code.includes("classList.add('verdwijnt')")) throw new Error('fade-out (verdwijnt) ontbreekt in toggleNegeerItem');
    if (!code.includes('el.remove()')) throw new Error('genegeerd item wordt niet uit de DOM verwijderd');
    if (!code.includes('verlaagNegerenTeller')) throw new Error('teller wordt niet bijgewerkt na negeren');
  });

  test('CSS: .negeer-item.verdwijnt fade-out aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.negeer-item.verdwijnt')) throw new Error('verdwijnt fade-out CSS ontbreekt');
  });

  test('API: POST /genegeerd/verwijder endpoint aanwezig (prullenbak + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/genegeerd/verwijder'")) throw new Error('POST /genegeerd/verwijder endpoint ontbreekt');
    if (!apiCode.includes("require('trash')")) throw new Error('trash (prullenbak) wordt niet gebruikt');
    if (!apiCode.includes('DELETE FROM fotos')) throw new Error('DB-records worden niet verwijderd');
  });

  test('API: verwijder-genegeerd cascadeert over duplicaatgroep', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("'/genegeerd/verwijder'"));
    if (!blok.includes('duplicaat_groep IN')) throw new Error('cascade over duplicaatgroep ontbreekt');
    if (!blok.includes('fs.existsSync')) throw new Error('bestaande bestanden worden niet gefilterd voor verwijderen');
  });

  test('HTML: Verwijder-genegeerd knop aanwezig op Genegeerd-pagina', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('verwijderGenegeerdKnop')) throw new Error('verwijder-knop ontbreekt op Genegeerd-pagina');
    if (!html.includes('verwijderAlleGenegeerd()')) throw new Error('onclick verwijderAlleGenegeerd ontbreekt');
  });

  test('Negeren JS: verwijderAlleGenegeerd met bevestiging en endpoint-call', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!code.includes('function verwijderAlleGenegeerd')) throw new Error('verwijderAlleGenegeerd() ontbreekt');
    if (!code.includes('confirm(')) throw new Error('bevestigingsdialoog ontbreekt');
    if (!code.includes('/api/genegeerd/verwijder')) throw new Error('endpoint wordt niet aangeroepen');
  });

  test('API: POST /fotos/:id/verwijder endpoint aanwezig (prullenbak + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/fotos/:id/verwijder'")) throw new Error('POST /fotos/:id/verwijder endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/fotos/:id/verwijder'"));
    if (!blok.includes("require('trash')")) throw new Error('trash (prullenbak) wordt niet gebruikt bij enkele verwijdering');
    if (!blok.includes('DELETE FROM fotos WHERE id = ?')) throw new Error('DB-record wordt niet verwijderd');
  });

  test('Fotos JS: verwijderFotoDefinitief met bevestiging en endpoint-call', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('function verwijderFotoDefinitief')) throw new Error('verwijderFotoDefinitief() ontbreekt');
    if (!code.includes('confirm(')) throw new Error('bevestigingsdialoog ontbreekt');
    if (!code.includes("/verwijder'") && !code.includes('/verwijder`')) throw new Error('verwijder-endpoint wordt niet aangeroepen');
    if (!code.includes('verwijderFotoKnop')) throw new Error('verwijderknop wordt niet beheerd in modal');
  });

  test('Fotos JS: verwijderen herlaadt juiste lijst (foto vs video)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('huidigeItemIsVideo') || !code.includes('laadVideos(1)')) {
      throw new Error('verwijderen herlaadt niet de video-lijst voor video-items');
    }
  });

  test('Videos JS: verwijderknop in video-detailvenster aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    if (!code.includes('verwijderFotoKnop')) throw new Error('verwijderknop ontbreekt in video-modal');
    if (!code.includes('verwijderFotoDefinitief(')) throw new Error('onclick verwijderFotoDefinitief ontbreekt in video-modal');
  });

  test('HTML: Negeren-pagina opent in review-queue (Nog te beoordelen)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!/value="nog-niet"\s+selected/.test(html)) throw new Error('Negeren-filter staat niet standaard op "Nog te beoordelen"');
  });

  test('API: duplicaten wis + preview endpoints aanwezig (trash + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/duplicaten/wis'")) throw new Error('POST /duplicaten/wis endpoint ontbreekt');
    if (!apiCode.includes("'/duplicaten/wis-preview'")) throw new Error('POST /duplicaten/wis-preview endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/duplicaten/wis'"));
    if (!blok.includes("require('trash')")) throw new Error('duplicaten-wis gebruikt geen prullenbak');
    if (!blok.includes('DELETE FROM fotos')) throw new Error('duplicaten-wis verwijdert geen DB-records');
  });

  test('API: bepaalOrigineel keeper-logica (prioriteit, handmatig, keuze nodig)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('function bepaalOrigineel')) throw new Error('bepaalOrigineel() ontbreekt');
    if (!apiCode.includes('bronVolgorde')) throw new Error('prioriteit (bronVolgorde) wordt niet gebruikt');
    if (!apiCode.includes('return null')) throw new Error('keuze-nodig (null) tak ontbreekt');
  });

  test('Duplicaten JS: prioriteit, keeper en handmatige override', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!code.includes('bepaalOrigineelClient')) throw new Error('client keeper-logica ontbreekt');
    if (!code.includes('dupBronVolgorde')) throw new Error('prioriteit wordt niet onthouden (localStorage)');
    if (!code.includes('function maakOrigineel')) throw new Error('handmatige override ontbreekt');
    if (!code.includes('wisAlleDuplicaten') || !code.includes('wisGroep')) throw new Error('wis-acties ontbreken');
  });

  test('HTML: prioriteit-modal en duplicaten-knoppen aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('prioOverlay')) throw new Error('prioriteit-modal ontbreekt');
    if (!html.includes('openPrioModal()')) throw new Error('knop "Prioriteit instellen" ontbreekt');
    if (!html.includes('wisAlleDuplicaten()')) throw new Error('knop "Alle duplicaten wissen" ontbreekt');
  });

  test('CSS: duplicaten-badges en prioriteit-modal stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.dup-badge-origineel')) throw new Error('ORIGINEEL-badge stijl ontbreekt');
    if (!css.includes('.prio-modal')) throw new Error('prioriteit-modal stijl ontbreekt');
  });

  test('Label: keeper heet "BEHOUDEN", niet misleidend "ORIGINEEL"', () => {
    const i18n = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    // In alle 4 talen mag de keeper-badge niet langer letterlijk ORIGINEEL/ORIGINAL zijn
    const waarden = [...i18n.matchAll(/dup_origineel:\s*"([^"]*)"/g)].map(m => m[1]);
    if (waarden.length < 4) throw new Error('dup_origineel ontbreekt in een taal');
    for (const v of waarden) {
      if (/ORIGINEEL|ORIGINAL/i.test(v)) throw new Error('keeper-label is nog misleidend: ' + v);
    }
    if (!i18n.includes('"BEHOUDEN"')) throw new Error('NL-label BEHOUDEN ontbreekt');
    // Foto-modal mag niet meer "Origineel —" tonen als label voor de keeper
    const fotos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!fotos.includes('Behouden exemplaar')) throw new Error('modal toont keeper niet als "Behouden exemplaar"');
  });

  test('API: keeper opschonen na wissen (geen verweesde DUP-restant)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('function schoonDuplicaatGroepenOp')) throw new Error('opschoon-helper ontbreekt');
    if (!apiCode.includes('is_duplicaat = 0, duplicaat_groep = NULL')) throw new Error('keeper wordt niet ontmarkeerd');
    // De drie wis-routes moeten de opschoning aanroepen
    const aantal = (apiCode.match(/schoonDuplicaatGroepenOp\(db,/g) || []).length;
    if (aantal < 3) throw new Error('opschoning niet overal aangeroepen (verwacht >= 3)');
  });

  test('API: duplicaten-overzicht toont geen 1-lid-groepen', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("router.get('/duplicaten'"));
    if (!blok.includes('HAVING COUNT(*) > 1')) throw new Error('1-lid-groepen worden niet uitgefilterd');
  });

  // ─── FASE A: GEDEELDE KEEPER-LOGICA (src/keeper.js) ───────────────────────────

  test('Keeper: src/keeper.js bestaat en exporteert de gedeelde functies', () => {
    const p = path.join(__dirname, '../src/keeper.js');
    if (!fs.existsSync(p)) throw new Error('src/keeper.js niet gevonden');
    const keeper = require('../src/keeper');
    for (const fn of ['leesPrioriteit', 'schrijfPrioriteit', 'bepaalKeeper', 'keeperIds']) {
      if (typeof keeper[fn] !== 'function') throw new Error(`keeper.${fn} ontbreekt`);
    }
  });

  test('Keeper: handmatige keuze wint boven bron-prioriteit', () => {
    const { bepaalKeeper } = require('../src/keeper');
    const fotos = [{ id: 1, bron_id: 10 }, { id: 2, bron_id: 20 }, { id: 3, bron_id: 30 }];
    // bron 30 is hoogst gerangschikt, maar handmatig kiest id 1
    if (bepaalKeeper(fotos, [30, 20, 10], 1) !== 1) throw new Error('handmatige override genegeerd');
  });

  test('Keeper: hoogst gerangschikte bron wint (gelijkspel → laagste id)', () => {
    const { bepaalKeeper } = require('../src/keeper');
    const fotos = [{ id: 5, bron_id: 10 }, { id: 2, bron_id: 20 }, { id: 9, bron_id: 20 }];
    // bron 20 staat eerst in de volgorde → twee kandidaten id 2 en 9 → laagste id wint = 2
    if (bepaalKeeper(fotos, [20, 10]) !== 2) throw new Error('bron-prioriteit/gelijkspel verkeerd');
  });

  test('Keeper: verplicht=true valt terug op laagste id als niets gerangschikt is', () => {
    const { bepaalKeeper } = require('../src/keeper');
    const fotos = [{ id: 7, bron_id: 99 }, { id: 3, bron_id: 88 }];
    if (bepaalKeeper(fotos, [], undefined, { verplicht: true }) !== 3) {
      throw new Error('export-fallback (laagste id) werkt niet');
    }
  });

  test('Keeper: verplicht=false geeft null ("keuze nodig") als niets gerangschikt is', () => {
    const { bepaalKeeper } = require('../src/keeper');
    const fotos = [{ id: 7, bron_id: 99 }, { id: 3, bron_id: 88 }];
    if (bepaalKeeper(fotos, [], undefined, { verplicht: false }) !== null) {
      throw new Error('wis-flow geeft geen "keuze nodig" terug');
    }
  });

  test('Keeper: lees/schrijf prioriteit roundtrip via instellingen-tabel', () => {
    let db;
    try { db = new (require('better-sqlite3'))(':memory:'); }
    catch (_) { return; } // omgeving zonder werkende native module → overslaan
    db.exec('CREATE TABLE instellingen (sleutel TEXT PRIMARY KEY, waarde TEXT)');
    const { leesPrioriteit, schrijfPrioriteit } = require('../src/keeper');

    // Leeg = veilige defaults
    const leeg = leesPrioriteit(db);
    if (!Array.isArray(leeg.bronVolgorde) || typeof leeg.handmatig !== 'object') {
      throw new Error('defaults niet correct bij lege instellingen');
    }
    schrijfPrioriteit(db, [3, 1, 2], { 'abc': 42 });
    const terug = leesPrioriteit(db);
    if (JSON.stringify(terug.bronVolgorde) !== '[3,1,2]') throw new Error('bronVolgorde niet bewaard');
    if (terug.handmatig.abc !== 42) throw new Error('handmatige keuze niet bewaard');
    db.close();
  });

  test('Keeper: keeperIds kiest één keeper per groep, niet-duplicaten genegeerd', () => {
    let db;
    try { db = new (require('better-sqlite3'))(':memory:'); }
    catch (_) { return; }
    db.exec(`
      CREATE TABLE instellingen (sleutel TEXT PRIMARY KEY, waarde TEXT);
      CREATE TABLE fotos (id INTEGER PRIMARY KEY, bron_id INTEGER, duplicaat_groep TEXT);
      INSERT INTO fotos VALUES (1, 10, 'h1'), (2, 20, 'h1'), (3, 30, NULL), (4, 10, 'h2'), (5, 20, 'h2');
    `);
    const { keeperIds, schrijfPrioriteit } = require('../src/keeper');
    schrijfPrioriteit(db, [20, 10], {}); // bron 20 voorrang
    const ids = keeperIds(db);
    // groep h1: bron 20 = id 2; groep h2: bron 20 = id 5; foto 3 is geen duplicaat → niet in set
    if (!ids.has(2) || !ids.has(5)) throw new Error('keeper per groep ontbreekt');
    if (ids.has(1) || ids.has(4) || ids.has(3)) throw new Error('verkeerde foto als keeper gemarkeerd');
    if (ids.size !== 2) throw new Error('verwacht precies 2 keepers');
    db.close();
  });

  test('API: prioriteit-endpoints (GET/POST /duplicaten/prioriteit) aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("router.get('/duplicaten/prioriteit'")) throw new Error('GET prioriteit ontbreekt');
    if (!apiCode.includes("router.post('/duplicaten/prioriteit'")) throw new Error('POST prioriteit ontbreekt');
    if (!apiCode.includes("require('./keeper')")) throw new Error('keeper-module niet geïmporteerd in api.js');
    // bepaalOrigineel delegeert nu naar de gedeelde bepaalKeeper
    if (!apiCode.includes('bepaalKeeper(fotos, bronVolgorde, handmatigId')) {
      throw new Error('bepaalOrigineel delegeert niet naar gedeelde bepaalKeeper');
    }
  });

  test('Export: selecteerFotos neemt keeper per groep mee (niet langer is_duplicaat=0 filter)', () => {
    const exportCode = fs.readFileSync(path.join(__dirname, '../src/export.js'), 'utf8');
    if (!exportCode.includes("require('./keeper')")) throw new Error('export importeert keeper niet');
    if (!exportCode.includes('keeperIds')) throw new Error('export gebruikt keeperIds niet');
    const blok = exportCode.slice(exportCode.indexOf('function selecteerFotos'));
    if (/AND\s*\(is_duplicaat\s*=\s*0/.test(blok)) {
      throw new Error('export filtert nog steeds alle duplicaten weg (is_duplicaat=0) — keeper valt buiten export');
    }
    if (!blok.includes('keepers.has(f.id)')) throw new Error('export selecteert keeper niet expliciet');
  });

  test('API: detailvenster bepaalt keeper via gedeelde logica (niet hardcoded pc/gsm subquery)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("router.get('/fotos/:id'"), apiCode.indexOf("router.get('/fotos/:id'") + 1400);
    if (!blok.includes('bepaalKeeper')) throw new Error('detailvenster gebruikt gedeelde keeper niet');
    if (!blok.includes('leesPrioriteit')) throw new Error('detailvenster leest opgeslagen prioriteit niet');
  });

  test('Duplicaten JS: prioriteit gesynct met server (API i.p.v. alleen localStorage)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!code.includes('/api/duplicaten/prioriteit')) throw new Error('frontend praat niet met prioriteit-API');
    if (!code.includes('syncPrioVanServer')) throw new Error('server→cache sync ontbreekt');
    if (!code.includes('bewaarPrioOpServer')) throw new Error('cache→server sync ontbreekt');
  });

  test('API: toon-in-map endpoint (bestandsbeheerder, cross-platform)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/fotos/:id/toon-in-map'")) throw new Error('toon-in-map endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/fotos/:id/toon-in-map'"));
    if (!blok.includes('electronRevealInFolder')) throw new Error('Electron reveal-pad ontbreekt');
    if (!blok.includes("'/select,'") && !blok.includes('/select,')) throw new Error('Windows explorer /select ontbreekt');
    if (!blok.includes("'-R'")) throw new Error('macOS open -R ontbreekt');
    if (!blok.includes('FileManager1.ShowItems')) throw new Error('Linux dbus ShowItems ontbreekt');
    if (!blok.includes('xdg-open')) throw new Error('Linux xdg-open fallback ontbreekt');
  });

  test('Electron: showItemInFolder beschikbaar als global', () => {
    const code = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!code.includes('electronRevealInFolder')) throw new Error('reveal-global ontbreekt');
    if (!code.includes('shell.showItemInFolder')) throw new Error('showItemInFolder niet gebruikt');
  });

  test('Foto/Video JS: padlinks openen de bestandsbeheerder (toonInMap)', () => {
    const fotos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    const videos = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    if (!fotos.includes('function toonInMap')) throw new Error('toonInMap functie ontbreekt');
    if (!fotos.includes('toon-in-map')) throw new Error('fotos roept toon-in-map endpoint niet aan');
    // Hoofdpad én duplicaat-locaties moeten beide toonInMap aanroepen
    const aantalFoto = (fotos.match(/toonInMap\(event,/g) || []).length;
    if (aantalFoto < 2) throw new Error('niet alle padlinks (pad + duplicaten) gebruiken toonInMap');
    if (!videos.includes('toonInMap(event,')) throw new Error('video-padlink gebruikt toonInMap niet');
  });

  test('DB: migratie schoont verweesde duplicaat-restanten op', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('verweesde duplicaat-restant')) throw new Error('opschoon-migratie ontbreekt');
    if (!dbCode.includes('HAVING COUNT(*) <= 1')) throw new Error('migratie selecteert geen 1-lid-groepen');
    if (!dbCode.includes('is_duplicaat = 0, duplicaat_groep = NULL')) throw new Error('migratie ontmarkeert niet');
  });

  test('CSS: fase-stepper stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('fase-stepper')) throw new Error('fase-stepper CSS ontbreekt');
    if (!css.includes('stap-cirkel')) throw new Error('stap-cirkel CSS ontbreekt');
  });

  test('API: GET /wrapped endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/wrapped'")) throw new Error('GET /wrapped endpoint ontbreekt');
    if (!apiCode.includes('aantalLanden') || !apiCode.includes('druksteMaand')) throw new Error('wrapped cijfers ontbreken');
  });

  test('HTML: paginaWrapped pagina en nav-knop aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('paginaWrapped')) throw new Error('paginaWrapped ontbreekt');
    if (!html.includes('data-pagina="wrapped"')) throw new Error('wrapped nav-knop ontbreekt');
    if (!html.includes('wrapped.js')) throw new Error('wrapped.js script-tag ontbreekt');
  });

  test('Wrapped JS: laadWrapped() en download-functie aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/wrapped.js'), 'utf8');
    if (!code.includes('laadWrapped')) throw new Error('laadWrapped() ontbreekt');
    if (!code.includes('downloadWrapped')) throw new Error('downloadWrapped() ontbreekt');
    if (!code.includes('toBlob') && !code.includes('toDataURL')) throw new Error('canvas-export ontbreekt');
  });

  test('App JS: toonPagina roept laadWrapped() aan', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('laadWrapped')) throw new Error('laadWrapped() niet aangeroepen in app.js');
  });

  test('CSS: wrapped-kaart stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('wrapped-kaart')) throw new Error('wrapped-kaart CSS ontbreekt');
  });

  // ─── UITGEBREIDE FILTERS (Optie C: uitklap-paneel) ───────────────────────────

  test('API: /fotos ondersteunt met_gps filter (met locatie)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('met_gps') || !code.includes('gps_lat IS NOT NULL')) {
      throw new Error('met_gps filter ontbreekt in /fotos endpoint');
    }
  });

  test('API: /fotos ondersteunt alleen_dubbel filter', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('alleen_dubbel') || !code.includes('f.is_duplicaat = 1')) {
      throw new Error('alleen_dubbel filter ontbreekt in /fotos endpoint');
    }
  });

  test('API: /fotos ondersteunt alleen_uniek filter', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('alleen_uniek')) {
      throw new Error('alleen_uniek filter ontbreekt in /fotos endpoint');
    }
  });

  test('HTML: foto-pagina heeft altijd-zichtbaar filterpaneel met 6 filters', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    ['filterPaneel', 'filterCamera', 'filterLand', 'filterLocatie', 'filterDup']
      .forEach(id => { if (!html.includes(id)) throw new Error(id + ' ontbreekt in index.html'); });
    // Filterpaneel mag niet meer verborgen worden achter een toggle-knop
    if (html.includes('id="filterToggle"')) throw new Error('filterToggle-knop hoort verwijderd te zijn');
    if (/id="filterPaneel"[^>]*display:\s*none/.test(html)) throw new Error('filterPaneel mag niet verborgen zijn');
  });

  test('HTML: video-pagina heeft altijd-zichtbaar filterpaneel met 6 filters', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    ['filterPaneelVideo', 'filterCameraVideo', 'filterLandVideo', 'filterLocatieVideo', 'filterDupVideo']
      .forEach(id => { if (!html.includes(id)) throw new Error(id + ' ontbreekt in index.html'); });
    if (html.includes('id="filterToggleVideo"')) throw new Error('filterToggleVideo-knop hoort verwijderd te zijn');
    if (/id="filterPaneelVideo"[^>]*display:\s*none/.test(html)) throw new Error('filterPaneelVideo mag niet verborgen zijn');
  });

  test('Fotos JS: wisAlleFilters en updateFilterBadge aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('function wisAlleFilters')) throw new Error('wisAlleFilters ontbreekt');
    if (!code.includes('function updateFilterBadge')) throw new Error('updateFilterBadge ontbreekt');
  });

  test('Fotos JS: laadFotos stuurt nieuwe filter-parameters mee', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    ['met_gps', 'zonder_gps', 'alleen_uniek', 'alleen_dubbel', 'camera_merk', 'land']
      .forEach(p => { if (!code.includes(p)) throw new Error(p + ' ontbreekt in laadFotos'); });
  });

  test('Fotos JS: laadBronnenFilter vult camera- en land-dropdown', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('filterCamera') || !code.includes('filterLand')) {
      throw new Error('camera/land dropdown-vulling ontbreekt in laadBronnenFilter');
    }
    if (!code.includes('perCamera') || !code.includes('perLand')) {
      throw new Error('stats perCamera/perLand niet gebruikt voor dropdowns');
    }
  });

  test('Videos JS: laadVideos stuurt nieuwe filter-parameters mee', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    ['met_gps', 'alleen_uniek', 'alleen_dubbel', 'camera_merk', 'land']
      .forEach(p => { if (!code.includes(p)) throw new Error(p + ' ontbreekt in laadVideos'); });
  });

  test('CSS: filter-paneel en filter-toggle stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.filter-paneel') || !css.includes('.filter-toggle') || !css.includes('.filter-badge')) {
      throw new Error('filter-paneel/toggle/badge CSS ontbreekt');
    }
  });

  test('i18n: nieuwe filter-sleutels aanwezig in alle 4 talen', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    const matches = code.match(/filter_dup_dubbel/g) || [];
    if (matches.length < 4) throw new Error('filter_dup_dubbel niet in alle 4 talen aanwezig');
    if (!code.includes('filter_locatie_met') || !code.includes('filter_alle_cameras')) {
      throw new Error('filter i18n-sleutels ontbreken');
    }
  });

  test('HTML: dashboard stat-kaarten sturen dup/locatie filter mee', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // Klikbare kaarten zetten de juiste filter via toonPagina(..., { dup/locatie })
    if (!html.includes("dup: 'uniek'") || !html.includes("dup: 'dubbel'")) {
      throw new Error('dashboard Uniek/Dubbel-kaarten zetten geen dup-filter');
    }
    if (!html.includes("locatie: 'met'") || !html.includes("locatie: 'zonder'")) {
      throw new Error('dashboard Met/Zonder locatie-kaarten zetten geen locatie-filter');
    }
  });

  test('App JS: toonPagina verwerkt dup en locatie extraFilter (foto + video)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    ['filterLocatie', 'filterDup', 'filterLocatieVideo', 'filterDupVideo']
      .forEach(id => { if (!code.includes(id)) throw new Error(id + ' niet gezet in toonPagina'); });
    if (!code.includes('extraFilter?.dup') || !code.includes('extraFilter?.locatie')) {
      throw new Error('toonPagina leest extraFilter.dup/locatie niet uit');
    }
  });

  test('Dashboard JS: Landen-grafieken openen de kaart op het land', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/dashboard.js'), 'utf8');
    if (!code.includes("toonPagina('kaart'")) {
      throw new Error('Landen-grafiek opent de kaart niet (toonPagina(\'kaart\'))');
    }
    // Foto's: type-filter foto's op dat land
    if (!/toonPagina\('kaart',\s*\{\s*land:[^}]*is_video:\s*'0'/.test(code)) {
      throw new Error('Landen (foto\'s)-grafiek geeft land + is_video 0 niet door');
    }
    // Video's: gecombineerde kaart met video-nadruk op dat land
    if (!/toonPagina\('kaart',\s*\{\s*land:[^}]*video_nadruk:\s*true/.test(code)) {
      throw new Error('Landen (video\'s)-grafiek geeft land + video_nadruk niet door');
    }
  });

  test('Kaart JS: video-nadruk licht video-locaties uit (gecombineerde kaart)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!code.includes('kaartVideoNadruk')) {
      throw new Error('kaart.js kent geen video-nadruk');
    }
    if (!code.includes('km-video-nadruk')) {
      throw new Error('video-locaties krijgen geen km-video-nadruk klasse');
    }
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.km-marker.km-video-nadruk')) {
      throw new Error('CSS voor km-video-nadruk ontbreekt');
    }
  });

  test('App JS: toonPagina geeft extraFilter door aan laadKaart', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!code.includes('laadKaart(extraFilter)')) {
      throw new Error('toonPagina geeft extraFilter niet door aan laadKaart');
    }
  });

  test('Kaart JS: laadKaart past gewenst land vanuit dashboard toe', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!code.includes('kaartGewensteLand')) {
      throw new Error('kaart.js verwerkt geen gewenst land vanuit dashboard');
    }
    if (!code.includes('function laadKaart(extraFilter)')) {
      throw new Error('laadKaart accepteert geen extraFilter');
    }
    if (!code.includes('filterKaart()')) {
      throw new Error('laadKaart past het landfilter niet toe via filterKaart()');
    }
  });

  return resultaten;
};
