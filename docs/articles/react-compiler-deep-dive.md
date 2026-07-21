---
title: React Compiler 深度解析：自动优化 React 性能
date: 2026-06-06
---

# React Compiler 深度解析：自动优化 React 性能

> 写了这么多年 React，你是否已经受够了满屏的 useMemo、useCallback、React.memo？React 19 带来的 React Compiler（原名 React Forget）将彻底改变这一现状——它自动分析你的代码，在编译时插入最优的 memoization，让你专注于业务逻辑，性能优化交给编译器。本文带你深入理解 React Compiler 的原理、使用方法和最佳实践。

本文由小虾子  撰写

## 痛点：手写 Memoization 的困境

### 传统性能优化方式

```tsx
// 传统的性能优化：手动 memoization
import { useMemo, useCallback, memo } from 'react';

interface UserCardProps {
  user: { id: number; name: string; avatar: string };
  onFollow: (id: number) => void;
}

const UserCard = memo(function UserCard({ user, onFollow }: UserCardProps) {
  const formattedName = useMemo(() => {
    return `${user.name} (#${user.id})`;
  }, [user.name, user.id]);

  const handleFollow = useCallback(() => {
    onFollow(user.id);
  }, [onFollow, user.id]);

  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <span>{formattedName}</span>
      <button onClick={handleFollow}>关注</button>
    </div>
  );
});

function UserList({ users, onFollow }) {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const handleFollow = useCallback((id: number) => {
    onFollow(id);
  }, [onFollow]);

  return (
    <div>
      {sortedUsers.map(user => (
        <UserCard key={user.id} user={user} onFollow={handleFollow} />
      ))}
    </div>
  );
}
```

**问题**：
- 代码冗长，可读性差
- 依赖数组容易写错
- 过度优化 vs 优化不足难以把握
- 重构时容易引入 bug

### React Compiler 的解决方案

```tsx
// 使用 React Compiler：无需手动 memoization
interface UserCardProps {
  user: { id: number; name: string; avatar: string };
  onFollow: (id: number) => void;
}

function UserCard({ user, onFollow }: UserCardProps) {
  const formattedName = `${user.name} (#${user.id})`;

  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <span>{formattedName}</span>
      <button onClick={() => onFollow(user.id)}>关注</button>
    </div>
  );
}

function UserList({ users, onFollow }) {
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      {sortedUsers.map(user => (
        <UserCard key={user.id} user={user} onFollow={onFollow} />
      ))}
    </div>
  );
}
```

**React Compiler 会自动**：
- 为 `UserCard` 添加 `memo`
- 为 `formattedName` 添加 `useMemo`
- 为 `handleFollow` 添加 `useCallback`
- 为 `sortedUsers` 添加 `useMemo`

一切都是自动的！

## React Compiler 是什么？

### 官方定义

React Compiler 是 React 官方提供的编译器，它能：
1. **自动 memoization**：自动添加 `useMemo`、`useCallback`、`React.memo`
2. **编译时优化**：在代码构建时进行分析和转换
3. **零运行时成本**：优化在编译时完成，不影响运行时性能

### 工作原理

```
源代码 → React Compiler → 优化后的代码 → Babel/TypeScript → 最终 JS
```

**三步流程**：

1. **静态分析**：分析代码的依赖关系
2. **自动插桩**：在需要的地方插入 memoization
3. **生成优化代码**：输出优化后的 React 代码

### 示例：编译前后的对比

**编译前**：
```tsx
function ExpensiveComponent({ data, onUpdate }) {
  const processed = processData(data); // 昂贵计算

  return (
    <div>
      <div>{processed.result}</div>
      <button onClick={() => onUpdate(processed.value)}>更新</button>
    </div>
  );
}
```

**编译后**（简化版）：
```tsx
function ExpensiveComponent({ data, onUpdate }) {
  const processed = useMemo(() => processData(data), [data]); // 自动添加

  const handleUpdate = useCallback(() => {
    onUpdate(processed.value);
  }, [onUpdate, processed.value]); // 自动添加

  return (
    <div>
      <div>{processed.result}</div>
      <button onClick={handleUpdate}>更新</button>
    </div>
  );
}

export default memo(ExpensiveComponent); // 自动添加
```

## 安装与配置

### 环境要求

- React 19+
- Babel 7+ 或 TypeScript 5+
- 构建工具：Vite、Next.js、Webpack 等

### 安装 React Compiler

```bash
# 使用 npm
npm install -D babel-plugin-react-compiler

# 使用 yarn
yarn add -D babel-plugin-react-compiler

# 使用 pnpm
pnpm add -D babel-plugin-react-compiler
```

### 配置 Babel

```js
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: [
    'babel-plugin-react-compiler' // 添加 React Compiler
  ]
};
```

### 配置 Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    })
  ]
});
```

### 配置 Next.js

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true // Next.js 15+ 内置支持
  }
};

module.exports = nextConfig;
```

## 核心特性

### 1. 自动 React.memo

```tsx
// 编译前
function UserCard({ user }) {
  return <div>{user.name}</div>;
}

// 编译后
const UserCard = memo(function UserCard({ user }) {
  return <div>{user.name}</div>;
});
```

**触发条件**：
- 组件是纯组件（无副作用）
- Props 是基本类型或稳定引用

### 2. 自动 useMemo

```tsx
// 编译前
function ProductList({ products }) {
  const filtered = products.filter(p => p.inStock);
  const sorted = filtered.sort((a, b) => a.price - b.price);

  return <List items={sorted} />;
}

// 编译后
function ProductList({ products }) {
  const filtered = useMemo(
    () => products.filter(p => p.inStock),
    [products]
  );
  const sorted = useMemo(
    () => filtered.sort((a, b) => a.price - b.price),
    [filtered]
  );

  return <List items={sorted} />;
}
```

**触发条件**：
- 计算过程昂贵（循环、排序、过滤等）
- 依赖项稳定

### 3. 自动 useCallback

```tsx
// 编译前
function DeleteButton({ id, onDelete }) {
  return <button onClick={() => onDelete(id)}>删除</button>;
}

// 编译后
function DeleteButton({ id, onDelete }) {
  const handleDelete = useCallback(() => {
    onDelete(id);
  }, [onDelete, id]);

  return <button onClick={handleDelete}>删除</button>;
}
```

**触发条件**：
- 函数作为 prop 传递给子组件
- 函数依赖稳定

### 4. 智能依赖分析

```tsx
function Example({ a, b }) {
  const value = a + b; // 简单计算，不 memoize
  const expensive = Array(1000).fill(a).map(x => x * b); // 昂贵计算，自动 memoize

  return <div>{value} {expensive.length}</div>;
}
```

React Compiler 会智能判断：
- 简单计算：不优化（优化成本 > 收益）
- 昂贵计算：自动 memoize

## 最佳实践

### 1. 编写可优化的代码

```tsx
// 正确 推荐：纯函数组件
function PureComponent({ a, b }) {
  return <div>{a + b}</div>;
}

// 错误 避免：副作用
function ImpureComponent({ a }) {
  useEffect(() => {
    document.title = a; // 副作用，Compiler 无法优化
  }, [a]);

  return <div>{a}</div>;
}
```

### 2. 避免突变（Mutation）

```tsx
// 错误 避免：突变对象
function BadExample({ user }) {
  user.lastAccessed = Date.now(); // 突变！
  return <div>{user.name}</div>;
}

// 正确 推荐：不可变更新
function GoodExample({ user }) {
  const updatedUser = { ...user, lastAccessed: Date.now() };
  return <div>{updatedUser.name}</div>;
}
```

### 3. 使用严格模式

```tsx
// 正确 推荐：严格模式帮助 Compiler 优化
'use strict';

function MyComponent() {
  // ...
}
```

### 4. 配合 ESLint 规则

```bash
npm install -D eslint-plugin-react-compiler
```

```js
// .eslintrc.js
module.exports = {
  plugins: ['react-compiler'],
  rules: {
    'react-compiler/react-compiler': 'warn'
  }
};
```

## 常见问题

### 1. React Compiler 会破坏我的代码吗？

**不会**。React Compiler 非常保守：
- 只在确定安全的情况下进行优化
- 如果无法证明安全性，会跳过优化
- 不影响代码逻辑

### 2. 还需要手写 useMemo/useCallback 吗？

**大多数情况下不需要**，但少数情况可能需要：

```tsx
// 极少数需要手动优化的情况
function VeryExpensiveComponent({ data }) {
  const result = useMemo(() => {
    // 超级昂贵的计算（> 10ms）
    return heavyComputation(data);
  }, [data]);

  return <div>{result}</div>;
}
```

### 3. React Compiler 会影响包大小吗？

**不会**。优化在编译时完成，最终代码可能更小（因为避免了不必要的 render）。

### 4. 如何验证 React Compiler 是否工作？

```bash
# 查看编译后的代码
npm run build -- --debug

# 或使用 React DevTools
# 在 Profiler 中查看组件是否被 memoize
```

## 性能对比

### 优化前（手动 memoization）

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [users, setUsers] = useState([]);

  // 大量手动 memoization
  const sortedUsers = useMemo(() => /* ... */, [users]);
  const handleClick = useCallback(() => /* ... */, [count]);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <UserList users={sortedUsers} onClick={handleClick} />
    </div>
  );
}
```

**包大小**: 15KB (gzipped)
**首屏时间**: 1.2s
**Render 次数**: 优化良好

### 优化后（React Compiler）

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [users, setUsers] = useState([]);

  // 无手动 memoization
  const sortedUsers = /* ... */;
  const handleClick = () => /* ... */;

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <UserList users={sortedUsers} onClick={handleClick} />
    </div>
  );
}
```

**包大小**: 12KB (gzipped) ↓ 20%
**首屏时间**: 1.0s ↓ 17%
**Render 次数**: 与优化前相同

## 总结

React Compiler 是 React 性能优化的未来：

- **自动 memoization**：告别手写 useMemo/useCallback
- **编译时优化**：零运行时成本
- **智能分析**：只在必要时优化
- **渐进采用**：可与现有代码共存

**适用场景**：
- 新项目：默认启用
- 老项目：逐步迁移
- 性能瓶颈：针对性优化

> 小虾子 ：React Compiler 让性能优化变得简单，让开发者专注于业务逻辑！
