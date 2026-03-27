---
layout: home

hero:
  name: "l-blog"
  text: "学习笔记"
  tagline: 记录前端、后端、AI 与交付过程中的长期积累，整理成可反复查阅的知识库。
  actions:
    - theme: brand
      text: 开始学习
      link: /study/index
    - theme: alt
      text: 技术文章
      link: /articles

features:
  - icon: "FE"
    title: 前端体系
    details: 从基础语言到框架与工程化，持续整理前端开发中最常用也最容易踩坑的知识点。
    link: /study/front-end/html-basic
    linkText: 查看详情
  - icon: "BE"
    title: 服务与数据
    details: 围绕 Node.js、Go、数据库与接口设计，补齐从业务逻辑到服务落地的完整链路。
    link: /study/back-end/nodejs-basics
    linkText: 查看详情
  - icon: "OPS"
    title: 工程交付
    details: 把 Git、Docker、Nginx、部署与效率工具串起来，形成真正可复用的交付流程。
    link: /study/tools-deploy/git-guide
    linkText: 查看详情
---

<div class="home-content">
  <section class="home-panel span-2">
    <h2>关于这个博客</h2>
    <p>
      我是一名前端开发者，正在系统化提升工程能力。这个博客用来记录学习路径、拆解技术问题，并沉淀可复用的实践经验。
      我希望每一篇内容都能回答一个具体问题，帮助自己和读者少走弯路。
    </p>
  </section>

  <section class="home-panel">
    <h2>技术栈</h2>
    <ul class="tech-stack-list">
      <li><strong>Frontend</strong>HTML/CSS/JavaScript · Vue · React · TypeScript</li>
      <li><strong>Backend</strong>Node.js · Express · Go · Gin · Nginx</li>
      <li><strong>Database</strong>MySQL · MongoDB · Redis</li>
      <li><strong>Tooling</strong>Git · Docker · PM2 · Vite · Webpack</li>
    </ul>
  </section>

  <section class="home-panel">
    <h2>博客内容方向</h2>
    <ul class="focus-list">
      <li>从基础到进阶的知识体系化整理</li>
      <li>前后端联动的项目实践与工程化经验</li>
      <li>AI 与前端结合的落地方案与踩坑记录</li>
      <li>可直接复用的开发工具与部署流程</li>
    </ul>
  </section>

  <section class="home-panel span-2">
    <h2>快速开始</h2>
    <div class="quick-entry-grid">
      <a class="quick-entry-card" href="/study/index">
        <strong>学习记录</strong>
        <span>按知识模块系统化学习，建立完整技术地图。</span>
      </a>
      <a class="quick-entry-card" href="/articles">
        <strong>技术文章</strong>
        <span>聚焦实战问题，沉淀可直接参考的解决方案。</span>
      </a>
      <a class="quick-entry-card" href="http://118.31.167.0:3000/ai" target="_blank" rel="noreferrer">
        <strong>AI 工具</strong>
        <span>进入日常开发辅助页，做问答、调试和效率增强。</span>
      </a>
    </div>
  </section>
</div>
