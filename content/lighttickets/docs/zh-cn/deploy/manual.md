---
order: 30
---

# 手动部署

## 前置条件

- Node 24（两个镜像的 `ARG NODE_VERSION` 默认值均为 `24`，CI 使用 26，两者均可运行）
- npm
- `openssl`（Prisma 引擎的依赖；官方 `node:24-bookworm-slim` 镜像需额外安装，宿主机通常已具备）
- 可用的 `npx`（后端构建与迁移通过 `npx prisma` 调用）

```bash
node -v
npm -v
openssl version
```

## 后端

```bash
cd backend
npm install          # postinstall 自动执行 scripts/generate-client.mjs
npm run build
npm start
```

构建流程如下：

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖；`postinstall` 执行 `scripts/generate-client.mjs`，以临时 schema 生成 Prisma Client 类型 |
| `npm run build` | `prebuild` 再次生成 Client，随后 `tsc` 编译至 `dist/`，最后由 `scripts/copy-runtime-assets.mjs` 将运行时资源复制到 `dist/` |
| `npm start` | `node dist/index.js` |

`copy-runtime-assets.mjs` 将以下内容复制到 `dist/`：`src/locales` → `dist/locales`，以及 `templates`、`prisma`、`scripts`、`openapi.json`、`prisma.config.ts`、`package.json`。`dist/` 因此为自包含的部署目录；缺少上述文件时，后端无法初始化模板或执行迁移。

启动时，后端读取数据目录、检查 `config.yml`，并在配置就绪后自动执行数据库迁移。

### 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LT_SERVER_PORT` | `23320` | API 监听端口 |
| `LT_SERVER_DATA_DIR` | `data` | 数据根目录（相对当前工作目录解析） |

```bash
LT_SERVER_PORT=23320 \
LT_SERVER_DATA_DIR=/srv/lighttickets/data \
node dist/index.js
```

::: warning
`LT_SERVER_DATA_DIR` 相对 `process.cwd()` 解析。以 systemd 启动时，须写绝对路径；否则数据将落入服务的工作目录，升级后会导致数据丢失。
:::

### config.yml

平台基础配置位于 `<LT_SERVER_DATA_DIR>/config.yml`：

- 文件权限为 `0600`，任何 API 均不返回该文件；
- 后端仅在启动时读取一次并缓存，修改后须重启进程；
- 首次启动时该文件不存在，后端仅提供 setup 服务；setup 提交后写入 `config.yml.setup`（`0600`），执行迁移，在事务内创建管理员与站点配置，随后重命名为 `config.yml` 并重载；
- `security.*`（JWT 与外部登录加密密钥）与 `database.*` 由 setup 回写；`jwtUnsubscribeSecret` 与 `externalEncryptionKey` 缺失时将自动生成。

字段含义参见 [配置参考](./config.md)。

## 前端

```bash
cd frontend
npm install
LT_WEB_API_URL=/api npm run build
npm start
```

`npm run build` 的执行顺序为 `vue-tsc -b && vite build && node scripts/copy-runtime-assets.mjs`，产物写入 `dist/`；该目录在运行期不再改动。

`npm start` 执行 `node server.mjs`，该文件为零依赖的纯 HTTP 服务，其职责如下：

- 仅从 `dist/` 提供文件，越界路径返回 403；
- 未命中的路径回退到 `dist/index.html`（Vue Router history 模式）；
- 将 `/api`（含 `/api/` 前缀）反向代理至 `LT_SERVER_URL`；
- 将 `/socket.io` 的 WebSocket upgrade 代理至 `LT_SERVER_URL`；
- 为 `dist/assets/` 添加 `public, max-age=31536000, immutable`，`index.html` 与 history fallback 使用 `no-cache`；
- 附带固定 CSP 与安全响应头。

该服务不处理 TLS、不压缩、不执行负载均衡，对外 HTTPS 须由反向代理终止。

### 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LT_WEB_HOST` | `0.0.0.0` | 监听地址 |
| `LT_WEB_PORT` | `23310` | 监听端口 |
| `LT_WEB_API_URL` | `/api` | 构建期变量，决定前端请求的 API 前缀 |
| `LT_SERVER_URL` | `http://127.0.0.1:23320` | 运行期代理目标，须为纯 origin（不允许路径、查询、凭据） |
| `LT_GIT_COMMIT` | 无 | 构建期写入界面的提交号，用于核对版本 |

::: tip
运行期仅需 `package.json`、`runtime-config.mjs`、`server.mjs` 与 `dist/`，无需 `node_modules/`。
:::

## systemd 单元示例

后端：

```ini
[Unit]
Description=LightTickets server
After=network.target mysql.service

[Service]
Type=simple
User=lighttickets
WorkingDirectory=/srv/lighttickets/backend
Environment=NODE_ENV=production
Environment=LT_SERVER_PORT=23320
Environment=LT_SERVER_DATA_DIR=/srv/lighttickets/data
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

前端：

```ini
[Unit]
Description=LightTickets web
After=network.target lighttickets-server.service
Wants=lighttickets-server.service

[Service]
Type=simple
User=lighttickets
WorkingDirectory=/srv/lighttickets/frontend
Environment=NODE_ENV=production
Environment=LT_WEB_HOST=127.0.0.1
Environment=LT_WEB_PORT=23310
Environment=LT_SERVER_URL=http://127.0.0.1:23320
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lighttickets-server lighttickets-web
sudo journalctl -u lighttickets-server -f
```

前端监听 `127.0.0.1` 并由 nginx 反向代理。若前端直接对外，须将监听地址改回 `0.0.0.0`。

## nginx 反向代理

```nginx
server {
    listen 80;
    server_name tickets.example.com;

    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:23310;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:23310;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:23310;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_read_timeout 3600s;
    }
}
```

若 nginx 与前端不在同一台机器，或将请求直接反向代理至 23320，将站点 origin 加入 `server.corsOrigins`，并将 nginx 出口 IP 写入 `server.trustedProxyIps`，详见 [配置参考](./config.md)。

## 开发模式

仓库根目录提供了并行启动两个服务的命令：

```bash
npm install          # 根目录，安装 concurrently / husky / lint-staged
npm run dev          # 同时跑 backend tsx watch 与 frontend vite
```

- 后端：`cd backend && npm run dev`，即 `tsx watch src/index.ts`
- 前端：`cd frontend && npm run dev`，即 Vite dev server
- Vite 将 `/api` 与 `/socket.io` 代理至 `LT_SERVER_URL`，默认 `http://127.0.0.1:23320`
- Vite 监听端口由 `LT_WEB_PORT` 控制，默认 `23310`

开发模式下，前端由 Vite 提供，而非 `server.mjs`；CSP、缓存头与静态文件行为与生产环境不完全一致。验证部署效果使用 `npm run build` 与 `npm start`。
