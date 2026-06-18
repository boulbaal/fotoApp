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

  // Migratie: kolommen toevoegen aan bestaande databases
  const kolommen = db.prepare("PRAGMA table_info(fotos)").all().map(k => k.name);
  if (!kolommen.includes('google_description')) {
    db.exec("ALTER TABLE fotos ADD COLUMN google_description TEXT");
    console.log('✅ Migratie: google_description kolom toegevoegd');
  }
  if (!kolommen.includes('google_device_type')) {
    db.exec("ALTER TABLE fotos ADD COLUMN google_device_type TEXT");
    console.log('✅ Migratie: google_device_type kolom toegevoegd');
  }
  if (!kolommen.includes('gps_land_code')) {
    db.exec("ALTER TABLE fotos ADD COLUMN gps_land_code TEXT");
    console.log('✅ Migratie: gps_land_code kolom toegevoegd');
  }
  if (!kolommen.includes('datum_bron')) {
    db.exec("ALTER TABLE fotos ADD COLUMN datum_bron TEXT");
    console.log('✅ Migratie: datum_bron kolom toegevoegd');
  }
  if (!kolommen.includes('locatie_onbekend')) {
    db.exec("ALTER TABLE fotos ADD COLUMN locatie_onbekend INTEGER DEFAULT 0");
    console.log('✅ Migratie: locatie_onbekend kolom toegevoegd');
  }
  if (!kolommen.includes('genegeerd')) {
    db.exec("ALTER TABLE fotos ADD COLUMN genegeerd INTEGER DEFAULT 0");
    console.log('✅ Migratie: genegeerd kolom toegevoegd');
  }
  if (!kolommen.includes('geexporteerd')) {
    db.exec("ALTER TABLE fotos ADD COLUMN geexporteerd INTEGER DEFAULT 0");
    console.log('✅ Migratie: geexporteerd kolom toegevoegd');
  }
  if (!kolommen.includes('duur')) {
    db.exec("ALTER TABLE fotos ADD COLUMN duur INTEGER DEFAULT NULL");
    console.log('✅ Migratie: duur kolom toegevoegd (voor video\'s)');
  }
  if (!kolommen.includes('is_video')) {
    db.exec("ALTER TABLE fotos ADD COLUMN is_video INTEGER DEFAULT 0");
    console.log('✅ Migratie: is_video kolom toegevoegd');
  }

  // Opschoning: verweesde duplicaat-restanten herstellen.
  // Na het wissen van een duplicaatgroep kan er een enkele foto overblijven
  // die nog is_duplicaat=1 en een duplicaat_groep had. Die is geen duplicaat meer.
  const verweesd = db.prepare(`
    UPDATE fotos SET is_duplicaat = 0, duplicaat_groep = NULL
    WHERE duplicaat_groep IN (
      SELECT duplicaat_groep FROM fotos
      WHERE duplicaat_groep IS NOT NULL
      GROUP BY duplicaat_groep HAVING COUNT(*) <= 1
    )
  `).run();
  if (verweesd.changes > 0) {
    console.log(`✅ Migratie: ${verweesd.changes} verweesde duplicaat-restant(en) opgeschoond`);
  }

  // Standaard fase instellen
  db.prepare("INSERT OR IGNORE INTO instellingen (sleutel, waarde) VALUES ('fase', '1')").run();

  db.close();
  console.log('✅ Database geïnitialiseerd:', getDbPath());
}

module.exports = { getDb, initDb };
