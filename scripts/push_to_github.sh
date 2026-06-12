#!/bin/bash
# Push lokale wijzigingen naar GitHub (force push)
# Run dit in de fotoApp map: bash scripts/push_to_github.sh

cd "$(dirname "$0")/.."

echo "📤 Push naar GitHub..."
echo ""

git push origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Gepusht!"
    echo "   GitHub: https://github.com/boulbaal/fotoApp"
    echo "   Landing: https://boulbaal.github.io/fotoApp/"
else
    echo ""
    echo "❌ Push mislukt. Controleer je verbinding."
fi
