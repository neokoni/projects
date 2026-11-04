---
order: 20
---

# 字段类型

## 总览

| 类型 | 用途 | 是否提交值 |
| --- | --- | --- |
| `markdown` | 静态说明文本，直接渲染为 Markdown | 否 |
| `input` | 单行文本 | 是 |
| `textarea` | 多行文本，支持拖拽/粘贴上传图片 | 是 |
| `checkboxes` | 多选复选框，提交值以逗号分隔 | 是 |
| `dropdown` | 下拉单选 | 是 |
| `select_input` | 选择预设项或自行输入 | 是 |
| `player_select` | 从玩家组中搜索并多选玩家 | 是 |

## markdown

```yaml
- type: markdown
  attributes:
    value: |
      感谢你反馈问题！请尽量提供**稳定复现的步骤**。
```

`markdown` 字段仅使用 `attributes.value`，该字段不参与录入，也不进入 `formData`；渲染时原样输出。

## input

```yaml
- type: input
  id: version
  validations:
    required: true
  attributes:
    label: "游戏版本"
    placeholder: "如 1.21.1"
```

可用键为 `label`、`description`、`placeholder`；`validations.required` 控制是否必填。正文渲染为 `**标签:** 值`。

## textarea

```yaml
- type: textarea
  id: description
  validations:
    required: true
  attributes:
    label: "问题描述"
    placeholder: "清晰描述你遇到的问题..."
```

可用键与 `input` 相同。正文渲染为 `**标签:**`，其后空一行再输出值，以保留多段内容。

## checkboxes

```yaml
- type: checkboxes
  id: checklist
  attributes:
    label: "提交前确认"
    options:
      - "我确认此问题尚未被反馈"
      - "我已阅读常见问题"
```

提交值为选中项文本以英文逗号连接的结果；后端将去重、校验每项均属于 `options`，并按 `validations.required` 检查非空。选项也可写为对象形式，以 `required: true` 标记必勾选项：

```yaml
options:
  - label: "我确认此问题尚未被反馈"
    required: true
```

::: warning
`docs/template.md` 将带 `required` 的选项描述为「仅影响前端显示」，但提交时 `validateAndNormalizeFormData` 会强制校验，漏选将抛出 `<标签> 缺少必选项`。编写时按实际约束处理。
:::

## dropdown

```yaml
- type: dropdown
  id: severity
  validations:
    required: true
  attributes:
    label: "严重程度"
    options:
      - "低 - 仅影响外观"
      - "中 - 功能受损但有替代方案"
      - "高 - 严重影响游戏体验"
      - "紧急 - 服务器崩溃/数据丢失"
```

`options` 必填且非空。选项文本支持可选的 `|` 分隔符：左侧为界面显示文本，右侧为提交值以及 `{field.<id>}` 取到的值。例如 `"Bot权|bukkit.command.bot"` 显示为 `Bot权`，提交值为 `bukkit.command.bot`；无分隔符时两者均为原文。仅第一个 `|` 生效，两侧不会自动去除空格。

额外约束（`dropdownOptionsUnambiguous`）：显示文本与提交值均不得为空且各自唯一，原始选项文本唯一，一个选项的提交值不得等于另一选项的原始文本。保存时违反将产生错误，加载已有文件时仅告警 `dropdown options are ambiguous`。提交时 `normalizeDropdownValue` 先按提交值精确匹配，再按原始文本匹配并映射为提交值；均匹配不到时将产生「包含无效选项」错误。

## select_input

```yaml
- type: select_input
  id: platform
  attributes:
    label: "服务端类型"
    placeholder: "选择预设或输入其他类型"
    options:
      - "Paper"
      - "Fabric"
```

`options` 可省略。预设选项与自定义输入均按原文提交，不解析 `|`，也不受 `dropdown` 的唯一性约束。

## player_select

```yaml
- type: player_select
  id: players
  validations:
    required: true
  attributes:
    label: 选择玩家
    placeholder: 输入玩家名搜索
    groups: [online_players, trusted_players]
    input_any: false
```

- `groups` 为至少一个玩家组 ID，格式为 1–64 位字母、数字、下划线或短横线且不重复；保存时校验该组确实存在。
- `input_any` 须为布尔值；为 `true` 时允许提交组外的有效 Minecraft 玩家名。
- 控件不预加载组内玩家，仅在搜索词非空时查询；同名玩家仅返回一次；该字段支持多选，提交值以英文逗号分隔。玩家组的维护见 [../guide/admin.md](../guide/admin.md)。

## options 的两种写法

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| 字符串 | `- "Fabric"` | `label` 与提交值均为该文本，在 `dropdown` 中可用 `\|` 拆分 |
| 对象 | `label` 加 `required: true` | 使该项成为必勾选项，对非多选类型无效 |

对象形式的 `label` 必填且不得为空。`input`、`textarea`、`select_input` 不解析 `|`；`checkboxes` 的提交值始终为选项原始文本。

## 字段 id 与 formData

- 保存模板时校验：非 `markdown` 字段须有 `id`；`selection` 内字段的 `id` 还须匹配 `^[a-zA-Z0-9_-]+$`，且在同一 `selection` 内唯一。
- 提交时字段值置于 `formData` 中，键为 `id`。出现模板中不存在的 `id` 时将产生「提交内容包含未知字段」错误。
- 单个字段值的长度上限为 2000 字符。
- `checkboxes` 与 `player_select` 在写库前归一化为英文逗号连接的字符串，`{field.<id>}` 因此取到逗号分隔文本。

## 渲染为 Markdown 正文的规则

议题创建时，`body` 按下列规则渲染并存入数据库（`renderBody`）：

| 字段类型 | 渲染格式 |
| --- | --- |
| `markdown` | 原样输出 `value` 内容 |
| `input` | `**标签:** 值` |
| `textarea` | `**标签:**` 后空一行再输出值 |
| `checkboxes` | 每个选中项输出 `- [x] 选项文本` |
| `dropdown` | `**标签:** 显示文本`（非提交值） |
| `select_input` | `**标签:** 预设值或自定义输入 |
| `player_select` | `**标签:** 玩家名，多个值以逗号加空格分隔 |

各字段之间以 `---` 分隔；所有字段均为空时，正文为 `No content provided`。
