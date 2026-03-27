<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { useRouter } from 'vitepress'

const { Layout } = DefaultTheme
const { page, frontmatter } = useData()
const router = useRouter()

const isStudyPage = computed(() => page.value.relativePath.startsWith('study/'))
const isArticlePage = computed(() => page.value.relativePath.startsWith('articles/'))
const showBackButton = computed(() => isStudyPage.value || isArticlePage.value)
const backText = computed(() => (isStudyPage.value ? '返回学习目录' : '返回文章列表'))

const goBack = () => {
  if (frontmatter.value.backLink) {
    router.go(frontmatter.value.backLink)
    return
  }

  if (isStudyPage.value) {
    router.go('/study/')
    return
  }

  if (isArticlePage.value) {
    router.go('/articles/')
    return
  }

  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back()
    return
  }

  router.go('/')
}
</script>

<template>
  <Layout>
    <template #doc-before>
      <div v-if="showBackButton" class="back-button-container">
        <button type="button" @click="goBack" class="back-button">
          <span class="back-button-kicker">目录</span>
          <span class="back-button-text">{{ backText }}</span>
        </button>
      </div>
    </template>
    <template #layout-bottom>
      <BackToTop />
    </template>
  </Layout>
</template>

<style scoped>
.back-button-container {
  margin-bottom: 24px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.78rem;
  padding: 0.76rem 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.back-button:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-2);
}

.back-button-kicker {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.back-button-text {
  font-size: 0.94rem;
  font-weight: 600;
}

@media (min-width: 768px) {
  .back-button-text {
    font-size: 0.96rem;
  }
}

@media (max-width: 768px) {
  .back-button {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
