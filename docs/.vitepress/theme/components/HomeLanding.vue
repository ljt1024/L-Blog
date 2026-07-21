<script setup>
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  BrainCircuit,
  Code2,
  Database,
  Feather,
  ServerCog,
} from 'lucide-vue-next'
import inkLandscape from '../assets/ink-landscape-fan.jpg'

const tracks = [
  {
    number: '01',
    icon: Code2,
    title: '前端工程',
    description: '从浏览器基础到 Vue、React 与现代工程化。',
    meta: 'HTML / CSS / JavaScript / TypeScript',
    link: '/study/front-end/html-basic'
  },
  {
    number: '02',
    icon: ServerCog,
    title: '服务端开发',
    description: '建立从接口设计到服务部署的完整链路。',
    meta: 'Node.js / Go / Gin / Nginx',
    link: '/study/back-end/nodejs-basics'
  },
  {
    number: '03',
    icon: Database,
    title: '数据与存储',
    description: '理解关系型数据库、文档数据库与缓存系统。',
    meta: 'MySQL / MongoDB / Redis',
    link: '/study/back-end/mysql-basics'
  },
  {
    number: '04',
    icon: Boxes,
    title: '工程交付',
    description: '把开发工具、容器与部署流程沉淀为方法。',
    meta: 'Git / Docker / PM2 / CI',
    link: '/study/tools-deploy/git-guide'
  }
]

const articles = [
  {
    category: 'React',
    title: 'React 19 Hooks 实战指南',
    summary: '从新的异步状态模型出发，理解 Action、useActionState 与 useOptimistic。',
    link: '/articles/react-19-hooks-practical-guide'
  },
  {
    category: 'Architecture',
    title: 'AI Agent 应用架构',
    summary: '拆解智能体系统中的模型、工具、记忆与任务编排。',
    link: '/articles/ai-agent-architecture'
  },
  {
    category: 'Performance',
    title: '浏览器渲染性能深度解析',
    summary: '沿着像素生成路径定位布局、绘制与合成阶段的性能问题。',
    link: '/articles/browser-rendering-performance'
  },
  {
    category: 'CSS',
    title: 'CSS Container Queries 完整指南',
    summary: '让组件依据自身容器响应，而不是继续依赖页面断点。',
    link: '/articles/css-container-queries-complete-guide'
  }
]
</script>

<template>
  <main class="home-landing">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero__copy">
        <div class="home-eyebrow" data-motion="eyebrow">
          <Feather :size="16" aria-hidden="true" />
          <span>墨迹 · 技术学习笔记</span>
          <span class="home-eyebrow__status">岁次丙午</span>
        </div>

        <h1 id="home-title" data-motion="headline">
          学而时习之，<br />
          <span>笔墨记所思。</span>
        </h1>

        <p class="home-hero__lead" data-motion="lead">
          一卷长期生长的开发者书稿。以现代工程为题，以清晰求知为旨，记录前端、服务端、AI 与交付实践。
        </p>

        <div class="home-hero__actions" data-motion="actions">
          <a class="home-button home-button--primary" href="/study/index">
            <BookOpen :size="18" aria-hidden="true" />
            开始学习
            <ArrowRight :size="17" aria-hidden="true" />
          </a>
          <a class="home-button home-button--secondary" href="/articles">
            浏览文章
            <ArrowUpRight :size="17" aria-hidden="true" />
          </a>
        </div>
      </div>

      <figure class="ink-visual" data-motion="index">
        <div class="ink-visual__frame">
          <img :src="inkLandscape" alt="王廷儒十九世纪山水扇面局部" />
          <span class="ink-seal" aria-hidden="true">墨<br />迹</span>
        </div>
        <figcaption>
          <span>山水 · 王廷儒</span>
          <span>十九世纪 · 大都会艺术博物馆藏</span>
        </figcaption>
      </figure>

      <div class="home-hero__rule" aria-hidden="true"></div>
    </section>

    <section class="home-section" aria-labelledby="tracks-title">
      <header class="home-section__header" data-reveal>
        <div>
          <span class="home-section__kicker">卷一 · 学习路径</span>
          <h2 id="tracks-title">循四径，见技术全貌</h2>
        </div>
        <p>从基础概念到工程实践，按主题进入，也可以随时交叉查阅。</p>
      </header>

      <div class="track-list">
        <a
          v-for="track in tracks"
          :key="track.number"
          class="track-row"
          :href="track.link"
          data-reveal
        >
          <span class="track-row__number">{{ track.number }}</span>
          <span class="track-row__icon"><component :is="track.icon" :size="21" /></span>
          <span class="track-row__content">
            <strong>{{ track.title }}</strong>
            <span>{{ track.description }}</span>
          </span>
          <span class="track-row__meta">{{ track.meta }}</span>
          <ArrowUpRight class="track-row__arrow" :size="19" aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="home-section home-section--articles" aria-labelledby="articles-title">
      <header class="home-section__header" data-reveal>
        <div>
          <span class="home-section__kicker">卷二 · 近作</span>
          <h2 id="articles-title">新近所记</h2>
        </div>
        <a class="home-text-link" href="/articles">
          全部文章 <ArrowRight :size="16" aria-hidden="true" />
        </a>
      </header>

      <div class="article-list">
        <a
          v-for="(article, index) in articles"
          :key="article.link"
          class="article-row"
          :href="article.link"
          data-reveal
        >
          <span class="article-row__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="article-row__body">
            <small>{{ article.category }}</small>
            <strong>{{ article.title }}</strong>
            <span>{{ article.summary }}</span>
          </span>
          <ArrowUpRight :size="20" aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="home-closing" data-reveal>
      <BrainCircuit :size="30" aria-hidden="true" />
      <div>
        <span>案头工具</span>
        <h2>问其所以然，再带回代码里。</h2>
      </div>
      <a href="http://118.31.167.0:3000/ai" target="_blank" rel="noreferrer">
        打开 AI 工具 <ArrowUpRight :size="18" aria-hidden="true" />
      </a>
    </section>
  </main>
</template>
