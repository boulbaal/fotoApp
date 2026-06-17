#!/bin/bash
cd "$(dirname "$0")"

stop_pid () {
  PID=$1
  if kill -0 "$PID" 2>/dev/null; then
    echo "⏹  FotoApp desktop stoppen (PID $PID)..."
    # Electron start kindprocessen; hele procesgroep meenemen.
    kill -- -"$(ps -o pgid= "$PID" 2>/dev/null | tr -d ' ')" 2>/dev/null || kill "$PID" 2>/dev/null
    return 0
  fi
  return 1
}

STOPPED=0

if [ -f .electron.pid ]; then
  PID=$(cat .electron.pid)
  if stop_pid "$PID"; then STOPPED=1; fi
  rm -f .electron.pid
fi

# Fallback: server-poort opruimen die de Electron-app intern gebruikt.
OLD_PID=$(lsof -ti tcp:3000 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "⏹  Achtergebleven server op poort 3000 stoppen..."
  echo "$OLD_PID" | xargs kill 2>/dev/null
  STOPPED=1
fi

if [ $STOPPED -eq 1 ]; then
  echo "✅ Gestopt."
else
  echo "ℹ️  FotoApp desktop was niet actief."
fi
