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
</script>

<template>
  <div class="nk-card">
    <a
      v-if="single"
      class="nk-card-hit"
      :href="primary.href"
      :target="primary.external ? '_blank' : undefined"
      :rel="primary.external ? 'noopener noreferrer' : undefined"
    >
      <span class="nk-sr">{{ project.name }}</span>
    </a>

    <span class="nk-card-top">
      <span class="nk-card-name">{{ project.name }}</span>
      <span v-if="single" class="nk-arrow" aria-hidden="true">{{ primary.external ? '↗' : '→' }}</span>
    </span>

    <span v-if="project.description" class="nk-card-desc">{{ project.description }}</span>

    <span v-if="single || project.tags?.length" class="nk-card-foot">
      <span v-if="single" class="nk-kind" :class="primary.external ? 'is-external' : 'is-internal'">
        {{ primary.external ? '外部站点' : '站内文档' }}
      </span>
      <span v-for="tag in project.tags" :key="tag" class="nk-tag">{{ tag }}</span>
    </span>

    <span v-if="!single" class="nk-card-links">
      <a
        v-for="link in resolved"
        :key="link.href"
        class="nk-link"
        :class="link.external ? 'is-external' : 'is-internal'"
        :href="link.href"
        :target="link.external ? '_blank' : undefined"
        :rel="link.external ? 'noopener noreferrer' : undefined"
      >
        {{ link.text }}<span class="nk-link-icon" aria-hidden="true">{{ link.external ? '↗' : '→' }}</span>
      </a>
    </span>
  </div>
</template>
