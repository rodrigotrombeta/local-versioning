import chokidar, { FSWatcher } from 'chokidar';
import { GitService } from './GitService';
import * as path from 'path';

export interface FileWatcherOptions {
  commitStrategy: 'on-save' | 'periodic';
  periodicInterval?: number; // in minutes
  ignorePatterns?: string[];
  watchSubfolders?: boolean;
  onCommit?: (files: string[]) => void;
  onError?: (error: Error) => void;
}

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private gitService: GitService;
  private options: FileWatcherOptions;
  private watchPath: string;
  private pendingChanges: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private isCommitting: boolean = false;
  
  constructor(watchPath: string, gitService: GitService, options: FileWatcherOptions) {
    this.watchPath = watchPath;
    this.gitService = gitService;
    const defaultIgnorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.DS_Store',
      '**/*.tmp',
      '**/*.log',
      '**/.local-versioning/**'
    ];
    this.options = {
      commitStrategy: options.commitStrategy || 'on-save',
      periodicInterval: options.periodicInterval || 5,
      ignorePatterns: options.ignorePatterns || defaultIgnorePatterns,
      onCommit: options.onCommit,
      onError: options.onError
    };
  }
  
  async start(): Promise<void> {
    if (this.watcher) {
      return; // Already watching
    }
    
    try {
      // Initialize git repository
      await this.gitService.initialize();
      
      // Start watching
      console.log('Starting chokidar with patterns:', this.options.ignorePatterns);
      console.log('Watch subfolders:', this.options.watchSubfolders);
      
      // Determine watch depth
      const watchDepth = this.options.watchSubfolders !== false ? undefined : 0;
      
      this.watcher = chokidar.watch(this.watchPath, {
        ignored: this.options.ignorePatterns,
        persistent: true,
        ignoreInitial: true,
        depth: watchDepth, // undefined = infinite depth, 0 = only top level
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });
      
      console.log('Chokidar watcher created with depth:', watchDepth);
      
      // Handle file events
      this.watcher.on('add', (filePath) => {
        console.log('Chokidar: file added:', filePath);
        this.handleFileChange(filePath);
      });
      
      this.watcher.on('change', (filePath) => {
        console.log('Chokidar: file changed:', filePath);
        this.handleFileChange(filePath);
      });
      
      this.watcher.on('unlink', (filePath) => {
        console.log('Chokidar: file deleted:', filePath);
        this.handleFileChange(filePath);
      });
      
      this.watcher.on('ready', () => {
        console.log('Chokidar: Initial scan complete, ready for changes');
        console.log('Watching path:', this.watchPath);
        console.log('Watch depth:', watchDepth);
        console.log('Ignore patterns:', this.options.ignorePatterns);
        
        // Log what files are currently being watched
        if (this.watcher) {
          const watched = this.watcher.getWatched();
          const watchedCount = Object.keys(watched).reduce((sum, dir) => sum + watched[dir].length, 0);
          console.log('Currently watching', watchedCount, 'files in', Object.keys(watched).length, 'directories');
        }
      });
      
      this.watcher.on('error', (error) => {
        console.error('Chokidar error:', error);
        if (this.options.onError) {
          this.options.onError(error);
        }
      });
      
      // Debug: Log all file system events
      this.watcher.on('all', (event, filePath) => {
        console.log(`FS Event [${event}]:`, filePath);
      });
      
      // If periodic strategy, start the timer
      if (this.options.commitStrategy === 'periodic' && this.options.periodicInterval) {
        const intervalMs = this.options.periodicInterval * 60 * 1000;
        this.periodicTimer = setInterval(() => {
          this.commitPendingChanges();
        }, intervalMs);
      }
      
      console.log(`Started watching: ${this.watchPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start file watcher: ${errorMessage}`);
    }
  }
  
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
    
    console.log(`Stopped watching: ${this.watchPath}`);
  }
  
  private handleFileChange(filePath: string): void {
    // Convert absolute path to relative path
    const relativePath = path.relative(this.watchPath, filePath);
    
    console.log('File changed:', relativePath);
    
    // Add to pending changes
    this.pendingChanges.add(relativePath);
    
    console.log('Pending changes:', Array.from(this.pendingChanges));
    
    // If on-save strategy, debounce and commit
    if (this.options.commitStrategy === 'on-save') {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      // Wait 2 seconds after last change before committing
      this.debounceTimer = setTimeout(() => {
        console.log('Debounce timer triggered, committing...');
        this.commitPendingChanges();
      }, 2000);
    }
  }
  
  private async commitPendingChanges(): Promise<void> {
    if (this.isCommitting || this.pendingChanges.size === 0) {
      console.log('Skipping commit - isCommitting:', this.isCommitting, 'pendingChanges:', this.pendingChanges.size);
      return;
    }
    
    this.isCommitting = true;
    console.log('Starting to commit pending changes...');
    
    try {
      const filesToCommit = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      
      console.log('Files to commit:', filesToCommit);
      
      // Commit the changes
      const commitHash = await this.gitService.commit(filesToCommit);
      
      console.log('Commit hash received:', commitHash);
      
      if (commitHash && this.options.onCommit) {
        console.log('Calling onCommit callback');
        this.options.onCommit(filesToCommit);
      }
    } catch (error) {
      console.error('Failed to commit changes:', error);
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
    } finally {
      this.isCommitting = false;
    }
  }
  
  getPendingChanges(): string[] {
    return Array.from(this.pendingChanges);
  }
  
  isWatching(): boolean {
    return this.watcher !== null;
  }
}

