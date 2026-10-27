---
order: 1
---

# 目录结构

## 一条规则决定 URL

VitePress 的 `srcDir` 指向 `content/`，页面 URL 就是它在 `content/` 下的相对路径。所以要拿到 `/<slug>/docs/zh-cn/xxx` 这个 URL，目录就得长成这样：

```
content/
├── index.md            → /
└── handbook/docs/zh-cn/
    ├── index.md        → /handbook/docs/zh-cn/
    └── guide/
        └── structure.md → /handbook/docs/zh-cn/guide/structure
```

`content/<slug>/docs/<lang>/` 里那段 `docs/zh-cn` 是 URL 的一部分，不是可选的风格选择。单个项目要加语言版本时，平行再加 `docs/en-us/`。

## 根目录下不放页面

`README.md`、`AGENTS.md` 在 `content/` 之外，因此不会变成网页；`.vitepress/`、`node_modules/` 这些目录也不参与路由。这是故意分开的：给人和给机器读的文件不必上线。

## 加一个文档区

1. 建目录 `content/<slug>/docs/zh-cn/`，放一个 `index.md` 作为落地页；
2. 在 `projects.json` 里加一条带 `slug` 链接的条目（`links: [{ "text": "在线阅读", "slug": "<slug>" }]`）；
3. 侧边栏会自动出现，不需要改配置。

`dev` 与 `build` 加载配置时会校验 `slug` 与实际目录，对不上直接报错，不会带着 404 上线。
