<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { onBeforeUnmount, onMounted } from 'vue'
import NotFoundPage from './components/NotFoundPage.vue'
import { observeSidebarMotion } from './sidebar-motion'

const { Layout } = DefaultTheme

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
</template>
