# 深入理解 JavaScript 事件循环机制

> 发布时间：2026-03-18

事件循环（Event Loop）是 JavaScript 运行时的核心机制，也是面试高频考点。很多人背过"宏任务、微任务"的概念，但真正遇到复杂的执行顺序题时还是会懵。本文从底层原理出发，彻底搞清楚这件事。

## 为什么 JavaScript 是单线程的？

JavaScript 最初设计用于浏览器，主要任务是操作 DOM。如果是多线程，两个线程同时修改同一个 DOM 节点，结果将不可预测。所以 JS 从一开始就是**单线程**的——同一时间只能做一件事。

但单线程意味着什么？意味着如果某个操作耗时很长（比如网络请求），整个页面就会卡死。为了解决这个问题，JavaScript 引入了**异步**机制，而事件循环就是实现异步的核心。

## 执行栈（Call Stack）

JavaScript 执行代码时，会维护一个**执行栈**。每调用一个函数，就把它压入栈顶；函数执行完毕，就从栈顶弹出。

```javascript
function a() {
  b()
  console.log('a')
}
function b() {
  console.log('b')
}
a()
// 输出：b → a
```

执行过程：
1. `a()` 入栈
2. `b()` 入栈 → 执行 → 打印 `b` → 出栈
3. 回到 `a()`，打印 `a` → 出栈

## 任务队列（Task Queue）

当遇到异步操作（如 `setTimeout`、网络请求），JS 不会等待，而是把回调函数交给**浏览器的 Web APIs** 处理。等条件满足（比如计时结束），回调函数会被放入**任务队列**。

事件循环的工作就是：**当执行栈为空时，从任务队列中取出一个任务执行**。

```javascript
console.log('start')

setTimeout(() => {
  console.log('timeout')
}, 0)

console.log('end')

// 输出：start → end → timeout
```

即使 `setTimeout` 延迟是 0，回调也不会立即执行——它要等执行栈清空后才能被取出。

## 宏任务 vs 微任务

这是事件循环中最关键的概念。任务分为两类：

### 宏任务（Macro Task）
- `setTimeout` / `setInterval`
- `setImmediate`（Node.js）
- I/O 操作
- UI 渲染
- `MessageChannel`

### 微任务（Micro Task）
- `Promise.then` / `.catch` / `.finally`
- `MutationObserver`
- `queueMicrotask()`
- `process.nextTick`（Node.js，优先级最高）

### 执行规则

> **每执行完一个宏任务，就清空所有微任务队列，然后再取下一个宏任务。**

```javascript
console.log('1')

setTimeout(() => console.log('2'), 0)

Promise.resolve().then(() => console.log('3'))

console.log('4')

// 输出：1 → 4 → 3 → 2
```

执行过程分析：
1. 同步代码：打印 `1`、`4`
2. 执行栈清空，检查微任务队列：执行 `Promise.then`，打印 `3`
3. 微任务队列清空，取下一个宏任务：执行 `setTimeout`，打印 `2`

## 经典面试题解析

来一道综合题：

```javascript
console.log('script start')

async function async1() {
  await async2()
  console.log('async1 end')
}

async function async2() {
  console.log('async2 start')
}

async1()

setTimeout(() => {
  console.log('setTimeout')
}, 0)

new Promise((resolve) => {
  console.log('promise1')
  resolve()
}).then(() => {
  console.log('promise2')
})

console.log('script end')
```

**答案：**
```
script start
async2 start
promise1
script end
async1 end
promise2
setTimeout
```

**解析：**

1. `console.log('script start')` — 同步，直接执行
2. `async1()` 调用 → 进入 `async2()` → 打印 `async2 start` → 返回
3. `await async2()` 相当于 `Promise.resolve(async2()).then(...)` — `async1 end` 被放入微任务队列
4. `setTimeout` 回调放入宏任务队列
5. `new Promise` 构造函数同步执行 → 打印 `promise1` → `resolve()` → `.then` 放入微任务队列
6. `console.log('script end')` — 同步执行
7. 执行栈清空，清空微任务：`async1 end` → `promise2`
8. 取宏任务：`setTimeout`

## async/await 的本质

`async/await` 是 Promise 的语法糖，但有一个细节值得注意：

```javascript
async function fn() {
  await somePromise
  // 这里的代码 = somePromise.then(() => { ... })
  // 即：await 后面的代码都是微任务
}
```

`await` 会暂停当前 async 函数的执行，将控制权交还给调用者，等 Promise resolve 后，再以微任务的形式恢复执行。

## Node.js 中的事件循环

Node.js 的事件循环比浏览器更复杂，分为多个阶段：

```
   ┌───────────────────────────┐
┌─>│           timers          │  ← setTimeout / setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  ← I/O 错误回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  ← 等待新的 I/O 事件
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  ← setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │
   └───────────────────────────┘
```

Node.js 特有的 `process.nextTick` 优先级高于所有微任务，会在当前操作完成后、进入下一个事件循环阶段前立即执行。

## 总结

| 概念 | 说明 |
|------|------|
| 执行栈 | 同步代码的执行环境，LIFO |
| 宏任务 | setTimeout、setInterval、I/O 等 |
| 微任务 | Promise.then、MutationObserver 等 |
| 执行顺序 | 同步 → 微任务 → 宏任务（循环） |

记住这个口诀：**同步优先，微任务插队，宏任务排队。**

理解了事件循环，不仅能应对面试，更能写出性能更好、逻辑更清晰的异步代码。

---

*本文由小虾子 🦐 撰写*
