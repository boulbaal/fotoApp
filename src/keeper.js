// === Shared keeper logic (duplicates) ===
//
// Single source of truth for "which copy in a duplicate group do we keep?".
// Used by both the backend API (deletion/duplicates) and the export.
//
// The priority (source order + manual choices) is stored in the
// `settings` table, so frontend and backend make exactly the same choice.
// Previously that priority only lived in the browser (localStorage), so the
// server-side export did not know which copy was the "keeper".

const KEY_SOURCE_ORDER = 'dup_source_order';
const KEY_MANUAL       = 'dup_manual';

// Read the stored priority from the database.
// Always returns a valid object: { sourceOrder: [], manual: {} }.
// (The property names sourceOrder/manual are part of the API contract
// with the frontend — do not rename until phase B.)
function readPriority(db) {
  const sourceRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY_SOURCE_ORDER);
  const manualRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY_MANUAL);

  let sourceOrder = [];
  let manual = {};
  try { if (sourceRow && sourceRow.value) sourceOrder = JSON.parse(sourceRow.value); } catch (_) {}
  try { if (manualRow && manualRow.value) manual = JSON.parse(manualRow.value); } catch (_) {}

  if (!Array.isArray(sourceOrder)) sourceOrder = [];
  if (!manual || typeof manual !== 'object') manual = {};
  return { sourceOrder, manual };
}

// Write the priority to the database. Fields that are undefined stay unchanged.
function writePriority(db, sourceOrder, manual) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (sourceOrder !== undefined) {
    stmt.run(KEY_SOURCE_ORDER, JSON.stringify(Array.isArray(sourceOrder) ? sourceOrder : []));
  }
  if (manual !== undefined) {
    stmt.run(KEY_MANUAL, JSON.stringify(manual && typeof manual === 'object' ? manual : {}));
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
// photos: [{ id, source_id }], sourceOrder: [source_id, ...] (best first), manualId: number|undefined
function determineKeeper(photos, sourceOrder, manualId, options) {
  const required = !options || options.required !== false; // default: always pick a keeper
  if (!photos || photos.length === 0) return null;
  if (manualId != null && photos.some(f => f.id === manualId)) return manualId;

  const order = Array.isArray(sourceOrder) ? sourceOrder : [];
  const rank = id => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  const ranked = photos.filter(f => rank(f.source_id) !== Infinity);
  if (ranked.length === 0) {
    // No source ranked at all. Still decide automatically when there is nothing
    // to choose: if ALL copies come from the same source, "which source is the
    // original?" is meaningless (same place, identical content) → keep the
    // lowest id (scanned first). Only when copies are spread over multiple
    // sources does deletion really require a choice (required=false → null).
    const singleSource = photos.every(f => f.source_id === photos[0].source_id);
    if (required || singleSource) {
      return [...photos].sort((a, b) => a.id - b.id)[0].id; // keep the lowest id
    }
    return null; // multiple sources, no priority → deletion waits for a choice
  }
  ranked.sort((a, b) => rank(a.source_id) - rank(b.source_id) || a.id - b.id);
  return ranked[0].id;
}

// Compute the set of keeper ids across ALL duplicate groups.
// Used by the export to select "non-duplicates + 1 keeper per group".
// Here required=true: every group always yields exactly one keeper.
function keeperIds(db) {
  const { sourceOrder, manual } = readPriority(db);
  const rows = db.prepare(
    'SELECT id, source_id, duplicate_group FROM photos WHERE duplicate_group IS NOT NULL'
  ).all();

  const perGroup = new Map();
  for (const r of rows) {
    if (!perGroup.has(r.duplicate_group)) perGroup.set(r.duplicate_group, []);
    perGroup.get(r.duplicate_group).push(r);
  }

  const ids = new Set();
  for (const [group, photos] of perGroup) {
    const k = determineKeeper(photos, sourceOrder, manual[group], { required: true });
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
