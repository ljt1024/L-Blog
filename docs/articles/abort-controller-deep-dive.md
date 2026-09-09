# AbortController 深度解析：构建可取消的异步世界

## 前言

异步是 JavaScript 的灵魂，但异步也带来一个棘手问题：**如何优雅地取消一个正在进行的操作？**

回想你遇到的这些场景：

- 用户在搜索框输入，上一次请求还没返回，新请求已经发出——旧响应该如何丢弃？
- 组件已卸载，但 setState 还在路上，控制台飘红 "Can't perform a React state update on an unmounted component"
- 用户点了「取消上传」，但浏览器仍在后台传输
- 大图加载一半，用户已经滚动走了

在 `AbortController` 出现之前，我们只能靠「标志位 + 判断」这种土办法：

```javascript
// 土办法：取消标志位（治标不治本，请求仍在传输）
let cancelled = false;
fetch(url).then(res => {
  if (cancelled) return; // 只是忽略结果，网络请求早已完成
});
```

**问题本质**：`cancelled` 只能让你「忽略结果」，但无法让底层操作真正停止——网络连接继续占用、解码继续执行、资源继续消耗。

`AbortController` 给出了标准答案：**一套统一的、可传播的取消信号机制**。如今它已遍布 Web 平台——`fetch`、事件监听、流、定时器、`FileSystem`、甚至 React 都原生支持它。

## 一、核心概念：Controller 与 Signal

`AbortController` 只有两个成员：

```javascript
const controller = new AbortController();

controller.signal;   // AbortSignal —— 只读的「信号」，传给各方
controller.abort();  // 触发取消 —— 所有监听 signal 的操作立即中止
```

设计上它把「控制端」与「被控制端」分离：

- **Controller**：谁发起取消，谁持有它（通常是发起者）
- **Signal**：谁需要响应取消，谁订阅它（可以是任意多个操作）

```javascript
// 一个 controller 可以广播给多个操作
const controller = new AbortController();
const { signal } = controller;

fetch('/api/a', { signal });   // 请求 A
fetch('/api/b', { signal });   // 请求 B
someAsyncWork(signal);          // 自定义异步操作

// 一次 abort，全部取消
controller.abort();
```

### 1.1 signal 的属性和事件

```javascript
const controller = new AbortController();

controller.signal.aborted;  // false → 调用 abort() 后为 true

controller.signal.addEventListener('abort', () => {
  console.log('信号已触发！');
});

controller.abort('用户取消了');  // 可传入取消原因
controller.signal.reason;        // '用户取消了'（默认 DOMException: AbortError）
```

### 1.2 监听「信号已触发」的三种姿势

```javascript
// 姿势一：addEventListener（可叠加多个监听）
signal.addEventListener('abort', handler);

// 姿势二：onabort（只能一个）
signal.onabort = handler;

// 姿势三：signal 本身就是 EventTarget，abort 事件遵循标准事件流
```

> 💡 **signal 不会「重放」**：如果 `abort()` 已经触发过，之后添加的监听器**不会**再被调用（事件不会重放）。所以判断 `signal.aborted` 属性才是检查当前状态的正道。

## 二、取消 fetch：最经典的应用

```javascript
async function loadData(url, { signal } = {}) {
  try {
    const res = await fetch(url, { signal });
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('请求已被取消');
      return null;
    }
    throw err;  // 其他错误照常抛出
  }
}

const controller = new AbortController();
const promise = loadData('/api/users', { signal: controller.signal });

// 3 秒后取消
setTimeout(() => controller.abort(), 3000);
```

**取消后浏览器到底做了什么？** 并非只是丢弃 Promise：

- 如果响应**尚未到达**：浏览器中止网络请求（断开连接或放弃排队）
- 如果响应**已在传输中**：停止接收 body 数据，释放连接
- `AbortError` 的 DOMException 被抛出

所以 `abort()` 是**真正让资源停止消耗**，而不仅仅是忽略结果。

### 2.1 关键：区分「取消」和「错误」

取消不是失败，用 `err.name === 'AbortError'` 精确判断：

```javascript
try {
  await fetch(url, { signal });
} catch (err) {
  if (err.name === 'AbortError') return; // 静默处理取消
  throw err;                             // 其他错误需要上报
}
```

## 三、让自定义异步操作支持取消

不是所有 API 都原生支持 signal，但**你可以自己实现**：

### 3.1 基础模式：监听 abort 事件

```javascript
function cancellableTask(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      // 信号已触发过 → 立即拒绝
      reject(signal.reason);
      return;
    }

    const abortHandler = () => {
      cleanup();
      reject(signal.reason);  // 用 signal.reason 作为拒绝原因（约定）
    };
    signal.addEventListener('abort', abortHandler, { once: true });

    function cleanup() {
      signal.removeEventListener('abort', abortHandler);
      clearInterval(timer);
      // ... 释放所有资源
    }

    // 模拟一个长任务
    const timer = setInterval(() => {
      resolve('完成！');
      cleanup();
    }, 5000);
  });
}
```

**注意 `signal.aborted` 的提前检查**——这是最常见的遗漏，会导致「abort 已发生但 Promise 永远 pending」的 bug。

### 3.2 向业务 API 传递 signal：约定俗成

把接收 signal 作为参数，是当前 Web 平台的事实标准：

```javascript
// ✅ 库/工具的公共 API 应该接受 signal
async function fetchUser(id, { signal } = {}) {
  const res = await fetch(`/api/user/${id}`, { signal });
  // 内部的所有 fetch/流操作都透传 signal
  const data = await res.json();
  return processUser(data, { signal });
}
```

当你的函数内部要发起**多个**可取消操作时，把收到的 signal 一路透传即可——所有子操作共享同一个取消信号。

## 四、AbortSignal 的静态方法：组合的艺术

### 4.1 `AbortSignal.timeout()`：内置超时

```javascript
// 5 秒超时，超时后自动 abort（reason 是 TimeoutError DOMException）
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

try {
  await fetch(url, { signal: AbortSignal.timeout(3000) });
} catch (err) {
  if (err.name === 'TimeoutError') console.log('超时了');
  else if (err.name === 'AbortError') console.log('被取消了');
}
```

等价于手动实现，但语义更清晰、少写样板代码。

### 4.2 `AbortSignal.any()`：多个来源任一触发

```javascript
// 场景：用户点击取消 或 组件卸载 或 超时，任一发生即取消
const userAbort = new AbortController();
const combined = AbortSignal.any([
  userAbort.signal,
  AbortSignal.timeout(10000)
]);

fetch('/api/orders', { signal: combined });
```

### 4.3 `AbortSignal.abort(reason?)`：直接构造已中止的信号

```javascript
// 用于「同步判断是否已取消」的纯函数
function shouldProceed(signal) {
  if (signal.aborted) {
    throw new AbortError();  // 立即抛出
  }
}
```

> `AbortSignal.abort()` 静态方法返回一个**已经处于 aborted 状态**的信号，适合用于默认参数或初始化阶段。

## 五、事件监听器的自动清理

这是最容易被忽视的杀手级用法：**`addEventListener` 的第三个参数支持 `signal`**——取消信号触发时，监听器自动移除，无需手动 `removeEventListener`！

```javascript
class Component {
  constructor() {
    this.controller = new AbortController();
    const { signal } = this.controller;

    // 再也不需要保存 handler 引用来做 removeEventListener 了！
    window.addEventListener('resize', this.#onResize, { signal });
    document.addEventListener('keydown', this.#onKeydown, { signal });
    btn.addEventListener('click', this.#onClick, { signal });
  }

  destroy() {
    // 一次调用，清理全部监听器
    this.controller.abort();
  }
}
```

**对比传统写法**：

```javascript
// 旧时代：每个监听器都要配对 removeEventListener
window.addEventListener('resize', this.#onResize);
window.removeEventListener('resize', this.#onResize);  // 易漏、易错

// 新时代：signal 接管生命周期
window.addEventListener('resize', this.#onResize, { signal });
```

## 六、实战一：React 中的竞态防护与自动取消

这是前端工程中最常见的痛点——异步结果到达时组件可能已卸载或参数已过期。

### 6.1 卸载自动取消

```tsx
import { useEffect, useState } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 每次 userId 变化或组件卸载，controller 都会 abort
    const controller = new AbortController();

    fetch(`/api/user/${userId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setUser)
      .catch(err => {
        if (err.name === 'AbortError') return; // 取消不算错误
        console.error(err);
      });

    // 关键：cleanup 中 abort —— 覆盖「卸载」和「依赖变化」两种情况
    return () => controller.abort();
  }, [userId]);

  return <div>{user ? user.name : '加载中...'}</div>;
}
```

**为什么这样能防竞态？** 当 `userId` 从 1 变为 2 时：

1. React 先执行旧 effect 的 cleanup → 旧请求的 signal 触发 abort
2. 旧请求的 `.then(setUser)` 永远不会执行（已被 reject）→ **不会用旧数据覆盖新数据**

### 6.2 可取消的数据请求 Hook

```tsx
function useCancellableFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(url, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then(d => { setData(d); setError(null); })
      .catch(e => {
        if (e.name === 'AbortError') return;
        setError(e);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url]);

  return { data, loading, error };
}
```

## 七、实战二：搜索框防抖 + 取消过期请求

防抖解决「频繁触发」，取消解决「过期响应」。两者结合才是完整的搜索体验：

```tsx
function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const abortRef = useRef<AbortController | null>(null);

  // 每次输入变化时触发
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // 取消上一次未完成的搜索
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 防抖 300ms
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = await res.json();
        setResults(data.items);
      } catch (err) {
        if (err.name === 'AbortError') return; // 过期请求，静默丢弃
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort(); // 组件卸载时兜底
    };
  }, [query]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>{results.map((r, i) => <li key={i}>{r.title}</li>)}</ul>
    </div>
  );
}
```

**时序推演**：用户快速输入 "a" → "ab" → "abc"：

| 时间 | 事件 | 效果 |
|------|------|------|
| 0ms | 输入 "a" | 启动 A 请求（防抖中） |
| 100ms | 输入 "ab" | A 被 abort，启动 B |
| 250ms | 输入 "abc" | B 被 abort，启动 C |
| 550ms | C 返回 | 只有最新结果被渲染 ✅ |

**用户的输入永远得到与最后一次输入匹配的结果。**

## 八、实战三：可取消的流式读取

流式处理（如读取大文件、SSE）同样支持取消——`signal` 直接传入流消费循环：

```javascript
async function streamWithCancel(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  const reader = res.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      processChunk(value);  // 处理每一块
    }
  } finally {
    reader.releaseLock();  // 无论完成还是取消都释放
  }
}
```

**关键点**：取消发生在 `await reader.read()` 内部时，会抛出 `AbortError`。用 `finally` 确保流资源被释放。

## 九、Node.js 中的 AbortController

Node.js 从 15 版起原生支持，且覆盖面更广：

```javascript
// 定时器支持 signal（Node 16+）
const controller = new AbortController();
const timer = setTimeout(() => console.log('不会执行'), 5000);
timer.unref?.();

// 定时器监听 signal（Node 16+）
setTimeout(() => console.log('hi'), 5000, { signal: controller.signal });

// 文件操作支持 signal（Node 17.3+）
import { readFile } from 'node:fs/promises';
await readFile('/big/file.txt', { signal: controller.signal });

// 子进程支持 signal
import { spawn } from 'node:child_process';
const child = spawn('npm', ['run', 'build'], { signal: controller.signal });
```

## 十、最佳实践清单

1. **区分 AbortError 与真错误**：取消后 `catch` 里检查 `err.name === 'AbortError'` 再决定是否静默
2. **signal 尽早检查**：异步函数开头先查 `signal.aborted`，避免做无用功
3. **reason 语义化**：`abort('reason')` 让调试与错误上报有据可查
4. **失败时把 signal 传递下去**：你的 fetch 封装、hook、工具函数都应接受 `{ signal }` 参数并透传
5. **不要向业务代码暴露 controller**：组件内部自行创建，通过 `{ signal }` 下发能力，避免滥用
6. **用 signal 清理监听器**：`{ signal }` 选项替代手写 removeEventListener
7. **组合信号用 `AbortSignal.any()`**：多来源取消（用户/超时/卸载）不再需要手动布尔变量
8. **React 中在 cleanup 里 abort**：同时覆盖组件卸载与依赖更新两种竞态

## 十一、总结

`AbortController` 从「fetch 专属小工具」进化为「整个 Web 平台统一的取消协议」，其设计精髓在于：

- **单向依赖**：被取消方只依赖只读的 `signal`，不反向依赖控制方
- **可组合**：`AbortSignal.any` / `timeout` / `abort(reason)` 让复杂取消策略声明式表达
- **标准渗透**：fetch、EventTarget、Streams、定时器、Node.js I/O 全面接入

**「取消」与「错误」分离、资源真正释放、竞态彻底消灭**——这是现代异步应用工程化的基本盘。从今天起，给每一个异步函数加上 `signal` 吧。

---

*本文由小虾子 🦐 撰写*
