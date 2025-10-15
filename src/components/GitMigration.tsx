import React, { useState } from 'react';
import type { WatchedFolder } from '../types';

interface GitMigrationProps {
  folders: WatchedFolder[];
  onClose: () => void;
  onMigrate: (folderIds: string[], customPath: string) => Promise<void>;
}

const GitMigration: React.FC<GitMigrationProps> = ({ folders, onClose, onMigrate }) => {
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [customPath, setCustomPath] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleFolder = (folderId: string) => {
    const newSelected = new Set(selectedFolders);
    if (newSelected.has(folderId)) {
      newSelected.delete(folderId);
    } else {
      newSelected.add(folderId);
    }
    setSelectedFolders(newSelected);
  };

  const handleMigrate = async () => {
    if (selectedFolders.size === 0) {
      setError('Please select at least one folder to migrate');
      return;
    }

    if (!customPath.trim()) {
      setError('Please specify a custom location');
      return;
    }

    try {
      setMigrating(true);
      setError(null);
      await onMigrate(Array.from(selectedFolders), customPath);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const foldersWithLocalGit = folders.filter(f => !f.customGitPath);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Migrate Git Repositories</h2>
          <p className="text-sm text-gray-600 mt-2">
            Move Git repositories from watched folders to a centralized custom location
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ How Migration Works</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Each folder keeps its own separate Git repository</li>
              <li>• Repositories are moved to: <code className="bg-blue-100 px-1 rounded">custom-path/folder-name-git/</code></li>
              <li>• All version history is preserved</li>
              <li>• Original .git directories are removed after successful migration</li>
              <li>• Watched folders will continue to work normally</li>
            </ul>
          </div>

          {/* Custom Location */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Custom Git Repository Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/path/to/centralized/git/repos"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={async () => {
                  const path = await window.electronAPI.selectFolder();
                  if (path) setCustomPath(path);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Git repositories will be organized as: <code>{customPath || '/custom/path'}/folder-name-git/</code>
            </p>
          </div>

          {/* Folder Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Folders to Migrate ({selectedFolders.size} selected)
            </label>
            
            {foldersWithLocalGit.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No folders with local Git repositories found</p>
                <p className="text-xs mt-2">All folders are already using custom locations</p>
              </div>
            ) : (
              <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                {foldersWithLocalGit.map(folder => {
                  const isSelected = selectedFolders.has(folder.id);
                  const gitPath = folder.customGitPath || `${folder.path}/.git`;
                  
                  return (
                    <div
                      key={folder.id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFolder(folder.id)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-gray-500 truncate">Watched: {folder.path}</p>
                          <p className="text-xs text-gray-400 truncate">Current .git: {gitPath}</p>
                          {customPath && (
                            <p className="text-xs text-blue-600 truncate mt-1">
                              → Will move to: {customPath}/{folder.name}-git/
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warning */}
          {selectedFolders.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Important</h3>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>• The watcher will be stopped during migration</li>
                <li>• Make sure no files are being edited during this process</li>
                <li>• Migration cannot be undone automatically</li>
                <li>• A backup of .git directories is recommended</li>
              </ul>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">❌ {error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">✅ Migration completed successfully!</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={migrating}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMigrate}
            disabled={migrating || selectedFolders.size === 0 || !customPath.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {migrating ? 'Migrating...' : `Migrate ${selectedFolders.size} Folder${selectedFolders.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitMigration;

