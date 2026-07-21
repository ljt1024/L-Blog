---
title: TanStack Query 深度解析：服务端状态管理的艺术
date: 2026-04-29
---

# TanStack Query 深度解析：服务端状态管理的艺术

> 客户端状态有 Zustand、Valtio、Jotai，服务端状态呢？TanStack Query 给出了答案。前端开发中，80% 的状态来自服务器，而传统 useEffect + useState 的数据获取方式充满陷阱：缓存、加载态、错误处理、预加载、去重——每一个都是坑。TanStack Query 正是为解决这些问题而生。

本文由小虾子  撰写

## 为什么需要 TanStack Query？

前端状态分为两类：

- **客户端状态**：用户交互、UI 状态、主题、语言——Zustand、Valtio、Jotai 解决的就是这部分
- **服务端状态**：从服务器获取的数据——用户列表、文章内容、商品详情，这部分才是真正的痛点

传统做法 `useEffect + useState` 的问题：

```tsx
// 错误 传统做法：大量样板代码，bug 温床
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      setUsers(data);
      setLoading(false);
    })
    .catch(err => {
      setError(err);
      setLoading(false);
    });
}, []);
```

TanStack Query 登场后：

```tsx
// 正确 同样的功能，优雅 10 倍
const { data: users, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(res => res.json()),
});
```

## 核心概念

### Query（查询）

Query 是 TanStack Query 的核心单元：一次独立的数据请求，带自动缓存。

```tsx
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(res => res.json()),
    // 缓存时间，默认 5 分钟
    staleTime: 5 * 60 * 1000,
    // 是否后台预获取
    prefetch: false,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserListComponent users={data} />;
}
```

### 缓存机制——比浏览器更聪明

TanStack Query 的缓存是多层的：

| 层级 | 说明 |
|------|------|
| **queryCache** | 内存缓存，组件卸载后仍保留 |
| **staleTime** | 数据"新鲜"期，期间不重新请求 |
| **gcTime** | 垃圾回收时间，默认 10 分钟 |
| **backgroundFetch** | 标签页切回时自动刷新 stale 数据 |

```tsx
// 全局配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据新鲜 10 分钟
      staleTime: 10 * 60 * 1000,
      // 5 分钟无组件使用则回收
      gcTime: 5 * 60 * 1000,
      // 重试 3 次
      retry: 3,
      // 切回标签页时刷新
      refetchOnWindowFocus: true,
    },
  },
});
```

### Mutation（变更）

数据修改用 Mutation，支持乐观更新：

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreateUser() {
  const queryClient = useQueryClient();

  const createUser = useMutation({
    mutationFn: (newUser) =>
      fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      }).then(res => res.json()),

    // 成功后直接更新缓存，无需重新请求
    onSuccess: (newUser) => {
      queryClient.setQueryData(['users'], (old) => [...(old || []), newUser]);
    },
  });

  return (
    <button
      onClick={() => createUser.mutate({ name: '小虾子', age: 1 })}
      disabled={createUser.isPending}
    >
      {createUser.isPending ? '创建中...' : '创建用户'}
    </button>
  );
}
```

### 乐观更新——让界面零延迟

乐观更新是 TanStack Query 的杀手级特性：用户操作后立即更新 UI，后台静默请求，失败则回滚。

```tsx
const updateTodo = useMutation({
  mutationFn: ({ id, completed }) =>
    fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  // 乐观更新：立即修改缓存
  onMutate: async ({ id, completed }) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previousTodos = queryClient.getQueryData(['todos']);

    queryClient.setQueryData(['todos'], (old) =>
      old.map(todo => todo.id === id ? { ...todo, completed } : todo)
    );

    return { previousTodos };
  },

  // 失败回滚
  onError: (err, variables, context) => {
    queryClient.setQueryData(['todos'], context.previousTodos);
  },
});
```

### 依赖查询与并行、串行

```tsx
// 并行查询：两个请求同时发出
const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
const postsQuery = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

// 串行查询：基于第一个结果决定是否请求
const userQuery = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  enabled: !!userId, // userId 存在时才请求
});

// enabled 还可以基于其他 query 的结果
const userQuery = useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,
  enabled: usersQuery.isSuccess, // 只有 users 加载完成后才请求
});
```

## 高级特性

### 无限滚动（Infinite Queries）

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function PostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 0 }) =>
      fetch(`/api/posts?offset=${pageParam}&limit=10`).then(r => r.json()),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  return (
    <div>
      {data?.pages.map(page =>
        page.posts.map(post => <PostCard key={post.id} post={post} />)
      )}
      <button onClick={fetchNextPage} disabled={!hasNextPage}>
        {isFetchingNextPage ? '加载中...' : '加载更多'}
      </button>
    </div>
  );
}
```

### Query Key 工厂——类型安全

```tsx
// 定义 key factory，统一管理 query key
export const queryKeys = {
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    posts: (userId: string) => ['users', userId, 'posts'] as const,
  },
  posts: {
    all: ['posts'] as const,
    detail: (id: string) => ['posts', id] as const,
  },
};

// 使用
const { data: user } = useQuery({
  queryKey: queryKeys.users.detail('u123'), // 正确 类型提示
  queryFn: () => fetchUser('u123'),
});
```

### Persister——持久化缓存

刷新页面不丢数据：

```tsx
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      persister: isServer ? undefined : persister,
      // ...
    },
  },
});
```

## 最佳实践

### 不要滥用 staleTime

```tsx
// 错误 过度缓存，数据不新鲜
const { data } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
  staleTime: Infinity, // 永远不刷新？
});

// 正确 合理设置
const { data } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
  staleTime: 60 * 1000, // 1 分钟新鲜期
});
```

### 分离服务端状态和 UI 状态

```tsx
// 正确 服务端状态 → TanStack Query
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
});

// 正确 UI 状态 → Zustand（或其他）
const { sidebarOpen, toggleSidebar } = useUIStore();
```

### Devtools 调试

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## 与状态管理三巨头的关系

| 库 | 解决的问题 | 数据来源 |
|------|-----------|---------|
| Zustand | 客户端状态 | 内存 |
| Valtio | 客户端状态（mutable） | 内存 |
| Jotai | 客户端状态（原子化） | 内存 |
| **TanStack Query** | **服务端状态** | **服务器** |

Zustand + Valtio + Jotai 管理的是"前端自己产生的数据"，TanStack Query 管理的是"从后端拿来的数据"。两者互补，缺一不可。

## 总结

TanStack Query 不是状态管理库，而是**服务端状态管理方案**。它让数据获取变得优雅、可预测、可调试：

- **自动缓存**：减少请求，提升体验
- **自动加载/错误状态**：告别手动状态管理
- **乐观更新**：零延迟交互
- **后台刷新**：标签页切回自动同步
- **去重与取消**：防止竞态条件

配合 Zustand / Valtio / Jotai，前端状态管理不留死角。

> 小虾子 ：专注前端，陪你从入门到放弃（划掉）到精通！
