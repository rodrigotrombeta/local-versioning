import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { GitService } from './services/GitService';
import { FileWatcher } from './services/FileWatcher';
import { ConfigService } from './services/ConfigService';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const configService = new ConfigService();
const gitServices = new Map<string, GitService>();
const fileWatchers = new Map<string, FileWatcher>();

function createWindow() {
  const config = configService.getConfig();
  
  mainWindow = new BrowserWindow({
    width: config.windowBounds?.width || 1200,
    height: config.windowBounds?.height || 800,
    x: config.windowBounds?.x,
    y: config.windowBounds?.y,
    show: false, // Don't show until ready
    backgroundColor: '#f9fafb', // Light gray background (matches app's bg-gray-50)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Local Versioning'
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Load the app
  const startUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, '../renderer/index.html')}`;
  
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(startUrl);
    // DevTools can be opened manually with Cmd+Option+I if needed
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Prevent window from closing, just hide it instead
  mainWindow.on('close', (event) => {
    if (mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Save window bounds when hiding
      const bounds = mainWindow.getBounds();
      configService.updateConfig({
        windowBounds: bounds
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  console.log('=== Creating System Tray ===');
  
  // Create tray icon - look for tray-specific icon first, then app icon
  let trayIcon: Electron.NativeImage | null = null;
  
  // Try multiple icon paths (both .png and .icns)
  const iconPaths = [
    // Development paths
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../../build/icon.png'),
    
    // Packaged app paths (extraResources puts files in Resources/)
    path.join(process.resourcesPath, 'icon.png'),
    path.join(process.resourcesPath, 'icon.icns'),
    path.join(process.resourcesPath, 'app/build/icon.png'),
    path.join(process.resourcesPath, 'build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png')
  ];
  
  console.log('Looking for tray icon in:');
  iconPaths.forEach(p => console.log('  -', p, '(exists:', fs.existsSync(p), ')'));
  
  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      console.log('✓ Using tray icon from:', iconPath);
      trayIcon = nativeImage.createFromPath(iconPath);
      
      // Resize to appropriate tray size (16x16 for macOS)
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
      
      // For macOS, mark as template image for automatic light/dark mode adaptation
      if (process.platform === 'darwin') {
        trayIcon.setTemplateImage(true);
      }
      break;
    }
  }
  
  if (!trayIcon || trayIcon.isEmpty()) {
    console.log('✗ No icon found, using emoji fallback');
    // Use emoji as fallback - works on macOS
    // Create a simple 16x16 PNG data URL with black square
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAA0SURBVDiNY2AYBaNgFGAFTAwUAGQ9////////f5BgFwzGDRgoSCMbMApGwShAE4wCmgAABV0C/0QOD2MAAAAASUVORK5CYII=';
    const buffer = Buffer.from(pngBase64, 'base64');
    trayIcon = nativeImage.createFromBuffer(buffer);
  }
  
  console.log('Creating Tray with icon...');
  tray = new Tray(trayIcon);
  tray.setToolTip('Local Versioning - Running in background');
  console.log('✓ Tray created successfully');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Show window when clicking tray icon (macOS behavior)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(() => {
  console.log('=== App Ready - Starting initialization ===');
  
  console.log('1. Creating window...');
  createWindow();
  
  console.log('2. Creating tray icon...');
  createTray();
  
  console.log('3. Starting watchers for active folders...');
  // Start watching folders that were active
  const folders = configService.getFolders();
  console.log('   Found', folders.length, 'folders');
  folders.forEach(folder => {
    if (folder.isActive) {
      console.log('   Starting watcher for:', folder.name);
      startWatchingFolder(folder.id);
    }
  });
  
  console.log('✓ Initialization complete');

  app.on('activate', () => {
    console.log('App activated (dock icon clicked)');
    // On macOS, show window when clicking dock icon
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

// Don't quit when all windows are closed (keep running in system tray)
app.on('window-all-closed', () => {
  // Keep app running in background with tray icon
  // Don't stop watchers, they should continue running
  // App will only quit when user clicks "Quit" in tray menu
});

// Clean up when app is actually quitting
app.on('before-quit', () => {
  console.log('App quitting, stopping all watchers...');
  
  // Stop all watchers
  fileWatchers.forEach((watcher, folderId) => {
    console.log(`Stopping watcher for folder: ${folderId}`);
    watcher.stop();
  });
  fileWatchers.clear();
  
  // Clean up tray
  if (tray) {
    tray.destroy();
  }
});

// IPC Handlers

// Folder management
ipcMain.handle('add-folder', async (_event, folderPath: string) => {
  const folder = configService.addFolder(folderPath);
  return folder;
});

ipcMain.handle('remove-folder', async (_event, folderId: string) => {
  // Stop watching if active
  const watcher = fileWatchers.get(folderId);
  if (watcher) {
    watcher.stop();
    fileWatchers.delete(folderId);
  }
  gitServices.delete(folderId);
  
  configService.removeFolder(folderId);
});

ipcMain.handle('get-folders', async () => {
  return configService.getFolders();
});

ipcMain.handle('update-folder', async (_event, folderId: string, updates: any) => {
  configService.updateFolder(folderId, updates);
  
  // If commit strategy changed and watcher is active, restart it
  if (updates.commitStrategy && fileWatchers.has(folderId)) {
    await stopWatchingFolder(folderId);
    await startWatchingFolder(folderId);
  }
});

// Git operations
ipcMain.handle('get-commits', async (_event, folderId: string, limit?: number) => {
  const gitService = getOrCreateGitService(folderId);
  return await gitService.getCommits(limit);
});

ipcMain.handle('get-file-content', async (_event, folderId: string, commitHash: string, filePath: string) => {
  const gitService = getOrCreateGitService(folderId);
  return await gitService.getFileContent(commitHash, filePath);
});

ipcMain.handle('get-diff', async (_event, folderId: string, filePath: string, oldCommit: string, newCommit?: string) => {
  const gitService = getOrCreateGitService(folderId);
  return await gitService.getDiff(filePath, oldCommit, newCommit);
});

ipcMain.handle('restore-file', async (_event, folderId: string, filePath: string, commitHash: string) => {
  const gitService = getOrCreateGitService(folderId);
  await gitService.restoreFile(filePath, commitHash);
});

// File watching
ipcMain.handle('start-watching', async (_event, folderId: string) => {
  await startWatchingFolder(folderId);
});

ipcMain.handle('stop-watching', async (_event, folderId: string) => {
  await stopWatchingFolder(folderId);
});

// Config
ipcMain.handle('get-config', async () => {
  return configService.getConfig();
});

ipcMain.handle('save-config', async (_event, config: any) => {
  configService.updateConfig(config);
});

// Dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

// File operations
ipcMain.handle('file-exists', async (_event, folderPath: string, filePath: string) => {
  const fullPath = path.join(folderPath, filePath);
  return fs.existsSync(fullPath);
});

// Save file content
ipcMain.handle('save-file', async (_event, folderPath: string, filePath: string, content: string) => {
  try {
    console.log('=== SAVE FILE DEBUG ===');
    console.log('folderPath:', folderPath);
    console.log('filePath:', filePath);
    console.log('content length:', content.length);
    
    const fullPath = path.join(folderPath, filePath);
    console.log('fullPath:', fullPath);
    console.log('File exists before save:', fs.existsSync(fullPath));
    
    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      console.log('Creating parent directory:', parentDir);
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    // Write file with UTF-8 encoding
    fs.writeFileSync(fullPath, content, 'utf8');
    
    // Verify the file was written
    const fileExists = fs.existsSync(fullPath);
    const fileSize = fileExists ? fs.statSync(fullPath).size : 0;
    console.log('File exists after save:', fileExists);
    console.log('File size after save:', fileSize);
    
    // Read back to verify
    const savedContent = fs.readFileSync(fullPath, 'utf8');
    console.log('Content matches:', savedContent === content);
    console.log('=== END SAVE FILE DEBUG ===');
    
    return { success: true };
  } catch (error) {
    console.error('Error saving file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Create new file
ipcMain.handle('create-file', async (_event, folderPath: string, fileName: string) => {
  try {
    console.log('Creating new file:', fileName, 'in folder:', folderPath);
    
    const fullPath = path.join(folderPath, fileName);
    
    // Check if file already exists
    if (fs.existsSync(fullPath)) {
      return { 
        success: false, 
        error: 'File already exists' 
      };
    }
    
    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    // Create empty file
    fs.writeFileSync(fullPath, '', 'utf8');
    
    console.log('File created successfully:', fullPath);
    return { success: true };
  } catch (error) {
    console.error('Error creating file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// List all files in a folder recursively
ipcMain.handle('list-folder-files', async (_event, folderPath: string) => {
  try {
    const files: string[] = [];
    
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      '.tmp',
      '.log',
      'dist',
      'build',
      '.next',
      '.cache'
    ];
    
    function shouldIgnore(fileName: string): boolean {
      return ignorePatterns.some(pattern => fileName.includes(pattern));
    }
    
    function walkDir(dir: string, baseDir: string = dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (shouldIgnore(entry.name) || shouldIgnore(relativePath)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            walkDir(fullPath, baseDir);
          } else if (entry.isFile()) {
            files.push(relativePath);
          }
        }
      } catch (err) {
        console.warn('Error reading directory:', dir, err);
      }
    }
    
    if (fs.existsSync(folderPath)) {
      walkDir(folderPath);
    }
    
    return files.sort();
  } catch (error) {
    console.error('Error listing folder files:', error);
    return [];
  }
});

// Detect existing Git repository for a folder
ipcMain.handle('detect-existing-git-repository', async (_event, folderPath: string, folderName: string) => {
  console.log(`Detecting existing Git repository for: ${folderPath}`);
  
  try {
    // Get default custom path from config if it exists
    const config = configService.getConfig();
    const defaultCustomPath = config.defaultCustomGitPath;
    
    // Check locations in order of priority:
    const locationsToCheck: string[] = [
      // 1. Inside the folder itself
      path.join(folderPath, '.git'),
    ];
    
    // 2. In default custom location if configured
    if (defaultCustomPath) {
      locationsToCheck.push(path.join(defaultCustomPath, `${folderName}-git`));
    }
    
    // 3. Common custom locations (user might have used before)
    const homeDir = require('os').homedir();
    locationsToCheck.push(
      path.join(homeDir, 'LocalVersioning', `${folderName}-git`),
      path.join(homeDir, '.local-versioning', 'repos', `${folderName}-git`),
      path.join(homeDir, 'Documents', 'LocalVersioning', `${folderName}-git`)
    );
    
    console.log('Checking locations:', locationsToCheck);
    
    for (const gitPath of locationsToCheck) {
      console.log(`Checking: ${gitPath}`);
      
      // Check if path exists and is a directory
      if (fs.existsSync(gitPath)) {
        const stats = fs.statSync(gitPath);
        if (!stats.isDirectory()) continue;
        
        // Verify it's a valid Git repository by checking for required files/dirs
        const hasObjects = fs.existsSync(path.join(gitPath, 'objects'));
        const hasRefs = fs.existsSync(path.join(gitPath, 'refs'));
        const hasHead = fs.existsSync(path.join(gitPath, 'HEAD'));
        
        if (hasObjects && hasRefs && hasHead) {
          console.log(`Found valid Git repository at: ${gitPath}`);
          
          // Try to count commits
          let commitCount = 0;
          try {
            const git = simpleGit({ baseDir: folderPath });
            
            // Configure git to use the found repository
            if (gitPath !== path.join(folderPath, '.git')) {
              // It's a separate git dir, need to set it up properly
              await git.raw(['--git-dir', gitPath, '--work-tree', folderPath, 'rev-list', '--count', 'HEAD'])
                .then(result => {
                  commitCount = parseInt(result.trim(), 10);
                })
                .catch(() => {
                  commitCount = 0;
                });
            } else {
              // Standard .git inside folder
              const log = await git.log();
              commitCount = log.total;
            }
          } catch (error) {
            console.log('Could not count commits:', error);
            commitCount = 0;
          }
          
          return {
            found: true,
            gitPath,
            commitCount
          };
        }
      }
    }
    
    console.log('No existing Git repository found');
    return { found: false };
  } catch (error) {
    console.error('Error detecting Git repository:', error);
    return { found: false };
  }
});

// Git repository migration
ipcMain.handle('migrate-git-repository', async (_event, folderId: string, newGitPath: string) => {
  console.log(`Migration requested for folder ${folderId} to ${newGitPath}`);
  
  try {
    const folder = configService.getFolder(folderId);
    if (!folder) {
      return { success: false, error: 'Folder not found' };
    }
    
    // Stop watching during migration
    await stopWatchingFolder(folderId);
    
    const oldGitPath = folder.customGitPath || path.join(folder.path, '.git');
    
    console.log(`Old .git location: ${oldGitPath}`);
    console.log(`New .git location: ${newGitPath}`);
    
    // Check if old and new are the same (no migration needed)
    if (oldGitPath === newGitPath) {
      console.log('Old and new paths are the same, no migration needed');
      await startWatchingFolder(folderId);
      return { success: true };
    }
    
    // Check if old .git exists
    if (!fs.existsSync(oldGitPath)) {
      console.error(`Old Git path does not exist: ${oldGitPath}`);
      
      // Check if the target location already has a Git repo (maybe already migrated?)
      if (fs.existsSync(newGitPath)) {
        console.log('Target location already has a Git repository, updating config only');
        // Determine the new customGitPath value
        const defaultGitPath = path.join(folder.path, '.git');
        const newCustomGitPath = newGitPath === defaultGitPath ? undefined : newGitPath;
        configService.updateFolder(folderId, { customGitPath: newCustomGitPath });
        gitServices.delete(folderId);
        await startWatchingFolder(folderId);
        return { success: true };
      }
      
      await startWatchingFolder(folderId);
      return { success: false, error: `No Git repository found at ${oldGitPath}` };
    }
    
    // Create parent directory for new Git path
    const parentDir = path.dirname(newGitPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    // Check if target already exists
    if (fs.existsSync(newGitPath)) {
      console.log('Target location already exists, comparing repositories...');
      
      try {
        // Get last commit date from source (old location)
        const gitOld = simpleGit({ baseDir: folder.path });
        let oldLastCommit: Date | null = null;
        try {
          if (oldGitPath !== path.join(folder.path, '.git')) {
            await gitOld.raw(['--git-dir', oldGitPath, '--work-tree', folder.path, 'log', '-1', '--format=%ai'])
              .then(result => {
                if (result.trim()) {
                  oldLastCommit = new Date(result.trim());
                }
              });
          } else {
            const log = await gitOld.log({ maxCount: 1 });
            if (log.latest) {
              oldLastCommit = new Date(log.latest.date);
            }
          }
        } catch (error) {
          console.log('Could not get last commit from source:', error);
        }
        
        // Get last commit date from target (new location)
        const gitNew = simpleGit({ baseDir: folder.path });
        let newLastCommit: Date | null = null;
        try {
          if (newGitPath !== path.join(folder.path, '.git')) {
            await gitNew.raw(['--git-dir', newGitPath, '--work-tree', folder.path, 'log', '-1', '--format=%ai'])
              .then(result => {
                if (result.trim()) {
                  newLastCommit = new Date(result.trim());
                }
              });
          } else {
            const log = await gitNew.log({ maxCount: 1 });
            if (log.latest) {
              newLastCommit = new Date(log.latest.date);
            }
          }
        } catch (error) {
          console.log('Could not get last commit from target:', error);
        }
        
        console.log('Source last commit:', oldLastCommit);
        console.log('Target last commit:', newLastCommit);
        
        // Determine which one to keep
        let shouldReplaceTarget = false;
        
        if (!newLastCommit) {
          // Target has no commits, replace it
          shouldReplaceTarget = true;
          console.log('Target has no commits, will replace');
        } else if (!oldLastCommit) {
          // Source has no commits, keep target
          shouldReplaceTarget = false;
          console.log('Source has no commits, keeping target');
        } else if (oldLastCommit > newLastCommit) {
          // Source is newer, replace target
          shouldReplaceTarget = true;
          console.log('Source is newer, will replace target');
        } else {
          // Target is newer or same, keep it
          shouldReplaceTarget = false;
          console.log('Target is newer or same, keeping target');
        }
        
        if (shouldReplaceTarget) {
          // Backup existing target with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const backupPath = `${newGitPath}-backup-${timestamp}`;
          
          console.log(`Backing up existing target to: ${backupPath}`);
          fs.renameSync(newGitPath, backupPath);
          
          // Now move source to target
          console.log(`Moving ${oldGitPath} to ${newGitPath}`);
          fs.renameSync(oldGitPath, newGitPath);
          
          console.log(`Migration complete. Old target backed up to: ${backupPath}`);
        } else {
          // Keep target, backup source
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const backupPath = `${oldGitPath}-backup-${timestamp}`;
          
          console.log(`Target is newer, backing up source to: ${backupPath}`);
          fs.renameSync(oldGitPath, backupPath);
          
          console.log(`Migration complete. Source backed up to: ${backupPath}, using existing target.`);
        }
      } catch (error) {
        console.error('Error during smart merge:', error);
        await startWatchingFolder(folderId);
        return { success: false, error: `Failed to merge repositories: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    } else {
      // Simple case: target doesn't exist, just move
      console.log(`Moving ${oldGitPath} to ${newGitPath}`);
      fs.renameSync(oldGitPath, newGitPath);
    }
    
    // Determine the new customGitPath value for config
    // If moving to default location (inside watched folder), set to undefined
    const defaultGitPath = path.join(folder.path, '.git');
    const newCustomGitPath = newGitPath === defaultGitPath ? undefined : newGitPath;
    
    // Update folder configuration (this also saves to disk)
    console.log(`Updating config with customGitPath: ${newCustomGitPath || 'undefined (default)'}`);
    configService.updateFolder(folderId, { customGitPath: newCustomGitPath });
    
    // Remove old gitServices instance to force recreation with new path
    gitServices.delete(folderId);
    
    // Get the updated folder config
    const updatedFolder = configService.getFolder(folderId);
    if (!updatedFolder) {
      return { success: false, error: 'Failed to reload folder configuration' };
    }
    
    console.log(`Folder config reloaded. CustomGitPath: ${updatedFolder.customGitPath || 'undefined'}`);
    
    // Create new GitService with correct path
    const newGitService = new GitService(updatedFolder.path, updatedFolder.customGitPath);
    gitServices.set(folderId, newGitService);
    
    // Verify Git repository is accessible
    try {
      const commits = await newGitService.getCommits(1);
      console.log(`Git repository verified. Found ${commits.length} commit(s)`);
    } catch (error) {
      console.error('Failed to verify Git repository:', error);
      return { success: false, error: 'Migration completed but Git repository is not accessible' };
    }
    
    // Restart watching with new configuration
    await startWatchingFolder(folderId);
    
    console.log(`Successfully migrated Git repository for ${updatedFolder.name}`);
    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during migration' 
    };
  }
});

// Helper functions
function getOrCreateGitService(folderId: string): GitService {
  if (!gitServices.has(folderId)) {
    const folder = configService.getFolder(folderId);
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }
    gitServices.set(folderId, new GitService(folder.path, folder.customGitPath));
  }
  return gitServices.get(folderId)!;
}

async function startWatchingFolder(folderId: string): Promise<void> {
  if (fileWatchers.has(folderId)) {
    return; // Already watching
  }
  
  const folder = configService.getFolder(folderId);
  if (!folder) {
    throw new Error(`Folder not found: ${folderId}`);
  }
  
  const gitService = getOrCreateGitService(folderId);
  
  const watcher = new FileWatcher(folder.path, gitService, {
    commitStrategy: folder.commitStrategy,
    periodicInterval: folder.periodicInterval,
    ignorePatterns: folder.ignorePatterns,
    watchSubfolders: folder.watchSubfolders,
    onCommit: (files) => {
      if (mainWindow) {
        mainWindow.webContents.send('file-changed', folderId, files);
      }
    },
    onError: (error) => {
      console.error(`File watcher error for ${folder.path}:`, error);
    }
  });
  
  await watcher.start();
  fileWatchers.set(folderId, watcher);
  
  // Update folder status
  configService.updateFolder(folderId, { isActive: true });
}

async function stopWatchingFolder(folderId: string): Promise<void> {
  const watcher = fileWatchers.get(folderId);
  if (watcher) {
    watcher.stop();
    fileWatchers.delete(folderId);
  }
  
  // Update folder status
  configService.updateFolder(folderId, { isActive: false });
}

