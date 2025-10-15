import React, { useState, useMemo } from 'react';

interface FileTreeViewProps {
  files: string[];
  selectedFile: string | null;
  commits: any[];
  onSelectFile: (filePath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
  versionCount?: number;
}

const FileTreeView: React.FC<FileTreeViewProps> = ({
  files,
  selectedFile,
  commits,
  onSelectFile
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand folders that contain the selected file
  React.useEffect(() => {
    if (selectedFile) {
      const newExpanded = new Set(expandedFolders);
      const parts = selectedFile.split('/');
      
      // Expand all parent folders of the selected file
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        newExpanded.add(folderPath);
      }
      
      setExpandedFolders(newExpanded);
    }
  }, [selectedFile]);

  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', isFile: false, children: [] };

    files.forEach(filePath => {
      const parts = filePath.split('/').filter(p => p);
      let currentNode = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        let childNode = currentNode.children.find(c => c.name === part);
        
        if (!childNode) {
          childNode = {
            name: part,
            path: currentPath,
            isFile,
            children: [],
            versionCount: isFile ? commits.filter(c => c.changedFiles.includes(filePath)).length : undefined
          };
          currentNode.children.push(childNode);
        }
        
        currentNode = childNode;
      });
    });

    // Sort: folders first, then files, alphabetically
    const sortNodes = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.isFile === b.isFile) {
          return a.name.localeCompare(b.name);
        }
        return a.isFile ? 1 : -1;
      });
      node.children.forEach(sortNodes);
    };
    sortNodes(root);

    return root.children;
  }, [files, commits]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
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

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 20 + 12;

    if (node.isFile) {
      return (
        <div
          key={node.path}
          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
            isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation(); // Prevent parent folder collapse
            onSelectFile(node.path);
          }}
        >
          <div
            className="flex items-center gap-2 py-2 pr-3"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <span className="text-base">{getFileIcon(node.name)}</span>
            <span className="text-sm flex-1 truncate">{node.name}</span>
            <span className="text-xs text-gray-400">
              {node.versionCount} ver{node.versionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      );
    }

    // Folder
    const fileCount = node.children.filter(c => c.isFile).length;
    const folderCount = node.children.filter(c => !c.isFile).length;

    return (
      <div key={node.path}>
        <div
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            toggleFolder(node.path);
          }}
        >
          <div
            className="flex items-center gap-2 py-2 pr-3"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <span className="text-gray-500 text-sm">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span className="text-base">📁</span>
            <span className="text-sm font-medium flex-1">{node.name}</span>
            <span className="text-xs text-gray-400">
              {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? 's' : ''}`}
              {folderCount > 0 && fileCount > 0 && ', '}
              {folderCount > 0 && `${folderCount} folder${folderCount !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="select-none">
      {fileTree.map(node => renderNode(node, 0))}
    </div>
  );
};

export default FileTreeView;

