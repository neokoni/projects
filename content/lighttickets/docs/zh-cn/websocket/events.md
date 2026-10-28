---
order: 20
---

# 推送事件

`/mc` 命名空间下当前只有三类由服务端主动发出的推送：两个议题相关事件和一个完成钩子事件。
事件名、字段名都直接来自后端的 emit 调用处，插件应按这里的定义取值。

## 事件总表

| 事件名 | 触发时机 | 广播范围 | payload 主要字段 |
|--------|---------|---------|-----------------|
| `ticket:status_changed` | 议题状态变更完成、且作者绑定了 Minecraft 账号 | `server:<serverId>` 或全部连接 | `ticketId`、`title`、`playerUuid`、`oldStatus`、`newStatus`、`actorUserId`、`actorMinecraftUuid`、`actorName` |
| `ticket:comment_created` | 新评论创建成功，且存在需要通知的玩家 | `server:<serverId>` 或全部连接 | `ticketId`、`title`、`playerUuid`、`commentId`、`body`、`authorUserId`、`authorMinecraftUuid`、`authorName`、`source` |
| `hook:execute` | 完成钩子投递被派发 | `server:<serverId>` | 见 [完成钩子投递](./hooks.md) |

议题相关事件目前只有上面这两个：既没有议题创建事件，也没有删除、标签、受理人等事件的推送。
需要这些信息时请用 HTTP 接口查询。

## ticket:status_changed

payload 在 `backend/src/services/ticket.service.ts` 的 `emitStatusChanged` 中构造。

| 字段 | 类型 | 含义 |
|------|------|------|
| `ticketId` | number | 议题 ID |
| `title` | string | 议题标题 |
| `playerUuid` | string | 本条通知的接收者 UUID，即议题作者 |
| `oldStatus` | string | 变更前状态：`open` / `in_progress` / `closed` / `invalid` |
| `newStatus` | string | 变更后状态，取值同上 |
| `actorUserId` | number | 操作者用户 ID |
| `actorMinecraftUuid` | string \| null | 操作者绑定的 Minecraft UUID，未绑定时为 `null` |
| `actorName` | string \| null | 操作者显示名，优先 `minecraftName`，回退 `username`，都缺失时为 `null` |

```json
{
  "ticketId": 42,
  "title": "服务器无法进入",
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11",
  "oldStatus": "open",
  "newStatus": "closed",
  "actorUserId": 7,
  "actorMinecraftUuid": "9b8c7d6e-5f40-4a3b-8c2d-1e0f2a3b4c5d",
  "actorName": "Neokoni"
}
```

发送条件（`emitStatusChanged` 开头）：议题作者与操作者是同一人时直接返回，作者没有绑定
`minecraftUuid` 时也直接返回。因此该事件只用于「别人改了我的议题」这类提醒。

## ticket:comment_created

payload 在 `backend/src/services/comment.service.ts` 的 `create` 中构造。

| 字段 | 类型 | 含义 |
|------|------|------|
| `ticketId` | number | 议题 ID |
| `title` | string | 议题标题 |
| `playerUuid` | string | 本条通知的接收者 UUID |
| `commentId` | string | 评论 ID（UUID） |
| `body` | string | 评论原文 |
| `authorUserId` | number | 评论作者用户 ID |
| `authorMinecraftUuid` | string \| null | 评论作者绑定的 Minecraft UUID |
| `authorName` | string | 评论作者显示名，优先 `minecraftName`，回退 `username` |
| `source` | string | 评论来源：`web` 或 `minecraft` |

```json
{
  "ticketId": 42,
  "title": "服务器无法进入",
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11",
  "commentId": "0c9f3f6a-8b2e-4c77-9d51-6a4b8e2f1c33",
  "body": "已经恢复，可以重新登录了",
  "authorUserId": 7,
  "authorMinecraftUuid": "9b8c7d6e-5f40-4a3b-8c2d-1e0f2a3b4c5d",
  "authorName": "Neokoni",
  "source": "web"
}
```

接收者由后端逐人计算：先取议题作者（不是评论者本人时），再取所有受理人（排除评论者本人），
去重后对每个 UUID 各发一条 payload，因此一次评论可能产生多条事件，`playerUuid` 各不相同。
如果上面没有产生任何接收者，且评论来源是 `minecraft` 并且评论者就是议题作者，后端会把通知发给
所有绑定了 Minecraft 账号的 `staff` / `admin`（排除评论者本人）。

## 广播规则

两个议题事件共用同一段分支逻辑：议题有归属服务器时只发到对应房间，否则广播给所有已连接服务器。

```ts
if (ticket.serverId) {
  emitTicketUpdate(ticket.serverId, 'ticket:status_changed', payload);
} else {
  emitToAllServers('ticket:status_changed', payload);
}
```

- `emitTicketUpdate` 实际执行 `io.of('/mc').to('server:<serverId>').emit(event, data)`，只有加入该
  房间的连接能收到。
- `emitToAllServers` 执行 `io.of('/mc').emit(event, data)`，所有已连接的 `/mc` 客户端都会收到。
- 一个 Velocity key 绑定多台服务器时会加入多个房间，同一条连接因此能收到多台服务器的事件。
  插件应自己按议题与评论去重。

`hook:execute` 不走这段逻辑，它总是发往 `server:<delivery.serverId>`，房间内没有活跃连接时根本不
派发。

## 客户端处理建议

- **幂等**：同一议题可能在短时间内重复收到事件（多房间、重连补发、评论逐人发送），按
  `ticketId`、`commentId`、`oldStatus`/`newStatus` 组合去重，不要仅凭事件触发一次写库。
- **断线补齐**：推送不是可靠队列。重连成功后先用 HTTP 拉取议题列表与详情，再恢复「靠事件提示」的
  模式。插件自带的实现会在收到事件时调用 `DataRefreshManager.requestRefresh(playerUuid)`，
  以 HTTP 结果覆盖本地缓存。
- **不依赖顺序**：服务端不提供序号，重复事件也不保证先后。以 HTTP 返回的当前状态为准，
  `oldStatus` 只用于文案展示。
- **过滤自身操作**：插件在收到事件后还会对比 `actorMinecraftUuid` / `authorMinecraftUuid` 与目标玩家
  UUID，相同就不提醒，避免玩家看到自己刚做的操作。
- **字段可能为空**：`actorName`、`actorMinecraftUuid`、`authorMinecraftUuid` 都允许为 `null`，
  `playerUuid` 缺失时直接丢弃该事件。

::: warning
事件里没有 `serverId` 字段。Velocity 场景下插件需要结合自身服务器注册名与本地配置判断这条通知
属于哪台子服；后端只保证把事件投递到 key 绑定的房间。
:::

## 未推送的情形

以下变化不会产生任何 WebSocket 事件，只能通过 HTTP 查询感知：

- 议题创建、编辑正文、修改可见性、变更标签或受理人；
- 评论编辑与删除；
- 完成钩子「执行选项」的待处理创建、提交与跳过（只有提交后产生的命令 / 消息动作会走
  `hook:execute`）；
- 附件上传与清理。
