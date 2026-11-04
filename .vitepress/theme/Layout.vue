<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useData } from 'vitepress'
import NotFoundPage from './components/NotFoundPage.vue'
import { observeSidebarMotion } from './sidebar-motion'

const { Layout } = DefaultTheme

const { page, site } = useData()

// The docs area is Chinese only, so the language menu would lead to a missing
// page there. Pages listed by the config are the ones with a counterpart.
const showLangSwitch = computed(() => {
  const pages = (site.value.themeConfig as { localizedPages?: string[] }).localizedPages ?? []
  return pages.includes(page.value.relativePath)
})

let stop: (() => void) | undefined

onMounted(() => {
  stop = observeSidebarMotion()
})

onBeforeUnmount(() => stop?.())
</script>

<template>
  <Layout>
    <template #not-found>
      <NotFoundPage />
    </template>
  </Layout>
  <component is="style" v-if="!showLangSwitch">
    .VPNavBarTranslations, .VPNavScreenTranslations { display: none !important; }
  </component>
</template>
