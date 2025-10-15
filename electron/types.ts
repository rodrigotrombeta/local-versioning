// Shared type definitions for Electron process
export interface WatchedFolder {
  id: string;
  path: string;
  name: string;
  commitStrategy: 'on-save' | 'periodic';
  periodicInterval?: number;
  ignorePatterns: string[];
  isActive: boolean;
  watchSubfolders: boolean;
  customGitPath?: string; // Custom location for .git directory
}

export interface Commit {
  hash: string;
  message: string;
  date: Date;
  author: string;
  changedFiles: string[];
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

