#!/bin/bash

# Script 02: dev.to API Setup Checker
#
# VOORDAT JE DIT RUNT:
# 1. Ga naar https://dev.to
# 2. Klik "Sign in" → "Sign in with GitHub" (account boulbaal)
# 3. Ga naar: https://dev.to/settings/extensions
# 4. Scroll naar "DEV Community API Keys"
# 5. Genereer een nieuwe key met naam "FotoApp"
# 6. Plak de key hieronder tussen de aanhalingstekens

DEVTO_API_KEY=""   # ← HIER je dev.to API key plakken

# ─────────────────────────────────────────

if [ -z "$DEVTO_API_KEY" ]; then
    echo "❌ Geen API key ingevuld!"
    echo ""
    echo "Stappen:"
    echo "  1. Ga naar https://dev.to"
    echo "  2. Sign in with GitHub (boulbaal)"
    echo "  3. Ga naar https://dev.to/settings/extensions"
    echo "  4. Genereer API key 'FotoApp'"
    echo "  5. Open dit script en plak de key na DEVTO_API_KEY=\"\""
    echo "  6. Run het script opnieuw"
    exit 1
fi

echo "🔑 API Key gevonden, verbinding testen..."
echo ""

RESULT=$(curl -s \
  -H "api-key: $DEVTO_API_KEY" \
  "https://dev.to/api/users/me")

USERNAME=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('username','FOUT'))" 2>/dev/null)

if [ "$USERNAME" = "FOUT" ] || [ -z "$USERNAME" ]; then
    echo "❌ API key werkt niet. Controleer of je de juiste key hebt gekopieerd."
    echo "Response: $RESULT"
    exit 1
fi

echo "✅ Verbonden als: @$USERNAME"
echo ""

# Sla de key op voor gebruik in script 03
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "DEVTO_API_KEY=$DEVTO_API_KEY" > "$SCRIPT_DIR/output/.devto_credentials"
echo "✅ Key opgeslagen voor gebruik in volgend script"
echo ""
echo "▶️  Volgende stap: bash scripts/03_devto_post.sh"
