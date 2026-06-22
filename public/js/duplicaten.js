// === DUPLICATEN: opruimen op basis van bron-prioriteit ===
//
// De prioriteit (bron-volgorde + handmatige keuzes) is server-side opgeslagen in
// de database (zie /api/duplicaten/prioriteit), zodat de backend-export exact
// hetzelfde "behouden exemplaar" kiest als de UI. localStorage dient nog als
// synchrone cache zodat het renderen zonder await kan blijven werken.

function getBronVolgorde() {
  try { return JSON.parse(localStorage.getItem('dupBronVolgorde') || '[]'); }
  catch { return []; }
}
function setBronVolgorde(v) {
  localStorage.setItem('dupBronVolgorde', JSON.stringify(v));
  bewaarPrioOpServer({ bronVolgorde: v });
}

function getHandmatig() {
  try { return JSON.parse(localStorage.getItem('dupHandmatig') || '{}'); }
  catch { return {}; }
}
function setHandmatig(h) {
  localStorage.setItem('dupHandmatig', JSON.stringify(h));
  bewaarPrioOpServer({ handmatig: h });
}

// Schrijf prioriteit naar de server (bron van waarheid, gedeeld met export).
function bewaarPrioOpServer(payload) {
  return fetch('/api/duplicaten/prioriteit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {}); // offline/fout: localStorage blijft als fallback werken
}

// Haal de opgeslagen prioriteit van de server en spiegel ze naar localStorage,
// zodat de synchrone render-functies (bepaalOrigineelClient) de juiste keuze maken.
async function syncPrioVanServer() {
  try {
    const p = await fetch('/api/duplicaten/prioriteit').then(r => r.json());
    if (Array.isArray(p.bronVolgorde)) localStorage.setItem('dupBronVolgorde', JSON.stringify(p.bronVolgorde));
    if (p.handmatig && typeof p.handmatig === 'object') localStorage.setItem('dupHandmatig', JSON.stringify(p.handmatig));
  } catch (_) { /* server onbereikbaar: localStorage-cache gebruiken */ }
}

// Bepaal het origineel (= behouden) exemplaar binnen een groep.
// Spiegelt exact de backend-logica in bepaalOrigineel().
function bepaalOrigineelClient(fotos, groep) {
  const volgorde = getBronVolgorde();
  const handmatigId = getHandmatig()[groep];
  if (handmatigId != null && fotos.some(f => f.id === handmatigId)) return handmatigId;
  const rang = id => { const i = volgorde.indexOf(id); return i === -1 ? Infinity : i; };
  const gerangschikt = fotos.filter(f => rang(f.bron_id) !== Infinity);
  if (gerangschikt.length === 0) return null; // keuze nodig
  gerangschikt.sort((a, b) => rang(a.bron_id) - rang(b.bron_id) || a.id - b.id);
  return gerangschikt[0].id;
}

async function laadDuplicaten(pagina = 1) {
  await syncPrioVanServer(); // server-prioriteit naar lokale cache vóór render
  const data = await fetch(`/api/duplicaten?pagina=${pagina}&per_pagina=10`).then(r => r.json());

  const t = (k, fallback) => (window.i18n ? window.i18n.t(k) : fallback) || fallback;
  document.getElementById('dupInfo').textContent =
    `${data.totaal_groepen.toLocaleString()} ${t('dup_groepen', 'groepen met duplicaten')}`;

  const lijst = document.getElementById('duplicatenLijst');
  if (data.groepen.length === 0) {
    lijst.innerHTML = `<div class="leeg">${t('dup_geen', 'Geen duplicaten gevonden.')}</div>`;
    document.getElementById('dupPaginering').innerHTML = '';
    return;
  }

  lijst.innerHTML = data.groepen.map(g => {
    const keeperId = bepaalOrigineelClient(g.fotos, g.duplicaat_groep);
    const keuzeNodig = keeperId == null;

    const kop = keuzeNodig
      ? `<h4 class="dup-keuze-nodig">⚠️ ${g.aantal}× ${t('dup_keuze_nodig', 'hetzelfde bestand — kies welk exemplaar je behoudt')}</h4>`
      : `<h4>📋 ${g.aantal}× ${t('dup_zelfde', 'hetzelfde bestand')} · ${formatDatum(g.datum)}</h4>`;

    const fotosHtml = g.fotos.map(f => {
      const isKeeper = f.id === keeperId;
      const badge = isKeeper
        ? `<div class="dup-badge dup-badge-origineel">★ ${t('dup_origineel', 'BEHOUDEN')}</div>`
        : (keuzeNodig ? '' : `<div class="dup-badge dup-badge-kopie">${t('dup_kopie', 'KOPIE')}</div>`);
      return `
        <div class="dup-foto ${isKeeper ? 'is-keeper' : ''}">
          ${badge}
          <div onclick="toonDetail(${f.id})" style="cursor:pointer">
            ${f.thumbnail ? `<img src="${f.thumbnail}" alt="${f.bestandsnaam}">` : `<div class="no-img">🖼️</div>`}
          </div>
          <div class="bron">${f.bron_icoon || '💻'} ${f.bron_naam}</div>
          <div class="pad">${f.volledig_pad}</div>
          ${f.gps_lat ? `<div class="pad" style="color:#7c6af7">📍 ${f.gps_stad || ''} ${f.gps_land || ''}</div>` : ''}
          ${isKeeper ? '' : `<button class="dup-maak-origineel" onclick="maakOrigineel('${g.duplicaat_groep}', ${f.id})">★ ${t('dup_maak_origineel', 'Dit exemplaar behouden')}</button>`}
        </div>`;
    }).join('');

    const groepActie = keuzeNodig
      ? `<div class="dup-groep-actie dup-groep-wacht">${t('dup_wacht', 'Maak eerst een keuze hierboven om deze groep op te ruimen.')}</div>`
      : `<button class="dup-groep-wis" onclick="wisGroep('${g.duplicaat_groep}', ${g.aantal - 1})">🗑️ ${t('dup_wis_groep', 'Duplicaten van deze groep wissen')} (${g.aantal - 1})</button>`;

    return `<div class="dup-groep ${keuzeNodig ? 'dup-groep-keuze' : ''}">${kop}<div class="dup-fotos">${fotosHtml}</div>${groepActie}</div>`;
  }).join('');

  // Paginering — gedeelde helper (volledige nummerreeks + snel-spring-knoppen)
  const totaalPaginas = Math.ceil(data.totaal_groepen / 10);
  bouwPaginering(document.getElementById('dupPaginering'), pagina, totaalPaginas, laadDuplicaten);
}

// Handmatige override: kies dit exemplaar als origineel voor deze groep
function maakOrigineel(groep, fotoId) {
  const h = getHandmatig();
  h[groep] = fotoId;
  setHandmatig(h);
  laadDuplicaten(huidigeDupPagina());
}

function huidigeDupPagina() {
  const actief = document.querySelector('#dupPaginering button.actief');
  return actief ? parseInt(actief.textContent) || 1 : 1;
}

// === WISSEN ===

async function wisGroep(groep, aantalKopien) {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  if (!confirm(t('dup_wis_groep_bevestig',
    `LET OP — ${aantalKopien} kopie(ën) van deze groep gaan naar de prullenbak.\n\n` +
    `• Bestanden zijn herstelbaar via de prullenbak\n` +
    `• Ze worden uit de database gewist (niet opnieuw gescand)\n` +
    `• Het origineel blijft staan\n\nDoorgaan?`))) return;

  await stuurWis({ groep });
}

async function wisAlleDuplicaten() {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  const body = { bronVolgorde: getBronVolgorde(), handmatig: getHandmatig() };

  // Preview ophalen voor een eerlijke bevestiging
  const pv = await fetch('/api/duplicaten/wis-preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());

  if (pv.bestanden === 0) {
    alert(pv.keuzeNodig > 0
      ? t('dup_alles_keuze', `Er zijn nog ${pv.keuzeNodig} groep(en) waar je eerst een keuze moet maken.`)
      : t('dup_niets', 'Er zijn geen duplicaten om te wissen.'));
    return;
  }

  let waarschuwing =
    `LET OP — ${pv.bestanden} duplicaat-bestand(en) gaan naar de prullenbak\n` +
    `(${formatGrootte(pv.bytes)} vrijgemaakt).\n\n` +
    `• Herstelbaar via de prullenbak\n` +
    `• Uit de database gewist (niet opnieuw gescand)\n` +
    `• Alleen de originelen blijven staan`;
  if (pv.keuzeNodig > 0) {
    waarschuwing += `\n\n⚠️ ${pv.keuzeNodig} groep(en) worden OVERGESLAGEN omdat je daar nog geen keuze hebt gemaakt.`;
  }
  waarschuwing += `\n\nDoorgaan?`;
  if (!confirm(waarschuwing)) return;

  await stuurWis(body);
}

async function stuurWis(body) {
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  try {
    const data = await fetch('/api/duplicaten/wis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(r => r.json());
    if (!data.ok) { alert('Wissen mislukt: ' + (data.fout || 'onbekende fout')); return; }

    let bericht = `${data.verwijderd} duplicaat(en) verwijderd`;
    if (data.bytesVrij) bericht += ` · ${formatGrootte(data.bytesVrij)} vrijgemaakt`;
    if (data.overgeslagen) bericht += `\n${data.overgeslagen} groep(en) overgeslagen (keuze nodig)`;
    alert(bericht);
  } catch (e) {
    alert('Wissen mislukt: ' + e.message);
  } finally {
    laadDuplicaten(1);
  }
}

// === PRIORITEIT MODAL ===

let prioBronnen = []; // {id, naam, icoon, type}
let prioVervolg = null; // optionele actie na opslaan (bv. scan starten)

async function openPrioModal(vervolg) {
  prioVervolg = typeof vervolg === 'function' ? vervolg : null;
  prioBronnen = await fetch('/api/bronnen').then(r => r.json());
  const opgeslagen = getBronVolgorde();

  // Gerangschikt = in opgeslagen volgorde; rest = ongerangschikt.
  // Eerste keer (niets opgeslagen): alles gerangschikt op type (pc, gsm, usb, overig) → huidig gedrag.
  let gerangschikt, ongerangschikt;
  if (opgeslagen.length === 0) {
    const typeRang = { pc: 0, gsm: 1, usb: 2 };
    gerangschikt = [...prioBronnen].sort((a, b) =>
      (typeRang[a.type] ?? 3) - (typeRang[b.type] ?? 3) || a.naam.localeCompare(b.naam)
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
  const item = (id, inGerangschikt, idx, totaal) => {
    const b = bronById(id);
    if (!b) return '';
    const knoppen = inGerangschikt
      ? `<button class="prio-btn" ${idx === 0 ? 'disabled' : ''} onclick="prioOmhoog(${id})">▲</button>
         <button class="prio-btn" ${idx === totaal - 1 ? 'disabled' : ''} onclick="prioOmlaag(${id})">▼</button>
         <button class="prio-btn prio-btn-uit" title="${t('dup_prio_verwijder', 'Niet rangschikken')}" onclick="prioNaarOngerangschikt(${id})">✕</button>`
      : `<button class="prio-btn prio-btn-in" title="${t('dup_prio_toevoegen', 'Toevoegen aan rangschikking')}" onclick="prioNaarGerangschikt(${id})">＋</button>`;
    return `<li data-id="${id}">
      <span class="prio-naam">${inGerangschikt ? `<b>${idx + 1}.</b> ` : ''}${b.icoon || '💻'} ${b.naam}</span>
      <span class="prio-knoppen">${knoppen}</span>
    </li>`;
  };

  document.getElementById('prioGerangschikt').innerHTML =
    gerangschikt.length
      ? gerangschikt.map((id, i) => item(id, true, i, gerangschikt.length)).join('')
      : `<li class="prio-leeg">${t('dup_prio_geen', 'Geen bronnen gerangschikt')}</li>`;
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
  knop.textContent = '⏳ Bezig...';

  const data = await fetch('/api/duplicaten/gps-delen', { method: 'POST' }).then(r => r.json());

  knop.disabled = false;
  knop.textContent = `✅ ${data.bijgewerkt.toLocaleString()} foto's bijgewerkt`;
  setTimeout(() => laadDuplicaten(1), 2000);
}
