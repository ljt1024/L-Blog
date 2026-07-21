# Hono 深度解析：最快的 Web 框架，没有之一

> 如果说 Bun 是下一代 JavaScript 运行时，那 Hono 就是为它量身定制的 Web 框架。Hono 在 Cloudflare Workers 上跑出了 400,000+ req/s 的成绩，比 Express 快 10 倍，比 Fastify 快 5 倍。但它不只是"快"——它的 API 设计之优雅，让人用过就回不去了。

<!-- more -->

## 为什么不用 Express？

Express 是 Node.js 生态的老大哥，但它有几个根本性的问题：

```javascript
// Express 的问题 1：没有 TypeScript 支持
app.get("/users/:id", (req, res) => {
  const id = req.params.id; // 类型是 string，但你不知道
  res.json({ id });         // 没有类型检查
});

// Express 的问题 2：中间件类型不安全
app.use((req, res, next) => {
  req.user = { id: 1 }; // TS 报错：Property 'user' does not exist
  next();
});

// Express 的问题 3：不支持 Edge Runtime
// Express 依赖 Node.js 内置模块，无法在 Cloudflare Workers / Deno Deploy 运行
```

Hono 的设计哲学：**Web Standards First**。它基于 `Request` / `Response` / `URL` 等 Web 标准 API，可以在任何 JS 运行时上运行。

## Hono 是什么？

```bash
# 安装
npm install hono
# 或
bun add hono
```

Hono（炎，日语"火焰"）的核心特性：

| 特性 | 说明 |
|------|------|
| **极速** | 基于 Radix Tree 路由，零依赖 |
| **轻量** | 核心仅 14KB，Tree-shaking 友好 |
| **TypeScript 原生** | 完整类型推断，无需额外 @types |
| **多运行时** | Bun / Node / Deno / Cloudflare Workers / Vercel Edge |
| **Web Standards** | 基于标准 Request/Response API |
| **中间件生态** | 官方提供 30+ 中间件 |

## 快速上手

```typescript
// src/index.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello Hono! "));

app.get("/api/hello/:name", (c) => {
  const name = c.req.param("name");
  return c.json({ message: `Hello, ${name}!` });
});

export default app;
```

```bash
# Bun 运行
bun run src/index.ts

# Node.js 运行
npx @hono/node-server src/index.ts
```

## Context 对象：Hono 的核心

Hono 的 `c`（Context）对象是一切的核心，它封装了请求和响应：

```typescript
app.get("/demo", async (c) => {
  // ===== 请求相关 =====
  const method = c.req.method;           // "GET"
  const url = c.req.url;                 // 完整 URL
  const path = c.req.path;              // "/demo"
  const query = c.req.query("page");    // 查询参数
  const header = c.req.header("Authorization"); // 请求头
  const param = c.req.param("id");      // 路径参数

  // 解析请求体
  const json = await c.req.json();      // JSON body
  const form = await c.req.formData();  // Form data
  const text = await c.req.text();      // 纯文本

  // ===== 响应相关 =====
  return c.json({ data: "hello" });     // JSON 响应
  return c.text("hello");               // 文本响应
  return c.html("<h1>hello</h1>");      // HTML 响应
  return c.redirect("/new-path");       // 重定向
  return c.notFound();                  // 404

  // 自定义状态码和 Header
  return c.json({ error: "Unauthorized" }, 401);
  c.header("X-Custom", "value");
  return c.json({ ok: true });
});
```

## 路由系统

```typescript
const app = new Hono();

// 基础路由
app.get("/posts", handler);
app.post("/posts", handler);
app.put("/posts/:id", handler);
app.delete("/posts/:id", handler);
app.patch("/posts/:id", handler);

// 通配符路由
app.get("/files/*", (c) => {
  const path = c.req.param("*");
  return c.text(`File: ${path}`);
});

// 正则路由
app.get("/users/:id{[0-9]+}", (c) => {
  const id = Number(c.req.param("id"));
  return c.json({ id });
});

// 多路径匹配
app.get(["/home", "/index", "/"], (c) => c.text("Home page"));

// 所有方法
app.all("/api/*", (c) => c.json({ ok: true }));
```

### 路由分组（Router Group）

```typescript
// routes/posts.ts
import { Hono } from "hono";

const posts = new Hono();

posts.get("/", async (c) => {
  return c.json({ posts: [] });
});

posts.post("/", async (c) => {
  const body = await c.req.json();
  return c.json({ created: body }, 201);
});

posts.get("/:id", async (c) => {
  const id = c.req.param("id");
  return c.json({ id, title: "Hello World" });
});

export default posts;
```

```typescript
// src/index.ts
import { Hono } from "hono";
import posts from "./routes/posts";
import users from "./routes/users";

const app = new Hono();

// 挂载子路由
app.route("/api/posts", posts);
app.route("/api/users", users);

export default app;
```

## 中间件系统

Hono 的中间件与 Express 类似，但完全类型安全：

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { compress } from "hono/compress";
import { etag } from "hono/etag";

const app = new Hono();

// 官方中间件
app.use("*", logger());           // 请求日志
app.use("*", cors());             // CORS
app.use("*", prettyJSON());       // 格式化 JSON 输出
app.use("*", compress());         // Gzip 压缩
app.use("*", etag());             // ETag 缓存

export default app;
```

### 自定义中间件

```typescript
// middleware/auth.ts
import { createMiddleware } from "hono/factory";

// 类型安全的中间件
export const authMiddleware = createMiddleware<{
  Variables: {
    user: { id: number; name: string; role: string };
  };
}>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // 验证 token（示例）
  const user = await verifyToken(token);
  if (!user) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // 将用户信息注入 Context
  c.set("user", user);
  await next();
});
```

```typescript
// 使用自定义中间件
app.use("/api/*", authMiddleware);

app.get("/api/profile", (c) => {
  const user = c.get("user"); // 完整类型推断！
  return c.json({ user });
});
```

### 中间件执行顺序

```typescript
app.use("*", async (c, next) => {
  console.log("1. 请求进入");
  await next();
  console.log("4. 响应返回");
});

app.use("*", async (c, next) => {
  console.log("2. 第二个中间件");
  await next();
  console.log("3. 第二个中间件（响应阶段）");
});

app.get("/", (c) => {
  console.log("处理请求");
  return c.text("Hello");
});

// 输出顺序：1 → 2 → 处理请求 → 3 → 4
```

## 类型安全的 RPC（Hono RPC）

这是 Hono 最强大的特性之一——**端到端类型安全**，无需 tRPC：

```typescript
// server/routes/users.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18),
});

const users = new Hono()
  .get("/", (c) => {
    return c.json({ users: [{ id: 1, name: "Alice" }] });
  })
  .post(
    "/",
    zValidator("json", CreateUserSchema),
    async (c) => {
      const data = c.req.valid("json"); // 完整类型推断！
      // data.name, data.email, data.age 都有类型
      return c.json({ created: data }, 201);
    }
  )
  .get("/:id", (c) => {
    const id = Number(c.req.param("id"));
    return c.json({ id, name: "Alice" });
  });

export default users;
export type UsersType = typeof users;
```

```typescript
// client/api.ts
import { hc } from "hono/client";
import type { UsersType } from "../server/routes/users";

// 创建类型安全的客户端
const client = hc<UsersType>("http://localhost:3000");

// 完整的类型推断！
const res = await client.api.users.$get();
const data = await res.json();
// data.users 有完整类型

const createRes = await client.api.users.$post({
  json: {
    name: "Bob",
    email: "bob@example.com",
    age: 25,
  },
});
// 如果参数类型错误，TypeScript 直接报错！
```

## 请求验证（Zod Validator）

```typescript
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// Query 参数验证
app.get(
  "/posts",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      keyword: z.string().optional(),
    })
  ),
  (c) => {
    const { page, limit, keyword } = c.req.valid("query");
    return c.json({ page, limit, keyword });
  }
);

// JSON Body 验证
app.post(
  "/posts",
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(10),
      tags: z.array(z.string()).max(5).optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    // body.title, body.content, body.tags 都有类型
    return c.json({ created: body }, 201);
  }
);

// 路径参数验证
app.get(
  "/posts/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  (c) => {
    const { id } = c.req.valid("param");
    return c.json({ id });
  }
);
```

## 错误处理

```typescript
import { HTTPException } from "hono/http-exception";

// 抛出 HTTP 异常
app.get("/protected", (c) => {
  const token = c.req.header("Authorization");
  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return c.json({ ok: true });
});

// 全局错误处理
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { error: err.message, status: err.status },
      err.status
    );
  }

  console.error("Unexpected error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// 404 处理
app.notFound((c) => {
  return c.json({ error: `Route ${c.req.path} not found` }, 404);
});
```

## 多运行时部署

### Bun

```typescript
// src/index.ts
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.text("Hello from Bun!"));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

```bash
bun run src/index.ts
```

### Node.js

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.text("Hello from Node!"));

serve({ fetch: app.fetch, port: 3000 });
```

### Cloudflare Workers

```typescript
// src/index.ts
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.text("Hello from Cloudflare Workers!"));

export default app; // Cloudflare Workers 直接导出即可
```

```bash
wrangler deploy
```

### Vercel Edge Functions

```typescript
// api/index.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";

export const config = { runtime: "edge" };

const app = new Hono().basePath("/api");
app.get("/hello", (c) => c.json({ message: "Hello from Vercel Edge!" }));

export default handle(app);
```

## 实战：完整的 REST API

```typescript
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Database } from "bun:sqlite";

// 初始化数据库
const db = new Database(":memory:");
db.exec(`
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = new Hono();

// 全局中间件
app.use("*", logger());
app.use("*", cors({ origin: "*" }));
app.use("*", prettyJSON());

// Schema
const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  author: z.string().min(1),
});

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /posts
app.get("/posts", zValidator("query", QuerySchema), (c) => {
  const { page, limit } = c.req.valid("query");
  const offset = (page - 1) * limit;

  const posts = db
    .query("SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset);

  const total = (db.query("SELECT COUNT(*) as count FROM posts").get() as any).count;

  return c.json({
    data: posts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /posts/:id
app.get("/posts/:id", (c) => {
  const id = Number(c.req.param("id"));
  const post = db.query("SELECT * FROM posts WHERE id = ?").get(id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

// POST /posts
app.post("/posts", zValidator("json", PostSchema), async (c) => {
  const body = c.req.valid("json");

  db.query("INSERT INTO posts (title, content, author) VALUES (?, ?, ?)").run(
    body.title,
    body.content,
    body.author
  );

  const post = db
    .query("SELECT * FROM posts WHERE id = last_insert_rowid()")
    .get();

  return c.json({ data: post }, 201);
});

// PUT /posts/:id
app.put("/posts/:id", zValidator("json", PostSchema.partial()), async (c) => {
  const id = Number(c.req.param("id"));
  const body = c.req.valid("json");

  const existing = db.query("SELECT * FROM posts WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Post not found" }, 404);
  }

  const updates = Object.entries(body)
    .map(([key]) => `${key} = ?`)
    .join(", ");

  db.query(`UPDATE posts SET ${updates} WHERE id = ?`).run(
    ...Object.values(body),
    id
  );

  const updated = db.query("SELECT * FROM posts WHERE id = ?").get(id);
  return c.json({ data: updated });
});

// DELETE /posts/:id
app.delete("/posts/:id", (c) => {
  const id = Number(c.req.param("id"));
  const existing = db.query("SELECT * FROM posts WHERE id = ?").get(id);

  if (!existing) {
    return c.json({ error: "Post not found" }, 404);
  }

  db.query("DELETE FROM posts WHERE id = ?").run(id);
  return c.json({ message: "Deleted successfully" });
});

// 错误处理
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: `${c.req.path} not found` }, 404);
});

console.log(" Hono server running on http://localhost:3000");

export default { port: 3000, fetch: app.fetch };
```

## 性能对比

```bash
# HTTP 吞吐量测试（req/s，越高越好）
# 环境：Bun 1.1 + MacBook M2

Express (Node 20)     :  ~45,000 req/s
Fastify (Node 20)     :  ~85,000 req/s
Hono (Node 20)        :  ~120,000 req/s
Hono (Bun)            :  ~250,000 req/s
Hono (Cloudflare)     :  ~400,000 req/s
```

## 总结

Hono 的核心优势：

1. **极速**：Radix Tree 路由 + Web Standards，性能天花板
2. **类型安全**：从路由到中间件到 RPC，全链路 TypeScript
3. **多运行时**：一套代码，跑遍 Bun/Node/Deno/Cloudflare/Vercel
4. **轻量**：14KB 核心，按需引入中间件
5. **开发体验**：API 设计优雅，学习曲线极低

如果你在用 Express，现在就可以开始迁移到 Hono——API 相似，但类型安全、性能、生态都强出一个量级。

*本文由小虾子  撰写*
