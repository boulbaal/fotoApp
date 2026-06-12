#!/bin/bash

# Script 04: Reddit API Setup + Posten in r/selfhosted
#
# VOORDAT JE DIT RUNT:
# 1. Maak een Reddit account aan op https://reddit.com
#    (gebruik je ProtonMail adres)
# 2. Ga naar https://www.reddit.com/prefs/apps
# 3. Klik "create another app..."
# 4. Vul in:
#    - name: FotoApp
#    - type: script
#    - redirect uri: http://localhost:8080
# 5. Klik "create app"
# 6. Noteer: client_id (korte string onder "personal use script")
#             client_secret (naast "secret")
# 7. Plak hieronder:

REDDIT_CLIENT_ID=""       # ← client_id (bv: abc123XYZ)
REDDIT_CLIENT_SECRET=""   # ← client_secret
REDDIT_USERNAME=""        # ← jouw Reddit gebruikersnaam
REDDIT_PASSWORD=""        # ← jouw Reddit wachtwoord

# ─────────────────────────────────────────

if [ -z "$REDDIT_CLIENT_ID" ] || [ -z "$REDDIT_USERNAME" ]; then
    echo "❌ Vul eerst de Reddit credentials in dit script in."
    echo ""
    echo "Stappen:"
    echo "  1. Maak Reddit account op https://reddit.com"
    echo "     (gebruik ProtonMail adres)"
    echo "  2. Ga naar https://www.reddit.com/prefs/apps"
    echo "  3. Klik 'create another app...'"
    echo "  4. Type: script, redirect: http://localhost:8080"
    echo "  5. Noteer client_id en client_secret"
    echo "  6. Vul in dit script en run opnieuw"
    exit 1
fi

echo "🔑 Reddit token ophalen..."

# OAuth token ophalen
TOKEN_RESPONSE=$(curl -s -X POST \
  -u "$REDDIT_CLIENT_ID:$REDDIT_CLIENT_SECRET" \
  -d "grant_type=password&username=$REDDIT_USERNAME&password=$REDDIT_PASSWORD" \
  -A "FotoApp:v1.0 (by /u/$REDDIT_USERNAME)" \
  "https://www.reddit.com/api/v1/access_token")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('access_token','FOUT'))
" 2>/dev/null)

if [ "$ACCESS_TOKEN" = "FOUT" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Token ophalen mislukt:"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Token verkregen"
echo ""
echo "📝 Post indienen bij r/selfhosted..."

POST_RESPONSE=$(curl -s -X POST \
  -H "Authorization: bearer $ACCESS_TOKEN" \
  -H "User-Agent: FotoApp:v1.0 (by /u/$REDDIT_USERNAME)" \
  -d "sr=selfhosted&kind=self&title=FotoApp – free %26 open source local photo organizer (no cloud, no subscription)&text=I built FotoApp for my own 27%2C000%2B photo collection scattered across drives and USB sticks.%0A%0AIt runs locally on Windows%2C Mac and Linux. No cloud upload%2C no account%2C no subscription.%0A%0A**Features:**%0A%E2%80%A2 Auto-scan folders%2C detect duplicates by MD5%0A%E2%80%A2 GPS map view with reverse geocoding (Nominatim%2C no API key)%0A%E2%80%A2 Export with smart filenames%3A Country_City_dd_mm_yyyy.jpg%0A%E2%80%A2 Video support (MP4%2C MKV%2C MOV...)%0A%E2%80%A2 Supports Google Takeout exports%0A%E2%80%A2 Dashboard with stats per year%2C camera%2C country %F0%9F%8C%8D%0A%0A**Download%3A** https%3A%2F%2Fgithub.com%2Fboulbaal%2FfotoApp%2Freleases%2Flatest%0A**Landing page%3A** https%3A%2F%2Fboulbaal.github.io%2FfotoApp%2F%0A%0AWindows installer ready. Mac%2FLinux via GitHub Actions. Feedback welcome!" \
  "https://oauth.reddit.com/api/submit")

POST_URL=$(echo "$POST_RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
try:
    url = d['jquery'][10][3][0]
    print(url)
except:
    print('FOUT')
    print(json.dumps(d, indent=2), file=sys.stderr)
" 2>/dev/null)

if echo "$POST_URL" | grep -q "reddit.com"; then
    echo "✅ Post gepubliceerd!"
    echo "   URL: $POST_URL"
else
    echo "❌ Fout bij posten:"
    echo "$POST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POST_RESPONSE"
fi
