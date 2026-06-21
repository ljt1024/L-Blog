# CSS Anchor Positioning 深度解析：下一代弹出层定位方案

在 Web 开发中，弹出层（Tooltip、Dropdown、Popover、Select）的定位一直是个棘手问题。传统方案依赖 JavaScript 计算坐标，但存在滚动锚定、响应式布局、z-index 堆叠等痛点。**CSS Anchor Positioning** 是 CSS 工作组提出的原生方案，旨在让这些场景完全用 CSS 搞定。本文深入解析其原理、API 及实战技巧。

## 一、问题背景：传统方案的局限

### 1.1 依赖 JS 的经典困境

```js
// 传统的 Popper.js 风格定位
const updatePosition = () => {
  const anchor = document.querySelector('#anchor');
  const popover = document.querySelector('#popover');
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.style.top = `${rect.bottom + window.scrollY}px`;
};
```

问题：
- **滚动失效**：滚动后需要重新计算
- **窗口 resize**：监听 resize 事件重新计算
- **IFRAME 嵌套**：坐标体系混乱
- **z-index 地狱**：层级管理复杂
- **性能损耗**：每次布局变化都要重新计算

### 1.2 Popover API 的出现

Chrome 117 引入了 Popover API（基于 Anchor Positioning）：

```html
<button popovertarget="my-popover">Open</button>
<div id="my-popover" popover>
  Simple popover content
</div>
```

但这只是 UI 层面的封装，定位仍需手动指定。**Anchor Positioning 才是真正的核心**。

## 二、核心概念：Anchor 与被定位元素

### 2.1 基础术语

| 术语 | 说明 |
|------|------|
| **Anchor Element** | 锚点元素，弹出层的"参照物" |
| **Positioned Element** | 被定位元素，如 popover、tooltip |
| **Anchor Name** | 锚点名，多个锚点时的唯一标识 |

### 2.2 最简示例

```html
<style>
  .anchor {
    anchor-name: --my-anchor;  /* 声明锚点 */
  }
  
  .popup {
    position: absolute;
    position-anchor: --my-anchor;  /* 引用锚点 */
    top: anchor(bottom);  /* 锚点的底部 */
    left: anchor(center);  /* 锚点的中心 */
  }
</style>

<button class="anchor">点击我</button>
<div class="popup">我是弹出层</div>
```

关键点：
- `anchor-name` 定义锚点（CSS 自定义属性语法）
- `position-anchor` 让被定位元素引用锚点
- `anchor()` 函数读取锚点的几何信息

## 三、anchor() 函数详解

### 3.1 读取锚点几何

```css
.popup {
  /* 读取锚点各边位置 */
  top: anchor(bottom);           /* 锚点的下边缘 */
  bottom: anchor(top);          /* 锚点的上边缘 */
  left: anchor(right);          /* 锚点的右边缘 */
  right: anchor(left);          /* 锚点的左边缘 */
  
  /* 读取中心点 */
  left: anchor(center);          /* 50% 宽度处 */
  top: anchor(50%);             /* 50% 高度处 */
  
  /* 配合 inset 精确控制 */
  inset-block-end: calc(anchor(bottom) + 8px);  /* 锚点下方 8px */
}
```

### 3.2 anchor-size：基于锚点尺寸

```css
.popup {
  /* 宽度、高度自动匹配锚点 */
  width: anchor-size(width);
  height: anchor-size(height);
  
  /* 也可以指定方向 */
  min-width: anchor-size(self-inline);   /* 锚点内联方向尺寸 */
  min-height: anchor-size(self-block);  /* 锚点块方向尺寸 */
}
```

### 3.3 绝对定位与锚点的配合

```css
.popup {
  position: absolute;
  position-anchor: --my-anchor;
  
  /* 默认是相对于视口，但可以控制逻辑边 */
  inset: 
    anchor(bottom)  /* 顶部 = 锚点底部 */
    0               /* 右侧 = auto */
    auto            /* 底部 = auto */
    anchor(left);   /* 左侧 = 锚点左边 */
}
```

## 四、自动翻转：不再手动计算方向

这是 Anchor Positioning 最强大的特性之一。

### 4.1 @position-try 规则

```css
@position-try --top-if-no-space {
  bottom: calc(anchor(top) - 8px);
  top: auto;
}

@position-try --right-if-no-space {
  left: calc(anchor(right) + 8px);
  right: auto;
}

.popup {
  position: absolute;
  position-anchor: --my-anchor;
  top: anchor(bottom);
  left: anchor(left);
  
  /* 声明备用策略，按优先级尝试 */
  position-try-fallbacks: --top-if-no-space, --right-if-no-space;
}
```

### 4.2 内置翻转关键字

CSS 提供了五个内置策略，无需手动写 `@position-try`：

```css
.popup {
  position: absolute;
  position-anchor: --my-anchor;
  top: anchor(bottom);
  
  /* 内置翻转策略 */
  position-try-fallbacks: flip-block, flip-inline;
}

/* 等价于手动写： */
@position-try --flip-block {
  top: auto;
  bottom: calc(anchor(top) - 8px);
}

@position-try --flip-inline {
  left: auto;
  right: calc(anchor(right) + 8px);
}
```

### 4.3 完整的方向自动切换实战

```css
/* 声明多个位置尝试 */
.popup {
  position: absolute;
  position-anchor: --my-anchor;
  
  /* 首选：锚点下方 */
  top: anchor(bottom);
  left: anchor(left);
  
  /* 依次尝试的备用位置 */
  position-try-fallbacks: 
    --try-above,      /* 锚点上方 */
    --try-right,      /* 锚点右侧 */
    --try-left;       /* 锚点左侧 */
}

@position-try --try-above {
  top: auto;
  bottom: calc(anchor(top) - 8px);
}

@position-try --try-right {
  left: calc(anchor(right) + 8px);
  top: anchor(top);
}

@position-try --try-left {
  left: auto;
  right: calc(anchor(right) + 8px);
  top: anchor(top);
}
```

## 五、滚动容器内的锚定

### 5.1 scroll 锚点的概念

```css
.popup {
  position: absolute;
  position-anchor: --my-anchor;
  top: anchor(bottom);
  left: anchor(left);
  
  /* 锚点滚动时，弹出层跟随移动 */
  scroll-anchor: auto;  /* 默认行为 */
}
```

### 5.2 滚动锚定的问题场景

当锚点在滚动容器内时，弹出层需要考虑：
- 容器边界裁剪（`overflow: hidden`）
- 滚动后定位失效
- 锚点消失在视口外

```css
/* 确保弹出层不被容器裁剪 */
.container {
  overflow: visible;  /* 或 */
  overflow: clip;
}

.popup {
  position: fixed;  /* 改为 fixed 模式 */
  position-anchor: --my-anchor;
  /* ... */
}
```

> 注意：当容器有 `overflow: hidden` 时，Anchor Positioning 可能无法正常工作，此时需要使用 `position: fixed` 配合视口定位。

## 六、多个锚点的复杂场景

### 6.1 命名多个锚点

```css
.header-anchor {
    anchor-name: --header;
}

.sidebar-anchor {
    anchor-name: --sidebar;
}

.content-anchor {
    anchor-name: --content;
}
```

### 6.2 一个元素被多个锚点定位

```css
.floating-panel {
    position: absolute;
    position-anchor: --header;  /* 主锚点 */
    
    /* 使用第二个锚点微调 */
    left: max(
        anchor(--sidebar right),  /* 至少在 sidebar 右边 */
        anchor(--content left)
    );
}
```

### 6.3 条件定位：使用 anchor-size

```css
/* 根据锚点大小决定样式 */
@supports (anchor-size: auto) {
    .popup {
        width: anchor-size(width, 200px);  /* 默认 200px */
    }
}
```

## 七、实战：构建完整的 Tooltip 系统

### 7.1 HTML 结构

```html
<div class="card">
  <button 
    class="tooltip-anchor" 
    data-tooltip="这是一个提示信息"
    aria-describedby="tooltip-1"
  >
    Hover me
  </button>
  
  <span id="tooltip-1" role="tooltip" class="tooltip" hidden>
    这是一个提示信息
  </span>
</div>
```

### 7.2 完整 CSS 实现

```css
/* ==================== 锚点声明 ==================== */
.tooltip-anchor {
    anchor-name: --tooltip-anchor;
}

/* ==================== 弹出层基础样式 ==================== */
.tooltip {
    position: absolute;
    position-anchor: --tooltip-anchor;
    
    /* 默认位置：锚点下方 */
    top: calc(anchor(bottom) + 6px);
    left: anchor(center);
    transform: translateX(-50%);  /* 水平居中 */
    
    /* 视觉样式 */
    padding: 6px 10px;
    background: #1f1f1f;
    color: #fff;
    border-radius: 6px;
    font-size: 13px;
    white-space: nowrap;
    pointer-events: none;
    
    /* 默认隐藏 */
    display: none;
}

/* ==================== 显示状态 ==================== */
.tooltip-anchor:hover + .tooltip,
.tooltip-anchor:focus + .tooltip {
    display: block;
}

/* ==================== 翻转策略 ==================== */
/* 尝试 1：上方 */
@position-try --tooltip-top {
    top: auto;
    bottom: calc(anchor(top) + 6px);
}

/* 尝试 2：左侧 */
@position-try --tooltip-left {
    left: auto;
    right: calc(anchor(right) + 6px);
    transform: none;
}

/* 尝试 3：右侧 */
@position-try --tooltip-right {
    left: calc(anchor(left) + 6px);
    transform: none;
}

.tooltip {
    /* 按优先级尝试 */
    position-try-fallbacks: --tooltip-top, --tooltip-left, --tooltip-right;
}
```

### 7.3 进阶：动态内容宽度自适应

```css
.tooltip {
    /* 限制最大宽度，超长自动换行 */
    max-width: anchor-size(width, 300px);
    white-space: normal;
}
```

## 八、实战：Dropdown 下拉菜单

### 8.1 结构

```html
<div class="dropdown">
  <button class="dropdown-trigger" aria-haspopup="true">
    菜单 ▼
  </button>
  
  <ul class="dropdown-menu" role="menu">
    <li><button role="menuitem">选项 1</button></li>
    <li><button role="menuitem">选项 2</button></li>
    <li role="separator"></li>
    <li><button role="menuitem">选项 3</button></li>
  </ul>
</div>
```

### 8.2 完整样式

```css
/* ==================== 锚点定义 ==================== */
.dropdown-trigger {
    anchor-name: --dropdown-anchor;
}

/* ==================== 菜单样式 ==================== */
.dropdown-menu {
    position: absolute;
    position-anchor: --dropdown-anchor;
    
    /* 默认：下方对齐 */
    top: calc(anchor(bottom) + 4px);
    left: anchor(left);
    width: anchor-size(width);  /* 宽度匹配触发器 */
    
    /* 样式 */
    margin: 0;
    padding: 4px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    list-style: none;
    z-index: 1000;
    
    /* 默认隐藏 */
    display: none;
}

/* ==================== 展开状态 ==================== */
.dropdown-trigger[aria-expanded="true"] + .dropdown-menu {
    display: block;
}

/* ==================== 翻转策略 ==================== */
@position-try --dropdown-up {
    top: auto;
    bottom: calc(anchor(top) + 4px);
}

.dropdown-menu {
    position-try-fallbacks: --dropdown-up;
}
```

### 8.3 纯 CSS 实现切换（无需 JS）

```css
/* 使用 :has() 实现切换 */
.dropdown:has(.dropdown-trigger[aria-expanded="true"]) .dropdown-menu {
    display: block;
}
```

## 九、实战：Select 选择器

### 9.1 需求分析

- 输入框作为锚点
- 选项列表在输入框下方展开
- 宽度匹配输入框
- 滚动时选项列表关闭

### 9.2 实现

```html
<div class="select-wrapper">
  <div 
    class="select-anchor" 
    role="combobox" 
    aria-expanded="false"
    aria-controls="select-listbox"
    tabindex="0"
  >
    <span class="select-value">请选择</span>
    <svg class="chevron">...</svg>
  </div>
  
  <ul 
    id="select-listbox" 
    class="select-options" 
    role="listbox" 
    hidden
  >
    <li role="option" data-value="a">选项 A</li>
    <li role="option" data-value="b">选项 B</li>
    <li role="option" data-value="c">选项 C</li>
  </ul>
</div>
```

```css
.select-anchor {
    anchor-name: --select-anchor;
}

.select-options {
    position: absolute;
    position-anchor: --select-anchor;
    
    top: calc(anchor(bottom) + 4px);
    left: anchor(left);
    width: anchor-size(width);
    
    /* 限制最大高度，避免超出视口 */
    max-height: 240px;
    overflow-y: auto;
    
    /* 样式 */
    margin: 0;
    padding: 4px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    list-style: none;
    
    display: none;
}

.select-anchor[aria-expanded="true"] + .select-options {
    display: block;
}

/* ==================== 翻转策略 ==================== */
@position-try --select-options-top {
    top: auto;
    bottom: calc(anchor(top) + 4px);
}

.select-options {
    position-try-fallbacks: --select-options-top;
}
```

### 9.3 JavaScript 交互（极简）

```js
// 仅负责状态切换和值更新
const anchor = document.querySelector('.select-anchor');
const listbox = document.querySelector('.select-options');
const valueDisplay = document.querySelector('.select-value');

anchor.addEventListener('click', () => {
    const isExpanded = anchor.getAttribute('aria-expanded') === 'true';
    anchor.setAttribute('aria-expanded', !isExpanded);
});

listbox.addEventListener('click', ({ target }) => {
    const option = target.closest('[role="option"]');
    if (!option) return;
    
    valueDisplay.textContent = option.textContent;
    anchor.setAttribute('aria-expanded', 'false');
});
```

## 十、浏览器支持与渐进增强

### 10.1 当前支持情况

```
Chrome 125+  ✅
Firefox 129+ ✅  
Safari 18+   ✅
Edge 125+    ✅
```

> 截至 2025 年底，主流浏览器均已支持。

### 10.2 渐进增强策略

```css
/* 基础降级：无 anchor 定位时使用 fixed */
.popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

/* 增强：有 anchor 支持时 */
@supports (position-anchor: auto) {
    .popup {
        position: absolute;
        position-anchor: --my-anchor;
        top: anchor(bottom);
        left: anchor(center);
        transform: translateX(-50%);
    }
}
```

### 10.3 @supports 检测

```css
/* 检测 anchor-name 支持 */
@supports (anchor-name: --test) {
    .anchor {
        anchor-name: --my-anchor;
    }
}

/* 检测 position-anchor 支持 */
@supports (position-anchor: --test) {
    .popup {
        position-anchor: --my-anchor;
    }
}
```

## 十一、常见问题与调试

### 11.1 弹出层被裁剪

```css
/* 问题：被父容器 overflow: hidden 裁剪 */
.container {
    overflow: visible;  /* 或 clip */
}

/* 或者让弹出层使用 fixed 定位 */
.popup {
    position: fixed;
    position-anchor: --my-anchor;
    /* 配合 @position-try 使用视口坐标 */
}
```

### 11.2 z-index 堆叠问题

```css
.popup {
    /* 使用 CSS 层叠上下文管理 */
    isolation: isolate;  /* 创建新的堆叠上下文 */
    z-index: 100;
}
```

### 11.3 多个弹出层冲突

```css
/* 使用 popover 属性自动处理层级 */
.popup[popover] {
    /* popover 会自动提升层级 */
}
```

### 11.4 DevTools 调试技巧

Chrome DevTools 中：
1. Elements 面板可查看 `anchor-name` 和 `position-anchor` 高亮
2. Layers 面板可查看锚点与弹出层的层叠关系
3. 使用 `outline: 2px dashed red` 快速标记锚点元素

```css
/* 调试用样式 */
[anchor-name] {
    outline: 2px dashed orange;
}

[position-anchor] {
    outline: 2px dashed blue;
}
```

## 总结

CSS Anchor Positioning 是 Web 定位问题的一次范式转移：

| 特性 | 传统方案 | Anchor Positioning |
|------|----------|---------------------|
| 定位方式 | JS 计算坐标 | CSS 原生声明 |
| 滚动跟随 | 需监听 scroll 事件 | 自动处理 |
| 方向翻转 | JS 手动实现 | @position-try 原生支持 |
| 性能 | 每次重新计算 | 浏览器优化渲染 |
| 代码量 | 复杂 | 声明式，极简 |

结合 Popover API、`:has()` 选择器，CSS 已经具备构建复杂 UI 组件的能力，而无需依赖 JavaScript。掌握 Anchor Positioning，你的前端技能栈将提升一个层次。

---

*本文由小虾子 🦐 撰写*