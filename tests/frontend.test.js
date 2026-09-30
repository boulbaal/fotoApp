// Frontend contract tests — static checks that the HTML, the frontend JS and
// the backend still agree with each other. These catch the kind of breakage a
// big rename (v1.0.4, Dutch → English) leaves behind: a page id, route or class
// renamed on one side only.
const fs   = require('fs');
const path = require('path');

module.exports = async function testFrontend() {
  const resultaten = [];

  function test(name, fn) {
    try {
      fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
    }
  }

  const publicDir = path.join(__dirname, '../public');
  const html   = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const jsDir  = path.join(publicDir, 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  const js     = Object.fromEntries(jsFiles.map(f => [f, fs.readFileSync(path.join(jsDir, f), 'utf8')]));

  // ─── NAVIGATIE ────────────────────────────────────────────────────────────

  test('Navigatie: elke pagina-naam heeft een container met id "page" + Naam', () => {
    // toonPagina(name) activeert document.getElementById('page' + Name)
    if (!/getElementById\('page' \+ name\.charAt\(0\)\.toUpperCase\(\) \+ name\.slice\(1\)\)/.test(js['app.js'])) {
      throw new Error("toonPagina zoekt de pagina niet meer op als 'page' + Naam — pas deze test aan");
    }
    const names = new Set();
    for (const m of html.matchAll(/data-page="([\w-]+)"/g)) names.add(m[1]);
    for (const src of [html, ...Object.values(js)]) {
      for (const m of src.matchAll(/toonPagina\(\s*'([\w-]+)'/g)) names.add(m[1]);
    }
    if (names.size < 10) throw new Error(`te weinig pagina-namen gevonden (${names.size})`);
    const missing = [...names].filter(n => !html.includes(`id="page${n.charAt(0).toUpperCase() + n.slice(1)}"`));
    if (missing.length) throw new Error('geen pagina-container voor: ' + missing.join(', '));
  });

  // ─── GENEGEERD-PAGINA ─────────────────────────────────────────────────────

  test('Genegeerd-pagina: klikken op een foto herstelt hem (zoals de uitleg zegt)', () => {
    const neg = js['negeren.js'];
    const tpl = (neg.slice(neg.indexOf('async function laadGenegeerd')).match(/<div class="foto-item ignore-item[^>]*>/) || [])[0] || '';
    if (!/onclick="herstelGenegeerd\(/.test(tpl)) throw new Error('foto op de Genegeerd-pagina heeft geen klik-om-te-herstellen');
    if (!/async function herstelGenegeerd[\s\S]*?ignored: false/.test(neg)) throw new Error('herstelGenegeerd zet ignored niet op false');
  });

  // ─── MAPKIEZER ────────────────────────────────────────────────────────────

  test('Mapkiezer: geen hardgecodeerde startmap; server valt terug op os.homedir()', () => {
    if (/\/home\/one/.test(js['mapkiezer.js'])) throw new Error("mapkiezer.js gebruikt nog '/home/one' als startmap");
    const idx = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
    if (!/msg\.startPath \|\| os\.homedir\(\)/.test(idx)) throw new Error('index.js valt niet terug op os.homedir()');
  });

  // ─── CSS ──────────────────────────────────────────────────────────────────

  test('CSS: elke klasse die de JS via classList/className zet, bestaat in style.css', () => {
    // Een klasse die alleen aan één kant hernoemd is, geeft geen fout maar
    // verbergt stil de visuele staat (bv. geselecteerde foto zonder markering).
    const css = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const cssClasses = new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map(m => m[1]));
    const missing = [];
    for (const [file, src] of Object.entries(js)) {
      for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(([^)]*)\)/g)) {
        for (const c of m[1].matchAll(/['"]([\w-]+)['"]/g)) if (!cssClasses.has(c[1])) missing.push(`${c[1]} (${file})`);
      }
      for (const m of src.matchAll(/\.className\s*=\s*[`'"]([^`'"]*)[`'"]/g)) {
        for (const c of m[1].split(/\s+/)) if (c && !c.includes('$') && !cssClasses.has(c)) missing.push(`${c} (${file})`);
      }
    }
    if (missing.length) throw new Error('klassen zonder CSS: ' + [...new Set(missing)].join(', '));
  });

  test('CSS: elke scan-balk-status (setScanBalkStatus) heeft een .scan-dot-stijl', () => {
    const css = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8');
    const staten = [...js['scanner.js'].matchAll(/setScanBalkStatus\('([\w-]+)'/g)].map(m => m[1]);
    if (!staten.length) throw new Error('geen setScanBalkStatus-aanroepen gevonden');
    const missing = [...new Set(staten)].filter(s => !css.includes(`.scan-dot.${s}`));
    if (missing.length) throw new Error('scan-dot zonder stijl: ' + missing.join(', '));
  });

  test('CSS: selectie-markering gebruikt dezelfde klasse als fotos.js en gpsbulk.js', () => {
    const css = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8');
    if (!/classList\.toggle\('selected'/.test(js['fotos.js'])) throw new Error("fotos.js zet 'selected' niet meer — pas deze test aan");
    if (!css.includes('.foto-item.selected')) throw new Error('.foto-item.selected ontbreekt in style.css');
    if (!/' selected'/.test(js['gpsbulk.js']) || !css.includes('.bulk-thumb.selected')) throw new Error('.bulk-thumb.selected ontbreekt of wordt niet gezet');
  });

  test('CSS: zoekresultaten in de GPS-bulk-kaart worden zichtbaar gemaakt (.open)', () => {
    // .gps-search-resultaten is display:none tot de klasse .open gezet wordt
    if (!/id="bulkKaartZoekResultaten" class="gps-search-resultaten"/.test(html)) throw new Error('markup veranderd — pas deze test aan');
    const fn = (js['gpsbulk.js'].match(/function zoekBulkKaartLocatie\(\) \{([\s\S]*?)\n\}/) || [])[1] || '';
    if (!fn.includes("classList.add('open')")) throw new Error("zoekBulkKaartLocatie zet .open niet → resultaten blijven onzichtbaar");
  });

  // ─── I18N ─────────────────────────────────────────────────────────────────

  test('i18n: navigatie-knoppen worden vertaald (data-page + alle pagina-namen)', () => {
    const i18n = js['i18n.js'];
    if (!/querySelectorAll\('\[data-page\]'\)/.test(i18n)) throw new Error("i18n.js vertaalt niet via [data-page]");
    const mapSrc = (i18n.match(/const navMap = \{([\s\S]*?)\};/) || [])[1];
    if (!mapSrc) throw new Error('navMap niet gevonden in i18n.js');
    const keys = new Set([...mapSrc.matchAll(/(\w+):\s*t\(/g)].map(m => m[1]));
    const navNames = [...html.matchAll(/<button data-page="([\w-]+)"(?![^>]*doneer-sidebar-knop)/g)].map(m => m[1]);
    const missing = navNames.filter(n => !keys.has(n));
    if (missing.length) throw new Error('nav-knoppen zonder vertaling: ' + missing.join(', '));
    const stale = [...keys].filter(k => !navNames.includes(k));
    if (stale.length) throw new Error('navMap bevat onbekende pagina-namen: ' + stale.join(', '));
  });

  test('UI-teksten: geen half vertaalde restanten van de automatische hernoeming', () => {
    // v1.0.4 verving Nederlandse woorden ook ín zichtbare teksten ("Vul name en path in",
    // "12 new_files", "assigned aan"). Deze patronen mogen niet terugkomen.
    const kapot = [/\$\{status\.new_files\} new_files/, /Vul name en path/, /\bassigned aan\b/, /Onbekende date/,
      /Ongeldige date/, /zonder location/i, /(foto|video)\$\{[^}]*"'s"/, /' foto\\'s'/];
    const hits = [];
    for (const [file, src] of Object.entries(js)) for (const re of kapot) if (re.test(src)) hits.push(`${re} (${file})`);
    if (hits.length) throw new Error('half vertaalde tekst: ' + hits.join(', '));
  });

  test('i18n: datums volgen de UI-taal (geen "02 mei 2024" in de Engelse UI)', () => {
    const vm = require('vm');
    const fmt = (lang) => {
      const ctx = { window: { i18n: { getLang: () => lang } }, console };
      vm.runInNewContext(js['utils.js'], ctx);
      return [ctx.formatDatum('2024-05-02T12:00:00Z'), ctx.formatDatumTijd('2024-05-02T12:00:00Z')];
    };
    const [en, enTijd] = fmt('en');
    const [nl] = fmt('nl');
    if (!/May/.test(en) || / om /.test(enTijd)) throw new Error(`Engels: "${en}" / "${enTijd}"`);
    if (!/mei/.test(nl)) throw new Error(`Nederlands: "${nl}"`);
  });

  test('i18n: taalwissel overschrijft de scan-indicator niet tijdens een scan', () => {
    const cls = (js['scanner.js'].match(/ind\.className = 'scan-indicator (\w+)'/) || [])[1];
    if (!cls) throw new Error('scan-indicator klasse niet gevonden in scanner.js');
    if (!js['i18n.js'].includes(`indicator.classList.contains('${cls}')`)) {
      throw new Error(`i18n.js controleert niet op de klasse '${cls}' die scanner.js zet`);
    }
  });

  // ─── API-CONTRACT ─────────────────────────────────────────────────────────

  // All routes the backend exposes, e.g. { method: 'POST', path: '/photos/:id/ignore' }
  const apiCode = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
  const routes = [...apiCode.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)]
    .map(m => ({ method: m[1].toUpperCase(), path: m[2] }));

  // Everything between the parentheses of a call starting at `open` (index of '(').
  function callArgs(src, open) {
    const stack = ['('];            // open brackets, template literals ('`') and ${ } blocks
    for (let i = open + 1; i < src.length; i++) {
      const c = src[i];
      if (stack[stack.length - 1] === '`') {
        if (c === '\\') i++;
        else if (c === '`') stack.pop();
        else if (c === '$' && src[i + 1] === '{') { stack.push('${'); i++; }
        continue;
      }
      if (c === "'" || c === '"') {
        for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      } else if (c === '`' || c === '(' || c === '[' || c === '{') {
        stack.push(c);
      } else if (c === ')' || c === ']' || c === '}') {
        stack.pop();
        if (stack.length === 0) return src.slice(open + 1, i);
      }
    }
    return null;
  }

  // Normalise the URL expression of a fetch() to a route-like path:
  // dynamic segments after a '/' become ':p', anything else dynamic (query string) ends the path.
  function urlPath(expr) {
    let out = '';
    const parts = expr.split(/\s*\+\s*/);
    for (const part of parts) {
      const lit = part.match(/^(['"])(.*)\1$/) || part.match(/^(`)([\s\S]*)`$/);
      if (!lit) {
        if (!out.endsWith('/')) break;
        out += ':p';
        continue;
      }
      let s = lit[2];
      if (lit[1] === '`') {
        let stop = false;
        s = s.replace(/\$\{[^}]*\}/g, (m, off, str) => {
          if (stop) return '';
          const before = str.slice(0, off);
          if (before.endsWith('/')) return ':p';
          stop = true; return '\u0000';
        });
        s = s.split('\u0000')[0];
      }
      out += s;
      if (out.includes('?')) break;
    }
    return out.split('?')[0];
  }

  function frontendApiCalls() {
    const calls = [];
    const sources = { 'index.html': html, ...js };
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/\bfetch\(/g)) {
        const args = callArgs(src, m.index + 5);
        if (!args) continue;
        const first = args.match(/^\s*((?:'[^']*'|`[^`]*`|"[^"]*"|[\w.$]+)(?:\s*\+\s*(?:'[^']*'|`[^`]*`|"[^"]*"|[\w.$]+))*)/);
        if (!first) continue;
        const p = urlPath(first[1].trim());
        if (!p.startsWith('/api/')) continue;
        const method = (args.match(/method:\s*'(\w+)'/) || [, 'GET'])[1].toUpperCase();
        calls.push({ file, method, path: p.slice(4) });
      }
      // <img src="/api/...">, <a href="/api/...">, <video src="/api/...">
      for (const m of src.matchAll(/(?:src|href)="(\/api\/[^"]*)"/g)) {
        calls.push({ file, method: 'GET', path: urlPath('`' + m[1] + '`').slice(4) });
      }
    }
    return calls;
  }

  function routeMatches(route, call) {
    if (route.method !== call.method) return false;
    const r = route.path.split('/'), c = call.path.split('/');
    if (r.length !== c.length) return false;
    return r.every((seg, i) => seg.startsWith(':') ? c[i] !== '' : seg === c[i]);
  }

  test('API-contract: elke fetch(\'/api/...\') in de frontend matcht een route in src/api.js', () => {
    const calls = frontendApiCalls();
    if (calls.length < 60) throw new Error(`te weinig API-aanroepen gevonden (${calls.length}) — parser stuk?`);
    const unknown = calls.filter(c => !routes.some(r => routeMatches(r, c)));
    if (unknown.length) {
      throw new Error('onbekende API-aanroepen: ' + unknown.map(c => `${c.method} /api${c.path} (${c.file})`).join(', '));
    }
  });

  test('API-contract: de parser herkent een verkeerde route (zelftest)', () => {
    const bad = { method: 'GET', path: urlPath("'/api/bronnen/' + id").slice(4) };
    if (bad.path !== '/bronnen/:p') throw new Error('parser gaf ' + bad.path);
    if (routes.some(r => routeMatches(r, bad))) throw new Error('/api/bronnen/:id zou niet mogen matchen');
    const ok = { method: 'POST', path: urlPath('`/api/photos/${id}/ignore`').slice(4) };
    if (!routes.some(r => routeMatches(r, ok))) throw new Error('POST /api/photos/:id/ignore zou moeten matchen');
    if (urlPath("'/api/map/locations' + params") !== '/api/map/locations') throw new Error('query-suffix niet genegeerd');
  });

  return resultaten;
};
