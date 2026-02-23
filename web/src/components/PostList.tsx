'use client';

import { useState } from 'react';
import { Post, Member, FileNode } from '@/types';

interface Props {
  posts: Post[];
  members: Member[];
  files: FileNode;
  onSelectPost: (post: Post) => void;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function flattenFiles(node: FileNode, result: FileNode[] = []): FileNode[] {
  if (node.type === 'file') result.push(node);
  node.children?.forEach(child => flattenFiles(child, result));
  return result;
}

export default function PostList({ posts, members, files, onSelectPost }: Props) {
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileNode[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const filteredPosts = filterMember
    ? posts.filter(p => p.author.id === filterMember)
    : posts;

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const allFiles = flattenFiles(files);

  const toggleAttachFile = (file: FileNode) => {
    if (attachedFiles.find(f => f.id === file.id)) {
      setAttachedFiles(attachedFiles.filter(f => f.id !== file.id));
    } else {
      setAttachedFiles([...attachedFiles, file]);
    }
  };

  const handleSubmit = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    console.log({ title: newTitle, content: newContent, attachedFiles });
    setNewTitle('');
    setNewContent('');
    setAttachedFiles([]);
    setShowCompose(false);
  };

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-neutral-900">讨论</h1>
          <span className="text-xs text-neutral-400">{filteredPosts.length}</span>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="h-8 px-3 flex items-center gap-1.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新建
        </button>
      </header>

      {/* Filters */}
      <div className="h-12 px-6 flex items-center gap-2 border-b border-neutral-100">
        <button
          onClick={() => setFilterMember(null)}
          className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
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
            className={`h-7 px-3 flex items-center gap-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMember === member.id
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold ${
              member.type === 'agent'
                ? filterMember === member.id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'
                : filterMember === member.id ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'
            }`}>
              {member.type === 'agent' ? 'AI' : member.name[0]}
            </div>
            {member.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Post List */}
      <div className="flex-1 overflow-auto">
        {sortedPosts.map((post) => {
          const isAgent = post.author.type === 'agent';

          return (
            <article
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="group px-6 py-4 flex items-start gap-4 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isAgent ? 'bg-violet-100' : 'bg-neutral-200'
              }`}>
                <span className={`text-xs font-semibold ${isAgent ? 'text-violet-600' : 'text-neutral-600'}`}>
                  {isAgent ? 'AI' : post.author.name[0]}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {post.isPinned && (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">置顶</span>
                  )}
                  {isAgent && (
                    <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">AI</span>
                  )}
                  <h3 className="text-sm font-medium text-neutral-900 truncate">{post.title}</h3>
                </div>
                <p className="text-sm text-neutral-500 line-clamp-1">{post.content}</p>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {post.replyCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-400">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    {post.replyCount}
                  </span>
                )}
                {post.attachments && post.attachments.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-400">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    {post.attachments.length}
                  </span>
                )}
                <span className="text-xs text-neutral-400 w-12 text-right">{formatTime(post.createdAt)}</span>
              </div>
            </article>
          );
        })}

        {sortedPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500 mb-1">暂无讨论</p>
            <p className="text-xs text-neutral-400">点击右上角新建按钮开始</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowCompose(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-14 px-6 flex items-center justify-between border-b border-neutral-100">
              <h2 className="text-sm font-medium text-neutral-900">新建讨论</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map(file => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-neutral-100 rounded-md text-xs"
                    >
                      <svg className="w-3 h-3 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                      {file.name}
                      <button
                        onClick={() => setAttachedFiles(attachedFiles.filter(f => f.id !== file.id))}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="标题"
                className="w-full h-10 px-3 text-sm bg-neutral-50 rounded-lg border-0 focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-colors placeholder:text-neutral-400"
              />

              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="内容..."
                rows={4}
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 rounded-lg border-0 focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-colors placeholder:text-neutral-400 resize-none"
              />

              <div className="flex items-center justify-between pt-2">
                <div className="relative">
                  <button
                    onClick={() => setShowFilePicker(!showFilePicker)}
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  {showFilePicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 max-h-48 overflow-auto z-10">
                      <div className="px-3 py-2 text-xs font-medium text-neutral-500 border-b border-neutral-100">
                        选择文件
                      </div>
                      {allFiles.map(file => (
                        <button
                          key={file.id}
                          onClick={() => toggleAttachFile(file)}
                          className={`w-full h-9 px-3 text-left text-sm hover:bg-neutral-50 flex items-center gap-2 transition-colors ${
                            attachedFiles.find(f => f.id === file.id) ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'
                          }`}
                        >
                          <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span className="truncate flex-1">{file.name}</span>
                          {attachedFiles.find(f => f.id === file.id) && (
                            <svg className="w-4 h-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="h-9 px-4 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  发布
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
