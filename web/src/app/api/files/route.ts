import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/db/serverStorage';

// Agent 身份类型
interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

// GET /api/files - 获取文件树或文件内容
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const fileId = searchParams.get('fileId');
    const action = searchParams.get('action');

    if (!projectId) {
      // 返回项目列表
      const projects = await serverDb.getProjects();
      return NextResponse.json({ projects });
    }

    if (action === 'content' && fileId) {
      // 获取文件内容
      const result = await serverDb.getFileContent(projectId, fileId);
      return NextResponse.json(result);
    }

    if (action === 'search') {
      // 搜索文件
      const query = searchParams.get('query') || '';
      const results = await serverDb.searchFiles(projectId, query);
      return NextResponse.json({ results });
    }

    if (action === 'agents') {
      // 获取项目成员
      const agents = await serverDb.getProjectAgents(projectId);
      return NextResponse.json({ agents });
    }

    if (action === 'messages') {
      // 获取消息
      const agentId = searchParams.get('agentId');
      const includeBroadcast = searchParams.get('includeBroadcast') !== 'false';
      const messages = await serverDb.getMessages(projectId, agentId || undefined, includeBroadcast);
      return NextResponse.json({ messages });
    }

    if (action === 'timeline') {
      // 获取时间线
      const limit = parseInt(searchParams.get('limit') || '20');
      const timeline = await serverDb.getTimeline(projectId, limit);
      return NextResponse.json({ timeline });
    }

    if (action === 'posts') {
      // 获取帖子列表
      const posts = await serverDb.getPosts(projectId);
      return NextResponse.json({ posts });
    }

    if (action === 'post') {
      // 获取帖子详情
      const postId = searchParams.get('postId');
      if (!postId) {
        return NextResponse.json({ error: 'postId is required' }, { status: 400 });
      }
      const post = await serverDb.getPost(projectId, postId);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      return NextResponse.json({ post });
    }

    // 获取文件树
    const tree = await serverDb.getFileTree(projectId);
    return NextResponse.json({ tree });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// POST /api/files - 创建文件或文件夹
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, parentId, name, type, content, agent } = body;
    const agentIdentity: AgentIdentity = agent || { id: 'api', name: 'API', role: 'system' };

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    switch (action) {
      case 'registerAgent':
        // 注册/更新 Agent
        await serverDb.registerAgent(projectId, agentIdentity);
        return NextResponse.json({ success: true, message: `Agent ${agentIdentity.name} 已注册` });

      case 'sendMessage':
        // 发送消息
        const { toAgentId, content: msgContent } = body;
        await serverDb.sendMessage(projectId, agentIdentity, toAgentId, msgContent);
        return NextResponse.json({ success: true, message: '消息已发送' });

      case 'createFolder':
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const folder = await serverDb.createFolder(projectId, parentId || 'root', name, agentIdentity);
        return NextResponse.json({ success: true, folder });

      case 'createFile':
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const file = await serverDb.createFile(projectId, parentId || 'root', name, content || '', agentIdentity);
        return NextResponse.json({ success: true, file });

      case 'updateContent':
        const { fileId } = body;
        if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
        await serverDb.updateFileContent(projectId, fileId, content || '', agentIdentity);
        return NextResponse.json({ success: true });

      case 'move':
        const { nodeId, newParentId } = body;
        if (!nodeId || !newParentId) {
          return NextResponse.json({ error: 'nodeId and newParentId are required' }, { status: 400 });
        }
        await serverDb.moveNode(projectId, nodeId, newParentId, agentIdentity);
        return NextResponse.json({ success: true });

      case 'rename':
        const { nodeId: renameNodeId, newName } = body;
        if (!renameNodeId || !newName) {
          return NextResponse.json({ error: 'nodeId and newName are required' }, { status: 400 });
        }
        await serverDb.renameNode(projectId, renameNodeId, newName, agentIdentity);
        return NextResponse.json({ success: true });

      case 'delete':
        const { nodeId: deleteNodeId } = body;
        if (!deleteNodeId) return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
        await serverDb.deleteNode(projectId, deleteNodeId, agentIdentity);
        return NextResponse.json({ success: true });

      // ==================== 帖子操作 ====================
      case 'createPost':
        const { title, content: postContent, attachments } = body;
        if (!title || !postContent) {
          return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
        }
        const newPost = await serverDb.createPost(projectId, title, postContent, agentIdentity, attachments);
        return NextResponse.json({ success: true, post: newPost });

      case 'createReply':
        const { postId, content: replyContent } = body;
        if (!postId || !replyContent) {
          return NextResponse.json({ error: 'postId and content are required' }, { status: 400 });
        }
        const newReply = await serverDb.createReply(projectId, postId, replyContent, agentIdentity);
        return NextResponse.json({ success: true, reply: newReply });

      case 'deletePost':
        const { postId: deletePostId } = body;
        if (!deletePostId) {
          return NextResponse.json({ error: 'postId is required' }, { status: 400 });
        }
        await serverDb.deletePost(projectId, deletePostId, agentIdentity);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
