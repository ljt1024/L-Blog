# Redis 深度解析：内存数据库的全场景应用实战

> 在现代分布式系统中，数据存储的选择早已不再是非 SQL 即 NoSQL 的单选题。Redis 以其亚毫秒级的访问延迟、丰富的数据结构支持和强大的发布/订阅机制，成为缓存、Session 管理、消息队列、实时排行榜、限流等场景的首选方案。掌握 Redis，就等于掌握了一把让系统性能提升 10 倍的钥匙。本文从数据结构、持久化、主从复制、集群到实战场景，带你全面掌握这个最流行的内存数据库。

## 一、Redis 核心概念

### 1.1 Redis 是什么

```
┌─────────────────────────────────────────────────────────────────┐
│                      Redis 核心定位                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Redis = Remote Dictionary Server（远程字典服务器）              │
│                                                                 │
│  核心特点：                                                      │
│  ├─ 内存存储：数据存储在内存，读写速度极快（~100K QPS）         │
│  ├─ 数据结构丰富：String、List、Hash、Set、ZSet 等             │
│  ├─ 持久化支持：RDB + AOF，可靠性有保障                         │
│  ├─ 主从复制：读写分离，横向扩展读能力                          │
│  ├─ 集群支持：分片存储，支持海量数据                             │
│  └─ 发布订阅：内置消息队列功能                                   │
│                                                                 │
│  与 Memcached 对比：                                             │
│  ├─ Memcached: 仅 String 类型，无持久化，无集群                 │
│  └─ Redis: 多种数据结构 + 持久化 + 集群 = 功能完整             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据结构全景

```
┌────────────────────────────────────────────────────────────────────┐
│                        Redis 数据结构一览                            │
├──────────────┬───────────────────────────────────┬────────────────┤
│   数据结构     │         底层实现                   │    典型用途     │
├──────────────┼───────────────────────────────────┼────────────────┤
│ STRING        │ SDS（简单动态字符串）             │ 缓存、计数器、  │
│              │                                   │ Session、锁     │
├──────────────┼───────────────────────────────────┼────────────────┤
│ LIST          │ QuickList（压缩列表+双向链表）   │ 消息队列、      │
│              │                                   │ 时间线、最新列表│
├──────────────┼───────────────────────────────────┼────────────────┤
│ HASH          │ ZIPLIST / HT（压缩列表/哈希表）  │ 对象存储、      │
│              │                                   │ 购物车、配置    │
├──────────────┼───────────────────────────────────┼────────────────┤
│ SET           │ INTSET / HT（整数集/哈希表）      │ 标签系统、      │
│              │                                   │ 去重、关注列表  │
├──────────────┼───────────────────────────────────┼────────────────┤
│ ZSET          │ ZIPLIST / SKIPLIST（有序集合）   │ 排行榜、        │
│              │                                   │ 权重排序、延迟队列│
├──────────────┼───────────────────────────────────┼────────────────┤
│ BITMAP        │  String（位操作）                 │ 用户签到、      │
│              │                                   │ 布隆过滤器基础  │
├──────────────┼───────────────────────────────────┼────────────────┤
│ HYPERLOGLOG   │  String（概率数据结构）          │ UV 统计         │
├──────────────┼───────────────────────────────────┼────────────────┤
│ GEOSPATIAL    │ Sorted Set（地理位置）           │ 附近的人/商家   │
├──────────────┼───────────────────────────────────┼────────────────┤
│ STREAM        │ Radix Tree（流式数据）           │ 消息队列、      │
│              │                                   │ 事件流、日志    │
└──────────────┴───────────────────────────────────┴────────────────┘
```

## 二、安装与基础操作

### 2.1 安装与启动

```bash
# macOS
brew install redis
brew services start redis
redis-server /usr/local/etc/redis.conf

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Docker
docker run -d --name redis \
  -p 6379:6379 \
  redis:latest \
  redis-server --appendonly yes

# Docker Compose
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

### 2.2 客户端连接与配置

```bash
# 命令行客户端
redis-cli

# 指定主机和端口
redis-cli -h localhost -p 6379

# 带密码认证
redis-cli -a mypassword

# 选择数据库（0-15，默认16个逻辑库）
redis-cli
> SELECT 0
> PING
PONG

# 配置文件（redis.conf 关键配置）
# redis.conf
bind 127.0.0.1                     # 监听地址
port 6379                           # 端口
protected-mode yes                   # 保护模式
requirepass yourpassword            # 密码认证
databases 16                        # 数据库数量
dir /var/lib/redis                  # 数据目录
dbfilename dump.rdb                # RDB 文件名
appendfilename "appendonly.aof"     # AOF 文件名

# 内存配置
maxmemory 2gb                      # 最大内存（生产必设！）
maxmemory-policy allkeys-lru        # 内存淘汰策略
```

### 2.3 通用命令

```bash
# ===== 连接与状态 =====
PING                    # 测试连接，返回 PONG
ECHO "hello"           # 返回字符串
CLIENT LIST            # 查看所有客户端
CLIENT KILL ID xxx      # 关闭指定客户端
DBSIZE                 # 当前数据库键数量
INFO                   # 服务器详细信息
INFO memory            # 内存使用信息
INFO stats             # 操作统计信息
CONFIG GET maxmemory   # 查看配置项
CONFIG SET maxmemory 1gb  # 动态修改配置

# ===== 键操作 =====
KEYS pattern            # 查找键（生产禁用！用 SCAN）
SCAN 0 MATCH user:* COUNT 100  # 游标遍历键
EXISTS key              # 检查键是否存在
TYPE key                # 查看键的数据类型
DEL key [key2...]       # 删除键（返回删除数量）
UNLINK key              # 异步删除（不阻塞主线程）
RENAME oldkey newkey    # 重命名（覆盖）
RENAMENX oldkey newkey  # 重命名（仅当新键不存在）
EXPIRE key 3600         # 设置过期时间（秒）
EXPIREAT key 1735123456 # 设置过期时间戳
TTL key                 # 查看剩余 TTL（-1=永不过期，-2=不存在）
PTTL key                # 查看剩余 TTL（毫秒）
PERSIST key             # 移除过期时间（永不过期）

# ===== 数据库管理 =====
SELECT db               # 切换数据库
SWAPDB db1 db2          # 交换两个数据库
FLUSHDB                 # 清空当前数据库（危险！）
FLUSHDB ASYNC           # 异步清空（不阻塞）
FLUSHALL                # 清空所有数据库（危险！）
```

## 三、数据结构详解

### 3.1 String（字符串）

String 是 Redis 最基础的数据类型，value 最大 512MB：

```bash
# ===== 基本操作 =====
SET key value                    # 设置值
SET key value NX                 # 仅当键不存在时设置（原子）
SET key value XX                 # 仅当键存在时设置
SET key value EX 3600            # 设置值并指定过期时间（秒）
SET key value PX 3600000         # 设置值并指定过期时间（毫秒）
SET key value GET                # 设置值并返回旧值

GET key                          # 获取值
MGET key1 key2 key3             # 批量获取

# ===== 数值操作（原子递增/递减）=====
SET counter 100
INCR counter                     # +1 → 101
INCRBY counter 5                 # +5 → 106
DECR counter                     # -1 → 105
DECRBY counter 3                 # -3 → 102
INCRBYFLOAT counter 2.5          # +2.5 → 104.5

# ===== 位操作 =====
SETBIT bitmap 100 1               # 设置第100位的值为1
GETBIT bitmap 100                 # 获取第100位的值
BITCOUNT bitmap [start end]     # 统计1的位数（用户签到统计）
BITOP AND result key1 key2       # 位运算（AND/OR/XOR/NOT）
BITPOS bitmap 1 [start byte]    # 查找第一个1的位置

# 场景：用户签到（Bitmap 位图）
# 一年365天，每个用户占365位 ≈ 46字节（vs 365条字符串的 365*40字节）
SETBIT user:1001:2024:08 25 1    # 用户1001在2024年8月26日签到
BITCOUNT user:1001:2024:08        # 8月份签到天数
```

```typescript
// ts/redis-string.ts - String 操作实战

import { createClient, RedisClientType } from 'redis';

const redis: RedisClientType = await createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
}).connect();

// ===== 缓存模式 =====

async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  // 1. 尝试从缓存读取
  const cached = await redis.get(key);
  if (cached) {
    console.log('Cache hit:', key);
    return JSON.parse(cached) as T;
  }

  // 2. 缓存未命中，从数据源获取
  console.log('Cache miss:', key);
  const data = await fetcher();

  // 3. 回填缓存
  await redis.setEx(key, ttlSeconds, JSON.stringify(data));

  return data;
}

// ===== 分布式锁 =====

async function acquireLock(
  lockKey: string,
  ttlMs = 10000
): Promise<string | null> {
  const lockValue = `${Date.now()}-${Math.random()}`;

  // SET NX EX 原子操作（获取锁）
  const acquired = await redis.set(lockKey, lockValue, {
    NX: true,
    PX: ttlMs,
  });

  return acquired === 'OK' ? lockValue : null;
}

async function releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
  // Lua 脚本保证原子性（检查值后才能删除）
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, {
    keys: [lockKey],
    arguments: [lockValue],
  });

  return result === 1;
}

// ===== 计数器（限流）=====

async function rateLimit(
  userId: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;

  const count = await redis.incr(key);
  if (count === 1) {
    // 第一次请求，设置过期时间
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
  };
}

// ===== 分布式信号量 =====

async function acquireSemaphore(
  semKey: string,
  maxCount: number,
  ttlSeconds = 30
): Promise<string | null> {
  const myId = `${Date.now()}-${Math.random()}`;

  // 先移除过期信号量
  const now = Date.now();
  const keys = await redis.zRange(semKey, 0, -1);

  for (const k of keys) {
    const score = await redis.zScore(semKey, k);
    if (score < now) {
      await redis.zRem(semKey, k);
    }
  }

  // 检查当前信号量数量
  const current = await redis.zCard(semKey);
  if (current >= maxCount) {
    return null; // 信号量已满
  }

  // 获取信号量
  await redis.zAdd(semKey, { score: now + ttlSeconds * 1000, value: myId });
  await redis.expire(semKey, ttlSeconds + 10);

  return myId;
}
```

### 3.2 Hash（哈希）

Hash 是字段值对，适合存储对象，比 JSON 字符串更节省空间且支持字段级操作：

```bash
# ===== 基本操作 =====
HSET user:1001 name "Alice" age "28" email "alice@example.com"
HGET user:1001 name                    # 获取单个字段
HMGET user:1001 name email             # 批量获取字段
HGETALL user:1001                      # 获取所有字段值
HLEN user:1001                         # 字段数量

# ===== 字段操作 =====
HEXISTS user:1001 name                 # 检查字段是否存在（1/0）
HDEL user:1001 age                     # 删除字段（返回删除数量）
HINCRBY user:1001 age 1               # 字段递增（原子）
HINCRBYFLOAT user:1001 score 2.5      # 浮点递增

# ===== 游标遍历 =====
HSCAN user:1001 0 MATCH name:* COUNT 100

# ===== 字段级过期（Redis 7.2+）=====
HSET user:1001 last_login "2024-08-25"
HEXPIRE user:1001 last_login 86400    # last_login 字段 24h 后过期
HEXpireAT user:1001 last_login 1735123456
HTTL user:1001 last_login              # 查看字段剩余 TTL
```

```typescript
// ts/redis-hash.ts - Hash 实战

// ===== 用户会话存储 =====
async function saveUserSession(userId: string, sessionData: Record<string, string>) {
  const key = `session:${userId}`;

  // HSET 批量写入
  await redis.hSet(key, sessionData);

  // 设置整个 Hash 的过期时间
  await redis.expire(key, 86400); // 24小时
}

async function updateUserPreference(userId: string, pref: string, value: string) {
  await redis.hSet(`user:pref:${userId}`, pref, value);
}

async function getUserPreferences(userId: string) {
  return await redis.hGetAll(`user:pref:${userId}`);
}

// ===== 购物车 =====

async function addToCart(userId: string, productId: string, quantity: number) {
  const key = `cart:${userId}`;

  if (quantity <= 0) {
    // 数量 <= 0 时移除商品
    await redis.hDel(key, productId);
  } else {
    await redis.hSet(key, productId, quantity.toString());
  }

  // 设置购物车过期时间（30天不活跃则清空）
  await redis.expire(key, 30 * 86400);
}

async function getCart(userId: string) {
  const cart = await redis.hGetAll(`cart:${userId}`);
  return Object.entries(cart).map(([productId, qty]) => ({
    productId,
    quantity: parseInt(qty, 10),
  }));
}

// ===== 实时排行榜元数据 =====
async function updatePlayerScore(playerId: string, score: number, metadata: {
  name: string;
  level: number;
}) {
  const key = 'leaderboard:v1';

  // 更新分数
  await redis.zAdd(key, { score, value: playerId });

  // 单独存储玩家元数据
  await redis.hSet(`player:${playerId}`, {
    name: metadata.name,
    level: metadata.level.toString(),
    score: score.toString(),
    updatedAt: new Date().toISOString(),
  });

  await redis.expire(`player:${playerId}`, 86400 * 7); // 7天过期
}
```

### 3.3 List（列表）

List 是有序字符串列表，支持两端操作，适合消息队列和最新列表：

```bash
# ===== 基本操作 =====
LPUSH tasks "task1"            # 左侧插入（栈）
RPUSH tasks "task2"            # 右侧插入（队列）
LPOP tasks                    # 左侧弹出
RPOP tasks                    # 右侧弹出
LPOP tasks 2                  # 弹出多个（Redis 7.2+）

LRANGE tasks 0 -1             # 获取所有元素（0 -1 表示全部）
LLEN tasks                    # 列表长度

# ===== 范围操作 =====
LTRIM tasks 0 99              # 修剪列表（只保留索引0-99）
LINSERT tasks BEFORE "task1" "new_task"  # 指定位置插入
LSET tasks 0 "new_head"       # 设置指定索引的值

# ===== 阻塞操作（消息队列核心）=====
BLPOP tasks 30                 # 阻塞左弹出（超时30秒）
BRPOP tasks 30                 # 阻塞右弹出
# BLPOP 是 Redis 队列模式的核心——生产者 LPUSH，消费者 BLPOP

# ===== 列表作为队列 =====
LPUSH queue:tasks "task:001"
LPUSH queue:tasks "task:002"
LPUSH queue:tasks "task:003"
BRPOP queue:tasks 0            # 阻塞消费（FIFO）

# ===== 列表作为栈 =====
LPUSH stack:undo "action1"
LPUSH stack:undo "action2"
LPOP stack:undo                # 撤销最近的操作
```

```typescript
// ts/redis-list.ts - List 实战

// ===== 消息队列（可靠队列模式）=====

// 生产者
async function enqueueTask(queue: string, task: Record<string, unknown>) {
  const messageId = `${Date.now()}:${Math.random()}`;
  await redis.lPush(`${queue}:pending`, JSON.stringify({
    id: messageId,
    payload: task,
    enqueuedAt: Date.now(),
  }));

  // 也记录到处理中队列（用于追踪）
  await redis.hSet(`${queue}:tracking`, messageId, JSON.stringify({
    status: 'pending',
    enqueuedAt: Date.now(),
  }));

  return messageId;
}

// 消费者（可靠消费模式）
async function consumeTask(
  queue: string,
  handler: (task: any) => Promise<void>
): Promise<void> {
  const result = await redis.brPop(`${queue}:pending`, 5); // 阻塞5秒

  if (!result) return;

  const queueName = result[0];
  const rawMessage = result[1];

  if (queueName !== `${queue}:pending`) return;

  const message = JSON.parse(rawMessage);

  try {
    await handler(message.payload);

    // 处理成功：移到完成队列
    await redis.lPush(`${queue}:completed`, rawMessage);
    await redis.hSet(`${queue}:tracking`, message.id, JSON.stringify({
      status: 'completed',
      completedAt: Date.now(),
    }));
  } catch (error) {
    // 处理失败：移到重试队列
    await redis.lPush(`${queue}:retry`, rawMessage);
    await redis.hSet(`${queue}:tracking`, message.id, JSON.stringify({
      status: 'retry',
      error: (error as Error).message,
      retriedAt: Date.now(),
    }));
  }
}

// ===== 最新文章列表（时间线）=====

async function publishArticle(article: { id: string; title: string }) {
  const timelineKey = 'timeline:latest';

  // 左侧插入（最新在前）
  await redis.lPush(timelineKey, JSON.stringify({
    id: article.id,
    title: article.title,
    publishedAt: Date.now(),
  }));

  // 只保留最近100条
  await redis.lTrim(timelineKey, 0, 99);

  // 设置过期（1天后自动清理）
  await redis.expire(timelineKey, 86400);
}

async function getLatestArticles(limit = 20) {
  const articles = await redis.lRange('timeline:latest', 0, limit - 1);
  return articles.map(a => JSON.parse(a));
}

// ===== 用户最近搜索历史 =====

async function saveSearchQuery(userId: string, query: string) {
  const key = `search:history:${userId}`;

  // 先去重（移除旧的相同查询）
  const existing = await redis.lPos(key, query);
  if (existing !== null) {
    await redis.lRem(key, 1, query);
  }

  // 左侧插入
  await redis.lPush(key, query);

  // 只保留最近20条
  await redis.lTrim(key, 0, 19);

  // 30天过期
  await redis.expire(key, 30 * 86400);
}

async function getSearchHistory(userId: string, limit = 10) {
  return await redis.lRange(`search:history:${userId}`, 0, limit - 1);
}
```

### 3.4 Set（集合）

Set 是无序不重复字符串集合，适合标签、去重、交集运算：

```bash
# ===== 基本操作 =====
SADD tags:article:1001 "redis" "database" "cache"
SMEMBERS tags:article:1001           # 获取所有成员
SISMEMBER tags:article:1001 "redis" # 检查成员是否存在（1/0）
SCARD tags:article:1001             # 成员数量

SREM tags:article:1001 "cache"      # 删除成员
SPOP tags:article:1001 2            # 随机弹出2个成员
SRANDMEMBER tags:article:1001 3     # 随机获取3个成员（不删除）

# ===== 集合运算 =====
SINTER tags:article:1001 tags:article:1002   # 交集（共同标签）
SUNION tags:article:1001 tags:article:1002   # 并集（所有标签）
SDIFF tags:article:1001 tags:article:1002   # 差集（在1001但不在1002）

SINTERSTORE common_tags tags:article:1001 tags:article:1002  # 交集并存储

# ===== 场景：文章标签 =====
SADD tags:article:1001 "redis" "database" "performance"
SADD tags:article:1002 "redis" "golang" "performance"

SINTER tags:article:1001 tags:article:1002
# 结果: {"redis", "performance"} — 两篇文章的共同标签
```

```typescript
// ts/redis-set.ts - Set 实战

// ===== 文章标签系统 =====

async function addTagToArticle(articleId: string, tag: string) {
  await redis.sAdd(`article:${articleId}:tags`, tag);
}

async function removeTagFromArticle(articleId: string, tag: string) {
  await redis.sRem(`article:${articleId}:tags`, tag);
}

async function getArticleTags(articleId: string) {
  return await redis.sMembers(`article:${articleId}:tags`);
}

async function getArticlesWithAllTags(tags: string[]) {
  // 获取所有标签对应的文章 ID 集合
  const keys = tags.map(tag => `tag:${tag}:articles`);
  return await redis.sInter(...keys);
}

async function getArticlesWithAnyTag(tags: string[]) {
  const keys = tags.map(tag => `tag:${tag}:articles`);
  return await redis.sUnion(...keys);
}

// 标签下所有文章
async function addArticleToTag(tag: string, articleId: string) {
  await redis.sAdd(`tag:${tag}:articles`, articleId);
}

// ===== 用户关注/粉丝系统 =====

async function followUser(followerId: string, followeeId: string) {
  await Promise.all([
    redis.sAdd(`user:${followeeId}:followers`, followerId),
    redis.sAdd(`user:${followerId}:following`, followeeId),
  ]);
}

async function unfollowUser(followerId: string, followeeId: string) {
  await Promise.all([
    redis.sRem(`user:${followeeId}:followers`, followerId),
    redis.sRem(`user:${followerId}:following`, followeeId),
  ]);
}

async function getFollowers(userId: string, page = 0, pageSize = 20) {
  const start = page * pageSize;
  const end = start + pageSize - 1;
  return await redis.sMembers(`user:${userId}:followers`);
}

async function getMutualFollowers(userId1: string, userId2: string) {
  return await redis.sInter(`user:${userId1}:following`, `user:${userId2}:following`);
}

// ===== UV 统计（去重计数）=====

async function recordUniqueView(itemId: string, userId: string) {
  // 使用 SET 去重
  return await redis.sAdd(`views:${itemId}`, userId);
}

async function getUniqueViewCount(itemId: string) {
  return await redis.sCard(`views:${itemId}`);
}
```

### 3.5 ZSet（有序集合）

ZSet 是带分数的有序集合，分数用于排序，支持按分数范围查询：

```bash
# ===== 基本操作 =====
ZADD leaderboard 100 "alice" 200 "bob" 150 "charlie"  # 添加（分数, 成员）
ZSCORE leaderboard "alice"                 # 获取分数
ZRANK leaderboard "alice"                  # 获取排名（从小到大，0起）
ZREVRANK leaderboard "alice"              # 获取排名（从大到小，即时榜）
ZCARD leaderboard                          # 成员数量

ZRANGE leaderboard 0 9 WITHSCORES         # 获取排名0-9（从小到大）
ZREVRANGE leaderboard 0 9 WITHSCORES      # 获取排名前10（从大到小）

ZINCRBY leaderboard 50 "alice"             # 分数递增（+50）

# ===== 分数范围查询 =====
ZRANGEBYSCORE leaderboard 100 200          # 100-200分的成员
ZREVRANGEBYSCORE leaderboard 200 100      # 200-100分的成员（从大到小）
ZRANGEBYSCORE leaderboard -inf +inf WITHSCORES  # 全部成员

# ===== 去重计数（ZSet 版本）=====
ZADD uv:2024:08:25 1 "user:1001"
ZADD uv:2024:08:25 1 "user:1002"
ZADD uv:2024:08:25 1 "user:1001"          # 重复用户，分数+1
ZCARD uv:2024:08:25                       # UV = 2（不同用户数）
```

```typescript
// ts/redis-zset.ts - ZSet 实战

// ===== 实时排行榜 =====

async function updateScore(playerId: string, scoreIncrement: number) {
  await redis.zIncrBy('leaderboard:daily', scoreIncrement, playerId);
}

async function getTopPlayers(limit = 10) {
  const results = await redis.zRangeWithScores('leaderboard:daily', 0, limit - 1, {
    REV: true, // 从大到小
  });

  return results.map((item, index) => ({
    rank: index + 1,
    playerId: item.value,
    score: item.score,
  }));
}

async function getPlayerRank(playerId: string) {
  const rank = await redis.zRevRank('leaderboard:daily', playerId);
  const score = await redis.zScore('leaderboard:daily', playerId);

  return {
    rank: rank !== null ? rank + 1 : null,
    score,
  };
}

async function getPlayersAround(playerId: string, range = 2) {
  const rank = await redis.zRevRank('leaderboard:daily', playerId);
  if (rank === null) return [];

  const start = Math.max(0, rank - range);
  const end = rank + range;

  const results = await redis.zRangeWithScores('leaderboard:daily', start, end, { REV: true });

  return results.map((item, index) => ({
    rank: start + index + 1,
    playerId: item.value,
    score: item.score,
  }));
}

// ===== 时间衰减排行榜（最近N天活跃用户）=====

async function recordDailyActive(userId: string, date: string) {
  const key = `dau:${date}`;
  await redis.zAdd(key, { score: Date.now(), value: userId });
  await redis.expire(key, 8 * 86400); // 保留8天
}

async function getTopActiveUsers(date: string, limit = 10) {
  const results = await redis.zRangeWithScores(`dau:${date}`, 0, limit - 1, {
    REV: true,
  });
  return results;
}

// ===== 延迟队列 =====
async function enqueueDelay(key: string, payload: unknown, delayMs: number) {
  const score = Date.now() + delayMs;
  await redis.zAdd(`delay:${key}`, {
    score,
    value: JSON.stringify(payload),
  });
}

async function processDelayQueue(key: string, processor: (payload: any) => Promise<void>) {
  const now = Date.now();

  // 取出所有已到期的消息
  const messages = await redis.zRangeByScore(`delay:${key}`, 0, now);

  for (const raw of messages) {
    // 从队列移除
    const removed = await redis.zRem(`delay:${key}`, raw);
    if (removed === 1) {
      const payload = JSON.parse(raw);
      await processor(payload);
    }
  }
}

// ===== IP 黑名单（分数=封禁时间戳）=====

async function blockIP(ip: string, durationSeconds: number) {
  const unblockAt = Date.now() + durationSeconds * 1000;
  await redis.zAdd('ip:blacklist', { score: unblockAt, value: ip });
}

async function isIPBlocked(ip: string): Promise<boolean> {
  const score = await redis.zScore('ip:blacklist', ip);
  if (score === null) return false;

  if (score <= Date.now()) {
    // 已过期，自动清理
    await redis.zRem('ip:blacklist', ip);
    return false;
  }

  return true;
}

// 定期清理过期黑名单
async function cleanupExpiredBlocks() {
  await redis.zRemRangeByScore('ip:blacklist', 0, Date.now());
}
```

### 3.6 高级数据类型

```bash
# ===== GEO（地理位置）=====
GEOADD locations 116.4074 39.9042 "beijing"
GEOADD locations 121.4737 31.2304 "shanghai" 120.1536 30.2885 "hangzhou"

GEODIST locations beijing shanghai km        # 两地距离（km/m/ft/mi）
GEOPOS locations beijing                     # 获取坐标
GEORADIUS locations 116 39 100 km WITHDIST ASC COUNT 10  # 附近100km的城市

# ===== HyperLogLog（概率去重计数）=====
PFADD uv:2024:08:25 "user:1001"
PFADD uv:2024:08:25 "user:1002"
PFADD uv:2024:08:25 "user:1001"             # 重复用户，不影响
PFCOUNT uv:2024:08:25                       # 近似UV ≈ 2（标准误差 ≈ 0.81%）
PFMERGE uv:weekly uv:2024:08:25 uv:2024:08:26  # 合并

# ===== Stream（流）=====
XADD orders:stream * item "product:001" qty 1 price 99.9
XADD orders:stream * item "product:002" qty 2 price 49.9
XLEN orders:stream                          # 消息数量
XRANGE orders:stream - +                   # 读取所有消息（- + 表示全部）
XRANGE orders:stream $ +                   # 从当前最大ID读取新消息（阻塞监听）
XREAD STREAMS orders:stream $              # 阻塞读取新消息

# 消费者组（消息队列模式）
XGROUP CREATE orders:stream consumer-group BEGINNING
XREADGROUP GROUP consumer-group worker1 STREAMS orders:stream ">"
# ">" 表示新消息（非历史消息）
XPENDING orders:stream consumer-group        # 待确认消息
XACK orders:stream consumer-group <msg_id> # 确认消息
```

## 四、持久化机制

### 4.1 RDB 与 AOF 对比

```
┌─────────────────────────────────────────────────────────────────┐
│                    Redis 持久化方案对比                            │
├───────────────────────┬──────────────────┬───────────────────────┤
│          特性         │       RDB        │        AOF            │
├───────────────────────┼──────────────────┼───────────────────────┤
│  存储方式             │ 二进制快照文件    │ 命令追加日志          │
│  文件大小             │ 紧凑（小）       │ 较大（需压缩）         │
│  恢复速度             │ 快（二进制直接加载）│ 慢（重放命令）       │
│  数据完整性           │ ❌ 可能有丢失    │ ✅ 取决于刷盘策略     │
│  写入性能             │  fork() 瞬间阻塞│ 不影响主线程          │
│  适用场景             │ 冷备、定期快照   │ 实时持久化            │
├───────────────────────┼──────────────────┼───────────────────────┤
│  优点                 │ 紧凑、恢复快     │ 更安全、append-only   │
│  缺点                 │ 可能丢失最后快照 │ 文件大、重放慢        │
│                      │ 之间的数据        │                      │
└───────────────────────┴──────────────────┴───────────────────────┘
```

### 4.2 配置实战

```bash
# ===== RDB 配置（redis.conf）=====

save 900 1        # 900秒内≥1个key变化 → 触发BGSAVE
save 300 10       # 300秒内≥10个key变化
save 60 10000     # 60秒内≥10000个key变化

stop-writes-on-bgsave-error yes   # BGSAVE失败时停止写入
rdbcompression yes                # 压缩 RDB 文件
rdbchecksum yes                   # 校验 RDB 文件
dbfilename dump.rdb               # 文件名
dir /var/lib/redis                # 存储目录

# ===== AOF 配置 =====
appendonly yes                     # 启用 AOF
appendfilename "appendonly.aof"
appendfsync everysec              # everysec（推荐：每秒刷盘，最多丢1秒）
# appendfsync always               # 每次写入都刷盘（最安全，最慢）
# appendfsync no                   # 由系统决定（最快，最不安全）

auto-aof-rewrite-percentage 100   # 文件比上次大100%时触发重写
auto-aof-rewrite-min-size 64mb    # 文件至少64MB才触发重写
aof-load-truncated yes            # 加载截断的 AOF 文件（不中断启动）
aof-use-rdb-preamble yes          # 混合持久化（RDB+AOF，启动更快）

# ===== 混合持久化（推荐！Redis 4.0+）=====
# RDB 格式开头（快速加载）+ AOF 追加（数据完整）
# AOF 重写时使用 RDB 格式写入开头
# 启动时：先加载 RDB 部分，再重放 AOF 部分
```

```bash
# ===== 手动命令 =====
BGSAVE                           # 后台异步保存（不阻塞主线程）
SAVE                             # 同步保存（阻塞，不推荐）
LASTSAVE                         # 返回上次保存时间戳
BGREWRITEAOF                     # 后台重写 AOF
```

### 4.3 主从复制

```
┌────────────────────────────────────────────────────────────────┐
│                    Redis 主从复制架构                            │
│                                                                │
│   Master                                                       │
│  ┌──────────┐    异步同步    ┌──────────┐    异步同步   ┌─────┐ │
│  │  写操作   │ ──────────▶ │ Slave 1  │ ──────────▶  │ S2  │ │
│  └──────────┘              └──────────┘              └─────┘ │
│       │                          │                            │
│  ┌────┴────┐               ┌─────┴─────┐                     │
│  │ RDB/AOF │               │ 只读副本   │                     │
│  └─────────┘               └───────────┘                     │
│                                                                │
│  故障转移：Sentinel / Cluster 自动选主                         │
└────────────────────────────────────────────────────────────────┘
```

```bash
# ===== 从节点配置（redis.conf）=====
replicaof 127.0.0.1 6379                # 主节点地址
replica-serve-stale-data yes             # 主节点不可用时仍可读取
replica-read-only yes                    # 从节点只读
repl-diskless-sync yes                   # 无盘复制（直接通过网络）
repl-diskless-sync-delay 5               # 无盘复制延迟
repl-ping-replica-period 10              # PING 间隔（秒）
repl-timeout 60                           # 复制超时

# ===== 复制安全 =====
requirepass yourpassword                 # 主节点密码
masterauth yourpassword                  # 从节点连接密码

# ===== 运维命令 =====
INFO replication                         # 查看复制状态
ROLE                                     # 查看节点角色
REPLICAOF no one                         # 取消从属（成为独立节点）
CLIENT SETNAME replica-1                 # 设置客户端名称
```

## 五、主从与哨兵

### 5.1 Redis Sentinel（哨兵）

Sentinel 负责监控主从节点、自动故障转移和客户端配置更新：

```
┌──────────────────────────────────────────────────────────────┐
│                   Redis Sentinel 架构                         │
│                                                              │
│  ┌─────────────┐                                             │
│  │  Sentinel 1  │                                            │
│  │  (Monitor)  │                                             │
│  └──────┬──────┘                                             │
│         │                                                    │
│  ┌──────┴──────┐      ┌────────────┐                         │
│  │ Sentinel 2  │──────│ Sentinel 3  │  （3个Sentinel达成共识）│
│  └─────────────┘      └────────────┘                         │
│                                                              │
│            ▼ 监控 & 故障检测                                  │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Redis Master                           │     │
│  │         (写 + 读/同步)                             │     │
│  └───────────────────┬─────────────────────────────────┘     │
│                      │                                       │
│                      ▼                                       │
│          ┌───────────────────────────┐                       │
│          │    Redis Replica 1        │                      │
│          │    (只读)                 │                      │
│          └───────────────────────────┘                       │
│          ┌───────────────────────────┐                       │
│          │    Redis Replica 2        │                      │
│          │    (只读)                 │                      │
│          └───────────────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

```conf
# sentinel.conf
port 26379
daemonize no
bind 0.0.0.0

# 监控主节点
sentinel monitor mymaster 127.0.0.1 6379 2
# 格式: sentinel monitor <name> <ip> <port> <quorum>
# quorum = 2 表示至少2个Sentinel投票认为主节点下线才触发故障转移

sentinel auth-pass mymaster yourpassword
sentinel down-after-milliseconds mymaster 30000   # 30秒无响应认为主观下线
sentinel parallel-syncs mymaster 1                # 故障转移时同时同步的从节点数
sentinel failover-timeout mymaster 180000         # 故障转移超时（3分钟）
sentinel notification-script mymaster /path/to/notify.sh
sentinel client-reconfig-script mymaster /path/to/reconfig.sh
```

```typescript
// ts/redis-sentinel.ts - Sentinel 客户端

import { createClient, RedisClientType } from 'redis';

const sentinelAddresses = [
  'redis://sentinel1:26379',
  'redis://sentinel2:26379',
  'redis://sentinel3:26379',
];

// Redis 6+ 官方 Sentinel 支持
const redis: RedisClientType = await createClient({
  socket: {
    // DNS SRV 记录自动发现（推荐）
    // 需要在 DNS 配置: _redis-sentinel._tcp.example.com SRV ...
  },
}).connect();

// 手动 Sentinel 路由
async function getMasterClient() {
  // 从 Sentinel 获取主节点地址
  const SENTINEL_PORT = 26379;
  const masterInfo = await fetchFromSentinel(SENTINEL_PORT, 'SENTINEL get-master-addr-by-name mymaster');
  const [host, port] = masterInfo;

  return createClient({ url: `redis://${host}:${port}` });
}

async function fetchFromSentinel(port: number, command: string) {
  const response = await fetch(`http://localhost:${port}/-${command}`);
  return response.text();
}
```

## 六、Redis Cluster

### 6.1 分片集群架构

```
┌──────────────────────────────────────────────────────────────┐
│                   Redis Cluster（6节点分片）                  │
│                                                              │
│        Slot 0-5460          Slot 5461-10922      Slot 10923-16383 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   Node A (M)     │  │   Node B (M)      │  │   Node C (M)     │ │
│  │  192.168.1.1     │  │  192.168.1.3      │  │  192.168.1.5     │ │
│  │  ┌─────────────┐ │  │  ┌─────────────┐ │  │  ┌─────────────┐ │ │
│  │  │ Replica A1  │ │  │  │ Replica B1  │ │  │  │ Replica C1  │ │ │
│  │  │  (从节点)    │ │  │  │  (从节点)    │ │  │  │  (从节点)    │ │ │
│  │  └─────────────┘ │  │  └─────────────┘ │  │  └─────────────┘ │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                              │
│  故障转移：主节点不可用时，从节点自动升级                     │
│  槽迁移：在线重新分配 Slot，数据自动迁移                      │
│  客户端路由：MOVED 重定向（ASK/REDIR）                       │
└──────────────────────────────────────────────────────────────┘
```

```bash
# ===== 创建集群（6节点：3主3从）=====
redis-cli --cluster create \
  192.168.1.1:6379 \
  192.168.1.2:6379 \
  192.168.1.3:6379 \
  192.168.1.4:6379 \
  192.168.1.5:6379 \
  192.168.1.6:6379 \
  --cluster-replicas 1

# ===== 集群命令 =====
redis-cli -c -p 6379                     # 集群模式客户端（-c）
CLUSTER INFO                             # 集群状态信息
CLUSTER NODES                            # 所有节点信息
CLUSTER SLOTS                            # 槽分配信息
CLUSTER KEYSLOT <key>                   # 查看 key 属于哪个槽

# ===== 槽迁移 =====
redis-cli --cluster reshard 192.168.1.1:6379
# 交互式分配槽：源节点 → 目标节点

# ===== 故障转移 =====
CLUSTER FAILOVER                         # 从节点手动触发故障转移
CLUSTER RESET                           # 重置节点集群配置
```

### 6.2 客户端路由策略

```typescript
// ts/redis-cluster.ts - Cluster 客户端

import { createCluster, RedisClusterType } from 'redis';

const cluster: RedisClusterType = await createCluster({
  rootNodes: [
    { url: 'redis://192.168.1.1:6379' },
    { url: 'redis://192.168.1.2:6379' },
    { url: 'redis://192.168.1.3:6379' },
  ],
  defaults: {
    // 每个主节点的从节点配置
    replicas: [{ url: 'redis://192.168.1.4:6379' }],
  },
  useReplicas: true,  // 优先读从节点
});

// ===== 智能路由 =====
await cluster.set('user:1001', JSON.stringify(user));
const value = await cluster.get('user:1001');

// 批量操作（MGET/MSET）
const values = await cluster.mGet(['key1', 'key2', 'key3']);

// 跨节点操作（Lua 脚本自动处理 MOVED）
const script = `
  local result = {}
  for i, key in ipairs(KEYS) do
    table.insert(result, redis.call('GET', key))
  end
  return result
`;
await cluster.eval(script, { keys: ['key1', 'key2', 'key3'], arguments: [] });
```

## 七、实战场景

### 7.1 缓存策略

```typescript
// ts/cache-strategy.ts - 完整缓存策略

// ===== Cache-Aside（旁路缓存，最常用）=====

async function getUser(userId: string): Promise<User | null> {
  const cacheKey = `user:${userId}`;

  // 1. 读缓存
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. 缓存未命中，读数据库
  const user = await db.users.findById(userId);
  if (!user) return null;

  // 3. 写缓存
  await redis.setEx(cacheKey, 3600, JSON.stringify(user));

  return user;
}

async function updateUser(userId: string, data: Partial<User>) {
  // 1. 更新数据库
  const user = await db.users.update(userId, data);

  // 2. 删除缓存（而非更新，防止并发不一致）
  await redis.del(`user:${userId}`);

  return user;
}

// ===== Write-Through（写入穿透）=====

async function saveProduct(product: Product) {
  const cacheKey = `product:${product.id}`;

  await Promise.all([
    db.products.save(product),
    redis.setEx(cacheKey, 1800, JSON.stringify(product)),
  ]);
}

// ===== Write-Behind（异步写入）=====

// 更新时不立即写数据库，放到写入队列
const writeQueue: string[] = [];

async function incrementViewCount(productId: string) {
  // 1. 先更新缓存
  await redis.zIncrBy('product:views:daily', 1, productId);

  // 2. 异步批量写数据库（通过定时任务）
  writeQueue.push(productId);

  if (writeQueue.length >= 100) {
    await flushToDatabase();
  }
}

async function flushToDatabase() {
  const batch = [...new Set(writeQueue.splice(0))];
  await db.batchUpdateViews(batch);
}

// ===== 缓存预热 =====
async function warmUpCache() {
  // 首页数据预热
  const hotProducts = await db.products.findHot({ limit: 100 });
  await Promise.all(hotProducts.map(p =>
    redis.setEx(`product:${p.id}`, 3600, JSON.stringify(p))
  ));

  // 排行榜预热
  const leaderboard = await db.scores.getTop(100);
  await redis.del('leaderboard:daily');
  await redis.zAdd('leaderboard:daily',
    leaderboard.map((p, i) => ({ score: p.score, value: p.playerId }))
  );
}
```

### 7.2 分布式锁详解

```typescript
// ts/distributed-lock.ts - 生产级分布式锁

import { createClient, RedisClientType } from 'redis';

class DistributedLock {
  constructor(private redis: RedisClientType) {}

  // ===== 获取锁 =====
  async acquire(
    resource: string,
    ttlMs = 10000,
    retryCount = 3,
    retryDelayMs = 200
  ): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockValue = `${Date.now()}-${Math.random()}-${process.pid}`;

    for (let i = 0; i < retryCount; i++) {
      // SET NX PX — 原子操作
      const acquired = await this.redis.set(lockKey, lockValue, {
        NX: true,
        PX: ttlMs,
      });

      if (acquired === 'OK') {
        return lockValue;
      }

      // 重试前等待
      if (i < retryCount - 1) {
        await new Promise(r => setTimeout(r, retryDelayMs + Math.random() * 100));
      }
    }

    return null; // 获取锁失败
  }

  // ===== 释放锁（Lua 脚本保证原子性）=====
  async release(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, {
      keys: [lockKey],
      arguments: [lockValue],
    });

    return result === 1;
  }

  // ===== 续期（防止锁提前释放）=====
  async extend(resource: string, lockValue: string, ttlMs: number): Promise<boolean> {
    const lockKey = `lock:${resource}`;

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, {
      keys: [lockKey],
      arguments: [lockValue, ttlMs.toString()],
    });

    return result === 1;
  }

  // ===== 带锁的包装函数 =====
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttlMs = 10000
  ): Promise<T> {
    const lockValue = await this.acquire(resource, ttlMs);
    if (!lockValue) {
      throw new Error(`Failed to acquire lock: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(resource, lockValue);
    }
  }
}

// 使用示例
const lock = new DistributedLock(redis);

async function processPayment(orderId: string) {
  await lock.withLock(`order:${orderId}`, async () => {
    // 幂等处理：检查是否已处理
    const processed = await redis.get(`processed:${orderId}`);
    if (processed) {
      console.log('Order already processed:', orderId);
      return;
    }

    // 执行支付逻辑...
    await doPayment(orderId);

    // 标记已处理
    await redis.setEx(`processed:${orderId}`, 86400, '1');
  }, 30000); // 30秒超时
}
```

### 7.3 实时排行榜系统

```typescript
// ts/leaderboard.ts - 完整排行榜系统

class Leaderboard {
  constructor(private redis: RedisClientType) {}

  // ===== 提交分数 =====
  async submitScore(playerId: string, score: number) {
    await this.redis.zAdd('leaderboard:global', {
      score,
      value: playerId,
    });
  }

  // ===== 获取排名 =====
  async getRank(playerId: string): Promise<number | null> {
    const rank = await this.redis.zRevRank('leaderboard:global', playerId);
    return rank !== null ? rank + 1 : null;
  }

  // ===== 获取 Top N =====
  async getTop(limit = 10): Promise<Array<{ rank: number; playerId: string; score: number }>> {
    const results = await this.redis.zRangeWithScores(
      'leaderboard:global',
      0,
      limit - 1,
      { REV: true }
    );

    return results.map((item, i) => ({
      rank: i + 1,
      playerId: item.value,
      score: item.score,
    }));
  }

  // ===== 获取指定玩家的周边排名 =====
  async getPlayersAround(playerId: string, range = 5) {
    const rank = await this.redis.zRevRank('leaderboard:global', playerId);
    if (rank === null) return null;

    const start = Math.max(0, rank - range);
    const end = rank + range;

    const results = await this.redis.zRangeWithScores(
      'leaderboard:global',
      start,
      end,
      { REV: true }
    );

    return results.map((item, i) => ({
      rank: start + i + 1,
      playerId: item.value,
      score: item.score,
    }));
  }

  // ===== 分数变化通知（Redis 6.2+）=====
  async getScoreChange(playerId: string): Promise<number | null> {
    return await this.redis.zScore('leaderboard:global', playerId);
  }

  // ===== 移除玩家 =====
  async removePlayer(playerId: string) {
    await this.redis.zRem('leaderboard:global', playerId);
  }

  // ===== 清空排行榜 =====
  async reset() {
    await this.redis.del('leaderboard:global');
  }
}

// ===== 多维度排行榜（天/周/月/年）=====

class MultiDimensionalLeaderboard {
  constructor(
    private redis: RedisClientType,
    private leaderboard: Leaderboard
  ) {}

  private getKey(period: 'daily' | 'weekly' | 'monthly' | 'alltime'): string {
    const suffixes = {
      daily: new Date().toISOString().slice(0, 10), // 2024-08-25
      weekly: this.getWeekKey(),
      monthly: new Date().toISOString().slice(0, 7), // 2024-08
      alltime: 'all',
    };
    return `leaderboard:${period}:${suffixes[period]}`;
  }

  private getWeekKey(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }

  async submitScore(playerId: string, score: number, periods = ['daily', 'weekly', 'monthly', 'alltime'] as const) {
    for (const period of periods) {
      const key = this.getKey(period);
      await this.redis.zIncrBy(key, score, playerId);
    }
  }

  async getTop(period: 'daily' | 'weekly' | 'monthly' | 'alltime', limit = 10) {
    const key = this.getKey(period);
    const results = await this.redis.zRangeWithScores(key, 0, limit - 1, { REV: true });
    return results.map((item, i) => ({
      rank: i + 1,
      playerId: item.value,
      score: item.score,
    }));
  }
}
```

### 7.4 限流系统

```typescript
// ts/rate-limiter.ts - 生产级限流器

// ===== 滑动窗口限流（最精确）=====

class SlidingWindowRateLimiter {
  constructor(private redis: RedisClientType) {}

  async isAllowed(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:sliding:${key}`;
    const windowStart = now - windowMs;

    // Lua 脚本：原子操作
    const script = `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ${windowStart})
      local count = redis.call('ZCARD', KEYS[1])
      if count < tonumber(ARGV[1]) then
        redis.call('ZADD', KEYS[1], ARGV[2], ARGV[2])
        redis.call('PEXPIRE', KEYS[1], ARGV[3])
        return {1, ${limit} - count - 1, ${windowMs}}
      else
        local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        local resetAt = 0
        if #oldest > 0 then
          resetAt = tonumber(oldest[2]) + ${windowMs}
        end
        return {0, 0, resetAt}
      end
    `;

    const result = await this.redis.eval(script, {
      keys: [windowKey],
      arguments: [limit.toString(), now.toString(), windowMs.toString()],
    });

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: result[2],
    };
  }
}

// ===== 令牌桶限流（允许突发）=====

class TokenBucketRateLimiter {
  constructor(private redis: RedisClientType) {}

  async consume(
    key: string,
    capacity: number,
    refillRate: number // 每秒补充的令牌数
  ): Promise<{ allowed: boolean; tokensLeft: number }> {
    const script = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or capacity
      local lastRefill = tonumber(bucket[2]) or now

      -- 补充令牌
      local elapsed = now - lastRefill
      local added = math.floor(elapsed * refillRate / 1000)
      tokens = math.min(capacity, tokens + added)
      lastRefill = now

      if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        return {1, tokens}
      else
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        return {0, tokens}
      end
    `;

    const result = await this.redis.eval(script, {
      keys: [`ratelimit:token:${key}`],
      arguments: [
        capacity.toString(),
        refillRate.toString(),
        Date.now().toString(),
      ],
    });

    return {
      allowed: result[0] === 1,
      tokensLeft: result[1],
    };
  }
}

// 使用示例
const slidingLimiter = new SlidingWindowRateLimiter(redis);
const tokenLimiter = new TokenBucketRateLimiter(redis);

async function handleAPIRequest(req: Request) {
  const userId = req.headers.get('X-User-ID') || 'anonymous';
  const ip = req.socket.remoteAddress || 'unknown';

  // 滑动窗口：100次/分钟
  const result = await slidingLimiter.isAllowed(
    `api:${userId}:${ip}`,
    100,
    60000
  );

  if (!result.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
      },
    });
  }

  // 处理请求...
}
```

## 八、安全与监控

### 8.1 安全配置

```bash
# redis.conf 安全配置
bind 127.0.0.1                           # 仅本地访问
protected-mode yes                        # 保护模式（无密码时仅本地连接）
requirepass <strong-password>             # 强密码认证

rename-command FLUSHDB ""                 # 重命名危险命令（空=禁用）
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command SHUTDOWN ""

# 内存限制
maxmemory 4gb                             # 生产必设
maxmemory-policy allkeys-lru              # 内存满时删除最少使用的键

# 慢查询日志
slowlog-log-slower-than 10000            # 记录 >10ms 的命令（微秒）
slowlog-max-len 128                       # 最多保留128条

# 最大客户端连接数
maxclients 10000
```

### 8.2 监控命令

```bash
# ===== 内存分析 =====
INFO memory | grep -E "used_memory_human|peak_memory_human|mem_fragmentation_ratio|instantaneous_ops_per_sec"

# ===== 客户端连接 =====
CLIENT LIST | grep -v "cmd=mclient" | wc -l  # 活跃连接数
CLIENT KILL TYPE normal                     # 关闭普通客户端连接

# ===== 慢查询 =====
SLOWLOG GET 10                             # 最近10条慢查询
SLOWLOG LEN                                # 慢查询队列长度
SLOWLOG RESET                              # 清空慢查询日志

# ===== 持久化状态 =====
INFO persistence | grep -E "rdb_|aof_"

# ===== 复制状态 =====
INFO replication | grep -E "role|connected_slaves|master_repl_offset"

# ===== Keyspace 统计 =====
INFO keyspace
# db0: keys=1000,expires=500,avg_ttl=3600000
```

## 九、Redis 7 新特性与最佳实践

### 9.1 Redis 7 重要新特性

```bash
# ===== 多线程 I/O（Redis 6）=====
# io-threads 4
# io-threads-do-reads yes

# ===== ACL v2（更细粒度权限）=====
ACL SETUSER reader ON >password ~cached:* -@all +get
ACL SETUSER writer ON >password ~* +@write -dangerous

# ===== 函数（Lua 脚本升级）=====
# Redis 7 函数库替代 Lua 脚本，支持更复杂的逻辑

# ===== 集群管理器改进 =====

# ===== Redis Stack（RedisSearch/RedisJSON/RedisGraph/RedisTimeSeries/RedisGears）=====
# RedisSearch: 全文搜索引擎
FT.CREATE idx:posts ON HASH PREFIX 1 "post:" SCHEMA title TEXT WEIGHT 5 body TEXT
FT.SEARCH idx:posts "redis performance"
```

### 9.2 最佳实践总结

```
┌────────────────────────────────────────────────────────────┐
│                Redis 开发与运维最佳实践                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🔑 键设计                                                  │
│  ├─ 格式: 业务:实体:ID[:子属性]                            │
│  │  例: user:1001:profile, order:abc123:items           │
│  ├─ 避免过长的键（消耗内存）                               │
│  ├─ 避免过短的值（语义不清晰）                             │
│  └─ 控制 key 数量（Redis 7+ 支持 2^32 个 key）            │
│                                                            │
│  💾 内存管理                                               │
│  ├─ 设置 maxmemory 并配置淘汰策略                         │
│  ├─ 热点数据缓存（设置合理 TTL）                          │
│  ├─ 生产禁用 KEYS 命令，使用 SCAN 代替                     │
│  └─ 定期监控 used_memory_human 和 mem_fragmentation_ratio │
│                                                            │
│  ⚡ 性能                                                   │
│  ├─ 批量操作用 MGET/MSET/ZMADD，代替循环 GET/SET         │
│  ├─ 管道（Pipeline）批量发送命令，减少 RTT               │
│  ├─ Lua 脚本代替多次往返（原子性 + 性能）                 │
│  └─ 避免大键（>10MB），考虑拆分                           │
│                                                            │
│  🛡️ 安全                                                   │
│  ├─ 生产环境必须设置密码                                   │
│  ├─ 禁止公网暴露                                          │
│  ├─ 重命名危险命令                                        │
│  └─ 使用最小权限用户运行                                  │
│                                                            │
│  🔄 持久化与复制                                           │
│  ├─ 生产推荐：RDB + AOF（everysec）+ 混合持久化           │
│  ├─ 主从异步复制，务必了解可能的数据延迟                   │
│  ├─ 定期备份 RDB 和 AOF 文件                              │
│  └─ 从节点可用于读操作分流                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 十、总结

Redis 远不止一个"缓存"工具——它是一个功能完备的内存数据平台。从 String 的原子计数到 ZSet 的排行榜，从 List 的消息队列到 Stream 的事件流，从 GEO 的地理位置到 HyperLogLog 的海量统计，Redis 用统一的内存存储和极致的性能，覆盖了现代应用开发中几乎所有高性能数据场景。

掌握 Redis 的关键，在于理解它的数据结构选择和数据一致性问题。合理的缓存策略、正确的分布式锁实现、精确的限流算法——这些都需要对 Redis 能力边界有深刻理解。

当你的应用需要亚毫秒级响应、需要处理突发流量、需要实现实时交互时，Redis 就是那把不可或缺的钥匙。

---

*本文由小虾子 🦐 撰写*
