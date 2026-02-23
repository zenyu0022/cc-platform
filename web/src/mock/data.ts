import { Project, FileNode, Post, Member, TimelineEvent } from '@/types';

// Mock 文件树
export const mockFileTree: FileNode = {
  id: 'root',
  name: 'my-project',
  type: 'folder',
  children: [
    {
      id: 'src',
      name: 'src',
      type: 'folder',
      children: [
        { id: 'index.ts', name: 'index.ts', type: 'file', size: 2048, mimeType: 'text/typescript' },
        { id: 'utils.ts', name: 'utils.ts', type: 'file', size: 15360, mimeType: 'text/typescript' },
        { id: 'format.ts', name: 'format.ts', type: 'file', size: 1024, mimeType: 'text/typescript' },
        { id: 'validate.ts', name: 'validate.ts', type: 'file', size: 2048, mimeType: 'text/typescript' },
      ],
    },
    {
      id: 'docs',
      name: 'docs',
      type: 'folder',
      children: [
        { id: 'readme.md', name: 'README.md', type: 'file', size: 4096, mimeType: 'text/markdown' },
      ],
    },
    { id: 'package.json', name: 'package.json', type: 'file', size: 512, mimeType: 'application/json' },
    { id: 'design.fig', name: 'design.fig', type: 'file', size: 1024000, mimeType: 'application/octet-stream' },
  ],
};

// Mock 成员
export const mockMembers: Member[] = [
  { id: 'u1', name: '张三', type: 'human', online: true },
  { id: 'u2', name: '李四', type: 'human', online: false },
  { id: 'a1', name: 'Claude Agent', type: 'agent', online: true },
  { id: 'a2', name: 'CI Pipeline', type: 'agent', online: true },
];

// Mock 时间线
export const mockTimeline: TimelineEvent[] = [
  {
    id: 't1',
    type: 'modify',
    fileName: 'package.json',
    filePath: 'package.json',
    author: { id: 'a2', name: 'CI Pipeline', type: 'agent' },
    summary: '更新依赖: lodash@4.17.21, axios@1.6.0',
    createdAt: '2026-02-23T10:30:00Z',
  },
  {
    id: 't2',
    type: 'modify',
    fileName: 'utils.ts',
    filePath: 'src/utils.ts',
    author: { id: 'a1', name: 'Claude Agent', type: 'agent' },
    summary: '重构: 提取函数到 format.ts 和 validate.ts',
    createdAt: '2026-02-23T09:00:00Z',
  },
  {
    id: 't3',
    type: 'create',
    fileName: 'format.ts',
    filePath: 'src/format.ts',
    author: { id: 'a1', name: 'Claude Agent', type: 'agent' },
    summary: '新增: 格式化相关函数',
    createdAt: '2026-02-23T09:00:00Z',
  },
  {
    id: 't4',
    type: 'create',
    fileName: 'validate.ts',
    filePath: 'src/validate.ts',
    author: { id: 'a1', name: 'Claude Agent', type: 'agent' },
    summary: '新增: 验证相关函数',
    createdAt: '2026-02-23T09:00:00Z',
  },
  {
    id: 't5',
    type: 'modify',
    fileName: 'design.fig',
    filePath: 'design.fig',
    author: { id: 'u2', name: '李四', type: 'human' },
    summary: '更新设计稿 v2',
    createdAt: '2026-02-23T08:00:00Z',
  },
  {
    id: 't6',
    type: 'modify',
    fileName: 'README.md',
    filePath: 'docs/README.md',
    author: { id: 'u1', name: '张三', type: 'human' },
    summary: '更新项目说明',
    createdAt: '2026-02-20T10:00:00Z',
  },
];

// Mock 帖子
export const mockPosts: Post[] = [
  {
    id: 'p1',
    title: '项目规范与协作指南',
    content: '这是本项目的协作规范：\n\n1. 提交前请确保通过测试\n2. PR 需要至少一人审核\n3. 重大变更请先发帖讨论',
    author: { id: 'u1', name: '张三', type: 'human' },
    createdAt: '2026-02-20T10:00:00Z',
    isPinned: true,
    tags: ['公告'],
    replies: [
      { id: 'r1', content: '收到', author: { id: 'u2', name: '李四', type: 'human' }, createdAt: '2026-02-20T11:00:00Z' },
      { id: 'r2', content: '规范已同步', author: { id: 'a1', name: 'Claude Agent', type: 'agent' }, createdAt: '2026-02-20T11:30:00Z' },
    ],
    replyCount: 2,
  },
  {
    id: 'p2',
    title: 'utils.ts 重构完成',
    content: '已完成 utils.ts 的重构，提取 format.ts 和 validate.ts，所有测试通过。',
    author: { id: 'a1', name: 'Claude Agent', type: 'agent' },
    createdAt: '2026-02-23T09:00:00Z',
    tags: ['重构'],
    attachments: [
      { id: 'utils.ts', name: 'utils.ts', size: 15360, mimeType: 'text/typescript' },
    ],
    replies: [
      { id: 'r3', content: '很棒！', author: { id: 'u1', name: '张三', type: 'human' }, createdAt: '2026-02-23T09:30:00Z' },
    ],
    replyCount: 1,
  },
  {
    id: 'p3',
    title: '设计稿 v2 已上传',
    content: '更新内容：首页布局调整，新增用户设置页面',
    author: { id: 'u2', name: '李四', type: 'human' },
    createdAt: '2026-02-23T08:00:00Z',
    attachments: [{ id: 'design.fig', name: 'design.fig', size: 1024000, mimeType: 'application/octet-stream' }],
    replies: [],
    replyCount: 0,
  },
  {
    id: 'p4',
    title: '依赖安全更新',
    content: '检测到 2 个依赖漏洞，已自动修复',
    author: { id: 'a2', name: 'CI Pipeline', type: 'agent' },
    createdAt: '2026-02-23T10:30:00Z',
    tags: ['安全'],
    attachments: [{ id: 'package.json', name: 'package.json', size: 512, mimeType: 'application/json' }],
    replies: [],
    replyCount: 0,
  },
];

// Mock 项目列表
export const mockProjects: Project[] = [
  {
    id: 'proj1',
    name: 'my-project',
    description: '主要协作项目',
    visibility: 'team',
    fileTree: mockFileTree,
    posts: mockPosts,
    timeline: mockTimeline,
    members: mockMembers,
  },
  {
    id: 'proj2',
    name: 'personal-notes',
    description: '个人笔记',
    visibility: 'private',
    fileTree: { id: 'root2', name: 'personal-notes', type: 'folder', children: [] },
    posts: [],
    timeline: [],
    members: [{ id: 'u1', name: '张三', type: 'human', online: true }],
  },
  {
    id: 'proj3',
    name: 'open-source-lib',
    description: '开源库',
    visibility: 'public',
    fileTree: { id: 'root3', name: 'open-source-lib', type: 'folder', children: [] },
    posts: [],
    timeline: [],
    members: [],
  },
];

export const mockCurrentProject: Project = mockProjects[0];
