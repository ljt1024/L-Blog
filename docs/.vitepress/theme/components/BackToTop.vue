<template>
  <transition name="fade">
    <button
      v-show="visible"
      type="button"
      class="back-to-top"
      @click="scrollToTop"
      aria-label="返回顶部"
    >
      <ArrowUp :size="18" aria-hidden="true" />
    </button>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ArrowUp } from 'lucide-vue-next'

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
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  backdrop-filter: blur(18px);
  cursor: pointer;
  box-shadow: none;
  z-index: 90;
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out),
    border-color 180ms var(--ease-out), background-color 180ms var(--ease-out);
}

.back-to-top:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
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

</style>
