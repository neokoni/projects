---
order: 40
---

# 其他接口与集成注意

这一页收尾三部分：插件还会用到的两个非玩家接口（玩家组名单上报与模板读取）、限流与缓存的实际节奏、以及升级迁移时的兼容边界和上线前的检查清单。响应示例只列 envelope 里的 `data`。

## 上报玩家组名单

### POST /api/mc/player-group/items

玩家进入服务器时，插件把玩家名补进配置里指定的玩家组，供 `player_select` 字段与完成钩子的下拉搜索使用。只要求 `X-Server-Key`，不要求玩家 session，但挂了 auth 限流。

```http
POST /api/mc/player-group/items
X-Server-Key: <apiKey>
Content-Type: application/json

{"groupId": "vip", "value": "Steve"}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `groupId` | string | 是 | `^[A-Za-z0-9_-]{1,64}$`，服务端会再 trim |
| `value` | string | 是 | 玩家名，`^[a-zA-Z0-9_]{3,16}$`，服务端会再 trim |

成功返回 `204 No Content`，没有响应体。写入语义来自 `player-group.service.ts` 的 `uploadItem`：

- 单个值先 trim 再校验，使用 `(groupId, value)` 唯一键做 upsert，因此重复上报同一个名字是幂等的，不会产生重复条目，也不会返回 409。
- 条目值按二进制比较，大小写不同视为两个不同的条目。
- 玩家组不存在返回 404（内部把外键错误映射成 404），`groupId` 格式非法或玩家名不合规返回 400。
- 上报失败只需要记录告警，不应阻塞玩家登录：官方插件在这一步是 best effort，且只在玩家登录后异步触发。

`groupId` 要与模板里 `player_select` 字段的 `attributes.groups` 对齐，否则下拉搜索查不到这些名字。被模板或待处理完成钩子引用的玩家组不能删除（管理端会返回 409），所以上报的组必须先建好。

## 模板读取

模板接口不属于 `/api/mc`，插件启动时却会调用，用来构建游戏内的表单。认证走 `authOrServerKeyMiddleware`：带 `X-Server-Key` 或用 Bearer JWT 登录都可以，与 `/api/mc/*` 的区别在于：

- 不解析 `serverId`。模板是全局资源，Velocity 插件也不必在请求里带服务器信息。
- 不涉及玩家身份，因此不需要 `X-Player-Session`。

`GET /api/templates` 返回已启用模板的摘要数组：

```json
[
  {"name": "bug_report", "name_i18n": "Bug 反馈", "description": "报告问题", "labels": [], "hidden": false}
]
```

`GET /api/templates/:name` 返回单个模板定义，未启用或不存在返回 404：

```json
{
  "name": "Bug 反馈",
  "description": "报告问题",
  "title_prefix": "[Bug]",
  "labels": [],
  "hidden": "optional",
  "body": [{"type": "input", "id": "server", "validations": {"required": true}, "attributes": {"label": "服务器"}}]
}
```

`hidden` 决定创建时的可见性策略：`true` 始终隐藏，`false` 始终公开，`optional` 要求玩家在游戏内选择，此时 `POST /api/mc/tickets` 必须带 `hidden`。字段类型与 `formData` 的对应关系见 [字段类型](../template/fields.md)。

## 限流与错误处理建议

| 状态码 | 常见原因 | 建议处理 |
| --- | --- | --- |
| 401 | 会话缺失或过期、key 无效、key 与服务器不匹配 | 会话类先重新签发再重试一次；key 类记录日志并停止重试 |
| 403 | 请求 UUID 与会话 UUID 不一致、注册被关闭、无权操作议题 | 不重试，属于调用方逻辑或配置问题 |
| 404 | 议题不可见、模板或玩家组不存在 | 不重试，向玩家提示目标不存在 |
| 409 | Minecraft 账号已绑定、服务器标识冲突 | 不重试，提示玩家改走 Web 端解绑或绑定 |
| 429 | 触发 global 或 auth 限流 | 按 `Retry-After` 退避，不要并发重试 |
| 5xx | 后端或数据库异常 | 指数退避重试，并限制重试次数 |

429 响应也是标准 envelope（`success` 为 `false`），同时带 `RateLimit-Limit`、`RateLimit-Remaining`、`RateLimit-Reset` 与 `Retry-After`。

几条实践经验：

- 缓存 `sessionToken` 到接近过期再换新（官方插件留 10 秒余量），换新时做单飞，避免同一玩家并发签发多条会话。
- 收到 401 后先作废本地会话再重新 `POST /api/mc/session`；第二次仍然 401 说明绑定已失效，需要引导玩家重新绑定，不要无限重试。
- `rate-limit` 的计数按 IP 做，同一台机器上的多个服务器进程共享配额，多实例部署时要留意上限。
- 注册链接与绑定码都由玩家主动触发，不要做后台轮询或批量预生成，否则很快打满 auth 限流。

## 缓存与刷新节奏

| 对象 | 生命周期 | 谁负责刷新 |
| --- | --- | --- |
| 模板定义 | 插件本地缓存，默认 30 分钟刷新一次（`templateRefreshInterval`，设 0 关闭） | 插件启动时拉一次，之后定时重拉 |
| 玩家资料（角色、绑定状态） | 由插件按可配置间隔周期刷新 | `DataRefreshManager` |
| 玩家 session | 5 分钟 | `POST /api/mc/session` 换新 |
| 议题状态、评论、完成钩子 | 实时 | Socket.IO `/mc` 命名空间推送 |

议题与评论的变更不要靠轮询 `GET /api/mc/tickets` 获取，实时通知走 Socket.IO，见 [WebSocket 连接](../websocket/index.md)。管理后台修改模板后，插件要等到下次刷新或重启才会看到新字段。

## 版本兼容与迁移

- 旧版插件、以及历史绑定里没有 `playerCredential` 的账号，调用玩家级接口会 fail-closed 返回 401。这类账号不会自动修复，必须由用户在 Web 端解绑后重新绑定。
- 升级顺序固定：先应用 credential 与 session 相关的新增表迁移，再同步更新后端与插件。先升插件会让所有玩家级请求失败。
- 旧版「每台服务器一把 key」的密钥不需要重建：后端启动时会把历史哈希转成普通 API key，类型按 `paper_folia`、绑定原服务器，因此老 key 仍可继续使用，只是不具备跨服务器能力。
- 数据库变更都是新增结构，回滚应用版本时可以保留这些表；但只能回滚到仍然要求玩家 session 的版本，禁止恢复仅凭 server key 加自报 UUID 鉴权的旧实现。
- 老路径 `GET /api/mc/tickets/:uuid`、`GET /api/mc/tickets/:id/detail`、`GET /api/mc/tickets/:id/comments` 会长期保留给 Paper/Folia 与旧插件，鉴权规则与新版一致，不会因为路径旧就放宽。
- 若必须回退数据库结构，只能从升级前的备份恢复，不能用应用回滚代替。

## 集成检查清单

| 检查项 | 期望 | 失败表现 |
| --- | --- | --- |
| `baseUrl` | 站点公开 origin，不带 `/api`、不带尾斜杠 | 404 或 401 |
| key 绑定 | Paper/Folia 只绑一台；Velocity 绑齐所有后端服务器 | 401 `该 API Key 未授权此服务器` |
| `serverId` | Velocity 填服务器识别 ID，与 Velocity 注册名一致 | 401 `该 API Key 未授权此服务器` |
| 玩家会话 | 写接口带 `X-Player-Session`，`minecraftUuid` 与会话一致 | 401 或 403 |
| 时间同步 | 与平台做 NTP 同步，按 `expiresAt` 提前刷新会话 | 会话频繁失效 |
| 传输安全 | 全站 HTTPS，证书可被插件宿主机的信任链校验 | 请求被 TLS 校验拒绝 |
| 站点地址 | 管理后台配置了合法的 `siteUrl` | `register-link` 返回 400 |
| 注册开关 | 需要游戏内注册时打开 `allowMcRegister` | `register-link` 返回 403 |
| 模板同步 | 模板已启用，`formData` 字段与模板声明一致 | 400 无效模板或字段校验失败 |
