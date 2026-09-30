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

  return resultaten;
};
