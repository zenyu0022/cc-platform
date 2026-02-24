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

  // 重置数据（用于开发测试）
  async reset(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

export type DB = typeof db;
