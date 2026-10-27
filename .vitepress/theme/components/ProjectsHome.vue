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
  <div class="mx-auto max-w-[1152px] px-5 pb-[72px] pt-2 sm:px-6 sm:pb-24">
    <header class="pb-2 pt-9 sm:pt-14">
      <h1 class="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[40px]">
        {{ data.site.headline ?? data.site.title }}
      </h1>
      <p class="mt-3.5 max-w-[62ch] text-[15px] leading-[1.7] text-[var(--vp-c-text-2)] sm:text-base">
        {{ data.site.description }}
      </p>
    </header>

    <main id="projects" class="mt-8 flex flex-col gap-8 sm:mt-11 sm:gap-11">
      <section v-for="group in groups" :key="group.id">
        <div class="border-b border-[var(--vp-c-divider)] pb-3">
          <h2 class="text-[15px] font-semibold text-[var(--vp-c-text-1)]">{{ group.title }}</h2>
        </div>
        <div class="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(272px,1fr))]">
          <ProjectCard v-for="project in group.items" :key="project.name" :project="project" />
        </div>
      </section>
    </main>
  </div>
</template>
