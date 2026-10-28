---
order: 30
---

# 完成钩子投递

## 触发时机

只有同时满足以下条件才会产生投递记录：

- 议题状态发生实际变更（`nextStatus !== ticket.status`）；
- 议题归属于某台服务器（`ticket.serverId` 非空），否则直接跳过，因为事件无法定位房间；
- 模板的 `completion_hooks` 中存在 `event` 等于新状态、`type` 不是 `selection`、且条件
  （`if`）求值通过的钩子，解析结果非空。

入队与状态变更在同一个数据库事务里完成（`createForResolvedHooks`），事务提交后才调用
`dispatch` 推送。`type: selection` 的执行选项不会立刻下发，它先进入待处理状态等 staff 决策，
只有决策提交后产生的命令 / 消息动作才走同一条投递链路。

派发前还会检查 `server:<serverId>` 房间内是否有活跃连接：没有插件在线时不会 `emit`，记录保持
`pending`，等插件下次连上后由补发逻辑接管。

## hook:execute

payload 在 `dispatch` 里构造，字段如下：

| 字段 | 类型 | 含义 |
|------|------|------|
| `deliveryId` | string | 投递 ID（UUID），回执时必须原样带回 |
| `ticketId` | number | 关联议题 ID |
| `event` | string | 触发本次投递的模板事件值，即状态名，如 `closed` |
| `playerUuid` | string \| null | 议题作者绑定的 Minecraft UUID，作者未绑定时为 `null` |
| `hooks` | array | 解析后的钩子列表 |

`hooks` 数组元素来自入库时保存的快照：

| 字段 | 类型 | 含义 |
|------|------|------|
| `hookId` | string | 钩子唯一标识，格式为 `<deliveryId>:<序号>`，序号从 0 开始 |
| `type` | string | `command` 或 `minimessage` |
| `content` | string | 命令文本或 MiniMessage 文本 |
| `placeholders` | object | 仅 `minimessage` 出现；键为 `content` 中实际引用的占位符名，值为替换文本，没有可替换项时为空对象 |

`command` 类型的 `content` 在入库时已经完成占位符替换；`minimessage` 保留原始文本，并把实际
引用到的占位符单独放进 `placeholders`，由插件渲染。

```json
{
  "deliveryId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e",
  "ticketId": 42,
  "event": "closed",
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11",
  "hooks": [
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:0",
      "type": "command",
      "content": "tell Neokoni 议题 #42 已关闭"
    },
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:1",
      "type": "minimessage",
      "content": "<color:#96bfff>你的议题 #{ticket_id} 已关闭</color>",
      "placeholders": { "ticket_id": "42" }
    }
  ]
}
```

## hook:ack

回执事件名固定为 `hook:ack`，服务端接受两种形态。

旧版：纯字符串 deliveryId。

```json
"7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e"
```

新版：带逐钩子结果的 envelope。

```json
{
  "deliveryId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e",
  "results": [
    { "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:0", "success": true },
    { "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:1", "success": false, "error": "player not online" }
  ]
}
```

服务端校验规则：

- 字符串形态长度不得超过 128，超出直接忽略；
- 对象形态的 `deliveryId` 必须是非空字符串且长度不超过 128，否则忽略；
- `results` 只检查是不是数组，元素内容原样序列化进投递记录的 `result` 字段，不做逐字段校验；
- 回执只对「同一个 key、同一台服务器、尚未回执、状态为 `pending` 或 `delivering`」的记录生效，
  重复或多发的 `hook:ack` 不会覆盖已完成记录；
- 回执会把整条投递标记为 `delivered`，不再区分单个钩子的成功与否。失败的钩子信息只作为排查依据
  记录在 `result` 里，后端不会因为某个钩子失败而重试整条投递。

::: warning
带 `results` 的回执只是「更详细的日志」，不是「部分成功」。如果插件希望失败的钩子被重试，必须在
本地自行保证，等整体执行成功后再回执。
:::

## 重试与死信

投递记录模型 `MinecraftHookDelivery`（`backend/prisma/schema.prisma`）的状态取值：

| `status` | 含义 |
|----------|------|
| `pending` | 已入队，尚未派发或等待重试 |
| `delivering` | 已派发，等待回执 |
| `delivered` | 已收到回执，终态 |
| `failed` | 达到最大尝试次数仍未回执，即死信 |

相关时间与计数字段：`attempts`、`lastAttemptAt`、`acknowledgedAt`、`failedAt`、`result`。

重试策略：

- 派发时用条件更新抢占记录，命中才 `emit`，同时 `attempts + 1`、写入 `lastAttemptAt`，避免重复派发；
- 同一记录在 `delivering` 状态下的最小重试间隔按 `15s × 2^(attempts-1)` 增长，上限 15 分钟；
- 最大尝试次数 5（`HOOK_DELIVERY_MAX_ATTEMPTS`），超出后标记 `failed` 并写入 `failedAt`；
- 触发重试的入口有两个：插件连接时的 `dispatchPendingForServer`，以及服务端每 30 秒的定时扫描；
- 每次扫描对每台已连接服务器最多取 100 条按 `createdAt` 升序排列的待投递记录。

死信可以在管理后台查看并手动重试，接口需要管理员身份：

```http
GET /api/admin/minecraft-hook-deliveries
Authorization: Bearer <accessToken>

POST /api/admin/minecraft-hook-deliveries/:id/retry
Authorization: Bearer <accessToken>
```

重试接口返回 `{ "retried": true }` 或 `{ "retried": false }`。它只处理 `status = failed` 的记录，
重置为 `pending` 并清零 `attempts`、清空 `lastAttemptAt` 与 `failedAt`，随后由下一次定时扫描或插件
连接补发重新派发；记录不存在或不是死信时 `retried` 为 `false`。

## 幂等要求

`hook:execute` 可能重复到达：重连补发、定时扫描、多房间订阅都会造成重复推送。插件必须自己去重：

- 只处理 `hookId` 以 `<deliveryId>:` 开头的钩子，防止混合不同投递的内容；
- 按 `hookId` 做一次性认领，插件实现是 `PlayerData.claimHookExecution(hookId)`，底层写入本地
  回执表，插入冲突即视为已执行；
- 认领失败就不执行，但仍要把该 `hookId` 写进回执结果，避免整条投递因个别钩子停滞。

## 时序

```text
议题状态变更（closed / invalid 等）
  -> 同事务解析 completion_hooks，写入 minecraft_hook_deliveries(status=pending)
  -> dispatch()：抢占记录(status=delivering, attempts+1)，emit hook:execute 到 server:<serverId>
  -> 插件按 hookId 去重，执行命令 / 渲染 MiniMessage
  -> 插件 emit hook:ack { deliveryId, results }
  -> 后端 acknowledge()：status=delivered, acknowledgedAt=now, result=JSON(results)
  -> 无回执时由 30 秒扫描重试，5 次后 status=failed（死信）
```

## 与模板配置的对应关系

| 模板配置 | 投递中的体现 |
|---------|------------|
| `completion_hooks[].event` | 决定何时解析，并原样写进投递的 `event` 与 `hook:execute.event` |
| `completion_hooks[].type` | `command` / `minimessage`，成为 `hooks[].type` |
| `commands` / `messages` / `message` | 逐条展开成 `hooks[]` 元素，序号决定 `hookId` 后缀 |
| `if` 条件 | 在解析阶段求值，条件不通过就不会产生投递 |
| `type: selection` 的 `actions` | 决策提交后才转成投递，`event` 沿用决策挂载的事件值 |

字段、事件值、条件的完整写法见 [模板：完成钩子](../template/hooks.md)。
