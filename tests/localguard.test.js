const fs   = require('fs');
const path = require('path');
const http = require('http');
const { isLocalRequest, expressGuard } = require('../src/localguard');

module.exports = async function testLocalGuard() {
  const resultaten = [];
  const test = (name, fn) => {
    try { fn(); resultaten.push({ name, ok: true }); }
    catch (e) { resultaten.push({ name, ok: false, error: e.message }); }
  };
  const eq = (a, b) => { if (a !== b) throw new Error(`verwacht ${b}, kreeg ${a}`); };
  const P = 3000;

  test('eigen app zonder Origin (GET) mag', () => eq(isLocalRequest({ host: 'localhost:3000' }, P), true));
  test('127.0.0.1 als Host mag', () => eq(isLocalRequest({ host: '127.0.0.1:3000' }, P), true));
  test('eigen Origin (POST/WebSocket vanuit de app) mag', () =>
    eq(isLocalRequest({ host: 'localhost:3000', origin: 'http://localhost:3000' }, P), true));
  test('Host-header is hoofdletterongevoelig', () => eq(isLocalRequest({ host: 'LocalHost:3000' }, P), true));
  test('vreemde website als Origin wordt geweigerd', () =>
    eq(isLocalRequest({ host: 'localhost:3000', origin: 'https://evil.example' }, P), false));
  test('Origin "null" (file://, sandbox-iframe) wordt geweigerd', () =>
    eq(isLocalRequest({ host: 'localhost:3000', origin: 'null' }, P), false));
  test('DNS-rebinding (vreemde Host) wordt geweigerd', () =>
    eq(isLocalRequest({ host: 'evil.example:3000' }, P), false));
  test('LAN-IP als Host wordt geweigerd', () => eq(isLocalRequest({ host: '192.168.1.20:3000' }, P), false));
  test('andere poort wordt geweigerd', () => eq(isLocalRequest({ host: 'localhost:3001' }, P), false));
  test('ontbrekende Host wordt geweigerd', () => eq(isLocalRequest({}, P), false));
  test('https-variant van eigen origin wordt geweigerd', () =>
    eq(isLocalRequest({ host: 'localhost:3000', origin: 'https://localhost:3000' }, P), false));

  const indexJs = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  test('server luistert alleen op 127.0.0.1', () => {
    if (!/server\.listen\(PORT,\s*'127\.0\.0\.1'/.test(indexJs)) throw new Error('listen zonder 127.0.0.1');
  });
  test('WebSocket controleert de herkomst (verifyClient)', () => {
    if (!/verifyClient:\s*\(info\)\s*=>\s*isLocalRequest\(/.test(indexJs)) throw new Error('verifyClient ontbreekt');
  });
  test('guard staat vóór static en /api', () => {
    const g = indexJs.indexOf('app.use(expressGuard(PORT))');
    const s = indexJs.indexOf('express.static');
    const a = indexJs.indexOf("app.use('/api'");
    if (g < 0 || g > s || g > a) throw new Error('expressGuard moet als eerste middleware staan');
  });

  // Echte HTTP-check van de middleware
  const mw = expressGuard(P);
  const server = http.createServer((req, res) => {
    const fakeRes = {
      status(c) { res.statusCode = c; return this; },
      type() { return this; },
      send(b) { res.end(b); },
    };
    mw(req, fakeRes, () => { res.statusCode = 200; res.end('ok'); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const vraag = (headers) => new Promise((ok, fout) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/stats', headers }, (res) => { res.resume(); ok(res.statusCode); });
    req.on('error', fout); req.end();
  });
  try {
    const goed = await vraag({ Host: 'localhost:3000' });
    const slecht = await vraag({ Host: 'localhost:3000', Origin: 'https://evil.example' });
    test('middleware: eigen request krijgt 200', () => eq(goed, 200));
    test('middleware: vreemde Origin krijgt 403', () => eq(slecht, 403));
  } finally {
    server.close();
  }
  return resultaten;
};
