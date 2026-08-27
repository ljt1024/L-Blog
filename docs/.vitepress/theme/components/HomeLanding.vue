<script setup>
import { ArrowRight, ArrowUpRight, BookOpen, Code2, Database, Server, Wrench } from 'lucide-vue-next'
const tracks = [
  { icon: Code2, title: '前端开发', meta: '12 个主题', link: '/study/front-end/html-basic' },
  { icon: Server, title: '服务端开发', meta: '14 个主题', link: '/study/back-end/nodejs-basics' },
  { icon: Database, title: '数据与存储', meta: '8 个主题', link: '/study/back-end/mysql-basics' },
  { icon: Wrench, title: '工具与交付', meta: '6 个主题', link: '/study/tools-deploy/git-guide' }
]
const articles = [
  { category: 'React', title: 'React 19 Hooks 实战指南', link: '/articles/react-19-hooks-practical-guide' },
  { category: 'Architecture', title: 'AI Agent 应用架构', link: '/articles/ai-agent-architecture' },
  { category: 'Performance', title: '浏览器渲染性能深度解析', link: '/articles/browser-rendering-performance' },
  { category: 'CSS', title: 'CSS Container Queries 完整指南', link: '/articles/css-container-queries-complete-guide' }
]
</script>
<template>
  <main class="home-landing">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero__copy">
        <p class="home-eyebrow"><span class="home-eyebrow__mark">L</span> L-BLOG</p>
        <h1 id="home-title">前端开发、AI<br /><span>与工程实践学习博客</span></h1>
        <div class="home-hero__actions"><a class="home-button home-button--primary" href="/study/index"><BookOpen :size="17" aria-hidden="true" />开始学习<ArrowRight :size="17" aria-hidden="true" /></a><a class="home-button home-button--secondary" href="/articles">浏览文章<ArrowUpRight :size="17" aria-hidden="true" /></a></div>
      </div>
      <aside class="home-hero__aside" aria-label="博客概览"><span class="home-hero__aside-label">L-BLOG</span><div class="home-hero__index"><span>文章</span><strong>100+</strong></div><div class="home-hero__index"><span>分类</span><strong>04</strong></div></aside>
    </section>
    <section class="home-section" aria-labelledby="tracks-title"><header class="home-section__header"><div><span class="home-section__kicker">学习记录</span><h2 id="tracks-title">学习分类</h2></div></header><div class="track-grid"><a v-for="track in tracks" :key="track.title" class="track-item" :href="track.link"><span class="track-item__number">{{ String(tracks.indexOf(track) + 1).padStart(2, '0') }}</span><component :is="track.icon" :size="19" stroke-width="1.6" aria-hidden="true" /><div class="track-item__copy"><h3>{{ track.title }}</h3><span>{{ track.meta }}</span></div><ArrowUpRight class="track-item__arrow" :size="17" aria-hidden="true" /></a></div></section>
    <section class="home-section home-section--articles" aria-labelledby="articles-title"><header class="home-section__header"><div><span class="home-section__kicker">文章</span><h2 id="articles-title">最近更新</h2></div><a class="home-text-link" href="/articles">查看全部 <ArrowRight :size="16" aria-hidden="true" /></a></header><div class="article-list"><a v-for="article in articles" :key="article.link" class="article-row" :href="article.link"><span class="article-row__category">{{ article.category }}</span><span class="article-row__body"><strong>{{ article.title }}</strong></span><ArrowUpRight :size="18" aria-hidden="true" /></a></div></section>
  </main>
</template>
