// === FASE 2: NEGEREN ===

async function laadNegeren(pagina = 1) {
  const zoek = document.getElementById('negerenZoek')?.value || '';
  const filter = document.getElementById('negerenFilter')?.value || 'alle';

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
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">Geen foto\'s gevonden</div>';
    return;
  }

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item ${f.genegeerd ? 'foto-genegeerd' : ''}" onclick="toonDetail(${f.id})">
      ${f.is_duplicaat ? '<div class="dup-badge">DUP</div>' : ''}
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">🖼️</div>`}
      <div class="info">
        <div class="naam">${f.bestandsnaam}</div>
        <div class="datum">${formatDatum(f.datum_foto)}${f.gps_stad ? ' · ' + f.gps_stad : ''}</div>
      </div>
      <button class="negeer-knop ${f.genegeerd ? 'hersteld' : ''}"
        onclick="event.stopPropagation(); toggleNegeer(${f.id}, this)">
        ${f.genegeerd ? '↩ Herstellen' : '🚫 Negeren'}
      </button>
    </div>
  `).join('');

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
  if (!grid) return;

  if (data.fotos.length === 0) {
    grid.innerHTML = '';
    if (leeg) leeg.style.display = 'block';
    return;
  }
  if (leeg) leeg.style.display = 'none';

  grid.innerHTML = data.fotos.map(f => `
    <div class="foto-item foto-genegeerd" onclick="toonDetail(${f.id})">
      <div class="bron-badge">${f.bron_icoon || '💻'}</div>
      ${f.thumbnail
        ? `<img src="${f.thumbnail}" loading="lazy" alt="${f.bestandsnaam}">`
        : `<div class="no-img">🖼️</div>`}
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
}
