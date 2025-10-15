import React from 'react';
import type { Commit } from '../types';

interface TimelineEntry {
  commit: Commit;
  folderName?: string;
  folderId?: string;
}

interface TimelineProps {
  commits: Commit[];
  allFoldersCommits?: Array<{ commit: Commit; folderName: string; folderId: string }>;
  onSelectCommit: (commit: Commit, file: string, folderId?: string) => void;
  selectedCommit: Commit | null;
  scope: 'current' | 'all';
  onScopeChange: (scope: 'current' | 'all') => void;
  currentFolderName?: string;
}

const Timeline: React.FC<TimelineProps> = ({ 
  commits, 
  allFoldersCommits, 
  onSelectCommit, 
  selectedCommit, 
  scope, 
  onScopeChange,
  currentFolderName 
}) => {
  const [expandedCommits, setExpandedCommits] = React.useState<Set<string>>(new Set());
  
  const toggleCommitExpansion = (commitHash: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(commitHash)) {
      newExpanded.delete(commitHash);
    } else {
      newExpanded.add(commitHash);
    }
    setExpandedCommits(newExpanded);
  };
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
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

  // Determine which commits to display based on scope
  const displayEntries: TimelineEntry[] = React.useMemo(() => {
    console.log('Timeline scope:', scope);
    console.log('Current commits count:', commits.length);
    console.log('All folders commits count:', allFoldersCommits?.length || 0);
    
    if (scope === 'all' && allFoldersCommits && allFoldersCommits.length > 0) {
      console.log('Showing all folders commits');
      return allFoldersCommits.map(item => ({
        commit: item.commit,
        folderName: item.folderName,
        folderId: item.folderId
      }));
    } else {
      console.log('Showing current folder commits');
      return commits.map(commit => ({ commit }));
    }
  }, [scope, commits, allFoldersCommits]);

  if (displayEntries.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Scope Toggle */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <div className="flex gap-2">
              <button
                onClick={() => onScopeChange('current')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  scope === 'current'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Current folder
              </button>
              <button
                onClick={() => onScopeChange('all')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  scope === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All files tracked
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <p>No changes yet</p>
            <p className="text-sm mt-2">Changes will appear here as you modify files</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Scope Toggle */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Show:</span>
          <div className="flex gap-2">
            <button
              onClick={() => onScopeChange('current')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                scope === 'current'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Current folder {currentFolderName && `(${currentFolderName})`}
            </button>
            <button
              onClick={() => onScopeChange('all')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                scope === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All files tracked
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="py-4">
          {displayEntries.map((entry, index) => {
            const { commit, folderName, folderId } = entry;
            const isFirst = index === 0;
            const prevEntry = index > 0 ? displayEntries[index - 1] : null;
            const currentDate = new Date(commit.date).toDateString();
            const prevDate = prevEntry ? new Date(prevEntry.commit.date).toDateString() : null;
            const showDateHeader = isFirst || currentDate !== prevDate;

            return (
              <div key={`${folderId || 'current'}-${commit.hash}`}>
                {/* Date Header */}
                {showDateHeader && (
                  <div className="sticky top-0 bg-gray-100 border-y border-gray-300 px-4 py-2 z-10">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {formatDate(commit.date)}
                    </h3>
                  </div>
                )}

                {/* Timeline Entry */}
                <div className="relative pl-8 pr-4 py-3 hover:bg-gray-100 transition-colors">
                  {/* Timeline Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300" />
                  
                  {/* Timeline Dot */}
                  <div className="absolute left-2.5 top-5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />

                  {/* Time and Folder Name (if showing all folders) */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {formatTime(commit.date)}
                    </span>
                    {folderName && scope === 'all' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs font-medium text-blue-600">
                          📁 {folderName}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Files */}
                  <div className="space-y-1">
                    {commit.changedFiles.length === 1 ? (
                      /* Single file - show directly */
                      (() => {
                        const file = commit.changedFiles[0];
                        const fileName = file.split('/').pop() || file;
                        const directory = file.substring(0, file.length - fileName.length);
                        const isSelected = selectedCommit?.hash === commit.hash;

                        return (
                          <div
                            key={`${commit.hash}-0`}
                            className={`p-2 rounded cursor-pointer border transition-all ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-300 shadow-sm' 
                                : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                            }`}
                            onClick={() => onSelectCommit(commit, file, folderId)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{getFileIcon(fileName)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{fileName}</p>
                                {directory && (
                                  <p className="text-xs text-gray-500 truncate">{directory}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* Multiple files - show summary with expand/collapse */
                      <div>
                        {/* Summary Card */}
                        <div
                          className="p-2 rounded border bg-white border-gray-200 hover:border-blue-200 cursor-pointer transition-all"
                          onClick={() => toggleCommitExpansion(commit.hash)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📦</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                Modified {commit.changedFiles.length} files
                              </p>
                              <p className="text-xs text-gray-500">
                                Click to {expandedCommits.has(commit.hash) ? 'collapse' : 'expand'}
                              </p>
                            </div>
                            <span className="text-gray-400 text-sm">
                              {expandedCommits.has(commit.hash) ? '▼' : '▶'}
                            </span>
                          </div>
                        </div>

                        {/* Expanded File List */}
                        {expandedCommits.has(commit.hash) && (
                          <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-200 pl-2">
                            {commit.changedFiles.map((file, fileIndex) => {
                              const fileName = file.split('/').pop() || file;
                              const directory = file.substring(0, file.length - fileName.length);
                              const isSelected = selectedCommit?.hash === commit.hash;

                              return (
                                <div
                                  key={`${commit.hash}-${fileIndex}`}
                                  className={`p-2 rounded cursor-pointer border transition-all ${
                                    isSelected 
                                      ? 'bg-blue-50 border-blue-300 shadow-sm' 
                                      : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectCommit(commit, file, folderId);
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{getFileIcon(fileName)}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{fileName}</p>
                                      {directory && (
                                        <p className="text-xs text-gray-500 truncate">{directory}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Commit Message (if not auto-generated) */}
                  {!commit.message.startsWith('Auto-commit:') && (
                    <div className="mt-2 text-xs text-gray-600 italic">
                      {commit.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Timeline;

