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
    site: { title: string; headline?: string; description: string }
    groups: { id: string; title: string }[]
    projects: Project[]
  }
}>()

const groups = computed(() =>
  props.data.groups
    .map((group) => ({ ...group, items: props.data.projects.filter((project) => project.group === group.id) }))
    .filter((group) => group.items.length > 0)
)
</script>

<template>
  <div class="nk-home">
    <header class="nk-hero">
      <h1>{{ data.site.headline ?? data.site.title }}</h1>
      <p class="nk-lede">{{ data.site.description }}</p>
    </header>

    <main id="projects" class="nk-groups">
      <section v-for="group in groups" :key="group.id" class="nk-group">
        <div class="nk-group-head">
          <h2>{{ group.title }}</h2>
        </div>
        <div class="nk-grid">
          <ProjectCard v-for="project in group.items" :key="project.name" :project="project" />
        </div>
      </section>
    </main>
  </div>
</template>
