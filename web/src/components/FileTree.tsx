'use client';

import { FileNode } from '@/types';

interface Props {
  node: FileNode;
  onFileClick: (node: FileNode) => void;
  level?: number;
}

// 文件图标
function FileIcon({ type, name }: { type: string; name: string }) {
  if (type === 'folder') return <span className="text-amber-500">📁</span>;
  const ext = name.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: '📄', tsx: '⚛️', js: '📄', json: '📋',
    md: '📝', pdf: '📕', png: '🖼️', fig: '🎨',
  };
  return <span>{icons[ext || ''] || '📄'}</span>;
}

function TreeNode({ node, onFileClick, level = 0 }: Props) {
  const isFolder = node.type === 'folder';

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg hover:bg-black/[0.04] text-sm group transition-all duration-150"
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => !isFolder && onFileClick(node)}
      >
        <FileIcon type={node.type} name={node.name} />
        <span className="truncate flex-1 text-[#1d1d1f]">{node.name}</span>
        {!isFolder && (
          <span className="text-[#0071e3] opacity-0 group-hover:opacity-100 text-xs font-medium transition-opacity">
            +
          </span>
        )}
      </div>
      {isFolder && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          onFileClick={onFileClick}
          level={level + 1}
        />
      ))}
    </div>
  );
}

interface FileTreeProps {
  tree: FileNode;
  onFileClick: (node: FileNode) => void;
}

export default function FileTree({ tree, onFileClick }: FileTreeProps) {
  return (
    <div className="h-full overflow-auto bg-white/80">
      <div className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide px-4 py-3.5 border-b border-black/[0.04]">
        📂 文件
      </div>
      <div className="p-2">
        <TreeNode node={tree} onFileClick={onFileClick} />
      </div>
    </div>
  );
}
