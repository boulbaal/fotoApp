const express = require('express');
const path    = require('path');
const http    = require('http');
const { WebSocketServer } = require('ws');
const { execFile } = require('child_process');
const { initDb } = require('./src/database');
const api = require('./src/api');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', api);

// === CONSOLE → WebSocket broadcast ===
const origLog   = console.log.bind(console);
const origError = console.error.bind(console);
const origWarn  = console.warn.bind(console);

function broadcast(level, args) {
  const tekst = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const msg = JSON.stringify({ type: 'log', level, tekst, ts: new Date().toISOString() });
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

console.log   = (...a) => { origLog(...a);   broadcast('info',  a); };
console.error = (...a) => { origError(...a); broadcast('error', a); };
console.warn  = (...a) => { origWarn(...a);  broadcast('warn',  a); };

// === WEBSOCKET — map picker via zenity ===
wss.on('connection', (ws) => {
  // Stuur welkomstbericht
  ws.send(JSON.stringify({ type: 'log', level: 'info', tekst: '🔌 Verbonden met FotoApp server', ts: new Date().toISOString() }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'kies_map') {
      const startPad = msg.startPad || process.env.HOME || process.env.USERPROFILE || '/home';

      if (global.electronPickFolder) {
        // Electron: gebruik native dialog (werkt op Windows, Mac én Linux)
        global.electronPickFolder(startPad).then(pad => {
          if (!pad) {
            ws.send(JSON.stringify({ type: 'map_fout', fout: 'Geen map gekozen' }));
          } else {
            ws.send(JSON.stringify({ type: 'map_gekozen', pad }));
          }
        });
      } else {
        // Standalone op Linux: gebruik zenity
        execFile('zenity', [
          '--file-selection',
          '--directory',
          '--title=Kies een map om te scannen',
          `--filename=${startPad}/`
        ], (err, stdout) => {
          if (err || !stdout.trim()) {
            ws.send(JSON.stringify({ type: 'map_fout', fout: 'Geen map gekozen' }));
          } else {
            ws.send(JSON.stringify({ type: 'map_gekozen', pad: stdout.trim() }));
          }
        });
      }
    }
  });
});

// Start
initDb();
server.listen(PORT, () => {
  console.log(`\n🖼️  FotoApp draait op http://localhost:${PORT}\n`);
});
