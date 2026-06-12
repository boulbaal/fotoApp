#!/bin/bash

# Script 03: Artikel posten op dev.to

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CREDS="$SCRIPT_DIR/output/.devto_credentials"

if [ ! -f "$CREDS" ]; then
    echo "❌ Geen credentials gevonden. Run eerst: bash scripts/02_devto_setup.sh"
    exit 1
fi

source "$CREDS"

echo "📝 Artikel posten op dev.to..."
echo ""

ARTICLE_BODY=$(cat <<'MARKDOWN'
I had 27,000+ photos scattered across a Linux PC, external SSD, and multiple USB sticks. Every existing solution either required cloud access, a subscription, or was too complex for non-technical family members to use.

So I built **FotoApp** — a free, open-source local photo organizer.

## What it does

- **Scan folders recursively** — finds all photos and videos (JPG, PNG, RAW, MP4, MKV, MOV...)
- **Detect duplicates** by MD5 hash — shows groups, lets you mark which to keep
- **GPS map view** — photos pinned on a Leaflet map, with automatic reverse geocoding via Nominatim (no API key, no data sent to Google)
- **Smart export** — filenames like `Belgium_Brussels_12_06_2026.jpg`, organized into `year/month` folders
- **Google Takeout support** — reads the `.jpg.json` sidecar files for date and GPS fallback
- **Dashboard** — stats by year, camera model, country (with flag emoji 🌍), and source folder
- **Video support** — thumbnails, metadata, duration shown alongside photos
- **Multi-language UI** — switch between NL / EN / FR / DE in the app header

## Tech stack

| Layer | Tech |
|---|---|
| Desktop wrapper | Electron |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Image processing | sharp + exifr |
| Maps | Leaflet + Nominatim |
| Frontend | Vanilla JS (no framework) |

No framework overhead, no build step. Just open and it works.

## Privacy first

Everything runs **locally**. No cloud upload, no account required, no telemetry. The only external call is to Nominatim for reverse geocoding (OpenStreetMap), and that can be disabled.

## Download

**Windows installer ready.** Mac and Linux builds are automated via GitHub Actions.

→ [Download from GitHub Releases](https://github.com/boulbaal/fotoApp/releases/latest)
→ [Landing page (NL/EN/FR/DE)](https://boulbaal.github.io/fotoApp/)
→ [Source code](https://github.com/boulbaal/fotoApp)

## Contributing

The project is open to contributions with my approval. If you have a feature idea, bug report, or want to help with translations — open an issue or PR.

Feedback especially welcome from people with large photo collections (10k+ photos).
MARKDOWN
)

PAYLOAD=$(python3 -c "
import json, sys

body = sys.stdin.read()
article = {
    'article': {
        'title': 'I built a free open-source photo organizer for 27,000+ photos (no cloud, no subscription)',
        'published': True,
        'body_markdown': body,
        'tags': ['opensource', 'photography', 'electron', 'nodejs'],
        'canonical_url': 'https://boulbaal.github.io/fotoApp/'
    }
}
print(json.dumps(article))
" <<< "$ARTICLE_BODY")

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "api-key: $DEVTO_API_KEY" \
  -d "$PAYLOAD" \
  "https://dev.to/api/articles")

URL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url', 'FOUT'))" 2>/dev/null)

if echo "$URL" | grep -q "dev.to"; then
    echo "✅ Artikel gepubliceerd!"
    echo "   URL: $URL"
    echo ""
    echo "Sla deze URL op — Claude zal hem nodig hebben voor volgende stappen."
    echo "DEVTO_URL=$URL" >> "$SCRIPT_DIR/output/.devto_credentials"
else
    echo "❌ Fout bij publiceren:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
