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
  "group": "services | projects | other",
  "links": [
    { "text": "官网", "href": "https://example.com/" },
    { "text": "文档", "slug": "handbook" }
  ],
  "tags": ["可选"]
}
```

每条 `links` 只能在 `slug` 与 `href` 里选一个：写 `slug` 表示站内文档区（必须与 `content/<slug>/` 一致），写 `href` 表示完整 `http(s)` 地址。

卡片怎么渲染由条数决定：

| `links` 条数 | 行为 |
| --- | --- |
| 1 条 | 整张卡片就是链接，点击任意位置进入；外链自动 `target="_blank"` |
| 多条 | 卡片本身不可点，卡内渲染按钮，每个入口一个 |

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

组件的样式就是模板里的 Tailwind 工具类，没有单独的组件样式表。尺寸直接写在类名上：

| 位置 | 类名 | 作用 |
| --- | --- | --- |
| 卡片宽度 | `sm:max-w-[380px]` | 单卡上限，避免大屏被拉成通栏 |
| 项目网格 | `sm:grid-cols-[repeat(auto-fill,minmax(272px,1fr))]` | 最小列宽决定几列 |
| 文档网格 | `sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]` | 文档卡片比项目卡片窄一档 |

颜色一律走 `--vp-c-*` 与 `--vp-button-*` 变量，亮色/暗色自动跟随，不要写死色值。

`.vitepress/theme/styles/` 下只有两个文件：

- `tailwind.css`：引入 Tailwind。不带 preflight——VitePress 有自己的基础样式，重置会互相打架；utilities 故意不放进 `@layer`，因为 VitePress 的样式是未分层的，分层规则永远输给它，`main { display: block }` 这类普通规则就会盖掉 `.flex`。
- `overrides.css`：只放覆盖 VitePress 自身的规则。

导航栏在所有页面是同一条通栏。VitePress 默认会在有侧边栏的页面上，用侧边栏的「帘子」盖住导航栏左半边，形成左灰右白的拼接；`overrides.css` 把 `has-sidebar` 的透明背景改回 `--vp-nav-bg-color`，让侧边栏从导航栏下方开始。改导航相关样式时别把那段删掉。
