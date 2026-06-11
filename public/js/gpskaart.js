let gpsKaart = null;
let gpsMarker = null;
let gpsGekozen = null; // { lat, lon, stad, land, landCode, adres }
let gpsGeocodeBezig = false;
let zoekTimer = null;

function initGpsKaart(bestaandeLat, bestaandeLon) {
  document.getElementById('gpsZoekResultaten').classList.remove('open');
  document.getElementById('gpsZoekInput').value = '';
  document.getElementById('gpsGekozenInfo').textContent = '';
  document.getElementById('gpsOpslaanKnop').disabled = true;
  document.getElementById('gpsKaartStatus').textContent = 'Klik op de kaart om een locatie te kiezen';
  gpsGekozen = null;

  if (gpsKaart) {
    if (gpsMarker) { gpsKaart.removeLayer(gpsMarker); gpsMarker = null; }
    // Zoom naar bestaande locatie als die er is, anders world view
    if (bestaandeLat && bestaandeLon) {
      gpsKaart.setView([bestaandeLat, bestaandeLon], 13);
      gpsMarker = L.marker([bestaandeLat, bestaandeLon]).addTo(gpsKaart);
      document.getElementById('gpsKaartStatus').textContent = `📍 Huidige locatie: ${bestaandeLat.toFixed(4)}, ${bestaandeLon.toFixed(4)}`;
      document.getElementById('gpsOpslaanKnop').disabled = false;
      gpsGekozen = { lat: bestaandeLat, lon: bestaandeLon, stad: null, land: null, landCode: null, adres: null };
    } else {
      gpsKaart.setView([20, 10], 2);
    }
    return;
  }

  const startView = (bestaandeLat && bestaandeLon) ? [bestaandeLat, bestaandeLon] : [20, 10];
  const startZoom = (bestaandeLat && bestaandeLon) ? 13 : 2;
  gpsKaart = L.map('gpsKaart', { doubleClickZoom: false }).setView(startView, startZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(gpsKaart);

  gpsKaart.on('click', function(e) {
    plaatsMarkerEnGeocode(e.latlng.lat, e.latlng.lng);
  });

  if (bestaandeLat && bestaandeLon) {
    gpsMarker = L.marker([bestaandeLat, bestaandeLon]).addTo(gpsKaart);
    document.getElementById('gpsKaartStatus').textContent = `📍 Huidige locatie: ${bestaandeLat.toFixed(4)}, ${bestaandeLon.toFixed(4)}`;
    document.getElementById('gpsOpslaanKnop').disabled = false;
    gpsGekozen = { lat: bestaandeLat, lon: bestaandeLon, stad: null, land: null, landCode: null, adres: null };
  }
}

async function plaatsMarkerEnGeocode(lat, lon) {
  // Marker zetten
  if (gpsMarker) gpsKaart.removeLayer(gpsMarker);
  gpsMarker = L.marker([lat, lon]).addTo(gpsKaart);
  gpsGekozen = { lat, lon, stad: null, land: null, landCode: null, adres: null };

  // Knop uitschakelen tot geocoding klaar
  const knop = document.getElementById('gpsOpslaanKnop');
  knop.disabled = true;
  knop.textContent = '🌍 Adres ophalen...';
  document.getElementById('gpsKaartStatus').textContent = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — locatie ophalen...`;
  document.getElementById('gpsGekozenInfo').textContent = '';
  gpsGeocodeBezig = true;

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await r.json();
    const addr = data.address || {};
    const stad     = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
    const land     = addr.country || '';
    const landCode = (addr.country_code || '').toUpperCase();
    const adres    = data.display_name || '';

    gpsGekozen = { lat, lon, stad, land, landCode, adres };

    const vlag  = landVlag(landCode);
    const label = [stad, land].filter(Boolean).join(', ') || adres.slice(0, 60);
    document.getElementById('gpsGekozenInfo').textContent = label ? `${vlag} ${label}` : `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    document.getElementById('gpsKaartStatus').textContent = adres || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch (e) {
    document.getElementById('gpsKaartStatus').textContent = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    document.getElementById('gpsGekozenInfo').textContent = `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  gpsGeocodeBezig = false;
  knop.disabled = false;
  knop.textContent = '📍 GPS opslaan';
}

function zoekGpsLocatie() {
  clearTimeout(zoekTimer);
  const q = document.getElementById('gpsZoekInput').value.trim();
  const res = document.getElementById('gpsZoekResultaten');
  if (q.length < 3) { res.classList.remove('open'); res.innerHTML = ''; return; }

  zoekTimer = setTimeout(async () => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=en`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const items = await r.json();
      if (!items.length) { res.innerHTML = '<div class="gps-zoek-item">Geen resultaten</div>'; res.classList.add('open'); return; }
      res.innerHTML = items.map(item => `
        <div class="gps-zoek-item" onclick="kiesZoekResultaat(${item.lat}, ${item.lon}, '${encodeURIComponent(item.display_name)}')">
          ${item.display_name}
        </div>
      `).join('');
      res.classList.add('open');
    } catch (e) {
      res.innerHTML = '<div class="gps-zoek-item">Fout bij zoeken</div>';
      res.classList.add('open');
    }
  }, 400);
}

function kiesZoekResultaat(lat, lon, displayNameEncoded) {
  gpsKaart.setView([parseFloat(lat), parseFloat(lon)], 13);
  plaatsMarkerEnGeocode(parseFloat(lat), parseFloat(lon));
  document.getElementById('gpsZoekResultaten').classList.remove('open');
  document.getElementById('gpsZoekInput').value = '';
}

async function slaGpsOp() {
  if (!gpsGekozen || !huidigeFotoId) return;

  const knop = document.getElementById('gpsOpslaanKnop');
  knop.disabled = true;
  knop.textContent = '⏳ Opslaan...';

  const r = await fetch(`/api/fotos/${huidigeFotoId}/gps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gps_lat:      gpsGekozen.lat,
      gps_lon:      gpsGekozen.lon,
      gps_stad:     gpsGekozen.stad     || null,
      gps_land:     gpsGekozen.land     || null,
      gps_land_code: gpsGekozen.landCode || null,
      gps_adres:    gpsGekozen.adres    || null
    })
  });

  if (r.ok) {
    const data = await r.json();
    const msg = data.bijgewerkt > 1
      ? `✅ GPS opgeslagen voor ${data.bijgewerkt} foto's (incl. duplicaten)`
      : '✅ GPS opgeslagen';
    document.getElementById('gpsKaartStatus').textContent = msg;
    knop.textContent = '✅ Opgeslagen';

    const bijgewerkt = await fetch('/api/fotos/' + huidigeFotoId).then(r => r.json());
    if (typeof huidigeItemIsVideo !== 'undefined' && huidigeItemIsVideo) {
      renderVideoModal(bijgewerkt);
    } else {
      renderModal(bijgewerkt);
    }

    setTimeout(() => sluitGpsKaart(), 1500);
  } else {
    document.getElementById('gpsKaartStatus').textContent = '❌ Fout bij opslaan';
    knop.disabled = false;
    knop.textContent = '📍 GPS opslaan';
  }
}

function sluitGpsKaart() {
  document.getElementById('gpsKaartOverlay').classList.remove('open');
  document.getElementById('gpsZoekResultaten').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gpsKaartOverlay').addEventListener('click', function(e) {
    if (e.target === this) sluitGpsKaart();
  });
});
