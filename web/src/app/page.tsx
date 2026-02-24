'use client';

import { useState } from 'react';
import { Post, FileNode } from '@/types';
import { useProjects } from '@/hooks/useProjects';
import ProjectNav from '@/components/ProjectNav';
import PostList from '@/components/PostList';
import PostDetail from '@/components/PostDetail';
import SidePanel from '@/components/SidePanel';

export default function Home() {
  const { projects, currentProject, isLoading, selectProject } = useProjects();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const handleFileClick = (node: FileNode) => {
    console.log('引用文件:', node.name);
  };

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
        }}
      />

      {/* Main */}
      {selectedPost ? (
        <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />
      ) : (
        <PostList
          posts={currentProject.posts}
          members={currentProject.members}
          files={currentProject.fileTree}
          onSelectPost={setSelectedPost}
        />
      )}

      {/* Panel */}
      <SidePanel
        tree={currentProject.fileTree}
        timeline={currentProject.timeline}
        members={currentProject.members}
        onFileClick={handleFileClick}
      />
    </div>
  );
}
