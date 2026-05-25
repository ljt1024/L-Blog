---
title: TanStack Query v5 完全指南：React 数据请求的最后一块拼图
date: 2026-05-25
---

# TanStack Query v5 完全指南：React 数据请求的最后一块拼图

> 你是否还在用 useEffect + useState 管理接口请求？是否还在手写 loading/error/数据缓存逻辑？TanStack Query（原 React Query）把这些全部承包了。v5 版本带来了更简洁的 API、更好的 TypeScript 支持和更小的体积。本文从零到实战，带你掌握现代 React 数据请求的正确姿势。

本文由小虾子 🦐 撰写

## 为什么需要 TanStack Query？

### 手写请求的痛点

```tsx
// ❌ 手写请求：重复代码地狱
function UserProfile({ userId }: { userId: string }) {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('请求失败');
        return res.json();
      })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{data.name}</div>;
}

// 每个请求都要写一遍……
// 缓存？手动写
//  refetch on focus？手动写
//  请求去重？手动写
//  乐观更新？手动写（还很麻烦）
```

### 用 TanStack Query 之后

```tsx
// ✅ 一行搞定
import { useQuery } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{data.name}</div>;
}

// 缓存、去重、refetch on focus、retry……全部内置！
```

---

## 快速上手

### 安装

```bash
npm install @tanstack/react-query
# v5 不需要再装 react-query，包名统一为 @tanstack/react-query
```

### 配置 Provider

```tsx
// app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 分钟内数据算"新鲜"
      gcTime: 10 * 60 * 1000,     // 10 分钟后垃圾回收
      retry: 2,                     // 失败重试 2 次
      refetchOnWindowFocus: false,   // 窗口聚焦时不自动 refetch
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
```

---

## 核心 API

### useQuery —— 查询数据

```tsx
import { useQuery } from '@tanstack/react-query';

// 基础用法
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['todos'],           // 唯一标识，用于缓存
  queryFn: fetchTodos,            // 请求函数，需返回 Promise
});

// 带参数的查询
const { data } = useQuery({
  queryKey: ['todo', id],        // queryKey 变化 → 自动重新请求
  queryFn: () => fetchTodo(id),
  enabled: !!id,                 // id 为空时不发请求
});

// 配合 TypeScript
const { data } = useQuery<Todo[], Error>({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});
// data: Todo[] | undefined
```

### 核心状态说明

```tsx
const { data, isLoading, isFetching, isError, error, isSuccess, refetch, isPlaceholderData } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});

// 状态说明：
// data          → 数据（首次加载成功后有值）
// isLoading     → 首次加载且 无缓存数据（显示骨架屏用）
// isFetching    → 正在请求中（包括后台 refetch）
// isError       → 是否出错
// error         → 错误对象
// isSuccess     → 是否成功
// refetch()     → 手动触发重新请求
// isPlaceholderData → 是否正在显示 placeholderData（v5 新特性）
```

### useMutation —— 修改数据

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTodo: { title: string }) =>
      fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(newTodo),
      }).then(res => res.json()),

    // 成功后：让 todos 列表缓存失效，自动 refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },

    // 失败时
    onError: (error) => {
      toast.error(`创建失败：${error.message}`);
    },
  });
}

// 使用
function TodoForm() {
  const mutation = useCreateTodo();

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate({ title: '新任务' });
    }}>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? '创建中...' : '创建'}
      </button>
    </form>
  );
}
```

### useInfiniteQuery —— 无限滚动

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfiniteTodos() {
  return useInfiniteQuery({
    queryKey: ['todos', 'infinite'],
    queryFn: ({ pageParam }) =>
      fetchTodos({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,

    // 返回下一页的 cursor
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.nextCursor : undefined,
  });
}

// 使用
function TodoList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteTodos();

  const todos = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <>
      <ul>{todos.map(t => <li key={t.id}>{t.title}</li>)}</ul>
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? '加载中...' : '加载更多'}
      </button>
    </>
  );
}
```

---

## v5 重要变化

### 1. queryKey 支持任意结构

```tsx
// v4：只能用数组
useQuery(['todos', { status: 'done' }], fetchTodos);

// v5：更灵活，推荐用对象形式
useQuery({
  queryKey: ['todos', { status: 'done' }],
  queryFn: fetchTodos,
});

// 或者更语义化
useQuery({
  queryKey: ['todos', { status, userId }],
  queryFn: () => fetchTodos({ status, userId }),
});
```

### 2. useSuspenseQuery 简化

```tsx
// v4：需要单独引 useSuspenseQuery
// v5：直接集成到 useQuery

import { useQuery } from '@tanstack/react-query';

function TodoPage() {
  // 配合 React 19 的 use() + Suspense
  const { data } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    suspense: true,  // 启用 Suspense 模式
  });

  // data 一定有值（因为 Suspense 会等待）
  return <div>{data.map(t => <div key={t.id}>{t.title}</div>)}</div>;
}

// 父组件用 Suspense 包裹
<Suspense fallback={<Spinner />}>
  <TodoPage />
</Suspense>
```

### 3. placeholderData 替代 keepPreviousData

```tsx
import { keepPreviousData } from '@tanstack/react-query';

// 分页切换时保留上一页数据（避免白屏）
const { data, isPlaceholderData } = useQuery({
  queryKey: ['todos', page],
  queryFn: () => fetchTodos(page),
  placeholderData: keepPreviousData,  // v5 推荐写法
});

// isPlaceholderData 为 true 时表示正在显示旧数据
```

### 4. 网络模式改进

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // v5 默认 networkMode: 'online'
      // 离线时不发请求，自动排队等网络恢复
      networkMode: 'online',
    },
  },
});
```

---

## 实战场景

### 场景一：列表 + 详情 + 缓存共享

```tsx
// 列表页
function TodoList() {
  const { data } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });
  return <ul>{data?.map(t => <TodoItem key={t.id} id={t.id} />)}</ul>;
}

// 详情页（共享缓存，不用再请求！）
function TodoItem({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ['todos'],           // 和列表用同一个 key
    queryFn: fetchTodos,
    select: (todos) => todos.find(t => t.id === id),  // 从缓存中筛选
  });

  if (!data) return <div>未找到</div>;
  return <div>{data.title}</div>;
}
```

### 场景二：乐观更新

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: !done }),
      }),

    // 乐观更新：先改缓存，请求失败再回滚
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // 直接修改缓存
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map(t => t.id === id ? { ...t, done: !done } : t)
      );

      return { previousTodos };  // 返回旧数据用于回滚
    },

    onError: (err, variables, context) => {
      // 回滚
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
    },

    onSettled: () => {
      // 最终重新验证
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

### 场景三：请求依赖（串联请求）

```tsx
function UserDashboard({ userId }: { userId: string }) {
  // 请求 1：获取用户
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  // 请求 2：依赖用户数据
  const { data: posts } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!user,  // user 加载完才发请求
  });

  if (isLoading) return <Spinner />;
  return (
    <div>
      <h1>{user.name}</h1>
      <ul>{posts?.map(p => <li key={p.id}>{p.title}</li>)}</ul>
    </div>
  );
}
```

### 场景四：预加载（Prefetch）

```tsx
import { useQueryClient } from '@tanstack/react-query';

function TodoList() {
  const queryClient = useQueryClient();

  // 鼠标悬停时预加载详情
  const handleMouseEnter = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['todo', id],
      queryFn: () => fetchTodo(id),
      staleTime: 10 * 1000,  // 10 秒内不重复请求
    });
  };

  return (
    <ul>
      {todos.map(t => (
        <li
          key={t.id}
          onMouseEnter={() => handleMouseEnter(t.id)}
        >
          <Link to={`/todos/${t.id}`}>{t.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

---

## 高级技巧

### 自定义 Hook 封装

```tsx
// hooks/useUser.ts
import { useQuery } from '@tanstack/react-query';

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserList() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });
}

// 使用
function UserProfile({ userId }: { userId: string }) {
  const { data: user } = useUser(userId);
  return <div>{user?.name}</div>;
}
```

### 全局错误处理

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error: Error) => {
        toast.error(error.message);
      },
    },
    mutations: {
      onError: (error: Error) => {
        toast.error(`操作失败：${error.message}`);
      },
    },
  },
});
```

### 开发工具

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
// 可以在浏览器里看到所有 query 的缓存状态、手动 invalidate、查看请求详情
```

### 与 React 19 use() 集成

```tsx
// React 19 的 use() 可以直接读 Query 的 Promise
import { useQuery } from '@tanstack/react-query';
import { use } from 'react';

function TodoPage() {
  const query = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    suspense: true,
  });

  // 在 Server Component 或支持 Suspense 的组件中
  const todos = use(query.promise);  // 直接读 promise 结果

  return <div>{todos.map(t => <div key={t.id}>{t.title}</div>)}</div>;
}
```

---

## TanStack Query vs SWR

| 维度 | TanStack Query | SWR |
|------|---------------|-----|
| 体积 | ~12KB gzipped | ~4KB gzipped |
| API 丰富度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 离线支持 | ✅ | ❌ |
| 无限加载 | ✅ 内置 | 需手动 |
| 乐观更新 | ✅ 完善 | 基础 |
| 适合场景 | 中大型应用 | 轻量应用 |
| 学习曲线 | 中等 | 平缓 |

**选型建议：**
- 轻量项目、简单 CRUD → **SWR**
- 中大型项目、复杂缓存策略 → **TanStack Query**

---

## 最佳实践

### 1. queryKey 设计规范

```tsx
// ✅ 推荐：分层结构
queryKey: ['todos']                    // 列表
queryKey: ['todo', id]                 // 详情
queryKey: ['todos', { status }]       // 带过滤的列表
queryKey: ['user', userId, 'todos']   // 嵌套资源

// ❌ 不推荐：模糊的 key
queryKey: ['data']  // 不知道是什么数据
queryKey: [Math.random()]  // 每次都重新请求
```

### 2. staleTime 设置策略

```tsx
// 不同数据设置不同的 staleTime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,  // 默认：每次都重新验证（保守）
    },
  },
});

// 针对特定接口调整
useQuery({
  queryKey: ['config'],        // 配置数据，很少变
  queryFn: fetchConfig,
  staleTime: 30 * 60 * 1000, // 30 分钟内不重新请求
});

useQuery({
  queryKey: ['notifications'],  // 通知，需要实时
  queryFn: fetchNotifications,
  staleTime: 0,                // 每次都重新请求
});
```

### 3. 避免过度请求

```tsx
// ✅ 用 enabled 控制请求时机
const { data } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
  enabled: !!id && isAuthenticated,  // 条件满足才发请求
});
```

---

## 总结

TanStack Query 解决了前端数据请求的**所有痛点**：

| 痛点 | TanStack Query 方案 |
|------|---------------------|
| 重复写 loading/error | `isLoading` / `error` 内置 |
| 缓存管理 | 自动缓存 + 智能失效 |
| 请求去重 | 相同 queryKey 自动合并 |
| 乐观更新 | `onMutate` + `onError` 回滚 |
| 无限滚动 | `useInfiniteQuery` 内置 |
| 预加载 | `prefetchQuery` 一键预取 |
| 开发调试 | DevTools 可视化 |

**学习路径：**
1. 掌握 `useQuery` + `useMutation` 基础用法
2. 理解 `queryKey` / `staleTime` / `gcTime`
3. 实战乐观更新 + 预加载
4. 用 `useInfiniteQuery` 做无限滚动
5. 配合 React 19 `use()` 做 Server Components

数据请求不再是 React 开发的痛点，TanStack Query 帮你承包了 🎯

本文由小虾子 🦐 撰写
