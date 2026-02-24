-- Collab Platform 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件

-- ==================== 启用扩展 ====================
create extension if not exists "uuid-ossp";

-- ==================== 项目表 ====================
create table if not exists projects (
  id text primary key,
  name text not null,
  description text,
  visibility text not null default 'team' check (visibility in ('private', 'team', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================== 文件节点表（树形结构）====================
create table if not exists file_nodes (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  parent_id text references file_nodes(id) on delete cascade,
  name text not null,
  type text not null check (type in ('folder', 'file')),
  content text,
  mime_type text,
  size integer default 0,
  -- Agent 协作字段
  created_by text,
  created_by_name text,
  updated_by text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================== 帖子表 ====================
create table if not exists posts (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  content text not null,
  is_pinned boolean default false,
  -- 作者信息（冗余存储，方便查询）
  author_id text not null,
  author_name text not null,
  author_type text not null check (author_type in ('human', 'agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================== 回复表 ====================
create table if not exists replies (
  id text primary key,
  post_id text not null references posts(id) on delete cascade,
  content text not null,
  -- 作者信息
  author_id text not null,
  author_name text not null,
  author_type text not null check (author_type in ('human', 'agent')),
  created_at timestamptz not null default now()
);

-- ==================== 附件表 ====================
create table if not exists attachments (
  id text primary key,
  post_id text not null references posts(id) on delete cascade,
  name text not null,
  size integer default 0,
  mime_type text,
  url text,
  created_at timestamptz not null default now()
);

-- ==================== 时间线事件表 ====================
create table if not exists timeline_events (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  type text not null check (type in ('create', 'modify', 'delete', 'rename', 'move')),
  file_name text not null,
  file_path text,
  summary text,
  -- 作者信息
  author_id text not null,
  author_name text not null,
  author_type text not null check (author_type in ('human', 'agent')),
  created_at timestamptz not null default now()
);

-- ==================== Agents 表（注册的实例）====================
create table if not exists agents (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  role text default 'worker',
  online boolean default true,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(project_id, id)
);

-- ==================== 消息表 ====================
create table if not exists messages (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  from_agent_id text not null,
  from_agent_name text not null,
  to_agent_id text,
  content text not null,
  created_at timestamptz not null default now()
);

-- ==================== 成员表 ====================
create table if not exists members (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('human', 'agent')),
  role text,
  online boolean default true,
  last_seen timestamptz not null default now(),
  unique(project_id, id)
);

-- ==================== 索引 ====================
create index if not exists idx_file_nodes_project on file_nodes(project_id);
create index if not exists idx_file_nodes_parent on file_nodes(parent_id);
create index if not exists idx_posts_project on posts(project_id);
create index if not exists idx_replies_post on replies(post_id);
create index if not exists idx_timeline_project on timeline_events(project_id);
create index if not exists idx_messages_project on messages(project_id);
create index if not exists idx_messages_to on messages(to_agent_id);
create index if not exists idx_agents_project on agents(project_id);
create index if not exists idx_members_project on members(project_id);

-- ==================== 更新时间触发器 ====================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at before update on projects
  for each row execute function update_updated_at();

create trigger update_file_nodes_updated_at before update on file_nodes
  for each row execute function update_updated_at();

create trigger update_posts_updated_at before update on posts
  for each row execute function update_updated_at();

-- ==================== RLS 策略 ====================
-- 服务端使用 service_role key 绕过 RLS
-- 客户端需要适当的策略

alter table projects enable row level security;
alter table file_nodes enable row level security;
alter table posts enable row level security;
alter table replies enable row level security;
alter table attachments enable row level security;
alter table timeline_events enable row level security;
alter table agents enable row level security;
alter table messages enable row level security;
alter table members enable row level security;

-- 公共读策略（team 和 public 项目）
create policy "Projects are viewable by everyone" on projects
  for select using (visibility in ('team', 'public'));

create policy "File nodes are viewable" on file_nodes
  for select using (
    exists (select 1 from projects where projects.id = file_nodes.project_id and visibility in ('team', 'public'))
  );

create policy "Posts are viewable" on posts
  for select using (
    exists (select 1 from projects where projects.id = posts.project_id and visibility in ('team', 'public'))
  );

create policy "Replies are viewable" on replies
  for select using (true);

create policy "Timeline is viewable" on timeline_events
  for select using (
    exists (select 1 from projects where projects.id = timeline_events.project_id and visibility in ('team', 'public'))
  );

create policy "Agents are viewable" on agents
  for select using (true);

create policy "Messages are viewable" on messages
  for select using (true);

create policy "Members are viewable" on members
  for select using (true);

-- 插入策略（允许所有，实际生产环境需要认证）
create policy "Allow insert" on projects for insert with check (true);
create policy "Allow insert" on file_nodes for insert with check (true);
create policy "Allow insert" on posts for insert with check (true);
create policy "Allow insert" on replies for insert with check (true);
create policy "Allow insert" on attachments for insert with check (true);
create policy "Allow insert" on timeline_events for insert with check (true);
create policy "Allow insert" on agents for insert with check (true);
create policy "Allow insert" on messages for insert with check (true);
create policy "Allow insert" on members for insert with check (true);

-- 更新策略
create policy "Allow update" on projects for update using (true);
create policy "Allow update" on file_nodes for update using (true);
create policy "Allow update" on posts for update using (true);
create policy "Allow update" on agents for update using (true);
create policy "Allow update" on members for update using (true);

-- 删除策略
create policy "Allow delete" on projects for delete using (true);
create policy "Allow delete" on file_nodes for delete using (true);
create policy "Allow delete" on posts for delete using (true);
create policy "Allow delete" on replies for delete using (true);
create policy "Allow delete" on attachments for delete using (true);
create policy "Allow delete" on timeline_events for delete using (true);
create policy "Allow delete" on agents for delete using (true);
create policy "Allow delete" on messages for delete using (true);
create policy "Allow delete" on members for delete using (true);

-- ==================== 插入默认项目 ====================
insert into projects (id, name, description, visibility)
values (
  'proj-default',
  '默认项目',
  '协作平台默认项目',
  'team'
) on conflict (id) do nothing;

-- 插入默认文件夹
insert into file_nodes (id, project_id, parent_id, name, type)
values
  ('folder-docs', 'proj-default', null, '文档', 'folder'),
  ('folder-design', 'proj-default', null, '设计', 'folder'),
  ('folder-code', 'proj-default', null, '代码', 'folder')
on conflict (id) do nothing;

-- 插入默认文件
insert into file_nodes (id, project_id, parent_id, name, type, content, mime_type, size, created_by, created_by_name)
values
  ('file-readme', 'proj-default', 'folder-docs', 'README.md', 'file', '# 项目说明\n\n这是一个协作平台项目。', 'text/markdown', 30, 'system', 'System'),
  ('file-index', 'proj-default', 'folder-code', 'index.ts', 'file', '// 入口文件\nexport {};', 'text/typescript', 20, 'system', 'System'),
  ('file-config', 'proj-default', 'folder-code', 'config.json', 'file', '{\n  "name": "collab-platform"\n}', 'application/json', 30, 'system', 'System')
on conflict (id) do nothing;

-- 插入默认帖子
insert into posts (id, project_id, title, content, is_pinned, author_id, author_name, author_type)
values
  ('post-1', 'proj-default', '欢迎来到协作平台', '这是一个团队协作平台，支持文件管理、讨论帖子和 AI Agent 协作。', true, 'u1', '张三', 'human'),
  ('post-2', 'proj-default', 'API 接口已就绪', '文件系统 API 已经可以通过 /api/files 访问。', false, 'ai-1', 'Claude', 'agent')
on conflict (id) do nothing;

-- 插入默认成员
insert into members (id, project_id, name, type, role, online)
values
  ('u1', 'proj-default', '张三', 'human', null, true),
  ('ai-1', 'proj-default', 'Claude', 'agent', 'assistant', true)
on conflict (id) do nothing;

-- 插入默认时间线事件
insert into timeline_events (id, project_id, type, file_name, file_path, summary, author_id, author_name, author_type)
values
  ('event-1', 'proj-default', 'create', 'index.ts', '代码/index.ts', '创建了文件', 'u1', '张三', 'human')
on conflict (id) do nothing;
