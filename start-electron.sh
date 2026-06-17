#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║      FotoApp — Desktop (Electron) starten    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# === STAP 1: TESTS ===
echo "🧪 Tests uitvoeren..."
node tests/run-tests.js
TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
  echo ""
  echo "❌ Tests gefaald — desktop-app start NIET."
  echo "   Herstel de fouten hierboven en probeer opnieuw."
  exit 1
fi

# === STAP 2: ELECTRON AANWEZIG? ===
if [ -x "./node_modules/.bin/electron" ]; then
  ELECTRON="./node_modules/.bin/electron"
elif command -v electron &>/dev/null; then
  ELECTRON="electron"
else
  echo "❌ Electron niet gevonden."
  echo "   Installeer met: npm install"
  exit 1
fi

# === STAP 3: NATIVE-MODULE CHECK (better-sqlite3 vs Electron) ===
# Dit is de #1 oorzaak van "Kan de app-server niet bereiken": de database-module
# is gebouwd voor system-Node, niet voor Electron (verschillende NODE_MODULE_VERSION).
# We testen dit headless door de module te laden met Electron's eigen ABI.
echo "🔍 Database-module controleren (Electron-compatibel?)..."
NATIVE_FOUT=$(ELECTRON_RUN_AS_NODE=1 "$ELECTRON" -e "require('better-sqlite3')" 2>&1)
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ De database-module (better-sqlite3) is NIET compatibel met Electron."
  echo "   Oorzaak: gebouwd voor een andere Node-versie (NODE_MODULE_VERSION mismatch)."
  echo "   → Dit ligt NIET aan poort 3000."
  echo ""
  echo "   Los het zo op (kies de bovenste; werkt die niet, dan de tweede):"
  echo "     1)  npm run rebuild"
  echo "     2)  rm -rf node_modules && npm install && npm run rebuild"
  echo ""
  echo "   Daarna opnieuw: sh start-electron.sh"
  echo ""
  echo "   (technisch detail: ${NATIVE_FOUT%%$'\n'*})"
  exit 1
fi
echo "   ✓ Database-module is Electron-compatibel."

# === STAP 4: POORT 3000 SCANNEN ===
echo "🔍 Poort 3000 controleren..."
PORT_PIDS=$(lsof -ti tcp:3000 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  echo "⚠️  Poort 3000 is in gebruik door:"
  # Toon per PID het programma zodat de gebruiker weet wat er draait
  for P in $PORT_PIDS; do
    NAAM=$(ps -p "$P" -o comm= 2>/dev/null)
    echo "      • PID $P  ($NAAM)"
  done
  echo "   → Deze worden gestopt zodat de desktop-app de poort kan gebruiken..."
  echo "$PORT_PIDS" | xargs kill 2>/dev/null
  for i in 1 2 3 4 5; do
    sleep 1
    STILL=$(lsof -ti tcp:3000 2>/dev/null)
    if [ -z "$STILL" ]; then break; fi
    if [ $i -eq 5 ]; then
      echo "   Poort gaf niet vrij — geforceerd stoppen..."
      echo "$STILL" | xargs kill -9 2>/dev/null
      sleep 1
    fi
  done
  echo "   ✓ Poort 3000 is nu vrij."
else
  echo "   ✓ Poort 3000 is vrij."
fi

# === STAP 5: AL EEN DESKTOP-APP ACTIEF? ===
if [ -f .electron.pid ]; then
  OLD=$(cat .electron.pid)
  if kill -0 "$OLD" 2>/dev/null; then
    echo "⚠️  Desktop-app draait al (PID $OLD) — eerst stoppen met: sh stop-electron.sh"
    exit 1
  else
    rm .electron.pid
  fi
fi

# === STAP 6: DESKTOP-APP STARTEN ===
LOG="electron-uitvoer.log"
: > "$LOG"
echo ""
echo "🚀 Desktop-app starten..."
# Output naar console én logboek, zodat we na afsluiten kunnen diagnosticeren.
ELECTRON_RUN=1 "$ELECTRON" . > >(tee "$LOG") 2>&1 &
APP_PID=$!
echo $APP_PID > .electron.pid
echo ""
echo "✅ FotoApp desktop draait  (PID $APP_PID)"
echo "   Stop met: sh stop-electron.sh"
echo ""

wait $APP_PID
rm -f .electron.pid

# === STAP 7: POST-MORTEM DIAGNOSE ===
# Als de app crashte door een bekende oorzaak, leg het uit in de terminal.
if grep -qE "NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|did not self-register|compiled against a different" "$LOG" 2>/dev/null; then
  echo ""
  echo "────────────────────────────────────────────────────────"
  echo "❌ De app stopte door een database-module-fout."
  echo "   Bouw de native modules opnieuw en start opnieuw:"
  echo "     npm run rebuild && sh start-electron.sh"
  echo "────────────────────────────────────────────────────────"
elif grep -qE "EADDRINUSE" "$LOG" 2>/dev/null; then
  echo ""
  echo "────────────────────────────────────────────────────────"
  echo "❌ Poort 3000 was toch nog bezet. Stop alles en start opnieuw:"
  echo "     sh stop-electron.sh && sh start-electron.sh"
  echo "────────────────────────────────────────────────────────"
fi
