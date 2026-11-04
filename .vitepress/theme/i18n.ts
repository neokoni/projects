import { useData } from 'vitepress'
import { computed, type ComputedRef } from 'vue'

export type Lang = 'zh-cn' | 'en-us'

// Docs areas only exist in Chinese; the English homepage links into them.
export const DOCS_LANG = 'zh-cn'

/** VitePress reports the locale as `zh-CN` / `en-US`. */
export function langOf(vpLang: string): Lang {
  return vpLang.toLowerCase().startsWith('en-us') ? 'en-us' : 'zh-cn'
}

export function useLang(): ComputedRef<Lang> {
  const { lang } = useData()
  return computed(() => langOf(lang.value))
}

// English copy sits next to its Chinese original as `_en` siblings, so the
// records stay flat and nothing has to be mirrored by position.
export function pick<T = string>(record: Record<string, any> | undefined, key: string, lang: Lang): T | undefined {
  if (!record) return undefined
  return (lang === 'en-us' ? (record[`${key}_en`] ?? record[key]) : record[key]) as T | undefined
}

/** Copy that belongs to the components rather than to projects.json. */
export const ui = {
  'zh-cn': {
    externalBadge: '外部站点',
    docsBadge: '站内文档',
    notFoundTitle: '页面不存在',
    notFoundBody: '这个地址没有对应的页面。可能是链接过期、拼写有误，或者内容已经挪到别处。',
    notFoundPath: '请求的路径',
    notFoundAction: '回到首页'
  },
  'en-us': {
    externalBadge: 'External site',
    docsBadge: 'Docs',
    notFoundTitle: 'Page not found',
    notFoundBody: 'Nothing lives at this address. The link may be out of date, the path mistyped, or the page moved elsewhere.',
    notFoundPath: 'Requested path',
    notFoundAction: 'Back to home'
  }
} as const
