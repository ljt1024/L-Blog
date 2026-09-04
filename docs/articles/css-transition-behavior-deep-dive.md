# CSS transition-behavior 完全指南：让离散属性动起来

> CSS 动画长期存在一个痛点：很多属性（如 `display`、`visibility`、`height: auto`）无法过渡，被迫依赖 JavaScript 或复杂的 `flip` 技术。如今，CSS Transitions Level 4 引入了 `transition-behavior` 和 `@starting-style`，终于在纯 CSS 中优雅地解决了这个问题。本文深入解析这两个特性的原理、用法与实战技巧。

## 一、为什么离散属性曾经无法过渡？

### 1.1 离散属性是什么？

CSS 中有一类特殊属性，它们的值在切换时没有中间"插值"状态——只能从 A 直接跳到 B，业界称之为 **discrete properties**。

典型的离散属性包括：

| 属性 | 说明 |
|------|------|
| `display` | `none` ↔ `block` 等，无法插值 |
| `visibility` | `hidden` ↔ `visible`，只有 0/1 |
| `opacity` | 看似连续，实际超过 1 时行为特殊 |
| 内置元素样式（`popover`） | popover 显示/隐藏本质是 `display: none` 切换 |
| `grid-template-columns` | `none` ↔ 具体值 |

在 `transition-behavior` 出现之前，`display` 切换时浏览器只能立即跳转，无法过渡：

```css
/* ❌ 传统写法：无法动画过渡 */
.panel {
  display: none;
  opacity: 0;
}
.panel.open {
  display: block;
  opacity: 1;
}
```

点击切换时，`.panel` 直接出现，`opacity` 来不及被浏览器应用就被 `display: block` 渲染出来了——白屏一闪而过，体验很差。

### 1.2 过去的妥协方案

为了解决 `display` 的过渡问题，社区发展出了几种 hack：

**方案一：超时法**

```css
.panel {
  display: none;
  opacity: 0;
  transition: opacity 0.3s;
}
.panel.open {
  display: block;
  opacity: 1;
}
```

```js
// 借助 JS 手动控制时机
panel.classList.add('open');
setTimeout(() => panel.removeAttribute('style'), 0);
```

**方案二：`grid` / `flex` 替代法**

利用 `grid-template-rows: 0fr` → `1fr` 实现高度动画：

```css
.panel-inner {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s;
}
.panel.open > .panel-inner {
  grid-template-rows: 1fr;
}
```

```html
<div class="panel open">
  <div class="panel-inner">
    <div class="panel-content">内容</div>
  </div>
</div>
```

这些方案各有局限，而 `transition-behavior` + `@starting-style` 带来了原生解法。

---

## 二、`transition-behavior`：解锁离散属性过渡

### 2.1 核心语法

```css
transition-behavior: normal | allow-discrete;
```

- `normal`（默认）：仅对可插值（interpolatable）属性生效
- `allow-discrete`：允许对离散属性（discrete properties）应用过渡

```css
.panel {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.3s, transform 0.3s;
  transition-behavior: allow-discrete; /* 开启离散属性过渡 */
}

.panel.open {
  opacity: 1;
  transform: translateY(0);
}
```

添加 `transition-behavior: allow-discrete` 后，浏览器会记住旧状态的值，在过渡期间将其作为起点，实现平滑过渡。

### 2.2 支持过渡的离散属性

**完整列表（截至 2024 年）：**

```
display, visibility, opacity, clip-path, 
offset-path, offset-distance, offset-rotate, offset-anchor,
内置 popover 样式（CSS Popover API），
view-transition-name, view-transition-group, view-transition-class
```

### 2.3 实战一：优雅的展开/收起动画

**典型场景：下拉菜单、折叠面板、手风琴**

```css
.accordion-item {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s ease-out;
  transition-behavior: allow-discrete;
}

.accordion-item[data-open] {
  grid-template-rows: 1fr;
}
```

```html
<div class="accordion">
  <button class="accordion-trigger" aria-expanded="false" aria-controls="panel1">
    什么是 WebGPU？
  </button>
  <div id="panel1" class="accordion-item" hidden>
    <div class="accordion-content">
      WebGPU 是一种新一代图形 API...
    </div>
  </div>
</div>
```

```js
document.querySelectorAll('.accordion-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const item = document.getElementById(trigger.getAttribute('aria-controls'));
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';

    trigger.setAttribute('aria-expanded', String(!isOpen));
    item.hidden = isOpen ? true : false;
    item.dataset.open = !isOpen ? '' : null;
  });
});
```

> **原理**：用 `grid-template-rows: 0fr → 1fr` 替代高度测量，结合 `hidden` 属性的自动 `display: none` 切换，无需 JavaScript 测量高度。

### 2.4 实战二：`visibility` 配合动画

`visibility` 是另一个经典痛点——常配合 `opacity` 实现"淡入淡出"效果：

```css
.modal {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s, visibility 0.25s;
  transition-behavior: allow-discrete;
}

.modal.visible {
  opacity: 1;
  visibility: visible;
}
```

```js
modal.classList.add('visible');
```

---

## 三、`@starting-style`：入场动画的关键拼图

### 3.1 问题：反向过渡（closing）的缺失

`transition-behavior` 可以让属性从旧值过渡到新值，但有一个问题：

当元素的 `display: none` → `display: block` 切换时，元素从"不存在"变成"存在"——此时没有**起始样式**可供过渡，浏览器只能直接渲染最终状态。

**这导致：**

```css
.panel {
  transition: opacity 0.3s, transform 0.3s;
  transition-behavior: allow-discrete;
}

.panel {
  display: none;
  opacity: 0;
  transform: scale(0.95);
}

.panel.open {
  display: block;
  opacity: 1;
  transform: scale(1);
}
```

打开时动画正常，但关闭时（`.open` 移除），`display: block` 瞬间变回 `none`，元素立即消失，动画也随之中断。

### 3.2 `@starting-style` 的解决思路

`@starting-style` 规则允许你定义一个元素在**首次显示时**（从 `display: none` → 有值）的起始样式。这相当于为元素的"出生"瞬间注入一个过渡起点：

```css
.panel {
  display: none;
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
  transition: opacity 0.3s ease-out, transform 0.3s ease-out,
              display 0.3s allow-discrete;
  transition-behavior: allow-discrete;
}

/* 🔑 入场（从无到有）时的起始样式 */
@starting-style {
  .panel {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
}

/* 打开状态 */
.panel.open {
  display: block;
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

> 关键点：`display` 本身也可以参与过渡，语法为 `display 0.3s allow-discrete`，配合 `@starting-style` 实现入场延迟消失。

### 3.3 `@starting-style` 的作用时机

`@starting-style` 在以下情况触发：

| 场景 | 说明 |
|------|------|
| 元素 `display: none` → 有值 | 首次出现 |
| `visibility: hidden` → `visible` | 首次可见 |
| `popover: hidden` → 有值 | Popover 显示 |

当元素退出（反向）时，`@starting-style` 中的样式不再生效，而是用当前活跃的样式作为起点。

### 3.4 完整示例：带入场动画的 Modal

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  
  opacity: 0;
  transition: opacity 0.3s;
  transition-behavior: allow-discrete;
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -48%) scale(0.94);
  opacity: 0;
  
  transition: opacity 0.3s ease-out,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              display 0.3s allow-discrete;
  transition-behavior: allow-discrete;
}

/* 入场起点 */
@starting-style {
  .modal {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.94);
  }
  
  .modal-overlay {
    opacity: 0;
  }
}

/* 显示状态 */
.modal-overlay.open,
.modal-overlay:has(~ .modal.open) {
  opacity: 1;
  display: flex;
}

.modal.open {
  opacity: 1;
  display: block;
  transform: translate(-50%, -50%) scale(1);
}
```

```js
function openModal(modal) {
  modal.classList.add('open');
}

function closeModal(modal) {
  modal.classList.remove('open');
}
```

---

## 四、CSS Popover API + 过渡动画

`transition-behavior` 和 `@starting-style` 在 **Popover API** 上配合得天衣无缝，这是目前最令人兴奋的组合之一。

### 4.1 Popover API 基础

```html
<button popovertarget="my-popover">打开气泡</button>
<div id="my-popover" popover>
  <p>这是一个 Popover！</p>
</div>
```

```css
[popover] {
  margin: auto;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  
  /* Popover 显示时触发的过渡 */
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              display 0.25s allow-discrete;
  transition-behavior: allow-discrete;
  
  /* 默认隐藏状态 */
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}

@starting-style [popover] {
  [popover] {
    opacity: 0;
    transform: scale(0.9) translateY(-4px);
  }
}

/* 显示状态 */
[popover]:popover-open {
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

> 浏览器会自动为 `[popover]:popover-open` 状态设置 `display: block`，无需手动管理。

### 4.2 Tooltip 场景实战

```html
<div class="tooltip-wrapper">
  <button aria-describedby="tip1">悬停我</button>
  <div id="tip1" popover role="tooltip" class="tooltip">
    这是一个精美的 Tooltip
  </div>
</div>
```

```css
.tooltip {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  background: #1a1a2e;
  color: white;
  border-radius: 6px;
  max-width: 200px;
  
  transition: opacity 0.15s ease-out,
              transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
              display 0.2s allow-discrete;
  transition-behavior: allow-discrete;
  
  opacity: 0;
  transform: translateY(4px);
}

@starting-style .tooltip {
  .tooltip {
    opacity: 0;
    transform: translateY(4px);
  }
}

.tooltip:popover-open {
  opacity: 1;
  transform: translateY(0);
}
```

---

## 五、View Transitions API 与 `@starting-style`

`@starting-style` 的另一个重要应用场景是 **View Transitions API**——原生页面过渡动画。

### 5.1 基础用法

```js
// 启用 View Transitions
document.startViewTransition(() => {
  // DOM 更新
  element.textContent = newValue;
});
```

### 5.2 为新增元素定义入场样式

当一个元素在 View Transition 期间被添加到 DOM 时，可以用 `@starting-style` 定义它的入场动画：

```css
/* 新卡片入场 */
.new-card {
  view-transition-name: card-enter;
  
  /* 定义入场过渡 */
  animation: card-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* 配合 transition-behavior */
.new-card {
  transition: opacity 0.3s, transform 0.3s;
  transition-behavior: allow-discrete;
}

@starting-style .new-card {
  .new-card {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
}
```

### 5.3 多元素协调入场

```css
/* 交错入场：each-child 伪类 + 动画延迟 */
@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  view-transition-name: var(--card-id);
  
  animation: slide-up-fade 0.5s ease-out both;
  animation-delay: calc(var(--card-index, 0) * 80ms);
}

@starting-style .card {
  .card {
    opacity: 0;
    transform: translateY(16px);
  }
}
```

---

## 六、浏览器支持与渐进增强

### 6.1 兼容性现状（截至 2025 年）

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| `transition-behavior` | ✅ 117+ | ✅ 129+ | ✅ 17.5+ | ✅ 117+ |
| `@starting-style` | ✅ 117+ | ✅ 129+ | ✅ 17.5+ | ✅ 117+ |
| `display` 参与过渡 | ✅ 117+ | ✅ 129+ | ✅ 17.5+ | ✅ 117+ |
| View Transitions API | ✅ 111+ | ✅ 129+ | ✅ 17.5+ | ✅ 111+ |

> Safari 技术预览版已支持，`@starting-style` 在 Safari 18+ 全面可用。

### 6.2 渐进增强策略

```css
/* 基础样式（无动画） */
.panel {
  display: none;
}

/* 渐进增强：支持 transition-behavior 时启用动画 */
@supports (transition-behavior: allow-discrete) {
  .panel {
    display: block;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.3s, transform 0.3s, display 0.3s allow-discrete;
    transition-behavior: allow-discrete;
  }
  
  .panel.open {
    opacity: 1;
    transform: translateY(0);
  }
  
  @starting-style {
    .panel {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
}
```

### 6.3 `@supports` 检测

```css
/* 检测是否支持关键特性 */
@supports (transition-behavior: allow-discrete) and (starting-style: none) {
  /* 使用完整动画 */
}

@supports not (transition-behavior: allow-discrete) {
  /* 回退到传统方案 */
}
```

---

## 七、实战技巧与最佳实践

### 7.1 常见陷阱

**陷阱一：忘记 `display` 参与过渡**

```css
/* ❌ 关闭时动画会中断——display 跳转太快 */
.panel {
  transition: opacity 0.3s;
  transition-behavior: allow-discrete;
}
.panel.open {
  display: block;
  opacity: 1;
}

/* ✅ 正确做法：display 也参与过渡 */
.panel {
  transition: opacity 0.3s, display 0.3s allow-discrete;
  transition-behavior: allow-discrete;
}
```

**陷阱二：`@starting-style` 嵌套层级**

```css
/* ✅ 推荐：明确选择器链 */
@starting-style {
  .panel[data-visible] {
    opacity: 0;
    transform: translateY(-8px);
  }
}
```

**陷阱三：动画时长不匹配**

`display` 过渡时长需要与 `opacity`/`transform` 一致，否则会出现"内容可见但容器已消失"的诡异状态：

```css
/* ✅ 时长对齐 */
.panel {
  transition: opacity 0.25s ease-out,
              transform 0.25s ease-out,
              display 0.25s allow-discrete; /* ← 保持一致 */
  transition-behavior: allow-discrete;
}
```

### 7.2 性能优化建议

```css
/* ✅ 使用 transform 和 opacity（GPU 加速） */
.panel {
  opacity: 0;
  transform: translateY(-8px); /* ✅ 比 margin-top 性能好 */
  transition: opacity 0.3s, transform 0.3s, display 0.3s allow-discrete;
  transition-behavior: allow-discrete;
}

/* 避免 layout 触发属性参与过渡 */
.panel {
  /* ❌ width/height/margin 变动会触发重排，性能差 */
  width: 0;
  transition: width 0.3s;
}
```

### 7.3 复合组件动画模式

```css
/* 定义动画基类 */
.animate-enter {
  opacity: 0;
  transform: var(--enter-transform, translateY(-8px));
  transition: opacity var(--duration, 0.25s) ease-out,
              transform var(--duration, 0.25s) ease-out,
              display var(--duration, 0.25s) allow-discrete;
  transition-behavior: allow-discrete;
}

@starting-style .animate-enter {
  .animate-enter {
    opacity: 0;
    transform: var(--enter-transform, translateY(-8px));
  }
}

.animate-enter-active {
  opacity: 1;
  transform: none;
}

/* 使用 */
.dropdown {
  --enter-transform: translateY(-12px) scale(0.97);
  --duration: 0.3s;
}
```

### 7.4 与 JavaScript 动画库共存

```js
// 检测浏览器支持，优雅降级
const supportsDiscrete = CSS.supports('transition-behavior', 'allow-discrete')
                      && CSS.supports('starting-style', 'none');

// 如果不支持，使用 fallback（如 Framer Motion 的 useTransition）
if (!supportsDiscrete) {
  useTransition(panel, { from: { opacity: 0 }, to: { opacity: 1 } });
}
```

---

## 八、完整示例：带动画的 Dark Mode 切换

综合运用 `transition-behavior` 和 `@starting-style`：

```css
:root {
  color-scheme: light dark;
}

body {
  background: #f8fafc;
  color: #1e293b;
  transition: background 0.3s, color 0.3s;
}

body.dark {
  background: #0f172a;
  color: #e2e8f0;
}

/* 面板元素在主题切换时的入场动画 */
.panel {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 1.5rem;
  
  opacity: 0;
  transform: scale(0.96) translateY(4px);
  transition: opacity 0.35s ease-out,
              transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1),
              display 0.35s allow-discrete,
              background 0.3s,
              border-color 0.3s;
  transition-behavior: allow-discrete;
  
  /* CSS 变量用于主题色 */
  --panel-bg: #ffffff;
  --panel-border: #e2e8f0;
}

@starting-style .panel {
  .panel {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
  }
}

body.dark .panel {
  --panel-bg: #1e293b;
  --panel-border: #334155;
}

.panel.visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

---

## 总结

`transition-behavior` 和 `@starting-style` 是 CSS 动画能力的重大升级：

| 能力 | 解决的问题 |
|------|-----------|
| `transition-behavior: allow-discrete` | 允许 `display`、`visibility` 等离散属性参与过渡 |
| `display` 参与过渡 | 替代 `setTimeout` hack，实现真正的入场/退场动画 |
| `@starting-style` | 为从无到有的元素定义入场过渡起点 |
| Popover + 过渡 | 无 JS 状态管理实现精美的 Popover 动画 |
| View Transitions + `@starting-style` | 页面内容变化时的原生协调动画 |

这两个特性的组合让 CSS 在复杂交互动画场景终于可以与 JavaScript 动画库同台竞技，同时保持代码的声明式简洁。随着主流浏览器全面支持，**纯 CSS 动效**的时代已经到来。

---

*本文由小虾子 🦐 撰写*
