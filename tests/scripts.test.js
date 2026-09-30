const fs   = require('fs');
const path = require('path');

module.exports = async function testScripts() {
  const resultaten = [];

  function test(name, fn) {
    try {
      fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
    }
  }

  const lees = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const bestaat = (rel) => fs.existsSync(path.join(__dirname, '..', rel));
  const uitvoerbaar = (rel) => {
    const st = fs.statSync(path.join(__dirname, '..', rel));
    return (st.mode & 0o111) !== 0; // minstens één execute-bit
  };

  // ─── BESTANDSSTRUCTUUR ──────────────────────────────────────────────────────

  test('start-electron.sh bestaat', () => {
    if (!bestaat('start-electron.sh')) throw new Error('start-electron.sh niet gevonden');
  });

  test('stop-electron.sh bestaat', () => {
    if (!bestaat('stop-electron.sh')) throw new Error('stop-electron.sh niet gevonden');
  });

  test('start-electron.sh is uitvoerbaar', () => {
    if (!uitvoerbaar('start-electron.sh')) throw new Error('execute-bit ontbreekt');
  });

  test('stop-electron.sh is uitvoerbaar', () => {
    if (!uitvoerbaar('stop-electron.sh')) throw new Error('execute-bit ontbreekt');
  });

  // ─── START-ELECTRON INHOUD ──────────────────────────────────────────────────

  const start = lees('start-electron.sh');

  test('start-electron.sh draait tests vóór start', () => {
    if (!start.includes('node tests/run-tests.js')) throw new Error('test-stap ontbreekt');
  });

  test('start-electron.sh stopt bij gefaalde tests', () => {
    if (!start.includes('TEST_RESULT') || !start.includes('exit 1')) {
      throw new Error('faalt niet bij rode tests');
    }
  });

  test('start-electron.sh start Electron', () => {
    if (!start.includes('electron') || !start.includes('ELECTRON_RUN=1')) {
      throw new Error('Electron-start ontbreekt');
    }
  });

  test('start-electron.sh schrijft eigen PID-bestand', () => {
    if (!start.includes('.electron.pid')) throw new Error('.electron.pid niet gebruikt');
  });

  test('start-electron.sh maakt poort 3000 vrij', () => {
    if (!start.includes('tcp:3000')) throw new Error('poort-opruiming ontbreekt');
  });

  test('start-electron.sh test native module vóór start', () => {
    if (!start.includes('ELECTRON_RUN_AS_NODE') || !start.includes('better-sqlite3')) {
      throw new Error('pre-flight native-module check ontbreekt');
    }
  });

  test('start-electron.sh adviseert npm run rebuild bij mismatch', () => {
    if (!start.includes('npm run rebuild')) throw new Error('rebuild-advies ontbreekt');
  });

  test('start-electron.sh scant welk proces poort 3000 gebruikt', () => {
    if (!start.includes('ps -p')) throw new Error('proces-scan op poort ontbreekt');
  });

  test('start-electron.sh heeft post-mortem diagnose', () => {
    if (!start.includes('NODE_MODULE_VERSION') || !start.includes('grep')) {
      throw new Error('post-mortem log-analyse ontbreekt');
    }
  });

  // De gebruiker start met "sh ..." (= dash op Ubuntu): geen bash-only syntax.
  test('start-electron.sh is POSIX-veilig (geen process-substitutie of &>)', () => {
    if (start.includes('>(') || /[^0-9]&>/.test(start) || start.includes("$'")) {
      throw new Error('bevat bash-only syntax die met sh/dash crasht');
    }
  });

  // ─── STOP-ELECTRON INHOUD ───────────────────────────────────────────────────

  const stop = lees('stop-electron.sh');

  test('stop-electron.sh leest eigen PID-bestand', () => {
    if (!stop.includes('.electron.pid')) throw new Error('.electron.pid niet gebruikt');
  });

  test('stop-electron.sh stuurt kill-signaal', () => {
    if (!stop.includes('kill')) throw new Error('kill ontbreekt');
  });

  test('stop-electron.sh heeft poort-fallback', () => {
    if (!stop.includes('tcp:3000')) throw new Error('poort-fallback ontbreekt');
  });

  test('stop-electron.sh is POSIX-veilig (geen process-substitutie of &>)', () => {
    if (stop.includes('>(') || /[^0-9]&>/.test(stop) || stop.includes("$'")) {
      throw new Error('bevat bash-only syntax die met sh/dash crasht');
    }
  });

  // ─── ISOLATIE T.O.V. WEB-SCRIPTS ────────────────────────────────────────────

  test('Electron-scripts gebruiken niet hetzelfde PID-bestand als stop.sh (.pid)', () => {
    // Alle .pid-verwijzingen moeten .electron.pid zijn — nooit het kale .pid
    // van de web-server (index.js / stop.sh).
    const kaalPid = /(?<!electron)\.pid/;
    if (kaalPid.test(start) || kaalPid.test(stop)) {
      throw new Error('mag .pid van de web-server niet overschrijven');
    }
  });

  // ─── ELECTRON FOUTAFHANDELING ───────────────────────────────────────────────

  const mainJs = lees('electron/main.js');

  test('electron/main.js bewaart server-error (serverError)', () => {
    if (!mainJs.includes('serverError')) throw new Error('serverError ontbreekt');
  });

  test('electron/main.js classificeert errors (diagnoseError)', () => {
    if (!mainJs.includes('diagnoseError')) throw new Error('diagnoseError ontbreekt');
  });

  test('electron/main.js herkent native-module mismatch', () => {
    if (!mainJs.includes('NODE_MODULE_VERSION') || !mainJs.includes('npm run rebuild')) {
      throw new Error('native-module diagnose ontbreekt');
    }
  });

  test('electron/main.js herkent bezette poort (EADDRINUSE)', () => {
    if (!mainJs.includes('EADDRINUSE')) throw new Error('poort-diagnose ontbreekt');
  });

  test('electron/main.js geeft diagnose door aan error.html (hash)', () => {
    if (!mainJs.includes('error.html') || !mainJs.includes('hash')) {
      throw new Error('diagnose wordt niet doorgegeven aan foutpagina');
    }
  });

  test('electron/main.js schrijft foutlog', () => {
    if (!mainJs.includes('logError') || !mainJs.includes('electron-error.log')) {
      throw new Error('foutlog ontbreekt');
    }
  });

  // ─── FOUTPAGINA ─────────────────────────────────────────────────────────────

  const errorHtml = lees('electron/error.html');

  test('error.html leest de diagnose uit location.hash', () => {
    if (!errorHtml.includes('location.hash')) throw new Error('hash-uitlezing ontbreekt');
  });

  test('error.html toont oplossingen met kopieer-knop', () => {
    if (!errorHtml.includes('solutions') || !errorHtml.includes('clipboard')) {
      throw new Error('oplossingen of kopieer-knop ontbreekt');
    }
  });

  // ─── XSS: HTML-ESCAPING IN DE FRONTEND ──────────────────────────────────────
  // Bestandsnamen, paden, bronnamen, EXIF, Nominatim-namen … zijn onbetrouwbaar.
  // Een bestand "\"><img src=x onerror=alert(1)>.jpg" moet overal als tekst tonen.

  const vm = require('vm');
  const XSS = '"><img src=x onerror=alert(1)>.jpg';
  const RAUW = '<img src=x onerror=alert(1)>';

  async function testAsync(name, fn) {
    try {
      await fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
    }
  }

  // Minimale nep-DOM: getElementById geeft per id een object terug dat innerHTML bijhoudt
  function maakSandbox(fetchAntwoorden = {}) {
    const elementen = {};
    const maakEl = (id) => ({
      id, innerHTML: '', textContent: '', value: '', title: '',
      dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      querySelectorAll() { return []; },
      addEventListener() {}, appendChild() {},
    });
    const document = {
      getElementById: (id) => (elementen[id] = elementen[id] || maakEl(id)),
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => maakEl('_'),
    };
    const ctx = {
      document, console: { log() {}, warn() {}, error: console.error },
      fetch: async (url) => {
        const sleutel = Object.keys(fetchAntwoorden).find(k => String(url).startsWith(k));
        return { ok: true, json: async () => fetchAntwoorden[sleutel] };
      },
      setTimeout, clearTimeout, URLSearchParams,
    };
    ctx.window = ctx;
    ctx.i18n = ctx.window.i18n = { t: (k, f) => f || k };
    vm.createContext(ctx);
    return { ctx, elementen, laad: (rel) => vm.runInContext(lees(rel), ctx, { filename: rel }) };
  }

  const utilsJs = lees('public/js/utils.js');

  test('XSS: utils.js definieert gedeelde escapeHtml()', () => {
    if (!/function escapeHtml\s*\(/.test(utilsJs)) throw new Error('escapeHtml ontbreekt in utils.js');
  });

  test('XSS: escapeHtml escapet & < > " \' en geeft \'\' voor null/undefined', () => {
    const { ctx, laad } = maakSandbox();
    laad('public/js/utils.js');
    const e = ctx.escapeHtml;
    const checks = [
      [e(XSS), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;.jpg'],
      [e(`a&b 'c' "d"`), 'a&amp;b &#39;c&#39; &quot;d&quot;'],
      [e(null), ''],
      [e(undefined), ''],
      [e(0), '0'],
      [e(42), '42'],
      [e('gewoon.jpg'), 'gewoon.jpg'],
      [e('📷 Canon'), '📷 Canon'],
    ];
    for (const [kreeg, verwacht] of checks) {
      if (kreeg !== verwacht) throw new Error(`verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(kreeg)}`);
    }
  });

  test('XSS: escapeHtml bestaat maar één keer (geen zwakkere kopie die utils.js overschrijft)', () => {
    const jsDir = path.join(__dirname, '..', 'public', 'js');
    const metDefinitie = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))
      .filter(f => /function escapeHtml\s*\(/.test(fs.readFileSync(path.join(jsDir, f), 'utf8')));
    if (metDefinitie.length !== 1 || metDefinitie[0] !== 'utils.js') {
      throw new Error('escapeHtml gedefinieerd in: ' + metDefinitie.join(', '));
    }
  });

  test('XSS: utils.js laadt vóór alle andere /js/-scripts in index.html', () => {
    const html = lees('public/index.html');
    const scripts = [...html.matchAll(/<script src="\/js\/([^"]+)"/g)].map(m => m[1]);
    if (scripts[0] !== 'utils.js') throw new Error('eerste /js/-script is ' + scripts[0]);
  });

  test('XSS: bekende sinks gebruiken escapeHtml (regressie)', () => {
    const verplicht = {
      'public/js/fotos.js': [
        '<div class="name">${escapeHtml(f.filename)}</div>',      // fotokaart bestandsnaam
        'alt="${escapeHtml(f.filename)}"',
        '${escapeHtml(b.icon)} ${escapeHtml(b.name)}</option>',     // bronfilter-opties
        '<option value="${escapeHtml(value)}">${escapeHtml(label)}', // camerafilter
        '<option value="${escapeHtml(r.gps_country)}">',            // landfilter
        '<div class="filter-chip">${escapeHtml(actieveFilter.label)}', // filterchip
        'value="${escapeHtml(f.gps_city || \'\')}"',
        'escapeHtml(f.lens || \'—\')',
        'escapeHtml(d.full_path)',
      ],
      'public/js/videos.js': [
        '<div class="name">${escapeHtml(f.filename)}</div>',
        '${escapeHtml(b.icon)} ${escapeHtml(b.name)}</option>',
        '<option value="${escapeHtml(value)}">${escapeHtml(label)}',
        '<option value="${escapeHtml(r.gps_country)}">',
      ],
      'public/js/negeren.js':    ['<div class="name">${escapeHtml(f.filename)}</div>'],
      'public/js/bronnen.js':    ['${escapeHtml(b.name)}</h3>', '📁 ${escapeHtml(b.path)}'],
      'public/js/duplicaten.js': ['${escapeHtml(f.full_path)}', '${escapeHtml(b.name)}</span>'],
      'public/js/dashboard.js':  ['<div class="bar-label">${escapeHtml(rij[labelVeld]'],
      'public/js/kaart.js':      ['title="${escapeHtml(f.filename)}"', '<option value="${escapeHtml(l.gps_country)}">'],
      'public/js/gpskaart.js':   ['${escapeHtml(item.display_name)}'],
      'public/js/gpsbulk.js':    ['${escapeHtml(r.display_name)}'],
      'public/js/export.js':     ['${escapeHtml(f.bestand)}: ${escapeHtml(f.error)}'],
      'public/js/scanner.js':    ['escapeHtml(geocode.current_country)'],
      'public/js/wrapped.js':    ['${escapeHtml(l.gps_country)}'],
    };
    const fouten = [];
    for (const [bestand, fragmenten] of Object.entries(verplicht)) {
      const code = lees(bestand);
      for (const frag of fragmenten) if (!code.includes(frag)) fouten.push(`${bestand}: ${frag}`);
    }
    if (fouten.length) throw new Error('niet geëscaped:\n      ' + fouten.join('\n      '));
  });

  test('XSS: geen vrije tekst in inline onclick-strings (enkel numerieke ids)', () => {
    const bronnen = lees('public/js/bronnen.js');
    if (/onclick="[^"]*'\$\{b\.(name|path|type)/.test(bronnen) || bronnen.includes("b.name.replace(/'/g")) {
      throw new Error('bronnen.js zet naam/pad nog in een onclick-string');
    }
    const gpskaart = lees('public/js/gpskaart.js');
    if (/onclick="[^"]*display_name/.test(gpskaart) || /onclick="kiesZoekResultaat\(\$\{item\.lat/.test(gpskaart)) {
      throw new Error('gpskaart.js zet Nominatim-velden nog in een onclick');
    }
    const dup = lees('public/js/duplicaten.js');
    if (dup.includes("'${g.duplicate_group}'")) throw new Error('duplicaten.js: duplicate_group ongeëscaped in onclick');
  });

  await testAsync('XSS: fotogalerij + filterchip renderen kwaadaardige bestandsnaam als tekst', async () => {
    const { ctx, elementen, laad } = maakSandbox({
      '/api/photos?': { total: 1, photos: [{ id: 7, filename: XSS, has_thumbnail: 1, gps_city: XSS, source_icon: XSS, photo_date: null }] },
    });
    laad('public/js/utils.js');
    laad('public/js/fotos.js');
    ctx.document.getElementById('actieveFilters').dataset.country = 'x';
    ctx.document.getElementById('actieveFilters').dataset.label = XSS;
    await vm.runInContext('laadFotos(1)', ctx);
    const grid = elementen.fotoGrid.innerHTML, chip = elementen.actieveFilters.innerHTML;
    for (const [naam, html] of [['fotoGrid', grid], ['filterchip', chip]]) {
      if (html.includes(RAUW)) throw new Error(`${naam} bevat rauwe <img onerror>`);
      if (!html.includes('&lt;img src=x onerror=alert(1)&gt;')) throw new Error(`${naam} toont de naam niet als tekst`);
    }
    if (!grid.includes('onclick="fotoItemKlik(7)"')) throw new Error('fotokaart-onclick onverwacht gewijzigd');
  });

  await testAsync('XSS: bron-, camera- en landfilter-opties escapen vrije tekst', async () => {
    const { ctx, elementen, laad } = maakSandbox({
      '/api/sources': [{ id: 1, icon: '💻', name: XSS }],
      '/api/stats': {
        perYear: [{ year: 2024, count: 1 }],
        perCamera: [{ camera_make: XSS, camera_model: 'M', count: 1 }],
        perCountry: [{ gps_country: XSS, count: 1 }],
      },
    });
    laad('public/js/utils.js');
    laad('public/js/fotos.js');
    await vm.runInContext('laadBronnenFilter()', ctx);
    for (const id of ['filterBron', 'filterCamera', 'filterLand']) {
      const html = elementen[id].innerHTML;
      if (html.includes(RAUW)) throw new Error(`${id} bevat rauwe <img onerror>`);
      if (!html.includes('&lt;img')) throw new Error(`${id} toont de naam niet als tekst`);
    }
  });

  test('XSS: dashboard-balklabel escapet camera-/bronnamen', () => {
    const { ctx, elementen, laad } = maakSandbox();
    laad('public/js/utils.js');
    laad('public/js/dashboard.js');
    ctx.tekenBalk('grafiekTest', [{ label: XSS, count: 3 }], 'label', 'count', null, null, null);
    const html = elementen.grafiekTest.innerHTML;
    if (html.includes(RAUW)) throw new Error('bar-label bevat rauwe <img onerror>');
    if (!html.includes('&lt;img')) throw new Error('bar-label toont de naam niet als tekst');
  });

  return resultaten;
};
