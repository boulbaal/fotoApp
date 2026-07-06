const fs   = require('fs');
const path = require('path');

module.exports = async function testScripts() {
  const resultaten = [];

  function test(naam, fn) {
    try {
      fn();
      resultaten.push({ naam, ok: true });
    } catch (e) {
      resultaten.push({ naam, ok: false, fout: e.message });
    }
  }

  const lees = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const bestaat = (rel) => fs.existsSync(path.join(__dirname, '..', rel));
  const uitvoerbaar = (rel) => {
    const st = fs.statSync(path.join(__dirname, '..', rel));
    return (st.mode & 0o111) !== 0; // minstens één execute-bit
  };

  // ─── BESTANDSSTRUCTUUR ──────────────────────────────────────────────────────

  test('start-electron.sh bestaat', () => {
    if (!bestaat('start-electron.sh')) throw new Error('start-electron.sh niet gevonden');
  });

  test('stop-electron.sh bestaat', () => {
    if (!bestaat('stop-electron.sh')) throw new Error('stop-electron.sh niet gevonden');
  });

  test('start-electron.sh is uitvoerbaar', () => {
    if (!uitvoerbaar('start-electron.sh')) throw new Error('execute-bit ontbreekt');
  });

  test('stop-electron.sh is uitvoerbaar', () => {
    if (!uitvoerbaar('stop-electron.sh')) throw new Error('execute-bit ontbreekt');
  });

  // ─── START-ELECTRON INHOUD ──────────────────────────────────────────────────

  const start = lees('start-electron.sh');

  test('start-electron.sh draait tests vóór start', () => {
    if (!start.includes('node tests/run-tests.js')) throw new Error('test-stap ontbreekt');
  });

  test('start-electron.sh stopt bij gefaalde tests', () => {
    if (!start.includes('TEST_RESULT') || !start.includes('exit 1')) {
      throw new Error('faalt niet bij rode tests');
    }
  });

  test('start-electron.sh start Electron', () => {
    if (!start.includes('electron') || !start.includes('ELECTRON_RUN=1')) {
      throw new Error('Electron-start ontbreekt');
    }
  });

  test('start-electron.sh schrijft eigen PID-bestand', () => {
    if (!start.includes('.electron.pid')) throw new Error('.electron.pid niet gebruikt');
  });

  test('start-electron.sh maakt poort 3000 vrij', () => {
    if (!start.includes('tcp:3000')) throw new Error('poort-opruiming ontbreekt');
  });

  test('start-electron.sh test native module vóór start', () => {
    if (!start.includes('ELECTRON_RUN_AS_NODE') || !start.includes('better-sqlite3')) {
      throw new Error('pre-flight native-module check ontbreekt');
    }
  });

  test('start-electron.sh adviseert npm run rebuild bij mismatch', () => {
    if (!start.includes('npm run rebuild')) throw new Error('rebuild-advies ontbreekt');
  });

  test('start-electron.sh scant welk proces poort 3000 gebruikt', () => {
    if (!start.includes('ps -p')) throw new Error('proces-scan op poort ontbreekt');
  });

  test('start-electron.sh heeft post-mortem diagnose', () => {
    if (!start.includes('NODE_MODULE_VERSION') || !start.includes('grep')) {
      throw new Error('post-mortem log-analyse ontbreekt');
    }
  });

  // De gebruiker start met "sh ..." (= dash op Ubuntu): geen bash-only syntax.
  test('start-electron.sh is POSIX-veilig (geen process-substitutie of &>)', () => {
    if (start.includes('>(') || /[^0-9]&>/.test(start) || start.includes("$'")) {
      throw new Error('bevat bash-only syntax die met sh/dash crasht');
    }
  });

  // ─── STOP-ELECTRON INHOUD ───────────────────────────────────────────────────

  const stop = lees('stop-electron.sh');

  test('stop-electron.sh leest eigen PID-bestand', () => {
    if (!stop.includes('.electron.pid')) throw new Error('.electron.pid niet gebruikt');
  });

  test('stop-electron.sh stuurt kill-signaal', () => {
    if (!stop.includes('kill')) throw new Error('kill ontbreekt');
  });

  test('stop-electron.sh heeft poort-fallback', () => {
    if (!stop.includes('tcp:3000')) throw new Error('poort-fallback ontbreekt');
  });

  test('stop-electron.sh is POSIX-veilig (geen process-substitutie of &>)', () => {
    if (stop.includes('>(') || /[^0-9]&>/.test(stop) || stop.includes("$'")) {
      throw new Error('bevat bash-only syntax die met sh/dash crasht');
    }
  });

  // ─── ISOLATIE T.O.V. WEB-SCRIPTS ────────────────────────────────────────────

  test('Electron-scripts gebruiken niet hetzelfde PID-bestand als stop.sh (.pid)', () => {
    // Alle .pid-verwijzingen moeten .electron.pid zijn — nooit het kale .pid
    // van de web-server (index.js / stop.sh).
    const kaalPid = /(?<!electron)\.pid/;
    if (kaalPid.test(start) || kaalPid.test(stop)) {
      throw new Error('mag .pid van de web-server niet overschrijven');
    }
  });

  // ─── ELECTRON FOUTAFHANDELING ───────────────────────────────────────────────

  const mainJs = lees('electron/main.js');

  test('electron/main.js bewaart server-fout (serverError)', () => {
    if (!mainJs.includes('serverError')) throw new Error('serverError ontbreekt');
  });

  test('electron/main.js classificeert fouten (diagnoseError)', () => {
    if (!mainJs.includes('diagnoseError')) throw new Error('diagnoseError ontbreekt');
  });

  test('electron/main.js herkent native-module mismatch', () => {
    if (!mainJs.includes('NODE_MODULE_VERSION') || !mainJs.includes('npm run rebuild')) {
      throw new Error('native-module diagnose ontbreekt');
    }
  });

  test('electron/main.js herkent bezette poort (EADDRINUSE)', () => {
    if (!mainJs.includes('EADDRINUSE')) throw new Error('poort-diagnose ontbreekt');
  });

  test('electron/main.js geeft diagnose door aan error.html (hash)', () => {
    if (!mainJs.includes('error.html') || !mainJs.includes('hash')) {
      throw new Error('diagnose wordt niet doorgegeven aan foutpagina');
    }
  });

  test('electron/main.js schrijft foutlog', () => {
    if (!mainJs.includes('logError') || !mainJs.includes('electron-fout.log')) {
      throw new Error('foutlog ontbreekt');
    }
  });

  // ─── FOUTPAGINA ─────────────────────────────────────────────────────────────

  const errorHtml = lees('electron/error.html');

  test('error.html leest de diagnose uit location.hash', () => {
    if (!errorHtml.includes('location.hash')) throw new Error('hash-uitlezing ontbreekt');
  });

  test('error.html toont oplossingen met kopieer-knop', () => {
    if (!errorHtml.includes('oplossingen') || !errorHtml.includes('clipboard')) {
      throw new Error('oplossingen of kopieer-knop ontbreekt');
    }
  });

  return resultaten;
};
