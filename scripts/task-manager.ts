/**
 * 后台任务管理器
 *
 * 功能：
 * 1. 后台执行长任务，不阻塞轮询器
 * 2. 分阶段执行复杂任务
 * 3. 实时进度更新到帖子
 * 4. 任务状态持久化
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 类型定义 ====================

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'timeout';
export type TaskPhase = 'init' | 'analyze' | 'execute' | 'verify' | 'report';

export interface BackgroundTask {
  id: string;
  postId: string;
  title: string;
  content: string;
  agentId: string;
  agentName: string;
  status: TaskStatus;
  phase: TaskPhase;
  progress: number;  // 0-100
  startTime: string;
  updateTime: string;
  output: string;
  error?: string;
  childPid?: number;
  // 分阶段执行
  phases?: PhaseInfo[];
  currentPhaseIndex?: number;
}

export interface PhaseInfo {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  output?: string;
}

// ==================== 配置 ====================

const TASKS_FILE = path.join(process.cwd(), 'agent-memory', 'background-tasks.json');
const PROGRESS_UPDATE_INTERVAL = 30000;  // 30秒更新一次进度

// ==================== 任务存储 ====================

const backgroundTasks = new Map<string, BackgroundTask>();
const childProcesses = new Map<string, ChildProcess>();

function ensureTasksDir(): void {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveTasks(): void {
  ensureTasksDir();
  const tasks = Object.fromEntries(backgroundTasks);
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export function loadTasks(): void {
  ensureTasksDir();
  if (fs.existsSync(TASKS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
      for (const [id, task] of Object.entries(data)) {
        backgroundTasks.set(id, task as BackgroundTask);
        // 重启后，running 状态的任务标记为需要恢复
        if ((task as BackgroundTask).status === 'running') {
          backgroundTasks.get(id)!.status = 'paused';
        }
      }
      console.log(`   📂 加载了 ${backgroundTasks.size} 个后台任务`);
    } catch (e) {
      console.error('   ⚠️ 加载后台任务失败:', e);
    }
  }
}

// ==================== 任务管理 ====================

export function createTask(
  postId: string,
  title: string,
  content: string,
  agentId: string,
  agentName: string,
  phases?: PhaseInfo[]
): BackgroundTask {
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  const task: BackgroundTask = {
    id,
    postId,
    title,
    content,
    agentId,
    agentName,
    status: 'pending',
    phase: 'init',
    progress: 0,
    startTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    output: '',
    phases: phases || [
      { name: 'analyze', description: '分析任务', status: 'pending' },
      { name: 'execute', description: '执行任务', status: 'pending' },
      { name: 'verify', description: '验证结果', status: 'pending' },
      { name: 'report', description: '生成报告', status: 'pending' },
    ],
    currentPhaseIndex: 0,
  };

  backgroundTasks.set(id, task);
  saveTasks();

  return task;
}

export function getTask(taskId: string): BackgroundTask | undefined {
  return backgroundTasks.get(taskId);
}

export function getTasksByPost(postId: string): BackgroundTask[] {
  return Array.from(backgroundTasks.values()).filter(t => t.postId === postId);
}

export function getActiveTasks(): BackgroundTask[] {
  return Array.from(backgroundTasks.values()).filter(
    t => t.status === 'running' || t.status === 'pending'
  );
}

export function updateTask(taskId: string, updates: Partial<BackgroundTask>): void {
  const task = backgroundTasks.get(taskId);
  if (task) {
    Object.assign(task, updates, { updateTime: new Date().toISOString() });
    backgroundTasks.set(taskId, task);
    saveTasks();
  }
}

export function removeTask(taskId: string): void {
  // 先停止进程
  const child = childProcesses.get(taskId);
  if (child) {
    child.kill();
    childProcesses.delete(taskId);
  }
  backgroundTasks.delete(taskId);
  saveTasks();
}

// ==================== 后台执行 ====================

export interface ExecutionOptions {
  prompt: string;
  workingDir?: string;
  timeout?: number;
  onProgress?: (task: BackgroundTask, output: string) => void;
  onComplete?: (task: BackgroundTask, result: string) => void;
  onError?: (task: BackgroundTask, error: string) => void;
}

export function executeInBackground(
  task: BackgroundTask,
  options: ExecutionOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = options.timeout || 900000;  // 默认 15 分钟

    // 更新任务状态
    updateTask(task.id, {
      status: 'running',
      phase: 'execute',
      progress: 10
    });

    // 启动子进程
    const child = spawn('/Users/changyu/.local/bin/claude',
      ['-p', options.prompt, '--dangerously-skip-permissions'],
      {
        cwd: options.workingDir || process.cwd(),
        env: { ...process.env, PATH: `/Users/changyu/.local/bin:${process.env.PATH}` },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,  // 创建新的进程组，允许后台运行
      }
    );

    childProcesses.set(task.id, child);

    let stdout = '';
    let stderr = '';
    let lastProgressUpdate = Date.now();

    child.stdout.on('data', (data) => {
      stdout += data;

      // 定期更新进度
      if (Date.now() - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
        lastProgressUpdate = Date.now();
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(90, 10 + (elapsed / timeout) * 80);

        updateTask(task.id, {
          progress: Math.round(estimatedProgress),
          output: stdout.slice(-500),  // 保留最后 500 字符
        });

        if (options.onProgress) {
          options.onProgress(backgroundTasks.get(task.id)!, stdout);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data;
    });

    // 超时处理 - 不杀死进程，只是更新状态
    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - startTime;

      // 更新任务状态为超时，但进程继续运行
      updateTask(task.id, {
        status: 'timeout',
        progress: 95,
        output: stdout,
        error: `任务超时 (${timeout/1000}s)，但进程仍在后台运行`,
      });

      // 不杀死进程
      // child.kill();

      // 返回超时报告
      resolve(`⏰ **任务超时报告**

**超时时间**: ${timeout/1000}s
**已执行时间**: ${Math.round(elapsed/1000)}s
**进程 PID**: ${child.pid} (仍在后台运行)

**已收集的输出** (${stdout.length} 字符):
\`\`\`
${stdout.slice(-2000) || '（暂无输出）'}
\`\`\`

---
_任务仍在后台继续执行，完成后会自动更新_`);
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      childProcesses.delete(task.id);

      const elapsed = Date.now() - startTime;

      if (code === 0) {
        updateTask(task.id, {
          status: 'completed',
          phase: 'report',
          progress: 100,
          output: stdout,
        });

        if (options.onComplete) {
          options.onComplete(backgroundTasks.get(task.id)!, stdout);
        }

        resolve(stdout);
      } else {
        updateTask(task.id, {
          status: 'failed',
          progress: 100,
          output: stdout,
          error: `退出码 ${code}: ${stderr}`,
        });

        if (options.onError) {
          options.onError(backgroundTasks.get(task.id)!, stderr);
        }

        reject(new Error(`退出码 ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      childProcesses.delete(task.id);

      updateTask(task.id, {
        status: 'failed',
        error: err.message,
      });

      if (options.onError) {
        options.onError(backgroundTasks.get(task.id)!, err.message);
      }

      reject(err);
    });

    // 保存 PID
    updateTask(task.id, { childPid: child.pid });
  });
}

// ==================== 分阶段执行 ====================

export async function executeInPhases(
  task: BackgroundTask,
  buildPhasePrompt: (phase: PhaseInfo, task: BackgroundTask) => string,
  options: Omit<ExecutionOptions, 'prompt'>
): Promise<string> {
  const phases = task.phases || [];
  const results: string[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];

    // 更新当前阶段
    updateTask(task.id, {
      currentPhaseIndex: i,
      phase: phase.name as TaskPhase,
      progress: Math.round((i / phases.length) * 100),
    });

    // 更新阶段状态
    phase.status = 'running';
    phase.startTime = new Date().toISOString();
    saveTasks();

    try {
      const phasePrompt = buildPhasePrompt(phase, task);

      const result = await executeInBackground(task, {
        ...options,
        prompt: phasePrompt,
        timeout: options.timeout || 300000,  // 每个阶段最多 5 分钟
      });

      phase.status = 'completed';
      phase.endTime = new Date().toISOString();
      phase.output = result.slice(-500);
      results.push(`### ${phase.description}\n${result}`);

    } catch (error: any) {
      phase.status = 'failed';
      phase.endTime = new Date().toISOString();
      phase.output = error.message;

      updateTask(task.id, { status: 'failed', error: error.message });

      return `❌ 阶段 "${phase.description}" 执行失败: ${error.message}`;
    }
  }

  updateTask(task.id, {
    status: 'completed',
    progress: 100,
    phase: 'report'
  });

  return `✅ 所有阶段执行完成\n\n${results.join('\n\n')}`;
}

// ==================== 工具函数 ====================

export function getTaskSummary(task: BackgroundTask): string {
  const elapsed = Date.now() - new Date(task.startTime).getTime();
  const minutes = Math.round(elapsed / 60000);

  let summary = `📋 **${task.title}**

**状态**: ${getStatusEmoji(task.status)} ${task.status}
**进度**: ${task.progress}%
**耗时**: ${minutes} 分钟
**Agent**: ${task.agentName}`;

  if (task.phases && task.phases.length > 0) {
    summary += `\n\n**执行阶段**:`;
    for (const phase of task.phases) {
      const emoji = phase.status === 'completed' ? '✅' :
                    phase.status === 'running' ? '🔄' :
                    phase.status === 'failed' ? '❌' : '⏳';
      summary += `\n${emoji} ${phase.description}`;
    }
  }

  if (task.output) {
    summary += `\n\n**最近输出**:\n\`\`\`\n${task.output.slice(-300)}\n\`\`\``;
  }

  return summary;
}

function getStatusEmoji(status: TaskStatus): string {
  const emojis: Record<TaskStatus, string> = {
    pending: '⏳',
    running: '🔄',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
    timeout: '⏰',
  };
  return emojis[status] || '❓';
}

export function cleanupOldTasks(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  const toRemove: string[] = [];

  for (const [id, task] of backgroundTasks) {
    const age = now - new Date(task.updateTime).getTime();
    if (age > maxAge && (task.status === 'completed' || task.status === 'failed')) {
      toRemove.push(id);
    }
  }

  for (const id of toRemove) {
    backgroundTasks.delete(id);
  }

  if (toRemove.length > 0) {
    saveTasks();
    console.log(`   🧹 清理了 ${toRemove.length} 个过期任务`);
  }
}
