---
order: 50
---

# 管理后台 API

## 站点设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/setup/settings` | 读取完整站点设置 |
| `PATCH` | `/api/setup/settings` | 部分更新，仅修改传入字段 |
| `POST` | `/api/setup/settings/mail/test` | 发送测试邮件以验证 SMTP |

`PATCH` 的请求体为以下字段的子集，所有字段均为可选：

```http
PATCH /api/setup/settings
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "requireLogin": false,                       // boolean，可选，浏览是否要求登录
  "allowWebRegister": true,                    // boolean，可选，网页注册是否开放
  "allowMcRegister": true,                     // boolean，可选，游戏内注册是否开放
  "sendEmailNotifications": true,              // boolean，可选，议题邮件通知是否开启
  "siteName": "LightTickets",                  // string，可选，站点名，最长 100
  "defaultLanguage": "zh-CN",                  // string，可选，默认语言 ID
  "siteUrl": "https://tickets.example.com",    // string | null，可选，仅含 origin 的 HTTP(S) 地址，保存时规范化
  "footerContent": "<footerContent>",          // string | null，可选，页脚内容，最长 2000 字符
  "mail": {                                    // object，可选
    "enabled": true,                           // boolean
    "host": "smtp.example.com",                // string
    "port": 587,                               // number
    "secure": true,                            // boolean
    "username": "<username>",                  // string
    "password": "<password>",                  // string
    "fromName": "<fromName>",                  // string
    "fromAddress": "<fromAddress>"             // string
  },
  "turnstile": {                               // object，可选
    "enabled": true,                           // boolean
    "siteKey": "<siteKey>",                    // string
    "secretKey": null                          // string | null，传 null 即清除
  },
  "rateLimit": {                               // object，可选，字段说明见「限流」一节
    "global": {
      "windowSeconds": 60,                     // number，1-86400
      "maxRequests": 100                       // number，1-100000
    },
    "auth": {
      "windowSeconds": 60,                     // number，1-86400
      "maxRequests": 10                        // number，1-100000
    },
    "email": {
      "cooldownSeconds": 60                    // number，1-86400
    },
    "minecraftLink": {
      "maxAttempts": 5,                        // number，1-100
      "lockSeconds": 900                       // number，1-86400
    }
  },
  "attachment": {                              // object，可选
    "pendingQuotaMiB": 50,                     // number，单位 MiB，默认 50，上限 102400
    "pendingExpirationEnabled": true,          // boolean
    "pendingTtlDays": 7                        // number，单位天，默认 7，上限 365
  }
}
```

- `400`：字段校验失败（如 `siteUrl` 含路径或凭据、`fromAddress` 不是邮箱）。

邮件、限流与 Turnstile 均无独立路由，全部经此端点写入，保存后立即生效。

`POST /api/setup/settings/mail/test` 的请求体如下：

```http
POST /api/setup/settings/mail/test
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "mail": {                                  // object，可选，字段同站点设置的 mail，省略时使用已保存的配置
    "enabled": true,                         // boolean
    "host": "smtp.example.com",              // string
    "port": 587,                             // number
    "secure": true,                          // boolean
    "username": "<username>",                // string
    "password": "<password>",                // string
    "fromName": "<fromName>",                // string
    "fromAddress": "<fromAddress>"           // string
  }
}
```

连接或认证失败返回 `502`。

## 品牌资源

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/branding/:slot` | 公开 | 读取已上传图片，未上传时返回 `404` |
| `PUT` | `/api/branding/:slot` | admin | 以 `multipart/form-data` 上传，字段名为 `file` |
| `DELETE` | `/api/branding/:slot` | admin | 删除该 `slot` 的自定义图片 |

`slot` 的取值为 `favicon`、`favicon-dark`、`logo`、`logo-dark`。

单个文件的大小上限为 2 MiB，仅接受 `png`、`jpg`、`webp`、`gif`、`svg`（按 MIME 判断）。

```http
PUT /api/branding/:slot
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=<boundary>
```

`PUT` 未选择文件时返回 `400`。`PUT` 与 `DELETE` 均返回四个 URL 字段的最新状态，未上传时为 `null`：

```jsonc
// 200
{
  "faviconUrl": null,          // string | null，未上传时为 null
  "faviconDarkUrl": null,      // string | null，未上传时为 null
  "logoUrl": null,             // string | null，未上传时为 null
  "logoDarkUrl": null          // string | null，未上传时为 null
}
```

## 模板管理

与 [模板接口](./templates.md) 的只读端点相比，本节端点可读写被禁用的模板与原始 YAML。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/templates` | 列出全部模板，含 `enabled: false` 者 |
| `GET` | `/api/admin/templates/:name` | 返回单个模板的完整定义 |
| `POST` | `/api/admin/templates` | 新建模板，成功返回 `201` |
| `PATCH` | `/api/admin/templates/:name` | 部分更新 |
| `DELETE` | `/api/admin/templates/:name` | 删除模板文件，成功返回 `204` |

`POST /api/admin/templates` 与 `PATCH /api/admin/templates/:name` 的请求体字段如下：

```http
POST /api/admin/templates
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "name": "bug-report",                   // string，模板 key，长度 1-50 字符，仅接受字母数字与 _-，创建后不可更改
  "nameI18n": "<displayName>",            // string，展示名
  "description": "<description>",         // string，描述
  "titlePrefix": "<titlePrefix>",         // string，标题前缀，最长 50 字符
  "labels": "[\"bug\"]",                  // string，JSON 字符串数组，如 "[\"bug\"]"
  "assigneeIds": [1],                     // number[]，自动受理人，须为存在的 staff 或 admin 用户
  "body": "<yaml>",                       // string，字段定义，以字符串形式传入（JSON 亦为合法 YAML）
  "completionHooks": "<yaml>",            // string，完成钩子数组，以字符串形式传入（JSON 亦为合法 YAML）
  "source": "<yaml>",                     // string，整份 YAML 原文，优先于上述结构化字段
  "enabled": true,                        // boolean，是否启用，默认 true
  "hidden": "optional"                    // boolean，可见性策略，取值为 true、false 或 "optional"
}
```

- `400` / `409`：YAML 不合法、`player_select` 引用了不存在的玩家组，或 `assigneeIds` 含非 `staff` 用户；创建时模板 key 已存在，或更新时文件已被其他请求修改，重新加载后再提交。

## 玩家组

玩家组为模板 `player_select` 字段的候选池，成员批量写入一次最多 500 个玩家名。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/player-groups` | 返回组列表 |
| `GET` | `/api/admin/player-groups/:id` | 返回组内成员，支持分页与 `q` 搜索 |
| `POST` | `/api/admin/player-groups` | 创建组，请求体为 `{ id, name?, note? }`，成功返回 `201` |
| `PATCH` | `/api/admin/player-groups/:id` | 修改 `name` 与 `note`，传 `null` 即清空 |
| `DELETE` | `/api/admin/player-groups/:id` | 删除组，成功返回 `204` |
| `POST` | `/api/admin/player-groups/:id/items` | 批量添加成员，请求体见下方示例，成功返回 `201` |
| `PATCH` | `/api/admin/player-groups/:id/items/:itemId` | 修改成员，请求体见下方示例 |
| `DELETE` | `/api/admin/player-groups/:id/items/:itemId` | 删除成员，成功返回 `204` |
| `GET` | `/api/player-groups/search` | **登录用户**按组搜索玩家名 |

`GET /api/player-groups/search` 的参数为 `groupIds`（逗号分隔或多值）、`q`（1-100 字符）与可选的 `limit`（最大 100）。

`POST /api/admin/player-groups/:id/items` 的请求体为：

```http
POST /api/admin/player-groups/:id/items
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  // string[]，必填，玩家名数组，单次最多 500 个
  "values": ["steve"]
}
```

`PATCH /api/admin/player-groups/:id/items/:itemId` 的请求体为：

```http
PATCH /api/admin/player-groups/:id/items/:itemId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  // string，必填，修改后的玩家名
  "value": "steve"
}
```

- `400`：组 ID 或玩家名不符合命名规则，或 `values` 为空、超过 500。
- `404`：组或成员不存在。
- `409`：组 ID 已存在、成员已存在，或所删除的组仍被模板与待处理完成钩子引用。

## 服务器与 API Key

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/servers` | 返回服务器列表 |
| `POST` | `/api/servers` | 新建服务器，成功返回 `201` |
| `PATCH` | `/api/servers/:id` | 部分更新 |
| `DELETE` | `/api/servers/:id` | 删除服务器，成功返回 `204` |
| `GET` | `/api/servers/api-keys` | 返回 Key 列表，不含明文 |
| `POST` | `/api/servers/api-keys` | 新建 Key，成功返回 `201`，并返回一次明文 |
| `PATCH` | `/api/servers/api-keys/:id` | 修改 `title`、`type` 与 `serverIds` |
| `POST` | `/api/servers/api-keys/:id/regenerate` | 重新生成并返回明文 |
| `DELETE` | `/api/servers/api-keys/:id` | 删除 Key，成功返回 `204` |

服务器的字段为：

```http
POST /api/servers
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "serverId": "<serverId>",           // string，长度 1-64，仅字母数字与 ._-
  "identifyId": "<identifyId>",       // string，插件上报的识别 ID，可含中文，不得含控制字符
  "alias": "<alias>",                 // string，最长 50 字符
  "address": "<address>",             // string，最长 255 字符
  "description": "<description>"      // string，最长 500 字符
}
```

API Key 的请求体为：

```http
POST /api/servers/api-keys
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "title": "<title>",             // string，备注名，最长 50 字符
  "type": "paper_folia",          // string，取值为 paper_folia 或 velocity
  "serverIds": ["<uuid>"]         // string[]，服务器 UUID 数组，至少 1 个且不得重复
}
```

`paper_folia` 须恰好绑定 1 台服务器，`velocity` 可绑定多台。

明文 `apiKey` 仅在**创建**与**重新生成**的响应中出现一次，后端仅存哈希。列表接口不返回该字段，丢失后仅可重新生成。

```jsonc
// 201
{
  // 其余字段略
  "apiKey": "<apiKey>"            // string，明文，仅在创建与重新生成的响应中出现一次
}
```

- `400`：`paper_folia` 绑定多台服务器、`serverIds` 存在重复或服务器不存在，或更新时未提供任何字段。
- `404` / `409`：服务器或 Key 不存在；`serverId` 或 `identifyId` 已被占用，或服务器仍被 API Key 绑定（此时不得删除）。

## 存储

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/storage` | 读取当前配置，`s3.secretAccessKey` 以掩码返回 |
| `PUT` | `/api/admin/storage` | 更新驱动与 S3 配置 |
| `POST` | `/api/admin/storage/test` | 使用已保存的配置测试 S3 连通性 |

`PUT` 的请求体如下：

```http
PUT /api/admin/storage
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "driver": "s3",                           // string，必填，取值为 local 或 s3；为 s3 时须同时提交 s3
  "uploadDir": "<uploadDir>",               // string，上传目录
  "s3": {                                   // object，driver 为 s3 时必填
    "endpoint": "<endpoint>",               // string
    "region": "<region>",                   // string
    "bucket": "<bucket>",                   // string
    "accessKeyId": "<accessKeyId>",         // string
    "secretAccessKey": "<secretAccessKey>", // string，传掩码值即沿用已保存的密钥
    "forcePathStyle": true,                 // boolean
    "presignExpiry": 300                    // number，默认 300
  }
}
```

- `400` / `409`：`driver` 为 `s3` 却缺少 `s3` 配置；已存在本地附件时不得更改上传目录，已存在 S3 附件时不得更改存储位置，响应将提示先迁移附件。
- `502`：`/test` 连接或鉴权失败。

## 限流

限流配置通过 `PATCH /api/setup/settings` 的 `rateLimit` 写入。四个分组均为可选，也可仅修改其中部分字段。秒数类字段取值 1-86400，`maxRequests` 取值 1-100000，`maxAttempts` 取值 1-100。

| 分组 | 字段 | 默认值 |
| --- | --- | --- |
| `global` | `windowSeconds` / `maxRequests` | 60 秒 / 100 次 |
| `auth` | `windowSeconds` / `maxRequests` | 60 秒 / 10 次 |
| `email` | `cooldownSeconds` | 60 秒 |
| `minecraftLink` | `maxAttempts` / `lockSeconds` | 5 次 / 900 秒 |

## 用户管理

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/users` | admin | 分页列表，返回 `{ users, total, page, pageSize }` |
| `GET` | `/api/users/assignable` | staff | 返回可受理议题的用户（`staff` / `admin`） |
| `GET` | `/api/users/:id` | admin | 返回单个用户详情 |
| `PATCH` | `/api/users/:id/role` | admin | 修改角色，请求体见下方示例 |
| `DELETE` | `/api/users/:id` | admin | 软删除，成功返回 `204` |

`role` 的取值为 `player`、`staff`、`admin`。软删除将标记用户并使 token 立即失效（`tokenEpoch` 变更），数据库记录保留。当前用户自身的资料通过 `/api/users/me/*` 修改（见 [认证与账户](./auth.md)），本套 API **不含** `GET /api/users/me`。

`PATCH /api/users/:id/role` 的请求体为：

```http
PATCH /api/users/:id/role
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  // string，必填，取值为 player / staff / admin
  "role": "staff"
}
```

- `400` / `404`：`role` 取值非法，或 `:id` 不是整数；用户不存在。

## 外部登录 Provider

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/federatedauth/providers` | 返回 Provider 列表 |
| `POST` | `/api/admin/federatedauth/providers` | 新建 Provider，成功返回 `201` |
| `PATCH` | `/api/admin/federatedauth/providers/:id` | 部分更新 |
| `DELETE` | `/api/admin/federatedauth/providers/:id` | 删除 Provider，成功返回 `204` |
| `DELETE` | `/api/admin/federatedauth/providers/:id/identities` | 解绑该 Provider 下的所有身份 |
| `POST` | `/api/admin/federatedauth/providers/:id/test` | 探测端点与元数据 |

必填与可选字段如下：

```http
POST /api/admin/federatedauth/providers
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```jsonc
{
  "slug": "<slug>",                               // string，必填，2-48 位小写字母数字与短横线
  "name": "<name>",                               // string，必填
  "protocol": "oidc",                             // string，必填，取值为 oidc 或 oauth
  "redirectUri": "<redirectUri>",                 // string，必填
  "clientId": "<clientId>",                       // string，必填
  "scope": "<scope>",                             // string，必填
  "subjectPath": "data.user.id",                  // string，必填，点号分隔的 JSON 路径
  "accessTokenPath": "<accessTokenPath>",         // string，必填，点号分隔的 JSON 路径
  "pkce": true,                                   // boolean，必填
  "secretMode": "<secretMode>",                   // string，必填
  "enabled": true,                                // boolean，必填
  "allowRegistration": false,                     // boolean，必填
  "issuer": "<issuer>",                           // string，可选，protocol 为 oidc 时必填
  "authorizationEndpoint": "<authorizationEndpoint>", // string，可选
  "tokenEndpoint": "<tokenEndpoint>",             // string，可选
  "userInfoEndpoint": "<userInfoEndpoint>",       // string，可选
  "clientSecret": "<clientSecret>",               // string，可选
  "iconUrl": "<iconUrl>",                         // string，可选
  "usernamePath": "<usernamePath>",               // string，可选，点号分隔的 JSON 路径
  "emailPath": "<emailPath>",                     // string，可选，点号分隔的 JSON 路径
  "avatarPath": "<avatarPath>",                   // string，可选，点号分隔的 JSON 路径
  "authorizationParams": {}                       // object，可选
}
```

`*Path` 为点号分隔的 JSON 路径（如 `data.user.id`）。

- `400`：URL 非法、`oidc` 缺少 `issuer`、路径格式错误，或 `secretMode` 与协议不兼容。
- `404` / `409`：Provider 不存在；`slug` 已存在。

## 完成钩子投递

议题关闭或标记无效时，后端将模板的 `completion_hooks` 下发给 Minecraft 插件。投递失败将被记录，并可重试。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/minecraft-hook-deliveries` | 返回投递记录列表 |
| `POST` | `/api/admin/minecraft-hook-deliveries/:id/retry` | 重新投递，返回更新后的记录 |

`404` 表示记录不存在，`409` 表示该记录当前不处于可重试状态。钩子的写法见 [完成钩子](../template/hooks.md)。

## 错误码

| HTTP | 语义 | 本页触发场景 |
| --- | --- | --- |
| `400` | 参数校验失败 | 字段类型错误、YAML 不合法、`paper_folia` 绑定多台服务器 |
| `401` | 未登录 | 缺少或失效的 Bearer token |
| `403` | 权限不足 | 非 `admin` 调用管理端点、非 `staff` 调用 `assignable` |
| `404` | 资源不存在 | 模板、玩家组、服务器、Provider、投递记录不存在 |
| `409` | 冲突 | key / 组 ID / `serverId` / `slug` 重复，模板被并发修改，删除被引用的组或已绑定的服务器 |
| `502` | 上游失败 | SMTP 测试失败、S3 连通性测试失败 |
