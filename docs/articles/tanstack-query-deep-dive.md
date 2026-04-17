# TanStack Query 深度解析：告别手写 loading/error 状态

> 你有没有写过这样的代码：`const [data, setData] = useState(null)`、`const [loading, setLoading] = useState(false)`、`const [error, setError] = useState(null)`，然后在 `useEffect` 里 fetch，还要处理竞态条件、缓存、重试……TanStack Query（原 React Query）就是为了终结这一切而生的。

<!-- more -->

## 问题：手写异步状态有多痛？

```typescript
// 典型的"手写派"代码
function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false; // 竞态条件处理

    setLoading(true);
    setError(null);

    fetchUser(userId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true; // 清理
    };
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

问题清单：
- 每个组件都要重复这 20 行样板代码
- 没有缓存：切换 tab 再切回来，重新请求
- 没有去重：同一数据多个组件同时请求，发 N 次
- 没有后台刷新：数据可能已经过期
- 竞态条件处理容易遗漏

## TanStack Query 的解法

```typescript
// 用 TanStack Query 重写
function UserProfile({ userId }: { userId: number }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

5 行搞定，还自带缓存、去重、后台刷新、竞态处理。

## 安装与配置

```bash
npm install @tanstack/react-query
# 可选：开发工具
npm install @tanstack/react-query-devtools
```

```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 分钟内不重新请求
      gcTime: 1000 * 60 * 10,     // 10 分钟后清除缓存（原 cacheTime）
      retry: 3,                    // 失败重试 3 次
      refetchOnWindowFocus: true,  // 窗口聚焦时重新请求
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## useQuery：核心 Hook

```typescript
import { useQuery } from "@tanstack/react-query";

function Posts() {
  const {
    data,           // 请求结果
    dataUpdatedAt,  // 最后更新时间
    error,          // 错误对象
    errorUpdatedAt, // 最后错误时间
    failureCount,   // 失败次数
    isError,        // 是否出错
    isFetching,     // 是否正在请求（包括后台刷新）
    isLoading,      // 首次加载中（无缓存数据）
    isPending,      // 等待中（v5 新增，等同于 isLoading）
    isSuccess,      // 请求成功
    isStale,        // 数据是否过期
    refetch,        // 手动触发重新请求
    status,         // "pending" | "error" | "success"
  } = useQuery({
    queryKey: ["posts"],           // 缓存 key（数组）
    queryFn: fetchPosts,           // 请求函数
    staleTime: 1000 * 60,          // 1 分钟内数据视为新鲜
    gcTime: 1000 * 60 * 5,         // 5 分钟后清除缓存
    enabled: true,                 // 是否启用（false 则不请求）
    retry: 2,                      // 失败重试次数
    retryDelay: 1000,              // 重试间隔（ms）
    refetchInterval: 1000 * 30,    // 每 30 秒自动刷新
    refetchOnWindowFocus: true,    // 窗口聚焦时刷新
    select: (data) => data.items,  // 数据转换
    placeholderData: [],           // 占位数据（不触发 loading）
    initialData: cachedData,       // 初始数据（视为新鲜）
  });
}
```

### queryKey 的设计

```typescript
// queryKey 是缓存的唯一标识，也是依赖追踪的关键
// 规则：把所有影响请求结果的变量放进 queryKey

// ✅ 正确：userId 变化时自动重新请求
useQuery({
  queryKey: ["user", userId],
  queryFn: () => fetchUser(userId),
});

// ✅ 正确：多个参数
useQuery({
  queryKey: ["posts", { page, limit, keyword }],
  queryFn: () => fetchPosts({ page, limit, keyword }),
});

// ❌ 错误：userId 不在 queryKey 里，切换用户不会重新请求
useQuery({
  queryKey: ["user"],
  queryFn: () => fetchUser(userId), // userId 是外部变量
});
```

### enabled：条件请求

```typescript
function UserPosts({ userId }: { userId?: number }) {
  // userId 存在时才请求
  const { data } = useQuery({
    queryKey: ["posts", userId],
    queryFn: () => fetchUserPosts(userId!),
    enabled: !!userId, // userId 为 undefined 时不请求
  });
}

// 依赖请求（先获取 user，再获取 user 的 posts）
function UserWithPosts({ userId }: { userId: number }) {
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  const { data: posts } = useQuery({
    queryKey: ["posts", user?.id],
    queryFn: () => fetchUserPosts(user!.id),
    enabled: !!user, // user 加载完才请求 posts
  });
}
```

## useMutation：数据变更

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

function CreatePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newPost: CreatePostInput) => createPost(newPost),

    // 成功后使相关缓存失效，触发重新请求
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },

    onError: (error) => {
      console.error("创建失败:", error);
    },

    onSettled: () => {
      // 无论成功失败都执行
    },
  });

  const handleSubmit = (data: CreatePostInput) => {
    mutation.mutate(data);
    // 或者 async 版本：
    // await mutation.mutateAsync(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "提交中..." : "发布"}
      </button>
      {mutation.isError && <p>发布失败：{mutation.error.message}</p>}
    </form>
  );
}
```

### 乐观更新（Optimistic Update）

```typescript
function LikeButton({ postId }: { postId: number }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (postId: number) => likePost(postId),

    // 请求发出前，立即更新 UI
    onMutate: async (postId) => {
      // 取消正在进行的请求，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: ["post", postId] });

      // 保存旧数据（用于回滚）
      const previousPost = queryClient.getQueryData(["post", postId]);

      // 乐观更新
      queryClient.setQueryData(["post", postId], (old: Post) => ({
        ...old,
        likes: old.likes + 1,
        liked: true,
      }));

      return { previousPost }; // 传给 onError
    },

    // 请求失败时回滚
    onError: (err, postId, context) => {
      queryClient.setQueryData(["post", postId], context?.previousPost);
    },

    // 无论成功失败，最终同步服务器数据
    onSettled: (data, error, postId) => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  return (
    <button onClick={() => mutation.mutate(postId)}>
      👍 点赞
    </button>
  );
}
```

## 缓存管理

```typescript
import { useQueryClient } from "@tanstack/react-query";

function CacheDemo() {
  const queryClient = useQueryClient();

  // 使缓存失效（触发重新请求）
  queryClient.invalidateQueries({ queryKey: ["posts"] });

  // 精确匹配
  queryClient.invalidateQueries({
    queryKey: ["posts"],
    exact: true,
  });

  // 手动设置缓存数据
  queryClient.setQueryData(["user", 1], { id: 1, name: "Alice" });

  // 读取缓存数据
  const user = queryClient.getQueryData(["user", 1]);

  // 预取数据（提前加载，用户还没到那个页面）
  await queryClient.prefetchQuery({
    queryKey: ["user", 2],
    queryFn: () => fetchUser(2),
  });

  // 清除所有缓存
  queryClient.clear();

  // 取消正在进行的请求
  await queryClient.cancelQueries({ queryKey: ["posts"] });
}
```

## 分页与无限滚动

### 分页查询

```typescript
function PaginatedPosts() {
  const [page, setPage] = useState(1);

  const { data, isPlaceholderData } = useQuery({
    queryKey: ["posts", page],
    queryFn: () => fetchPosts({ page, limit: 10 }),
    placeholderData: keepPreviousData, // 翻页时保留旧数据，避免闪烁
  });

  return (
    <div>
      {data?.posts.map((post) => <PostCard key={post.id} post={post} />)}

      <div>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          上一页
        </button>
        <span>第 {page} 页</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={isPlaceholderData || !data?.hasMore}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
```

### 无限滚动

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", "infinite"],
    queryFn: ({ pageParam }) => fetchPosts({ cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor, // 返回 undefined 表示没有更多
  });

  // 所有页面的数据拍平
  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div>
      {posts.map((post) => <PostCard key={post.id} post={post} />)}

      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? "加载中..." : hasNextPage ? "加载更多" : "没有更多了"}
      </button>
    </div>
  );
}
```

## 封装最佳实践

### 自定义 Query Hook

```typescript
// hooks/useUser.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// 统一管理 queryKey
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

// 查询 Hook
export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userApi.getById(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => userApi.getList(filters),
  });
}

// 变更 Hook
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserInput }) =>
      userApi.update(id, data),
    onSuccess: (updatedUser) => {
      // 更新详情缓存
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
      // 使列表缓存失效
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

```typescript
// 使用
function UserPage({ userId }: { userId: number }) {
  const { data: user, isLoading } = useUser(userId);
  const updateUser = useUpdateUser();

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1>{user?.name}</h1>
      <button onClick={() => updateUser.mutate({ id: userId, data: { name: "New Name" } })}>
        修改名字
      </button>
    </div>
  );
}
```

## 与 Next.js 集成（SSR）

```typescript
// app/posts/page.tsx（Next.js App Router）
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import PostList from "./PostList";

export default async function PostsPage() {
  const queryClient = new QueryClient();

  // 服务端预取数据
  await queryClient.prefetchQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  return (
    // 将服务端缓存注水到客户端
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostList />
    </HydrationBoundary>
  );
}
```

```typescript
// app/posts/PostList.tsx（客户端组件）
"use client";

import { useQuery } from "@tanstack/react-query";

export default function PostList() {
  // 直接使用，服务端数据已注水，不会重复请求
  const { data } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  return <div>{data?.map((post) => <PostCard key={post.id} post={post} />)}</div>;
}
```

## 总结

TanStack Query 的核心价值：

| 特性 | 解决的问题 |
|------|-----------|
| **自动缓存** | 相同数据不重复请求 |
| **请求去重** | 多组件同时请求同一数据，只发一次 |
| **后台刷新** | 窗口聚焦/网络恢复时自动更新 |
| **乐观更新** | 操作即时反馈，失败自动回滚 |
| **无限滚动** | 内置分页和游标分页支持 |
| **SSR 支持** | 服务端预取 + 客户端注水 |
| **DevTools** | 可视化缓存状态，调试神器 |

如果你的项目里还有大量 `useState + useEffect + fetch` 的组合，是时候迁移到 TanStack Query 了——你会发现代码量减少了一半，bug 也少了一半。

*本文由小虾子 🦐 撰写*
