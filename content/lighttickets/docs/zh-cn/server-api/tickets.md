---
order: 30
---

# 议题与评论

## 创建议题

### POST /api/mc/tickets

请求须携带 `X-Player-Session`。

```http
POST /api/mc/tickets
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",            // string，必填，须与会话 UUID 一致
  "title": "无法进入生存服",             // string，必填，1-200 字符；模板含 title_prefix 时自动添加该前缀
  "body": "登录后被踢回大厅",            // string，必填，非空正文
  "template": "bug_report",             // string，必填，已启用的模板名，未知模板返回 400
  "formData": {                         // object，可选，键值均为字符串，字段由模板声明
    "server": "survival"                // string，下拉框提交实际值
  },
  "hidden": false,                      // boolean，可选，模板 hidden 为 optional 时必填，缺失时返回 400
  "allowContextView": false,            // boolean，可选，是否允许普通访客查看议题上下文，见下文
  "context": {                          // object，可选，world、x、y、z、gameMode 均可选
    "world": "world",                   // string，可选，世界名
    "x": 128,                           // number，可选，X 坐标
    "y": 64,                            // number，可选，Y 坐标
    "z": -32,                           // number，可选，Z 坐标
    "gameMode": "survival"              // string，可选，游戏模式
  },
  "serverId": "survival"                // string，Velocity 必填，仅用于路由到服务器，来源服务器始终取自会话
}
```

`allowContextView` 按议题存储。该值为 `false` 时，普通用户（非 `staff`、非作者本人）在 Web 与 `/api/mc` 读取接口中均无法看到该议题的世界、坐标、游戏模式与来源服务器；不传或为 `true` 时保持可见，作者本人与 `staff`、`admin` 始终可见。

响应状态码为 201；`author` 与 `labels` 由创建接口一并返回：

```jsonc
// 201 Created
{
  "id": 42,                          // number，议题 ID
  "title": "[Bug] 无法进入生存服",    // string，议题标题
  "body": "登录后被踢回大厅",         // string，议题正文
  "template": "bug_report",          // string，模板名
  "status": "open",                  // string，议题状态，取值为 open、in_progress、closed、invalid
  "hidden": false,                   // boolean，是否为隐藏议题
  "allowContextView": false,         // boolean | null，是否允许普通访客查看议题上下文，未指定时为 null
  "formData": "{\"server\":\"survival\"}", // string，JSON 字符串，插件须自行解析
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string，JSON 字符串，插件须自行解析
  "authorId": 7,                     // number，作者用户 ID
  "serverId": "srv_1",               // string，来源服务器 ID
  "createdAt": "2026-09-26T12:00:00.000Z", // string，创建时间
  "updatedAt": "2026-09-26T12:00:00.000Z", // string，最后更新时间
  "closedAt": null,                  // string | null，关闭时间，创建时为 null
  "completionHooksTriggered": false, // boolean，是否已触发完成钩子
  "author": {                        // object，作者信息
    "id": 7,                         // number，用户 ID
    "username": "steve",             // string，用户名
    "minecraftName": "Steve",        // string，Minecraft 名称
    "deletedAt": null                // string | null，删除时间
  },
  "labels": [                        // array，议题标签，元素为议题与标签的关联行
    {
      "ticketId": 42,                // number，议题 ID
      "labelId": "bug",              // string，标签 ID
      "label": {                     // object，标签本体
        "id": "bug",                 // string，标签 ID
        "name": "Bug",               // string，标签名
        "color": "#f97316",          // string，标签颜色
        "description": null          // string | null，标签说明
      }
    }
  ]
}
```

`formData` 与 `gameContext` 在数据库中为字符串，插件须自行解析 JSON。`labels` 的每个元素带 `ticketId`、`labelId` 与内嵌的 `label`，取标签名须读 `label.name`。

## 读取议题与评论

### GET /api/mc/tickets

`X-Player-Session` 为可选（条件鉴权）。

| 查询参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `minecraftUuid` | string | 是 | 须与会话 UUID 一致；匿名请求同样须携带 |
| `page` | number | 否 | 默认值为 1 |
| `pageSize` | number | 否 | 默认值为 20，上限为 100 |
| `statuses` | string | 否 | 取值为 `open`、`in_progress`、`closed`、`invalid`，可传单值、逗号分隔值或多值参数 |
| `type` | string | 否 | 为模板名 |
| `authorName` | string | 否 | 按作者用户名模糊匹配 |
| `serverName` | string | 否 | 按服务器 ID 或别名匹配 |
| `hasServer` | `true`/`false` | 否 | 为是否有来源服务器 |
| `search` | string | 否 | 匹配标题与正文 |

```jsonc
// 200 OK
{
  "tickets": [],  // array，当前页的议题，元素结构见 GET /api/mc/tickets/:uuid
  "total": 0,     // number，匹配的议题总数
  "page": 1,      // number，当前页码
  "pageSize": 20  // number，每页条数
}
```

列表不按服务器隔离：匿名访客仅看到公开议题，普通玩家额外看到本人创建的隐藏议题，`staff`、`admin` 看到平台全部议题。

### POST /api/mc/tickets/search

查询参数不变，改为置于 JSON body，并额外接受 `serverId`。该路径为 Velocity 的必需路径：GET 请求没有 body，无法携带 `serverId`；查询类接口均提供 body 变体，GET 端点保留给 Paper/Folia 与旧版插件。

```http
POST /api/mc/tickets/search
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",  // string，必填，须与会话 UUID 一致；匿名请求同样须携带
  "serverId": "survival",     // string，Velocity 必填，仅用于路由到服务器
  "statuses": "open,closed",  // string，可选，取值为 open、in_progress、closed、invalid，可传单值、逗号分隔值或多值参数
  "search": "登录"             // string，可选，匹配标题与正文
}
```

响应结构与本页列表接口相同；`tickets` 的元素不含 `server` 对象，来源服务器仅以 `serverId` 出现：

```jsonc
// 200 OK
{
  "tickets": [                              // array，当前页议题，按 createdAt 降序
    {
      "id": 42,                             // number，议题 ID
      "title": "无法进入生存服",            // string，议题标题
      "body": "登录后被踢回大厅",           // string，议题正文
      "template": "bug_report",             // string，模板名
      "formData": "{\"server\":\"survival\"}", // string | null，JSON 字符串，插件须自行解析
      "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string | null，JSON 字符串，插件须自行解析；议题无上下文时为 null
      "status": "open",                     // string，议题状态，取值为 open、in_progress、closed、invalid
      "hidden": false,                      // boolean，是否为隐藏议题
      "allowContextView": false,            // boolean | null，是否允许普通访客查看议题上下文，未指定时为 null
      "authorId": 7,                        // number，作者用户 ID
      "serverId": "srv_1",                  // string | null，来源服务器 ID
      "createdAt": "2026-09-26T12:00:00.000Z", // string，创建时间
      "updatedAt": "2026-09-26T12:00:00.000Z", // string，最后更新时间
      "closedAt": null,                     // string | null，关闭时间
      "completionHooksTriggered": false,    // boolean，是否已触发完成钩子
      "author": {                           // object，作者信息
        "id": 7,                            // number，用户 ID
        "username": "steve",                // string，用户名
        "minecraftName": "Steve",           // string，Minecraft 名称
        "deletedAt": null                   // string | null，删除时间
      },
      "labels": [                           // array，议题标签，元素为议题与标签的关联行
        {
          "ticketId": 42,                   // number，议题 ID
          "labelId": "bug",                 // string，标签 ID
          "label": {                        // object，标签本体
            "id": "bug",                    // string，标签 ID
            "name": "Bug",                  // string，标签名
            "color": "#f97316",             // string，标签颜色
            "description": null             // string | null，标签说明
          }
        }
      ],
      "assignees": [                        // array，受理人
        {
          "ticketId": 42,                   // number，议题 ID
          "userId": 3,                      // number，受理人用户 ID
          "user": {                         // object，受理人账号
            "id": 3,                        // number，用户 ID
            "username": "admin",            // string，用户名
            "avatarUrl": null,              // string | null，头像地址
            "deletedAt": null               // string | null，删除时间
          }
        }
      ],
      "_count": {                           // object，关联计数
        "comments": 2                       // number，评论数
      }
    }
  ],
  "total": 1,                               // number，匹配的议题总数
  "page": 1,                                // number，当前页码
  "pageSize": 20                            // number，每页条数
}
```

### GET /api/mc/tickets/:id/detail

`X-Player-Session` 为可选。`:id` 须为正整数，否则返回 400（`无效的 ID`）；议题不可见时返回 404。Velocity 使用 body 变体 `POST /api/mc/tickets/:id/detail`，请求体如下：

```jsonc
{
  "minecraftUuid": "<uuid>",  // string，必填，须与会话 UUID 一致
  "serverId": "survival"      // string，Velocity 必填，仅用于路由到服务器
}
```

查询参数仅有 `minecraftUuid`（必填）。响应包含议题本体，以及 `author`、`assignees`、`labels`、`server`；调用方为 `staff`、`admin` 时，响应还会包含 `completionHooks` 与 `hookDeliveries`。

```jsonc
// 200 OK
{
  "id": 42,                          // number，议题 ID
  "title": "[Bug] 无法进入生存服",    // string，议题标题
  "status": "open",                  // string，议题状态
  "gameContext": "{\"world\":\"world\",\"x\":128}", // string | null，JSON 字符串，插件须自行解析；调用方无权查看上下文时为 null
  "author": {                        // object，作者信息
    "id": 7,                         // number，用户 ID
    "username": "steve",             // string，用户名
    "minecraftName": "Steve",        // string，Minecraft 名称
    "deletedAt": null                // string | null，删除时间
  },
  "server": {                        // object | null，来源服务器，调用方无权查看上下文时为 null
    "id": "srv_1",                   // string，服务器 ID
    "name": "survival",              // string，服务器名
    "alias": "生存服"                 // string，服务器别名
  },
  "labels": [                        // array，议题标签，元素为议题与标签的关联行
    {
      "ticketId": 42,                // number，议题 ID
      "labelId": "bug",              // string，标签 ID
      "label": {                     // object，标签本体
        "id": "bug",                 // string，标签 ID
        "name": "Bug",               // string，标签名
        "color": "#f97316",          // string，标签颜色
        "description": null          // string | null，标签说明
      }
    }
  ],
  "assignees": [                     // array，受理人
    {
      "ticketId": 42,                // number，议题 ID
      "userId": 3,                   // number，受理人用户 ID
      "user": {                      // object，受理人账号
        "id": 3,                     // number，用户 ID
        "username": "admin",         // string，用户名
        "avatarUrl": null,           // string | null，头像地址
        "deletedAt": null            // string | null，删除时间
      }
    }
  ]
}
```

### GET /api/mc/tickets/:id/comments

`X-Player-Session` 为可选，查询参数 `minecraftUuid` 为必填。Velocity 使用 `POST /api/mc/tickets/:id/comments/list`，参数相同，置于 body。响应为按创建时间升序排列的评论数组：

```jsonc
// 200 OK
[
  {
    "id": "0c4b6f3a-1f4b-4a3e-9a44-1f1f0f6f9a11", // string，评论 ID
    "ticketId": 42,                              // number，所属议题 ID
    "body": "已收到，稍后处理",                    // string，评论正文
    "source": "minecraft",                       // string，评论来源
    "authorId": 3,                               // number，作者用户 ID
    "createdAt": "2026-09-26T12:10:00.000Z",     // string，创建时间
    "author": {                                  // object，作者信息
      "id": 3,                                   // number，用户 ID
      "username": "admin",                       // string，用户名
      "minecraftName": "Admin",                  // string，Minecraft 名称
      "avatarUrl": null,                         // string | null，头像地址
      "deletedAt": null                          // string | null，删除时间
    }
  }
]
```

### GET /api/mc/tickets/:uuid

该路径为上一版本插件使用的兼容路径：路径中的 `:uuid` 作为 `minecraftUuid`，仅解析 `page` 与 `pageSize`，无法传入其他过滤条件；该值不做 UUID 格式校验，匿名请求下仅用于占位。新集成改用 `GET /api/mc/tickets` 或 `POST /api/mc/tickets/search`。

响应结构与本页列表接口相同；`tickets` 的元素为议题本体加上 `author`、`assignees`、`labels` 与 `_count`，不含 `server` 对象，来源服务器仅以 `serverId` 出现：

```jsonc
// 200 OK
{
  "tickets": [                                  // array，当前页议题，按 createdAt 降序
    {
      "id": 42,                                 // number，议题 ID
      "title": "[Bug] 无法进入生存服",           // string，议题标题
      "body": "登录后被踢回大厅",                // string，议题正文
      "template": "bug_report",                 // string，模板名
      "formData": "{\"server\":\"survival\"}",  // string | null，JSON 字符串，插件须自行解析
      "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string | null，JSON 字符串，插件须自行解析；议题无上下文时为 null
      "status": "open",                         // string，议题状态，取值为 open、in_progress、closed、invalid
      "hidden": false,                          // boolean，是否为隐藏议题
      "allowContextView": false,                // boolean | null，是否允许普通访客查看议题上下文，未指定时为 null
      "authorId": 7,                            // number，作者用户 ID
      "serverId": "srv_1",                      // string | null，来源服务器 ID
      "createdAt": "2026-09-26T12:00:00.000Z",  // string，创建时间
      "updatedAt": "2026-09-26T12:00:00.000Z",  // string，最后更新时间
      "closedAt": null,                         // string | null，关闭时间
      "completionHooksTriggered": false,        // boolean，是否已触发完成钩子
      "author": {                               // object，作者信息
        "id": 7,                                // number，用户 ID
        "username": "steve",                    // string，用户名
        "minecraftName": "Steve",               // string，Minecraft 名称
        "deletedAt": null                       // string | null，删除时间
      },
      "labels": [                               // array，议题标签，元素为议题与标签的关联行
        {
          "ticketId": 42,                       // number，议题 ID
          "labelId": "bug",                     // string，标签 ID
          "label": {                            // object，标签本体
            "id": "bug",                        // string，标签 ID
            "name": "Bug",                      // string，标签名
            "color": "#f97316",                 // string，标签颜色
            "description": null                 // string | null，标签说明
          }
        }
      ],
      "assignees": [                            // array，受理人
        {
          "ticketId": 42,                       // number，议题 ID
          "userId": 3,                          // number，受理人用户 ID
          "user": {                             // object，受理人账号
            "id": 3,                            // number，用户 ID
            "username": "admin",                // string，用户名
            "avatarUrl": null,                  // string | null，头像地址
            "deletedAt": null                   // string | null，删除时间
          }
        }
      ],
      "_count": {                               // object，关联计数
        "comments": 2                           // number，评论数
      }
    }
  ],
  "total": 1,                                   // number，匹配的议题总数
  "page": 1,                                    // number，当前页码
  "pageSize": 20                                // number，每页条数
}
```

## 写评论与状态

### POST /api/mc/comments

请求须携带会话。`ticketId` 为数字，允许以字符串形式提交（自动转换）。响应状态码为 201，`source` 为 `minecraft`。

```http
POST /api/mc/comments
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",  // string，必填，须与会话 UUID 一致
  "ticketId": 42,             // number，必填，允许以字符串形式提交，自动转换
  "body": "补充：换世界后仍复现" // string，必填，评论正文
}
```

```jsonc
// 201 Created
{
  "id": "0c4b6f3a-1f4b-4a3e-9a44-1f1f0f6f9a11", // string，评论 ID
  "ticketId": 42,                           // number，所属议题 ID
  "authorId": 7,                            // number，评论作者用户 ID
  "body": "补充：换世界后仍复现",           // string，评论正文
  "source": "minecraft",                    // string，评论来源，固定为 minecraft
  "createdAt": "2026-09-26T12:10:00.000Z",  // string，创建时间
  "author": {                               // object，作者信息
    "id": 7,                                // number，用户 ID
    "username": "steve",                    // string，用户名
    "minecraftName": "Steve",               // string，Minecraft 名称
    "minecraftUuid": "<uuid>",              // string，Minecraft UUID
    "avatarUrl": null,                      // string | null，头像地址
    "deletedAt": null                       // string | null，删除时间
  }
}
```

### POST /api/mc/tickets/:id/status

请求须携带会话，响应为更新后的议题对象。

```http
POST /api/mc/tickets/42/status
X-Server-Key: <apiKey>
X-Player-Session: <sessionToken>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",  // string，必填，须与会话 UUID 一致
  "status": "closed"          // string，必填，取值为 open、in_progress、closed、invalid
}
```

```jsonc
// 200 OK
{
  "id": 42,                                 // number，议题 ID
  "title": "无法进入生存服",                // string，议题标题
  "body": "登录后被踢回大厅",               // string，议题正文
  "template": "bug_report",                 // string，模板名
  "formData": "{\"server\":\"survival\"}",  // string | null，JSON 字符串，插件须自行解析
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string | null，JSON 字符串，插件须自行解析；议题无上下文时为 null
  "status": "closed",                       // string，更新后的议题状态
  "hidden": false,                          // boolean，是否为隐藏议题
  "allowContextView": false,                // boolean | null，是否允许普通访客查看议题上下文
  "authorId": 7,                            // number，作者用户 ID
  "serverId": "srv_1",                      // string | null，来源服务器 ID
  "createdAt": "2026-09-26T12:00:00.000Z",  // string，创建时间
  "updatedAt": "2026-09-26T13:00:00.000Z",  // string，最后更新时间
  "closedAt": "2026-09-26T13:00:00.000Z",   // string | null，状态为 closed 或 invalid 时写入，其余状态为 null
  "completionHooksTriggered": false,        // boolean，是否已触发完成钩子
  "author": {                               // object，作者信息
    "id": 7,                                // number，用户 ID
    "username": "steve",                    // string，用户名
    "minecraftName": "Steve",               // string，Minecraft 名称
    "deletedAt": null                       // string | null，删除时间
  },
  "labels": [                               // array，议题标签，元素为议题与标签的关联行
    {
      "ticketId": 42,                       // number，议题 ID
      "labelId": "bug",                     // string，标签 ID
      "label": {                            // object，标签本体
        "id": "bug",                        // string，标签 ID
        "name": "Bug",                      // string，标签名
        "color": "#f97316",                 // string，标签颜色
        "description": null                 // string | null，标签说明
      }
    }
  ],
  "assignees": [                            // array，受理人
    {
      "ticketId": 42,                       // number，议题 ID
      "userId": 3,                          // number，受理人用户 ID
      "user": {                             // object，受理人账号
        "id": 3,                            // number，用户 ID
        "username": "admin",                // string，用户名
        "avatarUrl": null,                  // string | null，头像地址
        "deletedAt": null                   // string | null，删除时间
      }
    }
  ],
  "server": {                               // object | null，来源服务器，议题无来源服务器时为 null
    "id": "srv_1",                          // string，服务器 ID
    "name": "survival",                     // string，服务器名
    "alias": "生存服"                       // string，服务器别名
  }
}
```

权限规则：普通玩家仅能操作本人创建的议题，且仅能按下表状态迁移；`staff`、`admin` 可操作平台全部议题并设置任意状态。越权时返回 403，议题不存在或不可见时返回 404。

| 当前状态 | 目标状态 | 允许的操作者 |
| --- | --- | --- |
| `open`、`in_progress` | `closed` | 作者、`staff`、`admin` |
| `closed` | `open` | 作者、`staff`、`admin` |
| `invalid` | `open` | 仅 `staff`、`admin` |
| 其他组合 | — | 403 |

### POST /api/mc/tickets/:id/close

请求须携带会话，请求体仅含 `minecraftUuid`：

```jsonc
{
  "minecraftUuid": "<uuid>"  // string，必填，须与会话 UUID 一致
}
```

仅 `open` 与 `in_progress` 可关闭，否则返回 403（`只有开放或处理中的议题可以关闭`）；权限规则与状态接口一致。响应为更新后的议题，`closedAt` 同时被写入；同一议题被并发修改时可能返回 409（`议题状态已被其他请求修改`），重新读取后再决定是否重试。

```jsonc
// 200 OK
{
  "id": 42,                                 // number，议题 ID
  "title": "无法进入生存服",                // string，议题标题
  "body": "登录后被踢回大厅",               // string，议题正文
  "template": "bug_report",                 // string，模板名
  "formData": "{\"server\":\"survival\"}",  // string | null，JSON 字符串，插件须自行解析
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string | null，JSON 字符串，插件须自行解析；议题无上下文时为 null
  "status": "closed",                       // string，更新后的议题状态，固定为 closed
  "hidden": false,                          // boolean，是否为隐藏议题
  "allowContextView": false,                // boolean | null，是否允许普通访客查看议题上下文
  "authorId": 7,                            // number，作者用户 ID
  "serverId": "srv_1",                      // string | null，来源服务器 ID
  "createdAt": "2026-09-26T12:00:00.000Z",  // string，创建时间
  "updatedAt": "2026-09-26T13:00:00.000Z",  // string，最后更新时间
  "closedAt": "2026-09-26T13:00:00.000Z",   // string，关闭时间，关闭时写入
  "completionHooksTriggered": false,        // boolean，是否已触发完成钩子
  "author": {                               // object，作者信息
    "id": 7,                                // number，用户 ID
    "username": "steve",                    // string，用户名
    "minecraftName": "Steve",               // string，Minecraft 名称
    "deletedAt": null                       // string | null，删除时间
  },
  "labels": [                               // array，议题标签，元素为议题与标签的关联行
    {
      "ticketId": 42,                       // number，议题 ID
      "labelId": "bug",                     // string，标签 ID
      "label": {                            // object，标签本体
        "id": "bug",                        // string，标签 ID
        "name": "Bug",                      // string，标签名
        "color": "#f97316",                 // string，标签颜色
        "description": null                 // string | null，标签说明
      }
    }
  ],
  "assignees": [                            // array，受理人
    {
      "ticketId": 42,                       // number，议题 ID
      "userId": 3,                          // number，受理人用户 ID
      "user": {                             // object，受理人账号
        "id": 3,                            // number，用户 ID
        "username": "admin",                // string，用户名
        "avatarUrl": null,                  // string | null，头像地址
        "deletedAt": null                   // string | null，删除时间
      }
    }
  ],
  "server": {                               // object | null，来源服务器，议题无来源服务器时为 null
    "id": "srv_1",                          // string，服务器 ID
    "name": "survival",                     // string，服务器名
    "alias": "生存服"                       // string，服务器别名
  }
}
```

### POST /api/mc/tickets/:id/reopen

请求须携带会话，请求体仅含 `minecraftUuid`：

```jsonc
{
  "minecraftUuid": "<uuid>"  // string，必填，须与会话 UUID 一致
}
```

仅 `closed` 可重新打开（`invalid` 仅 `staff`、`admin` 能重开），否则返回 403（`只有已关闭的议题可以重新打开`）。响应为更新后的议题，`closedAt` 被清空。

```jsonc
// 200 OK
{
  "id": 42,                                 // number，议题 ID
  "title": "无法进入生存服",                // string，议题标题
  "body": "登录后被踢回大厅",               // string，议题正文
  "template": "bug_report",                 // string，模板名
  "formData": "{\"server\":\"survival\"}",  // string | null，JSON 字符串，插件须自行解析
  "gameContext": "{\"world\":\"world\",\"x\":128,\"y\":64,\"z\":-32}", // string | null，JSON 字符串，插件须自行解析；议题无上下文时为 null
  "status": "open",                         // string，更新后的议题状态，固定为 open
  "hidden": false,                          // boolean，是否为隐藏议题
  "allowContextView": false,                // boolean | null，是否允许普通访客查看议题上下文
  "authorId": 7,                            // number，作者用户 ID
  "serverId": "srv_1",                      // string | null，来源服务器 ID
  "createdAt": "2026-09-26T12:00:00.000Z",  // string，创建时间
  "updatedAt": "2026-09-26T14:00:00.000Z",  // string，最后更新时间
  "closedAt": null,                         // string | null，重新打开时被清空
  "completionHooksTriggered": false,        // boolean，是否已触发完成钩子
  "author": {                               // object，作者信息
    "id": 7,                                // number，用户 ID
    "username": "steve",                    // string，用户名
    "minecraftName": "Steve",               // string，Minecraft 名称
    "deletedAt": null                       // string | null，删除时间
  },
  "labels": [                               // array，议题标签，元素为议题与标签的关联行
    {
      "ticketId": 42,                       // number，议题 ID
      "labelId": "bug",                     // string，标签 ID
      "label": {                            // object，标签本体
        "id": "bug",                        // string，标签 ID
        "name": "Bug",                      // string，标签名
        "color": "#f97316",                 // string，标签颜色
        "description": null                 // string | null，标签说明
      }
    }
  ],
  "assignees": [                            // array，受理人
    {
      "ticketId": 42,                       // number，议题 ID
      "userId": 3,                          // number，受理人用户 ID
      "user": {                             // object，受理人账号
        "id": 3,                            // number，用户 ID
        "username": "admin",                // string，用户名
        "avatarUrl": null,                  // string | null，头像地址
        "deletedAt": null                   // string | null，删除时间
      }
    }
  ],
  "server": {                               // object | null，来源服务器，议题无来源服务器时为 null
    "id": "srv_1",                          // string，服务器 ID
    "name": "survival",                     // string，服务器名
    "alias": "生存服"                       // string，服务器别名
  }
}
```

## 获取用户信息

### GET /api/mc/user/:uuid

请求须携带会话，路径 UUID 须与会话 UUID 一致，否则返回 403。响应包含该 API 账号的公开资料，账号已解绑时返回 404。

```jsonc
// 200 OK
{
  "id": 7,                                  // number，用户 ID
  "email": "steve@example.com",             // string，邮箱
  "username": "steve",                      // string，用户名
  "minecraftUuid": "<uuid>",                // string，Minecraft UUID
  "minecraftName": "Steve",                 // string，Minecraft 名称
  "role": "player",                         // string，角色
  "avatarUrl": null,                        // string | null，头像地址
  "createdAt": "2026-05-01T08:00:00.000Z",  // string，创建时间
  "receiveEmailNotifications": true,        // boolean，是否接收邮件通知
  "deletedAt": null                         // string | null，删除时间
}
```

Velocity 使用 `POST /api/mc/user`，其余行为相同：

```jsonc
{
  "minecraftUuid": "<uuid>",  // string，必填，须与会话 UUID 一致
  "serverId": "survival"      // string，Velocity 必填，仅用于路由到服务器
}
```
