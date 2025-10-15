import React, { useState, useEffect } from 'react';
import type { WatchedFolder } from '../types';

interface SettingsProps {
  folders: WatchedFolder[];
  onClose: () => void;
  onUpdate: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  defaultGitLocation: 'watched-folder' | 'custom';
  defaultCustomGitPath: string;
  onDefaultGitLocationChange: (location: 'watched-folder' | 'custom', customPath?: string) => void;
  onShowMigration: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  folders,
  onClose, 
  onUpdate, 
  autoRefresh, 
  onAutoRefreshChange,
  defaultGitLocation,
  defaultCustomGitPath,
  onDefaultGitLocationChange,
  onShowMigration
}) => {
  // Navigation state
  const [activeView, setActiveView] = useState<'menu' | 'global' | 'folder-list' | 'folder-settings'>('menu');
  const [selectedFolder, setSelectedFolder] = useState<WatchedFolder | null>(null);
  
  // Folder settings state
  const [isActive, setIsActive] = useState(true);
  const [commitStrategy, setCommitStrategy] = useState<'on-save' | 'periodic'>('on-save');
  const [periodicInterval, setPeriodicInterval] = useState(5);
  const [ignorePatterns, setIgnorePatterns] = useState<string>('');
  const [watchSubfolders, setWatchSubfolders] = useState(true);
  const [customGitPath, setCustomGitPath] = useState<string>('');

  useEffect(() => {
    if (selectedFolder) {
      setIsActive(selectedFolder.isActive !== false);
      setCommitStrategy(selectedFolder.commitStrategy);
      setPeriodicInterval(selectedFolder.periodicInterval || 5);
      setIgnorePatterns(selectedFolder.ignorePatterns.join('\n'));
      setWatchSubfolders(selectedFolder.watchSubfolders !== false);
      setCustomGitPath(selectedFolder.customGitPath || '');
    }
  }, [selectedFolder]);
  
  const handleSelectFolder = (folder: WatchedFolder) => {
    setSelectedFolder(folder);
    setActiveView('folder-settings');
  };
  
  const handleBack = () => {
    if (activeView === 'folder-settings') {
      setActiveView('folder-list');
      setSelectedFolder(null);
    } else {
      setActiveView('menu');
    }
  };

  const handleSave = async () => {
    if (!selectedFolder) return;

    try {
      const patterns = ignorePatterns
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const newCustomGitPath = customGitPath.trim() || undefined;
      const oldCustomGitPath = selectedFolder.customGitPath;
      
      // Check if Git path has changed
      const gitPathChanged = newCustomGitPath !== oldCustomGitPath;
      
      if (gitPathChanged) {
        // Determine migration paths
        let targetGitPath: string;
        let migrationMessage: string;
        
        if (newCustomGitPath) {
          // Moving TO custom location
          targetGitPath = `${newCustomGitPath}/${selectedFolder.name}-git`;
          migrationMessage = `This will MOVE the existing Git repository to:\n${targetGitPath}`;
        } else {
          // Moving BACK TO default location (inside watched folder)
          targetGitPath = `${selectedFolder.path}/.git`;
          migrationMessage = `This will MOVE the existing Git repository back to:\n${targetGitPath}\n(inside the watched folder)`;
        }
        
        const confirmMigration = confirm(
          `You're changing the Git repository location for "${selectedFolder.name}".\n\n` +
          migrationMessage + `\n\n` +
          `The watcher will be stopped and restarted during this process.\n\n` +
          `Do you want to proceed?`
        );
        
        if (!confirmMigration) {
          return; // User cancelled
        }
        
        // Perform migration
        try {
          const result = await window.electronAPI.migrateGitRepository(selectedFolder.id, targetGitPath);
          
          if (!result.success) {
            alert(`Migration failed: ${result.error || 'Unknown error'}\n\nSettings were not saved.`);
            return;
          }
          
          console.log('Migration successful to:', targetGitPath);
        } catch (error) {
          alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nSettings were not saved.`);
          return;
        }
      }

      // Update other settings (only if no migration was done)
      if (!gitPathChanged) {
        await window.electronAPI.updateFolder(selectedFolder.id, {
          isActive,
          commitStrategy,
          periodicInterval,
          ignorePatterns: patterns,
          watchSubfolders,
          customGitPath: newCustomGitPath
        });
      } else {
        // If migration happened, only update non-git settings
        await window.electronAPI.updateFolder(selectedFolder.id, {
          isActive,
          commitStrategy,
          periodicInterval,
          ignorePatterns: patterns,
          watchSubfolders
        });
      }

      // Trigger UI reload
      await onUpdate();
      setActiveView('menu');
      
      if (gitPathChanged) {
        alert(
          'Git repository migrated successfully!\n\n' +
          'Note: If a repository already existed at the target location, ' +
          'the system automatically kept the one with the most recent changes ' +
          'and created a timestamped backup of the older one.\n\n' +
          'The application will now reload your commit history.'
        );
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings');
    }
  };

  const renderHeader = () => {
    let title = 'Settings';
    if (activeView === 'global') title = 'Global Settings';
    else if (activeView === 'folder-list') title = 'Folder Settings';
    else if (activeView === 'folder-settings' && selectedFolder) title = `Settings - ${selectedFolder.name}`;
    
    return (
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeView !== 'menu' && (
            <button
              onClick={handleBack}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="p-6 space-y-4">
      <button
        onClick={() => setActiveView('global')}
        className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Global Settings</h3>
            <p className="text-sm text-gray-500 mt-1">
              Auto-refresh, default Git location, and bulk migration tools
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      
      <button
        onClick={() => setActiveView('folder-list')}
        className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Folder Settings</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure commit strategy, Git location, and ignore patterns for each folder
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  );

  const renderGlobalSettings = () => (
    <div className="p-6 space-y-6">
      {/* Auto-Refresh */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => onAutoRefreshChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium">Auto-Refresh contents</span>
            <p className="text-xs text-gray-500">
              Automatically update the file list when changes are detected
            </p>
          </div>
        </label>
      </div>

      {/* Default Git Location for New Folders */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Default Git Location for New Folders</h3>
        <p className="text-xs text-gray-500 mb-3">
          Choose where to store Git repositories when adding new folders
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="defaultGitLocation"
              checked={defaultGitLocation === 'watched-folder'}
              onChange={() => onDefaultGitLocationChange('watched-folder')}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium">Inside watched folder</span>
              <p className="text-xs text-gray-500">
                Creates .git directory in the folder being watched (standard behavior)
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="defaultGitLocation"
              checked={defaultGitLocation === 'custom'}
              onChange={() => onDefaultGitLocationChange('custom', defaultCustomGitPath)}
              className="mt-1"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Custom centralized location</span>
              <p className="text-xs text-gray-500 mb-2">
                Store all Git repositories in a single location
              </p>
              
              {defaultGitLocation === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={defaultCustomGitPath}
                    onChange={(e) => onDefaultGitLocationChange('custom', e.target.value)}
                    placeholder="/path/to/centralized/repos"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.selectFolder();
                      if (path) {
                        onDefaultGitLocationChange('custom', path);
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                  >
                    Browse
                  </button>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Migration Tool */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold mb-2">Bulk Migration Tool</h3>
        <p className="text-xs text-gray-500 mb-3">
          Migrate MULTIPLE folders at once to a centralized custom location with checkboxes to select which folders to move
        </p>
        <button
          onClick={onShowMigration}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          Open Bulk Migration Tool
        </button>
        <p className="text-xs text-gray-400 mt-2">
          💡 Tip: To migrate just one folder, use Folder Settings → select folder → Git Repository Location
        </p>
      </div>
    </div>
  );

  const renderFolderList = () => (
    <div className="p-6">
      {folders.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No folders added yet</p>
          <p className="text-xs text-gray-500 mt-2">Add a folder from the main window to configure its settings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => handleSelectFolder(folder)}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{folder.name}</h3>
                  <p className="text-xs text-gray-500 truncate mt-1">{folder.path}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span>Strategy: {folder.commitStrategy === 'on-save' ? 'On Save' : `Every ${folder.periodicInterval}min`}</span>
                    <span>•</span>
                    <span>{folder.watchSubfolders ? 'Includes subfolders' : 'Top level only'}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderFolderSettings = () => {
    if (!selectedFolder) return null;

    return (
      <>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Folder</h3>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium">{selectedFolder.name}</p>
              <p className="text-xs text-gray-500 mt-1">{selectedFolder.path}</p>
            </div>
          </div>

          {/* Auto-commit Enable/Disable */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Auto-commit</h3>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium text-sm">Enable automatic versioning</p>
                <p className="text-xs text-gray-500">
                  When enabled, changes will be automatically tracked and saved. 
                  The <span className={isActive ? 'text-green-600 font-semibold' : 'text-gray-600 font-semibold'}>
                    {isActive ? 'green' : 'gray'}
                  </span> indicator shows the current status.
                </p>
              </div>
            </label>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Commit Strategy</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="strategy"
                  value="on-save"
                  checked={commitStrategy === 'on-save'}
                  onChange={(e) => setCommitStrategy(e.target.value as 'on-save')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-sm">On Save</p>
                  <p className="text-xs text-gray-500">
                    Automatically commit changes 2 seconds after files are saved
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="strategy"
                  value="periodic"
                  checked={commitStrategy === 'periodic'}
                  onChange={(e) => setCommitStrategy(e.target.value as 'periodic')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">Periodic</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Commit changes at regular intervals
                  </p>
                  {commitStrategy === 'periodic' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">Every</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={periodicInterval}
                        onChange={(e) => setPeriodicInterval(parseInt(e.target.value) || 5)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <label className="text-xs text-gray-600">minutes</label>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Watching Options</h3>
            <div className="mb-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={watchSubfolders}
                  onChange={(e) => setWatchSubfolders(e.target.checked)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-sm">Include files in subfolders</p>
                  <p className="text-xs text-gray-500">
                    Watch and track changes in all subdirectories recursively
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Git Repository Location</h3>
            <p className="text-xs text-gray-500 mb-3">
              Choose where to store the Git repository for this folder
            </p>
            
            {/* Quick Selection Buttons */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Quick Select:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomGitPath('')}
                  className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
                    !customGitPath
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium">Inside Watched Folder</div>
                    <div className="text-xs text-gray-500 truncate">{selectedFolder.path}/.git</div>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    const path = await window.electronAPI.selectFolder();
                    if (path) {
                      setCustomGitPath(path);
                    }
                  }}
                  className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
                    customGitPath
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium">Custom Location</div>
                    <div className="text-xs text-gray-500">Choose a different folder</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Custom Path Input (shown when custom location is selected) */}
            {customGitPath && (
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Custom Path:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customGitPath}
                    onChange={(e) => setCustomGitPath(e.target.value)}
                    placeholder="/path/to/centralized/repos"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.selectFolder();
                      if (path) {
                        setCustomGitPath(path);
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Repository will be stored as: <code className="bg-gray-100 px-1">{customGitPath}/{selectedFolder.name}-git</code>
                </p>
              </div>
            )}
            
            {/* Current Status */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-semibold text-blue-800 mb-1">📍 Current Location:</p>
              {selectedFolder.customGitPath ? (
                <p className="text-blue-700 font-mono break-all">{selectedFolder.customGitPath}</p>
              ) : (
                <p className="text-blue-700">{selectedFolder.path}/.git (inside watched folder)</p>
              )}
            </div>
            
            {/* Warning */}
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
              <p className="text-orange-700 font-medium">
                ⚠️ Changing this will automatically MOVE your existing Git repository when you click Save
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Ignore Patterns</h3>
            <p className="text-xs text-gray-500 mb-2">
              Enter glob patterns to ignore (one per line)
            </p>
            <textarea
              value={ignorePatterns}
              onChange={(e) => setIgnorePatterns(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded font-mono text-xs"
              placeholder="**/node_modules/**&#10;**/.git/**&#10;**/.DS_Store&#10;**/*.tmp&#10;**/*.log"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default patterns: node_modules, .git, .DS_Store, .tmp, .log files
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={() => {
              setActiveView('folder-list');
              setSelectedFolder(null);
            }}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {renderHeader()}
        
        {activeView === 'menu' && renderMenu()}
        {activeView === 'global' && renderGlobalSettings()}
        {activeView === 'folder-list' && renderFolderList()}
        {activeView === 'folder-settings' && renderFolderSettings()}
      </div>
    </div>
  );
};

export default Settings;
