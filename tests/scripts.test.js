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

  // ─── ISOLATIE T.O.V. WEB-SCRIPTS ────────────────────────────────────────────

  test('Electron-scripts gebruiken niet hetzelfde PID-bestand als stop.sh (.pid)', () => {
    // Alle .pid-verwijzingen moeten .electron.pid zijn — nooit het kale .pid
    // van de web-server (index.js / stop.sh).
    const kaalPid = /(?<!electron)\.pid/;
    if (kaalPid.test(start) || kaalPid.test(stop)) {
      throw new Error('mag .pid van de web-server niet overschrijven');
    }
  });

  return resultaten;
};
