async function laadStats() {
  const data = await fetch('/api/stats').then(r => r.json());

  // Foto stats
  document.getElementById('statTotaal').textContent        = (data.totalPhotos  ?? data.total).toLocaleString();
  document.getElementById('statFotosUniek').textContent    = (data.photosUnique    || 0).toLocaleString();
  document.getElementById('statFotosDubbel').textContent   = (data.photosDuplicate   || 0).toLocaleString();
  document.getElementById('statFotosMetGps').textContent   = (data.photosWithGps   || 0).toLocaleString();
  document.getElementById('statFotosZonderGps').textContent= (data.photosWithoutGps|| 0).toLocaleString();

  // Video stats
  document.getElementById('statVideos').textContent        = (data.totalVideos  || 0).toLocaleString();
  document.getElementById('statVideosUniek').textContent   = (data.videosUnique   || 0).toLocaleString();
  document.getElementById('statVideosDubbel').textContent  = (data.videosDuplicate  || 0).toLocaleString();
  document.getElementById('statVideosMetGps').textContent  = (data.videosWithGps  || 0).toLocaleString();
  document.getElementById('statVideosZonderGps').textContent=(data.videosWithoutGps||0).toLocaleString();

  document.getElementById('statGrootte').textContent = formatGrootte(data.totalSize);

  tekenBalk('grafiekJaar', data.perYear, 'year', 'count', (rij) => {
    toonPagina('photos', { year: rij.year });
  }, null, null);

  tekenBalk('grafiekJaarVideo', data.perYearVideo || [], 'year', 'count', (rij) => {
    toonPagina('videos', { year: rij.year });
  }, null, null);

  tekenBalk('grafiekCamera', (data.perCamera || []).map(c => ({
    label: [c.camera_make, c.camera_model].filter(Boolean).join(' ') || '?',
    count: c.count,
    camera_make: c.camera_make,
    camera_model: c.camera_model
  })), 'label', 'count', (rij) => {
    toonPagina('photos', {
      camera_make: rij.camera_make,
      camera_model: rij.camera_model,
      _label: '📷 ' + rij.label
    });
  }, null, 10);

  tekenBalk('grafiekCameraVideo', (data.perCameraVideo || []).map(c => ({
    label: [c.camera_make, c.camera_model].filter(Boolean).join(' ') || '?',
    count: c.count,
    camera_make: c.camera_make,
    camera_model: c.camera_model
  })), 'label', 'count', null, null, 10);

  const landenMetVlag = (data.perCountry || []).map(r => {
    const vlag = r.gps_country_code ? landVlag(r.gps_country_code) : landVlagVanNaam(r.gps_country);
    return { ...r, label: (vlag ? vlag + ' ' : '') + r.gps_country };
  });
  tekenBalk('grafiekLand', landenMetVlag, 'label', 'count', (rij) => {
    toonPagina('kaart', { country: rij.gps_country, is_video: '0' });
  }, null, 10);

  const landenVideoMetVlag = (data.perCountryVideo || []).map(r => {
    const vlag = r.gps_country_code ? landVlag(r.gps_country_code) : landVlagVanNaam(r.gps_country);
    return { ...r, label: (vlag ? vlag + ' ' : '') + r.gps_country };
  });
  tekenBalk('grafiekLandVideo', landenVideoMetVlag, 'label', 'count', (rij) => {
    // Gecombineerde kaart: type 'Alles' op dat country, met video-locations uitgelicht
    toonPagina('kaart', { country: rij.gps_country, video_nadruk: true });
  }, null, 10);

  tekenBalk('grafiekBron', data.perSource.map(b => ({
    label: b.icon + ' ' + b.name,
    count: b.count || 0,
    size: b.size,
    source_id: b.source_id
  })), 'label', 'count', (rij) => {
    toonPagina('photos', { source_id: rij.source_id, _label: rij.label });
  }, (rij) => rij.size ? ` · ${formatGrootte(rij.size)}` : '', 10);

  laadOpschoonOverzicht();
}

// Opschoon-dashboard: toon hoeveel ruimte vrijgemaakt kan worden.
async function laadOpschoonOverzicht() {
  const kaart = document.getElementById('opschoonKaart');
  if (!kaart) return;
  const t = (k, f) => (window.i18n ? window.i18n.t(k, f) : f);
  try {
    const d = await fetch('/api/cleanup/overview').then(r => r.json());
    const dupBestanden = d.duplicates?.bestanden || 0;
    const genBestanden = d.ignored?.bestanden || 0;

    // Niets op te schonen → kaart hidden houden
    if (dupBestanden === 0 && genBestanden === 0 && (d.duplicates?.choiceNeeded || 0) === 0) {
      kaart.style.display = 'none';
      return;
    }
    kaart.style.display = '';

    document.getElementById('opschoonTotaal').textContent =
      formatGrootte(d.totaalVrijTeMaken || 0) + ' ' + t('opschoon_vrij', 'to free up');

    document.getElementById('opschoonDup').textContent = dupBestanden > 0
      ? `${dupBestanden.toLocaleString()} · ${formatGrootte(d.duplicates.bytes || 0)}`
      : t('opschoon_niets', 'niets');
    document.getElementById('opschoonGen').textContent = genBestanden > 0
      ? `${genBestanden.toLocaleString()} · ${formatGrootte(d.ignored.bytes || 0)}`
      : t('opschoon_niets', 'niets');

    const keuze = document.getElementById('opschoonKeuze');
    const choiceNeeded = d.duplicates?.choiceNeeded || 0;
    if (choiceNeeded > 0) {
      keuze.style.display = '';
      keuze.textContent = `⚠️ ${choiceNeeded} ${t('opschoon_keuze_nodig', 'duplicate group(s) still need a choice')}`;
    } else {
      keuze.style.display = 'none';
    }
  } catch (_) {
    kaart.style.display = 'none';
  }
}

function tekenBalk(containerId, data, labelVeld, aantalVeld, onClick, extraInfo, maxItems) {
  const el = document.getElementById(containerId);
  if (!data || data.length === 0) { el.innerHTML = '<div class="leeg">No data yet</div>'; return; }
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
