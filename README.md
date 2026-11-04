# Neokoni's Projects

`projects.neokoni.ink` 的源码为 VitePress 单站点，同时承载项目索引主页与站内文档区。主页分中文（`/`）与英文（`/en-us/`）两份，文档 URL 固定为 `/<slug>/docs/zh-cn/`，与 `content/` 下的目录一一对应。

## 命令

```bash
pnpm install
pnpm dev       # http://localhost:5173/
pnpm build     # 产出 dist/
pnpm preview   # http://localhost:4173/，按线上方式预览（cleanUrls、统一 404）
```

## 布局

```text
content/
├── index.md                      中文主页，卡片由 projects.json 渲染
├── en-us/index.md                英文主页 → /en-us/，同一份数据
└── handbook/docs/zh-cn/          站内文档区 → /handbook/docs/zh-cn/
.vitepress/
├── config.mts                    数据校验 + 侧边栏生成 + VitePress 配置
└── theme/
    ├── index.ts                  注册组件与样式
    ├── Layout.vue                默认布局 + 自定义 404 插槽 + 折叠动画挂载
    ├── sidebar-motion.ts         侧边栏分组的展开/收起动画
    ├── i18n.ts                   当前语言 + `_en` 文案取值 + 组件内的界面文案
    ├── components/               卡片、首页、文档首页、404（样式用 Tailwind 写在模板里）
    └── styles/                   tailwind.css + overrides.css
projects.json                     项目数据的唯一来源
```

## 项目条目

在 `projects.json` 的 `projects` 中新增一条记录，`links` 数组决定卡片形态：

- **一条链接**：整张卡片可点击。外部站点使用：

    ```json
    {
      "text": "访问",
      "href": "https://..."
    }
    ```

    站内文档使用：

    ```json
    {
      "text": "在线阅读",
      "slug": "<slug>"
    }
    ```
- **多条链接**：卡片不整块可点击，卡内渲染一排按钮（如官网、文档、源码各一个）。

站内文档须另建目录 `content/<slug>/docs/zh-cn/`（放置一个 `index.md`）。`slug` 与目录不一致时，`dev` / `build` 将直接产生错误。

每条文案均带英文副本：中文写在原字段上，英文写同级的 `_en` 字段（`name_en`、`description_en`、`tags_en`、`text_en`），分组使用 `title_en`，站点文案使用 `headline_en` / `description_en`。

英文缺失时，`dev` / `build` 将产生错误。

英文主页直接读取这些字段。

## 多语言

- 路由由 VitePress 的 `locales` 配置：中文为 `root`，英文为 `en`，`content/en-us/` 对应 `/en-us/`。两份主页共用 `ProjectsHome` 组件，该组件通过 `useLang()` 获取当前语言，再按 `_en` 后缀选择文案。
- 语言切换入口为主题内置的翻译下拉（导航栏右侧图标，移动端位于抽屉内）。配置中 `i18nRouting: false`：仅首页提供翻译，切换一律落到对方首页，不生成 `/<slug>/docs/zh-cn/` 的镜像路径。
- 文档区仍仅有中文，英文主页卡片上的「Docs」指向 `/<slug>/docs/zh-cn/`。`sitemap` 将同时写出两种语言的 `hreflang`。

## 侧边栏规则

`content/<slug>/docs/zh-cn/` 下的每个子目录为一个分组，分组的名称与链接取自该目录的 `index.md`；其余 `.md` 文件成为条目，文案取自文件的一级标题。因此，修改标题即修改菜单文案。文档区自身的 `index.md` 以「概览」作为侧边栏第一项，否则仅能通过项目卡片进入。

## 样式

组件样式为模板内的 Tailwind 工具类，`.vitepress/theme/styles/` 下仅有两个文件：`tailwind.css` 引入 Tailwind（不带 preflight，utilities 保留在 `@layer` 之外，否则将被 VitePress 未分层的样式整体覆盖），`overrides.css` 仅覆盖 VitePress 自身样式（导航栏通栏、侧边栏与目录的配色和过渡）。

404 页由 `Layout.vue` 的 `#not-found` 插槽渲染 `components/NotFoundPage.vue`，排版与配色同首页；请求的路径由浏览器侧补上（该路径在静态页中无法获取）。

## 部署

推送 `main` 后，`.github/workflows/deploy.yml` 执行构建，并通过 `appleboy/scp-action` 将整个目录上传至 1Panel 站点目录 `/opt/1panel/www/sites/projects.neokoni.ink/index`，`rm: true` 为全量覆盖。secrets 为 `SERVER_HOST` / `SERVER_PORT` / `SERVER_USERNAME` / `SERVER_PASSWORD`。

服务器站点配置中须包含以下内容，否则无后缀的 clean URL 将返回 404：

```nginx
location / {
    try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

## 已知取舍

- 单站点将文档与主页置于同一仓库、同一次构建；某一文档区改动一个字亦将触发整站重新部署。该结构无需多仓库协调与目录所有权划分，搜索范围为全部项目。
- 该路径 `/<slug>/docs/zh-cn/` 硬编码于目录结构，不支持一个项目对应多种 URL 形态。
