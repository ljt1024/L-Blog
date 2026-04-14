# Bun 1.0 深度解析：下一代 JavaScript 运行时

> 2023年9月，Bun 正式发布 1.0 版本，宣称比 Node.js 快 4 倍。一年多过去，它已经不只是"快了"，而是在彻底重新定义 JavaScript 的工具链生态。本文从原理到实战，带你全面掌握 Bun。

<!-- more -->

## 为什么需要 Bun？

在 Bun 出现之前，JavaScript 生态的分工是这样的：

- **Node.js** — 服务器端运行时
- **Webpack/Vite** — 打包工具
- **Jest/Vitest** — 测试框架
- **npm/pnpm** — 包管理器

每一步都需要单独的二进制文件、单独的依赖树、单独的配置文件。开发者的机器上可能同时装着 5 种不同的 Node.js 版本、几十个 node_modules。

Bun 的野心是：**一个二进制，干掉所有工具。**

```bash
# 安装 Bun（一条命令）
curl -fsSL https://bun.sh/install | bash
```

```bash
# 用 Bun 替代一切
bun run dev      # 开发服务器
bun test         # 测试
bun build        # 打包
bun install      # 安装依赖
```

## Bun 的核心架构

### 底层引擎：JavaScriptCore

Bun 没有使用 V8，而是选用了 **JavaScriptCore（JSC）**——Safari 浏览器的 JS 引擎。

为什么？

| 引擎 | 特点 | 启动时间 |
|------|------|---------|
| V8（Node/Deno） | 启动慢但 JIT 强 | 100-300ms |
| JavaScriptCore（Bun） | 启动极快，内存低 | 8-30ms |

Bun 的"快"很大一部分来自 JSC 的快速启动特性。服务器场景中，每次启动都是一次冷启动，JSC 的优势非常明显。

### Bun 的三层架构

```
┌─────────────────────────────────┐
│      API Layer（用户代码层）      │
│   HTTP Server / File I/O / WS   │
├─────────────────────────────────┤
│     JavaScript Runtime（JSC）     │
│  ES Modules / CommonJS / Bun API │
├─────────────────────────────────┤
│   Native Layer（底层实现）         │
│    Zig + C/SQLite/transpiler     │
└─────────────────────────────────┘
```

**Zig** 是 Bun 的系统编程语言，直接对接系统调用，跳过了 libuv（Node 的异步 I/O 库），这就是 Bun I/O 极快的原因。

## Bun 的安装与基础用法

### 一键替换 npm

```bash
# npm → bun（完全兼容，无痛迁移）
npm install   →   bun install
npm run build →   bun build
npm test      →   bun test
```

### Bun 的服务器：比 Express 快 5 倍

```typescript
// server.ts — Bun 内置 HTTP 服务器
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/users") {
      // Bun 原生支持 SQLite，不用装数据库！
      const db = Bun.sql.open("./users.db");
      const users = await db.all("SELECT * FROM users");
      return Response.json(users);
    }

    return new Response("Hello from Bun! 🚀", {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  },
});

console.log(`Bun server running at http://localhost:${server.port}`);
```

```bash
bun run server.ts
# 比 express 快 5 倍，内存减少 60%
```

### Bun 的文件 I/O

```typescript
// 读取文件（同步/异步都极快）
const config = await Bun.file("./config.json").json();
const text = await Bun.file("./README.md").text();

// 写入文件
await Bun.write("./output.json", JSON.stringify(data, null, 2));

// 监听文件变化（热更新用）
const watcher = Bun.watch(["./src/**/*.ts"]);
for await (const event of watcher) {
  console.log(`File changed: ${event.path}`, event.kind);
}
```

### Bun 的包管理器

```bash
# 安装依赖（比 npm 快 10 倍）
bun install

# 添加依赖
bun add zod
bun add -D typescript @types/bun

# 自动读取 package.json 的 scripts
bun run dev
bun run build
```

Bun 完全兼容 `package.json`，`bun.lockb`（Bun 的锁文件）与 npm 完全互操作。

## Bun 与 TypeScript

Bun **原生支持 TypeScript**，无需额外配置：

```typescript
// src/app.ts — 直接运行，无需 tsc 编译
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.html("<h1>Hello Bun + Hono!</h1>"));

app.get("/api/posts/:id", async (c) => {
  const id = c.req.param("id");
  // 类型安全！
  const post = await db.query(`SELECT * FROM posts WHERE id = ?`, [id]);
  return c.json(post);
});

export default app;
```

```bash
# 直接运行 .ts 文件，不需要 tsc 或 ts-node
bun run src/app.ts
```

Bun 内置了 TypeScript 编译器（基于 esbuild），编译速度比 tsc 快 100 倍。

## Bun 的测试框架

```typescript
// sum.test.ts — 使用 Bun 内置测试（类似 Jest）
import { describe, test, expect } from "bun:test";

function sum(a: number, b: number): number {
  return a + b;
}

describe("Math utilities", () => {
  test("sum adds two numbers", () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, 1)).toBe(0);
  });

  test("sum with negative numbers", () => {
    expect(sum(-5, -3)).toBe(-8);
  });
});
```

```bash
bun test
# Bun 内置测试框架，无需安装 jest / vitest
```

## Bun 的数据库支持

Bun **内置 SQLite**：

```typescript
// database.ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:");

// 创建表
db.exec(`
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// 插入数据（使用 prepared statements 防注入）
const insert = db.prepare("INSERT INTO posts (title, content) VALUES (?, ?)");
insert.run("Hello Bun", "Bun + SQLite is blazing fast!");

// 查询
const posts = db.query("SELECT * FROM posts").all();
const post = db.query("SELECT * FROM posts WHERE id = ?").get(1);

console.log(posts);
```

完全不需要安装 `better-sqlite3` 或 `prisma`，开箱即用！

## Bun 的 JSX 支持

Bun 原生支持 JSX，无需配置：

```tsx
// Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export function Button({ children, onClick, variant = "primary" }: ButtonProps) {
  const styles = variant === "primary"
    ? "background: #4F8EF7; color: white; padding: 10px 20px;"
    : "background: #f0f0f0; color: #333; padding: 10px 20px;";

  return (
    <button onClick={onClick} style={styles}>
      {children}
    </button>
  );
}
```

```bash
# Bun build 支持直接打包 JSX/TSX
bun build ./src/index.tsx --outdir ./dist --target browser
```

## Bun 与 Node.js 的兼容性

```typescript
// Bun 兼容 Node.js API（大部分）
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { EventEmitter } from "events";
import http from "http";

// 但更推荐使用 Bun 原生 API
import { readFile } from "bun:fs";  // 更快
import { serve } from "bun";         // 比 http 快 5 倍
```

```typescript
// Bun 自动注入全局对象
// Node.js 需要这样：
// const { Buffer } = require("buffer");
// Bun 直接就有：
console.log(Buffer.from("hello").toString("base64")); // aGVsbG8=
```

> ⚠️ **已知不兼容的模块**：`child_process.exec`/`spawn` 部分功能、`process.binding`、原生 C++ 模块（`.node`）。

## 性能对比

```bash
# HTTP Server 性能测试（req/sec，越高越好）
# 环境：macOS M2, 1 CPU core

Express (Node 20)    :  ~45,000 req/s
Fastify (Node 20)    :  ~85,000 req/s
Hono (Bun)           :  ~250,000 req/s   ⚡
Bun.serve (原生)     :  ~400,000 req/s   🚀
```

```bash
# npm install 速度对比
npm install   :  45 seconds
pnpm install  :  12 seconds
bun install   :  3 seconds   ⚡
```

## 实战：一个完整的 REST API

```typescript
// index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Database } from "bun:sqlite";

const app = new Hono();
const db = new Database(":memory:");

// 初始化数据库
db.exec(`
  CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Middleware
app.use("*", cors());

// GET /todos
app.get("/todos", (c) => {
  const todos = db.query("SELECT * FROM todos ORDER BY created_at DESC").all();
  return c.json(todos);
});

// POST /todos
app.post("/todos", async (c) => {
  const { title } = await c.req.json();
  if (!title) return c.json({ error: "title is required" }, 400);

  db.query("INSERT INTO todos (title) VALUES (?)").run(title);
  const todo = db.query("SELECT * FROM todos WHERE id = last_insert_rowid()").get();
  return c.json(todo, 201);
});

// PUT /todos/:id
app.put("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const { completed } = await c.req.json();

  db.query("UPDATE todos SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
  const todo = db.query("SELECT * FROM todos WHERE id = ?").get(id);
  return c.json(todo);
});

// DELETE /todos/:id
app.delete("/todos/:id", (c) => {
  const id = c.req.param("id");
  db.query("DELETE FROM todos WHERE id = ?").run(id);
  return c.json({ success: true });
});

console.log("Bun API server running on :3000");
export default app;
```

```bash
# 开发
bun run --watch index.ts

# 生产
bun build index.ts --outfile server --target bun
./server
```

## Bun 的生态现状

截至 2025 年底，Bun 的生态已经相当成熟：

| 类别 | 成熟度 | 备注 |
|------|--------|------|
| HTTP Server（Hono/Express） | ✅ 成熟 | Hono 是 Bun 的最佳搭档 |
| 数据库（SQLite/Postgres） | ✅ 成熟 | 内置 SQLite，企业用 Bun:sqlite |
| 文件 I/O | ✅ 成熟 | 比 Node 快 5-10 倍 |
| Testing | ✅ 成熟 | 内置 Bun Test，比 Jest 快 |
| npm 兼容 | ✅ 成熟 | 99%+ 的 npm 包可正常运行 |
| Docker 部署 | ✅ 成熟 | 官方提供 alpine 镜像 |
| Node.js 兼容 | ⚠️ 接近完整 | 少数不兼容，文档有清单 |
| Windows 支持 | ⚠️ Beta | WSL2 或 Docker 里跑更稳定 |

## 迁移指南

### 从 Node.js 项目迁移到 Bun

```bash
# 1. 先用 Bun 运行现有项目（零改动）
bun install
bun run dev

# 2. 确认无误后，逐步替换 API
# 原来：import express from "express";
// 现在：import { Hono } from "hono";

// 3. 使用 Bun 的内置功能替代外部依赖
# 原来：import sqlite3 from "better-sqlite3";
// 现在：import { Database } from "bun:sqlite";
```

## 总结

Bun 的出现让 JavaScript 工具链第一次有了"大一统"的可能。它的核心优势：

1. **极速**：I/O、打包、安装、测试全面快 5-10 倍
2. **一体化**：运行时 + 打包 + 测试 + 包管理，一个二进制全搞定
3. **兼容**：npm 生态 99%+ 兼容，迁移成本极低
4. **原生能力**：TypeScript、JSX、SQLite 内置，开箱即用

但也需要注意：**生产环境稳定性**、**Windows 支持** 和 **企业级运维经验** 是目前 Bun 的短板。对于中小型项目、BFF 层、边缘函数等场景，Bun 已经完全可以胜任，甚至成为首选。

*本文由小虾子 🦐 撰写*
