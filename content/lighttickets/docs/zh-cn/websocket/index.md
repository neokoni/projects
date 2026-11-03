---
order: 70
---

# WebSocket 连接

## 传输与路径

| 项目 | 取值 |
|------|------|
| 协议 | Socket.IO（底层 WebSocket） |
| transport 路径 | `/socket.io` |
| namespace | `/mc` |
| 鉴权方式 | 握手的 `auth.serverKey` |

`baseUrl` 必须配置为平台的公开 origin，例如 `https://tickets.example.com`，不要附加 `/api`，
也不要附加 `/socket.io`。这与 `docs/api.md` 的「MC 插件接口」章节一致：HTTP 请求走
`/api/mc/*`，Socket.IO transport 固定走 `/socket.io`，namespace 固定为 `/mc`。

两种流量由 Web 容器统一暴露，Docker 部署时只需要对外公开 Web 容器。

::: tip
Java 客户端会校验 `baseUrl`：`LightTicketsUri.origin()` 只接受纯 `http(s)` origin，带 path
（历史上生成的 `/api` 除外）会直接判定为配置无效。所以把 `/socket.io` 写进 `baseUrl` 会导致
插件连不上。
:::

## 握手鉴权

服务端只从握手请求的 `auth` 对象读取 API key，字段名是 `serverKey`。`resolveSocketServerKey`
的判定条件全部满足才返回 key：

- `handshake.auth` 必须是对象，不能是 `null` 或数组；
- `auth.serverKey` 必须是非空字符串；
- 长度不得超过 128。

服务端**不读取** `Authorization`、`X-Server-Key` 等 header，也不读取 query 参数。把 key 放在
header 或 query 里会让连接以 `Missing server key` 失败。

鉴权通过后，服务端用 `serverService.authenticateApiKey` 校验 key（先按哈希匹配服务器 API key，
再回退匹配旧版服务器的 `legacyApiKeyHash`），并把绑定服务器列表写入 `socket.data.serverIds`。

失败时服务端调用 `next(new Error(...))`，客户端会在 `connect_error` 事件中收到以下消息之一：

| 错误信息 | 含义 |
|----------|------|
| `Missing server key` | 握手 `auth.serverKey` 缺失、非字符串、空串或超过 128 字符 |
| `Invalid server key` | key 不存在、已失效或哈希不匹配 |
| `API Key has no servers` | key 有效但未绑定任何服务器 |
| `Not allowed by CORS` | 请求来源不在 `server.corsOrigins` 中 |

::: warning
错误文本仅用于本地日志排查，不要在插件里按字符串分支处理业务逻辑，也不要把它直接展示给玩家。
:::

## 连接成功之后

- 服务端逐个执行 `socket.join('server:<serverId>')`。Paper/Folia key 只绑定一台服务器，因此只加入
  一个房间；Velocity key 可以绑定多台服务器，会同时加入多个 `server:<serverId>` 房间。
- 控制台会输出连接日志，形如
  `[socket] Minecraft API key connected: <key 标题或 "Velocity API Key xxxxxxxx">`。没有设置标题时，
  日志用 key 类型与 id 前 8 位标识。
- 断开时输出 `[socket] Minecraft API key disconnected: ...`。
- 连接建立后立即对每个绑定服务器调用一次 `dispatchPendingForServer`，把插件离线期间积压的完成钩子
  投递补发出去，详见 [完成钩子投递](./hooks.md)。
- 服务端还有一个 30 秒周期的定时器，遍历当前已连接的服务器 ID 再次补发待投递记录，用
  `unref()` 挂载，不会阻止进程退出。

::: tip
补发的前提是房间里有活跃连接：没有插件在线时投递记录会留在 `pending`，等插件下次连接时再处理。
:::

## CORS

Socket.IO 服务的 `cors.origin` 是回调函数：没有 `Origin` 头（例如服务端到服务端）的请求直接放行，
带 `Origin` 的请求必须在 `config.yml` 的 `server.corsOrigins` 列表中，否则回调
`Error('Not allowed by CORS')`。该配置默认值为 `['http://localhost:23310']`。

浏览器端接入时记得把站点 origin 加进 `server.corsOrigins`；Minecraft 插件使用原生 WebSocket，
通常不受浏览器同源限制，但部署了反向代理时仍建议保持配置一致。

## 客户端最小示例

Node 或浏览器环境（`socket.io-client`）：

```js
import { io } from 'socket.io-client';

const socket = io('https://tickets.example.com/mc', {
  path: '/socket.io',
  auth: { serverKey: '<apiKey>' },
  transports: ['websocket'],
});

socket.on('connect', () => console.log('connected', socket.id));
socket.on('connect_error', (err) => console.warn('connect_error', err.message));
socket.on('ticket:status_changed', (payload) => console.log(payload));
```

Java 客户端（插件自带的 `WebSocketClient.java`）配置要点：

```java
IO.Options options = IO.Options.builder()
    .setAuth(Map.of("serverKey", serverKey))
    .setTransports(new String[]{WebSocket.NAME})
    .setPath("/socket.io")
    .setReconnection(true)
    .setReconnectionDelay(5000)
    .setReconnectionDelayMax(30000)
    .setTimeout(10000)
    .build();
socket = IO.socket(baseUrl + "/mc", options);
```

- 重连延迟从 5 秒开始退避，上限 30 秒，连接超时 10 秒；
- 只启用 WebSocket 传输，不使用 HTTP 长轮询；
- 订阅 `ticket:status_changed`、`ticket:comment_created`、`hook:execute` 三个事件；
- 插件启用时与执行 `/lit reload` 时都会重建连接。

## 与 HTTP API 的分工

| 场景 | 走哪条通道 |
|------|-----------|
| 查询议题列表、议题详情、评论 | HTTP `/api/mc/*` |
| 创建议题、发表评论、绑定账号 | HTTP `/api/mc/*` |
| 收到状态变更、新评论通知 | WebSocket 推送 |
| 执行完成钩子、回执结果 | WebSocket 推送 + `hook:ack` |
| 断线后补齐数据 | HTTP 拉取 |

推送只是「提示有变化」，不保证不漏。插件收到事件后应通过 HTTP 重新拉取权威数据，具体的事件字段
与处理建议见 [推送事件](./events.md) 和 [完成钩子投递](./hooks.md)。
