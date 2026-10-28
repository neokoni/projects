<script setup lang="ts">
import { withBase } from 'vitepress'
import { onMounted, ref } from 'vue'

// The server answers unknown paths with this file, so the requested path is
// only known in the browser.
const requested = ref('')

onMounted(() => {
  const path = decodeURI(location.pathname)
  if (path !== '/404' && path !== '/404.html') requested.value = path
})
</script>

<template>
  <div class="mx-auto max-w-[1152px] px-5 pb-[72px] pt-2 sm:px-6 sm:pb-24">
    <header class="pb-2 pt-9 sm:pt-14">
      <span
        class="inline-flex items-center rounded-full bg-[var(--vp-c-brand-soft)] px-2 py-0.5 text-[11px] font-medium leading-[1.65] text-[var(--vp-c-brand-1)]"
        >404</span
      >

      <h1 class="mt-3 text-[30px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[40px]">
        页面不存在
      </h1>

      <p class="mt-3.5 max-w-[62ch] text-[15px] leading-[1.7] text-[var(--vp-c-text-2)] sm:text-base">
        这个地址没有对应的页面。可能是链接过期、拼写有误，或者内容已经挪到别处。
      </p>

      <p v-if="requested" class="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--vp-c-text-3)]">
        请求的路径
        <code
          class="rounded-[5px] bg-[var(--vp-c-default-soft)] px-1.25 py-0.5 font-mono text-[12px] leading-[1.65] text-[var(--vp-c-text-2)]"
          >{{ requested }}</code
        >
      </p>

      <div class="mt-10 flex flex-wrap items-center gap-2">
        <a
          class="group/link inline-flex items-center gap-1 rounded-lg bg-[var(--vp-c-default-soft)] px-2.5 py-1 text-[12px] font-medium leading-6 text-[var(--vp-c-text-2)] transition-[background-color,color] duration-200 hover:bg-[var(--vp-c-brand-soft)] hover:text-[var(--vp-c-brand-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vp-c-brand-1)] motion-reduce:transition-none"
          :href="withBase('/')"
        >
          回到首页
          <span
            class="inline-block transition-[translate] duration-200 group-hover/link:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/link:translate-x-0"
            aria-hidden="true"
            >→</span
          >
        </a>
      </div>
    </header>
  </div>
</template>
