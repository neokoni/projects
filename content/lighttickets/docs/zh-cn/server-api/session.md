---
order: 20
---

# 注册、绑定与会话

## POST /api/mc/register-link

该端点生成一次性注册链接，供游戏内 `/lit register` 使用。请求仅要求 `X-Server-Key`，不需要玩家 session。

```http
POST /api/mc/register-link
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",    // string，必填，合法 UUID
  "minecraftName": "Steve",     // string，必填，^[a-zA-Z0-9_]{3,16}$
  "serverId": "<serverId>"      // string，Velocity 必填，1-64 字符，须与服务器识别 ID 一致
}
```

响应状态码为 201：

```jsonc
// 201
{
  "url": "https://tickets.example.com/register?mcRegisterToken=<token>", // 一次性注册链接
  "expiresAt": "2026-09-26T12:00:00.000Z",                               // ISO 时间，默认 5 分钟后
  "playerCredential": "<playerCredential>"                               // 仅此响应返回一次，插件须安全保存
}
```

`url` 由配置的 `siteUrl` 依次连接 `/register?mcRegisterToken=<token>` 生成，有效期与绑定码一致，即 `linkCodeExpiry`，默认为 5 分钟。玩家在浏览器打开该 URL 并完成注册后，该 Minecraft 账号将自动绑定到新建账号。同一 UUID 仅保留最新一条链接，重复调用将替换旧 token，旧链接随即失效。

| 状态码 | 触发条件 |
| --- | --- |
| 400 | `siteUrl` 未配置或不合法，采用 fail-closed，不从请求头推导 |
| 403 | 管理后台关闭 Minecraft 注册，即 `allowMcRegister` |
| 409 | 该 Minecraft 账号已绑定到账号 |
| 401 | key 缺失、无效，或 Velocity 的 `serverId` 不匹配 |
| 429 | 触发 auth 限流 |

## POST /api/mc/link-code

该端点生成绑定码，供已注册玩家在游戏内 `/lit bind` 使用。请求同样仅要求 `X-Server-Key`。

```http
POST /api/mc/link-code
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",    // string，必填，合法 UUID
  "minecraftName": "Steve",     // string，必填，^[a-zA-Z0-9_]{3,16}$
  "serverId": "<serverId>"      // string，Velocity 必填，1-64 字符，须与服务器识别 ID 一致
}
```

请求体字段与 `register-link` 完全相同。响应状态码为 201：

```jsonc
// 201
{
  "code": "123456",                        // 6 位数字绑定码
  "expiresAt": "2026-09-26T12:00:00.000Z", // ISO 时间，默认 5 分钟后
  "playerCredential": "<playerCredential>" // 仅此响应返回一次，插件须安全保存
}
```

`code` 为 6 位数字，玩家在 Web 端通过 `POST /api/auth/link-minecraft` 提交，请求体为：

```jsonc
{
  "code": "123456" // string，6 位数字
}
```

`playerCredential` 仅在此次响应中出现一次，插件须安全保存，后端仅存其 SHA-256 摘要。同一 UUID 重复调用将删除旧码再建立新码，旧码因此不能用于绑定。已绑定账号返回 409，错误文案为 `该Minecraft账号已绑定到账户`。该端点不检查 `allowMcRegister` 与 `siteUrl`，仅可能返回 401 与 429。

## POST /api/mc/session

该端点使用绑定阶段取得的 `playerCredential` 换取玩家会话。请求仅要求 `X-Server-Key`。

```http
POST /api/mc/session
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>",                 // string，必填，非空；仅用于与 credential 比对
  "playerCredential": "<playerCredential>",  // string，必填，32 到 128 字符
  "serverId": "<serverId>"                   // string，Velocity 必填，同 register-link
}
```

响应状态码为 201：

```jsonc
// 201
{
  "sessionToken": "<sessionToken>",        // 玩家会话令牌，有效期固定 5 分钟
  "expiresAt": "2026-09-26T12:03:00.000Z"  // ISO 时间
}
```

`sessionToken` 有效期固定为 5 分钟。会话绑定签发请求所解析出的服务器，同时绑定 API 账号当前的 Minecraft UUID。账号被解绑或换绑后，凭旧会话发起的请求返回 401。凭据无效返回 401，错误文案为 `Minecraft player credential is invalid`；账号已不再绑定时同样返回 401，错误文案为 `Minecraft account is no longer linked`。该端点不设 auth 限流，仅受 global 限流约束。

## POST /api/mc/unlink

```http
POST /api/mc/unlink
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "minecraftUuid": "<uuid>" // string，必填
}
```

请求体仍按 schema 校验，`minecraftUuid` 为必填，缺失或为空时返回 400；接口固定抛出 403，错误文案为 `Minecraft 解绑必须由账户本人在 Web 端完成`。解绑仅能由已登录用户在 Web 端调用 `DELETE /api/auth/link-minecraft` 完成，插件无法代办。官方插件因此不调用该端点，游戏内 `/lit unbind` 仅提示玩家前往网页操作。

## 两条路径的完整时序

注册路径：

```text
玩家 /lit register
  -> 插件 POST /api/mc/register-link        (X-Server-Key)
  <- url, expiresAt, playerCredential
  -> 插件向玩家发送 url，并保存 credential
玩家浏览器打开 url
  -> Web POST /api/auth/register            (mcRegisterToken + 邮箱/密码/用户名)
  <- 账号创建，Minecraft 账号自动绑定
  -> 插件 POST /api/mc/session              (minecraftUuid + playerCredential)
  <- sessionToken（5 分钟）
  -> 插件带 X-Player-Session 调用玩家接口
```

绑定路径：

```text
玩家 /lit bind
  -> 插件 POST /api/mc/link-code            (X-Server-Key)
  <- code, expiresAt, playerCredential
  -> 插件向玩家发送 code，并保存 credential
玩家在 Web 端登录
  -> Web POST /api/auth/link-minecraft      ({"code":"123456"})
  <- 绑定成功，返回 uuid 与 name
  -> 插件 POST /api/mc/session
  <- sessionToken（5 分钟）
  -> 插件带 X-Player-Session 调用玩家接口
```

## 安全注意事项

- credential 仅在签发响应中以明文出现一次，数据库存储的为 SHA-256 摘要；session token 同样仅存摘要。凭据丢失后仅能重新绑定，无法找回。
- 重新绑定将删除该账号旧的 credential，旧插件进程中持有的凭据随即失效。旧版插件以及没有 `playerCredential` 的历史绑定在调用玩家级接口时采用 fail-closed，用户须先在 Web 端解绑再重新绑定。
- 绑定码输入失败将累计尝试次数，默认为 5 次后锁定 15 分钟，即 `DEFAULT_RATE_LIMIT_CONFIG.minecraftLink`，可在管理后台调整；锁定期间正确的码同样会被拒绝。绑定码 5 分钟后过期，插件每次重新生成都将作废旧码。
- 一次性注册链接仅能消费一次。`mcRegisterToken` 被使用、过期或 UUID 已被绑定时，Web 端注册均将失败。
- `expiresAt` 为服务端的绝对时间，建议插件服务器与平台进行 NTP 时间同步，并在过期前主动换取新会话；官方插件预留 10 秒余量提前刷新。
- 在 Velocity 上切换后端服务器后，旧会话与新的 `serverId` 不匹配，须重新调用 `POST /api/mc/session`。
