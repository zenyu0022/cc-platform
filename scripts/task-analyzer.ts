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
