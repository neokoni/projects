---
order: 10
---

# 部署指南

本节说明如何把 LightTickets 从零跑起来：Docker Compose 一键部署、手动部署、Minecraft 插件接入，以及配置、运维与升级的要点。

## 组件构成

LightTickets 由三部分组成，其中后端是唯一持有数据的服务。

| 组件 | 作用 | 默认端口 | 来源目录 |
| --- | --- | --- | --- |
| 后端（server） | HTTP API、WebSocket、数据库与附件存储、setup 向导 | 23320 | `backend/` |
| 前端（web） | 浏览器界面，同时把 `/api` 与 `/socket.io` 反代到后端 | 23310 | `frontend/` |
| 插件 | 在游戏内创建与查询议题、绑定玩家 | 无（客户端） | `plugin/` |
| 数据库 | SQLite（默认，`data/data.db`）或 MySQL | MySQL 默认 3306 | 由 setup 选择 |

## 端口

| 端口 | 服务 | 环境变量 | 是否需要对外暴露 |
| --- | --- | --- | --- |
| 23310 | 前端 `server.mjs` | `LT_WEB_PORT` | 是，浏览器入口 |
| 23320 | 后端 API | `LT_SERVER_PORT` | 通常否，由前端或反代转发 |
| 3306 | MySQL | `database.port` | 否 |

后端端口不对外暴露的前提是前端代理链路正常；若你让浏览器直连后端，就必须配置 `server.corsOrigins`。

## 两种部署方式

| 对比项 | Docker Compose | 手动部署 |
| --- | --- | --- |
| 适用场景 | 推荐，生产与快速试用 | 无 Docker 环境、需要自定义进程管理 |
| 依赖 | Docker、Docker Compose | Node 24、npm、openssl |
| Node 版本管理 | 由镜像内固定 | 由你负责 |
| 端口与变量 | `docker-compose.yml` 是唯一来源 | 由 systemd 或 shell 环境提供 |
| 升级方式 | `docker compose up --build -d` | 重新 `npm install && npm run build` |
| 数据位置 | 宿主机 `./data` 挂载到 `/app/data` | `LT_SERVER_DATA_DIR` 指定 |

- [Docker Compose 部署](./docker.md)
- [手动部署](./manual.md)

## 请求链路

```text
浏览器
  │  http://<站点域名>/
  ▼
前端 server.mjs  (23310)
  ├─ GET / · /assets/*        → dist/ 静态文件（history fallback 到 index.html）
  ├─ /api/*                   → 反向代理 ─┐
  └─ /socket.io/* (WebSocket) → 反向代理 ─┤
                                          ▼
                                后端 API (23320)
                                   ├─ SQLite  data/data.db
                                   ├─ MySQL   host:port/database
                                   └─ 附件    data/uploads 或 S3

Minecraft 服务器插件 ──(WebSocket + REST，baseUrl)──▶ 后端 API (23320)
```

要点：前端 `server.mjs` 是纯 HTTP 实现，只服务 `dist/` 并转发路径，不处理 TLS。对外 HTTPS 必须由 nginx、Caddy 等反向代理终止，再由反代转发到 23310。

## 数据目录

后端的数据目录由 `LT_SERVER_DATA_DIR` 决定，默认是相对工作目录的 `data`（容器内为 `/app/data`）。

| 路径 | 内容 |
| --- | --- |
| `data/config.yml` | 平台基础配置，权限 `0600`，不通过任何 API 返回 |
| `data/data.db` | SQLite 数据库文件，仅当 `database.provider` 为 `sqlite` 时存在 |
| `data/prisma/` | 生成的 schema 与迁移文件 |
| `data/templates/` | 议题模板（template） |
| `data/.templates_initialized` | 模板初始化标记 |
| `data/locales/` | 界面语言文件 |
| `data/uploads/` | 本地存储驱动的附件目录（默认 `data/uploads`） |
| `data/favicon.*`、`data/favicon-dark.*` | 站点图标（branding） |
| `data/logo.*`、`data/logo-dark.*` | 站点 Logo（branding） |

升级、迁移与排障前请整体备份这个目录，细节见 [运维与升级](./operations.md)。

## 首次启动：setup 向导

首次启动时 `data/config.yml` 不存在，前端请求 `GET /api/setup/site-config` 拿到的 `isSetup` 为 `false`，界面会自动进入 setup 向导。此阶段后端只提供 setup 相关服务。

向导共 6 步：

1. 欢迎页
2. 数据库（SQLite 或 MySQL）
3. 存储（本地目录或 S3）
4. 管理员账户
5. 站点设置（站点名称、公开地址、CORS 来源等）
6. Minecraft 服务器（可选，为插件预置服务器条目）

提交后后端把配置写入 `config.yml.setup`（权限 `0600`），执行数据库迁移，在同一事务内创建管理员与站点配置，最后重命名为 `config.yml` 并重新加载。此后 `isSetup` 变为 `true`，页面进入正常登录流程。

::: tip
`server.corsOrigins` 与反向代理信任设置在 setup 之后没有后台修改入口，只能手改 `config.yml` 后重启后端。
:::

## 健康检查

```bash
curl http://127.0.0.1:23320/api/health
```

返回：

```json
{ "status": "ok" }
```

该端点不包裹统一响应信封，也不做鉴权，适合给容器 healthcheck、进程守护或外部探活使用。前端容器则直接请求 `/` 判断静态资源是否可服务。

## 本节导航

- [Docker Compose 部署](./docker.md)：推荐的部署方式与反向代理配置
- [手动部署](./manual.md)：Node 进程、systemd 与开发模式
- [Minecraft 插件部署](./plugin.md)：插件安装、配置字段与权限节点
- [配置参考](./config.md)：`config.yml` 与数据库内配置项
- [运维与升级](./operations.md)：备份、迁移、升级顺序与排障
