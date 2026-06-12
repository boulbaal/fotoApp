#!/bin/bash

# Script 01: GitHub Download Statistieken
# Haalt release stats op via GitHub API

GH_TOKEN="${GH_TOKEN:-$(cd $(git rev-parse --show-toplevel) && git config user.token 2>/dev/null)}"
OWNER="boulbaal"
REPO="fotoApp"

echo "📊 GitHub Release Statistieken"
echo "================================"
echo ""

curl -s \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO/releases" | \
python3 -c "
import sys, json
from datetime import datetime

releases = json.load(sys.stdin)
if not releases:
    print('Geen releases gevonden.')
    sys.exit(0)

total_all = 0
for r in releases:
    pub = r.get('published_at','?')[:10]
    print(f\"Release: {r['tag_name']} — {r['name']}\")
    print(f\"  Gepubliceerd: {pub}\")
    print(f\"  Pre-release:  {r['prerelease']}\")
    print(f\"  Draft:        {r['draft']}\")
    total = 0
    for a in r.get('assets', []):
        print(f\"  📦 {a['name']}\")
        print(f\"     Downloads:  {a['download_count']}\")
        print(f\"     Grootte:    {a['size'] // 1024 // 1024} MB\")
        total += a['download_count']
    print(f\"  ─────────────────────────────\")
    print(f\"  TOTAAL: {total} downloads\")
    total_all += total
    print()

print(f\"TOTAAL ALLE RELEASES: {total_all} downloads\")
"

echo ""
echo "✅ Stats opgehaald op $(date '+%Y-%m-%d %H:%M:%S')"
