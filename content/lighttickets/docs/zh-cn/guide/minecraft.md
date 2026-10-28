---
order: 50
---

# 游戏内使用

插件同时提供 Paper / Folia 与 Velocity 两个版本，命令与交互完全一致，区别只在权限系统与服务器识别方式。主命令是 `/lit`，`/lighttickets` 是它的别名。

## 两条上手路径

### 一次性注册链接（`/lit register`）

适用于还没有网页账户的玩家。执行后插件向平台申请注册链接，聊天栏会给出 `https://<站点地址>/register?mcRegisterToken=<token>`，点击即可打开浏览器。

- 需要管理员开启「允许 Minecraft 注册」（`allowMcRegister`），并配置站点地址 `siteUrl`；任一条件缺失时命令会返回错误提示。
- 链接默认 5 分钟有效，同一 UUID 只保留最新一个；网页注册完成后 Minecraft 账号自动绑定，无需再执行 `/lit bind`。
- 注册页仍需填邮箱、用户名与密码（站点启用邮件服务时还要邮箱验证码），规则与网页注册一致。

### 绑定码（`/lit bind`）

适用于已经有网页账户的玩家。执行后聊天栏显示 6 位绑定码（可点击复制），有效期 5 分钟；在网页 `/profile` 的「Minecraft 绑定」中输入该码即完成绑定。

- 同一 UUID 同时只有一个有效绑定码，重新执行 `/lit bind` 会作废旧码。
- 连续输错会触发保护：默认最多 5 次失败，之后锁定 15 分钟（可在后台「限流策略」中调整）。
- 已经绑定过会提示「你已绑定 LightTickets 账号」。
- 解绑只能在网页端完成：`/lit unbind` 只会提示「为保护账号安全，请前往 LightTickets 网页端解绑 Minecraft 账号」。

## 命令总表

所有命令都要求玩家身份执行，控制台无权使用。

| 命令 | 权限节点 | 说明 |
| --- | --- | --- |
| `/lit bind` | `lighttickets.bind` | 生成 6 位绑定码，用于把当前 Minecraft 账号绑定到已有网页账户 |
| `/lit unbind` | `lighttickets.unbind` | 提示前往网页端解绑；插件不提供游戏内解绑 |
| `/lit account` | `lighttickets.account` | 显示绑定账户信息：ID、用户名、邮箱、角色、MC 名称、注册时间，附解绑按钮 |
| `/lit register` | `lighttickets.register` | 生成一次性注册链接，网页完成注册后自动绑定 |
| `/lit reload` | `lighttickets.reload` | 重载配置并重连 WebSocket |
| `/lit status` | `lighttickets.status` | 显示 WebSocket 连接状态与平台 HTTP API 健康状态 |
| `/lit ticket create` | `lighttickets.ticket.create` | 打开模板选择器，点击模板后进入交互式创建 |
| `/lit ticket create <type>` | `lighttickets.ticket.create` | 直接使用指定模板 Key 开始创建 |
| `/lit ticket list [page]` | `lighttickets.ticket.list` | 查看议题列表，默认第 1 页 |
| `/lit ticket list:<status> [page]` | `lighttickets.ticket.list` | 按状态过滤，`status` 取 `open`、`in_progress`、`closed`、`invalid` |
| `/lit ticket search <query>` | `lighttickets.ticket.list` | 搜索议题，从第 1 页开始 |
| `/lit ticket search --page <n> <query>` | `lighttickets.ticket.list` | 带页码的搜索，参数顺序固定 |
| `/lit ticket info <id> [commentPage]` | `lighttickets.ticket.info` | 查看议题详情；第二个参数是评论页码 |
| `/lit ticket comment <id>` | `lighttickets.ticket.comment` | 以聊天输入方式发表评论 |
| `/lit ticket comment <id> reply <index>` | `lighttickets.ticket.comment` | 引用第 `index` 条评论（从 0 开始）后回复 |
| `/lit ticket status <id>` | `lighttickets.ticket.status` | 弹出状态选择菜单，点击即切换 |
| `/lit ticket status <id> <newStatus>` | `lighttickets.ticket.status` | 直接提交目标状态 |

权限说明：

- 上表中每一条玩家类命令都额外接受总权限 `lighttickets.player`；拥有它即可使用全部玩家命令。
- `reload` 与 `status` 不接受 `lighttickets.player`，需要 `lighttickets.reload` / `lighttickets.status` 或 `lighttickets.admin`。
- 状态菜单对玩家只列出 `open` 与 `closed`，且只能操作自己的议题；staff/admin 能看到全部四种状态。权限不足时统一提示「你没有权限更改此议题的状态」。

## 交互式输入流程

`/lit ticket create` 与 `/lit ticket comment` 会进入「下一条聊天消息即输入」的会话模式：

- 每一步都用一条聊天消息提交，不会累积多行，也没有结束符；输入 `cancel` 可随时中止（对应提示「输入 cancel 可随时取消创建」）。
- 会话有 10 分钟有效期，超时后需要重新发起命令；玩家退出或切换服务器也会清空会话。
- 创建议题的步骤顺序固定：标题 → 模板表单字段（按模板定义顺序）→ 是否附加当前玩家信息（世界/坐标/游戏模式，回答 `yes` 或 `no`）→ 是否允许普通用户查看附加信息（`yes`/`no`）→ 模板为可选可见性时再问是否隐藏（`yes`/`no`）→ 提交。
- 标题不能为空且不超过 200 字符，模板配置了标题前缀时会自动加在标题前。
- 表单字段按类型交互：单行/多行文本直接发送内容；下拉选择与选择或输入发送选项编号（`select_input` 也接受自定义文本）；复选框用空格分隔多个编号；玩家选择用英文逗号分隔多个玩家名，玩家名须为 3~16 位字母、数字或下划线。
- 评论会话只收一条消息；回复模式会先展示「正在回复 某位用户」，提交时自动把原评论按行加上 `> ` 前缀组成引用块。

## 搜索语法

`/lit ticket search` 后面支持与网页一致的筛选键，空格分隔多个条件：

| 语法 | 作用 |
| --- | --- |
| `author:<名称>` | 按作者用户名过滤 |
| `type:<模板Key>` | 按模板过滤 |
| `status:<状态>` | 按状态过滤，取值同上 |
| `from:web` | 只看网页提交（无来源服务器） |
| `from:minecraft` | 只看游戏内提交（有来源服务器） |
| `from:minecraft:<服务器>` | 只看指定服务器提交，服务器名按名称或别名匹配 |

转义规则：

- 值里含空格时用双引号包裹，例如 `author:"Notch Notch"`；
- 引号内的 `\"` 与 `\\` 会被还原为字面量；
- 无法识别的键（例如 `foo:bar`）不会被丢弃，而是连同冒号一起当成普通关键字参与标题/正文搜索；
- 所有非筛选词会合并为关键字搜索，多个筛选键之间是「且」的关系。

## 游戏内通知

- 议题状态被他人变更时，作者会在聊天栏收到状态变更提示，内容依次是「你的议题」、议题编号与标题、`状态被<操作者>已由 <旧状态> 变更为 <新状态>`；有新评论时会收到类似「收到某位用户的回复」并附内容摘要的提醒。
- 只有已绑定 Minecraft 账号且当前在线的议题作者与受理人会收到推送；自己触发的变更不会推给自己。议题绑定到来源服务器时只推给该服务器，否则推给所有在线服务器。
- 通知整行可点击，效果等同执行 `/lit ticket info <id>`；收到事件后插件会刷新本地缓存，随后的 `/lit ticket list` 立刻可见。
- 玩家组同步（`playerGroupUpload`）：管理员在插件 `config.yml` 里把 `playerGroupUpload.enabled` 设为 `true` 并填写 `groupId` 列表后，玩家进服时会把玩家名上传到这些玩家组，可用作模板「玩家选择」字段的候选来源。上传失败只记警告日志，不影响进服。

## 常见失败原因

| 现象 | 原因与处理 |
| --- | --- |
| 「你尚未绑定 LightTickets 账号, 请先执行 /lit bind」 | 当前 Minecraft 账号没有绑定任何账户；先注册或用绑定码绑定 |
| 「绑定凭据无效，请先在网页解绑后重新执行 /lit bind」 | 本地缓存的玩家凭据已失效（例如在网页解绑过）；到网页重新绑定 |
| 「玩家会话已失效，请重试」 | 玩家会话（默认 5 分钟）过期或校验失败；重新执行一次命令即可自动续期 |
| 「无法确定当前服务器 ID, 请稍后重试」 | Velocity 环境下玩家还在切换后端服务器，拿不到服务器标识；稍后重试 |
| 「平台要求登录后才能查看议题, 请先执行 /lit bind」 | 站点开启了「要求登录查看议题」，匿名视角被拒 |
| 请求失败并返回 401 | 插件 `serverKey` 与平台不匹配、API Key 已重新生成，或该 Key 未授权当前服务器 |
| 请求失败并返回 429 | 触发限流（全局或认证类接口），等待窗口结束后重试 |
| 命令无输出或提示无权限 | 玩家缺少对应权限节点，也没有 `lighttickets.player` |
