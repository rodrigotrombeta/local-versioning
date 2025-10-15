import React from 'react';
import type { Commit } from '../types';

interface CommitHistoryProps {
  commits: Commit[];
  selectedCommit: Commit | null;
  compareCommit: Commit | null;
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
      )}
    </div>
  );
};

export default CommitHistory;

