import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/db/serverStorage';

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
    const { action, projectId, parentId, name, type, content } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    switch (action) {
      case 'createFolder':
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const folder = await serverDb.createFolder(projectId, parentId || 'root', name);
        return NextResponse.json({ success: true, folder });

      case 'createFile':
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const file = await serverDb.createFile(projectId, parentId || 'root', name, content || '');
        return NextResponse.json({ success: true, file });

      case 'updateContent':
        const { fileId } = body;
        if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
        await serverDb.updateFileContent(projectId, fileId, content || '');
        return NextResponse.json({ success: true });

      case 'move':
        const { nodeId, newParentId } = body;
        if (!nodeId || !newParentId) {
          return NextResponse.json({ error: 'nodeId and newParentId are required' }, { status: 400 });
        }
        await serverDb.moveNode(projectId, nodeId, newParentId);
        return NextResponse.json({ success: true });

      case 'rename':
        const { nodeId: renameNodeId, newName } = body;
        if (!renameNodeId || !newName) {
          return NextResponse.json({ error: 'nodeId and newName are required' }, { status: 400 });
        }
        await serverDb.renameNode(projectId, renameNodeId, newName);
        return NextResponse.json({ success: true });

      case 'delete':
        const { nodeId: deleteNodeId } = body;
        if (!deleteNodeId) return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
        await serverDb.deleteNode(projectId, deleteNodeId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
