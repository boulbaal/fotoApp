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
