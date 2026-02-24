# CC 远程任务轮询器

让 Claude Code 通过 collab-platform 论坛接收远程指令。

## 公网访问

使用 Cloudflare Tunnel 将本地服务暴露到公网，实现远程发帖驱动本地 CC。

```bash
# 终端 1: 启动 Web 服务
cd ~/projects/collab-platform/web && pnpm dev

# 终端 2: 启动公网隧道
cd ~/projects/collab-platform/scripts && pnpm run tunnel
# 或直接运行脚本
./tunnel.sh
```

输出会显示公网 URL（如 `https://xxx.trycloudflare.com`），用手机或其他设备访问即可。

> 需要先安装 cloudflared: `brew install cloudflared`

## 快速开始

```bash
# 进入脚本目录
cd ~/projects/collab-platform/scripts

# 安装依赖
pnpm install

# 启动轮询（每分钟检查一次）
pnpm run poll:start

# 或单次检查
pnpm run poll:once
```

## 使用方式

1. 在 collab-platform 发帖，内容包含 `@cc`
2. 轮询器检测到新帖子
3. Claude Code 执行任务
4. 结果自动回复到帖子

**示例帖子：**
```
标题: @cc 整理文档
内容: @cc 请帮我整理 docs 目录下的 markdown 文件，按主题分类
```

## 配置

通过环境变量配置：

```bash
# .env 文件或命令行

# API 地址（默认 localhost:3000）
COLLAB_API_URL=http://localhost:3000/api/files

# 项目 ID
DEFAULT_PROJECT_ID=proj-default

# 轮询间隔（毫秒，默认 60000 = 1分钟）
POLL_INTERVAL=60000

# 执行超时（毫秒，默认 120000 = 2分钟）
CC_TIMEOUT=120000

# 执行器模式
# - claude: 真实调用 Claude Code
# - echo: 测试模式，返回模拟结果
EXECUTOR=claude

# 工作目录
WORK_DIR=/Users/changyu
```

## 启动示例

```bash
# 测试模式（不真正调用 CC）
EXECUTOR=echo pnpm run poll:start

# 每 30 秒检查一次
POLL_INTERVAL=30000 pnpm run poll:start

# 后台运行
nohup pnpm run poll:start > cc-poll.log 2>&1 &
```

## 工作原理

```
[用户发帖 @cc 任务]
       ↓
[轮询器检测帖子] ← 每 N 秒
       ↓
[提取指令内容]
       ↓
[调用 claude --print 执行]
       ↓
[回复结果到帖子]
       ↓
[标记 [CC-DONE] 避免重复]
```

## 触发条件

- 帖子标题或内容包含 `@cc` / `@CC` / `@claude`
- 帖子尚未有 CC 的回复（检查 `[CC-DONE]` 标记）

## 安全注意

- 确保只有受信任的用户能发帖
- 考虑添加额外的认证机制
- 生产环境建议限制可执行的命令范围
