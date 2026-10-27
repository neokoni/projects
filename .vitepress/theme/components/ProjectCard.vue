<script setup lang="ts">
import { computed } from 'vue'

interface CardLink {
  text: string
  slug?: string
  href?: string
}

const props = defineProps<{
  project: { name: string; description?: string; tags?: string[]; links: CardLink[] }
  lang?: string
}>()

const resolved = computed(() =>
  props.project.links.map((link) => ({
    text: link.text,
    external: Boolean(link.href),
    href: link.href ?? `/${link.slug}/docs/${props.lang ?? 'zh-cn'}/`
  }))
)

const single = computed(() => resolved.value.length === 1)
const primary = computed(() => resolved.value[0])

const liftOn =
  'has-[.nk-card-hit]:hover:-translate-y-0.5 has-[.nk-card-hit]:hover:border-[var(--vp-c-brand-1)] has-[.nk-card-hit]:hover:shadow-[var(--vp-shadow-2)]'

// Tailwind v4 moves elements with the `translate` property, so transitions
// have to name `translate` — `transform` would animate nothing.
const iconInternal = 'group-hover/link:translate-x-0.5 motion-reduce:group-hover/link:translate-x-0'
const iconExternal =
  'group-hover/link:translate-x-px group-hover/link:-translate-y-px motion-reduce:group-hover/link:translate-x-0 motion-reduce:group-hover/link:translate-y-0'
</script>

<template>
  <div
    class="group/card relative flex flex-col gap-2.5 rounded-xl border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] px-5 py-[18px] shadow-[var(--vp-shadow-1)] transition-[border-color,background-color,translate,box-shadow] duration-200 max-sm:max-w-none sm:max-w-[380px] motion-reduce:transition-none"
    :class="single ? liftOn : ''"
  >
    <a
      v-if="single"
      class="nk-card-hit absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vp-c-brand-1)]"
      :href="primary.href"
      :target="primary.external ? '_blank' : undefined"
      :rel="primary.external ? 'noopener noreferrer' : undefined"
    >
      <span class="sr-only">{{ project.name }}</span>
    </a>

    <span class="flex items-center justify-between gap-3">
      <span class="text-[15px] font-semibold leading-6 text-[var(--vp-c-text-1)]">{{ project.name }}</span>
      <span
        v-if="single"
        class="text-[14px] leading-6 text-[var(--vp-c-text-3)] transition-[color,translate] duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-[var(--vp-c-brand-1)] motion-reduce:transition-none motion-reduce:group-hover/card:translate-x-0"
        aria-hidden="true"
        >{{ primary.external ? '↗' : '→' }}</span
      >
    </span>

    <span v-if="project.description" class="text-[13px] leading-[1.65] text-[var(--vp-c-text-2)]">
      {{ project.description }}
    </span>

    <span v-if="single || project.tags?.length" class="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
      <span
        v-if="single"
        class="rounded-full px-2 py-0.5 text-[11px] font-medium leading-[1.65]"
        :class="
          primary.external
            ? 'bg-[var(--vp-c-default-soft)] text-[var(--vp-c-text-2)]'
            : 'bg-[var(--vp-c-brand-soft)] text-[var(--vp-c-brand-1)]'
        "
      >
        {{ primary.external ? '外部站点' : '站内文档' }}
      </span>
      <span v-for="tag in project.tags" :key="tag" class="text-[11px] text-[var(--vp-c-text-3)]">{{ tag }}</span>
    </span>

    <span v-if="!single" class="mt-auto flex flex-wrap gap-2 pt-1">
      <a
        v-for="link in resolved"
        :key="link.href"
        class="group/link inline-flex items-center gap-1 rounded-lg bg-[var(--vp-c-default-soft)] px-2.5 py-1 text-[12px] font-medium leading-6 text-[var(--vp-c-text-2)] transition-[background-color,color] duration-200 hover:bg-[var(--vp-c-brand-soft)] hover:text-[var(--vp-c-brand-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vp-c-brand-1)] motion-reduce:transition-none"
        :href="link.href"
        :target="link.external ? '_blank' : undefined"
        :rel="link.external ? 'noopener noreferrer' : undefined"
      >
        {{ link.text }}
        <span
          class="inline-block transition-[translate] duration-200 motion-reduce:transition-none"
          :class="link.external ? iconExternal : iconInternal"
          aria-hidden="true"
          >{{ link.external ? '↗' : '→' }}</span
        >
      </a>
    </span>
  </div>
</template>
