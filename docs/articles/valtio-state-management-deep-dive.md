# Valtio 深度解析：Proxy 驱动的极简状态管理

> Zustand 用 hook，Jotai 用 atom，Redux 用 reducer——它们都要重新渲染组件。Valtio 不一样，它直接修改对象，自动追踪读取位置，只在需要时触发更新。听起来像魔法？这篇帮你彻底理解 Proxy 驱动的状态管理。

<!-- more -->

## 为什么需要另一种状态管理？

看看现有方案的局限：

```typescript
// Zustand：全局 store，修改后整个组件树可能重渲染
const useStore = create((set) => ({
  user: { name: "Alice", age: 25 },
  updateAge: (age: number) => set({ user: { ...state.user, age } }),
}));

// 问题：user 对象每次都是新引用
// component → useStore() → 任何 state 变化都触发重渲染
// 必须用 selector 精细控制：useStore((s) => s.user.name)

// Jotai：atom 粒度，但每个 atom 都是独立值
const userAtom = atom({ name: "Alice", age: 25 });
const nameAtom = atom((get) => get(userAtom).name);

// 问题：派生状态要拆成独立 atom，代码碎片化
```

Valtio 的思路：**直接修改普通对象，像写普通 JS 一样写状态**。

## Valtio 是什么？

```bash
npm install valtio
# 或
bun add valtio
```

核心原理：用 `Proxy` 追踪对象属性的读写，只在读取的位置触发更新。

```typescript
import { proxy, useSnapshot } from "valtio";

// 1. 创建代理对象（可以随便改）
const state = proxy({
  user: { name: "Alice", age: 25 },
  posts: [] as Post[],
  loading: false,
});

// 2. 直接修改（像普通 JS 一样）
state.user.age = 26;
state.posts.push({ id: 1, title: "Hello" });
state.loading = true;

// 3. 组件中用 useSnapshot 订阅
function UserProfile() {
  const snap = useSnapshot(state); // 只在读取的属性变化时更新
  return <div>{snap.user.name} - {snap.user.age}</div>;
}
```

## 核心 API

### proxy：创建代理状态

```typescript
import { proxy, subscribe } from "valtio";

// 基础用法
const state = proxy({
  count: 0,
  user: { name: "Alice", age: 25 },
  items: [] as string[],
});

// 直接修改
state.count++;
state.user.age++;
state.items.push("new item");

// 嵌套修改
state.user = { ...state.user, age: 30 }; // 新对象也自动代理

// 监听变化
const unsub = subscribe(state, (ops) => {
  console.log("变化了:", ops);
});
// ops 示例：[{ op: 'set', path: ['user', 'age'], value: 30 }]
```

### useSnapshot：订阅状态

```typescript
import { useSnapshot } from "valtio";

function Counter() {
  // 完整订阅：任何变化都触发重渲染
  const snap = useSnapshot(state);

  return (
    <div>
      <p>Count: {snap.count}</p>
      <button onClick={() => state.count++}>+1</button>
    </div>
  );
}

function UserName() {
  // 精细订阅：只有 user.name 变化才重渲染
  const snap = useSnapshot(state, { proxy: state.user });
  // 或者用 filter
  const snap = useSnapshot(state, {
    filter: (op) => op[0].path.includes("user") && op[0].path.includes("name"),
  });

  return <p>Name: {snap.user.name}</p>;
}
```

### derive：派生状态

```typescript
import { derive, proxy } from "valtio";

const state = proxy({
  firstName: "Alice",
  lastName: "Smith",
});

// 派生状态
const derived = derive({
  fullName: (get) => `${get(state).firstName} ${get(state).lastName}`,
  isAdult: (get) => get(state).age >= 18,
});

// 在组件中使用
function UserCard() {
  const snap = useSnapshot(state);
  const { fullName, isAdult } = useSnapshot(derived);

  return (
    <div>
      <p>{fullName}</p>
      <p>{isAdult ? "成年人" : "未成年"}</p>
    </div>
  );
}
```

### ref：引用非代理值

```typescript
import { proxy, ref } from "valtio";

// 不需要响应式的值用 ref 包装
const state = proxy({
  user: { name: "Alice" },
  // Date 对象不需要代理
  lastLogin: ref(new Date()),
  // 第三方实例不需要代理
  mapInstance: ref(null as Map<string, string> | null),
});

// 修改 ref 不会触发更新
state.lastLogin = new Date(); // 不会触发组件更新
```

## 实战：Todo 应用

```typescript
// store/todo.ts
import { proxy } from "valtio";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export const todoState = proxy<{
  todos: Todo[];
  filter: "all" | "active" | "completed";
  newTodo: string;
}>({
  todos: [
    { id: 1, text: "学习 Valtio", completed: false },
    { id: 2, text: "写一篇博客", completed: true },
  ],
  filter: "all",
  newTodo: "",
});

// Actions
export const addTodo = (text: string) => {
  todoState.todos.push({
    id: Date.now(),
    text,
    completed: false,
  });
  todoState.newTodo = "";
};

export const toggleTodo = (id: number) => {
  const todo = todoState.todos.find((t) => t.id === id);
  if (todo) todo.completed = !todo.completed;
};

export const deleteTodo = (id: number) => {
  const index = todoState.todos.findIndex((t) => t.id === id);
  if (index > -1) todoState.todos.splice(index, 1);
};

export const setFilter = (filter: "all" | "active" | "completed") => {
  todoState.filter = filter;
};

export const setNewTodo = (text: string) => {
  todoState.newTodo = text;
};
```

```typescript
// components/TodoList.tsx
import { useSnapshot } from "valtio";
import { todoState, addTodo, toggleTodo, deleteTodo, setFilter, setNewTodo } from "../store/todo";

export function TodoApp() {
  const state = useSnapshot(todoState);

  const filteredTodos = state.todos.filter((todo) => {
    if (state.filter === "active") return !todo.completed;
    if (state.filter === "completed") return todo.completed;
    return true;
  });

  return (
    <div className="todo-app">
      <h1>Valtio Todo</h1>

      {/* 输入框 */}
      <input
        value={state.newTodo}
        onChange={(e) => setNewTodo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state.newTodo.trim()) {
            addTodo(state.newTodo);
          }
        }}
        placeholder="添加任务..."
      />

      {/* 筛选 */}
      <div className="filter">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            className={state.filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.completed ? "completed" : ""}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 与 React 深度集成

### 异步状态

```typescript
const state = proxy({
  data: null as Data | null,
  loading: false,
  error: null as Error | null,
});

async function fetchData() {
  state.loading = true;
  state.error = null;
  try {
    const res = await fetch("/api/data");
    state.data = await res.json();
  } catch (e) {
    state.error = e as Error;
  } finally {
    state.loading = false;
  }
}

function DataDisplay() {
  const snap = useSnapshot(state);

  if (snap.loading) return <Spinner />;
  if (snap.error) return <Error error={snap.error} />;
  if (!snap.data) return null;

  return <div>{snap.data.content}</div>;
}
```

### 中间件（类似 Redux）

```typescript
import { proxy, subscribe } from "valtio";
import { ref } from "valtio";

// 日志中间件
const withLogger = (proxy: any) => {
  return new Proxy(proxy, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      console.log(`读取: ${String(prop)}`, value);
      return value;
    },
    set(target, prop, value) {
      console.log(`设置: ${String(prop)}`, value);
      return Reflect.set(target, prop, value);
    },
  });
};

// 持久化中间件
const withStorage = (proxy: any, key: string) => {
  // 初始化从 localStorage 读取
  const stored = localStorage.getItem(key);
  if (stored) {
    Object.assign(proxy, JSON.parse(stored));
  }

  // 订阅变化并保存
  subscribe(proxy, () => {
    localStorage.setItem(key, JSON.stringify(proxy));
  });

  return proxy;
};

// 使用中间件
const state = withStorage(
  withLogger(
    proxy({
      theme: "light",
      user: null,
    })
  ),
  "app-state"
);
```

### 与 Class 组件结合

```typescript
import { useSnapshot } from "valtio";
import { proxy } from "valtio";

// 依然可以用于 class 组件
const state = proxy({ count: 0 });

class Counter extends React.Component {
  render() {
    const snap = useSnapshot(state); // 依然需要在函数组件或 useSyncExternalStore 中用
    return <div>{snap.count}</div>;
  }
}

// 或者用 useSyncExternalStore（React 18+）
import { useSyncExternalStore } from "react";

function useValtio<T>(proxy: T): T {
  return useSyncExternalStore(
    (cb) => subscribe(proxy, cb),
    () => proxy,
    () => proxy
  );
}
```

## 对比选择

| 特性 | Zustand | Valtio | Jotai | Redux |
|------|---------|--------|-------|-------|
| 范式 | hook | Proxy | atom | reducer |
| 重渲染 | 手动 selector | 自动追踪 | atom 粒度 | selector |
| 学习曲线 | 低 | 中 | 中 | 高 |
| 包体积 | ~1KB | ~3KB | ~3KB | ~7KB |
| 适用场景 | 通用 | 需细粒度更新 | 派生状态多 | 大型应用 |
| TypeScript | 好 | 非常好 | 非常好 | 好 |

### 什么时候选 Valtio？

```typescript
// Zustand 写法
const useStore = create((set) => ({
  user: { name: "Alice", age: 25 },
  updateAge: (age: number) =>
    set((state) => ({ user: { ...state.user, age } })),
})),
function UserAge() {
  // 需要手动 selector，否则 user.name 变化也会触发
  const age = useStore((s) => s.user.age);
  return <span>{age}</span>;
}

// Valtio 写法
const state = proxy({ user: { name: "Alice", age: 25 } });
function UserAge() {
  // 自动只在这个属性变化时更新
  const snap = useSnapshot(state);
  return <span>{snap.user.age}</span>;
}
```

## 总结

Valtio 的核心优势：

| 特性 | 价值 |
|------|------|
| **Proxy 驱动** | 直接修改对象，无需immer或不可变更新 |
| **自动精细更新** | 只更新读取了变化属性的组件 |
| **零样板代码** | 不需要 action creator、dispatch、selector |
| **原生对象语法** | `state.user.age++` 直接写 |
| **TypeScript 友好** | 完整类型推断，无需额外类型声明 |
| **中间件支持** | 可扩展日志、持久化、撤销重做 |

如果你觉得 Zustand 要写太多 selector，Jotai 要拆太多 atom，Redux 太繁琐——试试 Valtio，它可能是最接近"直接修改状态"这个理想的状态管理方案。

*本文由小虾子  撰写*
