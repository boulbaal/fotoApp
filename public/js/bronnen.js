async function laadBronnen() {
  const [bronnen, sc] = await Promise.all([
    fetch('/api/bronnen').then(r => r.json()),
    fetch('/api/scan/status').then(r => r.json())
  ]);

  const grid = document.getElementById('bronnenGrid');
  if (bronnen.length === 0) {
    grid.innerHTML = '<div class="leeg">Nog geen bronnen. Voeg een bron toe om te beginnen.</div>';
    return;
  }

  const wachtrijIds = (sc.wachtrij || []).map(w => w.id);
  const wachtrijPos = (id) => wachtrijIds.indexOf(id);

  grid.innerHTML = bronnen.map(b => {
    const isBezig = sc.bezig && sc.bron_id === b.id;
    const inWachtrij = wachtrijIds.includes(b.id);
    const positie = wachtrijPos(b.id);

    let knop = '';
    if (isBezig) {
      knop = `<button class="btn-groot btn-groot-stop" onclick="stopScan()">⏹ Stop scan</button>`;
    } else if (inWachtrij) {
      knop = `<button class="btn-groot btn-groot-stop" style="background:#6b7280" onclick="verwijderUitWachtrij(${b.id})">⏳ Wachtrij #${positie + 1} — klik om te verwijderen</button>`;
    } else {
      knop = `<button class="btn-groot btn-groot-start" onclick="startScan(${b.id}, '${b.naam.replace(/'/g,"\\'")}')">▶ Start scan</button>`;
    }

    const duurTekst = b.scan_duur_seconden != null ? ` <span style="color:#7c6af7">⏱ ${formatDuur(b.scan_duur_seconden)}</span>` : '';

    return `
    <div class="bron-kaart ${isBezig ? 'bezig' : ''}" id="bronKaart_${b.id}">
      <h3>${b.icoon || '💻'} ${b.naam}</h3>
      <div class="meta">
        <div>📁 ${b.pad}</div>
        <div>📷 ${(b.totaal_fotos || 0).toLocaleString()} foto's</div>
        <div>🕐 ${b.laatste_scan ? '✓ ' + formatDatumTijd(b.laatste_scan) + duurTekst : 'Nog niet gescand'}</div>
      </div>
      <label class="verborgen-optie" title="${window.i18n.t('verborgen_uitleg')}" style="display:flex; align-items:center; gap:6px; margin:6px 0 10px; font-size:13px; color:#9ca3af; cursor:pointer;">
        <input type="checkbox" ${b.verborgen_meenemen ? 'checked' : ''} onchange="zetVerborgen(${b.id}, this.checked)">
        ${window.i18n.t('verborgen_label')}
      </label>
      <div class="acties">
        ${knop}
        <button class="btn btn-secundair" onclick="bewerkBron(${b.id}, '${b.naam}', '${b.pad}', '${b.type}', ${b.verborgen_meenemen ? 1 : 0})" title="Bewerken">✏️</button>
        <button class="btn btn-gevaar" onclick="verwijderBron(${b.id})" title="Verwijderen">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function voegBronToe() {
  const naam = document.getElementById('bronNaam').value.trim();
  const pad  = document.getElementById('bronPad').value.trim();
  const type = document.getElementById('bronType').value;
  if (!naam || !pad) { alert('Vul naam en pad in'); return; }
  const icoonen = { pc: '💻', gsm: '📱', usb: '💾', extern: '🗄️' };
  const verborgen_meenemen = !!document.getElementById('bronVerborgen')?.checked;
  await fetch('/api/bronnen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naam, type, pad, icoon: icoonen[type], verborgen_meenemen })
  });
  document.getElementById('bronNaam').value = '';
  document.getElementById('bronPad').value = '';
  const vb = document.getElementById('bronVerborgen');
  if (vb) vb.checked = false;
  laadBronnen();
}

async function verwijderBron(id) {
  if (!confirm('Bron en alle bijhorende foto-records verwijderen?\n(De echte foto\'s worden NIET gewist)')) return;
  await fetch('/api/bronnen/' + id, { method: 'DELETE' });
  laadBronnen();
}

function bewerkBron(id, naam, pad, type, verborgen) {
  document.getElementById('bewerkId').value   = id;
  document.getElementById('bewerkNaam').value = naam;
  document.getElementById('bewerkPad').value  = pad;
  document.getElementById('bewerkType').value = type;
  const vb = document.getElementById('bewerkVerborgen');
  if (vb) vb.checked = !!verborgen;
  document.getElementById('bewerkOverlay').classList.add('open');
}

// Snelle toggle vanuit de bron-kaart: persisteer de "verborgen mappen"-keuze direct.
async function zetVerborgen(id, checked) {
  try {
    await fetch('/api/bronnen/' + id + '/verborgen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verborgen_meenemen: checked })
    });
    if (typeof logClient === 'function') {
      logClient(checked
        ? '👁 Verborgen mappen worden bij de volgende scan meegenomen'
        : '🙈 Verborgen mappen worden bij de volgende scan overgeslagen');
    }
  } catch (e) {
    if (typeof logClient === 'function') logClient('❌ Kon instelling niet opslaan: ' + e.message);
  }
}

function sluitBewerkModal(e) {
  if (!e || e.target === document.getElementById('bewerkOverlay')) {
    document.getElementById('bewerkOverlay').classList.remove('open');
  }
}

async function slaaBewerkingOp() {
  const id   = document.getElementById('bewerkId').value;
  const naam = document.getElementById('bewerkNaam').value.trim();
  const pad  = document.getElementById('bewerkPad').value.trim();
  const type = document.getElementById('bewerkType').value;
  if (!naam || !pad) { alert('Vul naam en pad in'); return; }
  const icoonen = { pc: '💻', gsm: '📱', usb: '💾', extern: '🗄️' };
  const verborgen_meenemen = !!document.getElementById('bewerkVerborgen')?.checked;
  await fetch('/api/bronnen/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naam, pad, type, icoon: icoonen[type] || '💻', verborgen_meenemen })
  });
  sluitBewerkModal();
  laadBronnen();
}

// === DATUM HERSTELLEN ===

async function herstelDatums() {
  const knop = document.getElementById('herstelDatumKnop');
  knop.disabled = true;
  knop.textContent = '⏳ Bezig...';
  try {
    const data = await fetch('/api/fotos/herstel-datum', { method: 'POST' }).then(r => r.json());
    knop.textContent = `✅ ${data.bijgewerkt} foto's bijgewerkt`;
    setTimeout(() => {
      knop.textContent = '📅 Herstel datum (bestandsnaam / aanmaakdatum)';
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
    knop.textContent = '⚠️ Zeker weten? Klik nogmaals om te bevestigen';
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
  knop.textContent = '⏳ Bezig...';
  knop.disabled = true;

  fetch('/api/database/wis', { method: 'POST' })
    .then(r => r.json())
    .then(() => {
      console.log('✅ Database gewist');
      location.reload();
    })
    .catch(() => {
      knop.textContent = '❌ Fout — probeer opnieuw';
      knop.disabled = false;
    });
}

async function propageerGps() {
  const status = document.getElementById('gpsPropageerStatus');
  status.textContent = '⏳ Bezig met GPS-data delen...';
  try {
    const r = await fetch('/api/scan/gps-propageren', { method: 'POST' });
    const data = await r.json();
    status.textContent = data.bijgewerkt > 0
      ? `✅ ${data.bijgewerkt} foto's bijgewerkt — herlaad de foto's pagina om het resultaat te zien`
      : '✅ Niets te updaten — GPS-data is al volledig gedeeld';
  } catch (e) {
    status.textContent = '❌ Fout bij GPS-data delen';
  }
}
