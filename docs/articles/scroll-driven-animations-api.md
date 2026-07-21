---
title: Scroll-driven Animations API 深度解析：让滚动 control 动画
date: 2026-05-14
---

# Scroll-driven Animations API 深度解析：让滚动 control 动画

> 你有没有做过这种效果：页面滚动时，某个元素跟着滚动位置改变透明度、位移、或者颜色？以前这需要 JavaScript 监听 scroll 事件，频繁触发重排，性能还很差。Scroll-driven Animations API 的出现，让这类效果可以用 CSS 声明式完成——性能好、代码少、还不需要 JavaScript。

本文由小虾子  撰写

## 问题的本质：为什么 scroll + JS 很烂？

### 用 JavaScript 做滚动动画的问题

```javascript
// 传统的 scroll-linked 动画
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const progress = scrollY / (document.body.scrollHeight - window.innerHeight);

  // 每个 scroll 事件触发，可能每秒 60-144 次！
  element.style.opacity = progress;
  element.style.transform = `translateY(${scrollY * 0.5}px)`;
});
```

问题：
1. **主线程阻塞** - scroll 是主线程事件，JS 执行会阻塞滚动
2. **性能差** - 频繁触发布局/样式/绘制
3. **同步耦合** - 动画和滚动位置强绑定，很难做"非线性"动画
4. **很难精确** - 无法指定"从第 3 个 section 开始，到第 5 个 section 结束"

### Scroll-driven Animations 的解决方案

CSS 原生支持 scroll-linked 动画，动画运行在 ** compositor 线程**（GPU），不阻塞主线程：

```css
.progress-bar {
  /* 动画与滚动进度绑定 */
  animation-timeline: scroll();
  animation-name: grow-progress;
  animation-fill: both;
}

/* 等同于：scroll() 从根元素（html）读取滚动 */
```

```css
@keyframes grow-progress {
  from { width: 0; }
  to { width: 100%; }
}
```

不需要任何 JavaScript。

## 核心概念

### 1. animation-timeline

定义动画的时间轴来源：

```css
element {
  animation-timeline: scroll();           /* 滚动进度 */
  animation-timeline: view();          /* 视口可见性 */
  animation-timeline: view(auto);     /* 元素进入/离开视口 */
  animation-timeline: view(inline);    /* 水平滚动 */
  animation-timeline: view(block);   /* 垂直滚动（默认）*/
}
```

### 2. scroll() 范围

scroll timeline 的范围定义：

```css
/* scroll() —整个页面的滚动范围 */
animation-timeline: scroll(root);

/* scroll(nearest) —最近的可滚动祖先 */
animation-timeline: scroll(nearest);

/* scroll(root block) —根元素，垂直滚动（默认）*/
animation-timeline: scroll(root block);
```

### 3. view() 范围

view timeline 基于视口可见性：

```css
/* view() — 元素完全进入/离开视口 */
animation-timeline: view();

/* view(small) — 元素离视口还有 25% 时开始 */
/* view(medium) — 元素离视口还有 50% 时开始（默认）*/
/* view(large) — 元素离视口还有 100% 时开始 */

animation-timeline: view(small);

/* view() 还可以指定方向 */
animation-timeline: view(inline);     /* 进入/离开方向 */
animation-timeline: block;            /* 块方向 */
```

## 语法：简单但强大

### 最基础的例子

```css
/* 滚动时进度条自动伸展 */
.progress-bar {
  width: 0;
  background: linear-gradient(90deg, #667eea, #764ba2);

  /* 绑定到滚动时间轴 */
  animation-timeline: scroll();
  animation-name: grow;
  animation-duration: 1s;  /* 可以省略，时间轴自动决定 */
  animation-fill: both;
}

@keyframes grow {
  from { width: 0; }
  to { width: 100%; }
}
```

### view() 视口动画

```css
/* 元素进入视口时的动画 */
.fade-in {
  opacity: 0;
  transform: translateY(20px);

  animation-timeline: view();
  animation-name: fade-in;
  animation-fill: both;
}

@keyframes fade-in {
  /* 元素进入视口边缘时 */
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  /* 元素完全在视口中心 */
  25% {
    opacity: 1;
    transform: translateY(0);
  }
  /* 元素离开视口边缘后 */
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 更精细的控制 */
@keyframes fade-in-v2 {
  0% { opacity: 0; }
  50%, 100% { opacity: 1; }
}

/* 不同的区间映射 */
.fade-in-complex {
  animation-range: 0% 50%;  /* 动画在视口前 50% 区间完成 */
  animation-timeline: view();
  animation-name: fade-in-v2;
}
```

## 实战场景

### 场景 1：阅读进度条

```html
<header>
  <div class="progress-bar"></div>
</header>

<article>
  <h1>长文章标题</h1>
  <p>...很长很长的内容...</p>
</article>
```

```css
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  width: 0;
  transform-origin: left;

  animation-timeline: scroll();
  animation-name: read-progress;
  animation-fill: both;
}

@keyframes read-progress {
  from { width: 0; }
  to { width: 100%; }
}
```

### 场景 2：滚动时标题栏固定

```css
.sticky-header {
  position: sticky;
  top: 0;
  opacity: 0;

  animation-timeline: view();
  animation-range: exit-crossing 0%;
  animation-name: show-header;
}

@keyframes show-header {
  to {
    opacity: 1;
  }
}
```

### 场景 3：图片视差效果

```css
.parallax-image {
  animation-timeline: scroll();
  animation-name: parallax;
}

@keyframes parallax {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);  /* 移动速度是滚动的 2 倍 */
  }
}
```

更精细的视差：

```css
.parallax-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;

  animation-timeline: scroll();
  animation-name: bg-scroll;
}

@keyframes bg-scroll {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(50vh);  /* 背景移动速度是滚动的一半 */
  }
}
```

### 场景 4：目录自动高亮

```css
.toc a.active {
  color: #3b82f6;
  border-left-color: #3b82f6;
}

/* 滚动时自动高亮 */
.toc a {
  animation-timeline: view();
  animation-name: highlight-toc;
  animation-fill: backwards;
}

@keyframes highlight-toc {
  0%, 100% {
    color: inherit;
    border-left-color: transparent;
  }
  50% {
    color: #3b82f6;
    border-left-color: #3b82f6;
  }
}
```

### 场景 5：章节切换效果

```css
.section {
  min-height: 100vh;
  opacity: 0;
  transform: scale(0.95);

  animation-timeline: view();
  animation-range: entry 25%;
  animation-name: section-enter;
  animation-fill: both;
}

@keyframes section-enter {
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

## 与 JavaScript 方案对比

### 传统 Intersection Observer

```javascript
// 需要 JS + Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.section').forEach(section => {
  observer.observe(section);
});
```

### Scroll-driven Animations

```css
/* 纯 CSS */
.section {
  opacity: 0;
  transform: scale(0.95);

  animation-timeline: view();
  animation-range: entry 25%;
  animation-name: fade-in;
}

@keyframes fade-in {
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 性能���比

| 方案 | 主线程 | 执行时机 | 流畅度 |
|------|--------|----------|--------|
| scroll 事件 + JS | 错误 阻塞 | 实时 | 错误 差 |
| Intersection Observer | 错误 阻塞 | 阈值触发 | 注意 一般 |
| Scroll-driven Animations | 正确 GPU | compositor | 正确 好 |

## 与动画库的对比

```javascript
// GSAP ScrollTrigger
gsap.to('.progress', {
  scrollTrigger: {
    trigger: '.content',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
  },
  width: '100%',
});
```

### CSS Scroll-driven Animations

```css
.progress {
  width: 0;

  animation-timeline: scroll();
  animation-name: grow;
  animation-fill: both;
}

@keyframes grow {
  from { width: 0; }
  to { width: 100%; }
}
```

| 特性 | GSAP ScrollTrigger | Scroll-driven Animations |
|------|---------------------|--------------------------|
| 体积 | ~60KB | 0KB（浏览器原生） |
| 依赖 | 需要引入库 | 无 |
| 性能 | 好 | 非常好（GPU） |
| 精细控制 |  |  |
| 跨浏览器 |  |  |

## 浏览器支持

```
Chrome 115+    正确  (2023年7月)
Safari 17.5+   正确  (2024年5月)
Firefox     实验性（需要 flag）

Polyfill: chrome.com/s Scroll-driven Animations polyfill
```

### 检测支持

```javascript
// 检测是否支持
if (!CSS.supports('animation-timeline', 'scroll()')) {
  // 引入 polyfill 或降级 JS 方案
  import 'scroll-timeline-polyfill';
}
```

```css
/* CSS 降级 */
@supports (animation-timeline: scroll()) {
  .progress {
    animation-timeline: scroll();
  }
}

/* 不支持时用 JS */
@supports not (animation-timeline: scroll()) {
  .progress {
    /* JS 会添加这个类来做动画 */
  }
}
```

## animation-range 详解

animation-range 控制动画在滚动时间轴上的**哪个区间**执行：

```css
/* entry — 元素进入视口 */
animation-range: 0% 100%;  /* 整个视口范围 */

/* cover — 元素在视口内 */
animation-range: cover 0% cover 100%;

/* exit — 元素离开视口 */
animation-range: exit 0% exit 100%;

/* entry-crossing — 元素从视口上方穿到视口内 */
animation-range: entry-crossing 0% entry-crossing 100%;

/* exit-crossing — 元素从视口内穿到视口下方 */
animation-range: exit-crossing 0% exit-crossing 100%;

/* 数值自定义 */
animation-range: 0% 50%;  /* 滚动的前 50% */
animation-range: 25% 75%;  /* 滚动的中间 50% */
```

更精确的 range 控制：

```css
.specific {
  animation-timeline: view();

  /* 元素进入视口前 25% 开始，中心结束 */
  animation-range: entry 25%;

  /* 或者组合 */
  animation-range:
    entry 0% entry 25%,
    contain 25% contain 75%,
    exit 75% exit 100%;
}
```

## 组合效果

### 1. 滚动进度 + 视口动画

```css
.progress-bar {
  position: fixed;
  top: 0;
  height: 4px;
  background: #667eea;
  width: 0;

  animation-timeline: scroll();
  animation-name: show-progress;
  animation-fill: both;
}

@keyframes show-progress {
  from { width: 0; }
  to { width: 100%; }
}

/* 进入视口时稍微放大 */
.progress-bar:hover {
  animation-timeline: view();
  animation-name: scale-hover;
  animation-range: 0% 100%;
}

@keyframes scale-hover {
  50% { transform: scaleY(2); }
}
```

### 2. 多个时间轴组合

可以用不同的 timeline 实现复杂效果：

```css
.complex-animation {
  /* 默认绑定滚动 */
  animation-timeline: scroll();

  /* 用 view() 做另一个动画 */
  animation-composition: add;
}

.complex-animation {
  /* 需要两个动画 */
  animation:
    scroll-animation 1s linear both,
    view-animation 1s ease-in-out both;

  animation-timeline: scroll(), view();
}

@keyframes scroll-animation {
  from { transform: translateY(0); }
  to { transform: translateY(-100px); }
}

@keyframes view-animation {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## 实际项目案例

### 案例 1：Landing Page 动画

```css
.hero-title {
  opacity: 0;
  transform: translateY(30px);

  animation-timeline: view();
  animation-range: entry 50%;
  animation-name: hero-enter;
}

@keyframes hero-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 案例 2：图片懒加载效果

```css
img.lazy {
  opacity: 0;
  filter: blur(10px);

  animation-timeline: view();
  animation-range: entry 50%;
  animation-name: load-image;
}

@keyframes load-image {
  to {
    opacity: 1;
    filter: blur(0);
  }
}
```

### 3. 导航栏滚动效果

```css
nav {
  backdrop-filter: blur(0);

  animation-timeline: scroll();
  animation-name: nav-blur;
}

@keyframes nav-blur {
  from { backdrop-filter: blur(0); }
  to { backdrop-filter: blur(10px); }
}
```

## 总结

Scroll-driven Animations 是一个**性能优先**的解决方案：

- **零 JavaScript** - 纯 CSS 声明式
- **GPU 加速** - 动画不阻塞主线程
- **声明式** - 滚动位置即时间轴
- **view()** - 基于视口可见性的精细控制
- **animation-range** - ��确控制动画区间

典型的"滚动进度条"：

```css
.progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);

  animation-timeline: scroll();
  animation-name: grow;
  animation-fill: both;
}

@keyframes grow {
  from { width: 0; }
  to { width: 100%; }
}
```

这不到 20 行 CSS，替代了以前几十行 JavaScript。性能还更好。

本文由小虾子  撰写