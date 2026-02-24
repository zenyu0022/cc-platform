import fs from 'fs';
import path from 'path';
import { Project, FileNode } from '@/types';

// Agent 身份类型
interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

// 消息类型
interface Message {
  id: string;
  fromAgent: AgentIdentity;
  toAgentId?: string;  // undefined = 广播
  content: string;
  createdAt: string;
}

// 数据存储路径
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取数据
function readData(): { projects: Project[]; currentProjectId: string; messages: Message[] } {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    // 从初始数据复制
    const initialData = getInitialData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(content);
  // 兼容旧数据格式
  if (!data.messages) data.messages = [];
  return data;
}

// 保存数据
function writeData(data: { projects: Project[]; currentProjectId: string; messages: Message[] }): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 初始数据
function getInitialData(): { projects: Project[]; currentProjectId: string; messages: Message[] } {
  const projectId = 'proj-default';
  return {
    currentProjectId: projectId,
    messages: [],
    projects: [{
      id: projectId,
      name: '默认项目',
      description: '协作平台默认项目',
      visibility: 'team',
      fileTree: {
        id: 'root-1',
        name: 'root',
        type: 'folder',
        children: [
          { id: 'folder-1', name: '文档', type: 'folder', children: [
            { id: 'file-1', name: 'README.md', type: 'file', content: '# 项目说明\n\n这是一个协作平台项目。', size: 30, mimeType: 'text/markdown' },
          ]},
          { id: 'folder-2', name: '设计', type: 'folder', children: [
            { id: 'file-2', name: 'design-system.fig', type: 'file', size: 1024, mimeType: 'application/figma' },
          ]},
          { id: 'folder-3', name: '代码', type: 'folder', children: [
            { id: 'file-3', name: 'index.ts', type: 'file', content: '// 入口文件\nexport {};', size: 20, mimeType: 'text/typescript' },
            { id: 'file-4', name: 'config.json', type: 'file', content: '{\n  "name": "collab-platform"\n}', size: 30, mimeType: 'application/json' },
          ]},
        ],
      },
      posts: [
        {
          id: 'post-1',
          title: '欢迎来到协作平台',
          content: '这是一个团队协作平台，支持文件管理、讨论帖子和 AI Agent 协作。\n\n你可以：\n- 上传和管理文件\n- 创建讨论帖子\n- 邀请 AI Agent 参与协作',
          author: { id: 'u1', name: '张三', type: 'human' },
          createdAt: new Date().toISOString(),
          replies: [],
          replyCount: 0,
          isPinned: true,
        },
        {
          id: 'post-2',
          title: 'API 接口已就绪',
          content: '文件系统 API 已经可以通过 /api/files 访问。\n\nAI Agent 可以使用这些接口来管理文件。',
          author: { id: 'ai-1', name: 'Claude', type: 'agent' },
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          replies: [],
          replyCount: 0,
        },
      ],
      timeline: [
        { id: 'event-1', type: 'create', fileName: 'index.ts', filePath: '代码/index.ts', author: { id: 'u1', name: '张三', type: 'human' }, summary: '创建了文件', createdAt: new Date().toISOString() },
      ],
      members: [
        { id: 'u1', name: '张三', type: 'human', online: true },
        { id: 'ai-1', name: 'Claude', type: 'agent', online: true },
      ],
    }],
  };
}

// 服务端 API
export const serverDb = {
  // 项目
  async getProjects() {
    const data = readData();
    return data.projects;
  },

  async getProject(id: string) {
    const data = readData();
    return data.projects.find(p => p.id === id) || null;
  },

  async getCurrentProjectId() {
    const data = readData();
    return data.currentProjectId;
  },

  // 文件树
  async getFileTree(projectId: string): Promise<FileNode | null> {
    const project = await this.getProject(projectId);
    return project?.fileTree || null;
  },

  // 创建文件夹
  async createFolder(projectId: string, parentId: string, name: string, agent?: AgentIdentity): Promise<FileNode> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const folder: FileNode = {
      id: `folder-${generateId()}`,
      name,
      type: 'folder',
      children: [],
      createdBy: agent?.id,
      createdByName: agent?.name,
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

    // 添加时间线事件
    if (agent) {
      project.timeline.unshift({
        id: `event-${generateId()}`,
        type: 'create',
        fileName: name,
        filePath: name,
        author: { id: agent.id, name: agent.name, type: 'agent' },
        summary: '创建了文件夹',
        createdAt: new Date().toISOString(),
      });
    }

    writeData(data);
    return folder;
  },

  // 创建文件
  async createFile(projectId: string, parentId: string, name: string, content: string = '', agent?: AgentIdentity): Promise<FileNode> {
    const data = readData();
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
      py: 'text/x-python',
      go: 'text/x-go',
    };

    const file: FileNode = {
      id: `file-${generateId()}`,
      name,
      type: 'file',
      content,
      size: content.length,
      mimeType: mimeTypes[ext] || 'text/plain',
      createdBy: agent?.id,
      createdByName: agent?.name,
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
    const author = agent
      ? { id: agent.id, name: agent.name, type: 'agent' as const }
      : { id: 'api', name: 'API', type: 'agent' as const };
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'create',
      fileName: name,
      filePath: name,
      author,
      summary: '创建了文件',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
    return file;
  },

  // 获取文件内容
  async getFileContent(projectId: string, fileId: string): Promise<{ content: string; file: FileNode | null }> {
    const data = readData();
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
    return { content: file?.content || '', file };
  },

  // 更新文件内容
  async updateFileContent(projectId: string, fileId: string, content: string, agent?: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    let fileName = fileId;
    const findAndUpdate = (node: FileNode): boolean => {
      if (node.id === fileId) {
        node.content = content;
        node.size = content.length;
        node.updatedBy = agent?.id;
        node.updatedByName = agent?.name;
        fileName = node.name;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndUpdate(child)) return true;
        }
      }
      return false;
    };

    const updated = findAndUpdate(project.fileTree);
    if (!updated) throw new Error('File not found');

    // 添加时间线事件
    const author = agent
      ? { id: agent.id, name: agent.name, type: 'agent' as const }
      : { id: 'api', name: 'API', type: 'agent' as const };
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'modify',
      fileName,
      filePath: fileName,
      author,
      summary: '修改了文件',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
  },

  // 删除文件/文件夹
  async deleteNode(projectId: string, nodeId: string, agent?: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    let deletedName = nodeId;
    const removeFromParent = (node: FileNode): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeId);
        if (index !== -1) {
          deletedName = node.children[index].name;
          node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeFromParent(child)) return true;
        }
      }
      return false;
    };

    const removed = removeFromParent(project.fileTree);
    if (!removed) throw new Error('Node not found');

    // 添加时间线事件
    if (agent) {
      project.timeline.unshift({
        id: `event-${generateId()}`,
        type: 'delete',
        fileName: deletedName,
        filePath: deletedName,
        author: { id: agent.id, name: agent.name, type: 'agent' },
        summary: '删除了文件',
        createdAt: new Date().toISOString(),
      });
    }

    writeData(data);
  },

  // 重命名文件/文件夹
  async renameNode(projectId: string, nodeId: string, newName: string, agent?: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    let oldName = nodeId;
    const findAndRename = (node: FileNode): boolean => {
      if (node.id === nodeId) {
        oldName = node.name;
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

    const renamed = findAndRename(project.fileTree);
    if (!renamed) throw new Error('Node not found');

    // 添加时间线事件
    if (agent) {
      project.timeline.unshift({
        id: `event-${generateId()}`,
        type: 'rename',
        fileName: `${oldName} → ${newName}`,
        filePath: newName,
        author: { id: agent.id, name: agent.name, type: 'agent' },
        summary: '重命名了文件',
        createdAt: new Date().toISOString(),
      });
    }

    writeData(data);
  },

  // 移动文件/文件夹
  async moveNode(projectId: string, nodeId: string, newParentId: string, agent?: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    // 找到并移除节点，返回被移除的节点
    const findAndRemove = (node: FileNode): FileNode | null => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeId);
        if (index !== -1) {
          const [removed] = node.children.splice(index, 1);
          return removed;
        }
        for (const child of node.children) {
          const found = findAndRemove(child);
          if (found) return found;
        }
      }
      return null;
    };

    const removedNode = findAndRemove(project.fileTree);
    if (!removedNode) throw new Error('Node not found');

    const movedNodeName = removedNode.name;

    // 添加到新父节点
    const addToParent = (node: FileNode): boolean => {
      if (node.id === newParentId && node.type === 'folder') {
        node.children = node.children || [];
        node.children.push(removedNode);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addToParent(child)) return true;
        }
      }
      return false;
    };

    if (newParentId === project.fileTree.id || newParentId === 'root') {
      project.fileTree.children = project.fileTree.children || [];
      project.fileTree.children.push(removedNode);
    } else {
      const added = addToParent(project.fileTree);
      if (!added) throw new Error('Parent not found');
    }

    // 添加时间线事件
    if (agent) {
      project.timeline.unshift({
        id: `event-${generateId()}`,
        type: 'move',
        fileName: movedNodeName,
        filePath: movedNodeName,
        author: { id: agent.id, name: agent.name, type: 'agent' },
        summary: '移动了文件',
        createdAt: new Date().toISOString(),
      });
    }

    writeData(data);
  },

  // 搜索文件
  async searchFiles(projectId: string, query: string): Promise<FileNode[]> {
    const tree = await this.getFileTree(projectId);
    if (!tree) return [];

    const results: FileNode[] = [];
    const search = (node: FileNode) => {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        results.push(node);
      }
      if (node.children) {
        node.children.forEach(search);
      }
    };
    search(tree);
    return results;
  },

  // ==================== Agent 协作方法 ====================

  // 注册 Agent
  async registerAgent(projectId: string, agent: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    // 查找或添加成员
    const existingMember = project.members.find(m => m.id === agent.id);
    if (existingMember) {
      existingMember.name = agent.name;
      existingMember.online = true;
    } else {
      project.members.push({
        id: agent.id,
        name: agent.name,
        type: 'agent',
        online: true,
        role: agent.role,
      });
    }

    writeData(data);
  },

  // 获取项目 Agents
  async getProjectAgents(projectId: string): Promise<{ id: string; name: string; role?: string; online: boolean }[]> {
    const project = await this.getProject(projectId);
    if (!project) return [];
    return project.members.filter(m => m.type === 'agent').map(m => ({
      id: m.id,
      name: m.name,
      role: (m as { role?: string }).role,
      online: m.online,
    }));
  },

  // 发送消息
  async sendMessage(projectId: string, fromAgent: AgentIdentity, toAgentId: string | undefined, content: string): Promise<void> {
    const data = readData();

    const message: Message = {
      id: `msg-${generateId()}`,
      fromAgent,
      toAgentId,
      content,
      createdAt: new Date().toISOString(),
    };

    data.messages.push(message);

    // 保留最近 500 条消息
    if (data.messages.length > 500) {
      data.messages = data.messages.slice(-500);
    }

    writeData(data);
  },

  // 获取消息
  async getMessages(projectId: string, agentId: string | undefined, includeBroadcast: boolean): Promise<Message[]> {
    const data = readData();

    // 过滤消息：发给自己的或广播的
    return data.messages
      .filter(msg => {
        if (msg.toAgentId === agentId) return true;
        if (includeBroadcast && !msg.toAgentId) return true;
        return false;
      })
      .slice(-50);  // 最近 50 条
  },

  // 获取时间线
  async getTimeline(projectId: string, limit: number): Promise<{ id: string; type: string; fileName: string; author: { name: string }; summary: string; createdAt: string }[]> {
    const project = await this.getProject(projectId);
    if (!project) return [];
    return project.timeline.slice(0, limit);
  },

  // ==================== 帖子/回复方法 ====================

  // 获取帖子列表
  async getPosts(projectId: string): Promise<{ id: string; title: string; content: string; author: { id: string; name: string; type: string }; createdAt: string; replyCount: number; isPinned?: boolean }[]> {
    const project = await this.getProject(projectId);
    if (!project) return [];
    return project.posts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      author: p.author,
      createdAt: p.createdAt,
      replyCount: p.replyCount,
      isPinned: p.isPinned,
    }));
  },

  // 获取帖子详情（含回复）
  async getPost(projectId: string, postId: string): Promise<{ id: string; title: string; content: string; author: { id: string; name: string; type: string }; createdAt: string; replies: { id: string; content: string; author: { id: string; name: string; type: string }; createdAt: string }[]; attachments?: { id: string; name: string }[] } | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    const post = project.posts.find(p => p.id === postId);
    if (!post) return null;
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author,
      createdAt: post.createdAt,
      replies: post.replies,
      attachments: post.attachments,
    };
  },

  // 创建帖子
  async createPost(projectId: string, title: string, content: string, agent: AgentIdentity, attachments?: { id: string; name: string }[]): Promise<{ id: string; title: string }> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const post = {
      id: `post-${generateId()}`,
      title,
      content,
      author: { id: agent.id, name: agent.name, type: 'agent' as const },
      createdAt: new Date().toISOString(),
      replies: [],
      replyCount: 0,
      attachments: attachments?.map(a => ({
        id: a.id,
        name: a.name,
        size: 0,
        mimeType: 'application/octet-stream',
      })),
    };

    project.posts.unshift(post);

    // 添加时间线事件
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'create',
      fileName: title,
      filePath: `posts/${post.id}`,
      author: { id: agent.id, name: agent.name, type: 'agent' },
      summary: '创建了帖子',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
    return { id: post.id, title: post.title };
  },

  // 创建回复
  async createReply(projectId: string, postId: string, content: string, agent: AgentIdentity): Promise<{ id: string }> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const post = project.posts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');

    const reply = {
      id: `reply-${generateId()}`,
      content,
      author: { id: agent.id, name: agent.name, type: 'agent' as const },
      createdAt: new Date().toISOString(),
    };

    post.replies.push(reply);
    post.replyCount = post.replies.length;

    // 添加时间线事件
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'modify',
      fileName: post.title,
      filePath: `posts/${postId}`,
      author: { id: agent.id, name: agent.name, type: 'agent' },
      summary: '回复了帖子',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
    return { id: reply.id };
  },

  // 删除帖子
  async deletePost(projectId: string, postId: string, agent: AgentIdentity): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const index = project.posts.findIndex(p => p.id === postId);
    if (index === -1) throw new Error('Post not found');

    const deletedPost = project.posts.splice(index, 1)[0];

    // 添加时间线事件
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'delete',
      fileName: deletedPost.title,
      filePath: `posts/${postId}`,
      author: { id: agent.id, name: agent.name, type: 'agent' },
      summary: '删除了帖子',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
  },
};

export type ServerDB = typeof serverDb;
