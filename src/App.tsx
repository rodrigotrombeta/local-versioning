import { useState, useEffect } from 'react';
import CommitHistory from './components/CommitHistory';
import DiffViewer from './components/DiffViewer';
import Settings from './components/Settings';
import GitMigration from './components/GitMigration';
import FolderFileTree from './components/FolderFileTree';
import type { WatchedFolder, Commit, DiffResult } from './types';

function App() {
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<WatchedFolder | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [allFoldersFiles, setAllFoldersFiles] = useState<Record<string, string[]>>({}); // Current files
  const [allFoldersDeletedFiles, setAllFoldersDeletedFiles] = useState<Record<string, string[]>>({}); // Deleted files
  const [showDeletedFiles, setShowDeletedFiles] = useState(false); // Toggle for showing deleted files
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileCommits, setFileCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [compareCommit, setCompareCommit] = useState<Commit | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [defaultGitLocation, setDefaultGitLocation] = useState<'watched-folder' | 'custom'>('watched-folder');
  const [defaultCustomGitPath, setDefaultCustomGitPath] = useState('');
  const [showMigration, setShowMigration] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  
  // Resizable panels: widths in percentages
  const [leftPanelWidth, setLeftPanelWidth] = useState(20); // 20%
  const [centerPanelWidth, setCenterPanelWidth] = useState(50); // 50%
  // Right panel gets the remainder (30%)
  
  const handleLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = ((moveEvent.clientX - startX) / window.innerWidth) * 100;
      const newWidth = Math.max(10, Math.min(40, startWidth + delta)); // Min 10%, Max 40%
      setLeftPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleCenterResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = centerPanelWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = ((moveEvent.clientX - startX) / window.innerWidth) * 100;
      const newWidth = Math.max(20, Math.min(70, startWidth + delta)); // Min 20%, Max 70%
      setCenterPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const [reconnectDialog, setReconnectDialog] = useState<{
    folderName: string;
    location: string;
    commits: string;
    folderPath: string;
    gitPath?: string;
  } | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
    
    // Load auto-refresh setting from localStorage
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    if (savedAutoRefresh !== null) {
      setAutoRefresh(savedAutoRefresh === 'true');
    }
    
    // Load default Git location settings
    const savedGitLocation = localStorage.getItem('defaultGitLocation') as 'watched-folder' | 'custom';
    if (savedGitLocation) {
      setDefaultGitLocation(savedGitLocation);
    }
    
    const savedCustomPath = localStorage.getItem('defaultCustomGitPath');
    if (savedCustomPath) {
      setDefaultCustomGitPath(savedCustomPath);
    }
  }, []);
  
  // Load files for all folders when folders change
  useEffect(() => {
    if (folders.length > 0) {
      loadAllFoldersFiles();
    }
  }, [folders.length]);
  
  // Periodically refresh file list for selected folder (to catch new files)
  useEffect(() => {
    if (!selectedFolder) return;
    
    // Refresh every 5 seconds
    const intervalId = setInterval(() => {
      loadAllFoldersFiles();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [selectedFolder]);
  
  // Listen for file changes from the main process (auto-refresh)
  useEffect(() => {
    if (!autoRefresh || !selectedFolder) return;
    
    const handleFileChanged = (folderId: string) => {
      console.log('File changed event received for folder:', folderId);
      if (selectedFolder && selectedFolder.id === folderId) {
        console.log('Auto-refreshing commits...');
        loadCommits(folderId);
        
        // Also reload the file list to show newly added files
        loadAllFoldersFiles();
      }
    };
    
    // Listen for file change events
    const cleanup = window.electronAPI.onFileChanged?.(handleFileChanged);
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [autoRefresh, selectedFolder]);

  // Load commits when folder is selected
  useEffect(() => {
    if (selectedFolder) {
      loadCommits(selectedFolder.id);
    }
  }, [selectedFolder]);

  // Extract all unique files when commits change
  useEffect(() => {
    if (commits.length > 0) {
      const filesSet = new Set<string>();
      commits.forEach(commit => {
        commit.changedFiles.forEach(file => filesSet.add(file));
      });
      setAllFiles(Array.from(filesSet).sort());
    } else {
      setAllFiles([]);
    }
  }, [commits]);

  // Listen for new commits
  useEffect(() => {
    const handleCommitCreated = (folderId: string) => {
      if (selectedFolder && selectedFolder.id === folderId) {
        loadCommits(folderId);
      }
    };

    if (window.electronAPI.onCommitCreated) {
      window.electronAPI.onCommitCreated(handleCommitCreated);
    }
  }, [selectedFolder]);

  const loadFolders = async () => {
    try {
      const loadedFolders = await window.electronAPI.getFolders();
      setFolders(loadedFolders);
      return loadedFolders;
    } catch (error) {
      console.error('Failed to load folders:', error);
      return [];
    }
  };

  const loadCommits = async (folderId: string) => {
    try {
      setLoading(true);
      console.log('Loading commits for folder:', folderId);
      const loadedCommits = await window.electronAPI.getCommits(folderId, 100);
      console.log('Loaded commits for folder:', folderId, '- Count:', loadedCommits.length);
      
      // Log first few commits to verify
      if (loadedCommits.length > 0) {
        console.log('First commit files:', loadedCommits[0].changedFiles);
      }
      
      setCommits(loadedCommits);
      
      // Extract all unique files from all commits
      const uniqueFiles = new Set<string>();
      loadedCommits.forEach(commit => {
        commit.changedFiles.forEach(file => uniqueFiles.add(file));
      });
      const filesArray = Array.from(uniqueFiles).sort();
      console.log('All unique files for this folder:', filesArray);
      setAllFiles(filesArray);
      
      // Note: Don't update allFoldersFiles here - it's managed by loadAllFoldersFiles()
      // which reads from the file system directly, not just from commits
    } catch (error) {
      console.error('Failed to load commits:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Load files for all folders
  const loadAllFoldersFiles = async (foldersToLoad?: WatchedFolder[]) => {
    const targetFolders = foldersToLoad || folders;
    
    const filesMap: Record<string, string[]> = {};
    const deletedFilesMap: Record<string, string[]> = {};
    
    for (const folder of targetFolders) {
      try {
        let realFiles: string[] = [];
        
        // Get real files from file system (current state)
        if (window.electronAPI.listFolderFiles) {
          try {
            realFiles = await window.electronAPI.listFolderFiles(folder.path);
            filesMap[folder.id] = realFiles.sort();
          } catch (err) {
            console.warn(`Failed to list real files for folder ${folder.name}:`, err);
            filesMap[folder.id] = [];
          }
        } else {
          filesMap[folder.id] = [];
        }
        
        // Get deleted files (files in commit history but not in current file system)
        try {
          const loadedCommits = await window.electronAPI.getCommits(folder.id, 100);
          const historicalFiles = new Set<string>();
          
          loadedCommits.forEach((commit: Commit) => {
            commit.changedFiles.forEach((file: string) => historicalFiles.add(file));
          });
          
          // Deleted files = files in history but not in current file system
          const currentFilesSet = new Set(realFiles);
          const deletedFiles = Array.from(historicalFiles).filter(file => !currentFilesSet.has(file));
          deletedFilesMap[folder.id] = deletedFiles.sort();
        } catch (err) {
          console.warn(`Failed to load commits for folder ${folder.name}:`, err);
          deletedFilesMap[folder.id] = [];
        }
      } catch (error) {
        console.error(`Failed to load files for folder ${folder.name}:`, error);
        filesMap[folder.id] = [];
        deletedFilesMap[folder.id] = [];
      }
    }
    
    setAllFoldersFiles(filesMap);
    setAllFoldersDeletedFiles(deletedFilesMap);
  };
  

  const handleAddFolder = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (!folderPath) return;
      
      // Extract folder name
      const folderName = folderPath.split('/').pop() || 'folder';
      
      // Check if Git repository already exists for this folder
      console.log('Checking for existing Git repository...');
      const detection = await window.electronAPI.detectExistingGitRepository(folderPath, folderName);
      
      if (detection.found && detection.gitPath) {
        console.log('Found existing Git repository at:', detection.gitPath);
        
        const isInsideFolder = detection.gitPath === `${folderPath}/.git`;
        const location = isInsideFolder ? 'inside the folder' : `at: ${detection.gitPath}`;
        const commits = detection.commitCount ? `This repository has ${detection.commitCount} commit${detection.commitCount !== 1 ? 's' : ''} of history.` : '';
        
        // Show custom dialog instead of confirm()
        setReconnectDialog({
          folderName,
          location,
          commits,
          folderPath,
          gitPath: detection.gitPath
        });
        
        return; // Wait for user response from dialog
      }
      
      // If no existing repo, just add the folder
      await window.electronAPI.addFolder(folderPath);
      const updatedFolders = await loadFolders();
      // Reload files for all folders to show new folder's files immediately
      await loadAllFoldersFiles(updatedFolders);
    } catch (error) {
      console.error('Failed to add folder:', error);
    }
  };
  
  const handleReconnectYes = async () => {
    if (!reconnectDialog) return;
    
    try {
      console.log('User chose to reconnect to existing repository');
      
      const folder = await window.electronAPI.addFolder(reconnectDialog.folderPath);
      
      // Update with custom git path if not inside folder
      const isInsideFolder = reconnectDialog.gitPath === `${reconnectDialog.folderPath}/.git`;
      if (!isInsideFolder && reconnectDialog.gitPath) {
        await window.electronAPI.updateFolder(folder.id, {
          customGitPath: reconnectDialog.gitPath
        });
      }
      
      await window.electronAPI.startWatching(folder.id);
      
      // Reload folders and load files explicitly
      const updatedFolders = await loadFolders();
      await loadAllFoldersFiles(updatedFolders);
      
      setSelectedFolder(folder);
      setReconnectDialog(null);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setReconnectDialog(null);
    }
  };
  
  const handleReconnectNo = async () => {
    if (!reconnectDialog) return;
    
    try {
      console.log('User chose to start fresh');
      
      const folder = await window.electronAPI.addFolder(reconnectDialog.folderPath);
      
      // Apply default Git location if configured
      if (defaultGitLocation === 'custom' && defaultCustomGitPath) {
        const customGitPath = `${defaultCustomGitPath}/${reconnectDialog.folderName}-git`;
        await window.electronAPI.updateFolder(folder.id, {
          customGitPath
        });
      }
      
      await window.electronAPI.startWatching(folder.id);
      const updatedFolders = await loadFolders();
      // Reload files to show folder's files immediately
      await loadAllFoldersFiles(updatedFolders);
      setSelectedFolder(folder);
      
      setReconnectDialog(null);
    } catch (error) {
      console.error('Failed to add folder:', error);
      setReconnectDialog(null);
    }
  };

  const handleRemoveFolder = async () => {
    if (!selectedFolder) {
      alert('Please select a folder to remove');
      return;
    }
    
    setShowRemoveDialog(true);
  };
  
  const confirmRemoveFolder = async () => {
    if (!selectedFolder) return;
    
    try {
      await window.electronAPI.stopWatching(selectedFolder.id);
      await window.electronAPI.removeFolder(selectedFolder.id);
      
      setShowRemoveDialog(false);
      setSelectedFolder(null);
      setSelectedFile(null);
      setDiffResult(null);
      setCommits([]);
      
      await loadFolders();
    } catch (error) {
      console.error('Failed to remove folder:', error);
      alert('Failed to remove folder: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSelectFolder = (folder: WatchedFolder) => {
    console.log('Selecting folder:', folder.name, 'ID:', folder.id);
    setSelectedFolder(folder);
    setSelectedFile(null);
    setFileCommits([]);
    setSelectedCommit(null);
    setDiffResult(null);
    setCompareCommit(null);
  };

  const loadCurrentFileContent = async (filePath: string, folderId?: string) => {
    const targetFolderId = folderId || selectedFolder?.id;
    if (!targetFolderId) return;
    
    try {
      setLoading(true);
      
      console.log(`=== loadCurrentFileContent for: ${filePath} ===`);
      
      // Get fresh commits for this folder
      const allCommits = await window.electronAPI.getCommits(targetFolderId, 100);
      console.log(`Total commits: ${allCommits.length}`);
      
      // Filter commits that contain this file
      const commitsWithFile = allCommits.filter(commit => 
        commit.changedFiles.includes(filePath)
      );
      console.log(`Commits with this file: ${commitsWithFile.length}`);
      
      // Set file commits for the versions panel
      setFileCommits(commitsWithFile);
      
      let content = '';
      let isDeletedFile = false;
      
      if (commitsWithFile.length > 0) {
        // Try to get content from the most recent commit
        let commitToUse = commitsWithFile[0];
        let contentFound = false;
        
        // For deleted files, the most recent commit might be the deletion commit
        // where the file doesn't exist. Try commits in order until we find one with content.
        for (let i = 0; i < commitsWithFile.length; i++) {
          try {
            console.log(`Trying to read file from Git commit: ${commitsWithFile[i].hash}`);
            content = await window.electronAPI.getFileContent(
              targetFolderId,
              commitsWithFile[i].hash,
              filePath
            );
            commitToUse = commitsWithFile[i];
            contentFound = true;
            console.log(`Content loaded from Git commit ${i}, length: ${content.length}`);
            break;
          } catch (err) {
            console.log(`File doesn't exist in commit ${i}, trying next...`);
            continue;
          }
        }
        
        if (!contentFound) {
          console.error('File not found in any commit');
          return;
        }
        
        // Check if file is deleted (exists in Git but not on disk)
        const targetFolder = folders.find(f => f.id === targetFolderId);
        if (targetFolder && window.electronAPI.readFileFromDisk) {
          const diskResult = await window.electronAPI.readFileFromDisk(
            targetFolder.path,
            filePath
          );
          isDeletedFile = !diskResult.success;
          console.log(`File deleted from disk: ${isDeletedFile}`);
        }
      } else {
        console.log('No commits found, reading from disk');
        // No commits yet - read file directly from disk
        const targetFolder = folders.find(f => f.id === targetFolderId);
        if (targetFolder && window.electronAPI.readFileFromDisk) {
          const result = await window.electronAPI.readFileFromDisk(
            targetFolder.path,
            filePath
          );
          if (result.success && result.content) {
            content = result.content;
            console.log(`Content loaded from disk, length: ${content.length}`);
          } else {
            console.error('Failed to read file from disk:', result.error);
            return;
          }
        } else {
          console.error('readFileFromDisk API not available');
          return;
        }
      }
      
      console.log(`Setting diffResult with content length: ${content.length}, isDeleted: ${isDeletedFile}`);
      
      // Show as both old and new (no diff yet, just content)
      setDiffResult({
        oldContent: content,
        newContent: content,
        fileName: filePath.split('/').pop() || filePath,
        oldCommit: isDeletedFile ? 'deleted' : 'current',
        newCommit: isDeletedFile ? 'deleted' : 'current'
      });
    } catch (error) {
      console.error('Failed to load file content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (filePath: string, folderId?: string) => {
    const targetFolderId = folderId || selectedFolder?.id;
    if (!targetFolderId) return;
    
    // If selecting from a different folder, switch to that folder
    if (folderId && folderId !== selectedFolder?.id) {
      const targetFolder = folders.find(f => f.id === folderId);
      if (targetFolder) {
        setSelectedFolder(targetFolder);
        await loadCommits(folderId);
      }
    }
    
    // Ensure commits are loaded for the current folder
    // (in case folder was expanded but not selected)
    if (commits.length === 0 && targetFolderId) {
      await loadCommits(targetFolderId);
    }

    setSelectedFile(filePath);
    setSelectedCommit(null);
    setCompareCommit(null);
    
    // Load file content (this will also load commits and filter them)
    await loadCurrentFileContent(filePath, targetFolderId);
  };

  const handleSelectCommit = async (commit: Commit) => {
    if (!selectedFolder || !selectedFile) return;

    setSelectedCommit(commit);
    
    try {
      setLoading(true);
      
      const newCommit = compareCommit ? compareCommit.hash : undefined;
      const diff = await window.electronAPI.getDiff(
        selectedFolder.id,
        selectedFile,
        commit.hash,
        newCommit
      );
      
      setDiffResult(diff);
    } catch (error) {
      console.error('Failed to get diff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFile = async (filePath: string, commitHash: string) => {
    if (!selectedFolder) return;

    const confirmed = confirm(
      `Are you sure you want to restore "${filePath}" to version ${commitHash.substring(0, 7)}?`
    );

    if (confirmed) {
      try {
        await window.electronAPI.restoreFile(selectedFolder.id, filePath, commitHash);
        alert('File restored successfully!');
        
        // Reload commits
        loadCommits(selectedFolder.id);
      } catch (error) {
        console.error('Failed to restore file:', error);
        alert('Failed to restore file');
      }
    }
  };
  
  const handleCreateFile = async () => {
    if (!selectedFolder || !newFileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    try {
      const result = await window.electronAPI.createFile?.(selectedFolder.path, newFileName.trim());
      
      if (result?.success) {
        const createdFileName = newFileName.trim();
        setShowNewFileDialog(false);
        setNewFileName('');
        
        // Wait for Git to detect the new file and create a commit
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Reload commits to show the new file
        await loadCommits(selectedFolder.id);
        
        // Wait a bit more for the commits to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Select the new file and load its content
        await handleSelectFile(createdFileName);
      } else {
        alert(`Failed to create file: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error creating file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMigrateRepositories = async (folderIds: string[], customPath: string) => {
    console.log('Migrating repositories for folders:', folderIds, 'to:', customPath);
    
    for (const folderId of folderIds) {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) continue;
      
      // Create unique path for this folder's Git repository
      const folderGitPath = `${customPath}/${folder.name}-git`;
      
      console.log(`Migrating ${folder.name} to ${folderGitPath}`);
      
      try {
        const result = await window.electronAPI.migrateGitRepository(folderId, folderGitPath);
        
        if (!result.success) {
          throw new Error(result.error || 'Migration failed');
        }
        
        console.log(`Successfully migrated ${folder.name}`);
      } catch (error) {
        console.error(`Failed to migrate ${folder.name}:`, error);
        throw error;
      }
    }
    
    // Reload folders to reflect the changes
    await loadFolders();
  };

  const handleToggleCompare = async (commit: Commit) => {
    if (compareCommit?.hash === commit.hash) {
      setCompareCommit(null);
      // Refresh to show diff with current
      if (selectedCommit && selectedFile && selectedFolder) {
        try {
          const diff = await window.electronAPI.getDiff(
            selectedFolder.id,
            selectedFile,
            selectedCommit.hash
          );
          setDiffResult(diff);
        } catch (error) {
          console.error('Failed to get diff:', error);
        }
      }
    } else {
      setCompareCommit(commit);
      // Refresh to show diff between two commits
      if (selectedCommit && selectedFile && selectedFolder) {
        try {
          const diff = await window.electronAPI.getDiff(
            selectedFolder.id,
            selectedFile,
            selectedCommit.hash,
            commit.hash
          );
          setDiffResult(diff);
        } catch (error) {
          console.error('Failed to get diff:', error);
        }
      }
    }
  };

  const rightPanelWidth = 100 - leftPanelWidth - centerPanelWidth;
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Folders and Files */}
      <div 
        className="bg-white border-r border-gray-200 flex flex-col overflow-hidden"
        style={{ width: `${leftPanelWidth}%` }}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Folders Watched</h1>
          <div className="flex gap-2">
            <button
              onClick={() => handleRemoveFolder()}
              className={`${selectedFolder ? 'text-red-500 hover:text-red-700' : 'text-gray-300 cursor-not-allowed'}`}
              title="Remove Selected Folder"
              disabled={!selectedFolder}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={() => handleAddFolder()}
              className="text-gray-500 hover:text-gray-700"
              title="Add Folder"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-500 hover:text-gray-700"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <FolderFileTree
            folders={folders}
            allFiles={allFoldersFiles}
            deletedFiles={allFoldersDeletedFiles}
            showDeletedFiles={showDeletedFiles}
            selectedFolder={selectedFolder}
            selectedFile={selectedFile}
            onSelectFolder={handleSelectFolder}
            onSelectFile={(folderId, filePath) => handleSelectFile(filePath, folderId)}
          />
        </div>
        
        {/* Show Deleted Files Checkbox */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showDeletedFiles}
              onChange={(e) => setShowDeletedFiles(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Show deleted files</span>
          </label>
        </div>
      </div>
      
      {/* Left Resizer */}
      <div 
        className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0"
        onMouseDown={handleLeftResize}
        title="Drag to resize"
      />

      {/* Main Content Area - 2 Columns */}
      <div 
        className="flex flex-col overflow-hidden"
        style={{ width: `${centerPanelWidth + rightPanelWidth}%` }}
      >
        {selectedFolder && selectedFile ? (
          <>
            {/* 2-Column Layout: Editor (Center) + Versions (Right) */}
            <div className="flex flex-1 overflow-hidden">
              {/* Center Panel - Editor */}
              <div 
                className="border-r border-gray-200 flex flex-col bg-white overflow-hidden"
                style={{ width: `${(centerPanelWidth / (centerPanelWidth + rightPanelWidth)) * 100}%` }}
              >
                {diffResult ? (
                  <DiffViewer 
                    diffResult={diffResult} 
                    folderPath={selectedFolder?.path}
                    onContentUpdated={(newContent: string) => {
                      console.log('onContentUpdated: Updating content immediately');
                      setDiffResult({
                        ...diffResult,
                        oldContent: newContent,
                        newContent: newContent
                      });
                    }}
                    onContentSaved={async () => {
                      if (selectedFolder && selectedFile) {
                        console.log('onContentSaved: Reloading commits in background');
                        
                        // Just reload commits in background
                        // Don't call loadCurrentFileContent because it reads from Git
                        // and the new commit might not exist yet
                        // onContentUpdated already updated the UI with the saved content
                        await loadCommits(selectedFolder.id);
                        
                        console.log('onContentSaved: Commits reloaded, keeping current displayed content');
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Select a file version to view
                  </div>
                )}
              </div>
              
              {/* Center Resizer */}
              <div 
                className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0"
                onMouseDown={handleCenterResize}
                title="Drag to resize"
              />

              {/* Right Panel - Versions */}
              <div 
                className="flex flex-col bg-gray-50 overflow-hidden"
                style={{ width: `${(rightPanelWidth / (centerPanelWidth + rightPanelWidth)) * 100}%` }}
              >
                <div className="p-3 border-b border-gray-200 bg-white">
                  <h2 className="text-sm font-semibold text-gray-700">Versions</h2>
                  {selectedFile && (
                    <p className="text-xs text-gray-500 truncate mt-1" title={selectedFile}>
                      {selectedFile.split('/').pop()}
                    </p>
                  )}
                </div>
                
                <CommitHistory
                  commits={fileCommits}
                  selectedCommit={selectedCommit}
                  compareCommit={compareCommit}
                  onSelectCommit={handleSelectCommit}
                  onToggleCompare={handleToggleCompare}
                  onSelectCurrent={async () => {
                    // Show current version of the file
                    setSelectedCommit(null);
                    setCompareCommit(null);
                    if (selectedFile && selectedFolder) {
                      await loadCurrentFileContent(selectedFile, selectedFolder.id);
                    }
                  }}
                  loading={loading}
                  showRestore={true}
                  onRestore={(commitHash: string) => {
                    if (selectedFile) {
                      handleRestoreFile(selectedFile, commitHash);
                    }
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-lg">No folder selected</p>
              <p className="text-sm mt-2">Add a folder to start tracking versions</p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          folders={folders}
          onClose={() => setShowSettings(false)}
          onUpdate={() => {
            loadFolders();
            if (selectedFolder) {
              loadCommits(selectedFolder.id);
            }
          }}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={(enabled: boolean) => {
            setAutoRefresh(enabled);
            localStorage.setItem('autoRefresh', String(enabled));
          }}
          defaultGitLocation={defaultGitLocation}
          defaultCustomGitPath={defaultCustomGitPath}
          onDefaultGitLocationChange={(location: 'watched-folder' | 'custom', customPath?: string) => {
            setDefaultGitLocation(location);
            localStorage.setItem('defaultGitLocation', location);
            if (customPath !== undefined) {
              setDefaultCustomGitPath(customPath);
              localStorage.setItem('defaultCustomGitPath', customPath);
            }
          }}
          onShowMigration={() => {
            setShowSettings(false);
            setShowMigration(true);
          }}
        />
      )}
      
      {/* Migration Modal */}
      {showMigration && (
        <GitMigration
          folders={folders}
          onClose={() => setShowMigration(false)}
          onMigrate={handleMigrateRepositories}
        />
      )}

      {/* Reconnect Dialog */}
      {reconnectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
            <h2 className="text-lg font-semibold mb-4">Existing Repository Found</h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-3">
                Found existing Git repository for <span className="font-semibold">"{reconnectDialog.folderName}"</span> {reconnectDialog.location}.
              </p>
              {reconnectDialog.commits && (
                <p className="text-sm text-gray-600 mb-3">{reconnectDialog.commits}</p>
              )}
              <p className="text-sm text-gray-700 font-medium">
                Would you like to reconnect to this existing repository?
              </p>
              <ul className="mt-3 text-sm text-gray-600 space-y-1 ml-4">
                <li>• <span className="font-medium">Yes</span> - Continue with existing history</li>
                <li>• <span className="font-medium">No</span> - Start fresh (existing history will be ignored)</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleReconnectNo}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                No
              </button>
              <button
                onClick={handleReconnectYes}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Folder Dialog */}
      {showRemoveDialog && selectedFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
            <h2 className="text-lg font-semibold mb-4 text-red-600">Remove Folder</h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-3">
                Are you sure you want to remove <span className="font-semibold">"{selectedFolder.name}"</span> from Local Versioning?
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3">
                <p className="text-sm text-blue-800">
                  <strong>Important:</strong> This will only remove the folder from the application.
                </p>
                <ul className="text-xs text-blue-700 mt-2 ml-4 space-y-1">
                  <li>• Your files will NOT be deleted</li>
                  <li>• Version history will be preserved in the Git repository</li>
                  <li>• You can re-add this folder later to reconnect to its history</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRemoveDialog(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFolder}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
              >
                Remove Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">Create New File</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File name:
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFile();
                  } else if (e.key === 'Escape') {
                    setShowNewFileDialog(false);
                    setNewFileName('');
                  }
                }}
                placeholder="example.md"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: You can include folders like "subfolder/file.md"
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFileDialog(false);
                  setNewFileName('');
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

