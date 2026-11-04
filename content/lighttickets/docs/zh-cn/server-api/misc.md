---
order: 40
---

# 其他接口与集成注意

## 玩家组名单上报

### POST /api/mc/player-group/items

玩家进入服务器时，插件将玩家名写入配置指定的玩家组，供 `player_select` 字段与完成钩子的下拉搜索使用。该接口仅要求 `X-Server-Key`，不要求玩家 session，但受 auth 限流约束。

```http
POST /api/mc/player-group/items
X-Server-Key: <apiKey>
Content-Type: application/json
```

```jsonc
{
  "groupId": "vip",  // string，必填，^[A-Za-z0-9_-]{1,64}$
  "value": "Steve"   // string，必填，玩家名，^[a-zA-Z0-9_]{3,16}$
}
```

成功时返回 `204 No Content`，无响应体。写入语义来源于 `player-group.service.ts` 的 `uploadItem`：

- 单个值先经去除首尾空白再校验，使用 `(groupId, value)` 唯一键执行 upsert。重复上报同一名字为幂等操作，不产生重复条目，也不返回 409。
- 条目值按二进制比较，大小写不同即视为两个不同条目。
- 玩家组不存在时返回 404，即内部将外键错误映射为 404；`groupId` 格式非法或玩家名不合规时返回 400。
- 上报失败时仅需打印告警，不建议阻塞玩家登录。官方插件在该步骤采用 best effort 策略，且仅在玩家登录后异步触发。

`groupId` 须与模板中 `player_select` 字段的 `attributes.groups` 一致，否则下拉搜索将查不到这些名字。被模板或待处理完成钩子引用的玩家组不可删除，管理端将返回 409；上报的玩家组须预先创建。

## 模板读取

模板接口不属于 `/api/mc`，但插件启动时将调用该接口，用于构建游戏内表单。认证由 `authOrServerKeyMiddleware` 处理：携带 `X-Server-Key` 或使用 Bearer JWT 登录均可。该接口与 `/api/mc/*` 的区别如下：

- 该接口不解析 `serverId`。模板为全局资源，Velocity 插件也不需要在请求中携带服务器信息。
- 该接口不涉及玩家身份，因此不需要 `X-Player-Session`。

`GET /api/templates` 返回已启用模板的摘要数组：

```jsonc
[
  {
    "name": "bug_report",       // string，模板名
    "name_i18n": "Bug 反馈",    // string，模板显示名
    "description": "报告问题",  // string，模板说明
    "labels": [],               // array，模板标签
    "hidden": false             // boolean | "optional"，创建时的可见性策略
  }
]
```

`GET /api/templates/:name` 返回单个模板定义；未启用或不存在时返回 404：

```jsonc
{
  "name": "Bug 反馈",         // string，模板名
  "description": "报告问题",  // string，模板说明
  "title_prefix": "[Bug]",    // string，标题前缀
  "labels": [],               // array，模板标签
  "hidden": "optional",       // boolean | "optional"，创建时的可见性策略
  "body": [                   // array，表单字段定义
    {
      "type": "input",        // string，字段类型
      "id": "server",         // string，字段 ID，对应 formData 的键
      "validations": {        // object，校验规则
        "required": true      // boolean，是否必填
      },
      "attributes": {         // object，字段属性
        "label": "服务器"     // string，字段标签
      }
    }
  ]
}
```

`hidden` 决定创建时的可见性策略：`true` 为始终隐藏，`false` 为始终公开，`optional` 要求玩家在游戏内选择，此时 `POST /api/mc/tickets` 须携带 `hidden`。字段类型与 `formData` 的对应关系见 [字段类型](../template/fields.md)。

## 限流与错误处理

| 状态码 | 原因 | 处理方式 |
| --- | --- | --- |
| 401 | 会话缺失或过期、key 无效、key 与服务器不匹配 | 建议先重新签发会话再重试一次；key 类错误建议打印日志并停止重试 |
| 403 | 请求 UUID 与会话 UUID 不一致、注册被关闭、无权操作议题 | 不建议重试，即调用方逻辑或配置问题 |
| 404 | 议题不可见、模板或玩家组不存在 | 不建议重试，向玩家提示目标不存在 |
| 409 | Minecraft 账号已绑定、服务器标识冲突 | 不建议重试，提示玩家通过 Web 端解绑或绑定 |
| 429 | 触发 global 或 auth 限流 | 按 `Retry-After` 退避，不建议并发重试 |
| 5xx | 后端或数据库异常 | 建议采用指数退避重试，并限制重试次数 |

429 响应同样为标准 envelope，`success` 为 `false`，并携带 `RateLimit-Limit`、`RateLimit-Remaining`、`RateLimit-Reset` 与 `Retry-After`。

实践要点如下：

- `sessionToken` 缓存至接近过期再换新，官方插件保留 10 秒余量；换新时采用单飞，避免同一玩家并发签发多条会话。
- 收到 401 后先作废本地会话，再重新 `POST /api/mc/session`；第二次仍为 401 即绑定已失效，引导玩家重新绑定，不建议无限重试。
- `rate-limit` 的计数以 IP 为单位，同一台机器上的多个服务器进程共享配额；多实例部署时建议留意上限。
- 注册链接与绑定码均由玩家主动触发，不建议进行后台轮询或批量预生成，否则将触发 auth 限流。

## 缓存与刷新节奏

| 对象 | 生命周期 | 刷新方 |
| --- | --- | --- |
| 模板定义 | 插件本地缓存，默认每 30 分钟刷新一次，由 `templateRefreshInterval` 控制，设为 0 即关闭 | 插件启动时拉取一次，之后定时重新拉取 |
| 玩家资料（角色、绑定状态） | 由插件按可配置间隔周期刷新 | `DataRefreshManager` |
| 玩家 session | 5 分钟 | 由 `POST /api/mc/session` 续期 |
| 议题状态、评论、完成钩子 | 实时更新 | 由 Socket.IO `/mc` 命名空间推送 |

议题与评论的变更不建议通过轮询 `GET /api/mc/tickets` 获取，实时通知由 Socket.IO 推送，见 [WebSocket 连接](../websocket/index.md)。管理后台修改模板后，插件在下一次刷新或重启前无法获取新字段。

## 版本兼容与迁移

- 旧版插件以及历史绑定中缺少 `playerCredential` 的账号，调用玩家级接口时将 fail-closed 返回 401。此类账号不会自动修复，须由用户在 Web 端解绑后重新绑定。
- 升级顺序固定：先应用 credential 与 session 相关的新增表迁移，再同步更新后端与插件。先升级插件将导致所有玩家级请求失败。
- 旧版「每台服务器一把 key」的密钥不需要重建：后端启动时将历史哈希转换为普通 API key，类型为 `paper_folia`，并绑定原服务器；因此旧 key 仍可继续使用，仅不具备跨服务器能力。
- 数据库变更均为新增结构，回滚应用版本时可保留这些表；但仅可回滚到仍要求玩家 session 的版本，禁止恢复仅凭 server key 加自报 UUID 鉴权的旧实现。
- 旧路径 `GET /api/mc/tickets/:uuid`、`GET /api/mc/tickets/:id/detail`、`GET /api/mc/tickets/:id/comments` 将长期保留给 Paper/Folia 与旧插件，鉴权规则与新版一致，不因路径较旧而放宽。
- 若须回退数据库结构，仅可从升级前的备份恢复，不得以应用回滚代替。

## 集成检查清单

| 检查项 | 期望 | 失败表现 |
| --- | --- | --- |
| `baseUrl` | 站点公开 origin，不含 `/api`，不含尾斜杠 | 404 或 401 |
| key 绑定 | Paper/Folia 仅绑定一台；Velocity 绑定所有后端服务器 | 401 `该 API Key 未授权此服务器` |
| `serverId` | Velocity 填写服务器识别 ID，与 Velocity 注册名一致 | 401 `该 API Key 未授权此服务器` |
| 玩家会话 | 写接口携带 `X-Player-Session`，`minecraftUuid` 与会话一致 | 401 或 403 |
| 时间同步 | 与平台进行 NTP 同步，按 `expiresAt` 提前刷新会话 | 会话频繁失效 |
| 传输安全 | 全站 HTTPS，证书可被插件宿主机的信任链校验 | 请求被 TLS 校验拒绝 |
| 站点地址 | 管理后台配置了合法的 `siteUrl` | `register-link` 返回 400 |
| 注册开关 | 需要游戏内注册时启用 `allowMcRegister` | `register-link` 返回 403 |
| 模板同步 | 模板已启用，`formData` 字段与模板声明一致 | 400 无效模板或字段校验失败 |
