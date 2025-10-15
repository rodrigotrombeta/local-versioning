import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

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

export class GitService {
  private git: SimpleGit;
  private repoPath: string;
  private workingDir: string;
  private customGitPath?: string;
  
  constructor(watchedFolderPath: string, customGitPath?: string) {
    this.workingDir = watchedFolderPath;
    this.customGitPath = customGitPath;
    
    // Determine Git directory location
    if (customGitPath) {
      // Use custom location if specified
      this.repoPath = customGitPath;
      console.log('Using custom Git path:', this.repoPath);
    } else {
      // Default: create .git inside the watched folder
      this.repoPath = path.join(this.workingDir, '.git');
      console.log('Using default Git path (inside watched folder):', this.repoPath);
    }
    
    // Initialize git with the working directory
    this.git = simpleGit({
      baseDir: this.workingDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
    });
  }
  
  async initialize(): Promise<void> {
    try {
      console.log('Initializing git repository for:', this.workingDir);
      console.log('Git directory will be at:', this.repoPath);
      
      // Determine the actual .git directory location
      const gitDir = this.customGitPath 
        ? this.customGitPath 
        : path.join(this.workingDir, '.git');
      
      if (!fs.existsSync(gitDir)) {
        console.log('Git directory does not exist, initializing...');
        
        // Create parent directory for custom Git path
        if (this.customGitPath) {
          const parentDir = path.dirname(this.customGitPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
        }
        
        // Initialize git repository
        if (this.customGitPath) {
          // For custom path, use --separate-git-dir
          await this.git.raw(['init', `--separate-git-dir=${this.customGitPath}`]);
          console.log('Git initialized with separate git dir at:', this.customGitPath);
        } else {
          // Standard initialization
          await this.git.init();
          console.log('Git initialized in working directory');
        }
        
        // Configure git user if not set
        try {
          await this.git.addConfig('user.name', 'Local Versioning', false, 'local');
          await this.git.addConfig('user.email', 'local@versioning.app', false, 'local');
          console.log('Git user configured');
        } catch (error) {
          console.log('Git user already configured or error:', error);
        }
        
        // Create .gitignore if it doesn't exist
        const gitignorePath = path.join(this.workingDir, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
          const defaultIgnores = [
            '.DS_Store',
            'node_modules/',
            '.git/',
            '*.tmp',
            '*.log'
          ].join('\n');
          fs.writeFileSync(gitignorePath, defaultIgnores);
          console.log('Created .gitignore');
        }
        
        // Check what files exist before initial commit
        const files = fs.readdirSync(this.workingDir);
        console.log('Files in directory before initial commit:', files);
        
        // Initial commit - only if there are files
        const status = await this.git.status();
        console.log('Initial git status:', status);
        
        if (files.length > 1) { // More than just .gitignore
          await this.git.add('.');
          const statusAfterAdd = await this.git.status();
          console.log('Status after add:', statusAfterAdd);
          
          if (statusAfterAdd.staged.length > 0) {
            await this.git.commit('Initial commit by Local Versioning');
            console.log('Initial commit created');
          } else {
            console.log('No files staged for initial commit');
          }
        } else {
          console.log('No files to commit initially, will commit on first change');
        }
      } else {
        console.log('Git already initialized');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize git repository:', errorMessage);
      throw new Error(`Failed to initialize git repository: ${errorMessage}`);
    }
  }
  
  async commit(changedFiles: string[]): Promise<string> {
    try {
      if (changedFiles.length === 0) {
        console.log('No files to commit');
        return '';
      }
      
      console.log('Committing files:', changedFiles);
      
      // First check if git is initialized
      const gitDir = path.join(this.workingDir, '.git');
      if (!fs.existsSync(gitDir)) {
        console.log('Git not initialized, initializing now...');
        await this.initialize();
      }
      
      // Add changed files - use '.' to add all if it's the first commit
      const statusBefore = await this.git.status();
      console.log('Status before add:', statusBefore);
      
      // Check if this might be the first commit
      const hasCommits = await this.git.log().then(log => log.total > 0).catch(() => false);
      console.log('Has commits:', hasCommits);
      
      if (!hasCommits) {
        // First commit - add everything
        console.log('First commit, adding all files');
        await this.git.add('.');
      } else {
        // Subsequent commits - add specific files
        await this.git.add(changedFiles);
      }
      
      // Check if there are changes to commit
      const status = await this.git.status();
      console.log('Git status after add:', status);
      
      if (status.staged.length === 0 && status.files.length === 0) {
        console.log('No staged changes to commit');
        return '';
      }
      
      // Create commit message
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const fileList = changedFiles.map(f => path.basename(f)).join(', ');
      const message = hasCommits 
        ? `Auto-commit: ${timestamp} - [${fileList}]`
        : `Initial commit: ${timestamp}`;
      
      console.log('Creating commit:', message);
      
      // Commit
      const result = await this.git.commit(message);
      console.log('Commit created:', result.commit);
      return result.commit;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Commit error:', errorMessage);
      throw new Error(`Failed to commit changes: ${errorMessage}`);
    }
  }
  
  async getCommits(limit: number = 50): Promise<Commit[]> {
    try {
      const log: LogResult = await this.git.log({ maxCount: limit });
      
      const commits: Commit[] = [];
      
      for (let i = 0; i < log.all.length; i++) {
        const entry = log.all[i];
        let changedFiles: string[] = [];
        
        try {
          // Get files changed in this commit
          // For the first commit, compare with empty tree
          // For other commits, compare with parent
          if (i === log.all.length - 1) {
            // This is the first commit (oldest), show all files
            const showResult = await this.git.show(['--name-only', '--pretty=format:', entry.hash]);
            changedFiles = showResult.split('\n').filter(f => f.trim().length > 0);
          } else {
            // Compare with parent commit
            const diffSummary = await this.git.diffSummary([`${entry.hash}^`, entry.hash]);
            changedFiles = diffSummary.files.map(f => f.file);
          }
        } catch (error) {
          // If diff fails, try to get files another way
          console.log('Failed to get diff for commit, trying alternative method:', entry.hash);
          try {
            const showResult = await this.git.show(['--name-only', '--pretty=format:', entry.hash]);
            changedFiles = showResult.split('\n').filter(f => f.trim().length > 0);
          } catch (innerError) {
            console.error('Failed to get files for commit:', entry.hash, innerError);
            changedFiles = [];
          }
        }
        
        commits.push({
          hash: entry.hash,
          message: entry.message,
          date: new Date(entry.date),
          author: entry.author_name,
          changedFiles
        });
      }
      
      return commits;
    } catch (error) {
      // If there are no commits yet, return empty array
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not have any commits yet')) {
        return [];
      }
      throw new Error(`Failed to get commits: ${errorMessage}`);
    }
  }
  
  async getFileContent(commitHash: string, filePath: string): Promise<string> {
    try {
      const content = await this.git.show([`${commitHash}:${filePath}`]);
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get file content: ${errorMessage}`);
    }
  }
  
  /**
   * Get file content from a commit, or from previous commit if file was deleted in specified commit
   */
  async getFileContentSafe(commitHash: string, filePath: string): Promise<string> {
    try {
      // Try to get content from specified commit
      return await this.getFileContent(commitHash, filePath);
    } catch (error) {
      // File doesn't exist in this commit (probably deleted)
      // Get all commits that touched this file and find the next one
      console.log(`File not found in commit ${commitHash}, searching previous commits...`);
      
      try {
        const commits = await this.getCommits(100);
        
        // Find commits where this file was changed
        const commitsWithFile: string[] = [];
        for (const commit of commits) {
          const changedFiles = commit.changedFiles || [];
          if (changedFiles.some((f: string) => f === filePath)) {
            commitsWithFile.push(commit.hash);
          }
        }
        
        // Find the index of the requested commit
        const commitIndex = commitsWithFile.indexOf(commitHash);
        
        if (commitIndex === -1) {
          throw new Error(`Commit ${commitHash} not found in file history`);
        }
        
        // Try subsequent commits (older ones) until we find the file
        for (let i = commitIndex + 1; i < commitsWithFile.length; i++) {
          try {
            console.log(`Trying commit ${i}: ${commitsWithFile[i]}`);
            return await this.getFileContent(commitsWithFile[i], filePath);
          } catch (err) {
            // Continue to next commit
            continue;
          }
        }
        
        throw new Error(`File not found in any commit in history`);
      } catch (historyError) {
        const errorMessage = historyError instanceof Error ? historyError.message : String(historyError);
        throw new Error(`Failed to find file in history: ${errorMessage}`);
      }
    }
  }
  
  async getDiff(filePath: string, oldCommit: string, newCommit?: string): Promise<DiffResult> {
    try {
      // Use safe method that handles deleted files
      const oldContent = await this.getFileContentSafe(oldCommit, filePath);
      
      let newContent: string;
      if (newCommit) {
        // Use safe method for the new commit too
        newContent = await this.getFileContentSafe(newCommit, filePath);
      } else {
        // Try to read current file content from disk
        const fullPath = path.join(this.workingDir, filePath);
        if (fs.existsSync(fullPath)) {
          newContent = fs.readFileSync(fullPath, 'utf-8');
        } else {
          // File deleted from disk, show empty content
          newContent = '';
        }
      }
      
      return {
        oldContent,
        newContent,
        fileName: path.basename(filePath),
        oldCommit,
        newCommit: newCommit || 'current'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get diff: ${errorMessage}`);
    }
  }
  
  async restoreFile(filePath: string, commitHash: string): Promise<void> {
    try {
      // Get file content from commit (use safe method that handles deleted files)
      const content = await this.getFileContentSafe(commitHash, filePath);
      
      // Write to file
      const fullPath = path.join(this.workingDir, filePath);
      const dir = path.dirname(fullPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content);
      
      // Commit the restoration
      await this.git.add(filePath);
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await this.git.commit(`Restored ${path.basename(filePath)} from ${commitHash.substring(0, 7)} at ${timestamp}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to restore file: ${errorMessage}`);
    }
  }
  
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.modified.length > 0 || 
             status.created.length > 0 || 
             status.deleted.length > 0;
    } catch (error) {
      return false;
    }
  }
}

