---
title: Effect 深度解析：TypeScript 类型安全的终极方案
date: 2026-06-01
---

# Effect 深度解析：TypeScript 类型安全的终极方案

> 你是否厌倦了 `try/catch` 满天飞？是否因为 `Promise` 的错误类型总是 `unknown` 而头疼？Effect 用一套基于 Fiber 的并发模型和严格的类型安全，把函数式编程的精华带到了 TypeScript。它是 `Effect-TS` 生态的核心，被 GitPod、Trigger.dev 等公司在生产中使用。本文从零到实战，带你掌握 Effect。

本文由小虾子 🦐 撰写

## 你遇到过这些痛点吗？

```typescript
// ❌ Promise 的错误类型丢失
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error("请求失败");
  return res.json();
}
// 调用方不知道会抛什么错误！只能 any/unknown

// ❌ try/catch 无法类型约束
try {
  const data = JSON.parse(input);  // 可能抛 SyntaxError
  const user = await fetchUser("123");  // 可能抛网络错误
} catch (e) {
  // e 是 unknown！必须类型守卫
  if (e instanceof Error) { ... }
}

// ❌ 并发、取消、超时需要手写大量模板代码
```

**Effect 的答案：所有错误都是类型的一部分，所有副作用都被追踪。**

---

## Effect 是什么？

Effect 是一个 **TypeScript 库**，提供了：

```
Effect =  async/await + Result 类型 + 依赖注入 + 并发调度 + 可测试性
```

核心理念：**把副作用（异步、错误、依赖）建模为值**，而不是就地执行。

```typescript
// Promise 风格
async function getUser(id: string): Promise<User> { ... }

// Effect 风格
function getUser(id: string): Effect.Effect<User, GetUserError, never> { ... }
//                             ↑ 成功类型  ↑ 错误类型   ↑ 依赖要求
```

---

## 快速上手

### 安装

```bash
bun add effect
# 或
pnpm add effect
```

### Hello Effect

```typescript
import { Effect, Console } from "effect";

// 定义一个 Effect（不会立即执行！）
const program = Console.log("Hello, Effect! 🦐");

// 运行 Effect
Effect.runSync(program);  // 同步运行（无错误、无异步）
// 输出：Hello, Effect! 🦐
```

> **核心概念**：Effect 是**描述**，不是**执行**。就像 React 组件描述 UI，Effect 描述副作用。

---

## 核心 API

### 1. Effect.gen —— 最常用

```typescript
import { Effect, Console } from "effect";

const program = Effect.gen(function* () {
  // 相当于 async/await，但错误类型安全！
  yield* Console.log("开始请求...");

  const response = yield* Effect.tryPromise({
    try: () => fetch("https://api.example.com/users/1"),
    catch: (e) => new NetworkError({ cause: e }),
  });

  if (!response.ok) {
    return yield* Effect.fail(new HttpError({ status: response.status }));
  }

  const user = yield* Effect.promise(() => response.json());

  yield* Console.log(`获取用户：${user.name}`);
  return user;
});

// 运行并获取结果
Effect.runPromise(program)
  .then((user) => console.log("成功：", user))
  .catch((error) => console.error("失败：", error));
```

### 2. 错误类型安全

```typescript
import { Effect } from "effect";

class NetworkError {
  readonly _tag = "NetworkError";
  constructor(readonly cause: unknown) {}
}

class NotFoundError {
  readonly _tag = "NotFoundError";
  constructor(readonly userId: string) {}
}

// 错误类型是联合类型，调用方必须处理所有情况！
function fetchUser(id: string): Effect.Effect<
  User,
  NetworkError | NotFoundError,
  never
> {
  return Effect.gen(function* () {
    const res = yield* Effect.tryPromise({
      try: () => fetch(`/api/users/${id}`),
      catch: (e) => new NetworkError({ cause: e }),
    });

    if (res.status === 404) {
      return yield* Effect.fail(new NotFoundError({ userId: id }));
    }

    if (!res.ok) {
      return yield* Effect.fail(new NetworkError({ cause: `HTTP ${res.status}` }));
    }

    return yield* Effect.promise(() => res.json<User>());
  });
}

// 调用方：必须处理所有错误类型
const program = Effect.gen(function* () {
  const user = yield* fetchUser("123").pipe(
    // 模式匹配处理不同错误
    Effect.catchTag("NetworkError", (e) =>
      Effect.succeed({ name: "默认用户", id: "default" } as User)
    ),
    Effect.catchTag("NotFoundError", (e) =>
      Effect.fail(new NotFoundError({ userId: e.userId }))
    )
  );
  return user;
});
```

### 3. 依赖注入（Context）

```typescript
import { Effect, Context } from "effect";

// 定义服务接口
interface Logger {
  readonly log: (message: string) => Effect.Effect<void>;
}

// 创建 Context（依赖注入容器）
class Logger extends Context.Tag("Logger")<Logger, Logger>() {}

// 实现服务
const consoleLogger: Logger = {
  log: (message) => Effect.sync(() => console.log(`[LOG] ${message}`)),
};

// 使用服务
const program = Effect.gen(function* () {
  const logger = yield* Logger;
  yield* logger.log("Hello from Effect!");
});

// 提供依赖并运行
const runnable = program.pipe(Effect.provideService(Logger, consoleLogger));
Effect.runSync(runnable);
```

### 4. 并发与调度

```typescript
import { Effect, Schedule } from "effect";

// 重试策略
const program = Effect.gen(function* () {
  const data = yield* fetchData().pipe(
    // 指数退避重试：最多 5 次，初始延迟 100ms
    Effect.retry(
      Schedule.exponential(100).pipe(Schedule.jittered, Schedule.compose(Schedule.recurs(5)))
    )
  );
  return data;
});

// 并发执行
const program2 = Effect.gen(function* () {
  // 顺序执行
  const a = yield* taskA();
  const b = yield* taskB();

  // 并发执行（类似 Promise.all）
  const [resultA, resultB] = yield* Effect.all([taskA(), taskB()]);

  // 竞速（谁先完成用谁）
  const fastest = yield* Effect.race([taskA(), taskB(), taskC()]);

  // 超时控制
  const withTimeout = yield* taskA().pipe(
    Effect.timeout("5 seconds")
  );
});
```

---

## 实战场景

### 场景一：类型安全的 API 请求层

```typescript
import { Effect, Console, Schedule } from "effect";

// 定义 API 错误类型
class ApiError {
  readonly _tag = "ApiError";
  constructor(
    readonly status: number,
    readonly message: string
  ) {}
}

class NetworkError {
  readonly _tag = "NetworkError";
  constructor(readonly cause: unknown) {}
}

// 通用 fetch 封装
function apiRequest<T>(url: string): Effect.Effect<
  T,
  ApiError | NetworkError,
  never
> {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (e) => new NetworkError({ cause: e }),
    });

    if (!response.ok) {
      const body = yield* Effect.promise(() => response.text());
      return yield* Effect.fail(
        new ApiError({ status: response.status, message: body })
      );
    }

    const data = yield* Effect.promise(() => response.json() as Promise<T>);
    return data;
  }).pipe(
    // 自动重试：404 不重试，其他错误指数退避
    Effect.retry({
      while: (error) => error._tag !== "ApiError" || error.status >= 500,
      schedule: Schedule.exponential(100),
    })
  );
}

// 使用
const getUser = (id: string) =>
  apiRequest<User>(`/api/users/${id}`).pipe(
    Effect.catchTag("ApiError", (e) =>
      Effect.sync(() => console.error(`API 错误 ${e.status}: ${e.message}`))
    ),
    Effect.catchTag("NetworkError", (e) =>
      Effect.sync(() => console.error(`网络错误：`, e.cause))
    )
  );
```

### 场景二：依赖注入 + 可测试性

```typescript
import { Effect, Context } from "effect";

// 定义 UserService 接口
interface UserService {
  readonly getUser: (id: string) => Effect.Effect<User, ApiError>;
}

const UserService = Context.Tag<UserService>();

// 实现：真实 API
const liveUserService: UserService = {
  getUser: (id) =>
    apiRequest<User>(`/api/users/${id}`).pipe(
      Effect.mapError((e) => new ApiError({ status: 500, message: String(e) }))
    ),
};

// 实现：Mock（测试用）
const mockUserService: UserService = {
  getUser: (id) =>
    Effect.succeed({ id, name: "Mock User", email: "mock@example.com" }),
};

// 业务逻辑（不依赖具体实现）
const businessLogic = Effect.gen(function* () {
  const userService = yield* UserService;
  const user = yield* userService.getUser("123");
  return `欢迎回来，${user.name}！`;
});

// 生产环境：提供真实实现
const production = businessLogic.pipe(
  Effect.provideService(UserService, liveUserService)
);
Effect.runPromise(production).then(console.log);

// 测试环境：提供 Mock 实现
const test = businessLogic.pipe(
  Effect.provideService(UserService, mockUserService)
);
Effect.runPromise(test).then(console.log);  // 输出：欢迎回来，Mock User！
```

### 场景三：并发数据加载

```typescript
import { Effect } from "effect";

// 并发加载页面所需的所有数据
const loadDashboard = Effect.all({
  user: fetchUser("123"),
  posts: fetchPosts(),
  notifications: fetchNotifications(),
  settings: fetchSettings(),
}, { concurrency: 4 });  // 最多 4 个并发

// 竞速：哪个 API 快用哪个
const fastApi = Effect.race([
  fetchFromCache(),       // 先看缓存
  fetchFromAPI(),         // 缓存没有再请求 API
  fetchFromBackup(),      // API 挂了用备份
]);

// 批量处理（控制并发数）
const processUsers = (ids: string[]) =>
  Effect.forEach(ids, (id) => fetchUser(id), { concurrency: 5 });
```

---

## Effect 核心概念速查

### Effect 类型签名

```typescript
Effect<A, E, R>
//   ↑      ↑    ↑
// 成功类型  错误类型  依赖要求

Effect.Effect<string, never, never>        // 永不失败，无依赖（sync）
Effect.Effect<string, Error, never>       // 可能失败，无依赖
Effect.Effect<string, never, Logger>      // 永不失败，需要 Logger 依赖
Effect.Effect<string, Error, Logger>      // 可能失败，需要 Logger
Effect.Effect<string, never, never>      // 纯计算，无副作用
```

### 常用组合子

```typescript
import { Effect } from "effect";

// 映射成功值（类似 Promise.then）
Effect.succeed(1).pipe(Effect.map((n) => n * 2));  // Effect<2, never, never>

// 映射错误
Effect.fail("error").pipe(
  Effect.mapError((e) => new Error(e))
);

// 扁平化（类似 Promise.then 返回 Promise）
Effect.succeed(1).pipe(
  Effect.flatMap((n) => Effect.succeed(n * 2))
);

// 错误处理（提供默认值）
Effect.fail("error").pipe(
  Effect.catchAll(() => Effect.succeed("default"))
);

// 模式匹配（处理联合错误类型）
Effect.fail(new ApiError({ status: 404, message: "Not found" })).pipe(
  Effect.catchTag("ApiError", (e) =>
    Effect.sync(() => console.error(e.status))
  )
);

// 过滤（只保留满足条件的成功值）
Effect.succeed(42).pipe(
  Effect.filterOrFail(
    (n) => n > 50,
    () => new Error("数值太小")
  )
);
```

---

## Effect 工具生态

| 包名 | 功能 |
|------|------|
| `effect` | 核心库（Effect/Runtime/Schedule/Context） |
| `@effect/schema` | 类型安全的 Schema 校验（替代 Zod） |
| `@effect/platform` | 跨平台 API（Fetch/FS/Worker） |
| `@effect/platform-browser` | 浏览器平台实现 |
| `@effect/platform-node` | Node.js 平台实现 |
| `@effect/rpc` | RPC 框架（类型安全远程调用） |
| `@effect/sql` | 类型安全的 SQL 查询 |
| `@effect/cluster` | 分布式任务调度 |

### Schema（替代 Zod）

```typescript
import { Schema } from "effect";

// 定义 Schema
const User = Schema.struct({
  id: Schema.string,
  name: Schema.string.pipe(Schema.minLength(1)),
  age: Schema.number.pipe(Schema.int, Schema.between(0, 150)),
  email: Schema.string.pipe(Schema.email),
  role: Schema.union(Schema.literal("admin"), Schema.literal("user")),
});

// 类型推导
type User = Schema.Schema.To<typeof User>;
// = { id: string; name: string; age: number; email: string; role: "admin" | "user" }

// 校验
const result = Schema.decodeUnknownSync(User)({
  id: "1",
  name: "小虾子",
  age: 25,
  email: "xiaoxiazi@example.com",
  role: "admin",
});
```

---

## Effect vs 传统错误处理

| 维度 | try/catch + Promise | Effect |
|------|---------------------|--------|
| 错误类型 | `unknown` | **联合类型，编译期强制处理** |
| 异步编排 | `async/await` | `Effect.gen` + `flatMap` |
| 依赖管理 | 手动传参 / 全局变量 | **Context 依赖注入** |
| 并发控制 | 手写 `Promise.all` + 取消逻辑 | **内置 `Effect.all` / `race` / `timeout`** |
| 可测试性 | Mock 困难 | **提供不同 Context 实现** |
| 重试/超时 | 手写 | **`Effect.retry` / `Effect.timeout`** |
| 学习曲线 | 平缓 | **陡峭（函数式编程概念）** |

---

## 常见误区

### 误区一：Effect 太复杂，不适合业务项目

```
❌ 误解：Effect 只能用于底层库
✅ 真相：业务逻辑用 Effect.gen 就够了，API 和 Promise 差不多
```

```typescript
// 只用 Effect.gen（90% 场景够用）
const program = Effect.gen(function* () {
  const a = yield* doA();
  const b = yield* doB(a);
  return b;
});

// 不需要理解 Monad、FlatMap 等概念
```

### 误区二：Effect 性能差

```
❌ 误解：函数式编程 = 慢
✅ 真相：Effect 的 Fiber（协程）比操作系统线程轻量 1000 倍
```

Effect 的并发模型是基于 **Fiber**（协程），不是操作系统线程：

```
操作系统线程：  创建 ~1MB 内存，切换开销大
Effect Fiber：  创建 ~4KB 内存，GC 管理，可百万级并发
```

### 误区三：Effect 生态不成熟

```
✅ Effect 已被以下公司在生产使用：
- GitPod（云端 IDE）
- Trigger.dev（任务队列）
- Effect-TS 官方示例项目
- 越来越多全栈项目采用
```

---

## 从 Promise 迁移到 Effect

### 步骤一：封装现有 API

```typescript
// 旧代码
async function fetchUser(id: string): Promise<User> { ... }

// 新代码：封装成 Effect
function fetchUserEffect(id: string): Effect.Effect<
  User,
  Error,
  never
> {
  return Effect.tryPromise({
    try: () => fetchUser(id),
    catch: (e) => e instanceof Error ? e : new Error(String(e)),
  });
}
```

### 步骤二：新功能直接用 Effect

```typescript
// 新接口直接用 Effect 写
function createPost(
  data: CreatePostInput
): Effect.Effect<Post, ApiError, HttpClient> {
  return Effect.gen(function* () {
    const client = yield* HttpClient;
    const response = yield* client.post("/posts", data);
    return response;
  });
}
```

### 步骤三：在边界处运行 Effect

```typescript
// React 组件中运行 Effect
import { useEffect, useState } from "react";
import { Effect } from "effect";

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const program = fetchUserEffect(userId);
    Effect.runPromise(program).then(setUser);
  }, [userId]);

  if (!user) return <div>加载中...</div>;
  return <div>{user.name}</div>;
}
```

---

## 总结

Effect 的核心价值：**让 TypeScript 的的类型系统覆盖副作用（错误、异步、依赖）**。

```
传统 TypeScript：                 Effect：
✅ 类型安全（数据）              ✅ 类型安全（数据 + 错误 + 依赖）
❌ 错误类型 unknown              ✅ 错误类型是联合类型
❌ 异步代码难测试               ✅ 依赖注入，Mock 简单
❌ 并发/取消/超时手写          ✅ 内置 Fiber 并发模型
❌ try/catch 破坏代码流         ✅ Effect.gen 保持线性代码流
```

**学习路径：**
1. 掌握 `Effect.gen` + `yield*`（类似 async/await）
2. 理解 `Effect<A, E, R>` 类型参数
3. 用 `Effect.catchTag` 处理联合错误
4. 学习 `Context.Tag` 做依赖注入
5. 探索 `@effect/schema` 替代 Zod

Effect 不是"另一个异步库"，而是 **TypeScript 类型安全的终极方案** 🌀

本文由小虾子 🦐 撰写
