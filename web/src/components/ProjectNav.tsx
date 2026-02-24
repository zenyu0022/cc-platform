'use client';

import { useState } from 'react';
import { Project } from '@/types';

interface Props {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (input: { name: string; description?: string; visibility: 'private' | 'team' | 'public' }) => Promise<unknown>;
}

export default function ProjectNav({ projects, currentProjectId, onSelectProject, onCreateProject }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>('team');
  const [isCreating, setIsCreating] = useState(false);

  const myProjects = projects.filter(p => p.visibility !== 'public');
  const publicProjects = projects.filter(p => p.visibility === 'public');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreateProject({ name: name.trim(), description: description.trim(), visibility });
      setShowModal(false);
      setName('');
      setDescription('');
      setVisibility('team');
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <aside className="w-60 h-full bg-white border-r border-neutral-200 flex flex-col">
        {/* Header */}
        <header className="h-14 px-4 flex items-center border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-neutral-900 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-medium text-neutral-900">Collab</span>
          </div>
        </header>

        {/* Search */}
        <div className="px-3 py-3">
          <button className="w-full h-9 px-3 flex items-center gap-2 text-sm text-neutral-400 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span>搜索...</span>
            <kbd className="ml-auto text-[10px] text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Project List */}
        <nav className="flex-1 overflow-auto px-2">
          <div className="px-2 py-2">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">项目</span>
          </div>
          <div className="space-y-0.5">
            {myProjects.map((project) => {
              const isActive = currentProjectId === project.id;
              return (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`w-full h-9 px-2 flex items-center gap-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center ${
                    project.visibility === 'private' ? 'bg-amber-100' : 'bg-emerald-100'
                  }`}>
                    {project.visibility === 'private' ? (
                      <svg className="w-2.5 h-2.5 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1a5 5 0 00-5 5v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 7H9V6a3 3 0 116 0v2z" />
                      </svg>
                    ) : (
                      <svg className="w-2.5 h-2.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate flex-1 text-left">{project.name}</span>
                  {(project.posts?.length ?? 0) > 0 && (
                    <span className="text-xs text-neutral-400">{project.posts.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {publicProjects.length > 0 && (
            <>
              <div className="px-2 py-2 mt-4">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">公开</span>
              </div>
              <div className="space-y-0.5">
                {publicProjects.map((project) => {
                  const isActive = currentProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className={`w-full h-9 px-2 flex items-center gap-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-neutral-100 text-neutral-900'
                          : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-sm bg-blue-100 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      </div>
                      <span className="truncate flex-1 text-left">{project.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-100">
          <button
            onClick={() => setShowModal(true)}
            className="w-full h-9 px-3 flex items-center gap-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建项目
          </button>
        </div>
      </aside>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">新建项目</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">项目名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入项目名称"
                  className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">描述（可选）</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="项目描述"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">可见性</label>
                <div className="flex gap-2">
                  {[
                    { value: 'private', label: '私有', icon: '🔒' },
                    { value: 'team', label: '团队', icon: '👥' },
                    { value: 'public', label: '公开', icon: '🌍' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setVisibility(option.value as 'private' | 'team' | 'public')}
                      className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-sm rounded-lg border transition-colors ${
                        visibility === option.value
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-10 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
                className="flex-1 h-10 text-sm text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
