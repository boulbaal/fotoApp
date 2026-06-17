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

# === STAP 3: POORT OPRUIMEN ===
# De Electron-app start intern dezelfde server op poort 3000.
OLD_PIDS=$(lsof -ti tcp:3000 2>/dev/null)
if [ -n "$OLD_PIDS" ]; then
  echo "⚠️  Poort 3000 bezet — stoppen..."
  echo "$OLD_PIDS" | xargs kill 2>/dev/null
  for i in 1 2 3 4 5; do
    sleep 1
    STILL=$(lsof -ti tcp:3000 2>/dev/null)
    if [ -z "$STILL" ]; then break; fi
    if [ $i -eq 5 ]; then
      echo "$STILL" | xargs kill -9 2>/dev/null
      sleep 1
    fi
  done
fi

# === STAP 4: AL EEN DESKTOP-APP ACTIEF? ===
if [ -f .electron.pid ]; then
  OLD=$(cat .electron.pid)
  if kill -0 "$OLD" 2>/dev/null; then
    echo "⚠️  Desktop-app draait al (PID $OLD) — eerst stoppen met: sh stop-electron.sh"
    exit 1
  else
    rm .electron.pid
  fi
fi

# === STAP 5: DESKTOP-APP STARTEN ===
ELECTRON_RUN=1 "$ELECTRON" . &
APP_PID=$!
echo $APP_PID > .electron.pid
echo ""
echo "✅ FotoApp desktop draait  (PID $APP_PID)"
echo "   Stop met: sh stop-electron.sh"
echo ""

wait $APP_PID
