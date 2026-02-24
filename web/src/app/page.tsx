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
  const { projects, currentProject, isLoading, selectProject, createFolder, createFile, updateFileContent, deleteNode, renameNode, moveNode } = useProjects();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [referencedFiles, setReferencedFiles] = useState<FileNode[]>([]);
  const [triggerCompose, setTriggerCompose] = useState(false);
  const [triggerReply, setTriggerReply] = useState(false);

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
      {/* Sidebar */}
      <ProjectNav
        projects={projects}
        currentProjectId={currentProject.id}
        onSelectProject={(id) => {
          selectProject(id);
          setSelectedPost(null);
          setReferencedFiles([]);
        }}
      />

      {/* Main */}
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

      {/* Panel */}
      <SidePanel
        tree={currentProject.fileTree}
        timeline={currentProject.timeline}
        members={currentProject.members}
        onFileClick={handleFileClick}
        onFileReference={handleFileReference}
        onCreateFolder={createFolder}
        onCreateFile={createFile}
        onDeleteNode={deleteNode}
        onRenameNode={renameNode}
        onMoveNode={moveNode}
      />

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onSave={handleSaveFile}
      />
    </div>
  );
}
