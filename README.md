# Local Versioning

A Mac desktop application that automatically tracks file changes and maintains version history using Git, similar to Time Machine functionality.

## Features

- Automatic file change detection and versioning
- Two commit strategies: On-save (immediate) or Periodic (scheduled)
- Visual diff viewer to compare any two versions
- Simple file restoration to previous versions
- In-app file editing with live Markdown preview
- Clean, modern UI built with Electron and React
- Customizable ignore patterns for files and folders
- Multiple folder tracking support
- Runs in background with system tray icon (macOS menu bar)
- Custom Git repository location support

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | Electron + TypeScript |
| UI | React + Tailwind CSS |
| File Watching | Chokidar |
| Version Control | Git (via simple-git) |
| Diff Display | react-diff-viewer-continued |

## Installation

### Prerequisites

- Node.js 18+ and npm (for development only)
- **Git installed on your system** (required for the app to function)
- macOS (optimized for Mac, but can work on other platforms)

**Note:** Git comes pre-installed on macOS 10.9 and later. If you need to install or update Git, use:
```bash
# Check if Git is installed
git --version

# Install/update Git via Homebrew (if needed)
brew install git
```

### Setup

**For Development:**
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

**To Create a Standalone Application:**
```bash
# Make the build script executable (first time only)
chmod +x build.sh

# Build the application
./build.sh

# Or manually:
npm run build
npm run build:electron
```

After building, you'll find:
- `dist/Local Versioning-1.0.0.dmg` - Installer (double-click to install)
- `dist/mac/Local Versioning.app` - The application itself

**To Install:**
1. Open the `.dmg` file
2. Drag "Local Versioning" to your Applications folder
3. Launch from Applications or Spotlight (Cmd+Space)

## Usage

### Adding a Folder to Watch

1. Click the "Add Folder" button in the left sidebar
2. Select the folder you want to track
3. The folder will immediately start being watched

### Viewing Version History

1. Select a folder from the left sidebar
2. The center panel shows all commits (versions) in chronological order
3. Click on any commit to see which files were changed

### Comparing Versions

1. Select a commit to view its changed files
2. Click on a file to see the diff between that version and the current version
3. Optionally, click "Compare" on another commit to compare two historical versions

### Restoring Files

1. Select a commit
2. Click on a file to view the diff
3. Click the "Restore" button to restore the file to that version
4. Confirm the restoration

### Configuring Settings

1. Click the settings icon in the top-left corner
2. Select a folder to configure
3. Choose commit strategy:
   - **On Save**: Commits changes 2 seconds after file modifications
   - **Periodic**: Commits at regular intervals (configurable, default 5 minutes)
4. Add custom ignore patterns (glob format)
5. Optionally specify a custom location for Git repositories
6. Save changes

### Background Mode

The application runs in the background with a system tray icon in your macOS menu bar:

- **Closing the window** (⌘+W) hides it but keeps the app running
- **System tray menu** provides:
  - **Abrir**: Show/hide the window
  - **Quit**: Completely close the application
- **File watching continues** even when the window is closed
- **Click the tray icon** to quickly toggle window visibility

To completely quit the application, use the tray menu's "Quit" option or press ⌘+Q.

## Configuration

The application stores its configuration in `~/.local-versioning/`:
- `config.json`: Application settings and watched folders
- `repos/`: Git repositories for each watched folder

## Default Ignore Patterns

The following patterns are ignored by default:
- `**/node_modules/**`
- `**/.git/**`
- `**/.DS_Store`
- `**/*.tmp`
- `**/*.log`

You can add custom patterns in the settings panel.

## How It Works

### Git and Diff Binaries

**Important:** This application does **not bundle** Git or diff binaries. Instead, it uses your Mac's system-installed Git.

| Component | Location | Notes |
|-----------|----------|-------|
| Git Binary | `/usr/bin/git` or `/usr/local/bin/git` | Must be installed on your system |
| Diff Functionality | Part of Git (`git diff`, `git show`) | No separate binary needed |
| simple-git Library | `node_modules/simple-git/` | Node.js wrapper that calls system Git |
| react-diff-viewer | `node_modules/react-diff-viewer-continued/` | JavaScript library for visual rendering only |

**What this means:**
- The application requires Git to be installed on your Mac (comes pre-installed on macOS 10.9+)
- Git must be accessible in your system PATH
- The `simple-git` library executes your system's `git` command, not a bundled version
- When you build the standalone app, it does NOT include Git - users need it installed

**To verify Git is available:**
```bash
which git
# Output: /usr/bin/git or /usr/local/bin/git

git --version
# Output: git version 2.x.x (or higher)
```

If Git is not found, the application will show errors when attempting to version files.

### Version Storage

Each watched folder gets its own Git repository stored in `~/.local-versioning/repos/[folder-hash]/`. The application uses Git's native capabilities to:
- Track all file changes
- Store complete version history
- Generate diffs between versions
- Restore files to previous states

### File Watching

The application uses Chokidar to monitor file system changes in real-time. When changes are detected:
1. Files are added to a pending changes queue
2. Changes are debounced (on-save mode) or batched (periodic mode)
3. Git commits are created with timestamp and changed file information
4. The UI is updated to reflect new versions

### Commit Format

Auto-commits follow this format:
```
Auto-commit: YYYY-MM-DD HH:MM:SS - [file1.txt, file2.js, ...]
```

## Architecture

```
local-versioning/
├── electron/              # Electron main process
│   ├── main.ts           # App entry point and IPC handlers
│   ├── preload.ts        # Context bridge for secure IPC
│   └── services/
│       ├── GitService.ts      # Git operations wrapper
│       ├── FileWatcher.ts     # File system monitoring
│       └── ConfigService.ts   # Configuration management
├── src/                  # React renderer process
│   ├── App.tsx          # Main application component
│   ├── components/      # UI components
│   └── types/           # TypeScript definitions
└── public/              # Static assets
```

## Development

### Running in Development

```bash
npm run dev
```

This starts both the Vite dev server (for React) and Electron in development mode with hot reload.

### Building for Production

```bash
npm run build
npm run build:electron
```

The distributable will be created in the `dist` folder.

## Troubleshooting

### Git Errors

**"git: command not found" or similar errors:**

The application requires Git to be installed on your system. It does NOT bundle Git.

To fix:
1. Check if Git is installed: `git --version`
2. If not installed, install via Homebrew: `brew install git`
3. Ensure Git is in your PATH (should be automatic)
4. Restart the application

**Other Git-related errors:**
- Ensure you have read/write permissions for the watched folders
- The watched folders should not be inside another Git repository
- Check that the folder is not on a network drive or external volume with permission issues

### Performance Issues

If the application feels slow with large folders:
- Add more patterns to the ignore list
- Use periodic commits instead of on-save for folders with frequent changes
- Consider watching specific subdirectories instead of large root directories

### File System Permissions

macOS may require additional permissions to watch certain folders. Grant the application access when prompted in System Preferences.

## Comparison with Time Machine

| Feature | Local Versioning | Time Machine |
|---------|-----------------|--------------|
| Automatic backups | Yes | Yes |
| Version browsing | Yes | Yes |
| File restoration | Yes | Yes |
| Visual diffs | Yes | No |
| Folder-specific | Yes | System-wide |
| Storage | Git-based | Snapshot-based |
| Requires external drive | No | Usually yes |

## License

MIT

## Contributing

Contributions are welcome. Please ensure:
- Code follows TypeScript best practices
- Components are properly typed
- New features include appropriate documentation

