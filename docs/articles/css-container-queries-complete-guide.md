# CSS Container Queries 完全指南：组件级响应式革命

> 媒体查询（Media Queries）让我们能根据视口宽度调整布局，但它的致命缺陷是：**组件不知道自己在什么容器里**。Container Queries 的出现彻底改变了这一切——组件终于可以真正做到"自适应自身容器"，而不是被视口尺寸绑架。

<!-- more -->

## 媒体查询的痛点

```html
<!-- 传统的媒体查询写法 -->
<div class="card">
  <img src="..." />
  <div class="content">
    <h3>标题</h3>
    <p>描述文字...</p>
  </div>
</div>
```

```css
/* 问题来了：这个 .card 组件，不知道自己会被放在什么容器里 */
@media (min-width: 768px) {
  /* 组件被迫以视口宽度为依据做判断 */
  /* 但同一个组件在侧边栏和主内容区时，宽度完全不同 */
  .card {
    flex-direction: row;
  }
}
```

在真实项目中，一个 `.card` 组件可能被用在：
- 首页大 Banner（宽度 100%）
- 侧边栏（宽度 300px）
- 网格布局（宽度 25%）

用媒体查询根本无法准确描述！

## Container Queries 登场

### 核心概念：建立容器

```css
/* 第一步：定义一个 containment 容器 */
.card-container {
  container-type: inline-size;  /* 或 size（同时限制宽高） */
  container-name: card;         /* 可选命名 */
}

/* 简写形式 */
.card-container {
  container: card / inline-size;
}
```

`container-type` 有三个值：

| 值 | 含义 | 使用场景 |
|---|------|---------|
| `inline-size` | 仅根据**行内方向**（水平方向）建立容器 | 绝大多数场景 正确 |
| `size` | 同时限制**行内 + 块级方向**（宽高都限制） | 复杂网格组件 |
| `normal` | 默认值，不建立容器 | 清除容器 |

### 第二步：查询容器

```css
/* 查询名为 card 的容器宽度 */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}

/* 简写形式（查询最近父容器） */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

### 完整示例：响应式卡片组件

```html
<article class="card">
  <figure class="card__image">
    <img src="https://picsum.photos/600/400" alt="风景" />
  </figure>
  <div class="card__body">
    <h2 class="card__title">日本京都深度游</h2>
    <p class="card__desc">探索千年古都的禅意之美，从伏见稻荷大社到岚山竹林，感受传统与现代的完美融合。</p>
    <button class="card__btn">查看详情</button>
  </div>
</article>
```

```css
/* 建立容器 */
.card {
  container-type: inline-size;
  container-name: card-wrap;
}

/* 默认状态（窄容器） */
.card__body {
  padding: 1rem;
}

.card__title {
  font-size: 1.125rem;  /* 18px */
  margin-bottom: 0.5rem;
}

.card__desc {
  font-size: 0.875rem;  /* 14px */
  -webkit-line-clamp: 2;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__btn {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.875rem;
}

/* 容器宽度 ≥ 400px 时 */
@container card-wrap (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 160px 1fr;
  }

  .card__body {
    padding: 1.5rem;
  }

  .card__title {
    font-size: 1.5rem;  /* 24px */
    margin-bottom: 0.75rem;
  }

  .card__desc {
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }

  .card__btn {
    width: auto;
    align-self: end;
    padding: 0.625rem 1.25rem;
  }
}

/* 容器宽度 ≥ 600px 时 */
@container card-wrap (min-width: 600px) {
  .card {
    grid-template-columns: 240px 1fr;
  }

  .card__title {
    font-size: 1.75rem;  /* 28px */
  }

  .card__btn {
    font-size: 1rem;
    padding: 0.75rem 1.5rem;
  }
}
```

## 容器样式查询（Container Style Queries）

这是 Container Queries 的进阶能力——可以**根据容器的样式值**而非尺寸来调整：

```css
/* 定义容器主题 */
.card-wrapper {
  container-type: inline-size;
  --theme: dark;
}

/* 根据容器主题样式查询 */
@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #f0f0f0;
  }
}

@container style(--theme: light) {
  .card {
    background: #ffffff;
    color: #1a1a2e;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
}
```

> 注意 目前浏览器支持度较低（Chrome 111+ 开始支持），属实验性功能，生产环境慎用。

## Container Queries 的实战场景

### 场景 1：产品卡片网格

```html
<!-- 三种使用场景，同一个 ProductCard 组件 -->
<section class="product-section">
  <div class="grid grid--full">
    <div class="product-wrapper"><ProductCard /></div>
  </div>
  <div class="grid grid--half">
    <div class="product-wrapper"><ProductCard /></div>
    <div class="product-wrapper"><ProductCard /></div>
  </div>
  <div class="grid grid--quarter">
    <div class="product-wrapper"><ProductCard /></div>
    <div class="product-wrapper"><ProductCard /></div>
    <div class="product-wrapper"><ProductCard /></div>
    <div class="product-wrapper"><ProductCard /></div>
  </div>
</section>
```

```css
.product-wrapper {
  container-type: inline-size;
  container-name: product;
}

.product-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

/* 默认（在小网格里） */
.product-card__image {
  aspect-ratio: 16/9;
}

.product-card__info {
  padding: 0.75rem;
}

/* 宽度 ≥ 200px */
@container product (min-width: 200px) {
  .product-card {
    display: flex;
    flex-direction: column;
  }
  .product-card__image {
    aspect-ratio: 4/3;
  }
}

/* 宽度 ≥ 300px（半网格场景） */
@container product (min-width: 300px) {
  .product-card {
    flex-direction: row;
  }
  .product-card__image {
    width: 120px;
    aspect-ratio: 1;
  }
  .product-card__info {
    flex: 1;
    padding: 1rem;
  }
}

/* 宽度 ≥ 500px（全宽场景） */
@container product (min-width: 500px) {
  .product-card {
    flex-direction: row;
    max-height: 200px;
  }
  .product-card__image {
    width: 280px;
    aspect-ratio: 16/9;
  }
  .product-card__info {
    padding: 1.5rem;
  }
}
```

### 场景 2：侧边栏组件

```html
<aside class="sidebar">
  <div class="sidebar__section">
    <h3>最近文章</h3>
    <!-- SidebarList 组件在窄容器里显示紧凑模式 -->
    <SidebarList :items="articles" />
  </div>
</aside>
```

```css
.sidebar__section {
  container-type: inline-size;
  container-name: sidebar;
}

.sidebar-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 默认紧凑模式（< 200px） */
.sidebar-list__item {
  padding: 0.5rem;
  font-size: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 宽松模式（≥ 200px） */
@container sidebar (min-width: 200px) {
  .sidebar-list__item {
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

/* 宽模式（≥ 300px，显示更多信息） */
@container sidebar (min-width: 300px) {
  .sidebar-list__item {
    flex-direction: column;
    align-items: flex-start;
    padding: 0.75rem;
  }
}
```

### 场景 3：嵌入任意位置的通用 Banner

```html
<!-- Header 里显示小 Banner -->
<header class="header">
  <Banner :type="promotion" />
</header>

<!-- 首页显示大 Banner -->
<section class="hero">
  <Banner :type="promotion" />
</section>

<!-- Modal 里显示迷你 Banner -->
<div class="modal">
  <Banner :type="promotion" :compact="true" />
</div>
```

```css
.banner-container {
  container-type: inline-size;
  container-name: banner;
}

.banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 默认迷你模式 */
.banner__icon { width: 24px; height: 24px; }
.banner__text { font-size: 0.75rem; }
.banner__btn { display: none; }

/* ≥ 200px */
@container banner (min-width: 200px) {
  .banner__btn {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    border-radius: 4px;
  }
}

/* ≥ 300px */
@container banner (min-width: 300px) {
  .banner {
    padding: 1.25rem;
  }
  .banner__icon { width: 32px; height: 32px; }
  .banner__text { font-size: 0.875rem; }
}

/* ≥ 600px（大 Banner） */
@container banner (min-width: 600px) {
  .banner {
    padding: 2rem;
    border-radius: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  .banner__icon { width: 48px; height: 48px; }
  .banner__title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .banner__text { font-size: 1rem; }
  .banner__btn {
    font-size: 0.875rem;
    padding: 0.625rem 1.5rem;
  }
}
```

## Container Queries 与媒体查询的配合

Container Queries 不是替代媒体查询，而是**互补**：

```css
/* 媒体查询：调整页面整体布局 */
@media (min-width: 768px) {
  .page-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
  }
}

/* Container Queries：让组件内部自我调整 */
.product-wrapper {
  container-type: inline-size;
}

/* 媒体查询和 Container Queries 可以嵌套使用 */
@media (min-width: 768px) {
  @container (min-width: 400px) {
    .product-card {
      /* 视口 ≥ 768px 且容器 ≥ 400px 时的样式 */
    }
  }
}
```

## 性能注意事项

```css
/* 正确 好的做法：明确容器名，避免过度嵌套 */
.card-container {
  container: card / inline-size;
}

/* 注意 注意：container-type: size 会创建新的堆叠上下文 */
.card-container {
  container-type: size; /* 可能影响内部 absolute 定位的元素的基准 */
}

/* 正确 大多数场景用 inline-size 即可 */
.card-container {
  container-type: inline-size;
}
```

### 性能优化技巧

```css
/* 1. 使用命名容器避免误匹配 */
@container card (min-width: 400px) {
  /* 只匹配 .card 的容器 */
}

/* 2. 避免过深的 @container 嵌套 */
@container outer (min-width: 800px) {
  @container inner (min-width: 400px) {
    /* 太深了，慎用 */
  }
}

/* 3. 合理设置断点，不要过于密集 */
@container (min-width: 320px) { }  /* 太细了 */
@container (min-width: 480px) { }  /* 太细了 */
@container (min-width: 600px) { }  /* 适度即可 */
```

## 浏览器支持情况

| 浏览器 | 支持版本 | 备注 |
|--------|---------|------|
| Chrome | 105+ | 正确 完整支持 |
| Edge | 105+ | 正确 完整支持 |
| Safari | 16+ | 正确 完整支持 |
| Firefox | 110+ | 正确 完整支持 |
| iOS Safari | 16+ | 正确 完整支持 |
| IE 11 | 错误 不支持 | 已废弃 |

> Container Queries 是现代 CSS 的基础能力，全球浏览器支持率已超过 **95%**，完全可以放心在生产环境使用。

## 总结

Container Queries 的出现，让"组件化响应式"真正成为可能：

1. **组件自治**：组件自己决定自己的样式，不依赖外部上下文
2. **复用性提升**：同一个组件可以在任何容器中呈现最佳效果
3. **设计系统友好**：设计系统的组件不再需要知道会被放在哪种布局里
4. **写法更直观**：用 `container-type` 建立容器，用 `@container` 查询，语义清晰

结合 CSS 变量、CSS Subgrid 等现代特性，CSS 的组件化能力已经到达了前所未有的高度。

*本文由小虾子  撰写*
