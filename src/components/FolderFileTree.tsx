import React, { useState, useEffect } from 'react';
import type { WatchedFolder } from '../types';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FolderFileTreeProps {
  folders: WatchedFolder[];
  allFiles: Record<string, string[]>; // folderId -> file paths
  selectedFolder: WatchedFolder | null;
  selectedFile: string | null;
  onSelectFolder: (folder: WatchedFolder) => void;
  onSelectFile: (folderId: string, filePath: string) => void;
}

const FolderFileTree: React.FC<FolderFileTreeProps> = ({
  folders,
  allFiles,
  selectedFolder,
  selectedFile,
  onSelectFolder,
  onSelectFile,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Sort nodes: directories first (alphabetically), then files (alphabetically)
  const sortFileNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      // Directories come before files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      // Within same type, sort alphabetically (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  // Build tree structure from flat file list
  const buildFileTree = (files: string[]): FileNode[] => {
    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    files.forEach((filePath) => {
      const parts = filePath.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isDirectory = index < parts.length - 1;

        if (!map.has(currentPath)) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            isDirectory,
            children: isDirectory ? [] : undefined,
          };

          map.set(currentPath, node);

          if (parentPath) {
            const parent = map.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          } else {
            root.push(node);
          }
        }
      });
    });

    // Sort all nodes recursively
    const sortRecursively = (nodes: FileNode[]) => {
      sortFileNodes(nodes);
      nodes.forEach(node => {
        if (node.children) {
          sortRecursively(node.children);
        }
      });
    };
    
    sortRecursively(root);
    return root;
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodePath: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodePath)) {
      newExpanded.delete(nodePath);
    } else {
      newExpanded.add(nodePath);
    }
    setExpandedNodes(newExpanded);
  };

  const renderFileNode = (node: FileNode, folderId: string, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedFile === node.path && selectedFolder?.id === folderId;

    if (node.isDirectory) {
      return (
        <div key={node.path}>
          <div
            onClick={() => toggleNode(node.path)}
            className="flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-gray-100"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-gray-700 truncate">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderFileNode(child, folderId, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div
          key={node.path}
          onClick={() => onSelectFile(folderId, node.path)}
          className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer ${
            isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate">{node.name}</span>
        </div>
      );
    }
  };

  return (
    <div className="h-full overflow-auto">
      {folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.id);
        const files = allFiles[folder.id] || [];
        const fileTree = buildFileTree(files);
        const isSelected = selectedFolder?.id === folder.id;

        return (
          <div key={folder.id} className="border-b border-gray-200">
            {/* Folder Header */}
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                onSelectFolder(folder);
                toggleFolder(folder.id);
              }}
            >
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="relative flex items-center gap-1 flex-1 min-w-0">
                {folder.isActive ? (
                  <span className="w-2 h-2 bg-green-500 rounded-full" title="Auto-commit enabled" />
                ) : (
                  <span className="w-2 h-2 bg-gray-300 rounded-full" title="Auto-commit disabled" />
                )}
                <span className="text-sm font-medium text-gray-900 truncate">{folder.name}</span>
              </div>
            </div>

            {/* Files in Folder */}
            {isExpanded && (
              <div className="bg-gray-50">
                {files.length === 0 ? (
                  <div className="px-8 py-2 text-xs text-gray-500 italic">No files</div>
                ) : (
                  fileTree.map((node) => renderFileNode(node, folder.id))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FolderFileTree;

