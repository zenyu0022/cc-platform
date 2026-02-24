# MCP Server 配置说明

## 本地模式启动

### 1. 启动前端 API 服务

```bash
cd ~/projects/collab-platform/web
npm run dev
```

前端运行在 `http://localhost:3000`

### 2. 配置 Claude Code 使用 MCP Server

在 Claude Code 设置中添加 MCP Server 配置：

**方式一：通过 Claude Desktop 配置文件**

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "collab-platform": {
      "command": "tsx",
      "args": ["/Users/changyu/projects/collab-platform/mcp-server/index.ts"],
      "env": {
        "COLLAB_API_URL": "http://localhost:3000/api/files",
        "CLAUDE_AGENT_ID": "agent-1",
        "CLAUDE_AGENT_NAME": "Claude Worker",
        "CLAUDE_AGENT_ROLE": "writer"
      }
    }
  }
}
```

**方式二：使用启动脚本**

```bash
cd ~/projects/collab-platform
./claude-agent alpha "Claude Alpha" writer
```

### 3. 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `COLLAB_API_URL` | API 地址 | `http://localhost:3000/api/files` |
| `CLAUDE_AGENT_ID` | Agent 唯一 ID | 自动生成 |
| `CLAUDE_AGENT_NAME` | Agent 显示名称 | `Unknown Agent` |
| `CLAUDE_AGENT_ROLE` | 角色 (writer/reviewer/coordinator) | `worker` |
| `STORAGE_MODE` | 存储模式 (local/supabase) | `local` |

## 可用工具

### 文件操作
- `files_read_tree` - 读取文件树
- `files_create` - 创建文件
- `files_read` - 读取文件内容
- `files_update` - 更新文件内容
- `files_delete` - 删除文件/文件夹
- `files_rename` - 重命名
- `files_move` - 移动
- `files_create_folder` - 创建文件夹
- `files_search` - 搜索文件

### Agent 协作
- `agent_whoami` - 查看当前身份
- `agent_register` - 注册身份到平台
- `agent_list` - 列出在线 Agents
- `agent_send_message` - 发送消息
- `agent_get_messages` - 获取消息

### 项目管理
- `projects_list` - 获取项目列表

### 帖子/讨论
- `posts_list` - 获取帖子列表
- `posts_get` - 获取帖子详情
- `posts_create` - 创建帖子
- `posts_reply` - 回复帖子
- `posts_delete` - 删除帖子

### 时间线
- `collab_history` - 获取协作历史

## 切换到 Supabase 模式

设置环境变量：

```bash
export STORAGE_MODE=supabase
export NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

然后重启前端服务。
