---
order: 40
---

# Minecraft 插件部署

插件把 Minecraft 服务器接进 LightTickets：玩家可以在游戏内创建议题（ticket）、查看列表与详情、评论、接收状态变更通知，也可以绑定网页账号。

## 支持的平台

| 平台 | 模块 | 说明 |
| --- | --- | --- |
| Paper / Folia | `plugin/paper` | `paper-plugin.yml` 中 `api-version: '1.21'`、`folia-supported: true` |
| Velocity | `plugin/velocity` | 代理端插件，可同时服务多台后端服务器 |

`plugin/settings.gradle.kts` 定义了 `common`、`paper`、`velocity` 三个 Gradle 模块，公共逻辑在 `common`。

## 获取 jar

三种方式任选其一。

1. 发行版：<https://github.com/neokoni/LightTickets/releases> 下载与后端同版本的 jar。
2. CI 产物：<https://github.com/neokoni/LightTickets/actions>，`dev-build` 工作流会构建两个平台的 jar（Node 26）。
3. 自行构建：

```bash
cd plugin
./gradlew build
# 或只构建需要的平台
./gradlew paper:shadowJar velocity:shadowJar
```

产物路径：

| 平台 | 文件 |
| --- | --- |
| Paper / Folia | `plugin/paper/build/libs/LightTickets-paper-1.0.0-all.jar` |
| Velocity | `plugin/velocity/build/libs/LightTickets-velocity-1.0.0-all.jar` |

文件名由 `archiveBaseName` 加 `all` classifier 组成，部署时只放 `-all.jar`，不要放未打包依赖的原始 jar。

## 安装

1. 停止服务器。
2. 把对应 jar 放进 `plugins/`。
3. 启动服务器，插件会在数据目录生成 `config.yml`：

| 平台 | 数据目录 |
| --- | --- |
| Paper / Folia | `plugins/LightTickets/` |
| Velocity | `plugins/lighttickets/` |

插件自身的玩家绑定缓存（`PlayerData.db`）也在这个目录里，与后端的数据库无关。

## config.yml 字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `baseUrl` | string | `http://localhost:23310` | LightTickets 站点公开地址，会被解析为 origin |
| `serverKey` | string | 空 | 服务器 API Key，通过请求头 `X-Server-Key` 与 WebSocket `auth.serverKey` 使用 |
| `prefix` | string | `<white>[<color:#96bfff>LightTickets<white>] ` | 消息前缀，MiniMessage 语法 |
| `storage.type` | string | `SQLITE` | 插件本地数据存储类型 |
| `storage.host` | string | `127.0.0.1` | MySQL 主机（`storage.type` 为 MySQL 时使用） |
| `storage.port` | int | `3306` | MySQL 端口 |
| `storage.username` | string | `root` | MySQL 用户名 |
| `storage.password` | string | 空 | MySQL 密码 |
| `storage.database` | string | `lighttickets` | MySQL 数据库名 |
| `templateRefreshInterval` | int | `30` | 模板刷新间隔（分钟），`0` 禁用 |
| `playerRefreshInterval` | int | `300` | 玩家数据刷新间隔（秒），`0` 禁用 |
| `playerGroupUpload.enabled` | bool | `false` | 是否把玩家名上传到玩家组（player group） |
| `playerGroupUpload.groupId` | string[] | 空数组 | 目标玩家组 ID 列表 |
| `ticketStatusColors.open` | string | `#4ade80` | 开放状态颜色 |
| `ticketStatusColors.inProgress` | string | `#facc15` | 处理中状态颜色 |
| `ticketStatusColors.closed` | string | `#96bfff` | 已关闭状态颜色 |
| `ticketStatusColors.invalid` | string | `#94a3b8` | 无效状态颜色 |
| `ticketStatusColors.unknown` | string | `#ffffff` | 未知状态颜色 |

`storage` 是插件本地的缓存库，不是后端的业务数据库；不填也可以，只有需要持久化玩家绑定信息时才用 MySQL。

## baseUrl 规则

`baseUrl` 必须是站点的公开 origin：

```yaml
baseUrl: https://tickets.example.com
```

- 只写 `scheme://host[:port]`，不带 `/api`、不带 `/socket.io`、不带查询或片段；
- 插件会用 origin 拼出两类地址：`<origin>/api/...` 与 WebSocket 命名空间 `<origin>/mc`；
- 携带 `/api` 的旧配置在升级期仍会被容忍，但新配置一律写纯 origin。

`baseUrl` 填前端地址（默认 23310）而不是后端 23320，因为 `server.mjs` 负责把 `/api` 与 `/socket.io` 转发给后端；插件只需与站点同源即可穿越反向代理。

## 创建 API Key 与绑定服务器

1. 用管理员账号登录后台，进入服务器（server）管理，新建一条服务器记录，记下它的识别 ID。
2. 为该服务器创建 API Key（server key），完整值只在创建时显示一次。
3. 把 Key 填进插件 `config.yml` 的 `serverKey`，`baseUrl` 填站点地址。
4. 重载插件或重启服务器。

绑定模式：

- Paper / Folia：一台后端服务器对应一个 API Key。
- Velocity：一个 Key 可以绑定多台后端服务器，由代理端统一转发。

服务端鉴权与 Key 绑定的接口说明见 [其他接口与集成注意](../server-api/misc.md)。

::: warning
`serverKey` 等同于该服务器的凭据，不要提交进版本库、不要出现在日志或截图里。泄露后请在后台吊销并重新生成，然后更新插件配置。
:::

## 权限节点

| 节点 | 默认 | 说明 |
| --- | --- | --- |
| `lighttickets.*` | `op` | 汇总：包含 `lighttickets.admin` 与 `lighttickets.player` |
| `lighttickets.admin` | 继承 `op` 子节点 | 管理权限，包含 `reload`、`status` |
| `lighttickets.player` | 包含全部玩家子节点 | 玩家权限汇总 |
| `lighttickets.reload` | `op` | 重载插件配置 |
| `lighttickets.status` | `op` | 查看 WebSocket 与 HTTP API 连接状态 |
| `lighttickets.bind` | `true` | 绑定 LightTickets 账号 |
| `lighttickets.unbind` | `true` | 解绑账号 |
| `lighttickets.register` | `true` | 获取网页账号绑定码 |
| `lighttickets.account` | `true` | 查看账号绑定信息 |
| `lighttickets.ticket.create` | `true` | 创建议题 |
| `lighttickets.ticket.list` | `true` | 查看议题列表（`search` 复用此节点） |
| `lighttickets.ticket.info` | `true` | 查看议题详情 |
| `lighttickets.ticket.comment` | `true` | 评论议题 |
| `lighttickets.ticket.status` | `true` | 更改议题状态 |

命令根节点为 `/lit` 与 `/lighttickets`，例如 `/lit ticket list`、`/lit ticket info <id>`。

## 验证

1. 启动日志出现 WebSocket 已连接的信息；若提示 `serverKey` 为空或连接失败，说明还没完成绑定。
2. `/lit status`：分别显示 WebSocket 与 HTTP API 的在线状态。
3. `/lit account`：显示当前玩家的绑定信息（未绑定时为空）。
4. `/lit ticket list`：能拉到后端议题列表，说明 Key 与权限都正确。

## 常见问题

### baseUrl 写成带 `/api` 或直接写后端端口

`baseUrl` 必须与浏览器访问的站点地址一致。写成 `http://host:23310/api` 或 `http://host:23320`（后端直连且未配 CORS）都会导致请求失败，改回纯 origin 即可。

### 服务器识别 ID 与后台记录不一致

每条插件连接都通过 API Key 关联到后台的服务器记录。Velocity 模式下请求还会带上玩家当前所在的后端服务器名，它必须与后台登记的服务器识别 ID、Velocity 注册名一致，否则接口返回 401 `该 API Key 未授权此服务器`。若把同一个 Key 复制到多台机器，或在后台删掉重建了服务器记录，就会出现这种不一致。为每台服务器单独建 Key。

### serverKey 填错或已吊销

后端拒绝该 Key 后插件无法建立 WebSocket，`/lit status` 会显示离线。到后台核对 Key 前缀，必要时重新生成并替换。

### 插件版本落后于后端

插件与后端版本不匹配时采用 fail-closed：不猜测协议差异，直接拒绝连接。处理方式是先在后台解绑该服务器，升级插件，然后用新的 Key 重新绑定，而不是反复重启尝试。

### 玩家组上传没有生效

`playerGroupUpload.enabled` 默认为 `false`，且 `groupId` 必须是已存在的玩家组 ID 列表。改完需要重载插件。
