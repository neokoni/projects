---
order: 60
---

# 运维与升级

本文只讲操作：备份与恢复、数据库与迁移、存储切换、升级顺序、反向代理与限流、排障、后台定时任务。组件与端口见 [部署指南](./index.md)，配置键含义见 [配置参考](./config.md)。

## 备份与恢复

### 备份范围

后端是唯一持有数据的服务，数据目录由 `LT_SERVER_DATA_DIR` 决定（默认 `data`，容器内 `/app/data`）。

| 对象 | 位置 | 说明 |
| --- | --- | --- |
| 数据目录 | `data/` 全量 | 最省事的方式，覆盖下面几项 |
| 平台配置 | `data/config.yml` | 含数据库连接与密钥，权限 `0600`；丢了只能重跑 setup |
| SQLite 数据库 | `data/data.db` | 仅 `database.provider: sqlite` 时存在 |
| MySQL 数据库 | `host:port/database` | 不在 `data/` 里，必须单独导出 |
| 附件 | `data/uploads/` 或 S3 桶 | 取决于存储驱动的 `uploadDir` 或 S3 配置 |
| 模板与素材 | `data/templates/`、`data/locales/`、`favicon.*`、`logo.*` | 含 `.templates_initialized` 标记 |

`data/prisma/` 是每次启动重新生成的迁移副本，不必备份。`config.yml` 与数据库必须来自同一时刻，否则用 `security.externalEncryptionKey` 加密的字段会解不开、会话全部失效。

### 备份时机与命令

升级后端或插件前、修改存储驱动或上传目录前、切换 `database.provider` 或人工改 schema 前，都要先备份。

```bash
# SQLite：停止写入后整体打包，最稳妥
docker compose down
sudo tar -czf lighttickets-data-$(date +%F).tar.gz -C . data
docker compose up -d

# MySQL：单独导出（库不在 data/ 里）
mysqldump -h <host> -P 3306 -u <user> -p <database> > lighttickets-$(date +%F).sql

# S3 驱动：用习惯的工具整桶同步一份
aws s3 sync s3://<bucket>/<prefix> ./backup-s3/
```

恢复顺序：停服务 → 解包覆盖 `data/` → `sudo chown -R 0:0 ./data` → MySQL 先导入 dump → 启动并确认日志出现 `[migrate] ... migrations applied` → 用 `/api/health` 验证。热备份也可以，但要保证数据库文件不在写入中途，SQLite 请先 `down` 再打包。

## 数据库

### SQLite 与 MySQL 的差异

| 项 | SQLite | MySQL |
| --- | --- | --- |
| provider | `sqlite` | `mysql` |
| 位置 | 固定 `data/data.db` | `host`、`port`、`username`、`password`、`database` |
| 迁移目录 | `prisma/migrations`（锁文件声明 `sqlite`） | `prisma/migrations-mysql`（声明 `mysql`） |
| 迁移失败 | 回退为逐条执行 `migration.sql` 并补写 `_prisma_migrations` | 不回退，直接抛错 |
| 备份 | 打包 `data/data.db` | `mysqldump` |

### 自动迁移与两套目录

每次启动后端都会跑一次迁移，无需手工执行：后端把 `prisma/migrations` 或 `prisma/migrations-mysql` 复制到 `data/prisma/migrations`，再执行 `npx prisma generate` 与 `npx prisma migrate deploy`，成功后输出 `[migrate] sqlite migrations applied` 或 `[migrate] mysql migrations applied`。迁移需要一个可用的 `DATABASE_URL`，数据库连不上时后端会启动失败退出。

两套目录各带一份声明 provider 的 `migration_lock.toml`，不能混用；`migrations-mysql` 比 `migrations` 多 `20260711000000_expand_text_storage_columns` 与 `20260919000000_player_group_value_binary_collation`。不要往另一套目录手工补文件，也不要手改锁文件。

MySQL 没有回退分支，失败就意味着后端起不来：从日志取 prisma 原始报错，先排除连接与权限（账号 DDL 权限、库是否存在、`args` 的 SSL 参数是否被接受）；若失败发生在执行到一半的 DDL 上，用升级前的备份恢复数据库后重试，不要靠删表或删迁移记录去"修复"。SQLite 的失败更轻，回退路径逐条执行 `migration.sql`，日志里能直接看到是哪一条。

### 切换 provider

数据不会自动迁移，`sqlite` 与 `mysql` 之间要自行导出导入。setup 完成后 provider 由 `config.yml` 的 `database` 决定，改完必须重启后端；切换前备份 `data/` 与旧库，切换后旧的 `data/data.db` 不会被读取也不会被删除，新的 provider 首次启动会完整执行对应目录的迁移。

## 存储运维

默认 `{ driver: 'local', uploadDir: 'data/uploads' }`；S3 默认 `region: us-east-1`、`forcePathStyle: true`、`presignExpiry: 300`。

关键事实是：每个附件记录自带 `storageType`，切换驱动只影响之后的写入，旧附件仍由它自己记录的驱动提供，不会被搬迁。所以只有两条路：共存切换（只改默认驱动，原本地目录或 S3 桶保持可读，历史附件照常访问）与彻底切换（先清空现有附件再改配置）。

有本地附件时修改上传目录、有 S3 附件时修改存储位置，都会被后端以 409 拒绝（`backend/src/services/storage-config.service.ts`）。换位置前先备份原目录或桶；历史附件突然 404，多半是换驱动后又删了 `data/uploads/`。

`uploadDir` 必须对后端进程可写，容器内后端以 root 运行，恢复进来的文件统一 `chown -R 0:0 ./data`。上传大小还受反向代理 `client_max_body_size` 与附件配额限制，配额见 [配置参考](./config.md)。

## 升级流程

顺序固定：备份 → 拉取新版本 → 后端迁移并重启 → 前端重新构建 → 更新插件 → 验证。后端启动时自动迁移 schema，插件通过 HTTP 与 WebSocket 调用后端，所以后端必须先上；旧插件或缺少 `playerCredential` 的历史绑定会 fail-closed，玩家需在网页解绑后重新绑定。

### Docker Compose

```bash
docker compose down                                   # 停服务后备份
sudo tar -czf lighttickets-data-$(date +%F).tar.gz -C . data
docker compose up --build -d                          # 重建两个镜像
docker compose logs -f server                         # 看迁移日志
curl -s http://127.0.0.1:23320/api/health             # 验证
```

前端是构建期产物，`LT_WEB_API_URL` 变化时必须重建，`up --build` 会一并处理。手写的 systemd 单元与进程细节见 [手动部署](./manual.md)。

### 手动部署（VM）

```bash
cd backend && git pull && npm install && npm run build
sudo systemctl restart lighttickets-server
curl -s http://127.0.0.1:23320/api/health

cd ../frontend && npm install && LT_WEB_API_URL=/api npm run build
sudo systemctl restart lighttickets-web
```

### 插件与模板

用与后端同版本的 `-all.jar`。Paper / Folia 数据目录为 `plugins/LightTickets/`，Velocity 为 `plugins/lighttickets/`，其中的 `PlayerData.db` 是插件本地缓存，与后端数据库无关。重启服务器后执行 `/lit status`：它分别报告 WebSocket 与 HTTP API 状态，两者都 online 才算接通，字段含义见 [Minecraft 插件部署](./plugin.md)。

`data/templates/` 出现 `.templates_initialized` 后，内置模板（`backend/templates/`）的更新不再自动同步。需要新模板时手动比对后复制，不要整目录覆盖，否则会丢掉站点内的自定义模板。

### 回滚边界

- 迁移只有向前方向，没有 down migration，回退代码不会回退 schema；
- 可在相邻版本间回退代码，已前进的 schema 只能靠备份恢复（`data/` 或 MySQL dump）；
- 不要回退到早于玩家会话强化的旧版本，它们与当前绑定数据不兼容；
- 回滚后插件也要退回同版本，避免新插件对着旧后端。

## 反向代理与限流

### trustedProxyIps

```yaml
server:
  trustedProxyIps:
    - 127.0.0.1
    - 10.0.0.2
```

精确 IP 列表，空数组表示不信任任何转发头、`X-Forwarded-For` 被忽略。部署在反向代理后面必须填代理的真实 IP，否则所有请求按代理 IP 计限流，很快触发 429，后台看到的客户端 IP 也全是代理地址。该键只能通过 setup 向导或手改 `config.yml` 后重启后端修改；反代侧要透传 `X-Forwarded-For`，nginx 示例见 [Docker Compose 部署](./docker.md)。限流默认值（全局 60 秒 100 次、认证类 60 秒 10 次等）见 [配置参考](./config.md)。

### 同步 CORS

同源访问（反代把 `/`、`/api`、`/socket.io` 都指向前端端口）无需额外配置。浏览器直连后端端口、或前后端分属不同域名/端口时，必须把站点公开 origin 写进 `server.corsOrigins`，否则请求会被浏览器直接拦下，表现为登录失败或数据加载不出来；改动同样需要重启后端。

## 日志与排障

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 容器反复重启 | 迁移失败、`config.yml` 非法、数据库不可达 | `docker compose logs server` 看首屏报错，核对 `database` 与密钥格式 |
| `/api/health` 不通 | 后端未启动、端口不一致、探活地址写错 | 容器内 `curl 127.0.0.1:23320/api/health`，核对 `LT_SERVER_PORT` |
| 插件连不上 | `baseUrl` 不是纯 origin、`serverKey` 已吊销或与服务器记录不匹配、反代丢弃 WebSocket | 游戏内 `/lit status` 区分 WS 与 HTTP；核对 [插件配置](./plugin.md) 与 `location /socket.io/` 的升级头 |
| 429 频繁 | 未配置 `trustedProxyIps`，全站按代理 IP 计数 | 填入代理真实 IP 后重启，并确认不是被刷 |
| 附件上传 413 | 反向代理请求体上限过小 | 调大 `client_max_body_size` |
| 附件上传 400 / 409 | 驱动未就绪、`uploadDir` 不可写、S3 凭据或 region 不对；改存储位置被拒 | 看 server 日志中的附件错误，按"存储运维"的顺序处理 |
| MySQL 连接失败 | host/port 不可达、账号无权限、`args` 的 SSL 参数不被接受 | 用同样参数在库主机上手工连一次 |
| 写不进 `config.yml`、启动报 `EACCES` | `data/` 属主或权限不对 | `sudo chown -R 0:0 ./data`，不要给目录设只读 |
| 迁移时 `npx prisma` 不可用 | 运行环境缺 npm/npx，或无法访问网络获取 prisma CLI | 换用带 npm 的官方镜像，并确认能出网 |

## 定期任务

后端启动时注册三组定时任务（`backend/src/index.ts`），随进程运行，无需人工干预：

| 任务 | 周期 | 作用 |
| --- | --- | --- |
| 孤儿附件清理 | 15 分钟 | 按附件过期设置清理上传后长期未挂到议题上的文件 |
| 链接码清理 | 5 分钟 | 清理过期的绑定码与注册链接 |
| 审计日志结算 | 1 秒 | 把待结算的审计记录落库 |

启动后先立即执行一次再按周期运行，上一次未结束时本轮跳过；失败只打一条 `warn`（前缀 `[attachments]`、`[link-code]`、`[audit]`），不会中断服务；进程没运行就没有清理动作，下次启动会补做一次。完成钩子的投递不在这三组里：投递失败会留成死信，需要手工重新投递，不会自动无限重试。
