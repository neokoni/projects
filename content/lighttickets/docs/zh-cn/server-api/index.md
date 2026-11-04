---
order: 60
---

# Server API

## 与 Web 端接口的区别

| 维度 | Web 端接口 | Server API |
| --- | --- | --- |
| 路径前缀 | `/api/auth`、`/api/tickets`、`/api/admin/*` 等 | `/api/mc/*` |
| 认证方式 | `Authorization: Bearer <accessToken>`（JWT） | `X-Server-Key: <apiKey>`，玩家级接口另加 `X-Player-Session` |
| 身份来源 | 登录用户本人 | key 绑定的服务器以及会话对应的 API 账号 |
| 服务器上下文 | 无 | 由 key 的绑定关系或请求体 `serverId` 解析得出 |
| 玩家写操作 | 用户本人操作 | 须持有有效的 player session |
| 实时链路 | — | Socket.IO 的 `/mc` 命名空间，见 [WebSocket 连接](../websocket/index.md) |

两类接口的成功响应与错误响应均封装在统一的 envelope 中：

```jsonc
// 成功
{
  "success": true,    // boolean，成功时为 true
  "data": {}          // object，业务数据，各接口的 data 结构见对应页面
}
```

失败时返回：

```jsonc
// 403
{
  "success": false,   // boolean，失败时为 false
  "statusCode": 403,  // number，HTTP 状态码
  "message": "Minecraft player session does not match requested UUID" // string，错误文案
}
```

`204 No Content` 无响应体。本组其余页面的响应示例仅列 envelope 中 `data` 的内容，实际响应将在此之外再封装一层。

## 基址与路径

- `baseUrl` 为站点公开 origin，例如 `https://tickets.example.com`，不带 `/api`，也不带尾斜杠。
- HTTP 接口均为 `${baseUrl}/api/mc/...`，由后端 `backend/src/routes/mc.ts` 统一挂载。
- 实时通道为 `${baseUrl}/socket.io`，namespace 使用 `/mc`，握手使用 `auth.serverKey`，不使用请求头。
- Docker 部署仅需公开 Web 容器，由 Web 容器将这两类流量转发到内部后端。

```http
POST /api/mc/session HTTP/1.1
Host: tickets.example.com
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",                // string，必填，合法 UUID
  "playerCredential": "<playerCredential>"  // string，必填，绑定阶段下发的凭证
}
```

## 认证模型

### server key 类型

key 的类型定义在 `backend/src/constants/server-api-key.ts`，仅两种，绑定关系决定请求定位服务器的方式：

| 类型 | 取值 | 绑定 | 请求要求 |
| --- | --- | --- | --- |
| Paper/Folia | `paper_folia` | 恰好一台服务器 | 直接采用绑定的服务器，body 不要求 `serverId` |
| Velocity | `velocity` | 可绑定多台服务器 | 每个请求的 JSON body 须带 `serverId` |

Velocity 的 `serverId` 为该服务器在服务器管理中的识别 ID；识别 ID 未设置时回退为服务器 ID。该值须与 Velocity 注册的后端服务器名一致，否则请求将被拒绝：

```jsonc
{
  "serverId": "survival"  // string，Velocity 必填，服务器识别 ID，须与 Velocity 注册的后端服务器名一致
}
```

`serverId` 缺失返回 401（`请求体缺少 serverId`），key 未授权该服务器同样返回 401（`该 API Key 未授权此服务器`）。服务器解析先于玩家会话校验执行，因此 `/api/mc/*` 的每个请求均先定位到唯一一台服务器。

### 玩家 session

玩家级接口要求 `X-Player-Session: <sessionToken>`，token 由 `POST /api/mc/session` 以绑定阶段下发的 `playerCredential` 换取，有效期为 5 分钟（`MINECRAFT_PLAYER_SESSION_TTL_MS`，见 `backend/src/constants/minecraft-session.ts`）。

会话记录保存签发时解析出的服务器；后续请求解析到另一台服务器时，会话失效并返回 401。后端按会话对应 API 账号的实时角色执行权限判断，不信任请求体中的 UUID，也不信任插件本地的角色缓存。

议题读取类接口采用条件鉴权：未携带会话时按匿名访客返回公开议题；管理后台开启「要求登录」后，匿名读取直接返回 401。写接口一律要求会话。

### 不要求玩家 session 的端点

| 端点 | 原因 |
| --- | --- |
| `POST /api/mc/register-link` | 注册前尚无账号 |
| `POST /api/mc/link-code` | 绑定前尚无账号 |
| `POST /api/mc/session` | 该端点即签发会话 |
| `POST /api/mc/unlink` | 固定拒绝，解绑仅在 Web 端进行 |
| `POST /api/mc/player-group/items` | 上报玩家组名单，仅依赖 key |
| `GET /api/templates`、`GET /api/templates/:name` | 全局模板，不属于 `/api/mc`，见 [其他接口与集成注意](./misc.md) |

## 错误与限流

所有请求先经过按 IP 的 global 限流（默认 100 次/60 秒）。挂载 auth 限流的 MC 端点仅三个，默认 10 次/60 秒，可在管理后台调整：

| 端点 | 额外限流 |
| --- | --- |
| `POST /api/mc/register-link` | auth |
| `POST /api/mc/link-code` | auth |
| `POST /api/mc/player-group/items` | auth |
| 其余 `/api/mc/*` 端点 | 仅 global |

超限返回 429 与 `请求过于频繁，请稍后再试`，响应头包含 `RateLimit-Limit`、`RateLimit-Remaining`、`RateLimit-Reset` 和 `Retry-After`（秒）。

插件须配合处理以下两处 fail-closed 行为：

1. 站点地址（管理后台 `siteUrl`）未配置或不合法时，`POST /api/mc/register-link` 返回 400，不从请求头推导地址，也不生成链接。
2. 旧版插件或无 `playerCredential` 的历史绑定调用玩家级接口一律失败，须由用户在 Web 端解绑后重新绑定。

## 端点总表

| 方法 | 路径 | 玩家 session | 说明 |
| --- | --- | --- | --- |
| POST | `/api/mc/register-link` | 否 | 生成一次性注册链接，见 [注册、绑定与会话](./session.md) |
| POST | `/api/mc/link-code` | 否 | 生成绑定码 |
| POST | `/api/mc/session` | 否 | 以 credential 换取 5 分钟会话 |
| POST | `/api/mc/unlink` | 否 | 固定返回 403 |
| POST | `/api/mc/player-group/items` | 否 | 上报玩家名到玩家组，见 [其他接口与集成注意](./misc.md) |
| POST | `/api/mc/tickets` | 必需 | 游戏内创建议题，见 [议题与评论](./tickets.md) |
| GET | `/api/mc/tickets` | 可选 | 议题列表（query 参数） |
| POST | `/api/mc/tickets/search` | 可选 | 议题列表（body 变体，供 Velocity 使用） |
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
