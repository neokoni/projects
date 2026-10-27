<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  project: {
    name: string
    description?: string
    type: 'docs' | 'external'
    slug?: string
    href?: string
    tags?: string[]
  }
  lang?: string
}>()

const isExternal = computed(() => props.project.type === 'external')
const href = computed(() =>
  isExternal.value ? (props.project.href ?? '#') : `/${props.project.slug}/docs/${props.lang ?? 'zh-cn'}/`
)
</script>

<template>
  <a
    class="nk-card"
    :href="href"
    :target="isExternal ? '_blank' : undefined"
    :rel="isExternal ? 'noopener noreferrer' : undefined"
  >
    <span class="nk-card-top">
      <span class="nk-card-name">{{ project.name }}</span>
      <span class="nk-arrow" aria-hidden="true">{{ isExternal ? '↗' : '→' }}</span>
    </span>
    <span v-if="project.description" class="nk-card-desc">{{ project.description }}</span>
    <span class="nk-card-foot">
      <span class="nk-kind" :class="isExternal ? 'is-external' : 'is-internal'">
        {{ isExternal ? '外部站点' : '站内文档' }}
      </span>
      <span v-for="tag in project.tags" :key="tag" class="nk-tag">{{ tag }}</span>
      <span v-if="isExternal" class="nk-sr">（在新标签页打开）</span>
    </span>
  </a>
</template>
