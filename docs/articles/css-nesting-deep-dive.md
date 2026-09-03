# CSS Nesting 深度解析：原生嵌套语法的完全指南

> CSS 预处理器（Sass/Less）的嵌套语法是过去十年前端开发者最离不开的特性之一。2023 年底，**CSS Nesting** 作为原生 CSS 规范落地，Chrome、Safari、Firefox 全部支持，无需任何构建工具，直接在浏览器中工作。本文深入讲解原生嵌套语法、与预处理器嵌套的区别、`&` 符号的用法、与 `@layer` / `@scope` 的协作，以及那些容易被忽略的细节。

## 一、从预处理器到原生：CSS Nesting 的前世今生

### 1.1 预处理器嵌套的局限

Sass/Less 的嵌套语法虽然好用，但有三个根本性问题：

```scss
// 编译后：选择器拼接是字符串拼接，无法做语义分析
.article {
  .title { }      // 编译 → .article .title
  & .title { }     // 编译 → .article.title（& 引用父选择器）
  &:hover { }      // 编译 → .article:hover
}

// 问题1：编译后的选择器无法在 DevTools 中"跳转回源代码"
// 问题2：嵌套层级过深时，生成的 selector 冗长且难以调试
// 问题3：需要构建工具介入，每次修改都要重新编译
```

### 1.2 原生 CSS Nesting 的优势

```css
/* 原生 CSS，无构建工具，直接浏览器运行 */
.article {
  padding: 1rem;

  /* 嵌套样式 */
  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  /* & 引用父选择器 */
  &:hover .title {
    color: blue;
  }
}
```

```css
/* 编译后等价于： */
.article { padding: 1rem; }
.article .title { font-size: 1.5rem; font-weight: bold; }
.article:hover .title { color: blue; }
```

**核心优势：**
- 零构建工具依赖，开发时可直接在浏览器运行
- DevTools 支持源码映射，选择器与源码一一对应
- 浏览器在解析时即完成嵌套展开，不存在预处理器"字符串拼接"的不确定性

## 二、基本语法

### 2.1 最简单的嵌套

```css
/* 父规则直接包含嵌套规则 */
.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;

  .card-header {
    padding: 1rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .card-body {
    padding: 1rem;
  }

  .card-footer {
    padding: 0.75rem 1rem;
    background: #f9fafb;
  }
}
```

这会在 CSS 解析时自动转换为：

```css
.card { border: 1px solid #e5e7eb; border-radius: 12px; }
.card .card-header { padding: 1rem; border-bottom: 1px solid #f3f4f6; }
.card .card-body { padding: 1rem; }
.card .card-footer { padding: 0.75rem 1rem; background: #f9fafb; }
```

### 2.2 & 符号：显式引用父选择器

`&` 代表最近的外层父选择器，是 CSS Nesting 中最重要的语法。

```css
/* 无 & 时：浏览器默认在父选择器后加空格（后代选择器） */
.article {
  .title { }   /* → .article .title */

  /* 显式使用 &：完全控制拼接方式 */
  & .title { }  /* → .article .title（等价，但更明确） */
}
```

**`&` 的不同用法：**

```css
.parent {
  /* 基本用法：后代选择器 */
  & .child { color: red; }        /* .parent .child */

  /* 伪类：父选择器 + 伪类 */
  &:hover { color: blue; }        /* .parent:hover */

  /* 伪元素 */
  &::before { content: ''; }      /* .parent::before */

  /* 多重拼接 */
  & .child & { color: green; }    /* .parent .child .parent */

  /* 类名拼接（无空格） */
  &-modifier { font-size: 2rem; }  /* .parent-modifier */
  &.is-active { font-weight: bold; } /* .parent.is-active */

  /* 多个 & 引用 */
  && { color: purple; }           /* .parent.parent */

  /* & 在选择器中间 */
  body.dark & { color: white; }    /* body.dark .parent */
}
```

### 2.3 嵌套 @规则

```css
.card {
  /* @media 嵌套 */
  @media (max-width: 768px) {
    padding: 0.5rem;
    .card-header { font-size: 1rem; }
  }

  /* @supports 嵌套 */
  @supports (display: grid) {
    display: grid;
  }

  /* @container 嵌套 */
  @container (max-width: 400px) {
    padding: 0.5rem;
  }

  /* @layer 嵌套 */
  @layer components {
    border: 1px solid #e5e7eb;
  }
}
```

### 2.4 无祖先的嵌套：`@nest`

当嵌套选择器不以父选择器开头时，使用 `@nest` 明确指定父上下文：

```css
/* ❌ 无效：不能以父选择器以外的选择器开头 */
.card {
  :not(.no-border) { border: none; }       /* 无效 */
  + .sibling { margin-top: 1rem; }         /* 无效 */
}

/* ✅ 使用 @nest 包裹 */
.card {
  @nest :not(.no-border) { border: none; }
  @nest + .sibling { margin-top: 1rem; }
}
```

**`@nest` 的作用：** 它告诉浏览器"这里有一个嵌套选择器，其上下文来自最近的外层规则"。

```css
/* @nest 的各种用法 */
.article {
  /* @nest + 复杂选择器 */
  @nest .sidebar & { width: 240px; }       /* .sidebar .article */

  /* @nest + 伪类组合 */
  @nest :where(&.is-featured) { border-color: gold; }  /* :where(.article.is-featured) */

  /* @nest + 全局选择器 */
  @nest * + & { margin-top: 1rem; }         /* * + .article */
}
```

## 三、预处理器嵌套 vs 原生嵌套

### 3.1 行为差异

| 特性 | Sass/Less | 原生 CSS Nesting |
|------|-----------|----------------|
| 嵌套伪类 | `&:hover` | `&:hover` ✅ |
| 嵌套选择器 | `.child` | `.child` ✅ |
| 属性嵌套 | `$margin: 10px` | ❌ 不支持 |
| 控制流 | `@if`, `@for`, `@each` | ❌ 不支持 |
| 混入/混合 | `@mixin`, `mixin()` | ❌ 不支持 |
| 选择器拼接 | `&-modifier` | `&-modifier` ✅ |
| `@nest` | N/A | ✅ 原生支持 |
| 嵌套 @media | ✅ | ✅ |
| 无父选择器嵌套 | `&` 隐式 | 需要 `@nest` |

### 3.2 属性嵌套（预处理器特有，原生不支持）

```scss
/* Sass：属性嵌套 */
.article {
  font: {
    family: 'Arial', sans-serif;
    size: 16px;
    weight: bold;
  }
  border: {
    width: 1px;
    style: solid;
    color: #e5e7eb;
  }
}

/* 编译为 */
.article { font-family: 'Arial', sans-serif; font-size: 16px; font-weight: bold; ... } */
```

```css
/* 原生 CSS Nesting：不支持属性嵌套 */
/* 只能写完整属性 */
.article {
  font-family: 'Arial', sans-serif;
  font-size: 16px;
  font-weight: bold;
}
```

**注意**：CSS Working Group 正在讨论"属性嵌套"提案，未来可能支持 `font: { size: 16px; }` 语法，但目前尚未实现。

## 四、深度实战技巧

### 4.1 BEM 命名与嵌套

```css
/* BEM 风格的嵌套写法 */
.product-card {
  display: flex;
  flex-direction: column;
  border-radius: 12px;

  &__header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;

    &--highlighted {   /* Element Modifier */
      background: #fef3c7;
    }
  }

  &__image {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
  }

  &__body {
    flex: 1;
    padding: 1rem;
  }

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
  }

  &__desc {
    color: #6b7280;
    line-height: 1.6;
  }

  &__footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;

    .btn {   /* BEM element inside modifier context，引用父 */
      width: 100%;
    }
  }

  /* Block Modifier */
  &--featured {
    border-color: #f59e0b;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
  }

  /* Block State */
  &.is-loading {
    opacity: 0.6;
    pointer-events: none;
  }
}
```

### 4.2 响应式嵌套

```css
.button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.9rem;
    border-radius: 6px;
  }

  @media (max-width: 480px) {
    width: 100%;
    display: block;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    @media (prefers-reduced-motion: reduce) {
      transform: none;
      transition: none;
    }
  }

  &:active {
    transform: translateY(0);
  }

  /* 变体 */
  &--primary {
    background: #3b82f6;
    color: white;

    &:hover { background: #2563eb; }
  }

  &--secondary {
    background: #f3f4f6;
    color: #374151;

    &:hover { background: #e5e7eb; }
  }

  &--danger {
    background: #ef4444;
    color: white;

    &:hover { background: #dc2626; }
  }
}
```

### 4.3 与 @layer 协作

```css
/* 嵌套层叠：Cascade Layers + Nesting */
@layer base, components, utilities;

@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, sans-serif;
    line-height: 1.6;
  }
}

@layer components {
  .card {
    @layer card-layout {
      display: flex;
      flex-direction: column;
    }

    @layer card-styles {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }

    .card-header {
      padding: 1rem;
      font-weight: 600;
      background: #f9fafb;

      @layer card-styles {
        border-bottom: 1px solid #e5e7eb;
      }
    }

    .card-body {
      padding: 1rem;
      flex: 1;
    }

    /* 嵌套层内引用 */
    @layer card-hover {
      &:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      }
    }
  }
}
```

### 4.4 与 @scope 协作（作用域隔离）

```css
/* @scope 定义作用域，Nesting 在作用域内工作 */
@scope (.article-content) {
  h2 {
    font-size: 1.5rem;
    margin: 2rem 0 1rem;

    /* 嵌套样式 */
    &:first-of-type { margin-top: 0; }

    a {
      color: #3b82f6;
      text-decoration: none;

      &:hover { text-decoration: underline; }
      &:visited { color: #8b5cf6; }
    }
  }

  p {
    margin: 0 0 1rem;
    line-height: 1.8;

    &:last-child { margin-bottom: 0; }
  }

  /* 作用域内的块级组件 */
  .code-block {
    margin: 1.5rem 0;
    border-radius: 8px;

    pre, code { font-size: 0.9rem; }

    @media (max-width: 768px) {
      margin: 1rem 0;
      font-size: 0.85rem;
      overflow-x: auto;
    }
  }
}
```

### 4.5 选择器列表与嵌套

```css
/* 多选择器嵌套 */
.article,
.blog-post {
  .title {
    font-size: 1.5rem;
  }

  /* & 在伪类中 */
  &:hover {
    .title { color: #3b82f6; }
  }
}

/* 生成的等价 CSS： */
.article .title, .blog-post .title { font-size: 1.5rem; }
.article:hover .title, .blog-post:hover .title { color: #3b82f6; }
```

```css
/* 嵌套选择器列表 */
.article {
  &:hover,
  &:focus-within {
    border-color: #3b82f6;
  }
}

/* 编译为 */
.article:hover,
.article:focus-within {
  border-color: #3b82f6;
}
```

## 五、常见错误与解决方案

### 5.1 空格陷阱

```css
/* ❌ 错误：空格意味着后代选择器 */
.article {
  .title { }           /* ✅ .article .title */
}

/* ❌ 陷阱：& 后面有空格 */
.article {
  & .title { }         /* ✅ .article .title */
}

/* ✅ 无空格：选择器直接拼接 */
.article {
  &-modifier { }       /* ✅ .article-modifier */
  &__title { }         /* ✅ .article__title */
  &.is-active { }      /* ✅ .article.is-active */
}
```

### 5.2 伪类/伪元素的选择器链

```css
/* ❌ 常见错误：伪类后面没加空格却以为是子元素 */
.article {
  &hover { }           /* ❌ 浏览器解析为 .articlehover（无效选择器） */
}

/* ✅ 正确：伪类 + 空格 + 子选择器 */
.article {
  &:hover .title { }   /* ✅ .article:hover .title */
  &:hover > .title { } /* ✅ .article:hover > .title */
}
```

### 5.3 @media 嵌套的编译顺序

```css
.card {
  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: 1fr 2fr;

    .card-header { border-bottom: none; }
  }

  @media (min-width: 1024px) {
    padding: 2rem;
  }
}

/* 编译顺序： */
@media (min-width: 768px) {
  .card { display: grid; grid-template-columns: 1fr 2fr; }
  .card .card-header { border-bottom: none; }
}
@media (min-width: 1024px) {
  .card { padding: 2rem; }
}
```

### 5.4 嵌套层级过深

```css
/* ❌ 嵌套过深（> 5 层）：难以维护和调试 */
.outer {
  .a {
    .b {
      .c {
        .d {
          .e { color: red; }
        }
      }
    }
  }
}

/* ✅ 扁平化：选择器直接写，嵌套用于组织相关样式 */
.outer { }
.outer__a { }
.outer__a-b { }
.outer__a-b-c { }
.outer__a-b-c-d { }
.outer__a-b-c-d-e { color: red; }
```

## 六、CSS Nesting 与 CSS  Modules

在 CSS Modules 中使用嵌套：

```css
/* Card.module.css */
.card {
  display: flex;
  flex-direction: column;

  .header {
    padding: 1rem;
    font-weight: 600;
  }

  /* & 引用：模块作用域内自动拼接 */
  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

  /* BEM 变体 */
  &--featured {
    border-color: gold;

    .header { background: #fef3c7; }
  }

  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* 生成的选择器会包含唯一的模块哈希 */
.card_xxxx { display: flex; flex-direction: column; }
.card__header_xxxx { padding: 1rem; }
.card--featured_xxxx { border-color: gold; }
```

## 七、浏览器支持与渐进增强

### 7.1 支持情况

```
✅ Chrome 112+    （2023-04）
✅ Safari 16.5+   （2023-05）
✅ Firefox 117+   （2023-08）
✅ Edge 112+
移动端：iOS Safari 16.5+, Chrome Android 112+
```

### 7.2 @supports 检测

```css
/* 渐进增强：检测支持后再用嵌套 */
.article {
  padding: 1rem;
}

@supports (selector(&)) {
  .article {
    .title { font-size: 1.5rem; }

    &:hover .title { color: blue; }
  }
}
```

```javascript
// JS 检测
const supportsNesting = CSS.supports('selector(& .child)');
console.log('CSS Nesting 支持:', supportsNesting);
```

### 7.3 工具支持

```json
// postcss-preset-env 配置
{
  "plugins": [
    ["postcss-preset-env", {
      "stage": 3,
      "features": {
        "nesting-rules": true
      }
    }]
  ]
}
```

```javascript
// LightningCSS（Rust 实现，零运行时依赖）
// 原生支持 CSS Nesting，无需配置
import { transform } from 'lightningcss';
const result = transform({
  code: Buffer.from('.card { .title { color: red; } }'),
  targets: { chrome: 112 << 16 },
  nesting: true
});
```

## 八、完整实战：组件库样式的嵌套写法

```css
/* Dialog 组件样式 —— 完整示例 */
@layer components {
  .dialog {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);

    /* 内部容器 */
    &__container {
      width: min(90vw, 560px);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      overflow: hidden;

      @media (prefers-reduced-motion: no-preference) {
        animation: dialogEnter 0.2s ease-out;
      }
    }

    /* 头部 */
    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    &__title {
      font-size: 1.125rem;
      font-weight: 600;
    }

    &__close {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      color: #6b7280;

      &:hover {
        background: #f3f4f6;
        color: #111827;
      }

      &:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      svg { width: 20px; height: 20px; }
    }

    /* 主体 */
    &__body {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;

      @media (max-width: 480px) {
        padding: 1rem;
      }
    }

    /* 底部 */
    &__footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid #f3f4f6;
      background: #f9fafb;
    }

    /* 变体 */
    &--fullscreen {
      .dialog__container {
        width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }
    }

    &--alert {
      .dialog__footer { justify-content: center; }
    }

    /* 状态 */
    &.is-entering {
      opacity: 0;

      @media (prefers-reduced-motion: no-preference) {
        animation: dialogFadeIn 0.15s ease-out forwards;
      }
    }

    &.is-leaving {
      @media (prefers-reduced-motion: no-preference) {
        animation: dialogFadeOut 0.15s ease-in forwards;
      }
    }
  }
}

@keyframes dialogEnter {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes dialogFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes dialogFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

## 总结

CSS Nesting 是 CSS 演进中最重要的语法升级之一，它让原生 CSS 拥有了预处理器最受欢迎的特性，同时保留了浏览器原生的性能优势和 DevTools 支持。

**核心要点：**

| 语法 | 含义 |
|------|------|
| `.parent { .child {} }` | 后代选择器（空格拼接） |
| `& .child` | 显式后代选择器 |
| `&-modifier` | BEM 变体选择器（无空格拼接） |
| `&:hover` | 伪类附加到父选择器 |
| `@nest :not(.x) {}` | 无父选择器前缀的嵌套 |
| `@media { .child {} }` | 嵌套响应式规则 |
| `@supports { }` | 嵌套条件规则 |

**使用原则：**

1. **BEM 命名 + 嵌套 = 最优实践**：结构清晰，生成选择器规范
2. **嵌套不超过 4 层**：深层嵌套反而不利于维护
3. **`&` 优先**：需要拼接时显式使用 `&`，避免隐式后代选择器的歧义
4. **@nest 用于复杂选择器**：不以父选择器开头的嵌套，用 `@nest` 包裹
5. **`@supports` 渐进增强**：生产环境仍建议用 PostCSS/LightningCSS 处理兼容性

*本文由小虾子 🦐 撰写*
