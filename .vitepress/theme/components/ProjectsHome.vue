<script setup lang="ts">
import { computed } from 'vue'
import ProjectCard from './ProjectCard.vue'

interface CardLink {
  text: string
  slug?: string
  href?: string
}

interface Project {
  name: string
  description?: string
  group: string
  tags?: string[]
  links: CardLink[]
}

const props = defineProps<{
  data: {
    site: { title: string; description: string; eyebrow?: string }
    groups: { id: string; title: string; description?: string }[]
    projects: Project[]
  }
}>()

const groups = computed(() =>
  props.data.groups
    .map((group) => ({ ...group, items: props.data.projects.filter((project) => project.group === group.id) }))
    .filter((group) => group.items.length > 0)
)

const links = computed(() => props.data.projects.flatMap((project) => project.links))
const docsCount = computed(() => links.value.filter((link) => link.slug).length)
const externalCount = computed(() => links.value.filter((link) => link.href).length)
</script>

<template>
  <div class="nk-home">
    <header class="nk-hero">
      <p v-if="data.site.eyebrow" class="nk-eyebrow">{{ data.site.eyebrow }}</p>
      <h1>{{ data.site.title }}</h1>
      <p class="nk-lede">{{ data.site.description }}</p>
      <p class="nk-meta">
        <span>{{ data.projects.length }} 个项目</span>
        <span class="nk-dot" aria-hidden="true">·</span>
        <span>{{ docsCount }} 个站内文档</span>
        <span class="nk-dot" aria-hidden="true">·</span>
        <span>{{ externalCount }} 个外部入口</span>
      </p>
    </header>

    <main id="projects" class="nk-groups">
      <section v-for="group in groups" :key="group.id" class="nk-group">
        <div class="nk-group-head">
          <h2>{{ group.title }}</h2>
          <p v-if="group.description">{{ group.description }}</p>
        </div>
        <div class="nk-grid">
          <ProjectCard v-for="project in group.items" :key="project.name" :project="project" />
        </div>
      </section>
    </main>
  </div>
</template>
