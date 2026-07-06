const Database = require('better-sqlite3');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../data/fotos.db');

function getDbPath() {
  return process.env.DB_PATH || DEFAULT_DB_PATH;
}

function getDb() {
  const db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// One shared, long-lived connection for high-frequency reads (such as the
// thumbnail endpoint, which is called ~50 times per page). Opening a fresh
// connection every time blocked the synchronous better-sqlite3 event loop and
// froze the app while browsing quickly. WAL ensures this reader always sees
// the most recently written data. Never close it.
let sharedDb = null;
function getSharedDb() {
  if (!sharedDb || !sharedDb.open) {
    sharedDb = new Database(getDbPath());
    sharedDb.pragma('journal_mode = WAL');
    sharedDb.pragma('foreign_keys = ON');
    sharedDb.pragma('busy_timeout = 5000');
  }
  return sharedDb;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS bronnen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      type TEXT NOT NULL,
      pad TEXT NOT NULL,
      icoon TEXT DEFAULT '💻',
      aangemaakt_op TEXT DEFAULT (datetime('now')),
      laatste_scan TEXT,
      totaal_fotos INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bron_id INTEGER NOT NULL,
      bestandsnaam TEXT NOT NULL,
      volledig_pad TEXT NOT NULL,
      hash TEXT,
      bestandsgrootte INTEGER,
      bestandstype TEXT,

      datum_foto TEXT,
      datum_bestand TEXT,
      jaar INTEGER,
      maand INTEGER,
      dag INTEGER,

      gps_lat REAL,
      gps_lon REAL,
      gps_adres TEXT,
      gps_stad TEXT,
      gps_land TEXT,

      camera_merk TEXT,
      camera_model TEXT,
      lens TEXT,
      software TEXT,

      breedte INTEGER,
      hoogte INTEGER,
      orientatie INTEGER,
      iso INTEGER,
      sluitertijd TEXT,
      diafragma TEXT,
      brandpuntsafstand TEXT,
      flits TEXT,
      kleurruimte TEXT,

      thumbnail TEXT,

      google_description TEXT,
      google_device_type TEXT,

      status TEXT DEFAULT 'nieuw',
      is_duplicaat INTEGER DEFAULT 0,
      duplicaat_groep TEXT,

      aangemaakt_op TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (bron_id) REFERENCES bronnen(id)
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bron_id INTEGER,
      gestart TEXT,
      voltooid TEXT,
      totaal INTEGER DEFAULT 0,
      nieuw INTEGER DEFAULT 0,
      overgeslagen INTEGER DEFAULT 0,
      fouten INTEGER DEFAULT 0,
      status TEXT DEFAULT 'bezig'
    );

    CREATE TABLE IF NOT EXISTS instellingen (
      sleutel TEXT PRIMARY KEY,
      waarde TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fotos_hash ON fotos(hash);
    CREATE INDEX IF NOT EXISTS idx_fotos_bron ON fotos(bron_id);
    CREATE INDEX IF NOT EXISTS idx_fotos_datum ON fotos(datum_foto);
    CREATE INDEX IF NOT EXISTS idx_fotos_duplicaat ON fotos(duplicaat_groep);
  `);

  // Migration: add columns to existing databases
  const columns = db.prepare("PRAGMA table_info(fotos)").all().map(k => k.name);
  if (!columns.includes('google_description')) {
    db.exec("ALTER TABLE fotos ADD COLUMN google_description TEXT");
    console.log('✅ Migration: google_description column added');
  }
  if (!columns.includes('google_device_type')) {
    db.exec("ALTER TABLE fotos ADD COLUMN google_device_type TEXT");
    console.log('✅ Migration: google_device_type column added');
  }
  if (!columns.includes('gps_land_code')) {
    db.exec("ALTER TABLE fotos ADD COLUMN gps_land_code TEXT");
    console.log('✅ Migration: gps_land_code column added');
  }
  if (!columns.includes('datum_bron')) {
    db.exec("ALTER TABLE fotos ADD COLUMN datum_bron TEXT");
    console.log('✅ Migration: datum_bron column added');
  }
  if (!columns.includes('locatie_onbekend')) {
    db.exec("ALTER TABLE fotos ADD COLUMN locatie_onbekend INTEGER DEFAULT 0");
    console.log('✅ Migration: locatie_onbekend column added');
  }
  if (!columns.includes('genegeerd')) {
    db.exec("ALTER TABLE fotos ADD COLUMN genegeerd INTEGER DEFAULT 0");
    console.log('✅ Migration: genegeerd column added');
  }
  if (!columns.includes('geexporteerd')) {
    db.exec("ALTER TABLE fotos ADD COLUMN geexporteerd INTEGER DEFAULT 0");
    console.log('✅ Migration: geexporteerd column added');
  }
  if (!columns.includes('duur')) {
    db.exec("ALTER TABLE fotos ADD COLUMN duur INTEGER DEFAULT NULL");
    console.log('✅ Migration: duur column added (for videos)');
  }
  if (!columns.includes('is_video')) {
    db.exec("ALTER TABLE fotos ADD COLUMN is_video INTEGER DEFAULT 0");
    console.log('✅ Migration: is_video column added');
  }

  // Migration: per-source setting whether hidden folders (name starts with '.')
  // are scanned too. Default 0 = skip (app/system files, no photos).
  const sourceColumns = db.prepare("PRAGMA table_info(bronnen)").all().map(k => k.name);
  if (!sourceColumns.includes('verborgen_meenemen')) {
    db.exec("ALTER TABLE bronnen ADD COLUMN verborgen_meenemen INTEGER DEFAULT 0");
    console.log('✅ Migration: verborgen_meenemen column added to bronnen');
  }

  // Composite index for fast sorted pagination: the gallery filters on
  // is_video and sorts on datum_foto. Also makes deep paging (last page,
  // large OFFSET) fast.
  db.exec("CREATE INDEX IF NOT EXISTS idx_fotos_video_datum ON fotos(is_video, datum_foto)");

  // Cleanup: repair orphaned duplicate leftovers.
  // After wiping a duplicate group a single photo may remain that still has
  // is_duplicaat=1 and a duplicaat_groep. It is no longer a duplicate.
  // (verweesde duplicaat-restanten)
  const orphaned = db.prepare(`
    UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL
    WHERE duplicaat_groep IN (
      SELECT duplicaat_groep FROM fotos
      WHERE duplicaat_groep IS NOT NULL
      GROUP BY duplicaat_groep HAVING COUNT(*) <= 1
    )
  `).run();
  if (orphaned.changes > 0) {
    console.log(`✅ Migration: cleaned up ${orphaned.changes} orphaned duplicate leftover(s)`);
  }

  // Set default phase
  db.prepare("INSERT OR IGNORE INTO instellingen (sleutel, waarde) VALUES ('fase', '1')").run();

  db.close();
  console.log('✅ Database initialized:', getDbPath());
}

module.exports = { getDb, getSharedDb, initDb };
