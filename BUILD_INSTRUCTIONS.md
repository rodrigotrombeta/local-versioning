# Building Local Versioning Application

## Creating a Standalone Mac Application

### One-Time Build Process

Run these commands to create the distributable application:

```bash
cd /Users/rodrigot/Documents/GitHub/local_versioning

# Build the production version
npm run build
npm run build:electron
```

This will create:
- A `.dmg` file in the `dist` folder
- A standalone `.app` file that you can drag to your Applications folder

### What Gets Created

After building, you'll find in the `dist` folder:
- `Local Versioning.app` - The application bundle
- `Local Versioning-1.0.0.dmg` - Installer disk image

### Installing the Application

**Option 1: Use the DMG (Recommended)**
1. Open `dist/Local Versioning-1.0.0.dmg`
2. Drag "Local Versioning" to the Applications folder
3. Open from Applications or Spotlight (Cmd+Space, type "Local Versioning")

**Option 2: Direct Use**
1. Copy `dist/mac/Local Versioning.app` to your Applications folder
2. Open from Applications or Spotlight

### Running the Application

Once installed:
- Open from Applications folder
- Or use Spotlight: Press Cmd+Space, type "Local Versioning"
- Or add to Dock for quick access

The application will:
- Start automatically watching your configured folders
- Run in the background
- Show icon in the menu bar (future feature) or appear when clicked

### Troubleshooting

**"App can't be opened because it's from an unidentified developer"**

This is macOS Gatekeeper. To open:
1. Right-click the app and select "Open"
2. Click "Open" in the dialog
3. Or go to System Preferences > Security & Privacy > General and click "Open Anyway"

**Permission Issues**

If the app asks for folder access:
- Grant "Files and Folders" permission in System Preferences
- This allows the app to watch and version your files

### Updating the Application

When you make changes to the code:
1. Run `npm run build` and `npm run build:electron` again
2. Replace the old app with the new one
3. Your watched folders and settings are preserved (stored in ~/.local-versioning/)

### Auto-Update (Future Enhancement)

For production use, you could add electron-updater to automatically check for and install updates.

