'use client';

import { useState, useRef, useEffect } from 'react';
import { FileNode } from '@/types';

interface Props {
  tree: FileNode;
  onFileClick: (node: FileNode) => void;
  onFileReference: (node: FileNode) => void;
  onCreateFolder: (parentId: string, name: string) => void;
  onCreateFile: (parentId: string, name: string, content?: string) => void;
  onDelete: (nodeId: string) => void;
  onRename: (nodeId: string, newName: string) => void;
  onMove: (nodeId: string, newParentId: string) => void;
}

function getFileIcon(name: string, type: string) {
  if (type === 'folder') {
    return (
      <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    ts: 'text-blue-500',
    tsx: 'text-blue-500',
    js: 'text-yellow-500',
    json: 'text-yellow-600',
    md: 'text-neutral-500',
    pdf: 'text-red-500',
    py: 'text-green-500',
    go: 'text-cyan-500',
    fig: 'text-purple-500',
    png: 'text-pink-500',
    jpg: 'text-pink-500',
    svg: 'text-orange-500',
  };
  const color = colorMap[ext || ''] || 'text-neutral-400';

  return (
    <svg className={`w-4 h-4 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  onFileClick: (node: FileNode) => void;
  onFileReference: (node: FileNode) => void;
  onCreateFolder: (parentId: string, name: string) => void;
  onCreateFile: (parentId: string, name: string, content?: string) => void;
  onDelete: (nodeId: string) => void;
  onRename: (nodeId: string, newName: string) => void;
  onMove: (nodeId: string, newParentId: string) => void;
  parentId: string;
}

function TreeNode({
  node,
  level,
  onFileClick,
  onFileReference,
  onCreateFolder,
  onCreateFile,
  onDelete,
  onRename,
  onMove,
  parentId,
}: TreeNodeProps) {
  const isFolder = node.type === 'folder';
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [isCreating, setIsCreating] = useState<'folder' | 'file' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (isCreating && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRenameSubmit = () => {
    if (newName.trim() && newName !== node.name) {
      onRename(node.id, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleCreateSubmit = () => {
    if (newItemName.trim()) {
      if (isCreating === 'folder') {
        onCreateFolder(node.id, newItemName.trim());
      } else {
        onCreateFile(node.id, newItemName.trim());
      }
    }
    setIsCreating(null);
    setNewItemName('');
    setExpanded(true);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isFolder) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== node.id && isFolder) {
      onMove(draggedId, node.id);
    }
  };

  return (
    <div>
      <div
        className={`h-8 flex items-center gap-2 px-2 rounded-md cursor-pointer transition-colors group ${
          isDragOver ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-neutral-50'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (isRenaming || isCreating) return;
          if (isFolder) setExpanded(!expanded);
          else onFileClick(node);
        }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder && (
          <svg
            className={`w-3 h-3 text-neutral-300 transition-transform ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 5l7 7-7 7z" />
          </svg>
        )}
        {!isFolder && <div className="w-3" />}
        {getFileIcon(node.name, node.type)}

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 text-sm bg-white border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-neutral-400"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm text-neutral-600 truncate">{node.name}</span>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-200 transition-opacity"
          >
            <svg className="w-3 h-3 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-neutral-100 py-1 min-w-[140px]"
              onClick={(e) => e.stopPropagation()}
            >
              {isFolder && (
                <>
                  <button
                    onClick={() => {
                      setIsCreating('folder');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    新建文件夹
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating('file');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6M12 12v6M9 15h6" />
                    </svg>
                    新建文件
                  </button>
                  <div className="h-px bg-neutral-100 my-1" />
                </>
              )}
              {!isFolder && (
                <button
                  onClick={() => {
                    onFileReference(node);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  引用
                </button>
              )}
              <button
                onClick={() => {
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                重命名
              </button>
              <button
                onClick={() => {
                  onDelete(node.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <div
          className="h-8 flex items-center gap-2 px-2"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          {isCreating === 'folder' ? (
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          )}
          <input
            ref={newItemInputRef}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={handleCreateSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') {
                setIsCreating(null);
                setNewItemName('');
              }
            }}
            placeholder={isCreating === 'folder' ? '文件夹名称' : '文件名称'}
            className="flex-1 text-sm bg-white border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-neutral-400"
          />
        </div>
      )}

      {isFolder && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              onFileReference={onFileReference}
              onCreateFolder={onCreateFolder}
              onCreateFile={onCreateFile}
              onDelete={onDelete}
              onRename={onRename}
              onMove={onMove}
              parentId={node.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  tree,
  onFileClick,
  onFileReference,
  onCreateFolder,
  onCreateFile,
  onDelete,
  onRename,
  onMove,
}: Props) {
  const [showRootMenu, setShowRootMenu] = useState(false);
  const [isCreating, setIsCreating] = useState<'folder' | 'file' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowRootMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateSubmit = () => {
    if (newItemName.trim()) {
      if (isCreating === 'folder') {
        onCreateFolder(tree.id, newItemName.trim());
      } else {
        onCreateFile(tree.id, newItemName.trim());
      }
    }
    setIsCreating(null);
    setNewItemName('');
  };

  return (
    <div>
      {/* 根目录管理栏 */}
      <div className="h-8 flex items-center justify-between px-2 mb-1 group">
        <span className="text-xs text-neutral-400 font-medium">文件列表</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowRootMenu(!showRootMenu)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-100"
          >
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {showRootMenu && (
            <div
              className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-neutral-100 py-1 min-w-[140px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setIsCreating('folder');
                  setShowRootMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                新建文件夹
              </button>
              <button
                onClick={() => {
                  setIsCreating('file');
                  setShowRootMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M12 12v6M9 15h6" />
                </svg>
                新建文件
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 根目录新建输入框 */}
      {isCreating && (
        <div className="h-8 flex items-center gap-2 px-2">
          {isCreating === 'folder' ? (
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={handleCreateSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') {
                setIsCreating(null);
                setNewItemName('');
              }
            }}
            placeholder={isCreating === 'folder' ? '文件夹名称' : '文件名称'}
            className="flex-1 text-sm bg-white border border-neutral-200 rounded px-1 py-0.5 outline-none focus:border-neutral-400"
          />
        </div>
      )}

      {/* 子节点 */}
      {tree.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          level={0}
          onFileClick={onFileClick}
          onFileReference={onFileReference}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onDelete={onDelete}
          onRename={onRename}
          onMove={onMove}
          parentId={tree.id}
        />
      ))}

      {(!tree.children || tree.children.length === 0) && !isCreating && (
        <div className="py-8 text-center">
          <p className="text-xs text-neutral-300">暂无文件</p>
        </div>
      )}
    </div>
  );
}
