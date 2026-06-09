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
    const stap = document.getElementById('stapFase' + f);
    const cirkel = document.getElementById('cirkelFase' + f);
    stap.classList.remove('actief', 'klaar');
    if (f < fase) {
      stap.classList.add('klaar');
      cirkel.textContent = '✓';
    } else if (f === fase) {
      stap.classList.add('actief');
      cirkel.textContent = String(f);
    } else {
      cirkel.textContent = String(f);
    }
  });
  const lijn12 = document.getElementById('lijnFase12');
  const lijn23 = document.getElementById('lijnFase23');
  if (lijn12) lijn12.classList.toggle('klaar', fase > 1);
  if (lijn23) lijn23.classList.toggle('klaar', fase > 2);
}

function updateNavFase(fase) {
  document.querySelectorAll('.nav-fase1').forEach(el => {
    el.style.display = fase === 1 ? '' : 'none';
  });
  document.querySelectorAll('.nav-fase2').forEach(el => {
    el.style.display = fase === 2 ? '' : 'none';
  });
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

// === PAGINA NAVIGATIE ===

function toonPagina(naam, extraFilter) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('actief'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('actief'));
  document.getElementById('pagina' + naam.charAt(0).toUpperCase() + naam.slice(1)).classList.add('actief');

  const namen1 = ['dashboard', 'bronnen', 'fotos', 'duplicaten', 'kaart', 'gpsbulk'];
  const namen2 = ['dashboard', 'fotos', 'negeren', 'genegeerd'];
  const namenActief = huidigeFase === 2 ? namen2 : namen1;
  const navKnoppen = [...document.querySelectorAll('nav button')].filter(b => b.style.display !== 'none');
  const idx = namenActief.indexOf(naam);
  if (idx >= 0 && navKnoppen[idx]) navKnoppen[idx].classList.add('actief');

  if (naam === 'dashboard')  { laadStats(); laadFase1Todo(); }
  if (naam === 'bronnen')    laadBronnen();
  if (naam === 'kaart')      laadKaart();
  if (naam === 'gpsbulk')   laadGpsBulk();
  if (naam === 'negeren')   laadNegeren(1);
  if (naam === 'genegeerd') laadGenegeerd(1);
  if (naam === 'fotos') {
    laadBronnenFilter().then(() => {
      document.getElementById('filterJaar').value = '';
      document.getElementById('filterBron').value = '';
      setActieveFilter(null);

      if (extraFilter?.jaar)    document.getElementById('filterJaar').value = extraFilter.jaar;
      if (extraFilter?.bron_id) document.getElementById('filterBron').value = extraFilter.bron_id;
      if (extraFilter?.land) {
        setActieveFilter({ params: { land: extraFilter.land }, label: extraFilter._label });
      }
      if (extraFilter?.zonder_gps) {
        setActieveFilter({ params: { zonder_gps: '1' }, label: extraFilter._label || '📍 Zonder locatie' });
      }
      if (extraFilter?.camera_merk || extraFilter?.camera_model) {
        setActieveFilter({
          params: {
            ...(extraFilter.camera_merk  && { camera_merk:  extraFilter.camera_merk }),
            ...(extraFilter.camera_model && { camera_model: extraFilter.camera_model })
          },
          label: extraFilter._label
        });
      }
      laadFotos(1);
    });
  }
  if (naam === 'duplicaten') laadDuplicaten(1);
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
