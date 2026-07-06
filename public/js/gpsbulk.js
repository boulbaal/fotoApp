// ─── STATE ───────────────────────────────────────────────────────────────────
let gpsBulkGroepen = [];   // [{ group_id, date_start, date_end, count, ids, samples }]
let gpsBulkGekozen = {};   // groupId → locatieobject
let gpsBulkZoekTimers = {};
let geselecteerd = new Set(); // Set of "groupId:fotoId" strings
let volgendGroepId = 10000;   // for manually created groups
let gpsBulkType = '';         // '' = all, '0' = photos, '1' = videos

// Type filter button: All / Photos / Videos
// laadGpsBulk() synchroniseert zelf de actief-markering van de knoppen.
function setGpsBulkType(type) {
  gpsBulkType = type;
  laadGpsBulk();
}

// Bulk kaart modal state
let bulkKaartInstantie = null;
let bulkKaartMarker   = null;
let bulkKaartActieveGroep = null;
let bulkKaartGekozenLocatie = null;
let bulkKaartZoekTimer = null;

// ─── LADEN ───────────────────────────────────────────────────────────────────

async function laadGpsBulk() {
  const container = document.getElementById('gpsBulkGroepen');
  const info = document.getElementById('gpsBulkInfo');
  container.innerHTML = '<div style="padding:24px;color:#9ca3af">Loading groups...</div>';
  info.textContent = '';
  geselecteerd.clear();

  // Synchroniseer de type-filter knoppen met de huidige staat
  ['gpsTypeAlles', 'gpsTypeFotos', 'gpsTypeVideos'].forEach(id => {
    document.getElementById(id)?.classList.remove('actief');
  });
  const actiefId = gpsBulkType === '1' ? 'gpsTypeVideos' : gpsBulkType === '0' ? 'gpsTypeFotos' : 'gpsTypeAlles';
  document.getElementById(actiefId)?.classList.add('actief');

  try {
    const qs = gpsBulkType ? `?is_video=${gpsBulkType}` : '';
    gpsBulkGroepen = await fetch('/api/gps/groups' + qs).then(r => r.json());
  } catch (e) {
    container.innerHTML = '<div style="color:#f87171;padding:24px">Loading failed. Try again.</div>';
    return;
  }

  // Voeg hold zone toe als vaste laatste group
  gpsBulkGroepen.push({ group_id: 'hold', date_start: null, date_end: null, ids: [], samples: [], isHold: true });

  if (gpsBulkGroepen.filter(g => !g.isHold).length === 0) {
    const wat = gpsBulkType === '1' ? "videos" : gpsBulkType === '0' ? "photos" : "photos and videos";
    container.innerHTML = `<div class="leeg" style="padding:48px;text-align:center;font-size:16px">✅ All ${wat} already have a GPS location!</div>`;
    return;
  }

  bijwerkInfo();
  renderAlles();
}

function bijwerkInfo() {
  const total = gpsBulkGroepen.filter(g => !g.isHold).reduce((s, g) => s + g.ids.length, 0);
  const groupCount = gpsBulkGroepen.filter(g => !g.isHold).length;
  const wat = gpsBulkType === '1' ? "videos" : gpsBulkType === '0' ? "photos" : "photos and videos";
  document.getElementById('gpsBulkInfo').textContent =
    total > 0 ? `${groupCount} groups · ${total.toLocaleString()} ${wat} without a location` : '';
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function renderAlles() {
  const container = document.getElementById('gpsBulkGroepen');
  container.innerHTML = `
    <div class="gpsbulk-layout">
      <div class="gpsbulk-links" id="gpsBulkLinks"></div>
      <div class="gpsbulk-rechts">
        <div class="gpsbulk-hold-kop">
          <span>📦 Hold zone</span>
        </div>
        <div id="gpsBulkHold"></div>
      </div>
    </div>`;

  renderGroepen();
}

function renderGroepen() {
  const links = document.getElementById('gpsBulkLinks');
  const holdEl = document.getElementById('gpsBulkHold');
  if (!links || !holdEl) return;

  const tijdGroepen = gpsBulkGroepen.filter(g => !g.isHold);
  links.innerHTML = tijdGroepen.map(g => groepKaartHtml(g)).join('');

  const holdGroep = gpsBulkGroepen.find(g => g.isHold);
  holdEl.innerHTML = holdGroepHtml(holdGroep);

  bindDropZones();
  bindDragHandlers();
  bindSelectHandlers();
  bindHoverPreview();
}

function groepKaartHtml(g) {
  const datumTekst = !g.date_start ? '📅 Onbekende date'
    : g.date_start.slice(0, 10) === (g.date_end || '').slice(0, 10)
      ? formatDatum(g.date_start)
      : `${formatDatum(g.date_start)} — ${formatDatum(g.date_end)}`;

  const fotoLabel = `${g.ids.length.toLocaleString()} item${g.ids.length !== 1 ? 's' : ''}`;

  const thumbHtml = g.samples.length > 0
    ? g.samples.map(id => thumbEl(g.group_id, id)).join('')
    : '<span style="color:#6b7280;font-size:12px">No previews</span>';

  const pickerHtml = pickerKaartHtml(g);

  return `
    <div class="bulk-group" id="group-${g.group_id}" data-group="${g.group_id}">
      <div class="bulk-group-header">
        <div>
          <div class="bulk-group-date">${datumTekst}</div>
          <div class="bulk-group-teller" id="teller-${g.group_id}">${fotoLabel}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-primair" style="font-size:13px"
            onclick="openLocatiePicker('${g.group_id}')">📍 ${i18n.t('gpsbulk_locatie_toewijzen', 'Assign location')}</button>
          <button class="btn btn-gevaar" style="font-size:13px"
            onclick="verwijderGroep('${g.group_id}')">🗑️ ${i18n.t('gpsbulk_groep_verwijder', 'Delete group')}</button>
        </div>
      </div>
      <div class="bulk-thumbs" id="thumbs-${g.group_id}" data-group="${g.group_id}">${thumbHtml}</div>
      ${pickerHtml}
    </div>`;
}

function holdGroepHtml(g) {
  const thumbHtml = g.ids.length > 0
    ? g.samples.map(id => thumbEl('hold', id)).join('')
    : '<div class="hold-leeg">Drag photos or videos here to set them aside</div>';
  return `
    <div class="bulk-group bulk-hold-group" id="group-hold" data-group="hold">
      <div class="bulk-thumbs" id="thumbs-hold" data-group="hold">${thumbHtml}</div>
    </div>`;
}

function thumbEl(groupId, fotoId) {
  const key = `${groupId}:${fotoId}`;
  const isGeselecteerd = geselecteerd.has(key);
  return `<img src="/api/photos/${fotoId}/thumbnail" loading="lazy"
    class="bulk-thumb${isGeselecteerd ? ' selected' : ''}"
    draggable="true"
    data-group="${groupId}" data-foto="${fotoId}"
    title="Klik om te selecteren, sleep om te verplaatsen"
    onerror="this.style.display='none'">`;
}

function pickerKaartHtml(g) {
  return `
    <div class="bulk-picker" id="picker-${g.group_id}" style="display:none">
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input type="text" class="bulk-search" id="search-${g.group_id}"
          placeholder="🔍 Search for a city or country..."
          oninput="zoekBulkLocatie('${g.group_id}')" autocomplete="off"
          style="flex:1;margin-bottom:0">
        <button class="btn btn-secundair" style="font-size:13px;white-space:nowrap;flex-shrink:0"
          onclick="openBulkKaart('${g.group_id}')">🗺️ Map</button>
      </div>
      <div class="bulk-resultaten" id="res-${g.group_id}"></div>
      <div class="bulk-chosen" id="chosen-${g.group_id}" style="display:none">
        <span class="bulk-chosen-name" id="chosen-name-${g.group_id}"></span>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primair" style="font-size:13px"
            onclick="bevestigBulkLocatie('${g.group_id}')">
            ✅ Assign to <span id="bevestig-label-${g.group_id}">${g.ids.length} items</span>
          </button>
          <button class="btn btn-secundair" style="font-size:13px"
            onclick="annuleerBulkLocatie('${g.group_id}')">Different location</button>
        </div>
      </div>
    </div>`;
}

// ─── EVENTS BINDEN ───────────────────────────────────────────────────────────

function bindDragHandlers() {
  document.querySelectorAll('.bulk-thumb[draggable]').forEach(el => {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
  });
}

function bindDropZones() {
  document.querySelectorAll('.bulk-thumbs').forEach(el => {
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
  });
}

function bindSelectHandlers() {
  document.querySelectorAll('.bulk-thumb[draggable]').forEach(el => {
    el.addEventListener('click', onThumbKlik);
  });
}

function bindHoverPreview() {
  document.querySelectorAll('.bulk-thumb[draggable]').forEach(el => {
    el.addEventListener('mouseenter', onThumbHoverIn);
    el.addEventListener('mouseleave', onThumbHoverUit);
    el.addEventListener('dragstart', verbergPreview); // verberg bij slepen
  });
}

// ─── HOVER PREVIEW ───────────────────────────────────────────────────────────

let previewTimer = null;

function onThumbHoverIn(e) {
  const el = e.currentTarget;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => toonPreview(el), 500);
}

function onThumbHoverUit() {
  clearTimeout(previewTimer);
  verbergPreview();
}

function toonPreview(el) {
  const fotoId = el.dataset.foto;
  const preview = document.getElementById('bulkThumbPreview');
  if (!preview) return;

  preview.innerHTML = `<img src="/api/photos/${fotoId}/thumbnail" alt="">`;
  preview.style.display = 'block';

  // Positie berekenen: boven de thumbnail, gecentreerd
  const rect = el.getBoundingClientRect();
  const pw = 560, ph = 420;
  let left = rect.left + rect.width / 2 - pw / 2;
  let top  = rect.top - ph - 10 + window.scrollY;

  // Buiten scherm? Verschuif
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top < window.scrollY + 8) top = rect.bottom + 10 + window.scrollY;

  preview.style.left = left + 'px';
  preview.style.top  = top + 'px';
}

function verbergPreview() {
  const preview = document.getElementById('bulkThumbPreview');
  if (preview) preview.style.display = 'none';
}

// ─── SELECTIE ────────────────────────────────────────────────────────────────

function onThumbKlik(e) {
  e.stopPropagation();
  const groupId = e.currentTarget.dataset.group;
  const fotoId  = parseInt(e.currentTarget.dataset.foto);
  const key = `${groupId}:${fotoId}`;
  if (geselecteerd.has(key)) geselecteerd.delete(key);
  else geselecteerd.add(key);
  e.currentTarget.classList.toggle('selected', geselecteerd.has(key));
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

let sleepData = []; // [{ vanGroepId, fotoId }]

function onDragStart(e) {
  const groupId = e.currentTarget.dataset.group;
  const fotoId  = parseInt(e.currentTarget.dataset.foto);
  const key = `${groupId}:${fotoId}`;

  // Als de gesleepte foto geselecteerd is, sleep alle geselecteerden mee
  if (geselecteerd.has(key)) {
    sleepData = [...geselecteerd].map(k => {
      const [gId, fId] = k.split(':');
      return { vanGroepId: isNaN(gId) ? gId : parseInt(gId) || gId, fotoId: parseInt(fId) };
    });
  } else {
    // Alleen de gesleepte foto
    sleepData = [{ vanGroepId: isNaN(groupId) ? groupId : groupId, fotoId }];
  }

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify(sleepData));
  e.currentTarget.classList.add('sleepend');
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('sleepend');
  document.querySelectorAll('.bulk-thumbs.dragover').forEach(el => el.classList.remove('dragover'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('dragover');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('dragover');
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');

  const naarGroepId = e.currentTarget.dataset.group;
  if (!sleepData.length) return;

  // Verplaats foto's in de datastructuur
  for (const { vanGroepId, fotoId } of sleepData) {
    const vanGroep = groepVindId(vanGroepId);
    const naarGroep = groepVindId(naarGroepId);
    if (!vanGroep || !naarGroep || vanGroepId == naarGroepId) continue;

    // Verwijder uit brongroep
    vanGroep.ids = vanGroep.ids.filter(id => id !== fotoId);
    vanGroep.samples = vanGroep.samples.filter(id => id !== fotoId);

    // Voeg toe aan doelgroep
    if (!naarGroep.ids.includes(fotoId)) {
      naarGroep.ids.push(fotoId);
      if (naarGroep.samples.length < 6) naarGroep.samples.push(fotoId);
    }
  }

  // Verwijder geselecteerde keys van verplaatste foto's
  for (const { vanGroepId, fotoId } of sleepData) {
    geselecteerd.delete(`${vanGroepId}:${fotoId}`);
  }
  sleepData = [];

  // Verwijder lege tijdgroepen (behalve hold zone en manual aangemaakte)
  gpsBulkGroepen = gpsBulkGroepen.filter(g => g.isHold || g.isHandmatig || g.ids.length > 0);

  // Auto-promote hold zone als er geen normale groups meer zijn maar hold nog foto's heeft
  const holdGroep = gpsBulkGroepen.find(g => g.isHold);
  const heeftNormaleGroepen = gpsBulkGroepen.some(g => !g.isHold);
  if (!heeftNormaleGroepen && holdGroep && holdGroep.ids.length > 0) {
    const new_files = {
      group_id: volgendGroepId++,
      date_start: null, date_end: null,
      ids: [...holdGroep.ids],
      samples: [...holdGroep.samples],
      isHandmatig: true
    };
    gpsBulkGroepen.splice(gpsBulkGroepen.findIndex(g => g.isHold), 0, new_files);
    holdGroep.ids = [];
    holdGroep.samples = [];
  }

  bijwerkInfo();
  renderGroepen();
}

function groepVindId(groupId) {
  const id = groupId === 'hold' ? 'hold' : (isNaN(groupId) ? groupId : parseInt(groupId));
  return gpsBulkGroepen.find(g => g.group_id == id);
}

// ─── NIEUWE GROEP ────────────────────────────────────────────────────────────

function nieuweGroep() {
  const new_files = {
    group_id: volgendGroepId++,
    date_start: null, date_end: null,
    ids: [], samples: [],
    isHandmatig: true
  };
  // Voeg in vóór hold zone
  const holdIdx = gpsBulkGroepen.findIndex(g => g.isHold);
  gpsBulkGroepen.splice(holdIdx, 0, new_files);
  renderGroepen();
}

// ─── LOCATIE PICKER ──────────────────────────────────────────────────────────

function openLocatiePicker(groupId) {
  const picker = document.getElementById(`picker-${groupId}`);
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) document.getElementById(`search-${groupId}`)?.focus();
}

function zoekBulkLocatie(groupId) {
  clearTimeout(gpsBulkZoekTimers[groupId]);
  const q = document.getElementById(`search-${groupId}`).value.trim();
  const resEl = document.getElementById(`res-${groupId}`);
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">Zoeken...</div>';

  gpsBulkZoekTimers[groupId] = setTimeout(async () => {
    try {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&accept-language=en`
      ).then(r => r.json());

      if (!data.length) { resEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">No results</div>'; return; }

      if (!window._bulkZoekData) window._bulkZoekData = {};
      window._bulkZoekData[groupId] = data;
      resEl.innerHTML = data.map((r, i) =>
        `<div class="bulk-resultaat" onclick="kiesLocatie('${groupId}', ${i})">${r.display_name}</div>`
      ).join('');
    } catch (e) {
      resEl.innerHTML = '<div style="color:#f87171;padding:8px;font-size:13px">Fout bij zoeken</div>';
    }
  }, 450);
}

function kiesLocatie(groupId, idx) {
  const data = window._bulkZoekData?.[groupId];
  if (!data?.[idx]) return;
  const r = data[idx];
  const addr = r.address || {};
  const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || r.name || '';
  const country = addr.country || '';
  const land_code = (addr.country_code || '').toUpperCase();

  gpsBulkGekozen[groupId] = { gps_city: city, gps_country: country, gps_lat: parseFloat(r.lat), gps_lon: parseFloat(r.lon), gps_country_code: land_code, gps_address: r.display_name };

  const vlag = land_code ? landVlag(land_code) : '';
  document.getElementById(`res-${groupId}`).innerHTML = '';
  document.getElementById(`search-${groupId}`).style.display = 'none';
  document.getElementById(`chosen-name-${groupId}`).textContent = `${vlag} ${[city, country].filter(Boolean).join(', ')}`.trim();
  document.getElementById(`chosen-${groupId}`).style.display = 'block';
}

function annuleerBulkLocatie(groupId) {
  delete gpsBulkGekozen[groupId];
  const search = document.getElementById(`search-${groupId}`);
  search.style.display = '';
  search.value = '';
  document.getElementById(`res-${groupId}`).innerHTML = '';
  document.getElementById(`chosen-${groupId}`).style.display = 'none';
}

async function bevestigBulkLocatie(groupId) {
  const location = gpsBulkGekozen[groupId];
  const group = groepVindId(groupId);
  if (!location || !group || group.ids.length === 0) return;

  const groepEl = document.getElementById(`group-${groupId}`);
  groepEl.style.opacity = '0.5';
  groepEl.style.pointerEvents = 'none';

  try {
    const r = await fetch('/api/gps/bulk-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: group.ids, ...location })
    });
    if (!r.ok) throw new Error();
    const resp = await r.json();

    const vlag = location.gps_country_code ? landVlag(location.gps_country_code) : '';
    const naamTekst = `${vlag} ${[location.gps_city, location.gps_country].filter(Boolean).join(', ')}`.trim();
    const dupTekst = resp.duplicaten_bijgewerkt ? ' (incl. duplicates)' : '';
    groepEl.innerHTML = `
      <div style="padding:14px 20px;color:#4ade80;font-size:14px">
        ✅ ${resp.updated.toLocaleString()} item${resp.updated !== 1 ? 's' : ''}${dupTekst} assigned aan ${naamTekst}
      </div>`;

    gpsBulkGroepen = gpsBulkGroepen.filter(g => g.group_id != groupId);
    bijwerkInfo();

    if (gpsBulkGroepen.filter(g => !g.isHold).length === 0) {
      setTimeout(() => {
        document.getElementById('gpsBulkGroepen').innerHTML =
          '<div class="leeg" style="padding:48px;text-align:center;font-size:16px">✅ All groups assigned!</div>';
      }, 1200);
    }
  } catch (e) {
    groepEl.style.opacity = '';
    groepEl.style.pointerEvents = '';
    alert('Save failed. Try again.');
  }
}

// ─── GROEP VERWIJDEREN (naar prullenbak) ─────────────────────────────────────
// Verwijdert een hele group slechte foto's ineens: bestanden naar de systeem-
// prullenbak (herstelbaar), DB-records weg, cascade over duplicaatgroepen.
async function verwijderGroep(groupId) {
  const group = groepVindId(groupId);
  if (!group || group.ids.length === 0) return;

  const count = group.ids.length;
  const vraag = i18n.t('gpsbulk_groep_verwijder_bevestig',
    'Move this whole group ({n}) to the trash? The files can be restored from the system trash.')
    .replace('{n}', count.toLocaleString());
  if (!confirm(vraag)) return;

  const groepEl = document.getElementById(`group-${groupId}`);
  groepEl.style.opacity = '0.5';
  groepEl.style.pointerEvents = 'none';

  try {
    const r = await fetch('/api/photos/delete-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: group.ids })
    });
    if (!r.ok) throw new Error();
    const resp = await r.json();

    groepEl.innerHTML = `
      <div style="padding:14px 20px;color:#f87171;font-size:14px">
        🗑️ ${(resp.movedToTrash || 0).toLocaleString()} ${i18n.t('gpsbulk_groep_verwijderd', 'moved to trash')}
      </div>`;

    gpsBulkGroepen = gpsBulkGroepen.filter(g => g.group_id != groupId);
    bijwerkInfo();

    if (gpsBulkGroepen.filter(g => !g.isHold).length === 0) {
      setTimeout(() => {
        document.getElementById('gpsBulkGroepen').innerHTML =
          '<div class="leeg" style="padding:48px;text-align:center;font-size:16px">✅ ' +
          i18n.t('gpsbulk_klaar', 'All groups processed!') + '</div>';
      }, 1200);
    }
  } catch (e) {
    groepEl.style.opacity = '';
    groepEl.style.pointerEvents = '';
    alert(i18n.t('gpsbulk_verwijder_fout', 'Delete failed. Try again.'));
  }
}

// ─── BULK KAART MODAL ────────────────────────────────────────────────────────

function openBulkKaart(groupId) {
  bulkKaartActieveGroep = groupId;
  bulkKaartGekozenLocatie = null;
  document.getElementById('bulkKaartStatus').textContent = 'Click the map to pick a location';
  document.getElementById('bulkKaartGekozenInfo').textContent = '';
  document.getElementById('bulkKaartOpslaanKnop').disabled = true;
  document.getElementById('bulkKaartZoek').value = '';
  document.getElementById('bulkKaartZoekResultaten').innerHTML = '';
  document.getElementById('bulkKaartOverlay').classList.add('open');

  // Init kaart (eenmalig)
  if (!bulkKaartInstantie) {
    bulkKaartInstantie = L.map('bulkKaartContainer', { center: [20, 10], zoom: 3, doubleClickZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO © OpenStreetMap', subdomains: 'abcd', maxZoom: 19
    }).addTo(bulkKaartInstantie);
    bulkKaartInstantie.on('click', onBulkKaartKlik);
  }
  setTimeout(() => bulkKaartInstantie.invalidateSize(), 150);
}

async function onBulkKaartKlik(e) {
  const { lat, lng } = e.latlng;
  document.getElementById('bulkKaartStatus').textContent = '🌍 Locatie ophalen...';
  document.getElementById('bulkKaartOpslaanKnop').disabled = true;

  if (bulkKaartMarker) bulkKaartMarker.setLatLng([lat, lng]);
  else bulkKaartMarker = L.marker([lat, lng]).addTo(bulkKaartInstantie);

  try {
    const data = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
    ).then(r => r.json());

    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
    const country = addr.country || '';
    const land_code = (addr.country_code || '').toUpperCase();
    const vlag = land_code ? landVlag(land_code) : '';

    bulkKaartGekozenLocatie = {
      gps_city: city, gps_country: country,
      gps_lat: lat, gps_lon: lng,
      gps_country_code: land_code,
      gps_address: data.display_name || ''
    };

    const naamTekst = `${vlag} ${[city, country].filter(Boolean).join(', ')}`.trim();
    document.getElementById('bulkKaartStatus').textContent = naamTekst || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('bulkKaartGekozenInfo').textContent = naamTekst;
    document.getElementById('bulkKaartOpslaanKnop').disabled = false;
  } catch (e) {
    document.getElementById('bulkKaartStatus').textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    bulkKaartGekozenLocatie = { gps_city: '', gps_country: '', gps_lat: lat, gps_lon: lng, gps_country_code: '', gps_address: '' };
    document.getElementById('bulkKaartOpslaanKnop').disabled = false;
  }
}

function zoekBulkKaartLocatie() {
  clearTimeout(bulkKaartZoekTimer);
  const q = document.getElementById('bulkKaartZoek').value.trim();
  const resEl = document.getElementById('bulkKaartZoekResultaten');
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div style="padding:6px 12px;color:#9ca3af;font-size:13px">Zoeken...</div>';

  bulkKaartZoekTimer = setTimeout(async () => {
    try {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&accept-language=en`
      ).then(r => r.json());
      if (!data.length) { resEl.innerHTML = '<div style="padding:6px 12px;color:#9ca3af;font-size:13px">No results</div>'; return; }
      resEl.innerHTML = data.map((r, i) =>
        `<div class="gps-search-resultaat" onclick="kiesBulkKaartResultaat(${i})" data-idx="${i}">${r.display_name}</div>`
      ).join('');
      window._bulkKaartZoekData = data;
    } catch (e) { resEl.innerHTML = ''; }
  }, 450);
}

function kiesBulkKaartResultaat(idx) {
  const data = window._bulkKaartZoekData;
  if (!data?.[idx]) return;
  const r = data[idx];
  const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
  bulkKaartInstantie.setView([lat, lng], 12);
  // Simuleer klik om location in te stellen
  onBulkKaartKlik({ latlng: { lat, lng } });
  document.getElementById('bulkKaartZoekResultaten').innerHTML = '';
  document.getElementById('bulkKaartZoek').value = r.display_name.split(',')[0];
}

function bevestigBulkKaartLocatie() {
  if (!bulkKaartGekozenLocatie || !bulkKaartActieveGroep) return;
  const groupId = bulkKaartActieveGroep;
  gpsBulkGekozen[groupId] = bulkKaartGekozenLocatie;

  const vlag = bulkKaartGekozenLocatie.gps_country_code ? landVlag(bulkKaartGekozenLocatie.gps_country_code) : '';
  const naamTekst = `${vlag} ${[bulkKaartGekozenLocatie.gps_city, bulkKaartGekozenLocatie.gps_country].filter(Boolean).join(', ')}`.trim();

  // Zorg dat picker open is
  const picker = document.getElementById(`picker-${groupId}`);
  if (picker) picker.style.display = 'block';

  document.getElementById(`search-${groupId}`).style.display = 'none';
  document.getElementById(`chosen-name-${groupId}`).textContent = naamTekst;
  document.getElementById(`chosen-${groupId}`).style.display = 'block';
  document.getElementById(`res-${groupId}`).innerHTML = '';

  sluitBulkKaartDirect();
}

function sluitBulkKaart(e) {
  if (e && e.target !== document.getElementById('bulkKaartOverlay')) return;
  sluitBulkKaartDirect();
}

function sluitBulkKaartDirect() {
  document.getElementById('bulkKaartOverlay').classList.remove('open');
  bulkKaartActieveGroep = null;
}
