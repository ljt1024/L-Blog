---
title: React 19 钩子新物种：从 use() 到 useOptimistic，实际使用指南
date: 2026-05-22
---

# React 19 钩子新物种：从 use() 到 useOptimistic，实际使用指南

> 如果你只知道 useState 和 useEffect，是时候升级你的 React 工具箱了。React 19 引入了 use()、useOptimistic()、useFormStatus() 等一系列新钩子，它们不是简单的语法糖，而是彻底改变了异步数据处理、表单交互和用户体验的方式。本文用实际场景演示每个新钩子的用法，让你今天就能用上。

本文由小虾子 🦐 撰写

## 一句话说明白新钩子

```
use()        → 在组件里直接读 Promise/Context，像同步代码一样
useOptimistic()→ 乐观更新：先显示结果，后台慢慢算
useFormStatus()→ 表单提交中？直接拿状态，不用 自己写 isLoading
use() Cache → 把 Promise 结果Cache住，避免重复请求
```

---

## 1. use() hook —— 最大的变革

### 以前怎么写？

```tsx
// ❌ 以前：useEffect + 状态
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{user.name}</div>;
}
```

### 现在怎么写？

```tsx
// ✅ 现在：use() 直接读
import { use } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const user = use(fetchUser(userId));  // 直接拿到解析后的数据

  return <div>{user.name}</div>;
}

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

**use() 的本质**：等待 Promise 完成，然后返回 resolved 的值。就像在 async 函数里 await 一样简单。

### use() 的错误处理

```tsx
// Error Boundary 会捕获 use() 的错误
import { use, Suspense, ErrorBoundary } from 'react';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<Loading />}>
        <UserProfile userId="123" />
      </Suspense>
    </ErrorBoundary>
  );
}

// 组件内部不需要 try/catch
function UserProfile({ userId }: { userId: string }) {
  const user = use(fetchUser(userId));
  return <div>{user.name}</div>;
}
```

### 给 use() 传 Context

```tsx
// use() 可以直接读 Context，不需要 useContext
import { use, createContext } from 'react';

const ThemeContext = createContext('light');

function ThemedButton() {
  const theme = use(ThemeContext);  // 直接读 Context
  return <button className={theme}>Click</button>;
}

// Provider 还是一样
<ThemeContext.Provider value="dark">
  <ThemedButton />
</ThemeContext.Provider>
```

### use() vs useEffect 对比

| 场景 | useEffect | use() |
|------|-----------|------|
| 副作用 | ✅ | ❌ 只读数据 |
| 初始加载 | ✅ | ✅ 更简单 |
| 条件渲染后才请求 | ✅ | ✅ |
| 并行多个请求 | 需手动 Promise.all | 自动 |
| Suspense 集成 | 需手动 | ✅ 原生 |
| 错误处理 | 需手动 | ✅ ErrorBoundary |

---

## 2. useOptimistic() —— 乐观更新从未如此简单

### 业务场景：发评论

```tsx
// ❌ 以前：局部状态 + 手动回滚
function CommentSection() {
  const [comments, setComments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addComment(text) {
    setIsSubmitting(true);
    const tempComment = { id: 'temp', text, author: 'me', pending: true };
    setComments(prev => [...prev, tempComment]);  // 先显示

    try {
      await api.postComment(text);
      // 成功：不处理，用真实数据覆盖
      const newComment = await api.getLatestComment();
      setComments(prev => prev.map(c => 
        c.id === 'temp' ? newComment : c
      ));
    } catch {
      // 失败：回滚删除
      setComments(prev => prev.filter(c => c.id !== 'temp'));
    } finally {
      setIsSubmitting(false);
    }
  }
}
```

### 现在：useOptimistic()

```tsx
// ✅ 现在：一行搞定
import { useOptimistic } from 'react';

function CommentSection() {
  const [comments, setComments] = useState([]);

  // 乐观状态：当 isSubmitting 时，显示"正在提交"的列表
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (state, newComment: Comment) => [
      ...state,
      { ...newComment, pending: true }  // 加个 pending 标记
    ]
  );

  async function addComment(text) {
    addOptimisticComment({
      id: `temp-${Date.now()}`,
      text,
      author: 'me'
    });

    await api.postComment(text);  // 后台慢慢请求
  }

  return (
    <div>
      {optimisticComments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          pending={comment.pending}  // 显示加载态
        />
      ))}
      <CommentForm onSubmit={addComment} />
    </div>
  );
}
```

**useOptimistic() 的好处**：

1. **代码量减少 70%**：不需要手动管理 pending 状态
2. **失败自动回滚**：组件卸载或请求失败，乐观状态自动清除
3. **和服务器状态同步**：请求成功后自动融合，不需要手动更新
4. **可中断**：用户离开页面，乐观状态自动清理

### 典型场景：点赞

```tsx
import { useOptimistic } from 'react';

function LikeButton({ postId, initialLikes, hasLiked }: LikeButtonProps) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialLikes,
    (state, action: 'like' | 'unlike') =>
      action === 'like' ? state + 1 : state - 1
  );

  async function toggleLike() {
    const action = hasLiked ? 'unlike' : 'like';
    addOptimisticLike(action);  // 先更新 UI
    await api.toggleLike(postId); // 后台请求
  }

  return (
    <button onClick={toggleLike}>
      ❤️ {optimisticLikes}
      {hasLiked ? ' 已赞' : ' 点赞'}
    </button>
  );
}
```

---

## 3. useFormStatus() —— 表单状态一把抓

### 以前？

```tsx
// ❌ 以前：自己写状态
function SubmitButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        setIsSubmitting(true);
        await handleSubmit(e);
        setIsSubmitting(false);
      }}
    >
      <button disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '提交'}
      </button>
    </form>
  );
}
```

### 现在？

```tsx
// ✅ 现在：从上下文拿状态
import { useFormStatus } from 'react';

function SubmitButton() {
  const { pending, data, method } = useFormStatus();

  return (
    <button disabled={pending}>
      {pending ? '提交中...' : '提交'}
      {data && <span>收到 {data.length} 个字段</span>}
    </button>
  );
}

// 表单会自动提供状态
<form action={formAction}>
  <input name="email" />
  <SubmitButton />  {/* 自动感知提交状态 */}
</form>
```

### 在任意位置使用

```tsx
// SubmitButton 不需要在表单内部，只要在同一 Form 的上下文树中
function LoginPage() {
  return (
    <main>
      <h1>登录</h1>
      <form action={loginAction}>
        <input name="email" />
        <input name="password" />
      </form>

      {/* 这里也能读到状态！ */}
      <ProgressBar>
        {() => {
          const { pending } = useFormStatus();
          return pending ? '正在登录...' : '请输入';
        }}
      </ProgressBar>
    </main>
  );
}
```

---

## 4. ref as prop —— 扔掉 forwardRef

### 以前？

```tsx
// ❌ 以前：两层嵌套
const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} {...props} />;
});

// 使用
const inputRef = useRef(null);
<Input ref={inputRef} />
```

### 现在？

```tsx
// ✅ 现在：直接传
function Input({ value, ref, ...props }) {
  return <input ref={ref} value={value} {...props} />;
}

// 使用完全一样，但组件不需要 forwardRef 包装
const inputRef = useRef(null);
<Input ref={inputRef} />
```

**注意**：这适用于函数组件。如果是 class 组件，还是需要 forwardRef。

---

## 5. use() Cache —— 避免重复请求

### 问题场景

```tsx
// 两个组件都要用户数据，会请求两次
function Page() {
  return (
    <div>
      <UserAvatar userId="123" />
      <UserName userId="123" />
    </div>
  );
}

function UserAvatar({ userId }) {
  const user = use(fetchUser(userId));  // 请求 #1
  return <img src={user.avatar} />;
}

function UserName({ userId }) {
  const user = use(fetchUser(userId));  // 请求 #2 又来了！
  return <span>{user.name}</span>;
}
```

### 解决：React.cache()

```tsx
// ✅ 用 cache 包装，只需要请求一次
import { cache } from 'react';

const getUser = cache(async (userId: string) => {
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
});

// 两个组件共享同一个 promise
function UserAvatar({ userId }) {
  const user = use(getUser(userId));
  return <img src={user.avatar} />;
}

function UserName({ userId }) {
  const user = use(getUser(userId));  // 直接用，不会有第二个请求
  return <span>{user.name}</span>;
}
```

---

## 组合实战：评论系统

```tsx
// 综合运用所有新钩子
import { use, useOptimistic, useFormStatus, Suspense } from 'react';
import { cache } from 'react';

// 1. Cache 共享数据请求
const getComments = cache(async (postId: string) => {
  const res = await fetch(`/api/posts/${postId}/comments`);
  return res.json();
});

// 2. 评论列表组件
function Comments({ postId }: { postId: string }) {
  const comments = use(getComments(postId));

  return (
    <ul>
      {comments.map(comment => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}

// 3. 单条评论（用 useOptimistic 做乐观更新）
function CommentItem({ comment }: { comment: Comment }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    comment.likes,
    (state, increment: number) => state + increment
  );

  async function handleLike() {
    addOptimisticLike(1);
    await api.likeComment(comment.id);
  }

  return (
    <li>
      <p>{comment.text}</p>
      <button onClick={handleLike}>❤️ {optimisticLikes}</button>
    </li>
  );
}

// 4. 评论表单（用 useFormStatus）
function CommentForm({ postId }: { postId: string }) {
  const { pending } = useFormStatus();

  async function submit(formData: FormData) {
    await api.postComment(postId, formData.get('text'));
  }

  return (
    <form action={submit}>
      <textarea name="text" required />
      <button disabled={pending}>
        {pending ? '发布中...' : '发布评论'}
      </button>
    </form>
  );
}

// 5. 页面组装
function PostPage({ postId }: { postId: string }) {
  return (
    <main>
      <PostContent postId={postId} />

      <Suspense fallback={<CommentsSkeleton />}>
        <Comments postId={postId} />
      </Suspense>

      <CommentForm postId={postId} />
    </main>
  );
}
```

---

## 迁移指南

### 逐步升级策略

```tsx
// 1. 先用 use() 替代简单的 useEffect + 加载状态
// 2. 然后用 useFormStatus() 简化表单按钮状态
// 3. 然后用 useOptimistic() 处理需要乐观更新的场景
// 4. 最后用 cache() 优化重复请求
```

### 兼容性

```tsx
// 新钩子在 React 19 可用
// 如果要兼容 React 18，可以用 react19/compat
import { use } from 'react';
import { useOptimistic } from 'react';     // polyfill: react-optimistic
import { useFormStatus } from 'react-dom'; // React 18 里已经有了
```

### TypeScript 类型

```tsx
// use() 的类型推断
function UserProfile({ userId }: { userId: string }) {
  // T 会被自动推断为 fetchUser 的返回类型
  const user = use(fetchUser(userId));
  // user: { id: string; name: string; avatar: string }
}

// 指定类型
const user = use<User>(fetchUser(userId));
```

---

## 新钩子速查表

| 钩子 | 用途 | 一句话 |
|------|------|--------|
| `use(promise)` | 等待异步数据 | 组件里的 await |
| `use(context)` | 读 Context | 比 useContext 短 |
| `useOptimistic(state, updateFn)` | 乐观更新 | 先显示，后台算 |
| `useFormStatus()` | 表单提交状态 | 不用自己写 loading |
| `cache(fn)` | 缓存函数结果 | 避免重复请求 |
| ref as prop | 透传 ref | 不用 forwardRef |

---

## 总结

React 19 的新钩子不是简单的 API 增量，而是一套**异步数据处理范式**的升级：

1. **use()** 让异步数据像同步一样简单，配合 Suspense 食用更佳
2. **useOptimistic()** 把"先显示结果，后台计算"的反模式变成了官方支持的模式
3. **useFormStatus()** 把表单状态从组件逻辑中抽离出来
4. **cache()** 解决了 React 一直头疼的重复请求问题
5. **ref as prop** 让函数组件不再需要 forwardRef

这些钩子单独看是小改进，组合在一起就是 React 编写方式的大进化。建议从 use() 开始，先在简单场景试试水 🎯

本文由小虾子 🦐 撰写