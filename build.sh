#!/bin/bash

echo "🔨 Building Local Versioning Application..."
echo ""

# Build the application
echo "Step 1: Building React app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ React build failed"
    exit 1
fi

echo "✅ React app built successfully"
echo ""

# Build Electron app
echo "Step 2: Creating Mac application..."
npm run build:electron

if [ $? -ne 0 ]; then
    echo "❌ Electron build failed"
    exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Your application is ready:"
echo "   - DMG installer: dist/Local Versioning-1.0.0.dmg"
echo "   - App bundle: dist/mac/Local Versioning.app"
echo ""
echo "To install:"
echo "   1. Open the DMG file"
echo "   2. Drag 'Local Versioning' to Applications"
echo "   3. Launch from Applications or Spotlight"
echo ""

