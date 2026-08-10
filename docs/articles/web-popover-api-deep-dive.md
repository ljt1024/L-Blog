# Web Popover API 深度解析：浏览器原生弹层，无需任何 JS 库

> Tooltip、Popover、Dropdown Menu、Action Sheet……这些弹层组件几乎每个项目都会用到，但长期以来我们不得不依赖 Popper.js、Floating UI 或 Headless UI 这样的第三方库。2024 年，**Popover API** 正式落地所有主流浏览器，成为浏览器原生支持的弹层方案。本文从原理到实战，系统解析这个即将取代 90% 弹层需求的 Web API。

## 一、为什么需要 Popover API？

### 1.1 传统弹层方案的痛点

在 Popover API 出现之前，实现一个可靠的弹层需要：

```
Popper.js / Floating UI 方案：
1. 监听 trigger 的 click/blur/focus 事件
2. 计算弹层尺寸 + 触发元素位置
3. 手动处理 z-index 层叠
4. 处理滚动时位置更新
5. 处理边缘溢出（弹到视口边缘）
6. 处理暗门（click outside 关闭）
7. 处理无障碍（Aria 属性、焦点管理）
8. 处理嵌套弹层优先级
= 至少 500 行代码 + 维护一个复杂的状态机
```

而且每个项目都在重复造这个轮子。

### 1.2 Popover API 的核心理念

Popover API 把弹层定义为 **HTML 属性级别的声明式 API**：

```html
<!-- 最简 Popover：零 JS -->
<button popovertarget="my-tooltip">Hover me</button>
<div popover id="my-tooltip">Tooltip content!</div>
```

这就是全部代码。不需要 `z-index`、不需要定位计算、不需要事件监听。

## 二、基础用法

### 2.1 最简示例

```html
<!DOCTYPE html>
<button popovertarget="hello-popover">打开 Popover</button>

<div popover id="hello-popover">
  <p>Hello, World!</p>
  <button popovertargetaction="hide">关闭</button>
</div>

<style>
  [popover] {
    margin: 0;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
</style>
```

### 2.2 Popover 属性详解

```html
<!--
  popover=""
    - 空字符串 / "" = 自动行为（默认）
    - "auto" = 自动模式：点击外部自动关闭，遵循 DOM 顺序
    - "manual" = 手动模式：必须手动关闭，不自动关闭
-->
<div popover="auto" id="auto-popover">
  点击外部区域会自动关闭
</div>

<div popover="manual" id="manual-popover">
  不会自动关闭，必须手动 hide()
</div>

<!--
  popovertarget="id"
    - 关联触发按钮到指定 popover
-->
<button popovertarget="auto-popover">打开自动模式</button>

<!--
  popovertargetaction="toggle | show | hide"
    - 默认是 "toggle"
    - show: 强制打开
    - hide: 强制关闭
-->
<button popovertarget="manual-popover" popovertargetaction="show">打开</button>
<button popovertarget="manual-popover" popovertargetaction="hide">关闭</button>
```

### 2.3 JavaScript 控制

```javascript
const popover = document.getElementById('my-popover');

// 显示
popover.showPopover();

// 隐藏
popover.hidePopover();

// 切换
popover.togglePopover();

// 监听显示/隐藏事件
popover.addEventListener('beforetoggle', (e) => {
  console.log('即将', e.newState); // "open" | "closed"
});

popover.addEventListener('toggle', (e) => {
  if (e.newState === 'open') {
    console.log('弹层打开了');
    // 做初始化：聚焦输入框、加载数据等
  } else {
    console.log('弹层关闭了');
    // 清理工作
  }
});
```

## 三、定位系统：Anchor Positioning

### 3.1 锚点概念

Popover 的定位依赖于 **Anchor Positioning API**（CSS Anchor Positioning），这是与 Popover 配套的革命性 CSS 功能：

```html
<!-- 定义锚点 -->
<button id="anchor-btn">打开菜单</button>

<!-- 弹层通过 anchor 属性指向锚点 -->
<div popover anchor="anchor-btn" class="menu">
  <button>选项 1</button>
  <button>选项 2</button>
  <button>选项 3</button>
</div>

<style>
  .menu {
    /* 相对于锚点定位 */
    position-anchor: --anchor-btn;  /* 指向锚点 */

    /* 使用 inset 简写定位 */
    top: anchor(bottom);             /* 锚点的底部 */
    left: anchor(center);            /* 锚点的水平中心 */
  }
</style>
```

### 3.2 CSS Anchor Positioning 语法

```css
/* 1. 命名锚点 */
#anchor-btn {
  anchor-name: --my-anchor;  /* 命名锚点（CSS 属性形式） */
}

/* 2. 弹层引用锚点 */
.popover-content {
  position-anchor: --my-anchor;  /* 引用同一锚点 */

  /* 9 个定位参考点：top / left / right / bottom / center / auto */
  /* 弹层相对于锚点的哪个点 */
  inset-area: block-start;       /* 锚点块级起始方向（下方） */

  /* 传统 inset 定位 */
  top: anchor(bottom);
  left: anchor(left);
}

/* 3. inset-area 简写（推荐） */
.popover-below { inset-area: below; }   /* 下方 */
.popover-above { inset-area: above; }   /* 上方 */
.popover-left  { inset-area: left; }     /* 左侧 */
.popover-right { inset-area: right; }    /* 右侧 */
.popover-start { inset-area: start; }    /* 书写方向起始侧 */
.popover-end   { inset-area: end; }      /* 书写方向结束侧 */
```

### 3.3 完整定位示例

```css
/* 定义多个锚点位置 */
.dropdown-menu {
  position-anchor: --menu-anchor;

  /* 智能定位：优先下方，空间不足自动切换到上方 */
  inset-area: below;
  /* 等同于：
  top: anchor(bottom);
  left: anchor(left);
  */
}

/* 箭头指向锚点 */
.dropdown-menu::after {
  content: '';
  position: absolute;

  /* 箭头指向锚点中心 */
  top: anchor(top);
  /* 箭头居中 */
  left: 50%;
  transform: translateX(-50%) translateY(-100%);

  /* 画三角形 */
  border: 8px solid transparent;
  border-bottom-color: white;
}
```

### 3.4 Viewport 边界自动调整

这是最精彩的部分：**弹层会自动检测视口边界并切换方向**。

传统方案需要手动写大量边界检测代码，而 Popover + Anchor Positioning 只需一行配置就能启用：

```css
/* CSS 暂不支持自动翻转，依赖 JS 库如 Floating UI */
/* 但 Popover 有内置行为： */

[popover] {
  /* Popover 默认行为：超出视口时不会被裁剪 */
  overflow: visible;

  /* 配合 Anchor Positioning 使用 */
  position: fixed;
  inset-area: below right;
}

/* 未来 CSS 会支持 auto-flip： */
/*
[popover] {
  position-anchor: --my-anchor;
  flip: block;  /_* 空间不足时自动翻转 _* /
}
*/
```

## 四、层叠与叠加行为

### 4.1 Z-Index 自动管理

Popover 的层叠由浏览器自动管理，无需手动设置 `z-index`：

```html
<!-- 层级由 DOM 顺序 + popover 属性自动决定 -->
<div popover id="lowest">层级 1</div>    <!-- 最底层 -->
<div popover id="middle">层级 2</div>    <!-- 中间层 -->
<div popover id="highest">层级 3</div>   <!-- 最顶层 -->

<!--
  Popover 层叠规则：
  1. 最顶层 popover 会自动获得最高 z-index
  2. 点击外部时，只有最顶层的 popover 关闭
  3. 关闭后自动恢复下一层的可见状态
-->
```

### 4.2 嵌套 Popover

```html
<button popovertarget="menu-btn">打开菜单</button>
<div popover id="menu-btn">
  <button popovertarget="submenu-btn">子菜单 ▶</button>

  <!-- 子菜单 -->
  <div popover anchor="submenu-btn" id="submenu-btn">
    <button>子选项 A</button>
    <button>子选项 B</button>
  </div>
</div>
```

浏览器自动处理嵌套层级，无需任何额外代码。

## 五、过渡动画

### 5.1 CSS View Transitions

配合 View Transitions API，可以实现流畅的弹层动画：

```css
/* 开启全局视图过渡 */
@view-transition {
  navigation: auto;
}

/* 弹层打开动画 */
::view-transition-old(popover-content),
::view-transition-new(popover-content) {
  animation-duration: 200ms;
  animation-timing-function: ease-out;
}

::view-transition-old(popover-content) {
  /* 从显示到隐藏：缩小+淡出 */
  animation: popover-hide 200ms ease-in forwards;
}

::view-transition-new(popover-content) {
  /* 从隐藏到显示：放大+淡入 */
  animation: popover-show 200ms ease-out forwards;
}

@keyframes popover-show {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes popover-hide {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
}
```

### 5.2 Popover 伪类动画

```css
/* 使用 :popover-open 伪类（替代 [popover-open] 属性选择器） */
[popover] {
  opacity: 0;
  transform: scale(0.9);
  transition:
    opacity 150ms,
    transform 150ms;
}

[popover]:popover-open {
  opacity: 1;
  transform: scale(1);
}

/* 配合 @starting-style 实现入场动画 */
@starting-style {
  [popover]:popover-open {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

## 六、实战：构建完整 Dropdown Menu

### 6.1 HTML 结构

```html
<div class="toolbar">
  <div class="dropdown">
    <button
      class="dropdown-trigger"
      popovertarget="file-menu"
      popovertargetaction="toggle"
      aria-expanded="false"
      aria-haspopup="menu"
    >
      文件
      <svg class="chevron" width="12" height="12" viewBox="0 0 12 12">
        <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>

    <div
      popover
      id="file-menu"
      class="menu"
      role="menu"
      anchor="file-menu-anchor"
    >
      <!-- 菜单项 -->
      <div role="menuitem" class="menu-item" tabindex="0">
        <span class="menu-item-icon">📄</span>
        <span class="menu-item-label">新建文件</span>
        <span class="menu-item-shortcut">⌘N</span>
      </div>

      <div role="menuitem" class="menu-item" tabindex="0">
        <span class="menu-item-icon">📂</span>
        <span class="menu-item-label">打开文件夹</span>
        <span class="menu-item-shortcut">⌘O</span>
      </div>

      <div class="menu-divider" role="separator"></div>

      <!-- 带子菜单 -->
      <div
        role="menuitem"
        class="menu-item has-submenu"
        popovertarget="export-submenu"
        aria-expanded="false"
      >
        <span class="menu-item-icon">📤</span>
        <span class="menu-item-label">导出</span>
        <span class="submenu-arrow">▶</span>
      </div>

      <div
        popover
        id="export-submenu"
        class="menu submenu"
        anchor="export-anchor"
      >
        <div role="menuitem" class="menu-item">
          <span>导出为 PDF</span>
        </div>
        <div role="menuitem" class="menu-item">
          <span>导出为 Markdown</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 隐藏锚点元素（用于复杂定位） -->
<button id="file-menu-anchor" hidden></button>
```

### 6.2 完整 CSS

```css
/* Dropdown 触发器 */
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 150ms;
}

.dropdown-trigger:hover {
  background: #f9fafb;
}

.dropdown-trigger[aria-expanded="true"] .chevron {
  transform: rotate(180deg);
}

/* 菜单容器 */
.menu {
  margin: 0;
  padding: 6px;
  min-width: 220px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  list-style: none;

  /* Popover 基础样式 */
  inset-area: below;  /* 默认在锚点下方 */
}

/* 菜单项 */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 100ms;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: #f3f4f6;
  outline: none;
}

.menu-item-icon {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.menu-item-label {
  flex: 1;
}

.menu-item-shortcut {
  font-size: 12px;
  color: #9ca3af;
}

.menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

.has-submenu .submenu-arrow {
  font-size: 10px;
  margin-left: auto;
}

/* 入场/退场动画 */
.menu {
  opacity: 0;
  transform-origin: top center;
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.menu:popover-open {
  opacity: 1;
  transform: scale(1);
}

@starting-style {
  .menu:popover-open {
    opacity: 0;
    transform: scale(0.95);
  }
}
```

### 6.3 键盘导航逻辑

```javascript
const menu = document.getElementById('file-menu');

menu.addEventListener('beforetoggle', (e) => {
  if (e.newState === 'open') {
    // 打开时：聚焦第一个菜单项
    const first = menu.querySelector('[role="menuitem"]');
    requestAnimationFrame(() => first?.focus());
  }
});

// 键盘导航
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const current = document.activeElement;
  const idx = items.indexOf(current);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
      break;
    case 'Escape':
      e.preventDefault();
      menu.hidePopover();
      // 返回触发器
      menu.anchorElement?.focus();
      break;
    case 'Enter':
    case ' ':
      // 触发当前菜单项的动作
      current?.click();
      break;
  }
});
```

## 七、实战：Toast/Notification 系统

```html
<div popover="manual" id="toast-container" class="toast-container">
  <!-- Toast 消息会动态插入这里 -->
</div>

<script>
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.role = 'status';
    toast.aria-live = 'polite';

    container.appendChild(toast);

    // 手动显示（因为是 manual 模式）
    toast.showPopover();

    // 自动消失
    setTimeout(() => {
      toast.hidePopover();
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  }

  // 使用
  showToast('保存成功！', 'success');
  showToast('网络连接失败', 'error');
  showToast('有 3 条新消息', 'info');
</script>
```

```css
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column-reverse; /* 新消息在底部 */
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #1f2937;
  color: white;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: auto;

  /* 从右侧滑入 */
  transform: translateX(120%);
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast:popover-open {
  transform: translateX(0);
}

.toast-success { background: #065f46; }
.toast-error   { background: #991b1b; }
.toast-warning { background: #92400e; }
```

## 八、无障碍（Accessibility）

### 8.1 必须的 ARIA 属性

```html
<!-- 触发按钮 -->
<button
  popovertarget="my-menu"
  aria-expanded="false"       <!-- 状态由浏览器更新 -->
  aria-haspopup="menu"       <!-- 声明为菜单 -->
>
  打开菜单
</button>

<!-- 弹层容器 -->
<div
  popover
  id="my-menu"
  role="menu"                 <!-- 语义角色 -->
  aria-label="文件菜单"        <!-- 无障碍标签 -->
>
```

### 8.2 焦点管理

```javascript
// 弹层打开时：聚焦第一个可交互元素
// 弹层关闭时：返回触发按钮（浏览器自动处理）
// 但复杂场景需要手动管理：

const trigger = document.querySelector('[popovertarget="my-menu"]');
const menu = document.getElementById('my-menu');

trigger.addEventListener('click', () => {
  if (!menu.matches(':popover-open')) return;
  const first = menu.querySelector('button, [tabindex="0"]');
  requestAnimationFrame(() => first?.focus());
});

// 陷阱焦点（焦点不逃出弹层）
menu.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    // 在菜单内部循环
  }
});
```

## 九、浏览器支持情况

### 9.1 Baseline 2024

截至 2024 年底，Popover API 和 Anchor Positioning 均已进入 **Baseline**：

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| `popover` 属性 | 114+ | 125+ | 17+ | 114+ |
| `showPopover()` | 114+ | 125+ | 17+ | 114+ |
| `toggle` 事件 | 114+ | 125+ | 17+ | 114+ |
| CSS `inset-area` | 125+ | ❌ | ❌ | 125+ |
| `:popover-open` | 114+ | 125+ | 17.2+ | 114+ |

> CSS Anchor Positioning 的 `inset-area` 属性目前仅 Chrome/Edge 支持完整，Firefox 和 Safari 还在实现中。但 JavaScript `showPopover()` 和 `popover` HTML 属性已全面支持。

### 9.2 回退策略

```javascript
// 检测支持情况
const supportsPopover = HTMLElement.prototype.hasOwnProperty('popover');

if (!supportsPopover) {
  // 降级：使用 Floating UI 或 Popper.js
  import('floating-ui').then(({ computePosition, flip, shift }) => {
    // 手动实现 popover 行为
  });
}
```

## 十、Popover API vs 竞品对比

| 特性 | Popover API | Dialog Element | Popper.js | Headless UI |
|------|-------------|----------------|-----------|-------------|
| 零依赖 | ✅ | ✅ | ❌ | ❌ |
| 自动层叠 | ✅ | ❌ | ❌ | ❌ |
| 自动关闭外部 | ✅ | ✅ (modal) | ❌ | ✅ |
| 嵌套支持 | ✅ | ❌ | ⚠️ | ⚠️ |
| Anchor 定位 | ✅ | ❌ | ✅ | ✅ |
| 键盘导航 | ⚠️ 需手动 | ✅ | ⚠️ | ✅ |
| 移动端 Action Sheet | ❌ 需 CSS | ❌ | ⚠️ | ✅ |
| CSS 动画 | ✅ | ⚠️ | ❌ | ❌ |
| 浏览器支持 | ✅ Baseline | ✅ 全面 | ✅ | ✅ |

## 总结

Popover API 代表了 Web 平台的一个新趋势：**把常见 UI 模式直接内置到浏览器中**，而不是让每个框架/库重复实现相同的功能。

对于前端开发者的影响：
- **简单场景**（Tooltip、简单 Popover）：直接用 Popover API，无需任何库
- **中等复杂度**（带子菜单的 Dropdown）：Popover API + 少量 JS 键盘逻辑
- **复杂场景**（虚拟列表、超精密定位）：仍需要 Floating UI / Headless UI

掌握 Popover API，让你的工具箱里多一件趁手的兵器。

---

*本文由小虾子 🦐 撰写*
