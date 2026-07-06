#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# FotoApp — diagnose-script  (POSIX-sh veilig: werkt met `sh diagnose.sh`)
# Verzamelt alles wat nodig is om te zien waarom de app/Electron is gecrasht
# (vooral: geheugentekort / OOM-kill) en schrijft het naar één logbestand.
#
# Gebruik:
#   sh diagnose.sh            # werkt, maar mist soms de kernel-/OOM-log
#   sudo sh diagnose.sh       # AANBEVOLEN — dan komt ook de OOM-kill erbij
#
# Daarna: stuur het getoonde logbestand naar Claude.
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1
PROJECT_DIR="$(pwd)"
LOG="$PROJECT_DIR/diagnose-$(date +%Y%m%d-%H%M%S).log"

sectie() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════════════"
}

# Alle verzamel-commando's in één functie; output gaat via tee naar het log.
verzamel() {
  echo "FotoApp diagnose — $(date)"
  echo "Projectmap: $PROJECT_DIR"
  if [ "$(id -u)" -ne 0 ]; then
    echo "⚠️  Niet als root gestart — kernel-/OOM-log kan onvolledig zijn."
    echo "    Voor de volledige diagnose: sudo sh diagnose.sh"
  fi

  # ── 1. Systeem ─────────────────────────────────────────────────────────────
  sectie "1. SYSTEEM"
  echo "Kernel : $(uname -a)"
  [ -f /etc/os-release ] && grep PRETTY_NAME /etc/os-release
  echo "Uptime : $(uptime 2>/dev/null)"

  # ── 2. Geheugen & swap ─────────────────────────────────────────────────────
  sectie "2. GEHEUGEN & SWAP (nu)"
  free -h
  echo ""
  echo "Swap-apparaten:"
  swapon --show 2>/dev/null || echo "  (geen swap — geen swap = sneller een OOM-kill)"

  # ── 3. OOM-killer in de kernel-log ─────────────────────────────────────────
  sectie "3. OOM-KILL / KERNEL-FOUTEN (laatste 3 uur)"
  if journalctl -k --since "3 hours ago" >/dev/null 2>&1; then
    journalctl -k --since "3 hours ago" 2>/dev/null \
      | grep -iE "out of memory|oom-kill|killed process|oom_reaper|segfault|general protection" \
      | tail -40
    echo "   (leeg hierboven = geen OOM/kernel-fout in dit venster gevonden)"
  else
    echo "journalctl -k niet toegankelijk; probeer dmesg:"
    dmesg -T 2>/dev/null \
      | grep -iE "out of memory|oom-kill|killed process|segfault" \
      | tail -40 \
      || echo "  dmesg vereist root — voer uit met: sudo sh diagnose.sh"
  fi

  # ── 4. Journal over de app ─────────────────────────────────────────────────
  sectie "4. SYSTEMD-JOURNAL OVER APP (laatste 3 uur)"
  journalctl --since "3 hours ago" 2>/dev/null \
    | grep -iE "fotoapp|electron|node|chrome|core-dump|segfault|signal" \
    | tail -50 \
    || echo "  (journalctl niet toegankelijk zonder root)"

  # ── 5. Core dumps ──────────────────────────────────────────────────────────
  sectie "5. CORE DUMPS / GEREGISTREERDE CRASHES"
  if command -v coredumpctl >/dev/null 2>&1; then
    coredumpctl list --since "1 day ago" 2>/dev/null | tail -15 \
      || echo "  (geen core dumps geregistreerd)"
  else
    echo "  coredumpctl niet geïnstalleerd"
  fi

  # ── 6. Eigen logs ──────────────────────────────────────────────────────────
  sectie "6. FOTOAPP LOGBESTANDEN (laatste 80 regels elk)"
  for f in electron-uitvoer.log fotoapp.log; do
    echo "── $f ──"
    if [ -f "$f" ]; then
      tail -n 80 "$f"
    else
      echo "  (bestaat niet)"
    fi
    echo ""
  done

  # ── 7. Lopende processen + geheugen ────────────────────────────────────────
  sectie "7. LOPENDE PROCESSEN (node/electron) + GEHEUGENGEBRUIK"
  ps -eo pid,ppid,%mem,%cpu,rss,cmd --sort=-%mem 2>/dev/null \
    | grep -iE "node|electron|fotoapp" | grep -v grep | head -20 \
    || echo "  (geen node/electron-proces actief)"
  echo ""
  echo "PID-bestanden:"
  for p in .pid .electron.pid; do
    [ -f "$p" ] && echo "  $p = $(cat "$p")"
  done

  # ── 8. Start-configuratie (heap-plafond actief?) ───────────────────────────
  sectie "8. START-CONFIGURATIE (is het geheugenplafond actief?)"
  echo "Node-versie: $(node -v 2>/dev/null || echo 'node niet gevonden')"
  echo ""
  echo "start.sh node-regel:"
  grep -n "node .*index.js" start.sh 2>/dev/null || echo "  (niet gevonden)"
  echo "electron/main.js heap-plafond:"
  grep -n "max-old-space-size" electron/main.js 2>/dev/null || echo "  ⚠️  GEEN heap-plafond in main.js"
  echo "scanner.js sharp-limiet:"
  grep -nE "sharp\.(cache|concurrency)" src/scanner.js 2>/dev/null || echo "  ⚠️  GEEN sharp-limiet"

  # ── 9. Database & laatste scans ────────────────────────────────────────────
  sectie "9. DATABASE & LAATSTE SCANS"
  DB="fotoapp.db"
  [ -f "$DB" ] || DB="fotos.db"
  if [ -f "$DB" ]; then
    echo "DB-bestand: $DB ($(du -h "$DB" | cut -f1))"
    if command -v sqlite3 >/dev/null 2>&1; then
      echo "Aantal foto's : $(sqlite3 "$DB" 'SELECT COUNT(*) FROM fotos' 2>/dev/null)"
      echo "Aantal video's: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM fotos WHERE is_video=1' 2>/dev/null)"
      echo ""
      echo "Laatste 5 scans (scan_log):"
      sqlite3 -header -column "$DB" \
        "SELECT id,bron_id,gestart,voltooid,totaal,nieuw,fouten,status FROM scan_log ORDER BY id DESC LIMIT 5" 2>/dev/null
    else
      echo "  (sqlite3 niet geïnstalleerd — DB-details overgeslagen)"
    fi
  else
    echo "  (geen database in projectmap; staat bij de desktop-app mogelijk in userData)"
  fi

  sectie "KLAAR"
}

# Output zowel naar scherm als naar het logbestand (POSIX-veilig, geen >(...) ).
verzamel 2>&1 | tee "$LOG"

echo ""
echo "✅ Diagnose opgeslagen in:"
echo "   $LOG"
echo ""
echo "Stuur dit bestand naar Claude."
