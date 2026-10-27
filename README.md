# Neokoni's Projects

`projects.neokoni.ink` 的源码：一个 VitePress 单站点，同时承载项目索引主页和站内文档区。文档 URL 固定为 `/<slug>/docs/zh-cn/`，与 `content/` 下的目录一一对应。

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
├── index.md                      主页，卡片由 projects.json 渲染
└── handbook/docs/zh-cn/          站内文档区 → /handbook/docs/zh-cn/
.vitepress/
├── config.mts                    数据校验 + 侧边栏生成 + VitePress 配置
└── theme/                        卡片与首页组件、样式
projects.json                     项目数据的唯一来源
```

## 加一个项目

**外部链接**：在 `projects.json` 加一条 `type: "external"`，`href` 写完整 URL，卡片自动 `target="_blank"`。

**站内文档**：

1. 建 `content/<slug>/docs/zh-cn/`，放一个 `index.md` 作落地页；
2. 在 `projects.json` 加一条 `type: "docs"`、`slug` 相同的条目；
3. 完成——侧边栏由目录扫描生成，不用改配置。`slug` 与目录对不上时 `dev` / `build` 会直接报错。

## 侧边栏规则

`content/<slug>/docs/zh-cn/` 下的每个子目录是一个分组，分组的名字和链接来自该目录的 `index.md`；其余 `.md` 变成条目，文案取自文件的一级标题。所以改标题就等于改菜单。

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
