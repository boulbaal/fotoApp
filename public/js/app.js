function toonPagina(naam, extraFilter) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('actief'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('actief'));
  document.getElementById('pagina' + naam.charAt(0).toUpperCase() + naam.slice(1)).classList.add('actief');
  const namen = ['dashboard', 'bronnen', 'fotos', 'duplicaten', 'kaart', 'gpsbulk'];
  const idx = namen.indexOf(naam);
  if (idx >= 0) document.querySelectorAll('nav button')[idx].classList.add('actief');

  if (naam === 'dashboard')   laadStats();
  if (naam === 'bronnen')     laadBronnen();
  if (naam === 'kaart')       laadKaart();
  if (naam === 'gpsbulk')    laadGpsBulk();
  if (naam === 'fotos') {
    laadBronnenFilter().then(() => {
      // Reset alle filters
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
  if (naam === 'duplicaten')  laadDuplicaten(1);
}

// Init
laadStats();

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
