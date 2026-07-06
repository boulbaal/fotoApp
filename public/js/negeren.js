// === FASE 2: NEGEREN ===

async function laadNegeren(page = 1) {
  const search = document.getElementById('negerenZoek')?.value || '';
  const filter = document.getElementById('negerenFilter')?.value || 'pending';

  const params = new URLSearchParams({
    page, per_page: 50, without_thumbnail: 1,
    without_copies: 1,
    ignored: filter === 'all' ? '' : '0',
    ...(search && { search })
  });

  const data = await fetch('/api/photos?' + params).then(r => r.json());
  const teller = document.getElementById('negerenTeller');
  if (teller) teller.textContent = `${data.total.toLocaleString()} photos`;

  const grid = document.getElementById('negerenGrid');
  if (!grid) return;

  if (data.photos.length === 0) {
    grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_negeren') + '</div>';
    return;
  }

  grid.innerHTML = data.photos.map(f => `
    <div class="foto-item ignore-item ${f.ignored ? 'foto-ignored' : ''}"
         data-foto="${f.id}"
         onclick="toggleNegeerItem(${f.id}, this)">
      ${f.is_duplicate ? '<div class="status-badge badge-dup">DUP</div>' : ''}
      ${f.exported ? '<div class="export-badge">✓</div>' : ''}
      <div class="status-badge ${f.ignored ? 'badge-negeren' : 'badge-meenemen'}">
        ${f.ignored ? 'NEGEREN' : 'MEENEMEN'}
      </div>
      <div class="bron-badge">${f.source_icon || '💻'}</div>
      ${f.has_thumbnail
        ? `<img src="/api/photos/${f.id}/thumbnail" loading="lazy" alt="${f.filename}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      ${f.is_video ? `<div class="video-badge">▶${f.duration ? ' ' + formatDuur(f.duration) : ''}</div>` : ''}
      <div class="info">
        <div class="name">${f.filename}</div>
        <div class="date">${formatDatum(f.photo_date)}${f.gps_city ? ' · ' + f.gps_city : ''}</div>
      </div>
    </div>
  `).join('');

  bindNegerenHoverPreview();

  const totaalPaginas = Math.ceil(data.total / 50);
  bouwPaginering(document.getElementById('negerenPaginering'), page, totaalPaginas, laadNegeren);
}

async function toggleNegeerItem(id, el) {
  const isNuGenegeerd = el.classList.contains('foto-ignored');
  const nieuwGenegeerd = !isNuGenegeerd;

  const r = await fetch(`/api/photos/${id}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ignored: nieuwGenegeerd })
  });

  if (!r.ok) return;

  if (nieuwGenegeerd) {
    // Genegeerd → laat de foto uit de review-lijst verdwijnen (staat nu bij Genegeerd)
    el.classList.add('verdwijnt');
    verlaagNegerenTeller();
    setTimeout(() => {
      el.remove();
      const grid = document.getElementById('negerenGrid');
      if (grid && grid.querySelectorAll('.ignore-item').length === 0) {
        grid.innerHTML = '<div class="leeg" style="grid-column:1/-1">' + window.i18n.t('geen_negeren') + '</div>';
      }
    }, 320);
  } else {
    // MEENEMEN → blijft staan, alleen de badge terugzetten
    el.classList.remove('foto-ignored');
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
    teller.textContent = `${(huidig - 1).toLocaleString()} photos`;
  }
}

// Bewaar toggleNegeer voor achterwaartse compatibiliteit (ignored-page)
async function toggleNegeer(id, knop) {
  const isNuGenegeerd = knop.classList.contains('hersteld');
  const r = await fetch(`/api/photos/${id}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ignored: !isNuGenegeerd })
  });
  if (r.ok) {
    const fotoItem = knop.closest('.foto-item');
    if (!isNuGenegeerd) {
      fotoItem.classList.add('foto-ignored');
      knop.classList.add('hersteld');
      knop.textContent = '↩ Herstellen';
    } else {
      fotoItem.classList.remove('foto-ignored');
      knop.classList.remove('hersteld');
      knop.textContent = '🚫 Negeren';
    }
  }
}

async function laadGenegeerd(page = 1) {
  const params = new URLSearchParams({ page, per_page: 50, without_thumbnail: 1, ignored: '1', without_copies: 1 });
  const data = await fetch('/api/photos?' + params).then(r => r.json());

  const grid = document.getElementById('genegeerGrid');
  const leeg = document.getElementById('genegeerLeeg');
  const verwijderKnop = document.getElementById('verwijderGenegeerdKnop');
  if (!grid) return;

  const pag = document.getElementById('genegeerPaginering');

  if (data.photos.length === 0) {
    // Lege page maar er zijn wél genegeerde foto's → ga een page terug.
    if (page > 1 && data.total > 0) return laadGenegeerd(page - 1);
    grid.innerHTML = '';
    if (pag) pag.innerHTML = '';
    if (leeg) leeg.style.display = 'block';
    if (verwijderKnop) verwijderKnop.style.display = 'none';
    return;
  }
  if (leeg) leeg.style.display = 'none';
  if (verwijderKnop) verwijderKnop.style.display = '';

  grid.innerHTML = data.photos.map(f => `
    <div class="foto-item ignore-item foto-ignored" data-foto="${f.id}">
      ${f.is_duplicate ? '<div class="status-badge badge-dup">DUP</div>' : ''}
      <div class="status-badge badge-negeren">NEGEREN</div>
      <div class="bron-badge">${f.source_icon || '💻'}</div>
      ${f.has_thumbnail
        ? `<img src="/api/photos/${f.id}/thumbnail" loading="lazy" alt="${f.filename}">`
        : `<div class="no-img">${f.is_video ? '🎬' : '🖼️'}</div>`}
      ${f.is_video ? `<div class="video-badge">▶${f.duration ? ' ' + formatDuur(f.duration) : ''}</div>` : ''}
      <div class="info">
        <div class="name">${f.filename}</div>
        <div class="date">${formatDatum(f.photo_date)}${f.gps_city ? ' · ' + f.gps_city : ''}</div>
      </div>
      <button class="ignore-knop hersteld"
        onclick="event.stopPropagation(); toggleNegeer(${f.id}, this); setTimeout(() => laadGenegeerd(${page}), 200)">
        ↩ Herstellen
      </button>
    </div>
  `).join('');

  bindNegerenHoverPreview();

  const totaalPaginas = Math.ceil(data.total / 50);
  bouwPaginering(document.getElementById('genegeerPaginering'), page, totaalPaginas, laadGenegeerd);
}

// Verwijder ALLE genegeerde foto's definitief (naar prullenbak + uit database)
async function verwijderAlleGenegeerd() {
  const teller = document.getElementById('genegeerGrid');
  const count = teller ? teller.querySelectorAll('.ignore-item').length : 0;

  const bevestig = confirm(
    "WARNING — this PERMANENTLY deletes the ignored photos:\n\n" +
    "• De bestanden gaan naar de prullenbak van je computer (herstelbaar)\n" +
    "• They are removed from the database so they will not be rescanned\n" +
    "• Alle duplicates in dezelfde group gaan mee\n\n" +
    "Are you sure?"
  );
  if (!bevestig) return;

  const knop = document.getElementById('verwijderGenegeerdKnop');
  if (knop) { knop.disabled = true; knop.textContent = '🗑️ Deleting...'; }

  try {
    const r = await fetch('/api/ignored/delete', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      alert('Delete failed: ' + (data.error || data.detail || 'unknown error'));
      return;
    }
    let message = `${data.deleted} photo(s) deleted.`;
    if (data.movedToTrash) message += `\n${data.movedToTrash} moved to the trash.`;
    if (data.missing) message += `\n${data.missing} file(s) no longer existed (only DB cleaned up).`;
    if (data.failed && data.failed.length) message += `\n${data.failed.length} file(s) could not be moved.`;
    alert(message);
  } catch (e) {
    alert('Delete failed: ' + e.message);
  } finally {
    if (knop) { knop.disabled = false; knop.textContent = '🗑️ Permanently delete all ignored'; }
    laadGenegeerd(1);
  }
}

// === HOVER PREVIEW ===

let negerenPreviewTimer = null;
let negerenMusX = 0, negerenMusY = 0;

function bindNegerenHoverPreview() {
  document.querySelectorAll('.ignore-item').forEach(el => {
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

  preview.innerHTML = `<img src="/api/photos/${fotoId}/thumbnail" alt="" style="width:100%;height:100%;object-fit:contain;">`;
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
