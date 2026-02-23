'use client';

import { useState } from 'react';
import { FileNode, TimelineEvent, Member } from '@/types';

interface Props {
  tree: FileNode;
  timeline: TimelineEvent[];
  members: Member[];
  onFileClick: (node: FileNode) => void;
}

function FileIcon({ name, type }: { name: string; type: string }) {
  if (type === 'folder') {
    return (
      <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
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
  };
  const color = colorMap[ext || ''] || 'text-neutral-400';

  return (
    <svg className={`w-4 h-4 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function TreeNode({ node, onFileClick, level = 0 }: { node: FileNode; onFileClick: (n: FileNode) => void; level?: number }) {
  const isFolder = node.type === 'folder';
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        className="h-8 flex items-center gap-2 px-2 rounded-md hover:bg-neutral-50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded);
          else onFileClick(node);
        }}
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
        <FileIcon name={node.name} type={node.type} />
        <span className="flex-1 text-sm text-neutral-600 truncate">{node.name}</span>
        {!isFolder && (
          <button className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-neutral-600 transition-opacity">
            引用
          </button>
        )}
      </div>
      {isFolder && expanded && node.children?.map((child) => (
        <TreeNode key={child.id} node={child} onFileClick={onFileClick} level={level + 1} />
      ))}
    </div>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}h`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function EventIcon({ type }: { type: string }) {
  const icons = {
    create: (
      <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    modify: (
      <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    delete: (
      <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  };
  return icons[type as keyof typeof icons] || icons.modify;
}

export default function SidePanel({ tree, timeline, members, onFileClick }: Props) {
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'activity'>('files');

  const filteredTimeline = filterMember
    ? timeline.filter(e => e.author.id === filterMember)
    : timeline;

  return (
    <aside className="w-72 h-full bg-white border-l border-neutral-200 flex flex-col">
      {/* Tabs */}
      <div className="h-12 px-4 flex items-center gap-4 border-b border-neutral-100">
        <button
          onClick={() => setActiveTab('files')}
          className={`text-sm font-medium transition-colors ${
            activeTab === 'files' ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          文件
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`text-sm font-medium transition-colors ${
            activeTab === 'activity' ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          动态
        </button>
      </div>

      {activeTab === 'files' && (
        <div className="flex-1 overflow-auto py-2">
          {/* Upload */}
          <div className="px-4 py-2">
            <button className="w-full h-9 flex items-center justify-center gap-2 text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-lg hover:border-neutral-300 hover:text-neutral-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              上传
            </button>
          </div>

          {/* Tree */}
          <div className="px-2">
            <TreeNode node={tree} onFileClick={onFileClick} />
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="flex-1 overflow-auto">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterMember(null)}
                className={`h-6 px-2 text-[11px] font-medium rounded transition-colors ${
                  filterMember === null
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                全部
              </button>
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setFilterMember(member.id)}
                  className={`h-6 px-2 text-[11px] font-medium rounded transition-colors ${
                    filterMember === member.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {member.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="p-2 space-y-1">
            {filteredTimeline.map((event) => {
              const isAgent = event.author.type === 'agent';
              return (
                <div
                  key={event.id}
                  className="p-3 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <EventIcon type={event.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-neutral-900 truncate">{event.fileName}</span>
                        <span className="text-[10px] text-neutral-400 flex-shrink-0">{formatTime(event.createdAt)}</span>
                      </div>
                      <p className="text-xs text-neutral-500 truncate">{event.summary}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          isAgent ? 'bg-violet-100' : 'bg-neutral-200'
                        }`}>
                          <span className={`text-[8px] font-semibold ${isAgent ? 'text-violet-600' : 'text-neutral-500'}`}>
                            {isAgent ? 'AI' : event.author.name[0]}
                          </span>
                        </div>
                        <span className={`text-[10px] ${isAgent ? 'text-violet-600' : 'text-neutral-400'}`}>
                          {event.author.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTimeline.length === 0 && (
              <div className="py-12 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-400">暂无动态</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
