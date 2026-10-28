---
order: 30
---

# 手动部署

## 前置条件

- Node 24（两个镜像的 `ARG NODE_VERSION` 默认都是 `24`，CI 使用 26，两者都可运行）
- npm
- `openssl`（Prisma 引擎依赖；官方 `node:24-bookworm-slim` 镜像需要额外安装，宿主机一般已具备）
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

构建流程：

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖；`postinstall` 运行 `scripts/generate-client.mjs`，用临时 schema 生成 Prisma Client 类型 |
| `npm run build` | `prebuild` 再生成一次 Client，然后 `tsc` 编译到 `dist/`，最后 `scripts/copy-runtime-assets.mjs` 把运行时资源拷进 `dist/` |
| `npm start` | `node dist/index.js` |

`copy-runtime-assets.mjs` 会复制以下内容到 `dist/`：`src/locales` → `dist/locales`，以及 `templates`、`prisma`、`scripts`、`openapi.json`、`prisma.config.ts`、`package.json`。因此 `dist/` 是一个自包含的部署目录，缺少这些文件时后端无法初始化模板或执行迁移。

启动时后端会读取数据目录、检查 `config.yml`，并在配置就绪后自动执行数据库迁移。

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
`LT_SERVER_DATA_DIR` 是相对 `process.cwd()` 解析的。用 systemd 启动时建议写绝对路径，否则数据会落到服务的工作目录里，升级后容易"丢库"。
:::

### config.yml

平台基础配置位于 `<LT_SERVER_DATA_DIR>/config.yml`：

- 文件权限为 `0600`，任何 API 都不会返回它；
- 后端只在启动时读取一次并缓存，改完必须重启进程；
- 首次启动时该文件不存在，后端只提供 setup 服务；setup 提交后写入 `config.yml.setup`（`0600`），执行迁移，在事务内创建管理员与站点配置，再重命名为 `config.yml` 并重载；
- `security.*`（JWT 与外部登录加密密钥）和 `database.*` 由 setup 回写。`jwtUnsubscribeSecret` 与 `externalEncryptionKey` 在缺失时会自动生成。

字段含义见 [配置参考](./config.md)。

## 前端

```bash
cd frontend
npm install
LT_WEB_API_URL=/api npm run build
npm start
```

`npm run build` 的顺序是 `vue-tsc -b && vite build && node scripts/copy-runtime-assets.mjs`，产物写入 `dist/`，运行期不会再改动这个目录。

`npm start` 执行 `node server.mjs`，这是一个零依赖的纯 HTTP 服务，职责只有：

- 只从 `dist/` 提供文件，越界路径返回 403；
- 未命中的路径回退到 `dist/index.html`（Vue Router history 模式）；
- 把 `/api`（含 `/api/` 前缀）反向代理到 `LT_SERVER_URL`；
- 把 `/socket.io` 的 WebSocket upgrade 代理到 `LT_SERVER_URL`；
- 给 `dist/assets/` 加 `public, max-age=31536000, immutable`，`index.html` 与 history fallback 用 `no-cache`；
- 附带固定 CSP 与安全响应头。

它不处理 TLS、不压缩、不做负载均衡，对外 HTTPS 必须由反向代理终止。

### 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LT_WEB_HOST` | `0.0.0.0` | 监听地址 |
| `LT_WEB_PORT` | `23310` | 监听端口 |
| `LT_WEB_API_URL` | `/api` | 构建期变量，决定前端请求的 API 前缀 |
| `LT_SERVER_URL` | `http://127.0.0.1:23320` | 运行期代理目标，必须是纯 origin（不允许路径、查询、凭据） |
| `LT_GIT_COMMIT` | 无 | 构建期写入界面的提交号，便于核对版本 |

::: tip
运行期只要 `package.json`、`runtime-config.mjs`、`server.mjs` 和 `dist/`，不需要 `node_modules/`。
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

前端监听 `127.0.0.1` + nginx 反代是常见组合；若前端直接对外，改回 `0.0.0.0`。

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

若 nginx 与前端不在同一台机器，或直接把请求反代到 23320，需要把站点 origin 加进 `server.corsOrigins`，并把 nginx 出口 IP 写进 `server.trustedProxyIps`，详见 [配置参考](./config.md)。

## 开发模式

仓库根目录提供了一条并行启动两个服务的命令：

```bash
npm install          # 根目录，安装 concurrently / husky / lint-staged
npm run dev          # 同时跑 backend tsx watch 与 frontend vite
```

- 后端：`cd backend && npm run dev`，即 `tsx watch src/index.ts`
- 前端：`cd frontend && npm run dev`，即 Vite dev server
- Vite 代理 `/api` 与 `/socket.io` 到 `LT_SERVER_URL`，默认 `http://127.0.0.1:23320`
- Vite 监听端口由 `LT_WEB_PORT` 控制，默认 `23310`

开发模式下前端走 Vite 而不是 `server.mjs`，所以 CSP、缓存头与静态文件行为与生产并不完全一致，验证部署效果请用 `npm run build` + `npm start`。
