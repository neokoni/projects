---
order: 60
---

# OpenAPI 规范

## 产物与运行时端点

| 项 | 值 |
| --- | --- |
| 产物路径 | `backend/openapi.json`（随仓库跟踪，可供查阅） |
| 运行时端点 | `GET /api/docs/openapi.json` |
| 文档标题 | `LightTickets API` |
| `info.version` | `1.0.0` |
| 方言 | OpenAPI `3.0.3` |
| `servers` | `http://localhost:23320`（Development server） |

运行时端点返回规范 JSON，不包含 `success` / `data` envelope；该端点与 `GET /api/health` 同属不带 envelope 的例外。服务启动时从工作目录读取 `openapi.json`，文件不存在则返回 `404`：

```jsonc
// 404
{
  "success": false,
  "statusCode": 404,
  "message": "OpenAPI spec not generated" // 工作目录中缺少 openapi.json 时的错误消息
}
```

部署时若仅拷贝 `dist/` 而遗漏 `openapi.json`，该端点将持续返回 `404`，其他接口不受影响。

## 生成命令

```bash
cd backend
pnpm gen:openapi   # 等价于 tsx src/openapi.ts
```

脚本先构建完整文档对象，再执行校验，全部通过后写入 `backend/openapi.json`，并打印路径数量。任一校验失败将抛出异常、以非零状态退出，且不覆盖已有产物。

`gen:openapi` 为手动命令，不包含在 `build` 中；`build` 仅执行 `tsc` 与运行时资源拷贝。改动路由或 schema 后，须重新执行该命令，并将更新后的 `openapi.json` 一并提交。

## 生成时的校验

`backend/src/openapi.ts` 在写入文件前校验四项，任一失败即中断：

| 检查项 | 规则 |
| --- | --- |
| 方言 | `openapi` 须为 `3.0.3` |
| 版本 | `info.version` 须保持为 `1.0.0`（WIP 期不递增） |
| 路由对齐 | 反射 Express 实际挂载的路由，与文档中的 `path + method` 双向比对；运行时多于文档（`Missing`）或文档多于运行时（`Stale`）均导致失败 |
| 响应契约 | 每个操作须声明 `default` 错误响应；除 `GET /api/health`、`GET /api/docs/openapi.json`、`GET /api/attachments/{id}` 外的所有 `2xx` JSON 响应须为 `{ success, data }` 结构，且两者均列入 `required` |

新增路由而未在文档中声明时，生成阶段将报告缺失路径。CI 侧由 `backend/tests/openapi.test.ts` 对产物执行契约断言（方言与版本、若干端点的 `security` 组合、`204` 响应、不出现 `refreshToken` 等）。

## 安全方案

| 名称 | 类型 | 位置 | 用途 |
| --- | --- | --- | --- |
| `bearerAuth` | http / bearer / JWT | `Authorization` | Web 端访问令牌 |
| `apiKey` | apiKey | `X-Server-Key` | Minecraft 插件服务器 Key |
| `minecraftPlayerSession` | apiKey | `X-Player-Session` | 插件侧玩家会话 |
| `refreshCookie` | apiKey | Cookie `lt_refresh_token` | 刷新令牌 |

每个操作的 `security` 字段反映实际鉴权强度：公开接口为空数组，`/api/templates` 为 `[{ bearerAuth }, { apiKey }]`（二选一），条件鉴权读接口同时列出 `bearerAuth` 与 `{}`（表示可不携带凭据）。该字段与 [外部 API](./index.md) 的认证矩阵一致。

## 取用示例

```bash
# 取整份规范
curl -s https://tickets.example.com/api/docs/openapi.json -o openapi.json

# 统计路径与操作数量
jq '.paths | length' openapi.json
jq '[.paths[] | to_entries[] | select(.key | IN("get","post","put","patch","delete"))] | length' openapi.json

# 只看模板相关路径
jq -r '.paths | keys[] | select(startswith("/api/templates"))' openapi.json
```

本地开发默认监听 `23320`。规范中的 `servers` 亦为该地址，对接第三方工具时将该地址改写为实际域名。

## 前端类型生成

管理后台与用户端的请求/响应类型由同一份产物生成，无需手写重复类型：

```bash
cd frontend
pnpm gen:api
```

该命令实际执行 `openapi-typescript@7.13.0 ../backend/openapi.json -o src/types/generated-api.ts`，产物为纯类型文件（无运行时代码）。流程为单向：

1. 修改 `backend/src/routes/` 或 `backend/src/schemas/`。
2. 执行 `pnpm gen:openapi`，重新生成 `backend/openapi.json` 并通过校验。
3. 执行 `pnpm gen:api`，重新生成前端类型。
4. 将前后端改动一并提交。

缺少第 2 步时，前端类型将滞后于后端实现；缺少第 3 步时，`generated-api.ts` 与产物不一致。

## 覆盖范围

规范覆盖 `/api` 下的全部路由，包括本组的 [认证与账户](./auth.md)、[议题、评论与附件](./tickets.md)、[模板接口](./templates.md)、[管理后台 API](./admin.md)，以及 [Server API](../server-api/index.md) 的插件接口。规范描述结构与状态码；字段语义、默认值、业务规则（例如模板 `hidden` 三种取值、Server Key 绑定约束）需参阅对应页面与源码。

::: warning 不覆盖的内容
WebSocket 推送不经由 HTTP 路由，未包含在 OpenAPI 中，参见 [WebSocket 连接](../websocket/index.md)。文件下载类响应（如附件与品牌图片）仅描述状态码与内容类型，不描述二进制内容。
:::
