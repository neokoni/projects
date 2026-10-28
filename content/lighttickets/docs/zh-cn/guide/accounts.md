---
order: 20
---

# 账户与登录

本文覆盖从注册到会话失效的完整链路：注册开关、邮箱验证码、Minecraft 一次性注册链接、登录与令牌刷新、外部登录、密码重置、邮箱更换、个人资料与会话失效语义。

## 注册

### 网页注册

注册入口在 `/register`，受站点设置的 `allowWebRegister` 控制：关闭时登录页不显示注册入口，注册接口也会拒绝请求（`网页注册已关闭，请联系管理员`）。

提交字段与规则：

| 字段 | 规则 |
| --- | --- |
| `email` | 必填，合法邮箱，保存前统一转小写 |
| `username` | 必填，2~32 个字符，全局唯一 |
| `password` | 必填，最少 8 个字符（`MIN_PASSWORD_LENGTH`） |
| `emailVerificationCode` | 6 位数字，仅在站点启用邮件服务时必填 |
| `turnstileToken` | 站点启用 Turnstile 时必填 |
| `mcRegisterToken` | 可选，来自游戏内 `/lit register` 的一次性链接 |

注册成功会直接写入登录态：响应返回用户对象与 `accessToken`，同时写入刷新 Cookie。

### 邮箱验证码

验证码接口为 `POST /api/auth/register/verification-code`，请求体只有 `email` 与可选的 `turnstileToken`。

- 只有站点配置了可用的 SMTP（能发信）时，注册才强制邮箱验证；未配置 SMTP 时 `emailVerificationCode` 可省略，注册直接成功。此时请求验证码会返回 `邮件服务尚未启用`。
- 验证码为 6 位数字，有效期 10 分钟，最多尝试 5 次，超过次数后需重新获取。
- 两个验证码请求之间的冷却时间取限流设置里的「邮件发送冷却」（默认 60 秒），冷却期内重发返回 429。
- 如果该邮箱已被注册或正在等待邮箱更换验证，接口仍返回「已受理」但不发信，避免通过发信行为探测邮箱是否注册。
- 发信失败时接口返回 503 并回滚本次验证码记录，邮件服务恢复后可重试。

### Minecraft 一次性注册链接

游戏内执行 `/lit register` 会请求 `POST /api/mc/register-link`，成功后玩家收到形如 `https://<站点地址>/register?mcRegisterToken=<token>` 的可点击链接。

- 需要管理员开启 `allowMcRegister`，否则接口返回 `Minecraft注册已关闭，请联系管理员`。
- 需要站点地址 `siteUrl` 已配置为合法 origin，否则返回 `站点地址未配置，无法生成注册链接，请联系管理员`。
- 链接默认 5 分钟有效，同一个 Minecraft UUID 同时只保留一个有效链接（重新生成会作废旧链接），使用一次即失效。
- 在网页完成注册后，该 Minecraft 账号会自动绑定到新账户上；若该 UUID 已绑定其他账户，注册返回 409。
- 链接失效或已使用时继续注册会提示 `注册链接无效或已过期，请在游戏内重新执行注册命令`。

## 登录与令牌刷新

登录接口 `POST /api/auth/login`，`emailOrUsername` 含 `@` 时按邮箱匹配，否则按用户名匹配，已被软删除的账户无法登录。

成功后返回：

- `accessToken`：短期访问令牌，前端只保存在内存里，每个请求以 `Authorization: Bearer` 提交；
- 刷新令牌：写入 HttpOnly Cookie `lt_refresh_token`，`SameSite=Lax`，`Path=/api/auth`，有效期 7 天，生产环境追加 `Secure`。

刷新行为：

- 前端收到 401 时会先用 Cookie 调一次 `POST /api/auth/refresh`，换到新的访问令牌后重放原请求；刷新失败则清空本地会话并跳转 `/login?redirect=<当前路径>`。
- 每次刷新都会轮换刷新令牌（同一 `familyId` 下的新会话）。若同一令牌被重复使用，整个会话族会被吊销，需要重新登录。
- 退出登录 `POST /api/auth/logout` 会清除 Cookie 并吊销当前刷新会话；前端即使请求失败也会先清空本地状态。

## 外部登录（OAuth / OIDC）

外部登录 Provider 由管理员在后台「外部登录」中配置，登录页只展示已启用的 Provider，并附带「忘记密码」入口（仅当站点满足密码重置条件时才出现）。

- 登录：`POST /api/auth/federatedauth/:slug/start` 返回 `authorizationUrl`，浏览器跳转授权；回调后若该身份已绑定账户，直接登录并写入刷新 Cookie。
- 首次登录且 Provider 允许创建账户、站点仍开启 `allowWebRegister` 时，会跳到 `/federatedauth/register` 补充邮箱、用户名、密码（站点启用邮件服务时还需邮箱验证码），提交 `POST /api/auth/federatedauth/registration/complete` 完成注册。
- 系统不会按邮箱把外部身份自动关联到已有账户；需要用户登录后在个人资料里主动绑定。
- 绑定：个人资料「外部登录」中点击绑定，走 `POST /api/users/me/federatedauth/:slug/start`，授权完成后回到原页面。
- 解绑：`DELETE /api/users/me/federatedauth/:slug`，请求体必须带当前密码 `currentPassword`。解绑后该身份无法再登录该账户，请确认还有其他可用的登录方式。

## 密码重置

- 申请：`POST /api/auth/password-reset/request`，可用邮箱或用户名；站点启用 Turnstile 时需带 token。
- 前提条件：SMTP 可用，且 `siteUrl` 是 HTTPS origin。任一条件不满足时直接失败（`站点地址未配置为安全的 HTTPS origin，密码重置不可用`），属于 fail-closed 设计：不会退化成弱校验。
- 邮件中的链接指向 `/reset-password?token=...`，令牌有效期 30 分钟、一次性；同一用户 60 秒内只能申请一次，重新申请会作废之前的令牌。
- 提交 `POST /api/auth/password-reset/confirm` 时新密码同样最少 8 位。成功后该账户的访问令牌立即失效、全部刷新会话被吊销、待验证的新邮箱被清除，需要重新登录。
- 输入不存在的邮箱/用户名时接口仍返回「已受理」，并按标识符做冷却，避免账号枚举。

## 修改邮箱

修改邮箱在个人资料「账号信息」中完成，需要输入当前密码确认身份。

- 前提同样是 SMTP 可用 + HTTPS 站点地址，否则提示「邮箱更换需要管理员启用 SMTP 并配置 HTTPS 站点地址」。
- 提交后新邮箱会收到 6 位验证码（10 分钟有效、最多 5 次尝试），旧邮箱会同时收到一封通知邮件，其中带有 `/cancel-email-change?token=...` 撤销链接，用于在非本人操作时紧急叫停。
- 验证通过后邮箱才真正更换，并刷新当前登录态；未验证前账户处于「待验证邮箱」状态。
- 也可以随时手动取消：`DELETE /api/users/me/email` 清空待验证邮箱；通过撤销链接调用的是公开接口 `POST /api/users/email-change/cancel`。

## 个人资料

`/profile` 分六个分区：

- 账号信息：用户名（2~32 字符、唯一）、头像 URL（必须是 `http://` 或 `https://` 开头）、邮箱更换。
- 修改密码：需要当前密码，新密码 8 位以上；成功后旧会话全部失效，并返回新的刷新 Cookie。
- Minecraft 绑定：输入游戏内 `/lit bind` 得到的 6 位绑定码；解绑后游戏内将无法再操作议题。
- 外部登录：绑定或解绑 OAuth/OIDC 身份。
- 通知设置：`receiveEmailNotifications` 开关，控制是否接收议题回复、状态变更、被指派三类邮件。
- 语言：个人界面语言，保存在 cookie `lt_language`。

## 登出与会话失效

访问令牌里带有签发时的 `tokenEpoch` 与用户当前 `tokenEpoch` 比对，不一致即视为无效。

以下操作会提升 `tokenEpoch` 并吊销该用户的全部刷新会话，迫使所有设备重新登录：

- 修改密码、通过邮件重置密码；
- 管理员调整该用户的角色；
- 管理员删除该用户（软删除，同时清空邮箱、密码、用户名、MC 绑定与头像）。

另外，管理员把账户软删除后，其所有访问令牌与刷新令牌都无法再通过校验；数据行仍保留以满足历史议题的引用。
