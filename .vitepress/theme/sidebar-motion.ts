/**
 * VitePress collapses a sidebar group with `display: none`, so the class flip
 * cannot be animated in CSS. Re-apply the height as an explicit animation
 * around the flip: measure the list, animate to the target height, then hand
 * the element back to the stylesheet.
 */
const DURATION = 200
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

function itemsOf(item: Element): HTMLElement | null {
  for (const child of Array.from(item.children)) {
    if (child.classList.contains('items')) return child as HTMLElement
  }
  return null
}

function animate(list: HTMLElement, collapsing: boolean): void {
  list.getAnimations().forEach((animation) => animation.cancel())

  list.style.display = 'block'
  list.style.overflow = 'hidden'

  const full = list.getBoundingClientRect().height
  if (!full) {
    list.style.display = ''
    list.style.overflow = ''
    return
  }

  // Collapsing only shrinks; expanding also fades in, so a group never pops
  // into place. The fade is part of this animation rather than a CSS one: a
  // keyframe animation would restart when the element becomes visible again.
  const motion = list.animate(
    collapsing
      ? [{ height: `${full}px` }, { height: '0px' }]
      : [
          { height: '0px', opacity: 0 },
          { height: `${full}px`, opacity: 1 }
        ],
    { duration: DURATION, easing: EASING }
  )

  const release = () => {
    list.style.display = ''
    list.style.overflow = ''
  }

  motion.onfinish = release
  motion.oncancel = release
}

export function observeSidebarMotion(): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const item = record.target as HTMLElement
      if (!item.classList?.contains('VPSidebarItem')) continue

      const wasCollapsed = (record.oldValue ?? '').split(/\s+/).includes('collapsed')
      const isCollapsed = item.classList.contains('collapsed')
      if (wasCollapsed === isCollapsed) continue

      const list = itemsOf(item)
      if (list) animate(list, isCollapsed)
    }
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
    subtree: true
  })

  return () => observer.disconnect()
}
