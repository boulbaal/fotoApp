let kaartInstantie   = null;
let alleLocaties     = [];
let markerGroep      = null;
let actieveLocatie   = null;

// ─── INITIALISATIE ────────────────────────────────────────────────────────────

async function laadKaart() {
  if (kaartInstantie) {
    kaartInstantie.invalidateSize();
    await herlaadLocaties(); // altijd data herladen bij navigatie naar kaart
    return;
  }

  kaartInstantie = L.map('kaartContainer', {
    center: [20, 10],
    zoom: 3,
    zoomControl: true,
  });

  // Dark tile layer (past bij het donkere thema)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(kaartInstantie);

  // Sluit panel bij klik op de kaart
  kaartInstantie.on('click', () => sluitKaartPanelDirect());

  await herlaadLocaties();
}

// ─── DATA LADEN ───────────────────────────────────────────────────────────────

async function herlaadLocaties() {
  alleLocaties = await fetch('/api/kaart/locaties').then(r => r.json());
  vulJaarFilter();
  vulLandFilter();
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
  filterKaart();
}

// ─── MARKERS TEKENEN ──────────────────────────────────────────────────────────

function tekenMarkers(locaties) {
  if (markerGroep) kaartInstantie.removeLayer(markerGroep);

  const totaal = locaties.reduce((s, l) => s + l.aantal, 0);
  document.getElementById('kaartTeller').textContent =
    `${locaties.length.toLocaleString()} locaties · ${totaal.toLocaleString()} foto's`;

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

  return L.divIcon({
    className: '',
    html: `<div class="km-marker ${heeftThumbnail ? 'km-heeft-thumb' : ''}"
                style="${heeftThumbnail ? `background-image:url('/api/fotos/${loc.voorbeeld_id}/thumbnail')` : ''}">
             ${badge}
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
    `📷 ${loc.aantal.toLocaleString()} foto${loc.aantal !== 1 ? "'s" : ''} · ${jaarTekst}`;

  document.getElementById('kaartPanelFotos').innerHTML =
    '<div class="kp-laden">Foto\'s laden...</div>';
  document.getElementById('kaartPanelOverlay').classList.add('open');

  await laadPanelFotos();
}

async function laadPanelFotos() {
  if (!actieveLocatie) return;
  const loc    = actieveLocatie;
  const zonder = '1'; // altijd alleen originelen

  const fotos = await fetch(
    `/api/kaart/fotos?lat=${loc.lat}&lon=${loc.lon}&limit=60&zonder_kopien=${zonder}`
  ).then(r => r.json());

  // Panelkop bijwerken met werkelijk aantal (kan afwijken na GPS-wijziging)
  const jaarTekst = actieveLocatie.jaar_min === actieveLocatie.jaar_max
    ? actieveLocatie.jaar_min || ''
    : `${actieveLocatie.jaar_min}–${actieveLocatie.jaar_max}`;
  document.getElementById('kaartPanelInfo').textContent =
    `📷 ${fotos.length.toLocaleString()} foto${fotos.length !== 1 ? "'s" : ''} · ${jaarTekst}`;

  const grid = document.getElementById('kaartPanelFotos');
  if (!fotos.length) {
    grid.innerHTML = '<div class="kp-laden">Geen foto\'s meer op deze locatie</div>';
    return;
  }

  grid.innerHTML = fotos.map(f => {
    const isDup  = f.is_duplicaat;
    const isOrig = f.is_origineel;
    const badge  = isDup && isOrig  ? '<div class="kp-badge kp-badge-orig">Orig</div>'
                 : isDup && !isOrig ? '<div class="kp-badge kp-badge-dup">Kopie</div>'
                 : '';
    return `
    <div class="kp-foto" onclick="toonDetail(${f.id})" title="${f.bestandsnaam}">
      <img src="/api/fotos/${f.id}/thumbnail" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           alt="${f.bestandsnaam}">
      <div class="kp-foto-geen-thumb" style="display:none">🖼️</div>
      ${badge}
      <div class="kp-foto-info">
        <div class="kp-foto-datum">${formatDatum(f.datum_foto)}</div>
        <div class="kp-foto-bron">${f.bron_icoon || '💻'}</div>
      </div>
    </div>`;
  }).join('');
}


function sluitKaartPanel(e) {
  // Alleen sluiten als op de overlay zelf geklikt werd (niet op de popup)
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
  toonPagina('fotos', {
    land: loc.gps_land,
    _label: (loc.gps_land_code ? landVlag(loc.gps_land_code) + ' ' : '') + label
  });
}
