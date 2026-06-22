let huidigePaginaVideo = 1;
let videoZonderGpsFilter = false;
function setVideoZonderGps(aan) { videoZonderGpsFilter = !!aan; }

let videoThumbAutoRefresh = null;

// Poll de thumbnail pass status en ververs de galerij automatisch
async function startVideoThumbPolling() {
  if (videoThumbAutoRefresh) return; // al bezig met pollen

  videoThumbAutoRefresh = setInterval(async () => {
    try {
      const s = await fetch('/api/scan/video-thumbnails/status').then(r => r.json());
      updateVideoThumbBanner(s);

      if (s.bezig) {
        // Herlaad huidige pagina zodat nieuwe thumbnails verschijnen
        await laadVideos(huidigePaginaVideo);
      } else {
        // Klaar — stop polling en herlaad één laatste keer
        clearInterval(videoThumbAutoRefresh);
        videoThumbAutoRefresh = null;
        await laadVideos(huidigePaginaVideo);
        updateVideoThumbBanner(s);
      }
    } catch (_) {}
  }, 5000); // elke 5 seconden
}

function updateVideoThumbBanner(s) {
  const banner = document.getElementById('videoThumbBanner');
  const teller = document.getElementById('videoThumbTeller');
  const knop   = document.getElementById('videoThumbKnop');
  const voortg = document.getElementById('videoThumbVoortgang');
  if (!banner) return;

  if (s.bezig) {
    banner.style.display = 'flex';
    if (teller) teller.textContent = `${s.gedaan} / ${s.totaal} thumbnails aangemaakt`;
    if (knop)   knop.style.display = 'none';
    if (voortg) { voortg.style.display = 'block'; voortg.textContent = `⏳ Bezig op de achtergrond...`; }
  } else if (s.totaal > 0 && s.gedaan === s.totaal) {
    // Zojuist klaar
    banner.style.display = 'flex';
    if (teller) teller.textContent = `✅ ${s.totaal} thumbnails aangemaakt`;
    if (knop)   knop.style.display = 'none';
    if (voortg) { voortg.style.display = 'block'; voortg.textContent = ''; }
    setTimeout(() => { if (banner) banner.style.display = 'none'; }, 4000);
  } else {
    banner.style.display = 'none';
  }
}

async function controleerVideoThumbBanner() {
  try {
    const s = await fetch('/api/scan/video-thumbnails/status').then(r => r.json());
    updateVideoThumbBanner(s);
    if (s.bezig) startVideoThumbPolling();
  } catch (_) {}
}

async function startVideoThumbnails() {
  try {
    await fetch('/api/scan/video-thumbnails', { method: 'POST' });
    startVideoThumbPolling();
  } catch (_) {}
}

async function laadBronnenFilterVideo() {
  const [bronnen, stats] = await Promise.all([
    fetch('/api/bronnen').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ]);
  const t = (k, val) => (window.i18n ? window.i18n.t(k) : val);

  const sel = document.getElementById('filterBronVideo');
  if (sel) {
    sel.innerHTML = `<option value="">${t('filter_alle_bronnen', 'Alle bronnen')}</option>` +
      bronnen.map(b => `<option value="${b.id}">${b.icoon} ${b.naam}</option>`).join('');
  }

  const selJaar = document.getElementById('filterJaarVideo');
  if (selJaar) {
    const huidigJaar = selJaar.value;
    selJaar.innerHTML = `<option value="">${t('filter_alle_jaren', 'Alle jaren')}</option>` +
      (stats.perJaarVideo || stats.perJaar || []).sort((a, b) => b.jaar - a.jaar)
        .map(j => `<option value="${j.jaar}">${j.jaar}</option>`).join('');
    if (huidigJaar) selJaar.value = huidigJaar;
    selJaar.dataset.gevuld = '1';
  }

  const selCamera = document.getElementById('filterCameraVideo');
  if (selCamera) {
    selCamera.innerHTML = `<option value="">${t('filter_alle_cameras', "Alle camera's")}</option>` +
      (stats.perCameraVideo || []).map(c => {
        const label = [c.camera_merk, c.camera_model].filter(Boolean).join(' ') || '?';
        const waarde = `${c.camera_merk || ''}${CAMERA_SEP}${c.camera_model || ''}`;
        return `<option value="${waarde}">${label} (${(c.aantal || 0).toLocaleString()})</option>`;
      }).join('');
  }

  const selLand = document.getElementById('filterLandVideo');
  if (selLand) {
    selLand.innerHTML = `<option value="">${t('filter_alle_landen', 'Alle landen')}</option>` +
      (stats.perLandVideo || []).map(r => {
        const vlag = r.gps_land_code ? landVlag(r.gps_land_code) : landVlagVanNaam(r.gps_land);
        return `<option value="${r.gps_land}">${vlag ? vlag + ' ' : ''}${r.gps_land} (${(r.aantal || 0).toLocaleString()})</option>`;
      }).join('');
  }
}

async function laadVideos(pagina = 1) {
  huidigePaginaVideo = pagina;
  const zoek    = document.getElementById('zoekInputVideo')?.value    || '';
  const bron    = document.getElementById('filterBronVideo')?.value    || '';
  const jaar    = document.getElementById('filterJaarVideo')?.value    || '';
  const camera  = document.getElementById('filterCameraVideo')?.value  || '';
  const land    = document.getElementById('filterLandVideo')?.value    || '';
  const locatie = document.getElementById('filterLocatieVideo')?.value || '';
  const dup     = document.getElementById('filterDupVideo')?.value     || '';

  let cameraMerk = '', cameraModel = '';
  if (camera) { [cameraMerk, cameraModel] = camera.split(CAMERA_SEP); }

  // videoZonderGpsFilter (vanuit dashboard) telt mee als 'zonder locatie'
  const zonderGps = locatie === 'zonder' || videoZonderGpsFilter;

  const params = new URLSearchParams({
    pagina, per_pagina: 100, is_video: 1, zonder_kopien: 1, zonder_thumbnail: 1,
    ...(zoek && { zoek }),
    ...(bron && { bron_id: bron }),
    ...(jaar && { jaar }),
    ...(cameraMerk  && { camera_merk:  cameraMerk }),
    ...(cameraModel && { camera_model: cameraModel }),
    ...(land && { land }),
    ...(locatie === 'met' && { met_gps: 1 }),
    ...(zonderGps && { zonder_gps: 1 }),
    ...(dup === 'uniek'  && { alleen_uniek: 1 }),
    ...(dup === 'dubbel' && { alleen_dubbel: 1 }),
  });

  if (typeof updateFilterBadge === 'function') updateFilterBadge('video');

  const data = await fetch('/api/fotos?' + params).then(r => r.json());

  const teller = document.getElementById('videosTeller');
  if (teller) teller.textContent = `${data.totaal.toLocaleString()} video${data.totaal === 1 ? '' : "'s"}`;

  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  if (data.fotos.length === 0) {
    // Lege pagina maar er zijn wél video's → ga automatisch een pagina terug.
    if (pagina > 1 && data.totaal > 0) { return laadVideos(pagina - 1); }
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">Geen video\'s gevonden</div>';
    document.getElementById('videosPaginering').innerHTML = '';
    return;
  }

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item" onclick="toonVideoDetail(${f.id})">
      ${f.is_duplicaat ? '<div class="dup-badge">DUP</div>' : ''}
      ${f.geexporteerd ? '<div class="export-badge">✓</div>' : ''}
      <div class="video-badge">▶${f.duur ? ' ' + formatDuur(f.duur) : ''}</div>
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.heeft_thumbnail
        ? `<img src="/api/fotos/${f.id}/thumbnail" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">🎬</div>`}
      <div class="info">
        <div class="naam">${f.bestandsnaam}</div>
        <div class="datum">${formatDatum(f.datum_foto)}${f.gps_stad ? ' · ' + f.gps_stad : ''}</div>
      </div>
    </div>
  `).join('');

  // Paginering — gedeelde helper (volledige nummerreeks + snel-spring-knoppen)
  const totaalPaginas = Math.ceil(data.totaal / 100);
  bouwPaginering(document.getElementById('videosPaginering'), pagina, totaalPaginas, laadVideos);
}

async function toonVideoDetail(id) {
  const f = await fetch('/api/fotos/' + id).then(r => r.json());
  huidigeFotoId = f.id;         // nodig voor GPS opslaan
  huidigeItemIsVideo = true;    // zodat gpskaart.js de juiste render-functie aanroept
  renderVideoModal(f);
  document.getElementById('modalOverlay').classList.add('open');
}

function renderVideoModal(f) {
  document.getElementById('modalTitel').textContent = f.bestandsnaam;

  // Inline videospeler met fallback voor niet-ondersteunde codecs (H.265/HEVC)
  document.getElementById('modalImg').innerHTML = `
    <video id="videoSpeler_${f.id}" controls preload="metadata"
      style="width:100%;max-height:340px;background:#000;border-radius:6px;"
      src="/api/fotos/${f.id}/bestand"
      onerror="toonVideoFallback(${f.id})"
      onloadedmetadata="controleerVideoTrack(this, ${f.id})">
    </video>
    <div id="videoFallback_${f.id}" style="display:none; padding:16px; text-align:center; background:#1a1a2e; border-radius:0 0 6px 6px;">
      <div style="font-size:13px; color:#f87171; margin-bottom:10px;">
        ⚠️ Deze video gebruikt H.265/HEVC — Chrome kan dit niet afspelen zonder extra codecs.
      </div>
      <button class="btn btn-primair" onclick="openInSysteemSpeler(${f.id}, event)" style="font-size:13px;">
        ▶ Openen in VLC / systeemspeler
      </button>
    </div>
  `;

  const padEscaped = f.volledig_pad.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const velden = [
    ['Bron',      f.bron_icoon + ' ' + f.bron_naam],
    ['Pad',       `<a href="#" class="pad-link" title="Toon in bestandsbeheerder" onclick="toonInMap(event, ${f.id})">📂 ${padEscaped}</a>`],
    ['Datum',     formatDatum(f.datum_foto) + (f.datum_bron ? ` <span style="color:#6b7280;font-size:11px">(${f.datum_bron})</span>` : '')],
    ['Duur',      f.duur ? formatDuur(f.duur) : '—'],
    ['Grootte',   formatGrootte(f.bestandsgrootte)],
    ['Resolutie', f.breedte && f.hoogte ? `${f.breedte} × ${f.hoogte}` : '—'],
    ['Locatie',   (() => {
      if (!f.gps_stad && !f.gps_land) return '—';
      const vlag = f.gps_land_code ? landVlag(f.gps_land_code) : landVlagVanNaam(f.gps_land);
      return `${vlag} ${[f.gps_stad, f.gps_land].filter(Boolean).join(', ')}`.trim();
    })()],
    ['GPS',       f.gps_lat ? `${f.gps_lat.toFixed(4)}, ${f.gps_lon.toFixed(4)}` : '—'],
    ['Formaat',   f.bestandstype || '—'],
    ['Software',  f.software || '—'],
  ];

  document.getElementById('modalMeta').innerHTML = velden
    .filter(([k, v]) => v && v !== '—')
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');


  // Verberg duplicate locaties sectie
  const dupEl = document.getElementById('modalDuplicaten');
  if (dupEl) dupEl.innerHTML = '';

  // GPS bewerkformulier — zelfde als foto's
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
}

// Controleer na laden of er een videotrack is (anders = H.265 of geen beeld)
function controleerVideoTrack(videoEl, id) {
  // videoWidth=0 betekent geen video track zichtbaar in de browser
  setTimeout(() => {
    if (videoEl.videoWidth === 0) {
      toonVideoFallback(id);
    }
  }, 500);
}

function toonVideoFallback(id) {
  const speler = document.getElementById('videoSpeler_' + id);
  const fallback = document.getElementById('videoFallback_' + id);
  if (speler) speler.style.display = 'none';
  if (fallback) fallback.style.display = 'block';
}

async function openInSysteemSpeler(id, event) {
  // Stuur de absolute schermcoördinaten mee zodat de server VLC op het juiste scherm plaatst
  const mouseX = event?.screenX ?? null;
  const mouseY = event?.screenY ?? null;
  try {
    await fetch('/api/fotos/' + id + '/open-extern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mouseX, mouseY }),
    });
  } catch (e) {
    alert('Kon de systeemspeler niet openen.');
  }
}
