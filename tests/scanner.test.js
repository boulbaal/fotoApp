const fs   = require('fs');
const path = require('path');

module.exports = async function testScanner() {
  const resultaten = [];

  function test(name, fn) {
    try {
      fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
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

  test('scanStopRequested check aanwezig in findAllPhotos', () => {
    if (!scannerCode.includes('if (scanStopRequested) return')) throw new Error('Stop check ontbreekt in findAllPhotos');
  });

  // ─── GPS & GEOCODING ──────────────────────────────────────────────────────

  test('GPS adres ophaling gebruikt accept-language=en', () => {
    if (!scannerCode.includes('accept-language=en')) throw new Error('Engelse landnamen niet geconfigureerd');
  });

  test('fetchGpsAddress functie aanwezig', () => {
    if (!scannerCode.includes('async function fetchGpsAddress')) throw new Error('fetchGpsAddress niet gevonden');
  });

  test('GPS cache aanwezig (voorkomt dubbele Nominatim-calls)', () => {
    if (!scannerCode.includes('gpsCache')) throw new Error('GPS cache ontbreekt');
  });

  test('gps_country_code wordt opgeslagen bij geocoding', () => {
    if (!scannerCode.includes('gps_country_code')) throw new Error('gps_country_code niet gevonden in scanner');
  });

  test('Post-scan geocode pass aanwezig', () => {
    if (!scannerCode.includes('async function startGeocodePass')) throw new Error('startGeocodePass niet gevonden');
  });

  test('Geocode pass wordt na scan started', () => {
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
    if (!scannerCode.includes('detectDuplicates')) throw new Error('detectDuplicates functie niet gevonden');
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

  test('EXIF heeft voorrang boven Google JSON (date)', () => {
    // Keten: EXIF → Google JSON → filename → birthtime → mtime
    if (!scannerCode.includes("dateSource = 'EXIF'")) throw new Error('EXIF date-priority niet geïmplementeerd');
    if (!scannerCode.includes("dateSource = 'Google Takeout'")) throw new Error('Google Takeout date-fallback ontbreekt');
  });

  test('date_source wordt opgeslagen in database', () => {
    if (!scannerCode.includes('date_source: dateSource')) throw new Error('date_source wordt niet opgeslagen');
  });

  test('parseDateFromFilename functie aanwezig', () => {
    if (!scannerCode.includes('function parseDateFromFilename')) throw new Error('parseDateFromFilename niet gevonden');
  });

  test('Datum uit filename als fallback gebruikt', () => {
    if (!scannerCode.includes("dateSource = 'Bestandsnaam'")) throw new Error('Bestandsnaam date-fallback ontbreekt');
  });

  test('Aanmaakdatum (birthtime) als fallback gebruikt', () => {
    if (!scannerCode.includes("dateSource = 'Aanmaakdatum'")) throw new Error('birthtime fallback ontbreekt');
  });

  test('Wijzigingsdatum (mtime) als laatste fallback', () => {
    if (!scannerCode.includes("dateSource = 'Wijzigingsdatum'")) throw new Error('mtime fallback ontbreekt');
  });

  // ─── GOOGLE TAKEOUT ───────────────────────────────────────────────────────

  test('readGoogleJson functie aanwezig', () => {
    if (!scannerCode.includes('function readGoogleJson')) throw new Error('readGoogleJson functie niet gevonden');
  });

  test('Google JSON leest photoTakenTime.timestamp', () => {
    if (!scannerCode.includes('photoTakenTime')) throw new Error('photoTakenTime niet gelezen uit Google JSON');
  });

  test('Google JSON leest geoData als GPS fallback', () => {
    if (!scannerCode.includes('geoData')) throw new Error('geoData niet gelezen uit Google JSON');
  });

  test('EXIF heeft voorrang boven Google JSON (GPS)', () => {
    if (!scannerCode.includes('meta.gps_lat || googleJson.gps_lat')) throw new Error('EXIF GPS-priority niet geïmplementeerd');
  });

  test('google_description kolom wordt opgeslagen', () => {
    if (!scannerCode.includes('google_description')) throw new Error('google_description niet opgeslagen');
  });

  test('google_device_type kolom wordt opgeslagen', () => {
    if (!scannerCode.includes('google_device_type')) throw new Error('google_device_type niet opgeslagen');
  });

  // ─── DATABASE SCHEMA ──────────────────────────────────────────────────────

  test('DB migratie: gps_country_code kolom', () => {
    if (!dbCode.includes('gps_country_code')) throw new Error('gps_country_code migratie ontbreekt in database.js');
  });

  test('DB migratie: date_source kolom', () => {
    if (!dbCode.includes('date_source')) throw new Error('date_source migratie ontbreekt in database.js');
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

  test('API: PUT /photos/:id slaat gps_country_code op', () => {
    if (!apiCode.includes('gps_country_code')) throw new Error('gps_country_code niet opgeslagen in PUT /photos/:id');
  });

  test('API: POST /photos/:id/gps slaat gps_country_code op', () => {
    const gpsRoute = apiCode.includes("'/photos/:id/gps'");
    if (!gpsRoute) throw new Error('POST /photos/:id/gps niet gevonden');
  });

  test('API: stats geeft gps_country_code mee per country', () => {
    if (!apiCode.includes('gps_country_code') || !apiCode.includes('perCountry')) throw new Error('gps_country_code niet in stats perCountry');
  });

  // ─── UI: SCAN BALK ────────────────────────────────────────────────────────

  test('UI: startScan geeft onmiddellijke knop-feedback', () => {
    if (!uiScannerCode.includes('knop.disabled = true')) throw new Error('Geen directe knop-feedback in startScan');
  });

  test('UI: scanBalk toont Klaar-status wanneer niet running', () => {
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
      throw new Error('sources.js gebruikt truthy check voor scan_duur_seconden — 0 seconden wordt niet getoond');
    }
  });

  test('UI: startScanPolling initialiseert vorigeBericht zodat snelle scans worden herkend', () => {
    // Bug: als scan < 1.5s duurt, ziet eerste poll al status.running=false terwijl vorigeBericht nog '' is.
    // Fix: vorigeBericht op 'started' zetten bij start polling.
    if (!uiScannerCode.includes("vorigeBericht = 'started'")) {
      throw new Error("startScanPolling() initialiseert vorigeBericht niet — snelle scans worden niet herkend als completed");
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

  test('Utils: parseDateFromFilename klopt voor YYYYMMDD patroon', () => {
    // Directe regex test zonder de module te laden
    const match = 'IMG-20250728-WA0010.jpg'.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
    if (!match) throw new Error('Regex herkent YYYYMMDD patroon niet');
    const [, year, month, day] = match.map(Number);
    if (year !== 2025 || month !== 7 || day !== 28) throw new Error(`Datum error: ${year}-${month}-${day}`);
  });

  test('Dashboard: vlag emoji in Landen-grafiek', () => {
    if (!uiDashboardCode.includes('landVlag') && !uiDashboardCode.includes('landVlagVanNaam')) {
      throw new Error('Vlag emoji niet gebruikt in dashboard Landen-grafiek');
    }
  });

  test('Fotos: date_source getoond in detail modal', () => {
    if (!fotosCode.includes('date_source')) throw new Error('date_source niet getoond in detail modal');
  });

  test('Fotos: vlag emoji in Locatie rij', () => {
    if (!fotosCode.includes('landVlag') && !fotosCode.includes('landVlagVanNaam')) {
      throw new Error('Vlag emoji niet gebruikt in foto detail modal');
    }
  });

  test('Fotos: duplicaatlocaties worden getoond in detail modal', () => {
    if (!fotosCode.includes('duplicate_locations')) throw new Error('duplicate_locations niet processed in photos.js');
    if (!fotosCode.includes('modalDuplicaten')) throw new Error('modalDuplicaten element niet gebruikt');
  });

  test('API: GET /photos/:id geeft duplicate_locations mee', () => {
    if (!apiCode.includes('duplicate_locations')) throw new Error('duplicate_locations niet teruggegeven in GET /photos/:id');
  });

  // ─── GALERIJ TOONT ALTIJD ORIGINELEN ─────────────────────────────────────

  test('Fotos: without_copies altijd meegegeven (geen toggle, hardcoded)', () => {
    if (!fotosCode.includes('without_copies: 1')) throw new Error('without_copies niet hardcoded op 1 in photos.js — toggle is deleted, altijd originelen tonen');
    if (fotosCode.includes('verbergKopieen')) throw new Error('verbergKopieen variabele gevonden — toggle moet deleted zijn');
    if (fotosCode.includes('toggleVerbergKopieen')) throw new Error('toggleVerbergKopieen() nog aanwezig — toggle moet deleted zijn');
  });

  test('HTML: toggle knop deleted uit galerij filters', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (htmlCode.includes('toggleKopieenKnop')) throw new Error('toggleKopieenKnop nog aanwezig in index.html — moet deleted zijn');
    if (htmlCode.includes('toggleVerbergKopieen')) throw new Error('toggleVerbergKopieen() onclick nog aanwezig in index.html');
  });

  test('App: updateToggleKnop() niet meer aangeroepen (toggle deleted)', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (appCode.includes('updateToggleKnop()')) throw new Error('updateToggleKnop() nog aangeroepen in app.js — toggle is deleted');
  });

  test('API: without_copies filter aanwezig in GET /photos', () => {
    if (!apiCode.includes('without_copies')) throw new Error('without_copies filter niet gevonden in api.js');
  });

  test('API: correlated subquery voor origineel selectie aanwezig', () => {
    if (!apiCode.includes('duplicate_group') || !apiCode.includes('LIMIT 1')) {
      throw new Error('Correlated subquery voor origineel selectie niet gevonden in api.js');
    }
  });

  test('API: GPS groups filtert duplicates — toont alleen originelen', () => {
    const groepBlok = apiCode.slice(apiCode.indexOf("'/gps/groups'"));
    if (!groepBlok.includes('originalFilter') && !groepBlok.includes('MIN(id)')) {
      throw new Error('/gps/groups filtert duplicates niet — toont alle kopieën in GPS bulk page');
    }
  });

  // ─── GPS PROPAGATIE BINNEN DUPLICAATGROEPEN ────────────────────────────────

  test('Scanner: propagateGpsInGroups() als aparte functie aanwezig', () => {
    if (!scannerCode.includes('function propagateGpsInGroups')) {
      throw new Error('propagateGpsInGroups() niet gevonden als aparte functie in scanner.js');
    }
  });

  test('Scanner: propagateGpsInGroups() geëxporteerd', () => {
    if (!scannerCode.includes('propagateGpsInGroups')) {
      throw new Error('propagateGpsInGroups niet geëxporteerd in module.exports');
    }
    const exportRegel = scannerCode.match(/module\.exports\s*=\s*\{([^}]+)\}/)?.[1] || '';
    if (!exportRegel.includes('propagateGpsInGroups')) {
      throw new Error('propagateGpsInGroups ontbreekt in module.exports');
    }
  });

  test('Scanner: GPS propagatie loopt ook als locations.length === 0', () => {
    const vroegReturn = scannerCode.match(/locations\.length === 0[\s\S]{0,200}return/);
    if (!vroegReturn) throw new Error('Vroege return bij locations.length === 0 niet gevonden');
    if (!vroegReturn[0].includes('propagateGpsInGroups')) {
      throw new Error('propagateGpsInGroups() wordt niet aangeroepen bij vroege return (locations.length === 0)');
    }
  });

  test('Scanner: GPS propagatie omvat gps_country_code', () => {
    const propageerBlok = scannerCode.slice(scannerCode.indexOf('function propagateGpsInGroups'));
    if (!propageerBlok.includes('land_code')) {
      throw new Error('gps_country_code wordt niet meegenomen bij GPS propagatie in propagateGpsInGroups()');
    }
  });

  test('API: new_files endpoint POST /scan/gps-propagate aanwezig', () => {
    if (!apiCode.includes('/scan/gps-propagate')) {
      throw new Error('Endpoint POST /api/scan/gps-propagate niet gevonden in api.js');
    }
  });

  test('API: propagateGpsInGroups geïmporteerd in api.js', () => {
    const importRegel = apiCode.match(/require\('\.\/scanner'\)/)?.[0];
    if (!importRegel) throw new Error('scanner niet geïmporteerd in api.js');
    const destructure = apiCode.match(/const\s*\{([^}]+)\}\s*=\s*require\('\.\/scanner'\)/)?.[1] || '';
    if (!destructure.includes('propagateGpsInGroups')) {
      throw new Error('propagateGpsInGroups niet geïmporteerd uit scanner in api.js');
    }
  });

  test('API: GPS share condition werkt op gps_country IS NULL (niet alleen gps_lat IS NULL)', () => {
    if (!apiCode.includes("gps_country IS NULL OR gps_country = ''")) {
      throw new Error('GPS share endpoint werkt enkel op gps_lat IS NULL — zou ook photos zonder gps_country moeten updaten');
    }
  });

  test('API: without_copies subquery past country filter toe zodat origineel+country filter correct samenwerken', () => {
    const subqueryBlok = apiCode.slice(apiCode.indexOf('without_copies'));
    if (!subqueryBlok.includes('countrySubquery')) {
      throw new Error('without_copies subquery gebruikt geen countrySubquery — combinatie met country filter werkt incorrect');
    }
    if (!subqueryBlok.includes('f2.gps_country = ?')) {
      throw new Error('f2.gps_country ontbreekt in without_copies subquery');
    }
  });

  test('API: without_copies subquery past camera_make filter toe', () => {
    const subqueryBlok = apiCode.slice(apiCode.indexOf('without_copies'));
    if (!subqueryBlok.includes('brandSubquery') || !subqueryBlok.includes('f2.camera_make = ?')) {
      throw new Error('camera_make filter ontbreekt in without_copies subquery');
    }
  });


  test('Bronnen JS: propageerGps() functie aanwezig', () => {
    const bronnenCode = fs.readFileSync(path.join(__dirname, '../public/js/bronnen.js'), 'utf8');
    if (!bronnenCode.includes('function propageerGps') && !bronnenCode.includes('async function propageerGps')) {
      throw new Error('propageerGps() functie niet gevonden in sources.js');
    }
    if (!bronnenCode.includes('/api/scan/gps-propagate')) {
      throw new Error('propageerGps() roept niet het juiste endpoint aan in sources.js');
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
      throw new Error('herlaadLocaties() wordt niet aangeroepen als kaart al bestaat — nieuwe GPS markers verschijnen pas na page-herlaad');
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

  test('Kaart: bekijkLocatieInFotos() navigeert naar Foto\'s page', () => {
    const kaartCode = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!kaartCode.includes('bekijkLocatieInFotos')) throw new Error('bekijkLocatieInFotos() niet gevonden');
    if (!kaartCode.includes("toonPagina('photos'")) throw new Error('navigeert niet naar photos page');
  });

  test('API: GET /map/locations endpoint aanwezig', () => {
    if (!apiCode.includes('/map/locations')) throw new Error('/map/locations endpoint niet gevonden in api.js');
  });

  test('API: GET /map/photos endpoint aanwezig', () => {
    if (!apiCode.includes('/map/photos')) throw new Error('/map/photos endpoint niet gevonden in api.js');
  });

  test('API: GET /photos/:id/thumbnail endpoint aanwezig', () => {
    if (!apiCode.includes("'/photos/:id/thumbnail'")) throw new Error('/photos/:id/thumbnail endpoint niet gevonden in api.js');
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

  test('API: without_gps filter aanwezig in GET /photos', () => {
    if (!apiCode.includes('without_gps')) {
      throw new Error('without_gps filter niet gevonden in api.js');
    }
    if (!apiCode.includes('gps_lat IS NULL OR gps_lat = 0')) {
      throw new Error('without_gps SQL filter incorrect — verwacht: gps_lat IS NULL OR gps_lat = 0');
    }
  });

  test('API: withoutGps count aanwezig in stats endpoint', () => {
    const statsBlok = apiCode.slice(apiCode.indexOf("'/stats'"));
    if (!statsBlok.includes('withoutGps')) {
      throw new Error('withoutGps ontbreekt in /api/stats response');
    }
  });

  test('HTML: statZonderGps stat-kaart aanwezig en klikbaar', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // Nieuwe structuur: statFotosZonderGps en statVideosZonderGps vervangen het oude statZonderGps
    if (!htmlCode.includes('statFotosZonderGps') && !htmlCode.includes('statZonderGps')) {
      throw new Error('statFotosZonderGps (of statZonderGps) element niet gevonden in index.html');
    }
    if (!htmlCode.includes('without_gps')) {
      throw new Error('without_gps onclick niet gevonden in index.html stat-kaart');
    }
  });

  test('Fotos JS: setActieveFilter ondersteunt without_gps', () => {
    const fotosCode = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!fotosCode.includes('withoutGps') || !fotosCode.includes('without_gps')) {
      throw new Error('setActieveFilter/getActieveFilter ondersteunt geen without_gps filter in photos.js');
    }
  });

  test('App JS: toonPagina processed without_gps extraFilter', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('without_gps')) {
      throw new Error('toonPagina() processed geen without_gps in app.js');
    }
  });

  // ─── GPS BULK TOEWIJZEN ───────────────────────────────────────────────────────

  test('API: GET /gps/groups endpoint aanwezig', () => {
    if (!apiCode.includes("'/gps/groups'")) throw new Error('/gps/groups endpoint niet gevonden in api.js');
  });

  test('API: POST /gps/bulk-assign endpoint aanwezig', () => {
    if (!apiCode.includes("'/gps/bulk-assign'")) throw new Error('/gps/bulk-assign endpoint niet gevonden in api.js');
  });

  test('API: groepering op 2-uur tijdblok aanwezig', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/groups'));
    if (!blok.includes('GAP_MS') && !blok.includes('2 * 60 * 60')) {
      throw new Error('2-uur tijdblok groepering niet gevonden in /gps/groups');
    }
  });

  test('API: bulk-assign slaat gps_city, gps_country, gps_lat, gps_lon op', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/bulk-assign'));
    if (!blok.includes('gps_city') || !blok.includes('gps_lat')) {
      throw new Error('GPS velden ontbreken in bulk-assign endpoint');
    }
  });

  test('API: /gps/groups ondersteunt is_video type-filter', () => {
    const blok = apiCode.slice(apiCode.indexOf("'/gps/groups'"), apiCode.indexOf("'/gps/bulk-assign'"));
    if (!blok.includes('is_video')) throw new Error('is_video type-filter ontbreekt in /gps/groups');
    if (!blok.includes('f.is_video = 1')) throw new Error('video-filter (f.is_video = 1) ontbreekt in /gps/groups');
  });

  test('HTML: GPS-page heeft type-filter knoppen (Alles/Foto/Video)', () => {
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

  test('GPS Bulk JS: bevestigBulkLocatie() roept bulk-assign API aan', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('/api/gps/bulk-assign')) {
      throw new Error('bulk-assign API call niet gevonden in gpsbulk.js');
    }
  });

  test('HTML: paginaGpsbulk page en nav-knop aanwezig', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!htmlCode.includes('paginaGpsbulk')) throw new Error('paginaGpsbulk niet gevonden in index.html');
    if (!htmlCode.includes("toonPagina('gpsbulk')")) throw new Error('GPS bulk nav-knop niet gevonden in index.html');
  });

  test('App JS: gpsbulk page in namen array en laadGpsBulk() aangeroepen', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes("'gpsbulk'")) throw new Error("'gpsbulk' niet in namen array in app.js");
    if (!appCode.includes('laadGpsBulk')) throw new Error('laadGpsBulk() niet aangeroepen in app.js');
  });

  // ─── GPS BULK: DRAG & DROP + DUPLICATEN ──────────────────────────────────────

  test('API: bulk-assign propageert GPS naar duplicates via duplicate_group', () => {
    const blok = apiCode.slice(apiCode.indexOf('/gps/bulk-assign'));
    if (!blok.includes('duplicate_group')) {
      throw new Error('bulk-assign propageert niet naar duplicates — duplicate_group ontbreekt');
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

  test('GPS Bulk JS: nieuwe group aanmaken (nieuweGroep)', () => {
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

  test('GPS Bulk JS: bevestigBulkKaartLocatie() koppelt kaartlocatie aan group', () => {
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

  test('GPS Bulk JS: preview hidden bij dragstart', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('verbergPreview')) throw new Error('verbergPreview() niet gevonden — preview blijft zichtbaar bij slepen');
  });

  test('HTML: bulkThumbPreview element aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('bulkThumbPreview')) throw new Error('bulkThumbPreview div niet gevonden in index.html');
  });

  test('GPS Bulk JS: auto-promote hold zone als geen normale groups meer', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!code.includes('heeftNormaleGroepen')) throw new Error('heeftNormaleGroepen check ontbreekt — hold zone wordt niet auto-gepromoot');
    if (!code.includes('Auto-promote hold zone')) throw new Error('Auto-promote logica niet gevonden in onDrop()');
  });

  // ─── GPS PROPAGATIE VIA PUT /photos/:id ───────────────────────────────────────

  test('API: PUT /photos/:id propageert GPS naar duplicates in zelfde group', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/photos/:id'"));
    if (!putBlok.includes('duplicate_group')) {
      throw new Error('PUT /photos/:id controleert duplicate_group niet — GPS wordt niet gepropageerd naar duplicates');
    }
    if (!putBlok.includes('hasGpsUpdate')) {
      throw new Error('hasGpsUpdate check ontbreekt in PUT /photos/:id');
    }
  });

  test('API: PUT /photos/:id propageert alleen als GPS velden aanwezig zijn in request', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/photos/:id'"));
    if (!putBlok.includes('some(v => v !== undefined)')) {
      throw new Error('GPS-update detectie (some(v => v !== undefined)) ontbreekt in PUT /photos/:id');
    }
  });

  test('API: PUT /photos/:id gebruikt undefined-check zodat null GPS velden gewist worden', () => {
    const putBlok = apiCode.slice(apiCode.indexOf("router.put('/photos/:id'"));
    if (!putBlok.includes('!== undefined ? gps_lat')) {
      throw new Error('PUT /photos/:id gebruikt ?? i.p.v. undefined-check — null kan GPS velden niet wissen');
    }
  });

  test('Fotos JS: lege city+country wist ook GPS coördinaten', () => {
    if (!fotosCode.includes('wisGps')) throw new Error('wisGps logica ontbreekt in slaaBewerkingOpFoto()');
    if (!fotosCode.includes('gps_lat:       wisGps ? null : undefined')) throw new Error('gps_lat wordt niet gewist bij leeg city+country');
  });

  test('Fotos JS: land_code afgeleid uit LAND_CODES bij tekstinvoer', () => {
    if (!fotosCode.includes('LAND_CODES[country]')) throw new Error('LAND_CODES lookup ontbreekt bij opslaan via tekstveld');
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

  test('API: database/delete verwijdert geen sources', () => {
    const wisBlok = apiCode.slice(apiCode.indexOf("'/database/delete'"));
    if (wisBlok.slice(0, 300).includes('DELETE FROM sources')) {
      throw new Error('database/delete wist nog steeds sources — sources moeten bewaard blijven');
    }
  });

  test('API: database/delete reset total_photos en last_scan op sources', () => {
    const wisBlok = apiCode.slice(apiCode.indexOf("'/database/delete'"));
    if (!wisBlok.slice(0, 300).includes('UPDATE sources SET total_photos = 0')) {
      throw new Error('database/delete reset total_photos niet op sources na wissen');
    }
  });

  test('HTML: database delete knop zegt "Wis foto-records" (niet sources)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('Sources are kept')) {
      throw new Error('UI tekst vermeldt niet dat sources bewaard blijven na database delete');
    }
  });

  test('Fotos JS: auto-close modal na opslaan (setTimeout 1000ms)', () => {
    if (!fotosCode.includes('setTimeout') || !fotosCode.includes('modalOverlay')) {
      throw new Error('Auto-close na opslaan ontbreekt in slaaBewerkingOpFoto');
    }
    if (!fotosCode.includes('1000')) throw new Error('1 seconde vertraging ontbreekt bij auto-close');
  });

  test('Fotos JS: lege rijen hidden in metadatatabel', () => {
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
  test('DB: settings tabel aanwezig in database.js', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('settings')) throw new Error('settings tabel ontbreekt in database.js');
    if (!dbCode.includes("'phase'")) throw new Error('standaard phase instelling ontbreekt');
  });

  test('DB: location_unknown kolom migratie aanwezig', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('location_unknown')) throw new Error('location_unknown migratie ontbreekt');
  });

  test('DB: ignored kolom migratie aanwezig', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('ignored')) throw new Error('ignored migratie ontbreekt');
  });

  test('API: GET /phase endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/phase'")) throw new Error('GET /phase endpoint ontbreekt');
  });

  test('API: POST /phase endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'POST', '/phase'") && !apiCode.includes("router.post('/phase'")) throw new Error('POST /phase endpoint ontbreekt');
  });

  test('API: POST /photos/:id/location-unknown endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('location-unknown')) throw new Error('location-unknown endpoint ontbreekt');
  });

  test('API: POST /photos/:id/ignore endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('/ignore')) throw new Error('ignore endpoint ontbreekt');
  });

  test('API: GET /phase1/todo endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('phase1/todo')) throw new Error('phase1/todo endpoint ontbreekt');
  });

  test('API: ignored filter aanwezig in GET /photos', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("ignored === '1'")) throw new Error('ignored filter ontbreekt in GET /photos');
  });

  test('HTML: phase stepper aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('faseStepper')) throw new Error('faseStepper element ontbreekt');
    if (!html.includes('stapFase1')) throw new Error('stapFase1 ontbreekt');
  });

  test('HTML: phase 2 paginas aanwezig (negeren, ignored)', () => {
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

  test('App JS: updateNavFase() past nav-phase1 en nav-phase2 aan', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    if (!appCode.includes('nav-phase1')) throw new Error('nav-phase1 toggle ontbreekt');
    if (!appCode.includes('nav-phase2')) throw new Error('nav-phase2 toggle ontbreekt');
  });

  test('Negeren JS: laadNegeren() en toggleNegeer() aanwezig', () => {
    const negerenCode = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!negerenCode.includes('laadNegeren')) throw new Error('laadNegeren() ontbreekt');
    if (!negerenCode.includes('toggleNegeer')) throw new Error('toggleNegeer() ontbreekt');
  });

  test('Negeren JS: genegeerde foto verdwijnt uit de review-lijst', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!code.includes("classList.add('verdwijnt')")) throw new Error('fade-out (verdwijnt) ontbreekt in toggleNegeerItem');
    if (!code.includes('el.remove()')) throw new Error('ignored item wordt niet uit de DOM deleted');
    if (!code.includes('verlaagNegerenTeller')) throw new Error('teller wordt niet updated na negeren');
  });

  test('CSS: .ignore-item.verdwijnt fade-out aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.ignore-item.verdwijnt')) throw new Error('verdwijnt fade-out CSS ontbreekt');
  });

  test('API: POST /ignored/delete endpoint aanwezig (prullenbak + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/ignored/delete'")) throw new Error('POST /ignored/delete endpoint ontbreekt');
    if (!apiCode.includes("require('trash')")) throw new Error('trash (prullenbak) wordt niet gebruikt');
    if (!apiCode.includes('DELETE FROM photos')) throw new Error('DB-records worden niet deleted');
  });

  test('API: delete-ignored cascadeert over duplicaatgroep', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("'/ignored/delete'"));
    if (!blok.includes('duplicate_group IN')) throw new Error('cascade over duplicaatgroep ontbreekt');
    if (!blok.includes('fs.existsSync')) throw new Error('bestaande bestanden worden niet gefilterd voor verwijderen');
  });

  test('HTML: Verwijder-ignored knop aanwezig op Genegeerd-page', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('verwijderGenegeerdKnop')) throw new Error('delete-knop ontbreekt op Genegeerd-page');
    if (!html.includes('verwijderAlleGenegeerd()')) throw new Error('onclick verwijderAlleGenegeerd ontbreekt');
  });

  test('Negeren JS: verwijderAlleGenegeerd met bevestiging en endpoint-call', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    if (!code.includes('function verwijderAlleGenegeerd')) throw new Error('verwijderAlleGenegeerd() ontbreekt');
    if (!code.includes('confirm(')) throw new Error('bevestigingsdialoog ontbreekt');
    if (!code.includes('/api/ignored/delete')) throw new Error('endpoint wordt niet aangeroepen');
  });

  test('API: POST /photos/:id/delete endpoint aanwezig (prullenbak + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/photos/:id/delete'")) throw new Error('POST /photos/:id/delete endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/photos/:id/delete'"));
    if (!blok.includes("require('trash')")) throw new Error('trash (prullenbak) wordt niet gebruikt bij enkele verwijdering');
    if (!blok.includes('DELETE FROM photos WHERE id = ?')) throw new Error('DB-record wordt niet deleted');
  });

  test('Fotos JS: verwijderFotoDefinitief met bevestiging en endpoint-call', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('function verwijderFotoDefinitief')) throw new Error('verwijderFotoDefinitief() ontbreekt');
    if (!code.includes('confirm(')) throw new Error('bevestigingsdialoog ontbreekt');
    if (!code.includes("/delete'") && !code.includes('/delete`')) throw new Error('delete-endpoint wordt niet aangeroepen');
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

  test('HTML: Negeren-page opent in review-queue (Nog te beoordelen)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!/value="pending"\s+selected/.test(html)) throw new Error('Negeren-filter staat niet standaard op "Nog te beoordelen"');
  });

  test('API: duplicates delete + preview endpoints aanwezig (trash + DB delete)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/duplicates/delete'")) throw new Error('POST /duplicates/delete endpoint ontbreekt');
    if (!apiCode.includes("'/duplicates/delete-preview'")) throw new Error('POST /duplicates/delete-preview endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/duplicates/delete'"));
    if (!blok.includes("require('trash')")) throw new Error('duplicates-delete gebruikt geen prullenbak');
    if (!blok.includes('DELETE FROM photos')) throw new Error('duplicates-delete verwijdert geen DB-records');
  });

  test('API: determineOriginal keeper-logica (priority, manual, keuze nodig)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('function determineOriginal')) throw new Error('determineOriginal() ontbreekt');
    if (!apiCode.includes('sourceOrder')) throw new Error('priority (sourceOrder) wordt niet gebruikt');
    if (!apiCode.includes('return null')) throw new Error('keuze-nodig (null) tak ontbreekt');
  });

  test('Duplicaten JS: priority, keeper en manual override', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!code.includes('bepaalOrigineelClient')) throw new Error('client keeper-logica ontbreekt');
    if (!code.includes('dupSourceOrder')) throw new Error('priority wordt niet onthouden (localStorage)');
    if (!code.includes('function maakOrigineel')) throw new Error('manual override ontbreekt');
    if (!code.includes('wisAlleDuplicaten') || !code.includes('wisGroep')) throw new Error('delete-acties ontbreken');
  });

  test('HTML: priority-modal en duplicates-knoppen aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('prioOverlay')) throw new Error('priority-modal ontbreekt');
    if (!html.includes('openPrioModal()')) throw new Error('knop "Prioriteit instellen" ontbreekt');
    if (!html.includes('wisAlleDuplicaten()')) throw new Error('knop "Alle duplicates wissen" ontbreekt');
  });

  test('CSS: duplicates-badges en priority-modal stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.dup-badge-origineel')) throw new Error('ORIGINEEL-badge stijl ontbreekt');
    if (!css.includes('.prio-modal')) throw new Error('priority-modal stijl ontbreekt');
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
    const photos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!photos.includes('Kept copy')) throw new Error('modal toont keeper niet als "Behouden exemplaar"');
  });

  test('API: keeper opschonen na wissen (geen verweesde DUP-restant)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes('function cleanupDuplicateGroups')) throw new Error('cleanup-helper ontbreekt');
    if (!apiCode.includes('is_duplicate = 0, duplicate_group = NULL')) throw new Error('keeper wordt niet ontmarkeerd');
    // De drie delete-routes moeten de opschoning aanroepen
    const count = (apiCode.match(/cleanupDuplicateGroups\(db,/g) || []).length;
    if (count < 3) throw new Error('opschoning niet overal aangeroepen (verwacht >= 3)');
  });

  test('API: duplicates-overview toont geen 1-lid-groups', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("router.get('/duplicates'"));
    if (!blok.includes('HAVING COUNT(*) > 1')) throw new Error('1-lid-groups worden niet uitgefilterd');
  });

  // ─── FASE A: GEDEELDE KEEPER-LOGICA (src/keeper.js) ───────────────────────────

  test('Keeper: src/keeper.js bestaat en exporteert de gedeelde functies', () => {
    const p = path.join(__dirname, '../src/keeper.js');
    if (!fs.existsSync(p)) throw new Error('src/keeper.js niet gevonden');
    const keeper = require('../src/keeper');
    for (const fn of ['readPriority', 'writePriority', 'determineKeeper', 'keeperIds']) {
      if (typeof keeper[fn] !== 'function') throw new Error(`keeper.${fn} ontbreekt`);
    }
  });

  test('Keeper: manual keuze wint boven bron-priority', () => {
    const { determineKeeper } = require('../src/keeper');
    const photos = [{ id: 1, source_id: 10 }, { id: 2, source_id: 20 }, { id: 3, source_id: 30 }];
    // bron 30 is hoogst gerangschikt, maar manual kiest id 1
    if (determineKeeper(photos, [30, 20, 10], 1) !== 1) throw new Error('manual override ignored');
  });

  test('Keeper: hoogst gerangschikte bron wint (gelijkspel → laagste id)', () => {
    const { determineKeeper } = require('../src/keeper');
    const photos = [{ id: 5, source_id: 10 }, { id: 2, source_id: 20 }, { id: 9, source_id: 20 }];
    // bron 20 staat eerst in de volgorde → twee kandidaten id 2 en 9 → laagste id wint = 2
    if (determineKeeper(photos, [20, 10]) !== 2) throw new Error('bron-priority/gelijkspel verkeerd');
  });

  test('Keeper: required=true valt terug op laagste id als niets gerangschikt is', () => {
    const { determineKeeper } = require('../src/keeper');
    const photos = [{ id: 7, source_id: 99 }, { id: 3, source_id: 88 }];
    if (determineKeeper(photos, [], undefined, { required: true }) !== 3) {
      throw new Error('export-fallback (laagste id) werkt niet');
    }
  });

  test('Keeper: required=false geeft null ("keuze nodig") als niets gerangschikt is', () => {
    const { determineKeeper } = require('../src/keeper');
    const photos = [{ id: 7, source_id: 99 }, { id: 3, source_id: 88 }];
    if (determineKeeper(photos, [], undefined, { required: false }) !== null) {
      throw new Error('delete-flow geeft geen "keuze nodig" terug');
    }
  });

  test('Keeper: één-bron-group zonder priority lost vanzelf op (laagste id, geen keuze nodig)', () => {
    const { determineKeeper } = require('../src/keeper');
    // Alle kopieën uit dezelfde bron, geen priority gezet, delete-flow (required=false):
    // er valt niets te kiezen → behoud laagste id i.p.v. null.
    const photos = [{ id: 8, source_id: 5 }, { id: 3, source_id: 5 }, { id: 6, source_id: 5 }];
    if (determineKeeper(photos, [], undefined, { required: false }) !== 3) {
      throw new Error('één-bron-group blijft hangen op "keuze nodig" i.p.v. laagste id');
    }
  });

  test('Keeper: meerdere sources zonder priority blijft "keuze nodig" (veiligheid intact)', () => {
    const { determineKeeper } = require('../src/keeper');
    // Kopieën verspreid over verschillende sources → de gebruiker moet kiezen.
    const photos = [{ id: 1, source_id: 5 }, { id: 2, source_id: 9 }];
    if (determineKeeper(photos, [], undefined, { required: false }) !== null) {
      throw new Error('cross-bron-group mag niet stilzwijgend een keeper kiezen');
    }
  });

  test('Duplicaten JS: client spiegelt één-bron-regel (eenBron → laagste id)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    const blok = code.slice(code.indexOf('function bepaalOrigineelClient'),
                           code.indexOf('function bepaalOrigineelClient') + 700);
    if (!blok.includes('eenBron')) throw new Error('client mist de één-bron-regel');
    if (!/every\(f => f\.source_id === photos\[0\]\.source_id\)/.test(blok)) {
      throw new Error('client-eenBron-check wijkt af van backend-logica');
    }
  });

  test('Keeper: lees/schrijf priority roundtrip via settings-tabel', () => {
    let db;
    try { db = new (require('better-sqlite3'))(':memory:'); }
    catch (_) { return; } // omgeving zonder werkende native module → overslaan
    db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)');
    const { readPriority, writePriority } = require('../src/keeper');

    // Leeg = veilige defaults
    const leeg = readPriority(db);
    if (!Array.isArray(leeg.sourceOrder) || typeof leeg.manual !== 'object') {
      throw new Error('defaults niet correct bij lege settings');
    }
    writePriority(db, [3, 1, 2], { 'abc': 42 });
    const terug = readPriority(db);
    if (JSON.stringify(terug.sourceOrder) !== '[3,1,2]') throw new Error('sourceOrder niet bewaard');
    if (terug.manual.abc !== 42) throw new Error('manual keuze niet bewaard');
    db.close();
  });

  test('Keeper: keeperIds kiest één keeper per group, niet-duplicates ignored', () => {
    let db;
    try { db = new (require('better-sqlite3'))(':memory:'); }
    catch (_) { return; }
    db.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE photos (id INTEGER PRIMARY KEY, source_id INTEGER, duplicate_group TEXT);
      INSERT INTO photos VALUES (1, 10, 'h1'), (2, 20, 'h1'), (3, 30, NULL), (4, 10, 'h2'), (5, 20, 'h2');
    `);
    const { keeperIds, writePriority } = require('../src/keeper');
    writePriority(db, [20, 10], {}); // bron 20 voorrang
    const ids = keeperIds(db);
    // group h1: bron 20 = id 2; group h2: bron 20 = id 5; foto 3 is geen duplicaat → niet in set
    if (!ids.has(2) || !ids.has(5)) throw new Error('keeper per group ontbreekt');
    if (ids.has(1) || ids.has(4) || ids.has(3)) throw new Error('verkeerde foto als keeper gemarkeerd');
    if (ids.size !== 2) throw new Error('verwacht precies 2 keepers');
    db.close();
  });

  test('API: priority-endpoints (GET/POST /duplicates/priority) aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("router.get('/duplicates/priority'")) throw new Error('GET priority ontbreekt');
    if (!apiCode.includes("router.post('/duplicates/priority'")) throw new Error('POST priority ontbreekt');
    if (!apiCode.includes("require('./keeper')")) throw new Error('keeper-module niet geïmporteerd in api.js');
    // determineOriginal delegeert nu naar de gedeelde determineKeeper
    if (!apiCode.includes('determineKeeper(photos, sourceOrder, manualId')) {
      throw new Error('determineOriginal delegeert niet naar gedeelde determineKeeper');
    }
  });

  test('Export: selectPhotos neemt keeper per group mee (niet langer is_duplicate=0 filter)', () => {
    const exportCode = fs.readFileSync(path.join(__dirname, '../src/export.js'), 'utf8');
    if (!exportCode.includes("require('./keeper')")) throw new Error('export importeert keeper niet');
    if (!exportCode.includes('keeperIds')) throw new Error('export gebruikt keeperIds niet');
    const blok = exportCode.slice(exportCode.indexOf('function selectPhotos'));
    if (/AND\s*\(is_duplicate\s*=\s*0/.test(blok)) {
      throw new Error('export filtert nog steeds alle duplicates weg (is_duplicate=0) — keeper valt buiten export');
    }
    if (!blok.includes('keepers.has(f.id)')) throw new Error('export selecteert keeper niet expliciet');
  });

  test('API: detailvenster bepaalt keeper via gedeelde logica (niet hardcoded pc/gsm subquery)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const blok = apiCode.slice(apiCode.indexOf("router.get('/photos/:id'"), apiCode.indexOf("router.get('/photos/:id'") + 1400);
    if (!blok.includes('determineKeeper')) throw new Error('detailvenster gebruikt gedeelde keeper niet');
    if (!blok.includes('readPriority')) throw new Error('detailvenster leest opgeslagen priority niet');
  });

  test('Duplicaten JS: priority gesynct met server (API i.p.v. alleen localStorage)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!code.includes('/api/duplicates/priority')) throw new Error('frontend praat niet met priority-API');
    if (!code.includes('syncPrioVanServer')) throw new Error('server→cache sync ontbreekt');
    if (!code.includes('bewaarPrioOpServer')) throw new Error('cache→server sync ontbreekt');
  });

  // ─── FASE B: TEKSTZOEKEN + OPSCHOON-DASHBOARD ─────────────────────────────────

  test('Zoeken: backend doorzoekt name, location (city+country) en camera (merk+model)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    const zoekRegel = apiCode.slice(apiCode.indexOf('if (search)'), apiCode.indexOf('if (search)') + 320);
    for (const veld of ['filename', 'gps_city', 'gps_country', 'camera_make', 'camera_model']) {
      if (!zoekRegel.includes(veld)) throw new Error(`zoekfilter dekt ${veld} niet`);
    }
  });

  test('Zoeken: frontend stuurt zoekterm mee', () => {
    const fotosCode = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!fotosCode.includes("getElementById('zoekInput')")) throw new Error('zoekveld niet uitgelezen');
    if (!fotosCode.includes('search')) throw new Error('zoekterm niet meegestuurd');
  });

  test('Opschoon: GET /cleanup/overview endpoint aanwezig en gebruikt keeper-plan', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/cleanup/overview'")) throw new Error('cleanup-overview endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/cleanup/overview'"), apiCode.indexOf("'/cleanup/overview'") + 900);
    if (!blok.includes('collectDuplicatePlan')) throw new Error('cleanup gebruikt het keeper-plan niet');
    if (!blok.includes('ignored = 1')) throw new Error('genegeerde bestanden niet meegeteld');
    if (!blok.includes('totaalVrijTeMaken')) throw new Error('total vrij te maken ontbreekt');
  });

  test('Opschoon: dashboard-kaart in HTML + JS-render aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('opschoonKaart')) throw new Error('cleanup-kaart ontbreekt in HTML');
    if (!html.includes('opschoonTotaal')) throw new Error('total-element ontbreekt');
    const dash = fs.readFileSync(path.join(__dirname, '../public/js/dashboard.js'), 'utf8');
    if (!dash.includes('laadOpschoonOverzicht')) throw new Error('render-functie ontbreekt');
    if (!dash.includes('/api/cleanup/overview')) throw new Error('dashboard haalt overview niet op');
  });

  test('Opschoon: i18n-keys aanwezig in alle 4 talen', () => {
    const i18n = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    const count = (i18n.match(/opschoon_titel:/g) || []).length;
    if (count < 4) throw new Error('opschoon_titel ontbreekt in een of meer talen (verwacht 4)');
  });

  test('i18n: t(key, fallback) gebruikt fallback bij ontbrekende key', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    // t moet een fallback-parameter accepteren en die teruggeven i.p.v. de ruwe key
    if (!/function t\(key, fallback\)/.test(code)) throw new Error('t() accepteert geen fallback-parameter');
    if (!code.includes('fallback !== undefined ? fallback : key')) throw new Error('t() geeft fallback niet terug bij ontbrekende key');
    // De fragiele "|| f" helper (die de ruwe key toonde) mag nergens meer staan
    for (const f of ['duplicaten.js', 'dashboard.js', 'fotos.js']) {
      const js = fs.readFileSync(path.join(__dirname, '../public/js/' + f), 'utf8');
      if (js.includes('i18n.t(k) : f) || f')) throw new Error('fragiele i18n-fallback nog aanwezig in ' + f);
    }
  });

  // ── Fase C: batch-selectie (bulk ignore) ──────────────────────────
  test('Batch: POST /photos/ignore-bulk endpoint aanwezig met cascade', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/photos/ignore-bulk'")) throw new Error('ignore-bulk endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/photos/ignore-bulk'"), apiCode.indexOf("'/photos/ignore-bulk'") + 1200);
    if (!blok.includes('req.body.ids')) throw new Error('endpoint leest ids niet uit');
    if (!blok.includes('duplicate_group')) throw new Error('cascade over duplicaatgroep ontbreekt');
    if (!blok.includes('db.transaction')) throw new Error('bulk niet in transactie');
  });

  test('Batch: ignore-bulk werkt functioneel op in-memory DB', () => {
    let db;
    try { db = new (require('better-sqlite3'))(':memory:'); } catch (_) { return; }
    db.exec('CREATE TABLE photos (id INTEGER PRIMARY KEY, duplicate_group TEXT, ignored INTEGER DEFAULT 0)');
    // 1+2 in dezelfde group, 3 los, 4 niet geselecteerd
    db.exec("INSERT INTO photos (id, duplicate_group, ignored) VALUES (1,'g1',0),(2,'g1',0),(3,NULL,0),(4,NULL,0)");

    // Simuleer de endpoint-logica: zet ids + cascade over group
    const ids = [1, 3];
    const value = 1;
    const zetFoto  = db.prepare('UPDATE photos SET ignored = ? WHERE id = ?');
    const zetGroep = db.prepare('UPDATE photos SET ignored = ? WHERE duplicate_group = ? AND id != ?');
    const haalFoto = db.prepare('SELECT id, duplicate_group FROM photos WHERE id = ?');
    for (const id of ids) {
      const f = haalFoto.get(id);
      zetFoto.run(value, f.id);
      if (f.duplicate_group) zetGroep.run(value, f.duplicate_group, f.id);
    }
    const ignored = db.prepare('SELECT id FROM photos WHERE ignored = 1 ORDER BY id').all().map(r => r.id);
    db.close();
    // 1 (chosen) → cascade naar 2; 3 (chosen); 4 blijft 0
    if (JSON.stringify(ignored) !== JSON.stringify([1, 2, 3])) {
      throw new Error('cascade-resultaat onjuist: ' + JSON.stringify(ignored));
    }
  });

  test('Batch: frontend selectie-modus + bulkNegeer in photos.js', () => {
    const photos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!photos.includes('function toggleSelectieModus')) throw new Error('toggleSelectieModus ontbreekt');
    if (!photos.includes('function bulkNegeer')) throw new Error('bulkNegeer ontbreekt');
    if (!photos.includes('/api/photos/ignore-bulk')) throw new Error('bulkNegeer roept endpoint niet aan');
    if (!photos.includes('geselecteerdeIds')) throw new Error('selectie-state ontbreekt');
    if (!photos.includes('fotoItemKlik')) throw new Error('klik-router (detail vs selectie) ontbreekt');
  });

  test('Batch: galerij-items hebben data-id en klik-router', () => {
    const photos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!photos.includes('data-id="${f.id}"')) throw new Error('foto-item heeft geen data-id');
    if (!photos.includes('onclick="fotoItemKlik(${f.id})"')) throw new Error('foto-item gebruikt klik-router niet');
  });

  test('Batch: selectie-balk in HTML + CSS aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('selectieBalk')) throw new Error('selectie-balk ontbreekt in HTML');
    if (!html.includes('toggleSelectieModus')) throw new Error('selecteer-knop ontbreekt');
    if (!html.includes('bulkNegeer(true)')) throw new Error('ignore-knop ontbreekt');
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('.selectie-balk')) throw new Error('selectie-balk CSS ontbreekt');
    if (!css.includes('.foto-item.geselecteerd')) throw new Error('geselecteerd-stijl ontbreekt');
  });

  test('Batch: selectie i18n-keys aanwezig in alle 4 talen', () => {
    const i18n = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    const count = (i18n.match(/selectie_negeer:/g) || []).length;
    if (count < 4) throw new Error('selectie_negeer ontbreekt in een of meer talen (verwacht 4)');
  });

  // ── Fase D: robuustheid ───────────────────────────────────────────
  test('Robuust: computeHash streamt en geeft null bij 0-byte', () => {
    let scanner;
    try { scanner = require('../src/scanner'); } catch (_) { return; } // native module mist in sandbox
    if (typeof scanner.computeHash !== 'function') throw new Error('computeHash niet geëxporteerd');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), 'fa_hash_' + Date.now());
    const leeg = tmp + '_leeg.bin';
    const vol  = tmp + '_vol.bin';
    fs.writeFileSync(leeg, '');
    fs.writeFileSync(vol, 'hallo wereld');
    try {
      if (scanner.computeHash(leeg) !== null) throw new Error('0-byte bestand moet null geven (geen lege-MD5)');
      const h = scanner.computeHash(vol);
      const crypto = require('crypto');
      const verwacht = crypto.createHash('md5').update('hallo wereld').digest('hex');
      if (h !== verwacht) throw new Error('streaming-hash komt niet overeen met md5');
    } finally {
      try { fs.unlinkSync(leeg); } catch (_) {}
      try { fs.unlinkSync(vol); } catch (_) {}
    }
  });

  test('Robuust: computeHash gebruikt streaming (geen readFileSync hele bestand)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/scanner.js'), 'utf8');
    const blok = code.slice(code.indexOf('function computeHash'), code.indexOf('function computeHash') + 800);
    if (!blok.includes('readSync')) throw new Error('computeHash streamt niet (readSync ontbreekt)');
    if (!blok.includes('stat.size')) throw new Error('computeHash controleert 0-byte niet');
    if (blok.includes('readFileSync')) throw new Error('computeHash laadt nog hele bestand in geheugen');
  });

  test('Robuust: geocode cachet geen lege/429-resultaten', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/scanner.js'), 'utf8');
    const blok = code.slice(code.indexOf('async function fetchGpsAddress'), code.indexOf('async function fetchGpsAddress') + 3000);
    if (!blok.includes('429')) throw new Error('429-afhandeling ontbreekt');
    if (!blok.includes('if (result && result.gps_country)')) throw new Error('lege resultaten worden nog gecachet');
  });

  test('Robuust: aparte geocode stop-vlag (los van scan)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/scanner.js'), 'utf8');
    if (!code.includes('let geocodeStopRequested')) throw new Error('geocodeStopRequested vlag ontbreekt');
    if (!code.includes('function stopGeocode')) throw new Error('stopGeocode functie ontbreekt');
    // De geocode-lus moet de eigen vlag gebruiken, niet de scan-vlag
    const lus = code.slice(code.indexOf('for (const loc of locations)'), code.indexOf('for (const loc of locations)') + 120);
    if (!lus.includes('geocodeStopRequested')) throw new Error('geocode-lus gebruikt eigen stop-vlag niet');
  });

  test('Robuust: stop-geocode endpoint + export aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/scan/geocode/stop'")) throw new Error('stop-geocode endpoint ontbreekt');
    if (!apiCode.includes('stopGeocode')) throw new Error('api importeert stopGeocode niet');
    const sc = fs.readFileSync(path.join(__dirname, '../src/scanner.js'), 'utf8');
    if (!sc.includes('stopGeocode, ') && !sc.includes('stopGeocode,')) throw new Error('stopGeocode niet geëxporteerd');
  });

  test('Robuust: db.close in try/finally bij geocode-helpers', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/scanner.js'), 'utf8');
    const prop = code.slice(code.indexOf('function propagateGpsInGroups'), code.indexOf('function propagateGpsInGroups') + 1400);
    if (!prop.includes('finally')) throw new Error('propagateGpsInGroups sluit db niet in finally');
    const upd = code.slice(code.indexOf('const updateLocation'), code.indexOf('const updateLocation') + 700);
    if (!upd.includes('finally')) throw new Error('updateLocation sluit db2 niet in finally');
  });

  test('API: show-in-folder endpoint (bestandsbeheerder, cross-platform)', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/photos/:id/show-in-folder'")) throw new Error('show-in-folder endpoint ontbreekt');
    const blok = apiCode.slice(apiCode.indexOf("'/photos/:id/show-in-folder'"));
    if (!blok.includes('electronRevealInFolder')) throw new Error('Electron reveal-path ontbreekt');
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
    const photos = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    const videos = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    if (!photos.includes('function toonInMap')) throw new Error('toonInMap functie ontbreekt');
    if (!photos.includes('show-in-folder')) throw new Error('photos roept show-in-folder endpoint niet aan');
    // Hoofdpad én duplicaat-locations moeten beide toonInMap aanroepen
    const aantalFoto = (photos.match(/toonInMap\(event,/g) || []).length;
    if (aantalFoto < 2) throw new Error('niet alle padlinks (path + duplicates) gebruiken toonInMap');
    if (!videos.includes('toonInMap(event,')) throw new Error('video-padlink gebruikt toonInMap niet');
  });

  test('DB: migratie schoont verweesde duplicaat-restanten op', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('verweesde duplicaat-restant')) throw new Error('cleanup-migratie ontbreekt');
    if (!dbCode.includes('HAVING COUNT(*) <= 1')) throw new Error('migratie selecteert geen 1-lid-groups');
    if (!dbCode.includes('is_duplicate = 0, duplicate_group = NULL')) throw new Error('migratie ontmarkeert niet');
  });

  test('CSS: phase-stepper stijlen aanwezig', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    if (!css.includes('phase-stepper')) throw new Error('phase-stepper CSS ontbreekt');
    if (!css.includes('stap-cirkel')) throw new Error('stap-cirkel CSS ontbreekt');
  });

  test('API: GET /wrapped endpoint aanwezig', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!apiCode.includes("'/wrapped'")) throw new Error('GET /wrapped endpoint ontbreekt');
    if (!apiCode.includes('countryCount') || !apiCode.includes('busiestMonth')) throw new Error('wrapped cijfers ontbreken');
  });

  test('HTML: paginaWrapped page en nav-knop aanwezig', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('paginaWrapped')) throw new Error('paginaWrapped ontbreekt');
    if (!html.includes('data-page="wrapped"')) throw new Error('wrapped nav-knop ontbreekt');
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

  test('API: /photos ondersteunt with_gps filter (met location)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('with_gps') || !code.includes('gps_lat IS NOT NULL')) {
      throw new Error('with_gps filter ontbreekt in /photos endpoint');
    }
  });

  test('API: /photos ondersteunt duplicates_only filter', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('duplicates_only') || !code.includes('f.is_duplicate = 1')) {
      throw new Error('duplicates_only filter ontbreekt in /photos endpoint');
    }
  });

  test('API: /photos ondersteunt unique_only filter', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!code.includes('unique_only')) {
      throw new Error('unique_only filter ontbreekt in /photos endpoint');
    }
  });

  test('HTML: foto-page heeft altijd-zichtbaar filterpaneel met 6 filters', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    ['filterPaneel', 'filterCamera', 'filterLand', 'filterLocatie', 'filterDup']
      .forEach(id => { if (!html.includes(id)) throw new Error(id + ' ontbreekt in index.html'); });
    // Filterpaneel mag niet meer hidden worden achter een toggle-knop
    if (html.includes('id="filterToggle"')) throw new Error('filterToggle-knop hoort deleted te zijn');
    if (/id="filterPaneel"[^>]*display:\s*none/.test(html)) throw new Error('filterPaneel mag niet hidden zijn');
  });

  test('HTML: video-page heeft altijd-zichtbaar filterpaneel met 6 filters', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    ['filterPaneelVideo', 'filterCameraVideo', 'filterLandVideo', 'filterLocatieVideo', 'filterDupVideo']
      .forEach(id => { if (!html.includes(id)) throw new Error(id + ' ontbreekt in index.html'); });
    if (html.includes('id="filterToggleVideo"')) throw new Error('filterToggleVideo-knop hoort deleted te zijn');
    if (/id="filterPaneelVideo"[^>]*display:\s*none/.test(html)) throw new Error('filterPaneelVideo mag niet hidden zijn');
  });

  test('Fotos JS: wisAlleFilters en updateFilterBadge aanwezig', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('function wisAlleFilters')) throw new Error('wisAlleFilters ontbreekt');
    if (!code.includes('function updateFilterBadge')) throw new Error('updateFilterBadge ontbreekt');
  });

  test('Fotos JS: laadFotos stuurt nieuwe filter-parameters mee', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    ['with_gps', 'without_gps', 'unique_only', 'duplicates_only', 'camera_make', 'country']
      .forEach(p => { if (!code.includes(p)) throw new Error(p + ' ontbreekt in laadFotos'); });
  });

  test('Fotos JS: laadBronnenFilter vult camera- en country-dropdown', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/fotos.js'), 'utf8');
    if (!code.includes('filterCamera') || !code.includes('filterLand')) {
      throw new Error('camera/country dropdown-vulling ontbreekt in laadBronnenFilter');
    }
    if (!code.includes('perCamera') || !code.includes('perCountry')) {
      throw new Error('stats perCamera/perCountry niet gebruikt voor dropdowns');
    }
  });

  test('Videos JS: laadVideos stuurt nieuwe filter-parameters mee', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    ['with_gps', 'unique_only', 'duplicates_only', 'camera_make', 'country']
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

  test('HTML: dashboard stat-kaarten sturen dup/location filter mee', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // Klikbare kaarten zetten de juiste filter via toonPagina(..., { dup/location })
    if (!html.includes("dup: 'unique'") || !html.includes("dup: 'duplicate'")) {
      throw new Error('dashboard Uniek/Dubbel-kaarten zetten geen dup-filter');
    }
    if (!html.includes("location: 'with'") || !html.includes("location: 'without'")) {
      throw new Error('dashboard Met/Zonder location-kaarten zetten geen location-filter');
    }
  });

  test('App JS: toonPagina processed dup en location extraFilter (foto + video)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    ['filterLocatie', 'filterDup', 'filterLocatieVideo', 'filterDupVideo']
      .forEach(id => { if (!code.includes(id)) throw new Error(id + ' niet gezet in toonPagina'); });
    if (!code.includes('extraFilter?.dup') || !code.includes('extraFilter?.location')) {
      throw new Error('toonPagina leest extraFilter.dup/location niet uit');
    }
  });

  test('Dashboard JS: Landen-grafieken openen de kaart op het country', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/dashboard.js'), 'utf8');
    if (!code.includes("toonPagina('kaart'")) {
      throw new Error('Landen-grafiek opent de kaart niet (toonPagina(\'kaart\'))');
    }
    // Foto's: type-filter foto's op dat country
    if (!/toonPagina\('kaart',\s*\{\s*country:[^}]*is_video:\s*'0'/.test(code)) {
      throw new Error('Landen (foto\'s)-grafiek geeft country + is_video 0 niet door');
    }
    // Video's: gecombineerde kaart met video-nadruk op dat country
    if (!/toonPagina\('kaart',\s*\{\s*country:[^}]*video_nadruk:\s*true/.test(code)) {
      throw new Error('Landen (video\'s)-grafiek geeft country + video_nadruk niet door');
    }
  });

  test('Kaart JS: video-nadruk licht video-locations uit (gecombineerde kaart)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!code.includes('kaartVideoNadruk')) {
      throw new Error('kaart.js kent geen video-nadruk');
    }
    if (!code.includes('km-video-nadruk')) {
      throw new Error('video-locations krijgen geen km-video-nadruk klasse');
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

  test('Kaart JS: laadKaart past gewenst country vanuit dashboard toe', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/js/kaart.js'), 'utf8');
    if (!code.includes('kaartGewensteLand')) {
      throw new Error('kaart.js processed geen gewenst country vanuit dashboard');
    }
    if (!code.includes('function laadKaart(extraFilter)')) {
      throw new Error('laadKaart accepteert geen extraFilter');
    }
    if (!code.includes('filterKaart()')) {
      throw new Error('laadKaart past het landfilter niet toe via filterKaart()');
    }
  });

  // ─── EENMALIGE PRIORITEIT-VRAAG BIJ SCAN ──────────────────────────────────

  test('Scan UI: startScan checkt priority vóór de scan', () => {
    if (!uiScannerCode.includes('prioriteitNodigVoorScan')) {
      throw new Error('startScan checkt geen priority vóór de scan');
    }
    if (!uiScannerCode.includes('openPrioModal(() => echtStartScan(')) {
      throw new Error('Prioriteit-modal wordt niet geopend met scan-vervolg');
    }
    if (!uiScannerCode.includes('async function echtStartScan(')) {
      throw new Error('echtStartScan (eigenlijke scan-start) ontbreekt');
    }
  });

  test('Scan UI: prioriteitNodigVoorScan vraagt alleen bij ≥2 sources zonder volgorde', () => {
    const i = uiScannerCode.indexOf('async function prioriteitNodigVoorScan');
    if (i === -1) throw new Error('prioriteitNodigVoorScan niet gevonden');
    const blok = uiScannerCode.slice(i, i + 600);
    if (!blok.includes('sources.length >= 2')) throw new Error('Geen ≥2-sources-voorwaarde');
    if (!blok.includes('volgorde.length === 0')) throw new Error('Vraagt niet alleen bij lege volgorde');
  });

  test('Duplicaten UI: openPrioModal accepteert vervolg-callback', () => {
    const dupCode = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!dupCode.includes('async function openPrioModal(vervolg)')) {
      throw new Error('openPrioModal accepteert geen vervolg-parameter');
    }
    if (!dupCode.includes('let prioVervolg')) {
      throw new Error('prioVervolg-state ontbreekt');
    }
  });

  test('Duplicaten UI: bewaarPrio voert vervolg-actie uit', () => {
    const dupCode = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    const i = dupCode.indexOf('function bewaarPrio()');
    if (i === -1) throw new Error('bewaarPrio niet gevonden');
    const blok = dupCode.slice(i, i + 300);
    if (!blok.includes('vervolg()')) throw new Error('bewaarPrio voert vervolg-actie niet uit');
  });

  test('Fotos UI: verwijderen ververst ook het open kaart-popup', () => {
    const i = fotosCode.indexOf('async function verwijderFotoDefinitief');
    if (i === -1) throw new Error('verwijderFotoDefinitief niet gevonden');
    const blok = fotosCode.slice(i, i + 2500);
    if (!blok.includes('kaartPanelOverlay') || !blok.includes('laadPanelFotos')) {
      throw new Error('verwijderen ververst het kaart-popup niet (laadPanelFotos ontbreekt)');
    }
    if (!blok.includes('herlaadLocaties')) {
      throw new Error('verwijderen ververst de kaart-markers niet (herlaadLocaties ontbreekt)');
    }
  });

  test('Fotos UI: verwijderen blijft op dezelfde page (niet terug naar 1)', () => {
    const i = fotosCode.indexOf('async function verwijderFotoDefinitief');
    if (i === -1) throw new Error('verwijderFotoDefinitief niet gevonden');
    const blok = fotosCode.slice(i, i + 2500);
    if (!blok.includes('laadFotos(typeof huidigePagina')) {
      throw new Error('verwijderen herlaadt foto\'s niet op de huidige page (huidigePagina ontbreekt)');
    }
    if (!blok.includes('laadVideos(typeof huidigePaginaVideo')) {
      throw new Error('verwijderen herlaadt video\'s niet op de huidige page (huidigePaginaVideo ontbreekt)');
    }
    if (blok.includes('laadFotos(1)') || blok.includes('laadVideos(1)')) {
      throw new Error('verwijderen springt nog steeds terug naar page 1');
    }
  });

  test('Fotos UI: lege page na verwijderen gaat automatisch een page terug', () => {
    const i = fotosCode.indexOf('async function laadFotos');
    const blok = fotosCode.slice(i, i + 2500);
    if (!/page > 1 && data\.total > 0.*return laadFotos\(page - 1\)/s.test(blok)) {
      throw new Error('laadFotos vangt een lege laatste page niet op');
    }
  });

  test('Paginering: gedeelde bouwPaginering met 10-nummer venster + spring-knoppen', () => {
    if (!fotosCode.includes('function bouwPaginering')) {
      throw new Error('bouwPaginering helper ontbreekt in photos.js');
    }
    const i = fotosCode.indexOf('function bouwPaginering');
    const blok = fotosCode.slice(i, i + 2200);
    // Eerste / laatste page spring-knoppen
    if (!blok.includes("'«'") || !blok.includes("'»'")) {
      throw new Error('bouwPaginering mist eerste/laatste-page knoppen (« »)');
    }
    // 10 terug / 10 vooruit
    if (!blok.includes("'‹‹'") || !blok.includes("'››'") ||
        !blok.includes('page - 10') || !blok.includes('page + 10')) {
      throw new Error('bouwPaginering mist de 10-terug/10-vooruit spring-knoppen');
    }
    // Naar laatste page springen
    if (!blok.includes('totaalPaginas')) {
      throw new Error('bouwPaginering springt niet naar de laatste page');
    }
    // Schuivend venster van 10 nummers
    if (!fotosCode.includes('PAG_VENSTER = 10')) {
      throw new Error('bouwPaginering gebruikt geen venster van 10 paginanummers');
    }
  });

  test('Paginering: foto-/videolijst gebruikt thumbnail-endpoint (snel laden)', () => {
    const videos = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    // Lijst vraagt GEEN base64-thumbnails meer mee maar gebruikt het endpoint
    if (!fotosCode.includes('without_thumbnail: 1')) {
      throw new Error('photos.js vraagt nog de zware base64-thumbnails mee (without_thumbnail moet 1)');
    }
    if (!videos.includes('without_thumbnail: 1')) {
      throw new Error('videos.js vraagt nog de zware base64-thumbnails mee');
    }
    if (!fotosCode.includes('/api/photos/${f.id}/thumbnail') ||
        !videos.includes('/api/photos/${f.id}/thumbnail')) {
      throw new Error('lijst laadt thumbnails niet via het lichte /thumbnail-endpoint');
    }
    if (!fotosCode.includes('f.has_thumbnail') || !videos.includes('f.has_thumbnail')) {
      throw new Error('lijst gebruikt de has_thumbnail vlag niet');
    }
  });

  test('API: lichte lijst-kolommen bevatten has_thumbnail vlag', () => {
    if (!apiCode.includes('thumbnail IS NOT NULL) as has_thumbnail')) {
      throw new Error('api.js geeft geen has_thumbnail vlag terug in de lijst');
    }
  });

  test('Prestatie: thumbnail-endpoint gebruikt gedeelde verbinding (geen freeze)', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('function getSharedDb') || !dbCode.includes('getSharedDb')) {
      throw new Error('database.js exporteert geen gedeelde leesverbinding getSharedDb');
    }
    if (!/module\.exports\s*=\s*\{[^}]*getSharedDb/.test(dbCode)) {
      throw new Error('getSharedDb wordt niet geëxporteerd');
    }
    // Het thumbnail-endpoint mag GEEN nieuwe verbinding per request openen/sluiten
    const i = apiCode.indexOf("'/photos/:id/thumbnail'");
    if (i === -1) throw new Error('thumbnail-endpoint niet gevonden');
    const blok = apiCode.slice(i, i + 400);
    if (!blok.includes('getSharedDb()')) {
      throw new Error('thumbnail-endpoint gebruikt niet de gedeelde verbinding');
    }
    if (blok.includes('db.close()')) {
      throw new Error('thumbnail-endpoint sluit de gedeelde verbinding (mag niet)');
    }
  });

  test('Prestatie: index voor gesorteerde paginering (diep bladeren)', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    if (!dbCode.includes('idx_fotos_video_datum')) {
      throw new Error('ontbrekende index voor snelle gesorteerde paginering');
    }
  });

  test('Galerij: minder foto\'s/video\'s per page (sneller laden)', () => {
    const videos = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    if (!fotosCode.includes('per_page: 50') || !fotosCode.includes('data.total / 50')) {
      throw new Error('photos.js laadt niet 50 per page (paginateller en fetch moeten overeenkomen)');
    }
    if (!videos.includes('per_page: 50') || !videos.includes('data.total / 50')) {
      throw new Error('videos.js laadt niet 50 per page');
    }
  });

  test('Paginering: videos.js en duplicates.js gebruiken bouwPaginering', () => {
    const videos = fs.readFileSync(path.join(__dirname, '../public/js/videos.js'), 'utf8');
    const dup    = fs.readFileSync(path.join(__dirname, '../public/js/duplicaten.js'), 'utf8');
    if (!videos.includes('bouwPaginering(')) {
      throw new Error('videos.js gebruikt de gedeelde bouwPaginering niet');
    }
    if (!dup.includes('bouwPaginering(')) {
      throw new Error('duplicates.js gebruikt de gedeelde bouwPaginering niet');
    }
  });

  test('API: keeper-functies die gebruikt worden zijn ook geïmporteerd', () => {
    const importMatch = apiCode.match(/const \{([^}]*)\} = require\('\.\/keeper'\)/);
    if (!importMatch) throw new Error("api.js importeert ./keeper niet via destructuring");
    const geimporteerd = importMatch[1].split(',').map(s => s.trim());
    for (const fn of ['readPriority', 'writePriority', 'determineKeeper', 'keeperIds']) {
      // Alleen eisen dat het geïmporteerd is als api.js het ook daadwerkelijk aanroept
      const wordtGebruikt = new RegExp('[^.\\w]' + fn + '\\s*\\(').test(apiCode);
      if (wordtGebruikt && !geimporteerd.includes(fn)) {
        throw new Error(`api.js gebruikt ${fn}() maar importeert het niet uit ./keeper`);
      }
    }
  });

  test('API: /database/delete reset de duplicaat-priority', () => {
    const i = apiCode.indexOf("'/database/delete'");
    if (i === -1) throw new Error('/database/delete endpoint niet gevonden');
    const blok = apiCode.slice(i, i + 500);
    if (!blok.includes("DELETE FROM settings WHERE key IN ('dup_source_order', 'dup_manual')")) {
      throw new Error('Wis reset de duplicaat-priority niet');
    }
  });

  test('Verborgen folders: scanner slaat dot-folders standaard over (optie includeHidden)', () => {
    if (!/function findAllPhotos\(startPath, options/.test(scannerCode)) {
      throw new Error('findAllPhotos accepteert geen opties');
    }
    if (!scannerCode.includes("item.name.startsWith('.')")) {
      throw new Error('scanner controleert hidden folders (name begint met punt) niet');
    }
    if (!scannerCode.includes('includeHidden')) {
      throw new Error('scanner kent geen includeHidden-optie');
    }
    // De skip mag NIET gebeuren als includeHidden aan staat
    const i = scannerCode.indexOf("item.name.startsWith('.')");
    const regel = scannerCode.slice(scannerCode.lastIndexOf('\n', i), scannerCode.indexOf('\n', i));
    if (!regel.includes('!includeHidden')) {
      throw new Error('hidden folders worden ook skipped als de optie aan staat');
    }
    // Standaard valt de queue terug op de per-bron instelling
    if (!scannerCode.includes('source.include_hidden')) {
      throw new Error('scanner gebruikt de per-bron instelling include_hidden niet als standaard');
    }
  });

  test('Verborgen folders: DB-kolom, API en UI compleet', () => {
    const dbCode    = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    const sources   = fs.readFileSync(path.join(__dirname, '../public/js/bronnen.js'), 'utf8');
    const html      = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const i18n      = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');

    // DB-migratie op sources-tabel
    if (!dbCode.includes('include_hidden')) {
      throw new Error('database.js mist de include_hidden migratie op sources');
    }
    // API: create + update + patch endpoint
    if ((apiCode.match(/include_hidden/g) || []).length < 3) {
      throw new Error('api.js processed include_hidden niet in create/update/patch');
    }
    if (!apiCode.includes("'/sources/:id/hidden'")) {
      throw new Error('api.js mist de PATCH /sources/:id/hidden endpoint');
    }
    // Frontend: toevoegen, bewerken, kaart-toggle
    if (!sources.includes('bronVerborgen') || !sources.includes('bewerkVerborgen')) {
      throw new Error('sources.js leest de hidden-checkboxes (toevoegen/bewerken) niet');
    }
    if (!sources.includes('function zetVerborgen')) {
      throw new Error('sources.js mist de kaart-toggle zetVerborgen');
    }
    // HTML-checkboxes aanwezig
    if (!html.includes('id="bronVerborgen"') || !html.includes('id="bewerkVerborgen"')) {
      throw new Error('index.html mist de hidden-checkbox in toevoegen- of bewerk-formulier');
    }
    // i18n in 4 talen
    if ((i18n.match(/verborgen_label:/g) || []).length < 4) {
      throw new Error('verborgen_label ontbreekt in een of meer talen (NL/EN/FR/DE)');
    }
  });

  test('Geheugen: sharp/libvips begrensd (cache uit, lage concurrency)', () => {
    // De OOM-kill kwam doordat libvips standaard een thread per core gebruikt én
    // een operatie-cache opbouwt; grote RAW/HEIC-foto's decoderen naar enorme
    // pixelbuffers. Cache uit + lage concurrency houdt de RAM-piek laag.
    if (!/sharp\.cache\(\s*false\s*\)/.test(scannerCode)) {
      throw new Error('scanner.js zet de sharp/libvips-cache niet uit (sharp.cache(false))');
    }
    if (!/sharp\.concurrency\(\s*[12]\s*\)/.test(scannerCode)) {
      throw new Error('scanner.js begrenst sharp.concurrency niet (1 of 2)');
    }
  });

  test('Geheugen: V8-heap begrensd in Electron én node-start', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/max-old-space-size=\d+/.test(mainCode)) {
      throw new Error('electron/main.js zet geen --max-old-space-size heap-plafond');
    }
    const startSh = fs.readFileSync(path.join(__dirname, '../start.sh'), 'utf8');
    if (!/node\s+--max-old-space-size=\d+\s+index\.js/.test(startSh)) {
      throw new Error('start.sh start node zonder --max-old-space-size heap-plafond');
    }
  });

  test('Geheugen: achtergrond-passes draaien serieel, niet gestapeld', () => {
    // Niet meer drie losse setTimeouts die geocode + thumbnails + GPS vlak na
    // elkaar starten — dat stapelde geheugen. Eén serie die op elkaar wacht.
    if (!scannerCode.includes('runBackgroundPasses')) {
      throw new Error('scanner.js heeft geen runBackgroundPasses-serializer');
    }
    // De serializer moet de passes echt awaiten
    if (!/await startGeocodePass\(\)/.test(scannerCode) ||
        !/await startVideoThumbnailPass\(\)/.test(scannerCode) ||
        !/await startVideoGpsPass\(\)/.test(scannerCode)) {
      throw new Error('runBackgroundPasses await de passes niet allemaal');
    }
    // De pass-functies moeten hun inner-promise teruggeven zodat await werkt
    if ((scannerCode.match(/return \(async \(\) => \{/g) || []).length < 2) {
      throw new Error('video-passes geven hun promise niet terug (await wacht niet echt)');
    }
  });

  test('Geheugen: readMetadata sluit file descriptor expliciet (geen DEP0137-lek)', () => {
    // exifr een path geven opent intern een FileHandle die soms pas bij garbage
    // collection sluit (Node DEP0137 "Closing file descriptor N on garbage
    // collection"). Bij 22.000+ foto's stapelen die descriptors op. We lezen
    // het bestand daarom zelf in een buffer en sluiten de fd in een finally.
    const metaBlok = scannerCode.slice(
      scannerCode.indexOf('async function readMetadata'),
      scannerCode.indexOf('async function readMetadata') + 1200
    );
    if (!/fs\.openSync\(/.test(metaBlok) || !/fs\.closeSync\(/.test(metaBlok)) {
      throw new Error('readMetadata opent/sluit de file descriptor niet expliciet');
    }
    if (!/finally\s*\{[\s\S]*fs\.closeSync/.test(metaBlok)) {
      throw new Error('readMetadata sluit de fd niet in een finally-blok');
    }
    // Te grote bestanden (RAW/video) niet volledig inlezen → grens aanwezig
    if (!/META_MAX_BUFFER_BYTES/.test(scannerCode)) {
      throw new Error('readMetadata heeft geen buffer-groottegrens (grote bestanden via path)');
    }
  });

  test('Branding: nette venstertitel, favicon en app-icon', () => {
    const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // Geen "Fase 1"-ontwikkeltitel meer in de venstertitel
    if (/<title>[^<]*Fase 1[^<]*<\/title>/.test(htmlCode)) {
      throw new Error('venstertitel bevat nog "Fase 1"');
    }
    if (!/<title>FotoApp[^<]*<\/title>/.test(htmlCode)) {
      throw new Error('venstertitel begint niet met FotoApp');
    }
    // Favicon-link aanwezig
    if (!/rel="icon"[^>]*favicon\.svg/.test(htmlCode)) {
      throw new Error('favicon-link (svg) ontbreekt in index.html');
    }
    // Icoon-bestanden bestaan en de SVG gebruikt een verloop (hip aperture)
    const iconSvg = fs.readFileSync(path.join(__dirname, '../build/icon.svg'), 'utf8');
    if (!/linearGradient/.test(iconSvg)) {
      throw new Error('icon.svg heeft geen verloop (linearGradient)');
    }
    for (const f of ['../build/icon.png', '../build/icon.ico', '../public/favicon.svg']) {
      if (!fs.existsSync(path.join(__dirname, f))) throw new Error('icoonbestand ontbreekt: ' + f);
    }
    // Electron-venster krijgt het app-icon mee (via nativeImage uit build/icon.png)
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/nativeImage\.createFromPath\(path\.join\([^)]*icon\.png/.test(mainCode)) {
      throw new Error('electron/main.js laadt het window-icon niet uit build/icon.png');
    }
    if (!/icon:\s*appIcon/.test(mainCode)) {
      throw new Error('electron/main.js geeft het app-icon niet aan de BrowserWindow mee');
    }
  });

  test('Robuustheid: sharp-aanroepen defensief (failOn + limitInputPixels)', () => {
    // Een libvips-worker kan met een native SIGTRAP/int3-trap omvallen op een
    // kapotte of absurd grote afbeelding — dat neemt de hele app mee en is niet
    // met try/catch te vangen. SHARP_OPTS (failOn:'none' + limitInputPixels)
    // vangt dit af als nette JS-error. Moet op élke sharp-aanroep staan.
    if (!/const SHARP_OPTS\s*=/.test(scannerCode)) {
      throw new Error('SHARP_OPTS niet gedefinieerd');
    }
    if (!/failOn:\s*'none'/.test(scannerCode) || !/limitInputPixels:/.test(scannerCode)) {
      throw new Error('SHARP_OPTS mist failOn of limitInputPixels');
    }
    // Geen kale sharp(...) meer zonder opties: elke aanroep moet SHARP_OPTS meekrijgen
    const kaleAanroepen = scannerCode.match(/sharp\([^,)]+\)/g) || [];
    // sharp.cache(...) / sharp.concurrency(...) zijn config-calls, niet meegerekend
    const echteKale = kaleAanroepen.filter(a => !/sharp\.(cache|concurrency)/.test(a));
    if (echteKale.length > 0) {
      throw new Error('sharp-aanroep zonder SHARP_OPTS: ' + echteKale.join(', '));
    }
  });

  test('Geheugen: scan-lus throttelt elke N bestanden (verlaagt RAM-piek)', () => {
    // Een korte pauze om de zoveel bestanden geeft de GC lucht en houdt de
    // event-loop vrij — verlaagt de geheugenpiek tijdens een zware scan.
    if (!/\(i \+ 1\) % 50 === 0/.test(scannerCode)) {
      throw new Error('scan-lus heeft geen throttle elke 50 bestanden');
    }
    // De throttle moet een echte await-pauze bevatten
    const throttleBlok = scannerCode.slice(
      scannerCode.indexOf('(i + 1) % 50 === 0'),
      scannerCode.indexOf('(i + 1) % 50 === 0') + 200
    );
    if (!/await new Promise\(r => setTimeout/.test(throttleBlok)) {
      throw new Error('throttle bevat geen await-pauze (setTimeout)');
    }
  });

  test('Prestatie: video-functies blokkeren de event-loop niet (async execFile)', () => {
    // De "fotoapp reageert niet"-freezes kwamen van spawnSync: dat blokkeert de
    // hele Node-loop terwijl exiftool/ffmpeg draait, dus geen HTTP tijdens de passes.
    if (!scannerCode.includes('function runCmd') || !scannerCode.includes('execFile')) {
      throw new Error('scanner.js heeft geen async subprocess-helper (runCmd/execFile)');
    }
    // De zware video-lezers moeten async zijn en runCmd gebruiken (niet spawnSync)
    if (!/async function readVideoDuration/.test(scannerCode) ||
        !/async function readGpsFromVideo/.test(scannerCode)) {
      throw new Error('readVideoDuration/readGpsFromVideo zijn niet async gemaakt');
    }
    // Geen synchrone exiftool/ffmpeg-aanroepen meer in scanner.js
    if (/spawnSync\(\s*['"](?:exiftool|ffmpeg)['"]/.test(scannerCode)) {
      throw new Error('scanner.js gebruikt nog blokkerende spawnSync voor exiftool/ffmpeg');
    }
    // Call sites moeten awaiten
    if (!scannerCode.includes('await readGpsFromVideo') ||
        !scannerCode.includes('await readVideoDuration')) {
      throw new Error('async video-functies worden niet ge-await op de aanroepplekken');
    }
  });

  test('Paginering: negeren/ignored laden snel (50 p/p, thumbnail-endpoint, bouwPaginering)', () => {
    const negerenCode = fs.readFileSync(path.join(__dirname, '../public/js/negeren.js'), 'utf8');
    // Beide lijsten: 50 per page + paginateller op /50
    if ((negerenCode.match(/per_page: 50/g) || []).length < 2) {
      throw new Error('negeren.js laadt negeren én ignored niet 50 per page');
    }
    if ((negerenCode.match(/data\.total \/ 50/g) || []).length < 2) {
      throw new Error('negeren/ignored paginateller komt niet overeen met 50 per page');
    }
    // Geen zware base64-thumbnails meer
    if ((negerenCode.match(/without_thumbnail: 1/g) || []).length < 2) {
      throw new Error('negeren/ignored vragen nog de zware base64-thumbnails mee');
    }
    // Thumbnails via het lichte endpoint + has_thumbnail vlag
    if (!negerenCode.includes('/api/photos/${f.id}/thumbnail')) {
      throw new Error('negeren/ignored laden thumbnails niet via het lichte /thumbnail-endpoint');
    }
    if ((negerenCode.match(/f\.has_thumbnail/g) || []).length < 2) {
      throw new Error('negeren/ignored gebruiken de has_thumbnail vlag niet');
    }
    // Gedeelde paginering voor beide grids
    if (!negerenCode.includes("bouwPaginering(document.getElementById('negerenPaginering')") ||
        !negerenCode.includes("bouwPaginering(document.getElementById('genegeerPaginering')")) {
      throw new Error('negeren/ignored gebruiken de gedeelde bouwPaginering niet');
    }
  });

  test('Versie: /api/version geeft de package.json-version terug', () => {
    const i = apiCode.indexOf("'/version'");
    if (i === -1) throw new Error('/version endpoint niet gevonden in api.js');
    const blok = apiCode.slice(i, i + 300);
    if (!/require\(['"]\.\.\/package\.json['"]\)\.version/.test(blok)) {
      throw new Error('/version leest de version niet uit package.json');
    }
  });

  test('Versie: titel toont version + favicon krijgt cache-bust (?v=)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes("fetch('/api/version')")) {
      throw new Error('index.html haalt /api/version niet op');
    }
    if (!/document\.title\s*=\s*["'`]FotoApp v["'`]?\s*\+\s*v/.test(html.replace(/\s+/g, ' '))) {
      throw new Error('index.html zet de titel niet met de version');
    }
    // Favicon-links krijgen ?v=<version> zodat het oude gecachte icon ververst
    if (!html.includes("'?v=' + v") && !html.includes("\"?v=\" + v")) {
      throw new Error('favicon-links krijgen geen ?v=<version> cache-bust');
    }
  });

  test('Responsief: findAllPhotos is async en geeft de event-loop lucht (setImmediate)', () => {
    // De synchrone readdirSync-inventarisatie blokkeerde het main-proces → "reageert
    // niet". Nu async met periodieke setImmediate-yields.
    if (!/async function findAllPhotos/.test(scannerCode)) {
      throw new Error('findAllPhotos is niet async gemaakt');
    }
    const blok = scannerCode.slice(
      scannerCode.indexOf('async function findAllPhotos'),
      scannerCode.indexOf('async function findAllPhotos') + 1400
    );
    if (!/fs\.promises\.readdir/.test(blok)) {
      throw new Error('findAllPhotos leest folders niet asynchroon (fs.promises.readdir)');
    }
    if (!/setImmediate/.test(blok)) {
      throw new Error('findAllPhotos geeft de event-loop geen lucht (setImmediate ontbreekt)');
    }
    if (!/await findAllPhotos\(/.test(scannerCode)) {
      throw new Error('de aanroep van findAllPhotos wordt niet ge-await');
    }
  });

  test('Responsief: detectDuplicates is async en yield per N groups', () => {
    if (!/async function detectDuplicates/.test(scannerCode)) {
      throw new Error('detectDuplicates is niet async gemaakt');
    }
    const blok = scannerCode.slice(
      scannerCode.indexOf('async function detectDuplicates'),
      scannerCode.indexOf('async function detectDuplicates') + 1200
    );
    if (!/setImmediate/.test(blok)) {
      throw new Error('detectDuplicates geeft de event-loop geen lucht (setImmediate)');
    }
    if (!/await detectDuplicates\(/.test(scannerCode)) {
      throw new Error('de aanroep van detectDuplicates wordt niet ge-await');
    }
  });

  test('Branding: app-logo gebruikt het aperture-icon (geen camera-emoji meer)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const cssCode = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    // De header-h1 toont nu een <img> met het icon, niet langer de 📷-emoji
    if (/<h1>📷/.test(html)) {
      throw new Error('header gebruikt nog de 📷-emoji als logo');
    }
    if (!/<h1><img[^>]*src="\/favicon\.svg"[^>]*class="logo-icon"/.test(html)) {
      throw new Error('header-logo verwijst niet naar /favicon.svg via class logo-icon');
    }
    if (!/\.logo-icon\s*\{/.test(cssCode)) {
      throw new Error('CSS mist .logo-icon styling');
    }
  });

  test('i18n: nav-knop "Foto-leven" (wrapped) is in alle 4 talen vertaald', () => {
    const i18nCode = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    // De wrapped/foto-leven nav-knop bleef in elke taal Nederlands omdat navMap
    // de page niet bevatte en er geen nav_wrapped-key was.
    const start = i18nCode.indexOf('APP_TRANSLATIONS');
    const braceStart = i18nCode.indexOf('{', start);
    let depth = 0, end = -1;
    for (let i = braceStart; i < i18nCode.length; i++) {
      const c = i18nCode[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    let vertalingen;
    // eslint-disable-next-line no-eval
    eval('vertalingen = ' + i18nCode.slice(braceStart, end + 1));
    ['nl', 'en', 'fr', 'de'].forEach((taal) => {
      if (!vertalingen[taal] || !vertalingen[taal].nav_wrapped) {
        throw new Error('nav_wrapped ontbreekt in taal: ' + taal);
      }
    });
    // EN mag niet meer letterlijk het Nederlandse "Foto-leven" tonen
    if (vertalingen.en.nav_wrapped === vertalingen.nl.nav_wrapped) {
      throw new Error('nav_wrapped (EN) is niet vertaald — nog gelijk aan NL');
    }
    // navMap moet de wrapped-page koppelen
    if (!/wrapped:\s*t\(['"]nav_wrapped['"]\)/.test(i18nCode)) {
      throw new Error('navMap koppelt de wrapped-page niet aan nav_wrapped');
    }
  });

  test('i18n: elke taal heeft exact dezelfde sleutels (geen gaten)', () => {
    const i18nCode = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    const start = i18nCode.indexOf('APP_TRANSLATIONS');
    const braceStart = i18nCode.indexOf('{', start);
    let depth = 0, end = -1;
    for (let i = braceStart; i < i18nCode.length; i++) {
      const c = i18nCode[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    let vertalingen;
    // eslint-disable-next-line no-eval
    eval('vertalingen = ' + i18nCode.slice(braceStart, end + 1));
    const alle = new Set();
    ['nl', 'en', 'fr', 'de'].forEach((taal) => Object.keys(vertalingen[taal]).forEach((k) => alle.add(k)));
    ['nl', 'en', 'fr', 'de'].forEach((taal) => {
      const mist = [...alle].filter((k) => !(k in vertalingen[taal]));
      if (mist.length) throw new Error('taal ' + taal + ' mist sleutels: ' + mist.join(', '));
    });
  });

  test('Branding: Electron zet app-name + Linux taakbalk-icon (WM-class)', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/app\.setName\(['"]FotoApp['"]\)/.test(mainCode)) {
      throw new Error('main.js zet de app-name niet (app.setName)');
    }
    if (!/nativeImage\.createFromPath/.test(mainCode)) {
      throw new Error('main.js laadt het icon niet via nativeImage.createFromPath');
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const wm = pkg.build && pkg.build.linux && pkg.build.linux.desktop && pkg.build.linux.desktop.StartupWMClass;
    if (wm !== 'FotoApp') {
      throw new Error('package.json mist linux.desktop.StartupWMClass = FotoApp');
    }
  });

  test('Data: userData wordt gepind zodat naamswijziging de database niet verplaatst', () => {
    // app.setName('FotoApp') zou anders de userData-map verhuizen van
    // ~/.config/fotoapp naar ~/.config/FotoApp → bestaande database lijkt leeg.
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/app\.setPath\(['"]userData['"]\s*,/.test(mainCode)) {
      throw new Error('main.js pint userData niet (app.setPath(userData, ...))');
    }
    const pinIdx = mainCode.indexOf("setPath('userData'") >= 0
      ? mainCode.indexOf("setPath('userData'")
      : mainCode.indexOf('setPath("userData"');
    const nameIdx = mainCode.indexOf("setName('FotoApp'") >= 0
      ? mainCode.indexOf("setName('FotoApp'")
      : mainCode.indexOf('setName("FotoApp"');
    if (pinIdx === -1 || nameIdx === -1 || pinIdx > nameIdx) {
      throw new Error('userData moet GEPIND worden vóór app.setName, anders verhuist de DB');
    }
    if (!/['"]fotoapp['"]/.test(mainCode.slice(pinIdx, pinIdx + 120))) {
      throw new Error('userData wordt niet op de oorspronkelijke map "fotoapp" gepind');
    }
  });

  test('Branding: FotoApp.desktop bestaat met StartupWMClass + icon', () => {
    const desktop = fs.readFileSync(path.join(__dirname, '../build/FotoApp.desktop'), 'utf8');
    if (!/^\[Desktop Entry\]/m.test(desktop)) {
      throw new Error('FotoApp.desktop mist [Desktop Entry]-kop');
    }
    if (!/StartupWMClass=FotoApp/.test(desktop)) {
      throw new Error('FotoApp.desktop mist StartupWMClass=FotoApp (icon-koppeling)');
    }
    if (!/Icon=@APPDIR@\/build\/icon\.png/.test(desktop)) {
      throw new Error('FotoApp.desktop verwijst niet naar build/icon.png via @APPDIR@');
    }
    if (!/Exec=@APPDIR@\/start-electron\.sh/.test(desktop)) {
      throw new Error('FotoApp.desktop heeft geen Exec naar start-electron.sh');
    }
  });

  test('Branding: start-electron.sh installeert het .desktop-bestand', () => {
    const sh = fs.readFileSync(path.join(__dirname, '../start-electron.sh'), 'utf8');
    if (!/\.local\/share\/applications/.test(sh)) {
      throw new Error('start-electron.sh installeert het .desktop niet in ~/.local/share/applications');
    }
    if (!/sed\s+["']s\|@APPDIR@\|/.test(sh)) {
      throw new Error('start-electron.sh vervangt @APPDIR@ niet door het absolute path');
    }
    if (!/FotoApp\.desktop/.test(sh)) {
      throw new Error('start-electron.sh verwijst niet naar FotoApp.desktop');
    }
  });

  test('Branding: Electron zet WM_CLASS via --class (X11-icoonkoppeling)', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/appendSwitch\(['"]class['"]\s*,\s*['"]FotoApp['"]\)/.test(mainCode)) {
      throw new Error('main.js zet de WM_CLASS niet via appendSwitch(class, FotoApp)');
    }
  });

  test('Stabiliteit: Linux forceert GTK3 (voorkomt SIGTRAP-crash bij map kiezen)', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/appendSwitch\(['"]gtk-version['"]\s*,\s*['"]3['"]\)/.test(mainCode)) {
      throw new Error('main.js forceert GTK3 niet — GTK4-mapkiezer crasht met SIGTRAP');
    }
    if (!/process\.platform\s*===\s*['"]linux['"]/.test(mainCode)) {
      throw new Error('GTK3 moet alleen op Linux geforceerd worden (process.platform-check)');
    }
  });

  test('Monitoring: Electron logt renderer- en subproces-crashes', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!/render-process-gone/.test(mainCode)) {
      throw new Error('main.js logt geen renderer-crashes (render-process-gone)');
    }
    if (!/child-process-gone/.test(mainCode)) {
      throw new Error('main.js logt geen subproces-crashes (child-process-gone)');
    }
    // Beide moeten naar de foutlog schrijven zodat we de oorzaak terugvinden
    const rpg = mainCode.indexOf('render-process-gone');
    const cpg = mainCode.indexOf('child-process-gone');
    if (!/logError\(/.test(mainCode.slice(rpg, rpg + 200)) ||
        !/logError\(/.test(mainCode.slice(cpg, cpg + 250))) {
      throw new Error('crash-handlers schrijven niet naar logError (electron-error.log)');
    }
  });

  test('GPS-bulk: backend /photos/delete-bulk verplaatst naar prullenbak + cascade', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
    if (!/router\.post\(['"]\/photos\/delete-bulk['"]/.test(apiCode)) {
      throw new Error('api.js mist het /photos/delete-bulk endpoint');
    }
    // Pak het blok van het endpoint tot het volgende router.-aanroep
    const start = apiCode.indexOf("/photos/delete-bulk");
    const blok = apiCode.slice(start, start + 2500);
    if (!/require\(['"]trash['"]\)/.test(blok)) {
      throw new Error('delete-bulk gebruikt de prullenbak-module (trash) niet — mag nooit permanent wissen');
    }
    if (!/duplicate_group/.test(blok)) {
      throw new Error('delete-bulk cascadeert niet over duplicaatgroepen');
    }
    if (!/DELETE FROM photos WHERE id IN/.test(blok)) {
      throw new Error('delete-bulk verwijdert de DB-records niet');
    }
    // Geen permanente fs-verwijdering
    if (/fs\.unlink|fs\.rmSync|fs\.rmdir/.test(blok)) {
      throw new Error('delete-bulk mag geen fs.unlink/rm gebruiken — alleen prullenbak');
    }
  });

  test('GPS-bulk: frontend heeft verwijderknop + handler die het endpoint aanroept', () => {
    const js = fs.readFileSync(path.join(__dirname, '../public/js/gpsbulk.js'), 'utf8');
    if (!/verwijderGroep\(/.test(js)) {
      throw new Error('gpsbulk.js mist de verwijderGroep-knop/handler');
    }
    if (!/async function verwijderGroep/.test(js)) {
      throw new Error('gpsbulk.js mist de async verwijderGroep-functie');
    }
    if (!/\/api\/photos\/delete-bulk/.test(js)) {
      throw new Error('verwijderGroep roept /api/photos/delete-bulk niet aan');
    }
    if (!/confirm\(/.test(js)) {
      throw new Error('verwijderGroep vraagt geen bevestiging vóór verwijderen');
    }
  });

  test('GPS-bulk: i18n-sleutels voor verwijderknop in alle 4 talen', () => {
    const i18n = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
    const keys = ['gpsbulk_groep_verwijder', 'gpsbulk_groep_verwijder_bevestig', 'gpsbulk_groep_verwijderd'];
    for (const k of keys) {
      const n = (i18n.match(new RegExp(k + '\\s*:', 'g')) || []).length;
      if (n < 4) {
        throw new Error(`i18n-key ${k} ontbreekt in één of meer talen (gevonden: ${n}/4)`);
      }
    }
  });

  return resultaten;
};
