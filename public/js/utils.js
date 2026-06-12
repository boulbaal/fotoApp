function formatGrootte(bytes) {
  if (!bytes) return '—';
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function formatDatum(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDatumTijd(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' om ' + dt.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuur(seconden) {
  if (seconden === null || seconden === undefined) return null;
  if (seconden <= 0) return '< 1s';
  if (seconden < 60) return `${seconden}s`;
  if (seconden < 3600) return `${Math.floor(seconden / 60)}m ${seconden % 60}s`;
  const u = Math.floor(seconden / 3600);
  const m = Math.floor((seconden % 3600) / 60);
  return `${u}u ${m}m`;
}

// ISO datum → dd/mm/yyyy voor weergave in invoerveld
function datumNaarDdMmYyyy(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const dag   = String(d.getUTCDate()).padStart(2, '0');
  const maand = String(d.getUTCMonth() + 1).padStart(2, '0');
  const jaar  = d.getUTCFullYear();
  return `${dag}/${maand}/${jaar}`;
}

// dd/mm/yyyy → ISO string (voor opslaan in DB)
function ddMmYyyyNaarIso(tekst) {
  const m = tekst.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dag, maand, jaar] = m.map(Number);
  if (maand < 1 || maand > 12 || dag < 1 || dag > 31) return null;
  return `${jaar}-${String(maand).padStart(2,'0')}-${String(dag).padStart(2,'0')}T00:00:00.000Z`;
}

// Landcode (2 letters) → vlag emoji
function landVlag(code) {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');
}

// Landnaam → 2-letter ISO code (fallback lookup)
const LAND_CODES = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR','Armenia':'AM',
  'Australia':'AU','Austria':'AT','Azerbaijan':'AZ','Bangladesh':'BD','Belarus':'BY',
  'Belgium':'BE','Bolivia':'BO','Bosnia and Herzegovina':'BA','Brazil':'BR','Bulgaria':'BG',
  'Cambodia':'KH','Canada':'CA','Chile':'CL','China':'CN','Colombia':'CO','Croatia':'HR',
  'Cuba':'CU','Czech Republic':'CZ','Denmark':'DK','Ecuador':'EC','Egypt':'EG',
  'Estonia':'EE','Ethiopia':'ET','Finland':'FI','France':'FR','Georgia':'GE',
  'Germany':'DE','Ghana':'GH','Greece':'GR','Guatemala':'GT','Hungary':'HU',
  'India':'IN','Indonesia':'ID','Iran':'IR','Iraq':'IQ','Ireland':'IE','Israel':'IL',
  'Italy':'IT','Jamaica':'JM','Japan':'JP','Jordan':'JO','Kazakhstan':'KZ','Kenya':'KE',
  'Kosovo':'XK','Kuwait':'KW','Kyrgyzstan':'KG','Latvia':'LV','Lebanon':'LB',
  'Libya':'LY','Lithuania':'LT','Luxembourg':'LU','Malaysia':'MY','Mali':'ML',
  'Mexico':'MX','Moldova':'MD','Montenegro':'ME','Morocco':'MA','Mozambique':'MZ',
  'Myanmar':'MM','Nepal':'NP','Netherlands':'NL','New Zealand':'NZ','Nigeria':'NG',
  'North Macedonia':'MK','Norway':'NO','Pakistan':'PK','Palestine':'PS','Panama':'PA',
  'Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT',
  'Romania':'RO','Russia':'RU','Saudi Arabia':'SA','Senegal':'SN','Serbia':'RS',
  'Singapore':'SG','Slovakia':'SK','Slovenia':'SI','South Africa':'ZA','South Korea':'KR',
  'Spain':'ES','Sri Lanka':'LK','Sudan':'SD','Sweden':'SE','Switzerland':'CH',
  'Syria':'SY','Taiwan':'TW','Tajikistan':'TJ','Tanzania':'TZ','Thailand':'TH',
  'Tunisia':'TN','Turkey':'TR','Turkmenistan':'TM','Uganda':'UG','Ukraine':'UA',
  'United Arab Emirates':'AE','United Kingdom':'GB','United States':'US',
  'Uruguay':'UY','Uzbekistan':'UZ','Venezuela':'VE','Vietnam':'VN','Yemen':'YE',
  'Zambia':'ZM','Zimbabwe':'ZW'
};

function landVlagVanNaam(naam) {
  if (!naam) return '';
  const code = LAND_CODES[naam] || LAND_CODES[naam.trim()];
  return code ? landVlag(code) : '';
}

// Auto-format datuminvoer: voeg / toe na dag en maand
function formateerDatumInput(input) {
  let v = input.value.replace(/[^\d]/g, '');
  if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
  if (v.length > 5) v = v.slice(0,5) + '/' + v.slice(5);
  if (v.length > 10) v = v.slice(0,10);
  input.value = v;
}

// ─── MODAL GPS KAARTJE ────────────────────────────────────────────────────────
// Toont een kleine Leaflet kaart met pin op de gegeven coördinaten in de detail modal

let _modalKaart = null;
let _modalMarker = null;

function initialiseerModalKaart(lat, lon) {
  const el = document.getElementById('modalGpsKaartje');
  if (!el) return;

  el.style.display = 'block';

  if (_modalKaart) {
    // Kaart bestaat al — verplaats pin en centreer
    _modalKaart.setView([lat, lon], 13);
    if (_modalMarker) {
      _modalMarker.setLatLng([lat, lon]);
    } else {
      _modalMarker = L.marker([lat, lon]).addTo(_modalKaart);
    }
    _modalKaart.invalidateSize();
    return;
  }

  // Eerste keer: maak kaart aan
  _modalKaart = L.map(el, {
    center: [lat, lon],
    zoom: 13,
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(_modalKaart);

  _modalMarker = L.marker([lat, lon]).addTo(_modalKaart);
}

function verbergModalKaart() {
  const el = document.getElementById('modalGpsKaartje');
  if (el) el.style.display = 'none';
}
