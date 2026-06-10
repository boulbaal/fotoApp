// === FASE 3: EXPORT ===

let exportPolling = null;

// ─── Preview laden ────────────────────────────────────────

async function laadExportPreview() {
  const doelmap = document.getElementById('exportDoelmap').value.trim();
  if (!doelmap) {
    alert('Kies eerst een bestemmingsmap.');
    return;
  }

  const knop = document.getElementById('exportStartKnop');
  knop.disabled = true;

  const params = new URLSearchParams({ doelmap });
  const data = await fetch('/api/export/preview?' + params).then(r => r.json());

  document.getElementById('prevFotos').textContent =
    data.nogTeDoen.toLocaleString() + ' foto\'s';
  document.getElementById('prevGrootte').textContent =
    formatGrootte(data.totaalBytes);

  const ruimteEl = document.getElementById('prevRuimte');
  if (data.ruimte < 0) {
    ruimteEl.textContent = 'Onbekend';
    ruimteEl.style.color = '#888';
  } else if (data.ruimteOk) {
    ruimteEl.textContent = formatGrootte(data.ruimte) + '  ✅';
    ruimteEl.style.color = '#4ade80';
  } else {
    ruimteEl.textContent = formatGrootte(data.ruimte) + '  ❌ (tekort: ' + formatGrootte(data.tekort) + ')';
    ruimteEl.style.color = '#f87171';
  }

  const alDoneRij = document.getElementById('prevAlDoneRij');
  if (data.reedsDone > 0) {
    alDoneRij.style.display = '';
    document.getElementById('prevAlDone').textContent = data.reedsDone.toLocaleString() + ' foto\'s (worden overgeslagen)';
  } else {
    alDoneRij.style.display = 'none';
  }

  const warn = document.getElementById('prevWaarschuwing');
  if (data.nogTeDoen === 0) {
    warn.style.display = '';
    warn.innerHTML = '<div class="export-waarschuwing">Alle foto\'s zijn al geëxporteerd naar deze locatie.</div>';
  } else {
    warn.style.display = 'none';
  }

  document.getElementById('exportPreview').style.display = 'block';

  // Activeer start-knop alleen als er ruimte is en er foto's zijn
  knop.disabled = data.nogTeDoen === 0 || data.ruimteOk === false;
}

// ─── Export starten ───────────────────────────────────────

async function startExport() {
  const doelmap = document.getElementById('exportDoelmap').value.trim();
  if (!doelmap) return;

  const r = await fetch('/api/export/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doelmap })
  });
  const data = await r.json();
  if (data.fout) { alert('Fout: ' + data.fout); return; }

  // Toon voortgangsscherm
  document.getElementById('exportSetup').style.display = 'none';
  document.getElementById('exportVoortgang').style.display = 'block';
  document.getElementById('exportKlaar').style.display = 'none';

  startExportPolling();
}

// ─── Polling ─────────────────────────────────────────────

function startExportPolling() {
  clearInterval(exportPolling);
  exportPolling = setInterval(async () => {
    const status = await fetch('/api/export/status').then(r => r.json());
    updateExportVoortgang(status);
    if (!status.bezig) {
      clearInterval(exportPolling);
      exportPolling = null;
      if (status.klaar || status.gestopt) {
        toonExportKlaar(status);
      }
    }
  }, 500);
}

function updateExportVoortgang(status) {
  const totaal = status.totaal || 1;
  const pct = Math.round((status.gedaan / totaal) * 100);

  document.getElementById('exportBalk').style.width = pct + '%';
  document.getElementById('exportVoortgangTekst').textContent =
    `Kopiëren... ${status.gedaan.toLocaleString()} / ${status.totaal.toLocaleString()}  (${pct}%)`;
  document.getElementById('exportHuidigBestand').textContent =
    status.huidigBestand ? 'Bezig met: ' + status.huidigBestand : '';

  if (status.fouten > 0) {
    const el = document.getElementById('exportFoutenTekst');
    el.style.display = '';
    el.textContent = status.fouten + ' fout(en)';
  }
}

// ─── Stoppen ─────────────────────────────────────────────

async function stopExport() {
  await fetch('/api/export/stop', { method: 'POST' });
}

// ─── Klaar-scherm ─────────────────────────────────────────

function toonExportKlaar(status) {
  document.getElementById('exportVoortgang').style.display = 'none';
  document.getElementById('exportKlaar').style.display = 'block';

  document.getElementById('klaarGedaan').textContent =
    status.gedaan.toLocaleString() + ' foto\'s';
  document.getElementById('klaarFouten').textContent =
    status.fouten === 0 ? '0 ✅' : status.fouten + ' ⚠';
  document.getElementById('klaarLocatie').textContent = status.doelmap;

  if (status.foutLog && status.foutLog.length > 0) {
    const log = document.getElementById('klaarFoutLog');
    log.style.display = 'block';
    log.innerHTML = '<strong>Fouten:</strong><br>' +
      status.foutLog.map(f => `${f.bestand}: ${f.fout}`).join('<br>');
  }
}

// ─── Reset ────────────────────────────────────────────────

async function resetExportUI() {
  await fetch('/api/export/reset', { method: 'POST' });
  document.getElementById('exportSetup').style.display = 'block';
  document.getElementById('exportVoortgang').style.display = 'none';
  document.getElementById('exportKlaar').style.display = 'none';
  document.getElementById('exportPreview').style.display = 'none';
  document.getElementById('exportDoelmap').value = '';
  document.getElementById('exportStartKnop').disabled = true;
}

// ─── Hervatten bij pagina laden ───────────────────────────

async function controleerExportStatus() {
  const status = await fetch('/api/export/status').then(r => r.json());
  if (status.bezig) {
    document.getElementById('exportSetup').style.display = 'none';
    document.getElementById('exportVoortgang').style.display = 'block';
    document.getElementById('exportKlaar').style.display = 'none';
    if (status.doelmap) document.getElementById('exportDoelmap').value = status.doelmap;
    startExportPolling();
  } else if (status.klaar || status.gestopt) {
    document.getElementById('exportSetup').style.display = 'none';
    document.getElementById('exportVoortgang').style.display = 'none';
    document.getElementById('exportKlaar').style.display = 'block';
    toonExportKlaar(status);
  }
}
