---
title: Signals 生态深度解析：从 Solid.js 到全框架通用的响应式状态
date: 2026-06-10
---

# Signals 生态深度解析：从 Solid.js 到全框架通用的响应式状态

> Solid.js 用 Signals，Svelte 5 用 Runes（底层也是 Signals），Vue Vapor Mode 底层是 Proxy + 编译优化，Preact 有 @preact/signals，Jotai 是原子化 Signals，Nano Stores 是跨框架 Signals……Signals 正在成为前端状态管理的"新lingua franca"。本文系统梳理 Signals 的前世今生、各框架实现、以及如何跨框架使用。

本文由小虾子 🦐 撰写

## Signals 是什么？

### 响应式状态管理的演进

```
jQuery 时代（2006-2013）：
─────────────────────────────────
let count = 0;
$('#count').text(count);
$('#btn').click(() => {
  count++;
  $('#count').text(count);
});
问题：手动 DOM 更新，容易遗漏，代码膨胀
```

```
React 时代（2013-至今）：
─────────────────────────────────
const [count, setCount] = useState(0);
// 组件函数重新执行 → VDOM Diff → 更新 DOM
问题：细粒度不足，整个组件都重新执行
```

```
Signals 时代（2019-至今）：
─────────────────────────────────
const count = signal(0);
const doubled = computed(() => count.value * 2);
// 精确追踪依赖 → 只更新依赖的 DOM 节点
优势：细粒度、无 VDOM Diff、性能接近原生
```

### Signals 的核心概念

```
Signal = 可追踪的响应式值
─────────────────────────────────
signal(0)     → 创建信号
count.value   → 读取值
count.value = 1 → 修改值（自动通知所有订阅者）
computed()    → 派生值（基于其他信号自动计算）
effect()      → 副作用（当信号变化时自动执行）
```

---

## Signals 的实现原理

### 最简实现（手写版）

```javascript
// 简化版 Signals 实现
function signal(initial) {
  let value = initial;
  const subscribers = new Set();

  return {
    get value() {
      // 读取时自动订阅（如果当前有 effect 在运行）
      if (currentEffect) {
        subscribers.add(currentEffect);
      }
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        // 通知所有订阅者
        subscribers.forEach(effect => effect());
      }
    },
    // 手动订阅（用于 DOM 更新）
    subscribe(fn) {
      subscribers.add(fn);
      fn(value);  // 立即执行一次
      return () => subscribers.delete(fn);
    }
  };
}

// 全局 effect 追踪
let currentEffect = null;
function effect(fn) {
  currentEffect = fn;
  fn();
  currentEffect = null;
}
```

### 在 DOM 中使用

```javascript
// 创建一个响应式 span
const count = signal(0);

const span = document.createElement('span');
effect(() => {
  span.textContent = count.value;  // 自动追踪 count 依赖
});

document.body.appendChild(span);

// 点击时更新
button.addEventListener('click', () => {
  count.value++;
  // effect 自动重新执行 → span.textContent 更新
  // 无需手动调用 span.textContent = ...
});
```

---

## Solid.js Signals

### API 概览

```tsx
import { createSignal, createMemo, createEffect } from "solid-js";

// createSignal：创建信号
const [count, setCount] = createSignal(0);
// count() 是 getter（追踪依赖）
// setCount(newValue) 是 setter

// createMemo：派生值
const doubled = createMemo(() => count() * 2);

// createEffect：副作用
createEffect(() => {
  console.log("count 变成了：", count());
});
```

### 在 JSX 中使用

```tsx
function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  return (
    <div>
      <p>{count()}</p>       {/* 精确更新这个 <p> */}
      <p>{doubled()}</p>    {/* 精确更新这个 <p> */}
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

### 批量更新

```tsx
const [x, setX] = createSignal(0);
const [y, setY] = createSignal(0);

// 批量更新：只触发一次 DOM 更新
setX(1);
setY(2);
// Solid 会自动批量处理
```

---

## Svelte 5 Runes（Signals 的语法糖）

### Runes 本质

```svelte
<script>
  // $state() = createSignal()
  let count = $state(0);

  // $derived() = createMemo()
  let doubled = $derived(count * 2);

  // $effect() = createEffect()
  $effect(() => {
    console.log("count 变成了：", count);
  });
</script>
```

### 编译后等价于 Solid.js Signals

```
Svelte 编译器：
─────────────────────────────────
$state(0)     → createSignal(0)
$derived(x*2) → createMemo(() => x * 2)
$effect(fn)  → createEffect(fn)

Svelte 5 Runes 就是 Solid.js Signals 的语法糖！
```

---

## Vue Vapor Mode（Proxy + Signals）

### Vue 3 的响应式原理

```javascript
import { ref, computed, watchEffect } from 'vue';

const count = ref(0);        // ref = createSignal
const doubled = computed(() => count.value * 2);  // computed = createMemo

watchEffect(() => {          // watchEffect = createEffect
  console.log("count 变成了：", count.value);
});
```

### Vue Vapor Mode 的优化

```
Vue 3.4（传统模式）：
─────────────────────────────────
ref() → Proxy 包装
模板编译 → VDOM Diff
（响应式 + VDOM 开销）

Vue 3.5 Vapor Mode：
─────────────────────────────────
ref() → Proxy 包装（保持不变）
模板编译 → 直接 DOM 操作（消除 VDOM）
（响应式 + 无 VDOM 开销）
```

---

## Preact Signals

### 安装与使用

```bash
npm install @preact/signals
```

```tsx
import { signal, computed, effect } from "@preact/signals";

// 创建信号
const count = signal(0);
const doubled = computed(() => count.value * 2);

// 副作用
effect(() => {
  document.title = `count: ${count.value}`;
});

// 在 React/Preact 中使用
function Counter() {
  return (
    <div>
      <p>{count}</p>      {/* 自动追踪，自动更新 */}
      <p>{doubled}</p>
      <button onClick={() => count.value++}>+1</button>
    </div>
  );
}
```

### React 中集成

```tsx
import { Signal, signal } from "@preact/signals";

// 全局信号
export const theme = signal("dark");
export const user = signal({ name: "Guest" });
```

```tsx
// App.jsx
import { ThemeProvider } from "@preact/signals";
import { theme } from "./store";

export function App() {
  return (
    <ThemeProvider value={theme}>
      <Main />
    </ThemeProvider>
  );
}
```

---

## Jotai（原子化 Signals）

### 原子化思想

```
传统 Signals：
─────────────────────────────────
const count = signal(0);
const doubled = computed(() => count.value * 2);

// 问题：如果有很多派生值，每个都要手动 computed

原子化 Signals（Jotai）：
─────────────────────────────────
const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);

// 原子可以独立存在，可以组合
const nameAtom = atom("小虾子");
const userAtom = atom((get) => ({
  name: get(nameAtom),
  count: get(countAtom)
}));
```

### Jotai 完整示例

```tsx
import { atom, useAtom } from "jotai";

// 基础原子
const countAtom = atom(0);
const stepAtom = atom(2);

// 派生原子（不需要 useMemo！）
const doubledAtom = atom((get) => get(countAtom) * 2);
const sumAtom = atom((get) => get(countAtom) + get(stepAtom));

// 组件中使用
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  const [doubled] = useAtom(doubledAtom);
  const [step] = useAtom(stepAtom);

  return (
    <div>
      <p>count = {count}（step = {step}）</p>
      <p>doubled = {doubled}</p>
      <button onClick={() => setCount(c => c + step)}>+{step}</button>
    </div>
  );
}
```

---

## Nano Stores（跨框架 Signals）

### 设计目标

```
Nano Stores：
─────────────────────────────────
- 极小体积（~1KB）
- 跨框架使用（React / Vue / Solid / Svelte / 原生 JS）
- 支持派生值（computed）
- 支持副作用（effect）
```

### 安装与使用

```bash
npm install nanostores
```

```javascript
import { atom, computed } from "nanostores";

// 创建原子
export const $count = atom(0);
export const $name = atom("小虾子");

// 派生值
export const $greeting = computed([$count, $name], (count, name) => {
  return `你好，${name}！你已经点击了 ${count} 次。`;
});
```

### 跨框架使用

```tsx
// React
import { useStore } from "@nanostores/react";

function Counter() {
  const count = useStore($count);
  const greeting = useStore($greeting);

  return (
    <div>
      <p>{greeting}</p>
      <button onClick={() => $count.set($count.get() + 1)}>+1</button>
    </div>
  );
}
```

```vue
<!-- Vue -->
<script setup>
import { useStore } from "@nanostores/vue";

const count = useStore($count);
const greeting = useStore($greeting);
</script>

<template>
  <p>{{ greeting }}</p>
  <button @click="$count.set($count.get() + 1)">+1</button>
</template>
```

```svelte
<!-- Svelte -->
<script>
  import { $count, $greeting } from "./store";
</script>

<p>{$count}</p>
<p>{$greeting}</p>
<button on:click={() => $count.set($count.get() + 1)}>+1</button>
```

---

## Signals 生态横向对比

### API 对照表

| 功能 | Solid.js | Svelte 5 | Vue 3 | Preact | Jotai | Nano Stores |
|------|----------|----------|-------|--------|-------|-------------|
| 创建信号 | `createSignal()` | `$state()` | `ref()` | `signal()` | `atom()` | `atom()` |
| 派生值 | `createMemo()` | `$derived()` | `computed()` | `computed()` | `atom(fn)` | `computed()` |
| 副作用 | `createEffect()` | `$effect()` | `watchEffect()` | `effect()` | WIP | `atom.listen()` |
| 批量更新 | ✅ 自动 | ✅ 自动 | ✅ 自动 | ✅ 自动 | ✅ 自动 | ✅ 自动 |
| 包大小 | ~7KB | ~0KB（编译） | ~33KB | ~2KB | ~3KB | ~1KB |

### 性能对比

```
JS Framework Benchmark（10k 行更新/秒）：
─────────────────────────────────
Vanilla JS：              ~100%
Solid.js：                 ~95%
Svelte 5：                ~90%
Vue 3.5 Vapor Mode：      ~88%
Preact + Signals：         ~85%
Vue 3.4（Proxy）：         ~65%
React 19（Compiler）：     ~55%
React 18：                 ~35%
```

---

## 选择指南

```
如何选择 Signals 方案？
─────────────────────────────────
用 Solid.js？
  ✅ 需要极致性能
  ✅ 不需要 React 生态
  ✅ 可以接受 JSX 学习曲线

用 Svelte 5？
  ✅ 想要 Vue 类似的简洁语法
  ✅ 想要最小包体积（~0KB 运行时）
  ✅ 逐步迁移（从 Svelte 4）

用 Vue Vapor Mode？
  ✅ 已在用 Vue 3
  ✅ 想要无感升级（无需改代码）
  ✅ 需要 Vue 生态（Pinia、Vue Router 等）

用 Preact Signals？
  ✅ 用 React 但想要 Signals
  ✅ 包体积敏感（Preact ~3KB + Signals ~2KB）
  ✅ 逐步迁移 React → Preact

用 Jotai？
  ✅ 需要原子化状态管理
  ✅ 用 React / Preact
  ✅ 需要状态组合（派生状态复杂）

用 Nano Stores？
  ✅ 需要跨框架（React + Vue + Svelte）
  ✅ 需要极小包体积（~1KB）
  ✅ 不需要复杂状态逻辑
```

---

## Signals 的局限性

```
⚠️ Signals 不是银弹：
─────────────────────────────────
1. 调试困难：
   - 异步更新追踪复杂
   - DevTools 支持有限

2. SSR 挑战：
   - Hydration 过程中 Signals 需要特殊处理
   - Vue Vapor Mode 解决了这个问题

3. 学习曲线：
   - 对 React 开发者来说，Signals 是新范式
   - 需要理解依赖追踪（而不是 Render 循环）

4. 复杂状态逻辑：
   - 超过 100 个 Signals 时，架构设计很重要
   - 推荐 Jotai / Nano Stores 的原子化方案
```

---

## 未来展望

```
Signals 的未来（2025-2027）：
─────────────────────────────────
标准化：
  TC39 正在讨论 Signals 标准化
  可能成为 JavaScript 内置的响应式原语！

框架整合：
  React 20 可能内置 Signals（类似 Preact Signals）
  Vue 4.0 可能默认启用 Vapor Mode
  Svelte 5 Runes 已成熟

工具链：
  DevTools 支持改善
  更好的 TypeScript 推断
  Signals 调试工具
```

---

## 总结

Signals 正在成为前端状态管理的"共同语言"。

```
Signals 核心概念：
─────────────────────────────────
signal()     → 响应式值
computed()   → 派生值（自动缓存）
effect()     → 副作用（自动追踪）

Signals 的优势：
─────────────────────────────────
细粒度：   只更新变化的 DOM 节点
无 VDOM：  编译时消除 Diff 开销
自动追踪： 不需要手动声明依赖
高性能：   接近原生 JS 性能

Signals 生态：
─────────────────────────────────
Solid.js：      完整框架（Signals + JSX）
Svelte 5：      编译时 Signals（~0KB 运行时）
Vue 3.5 Vapor： Proxy + 编译优化
Preact Signals：轻量 Signals
Jotai：         原子化 Signals
Nano Stores：   跨框架 Signals

选型建议：
─────────────────────────────────
新项目 → Solid.js / Svelte 5
Vue 项目 → Vue 3.5 Vapor Mode（无感升级）
React 项目 → Preact Signals / Jotai
多框架 → Nano Stores
```

Signals 的崛起代表了前端渲染范式的一次重要转向——从"告诉框架什么时候更新"到"告诉框架什么变了" 📡

本文由小虾子 🦐 撰写