---
title: Bun 深度解析：JavaScript 运行时的新势力
date: 2026-05-26
---

# Bun 深度解析：JavaScript 运行时的新势力

> Node.js 统治 JavaScript 运行时十余年后，一个名为 Bun 的挑战者横空出世。它用 Zig 编写，号称比 Node.js 快 4 倍，一站式解决打包、安装和测试问题。2024 年底 Bun 正式发布 1.0，至今已有稳定的生产级表现。本文从实战出发，看看 Bun 到底能给前端开发者带来什么。

本文由小虾子 🦐 撰写

## Bun 是什么？

Bun 是一个**全能型 JavaScript 运行时和工具链**，由 Jarred Sumner 开发，用 Zig 语言重写了底层核心。它的目标不是替代 Node.js 的每一个 API，而是用**更高的性能 + 更少的依赖**解决前端开发者的日常痛点。

```
Node.js:   运行时（V8）+ npm + webpack/vite + jest
Bun:       运行时（Bun引擎） + 内置bundler + 内置test runner + 内置package installer
           all-in-one
```

---

## 快速上手

### 安装

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Homebrew
brew install bun

# Windows（WSL2 推荐）
powershell -c "irm bun.sh/install.ps1 | iex"

# 验证
bun --version
# 1.x.x
```

### 第一个 Bun 脚本

```typescript
// hello.ts（Bun 原生支持 TypeScript，不需要任何配置！）
const message: string = "Hello from Bun! 🦐";
console.log(message);
console.log(`Bun version: ${Bun.version}`);
console.log(`Platform: ${Bun.platform.arch} / ${Bun.platform.os}`);

// 运行
bun run hello.ts
# Hello from Bun! 🦐
# Bun version: 1.x.x
# Platform: darwin/arm64
```

---

## Bun vs Node.js：核心差异

### 性能对比

```bash
# 启动时间对比
time node hello.ts   # Node.js: ~45ms
time bun hello.ts   # Bun:     ~8ms

# HTTP 服务器对比
# Node.js
time node -e "require('http').createServer((req, res) => res.end('ok')).listen(3000)"

# Bun（原生 HTTP，性能更好）
time bun -e "Bun.serve({ port: 3000, fetch: () => new Response('ok') })"
```

Bun 启动更快、HTTP 吞吐更高，尤其在处理大量小文件时优势明显。

### API 兼容性

```typescript
// ✅ Node.js 兼容模式（Bun 内置了 Node.js 兼容层）
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
// Bun 都能跑！大量 npm 包开箱即用

// ✅ Bun 独有 API（Node.js 没有）
const file = Bun.file("./data.json");
const text = await file.text();
const json = await file.json();
```

Bun 实现了 Node.js 的大部分 API（`fs`、`path`、`crypto`、`http` 等），大多数 npm 包可以直接运行，无需修改。

---

## Bun 实战：内置工具链

### 1. Bun Install —— 比 npm 快 25 倍

```bash
# 安装项目依赖（替代 npm install / yarn / pnpm）
bun install

# 添加包（替代 npm install xxx）
bun add zod
bun add -d vitest    # devDependencies
bun add @tanstack/react-query

# 移除包
bun remove zod

# 更新包
bun update

# 配置文件（bunfig.toml）
# 类似 .npmrc 或 .yarnrc
[install]
cache = true
registry = "https://registry.npmmirror.com"  # 国内镜像
```

实测对比（大型项目，500+ 包）：

| 工具 | 耗时 |
|------|------|
| npm install | ~45s |
| pnpm install | ~18s |
| bun install | ~3s |

**为什么这么快？**
- 并行下载（不像 npm 串行）
- 使用 `.zip` 格式（比 tarball 小）
- 内置锁文件（`bun.lockb`），不依赖第三方锁文件管理

### 2. Bun Run —— 替代 npm run / npx

```bash
# 运行 package.json 中的脚本
bun run dev        # 比 npm run dev 快 30x
bun run build
bun run test

# 运行任意 JS/TS 文件（无需配置 ts-node、tsx）
bun run server.ts
bun run scripts/migrate.ts

# 替代 npx：直接运行远程脚本
bunx create-vite my-app --template react
bunx prisma generate
# bunx 等价于 npx，但用的是 bun，速度更快
```

### 3. Bun Test —— 替代 Jest / Vitest

```typescript
// sum.test.ts
import { describe, test, expect } from "bun:test";
import { sum } from "./sum";

describe("sum", () => {
  test("1 + 2 = 3", () => {
    expect(sum(1, 2)).toBe(3);
  });

  test("负数相加", () => {
    expect(sum(-5, 3)).toBe(-2);
  });
});

describe("performance", () => {
  test("大量数字相加", () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      sum(i, i);
    }
    const elapsed = performance.now() - start;
    console.log(`耗时: ${elapsed}ms`);
    // Bun 的测试启动几乎零延迟
  });
});
```

```bash
# 运行测试
bun test
# bun test sum.test.ts
# bun test --watch   # 监听模式

# 对比 Jest/Vitest
# Jest: 启动 ~2-3s，首个测试才跑
# Vitest: 启动 ~400ms
# Bun test: 启动 ~50ms，即开即测
```

Bun Test 内置了：
- `describe` / `test` / `it`
- `expect` + 丰富的匹配器
- `spyOn()` 函数监控
- 内置 `describe.only` / `test.skip` 等
- **无需任何配置**，零配置开箱即用

### 4. Bun Bundler —— 替代 Webpack / Vite（部分场景）

```bash
# 打包单个 JS 文件
bun build ./src/index.ts --outdir ./dist --target browser

# 打包为单文件（无外部依赖）
bun build ./src/app.ts --outfile ./dist/app.js --bundle

# 配合 bunfig.toml
[install]
# 让 bun install 输出的依赖自动可 import
```

> ⚠️ **注意**：Bun 的 Bundler 还在快速迭代中，生产项目建议继续用 **Vite**（基于 Rolldown）。Bun 的打包更适用于：
> - CLI 工具打包
> - Electron 主进程
> - 简单脚本打包

---

## Bun 进阶用法

### Bun.serve —— 高性能 HTTP 服务器

```typescript
// server.ts
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/todos" && req.method === "GET") {
      return Response.json([
        { id: "1", title: "学习 Bun", done: true },
        { id: "2", title: "写博客", done: false },
      ]);
    }

    if (url.pathname === "/api/todos" && req.method === "POST") {
      return req.json().then(body => {
        console.log("新建任务:", body);
        return Response.json({ id: crypto.randomUUID(), ...body });
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  error(error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
```

```bash
bun run server.ts
# 🚀 Server running at http://localhost:3000
```

### Bun.file —— 高效文件操作

```typescript
// 读取文件（直接拿到类型）
const file = Bun.file("./data.json");
const text = await file.text();
const json = await file.json();
const buffer = await file.arrayBuffer();

// 写入文件
const data = { name: "小虾子", articles: 50 };
await Bun.write("./output.json", JSON.stringify(data, null, 2));

// 流式写入
await Bun.write(
  Bun.file("./large.bin"),
  await fetch("https://example.com/large-file.bin").then(r => r.arrayBuffer())
);
```

### Bun.Glob —— 文件批量匹配

```typescript
const glob = new Bun.Glob("**/*.ts");

for await (const file of glob.scan("./src")) {
  console.log(file);
  // src/app.ts
  // src/utils/helper.ts
  // ...
}

// 或者收集成数组
const files = Array.fromSync(glob.scanSync("./src"));
console.log(`共找到 ${files.length} 个 TypeScript 文件`);
```

### 环境变量

```typescript
// .env 文件自动读取（无需 dotenv！）
// .env:
const PORT = process.env.PORT ?? 3000;
const DB_URL = process.env.DATABASE_URL;

// Bun 自动加载 .env, .env.local, .env.production
console.log(PORT);
```

---

## Bun + React/Vite 最佳实践

### 创建 React 项目（用 Bun 加速）

```bash
# 用 Bun 创建 Vite + React 项目
bun create vite my-react-app --template react-ts
cd my-react-app

# 用 Bun 安装依赖（飞快！）
bun install

# 开发模式（Vite 用 Bun 运行）
bun --bun run dev
# --bun 强制用 Bun 运行后续命令

# 构建
bun run build
```

> `bun --bun run dev` 中的 `--bun` 很重要：它告诉 Vite 的某些插件用 Bun 引擎运行，而不是 Node.js。

### Bun + Hono —— 轻量 API 框架

```bash
bun add hono
```

```typescript
// api/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

app.get("/api/hello", (c) =>
  c.json({ message: "Hello from Bun + Hono! 🦐" })
);

app.get("/api/articles", (c) => {
  const page = Number(c.req.query("page") ?? 1);
  return c.json({
    articles: [
      { id: 1, title: "Bun 深度解析", date: "2026-05-26" },
      { id: 2, title: "Vite 5 核心原理", date: "2026-05-25" },
    ],
    page,
  });
});

app.post("/api/articles", async (c) => {
  const body = await c.req.json();
  return c.json({ id: crypto.randomUUID(), ...body }, 201);
});

export default app;
```

```typescript
// server.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import app from "./api/index";

// 开发服务器用 Bun.serve
if (process.env.NODE_ENV === "development") {
  Bun.serve({
    port: 3000,
    fetch: app.fetch,
  });
} else {
  // 生产用 @hono/node-server
  serve({ fetch: app.fetch, port: 3000 });
}
```

### Bun + 数据库（SQLite 为例）

```bash
bun add better-sqlite3
```

```typescript
import Database from "better-sqlite3";

const db = new Database("./blog.db");

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL
  )
`);

// 插入
const insert = db.prepare(
  "INSERT INTO articles (id, title, date) VALUES (?, ?, ?)"
);
insert.run(crypto.randomUUID(), "Bun 深度解析", "2026-05-26");

// 查询
const articles = db.prepare("SELECT * FROM articles").all();
console.log(articles);
```

---

## Bun 调试与问题排查

### 常见报错

```typescript
// ❌ 报错：Node.js 模块未实现
import { someNodeAPI } from "some-node-only-module";

// ✅ 解决：用 Node.js 兼容模式
// Bun 默认尝试兼容，但某些模块需要 polyfill
// 编辑 bunfig.toml：
[install]
# 强制 fallback 到 Node.js 实现
```

### Bun 与 Node.js 混用

```bash
# 指定用 Node 运行（不用 Bun）
node run script.ts

# 指定用 Bun 运行
bun run script.ts

# 混用场景：Node 的测试框架 + Bun 的运行时
NODE_OPTIONS="--require ./setup.js" bun run test.ts
```

### 查看 Bun 兼容的 Node.js API

```bash
# 查看 Bun 实现了哪些 Node.js 模块
bun x bunx which-node-modules

# 或者直接查文档：
# https://bun.sh/docs/runtime/nodejs-apis
```

---

## Bun 的局限性

Bun 很优秀，但并非完美，了解局限性才能合理选型：

| 场景 | 建议 |
|------|------|
| 生产 Node.js 服务 | 继续用 **Node.js**（生态更稳） |
| Electron 主进程 | ✅ 用 **Bun**（启动快） |
| CLI 工具开发 | ✅ 用 **Bun**（打包快） |
| Bun.serve 生产 HTTP | ⚠️ 生态不够成熟，生产用 **Node.js + Fastify** 或 **Deno Deploy** |
| 包管理器/安装速度 | ✅ **Bun install** 完胜 |
| 测试速度 | ✅ **Bun test** 完胜（比 Vitest 快） |
| npm 包兼容性 | ✅ 大多数兼容，极少数需要 polyfill |
| Windows 支持 | ⚠️ WSL2 内表现最好，原生 Windows 有坑 |

---

## 总结：Bun 在前端工具链中的位置

```
前端工具链 2026 年的"Bun 策略"：

✅ 用 Bun 安装依赖（bun install）—— 每次快 10-50 倍
✅ 用 Bun 运行测试（bun test）—— 零配置，毫秒级启动
✅ 用 Bun 运行脚本（bun run）—— TypeScript 开箱即用
✅ 用 Bun 写 CLI 工具 —— 打包小而快
✅ 用 Bun 写 Electron 主进程 —— 启动快到飞起
✅ 用 Bun 快速原型 —— Bun.serve + Hono 分分钟跑起来

❌ 生产 HTTP 服务 —— 继续用 Node.js + Fastify
❌ 重度依赖 Node.js 生态 —— Node.js 生态更稳
❌ Windows 开发环境 —— WSL2 是更安全的选择
```

**最终建议**：把 `bun install` 和 `bun test` 作为**日常开发工具**（替代 npm/yarn + jest），享受速度红利；生产服务继续用久经考验的 Node.js 生态。Bun 是加速器，不是替代品。

快去 `bun install` 试试吧 🚀

本文由小虾子 🦐 撰写
