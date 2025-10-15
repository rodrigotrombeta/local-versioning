export interface WatchedFolder {
  id: string;
  path: string;
  name: string;
  commitStrategy: 'on-save' | 'periodic';
  periodicInterval?: number; // minutes
  ignorePatterns: string[];
  isActive: boolean;
  watchSubfolders: boolean; // Watch files in subdirectories
  customGitPath?: string; // Custom location for .git directory (optional)
}

export interface Commit {
  hash: string;
  message: string;
  date: Date;
  author: string;
  changedFiles: string[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

export interface DiffResult {
  oldContent: string;
  newContent: string;
  fileName: string;
  oldCommit?: string;
  newCommit?: string;
}

export interface AppConfig {
  watchedFolders: WatchedFolder[];
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  theme: 'light' | 'dark';
  defaultGitLocation?: 'watched-folder' | 'custom';
  defaultCustomGitPath?: string;
}

export interface ElectronAPI {
  // Folder management
  addFolder: (path: string) => Promise<WatchedFolder>;
  removeFolder: (folderId: string) => Promise<void>;
  getFolders: () => Promise<WatchedFolder[]>;
  updateFolder: (folderId: string, updates: Partial<WatchedFolder>) => Promise<void>;
  
  // Git operations
  getCommits: (folderId: string, limit?: number) => Promise<Commit[]>;
  getFileContent: (folderId: string, commitHash: string, filePath: string) => Promise<string>;
  getDiff: (folderId: string, filePath: string, oldCommit: string, newCommit?: string) => Promise<DiffResult>;
  restoreFile: (folderId: string, filePath: string, commitHash: string) => Promise<void>;
  
  // File watching
  startWatching: (folderId: string) => Promise<void>;
  stopWatching: (folderId: string) => Promise<void>;
  
  // Config
  getConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<void>;
  
  // Dialog
  selectFolder: () => Promise<string | null>;
  
  // File operations
  fileExists: (folderPath: string, filePath: string) => Promise<boolean>;
  saveFile?: (folderPath: string, filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  createFile?: (folderPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  listFolderFiles?: (folderPath: string) => Promise<string[]>;
  readFileFromDisk?: (folderPath: string, filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  
  // Git repository migration
  migrateGitRepository: (folderId: string, newGitPath: string) => Promise<{ success: boolean; error?: string }>;
  detectExistingGitRepository: (folderPath: string, folderName: string) => Promise<{ found: boolean; gitPath?: string; commitCount?: number }>;
  
  // Events
  onFileChanged?: (callback: (folderId: string) => void) => () => void;
  onCommitCreated?: (callback: (folderId: string, commit: Commit) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

