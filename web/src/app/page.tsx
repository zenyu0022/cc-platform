'use client';

import { useState, useRef, useEffect } from 'react';
import { Post, FileNode } from '@/types';
import { useProjects } from '@/hooks/useProjects';
import ProjectNav from '@/components/ProjectNav';
import PostList from '@/components/PostList';
import PostDetail from '@/components/PostDetail';
import SidePanel from '@/components/SidePanel';
import FilePreview from '@/components/FilePreview';

export default function Home() {
  const { projects, currentProject, isLoading, selectProject, createProject, createFolder, createFile, updateFileContent, deleteNode, renameNode, moveNode } = useProjects();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [referencedFiles, setReferencedFiles] = useState<FileNode[]>([]);
  const [triggerCompose, setTriggerCompose] = useState(false);
  const [triggerReply, setTriggerReply] = useState(false);

  // 移动端侧边栏状态
  const [showProjectNav, setShowProjectNav] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const handleFileClick = (node: FileNode) => {
    setPreviewFile(node);
  };

  const handleFileReference = (node: FileNode) => {
    // 添加到引用文件列表
    setReferencedFiles(prev => {
      if (prev.find(f => f.id === node.id)) return prev;
      return [...prev, node];
    });

    // 根据当前页面状态触发不同行为
    if (selectedPost) {
      // 在帖子详情页 → 触发回复框聚焦
      setTriggerReply(true);
    } else {
      // 在首页 → 触发新建帖子弹窗
      setTriggerCompose(true);
    }
  };

  const handleSaveFile = async (content: string) => {
    if (!previewFile) return;
    await updateFileContent(previewFile.id, content);
    setPreviewFile(prev => prev ? { ...prev, content } : null);
  };

  // 清除触发状态
  useEffect(() => {
    if (triggerCompose) {
      const timer = setTimeout(() => setTriggerCompose(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerCompose]);

  useEffect(() => {
    if (triggerReply) {
      const timer = setTimeout(() => setTriggerReply(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerReply]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-400">暂无项目</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-neutral-50 overflow-hidden">
      {/* 移动端遮罩 */}
      {(showProjectNav || showSidePanel) && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => {
            setShowProjectNav(false);
            setShowSidePanel(false);
          }}
        />
      )}

      {/* Sidebar - 桌面端固定，移动端抽屉 */}
      <div className={`fixed inset-y-0 left-0 z-50 md:relative md:z-auto transform transition-transform duration-300 ease-in-out ${
        showProjectNav ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <ProjectNav
          projects={projects}
          currentProjectId={currentProject.id}
          onSelectProject={(id) => {
            selectProject(id);
            setSelectedPost(null);
            setReferencedFiles([]);
            setShowProjectNav(false);
          }}
          onCreateProject={createProject}
          onCloseMobile={() => setShowProjectNav(false)}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端头部 */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-neutral-200 bg-white md:hidden">
          <button
            onClick={() => setShowProjectNav(true)}
            className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="font-medium text-neutral-900">
            {selectedPost ? selectedPost.title : currentProject.name}
          </span>
          <button
            onClick={() => setShowSidePanel(true)}
            className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
        </header>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {selectedPost ? (
            <PostDetail
              post={selectedPost}
              onBack={() => {
                setSelectedPost(null);
                setReferencedFiles([]);
              }}
              referencedFiles={referencedFiles}
              onClearReferences={() => setReferencedFiles([])}
              triggerReplyFocus={triggerReply}
            />
          ) : (
            <PostList
              posts={currentProject.posts}
              members={currentProject.members}
              files={currentProject.fileTree}
              onSelectPost={(post) => {
                setSelectedPost(post);
                setReferencedFiles([]);
              }}
              referencedFiles={referencedFiles}
              onClearReferences={() => setReferencedFiles([])}
              triggerCompose={triggerCompose}
            />
          )}

          {/* Panel - 桌面端固定，移动端抽屉 */}
          <div className={`fixed inset-y-0 right-0 z-50 md:relative md:z-auto transform transition-transform duration-300 ease-in-out ${
            showSidePanel ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}>
            <SidePanel
              tree={currentProject.fileTree}
              timeline={currentProject.timeline}
              members={currentProject.members}
              onFileClick={(node) => {
                handleFileClick(node);
                setShowSidePanel(false);
              }}
              onFileReference={(node) => {
                handleFileReference(node);
                setShowSidePanel(false);
              }}
              onCreateFolder={createFolder}
              onCreateFile={createFile}
              onDeleteNode={deleteNode}
              onRenameNode={renameNode}
              onMoveNode={moveNode}
              onCloseMobile={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onSave={handleSaveFile}
      />
    </div>
  );
}
