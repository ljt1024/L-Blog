---
title: View Transitions API 深度解析：浏览器原生的页面过渡方案
date: 2026-06-16
---

# View Transitions API 深度解析：浏览器原生的页面过渡方案

> View Transitions API 是浏览器原生提供的页面过渡动画 API，最初 Chrome 实现用于 SPA 内部导航，后来扩展到支持跨文档过渡（MPA）。它让开发者无需 JavaScript 动画库，就能实现流畅的页面切换效果。本文系统解析 API 的设计理念、核心概念、语法用法，以及与 React框架、SPA/MPA 场景的集成方案。

本文由小虾子 🦐 撰写

## 为什么需要 View Transitions API？

### 传统 MPA 切换的痛点

```
传统多页应用（MPA）的页面切换：
─────────────────────────────────
❌ 白屏闪烁：点击链接 → 浏览器卸载旧文档 → 网络请求 → 加载新文档 → 白屏
❌ 无过渡动画：两个页面之间没有任何过渡效果
❌ 用户感知慢：即使页面内容已经加载，也要等到整个页面渲染完才有反馈
❌ 无法保留状态：切换页面后，前一个页面的滚动位置/表单内容完全丢失
```

```html
<!-- 传统 MPA：每个页面都是独立的 HTML 文档 -->
<!-- 点击 → 卸载 → 白屏 → 加载 → 渲染 -->
<a href="/about">关于</a>
<!-- 无法实现：滑入效果、交叉渐变、元素连续动画 -->
```

### View Transitions 的解决思路

```
View Transitions API 的核心理念：
─────────────────────────────────
1. 快照化过渡
   → 旧页面拍快照，新页面渲染后与快照做交叉动画
   → 消除白屏，保留视觉连续性

2. DOM 元素映射
   → 给需要连续性的元素打上 view-transition-name 标记
   → 这些元素在页面切换时自动产生位移/缩放动画

3. 完全浏览器原生
   → 零 JavaScript 依赖（不需要 GSAP / Framer Motion）
   → 浏览器内置合成器处理，性能极高
   → 自动处理 RAF、合成层、GPU 加速

4. MPA 支持（2024年后）
   → 不再局限于 SPA，任意页面间都可以过渡
```

---

## 基本概念

### 核心术语

```
View Transition 的四个阶段：
─────────────────────────────────
1. 旧状态快照（Old State Snapshot）
   → 浏览器对当前页面拍一张快照

2. DOM 更替（DOM Update）
   → 新页面内容渲染

3. 新状态快照（New State Snapshot）
   → 浏览器对新页面拍一张快照

4. 交叉过渡动画（Crossfade Animation）
   → 旧快照淡出，新快照淡入，中间可以插入自定义动画
```

### View Transition Tree

```
┌─────────────────────────────────────┐
│           View Transition            │
├─────────────────┬───────────────────┤
│   Old Snapshot   │   New Snapshot    │
│   (旧页面快照)    │   (新页面快照)     │
├─────────────────┼───────────────────┤
│ view-transition  │  view-transition  │
│  ├─ :old         │  ├─ :new          │
│  └─ .name-xxx   │  └─ .name-xxx     │
└─────────────────┴───────────────────┘
```

---

## 基础用法

### 启用 View Transitions

```css
/* 方式一：全局启用（CSS） */
@view-transition {
  navigation: auto;
}

/* 方式二：JavaScript 控制 */
document.startViewTransition(() => {
  // DOM 更新操作
  updateDOM();
});
```

```css
/* 方式三：禁用特定过渡 */
@view-transition {
  navigation: auto;
}

.no-transition {
  view-transition-name: none;
}
```

### 定义过渡名称

```html
<!-- 给需要连续性的元素标记 view-transition-name -->
<article>
  <h1 view-transition-name="hero-title">英雄标题</h1>
  <img src="cover.jpg" view-transition-name="hero-image" />
  <p view-transition-name="hero-description">描述文字</p>
</article>
```

```css
/* 自定义过渡动画 */
::view-transition-old(hero-title),
::view-transition-new(hero-title) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}

::view-transition-old(hero-title) {
  animation: fade-out 300ms ease-out;
}

::view-transition-new(hero-title) {
  animation: fade-in 300ms ease-out;
}
```

### 完整示例：页面内切换内容

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @view-transition {
      navigation: auto;
    }

    /* 卡片样式 */
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .card:hover {
      transform: scale(1.02);
    }

    /* View Transition 自定义动画 */
    ::view-transition-old(card-detail),
    ::view-transition-new(card-detail) {
      height: 100%;
      border-radius: 16px;
    }

    ::view-transition-old(card-detail) {
      animation: slide-out 400ms ease-in;
    }

    ::view-transition-new(card-detail) {
      animation: slide-in 400ms ease-out;
    }

    @keyframes slide-out {
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(-100%);
      }
    }
  </style>
</head>
<body>
  <!-- 卡片列表 -->
  <div class="card-list" id="cardList">
    <div class="card" onclick="showDetail(1)" view-transition-name="card-detail">
      <h2>卡片 1</h2>
    </div>
    <div class="card" onclick="showDetail(2)" view-transition-name="card-detail">
      <h2>卡片 2</h2>
    </div>
  </div>

  <!-- 详情视图 -->
  <div class="detail-view" id="detailView" hidden>
    <button onclick="goBack()">返回</button>
    <div class="card-detail" view-transition-name="card-detail">
      <h2 id="detailTitle">详情标题</h2>
      <p id="detailContent">详情内容</p>
    </div>
  </div>

  <script>
    // SPA 风格的切换
    function showDetail(id) {
      document.startViewTransition(() => {
        const cardList = document.getElementById('cardList');
        const detailView = document.getElementById('detailView');

        // 更新内容
        document.getElementById('detailTitle').textContent = `卡片 ${id} 详情`;
        document.getElementById('detailContent').textContent =
          `这是卡片 ${id} 的详细内容...`;

        // 切换显示
        cardList.hidden = true;
        detailView.hidden = false;
      });
    }

    function goBack() {
      document.startViewTransition(() => {
        document.getElementById('cardList').hidden = false;
        document.getElementById('detailView').hidden = true;
      });
    }
  </script>
</body>
</html>
```

---

## View Transition 命名详解

### 动态生成过渡名称

```javascript
// 列表页：每个卡片有不同的 view-transition-name
function renderCards(items) {
  return items.map((item, index) => `
    <article
      style="view-transition-name: card-${item.id}"
      onclick="showDetail(${item.id})"
    >
      <h2>${item.title}</h2>
      <img src="${item.image}" style="view-transition-name: img-${item.id}" />
    </article>
  `).join('');
}

// 详情页：匹配相同的 view-transition-name
function renderDetail(item) {
  return `
    <article style="view-transition-name: card-${item.id}">
      <h1>${item.title}</h1>
      <img src="${item.image}" style="view-transition-name: img-${item.id}" />
      <p>${item.content}</p>
    </article>
  `;
}
```

```css
/* 统一的过渡样式（不需要为每个 ID 单独写） */
::view-transition-old(card-*),
::view-transition-new(card-*) {
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(img-*),
::view-transition-new(img-*) {
  animation-duration: 400ms;
}
```

---

## 自定义动画

### 预设动画类型

```css
/* 滑入/滑出 */
::view-transition-old(slide-content) {
  animation: 300ms ease-in slide-out-to-right;
}

::view-transition-new(slide-content) {
  animation: 300ms ease-out slide-in-from-right;
}

@keyframes slide-out-to-right {
  to { transform: translateX(100%); opacity: 0; }
}

@keyframes slide-in-from-right {
  from { transform: translateX(100%); opacity: 0; }
}

/* 缩放过渡 */
::view-transition-old(expand-card) {
  animation: 400ms ease-in shrink-to-point;
}

::view-transition-new(expand-card) {
  animation: 400ms ease-out expand-from-point;
}

@keyframes shrink-to-point {
  to { transform: scale(0.8); opacity: 0; }
}

@keyframes expand-from-point {
  from { transform: scale(0.8); opacity: 0; }
}

/* 淡入淡出（默认） */
::view-transition-old(fade) {
  animation: 300ms ease-out fade-out;
}

::view-transition-new(fade) {
  animation: 300ms ease-in fade-in;
}

@keyframes fade-out {
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
}
```

### 全页面过渡（无元素映射）

```css
/* 整页交叉淡化 */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 250ms;
}

::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}

::view-transition-new(root) {
  animation: 200ms ease-in fade-in;
}
```

### 组合动画

```css
/* 背景淡化 + 内容滑入 */
::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}

::view-transition-new(root) {
  animation: 300ms ease-out slide-up;
}

@keyframes slide-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
}

/* 共享元素动画（卡片展开为详情页） */
::view-transition-old(main-card),
::view-transition-new(main-card) {
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* 自定义贝塞尔曲线：轻微弹性效果 */
}
```

---

## MPA（跨文档）过渡

### 启用跨文档过渡

```html
<!-- 页面 A: index.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    @view-transition {
      navigation: auto;
    }

    /* 旧快照：向下滑出 */
    ::view-transition-old(root) {
      animation: 300ms ease-in slide-down-fade;
    }

    /* 新快照：从下方滑入 */
    ::view-transition-new(root) {
      animation: 300ms ease-out slide-up-fade;
    }

    @keyframes slide-down-fade {
      to { transform: translateY(-20px); opacity: 0; }
    }

    @keyframes slide-up-fade {
      from { transform: translateY(20px); opacity: 0; }
    }

    /* 共享元素的连续动画 */
    ::view-transition-old(hero-title) {
      animation: 400ms ease-out hero-slide-out;
    }

    ::view-transition-new(hero-title) {
      animation: 400ms ease-out hero-slide-in;
    }

    @keyframes hero-slide-out {
      to { transform: scale(0.8); opacity: 0; }
    }

    @keyframes hero-slide-in {
      from { transform: scale(0.8); opacity: 0; }
    }
  </style>
</head>
<body>
  <h1 view-transition-name="hero-title">我的网站</h1>
  <nav>
    <a href="/about">关于</a>
    <a href="/contact">联系</a>
  </nav>
</body>
</html>
```

```html
<!-- 页面 B: about.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* 使用相同的 @view-transition 规则 */
    @view-transition {
      navigation: auto;
    }

    /* 相同的动画定义 */
    ::view-transition-old(root),
    ::view-transition-new(root) { /* ... */ }

    ::view-transition-old(hero-title),
    ::view-transition-new(hero-title) { /* ... */ }
  </style>
</head>
<body>
  <!-- 使用相同的 view-transition-name -->
  <h1 view-transition-name="hero-title">关于我们</h1>
  <p>这是一个关于我们的页面...</p>
</body>
</html>
```

> **注意**：跨文档过渡需要在 HTTP headers 中启用同源策略，或者使用 `<meta name="view-transition">` 标签。

### 同源限制与解决方案

```html
<!-- 在页面 <head> 中声明允许的来源 -->
<meta name="view-transition" content="same-origin" />
<!-- 或允许所有同源页面 -->
<meta name="view-transition" content="same-origin https://example.com" />
```

```http
<!-- 或使用 HTTP Header -->
Document-View-Transition: same-origin
```

---

## React 集成

### React 18+ 的 View Transitions

```tsx
import { useState, useCallback } from 'react';
import { unstable_useViewTransition } from 'react-dom';

function CardList({ items }) {
  return (
    <div className="card-grid">
      {items.map(item => (
        <Card key={item.id} item={item} />
      ))}
    </div>
  );
}

function Card({ item }) {
  // 使用 unstable hook 获取 View Transition API
  const [, startTransition] = unstable_useViewTransition();

  const handleClick = () => {
    startTransition(() => {
      // 这个回调内的更新会以 View Transition 形式执行
      // 需要配合 CSS 中的 view-transition-name
      setSelectedId(item.id);
    });
  };

  return (
    <div
      className="card"
      style={{ viewTransitionName: `card-${item.id}` }}
      onClick={handleClick}
    >
      <img
        src={item.image}
        style={{ viewTransitionName: `card-img-${item.id}` }}
      />
      <h3>{item.title}</h3>
    </div>
  );
}
```

### 封装为自定义 Hook

```tsx
import { useCallback, useRef } from 'react';

function useViewTransition() {
  const transitionRef = useRef<ViewTransition | null>(null);

  const startTransition = useCallback((callback: () => void | Promise<void>) => {
    if (!document.startViewTransition) {
      // 不支持时降级
      callback();
      return;
    }

    document.startViewTransition(async () => {
      await callback();
      // DOM 更新完成
    });
  }, []);

  return { startTransition };
}

// 使用
function ProductPage({ product }) {
  const { startTransition } = useViewTransition();
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);

  const handleVariantChange = (variant) => {
    startTransition(() => {
      setSelectedVariant(variant);
    });
  };

  return (
    <div
      className="product-image"
      style={{ viewTransitionName: 'product-image' }}
    >
      <img src={selectedVariant.image} alt={product.name} />
    </div>
  );
}
```

### Next.js App Router 集成

```tsx
// app/products/[id]/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function ProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const handleBack = () => {
    // Next.js App Router 不原生支持 View Transitions
    // 需要手动调用
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.back();
      });
    } else {
      router.back();
    }
  };

  return (
    <div
      className="product-detail"
      style={{ viewTransitionName: `product-${params.id}` }}
    >
      {/* 产品详情 */}
    </div>
  );
}
```

---

## View Transitions 与 React Router

```tsx
import { useViewTransition } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Route
        path="/products/:id"
        element={
          <ProductView
            style={{ viewTransitionName: 'product-card' }}
          />
        }
      />
    </Router>
  );
}

function ProductView({ style }) {
  const navigate = useViewTransition();
  const { id } = useParams();

  return (
    <article style={style}>
      <Link
        to={`/products/${id}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/products/${id}`);
        }}
      >
        查看详情
      </Link>
    </article>
  );
}
```

---

## 进阶用法

### 等待过渡完成

```javascript
async function navigateWithTransition(url) {
  if (!document.startViewTransition) {
    window.location.href = url;
    return;
  }

  const transition = document.startViewTransition(() => {
    window.location.href = url;
  });

  try {
    // 等待 CSS 动画完成
    await transition.finished;
    console.log('过渡动画已完成');
  } catch (e) {
    console.error('过渡被中断', e);
  }
}

// 监听过渡事件
document.addEventListener('viewtransitionstart', (e) => {
  console.log('过渡开始', e.viewTransition);
});

document.addEventListener('viewtransitionend', (e) => {
  console.log('过渡结束', e.viewTransition);
});
```

### View Transition 回调

```javascript
const transition = document.startViewTransition(() => {
  updateDOM();
}, {
  // 旧快照更新前调用
  onBeforeSnapshot: () => {
    console.log('准备拍旧页面快照');
  },

  // 旧快照更新后调用
  onAfterSnapshot: () => {
    console.log('旧页面快照已拍好');
    // 可以在这里清理旧页面的事件监听器
  },

  // 新快照更新前调用
  onBeforeManifest: () => {
    console.log('准备渲染新页面');
  },

  // 新快照更新后调用
  onAfterSnapshot: () => {
    console.log('新页面快照已拍好');
  },
});
```

### 浏览器支持检测与降级

```javascript
function navigate(url) {
  if (document.startViewTransition) {
    // 支持 View Transitions
    document.startViewTransition(() => {
      window.location.href = url;
    });
  } else if ('ontouch' in window) {
    // 移动端：给一个触摸反馈
    document.body.style.opacity = '0.9';
    setTimeout(() => {
      window.location.href = url;
    }, 100);
  } else {
    // 降级：直接跳转
    window.location.href = url;
  }
}
```

---

## 动画性能优化

### 合成层提示

```css
/* 告诉浏览器这些元素应该提升到独立合成层 */
.view-transition-element {
  will-change: view-transition-name;
  contain: layout;
}

/* 避免大型元素参与过渡 */
.large-background-image {
  /* 缩小过渡时的分辨率 */
  view-transition-name: none; /* 排除 */
}

/* 只让关键元素过渡 */
.important-element {
  view-transition-name: hero;
}

.unimportant-element {
  view-transition-name: none;
}
```

### 避免布局抖动

```css
/* 避免在过渡期间改变布局属性 */
::view-transition-old(main),
::view-transition-new(main) {
  contain: layout;
  /* 防止子元素布局变化影响过渡 */
}

/* 给固定尺寸的元素过渡 */
::view-transition-old(fixed-size),
::view-transition-new(fixed-size) {
  /* 固定宽高比 */
  overflow: clip;
  contain: layout;
}
```

---

## 与其他方案的对比

### 功能对比

| 维度 | View Transitions API | GSAP | Framer Motion | CSS Animations |
|------|---------------------|------|---------------|----------------|
| 依赖 | 零（浏览器原生） | ~60KB | ~40KB | 零（CSS 原生） |
| 页面级过渡 | ✅ 原生支持 | ⚠️ 需手动处理 | ⚠️ 需手动处理 | ❌ 不支持 |
| DOM 元素映射 | ✅ view-transition-name | ⚠️ 手动 FLIP | ✅ AnimatePresence | ❌ 不支持 |
| MPA 支持 | ✅ 跨文档 | ❌ | ❌ | ❌ |
| 移动端性能 | ✅ GPU 合成 | ✅ GPU | ✅ GPU | ✅ GPU |
| 学习曲线 | ⭐⭐（简单） | ⭐⭐⭐⭐（陡峭） | ⭐⭐⭐（中等） | ⭐⭐（简单） |
| 复杂交互 | ⚠️ 有限 | ✅ 无限 | ✅ 无限 | ⚠️ 有限 |

### 使用场景决策

```
View Transitions API 最适合：
─────────────────────────────────
✅ 页面级切换（MPA / Next.js 页面路由）
✅ 简单的元素位移/缩放过渡
✅ 需要零依赖的场景
✅ 移动端优先的项目（原生 GPU 加速）

GSAP / Framer Motion 更适合：
─────────────────────────────────
✅ 复杂的时间线动画
✅ 拖拽交互（Draggable / Motion）
✅ 复杂的状态机动画
✅ ScrollTrigger / 视差效果
✅ SVG 路径动画
```

---

## 浏览器支持

```
View Transitions API 浏览器支持（2025年）：
─────────────────────────────────
Chrome/Edge：      ✅ 完全支持（2024）
Safari：           ✅ 完全支持（17+）
Firefox：          ⚠️ 部分支持（需要实验性标志）
Mobile Chrome：    ✅ 完全支持
Mobile Safari：   ✅ 完全支持（17+）

建议的降级策略：
─────────────────────────────────
if (!document.startViewTransition) {
  // 直接跳转，不做过渡动画
  // 或者使用 CSS fade 作为降级
}
```

---

## 常见问题

### Q: View Transitions 和 AnimatePresence 有什么区别？

```
AnimatePresence（Framer Motion）：
  → React 组件级别的进入/退出动画
  → 需要组件挂载/卸载来触发动画
  → 只能处理 React 渲染的组件

View Transitions API：
  → 浏览器级别的页面过渡
  → 可以跨文档（MPA）
  → 可以保留旧页面快照做交叉动画
  → 不需要组件卸载/挂载

最佳实践：
  React 内部路由切换 → AnimatePresence
  跨页面导航 → View Transitions API
```

### Q: MPA 过渡需要注意什么？

```
1. 同源限制
   → 必须同源（或配置允许列表）
   → 混合内容（HTTP/HTTPS）会失败

2. 动画同步
   → 两个页面需要有相同的 CSS 过渡定义
   → 可以抽取到共享 CSS 文件

3. 共享元素
   → 两边都需要有相同的 view-transition-name
   → 否则会做默认的交叉淡化

4. 滚动位置
   → View Transitions 不保留滚动位置
   → 需要在 JS 中手动处理 sessionStorage
```

---

## 总结

```
View Transitions API 的核心价值：
─────────────────────────────────
1. 零依赖的页面过渡
   → 浏览器原生支持，不需要 GSAP / Framer Motion

2. 跨文档（MPA）支持
   → 任意同源页面间的平滑过渡

3. DOM 元素映射
   → view-transition-name 实现连续元素动画
   → 卡片 → 详情页、标题、缩略图 → 大图

4. GPU 加速
   → 浏览器合成器自动处理
   → 60fps 流畅动画

5. 渐进增强
   → 不支持时降级为直接跳转
```

```
使用场景：
─────────────────────────────────
✅ Next.js / Nuxt.js 页面路由
✅ MPA 站点（传统 HTML 网站）
✅ 移动端 Web App（性能敏感）
✅ 需要保留旧页面视觉状态的场景
✅ 无障碍访问（降低认知负担）

配合使用：
  View Transitions API（页面级过渡）
  + Framer Motion / GSAP（组件级复杂动画）
  = 完整的动画解决方案
```

View Transitions API 让"像 App 一样流畅的 Web"成为可能，而不需要任何第三方库 🎬

本文由小虾子 🦐 撰写