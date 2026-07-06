let scanInterval   = null;
let tickerInterval = null;
let tickerSec      = 0;
let vorigeBericht  = '';   // voorkom dubbele log-regels

// === START SCAN ===
// Eenmalige priority-vraag: vóór de scan checken we of de bron-volgorde
// (welke bron telt als "origineel" bij duplicates) al is ingesteld. Zo niet,
// en er zijn meerdere sources, dan vragen we die éénmalig via de priority-modal
// en starten de scan pas nadat de gebruiker heeft opgeslagen.
async function startScan(sourceId, sourceName) {
  logClient(`🖱 Klik: Start scan — ${sourceName || 'bron #' + sourceId}`);

  if (await prioriteitNodigVoorScan()) {
    logClient('🏷 First set which source counts as the original for duplicates...');
    openPrioModal(() => echtStartScan(sourceId, sourceName));
    return;
  }

  echtStartScan(sourceId, sourceName);
}

// Is een eenmalige priority-vraag nodig vóór deze scan?
// Ja als er ≥2 sources zijn én er nog geen bron-volgorde is opgeslagen.
async function prioriteitNodigVoorScan() {
  try {
    const [prio, sources] = await Promise.all([
      fetch('/api/duplicates/priority').then(r => r.json()),
      fetch('/api/sources').then(r => r.json())
    ]);
    const volgorde = Array.isArray(prio.sourceOrder) ? prio.sourceOrder : [];
    return Array.isArray(sources) && sources.length >= 2 && volgorde.length === 0;
  } catch (_) {
    return false; // bij twijfel niet blokkeren — gewoon scannen
  }
}

async function echtStartScan(sourceId, sourceName) {
  // Onmiddellijke visuele feedback — nog voor server antwoord
  const kaart = document.getElementById('bronKaart_' + sourceId);
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
    const r = await fetch('/api/scan/' + sourceId, { method: 'POST' });
    const data = await r.json();

    if (data.error) {
      logClient(`❌ Server error: ${data.error}`);
      return;
    }

    logClient(`📨 Server antwoord ontvangen`);

    if (data.running && data.source_id === sourceId) {
      logClient(`▶ Scan started for ${sourceName}`);
    } else if ((data.queue || []).find(w => w.id === sourceId)) {
      const pos = data.queue.findIndex(w => w.id === sourceId) + 1;
      logClient(`📋 ${sourceName} added to queue — position #${pos}`);
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
    logClient(`📨 Server confirms: stop processed`);
    logClient(`⏳ Waiting until the current file is ready...`);

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      const status = await fetch('/api/scan/status').then(r => r.json());
      setScanBalkStatus('stoppend', `Stoppen... (${Math.round((i+1)*0.5)}s)`);
      if (!status.running) {
        logClient(`✅ Scan stopped`);
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

async function verwijderUitWachtrij(sourceId) {
  logClient(`🗑 Removing from queue — source #${sourceId}`);
  await fetch('/api/scan/queue/' + sourceId, { method: 'DELETE' });
  logClient(`✅ Removed from queue`);
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
  // ook als de scan < 1.5s duurt (eerste poll ziet al status.running = false)
  if (!vorigeBericht) vorigeBericht = 'started';

  scanInterval = setInterval(async () => {
    try {
      const status = await fetch('/api/scan/status').then(r => r.json());
      resetTicker();
      setScanBalk(status);

      // Log alleen bij statuswijziging
      const message = status.running
        ? `${status.current_file || ''}|${status.processed}`
        : 'ready';

      if (message !== vorigeBericht) {
        if (status.running) {
          // Log elke 50 bestanden of bij new_files bestand
          if (status.processed % 50 === 0 && status.processed > 0) {
            logClient(`⚙️  Processed: ${status.processed.toLocaleString()} / ${status.total.toLocaleString()} — ${status.current_file}`);
          }
        } else if (vorigeBericht !== 'ready' && vorigeBericht !== '') {
          logClient(`✅ Scan completed — polling stopt`);
          clearInterval(scanInterval);
          stopTicker();
          scanInterval = null;
          laadBronnen();
          laadStats();
          // Start geocode-polling als geocoding running is
          startGeocodePolling();
        }
        vorigeBericht = message;
      }

      // Geocode status tonen in balk (ook tijdens scan)
      if (status.geocode) toonGeocodeBalk(status.geocode);
    } catch (e) {
      logClient(`⚠️  Poll failed: ${e.message} — retrying...`);
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

  if (!status || !status.running) {
    // Flash als balk net ready was
    const progress = document.getElementById('scanBalkProgress');
    if (balk.classList.contains('running') && progress) {
      fill.style.width = '100%';
      const camera = document.getElementById('scanCamera');
      if (camera) camera.style.left = '100%';
      progress.classList.add('ready-flash');
      setTimeout(() => {
        progress.classList.remove('ready-flash');
        balk.className     = 'scan-balk ready';
        fill.style.width   = '0%';
        if (camera) camera.style.left = '0%';
      }, 700);
    } else {
      balk.className     = 'scan-balk ready';
      fill.style.width   = '0%';
    }
    dot.className        = 'scan-dot ready';
    titel.textContent    = window.i18n ? window.i18n.t('stat_ready') : 'Klaar';
    sub.textContent      = '';
    mid.textContent      = '';
    teller.textContent   = '';
    stop.style.display   = 'none';
    if (ticker) ticker.style.display = 'none';
    ind.style.display    = 'none';
    return;
  }

  const pct = status.total > 0 ? Math.round(status.processed / status.total * 100) : 0;

  balk.className       = 'scan-balk running';
  dot.className        = 'scan-dot running';
  titel.textContent    = status.source_name || 'Scanning...';
  sub.textContent      = (status.queue?.length > 0)
    ? `+${status.queue.length} in queue`
    : (status.new_files > 0 ? `${status.new_files} new_files` : '');
  mid.textContent      = status.current_file || '';
  fill.style.width     = pct + '%';
  stop.style.display   = 'inline-block';
  if (ticker) ticker.style.display = 'inline';

  // Camera volgt de voortgang
  const camera = document.getElementById('scanCamera');
  if (camera) camera.style.left = Math.max(pct, 2) + '%';

  teller.innerHTML = status.total > 0
    ? `<span style="color:#a78bf7">${pct}%</span> &nbsp;${status.processed.toLocaleString()} / ${status.total.toLocaleString()}`
    : `<span style="color:#888">inventariseren...</span>`;

  ind.className = 'scan-indicator running';
  ind.innerHTML = `<div class="pulse"></div> ${pct > 0 ? pct + '%' : '...'}`;
}

// === GEOCODE PASS UI ===
let geocodeInterval = null;

function toonGeocodeBalk(geocode) {
  const el = document.getElementById('geocodeBalk');
  if (!el) return;
  if (geocode.running && geocode.total > 0) {
    const pct = Math.round(geocode.done / geocode.total * 100);
    el.style.display = 'flex';
    el.innerHTML = `<span style="color:#34d399">🌍 Locaties ophalen</span> &nbsp;
      <span style="color:#6b7280;font-size:12px">${geocode.done}/${geocode.total}
      ${geocode.current_country ? '— ' + geocode.current_country : ''}</span>
      <span style="margin-left:auto;color:#a78bf7;font-size:12px">${pct}%</span>`;
  } else {
    el.style.display = 'none';
    if (geocode.done > 0 && !geocode.running) laadStats();
  }
}

function startGeocodePolling() {
  if (geocodeInterval) return;
  geocodeInterval = setInterval(async () => {
    try {
      const g = await fetch('/api/scan/geocode').then(r => r.json());
      toonGeocodeBalk(g);
      if (!g.running) {
        clearInterval(geocodeInterval);
        geocodeInterval = null;
      }
    } catch (_) {}
  }, 2000);
}

// === WAARSCHUWING BIJ REFRESH TIJDENS SCAN ===
window.addEventListener('beforeunload', (e) => {
  const balk = document.getElementById('scanBalk');
  if (balk && balk.classList.contains('running')) {
    e.preventDefault();
    e.returnValue = 'A scan is running. It will continue on the server, but you will lose the live progress. Leave the page anyway?';
  }
});

// === INIT: check bij laden of scan of geocoding al running ===
(async () => {
  try {
    const [status, geocode] = await Promise.all([
      fetch('/api/scan/status').then(r => r.json()),
      fetch('/api/scan/geocode').then(r => r.json())
    ]);
    setScanBalk(status);
    toonGeocodeBalk(geocode);
    if (status.running) {
      logClient(`ℹ️  Scan was already running at load — polling resumed`);
      startTicker();
      startScanPolling();
    }
    if (geocode.running) {
      logClient(`ℹ️  Geocoding was already running at load — polling resumed`);
      startGeocodePolling();
    }
  } catch (e) {
    logClient(`⚠️  Could not fetch status: ${e.message}`);
  }
})();
