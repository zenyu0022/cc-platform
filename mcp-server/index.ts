#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// API 基础 URL
const API_BASE = process.env.COLLAB_API_URL || "http://localhost:3000/api/files";

// ============ Agent 身份管理 ============
interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

// 从环境变量获取身份（由启动脚本注入）
function getAgentIdentity(): AgentIdentity {
  return {
    id: process.env.CLAUDE_AGENT_ID || `agent-${Date.now()}`,
    name: process.env.CLAUDE_AGENT_NAME || "Unknown Agent",
    role: process.env.CLAUDE_AGENT_ROLE || "worker",
  };
}

// 辅助函数：调用 API（自动携带身份）
async function callApi(action: string, params: Record<string, unknown> = {}) {
  const agent = getAgentIdentity();
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params, agent }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

async function getApi(params: Record<string, string> = {}) {
  const url = new URL(API_BASE);
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

// 创建 MCP Server
const server = new McpServer({
  name: "collab-platform-files",
  version: "1.0.0",
});

// ==================== 工具定义 ====================

// 1. 读取文件树
server.tool(
  "files_read_tree",
  "读取项目的文件树结构",
  {
    projectId: z.string().describe("项目 ID，不提供则使用默认项目"),
  },
  async ({ projectId }) => {
    const result = await getApi({ projectId: projectId || "proj-default" });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.tree, null, 2),
        },
      ],
    };
  }
);

// 2. 创建文件夹
server.tool(
  "files_create_folder",
  "在指定位置创建新文件夹",
  {
    projectId: z.string().optional().describe("项目 ID"),
    parentId: z.string().describe("父文件夹 ID，根目录使用 'root'"),
    name: z.string().describe("文件夹名称"),
  },
  async ({ projectId, parentId, name }) => {
    const result = await callApi("createFolder", {
      projectId: projectId || "proj-default",
      parentId,
      name,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `文件夹创建成功: ${JSON.stringify(result.folder, null, 2)}`,
        },
      ],
    };
  }
);

// 3. 创建文件
server.tool(
  "files_create",
  "创建新文件并写入内容",
  {
    projectId: z.string().optional().describe("项目 ID"),
    parentId: z.string().describe("父文件夹 ID，根目录使用 'root'"),
    name: z.string().describe("文件名（包含扩展名）"),
    content: z.string().optional().describe("文件内容"),
  },
  async ({ projectId, parentId, name, content }) => {
    const result = await callApi("createFile", {
      projectId: projectId || "proj-default",
      parentId,
      name,
      content: content || "",
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `文件创建成功: ${JSON.stringify(result.file, null, 2)}`,
        },
      ],
    };
  }
);

// 4. 读取文件内容
server.tool(
  "files_read",
  "读取文件内容",
  {
    projectId: z.string().optional().describe("项目 ID"),
    fileId: z.string().describe("文件 ID"),
  },
  async ({ projectId, fileId }) => {
    const result = await getApi({
      projectId: projectId || "proj-default",
      fileId,
      action: "content",
    });
    return {
      content: [
        {
          type: "text" as const,
          text: result.content || "(空文件)",
        },
      ],
    };
  }
);

// 5. 更新文件内容
server.tool(
  "files_update",
  "更新文件内容（完全替换）",
  {
    projectId: z.string().optional().describe("项目 ID"),
    fileId: z.string().describe("文件 ID"),
    content: z.string().describe("新的文件内容"),
  },
  async ({ projectId, fileId, content }) => {
    await callApi("updateContent", {
      projectId: projectId || "proj-default",
      fileId,
      content,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `文件更新成功 (${content.length} 字符)`,
        },
      ],
    };
  }
);

// 6. 删除文件或文件夹
server.tool(
  "files_delete",
  "删除文件或文件夹",
  {
    projectId: z.string().optional().describe("项目 ID"),
    nodeId: z.string().describe("文件或文件夹 ID"),
  },
  async ({ projectId, nodeId }) => {
    await callApi("delete", {
      projectId: projectId || "proj-default",
      nodeId,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: "删除成功",
        },
      ],
    };
  }
);

// 7. 重命名文件或文件夹
server.tool(
  "files_rename",
  "重命名文件或文件夹",
  {
    projectId: z.string().optional().describe("项目 ID"),
    nodeId: z.string().describe("文件或文件夹 ID"),
    newName: z.string().describe("新名称"),
  },
  async ({ projectId, nodeId, newName }) => {
    await callApi("rename", {
      projectId: projectId || "proj-default",
      nodeId,
      newName,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `重命名成功: ${newName}`,
        },
      ],
    };
  }
);

// 8. 移动文件或文件夹
server.tool(
  "files_move",
  "移动文件或文件夹到另一个文件夹",
  {
    projectId: z.string().optional().describe("项目 ID"),
    nodeId: z.string().describe("要移动的文件或文件夹 ID"),
    newParentId: z.string().describe("目标父文件夹 ID，根目录使用 'root'"),
  },
  async ({ projectId, nodeId, newParentId }) => {
    await callApi("move", {
      projectId: projectId || "proj-default",
      nodeId,
      newParentId,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: "移动成功",
        },
      ],
    };
  }
);

// 9. 搜索文件
server.tool(
  "files_search",
  "在项目中搜索文件",
  {
    projectId: z.string().optional().describe("项目 ID"),
    query: z.string().describe("搜索关键词"),
  },
  async ({ projectId, query }) => {
    const result = await getApi({
      projectId: projectId || "proj-default",
      action: "search",
      query,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `找到 ${result.results.length} 个文件:\n${JSON.stringify(result.results, null, 2)}`,
        },
      ],
    };
  }
);

// 10. 获取项目列表
server.tool(
  "projects_list",
  "获取所有项目列表",
  {},
  async () => {
    const result = await getApi({});
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.projects, null, 2),
        },
      ],
    };
  }
);

// ==================== Agent 身份工具 ====================

// 11. 查看当前身份
server.tool(
  "agent_whoami",
  "查看当前实例的身份信息",
  {},
  async () => {
    const agent = getAgentIdentity();
    return {
      content: [
        {
          type: "text" as const,
          text: `身份信息:\n  ID: ${agent.id}\n  名称: ${agent.name}\n  角色: ${agent.role}`,
        },
      ],
    };
  }
);

// 12. 注册/更新身份
server.tool(
  "agent_register",
  "向平台注册当前 Agent 身份",
  {
    name: z.string().optional().describe("显示名称，不提供则使用环境变量"),
    role: z.string().optional().describe("角色: writer/reviewer/coordinator"),
  },
  async ({ name, role }) => {
    const result = await callApi("registerAgent", {
      name: name || process.env.CLAUDE_AGENT_NAME,
      role: role || process.env.CLAUDE_AGENT_ROLE,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: result.message || "注册成功",
        },
      ],
    };
  }
);

// 13. 列出在线 Agents
server.tool(
  "agent_list",
  "列出项目中所有已注册的 Agent",
  {
    projectId: z.string().optional().describe("项目 ID"),
  },
  async ({ projectId }) => {
    const result = await getApi({
      projectId: projectId || "proj-default",
      action: "agents",
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.agents, null, 2),
        },
      ],
    };
  }
);

// 14. 发送消息
server.tool(
  "agent_send_message",
  "发送消息给其他 Agent 或广播",
  {
    projectId: z.string().optional().describe("项目 ID"),
    toAgentId: z.string().optional().describe("目标 Agent ID，留空则广播"),
    content: z.string().describe("消息内容"),
  },
  async ({ projectId, toAgentId, content }) => {
    const result = await callApi("sendMessage", {
      projectId: projectId || "proj-default",
      toAgentId,
      content,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: result.message || "消息已发送",
        },
      ],
    };
  }
);

// 15. 获取消息
server.tool(
  "agent_get_messages",
  "获取发给当前 Agent 的消息",
  {
    projectId: z.string().optional().describe("项目 ID"),
    includeBroadcast: z.boolean().optional().default(true).describe("是否包含广播消息"),
  },
  async ({ projectId, includeBroadcast }) => {
    const agent = getAgentIdentity();
    const result = await getApi({
      projectId: projectId || "proj-default",
      action: "messages",
      agentId: agent.id,
      includeBroadcast: String(includeBroadcast ?? true),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.messages, null, 2),
        },
      ],
    };
  }
);

// 16. 获取协作历史
server.tool(
  "collab_history",
  "获取项目的协作历史（时间线）",
  {
    projectId: z.string().optional().describe("项目 ID"),
    limit: z.number().optional().default(20).describe("返回条数"),
  },
  async ({ projectId, limit }) => {
    const result = await getApi({
      projectId: projectId || "proj-default",
      action: "timeline",
      limit: String(limit ?? 20),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.timeline, null, 2),
        },
      ],
    };
  }
);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Collab Platform MCP Server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
