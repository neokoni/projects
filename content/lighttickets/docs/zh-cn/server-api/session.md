---
order: 20
---

# 注册、绑定与会话

玩家在游戏内要与平台建立关系，一共两条路径：新玩家走注册链接直接建号并自动绑定，已有账号的玩家用绑定码把 Minecraft 账号挂到现有账号上。两条路径都会下发一次性可见的 `playerCredential`，之后靠它换取短期 session，再去调用议题接口。本页响应示例只列 envelope 里的 `data`。

## POST /api/mc/register-link

生成一次性注册链接，游戏内 `/lit register` 使用。只要求 `X-Server-Key`，不需要玩家 session。

```http
POST /api/mc/register-link
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid":"<uuid>","minecraftName":"Steve"}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `minecraftUuid` | string | 是 | 必须是合法 UUID |
| `minecraftName` | string | 是 | `^[a-zA-Z0-9_]{3,16}$` |
| `serverId` | string | Velocity 必填 | 1 到 64 字符，需与该服务器的识别 ID 一致 |

响应 201：

```json
{
  "url": "https://tickets.example.com/register?mcRegisterToken=<token>",
  "expiresAt": "2026-09-26T12:00:00.000Z",
  "playerCredential": "<playerCredential>"
}
```

`url` 由配置的 `siteUrl` 加上 `/register?mcRegisterToken=<token>` 拼成，有效期与绑定码一致（`linkCodeExpiry`，默认 5 分钟）。玩家在浏览器打开并完成注册后，该 Minecraft 账号自动绑定到新建账户。同一 UUID 只保留最新一条链接，重复调用会替换旧 token，旧链接立即失效。

| 状态码 | 触发条件 |
| --- | --- |
| 400 | `siteUrl` 未配置或不合法（fail-closed，不从请求头推导） |
| 403 | 管理后台关闭了 Minecraft 注册（`allowMcRegister`） |
| 409 | 该 Minecraft 账号已绑定到账户 |
| 401 | key 缺失、无效，或 Velocity 的 `serverId` 不匹配 |
| 429 | 触发 auth 限流 |

## POST /api/mc/link-code

给已注册的玩家生成绑定码，游戏内 `/lit bind` 使用。同样只要求 `X-Server-Key`。

```http
POST /api/mc/link-code
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid":"<uuid>","minecraftName":"Steve"}
```

请求体字段与 `register-link` 完全相同。响应 201：

```json
{
  "code": "123456",
  "expiresAt": "2026-09-26T12:00:00.000Z",
  "playerCredential": "<playerCredential>"
}
```

`code` 是 6 位数字，玩家在 Web 端通过 `POST /api/auth/link-minecraft`（body `{"code":"123456"}`）提交。`playerCredential` 只在此次响应中出现一次，插件必须安全保存，后端只存它的 SHA-256 摘要。同一 UUID 重复调用会删除旧码再建新码，因此旧码不能再用于绑定。已绑定账号返回 409（`该Minecraft账号已绑定到账户`）；该端点不检查 `allowMcRegister` 与 `siteUrl`，只可能返回 401 与 429。

## POST /api/mc/session

用绑定阶段拿到的 `playerCredential` 换取玩家会话。只要求 `X-Server-Key`。

```http
POST /api/mc/session
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid":"<uuid>","playerCredential":"<playerCredential>"}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `minecraftUuid` | string | 是 | 非空；只用于和 credential 比对 |
| `playerCredential` | string | 是 | 32 到 128 字符 |
| `serverId` | string | Velocity 必填 | 同 `register-link` |

响应 201：

```json
{
  "sessionToken": "<sessionToken>",
  "expiresAt": "2026-09-26T12:03:00.000Z"
}
```

`sessionToken` 有效期固定 5 分钟。会话绑定签发请求解析出的服务器，也绑定 API 账号当前的 Minecraft UUID：账号被解绑或换绑后，凭旧会话的请求返回 401。凭据无效返回 401（`Minecraft player credential is invalid`），账号已不再绑定时同样 401（`Minecraft account is no longer linked`）。该端点没有 auth 限流，只受 global 限流约束。

## POST /api/mc/unlink

```http
POST /api/mc/unlink
X-Server-Key: <apiKey>
Content-Type: application/json

{"minecraftUuid":"<uuid>"}
```

请求体仍按 schema 校验（`minecraftUuid` 必填，缺失或空返回 400），但接口固定抛出 403：`Minecraft 解绑必须由账户本人在 Web 端完成`。解绑只能由已登录用户在 Web 端调用 `DELETE /api/auth/link-minecraft`，插件无法代办；官方插件因此根本不调用这个端点，游戏内 `/lit unbind` 只提示玩家去网页操作。

## 两条路径的完整时序

注册路径：

```text
玩家 /lit register
  -> 插件 POST /api/mc/register-link        (X-Server-Key)
  <- url, expiresAt, playerCredential
  -> 插件把 url 发给玩家，自己保存 credential
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
  -> 插件把 code 发给玩家，自己保存 credential
玩家在 Web 端登录
  -> Web POST /api/auth/link-minecraft      ({"code":"123456"})
  <- 绑定成功，返回 uuid 与 name
  -> 插件 POST /api/mc/session
  <- sessionToken（5 分钟）
  -> 插件带 X-Player-Session 调用玩家接口
```

## 安全注意事项

- credential 只在签发响应里以明文出现一次，数据库存的是 SHA-256 摘要；session token 同样只存摘要。丢失只能重新绑定，无法找回。
- 重新绑定会删除该账号旧的 credential，旧插件进程手里的凭据随即失效。旧版插件、以及没有 `playerCredential` 的历史绑定，调用玩家级接口会 fail-closed，必须先让用户在 Web 端解绑再重新绑定。
- 绑定码输入失败会累计尝试次数：默认 5 次后锁定 15 分钟（`DEFAULT_RATE_LIMIT_CONFIG.minecraftLink`，可在管理后台调整），锁定期间连正确码也会被拒。绑定码 5 分钟过期，插件每次重新生成都会作废旧码。
- 一次性注册链接只能消费一次，`mcRegisterToken` 被使用、过期或 UUID 已被绑定时，Web 端注册都会失败。
- `expiresAt` 是服务端的绝对时间，插件服务器需要与平台做 NTP 时间同步，并在过期前主动换新会话；官方插件会留 10 秒余量提前刷新。
- 在 Velocity 上切换后端服务器后，旧会话与新的 `serverId` 不匹配，需要重新调用 `POST /api/mc/session`。
