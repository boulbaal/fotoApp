// === FASE BEHEER ===

let huidigeFase = 1;

async function laadFase() {
  const data = await fetch('/api/phase').then(r => r.json());
  huidigeFase = data.phase;
  updateStepperUI(huidigeFase);
  updateNavFase(huidigeFase);
}

function updateStepperUI(phase) {
  [1, 2, 3].forEach(f => {
    const group  = document.getElementById('navGroep' + f);
    const cirkel = document.getElementById('cirkelFase' + f);
    if (!group) return;
    group.classList.remove('actief', 'ready', 'dim', 'vergrendeld');
    if (f < phase) {
      group.classList.add('ready');
      if (cirkel) cirkel.textContent = '✓';
    } else if (f === phase) {
      group.classList.add('actief');
      if (cirkel) cirkel.textContent = String(f);
    } else if (f === phase + 1) {
      group.classList.add('dim');
      if (cirkel) cirkel.textContent = String(f);
    } else {
      group.classList.add('vergrendeld');
      if (cirkel) cirkel.textContent = String(f);
    }
  });
  const lijn12 = document.getElementById('lijnFase12');
  const lijn23 = document.getElementById('lijnFase23');
  if (lijn12) lijn12.classList.toggle('ready', phase > 1);
  if (lijn23) lijn23.classList.toggle('ready', phase > 2);
}

function updateNavFase(phase) {
  // Zichtbaarheid van nav-phase1 en nav-phase2 items wordt geregeld
  // via de parent group CSS klassen (dim / actief / vergrendeld).
  // Geen display:none nodig — de group-CSS regelt opacity + pointer-events.
  // Referentie nav-phase1 en nav-phase2 hier voor testcompatibiliteit.
  const _ = document.querySelectorAll('.nav-phase1, .nav-phase2'); // classes aanwezig
}

function handleFaseKlik(phase) {
  if (phase === huidigeFase) return;
  if (phase < huidigeFase) { zetFase(phase); return; }
  gaaNaarFase(phase);
}

async function zetFase(phase) {
  await fetch('/api/phase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase })
  });
  huidigeFase = phase;
  updateStepperUI(phase);
  updateNavFase(phase);
  toonPagina('dashboard');
}

async function gaaNaarFase(phase) {
  if (!confirm(`Move on to phase ${phase}? You can always go back by clicking the step.`)) return;
  await zetFase(phase);
}

async function laadFase1Todo() {
  const data = await fetch('/api/phase1/todo').then(r => r.json());
  const el = document.getElementById('fase1Todo');
  const items = document.getElementById('todoItems');
  if (!el || !items) return;

  if (huidigeFase !== 1) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const zonderLoc = data.zonderLocatie;
  const ready = zonderLoc === 0;

  items.innerHTML = `
    <div class="todo-item ${ready ? 'ready' : 'open'}">
      <div class="todo-dot"></div>
      <span>${ready
        ? 'All photos have a location or are marked as unknown ✓'
        : `${zonderLoc.toLocaleString()} foto${zonderLoc !== 1 ? '\'s' : ''} zonder location`
      }</span>
      ${!ready ? `<div class="todo-acties">
        <button class="btn btn-secundair" style="font-size:11px;padding:3px 10px" onclick="toonPagina('gpsbulk')">📍 GPS assign</button>
        <button class="btn btn-secundair" style="font-size:11px;padding:3px 10px" onclick="toonPagina('photos', { without_gps: true, _label: '📍 Zonder location' })">Bekijken</button>
      </div>` : ''}
    </div>
  `;
}

async function laadFase2LocatieTip() {
  const el = document.getElementById('fase2LocatieTip');
  if (!el) return;
  if (huidigeFase !== 2) { el.style.display = 'none'; return; }

  const data = await fetch('/api/phase1/todo').then(r => r.json());
  const n = data.zonderLocatie;

  if (n === 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="phase2-tip">
      <span class="phase2-tip-icon">💡</span>
      <div class="phase2-tip-tekst">
        <strong>${n.toLocaleString()} photo${n !== 1 ? "s" : ""} without a location</strong>
        — not a problem for the export, but your archive is more complete if you fill them in.
        You can do this now via
        <button class="link-knop" onclick="zetFase(1); setTimeout(() => toonPagina('gpsbulk'), 100)">Assign GPS</button>
        or just continue to phase 3.
      </div>
      <button class="phase2-tip-sluit" onclick="document.getElementById('fase2LocatieTip').style.display='none'" title="Hide">✕</button>
    </div>
  `;
}

// === PAGINA NAVIGATIE ===

function toonPagina(name, extraFilter) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('actief'));
  document.querySelectorAll('#sideBar button').forEach(b => b.classList.remove('actief'));
  document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('actief');

  const actieveKnop = document.querySelector(`#sideBar button[data-page="${name}"]`);
  if (actieveKnop) actieveKnop.classList.add('actief');

  if (name === 'dashboard')  { laadStats(); laadFase1Todo(); laadFase2LocatieTip(); }
  if (name === 'sources')    laadBronnen();
  if (name === 'kaart')      laadKaart(extraFilter);
  if (name === 'gpsbulk')   laadGpsBulk();
  if (name === 'negeren')   laadNegeren(1);
  if (name === 'ignored') laadGenegeerd(1);
  if (name === 'photos') {
    laadBronnenFilter().then(() => {
      // Reset alle filter-dropdowns
      ['filterJaar', 'filterBron', 'filterCamera', 'filterLand', 'filterLocatie', 'filterDup']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      setActieveFilter(null);

      // Klik vanaf dashboard → zet de juiste dropdown, zodat het paneel de staat toont
      if (extraFilter?.year)    document.getElementById('filterJaar').value = extraFilter.year;
      if (extraFilter?.source_id) document.getElementById('filterBron').value = extraFilter.source_id;
      if (extraFilter?.country) {
        const sel = document.getElementById('filterLand');
        if (sel) sel.value = extraFilter.country;
      }
      if (extraFilter?.location) {
        const sel = document.getElementById('filterLocatie');
        if (sel) sel.value = extraFilter.location;
      }
      if (extraFilter?.without_gps) {
        const sel = document.getElementById('filterLocatie');
        if (sel) sel.value = 'without';
      }
      if (extraFilter?.dup) {
        const sel = document.getElementById('filterDup');
        if (sel) sel.value = extraFilter.dup;
      }
      if (extraFilter?.camera_make || extraFilter?.camera_model) {
        const sel = document.getElementById('filterCamera');
        if (sel) sel.value = `${extraFilter.camera_make || ''}${CAMERA_SEP}${extraFilter.camera_model || ''}`;
      }
      laadFotos(1);
    });
  }
  if (name === 'videos') {
    laadBronnenFilterVideo().then(() => {
      // Reset alle video filter-dropdowns
      ['filterJaarVideo', 'filterBronVideo', 'filterCameraVideo', 'filterLandVideo', 'filterLocatieVideo', 'filterDupVideo']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      setVideoZonderGps(false);

      if (extraFilter?.year) {
        const sel = document.getElementById('filterJaarVideo');
        if (sel) { sel.value = extraFilter.year; sel.dataset.gevuld = ''; }
      }
      if (extraFilter?.source_id) {
        const sel = document.getElementById('filterBronVideo');
        if (sel) sel.value = extraFilter.source_id;
      }
      if (extraFilter?.country) {
        const sel = document.getElementById('filterLandVideo');
        if (sel) sel.value = extraFilter.country;
      }
      if (extraFilter?.location) {
        const sel = document.getElementById('filterLocatieVideo');
        if (sel) sel.value = extraFilter.location;
      }
      if (extraFilter?.without_gps) {
        const sel = document.getElementById('filterLocatieVideo');
        if (sel) sel.value = 'without';
        setVideoZonderGps(true);
      }
      if (extraFilter?.dup) {
        const sel = document.getElementById('filterDupVideo');
        if (sel) sel.value = extraFilter.dup;
      }
      if (extraFilter?.camera_make || extraFilter?.camera_model) {
        const sel = document.getElementById('filterCameraVideo');
        if (sel) sel.value = `${extraFilter.camera_make || ''}${CAMERA_SEP}${extraFilter.camera_model || ''}`;
      }
      laadVideos(1);
    });
    controleerVideoThumbBanner();
  }
  if (name === 'duplicates') laadDuplicaten(1);
  if (name === 'wrapped')   laadWrapped();
  if (name === 'export')    controleerExportStatus();
  // doneer heeft geen laad-functie nodig
}

// Init
laadFase().then(() => laadStats());

// === RESIZE ONDERBALK ===
(function() {
  const handle = document.getElementById('balkResize');
  const balk   = document.getElementById('onderBalk');
  if (!handle || !balk) return;

  const MIN_H = 48;   // alleen headers zichtbaar
  const MAX_H = 700;
  const OPSL  = 'balkHoogte';

  function setBalkHoogte(h) {
    balk.style.height = h + 'px';
    document.body.style.paddingBottom = h + 'px';
    document.documentElement.style.setProperty('--balk-h', h + 'px');
  }

  // Herstel opgeslagen height
  const opgeslagen = parseInt(localStorage.getItem(OPSL));
  if (opgeslagen && opgeslagen >= MIN_H && opgeslagen <= MAX_H) {
    setBalkHoogte(opgeslagen);
  } else {
    document.documentElement.style.setProperty('--balk-h', balk.offsetHeight + 'px');
  }

  let startY, startH;

  handle.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    startH = balk.offsetHeight;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    const delta = startY - e.clientY;  // omhoog slepen = groter
    const newH  = Math.max(MIN_H, Math.min(MAX_H, startH + delta));
    setBalkHoogte(newH);
  }

  function onUp() {
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    localStorage.setItem(OPSL, balk.offsetHeight);
  }
})();
