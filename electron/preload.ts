import { contextBridge, ipcRenderer } from 'electron';
import type { WatchedFolder, Commit, DiffResult, AppConfig } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder management
  addFolder: (path: string) => ipcRenderer.invoke('add-folder', path),
  removeFolder: (folderId: string) => ipcRenderer.invoke('remove-folder', folderId),
  getFolders: () => ipcRenderer.invoke('get-folders'),
  updateFolder: (folderId: string, updates: Partial<WatchedFolder>) => 
    ipcRenderer.invoke('update-folder', folderId, updates),
  
  // Git operations
  getCommits: (folderId: string, limit?: number) => 
    ipcRenderer.invoke('get-commits', folderId, limit),
  getFileContent: (folderId: string, commitHash: string, filePath: string) => 
    ipcRenderer.invoke('get-file-content', folderId, commitHash, filePath),
  getDiff: (folderId: string, filePath: string, oldCommit: string, newCommit?: string) => 
    ipcRenderer.invoke('get-diff', folderId, filePath, oldCommit, newCommit),
  restoreFile: (folderId: string, filePath: string, commitHash: string) => 
    ipcRenderer.invoke('restore-file', folderId, filePath, commitHash),
  cleanupCommits: (folderId: string, filePath: string, commitsToDelete: string[]) =>
    ipcRenderer.invoke('cleanup-commits', folderId, filePath, commitsToDelete),
  getFileStorageInfo: (folderId: string, filePath: string) =>
    ipcRenderer.invoke('get-file-storage-info', folderId, filePath),
  
  // File watching
  startWatching: (folderId: string) => ipcRenderer.invoke('start-watching', folderId),
  stopWatching: (folderId: string) => ipcRenderer.invoke('stop-watching', folderId),
  
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('save-config', config),
  
  // Dialog
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // File operations
  fileExists: (folderPath: string, filePath: string) => ipcRenderer.invoke('file-exists', folderPath, filePath),
  saveFile: (folderPath: string, filePath: string, content: string) => 
    ipcRenderer.invoke('save-file', folderPath, filePath, content),
  createFile: (folderPath: string, fileName: string) => 
    ipcRenderer.invoke('create-file', folderPath, fileName),
  listFolderFiles: (folderPath: string) => ipcRenderer.invoke('list-folder-files', folderPath),
  readFileFromDisk: (folderPath: string, filePath: string) => 
    ipcRenderer.invoke('read-file-from-disk', folderPath, filePath),
  
  // Git repository migration
  migrateGitRepository: (folderId: string, newGitPath: string) => 
    ipcRenderer.invoke('migrate-git-repository', folderId, newGitPath),
  detectExistingGitRepository: (folderPath: string, folderName: string) =>
    ipcRenderer.invoke('detect-existing-git-repository', folderPath, folderName),
  
  // Events
  onFileChanged: (callback: (folderId: string) => void) => {
    const subscription = (_event: any, folderId: string) => callback(folderId);
    ipcRenderer.on('file-changed', subscription);
    return () => ipcRenderer.removeListener('file-changed', subscription);
  },
  onCommitCreated: (callback: (folderId: string, commit: Commit) => void) => {
    ipcRenderer.on('commit-created', (_event, folderId, commit) => callback(folderId, commit));
  }
});

