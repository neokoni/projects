# LightTickets

LightTickets 为一套前后端分离的轻量工单系统：浏览器端提供议题列表、议题创建、议题详情与管理后台，后端提供 REST API 与 Socket.IO 推送，官方 Minecraft 插件供玩家在游戏内提交与跟进议题。系统自带完整的 API，可用于独立工单站，也可作为其他系统的工单后端。

::: warning
LightTickets 目前处于 WIP 阶段，接口、配置项与数据结构仍可能变动。升级前建议备份 `data/` 目录与数据库。
:::

## 功能范围

| 领域 | 能力 |
| --- | --- |
| 议题 | 模板驱动的动态表单、状态机（`open` / `in_progress` / `closed` / `invalid`）、公开或隐藏、游戏内上下文（世界/坐标/游戏模式） |
| 协作 | Markdown 评论与回复、附件上传（本地磁盘或 S3）、标签、指派、延迟合并的审计日志 |
| 自动化 | 完成钩子：状态变更时将结构化数据推送至 Minecraft 服务器并回收执行结果，失败时自动重试 |
| 账户 | 邮箱验证码注册、JWT 登录（refresh token 走 HttpOnly Cookie）、密码重置、外部登录（OAuth / OIDC）、通知开关 |
| 多语言 | 内置 `zh-CN` / `en-US`，支持在数据目录放置自定义语言包，用户偏好存储于 Cookie |
| 集成 | Web API（Bearer JWT）、Server API（`X-Server-Key`）、Socket.IO 实时推送 |
| 管理 | 站点设置、模板、标签、服务器与 API Key、玩家组、用户、存储、SMTP、Turnstile、限流、审计日志 |
| Minecraft | 游戏内创建/查询/评论议题、账号绑定、状态变更与新评论的实时通知 |

## 组成

| 部分 | 技术栈 | 说明 |
| --- | --- | --- |
| `backend` | Node.js + Express + Prisma + Socket.IO + zod | REST API、鉴权、附件存储、邮件、钩子投递；数据库支持 SQLite 与 MySQL |
| `frontend` | Vue 3 + Vue Router + Pinia + Tailwind CSS + Vite | 单页应用；生产环境由零依赖的 `server.mjs` 托管静态产物并代理 `/api`、`/socket.io` |
| `plugin` | Java + Gradle 多模块 | `paper`（Paper/Folia）与 `velocity`（Velocity 代理）两个平台实现，共用 `common` 模块 |
| 数据库 | Prisma 迁移（SQLite / MySQL 两套目录） | 议题、评论、附件、账户、服务器、审计等全部业务数据 |

## 请求链路

```text
                     ┌──────────────────────────────┐
  浏览器 ──────────▶ │ frontend (server.mjs, 23310) │
                     └──────────────┬───────────────┘
                                    │ /api、/socket.io 反向代理
                                    ▼
                     ┌──────────────────────────────┐       ┌──────────────┐
  Minecraft 插件 ───▶│ backend (Express, 23320)     │──────▶│ SQLite/MySQL │
  (HTTP + Socket.IO) │ REST + Socket.IO /mc 命名空间│       └──────────────┘
                     └──────────────┬───────────────┘
                                    │ 附件
                                    ▼
                          本地磁盘 / S3 对象存储
```

后端仅需被前端与插件访问，对外暴露的端口通常为前端端口。

插件通过 HTTP（`/api/mc/*`）读取与提交数据，并保持一条通往 `/mc` 命名空间的 Socket.IO 长连接，用于接收状态变更、新评论与钩子投递。

## 文档索引

| 章节 | 内容 |
| --- | --- |
| [部署指南](./deploy/index.md) | 架构与端口、Docker Compose、手动部署、Minecraft 插件部署、配置参考、运维与升级 |
| [使用指南](./guide/index.md) | 角色与权限、账户与登录、议题、评论与附件、游戏内使用、管理后台 |
| [多语言](./i18n/index.md) | 语言的生效方式、新增语言、覆盖内置文案 |
| [议题模板](./template/index.md) | 模板结构、字段类型、完成钩子、完整示例 |
| [外部 API](./api/index.md) | Web 端 REST API：约定、认证与账户、议题、模板、管理后台、OpenAPI |
| [Server API](./server-api/index.md) | 插件侧的 `/api/mc/*` 接口：鉴权模型、注册与会话、议题与评论、其他接口 |
| [WebSocket](./websocket/index.md) | `/socket.io` 的 `/mc` 命名空间：连接方式、推送事件、完成钩子投递与回执 |

## 相关链接

- 源码仓库：<https://github.com/neokoni/LightTickets>
- 发行版：<https://github.com/neokoni/LightTickets/releases>
- 开发构建（GitHub Actions 产物）：<https://github.com/neokoni/LightTickets/actions>
