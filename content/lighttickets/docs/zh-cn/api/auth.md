---
order: 20
---

# 认证与账户

## 初始化与站点配置

### GET /api/setup/site-config

该端点公开，无需认证。前端在启动时依据其返回值决定注册、登录与主题相关行为。

```http
GET /api/setup/site-config
```

```jsonc
// 200
{
  "isSetup": true, // boolean，站点初始化状态；值为 false 时前端跳转至初始化页
  "requireLogin": false, // boolean，是否要求登录才能浏览议题，影响所有条件鉴权读接口
  "allowWebRegister": true, // boolean，是否允许网页注册
  "allowMcRegister": true, // boolean，是否允许通过游戏内注册链接创建账户
  "passwordResetEnabled": false, // boolean，SMTP 可用且 siteUrl 为 HTTPS origin 时为 true
  "registrationEmailVerificationEnabled": true, // boolean，仅取决于 SMTP 可用性，决定注册是否需要邮箱验证码
  "siteName": "LightTickets", // string，站点名，用于页面标题与邮件抬头
  "siteUrl": "https://tickets.example.com", // string | null，规范化的公开 origin，用于邮件中的绝对链接
  "footerContent": null, // string | null，页脚自定义内容
  "defaultLanguage": "zh-CN", // string，默认语言 ID
  "turnstile": { // object，仅含公开 Site Key、不含 Secret
    "enabled": false, // boolean，是否启用
    "siteKey": "" // string，公开 Site Key
  },
  "faviconUrl": "/api/branding/favicon?v=1758800000000", // string | null，自定义站点图标地址，未上传时为 null
  "faviconDarkUrl": null, // string | null，自定义站点图标地址，未上传时为 null
  "logoUrl": null, // string | null，自定义 Logo 地址，未上传时为 null
  "logoDarkUrl": null, // string | null，自定义 Logo 地址，未上传时为 null
  "federatedAuthProviders": [] // array，已启用 Provider 的公开信息：名称、图标、slug 与注册开关
}
```

### POST /api/setup

该端点用于一次性初始化，仅在初始化服务器中挂载。站点完成初始化后，该路径不再接受写入。

```http
POST /api/setup
Content-Type: application/json
```

```jsonc
{
  "db": { // object，必填，数据库连接
    "provider": "sqlite" // "sqlite" | "mysql"，数据库类型；MySQL 时连接信息为 host、port、username、password、database，其中 host、username、database 必填
  },
  "admin": { // object，必填，管理员账户
    "email": "admin@example.com", // string，管理员邮箱，保存时转为小写
    "password": "Password123!", // string，至少 8 位
    "username": "admin" // string，2-30 字符
  },
  "site": { // object，可选，站点信息
    "siteName": "LightTickets", // string，站点名
    "siteUrl": "https://tickets.example.com", // string，仅含 origin 的 HTTP(S) 地址，保存时规范化
    "defaultLanguage": "zh-CN" // string，默认语言 ID
  },
  "storage": { // object，可选，存储配置
    "driver": "local" // "local" | "s3"，存储驱动；取值为 "s3" 时须同时提供 storage.s3（endpoint、region、bucket、accessKeyId、secretAccessKey、forcePathStyle、presignExpiry）
  }
  // 其余可选字段：db.args（string，追加连接参数）、mc.defaultServerName（string，默认 Minecraft 服务器标识）
}
```

```jsonc
// 201
{
  "user": { // object，用户对象
    "id": 1, // integer
    "username": "player", // string
    "role": "player", // string
    "email": "user@example.com" // string
  },
  "accessToken": "<accessToken>" // string，访问令牌
}
```

响应同时通过 Cookie 下发 refresh token，并创建默认模板与 `AppConfig`。

- `400`：字段校验失败，或 `siteUrl` 含路径或凭据，或 S3 配置不完整。
- `409`：站点已初始化。Turnstile 默认关闭；Turnstile 配置仅可在管理后台启用，初始化接口不接受该配置。

## 注册与登录

### POST /api/auth/register/verification-code

该端点公开，并受认证限流约束。SMTP 可用时，网页注册须先获取验证码；`allowWebRegister` 与 `allowMcRegister` 同时关闭时，返回 `403`。

```http
POST /api/auth/register/verification-code
Content-Type: application/json
```

```jsonc
{
  "email": "user@example.com", // string，必填，接收验证码的邮箱
  "turnstileToken": "<token>" // string，启用 Turnstile 时必填
}
```

```jsonc
// 200
{
  "accepted": true, // boolean
  "retryAfterSeconds": 60 // number，当前生效的发送冷却秒数
}
```

验证码为 6 位数字，有效期 10 分钟，最多允许 5 次错误尝试。

### POST /api/auth/register

```http
POST /api/auth/register
Content-Type: application/json
```

```jsonc
{
  "email": "user@example.com", // string，必填，注册邮箱
  "password": "Password123!", // string，必填，至少 8 位
  "username": "player", // string，必填，2-32 字符
  "emailVerificationCode": "<code>", // string，SMTP 可用时必填，6 位验证码，创建用户时在同一事务中消费
  "turnstileToken": "<token>", // string，启用 Turnstile 时必填，须重新获取；取码时的 token 已被消费
  "mcRegisterToken": "<token>" // string，可选，游戏内 /lit register 链接携带的一次性 token
}
```

```jsonc
// 201
{
  "user": { // object，用户对象
    "id": 1, // integer
    "username": "player", // string
    "role": "player", // string
    "email": "user@example.com" // string
  },
  "accessToken": "<accessToken>" // string，访问令牌
}
```

响应同时设置 refresh cookie。请求带 `mcRegisterToken` 时，是否允许由 `allowMcRegister` 决定；注册成功后自动绑定对应的 Minecraft 账号。

- `400`：验证码错误或过期，或 token 无效。
- `403`：对应注册开关已关闭。
- `409`：邮箱或 Minecraft 账号已被占用。

### POST /api/auth/login

```http
POST /api/auth/login
Content-Type: application/json
```

```jsonc
{
  "emailOrUsername": "admin@example.com", // string，必填，登录标识；含 @ 时按邮箱查找，否则按用户名
  "password": "Password123!", // string，必填，登录密码
  "turnstileToken": "<token>" // string，启用 Turnstile 时必填
}
```

```jsonc
// 200
{
  "user": { // object，用户对象
    "id": 1, // integer
    "username": "player", // string
    "role": "player", // string
    "email": "user@example.com" // string
  },
  "accessToken": "<accessToken>" // string，访问令牌
}
```

登录失败时统一返回 `401`「邮箱/用户名或密码错误」，不区分账户是否存在。

### POST /api/auth/refresh

浏览器客户端无需请求体。后端读取 `lt_refresh_token` Cookie 并轮换 refresh token，新的 refresh token 通过 Cookie 下发。

```http
POST /api/auth/refresh
```

```jsonc
// 200
{
  "accessToken": "<accessToken>", // string，访问令牌
  "user": { // object，用户对象
    "id": 1, // integer
    "username": "player", // string
    "role": "player", // string
    "email": "user@example.com" // string
  }
}
```

- `400`：请求体含非空字段，该端点仅接受空对象。
- `401`：Cookie 缺失，或 refresh session 已失效或被撤销。

### POST /api/auth/logout

该端点无需 Bearer Token。该端点在存在 refresh cookie 时幂等撤销对应的 session，并始终清除 cookie，返回 `204` 且无响应体。

```http
POST /api/auth/logout
```

### POST /api/auth/password-reset/request

该端点公开，并受认证限流约束。SMTP 须在管理后台启用，且 `siteUrl` 须为 HTTPS origin；否则返回 `400` 且不发送邮件。

```http
POST /api/auth/password-reset/request
Content-Type: application/json
```

```jsonc
{
  "emailOrUsername": "user@example.com", // string，邮箱或用户名
  "turnstileToken": "<token>" // string，Turnstile token
}
```

```jsonc
// 200
{
  "accepted": true // boolean，固定返回，不暴露账户是否存在
}
```

### POST /api/auth/password-reset/confirm

```http
POST /api/auth/password-reset/confirm
Content-Type: application/json
```

```jsonc
{
  "token": "<resetToken>", // string，重置 token
  "password": "NewPassword123!" // string，新密码
}
```

```jsonc
// 200
{
  "reset": true // boolean
}
```

成功后作废该用户未使用的重置 token；`400` 表示 token 无效、已过期或已使用。

### POST /api/auth/link-minecraft

该端点需要 bearer。

```http
POST /api/auth/link-minecraft
Content-Type: application/json
```

```jsonc
{
  "code": "123456" // string，游戏内生成的 6 位绑定码
}
```

```jsonc
// 200
{
  "uuid": "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0", // string，绑定码对应的 Minecraft 账号 UUID
  "name": "Steve" // string，绑定码对应的 Minecraft 玩家名
}
```

- `400`：绑定码格式错误、无效或过期。
- `409`：该 Minecraft 账号已绑定其他账户。
- `429`：连续失败次数达到 `minecraftLink.maxAttempts` 后，锁定 `lockSeconds`。

### DELETE /api/auth/link-minecraft

该端点需要 bearer。其解绑当前用户的 Minecraft 账号，并返回更新后的用户对象。

```http
DELETE /api/auth/link-minecraft
```

```jsonc
// 200
{
  "id": 1, // integer，用户 ID
  "email": "user@example.com", // string，邮箱
  "pendingEmail": null, // string | null，待验证的新邮箱，无待验证更换时为 null
  "username": "player", // string，用户名
  "minecraftUuid": null, // string | null，解绑后为 null
  "minecraftName": null, // string | null，解绑后为 null
  "avatarUrl": null, // string | null，头像地址
  "receiveEmailNotifications": true, // boolean，是否接收个人邮件通知
  "role": "player", // "player" | "staff" | "admin"，角色
  "createdAt": "2026-01-01T00:00:00.000Z", // string，注册时间，ISO 8601
  "updatedAt": "2026-01-01T00:00:00.000Z", // string，最后更新时间，ISO 8601
  "deletedAt": null // string | null，注销时间，未注销时为 null
}
```

## 外部登录

外部登录流程使用 HttpOnly 浏览器绑定 Cookie 与 `state`，默认启用 PKCE；OIDC 额外校验 nonce 与 ID Token。未绑定的身份不会按 Provider 邮箱自动匹配账户。

### POST /api/auth/federatedauth/:slug/start

`:slug` 为 Provider 标识，2-48 位小写字母、数字与短横线。

```http
POST /api/auth/federatedauth/:slug/start
Content-Type: application/json
```

```jsonc
{
  "returnTo": "/" // string，登录成功后的站内跳转路径，默认 /
}
```

```jsonc
// 200
{
  "authorizationUrl": "https://provider.example.com/oauth/authorize?..." // string，授权地址
}
```

浏览器取得该地址后跳转。该响应同时写入流程 Cookie。

### GET /api/auth/federatedauth/:slug/callback

该端点为 Provider 回调地址。成功时返回 `303` 跳回前端，并下发 refresh cookie；允许注册时改为进入账户创建流程，并写入注册会话 Cookie。任何失败均清空流程 Cookie，并以 `303` 跳转到 `/login?federatedauth=failed`。

```http
GET /api/auth/federatedauth/:slug/callback
```

### GET /api/auth/federatedauth/registration/session

该端点读取注册会话 Cookie，返回创建账户所需的提示信息。

```http
GET /api/auth/federatedauth/registration/session
```

```jsonc
// 200
{
  "provider": { // object，Provider 公开信息
    "name": "Example", // string，Provider 名称
    "iconUrl": null // string | null，Provider 图标地址
  },
  "usernameHint": "steve", // string，用户名提示
  "emailHint": "steve@example.com" // string，邮箱提示
}
```

`401` 表示会话缺失或已过期。

### POST /api/auth/federatedauth/registration/verification-code

邮箱验证码策略与普通网页注册一致；`403` 表示该 Provider 不允许创建账户，或网页注册已关闭。

```http
POST /api/auth/federatedauth/registration/verification-code
Content-Type: application/json
```

```jsonc
{
  "email": "user@example.com", // string，接收验证码的邮箱
  "turnstileToken": "<token>" // string，Turnstile token
}
```

```jsonc
// 200
{
  "accepted": true, // boolean，固定返回
  "retryAfterSeconds": 60 // number，当前生效的发送冷却秒数
}
```

### POST /api/auth/federatedauth/registration/complete

```http
POST /api/auth/federatedauth/registration/complete
Content-Type: application/json
```

```jsonc
{
  "email": "user@example.com", // string，必填，新账户邮箱
  "username": "player", // string，必填，2-32 字符
  "password": "Password123!", // string，必填，本地密码，8-128 位
  "emailVerificationCode": "<code>", // string，SMTP 可用时必填，6 位验证码
  "turnstileToken": "<token>" // string，Turnstile token
}
```

```jsonc
// 201
{
  "user": { // object，用户对象
    "id": 1, // integer
    "username": "player", // string
    "role": "player", // string
    "email": "user@example.com" // string
  },
  "accessToken": "<accessToken>" // string，访问令牌
}
```

账户与身份绑定在同一次数据库事务中创建。

## 语言资源

### GET /api/i18n/languages

该端点公开，返回内置语言（`zh-CN`、`en-US`）与 `data/locales/*.json` 中自定义语言的清单，每项包含 `id`、`source` 与清单字段（如显示名称）。

```http
GET /api/i18n/languages
```

```jsonc
// 200
[
  {
    "id": "en-US", // string，语言 ID，取自文件名
    "source": "internal", // "internal" | "custom"，内置语言或 data/locales 下的自定义语言
    "displayName": "English", // string，显示名称，取自 manifest.displayName
    "direction": "ltr" // "ltr" | "rtl"，书写方向，未声明时为 ltr
  },
  {
    "id": "zh-CN", // string，语言 ID
    "source": "internal", // "internal" | "custom"
    "displayName": "简体中文", // string，显示名称
    "direction": "ltr" // "ltr" | "rtl"
  }
]
```

数组按 `id` 升序排列。自定义语言的 `id` 与内置语言相同时，`source` 为 `custom`，清单字段与文案取合并后的结果。

### GET /api/i18n/languages/:id

该端点公开，返回合并后的语言包。自定义语言缺失的 key 回退到内置 `zh-CN`。

```http
GET /api/i18n/languages/:id
```

```jsonc
// 200
{
  "id": "zh-CN", // string，语言 ID
  "properties": { // object，合并后的清单字段
    "displayName": "简体中文", // string，显示名称
    "direction": "ltr" // "ltr" | "rtl"，书写方向
  },
  "messages": { // object，扁平的点号 key 映射，前端直接按键取值
    "ticket.status.open": "开放", // string
    "common.save": "保存" // string
  }
}
```

`400` 表示语言 ID 含非法字符。

## 当前用户设置

以下端点均需要 bearer。`401` 表示未登录或 token 已失效。

### PATCH /api/users/me/avatar

```http
PATCH /api/users/me/avatar
Content-Type: application/json
```

```jsonc
{
  "avatarUrl": "https://example.com/a.png" // string | null，仅接受 http(s) 地址、null 或空字符串，后两者将清空头像
}
```

```jsonc
// 200
{
  "id": 1, // integer，用户 ID
  "email": "user@example.com", // string，邮箱
  "pendingEmail": null, // string | null，待验证的新邮箱，无待验证更换时为 null
  "username": "player", // string，用户名
  "minecraftUuid": null, // string | null，绑定的 Minecraft 账号 UUID，未绑定时为 null
  "minecraftName": null, // string | null，绑定的 Minecraft 玩家名，未绑定时为 null
  "avatarUrl": "https://example.com/a.png", // string | null，头像地址，提交 null 或空字符串后为 null
  "receiveEmailNotifications": true, // boolean，是否接收个人邮件通知
  "role": "player", // "player" | "staff" | "admin"，角色
  "createdAt": "2026-01-01T00:00:00.000Z", // string，注册时间，ISO 8601
  "updatedAt": "2026-01-01T00:00:00.000Z", // string，最后更新时间，ISO 8601
  "deletedAt": null // string | null，注销时间，未注销时为 null
}
```

该端点返回更新后的用户对象。

### PATCH /api/users/me/username

```http
PATCH /api/users/me/username
Content-Type: application/json
```

```jsonc
{
  "username": "newname" // string，2-32 字符
}
```

```jsonc
// 200
{
  "id": 1, // integer，用户 ID
  "email": "user@example.com", // string，邮箱
  "pendingEmail": null, // string | null，待验证的新邮箱，无待验证更换时为 null
  "username": "newname", // string，更新后的用户名
  "minecraftUuid": null, // string | null，绑定的 Minecraft 账号 UUID，未绑定时为 null
  "minecraftName": null, // string | null，绑定的 Minecraft 玩家名，未绑定时为 null
  "avatarUrl": null, // string | null，头像地址，未设置时为 null
  "receiveEmailNotifications": true, // boolean，是否接收个人邮件通知
  "role": "player", // "player" | "staff" | "admin"，角色
  "createdAt": "2026-01-01T00:00:00.000Z", // string，注册时间，ISO 8601
  "updatedAt": "2026-01-01T00:00:00.000Z", // string，最后更新时间，ISO 8601
  "deletedAt": null // string | null，注销时间，未注销时为 null
}
```

该端点返回更新后的用户对象；用户名重复时返回 `409`。

### PATCH /api/users/me/password

```http
PATCH /api/users/me/password
Content-Type: application/json
```

```jsonc
{
  "currentPassword": "<currentPassword>", // string，当前密码
  "newPassword": "<newPassword>" // string，新密码，8-128 位
}
```

```jsonc
// 200
{
  "message": "密码已更新" // string
}
```

成功后当前 token 的 `tokenEpoch` 变更，使其他会话失效；响应通过 Cookie 下发新的 refresh token。当前密码错误时返回 `400`。

### PATCH /api/users/me/email

该端点用于请求更换邮箱。其仅写入 `pendingEmail`，同时向新邮箱发送 6 位验证码，向旧邮箱发送撤销链接。该端点要求 SMTP 可用且 `siteUrl` 为 HTTPS origin，否则返回 `400`。

```http
PATCH /api/users/me/email
Content-Type: application/json
```

```jsonc
{
  "email": "new@example.com", // string，新邮箱
  "currentPassword": "<currentPassword>" // string，当前密码
}
```

```jsonc
// 200
{
  "accepted": true, // boolean
  "pendingEmail": "new@example.com", // string，待验证的新邮箱
  "retryAfterSeconds": 60 // number，发送冷却秒数
}
```

### POST /api/users/me/email/verify

```http
POST /api/users/me/email/verify
Content-Type: application/json
```

```jsonc
{
  "code": "123456" // string，6 位验证码
}
```

```jsonc
// 200
{
  "id": 1, // integer，用户 ID
  "email": "new@example.com", // string，切换后的邮箱
  "pendingEmail": null, // string | null，验证通过后清空
  "username": "player", // string，用户名
  "minecraftUuid": null, // string | null，绑定的 Minecraft 账号 UUID，未绑定时为 null
  "minecraftName": null, // string | null，绑定的 Minecraft 玩家名，未绑定时为 null
  "avatarUrl": null, // string | null，头像地址，未设置时为 null
  "receiveEmailNotifications": true, // boolean，是否接收个人邮件通知
  "role": "player", // "player" | "staff" | "admin"，角色
  "createdAt": "2026-01-01T00:00:00.000Z", // string，注册时间，ISO 8601
  "updatedAt": "2026-01-01T00:00:00.000Z", // string，最后更新时间，ISO 8601
  "deletedAt": null // string | null，注销时间，未注销时为 null
}
```

验证通过后，在事务内切换邮箱、清除 pending 状态、撤销旧 refresh session，并通过 Cookie 下发替换后的 refresh token，返回更新后的用户对象。

### DELETE /api/users/me/email

该端点取消当前用户的待验证邮箱更换。

```http
DELETE /api/users/me/email
```

```jsonc
// 200
{
  "cancelled": true // boolean
}
```

### POST /api/users/email-change/cancel

该端点公开，其仅取消尚未完成的 pending 更换，不消耗登录态。

```http
POST /api/users/email-change/cancel
Content-Type: application/json
```

```jsonc
{
  "token": "<token>" // string，来自旧邮箱收到的撤销链接
}
```

```jsonc
// 200
{
  "cancelled": true // boolean，固定返回
}
```

### PATCH /api/users/me/notifications

```http
PATCH /api/users/me/notifications
Content-Type: application/json
```

```jsonc
{
  "receiveEmailNotifications": true // boolean，新用户默认为 true
}
```

```jsonc
// 200
{
  "id": 1, // integer，用户 ID
  "email": "user@example.com", // string，邮箱
  "pendingEmail": null, // string | null，待验证的新邮箱，无待验证更换时为 null
  "username": "player", // string，用户名
  "minecraftUuid": null, // string | null，绑定的 Minecraft 账号 UUID，未绑定时为 null
  "minecraftName": null, // string | null，绑定的 Minecraft 玩家名，未绑定时为 null
  "avatarUrl": null, // string | null，头像地址，未设置时为 null
  "receiveEmailNotifications": true, // boolean，更新后的个人邮件通知开关
  "role": "player", // "player" | "staff" | "admin"，角色
  "createdAt": "2026-01-01T00:00:00.000Z", // string，注册时间，ISO 8601
  "updatedAt": "2026-01-01T00:00:00.000Z", // string，最后更新时间，ISO 8601
  "deletedAt": null // string | null，注销时间，未注销时为 null
}
```

该端点返回更新后的用户对象。

### POST /api/users/email-notifications/unsubscribe

该端点公开。成功后关闭该用户的个人邮件通知；访问邮件链接本身不会直接退订。

```http
POST /api/users/email-notifications/unsubscribe
Content-Type: application/json
```

```jsonc
{
  "token": "<token>" // string，邮件中的签名令牌
}
```

```jsonc
// 200
{
  "unsubscribed": true // boolean，固定返回
}
```

### GET /api/users/me/federatedauth

该端点列出当前用户已绑定的外部身份。

```http
GET /api/users/me/federatedauth
```

```jsonc
// 200
[
  {
    "id": "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0", // string，绑定 ID，UUID，解绑时作为 :value 使用
    "usernameHint": "steve", // string | null，Provider 返回的用户名提示
    "emailHint": "steve@example.com", // string | null，Provider 返回的邮箱提示
    "avatarUrl": null, // string | null，Provider 返回的头像地址
    "lastLoginAt": "2026-10-28T09:15:00.000Z", // string | null，最近一次通过该身份登录的时间，ISO 8601
    "createdAt": "2026-10-20T03:00:00.000Z", // string，绑定创建时间，ISO 8601
    "provider": {
      "slug": "example", // string，Provider 标识
      "name": "Example", // string，Provider 名称
      "iconUrl": null // string | null，Provider 图标地址
    }
  }
]
```

数组按绑定创建时间升序排列，结果不含 `subject` 与 Provider 端点配置。

### POST /api/users/me/federatedauth/:value/start

`:value` 为 Provider slug，用于已登录状态下主动绑定外部身份。

```http
POST /api/users/me/federatedauth/:value/start
Content-Type: application/json
```

```jsonc
{
  "returnTo": "/settings" // string，跳转路径
}
```

```jsonc
// 200
{
  "authorizationUrl": "..." // string，授权地址
}
```

### DELETE /api/users/me/federatedauth/:value

该端点解绑当前用户的该 Provider 身份，成功时返回 `204`。密码错误时返回 `400`，未绑定返回 `404`。

```http
DELETE /api/users/me/federatedauth/:value
Content-Type: application/json
```

```jsonc
{
  "currentPassword": "<currentPassword>" // string，当前密码
}
```

管理员侧的 Provider 管理见[管理后台 API](./admin.md)。
