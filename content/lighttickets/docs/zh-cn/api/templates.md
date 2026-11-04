---
order: 40
---

# 模板接口

## 认证

整个路由由 `authOrServerKeyMiddleware` 处理，接受以下两种凭据之一：

| 凭据 | 请求头 | 说明 |
| --- | --- | --- |
| 浏览器 / 第三方程序 | `Authorization: Bearer <accessToken>` | 普通用户 token 即为有效凭据，无需 `staff` 或 `admin` 角色 |
| Minecraft 插件 | `X-Server-Key: <serverKey>` | 插件以服务器 Key 读取模板，用于渲染游戏内表单 |

两种凭据均缺失或均无效时返回 `401`。模板仅在启用状态下可见：`enabled: false` 的模板不出现在列表中，按名读取返回 `404`，与不存在的模板无法区分。

## 端点

### GET /api/templates

返回已启用模板的摘要数组，按缓存顺序排列（启动时按文件名排序加载），不分页。

```http
GET /api/templates
Authorization: Bearer <accessToken>
```

```jsonc
// 200 OK
// array：已启用模板的摘要数组
[
  {
    "name": "bug_report", // string：模板 key，取自文件名去除 .yml / .yaml 后的结果，亦为提交议题时的 template 值
    "name_i18n": "Bug 反馈", // string：YAML 中的 name，用于界面展示
    "description": "报告服务器或插件问题", // string：模板描述
    "labels": ["bug"], // string[]：提交后自动附加的标签名；无标签时为空数组
    "hidden": "optional" // true | false | optional：可见性策略，取值为强制隐藏、强制公开或由用户选择
  },
  {
    "name": "player_report", // string：模板 key，取自文件名去除 .yml / .yaml 后的结果
    "name_i18n": "玩家举报", // string：YAML 中的 name，用于界面展示
    "description": "举报违规玩家", // string：模板描述
    "labels": [], // string[]：无标签时为空数组
    "hidden": true // true | false | optional：可见性策略
  }
]
```

`hidden` 为 `optional` 时，`POST /api/tickets` 须显式传入 `hidden`；另外两种取值由后端强制，客户端无需传入。

- `401`：未携带有效 token 或服务器 Key。

### GET /api/templates/:name

返回单个模板的字段定义，供客户端渲染表单。

```http
GET /api/templates/:name
Authorization: Bearer <accessToken>
```

```jsonc
// 200 OK
{ // object：单个模板的字段定义
  "name": "Bug 反馈", // string：YAML 中的 name，即展示名（非路径中的模板 key）
  "description": "报告服务器或插件问题", // string：模板描述
  "title_prefix": "[Bug]", // string | 缺失：标题前缀；配置为空时不出现该字段
  "labels": ["bug"], // string[]：自动附加的标签名
  "hidden": "optional", // true | false | optional：可见性策略
  "body": [ // array：字段定义数组
    {
      "type": "markdown", // string：字段类型，无 id，仅静态说明
      "attributes": {
        "value": "请尽量描述复现步骤。"
      }
    },
    {
      "type": "dropdown", // string：字段类型
      "id": "scope", // string：提交时作为 formData 的 key
      "validations": {
        "required": true
      },
      "attributes": {
        "label": "影响范围",
        "options": ["游戏内|ingame", "网页|web"]
      }
    },
    {
      "type": "textarea", // string：字段类型
      "id": "detail", // string：提交时作为 formData 的 key
      "validations": {
        "required": true
      },
      "attributes": {
        "label": "详细描述",
        "placeholder": "越具体越好"
      }
    }
  ]
}
```

`body` 各项的字段定义见 [字段类型](../template/fields.md)。

响应不含 `completion_hooks` 与 `enabled`：`completion_hooks` 为后端投递指令所用的配置，不向普通调用方暴露；`enabled` 由「可读取即代表已启用」隐含。

- `401`：未携带有效 token 或服务器 Key。
- `404`：模板不存在，或模板存在但 `enabled: false`；错误消息为「模板不存在」。

## 提交时的取值方式

客户端取得 `body` 后按键值渲染表单，提交时将 `id` 作为 key、字符串作为 value 写入 `formData`。后端将再次校验，未知字段、缺失必填项与非法选项均会被拒绝：

| 字段类型 | 提交值 |
| --- | --- |
| `input` / `textarea` | 原始文本 |
| `checkboxes` | 选中项以逗号分隔的字符串 |
| `dropdown` | 选项的「实际值」；提交完整的 `显示文本\|实际值` 亦会被归一化 |
| `select_input` | 文本或选项值 |
| `player_select` | 玩家名以逗号分隔，由后端校验其是否属于配置的玩家组 |

`markdown` 类型不含 `id`，仅为静态说明，不参与提交。议题提交端点见 [议题、评论与附件](./tickets.md)。

## 与后台模板接口的区别

本页为只读的公开接口，面向填表客户端；写入与维护经 `/api/admin/templates` 完成，须 `admin` 角色，可读取被禁用的模板，并额外返回 `enabled`、`completion_hooks`、`assignee_ids`、原始 YAML 等字段。两者的字段命名亦不同（后台使用 `nameI18n`、`titlePrefix` 等驼峰形式）。

| 项 | `/api/templates` | `/api/admin/templates` |
| --- | --- | --- |
| 认证 | JWT 或 `X-Server-Key` | JWT + `admin` |
| 方法 | `GET` | `GET` / `POST` / `PATCH` / `DELETE` |
| 禁用模板 | 不可见，返回 `404` | 可见 |
| 返回字段 | 渲染表单所需字段 | 完整定义与原始 YAML |

后台接口的方法与请求体见 [管理后台 API](./admin.md)。
