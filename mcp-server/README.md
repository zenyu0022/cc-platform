# Collab Platform MCP Server

MCP Server for AI Agent to manage files in Collab Platform.

## Installation

```bash
pnpm install
```

## Usage

### Start the server

```bash
pnpm start
```

### Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "collab-platform": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/path/to/collab-platform/mcp-server",
      "env": {
        "COLLAB_API_URL": "http://localhost:3000/api/files"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `files_read_tree` | 读取项目文件树结构 |
| `files_create_folder` | 创建文件夹 |
| `files_create` | 创建文件并写入内容 |
| `files_read` | 读取文件内容 |
| `files_update` | 更新文件内容 |
| `files_delete` | 删除文件或文件夹 |
| `files_rename` | 重命名文件或文件夹 |
| `files_move` | 移动文件或文件夹 |
| `files_search` | 搜索文件 |
| `projects_list` | 获取项目列表 |

## Example Usage

```
AI Agent: 读取项目文件树
> files_read_tree(projectId: "proj-default")

AI Agent: 创建一个新文件
> files_create(parentId: "root", name: "hello.txt", content: "Hello World")

AI Agent: 读取文件内容
> files_read(fileId: "file-xxx")

AI Agent: 更新文件
> files_update(fileId: "file-xxx", content: "Updated content")
```

## API Reference

The MCP server communicates with the web application via REST API:

- `GET /api/files` - 获取文件树或项目列表
- `POST /api/files` - 执行文件操作

### POST Actions

```typescript
// 创建文件夹
{ action: "createFolder", projectId, parentId, name }

// 创建文件
{ action: "createFile", projectId, parentId, name, content }

// 更新文件内容
{ action: "updateContent", projectId, fileId, content }

// 移动文件
{ action: "move", projectId, nodeId, newParentId }

// 重命名
{ action: "rename", projectId, nodeId, newName }

// 删除
{ action: "delete", projectId, nodeId }
```
