#!/usr/bin/env npx ts-node
/**
 * CC 远程任务轮询器 - 多 Agent 版本
 *
 * 功能：
 * 1. 定时检查 collab-platform 帖子
 * 2. 识别 @CC1, @CC2, @CC3 等提及
 * 3. 根据不同 Agent 注入不同规范
 * 4. 调用本地 Claude Code API 执行任务
 * 5. 将结果回复到帖子
 *
 * 使用：
 *   pnpm run poll:start     # 启动轮询
 *   pnpm run poll:once      # 单次检查
 *   pnpm run poll:test      # 测试模式
 *   pnpm run poll:agents    # 显示可用 Agent
 */

import { spawn } from 'child_process';
import {
  AGENTS,
  parseMentions,
  getAgent,
  getAgentList,
  buildExecutionPrompt,
  AgentConfig,
  findMatchingAgent,
  createDynamicAgent,
  getAllAgents,
  loadDynamicAgents,
  saveDynamicAgents,
  recordTaskResult,
  buildMemoryContext,
} from './agents.config';
import { analyzeTask, getTaskTypeDescription, TaskType, analyzeComplexity, TaskComplexity, isInvalidTask } from './task-analyzer';
import {
  createTask,
  getTask,
  getTasksByPost,
  getActiveTasks,
  updateTask,
  executeInBackground,
  executeInPhases,
  loadTasks,
  saveTasks,
  cleanupOldTasks,
  getTaskSummary,
  BackgroundTask,
  PhaseInfo,
} from './task-manager';

// ==================== 配置 ====================
const CONFIG = {
  apiUrl: process.env.COLLAB_API_URL || 'http://localhost:3000/api/files',
  defaultProjectId: process.env.DEFAULT_PROJECT_ID || 'proj-default',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '60000'),
  ccTimeout: parseInt(process.env.CC_TIMEOUT || '900000'),  // 默认15分钟
  executor: process.env.EXECUTOR || 'claude',
  // 默认 Agent（当没有明确提及时）
  defaultAgent: process.env.DEFAULT_AGENT || 'CC1',
};

// ==================== 类型定义 ====================
interface Post {
  id: string;
  title: string;
  content: string;
  author: { id: string; name: string; type: 'human' | 'agent' };
  createdAt: string;
  replyCount?: number;
  replies?: Reply[];
}

interface Reply {
  id: string;
  content: string;
  author: { id: string; name: string; type: 'human' | 'agent' };
  createdAt: string;
}

interface Task {
  postId: string;
  title: string;
  content: string;
  author: string;
  targetAgents: string[];
  taskType?: TaskType;  // 任务类型（动态分配时使用）
  isDynamicAssignment?: boolean;  // 是否为动态分配
  complexity?: TaskComplexity;  // 任务复杂度分析
  subTaskIndex?: number;  // 子任务索引（如果是子任务）
}

// ==================== API 调用 ====================
async function fetchPosts(projectId: string): Promise<Post[]> {
  const url = `${CONFIG.apiUrl}?action=posts&projectId=${projectId}`;
  const res = await fetch(url);
  const data = await res.json() as { posts?: Post[] };
  return data.posts || [];
}

async function fetchPostDetail(projectId: string, postId: string): Promise<Post | null> {
  const url = `${CONFIG.apiUrl}?action=post&projectId=${projectId}&postId=${postId}`;
  const res = await fetch(url);
  const data = await res.json() as { post?: Post };
  return data.post || null;
}

async function createReply(projectId: string, postId: string, content: string, agentId: string, agentName: string): Promise<void> {
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'createReply',
      projectId,
      postId,
      content,
      agent: { id: agentId, name: agentName, role: 'assistant' },
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create reply: ${res.statusText}`);
  }
}

// ==================== 任务检测 ====================
function isProcessedByAgent(replies: Reply[] | undefined, agentId: string): boolean {
  if (!replies || replies.length === 0) return false;
  return replies.some(r =>
    r.author.id === agentId && r.content.includes('[CC-DONE]') && !r.content.includes('❌')
  );
}

// 检查帖子是否已被任何 Agent 成功处理过
function isProcessedByAnyAgent(replies: Reply[] | undefined): boolean {
  if (!replies || replies.length === 0) return false;
  return replies.some(r =>
    r.author.type === 'agent' &&
    r.content.includes('[CC-DONE]') &&
    !r.content.includes('❌ 任务执行超时') &&
    !r.content.includes('❌ 执行失败') &&
    !r.content.includes('任务超时报告')
  );
}

// 检查帖子是否有正在执行的后台任务
function hasActiveBackgroundTask(postId: string): boolean {
  const tasks = getTasksByPost(postId);
  return tasks.some(t => t.status === 'running' || t.status === 'pending');
}

function extractInstruction(content: string, agentKeywords: string[]): string {
  let instruction = content;
  for (const kw of agentKeywords) {
    instruction = instruction.replace(new RegExp(kw, 'gi'), '');
  }
  // 也移除通用的 @cc 关键词
  instruction = instruction.replace(/@cc\b/gi, '');
  return instruction.trim();
}

async function findPendingTasks(posts: Post[]): Promise<Task[]> {
  const tasks: Task[] = [];

  for (const post of posts) {
    // ========== 新增：检查是否有活跃的后台任务 ==========
    if (hasActiveBackgroundTask(post.id)) {
      console.log(`   ⏳ [后台任务] "${post.title}" 正在后台执行中，跳过`);
      continue;
    }

    const fullText = `${post.title} ${post.content}`;
    const mentions = parseMentions(fullText);

    // 如果没有明确提及，检查是否有通用 @cc
    const hasGenericTrigger = /@cc\b/i.test(fullText);

    if (mentions.length === 0 && !hasGenericTrigger) {
      continue;
    }

    // 获取帖子详情检查回复
    const detail = await fetchPostDetail(CONFIG.defaultProjectId, post.id);
    const replies = detail?.replies || [];

    // ========== 新增：检查回复中的 @cc ==========
    // 检查帖子是否已被任何 Agent 处理过（有 [CC-DONE] 或 [CC-RECEIVED] 标记）
    const hasAgentResponse = replies.some(r =>
      r.author.type === 'agent' && (r.content.includes('[CC-DONE]') || r.content.includes('[CC-RECEIVED]'))
    );

    // 始终检查回复，但跳过 Agent 回复
    for (const reply of replies) {
      // 跳过 Agent 回复（Agent 回复不应触发新任务）
      // 检查方式：1. type 是 agent，或 2. 作者名以 CC 开头（如 CC1, CC2）
      if (reply.author.type === 'agent' || /^CC\d+$/i.test(reply.author.name)) {
        continue;
      }

      // 如果帖子已被 Agent 响应，跳过所有人类回复（防止重复处理）
      if (hasAgentResponse) {
        continue;
      }

      // 跳过已标记为处理的回复
      if (reply.content.includes('[CC-DONE]') || reply.content.includes('[CC-RECEIVED]')) {
        continue;
      }

      if (/@cc\b/i.test(reply.content)) {
        const replyMentions = parseMentions(reply.content);
        const hasReplyTrigger = /@cc\b/i.test(reply.content);

        if (replyMentions.length > 0 || hasReplyTrigger) {
          const replyInstruction = extractInstruction(reply.content, ['@cc', '@CC', '@Cc']);
          const taskTitle = `回复任务: ${reply.content.substring(0, 30)}...`;

          // 只有当提取后的指令非空且有意义时才创建任务
          if (replyInstruction && replyInstruction.length > 5) {
            // 检查是否为无效任务（自动回复、确认消息等）
            // 同时检查原始回复内容和提取后的指令
            if (isInvalidTask(taskTitle, replyInstruction) || isInvalidTask(taskTitle, reply.content)) {
              console.log(`   ⏭️ 跳过无效任务: ${taskTitle}`);
              continue;
            }

            tasks.push({
              postId: post.id,
              title: taskTitle,
              content: replyInstruction,
              author: reply.author.name,
              targetAgents: ['CC1'],
              isDynamicAssignment: false,
            });
          }
        }
      }
    }

    // 情况 1: 明确指定了 Agent (@CC1, @CC2 等)
    if (mentions.length > 0) {
      for (const agentId of mentions) {
        const agent = getAgent(agentId);
        if (!agent) continue;

        if (!isProcessedByAgent(replies, agent.id)) {
          const allKeywords = [...agent.triggerKeywords, '@cc', '@CC'];
          const instruction = extractInstruction(post.content, allKeywords);

          // 检查是否为无效任务
          if (isInvalidTask(post.title, instruction || post.content)) {
            console.log(`   ⏭️ 跳过无效任务: ${post.title}`);
            continue;
          }

          tasks.push({
            postId: post.id,
            title: post.title,
            content: instruction || post.content,
            author: post.author.name,
            targetAgents: [agentId],
            isDynamicAssignment: false,
          });
        }
      }
    }
    // 情况 2: 只有 @cc，需要分析任务类型并智能分配
    else if (hasGenericTrigger) {
      // 提取指令内容
      const instruction = extractInstruction(post.content, ['@cc', '@CC', '@Cc']);

      // 检查是否为无效任务
      if (isInvalidTask(post.title, instruction || post.content)) {
        console.log(`   ⏭️ 跳过无效任务: ${post.title}`);
        continue;
      }

      // 分析任务类型
      const taskType = analyzeTask(post.title, instruction);
      console.log(`   📊 [任务分析] "${post.title}" → ${taskType.category} (置信度: ${taskType.confidence})`);

      // 查找匹配的 Agent
      let agent = findMatchingAgent(taskType);
      let isDynamic = false;

      if (!agent) {
        // 没有匹配的 Agent，动态创建
        agent = createDynamicAgent(taskType, post.title);
        isDynamic = true;
      } else if (agent.isDynamic) {
        // 找到了已存在的动态 Agent
        isDynamic = true;
      }

      // 检查是否已处理
      // 对于动态 Agent，始终检查是否有任何 Agent 处理过（因为 ID 每次不同）
      // 对于静态 Agent，检查特定 Agent 是否处理过
      const alreadyProcessed = isDynamic
        ? isProcessedByAnyAgent(replies)
        : isProcessedByAgent(replies, agent.id);

      if (!alreadyProcessed) {
        tasks.push({
          postId: post.id,
          title: post.title,
          content: instruction || post.content,
          author: post.author.name,
          targetAgents: [agent.id],
          taskType,
          isDynamicAssignment: isDynamic,
        });
      }
    }
  }

  return tasks;
}

// ==================== Claude Code 执行 ====================
async function executeWithAgent(task: Task, agent: AgentConfig): Promise<string> {
  if (!agent) {
    return `❌ 未知的 Agent`;
  }

  console.log(`\n🤖 [${agent.name}] 执行任务: "${task.title}"`);
  console.log(`   角色: ${agent.role} (${agent.description})`);
  console.log(`   指令: ${task.content.substring(0, 50)}...`);
  console.log(`   发布者: ${task.author}\n`);

  // 获取 Agent 记忆上下文
  const memoryContext = buildMemoryContext(agent.id);
  if (memoryContext) {
    console.log(`   📚 已加载记忆上下文`);
  }

  const prompt = buildExecutionPrompt(agent, {
    title: task.title,
    content: task.content,
    author: task.author,
  }) + memoryContext;

  // 测试模式
  if (CONFIG.executor === 'echo') {
    console.log('   [测试模式] 模拟执行...');
    await new Promise(r => setTimeout(r, 1000));
    return `📝 测试模式响应 (${agent.name})

收到指令: "${task.content.substring(0, 100)}..."

我是 ${agent.name}，角色是 **${agent.description}**。

这是一个模拟的执行结果。设置 EXECUTOR=claude 启用真实执行。`;
  }

  try {
    console.log(`   [执行] claude -p ... (超时: ${agent.timeout || CONFIG.ccTimeout}ms)`);
    const startTime = Date.now();

    // 使用 spawn 代替 exec，避免 TTY 问题
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn('/Users/changyu/.local/bin/claude', ['-p', prompt, '--dangerously-skip-permissions'], {
        cwd: agent.workingDir || process.env.WORK_DIR || process.cwd(),
        env: { ...process.env, PATH: `/Users/changyu/.local/bin:${process.env.PATH}` },
        stdio: ['ignore', 'pipe', 'pipe'],  // 忽略 stdin，避免卡住
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });

      // 超时处理：不杀死进程，而是收集进度信息并返回报告
      const timeout = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        const timeoutMs = agent.timeout || CONFIG.ccTimeout;

        // 构建超时报告，包含已收集的输出
        let progressReport = `⏰ **任务超时报告**

**超时时间**: ${timeoutMs / 1000}s
**已执行时间**: ${Math.round(elapsed / 1000)}s

**已收集的输出** (${stdout.length} 字符):
\`\`\`
${stdout.slice(-2000) || '（暂无输出）'}
\`\`\`

**可能原因**:
- 任务复杂度超出预期
- 外部依赖响应慢
- 需要更多时间完成

**建议**: 增加超时时间或拆分任务`;

        if (stderr) {
          progressReport += `\n\n**错误输出**:\n\`\`\`\n${stderr.slice(-500)}\n\`\`\``;
        }

        // 不杀死进程，让它继续执行（但返回超时报告）
        // child.kill();  // 移除：不杀死进程
        resolve(progressReport);
      }, agent.timeout || CONFIG.ccTimeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout.trim() || '任务已完成（无输出）');
        } else if (stdout) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`退出码 ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const elapsed = Date.now() - startTime;
    console.log(`   [完成] 耗时 ${elapsed}ms`);

    return result;
  } catch (error: any) {
    return `❌ 执行失败: ${error.message}`;
  }
}

// ==================== 主循环 ====================
async function pollOnce(): Promise<void> {
  console.log(`\n[${new Date().toLocaleTimeString()}] 检查新任务...`);

  try {
    const posts = await fetchPosts(CONFIG.defaultProjectId);
    const tasks = await findPendingTasks(posts);

    if (tasks.length === 0) {
      console.log('   无待处理任务');
      return;
    }

    console.log(`   发现 ${tasks.length} 个待处理任务`);

    for (const task of tasks) {
      // 获取 Agent（支持动态 Agent）
      let agent: AgentConfig | undefined;
      for (const agentId of task.targetAgents) {
        agent = getAgent(agentId) || getAllAgents().find(a => a.id === agentId);
        if (agent) break;
      }
      if (!agent) {
        console.log(`   ⚠️ 未找到 Agent: ${task.targetAgents.join(', ')}`);
        continue;
      }

      // ========== 新增：分析任务复杂度 ==========
      const complexity = analyzeComplexity(task.title, task.content);
      console.log(`   📈 [复杂度] ${complexity.level} (预估 ${Math.round(complexity.estimatedTotalTime / 1000)}s)`);

      // 判断是否需要拆分任务
      const needSplit = complexity.level === 'complex' &&
                        complexity.subTasks.length > 1 &&
                        (agent.timeout || CONFIG.ccTimeout) < complexity.estimatedTotalTime;

      if (needSplit) {
        console.log(`   🔀 [任务拆分] 检测到复杂任务，拆分为 ${complexity.subTasks.length} 个子任务`);

        // 回复"已收到"，说明会拆分执行
        await createReply(
          CONFIG.defaultProjectId,
          task.postId,
          `[CC-RECEIVED]\n\n✅ 复杂任务已收到，将拆分为 ${complexity.subTasks.length} 个子任务并行执行...\n\n_${agent.name} 于 ${new Date().toLocaleString()}_`,
          agent.id,
          agent.name
        );
        console.log(`   📩 [${agent.name}] 已回复"收到" ${task.postId}`);

        // 并行执行子任务
        const subResults = await Promise.all(
          complexity.subTasks.map(async (subTask, index) => {
            const subAgent = getAllAgents()[index % getAllAgents().length];  // 轮询分配
            console.log(`   🔹 [子任务 ${index + 1}] ${subTask.description} → ${subAgent.name}`);

            const subResult = await executeWithAgent({
              ...task,
              title: `子任务 ${index + 1}: ${subTask.description}`,
              content: subTask.description,
              subTaskIndex: index,
            }, subAgent);

            return { index, description: subTask.description, result: subResult, agent: subAgent };
          })
        );

        // 汇总结果
        let result = `📋 任务已拆分为 ${subResults.length} 个子任务并行执行：\n\n`;
        for (const sr of subResults) {
          result += `### 子任务 ${sr.index + 1}: ${sr.description}\n`;
          result += `执行者: ${sr.agent.name}\n`;
          result += `结果: ${sr.result.substring(0, 300)}${sr.result.length > 300 ? '...' : ''}\n\n`;
        }

        // 记录任务结果
        recordTaskResult(agent.id, task.title, task.content, result, true);

        // 构建回复
        const reply = `[CC-DONE]

**${agent.name} (${agent.role}) 任务完成** (并行拆分)

${result}
---
_${agent.name} 于 ${new Date().toLocaleString()} 执行_`;

        await createReply(
          CONFIG.defaultProjectId,
          task.postId,
          reply,
          agent.id,
          agent.name
        );
        console.log(`   ✅ [${agent.name}] 已回复帖子 ${task.postId}`);
        continue;
      }

      // 普通任务执行
      // 先回复"已收到"
      await createReply(
        CONFIG.defaultProjectId,
        task.postId,
        `[CC-RECEIVED]\n\n✅ 任务已收到，正在执行...\n\n_${agent.name} 于 ${new Date().toLocaleString()}_`,
        agent.id,
        agent.name
      );
      console.log(`   📩 [${agent.name}] 已回复"收到" ${task.postId}`);

      const result = await executeWithAgent(task, agent);

      // 记录任务结果到 Agent 记忆
      recordTaskResult(
        agent.id,
        task.title,
        task.content,
        result,
        !result.includes('❌')
      );

      // 构建回复，包含 Agent 类型信息
      const agentInfo = task.isDynamicAssignment
        ? `\n_🆎 动态分配: ${getTaskTypeDescription(task.taskType!)}_`
        : '';
      const workingDirInfo = agent.workingDir
        ? `\n_📁 工作目录: ${agent.workingDir}_`
        : '';

      const reply = `[CC-DONE]

**${agent.name} (${agent.role}) 任务完成**${agentInfo}

${result}

---
_${agent.name} 于 ${new Date().toLocaleString()} 执行_${workingDirInfo}`;

      await createReply(
        CONFIG.defaultProjectId,
        task.postId,
        reply,
        agent.id,
        agent.name
      );
      console.log(`   ✅ [${agent.name}] 已回复帖子 ${task.postId}`);
    }
  } catch (error: any) {
    console.error('   ❌ 轮询错误:', error.message);
  }
}

async function startPolling(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 CC 多 Agent 任务轮询器启动');
  console.log('='.repeat(60));

  // 加载持久化的动态 Agent
  console.log('\n📂 加载 Agent 记忆...');
  loadDynamicAgents();

  // 加载后台任务状态
  console.log('\n📂 加载后台任务...');
  loadTasks();
  cleanupOldTasks();  // 清理过期任务

  // 显示活跃的后台任务
  const activeTasks = getActiveTasks();
  if (activeTasks.length > 0) {
    console.log(`   🔄 有 ${activeTasks.length} 个后台任务正在执行或待执行`);
  }

  console.log(`   API: ${CONFIG.apiUrl}`);
  console.log(`   项目: ${CONFIG.defaultProjectId}`);
  console.log(`   间隔: ${CONFIG.pollInterval / 1000} 秒`);
  console.log(`   模式: ${CONFIG.executor}`);
  console.log(`   默认 Agent: ${CONFIG.defaultAgent}`);
  console.log('');
  console.log('📋 可用 Agents:');
  for (const agent of getAgentList()) {
    console.log(`   - ${agent.name} (${agent.role}): ${agent.description}`);
    console.log(`     触发词: ${agent.triggers.join(', ')}`);
  }
  console.log('='.repeat(60));

  await pollOnce();

  setInterval(pollOnce, CONFIG.pollInterval);

  process.on('SIGINT', () => {
    console.log('\n👋 轮询器已停止');
    process.exit(0);
  });
}

function showAgents(): void {
  console.log('\n📋 可用 Agents:\n');
  for (const agent of getAgentList()) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🤖 ${agent.name} (${agent.role})`);
    console.log(`   描述: ${agent.description}`);
    console.log(`   触发词: ${agent.triggers.join(', ')}`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// ==================== 入口 ====================
const args = process.argv.slice(2);

if (args.includes('--agents') || args.includes('-a')) {
  showAgents();
} else if (args.includes('--once') || args.includes('-o')) {
  pollOnce().then(() => process.exit(0));
} else {
  startPolling();
}
