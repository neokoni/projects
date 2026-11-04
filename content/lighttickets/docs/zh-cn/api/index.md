---
order: 50
---

# 外部 API

## 基址与内容类型

| 项 | 值 |
| --- | --- |
| 基址 | `/api`，例如 `https://tickets.example.com/api/tickets` |
| 内容类型 | `application/json`，文件上传为 `multipart/form-data` |
| Web 认证 | `Authorization: Bearer <accessToken>` |
| Refresh Token | 后端通过 `HttpOnly` Cookie `lt_refresh_token` 下发 |

API 响应体中的 `refreshToken` 为灰度兼容字段，浏览器端不得将其写入 `localStorage`。正常刷新流程完全依赖 Cookie。

## 响应 envelope 结构

成功响应的结果置于 `data` 字段内：

```jsonc
{
  "success": true, // 成功响应的固定取值
  "data": {
    "tickets": [], // 业务结果，字段随端点而异
    "total": 0,
    "page": 1,
    "pageSize": 20
  }
}
```

失败响应包含错误码与错误消息：

```jsonc
{
  "success": false,            // 失败响应的固定取值
  "statusCode": 400,           // 与 HTTP 状态码一致
  "message": "参数校验失败"     // 面向开发者的错误消息
}
```

各端点页面中的响应示例只展示 envelope 内 `data` 的内容；实际响应在外层再包一层 `{ "success": true, "data": … }`，返回数组的端点则为其包装的数组。

以下三类响应不套用 envelope：

- `204 No Content` 的响应体为空，如 `DELETE /api/tickets/:ticketId/comments/:commentId` 与 `POST /api/auth/logout`。
- `GET /api/health` 不套用 envelope，响应体为：

    ```jsonc
    {
      "status": "ok" // 服务可用时的固定取值
    }
    ```

- `GET /api/docs/openapi.json` 直接返回规范 JSON，不套用 envelope，详见 [OpenAPI 规范](./openapi.md)。

## 认证档位

接口按认证强度分为五档。

| 档位 | 请求头 | 行为 | 代表端点 |
| --- | --- | --- | --- |
| public | 无 | 任何人可调用 | `GET /api/health`、`GET /api/setup/site-config`、`GET /api/i18n/languages`、`GET /api/branding/:slot` |
| bearer | `Authorization: Bearer <accessToken>` 必填 | 缺失或失效返回 `401` | `POST /api/tickets`、`PATCH /api/users/me/username`、`GET /api/tickets/:id/attachments` |
| 可选 bearer（条件鉴权） | 可选 | 未登录按匿名访客处理；站点开启「要求登录」后须有有效 token | `GET /api/tickets`、`GET /api/tickets/:id`、`GET /api/labels`、附件读取 |
| staff | bearer + 角色 `staff` 或 `admin` | 角色不足返回 `403` | `PUT /api/tickets/:id/assignees`、`POST /api/tickets/:id/labels`、完成钩子端点 |
| admin | bearer + 角色 `admin` | 角色不足返回 `403` | `/api/admin/*`、`PATCH /api/setup/settings`、`POST /api/labels`、`PUT /api/branding/:slot` |

`/api/templates` 在认证方式上为例外：该端点接受浏览器 JWT，也接受 `X-Server-Key` 服务器 Key；两者均缺失时返回 `401`。

后端判定 `Bearer` token 是否失效时，除签名外还比对数据库中的用户状态：用户被删除或 `tokenEpoch` 已变更（如修改密码）时，旧 token 立即返回 `401`。

## 「要求登录」设置对读接口的影响

站点设置中的 `requireLogin` 由 `conditionalAuthMiddleware` 读取，作用于全部「可选 bearer」读接口：

| `requireLogin` | 未携带 token | 携带有效 token |
| --- | --- | --- |
| `false`（默认） | 按匿名访客返回公开数据 | 按该用户可见范围返回 |
| `true` | `401` 未登录 | 按该用户可见范围返回 |

匿名访客仅可读取公开议题；普通用户在此基础上还可读取本人创建的隐藏议题；`staff` 与 `admin` 可读取全部议题。隐藏议题对无权用户统一返回 `404`，以防止通过关联资源判断其是否存在。

## 错误码与触发条件

| HTTP | 语义 | 典型触发 |
| --- | --- | --- |
| `400` | 参数校验失败 | 字段类型错误、缺失必填、选项不合法、状态迁移参数无效 |
| `401` | 未登录或登录已过期 | 缺少 token、token 过期、刷新令牌无效 |
| `403` | 权限不足 | 非 `staff` 提交 `assigneeId`、普通用户指定 `serverId`、功能开关关闭 |
| `404` | 资源不存在 | 议题、评论、附件、模板不存在，或对当前用户不可见 |
| `409` | 资源冲突 | 邮箱/Minecraft 账号已绑定、并发状态迁移失去迁移权、已完成钩子重复提交 |
| `429` | 触发限流 | 全局或认证限流窗口内超限 |
| `502` | 上游失败 | SMTP 连接验证失败、S3 连接测试失败 |

错误响应体始终为标准错误 envelope；错误不以 `200` 状态码返回 `success: false`。

## 分页参数与列表结构

分页参数为 `page` 与 `pageSize`：

| 参数 | 类型 | 默认值 | 范围 |
| --- | --- | --- | --- |
| `page` | integer | `1` | 正整数 |
| `pageSize` | integer | `20` | 1-100 |

分页型端点返回 `{ items, total, page, pageSize }` 形式的对象，其中 `items` 的实际名称为资源名：

| 端点 | `data` 结构 |
| --- | --- |
| `GET /api/tickets` | `{ tickets, total, page, pageSize }` |
| `GET /api/users` | `{ users, total, page, pageSize }` |

不分页的集合型端点返回数组：`GET /api/tickets/:id/comments`、`GET /api/labels`、`GET /api/tickets/:ticketId/audit`、`GET /api/templates`、`GET /api/users/assignable`。

## 限流策略

限流策略保存在数据库 `AppConfig` 中，修改后立即生效，并可在管理后台调整。

| 策略 | 默认值 | 统计维度 |
| --- | --- | --- |
| 全局 | 每 60 秒 100 次 | 按 IP 统计所有 API 请求 |
| 认证 | 每 60 秒 10 次 | 按 IP 统计所有挂载认证限流器的接口，共享额度 |
| 邮件冷却 | 60 秒 | 注册验证码按规范化邮箱、密码重置按用户账号 |
| Minecraft 绑定 | 5 次失败 / 15 分钟锁定 | 按登录用户 |

窗口内前 `maxRequests` 次请求放行，超出的请求返回 `429`，窗口结束后重新计数。窗口秒数上限为 86400，额度上限为 100000。认证限流器挂载于登录、注册、刷新、登出、密码重置、`link-minecraft`、验证码及邮件相关端点。

## 路由前缀

| 前缀 | 说明 | 详见 |
| --- | --- | --- |
| `/api/health` | 健康检查，不包 envelope | 本页 |
| `/api/docs/openapi.json` | 构建生成的 OpenAPI 规范 | [OpenAPI 规范](./openapi.md) |
| `/api/setup` | `site-config` 公开配置、初始化、管理员站点设置 | [认证与账户](./auth.md)、[管理后台 API](./admin.md) |
| `/api/auth` | 注册、登录、刷新、登出、密码重置、Minecraft 绑定 | [认证与账户](./auth.md) |
| `/api/auth/federatedauth` | 外部登录流程（start / callback / 注册会话） | [认证与账户](./auth.md) |
| `/api/i18n` | 语言清单与扁平化语言资源 | [认证与账户](./auth.md) |
| `/api/templates` | 启用模板列表与单个模板定义 | [模板接口](./templates.md) |
| `/api/player-groups` | 登录用户侧的玩家组搜索 | [管理后台 API](./admin.md) |
| `/api/admin/templates` | 后台模板 CRUD 与原始 YAML 维护 | [管理后台 API](./admin.md) |
| `/api/admin/player-groups` | 玩家组与成员维护 | [管理后台 API](./admin.md) |
| `/api/admin/storage` | 存储配置读取、更新与连通性测试 | [管理后台 API](./admin.md) |
| `/api/admin/federatedauth` | 外部登录 Provider 管理与身份解绑 | [管理后台 API](./admin.md) |
| `/api/admin/minecraft-hook-deliveries` | 失败钩子投递查询与重试 | [管理后台 API](./admin.md) |
| `/api/branding` | 站点图标与 Logo 的读取、上传、删除 | [管理后台 API](./admin.md) |
| `/api/tickets` | 议题 CRUD、审计、评论与附件子路由 | [议题、评论与附件](./tickets.md) |
| `/api/labels` | 标签增删改查，写操作需要 `admin` | [议题、评论与附件](./tickets.md) |
| `/api/attachments` | 附件上传、下载、删除 | [议题、评论与附件](./tickets.md) |
| `/api/servers` | Minecraft 服务器与 API Key 管理，仅 `admin` | [管理后台 API](./admin.md) |
| `/api/users` | 当前用户资料、通知偏好、外部身份绑定；管理员用户管理 | [认证与账户](./auth.md)、[管理后台 API](./admin.md) |
| `/api/mc` | 插件专用接口，`X-Server-Key` 认证 | [Server API](../server-api/index.md) |

## OpenAPI 规范端点

运行时端点：

```http
GET /api/docs/openapi.json
```

规范未生成时，该端点返回 `404` 标准错误响应。产物、生成命令与校验方式见 [OpenAPI 规范](./openapi.md)。
