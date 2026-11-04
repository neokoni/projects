---
order: 30
---

# 议题、评论与附件

## 议题

### POST /api/tickets

该端点需要认证；创建成功时返回 `201` 与议题详情。

```http
POST /api/tickets
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "title": "服务器登不上",                                               // string，必填，1-200 字符
  "template": "bug_report",                                              // string，必填，模板名，取自 GET /api/templates
  // object，必填，按模板声明提交，未知字段、缺失必填项与非法选项均将被拒绝
  "formData": {
    "description": "连接超时", // string，模板字段
    "reproduce": "重启后必现"  // string，模板字段
  },
  "serverId": "survival",                                                // string，可选，仅 staff / admin 可用，普通用户提交时返回 403
  "attachmentIds": ["0f7d1c8e-3b2a-4c5d-9e6f-1a2b3c4d5e6f"],             // string[]，可选，预上传附件的 UUID，仅能认领当前用户所有且仍为 pending 的附件
  "hidden": true                                                         // boolean，模板策略为 optional 时为必填，否则由后端强制
}
```

`formData` 中的 dropdown 在取值为 `显示文本|实际值` 时提交实际值；旧客户端提交的整条选项将被归一化为实际值。

响应为创建后的议题对象，`labels` 取自模板的 `labels` 配置；模板 `assignee_ids` 配置的受理人已写入数据库，但不出现在该响应中。

```jsonc
// 201
{
  "id": 12,                                                                 // number，议题 ID
  "title": "[Bug] 服务器登不上",                                            // string，标题，应用模板 title_prefix 后的最终值
  "body": "感谢你反馈问题！请尽量提供**稳定复现的步骤**。\n\n---\n\n**问题描述:**\n\n连接超时\n\n---\n\n**复现步骤:**\n\n重启后必现", // string，按模板渲染的正文
  "template": "bug_report",                                                 // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string，规范化后的模板字段 JSON 字符串
  "gameContext": null,                                                      // string | null，游戏内上下文的 JSON 字符串，Web 创建时为 null
  "status": "open",                                                         // string，新建议题固定为 open
  "hidden": false,                                                          // boolean，按模板策略解析后的可见性；模板未声明 hidden 时为 false
  "allowContextView": null,                                                 // boolean | null，仅可信 Minecraft 会话写入，Web 创建时为 null
  "authorId": 3,                                                            // number，作者用户 ID
  "serverId": null,                                                         // string | null，来源服务器 ID，仅 staff / admin 可指定
  "createdAt": "2026-11-04T09:12:00.000Z",                                  // string，创建时间
  "updatedAt": "2026-11-04T09:12:00.000Z",                                  // string，更新时间
  "closedAt": null,                                                         // string | null，关闭时间，新建时为 null
  "completionHooksTriggered": false,                                        // boolean，是否已创建过决策钩子
  // object，作者简要信息，取自 USER_BRIEF_SELECT
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，模板 labels 配置的标签，每项为议题与标签的关系行；模板未配置时为空数组
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ]
}
```

- `400`：模板不存在、字段校验失败、附件已被认领或过期。
- `403`：普通用户指定 `serverId`、模板策略禁止该操作。
- `404`：模板不存在。

### GET /api/tickets

该端点采用可选认证。未登录时仅返回公开议题；普通用户额外可见其创建的隐藏议题；`staff` / `admin` 可见全部议题。

```http
GET /api/tickets
```

| 查询参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` / `pageSize` | integer | 分页参数，默认值分别为 `1` / `20`，`pageSize` 最大 100 |
| `statuses` | string | 逗号分隔或多值，例如 `open,in_progress` |
| `type` | string | 模板名 |
| `authorId` | integer | 作者用户 ID |
| `authorName` | string | 作者用户名 |
| `serverId` | string | 来源服务器标识 |
| `serverName` | string | 精确匹配 Minecraft 服务器名 |
| `hasServer` | `true` \| `false` | 是否带服务器上下文 |
| `labelId` | string | 标签标识符 |
| `search` | string | 标题与正文全文搜索 |

```jsonc
// 200
{
  "tickets": [
    {
      "id": 12,                                                         // number，议题 ID
      "title": "服务器登不上",                                          // string，标题
      "status": "open",                                                 // string，状态
      "hidden": false,                                                  // boolean，是否为隐藏议题
      "template": "bug_report",                                         // string，模板名
      // object，作者简要信息
      "author": {
        "id": 3,             // number
        "username": "player" // string
      },
      // array，关联标签，每项为议题与标签的关系行
      "labels": [
        {
          "ticketId": 12,             // number，议题 ID
          "labelId": "bug",           // string，标签标识符
          // object，标签本体
          "label": {
            "id": "bug",              // string，标签标识符
            "name": "缺陷",           // string，标签名
            "color": "#ef4444",       // string，颜色
            "description": "功能异常" // string | null，说明文字
          }
        }
      ]
    }
  ],
  "total": 1,                                                           // number，议题总数
  "page": 1,                                                            // number，当前页码
  "pageSize": 20                                                        // number，每页条数
}
```

### GET /api/tickets/:id

该端点采用可选认证，返回议题详情。隐藏议题对无权用户返回 `404`；该规则同样适用于评论、审计与附件读取。

```http
GET /api/tickets/:id
```

`completionHooks` 与 `hookDeliveries` 仅对 `staff` / `admin` 返回，且 `hookDeliveries` 只出现在该详情响应中。

普通用户与未登录用户仅会收到已完成且 `visibility` 为 `public` 的结果卡片，`staff` 结果与待决策字段不会公开。

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串，不可见时为 null
  "status": "open",                                                     // string，状态
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-10-28T09:20:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，受理人，每项为议题与用户的关系行
  "assignees": [
    {
      "ticketId": 12,                  // number，议题 ID
      "userId": 2,                     // number，用户 ID
      // object，受理人简要信息
      "user": {
        "id": 2,                       // number，用户 ID
        "username": "helper",          // string，用户名
        "avatarUrl": null,             // string | null，头像地址
        "deletedAt": null              // string | null，删除时间
      }
    }
  ],
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器，上下文不可见时为 null
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  },
  // array，决策钩子；staff / admin 返回该议题的全部记录
  "completionHooks": [
    {
      "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
      "event": "closed",                             // string，触发事件，取值为 closed / invalid
      "title": "发放奖励",                           // string，钩子标题
      // array，决策字段快照，取自模板
      "fields": [
        {
          "type": "checkboxes",                      // string，字段类型
          "id": "rewards",                           // string，字段 ID
          "validations": { "required": true },       // object，可选，校验规则
          "attributes": {
            "label": "奖励",                         // string，字段标签
            "description": "选择发放的奖励",         // string，可选，字段说明
            "options": ["金币", "物品"]              // array，可选，选项
          }
        }
      ],
      "response": null,                              // object | null，已提交的决策值，未决策时为 null
      "status": "pending",                           // string，pending / completed / skipped
      "visibility": "staff",                         // string，public / staff
      "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
      "completedAt": null,                           // string | null，决策时间
      "completedBy": null                            // object | null，操作人简要信息
    }
  ],
  // array，Minecraft 钩子投递结果；仅 staff / admin 返回
  "hookDeliveries": [
    {
      "id": "0b7a1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d", // string，投递 ID
      "status": "delivered",                         // string，pending / delivering / delivered / failed
      "createdAt": "2026-11-04T10:00:01.000Z",       // string，创建时间
      // array，逐条钩子的执行回执，未回执时为空数组
      "results": [
        {
          "hookId": "3c9d8e7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f", // string，钩子 ID
          "success": true                                   // boolean，是否执行成功
        }
      ],
      // array，投递的钩子内容
      "hooks": [
        {
          "type": "command",                            // string，command / minimessage
          "content": "give Player minecraft:emerald 1"  // string，命令或消息内容
        }
      ]
    }
  ]
}
```

非 `staff` 调用时不含 `hookDeliveries`；`completionHooks` 仅保留 `completed` 且 `visibility` 为 `public` 的记录，没有这类记录时该字段不出现。

### PATCH /api/tickets/:id

该端点需要认证。请求体为严格对象，仅接受 `status` 与 `hidden`：

```http
PATCH /api/tickets/:id
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "status": "in_progress",  // string，可选，目标状态，取值为 open / in_progress / closed / invalid 之一
  "hidden": false           // boolean，可选，仅 staff / admin 可修改，写入审计日志
}
```

`status` 与当前值不同时状态迁移成立，响应为与 `GET /api/tickets/:id` 同构的议题详情，`status` 为目标状态，`closedAt` 在目标为 `closed` / `invalid` 时写入本次时间、否则为 `null`。

仅提交 `hidden`、或 `status` 与当前值相同时不触发迁移，响应为以下结构，不含 `assignees`、`completionHooks` 与 `hookDeliveries`：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "open",                                                     // string，状态，未发生迁移时保持原值
  "hidden": false,                                                      // boolean，更新后的可见性
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-04T10:00:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息，取自 USER_BRIEF_SELECT
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  }
}
```

- 普通作者可在规则内切换其议题的状态，但提交 `hidden` 时返回 `403`。
- 状态迁移采用旧状态条件更新；并发请求未取得迁移权时返回 `409`，且不会重复写入审计记录或触发钩子。
- 目标状态包含 Minecraft console command 钩子时，须由 `staff` / `admin` 操作；普通作者操作时返回 `403`。
- `400`：状态值非法或请求体含未知字段。

### PATCH /api/tickets/:id/body

该端点需要认证，请求体如下，`body` 不得为空。

```http
PATCH /api/tickets/:id/body
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "body": "新的正文"  // string，必填，不得为空
}
```

响应为更新后的议题对象，结构与 `PATCH /api/tickets/:id` 的示例相同，`body` 为本次写入的值，同样不含 `assignees`、`completionHooks` 与 `hookDeliveries`：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "新的正文",                                                   // string，更新后的正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "open",                                                     // string，状态
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-04T10:00:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息，取自 USER_BRIEF_SELECT
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  }
}
```

### PATCH /api/tickets/:id/title

该端点需要认证，请求体如下，标题长度为 1-200 字符。

```http
PATCH /api/tickets/:id/title
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "title": "新标题"  // string，必填，1-200 字符
}
```

响应为更新后的议题对象，结构与 `PATCH /api/tickets/:id` 的示例相同，`title` 为本次写入的值；提交的标题与当前值相同时不写入审计日志，响应结构不变：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "新标题",                                                    // string，更新后的标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "open",                                                     // string，状态
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-04T10:00:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息，取自 USER_BRIEF_SELECT
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  }
}
```

### POST /api/tickets/:id/close

该端点需要认证，将议题置为 `closed`。同一议题仅在第一次匹配到决策配置时创建一组执行选项；重开后再次关闭不会重建或重新执行决策。

```http
POST /api/tickets/:id/close
Authorization: Bearer <accessToken>
```

响应为与 `GET /api/tickets/:id` 相同的议题详情对象，其中 `status` 为 `closed`，`closedAt` 为本次关闭时间：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "closed",                                                   // string，关闭后固定为 closed
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-04T10:00:00.000Z",                              // string，更新时间
  "closedAt": "2026-11-04T10:00:00.000Z",                               // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，受理人，每项为议题与用户的关系行
  "assignees": [
    {
      "ticketId": 12,                  // number，议题 ID
      "userId": 2,                     // number，用户 ID
      // object，受理人简要信息
      "user": {
        "id": 2,                       // number，用户 ID
        "username": "helper",          // string，用户名
        "avatarUrl": null,             // string | null，头像地址
        "deletedAt": null              // string | null，删除时间
      }
    }
  ],
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器，上下文不可见时为 null
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  },
  // array，关闭时按模板决策配置创建的记录，重开后再次关闭不会重建
  "completionHooks": [
    {
      "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
      "event": "closed",                             // string，触发事件，取值为 closed / invalid
      "title": "发放奖励",                           // string，钩子标题
      // array，决策字段快照，取自模板
      "fields": [
        {
          "type": "checkboxes",                      // string，字段类型
          "id": "rewards",                           // string，字段 ID
          "validations": { "required": true },       // object，可选，校验规则
          "attributes": {
            "label": "奖励",                         // string，字段标签
            "options": ["金币", "物品"]              // array，可选，选项
          }
        }
      ],
      "response": null,                              // object | null，已提交的决策值，未决策时为 null
      "status": "pending",                           // string，pending / completed / skipped
      "visibility": "staff",                         // string，public / staff
      "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
      "completedAt": null,                           // string | null，决策时间
      "completedBy": null                            // object | null，操作人简要信息
    }
  ],
  // array，Minecraft 钩子投递结果；仅 staff / admin 返回
  "hookDeliveries": []
}
```

### POST /api/tickets/:id/reopen

该端点需要认证，将议题重新置为 `open`。`409` 表示并发迁移失败或议题当前状态不允许重开。

```http
POST /api/tickets/:id/reopen
Authorization: Bearer <accessToken>
```

响应为与 `GET /api/tickets/:id` 相同的议题详情对象，其中 `status` 为 `open`，`closedAt` 为 `null`：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "open",                                                     // string，重开后固定为 open
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-05T08:30:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，重开后清空
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，受理人，每项为议题与用户的关系行
  "assignees": [
    {
      "ticketId": 12,                  // number，议题 ID
      "userId": 2,                     // number，用户 ID
      // object，受理人简要信息
      "user": {
        "id": 2,                       // number，用户 ID
        "username": "helper",          // string，用户名
        "avatarUrl": null,             // string | null，头像地址
        "deletedAt": null              // string | null，删除时间
      }
    }
  ],
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器，上下文不可见时为 null
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  },
  // array，关闭时创建的决策记录，重开不重置其状态
  "completionHooks": [
    {
      "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
      "event": "closed",                             // string，触发事件，取值为 closed / invalid
      "title": "发放奖励",                           // string，钩子标题
      // array，决策字段快照，取自模板
      "fields": [
        {
          "type": "checkboxes",                      // string，字段类型
          "id": "rewards",                           // string，字段 ID
          "validations": { "required": true },       // object，可选，校验规则
          "attributes": {
            "label": "奖励",                         // string，字段标签
            "options": ["金币", "物品"]              // array，可选，选项
          }
        }
      ],
      "response": null,                              // object | null，已提交的决策值，未决策时为 null
      "status": "pending",                           // string，pending / completed / skipped
      "visibility": "staff",                         // string，public / staff
      "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
      "completedAt": null,                           // string | null，决策时间
      "completedBy": null                            // object | null，操作人简要信息
    }
  ],
  // array，Minecraft 钩子投递结果；仅 staff / admin 返回
  "hookDeliveries": []
}
```

### POST /api/tickets/:id/completion-hooks/:hookId/complete

该端点需要 `staff` 权限。请求体按字段类型提交值：文本字段为字符串，`checkboxes` 为字符串数组：

```http
POST /api/tickets/:id/completion-hooks/:hookId/complete
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  // object，必填，文本字段为 string，checkboxes 为 string[]
  "values": {
    "rewards": ["金币", "物品"], // string[]，checkboxes 字段
    "note": "已发放"             // string，文本字段
  }
}
```

后端按模板快照校验必填项与预设选项，将记录原子标记为 `completed` 并记录操作人，再按配置顺序下发动作。已完成记录重复提交时返回 `409`，不会重复下发。

响应为被完成的记录本体，`status` 为 `completed`，`response` 为规范化后的提交值：

```jsonc
// 200
{
  "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
  "event": "closed",                             // string，触发事件，取值为 closed / invalid
  "title": "发放奖励",                           // string，钩子标题
  // array，决策字段快照，取自模板
  "fields": [
    {
      "type": "checkboxes",                      // string，字段类型
      "id": "rewards",                           // string，字段 ID
      "validations": { "required": true },       // object，可选，校验规则
      "attributes": {
        "label": "奖励",                         // string，字段标签
        "description": "选择发放的奖励",         // string，可选，字段说明
        "options": ["金币", "物品"]              // array，可选，选项
      }
    },
    {
      "type": "textarea",                        // string，字段类型
      "id": "note",                              // string，字段 ID
      "attributes": {
        "label": "备注"                          // string，字段标签
      }
    }
  ],
  // object | null，规范化后的提交值，键为字段 ID
  "response": {
    "rewards": ["金币", "物品"],                 // string[]，checkboxes 字段的选中项
    "note": "已发放"                             // string，文本字段的取值
  },
  "status": "completed",                         // string，完成后的固定取值
  "visibility": "staff",                         // string，public / staff，取自模板快照
  "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
  "completedAt": "2026-11-04T10:05:00.000Z",     // string | null，决策时间
  // object | null，操作人简要信息
  "completedBy": {
    "id": 2,                    // number，用户 ID
    "username": "helper",       // string，用户名
    "minecraftName": "Helper",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  }
}
```

### POST /api/tickets/:id/completion-hooks/:hookId/skip

该端点需要 `staff` 权限。该操作将待处理记录标记为 `skipped`，即本次不做决策：不提交字段、不执行动作，但将写入一条审计日志。已处理记录再次操作时返回 `409`。

```http
POST /api/tickets/:id/completion-hooks/:hookId/skip
Authorization: Bearer <accessToken>
```

返回被跳过的记录本体，`status` 为 `skipped`，`response` 保持 `null`：

```jsonc
// 200
{
  "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
  "event": "closed",                             // string，触发事件，取值为 closed / invalid
  "title": "发放奖励",                           // string，钩子标题
  // array，决策字段快照，取自模板
  "fields": [
    {
      "type": "checkboxes",                      // string，字段类型
      "id": "rewards",                           // string，字段 ID
      "validations": { "required": true },       // object，可选，校验规则
      "attributes": {
        "label": "奖励",                         // string，字段标签
        "description": "选择发放的奖励",         // string，可选，字段说明
        "options": ["金币", "物品"]              // array，可选，选项
      }
    }
  ],
  "response": null,                              // object | null，跳过时保持 null
  "status": "skipped",                           // string，跳过后的固定取值
  "visibility": "staff",                         // string，public / staff，取自模板快照
  "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
  "completedAt": "2026-11-04T10:05:00.000Z",     // string | null，跳过时间
  // object | null，操作人简要信息
  "completedBy": {
    "id": 2,                    // number，用户 ID
    "username": "helper",       // string，用户名
    "minecraftName": "Helper",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  }
}
```

### PUT /api/tickets/:id/assignees

该端点需要 `staff` 或 `admin` 权限，将整体覆盖受理人：

```http
PUT /api/tickets/:id/assignees
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "assigneeIds": [2, 3]  // number[]，必填，整体覆盖受理人，空数组用于清空
}
```

数组中的用户须全部存在且角色为 `staff` / `admin`；含不存在用户、普通用户或重复 ID 时返回 `400`，且不会部分修改。空数组用于清空受理人。新增受理人将收到分配提醒邮件（操作者本人除外）。

响应为与 `GET /api/tickets/:id` 同构的议题详情，`assignees` 为本次覆盖后的集合；该端点要求 `staff`，因此 `completionHooks`（该议题全部记录）与 `hookDeliveries` 一并返回：

```jsonc
// 200
{
  "id": 12,                                                             // number，议题 ID
  "title": "服务器登不上",                                              // string，标题
  "body": "登录后被踢回大厅",                                           // string，正文
  "template": "bug_report",                                             // string，模板名
  "formData": "{\"description\":\"连接超时\",\"reproduce\":\"重启后必现\"}", // string | null，模板字段的 JSON 字符串
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}",  // string | null，游戏内上下文的 JSON 字符串
  "status": "open",                                                     // string，状态
  "hidden": false,                                                      // boolean，是否为隐藏议题
  "allowContextView": true,                                             // boolean | null，是否允许普通访客查看上下文
  "authorId": 3,                                                        // number，作者用户 ID
  "serverId": "survival",                                               // string | null，来源服务器 ID
  "createdAt": "2026-10-28T09:12:00.000Z",                              // string，创建时间
  "updatedAt": "2026-11-04T10:00:00.000Z",                              // string，更新时间
  "closedAt": null,                                                     // string | null，关闭时间
  "completionHooksTriggered": true,                                     // boolean，是否已创建过决策钩子
  // object，作者简要信息
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "deletedAt": null           // string | null，删除时间
  },
  // array，覆盖后的受理人，每项为议题与用户的关系行
  "assignees": [
    {
      "ticketId": 12,                  // number，议题 ID
      "userId": 2,                     // number，用户 ID
      // object，受理人简要信息
      "user": {
        "id": 2,                       // number，用户 ID
        "username": "helper",          // string，用户名
        "avatarUrl": null,             // string | null，头像地址
        "deletedAt": null              // string | null，删除时间
      }
    },
    {
      "ticketId": 12,                  // number，议题 ID
      "userId": 3,                     // number，用户 ID
      // object，受理人简要信息
      "user": {
        "id": 3,                       // number，用户 ID
        "username": "player",          // string，用户名
        "avatarUrl": null,             // string | null，头像地址
        "deletedAt": null              // string | null，删除时间
      }
    }
  ],
  // array，关联标签，每项为议题与标签的关系行
  "labels": [
    {
      "ticketId": 12,                  // number，议题 ID
      "labelId": "bug",                // string，标签标识符
      // object，标签本体
      "label": {
        "id": "bug",                   // string，标签标识符
        "name": "缺陷",                // string，标签名
        "color": "#ef4444",            // string，颜色
        "description": "功能异常"      // string | null，说明文字
      }
    }
  ],
  // object | null，来源服务器
  "server": {
    "id": "survival",                  // string，服务器 ID
    "name": "生存服",                  // string，服务器名
    "alias": null                      // string | null，服务器别名
  },
  // array，决策钩子；staff / admin 返回该议题的全部记录
  "completionHooks": [
    {
      "id": "6f1d0c7b-2a1e-4c3d-8f5a-9b0c1d2e3f40", // string，钩子记录 ID
      "event": "closed",                             // string，触发事件，取值为 closed / invalid
      "title": "发放奖励",                           // string，钩子标题
      // array，决策字段快照，取自模板
      "fields": [
        {
          "type": "checkboxes",                      // string，字段类型
          "id": "rewards",                           // string，字段 ID
          "validations": { "required": true },       // object，可选，校验规则
          "attributes": {
            "label": "奖励",                         // string，字段标签
            "options": ["金币", "物品"]              // array，可选，选项
          }
        }
      ],
      "response": null,                              // object | null，已提交的决策值，未决策时为 null
      "status": "pending",                           // string，pending / completed / skipped
      "visibility": "staff",                         // string，public / staff
      "createdAt": "2026-11-04T10:00:00.000Z",       // string，创建时间
      "completedAt": null,                           // string | null，决策时间
      "completedBy": null                            // object | null，操作人简要信息
    }
  ],
  // array，Minecraft 钩子投递结果；仅 staff / admin 返回
  "hookDeliveries": [
    {
      "id": "0b7a1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d", // string，投递 ID
      "status": "delivered",                         // string，pending / delivering / delivered / failed
      "createdAt": "2026-11-04T10:00:01.000Z",       // string，创建时间
      // array，逐条钩子的执行回执，未回执时为空数组
      "results": [
        {
          "hookId": "3c9d8e7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f", // string，钩子 ID
          "success": true                                   // boolean，是否执行成功
        }
      ],
      // array，投递的钩子内容
      "hooks": [
        {
          "type": "command",                            // string，command / minimessage
          "content": "give Player minecraft:emerald 1"  // string，命令或消息内容
        }
      ]
    }
  ]
}
```

### POST /api/tickets/:id/labels

该端点需要 `staff` 权限，成功时返回 `201`，无响应体。标签不存在时返回 `404`，重复关联时返回 `409`。

```http
POST /api/tickets/:id/labels
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "labelId": "bug"  // string，必填，标签标识符
}
```

### DELETE /api/tickets/:id/labels/:labelId

该端点需要 `staff` 权限，用于解除关联，成功时返回 `204`。

```http
DELETE /api/tickets/:id/labels/:labelId
Authorization: Bearer <accessToken>
```

## 评论

评论端点均位于 `/api/tickets/:id/comments` 路径下。

### GET /api/tickets/:id/comments

该端点采用可选认证，返回评论数组（不分页），按时间正序排列。议题不可见时返回 `404`。

```http
GET /api/tickets/:id/comments
```

```jsonc
// 200
[
  {
    "id": "8f3e1a20-1111-4222-8333-444455556666", // string，评论 ID
    "ticketId": 12,                               // number，所属议题 ID
    "authorId": 3,                                // number，作者用户 ID
    "body": "已复现，正在排查。",                 // string，评论正文
    "source": "web",                              // string，来源，取值为 web / minecraft
    "createdAt": "2026-10-28T09:12:00.000Z",      // string，创建时间
    // object，作者简要信息
    "author": {
      "id": 3,                    // number，用户 ID
      "username": "player",       // string，用户名
      "minecraftName": "Player",  // string | null，Minecraft 名称
      "avatarUrl": null,          // string | null，头像地址
      "deletedAt": null           // string | null，删除时间
    }
  }
]
```

### POST /api/tickets/:id/comments

该端点需要认证，请求体如下，成功时返回 `201` 与新评论对象。

```http
POST /api/tickets/:id/comments
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "body": "评论内容"  // string，必填，不得为空
}
```

```jsonc
// 201
{
  "id": "8f3e1a20-1111-4222-8333-444455556666",  // string，评论 ID
  "ticketId": 12,                                // number，所属议题 ID
  "body": "已复现，正在排查。",                  // string，评论正文
  "source": "web",                               // string，来源，取值为 web / minecraft
  // object，作者简要信息
  "author": {
    "id": 3,                                     // number，用户 ID
    "username": "player",                        // string，用户名
    "minecraftName": "Player",                   // string | null，Minecraft 名称
    "minecraftUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11", // string | null，绑定的 Minecraft UUID
    "avatarUrl": null,                           // string | null，头像地址
    "deletedAt": null                            // string | null，删除时间
  },
  "createdAt": "2026-10-28T09:12:00.000Z"        // string，创建时间
}
```

`400` 表示正文为空；`404` 表示议题不存在或当前用户不可见。

### PATCH /api/tickets/:id/comments/:commentId/body

该端点需要认证，请求体如下。仅评论作者本人可编辑，`staff` / `admin` 亦不可编辑他人评论，否则返回 `403`。

```http
PATCH /api/tickets/:id/comments/:commentId/body
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "body": "修改后的内容"  // string，修改后的评论正文
}
```

响应为更新后的评论对象，结构与 `GET /api/tickets/:id/comments` 的列表项相同，`body` 为本次写入的值：

```jsonc
// 200
{
  "id": "8f3e1a20-1111-4222-8333-444455556666", // string，评论 ID
  "ticketId": 12,                               // number，所属议题 ID
  "authorId": 3,                                // number，作者用户 ID
  "body": "修改后的内容",                       // string，更新后的评论正文
  "source": "web",                              // string，来源，取值为 web / minecraft
  "createdAt": "2026-10-28T09:12:00.000Z",      // string，创建时间
  // object，作者简要信息
  "author": {
    "id": 3,                    // number，用户 ID
    "username": "player",       // string，用户名
    "minecraftName": "Player",  // string | null，Minecraft 名称
    "avatarUrl": null,          // string | null，头像地址
    "deletedAt": null           // string | null，删除时间
  }
}
```

### DELETE /api/tickets/:id/comments/:commentId

该端点需要认证，作者或 `staff` / `admin` 可删除，返回 `204`。删除前将清理该评论附件的物理文件。

```http
DELETE /api/tickets/:id/comments/:commentId
Authorization: Bearer <accessToken>
```

## 附件

### POST /api/attachments/upload

该端点需要认证，请求体为 `multipart/form-data`，成功时返回 `201` 与附件记录。

```http
POST /api/attachments/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

```jsonc
// multipart/form-data 字段
{
  "file": "<文件>",  // file，form 字段，必填，文件本身，先校验 mimetype 白名单，再做 magic bytes 二次校验
  "ticketId": 12,    // integer，form 字段，可选，正整数，直接挂到议题，与 commentId 不得同时提供
  "commentId": null  // uuid，form 字段，可选，直接挂到评论，与 ticketId 不得同时提供
}
```

`ticketId` 与 `commentId` 不得同时提供。二者均不提供时，将创建一条归当前用户所有的预上传记录，之后通过 `attachmentIds` 在创建议题时认领。

```jsonc
// 201
{
  "id": "1b7c2d3e-4f50-4a61-8273-9a0b1c2d3e4f",  // string，附件 ID
  "filename": "error.log",                       // string，文件名
  "mimeType": "text/plain",                      // string，MIME 类型
  "size": 20480,                                 // integer，文件大小
  "storageType": "local",                        // string，存储类型
  "status": "pending",                           // string，附件状态
  "expiresAt": "2026-11-04T09:12:00.000Z"        // string，过期时间
}
```

未关联附件仅按容量配额限制，不限制数量：默认 50 MiB，默认 7 天过期（管理员可调）。`400` 表示未选文件或类型不合法；`403` 表示无权向该议题或评论追加附件；`429` 表示超出配额。

### GET /api/attachments/:id

该端点采用可选认证。本地存储直接返回文件流；S3 存储返回 `302` 预签名 URL。无权访问时返回 `404`。

```http
GET /api/attachments/:id
```

本地存储的响应头（文件流）：

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Disposition: attachment; filename*=UTF-8''error.log
```

S3 存储的响应头（预签名 URL 跳转）：

```http
HTTP/1.1 302 Found
Location: <预签名 URL>
```

`Content-Type` 取附件记录的 `mimeType`；图片类型（`image/png`、`image/jpeg`、`image/gif`、`image/webp`）的 `Content-Disposition` 为 `inline`，其余类型按 RFC 5987 编码文件名并以 `attachment` 下发。响应体为文件字节，不套用 envelope。

### DELETE /api/attachments/:id

该端点需要认证。上传者本人或 `admin` 可删除，删除时先删物理对象再删数据库记录，返回 `204`。其他用户调用时返回 `403`。

```http
DELETE /api/attachments/:id
Authorization: Bearer <accessToken>
```

### GET /api/tickets/:id/attachments

该端点需要认证，返回该议题的附件数组，每项附加 `url` 字段（形如 `/api/attachments/<id>`）。

```http
GET /api/tickets/:id/attachments
Authorization: Bearer <accessToken>
```

```jsonc
// 200
[
  {
    "id": "1b7c2d3e-4f50-4a61-8273-9a0b1c2d3e4f", // string，附件 ID
    "ticketId": 12,                               // number，所属议题 ID
    "commentId": null,                            // string | null，所属评论 ID
    "filename": "error.log",                      // string，文件名
    "path": "6c1f0a9e-8b7d-4c6a-9e5f-3a2b1c0d9e8f", // string，存储键，本地与 S3 均以 UUID 命名
    "mimeType": "text/plain",                     // string，MIME 类型
    "size": 20480,                                // integer，文件大小
    "storageType": "local",                       // string，存储类型，取值为 local / s3
    "status": "attached",                         // string，固定为 attached
    "expiresAt": null,                            // string | null，已关联附件为 null
    "uploadedBy": 3,                              // number，上传者用户 ID
    "createdAt": "2026-10-28T09:12:00.000Z",      // string，创建时间
    "url": "/api/attachments/1b7c2d3e-4f50-4a61-8273-9a0b1c2d3e4f" // string，读取地址
  }
]
```

仅返回 `status` 为 `attached` 的附件，按创建时间倒序排列。

## 审计日志

### GET /api/tickets/:ticketId/audit

该端点采用可选认证，返回审计日志数组，按时间正序排列，每项包含 `action`、`actor`、`oldValue`、`newValue`、`createdAt`。

```http
GET /api/tickets/:ticketId/audit
```

```jsonc
// 200
[
  {
    "id": "b3c1d2e3-0000-4111-8222-333344445555",  // string，日志 ID
    "ticketId": 12,                                // number，所属议题 ID
    "action": "status_change",                     // string，事件动作
    "oldValue": "open",                            // string，变更前的值
    "newValue": "in_progress",                     // string，变更后的值
    // object，操作人简要信息
    "actor": {
      "id": 2,             // number
      "username": "helper" // string
    },
    "createdAt": "2026-10-28T09:15:00.000Z"        // string，记录时间
  }
]
```

`status_change` 立即落库；其他事件最多延迟约 15 秒，并按目标与动作在同一窗口内合并为一条净变更。窗口内被撤销的变更不会落库，因此刚提交的非状态变更可能暂时不可见。议题不可见时返回 `404`。

## 标签

### GET /api/labels

该端点采用可选认证，返回标签数组，每项包含 `id`、`name`、`color`、`description`。标签标识符仅能包含字母、数字、下划线与短横线。

```http
GET /api/labels
```

```jsonc
// 200
[
  {
    "id": "bug",               // string，标签标识符
    "name": "缺陷",            // string，显示名称
    "color": "#ef4444",        // string，6 位 hex 颜色
    "description": "功能异常"  // string | null，说明文字
  }
]
```

按 `name` 升序排列。

### POST /api/labels

该端点需要 `admin` 权限，成功时返回 `201`。

```http
POST /api/labels
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "id": "bug",               // string，必填，唯一标识，最长 50，创建后不可修改
  "name": "缺陷",            // string，必填，显示名称，1-50 字符
  "color": "#ef4444",        // string，必填，6 位 hex，例如 #22c55e
  "description": "功能异常"  // string，可选，说明文字
}
```

响应为新建的标签对象：

```jsonc
// 201
{
  "id": "bug",               // string，标签标识符
  "name": "缺陷",            // string，显示名称
  "color": "#ef4444",        // string，6 位 hex 颜色
  "description": "功能异常"  // string | null，说明文字，未提供时为 null
}
```

`400` 表示格式不合法；`409` 表示标识符已存在。

### PATCH /api/labels/:id

该端点需要 `admin` 权限，请求体可含 `name`、`color`、`description`，标识符不可修改。返回更新后的标签；标签不存在时返回 `404`。

```http
PATCH /api/labels/:id
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "name": "缺陷",            // string，可选，显示名称，1-50 字符
  "color": "#ef4444",        // string，可选，6 位 hex
  "description": "功能异常"  // string，可选，说明文字
}
```

响应为更新后的标签对象，未提交的字段保持原值：

```jsonc
// 200
{
  "id": "bug",               // string，标签标识符，不可修改
  "name": "缺陷",            // string，显示名称
  "color": "#ef4444",        // string，6 位 hex 颜色
  "description": "功能异常"  // string | null，说明文字
}
```

### DELETE /api/labels/:id

该端点需要 `admin` 权限，删除标签并解除所有议题关联，返回 `204`。

```http
DELETE /api/labels/:id
Authorization: Bearer <accessToken>
```
