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

  // 文件操作
  const createFolder = useCallback(async (parentId: string, name: string) => {
    if (!currentProject) throw new Error('No project selected');
    await db.createFolder(currentProject.id, parentId, name);

    // 重新加载文件树
    const tree = await db.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const createFile = useCallback(async (parentId: string, name: string, content: string = '') => {
    if (!currentProject) throw new Error('No project selected');
    await db.createFile(currentProject.id, parentId, name, content);

    // 重新加载文件树和时间线
    const [tree, timeline] = await Promise.all([
      db.getFileTree(currentProject.id),
      db.getTimeline(currentProject.id),
    ]);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree, timeline } : null);
  }, [currentProject]);

  const updateFileContent = useCallback(async (fileId: string, content: string) => {
    if (!currentProject) throw new Error('No project selected');
    await db.updateFileContent(currentProject.id, fileId, content);

    // 重新加载文件树和时间线
    const [tree, timeline] = await Promise.all([
      db.getFileTree(currentProject.id),
      db.getTimeline(currentProject.id),
    ]);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree, timeline } : null);
  }, [currentProject]);

  const deleteNode = useCallback(async (nodeId: string) => {
    if (!currentProject) throw new Error('No project selected');
    await db.deleteNode(currentProject.id, nodeId);

    // 重新加载文件树
    const tree = await db.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const renameNode = useCallback(async (nodeId: string, newName: string) => {
    if (!currentProject) throw new Error('No project selected');
    await db.renameNode(currentProject.id, nodeId, newName);

    // 重新加载文件树
    const tree = await db.getFileTree(currentProject.id);
    setCurrentProject(prev => prev ? { ...prev, fileTree: tree || prev.fileTree } : null);
  }, [currentProject]);

  const moveNode = useCallback(async (nodeId: string, newParentId: string) => {
    if (!currentProject) throw new Error('No project selected');
    // 移动节点的逻辑：先删除再添加到新位置
    // 这里简化处理，实际需要更复杂的树操作
    const tree = await db.getFileTree(currentProject.id);
    if (!tree) return;

    // 深拷贝并移动节点
    const findAndRemove = (node: FileNode, id: string): FileNode | null => {
      if (!node.children) return null;
      const index = node.children.findIndex(c => c.id === id);
      if (index !== -1) {
        const [removed] = node.children.splice(index, 1);
        return removed;
      }
      for (const child of node.children) {
        const found = findAndRemove(child, id);
        if (found) return found;
      }
      return null;
    };

    const addToParent = (node: FileNode, id: string, child: FileNode): boolean => {
      if (node.id === id && node.type === 'folder') {
        node.children = node.children || [];
        node.children.push(child);
        return true;
      }
      if (node.children) {
        for (const c of node.children) {
          if (addToParent(c, id, child)) return true;
        }
      }
      return false;
    };

    const movedNode = findAndRemove(tree, nodeId);
    if (movedNode) {
      addToParent(tree, newParentId, movedNode);
      await db.updateFileTree(currentProject.id, tree);
      setCurrentProject(prev => prev ? { ...prev, fileTree: tree } : null);
    }
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
