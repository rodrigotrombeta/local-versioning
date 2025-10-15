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
  const [allFoldersFiles, setAllFoldersFiles] = useState<Record<string, string[]>>({}); // New: files for all folders
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
    for (const folder of targetFolders) {
      try {
        const uniqueFiles = new Set<string>();
        
        // Get real files from file system (primary source)
        if (window.electronAPI.listFolderFiles) {
          try {
            const realFiles = await window.electronAPI.listFolderFiles(folder.path);
            realFiles.forEach((file: string) => uniqueFiles.add(file));
          } catch (err) {
            console.warn(`Failed to list real files for folder ${folder.name}:`, err);
          }
        }
        
        // Also include files from commit history (in case some files were deleted)
        try {
          const loadedCommits = await window.electronAPI.getCommits(folder.id, 100);
          loadedCommits.forEach((commit: Commit) => {
            commit.changedFiles.forEach((file: string) => uniqueFiles.add(file));
          });
        } catch (err) {
          console.warn(`Failed to load commits for folder ${folder.name}:`, err);
        }
        
        filesMap[folder.id] = Array.from(uniqueFiles).sort();
      } catch (error) {
        console.error(`Failed to load files for folder ${folder.name}:`, error);
        filesMap[folder.id] = [];
      }
    }
    
    setAllFoldersFiles(filesMap);
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

  const loadCurrentFileContent = async (filePath: string) => {
    if (!selectedFolder) return;
    
    try {
      setLoading(true);
      
      // Filter commits that contain this file
      const commitsWithFile = commits.filter(commit => 
        commit.changedFiles.includes(filePath)
      );
      
      let content = '';
      
      if (commitsWithFile.length > 0) {
        // Get the latest version from Git (most recent commit)
        const latestCommit = commitsWithFile[0];
        content = await window.electronAPI.getFileContent(
          selectedFolder.id,
          latestCommit.hash,
          filePath
        );
      } else {
        // No commits yet - read file directly from disk
        if (window.electronAPI.readFileFromDisk) {
          const result = await window.electronAPI.readFileFromDisk(
            selectedFolder.path,
            filePath
          );
          if (result.success && result.content) {
            content = result.content;
          } else {
            console.error('Failed to read file from disk:', result.error);
            return;
          }
        } else {
          console.error('readFileFromDisk API not available');
          return;
        }
      }
      
      // Show as both old and new (no diff yet, just content)
      setDiffResult({
        oldContent: content,
        newContent: content,
        fileName: filePath.split('/').pop() || filePath,
        oldCommit: 'current',
        newCommit: 'current'
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

    setSelectedFile(filePath);
    setSelectedCommit(null);
    setCompareCommit(null);
    
    // Filter commits that contain this file
    const commitsWithFile = commits.filter(commit => 
      commit.changedFiles.includes(filePath)
    );
    setFileCommits(commitsWithFile);
    
    // Show current file content immediately
    await loadCurrentFileContent(filePath);
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Folders and Files */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Folders & Files</h1>
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
        
        <FolderFileTree
          folders={folders}
          allFiles={allFoldersFiles}
          selectedFolder={selectedFolder}
          selectedFile={selectedFile}
          onSelectFolder={handleSelectFolder}
          onSelectFile={(folderId, filePath) => handleSelectFile(filePath, folderId)}
        />
      </div>

      {/* Main Content Area - 2 Columns */}
      <div className="flex-1 flex flex-col">
        {selectedFolder && selectedFile ? (
          <>
            {/* 2-Column Layout: Editor (Center) + Versions (Right) */}
            <div className="flex flex-1 overflow-hidden">
              {/* Center Panel - Editor (larger) */}
              <div className="flex-1 border-r border-gray-200 flex flex-col bg-white">
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

              {/* Right Panel - Versions (thin strip) */}
              <div className="w-64 flex flex-col bg-gray-50">
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
                    if (selectedFile) {
                      await loadCurrentFileContent(selectedFile);
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

