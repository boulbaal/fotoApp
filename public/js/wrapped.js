// wrapped.js — "My photo life": shareable summary screen
// Fetches /api/wrapped, renders a nice card and exports it as PNG.

let wrappedData = null;

const WRAPPED_MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function wrappedGetal(n) {
  return (n || 0).toLocaleString('en-US');
}

function wrappedVlag(country) {
  if (!country) return '';
  if (country.gps_country_code && typeof landVlag === 'function') return landVlag(country.gps_country_code);
  if (typeof landVlagVanNaam === 'function') return landVlagVanNaam(country.gps_country) || '';
  return '';
}

async function laadWrapped() {
  const kaart = document.getElementById('wrappedKaart');
  if (!kaart) return;
  kaart.innerHTML = '<div class="wrapped-laden" id="wrappedLaden">Assembling…</div>';

  try {
    const res = await fetch('/api/wrapped');
    wrappedData = await res.json();
  } catch (e) {
    kaart.innerHTML = '<div class="wrapped-laden">Could not load the data.</div>';
    return;
  }

  const d = wrappedData;
  const total = (d.totalPhotos || 0) + (d.totalVideos || 0);
  const yearRange = (d.yearRange && d.yearRange.from_year)
    ? (d.yearRange.from_year === d.yearRange.to_year ? `${d.yearRange.from_year}` : `${d.yearRange.from_year} – ${d.yearRange.to_year}`)
    : '—';
  const drukste = d.busiestMonth
    ? `${WRAPPED_MONTHS[d.busiestMonth.month] || ''} ${d.busiestMonth.year}`.trim()
    : '—';

  const landenRijen = (d.topCountries || []).map(l =>
    `<li><span class="wl-vlag">${wrappedVlag(l)}</span> <span class="wl-name">${l.gps_country}</span> <span class="wl-count">${wrappedGetal(l.count)}</span></li>`
  ).join('') || '<li class="wl-leeg">No locations known yet</li>';

  kaart.innerHTML = `
    <div class="wrapped-card-inner">
      <div class="wc-kop">📸 My photo life</div>

      <div class="wc-hero">
        <div class="wc-hero-getal">${wrappedGetal(total)}</div>
        <div class="wc-hero-label">photos &amp; videos</div>
      </div>

      <div class="wc-grid">
        <div class="wc-cel"><div class="wc-getal">${wrappedGetal(d.countryCount)}</div><div class="wc-lbl">countries</div></div>
        <div class="wc-cel"><div class="wc-getal">${wrappedGetal(d.cityCount)}</div><div class="wc-lbl">cities</div></div>
        <div class="wc-cel"><div class="wc-getal">${yearRange}</div><div class="wc-lbl">time span</div></div>
        <div class="wc-cel"><div class="wc-getal">${formatGrootte(d.totalSize)}</div><div class="wc-lbl">total</div></div>
      </div>

      <div class="wc-regel"><span>🏆 Busiest month</span><strong>${drukste}</strong></div>
      <div class="wc-regel"><span>📅 Top year</span><strong>${d.topYear ? d.topYear.year + ' (' + wrappedGetal(d.topYear.count) + ')' : '—'}</strong></div>

      <div class="wc-landen">
        <div class="wc-landen-kop">🌍 Most photos per country</div>
        <ul>${landenRijen}</ul>
      </div>

      <div class="wc-voet">Made with <strong>FotoApp</strong> · github.com/boulbaal/fotoApp</div>
    </div>`;
}

// Draws the same card on a canvas (story format) and downloads it as PNG.
function downloadWrapped() {
  if (!wrappedData) { alert('One moment — the data is still loading.'); return; }
  const d = wrappedData;
  const total = (d.totalPhotos || 0) + (d.totalVideos || 0);

  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Background — gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#5b2a86');
  g.addColorStop(0.55, '#3b2f8f');
  g.addColorStop(1, '#1f2a63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 44px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('📸 My photo life', cx, 130);

  // Hero
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 200px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText(wrappedGetal(total), cx, 360);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '400 40px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText("photos & videos", cx, 415);

  // 4 cells
  const yearRange = (d.yearRange && d.yearRange.from_year)
    ? (d.yearRange.from_year === d.yearRange.to_year ? `${d.yearRange.from_year}` : `${d.yearRange.from_year}–${d.yearRange.to_year}`)
    : '—';
  const cellen = [
    [wrappedGetal(d.countryCount), 'countries'],
    [wrappedGetal(d.cityCount), 'cities'],
    [yearRange, 'time span'],
    [formatGrootte(d.totalSize), 'total'],
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

  // Top countries
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 40px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('🌍 Most photos per country', W * 0.14, 850);

  const landen = (d.topCountries || []).slice(0, 5);
  let ly = 920;
  if (landen.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 36px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText('No locations known yet', W * 0.14, ly);
  } else {
    landen.forEach(l => {
      ctx.fillStyle = '#ffffff';
      ctx.font = '400 40px system-ui, "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${wrappedVlag(l)}  ${l.gps_country}`, W * 0.14, ly);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(wrappedGetal(l.count), W * 0.86, ly);
      ly += 68;
    });
  }

  // Footer / watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 30px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('Made with FotoApp · github.com/boulbaal/fotoApp', cx, H - 60);

  // Download
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-photo-life.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
