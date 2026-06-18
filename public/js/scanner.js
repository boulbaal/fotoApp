let scanInterval   = null;
let tickerInterval = null;
let tickerSec      = 0;
let vorigeBericht  = '';   // voorkom dubbele log-regels

// === START SCAN ===
// Eenmalige prioriteit-vraag: vóór de scan checken we of de bron-volgorde
// (welke bron telt als "origineel" bij duplicaten) al is ingesteld. Zo niet,
// en er zijn meerdere bronnen, dan vragen we die éénmalig via de prioriteit-modal
// en starten de scan pas nadat de gebruiker heeft opgeslagen.
async function startScan(bronId, bronNaam) {
  logClient(`🖱 Klik: Start scan — ${bronNaam || 'bron #' + bronId}`);

  if (await prioriteitNodigVoorScan()) {
    logClient('🏷 Eerst even instellen welke bron het origineel is bij duplicaten...');
    openPrioModal(() => echtStartScan(bronId, bronNaam));
    return;
  }

  echtStartScan(bronId, bronNaam);
}

// Is een eenmalige prioriteit-vraag nodig vóór deze scan?
// Ja als er ≥2 bronnen zijn én er nog geen bron-volgorde is opgeslagen.
async function prioriteitNodigVoorScan() {
  try {
    const [prio, bronnen] = await Promise.all([
      fetch('/api/duplicaten/prioriteit').then(r => r.json()),
      fetch('/api/bronnen').then(r => r.json())
    ]);
    const volgorde = Array.isArray(prio.bronVolgorde) ? prio.bronVolgorde : [];
    return Array.isArray(bronnen) && bronnen.length >= 2 && volgorde.length === 0;
  } catch (_) {
    return false; // bij twijfel niet blokkeren — gewoon scannen
  }
}

async function echtStartScan(bronId, bronNaam) {
  // Onmiddellijke visuele feedback — nog voor server antwoord
  const kaart = document.getElementById('bronKaart_' + bronId);
  if (kaart) {
    const knop = kaart.querySelector('.btn-groot');
    if (knop) {
      knop.disabled = true;
      knop.innerHTML = '⏳ Verzenden...';
      knop.style.background = '#4b5563';
      knop.style.cursor = 'not-allowed';
    }
  }

  logClient(`📤 Verzoek verzonden naar server...`);

  try {
    const r = await fetch('/api/scan/' + bronId, { method: 'POST' });
    const data = await r.json();

    if (data.fout) {
      logClient(`❌ Server fout: ${data.fout}`);
      return;
    }

    logClient(`📨 Server antwoord ontvangen`);

    if (data.bezig && data.bron_id === bronId) {
      logClient(`▶ Scan gestart voor ${bronNaam}`);
    } else if ((data.wachtrij || []).find(w => w.id === bronId)) {
      const pos = data.wachtrij.findIndex(w => w.id === bronId) + 1;
      logClient(`📋 ${bronNaam} toegevoegd aan wachtrij — positie #${pos}`);
    }

    startTicker();
    startScanPolling();
    laadBronnen();
  } catch (e) {
    logClient(`❌ Verbindingsfout: ${e.message}`);
  }
}

// === STOP SCAN ===
async function stopScan() {
  logClient(`🖱 Klik: Stop scan`);
  logClient(`📤 Stop-verzoek verzonden naar server...`);

  setScanBalkStatus('stoppend', 'Verzoek verzonden...');

  try {
    await fetch('/api/scan/stop', { method: 'POST' });
    logClient(`📨 Server bevestigt: stoppen verwerkt`);
    logClient(`⏳ Wachten tot huidige bestand klaar is...`);

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      const status = await fetch('/api/scan/status').then(r => r.json());
      setScanBalkStatus('stoppend', `Stoppen... (${Math.round((i+1)*0.5)}s)`);
      if (!status.bezig) {
        logClient(`✅ Scan gestopt`);
        break;
      }
    }
  } catch (e) {
    logClient(`❌ Fout bij stoppen: ${e.message}`);
  }

  clearInterval(scanInterval);
  clearInterval(tickerInterval);
  scanInterval = null;
  setScanBalk(null);
  laadBronnen();
}

async function verwijderUitWachtrij(bronId) {
  logClient(`🗑 Verwijderen uit wachtrij — bron #${bronId}`);
  await fetch('/api/scan/wachtrij/' + bronId, { method: 'DELETE' });
  logClient(`✅ Verwijderd uit wachtrij`);
  laadBronnen();
}

// === TICKER (alive indicator) ===
function startTicker() {
  stopTicker();
  tickerSec = 0;
  document.getElementById('scanBalkTicker').style.display = 'inline';
  tickerInterval = setInterval(() => {
    tickerSec++;
    const el = document.getElementById('tickerSec');
    if (el) el.textContent = tickerSec;
  }, 1000);
}

function stopTicker() {
  clearInterval(tickerInterval);
  tickerInterval = null;
  const el = document.getElementById('scanBalkTicker');
  if (el) el.style.display = 'none';
}

function resetTicker() {
  tickerSec = 0;
  const el = document.getElementById('tickerSec');
  if (el) el.textContent = '0';
}

// === POLLING ===
function startScanPolling() {
  if (scanInterval) clearInterval(scanInterval);
  // Initialiseer vorigeBericht zodat voltooiing altijd herkend wordt,
  // ook als de scan < 1.5s duurt (eerste poll ziet al status.bezig = false)
  if (!vorigeBericht) vorigeBericht = 'gestart';

  scanInterval = setInterval(async () => {
    try {
      const status = await fetch('/api/scan/status').then(r => r.json());
      resetTicker();
      setScanBalk(status);

      // Log alleen bij statuswijziging
      const bericht = status.bezig
        ? `${status.huidig_bestand || ''}|${status.verwerkt}`
        : 'klaar';

      if (bericht !== vorigeBericht) {
        if (status.bezig) {
          // Log elke 50 bestanden of bij nieuw bestand
          if (status.verwerkt % 50 === 0 && status.verwerkt > 0) {
            logClient(`⚙️  Verwerkt: ${status.verwerkt.toLocaleString()} / ${status.totaal.toLocaleString()} — ${status.huidig_bestand}`);
          }
        } else if (vorigeBericht !== 'klaar' && vorigeBericht !== '') {
          logClient(`✅ Scan voltooid — polling stopt`);
          clearInterval(scanInterval);
          stopTicker();
          scanInterval = null;
          laadBronnen();
          laadStats();
          // Start geocode-polling als geocoding bezig is
          startGeocodePolling();
        }
        vorigeBericht = bericht;
      }

      // Geocode status tonen in balk (ook tijdens scan)
      if (status.geocode) toonGeocodeBalk(status.geocode);
    } catch (e) {
      logClient(`⚠️  Poll mislukt: ${e.message} — probeer opnieuw...`);
    }
  }, 1500);
}

// === SCAN BALK UI ===
function setScanBalkStatus(staat, tekst) {
  const dot   = document.getElementById('scanBalkDot');
  const titel = document.getElementById('scanBalkTitel');
  if (dot)   dot.className  = `scan-dot ${staat}`;
  if (titel) titel.textContent = tekst;
}

function setScanBalk(status) {
  const balk   = document.getElementById('scanBalk');
  const dot    = document.getElementById('scanBalkDot');
  const titel  = document.getElementById('scanBalkTitel');
  const sub    = document.getElementById('scanBalkBestand');
  const mid    = document.getElementById('scanBalkMidden');
  const teller = document.getElementById('scanBalkTeller');
  const stop   = document.getElementById('scanBalkStop');
  const fill   = document.getElementById('scanBalkFill');
  const ticker = document.getElementById('scanBalkTicker');
  const ind    = document.getElementById('scanIndicator');

  if (!balk) return;

  if (!status || !status.bezig) {
    // Flash als balk net klaar was
    const progress = document.getElementById('scanBalkProgress');
    if (balk.classList.contains('bezig') && progress) {
      fill.style.width = '100%';
      const camera = document.getElementById('scanCamera');
      if (camera) camera.style.left = '100%';
      progress.classList.add('klaar-flash');
      setTimeout(() => {
        progress.classList.remove('klaar-flash');
        balk.className     = 'scan-balk klaar';
        fill.style.width   = '0%';
        if (camera) camera.style.left = '0%';
      }, 700);
    } else {
      balk.className     = 'scan-balk klaar';
      fill.style.width   = '0%';
    }
    dot.className        = 'scan-dot klaar';
    titel.textContent    = window.i18n ? window.i18n.t('stat_ready') : 'Klaar';
    sub.textContent      = '';
    mid.textContent      = '';
    teller.textContent   = '';
    stop.style.display   = 'none';
    if (ticker) ticker.style.display = 'none';
    ind.style.display    = 'none';
    return;
  }

  const pct = status.totaal > 0 ? Math.round(status.verwerkt / status.totaal * 100) : 0;

  balk.className       = 'scan-balk bezig';
  dot.className        = 'scan-dot bezig';
  titel.textContent    = status.bron_naam || 'Scanning...';
  sub.textContent      = (status.wachtrij?.length > 0)
    ? `+${status.wachtrij.length} in wachtrij`
    : (status.nieuw > 0 ? `${status.nieuw} nieuw` : '');
  mid.textContent      = status.huidig_bestand || '';
  fill.style.width     = pct + '%';
  stop.style.display   = 'inline-block';
  if (ticker) ticker.style.display = 'inline';

  // Camera volgt de voortgang
  const camera = document.getElementById('scanCamera');
  if (camera) camera.style.left = Math.max(pct, 2) + '%';

  teller.innerHTML = status.totaal > 0
    ? `<span style="color:#a78bf7">${pct}%</span> &nbsp;${status.verwerkt.toLocaleString()} / ${status.totaal.toLocaleString()}`
    : `<span style="color:#888">inventariseren...</span>`;

  ind.className = 'scan-indicator bezig';
  ind.innerHTML = `<div class="pulse"></div> ${pct > 0 ? pct + '%' : '...'}`;
}

// === GEOCODE PASS UI ===
let geocodeInterval = null;

function toonGeocodeBalk(geocode) {
  const el = document.getElementById('geocodeBalk');
  if (!el) return;
  if (geocode.bezig && geocode.totaal > 0) {
    const pct = Math.round(geocode.gedaan / geocode.totaal * 100);
    el.style.display = 'flex';
    el.innerHTML = `<span style="color:#34d399">🌍 Locaties ophalen</span> &nbsp;
      <span style="color:#6b7280;font-size:12px">${geocode.gedaan}/${geocode.totaal}
      ${geocode.huidig_land ? '— ' + geocode.huidig_land : ''}</span>
      <span style="margin-left:auto;color:#a78bf7;font-size:12px">${pct}%</span>`;
  } else {
    el.style.display = 'none';
    if (geocode.gedaan > 0 && !geocode.bezig) laadStats();
  }
}

function startGeocodePolling() {
  if (geocodeInterval) return;
  geocodeInterval = setInterval(async () => {
    try {
      const g = await fetch('/api/scan/geocode').then(r => r.json());
      toonGeocodeBalk(g);
      if (!g.bezig) {
        clearInterval(geocodeInterval);
        geocodeInterval = null;
      }
    } catch (_) {}
  }, 2000);
}

// === WAARSCHUWING BIJ REFRESH TIJDENS SCAN ===
window.addEventListener('beforeunload', (e) => {
  const balk = document.getElementById('scanBalk');
  if (balk && balk.classList.contains('bezig')) {
    e.preventDefault();
    e.returnValue = 'Een scan is bezig. De scan gaat door op de server, maar je verliest de live voortgang. Wil je toch de pagina verlaten?';
  }
});

// === INIT: check bij laden of scan of geocoding al bezig ===
(async () => {
  try {
    const [status, geocode] = await Promise.all([
      fetch('/api/scan/status').then(r => r.json()),
      fetch('/api/scan/geocode').then(r => r.json())
    ]);
    setScanBalk(status);
    toonGeocodeBalk(geocode);
    if (status.bezig) {
      logClient(`ℹ️  Scan was al bezig bij laden — polling hervat`);
      startTicker();
      startScanPolling();
    }
    if (geocode.bezig) {
      logClient(`ℹ️  Geocoding was al bezig bij laden — polling hervat`);
      startGeocodePolling();
    }
  } catch (e) {
    logClient(`⚠️  Kon status niet ophalen: ${e.message}`);
  }
})();
