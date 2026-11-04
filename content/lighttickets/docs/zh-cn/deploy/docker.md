---
order: 20
---

# Docker Compose 部署

## 部署架构

```text
宿主机
  └─ docker network: lighttickets (bridge)
       ├─ lighttickets-server   后端 23320（不发布端口）
       │     └─ volume: ./data → /app/data
       └─ lighttickets-web      前端 23310（发布 23310:23310）
             └─ LT_SERVER_URL=http://lighttickets-server:23320
```

浏览器仅访问前端端口，`/api` 与 `/socket.io` 由前端转发至同一网络内的 `lighttickets-server`。

## docker-compose.yml

```yaml
services:
  server:
    container_name: lighttickets-server
    image: lighttickets-server:latest
    build: ./backend
    restart: unless-stopped
    environment:
      LT_SERVER_PORT: 23320
    volumes:
      - ./data:/app/data
    networks:
      - lighttickets

  web:
    container_name: lighttickets-web
    image: lighttickets-web:latest
    build: ./frontend
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
    environment:
      LT_WEB_PORT: 23310
      LT_SERVER_URL: "http://lighttickets-server:23320"
    ports:
      - 23310:23310
    networks:
      - lighttickets

networks:
  lighttickets:
    name: lighttickets
    driver: bridge
```

## 配置项说明

| 配置项 | 说明 |
| --- | --- |
| `build: ./backend` | 以 `backend/Dockerfile` 构建，采用多阶段：构建阶段执行 `npm install` 与 `npm run build`，运行阶段仅复制 `dist/` 并执行 `npm install --omit=dev` |
| `build: ./frontend` | 以 `frontend/Dockerfile` 构建，构建参数为 `LT_WEB_API_URL=/api`，运行阶段以 `USER node` 启动 `node server.mjs` |
| `LT_SERVER_PORT: 23320` | 后端监听端口；镜像默认值同为 23320 |
| `LT_WEB_PORT: 23310` | 前端监听端口，须与 `ports` 右侧一致 |
| `LT_SERVER_URL` | 前端代理目标，须为纯 origin（不带路径、查询、凭据），此处指向容器名，不指向 `127.0.0.1` |
| `volumes: ./data:/app/data` | 唯一持久化位置；删除容器不丢失数据，删除该目录将丢失全部数据 |
| `ports: 23310:23310` | 仅发布前端；后端端口保留于内部网络 |
| `depends_on ... service_healthy` | 后端 healthcheck（`/api/health`，`start-period` 20s）通过后再启动前端 |
| `networks` | 自定义 bridge 网络 `lighttickets`，使 `lighttickets-server` 这一名称可解析 |

::: warning
compose 与环境仅暴露一个对外的站点入口。若将 23320 一并发布至公网，用户可绕过前端直连 API，此时须配置 `server.corsOrigins` 并自行处理 TLS。
:::

## 常用命令

```bash
# 构建并后台启动
docker compose up --build -d

# 查看状态与健康
docker compose ps

# 跟踪日志
docker compose logs -f

# 只跟踪后端
docker compose logs -f server

# 停止并移除容器（./data 保留）
docker compose down

# 升级：先备份 data/，再重建
docker compose up --build -d
```

首次启动后打开 `http://<宿主机>:23310/`；若 `data/config.yml` 不存在，将自动进入 setup 向导。

## 端口修改

端口涉及三处，须同步修改：

1. `services.server.environment.LT_SERVER_PORT`
2. `services.web.environment.LT_SERVER_URL`（端口部分须与上一项一致）
3. `services.web.ports` 的左右两侧

```yaml
    environment:
      LT_WEB_PORT: 23310
      LT_SERVER_URL: "http://lighttickets-server:24000"
    ports:
      - 8080:23310
```

左侧 `8080` 为宿主机端口，右侧须等于 `LT_WEB_PORT`。修改后执行 `docker compose up -d` 重建容器。

::: tip
仓库根目录的 `.env.example` 仅列出 `LT_WEB_PORT` 与 `LT_SERVER_PORT` 供参考，compose 文件中已固定变量值。compose 为唯一来源，修改 `.env` 不会覆盖 compose 中显式声明的 `environment`。
:::

## 镜像构建

不使用 compose 时，可直接构建镜像：

```bash
docker build -t lighttickets-server:latest ./backend
docker build -t lighttickets-web:latest \
  --build-arg LT_WEB_API_URL=/api \
  --build-arg LT_GIT_COMMIT=$(git rev-parse --short HEAD) \
  ./frontend
```

两个镜像的 `ARG NODE_VERSION` 默认值均为 `24`，可用 `--build-arg NODE_VERSION=26` 覆盖。

## 反向代理（nginx）

对外提供 HTTPS 时，在宿主机 nginx 上终止 TLS，再转发至 23310。WebSocket 须显式升级；未显式升级时，游戏内实时推送与页面通知将失效。

```nginx
server {
    listen 443 ssl;
    server_name tickets.example.com;

    ssl_certificate     /etc/nginx/certs/tickets.pem;
    ssl_certificate_key /etc/nginx/certs/tickets.key;

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

建议在 `/api` 保留 `proxy_http_version 1.1;`，与前端代理行为保持一致。附件上传经由 `/api`，注意放开 `client_max_body_size`。

## CORS 与可信代理

浏览器同源访问（反向代理将 `/`、`/api`、`/socket.io` 均指向 23310）时无需额外配置。以下情形须将站点公开 origin 写入 `server.corsOrigins`：

- 浏览器直连 23320；
- 前端与后端分属不同域名。

该配置**没有后台修改接口**，仅可在 setup 向导中填写，或手动编辑 `data/config.yml` 后重启后端：

```yaml
server:
  corsOrigins:
    - https://tickets.example.com
```

经反向代理部署后，须将反向代理 IP 写入 `server.trustedProxyIps`；未写入时，限流会将所有请求按代理 IP 计数。详见 [配置参考](./config.md) 与 [运维与升级](./operations.md)。

## 备份与权限

升级前先备份数据目录：

```bash
docker compose down
sudo tar -czf lighttickets-data-$(date +%F).tar.gz -C . data
docker compose up --build -d
```

数据库文件不处于写入中途时，可在运行中备份；SQLite 场景建议先执行 `down` 再打包。

卷权限方面：后端镜像未声明 `USER`，容器以 root 运行，因此 `./data` 内由容器创建的文件属主为 root。若需手动放入文件（例如从备份恢复），须保证容器内进程可读写：

```bash
sudo chown -R 0:0 ./data
```

`./data` 为 bind mount，不得在宿主机上改为其他用户独占；否则后端写入 `config.yml`（权限 `0600`）或附件时将失败。更多排障见 [运维与升级](./operations.md)。
