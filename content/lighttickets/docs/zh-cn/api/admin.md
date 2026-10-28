---
order: 50
---

# 管理后台 API

本页覆盖 `/api/admin/*`、`/api/setup/settings*`、`/api/branding/*`、`/api/servers` 与 `/api/users` 的管理端点，即管理后台前端使用的接口。响应遵循 [外部 API](./index.md) 的 envelope 约定，界面操作说明见 [管理后台](../guide/admin.md)。

::: warning 几乎全部需要 admin
除三个例外，本页所有端点都要求 `Authorization: Bearer <accessToken>` 且角色为 `admin`：`GET /api/branding/:slot`（公开读取）、`GET /api/player-groups/search`（任意登录用户）、`GET /api/users/assignable`（`staff` / `admin`）。缺少或失效的 token 返回 `401`，角色不足返回 `403`。
:::

## 站点设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/setup/settings` | 读取完整站点设置 |
| `PATCH` | `/api/setup/settings` | 部分更新，只改传入字段 |
| `POST` | `/api/setup/settings/mail/test` | 发送测试邮件验证 SMTP |

`PATCH` 的请求体是以下字段的子集，全部可选：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `requireLogin` / `allowWebRegister` / `allowMcRegister` / `sendEmailNotifications` | boolean | 浏览是否要求登录、网页注册、游戏内注册、议题邮件通知 |
| `siteName` / `defaultLanguage` | string | 站点名（最长 100）、默认语言 ID |
| `siteUrl` | string \| null | 仅含 origin 的 HTTP(S) 地址，保存时规范化 |
| `footerContent` | string \| null | 页脚内容，最长 2000 |
| `mail` | object | `enabled`、`host`、`port`、`secure`、`username`、`password`、`fromName`、`fromAddress` |
| `turnstile` | object | `enabled`、`siteKey`、`secretKey`（可传 `null` 清除） |
| `rateLimit` | object | 见下文「限流」 |
| `attachment` | object | `pendingQuotaMiB`、`pendingExpirationEnabled`、`pendingTtlDays` |

```json
{
  "siteUrl": "https://tickets.example.com",
  "mail": { "enabled": true, "host": "smtp.example.com", "port": 587 }
}
```

- `400`：字段校验失败（`siteUrl` 含路径或凭据、`fromAddress` 不是邮箱等）。

邮件、限流、Turnstile 都没有独立路由，全部经此端点写入，保存后立即生效。`POST /api/setup/settings/mail/test` 的请求体为 `{ "mail": { ... } }`，`mail` 可省略表示用已保存配置；连接或认证失败返回 `502`。

## 品牌资源

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/branding/:slot` | 公开 | 读取已上传图片，未上传返回 `404` |
| `PUT` | `/api/branding/:slot` | admin | `multipart/form-data` 上传，字段名 `file` |
| `DELETE` | `/api/branding/:slot` | admin | 删除该 slot 的自定义图片 |

`slot` 取值为 `favicon`、`favicon-dark`、`logo`、`logo-dark`。单文件上限 2 MiB，只接受 `png`、`jpg`、`webp`、`gif`、`svg`（按 MIME 判断）。`PUT` 未选文件时返回 `400`；`PUT` 与 `DELETE` 都返回四个 URL 字段的最新状态 `{ faviconUrl, faviconDarkUrl, logoUrl, logoDarkUrl }`，未上传为 `null`。

## 模板管理

与 [模板接口](./templates.md) 的只读端点不同，这里能读写被禁用的模板与原始 YAML。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/templates` | 列出全部模板（含 `enabled: false`） |
| `GET` | `/api/admin/templates/:name` | 单个模板的完整定义 |
| `POST` | `/api/admin/templates` | 新建，成功 `201` |
| `PATCH` | `/api/admin/templates/:name` | 部分更新 |
| `DELETE` | `/api/admin/templates/:name` | 删除模板文件，成功 `204` |

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 模板 key，1-50 字符，仅字母数字与 `_-`，创建后不可改 |
| `nameI18n` / `description` / `titlePrefix` | string | 展示名、描述、标题前缀（最长 50） |
| `labels` | string | JSON 字符串数组，例如 `"[\"bug\"]"` |
| `assigneeIds` | number[] | 自动受理人，必须是存在的 `staff` / `admin` 用户 |
| `body` / `completionHooks` | string | 字段定义与完成钩子数组，字符串形式（JSON 也是合法 YAML） |
| `source` | string | 整份 YAML 原文，优先于上面的结构化字段 |
| `enabled` / `hidden` | boolean | 是否启用（默认 `true`）、可见性策略（`true` / `false` / `"optional"`） |

- `400` / `409`：YAML 不合法、`player_select` 引用了不存在的玩家组、`assigneeIds` 含非 staff 用户；创建时模板 key 已存在、更新时文件已被其他请求修改（需重新加载后再提交）。

## 玩家组

玩家组供模板的 `player_select` 字段做候选池，成员批量写入一次最多 500 个玩家名。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/player-groups` | 组列表 |
| `GET` | `/api/admin/player-groups/:id` | 组内成员，分页 + `q` 搜索 |
| `POST` | `/api/admin/player-groups` | 建组，`{ id, name?, note? }`，成功 `201` |
| `PATCH` | `/api/admin/player-groups/:id` | 改 `name` / `note`，传 `null` 清空 |
| `DELETE` | `/api/admin/player-groups/:id` | 删组，成功 `204` |
| `POST` | `/api/admin/player-groups/:id/items` | 批量加成员，`{ "values": ["steve"] }`，成功 `201` |
| `PATCH` | `/api/admin/player-groups/:id/items/:itemId` | 改成员，`{ "value": "steve" }` |
| `DELETE` | `/api/admin/player-groups/:id/items/:itemId` | 删成员，成功 `204` |
| `GET` | `/api/player-groups/search` | **登录用户**按组搜索玩家名 |

`GET /api/player-groups/search` 的参数为 `groupIds`（逗号分隔或多值）、`q`（1-100 字符）与可选 `limit`（最大 100）。

- `400`：组 ID 或玩家名不符合命名规则、`values` 为空或超过 500。
- `404`：组或成员不存在。
- `409`：组 ID 已存在、成员已存在，或删除仍被模板与待处理完成钩子引用的组。

## 服务器与 API Key

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/servers` | 服务器列表 |
| `POST` | `/api/servers` | 新建，成功 `201` |
| `PATCH` | `/api/servers/:id` | 部分更新 |
| `DELETE` | `/api/servers/:id` | 删除，成功 `204` |
| `GET` | `/api/servers/api-keys` | Key 列表，不含明文 |
| `POST` | `/api/servers/api-keys` | 新建，成功 `201`，返回一次明文 |
| `PATCH` | `/api/servers/api-keys/:id` | 改 `title`、`type`、`serverIds` |
| `POST` | `/api/servers/api-keys/:id/regenerate` | 重新生成并返回明文 |
| `DELETE` | `/api/servers/api-keys/:id` | 删除，成功 `204` |

服务器字段：`serverId`（1-64，字母数字与 `._-`）、`identifyId`（插件上报的识别 ID，可含中文、不能含控制字符）、`alias`（最长 50）、`address`（最长 255）、`description`（最长 500）。

API Key 请求体：`title`（备注名，最长 50）、`type`（`paper_folia` \| `velocity`）、`serverIds`（服务器 UUID 数组，至少 1 个且不重复）。`paper_folia` 必须恰好绑定 1 台服务器，`velocity` 可绑定多台。

明文 `apiKey` 只在**创建**与**重新生成**的响应里出现一次（`{ ..., "apiKey": "<apiKey>" }`），服务端只存哈希；列表接口不返回该字段，丢失后只能重新生成。

- `400`：`paper_folia` 绑定多台服务器、`serverIds` 有重复或服务器不存在、更新时无任何字段。
- `404` / `409`：服务器或 Key 不存在；`serverId` 或 `identifyId` 已被占用；服务器仍被 API Key 绑定时不能删除。

## 存储

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/storage` | 读取当前配置，`s3.secretAccessKey` 以掩码返回 |
| `PUT` | `/api/admin/storage` | 更新驱动与 S3 配置 |
| `POST` | `/api/admin/storage/test` | 用已保存配置测试 S3 连通性 |

`PUT` 请求体：`driver`（`local` \| `s3`，必填）、`uploadDir`、`s3.endpoint`、`s3.region`、`s3.bucket`、`s3.accessKeyId`、`s3.secretAccessKey`、`s3.forcePathStyle`、`s3.presignExpiry`（默认 `300`）。`driver` 为 `s3` 时必须同时提交 `s3`；`secretAccessKey` 传掩码值表示沿用已保存的密钥。

- `400` / `409`：`driver` 为 `s3` 却缺少 `s3` 配置；已存在本地附件时不能改上传目录、已存在 S3 附件时不能改存储位置（提示先迁移附件）。
- `502`：`/test` 连接或鉴权失败。

## 限流

限流配置写在 `PATCH /api/setup/settings` 的 `rateLimit` 里，四个分组均可选、也可只改其中部分字段；秒数类字段取值 1-86400，`maxRequests` 取值 1-100000，`maxAttempts` 取值 1-100。

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
| `GET` | `/api/users/assignable` | staff | 可受理议题的用户（`staff` / `admin`） |
| `GET` | `/api/users/:id` | admin | 单个用户详情 |
| `PATCH` | `/api/users/:id/role` | admin | 改角色，`{ "role": "staff" }` |
| `DELETE` | `/api/users/:id` | admin | 软删除，成功 `204` |

`role` 取值 `player`、`staff`、`admin`。软删除会标记用户并使 token 立即失效（`tokenEpoch` 变更），数据库记录保留。当前用户自己的资料改走 `/api/users/me/*`（见 [认证与账户](./auth.md)），这套 API **没有** `GET /api/users/me`。

- `400` / `404`：`role` 取值非法或 `:id` 不是整数；用户不存在。

## 外部登录 Provider

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/federatedauth/providers` | Provider 列表 |
| `POST` | `/api/admin/federatedauth/providers` | 新建，成功 `201` |
| `PATCH` | `/api/admin/federatedauth/providers/:id` | 部分更新 |
| `DELETE` | `/api/admin/federatedauth/providers/:id` | 删除，成功 `204` |
| `DELETE` | `/api/admin/federatedauth/providers/:id/identities` | 解绑该 Provider 下所有身份 |
| `POST` | `/api/admin/federatedauth/providers/:id/test` | 探测端点与元数据 |

必填字段：`slug`（2-48 位小写字母数字与短横线）、`name`、`protocol`（`oidc` \| `oauth`）、`redirectUri`、`clientId`、`scope`、`subjectPath`、`accessTokenPath`、`pkce`、`secretMode`、`enabled`、`allowRegistration`。可选：`issuer`（`oidc` 必填）、`authorizationEndpoint`、`tokenEndpoint`、`userInfoEndpoint`、`clientSecret`、`iconUrl`、`usernamePath`、`emailPath`、`avatarPath`、`authorizationParams`。`*Path` 是点号分隔的 JSON 路径（如 `data.user.id`）。

- `400`：URL 非法、`oidc` 缺少 `issuer`、路径格式错误、`secretMode` 与协议不兼容。
- `404` / `409`：Provider 不存在；`slug` 已存在。

## 完成钩子投递

议题关闭或标记无效时，后端把模板的 `completion_hooks` 下发给 Minecraft 插件，失败会记录并可重试。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/minecraft-hook-deliveries` | 投递记录列表 |
| `POST` | `/api/admin/minecraft-hook-deliveries/:id/retry` | 重新投递，返回更新后的记录 |

`404` 表示记录不存在，`409` 表示该记录当前不处于可重试状态。钩子写法见 [完成钩子](../template/hooks.md)。

## 常见错误码

| HTTP | 语义 | 本页典型触发 |
| --- | --- | --- |
| `400` | 参数校验失败 | 字段类型错误、YAML 不合法、`paper_folia` 绑定多台服务器 |
| `401` | 未登录 | 缺少或失效的 Bearer token |
| `403` | 权限不足 | 非 `admin` 调用管理端点、非 `staff` 调用 `assignable` |
| `404` | 资源不存在 | 模板、玩家组、服务器、Provider、投递记录不存在 |
| `409` | 冲突 | key / 组 ID / `serverId` / `slug` 重复，模板被并发修改，删除被引用的组或已绑定的服务器 |
| `502` | 上游失败 | SMTP 测试失败、S3 连通性测试失败 |
