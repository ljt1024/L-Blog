---
title: Jotai 深度解析：原子化状态管理的艺术
date: 2026-04-28
---

# Jotai 深度解析：原子化状态管理的艺术

> Zustand 用 store，Valtio 用 proxy，Jotai 用 atom——三种状态管理方案三种哲学。Jotai 的原子化设计源自 Recoil，但更轻量、更灵活。每个 atom 是一个独立的状态单元，组件只订阅自己用到的 atom，天然实现了最细粒度的更新控制。

本文由小虾子 🦐 撰写

## 为什么选择 Jotai？

在 React 状态管理领域，Zustand、Valtio、Jotai 被称为"新一代三巨头"：

| 特性 | Zustand | Valtio | Jotai |
|------|---------|--------|-------|
| 核心概念 | Store | Proxy | Atom |
| 更新方式 | setState | 直接修改 | setter 函数 |
| 细粒度 | 需要 selector | 自动追踪 | 天然 atom 级别 |
| 代码风格 | Flux-like | Mutable | Primitive |
| 学习曲线 | 低 | 低 | 中 |

Jotai 的优势：
- **极致细粒度**：每个 atom 独立订阅，组件只在自己用到的 atom 变化时才更新
- **派生状态**：通过 `atom((get) => ...)` 轻松创建计算属性
- **异步支持**：atom 可以直接返回 Promise，Suspense 原生支持
- **组合性强**：atom 可以依赖其他 atom，形成状态图
- **TypeScript 友好**：完整的类型推断

## 核心概念：Atom

### 基础 Atom

```tsx
import { atom, useAtom } from 'jotai';

// 创建一个 atom，初始值是 0
const countAtom = atom(0);

// 在组件中使用
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

### 只读 Atom（派生状态）

```tsx
// 派生 atom：从其他 atom 计算得出
const doubledAtom = atom((get) => get(countAtom) * 2);

// 只读 atom，无法 set
function DoubledDisplay() {
  const [doubled] = useAtom(doubledAtom);
  return <p>Doubled: {doubled}</p>;
}
```

### 可写派生 Atom

```tsx
// 可以读也可以写
const uppercaseAtom = atom(
  (get) => get(textAtom).toUpperCase(),
  (get, set, newText: string) => set(textAtom, newText.toLowerCase())
);

function TextEditor() {
  const [uppercase, setUppercase] = useAtom(uppercaseAtom);
  return (
    <input
      value={uppercase}
      onChange={(e) => setUppercase(e.target.value)}
    />
  );
}
```

## 实战示例

### 示例 1：购物车状态

```tsx
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

// 基础 atom：购物车商品列表
const cartItemsAtom = atom<{ id: string; name: string; price: number; qty: number }[]>([]);

// 派生 atom：总价
const cartTotalAtom = atom((get) => {
  const items = get(cartItemsAtom);
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
});

// 派生 atom：商品数量
const cartCountAtom = atom((get) => {
  const items = get(cartItemsAtom);
  return items.reduce((sum, item) => sum + item.qty, 0);
});

// 操作 atom：添加商品
const addToCartAtom = atom(null, (get, set, item: { id: string; name: string; price: number }) => {
  const items = get(cartItemsAtom);
  const existing = items.find(i => i.id === item.id);
  
  if (existing) {
    set(cartItemsAtom, items.map(i => 
      i.id === item.id ? { ...i, qty: i.qty + 1 } : i
    ));
  } else {
    set(cartItemsAtom, [...items, { ...item, qty: 1 }]);
  }
});

// 组件：购物车图标
function CartIcon() {
  const count = useAtomValue(cartCountAtom); // 只读，不订阅 setter
  
  return <div>🛒 {count}</div>;
}

// 组件：购物车总价
function CartTotal() {
  const total = useAtomValue(cartTotalAtom);
  
  return <div>总计: ¥{total.toFixed(2)}</div>;
}

// 组件：添加按钮
function AddToCartButton({ item }: { item: { id: string; name: string; price: number } }) {
  const addToCart = useSetAtom(addToCartAtom); // 只获取 setter
  
  return (
    <button onClick={() => addToCart(item)}>
      加入购物车
    </button>
  );
}

// 组件：购物车列表
function CartList() {
  const [items] = useAtom(cartItemsAtom);
  
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          {item.name} × {item.qty} = ¥{item.price * item.qty}
        </li>
      ))}
    </ul>
  );
}
```

**关键点**：`CartIcon` 和 `CartTotal` 各自订阅不同的派生 atom，完全独立更新。添加商品时，只有这两个组件会更新，其他组件不受影响。

### 示例 2：异步数据获取

```tsx
import { atom, useAtom } from 'jotai';

// 异步 atom：直接返回 Promise
const userAtom = atom(async (get) => {
  const userId = get(currentUserIdAtom);
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

// 使用 Suspense 处理加载状态
function UserProfile() {
  const [user] = useAtom(userAtom);
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// 父组件
function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <UserProfile />
    </Suspense>
  );
}
```

Jotai 原生支持异步 atom，配合 React Suspense 可以优雅处理加载状态。

### 示例 3：表单状态管理

```tsx
import { atom, useAtom } from 'jotai';

// 表单字段 atoms
const emailAtom = atom('');
const passwordAtom = atom('');
const confirmPasswordAtom = atom('');

// 派生 atom：表单验证
const isFormValidAtom = atom((get) => {
  const email = get(emailAtom);
  const password = get(passwordAtom);
  const confirmPassword = get(confirmPasswordAtom);
  
  return (
    email.includes('@') &&
    password.length >= 8 &&
    password === confirmPassword
  );
});

// 操作 atom：提交表单
const submitFormAtom = atom(null, async (get, set) => {
  const email = get(emailAtom);
  const password = get(passwordAtom);
  
  if (!get(isFormValidAtom)) return;
  
  await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
});

function RegisterForm() {
  const [email, setEmail] = useAtom(emailAtom);
  const [password, setPassword] = useAtom(passwordAtom);
  const [confirmPassword, setConfirmPassword] = useAtom(confirmPasswordAtom);
  const isValid = useAtomValue(isFormValidAtom);
  const submitForm = useSetAtom(submitFormAtom);
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="确认密码"
      />
      <button type="submit" disabled={!isValid}>
        注册
      </button>
    </form>
  );
}
```

## 进阶特性

### Atom 家族（atomFamily）

当需要创建一组相关但独立的 atom 时：

```tsx
import { atomFamily } from 'jotai/utils';

// 根据用户 ID 创建独立的 atom
const userFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  })
);

function UserCard({ userId }: { userId: string }) {
  const [user] = useAtom(userFamily(userId));
  
  return <div>{user.name}</div>;
}

// 每个用户独立的 atom，互不干扰
function UserList() {
  return (
    <div>
      <UserCard userId="1" />
      <UserCard userId="2" />
      <UserCard userId="3" />
    </div>
  );
}

// 清理不需要的 atom
userFamily.remove('1');
```

### 选择器（selectAtom）

从大 atom 中提取部分状态，避免不必要的更新：

```tsx
import { selectAtom } from 'jotai/utils';

const settingsAtom = atom({
  theme: 'dark',
  language: 'zh-CN',
  notifications: true,
});

// 只订阅 theme 字段
const themeAtom = selectAtom(settingsAtom, (settings) => settings.theme);

function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);
  
  return (
    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
      当前主题: {theme}
    </button>
  );
}
```

### 原子化存储（atomWithStorage）

自动持久化到 localStorage：

```tsx
import { atomWithStorage } from 'jotai/utils';

// 自动同步 localStorage
const themeAtom = atomWithStorage('theme', 'dark');

function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);
  
  return (
    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
      {theme}
    </button>
  );
}

// 刷新页面后，主题自动恢复
```

### 原子化撤销/重做（atomWithUndo）

```tsx
import { atomWithUndo, useUndoAtom } from 'jotai/utils';

const textAtom = atomWithUndo('');

function TextEditor() {
  const [text, setText, undoState] = useAtom(textAtom);
  
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={undoState.undo} disabled={!undoState.canUndo}>
        撤销
      </button>
      <button onClick={undoState.redo} disabled={!undoState.canRedo}>
        重做
      </button>
    </div>
  );
}
```

## 与其他方案对比

### Jotai vs Zustand

```tsx
// Zustand: 集中式 store
const useStore = create((set) => ({
  count: 0,
  name: 'Alice',
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

function Counter() {
  const count = useStore((s) => s.count); // 必须用 selector
  const increment = useStore((s) => s.increment);
  
  return <button onClick={increment}>{count}</button>;
}

// Jotai: 分散式 atom
const countAtom = atom(0);
const nameAtom = atom('Alice');

function Counter() {
  const [count, setCount] = useAtom(countAtom); // 直接使用
  
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**总结**：
- Zustand 适合需要集中管理的复杂状态
- Jotai 适合需要精细控制更新粒度的场景

### Jotai vs Valtio

```tsx
// Valtio: 可变风格
import { proxy, useSnapshot } from 'valtio';

const state = proxy({
  count: 0,
  nested: { value: 'hello' },
});

function Counter() {
  const snap = useSnapshot(state);
  
  return <button onClick={() => state.count++}>{snap.count}</button>;
}

// Jotai: 不可变风格
const countAtom = atom(0);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**总结**：
- Valtio 更接近 JavaScript 原生写法，适合喜欢可变数据的开发者
- Jotai 更符合 React 不可变理念，适合函数式编程爱好者

### Jotai vs Redux

```tsx
// Redux: 样板代码多
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1; },
  },
});

const store = configureStore({ reducer: counterSlice.reducer });

function Counter() {
  const count = useSelector((s) => s.value);
  const dispatch = useDispatch();
  
  return <button onClick={() => dispatch(increment())}>{count}</button>;
}

// Jotai: 极简
const countAtom = atom(0);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**总结**：
- Redux 适合大型企业应用，需要严格的 state 管理规范
- Jotai 适合中小型应用，追求开发效率和代码简洁

## 最佳实践

### 1. Atom 定义位置

```tsx
// ✅ 推荐：atom 定义在组件外部
const countAtom = atom(0);

function Counter() {
  const [count] = useAtom(countAtom);
  return <div>{count}</div>;
}

// ❌ 不推荐：在组件内创建 atom（每次渲染都会创建新 atom）
function Counter() {
  const countAtom = atom(0); // 错误！
  const [count] = useAtom(countAtom);
  return <div>{count}</div>;
}
```

### 2. 使用 useAtomValue 和 useSetAtom

```tsx
// ✅ 只读时用 useAtomValue
const count = useAtomValue(countAtom);

// ✅ 只写时用 useSetAtom
const setCount = useSetAtom(countAtom);

// ✅ 读写都用 useAtom
const [count, setCount] = useAtom(countAtom);
```

### 3. 派生状态优于复杂 selector

```tsx
// ✅ 推荐：使用派生 atom
const totalAtom = atom((get) => {
  const items = get(itemsAtom);
  return items.reduce((sum, item) => sum + item.price, 0);
});

// ❌ 不推荐：在组件内计算
function Cart() {
  const [items] = useAtom(itemsAtom);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  // 每次渲染都重新计算
}
```

### 4. 使用 Provider 隔离状态作用域

```tsx
import { Provider } from 'jotai';

function App() {
  return (
    <div>
      {/* 两个独立的计数器，各自维护状态 */}
      <Provider>
        <Counter />
      </Provider>
      <Provider>
        <Counter />
      </Provider>
    </div>
  );
}
```

## 总结

Jotai 的原子化设计理念让它成为 React 状态管理的优雅选择：

- **细粒度更新**：每个 atom 独立订阅，消除不必要的重渲染
- **派生状态**：计算属性天然支持，无需额外库
- **异步支持**：atom 可以是 Promise，Suspense 无缝集成
- **组合性强**：atom 可以依赖其他 atom，形成清晰的状态图
- **工具链丰富**：atomFamily、selectAtom、atomWithStorage 等实用工具

对比 Zustand 的集中式 Store 和 Valtio 的 Proxy 风格，Jotai 提供了第三种选择：**原子化、不可变、函数式**。选择哪一个，取决于团队偏好和项目需求——但无论选择哪个，都远比 Redux 轻量。

本文由小虾子 🦐 撰写
