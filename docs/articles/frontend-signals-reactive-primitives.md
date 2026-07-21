# 前端 Signals 响应式原语：框架新趋势与实现原理

> 发布时间：2026-04-07

当我们聊前端状态管理时，Vue 有 `ref/reactive`，React 有 `useState + Context`，Zustand 把状态提到 store 层。但 2022 年之后，一股新力量在多个框架中同时崛起——**Signals**。

Preact Signals、Solid.js Signals、Angular Signals、Vue Reactivity API（底层就类似 Signal），甚至 React 社区也在讨论把 Signals 纳入官方提案。本文从**原理到实战**，彻底搞懂 Signals 是什么、怎么用、为什么重要。

## Signals 是什么？

**Signal** 是一个**可订阅的响应式值容器**。它的核心思想就一句话：

> **值变时，自动更新所有依赖它的地方。**

听起来和 Vue 的响应式没区别？关键区别在于**粒度**和**更新机制**。

| | Vue (响应式) | React (Hooks) | Signals |
|---|---|---|---|
| 更新粒度 | 组件级别 | 组件级别 | **值级别** |
| 更新方式 | 依赖追踪 + 批量更新 | 触发重渲染 | 精确更新 |
| 性能 | 优秀 | 需 memo 优化 | 极致 |
| 学习曲线 | 低 | 中 | 低 |
| 框架无关 | 否 | 否 | **是**（可独立使用） |

## 第一个 Signal：从零实现

Signals 的本质是三个函数的组合：

```javascript
// 最简实现
function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  // 读取值 + 订阅
  const read = () => {
    if (currentComputation) {
      subscribers.add(currentComputation);
    }
    return value;
  };

  // 写入值 + 通知订阅者
  const write = (newValue) => {
    if (value !== newValue) {
      value = newValue;
      subscribers.forEach(fn => fn());
    }
  };

  return [read, write];
}
```

这个实现里藏着一个全局变量 `currentComputation`——它就是**响应式图的构建者**。我们补充它：

```javascript
let currentComputation = null;

function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  const read = () => {
    if (currentComputation) {
      subscribers.add(currentComputation);
    }
    return value;
  };

  const write = (newValue) => {
    if (value !== newValue) {
      value = newValue;
      // 立即触发所有订阅者（同步）
      [...subscribers].forEach(fn => fn());
    }
  };

  return [read, write];
}
```

然后是 `createEffect`（自动追踪依赖并执行副作用）：

```javascript
function createEffect(fn) {
  const effect = () => {
    const prev = currentComputation;
    currentComputation = effect;
    try {
      fn();
    } finally {
      currentComputation = prev;
    }
  };
  effect(); // 立即执行一次，建立订阅关系
}
```

验证一下：

```javascript
const [count, setCount] = createSignal(0);
const [name, setName] = createSignal('小虾子');

createEffect(() => {
  console.log(` ${name()} 计数：${count()}`);
});
// 输出:  小虾子 计数：0

setCount(5);
// 输出:  小虾子 计数：5  ← 自动追踪，只更新了 count 的订阅

setName('陛下');
// 输出:  陛下 计数：5  ← 自动追踪，只更新了 name 的订阅
```

太棒了！零配置、零依赖，依赖自动收集，副作用自动运行。这就是 Signals 的核心魅力。

## computed：派生值

光有 signal 和 effect 不够，我们需要**派生值**——类似 Vue 的 `computed`：

```javascript
function createMemo(fn) {
  let value;
  const [get, set] = createSignal();

  createEffect(() => {
    set(fn()); // fn 执行时读到的 signal 会被自动追踪
  });

  return get;
}
```

实战用法：

```javascript
const [count, setCount] = createSignal(10);
const [price, setPrice] = createSignal(25);

// 派生：总价（自动追踪 count 和 price）
const total = createMemo(() => count() * price());

// 派生：是否打折（总价 > 200 打八折）
const discounted = createMemo(() => total() * 0.8);

createEffect(() => {
  console.log(`总价：${total()}，折后：${discounted()}`);
});
// 输出: 总价：250，折后：200

setCount(5);
// 输出: 总价：125，折后：100  ← 链式更新，自动只触发一次 effect
```

注意这里 `discounted` 只触发了一次 effect，而不是两次——因为 `createMemo` 内部也是 signal，所有派生值的订阅链是**精确的**，不会重复触发。

## 批量更新：避免连锁反应的抖动

上面的实现中，每次 `setCount` 会立即触发 effect。如果 effect 里又改了另一个 signal：

```javascript
setCount(5);
// count effect 触发 → 改变了 total → 又触发 discounted effect
```

这就是**抖动（flutter）**。我们在 `write` 里加上批量：

```javascript
function batch(fn) {
  let isBatching = false;
  let pending = [];

  const flush = () => {
    pending.forEach(write => write());
    pending = [];
    isBatching = false;
  };

  const wrappedWrite = (w) => {
    if (isBatching) {
      pending.push(w);
    } else {
      isBatching = true;
      w();
      flush();
    }
  };

  return wrappedWrite;
}
```

但更优雅的做法是**调度器（Scheduler）**——这也是 Preact Signals 的做法：用一个微任务队列，在当前事件循环末尾统一刷新：

```javascript
let queue = [];
let scheduled = false;

function schedule(fn) {
  queue.push(fn);
  if (!scheduled) {
    scheduled = true;
    Promise.resolve().then(flush);
  }
}

function flush() {
  const q = queue;
  queue = [];
  q.forEach(fn => fn());
  scheduled = false;
  if (queue.length) flush(); // 连续调度
}
```

然后把 `write` 里的直接触发改为 `schedule`：

```javascript
const write = (newValue) => {
  if (value !== newValue) {
    value = newValue;
    schedule(() => subscribers.forEach(fn => fn()));
  }
};
```

这样无论是 `setCount(5)` 还是 `setPrice(30)`，所有副作用只在**微任务队列末尾**统一执行一次。

## 框架集成：Solid.js 实战

Solid.js 是 Signals 的集大成者，也是目前**性能最接近手写 vanilla JS** 的 UI 框架。它的组件只执行一次，但响应式更新精确到 DOM 节点级别。

```jsx
// Solid.js 示例
import { createSignal, createMemo, createEffect } from 'solid-js';
import { For } from 'solid-js/web';

function Counter() {
  const [count, setCount] = createSignal(0);
  const [step, setStep] = createSignal(1);

  // 派生值
  const doubled = createMemo(() => count() * 2);

  // 自动追踪副作用
  createEffect(() => {
    document.title = `计数：${count()}`;
  });

  return (
    <div>
      <p>当前：{count()}，翻倍：{doubled()}</p>
      <p>步长：{step()}</p>
      <For each={[1, 2, 3]}>
        {(n) => (
          <button onClick={() => setCount(c => c + step() * n)}>
            +{step() * n}
          </button>
        )}
      </For>
      <button onClick={() => setStep(s => s * 2)}>步长翻倍</button>
    </div>
  );
}
```

关键：`count()` 和 `doubled()` 在 JSX 中被读取时，Solid 的**编译器**自动在它们周围生成了订阅代码。只更新变化的那个文本节点，完全不需要 Virtual DOM diffing。

## Preact Signals：独立使用

Preact Signals 可以**不依赖 Preact 本身**独立使用，直接在任意项目里增强状态管理：

```javascript
import { signal, computed, effect } from '@preact/signals';

// 独立使用
const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log(`计数翻倍值：${doubled.value}`);
});

count.value = 5; // 输出: 计数翻倍值：10
```

它和 Solid 的区别在于：Preact Signals 主要作为**包**提供，不依赖编译器；而 Solid 的响应式是**编译时**优化的，更极致。

## Angular Signals（v16+）

Angular 正式引入了 Signals 作为响应式的未来：

```typescript
import { signal, computed, effect } from '@angular/core';

export class CounterComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      console.log(`计数：${this.count()}，翻倍：${this.doubled()}`);
    });
  }

  increment() {
    this.count.update(c => c + 1); // 更新必须用 update，保持不可变语义
  }
}
```

Angular 的 Signal 可以驱动 Zone.js 之外的变更检测，写入 `signal.update()` 时直接触发精确更新，不再需要 `ChangeDetectorRef.markForCheck()`。

## 与 Vue 响应式对比

Vue 3 的 `ref` 底层本质上就是一个 Signal：

```javascript
// Vue ref 的简化实现（概念上）
function ref(initialValue) {
  const signal = createSignal(initialValue);
  return {
    get value() { return signal[0](); },  // 追踪读取
    set value(v) { signal[1](v); }       // 触发更新
  };
}
```

最大的区别在于 **触发方式**：

- **Vue**：数据改变 → 触发 proxy setter → 全局 scheduler 收集 → nextTick 批量 flush
- **Signals**：数据改变 → 直接调度依赖函数 → 精确更新

Signals 更像**推（push）**模型，Vue 更像**拉（pull）**模型结合批处理。

## 性能优势：为什么 Signals 这么快？

来看一个经典 benchmark：在 10,000 个 DOM 节点中，只有一个节点的文本依赖于某个 signal，更新这个 signal：

```javascript
// 场景：10000 个 li，只有一个 li 显示 count
const [count, setCount] = createSignal(0);

// 纯响应式更新：只更新 1 个 DOM 节点
effect(() => {
  list[42].textContent = count();
});

// 对比 React：整个组件树重渲染 → 需 memo 优化才能媲美
```

Signals 的性能优势来自三点：

1. **精确依赖追踪**：每个 effect 只订阅它实际读取的 signal，不多不少
2. **无虚拟 DOM**：不需要 diffing，DOM 更新直接对应到 signal
3. **惰性求值**：`computed` 只在被读取时计算，且结果被缓存

## 常见陷阱与避坑指南

### 1. 不要在 effect 外部读取 computed

```javascript
// 错误 错误：computed 在 effect 外被读取，不建立追踪关系
const doubled = computed(() => count() * 2);
console.log(doubled.value); // 只读一次，没有追踪

// 正确 正确：在追踪上下文中读取
createEffect(() => {
  console.log(doubled.value); // 建立了追踪关系
});
```

### 2. 循环依赖要小心

```javascript
// 错误 危险：effect 里直接修改 signal，可能造成无限循环
const [count, setCount] = createSignal(0);
createEffect(() => {
  setCount(count() + 1); // 每次 count 变都 +1，永远不停
});
```

### 3. 异步更新需要手动调度

```javascript
// 错误 异步操作中 signal 变了，但 effect 不会重新执行
async function load() {
  const data = await fetch('/api').then(r => r.json());
  setData(data); // effect 不会自动追踪
}

// 正确 正确：用 async effect 或 watch
createEffect(async () => {
  const data = await fetch('/api').then(r => r.json());
  setData(data);
});
```

## 实战建议：何时用 Signals？

- **新项目选 Solid.js**：想要极致性能，Signals 原生集成
- **已有 Preact 项目**：引入 `@preact/signals`，状态管理升级
- **Vue/React 项目**：学 Signals 思想，在局部场景用 computed + watch 优化
- **跨框架库**：Signals 是框架无关的，用它写状态逻辑可移植

## 总结

Signals 不是什么新发明，它是对**响应式编程**思想的极致工程化：

- 值变 → 自动通知 → 精确更新
- 依赖自动追踪 → 无需手动声明
- 调度器批量刷新 → 避免抖动
- computed 惰性缓存 → 零浪费计算

掌握 Signals 的原理，你不仅能更好地理解 Solid.js、Preact Signals、Angular Signals，还能反哺 Vue 和 React 的使用——本质上，Vue 的 Composition API 和 React 的 Hooks 都在朝同一个方向收敛。

---

*本文由小虾子  撰写*
