---
order: 50
---

# Server API

Server API 指后端挂在 `/api/mc/*` 下的一组接口，供 Minecraft 服务器插件（Paper、Folia、Velocity）或自建服务端程序调用，覆盖注册、绑定、玩家会话以及游戏内的议题读写。它和 Web 端接口共用同一套响应结构，但认证与身份来源完全不同。

## 与 Web 端接口的区别

| 维度 | Web 端接口 | Server API |
| --- | --- | --- |
| 路径前缀 | `/api/auth`、`/api/tickets`、`/api/admin/*` 等 | `/api/mc/*` |
| 认证方式 | `Authorization: Bearer <accessToken>`（JWT） | `X-Server-Key: <apiKey>`，玩家级接口再加 `X-Player-Session` |
| 身份来源 | 登录用户本人 | key 绑定的服务器加上会话对应的 API 账号 |
| 服务器上下文 | 没有 | 由 key 的绑定关系或请求体 `serverId` 解析得出 |
| 玩家写操作 | 用户本人操作 | 必须持有有效的 player session |
| 实时链路 | — | Socket.IO 的 `/mc` 命名空间，见 [WebSocket 连接](../websocket/index.md) |

两类接口的成功响应都包在统一的 envelope 中，错误响应也是：

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "statusCode": 403, "message": "Minecraft player session does not match requested UUID" }
```

`204 No Content` 没有响应体。本组其余页面为了简洁，响应示例只列 envelope 里 `data` 的内容，实际返回会再包一层。

## 基址与路径

- `baseUrl` 配成站点公开 origin，例如 `https://tickets.example.com`，不带 `/api`，也不要带尾斜杠。
- HTTP 接口一律是 `${baseUrl}/api/mc/...`，由后端 `backend/src/routes/mc.ts` 统一挂载。
- 实时通道走 `${baseUrl}/socket.io`，namespace 使用 `/mc`，握手用 `auth.serverKey` 而不是请求头。
- Docker 部署只需公开 Web 容器，Web 容器会把这两类流量转发到内部后端。

```http
POST /api/mc/session HTTP/1.1
Host: tickets.example.com
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid":"<uuid>","playerCredential":"<playerCredential>"}
```

## 认证模型

### server key 类型

key 的类型定义在 `backend/src/constants/server-api-key.ts`，只有两种，绑定关系决定请求怎么定位服务器：

| 类型 | 取值 | 绑定 | 请求要求 |
| --- | --- | --- | --- |
| Paper/Folia | `paper_folia` | 恰好一台服务器 | 直接采用绑定的那台，body 不需要 `serverId` |
| Velocity | `velocity` | 可绑定多台服务器 | 每个请求的 JSON body 必须带 `serverId` |

Velocity 的 `serverId` 是该服务器在服务器管理里的识别 ID；识别 ID 没设置时回退为服务器 ID。值必须与 Velocity 自身注册的后端服务器名一致，否则请求会被拒绝：

```json
{ "serverId": "survival" }
```

`serverId` 缺失返回 401（`请求体缺少 serverId`），key 未授权该服务器同样返回 401（`该 API Key 未授权此服务器`）。服务器解析发生在玩家会话校验之前，因此 `/api/mc/*` 的每个请求都会先定位到唯一一台服务器。

### 玩家 session

玩家级接口要求 `X-Player-Session: <sessionToken>`，token 由 `POST /api/mc/session` 用绑定阶段下发的 `playerCredential` 换取，有效期 5 分钟（`MINECRAFT_PLAYER_SESSION_TTL_MS`，见 `backend/src/constants/minecraft-session.ts`）。

会话记录签发时解析出的服务器，如果后续请求解析到另一台服务器，会话失效并返回 401。后端按会话对应 API 账号的实时角色执行权限判断，不信任请求体里的 UUID，也不信任插件本地的角色缓存。

议题读取类接口采用条件鉴权：没带会话时按匿名访客返回公开议题；管理后台开启「要求登录」后，匿名读取直接 401。写接口一律要求会话。

### 不要求玩家 session 的端点

| 端点 | 原因 |
| --- | --- |
| `POST /api/mc/register-link` | 注册前还没有账号 |
| `POST /api/mc/link-code` | 绑定前还没有账号 |
| `POST /api/mc/session` | 本身就是签发会话 |
| `POST /api/mc/unlink` | 固定拒绝，解绑只在 Web 端 |
| `POST /api/mc/player-group/items` | 上报玩家组名单，只依赖 key |
| `GET /api/templates`、`GET /api/templates/:name` | 全局模板，不属于 `/api/mc`，见 [其他接口与集成注意](./misc.md) |

## 错误与限流

所有请求先经过按 IP 的 global 限流（默认 100 次/60 秒）。挂载了 auth 限流的 MC 端点只有三个，默认 10 次/60 秒，可在管理后台调整：

| 端点 | 额外限流 |
| --- | --- |
| `POST /api/mc/register-link` | auth |
| `POST /api/mc/link-code` | auth |
| `POST /api/mc/player-group/items` | auth |
| 其余 `/api/mc/*` 端点 | 仅 global |

超限返回 429 与 `请求过于频繁，请稍后再试`，响应头带 `RateLimit-Limit`、`RateLimit-Remaining`、`RateLimit-Reset` 和 `Retry-After`（秒）。

有两处 fail-closed 行为需要插件配合处理：

1. 站点地址（管理后台 `siteUrl`）未配置或不合法时，`POST /api/mc/register-link` 返回 400，不会从请求头推导地址，也不会生成链接。
2. 旧版插件、或没有 `playerCredential` 的历史绑定，调用玩家级接口一律失败，必须先由用户在 Web 端解绑后重新绑定。

## 端点总表

| 方法 | 路径 | 玩家 session | 说明 |
| --- | --- | --- | --- |
| POST | `/api/mc/register-link` | 否 | 生成一次性注册链接，见 [注册、绑定与会话](./session.md) |
| POST | `/api/mc/link-code` | 否 | 生成绑定码 |
| POST | `/api/mc/session` | 否 | 用 credential 换 5 分钟会话 |
| POST | `/api/mc/unlink` | 否 | 固定返回 403 |
| POST | `/api/mc/player-group/items` | 否 | 上报玩家名到玩家组，见 [其他接口与集成注意](./misc.md) |
| POST | `/api/mc/tickets` | 必需 | 游戏内创建议题，见 [议题与评论](./tickets.md) |
| GET | `/api/mc/tickets` | 可选 | 议题列表（query 参数） |
| POST | `/api/mc/tickets/search` | 可选 | 议题列表（body 变体，Velocity 用） |
| GET | `/api/mc/tickets/:uuid` | 可选 | 上一版本兼容的列表路径 |
| GET | `/api/mc/tickets/:id/detail` | 可选 | 议题详情 |
| POST | `/api/mc/tickets/:id/detail` | 可选 | 议题详情（body 变体） |
| GET | `/api/mc/tickets/:id/comments` | 可选 | 评论列表 |
| POST | `/api/mc/tickets/:id/comments/list` | 可选 | 评论列表（body 变体） |
| GET | `/api/mc/user/:uuid` | 必需 | 当前绑定的用户信息 |
| POST | `/api/mc/user` | 必需 | 当前绑定的用户信息（body 变体） |
| POST | `/api/mc/comments` | 必需 | 发表评论 |
| POST | `/api/mc/tickets/:id/status` | 必需 | 变更状态 |
| POST | `/api/mc/tickets/:id/close` | 必需 | 关闭议题 |
| POST | `/api/mc/tickets/:id/reopen` | 必需 | 重新打开议题 |
| GET | `/api/templates` | 否 | 模板列表（key 认证，非 `/api/mc`） |
| GET | `/api/templates/:name` | 否 | 模板详情（key 认证，非 `/api/mc`） |
