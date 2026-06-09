async function laadDuplicaten(pagina = 1) {
  const data = await fetch(`/api/duplicaten?pagina=${pagina}&per_pagina=10`).then(r => r.json());

  document.getElementById('dupInfo').innerHTML =
    `${data.totaal_groepen.toLocaleString()} groepen · ` +
    `<button class="btn btn-secundair" style="font-size:12px;padding:4px 10px" onclick="deelGpsMetDuplicaten()">🌍 GPS automatisch delen</button>`;

  const lijst = document.getElementById('duplicatenLijst');
  if (data.groepen.length === 0) {
    lijst.innerHTML = '<div class="leeg">Geen duplicaten gevonden.</div>';
    return;
  }

  lijst.innerHTML = data.groepen.map(g => `
    <div class="dup-groep">
      <h4>📋 ${g.aantal}× hetzelfde bestand · ${formatDatum(g.datum)}</h4>
      <div class="dup-fotos">
        ${g.fotos.map(f => `
          <div class="dup-foto" onclick="toonDetail(${f.id})" style="cursor:pointer">
            ${f.thumbnail
              ? `<img src="${f.thumbnail}" alt="${f.bestandsnaam}">`
              : `<div class="no-img">🖼️</div>`}
            <div class="bron">${f.bron_icoon || '💻'} ${f.bron_naam}</div>
            <div class="pad">${f.volledig_pad}</div>
            ${f.gps_lat ? `<div class="pad" style="color:#7c6af7">📍 ${f.gps_stad || ''} ${f.gps_land || ''}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Paginering
  const totaalPaginas = Math.ceil(data.totaal_groepen / 10);
  const pag = document.getElementById('dupPaginering');
  pag.innerHTML = '';
  if (totaalPaginas > 1) {
    const maakKnop = (tekst, p, actief) => {
      const b = document.createElement('button');
      b.textContent = tekst;
      if (actief) b.classList.add('actief');
      b.onclick = () => laadDuplicaten(p);
      return b;
    };
    if (pagina > 1) pag.appendChild(maakKnop('‹', pagina - 1, false));
    for (let p = Math.max(1, pagina - 2); p <= Math.min(totaalPaginas, pagina + 2); p++) {
      pag.appendChild(maakKnop(p, p, p === pagina));
    }
    if (pagina < totaalPaginas) pag.appendChild(maakKnop('›', pagina + 1, false));
  }
}

async function deelGpsMetDuplicaten() {
  const knop = event.target;
  knop.disabled = true;
  knop.textContent = '⏳ Bezig...';

  const data = await fetch('/api/duplicaten/gps-delen', { method: 'POST' }).then(r => r.json());

  knop.disabled = false;
  knop.textContent = `✅ ${data.bijgewerkt.toLocaleString()} foto's bijgewerkt`;
  setTimeout(() => laadDuplicaten(1), 2000);
}
