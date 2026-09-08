# CSS @property 深度解析：让 CSS 变量拥有类型、动画与继承的魔法

> 一直以来，CSS 变量的能力受限于字符串——无法做平滑动画、无法定义类型、无法精确控制继承行为。CSS Houdini 的 `@property` 规则彻底打破了这一限制，让 CSS 自定义属性变成了真正的"typed CSS 变量"。本文从原理到实战，完整解析这一革命性 API。

## 一、为什么需要 @property？

### 1.1 普通 CSS 变量的局限

```css
:root {
  --progress: 0;
}

/* ❌ 无效：数值无法插值动画 */
.box {
  width: calc(var(--progress) * 100px);
  transition: width 0.5s ease;
}
```

当你尝试让 `--progress` 从 `0` 平滑过渡到 `100` 时，传统 CSS 变量是无能为力的——因为它们本质上是**纯字符串**，浏览器不知道变量里装的是什么类型，自然无法做中间帧的插值计算。

### 1.2 @property 如何解决

```css
@property --progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.box {
  width: calc(var(--progress) * 100px);
  transition: --progress 0.5s ease;
}
```

通过 `@property`，你告诉浏览器：这个自定义属性是 `<number>` 类型。于是 CSS 引擎就能在 `0` 和 `100` 之间**计算出每一帧的中间值**，让动画丝滑运行。

## 二、@property 完整语法

### 2.1 核心描述符

```css
@property --custom-name {
  syntax: '<type>';
  inherits: <boolean>;
  initial-value: <value>;
}
```

| 描述符 | 类型 | 说明 |
|--------|------|------|
| `syntax` | 字符串 | 定义变量值的类型，支持多种 CSS 类型 |
| `inherits` | boolean | 是否允许子元素继承该变量 |
| `initial-value` | 符合 syntax 的值 | 变量的默认值 |

### 2.2 支持的 syntax 类型

```css
/* 数值类型 */
@property --size { syntax: '<length>'; inherits: false; initial-value: 0px; }
@property --opacity { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

/* 颜色类型 */
@property --hue { syntax: '<number>'; inherits: false; initial-value: 0; }
/* 注意：Houdini 目前不直接支持 <color> 的语法字符串，需要通过 hsl() 间接实现 */

/* 百分比 */
@property --percent { syntax: '<percentage>'; inherits: false; initial-value: 0%; }

/* 长度百分比组合 */
@property --radius { syntax: '<length-percentage>'; inherits: false; initial-value: 0%; }

/* 自定义组合 */
@property --shadow {
  syntax: '<length>#';
  inherits: false;
  initial-value: 0px;
}
```

### 2.3 syntax 修饰符

```css
/* # 表示逗号分隔的多个值 */
@property --shadow {
  syntax: '<length>#';
  inherits: false;
  initial-value: 0px;
}
/* --shadow: 1px 2px 3px, 4px 5px 6px; */

/* + 表示空格分隔的多个值 */
@property --transform {
  syntax: '<transform-list>+';
  inherits: false;
  initial-value: none;
}

/* ? 表示可选的标识符 */
@property --variant {
  syntax: 'custom-ident?';
  inherits: false;
  initial-value: normal;
}

/* 任意组合 */
@property --grid-template {
  syntax: '[<length-percentage> | minmax(<length-percentage>, <flex>)]#';
  inherits: false;
  initial-value: auto;
}
```

## 三、核心能力一：类型化的平滑动画

### 3.1 最经典的案例：进度条

```html
<div class="progress-bar">
  <div class="progress-fill" id="fill"></div>
</div>
<span class="progress-text" id="text">0%</span>
<button onclick="animateProgress()">开始动画</button>
```

```css
@property --progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.progress-fill {
  width: calc(var(--progress) * 1%);
  height: 24px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 12px;
  /* 关键：--progress 变量本身支持 transition！ */
  transition: --progress 1.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-text {
  font-size: 24px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
```

```javascript
function animateProgress() {
  const fill = document.getElementById('fill');
  const text = document.getElementById('text');
  
  // 通过设置变量值触发 CSS transition 动画
  fill.style.setProperty('--progress', '75');
  
  // 同时用计数器动画更新文本
  let current = 0;
  const target = 75;
  const duration = 1500;
  const start = performance.now();
  
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    current = Math.round(eased * target);
    text.textContent = current + '%';
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
```

**效果**：进度条从 0 平滑增长到 75%，同时百分比数字同步更新。

### 3.2 颜色渐变动画

虽然 `@property` 不直接支持 `<color>` 语法字符串，但通过 HSL 分解可以间接实现颜色平滑过渡：

```css
@property --hue {
  syntax: '<number>';
  inherits: false;
  initial-value: 200;
}

@property --lightness {
  syntax: '<number>';
  inherits: false;
  initial-value: 50;
}

.theme-element {
  background: hsl(var(--hue), 80%, calc(var(--lightness) * 1%));
  transition:
    --hue 0.8s ease,
    --lightness 0.8s ease;
}

.theme-element:hover {
  --hue: 340;      /* 红色 */
  --lightness: 60;
}
```

### 3.3 阴影动画

```css
@property --elevation {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.card {
  box-shadow: 
    0 calc(var(--elevation) * 1px) calc(var(--elevation) * 2px) rgba(0,0,0,0.1),
    0 calc(var(--elevation) * 0.5px) calc(var(--elevation) * 1px) rgba(0,0,0,0.06);
  transition: --elevation 0.3s ease;
  --elevation: 10; /* 悬停时 10px 高度阴影 */
}

.card:hover {
  --elevation: 20;
}
```

## 四、核心能力二：离散属性的过渡

传统 CSS 中，`display: none` ↔ `display: block` 和 `visibility: hidden` ↔ `visibility: visible` 是无法平滑过渡的。`@property` + `transition-behavior` 改变了这一点：

```css
@property --visible {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.dropdown {
  --visible: 0;
  /* 配合 transition-behavior: allow-discrete */
  transition:
    --visible 0.3s ease,
    opacity 0.3s ease,
    transform 0.3s ease;
  transition-behavior: allow-discrete;
  
  opacity: var(--visible);
  transform: translateY(calc((1 - var(--visible)) * -10px));
}

.dropdown.open {
  --visible: 1;
}

/* @starting-style 让元素"从有到无"有过渡效果 */
@starting-style {
  .dropdown { opacity: 0; }
}
```

**关键点**：
- `transition-behavior: allow-discrete` 允许离散属性（display, visibility, opacity 等）参与过渡
- `@starting-style` 定义元素进入视图时的"起始样式"，解决"从 0 到有"没有过渡的问题
- `var(--visible)` 在 0 和 1 之间插值，驱动 opacity 和 transform 的同步动画

## 五、核心能力三：控制继承行为

```css
@property --theme-color {
  syntax: '<color>';
  inherits: true;
  initial-value: #3b82f6;
}

.card {
  --theme-color: #10b981; /* 子元素会继承这个值 */
}

.badge {
  background: var(--theme-color); /* #10b981 */
}

/* 如果 inherits: false，则 .badge 使用 initial-value (#3b82f6) */
```

**实战场景**：实现主题色时，子组件通过继承自动获取当前主题色，无需手动传递：

```css
@property --accent {
  syntax: '<color>';
  inherits: true;
  initial-value: #3b82f6;
}

* {
  color: var(--accent);
}

/* 暗黑模式 */
[data-theme="dark"] {
  --accent: #60a5fa;
}

/* 高对比模式 */
[data-theme="high-contrast"] {
  --accent: #ffffff;
}
```

## 六、高级用法：与 CSS 动画深度结合

### 6.1 @keyframes + @property

```css
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes radar {
  to { --angle: 360deg; }
}

.radar-sweep {
  transform: rotate(var(--angle));
  animation: radar 2s linear infinite;
}
```

### 6.2 视差滚动效果

```css
@property --parallax-offset {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.parallax-layer {
  transform: translateY(var(--parallax-offset));
  transition: --parallax-offset 0.1s linear;
}

window.addEventListener('scroll', () => {
  document.querySelectorAll('.parallax-layer').forEach((el, i) => {
    const speed = (i + 1) * 0.3;
    el.style.setProperty('--parallax-offset', `${scrollY * speed}px`);
  });
});
```

### 6.3 复杂组合动画：进度环

```css
@property --dash-offset {
  syntax: '<number>';
  inherits: false;
  initial-value: 283;
}

@property --glow-opacity {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.progress-ring {
  --dash-offset: 283;
  --glow-opacity: 0;
  
  stroke-dasharray: 283;
  stroke-dashoffset: var(--dash-offset);
  filter: drop-shadow(0 0 calc(var(--glow-opacity) * 8px) #667eea);
  
  transition:
    --dash-offset 1.5s cubic-bezier(0.65, 0, 0.35, 1),
    --glow-opacity 0.5s ease;
}

.progress-ring.animated {
  --dash-offset: 70;  /* 75% 完成 */
  --glow-opacity: 1;   /* 发光效果 */
}
```

## 七、与 @counter-style 和 @font-palette-values 的对比

Houdini Paint API 家族还包括其他强大的注册 API：

### 7.1 @font-palette-values — 自定义字体配色

```css
/* 定义字体配色方案 */
@font-palette-values --brand {
  font-family: "Brand Font";
  base-palette: 1;
  override-colors: 
    1 oklch(65% 0.25 250),  /* 第一个颜色 */
    3 oklch(70% 0.20 180);
}

.brand-text {
  font-family: "Brand Font";
  font-palette-values: --brand;
}
```

### 7.2 @counter-style — 自定义列表符号

```css
@counter-style chapter {
  system: cyclic;
  symbols: "第一章" "第二章" "第三章" "第四章";
  suffix: " ";
}

.toc {
  list-style: chapter;
}
```

## 八、浏览器支持与渐进增强

### 8.1 当前支持情况

`@property` 在现代浏览器中支持良好（Chrome 85+, Edge 85+, Safari 16.4+），但需要提供回退策略：

```css
/* 基础回退：直接使用值 */
.badge {
  background: #667eea; /* 不支持 @property 时的回退色 */
  transition: background 0.3s ease;
}

/* 带 @property 的增强体验 */
@supports (background: paint(something)) {
  .badge {
    background: hsl(var(--hue), 80%, 60%);
  }
}

/* 或者用 @property 覆盖 */
@property --hue {
  syntax: '<number>';
  inherits: false;
  initial-value: 230;
}

@property --saturation {
  syntax: '<number>';
  inherits: false;
  initial-value: 80;
}

.badge {
  background: hsl(var(--hue), calc(var(--saturation) * 1%), 60%);
}
```

### 8.2 @property 注册函数（JS 版）

除了 CSS 声明，也可以用 JS 注册自定义属性：

```javascript
if (CSS.registerProperty) {
  CSS.registerProperty({
    name: '--loading-progress',
    syntax: '<number>',
    inherits: false,
    initialValue: 0,
  });
}

// 然后在 CSS 中使用（无需再次声明）
.loading-bar {
  width: calc(var(--loading-progress) * 100%);
  transition: --loading-progress 0.5s ease;
}
```

**注意**：JS 注册与 CSS `@property` 声明**不能重复**——已通过 `@property` 注册的属性不能再次注册。

## 九、工程实践建议

### 9.1 变量命名规范

```css
/* 建议的命名规范：带类型前缀 */
@property --num-progress { ... }
@property --len-gap { ... }
@property --pct-opacity { ... }
@property --angle-rotation { ... }
@property --color-primary { ... }
```

### 9.2 性能注意事项

1. **避免在动画帧中频繁调用 `style.setProperty`**：考虑使用 CSS 动画 + `animation-timeline` 替代 JS 控制
2. **复合属性的分离**（如颜色用 HSL 分解）会带来更多 GPU 绘制开销
3. 复杂的多变量同步动画（如进度环案例）建议使用 `will-change` 提示：

```css
.progress-ring {
  will-change: stroke-dashoffset, filter;
}
```

### 9.3 组件化封装

```css
/* 将 @property 封装在组件内，避免污染全局 */
.button {
  @property --btn-scale {
    syntax: '<number>';
    inherits: false;
    initial-value: 1;
  }
  
  /* 更好的方式：用 CSS 嵌套（Chrome 129+） */
}
```

> ⚠️ 注意：目前 `@property` 不支持 CSS 嵌套语法内使用，需定义在根级别。对于组件化场景，建议通过 BEM 或 CSS Modules 隔离命名空间。

### 9.4 典型使用场景总结

| 场景 | 推荐 syntax | 注意事项 |
|------|------------|---------|
| 进度条/加载动画 | `<number>` | 配合 transition |
| 颜色主题切换 | `<number>` + HSL | 需分解 H/S/L 三个变量 |
| 高度/宽度动画 | `<length>` | 避免使用 auto，改用 calc |
| 旋转角度 | `<angle>` | 配合 @keyframes |
| 阴影层级 | `<number>` | 多个阴影需多个变量 |
| 圆角动画 | `<length-percentage>` | 支持 % 和 px 混用 |
| 透明度 | `<number>` | 0-1 范围，优于 opacity |

## 十、完整实例：可交互的 CSS 变量仪表盘

最后来看一个综合实例——使用 `@property` 实现一个响应所有 CSS 变量的控制面板：

```html
<div class="dashboard">
  <div class="control-group">
    <label>亮度</label>
    <input type="range" min="0" max="100" value="50" id="brightness">
  </div>
  <div class="control-group">
    <label>对比度</label>
    <input type="range" min="0" max="200" value="100" id="contrast">
  </div>
  <div class="control-group">
    <label>饱和度</label>
    <input type="range" min="0" max="200" value="100" id="saturation">
  </div>
  <div class="card-preview">
    <div class="card-inner"></div>
  </div>
</div>
```

```css
@property --brightness { syntax: '<number>'; inherits: false; initial-value: 50; }
@property --contrast { syntax: '<number>'; inherits: false; initial-value: 100; }
@property --saturation { syntax: '<number>'; inherits: false; initial-value: 100; }
@property --hue-shift { syntax: '<number>'; inherits: false; initial-value: 0; }

.card-inner {
  filter: 
    brightness(calc(var(--brightness) * 1%))
    contrast(calc(var(--contrast) * 1%))
    saturate(calc(var(--saturation) * 1%))
    hue-rotate(calc(var(--hue-shift) * 1deg));
  transition:
    --brightness 0.3s ease,
    --contrast 0.3s ease,
    --saturation 0.3s ease,
    --hue-shift 0.3s ease;
}
```

```javascript
document.querySelectorAll('input[type="range"]').forEach(input => {
  input.addEventListener('input', (e) => {
    const name = e.target.id;
    document.documentElement.style.setProperty(`--${name}`, e.target.value);
  });
});
```

**效果**：拖动滑块，所有滤镜参数同步平滑过渡，每个控件之间互不干扰。

## 结语

`@property` 是 CSS Houdini 中最实用、最容易上手的 API 之一。它用极其简洁的语法，解决了 CSS 变量长期以来的三大痛点：**无类型**、**无法动画**、**无法精确控制继承**。配合 `transition-behavior`、`@starting-style` 和 CSS 动画，`@property` 让我们在 CSS 中实现过去只有 JS 才能完成的复杂交互动效，同时保持声明式、可维护的代码风格。

建议从进度条、颜色过渡、阴影动画这三个最常见场景开始实践，逐步掌握这一强大工具。

---

*本文由小虾子 🦐 撰写*
