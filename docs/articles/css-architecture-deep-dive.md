---
title: CSS Architecture 深度解析：模块化、作用域与样式系统的工程实践
date: 2026-06-11
---

# CSS Architecture 深度解析：模块化、作用域与样式系统的工程实践

> CSS 是前端最难管理的资产之一。随着应用规模增长，全局污染、命名冲突、样式冲突、死代码清理等问题接踵而来。CSS Modules、CSS-in-JS、Tailwind CSS、Vanilla Extract、PostCSS……每种方案都有自己的哲学和使用场景。本文从架构角度系统梳理这些方案，帮你做出适合项目的选择。

本文由小虾子 🦐 撰写

## CSS 的历史困境

### 全局作用域问题

```css
/* styles.css —— 全局作用域，一切皆共享 */
.button { padding: 12px; }
.card { padding: 12px; }  /* 冲突！ */

/* 在 React 组件中 */
<button class="button">点我</button>
/* 不知道这个 .button 和哪里冲突 */
/* 很难重构，因为不知道谁在用 */
```

### CSS 权重的噩梦

```css
/* 越来越强的权重 */
.header .nav .list .item .link { color: blue; }     /* 0-1-4 */
.header .nav .list .item .link.active { color: red; } /* 0-2-4 */

/* 不得已用 !important */
.button { padding: 12px !important; } /* 污染扩散 */

/* 维护者心态崩溃 */
```

### 现代 CSS 架构的核心目标

```
CSS 架构三剑客：
─────────────────────────────────
1. 作用域隔离（Scope）
   → 样式不污染全局，不同组件/模块互不干扰

2. 样式复用（DRY）
   → 避免重复样式，支持设计系统和主题变量

3. 死代码清理（Tree-shaking）
   → 只打包实际使用的样式，减少 CSS 体积
```

---

## 方案一：CSS Modules（编译时作用域）

### 核心理念

```
CSS Modules：
─────────────────────────────────
- 文件级作用域（每个 .module.css 独立作用域）
- 编译时转换（将类名编译成唯一 hash）
- 完全兼容普通 CSS（不需要学新语法）
- 支持 PostCSS 生态（Tailwind、Autoprefixer 等）
```

### 基本用法

```css
/* Button.module.css */
.button {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  background: #3b82f6;
  color: white;
}

.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

```tsx
// Button.tsx
import styles from './Button.module.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'default';
  disabled?: boolean;
}

export function Button({ children, variant = 'default', disabled }: ButtonProps) {
  const className = [
    styles.button,
    variant === 'primary' && styles.primary,
    disabled && styles.disabled,
  ].filter(Boolean).join(' ');

  return <button className={className} disabled={disabled}>{children}</button>;
}
```

### 编译后

```css
/* 编译后的 CSS（类名被 hash 化） */
.Button_button__1a2b3 { padding: 12px 24px; border-radius: 8px; }
.Button_primary__4c5d6 { background: #3b82f6; color: white; }
.Button_disabled__7e8f9 { opacity: 0.5; cursor: not-allowed; }
```

> **优势**：零运行时开销，完全兼容普通 CSS，Vite/Webpack 原生支持
> **劣势**：动态样式（条件类名）需要手动拼接，不能像 Tailwind 那样内联

### 进阶用法

```css
/* 复用其他模块的样式（composition） */
.card {
  composes: card-base from './base.module.css';
  composes: shadow-lg from './shadows.module.css';

  /* 自己的样式 */
  padding: 16px;
}
```

---

## 方案二：Tailwind CSS（工具类优先）

### 核心理念

```
Tailwind CSS = Utility-First CSS
─────────────────────────────────
- 不写 CSS 类名，用 HTML 中直接组合工具类
- 所有样式都是单一职责的工具类
- 配置驱动设计系统（tailwind.config.js）
- JIT 编译器（按需生成 CSS，零死代码）
```

### 基本用法

```tsx
// 不写 CSS，直接在 JSX 中组合工具类
export function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h2>
      <div className="text-gray-600 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function Button({ children, variant = 'primary', disabled }) {
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    ghost: 'bg-transparent text-blue-500 hover:bg-blue-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button
      className={`
        px-4 py-2 rounded-lg font-medium transition-colors
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

### 配置设计系统

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 扩展设计 token
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),  // 表单样式插件
    require('@tailwindcss/typography'), // 文章内容排版插件
  ],
};
```

### Tailwind v4（最新）

```bash
# Tailwind CSS v4（2025）
npm install tailwindcss@next @tailwindcss/vite
```

```css
/* v4 不需要配置文件，直接用 @theme */
@import "tailwindcss";

@theme {
  --color-brand-50: #f0f9ff;
  --color-brand-500: #0ea5e9;

  --spacing-18: 4.5rem;
  --spacing-88: 22rem;

  --animate-fade-in: fadeIn 0.3s ease-out;
}

@layer components {
  .card {
    @apply bg-white rounded-xl shadow-lg p-6;
  }
  .btn-primary {
    @apply bg-brand-500 text-white px-4 py-2 rounded-lg font-medium;
  }
}
```

---

## 方案三：CSS-in-JS（运行时样式系统）

### 核心理念

```
CSS-in-JS = 在 JavaScript 中写 CSS
─────────────────────────────────
- 样式和组件共存（colocation）
- 主题系统（动态样式）
- 运行时开销（Styled Components、Emotion）
- 零运行时（Vanilla Extract、Linaria）
```

### Styled Components（运行时）

```tsx
import styled from 'styled-components';

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 8px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'ghost' }>`
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;

  ${({ $variant }) =>
    $variant === 'primary'
      ? `background: #3b82f6; color: white;`
      : `background: transparent; color: #3b82f6;`}

  &:hover { opacity: 0.9; }
`;

// 使用
export function MyCard({ title }) {
  return (
    <Card>
      <Title>{title}</Title>
      <Button $variant="primary">提交</Button>
    </Card>
  );
}
```

### Vanilla Extract（零运行时）

```css
/* Button.css.ts —— TypeScript + CSS */
import { style, globalStyle } from '@vanilla-extract/css';

export const button = style({
  padding: '8px 16px',
  borderRadius: '8px',
  fontWeight: 600,
  transition: 'all 0.2s',
  cursor: 'pointer',
});

export const primary = style({
  background: '#3b82f6',
  color: 'white',
});

export const ghost = style({
  background: 'transparent',
  color: '#3b82f6',
});

// 伪类和伪元素
export const buttonHover = style({
  selectors: {
    [`${button}:hover &`]: {
      opacity: 0.9,
    },
  },
});
```

```tsx
// Button.tsx
import * as styles from './Button.css';

export function Button({ children, variant = 'primary' }) {
  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
```

> **Vanilla Extract 优势**：TypeScript 支持 + 编译时生成 CSS 文件 + 零运行时 + 完美 IDE 支持

---

## 方案四：PostCSS（CSS 工具链）

### 核心理念

```
PostCSS = CSS 的 Babel
─────────────────────────────────
- 用 JS 插件转换 CSS（AST 转换）
- 可以组合任意数量的插件
- 支持 Tailwind（windicss、@tailwindcss/postcss）
- 支持 Autoprefixer、CSS Modules、cssnano
```

### 配置示例

```javascript
// postcss.config.js
export default {
  plugins: [
    // 1. Tailwind CSS（JIT 编译器）
    require('@tailwindcss/postcss'),

    // 2. Autoprefixer（自动添加厂商前缀）
    require('autoprefixer')({
      grid: 'autoplace',  // Grid 布局自动前缀
    }),

    // 3. cssnano（压缩 + 优化）
    process.env.NODE_ENV === 'production'
      ? require('cssnano')({
          preset: 'default',  // 默认优化
        })
      : false,
  ],
};
```

### 自定义 PostCSS 插件

```javascript
// 简化版：自动生成 BEM 类名
const postcssBem = () => {
  return {
    postcssPlugin: 'postcss-bem',
    Rule(rule) {
      // 处理 BEM：.card__header--active → 多个规则
      const selector = rule.selector;
      if (selector.includes('__') || selector.includes('--')) {
        // BEM 解析逻辑
        rule.walkDecls(decl => {
          // 转换逻辑
        });
      }
    },
  };
};

module.exports = { plugins: [postcssBem] };
```

---

## 方案五：CSS Layers（原生作用域）

### 核心理念

```
CSS @layer = CSS 原生的作用域机制
─────────────────────────────────
- CSS Cascade Layers（2022 年浏览器原生支持）
- 无需构建工具，直接在 CSS 中声明优先级
- 与 CSS Modules/CSS-in-JS 互补
```

### 基本用法

```css
/* 定义 layers（优先级从低到高） */
@layer reset, base, components, utilities;

@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

@layer base {
  body { font-family: system-ui; }
  a { color: #3b82f6; }
}

@layer components {
  .card {
    padding: 24px;
    border-radius: 12px;
  }
  .button {
    padding: 8px 16px;
    /* 如果 .button 和 .card 冲突，
       components 层 > utilities 层 */
  }
}

@layer utilities {
  .mt-4 { margin-top: 1rem; }
  /* utilities 优先级最高 */
}
```

### 与 Tailwind 结合

```css
/* 在 Tailwind 中使用 layers */
@layer components {
  .card {
    @apply bg-white rounded-xl shadow-lg p-6;
  }
  .btn {
    @apply px-4 py-2 rounded-lg font-medium;
  }
}

@layer utilities {
  .scrollbar-hide {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
}
```

---

## 方案横向对比

### 功能对比

| 维度 | CSS Modules | Tailwind CSS | Styled Components | Vanilla Extract | CSS Layers |
|------|-------------|--------------|-------------------|----------------|------------|
| 作用域 | ✅ 文件级 | ✅ 类名级 | ✅ 组件级 | ✅ 文件级 | ✅ 层叠级 |
| TypeScript | ⚠️ 一般 | ✅ | ✅ | ✅ 完美 | ✅ |
| 主题系统 | ❌ | ✅ 设计 token | ✅ 运行时 | ⚠️ 编译时 | ❌ |
| 零运行时 | ✅ | ✅（JIT） | ❌ | ✅ | ✅ |
| 学习曲线 | ⭐ 低 | ⭐⭐⭐（工具类） | ⭐⭐（模板语法） | ⭐⭐（TS + CSS） | ⭐（原生语法） |
| IDE 支持 | ⚠️ 一般 | ✅ IntelliSense | ✅ | ✅ 完美 | ✅ |
| Tree-shaking | ⚠️ | ✅（JIT） | ❌ | ✅ | ✅ |
| 包体积 | ~0KB | ~7KB | ~13KB | ~0KB | ~0KB |

### 性能对比

```
打包后 CSS 体积（示例项目）：
─────────────────────────────────
Tailwind CSS v4（JIT）：   ~12 KB（只打包使用的类）
CSS Modules：              ~8 KB（只打包使用的组件）
Vanilla Extract：          ~8 KB（只打包使用的样式）
CSS Layers + PostCSS：     ~10 KB（取决于插件）
Styled Components：         ~13 KB（运行时）
```

---

## 选择指南

```
如何选择 CSS 架构？
─────────────────────────────────
用 CSS Modules：
  ✅ 已有项目（渐进迁移，无破坏性改动）
  ✅ 想要零运行时 + 接近原生 CSS 体验
  ✅ 不想要学工具类语法
  ✅ Vue/React/普通 HTML 通用

用 Tailwind CSS：
  ✅ 新项目（从零开始，快速开发）
  ✅ 设计系统驱动（主题配置简单）
  ✅ 想要极致开发速度（不用切换文件）
  ✅ 大型团队（设计一致性有保障）

用 Vanilla Extract：
  ✅ 想要 TypeScript 完美支持
  ✅ 想要零运行时 + CSS-in-JS 的 DX
  ✅ 新项目（接受编译步骤）
  ✅ 需要设计系统（themes）

用 CSS-in-JS（Styled Components）：
  ✅ 需要复杂的运行时主题切换
  ✅ 动态样式逻辑复杂（基于 props 变化）
  ✅ 小型项目（~13KB 运行时可接受）

用 CSS Layers：
  ✅ 想要原生解决方案（无构建工具依赖）
  ✅ 需要优先级控制（reset > base > components）
  ✅ 和其他方案结合使用
```

---

## 混用策略

```
现实项目往往是混用的：
─────────────────────────────────
CSS Modules（组件样式）：
  复杂组件（Card、Modal、Dropdown）用 CSS Modules
  不需要工具类，有独立设计语言

Tailwind CSS（页面布局 + 工具类）：
  页面布局用 Tailwind 工具类
  快速原型开发

Vanilla Extract（设计系统）：
  Button、Input、Select 等基础组件用 Vanilla Extract
  统一的设计 token

CSS Layers（全局优先级）：
  用 @layer 控制 reset/base/components/utilities 的优先级
```

### 具体混用示例

```tsx
/* 1. CSS Modules：复杂组件 */
import styles from './Card.module.css';

/* 2. Tailwind：页面布局 */
function Page() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card title="最新文章">
          {/* ... */}
        </Card>
      </div>
    </div>
  );
}

/* 3. Vanilla Extract：设计系统组件 */
import * as buttonStyles from './Button.css';

export function Button({ children, variant }) {
  return (
    <button className={buttonStyles.base + ' ' + buttonStyles[variant]}>
      {children}
    </button>
  );
}

/* 4. CSS Layers：全局样式 */
@layer base {
  html { font-size: 16px; }
  body { font-family: system-ui; }
}
```

---

## 死代码清理

### 常见问题

```
CSS 死代码的来源：
─────────────────────────────────
1. 旧组件残留（组件删了，CSS 没删）
2. 未使用的变体（button--danger 定义了但没使用）
3. 覆盖样式（写了 3 个 .button { } 块，合并后有冗余）
4. 设计系统废弃（颜色/字体 token 不用了）
```

### 清理方案

```bash
# 1. Tailwind CSS（天然零死代码）
# JIT 编译器只打包使用的工具类

# 2. PurgeCSS（通用方案）
# 在 vite.config.ts 中配置
import { VitePWA } from 'vite-plugin-pwa';

export default {
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 按需分割 CSS
        },
      },
    },
  },
};

# 3. uncss（命令行工具）
npx uncss http://localhost:3000

# 4. CSS Modules（天然零死代码）
# 每个 .module.css 只打包使用的样式
```

---

## 常见问题

### Q: Tailwind 会让 HTML 变丑吗？

```
实际影响：
─────────────────────────────────
<!-- 使用前 -->
<button class="btn-primary">提交</button>

<!-- 使用后 -->
<button class="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">提交</button>

解决方案：
1. 用 @apply 提取重复样式到 components 层
2. 用 clsx/classnames 库组合类名
3. 提取为独立组件（推荐）
```

### Q: CSS Modules 和 Tailwind 哪个性能更好？

```
Tailwind CSS：
  生成单一 CSS 文件，~12 KB
  浏览器只请求一次（无额外 HTTP 请求）

CSS Modules：
  每个模块单独生成 CSS 文件
  Vite 会合并为 ~8 KB
  性能差异可以忽略

真正影响性能的是：
  - HTTP/2 并行加载
  - CSS 压缩（cssnano）
  - 关键 CSS 内联
  - 非关键 CSS 延迟加载
```

### Q: CSS Layers 和 CSS Modules 冲突吗？

```
不冲突！可以组合：
─────────────────────────────────
CSS Layers → 控制全局优先级（reset/base/components/utilities）
CSS Modules → 控制组件级作用域（局部 .card 不污染全局）

@layer components {
  /* 这个 .card 只在 components 层生效 */
  .card { padding: 24px; }
}
```

---

## 总结

```
CSS 架构选型决策树：
─────────────────────────────────
新项目 → Tailwind CSS（快速 + 设计系统）
  └→ 需要极致 TypeScript 支持 → Vanilla Extract
  └→ 需要运行时主题切换 → Styled Components

已有项目 → CSS Modules（渐进迁移）
  └→ 需要工具类 → 逐步引入 Tailwind 工具类

需要原生方案 → CSS Layers + PostCSS
  └→ 需要 Autoprefixer + cssnano → PostCSS 工具链

现实项目建议：Tailwind + CSS Modules 混用
  - Tailwind 处理页面布局和快速原型
  - CSS Modules 处理复杂组件样式
  - Vanilla Extract 用于共享设计系统组件

关键原则：
─────────────────────────────────
1. 不要混用太多方案（维护成本高）
2. 选择后坚持一致（团队统一）
3. 关注打包体积（零死代码）
4. 设计 token 统一管理（颜色/字体/间距）
```

CSS 架构没有银弹，但有适合项目阶段和团队规模的最佳方案——选对了，开发体验和性能都会大幅提升 🎨

本文由小虾e 🦐 撰写