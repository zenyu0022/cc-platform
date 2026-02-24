import { Project, Post, Reply, Member, FileNode, TimelineEvent, Attachment } from '@/types';
import { StoredData, STORAGE_KEY, getInitialData } from './initialData';

// 读取数据
function getData(): StoredData {
  if (typeof window === 'undefined') {
    return getInitialData();
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initial = getInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  return JSON.parse(stored);
}

// 保存数据
function saveData(data: StoredData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// API 接口
export const db = {
  // 项目
  async getProjects(): Promise<Project[]> {
    const data = getData();
    return data.projects;
  },

  async getProject(id: string): Promise<Project | null> {
    const data = getData();
    return data.projects.find(p => p.id === id) || null;
  },

  async getCurrentProjectId(): Promise<string> {
    const data = getData();
    return data.currentProjectId;
  },

  async setCurrentProjectId(id: string): Promise<void> {
    const data = getData();
    data.currentProjectId = id;
    saveData(data);
  },

  async createProject(input: { name: string; description?: string; visibility: 'private' | 'team' | 'public' }): Promise<Project> {
    const data = getData();
    const project: Project = {
      id: `proj-${generateId()}`,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      fileTree: { id: `root-${generateId()}`, name: input.name, type: 'folder', children: [] },
      posts: [],
      timeline: [],
      members: [{ id: 'u1', name: '张三', type: 'human', online: true }],
    };
    data.projects.push(project);
    saveData(data);
    return project;
  },

  // 帖子
  async getPosts(projectId: string): Promise<Post[]> {
    const project = await this.getProject(projectId);
    return project?.posts || [];
  },

  async getPost(postId: string): Promise<Post | null> {
    const data = getData();
    for (const project of data.projects) {
      const post = project.posts.find(p => p.id === postId);
      if (post) return post;
    }
    return null;
  },

  async createPost(input: {
    projectId: string;
    title: string;
    content: string;
    authorId: string;
    attachments?: Attachment[];
    tags?: string[];
  }): Promise<Post> {
    const data = getData();
    const project = data.projects.find(p => p.id === input.projectId);
    if (!project) throw new Error('Project not found');

    const author = project.members.find(m => m.id === input.authorId) || { id: 'u1', name: '张三', type: 'human' as const };

    const post: Post = {
      id: `post-${generateId()}`,
      title: input.title,
      content: input.content,
      author: { id: author.id, name: author.name, type: author.type },
      createdAt: new Date().toISOString(),
      tags: input.tags,
      attachments: input.attachments,
      replies: [],
      replyCount: 0,
    };

    project.posts.unshift(post);
    saveData(data);
    return post;
  },

  async deletePost(postId: string): Promise<void> {
    const data = getData();
    for (const project of data.projects) {
      const index = project.posts.findIndex(p => p.id === postId);
      if (index !== -1) {
        project.posts.splice(index, 1);
        saveData(data);
        return;
      }
    }
  },

  // 回复
  async createReply(input: {
    postId: string;
    content: string;
    authorId: string;
  }): Promise<Reply> {
    const data = getData();
    const author = { id: 'u1', name: '张三', type: 'human' as const };

    for (const project of data.projects) {
      const post = project.posts.find(p => p.id === input.postId);
      if (post) {
        const reply: Reply = {
          id: `reply-${generateId()}`,
          content: input.content,
          author,
          createdAt: new Date().toISOString(),
        };
        post.replies.push(reply);
        post.replyCount = post.replies.length;
        saveData(data);
        return reply;
      }
    }

    throw new Error('Post not found');
  },

  // 成员
  async getMembers(projectId: string): Promise<Member[]> {
    const project = await this.getProject(projectId);
    return project?.members || [];
  },

  // 文件树
  async getFileTree(projectId: string): Promise<FileNode | null> {
    const project = await this.getProject(projectId);
    return project?.fileTree || null;
  },

  // 时间线
  async getTimeline(projectId: string): Promise<TimelineEvent[]> {
    const project = await this.getProject(projectId);
    return project?.timeline || [];
  },

  // 创建文件夹
  async createFolder(projectId: string, parentId: string, name: string): Promise<FileNode> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const folder: FileNode = {
      id: `folder-${generateId()}`,
      name,
      type: 'folder',
      children: [],
    };

    const addToParent = (node: FileNode): boolean => {
      if (node.id === parentId && node.type === 'folder') {
        node.children = node.children || [];
        node.children.push(folder);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addToParent(child)) return true;
        }
      }
      return false;
    };

    if (parentId === project.fileTree.id || parentId === 'root') {
      project.fileTree.children = project.fileTree.children || [];
      project.fileTree.children.push(folder);
    } else {
      addToParent(project.fileTree);
    }

    saveData(data);
    return folder;
  },

  // 创建文件
  async createFile(projectId: string, parentId: string, name: string, content: string = ''): Promise<FileNode> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const ext = name.split('.').pop()?.toLowerCase() || 'txt';
    const mimeTypes: Record<string, string> = {
      ts: 'text/typescript',
      tsx: 'text/typescript-jsx',
      js: 'text/javascript',
      jsx: 'text/javascript-jsx',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
    };

    const file: FileNode = {
      id: `file-${generateId()}`,
      name,
      type: 'file',
      content,
      size: content.length,
      mimeType: mimeTypes[ext] || 'text/plain',
    };

    const addToParent = (node: FileNode): boolean => {
      if (node.id === parentId && node.type === 'folder') {
        node.children = node.children || [];
        node.children.push(file);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addToParent(child)) return true;
        }
      }
      return false;
    };

    if (parentId === project.fileTree.id || parentId === 'root') {
      project.fileTree.children = project.fileTree.children || [];
      project.fileTree.children.push(file);
    } else {
      addToParent(project.fileTree);
    }

    // 添加时间线事件
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'create',
      fileName: name,
      filePath: name,
      author: { id: 'u1', name: '张三', type: 'human' },
      summary: '创建了文件',
      createdAt: new Date().toISOString(),
    });

    saveData(data);
    return file;
  },

  // 更新文件树（拖拽后）
  async updateFileTree(projectId: string, tree: FileNode): Promise<void> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');
    project.fileTree = tree;
    saveData(data);
  },

  // 获取文件内容
  async getFileContent(projectId: string, fileId: string): Promise<string> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const findFile = (node: FileNode): FileNode | null => {
      if (node.id === fileId) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findFile(child);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(project.fileTree);
    return file?.content || '';
  },

  // 更新文件内容
  async updateFileContent(projectId: string, fileId: string, content: string): Promise<void> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const findAndUpdate = (node: FileNode): boolean => {
      if (node.id === fileId) {
        node.content = content;
        node.size = content.length;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndUpdate(child)) return true;
        }
      }
      return false;
    };

    findAndUpdate(project.fileTree);

    // 添加时间线事件
    const findName = (node: FileNode): string | null => {
      if (node.id === fileId) return node.name;
      if (node.children) {
        for (const child of node.children) {
          const name = findName(child);
          if (name) return name;
        }
      }
      return null;
    };

    const fileName = findName(project.fileTree) || 'unknown';
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'modify',
      fileName,
      filePath: fileName,
      author: { id: 'u1', name: '张三', type: 'human' },
      summary: '修改了文件',
      createdAt: new Date().toISOString(),
    });

    saveData(data);
  },

  // 删除文件/文件夹
  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const removeFromParent = (node: FileNode): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeId);
        if (index !== -1) {
          node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeFromParent(child)) return true;
        }
      }
      return false;
    };

    removeFromParent(project.fileTree);
    saveData(data);
  },

  // 重命名文件/文件夹
  async renameNode(projectId: string, nodeId: string, newName: string): Promise<void> {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const findAndRename = (node: FileNode): boolean => {
      if (node.id === nodeId) {
        node.name = newName;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndRename(child)) return true;
        }
      }
      return false;
    };

    findAndRename(project.fileTree);
    saveData(data);
  },

  // 重置数据（用于开发测试）
  async reset(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

export type DB = typeof db;
