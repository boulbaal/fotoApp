#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         FotoApp — Opstarten                  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# === STAP 1: TESTS ===
echo "🧪 Tests uitvoeren..."
node tests/run-tests.js
TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
  echo ""
  echo "❌ Tests gefaald — app start NIET."
  echo "   Herstel de fouten hierboven en probeer opnieuw."
  exit 1
fi

# === STAP 2: POORT OPRUIMEN ===
OLD_PIDS=$(lsof -ti tcp:3000 2>/dev/null)
if [ -n "$OLD_PIDS" ]; then
  echo "⚠️  Poort 3000 bezet — stoppen..."
  echo "$OLD_PIDS" | xargs kill 2>/dev/null
  # Wacht tot poort echt vrij is (max 5 seconden)
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

# === STAP 3: ZENITY CHECK ===
if ! command -v zenity &>/dev/null; then
  echo "⚠️  zenity niet gevonden — folder picker werkt niet"
  echo "   Installeer met: sudo apt install zenity"
fi

# === STAP 4: APP STARTEN ===
# --max-old-space-size begrenst de V8-heap zodat een zware scan nooit het hele
# systeem opvreet (OOM-kill voorkomen). De native sharp/libvips-piek wordt apart
# beperkt via sharp.cache(false)/concurrency(2) in src/scanner.js.
node --max-old-space-size=1024 index.js &
APP_PID=$!
echo $APP_PID > .pid
echo ""
echo "✅ FotoApp draait op http://localhost:3000  (PID $APP_PID)"
echo "   Stop met: sh stop.sh"
echo ""

wait $APP_PID
