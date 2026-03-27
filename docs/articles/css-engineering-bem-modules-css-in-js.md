# CSS 工程化实战：从 BEM 到 CSS Modules 再到 CSS-in-JS

> 发布时间：2026-03-21

随着前端项目规模增大，CSS 的维护成本急剧上升——命名冲突、样式污染、难以追踪的全局副作用……本文系统梳理主流 CSS 工程化方案，帮你选对适合项目的方案。

## CSS 的痛点

```css
/* 全局污染：这个 .title 会影响所有页面 */
.title {
  font-size: 24px;
  color: red;
}

/* 命名冲突：不同组件的 .btn 互相覆盖 */
.btn { background: blue; }
.btn { background: green; } /* 后者覆盖前者 */
```

核心问题：**CSS 天生是全局的**，没有作用域隔离。

---

## 方案一：BEM 命名规范

BEM（Block Element Modifier）是一种纯约定的命名方法论，不依赖任何工具。

### 命名规则

```
block__element--modifier
块名__元素名--修饰符
```

```css
/* Block：独立的功能组件 */
.card { }

/* Element：Block 的组成部分，用 __ 连接 */
.card__header { }
.card__body { }
.card__footer { }

/* Modifier：Block 或 Element 的状态/变体，用 -- 连接 */
.card--featured { }
.card__header--large { }
```

### 实战示例

```html
<div class="card card--featured">
  <div class="card__header">
    <h2 class="card__title">标题</h2>
  </div>
  <div class="card__body">
    <p class="card__text">内容</p>
  </div>
  <div class="card__footer">
    <button class="btn btn--primary btn--large">确认</button>
  </div>
</div>
```

```scss
.card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);

  &--featured {
    border: 2px solid #007bff;
  }

  &__header {
    padding: 16px;
    border-bottom: 1px solid #eee;
  }

  &__title {
    font-size: 18px;
    font-weight: bold;
  }
}
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 无需工具，零配置 | 类名冗长 |
| 语义清晰，可读性强 | 依赖团队自律 |
| 适合多人协作 | 嵌套深时类名很长 |

---

## 方案二：CSS Modules

CSS Modules 在构建时将类名转换为唯一哈希，实现真正的作用域隔离。

### 基本用法

```css
/* Button.module.css */
.btn {
  padding: 8px 16px;
  border-radius: 4px;
}

.primary {
  background: #007bff;
  color: white;
}

.large {
  padding: 12px 24px;
  font-size: 16px;
}
```

```jsx
// Button.jsx
import styles from './Button.module.css'

function Button({ variant = 'primary', size, children }) {
  return (
    <button className={`${styles.btn} ${styles[variant]} ${size ? styles[size] : ''}`}>
      {children}
    </button>
  )
}
```

构建后生成的 HTML：
```html
<!-- 类名被转换为唯一哈希，不会冲突 -->
<button class="btn_abc123 primary_def456">确认</button>
```

### 组合（Composes）

```css
/* base.module.css */
.base {
  font-family: sans-serif;
  font-size: 14px;
}

/* Button.module.css */
.btn {
  composes: base from './base.module.css'; /* 继承样式 */
  padding: 8px 16px;
}
```

### 在 Vue 中使用

```vue
<template>
  <button :class="$style.btn">点击</button>
</template>

<style module>
.btn {
  background: #007bff;
  color: white;
}
</style>
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 真正的作用域隔离 | 动态样式不方便 |
| 构建时处理，零运行时开销 | 类名不直观（调试时） |
| 与现有 CSS 生态兼容 | 跨组件共享样式稍麻烦 |

---

## 方案三：CSS-in-JS

将样式写在 JavaScript 中，与组件逻辑高度耦合。代表库：`styled-components`、`emotion`。

### styled-components

```bash
npm install styled-components
```

```jsx
import styled from 'styled-components'

// 创建带样式的组件
const Button = styled.button`
  padding: ${props => props.large ? '12px 24px' : '8px 16px'};
  background: ${props => props.primary ? '#007bff' : '#6c757d'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

// 使用
function App() {
  return (
    <>
      <Button primary>主要按钮</Button>
      <Button primary large>大号主要按钮</Button>
      <Button disabled>禁用按钮</Button>
    </>
  )
}
```

### 主题系统

```jsx
import { ThemeProvider } from 'styled-components'

const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    danger: '#dc3545',
  },
  spacing: {
    sm: '8px',
    md: '16px',
    lg: '24px',
  }
}

const Button = styled.button`
  background: ${props => props.theme.colors.primary};
  padding: ${props => props.theme.spacing.md};
`

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Button>使用主题的按钮</Button>
    </ThemeProvider>
  )
}
```

### emotion（更轻量）

```jsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const buttonStyle = css`
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border-radius: 4px;
`

function Button({ children }) {
  return <button css={buttonStyle}>{children}</button>
}
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 动态样式极其方便 | 有运行时开销 |
| 与组件逻辑高度内聚 | 包体积增大 |
| 主题系统强大 | 学习成本较高 |
| TypeScript 支持好 | SSR 配置复杂 |

---

## 方案四：Tailwind CSS（原子化 CSS）

不写自定义 CSS，直接在 HTML 中组合原子类。

```html
<!-- 传统写法 -->
<button class="btn btn--primary btn--large">确认</button>

<!-- Tailwind 写法 -->
<button class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
  确认
</button>
```

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#007bff',
      }
    }
  }
}
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 开发速度极快 | HTML 类名冗长 |
| 无需命名 | 初学曲线陡 |
| 构建后体积极小（PurgeCSS） | 高度定制化设计受限 |
| 设计系统一致性强 | 团队需统一规范 |

---

## 如何选择？

```
项目类型
├── 纯静态/多页面网站 → BEM + SCSS
├── Vue 项目
│   ├── 中小型 → <style scoped>（Vue 内置）
│   └── 大型/组件库 → CSS Modules 或 Tailwind
├── React 项目
│   ├── 需要动态主题/高度动态样式 → styled-components / emotion
│   ├── 追求性能/SSR → CSS Modules
│   └── 快速开发/设计系统 → Tailwind CSS
└── 组件库开发 → CSS Modules（零运行时，兼容性最好）
```

---

## 总结

| 方案 | 作用域隔离 | 动态样式 | 运行时开销 | 学习成本 |
|------|-----------|---------|-----------|---------|
| BEM | ❌（约定） | ✅ | 无 | 低 |
| CSS Modules | ✅ | 一般 | 无 | 低 |
| styled-components | ✅ | ✅✅ | 有 | 中 |
| Tailwind | ✅ | 一般 | 极小 | 中 |

没有银弹，根据项目规模、团队习惯、性能要求综合选择。很多大型项目会混用：Tailwind 处理布局和通用样式，CSS Modules 处理复杂组件。

---

*本文由小虾子 🦐 撰写*
