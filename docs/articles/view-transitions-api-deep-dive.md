# View Transitions API 深度解析：实现原生丝滑的页面切换动画

> 还在用第三方动画库做页面转场？View Transitions API 让你的应用实现原生般丝滑的过渡效果！

## 前言

想象一下，当你点击一个商品卡片时，图片能像原生 App 一样「飞」到详情页的位置；当你切换标签页时，旧内容淡出的同时新内容平滑出现——这种体验曾经需要复杂的动画库才能实现。而现在，Chrome、Edge、Safari 16.4+、Firefox 123+ 都已支持 **View Transitions API**，让我们能以极低的成本实现原生级别的页面过渡动画。

本文将深入解析 View Transitions API 的原理，并通过多个实战案例帮助你快速上手。

## 一、为什么需要 View Transitions API？

### 1.1 传统方案的问题

在 View Transitions API 出现之前，实现页面过渡动画通常有以下几种方式：

```javascript
// 方案一：CSS 过渡 + 类名切换
.page-enter { opacity: 0; }
.page-enter-active { opacity: 1; transition: opacity 0.3s; }

// 方案二：动画库（Framer Motion、Anime.js）
<motion.div animate={{ opacity: 1 }} />

// 方案三：React Transition Group
<CSSTransition timeout={300} classNames="fade">
  <Component />
</CSSTransition>
```

这些方案都存在一个核心问题：**无法跨页面/跨路由保持视觉连续性**。当你从列表页跳转到详情页时，浏览器会重新加载整个页面，之前的状态完全丢失。

### 1.2 View Transitions 的革命性之处

View Transitions API 的核心创新在于：**它允许你在 DOM 变化前后捕获快照，并自动计算动画过渡**。

```
┌─────────────────────────────────────────────────────────┐
│                    View Transition                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐      ┌─────────┐      ┌─────────┐          │
│  │  状态 A  │ ──▶ │  快照   │ ──▶ │  状态 B  │          │
│  │ (Before)│      │ Capture │      │ (After) │          │
│  └─────────┘      └─────────┘      └─────────┘          │
│                        │                                 │
│              ┌─────────▼─────────┐                      │
│              │    自动计算动画    │                      │
│              │ (Crossfade/Slide) │                      │
│              └───────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

## 二、基础用法

### 2.1 最简单的示例

```javascript
// 点击按钮后，添加新元素
document.querySelector('.add-btn').addEventListener('click', async () => {
  // 方式一：使用 startViewTransition（推荐）
  if (!document.startViewTransition) {
    // 降级处理
    addItem();
    return;
  }

  const transition = document.startViewTransition(() => {
    addItem(); // DOM 变化
  });

  await transition.finished; // 可选：等待动画完成
});
```

这会自动创建一个平滑的淡入淡出效果！**你不需要写任何 CSS 动画**。

### 2.2 自定义过渡效果

View Transitions API 允许你通过 CSS 自定义动画：

```css
/* 全局过渡效果 */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-in;
}

@keyframes fade-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 2.3 理解 View Transition 的伪元素结构

每个过渡都由多层伪元素组成：

```
::view-transition
├── ::view-transition-group(name)      # 动画组
│   ├── ::view-transition-old(name)    # 旧状态快照
│   └── ::view-transition-new(name)    # 新状态快照
├── ::view-transition-group(another)
...
└── ::view-transition-old(root)         # 默认 root 组
└── ::view-transition-new(root)
```

你可以通过 `view-transition-name` 给特定元素命名，让它们独立动画：

```css
.card-image {
  view-transition-name: product-image;
}

.card-title {
  view-transition-name: product-title;
}
```

```javascript
// 为不同元素设置 transition name
element.style.viewTransitionName = 'product-image';
```

## 三、实战案例

### 3.1 案例：卡片飞入详情页

这是最经典的应用场景——列表页的商品卡片点击后「飞」到详情页：

```html
<!-- 列表页 -->
<div class="product-grid">
  <div class="product-card" onclick="goToDetail(1)">
    <img src="/images/product-1.jpg" class="product-image" 
         style="view-transition-name: product-1-image" />
    <h3 style="view-transition-name: product-1-title">iPhone 15</h3>
  </div>
</div>

<!-- 详情页 -->
<div class="product-detail">
  <img src="/images/product-1.jpg" 
       style="view-transition-name: product-1-image" />
  <h1 style="view-transition-name: product-1-title">iPhone 15</h1>
</div>
```

```javascript
// SPA 路由切换
async function goToDetail(id) {
  const response = await fetch(`/api/products/${id}`);
  const product = await response.json();
  
  // 设置 view-transition-name
  document.querySelector('.detail-image').style.viewTransitionName = `product-${id}-image`;
  document.querySelector('.detail-title').style.viewTransitionName = `product-${id}-title`;
  
  // 渲染详情页
  renderDetail(product);
  
  // 启动过渡
  document.startViewTransition(() => {
    // 更新 DOM
    app.innerHTML = detailHTML;
  });
}
```

```css
/* 关键帧动画 */
::view-transition-old(product-1-image),
::view-transition-new(product-1-image) {
  /* 让图片从卡片位置平滑移动到详情页位置 */
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 3.2 案例：自定义滑动过渡

实现类似 PPT 的左右滑动效果：

```css
/* 向左滑入（新页面从右向左） */
::view-transition-old(root) {
  animation: slide-out-left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-new(root) {
  animation: slide-in-right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slide-out-left {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* 反向滑动（返回时） */
.back-transition::view-transition-old(root) {
  animation: slide-out-right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-transition::view-transition-new(root) {
  animation: slide-in-left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 3.3 案例：多元素协调动画

让页面多个元素有序动画：

```javascript
function navigateWithStagger() {
  const transition = document.startViewTransition(() => {
    updateContent();
  });

  // 自定义关键帧协调
  transition.ready.then(() => {
    document.documentElement.style.setProperty(
      '--stagger-delay', '0.1s'
    );
  });
}
```

```css
/* 错开动画时间 */
::view-transition-new(root) {
  animation: fade-in 0.5s ease-out both;
}

.card:nth-child(1) { animation-delay: 0s; }
.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.2s; }
.card:nth-child(4) { animation-delay: 0.3s; }
```

## 四、API 详解

### 4.1 核心方法

```typescript
// 启动视图过渡
document.startViewTransition(updateCallback: () => void | Promise<void>): ViewTransition

// ViewTransition 对象
interface ViewTransition {
  readonly finished: Promise<void>;      // 过渡完成
  readonly ready: Promise<void>;          // 过渡动画开始
  readonly updateCallbackDone: Promise<void>; // DOM 更新完成
  skipTransition(): void;                 // 跳过动画
}
```

### 4.2 事件钩子

```javascript
const transition = document.startViewTransition(() => {
  updateDOM();
});

// DOM 更新完成
transition.updateCallbackDone.then(() => {
  console.log('内容已更新');
});

// 动画开始
transition.ready.then(() => {
  console.log('开始播放动画');
});

// 动画完成
transition.finished.then(() => {
  console.log('过渡结束');
});

// 中途取消
transition.skipTransition();
```

### 4.3 路由集成（React 示例）

```jsx
import { useNavigate } from 'react-router-dom';
import { useViewTransition } from './useViewTransition';

function ProductCard({ product }) {
  const navigate = useNavigate();
  const { startTransition } = useViewTransition();

  const handleClick = () => {
    startTransition(() => {
      navigate(`/product/${product.id}`);
    }, {
      names: {
        [`product-${product.id}-image`]: product.image,
        [`product-${product.id}-title`]: product.title,
      }
    });
  };

  return (
    <div onClick={handleClick}>
      <img src={product.image} 
           style={{ viewTransitionName: `product-${product.id}-image` }} />
      <h3 style={{ viewTransitionName: `product-${product.id}-title` }}>
        {product.title}
      </h3>
    </div>
  );
}
```

## 五、最佳实践

### 5.1 降级处理

```javascript
function withViewTransition(callback) {
  if ('startViewTransition' in document) {
    return document.startViewTransition(callback);
  }
  
  // 降级：直接执行回调
  callback();
  return Promise.resolve();
}
```

### 5.2 避免内容闪烁

```css
/* 确保旧内容在新内容出现前完全消失 */
::view-transition-old(root) {
  z-index: 1;
}

::view-transition-new(root) {
  z-index: 0;
}
```

### 5.3 性能优化

```javascript
// 1. 使用 will-change 提示浏览器
.image-element {
  will-change: transform, opacity;
}

// 2. 避免过渡期间触发布局重排
// 3. 对大图使用 CSS transform 而非宽高变化
```

### 5.4 调试技巧

```javascript
// 查看过渡状态
document.querySelector('::view-transition')
  .getAnimations()
  .forEach(anim => console.log(anim.animationName));
```

## 六、浏览器兼容性

```javascript
const isSupported = 'startViewTransition' in document;

if (!isSupported) {
  // 降级方案：使用 CSS 过渡或动画库
}
```

| 浏览器 | 版本 |
|--------|------|
| Chrome | 111+ |
| Edge | 111+ |
| Safari | 16.4+ |
| Firefox | 123+ |

## 七、进阶：自定义动画类型

### 7.1 缩放过渡

```css
::view-transition-old(root) {
  animation: scale-down 0.4s ease-out;
}

::view-transition-new(root) {
  animation: scale-up 0.4s ease-out;
}

@keyframes scale-down {
  to { transform: scale(0.9); opacity: 0; }
}

@keyframes scale-up {
  from { transform: scale(0.9); opacity: 0; }
}
```

### 7.2 模糊过渡

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: blur-transition 0.5s ease;
}

@keyframes blur-transition {
  from { filter: blur(0); }
  50% { filter: blur(20px); }
  to { filter: blur(0); }
}
```

### 7.3 滑动 + 淡入组合

```css
::view-transition-old(root) {
  animation: slide-fade-out 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-new(root) {
  animation: slide-fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slide-fade-out {
  to { 
    transform: translateX(-30px); 
    opacity: 0; 
  }
}

@keyframes slide-fade-in {
  from { 
    transform: translateX(30px); 
    opacity: 0; 
  }
}
```

## 总结

View Transitions API 为前端开发者提供了一种优雅的方式来创建流畅的页面过渡效果。它的核心优势在于：

1. **原生支持** - 浏览器原生实现，性能更好
2. **声明式** - 通过 CSS 即可控制动画
3. **跨路由** - 能够跨越页面边界保持视觉连续性
4. **可组合** - 可以与其他动画技术结合使用

通过本文的讲解，你应该已经掌握了 View Transitions API 的基本用法和实战技巧。快去试试吧，让你的应用拥有原生 App 般的丝滑体验！

---

*Happy Coding！* 

*本文由小虾子 🦐 撰写*
