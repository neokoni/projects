---
order: 40
---

# 模板示例

先看一份覆盖完整语法的模板原文，再拆解其余内置模板，最后汇总常用写法。

## 完整示例

以下内容摘自 `backend/templates/full_example.yml`：

```yaml
name: "完整语法示例"
description: "展示输入、选择、复选框、Markdown、if 条件与完成钩子"
title_prefix: "[示例]"
labels: []
body:
  - type: markdown
    attributes:
      value: |
        请填写基础信息。关闭议题时，完成钩子会根据字段值决定是否执行。

  - type: dropdown
    id: priority
    validations:
      required: true
    attributes:
      label: "优先级"
      description: "1 最低，5 最高"
      options:
        - "1"
        - "2"
        - "3"
        - "4"
        - "5"

  - type: textarea
    id: reproduction
    validations:
      required: true
    attributes:
      label: "复现步骤"
      placeholder: "如果不是 bug，可填写无"

  - type: input
    id: expected_answer
    attributes:
      label: "期望回复"
      placeholder: "希望收到怎样的处理结果"

  - type: markdown
    attributes:
      value: |
        管理员关闭议题时，completion_hooks 可根据字段值与议题变量条件触发。

  - type: input
    id: workaround
    attributes:
      label: "临时解决方案"
      placeholder: "如没有可填写无"

  - type: checkboxes
    id: checklist
    attributes:
      label: "提交前确认"
      options:
        - label: "我已搜索过现有议题"
          required: true
        - "我可以补充更多信息"
completion_hooks:
  - event: closed
    if: "{field.category}==bug"
    type: minimessage
    messages:
      - "<color:#ffffff>Bug 议题 <color:#96bfff>#{ticket_id}</color> 已关闭</color>"
  - event: closed
    if: "{field.category}!=bug"
    type: minimessage
    messages:
      - "<color:#ffffff>非 Bug 议题 <color:#96bfff>#{ticket_id}</color> 已关闭</color>"
  - event: closed
    if: "{field.priority}<5"
    type: command
    commands:
      - "tell {player_name} 你的议题 #{ticket_id} 已按常规优先级关闭"
  - event: closed
    if: "{field.priority}<=2"
    type: minimessage
    messages:
      - "<color:#ffffff>低优先级议题 #{ticket_id} 已进入归档</color>"
  - event: closed
    if: "{field.priority}>3"
    type: minimessage
    messages:
      - "<color:#ffffff>高优先级议题 #{ticket_id} 已处理完成</color>"
  - event: closed
    if: "{field.priority}>=4"
    type: command
    commands:
      - "tell {player_name} 高优先级议题 #{ticket_id} 已关闭"
  - event: closed
    if: "{ticket_id}>0"
    type: minimessage
    messages:
      - "<color:#ffffff>议题 <color:#96bfff>#{ticket_id}</color> 已关闭，标题：{ticket_title}</color>"
```

逐段说明：

| 片段 | 作用 |
| --- | --- |
| `name` / `description` / `title_prefix` | 模板名与用途，创建时标题自动带 `[示例]` |
| `dropdown` + `id: priority` | 必填下拉，选项为数字字符串，便于 `if` 做数值比较 |
| `textarea` + `id: reproduction` | 必填多行文本 |
| `input` 字段 | `expected_answer`、`workaround`，都是选填单行文本 |
| `checkboxes` | 混合写法：首项 `required: true` 必须勾选，次项可选 |
| `if: "{field.category}==bug"` | 模板里没有 `category` 字段，取值为空字符串，所以两条中只有「非 bug」命中 |
| `{field.priority}<5` / `<=2` / `>3` / `>=4` | 同一数字字段四种比较，可同时命中多条钩子 |
| `{ticket_id}>0` | 恒真条件，演示总会执行的消息钩子 |

## 其余内置模板要点

| 文件 | 字段构成 | 钩子配置 |
| --- | --- | --- |
| `bug_report.yml` | 说明文本、问题描述（必填）、复现步骤（必填） | `completion_hooks: []` |
| `permission_request.yml` | 申请理由（必填）、权限节点下拉（必填，单选项 `Bot权限`） | `closed` 时发消息并追加命令，`invalid` 时发拒绝消息 |
| `report.yml` | 被举报玩家名（必填）、举报详情（必填） | `completion_hooks: []` |
| `suggestion.yml` | 建议内容（必填） | `closed` 时发「已被采纳」消息 |

对应片段：

```yaml
# bug_report.yml —— 只有表单，没有钩子
completion_hooks: []

# permission_request.yml —— 命中节点时既发消息又执行命令
completion_hooks:
  - event: closed
    type: command
    if: "{field.permission}==Bot权限"
    commands:
      - "tell {player_name} 已添加Bot权限 #{ticket_id} "

# report.yml —— 两个必填字段，一个是 input、一个是 textarea
body:
  - type: input
    id: target
    validations:
      required: true
    attributes:
      label: "被举报玩家名"

# suggestion.yml —— 只在关闭时告知作者结果
completion_hooks:
  - event: closed
    type: minimessage
    messages:
      - "<color:#ffffff>你的建议 </color><color:#96bfff>#{ticket_id}</color><color:#ffffff> 已被采纳</color>"
```

## 常见写法集合

必填字段与必选选项，`validations.required` 约束整体，选项上的 `required` 约束单项：

```yaml
- type: checkboxes
  id: checklist
  validations:
    required: true
  attributes:
    label: "提交前确认"
    options:
      - label: "我已阅读常见问题"
        required: true
```

按玩家组过滤玩家，并允许提交组外的有效玩家名：

```yaml
- type: player_select
  id: players
  validations:
    required: true
  attributes:
    label: 选择玩家
    groups: [online_players]
    input_any: true
```

带条件的钩子，以及只在拒绝时触发的钩子：

```yaml
- event: closed
  if: "{field.priority}>=4"
  type: command
  commands:
    - "tell {player_name} 高优先级议题 #{ticket_id} 已关闭"
- event: invalid
  type: minimessage
  messages:
    - "<color:#ff8181>你的申请 #{ticket_id} 已被拒绝</color>"
```

`if` 只能写在钩子项上，字段不支持条件；不写 `if` 的钩子在事件触发时总会执行。完整键表见 [./fields.md](./fields.md) 与 [./hooks.md](./hooks.md)。
