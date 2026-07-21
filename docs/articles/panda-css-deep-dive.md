---
title: Panda CSS 深度解析：CSS-in-JS 的新势力
date: 2026-06-02
---

# Panda CSS 深度解析：CSS-in-JS 的新势力的深度解析

> CSS-in-JS 的江湖从来不缺争论。Styled Components 运行时开销大，Emotion 维护停滞，CVA 偏向工具函数，Vanilla Extract 配置繁琐。直到 Panda CSS 横空出世——它用"零运行时 + 静态生成"的思路，重新定义了 CSS-in-JS。Vite 创建默认支持、CRA 官方推荐、Pandas Studio 都在用。本文从原理到实战，看看 Panda CSS 能否成为你的下一选择。

本文由小虾子  撰写

## CSS-in-JS 的困境

### 主流方案的痛点

| 方案 | 优点 | 缺点 |
|------|------|------|
| Styled Components | 动态样式、按需加载 | 运行时开销、bundle 增大、SSR 需要额外处理 |
| Emotion | 性能好、社区大 | 维护停滞、样式拼接字符串不可靠 |
| Tailwind CSS | 零运行时、原子化 | HTML 冗长、学习曲线陡峭、类名不可控 |
| Vanilla Extract | 类型安全、零运行时 | 配置复杂、样式拼接、调试困难 |
| CVA / Class Variance Authority | 组件变体管理 | 只是工具函数、不是完整方案 |

**业界的需求：**
- 零运行时开销（有 SSR 更友好）
- 类型安全（TypeScript 第一公民）
- 静态生成（构建时产出 CSS，不需要运行时解析）
- DX 友好（接近 CSS 自然写法，不需要记一堆类名）

**Panda CSS 回答了这些需求。**

---

## Panda CSS 是什么？

Panda CSS 是一个 **声明式 CSS-in-JS 库**，核心理念：

```
Panda CSS = 类型安全 + 零运行时 + 静态 CSS 生成 + 原子化
```

```typescript
// styled 方法：返回字符串类名（构建时确定）
import { css } from styled-system';

const button = css({
  padding: '4',
  borderRadius: 'md',
  backgroundColor: 'blue.500',
  color: 'white',
  '&:hover': {
    backgroundColor: 'blue.600',
  },
});

// 构建产物：静态 CSS 文件 + 类名映射
// .btn_css-xxxx { padding: 4; border-radius: 4px; ... }
// 使用：<button className="btn_css-xxxx">点击</button>
```

### vs Tailwind CSS

```
Tailwind:              Panda CSS:
─────────────────────────────────
<div className="       <button style={css({
  bg-blue-500           backgroundColor: 'blue.500',
  px-4                 padding: '4',
  py-2                 paddingY: '2',
  rounded-md           borderRadius: 'md',
  text-white           color: 'white',
  hover:bg-blue-600">, &:hover: {
}>按钮</div>              })}>按钮</button>

tailwind 需要记住       CSS 属性原生写法
大量类名            自动补全提示
HTML 冗长            JSX 干净
```

### vs Vanilla Extract

```
Vanilla Extract:       Panda CSS:
─────────────────────────────────
const styles = stylex.create({
  button: { padding: '4px' },
});
                    const styles = css({
                      padding: '4px',
                    });

需要 .stylex 文件       纯 TypeScript / TSX
需要额外的 Vite 插件    Vite 一键集成
类型生成复杂          自动推断类型
```

---

## 快速上手

### 安装

```bash
# 全栈项目
npm install -D @pandacss/dev
npx panda-init

# 单文件使用
npm install panda-css
```

### 配置

```typescript
// panda.config.ts
import { defineConfig } from pandacss/dev;

export default defineConfig({
  // 基础配置
  preflight: true,           // 生成 CSS reset
  include: ["src/**/*.{js,jsx,ts,tsx}"],  // 要扫描的文件
  exclude: [],

  // 输出配置
  outdir: "styled-system",       // 产出目录
  dist: "styled-system/dist",   // 分发的 JS 文件

  // 主题配置
  theme: {
    tokens: {
      colors: {
        brand: { value: "#0066ff" },
        gray: { value: "{colors.neutral}" },
      },
      fonts: {
        body: { value: "system-ui, sans-serif" },
        heading: { value: "Georgia, serif" },
      },
    },
    semanticTokens: {
      colors: {
        "bg.default": { value: "{colors.white}" },
        "bg.subtle": { value: "{colors.gray.100}" },
      },
    },
  },

  // JSX 框架
  jsxFramework: "react",  // react / vue / preact / solid

  // 全局样式
  globalCss: {
    body: {
      bg: "gray.50",
      color: "gray.900",
    },
  },
});
```

### 在 Vite 中使用

```bash
npm install -D @pandacss/dev @pandacss/node
```

```typescript
// vite.config.ts
import { defineConfig } from vite;
import panda from @pandacss/dev/plugin;

export default defineConfig({
  plugins: [panda()],
});
```

### 配合 Next.js

```bash
npm install -D @pandacss/dev postcss autoprefixer
```

```typescript
// postcss.config.mjs
export default {
  plugins: {
    "@pandacss/postcss": {},
  },
};
```

---

## 核心 API

### 1. css —— 基本样式

```typescript
import { css } from styled-system';

const container = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  maxWidth: 'breakpoint-md',
  padding: '6',
});

const responsive = css({
  flexDirection: { base: 'column', md: 'row' },
  gap: { base: '2', md: '4' },
});
```

### 2. stack / hstack / vstack —— 布局快捷

```typescript
import { stack, hstack, vstack } from styled-system';

const Card = ({ children }) => (
  <div className={stack({ gap: '4', p: '6', borderRadius: 'lg' })}>
    {children}
  </div>
);

// hstack = horizontal stack = flex row
// vstack = vertical stack = flex column
```

### 3. grid —— 网格布局

```typescript
import { grid } from styled-system;

const ResponsiveGrid = () => (
  <div
    className={grid({
      columns: { base: 1, sm: 2, md: 3, lg: 4 },
      gap: '4',
      p: '4',
    })}
  >
    {/* 自动响应式网格 */}
  </div>
);
```

### 4. box —— 最小容器

```typescript
import { Box } from styled-system';

// Box = div + 样式支持
function MyComponent() {
  return (
    <Box
      as="section"
      bg="gray.100"
      p="4"
      borderRadius="md"
      display="flex"
    >
      内容
    </Box>
  );
}
```

### 5. flex —— Flexbox 容器

```typescript
import { Flex } from styled-system;

function NavBar() {
  return (
    <Flex
      alignItems="center"
      justifyContent="space-between"
      p="4"
      borderBottomWidth="1px"
    >
      <Logo />
      <Nav />
    </Flex>
  );
}
```

### 6. Text / Heading —— 文本组件

```typescript
import { Text, Heading } from styled-system;

function PageHeader() {
  return (
    <>
      <Heading as="h1" size="2xl" fontWeight="bold">
        标题
      </Heading>
      <Text color="gray.500" fontSize="sm">
        描述文字
      </Text>
    </>
  );
}
```

### 7. Button —— 按钮组件

```typescript
import { Button } from styled-system;

<Button
  size="sm"
  colorScheme="blue"  // 自动蓝色主题
  variant="solid"
>
  点我
</Button>;

<Button variant="outline" colorScheme="red">
  删除
</Button>;

<Button variant="ghost" colorScheme="gray">
  更多
</Button>;
```

---

## Panda CSS 的高级特性

### 1. 条件样式

```typescript
import { css } from styled-system;

const button = css({
  backgroundColor: 'blue.500',
  color: 'white',
  // 条件：嵌套对象形式
  ...(disabled && {
    opacity: '0.5',
    cursor: 'not-allowed',
  }),
});

// 或用三元
const variant = css({
  ...(variant === 'primary'
    ? { bg: 'blue.500', color: 'white' }
    : { bg: 'transparent', color: 'blue.500' }),
});
```

### 2. 伪类和伪元素（Pseudo 类）

```typescript
import { css } from styled-system;

const hoverEffect = css({
  backgroundColor: 'gray.100',
  // 伪类直接写
  _hover: {
    backgroundColor: 'gray.200',
  },
  _active: {
    backgroundColor: 'gray.300',
  },
  _focus: {
    outline: '2px solid',
    outlineColor: 'blue.500',
  },
  // 伪元素
  _before: {
    content: '""',
    marginRight: '2',
  },
});
```

### 3. 媒体查询

```typescript
import { css } from styled-system;

const responsive = css({
  width: '100%',
  // 响应式：对象嵌套形式
  '@media screen and (min-width: 768px)': {
    width: '50%',
  },
  '@media screen and (min-width: 1024px)': {
    width: '33%',
  },
  // 快捷写法（推荐）
  width: { base: '100%', md: '50%', lg: '33%' },
});
```

### 4. 嵌套选择器

```typescript
import { css } from styled-system;

const card = css({
  padding: '4',
  borderRadius: 'lg',
  // 嵌套：直接写子选择器
  '& .badge': {
    position: 'absolute',
    top: '2',
    right: '2',
  },
  // & 引用自身
  '&:hover': {
    boxShadow: 'lg',
    '& .badge': {
      opacity: '1',
    },
  },
});
```

### 5. 暗色模式

```typescript
import { css } from styled-system;

const Card = () => (
  <div
    className={css({
      bg: { base: 'white', _dark: 'gray.800' },
      color: { base: 'gray.900', _dark: 'white' },
    })}
  >
    内容
  </div>
);
```

---

## 主题系统

### 自定义 Design Tokens

```typescript
// panda.config.ts
export default defineConfig({
  theme: {
    tokens: {
      colors: {
        // 基础颜色
        brand: { value: '#0066ff' },
        // 带别名
        primary: { value: '{colors.brand}' },
        secondary: { value: '#8b5cf6' },
      },
      spacing: {
        'xs': { value: '0.25rem' },
        'sm': { value: '0.5rem' },
        'md': { value: '1rem' },
        'lg': { value: '1.5rem' },
        'xl': { value: '2rem' },
      },
      fontSizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
      },
      radii: {
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px',
      },
    },
    semanticTokens: {
      colors: {
        'bg.primary': { value: '{colors.white}' },
        'bg.secondary': { value: '{colors.gray.50}' },
        'text.primary': { value: '{colors.gray.900}' },
        'text.secondary': { value: '{colors.gray.600}' },
        'border.default': { value: '{colors.gray.200}' },
      },
    },
  },
});
```

### 使用 Token

```typescript
import { css } from styled-system;

const card = css({
  backgroundColor: 'bg.primary',     // 语义 Token
  color: 'text.primary',
  borderRadius: 'md',
  padding: 'md',
  fontSize: 'md',
});
```

---

## 配合 Framer Motion

```typescript
import { motion } from 'framer-motion';
import { css } from styled-system;

// Panda + Motion = 最佳动画组合
const AnimatedCard = () => {
  return (
    <motion.div
      className={css({
        padding: '6',
        borderRadius: 'lg',
        backgroundColor: 'white',
      })}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      内容
    </motion.div>
  );
};
```

---

## Panda CSS 生态系统

### 与其他库集成

```typescript
// Next.js App Router + Panda CSS
// app/layout.tsx
import { styled } from styled-system';
import globalStyles from styled-system/global.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <globalStyles />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```typescript
// React Native 迁移到 Web
import { css, Box } from styled-system;

// 代码复用策略
const webStyles = css({
  flex: 1,
  padding: '4',
});

const nativeStyles = css({
  flex: 1,
  padding: 4,
});
```

### Storybook 集成

```typescript
// .storybook/preview.tsx
import { Preview } from storybook-addon-panda-css;

export const decorators = [(Story) => <Preview><Story /></Preview>];
```

---

## 性能对比

### Bundle Size（典型 React 项目）

| 方案 | JS Bundle | CSS |
|------|----------|-----|
| Styled Components | +28KB | 0 |
| Emotion | +12KB | 0 |
| Tailwind | +4KB | +8KB（Purge 后） |
| **Panda CSS** | **+0KB** | **+6KB** |
| Vanilla Extract | +8KB | +4KB |

> Panda CSS 的 JS bundle 是 **0**（零运行时）！所有样式在构建时转为静态 CSS。

### SSR 水合时间

```
Styled Components:  ~45ms（运行时处理）
Emotion:        ~30ms
Tailwind:       ~5ms（已有 CSS）
Panda CSS:     ~5ms（已有 CSS）
```

---

## Panda CSS vs 其他方案

| 维度 | Panda CSS | Tailwind | Vanilla Extract | Styled Components |
|------|----------|---------|----------------| ----------------|
| 零运行时 | 正确 | 正确 | 正确 | 错误 |
| 类型安全 | 正确 TS 开箱即用 | 注意 需要JSDoc | 正确 | 错误 |
| 代码提示 | VS Code 自动补全 | 需要背类名 | 无 | 正确 JS/TS |
| 学习成本 | 低 | 高 | 中 | 低 |
| 调试 | 类名可读 | 类名不可读 | 可读 | 正确 |
| CSS 支持 | 原生写法 | 类名堆砌 | JS对象 | Tagged Template |
| 条件样式 | 原生 TS | 任意值 | TS 对象 | props 透传 |
| 嵌套选择器 | 正确 原生支持 | 正确 | 有限 | 正确 |
| Dark Mode | 正确 语义Token | 正确 | 手动 | 手动 |
| 社区 | 小，快速成长 | 大 | 中 | 大但停滞 |

---

## 迁移指南

### 从 Styled Components 迁移

```typescript
// 旧代码
const Button = styled.button`
  background: blue;
  padding: ${props => props.$size || '1rem'};
  &:hover { background: darkblue; }
`;

// 新代码（Panda）
import { css, Button } from styled-system';

const buttonStyle = css({
  background: 'blue.500',
  padding: '4',  // token
  _hover: {
    background: 'blue.600',
  },
});

function Button({ size, children, ...props }) {
  return (
    <button
      {...props}
      className={css({
        padding: size || '4',
      })}
    >
      {children}
    </button>
  );
}
```

### 从 Tailwind 迁移

```html
<!-- 旧代码 -->
<div class="flex flex-col gap-4 p-6 bg-blue-500 text-white">

<!-- 新代码（Panda） -->
import { Box, Flex } from styled-system';

<Flex direction="col" gap="4" p="6" bg="blue" color="white">
```

---

## 结论：Panda CSS 适合谁？

```
正确 适合 Panda CSS 的项目：
─────────────────────────
- 需要零运行时的 SSR 项目（Next.js、Nuxt）
- 喜欢 CSS 原生写法，不想背 Tailwind 类名
- 需要类型安全的样式系统
- 想要静态生成的 CSS（构建时产出）
- 团队熟悉 CSS，不需要另学 DSL

错误 不适合 Panda CSS 的项目：
─────────────────────────
- 需要样式的动态变化（CSS 变量方案更好）
- 小型项目，CSS 文件本来就很小
- 已经用 Tailwind 且满意现状
- 需要极其细粒度的原子化控制
```

**推荐组合：**
- **Next.js + Panda CSS**：最佳 SSR 体验
- **Vite + Panda CSS**：开发体验 + 零运行时
- **Panda + Framer Motion**：形态过渡 + 动画

Panda CSS 用 **TypeScript + 构建时静态化** 的思路，提供了一种介于 "Tailwind 的原子化" 和 "Styled Components 的声明式" 之间的选择。不是银弹，但是一個值得考虑的方案

本文由小虾子  撰写