'use strict';

const { app, BrowserWindow, dialog, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── PIN the data location (before any name change) ──────────────────────────
// Electron derives userData from the app name. If we change the name below for
// the taskbar icon, the database folder would move along and everything would
// look empty. So we pin userData explicitly to the original location
// (~/.config/fotoapp) so the existing database is always found.
app.setPath('userData', path.join(app.getPath('appData'), 'fotoapp'));

// ── App name + Linux WM class ────────────────────────────────────────────────
// On Linux (GNOME/Wayland) the window manager links the taskbar icon to the
// WM_CLASS of the window. Without this, Electron shows the generic Electron
// icon in dev mode. Set the name AFTER pinning userData (see above).
// setName handles the Wayland app_id; --class handles the X11 WM_CLASS. Together
// with the installed FotoApp.desktop (see start-electron.sh) GNOME links the
// window to the right taskbar icon, also in dev mode.
app.setName('FotoApp');
app.commandLine.appendSwitch('class', 'FotoApp');

// ── Prevent Linux GTK crash (#1 cause of SIGTRAP when picking a folder) ─────
// Electron 30+ defaulted to GTK4 on recent Ubuntu. The native folder picker
// (GtkFileChooser) under GTK4 causes a flood of
// "GLib-GObject: g_object_ref: assertion 'G_IS_OBJECT' failed" and crashes the
// app with SIGTRAP — exactly what happened when picking a folder to scan.
// Forcing GTK3 is the common, stable fix.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('gtk-version', '3');
}

// ── Memory ceiling ──────────────────────────────────────────────────────────
// The scan runs in this (main) process. Cap the V8 heap so a heavy scan never
// grabs so much memory that Ubuntu OOM-kills other apps.
// (The native sharp/libvips peak is limited separately via sharp.cache/concurrency
// in src/scanner.js — this ceiling covers the JS side.)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1024');

// ── Set the data folder before the server loads ─────────────────────────────
// In the packaged app the install folder is read-only; use userData.
const dataDir = path.join(app.getPath('userData'), 'fotoapp-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

process.env.DB_PATH       = path.join(dataDir, 'photos.db');
process.env.FOTOAPP_DATA  = dataDir;        // scanner uses this for temp files
process.env.ELECTRON_RUN  = '1';             // flag for index.js

// ── Start the server ────────────────────────────────────────────────────────
let serverReady = false;
let serverPort  = 3000;
let serverError = null;   // keeps the cause if the server failed to start

function startServer() {
  try {
    require('../index.js');
    serverReady = true;
  } catch (e) {
    serverError = e;
    console.error('Server could not start:', e);
    logError(e);
  }
}

// Also catch asynchronous errors (e.g. a native module failing later)
process.on('uncaughtException',  (e) => { if (!serverReady) { serverError = serverError || e; logError(e); } });
process.on('unhandledRejection', (e) => { if (!serverReady) { serverError = serverError || e; logError(e); } });

// ── Error diagnosis: translate technical errors into understandable help ─────
// The returned object keys (title/explanation/solutions/text/cmd/details) are
// read and shown by electron/error.html.
function diagnoseError(err) {
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err || '');

  // 1) Native module built for the wrong Node/Electron version
  if (/NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|did not self-register|compiled against a different/i.test(msg)) {
    return {
      title: 'The database module needs to be rebuilt',
      explanation: 'The native database module (better-sqlite3) was built for a different Node version than the one Electron uses. This happens after a Node update or a fresh "npm install". Because of this the internal server could not start — it is NOT a port 3000 issue.',
      solutions: [
        { text: 'Rebuild the native modules for Electron (usually enough):', cmd: 'npm run rebuild' },
        { text: 'Still not working? Remove, reinstall and rebuild:', cmd: 'rm -rf node_modules && npm install && npm run rebuild' },
        { text: 'Then start the desktop app again:', cmd: 'sh start-electron.sh' },
      ],
      details: msg,
    };
  }

  // 2) Port already in use
  if (/EADDRINUSE/i.test(msg)) {
    return {
      title: 'Port 3000 is already in use',
      explanation: 'Another program (or a previous FotoApp instance that is still running) is using port 3000, so the server could not start.',
      solutions: [
        { text: 'Stop any previous instance:', cmd: 'sh stop-electron.sh' },
        { text: 'Check which process is using the port:', cmd: 'lsof -i tcp:3000' },
        { text: 'Then start again:', cmd: 'sh start-electron.sh' },
      ],
      details: msg,
    };
  }

  // 3) Generic (server did not respond in time)
  return {
    title: 'Cannot reach the app server',
    explanation: err
      ? 'The internal server could not start due to an unexpected error (see technical details below).'
      : 'The internal server did not respond in time. Sometimes simply restarting helps.',
    solutions: [
      { text: 'Restart the desktop app:', cmd: 'sh stop-electron.sh && sh start-electron.sh' },
      { text: 'Check whether port 3000 is free:', cmd: 'lsof -i tcp:3000' },
      { text: 'If needed, rebuild the native modules:', cmd: 'npm run rebuild' },
    ],
    details: msg,
  };
}

function logError(err) {
  try {
    const logPath = path.join(process.env.FOTOAPP_DATA || __dirname, 'electron-error.log');
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    fs.appendFileSync(logPath, `\n[${new Date().toISOString()}]\n${msg}\n`);
  } catch (_) { /* logging must never crash itself */ }
}

// ── Electron folder dialog (replaces zenity) ────────────────────────────────
// index.js imports this function when running inside Electron.
global.electronPickFolder = async function(startPath) {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Kies een map om te scannen',
    defaultPath: startPath || app.getPath('home'),
  });
  return result.canceled ? null : result.filePaths[0];
};

// ── Open a file in the system player ────────────────────────────────────────
global.electronOpenExternal = async function(filePath) {
  return shell.openPath(filePath);
};

// ── Show a file in the file manager (open folder + select file) ──────────────
global.electronRevealInFolder = function(filePath) {
  shell.showItemInFolder(filePath);
  return true;
};

// ── BrowserWindow ───────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  // On Linux, nativeImage is more reliable than a path string for the taskbar icon.
  const appIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));

  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  800,
    minHeight: 600,
    title: 'FotoApp',
    icon: appIcon,
    backgroundColor: '#0f0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Extra safety on Linux: set the icon explicitly once more after construction.
  if (process.platform === 'linux' && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }

  // Hide the default menu (optional: keep for dev tools)
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // Show the error page with understandable explanation + solutions
  const showError = (err) => {
    const info = diagnoseError(err);
    const hash = encodeURIComponent(JSON.stringify(info));
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { hash });
  };

  // Load the app — retry if the server is not ready yet
  const loadApp = (retries = 20) => {
    // Server already crashed? Show the error page right away, don't wait 6s.
    if (serverError) { showError(serverError); return; }
    mainWindow.loadURL(`http://localhost:${serverPort}`).catch(() => {
      if (serverError) { showError(serverError); return; }
      if (retries > 0) setTimeout(() => loadApp(retries - 1), 300);
      else showError(null);
    });
  };

  // Give the server 500ms to start before the first attempt
  setTimeout(() => loadApp(), 500);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Crash monitoring: record WHAT died + whether a scan was running ──────────
// If the app crashes unexpectedly (like the GTK4 SIGTRAP), we write the real
// cause to electron-error.log instead of just a raw GLib flood in the terminal.
// That way the next crash immediately shows whether it was the renderer, the
// GPU process or another subprocess — and when (handy to match scan activity).
app.on('render-process-gone', (_e, _wc, details) => {
  logError(new Error(
    `Renderer gone — reason=${details.reason}, exitCode=${details.exitCode}`
  ));
});
app.on('child-process-gone', (_e, details) => {
  // type can be: GPU, Utility, Zygote, Sandbox helper, ... → reason helps diagnosis
  logError(new Error(
    `Subprocess gone — type=${details.type}, name=${details.name || '-'}, ` +
    `reason=${details.reason}, exitCode=${details.exitCode}`
  ));
});

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
