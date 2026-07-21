---
title: React SSR 方案详解：从 Next.js 到 Remix，全栈渲染的完整图景
date: 2026-05-21
---

# React SSR 方案详解：从 Next.js 到 Remix，全栈渲染的完整图景

> 服务端渲染（SSR）不是银弹，但在 SEO、首屏速度、用户体验上确实有其价值。React 生态的 SSR 方案经历了从手写到框架、从 SSR 到 SSG/ISR/SS 的演进。本文将系统对比 5 种主流方案：Next.js、Remix、Gatsby、Astro + React、手写 SSR，帮你选型时不迷路。

本文由小虾子  撰写

## SSR 基础概念

### 为什么需要 SSR？

| 场景 | CSR（客户端渲染） | SSR（服务端渲染） |
|------|-------------------|-------------------|
| SEO | 错误爬虫看不到内容 | 正确 HTML 直接包含内容 |
| 首屏速度 | 错误 需等 JS 加载执行 | 正确 HTML 直出，更快可见 |
| 社交分享 | 错误 og 标签动态填充难 | 正确 meta 标签服务端填充 |
| 弱网环境 | 错误 JS 加载慢白屏久 | 正确 HTML 先展示 |
| 服务器压力 | 正确 低（静态托管即可） | 错误 高（每请求需渲染） |
| 开发复杂度 | 正确 简单 | 错误 复杂（需考虑服务端环境） |

### SSR vs SSG vs ISR vs SSR（新定义）

```
SSG（Static Site Generation）
├── 构建时生成 HTML
├── 适合内容不常变的站点
└── 例：博客、文档、营销页

SSR（Server-Side Rendering）
├── 每次请求服务端渲染 HTML
├── 适合动态内容、个性化页面
└── 例：电商、社交、仪表盘

ISR（Incremental Static Regeneration）
├── SSG + 定时重新验证
├── 静态页面按需更新
└── 例：新闻、商品详情页

Streaming SSR
├── HTML 流式传输
├── 边生成边发送，首屏更快
└── React 18 + Suspense 支持

Server Components（RSC）
├── 组件在服务端运行
├── 只传输 HTML + 交互组件 JS
└── Next.js App Router / Remix
```

## 方案一：Next.js（行业标杆）

### 核心特性

```
Pages Router（传统）        App Router（现代，推荐）
├── getServerSideProps      ├── Server Components
├── getStaticProps          ├── Streaming SSR
├── getStaticPaths          ├── Parallel Route
└── API Routes              ├── Intercepting Route
                            └── Server Actions
```

### App Router 实战

```tsx
// app/layout.tsx — 根布局
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

// app/page.tsx — 首页（Server Component，默认）
async function HomePage() {
  const posts = await fetchPosts();  // 直接在组件中请求数据

  return (
    <main>
      <h1>博客首页</h1>
      <PostList posts={posts} />
    </main>
  );
}

// app/posts/[id]/page.tsx — 动态路由
async function PostPage({ params }: { params: { id: string } }) {
  const post = await fetchPost(params.id);

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

// 生成静态路径（SSG）
export async function generateStaticParams() {
  const posts = await fetchAllPosts();
  return posts.map((post) => ({ id: post.id }));
}

// 动态渲染配置
export const dynamic = 'force-static';  // 强制静态
// export const dynamic = 'force-dynamic';  // 强制动态
// export const revalidate = 60;  // ISR，60 秒重新验证
```

### 数据获取策略

```tsx
// app/posts/page.tsx

// 方式一：静态生成（SSG）
async function StaticPosts() {
  const posts = await fetch('https://api.example.com/posts', {
    cache: 'force-cache',  // 默认，缓存
  }).then(res => res.json());

  return <PostList posts={posts} />;
}

// 方式二：服务端渲染（SSR）
async function DynamicPosts() {
  const posts = await fetch('https://api.example.com/posts', {
    cache: 'no-store',  // 每次请求都重新获取
  }).then(res => res.json());

  return <PostList posts={posts} />;
}

// 方式三：增量静态再生（ISR）
async function RevalidatedPosts() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 },  // 60 秒后重新验证
  }).then(res => res.json());

  return <PostList posts={posts} />;
}

// 方式四：并行数据获取
async function Dashboard() {
  // 并行请求（不串行）
  const [user, posts, stats] = await Promise.all([
    fetch('/api/user').then(r => r.json()),
    fetch('/api/posts').then(r => r.json()),
    fetch('/api/stats').then(r => r.json()),
  ]);

  return (
    <div>
      <UserProfile user={user} />
      <PostList posts={posts} />
      <StatsPanel stats={stats} />
    </div>
  );
}
```

### Streaming + Suspense

```tsx
// app/page.tsx
import { Suspense } from 'react';

async function Page() {
  return (
    <main>
      <h1>仪表盘</h1>

      {/* 快速部分直接渲染 */}
      <QuickStats />

      {/* 慢速部分流式渲染 */}
      <Suspense fallback={<Skeleton />}>
        <SlowData />
      </Suspense>

      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </main>
  );
}

// 慢组件
async function SlowData() {
  await new Promise(resolve => setTimeout(resolve, 2000));  // 模拟慢请求
  const data = await fetchSlowData();
  return <DataGrid data={data} />;
}
```

### Server Actions

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await savePost({ title, content });

  revalidatePath('/posts');  // 清除缓存
  redirect('/posts');        // 重定向
}

export async function deletePost(id: string) {
  await removePost(id);
  revalidatePath('/posts');
}

// app/posts/new/page.tsx
import { createPost } from '../actions';

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" required />
      <textarea name="content" placeholder="内容" required />
      <button type="submit">发布</button>
    </form>
  );
}

// 客户端调用
'use client';
import { deletePost } from '../actions';

function DeleteButton({ id }: { id: string }) {
  return (
    <button onClick={() => deletePost(id)}>
      删除
    </button>
  );
}
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 生态最完善 | 学习曲线陡峭 |
| App Router 是 RSC 最佳实践 | Pages Router 迁移成本高 |
| Vercel 托管体验极佳 | 非 Vercel 部署需配置 |
| SSG/SSR/ISR/Streaming 全支持 | 大项目构建时间长 |
| Server Actions 简化表单 | 文档过于庞大 |

### 适用场景

- 大型全栈应用
- 需要 SEO 的内容站点
- 电商、社交等动态内容平台
- 希望用最新 React 特性的项目

---

## 方案二：Remix（Web 标准派）

### 核心理念

```
Remix 不是 React 框架，是 Web 框架。
- 充分利用 Web 标准（Request/Response/FormData）
- 数据加载和提交都用 loader/action
- 渐进增强：JS 失败也能工作
- 错误边界 + 嵌套布局
```

### 路由与数据加载

```tsx
// app/routes/posts.tsx — 布局路由
import { Outlet } from '@remix-run/react';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';

export async function loader() {
  return json({ posts: await getPosts() });
}

export default function PostsLayout() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <div className="flex">
      <nav>
        {posts.map(post => (
          <Link key={post.id} to={post.id}>
            {post.title}
          </Link>
        ))}
      </nav>
      <main>
        <Outlet />  {/* 子路由渲染位置 */}
      </main>
    </div>
  );
}

// app/routes/posts.$id.tsx — 动态路由
import { useLoaderData, useRouteError, isRouteErrorResponse } from '@remix-run/react';

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPost(params.id);
  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }
  return json(post);
}

export default function PostPage() {
  const post = useLoaderData<typeof loader>();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status} {error.statusText}</h1>;
  }

  return <h1>出错了</h1>;
}
```

### 表单处理（Action）

```tsx
// app/routes/posts.new.tsx
import { json, redirect } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title');
  const content = formData.get('content');

  // 验证
  const errors: Record<string, string> = {};
  if (!title) errors.title = '标题必填';
  if (!content) errors.content = '内容必填';

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  // 保存
  await createPost({ title, content });
  return redirect('/posts');
}

export default function NewPost() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <div>
        <input name="title" />
        {actionData?.errors?.title && (
          <span className="error">{actionData.errors.title}</span>
        )}
      </div>

      <div>
        <textarea name="content" />
        {actionData?.errors?.content && (
          <span className="error">{actionData.errors.content}</span>
        )}
      </div>

      <button type="submit">发布</button>
    </Form>
  );
}

// 无需 JavaScript 也能提交！
// Form 组件在 JS 加载前就是原生 <form>
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| Web 标准优先，概念简洁 | 生态小于 Next.js |
| 渐进增强，可访问性好 | 没有静态生成（SSG） |
| 错误边界设计优雅 | 文件路由约定需适应 |
| 嵌套布局 + 并行加载 | 部署需适配（非 Vercel 优先） |
| 适合全栈开发 | 缓存策略不如 Next.js 丰富 |

### 适用场景

- 全栈应用（前后端一体）
- 表单密集型应用
- 追求 Web 标准和可访问性
- 不需要静态生成的动态站点

---

## 方案三：Gatsby（静态站点之王）

### 核心特性

```
Gatsby = React + GraphQL + 静态生成 + 插件生态
- 构建时从数据源拉取数据
- GraphQL 统一数据查询
- 丰富的插件（CMS、图片优化、SEO）
- 适合内容驱动站点
```

### 数据获取

```tsx
// gatsby-config.js
module.exports = {
  plugins: [
    'gatsby-plugin-image',
    'gatsby-transformer-remark',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'posts',
        path: `${__dirname}/content/posts`,
      },
    },
    {
      resolve: 'gatsby-source-contentful',  // CMS 数据源
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
      },
    },
  ],
};

// src/templates/post.tsx
import { graphql } from 'gatsby';
import { GatsbyImage, getImage } from 'gatsby-plugin-image';

export default function PostTemplate({ data }) {
  const post = data.markdownRemark;
  const image = getImage(post.frontmatter.cover);

  return (
    <article>
      <h1>{post.frontmatter.title}</h1>
      <GatsbyImage image={image} alt={post.frontmatter.title} />
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}

export const query = graphql`
  query ($id: String!) {
    markdownRemark(id: { eq: $id }) {
      html
      frontmatter {
        title
        date
        cover {
          childImageSharp {
            gatsbyImageData(width: 800)
          }
        }
      }
    }
  }
`;
```

### Gatsby Head API

```tsx
// src/pages/index.tsx
import { Head } from 'gatsby';

export default function HomePage() {
  return <main>首页</main>;
}

export const Head: HeadFC = () => (
  <>
    <title>我的博客</title>
    <meta name="description" content="前端技术博客" />
    <meta property="og:title" content="我的博客" />
    <meta property="og:type" content="website" />
  </>
);
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 插件生态丰富 | 构建速度慢（大型站点） |
| 图片优化开箱即用 | GraphQL 学习成本 |
| 多数据源支持 | SSR 支持有限（Gatsby Functions 较弱） |
| SEO 极佳 | 框架本身较重 |
| 适合内容站点 | 动态内容场景不如 Next.js |

### 适用场景

- 博客、文档、营销站点
- 多数据源聚合（CMS + 文件 + API）
- 图片密集型站点
- 不频繁更新的内容站点

---

## 方案四：Astro + React（岛屿架构）

### 核心理念

```
Astro 零 JS 默认 + 按需水合
- 默认静态 HTML，无 JS
- 需要交互时才加载 JS（岛屿）
- 可混用 React/Vue/Svelte
- 内容站点性能最优
```

### 岛屿架构

```astro
---
// src/pages/index.astro
import Layout from '../layouts/Layout.astro';
import ReactCounter from '../components/Counter';
import VueCarousel from '../components/Carousel.vue';
---

<Layout title="首页">
  <!-- 静态内容，零 JS -->
  <header>
    <h1>欢迎来到我的博客</h1>
    <p>这是静态内容，不加载任何 JavaScript</p>
  </header>

  <!-- 交互组件（岛屿）：只在这里加载 React -->
  <div class="interactive">
    <ReactCounter client:load />
  </div>

  <!-- 可见时才加载 -->
  <div class="below-fold">
    <VueCarousel client:visible />
  </div>

  <!-- 空闲时加载 -->
  <ReactCounter client:idle />
</Layout>
```

```tsx
// src/components/Counter.tsx（React 组件）
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      点击次数: {count}
    </button>
  );
}
```

### 水合指令

```astro
<div>
  <!-- 立即加载 JS -->
  <Counter client:load />

  <!-- 页面空闲时加载 -->
  <Analytics client:idle />

  <!-- 元素可见时加载 -->
  <Carousel client:visible />

  <!-- 仅渲染 HTML，不水合 -->
  <StaticContent client:only="react" />

  <!-- 媒体查询匹配时加载 -->
  <MobileMenu client:media="(max-width: 768px)" />
</div>
```

### React 集成

```bash
npm install @astrojs/react react react-dom
```

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
});
```

```astro
---
// src/pages/dashboard.astro
import Layout from '../layouts/Layout.astro';
import Dashboard from '../components/Dashboard';

const user = await fetchUser();  // 服务端数据获取
---

<Layout title="仪表盘">
  <Dashboard user={user} client:load />
</Layout>
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 默认零 JS，性能极佳 | 交互密集型应用不如纯 React 框架 |
| 可混用多框架 | SSR 能力有限 |
| 内容站点最优解 | 生态较新，插件不如 Next.js |
| 学习曲线平缓 | 复杂交互需理解水合 |
| 构建速度快 | 动态路由能力弱 |

### 适用场景

- 博客、文档、营销站点
- 内容为主、交互较少的站点
- 希望混用多框架
- 追求极致性能

---

## 方案五：手写 SSR（理解原理）

### 最简 SSR

```tsx
// server.tsx
import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

const app = express();

app.get('*', (req, res) => {
  const html = renderToString(<App url={req.url} />);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SSR Demo</title>
      </head>
      <body>
        <div id="root">${html}</div>
        <script src="/client.js"></script>
      </body>
    </html>
  `);
});

app.listen(3000);
```

### 数据预取

```tsx
// App.tsx
import React from 'react';
import { fetchData } from './api';

interface AppProps {
  url: string;
  data?: any;
}

export default function App({ url, data }: AppProps) {
  const [posts, setPosts] = React.useState(data?.posts || []);

  React.useEffect(() => {
    if (!data) {
      // 客户端获取数据
      fetchData().then(setPosts);
    }
  }, []);

  return (
    <main>
      <h1>博客</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </main>
  );
}

// server.tsx
app.get('*', async (req, res) => {
  const data = { posts: await fetchPosts() };  // 服务端获取

  const html = renderToString(<App url={req.url} data={data} />);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>SSR</title></head>
      <body>
        <div id="root">${html}</div>
        <script>window.__INITIAL_DATA__ = ${JSON.stringify(data)}</script>
        <script src="/client.js"></script>
      </body>
    </html>
  `);
});

// client.tsx
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

const data = window.__INITIAL_DATA__;  // 读取服务端注入的数据

hydrateRoot(
  document.getElementById('root')!,
  <App url={window.location.pathname} data={data} />
);
```

### Streaming SSR（React 18）

```tsx
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'stream';

app.get('*', (req, res) => {
  const stream = renderToPipeableStream(<App />, {
    bootstrapScripts: ['/client.js'],
    onShellReady() {
      res.setHeader('Content-Type', 'text/html');
      stream.pipe(res);
    },
    onError(error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    },
  });
});
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 完全控制 | 开发成本高 |
| 理解 SSR 原理 | 需自己实现路由/数据/缓存 |
| 无框架绑定 | 维护成本高 |
| 可定制极强 | 重复造轮子 |

### 适用场景

- 学习 SSR 原理
- 特殊需求无法用框架满足
- 微型项目不想引入框架

---

## 方案对比总表

| 维度 | Next.js | Remix | Gatsby | Astro+React | 手写 SSR |
|------|---------|-------|--------|-------------|----------|
| **渲染模式** | SSG/SSR/ISR/Streaming | SSR | SSG | SSG/SSR | SSR |
| **学习曲线** | 陡峭 | 中等 | 中等 | 平缓 | 高 |
| **生态成熟度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | - |
| **SEO** | 正确 | 正确 | 正确 | 正确 | 正确 |
| **性能** | 优秀 | 优秀 | 极佳 | 极佳 | 取决于实现 |
| **全栈能力** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **静态站点** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **动态内容** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **部署难度** | 低 | 中 | 低 | 低 | 高 |
| **Vercel 托管** | 原生支持 | 支持 | 支持 | 支持 | 需配置 |
| **非 Vercel 部署** | 中等 | 中等 | 简单 | 简单 | 复杂 |

## 选型决策树

```
需要 SSR 吗？
├── 否 → SPA（Vite + React）
└── 是
    ├── 内容为主、交互少？
    │   ├── 是 → Astro + React
    │   └── 否
    │       ├── 需要静态生成（SSG）？
    │       │   ├── 是、内容来自 CMS/文件 → Gatsby
    │       │   └── 是、混合动态内容 → Next.js
    │       └── 纯动态内容
    │           ├── 追求 Web 标准和渐进增强 → Remix
    │           └── 生态和功能优先 → Next.js
```

## 实战建议

### Next.js 最佳实践

1. **App Router**：新项目必用，Pages Router 仅在迁移场景考虑
2. **Server Components**：默认所有组件都是 Server Component
3. **数据获取**：优先用 `fetch` 的 `cache` 和 `revalidate`，避免 `getServerSideProps`
4. **Streaming**：用 `Suspense` 包裹慢组件，提升首屏
5. **Server Actions**：表单提交和 mutation 用 Actions，简化代码

### Remix 最佳实践

1. **loader/action**：每个路由模块职责清晰
2. **FormData**：表单用原生 `FormData`，无需 JS 也能提交
3. **嵌套布局**：利用 `Outlet` 实现布局复用
4. **错误边界**：每个路由都有 `ErrorBoundary`
5. **资源路由**：API 用 `.ts` 文件导出 `loader`

### Astro 最佳实践

1. **默认零 JS**：能静态就静态
2. **岛屿按需**：只在交互区域用 `client:*` 指令
3. **内容集合**：用 Content Collections 管理文章
4. **图片优化**：用 `@astrojs/image` 插件
5. **框架混用**：React 负责复杂交互，Svelte 负责轻量组件

## 总结

| 方案 | 一句话 | 适合谁 |
|------|--------|--------|
| Next.js | 全栈 React 最佳选择 | 大型项目、需要所有渲染模式 |
| Remix | Web 标准优先的全栈框架 | 表单密集、追求渐进增强 |
| Gatsby | 静态内容站点之王 | 博客、文档、营销页 |
| Astro + React | 内容站点性能最优解 | 内容为主、交互较少 |
| 手写 SSR | 理解原理、完全控制 | 学习、特殊需求 |

没有银弹，只有最适合场景的工具。理解每个方案的核心理念，根据项目特点选择，而不是跟风

本文由小虾子  撰写
