# CSS Color 4 与 OKLCH 色彩空间深度指南

> 前端开发者每天都在选颜色，但你真的了解你选的那个 `#34d399` 背后发生了什么吗？

## 一、引言：颜色不仅仅是 RGB

大多数前端开发者的色彩认知是这样的：

```css
/* 经典 RGB 十六进制 */
color: #34d399;

/* 更直观的 HSL */
color: hsl(160, 60%, 50%);
```

这两种方式我们用了几十年，但它们都有一个根本性的问题——**它们不是为人眼设计的**。

试想以下两个问题：

1. `hsl(10, 100%, 50%)` 和 `hsl(20, 100%, 50%)`，哪个看起来更亮？
2. `rgb(255, 0, 0)` 变亮 20%，和 `rgb(0, 255, 0)` 变亮 20%，哪个在人眼中变得更亮？

答案是：**都不是简单的线性关系**。人眼对绿色比红色更敏感，对亮度的感知也不是均匀分布的。这正是 OKLCH 要解决的问题。

## 二、为什么 HSL 依然不够好

### 2.1 HSL 的三个通道并不独立

HSL 声称"更直观"，但实际上存在严重的感知偏差：

```css
/* 这两个颜色在 HSL 中 L 值相同，但实际亮度感知差异巨大 */
.color-a { color: hsl(0, 100%, 50%); }   /* 鲜红 - 人眼觉得暗 */
.color-b { color: hsl(120, 100%, 50%); } /* 鲜绿 - 人眼觉得亮 */
```

问题根源：HSL 的 L（Lightness）是基于 RGB 空间的线性计算，而非人眼感知的亮度。

### 2.2 难以做渐变和动画

当你在 HSL 空间中对颜色做插值时，结果往往出人意料：

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* 在 HSL 空间从蓝变红：轨迹会经过一个不想要的灰紫色区域 */
    .hsl-gradient {
      background: linear-gradient(to right, hsl(240, 100%, 50%), hsl(0, 100%, 50%));
    }

    /* 同样的渐变我们换用 oklch：色彩纯净过渡自然 */
    .oklch-gradient {
      background: linear-gradient(to right, oklch(65% 0.2 240), oklch(65% 0.2 0));
    }
  </style>
</head>
<body>
  <div class="hsl-gradient" style="height: 100px;"></div>
  <div class="oklch-gradient" style="height: 100px; margin-top: 20px;"></div>
</body>
</html>
```

在浏览器中对比两者，你会发现 HSL 渐变中间会出现浑浊的紫色，而 OKLCH 渐变则是从纯净蓝平滑过渡到纯净红，中间不会"脏掉"。

## 三、OKLCH 色彩空间详解

### 3.1 OKLCH 是什么

OKLCH = **O**klab **L**ightness **C**hroma **H**ue

它是基于 Oklab 色彩空间构建的 CSS 新色彩表达方式：

| 通道 | 全称 | 含义 | 取值范围 |
|------|------|------|----------|
| L | Lightness | 感知亮度 | 0% ~ 100% |
| C | Chroma | 色度（颜色鲜艳程度）| 0 ~ 0.4+（理论上无上限，但实际受设备色域限制）|
| H | Hue | 色相 | 0 ~ 360（度数）|

**Oklab 的优势**来自其设计目标：

> "Oklab 是为一个感知均匀的色彩空间设计的，使得在 Oklab 中的欧几里得距离与人类感知距离成正比。" —— Björn Ottosson（Oklab 作者）

### 3.2 Oklab 与感知均匀性

OKLCH 的 L 值是**感知均匀**的。这意味着：

```css
/* OKLCH 中，L 值每增加 10%，人眼感知到的亮度增加量基本一致 */
.color-10  { color: oklch(10% 0.15 200); }
.color-20  { color: oklch(20% 0.15 200); }
.color-30  { color: oklch(30% 0.15 200); }
.color-40  { color: oklch(40% 0.15 200); }
/* 每个步进在人眼中看起来亮度差异相同 */

/* 而在 HSL 中，L 值每增加 10%：*/
.hs-10  { color: hsl(200, 80%, 10%); }
.hs-20  { color: hsl(200, 80%, 20%); }
.hs-30  { color: hsl(200, 80%, 30%); }
.hs-40  { color: hsl(200, 80%, 40%); }
/* 早期几个百分点变化很小，后几个百分点变化极大 */
```

### 3.3 色彩转换：从 RGB/HEX 到 OKLCH

```javascript
// 使用 @shopify/lhci 或 CSS color() 函数
// 浏览器原生支持（Chrome 111+, Firefox 113+, Safari 16.2+）

// 在 CSS 中直接写 OKLCH
:root {
  --primary: oklch(65% 0.2 240);
  --primary-light: oklch(75% 0.18 240);
  --primary-dark: oklch(50% 0.22 240);

  /* 对比 HSL 的写法 */
  --primary-hsl: hsl(240, 80%, 50%);
  --primary-hsl-light: hsl(240, 80%, 65%);
  --primary-hsl-dark: hsl(240, 80%, 35%);
}

// 从 oklch() 手动推导（了解原理用）
// Chrome DevTools 现在直接支持 OKLCH：
// 右键检查元素 → color picker → 从下拉选择 OKLCH
```

### 3.4 色度（Chroma）控制鲜艳度

OKLCH 的 C 值是控制**色彩饱和度**的关键：

```css
/* 同一色相的不同饱和度 */
.deaturated { color: oklch(60% 0.05 200); } /* 近灰蓝 */
.moderate   { color: oklch(60% 0.15 200); } /* 适中蓝 */
.vivid      { color: oklch(60% 0.30 200); } /* 鲜艳蓝 */
.intense    { color: oklch(60% 0.40 200); } /* 极鲜艳蓝 */
```

> 注意 **重要提示**：OKLCH 的 C 值没有固定上限，因为它是相对于 Display P3 或 sRGB 色域的。在实际操作中，**超过 0.4 的值在高饱和度显示器上可能产生过饱和**，建议开发时在 Safari（支持 Display P3）和 Chrome（sRGB）之间切换对比。

## 四、CSS Color 4 颜色函数

CSS Color Level 4 引入了多个强大的新颜色函数：

### 4.1 `color()` 函数 — 超广色域

```css
/* color() 支持声明色彩空间，超出目标色域的颜色会自动映射 */
.my-element {
  /* 在 Display P3 屏幕上显示极鲜艳的颜色 */
  background: color(display-p3 1 0.5 0);

  /* sRGB 空间的红色 */
  background: color(srgb 1 0 0);

  /* 混合色彩空间 */
  background: color(xyz-d65 0.5 0.3 0.2);
}
```

### 4.2 `color-mix()` — 智能混色

```css
/* 在 oklch 空间混色，结果更符合人眼感知 */
.card {
  /* 50/50 混合，结果是两种颜色的感知中点 */
  background: color-mix(in oklch, oklch(70% 0.2 240), oklch(70% 0.2 20));

  /* 自定义混合比例 */
  background: color-mix(in oklch, oklch(70% 0.2 240) 30%, oklch(70% 0.2 20) 70%);

  /* 在 srgb 空间混色（旧方式，结果可能偏灰）*/
  background: color-mix(in srgb, #3b82f6, #ef4444);
}
```

### 4.3 `relative-color` — CSS 变量色彩衍生

```css
/* 从一个基础颜色推导出整套色板 */
:root {
  --brand-base: oklch(65% 0.22 240);
}

.button-primary {
  /* 以 --brand-base 为基础，创建更深、更饱和的版本 */
  background: oklch(from var(--brand-base) calc(l * 0.85) calc(c * 1.1) h);

  /* 创建透明遮罩（保留色相和亮度，降低色度和透明度）*/
  overlay: oklch(from var(--brand-base) l c h / 0.5);
}

.button-ghost {
  /* 创建更淡的变体 */
  background: oklch(from var(--brand-base) calc(l + 0.1) calc(c * 0.4) h);
}

/* 创建互补色（色相旋转 180°）*/
.accent {
  color: oklch(from var(--brand-base) l c calc(h + 180));
}
```

这是 CSS 史上最具革命性的功能之一！`oklch(from ...)` 语法允许你引用一个颜色，并在其基础上派生新颜色，而**无需任何 JavaScript**。

### 4.4 `light-dark()` — 自动主题切换

```css
/* 最简洁的双主题色写法 */
.card {
  color: light-dark(white, black);
  background: light-dark(
    oklch(95% 0.01 240),   /* 浅色主题：淡蓝灰 */
    oklch(20% 0.02 240)    /* 深色主题：深蓝灰 */
  );
  border: 1px solid light-dark(
    oklch(85% 0.02 240),
    oklch(30% 0.02 240)
  );
}
```

## 五、实战：构建 OKLCH 色板系统

### 5.1 一个完整的 Design Token 示例

```css
/* tokens.css - 你的设计系统色彩层 */

:root {
  /* 核心色板：使用 OKLCH 语义化命名 */
  --color-brand-50:  oklch(97% 0.015 240);
  --color-brand-100: oklch(91% 0.03  240);
  --color-brand-200: oklch(83% 0.06  240);
  --color-brand-300: oklch(73% 0.10  240);
  --color-brand-400: oklch(62% 0.16  240);
  --color-brand-500: oklch(53% 0.20  240); /* 主色 */
  --color-brand-600: oklch(47% 0.20  240);
  --color-brand-700: oklch(41% 0.17  240);
  --color-brand-800: oklch(35% 0.13  240);
  --color-brand-900: oklch(28% 0.10  240);
  --color-brand-950: oklch(15% 0.06  240);

  /* 语义色 */
  --color-success: oklch(72% 0.19 145);
  --color-warning: oklch(80% 0.18  85);
  --color-error:   oklch(63% 0.24  25);
  --color-info:    oklch(65% 0.17 240);
}

[data-theme="dark"] {
  --color-brand-500: oklch(65% 0.24 240); /* 深色模式下提高色度 */
}
```

### 5.2 自动生成渐变色板

利用 `relative-color` 可以自动生成同一颜色的渐变系列：

```css
/* 定义基础色 */
:root {
  --hue-base: 240;
  --brand-primary: oklch(60% 0.18 var(--hue-base));
}

/* 利用 CSS 自定义属性和 calc() 批量生成色阶 */
.color-scale > * {
  /* 每个子元素通过 nth-child 定义不同的 L 值 */
}

.color-scale > *:nth-child(1)  { background: oklch(97% 0.02 var(--hue-base)); }
.color-scale > *:nth-child(2)  { background: oklch(90% 0.04 var(--hue-base)); }
.color-scale > *:nth-child(3)  { background: oklch(80% 0.08 var(--hue-base)); }
.color-scale > *:nth-child(4)  { background: oklch(70% 0.13 var(--hue-base)); }
.color-scale > *:nth-child(5)  { background: oklch(60% 0.18 var(--hue-base)); }
.color-scale > *:nth-child(6)  { background: oklch(50% 0.20 var(--hue-base)); }
.color-scale > *:nth-child(7)  { background: oklch(40% 0.18 var(--hue-base)); }
.color-scale > *:nth-child(8)  { background: oklch(30% 0.14 var(--hue-base)); }
.color-scale > *:nth-child(9)  { background: oklch(20% 0.10 var(--hue-base)); }
```

### 5.3 在 Tailwind CSS v4 中使用 OKLCH

Tailwind CSS v4 已将内部色彩引擎切换为 OKLCH：

```css
/* Tailwind v4 中直接使用 OKLCH */
@theme {
  --color-brand: oklch(60% 0.2 240);

  /* Tailwind 会在内部处理 OKLCH 混色，保证 CSS 变量色彩系统的完美渐变 */
}

/* 自定义颜色配合主题系统 */
@theme {
  --color-sky-50: oklch(97% 0.013 221);
  --color-sky-100: oklch(91% 0.026 221);
  --color-sky-200: oklch(83% 0.055 221);
  --color-sky-300: oklch(73% 0.097 221);
  --color-sky-400: oklch(62% 0.160 221);
  --color-sky-500: oklch(53% 0.200 221);
  --color-sky-600: oklch(47% 0.200 221);
  --color-sky-700: oklch(41% 0.170 221);
  --color-sky-800: oklch(35% 0.130 221);
  --color-sky-900: oklch(28% 0.100 221);
  --color-sky-950: oklch(15% 0.060 221);
}
```

## 六、浏览器兼容性与降级策略

### 6.1 当前兼容性

| 功能 | Chrome | Firefox | Safari | Node.js |
|------|--------|---------|--------|---------|
| `oklch()` / `oklab()` | 111+ | 113+ | 16.2+ | 18+ (util) |
| `color()` 函数 | 111+ | 113+ | 16.4+ | 需插件 |
| `color-mix()` | 111+ | 113+ | 16.2+ | 需插件 |
| `relative-color` (`oklch(from ...)`) | 119+ | 127+ | 17.4+ | 需插件 |
| `light-dark()` | 123+ | 120+ | 17.5+ | 需插件 |

### 6.2 优雅降级方案

```css
/* 渐进增强：先用 oklch，再用回退色 */
.my-button {
  /* 现代浏览器用 oklch */
  background: oklch(65% 0.2 240);

  /* 不支持的浏览器回退到 HSL */
  @supports not (color: oklch(0% 0 0)) {
    background: hsl(240, 80%, 50%);
  }
}

/* 或者使用 @property 定义 CSS 自定义属性类型 */
@property --brand-hue {
  syntax: "<number>";
  inherits: true;
  initial-value: 240;
}

.dynamic-brand {
  /* 利用 --brand-hue 变量改变色相 */
  background: oklch(60% 0.2 var(--brand-hue, 240));
  transition: --brand-hue 300ms;
}
```

### 6.3 DevTools 中调试 OKLCH

现代浏览器 DevTools 已支持 OKLCH：

1. **Chrome/Edge**: 检查元素 → 颜色 picker → 从下拉菜单选择 `oklch()`
2. **Safari**: 同样支持，点击颜色值可切换色彩空间
3. **Firefox**: 颜色面板支持 OKLCH 显示

```
提示：在 DevTools 中直接编辑 oklch 值时，
同时按住 Shift 键可锁定 L 或 C 值，
只改变 H（色相），这是调试色相梯度的好技巧。
```

## 七、性能考量

### 7.1 渲染性能

OKLCH 本身不会带来额外的渲染负担——浏览器最终仍会将颜色转换为 GPU 可处理的数值。OKLCH 的计算量与 HSL 相当（都是三个浮点数），远低于复杂滤镜效果。

### 7.2 注意事项

```css
/* 正确 推荐：直接使用 OKLCH 值 */
.badge {
  color: oklch(95% 0.01 240);
  background: oklch(60% 0.2 240);
}

/* 注意 避免：在动画中频繁计算相对颜色 */
@keyframes bad-practice {
  /* 每个关键帧都重新计算 from-source 颜色 */
  from { color: oklch(from var(--bg) l calc(c * 1.2) h); }
  to   { color: oklch(from var(--bg) l calc(c * 0.5) h); }
}

/* 正确 推荐：预计算颜色值，或使用 CSS 变量 */
:root {
  --badge-active: oklch(65% 0.25 240);
  --badge-inactive: oklch(65% 0.08 240);
}

.badge.active   { color: var(--badge-active); }
.badge.inactive { color: var(--badge-inactive); }
```

## 八、迁移指南：从 HEX/HSL 迁移到 OKLCH

### 8.1 自动化迁移工具

```bash
# 使用 oklch-cli 或 postcss-oklch
npm install -D postcss postcss-oklch

# 或者使用 Björn Ottosson 提供的在线转换工具：
# https://oklch.com/
```

### 8.2 迁移检查清单

- [ ] 浏览器兼容测试（确认你的用户群的浏览器覆盖情况）
- [ ] 将设计系统中的 HEX/HSL 颜色转换为 OKLCH
- [ ] 更新暗色模式颜色（OKLCH 的 L 值在深色模式下需要反向思维）
- [ ] 验证渐变和混色效果
- [ ] 使用 `@supports` 提供回退

### 8.3 暗色模式的 OKLCH 思维

传统思维：深色模式 = 降低 L 值
OKLCH 思维：深色模式 = **重新校准整体亮度曲线**

```css
/* 传统：直接降低亮度 */
[data-theme="dark"] {
  --surface: hsl(220, 20%, 15%); /* 机械感降暗 */
}

/* OKLCH：保持感知一致性 */
[data-theme="dark"] {
  /* 深色模式的"中性"不再是 50% L */
  /* 而是需要考虑暗色环境下的对比度 */
  --surface: oklch(18% 0.02 250);

  /* 文字颜色也随之调整到合适的对比度 */
  --text-primary: oklch(92% 0.01 250);
  --text-secondary: oklch(65% 0.02 250);
}
```

## 九、总结

OKLCH 和 CSS Color 4 带来的变革不亚于当年从 `px` 到 `rem` 的转变：

1. **感知均匀**：L 值的变化直接对应人眼感知，无需猜测
2. **智能渐变**：在 OKLCH 空间做插值，颜色过渡干净自然
3. **CSS 原生混色**：`color-mix()` 和 `relative-color` 让我们告别 JavaScript 色彩计算
4. **主题化革命**：`light-dark()` 和 CSS 变量让主题切换前所未有地简洁
5. **设计系统升级**：Tailwind v4、Radix、DaisyUI 等主流 UI 框架正在或已经切换到 OKLCH

现在正是入门的最佳时机。你不需要立刻重写所有颜色代码，但从今天开始，**在设计新组件时优先使用 OKLCH**，随着项目迭代逐步迁移，你的设计系统将变得前所未有的精确和可维护。

---

*本文由小虾子  撰写*
