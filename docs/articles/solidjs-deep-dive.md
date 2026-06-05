---
title: Solid.js 深度解析：React 语法，Vue 性能的细粒度响应式框架
date: 2026-06-05
---

# Solid.js 深度解析：React 语法，Vue 性能的细粒度响应式框架

> React 的 Hooks 语法好用，但 Virtual DOM 的 Diff 开销让人头疼。Vue 的性能优秀，但 Options API / Composition API 和 React 差异太大。Solid.js 给出了一个有趣的答案：用 React Hooks 的写法，跑出 Vue 甚至原生 DOM 的性能。它是第一个将 "细粒度响应式" 和 "JSX 编译时优化" 结合的框架。本文从原理到实战，带你掌握 Solid.js。

本文由小虾子 🦐 撰写

## Solid.js 是什么？

```
Solid.js = React Hooks 语法 + 细粒度响应式 + 编译时优化（无 Virtual DOM）
```

```tsx
// Solid.js 代码（看起来和 React Hooks 几乎一样）
import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";

function Counter() {
  const [count, setCount] = createSignal(0);

  createEffect(() => {
    console.log("count 变化了：", count());
  });

  return (
    <button onClick={() => setCount(c => c + 1)}>
      {count()}
    </button>
  );
}

render(() => <Counter />, document.getElementById("root")!);
```

**关键差异：**

| 维度 | React | Solid.js |
|------|-------|----------|
| 更新粒度 | 组件级（reconciliation） | **信号级（细粒度）** |
| JSX 编译 | 运行时（React.createElement） | **编译时（直接生成 DOM 操作）** |
| Hooks 规则 | `useState` 在每次 render 时调用 | `createSignal` 只执行一次（像 `useMemo` 永久缓存） |
| 性能 | 需要 memo/useMemo 手动优化 | **自动细粒度，无需优化** |

---

## 核心概念：Signals（信号）

### 什么是 Signal？

```
Signal = 响应式原子状态（类似 React useState，但细粒度天壤之别）
```

```tsx
import { createSignal } from "solid-js";

function Example() {
  const [count, setCount] = createSignal(0);
  //            ↑ 读值   ↑ 写值

  // ⚠️ 注意：count 是函数！要调用才能拿到值
  console.log(count()); // 0
  setCount(1);
  console.log(count()); // 1

  return <div>{count()}</div>;
}
```

### Signal 的细粒度更新

```
React：setState → 组件重新执行 → Virtual DOM Diff → 更新 DOM
Solid：setSignal → 直接更新依赖这个 Signal 的 DOM 节点（无中间步骤）
```

```tsx
function App() {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);

  return (
    <div>
      <p>a = {a()}</p>      {/* 只有 a 变化时才更新这行 */}
      <p>b = {b()}</p>      {/* 只有 b 变化时才更新这行 */}
      <button onClick={() => setA(a() + 1)}>a+1</button>
      <button onClick={() => setB(b() + 1)}>b+1</button>
    </div>
  );
}
```

> React 中，点 a+1 按钮会让整个 App 重新执行，Virtual DOM Diff 发现 `<p>b = ...</p>` 没变，跳过 DOM 操作。
> Solid 中，点 a+1 只会更新 `<p>a = ...</p>` 这一个 DOM 节点，其他节点根本不知道发生了更新。

---

## 核心 API

### 1. createSignal —— 信号（状态）

```tsx
import { createSignal } from "solid-js";

function Counter() {
  const [count, setCount] = createSignal(0);

  // 读值：count() —— 这是一个 getter 函数
  // 写值：setCount(newValue) 或 setCount(prev => prev + 1)

  return (
    <div>
      <p>count = {count()}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}
```

### 2. createEffect —— 副作用（类似 useEffect）

```tsx
import { createSignal, createEffect } from "solid-js";

function Example() {
  const [count, setCount] = createSignal(0);

  // createEffect：自动追踪依赖（类似 MobX autorun）
  createEffect(() => {
    console.log("count 变成了：", count());
    // 当 count() 变化时，这个 effect 自动重新执行
  });

  // 对比 React useEffect：
  // React:  useEffect(() => { ... }, [count]);  // 需要手动声明依赖
  // Solid: createEffect(() => { ... });           // 自动追踪，不需要依赖数组！
}
```

### 3. createMemo —— 计算属性（类似 useMemo）

```tsx
import { createSignal, createMemo } from "solid-js";

function Example() {
  const [count, setCount] = createSignal(0);

  // createMemo：基于其他 Signal 计算派生值（自动缓存）
  const doubled = createMemo(() => count() * 2);
  //                                 ↑ 自动追踪 count

  return (
    <div>
      <p>count = {count()}</p>
      <p>doubled = {doubled()}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

### 4. createResource —— 数据请求（类似 React Query）

```tsx
import { createResource } from "solid-js";

function UserProfile({ userId }: { userId: string }) {
  const [user, { mutate, refetch }] = createResource(
    () => userId,  // 依赖项（当 userId 变化时重新请求）
    async (id) => {
      const res = await fetch(`/api/users/${id}`);
      return res.json();
    }
  );

  return (
    <div>
      {user.loading && <p>加载中...</p>}
      {user.error && <p>错误：{user.error.message}</p>}
      {user() && (
        <div>
          <h1>{user().name}</h1>
          <button onClick={() => refetch()}>重新加载</button>
        </div>
      )}
    </div>
  );
}
```

---

## 控制流（编译时优化）

### 问题：JSX 表达式的性能陷阱

```tsx
// 这行代码在 React 中每次 render 都会执行
<p>{count()}</p>

// Solid 编译后：
// 变成类似下面的代码（直接 DOM 操作，无 VDOM）
const textNode = document.createTextNode(count());
// 当 count() 变化时，直接 textNode.data = newText（无 diff！）
```

### 内置控制流组件（性能优化）

```tsx
import { For, Show, Switch, Match } from "solid-js/web";

function Example() {
  const [users, setUsers] = createSignal([]);
  const [isLoggedIn, setIsLoggedIn] = createSignal(false);
  const [status, setStatus] = createSignal<"idle" | "loading" | "success">("idle");

  return (
    <>
      {/* For：列表渲染（比 array.map 性能更好） */}
      <ul>
        <For each={users()}>
          {(user, index) => (
            <li>
              #{index()}: {user.name}
            </li>
          )}
        </For>
      </ul>

      {/* Show：条件渲染（类似 v-if） */}
      <Show when={isLoggedIn()} fallback={<p>请先登录</p>}>
        <p>欢迎回来！</p>
      </Show>

      {/* Switch/Match：多条件（类似 v-switch） */}
      <Switch>
        <Match when={status() === "loading"}>
          <p>加载中...</p>
        </Match>
        <Match when={status() === "success"}>
          <p>加载成功！</p>
        </Match>
        <Match when={status() === "idle"}>
          <p>等待操作</p>
        </Match>
      </Switch>
    </>
  );
}
```

> **为什么不用 `array.map` 和 `&&`？**
> `array.map` 每次都会创建新数组，`&&` 每次都会执行条件判断。
> Solid 的 `For` / `Show` / `Switch` 是编译时优化的指令，只更新变化的 DOM 节点。

---

## Solid.js 响应式系统原理

### 依赖追踪（自动依赖收集）

```
Solid 的依赖追踪原理（类似 MobX）：
─────────────────────────────────
1. 全局变量 currentEffect = null

2. createEffect(fn) 执行时：
   currentEffect = fn
   fn()  // 执行 fn，遇到 count() 调用
   currentEffect = null

3. count() 被调用时（它是 getter）：
   if (currentEffect) {
     count.subscribers.add(currentEffect)  // 建立订阅关系
   }

4. setCount(newValue) 被调用时：
   for (const effect of count.subscribers) {
     effect()  // 重新执行所有订阅的 effect
   }
```

```tsx
// 手动实现一个简化版 Signal
function createSignal<T>(value: T): [() => T, (newVal: T) => void] {
  const subscribers = new Set<() => void>();
  let currentValue = value;

  const getter = () => {
    // 依赖收集
    if (globalThis.currentEffect) {
      subscribers.add(globalThis.currentEffect);
    }
    return currentValue;
  };

  const setter = (newValue: T) => {
    currentValue = newValue;
    // 通知所有订阅者
    for (const sub of subscribers) sub();
  };

  return [getter, setter];
}
```

---

## Solid.js  vs React 深度对比

### 更新机制

```
React 更新流程：
setState → 组件函数重新执行 → 生成新 VDOM 树 → Diff 对比 → 更新变化的 DOM

Solid 更新流程：
setSignal → 直接更新依赖这个 Signal 的 DOM 节点（无 VDOM，无 Diff）
```

### Hooks 执行时机

```tsx
// React：每次 render 都重新执行
function App() {
  const [count, setCount] = useState(0);

  useEffect(() => { ... }, [count]);  // 需要依赖数组
  const doubled = useMemo(() => count * 2, [count]);  // 需要依赖数组

  return <p>{count}</p>;  // 每次 render 都执行
}

// Solid：组件函数只执行一次！
function App() {
  const [count, setCount] = createSignal(0);

  createEffect(() => { ... });  // 自动追踪依赖，不需要依赖数组
  const doubled = createMemo(() => count() * 2);  // 自动追踪，不需要依赖数组

  return <p>{count()}</p>;  // 这行编译后变成：textNode.data = count()
                            // 组件函数不会再执行第二次！
}
```

### 性能 Benchmark（主流框架对比）

```
（2024 年 JS Framework Benchmark，10k 行更新/秒）
─────────────────────────────────
Vanilla JS：         ~100%
Solid.js：            ~95%  （接近原生！）
Vue 3.4：            ~65%
React 19（带 Compiler）：~55%
React 18（无 Compiler）：~35%
Angular 17：          ~40%
Svelte 5：            ~70%
```

> Solid.js 的性能仅次于原生 JS，远超 React 和 Angular。

---

## SolidStart（全栈框架）

### 安装

```bash
npm init solid@latest
# 选择 SolidStart（全栈框架）

# 或手动安装
npm install solid-start
```

### 文件系统路由

```tsx
// app/routes/index.tsx → /
// app/routes/about.tsx → /about
// app/routes/users/[id].tsx → /users/:id

import { createResource } from "solid-js";
import { useParams } from "solid-start";

export default function UserPage() {
  const params = useParams();  // SolidStart 的路由 hook

  const [user] = createResource(
    () => params.id,
    async (id) => {
      const res = await fetch(`/api/users/${id}`);
      return res.json();
    }
  );

  return (
    <div>
      <h1>{user()?.name}</h1>
    </div>
  );
}
```

### Server-side Rendering（SSR）

```tsx
// SolidStart 默认支持 SSR
// app/entry-server.tsx
import { renderToString } from "solid-js/web";

export default function render() {
  return renderToString(() => <App />);
}
```

---

## Solid.js 生态

| 包名 | 功能 |
|------|------|
| `solid-js` | 核心库（Signals/Effects/Memo） |
| `solid-js/web` | DOM 渲染（createRoot/mount/portal） |
| `solid-start` | 全栈框架（类似 Next.js） |
| `@solidjs/router` | 客户端路由 |
| `solid-dnd` | 拖拽库 |
| `solid-icons` | 图标库 |
| `solid-meta` | SEO/HEAD 管理 |
| `solid-transition-group` | 动画过渡 |

---

## Solid.js 适用场景

```
✅ 适合 Solid.js 的项目：
─────────────────────────────────
- 高性能要求的 SPA（图表、画板、游戏）
- 从 React 迁移（语法相似，迁移成本低）
- 想要细粒度响应式（不想要 VDOM Diff）
- 全栈项目（SolidStart 越来越成熟）

❌ 不适合 Solid.js 的项目：
─────────────────────────────────
- 需要庞大生态（组件库、工具链不如 React）
- 团队不熟悉 Signals（学习曲线存在）
- 大型遗留 React 项目（迁移成本过高）
- 移动端 RN 需求（Solid 没有官方 RN 绑定）
```

---

## 从 React 迁移到 Solid.js

### 步骤一：组件定义

```tsx
// React
function App() {
  const [count, setCount] = useState(0);
  return <p>{count}</p>;
}

// Solid
function App() {
  const [count, setCount] = createSignal(0);
  return <p>{count()}</p>;  // 注意：count 是函数，要调用
}
```

### 步骤二：Effects

```tsx
// React
useEffect(() => {
  console.log(count);
}, [count]);  // 需要依赖数组

// Solid
createEffect(() => {
  console.log(count());  // 自动追踪，不需要依赖数组
});
```

### 步骤三：列表渲染

```tsx
// React
<ul>
  {users.map(user => (
    <li key={user.id}>{user.name}</li>
  ))}
</ul>

// Solid（推荐用 For，性能更好）
<ul>
  <For each={users()}>
    {(user) => <li>{user.name}</li>}
  </For>
</ul>
```

---

## 常见问题

### Q: Signal 的 `count` 为什么要设计成函数（`count()`）？

```
设计原因：
1. 依赖追踪需要 getter 拦截（类似 Vue 的 Proxy）
2. 如果是属性访问（count.value），JS 无法拦截属性 get/set
3. 函数调用可以被追踪，这是细粒度响应式的核心

对比：
Vue 3：  count.value（用 Proxy + Ref 包装）
Solid：   count()（用函数 getter 追踪）
React：   count（普通变量，无法自动追踪）
```

### Q: Solid 没有 Virtual DOM，那 JSX 怎么变成 DOM？

```
Solid 编译时：
JSX → 直接编译成 DOM 操作代码（类似 Svelte）

编译前：
<div>{count()}</div>

编译后（伪代码）：
const el = document.createElement("div");
const text = document.createTextNode("");
el.appendChild(text);
createEffect(() => text.data = count());  // 直接更新 text 节点
```

### Q: Solid 和 MobX 有什么关系？

```
相同点：
- 都是细粒度响应式
- 都基于自动依赖追踪
- 都用类似的 Signal/Observer 模型

不同点：
- MobX 通常用于 React（作为状态管理库）
- Solid 是完整的框架（自带响应式 + JSX 编译）
- MobX 需要和 React 的 VDOM Diff 共存（有额外开销）
- Solid 完全不需要 VDOM（零开销）
```

---

## 总结

Solid.js 的核心价值：**用 React 的开发体验，实现 Vue 甚至原生 DOM 的性能**。

```
Solid.js 为什么值得关注？
─────────────────────────────────
语法：    React Hooks 风格（学习成本低）
性能：    细粒度响应式（无 VDOM，无 Diff）
编译：    JSX → 直接 DOM 操作（编译时优化）
生态：    SolidStart 全栈框架（类似 Next.js）
未来：    细粒度响应式可能是前端框架的下一个趋势

React 的问题：
─────────────────────────────────
Hooks 闭包陷阱、useEffect 依赖数组、useMemo 手动优化、VDOM Diff 开销

Solid 的答案：
─────────────────────────────────
Signal 无闭包问题、createEffect 自动追踪、createMemo 自动缓存、无 VDOM
```

如果你喜欢 React 的 Hooks 语法，但又对性能有极致追求，Solid.js 值得一试 🚀

本文由小虾子 🦐 撰写
