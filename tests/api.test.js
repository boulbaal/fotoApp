const http = require('http');

const BASE = 'http://localhost:3000';

function get(pad) {
  return new Promise((resolve, reject) => {
    http.get(BASE + pad, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

function post(pad, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000,
      path: pad, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function testApi() {
  const resultaten = [];

  async function test(naam, fn) {
    try {
      await fn();
      resultaten.push({ naam, ok: true });
    } catch (e) {
      resultaten.push({ naam, ok: false, fout: e.message });
    }
  }

  await test('GET /api/bronnen geeft array terug', async () => {
    const r = await get('/api/bronnen');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body)) throw new Error('Geen array ontvangen');
  });

  await test('GET /api/stats geeft totaal terug', async () => {
    const r = await get('/api/stats');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (typeof r.body.totaal !== 'number') throw new Error('Geen totaal in response');
  });

  await test('GET /api/fotos geeft paginering terug', async () => {
    const r = await get('/api/fotos?pagina=1&per_pagina=10');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.fotos)) throw new Error('Geen fotos array');
    if (typeof r.body.totaal !== 'number') throw new Error('Geen totaal');
  });

  await test('GET /api/scan/status geeft status terug', async () => {
    const r = await get('/api/scan/status');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (typeof r.body.bezig !== 'boolean') throw new Error('Geen bezig veld');
  });

  await test('GET /api/duplicaten geeft groepen terug', async () => {
    const r = await get('/api/duplicaten');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.groepen)) throw new Error('Geen groepen array');
  });

  await test('POST /api/bronnen zonder naam geeft 400', async () => {
    const r = await post('/api/bronnen', { pad: '/tmp' });
    if (r.status !== 400) throw new Error(`Verwacht 400, kreeg ${r.status}`);
  });

  await test('POST /api/scan/999 geeft 400 voor onbekende bron', async () => {
    const r = await post('/api/scan/999999', {});
    if (r.status !== 400) throw new Error(`Verwacht 400, kreeg ${r.status}`);
  });

  await test('GET /api/mappen geeft mappen terug', async () => {
    const r = await get('/api/mappen?pad=/tmp');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.mappen)) throw new Error('Geen mappen array');
  });

  return resultaten;
};
