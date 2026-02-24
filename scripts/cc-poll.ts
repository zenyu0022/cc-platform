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
} from './agents.config';

// ==================== 配置 ====================
const CONFIG = {
  apiUrl: process.env.COLLAB_API_URL || 'http://localhost:3000/api/files',
  defaultProjectId: process.env.DEFAULT_PROJECT_ID || 'proj-default',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '60000'),
  ccTimeout: parseInt(process.env.CC_TIMEOUT || '120000'),
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
}

// ==================== API 调用 ====================
async function fetchPosts(projectId: string): Promise<Post[]> {
  const url = `${CONFIG.apiUrl}?action=posts&projectId=${projectId}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.posts || [];
}

async function fetchPostDetail(projectId: string, postId: string): Promise<Post | null> {
  const url = `${CONFIG.apiUrl}?action=post&projectId=${projectId}&postId=${postId}`;
  const res = await fetch(url);
  const data = await res.json();
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
    r.author.id === agentId && r.content.includes('[CC-DONE]')
  );
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

    // 确定目标 Agents
    const targetAgents = mentions.length > 0 ? mentions : [CONFIG.defaultAgent];

    // 检查每个目标 Agent 是否已处理
    for (const agentId of targetAgents) {
      const agent = getAgent(agentId);
      if (!agent) continue;

      if (!isProcessedByAgent(replies, agent.id)) {
        const allKeywords = [...agent.triggerKeywords, '@cc', '@CC'];
        const instruction = extractInstruction(post.content, allKeywords);

        tasks.push({
          postId: post.id,
          title: post.title,
          content: instruction || post.content,
          author: post.author.name,
          targetAgents: [agentId],
        });
      }
    }
  }

  return tasks;
}

// ==================== Claude Code 执行 ====================
async function executeWithAgent(task: Task, agentId: string): Promise<string> {
  const agent = getAgent(agentId);
  if (!agent) {
    return `❌ 未知的 Agent: ${agentId}`;
  }

  console.log(`\n🤖 [${agent.name}] 执行任务: "${task.title}"`);
  console.log(`   角色: ${agent.role} (${agent.description})`);
  console.log(`   指令: ${task.content.substring(0, 50)}...`);
  console.log(`   发布者: ${task.author}\n`);

  const prompt = buildExecutionPrompt(agent, {
    title: task.title,
    content: task.content,
    author: task.author,
  });

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

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('TIMEOUT'));
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
    if (error.message === 'TIMEOUT') {
      return '❌ 任务执行超时';
    }
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
      for (const agentId of task.targetAgents) {
        const agent = getAgent(agentId);
        if (!agent) continue;

        const result = await executeWithAgent(task, agentId);

        const reply = `[CC-DONE]

**${agent.name} (${agent.role}) 任务完成**

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
      }
    }
  } catch (error: any) {
    console.error('   ❌ 轮询错误:', error.message);
  }
}

async function startPolling(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 CC 多 Agent 任务轮询器启动');
  console.log('='.repeat(60));
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
