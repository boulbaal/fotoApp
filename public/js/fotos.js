let huidigePagina = 1;
// Altijd originelen tonen — kopieën worden nooit getoond in de galerij

// Actieve filter opgeslagen in DOM (hidden inputs) — robuuster dan JS variabele
function setActieveFilter(filter) {
  const el = document.getElementById('actieveFilters');
  if (!el) return;
  // Sla filter op in data-attribuut
  el.dataset.land         = filter?.params?.land         || '';
  el.dataset.cameraMerk   = filter?.params?.camera_merk  || '';
  el.dataset.cameraModel  = filter?.params?.camera_model || '';
  el.dataset.zonderGps    = filter?.params?.zonder_gps   || '';
  el.dataset.label        = filter?.label                || '';
}

function getActieveFilter() {
  const el = document.getElementById('actieveFilters');
  if (!el) return null;
  const land        = el.dataset.land        || '';
  const cameraMerk  = el.dataset.cameraMerk  || '';
  const cameraModel = el.dataset.cameraModel || '';
  const zonderGps   = el.dataset.zonderGps   || '';
  const label       = el.dataset.label       || '';
  if (!land && !cameraMerk && !cameraModel && !zonderGps) return null;
  const params = {};
  if (land)        params.land         = land;
  if (cameraMerk)  params.camera_merk  = cameraMerk;
  if (cameraModel) params.camera_model = cameraModel;
  if (zonderGps)   params.zonder_gps   = zonderGps;
  return { params, label };
}

function clearActieveFilter() {
  setActieveFilter(null);
  laadFotos(1);
}

// Scheidingsteken om camera_merk + camera_model in één dropdown-waarde te coderen
const CAMERA_SEP = '|::|';

async function laadBronnenFilter() {
  const [bronnen, stats] = await Promise.all([
    fetch('/api/bronnen').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ]);

  const t = (k, val) => (window.i18n ? window.i18n.t(k) : val);

  const selBron = document.getElementById('filterBron');
  selBron.innerHTML = `<option value="">${t('filter_alle_bronnen', 'Alle bronnen')}</option>` +
    bronnen.map(b => `<option value="${b.id}">${b.icoon} ${b.naam}</option>`).join('');

  const selJaar = document.getElementById('filterJaar');
  const huidigJaar = selJaar.value;
  selJaar.innerHTML = `<option value="">${t('filter_alle_jaren', 'Alle jaren')}</option>` +
    (stats.perJaar || []).sort((a, b) => b.jaar - a.jaar)
      .map(j => `<option value="${j.jaar}">${j.jaar} (${j.aantal.toLocaleString()})</option>`)
      .join('');
  if (huidigJaar) selJaar.value = huidigJaar;

  // Camera-filter (merk + model gecodeerd in de waarde)
  const selCamera = document.getElementById('filterCamera');
  if (selCamera) {
    const huidigeCamera = selCamera.value;
    selCamera.innerHTML = `<option value="">${t('filter_alle_cameras', "Alle camera's")}</option>` +
      (stats.perCamera || []).map(c => {
        const label = [c.camera_merk, c.camera_model].filter(Boolean).join(' ') || '?';
        const waarde = `${c.camera_merk || ''}${CAMERA_SEP}${c.camera_model || ''}`;
        return `<option value="${waarde}">${label} (${(c.aantal || 0).toLocaleString()})</option>`;
      }).join('');
    if (huidigeCamera) selCamera.value = huidigeCamera;
  }

  // Land-filter (met vlag-emoji)
  const selLand = document.getElementById('filterLand');
  if (selLand) {
    const huidigLand = selLand.value;
    selLand.innerHTML = `<option value="">${t('filter_alle_landen', 'Alle landen')}</option>` +
      (stats.perLand || []).map(r => {
        const vlag = r.gps_land_code ? landVlag(r.gps_land_code) : landVlagVanNaam(r.gps_land);
        return `<option value="${r.gps_land}">${vlag ? vlag + ' ' : ''}${r.gps_land} (${(r.aantal || 0).toLocaleString()})</option>`;
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

async function laadFotos(pagina = 1) {
  huidigePagina = pagina;
  const zoek    = document.getElementById('zoekInput').value;
  const bron    = document.getElementById('filterBron').value;
  const jaar    = document.getElementById('filterJaar').value;
  const camera  = document.getElementById('filterCamera')?.value  || '';
  const land    = document.getElementById('filterLand')?.value    || '';
  const locatie = document.getElementById('filterLocatie')?.value || '';
  const dup     = document.getElementById('filterDup')?.value     || '';

  // Camera-waarde "merkmodel" splitsen
  let cameraMerk = '', cameraModel = '';
  if (camera) { [cameraMerk, cameraModel] = camera.split(CAMERA_SEP); }

  const actieveFilter = getActieveFilter();

  const params = new URLSearchParams({
    pagina, per_pagina: 200, zonder_thumbnail: 0,
    zonder_kopien: 1, is_video: 0,
    ...(zoek && { zoek }),
    ...(bron && { bron_id: bron }),
    ...(jaar && { jaar }),
    ...(cameraMerk  && { camera_merk:  cameraMerk }),
    ...(cameraModel && { camera_model: cameraModel }),
    ...(land && { land }),
    ...(locatie === 'met'    && { met_gps: 1 }),
    ...(locatie === 'zonder' && { zonder_gps: 1 }),
    ...(dup === 'uniek'  && { alleen_uniek: 1 }),
    ...(dup === 'dubbel' && { alleen_dubbel: 1 }),
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

  console.log('[laadFotos] URL:', '/api/fotos?' + params.toString());

  const data = await fetch('/api/fotos?' + params).then(r => r.json());
  document.getElementById('fotosTeller').textContent = `${data.totaal.toLocaleString()} foto${data.totaal === 1 ? '' : "'s"}`;

  const grid = document.getElementById('fotoGrid');
  if (data.fotos.length === 0) {
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_fotos') + '</div>';
    return;
  }

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item" onclick="toonDetail(${f.id})">
      ${f.is_duplicaat ? '<div class="dup-badge">DUP</div>' : ''}
      ${f.geexporteerd ? '<div class="export-badge">✓</div>' : ''}
      ${f.is_video ? `<div class="video-badge">▶${f.duur ? ' ' + formatDuur(f.duur) : ''}</div>` : ''}
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      <div class="info">
        <div class="naam">${f.bestandsnaam}</div>
        <div class="datum">${formatDatum(f.datum_foto)}${f.gps_stad ? ' · ' + f.gps_stad : ''}</div>
      </div>
    </div>
  `).join('');

  // Paginering
  const totaalPaginas = Math.ceil(data.totaal / 200);
  const pag = document.getElementById('fotosPaginering');
  pag.innerHTML = '';
  if (totaalPaginas > 1) {
    const maakKnop = (tekst, p, actief) => {
      const b = document.createElement('button');
      b.textContent = tekst;
      if (actief) b.classList.add('actief');
      b.onclick = () => laadFotos(p);
      return b;
    };
    if (pagina > 1) pag.appendChild(maakKnop('‹', pagina - 1, false));
    for (let p = Math.max(1, pagina - 2); p <= Math.min(totaalPaginas, pagina + 2); p++) {
      pag.appendChild(maakKnop(p, p, p === pagina));
    }
    if (pagina < totaalPaginas) pag.appendChild(maakKnop('›', pagina + 1, false));
  }
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
  const stad  = (document.getElementById('bewerkStad')?.value  || '').trim();
  const land  = (document.getElementById('bewerkLand')?.value  || '').trim();
  const datum = (document.getElementById('bewerkDatum')?.value || '').trim();
  return stad !== origStad || land !== origLand || datum !== origDatum;
}

async function toonDetail(id) {
  huidigeFotoId = id;
  huidigeItemIsVideo = false;
  const f = await fetch('/api/fotos/' + id).then(r => r.json());
  renderModal(f);
  document.getElementById('modalOverlay').classList.add('open');
}

function renderModal(f) {
  document.getElementById('modalTitel').textContent = f.bestandsnaam;
  document.getElementById('modalImg').innerHTML = (f.thumbnail
    ? `<img src="${f.thumbnail}" alt="${f.bestandsnaam}">`
    : `<div style="font-size:60px;padding:40px">🖼️</div>`)
    + `<a href="/api/fotos/${f.id}/bestand" target="_blank" class="open-origineel-knop">🔍 Open origineel</a>`;

  const padEscaped = f.volledig_pad.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const velden = [
    ['Bron',        f.bron_icoon + ' ' + f.bron_naam],
    ['Pad',         `<a href="#" class="pad-link" title="Toon in bestandsbeheerder" onclick="toonInMap(event, ${f.id})">📂 ${padEscaped}</a>`],
    ['Datum foto',  formatDatum(f.datum_foto) + (f.datum_bron ? ` <span style="color:#6b7280;font-size:11px">(${f.datum_bron})</span>` : '')],
    ['Camera',      [f.camera_merk, f.camera_model].filter(Boolean).join(' ') || '—'],
    ['Lens',        f.lens || '—'],
    ['Grootte',     formatGrootte(f.bestandsgrootte)],
    ['Resolutie',   f.breedte && f.hoogte ? `${f.breedte} × ${f.hoogte}` : '—'],
    ['ISO',         f.iso || '—'],
    ['Sluitertijd', f.sluitertijd || '—'],
    ['Diafragma',   f.diafragma ? 'f/' + f.diafragma : '—'],
    ['Brandpunt',   f.brandpuntsafstand ? f.brandpuntsafstand + ' mm' : '—'],
    ['Locatie',     (() => {
      if (!f.gps_stad && !f.gps_land) return '—';
      const vlag = f.gps_land_code ? landVlag(f.gps_land_code) : landVlagVanNaam(f.gps_land);
      return `${vlag} ${[f.gps_stad, f.gps_land].filter(Boolean).join(', ')}`.trim();
    })()],
    ['GPS',         f.gps_lat ? `${f.gps_lat.toFixed(4)}, ${f.gps_lon.toFixed(4)}` : '—'],
    ['Duplicaat',   f.is_duplicaat
      ? (f.is_origineel ? '✅ Behouden exemplaar — kopieën op andere locaties' : '📋 Kopie — behouden exemplaar op andere locatie')
      : 'Nee'],
    ['Software',    f.software || '—'],
  ];

  document.getElementById('modalMeta').innerHTML = velden
    .filter(([k, v]) => v && v !== '—')
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  // Duplicaatlocaties tonen
  const dupEl = document.getElementById('modalDuplicaten');
  if (dupEl) {
    const locs = f.duplicaat_locaties || [];
    if (locs.length > 0) {
      const titelTekst = f.is_origineel
        ? '📋 Kopieën van dit behouden exemplaar:'
        : '📂 Dit is een kopie — zelfde foto ook op:';

      dupEl.innerHTML = `
        <div class="dup-sectie">
          <div class="dup-sectie-titel">${titelTekst}</div>
          ${locs.map(d => {
            const padEsc = d.volledig_pad.replace(/&/g,'&amp;').replace(/</g,'&lt;');
            const badge = d.is_origineel
              ? '<span class="dup-origineel-badge">BEHOUDEN</span>'
              : '';
            return `<div class="dup-locatie">
              <div style="display:flex;align-items:center;gap:6px">
                <span class="dup-bron">${d.bron_icoon} ${d.bron_naam}</span>
                ${badge}
              </div>
              <a href="#" class="pad-link dup-pad" title="Toon in bestandsbeheerder" onclick="toonInMap(event, ${d.id})">📂 ${padEsc}</a>
              <span class="dup-grootte">${formatGrootte(d.bestandsgrootte)}</span>
            </div>`;
          }).join('')}
        </div>`;
    } else {
      dupEl.innerHTML = '';
    }
  }

  // Bewerkformulier — in tabelstijl, consistent met metadata
  const datumRij = !f.datum_foto ? `
    <tr class="bewerk-tr">
      <td>Datum</td>
      <td><input id="bewerkDatum" type="text" placeholder="dd/mm/yyyy"
        maxlength="10" oninput="formateerDatumInput(this)" class="meta-input"></td>
    </tr>` : `<input type="hidden" id="bewerkDatum" value="${datumNaarDdMmYyyy(f.datum_foto)}">`;

  document.getElementById('modalBewerkFormulier').innerHTML = `
    <table class="meta-tabel bewerk-tabel">
      <tr class="bewerk-tr">
        <td>Stad</td>
        <td><input id="bewerkStad" value="${f.gps_stad || ''}" placeholder="bv. Brussel" class="meta-input"></td>
      </tr>
      <tr class="bewerk-tr">
        <td>Land</td>
        <td><input id="bewerkLand" value="${f.gps_land || ''}" placeholder="bv. Belgium" class="meta-input"></td>
      </tr>
      ${datumRij}
    </table>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button id="opslaanKnop" class="btn btn-primair" style="flex:1;font-size:13px" onclick="slaaBewerkingOpFoto()">💾 Opslaan</button>
      <button class="btn btn-secundair" style="font-size:13px" onclick="openGpsKaart(${f.gps_lat || 'null'}, ${f.gps_lon || 'null'})">📍 GPS kiezen</button>
    </div>
    <div id="bewerkStatus" style="font-size:12px;color:#888;margin-top:6px"></div>
    <button id="verwijderFotoKnop" class="verwijder-definitief-knop" style="width:100%;margin-top:10px"
      onclick="verwijderFotoDefinitief(${f.id})" data-i18n="foto_verwijder">
      🗑️ Definitief verwijderen
    </button>
  `;

  // Sla originelen op voor unsaved-changes detectie
  setTimeout(slaOriginelenOp, 0);

  // Als GPS coördinaten bestaan maar stad/land ontbreekt → auto-geocode
  if (f.gps_lat && f.gps_lon && !f.gps_stad && !f.gps_land) {
    const status = document.getElementById('bewerkStatus');
    status.textContent = '🌍 Locatie ophalen...';
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${f.gps_lat}&lon=${f.gps_lon}&format=json&accept-language=en`)
      .then(r => r.json())
      .then(data => {
        const addr = data.address || {};
        const stad = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
        const land = addr.country || '';
        if (stad) document.getElementById('bewerkStad').value = stad;
        if (land) document.getElementById('bewerkLand').value = land;
        status.textContent = stad || land ? '📍 Locatie ingevuld — sla op om te bewaren' : '';
      })
      .catch(() => { status.textContent = ''; });
  }
}

async function slaaBewerkingOpFoto() {
  const stad  = document.getElementById('bewerkStad').value.trim();
  const land  = document.getElementById('bewerkLand').value.trim();
  const datumTekst = document.getElementById('bewerkDatum')?.value?.trim() || '';
  const status = document.getElementById('bewerkStatus');

  // Zet dd/mm/yyyy om naar ISO string (enkel als veld zichtbaar/ingevuld is)
  let datumIso = null;
  if (datumTekst) {
    const iso = ddMmYyyyNaarIso(datumTekst);
    if (!iso) { status.textContent = '❌ Ongeldige datum (gebruik dd/mm/yyyy)'; return; }
    datumIso = iso;
  }

  const opslaanKnop = document.getElementById('opslaanKnop');
  if (opslaanKnop) { opslaanKnop.disabled = true; opslaanKnop.textContent = '⏳ Opslaan...'; }

  // Als stad én land leeg zijn → wis ook coördinaten
  const wisGps = !stad && !land;
  // Leid land_code af uit ingetypte landnaam (voor correcte vlag)
  const landCode = land ? (LAND_CODES[land] || LAND_CODES[land.trim()] || null) : null;

  const r = await fetch('/api/fotos/' + huidigeFotoId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gps_stad:      stad      || null,
      gps_land:      land      || null,
      gps_land_code: landCode,
      gps_lat:       wisGps ? null : undefined,
      gps_lon:       wisGps ? null : undefined,
      gps_adres:     wisGps ? null : undefined,
      datum_foto: datumIso || undefined,
    })
  });
  if (r.ok) {
    const bijgewerkt = await r.json();
    origStad = ''; origLand = ''; origDatum = ''; // reset vóór render
    if (bijgewerkt.is_video && typeof renderVideoModal === 'function') {
      renderVideoModal(bijgewerkt);
    } else {
      renderModal(bijgewerkt);
    }
    // Knop instellen NA renderModal (renderModal herbouwt het formulier)
    const knopNa = document.getElementById('opslaanKnop');
    if (knopNa) { knopNa.disabled = true; knopNa.textContent = '✅ Opgeslagen'; }

    // Kaart bijwerken bij elke GPS-wijziging (ook nieuwe locatie, niet alleen wissen)
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
    if (opslaanKnop) { opslaanKnop.disabled = false; opslaanKnop.textContent = '💾 Opslaan'; }
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

// Toon een foto (hoofdpad of duplicaat-locatie) in de bestandsbeheerder
async function toonInMap(event, id) {
  if (event) event.preventDefault();
  const link = event && event.currentTarget;
  const oudeTitel = link ? link.getAttribute('title') : null;
  if (link) link.setAttribute('title', 'Bestandsbeheerder openen...');
  try {
    const r = await fetch('/api/fotos/' + id + '/toon-in-map', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Kon de locatie niet openen: ' + (data.fout || 'onbekende fout') +
        (data.pad ? '\n\n' + data.pad : ''));
    }
  } catch (e) {
    alert('Kon de bestandsbeheerder niet openen: ' + e.message);
  } finally {
    if (link && oudeTitel) link.setAttribute('title', oudeTitel);
  }
  return false;
}

// Verwijder de getoonde foto definitief: naar prullenbak + uit database
async function verwijderFotoDefinitief(id) {
  const bevestig = confirm(
    "LET OP — deze foto wordt ECHT verwijderd:\n\n" +
    "• Het bestand gaat naar de prullenbak van je computer (herstelbaar)\n" +
    "• Het wordt uit de database gewist, zodat het niet opnieuw gescand wordt\n\n" +
    "Weet je het zeker?"
  );
  if (!bevestig) return;

  const knop = document.getElementById('verwijderFotoKnop');
  if (knop) { knop.disabled = true; knop.textContent = '🗑️ Bezig met verwijderen...'; }

  try {
    const r = await fetch('/api/fotos/' + id + '/verwijder', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Verwijderen mislukt: ' + (data.fout || data.detail || 'onbekende fout'));
      if (knop) { knop.disabled = false; knop.textContent = '🗑️ Definitief verwijderen'; }
      return;
    }
    // Geen onopgeslagen-waarschuwing meer tonen
    origStad = ''; origLand = ''; origDatum = '';
    document.querySelectorAll('#modalOverlay video').forEach(v => { v.pause(); v.src = ''; });
    document.getElementById('modalOverlay').classList.remove('open');
    // Herlaad de juiste lijst (foto's of video's)
    if (typeof huidigeItemIsVideo !== 'undefined' && huidigeItemIsVideo && typeof laadVideos === 'function') {
      laadVideos(1);
    } else {
      laadFotos(1);
    }
  } catch (e) {
    alert('Verwijderen mislukt: ' + e.message);
    if (knop) { knop.disabled = false; knop.textContent = '🗑️ Definitief verwijderen'; }
  }
}
