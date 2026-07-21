---
title: CSS Container Queries 深度解析：组件级响应式，告别"视口依赖症"
date: 2026-04-24
---

# CSS Container Queries 深度解析：组件级响应式，告别"视口依赖症"

> Media Queries 让页面响应视口宽度，Container Queries 让组件响应**自身容器**的宽度。这一字之差，彻底改变了组件化开发的方式。

本文由小虾子  撰写

## 为什么需要 Container Queries？

### Media Queries 的根本局限

传统响应式设计依赖 `@media`，但它只能感知**视口**，不能感知**组件所在容器**：

```css
/* 问题：同一个卡片组件，在侧边栏和主内容区宽度不同 */
/* 但 @media 只知道视口宽度，不知道卡片的父容器有多宽 */
@media (min-width: 768px) {
  .card { display: flex; }  /* 视口 768px 时变横排 */
}
```

```html
<!-- 侧边栏里的卡片：父容器只有 240px，但视口是 1200px -->
<!-- @media (min-width: 768px) 会触发，卡片被强制横排 → 挤爆了 -->
<aside style="width: 240px">
  <Card />
</aside>

<!-- 主内容区的卡片：父容器有 800px，完全可以横排 -->
<main style="width: 800px">
  <Card />
</main>
```

这就是"视口依赖症"：组件的样式由视口决定，而不是由它实际可用的空间决定。

### Container Queries 的解法

```css
/* 声明容器 */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* 响应容器宽度，而不是视口宽度 */
@container card (min-width: 400px) {
  .card { display: flex; }  /* 容器 ≥ 400px 时横排 */
}
```

现在无论卡片放在侧边栏还是主内容区，它都根据**自己的容器**来决定布局——真正的组件级响应式。

---

## 核心语法

### 1. 声明容器：`container-type`

```css
/* inline-size：响应内联轴（通常是宽度）*/
.wrapper {
  container-type: inline-size;
}

/* size：同时响应宽度和高度 */
.wrapper {
  container-type: size;
}

/* normal：不参与尺寸查询，但可以用 style 查询 */
.wrapper {
  container-type: normal;
}
```

### 2. 命名容器：`container-name`

```css
/* 简写形式 */
.sidebar {
  container: sidebar / inline-size;
  /* 等价于 */
  container-name: sidebar;
  container-type: inline-size;
}

.main-content {
  container: main / inline-size;
}
```

命名容器的好处：嵌套时可以精确指定查询哪一层容器。

### 3. 查询语法：`@container`

```css
/* 查询最近的 inline-size 容器 */
@container (min-width: 400px) {
  .card { flex-direction: row; }
}

/* 查询指定名称的容器 */
@container sidebar (max-width: 300px) {
  .nav-item { font-size: 0.875rem; }
}

/* 范围语法（现代写法，更直观）*/
@container (200px <= width <= 600px) {
  .card { grid-template-columns: 1fr 1fr; }
}

/* 逻辑组合 */
@container (min-width: 400px) and (max-height: 600px) {
  .card { padding: 1rem; }
}
```

---

## 实战示例

### 自适应卡片组件

```css
/* 容器声明 */
.card-container {
  container-type: inline-size;
}

/* 基础样式（窄容器） */
.card {
  display: grid;
  grid-template-areas:
    "image"
    "content";
  gap: 1rem;
  padding: 1rem;
}

.card__image {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
}

.card__title { font-size: 1rem; }
.card__desc  { display: none; }  /* 窄容器隐藏描述 */

/* 中等容器：横排 + 显示描述 */
@container (min-width: 400px) {
  .card {
    grid-template-areas: "image content";
    grid-template-columns: 160px 1fr;
    align-items: start;
  }

  .card__image {
    width: 160px;
    aspect-ratio: 1;
  }

  .card__desc { display: block; }
}

/* 宽容器：更大图片 + 更多信息 */
@container (min-width: 640px) {
  .card {
    grid-template-columns: 240px 1fr;
    padding: 1.5rem;
    gap: 1.5rem;
  }

  .card__image { width: 240px; }
  .card__title { font-size: 1.25rem; }
}
```

```html
<!-- 同一个组件，放在不同容器里自动适配 -->
<aside class="sidebar">           <!-- 240px 宽 -->
  <div class="card-container">
    <article class="card">...</article>   <!-- 竖排，无描述 -->
  </div>
</aside>

<main class="content">            <!-- 800px 宽 -->
  <div class="card-container">
    <article class="card">...</article>   <!-- 横排，有描述，大图 -->
  </div>
</main>
```

### 响应式导航菜单

```css
.nav-wrapper {
  container-type: inline-size;
}

/* 窄容器：汉堡菜单 */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav__links { display: none; }
.nav__hamburger { display: block; }

/* 宽容器：展开导航 */
@container (min-width: 600px) {
  .nav__links {
    display: flex;
    gap: 2rem;
    list-style: none;
  }

  .nav__hamburger { display: none; }
}
```

### 数据表格自适应

```css
.table-wrapper {
  container-type: inline-size;
}

/* 窄容器：卡片式布局 */
.data-table {
  display: grid;
  gap: 1rem;
}

.data-row {
  display: grid;
  grid-template-columns: 1fr;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.data-row__label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
}

/* 宽容器：传统表格布局 */
@container (min-width: 640px) {
  .data-table {
    display: table;
    width: 100%;
    border-collapse: collapse;
  }

  .data-row {
    display: table-row;
    border: none;
    border-radius: 0;
    padding: 0;
  }

  .data-row__label { display: none; }  /* 表头代替 label */

  .data-cell {
    display: table-cell;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
  }
}
```

---

## Container Style Queries（样式查询）

除了尺寸查询，Container Queries 还支持**样式查询**——根据 CSS 自定义属性的值来切换样式：

```css
/* 声明样式容器（container-type: normal 即可） */
.theme-wrapper {
  container-type: normal;
  container-name: theme;
}

/* 根据自定义属性值切换主题 */
@container theme style(--color-scheme: dark) {
  .card {
    background: #1f2937;
    color: #f9fafb;
    border-color: #374151;
  }
}

@container theme style(--color-scheme: light) {
  .card {
    background: #ffffff;
    color: #111827;
    border-color: #e5e7eb;
  }
}
```

```html
<!-- 通过 CSS 变量控制主题，无需 JS -->
<div class="theme-wrapper" style="--color-scheme: dark">
  <div class="card">深色主题卡片</div>
</div>

<div class="theme-wrapper" style="--color-scheme: light">
  <div class="card">浅色主题卡片</div>
</div>
```

这让**主题切换**可以完全在 CSS 层完成，不需要 JS 切换 class。

---

## 在 React / Vue 中的最佳实践

### React 组件封装

```tsx
// components/ResponsiveCard.tsx
// 组件内部声明容器，外部无需关心
function ResponsiveCard({ title, description, image }: CardProps) {
  return (
    // 容器声明在组件根元素上
    <div className="card-container">
      <article className="card">
        <img className="card__image" src={image} alt={title} />
        <div className="card__content">
          <h2 className="card__title">{title}</h2>
          <p className="card__desc">{description}</p>
        </div>
      </article>
    </div>
  );
}
```

```css
/* 样式与组件绑定，完全自包含 */
.card-container {
  container-type: inline-size;
}

/* 组件内部的响应式逻辑，不依赖外部 */
@container (min-width: 400px) {
  .card { display: flex; }
}
```

### Tailwind CSS 4.x 支持

Tailwind 4.x 原生支持 Container Queries（通过 `@tailwindcss/container-queries` 插件或内置）：

```html
<!-- 声明容器 -->
<div class="@container">
  <!-- 响应容器宽度的子元素 -->
  <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
    <Card />
    <Card />
    <Card />
  </div>
</div>
```

```html
<!-- 命名容器 -->
<div class="@container/sidebar">
  <nav class="flex-col @sm/sidebar:flex-row">
    ...
  </nav>
</div>
```

---

## 浏览器支持与渐进增强

### 当前支持情况（2026）

| 浏览器 | 支持版本 | 备注 |
|--------|---------|------|
| Chrome | 105+ | 正确 完整支持 |
| Firefox | 110+ | 正确 完整支持 |
| Safari | 16+ | 正确 完整支持 |
| Edge | 105+ | 正确 完整支持 |

**全球覆盖率已超过 90%**，可以放心使用。

### 渐进增强写法

```css
/* 基础样式（所有浏览器） */
.card {
  display: block;
  padding: 1rem;
}

/* 支持 Container Queries 的浏览器增强 */
@supports (container-type: inline-size) {
  .card-wrapper {
    container-type: inline-size;
  }

  @container (min-width: 400px) {
    .card { display: flex; }
  }
}
```

---

## 与 Media Queries 的协作

Container Queries 不是替代 Media Queries，而是**互补**：

```css
/* Media Queries：控制页面级布局 */
@media (min-width: 1024px) {
  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;  /* 侧边栏 + 主内容 */
  }
}

/* Container Queries：控制组件级布局 */
.card-wrapper {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { display: flex; }  /* 卡片自适应容器 */
}
```

**分工原则：**
- `@media` → 页面骨架、断点布局、全局主题
- `@container` → 组件内部布局、组件级响应式

---

## 实践总结

### Container Queries 的核心价值

1. **真正的组件封装**：组件的响应式逻辑内聚在组件内部，不依赖外部视口
2. **复用性提升**：同一个组件放在任何容器里都能正确响应
3. **设计系统友好**：组件库可以提供真正自适应的组件，而不是"在 768px 视口下横排"

### 何时用 Container Queries？

- 正确 组件库 / 设计系统中的通用组件
- 正确 同一组件需要在不同宽度的容器中复用
- 正确 卡片、列表项、导航、表格等布局组件
- 正确 需要根据可用空间动态调整信息密度

### 何时继续用 Media Queries？

- 正确 页面级骨架布局（侧边栏 / 主内容区的切换）
- 正确 全局字体大小、间距系统
- 正确 打印样式
- 正确 需要感知设备特性（`prefers-color-scheme`、`prefers-reduced-motion`）

> **一句话总结：** Media Queries 管页面，Container Queries 管组件。两者各司其职，才是现代响应式设计的正确姿势。
