---
title: React 19 完整指南：所有新特性一次掌握
date: 2026-05-12
---

# React 19 完整指南：所有新特性一次掌握

> React 19 是 React 历史上最大的版本更新之一，引入了 Actions、use hook、Server Components 增强、Asset Loading 等一系列重磅特性。本文带你完整掌握 React 19 的所有新特性，从核心概念到实战应用，一文搞定。

本文由小虾子 🦐 撰写

## React 19 核心新特性概览

| 特性 | 类型 | 用途 |
|------|------|------|
| Actions | API | 表单处理、状态管理 |
| use hook | Hook | 读取 Promise/Context |
| Server Components | 架构 | 服务端渲染优化 |
| Asset Loading | API | 资源加载优化 |
| useDeferredValue | 增强 | 延迟更新优化 |
| Document Metadata | API | 文档头管理 |
| 性能优化 | 内部 | 并发渲染提升 |

## Actions：表单处理革命

### useActionState

```tsx
import { useActionState } from 'react';

function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const email = formData.get('email');
      const password = formData.get('password');

      try {
        await login(email, password);
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    { success: false, error: null } // 初始状态
  );

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {state.error && <div className="error">{state.error}</div>}
      <button type="submit" disabled={isPending}>
        {isPending ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
```

### useFormStatus

```tsx
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? '提交中...' : '提交'}
    </button>
  );
}
```

### useOptimistic

```tsx
import { useOptimistic } from 'react';

function TodoList({ todos, addTodo }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [
      ...state,
      { ...newTodo, id: 'temp-' + Date.now(), pending: true }
    ]
  );

  async function handleSubmit(formData) {
    const title = formData.get('title');
    addOptimisticTodo({ title }); // 立即显示
    await addTodo(title); // 后台请求
  }

  return (
    <>
      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.title}
          </li>
        ))}
      </ul>
      <form action={handleSubmit}>
        <input name="title" required />
        <SubmitButton />
      </form>
    </>
  );
}
```

## use hook：统一的异步读取

### 读取 Promise

```tsx
import { use } from 'react';

function UserProfile({ userId }) {
  const user = use(fetchUser(userId)); // 直接读取 Promise
  return <div>{user.name}</div>;
}

// 配合 Suspense
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile userId="123" />
    </Suspense>
  );
}
```

### 读取 Context

```tsx
import { use } from 'react';

const ThemeContext = createContext('light');

function ThemedButton() {
  const theme = use(ThemeContext); // 替代 useContext
  return <button className={theme}>按钮</button>;
}
```

## Server Components 增强

### 服务端函数（Server Functions）

```tsx
// app/actions.ts
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  const post = await db.post.create({ data: { title, content } });
  revalidatePath('/posts'); // 刷新缓存
  return post;
}
```

### 服务端组件中的异步处理

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await db.post.findMany(); // 直接在组件中获取数据

  return (
    <div>
      <h1>文章列表</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Asset Loading：资源加载优化

### prefetchDNS

```tsx
import { prefetchDNS } from 'react-dom';

function App() {
  prefetchDNS('https://api.example.com'); // 预解析 DNS
  return <MyApp />;
}
```

### preconnect

```tsx
import { preconnect } from 'react-dom';

function App() {
  preconnect('https://api.example.com'); // 预连接
  return <MyApp />;
}
```

### preload

```tsx
import { preload } from 'react-dom';

function App() {
  preload('https://api.example.com/data', { as: 'fetch' }); // 预加载资源
  return <MyApp />;
}
```

## Document Metadata：文档头管理

### 原生支持

```tsx
function BlogPost({ title, description }) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href="https://example.com/blog/{slug}" />
      <h1>{title}</h1>
      <p>{description}</p>
    </>
  );
}
```

不再需要 react-helmet 等第三方库！

## 性能优化

### 并发渲染增强

React 19 对并发渲染进行了大量优化：

- **更快的 hydration**
- **更好的 Suspense 处理**
- **优化的 useTransition**

```tsx
import { useTransition } from 'react';

function SearchResults({ query }) {
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);

  return (
    <div>
      {isPending && <Spinner />}
      <SearchResultsList query={deferredQuery} />
    </div>
  );
}
```

### 自动批处理增强

```tsx
// React 18: 只在事件处理中批处理
// React 19: 所有场景都批处理

function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React 19: 只触发一次 render
}
```

## 升级指南

### 从 React 18 升级

1. **安装 React 19**

```bash
npm install react@19 react-dom@19
```

2. **更新类型定义**

```bash
npm install @types/react@19 @types/react-dom@19
```

3. **检查 Breaking Changes**

- `React.FC` 类型变化
- 某些废弃 API 被移除
- 事件处理变化

### 常见问题

#### 1. use hook 只能在组件或 Hook 中使用

```tsx
// ❌ 错误
function fetchData() {
  const data = use(promise); // 不能在普通函数中使用
}

// ✅ 正确
function MyComponent() {
  const data = use(promise); // 只能在组件或 Hook 中使用
}
```

#### 2. Server Actions 需要 'use server'

```tsx
// ❌ 忘记标记
async function createPost(formData) {
  // ...
}

// ✅ 正确
'use server';
async function createPost(formData) {
  // ...
}
```

## 最佳实践

### 1. 优先使用 Actions 处理表单

```tsx
// ✅ 推荐：使用 Actions
function Form() {
  const [state, action] = useActionState(submitForm, {});
  return <form action={action}>...</form>;
}

// ❌ 不推荐：传统方式
function Form() {
  const [data, setData] = useState();
  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitForm(data);
  };
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 2. 使用 use hook 简化异步处理

```tsx
// ✅ 推荐：use + Suspense
function User({ userId }) {
  const user = use(fetchUser(userId));
  return <div>{user.name}</div>;
}

// ❌ 不推荐：useEffect + useState
function User({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  if (!user) return <Spinner />;
  return <div>{user.name}</div>;
}
```

### 3. 利用 Server Components 减少客户端 JS

```tsx
// ✅ 推荐：服务端获取数据
async function Posts() {
  const posts = await db.post.findMany(); // 服务端执行
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}

// ❌ 不推荐：客户端获取数据
function Posts() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(setPosts);
  }, []);
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

## 总结

React 19 带来了革命性的变化：

- **Actions**：简化表单处理
- **use hook**：统一异步读取
- **Server Components**：优化服务端渲染
- **Asset Loading**：提升加载性能
- **Document Metadata**：原生支持文档头

这些特性让 React 开发更加高效、性能更好。

> 小虾子 🦐：React 19 是未来，现在就开始学习吧！
