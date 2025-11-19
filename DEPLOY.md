# 部署指南

本项目是一个包含 Vue 3 + Vite 前端与 Express + TypeScript 后端的单体仓库，前端打包产物会同步到后端的 `apps/server/public` 中由 Express 托管。下面提供部署所需的准备、环境变量说明以及两种部署方式。

## 前置条件

- Node.js 18+ 与 pnpm 8（推荐通过 `corepack enable && corepack prepare pnpm@latest --activate`）
- PostgreSQL（默认连接 `postgres://postgres:postgres@localhost:5432/postgres`，可以替换为任何兼容的连接串）
- 可选：Docker / Docker Compose，用于容器化部署

## 环境变量

| 变量 | 作用 | 默认值 | 备注 |
| --- | --- | --- | --- |
| `PORT` | 后端 HTTP 端口 | `3000` | Express + 静态资源均通过该端口提供 |
| `DATABASE_URL` | 数据库连接串 | `postgres://postgres:postgres@localhost:5432/postgres` | 需确保账号、库名、网络可访问 |
| `SESSION_SECRET` | JWT / 会话密钥 | `dev-secret` | 生产环境必须替换 |
| `VITE_DEV_PORT` | Vite 开发服务器端口 | `5173` | 仅开发/调试使用 |
| `VITE_API_TARGET` | Vite 代理的 API 地址 | `http://localhost:3000` | 本地调试时转发 `/api` 请求 |

仓库根目录提供 `.env.example`，将其复制为 `.env` 后即可同时被 Docker Compose（自动读取根目录 `.env`）以及后端 `dotenv` 所使用，实现统一配置。若还需要 Vite 的开发变量，可单独保留 `apps/frontend/.env`。

> 提示：生产模式下只需关心 `PORT`、`DATABASE_URL` 与 `SESSION_SECRET`，前端资源已经被拷贝到后端服务。

## 标准部署流程（无 Docker）

1. **安装依赖**
   ```bash
   pnpm install
   ```
2. **配置环境变量**  
   在仓库根目录创建 `.env` 或注入进程环境，至少覆盖 `PORT`、`DATABASE_URL`、`SESSION_SECRET`。
3. **构建前端**
   ```bash
   pnpm --filter frontend build
   ```
4. **同步静态资源**  
   将 `apps/frontend/dist` 拷贝到 `apps/server/public`：
   ```bash
   pnpm sync:static
   ```
   （或直接执行 `pnpm build` 自动串联前端构建、同步以及后端构建）
5. **构建后端**
   ```bash
   pnpm --filter server build
   ```
6. **启动服务（生产模式）**
   ```bash
   pnpm --filter server start
   ```
7. **健康检查**  
   访问 `http://<HOST>:<PORT>/healthz` 或根路径确认页面可以加载。

静态资源位于 `apps/server/public`，如需接入 Nginx 或其他反向代理，可以直接将此服务暴露出去；所有 API 均挂在 `/api/*` 下。

## Docker / Docker Compose 部署

项目内置 `docker-compose.yml`，用于快速启动 Web + PostgreSQL：

```bash
docker compose up --build -d
```

- `services.web` 将容器内的 `3000` 暴露为宿主机 `${PORT:-3000}`，根据需要修改环境变量即可。
- `apps/server/public` 被作为 volume 挂载，方便本地调试时同步前端静态资源。
- `services.db` 会在宿主机暴露 `5432`，线上环境可移除此映射并改为使用托管数据库。

若只需单个容器，可在 CI/CD 中执行多阶段构建（Dockerfile 已包含前后端构建步骤），然后运行：

```bash
docker build -t compare-app .
docker run -d -p 3000:3000 \
  -e PORT=3000 \
  -e DATABASE_URL="postgres://..." \
  -e SESSION_SECRET="***" \
  compare-app
```

### Docker 构建脚本

为了方便本地或 CI 中在构建镜像前预先完成前端打包与静态资源同步，提供脚本 `scripts/docker-build.sh`：

```bash
./scripts/docker-build.sh my-org/compare:latest
```

脚本包含以下步骤：
1. `pnpm --filter frontend build`：构建前端。
2. `pnpm sync:static`：将前端产物同步到 `apps/server/public`。
3. `docker build -t <镜像名> .`：使用当前目录的 Dockerfile 构建镜像。

镜像标签参数可省略，默认为 `compare-app:latest`。

## 注意事项

- 前端构建会依赖 `apps/BimEngine` 目录中的资源，通过 `vite-plugin-static-copy` 拷贝到 `dist/engine-sdk`。部署环境必须携带该目录（或调整 Vite 配置）。
- 每次更新前端代码都需要重新执行 `pnpm --filter frontend build` 与 `pnpm sync:static`，否则后端仍会提供旧的静态资源。
- `DATABASE_URL` 包含凭据和主机信息，切勿直接提交到仓库。生产环境建议通过秘密管理服务注入。
- 生产端口建议通过反向代理（Nginx、Traefik 等）暴露，并配置 HTTPS。
