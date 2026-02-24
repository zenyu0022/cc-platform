import fs from 'fs';
import path from 'path';
import { Project, FileNode } from '@/types';

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
function readData(): { projects: Project[]; currentProjectId: string } {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    // 从初始数据复制
    const initialData = getInitialData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

// 保存数据
function writeData(data: { projects: Project[]; currentProjectId: string }): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 初始数据
function getInitialData(): { projects: Project[]; currentProjectId: string } {
  const projectId = 'proj-default';
  return {
    currentProjectId: projectId,
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
  async createFolder(projectId: string, parentId: string, name: string): Promise<FileNode> {
    const data = readData();
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

    writeData(data);
    return folder;
  },

  // 创建文件
  async createFile(projectId: string, parentId: string, name: string, content: string = ''): Promise<FileNode> {
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
      author: { id: 'api', name: 'API', type: 'agent' },
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
  async updateFileContent(projectId: string, fileId: string, content: string): Promise<void> {
    const data = readData();
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

    const updated = findAndUpdate(project.fileTree);
    if (!updated) throw new Error('File not found');

    // 添加时间线事件
    project.timeline.unshift({
      id: `event-${generateId()}`,
      type: 'modify',
      fileName: fileId,
      filePath: fileId,
      author: { id: 'api', name: 'API', type: 'agent' },
      summary: '修改了文件',
      createdAt: new Date().toISOString(),
    });

    writeData(data);
  },

  // 删除文件/文件夹
  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    const data = readData();
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

    const removed = removeFromParent(project.fileTree);
    if (!removed) throw new Error('Node not found');

    writeData(data);
  },

  // 重命名文件/文件夹
  async renameNode(projectId: string, nodeId: string, newName: string): Promise<void> {
    const data = readData();
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

    const renamed = findAndRename(project.fileTree);
    if (!renamed) throw new Error('Node not found');

    writeData(data);
  },

  // 移动文件/文件夹
  async moveNode(projectId: string, nodeId: string, newParentId: string): Promise<void> {
    const data = readData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    // 找到并移除节点
    let movedNode: FileNode | null = null;
    const findAndRemove = (node: FileNode): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeId);
        if (index !== -1) {
          [movedNode] = node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (findAndRemove(child)) return true;
        }
      }
      return false;
    };

    findAndRemove(project.fileTree);
    if (!movedNode) throw new Error('Node not found');

    // 添加到新父节点
    const addToParent = (node: FileNode): boolean => {
      if (node.id === newParentId && node.type === 'folder') {
        node.children = node.children || [];
        node.children.push(movedNode!);
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
      project.fileTree.children.push(movedNode);
    } else {
      const added = addToParent(project.fileTree);
      if (!added) throw new Error('Parent not found');
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
};

export type ServerDB = typeof serverDb;
