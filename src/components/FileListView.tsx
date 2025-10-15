import React from 'react';

interface FileListViewProps {
  files: string[];
  selectedFile: string | null;
  commits: any[];
  onSelectFile: (filePath: string) => void;
  fileStatuses?: Map<string, boolean>; // true = exists, false = removed
}

const FileListView: React.FC<FileListViewProps> = ({
  files,
  selectedFile,
  commits,
  onSelectFile,
  fileStatuses
}) => {
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
    <div className="divide-y divide-gray-100">
      {files.map(filePath => {
        const isSelected = selectedFile === filePath;
        const fileName = filePath.split('/').pop() || filePath;
        const directory = filePath.substring(0, filePath.length - fileName.length);
        const fileCommitCount = commits.filter(c => c.changedFiles.includes(filePath)).length;
        const isRemoved = fileStatuses ? !fileStatuses.get(filePath) : false;
        
        return (
          <div
            key={filePath}
            className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
            } ${isRemoved ? 'opacity-60' : ''}`}
            onClick={() => onSelectFile(filePath)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFileIcon(filePath)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isRemoved ? 'line-through text-gray-400' : ''}`}>
                      {fileName}
                      {isRemoved && <span className="ml-2 text-xs text-red-500">(removed)</span>}
                    </p>
                    {directory && (
                      <p className="text-xs text-gray-500 truncate">{directory}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-7">
                  {fileCommitCount} version{fileCommitCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FileListView;

