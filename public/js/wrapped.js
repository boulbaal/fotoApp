// wrapped.js — "Jouw foto-leven": deelbaar samenvattingsscherm
// Haalt /api/wrapped op, toont een mooie kaart en exporteert die als PNG.

let wrappedData = null;

const WRAPPED_MAANDEN = ['', 'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function wrappedGetal(n) {
  return (n || 0).toLocaleString('nl-NL');
}

function wrappedVlag(land) {
  if (!land) return '';
  if (land.gps_land_code && typeof landVlag === 'function') return landVlag(land.gps_land_code);
  if (typeof landVlagVanNaam === 'function') return landVlagVanNaam(land.gps_land) || '';
  return '';
}

async function laadWrapped() {
  const kaart = document.getElementById('wrappedKaart');
  if (!kaart) return;
  kaart.innerHTML = '<div class="wrapped-laden" id="wrappedLaden">Bezig met samenstellen…</div>';

  try {
    const res = await fetch('/api/wrapped');
    wrappedData = await res.json();
  } catch (e) {
    kaart.innerHTML = '<div class="wrapped-laden">Kon de gegevens niet laden.</div>';
    return;
  }

  const d = wrappedData;
  const totaal = (d.totaalFotos || 0) + (d.totaalVideos || 0);
  const reeks = (d.reeks && d.reeks.van)
    ? (d.reeks.van === d.reeks.tot ? `${d.reeks.van}` : `${d.reeks.van} – ${d.reeks.tot}`)
    : '—';
  const drukste = d.druksteMaand
    ? `${WRAPPED_MAANDEN[d.druksteMaand.maand] || ''} ${d.druksteMaand.jaar}`.trim()
    : '—';

  const landenRijen = (d.topLanden || []).map(l =>
    `<li><span class="wl-vlag">${wrappedVlag(l)}</span> <span class="wl-naam">${l.gps_land}</span> <span class="wl-aantal">${wrappedGetal(l.aantal)}</span></li>`
  ).join('') || '<li class="wl-leeg">Nog geen locaties bekend</li>';

  kaart.innerHTML = `
    <div class="wrapped-card-inner">
      <div class="wc-kop">📸 Mijn foto-leven</div>

      <div class="wc-hero">
        <div class="wc-hero-getal">${wrappedGetal(totaal)}</div>
        <div class="wc-hero-label">foto's &amp; video's</div>
      </div>

      <div class="wc-grid">
        <div class="wc-cel"><div class="wc-getal">${wrappedGetal(d.aantalLanden)}</div><div class="wc-lbl">landen</div></div>
        <div class="wc-cel"><div class="wc-getal">${wrappedGetal(d.aantalSteden)}</div><div class="wc-lbl">steden</div></div>
        <div class="wc-cel"><div class="wc-getal">${reeks}</div><div class="wc-lbl">tijdspanne</div></div>
        <div class="wc-cel"><div class="wc-getal">${formatGrootte(d.totalGrootte)}</div><div class="wc-lbl">totaal</div></div>
      </div>

      <div class="wc-regel"><span>🏆 Drukste maand</span><strong>${drukste}</strong></div>
      <div class="wc-regel"><span>📅 Topjaar</span><strong>${d.topJaar ? d.topJaar.jaar + ' (' + wrappedGetal(d.topJaar.aantal) + ')' : '—'}</strong></div>

      <div class="wc-landen">
        <div class="wc-landen-kop">🌍 Meeste foto's per land</div>
        <ul>${landenRijen}</ul>
      </div>

      <div class="wc-voet">Gemaakt met <strong>FotoApp</strong> · github.com/boulbaal/fotoApp</div>
    </div>`;
}

// Tekent dezelfde kaart op een canvas (story-formaat) en downloadt als PNG.
function downloadWrapped() {
  if (!wrappedData) { alert('Even wachten — de gegevens worden nog geladen.'); return; }
  const d = wrappedData;
  const totaal = (d.totaalFotos || 0) + (d.totaalVideos || 0);

  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Achtergrond — verloop
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#5b2a86');
  g.addColorStop(0.55, '#3b2f8f');
  g.addColorStop(1, '#1f2a63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 44px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('📸 Mijn foto-leven', cx, 130);

  // Hero
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 200px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText(wrappedGetal(totaal), cx, 360);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '400 40px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText("foto's & video's", cx, 415);

  // 4 cellen
  const reeks = (d.reeks && d.reeks.van)
    ? (d.reeks.van === d.reeks.tot ? `${d.reeks.van}` : `${d.reeks.van}–${d.reeks.tot}`)
    : '—';
  const cellen = [
    [wrappedGetal(d.aantalLanden), 'landen'],
    [wrappedGetal(d.aantalSteden), 'steden'],
    [reeks, 'tijdspanne'],
    [formatGrootte(d.totalGrootte), 'totaal'],
  ];
  const colX = [W * 0.27, W * 0.73];
  const rowY = [560, 700];
  cellen.forEach((cel, i) => {
    const x = colX[i % 2], y = rowY[Math.floor(i / 2)];
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 64px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText(cel[0], x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '400 32px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText(cel[1], x, y + 40);
  });

  // Top landen
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 40px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('🌍 Meeste foto\'s per land', W * 0.14, 850);

  const landen = (d.topLanden || []).slice(0, 5);
  let ly = 920;
  if (landen.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 36px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText('Nog geen locaties bekend', W * 0.14, ly);
  } else {
    landen.forEach(l => {
      ctx.fillStyle = '#ffffff';
      ctx.font = '400 40px system-ui, "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${wrappedVlag(l)}  ${l.gps_land}`, W * 0.14, ly);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(wrappedGetal(l.aantal), W * 0.86, ly);
      ly += 68;
    });
  }

  // Voettekst / watermerk
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 30px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('Gemaakt met FotoApp · github.com/boulbaal/fotoApp', cx, H - 60);

  // Download
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mijn-foto-leven.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
