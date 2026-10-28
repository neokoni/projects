---
order: 50
---

# 配置参考

## 两层配置

| 层级 | 位置 | 内容 | 修改方式 |
| --- | --- | --- | --- |
| 平台基础 | `data/config.yml` | 监听端口、CORS 来源、可信代理、数据库连接、JWT 与加密密钥 | setup 向导写入，或手改后重启后端 |
| 应用配置 | 数据库 | 站点设置、注册策略、限流、SMTP、存储、外部登录 Provider、Turnstile、附件配额 | 管理后台即时生效 |

判断标准很简单：需要**在数据库连上之前**就知道的东西放在 `config.yml`，其余都在数据库里。

## config.default.yml

后端自带 `backend/src/config.default.yml` 作为参考模板（构建时随 `dist/` 发布）：

```yaml
server:
  port: 23320
  corsOrigins:
    - http://localhost:23310
  # 可信反向代理的精确 IP；setup 时自动记录，空数组表示不信任代理转发头。
  # trustedProxyIps: []

database:
  # provider 缺失时进入 setup 模式；setup 完成后回写 sqlite 或 mysql。
  # provider: sqlite
  # sqlite 无需其他字段，数据库文件固定为 data/data.db。
  # mysql:
  # host: db.example.com      # 必填
  # port: 3306                # 可选，默认 3306
  # username: root            # 必填
  # password: xxx             # 可选，允许空密码
  # database: lighttickets    # 必填
  # args: sslaccept=strict    # 可选，MySQL URL query 参数

security:
  # 空值仅用于 setup 模式；setup 完成后自动生成并回写。
  jwtSecret: ""
  jwtRefreshSecret: ""
  # 邮件退订 JWT 使用的独立密钥；旧版升级时会自动生成。
  jwtUnsubscribeSecret: ""
  # 旧 JWT 格式的升级截止 Unix 时间戳；setup 新安装固定为 0。
  legacyJwtCutoff: 0
  # 外部登录 Provider 密钥的主加密密钥；setup 或首次升级启动时自动生成。
  externalEncryptionKey: ""
```

## 逐键说明

### server

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `server.port` | number | `23320` | API 监听端口；`LT_SERVER_PORT` 会覆盖它 |
| `server.corsOrigins` | string[] | `["http://localhost:23310"]` | 允许的浏览器来源，精确匹配 origin |
| `server.trustedProxyIps` | string[] | 空（不信任） | 可信反向代理的精确 IP，决定是否采信 `X-Forwarded-For` |

`corsOrigins` 和 `trustedProxyIps` 没有后台修改接口，只能通过 setup 向导或手改 `config.yml` 后重启后端生效。

### database

`database` 是**扁平**结构，不是嵌套的 `mysql:` 块。上面模板里被注释掉的嵌套写法只是示意，实际键名如下：

```yaml
database:
  provider: mysql
  host: db.example.com
  port: 3306
  username: lighttickets
  password: <password>
  database: lighttickets
  args: sslaccept=strict
```

| 键 | 类型 | 必要 | 说明 |
| --- | --- | --- | --- |
| `database.provider` | string | 是 | `sqlite` 或 `mysql`；缺失时进入 setup 模式 |
| `database.host` | string | MySQL 必填 | 主机名或 IP |
| `database.port` | number | 可选 | 默认 `3306` |
| `database.username` | string | MySQL 必填 | 用户名 |
| `database.password` | string | 可选 | 允许为空 |
| `database.database` | string | MySQL 必填 | 数据库名 |
| `database.args` | string | 可选 | 追加到 MySQL 连接串 query 部分，例如 `sslaccept=strict` |

SQLite 只需要 `provider: sqlite`，数据库文件固定为 `data/data.db`，没有可配置的路径键。切换 provider 相当于换一套数据，建议先备份 `data/`。

### security

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `security.jwtSecret` | string | `""` | 访问令牌签名密钥，必须是 64 位十六进制（32 字节） |
| `security.jwtRefreshSecret` | string | `""` | 刷新令牌签名密钥，同样是 64 位十六进制 |
| `security.jwtUnsubscribeSecret` | string | `""` | 邮件退订 JWT 的独立密钥；为空时自动生成并回写 |
| `security.legacyJwtCutoff` | number | `0` | 旧 JWT 格式兼容截止的 Unix 秒时间戳；新安装固定为 `0`（不启用兼容） |
| `security.externalEncryptionKey` | string | `""` | 加密外部登录 Provider 密钥的主密钥；为空时自动生成并回写 |

- 所有密钥字段格式为 64 位 hex，写错会在启动时报错；
- `jwtUnsubscribeSecret`、`externalEncryptionKey` 缺失会被自动生成并写回文件；
- 更换 `jwtSecret` / `jwtRefreshSecret` 会让所有已登录会话失效（相当于强制全员重新登录）。

## 文件本身的性质

- `config.yml` 权限为 `0600`，只有运行后端的用户可读；
- 后端启动时读取一次并缓存，任何改动都需要重启进程；
- 任何 API 都不会返回它，包括备份与导出接口；
- setup 阶段的中间文件是 `config.yml.setup`，同样是 `0600`，成功后重命名为 `config.yml`。

::: warning
不要把 `config.yml` 提交进版本库，也不要在支持工单、截图或日志里粘贴它的内容。示例中一律使用 `<password>`、`<apiKey>` 之类的占位。
:::

## 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LT_SERVER_PORT` | `23320` | 后端监听端口 |
| `LT_SERVER_DATA_DIR` | `data` | 数据根目录（相对当前工作目录解析） |
| `LT_WEB_HOST` | `0.0.0.0` | 前端监听地址 |
| `LT_WEB_PORT` | `23310` | 前端监听端口 |
| `LT_WEB_API_URL` | `/api` | 前端构建期 API 前缀 |
| `LT_SERVER_URL` | `http://127.0.0.1:23320` | 前端运行期代理目标，必须是纯 origin |
| `LT_GIT_COMMIT` | 无 | 构建期写入版本号 |

## 只能在后台改的配置

限流、SMTP、存储、外部登录 Provider、Turnstile、注册策略、站点设置、附件配额都保存在数据库里，通过管理后台修改，立即生效（部分需要重新加载页面）。原因：

- 限流默认值在 `backend/src/constants/rate-limit.ts` 中单处定义，前端读取同一份配置渲染表单，避免"文档一套、代码一套"；
- 这些配置与站点数据强关联（例如外部登录 Provider 的密钥需要用 `security.externalEncryptionKey` 加密存库），写在 `config.yml` 里会绕过 setup 的加密与校验流程；
- 它们需要随数据库备份一起迁移，放进 `config.yml` 反而容易漏备份。

限流默认值：

| 范围 | 默认 |
| --- | --- |
| 全局 | 60 秒内 100 次 |
| 认证类接口 | 60 秒内 10 次 |
| 邮件发送 | 冷却 60 秒 |
| Minecraft 链接 | 最多 5 次，失败后锁定 15 分钟 |

存储配置默认 `{ driver: 'local', uploadDir: 'data/uploads' }`；S3 默认 `region: us-east-1`、`forcePathStyle: true`、`presignExpiry: 300`。

## 不可配置的硬编码值

以下值写死在代码里，`config.yml` 与后台都无法修改：

| 项 | 值 |
| --- | --- |
| 访问令牌有效期 | 2 小时 |
| 刷新令牌有效期 | 7 天 |
| 绑定码有效期 | 5 分钟 |
| 密码最短长度 | 8 位 |

## 附件默认与上下限

| 项 | 默认 | 范围 |
| --- | --- | --- |
| `pendingQuotaMiB` | `50` | 上限 `102400` MiB |
| `pendingExpirationEnabled` | `true` | 布尔 |
| `pendingTtlDays` | `7` | 上限 `365` 天 |

"pending" 指已上传但尚未挂到议题上的附件；开启过期后超期未使用的附件会被清理。相关排障与存储迁移见 [运维与升级](./operations.md)。
