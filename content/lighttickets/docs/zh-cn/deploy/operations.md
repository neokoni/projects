---
order: 60
---

# 运维与升级

## 备份与恢复

### 备份范围

后端为唯一持有数据的服务，数据目录由 `LT_SERVER_DATA_DIR` 决定（默认 `data`，容器内 `/app/data`）。

| 对象 | 位置 | 说明 |
| --- | --- | --- |
| 数据目录 | `data/` 全量 | 覆盖下列全部对象 |
| 平台配置 | `data/config.yml` | 含数据库连接与密钥，权限 `0600`；丢失后仅能重跑 setup |
| SQLite 数据库 | `data/data.db` | 仅 `database.provider: sqlite` 时存在 |
| MySQL 数据库 | `host:port/database` | 不在 `data/` 内，须单独导出 |
| 附件 | `data/uploads/` 或 S3 桶 | 由存储驱动的 `uploadDir` 或 S3 配置决定 |
| 模板与素材 | `data/templates/`、`data/locales/`、`favicon.*`、`logo.*` | 含 `.templates_initialized` 标记 |

`data/prisma/` 为每次启动重新生成的迁移副本，无须备份。`config.yml` 与数据库须来自同一时刻，否则以 `security.externalEncryptionKey` 加密的字段将无法解密，会话全部失效。

### 备份时机与命令

升级后端或插件前、修改存储驱动或上传目录前、切换 `database.provider` 或人工修改 schema 前，均须先备份。

```bash
# SQLite：停止写入后整体打包
docker compose down
sudo tar -czf lighttickets-data-$(date +%F).tar.gz -C . data
docker compose up -d

# MySQL：单独导出（库不在 data/ 里）
mysqldump -h <host> -P 3306 -u <user> -p <database> > lighttickets-$(date +%F).sql

# S3 驱动：用习惯的工具整桶同步一份
aws s3 sync s3://<bucket>/<prefix> ./backup-s3/
```

恢复顺序为：停止服务 → 解包覆盖 `data/` → 执行 `sudo chown -R 0:0 ./data` → MySQL 先导入 dump → 启动并确认日志出现 `[migrate] ... migrations applied` → 通过 `/api/health` 验证。热备份亦可，但须保证数据库文件不在写入过程中；SQLite 先执行 `down` 再打包。

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

后端每次启动均执行一次迁移，无须手工执行：后端将 `prisma/migrations` 或 `prisma/migrations-mysql` 复制到 `data/prisma/migrations`，再执行 `npx prisma generate` 与 `npx prisma migrate deploy`，成功后输出 `[migrate] sqlite migrations applied` 或 `[migrate] mysql migrations applied`。迁移需要可用的 `DATABASE_URL`；数据库无法连接时，后端将启动失败并退出。

两套目录各带一份声明 provider 的 `migration_lock.toml`，不得混用；`migrations-mysql` 比 `migrations` 多 `20260711000000_expand_text_storage_columns` 与 `20260919000000_player_group_value_binary_collation` 两个迁移。不得向另一套目录手工补写文件，亦不得手改锁文件。

MySQL 无回退分支，迁移失败即意味着后端无法启动：从日志获取 prisma 原始报错，先排除连接与权限（账号 DDL 权限、库是否存在、`args` 的 SSL 参数是否被接受）；若失败发生在执行到一半的 DDL 上，以升级前的备份恢复数据库后重试，不得通过删表或删迁移记录的方式「修复」。SQLite 的回退路径逐条执行 `migration.sql`，日志中可直接看到失败的具体条目。

### provider 切换

数据不会自动迁移，`sqlite` 与 `mysql` 之间须自行导出导入。setup 完成后 provider 由 `config.yml` 的 `database` 决定，修改后须重启后端；切换前备份 `data/` 与旧库，切换后旧的 `data/data.db` 不会被读取，也不会被删除，新 provider 首次启动将完整执行对应目录的迁移。

## 存储运维

默认值为 `{ driver: 'local', uploadDir: 'data/uploads' }`；S3 默认值为 `region: us-east-1`、`forcePathStyle: true`、`presignExpiry: 300`。

每个附件记录自带 `storageType`，切换驱动仅影响之后的写入，旧附件仍由自身记录的驱动提供，不会被搬迁。可选路径仅有两条：共存切换（仅修改默认驱动，原本地目录或 S3 桶保持可读，历史附件仍可访问）与彻底切换（先清空现有附件再修改配置）。

存在本地附件时修改上传目录，或存在 S3 附件时修改存储位置，后端均将以 409 拒绝（`backend/src/services/storage-config.service.ts`）。更换位置前备份原目录或桶；更换驱动后删除 `data/uploads/`，历史附件将返回 404。

`uploadDir` 须对后端进程可写，容器内后端以 root 运行，恢复进来的文件统一执行 `chown -R 0:0 ./data`。上传大小还受反向代理 `client_max_body_size` 与附件配额限制，配额见 [配置参考](./config.md)。

## 升级流程

顺序固定为：备份 → 拉取新版本 → 后端迁移并重启 → 前端重新构建 → 更新插件 → 验证。后端启动时自动迁移 schema，插件通过 HTTP 与 WebSocket 调用后端，因此后端须先启动；旧插件或缺少 `playerCredential` 的历史绑定将 fail-closed，玩家须在网页解绑后重新绑定。

### Docker Compose

```bash
docker compose down                                   # 停服务后备份
sudo tar -czf lighttickets-data-$(date +%F).tar.gz -C . data
docker compose up --build -d                          # 重建两个镜像
docker compose logs -f server                         # 看迁移日志
curl -s http://127.0.0.1:23320/api/health             # 验证
```

前端为构建期产物，`LT_WEB_API_URL` 变化时须重新构建，`up --build` 将一并处理。手写 systemd 单元与进程细节见 [手动部署](./manual.md)。

### 手动部署（VM）

```bash
cd backend && git pull && npm install && npm run build
sudo systemctl restart lighttickets-server
curl -s http://127.0.0.1:23320/api/health

cd ../frontend && npm install && LT_WEB_API_URL=/api npm run build
sudo systemctl restart lighttickets-web
```

### 插件与模板

使用与后端同版本的 `-all.jar`。Paper / Folia 数据目录为 `plugins/LightTickets/`，Velocity 为 `plugins/lighttickets/`，其中的 `PlayerData.db` 为插件本地缓存，与后端数据库无关。重启服务器后执行 `/lit status`：该命令分别报告 WebSocket 与 HTTP API 状态，两者均显示 online 时才视为接通，字段含义见 [Minecraft 插件部署](./plugin.md)。

`data/templates/` 出现 `.templates_initialized` 后，内置模板（`backend/templates/`）的更新不再自动同步。需要新模板时先比对再复制，不得整目录覆盖，否则站点内的自定义模板将丢失。

### 回滚边界

- 迁移只有向前方向，没有 down migration，回退代码不会回退 schema；
- 可在相邻版本间回退代码，已前进的 schema 变化须从备份恢复（`data/` 或 MySQL dump）；
- 不得回退到早于玩家会话强化的旧版本，此类版本与当前绑定数据不兼容；
- 回滚后插件须退回同版本，以免新插件连接旧后端。

## 反向代理与限流

### trustedProxyIps 配置

```yaml
server:
  trustedProxyIps:
    - 127.0.0.1
    - 10.0.0.2
```

精确 IP 列表，空数组表示不信任任何转发头，`X-Forwarded-For` 将被忽略。部署于反向代理之后须填写代理的真实 IP，否则所有请求将按代理 IP 计入限流并触发 429，管理后台所见的客户端 IP 亦均为代理地址。该键仅可通过 setup 向导或手改 `config.yml` 后重启后端修改；反向代理侧须透传 `X-Forwarded-For`，nginx 示例见 [Docker Compose 部署](./docker.md)。限流默认值（全局 60 秒 100 次、认证类 60 秒 10 次等）见 [配置参考](./config.md)。

### CORS 同步

同源访问（反向代理将 `/`、`/api`、`/socket.io` 均指向前端端口）无须额外配置。浏览器直连后端端口，或前后端分属不同域名与端口时，须将站点公开 origin 写入 `server.corsOrigins`，否则请求将被浏览器拦截，表现为登录失败或数据无法加载；该改动同样须重启后端。

## 日志与排障

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 容器反复重启 | 迁移失败、`config.yml` 非法、数据库不可达 | 执行 `docker compose logs server` 查看首屏报错，并核对 `database` 与密钥格式 |
| `/api/health` 不通 | 后端未启动、端口不一致、探活地址错误 | 在容器内执行 `curl 127.0.0.1:23320/api/health`，并核对 `LT_SERVER_PORT` |
| 插件连不上 | `baseUrl` 非纯 origin、`serverKey` 已吊销或与服务器记录不符、反向代理丢弃 WebSocket | 在游戏内执行 `/lit status` 区分 WS 与 HTTP；核对 [插件配置](./plugin.md) 与 `location /socket.io/` 的升级头 |
| 429 频繁 | 未配置 `trustedProxyIps`，全站按代理 IP 计数 | 填入代理真实 IP 后重启，并确认并非遭受刷量 |
| 附件上传 413 | 反向代理请求体上限过小 | 调大 `client_max_body_size` |
| 附件上传 400 / 409 | 驱动未就绪、`uploadDir` 不可写、S3 凭据或 region 错误；存储位置变更被拒 | 查看 server 日志中的附件错误，并按「存储运维」的顺序处理 |
| MySQL 连接失败 | host/port 不可达、账号无权限、`args` 的 SSL 参数不被接受 | 用相同参数在数据库主机上手工连接一次 |
| 写不进 `config.yml`、启动报 `EACCES` | `data/` 属主或权限错误 | 执行 `sudo chown -R 0:0 ./data`，不得为目录设置只读 |
| 迁移时 `npx prisma` 不可用 | 运行环境缺 npm/npx，或无法访问网络获取 prisma CLI | 换用带 npm 的官方镜像，并确认可出网 |

## 定期任务

后端启动时注册三组定时任务（`backend/src/index.ts`），随进程运行，无须人工干预：

| 任务 | 周期 | 作用 |
| --- | --- | --- |
| 孤儿附件清理 | 15 分钟 | 按附件过期设置清理上传后长期未挂到议题上的文件 |
| 链接码清理 | 5 分钟 | 清理过期的绑定码与注册链接 |
| 审计日志结算 | 1 秒 | 将待结算的审计记录写入数据库 |

任务在启动后立即执行一次，随后按周期运行；上一轮未结束时本轮跳过。失败仅打印一条 `warn`（前缀 `[attachments]`、`[link-code]`、`[audit]`），不中断服务。进程未运行时无清理动作，下次启动将补做一次。完成钩子的投递不属这三组任务：投递失败将留存为死信，须手工重新投递，不自动无限重试。
