<script setup lang="ts">
interface DocLink {
  text: string
  link: string
  desc?: string
}

interface DocSection {
  title: string
  desc?: string
  items: DocLink[]
}

withDefaults(
  defineProps<{
    title: string
    description?: string
    sections: DocSection[]
    home?: string
  }>(),
  { home: '/' }
)
</script>

<template>
  <div class="nk-home nk-docs-home">
    <header class="nk-hero nk-hero--compact">
      <h1>{{ title }}</h1>
      <p v-if="description" class="nk-lede">{{ description }}</p>
      <p v-if="home" class="nk-meta">
        <a class="nk-back" :href="home">← 返回项目列表</a>
      </p>
    </header>

    <main class="nk-groups">
      <section v-for="section in sections" :key="section.title" class="nk-group">
        <div class="nk-group-head">
          <h2>{{ section.title }}</h2>
          <p v-if="section.desc">{{ section.desc }}</p>
        </div>
        <div class="nk-grid nk-grid--docs">
          <a v-for="item in section.items" :key="item.link" class="nk-card nk-card--link" :href="item.link">
            <span class="nk-card-top">
              <span class="nk-card-name">{{ item.text }}</span>
              <span class="nk-arrow" aria-hidden="true">→</span>
            </span>
            <span v-if="item.desc" class="nk-card-desc">{{ item.desc }}</span>
          </a>
        </div>
      </section>
    </main>
  </div>
</template>
