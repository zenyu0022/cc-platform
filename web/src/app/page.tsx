'use client';

import { useState } from 'react';
import { Post, FileNode } from '@/types';
import { mockProjects, mockCurrentProject } from '@/mock/data';
import ProjectNav from '@/components/ProjectNav';
import PostList from '@/components/PostList';
import PostDetail from '@/components/PostDetail';
import SidePanel from '@/components/SidePanel';

export default function Home() {
  const [currentProjectId, setCurrentProjectId] = useState(mockCurrentProject.id);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const currentProject = mockProjects.find(p => p.id === currentProjectId) || mockCurrentProject;

  const handleFileClick = (node: FileNode) => {
    console.log('引用文件:', node.name);
  };

  return (
    <div className="h-screen flex bg-neutral-50 overflow-hidden">
      {/* Sidebar */}
      <ProjectNav
        projects={mockProjects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
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
