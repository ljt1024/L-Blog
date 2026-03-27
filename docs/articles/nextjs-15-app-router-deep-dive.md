# Next.js 15 App Router 深度解析：从入门到实战

> 发布时间：2026-03-27

Next.js 15 带来了 App Router 的全面成熟化，这是 React 服务端渲染的全新范式。本文从核心概念到实战用法，系统讲解 App Router 的设计思想与最佳实践。

## Pages Router vs App Router

Next.js 14/15 存在两套路由系统并行：

| 特性 | Pages Router | App Router |
|------|------------|-----------|
| React 版本 | React 18 | React 18+ / React 19 |
| 服务端渲染 | 页面级 SSR | 组件级 RSC |
| 布局系统 | `layout.tsx` | 嵌套布局，共享状态 |
| 流式渲染 | 不支持 | 原生支持 |
| 数据获取 | `getServerSideProps` | async/await 直接写 |
| 路由组 | 不支持 | `()` 路由组 |
| 中间件 | 独立文件 | 独立文件 |

> **推荐新项目全部使用 App Router**，Pages Router 会逐步被淘汰。

---

## 目录即路由

App Router 的核心理念：**目录结构 = 路由结构**。

```
app/
├── layout.tsx          # 根布局（所有页面共享）
├── page.tsx             # 路由 /
├── page.module.css      # 页面样式
├── loading.tsx          # 加载状态（流式）
├── error.tsx           # 错误边界
├── not-found.tsx       # 404 页面
├── globals.css         # 全局样式
├── blog/
│   ├── page.tsx         # 路由 /blog
│   ├── loading.tsx      # /blog 的加载状态
│   └── [slug]/
│       └── page.tsx     # 路由 /blog/:slug（动态路由）
└── api/
    └── user/
        └── route.ts     # API 路由 /api/user
```

---

## 核心概念一：React Server Components

App Router 的革命性变化是默认所有组件都是 **React Server Components（RSC）**。

### 服务端组件 vs 客户端组件

```tsx
// app/page.tsx —— 默认是服务端组件
// 可以：直接访问数据库、文件系统、API 密钥
// 不能：使用 useState、useEffect、浏览器 API

import { db } from './lib/db'

export default async function HomePage() {
  // 直接 await 数据库查询，无需 API 路由
  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <main>
      <h1>最新文章</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </main>
  )
}
```

```tsx
// app/counter.tsx —— 需要交互？用 'use client'
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(c => c + 1)}>
      点击次数：{count}
    </button>
  )
}
```

```tsx
// app/page.tsx —— 服务端组件中嵌入客户端组件
import { Counter } from './counter'

export default async function HomePage() {
  const data = await fetchData() // 服务端获取数据

  return (
    <div>
      <h1>{data.title}</h1>
      {/* 客户端组件：可以响应用户交互 */}
      <Counter />
    </div>
  )
}
```

**关键规则**：
- 服务端组件不能导入客户端组件（反过来可以）
- 服务端组件的 props 必须可序列化
- 敏感操作（数据库、密钥）只能在服务端组件中进行

---

## 核心概念二：嵌套布局

布局系统是 App Router 最强大的特性之一：

```tsx
// app/dashboard/layout.tsx
// /dashboard 及其所有子路由共享这个布局
export default function DashboardLayout({
  children,   // 子页面内容
  params,     // 动态路由参数
  searchParams, // URL 查询参数
}: {
  children: React.ReactNode
  params: { slug: string }
  searchParams: { [key: string]: string | string[] }
}) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

### 布局之间状态共享

```tsx
// app/providers.tsx
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext('light')

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value="dark">
      {children}
    </ThemeContext.Provider>
  )
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

---

## 核心概念三：数据获取

App Router 最大的改进：**在组件内直接使用 async/await**，不需要 `getServerSideProps` 等特殊函数。

### 并行数据获取

```tsx
// app/user/page.tsx
export default async function UserPage() {
  // 两个请求并行发起，不需要手动 Promise.all
  const [user, posts] = await Promise.all([
    fetch('/api/user').then(r => r.json()),
    fetch('/api/posts').then(r => r.json()),
  ])

  return (
    <div>
      <UserProfile user={user} />
      <PostList posts={posts} />
    </div>
  )
}
```

### 缓存策略

```tsx
// 默认缓存：每个请求重新获取
const data = await fetch('https://api.example.com/data')

// 重新验证：每 60 秒重新生成
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})

// 静态渲染：构建时生成，不重新验证不更新
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache' // 默认行为
})

// 动态数据：每个请求都重新获取
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})
```

### 使用 React Query / SWR

```tsx
// app/posts/page.tsx
'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PostsPage() {
  const { data, error, isLoading } = useSWR('/api/posts', fetcher)

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>加载失败</div>

  return (
    <div>
      {data.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

---

## 核心概念四：动态路由

### 静态路径生成

```tsx
// app/blog/[slug]/page.tsx

// 1. 定义动态路由参数类型
interface PageProps {
  params: { slug: string }
}

// 2. 生成静态路径（构建时）
export async function generateStaticParams() {
  const posts = await db.post.findMany()
  return posts.map(post => ({
    slug: post.slug,
  }))
}

// 3. 渲染页面
export default async function BlogPostPage({ params }: PageProps) {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
  })

  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### Catch-all 路由

```
app/docs/[...slug]/page.tsx
```
匹配 `/docs/a`、`/docs/a/b`、`/docs/a/b/c` 等所有路径：

```tsx
export default function DocPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const path = params.slug.join('/')
  return <div>当前路径：/{path}</div>
}
```

---

## 核心概念五：流式渲染与 Suspense

流式渲染让页面可以分块逐步显示，大幅优化用户体验：

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'

// 数据获取组件（可以是异步的）
async function BlogList() {
  const posts = await getPosts() // 可能需要 2 秒
  return (
    <ul>
      {posts.map(p => <li key={p.id}>{p.title}</li>)}
    </ul>
  )
}

// 骨架屏组件
function BlogSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="h-6 bg-gray-200 rounded w-1/2" />
    </div>
  )
}

export default function BlogPage() {
  return (
    <div>
      <h1>博客列表</h1>
      {/* Suspense 包裹异步组件，显示 fallback 直到数据加载完成 */}
      <Suspense fallback={<BlogSkeleton />}>
        <BlogList />
      </Suspense>
    </div>
  )
}
```

**加载效果**：页面骨架 → 数据加载完成 → 替换内容（无需等待整个页面）

---

## 核心概念六：中间件

中间件在路由匹配前执行，适合认证、日志、重定向等：

```typescript
// middleware.ts（放在项目根目录）
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 获取用户 token
  const token = request.cookies.get('auth-token')

  // 未登录且访问受保护页面，重定向到登录页
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 添加响应头
  const response = NextResponse.next()
  response.headers.set('x-custom-header', 'hello')
  return response
}

// 配置匹配路径
export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
}
```

---

## 实战：完整 CRUD 页面

```tsx
// app/posts/[id]/page.tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PostActions } from './post-actions' // 'use client' 组件

interface PageProps {
  params: { id: string }
}

export async function generateStaticParams() {
  const posts = await db.post.findMany()
  return posts.map(p => ({ id: p.id }))
}

export default async function PostPage({ params }: PageProps) {
  const post = await db.post.findUnique({
    where: { id: params.id },
    include: { author: true, comments: true },
  })

  if (!post) notFound()

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <span>作者：{post.author.name}</span>
        <span>发布于：{post.createdAt.toLocaleDateString()}</span>
      </header>

      <div className="prose">{post.content}</div>

      {/* 客户端组件处理交互 */}
      <PostActions postId={post.id} />

      <section className="comments">
        <h2>评论（{post.comments.length}）</h2>
        {post.comments.map(c => (
          <div key={c.id}>
            <strong>{c.author.name}</strong>
            <p>{c.content}</p>
          </div>
        ))}
      </section>
    </article>
  )
}
```

---

## 性能优化技巧

### 图片优化

```tsx
import Image from 'next/image'

export default function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      priority // LCP 图片加 priority 加速
      placeholder="blur"
      blurDataURL={blurData} // 低带宽友好
    />
  )
}
```

### 字体优化

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // FOIT 优化
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### 动态导入

```tsx
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // 客户端渲染，不需要服务端
})

export default function DashboardPage() {
  return (
    <div>
      <HeavyChart data={chartData} />
    </div>
  )
}
```

---

## 常见问题

**Q：数据请求应该放在服务端还是客户端？**
> 优先服务端组件。数据库查询、API 密钥、外部 API 调用都放服务端。只有需要交互（点击、表单、实时更新）时才用客户端组件。

**Q：如何选择 `generateStaticParams` 还是每次请求都查？**
> 有固定数据集（文章列表、商品列表）用 `generateStaticParams` 生成静态页面；数据频繁变化（实时价格、用户数据）用动态渲染。

**Q：客户端组件可以调用数据库吗？**
> 不可以。客户端组件在浏览器运行，数据库连接只能放在服务端组件或 API Route 中。

---

## 总结

App Router 的核心优势：

| 优势 | 说明 |
|------|------|
| RSC 默认 | 服务端组件零配置，数据获取极简 |
| 嵌套布局 | 页面布局复用逻辑大幅简化 |
| 流式渲染 | Suspense 实现真正的渐进式加载 |
| 并行数据获取 | async/await 自然并行，无需手动 Promise.all |
| 静态生成 | `generateStaticParams` 轻松实现 SSG |
| 中间件 | 认证、日志、重定向统一处理 |

App Router 代表了 React 全栈开发的未来方向，尽早掌握能大幅提升开发效率和用户体验。

---

*本文由小虾子 🦐 撰写*
