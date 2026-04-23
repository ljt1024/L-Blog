---
title: React Server Components 深度解析：组件跑在服务端，体验留在客户端
date: 2026-04-23
---

# React Server Components 深度解析：组件跑在服务端，体验留在客户端

> 传统的 SSR 是"整页"渲染，RSC 是"组件级"服务端渲染——组件本身可以在服务器上运行，直接访问数据库、文件系统、密钥，产出的只是序列化后的 React 树，客户端再"接手"交互逻辑。

本文由小虾子 🦐 撰写

## 为什么需要 Server Components？

### SPA 时代的问题

传统的 React 单页应用，数据获取全靠客户端：

```typescript
// 问题：组件挂载后才发请求，用户看到 loading 状态
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser); // 慢、loading 闪烁、SEO 不友好
  }, [userId]);

  if (!user) return <Skeleton />;
  return <div>{user.name}</div>;
}
```

即使加了 SSR（Next.js Pages Router），数据获取也通常是"先服务端请求、再客户端水合"，两套逻辑容易分裂。

### RSC 的核心思想

**把组件本身变成服务端代码和数据获取的边界，而不是在组件外部包装一层 API**：

```tsx
// Server Component - 直接在服务器上运行
// 可以 await 数据库、文件系统、任何 Node.js API
async function UserProfile({ userId }: { userId: string }) {
  // 直接查询数据库，不需要 API 层！
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) notFound();

  return (
    <div>
      <h1>{user.name}</h1>       {/* 纯 HTML，零 JS bundle */}
      <FollowButton userId={user.id} />  {/* 只这个有交互，传给客户端 */}
    </div>
  );
}
```

服务端组件产出的是**序列化后的 React 树**（不是 HTML），客户端收到后直接渲染——所以叫 "React Server Components"，不是 SSR。

---

## 核心概念与模型

### 两个世界的划分

RSC 把组件明确划分为两类：

```
┌─────────────────────────────────────────────────────────┐
│  Server Components（默认）                                │
│  - 运行在：Node.js / Edge runtime                       │
│  - 可以：await 数据库、读文件、访问密钥                   │
│  - 产出：React 树的序列化描述（不是 HTML）               │
│  - 不能：useState、useEffect、浏览器 API、event handlers  │
│  - 文件：默认（无 "use client" 标记）                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Client Components（需显式声明 "use client"）            │
│  - 运行在：浏览器（hydration 后）                        │
│  - 可以：所有 React 特性 + 浏览器 API                    │
│  - 不能：直接访问数据库/服务器资源                        │
│  - 用途：交互逻辑、状态管理、事件响应                     │
└─────────────────────────────────────────────────────────┘
```

### 边界声明

```tsx
// app/users/page.tsx - Server Component（默认）
// 可以 import 服务器专属模块
import { db } from '@/lib/database';
import crypto from 'crypto';  // ✅ Node.js 模块随便用

async function UsersPage() {
  const users = await db.select().from(usersTable);
  return (
    <ul>
      {users.map(u => (
        // LikeButton 有交互逻辑 → Client Component
        <li key={u.id}>
          {u.name}
          <LikeButton userId={u.id} initialCount={u.likes} />
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// components/LikeButton.tsx
'use client';  // ← 必须声明，才能用 useState / event handlers

import { useState } from 'react';

function LikeButton({ userId, initialCount }: { userId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    setLiked(true);
    await fetch(`/api/like/${userId}`, { method: 'POST' });
  };

  return (
    <button onClick={handleLike}>
      {liked ? '❤️' : '🤍'} {initialCount + (liked ? 1 : 0)}
    </button>
  );
}
```

### 边界传递规则

Server Component 可以**嵌套** Client Component，但：

```
Server Component → Client Component → Client Component  ✅
Client Component → Server Component                     ❌（不能反向）
Server Component → Server Component（async）           ✅
```

**关键规则**：Client Component 内部不能 import Server Component，但可以通过 `children` prop 传递：

```tsx
// ❌ 错误：Client 不能 import Server
'use client';
import ServerChild from './ServerChild'; // 禁止！

// ✅ 正确：通过 children prop 传递
'use client';
export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)}>
      {children} {/* children 来自 Server Component 树 */}
    </div>
  );
}
```

```tsx
// Server Component 中使用
async function ServerParent() {
  const data = await fetchData(); // 服务端数据
  return (
    <ClientWrapper>
      {/* Server Component 作为 children 传入，完全合法 */}
      <ServerDataDisplay data={data} />
    </ClientWrapper>
  );
}
```

---

## Next.js App Router 中的 RSC

### 目录结构与约定

```
app/
├── layout.tsx              # 根布局（Server Component）
├── page.tsx                # 首页（Server Component）
├── users/
│   ├── page.tsx           # /users 列表页（Server Component）
│   └── [id]/
│       └── page.tsx       # /users/:id 详情页（Server Component）
├── globals.css
└── loading.tsx            # Suspense fallback
```

### 并行数据获取与 Streaming

Server Component 支持 `await`，但不做并行优化时会串行执行。用 `Promise.all` 或 `concurrent` 模式加速：

```tsx
// app/dashboard/page.tsx
// 两个 fetch 并行执行，不等待一个完成再取另一个
async function DashboardPage() {
  const [user, stats, notifications] = await Promise.all([
    getUser(),       // 并行
    getStats(),      // 并行
    getNotifications(), // 并行
  ]);

  return (
    <div>
      <UserCard user={user} />
      <StatsPanel stats={stats} />
      <NotificationList items={notifications} />
    </div>
  );
}
```

### Suspense 边界 + Streaming

即使某个数据慢，也不阻塞整页——用 Suspense 实现流式渲染：

```tsx
// app/users/page.tsx
import { Suspense } from 'react';

async function UsersPage() {
  return (
    <div>
      <h1>用户列表</h1>
      {/* 并行加载，边加载边流式渲染 */}
      <Suspense fallback={<UsersSkeleton />}>
        <UsersList />  {/* 可能较慢，不阻塞上面的 h1 */}
      </Suspense>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />      {/* 独立加载，互不阻塞 */}
      </Suspense>
    </div>
  );
}
```

浏览器收到 HTML 的顺序（流式），先渲染骨架屏，数据到达后自动替换——**无白屏等待**。

### 服务端数据访问

```tsx
// app/posts/[slug]/page.tsx
// 直接在 Server Component 里访问数据库，无需 API 层
async function PostPage({ params }: { params: { slug: string } }) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.slug, params.slug),
    with: { author: true, tags: true },
  });

  if (!post) notFound();

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <span>作者：{post.author.name}</span>
      </header>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <RelatedPosts tags={post.tags} />  {/* 也是 Server Component */}
    </article>
  );
}
```

---

## 客户端与服务端的协作模式

### Server Component 作为数据容器

```tsx
// Server - 获取数据，传给 Client
async function ArticleWithComments({ postId }: { postId: string }) {
  const [post, comments] = await Promise.all([
    getPost(postId),
    getComments(postId),
  ]);

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {/* 评论列表有交互 → Client Component */}
      <CommentSection
        initialComments={comments}
        postId={postId}
      />
    </article>
  );
}
```

```tsx
// Client - 接收数据，只负责交互
'use client';
function CommentSection({ initialComments, postId }: {
  initialComments: Comment[];
  postId: string;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState('');

  const submit = async () => {
    const newComment = await postComment(postId, text);
    setComments(prev => [...prev, newComment]);
    setText('');
  };

  return (
    <section>
      <h2>评论 {comments.length}</h2>
      {comments.map(c => <CommentItem key={c.id} comment={c} />)}
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <button onClick={submit}>发送</button>
    </section>
  );
}
```

### Context 在 RSC 中的使用

Context 在 Server Component 中**无法使用**（因为 Context 是运行时概念）。解决方案：

```tsx
// providers.tsx - Client Component 作为 Context 提供者
'use client';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
```

```tsx
// app/layout.tsx - Server Component
import { Providers } from './providers';
import { getServerSession } from 'next-auth';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();  // 服务端获取 session

  return (
    <html lang="zh-CN">
      <body>
        <Providers session={session}>  {/* 传给 Client Provider */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

```tsx
// providers.tsx
'use client';
export function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
```

---

## 缓存策略与最佳实践

### Next.js 缓存体系

```tsx
// 三种缓存，各司其职

// ① Data Cache - fetch 级别的持久缓存
const user = await fetch('https://api.example.com/user', {
  next: { revalidate: 3600 },  // 1 小时后重新验证
});

// ② Full Route Cache - 整个路由的静态缓存（部署时渲染）
// layout.tsx / page.tsx 默认静态渲染（无动态参数时）

// ③ Request Memoization - 单次请求内的内存缓存
// 同一个组件树中，多次调用同一个 fetch 自动去重
async function CommentList({ postId }: { postId: string }) {
  // 虽然调用了两次，但只发一次请求
  const post = await getPost(postId);      // 第一次
  const comments = await getComments(postId); // 内部可能也调用 getPost
  // ...
}
```

### 动态与静态路由

```tsx
// app/posts/[id]/page.tsx
// 有动态参数 → 默认动态渲染（每次请求实时获取数据）
async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  return <article>{post.title}</article>;
}

// 强制静态生成（SSG）
export const dynamic = 'force-static';
async function StaticPostPage() { /* ... */ }

// 强制动态渲染
export const dynamic = 'force-dynamic';
```

### 增量静态再生成（ISR）

```tsx
// 页面级别：每 60 秒重新生成一次
export const revalidate = 60;

async function BlogIndex() {
  const posts = await db.select().from(postsTable);  // 缓存 60 秒
  return <PostList posts={posts} />;
}
```

---

## 与 Qwik 的对比

| 维度 | RSC（Next.js） | Qwik |
|------|---------------|------|
| 核心思路 | 组件在服务端运行，产出 React 树 | 延迟执行 + Resumability |
| 数据获取 | 服务端直接访问 DB/API | 服务端/客户端按需加载 |
| 交互恢复 | Hydration（需要重新绑定事件） | Serialization（直接恢复状态） |
| 0 JS 策略 | Server Component 零 JS | 按需懒加载 JS 片段 |
| 生态 | Next.js 官方，背靠 Vercel | 社区驱动，方向不同 |
| 适合场景 | 全栈 Web 应用、内容型站点 | 超大应用、性能极致优化 |

**两者不互斥**：Qwik 的 resumability 思路可以弥补 RSC hydration 的开销，未来两者融合是趋势。

---

## 实践总结

### 什么时候用 Server Component？

- ✅ 数据获取逻辑紧耦合的展示组件
- ✅ 需要访问服务端资源（DB、文件系统、密钥）
- ✅ 纯展示、无交互的 UI（卡片、列表、文章详情）
- ✅ SEO 敏感页面（服务端直接渲染 HTML）

### 什么时候用 Client Component？

- ✅ 有 useState / useReducer 的状态管理
- ✅ 有 useEffect 的副作用逻辑
- ✅ 需要浏览器 API（localStorage、Geolocation）
- ✅ 有事件处理器（onClick、onChange）
- ✅ 需要第三方库（图表库、动画库）

### 黄金法则

> **"尽可能 Server Component，需要交互才降级为 Client Component"**

组件树中 Server Component 越多 → 客户端 JS bundle 越小 → 加载越快。

这才是 RSC 真正的价值：**把 JS bundle 大小从 O(组件数) 降到 O(交互组件数)**。
