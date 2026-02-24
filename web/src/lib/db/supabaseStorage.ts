import { supabase } from '@/lib/supabase/server';

// Agent 身份类型
interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

// ==================== Supabase 存储层 ====================

export const serverDb = {
  // ==================== 项目 ====================

  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getProject(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async getCurrentProjectId() {
    return 'proj-default';
  },

  // ==================== 文件树 ====================

  async getFileTree(projectId: string) {
    const { data, error } = await supabase
      .from('file_nodes')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    if (error) throw error;
    if (!data || data.length === 0) return null;

    // 构建树形结构
    const nodeMap = new Map(data.map(n => [n.id, { ...n, children: [] as any[] }]));
    const rootNodes: any[] = [];

    for (const node of nodeMap.values()) {
      if (!node.parent_id) {
        rootNodes.push(node);
      } else {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    // 返回虚拟根节点包裹所有根目录
    if (rootNodes.length === 0) return null;
    if (rootNodes.length === 1) return rootNodes[0];
    return {
      id: 'root',
      name: 'root',
      type: 'folder',
      children: rootNodes,
    };
  },

  // ==================== 文件夹操作 ====================

  async createFolder(projectId: string, parentId: string | null, name: string, agent?: AgentIdentity) {
    const { data, error } = await supabase
      .from('file_nodes')
      .insert({
        project_id: projectId,
        parent_id: parentId === 'root' ? null : parentId,
        name,
        type: 'folder',
        created_by: agent?.id,
        created_by_name: agent?.name,
      })
      .select()
      .single();
    if (error) throw error;

    // 添加时间线事件
    if (agent) {
      await this.addTimelineEvent(projectId, 'create', name, name, '创建了文件夹', agent);
    }

    return data;
  },

  // ==================== 文件操作 ====================

  async createFile(projectId: string, parentId: string | null, name: string, content: string = '', agent?: AgentIdentity) {
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

    const { data, error } = await supabase
      .from('file_nodes')
      .insert({
        project_id: projectId,
        parent_id: parentId === 'root' ? null : parentId,
        name,
        type: 'file',
        content,
        mime_type: mimeTypes[ext] || 'text/plain',
        size: content.length,
        created_by: agent?.id,
        created_by_name: agent?.name,
      })
      .select()
      .single();
    if (error) throw error;

    // 添加时间线事件
    const author = agent || { id: 'api', name: 'API' };
    await this.addTimelineEvent(projectId, 'create', name, name, '创建了文件', author);

    return data;
  },

  async getFileContent(projectId: string, fileId: string) {
    const { data, error } = await supabase
      .from('file_nodes')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single();
    if (error) throw error;
    return { content: data?.content || '', file: data };
  },

  async updateFileContent(projectId: string, fileId: string, content: string, agent?: AgentIdentity) {
    // 先获取文件名
    const { data: file } = await supabase
      .from('file_nodes')
      .select('name')
      .eq('id', fileId)
      .single();

    const { error } = await supabase
      .from('file_nodes')
      .update({
        content,
        size: content.length,
        updated_by: agent?.id,
        updated_by_name: agent?.name,
      })
      .eq('id', fileId);
    if (error) throw error;

    // 添加时间线事件
    const author = agent || { id: 'api', name: 'API' };
    await this.addTimelineEvent(projectId, 'modify', file?.name || fileId, file?.name || fileId, '修改了文件', author);
  },

  async deleteNode(projectId: string, nodeId: string, agent?: AgentIdentity) {
    // 获取节点信息
    const { data: node } = await supabase
      .from('file_nodes')
      .select('name')
      .eq('id', nodeId)
      .single();

    const { error } = await supabase
      .from('file_nodes')
      .delete()
      .eq('id', nodeId);
    if (error) throw error;

    // 添加时间线事件
    if (agent && node) {
      await this.addTimelineEvent(projectId, 'delete', node.name, node.name, '删除了文件', agent);
    }
  },

  async renameNode(projectId: string, nodeId: string, newName: string, agent?: AgentIdentity) {
    const { data: node } = await supabase
      .from('file_nodes')
      .select('name')
      .eq('id', nodeId)
      .single();

    const { error } = await supabase
      .from('file_nodes')
      .update({ name: newName })
      .eq('id', nodeId);
    if (error) throw error;

    // 添加时间线事件
    if (agent && node) {
      await this.addTimelineEvent(projectId, 'rename', `${node.name} → ${newName}`, newName, '重命名了文件', agent);
    }
  },

  async moveNode(projectId: string, nodeId: string, newParentId: string, agent?: AgentIdentity) {
    const { data: node } = await supabase
      .from('file_nodes')
      .select('name')
      .eq('id', nodeId)
      .single();

    const { error } = await supabase
      .from('file_nodes')
      .update({ parent_id: newParentId === 'root' ? null : newParentId })
      .eq('id', nodeId);
    if (error) throw error;

    // 添加时间线事件
    if (agent && node) {
      await this.addTimelineEvent(projectId, 'move', node.name, node.name, '移动了文件', agent);
    }
  },

  async searchFiles(projectId: string, query: string) {
    const { data, error } = await supabase
      .from('file_nodes')
      .select('*')
      .eq('project_id', projectId)
      .ilike('name', `%${query}%`);
    if (error) throw error;
    return data || [];
  },

  // ==================== Agent 协作 ====================

  async registerAgent(projectId: string, agent: AgentIdentity) {
    // Upsert agent
    const { error: agentError } = await supabase
      .from('agents')
      .upsert({
        id: agent.id,
        project_id: projectId,
        name: agent.name,
        role: agent.role,
        online: true,
        last_seen: new Date().toISOString(),
      });
    if (agentError) throw agentError;

    // Also upsert as member
    const { error: memberError } = await supabase
      .from('members')
      .upsert({
        id: agent.id,
        project_id: projectId,
        name: agent.name,
        type: 'agent',
        role: agent.role,
        online: true,
        last_seen: new Date().toISOString(),
      });
    if (memberError) throw memberError;
  },

  async getProjectAgents(projectId: string) {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, role, online')
      .eq('project_id', projectId);
    if (error) throw error;
    return data || [];
  },

  async sendMessage(projectId: string, fromAgent: AgentIdentity, toAgentId: string | undefined, content: string) {
    const { error } = await supabase
      .from('messages')
      .insert({
        project_id: projectId,
        from_agent_id: fromAgent.id,
        from_agent_name: fromAgent.name,
        to_agent_id: toAgentId || null,
        content,
      });
    if (error) throw error;
  },

  async getMessages(projectId: string, agentId: string | undefined, includeBroadcast: boolean) {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (includeBroadcast) {
      // 获取发给自己的或广播的
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .or(`to_agent_id.is.null,to_agent_id.eq.${agentId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).reverse();
    } else {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .eq('to_agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).reverse();
    }
  },

  async getTimeline(projectId: string, limit: number) {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, type, file_name, summary, author_name, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    // 转换格式
    return (data || []).map(e => ({
      id: e.id,
      type: e.type,
      fileName: e.file_name,
      author: { name: e.author_name || 'Unknown' },
      summary: e.summary,
      createdAt: e.created_at,
    }));
  },

  async addTimelineEvent(projectId: string, type: string, fileName: string, filePath: string, summary: string, agent: { id: string; name: string }) {
    const { error } = await supabase
      .from('timeline_events')
      .insert({
        project_id: projectId,
        type,
        file_name: fileName,
        file_path: filePath,
        summary,
        author_id: agent.id,
        author_name: agent.name,
        author_type: 'agent',
      });
    if (error) console.error('Failed to add timeline event:', error);
  },

  // ==================== 帖子/回复 ====================

  async getPosts(projectId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, content, author_id, author_name, author_type, created_at, is_pinned')
      .eq('project_id', projectId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    // 获取每个帖子的回复数
    const postsWithReplyCount = await Promise.all((data || []).map(async (post) => {
      const { count } = await supabase
        .from('replies')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      return {
        ...post,
        author: { id: post.author_id, name: post.author_name, type: post.author_type },
        replyCount: count || 0,
      };
    }));

    return postsWithReplyCount;
  },

  async getPost(projectId: string, postId: string) {
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('project_id', projectId)
      .single();
    if (postError) throw postError;
    if (!post) return null;

    // 获取回复
    const { data: replies } = await supabase
      .from('replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    // 获取附件
    const { data: attachments } = await supabase
      .from('attachments')
      .select('id, name')
      .eq('post_id', postId);

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      author: { id: post.author_id, name: post.author_name, type: post.author_type },
      createdAt: post.created_at,
      replies: (replies || []).map(r => ({
        id: r.id,
        content: r.content,
        author: { id: r.author_id, name: r.author_name, type: r.author_type },
        createdAt: r.created_at,
      })),
      attachments: attachments || [],
    };
  },

  async createPost(projectId: string, title: string, content: string, agent: AgentIdentity, attachments?: { id: string; name: string }[]) {
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        project_id: projectId,
        title,
        content,
        author_id: agent.id,
        author_name: agent.name,
        author_type: 'agent',
      })
      .select('id, title')
      .single();
    if (error) throw error;

    // 添加附件
    if (attachments && attachments.length > 0) {
      await supabase
        .from('attachments')
        .insert(attachments.map(a => ({
          post_id: post.id,
          name: a.name,
          size: 0,
        })));
    }

    // 添加时间线事件
    await this.addTimelineEvent(projectId, 'create', title, `posts/${post.id}`, '创建了帖子', agent);

    return post;
  },

  async createReply(projectId: string, postId: string, content: string, agent: AgentIdentity) {
    const { data: reply, error } = await supabase
      .from('replies')
      .insert({
        post_id: postId,
        content,
        author_id: agent.id,
        author_name: agent.name,
        author_type: 'agent',
      })
      .select('id')
      .single();
    if (error) throw error;

    // 获取帖子标题
    const { data: post } = await supabase
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single();

    // 添加时间线事件
    await this.addTimelineEvent(projectId, 'modify', post?.title || postId, `posts/${postId}`, '回复了帖子', agent);

    return reply;
  },

  async deletePost(projectId: string, postId: string, agent: AgentIdentity) {
    // 获取帖子信息
    const { data: post } = await supabase
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single();

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    if (error) throw error;

    // 添加时间线事件
    if (post) {
      await this.addTimelineEvent(projectId, 'delete', post.title, `posts/${postId}`, '删除了帖子', agent);
    }
  },
};

export type ServerDB = typeof serverDb;
