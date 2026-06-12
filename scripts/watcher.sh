#!/bin/bash

# FotoApp Script Watcher
# Bewaakt de queue/ map en voert scripts automatisch uit
# Output gaat naar output/ zodat Claude kan meelezen

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
QUEUE_DIR="$SCRIPTS_DIR/queue"
OUTPUT_DIR="$SCRIPTS_DIR/output"

mkdir -p "$QUEUE_DIR" "$OUTPUT_DIR"

echo "🔍 FotoApp Watcher gestart"
echo "   Bewaakt: $QUEUE_DIR"
echo "   Output:  $OUTPUT_DIR"
echo "   Druk op Ctrl+C om te stoppen"
echo ""

# Bijhouden welke scripts al uitgevoerd zijn
EXECUTED_FILE="$OUTPUT_DIR/.executed"
touch "$EXECUTED_FILE"

run_script() {
    local script="$1"
    local name=$(basename "$script" .sh)
    local logfile="$OUTPUT_DIR/${name}.log"

    # Check of dit script al is uitgevoerd
    if grep -qF "$script" "$EXECUTED_FILE" 2>/dev/null; then
        return
    fi

    echo "▶️  Uitvoeren: $name"
    echo "   Log: $logfile"
    echo ""

    {
        echo "=== SCRIPT: $name ==="
        echo "=== START: $(date '+%Y-%m-%d %H:%M:%S') ==="
        echo ""
        bash "$script" 2>&1
        echo ""
        echo "=== EINDE: $(date '+%Y-%m-%d %H:%M:%S') ==="
    } | tee "$logfile"

    echo "$script" >> "$EXECUTED_FILE"
    echo ""
    echo "✅ Klaar: $name → $logfile"
    echo "---"
}

# Voer eerst bestaande scripts in queue uit
for script in "$QUEUE_DIR"/*.sh; do
    [ -f "$script" ] && run_script "$script"
done

# Blijf wachten op nieuwe scripts
echo "👀 Wachten op nieuwe scripts..."
while true; do
    for script in "$QUEUE_DIR"/*.sh; do
        [ -f "$script" ] && run_script "$script"
    done
    sleep 3
done
