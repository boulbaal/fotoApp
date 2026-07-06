let huidigePagina = 1;
// Altijd originelen tonen — kopieën worden nooit getoond in de galerij

// ── Selectie-modus (Fase C batch) ───────────────────────────────────
// Wanneer aan: klikken op een foto selecteert i.p.v. detail openen.
let selectieModus = false;
const geselecteerdeIds = new Set();

function tt(k, f) { return window.i18n ? window.i18n.t(k, f) : f; }

function toggleSelectieModus() {
  selectieModus = !selectieModus;
  if (!selectieModus) geselecteerdeIds.clear();
  const balk = document.getElementById('selectieBalk');
  if (balk) balk.style.display = selectieModus ? 'flex' : 'none';
  const knop = document.getElementById('selectieKnop');
  if (knop) {
    knop.textContent = selectieModus ? '✕ ' + tt('selectie_stop', 'Stop selecting') : '☑️ ' + tt('selectie_start', 'Select');
    knop.classList.toggle('actief', selectieModus);
  }
  werkSelectieUiBij();
  herstelSelectieMarkering();
}

function wisSelectie() {
  geselecteerdeIds.clear();
  werkSelectieUiBij();
  herstelSelectieMarkering();
}

function selecteerAlleZichtbaar() {
  document.querySelectorAll('#fotoGrid .foto-item[data-id]').forEach(el => {
    geselecteerdeIds.add(Number(el.dataset.id));
  });
  werkSelectieUiBij();
  herstelSelectieMarkering();
}

function toggleSelectie(id) {
  if (geselecteerdeIds.has(id)) geselecteerdeIds.delete(id);
  else geselecteerdeIds.add(id);
  werkSelectieUiBij();
  herstelSelectieMarkering();
}

function werkSelectieUiBij() {
  const t = document.getElementById('selectieTeller');
  if (t) t.textContent = `${geselecteerdeIds.size} ${tt('selectie_geselecteerd', 'selected')}`;
}

function herstelSelectieMarkering() {
  document.querySelectorAll('#fotoGrid .foto-item[data-id]').forEach(el => {
    el.classList.toggle('selected', geselecteerdeIds.has(Number(el.dataset.id)));
  });
}

// Centrale klik-afhandeling: in selectiemodus toggelen, anders detail tonen.
function fotoItemKlik(id) {
  if (selectieModus) toggleSelectie(id);
  else toonDetail(id);
}

async function bulkNegeer(negeren) {
  const ids = [...geselecteerdeIds];
  if (ids.length === 0) {
    alert(tt('selectie_niets', 'Select one or more photos first.'));
    return;
  }
  const r = await fetch('/api/photos/ignore-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, ignored: negeren })
  });
  if (!r.ok) { alert(tt('selectie_fout', 'Bulk action failed')); return; }
  geselecteerdeIds.clear();
  werkSelectieUiBij();
  await laadFotos(huidigePagina);
}

// Actieve filter opgeslagen in DOM (hidden inputs) — robuuster dan JS variabele
function setActieveFilter(filter) {
  const el = document.getElementById('actieveFilters');
  if (!el) return;
  // Sla filter op in data-attribuut
  el.dataset.country         = filter?.params?.country         || '';
  el.dataset.cameraMerk   = filter?.params?.camera_make  || '';
  el.dataset.cameraModel  = filter?.params?.camera_model || '';
  el.dataset.withoutGps    = filter?.params?.without_gps   || '';
  el.dataset.label        = filter?.label                || '';
}

function getActieveFilter() {
  const el = document.getElementById('actieveFilters');
  if (!el) return null;
  const country        = el.dataset.country        || '';
  const cameraMerk  = el.dataset.cameraMerk  || '';
  const cameraModel = el.dataset.cameraModel || '';
  const withoutGps   = el.dataset.withoutGps   || '';
  const label       = el.dataset.label       || '';
  if (!country && !cameraMerk && !cameraModel && !withoutGps) return null;
  const params = {};
  if (country)        params.country         = country;
  if (cameraMerk)  params.camera_make  = cameraMerk;
  if (cameraModel) params.camera_model = cameraModel;
  if (withoutGps)   params.without_gps   = withoutGps;
  return { params, label };
}

function clearActieveFilter() {
  setActieveFilter(null);
  laadFotos(1);
}

// Scheidingsteken om camera_make + camera_model in één dropdown-value te coderen
const CAMERA_SEP = '|::|';

async function laadBronnenFilter() {
  const [sources, stats] = await Promise.all([
    fetch('/api/sources').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ]);

  const t = (k, val) => (window.i18n ? window.i18n.t(k) : val);

  const selBron = document.getElementById('filterBron');
  selBron.innerHTML = `<option value="">${t('filter_alle_bronnen', 'All sources')}</option>` +
    sources.map(b => `<option value="${b.id}">${b.icon} ${b.name}</option>`).join('');

  const selJaar = document.getElementById('filterJaar');
  const huidigJaar = selJaar.value;
  selJaar.innerHTML = `<option value="">${t('filter_alle_jaren', 'All years')}</option>` +
    (stats.perYear || []).sort((a, b) => b.year - a.year)
      .map(j => `<option value="${j.year}">${j.year} (${j.count.toLocaleString()})</option>`)
      .join('');
  if (huidigJaar) selJaar.value = huidigJaar;

  // Camera-filter (merk + model gecodeerd in de value)
  const selCamera = document.getElementById('filterCamera');
  if (selCamera) {
    const huidigeCamera = selCamera.value;
    selCamera.innerHTML = `<option value="">${t('filter_alle_cameras', "All cameras")}</option>` +
      (stats.perCamera || []).map(c => {
        const label = [c.camera_make, c.camera_model].filter(Boolean).join(' ') || '?';
        const value = `${c.camera_make || ''}${CAMERA_SEP}${c.camera_model || ''}`;
        return `<option value="${value}">${label} (${(c.count || 0).toLocaleString()})</option>`;
      }).join('');
    if (huidigeCamera) selCamera.value = huidigeCamera;
  }

  // Land-filter (met vlag-emoji)
  const selLand = document.getElementById('filterLand');
  if (selLand) {
    const huidigLand = selLand.value;
    selLand.innerHTML = `<option value="">${t('filter_alle_landen', 'All countries')}</option>` +
      (stats.perCountry || []).map(r => {
        const vlag = r.gps_country_code ? landVlag(r.gps_country_code) : landVlagVanNaam(r.gps_country);
        return `<option value="${r.gps_country}">${vlag ? vlag + ' ' : ''}${r.gps_country} (${(r.count || 0).toLocaleString()})</option>`;
      }).join('');
    if (huidigLand) selLand.value = huidigLand;
  }
}

// Toon/verberg het uitklap-filterpaneel (Optie C)
// Tel actieve filters en werk de badge op de Filters-knop bij (badge optioneel)
function updateFilterBadge(type) {
  const v = type === 'video' ? 'Video' : '';
  const ids = ['filterJaar'+v, 'filterCamera'+v, 'filterLand'+v, 'filterBron'+v, 'filterLocatie'+v, 'filterDup'+v];
  let n = 0;
  ids.forEach(id => { const el = document.getElementById(id); if (el && el.value) n++; });
  const badge = document.getElementById(type === 'video' ? 'filterBadgeVideo' : 'filterBadge');
  if (badge) {
    badge.textContent = n;
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
  }
}

// Wis alle filters van de foto- of videopagina
function wisAlleFilters(type) {
  const v = type === 'video' ? 'Video' : '';
  ['filterJaar'+v, 'filterCamera'+v, 'filterLand'+v, 'filterBron'+v, 'filterLocatie'+v, 'filterDup'+v]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  if (type === 'video') {
    setVideoZonderGps(false);
    laadVideos(1);
  } else {
    setActieveFilter(null);
    laadFotos(1);
  }
}

async function laadFotos(page = 1) {
  huidigePagina = page;
  const search    = document.getElementById('zoekInput').value;
  const bron    = document.getElementById('filterBron').value;
  const year    = document.getElementById('filterJaar').value;
  const camera  = document.getElementById('filterCamera')?.value  || '';
  const country    = document.getElementById('filterLand')?.value    || '';
  const location = document.getElementById('filterLocatie')?.value || '';
  const dup     = document.getElementById('filterDup')?.value     || '';

  // Camera-value "merkmodel" splitsen
  let cameraMerk = '', cameraModel = '';
  if (camera) { [cameraMerk, cameraModel] = camera.split(CAMERA_SEP); }

  const actieveFilter = getActieveFilter();

  const params = new URLSearchParams({
    page, per_page: 50, without_thumbnail: 1,
    without_copies: 1, is_video: 0,
    ...(search && { search }),
    ...(bron && { source_id: bron }),
    ...(year && { year }),
    ...(cameraMerk  && { camera_make:  cameraMerk }),
    ...(cameraModel && { camera_model: cameraModel }),
    ...(country && { country }),
    ...(location === 'with'    && { with_gps: 1 }),
    ...(location === 'without' && { without_gps: 1 }),
    ...(dup === 'unique'  && { unique_only: 1 }),
    ...(dup === 'duplicate' && { duplicates_only: 1 }),
    ...(actieveFilter?.params || {})
  });

  updateFilterBadge('foto');

  // Toon actieve filter chip
  const chipEl = document.getElementById('actieveFilters');
  if (chipEl) {
    chipEl.innerHTML = actieveFilter?.label
      ? `<div class="filter-chip">${actieveFilter.label} <button onclick="clearActieveFilter()" title="Filter wissen">✕</button></div>`
      : '';
  }

  console.log('[laadFotos] URL:', '/api/photos?' + params.toString());

  const data = await fetch('/api/photos?' + params).then(r => r.json());
  document.getElementById('fotosTeller').textContent = `${data.total.toLocaleString()} foto${data.total === 1 ? '' : "'s"}`;

  const grid = document.getElementById('fotoGrid');
  if (data.photos.length === 0) {
    // Lege page maar er zijn wél foto's (bv. laatste item van laatste page
    // net deleted) → ga automatisch een page terug i.p.v. leeg tonen.
    if (page > 1 && data.total > 0) { return laadFotos(page - 1); }
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_fotos') + '</div>';
    return;
  }

  grid.innerHTML = data.photos.map(f => `
    <div class="foto-item${geselecteerdeIds.has(f.id) ? ' selected' : ''}" data-id="${f.id}" onclick="fotoItemKlik(${f.id})">
      <div class="selectie-vink">✓</div>
      ${f.is_duplicate ? '<div class="dup-badge">DUP</div>' : ''}
      ${f.exported ? '<div class="export-badge">✓</div>' : ''}
      ${f.is_video ? `<div class="video-badge">▶${f.duration ? ' ' + formatDuur(f.duration) : ''}</div>` : ''}
      <div class="bron-badge">${f.source_icon || '💻'}</div>
      ${f.has_thumbnail
        ? `<img src="/api/photos/${f.id}/thumbnail" loading="lazy" alt="${f.filename}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      <div class="info">
        <div class="name">${f.filename}</div>
        <div class="date">${formatDatum(f.photo_date)}${f.gps_city ? ' · ' + f.gps_city : ''}</div>
      </div>
    </div>
  `).join('');

  // Paginering
  const totaalPaginas = Math.ceil(data.total / 50);
  bouwPaginering(document.getElementById('fotosPaginering'), page, totaalPaginas, laadFotos);
}

// Herbruikbare paginering. Vaste indeling, links én rechts symmetrisch:
//   «  ‹‹(−10)  ‹(−1)   [ venster van max 10 paginanummers ]   ›(+1)  ››(+10)  »
// Het nummervenster schuift mee met de huidige page (altijd 10 nummers
// when there are enough pages). Shared by photos, videos, duplicates.
const PAG_VENSTER = 10;
function bouwPaginering(pag, page, totaalPaginas, laadFn) {
  pag.innerHTML = '';
  if (totaalPaginas <= 1) return;

  const maakKnop = (tekst, p, opties = {}) => {
    const b = document.createElement('button');
    b.textContent = tekst;
    if (opties.actief) b.classList.add('actief');
    if (opties.titel) b.title = opties.titel;
    if (opties.uit) { b.disabled = true; b.classList.add('uit'); }
    else b.onclick = () => laadFn(p);
    return b;
  };

  // Spring-knoppen vooraan (links)
  pag.appendChild(maakKnop('«',  1,                          { titel: 'First page', uit: page === 1 }));
  pag.appendChild(maakKnop('‹‹', Math.max(1, page - 10),   { titel: '10 back',      uit: page === 1 }));
  pag.appendChild(maakKnop('‹',  page - 1,                 { titel: 'Previous',        uit: page === 1 }));

  // Schuivend venster van (max) 10 nummers, gecentreerd op de huidige page.
  let start = Math.max(1, page - Math.floor(PAG_VENSTER / 2));
  let einde = Math.min(totaalPaginas, start + PAG_VENSTER - 1);
  start = Math.max(1, einde - PAG_VENSTER + 1);   // herijken zodat er 10 getoond worden
  for (let p = start; p <= einde; p++) {
    pag.appendChild(maakKnop(p, p, { actief: p === page }));
  }

  // Spring-knoppen achteraan (rechts) — spiegelbeeld van links
  pag.appendChild(maakKnop('›',  page + 1,                                 { titel: 'Next',      uit: page === totaalPaginas }));
  pag.appendChild(maakKnop('››', Math.min(totaalPaginas, page + 10),       { titel: '10 forward',    uit: page === totaalPaginas }));
  pag.appendChild(maakKnop('»',  totaalPaginas,                              { titel: 'Last page', uit: page === totaalPaginas }));
}

let huidigeFotoId = null;
let huidigeItemIsVideo = false;
let origStad = '';
let origLand = '';
let origDatum = '';

function slaOriginelenOp() {
  origStad  = (document.getElementById('bewerkStad')?.value  || '').trim();
  origLand  = (document.getElementById('bewerkLand')?.value  || '').trim();
  origDatum = (document.getElementById('bewerkDatum')?.value || '').trim();
}

function heeftOnopgeslagenWijzigingen() {
  const city  = (document.getElementById('bewerkStad')?.value  || '').trim();
  const country  = (document.getElementById('bewerkLand')?.value  || '').trim();
  const date = (document.getElementById('bewerkDatum')?.value || '').trim();
  return city !== origStad || country !== origLand || date !== origDatum;
}

async function toonDetail(id) {
  huidigeFotoId = id;
  huidigeItemIsVideo = false;
  const f = await fetch('/api/photos/' + id).then(r => r.json());
  renderModal(f);
  document.getElementById('modalOverlay').classList.add('open');
}

function renderModal(f) {
  document.getElementById('modalTitel').textContent = f.filename;
  document.getElementById('modalImg').innerHTML = (f.thumbnail
    ? `<img src="${f.thumbnail}" alt="${f.filename}">`
    : `<div style="font-size:60px;padding:40px">🖼️</div>`)
    + `<a href="/api/photos/${f.id}/file" target="_blank" class="open-origineel-knop">🔍 Open original</a>`;

  const padEscaped = f.full_path.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const velden = [
    ['Source',        f.source_icon + ' ' + f.source_name],
    ['Path',         `<a href="#" class="path-link" title="Show in file manager" onclick="toonInMap(event, ${f.id})">📂 ${padEscaped}</a>`],
    ['Photo date',  formatDatum(f.photo_date) + (f.date_source ? ` <span style="color:#6b7280;font-size:11px">(${f.date_source})</span>` : '')],
    ['Camera',      [f.camera_make, f.camera_model].filter(Boolean).join(' ') || '—'],
    ['Lens',        f.lens || '—'],
    ['Size',     formatGrootte(f.file_size)],
    ['Resolution',   f.width && f.height ? `${f.width} × ${f.height}` : '—'],
    ['ISO',         f.iso || '—'],
    ['Shutter speed', f.shutter_speed || '—'],
    ['Aperture',   f.aperture ? 'f/' + f.aperture : '—'],
    ['Focal length',   f.focal_length ? f.focal_length + ' mm' : '—'],
    ['Location',     (() => {
      if (!f.gps_city && !f.gps_country) return '—';
      const vlag = f.gps_country_code ? landVlag(f.gps_country_code) : landVlagVanNaam(f.gps_country);
      return `${vlag} ${[f.gps_city, f.gps_country].filter(Boolean).join(', ')}`.trim();
    })()],
    ['GPS',         f.gps_lat ? `${f.gps_lat.toFixed(4)}, ${f.gps_lon.toFixed(4)}` : '—'],
    ['Duplicate',   f.is_duplicate
      ? (f.is_original ? '✅ Kept copy — duplicates at other locations' : '📋 Copy — kept copy at another location')
      : 'No'],
    ['Software',    f.software || '—'],
  ];

  document.getElementById('modalMeta').innerHTML = velden
    .filter(([k, v]) => v && v !== '—')
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  // Duplicaatlocaties tonen
  const dupEl = document.getElementById('modalDuplicaten');
  if (dupEl) {
    const locs = f.duplicate_locations || [];
    if (locs.length > 0) {
      const titelTekst = f.is_original
        ? '📋 Copies of this kept original:'
        : '📂 This is a copy — same photo also at:';

      dupEl.innerHTML = `
        <div class="dup-sectie">
          <div class="dup-sectie-titel">${titelTekst}</div>
          ${locs.map(d => {
            const padEsc = d.full_path.replace(/&/g,'&amp;').replace(/</g,'&lt;');
            const badge = d.is_original
              ? '<span class="dup-origineel-badge">BEHOUDEN</span>'
              : '';
            return `<div class="dup-location">
              <div style="display:flex;align-items:center;gap:6px">
                <span class="dup-bron">${d.source_icon} ${d.source_name}</span>
                ${badge}
              </div>
              <a href="#" class="path-link dup-path" title="Show in file manager" onclick="toonInMap(event, ${d.id})">📂 ${padEsc}</a>
              <span class="dup-size">${formatGrootte(d.file_size)}</span>
            </div>`;
          }).join('')}
        </div>`;
    } else {
      dupEl.innerHTML = '';
    }
  }

  // Bewerkformulier — in tabelstijl, consistent met metadata
  const datumRij = !f.photo_date ? `
    <tr class="bewerk-tr">
      <td>Datum</td>
      <td><input id="bewerkDatum" type="text" placeholder="dd/mm/yyyy"
        maxlength="10" oninput="formateerDatumInput(this)" class="meta-input"></td>
    </tr>` : `<input type="hidden" id="bewerkDatum" value="${datumNaarDdMmYyyy(f.photo_date)}">`;

  document.getElementById('modalBewerkFormulier').innerHTML = `
    <table class="meta-tabel bewerk-tabel">
      <tr class="bewerk-tr">
        <td>City</td>
        <td><input id="bewerkStad" value="${f.gps_city || ''}" placeholder="e.g. Brussels" class="meta-input"></td>
      </tr>
      <tr class="bewerk-tr">
        <td>Country</td>
        <td><input id="bewerkLand" value="${f.gps_country || ''}" placeholder="e.g. Belgium" class="meta-input"></td>
      </tr>
      ${datumRij}
    </table>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button id="opslaanKnop" class="btn btn-primair" style="flex:1;font-size:13px" onclick="slaaBewerkingOpFoto()">💾 Save</button>
      <button class="btn btn-secundair" style="font-size:13px" onclick="openGpsKaart(${f.gps_lat || 'null'}, ${f.gps_lon || 'null'})">📍 Pick GPS</button>
    </div>
    <div id="bewerkStatus" style="font-size:12px;color:#888;margin-top:6px"></div>
    <button id="verwijderFotoKnop" class="delete-definitief-knop" style="width:100%;margin-top:10px"
      onclick="verwijderFotoDefinitief(${f.id})" data-i18n="foto_verwijder">
      🗑️ Permanently delete
    </button>
  `;

  // Sla originelen op voor unsaved-changes detectie
  setTimeout(slaOriginelenOp, 0);

  // Als GPS coördinaten bestaan maar city/country ontbreekt → auto-geocode
  if (f.gps_lat && f.gps_lon && !f.gps_city && !f.gps_country) {
    const status = document.getElementById('bewerkStatus');
    status.textContent = '🌍 Locatie ophalen...';
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${f.gps_lat}&lon=${f.gps_lon}&format=json&accept-language=en`)
      .then(r => r.json())
      .then(data => {
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
        const country = addr.country || '';
        if (city) document.getElementById('bewerkStad').value = city;
        if (country) document.getElementById('bewerkLand').value = country;
        status.textContent = city || country ? '📍 Locatie ingevuld — sla op om te bewaren' : '';
      })
      .catch(() => { status.textContent = ''; });
  }
}

async function slaaBewerkingOpFoto() {
  const city  = document.getElementById('bewerkStad').value.trim();
  const country  = document.getElementById('bewerkLand').value.trim();
  const datumTekst = document.getElementById('bewerkDatum')?.value?.trim() || '';
  const status = document.getElementById('bewerkStatus');

  // Zet dd/mm/yyyy om naar ISO string (enkel als veld zichtbaar/ingevuld is)
  let datumIso = null;
  if (datumTekst) {
    const iso = ddMmYyyyNaarIso(datumTekst);
    if (!iso) { status.textContent = '❌ Ongeldige date (gebruik dd/mm/yyyy)'; return; }
    datumIso = iso;
  }

  const opslaanKnop = document.getElementById('opslaanKnop');
  if (opslaanKnop) { opslaanKnop.disabled = true; opslaanKnop.textContent = '⏳ Opslaan...'; }

  // Als city én country leeg zijn → delete ook coördinaten
  const wisGps = !city && !country;
  // Leid land_code af uit ingetypte landnaam (voor correcte vlag)
  const landCode = country ? (LAND_CODES[country] || LAND_CODES[country.trim()] || null) : null;

  const r = await fetch('/api/photos/' + huidigeFotoId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gps_city:      city      || null,
      gps_country:      country      || null,
      gps_country_code: landCode,
      gps_lat:       wisGps ? null : undefined,
      gps_lon:       wisGps ? null : undefined,
      gps_address:     wisGps ? null : undefined,
      photo_date: datumIso || undefined,
    })
  });
  if (r.ok) {
    const updated = await r.json();
    origStad = ''; origLand = ''; origDatum = ''; // reset vóór render
    if (updated.is_video && typeof renderVideoModal === 'function') {
      renderVideoModal(updated);
    } else {
      renderModal(updated);
    }
    // Knop instellen NA renderModal (renderModal herbouwt het formulier)
    const knopNa = document.getElementById('opslaanKnop');
    if (knopNa) { knopNa.disabled = true; knopNa.textContent = '✅ Opgeslagen'; }

    // Kaart bijwerken bij elke GPS-wijziging (ook nieuwe location, niet alleen wissen)
    if (typeof herlaadLocaties === 'function') herlaadLocaties();

    // Kaart-panel herladen als het open is
    const panelOpen = document.getElementById('kaartPanelOverlay')?.classList.contains('open');
    if (panelOpen && typeof laadPanelFotos === 'function') {
      await laadPanelFotos();
    }

    // Auto-close na 1 seconde
    setTimeout(() => {
      document.querySelectorAll('#modalOverlay video').forEach(v => { v.pause(); v.src = ''; });
      document.getElementById('modalOverlay').classList.remove('open');
      origStad = ''; origLand = ''; origDatum = '';
    }, 1000);
  } else {
    if (opslaanKnop) { opslaanKnop.disabled = false; opslaanKnop.textContent = '💾 Save'; }
    status.textContent = '❌ Fout bij opslaan';
  }
}

function openGpsKaart(lat, lon) {
  document.getElementById('gpsKaartOverlay').classList.add('open');
  initGpsKaart(lat || null, lon || null);
  if (typeof gpsKaart !== 'undefined' && gpsKaart) setTimeout(() => gpsKaart.invalidateSize(), 100);
}

function sluitModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    if (heeftOnopgeslagenWijzigingen()) {
      if (!confirm('⚠️ Je hebt onopgeslagen wijzigingen.\n\nWil je toch sluiten zonder op te slaan?')) return;
    }
    // Stop alle video's in de modal zodat geluid niet blijft spelen
    document.querySelectorAll('#modalOverlay video').forEach(v => { v.pause(); v.src = ''; });
    document.getElementById('modalOverlay').classList.remove('open');
    origStad = ''; origLand = ''; origDatum = '';
  }
}

// Toon een foto (hoofdpad of duplicaat-location) in de bestandsbeheerder
async function toonInMap(event, id) {
  if (event) event.preventDefault();
  const link = event && event.currentTarget;
  const oudeTitel = link ? link.getAttribute('title') : null;
  if (link) link.setAttribute('title', 'Opening file manager...');
  try {
    const r = await fetch('/api/photos/' + id + '/show-in-folder', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Could not open the location: ' + (data.error || 'unknown error') +
        (data.path ? '\n\n' + data.path : ''));
    }
  } catch (e) {
    alert('Could not open the file manager: ' + e.message);
  } finally {
    if (link && oudeTitel) link.setAttribute('title', oudeTitel);
  }
  return false;
}

// Verwijder de getoonde foto definitief: naar prullenbak + uit database
async function verwijderFotoDefinitief(id) {
  const bevestig = confirm(
    "WARNING — this photo will be PERMANENTLY deleted:\n\n" +
    "• The file goes to your computer's trash (recoverable)\n" +
    "• It is removed from the database so it will not be rescanned\n\n" +
    "Are you sure?"
  );
  if (!bevestig) return;

  const knop = document.getElementById('verwijderFotoKnop');
  if (knop) { knop.disabled = true; knop.textContent = '🗑️ Deleting...'; }

  try {
    const r = await fetch('/api/photos/' + id + '/delete', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Delete failed: ' + (data.error || data.detail || 'unknown error'));
      if (knop) { knop.disabled = false; knop.textContent = '🗑️ Permanently delete'; }
      return;
    }
    // Geen onopgeslagen-waarschuwing meer tonen
    origStad = ''; origLand = ''; origDatum = '';
    document.querySelectorAll('#modalOverlay video').forEach(v => { v.pause(); v.src = ''; });
    document.getElementById('modalOverlay').classList.remove('open');
    // Herlaad de juiste lijst op DEZELFDE page (niet terug naar 1).
    // Als dit het laatste item op de laatste page was, vangt de lege-page
    // afhandeling in laadFotos/laadVideos dit op en gaat een page terug.
    if (typeof huidigeItemIsVideo !== 'undefined' && huidigeItemIsVideo && typeof laadVideos === 'function') {
      laadVideos(typeof huidigePaginaVideo !== 'undefined' ? huidigePaginaVideo : 1);
    } else {
      laadFotos(typeof huidigePagina !== 'undefined' ? huidigePagina : 1);
    }
    // Was het detail vanuit het kaart-popup geopend? Dan dat paneel + de
    // marker-tellingen ook verversen, anders blijft de verwijderde foto staan.
    const kaartPanel = document.getElementById('kaartPanelOverlay');
    if (kaartPanel && kaartPanel.classList.contains('open') &&
        typeof actieveLocatie !== 'undefined' && actieveLocatie) {
      if (typeof laadPanelFotos === 'function') laadPanelFotos();
      if (typeof herlaadLocaties === 'function') herlaadLocaties();
    }
  } catch (e) {
    alert('Delete failed: ' + e.message);
    if (knop) { knop.disabled = false; knop.textContent = '🗑️ Permanently delete'; }
  }
}
