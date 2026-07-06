// === Shared keeper logic (duplicates) ===
//
// Single source of truth for "which copy in a duplicate group do we keep?".
// Used by both the backend API (deletion/duplicates) and the export.
//
// The priority (source order + manual choices) is stored in the
// `instellingen` table, so frontend and backend make exactly the same choice.
// Previously that priority only lived in the browser (localStorage), so the
// server-side export did not know which copy was the "keeper".

const KEY_SOURCE_ORDER = 'dup_bron_volgorde';
const KEY_MANUAL       = 'dup_handmatig';

// Read the stored priority from the database.
// Always returns a valid object: { bronVolgorde: [], handmatig: {} }.
// (The property names bronVolgorde/handmatig are part of the API contract
// with the frontend — do not rename until phase B.)
function readPriority(db) {
  const sourceRow = db.prepare('SELECT waarde FROM instellingen WHERE sleutel = ?').get(KEY_SOURCE_ORDER);
  const manualRow = db.prepare('SELECT waarde FROM instellingen WHERE sleutel = ?').get(KEY_MANUAL);

  let bronVolgorde = [];
  let handmatig = {};
  try { if (sourceRow && sourceRow.waarde) bronVolgorde = JSON.parse(sourceRow.waarde); } catch (_) {}
  try { if (manualRow && manualRow.waarde) handmatig = JSON.parse(manualRow.waarde); } catch (_) {}

  if (!Array.isArray(bronVolgorde)) bronVolgorde = [];
  if (!handmatig || typeof handmatig !== 'object') handmatig = {};
  return { bronVolgorde, handmatig };
}

// Write the priority to the database. Fields that are undefined stay unchanged.
function writePriority(db, bronVolgorde, handmatig) {
  const stmt = db.prepare('INSERT OR REPLACE INTO instellingen (sleutel, waarde) VALUES (?, ?)');
  if (bronVolgorde !== undefined) {
    stmt.run(KEY_SOURCE_ORDER, JSON.stringify(Array.isArray(bronVolgorde) ? bronVolgorde : []));
  }
  if (handmatig !== undefined) {
    stmt.run(KEY_MANUAL, JSON.stringify(handmatig && typeof handmatig === 'object' ? handmatig : {}));
  }
}

// Determine which copy in a group is kept.
// Decision order:
//   1. manual choice (override) if it is part of the group
//   2. highest-ranked source that occurs in the group (tie → lowest id)
//   3. no source ranked at all:
//        - required=true  → fall back to the lowest id (export may never drop a group)
//        - required=false → null = "choice needed" (deletion waits for a choice)
//
// photos: [{ id, bron_id }], bronVolgorde: [bron_id, ...] (best first), manualId: number|undefined
function determineKeeper(photos, bronVolgorde, manualId, options) {
  const required = !options || options.required !== false; // default: always pick a keeper
  if (!photos || photos.length === 0) return null;
  if (manualId != null && photos.some(f => f.id === manualId)) return manualId;

  const order = Array.isArray(bronVolgorde) ? bronVolgorde : [];
  const rank = id => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  const ranked = photos.filter(f => rank(f.bron_id) !== Infinity);
  if (ranked.length === 0) {
    // No source ranked at all. Still decide automatically when there is nothing
    // to choose: if ALL copies come from the same source, "which source is the
    // original?" is meaningless (same place, identical content) → keep the
    // lowest id (scanned first). Only when copies are spread over multiple
    // sources does deletion really require a choice (required=false → null).
    const singleSource = photos.every(f => f.bron_id === photos[0].bron_id);
    if (required || singleSource) {
      return [...photos].sort((a, b) => a.id - b.id)[0].id; // keep the lowest id
    }
    return null; // multiple sources, no priority → deletion waits for a choice
  }
  ranked.sort((a, b) => rank(a.bron_id) - rank(b.bron_id) || a.id - b.id);
  return ranked[0].id;
}

// Compute the set of keeper ids across ALL duplicate groups.
// Used by the export to select "non-duplicates + 1 keeper per group".
// Here required=true: every group always yields exactly one keeper.
function keeperIds(db) {
  const { bronVolgorde, handmatig } = readPriority(db);
  const rows = db.prepare(
    'SELECT id, bron_id, duplicaat_groep FROM fotos WHERE duplicaat_groep IS NOT NULL'
  ).all();

  const perGroup = new Map();
  for (const r of rows) {
    if (!perGroup.has(r.duplicaat_groep)) perGroup.set(r.duplicaat_groep, []);
    perGroup.get(r.duplicaat_groep).push(r);
  }

  const ids = new Set();
  for (const [group, photos] of perGroup) {
    const k = determineKeeper(photos, bronVolgorde, handmatig[group], { required: true });
    if (k != null) ids.add(k);
  }
  return ids;
}

module.exports = {
  KEY_SOURCE_ORDER,
  KEY_MANUAL,
  readPriority,
  writePriority,
  determineKeeper,
  keeperIds
};
