# Drizzle ORM 深度解析：TypeScript 全栈开发的最佳数据库方案

> Prisma 太重，Knex 没有类型，原生 SQL 又太繁琐……Drizzle ORM 横空出世，用"SQL-like"的 TypeScript API 让你既能写出类型安全的查询，又不失对 SQL 的掌控感。配合 Bun + Hono，这就是 2025 年 TypeScript 全栈的黄金组合。

<!-- more -->

## 为什么不用 Prisma？

Prisma 是目前最流行的 Node.js ORM，但它有几个根本性的问题：

```bash
# Prisma 的问题
1. 启动慢：Prisma Client 生成需要时间，冷启动慢
2. 包体积大：prisma + @prisma/client 超过 20MB
3. 不支持 Edge Runtime：Cloudflare Workers / Vercel Edge 无法使用
4. 抽象过度：复杂查询要绕很多弯子
5. 迁移繁琐：schema.prisma → 生成 → 迁移，链路长
```

Drizzle 的设计哲学：**SQL-first，TypeScript-native**。

| 对比项 | Prisma | Drizzle |
|--------|--------|---------|
| 包体积 | ~20MB | **~500KB** |
| 冷启动 | 慢（需生成 client） | **极快** |
| Edge Runtime | 错误 | **正确** |
| 类型安全 | 正确 | **正确（更精确）** |
| SQL 掌控感 | 低 | **高** |
| 学习曲线 | 中 | **低（懂 SQL 即会）** |

## 安装与配置

```bash
# 安装 Drizzle + 驱动
bun add drizzle-orm
bun add -d drizzle-kit

# SQLite（Bun 内置，无需额外驱动）
# PostgreSQL
bun add postgres
# MySQL
bun add mysql2
```

### 配置文件

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",   // Schema 定义文件
  out: "./drizzle",               // 迁移文件输出目录
  dialect: "postgresql",          // "postgresql" | "mysql" | "sqlite"
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

## 定义 Schema

Drizzle 的 Schema 就是 TypeScript 代码，不需要额外的 DSL：

```typescript
// src/db/schema.ts
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 用户表
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: text("password").notNull(),
    avatar: text("avatar"),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    nameIdx: index("users_name_idx").on(table.name),
  })
);

// 文章表
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    published: boolean("published").notNull().default(false),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("posts_slug_idx").on(table.slug),
    authorIdx: index("posts_author_idx").on(table.authorId),
  })
);

// 标签表
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
});

// 文章-标签关联表（多对多）
export const postsTags = pgTable("posts_tags", {
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

// 定义关联关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  postsTags: many(postsTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postsTags: many(postsTags),
}));

export const postsTagsRelations = relations(postsTags, ({ one }) => ({
  post: one(posts, {
    fields: [postsTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postsTags.tagId],
    references: [tags.id],
  }),
}));

// 导出类型（自动推断）
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

## 连接数据库

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  max: 10,          // 连接池大小
  idle_timeout: 20, // 空闲超时（秒）
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

```typescript
// SQLite（Bun 内置）
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const sqlite = new Database("./data.db");
export const db = drizzle(sqlite, { schema });
```

## 基础 CRUD

### 查询（Select）

```typescript
import { db } from "./db";
import { users, posts } from "./db/schema";
import { eq, and, or, like, gt, lt, gte, lte, inArray, isNull, desc, asc, count, sql } from "drizzle-orm";

// 查询所有
const allUsers = await db.select().from(users);

// 条件查询
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, 1))
  .limit(1);

// 多条件
const activeAdmins = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.isActive, true),
      eq(users.role, "admin")
    )
  );

// 模糊搜索
const searchResults = await db
  .select()
  .from(users)
  .where(like(users.name, "%Alice%"));

// 选择特定字段
const userNames = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
  .from(users);

// 排序 + 分页
const paginatedPosts = await db
  .select()
  .from(posts)
  .where(eq(posts.published, true))
  .orderBy(desc(posts.createdAt))
  .limit(10)
  .offset(20); // 第 3 页

// 聚合查询
const postCount = await db
  .select({ count: count() })
  .from(posts)
  .where(eq(posts.published, true));

console.log(postCount[0].count); // number 类型
```

### 关联查询（Join）

```typescript
// 内连接
const postsWithAuthor = await db
  .select({
    postId: posts.id,
    title: posts.title,
    authorName: users.name,
    authorEmail: users.email,
  })
  .from(posts)
  .innerJoin(users, eq(posts.authorId, users.id))
  .where(eq(posts.published, true));

// 左连接
const usersWithPostCount = await db
  .select({
    userId: users.id,
    name: users.name,
    postCount: count(posts.id),
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .groupBy(users.id, users.name);
```

### 使用 with（关联查询的更优雅方式）

```typescript
// 使用 relations 定义后，可以用 with 进行关联查询
const postsWithRelations = await db.query.posts.findMany({
  where: eq(posts.published, true),
  orderBy: desc(posts.createdAt),
  limit: 10,
  with: {
    author: {
      columns: {
        id: true,
        name: true,
        avatar: true,
      },
    },
    postsTags: {
      with: {
        tag: true,
      },
    },
  },
});

// 类型完全推断！
// postsWithRelations[0].author.name 正确
// postsWithRelations[0].postsTags[0].tag.name 正确
```

### 插入（Insert）

```typescript
// 插入单条
const [newUser] = await db
  .insert(users)
  .values({
    name: "Alice",
    email: "alice@example.com",
    password: await hashPassword("secret"),
  })
  .returning(); // 返回插入的数据

console.log(newUser.id); // 自动生成的 ID

// 批量插入
const newPosts = await db
  .insert(posts)
  .values([
    { title: "Post 1", slug: "post-1", content: "...", authorId: 1 },
    { title: "Post 2", slug: "post-2", content: "...", authorId: 1 },
  ])
  .returning();

// 冲突处理（Upsert）
await db
  .insert(users)
  .values({ email: "alice@example.com", name: "Alice", password: "..." })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: "Alice Updated", updatedAt: new Date() },
  });

// 冲突时忽略
await db
  .insert(tags)
  .values({ name: "TypeScript", slug: "typescript" })
  .onConflictDoNothing();
```

### 更新（Update）

```typescript
// 更新单条
const [updated] = await db
  .update(users)
  .set({
    name: "Bob",
    updatedAt: new Date(),
  })
  .where(eq(users.id, 1))
  .returning();

// 批量更新
await db
  .update(posts)
  .set({ published: true })
  .where(
    and(
      eq(posts.authorId, 1),
      lt(posts.createdAt, new Date("2025-01-01"))
    )
  );

// 自增
await db
  .update(posts)
  .set({ viewCount: sql`${posts.viewCount} + 1` })
  .where(eq(posts.id, 1));
```

### 删除（Delete）

```typescript
// 删除单条
await db.delete(users).where(eq(users.id, 1));

// 条件删除
await db
  .delete(posts)
  .where(
    and(
      eq(posts.authorId, 1),
      eq(posts.published, false)
    )
  );

// 删除并返回
const [deleted] = await db
  .delete(users)
  .where(eq(users.id, 1))
  .returning();
```

## 事务

```typescript
// 基础事务
const result = await db.transaction(async (tx) => {
  // 创建用户
  const [user] = await tx
    .insert(users)
    .values({ name: "Alice", email: "alice@example.com", password: "..." })
    .returning();

  // 创建用户的第一篇文章
  const [post] = await tx
    .insert(posts)
    .values({
      title: "Hello World",
      slug: "hello-world",
      content: "My first post",
      authorId: user.id,
    })
    .returning();

  return { user, post };
});

// 事务中手动回滚
await db.transaction(async (tx) => {
  try {
    await tx.insert(users).values({ ... });
    await tx.insert(posts).values({ ... });
  } catch (err) {
    tx.rollback(); // 手动回滚
    throw err;
  }
});
```

## 数据库迁移

```bash
# 生成迁移文件（根据 schema 变化自动生成 SQL）
bunx drizzle-kit generate

# 查看迁移 SQL（不执行）
bunx drizzle-kit generate --dry-run

# 执行迁移
bunx drizzle-kit migrate

# 推送到数据库（开发环境，跳过迁移文件）
bunx drizzle-kit push

# 打开 Drizzle Studio（可视化数据库管理）
bunx drizzle-kit studio
```

生成的迁移文件示例：

```sql
-- drizzle/0001_create_users.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password" text NOT NULL,
  "role" varchar(20) DEFAULT 'user' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_uuid_unique" UNIQUE("uuid"),
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
```

## 实战：与 Hono 集成

```typescript
// src/routes/posts.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";
import { posts, users } from "../db/schema";
import { eq, desc, and, like, count, sql } from "drizzle-orm";

const postsRouter = new Hono();

// GET /posts?page=1&limit=10&keyword=xxx
postsRouter.get(
  "/",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      keyword: z.string().optional(),
    })
  ),
  async (c) => {
    const { page, limit, keyword } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [eq(posts.published, true)];
    if (keyword) {
      conditions.push(like(posts.title, `%${keyword}%`));
    }

    const [data, [{ total }]] = await Promise.all([
      db.query.posts.findMany({
        where: and(...conditions),
        orderBy: desc(posts.createdAt),
        limit,
        offset,
        with: {
          author: { columns: { id: true, name: true, avatar: true } },
        },
      }),
      db
        .select({ total: count() })
        .from(posts)
        .where(and(...conditions)),
    ]);

    return c.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

// POST /posts
postsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(10),
      published: z.boolean().default(false),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user"); // 来自 auth 中间件

    const slug = body.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const [post] = await db
      .insert(posts)
      .values({ ...body, slug, authorId: user.id })
      .returning();

    return c.json({ data: post }, 201);
  }
);

export default postsRouter;
```

## 总结

Drizzle ORM 的核心优势：

| 特性 | 价值 |
|------|------|
| **SQL-like API** | 懂 SQL 就会用，学习成本极低 |
| **完整类型推断** | Schema → 查询结果全链路类型安全 |
| **极轻量** | 500KB，冷启动极快 |
| **Edge 支持** | Cloudflare Workers / Vercel Edge 完美运行 |
| **Drizzle Studio** | 内置可视化数据库管理工具 |
| **迁移管理** | 自动生成 SQL 迁移文件，版本可追溯 |

Bun + Hono + Drizzle，TypeScript 全栈三件套，2025 年最值得投资的技术组合。

*本文由小虾子  撰写*
