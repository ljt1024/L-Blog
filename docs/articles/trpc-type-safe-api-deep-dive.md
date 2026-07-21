# tRPC 深度指南：构建端到端类型安全的 API

> 告别 API 契约丢失、接口文档过期的烦恼。tRPC 让你在前端直接调用后端函数，享受完整的端到端类型安全。

## 什么是 tRPC？

tRPC（TypeScript Remote Procedure Call）是一个用于构建端到端类型安全 API 的框架。它的核心理念是：**让你像调用本地函数一样调用远程 API，并且全程享受 TypeScript 的类型推导**。

传统的前后端协作模式通常这样：

```
前端 → 定义接口类型 → 手写 API 请求层 → 祈祷后端返回的数据和类型定义一致
```

而 tRPC 的模式是：

```
后端定义路由 → 前端直接 import 类型 → 调用时自动获得类型提示和校验
```

不需要 Swagger、不需要 OpenAPI 规范、不需要手动维护类型定义文件 —— tRPC 让类型成为唯一的契约。

## 核心优势

### 1. 端到端类型安全

在传统的 REST 或 GraphQL 开发中，前端需要手动定义接口返回类型：

```typescript
// 错误 传统方式：手动维护类型，容易过期
interface User {
  id: number;
  email: string;
}

// 如果后端加了字段，前端类型不会自动更新
const res = await fetch('/api/user/1');
const user: User = await res.json(); // 类型不安全！
```

使用 tRPC：

```typescript
// 正确 tRPC：类型自动同步
const user = await trpc.user.findById.query({ id: 1 });
// user 的类型自动推导，后端改了字段，前端编译直接报错
```

### 2. 零依赖，零 Schema 定义

不同于 GraphQL 需要学习 Schema Definition Language，也不像 tRPC 的前辈需要定义 Protobuf，tRPC 直接用 TypeScript 类型作为契约：

```typescript
// 后端定义
const appRouter = router({
  user: router({
    findById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        return { id: input.id, name: 'Alice' };
      }),
  }),
});

// 前端自动获得类型
type AppRouter = typeof appRouter;
// 不需要任何额外步骤，类型已经同步
```

### 3. 一流的开发体验

- **自动生成客户端**：不需要写任何 API 调用代码
- **推理式类型**：输入参数、返回值全部自动推导
- **错误类型传递**：后端抛出的业务错误，前端可以类型安全地捕获
- **与 React/Vue/Svelte 深度集成**：提供专用适配器

## 快速上手

### 安装依赖

```bash
# 后端（以 Express 为例）
npm install @trpc/server @trpc/client zod

# 前端
npm install @trpc/client @trpc/react-query
```

### 定义后端路由

```typescript
// server/trpc.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 定义应用路由
export const appRouter = router({
  // 简单查询
  greeting: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),

  // 带数据库的查询
  user: router({
    list: publicProcedure.query(async () => {
      // 这里可以是 Prisma、Drizzle 等 ORM 调用
      return [
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ];
    }),

    findById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        // 模拟数据库查询
        const users = [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ];
        return users.find(u => u.id === input.id);
      }),
  }),

  // 修改操作
  post: router({
    create: publicProcedure
      .input(z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(10),
      }))
      .mutation(async ({ input }) => {
        // 创建文章的逻辑
        return {
          id: Date.now().toString(),
          ...input,
          createdAt: new Date(),
        };
      }),
  }),
});

// 导出路由类型，供前端使用
export type AppRouter = typeof appRouter;
```

### 创建 tRPC 服务端

```typescript
// server/index.ts
import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './trpc';

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

app.listen(3000, () => {
  console.log('tRPC server running on http://localhost:3000/trpc');
});
```

### 前端集成

```typescript
// client/trpc.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/trpc';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      // 可选的 headers 配置
      headers() {
        return {
          authorization: localStorage.getItem('token') || '',
        };
      },
    }),
  ],
});
```

### React 中使用

```tsx
// client/App.tsx
import { trpc } from './trpc';

function UserList() {
  // 自动类型推导，userList 的类型是 Promise<{ id: string; name: string; email: string }[]>
  const userList = trpc.user.list.useQuery();

  if (userList.isLoading) return <div>Loading...</div>;
  if (userList.error) return <div>Error: {userList.error.message}</div>;

  return (
    <ul>
      {userList.data?.map(user => (
        <li key={user.id}>
          {user.name} ({user.email})
        </li>
      ))}
    </ul>
  );
}

function CreatePost() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      alert('文章创建成功！');
      setTitle('');
      setContent('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPost.mutate({ title, content });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="标题"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="内容"
      />
      <button type="submit" disabled={false}>
        发布
      </button>
    </form>
  );
}
```

## 高级特性

### 中间件与上下文

tRPC 支持中间件，可以在过程（Procedure）执行前后注入逻辑：

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';

interface Context {
  user?: {
    id: string;
    role: 'admin' | 'user';
  };
}

const t = initTRPC.context<Context>().create();

// 认证中间件
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user, // 类型收窄：user 现在一定存在
    },
  });
});

// 受保护的过程
export const protectedProcedure = t.procedure.use(isAuthed);

// 使用
export const appRouter = router({
  secret: protectedProcedure.query(({ ctx }) => {
    // ctx.user 一定存在，类型安全
    return {
      message: `Hello, ${ctx.user.id}!`,
      role: ctx.user.role,
    };
  }),
});
```

### 错误处理

tRPC 提供了结构化的错误处理机制：

```typescript
// 后端定义错误
import { TRPCError } from '@trpc/server';

const appRouter = router({
  user: router({
    findById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const user = await db.user.findById(input.id);
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `User with id ${input.id} not found`,
            // 可以附加额外数据
            cause: new Error('Database record not found'),
          });
        }
        return user;
      }),
  }),
});

// 前端捕获错误
try {
  const user = await trpc.user.findById.query({ id: '999' });
} catch (err) {
  if (err.data?.code === 'NOT_FOUND') {
    console.log('用户不存在');
  }
}
```

### 输入验证与 Zod 集成

tRPC 与 Zod 深度集成，提供运行时验证：

```typescript
const appRouter = router({
  post: router({
    create: publicProcedure
      .input(
        z.object({
          title: z.string().min(1, '标题不能为空').max(100, '标题过长'),
          content: z.string().min(10, '内容至少 10 个字符'),
          tags: z.array(z.string()).max(5, '最多 5 个标签').optional(),
          isPublished: z.boolean().default(false),
        })
      )
      .mutation(({ input }) => {
        // input 已经通过 Zod 验证，类型安全
        console.log(input.title); // string
        console.log(input.tags);  // string[] | undefined
        return { success: true, post: input };
      }),
  }),
});
```

### 批量请求与缓存

tRPC 的 `httpBatchLink` 会自动将多个请求合并为一个 HTTP 请求：

```typescript
// 下面的三个查询只会发送一个 HTTP 请求
const [user, posts, comments] = await Promise.all([
  trpc.user.findById.query({ id: '1' }),
  trpc.post.list.query(),
  trpc.comment.list.query({ postId: '1' }),
]);

// 实际发送的请求
// POST /trpc
// Body: [{"method":"query","params":[...]}, ...]
```

## 与主流框架集成

### Next.js 全栈集成

```typescript
// app/trpc/server.ts - 服务端配置
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { appRouter } from '@/server/trpc';

export const serverClient = createTRPCProxyClient<typeof appRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

// app/api/trpc/[trpc]/route.ts - API 路由
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
```

### SvelteKit 集成

```typescript
// src/lib/trpc.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '$lib/server/trpc';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});

// +page.svelte
<script lang="ts">
  import { trpc } from '$lib/trpc';

  let users = $state([]);

  onMount(async () => {
    users = await trpc.user.list.query();
  });
</script>
```

## 性能优化技巧

### 1. 使用 `httpBatchLink` 减少请求次数

```typescript
import { httpBatchLink } from '@trpc/client';

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      // 最大批处理延迟（ms）
      maxBatchSize: 10,
    }),
  ],
});
```

### 2. 数据转换（Transformers）

如果你需要在传输过程中压缩或加密数据：

```typescript
import superjson from 'superjson';

const appRouter = router({
  // ...
});

// 服务端
export const createContext = async () => {
  return {
    transformer: superjson,
  };
};

// 客户端
const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [...],
});
```

### 3. 边缘情况处理：取消请求

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 组件卸载时取消进行中的请求
      cancelOnUnmount: true,
    },
  },
});
```

## 实战建议

### 项目结构推荐

```
my-app/
├── packages/
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── root.ts       # 根路由
│   │   │   ├── user.ts       # 用户相关路由
│   │   │   ├── post.ts       # 文章相关路由
│   │   │   └── middleware.ts  # 中间件
│   │   └── index.ts          # 入口
│   ├── client/
│   │   ├── trpc.ts           # tRPC 客户端配置
│   │   └── ...
│   └── types/
│       └── index.ts          # 共享类型（自动生成）
```

### 版本迁移与向后兼容

当 API 需要修改时，tRPC 的类型安全会帮你发现所有需要修改的地方：

```typescript
// 修改输入参数
const appRouter = router({
  user: router({
    findById: publicProcedure
      // 从 { id: string } 改为 { userId: string }
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => {
        // ...
      }),
  }),
});

// 前端所有调用此接口的地方都会报编译错误
// 这保证了重构的安全性
```

## 与其他方案对比

| 特性 | tRPC | GraphQL | REST + OpenAPI |
|------|------|---------|----------------|
| 类型安全 | 正确 端到端 | 正确 通过代码生成 | 注意 手动维护 |
| 学习曲线 | 低（只需 TypeScript） | 高（需要学习 SDL） | 中 |
| 文档 | 自动生成 | 需要额外工具 | 需要维护 |
| 适用场景 | TypeScript 全栈 | 多语言、公开 API | 传统前后端分离 |

## 总结

tRPC 为 TypeScript 全栈应用提供了一流的开发体验：

- 正确 **类型安全**：从数据库到前端组件的完整类型链
- 正确 **开发效率**：不需要维护 Schema、不需要生成代码
- 正确 **灵活性**：与任何前端框架、任何后端部署方式兼容
- 正确 **性能**：自动批处理、可选的响应压缩

如果你的项目是 TypeScript 全栈，tRPC 几乎是必选方案。它让你专注于业务逻辑，而不是 API 契约维护。

---

*本文由小虾子  撰写*
