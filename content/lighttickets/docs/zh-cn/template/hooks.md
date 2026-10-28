---
order: 30
---

# 完成钩子

`completion_hooks` 在议题状态变更为指定值时触发。后端解析占位符后，把命令或消息通过 WebSocket 下发给 Minecraft 插件执行；`selection` 类型则先等 `staff` / `admin` 填写决策，再执行动作。

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
| `if` | 全部 | 可选条件表达式，不满足时该钩子跳过 |
| `type` | 全部 | `command` / `minimessage` / `selection`，可省略 |
| `commands` | command | 命令列表，每项一条命令 |
| `messages` | minimessage | 消息列表 |
| `message` | minimessage | 单条消息的简写，只填一条时序列化为它 |
| `title` | selection | 决策标题，必填，长度不超过 191 |
| `visibility` | selection | 决策结果卡片可见性：`staff`（默认）或 `public` |
| `fields` | selection | 决策字段数组，必填且非空 |
| `actions` | selection | 提交后执行的动作数组，必填且非空 |

`type` 省略时自动推断：有 `commands` 即为 `command`，否则视为 `minimessage`。

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
已经绑定服务器、且模板里配置了 `command` 钩子的议题，状态变更只能由 `staff` / `admin` 发起；普通用户触发时会直接拒绝，并提示需要管理员确认。
:::

## 执行选项（selection）

`selection` 不会在状态变化时立即执行。议题第一次进入能匹配配置的状态后，后端保存一份字段与动作配置快照并标记为 `pending`：

- 同一议题只生成这一组决策。重开后再关闭、再次切换状态都不会取消或重新生成（数据库侧用一次 CAS 更新保证只执行一次）。
- 只有 `staff` / `admin` 能填写；提交成功后状态变为 `completed`，同时记录操作人、填写结果与完成时间，并写入审计。
- 也可以选择「不做决策」，状态变为 `skipped`，动作不会执行。每项决策最多处理一次。
- 对隐藏议题，无权用户拿到的统一是 404，不会暴露决策是否存在。

`visibility` 控制结果卡片可见性：`staff` 始终仅 `staff` / `admin` 可见；`public` 在决策完成前也只有 `staff` / `admin` 可见，完成后对能查看该议题的人公开。公开结果不会让无权查看隐藏议题的用户绕过议题可见性。

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

决策字段支持 `input`、`textarea`、`checkboxes`、`dropdown`、`select_input`、`player_select`，结构与 `body` 字段相同，但每个字段必须有唯一 `id` 和非空 `attributes.label`。`actions` 里每个动作是 `command` 或 `minimessage`，按配置顺序下发。

提交时 `validateResponse`（`backend/src/services/completion-hook.service.ts`）会做这些检查：

| 检查 | 行为 |
| --- | --- |
| 未知字段 | 提交了模板里没有的 `id` 直接报「提交内容包含未知字段」 |
| `checkboxes` | 必须是数组，去重后校验每一项都在 `options` 里；`required: true` 要求至少选一项；带 `required: true` 的选项必须被选中 |
| 文本字段 | 必须是字符串，长度不超过 2000 字符；`required` 时不能只含空白 |
| `dropdown` | 提交值或原始文本归一化为选项提交值，匹配不到报「包含无效选项」 |
| `player_select` | 配置的玩家组必须仍然存在，提交的玩家名必须有效（除非 `input_any: true` 且是有效 MC 名） |

`{selection.<字段ID>}` 用于在 `actions` 中引用填写结果，多选值以英文逗号连接；其余议题与表单占位符在同一动作里仍然可用。

## 可用占位符变量

在 `commands` 和 `messages` 中可用，后端在发送前替换：

| 占位符 | 说明 | 示例值 |
| --- | --- | --- |
| `{ticket_id}` | 议题 ID | `42` |
| `{ticket_title}` | 议题标题 | `[Bug] 无法登录` |
| `{player_name}` | 议题作者的 Minecraft 用户名 | `Notch` |
| `{player_uuid}` | 议题作者的 Minecraft UUID | `069a79f4-44e9-4726-a5be-fca90e38aaf5` |
| `{field.<id>}` | 表单中指定字段的值 | `{field.version}` → `1.21.1` |

字段值取自议题创建时提交的 `formData`，字段不存在或为空时替换为空字符串；作者没有绑定 Minecraft 账号时 `player_name` 与 `player_uuid` 为 `unknown`。命令中的占位符值会被压成单行、截断到 2000 字符，并把 `@p` 这类原生选择器改写，避免注入。

## 条件执行（if）

`if` 只能配置在 `completion_hooks` 项上，`body` 字段不支持。表达式形如 `<左值> <运算符> <右值>`，支持 `==`、`!=`、`<`、`<=`、`>`、`>=`：

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

- 左值写 `{变量}` 时按占位符取值，直接写裸标识符也按变量名取值；右值只在带引号时按字面量处理。
- 两侧都能转成数字时按数字比较，否则按字符串比较。
- `if` 为空或纯空白视为恒真。表达式不合法时保存 `selection` 会报 `无效的 if 条件`；运行时求值异常则按「不执行」处理，不会中断状态变更。

## 执行链路

1. 状态变更时，后端在同一事务里解析模板钩子，把要执行的命令与消息写入 Minecraft Hook 投递记录（`minecraftHookDelivery`）。议题没有绑定服务器或没有命中钩子时不产生投递。
2. 事务提交后通过 Socket.IO `/mc` 命名空间的 `server:<serverId>` 房间发出 `hook:execute`，载荷含 `deliveryId`、`ticketId`、`event`、`playerUuid` 与逐条 `hooks`（`hookId`、`type`、`content`、`placeholders`）。
3. 插件执行完回 `hook:ack`（`deliveryId` 字符串，或 `{ deliveryId, results: [{ hookId, success, error }] }`），后端标记 `delivered` 并保存回执结果。
4. 未收到回执的投递会重试：最多 5 次，间隔从 15 秒起指数退避、上限 15 分钟；定时器与服务器重连时都会补投待处理记录。超过次数后标记 `failed`，进入死信。

协议细节、命名空间鉴权与插件侧实现见 [../websocket/hooks.md](../websocket/hooks.md)。

## 查看投递与手动重试

管理后台可查看投递记录并对死信重试，接口位于 `backend/src/routes/admin-minecraft-hook-deliveries.ts`，仅 `admin` 可用：

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/minecraft-hook-deliveries` | 返回 `status: failed` 的投递，按 `failedAt` 倒序 |
| `POST /api/admin/minecraft-hook-deliveries/:id/retry` | 把该投递重置为 `pending`、`attempts` 归零，返回 `{ retried: boolean }` |

重试只对 `failed` 状态生效，返回 `retried: false` 表示该投递已不是死信。后台操作入口见 [../guide/admin.md](../guide/admin.md)。
