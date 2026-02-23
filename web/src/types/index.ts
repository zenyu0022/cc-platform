// 帖子类型
export interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    type: 'human' | 'agent';
  };
  createdAt: string;
  isPinned?: boolean;
  tags?: string[];
  attachments?: Attachment[];
  replies: Reply[];
  replyCount: number;
}

// 回复
export interface Reply {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    type: 'human' | 'agent';
  };
  createdAt: string;
}

// 文件附件
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

// 文件节点
export interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FileNode[];
  size?: number;
  mimeType?: string;
  postCount?: number;
}

// 时间线事件
export interface TimelineEvent {
  id: string;
  type: 'create' | 'modify' | 'delete';
  fileName: string;
  filePath: string;
  author: {
    id: string;
    name: string;
    type: 'human' | 'agent';
  };
  summary: string;
  createdAt: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  description?: string;
  visibility: 'private' | 'team' | 'public';
  fileTree: FileNode;
  posts: Post[];
  timeline: TimelineEvent[];
  members: Member[];
}

// 成员
export interface Member {
  id: string;
  name: string;
  type: 'human' | 'agent';
  online: boolean;
}

// 用户
export interface User {
  id: string;
  name: string;
  projects: Project[];
}
