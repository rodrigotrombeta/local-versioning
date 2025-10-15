import React from 'react';
import type { WatchedFolder } from '../types';

interface FolderListProps {
  folders: WatchedFolder[];
  selectedFolder: WatchedFolder | null;
  onSelectFolder: (folder: WatchedFolder) => void;
  onAddFolder: () => void;
  onRemoveFolder: (folderId: string) => void;
}

const FolderList: React.FC<FolderListProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  onAddFolder,
  onRemoveFolder
}) => {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {folders.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No folders being watched
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {folders.map(folder => (
              <div
                key={folder.id}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedFolder?.id === folder.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => onSelectFolder(folder)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="text-sm font-medium truncate">{folder.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${folder.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-500">
                        {folder.commitStrategy === 'on-save' ? 'On Save' : `Every ${folder.periodicInterval}m`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove "${folder.name}" from watched folders?`)) {
                        onRemoveFolder(folder.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 ml-2"
                    title="Remove folder"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onAddFolder}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Folder
        </button>
      </div>
    </div>
  );
};

export default FolderList;

