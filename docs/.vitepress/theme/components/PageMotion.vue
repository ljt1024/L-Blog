<script setup>
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

let gsap
let ScrollTrigger
let animationContext
let mediaContext
let routeRun = 0

const resetMotion = () => {
  mediaContext?.revert()
  animationContext?.revert()
  mediaContext = undefined
  animationContext = undefined
}

const animateCurrentPage = async () => {
  const currentRun = ++routeRun
  resetMotion()
  await nextTick()

  if (currentRun !== routeRun) return

  const scope = document.querySelector('.VPContent')
  if (!scope) return

  animationContext = gsap.context(() => {
    mediaContext = gsap.matchMedia()

    mediaContext.add('(prefers-reduced-motion: no-preference)', () => {
      const hero = scope.querySelector('.home-hero')

      if (hero) {
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        const eyebrow = hero.querySelector('[data-motion="eyebrow"]')
        const headline = hero.querySelector('[data-motion="headline"]')
        const lead = hero.querySelector('[data-motion="lead"]')
        const actions = hero.querySelector('[data-motion="actions"]')
        const index = hero.querySelector('[data-motion="index"]')
        const rule = hero.querySelector('.home-hero__rule')
        const inkImage = hero.querySelector('.ink-visual img')
        const seal = hero.querySelector('.ink-seal')

        intro
          .from(eyebrow, {
            y: 12,
            autoAlpha: 0,
            duration: 0.42,
            clearProps: 'transform,opacity,visibility'
          })
          .from(headline, {
            y: 34,
            autoAlpha: 0,
            duration: 0.72,
            clearProps: 'transform,opacity,visibility'
          }, '-=0.18')
          .from([lead, actions], {
            y: 18,
            autoAlpha: 0,
            duration: 0.5,
            stagger: 0.09,
            clearProps: 'transform,opacity,visibility'
          }, '-=0.4')
          .from(index, {
            x: 26,
            autoAlpha: 0,
            duration: 0.62,
            clearProps: 'transform,opacity,visibility'
          }, '-=0.52')
          .from([inkImage, seal], {
            scale: 1.04,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.1,
            clearProps: 'transform,opacity,visibility'
          }, '-=0.38')
          .fromTo(rule, { scaleX: 0 }, {
            scaleX: 1,
            duration: 0.72,
            transformOrigin: 'left center',
            clearProps: 'transform'
          }, '-=0.46')

        if (window.matchMedia('(min-width: 961px)').matches) {
          gsap.to(inkImage, {
            yPercent: -5,
            scale: 1.035,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: 0.6
            }
          })
        }
      }

      const revealGroups = [
        scope.querySelectorAll('[data-reveal]'),
        scope.querySelectorAll('.vp-doc > h2, .vp-doc > h3, .vp-doc > div[class*="language-"], .vp-doc > table, .vp-doc > .custom-block')
      ]

      revealGroups.forEach((elements) => {
        if (!elements.length) return

        gsap.set(elements, { y: 24, autoAlpha: 0 })
        ScrollTrigger.batch(elements, {
          start: 'top 88%',
          once: true,
          interval: 0.08,
          batchMax: 4,
          onEnter: (batch) => {
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.62,
              ease: 'power3.out',
              stagger: 0.08,
              overwrite: 'auto',
              clearProps: 'transform,opacity,visibility'
            })
          }
        })
      })

      const progress = document.querySelector('.reading-progress')
      if (progress) {
        gsap.fromTo(progress, { scaleX: 0 }, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            start: 0,
            end: 'max',
            scrub: 0.15
          }
        })
      }

      requestAnimationFrame(() => ScrollTrigger.refresh())
    })
  }, scope)
}

onMounted(async () => {
  const [gsapModule, scrollTriggerModule] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger')
  ])

  gsap = gsapModule.gsap
  ScrollTrigger = scrollTriggerModule.ScrollTrigger
  gsap.registerPlugin(ScrollTrigger)

  await animateCurrentPage()
})

watch(
  () => route.path,
  () => {
    if (gsap) animateCurrentPage()
  },
  { flush: 'post' }
)

onUnmounted(() => {
  routeRun += 1
  resetMotion()
})
</script>

<template>
  <span class="reading-progress" aria-hidden="true"></span>
</template>
