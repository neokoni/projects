import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type DefaultTheme } from 'vitepress'

const root = fileURLToPath(new URL('..', import.meta.url))
const contentDir = join(root, 'content')
const distDir = join(root, 'dist')
const LANG = 'zh-cn'

const data = JSON.parse(readFileSync(join(root, 'projects.json'), 'utf8'))

/* ---------- data validation: fails dev and build on bad entries ---------- */

const groupIds = new Set(data.groups.map((group) => group.id))
const problems = []

if (!data.site.headline_en) problems.push('site: missing headline_en')
if (!data.site.description_en) problems.push('site: missing description_en')

for (const group of data.groups) {
  if (!group.title_en) problems.push(`group "${group.id}": missing title_en`)
}

for (const project of data.projects) {
  const at = `project "${project.name ?? '(unnamed)'}"`
  if (!project.name) problems.push(`${at}: missing name`)
  if (!project.name_en) problems.push(`${at}: missing name_en`)
  if (project.description && !project.description_en) problems.push(`${at}: missing description_en`)
  if (project.tags && !Array.isArray(project.tags_en)) problems.push(`${at}: tags need a matching tags_en array`)
  if (!groupIds.has(project.group)) problems.push(`${at}: unknown group "${project.group}"`)
  if (!Array.isArray(project.links) || project.links.length === 0) {
    problems.push(`${at}: links must be a non-empty array`)
    continue
  }
  for (const link of project.links) {
    const where = `${at}: link "${link.text ?? '?'}"`
    if (!link.text) problems.push(`${at}: every link needs text`)
    if (!link.text_en) problems.push(`${where}: missing text_en`)
    if (link.slug && link.href) problems.push(`${where} cannot have both slug and href`)
    if (!link.slug && !link.href) problems.push(`${where} needs slug or href`)
    if (link.slug && !existsSync(join(contentDir, link.slug, 'docs', LANG))) {
      problems.push(`${where}: content/${link.slug}/docs/${LANG}/ does not exist`)
    }
    if (link.href && !/^https?:\/\//.test(link.href)) problems.push(`${where}: href must be http(s)`)
  }
}

if (problems.length) throw new Error(`projects.json is invalid:\n  - ${problems.join('\n  - ')}`)

/* ---------- sidebar generated from the content tree ---------- */

function heading(file) {
  return readFileSync(file, 'utf8').match(/^#\s+(.+)$/m)?.[1]?.trim()
}

// `order` in frontmatter sorts siblings; ties fall back to the file name.
function readOrder(file) {
  if (!existsSync(file)) return Number.POSITIVE_INFINITY
  const block = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const value = block?.[1].match(/^order:\s*(-?\d+)\s*$/m)
  return value ? Number(value[1]) : Number.POSITIVE_INFINITY
}

function sortRels(dir, rels) {
  return rels
    .map((rel) => ({ rel, order: readOrder(join(dir, rel)) }))
    .sort((a, b) => a.order - b.order || a.rel.localeCompare(b.rel))
    .map((item) => item.rel)
}

function pageLink(slug, rel) {
  const path = rel.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
  return `/${slug}/docs/${LANG}/${path}`
}

function pageItem(slug, dir, rel) {
  return { text: heading(join(dir, rel)) ?? basename(rel, '.md'), link: pageLink(slug, rel) }
}

function walk(dir, prefix = '') {
  const found = []
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), rel))
    else if (entry.name.endsWith('.md')) found.push(rel)
  }
  return found
}

function buildSidebar(slug) {
  const dir = join(contentDir, slug, 'docs', LANG)
  if (!existsSync(dir)) return null

  const files = walk(dir)
  const loose = sortRels(dir, files.filter((rel) => !rel.includes('/') && rel !== 'index.md')).map((rel) =>
    pageItem(slug, dir, rel)
  )

  // The docs area's own index.md is otherwise unreachable from the sidebar: it
  // is not an item and there is no group around it. List it first instead.
  const overview = existsSync(join(dir, 'index.md'))
    ? [{ text: '概览', link: pageLink(slug, 'index.md') }]
    : []

  const groups = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const prefix = `${entry.name}/`
      const indexRel = `${prefix}index.md`
      const hasIndex = existsSync(join(dir, indexRel))
      const items = sortRels(dir, files.filter((rel) => rel.startsWith(prefix) && rel !== indexRel))
      return {
        order: readOrder(join(dir, indexRel)),
        group: {
          text: hasIndex ? (heading(join(dir, indexRel)) ?? entry.name) : entry.name,
          ...(hasIndex ? { link: pageLink(slug, indexRel) } : {}),
          collapsed: false,
          items: items.map((rel) => pageItem(slug, dir, rel))
        }
      }
    })
    .filter((entry) => entry.group.items.length > 0 || entry.group.link)
    .sort((a, b) => a.order - b.order || a.group.text.localeCompare(b.group.text))
    .map((entry) => entry.group)

  // Loose pages keep their own group; rename it so the two never share a title.
  const looseGroup = loose.length ? [{ text: overview.length ? '其他页面' : '概览', items: loose }] : []

  return [...overview, ...looseGroup, ...groups]
}

// Sidebar keys come from the content tree, not from projects.json: a docs area
// keeps its sidebar even while it is still unlisted on the homepage.
const sidebar = {}
for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const items = buildSidebar(entry.name)
  if (items?.length) sidebar[`/${entry.name}/docs/${LANG}/`] = items
}

/* ---------- pages that exist in both locales ---------- */

// The language switcher keeps the current path across locales, so it is only
// offered on pages whose counterpart really exists. The docs area is Chinese
// only, so those pages hide it.
function readLocalizedPages(): Set<string> {
  const pages = new Set<string>()
  for (const rel of walk(contentDir)) {
    const counterpart = rel.startsWith('en-us/') ? rel.slice('en-us/'.length) : `en-us/${rel}`
    if (existsSync(join(contentDir, counterpart))) pages.add(rel)
  }
  return pages
}

const localizedPages = readLocalizedPages()

/* ---------- site config ---------- */

const year = new Date().getFullYear()
const copyright = `© ${year} ${data.site.author ?? ''}`.trim()

const themeConfig: DefaultTheme.Config & { localizedPages?: string[] } = {
  siteTitle: data.site.title,
  nav: [{ text: '全部项目', link: '/' }],
  socialLinks: data.site.repo ? [{ icon: 'github', link: data.site.repo }] : [],
  sidebar,
  search: { provider: 'local' },
  outline: { level: [2, 3], label: '本页目录' },
  docFooter: { prev: '上一篇', next: '下一篇' },
  editLink: {
    pattern: `${data.site.repo}/edit/main/content/:path`,
    text: '在 GitHub 编辑此页'
  },
  footer: { message: '索引我维护的项目、服务与文档。', copyright },
  darkModeSwitchLabel: '外观',
  sidebarMenuLabel: '目录',
  returnToTopLabel: '回到顶部',
  langMenuLabel: '切换语言',
  // Read by Layout.vue: the language menu only shows on pages that exist in both locales.
  localizedPages: [...localizedPages]
}

export default defineConfig({
  lang: 'zh-CN',
  title: data.site.title,
  titleTemplate: false,
  description: data.site.description,
  srcDir: 'content',
  outDir: distDir,
  cleanUrls: true,
  sitemap: { hostname: data.site.url },

  vite: {
    plugins: [tailwindcss()]
  },

  // Every page carries its own canonical and og:url: cleanUrls drops the .html
  // suffix, and index pages resolve to their directory URL.
  transformHead({ page }) {
    const path = page.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
    const url = path ? `${data.site.url}/${path}` : `${data.site.url}/`
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }]
    ]
  },

  head: [
    ['link', { rel: 'icon', href: data.site.icon }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: data.site.title }],
    ['meta', { property: 'og:description', content: data.site.description }]
  ],

  locales: {
    root: { label: '简体中文', lang: 'zh-CN' },
    'en-us': {
      label: 'English',
      lang: 'en-US',
      link: '/en-us/',
      description: data.site.description_en,
      head: [
        ['meta', { property: 'og:description', content: data.site.description_en }],
        ['meta', { property: 'og:locale', content: 'en_US' }]
      ],
      themeConfig: {
        nav: [{ text: 'All projects', link: '/en-us/' }],
        footer: { message: 'An index of the projects, services and docs I maintain.', copyright },
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Contents',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language'
      }
    }
  },

  themeConfig
})
