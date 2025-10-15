import React from 'react';
import type { Commit } from '../types';

interface FileTreeProps {
  commit: Commit | null;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onRestoreFile: (filePath: string, commitHash: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  commit,
  selectedFile,
  onSelectFile,
  onRestoreFile
}) => {
  if (!commit) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>Select a commit to view files</p>
        </div>
      </div>
    );
  }

  if (commit.changedFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>No files in this commit</p>
        </div>
      </div>
    );
  }

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return '📄';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'css':
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return '🖼️';
      default:
        return '📄';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-gray-100">
        {commit.changedFiles.map(filePath => {
          const isSelected = selectedFile === filePath;
          const fileName = filePath.split('/').pop() || filePath;
          const directory = filePath.substring(0, filePath.length - fileName.length);
          
          return (
            <div
              key={filePath}
              className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
              onClick={() => onSelectFile(filePath)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFileIcon(filePath)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileName}</p>
                      {directory && (
                        <p className="text-xs text-gray-500 truncate">{directory}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestoreFile(filePath, commit.hash);
                  }}
                  className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                  title="Restore this file"
                >
                  Restore
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileTree;

