#!/bin/bash

# Script para criar release no GitHub
# Uso: ./release.sh v1.0.0 "Release message"

VERSION=$1
MESSAGE=$2

if [ -z "$VERSION" ] || [ -z "$MESSAGE" ]; then
    echo "Uso: ./release.sh v1.0.0 \"Release message\""
    exit 1
fi

echo "🏗️  Building application..."
npm run build
npm run build:electron

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed!"
echo ""
echo "📦 DMG location: dist/Local Versioning-1.0.0-arm64.dmg"
echo ""
echo "🚀 Next steps:"
echo "1. Commit and push your changes:"
echo "   git add ."
echo "   git commit -m \"Release $VERSION\""
echo "   git push"
echo ""
echo "2. Create release on GitHub:"
echo "   - Go to: https://github.com/YOUR_USERNAME/local-versioning/releases/new"
echo "   - Tag: $VERSION"
echo "   - Title: Local Versioning $VERSION"
echo "   - Description: $MESSAGE"
echo "   - Upload: dist/Local Versioning-1.0.0-arm64.dmg"
echo ""
echo "3. Or use GitHub CLI (if installed):"
echo "   gh release create $VERSION dist/*.dmg --title \"Local Versioning $VERSION\" --notes \"$MESSAGE\""

