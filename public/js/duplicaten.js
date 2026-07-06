// === DUPLICATEN: opruimen op basis van bron-priority ===
//
// De priority (bron-volgorde + manual keuzes) is server-side opgeslagen in
// de database (zie /api/duplicates/priority), zodat de backend-export exact
// hetzelfde "behouden exemplaar" kiest als de UI. localStorage dient nog als
// synchrone cache zodat het renderen zonder await kan blijven werken.

function getSourceOrder() {
  try { return JSON.parse(localStorage.getItem('dupSourceOrder') || '[]'); }
  catch { return []; }
}
function setBronVolgorde(v) {
  localStorage.setItem('dupSourceOrder', JSON.stringify(v));
  bewaarPrioOpServer({ sourceOrder: v });
}

function getManual() {
  try { return JSON.parse(localStorage.getItem('dupManual') || '{}'); }
  catch { return {}; }
}
function setHandmatig(h) {
  localStorage.setItem('dupManual', JSON.stringify(h));
  bewaarPrioOpServer({ manual: h });
}

// Schrijf priority naar de server (bron van waarheid, gedeeld met export).
function bewaarPrioOpServer(payload) {
  return fetch('/api/duplicates/priority', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {}); // offline/error: localStorage blijft als fallback werken
}

// Haal de opgeslagen priority van de server en spiegel ze naar localStorage,
// zodat de synchrone render-functies (bepaalOrigineelClient) de juiste keuze maken.
async function syncPrioVanServer() {
  try {
    const p = await fetch('/api/duplicates/priority').then(r => r.json());
    if (Array.isArray(p.sourceOrder)) localStorage.setItem('dupSourceOrder', JSON.stringify(p.sourceOrder));
    if (p.manual && typeof p.manual === 'object') localStorage.setItem('dupManual', JSON.stringify(p.manual));
  } catch (_) { /* server onbereikbaar: localStorage-cache gebruiken */ }
}

// Bepaal het origineel (= behouden) exemplaar binnen een group.
// Spiegelt exact de backend-logica in bepaalOrigineel().
function bepaalOrigineelClient(photos, group) {
  const volgorde = getSourceOrder();
  const manualId = getManual()[group];
  if (manualId != null && photos.some(f => f.id === manualId)) return manualId;
  const rang = id => { const i = volgorde.indexOf(id); return i === -1 ? Infinity : i; };
  const gerangschikt = photos.filter(f => rang(f.source_id) !== Infinity);
  if (gerangschikt.length === 0) {
    // Alle kopieën uit dezelfde bron → niets te kiezen, behoud laagste id.
    // Meerdere sources zonder priority → keuze nodig (null). Spiegelt bepaalKeeper().
    const eenBron = photos.every(f => f.source_id === photos[0].source_id);
    if (eenBron) return photos.slice().sort((a, b) => a.id - b.id)[0].id;
    return null;
  }
  gerangschikt.sort((a, b) => rang(a.source_id) - rang(b.source_id) || a.id - b.id);
  return gerangschikt[0].id;
}

async function laadDuplicaten(page = 1) {
  await syncPrioVanServer(); // server-priority naar lokale cache vóór render
  const data = await fetch(`/api/duplicates?page=${page}&per_page=10`).then(r => r.json());

  const t = (k, fallback) => (window.i18n ? window.i18n.t(k) : fallback) || fallback;
  document.getElementById('dupInfo').textContent =
    `${data.totaal_groepen.toLocaleString()} ${t('dup_groepen', 'groups met duplicates')}`;

  const lijst = document.getElementById('duplicatenLijst');
  if (data.groups.length === 0) {
    lijst.innerHTML = `<div class="leeg">${t('dup_geen', 'No duplicates found.')}</div>`;
    document.getElementById('dupPaginering').innerHTML = '';
    return;
  }

  lijst.innerHTML = data.groups.map(g => {
    const keeperId = bepaalOrigineelClient(g.photos, g.duplicate_group);
    const choiceNeeded = keeperId == null;

    const kop = choiceNeeded
      ? `<h4 class="dup-keuze-nodig">⚠️ ${g.count}× ${t('dup_keuze_nodig', 'the same file — choose which copy to keep')}</h4>`
      : `<h4>📋 ${g.count}× ${t('dup_zelfde', 'the same file')} · ${formatDatum(g.date)}</h4>`;

    const fotosHtml = g.photos.map(f => {
      const isKeeper = f.id === keeperId;
      const badge = isKeeper
        ? `<div class="dup-badge dup-badge-origineel">★ ${t('dup_origineel', 'KEEP')}</div>`
        : (choiceNeeded ? '' : `<div class="dup-badge dup-badge-kopie">${t('dup_kopie', 'COPY')}</div>`);
      return `
        <div class="dup-foto ${isKeeper ? 'is-keeper' : ''}">
          ${badge}
          <div onclick="toonDetail(${f.id})" style="cursor:pointer">
            ${f.thumbnail ? `<img src="${f.thumbnail}" alt="${f.filename}">` : `<div class="no-img">🖼️</div>`}
          </div>
          <div class="bron">${f.source_icon || '💻'} ${f.source_name}</div>
          <div class="path">${f.full_path}</div>
          ${f.gps_lat ? `<div class="path" style="color:#7c6af7">📍 ${f.gps_city || ''} ${f.gps_country || ''}</div>` : ''}
          ${isKeeper ? '' : `<button class="dup-maak-origineel" onclick="maakOrigineel('${g.duplicate_group}', ${f.id})">★ ${t('dup_maak_origineel', 'Keep this copy')}</button>`}
        </div>`;
    }).join('');

    const groepActie = choiceNeeded
      ? `<div class="dup-group-actie dup-group-wacht">${t('dup_wacht', 'Make a choice above first to clean up this group.')}</div>`
      : `<button class="dup-group-delete" onclick="wisGroep('${g.duplicate_group}', ${g.count - 1})">🗑️ ${t('dup_wis_groep', 'Delete duplicates of this group')} (${g.count - 1})</button>`;

    return `<div class="dup-group ${choiceNeeded ? 'dup-group-keuze' : ''}">${kop}<div class="dup-photos">${fotosHtml}</div>${groepActie}</div>`;
  }).join('');

  // Paginering — gedeelde helper (volledige nummerreeks + snel-spring-knoppen)
  const totaalPaginas = Math.ceil(data.totaal_groepen / 10);
  bouwPaginering(document.getElementById('dupPaginering'), page, totaalPaginas, laadDuplicaten);
}

// Handmatige override: kies dit exemplaar als origineel voor deze group
function maakOrigineel(group, fotoId) {
  const h = getManual();
  h[group] = fotoId;
  setHandmatig(h);
  laadDuplicaten(huidigeDupPagina());
}

function huidigeDupPagina() {
  const actief = document.querySelector('#dupPaginering button.actief');
  return actief ? parseInt(actief.textContent) || 1 : 1;
}

// === WISSEN ===

async function wisGroep(group, copyCount) {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  if (!confirm(t('dup_wis_groep_bevestig',
    `WARNING — ${copyCount} copy(ies) of this group will go to the trash.\n\n` +
    `• Bestanden zijn herstelbaar via de prullenbak\n` +
    `• They are removed from the database (not rescanned)\n` +
    `• Het origineel blijft staan\n\nDoorgaan?`))) return;

  await stuurWis({ group });
}

async function wisAlleDuplicaten() {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  const body = { sourceOrder: getSourceOrder(), manual: getManual() };

  // Preview ophalen voor een eerlijke bevestiging
  const pv = await fetch('/api/duplicates/delete-preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());

  if (pv.bestanden === 0) {
    alert(pv.choiceNeeded > 0
      ? t('dup_alles_keuze', `There are still ${pv.choiceNeeded} group(s) where you need to make a choice first.`)
      : t('dup_niets', 'There are no duplicates to delete.'));
    return;
  }

  let waarschuwing =
    `LET OP — ${pv.bestanden} duplicaat-bestand(en) gaan naar de prullenbak\n` +
    `(${formatGrootte(pv.bytes)} vrijgemaakt).\n\n` +
    `• Herstelbaar via de prullenbak\n` +
    `• Removed from the database (not rescanned)\n` +
    `• Alleen de originelen blijven staan`;
  if (pv.choiceNeeded > 0) {
    waarschuwing += `\n\n⚠️ ${pv.choiceNeeded} group(s) will be SKIPPED because you have not made a choice there yet.`;
  }
  waarschuwing += `\n\nDoorgaan?`;
  if (!confirm(waarschuwing)) return;

  await stuurWis(body);
}

async function stuurWis(body) {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  try {
    const data = await fetch('/api/duplicates/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(r => r.json());
    if (!data.ok) { alert('Delete failed: ' + (data.error || 'unknown error')); return; }

    let message = `${data.deleted} duplicate(s) deleted`;
    if (data.bytesVrij) message += ` · ${formatGrootte(data.bytesVrij)} vrijgemaakt`;
    if (data.skipped) message += `\n${data.skipped} group(s) skipped (choice needed)`;
    alert(message);
  } catch (e) {
    alert('Delete failed: ' + e.message);
  } finally {
    laadDuplicaten(1);
  }
}

// === PRIORITEIT MODAL ===

let prioBronnen = []; // {id, name, icon, type}
let prioVervolg = null; // optionele actie na opslaan (bv. scan starten)

async function openPrioModal(vervolg) {
  prioVervolg = typeof vervolg === 'function' ? vervolg : null;
  prioBronnen = await fetch('/api/sources').then(r => r.json());
  const opgeslagen = getSourceOrder();

  // Gerangschikt = in opgeslagen volgorde; rest = ongerangschikt.
  // Eerste keer (niets opgeslagen): alles gerangschikt op type (pc, gsm, usb, overig) → huidig gedrag.
  let gerangschikt, ongerangschikt;
  if (opgeslagen.length === 0) {
    const typeRang = { pc: 0, gsm: 1, usb: 2 };
    gerangschikt = [...prioBronnen].sort((a, b) =>
      (typeRang[a.type] ?? 3) - (typeRang[b.type] ?? 3) || a.name.localeCompare(b.name)
    ).map(b => b.id);
    ongerangschikt = [];
  } else {
    gerangschikt = opgeslagen.filter(id => prioBronnen.some(b => b.id === id));
    ongerangschikt = prioBronnen.filter(b => !gerangschikt.includes(b.id)).map(b => b.id);
  }

  rendePrioLijsten(gerangschikt, ongerangschikt);
  document.getElementById('prioOverlay').classList.add('open');
}

function bronById(id) { return prioBronnen.find(b => b.id === id); }

function rendePrioLijsten(gerangschikt, ongerangschikt) {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  const item = (id, inGerangschikt, idx, total) => {
    const b = bronById(id);
    if (!b) return '';
    const knoppen = inGerangschikt
      ? `<button class="prio-btn" ${idx === 0 ? 'disabled' : ''} onclick="prioOmhoog(${id})">▲</button>
         <button class="prio-btn" ${idx === total - 1 ? 'disabled' : ''} onclick="prioOmlaag(${id})">▼</button>
         <button class="prio-btn prio-btn-uit" title="${t('dup_prio_verwijder', 'Do not rank')}" onclick="prioNaarOngerangschikt(${id})">✕</button>`
      : `<button class="prio-btn prio-btn-in" title="${t('dup_prio_toevoegen', 'Add to ranking')}" onclick="prioNaarGerangschikt(${id})">＋</button>`;
    return `<li data-id="${id}">
      <span class="prio-name">${inGerangschikt ? `<b>${idx + 1}.</b> ` : ''}${b.icon || '💻'} ${b.name}</span>
      <span class="prio-knoppen">${knoppen}</span>
    </li>`;
  };

  document.getElementById('prioGerangschikt').innerHTML =
    gerangschikt.length
      ? gerangschikt.map((id, i) => item(id, true, i, gerangschikt.length)).join('')
      : `<li class="prio-leeg">${t('dup_prio_geen', 'No sources ranked')}</li>`;
  document.getElementById('prioOngerangschikt').innerHTML =
    ongerangschikt.length
      ? ongerangschikt.map(id => item(id, false)).join('')
      : `<li class="prio-leeg">—</li>`;

  // Bewaar de huidige staat op de overlay zelf
  document.getElementById('prioOverlay').dataset.gerangschikt = JSON.stringify(gerangschikt);
  document.getElementById('prioOverlay').dataset.ongerangschikt = JSON.stringify(ongerangschikt);
}

function prioStaat() {
  const o = document.getElementById('prioOverlay');
  return {
    g: JSON.parse(o.dataset.gerangschikt || '[]'),
    u: JSON.parse(o.dataset.ongerangschikt || '[]')
  };
}
function prioOmhoog(id) {
  const { g, u } = prioStaat(); const i = g.indexOf(id);
  if (i > 0) { [g[i - 1], g[i]] = [g[i], g[i - 1]]; }
  rendePrioLijsten(g, u);
}
function prioOmlaag(id) {
  const { g, u } = prioStaat(); const i = g.indexOf(id);
  if (i < g.length - 1) { [g[i + 1], g[i]] = [g[i], g[i + 1]]; }
  rendePrioLijsten(g, u);
}
function prioNaarOngerangschikt(id) {
  const { g, u } = prioStaat();
  rendePrioLijsten(g.filter(x => x !== id), [...u, id]);
}
function prioNaarGerangschikt(id) {
  const { g, u } = prioStaat();
  rendePrioLijsten([...g, id], u.filter(x => x !== id));
}

function bewaarPrio() {
  setBronVolgorde(prioStaat().g);
  sluitPrioModal();
  const vervolg = prioVervolg;
  prioVervolg = null;
  if (vervolg) {
    vervolg(); // bv. de scan starten die op deze keuze wachtte
  } else {
    laadDuplicaten(1);
  }
}

function sluitPrioModal(e) {
  if (e && e.target !== document.getElementById('prioOverlay')) return;
  // Sluiten zonder opslaan: een eventueel wachtende scan-actie laten vallen.
  if (e) prioVervolg = null;
  document.getElementById('prioOverlay').classList.remove('open');
}

// === GPS DELEN (bestaand) ===

async function deelGpsMetDuplicaten() {
  const knop = event.target;
  knop.disabled = true;
  knop.textContent = '⏳ Working...';

  const data = await fetch('/api/duplicates/gps-share', { method: 'POST' }).then(r => r.json());

  knop.disabled = false;
  knop.textContent = `✅ ${data.updated.toLocaleString()} photos updated`;
  setTimeout(() => laadDuplicaten(1), 2000);
}
