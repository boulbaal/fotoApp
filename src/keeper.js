// === Gedeelde keeper-logica (duplicaten) ===
//
// Eén bron van waarheid voor "welk exemplaar in een duplicaatgroep behouden we?".
// Wordt gebruikt door zowel de backend-API (wissen/duplicaten) als de export.
//
// De prioriteit (bron-volgorde + handmatige keuzes) wordt opgeslagen in de
// `instellingen`-tabel, zodat frontend én backend exact dezelfde keuze maken.
// Voorheen leefde die prioriteit alleen in de browser (localStorage), waardoor
// de server-side export niet wist welk exemplaar de "keeper" was.

const SLEUTEL_BRON_VOLGORDE = 'dup_bron_volgorde';
const SLEUTEL_HANDMATIG     = 'dup_handmatig';

// Lees de opgeslagen prioriteit uit de database.
// Geeft altijd een geldig object terug: { bronVolgorde: [], handmatig: {} }.
function leesPrioriteit(db) {
  const bronRij = db.prepare('SELECT waarde FROM instellingen WHERE sleutel = ?').get(SLEUTEL_BRON_VOLGORDE);
  const handRij = db.prepare('SELECT waarde FROM instellingen WHERE sleutel = ?').get(SLEUTEL_HANDMATIG);

  let bronVolgorde = [];
  let handmatig = {};
  try { if (bronRij && bronRij.waarde) bronVolgorde = JSON.parse(bronRij.waarde); } catch (_) {}
  try { if (handRij && handRij.waarde) handmatig = JSON.parse(handRij.waarde); } catch (_) {}

  if (!Array.isArray(bronVolgorde)) bronVolgorde = [];
  if (!handmatig || typeof handmatig !== 'object') handmatig = {};
  return { bronVolgorde, handmatig };
}

// Schrijf de prioriteit naar de database. Velden die undefined zijn blijven ongewijzigd.
function schrijfPrioriteit(db, bronVolgorde, handmatig) {
  const stmt = db.prepare('INSERT OR REPLACE INTO instellingen (sleutel, waarde) VALUES (?, ?)');
  if (bronVolgorde !== undefined) {
    stmt.run(SLEUTEL_BRON_VOLGORDE, JSON.stringify(Array.isArray(bronVolgorde) ? bronVolgorde : []));
  }
  if (handmatig !== undefined) {
    stmt.run(SLEUTEL_HANDMATIG, JSON.stringify(handmatig && typeof handmatig === 'object' ? handmatig : {}));
  }
}

// Bepaal welk exemplaar in een groep behouden wordt.
// Volgorde van beslissen:
//   1. handmatige keuze (override) als die in de groep zit
//   2. hoogst gerangschikte bron die in de groep voorkomt (gelijkspel → laagste id)
//   3. geen enkele bron gerangschikt:
//        - verplicht=true  → val terug op de laagste id (export mag nooit een groep droppen)
//        - verplicht=false → null = "keuze nodig" (wissen wacht op een keuze)
//
// fotos: [{ id, bron_id }], bronVolgorde: [bron_id, ...] (beste eerst), handmatigId: number|undefined
function bepaalKeeper(fotos, bronVolgorde, handmatigId, opties) {
  const verplicht = !opties || opties.verplicht !== false; // standaard: altijd een keeper kiezen
  if (!fotos || fotos.length === 0) return null;
  if (handmatigId != null && fotos.some(f => f.id === handmatigId)) return handmatigId;

  const volgorde = Array.isArray(bronVolgorde) ? bronVolgorde : [];
  const rang = id => {
    const i = volgorde.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  const gerangschikt = fotos.filter(f => rang(f.bron_id) !== Infinity);
  if (gerangschikt.length === 0) {
    // Geen enkele bron gerangschikt. Toch automatisch beslissen wanneer er niets
    // te kiezen valt: komen álle kopieën uit dezelfde bron, dan is "welke bron is
    // het origineel?" betekenisloos (zelfde plek, identieke inhoud) → behoud het
    // laagste id (eerst gescand). Alleen bij kopieën verspreid over meerdere
    // bronnen blijft het bij wissen écht een keuze (verplicht=false → null).
    const eenBron = fotos.every(f => f.bron_id === fotos[0].bron_id);
    if (verplicht || eenBron) {
      return [...fotos].sort((a, b) => a.id - b.id)[0].id; // laagste id behouden
    }
    return null; // meerdere bronnen, geen prioriteit → wissen wacht op een keuze
  }
  gerangschikt.sort((a, b) => rang(a.bron_id) - rang(b.bron_id) || a.id - b.id);
  return gerangschikt[0].id;
}

// Bereken de set van keeper-id's over ALLE duplicaatgroepen heen.
// Gebruikt door de export om "niet-duplicaten + 1 keeper per groep" te selecteren.
// Hier is verplicht=true: elke groep levert altijd precies één keeper op.
function keeperIds(db) {
  const { bronVolgorde, handmatig } = leesPrioriteit(db);
  const rijen = db.prepare(
    'SELECT id, bron_id, duplicaat_groep FROM fotos WHERE duplicaat_groep IS NOT NULL'
  ).all();

  const perGroep = new Map();
  for (const r of rijen) {
    if (!perGroep.has(r.duplicaat_groep)) perGroep.set(r.duplicaat_groep, []);
    perGroep.get(r.duplicaat_groep).push(r);
  }

  const ids = new Set();
  for (const [groep, fotos] of perGroep) {
    const k = bepaalKeeper(fotos, bronVolgorde, handmatig[groep], { verplicht: true });
    if (k != null) ids.add(k);
  }
  return ids;
}

module.exports = {
  SLEUTEL_BRON_VOLGORDE,
  SLEUTEL_HANDMATIG,
  leesPrioriteit,
  schrijfPrioriteit,
  bepaalKeeper,
  keeperIds
};
