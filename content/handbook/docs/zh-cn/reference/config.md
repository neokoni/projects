---
order: 1
---

# 站点配置

## projects.json

`projects.json` 为唯一的项目数据源。主页卡片与导航数据均取自该文件，组件中不硬编码项目列表。

```json
{
  "name": "项目名",
  "description": "一句话说明",
  "group": "services | projects | other",
  "links": [
    {
      "text": "官网",
      "href": "https://example.com/"
    },
    {
      "text": "文档",
      "slug": "handbook"
    }
  ],
  "tags": ["可选"]
}
```

每条 `links` 仅接受 `slug` 与 `href` 之一：`slug` 指向站内文档区，取值须与 `content/<slug>/` 一致；`href` 为完整 `http(s)` 地址。

卡片渲染方式由 `links` 的条数决定。

| `links` 条数 | 渲染结果 |
| --- | --- |
| 1 条 | 整张卡片为链接，点击任意位置即可进入；外部链接自动设置 `target="_blank"` |
| 多条 | 卡片本身不可点，卡内按入口数量渲染按钮，每个入口对应一个按钮 |

校验在配置加载时执行，`dev` 与 `build` 均会触发，出错时将中断并列出全部问题，而非仅报告第一条。

## 关键配置项

| 配置项 | 取值 | 作用 |
| --- | --- | --- |
| `srcDir` | `content` | URL 与目录一一对应，`README.md` 等文件不进入站点 |
| `cleanUrls` | `true` | 线上地址不带 `.html` 后缀 |
| `outDir` | `dist` | 部署脚本仅需上传一个目录 |
| `sidebar` | 由目录扫描生成 | 新增项目时不需要修改配置 |
| `search` | `local` | 全站搜索，可跨项目搜索 |
| `titleTemplate` | `false` | 页面标题不拼接站点名 |

## 样式

组件样式由模板中的 Tailwind 工具类承担，不存在独立的组件样式表。尺寸写在类名中。

| 位置 | 类名 | 作用 |
| --- | --- | --- |
| 卡片宽度 | `sm:max-w-[380px]` | 单卡宽度上限，大屏下不拉伸为通栏 |
| 项目网格 | `sm:grid-cols-[repeat(auto-fill,minmax(272px,1fr))]` | 最小列宽决定列数 |
| 文档网格 | `sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]` | 文档卡片宽度小于项目卡片 |

建议使用 `--vp-c-*` 与 `--vp-button-*` 变量取值，亮色与暗色将自动跟随；不建议写死色值。

`.vitepress/theme/styles/` 下仅有两个文件：

- `tailwind.css`：引入 Tailwind，不启用 preflight。VitePress 自带基础样式，preflight 的重置规则将与其冲突。utilities 不放入 `@layer`：VitePress 的样式未分层，分层规则的优先级低于未分层规则，`main { display: block }` 一类普通规则将覆盖 `.flex`。
- `overrides.css`：仅存放覆盖 VitePress 自身样式的规则。

导航栏在所有页面均为同一条通栏。在含侧边栏的页面上，VitePress 默认以侧边栏覆盖导航栏左半部分，导航栏呈现左灰右白的拼接。

`overrides.css` 将 `has-sidebar` 的透明背景改为 `--vp-nav-bg-color`，使侧边栏自导航栏下方开始。

调整导航相关样式时不得删除上述规则。
