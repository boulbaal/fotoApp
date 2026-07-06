const http = require('http');

const BASE = 'http://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000,
      path: path, method: 'POST',
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

  async function test(name, fn) {
    try {
      await fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
    }
  }

  await test('GET /api/sources geeft array terug', async () => {
    const r = await get('/api/sources');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body)) throw new Error('Geen array ontvangen');
  });

  await test('GET /api/stats geeft total terug', async () => {
    const r = await get('/api/stats');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (typeof r.body.total !== 'number') throw new Error('Geen total in response');
  });

  await test('GET /api/photos geeft paginering terug', async () => {
    const r = await get('/api/photos?page=1&per_page=10');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.photos)) throw new Error('Geen photos array');
    if (typeof r.body.total !== 'number') throw new Error('Geen total');
  });

  await test('GET /api/scan/status geeft status terug', async () => {
    const r = await get('/api/scan/status');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (typeof r.body.running !== 'boolean') throw new Error('Geen running veld');
  });

  await test('GET /api/duplicates geeft groups terug', async () => {
    const r = await get('/api/duplicates');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.groups)) throw new Error('Geen groups array');
  });

  await test('POST /api/sources zonder name geeft 400', async () => {
    const r = await post('/api/sources', { path: '/tmp' });
    if (r.status !== 400) throw new Error(`Verwacht 400, kreeg ${r.status}`);
  });

  await test('POST /api/scan/999 geeft 400 voor onbekende bron', async () => {
    const r = await post('/api/scan/999999', {});
    if (r.status !== 400) throw new Error(`Verwacht 400, kreeg ${r.status}`);
  });

  await test('GET /api/folders geeft folders terug', async () => {
    const r = await get('/api/folders?path=/tmp');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!Array.isArray(r.body.folders)) throw new Error('Geen folders array');
  });

  return resultaten;
};
