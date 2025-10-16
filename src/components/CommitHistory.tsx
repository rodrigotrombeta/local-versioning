import React from 'react';
import type { Commit, FileStorageInfo } from '../types';

interface CommitHistoryProps {
  commits: Commit[];
  selectedCommit: Commit | null;
  compareCommit: Commit | null;
  fileStorageInfo: FileStorageInfo | null;
  formatSize: (bytes: number) => string;
  onSelectCommit: (commit: Commit) => void;
  onToggleCompare: (commit: Commit) => void;
  onSelectCurrent?: () => void;
  loading: boolean;
  showRestore?: boolean;
  onRestore?: (commitHash: string) => void;
}

const CommitHistory: React.FC<CommitHistoryProps> = ({
  commits,
  selectedCommit,
  compareCommit,
  fileStorageInfo,
  formatSize,
  onSelectCommit,
  onToggleCompare,
  onSelectCurrent,
  loading,
  showRestore = false,
  onRestore
}) => {
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };
  
  // Generate size trend graph
  const generateSizeTrend = () => {
    if (!fileStorageInfo || fileStorageInfo.sizeByCommit.length === 0) {
      return '';
    }
    
    const sizes = fileStorageInfo.sizeByCommit.map(s => s.size);
    const maxSize = Math.max(...sizes);
    const bars = '▁▂▃▄▅▆▇█';
    
    return sizes.map(size => {
      const ratio = size / maxSize;
      const barIndex = Math.min(Math.floor(ratio * bars.length), bars.length - 1);
      return bars[barIndex];
    }).join('');
  };
  
  // Determine trend direction
  const getSizeTrend = () => {
    if (!fileStorageInfo || fileStorageInfo.sizeByCommit.length < 2) {
      return 'stable';
    }
    
    const recent = fileStorageInfo.sizeByCommit[0].size;
    const older = fileStorageInfo.sizeByCommit[fileStorageInfo.sizeByCommit.length - 1].size;
    
    if (recent > older * 1.1) return 'growing';
    if (recent < older * 0.9) return 'shrinking';
    return 'stable';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">Loading commits...</div>
        </div>
      ) : commits.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <p>No versions yet</p>
            <p className="text-sm mt-2">Select a file to view its version history</p>
          </div>
        </div>
      ) : (
        <>
          {/* Storage Info */}
          {fileStorageInfo && (
            <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">File size:</span>
                  <span className="font-medium text-gray-900">{formatSize(fileStorageInfo.currentSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Versions size:</span>
                  <span className="font-medium text-gray-900">
                    {formatSize(fileStorageInfo.versionsSize)} ({fileStorageInfo.versionCount})
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">Total:</span>
                  <span className="font-semibold text-gray-900">{formatSize(fileStorageInfo.totalSize)}</span>
                </div>
              </div>
              
              {/* Size Trend Graph */}
              {fileStorageInfo.sizeByCommit.length > 1 && (
                <div className="pt-2 border-t border-gray-300">
                  <div className="text-xs text-gray-600 mb-1">Size trend:</div>
                  <div className="font-mono text-sm text-gray-700">
                    {generateSizeTrend()} <span className="text-xs text-gray-500">({getSizeTrend()})</span>
                  </div>
                </div>
              )}
              
              {/* Warning for large files */}
              {fileStorageInfo.totalSize > 10 * 1024 * 1024 && (
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                    <svg className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="font-semibold text-orange-800">Large file history ({formatSize(fileStorageInfo.totalSize)})</div>
                      <div className="text-orange-700 mt-0.5">Consider using the cleanup button to remove old versions and save space.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="divide-y-2 divide-gray-200">
            {/* Current Version Item */}
            <div
            className={`p-2 cursor-pointer transition-colors ${
              !selectedCommit ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
            }`}
            onClick={() => {
              if (onSelectCurrent) {
                onSelectCurrent();
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Current Version
                </span>
              </div>
            </div>
          </div>
          
          {/* Previous Versions */}
          {commits.map((commit, index) => {
            const isSelected = selectedCommit?.hash === commit.hash;
            
            // Extract just the timestamp from the message
            // Format: "Auto-commit: YYYY-MM-DD HH:MM:SS - [filename]..."
            const timestampMatch = commit.message.match(/Auto-commit:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
            const displayMessage = timestampMatch ? `Auto-commit: ${timestampMatch[1]}` : commit.message;
            
            // Get size for this commit
            const commitSize = fileStorageInfo?.sizeByCommit.find(s => s.hash === commit.hash)?.size;
            
            return (
              <div
                key={commit.hash}
                className={`p-2 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                  isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent'
                }`}
                onClick={() => onSelectCommit(commit)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{displayMessage}</p>
                    {commitSize !== undefined && (
                      <p className="text-xs text-gray-500 mt-0.5">{formatSize(commitSize)}</p>
                    )}
                  </div>
                  
                  {showRestore && onRestore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(commit.hash);
                      }}
                      className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                      title="Restore to this version"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
};

export default CommitHistory;

