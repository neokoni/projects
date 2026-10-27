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
  <div class="mx-auto max-w-[1152px] px-5 pb-[72px] pt-2 sm:px-6 sm:pb-24">
    <header class="relative pt-10">
      <h1 class="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[40px]">{{ title }}</h1>
      <p v-if="description" class="mt-3.5 max-w-[62ch] text-[15px] leading-[1.7] text-[var(--vp-c-text-2)] sm:text-base">
        {{ description }}
      </p>
      <p v-if="home" class="mt-[18px] text-[13px]">
        <a class="text-[var(--vp-c-brand-1)] hover:text-[var(--vp-c-brand-2)]" :href="home">← 返回项目列表</a>
      </p>
    </header>

    <main class="mt-8 flex flex-col gap-8 sm:mt-11 sm:gap-11">
      <section v-for="section in sections" :key="section.title">
        <div class="border-b border-[var(--vp-c-divider)] pb-3">
          <h2 class="text-[15px] font-semibold text-[var(--vp-c-text-1)]">{{ section.title }}</h2>
          <p v-if="section.desc" class="mt-1 text-[13px] text-[var(--vp-c-text-3)]">{{ section.desc }}</p>
        </div>
        <div class="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          <a
            v-for="item in section.items"
            :key="item.link"
            class="group/docs flex flex-col gap-1.5 rounded-xl border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] px-5 py-[18px] shadow-[var(--vp-shadow-1)] transition-[border-color,background-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--vp-c-brand-1)] hover:shadow-[var(--vp-shadow-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vp-c-brand-1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            :href="item.link"
          >
            <span class="flex items-center justify-between gap-3">
              <span class="text-[15px] font-semibold text-[var(--vp-c-text-1)]">{{ item.text }}</span>
              <span
                class="text-[14px] leading-6 text-[var(--vp-c-text-3)] transition-[color,translate] duration-200 group-hover/docs:translate-x-0.5 group-hover/docs:text-[var(--vp-c-brand-1)] motion-reduce:transition-none motion-reduce:group-hover/docs:translate-x-0"
                aria-hidden="true"
                >→</span
              >
            </span>
            <span v-if="item.desc" class="text-[13px] leading-[1.65] text-[var(--vp-c-text-2)]">{{ item.desc }}</span>
          </a>
        </div>
      </section>
    </main>
  </div>
</template>
