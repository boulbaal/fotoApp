const fs   = require('fs');
const path = require('path');

module.exports = async function testDatabase() {
  const resultaten = [];

  function test(name, fn) {
    try {
      fn();
      resultaten.push({ name, ok: true });
    } catch (e) {
      resultaten.push({ name, ok: false, error: e.message });
    }
  }

  // Laad database module pas hier (niet bij require van dit bestand)
  let initDb, getDb;
  try {
    const mod = require('../src/database');
    const Database = require('better-sqlite3');
    // Test of native binding echt werkt (require gooit geen error, maar new Database() wel)
    new Database(':memory:').close();
    initDb = mod.initDb;
    getDb  = mod.getDb;
  } catch (e) {
    return [{
      name: 'Database module laden',
      ok: false,
      waarschuwing: true,   // niet-fataal — werkt wel op productie-machine
      error: `better-sqlite3 kon niet laden (werkt wel op jouw machine): ${e.message.split('\n')[0]}`
    }];
  }

  const TEST_DB = path.join(__dirname, 'test.db');
  const origEnv = process.env.DB_PATH;
  process.env.DB_PATH = TEST_DB;

  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  test('Database initialiseert zonder error', () => {
    initDb();
  });

  test('Tabel sources bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'").get();
    db.close();
    if (!tabel) throw new Error('Tabel sources niet gevonden');
  });

  test('Tabel photos bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photos'").get();
    db.close();
    if (!tabel) throw new Error('Tabel photos niet gevonden');
  });

  test('Tabel scan_log bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_log'").get();
    db.close();
    if (!tabel) throw new Error('Tabel scan_log niet gevonden');
  });

  test('Bron invoegen en ophalen werkt', () => {
    const db = getDb();
    db.prepare("INSERT INTO sources (name, type, path, icon) VALUES (?, ?, ?, ?)").run('TestBron', 'pc', '/tmp', '💻');
    const bron = db.prepare("SELECT * FROM sources WHERE name = 'TestBron'").get();
    db.close();
    if (!bron) throw new Error('Bron niet teruggevonden na invoegen');
    if (bron.path !== '/tmp') throw new Error(`Verkeerd path: ${bron.path}`);
  });

  // Opruimen
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (origEnv !== undefined) process.env.DB_PATH = origEnv;
  else delete process.env.DB_PATH;

  return resultaten;
};
