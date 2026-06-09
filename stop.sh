#!/bin/bash
cd "$(dirname "$0")"

if [ -f .pid ]; then
  PID=$(cat .pid)
  if kill -0 "$PID" 2>/dev/null; then
    echo "⏹  FotoApp stoppen (PID $PID)..."
    kill "$PID"
    rm .pid
    echo "✅ Gestopt."
  else
    echo "⚠️  PID $PID loopt niet meer."
    rm .pid
  fi
else
  # Fallback: zoek op poort
  OLD_PID=$(lsof -ti tcp:3000 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    echo "⏹  FotoApp stoppen (PID $OLD_PID)..."
    kill "$OLD_PID"
    echo "✅ Gestopt."
  else
    echo "ℹ️  FotoApp was niet actief."
  fi
fi
