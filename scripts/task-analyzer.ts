/**
 * 任务分析器 - 分析任务内容，识别任务类型
 */

export interface TaskType {
  category: 'code' | 'review' | 'docs' | 'research' | 'testing' | 'general';
  subcategory?: string;
  confidence: number;
  keywords: string[];
}

// 关键词 -> 任务类型映射
const TASK_PATTERNS: Array<{
  pattern: RegExp;
  taskType: Omit<TaskType, 'keywords'>;
}> = [
  // Code tasks
  {
    pattern: /fix|bug|修复|debug|error|报错|异常|崩溃/i,
    taskType: { category: 'code', subcategory: 'debug', confidence: 0.8 },
  },
  {
    pattern: /implement|实现|add feature|新增|开发|编写代码|写代码/i,
    taskType: { category: 'code', subcategory: 'feature', confidence: 0.7 },
  },
  {
    pattern: /refactor|重构|clean|优化|性能|提速/i,
    taskType: { category: 'code', subcategory: 'refactor', confidence: 0.7 },
  },

  // Review tasks
  {
    pattern: /review|审查|check|检查|code review|代码审/i,
    taskType: { category: 'review', confidence: 0.8 },
  },
  {
    pattern: /security|安全|vulnerability|漏洞/i,
    taskType: { category: 'review', subcategory: 'security', confidence: 0.8 },
  },

  // Documentation tasks
  {
    pattern: /document|文档|readme|api doc|注释|说明/i,
    taskType: { category: 'docs', confidence: 0.8 },
  },
  {
    pattern: /写文档|更新文档|补充文档/i,
    taskType: { category: 'docs', subcategory: 'update', confidence: 0.7 },
  },

  // Research tasks
  {
    pattern: /research|调研|analyze|分析|对比|评估|compare|evaluate/i,
    taskType: { category: 'research', confidence: 0.7 },
  },
  {
    pattern: /explore|探索|调查|研究/i,
    taskType: { category: 'research', subcategory: 'explore', confidence: 0.7 },
  },

  // Testing tasks
  {
    pattern: /test|测试|unit test|单元测试|集成测试|e2e/i,
    taskType: { category: 'testing', confidence: 0.8 },
  },

  // General/Quick tasks
  {
    pattern: /ls|列出|查看|显示|echo|回复|say|tell/i,
    taskType: { category: 'general', confidence: 0.9 },
  },
];

/**
 * 分析任务内容，返回任务类型
 */
export function analyzeTask(title: string, content: string): TaskType {
  const fullText = `${title} ${content}`;
  const matchedKeywords: string[] = [];

  // 按置信度排序的匹配结果
  const matches: Array<{ taskType: TaskType; score: number }> = [];

  for (const { pattern, taskType } of TASK_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      matchedKeywords.push(match[0]);
      matches.push({
        taskType: { ...taskType, keywords: [match[0]] },
        score: taskType.confidence + (taskType.subcategory ? 0.1 : 0),
      });
    }
  }

  if (matches.length === 0) {
    return {
      category: 'general',
      confidence: 0.5,
      keywords: [],
    };
  }

  // 返回置信度最高的匹配
  matches.sort((a, b) => b.score - a.score);
  return {
    ...matches[0].taskType,
    keywords: matchedKeywords,
  };
}

// ==================== 任务复杂度分析 ====================

export interface SubTask {
  id: string;
  description: string;
  estimatedTime: number;  // 预估时间（毫秒）
  dependencies: string[];  // 依赖的其他子任务 ID
}

export interface TaskComplexity {
  level: 'simple' | 'moderate' | 'complex';
  estimatedTotalTime: number;
  subTasks: SubTask[];
  canParallelize: boolean;
}

/**
 * 分析任务复杂度
 */
export function analyzeComplexity(title: string, content: string): TaskComplexity {
  const fullText = `${title} ${content}`;
  const subTasks: SubTask[] = [];

  // 检测编号步骤的模式 (1. xxx, 2. xxx, 一、xxx)
  const numberedStepPattern = /(?:^|\n)\s*(\d+[\.、)]\s*.+?)(?=(?:\n\s*\d+[\.、)])|$)/g;
  // 检测中文章节模式 (一、二、三)
  const chineseStepPattern = /(?:^|\n)\s*([一二三四五六七八九十]+[、.]\s*.+?)(?=(?:\n\s*[一二三四五六七八九十]+[、.])|$)/g;

  // 提取编号步骤
  const numberedSteps: string[] = [];
  let match;
  while ((match = numberedStepPattern.exec(fullText)) !== null) {
    if (match[1] && match[1].trim().length > 3) {
      numberedSteps.push(match[1].trim());
    }
  }

  // 如果没有编号步骤，检查中文步骤
  if (numberedSteps.length === 0) {
    while ((match = chineseStepPattern.exec(fullText)) !== null) {
      if (match[1] && match[1].trim().length > 3) {
        numberedSteps.push(match[1].trim());
      }
    }
  }

  // 检测动词来判断操作数量
  const actionPatterns = [
    { pattern: /运行\s*[\w-]+/g, name: '运行' },
    { pattern: /执行\s*[\w-]+/g, name: '执行' },
    { pattern: /调用\s*[\w-]+/g, name: '调用' },
    { pattern: /启动\s*[\w-]+/g, name: '启动' },
    { pattern: /推送.*?wxpusher/gi, name: '推送通知' },
    { pattern: /爬取|抓取/g, name: '爬取' },
    { pattern: /生成.*?简[报讯]/g, name: '生成简报' },
    { pattern: /更新\s*[\w-]+/g, name: '更新' },
    { pattern: /同步\s*[\w-]+/g, name: '同步' },
  ];

  const detectedActions: string[] = [];
  for (const { pattern, name } of actionPatterns) {
    const matches = fullText.match(pattern);
    if (matches) {
      matches.forEach(m => detectedActions.push(m.trim()));
    }
  }

  // 创建子任务
  if (numberedSteps.length >= 2) {
    numberedSteps.forEach((step, index) => {
      subTasks.push({
        id: `subtask-${index + 1}`,
        description: step,
        estimatedTime: 60000,
        dependencies: [],
      });
    });
  } else if (detectedActions.length >= 3) {
    // 去重
    const uniqueActions = [...new Set(detectedActions)];
    uniqueActions.slice(0, 5).forEach((action, index) => {
      subTasks.push({
        id: `subtask-${index + 1}`,
        description: action,
        estimatedTime: 60000,
        dependencies: [],
      });
    });
  }

  // 检测关键词判断复杂度
  const complexKeywords = [
    '多个项目', '3个', '三个', '4个', '所有', '批量', '并行', '同时',
    '完整', '整个', '全部', '递归', '嵌套', '循环', '简报',
  ];

  const simpleKeywords = [
    '回复', '说', '显示', '列出', '查看', '简单', '快速', '测试收到',
  ];

  let complexityScore = detectedActions.length;
  const fullTextLower = fullText.toLowerCase();
  for (const kw of complexKeywords) {
    if (fullTextLower.includes(kw.toLowerCase())) complexityScore += 2;
  }
  for (const kw of simpleKeywords) {
    if (fullTextLower.includes(kw.toLowerCase())) complexityScore -= 2;
  }

  // 判断复杂度级别
  let level: 'simple' | 'moderate' | 'complex';
  let estimatedTotalTime: number;

  if (subTasks.length >= 3 || complexityScore >= 5) {
    level = 'complex';
    estimatedTotalTime = 300000; // 5分钟+
  } else if (subTasks.length >= 2 || complexityScore >= 3) {
    level = 'moderate';
    estimatedTotalTime = 120000; // 2分钟
  } else {
    level = 'simple';
    estimatedTotalTime = 60000; // 1分钟
  }

  // 判断是否可并行化
  const canParallelize = subTasks.length > 1 &&
    subTasks.every(st => st.dependencies.length === 0);

  return {
    level,
    estimatedTotalTime: Math.max(estimatedTotalTime, subTasks.reduce((sum, st) => sum + st.estimatedTime, 0)),
    subTasks,
    canParallelize,
  };
}

/**
 * 获取任务类型的中文描述
 */
export function getTaskTypeDescription(taskType: TaskType): string {
  const descriptions: Record<string, string> = {
    code: '代码开发',
    review: '代码审查',
    docs: '文档编写',
    research: '调研分析',
    testing: '测试验证',
    general: '通用任务',
  };

  let desc = descriptions[taskType.category] || '通用任务';
  if (taskType.subcategory) {
    const subDescs: Record<string, string> = {
      debug: '（调试）',
      feature: '（新功能）',
      refactor: '（重构）',
      security: '（安全）',
      update: '（更新）',
      explore: '（探索）',
    };
    desc += subDescs[taskType.subcategory] || '';
  }
  return desc;
}
