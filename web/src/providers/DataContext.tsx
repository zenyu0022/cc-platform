'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, Post, Reply, Member, FileNode, TimelineEvent, Attachment } from '@/types';
import { apiClient } from '@/lib/apiClient';

const DEFAULT_PROJECT_ID = 'proj-default';

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

  // 文件操作
  createFolder: (parentId: string, name: string) => Promise<void>;
  createFile: (parentId: string, name: string, content?: string) => Promise<void>;
  updateFileContent: (fileId: string, content: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  renameNode: (nodeId: string, newName: string) => Promise<void>;
  moveNode: (nodeId: string, newParentId: string) => Promise<void>;

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
      // 先加载项目列表
      const allProjects = await apiClient.getProjects();

      if (allProjects && allProjects.length > 0) {
        setProjects(allProjects);
        // 加载完整项目数据
        const current = await apiClient.getFullProject(allProjects[0].id);
        setCurrentProject(current);
      } else {
        // 如果没有项目，创建默认项目
        setCurrentProject(null);
      }
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
    try {
      const project = await apiClient.getFullProject(id);
      setCurrentProject(project);
    } catch (error) {
      console.error('Failed to select project:', error);
    }
  }, []);

  // 创建项目
  const createProject = useCallback(async (input: { name: string; description?: string; visibility: 'private' | 'team' | 'public' }) => {
    // TODO: 实现 API 创建项目
    const project = {
      id: `proj-${Date.now()}`,
      ...input,
      fileTree: { id: 'root', name: 'root', type: 'folder', children: [] },
      posts: [],
      timeline: [],
      members: [],
    } as Project;
    setProjects(prev => [...prev, project]);
    return project;
  }, []);

  // 创建帖子
  const createPost = useCallback(async (input: { title: string; content: string; attachments?: Attachment[]; tags?: string[] }) => {
    if (!currentProject) throw new Error('No project selected');

    const result = await apiClient.createPost(currentProject.id, input.title, input.content, input.attachments);

    // 刷新项目数据
    await loadData();

    return result.post;
  }, [currentProject, loadData]);

  // 删除帖子
  const deletePost = useCallback(async (postId: string) => {
    if (!currentProject) throw new Error('No project selected');

    await apiClient.deletePost(currentProject.id, postId);
    setCurrentProject(prev => prev ? { ...prev, posts: prev.posts.filter(p => p.id !== postId) } : null);
  }, [currentProject]);

  // 创建回复
  const createReply = useCallback(async (postId: string, content: string) => {
    if (!currentProject) throw new Error('No project selected');

    const result = await apiClient.createReply(currentProject.id, postId, content);

    // 更新帖子的回复
    setCurrentProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              replies: [...p.replies, result.reply],
              replyCount: p.replyCount + 1,
            };
          }
          return p;
        }),
      };
    });

    return result.reply;
  }, [currentProject]);

  // 文件操作
  const createFolder = useCallback(async (parentId: string, name: string) => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.createFolder(currentProject.id, parentId, name);

    // 重新加载文件树
    const tree = await apiClient.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const createFile = useCallback(async (parentId: string, name: string, content: string = '') => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.createFile(currentProject.id, parentId, name, content);

    // 重新加载文件树和时间线
    const [tree, timeline] = await Promise.all([
      apiClient.getFileTree(currentProject.id),
      apiClient.getTimeline(currentProject.id),
    ]);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree, timeline } : null);
  }, [currentProject]);

  const updateFileContent = useCallback(async (fileId: string, content: string) => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.updateFileContent(currentProject.id, fileId, content);

    // 重新加载文件树和时间线
    const [tree, timeline] = await Promise.all([
      apiClient.getFileTree(currentProject.id),
      apiClient.getTimeline(currentProject.id),
    ]);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree, timeline } : null);
  }, [currentProject]);

  const deleteNode = useCallback(async (nodeId: string) => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.deleteNode(currentProject.id, nodeId);

    // 重新加载文件树
    const tree = await apiClient.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const renameNode = useCallback(async (nodeId: string, newName: string) => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.renameNode(currentProject.id, nodeId, newName);

    // 重新加载文件树
    const tree = await apiClient.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const moveNode = useCallback(async (nodeId: string, newParentId: string) => {
    if (!currentProject) throw new Error('No project selected');
    await apiClient.moveNode(currentProject.id, nodeId, newParentId);

    // 重新加载文件树
    const tree = await apiClient.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

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
    createFolder,
    createFile,
    updateFileContent,
    deleteNode,
    renameNode,
    moveNode,
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
