// ─── STATE ───────────────────────────────────────────────────────────────────
let gpsBulkGroepen = [];   // [{ groep_id, datum_start, datum_eind, aantal, ids, voorbeelden }]
let gpsBulkGekozen = {};   // groepId → locatieobject
let gpsBulkZoekTimers = {};
let geselecteerd = new Set(); // Set van "groepId:fotoId" strings
let volgendGroepId = 10000;   // voor handmatig aangemaakte groepen
let gpsBulkType = '';         // '' = alles, '0' = foto's, '1' = video's

// Type-filter knop: Alles / Foto's / Video's
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
  container.innerHTML = '<div style="padding:24px;color:#9ca3af">Groepen laden...</div>';
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
    gpsBulkGroepen = await fetch('/api/gps/groepen' + qs).then(r => r.json());
  } catch (e) {
    container.innerHTML = '<div style="color:#f87171;padding:24px">Fout bij laden. Probeer opnieuw.</div>';
    return;
  }

  // Voeg hold zone toe als vaste laatste groep
  gpsBulkGroepen.push({ groep_id: 'hold', datum_start: null, datum_eind: null, ids: [], voorbeelden: [], isHold: true });

  if (gpsBulkGroepen.filter(g => !g.isHold).length === 0) {
    const wat = gpsBulkType === '1' ? "video's" : gpsBulkType === '0' ? "foto's" : "foto's en video's";
    container.innerHTML = `<div class="leeg" style="padding:48px;text-align:center;font-size:16px">✅ Alle ${wat} hebben al een GPS-locatie!</div>`;
    return;
  }

  bijwerkInfo();
  renderAlles();
}

function bijwerkInfo() {
  const totaal = gpsBulkGroepen.filter(g => !g.isHold).reduce((s, g) => s + g.ids.length, 0);
  const aantalGroepen = gpsBulkGroepen.filter(g => !g.isHold).length;
  const wat = gpsBulkType === '1' ? "video's" : gpsBulkType === '0' ? "foto's" : "foto's en video's";
  document.getElementById('gpsBulkInfo').textContent =
    totaal > 0 ? `${aantalGroepen} groepen · ${totaal.toLocaleString()} ${wat} zonder locatie` : '';
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
  const datumTekst = !g.datum_start ? '📅 Onbekende datum'
    : g.datum_start.slice(0, 10) === (g.datum_eind || '').slice(0, 10)
      ? formatDatum(g.datum_start)
      : `${formatDatum(g.datum_start)} — ${formatDatum(g.datum_eind)}`;

  const fotoLabel = `${g.ids.length.toLocaleString()} item${g.ids.length !== 1 ? 's' : ''}`;

  const thumbHtml = g.voorbeelden.length > 0
    ? g.voorbeelden.map(id => thumbEl(g.groep_id, id)).join('')
    : '<span style="color:#6b7280;font-size:12px">Geen voorbeelden</span>';

  const pickerHtml = pickerKaartHtml(g);

  return `
    <div class="bulk-groep" id="groep-${g.groep_id}" data-groep="${g.groep_id}">
      <div class="bulk-groep-header">
        <div>
          <div class="bulk-groep-datum">${datumTekst}</div>
          <div class="bulk-groep-teller" id="teller-${g.groep_id}">${fotoLabel}</div>
        </div>
        <button class="btn btn-primair" style="font-size:13px;flex-shrink:0"
          onclick="openLocatiePicker('${g.groep_id}')">📍 Locatie toewijzen</button>
      </div>
      <div class="bulk-thumbs" id="thumbs-${g.groep_id}" data-groep="${g.groep_id}">${thumbHtml}</div>
      ${pickerHtml}
    </div>`;
}

function holdGroepHtml(g) {
  const thumbHtml = g.ids.length > 0
    ? g.voorbeelden.map(id => thumbEl('hold', id)).join('')
    : '<div class="hold-leeg">Sleep foto\'s of video\'s hierheen om ze apart te zetten</div>';
  return `
    <div class="bulk-groep bulk-hold-groep" id="groep-hold" data-groep="hold">
      <div class="bulk-thumbs" id="thumbs-hold" data-groep="hold">${thumbHtml}</div>
    </div>`;
}

function thumbEl(groepId, fotoId) {
  const key = `${groepId}:${fotoId}`;
  const isGeselecteerd = geselecteerd.has(key);
  return `<img src="/api/fotos/${fotoId}/thumbnail" loading="lazy"
    class="bulk-thumb${isGeselecteerd ? ' geselecteerd' : ''}"
    draggable="true"
    data-groep="${groepId}" data-foto="${fotoId}"
    title="Klik om te selecteren, sleep om te verplaatsen"
    onerror="this.style.display='none'">`;
}

function pickerKaartHtml(g) {
  return `
    <div class="bulk-picker" id="picker-${g.groep_id}" style="display:none">
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input type="text" class="bulk-zoek" id="zoek-${g.groep_id}"
          placeholder="🔍 Zoek een stad of land..."
          oninput="zoekBulkLocatie('${g.groep_id}')" autocomplete="off"
          style="flex:1;margin-bottom:0">
        <button class="btn btn-secundair" style="font-size:13px;white-space:nowrap;flex-shrink:0"
          onclick="openBulkKaart('${g.groep_id}')">🗺️ Kaart</button>
      </div>
      <div class="bulk-resultaten" id="res-${g.groep_id}"></div>
      <div class="bulk-gekozen" id="gekozen-${g.groep_id}" style="display:none">
        <span class="bulk-gekozen-naam" id="gekozen-naam-${g.groep_id}"></span>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primair" style="font-size:13px"
            onclick="bevestigBulkLocatie('${g.groep_id}')">
            ✅ Toewijzen aan <span id="bevestig-label-${g.groep_id}">${g.ids.length} items</span>
          </button>
          <button class="btn btn-secundair" style="font-size:13px"
            onclick="annuleerBulkLocatie('${g.groep_id}')">Andere locatie</button>
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

  preview.innerHTML = `<img src="/api/fotos/${fotoId}/thumbnail" alt="">`;
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
  const groepId = e.currentTarget.dataset.groep;
  const fotoId  = parseInt(e.currentTarget.dataset.foto);
  const key = `${groepId}:${fotoId}`;
  if (geselecteerd.has(key)) geselecteerd.delete(key);
  else geselecteerd.add(key);
  e.currentTarget.classList.toggle('geselecteerd', geselecteerd.has(key));
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

let sleepData = []; // [{ vanGroepId, fotoId }]

function onDragStart(e) {
  const groepId = e.currentTarget.dataset.groep;
  const fotoId  = parseInt(e.currentTarget.dataset.foto);
  const key = `${groepId}:${fotoId}`;

  // Als de gesleepte foto geselecteerd is, sleep alle geselecteerden mee
  if (geselecteerd.has(key)) {
    sleepData = [...geselecteerd].map(k => {
      const [gId, fId] = k.split(':');
      return { vanGroepId: isNaN(gId) ? gId : parseInt(gId) || gId, fotoId: parseInt(fId) };
    });
  } else {
    // Alleen de gesleepte foto
    sleepData = [{ vanGroepId: isNaN(groepId) ? groepId : groepId, fotoId }];
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

  const naarGroepId = e.currentTarget.dataset.groep;
  if (!sleepData.length) return;

  // Verplaats foto's in de datastructuur
  for (const { vanGroepId, fotoId } of sleepData) {
    const vanGroep = groepVindId(vanGroepId);
    const naarGroep = groepVindId(naarGroepId);
    if (!vanGroep || !naarGroep || vanGroepId == naarGroepId) continue;

    // Verwijder uit brongroep
    vanGroep.ids = vanGroep.ids.filter(id => id !== fotoId);
    vanGroep.voorbeelden = vanGroep.voorbeelden.filter(id => id !== fotoId);

    // Voeg toe aan doelgroep
    if (!naarGroep.ids.includes(fotoId)) {
      naarGroep.ids.push(fotoId);
      if (naarGroep.voorbeelden.length < 6) naarGroep.voorbeelden.push(fotoId);
    }
  }

  // Verwijder geselecteerde keys van verplaatste foto's
  for (const { vanGroepId, fotoId } of sleepData) {
    geselecteerd.delete(`${vanGroepId}:${fotoId}`);
  }
  sleepData = [];

  // Verwijder lege tijdgroepen (behalve hold zone en handmatig aangemaakte)
  gpsBulkGroepen = gpsBulkGroepen.filter(g => g.isHold || g.isHandmatig || g.ids.length > 0);

  // Auto-promote hold zone als er geen normale groepen meer zijn maar hold nog foto's heeft
  const holdGroep = gpsBulkGroepen.find(g => g.isHold);
  const heeftNormaleGroepen = gpsBulkGroepen.some(g => !g.isHold);
  if (!heeftNormaleGroepen && holdGroep && holdGroep.ids.length > 0) {
    const nieuw = {
      groep_id: volgendGroepId++,
      datum_start: null, datum_eind: null,
      ids: [...holdGroep.ids],
      voorbeelden: [...holdGroep.voorbeelden],
      isHandmatig: true
    };
    gpsBulkGroepen.splice(gpsBulkGroepen.findIndex(g => g.isHold), 0, nieuw);
    holdGroep.ids = [];
    holdGroep.voorbeelden = [];
  }

  bijwerkInfo();
  renderGroepen();
}

function groepVindId(groepId) {
  const id = groepId === 'hold' ? 'hold' : (isNaN(groepId) ? groepId : parseInt(groepId));
  return gpsBulkGroepen.find(g => g.groep_id == id);
}

// ─── NIEUWE GROEP ────────────────────────────────────────────────────────────

function nieuweGroep() {
  const nieuw = {
    groep_id: volgendGroepId++,
    datum_start: null, datum_eind: null,
    ids: [], voorbeelden: [],
    isHandmatig: true
  };
  // Voeg in vóór hold zone
  const holdIdx = gpsBulkGroepen.findIndex(g => g.isHold);
  gpsBulkGroepen.splice(holdIdx, 0, nieuw);
  renderGroepen();
}

// ─── LOCATIE PICKER ──────────────────────────────────────────────────────────

function openLocatiePicker(groepId) {
  const picker = document.getElementById(`picker-${groepId}`);
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) document.getElementById(`zoek-${groepId}`)?.focus();
}

function zoekBulkLocatie(groepId) {
  clearTimeout(gpsBulkZoekTimers[groepId]);
  const q = document.getElementById(`zoek-${groepId}`).value.trim();
  const resEl = document.getElementById(`res-${groepId}`);
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">Zoeken...</div>';

  gpsBulkZoekTimers[groepId] = setTimeout(async () => {
    try {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&accept-language=en`
      ).then(r => r.json());

      if (!data.length) { resEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">Geen resultaten</div>'; return; }

      if (!window._bulkZoekData) window._bulkZoekData = {};
      window._bulkZoekData[groepId] = data;
      resEl.innerHTML = data.map((r, i) =>
        `<div class="bulk-resultaat" onclick="kiesLocatie('${groepId}', ${i})">${r.display_name}</div>`
      ).join('');
    } catch (e) {
      resEl.innerHTML = '<div style="color:#f87171;padding:8px;font-size:13px">Fout bij zoeken</div>';
    }
  }, 450);
}

function kiesLocatie(groepId, idx) {
  const data = window._bulkZoekData?.[groepId];
  if (!data?.[idx]) return;
  const r = data[idx];
  const addr = r.address || {};
  const stad = addr.city || addr.town || addr.village || addr.hamlet || addr.county || r.name || '';
  const land = addr.country || '';
  const land_code = (addr.country_code || '').toUpperCase();

  gpsBulkGekozen[groepId] = { gps_stad: stad, gps_land: land, gps_lat: parseFloat(r.lat), gps_lon: parseFloat(r.lon), gps_land_code: land_code, gps_adres: r.display_name };

  const vlag = land_code ? landVlag(land_code) : '';
  document.getElementById(`res-${groepId}`).innerHTML = '';
  document.getElementById(`zoek-${groepId}`).style.display = 'none';
  document.getElementById(`gekozen-naam-${groepId}`).textContent = `${vlag} ${[stad, land].filter(Boolean).join(', ')}`.trim();
  document.getElementById(`gekozen-${groepId}`).style.display = 'block';
}

function annuleerBulkLocatie(groepId) {
  delete gpsBulkGekozen[groepId];
  const zoek = document.getElementById(`zoek-${groepId}`);
  zoek.style.display = '';
  zoek.value = '';
  document.getElementById(`res-${groepId}`).innerHTML = '';
  document.getElementById(`gekozen-${groepId}`).style.display = 'none';
}

async function bevestigBulkLocatie(groepId) {
  const locatie = gpsBulkGekozen[groepId];
  const groep = groepVindId(groepId);
  if (!locatie || !groep || groep.ids.length === 0) return;

  const groepEl = document.getElementById(`groep-${groepId}`);
  groepEl.style.opacity = '0.5';
  groepEl.style.pointerEvents = 'none';

  try {
    const r = await fetch('/api/gps/bulk-toewijzen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: groep.ids, ...locatie })
    });
    if (!r.ok) throw new Error();
    const resp = await r.json();

    const vlag = locatie.gps_land_code ? landVlag(locatie.gps_land_code) : '';
    const naamTekst = `${vlag} ${[locatie.gps_stad, locatie.gps_land].filter(Boolean).join(', ')}`.trim();
    const dupTekst = resp.duplicaten_bijgewerkt ? ' (incl. duplicaten)' : '';
    groepEl.innerHTML = `
      <div style="padding:14px 20px;color:#4ade80;font-size:14px">
        ✅ ${resp.bijgewerkt.toLocaleString()} item${resp.bijgewerkt !== 1 ? 's' : ''}${dupTekst} toegewezen aan ${naamTekst}
      </div>`;

    gpsBulkGroepen = gpsBulkGroepen.filter(g => g.groep_id != groepId);
    bijwerkInfo();

    if (gpsBulkGroepen.filter(g => !g.isHold).length === 0) {
      setTimeout(() => {
        document.getElementById('gpsBulkGroepen').innerHTML =
          '<div class="leeg" style="padding:48px;text-align:center;font-size:16px">✅ Alle groepen toegewezen!</div>';
      }, 1200);
    }
  } catch (e) {
    groepEl.style.opacity = '';
    groepEl.style.pointerEvents = '';
    alert('Fout bij opslaan. Probeer opnieuw.');
  }
}

// ─── BULK KAART MODAL ────────────────────────────────────────────────────────

function openBulkKaart(groepId) {
  bulkKaartActieveGroep = groepId;
  bulkKaartGekozenLocatie = null;
  document.getElementById('bulkKaartStatus').textContent = 'Klik op de kaart om een locatie te kiezen';
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
    const stad = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
    const land = addr.country || '';
    const land_code = (addr.country_code || '').toUpperCase();
    const vlag = land_code ? landVlag(land_code) : '';

    bulkKaartGekozenLocatie = {
      gps_stad: stad, gps_land: land,
      gps_lat: lat, gps_lon: lng,
      gps_land_code: land_code,
      gps_adres: data.display_name || ''
    };

    const naamTekst = `${vlag} ${[stad, land].filter(Boolean).join(', ')}`.trim();
    document.getElementById('bulkKaartStatus').textContent = naamTekst || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('bulkKaartGekozenInfo').textContent = naamTekst;
    document.getElementById('bulkKaartOpslaanKnop').disabled = false;
  } catch (e) {
    document.getElementById('bulkKaartStatus').textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    bulkKaartGekozenLocatie = { gps_stad: '', gps_land: '', gps_lat: lat, gps_lon: lng, gps_land_code: '', gps_adres: '' };
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
      if (!data.length) { resEl.innerHTML = '<div style="padding:6px 12px;color:#9ca3af;font-size:13px">Geen resultaten</div>'; return; }
      resEl.innerHTML = data.map((r, i) =>
        `<div class="gps-zoek-resultaat" onclick="kiesBulkKaartResultaat(${i})" data-idx="${i}">${r.display_name}</div>`
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
  // Simuleer klik om locatie in te stellen
  onBulkKaartKlik({ latlng: { lat, lng } });
  document.getElementById('bulkKaartZoekResultaten').innerHTML = '';
  document.getElementById('bulkKaartZoek').value = r.display_name.split(',')[0];
}

function bevestigBulkKaartLocatie() {
  if (!bulkKaartGekozenLocatie || !bulkKaartActieveGroep) return;
  const groepId = bulkKaartActieveGroep;
  gpsBulkGekozen[groepId] = bulkKaartGekozenLocatie;

  const vlag = bulkKaartGekozenLocatie.gps_land_code ? landVlag(bulkKaartGekozenLocatie.gps_land_code) : '';
  const naamTekst = `${vlag} ${[bulkKaartGekozenLocatie.gps_stad, bulkKaartGekozenLocatie.gps_land].filter(Boolean).join(', ')}`.trim();

  // Zorg dat picker open is
  const picker = document.getElementById(`picker-${groepId}`);
  if (picker) picker.style.display = 'block';

  document.getElementById(`zoek-${groepId}`).style.display = 'none';
  document.getElementById(`gekozen-naam-${groepId}`).textContent = naamTekst;
  document.getElementById(`gekozen-${groepId}`).style.display = 'block';
  document.getElementById(`res-${groepId}`).innerHTML = '';

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
