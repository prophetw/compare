# 通用 Vue 3 + Express + Docker 脚手架

## 架构概览
- **前端**：Vue 3 + Vite，打包产物通过脚本同步到 Express 的静态目录。
- **后端**：Express + TypeScript，提供 API、静态资源托管以及数据库连接封装。
- **包管理**：pnpm workspace 管理前后端两个应用，确保依赖隔离与共享。
- **容器化**：单一 Dockerfile 负责编译与运行，`docker-compose` 示范了静态资源目录与数据库的绑定方式。

## 目录结构
```
.
├── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json            # workspace 脚本入口
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── scripts/sync-static.mjs # 将前端 dist 拷贝到后端 public
└── apps
    ├── frontend            # Vue 3 + Vite
    └── server              # Express + TypeScript
```

## 环境要求
- Node.js 18+
- pnpm 8（Node 18+ 默认提供 corepack，可直接 `corepack enable && corepack prepare pnpm@latest --activate`）
- Docker / Docker Compose（运行容器可选）

## 快速开始
```bash
pnpm install        # 安装所有 workspace 依赖
pnpm --filter frontend dev   # 启动前端开发服务器（Vite）
pnpm --filter server dev     # 启动后端服务（TSX 热重载）
```
前端默认运行在 `http://localhost:5173`，后端默认 `http://localhost:3000`。

## 构建与静态资源同步
1. 构建前端：`pnpm --filter frontend build`
2. 将 dist 拷贝到 Express 静态目录：`pnpm sync:static`
3. 构建后端：`pnpm --filter server build`

可以直接运行 `pnpm build` 自动串联上述步骤。构建完成后，运行 `pnpm --filter server start` 即可以生产模式启动。

## Docker 使用
```bash
docker compose up --build
```
- `apps/server/public` 被作为 volume 绑定到容器 `/app/apps/server/public`，方便本地开发时热更新静态资源。
- `DATABASE_URL` 默认连接 `docker-compose.yml` 中的 Postgres 服务，你可改成任意数据库连接串。

## 环境变量
后端读取 `.env` 文件或进程环境中的以下键：
- `PORT`：服务端口（默认 3000）。
- `DATABASE_URL`：数据库连接字符串（示例使用 PostgreSQL）。
- `SESSION_SECRET`：JWT / 会话密钥示例。

## 数据库/登录示例
后端通过 `pg` 创建连接池，`POST /api/auth/login` 演示了如何校验凭证并返回假 token。替换 SQL 或 ORM 即可实现真实登录逻辑。

## 下一步建议
- 将 `auth` 路由改为真实查询 / ORM（如 Prisma）。
- 扩展 docker-compose，加入 Redis、Nginx 等组件。
- 在 CI 中运行 `pnpm build` 与测试脚本，保证脚手架稳定。
