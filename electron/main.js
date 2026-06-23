'use strict';

const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Geheugenplafond ─────────────────────────────────────────────────────────
// De scan draait in dit (main) proces. Begrens de V8-heap zodat een zware scan
// nooit zoveel geheugen pakt dat Ubuntu een OOM-kill doet op andere apps.
// (De native sharp/libvips-piek wordt apart beperkt via sharp.cache/concurrency
// in src/scanner.js — dit plafond dekt de JS-kant af.)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1024');

// ── Data-map instellen vóór de server laadt ─────────────────────────────────
// In de gepackagede app is de installatiemap read-only; gebruik userData.
const dataDir = path.join(app.getPath('userData'), 'fotoapp-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

process.env.DB_PATH       = path.join(dataDir, 'fotos.db');
process.env.FOTOAPP_DATA  = dataDir;        // scanner gebruikt dit voor temp-bestanden
process.env.ELECTRON_RUN  = '1';             // vlag voor index.js

// ── Server starten ──────────────────────────────────────────────────────────
let serverReady = false;
let serverPort  = 3000;
let serverError = null;   // bewaart de oorzaak als de server niet startte

function startServer() {
  try {
    require('../index.js');
    serverReady = true;
  } catch (e) {
    serverError = e;
    console.error('Server kon niet starten:', e);
    logFout(e);
  }
}

// Vang ook asynchrone fouten op (bv. native module die later faalt)
process.on('uncaughtException',  (e) => { if (!serverReady) { serverError = serverError || e; logFout(e); } });
process.on('unhandledRejection', (e) => { if (!serverReady) { serverError = serverError || e; logFout(e); } });

// ── Fout-diagnose: vertaal technische fouten naar begrijpelijke uitleg ───────
function diagnoseFout(err) {
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err || '');

  // 1) Native module gebouwd voor verkeerde Node/Electron-versie
  if (/NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|did not self-register|compiled against a different/i.test(msg)) {
    return {
      titel: 'De database-module moet opnieuw gebouwd worden',
      uitleg: 'De native database-module (better-sqlite3) is gebouwd voor een andere Node-versie dan Electron gebruikt. Dit gebeurt na een Node-update of een verse "npm install". Hierdoor kon de interne server niet starten — het ligt NIET aan poort 3000.',
      oplossingen: [
        { tekst: 'Bouw de native modules voor Electron (meestal genoeg):', cmd: 'npm run rebuild' },
        { tekst: 'Werkt dat niet? Verwijder, herinstalleer en bouw opnieuw:', cmd: 'rm -rf node_modules && npm install && npm run rebuild' },
        { tekst: 'Start daarna de desktop-app opnieuw:', cmd: 'sh start-electron.sh' },
      ],
      details: msg,
    };
  }

  // 2) Poort al in gebruik
  if (/EADDRINUSE/i.test(msg)) {
    return {
      titel: 'Poort 3000 is al in gebruik',
      uitleg: 'Een ander programma (of een vorige FotoApp die nog draait) gebruikt poort 3000, dus de server kon niet starten.',
      oplossingen: [
        { tekst: 'Stop een eventuele vorige instantie:', cmd: 'sh stop-electron.sh' },
        { tekst: 'Kijk welk proces de poort gebruikt:', cmd: 'lsof -i tcp:3000' },
        { tekst: 'Start daarna opnieuw:', cmd: 'sh start-electron.sh' },
      ],
      details: msg,
    };
  }

  // 3) Algemeen (server reageerde niet op tijd)
  return {
    titel: 'Kan de app-server niet bereiken',
    uitleg: err
      ? 'De interne server kon niet starten door een onverwachte fout (zie technische details onderaan).'
      : 'De interne server reageerde niet op tijd. Soms helpt gewoon opnieuw starten.',
    oplossingen: [
      { tekst: 'Herstart de desktop-app:', cmd: 'sh stop-electron.sh && sh start-electron.sh' },
      { tekst: 'Controleer of poort 3000 vrij is:', cmd: 'lsof -i tcp:3000' },
      { tekst: 'Bouw zo nodig de native modules opnieuw:', cmd: 'npm run rebuild' },
    ],
    details: msg,
  };
}

function logFout(err) {
  try {
    const logPad = path.join(process.env.FOTOAPP_DATA || __dirname, 'electron-fout.log');
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    fs.appendFileSync(logPad, `\n[${new Date().toISOString()}]\n${msg}\n`);
  } catch (_) { /* logging mag nooit zelf crashen */ }
}

// ── Electron folder-dialog (vervangt zenity) ────────────────────────────────
// index.js importeert deze functie als het in Electron draait.
global.electronPickFolder = async function(startPad) {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Kies een map om te scannen',
    defaultPath: startPad || app.getPath('home'),
  });
  return result.canceled ? null : result.filePaths[0];
};

// ── Bestand openen in systeemspeler ────────────────────────────────────────
global.electronOpenExtern = async function(bestandsPad) {
  return shell.openPath(bestandsPad);
};

// ── Bestand tonen in bestandsbeheerder (map openen + bestand selecteren) ─────
global.electronRevealInFolder = function(bestandsPad) {
  shell.showItemInFolder(bestandsPad);
  return true;
};

// ── BrowserWindow ───────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  800,
    minHeight: 600,
    title: 'FotoApp',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#0f0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Verberg standaard menu (optioneel: houd voor dev-tools)
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // Toon de foutpagina met begrijpelijke uitleg + oplossingen
  const toonFout = (err) => {
    const info = diagnoseFout(err);
    const hash = encodeURIComponent(JSON.stringify(info));
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { hash });
  };

  // Laad de app — probeer opnieuw als de server nog niet klaar is
  const loadApp = (retries = 20) => {
    // Server is al gecrasht? Direct de foutpagina tonen, niet 6s wachten.
    if (serverError) { toonFout(serverError); return; }
    mainWindow.loadURL(`http://localhost:${serverPort}`).catch(() => {
      if (serverError) { toonFout(serverError); return; }
      if (retries > 0) setTimeout(() => loadApp(retries - 1), 300);
      else toonFout(null);
    });
  };

  // Geef de server 500ms om te starten voor de eerste poging
  setTimeout(() => loadApp(), 500);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
