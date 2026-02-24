// API 客户端 - 用于前端与后端 API 通信

const API_BASE = '/api/files';

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

// 获取默认 Agent 身份（人类用户）
function getDefaultAgent(): AgentIdentity {
  return {
    id: 'human-user',
    name: '用户',
    role: 'user',
  };
}

// GET 请求
async function getApi(params: Record<string, string> = {}) {
  const url = new URL(API_BASE, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// POST 请求
async function postApi(action: string, params: Record<string, unknown> = {}, agent?: AgentIdentity) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params, agent: agent || getDefaultAgent() }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// API 客户端
export const apiClient = {
  // 项目
  async getProjects() {
    const result = await getApi({});
    return result.projects;
  },

  async getFullProject(projectId: string) {
    const result = await getApi({ projectId, action: 'project' });
    return result.project;
  },

  async getProject(projectId: string) {
    const result = await getApi({ projectId });
    return result.tree ? { fileTree: result.tree } : null;
  },

  // 文件树
  async getFileTree(projectId: string) {
    const result = await getApi({ projectId });
    return result.tree;
  },

  // 文件操作
  async createFolder(projectId: string, parentId: string, name: string) {
    return postApi('createFolder', { projectId, parentId, name });
  },

  async createFile(projectId: string, parentId: string, name: string, content: string = '') {
    return postApi('createFile', { projectId, parentId, name, content });
  },

  async getFileContent(projectId: string, fileId: string) {
    return getApi({ projectId, fileId, action: 'content' });
  },

  async updateFileContent(projectId: string, fileId: string, content: string) {
    return postApi('updateContent', { projectId, fileId, content });
  },

  async deleteNode(projectId: string, nodeId: string) {
    return postApi('delete', { projectId, nodeId });
  },

  async renameNode(projectId: string, nodeId: string, newName: string) {
    return postApi('rename', { projectId, nodeId, newName });
  },

  async moveNode(projectId: string, nodeId: string, newParentId: string) {
    return postApi('move', { projectId, nodeId, newParentId });
  },

  async searchFiles(projectId: string, query: string) {
    return getApi({ projectId, action: 'search', query });
  },

  // 帖子操作
  async getPosts(projectId: string) {
    const result = await getApi({ projectId, action: 'posts' });
    return result.posts;
  },

  async getPost(projectId: string, postId: string) {
    const result = await getApi({ projectId, action: 'post', postId });
    return result.post;
  },

  async createPost(projectId: string, title: string, content: string, attachments?: { id: string; name: string }[]) {
    return postApi('createPost', { projectId, title, content, attachments });
  },

  async createReply(projectId: string, postId: string, content: string) {
    return postApi('createReply', { projectId, postId, content });
  },

  async deletePost(projectId: string, postId: string) {
    return postApi('deletePost', { projectId, postId });
  },

  // 时间线
  async getTimeline(projectId: string, limit: number = 20) {
    const result = await getApi({ projectId, action: 'timeline', limit: String(limit) });
    return result.timeline;
  },

  // 成员
  async getAgents(projectId: string) {
    const result = await getApi({ projectId, action: 'agents' });
    return result.agents;
  },
};
