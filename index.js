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
  const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const msg = JSON.stringify({ type: 'log', level, text: text, ts: new Date().toISOString() });
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

console.log   = (...a) => { origLog(...a);   broadcast('info',  a); };
console.error = (...a) => { origError(...a); broadcast('error', a); };
console.warn  = (...a) => { origWarn(...a);  broadcast('warn',  a); };

// === WEBSOCKET — folder picker via zenity ===
wss.on('connection', (ws) => {
  // Send welcome message
  ws.send(JSON.stringify({ type: 'log', level: 'info', text: '🔌 Connected to FotoApp server', ts: new Date().toISOString() }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'choose_folder') {
      const startPath = msg.startPath || process.env.HOME || process.env.USERPROFILE || '/home';

      if (global.electronPickFolder) {
        // Electron: use the native dialog (works on Windows, Mac AND Linux)
        global.electronPickFolder(startPath).then(folderPath => {
          if (!folderPath) {
            ws.send(JSON.stringify({ type: 'folder_error', error: 'No folder selected' }));
          } else {
            ws.send(JSON.stringify({ type: 'folder_chosen', path: folderPath }));
          }
        });
      } else {
        // Standalone on Linux: use zenity
        execFile('zenity', [
          '--file-selection',
          '--directory',
          '--title=Choose a folder to scan',
          `--filename=${startPath}/`
        ], (err, stdout) => {
          if (err || !stdout.trim()) {
            ws.send(JSON.stringify({ type: 'folder_error', error: 'No folder selected' }));
          } else {
            ws.send(JSON.stringify({ type: 'folder_chosen', path: stdout.trim() }));
          }
        });
      }
    }
  });
});

// Start
initDb();
server.listen(PORT, () => {
  console.log(`\n🖼️  FotoApp running at http://localhost:${PORT}\n`);
});
