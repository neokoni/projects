---
order: 20
---

# 认证与账户

## 初始化与站点配置

### GET /api/setup/site-config

公开接口，无需认证，前端启动时用它决定注册、登录与主题相关行为。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `isSetup` | boolean | 站点是否已完成初始化；`false` 时前端跳转初始化页 |
| `requireLogin` | boolean | 是否要求登录才能浏览议题，影响所有条件鉴权读接口 |
| `allowWebRegister` | boolean | 是否允许网页注册 |
| `allowMcRegister` | boolean | 是否允许通过游戏内注册链接创建账户 |
| `passwordResetEnabled` | boolean | SMTP 可用且 `siteUrl` 为 HTTPS origin 时为 `true` |
| `registrationEmailVerificationEnabled` | boolean | 仅取决于 SMTP 是否可用，决定注册是否需要邮箱验证码 |
| `siteName` | string | 站点名，用于页面标题与邮件抬头 |
| `siteUrl` | string \| null | 规范化的公开 origin，用于邮件里的绝对链接 |
| `footerContent` | string \| null | 页脚自定义内容 |
| `defaultLanguage` | string | 默认语言 ID，例如 `zh-CN` |
| `turnstile` | object | `{ enabled, siteKey }`，只含公开 Site Key，不含 Secret |
| `faviconUrl` / `faviconDarkUrl` | string \| null | 自定义站点图标地址，未上传为 `null` |
| `logoUrl` / `logoDarkUrl` | string \| null | 自定义 Logo 地址，未上传为 `null` |
| `federatedAuthProviders` | array | 已启用 Provider 的公开信息：名称、图标、slug 与注册开关 |

```json
{
  "success": true,
  "data": {
    "isSetup": true,
    "requireLogin": false,
    "allowWebRegister": true,
    "allowMcRegister": true,
    "passwordResetEnabled": false,
    "registrationEmailVerificationEnabled": true,
    "siteName": "LightTickets",
    "siteUrl": "https://tickets.example.com",
    "footerContent": null,
    "defaultLanguage": "zh-CN",
    "turnstile": { "enabled": false, "siteKey": "" },
    "faviconUrl": "/api/branding/favicon?v=1758800000000",
    "faviconDarkUrl": null,
    "logoUrl": null,
    "logoDarkUrl": null,
    "federatedAuthProviders": []
  }
}
```

### POST /api/setup

一次性初始化接口，只在初始化服务器中挂载；已初始化后该路径不再可写。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `db.provider` | `sqlite` \| `mysql` | 是 | 数据库类型 |
| `db.host` / `db.port` / `db.username` / `db.password` / `db.database` | — | MySQL 时 `host`、`username`、`database` 必填 | MySQL 连接信息 |
| `db.args` | string | 否 | 追加连接参数 |
| `admin.email` | string | 是 | 管理员邮箱，保存时转为小写 |
| `admin.password` | string | 是 | 至少 8 位 |
| `admin.username` | string | 是 | 2-30 字符 |
| `site.siteName` | string | 否 | 站点名 |
| `site.siteUrl` | string | 否 | 仅含 origin 的 HTTP(S) 地址，保存时规范化 |
| `site.defaultLanguage` | string | 否 | 默认语言 ID |
| `mc.defaultServerName` | string | 否 | 默认 Minecraft 服务器标识 |
| `storage.driver` | `local` \| `s3` | 否 | 存储驱动，选 `s3` 时必须带 `storage.s3` |
| `storage.s3.*` | object | 否 | `endpoint`、`region`、`bucket`、`accessKeyId`、`secretAccessKey`、`forcePathStyle`、`presignExpiry` |

```json
{
  "db": { "provider": "sqlite" },
  "admin": { "email": "admin@example.com", "password": "Password123!", "username": "admin" },
  "site": { "siteName": "LightTickets", "siteUrl": "https://tickets.example.com", "defaultLanguage": "zh-CN" },
  "storage": { "driver": "local" }
}
```

成功返回 `201`，响应体含 `user` 与 `accessToken`，同时通过 Cookie 下发 refresh token，并创建默认模板与 `AppConfig`。

- `400`：字段校验失败、`siteUrl` 含路径或凭据、S3 配置不完整。
- `409`：站点已初始化。Turnstile 默认关闭，初始化接口不接受 Turnstile 配置，只能在管理后台启用。

## 注册与登录

### POST /api/auth/register/verification-code

公开接口，挂认证限流。SMTP 可用时网页注册必须先取验证码；`allowWebRegister` 与 `allowMcRegister` 同时关闭时返回 `403`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 接收验证码的邮箱 |
| `turnstileToken` | string | 按站点设置 | 启用 Turnstile 时必填 |

```json
{ "accepted": true, "retryAfterSeconds": 60 }
```

验证码为 6 位数字、10 分钟有效、最多 5 次错误尝试；`retryAfterSeconds` 是当前生效的发送冷却秒数。

### POST /api/auth/register

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 注册邮箱 |
| `password` | string | 是 | 至少 8 位 |
| `username` | string | 是 | 2-32 字符 |
| `emailVerificationCode` | string | SMTP 可用时必填 | 6 位验证码，创建用户时同事务消费 |
| `turnstileToken` | string | 按站点设置 | 需重新获取，取码时的 token 已被消费 |
| `mcRegisterToken` | string | 否 | 游戏内 `/lit register` 链接携带的一次性 token |

成功返回 `201` 与 `{ user, accessToken }`，并设置 refresh cookie。带 `mcRegisterToken` 时由 `allowMcRegister` 决定是否允许，注册成功后自动绑定对应 Minecraft 账号。

- `400`：验证码错误或过期、token 无效。
- `403`：对应注册开关已关闭。
- `409`：邮箱或 Minecraft 账号已被占用。

### POST /api/auth/login

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `emailOrUsername` | string | 是 | 含 `@` 时按邮箱查找，否则按用户名 |
| `password` | string | 是 | 登录密码 |
| `turnstileToken` | string | 按站点设置 | 启用 Turnstile 时必填 |

```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "player", "role": "player", "email": "user@example.com" },
    "accessToken": "<accessToken>"
  }
}
```

登录失败统一返回 `401`「邮箱/用户名或密码错误」，不区分账号是否存在。

### POST /api/auth/refresh

浏览器客户端不需要请求体，后端读取 `lt_refresh_token` Cookie 并轮换 refresh token。响应体为 `{ accessToken, user }`，新的 refresh token 通过 Cookie 下发。

- `400`：请求体带了非空字段（该端点只接受空对象）。
- `401`：Cookie 缺失、refresh session 已失效或被撤销。

### POST /api/auth/logout

无需 Bearer Token。存在 refresh cookie 时幂等撤销对应 session，并始终清除 cookie，返回 `204` 无响应体。

### POST /api/auth/password-reset/request

公开接口，挂认证限流。SMTP 需在后台启用，且 `siteUrl` 必须是 HTTPS origin，否则返回 `400` 且不发送邮件。请求体 `{ "emailOrUsername": "user@example.com", "turnstileToken": "<token>" }`，成功固定返回 `{ "accepted": true }`，不暴露账号是否存在。

### POST /api/auth/password-reset/confirm

请求体 `{ "token": "<resetToken>", "password": "NewPassword123!" }`。成功返回 `{ "reset": true }` 并作废该用户未使用的重置 token；`400` 表示 token 无效、过期或已使用。

### POST /api/auth/link-minecraft

需要 bearer。请求体 `{ "code": "123456" }`，`code` 为游戏内生成的 6 位绑定码。

- `400`：绑定码格式错误、无效或过期。
- `409`：该 Minecraft 账号已绑定其他账户。
- `429`：连续失败达到 `minecraftLink.maxAttempts` 后锁定 `lockSeconds`。

### DELETE /api/auth/link-minecraft

需要 bearer，解绑当前用户的 Minecraft 账号，返回更新后的用户对象。

## 外部登录

外部登录流程使用 HttpOnly 浏览器绑定 Cookie 与 `state`，默认启用 PKCE；OIDC 额外校验 nonce 与 ID Token。未绑定身份不会按 Provider 邮箱自动匹配账户。

### POST /api/auth/federatedauth/:slug/start

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `slug` | 路径 | Provider 标识，2-48 位小写字母、数字与短横线 |
| `returnTo` | 请求体 | 登录成功后的站内跳转路径，默认 `/` |

```json
{ "authorizationUrl": "https://provider.example.com/oauth/authorize?..." }
```

浏览器拿到地址后跳转即可，同时会写入流程 Cookie。

### GET /api/auth/federatedauth/:slug/callback

Provider 回调地址。成功时 `303` 跳回前端并下发 refresh cookie；允许注册时改为进入账户创建流程，写入注册会话 Cookie。任何失败都会清空流程 Cookie 并 `303` 跳转到 `/login?federatedauth=failed`。

### GET /api/auth/federatedauth/registration/session

读取注册会话 Cookie，返回创建账户所需的提示信息：

```json
{ "provider": { "name": "Example", "iconUrl": null }, "usernameHint": "steve", "emailHint": "steve@example.com" }
```

`401` 表示会话缺失或已过期。

### POST /api/auth/federatedauth/registration/verification-code

请求体 `{ "email": "user@example.com", "turnstileToken": "<token>" }`。邮箱验证码策略与普通网页注册一致；`403` 表示该 Provider 不允许创建账户或网页注册已关闭。

### POST /api/auth/federatedauth/registration/complete

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 新账户邮箱 |
| `username` | string | 是 | 2-32 字符 |
| `password` | string | 是 | 8-128 位本地密码 |
| `emailVerificationCode` | string | SMTP 可用时必填 | 6 位验证码 |
| `turnstileToken` | string | 按站点设置 | Turnstile token |

成功返回 `201` 与 `{ user, accessToken }`，账户与身份绑定在同一次数据库事务中创建。

## 语言资源

### GET /api/i18n/languages

公开接口，返回内置语言（`zh-CN`、`en-US`）与 `data/locales/*.json` 自定义语言的清单，每项包含 `id`、`source` 与清单字段（如显示名称）。

### GET /api/i18n/languages/:id

公开接口，返回合并后的语言包。自定义语言缺失的 key 回退到内置 `zh-CN`：

```json
{
  "id": "zh-CN",
  "properties": { "name": "简体中文" },
  "messages": { "ticket.status.open": "开放", "common.save": "保存" }
}
```

`messages` 是扁平的的点号 key 映射，前端直接按键取值。`400` 表示语言 ID 含非法字符。

## 当前用户设置

以下端点都需要 bearer，`401` 表示未登录或 token 已失效。

### PATCH /api/users/me/avatar

请求体 `{ "avatarUrl": "https://example.com/a.png" }`，`avatarUrl` 只接受 `http(s)` 地址、`null` 或空字符串（后两者清空头像），返回更新后的用户对象。

### PATCH /api/users/me/username

请求体 `{ "username": "newname" }`，2-32 字符，返回更新后的用户对象；用户名重复返回 `409`。

### PATCH /api/users/me/password

请求体 `{ "currentPassword": "...", "newPassword": "..." }`，新密码 8-128 位。成功后当前 token 的 `tokenEpoch` 变更使其他会话失效，并在响应中通过 Cookie 下发新的 refresh token，返回 `{ "message": "密码已更新" }`。当前密码错误返回 `400`。

### PATCH /api/users/me/email

请求更换邮箱，请求体 `{ "email": "new@example.com", "currentPassword": "..." }`。只写入 `pendingEmail`，同时向新邮箱发送 6 位验证码、向旧邮箱发送撤销链接。要求 SMTP 可用且 `siteUrl` 为 HTTPS origin，否则返回 `400`。

```json
{ "accepted": true, "pendingEmail": "new@example.com", "retryAfterSeconds": 60 }
```

### POST /api/users/me/email/verify

请求体 `{ "code": "123456" }`。验证通过后在事务内切换邮箱、清除 pending 状态、撤销旧 refresh session，并通过 Cookie 下发替换后的 refresh token，返回更新后的用户对象。

### DELETE /api/users/me/email

取消自己的待验证邮箱更换，返回 `{ "cancelled": true }`。

### POST /api/users/email-change/cancel

公开接口，请求体 `{ "token": "..." }`，其中 token 来自旧邮箱收到的撤销链接。仅取消尚未完成的 pending 更换，不消耗登录态。

### PATCH /api/users/me/notifications

请求体 `{ "receiveEmailNotifications": true }`，新用户默认 `true`。返回更新后的用户对象。

### POST /api/users/email-notifications/unsubscribe

公开接口，请求体 `{ "token": "..." }`，token 为邮件中的签名令牌；成功后关闭该用户的个人邮件通知。访问邮件链接本身不会直接退订。

### GET /api/users/me/federatedauth

列出当前用户已绑定的外部身份。

### POST /api/users/me/federatedauth/:value/start

`:value` 为 Provider slug，请求体 `{ "returnTo": "/settings" }`，返回 `{ "authorizationUrl": "..." }`，用于已登录状态下主动绑定外部身份。

### DELETE /api/users/me/federatedauth/:value

请求体 `{ "currentPassword": "..." }`，解绑当前用户的该 Provider 身份，成功返回 `204`。密码错误返回 `400`，未绑定返回 `404`。

管理员侧的 Provider 管理见 [管理后台 API](./admin.md)。
