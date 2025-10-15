import React, { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { DiffResult } from '../types';

interface DiffViewerProps {
  diffResult: DiffResult;
  folderPath?: string; // Add folder path to enable saving
  onContentSaved?: () => void; // Callback after successful save
  onContentUpdated?: (newContent: string) => void; // Callback to update content immediately
}

// Map file extensions to Prism language identifiers
const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'sql': 'sql',
    'html': 'html',
    'xml': 'xml',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'dockerfile': 'docker',
    'makefile': 'makefile',
    'r': 'r',
    'md': 'markdown',
    'txt': 'text',
  };
  
  return languageMap[ext || ''] || 'text';
};

const DiffViewer: React.FC<DiffViewerProps> = ({ diffResult, folderPath, onContentSaved, onContentUpdated }) => {
  const [splitView, setSplitView] = useState(true);
  const [renderMode, setRenderMode] = useState<'diff' | 'preview'>('preview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Check if we're showing the same content (no diff)
  const isShowingCurrentOnly = diffResult.oldCommit === 'current' && diffResult.newCommit === 'current';
  const isDeletedFile = diffResult.oldCommit === 'deleted';
  
  // Determine file type
  const isMarkdown = diffResult.fileName.toLowerCase().endsWith('.md');
  const language = getLanguageFromExtension(diffResult.fileName);
  const isCodeFile = language !== 'text' && language !== 'markdown';
  const canEdit = isShowingCurrentOnly && folderPath && !isDeletedFile; // Only allow editing current file content, not deleted files

  // Initialize edited content when entering edit mode
  const handleStartEdit = () => {
    setEditedContent(diffResult.newContent);
    setIsEditing(true);
  };

  // Save edited content back to file
  const handleSaveEdit = async () => {
    if (!folderPath || !window.electronAPI.saveFile) return;
    
    console.log('=== SAVE EDIT DEBUG (UI) ===');
    console.log('folderPath:', folderPath);
    console.log('fileName:', diffResult.fileName);
    console.log('edited content length:', editedContent.length);
    console.log('edited content preview:', editedContent.substring(0, 100));
    
    setIsSaving(true);
    try {
      const result = await window.electronAPI.saveFile(folderPath, diffResult.fileName, editedContent);
      console.log('Save result:', result);
      
      if (result.success) {
        console.log('Save successful, updating content immediately...');
        
        // Update content in parent immediately to prevent flickering
        if (onContentUpdated) {
          onContentUpdated(editedContent);
        }
        
        // Exit edit mode
        setIsEditing(false);
        
        // Wait for the file watcher to detect the change and create a commit
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Now trigger the full reload
        if (onContentSaved) {
          onContentSaved();
        }
      } else {
        alert(`Failed to save file: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  // Render markdown content
  const renderMarkdown = (content: string) => (
    <div className="markdown-body p-6 bg-white" style={{
      fontSize: '14px',
      lineHeight: '1.6',
      color: '#24292e',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 style={{fontSize: '2em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px', paddingBottom: '0.3em', borderBottom: '1px solid #eaecef'}} {...props} />,
          h2: ({node, ...props}) => <h2 style={{fontSize: '1.5em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px', paddingBottom: '0.3em', borderBottom: '1px solid #eaecef'}} {...props} />,
          h3: ({node, ...props}) => <h3 style={{fontSize: '1.25em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px'}} {...props} />,
          h4: ({node, ...props}) => <h4 style={{fontSize: '1em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px'}} {...props} />,
          h5: ({node, ...props}) => <h5 style={{fontSize: '0.875em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px'}} {...props} />,
          h6: ({node, ...props}) => <h6 style={{fontSize: '0.85em', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px', color: '#6a737d'}} {...props} />,
          p: ({node, ...props}) => <p style={{marginTop: '0', marginBottom: '16px'}} {...props} />,
          strong: ({node, ...props}) => <strong style={{fontWeight: 'bold'}} {...props} />,
          em: ({node, ...props}) => <em style={{fontStyle: 'italic'}} {...props} />,
          ul: ({node, ...props}) => <ul style={{paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'disc'}} {...props} />,
          ol: ({node, ...props}) => <ol style={{paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'decimal'}} {...props} />,
          li: ({node, ...props}) => <li style={{marginTop: '0.25em'}} {...props} />,
          blockquote: ({node, ...props}) => <blockquote style={{padding: '0 1em', color: '#6a737d', borderLeft: '0.25em solid #dfe2e5', marginBottom: '16px'}} {...props} />,
          code: ({node, inline, ...props}) => 
            inline 
              ? <code style={{padding: '0.2em 0.4em', margin: '0', fontSize: '85%', backgroundColor: 'rgba(27,31,35,0.05)', borderRadius: '3px', fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'}} {...props} />
              : <code style={{display: 'block', padding: '16px', overflow: 'auto', fontSize: '85%', lineHeight: '1.45', backgroundColor: '#f6f8fa', borderRadius: '6px', fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'}} {...props} />,
          pre: ({node, ...props}) => <pre style={{padding: '16px', overflow: 'auto', fontSize: '85%', lineHeight: '1.45', backgroundColor: '#f6f8fa', borderRadius: '6px', marginBottom: '16px'}} {...props} />,
          a: ({node, ...props}) => <a style={{color: '#0366d6', textDecoration: 'none'}} {...props} />,
          table: ({node, ...props}) => <table style={{borderSpacing: '0', borderCollapse: 'collapse', width: '100%', marginBottom: '16px'}} {...props} />,
          th: ({node, ...props}) => <th style={{padding: '6px 13px', border: '1px solid #dfe2e5', fontWeight: 'bold', backgroundColor: '#f6f8fa'}} {...props} />,
          td: ({node, ...props}) => <td style={{padding: '6px 13px', border: '1px solid #dfe2e5'}} {...props} />,
          hr: ({node, ...props}) => <hr style={{height: '0.25em', padding: '0', margin: '24px 0', backgroundColor: '#e1e4e8', border: '0'}} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  // Render code with syntax highlighting
  const renderCode = (content: string, isDark = false) => (
    <SyntaxHighlighter
      language={language}
      style={isDark ? vscDarkPlus : vs}
      customStyle={{
        margin: 0,
        padding: '1rem',
        fontSize: '0.875rem',
        lineHeight: '1.5',
      }}
      showLineNumbers={true}
      wrapLines={true}
    >
      {content}
    </SyntaxHighlighter>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Deleted File Banner */}
      {isDeletedFile && (
        <div className="bg-red-50 border-b-2 border-red-200 px-4 py-2">
          <p className="text-sm text-red-700 font-medium">
            ⚠️ This file has been deleted. You are viewing the last saved version from the Git history.
          </p>
          <p className="text-xs text-red-600 mt-1">
            To restore this file, select a version from the right panel and click "Restore".
          </p>
        </div>
      )}
      
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold">{diffResult.fileName}</h3>
            {isDeletedFile ? (
              <p className="text-xs text-red-500">
                Deleted file - Last version from Git history
              </p>
            ) : isShowingCurrentOnly ? (
              <p className="text-xs text-gray-500">
                {isEditing ? 'Editing file' : 'Current file content - Select a version to see differences'}
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Comparing: {diffResult.oldCommit?.substring(0, 7)} → {diffResult.newCommit === 'current' ? 'Current' : diffResult.newCommit?.substring(0, 7)}
              </p>
            )}
          </div>
          
          {/* View mode toggle for markdown and current-only views (only when not editing) */}
          {isShowingCurrentOnly && !isEditing && (isMarkdown || isCodeFile) && (
            <div className="flex rounded overflow-hidden border border-gray-300">
              <button
                onClick={() => setRenderMode('preview')}
                className={`px-3 py-1 text-xs transition-colors ${
                  renderMode === 'preview'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isMarkdown ? 'Preview' : 'Highlighted'}
              </button>
              <button
                onClick={() => setRenderMode('diff')}
                className={`px-3 py-1 text-xs transition-colors border-l border-gray-300 ${
                  renderMode === 'diff'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Raw
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* Edit/Save/Cancel buttons */}
          {canEdit && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded border border-green-600"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className={`px-3 py-1 text-xs rounded border ${
                  isSaving
                    ? 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
          
          {/* Split view toggle for diffs */}
          {!isShowingCurrentOnly && (
            <button
              onClick={() => setSplitView(!splitView)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
            >
              {splitView ? 'Unified View' : 'Split View'}
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {isShowingCurrentOnly ? (
          isEditing ? (
            // Edit mode
            <div className="h-full flex">
              {/* Editor textarea */}
              <div className="flex-1 p-4 border-r border-gray-200">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={(e) => {
                    // Command+S (Mac) or Ctrl+S (Windows/Linux) to save
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  }}
                  className="w-full h-full p-3 border border-gray-300 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your content here..."
                  spellCheck={false}
                />
              </div>
              
              {/* Live preview (for markdown) */}
              {isMarkdown && (
                <div className="flex-1 overflow-auto">
                  <div className="p-4 bg-gray-50">
                    <h4 className="text-xs font-semibold text-gray-600 mb-3">Live Preview</h4>
                    {renderMarkdown(editedContent)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // View mode - Show current file content
            <>
              {renderMode === 'preview' && isMarkdown ? (
                // Render markdown as HTML
                <div className="bg-gray-50 min-h-full">
                  {renderMarkdown(diffResult.newContent)}
                </div>
              ) : renderMode === 'preview' && isCodeFile ? (
                // Render code with syntax highlighting
                <div className="bg-white">
                  {renderCode(diffResult.newContent)}
                </div>
              ) : (
                // Show raw text
                <div className="p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-50 p-4 rounded border border-gray-200">
                    {diffResult.newContent}
                  </pre>
                </div>
              )}
            </>
          )
        ) : (
          // Show the diff comparison
          <ReactDiffViewer
            oldValue={diffResult.oldContent}
            newValue={diffResult.newContent}
            splitView={splitView}
            compareMethod={DiffMethod.WORDS}
            useDarkTheme={false}
            leftTitle={`Old (${diffResult.oldCommit?.substring(0, 7)})`}
            rightTitle={`New (${diffResult.newCommit === 'current' ? 'Current' : diffResult.newCommit?.substring(0, 7)})`}
            styles={{
              variables: {
                light: {
                  diffViewerBackground: '#fff',
                  diffViewerColor: '#212529',
                  addedBackground: '#e6ffed',
                  addedColor: '#24292e',
                  removedBackground: '#ffeef0',
                  removedColor: '#24292e',
                  wordAddedBackground: '#acf2bd',
                  wordRemovedBackground: '#fdb8c0',
                  addedGutterBackground: '#cdffd8',
                  removedGutterBackground: '#ffdce0',
                  gutterBackground: '#f7f7f7',
                  gutterBackgroundDark: '#f3f1f1',
                  highlightBackground: '#fffbdd',
                  highlightGutterBackground: '#fff5b1',
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
