---
order: 40
---

# 模板接口

议题模板以 YAML 文件存放在 `data/templates/`，后端启动时加载进内存缓存。本页的两个端点供提交表单的客户端读取模板清单与字段定义，响应遵循 [外部 API](./index.md) 的 envelope 约定。模板文件本身怎么写见 [模板配置](../template/index.md)，字段类型细节见 [字段类型](../template/fields.md)。

## 认证

整个路由挂 `authOrServerKeyMiddleware`，两种凭据二选一：

| 凭据 | 请求头 | 说明 |
| --- | --- | --- |
| 浏览器 / 第三方程序 | `Authorization: Bearer <accessToken>` | 普通用户 token 即可，不需要 `staff` 或 `admin` |
| Minecraft 插件 | `X-Server-Key: <serverKey>` | 插件用服务器 Key 读取模板以渲染游戏内表单 |

两者都没有、或都无效时返回 `401`。模板**只有启用状态可见**：`enabled: false` 的模板既不出现在列表里，按名读取也返回 `404`，与不存在无法区分。

## 端点

### GET /api/templates

返回已启用模板的摘要数组，按缓存顺序（启动时按文件名排序加载）排列，不分页。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 模板 key，取自文件名去掉 `.yml` / `.yaml`，也是提交议题时的 `template` 值 |
| `name_i18n` | string | YAML 里的 `name`，用于界面展示 |
| `description` | string | 模板描述 |
| `labels` | string[] | 提交后自动附加的标签名，无标签为空数组 |
| `hidden` | `true` \| `false` \| `optional` | 可见性策略：强制隐藏、强制公开、由用户选择 |

```json
{
  "success": true,
  "data": [
    {
      "name": "bug_report",
      "name_i18n": "Bug 反馈",
      "description": "报告服务器或插件问题",
      "labels": ["bug"],
      "hidden": "optional"
    },
    {
      "name": "player_report",
      "name_i18n": "玩家举报",
      "description": "举报违规玩家",
      "labels": [],
      "hidden": true
    }
  ]
}
```

`hidden` 为 `optional` 时，`POST /api/tickets` 必须显式传 `hidden`；另外两种取值由后端强制，客户端不需要传。

- `401`：未携带有效 token 或服务器 Key。

### GET /api/templates/:name

返回单个模板的字段定义，供客户端渲染表单。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | YAML 里的 `name`，即展示名（**不是**路径中的模板 key） |
| `description` | string | 模板描述 |
| `title_prefix` | string \| 缺失 | 标题前缀，配置为空时不出现该字段 |
| `labels` | string[] | 自动附加的标签名 |
| `hidden` | `true` \| `false` \| `optional` | 可见性策略 |
| `body` | array | 字段定义数组，结构见 [字段类型](../template/fields.md) |

```json
{
  "success": true,
  "data": {
    "name": "Bug 反馈",
    "description": "报告服务器或插件问题",
    "title_prefix": "[Bug]",
    "labels": ["bug"],
    "hidden": "optional",
    "body": [
      {
        "type": "markdown",
        "attributes": { "value": "请尽量描述复现步骤。" }
      },
      {
        "type": "dropdown",
        "id": "scope",
        "validations": { "required": true },
        "attributes": {
          "label": "影响范围",
          "options": ["游戏内|ingame", "网页|web"]
        }
      },
      {
        "type": "textarea",
        "id": "detail",
        "validations": { "required": true },
        "attributes": { "label": "详细描述", "placeholder": "越具体越好" }
      }
    ]
  }
}
```

响应**不含** `completion_hooks` 与 `enabled`：完成钩子是服务端投递指令用的配置，不暴露给普通调用方；`enabled` 由「能读到就代表已启用」隐含。

- `401`：未携带有效 token 或服务器 Key。
- `404`：模板不存在，或模板存在但 `enabled: false`，错误消息为「模板不存在」。

## 提交时如何使用

客户端拿到 `body` 后按键值渲染表单，提交时把 `id` 作为 key、字符串作为 value 放进 `formData`。后端会再次校验，未知字段、缺失必填、非法选项都会被拒绝：

| 字段类型 | 提交值 |
| --- | --- |
| `input` / `textarea` | 原始文本 |
| `checkboxes` | 选中项以逗号分隔的字符串 |
| `dropdown` | 选项的「实际值」；提交整条 `显示文本\|实际值` 也会被归一化 |
| `select_input` | 文本或选项值 |
| `player_select` | 玩家名以逗号分隔，后端校验其是否属于配置的玩家组 |

`markdown` 类型没有 `id`，只是静态说明，不参与提交。议题提交端点见 [议题、评论与附件](./tickets.md)。

## 与后台模板接口的区别

本页是**只读**的公开接口，面向填表客户端；写入与维护走 `/api/admin/templates`，需要 `admin` 角色，能读到被禁用的模板，并额外返回 `enabled`、`completion_hooks`、`assignee_ids`、原始 YAML 等字段。两者字段命名也不同（后台用 `nameI18n`、`titlePrefix` 等驼峰形式）。

| 项 | `/api/templates` | `/api/admin/templates` |
| --- | --- | --- |
| 认证 | JWT 或 `X-Server-Key` | JWT + `admin` |
| 方法 | `GET` | `GET` / `POST` / `PATCH` / `DELETE` |
| 禁用模板 | 不可见，返回 `404` | 可见 |
| 返回字段 | 渲染表单所需字段 | 完整定义与原始 YAML |

后台接口的方法与请求体见 [管理后台 API](./admin.md)。
