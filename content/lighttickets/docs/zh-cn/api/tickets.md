---
order: 30
---

# 议题、评论与附件

## 议题

### POST /api/tickets

需要认证，创建成功返回 `201` 与议题详情。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 1-200 字符 |
| `template` | string | 是 | 模板名，取自 `GET /api/templates` |
| `formData` | object | 是 | 严格按模板声明提交，未知字段、缺失必填、非法选项都会被拒绝 |
| `serverId` | string | 否 | 仅 `staff` / `admin` 可用，普通用户提交返回 `403` |
| `attachmentIds` | string[] | 否 | 预上传附件 UUID，只能认领自己所有且仍为 `pending` 的附件 |
| `hidden` | boolean | 按模板策略 | 模板策略为 `optional` 时必填，否则由后端强制 |

```http
POST /api/tickets
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "服务器登不上",
  "template": "bug_report",
  "formData": { "description": "连接超时", "reproduce": "重启后必现" },
  "attachmentIds": ["0f7d1c8e-3b2a-4c5d-9e6f-1a2b3c4d5e6f"],
  "hidden": true
}
```

`formData` 中的 dropdown 使用 `显示文本|实际值` 时提交实际值；旧客户端提交整条选项也会被归一化为实际值。

- `400`：模板不存在、字段校验失败、附件已被认领或过期。
- `403`：普通用户指定 `serverId`、模板策略禁止该操作。
- `404`：模板不存在。

### GET /api/tickets

可选认证。未登录只返回公开议题；普通用户额外可见自己创建的隐藏议题；`staff` / `admin` 可见全部。

| 查询参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` / `pageSize` | integer | 分页，默认 `1` / `20`，`pageSize` 最大 100 |
| `statuses` | string | 逗号分隔或多值，例如 `open,in_progress` |
| `type` | string | 模板名 |
| `authorId` | integer | 作者用户 ID |
| `authorName` | string | 作者用户名 |
| `serverId` | string | 来源服务器标识 |
| `serverName` | string | 精确匹配 Minecraft 服务器名 |
| `hasServer` | `true` \| `false` | 是否带服务器上下文 |
| `labelId` | string | 标签标识符 |
| `search` | string | 标题与正文全文搜索 |

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": 12,
        "title": "服务器登不上",
        "status": "open",
        "hidden": false,
        "template": "bug_report",
        "author": { "id": 3, "username": "player" },
        "labels": [{ "id": "bug", "name": "缺陷", "color": "#ef4444" }],
        "server": { "id": "survival", "name": "生存服", "alias": null }
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### GET /api/tickets/:id

可选认证，返回议题详情。隐藏议题对无权用户返回 `404`，该规则同样适用于评论、审计与附件读取。

详情额外字段：

| 字段 | 说明 |
| --- | --- |
| `gameContext` | 世界、坐标、游戏模式等游戏内上下文；受议题 `allowContextView` 控制，不可见时为 `null` |
| `server` | 来源服务器 `{ id, name, alias }`，同样受上下文可见性控制 |
| `author` / `assignees` | 作者与受理人简要信息 |
| `labels` | 关联标签 |
| `completionHooks` | 仅 `staff` / `admin` 返回完整决策选项（`pending` / `completed` / `skipped`） |
| `hookDeliveries` | 仅 `staff` / `admin` 返回，Minecraft 钩子投递结果 |

普通用户与未登录用户只会收到已完成且 `visibility` 为 `public` 的结果卡片，`staff` 结果与待决策字段不会公开。

### PATCH /api/tickets/:id

需要认证。请求体是严格对象，只接受 `status` 与 `hidden`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `status` | `open` / `in_progress` / `closed` / `invalid` | 否 | 目标状态 |
| `hidden` | boolean | 否 | 仅 `staff` / `admin` 可修改，写入审计日志 |

```json
{ "status": "in_progress", "hidden": false }
```

- 普通作者可在规则内切换自己议题的状态，但提交 `hidden` 返回 `403`。
- 状态迁移使用旧状态条件更新，并发请求未取得迁移权时返回 `409`，不会重复写审计或触发钩子。
- 目标状态包含 Minecraft console command 钩子时必须由 `staff` / `admin` 操作，普通作者返回 `403`。
- `400`：状态值非法或请求体含未知字段。

### PATCH /api/tickets/:id/body

需要认证，请求体 `{ "body": "新的正文" }`，`body` 不能为空。

### PATCH /api/tickets/:id/title

需要认证，请求体 `{ "title": "新标题" }`，1-200 字符。

### POST /api/tickets/:id/close

需要认证，将议题置为 `closed`。同一议题只在第一次匹配到决策配置时创建一组执行选项；重开后再次关闭不会重建或重新执行决策。

### POST /api/tickets/:id/reopen

需要认证，将议题重新置为 `open`。`409` 表示并发迁移失败或议题当前状态不允许重开。

### POST /api/tickets/:id/completion-hooks/:hookId/complete

需要 `staff`。请求体按字段类型提交值，文本字段用字符串，`checkboxes` 用字符串数组：

```json
{ "values": { "rewards": ["金币", "物品"], "note": "已发放" } }
```

后端按模板快照校验必填项与预设选项，原子标记为 `completed` 并记录操作人，再按配置顺序下发动作。已完成记录重复提交返回 `409`，不会重复下发。

### POST /api/tickets/:id/completion-hooks/:hookId/skip

需要 `staff`。把待处理记录标记为 `skipped`，表示「本次不做决策」：不提交字段、不执行动作，但会写一条审计日志。已处理记录再次操作返回 `409`。

### PUT /api/tickets/:id/assignees

需要 `staff` 或 `admin`，整体覆盖受理人：

```json
{ "assigneeIds": [2, 3] }
```

数组中的用户必须全部存在且角色为 `staff` / `admin`；含不存在用户、普通用户或重复 ID 时返回 `400`，且不会部分修改。空数组用于清空。新增受理人会收到分配提醒邮件（操作者本人除外）。

### POST /api/tickets/:id/labels

需要 `staff`，请求体 `{ "labelId": "bug" }`，成功返回 `201` 无响应体。标签不存在返回 `404`，重复关联返回 `409`。

### DELETE /api/tickets/:id/labels/:labelId

需要 `staff`，解除关联，成功返回 `204`。

## 评论

评论挂载在 `/api/tickets/:id/comments` 下。

### GET /api/tickets/:id/comments

可选认证，返回评论数组（不分页），按时间正序。议题不可见时返回 `404`。

### POST /api/tickets/:id/comments

需要认证，请求体 `{ "body": "评论内容" }`，成功返回 `201` 与新评论对象。

```json
{
  "success": true,
  "data": {
    "id": "8f3e1a20-1111-4222-8333-444455556666",
    "ticketId": 12,
    "body": "已复现，正在排查。",
    "source": "web",
    "author": { "id": 3, "username": "player" },
    "createdAt": "2026-10-28T09:12:00.000Z"
  }
}
```

`400` 表示正文为空，`404` 表示议题不存在或当前用户不可见。

### PATCH /api/tickets/:id/comments/:commentId/body

需要认证，请求体 `{ "body": "修改后的内容" }`。仅作者或 `staff` / `admin` 可编辑，否则 `403`。

### DELETE /api/tickets/:id/comments/:commentId

需要认证，作者或 `staff` / `admin` 可删除，返回 `204`。删除前会清理该评论附件的物理文件。

## 附件

### POST /api/attachments/upload

需要认证，`multipart/form-data`，成功返回 `201` 与附件记录。

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `file` | form | file | 是 | 文件本身，先校验 mimetype 白名单，再做 magic bytes 二次校验 |
| `ticketId` | form | integer | 否 | 正整数，直接挂到议题 |
| `commentId` | form | uuid | 否 | 直接挂到评论 |

`ticketId` 与 `commentId` 不能同时提供。二者都不传时创建一条归当前用户所有的预上传记录，之后通过 `attachmentIds` 在创建议题时认领。

```json
{
  "success": true,
  "data": {
    "id": "1b7c2d3e-4f50-4a61-8273-9a0b1c2d3e4f",
    "filename": "error.log",
    "mimeType": "text/plain",
    "size": 20480,
    "storageType": "local",
    "status": "pending",
    "expiresAt": "2026-11-04T09:12:00.000Z"
  }
}
```

未关联附件只按容量配额限制，不限制数量：默认 50 MiB，默认 7 天过期（管理员可调）。`400` 表示未选文件或类型不合法，`403` 表示无权向该议题/评论追加附件，`429` 表示超出配额。

### GET /api/attachments/:id

可选认证。本地存储直接返回文件流；S3 存储返回 `302` 预签名 URL。无权访问时返回 `404`。

### DELETE /api/attachments/:id

需要认证。上传者本人或 `admin` 可删除，先删物理对象再删数据库记录，返回 `204`。其他人调用返回 `403`。

### GET /api/tickets/:id/attachments

需要认证，返回该议题的附件数组，每项附加 `url` 字段（形如 `/api/attachments/<id>`）。

## 审计日志

### GET /api/tickets/:ticketId/audit

可选认证，返回审计日志数组，按时间正序，每项包含 `action`、`actor`、`oldValue`、`newValue`、`createdAt`。

```json
{
  "success": true,
  "data": [
    {
      "id": "b3c1d2e3-0000-4111-8222-333344445555",
      "ticketId": 12,
      "action": "status_change",
      "oldValue": "open",
      "newValue": "in_progress",
      "actor": { "id": 2, "username": "helper" },
      "createdAt": "2026-10-28T09:15:00.000Z"
    }
  ]
}
```

`status_change` 立即落库；其他事件最多延迟约 15 秒，并按目标与动作在同一窗口内合并为一条净变更。窗口内被撤销的变更不会落库，因此刚提交的非状态变更可能暂时不可见。议题不可见时返回 `404`。

## 标签

### GET /api/labels

可选认证，返回标签数组，每项包含 `id`、`name`、`color`、`description`。标签标识符只能包含字母、数字、下划线和短横线。

### POST /api/labels

需要 `admin`，成功返回 `201`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 唯一标识，最长 50，创建后不可修改 |
| `name` | string | 是 | 显示名称，1-50 字符 |
| `color` | string | 是 | 6 位 hex，例如 `#22c55e` |
| `description` | string | 否 | 说明文字 |

```json
{ "id": "bug", "name": "缺陷", "color": "#ef4444", "description": "功能异常" }
```

`400` 表示格式不合法，`409` 表示标识符已存在。

### PATCH /api/labels/:id

需要 `admin`，请求体可含 `name`、`color`、`description`，标识符不可修改。返回更新后的标签；不存在返回 `404`。

### DELETE /api/labels/:id

需要 `admin`，删除标签并解除所有议题关联，返回 `204`。
