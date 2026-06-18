// === FASE 2: NEGEREN ===

async function laadNegeren(pagina = 1) {
  const zoek = document.getElementById('negerenZoek')?.value || '';
  const filter = document.getElementById('negerenFilter')?.value || 'nog-niet';

  const params = new URLSearchParams({
    pagina, per_pagina: 200,
    zonder_kopien: 1,
    genegeerd: filter === 'alle' ? '' : '0',
    ...(zoek && { zoek })
  });

  const data = await fetch('/api/fotos?' + params).then(r => r.json());
  const teller = document.getElementById('negerenTeller');
  if (teller) teller.textContent = `${data.totaal.toLocaleString()} foto's`;

  const grid = document.getElementById('negerenGrid');
  if (!grid) return;

  if (data.fotos.length === 0) {
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_negeren') + '</div>';
    return;
  }

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item negeer-item ${f.genegeerd ? 'foto-genegeerd' : ''}"
         data-foto="${f.id}"
         onclick="toggleNegeerItem(${f.id}, this)">
      ${f.is_duplicaat ? '<div class="status-badge badge-dup">DUP</div>' : ''}
      ${f.geexporteerd ? '<div class="export-badge">✓</div>' : ''}
      <div class="status-badge ${f.genegeerd ? 'badge-negeren' : 'badge-meenemen'}">
        ${f.genegeerd ? 'NEGEREN' : 'MEENEMEN'}
      </div>
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      ${f.is_video ? `<div class="video-badge">▶${f.duur ? ' ' + formatDuur(f.duur) : ''}</div>` : ''}
      <div class="info">
        <div class="naam">${f.bestandsnaam}</div>
        <div class="datum">${formatDatum(f.datum_foto)}${f.gps_stad ? ' · ' + f.gps_stad : ''}</div>
      </div>
    </div>
  `).join('');

  bindNegerenHoverPreview();

  const totaalPaginas = Math.ceil(data.totaal / 200);
  const pag = document.getElementById('negerenPaginering');
  if (pag) {
    pag.innerHTML = '';
    if (totaalPaginas > 1) {
      if (pagina > 1) {
        const b = document.createElement('button');
        b.textContent = '‹'; b.onclick = () => laadNegeren(pagina - 1); pag.appendChild(b);
      }
      for (let p = Math.max(1, pagina - 2); p <= Math.min(totaalPaginas, pagina + 2); p++) {
        const b = document.createElement('button');
        b.textContent = p; if (p === pagina) b.classList.add('actief');
        b.onclick = () => laadNegeren(p); pag.appendChild(b);
      }
      if (pagina < totaalPaginas) {
        const b = document.createElement('button');
        b.textContent = '›'; b.onclick = () => laadNegeren(pagina + 1); pag.appendChild(b);
      }
    }
  }
}

async function toggleNegeerItem(id, el) {
  const isNuGenegeerd = el.classList.contains('foto-genegeerd');
  const nieuwGenegeerd = !isNuGenegeerd;

  const r = await fetch(`/api/fotos/${id}/negeer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genegeerd: nieuwGenegeerd })
  });

  if (!r.ok) return;

  if (nieuwGenegeerd) {
    // Genegeerd → laat de foto uit de review-lijst verdwijnen (staat nu bij Genegeerd)
    el.classList.add('verdwijnt');
    verlaagNegerenTeller();
    setTimeout(() => {
      el.remove();
      const grid = document.getElementById('negerenGrid');
      if (grid && grid.querySelectorAll('.negeer-item').length === 0) {
        grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_negeren') + '</div>';
      }
    }, 320);
  } else {
    // MEENEMEN → blijft staan, alleen de badge terugzetten
    el.classList.remove('foto-genegeerd');
    const badge = el.querySelector('.badge-negeren, .badge-meenemen');
    if (badge) {
      badge.className = 'status-badge badge-meenemen';
      badge.textContent = 'MEENEMEN';
    }
  }
}

// Verlaag de "X foto's"-teller met 1 (min. 0)
function verlaagNegerenTeller() {
  const teller = document.getElementById('negerenTeller');
  if (!teller) return;
  const huidig = parseInt((teller.textContent || '').replace(/[^\d]/g, ''), 10);
  if (!isNaN(huidig) && huidig > 0) {
    teller.textContent = `${(huidig - 1).toLocaleString()} foto's`;
  }
}

// Bewaar toggleNegeer voor achterwaartse compatibiliteit (genegeerd-pagina)
async function toggleNegeer(id, knop) {
  const isNuGenegeerd = knop.classList.contains('hersteld');
  const r = await fetch(`/api/fotos/${id}/negeer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genegeerd: !isNuGenegeerd })
  });
  if (r.ok) {
    const fotoItem = knop.closest('.foto-item');
    if (!isNuGenegeerd) {
      fotoItem.classList.add('foto-genegeerd');
      knop.classList.add('hersteld');
      knop.textContent = '↩ Herstellen';
    } else {
      fotoItem.classList.remove('foto-genegeerd');
      knop.classList.remove('hersteld');
      knop.textContent = '🚫 Negeren';
    }
  }
}

async function laadGenegeerd(pagina = 1) {
  const params = new URLSearchParams({ pagina, per_pagina: 200, genegeerd: '1', zonder_kopien: 1 });
  const data = await fetch('/api/fotos?' + params).then(r => r.json());

  const grid = document.getElementById('genegeerGrid');
  const leeg = document.getElementById('genegeerLeeg');
  const verwijderKnop = document.getElementById('verwijderGenegeerdKnop');
  if (!grid) return;

  if (data.fotos.length === 0) {
    grid.innerHTML = '';
    if (leeg) leeg.style.display = 'block';
    if (verwijderKnop) verwijderKnop.style.display = 'none';
    return;
  }
  if (leeg) leeg.style.display = 'none';
  if (verwijderKnop) verwijderKnop.style.display = '';

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item negeer-item foto-genegeerd" data-foto="${f.id}">
      ${f.is_duplicaat ? '<div class="status-badge badge-dup">DUP</div>' : ''}
      <div class="status-badge badge-negeren">NEGEREN</div>
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      ${f.is_video ? `<div class="video-badge">▶${f.duur ? ' ' + formatDuur(f.duur) : ''}</div>` : ''}
      <div class="info">
        <div class="naam">${f.bestandsnaam}</div>
        <div class="datum">${formatDatum(f.datum_foto)}${f.gps_stad ? ' · ' + f.gps_stad : ''}</div>
      </div>
      <button class="negeer-knop hersteld"
        onclick="event.stopPropagation(); toggleNegeer(${f.id}, this); setTimeout(() => laadGenegeerd(${pagina}), 200)">
        ↩ Herstellen
      </button>
    </div>
  `).join('');

  bindNegerenHoverPreview();
}

// Verwijder ALLE genegeerde foto's definitief (naar prullenbak + uit database)
async function verwijderAlleGenegeerd() {
  const teller = document.getElementById('genegeerGrid');
  const aantal = teller ? teller.querySelectorAll('.negeer-item').length : 0;

  const bevestig = confirm(
    "LET OP — dit verwijdert de genegeerde foto's ECHT:\n\n" +
    "• De bestanden gaan naar de prullenbak van je computer (herstelbaar)\n" +
    "• Ze worden uit de database gewist, zodat ze niet opnieuw gescand worden\n" +
    "• Alle duplicaten in dezelfde groep gaan mee\n\n" +
    "Weet je het zeker?"
  );
  if (!bevestig) return;

  const knop = document.getElementById('verwijderGenegeerdKnop');
  if (knop) { knop.disabled = true; knop.textContent = '🗑️ Bezig met verwijderen...'; }

  try {
    const r = await fetch('/api/genegeerd/verwijder', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Verwijderen mislukt: ' + (data.fout || data.detail || 'onbekende fout'));
      return;
    }
    let bericht = `${data.verwijderd} foto('s) verwijderd.`;
    if (data.naarPrullenbak) bericht += `\n${data.naarPrullenbak} naar de prullenbak verplaatst.`;
    if (data.ontbrak) bericht += `\n${data.ontbrak} bestand(en) bestonden al niet meer (alleen DB opgeschoond).`;
    if (data.mislukt && data.mislukt.length) bericht += `\n${data.mislukt.length} bestand(en) konden niet verplaatst worden.`;
    alert(bericht);
  } catch (e) {
    alert('Verwijderen mislukt: ' + e.message);
  } finally {
    if (knop) { knop.disabled = false; knop.textContent = '🗑️ Verwijder alle genegeerde definitief'; }
    laadGenegeerd(1);
  }
}

// === HOVER PREVIEW ===

let negerenPreviewTimer = null;
let negerenMusX = 0, negerenMusY = 0;

function bindNegerenHoverPreview() {
  document.querySelectorAll('.negeer-item').forEach(el => {
    el.addEventListener('mouseenter', onNegerenHoverIn);
    el.addEventListener('mousemove',  onNegerenMusBeweeg);
    el.addEventListener('mouseleave', onNegerenHoverUit);
  });
}

function onNegerenHoverIn(e) {
  negerenMusX = e.clientX;
  negerenMusY = e.clientY;
  const el = e.currentTarget;
  clearTimeout(negerenPreviewTimer);
  negerenPreviewTimer = setTimeout(() => toonNegerenPreview(el), 400);
}

function onNegerenMusBeweeg(e) {
  negerenMusX = e.clientX;
  negerenMusY = e.clientY;
}

function onNegerenHoverUit() {
  clearTimeout(negerenPreviewTimer);
  const preview = document.getElementById('bulkThumbPreview');
  if (preview) preview.style.display = 'none';
}

function toonNegerenPreview(el) {
  const fotoId = el.dataset.foto;
  const preview = document.getElementById('bulkThumbPreview');
  if (!preview) return;

  preview.innerHTML = `<img src="/api/fotos/${fotoId}/thumbnail" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  preview.style.display = 'block';

  const pw = 480, ph = 360;
  const gap = 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = window.scrollY;
  const mx = negerenMusX, my = negerenMusY;

  let left, top;

  // Kies de zijde met de meeste ruimte, nooit over de muis
  const ruimteRechts = vw - mx - gap;
  const ruimteLinks  = mx - gap;
  const ruimteBoven  = my - gap;
  const ruimteOnder  = vh - my - gap;

  if (ruimteRechts >= pw) {
    // rechts van muis
    left = mx + gap;
    top  = Math.max(sx + 8, Math.min(my - ph / 2 + sx, sx + vh - ph - 8));
  } else if (ruimteLinks >= pw) {
    // links van muis
    left = mx - gap - pw;
    top  = Math.max(sx + 8, Math.min(my - ph / 2 + sx, sx + vh - ph - 8));
  } else if (ruimteBoven >= ph) {
    // boven muis
    top  = my - gap - ph + sx;
    left = Math.max(8, Math.min(mx - pw / 2, vw - pw - 8));
  } else {
    // onder muis
    top  = my + gap + sx;
    left = Math.max(8, Math.min(mx - pw / 2, vw - pw - 8));
  }

  preview.style.left = left + 'px';
  preview.style.top  = top  + 'px';
}
