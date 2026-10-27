---
layout: page
---

<DocsHome
  title="项目手册"
  description="这个站点自身的使用说明：文档放哪里、侧边栏怎么生成、改完怎么上线。要加新项目时，照着这里做一遍即可。"
  :sections="[
    {
      title: '开始',
      items: [
        { text: '目录结构', link: '/handbook/docs/zh-cn/guide/structure', desc: '内容目录、URL 与项目的对应关系' },
        { text: '写作约定', link: '/handbook/docs/zh-cn/guide/writing', desc: '侧边栏、标题与链接写法' },
        { text: '部署', link: '/handbook/docs/zh-cn/guide/deploy', desc: 'GitHub Actions 与 1Panel 的配合' }
      ]
    },
    {
      title: '参考',
      items: [{ text: '站点配置', link: '/handbook/docs/zh-cn/reference/config', desc: 'projects.json 字段与 VitePress 开关' }]
    }
  ]"
/>
