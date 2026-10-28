# 项目约定

本文件是本仓库的持久约束，贡献者（含 AI）必须遵守。

## 1 提交信息

- **一律使用英文。**
- 单行标题说清「做了什么」，格式 `<type>: <imperative summary>`，type 取 `feat` / `fix` / `docs` / `refactor` / `style` / `perf` / `build` / `ci` / `chore`。
- 标题不超过 72 字符，句尾不加句号，不用 `update xxx`、`fix bug` 这类无信息量表述。
- 只有涉及取舍、迁移、多步操作时才写正文，正文同样英文、手动折行到 72 字符。
- 一次提交只做一件事；格式化或依赖升级不与功能改动混在一起。

```
feat: cap project card width at 380px
fix: keep external links opening in a new tab
ci: deploy the whole dist directory with scp-action
```

## 2 数据源

- `projects.json` 是项目数据的唯一来源：分组、条目、链接类型都从这里来，不得在组件或 Markdown 里硬编码项目列表。
- 新增条目只加数据，不改渲染代码。每个项目用 `links` 数组描述入口，每条只能有 `slug`（站内文档，须与 `content/<slug>/` 一致）或 `href`（完整 `http(s)` 地址）之一。
- 一条 `links` 时整卡可点，多条时卡内渲染按钮——这个分支由组件按数组长度决定，不要为单个项目写特例。
- 每条文案都要有英文副本：中文写在 `headline` / `title` / `name` / `description` / `tags` / `text` 上，英文写在同级的 `_en` 字段里（`headline_en`、`title_en`、`name_en`、`description_en`、`tags_en`、`text_en`），缺失会中断构建。
- 校验在配置加载时执行，`dev` 与 `build` 都会中断并列出全部问题。

## 3 路径不变量

- 站内文档 URL 固定为 `/<slug>/docs/zh-cn/`，由 `content/<slug>/docs/zh-cn/` 的目录结构直接决定（`srcDir: 'content'`），不引入 `rewrites` 或跳转桩。
- `content/` 之外的 Markdown（`README.md`、`AGENTS.md`）不参与构建，不要把页面写到根目录。
- 侧边栏由目录扫描生成，不要手写 `sidebar` 数组；要让菜单文案变化，改对应文件的一级标题。文档区自己的 `index.md` 固定以「概览」出现在最前面。
- 只有首页有英文版：中文留在 `/`，英文在 `/en/`（`content/en/index.md`）。文档区仍只有中文，英文页的站内文档链接指向 `/<slug>/docs/zh-cn/`。

## 4 部署

- 单站点：`dist/` 是完整站点，`scp-action` 用 `rm: true` 全量覆盖 `/opt/1panel/www/sites/projects.neokoni.ink/index`。
- `cleanUrls: true` 依赖服务器的 `try_files $uri $uri.html $uri/ =404`，少了这行线上会出现大量 404，且无法从仓库侧修复。

## 5 代码风格

- 注释使用英文，且只写必要说明，不复述代码。
- 颜色一律走 `--vp-c-*` 变量，亮暗色自动跟随，不要写死色值。
- 组件样式用 Tailwind 工具类写在模板里，不新增组件级 CSS；只有覆盖 VitePress 自身样式才写 `styles/overrides.css`。
- `styles/tailwind.css` 里的 utilities 必须留在 `@layer` 之外：VitePress 的样式未分层，分层规则会被它整体压过。新增组件目录时记得补 `@source`。
- 卡片与首页组件只保留一份，位于 `.vitepress/theme/components/`，页面里不要重复实现布局。
- 脚本不打印提示文案，入口与端口写在 README。

## 6 命令

```bash
pnpm dev
pnpm build
pnpm preview
```
