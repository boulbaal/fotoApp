const Database = require('better-sqlite3');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../data/photos.db');

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

// Migration (v1.0.4): rename the original Dutch schema to English.
// Databases created before v1.0.4 have Dutch table and column names
// (bronnen/fotos/instellingen, bestandsnaam, datum_foto, ...). Rename them
// in place so existing users keep all their data. Idempotent: runs only
// when a Dutch name is found, inside a single transaction.
function migrateDutchSchema(db) {
  const tableNames = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  let tables = tableNames();
  const hadDutch = tables.includes('fotos') || tables.includes('bronnen') || tables.includes('instellingen');

  const tableRenames = [
    ['bronnen', 'sources'],
    ['fotos', 'photos'],
    ['instellingen', 'settings'],
  ];

  const columnRenames = {
    sources: {
      naam: 'name', pad: 'path', icoon: 'icon', aangemaakt_op: 'created_at',
      laatste_scan: 'last_scan', totaal_fotos: 'total_photos', verborgen_meenemen: 'include_hidden',
    },
    photos: {
      bron_id: 'source_id', bestandsnaam: 'filename', volledig_pad: 'full_path',
      bestandsgrootte: 'file_size', bestandstype: 'file_type',
      datum_foto: 'photo_date', datum_bestand: 'file_date', datum_bron: 'date_source',
      jaar: 'year', maand: 'month', dag: 'day',
      gps_adres: 'gps_address', gps_stad: 'gps_city', gps_land: 'gps_country', gps_land_code: 'gps_country_code',
      camera_merk: 'camera_make', breedte: 'width', hoogte: 'height', orientatie: 'orientation',
      sluitertijd: 'shutter_speed', diafragma: 'aperture', brandpuntsafstand: 'focal_length',
      flits: 'flash', kleurruimte: 'color_space',
      is_duplicaat: 'is_duplicate', duplicaat_groep: 'duplicate_group', is_origineel: 'is_original',
      aangemaakt_op: 'created_at', locatie_onbekend: 'location_unknown',
      genegeerd: 'ignored', geexporteerd: 'exported', duur: 'duration',
    },
    scan_log: {
      bron_id: 'source_id', gestart: 'started', voltooid: 'completed',
      totaal: 'total', nieuw: 'new_files', overgeslagen: 'skipped', fouten: 'errors',
    },
    settings: { sleutel: 'key', waarde: 'value' },
  };

  const run = db.transaction(() => {
    // 1) Tables (ALTER TABLE ... RENAME TO also updates indexes/triggers)
    for (const [oldName, newName] of tableRenames) {
      if (tables.includes(oldName) && !tables.includes(newName)) {
        db.exec(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
        console.log(`✅ Migration: table ${oldName} → ${newName}`);
      }
    }
    tables = tableNames();

    // 2) Columns (RENAME COLUMN requires SQLite ≥ 3.25, bundled with better-sqlite3)
    for (const [table, map] of Object.entries(columnRenames)) {
      if (!tables.includes(table)) continue;
      const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
      for (const [oldCol, newCol] of Object.entries(map)) {
        if (cols.includes(oldCol) && !cols.includes(newCol)) {
          db.exec(`ALTER TABLE "${table}" RENAME COLUMN "${oldCol}" TO "${newCol}"`);
          console.log(`✅ Migration: column ${table}.${oldCol} → ${newCol}`);
        }
      }
    }

    // 3) Stored Dutch values → English equivalents
    if (tables.includes('scan_log')) {
      db.exec(`
        UPDATE scan_log SET status='running'   WHERE status='bezig';
        UPDATE scan_log SET status='completed' WHERE status='voltooid';
        UPDATE scan_log SET status='stopped'   WHERE status='gestopt';
        UPDATE scan_log SET status='error'     WHERE status IN ('fout','mislukt');
      `);
    }
    if (tables.includes('photos')) {
      db.exec("UPDATE photos SET status='new_files' WHERE status='nieuw'");
    }
    if (tables.includes('settings')) {
      db.exec(`
        UPDATE settings SET key='phase'            WHERE key='fase'              AND NOT EXISTS (SELECT 1 FROM settings WHERE key='phase');
        UPDATE settings SET key='dup_source_order' WHERE key='dup_bron_volgorde' AND NOT EXISTS (SELECT 1 FROM settings WHERE key='dup_source_order');
        UPDATE settings SET key='dup_manual'       WHERE key='dup_handmatig'     AND NOT EXISTS (SELECT 1 FROM settings WHERE key='dup_manual');
      `);
    }
  });
  run();

  if (hadDutch) console.log('✅ Migration: Dutch schema renamed to English (all data kept)');
}

function initDb() {
  const db = getDb();

  migrateDutchSchema(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      icon TEXT DEFAULT '💻',
      created_at TEXT DEFAULT (datetime('now')),
      last_scan TEXT,
      total_photos INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      full_path TEXT NOT NULL,
      hash TEXT,
      file_size INTEGER,
      file_type TEXT,

      photo_date TEXT,
      file_date TEXT,
      year INTEGER,
      month INTEGER,
      day INTEGER,

      gps_lat REAL,
      gps_lon REAL,
      gps_address TEXT,
      gps_city TEXT,
      gps_country TEXT,

      camera_make TEXT,
      camera_model TEXT,
      lens TEXT,
      software TEXT,

      width INTEGER,
      height INTEGER,
      orientation INTEGER,
      iso INTEGER,
      shutter_speed TEXT,
      aperture TEXT,
      focal_length TEXT,
      flash TEXT,
      color_space TEXT,

      thumbnail TEXT,

      google_description TEXT,
      google_device_type TEXT,

      status TEXT DEFAULT 'new_files',
      is_duplicate INTEGER DEFAULT 0,
      duplicate_group TEXT,

      created_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER,
      started TEXT,
      completed TEXT,
      total INTEGER DEFAULT 0,
      new_files INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fotos_hash ON photos(hash);
    CREATE INDEX IF NOT EXISTS idx_fotos_bron ON photos(source_id);
    CREATE INDEX IF NOT EXISTS idx_fotos_datum ON photos(photo_date);
    CREATE INDEX IF NOT EXISTS idx_fotos_duplicaat ON photos(duplicate_group);
  `);

  // Migration: add columns to existing databases
  const columns = db.prepare("PRAGMA table_info(photos)").all().map(k => k.name);
  if (!columns.includes('google_description')) {
    db.exec("ALTER TABLE photos ADD COLUMN google_description TEXT");
    console.log('✅ Migration: google_description column added');
  }
  if (!columns.includes('google_device_type')) {
    db.exec("ALTER TABLE photos ADD COLUMN google_device_type TEXT");
    console.log('✅ Migration: google_device_type column added');
  }
  if (!columns.includes('gps_country_code')) {
    db.exec("ALTER TABLE photos ADD COLUMN gps_country_code TEXT");
    console.log('✅ Migration: gps_country_code column added');
  }
  if (!columns.includes('date_source')) {
    db.exec("ALTER TABLE photos ADD COLUMN date_source TEXT");
    console.log('✅ Migration: date_source column added');
  }
  if (!columns.includes('location_unknown')) {
    db.exec("ALTER TABLE photos ADD COLUMN location_unknown INTEGER DEFAULT 0");
    console.log('✅ Migration: location_unknown column added');
  }
  if (!columns.includes('ignored')) {
    db.exec("ALTER TABLE photos ADD COLUMN ignored INTEGER DEFAULT 0");
    console.log('✅ Migration: ignored column added');
  }
  if (!columns.includes('exported')) {
    db.exec("ALTER TABLE photos ADD COLUMN exported INTEGER DEFAULT 0");
    console.log('✅ Migration: exported column added');
  }
  if (!columns.includes('duration')) {
    db.exec("ALTER TABLE photos ADD COLUMN duration INTEGER DEFAULT NULL");
    console.log('✅ Migration: duration column added (for videos)');
  }
  if (!columns.includes('is_video')) {
    db.exec("ALTER TABLE photos ADD COLUMN is_video INTEGER DEFAULT 0");
    console.log('✅ Migration: is_video column added');
  }

  // Migration: per-source setting whether hidden folders (name starts with '.')
  // are scanned too. Default 0 = skip (app/system files, no photos).
  const sourceColumns = db.prepare("PRAGMA table_info(sources)").all().map(k => k.name);
  if (!sourceColumns.includes('include_hidden')) {
    db.exec("ALTER TABLE sources ADD COLUMN include_hidden INTEGER DEFAULT 0");
    console.log('✅ Migration: include_hidden column added to sources');
  }

  // Composite index for fast sorted pagination: the gallery filters on
  // is_video and sorts on photo_date. Also makes deep paging (last page,
  // large OFFSET) fast.
  db.exec("CREATE INDEX IF NOT EXISTS idx_fotos_video_datum ON photos(is_video, photo_date)");

  // Cleanup: repair orphaned duplicate leftovers.
  // After wiping a duplicate group a single photo may remain that still has
  // is_duplicate=1 and a duplicate_group. It is no longer a duplicate.
  // (verweesde duplicaat-restanten)
  const orphaned = db.prepare(`
    UPDATE photos SET is_duplicate = 0, duplicate_group = NULL
    WHERE duplicate_group IN (
      SELECT duplicate_group FROM photos
      WHERE duplicate_group IS NOT NULL
      GROUP BY duplicate_group HAVING COUNT(*) <= 1
    )
  `).run();
  if (orphaned.changes > 0) {
    console.log(`✅ Migration: cleaned up ${orphaned.changes} orphaned duplicate leftover(s)`);
  }

  // Set default phase
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('phase', '1')").run();

  db.close();
  console.log('✅ Database initialized:', getDbPath());
}

module.exports = { getDb, getSharedDb, initDb };
