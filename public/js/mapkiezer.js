let mapWs = null;
let mapDoelInput = 'bronPad'; // welk inputveld wordt gevuld

function verbindMapWs() {
  mapWs = new WebSocket(`ws://${location.host}`);

  mapWs.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);

    if (msg.type === 'log') {
      voegLogToe(msg.level, msg.tekst, msg.ts);
      return;
    }
    if (msg.type === 'map_gekozen' && msg.pad) {
      const el = document.getElementById(mapDoelInput);
      if (el) el.value = msg.pad;
    }
  };

  mapWs.onclose = () => {
    voegLogToe('warn', '⚠️ Verbinding verbroken — herverbinden...', new Date().toISOString());
    setTimeout(verbindMapWs, 3000);
  };
  mapWs.onerror = () => mapWs.close();
}

// doelId = id van het input-veld dat gevuld moet worden
function openMapKiezer(doelId) {
  mapDoelInput = doelId || 'bronPad';

  if (!mapWs || mapWs.readyState !== WebSocket.OPEN) {
    alert('WebSocket niet verbonden. Herstart de app.');
    return;
  }

  const huidigPad = document.getElementById(mapDoelInput)?.value || '/home/one';
  mapWs.send(JSON.stringify({ type: 'kies_map', startPad: huidigPad }));
}

verbindMapWs();

// === LOG PANELEN ===
const logState = {
  client: { open: true, ongelezen: 0 },
  server: { open: true, ongelezen: 0 }
};

// Client-side log (cyaan) — acties vanuit de browser
function logClient(tekst) {
  _voegLogToe('client', 'client', tekst, new Date().toISOString());
}

// Server log — via WebSocket
function voegLogToe(level, tekst, ts) {
  _voegLogToe('server', level, tekst, ts);
}

function _voegLogToe(paneel, level, tekst, ts) {
  const bodyId = paneel === 'client' ? 'logBodyClient' : 'logBodyServer';
  const body = document.getElementById(bodyId);
  if (!body) return;

  const tijd = ts ? new Date(ts).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const regel = document.createElement('div');
  regel.className = `log-regel ${level}`;
  regel.innerHTML = `<span class="log-tijd">${tijd}</span>${escapeHtml(tekst)}`;
  body.appendChild(regel);

  while (body.children.length > 500) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;

  const state = logState[paneel];
  if (!state.open) {
    state.ongelezen++;
    const badge = document.getElementById('logBadge' + (paneel === 'client' ? 'Client' : 'Server'));
    if (badge) { badge.textContent = state.ongelezen; badge.style.display = 'inline'; }
  }
}

function toggleLog(paneel) {
  const state = logState[paneel];
  state.open = !state.open;
  const suffix = paneel === 'client' ? 'Client' : 'Server';
  document.getElementById('logPaneel' + suffix).classList.toggle('open', state.open);
  document.getElementById('logToggleIcon' + suffix).textContent = state.open ? '▼' : '▲';
  if (state.open) {
    state.ongelezen = 0;
    document.getElementById('logBadge' + suffix).style.display = 'none';
    document.getElementById('logBody' + suffix).scrollTop = document.getElementById('logBody' + suffix).scrollHeight;
  }
}

function wisLog(paneel) {
  const suffix = paneel === 'client' ? 'Client' : 'Server';
  document.getElementById('logBody' + suffix).innerHTML = '';
  logState[paneel].ongelezen = 0;
  document.getElementById('logBadge' + suffix).style.display = 'none';
}

function escapeHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
