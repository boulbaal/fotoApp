#!/usr/bin/env node
/**
 * Test runner — voert alle tests uit en toont resultaten
 * Gebruik: node tests/run-tests.js [--api]
 *   --api  : voer ook API tests uit (vereist draaiende server op poort 3000)
 */

const metApi = process.argv.includes('--api');

const GROEN  = '\x1b[32m';
const ROOD   = '\x1b[31m';
const GEEL   = '\x1b[33m';
const CYAAN  = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

function lijn(char = '─', lengte = 60) {
  return char.repeat(lengte);
}

async function voerUit(naam, testFn) {
  console.log(`\n${CYAAN}${BOLD}▶ ${naam}${RESET}`);
  console.log(DIM + lijn() + RESET);

  let resultaten;
  try {
    resultaten = await testFn();
  } catch (e) {
    console.log(`${ROOD}  ✗ Kon tests niet laden: ${e.message}${RESET}`);
    return { totaal: 0, geslaagd: 0, gefaald: 1 };
  }

  let geslaagd = 0, gefaald = 0, gewaarschuwd = 0;
  for (const r of resultaten) {
    if (r.ok) {
      console.log(`${GROEN}  ✓ ${r.naam}${RESET}`);
      geslaagd++;
    } else if (r.waarschuwing) {
      console.log(`${GEEL}  ⚠ ${r.naam}${RESET}`);
      console.log(`${GEEL}    → ${r.fout}${RESET}`);
      gewaarschuwd++;
    } else {
      console.log(`${ROOD}  ✗ ${r.naam}${RESET}`);
      console.log(`${ROOD}    → ${r.fout}${RESET}`);
      gefaald++;
    }
  }

  const kleur = gefaald === 0 ? GROEN : ROOD;
  console.log(DIM + lijn() + RESET);
  const waarschuwTekst = gewaarschuwd > 0 ? ` (${gewaarschuwd} ⚠ overgeslagen)` : '';
  console.log(`${kleur}  ${geslaagd}/${resultaten.length - gewaarschuwd} geslaagd${waarschuwTekst}${RESET}`);

  return { totaal: resultaten.length - gewaarschuwd, geslaagd, gefaald, gewaarschuwd };
}

async function main() {
  console.log(`\n${BOLD}╔══════════════════════════════════════════════╗`);
  console.log(`║         FotoApp — Test Suite                 ║`);
  console.log(`╚══════════════════════════════════════════════╝${RESET}`);
  console.log(`${DIM}${new Date().toLocaleString('nl-BE')}${RESET}`);

  const suites = [
    { naam: 'Database',  fn: require('./database.test.js') },
    { naam: 'Scanner',   fn: require('./scanner.test.js')  },
  ];

  if (metApi) {
    suites.push({ naam: 'API (live server)', fn: require('./api.test.js') });
  } else {
    console.log(`\n${GEEL}ℹ️  API tests overgeslagen (start met --api voor live server tests)${RESET}`);
  }

  let totaalGeslaagd = 0, totaalGefaald = 0, totaalTests = 0, totaalWaarschuwingen = 0;

  for (const suite of suites) {
    const r = await voerUit(suite.naam, suite.fn);
    totaalGeslaagd       += r.geslaagd;
    totaalGefaald        += r.gefaald;
    totaalTests          += r.totaal;
    totaalWaarschuwingen += r.gewaarschuwd || 0;
  }

  console.log(`\n${BOLD}${lijn('═')}${RESET}`);
  const allesOk = totaalGefaald === 0;
  const kleur = allesOk ? GROEN : ROOD;
  const icoon = allesOk ? '✅' : '❌';
  console.log(`${kleur}${BOLD}${icoon}  Totaal: ${totaalGeslaagd}/${totaalTests} geslaagd${RESET}`);
  if (totaalWaarschuwingen > 0) {
    console.log(`${GEEL}   ⚠ ${totaalWaarschuwingen} test(s) overgeslagen (omgeving)${RESET}`);
  }

  if (totaalGefaald > 0) {
    console.log(`${ROOD}   ${totaalGefaald} test(s) gefaald — app start NIET${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GROEN}   Alle tests geslaagd — app mag starten${RESET}\n`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error(`${ROOD}Test runner fout: ${e.message}${RESET}`);
  process.exit(1);
});
