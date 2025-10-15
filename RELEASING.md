# How to Release

## Creating a GitHub Release with DMG

### Step 1: Build the Application

```bash
./build.sh
# Or manually:
npm run build
npm run build:electron
```

This creates: `dist/Local Versioning-1.0.0-arm64.dmg`

### Step 2: Create Release on GitHub

1. Go to: `https://github.com/YOUR_USERNAME/local-versioning/releases/new`

2. Fill in:
   - **Tag**: `v1.0.0` (create new tag)
   - **Title**: `Local Versioning v1.0.0`
   - **Description**: See template below

3. **Attach DMG**:
   - Click "Attach binaries"
   - Upload `dist/Local Versioning-1.0.0-arm64.dmg`

4. Click **"Publish release"**

### Release Description Template

```markdown
Mac desktop application for automatic file versioning with Git-based tracking.

## Installation

1. Download the DMG file below
2. Open it and drag "Local Versioning" to Applications
3. Launch from Applications or Spotlight

## Features

- Automatic file change detection and versioning
- Visual diff viewer and file restoration
- In-app Markdown editor
- System tray integration
- Multiple folder tracking

## Requirements

- macOS 10.12+ (Apple Silicon optimized)
- Git installed (pre-installed on macOS)
```

### Using GitHub CLI (Optional)

If you have [GitHub CLI](https://cli.github.com/) installed:

```bash
gh release create v1.0.0 \
  dist/*.dmg \
  --title "Local Versioning v1.0.0" \
  --notes "First stable release with all core features"
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- `v1.0.0` - First stable release
- `v1.1.0` - New features
- `v1.0.1` - Bug fixes

## Pre-release

For beta/testing versions, mark as "pre-release" on GitHub:
- `v1.0.0-beta.1`
- `v1.0.0-rc.1`

