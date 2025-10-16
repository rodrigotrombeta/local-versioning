# Building Local Versioning Application

## Prerequisites

Before building, you need:

**Git**
```bash
git --version
# If not installed: brew install git
```

**Node.js 18+** and **npm**
```bash
node --version
npm --version
# If not installed: brew install node
```

## Build Steps

### 1. Install Dependencies

```bash
cd /Users/rodrigot/Documents/GitHub/local_versioning
npm install
```

### 2. Build the Application

```bash
npm run build
npm run build:electron
```

This creates:
- `dist/Local Versioning-1.0.0-arm64.dmg` - Installer (96 MB)
- `dist/mac-arm64/Local Versioning.app` - Application bundle (258 MB)

Build time: Approximately 1-2 minutes

## Installation

### Option 1: Use the DMG (Recommended)

1. Open `dist/Local Versioning-1.0.0-arm64.dmg`
2. Drag "Local Versioning" to your Applications folder
3. Launch from Applications or Spotlight (Cmd+Space)

### Option 2: Direct Use

Copy `dist/mac-arm64/Local Versioning.app` to your Applications folder

## Running the Application

Launch the app from:
- Applications folder
- Spotlight: Press Cmd+Space, type "Local Versioning"
- Dock (if added)

The application will:
- Start in the background with a system tray icon in the menu bar
- Begin watching any previously configured folders
- Show the main window (can be hidden with Cmd+W)

### System Tray

The menu bar icon provides quick access:
- **Click**: Toggle window visibility
- **Right-click menu**:
  - **Abrir**: Show the window
  - **Quit**: Close the application completely

## Troubleshooting

### "App is damaged and can't be opened"

This error appears when downloading the app from GitHub because it's not signed with an Apple Developer certificate ($99/year).

**Fix:** Remove the quarantine flag by running in Terminal:

```bash
xattr -d com.apple.quarantine "/Applications/Local Versioning.app"
```

After this, the app will open normally.

### "App can't be opened because it's from an unidentified developer"

If you see this instead (less common), use one of these methods:

**Option 1:** Right-click the app → select "Open" → Click "Open" in the confirmation dialog

**Option 2:** System Preferences → Security & Privacy → General → Click "Open Anyway"

### Permission Issues

The app may request permissions for:
- **Files and Folders**: Required to watch and version your files
- **Full Disk Access**: Only if watching system folders

Grant these in System Preferences → Security & Privacy → Privacy

### Git Not Found

If the app shows Git-related errors:

```bash
# Check Git installation
which git
git --version

# Install if needed
brew install git
```

## Updating the Application

When you make code changes:

1. Rebuild:
   ```bash
   npm run build
   npm run build:electron
   ```

2. Replace the old app with the new one in Applications

3. Your settings are preserved in `~/.local-versioning/`

## Distribution

### Via GitHub Releases

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag version (e.g., `v1.0.0`)
4. Upload `dist/Local Versioning-1.0.0-arm64.dmg`
5. Publish the release

Users can then download the DMG directly from GitHub.

### Code Signing (Optional)

To avoid the "damaged app" error for users, you need an Apple Developer account ($99/year) and a "Developer ID Application" certificate.

**With a certificate:**

1. Get your signing identity:
   ```bash
   security find-identity -v -p codesigning
   ```

2. Update `package.json` to include your identity:
   ```json
   "build": {
     "mac": {
       "identity": "Developer ID Application: Your Name (TEAM_ID)"
     }
   }
   ```

3. Build normally - electron-builder will sign automatically

**Notarization (for full distribution):**

Notarization requires additional Apple credentials and is beyond the scope of this guide. See [electron-builder docs](https://www.electron.build/code-signing) for details.

## Development Mode

For testing without building:

```bash
npm run dev
```

This runs the app with hot-reload for faster development.

Note: In development mode, the Electron icon appears in the Dock instead of your custom icon.

