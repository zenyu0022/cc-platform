'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, Post, Reply, Member, FileNode, TimelineEvent, Attachment } from '@/types';
import { db } from '@/lib/db';

interface DataContextValue {
  // 状态
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;

  // 项目操作
  selectProject: (id: string) => void;
  createProject: (input: { name: string; description?: string; visibility: 'private' | 'team' | 'public' }) => Promise<Project>;

  // 帖子操作
  posts: Post[];
  createPost: (input: { title: string; content: string; attachments?: Attachment[]; tags?: string[] }) => Promise<Post>;
  deletePost: (postId: string) => Promise<void>;

  // 回复操作
  createReply: (postId: string, content: string) => Promise<Reply>;

  // 其他数据
  members: Member[];
  fileTree: FileNode | null;
  timeline: TimelineEvent[];

  // 刷新
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 加载数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allProjects = await db.getProjects();
      const currentId = await db.getCurrentProjectId();
      const current = allProjects.find(p => p.id === currentId) || allProjects[0] || null;

      setProjects(allProjects);
      setCurrentProject(current);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 选择项目
  const selectProject = useCallback(async (id: string) => {
    await db.setCurrentProjectId(id);
    const project = projects.find(p => p.id === id) || null;
    setCurrentProject(project);
  }, [projects]);

  // 创建项目
  const createProject = useCallback(async (input: { name: string; description?: string; visibility: 'private' | 'team' | 'public' }) => {
    const project = await db.createProject(input);
    setProjects(prev => [...prev, project]);
    return project;
  }, []);

  // 创建帖子
  const createPost = useCallback(async (input: { title: string; content: string; attachments?: Attachment[]; tags?: string[] }) => {
    if (!currentProject) throw new Error('No project selected');

    const post = await db.createPost({
      projectId: currentProject.id,
      title: input.title,
      content: input.content,
      authorId: 'u1',
      attachments: input.attachments,
      tags: input.tags,
    });

    // 更新当前项目的帖子列表
    setCurrentProject(prev => prev ? { ...prev, posts: [post, ...prev.posts] } : null);

    return post;
  }, [currentProject]);

  // 删除帖子
  const deletePost = useCallback(async (postId: string) => {
    await db.deletePost(postId);
    setCurrentProject(prev => prev ? { ...prev, posts: prev.posts.filter(p => p.id !== postId) } : null);
  }, []);

  // 创建回复
  const createReply = useCallback(async (postId: string, content: string) => {
    const reply = await db.createReply({
      postId,
      content,
      authorId: 'u1',
    });

    // 更新帖子的回复
    setCurrentProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              replies: [...p.replies, reply],
              replyCount: p.replyCount + 1,
            };
          }
          return p;
        }),
      };
    });

    return reply;
  }, []);

  const value: DataContextValue = {
    projects,
    currentProject,
    isLoading,
    selectProject,
    createProject,
    posts: currentProject?.posts || [],
    createPost,
    deletePost,
    createReply,
    members: currentProject?.members || [],
    fileTree: currentProject?.fileTree || null,
    timeline: currentProject?.timeline || [],
    refresh: loadData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
