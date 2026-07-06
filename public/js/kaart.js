let kaartInstantie   = null;
let alleLocaties     = [];
let markerGroep      = null;
let actieveLocatie   = null;
let kaartTypeFilter  = ''; // '' = all, '0' = photos, '1' = videos
let kaartGewensteLand = null; // gewenst country bij openen vanuit dashboard
let kaartVideoNadruk  = false; // video-locations extra uitlichten (vanuit Landen video-grafiek)

// ─── INITIALISATIE ────────────────────────────────────────────────────────────

async function laadKaart(extraFilter) {
  // Vanuit dashboard: type-filter (foto/video) + gewenst country instellen
  kaartVideoNadruk = !!(extraFilter && extraFilter.video_nadruk);
  if (kaartVideoNadruk) {
    // Gecombineerde weergave: alle media tonen, video's uitgelicht
    kaartTypeFilter = '';
  } else if (extraFilter && extraFilter.is_video !== undefined) {
    kaartTypeFilter = String(extraFilter.is_video);
  }
  if (extraFilter && extraFilter.country) {
    kaartGewensteLand = extraFilter.country;
  }

  if (kaartInstantie) {
    kaartInstantie.invalidateSize();
    updateKaartTypeKnoppen();
    await herlaadLocaties();
    return;
  }

  kaartInstantie = L.map('kaartContainer', {
    center: [20, 10],
    zoom: 3,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(kaartInstantie);

  kaartInstantie.on('click', () => sluitKaartPanelDirect());

  await herlaadLocaties();
}

// ─── DATA LADEN ───────────────────────────────────────────────────────────────

async function herlaadLocaties() {
  const params = kaartTypeFilter !== '' ? `?is_video=${kaartTypeFilter}` : '';
  alleLocaties = await fetch('/api/map/locations' + params).then(r => r.json());
  vulJaarFilter();
  vulLandFilter();

  // Vanuit dashboard geopend op een specifiek country → dropdown zetten en filteren
  if (kaartGewensteLand) {
    const sel = document.getElementById('kaartLandFilter');
    if (sel) sel.value = kaartGewensteLand;
    kaartGewensteLand = null;
    filterKaart();
    return;
  }

  tekenMarkers(alleLocaties);
}

function vulJaarFilter() {
  const jaren = [...new Set(alleLocaties.flatMap(l =>
    l.jaar_min && l.jaar_max
      ? Array.from({ length: l.jaar_max - l.jaar_min + 1 }, (_, i) => l.jaar_min + i)
      : []
  ))].sort((a, b) => b - a);

  const sel = document.getElementById('kaartJaarFilter');
  const huidig = sel.value;
  sel.innerHTML = '<option value="">All years</option>' +
    jaren.map(j => `<option value="${j}">${j}</option>`).join('');
  if (huidig) sel.value = huidig;
}

function vulLandFilter() {
  const landen = [...new Map(alleLocaties
    .filter(l => l.gps_country)
    .map(l => [l.gps_country, l])
  ).values()].sort((a, b) => a.gps_country.localeCompare(b.gps_country));

  const sel = document.getElementById('kaartLandFilter');
  const huidig = sel.value;
  sel.innerHTML = '<option value="">All countries</option>' +
    landen.map(l => {
      const vlag = l.gps_country_code ? landVlag(l.gps_country_code) : '';
      return `<option value="${l.gps_country}">${vlag} ${l.gps_country}</option>`;
    }).join('');
  if (huidig) sel.value = huidig;
}

// ─── FILTERS ──────────────────────────────────────────────────────────────────

function updateKaartTypeKnoppen() {
  document.querySelectorAll('.kaart-type-btn').forEach(b => b.classList.remove('actief'));
  const actief = document.getElementById(
    kaartTypeFilter === '0' ? 'kaartTypeFotos' : kaartTypeFilter === '1' ? 'kaartTypeVideos' : 'kaartTypeAlles'
  );
  if (actief) actief.classList.add('actief');
}

function setKaartTypeFilter(type) {
  kaartTypeFilter = type;
  kaartVideoNadruk = false; // manual typewissel heft de video-nadruk op
  updateKaartTypeKnoppen();
  herlaadLocaties();
}

function filterKaart() {
  const year = document.getElementById('kaartJaarFilter').value;
  const country = document.getElementById('kaartLandFilter').value;

  const gefilterd = alleLocaties.filter(l => {
    if (year && !(l.jaar_min <= parseInt(year) && l.jaar_max >= parseInt(year))) return false;
    if (country && l.gps_country !== country) return false;
    return true;
  });

  tekenMarkers(gefilterd);
  sluitKaartPanel();
}

function resetKaartFilters() {
  document.getElementById('kaartJaarFilter').value = '';
  document.getElementById('kaartLandFilter').value = '';
  setKaartTypeFilter('');
}

// ─── MARKERS TEKENEN ──────────────────────────────────────────────────────────

function tekenMarkers(locations) {
  if (markerGroep) kaartInstantie.removeLayer(markerGroep);

  const total = locations.reduce((s, l) => s + l.count, 0);
  const totalVideos = locations.reduce((s, l) => s + (l.aantal_videos || 0), 0);
  const totalPhotos  = total - totalVideos;

  let tellerTekst;
  if (kaartTypeFilter === '1') {
    tellerTekst = `${locations.length.toLocaleString()} locations · ${total.toLocaleString()} videos`;
  } else if (kaartTypeFilter === '0') {
    tellerTekst = `${locations.length.toLocaleString()} locations · ${total.toLocaleString()} photos`;
  } else {
    tellerTekst = `${locations.length.toLocaleString()} locations · ${totalPhotos.toLocaleString()} photos · ${totalVideos.toLocaleString()} videos`;
  }
  document.getElementById('kaartTeller').textContent = tellerTekst;

  markerGroep = L.markerClusterGroup({
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: maakClusterIcon,
  });

  for (const loc of locations) {
    const marker = L.marker([loc.lat, loc.lon], { icon: maakFotoIcon(loc) });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      toonLocatiePanel(loc);
    });
    markerGroep.addLayer(marker);
  }

  kaartInstantie.addLayer(markerGroep);
}

function maakFotoIcon(loc) {
  const heeftThumbnail = !!loc.voorbeeld_id;
  const badge = loc.count > 1
    ? `<div class="km-badge">${loc.count > 99 ? '99+' : loc.count}</div>`
    : '';
  const alleVideos = loc.aantal_videos > 0 && loc.aantal_videos === loc.count;
  const gemengd    = loc.aantal_videos > 0 && loc.aantal_videos < loc.count;
  const videoBadge = alleVideos ? '<div class="km-video-badge">▶</div>'
                   : gemengd   ? '<div class="km-video-badge km-gemengd">▶/📷</div>'
                   : '';

  // Video-nadruk: locations met video's krijgen een uitgelichte ring
  const nadruk = (kaartVideoNadruk && loc.aantal_videos > 0) ? ' km-video-nadruk' : '';

  return L.divIcon({
    className: '',
    html: `<div class="km-marker ${heeftThumbnail ? 'km-heeft-thumb' : ''}${nadruk}"
                style="${heeftThumbnail ? `background-image:url('/api/photos/${loc.voorbeeld_id}/thumbnail')` : ''}">
             ${badge}${videoBadge}
           </div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -32],
  });
}

function maakClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size  = count > 100 ? 52 : count > 20 ? 44 : 36;
  return L.divIcon({
    html: `<div class="km-cluster" style="width:${size}px;height:${size}px;line-height:${size}px">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── SLIDE-UP PANEL ───────────────────────────────────────────────────────────

async function toonLocatiePanel(loc) {
  actieveLocatie = loc;
  const vlag    = loc.gps_country_code ? landVlag(loc.gps_country_code) : '';
  const locNaam = [loc.gps_city, loc.gps_country].filter(Boolean).join(', ') || 'Unknown location';

  document.getElementById('kaartPanelLocatie').textContent = `${vlag} ${locNaam}`.trim();

  const jaarTekst = loc.jaar_min === loc.jaar_max
    ? loc.jaar_min || ''
    : `${loc.jaar_min}–${loc.jaar_max}`;
  document.getElementById('kaartPanelInfo').textContent =
    `📷 ${loc.count.toLocaleString()} item${loc.count !== 1 ? 's' : ''} · ${jaarTekst}`;

  document.getElementById('kaartPanelFotos').innerHTML =
    '<div class="kp-laden">Loading...</div>';
  document.getElementById('kaartPanelOverlay').classList.add('open');

  await laadPanelFotos();
}

async function laadPanelFotos() {
  if (!actieveLocatie) return;
  const loc    = actieveLocatie;
  const zonder = '1';
  const typeParam = kaartTypeFilter !== '' ? `&is_video=${kaartTypeFilter}` : '';

  const photos = await fetch(
    `/api/map/photos?lat=${loc.lat}&lon=${loc.lon}&limit=60&without_copies=${zonder}${typeParam}`
  ).then(r => r.json());

  const aantalVideos = photos.filter(f => f.is_video).length;
  const aantalFotos  = photos.length - aantalVideos;
  const jaarTekst = actieveLocatie.jaar_min === actieveLocatie.jaar_max
    ? actieveLocatie.jaar_min || ''
    : `${actieveLocatie.jaar_min}–${actieveLocatie.jaar_max}`;

  let infoTekst = '';
  if (aantalFotos > 0 && aantalVideos > 0) {
    infoTekst = `📷 ${aantalFotos} foto${aantalFotos !== 1 ? "'s" : ''} · 🎬 ${aantalVideos} video${aantalVideos !== 1 ? "'s" : ''} · ${jaarTekst}`;
  } else if (aantalVideos > 0) {
    infoTekst = `🎬 ${aantalVideos} video${aantalVideos !== 1 ? "'s" : ''} · ${jaarTekst}`;
  } else {
    infoTekst = `📷 ${photos.length.toLocaleString()} foto${photos.length !== 1 ? "'s" : ''} · ${jaarTekst}`;
  }
  document.getElementById('kaartPanelInfo').textContent = infoTekst;

  const grid = document.getElementById('kaartPanelFotos');
  if (!photos.length) {
    grid.innerHTML = '<div class="kp-laden">No items at this location</div>';
    return;
  }

  grid.innerHTML = photos.map(f => {
    const isDup  = f.is_duplicate;
    const isOrig = f.is_original;
    const badge  = isDup && isOrig  ? '<div class="kp-badge kp-badge-orig">Behoud</div>'
                 : isDup && !isOrig ? '<div class="kp-badge kp-badge-dup">Kopie</div>'
                 : '';
    const videoBadge = f.is_video
      ? `<div class="video-badge" style="top:auto;bottom:22px;">▶${f.duration ? ' ' + formatDuur(f.duration) : ''}</div>`
      : '';
    const geenThumb = f.is_video ? '🎬' : '🖼️';
    const onclick = f.is_video ? `toonVideoDetail(${f.id})` : `toonDetail(${f.id})`;
    return `
    <div class="kp-foto" onclick="${onclick}" title="${f.filename}">
      <img src="/api/photos/${f.id}/thumbnail" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           alt="${f.filename}">
      <div class="kp-foto-geen-thumb" style="display:none">${geenThumb}</div>
      ${badge}${videoBadge}
      <div class="kp-foto-info">
        <div class="kp-foto-date">${formatDatum(f.photo_date)}</div>
        <div class="kp-foto-bron">${f.source_icon || '💻'}</div>
      </div>
    </div>`;
  }).join('');
}


function sluitKaartPanel(e) {
  if (e && e.target !== document.getElementById('kaartPanelOverlay')) return;
  sluitKaartPanelDirect();
}

function sluitKaartPanelDirect() {
  document.getElementById('kaartPanelOverlay').classList.remove('open');
  actieveLocatie = null;
}

function bekijkLocatieInFotos() {
  if (!actieveLocatie) return;
  const loc = actieveLocatie;
  const label = [loc.gps_city, loc.gps_country].filter(Boolean).join(', ');
  const vlagLabel = (loc.gps_country_code ? landVlag(loc.gps_country_code) + ' ' : '') + label;

  // Navigeer naar de juiste page op basis van het actieve type filter
  if (kaartTypeFilter === '1') {
    toonPagina('videos', { country: loc.gps_country, _label: vlagLabel });
  } else {
    toonPagina('photos', { country: loc.gps_country, _label: vlagLabel });
  }
}
