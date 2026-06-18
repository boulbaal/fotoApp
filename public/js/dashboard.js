async function laadStats() {
  const data = await fetch('/api/stats').then(r => r.json());

  // Foto stats
  document.getElementById('statTotaal').textContent        = (data.totaalFotos  ?? data.totaal).toLocaleString();
  document.getElementById('statFotosUniek').textContent    = (data.fotosUniek    || 0).toLocaleString();
  document.getElementById('statFotosDubbel').textContent   = (data.fotosDubbel   || 0).toLocaleString();
  document.getElementById('statFotosMetGps').textContent   = (data.fotosMetGps   || 0).toLocaleString();
  document.getElementById('statFotosZonderGps').textContent= (data.fotosZonderGps|| 0).toLocaleString();

  // Video stats
  document.getElementById('statVideos').textContent        = (data.totaalVideos  || 0).toLocaleString();
  document.getElementById('statVideosUniek').textContent   = (data.videosUniek   || 0).toLocaleString();
  document.getElementById('statVideosDubbel').textContent  = (data.videosDubbel  || 0).toLocaleString();
  document.getElementById('statVideosMetGps').textContent  = (data.videosMetGps  || 0).toLocaleString();
  document.getElementById('statVideosZonderGps').textContent=(data.videosZonderGps||0).toLocaleString();

  document.getElementById('statGrootte').textContent = formatGrootte(data.totalGrootte);

  tekenBalk('grafiekJaar', data.perJaar, 'jaar', 'aantal', (rij) => {
    toonPagina('fotos', { jaar: rij.jaar });
  }, null, null);

  tekenBalk('grafiekJaarVideo', data.perJaarVideo || [], 'jaar', 'aantal', (rij) => {
    toonPagina('videos', { jaar: rij.jaar });
  }, null, null);

  tekenBalk('grafiekCamera', (data.perCamera || []).map(c => ({
    label: [c.camera_merk, c.camera_model].filter(Boolean).join(' ') || '?',
    aantal: c.aantal,
    camera_merk: c.camera_merk,
    camera_model: c.camera_model
  })), 'label', 'aantal', (rij) => {
    toonPagina('fotos', {
      camera_merk: rij.camera_merk,
      camera_model: rij.camera_model,
      _label: '📷 ' + rij.label
    });
  }, null, 10);

  tekenBalk('grafiekCameraVideo', (data.perCameraVideo || []).map(c => ({
    label: [c.camera_merk, c.camera_model].filter(Boolean).join(' ') || '?',
    aantal: c.aantal,
    camera_merk: c.camera_merk,
    camera_model: c.camera_model
  })), 'label', 'aantal', null, null, 10);

  const landenMetVlag = (data.perLand || []).map(r => {
    const vlag = r.gps_land_code ? landVlag(r.gps_land_code) : landVlagVanNaam(r.gps_land);
    return { ...r, label: (vlag ? vlag + ' ' : '') + r.gps_land };
  });
  tekenBalk('grafiekLand', landenMetVlag, 'label', 'aantal', (rij) => {
    toonPagina('kaart', { land: rij.gps_land, is_video: '0' });
  }, null, 10);

  const landenVideoMetVlag = (data.perLandVideo || []).map(r => {
    const vlag = r.gps_land_code ? landVlag(r.gps_land_code) : landVlagVanNaam(r.gps_land);
    return { ...r, label: (vlag ? vlag + ' ' : '') + r.gps_land };
  });
  tekenBalk('grafiekLandVideo', landenVideoMetVlag, 'label', 'aantal', (rij) => {
    // Gecombineerde kaart: type 'Alles' op dat land, met video-locaties uitgelicht
    toonPagina('kaart', { land: rij.gps_land, video_nadruk: true });
  }, null, 10);

  tekenBalk('grafiekBron', data.perBron.map(b => ({
    label: b.icoon + ' ' + b.naam,
    aantal: b.aantal || 0,
    grootte: b.grootte,
    bron_id: b.bron_id
  })), 'label', 'aantal', (rij) => {
    toonPagina('fotos', { bron_id: rij.bron_id, _label: rij.label });
  }, (rij) => rij.grootte ? ` · ${formatGrootte(rij.grootte)}` : '', 10);

  laadOpschoonOverzicht();
}

// Opschoon-dashboard: toon hoeveel ruimte vrijgemaakt kan worden.
async function laadOpschoonOverzicht() {
  const kaart = document.getElementById('opschoonKaart');
  if (!kaart) return;
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  try {
    const d = await fetch('/api/opschoon/overzicht').then(r => r.json());
    const dupBestanden = d.duplicaten?.bestanden || 0;
    const genBestanden = d.genegeerd?.bestanden || 0;

    // Niets op te schonen → kaart verborgen houden
    if (dupBestanden === 0 && genBestanden === 0 && (d.duplicaten?.keuzeNodig || 0) === 0) {
      kaart.style.display = 'none';
      return;
    }
    kaart.style.display = '';

    document.getElementById('opschoonTotaal').textContent =
      formatGrootte(d.totaalVrijTeMaken || 0) + ' ' + t('opschoon_vrij', 'vrij te maken');

    document.getElementById('opschoonDup').textContent = dupBestanden > 0
      ? `${dupBestanden.toLocaleString()} · ${formatGrootte(d.duplicaten.bytes || 0)}`
      : t('opschoon_niets', 'niets');
    document.getElementById('opschoonGen').textContent = genBestanden > 0
      ? `${genBestanden.toLocaleString()} · ${formatGrootte(d.genegeerd.bytes || 0)}`
      : t('opschoon_niets', 'niets');

    const keuze = document.getElementById('opschoonKeuze');
    const keuzeNodig = d.duplicaten?.keuzeNodig || 0;
    if (keuzeNodig > 0) {
      keuze.style.display = '';
      keuze.textContent = `⚠️ ${keuzeNodig} ${t('opschoon_keuze_nodig', 'duplicaatgroep(en) wachten nog op een keuze')}`;
    } else {
      keuze.style.display = 'none';
    }
  } catch (_) {
    kaart.style.display = 'none';
  }
}

function tekenBalk(containerId, data, labelVeld, aantalVeld, onClick, extraInfo, maxItems) {
  const el = document.getElementById(containerId);
  if (!data || data.length === 0) { el.innerHTML = '<div class="leeg">Nog geen data</div>'; return; }
  const max = Math.max(...data.map(d => d[aantalVeld] || 0));
  const rijen = maxItems != null ? data.slice(0, maxItems) : data;

  el.innerHTML = rijen.map(rij => {
    const extra = extraInfo ? extraInfo(rij) : '';
    return `
    <div class="bar-rij ${onClick ? 'klikbaar' : ''}" title="${onClick ? 'Klik om foto\'s te zien' : ''}">
      <div class="bar-label">${rij[labelVeld] || '?'}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${max > 0 ? (rij[aantalVeld]/max*100) : 0}%">
          <span>${(rij[aantalVeld] || 0).toLocaleString()}${extra}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  if (onClick) {
    el.querySelectorAll('.bar-rij').forEach((el, i) => {
      el.addEventListener('click', () => onClick(rijen[i]));
    });
  }
}
