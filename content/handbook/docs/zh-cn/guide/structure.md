---
order: 1
---

# 目录结构

## URL 的生成规则

VitePress 的 `srcDir` 指向 `content/`，页面 URL 为页面文件在 `content/` 下的相对路径。`/<slug>/docs/zh-cn/xxx` 形式的 URL 对应以下目录结构：

```
content/
├── index.md            → /
└── handbook/docs/zh-cn/
    ├── index.md        → /handbook/docs/zh-cn/
    └── guide/
        └── structure.md → /handbook/docs/zh-cn/guide/structure
```

`content/<slug>/docs/<lang>/` 中的 `docs/zh-cn` 属于 URL 的组成部分。单个项目增加语言版本时，并列添加 `docs/en-us/`。

## 不参与构建的目录

`README.md`、`AGENTS.md` 位于 `content/` 之外，不参与构建，不生成页面。`.vitepress/`、`node_modules/` 等目录同样不参与路由。

## 新增文档区的步骤

1. 创建目录 `content/<slug>/docs/zh-cn/`，并在其中放置 `index.md` 作为落地页。
2. 在 `projects.json` 中新增一条带 `slug` 链接的条目，`links` 如下：

    ```json
    {
      "links": [
        {
          "text": "在线阅读",
          "slug": "<slug>"
        }
      ]
    }
    ```

3. 侧边栏由目录扫描生成，新增目录后即出现，无须修改配置。

`dev` 与 `build` 在加载配置时校验 `slug` 与实际目录，两者不一致时产生错误并中断构建，站点不会在存在 404 链接的情况下上线。
