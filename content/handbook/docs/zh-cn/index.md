---
layout: page
---

<DocsHome
  title="项目手册"
  description="本站点的使用说明，涵盖文档存放位置、侧边栏生成方式与上线流程。新增项目时按本手册所列各节执行。"
  :sections="[
    {
      title: '开始',
      items: [
        { text: '目录结构', link: '/handbook/docs/zh-cn/guide/structure', desc: '内容目录、URL 与项目之间的对应关系' },
        { text: '写作约定', link: '/handbook/docs/zh-cn/guide/writing', desc: '侧边栏生成、排序与链接的写法约定' },
        { text: '部署', link: '/handbook/docs/zh-cn/guide/deploy', desc: 'GitHub Actions 与 1Panel 的部署配合方式' }
      ]
    },
    {
      title: '参考',
      items: [{ text: '站点配置', link: '/handbook/docs/zh-cn/reference/config', desc: 'projects.json 字段说明与 VitePress 开关' }]
    }
  ]"
/>
