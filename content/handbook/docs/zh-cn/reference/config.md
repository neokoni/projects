---
order: 1
---

# 站点配置

## projects.json

唯一的项目数据源。主页卡片、导航数据全部来自它，组件里不写死任何项目。

```json
{
  "name": "项目名",
  "description": "一句话说明",
  "group": "apps | docs | lab",
  "type": "docs | external",
  "slug": "仅 type=docs 需要，必须与 content/<slug>/ 一致",
  "href": "仅 type=external 需要，完整 http(s) 地址",
  "tags": ["可选"]
}
```

校验在配置加载时执行，`dev` 和 `build` 都会跑，出错直接中断并列出所有问题（而不是只报第一条）。

## 关键开关

| 配置 | 值 | 为什么 |
| --- | --- | --- |
| `srcDir` | `content` | 让 URL 与目录一一对应，同时把 `README.md` 等排除在站点外 |
| `cleanUrls` | `true` | 线上地址没有 `.html` 后缀 |
| `outDir` | `dist` | 部署脚本只需上传一个目录 |
| `sidebar` | 由目录扫描生成 | 加项目不用改配置 |
| `search` | `local` | 全站搜索，跨项目也能搜到 |
| `titleTemplate` | `false` | 主页不想要「标题 - 站点名」的重复 |

## 样式

卡片与网格的尺寸都在 `.vitepress/theme/styles/theme.css` 的 `.nk-home` 里：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `--nk-card-max` | `380px` | 单卡宽度上限，避免大屏被拉成通栏 |
| `--nk-grid-min` | `272px` | 最小列宽，决定几列 |

颜色一律走 VitePress 的 `--vp-c-*` 变量，亮色/暗色自动跟随，不要写死色值。

导航栏在所有页面是同一条通栏。VitePress 默认会在有侧边栏的页面上，用侧边栏的「帘子」盖住导航栏左半边，形成左灰右白的拼接；`theme.css` 末尾把 `has-sidebar` 的透明背景改回 `--vp-nav-bg-color`，让侧边栏从导航栏下方开始。改导航相关样式时别把那段删掉。
