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

async function laadBronnenFilter() {
  const [bronnen, stats] = await Promise.all([
    fetch('/api/bronnen').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ]);

  const selBron = document.getElementById('filterBron');
  selBron.innerHTML = '<option value="">Alle bronnen</option>' +
    bronnen.map(b => `<option value="${b.id}">${b.icoon} ${b.naam}</option>`).join('');

  const selJaar = document.getElementById('filterJaar');
  const huidigJaar = selJaar.value;
  selJaar.innerHTML = '<option value="">Alle jaren</option>' +
    (stats.perJaar || []).sort((a, b) => b.jaar - a.jaar)
      .map(j => `<option value="${j.jaar}">${j.jaar} (${j.aantal.toLocaleString()})</option>`)
      .join('');
  if (huidigJaar) selJaar.value = huidigJaar;
}

async function laadFotos(pagina = 1) {
  huidigePagina = pagina;
  const zoek = document.getElementById('zoekInput').value;
  const bron = document.getElementById('filterBron').value;
  const jaar = document.getElementById('filterJaar').value;

  const actieveFilter = getActieveFilter();

  const params = new URLSearchParams({
    pagina, per_pagina: 200, zonder_thumbnail: 0,
    zonder_kopien: 1,
    ...(zoek && { zoek }),
    ...(bron && { bron_id: bron }),
    ...(jaar && { jaar }),
    ...(actieveFilter?.params || {})
  });

  // Toon actieve filter chip
  const chipEl = document.getElementById('actieveFilters');
  if (chipEl) {
    chipEl.innerHTML = actieveFilter?.label
      ? `<div class="filter-chip">${actieveFilter.label} <button onclick="clearActieveFilter()" title="Filter wissen">✕</button></div>`
      : '';
  }

  console.log('[laadFotos] URL:', '/api/fotos?' + params.toString());

  const data = await fetch('/api/fotos?' + params).then(r => r.json());
  document.getElementById('fotosTeller').textContent = `${data.totaal.toLocaleString()} foto's`;

  const grid = document.getElementById('fotoGrid');
  if (data.fotos.length === 0) {
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">Geen foto\'s gevonden</div>';
    return;
  }

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item" onclick="toonDetail(${f.id})">
      ${f.is_duplicaat ? '<div class="dup-badge">DUP</div>' : ''}
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">🖼️</div>`}
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
    ['Pad',         `<a href="/api/fotos/${f.id}/bestand" target="_blank" class="pad-link">${padEscaped}</a>`],
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
      ? (f.is_origineel ? '✅ Origineel — kopieën op andere locaties' : '📋 Kopie — origineel op andere locatie')
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
        ? '📋 Kopieën van dit origineel:'
        : '📂 Dit is een kopie — zelfde foto ook op:';

      dupEl.innerHTML = `
        <div class="dup-sectie">
          <div class="dup-sectie-titel">${titelTekst}</div>
          ${locs.map(d => {
            const padEsc = d.volledig_pad.replace(/&/g,'&amp;').replace(/</g,'&lt;');
            const badge = d.is_origineel
              ? '<span class="dup-origineel-badge">ORIGINEEL</span>'
              : '';
            return `<div class="dup-locatie">
              <div style="display:flex;align-items:center;gap:6px">
                <span class="dup-bron">${d.bron_icoon} ${d.bron_naam}</span>
                ${badge}
              </div>
              <a href="/api/fotos/${d.id}/bestand" target="_blank" class="pad-link dup-pad">${padEsc}</a>
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
      <button class="btn btn-secundair" style="font-size:13px" onclick="openGpsKaart()">📍 GPS kiezen</button>
    </div>
    <div id="bewerkStatus" style="font-size:12px;color:#888;margin-top:6px"></div>
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
  const datumTekst = document.getElementById('bewerkDatum').value.trim();
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
    origStad = ''; origLand = ''; origDatum = ''; // reset vóór renderModal
    renderModal(bijgewerkt);
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
      document.getElementById('modalOverlay').classList.remove('open');
      origStad = ''; origLand = ''; origDatum = '';
    }, 1000);
  } else {
    if (opslaanKnop) { opslaanKnop.disabled = false; opslaanKnop.textContent = '💾 Opslaan'; }
    status.textContent = '❌ Fout bij opslaan';
  }
}

function openGpsKaart() {
  document.getElementById('gpsKaartOverlay').classList.add('open');
  initGpsKaart();
  if (typeof gpsKaart !== 'undefined' && gpsKaart) setTimeout(() => gpsKaart.invalidateSize(), 100);
}

function sluitModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    if (heeftOnopgeslagenWijzigingen()) {
      if (!confirm('⚠️ Je hebt onopgeslagen wijzigingen.\n\nWil je toch sluiten zonder op te slaan?')) return;
    }
    document.getElementById('modalOverlay').classList.remove('open');
    origStad = ''; origLand = ''; origDatum = '';
  }
}
