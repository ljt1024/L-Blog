# CSS Cascade Layers 深度解析：掌控样式优先级的新一代武器

> 你是否曾在大型项目中与 CSS 优先级搏斗过？`!important` 滥用、无穷无尽的选择器权重计算、第三方样式与业务代码的冲突……CSS `@layer`（级联层）正是为解决这些问题而生的现代 CSS 规范。本文将深入剖析其原理、用法与实战技巧。

## 一、为什么需要 Cascade Layers？

在 CSS 中，`!important` 一直是"核武器"级别的 hack——用它解决冲突，往往引来更多混乱。传统的优先级体系是这样的：

```css
/* 权重从低到高 */
元素选择器 < 类选择器 < ID选择器 < 内联样式 < !important
```

但现实远比这复杂。同一权重下，后声明的规则覆盖先声明的；当多个来源（浏览器默认、第三方库、自定义样式）的 CSS 混杂在一起时，优先级战争就不可避免。

**Cascade Layers（级联层）** 从根本上重构了这套机制：让开发者显式控制不同来源样式之间的优先级顺序，彻底告别靠"后到优先"或"权重叠加"来覆盖样式。

## 二、基本语法：三分钟上手

### 2.1 声明与使用

```css
/* 第一步：声明层（按声明顺序决定默认优先级，先声明的优先级低） */
@layer utilities;
@layer components;
@layer base;

@layer base {
  p { color: red; }
}

@layer components {
  p { color: blue; }  /* components 层优先级高于 base */
}

@layer utilities {
  p { color: green; } /* 优先级最低 */
}
```

运行后，所有 `<p>` 文字将显示 **blue**，因为 `components` 层在 `utilities` 之后声明，优先级更高。

### 2.2 匿名层与嵌套层

```css
/* 匿名层：无法从外部引用，适合库作者隐藏内部实现 */
@layer {
  .card { border-radius: 8px; }
}

/* 嵌套层：用点号语法 */
@layer components.card {
  .card-header { font-weight: bold; }
}

@layer components.card {
  .card-body { padding: 16px; }
}
```

### 2.3 无层样式 vs 有层样式

**关键规则**：不在任何 `@layer` 块内的样式，优先级**高于所有已声明的层**。

```css
@layer base {
  h1 { color: blue; }
}

/* 无层样式 → 优先级最高，即使选择器权重更低 */
h1 { color: red; }
```

输出：`red`。这是设计上的精明之处——让你能轻松覆盖第三方库的层样式（只需不把它们放进层里，或用更高优先级的层）。

## 三、层的优先级规则：核心原理

### 3.1 层间优先级

```
后声明的层 > 先声明的层
```

这意味着：

```css
@layer reset, framework, custom;
```

- `reset` 优先级最低
- `framework` 优先级中等
- `custom` 优先级最高

**实战建议**：始终先声明所有层的顺序，再填充内容——这样在文件开头就能一目了然地看到优先级架构。

### 3.2 层层内：普通级联规则

在同一个层内，选择器权重和源码顺序仍然生效：

```css
@layer components {
  .card .title { color: blue; }   /* 权重更高 */
  .title { color: red; }          /* 被上面覆盖 */
}
```

## 四、实战技巧

### 4.1 构建可预测的 CSS 架构

一个典型的现代项目结构：

```css
/* === 层顺序声明（顶层，先定规矩） === */
@layer reset, tokens, base, layouts, components, utilities;

/* === 填充各层 === */
@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
}

@layer tokens {
  :root {
    --color-primary: #3b82f6;
    --spacing-md: 16px;
    --radius-md: 8px;
  }
}

@layer base {
  body { font-family: system-ui, sans-serif; }
  a { color: var(--color-primary); }
}

@layer layouts {
  .container { max-width: 1200px; margin: 0 auto; }
  .grid { display: grid; gap: var(--spacing-md); }
}

@layer components {
  .btn {
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .btn-primary {
    background: var(--color-primary);
    color: white;
  }
}

@layer utilities {
  .mt-4 { margin-top: 16px; }
  .text-center { text-align: center; }
}
```

这样，无论第三方库 CSS 多庞大，只要你把它的样式包进对应层，就永远在你的掌控之中。

### 4.2 合并第三方库到自己的层中

当引入 Tailwind、Bootstrap 等第三方库时，可以将其合并进你的层体系：

```css
/* 先声明你自己的层顺序 */
@layer custom, thirdparty;

/* 然后将第三方样式注入到指定层 */
@layer thirdparty {
  @import url('tailwindcss/base');
  @import url('tailwindcss/utilities');
}
```

这让你能在 `custom` 层中轻松覆盖第三方样式，而不用担心库的版本升级导致覆盖失效。

### 4.3 解决 `!important` 地狱

```css
@layer base {
  .modal { display: none !important; } /* 在层内使用仍然受层优先级约束 */
}
```

这比全局 `!important` 好太多——即使在 `base` 层里加了 `!important`，只要另一个层优先级更高，仍然能覆盖它：

```css
@layer utilities {
  .modal.is-active { display: flex !important; } /* 优先级更高，覆盖上面 */
}
```

### 4.4 配合 @property 实现动态主题

```css
@layer tokens, components;

@layer tokens {
  @property --theme-accent {
    syntax: '<color>';
    inherits: false;
    initial-value: #3b82f6;
  }
}

@layer components {
  .badge {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    /* --theme-accent 可被 JS 动态修改，且支持过渡动画！ */
    transition: background 0.3s, color 0.3s;
  }
}
```

## 五、常见误区与避坑指南

### 5.1 重复声明同一个层不会创建新层

```css
@layer base;
@layer base;  /* 这是同一个 base 层，不是新层 */
@layer base {
  body { color: red; }
}

@layer base {
  h1 { color: blue; } /* 追加到同一个 base 层 */
}
```

`h1` 和 `body` 都在同一个 `base` 层内，按正常级联规则生效。

### 5.2 层不能动态切换

```css
/* ❌ 无效！层名不能是变量 */
@layer var(--my-layer) {
  .foo { color: red; }
}
```

### 5.3 unlayered 样式的"特权"

不在任何层内的样式（unlayered styles）优先级高于所有已声明的层。因此**最佳实践是**：将所有 CSS 都放进层中，保持架构一致性：

```css
/* ✅ 推荐：全局包裹所有样式 */
@layer base, components, utilities;

@layer base { /* 所有基础样式 */ }
@layer components { /* 所有组件样式 */ }
@layer utilities { /* 所有工具类 */ }
```

## 六、浏览器支持与渐进增强

```css
/* 用 @supports 检测是否支持层 */
@supports (cascade-layers: auto) {
  @layer base, components, utilities;
  /* 层优先的代码 */
}

/* 不支持时降级为普通 CSS 架构 */
@supports not (cascade-layers: auto) {
  /* 传统优先级处理 */
}
```

目前所有主流浏览器（Chrome 99+、Firefox 97+、Safari 15.4+）均已支持，可以放心使用。

## 七、总结

| 特性 | 传统方案 | Cascade Layers |
|------|---------|---------------|
| 优先级控制 | 靠选择器权重 / `!important` | 显式声明层顺序 |
| 第三方库隔离 | 依赖源码顺序或权重叠加 | 层体系天然隔离 |
| 可维护性 | 随项目增长急剧下降 | 保持清晰架构 |
| 调试难度 | 高（`!important` 蔓延） | 低（层名即上下文） |
| 浏览器支持 | 所有浏览器 | 主流浏览器全面支持 |

Cascade Layers 不仅仅是一个语法特性，更是 CSS 架构思维的一次升级——从"用权重博弈"到"用顺序设计"。掌握它，你的 CSS 代码库将焕然一新。

---

*本文由小虾子 🦐 撰写*
