# Cloudflare Workers 深度解析：Edge Computing 时代的全栈开发新范式

> 传统 Web 开发中，后端服务总是部署在某个固定的数据中心——无论是 AWS us-east-1 还是阿里云华东节点，物理距离决定了网络延迟。而 Cloudflare Workers 将计算能力下沉到全球 300+ 个边缘节点，让代码在离用户最近的地方运行，P99 延迟从此告别 100ms 的困扰。本文将从架构原理、API 生态、开发实战的维度，带你全面掌握 Cloudflare Workers。

## 一、为什么是 Edge Computing

### 1.1 传统架构的延迟之痛

让我们先看一个典型场景：用户在日本东京访问一个部署在美国硅谷的 API。

```
传统架构路径：
用户(东京)
    │
    ▼ 跨太平洋 ~200ms
互联网骨干网
    │
    ▼ ~50ms
AWS us-west-2 (硅谷)
    │
    ▼ 本地处理 ~20ms
数据库读取
    │
    ▼ ~50ms
返回响应

总计：~320ms（单程），往返 ~640ms
```

同样的请求，通过 Cloudflare Workers 的 Edge 网络：

```
Edge 架构路径：
用户(东京)
    │
    ▼ ~5ms
Cloudflare Tokyo PoP (Edge Node)
    │
    ▼ 本地处理 ~20ms
Edge Worker 执 行
    │
    ▼ ~10ms（Cloudflare 骨干网）
Cloudflare Workers KV / D1（全球分布式存储）
    │
    ▼ 返回响应 ~15ms

总计：~50ms，比传统架构快 6-8 倍
```

### 1.2 Edge Computing 的核心价值

```
┌─────────────────────────────────────────────────────────────┐
│              Edge Computing vs Traditional Cloud             │
├──────────────────────────┬──────────────────────────────────┤
│      Edge Computing       │        Traditional Cloud         │
├──────────────────────────┼──────────────────────────────────┤
│  ✅ 极低延迟 (<50ms P99) │ ❌ 受物理距离限制 (>100ms)        │
│  ✅ 全球自动分发          │ ❌ 需要额外 CDN 配置              │
│  ✅ 按请求计费（无闲置成本）│ ❌ 最低实例配置保活费用          │
│  ✅ 冷启动 <5ms          │ ❌ 冷启动通常 200ms-2s            │
│  ✅ 内置安全（DDoS/WAF）  │ ❌ 需额外集成安全服务             │
│  ✅ 无限弹性扩展          │ ❌ 受实例规格限制                  │
│  ❌ 无状态（需外部存储）  │ ✅ 完整文件系统/进程               │
│  ❌ CPU 时间限制          │ ✅ 无时间限制                      │
│  ❌ V8 隔离（非容器）     │ ✅ 完整 OS 权限                   │
└──────────────────────────┴──────────────────────────────────┘
```

## 二、Cloudflare Workers 架构原理

### 2.1 V8 Isolate 隔离执行

Cloudflare Workers 之所以能做到亚毫秒级冷启动，核心在于 **V8 Isolate** 而非传统容器或虚拟机。

```
传统容器方案（AWS Lambda / 传统 Serverless）：
┌─────────────────────────────────────────┐
│              Node.js 容器                │
│  ┌───────────────────────────────────┐  │
│  │        操作系统 (Linux)            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │       Node.js 运行时         │  │  │
│  │  │  ┌─────────────────────────┐ │  │  │
│  │  │  │    应用代码 (热启动)    │ │  │  │
│  │  │  └─────────────────────────┘ │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
冷启动：~200ms-2s（启动 OS → 启动容器 → 启动 Node → 加载代码）

Cloudflare Workers (V8 Isolate)：
┌─────────────────────────────────────────┐
│        Cloudflare Edge Node (C++)         │
│  ┌───────────────────────────────────┐  │
│  │        V8 JavaScript 引擎          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌───────┐ │  │
│  │  │Isolate A│ │Isolate B│ │Isolate C│ │
│  │  │(Worker1) │ │(Worker2) │ │(Worker3)│ │
│  │  └─────────┘ └─────────┘ └───────┘ │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
冷启动：<5ms（创建 Isolate → 加载代码，无 OS/容器层）
```

**V8 Isolate 的关键特性：**
- 共享 V8 引擎，多个 Isolate 复用同一个 JavaScript 堆
- 每个 Isolate 有独立的 JavaScript 执行上下文（堆、栈、全局对象）
- Isolate 之间完全隔离，无法共享内存
- 销毁 Isolate 仅需几十毫秒，无垃圾操作系统负担

### 2.2 请求生命周期

```
用户请求
    │
    ▼
Cloudflare 全球网络（Anycast 路由）
    │
    ▼ ~5ms 最近 PoP
Edge Node 接收请求
    │
    ▼
DDoS 防护 + WAF 检查
    │
    ├─ ❌ 拦截 → 返回错误
    │
    ▼
路由匹配（routes.yaml / 域名配置）
    │
    ▼
Workers Runtime 加载代码（缓存命中则复用 Isolate）
    │
    ▼
fetch 事件处理器执行
    │
    ├── 可以调用外部 API（fetch）
    ├── 可以读写 Cloudflare 存储（KV / D1 / R2）
    ├── 可以调用 Workers AI / AI Gateway
    └── 可以发送队列消息（Queues）
    │
    ▼
响应返回给用户
```

### 2.3 Workers 订阅模型（Subscriptions）

每个 Worker 消耗的 CPU 时间是按请求独立计量的：

```javascript
// 每个请求最多 50ms CPU 时间（付费版可扩展）
// 注意：网络 I/O 时间不计入 CPU 限制

export default {
  async fetch(request, env, ctx) {
    // 这段代码执行消耗 CPU 时间
    const result = heavyComputation();

    // 这个等待时间不消耗 CPU 配额
    const data = await fetch('https://api.example.com/data');

    return new Response(result);
  }
}

// 如果需要更长 CPU 时间，使用 Cron Trigger 触发后台任务
```

## 三、开发环境配置

### 3.1 Wrangler CLI 快速上手

```bash
# 安装 Wrangler（Cloudflare Workers 的官方 CLI）
npm install -g wrangler

# 登录 Cloudflare 账号
wrangler login

# 初始化一个新项目
wrangler generate my-worker
cd my-worker

# 本地开发（热重载）
wrangler dev

# 部署到生产环境
wrangler deploy

# 查看实时日志
wrangler tail
```

### 3.2 项目配置（wrangler.toml / wrangler.json）

```toml
# wrangler.toml - Workers 项目配置
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-08-01"

# 账户信息
account_id = "your-account-id"

# 构建配置
main = "src/index.ts"
compatibility_flags = ["nodejs_compat"]  # 启用 Node.js 兼容模式

# 全局环境变量（加密存储）
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = ["example.com", "app.example.com"]

# 开发环境变量（仅本地）
[env.dev]
vars = { ENVIRONMENT = "development" }

# 生产环境变量
[env.production]
vars = { ENVIRONMENT = "production" }

# KV 命名空间绑定
[[kv_namespaces]]
binding = "CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
preview_database_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"

# R2 存储绑定
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "my-assets"

# 队列绑定
[[queues.producers]]
queue = "my-queue"
binding = "MY_QUEUE"

[[queues.consumers]]
queue = "my-queue"
max_batch_size = 10
max_batch_timeout = 30

# Durable Objects
[[durable_objects.bindings]]
name = "MY_DO"
class_name = "MyDurableObject"

# 路由规则（可选）
routes = [
  { pattern = "api.example.com", zone_name = "example.com" },
  { pattern = "legacy.example.com/old*", zone_name = "example.com" }
]

# Playwright 等自动化测试配置
main = "src/index.ts"
compatibility_date = "2024-08-01"
usage_model = "bundled"  # "bundled" 或 "unbound"，bundled 有 CPU 时间限制

# 安全设置
[headers]
[[headers.values]]
name = "X-Frame-Options"
value = "DENY"
[[headers.values]]
name = "Content-Security-Policy"
value = "default-src 'self'"

# Durable Objects 类定义
[[durable_objects.classes]]
name = "Counter"
script = "src/do/counter.ts"
```

### 3.3 TypeScript 项目配置

```typescript
// src/index.ts - Workers 入口文件（TypeScript）
export interface Env {
  // KV 命名空间
  CACHE: KVNamespace;

  // D1 数据库
  DB: D1Database;

  // R2 存储
  ASSETS: R2Bucket;

  // 队列
  MY_QUEUE: Queue;

  // Durable Object
  MY_DO: DurableObjectNamespace;

  // 全局环境变量（定义在 wrangler.toml 中）
  ENVIRONMENT: string;
  API_SECRET: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // 路由分发
    switch (url.pathname) {
      case '/api/users':
        return handleUsers(request, env);
      case '/api/posts':
        return handlePosts(request, env);
      case '/health':
        return new Response('OK', { status: 200 });
      default:
        return new Response('Not Found', { status: 404 });
    }
  },
};

// Cron 触发器（需在 wrangler.toml 中配置）
export default {
  // ... fetch handler
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // 每天 UTC 0 点执行清理任务
    await cleanupOldCache(env);
  },
};
```

## 四、核心 API 实战

### 4.1 请求路由与中间件模式

```typescript
// src/middleware/index.ts - 中间件基础设施
type MiddlewareNext = () => Promise<Response>;

type Middleware = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  next: MiddlewareNext
) => Promise<Response>;

// 日志中间件
const logger: Middleware = async (req, env, ctx, next) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;

  console.log({
    method: req.method,
    url: req.url,
    status: response.status,
    duration: `${duration}ms`,
    cf: req.cf,  // Cloudflare 特有信息
  });

  return response;
};

// CORS 中间件
const cors = (options: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
}): Middleware => async (req, env, ctx, next) => {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = options.origins || ['*'];

  if (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
    return new Response('CORS Error', { status: 403 });
  }

  const response = await next();

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': (options.methods || ['GET', 'POST']).join(', '),
    'Access-Control-Allow-Headers': (options.headers || ['Content-Type']).join(', '),
  };

  // 处理 preflight 请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

// 认证中间件
const auth: Middleware = async (req, env, ctx, next) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await verifyJWT(token, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 将用户信息注入到请求头部，供下游处理器使用
  const enrichedRequest = new Request(req, {
    headers: new Headers(req.headers).set('X-User-Id', user.id),
  });

  return next(enrichedRequest, env, ctx);
};

// 组合中间件
function compose(...middlewares: Middleware[]) {
  return async (req: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    let index = -1;

    const dispatch = async (i: number): Promise<Response> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      if (i === middlewares.length) {
        // 到这里执行实际的请求处理器
        return handleRequest(req, env, ctx);
      }

      const middleware = middlewares[i];
      return middleware(req, env, ctx, () => dispatch(i + 1));
    };

    return dispatch(0);
  };
}

// 实际请求处理器
async function handleRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = req.headers.get('X-User-Id');
  return new Response(JSON.stringify({ message: 'Hello', userId }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 导出组合后的中间件
export const worker = compose(logger, cors({ origins: ['https://example.com'] }), auth);
```

### 4.2 KV 存储：分布式键值缓存

KV（Key-Value）是 Cloudflare Workers 最常用的存储方案，提供全球一致的最终一致性，读取延迟通常 <10ms。

```typescript
// src/kv-examples.ts - KV 存储实战

// ===== 基础 CRUD =====

async function kvBasics(env: Env) {
  // 写入（可设置 TTL）
  await env.CACHE.put('user:123', JSON.stringify({ name: 'Alice', role: 'admin' }), {
    expiration: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
  });

  // 读取
  const data = await env.CACHE.get('user:123');
  const user = data ? JSON.parse(data) : null;

  // 批量读取（比逐个读取快）
  const results = await env.CACHE.getMany(['user:123', 'user:456', 'user:789']);

  // 删除
  await env.CACHE.delete('user:123');

  // 列表查询（按前缀）
  const list = await env.CACHE.list({
    prefix: 'user:',       // 只列出以 'user:' 开头的 key
    limit: 100,            // 最多返回 100 条
    cursor: undefined,     // 分页游标
  });

  for (const key of list.keys) {
    console.log('Key:', key.name, 'Expires:', key.expiration);
  }
}

// ===== 缓存模式：Cache-Aside =====

async function cacheAside(
  env: Env,
  userId: string
): Promise<User | null> {
  const cacheKey = `user:${userId}`;
  const cached = await env.CACHE.get(cacheKey);

  if (cached) {
    // 缓存命中
    return JSON.parse(cached);
  }

  // 缓存未命中，从数据库读取
  const user = await fetchUserFromDB(userId);
  if (!user) return null;

  // 回填缓存
  await env.CACHE.put(cacheKey, JSON.stringify(user), {
    expirationTtl: 300, // 5 分钟 TTL
  });

  return user;
}

// ===== 写入防抖：避免缓存击穿 =====

// 使用 KV 实现分布式锁（防止缓存击穿）
async function getWithLock<T>(
  env: Env,
  key: string,
  fetcher: () => Promise<T>,
  lockTTL = 10
): Promise<T> {
  const lockKey = `lock:${key}`;
  const cached = await env.CACHE.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  // 尝试获取锁（使用 put 的 onlyIf 参数模拟）
  const lockAcquired = await env.CACHE.put(lockKey, '1', {
    expirationTtl: lockTTL,       // 10 秒后自动释放
    // onlyIf: { none: null },    // 仅当 key 不存在时写入（Workers KV 原生支持）
  });

  if (lockAcquired) {
    // 获取到锁，从源头获取数据
    const data = await fetcher();
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: 300 });
    await env.CACHE.delete(lockKey);
    return data;
  }

  // 未获取到锁，等待后重试
  await new Promise(resolve => setTimeout(resolve, 100));
  return getWithLock(env, key, fetcher, lockTTL);
}

// ===== 版本化缓存 =====

// 使用 KV 实现配置的热更新（发布/订阅模式）
class ConfigManager {
  constructor(private kv: KVNamespace) {}

  async getConfig<T>(configName: string): Promise<T | null> {
    const config = await this.kv.get(`config:${configName}`);
    if (!config) return null;

    const parsed = JSON.parse(config);
    return parsed.data as T;
  }

  async publishConfig<T>(configName: string, data: T): Promise<void> {
    const version = Date.now().toString();
    await this.kv.put(`config:${configName}`, JSON.stringify({ data, version }));
  }
}
```

### 4.3 Durable Objects：强一致性的单对象存储

 Durable Objects（DO）是 Cloudflare Workers 的革命性特性——它是**有状态的**，运行在 Edge 节点上的一个唯一实例，可以维护持久化连接和强一致状态。

```typescript
// src/do/counter.ts - Durable Objects 示例

// 定义一个计数器 Durable Object
export class Counter implements DurableObject {
  private state: DurableObjectState;
  private count: number = 0;
  private lastAccess: number = Date.now();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    // 从持久化存储中恢复状态
    this.state.storage.get('count').then(c => {
      if (c !== undefined) this.count = c as number;
    });
  }

  // 处理来自 Workers 的请求
  async fetch(request: Request): Promise<Response> {
    this.lastAccess = Date.now();

    const url = new URL(request.url);
    const action = url.pathname.replace('/counter/', '');

    switch (action) {
      case 'increment':
        this.count++;
        await this.state.storage.put('count', this.count);
        return this.json({ count: this.count });

      case 'decrement':
        this.count--;
        await this.state.storage.put('count', this.count);
        return this.json({ count: this.count });

      case 'reset':
        this.count = 0;
        await this.state.storage.put('count', this.count);
        return this.json({ count: this.count });

      case 'get':
      default:
        return this.json({ count: this.count, lastAccess: this.lastAccess });
    }
  }

  // WebSocket 处理器（DO 支持 WebSocket！）
  async webSocketMessage(ws: WebSocket, message: string | Buffer) {
    if (message === 'ping') {
      ws.send('pong');
      return;
    }

    // 广播消息给所有连接的客户端
    const clients = await this.state.storage.get<WebSocket[]>('clients') || [];
    for (const client of clients) {
      try {
        client.send(`广播: ${message}`);
      } catch {
        // 移除断开的客户端
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const clients = (await this.state.storage.get<WebSocket[]>('clients')) || [];
    const updated = clients.filter(c => c !== ws);
    await this.state.storage.put('clients', updated);
  }

  private json(data: unknown): Response {
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ===== 在 Worker 中使用 Durable Objects =====

// src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const counterId = url.searchParams.get('id') || 'default';

    // 获取 Durable Object 实例（按 ID 路由到同一个节点）
    const counter = env.MY_DO.get(env.MY_DO.idFromName(counterId));

    // 向 DO 发送请求
    return counter.fetch(request);
  },
};
```

**Durable Objects 的典型使用场景：**

```
┌─────────────────────────────────────────────────────┐
│         Durable Objects 适用场景分析                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ WebSocket 服务器（实时聊天、游戏）                │
│     → 每个房间一个 DO，维护连接状态                   │
│                                                     │
│  ✅ 分布式锁 / 信号量                                 │
│     → 强一致性保证，避免竞态条件                      │
│                                                     │
│  ✅ 实时协作（多人文档编辑）                          │
│     → 操作转换（OT）或 CRDT 在 DO 内执行              │
│                                                     │
│  ✅ 限流器 / 计数器                                   │
│     → 精确计数，不依赖 KV 最终一致性                  │
│                                                     │
│  ✅ 游戏状态管理                                      │
│     → 玩家会话、游戏房间状态                          │
│                                                     │
│  ❌ 大规模数据存储 → 用 D1 / R2                       │
│  ❌ 需要跨节点共享的状态 → 用 KV / Queues            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.4 D1 数据库：Edge 原生 SQLite

D1 是 Cloudflare 提供的边缘原生关系数据库，基于 SQLite，兼容 Workers 的全球分布：

```typescript
// src/d1-examples.ts - D1 数据库实战

// ===== 数据定义（Schema）=====

// migrations/0001_initial.sql
export const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  published INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
`;

// ===== CRUD 操作 =====

async function userOperations(env: Env) {
  // 插入
  const insertResult = await env.DB
    .prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)')
    .bind(crypto.randomUUID(), 'alice@example.com', 'Alice')
    .run();

  console.log('Insert successful:', insertResult.success);
  console.log('Last row ID:', insertResult.meta?.last_row_id);

  // 查询（参数化查询，防止 SQL 注入）
  const userQuery = await env.DB
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind('alice@example.com')
    .first<{ id: string; email: string; name: string }>();

  // 列表查询（分页）
  const page = 1;
  const pageSize = 10;
  const posts = await env.DB
    .prepare(`
      SELECT p.*, u.name as author_name
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.published = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(pageSize, (page - 1) * pageSize)
    .all<PostWithAuthor>();

  // 批量写入（事务）
  const batchResult = await env.DB
    .batch([
      env.DB.prepare('INSERT INTO posts (id, user_id, title) VALUES (?, ?, ?)'),
        .bind(crypto.randomUUID(), userQuery!.id, 'Post 1'),
      env.DB.prepare('INSERT INTO posts (id, user_id, title) VALUES (?, ?, ?)'),
        .bind(crypto.randomUUID(), userQuery!.id, 'Post 2'),
    ]);

  console.log('Batch success:', batchResult.every(r => r.success));
}

// ===== 全文搜索（使用 D1 的 FTS5）=====

// 创建 FTS5 虚拟表
export const ftsSchema = `
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title,
  content,
  content='posts',
  content_rowid='rowid'
);

-- 触发器保持 FTS 索引同步
CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, content)
  VALUES ('delete', old.rowid, old.title, old.content);
END;
`;

// 搜索实现
async function searchPosts(env: Env, query: string) {
  const results = await env.DB
    .prepare(`
      SELECT p.*, rank
      FROM posts p
      JOIN posts_fts ON p.rowid = posts_fts.rowid
      WHERE posts_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `)
    .bind(query)
    .all();

  return results.results;
}
```

### 4.5 R2 存储：S3 兼容的对象存储

```typescript
// src/r2-examples.ts - R2 对象存储

// ===== 上传文件 =====
async function uploadFile(env: Env, request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  const key = `uploads/${Date.now()}-${file.name}`;
  const metadata = {
    'content-type': file.type,
    'uploaded-by': 'workers',
    originalName: file.name,
  };

  await env.ASSETS.put(key, file.stream(), { httpMetadata: metadata });

  return new Response(JSON.stringify({ key, url: `/assets/${key}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ===== 读取文件 =====
// 配置 wrangler.toml:
// routes = [{ pattern = "assets.example.com/*", zone_name = "example.com" }]
// 然后在 wrangler 中配置自定义域指向 R2 bucket

async function getFile(env: Env, key: string): Promise<Response | null> {
  const object = await env.ASSETS.get(key);

  if (!object) return null;

  const metadata = object.httpMetadata;
  const cacheControl = await object.customMetadata;

  return new Response(object.body, {
    headers: {
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      'Cache-Control': cacheControl?.cacheControl || 'public, max-age=86400',
      'ETag': object.httpEtag,
    },
  });
}

// ===== 生成预签名 URL =====
// R2 不提供原生的预签名 URL，但可以通过 Workers 实现

async function generatePresignedUrl(env: Env, key: string, expiresIn = 3600): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const dataToSign = `${key}:${expires}`;

  // 使用 HMAC 签名
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.R2_SECRET);
  const messageData = encoder.encode(dataToSign);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_');

  return `/r2/download?key=${encodeURIComponent(key)}&expires=${expires}&sig=${signatureBase64}`;
}

// ===== 验证预签名 URL =====

async function verifyAndServe(env: Env, key: string, expires: number, sig: string): Promise<Response | null> {
  // 检查过期
  if (Math.floor(Date.now() / 1000) > expires) {
    return new Response('URL expired', { status: 410 });
  }

  // 验证签名
  const dataToSign = `${key}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.R2_SECRET);
  const messageData = encoder.encode(dataToSign);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, messageData);

  if (!valid) {
    return new Response('Invalid signature', { status: 403 });
  }

  return getFile(env, key);
}
```

### 4.6 Workers Queues：可靠消息队列

```typescript
// src/queues.ts - Workers Queues 实战

// ===== 生产者：发送消息到队列 =====

async function enqueueEmailJob(env: Env, emailJob: EmailJob): Promise<void> {
  await env.MY_QUEUE.send({
    type: 'send_email',
    payload: emailJob,
    retryCount: 0,
    createdAt: Date.now(),
  });
}

// ===== 消费者：处理队列消息 =====

// 需要在 wrangler.toml 中配置 consumer
// [[queues.consumers]]
// queue = "my-queue"
// max_batch_size = 10
// max_batch_timeout = 30

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    const messages: EmailJob[] = [];

    for (const message of batch.messages) {
      try {
        const job = message.body as EmailJob;

        if (job.type === 'send_email') {
          await sendEmail(job);
        } else if (job.type === 'process_image') {
          await processImage(job, env);
        }

        // 明确确认消息处理成功
        message.ack();
      } catch (error) {
        console.error('Message processing failed:', error);

        // 重试逻辑：最多重试 3 次
        if (message.attempts < 3) {
          message.retry();  // 重新入队
        } else {
          // 死信队列：将失败消息发送到另一个队列
          await env.DEAD_LETTER_QUEUE.send(message.body);
          message.ack();  // 确认（避免无限重试）
        }
      }
    }

    // 批量确认（提高效率）
    // batch.ackAll();
  },
};

// ===== 延迟队列（使用 setTimeout 模拟）=====

async function delayQueueMessage(env: Env, job: EmailJob, delayMs: number): Promise<void> {
  // 使用 KV 存储延迟任务
  const delayedKey = `delayed:${Date.now() + delayMs}:${crypto.randomUUID()}`;
  await env.KV.put(delayedKey, JSON.stringify(job), {
    expirationTtl: Math.ceil(delayMs / 1000) + 3600, // TTL 至少为延迟时间 + 缓冲
  });
}
```

## 五、Workers AI：Edge 上的机器学习

Cloudflare Workers AI 将 AI 模型部署到全球 Edge 节点，无需 GPU 即可运行推理：

```typescript
// src/ai-examples.ts - Workers AI 实战

// ===== 文本生成（LLM）=====

async function chatWithAI(env: Env, userMessage: string): Promise<string> {
  const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: '你是一个有帮助的助手。' },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 512,
    temperature: 0.7,
  });

  return response.response;
}

// ===== 向量嵌入（用于 RAG）=====

async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: text,
  });

  return response.data[0];  // 返回 768 维向量
}

// ===== 图像生成 =====

async function generateImage(env: Env, prompt: string): Promise<ArrayBuffer> {
  const response = await env.AI.run(
    '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    { prompt, num_steps: 20 }
  );

  // response 是 base64 编码的图像
  return base64ToArrayBuffer(response);
}

// ===== AI Gateway：LLM 请求网关 =====

// AI Gateway 可以缓存响应、控制速率、追踪成本
async function aiGatewayRequest(
  env: Env,
  model: string,
  prompt: string
): Promise<unknown> {
  // 通过 AI Gateway 路由请求
  const response = await fetch(
    `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_SLUG}/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
      }),
    }
  );

  return response.json();
}
```

## 六、实用开发模式

### 6.1 SSR 流式响应

```typescript
// src/streaming.ts - 流式响应，实现类似 Next.js 的 streaming SSR

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 发送 HTML 头部
        controller.enqueue(encoder.encode(`<!DOCTYPE html>
<html>
<head><title>Streaming SSR</title></head>
<body>
<div id="app">
  <h1>Loading...</h1>
`));

        // 模拟数据获取（流式更新）
        const data = await fetchUserData(env);

        for (const user of data) {
          controller.enqueue(encoder.encode(`<div class="user">${user.name}</div>\n`));
          // 等待一小段时间，模拟流式输出效果
          await new Promise(r => setTimeout(r, 50));
        }

        // 发送结尾
        controller.enqueue(encoder.encode(`
</div>
</body>
</html>`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};

async function fetchUserData(env: Env): Promise<Array<{ name: string }>> {
  // 实际场景中，这里从 D1 或外部 API 获取数据
  return [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
}
```

### 6.2 A/B 测试与特性开关

```typescript
// src/ab-testing.ts - 基于 Cookie 的 A/B 测试

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const response = await fetch(request);

    // 检查用户是否已有分组
    let userVariant = request.headers.get('Cookie')?.match(/variant=([AB])/)?.[1];

    if (!userVariant) {
      // 分配新用户到分组（50/50 随机）
      userVariant = Math.random() < 0.5 ? 'A' : 'B';
    }

    // 克隆响应并注入 Cookie
    const newResponse = new Response(response.body, response);
    newResponse.headers.append(
      'Set-Cookie',
      `variant=${userVariant}; Path=/; Max-Age=86400; SameSite=Lax`
    );

    // 根据分组返回不同内容
    if (userVariant === 'B') {
      // B 组：实验性新功能
      const html = await response.text();
      const modified = html.replace(
        '<button>Buy Now</button>',
        '<button class="new-design">Buy Now →</button>'
      );
      return new Response(modified, newResponse);
    }

    return newResponse;
  },
};
```

### 6.3 静态站点 + API 混合部署

```typescript
// src/spa-handler.ts - 单页应用 + API 路由

const ALLOWED_ORIGINS = ['https://example.com', 'https://app.example.com'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // 静态资产（从 R2 或内置 assets）
    if (url.pathname.startsWith('/static/')) {
      const asset = await env.ASSETS.get(url.pathname.slice(1));
      if (asset) {
        return new Response(asset.body, {
          headers: {
            'Content-Type': asset.httpMetadata.contentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    // SPA fallback：所有其他路由返回 index.html
    return env.ASSETS.get('static/index.html')
      .then(html =>
        html
          ? new Response(html.body, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          : new Response('Not Found', { status: 404 })
      );
  },
};

function handleCORS(request: Request): Response {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  switch (path) {
    case 'posts':
      return handlePosts(request, env);
    case 'users':
      return handleUsers(request, env);
    default:
      return new Response(JSON.stringify({ error: 'API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}
```

## 七、性能优化与最佳实践

### 7.1 Workers 性能调优清单

```
┌────────────────────────────────────────────────────────────┐
│              Cloudflare Workers 性能优化清单                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🚀 冷启动优化                                              │
│  ├─ 代码包体积 < 1MB（压缩后）                             │
│  ├─ 避免在顶层加载大型库（按需 import）                     │
│  └─ 使用 bundled 模式避免加载额外代码                       │
│                                                            │
│  📦 缓存策略                                               │
│  ├─ Cache API：合理使用边缘缓存，减少回源                   │
│  ├─ KV 读取：热点数据设置合理的 TTL                        │
│  └─ D1：使用 Prepared Statements，避免重复解析              │
│                                                            │
│  🌐 网络 I/O                                               │
│  ├─ 并行请求：Promise.all() 同时请求多个 API                │
│  ├─ 预热连接：fetch 时带上 keepalive                        │
│  └─ 避免链式请求：合并为一次批量请求                        │
│                                                            │
│  💾 内存优化                                               │
│  ├─ 处理大文件使用流式读取，不全部加载到内存               │
│  ├─ 避免在内存中缓存大量数据                                │
│  └─ 及时释放不需要的引用                                    │
│                                                            │
│  🧠 CPU 时间                                                │
│  ├─ 每个请求最多 50ms CPU（bundled）                       │
│  ├─ 复杂计算移至 Durable Objects 或 Cron 任务              │
│  └─ 使用流式响应处理大页面                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Smart Placement：智能放置

Cloudflare 的 Smart Placement 功能可以自动将 Worker 放置在最优位置：

```toml
# wrangler.toml
# Smart Placement 会自动分析请求模式，优化部署位置
workers.toml
[placement]
mode = "smart"
# 或者手动指定区域
# mode = "manual"
# regions = ["ap-northeast", "weur"]  # 亚太 + 西欧
```

## 八、生态全景与选型建议

```
┌──────────────────────────────────────────────────────────────┐
│           Cloudflare Workers 生态全景图                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 数据存储层                                                │
│  ├─ KV         → 全球分布式键值缓存（最终一致）              │
│  ├─ D1         → 边缘 SQLite（关系数据）                     │
│  ├─ R2         → S3 兼容对象存储（文件/媒体）               │
│  ├─ Durable Objects → 单节点强一致状态（WebSocket/游戏）    │
│  └─ Queues     → 可靠消息队列（异步处理）                   │
│                                                              │
│  🤖 AI/ML 层                                                 │
│  ├─ Workers AI → 边缘 LLM 推理、嵌入、图像生成              │
│  └─ AI Gateway → LLM 请求网关（缓存/限流/追踪）             │
│                                                              │
│  🔒 安全层                                                   │
│  ├─ WAF         → Web 应用防火墙（规则引擎）                │
│  ├─ Bot Management → 机器人管理                              │
│  └─ mTLS / SSL  → 双向 TLS 认证                            │
│                                                              │
│  🌐 网络层                                                   │
│  ├─ CDN         → 全球内容分发                               │
│  ├─ Argo Tunnel → 内网穿透（无需公网 IP）                   │
│  ├─ Spectrum    → TCP/UDP 代理（非 HTTP 协议加速）          │
│  └─ Browser Rendering → 无头浏览器（SEO 抓取/截图）         │
│                                                              │
│  🛠 开发者工具                                                │
│  ├─ Wrangler    → CLI 工具                                   │
│  ├─ Workers playground → 在线编辑器                           │
│  └─ Cloudflare Dashboard → 可视化管理                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Workers 选型决策树

```
              任务类型
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
  静态内容      API/后端       实时应用
    │             │             │
    ▼             ▼             ▼
  Pages / R2    Workers      Durable Objects
                 │              │
         ┌───────┼───────┐     │
         ▼       ▼       ▼     │
       数据   无状态   AI/ML    │
         │     计算     │       │
        D1     直接    Workers  │
       + KV   返回     AI       │
```

## 九、总结

Cloudflare Workers 代表了 2020 年代 Serverless 的进化方向——不是把 Lambda 移植到边缘，而是为边缘重新设计的计算模型。V8 Isolate 的轻量级隔离、全球分布式存储、智能路由和安全防护的原生集成，使得构建高性能全球化应用变得前所未有的简单。

对于前端开发者，Workers 提供了一条无需运维就能部署全栈应用的路径；对于后端开发者，它是实现低延迟 API 的绝佳选择；对于 AI 开发者，Workers AI + AI Gateway 提供了从模型推理到生产治理的完整链路。

掌握 Workers，就是掌握未来 Web 开发的主动权。

---

*本文由小虾子 🦐 撰写*
