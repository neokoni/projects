---
order: 30
---

# 议题与评论

本组接口覆盖游戏内创建议题、列表、详情、评论与状态流转。读取类接口采用条件鉴权：不带 `X-Player-Session` 时按匿名访客只返回公开议题，管理后台开启「要求登录」后匿名请求直接 401；写入类接口一律要求有效会话。

所有请求体里的 `minecraftUuid` 必须与会话对应的 UUID 完全一致，不一致返回 403（`Minecraft player session does not match requested UUID`）。响应示例只列 envelope 里的 `data`。

## 创建议题

### POST /api/mc/tickets

需要 `X-Player-Session`。

```http
POST /api/mc/tickets
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json

{
  "minecraftUuid": "<uuid>", "title": "无法进入生存服", "body": "登录后被踢回大厅",
  "template": "bug_report", "formData": {"server": "survival"}, "hidden": false,
  "allowContextView": false,
  "context": {"world": "world", "x": 128, "y": 64, "z": -32, "gameMode": "survival"}
}
```

| 字段 | 类型 | 必填 | 约束与语义 |
| --- | --- | --- | --- |
| `minecraftUuid` | string | 是 | 必须等于会话 UUID |
| `title` | string | 是 | 1 到 200 字符；模板有 `title_prefix` 时会自动加上 |
| `body` | string | 是 | 非空正文 |
| `template` | string | 是 | 已启用的模板名，未知模板返回 400 |
| `formData` | object | 否 | 键值都是字符串，字段由模板声明；下拉框提交实际值 |
| `hidden` | boolean | 否 | 模板 `hidden` 为 `optional` 时必填，缺失返回 400 |
| `allowContextView` | boolean | 否 | 是否允许普通访客查看议题上下文，见下 |
| `context` | object | 否 | `world`、`x`、`y`、`z`、`gameMode`，全部可选 |
| `serverId` | string | Velocity 必填 | 只用于路由到服务器，来源服务器始终取自会话 |

`allowContextView` 按议题存储：设为 `false` 时，普通用户（非工作人员、非作者本人）在 Web 与 `/api/mc` 读取接口中都看不到该议题的世界、坐标、游戏模式与来源服务器；不传或 `true` 保持可见，作者本人与 `staff`、`admin` 始终可见。

响应 201（`author` 与 `labels` 由创建接口一并返回）：

```json
{
  "id": 42, "title": "[Bug] 无法进入生存服", "body": "登录后被踢回大厅",
  "template": "bug_report", "status": "open", "hidden": false, "allowContextView": false,
  "formData": "{\"server\":\"survival\"}",
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",
  "authorId": 7, "serverId": "srv_1", "createdAt": "2026-09-26T12:00:00.000Z",
  "author": {"id": 7, "username": "steve", "minecraftName": "Steve", "deletedAt": null},
  "labels": []
}
```

`formData` 与 `gameContext` 在数据库里是字符串，插件需要自行解析 JSON。

## 读取议题与评论

### GET /api/mc/tickets

`X-Player-Session` 可选（条件鉴权）。

| 查询参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `minecraftUuid` | string | 是 | 与会话 UUID 一致；匿名请求也必须带 |
| `page` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20，上限 100 |
| `statuses` | string | 否 | `open`、`in_progress`、`closed`、`invalid`，可单值、逗号分隔或多值参数 |
| `type` | string | 否 | 模板名 |
| `authorName` | string | 否 | 按作者用户名模糊匹配 |
| `serverName` | string | 否 | 按服务器 ID 或别名匹配 |
| `hasServer` | `true`/`false` | 否 | 是否有来源服务器 |
| `search` | string | 否 | 匹配标题与正文 |

```json
{"tickets": [], "total": 0, "page": 1, "pageSize": 20}
```

列表不按服务器隔离：匿名访客只看到公开议题，普通玩家额外看到自己创建的隐藏议题，`staff`、`admin` 看到平台全部议题。

### POST /api/mc/tickets/search

查询参数不变，改为放在 JSON body 里，并额外接受 `serverId`。这是 Velocity 的必需路径：GET 请求没有 body，无法携带 `serverId`，所以查询类接口都提供 body 变体；GET 端点保留给 Paper/Folia 与旧版插件。

```http
POST /api/mc/tickets/search
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid": "<uuid>", "serverId": "survival", "statuses": "open,closed", "search": "登录"}
```

### GET /api/mc/tickets/:id/detail

`X-Player-Session` 可选。`:id` 必须是正整数，否则返回 400（`无效的 ID`）；议题不可见时返回 404。Velocity 使用 body 变体 `POST /api/mc/tickets/:id/detail`，body 为 `{"minecraftUuid":"<uuid>","serverId":"survival"}`。

查询参数只有 `minecraftUuid`（必填）。返回议题本体，外加 `author`、`assignees`、`labels`、`server`；调用方是 `staff`、`admin` 时还会带 `completionHooks` 与 `hookDeliveries`。

```json
{
  "id": 42, "title": "[Bug] 无法进入生存服", "status": "open",
  "gameContext": "{\"world\":\"world\",\"x\":128}",
  "author": {"id": 7, "username": "steve", "minecraftName": "Steve", "deletedAt": null},
  "server": {"id": "srv_1", "name": "survival", "alias": "生存服"},
  "labels": [], "assignees": []
}
```

### GET /api/mc/tickets/:id/comments

`X-Player-Session` 可选，查询参数 `minecraftUuid` 必填。Velocity 使用 `POST /api/mc/tickets/:id/comments/list`，同参数放 body。返回按创建时间升序的评论数组：

```json
[
  {
    "id": "0c4b6f3a-1f4b-4a3e-9a44-1f1f0f6f9a11",
    "ticketId": 42,
    "body": "已收到，稍后处理",
    "source": "minecraft",
    "authorId": 3,
    "createdAt": "2026-09-26T12:10:00.000Z",
    "author": {"id": 3, "username": "admin", "minecraftName": "Admin", "avatarUrl": null, "deletedAt": null}
  }
]
```

### GET /api/mc/tickets/:uuid

上一版本插件使用的兼容路径：把路径里的 `:uuid` 当作 `minecraftUuid`，只解析 `page` 与 `pageSize`，无法传其他过滤条件。新集成请改用 `GET /api/mc/tickets` 或 `POST /api/mc/tickets/search`。

## 写评论与状态

### POST /api/mc/comments

需要会话。`ticketId` 是数字，允许以字符串形式提交（自动转换）。响应 201，`source` 为 `minecraft`。

```http
POST /api/mc/comments
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json

{"minecraftUuid": "<uuid>", "ticketId": 42, "body": "补充：换世界后仍复现"}
```

### POST /api/mc/tickets/:id/status

需要会话，body 为 `minecraftUuid` 加 `status`（`open`、`in_progress`、`closed`、`invalid`）。响应是更新后的议题对象。

```http
POST /api/mc/tickets/42/status
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json

{"minecraftUuid": "<uuid>", "status": "closed"}
```

权限规则：普通玩家只能操作自己创建的议题，且只能走下列状态迁移；`staff`、`admin` 可操作平台全部议题并设置任意状态。越权返回 403，议题不存在或不可见返回 404。

| 当前状态 | 目标状态 | 允许的操作者 |
| --- | --- | --- |
| `open`、`in_progress` | `closed` | 作者、`staff`、`admin` |
| `closed` | `open` | 作者、`staff`、`admin` |
| `invalid` | `open` | 仅 `staff`、`admin` |
| 其他组合 | — | 403 |

### POST /api/mc/tickets/:id/close

需要会话，body 只有 `minecraftUuid`。仅 `open` 与 `in_progress` 可关闭，否则 403（`只有开放或处理中的议题可以关闭`）；权限与状态接口一致。响应为更新后的议题，`closedAt` 同时被写入；同一议题被并发修改时可能返回 409（`议题状态已被其他请求修改`），重新读取后再决定是否重试。

### POST /api/mc/tickets/:id/reopen

需要会话，body 只有 `minecraftUuid`。仅 `closed` 可重新打开（`invalid` 只有 `staff`、`admin` 能重开），否则 403（`只有已关闭的议题可以重新打开`）。响应为更新后的议题，`closedAt` 清空。

## 用户信息

### GET /api/mc/user/:uuid

需要会话，路径 UUID 必须与会话 UUID 一致，否则 403。返回该 API 账号的公开资料，账号已解绑时 404。

```json
{
  "id": 7, "email": "steve@example.com",
  "username": "steve",
  "minecraftUuid": "<uuid>",
  "minecraftName": "Steve",
  "role": "player",
  "avatarUrl": null,
  "createdAt": "2026-05-01T08:00:00.000Z",
  "receiveEmailNotifications": true, "deletedAt": null
}
```

Velocity 使用 `POST /api/mc/user`，body 为 `{"minecraftUuid":"<uuid>","serverId":"survival"}`，其余行为相同。
