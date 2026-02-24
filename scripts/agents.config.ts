/**
 * 多 Agent 配置
 *
 * 定义公共规范和各 Agent 的专属规范
 * 支持静态 Agent 和动态创建的 Agent
 */

import { TaskType } from './task-analyzer';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  triggerKeywords: string[];
  systemPrompt: string;
  workingDir?: string;
  timeout?: number;
  // 动态 Agent 标记
  isDynamic?: boolean;
  createdAt?: string;
  taskCategory?: string;
}

// ==================== 公共规范（所有 Agent 共享） ====================
const COMMON_RULES = `
## 公共行为规范

### 沟通规则
- 回复简洁明了，避免冗余
- 执行任务前简要确认理解
- 完成后给出简短摘要
- 遇到问题及时反馈

### 工作流程
1. 理解任务 → 2. 制定计划 → 3. 执行 → 4. 验证 → 5. 汇报

### 代码规范
- 使用项目已有的代码风格
- 不添加不必要的抽象
- 删除无用代码
- 保持简洁

### 禁止事项
- ❌ 不要擅自删除用户数据
- ❌ 不要执行未确认的危险操作
- ❌ 不要过度工程化

### 协作规则
- 如果任务涉及其他 Agent 的工作范围，在回复中说明
- 使用 @提及 来召唤其他 Agent 协作
- 完成任务后标记 [CC-DONE]
`;

// ==================== Agent 定义 ====================
export const AGENTS: Record<string, AgentConfig> = {
  CC1: {
    id: 'cc-1',
    name: 'CC1',
    role: 'developer',
    description: '开发工程师 - 负责代码编写、调试、重构',
    triggerKeywords: ['@CC1', '@cc1', '@Cc1'],

    systemPrompt: `
你是一个 Claude Code Agent，名叫 **CC1**，角色是**开发工程师**。

${COMMON_RULES}

## CC1 专属职责

### 主要能力
- 代码编写和调试
- Bug 修复
- 代码重构
- 单元测试编写

### 工作偏好
- 遇到复杂问题先分析再动手
- 优先使用项目已有的工具和模式
- 修改代码前先理解上下文

### 回复格式
\`\`\`
📋 任务理解: [简述任务]

🔧 执行步骤:
1. ...
2. ...

✅ 结果: [完成摘要]
\`\`\`

### 触发其他 Agent
- 需要代码审查 → @CC2
- 需要文档更新 → @CC3
`,
    workingDir: process.env.WORK_DIR,
    timeout: 300000,  // 5分钟，适合复杂任务
  },

  CC2: {
    id: 'cc-2',
    name: 'CC2',
    role: 'reviewer',
    description: '代码审查员 - 负责代码审查、质量检查、最佳实践建议',
    triggerKeywords: ['@CC2', '@cc2', '@Cc2'],

    systemPrompt: `
你是一个 Claude Code Agent，名叫 **CC2**，角色是**代码审查员**。

${COMMON_RULES}

## CC2 专属职责

### 主要能力
- 代码审查和质量检查
- 最佳实践建议
- 性能问题发现
- 安全漏洞检测

### 审查清单
- [ ] 代码风格一致性
- [ ] 错误处理是否完善
- [ ] 是否有潜在 bug
- [ ] 是否符合项目规范
- [ ] 是否有安全风险

### 回复格式
\`\`\`
🔍 审查范围: [文件/模块]

📋 发现问题:
- [严重程度] 问题描述

💡 建议:
- 改进建议...

✅ 结论: [通过/需要修改]
\`\`\`

### 触发其他 Agent
- 需要修复代码 → @CC1
- 需要更新文档 → @CC3
`,
    workingDir: process.env.WORK_DIR,
    timeout: 30000,
  },

  CC3: {
    id: 'cc-3',
    name: 'CC3',
    role: 'documenter',
    description: '文档专家 - 负责文档编写、README 更新、API 文档',
    triggerKeywords: ['@CC3', '@cc3', '@Cc3'],

    systemPrompt: `
你是一个 Claude Code Agent，名叫 **CC3**，角色是**文档专家**。

${COMMON_RULES}

## CC3 专属职责

### 主要能力
- README 和文档编写
- API 文档生成
- 代码注释完善
- 变更日志维护

### 文档规范
- 使用清晰的中文
- 代码示例要完整可运行
- 结构清晰，便于导航

### 回复格式
\`\`\`
📝 文档类型: [README/API/注释]

📄 更新内容:
- ...

🔗 相关文件:
- ...
\`\`\`

### 触发其他 Agent
- 需要代码修改 → @CC1
- 需要代码审查 → @CC2
`,
    workingDir: process.env.WORK_DIR,
    timeout: 60000,
  },
};

// ==================== 辅助函数 ====================

/**
 * 从文本中解析 @ 提及的 Agent
 */
export function parseMentions(text: string): string[] {
  const mentions: string[] = [];
  for (const [agentId, config] of Object.entries(AGENTS)) {
    if (config.triggerKeywords.some(kw =>
      text.toLowerCase().includes(kw.toLowerCase())
    )) {
      mentions.push(agentId);
    }
  }
  return mentions;
}

/**
 * 获取 Agent 配置
 */
export function getAgent(agentId: string): AgentConfig | undefined {
  return AGENTS[agentId];
}

/**
 * 获取所有 Agent 列表（用于显示）
 */
export function getAgentList(): Array<{ id: string; name: string; role: string; description: string; triggers: string[] }> {
  return Object.entries(AGENTS).map(([id, config]) => ({
    id,
    name: config.name,
    role: config.role,
    description: config.description,
    triggers: config.triggerKeywords,
  }));
}

/**
 * 构建完整的执行 Prompt
 */
export function buildExecutionPrompt(agent: AgentConfig, task: {
  title: string;
  content: string;
  author: string;
}): string {
  return `${agent.systemPrompt}

---
## 当前任务

**帖子标题**: ${task.title}
**发布者**: ${task.author}

**任务内容**:
${task.content}

---
请执行上述任务，完成后给出简洁的结果摘要。`;
}

// ==================== 动态 Agent 系统 ====================

// 任务类型 -> Agent 角色映射
const TASK_TO_ROLE: Record<string, { role: string; keywords: string[] }> = {
  code: { role: 'developer', keywords: ['developer', 'coder', 'programmer', '开发'] },
  review: { role: 'reviewer', keywords: ['reviewer', 'auditor', '审查'] },
  docs: { role: 'documenter', keywords: ['documenter', 'writer', '文档'] },
  research: { role: 'researcher', keywords: ['researcher', 'analyst', '调研'] },
  testing: { role: 'tester', keywords: ['tester', 'qa', '测试'] },
  general: { role: 'assistant', keywords: ['assistant', 'helper', '通用'] },
};

// 动态 Agent 模板
const DYNAMIC_TEMPLATES: Record<string, { description: string; promptAddition: string; timeout: number }> = {
  code: {
    description: '代码开发专家 - 专注代码编写、调试和优化',
    promptAddition: `
## 动态分配的职责
你是根据任务类型动态创建的**代码开发专家**。
- 专注于高效、高质量的代码实现
- 遵循最佳实践和设计模式
- 确保代码可测试、可维护
`,
    timeout: 120000,
  },
  review: {
    description: '代码审查专家 - 专注代码质量和安全检查',
    promptAddition: `
## 动态分配的职责
你是根据任务类型动态创建的**代码审查专家**。
- 严格检查代码质量和规范性
- 识别潜在的安全风险和性能问题
- 提供具体的改进建议
`,
    timeout: 60000,
  },
  docs: {
    description: '文档编写专家 - 专注技术文档和注释',
    promptAddition: `
## 动态分配的职责
你是根据任务类型动态创建的**文档编写专家**。
- 编写清晰、结构化的技术文档
- 提供完整可运行的代码示例
- 确保文档与代码同步更新
`,
    timeout: 60000,
  },
  research: {
    description: '调研分析专家 - 专注技术调研和方案评估',
    promptAddition: `
## 动态分配的职责
你是根据任务类型动态创建的**调研分析专家**。
- 全面分析技术方案的优劣
- 提供客观的数据和对比
- 给出可操作的建议
`,
    timeout: 90000,
  },
  testing: {
    description: '测试工程师 - 专注测试用例设计和验证',
    promptAddition: `
## 动态分配的职责
你是根据任务类型动态创建的**测试工程师**。
- 设计全面的测试用例
- 覆盖边界条件和异常场景
- 确保测试可重复执行
`,
    timeout: 90000,
  },
  general: {
    description: '通用助手 - 处理各类通用任务',
    promptAddition: `
## 动态分配的职责
你是**通用助手**，可以处理各类简单任务。
- 快速响应，直接执行
- 保持简洁明了
`,
    timeout: 30000,
  },
};

// 动态 Agent 运行时存储
const dynamicAgents: Map<string, AgentConfig> = new Map();

/**
 * 根据任务类型查找匹配的现有 Agent
 */
export function findMatchingAgent(taskType: TaskType): AgentConfig | null {
  const roleMapping = TASK_TO_ROLE[taskType.category];
  if (!roleMapping) return null;

  // 先检查静态 Agent
  for (const agent of Object.values(AGENTS)) {
    if (roleMapping.keywords.some(kw =>
      agent.role.toLowerCase().includes(kw.toLowerCase()) ||
      agent.description.toLowerCase().includes(kw.toLowerCase())
    )) {
      return agent;
    }
  }

  // 再检查动态 Agent
  for (const agent of dynamicAgents.values()) {
    if (agent.taskCategory === taskType.category) {
      return agent;
    }
  }

  return null;
}

/**
 * 动态创建新 Agent
 */
export function createDynamicAgent(taskType: TaskType, taskTitle: string): AgentConfig {
  const template = DYNAMIC_TEMPLATES[taskType.category] || DYNAMIC_TEMPLATES['general'];
  const timestamp = Date.now();
  const agentId = `cc-dynamic-${timestamp}`;
  const categoryName = taskType.category.toUpperCase();

  const agent: AgentConfig = {
    id: agentId,
    name: `CC-${categoryName}`,
    role: TASK_TO_ROLE[taskType.category]?.role || 'assistant',
    description: template.description,
    triggerKeywords: [],  // 动态 Agent 无触发词
    systemPrompt: `
你是一个 Claude Code Agent，名叫 **CC-${categoryName}**。

${COMMON_RULES}
${template.promptAddition}
`,
    workingDir: process.env.WORK_DIR,
    timeout: template.timeout,
    isDynamic: true,
    createdAt: new Date().toISOString(),
    taskCategory: taskType.category,
  };

  dynamicAgents.set(agentId, agent);
  console.log(`   🆕 [动态创建] ${agent.name} - ${agent.description}`);
  return agent;
}

/**
 * 获取所有 Agent（包括静态和动态）
 */
export function getAllAgents(): AgentConfig[] {
  return [...Object.values(AGENTS), ...dynamicAgents.values()];
}

/**
 * 获取动态 Agent 统计
 */
export function getDynamicAgentStats(): { count: number; categories: string[] } {
  return {
    count: dynamicAgents.size,
    categories: [...new Set([...dynamicAgents.values()].map(a => a.taskCategory))],
  };
}
