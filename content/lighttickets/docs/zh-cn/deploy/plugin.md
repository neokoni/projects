---
order: 40
---

# Minecraft 插件部署

## 支持的平台

| 平台 | 模块 | 说明 |
| --- | --- | --- |
| Paper / Folia | `plugin/paper` | `paper-plugin.yml` 中 `api-version: '1.21'`、`folia-supported: true` |
| Velocity | `plugin/velocity` | 代理端插件，可同时服务多台后端服务器 |

`plugin/settings.gradle.kts` 定义 `common`、`paper`、`velocity` 三个 Gradle 模块，公共逻辑位于 `common`。

## jar 获取

获取方式有三种，任选其一。

1. 发行版：<https://github.com/neokoni/LightTickets/releases> 下载与后端同版本的 jar。
2. CI 产物：<https://github.com/neokoni/LightTickets/actions>，`dev-build` 工作流构建两个平台的 jar（Node 26）。
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

文件名由 `archiveBaseName` 与 `all` classifier 组成。部署时仅放置 `-all.jar`，不放置未打包依赖的原始 jar。

## 安装步骤

1. 停止服务器。
2. 将对应 jar 放入 `plugins/`。
3. 启动服务器，插件将在数据目录生成 `config.yml`：

| 平台 | 数据目录 |
| --- | --- |
| Paper / Folia | `plugins/LightTickets/` |
| Velocity | `plugins/lighttickets/` |

插件自身的玩家绑定缓存（`PlayerData.db`）同样位于该目录，与后端的数据库无关。

## config.yml 字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `baseUrl` | string | `http://localhost:23310` | LightTickets 站点的公开地址，解析为 origin |
| `serverKey` | string | 空 | 服务器 API Key，通过请求头 `X-Server-Key` 与 WebSocket `auth.serverKey` 使用 |
| `prefix` | string | `<white>[<color:#96bfff>LightTickets<white>] ` | 消息前缀，MiniMessage 语法 |
| `storage.type` | string | `SQLITE` | 插件本地数据存储类型 |
| `storage.host` | string | `127.0.0.1` | MySQL 主机（`storage.type` 为 MySQL 时使用） |
| `storage.port` | int | `3306` | MySQL 端口 |
| `storage.username` | string | `root` | MySQL 用户名 |
| `storage.password` | string | 空 | MySQL 密码 |
| `storage.database` | string | `lighttickets` | MySQL 数据库名 |
| `templateRefreshInterval` | int | `30` | 模板刷新间隔（分钟），`0` 表示禁用 |
| `playerRefreshInterval` | int | `300` | 玩家数据刷新间隔（秒），`0` 表示禁用 |
| `playerGroupUpload.enabled` | bool | `false` | 是否将玩家名上传至玩家组（player group） |
| `playerGroupUpload.groupId` | string[] | 空数组 | 目标玩家组 ID 列表 |
| `ticketStatusColors.open` | string | `#4ade80` | 开放状态颜色 |
| `ticketStatusColors.inProgress` | string | `#facc15` | 处理中状态颜色 |
| `ticketStatusColors.closed` | string | `#96bfff` | 已关闭状态颜色 |
| `ticketStatusColors.invalid` | string | `#94a3b8` | 无效状态颜色 |
| `ticketStatusColors.unknown` | string | `#ffffff` | 未知状态颜色 |

`storage` 为插件本地的缓存库，并非后端的业务数据库。该项可不填；仅当需要持久化玩家绑定信息时使用 MySQL。

## baseUrl 规则

`baseUrl` 须为站点的公开 origin：

```yaml
baseUrl: https://tickets.example.com
```

- 仅允许 `scheme://host[:port]`，不包含 `/api`、`/socket.io`、查询或片段；
- 插件将基于 origin 生成两类地址：`<origin>/api/...` 与 WebSocket 命名空间 `<origin>/mc`；
- 携带 `/api` 的旧配置在升级期将被容忍，新配置须写纯 origin。

`baseUrl` 须填写前端地址（默认 23310），不填写后端地址 23320。`server.mjs` 负责将 `/api` 与 `/socket.io` 转发至后端；插件仅需与站点同源，即可经反向代理访问后端。

## API Key 创建与服务器绑定

1. 用管理员账号登录后台，进入服务器（server）管理，新建一条服务器记录，并记录其识别 ID。
2. 为该服务器创建 API Key（server key），完整值仅在创建时显示一次。
3. 将 Key 填入插件 `config.yml` 的 `serverKey`，`baseUrl` 填写站点地址。
4. 重载插件或重启服务器。

绑定模式：

- Paper / Folia：一台后端服务器对应一个 API Key。
- Velocity：一个 Key 可绑定多台后端服务器，由代理端统一转发。

后端鉴权与 Key 绑定的接口说明见 [其他接口与集成注意](../server-api/misc.md)。

::: warning
`serverKey` 等同于该服务器的凭据。该值出现在版本库、日志或截图中即构成泄露；泄露后在后台吊销并重新生成，随后更新插件配置。
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

## 验证方式

1. 启动日志中出现 WebSocket 已连接的信息；若提示 `serverKey` 为空或连接失败，表示绑定尚未完成。
2. `/lit status`：分别显示 WebSocket 与 HTTP API 的在线状态。
3. `/lit account`：显示当前玩家的绑定信息（未绑定时为空）。
4. `/lit ticket list`：能拉取后端议题列表，表示 Key 与权限均正确。

## 常见问题

### baseUrl 含 `/api` 或直接指向后端端口

`baseUrl` 须与浏览器访问的站点地址一致。填写 `http://host:23310/api` 或 `http://host:23320`（后端直连且未配置 CORS）将导致请求失败；改回纯 origin。

### 服务器识别 ID 与后台记录不一致

每条插件连接均通过 API Key 关联至后台的服务器记录。Velocity 模式下，请求会附带玩家当前所在的后端服务器名，该名称须与后台登记的服务器识别 ID、Velocity 注册名一致，否则接口返回 401 `该 API Key 未授权此服务器`。将同一个 Key 复制到多台机器，或在后台删除并重建服务器记录，均会产生该不一致。为每台服务器单独创建 Key。

### serverKey 填写错误或已吊销

后端拒绝该 Key 后，插件无法建立 WebSocket，`/lit status` 将显示离线。在后台核对 Key 前缀，必要时重新生成并替换。

### 插件版本落后于后端

插件与后端版本不匹配时采用 fail-closed：不推测协议差异，直接拒绝连接。处理方式为先在后台解绑该服务器，再升级插件，随后用新的 Key 重新绑定；反复重启不改变该结果。

### 玩家组上传未生效

`playerGroupUpload.enabled` 默认为 `false`，`groupId` 须为已存在的玩家组 ID 列表。修改后须重载插件。
