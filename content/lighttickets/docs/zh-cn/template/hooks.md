---
order: 30
---

# 完成钩子

## 钩子结构

```yaml
completion_hooks:
  - event: closed
    if: "{field.severity}>=4"
    type: minimessage
    messages:
      - "<color:#ffffff>你的议题 <color:#96bfff>#{ticket_id}</color> 已关闭</color>"
  - event: closed
    type: command
    commands:
      - "tell {player_name} 议题 #{ticket_id} 已关闭"
```

| 键 | 适用类型 | 说明 |
| --- | --- | --- |
| `event` | 全部 | 必填，触发事件，见下表 |
| `if` | 全部 | 可选条件表达式，不满足时该钩子将被跳过 |
| `type` | 全部 | `command` / `minimessage` / `selection`，可省略 |
| `commands` | command | 命令列表，每项一条命令 |
| `messages` | minimessage | 消息列表 |
| `message` | minimessage | 单条消息的简写，仅填写一条时序列化为该键 |
| `title` | selection | 决策标题，必填，长度不超过 191 |
| `visibility` | selection | 决策结果卡片可见性：`staff`（默认）或 `public` |
| `fields` | selection | 决策字段数组，必填且非空 |
| `actions` | selection | 提交后执行的动作数组，必填且非空 |

`type` 省略时按内容推断：存在 `commands` 即为 `command`，否则视为 `minimessage`。

## 可用事件（event）

| 事件值 | 触发时机 |
| --- | --- |
| `closed` | 议题状态变更为 `closed` |
| `invalid` | 议题状态变更为 `invalid` |

## 钩子类型（type）

| 类型 | 说明 | 内容字段 |
| --- | --- | --- |
| `command` | 以服务器控制台权限执行 Minecraft 命令 | `commands` |
| `minimessage` | 向议题作者发送 MiniMessage 格式消息 | `messages` 或 `message` |
| `selection` | 后台显示为「执行选项」，等待 `staff` / `admin` 填写并确认 | `title`、`visibility`、`fields`、`actions` |

::: warning
已绑定服务器且在模板中配置了 `command` 钩子的议题，其状态变更仅能由 `staff` / `admin` 发起；普通用户触发时，请求将被拒绝，并提示需由 `admin` 确认。
:::

## 执行选项（selection）

`selection` 在状态变化时不会立即执行。议题首次进入匹配配置的状态后，后端保存一份字段与动作配置快照，并将其标记为 `pending`：

- 同一议题仅生成这一组决策。重开后再关闭、再次切换状态均不会取消或重新生成（数据库侧通过一次 CAS 更新保证仅执行一次）。
- 仅 `staff` / `admin` 可填写；提交成功后状态变为 `completed`，同时记录操作人、填写结果与完成时间，并写入审计。
- 亦可选择「不做决策」，状态变为 `skipped`，动作不会执行。每项决策最多处理一次。
- 对隐藏议题，无权用户统一收到 404，决策是否存在不会暴露。

`visibility` 决定结果卡片可见性：取 `staff` 时始终仅 `staff` / `admin` 可见；取 `public` 时在决策完成前同样仅 `staff` / `admin` 可见，完成后对能查看该议题的用户公开。公开结果不会使无权查看隐藏议题的用户绕过议题可见性。

```yaml
completion_hooks:
  - event: closed
    type: selection
    title: 选择处理结果
    visibility: public
    fields:
      - type: checkboxes
        id: rewards
        validations:
          required: true
        attributes:
          label: 发放内容
          options:
            - 金币
            - 物品
      - type: input
        id: note
        attributes:
          label: 处理说明
          placeholder: 可选备注
    actions:
      - type: command
        commands:
          - "reward {player_name} {selection.rewards}"
          - "say 议题 #{ticket_id} 已处理"
      - type: minimessage
        messages:
          - "<green>处理完成：{selection.note}</green>"
```

决策字段支持 `input`、`textarea`、`checkboxes`、`dropdown`、`select_input`、`player_select`，其结构与 `body` 字段相同，但每个字段须有唯一 `id` 和非空 `attributes.label`。`actions` 中每个动作为 `command` 或 `minimessage`，按配置顺序下发。

提交时，`validateResponse`（`backend/src/services/completion-hook.service.ts`）执行以下检查：

| 检查 | 行为 |
| --- | --- |
| 未知字段 | 提交模板中不存在的 `id` 时，产生「提交内容包含未知字段」错误 |
| `checkboxes` | 须为数组，去重后校验每一项均在 `options` 中；`required: true` 要求至少选一项；带 `required: true` 的选项须被选中 |
| 文本字段 | 须为字符串，长度不超过 2000 字符；`required` 时不得只含空白 |
| `dropdown` | 提交值或原始文本归一化为选项提交值，匹配失败时产生「包含无效选项」错误 |
| `player_select` | 配置的玩家组须仍然存在，提交的玩家名须有效（除非 `input_any: true` 且为有效 MC 名） |

`{selection.<字段ID>}` 用于在 `actions` 中引用填写结果，多选值以英文逗号连接；其余议题与表单占位符在同一动作中仍然可用。

## 可用占位符变量

在 `commands` 和 `messages` 中可用，由后端在发送前替换：

| 占位符 | 说明 | 示例值 |
| --- | --- | --- |
| `{ticket_id}` | 议题 ID | `42` |
| `{ticket_title}` | 议题标题 | `[Bug] 无法登录` |
| `{player_name}` | 议题作者的 Minecraft 用户名 | `Notch` |
| `{player_uuid}` | 议题作者的 Minecraft UUID | `069a79f4-44e9-4726-a5be-fca90e38aaf5` |
| `{field.<id>}` | 表单中指定字段的值 | `{field.version}` → `1.21.1` |

字段值取自议题创建时提交的 `formData`，字段不存在或为空时替换为空字符串；作者未绑定 Minecraft 账号时，`player_name` 与 `player_uuid` 为 `unknown`。命令中的占位符值将被压成单行、截断到 2000 字符，且 `@p` 等原生选择器将被改写，以防止注入。

## 条件执行（if）

`if` 仅可配置在 `completion_hooks` 项中，`body` 字段不支持。表达式形如 `<左值> <运算符> <右值>`，支持 `==`、`!=`、`<`、`<=`、`>`、`>=`：

```yaml
completion_hooks:
  - event: closed
    if: "{field.category}==bug"
    type: minimessage
    messages:
      - "<color:#ffffff>Bug 议题 #{ticket_id} 已关闭</color>"
  - event: closed
    if: "{ticket_id}>0"
    type: command
    commands:
      - "tell {player_name} 议题 #{ticket_id} 已关闭"
```

- 左值写 `{变量}` 时按占位符取值，写裸标识符时也按变量名取值；右值仅在带引号时按字面量处理。
- 两侧均可转为数字时按数字比较，否则按字符串比较。
- `if` 为空或纯空白时视为恒真。表达式不合法时，保存 `selection` 将产生 `无效的 if 条件` 错误；运行时求值异常按「不执行」处理，不中断状态变更。

## 执行链路

1. 状态变更时，后端在同一事务中解析模板钩子，将需要执行的命令与消息写入 Minecraft Hook 投递记录（`minecraftHookDelivery`）。议题未绑定服务器或未命中钩子时不产生投递。
2. 事务提交后，后端通过 Socket.IO `/mc` 命名空间的 `server:<serverId>` 房间发出 `hook:execute`，载荷包含 `deliveryId`、`ticketId`、`event`、`playerUuid` 与逐条 `hooks`（`hookId`、`type`、`content`、`placeholders`）。
3. 插件执行完成后返回 `hook:ack`（`deliveryId` 字符串，或 `{ deliveryId, results: [{ hookId, success, error }] }`），后端将其标记为 `delivered` 并保存回执结果。
4. 未收到回执的投递将被重试：最多 5 次，间隔从 15 秒起指数退避，上限 15 分钟；定时器与服务器重连时均补投待处理记录。超过次数后标记为 `failed`，进入死信。

协议细节、命名空间鉴权与插件侧实现见 [../websocket/hooks.md](../websocket/hooks.md)。

## 投递查看与手动重试

管理后台可查看投递记录并对死信重试，接口位于 `backend/src/routes/admin-minecraft-hook-deliveries.ts`，仅 `admin` 可用：

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/minecraft-hook-deliveries` | 返回 `status: failed` 的投递，按 `failedAt` 倒序 |
| `POST /api/admin/minecraft-hook-deliveries/:id/retry` | 将该投递重置为 `pending`，`attempts` 归零，返回 `{ retried: boolean }` |

重试仅对 `failed` 状态生效，返回 `retried: false` 表示该投递已不是死信。后台操作入口见 [../guide/admin.md](../guide/admin.md)。
