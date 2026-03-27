<template>
  <transition name="fade">
    <button
      v-show="visible"
      type="button"
      class="back-to-top"
      @click="scrollToTop"
      aria-label="返回顶部"
    >
      <span class="back-to-top-text">TOP</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    </button>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
const threshold = 360

const handleScroll = () => {
  visible.value = window.scrollY > threshold
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.back-to-top {
  position: fixed;
  right: clamp(16px, 2.6vw, 28px);
  bottom: max(18px, env(safe-area-inset-bottom));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.72rem 0.86rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  backdrop-filter: blur(18px);
  cursor: pointer;
  box-shadow: var(--vp-shadow-2);
  z-index: 90;
  transition: opacity 0.25s ease, transform 0.25s ease, border-color 0.25s ease,
    background-color 0.25s ease, box-shadow 0.25s ease;
}

.back-to-top:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  box-shadow: var(--vp-shadow-3);
}

.back-to-top-text {
  font-family: var(--vp-font-family-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.back-to-top svg {
  width: 18px;
  height: 18px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .back-to-top {
    padding: 0.7rem 0.76rem;
  }

  .back-to-top-text {
    display: none;
  }
}
</style>
