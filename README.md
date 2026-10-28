# Neokoni's Projects

`projects.neokoni.ink` 的源码：一个 VitePress 单站点，同时承载项目索引主页和站内文档区。主页有中文（`/`）和英文（`/en/`）两份，文档 URL 固定为 `/<slug>/docs/zh-cn/`，与 `content/` 下的目录一一对应。

## 使用

```bash
pnpm install
pnpm dev       # http://localhost:5173/
pnpm build     # 产出 dist/
pnpm preview   # http://localhost:4173/，按线上方式预览（cleanUrls、统一 404）
```

## 布局

```
content/
├── index.md                      中文主页，卡片由 projects.json 渲染
├── en/index.md                   英文主页 → /en/，同一份数据
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

## 加一个项目

在 `projects.json` 的 `projects` 里加一条，`links` 数组决定卡片形态：

- **一条链接**：整张卡片可点。外部站点写 `{ "text": "访问", "href": "https://..." }`，站内文档写 `{ "text": "在线阅读", "slug": "<slug>" }`。
- **多条链接**：卡片不再整块可点，卡内渲染一排按钮（如官网 + 文档 + 源码各一个）。

站内文档还要建目录 `content/<slug>/docs/zh-cn/`（放一个 `index.md`）。`slug` 与目录对不上时 `dev` / `build` 会直接报错。

每条文案都带一份英文：中文写在原字段上，英文写同级的 `_en` 字段（`name_en`、`description_en`、`tags_en`、`text_en`），分组用 `title_en`，站点文案用 `headline_en` / `description_en`。缺了英文 `dev` / `build` 会报错——英文主页直接读这些字段。

## 多语言

- 路由用 VitePress 的 `locales`：中文是 `root`，英文是 `en`，`content/en/` 对应 `/en/`。两份主页共用 `ProjectsHome`，组件通过 `useLang()` 取当前语言，再按 `_en` 后缀挑文案。
- 语言切换入口是主题自带的翻译下拉（导航栏右侧图标，移动端在抽屉里）。配置里 `i18nRouting: false`：只有首页翻译过，切换一律落到对方首页，不去拼 `/<slug>/docs/zh-cn/` 的镜像路径。
- 文档区仍然只有中文，英文主页卡片上的「Docs」指向 `/<slug>/docs/zh-cn/`。`sitemap` 会顺带写出两种语言的 `hreflang`。

## 侧边栏规则

`content/<slug>/docs/zh-cn/` 下的每个子目录是一个分组，分组的名字和链接来自该目录的 `index.md`；其余 `.md` 变成条目，文案取自文件的一级标题。所以改标题就等于改菜单。

## 样式

组件样式是模板里的 Tailwind 工具类，`.vitepress/theme/styles/` 下只有两个文件：`tailwind.css` 引入 Tailwind（不带 preflight，utilities 留在 `@layer` 之外，否则会被 VitePress 未分层的样式整体压过），`overrides.css` 只覆盖 VitePress 自身（导航栏通栏、侧边栏与目录的配色和过渡）。

404 页走 `Layout.vue` 里的 `#not-found` 插槽渲染 `components/NotFoundPage.vue`，排版和配色与首页一致；请求的路径由浏览器侧补上（静态页里拿不到）。

## 部署

推送 `main` 后 `.github/workflows/deploy.yml` 构建并用 `appleboy/scp-action` 整目录上传到 1Panel 站点目录 `/opt/1panel/www/sites/projects.neokoni.ink/index`，`rm: true` 全量覆盖。secrets：`SERVER_HOST` / `SERVER_PORT` / `SERVER_USERNAME` / `SERVER_PASSWORD`。

服务器站点配置里必须有这行，否则无后缀的 clean URL 会 404：

```nginx
location / {
    try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

## 已知取舍

- 单站点意味着文档与主页同一个仓库、同一次构建；某个文档区改一个字也会触发整站重新部署。换来的是没有多仓库协调、没有目录所有权问题、搜索天然跨项目。
- `/<slug>/docs/zh-cn/` 这段路径是硬编码进目录结构的，不支持一个项目挂多种 URL 形态。
