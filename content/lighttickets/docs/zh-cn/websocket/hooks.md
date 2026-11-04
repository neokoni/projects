---
order: 30
---

# 完成钩子投递

## 触发时机

仅当同时满足以下条件时才产生投递记录：

- 议题状态发生实际变更（`nextStatus !== ticket.status`）；
- 议题归属于某台服务器（`ticket.serverId` 非空）；`ticket.serverId` 为空时跳过，该事件无法定位房间；
- 模板的 `completion_hooks` 中存在 `event` 等于新状态、`type` 不是 `selection`、且条件
  （`if`）求值通过的钩子，解析结果非空。

入队与状态变更在同一数据库事务内完成（`createForResolvedHooks`），事务提交后才调用
`dispatch` 推送。`type: selection` 的执行选项不会立即下发，其先进入待处理状态并等待 `staff` 角色决策；
决策提交后产生的命令 / 消息动作才走同一条投递链路。

派发前检查 `server:<serverId>` 房间内是否存在活跃连接。无插件在线时不会 `emit`，记录保持
`pending`，插件下次连接后由补发逻辑处理。

## hook:execute

payload 在 `dispatch` 中构造：

```jsonc
{
  "deliveryId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e", // string，投递 ID，回执时须原样带回
  "ticketId": 42,                                        // number，关联议题 ID
  "event": "closed",                                     // string，触发本次投递的模板事件值，即状态名
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11",  // string | null，议题作者绑定的 Minecraft UUID，未绑定时为 null
  "hooks": [                                             // array，解析后的钩子列表，元素来自入库时保存的快照
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:0", // string，钩子唯一标识，格式为 <deliveryId>:<序号>，序号从 0 开始
      "type": "command",                                   // string，取值 command 或 minimessage
      "content": "tell Neokoni 议题 #42 已关闭"              // string，命令文本或 MiniMessage 文本
    },
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:1",
      "type": "minimessage",
      "content": "<color:#96bfff>你的议题 #{ticket_id} 已关闭</color>",
      "placeholders": {                                    // object，仅 minimessage 出现；键为 content 中引用的占位符名，无替换项时为空对象
        "ticket_id": "42"
      }
    }
  ]
}
```

`command` 类型的 `content` 在入库时已完成占位符替换；`minimessage` 保留原始文本，实际引用到的占位符
单独放入 `placeholders`，由插件渲染。

## hook:ack

回执事件名固定为 `hook:ack`，服务端接受两种形态。

旧版：纯字符串 `deliveryId`。

```jsonc
"7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e"
```

新版：带逐钩子结果的 envelope。

```jsonc
{
  "deliveryId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e",
  "results": [
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:0",
      "success": true
    },
    {
      "hookId": "7d1e5c2b-3a4f-4c8d-9e6b-0f1a2b3c4d5e:1",
      "success": false,
      "error": "player not online"
    }
  ]
}
```

服务端校验规则：

- 字符串形态长度不得超过 128，超出将被忽略；
- 对象形态的 `deliveryId` 须为非空字符串且长度不超过 128，否则将被忽略；
- `results` 仅检查是否为数组；元素内容原样序列化进投递记录的 `result` 字段，不做逐字段校验；
- 回执仅对「同一个 key、同一台服务器、尚未回执、状态为 `pending` 或 `delivering`」的记录生效；重复或
  多发的 `hook:ack` 不会覆盖已完成记录；
- 回执将整条投递标记为 `delivered`，不再区分单个钩子的成功与否。失败的钩子信息仅作为排查依据
  记录在 `result` 中；服务端不会因单个钩子失败而重试整条投递。

::: warning
带 `results` 的回执仅为更详细的日志，不代表部分成功。若插件需要重试失败的钩子，须在本地自行保证，
待整体执行成功后再回执。
:::

## 重试与死信

投递记录模型 `MinecraftHookDelivery`（`backend/prisma/schema.prisma`）的状态取值：

| `status` | 说明 |
|----------|------|
| `pending` | 已入队，尚未派发或等待重试 |
| `delivering` | 已派发，等待回执 |
| `delivered` | 已收到回执，终态 |
| `failed` | 达到最大尝试次数仍未回执，即死信 |

相关时间与计数字段：`attempts`、`lastAttemptAt`、`acknowledgedAt`、`failedAt`、`result`。

重试策略：

- 派发时以条件更新抢占记录，命中才 `emit`，同时 `attempts + 1`、写入 `lastAttemptAt`，避免重复派发；
- 同一记录在 `delivering` 状态下的最小重试间隔按 `15s × 2^(attempts-1)` 递增，上限为 15 分钟；
- 最大尝试次数为 5（`HOOK_DELIVERY_MAX_ATTEMPTS`），超出后标记 `failed` 并写入 `failedAt`；
- 触发重试的入口有两个：插件连接时的 `dispatchPendingForServer`，以及服务端每 30 秒的定时扫描；
- 每次扫描对每台已连接服务器最多取 100 条待投递记录，按 `createdAt` 升序排列。

死信可在管理后台查看并手动重试；接口需要管理员身份：

```http
GET /api/admin/minecraft-hook-deliveries
Authorization: Bearer <accessToken>

POST /api/admin/minecraft-hook-deliveries/:id/retry
Authorization: Bearer <accessToken>
```

重试接口的返回体：

```jsonc
// 记录为死信，已重置
{
  "retried": true
}
```

记录不存在或状态不为 `failed` 时返回：

```jsonc
// 记录不存在，或状态不为 failed
{
  "retried": false
}
```

该接口仅处理 `status = failed` 的记录，将其重置为 `pending`，清零 `attempts`，清空 `lastAttemptAt` 与
`failedAt`，随后由下一次定时扫描或插件连接补发重新派发；记录不存在或不是死信时 `retried` 为 `false`。

## 幂等要求

`hook:execute` 可能重复到达：重连补发、定时扫描、多房间订阅均会造成重复推送。插件须自行去重：

- 仅处理 `hookId` 以 `<deliveryId>:` 开头的钩子，防止混合不同投递的内容；
- 按 `hookId` 做一次性认领，插件实现为 `PlayerData.claimHookExecution(hookId)`，底层写入本地
  回执表；插入冲突即视为已执行；
- 认领失败时不执行，但仍须将 `hookId` 写入回执结果，避免整条投递因个别钩子停滞。

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
| `completion_hooks[].event` | 决定解析时机，并原样写入投递的 `event` 与 `hook:execute.event` |
| `completion_hooks[].type` | `command` / `minimessage`，成为 `hooks[].type` |
| `commands` / `messages` / `message` | 逐条展开为 `hooks[]` 元素，序号决定 `hookId` 后缀 |
| `if` 条件 | 在解析阶段求值；条件不通过时不会产生投递 |
| `type: selection` 的 `actions` | 决策提交后才转为投递，`event` 沿用决策挂载的事件值 |

字段、事件值、条件的完整写法见 [模板：完成钩子](../template/hooks.md)。
