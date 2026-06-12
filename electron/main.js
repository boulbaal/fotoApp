'use strict';

const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

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

function startServer() {
  try {
    require('../index.js');
    serverReady = true;
  } catch (e) {
    console.error('Server kon niet starten:', e);
  }
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

// ── BrowserWindow ───────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  800,
    minHeight: 600,
    title: 'FotoApp',
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

  // Laad de app — probeer opnieuw als de server nog niet klaar is
  const loadApp = (retries = 20) => {
    mainWindow.loadURL(`http://localhost:${serverPort}`).catch(() => {
      if (retries > 0) setTimeout(() => loadApp(retries - 1), 300);
      else mainWindow.loadFile(path.join(__dirname, 'error.html'));
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
