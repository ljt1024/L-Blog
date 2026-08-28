<script setup>
import { ArrowRight, ArrowUpRight, BookOpen, Code2, Database, Server, Wrench } from 'lucide-vue-next'

const articles = [
  { category: 'AI & LLM', title: 'AI Agent 架构模式深度解析', excerpt: '从单体智能到多智能体协作，整理规划、记忆与工具调用的工程边界。', meta: '12 分钟 · 3 天前', link: '/articles/agentic-ai-architecture-patterns' },
  { category: 'React', title: 'React 19 Hooks 实战指南', excerpt: '理解 use()、useOptimistic 等新能力，结合真实交互场景做出稳定决策。', meta: '15 分钟 · 5 天前', link: '/articles/react-19-hooks-practical-guide' },
  { category: 'Performance', title: '浏览器渲染性能监控', excerpt: '围绕 LCP、INP、CLS 和长任务，建立可观测、可回溯的性能体系。', meta: '18 分钟 · 1 周前', link: '/articles/frontend-performance-monitoring' },
  { category: 'CSS', title: 'CSS Container Queries 完全指南', excerpt: '让组件根据容器上下文自适应，写出真正可复用的响应式布局。', meta: '10 分钟 · 1 周前', link: '/articles/css-container-queries-complete-guide' }
]

const tracks = [
  { icon: Code2, title: '前端开发', count: '32 篇', link: '/study/front-end/html-basic' },
  { icon: Server, title: '服务端开发', count: '28 篇', link: '/study/back-end/nodejs-basics' },
  { icon: Database, title: '数据与存储', count: '12 篇', link: '/study/back-end/mysql-basics' },
  { icon: Wrench, title: '工具与部署', count: '10 篇', link: '/study/tools-deploy/git-guide' }
]
</script>

<template>
  <main class="simple-home">
    <section class="simple-home__intro" aria-labelledby="simple-home-title">
      <p class="simple-home__eyebrow"><span>L</span> L-BLOG</p>
      <h1 id="simple-home-title">记录技术，<em>持续构建。</em></h1>
      <p class="simple-home__lead">前端开发、AI 与工程实践学习博客。把复杂问题整理成清晰、可复用的知识。</p>
      <div class="simple-home__actions">
        <a href="/study/front-end/html-basic" class="simple-button simple-button--solid"><BookOpen :size="16" aria-hidden="true" />开始学习</a>
        <a href="/articles" class="simple-button"><span>浏览文章</span><ArrowUpRight :size="16" aria-hidden="true" /></a>
      </div>
    </section>

    <div class="simple-home__grid">
      <section aria-labelledby="simple-articles-title">
        <div class="simple-section-head"><div><span>RECENT NOTES</span><h2 id="simple-articles-title">最近文章</h2></div><a href="/articles">查看全部 <ArrowRight :size="15" aria-hidden="true" /></a></div>
        <div class="simple-article-list">
          <a v-for="article in articles" :key="article.link" :href="article.link" class="simple-article">
            <div><div class="simple-article__meta"><b>{{ article.category }}</b><span>{{ article.meta }}</span></div><h3>{{ article.title }}</h3><p>{{ article.excerpt }}</p></div>
            <ArrowUpRight :size="17" aria-hidden="true" />
          </a>
        </div>
      </section>

      <aside class="simple-home__aside" aria-labelledby="simple-tracks-title">
        <div class="simple-section-head"><div><span>LEARNING PATHS</span><h2 id="simple-tracks-title">学习分类</h2></div></div>
        <div class="simple-track-list">
          <a v-for="track in tracks" :key="track.title" :href="track.link"><component :is="track.icon" :size="17" aria-hidden="true" /><span>{{ track.title }}</span><small>{{ track.count }}</small></a>
        </div>
        <p class="simple-home__note">持续更新中 · 专注于真实工程实践</p>
      </aside>
    </div>
  </main>
</template>
