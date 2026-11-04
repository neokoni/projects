---
order: 20
---

# 推送事件

## 事件总表

| 事件名 | 触发条件 | 广播范围 | payload 主要字段 |
|--------|---------|---------|-----------------|
| `ticket:status_changed` | 议题状态变更完成，且作者已绑定 Minecraft 账号 | `server:<serverId>` 或全部连接 | `ticketId`、`title`、`playerUuid`、`oldStatus`、`newStatus`、`actorUserId`、`actorMinecraftUuid`、`actorName` |
| `ticket:comment_created` | 新评论创建成功，且存在需通知的玩家 | `server:<serverId>` 或全部连接 | `ticketId`、`title`、`playerUuid`、`commentId`、`body`、`authorUserId`、`authorMinecraftUuid`、`authorName`、`source` |
| `hook:execute` | 完成钩子投递被派发 | `server:<serverId>` | 见 [完成钩子投递](./hooks.md) |

议题相关事件为上表所列两条：无议题创建事件，亦无删除、标签、受理人事件的推送。上述信息仅可通过 HTTP 接口查询。

## ticket:status_changed

payload 由 `backend/src/services/ticket.service.ts` 的 `emitStatusChanged` 构造：

```jsonc
{
  "ticketId": 42,                                      // number，议题 ID
  "title": "服务器无法进入",                            // string，议题标题
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11", // string，接收者 UUID，即议题作者
  "oldStatus": "open",                                 // string，变更前状态，取值 open / in_progress / closed / invalid
  "newStatus": "closed",                               // string，变更后状态，取值同上
  "actorUserId": 7,                                    // number，操作者用户 ID
  "actorMinecraftUuid": "9b8c7d6e-5f40-4a3b-8c2d-1e0f2a3b4c5d", // string | null，操作者绑定的 Minecraft UUID，未绑定时为 null
  "actorName": "Neokoni"                               // string | null，操作者显示名，优先 minecraftName，回退 username
}
```

发送条件（`emitStatusChanged` 开头）：议题作者与操作者为同一人时直接返回；作者未绑定 `minecraftUuid` 时亦直接返回。该事件仅用于议题被他人变更时对作者的提醒。

## ticket:comment_created

payload 由 `backend/src/services/comment.service.ts` 的 `create` 构造：

```jsonc
{
  "ticketId": 42,                                      // number，议题 ID
  "title": "服务器无法进入",                            // string，议题标题
  "playerUuid": "3f2f0a7e-1c1a-4f6e-9a3f-2b1c7d9e0a11", // string，接收者 UUID
  "commentId": "0c9f3f6a-8b2e-4c77-9d51-6a4b8e2f1c33", // string，评论 ID
  "body": "已经恢复，可以重新登录了",                    // string，评论原文
  "authorUserId": 7,                                   // number，评论作者用户 ID
  "authorMinecraftUuid": "9b8c7d6e-5f40-4a3b-8c2d-1e0f2a3b4c5d", // string | null，评论作者绑定的 Minecraft UUID
  "authorName": "Neokoni",                             // string，评论作者显示名，优先 minecraftName，回退 username
  "source": "web"                                      // string，评论来源，取值 web 或 minecraft
}
```

接收者由后端逐人计算：先取议题作者（非评论者本人时），再取全部受理人（排除评论者本人），去重后对每个 UUID 各发一条 payload。一次评论因此可能产生多条事件，各条事件的 `playerUuid` 不相同。上述步骤未产生任何接收者，且评论来源为 `minecraft`、评论者为议题作者时，后端将通知发送给所有已绑定 Minecraft 账号的 `staff` / `admin`（排除评论者本人）。

## 广播规则

两个议题事件共用同一段分支逻辑：议题存在归属服务器时，事件仅发往对应房间；否则广播给所有已连接的服务器。

```ts
if (ticket.serverId) {
  emitTicketUpdate(ticket.serverId, 'ticket:status_changed', payload);
} else {
  emitToAllServers('ticket:status_changed', payload);
}
```

- `emitTicketUpdate` 实际执行 `io.of('/mc').to('server:<serverId>').emit(event, data)`，仅加入该房间的连接能收到。
- `emitToAllServers` 执行 `io.of('/mc').emit(event, data)`，全部已连接的 `/mc` 客户端均会收到。
- 一个 Velocity key 绑定多台服务器时将加入多个房间，同一条连接因此能收到多台服务器的事件。建议插件按议题与评论去重。

`hook:execute` 不经过该段逻辑，其始终发往 `server:<delivery.serverId>`；房间内无活跃连接时不派发。

## 客户端处理建议

- **幂等**：同一议题可能在短时间内重复收到事件（多房间、重连补发、评论逐人发送）。建议按 `ticketId`、`commentId`、`oldStatus`/`newStatus` 的组合去重，不建议仅凭单次事件触发写库。
- **断线补齐**：推送不是可靠队列。重连成功后，建议先用 HTTP 拉取议题列表与详情，再恢复基于事件提示的处理模式。插件自带实现在收到事件时调用 `DataRefreshManager.requestRefresh(playerUuid)`，以 HTTP 结果覆盖本地缓存。
- **不依赖顺序**：后端不提供序号，重复事件亦不保证先后。建议以 HTTP 返回的当前状态为准，`oldStatus` 仅用于文案展示。
- **过滤自身操作**：插件在收到事件后对比 `actorMinecraftUuid` / `authorMinecraftUuid` 与目标玩家 UUID，相同则不提醒，以免玩家看到其刚执行的操作。
- **字段可能为空**：`actorName`、`actorMinecraftUuid`、`authorMinecraftUuid` 均允许为 `null`；`playerUuid` 缺失时该事件将被丢弃。

::: warning
事件中无 `serverId` 字段。后端仅保证将事件投递到 key 绑定的房间；Velocity 场景下，建议插件结合自身服务器注册名与本地配置判断该通知所属的子服务器。
:::

## 未推送的情形

以下变化不产生任何 WebSocket 事件，仅可通过 HTTP 查询感知：

- 议题创建、编辑正文、修改可见性、变更标签或受理人；
- 评论编辑与删除；
- 完成钩子「执行选项」的待处理创建、提交与跳过（仅提交后产生的命令 / 消息动作经由 `hook:execute`）；
- 附件上传与清理。
