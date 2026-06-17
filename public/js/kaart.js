let kaartInstantie   = null;
let alleLocaties     = [];
let markerGroep      = null;
let actieveLocatie   = null;
let kaartTypeFilter  = ''; // '' = alles, '0' = foto's, '1' = video's
let kaartGewensteLand = null; // gewenst land bij openen vanuit dashboard
let kaartVideoNadruk  = false; // video-locaties extra uitlichten (vanuit Landen video-grafiek)

// ─── INITIALISATIE ────────────────────────────────────────────────────────────

async function laadKaart(extraFilter) {
  // Vanuit dashboard: type-filter (foto/video) + gewenst land instellen
  kaartVideoNadruk = !!(extraFilter && extraFilter.video_nadruk);
  if (kaartVideoNadruk) {
    // Gecombineerde weergave: alle media tonen, video's uitgelicht
    kaartTypeFilter = '';
  } else if (extraFilter && extraFilter.is_video !== undefined) {
    kaartTypeFilter = String(extraFilter.is_video);
  }
  if (extraFilter && extraFilter.land) {
    kaartGewensteLand = extraFilter.land;
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
  alleLocaties = await fetch('/api/kaart/locaties' + params).then(r => r.json());
  vulJaarFilter();
  vulLandFilter();

  // Vanuit dashboard geopend op een specifiek land → dropdown zetten en filteren
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
  sel.innerHTML = '<option value="">Alle jaren</option>' +
    jaren.map(j => `<option value="${j}">${j}</option>`).join('');
  if (huidig) sel.value = huidig;
}

function vulLandFilter() {
  const landen = [...new Map(alleLocaties
    .filter(l => l.gps_land)
    .map(l => [l.gps_land, l])
  ).values()].sort((a, b) => a.gps_land.localeCompare(b.gps_land));

  const sel = document.getElementById('kaartLandFilter');
  const huidig = sel.value;
  sel.innerHTML = '<option value="">Alle landen</option>' +
    landen.map(l => {
      const vlag = l.gps_land_code ? landVlag(l.gps_land_code) : '';
      return `<option value="${l.gps_land}">${vlag} ${l.gps_land}</option>`;
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
  kaartVideoNadruk = false; // handmatige typewissel heft de video-nadruk op
  updateKaartTypeKnoppen();
  herlaadLocaties();
}

function filterKaart() {
  const jaar = document.getElementById('kaartJaarFilter').value;
  const land = document.getElementById('kaartLandFilter').value;

  const gefilterd = alleLocaties.filter(l => {
    if (jaar && !(l.jaar_min <= parseInt(jaar) && l.jaar_max >= parseInt(jaar))) return false;
    if (land && l.gps_land !== land) return false;
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

function tekenMarkers(locaties) {
  if (markerGroep) kaartInstantie.removeLayer(markerGroep);

  const totaal = locaties.reduce((s, l) => s + l.aantal, 0);
  const totaalVideos = locaties.reduce((s, l) => s + (l.aantal_videos || 0), 0);
  const totaalFotos  = totaal - totaalVideos;

  let tellerTekst;
  if (kaartTypeFilter === '1') {
    tellerTekst = `${locaties.length.toLocaleString()} locaties · ${totaal.toLocaleString()} video's`;
  } else if (kaartTypeFilter === '0') {
    tellerTekst = `${locaties.length.toLocaleString()} locaties · ${totaal.toLocaleString()} foto's`;
  } else {
    tellerTekst = `${locaties.length.toLocaleString()} locaties · ${totaalFotos.toLocaleString()} foto's · ${totaalVideos.toLocaleString()} video's`;
  }
  document.getElementById('kaartTeller').textContent = tellerTekst;

  markerGroep = L.markerClusterGroup({
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: maakClusterIcon,
  });

  for (const loc of locaties) {
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
  const badge = loc.aantal > 1
    ? `<div class="km-badge">${loc.aantal > 99 ? '99+' : loc.aantal}</div>`
    : '';
  const alleVideos = loc.aantal_videos > 0 && loc.aantal_videos === loc.aantal;
  const gemengd    = loc.aantal_videos > 0 && loc.aantal_videos < loc.aantal;
  const videoBadge = alleVideos ? '<div class="km-video-badge">▶</div>'
                   : gemengd   ? '<div class="km-video-badge km-gemengd">▶/📷</div>'
                   : '';

  // Video-nadruk: locaties met video's krijgen een uitgelichte ring
  const nadruk = (kaartVideoNadruk && loc.aantal_videos > 0) ? ' km-video-nadruk' : '';

  return L.divIcon({
    className: '',
    html: `<div class="km-marker ${heeftThumbnail ? 'km-heeft-thumb' : ''}${nadruk}"
                style="${heeftThumbnail ? `background-image:url('/api/fotos/${loc.voorbeeld_id}/thumbnail')` : ''}">
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
  const vlag    = loc.gps_land_code ? landVlag(loc.gps_land_code) : '';
  const locNaam = [loc.gps_stad, loc.gps_land].filter(Boolean).join(', ') || 'Onbekende locatie';

  document.getElementById('kaartPanelLocatie').textContent = `${vlag} ${locNaam}`.trim();

  const jaarTekst = loc.jaar_min === loc.jaar_max
    ? loc.jaar_min || ''
    : `${loc.jaar_min}–${loc.jaar_max}`;
  document.getElementById('kaartPanelInfo').textContent =
    `📷 ${loc.aantal.toLocaleString()} item${loc.aantal !== 1 ? 's' : ''} · ${jaarTekst}`;

  document.getElementById('kaartPanelFotos').innerHTML =
    '<div class="kp-laden">Laden...</div>';
  document.getElementById('kaartPanelOverlay').classList.add('open');

  await laadPanelFotos();
}

async function laadPanelFotos() {
  if (!actieveLocatie) return;
  const loc    = actieveLocatie;
  const zonder = '1';
  const typeParam = kaartTypeFilter !== '' ? `&is_video=${kaartTypeFilter}` : '';

  const fotos = await fetch(
    `/api/kaart/fotos?lat=${loc.lat}&lon=${loc.lon}&limit=60&zonder_kopien=${zonder}${typeParam}`
  ).then(r => r.json());

  const aantalVideos = fotos.filter(f => f.is_video).length;
  const aantalFotos  = fotos.length - aantalVideos;
  const jaarTekst = actieveLocatie.jaar_min === actieveLocatie.jaar_max
    ? actieveLocatie.jaar_min || ''
    : `${actieveLocatie.jaar_min}–${actieveLocatie.jaar_max}`;

  let infoTekst = '';
  if (aantalFotos > 0 && aantalVideos > 0) {
    infoTekst = `📷 ${aantalFotos} foto${aantalFotos !== 1 ? "'s" : ''} · 🎬 ${aantalVideos} video${aantalVideos !== 1 ? "'s" : ''} · ${jaarTekst}`;
  } else if (aantalVideos > 0) {
    infoTekst = `🎬 ${aantalVideos} video${aantalVideos !== 1 ? "'s" : ''} · ${jaarTekst}`;
  } else {
    infoTekst = `📷 ${fotos.length.toLocaleString()} foto${fotos.length !== 1 ? "'s" : ''} · ${jaarTekst}`;
  }
  document.getElementById('kaartPanelInfo').textContent = infoTekst;

  const grid = document.getElementById('kaartPanelFotos');
  if (!fotos.length) {
    grid.innerHTML = '<div class="kp-laden">Geen items op deze locatie</div>';
    return;
  }

  grid.innerHTML = fotos.map(f => {
    const isDup  = f.is_duplicaat;
    const isOrig = f.is_origineel;
    const badge  = isDup && isOrig  ? '<div class="kp-badge kp-badge-orig">Orig</div>'
                 : isDup && !isOrig ? '<div class="kp-badge kp-badge-dup">Kopie</div>'
                 : '';
    const videoBadge = f.is_video
      ? `<div class="video-badge" style="top:auto;bottom:22px;">▶${f.duur ? ' ' + formatDuur(f.duur) : ''}</div>`
      : '';
    const geenThumb = f.is_video ? '🎬' : '🖼️';
    const onclick = f.is_video ? `toonVideoDetail(${f.id})` : `toonDetail(${f.id})`;
    return `
    <div class="kp-foto" onclick="${onclick}" title="${f.bestandsnaam}">
      <img src="/api/fotos/${f.id}/thumbnail" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           alt="${f.bestandsnaam}">
      <div class="kp-foto-geen-thumb" style="display:none">${geenThumb}</div>
      ${badge}${videoBadge}
      <div class="kp-foto-info">
        <div class="kp-foto-datum">${formatDatum(f.datum_foto)}</div>
        <div class="kp-foto-bron">${f.bron_icoon || '💻'}</div>
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
  const label = [loc.gps_stad, loc.gps_land].filter(Boolean).join(', ');
  const vlagLabel = (loc.gps_land_code ? landVlag(loc.gps_land_code) + ' ' : '') + label;

  // Navigeer naar de juiste pagina op basis van het actieve type filter
  if (kaartTypeFilter === '1') {
    toonPagina('videos', { land: loc.gps_land, _label: vlagLabel });
  } else {
    toonPagina('fotos', { land: loc.gps_land, _label: vlagLabel });
  }
}
