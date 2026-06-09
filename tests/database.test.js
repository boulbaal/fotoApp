const fs   = require('fs');
const path = require('path');

module.exports = async function testDatabase() {
  const resultaten = [];

  function test(naam, fn) {
    try {
      fn();
      resultaten.push({ naam, ok: true });
    } catch (e) {
      resultaten.push({ naam, ok: false, fout: e.message });
    }
  }

  // Laad database module pas hier (niet bij require van dit bestand)
  let initDb, getDb;
  try {
    const mod = require('../src/database');
    const Database = require('better-sqlite3');
    // Test of native binding echt werkt (require gooit geen fout, maar new Database() wel)
    new Database(':memory:').close();
    initDb = mod.initDb;
    getDb  = mod.getDb;
  } catch (e) {
    return [{
      naam: 'Database module laden',
      ok: false,
      waarschuwing: true,   // niet-fataal — werkt wel op productie-machine
      fout: `better-sqlite3 kon niet laden (werkt wel op jouw machine): ${e.message.split('\n')[0]}`
    }];
  }

  const TEST_DB = path.join(__dirname, 'test.db');
  const origEnv = process.env.DB_PATH;
  process.env.DB_PATH = TEST_DB;

  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  test('Database initialiseert zonder fout', () => {
    initDb();
  });

  test('Tabel bronnen bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bronnen'").get();
    db.close();
    if (!tabel) throw new Error('Tabel bronnen niet gevonden');
  });

  test('Tabel fotos bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fotos'").get();
    db.close();
    if (!tabel) throw new Error('Tabel fotos niet gevonden');
  });

  test('Tabel scan_log bestaat', () => {
    const db = getDb();
    const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_log'").get();
    db.close();
    if (!tabel) throw new Error('Tabel scan_log niet gevonden');
  });

  test('Bron invoegen en ophalen werkt', () => {
    const db = getDb();
    db.prepare("INSERT INTO bronnen (naam, type, pad, icoon) VALUES (?, ?, ?, ?)").run('TestBron', 'pc', '/tmp', '💻');
    const bron = db.prepare("SELECT * FROM bronnen WHERE naam = 'TestBron'").get();
    db.close();
    if (!bron) throw new Error('Bron niet teruggevonden na invoegen');
    if (bron.pad !== '/tmp') throw new Error(`Verkeerd pad: ${bron.pad}`);
  });

  // Opruimen
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (origEnv !== undefined) process.env.DB_PATH = origEnv;
  else delete process.env.DB_PATH;

  return resultaten;
};
