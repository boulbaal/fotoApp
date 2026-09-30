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

  // Statisch (werkt ook als better-sqlite3 niet laadt): de bestandsnaam van de
  // database mag niet veranderen, anders opent een update een lege database.
  test('Database-bestand blijft fotos.db (bestaande installaties vinden hun data terug)', () => {
    const dbCode = fs.readFileSync(path.join(__dirname, '../src/database.js'), 'utf8');
    const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    if (!dbCode.includes("path.join(__dirname, '../data/fotos.db')")) throw new Error('standaardpad in src/database.js is niet meer data/fotos.db');
    if (!/DB_PATH\s*=\s*path\.join\(dataDir, 'fotos\.db'\)/.test(mainCode)) throw new Error('electron/main.js zet DB_PATH niet meer op fotoapp-data/fotos.db');
  });

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
    return [...resultaten, {
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

  // ─── Migratie van een database uit een versie vóór v1.0.4 (Nederlands schema) ───
  const Database = require('better-sqlite3');
  const LEGACY_DB = path.join(__dirname, 'test-legacy.db');
  const wisLegacy = () => { for (const f of [LEGACY_DB, LEGACY_DB + '-wal', LEGACY_DB + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f); };
  wisLegacy();
  {
    const old = new Database(LEGACY_DB);
    old.exec(`
      CREATE TABLE bronnen (id INTEGER PRIMARY KEY AUTOINCREMENT, naam TEXT NOT NULL, type TEXT NOT NULL, pad TEXT NOT NULL,
        icoon TEXT DEFAULT '💻', aangemaakt_op TEXT DEFAULT (datetime('now')), laatste_scan TEXT, totaal_fotos INTEGER DEFAULT 0,
        verborgen_meenemen INTEGER DEFAULT 0);
      CREATE TABLE fotos (id INTEGER PRIMARY KEY AUTOINCREMENT, bron_id INTEGER NOT NULL, bestandsnaam TEXT NOT NULL,
        volledig_pad TEXT NOT NULL, hash TEXT, bestandsgrootte INTEGER, datum_foto TEXT, jaar INTEGER, gps_lat REAL, gps_lon REAL,
        gps_stad TEXT, gps_land TEXT, gps_land_code TEXT, camera_merk TEXT, thumbnail TEXT, status TEXT DEFAULT 'nieuw',
        is_duplicaat INTEGER DEFAULT 0, duplicaat_groep TEXT, genegeerd INTEGER DEFAULT 0, geexporteerd INTEGER DEFAULT 0,
        locatie_onbekend INTEGER DEFAULT 0, duur INTEGER, is_video INTEGER DEFAULT 0,
        FOREIGN KEY (bron_id) REFERENCES bronnen(id));
      CREATE TABLE scan_log (id INTEGER PRIMARY KEY AUTOINCREMENT, bron_id INTEGER, gestart TEXT, voltooid TEXT,
        totaal INTEGER DEFAULT 0, nieuw INTEGER DEFAULT 0, overgeslagen INTEGER DEFAULT 0, fouten INTEGER DEFAULT 0, status TEXT DEFAULT 'bezig');
      CREATE TABLE instellingen (sleutel TEXT PRIMARY KEY, waarde TEXT);
      CREATE INDEX idx_fotos_hash ON fotos(hash);
      INSERT INTO bronnen (naam, type, pad, icoon, laatste_scan, totaal_fotos) VALUES ('Laptop', 'pc', '/home/x/Pictures', '💻', '2026-06-01 10:00:00', 2);
      INSERT INTO bronnen (naam, type, pad, icoon) VALUES ('Externe schijf', 'extern', '/media/usb', '🗄️');
      INSERT INTO fotos (bron_id, bestandsnaam, volledig_pad, hash, bestandsgrootte, datum_foto, jaar, gps_stad, gps_land, gps_land_code, camera_merk, genegeerd, geexporteerd, duplicaat_groep, is_duplicaat)
        VALUES (1, 'a.jpg', '/home/x/Pictures/a.jpg', 'h1', 1000, '2023-07-15T09:30:42.000Z', 2023, 'Paris', 'France', 'FR', 'Apple', 0, 1, 'h1', 1),
               (2, 'a copy.jpg', '/media/usb/a copy.jpg', 'h1', 1000, '2023-07-15T09:30:42.000Z', 2023, 'Paris', 'France', 'FR', 'Apple', 1, 0, 'h1', 1);
      INSERT INTO scan_log (bron_id, gestart, voltooid, totaal, nieuw, status) VALUES (1, '2026-06-01T09:59:00Z', '2026-06-01T10:00:00Z', 2, 2, 'voltooid');
      INSERT INTO instellingen VALUES ('fase', '2'), ('dup_bron_volgorde', '[2,1]'), ('dup_handmatig', '{"h1":2}');
    `);
    old.close();
  }

  test('Migratie: Nederlands schema van vóór v1.0.4 wordt in place hernoemd, alle data blijft', () => {
    process.env.DB_PATH = LEGACY_DB;
    initDb();
    initDb(); // idempotent: een tweede start mag niets breken
    const db = getDb();
    try {
      const tabellen = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
      for (const t of ['sources', 'photos', 'scan_log', 'settings']) if (!tabellen.includes(t)) throw new Error('tabel ontbreekt: ' + t);
      for (const t of ['bronnen', 'fotos', 'instellingen']) if (tabellen.includes(t)) throw new Error('oude tabel bestaat nog: ' + t);

      const photos = db.prepare('SELECT * FROM photos ORDER BY id').all();
      if (photos.length !== 2) throw new Error(`${photos.length} foto's na migratie, verwacht 2`);
      const p = photos[0];
      const verwacht = { source_id: 1, filename: 'a.jpg', full_path: '/home/x/Pictures/a.jpg', file_size: 1000, year: 2023,
        gps_city: 'Paris', gps_country: 'France', gps_country_code: 'FR', camera_make: 'Apple', exported: 1, ignored: 0,
        duplicate_group: 'h1', is_duplicate: 1, status: 'new_files' };
      for (const [k, v] of Object.entries(verwacht)) if (p[k] !== v) throw new Error(`photos.${k} = ${p[k]}, verwacht ${v}`);
      if (photos[1].ignored !== 1) throw new Error('genegeerd → ignored niet overgenomen');

      const src = db.prepare('SELECT * FROM sources ORDER BY id').all();
      if (src[0].name !== 'Laptop' || src[0].path !== '/home/x/Pictures' || src[0].total_photos !== 2) throw new Error('bronnen-kolommen niet correct hernoemd');
      if (src[1].type !== 'external') throw new Error(`brontype 'extern' niet gemigreerd (is ${src[1].type}) — bewerkvenster kent alleen 'external'`);

      const log = db.prepare('SELECT * FROM scan_log').get();
      if (log.status !== 'completed' || log.source_id !== 1 || log.started !== '2026-06-01T09:59:00Z') throw new Error('scan_log niet gemigreerd: ' + JSON.stringify(log));

      const settings = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));
      if (settings.phase !== '2') throw new Error('fase niet gemigreerd: ' + JSON.stringify(settings));
      if (settings.dup_source_order !== '[2,1]' || settings.dup_manual !== '{"h1":2}') throw new Error('duplicaat-prioriteit niet gemigreerd: ' + JSON.stringify(settings));
    } finally {
      db.close();
      process.env.DB_PATH = TEST_DB;
    }
  });
  wisLegacy();

  // Opruimen
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (origEnv !== undefined) process.env.DB_PATH = origEnv;
  else delete process.env.DB_PATH;

  return resultaten;
};
