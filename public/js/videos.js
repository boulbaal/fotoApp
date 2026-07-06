let huidigePaginaVideo = 1;
let videoZonderGpsFilter = false;
function setVideoZonderGps(aan) { videoZonderGpsFilter = !!aan; }

let videoThumbAutoRefresh = null;

// Poll de thumbnail pass status en ververs de galerij automatisch
async function startVideoThumbPolling() {
  if (videoThumbAutoRefresh) return; // al running met pollen

  videoThumbAutoRefresh = setInterval(async () => {
    try {
      const s = await fetch('/api/scan/video-thumbnails/status').then(r => r.json());
      updateVideoThumbBanner(s);

      if (s.running) {
        // Herlaad huidige page zodat nieuwe thumbnails verschijnen
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

  if (s.running) {
    banner.style.display = 'flex';
    if (teller) teller.textContent = `${s.done} / ${s.total} thumbnails aangemaakt`;
    if (knop)   knop.style.display = 'none';
    if (voortg) { voortg.style.display = 'block'; voortg.textContent = `⏳ Running in the background...`; }
  } else if (s.total > 0 && s.done === s.total) {
    // Zojuist ready
    banner.style.display = 'flex';
    if (teller) teller.textContent = `✅ ${s.total} thumbnails aangemaakt`;
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
    if (s.running) startVideoThumbPolling();
  } catch (_) {}
}

async function startVideoThumbnails() {
  try {
    await fetch('/api/scan/video-thumbnails', { method: 'POST' });
    startVideoThumbPolling();
  } catch (_) {}
}

async function laadBronnenFilterVideo() {
  const [sources, stats] = await Promise.all([
    fetch('/api/sources').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ]);
  const t = (k, val) => (window.i18n ? window.i18n.t(k) : val);

  const sel = document.getElementById('filterBronVideo');
  if (sel) {
    sel.innerHTML = `<option value="">${t('filter_alle_bronnen', 'All sources')}</option>` +
      sources.map(b => `<option value="${b.id}">${b.icon} ${b.name}</option>`).join('');
  }

  const selJaar = document.getElementById('filterJaarVideo');
  if (selJaar) {
    const huidigJaar = selJaar.value;
    selJaar.innerHTML = `<option value="">${t('filter_alle_jaren', 'All years')}</option>` +
      (stats.perYearVideo || stats.perYear || []).sort((a, b) => b.year - a.year)
        .map(j => `<option value="${j.year}">${j.year}</option>`).join('');
    if (huidigJaar) selJaar.value = huidigJaar;
    selJaar.dataset.gevuld = '1';
  }

  const selCamera = document.getElementById('filterCameraVideo');
  if (selCamera) {
    selCamera.innerHTML = `<option value="">${t('filter_alle_cameras', "All cameras")}</option>` +
      (stats.perCameraVideo || []).map(c => {
        const label = [c.camera_make, c.camera_model].filter(Boolean).join(' ') || '?';
        const value = `${c.camera_make || ''}${CAMERA_SEP}${c.camera_model || ''}`;
        return `<option value="${value}">${label} (${(c.count || 0).toLocaleString()})</option>`;
      }).join('');
  }

  const selLand = document.getElementById('filterLandVideo');
  if (selLand) {
    selLand.innerHTML = `<option value="">${t('filter_alle_landen', 'All countries')}</option>` +
      (stats.perCountryVideo || []).map(r => {
        const vlag = r.gps_country_code ? landVlag(r.gps_country_code) : landVlagVanNaam(r.gps_country);
        return `<option value="${r.gps_country}">${vlag ? vlag + ' ' : ''}${r.gps_country} (${(r.count || 0).toLocaleString()})</option>`;
      }).join('');
  }
}

async function laadVideos(page = 1) {
  huidigePaginaVideo = page;
  const search    = document.getElementById('zoekInputVideo')?.value    || '';
  const bron    = document.getElementById('filterBronVideo')?.value    || '';
  const year    = document.getElementById('filterJaarVideo')?.value    || '';
  const camera  = document.getElementById('filterCameraVideo')?.value  || '';
  const country    = document.getElementById('filterLandVideo')?.value    || '';
  const location = document.getElementById('filterLocatieVideo')?.value || '';
  const dup     = document.getElementById('filterDupVideo')?.value     || '';

  let cameraMerk = '', cameraModel = '';
  if (camera) { [cameraMerk, cameraModel] = camera.split(CAMERA_SEP); }

  // videoZonderGpsFilter (vanuit dashboard) telt mee als 'without location'
  const withoutGps = location === 'without' || videoZonderGpsFilter;

  const params = new URLSearchParams({
    page, per_page: 50, is_video: 1, without_copies: 1, without_thumbnail: 1,
    ...(search && { search }),
    ...(bron && { source_id: bron }),
    ...(year && { year }),
    ...(cameraMerk  && { camera_make:  cameraMerk }),
    ...(cameraModel && { camera_model: cameraModel }),
    ...(country && { country }),
    ...(location === 'with' && { with_gps: 1 }),
    ...(withoutGps && { without_gps: 1 }),
    ...(dup === 'unique'  && { unique_only: 1 }),
    ...(dup === 'duplicate' && { duplicates_only: 1 }),
  });

  if (typeof updateFilterBadge === 'function') updateFilterBadge('video');

  const data = await fetch('/api/photos?' + params).then(r => r.json());

  const teller = document.getElementById('videosTeller');
  if (teller) teller.textContent = `${data.total.toLocaleString()} video${data.total === 1 ? '' : "'s"}`;

  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  if (data.photos.length === 0) {
    // Lege page maar er zijn wél video's → ga automatisch een page terug.
    if (page > 1 && data.total > 0) { return laadVideos(page - 1); }
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">No videos found</div>';
    document.getElementById('videosPaginering').innerHTML = '';
    return;
  }

  grid.innerHTML = data.photos.map(f => `
    <div class="foto-item" onclick="toonVideoDetail(${f.id})">
      ${f.is_duplicate ? '<div class="dup-badge">DUP</div>' : ''}
      ${f.exported ? '<div class="export-badge">✓</div>' : ''}
      <div class="video-badge">▶${f.duration ? ' ' + formatDuur(f.duration) : ''}</div>
      <div class="bron-badge">${f.source_icon || '💻'}</div>
      ${f.has_thumbnail
        ? `<img src="/api/photos/${f.id}/thumbnail" loading="lazy" alt="${f.filename}">`
        : `<div class="no-img">🎬</div>`}
      <div class="info">
        <div class="name">${f.filename}</div>
        <div class="date">${formatDatum(f.photo_date)}${f.gps_city ? ' · ' + f.gps_city : ''}</div>
      </div>
    </div>
  `).join('');

  // Paginering — gedeelde helper (volledige nummerreeks + snel-spring-knoppen)
  const totaalPaginas = Math.ceil(data.total / 50);
  bouwPaginering(document.getElementById('videosPaginering'), page, totaalPaginas, laadVideos);
}

async function toonVideoDetail(id) {
  const f = await fetch('/api/photos/' + id).then(r => r.json());
  huidigeFotoId = f.id;         // nodig voor GPS opslaan
  huidigeItemIsVideo = true;    // zodat gpskaart.js de juiste render-functie aanroept
  renderVideoModal(f);
  document.getElementById('modalOverlay').classList.add('open');
}

function renderVideoModal(f) {
  document.getElementById('modalTitel').textContent = f.filename;

  // Inline videospeler met fallback voor niet-ondersteunde codecs (H.265/HEVC)
  document.getElementById('modalImg').innerHTML = `
    <video id="videoSpeler_${f.id}" controls preload="metadata"
      style="width:100%;max-height:340px;background:#000;border-radius:6px;"
      src="/api/photos/${f.id}/file"
      onerror="toonVideoFallback(${f.id})"
      onloadedmetadata="controleerVideoTrack(this, ${f.id})">
    </video>
    <div id="videoFallback_${f.id}" style="display:none; padding:16px; text-align:center; background:#1a1a2e; border-radius:0 0 6px 6px;">
      <div style="font-size:13px; color:#f87171; margin-bottom:10px;">
        ⚠️ Deze video gebruikt H.265/HEVC — Chrome kan dit niet afspelen zonder extra codecs.
      </div>
      <button class="btn btn-primair" onclick="openInSysteemSpeler(${f.id}, event)" style="font-size:13px;">
        ▶ Open in VLC / system player
      </button>
    </div>
  `;

  const padEscaped = f.full_path.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const velden = [
    ['Source',      f.source_icon + ' ' + f.source_name],
    ['Path',       `<a href="#" class="path-link" title="Show in file manager" onclick="toonInMap(event, ${f.id})">📂 ${padEscaped}</a>`],
    ['Date',     formatDatum(f.photo_date) + (f.date_source ? ` <span style="color:#6b7280;font-size:11px">(${f.date_source})</span>` : '')],
    ['Duration',      f.duration ? formatDuur(f.duration) : '—'],
    ['Size',   formatGrootte(f.file_size)],
    ['Resolution', f.width && f.height ? `${f.width} × ${f.height}` : '—'],
    ['Location',   (() => {
      if (!f.gps_city && !f.gps_country) return '—';
      const vlag = f.gps_country_code ? landVlag(f.gps_country_code) : landVlagVanNaam(f.gps_country);
      return `${vlag} ${[f.gps_city, f.gps_country].filter(Boolean).join(', ')}`.trim();
    })()],
    ['GPS',       f.gps_lat ? `${f.gps_lat.toFixed(4)}, ${f.gps_lon.toFixed(4)}` : '—'],
    ['Format',   f.file_type || '—'],
    ['Software',  f.software || '—'],
  ];

  document.getElementById('modalMeta').innerHTML = velden
    .filter(([k, v]) => v && v !== '—')
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');


  // Verberg duplicate locations sectie
  const dupEl = document.getElementById('modalDuplicaten');
  if (dupEl) dupEl.innerHTML = '';

  // GPS bewerkformulier — zelfde als foto's
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
    await fetch('/api/photos/' + id + '/open-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mouseX, mouseY }),
    });
  } catch (e) {
    alert('Could not open the system player.');
  }
}
