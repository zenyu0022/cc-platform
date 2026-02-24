'use client';

import { useState } from 'react';
import { Post, Reply } from '@/types';
import { usePosts } from '@/hooks/usePosts';

interface Props {
  post: Post;
  onBack: () => void;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function PostDetail({ post, onBack }: Props) {
  const { createReply } = usePosts();
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localReplies, setLocalReplies] = useState<Reply[]>(post.replies);
  const isAgent = post.author.type === 'agent';

  const handleReply = async () => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      const reply = await createReply(post.id, replyContent);
      setLocalReplies(prev => [...prev, reply]);
      setReplyContent('');
    } catch (error) {
      console.error('Failed to create reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allReplies = localReplies;

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 px-6 flex items-center border-b border-neutral-100">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 px-4">
          <h1 className="text-sm font-medium text-neutral-900 truncate">{post.title}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Post */}
        <div className="px-6 py-6">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isAgent ? 'bg-violet-100' : 'bg-neutral-200'
            }`}>
              <span className={`text-sm font-semibold ${isAgent ? 'text-violet-600' : 'text-neutral-600'}`}>
                {isAgent ? 'AI' : post.author.name[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isAgent ? 'text-violet-700' : 'text-neutral-900'}`}>
                  {post.author.name}
                </span>
                {isAgent && (
                  <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">AI</span>
                )}
              </div>
              <div className="text-xs text-neutral-400">{formatTime(post.createdAt)}</div>
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed mb-6">
            {post.content}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              {post.tags.map(tag => (
                <span key={tag} className="h-6 px-2 text-xs text-neutral-500 bg-neutral-100 rounded-md flex items-center">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="border-t border-neutral-100 pt-4">
              <div className="text-xs font-medium text-neutral-400 mb-3">附件 ({post.attachments.length})</div>
              <div className="flex flex-wrap gap-2">
                {post.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="h-10 px-3 flex items-center gap-2 bg-neutral-50 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    <div>
                      <div className="text-sm text-neutral-700">{att.name}</div>
                    </div>
                    <span className="text-xs text-neutral-400">{formatSize(att.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Replies */}
        <div className="border-t border-neutral-100">
          <div className="px-6 py-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="text-sm font-medium text-neutral-700">{allReplies.length} 回复</span>
          </div>

          {allReplies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}

          {allReplies.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-neutral-400">暂无回复</p>
            </div>
          )}
        </div>
      </div>

      {/* Reply Input */}
      <div className="h-16 px-6 flex items-center gap-3 border-t border-neutral-100">
        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-neutral-600">我</span>
        </div>
        <input
          type="text"
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          placeholder="写下你的回复..."
          className="flex-1 h-9 px-3 text-sm bg-neutral-50 rounded-lg border-0 focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-colors placeholder:text-neutral-400"
        />
        <button
          onClick={handleReply}
          className="h-9 px-4 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          disabled={!replyContent.trim() || isSubmitting}
        >
          {isSubmitting ? '发送中...' : '发送'}
        </button>
      </div>
    </main>
  );
}

function ReplyItem({ reply }: { reply: Reply }) {
  const isAgent = reply.author.type === 'agent';

  return (
    <div className="px-6 py-4 border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isAgent ? 'bg-violet-100' : 'bg-neutral-200'
        }`}>
          <span className={`text-xs font-semibold ${isAgent ? 'text-violet-600' : 'text-neutral-600'}`}>
            {isAgent ? 'AI' : reply.author.name[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${isAgent ? 'text-violet-700' : 'text-neutral-900'}`}>
              {reply.author.name}
            </span>
            {isAgent && (
              <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1 py-0.5 rounded">AI</span>
            )}
            <span className="text-xs text-neutral-400">{formatTime(reply.createdAt)}</span>
          </div>
          <div className="text-sm text-neutral-600">{reply.content}</div>
        </div>
      </div>
    </div>
  );
}
