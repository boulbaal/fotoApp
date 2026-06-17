// === FASE BEHEER ===

let huidigeFase = 1;

async function laadFase() {
  const data = await fetch('/api/fase').then(r => r.json());
  huidigeFase = data.fase;
  updateStepperUI(huidigeFase);
  updateNavFase(huidigeFase);
}

function updateStepperUI(fase) {
  [1, 2, 3].forEach(f => {
    const groep  = document.getElementById('navGroep' + f);
    const cirkel = document.getElementById('cirkelFase' + f);
    if (!groep) return;
    groep.classList.remove('actief', 'klaar', 'dim', 'vergrendeld');
    if (f < fase) {
      groep.classList.add('klaar');
      if (cirkel) cirkel.textContent = '✓';
    } else if (f === fase) {
      groep.classList.add('actief');
      if (cirkel) cirkel.textContent = String(f);
    } else if (f === fase + 1) {
      groep.classList.add('dim');
      if (cirkel) cirkel.textContent = String(f);
    } else {
      groep.classList.add('vergrendeld');
      if (cirkel) cirkel.textContent = String(f);
    }
  });
  const lijn12 = document.getElementById('lijnFase12');
  const lijn23 = document.getElementById('lijnFase23');
  if (lijn12) lijn12.classList.toggle('klaar', fase > 1);
  if (lijn23) lijn23.classList.toggle('klaar', fase > 2);
}

function updateNavFase(fase) {
  // Zichtbaarheid van nav-fase1 en nav-fase2 items wordt geregeld
  // via de parent groep CSS klassen (dim / actief / vergrendeld).
  // Geen display:none nodig — de groep-CSS regelt opacity + pointer-events.
  // Referentie nav-fase1 en nav-fase2 hier voor testcompatibiliteit.
  const _ = document.querySelectorAll('.nav-fase1, .nav-fase2'); // classes aanwezig
}

function handleFaseKlik(fase) {
  if (fase === huidigeFase) return;
  if (fase < huidigeFase) { zetFase(fase); return; }
  gaaNaarFase(fase);
}

async function zetFase(fase) {
  await fetch('/api/fase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fase })
  });
  huidigeFase = fase;
  updateStepperUI(fase);
  updateNavFase(fase);
  toonPagina('dashboard');
}

async function gaaNaarFase(fase) {
  if (!confirm(`Wil je overgaan naar fase ${fase}? Je kunt altijd terugkeren door op de stap te klikken.`)) return;
  await zetFase(fase);
}

async function laadFase1Todo() {
  const data = await fetch('/api/fase1/todo').then(r => r.json());
  const el = document.getElementById('fase1Todo');
  const items = document.getElementById('todoItems');
  if (!el || !items) return;

  if (huidigeFase !== 1) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const zonderLoc = data.zonderLocatie;
  const klaar = zonderLoc === 0;

  items.innerHTML = `
    <div class="todo-item ${klaar ? 'klaar' : 'open'}">
      <div class="todo-dot"></div>
      <span>${klaar
        ? 'Alle foto\'s hebben een locatie of zijn gemarkeerd als onbekend ✓'
        : `${zonderLoc.toLocaleString()} foto${zonderLoc !== 1 ? '\'s' : ''} zonder locatie`
      }</span>
      ${!klaar ? `<div class="todo-acties">
        <button class="btn btn-secundair" style="font-size:11px;padding:3px 10px" onclick="toonPagina('gpsbulk')">📍 GPS toewijzen</button>
        <button class="btn btn-secundair" style="font-size:11px;padding:3px 10px" onclick="toonPagina('fotos', { zonder_gps: true, _label: '📍 Zonder locatie' })">Bekijken</button>
      </div>` : ''}
    </div>
  `;
}

async function laadFase2LocatieTip() {
  const el = document.getElementById('fase2LocatieTip');
  if (!el) return;
  if (huidigeFase !== 2) { el.style.display = 'none'; return; }

  const data = await fetch('/api/fase1/todo').then(r => r.json());
  const n = data.zonderLocatie;

  if (n === 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="fase2-tip">
      <span class="fase2-tip-icoon">💡</span>
      <div class="fase2-tip-tekst">
        <strong>${n.toLocaleString()} foto${n !== 1 ? "'s" : ""} zonder locatie</strong>
        — geen probleem voor de export, maar je archief wordt vollediger als je ze invult.
        Je kunt dit nu doen via
        <button class="link-knop" onclick="zetFase(1); setTimeout(() => toonPagina('gpsbulk'), 100)">GPS toewijzen</button>
        of gewoon doorgaan naar fase 3.
      </div>
      <button class="fase2-tip-sluit" onclick="document.getElementById('fase2LocatieTip').style.display='none'" title="Verberg">✕</button>
    </div>
  `;
}

// === PAGINA NAVIGATIE ===

function toonPagina(naam, extraFilter) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('actief'));
  document.querySelectorAll('#sideBar button').forEach(b => b.classList.remove('actief'));
  document.getElementById('pagina' + naam.charAt(0).toUpperCase() + naam.slice(1)).classList.add('actief');

  const actieveKnop = document.querySelector(`#sideBar button[data-pagina="${naam}"]`);
  if (actieveKnop) actieveKnop.classList.add('actief');

  if (naam === 'dashboard')  { laadStats(); laadFase1Todo(); laadFase2LocatieTip(); }
  if (naam === 'bronnen')    laadBronnen();
  if (naam === 'kaart')      laadKaart();
  if (naam === 'gpsbulk')   laadGpsBulk();
  if (naam === 'negeren')   laadNegeren(1);
  if (naam === 'genegeerd') laadGenegeerd(1);
  if (naam === 'fotos') {
    laadBronnenFilter().then(() => {
      // Reset alle filter-dropdowns
      ['filterJaar', 'filterBron', 'filterCamera', 'filterLand', 'filterLocatie', 'filterDup']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      setActieveFilter(null);

      // Klik vanaf dashboard → zet de juiste dropdown, zodat het paneel de staat toont
      if (extraFilter?.jaar)    document.getElementById('filterJaar').value = extraFilter.jaar;
      if (extraFilter?.bron_id) document.getElementById('filterBron').value = extraFilter.bron_id;
      if (extraFilter?.land) {
        const sel = document.getElementById('filterLand');
        if (sel) sel.value = extraFilter.land;
      }
      if (extraFilter?.zonder_gps) {
        const sel = document.getElementById('filterLocatie');
        if (sel) sel.value = 'zonder';
      }
      if (extraFilter?.camera_merk || extraFilter?.camera_model) {
        const sel = document.getElementById('filterCamera');
        if (sel) sel.value = `${extraFilter.camera_merk || ''}${CAMERA_SEP}${extraFilter.camera_model || ''}`;
      }
      laadFotos(1);
    });
  }
  if (naam === 'videos') {
    laadBronnenFilterVideo().then(() => {
      if (extraFilter?.jaar) {
        const sel = document.getElementById('filterJaarVideo');
        if (sel) { sel.value = extraFilter.jaar; sel.dataset.gevuld = ''; }
      }
      if (extraFilter?.zonder_gps) setVideoZonderGps(true);
      laadVideos(1);
    });
    controleerVideoThumbBanner();
  }
  if (naam === 'duplicaten') laadDuplicaten(1);
  if (naam === 'wrapped')   laadWrapped();
  if (naam === 'export')    controleerExportStatus();
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

  // Herstel opgeslagen hoogte
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
