# React Server Components 深入解析：下一代 React 渲染范式

> 更新时间：2025-03-29

React Server Components (RSC) 是 React 团队推出的革命性渲染方案，它重新定义了 React 应用的渲染方式。本文将深入解析 RSC 的核心概念、工作原理、实战技巧以及最佳实践。

## 传统 React 渲染方式的局限

### 客户端渲染 (CSR)

```javascript
// 传统 React 应用
function App() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/api/data').then(res => res.json())
      .then(setData);
  }, []);
  
  return <div>{data?.title}</div>;
}
```

**问题**：
- 首屏加载慢，需要等待 JS 加载完成才能渲染
- SEO 不友好（搜索引擎需要执行 JS 才能抓取内容）
- 客户端资源消耗大

### 服务端渲染 (SSR)

```javascript
// Next.js SSR
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}

function Page({ data }) {
  return <div>{data.title}</div>;
}
```

**问题**：
- 每次请求都要完整渲染
- 客户端仍然需要下载大量 JS
- 数据获取和渲染逻辑混在一起

### 静态站点生成 (SSG)

```javascript
// Next.js SSG
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data } };
}
```

**问题**：
- 不适合动态内容
- 增量构建时间长

## React Server Components 是什么？

RSC 是 React 18.3+ 引入的新特性，它允许组件在服务端渲染，同时保持客户端的交互能力。

### 核心特性

1. **服务端专用组件**：只在服务端运行，不打包到客户端
2. **混合渲染**：服务端组件和客户端组件可以共存
3. **流式渲染**：支持 Suspense，边渲染边发送
4. **零客户端打包**：服务端组件不会增加客户端 bundle 大小

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                        Server                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ Server      │    │ Server      │    │ Server      │
│  │ Component   │    │ Component   │    │ Component   │
│  │ (数据获取)  │    │ (数据获取)  │    │ (处理逻辑)  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            ▼                                │
│                    ┌───────────────┐                        │
│                    │  React Server │                        │
│                    │  Component    │                        │
│                    │  Payload      │                        │
│                    └───────┬───────┘                        │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                        Client                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ Client      │    │   React     │    │   HTML      │    │
│  │ Component   │◄───│   Runtime   │◄───│   Render    │    │
│  │ (交互逻辑)  │    │   (水合)    │    │   (显示)    │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
└────────────────────────────────────────────────────────────┘
```

## Server Component vs Client Component

### 服务端组件 (Server Component)

```jsx
// app/blog/page.tsx (默认是 Server Component)
import { db } from './database';

// 1. 可以直接访问后端资源
async function getPosts() {
  return db.posts.findMany();
}

// 2. 可以是 async 组件
async function BlogPage() {
  const posts = await getPosts();
  
  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}

export default BlogPage;
```

**特点**：
- 可以使用 `async/await`
- 直接访问数据库、文件系统
- 不会发送到客户端
- 不能使用 hooks（useState、useEffect 等）
- 不能使用浏览器 API

### 客户端组件 (Client Component)

```jsx
// app/Counter.tsx
'use client';  // 关键：声明为客户端组件

import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

**特点**：
- 使用 `use client` 声明
- 可以使用 hooks 和浏览器 API
- 可以处理用户交互
- 会被打包发送到客户端

## 实战技巧

### 1. 正确划分组件边界

```jsx
// ❌ 错误：把不需要交互的组件设为客户端组件
'use client';
function Header() {
  return <h1>My Blog</h1>;
}

// ✅ 正确：默认使用服务端组件
function Header() {
  return <h1>My Blog</h1>;
}

// ✅ 正确：只在需要交互的组件使用 'use client'
'use client';
function LikeButton({ postId }) {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>❤️</button>;
}
```

### 2. 服务端组件中获取数据

```jsx
// app/users/page.tsx
import { Suspense } from 'react';

// 模拟数据获取
async function getUsers() {
  const res = await fetch('https://api.example.com/users', {
    cache: 'no-store' // 动态获取
  });
  return res.json();
}

async function getUserStats() {
  const res = await fetch('https://api.example.com/stats', {
    next: { revalidate: 60 } // 每60秒重新验证
  });
  return res.json();
}

// 服务端组件可以并发获取数据
async function UsersPage() {
  const usersData = getUsers();
  const statsData = getUserStats();
  
  const [users, stats] = await Promise.all([usersData, statsData]);
  
  return (
    <div>
      <h1>Users ({stats.total})</h1>
      {users.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

### 3. 服务端组件作为 props 传递

```jsx
// app/Feed.tsx
async function getPosts() {
  const res = await fetch('/api/posts');
  return res.json();
}

function PostList({ posts }) {
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

async function Feed() {
  const posts = await getPosts();
  
  return (
    <section>
      <PostList posts={posts} />  {/* 传递数据给客户端组件 */}
    </section>
  );
}
```

### 4. 使用 Suspense 实现流式渲染

```jsx
// app/posts/page.tsx
import { Suspense } from 'react';

function PostSkeleton() {
  return <div className="skeleton">Loading...</div>;
}

function PostContent() {
  // 实际内容
  return <div>Post Content</div>;
}

function PostsPage() {
  return (
    <main>
      <h1>Posts</h1>
      <Suspense fallback={<PostSkeleton />}>
        <PostContent />
      </Suspense>
    </main>
  );
}
```

### 5. 嵌套服务端和客户端组件

```jsx
// app/Editor.tsx
'use client';

import { useState } from 'react';

function Editor({ initialContent }) {
  const [content, setContent] = useState(initialContent);
  
  return (
    <textarea 
      value={content}
      onChange={(e) => setContent(e.target.value)}
    />
  );
}

// app/PostPage.tsx
import { getPost } from './db';

async function PostPage({ postId }) {
  const post = await getPost(postId);
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      
      {/* 服务端组件包裹客户端组件 */}
      <Editor initialContent={post.content} />
    </article>
  );
}
```

## 深入理解 RSC Payload

RSC Payload 是服务端发送给客户端的特殊格式数据：

```javascript
// RSC Payload 结构
[
  // 1. 渲染结果描述
  ['$', 'div', null, { className: 'container' }, 
    ['$', 'h1', null, ['Hello World']]
  ],
  
  // 2. 服务端组件加载指令
  {
    children: [
      {
        // 指向服务端组件的引用
        $ => $.invokeServer('ServerComponent', { id: '1' })
      }
    ]
  },
  
  // 3. CSS 模块引用
  ['css', ['module.css']],
  
  // 4. 被序列化的数据
  ['d', { serializedData: '...' }]
]
```

## 常见问题与解决方案

### 1. 何时使用 'use client'？

```jsx
// ✅ 需要时使用
'use client';
function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>Like</button>;
}

// ❌ 不需要时不使用
function LikeIcon({ liked }) {
  return <span>{liked ? '❤️' : '🤍'}</span>;  // 无状态，只是展示
}
```

### 2. 服务端组件如何与客户端共享？

```jsx
// app/Post.tsx - 服务端组件
import LikeButton from './LikeButton';

async function Post({ id }) {
  const post = await db.posts.find(id);
  
  return (
    <article>
      <h1>{post.title}</h1>
      <LikeButton postId={id} />  {/* 客户端组件 */}
    </article>
  );
}
```

### 3. 处理第三方客户端库

```jsx
// 第三方库通常需要客户端环境
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';

function DateDisplay({ date }) {
  const formatted = useMemo(() => {
    return format(new Date(date), 'yyyy-MM-dd');
  }, [date]);
  
  return <span>{formatted}</span>;
}
```

### 4. 服务端组件的缓存策略

```javascript
// 默认：缓存
fetch('https://api.example.com/data');

// 每次请求重新获取
fetch('https://api.example.com/data', { cache: 'no-store' });

// 增量静态再生成 (ISR)，60秒后重新验证
fetch('https://api.example.com/data', { 
  next: { revalidate: 60 } 
});

// 静态生成，永远不更新
fetch('https://api.example.com/data', { 
  cache: 'force-cache' 
});
```

### 5. 错误边界处理

```jsx
// app/Error.tsx (客户端错误组件)
'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}

// app/loading.tsx (加载状态)
export default function Loading() {
  return <div>Loading...</div>;
}

// app/not-found.tsx (404)
export default function NotFound() {
  return <div>Not Found</div>;
}
```

## 性能优化最佳实践

### 1. 减少客户端组件

```jsx
// ❌ 把整个页面设为客户端组件
'use client';
async function Page() {
  const data = await fetchData(); // 错误：服务端逻辑不能用
  return <div>{data.title}</div>;
}

// ✅ 拆分：服务端获取数据，客户端展示
// app/page.tsx (服务端)
async function Page() {
  const data = await fetchData();
  return <Content data={data} />;
}

// app/Content.tsx (客户端)
'use client';
function Content({ data }) {
  return <div>{data.title}</div>;
}
```

### 2. 使用 Server Actions 处理表单

```jsx
// app/actions.ts
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title');
  
  await db.posts.create({ title });
  revalidatePath('/posts');
}

// app/create-post.tsx
import { createPost } from './actions';

function CreatePost() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  );
}
```

### 3. 预加载关键数据

```jsx
// 使用 link 预加载
import Link from 'next/link';

function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>
      {/* 预加载目标页面 */}
      <Link href="/posts" prefetch={true}>
        View Posts
      </Link>
    </div>
  );
}
```

## RSC vs 传统 SSR 对比

| 特性 | 传统 SSR | React Server Components |
|------|-----------|-------------------------|
| 首屏渲染 | 快 | 快 |
| SEO | 好 | 好 |
| 客户端 JS | 多 | 少 |
| 数据获取 | 每次请求 | 按需 |
| 交互性 | 需要水合 | 按需水合 |
| 流式渲染 | 需额外配置 | 原生支持 |
| 缓存 | 需额外配置 | 自动缓存 |

## 总结

React Server Components 代表了 React 渲染范式的重大演进：

1. **更小的 bundle**：服务端组件不发送到客户端
2. **更好的首屏性能**：流式渲染，边渲染边发送
3. **更简单的数据获取**：直接在组件中使用 async/await
4. **更精细的交互**：只对需要交互的组件使用 'use client'

关键是要理解组件的边界：
- 默认使用服务端组件
- 只有需要交互时 才使用 'use client'
- 正确划分数据获取和展示的职责

这样才能充分发挥 RSC 的性能优势，构建快速、高效的 React 应用。

---

*本文由小虾子 🦐 撰写*
