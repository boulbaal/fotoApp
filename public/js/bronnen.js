async function laadBronnen() {
  const [sources, sc] = await Promise.all([
    fetch('/api/sources').then(r => r.json()),
    fetch('/api/scan/status').then(r => r.json())
  ]);

  const grid = document.getElementById('bronnenGrid');
  if (sources.length === 0) {
    grid.innerHTML = '<div class="leeg">No sources yet. Add a source to get started.</div>';
    return;
  }

  const wachtrijIds = (sc.queue || []).map(w => w.id);
  const wachtrijPos = (id) => wachtrijIds.indexOf(id);

  grid.innerHTML = sources.map(b => {
    const isBezig = sc.running && sc.source_id === b.id;
    const inWachtrij = wachtrijIds.includes(b.id);
    const position = wachtrijPos(b.id);

    let knop = '';
    if (isBezig) {
      knop = `<button class="btn-groot btn-groot-stop" onclick="stopScan()">⏹ Stop scan</button>`;
    } else if (inWachtrij) {
      knop = `<button class="btn-groot btn-groot-stop" style="background:#6b7280" onclick="verwijderUitWachtrij(${b.id})">⏳ Queue #${position + 1} — click to remove</button>`;
    } else {
      knop = `<button class="btn-groot btn-groot-start" onclick="startScan(${b.id}, '${b.name.replace(/'/g,"\\'")}')">▶ Start scan</button>`;
    }

    const duurTekst = b.scan_duur_seconden != null ? ` <span style="color:#7c6af7">⏱ ${formatDuur(b.scan_duur_seconden)}</span>` : '';

    return `
    <div class="bron-kaart ${isBezig ? 'running' : ''}" id="bronKaart_${b.id}">
      <h3>${b.icon || '💻'} ${b.name}</h3>
      <div class="meta">
        <div>📁 ${b.path}</div>
        <div>📷 ${(b.total_photos || 0).toLocaleString()} photos</div>
        <div>🕐 ${b.last_scan ? '✓ ' + formatDatumTijd(b.last_scan) + duurTekst : 'Not scanned yet'}</div>
      </div>
      <label class="hidden-optie" title="${window.i18n.t('verborgen_uitleg')}" style="display:flex; align-items:center; gap:6px; margin:6px 0 10px; font-size:13px; color:#9ca3af; cursor:pointer;">
        <input type="checkbox" ${b.include_hidden ? 'checked' : ''} onchange="zetVerborgen(${b.id}, this.checked)">
        ${window.i18n.t('verborgen_label')}
      </label>
      <div class="acties">
        ${knop}
        <button class="btn btn-secundair" onclick="bewerkBron(${b.id}, '${b.name}', '${b.path}', '${b.type}', ${b.include_hidden ? 1 : 0})" title="Edit">✏️</button>
        <button class="btn btn-gevaar" onclick="verwijderBron(${b.id})" title="Delete">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function voegBronToe() {
  const name = document.getElementById('sourceName').value.trim();
  const path  = document.getElementById('bronPad').value.trim();
  const type = document.getElementById('bronType').value;
  if (!name || !path) { alert('Vul name en path in'); return; }
  const icoonen = { pc: '💻', gsm: '📱', usb: '💾', external: '🗄️' };
  const include_hidden = !!document.getElementById('bronVerborgen')?.checked;
  await fetch('/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, path, icon: icoonen[type], include_hidden })
  });
  document.getElementById('sourceName').value = '';
  document.getElementById('bronPad').value = '';
  const vb = document.getElementById('bronVerborgen');
  if (vb) vb.checked = false;
  laadBronnen();
}

async function verwijderBron(id) {
  if (!confirm('Delete this source and all its photo records?\n(The actual photos are NOT deleted)')) return;
  await fetch('/api/sources/' + id, { method: 'DELETE' });
  laadBronnen();
}

function bewerkBron(id, name, path, type, hidden) {
  document.getElementById('bewerkId').value   = id;
  document.getElementById('bewerkNaam').value = name;
  document.getElementById('bewerkPad').value  = path;
  document.getElementById('bewerkType').value = type;
  const vb = document.getElementById('bewerkVerborgen');
  if (vb) vb.checked = !!hidden;
  document.getElementById('bewerkOverlay').classList.add('open');
}

// Snelle toggle vanuit de bron-kaart: persisteer de "hidden folders"-keuze direct.
async function zetVerborgen(id, checked) {
  try {
    await fetch('/api/sources/' + id + '/hidden', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_hidden: checked })
    });
    if (typeof logClient === 'function') {
      logClient(checked
        ? '👁 Hidden folders will be included in the next scan'
        : '🙈 Hidden folders will be skipped in the next scan');
    }
  } catch (e) {
    if (typeof logClient === 'function') logClient('❌ Could not save setting: ' + e.message);
  }
}

function sluitBewerkModal(e) {
  if (!e || e.target === document.getElementById('bewerkOverlay')) {
    document.getElementById('bewerkOverlay').classList.remove('open');
  }
}

async function slaaBewerkingOp() {
  const id   = document.getElementById('bewerkId').value;
  const name = document.getElementById('bewerkNaam').value.trim();
  const path  = document.getElementById('bewerkPad').value.trim();
  const type = document.getElementById('bewerkType').value;
  if (!name || !path) { alert('Vul name en path in'); return; }
  const icoonen = { pc: '💻', gsm: '📱', usb: '💾', external: '🗄️' };
  const include_hidden = !!document.getElementById('bewerkVerborgen')?.checked;
  await fetch('/api/sources/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path, type, icon: icoonen[type] || '💻', include_hidden })
  });
  sluitBewerkModal();
  laadBronnen();
}

// === DATUM HERSTELLEN ===

async function herstelDatums() {
  const knop = document.getElementById('herstelDatumKnop');
  knop.disabled = true;
  knop.textContent = '⏳ Working...';
  try {
    const data = await fetch('/api/photos/restore-date', { method: 'POST' }).then(r => r.json());
    knop.textContent = `✅ ${data.updated} photos updated`;
    setTimeout(() => {
      knop.textContent = '📅 Herstel date (filename / aanmaakdatum)';
      knop.disabled = false;
    }, 4000);
  } catch {
    knop.textContent = '❌ Fout';
    knop.disabled = false;
  }
}

// === DATABASE WIS ===

let wisBevestigStap = 0;
let wisTimer = null;

function wisDatabase() {
  if (wisBevestigStap === 0) {
    // Eerste klik: toon bevestigingsvraag
    wisBevestigStap = 1;
    const knop = document.getElementById('wisDatabaseKnop');
    knop.textContent = '⚠️ Are you sure? Click again to confirm';
    knop.style.background = '#dc2626';
    // Reset na 5 seconden
    wisTimer = setTimeout(() => {
      wisBevestigStap = 0;
      knop.textContent = '🗑️ Wis volledige database';
      knop.style.background = '';
    }, 5000);
    return;
  }

  // Tweede klik: uitvoeren
  clearTimeout(wisTimer);
  wisBevestigStap = 0;
  const knop = document.getElementById('wisDatabaseKnop');
  knop.textContent = '⏳ Working...';
  knop.disabled = true;

  fetch('/api/database/delete', { method: 'POST' })
    .then(r => r.json())
    .then(() => {
      console.log('✅ Database cleared');
      location.reload();
    })
    .catch(() => {
      knop.textContent = '❌ Error — try again';
      knop.disabled = false;
    });
}

async function propageerGps() {
  const status = document.getElementById('gpsPropageerStatus');
  status.textContent = '⏳ Sharing GPS data...';
  try {
    const r = await fetch('/api/scan/gps-propagate', { method: 'POST' });
    const data = await r.json();
    status.textContent = data.updated > 0
      ? `✅ ${data.updated} photos updated — reload the photos page to see the result`
      : '✅ Niets te updaten — GPS-data is al volledig gedeeld';
  } catch (e) {
    status.textContent = '❌ Fout bij GPS-data share';
  }
}
