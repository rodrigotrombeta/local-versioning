import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export interface WatchedFolder {
  id: string;
  path: string;
  name: string;
  commitStrategy: 'on-save' | 'periodic';
  periodicInterval?: number;
  ignorePatterns: string[];
  isActive: boolean;
  watchSubfolders: boolean;
  customGitPath?: string;
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

export class ConfigService {
  private configPath: string;
  private config: AppConfig;
  
  constructor() {
    const configDir = path.join(os.homedir(), '.local-versioning');
    this.configPath = path.join(configDir, 'config.json');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Load or create config
    this.config = this.loadConfig();
  }
  
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        
        // Migrate existing folders to add watchSubfolders if missing
        if (config.watchedFolders) {
          config.watchedFolders = config.watchedFolders.map((folder: any) => ({
            ...folder,
            watchSubfolders: folder.watchSubfolders !== undefined ? folder.watchSubfolders : true
          }));
        }
        
        return config;
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
    }
    
    // Return default config
    return {
      watchedFolders: [],
      theme: 'light'
    };
  }
  
  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }
  
  getConfig(): AppConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
  
  addFolder(folderPath: string, options?: Partial<WatchedFolder>): WatchedFolder {
    const folder: WatchedFolder = {
      id: randomUUID(),
      path: folderPath,
      name: path.basename(folderPath),
      commitStrategy: options?.commitStrategy || 'on-save',
      periodicInterval: options?.periodicInterval || 5,
      ignorePatterns: options?.ignorePatterns || [
        '**/node_modules/**',
        '**/.git/**',
        '**/.DS_Store',
        '**/*.tmp',
        '**/*.log'
      ],
      isActive: true,
      watchSubfolders: options?.watchSubfolders !== undefined ? options.watchSubfolders : true
    };
    
    this.config.watchedFolders.push(folder);
    this.saveConfig();
    
    return folder;
  }
  
  removeFolder(folderId: string): void {
    this.config.watchedFolders = this.config.watchedFolders.filter(
      f => f.id !== folderId
    );
    this.saveConfig();
  }
  
  updateFolder(folderId: string, updates: Partial<WatchedFolder>): void {
    const index = this.config.watchedFolders.findIndex(f => f.id === folderId);
    if (index !== -1) {
      this.config.watchedFolders[index] = {
        ...this.config.watchedFolders[index],
        ...updates
      };
      this.saveConfig();
    }
  }
  
  getFolder(folderId: string): WatchedFolder | undefined {
    return this.config.watchedFolders.find(f => f.id === folderId);
  }
  
  getFolders(): WatchedFolder[] {
    return [...this.config.watchedFolders];
  }
}

