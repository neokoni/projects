---
order: 40
---

# 议题模板

## 文件位置与加载顺序

内置模板随源码发布在 `backend/templates/`，运行时真正读取的是数据目录 `data/templates/`。启动流程由 `backend/src/services/template.service.ts` 的 `initTemplates()` 完成：

1. 确保 `data/templates/` 存在。
2. 若初始化标记 `data/.templates_initialized` 不存在，且 `data/templates/` 下没有任何 `.yml` / `.yaml` 文件，则把 `backend/templates/` 下的模板全部复制过去。
3. 写入标记文件（内容为 ISO 时间戳），此后不再自动覆盖。
4. 扫描 `data/templates/` 下所有 `.yml` / `.yaml` 文件，按文件名排序，逐个解析并放入内存缓存。

文件名（去掉 `.yml` / `.yaml`）即模板标识符 key。key 只能包含字母、数字、下划线和短横线；管理后台写入时固定存为 `data/templates/<key>.yml`。

::: warning
标记文件一旦存在，内置模板的后续更新不会再同步到数据目录，升级后需要手动拷贝或通过管理后台覆盖。单个文件解析失败只跳过该文件并打印警告，不会导致其它模板不可用。
:::

自定义模板生效方式：把 YAML 放进 `data/templates/<key>.yml`，重启或触发一次模板保存即可载入。管理后台在创建、更新、删除模板后会重新执行 `initTemplates()`，所以后台改动立即生效，无需重启。删除操作只删除 `data/templates/` 里的文件，不会动 `backend/templates/`。

## 顶层结构

```yaml
name: "显示名称"            # 必填，创建议题时展示的模板名
description: "模板描述"      # 必填，模板用途说明
title_prefix: "[前缀] "     # 可选，自动拼接到议题标题前
hidden: false               # 可选，true / false / optional，默认 false
labels: []                  # 可选，关联标签唯一标识符列表
body: []                    # 必填，表单字段定义数组
completion_hooks: []        # 可选，状态变更时触发的钩子
```

| 键 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | 字符串 | 是 | 创建议题时显示的模板名称，后台字段名为 `nameI18n` |
| `description` | 字符串 | 是 | 模板用途说明，显示在模板选择列表 |
| `title_prefix` | 字符串 | 否 | 拼接到议题标题前；保存前会 `trim`，空串直接丢弃 |
| `labels` | 字符串数组 | 否 | 关联标签的唯一标识符（如 `bug`），不是 UUID |
| `hidden` | `true` / `false` / `optional` | 否 | 议题可见性模式，默认 `false` |
| `body` | 数组 | 是 | 表单字段定义，不能为空数组以外的非法值 |
| `completion_hooks` | 数组 | 否 | 状态变更钩子，省略等价于 `[]` |

`hidden` 的三种取值：

- `true`：议题始终隐藏，仅发起者、`staff` 和 `admin` 可见。
- `false`：议题始终公开。
- `optional`：创建者必须在创建时选择公开或隐藏。

读取时兼容误拼 `optinal`，保存时统一写为 `optional`；其它取值直接报错 `hidden 必须为 true、false 或 optional`。

::: tip
源码还支持两个 `docs/template.md` 未列出的键：`enabled`（布尔，默认 `true`，为 `false` 时不出现在议题创建列表）与 `assignee_ids`（正整数数组，去重升序，必须指向已存在的 `staff` / `admin` 用户，否则保存失败）。
:::

## 内置模板清单

| 文件 | 用途 | 说明 |
| --- | --- | --- |
| `bug_report.yml` | Bug 反馈 | 说明文本 + 问题描述 + 复现步骤，无钩子 |
| `permission_request.yml` | 权限申请 | 申请理由 + 权限节点下拉，关闭/拒绝时发消息，命中节点时追加命令 |
| `report.yml` | 举报 | 被举报玩家名 + 举报详情，无钩子 |
| `suggestion.yml` | 建议 | 建议内容，关闭时发送「已被采纳」消息 |
| `full_example.yml` | 语法示例 | 覆盖下拉、复选框、`if` 条件与多条钩子，作为写法参考 |

每个模板的字段构成与钩子配置见 [./examples.md](./examples.md)。

## 读取接口

模板读取接口由 `backend/src/routes/templates.ts` 提供，前置 `authOrServerKeyMiddleware`，站点前端与 Minecraft 服务器 key 都可调用：

| 方法与路径 | 返回 |
| --- | --- |
| `GET /api/templates` | 模板摘要数组，每项含 `name`、`name_i18n`、`description`、`labels`、`hidden` |
| `GET /api/templates/:name` | 单个模板，含 `name`、`description`、`title_prefix`、`labels`、`hidden`、`body` |

两个接口都只返回 `enabled` 的模板；`GET /api/templates/:name` 不含 `completion_hooks`，模板不存在时返回 404 `模板不存在`。

编辑模板走管理后台的「模板管理」，对应接口 `/api/admin/templates`（`GET` / `GET :name` / `POST` / `PATCH :name` / `DELETE :name`，仅 `admin` 可用）。后台提供基础信息、表单字段、完成钩子、编辑原文四个分区，保存时由后端校验并写回 YAML。操作细节见 [../guide/admin.md](../guide/admin.md)。

## 子页面

- [./fields.md](./fields.md)：七种字段类型、可用属性与正文渲染规则。
- [./hooks.md](./hooks.md)：完成钩子的事件、类型、执行选项与占位符。
- [./examples.md](./examples.md)：内置模板逐段解析与常见写法。
