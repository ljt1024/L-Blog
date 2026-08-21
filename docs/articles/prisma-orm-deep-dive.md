# Prisma ORM 深度解析：TypeScript 生态最声明式的数据库 ORM 方案

> 在 TypeScript 全栈开发中，数据层的抽象方式直接影响开发体验和代码质量。Drizzle ORM 以"贴近 SQL"的风格赢得了一批拥趸，而 Prisma 则选择了另一条路——声明式 Schema、链式查询 API 和零成本的类型推断。本文将从 Prisma Schema 设计、CRUD 操作、关系处理、性能优化和 Prisma 5 新特性的维度，带你全面掌握这个生态最成熟的 TypeScript ORM。

## 一、为什么选择 Prisma

### 1.1 ORM 选型三足鼎立

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TypeScript ORM 生态三强对比                        │
├──────────────────────────┬──────────────────┬────────────────────────┤
│         Prisma           │      Drizzle     │      TypeORM           │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  设计哲学                │                  │                        │
│  声明式 Schema + 生成    │ SQL-like 查询    │ 经典 Active Record     │
│  类型安全的自动补全      │                  │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  Schema 定义             │                  │                        │
│  高度声明式，接近数据    │ 贴近 SQL，       │ 装饰器/类混合          │
│  模型而非表结构          │ 熟悉 SQL 者友好  │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  类型安全                │                  │                        │
│  ⭐⭐⭐⭐⭐ 极致       │ ⭐⭐⭐⭐ 优秀    │ ⭐⭐⭐ 一般            │
│  从 Schema 到 Client     │ 编译期检查       │ 运行时部分类型         │
│  全链路类型推导          │                  │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  数据库支持              │                  │                        │
│  PostgreSQL, MySQL,     │ PostgreSQL,      │ 15+ 数据库             │
│  SQLite, MongoDB,       │ MySQL, SQLite    │                        │
│  CockroachDB, SQL Server│                  │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  迁移系统                │                  │                        │
│  Prisma Migrate         │ 迁移 SQL          │ TypeORM Migrations     │
│  声明式迁移，版本化      │ 手动 SQL 迁移    │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  性能                    │                  │                        │
│  中等（生成代码需优化） │ ⭐⭐⭐⭐⭐ 最优   │ 较好                    │
│  Prisma Client 成熟稳定  │ 贴近 SQL，       │ N+1 需手动处理         │
│                          │ 无额外开销        │                        │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  学习曲线                │                  │                        │
│  ⭐⭐ 友好              │ ⭐⭐⭐ 中等     │ ⭐⭐⭐⭐ 陡峭         │
│  文档优秀，上手快       │ 需了解 SQL       │ 概念多，配置繁琐       │
├──────────────────────────┼──────────────────┼────────────────────────┤
│  适用场景                │                  │                        │
│  TypeScript 全栈、       │ 高性能需求、     │ 复杂业务逻辑、         │
│  快速开发、类型强迫症    │ SQL 优先团队     │ 多数据库兼容           │
└──────────────────────────┴──────────────────┴────────────────────────┘
```

### 1.2 Prisma 的核心价值

Prisma 解决三个核心问题：

```txt
┌─────────────────────────────────────────────────────────────────────┐
│                         Prisma 的核心价值                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 类型安全的数据访问                                               │
│     Schema → Prisma Client → 自动补全 → 零运行时错误                 │
│                                                                     │
│  2. 声明式的数据建模                                                │
│     用接近业务模型的语言描述数据，而非 SQL 表结构                     │
│                                                                     │
│  3. 统一的开发工作流                                                │
│     Schema → Migration → Client → Studio，从设计到数据一站式         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 二、Prisma Schema 设计与进阶用法

### 2.1 Schema 基础结构

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  // 输出类型定义文件的位置
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===== 数据模型定义 =====

model User {
  id        String   @id @default(cuid())  // 全局唯一 ID
  email     String   @unique               // 唯一索引
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())       // 自动时间戳
  updatedAt DateTime @updatedAt

  // 关联关系
  posts     Post[]
  profile   Profile?

  // 复合唯一约束
  @@unique([email, provider])

  // 普通索引
  @@index([email])
  @@index([createdAt])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 关联关系（外键）
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // 多对多关系（自动生成中间表）
  categories Category[]
}

model Profile {
  id     String @id @default(cuid())
  bio    String?
  avatar String?
  userId String @unique  // 一对一关系

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Category {
  id    String @id @default(cuid())
  name  String @unique
  slug  String @unique

  posts Post[]
}

// ===== 枚举类型 =====
enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### 2.2 字段进阶配置

```prisma
// ===== 字段类型详解 =====

model AdvancedExample {
  // String 字段
  email    String   @db.VarChar(255)           // 指定数据库类型
  token    String   @db.Text                   // 长文本
  slug     String   @unique                    // 隐式索引
  code     String   @default(uuid())           // 默认值表达式

  // 数值字段
  age      Int      @db.SmallInt               // 小整数
  price    Decimal  @db.Decimal(10, 2)         // 精确小数
  ratio    Float                               // 浮点数
  views    BigInt   @default(0)                // 大整数

  // 时间字段
  created  DateTime @default(now())            // 默认当前时间
  updated  DateTime @updatedAt                 // 自动更新
  deleted  DateTime?                           // 可空字段，软删除
  schedule DateTime @db.Timestamptz            // 时区感知时间戳

  // 布尔与枚举
  isActive Boolean   @default(true)
  status   Status    @default(PENDING)

  // 关系字段（自动创建外键）
  // posts     Post[]    // 一对多
  // profile   Profile?  // 一对一（可选端）

  // Json 字段（PostgreSQL）
  metadata Json      @default("{}")
  tags     String[]  @default([])              // 数组字段

  // 复合类型（PostgreSQL）
  location Unsupported("geography(Point, 4326)")
}

// ===== 默认值与自动生成 =====

model GeneratorExamples {
  // CUID：全球唯一 ID（默认）
  id1 String @id @default(cuid())

  // UUID：标准 UUID
  id2 String @id @default(uuid())

  // 数据库自增
  id3 Int    @id @default(autoincrement())

  // 时间戳
  ts1 DateTime @default(now())
  ts2 DateTime @default(dbgenerated("NOW()"))  // 数据库函数

  // 序列（PostgreSQL）
  id4 Int @id @default(autoincrement())

  // 静态默认值
  name String @default("Anonymous")
  flag Boolean @default(true)
}
```

### 2.3 关系建模深度指南

```prisma
// ===== 一对多关系 =====
model Author {
  id    String @id @default(cuid())
  name  String
  books Book[]
}

model Book {
  id       String @id @default(cuid())
  title    String
  authorId String
  author   Author @relation(fields: [authorId], references: [id])
}

// ===== 一对一关系 =====
model User {
  id      String  @id @default(cuid())
  email   String  @unique
  profile Profile?
}

model Profile {
  id     String @id @default(cuid())
  bio    String
  userId String @unique  // 一对一必须唯一约束
  user   User   @relation(fields: [userId], references: [id])
}

// ===== 多对多关系（隐式中间表）=====
model Post {
  id         String      @id @default(cuid())
  title      String
  categories Category[]
}

model Category {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}
// 自动生成 _CategoryToPost 中间表

// ===== 多对多关系（显式中间表）=====
model Post {
  id         String           @id @default(cuid())
  title      String
  postTags   PostToTag[]
}

model Tag {
  id      String     @id @default(cuid())
  name    String     @unique
  postTags PostToTag[]
}

// 显式定义中间表，可添加额外字段
model PostToTag {
  postId String
  tagId  String
  note   String?   // 中间表额外字段
  createdAt DateTime @default(now())

  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])  // 复合主键
}

// ===== 自引用关系 =====
// 评论系统：评论可以回复评论
model Comment {
  id        String    @id @default(cuid())
  content   String
  parentId  String?
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")
  postId    String

  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
}
```

### 2.4 Prisma Client 生成与类型系统

```typescript
// Prisma Client 一旦生成，就会得到完整的类型定义
// 运行: npx prisma generate

import { PrismaClient } from '@prisma/client';

// 实例化 Prisma Client（单例模式）
const prisma = new PrismaClient();

// 自动推导的类型示例
async function examples() {
  // 1. 查询结果类型自动推导
  const user = await prisma.user.findUnique({
    where: { id: 'xxx' }
  });
  // user 的类型是: User | null
  // 访问 user.email 时，TypeScript 知道这是 string | null

  // 2. 创建参数类型自动推导
  const newUser = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      role: 'ADMIN',  // TypeScript 知道只能取 Role 枚举值
      profile: {
        create: {
          bio: 'Hello'
        }
      }
    }
  });
  // newUser 的类型是: User（包含嵌套创建的 profile）

  // 3. 联合类型处理
  const result = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });
  if (result) {
    // TypeScript 知道 result 不为 null
    console.log(result.email);
  }

  // 4. select 字段裁剪
  const partial = await prisma.user.findUnique({
    where: { id: 'xxx' },
    select: { id: true, email: true }
  });
  // partial 的类型是: { id: string; email: string } | null
  // TypeScript 不允许访问 partial.name
}
```

## 三、CRUD 操作实战

### 3.1 查询（Read）

```typescript
// src/queries.ts - Prisma 查询实战

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ===== 基础查询 =====

async function basicQueries() {
  // 单条查询
  const user = await prisma.user.findUnique({
    where: { id: 'clx1234567890' },
    // select: { id: true, email: true },  // 只返回指定字段
    // omit: { token: true },              // Prisma 5 新特性：排除字段
  });

  // 按唯一字段查询
  const byEmail = await prisma.user.findUnique({
    where: { email: 'alice@example.com' }
  });

  // 列表查询
  const allUsers = await prisma.user.findMany({
    where: {
      role: 'USER',
      createdAt: { gte: new Date('2024-01-01') }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,       // LIMIT 10
    skip: 0,        // OFFSET 0
    distinct: ['role']  // DISTINCT
  });

  // 聚合查询
  const stats = await prisma.user.aggregate({
    _count: { _all: true },
    _avg: { age: true },
    _sum: { age: true },
    where: { role: 'USER' }
  });

  // 分组聚合（Prisma 5.17+）
  const roleStats = await prisma.$queryRaw`
    SELECT role, COUNT(*) as count
    FROM "User"
    GROUP BY role
  `;

  // 分页查询
  async function paginate(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count()
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrev: page > 1
      }
    };
  }
}

// ===== 条件查询（过滤）=====

async function advancedFiltering() {
  // AND 条件（默认）
  const andQuery = await prisma.post.findMany({
    where: {
      AND: [
        { published: true },
        { title: { contains: 'TypeScript' } }
      ]
    }
  });

  // OR 条件
  const orQuery = await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: 'React' } },
        { title: { contains: 'Vue' } },
        { title: { contains: 'Angular' } }
      ]
    }
  });

  // NOT 条件
  const notQuery = await prisma.user.findMany({
    where: {
      NOT: { role: 'ADMIN' }
    }
  });

  // 字符串操作符
  const stringOps = await prisma.post.findMany({
    where: {
      title: {
        equals: 'Hello World',          // 精确匹配
        // contains: 'Hello',            // 包含
        // startsWith: 'Hello',          // 开头
        // endsWith: 'World',            // 结尾
        // mode: 'insensitive',          // 大小写不敏感（PostgreSQL）
      }
    }
  });

  // 数值/日期比较
  const numericOps = await prisma.post.findMany({
    where: {
      createdAt: {
        gte: new Date('2024-01-01'),    // 大于等于
        lte: new Date('2024-12-31'),    // 小于等于
        // gt: new Date(),
        // lt: new Date(),
        // not: new Date(),
      }
    }
  });

  // 数组查询（PostgreSQL）
  const arrayOps = await prisma.user.findMany({
    where: {
      skills: {
        has: 'TypeScript'               // 数组包含
        // hasEvery: ['A', 'B'],         // 包含所有
        // hasSome: ['A', 'B'],          // 包含任一
        // isEmpty: false,               // 非空
      }
    }
  });

  // JSON 查询（PostgreSQL）
  const jsonOps = await prisma.user.findMany({
    where: {
      metadata: {
        path: ['role'],
        equals: 'premium'
      }
    }
  });

  // 关系过滤
  const relationFilter = await prisma.post.findMany({
    where: {
      author: {
        role: 'ADMIN',
        email: { contains: '@company.com' }
      },
      categories: {
        some: {
          name: { in: ['Tech', 'AI'] }
        }
      }
    }
  });
}
```

### 3.2 创建（Create）

```typescript
// ===== 基础创建 =====

async function createExamples() {
  // 单条创建
  const user = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob',
      role: 'USER'
    }
  });

  // 批量创建
  const users = await prisma.user.createMany({
    data: [
      { email: 'user1@example.com', name: 'User 1' },
      { email: 'user2@example.com', name: 'User 2' },
      { email: 'user3@example.com', name: 'User 3' },
    ],
    skipDuplicates: true  // 跳过已存在的（根据唯一约束）
  });

  // 嵌套创建（一对一）
  const userWithProfile = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      profile: {
        create: {
          bio: 'Developer',
          avatar: 'https://example.com/avatar.jpg'
        }
      }
    },
    include: { profile: true }  // 返回时包含关联数据
  });

  // 嵌套创建（一对多）
  const authorWithPosts = await prisma.user.create({
    data: {
      email: 'author@example.com',
      name: 'Author',
      posts: {
        create: [
          { title: 'Post 1', content: 'Content 1', published: true },
          { title: 'Post 2', content: 'Content 2', published: false }
        ]
      }
    },
    include: { posts: true }
  });

  // 嵌套创建（多对多）
  const postWithCategories = await prisma.post.create({
    data: {
      title: 'Understanding Prisma',
      content: 'A deep dive into Prisma ORM',
      authorId: authorWithPosts.id,
      categories: {
        connectOrCreate: [
          {
            where: { id: 'existing-category-id' },
            create: { name: 'TypeScript', slug: 'typescript' }
          },
          {
            where: { name: 'ORM' },  // 按 name 查找
            create: { name: 'ORM', slug: 'orm' }
          }
        ]
      }
    },
    include: { categories: true }
  });

  // 使用 connect（关联已存在的记录）
  const connectedPost = await prisma.post.create({
    data: {
      title: 'Another Post',
      author: { connect: { id: user.id } },
      categories: { connect: [{ id: 'category-id' }] }
    }
  });

  // upsert：存在则更新，不存在则创建
  const upsertedUser = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {
      name: 'Alice Updated',
      updatedAt: new Date()
    },
    create: {
      email: 'alice@example.com',
      name: 'Alice',
      role: 'USER'
    }
  });
}
```

### 3.3 更新（Update）

```typescript
// ===== 基础更新 =====

async function updateExamples() {
  // 单条更新
  const updated = await prisma.user.update({
    where: { id: 'user-id' },
    data: {
      name: 'New Name',
      role: 'ADMIN'
    }
  });

  // 批量更新
  const batchUpdate = await prisma.user.updateMany({
    where: { role: 'USER', createdAt: { lt: new Date('2023-01-01') } },
    data: {
      role: 'LEGACY_USER'
    }
  });

  // 数字字段递增/递减（原子操作）
  const incremented = await prisma.post.update({
    where: { id: 'post-id' },
    data: {
      viewCount: { increment: 1 }
      // decrement: 1
      // multiply: 2
      // divide: 2
    }
  });

  // 字段置空
  const cleared = await prisma.user.update({
    where: { id: 'user-id' },
    data: {
      name: null  // 直接设置为 null
    }
  });

  // 嵌套更新（一对一）
  const userUpdated = await prisma.user.update({
    where: { id: 'user-id' },
    data: {
      name: 'Updated Name',
      profile: {
        update: {
          bio: 'Updated bio'
        }
      }
    }
  });

  // 嵌套更新（一对多）
  const postUpdated = await prisma.post.update({
    where: { id: 'post-id' },
    data: {
      published: true,
      categories: {
        set: [{ id: 'new-category-id' }]  // 替换关联
        // disconnect: [{ id: 'old-category-id' }]  // 断开关联
        // connect: [{ id: 'new-category-id' }]  // 添加关联
      }
    }
  });

  // 使用 raw update（复杂 SQL）
  const rawUpdate = await prisma.$executeRaw`
    UPDATE "User"
    SET "score" = "score" + ${10}
    WHERE "role" = 'USER'
  `;

  // $executeRaw vs $queryRaw
  // $executeRaw → 返回受影响的行数（INSERT/UPDATE/DELETE）
  // $queryRaw → 返回查询结果（SELECT）
}
```

### 3.4 删除（Delete）

```typescript
// ===== 删除操作 =====

async function deleteExamples() {
  // 单条删除（Cascade 会自动删除关联记录）
  const deleted = await prisma.user.delete({
    where: { id: 'user-id' }
  });

  // 批量删除
  const batchDelete = await prisma.user.deleteMany({
    where: {
      email: { endsWith: '@temp.com' },
      createdAt: { lt: new Date('2024-01-01') }
    }
  });

  // 软删除（推荐做法）
  const softDeleted = await prisma.user.update({
    where: { id: 'user-id' },
    data: {
      deletedAt: new Date(),
      // 或者使用一个 isDeleted 字段
      // isDeleted: true
    }
  });

  // 配合 WhereUnique 防止误删关键数据
  const safeDelete = await prisma.$transaction(async (tx) => {
    // 1. 先检查是否可以删除
    const user = await tx.user.findUnique({
      where: { id: 'user-id' },
      include: { posts: true }
    });

    if (!user) throw new Error('User not found');
    if (user.posts.length > 0) {
      throw new Error('Cannot delete user with posts');
    }

    // 2. 执行删除
    return tx.user.delete({ where: { id: 'user-id' } });
  });

  // 强制删除（绕过软删除检查的场景）
  // 先 update 再 delete
  await prisma.$transaction([
    prisma.user.update({
      where: { id: 'user-id' },
      data: { deletedAt: null }  // 清除软删除标记
    }),
    prisma.user.delete({
      where: { id: 'user-id' }
    })
  ]);
}
```

## 四、关系查询与 N+1 问题

### 4.1 include 与 select

```typescript
// ===== 关联数据加载 =====

async function relationQueries() {
  // 加载关联数据（include）
  const userWithPosts = await prisma.user.findUnique({
    where: { id: 'user-id' },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, createdAt: true }  // 嵌套 select
      },
      profile: true
    }
  });
  // userWithPosts.posts 是 Post[]，且只包含指定字段

  // 多层嵌套
  const postsWithAuthorsAndCategories = await prisma.post.findMany({
    where: { published: true },
    include: {
      author: {
        select: { id: true, name: true, email: true }
      },
      categories: {
        select: { id: true, name: true }
      }
    }
  });

  // 计数（不需要加载完整数据）
  const userWithPostCount = await prisma.user.findMany({
    include: {
      _count: {
        select: { posts: true, profile: true }
      }
    }
  });
  // user._count.posts 是数字，不是 Post[]

  // 嵌套 include（多级关系）
  const complexQuery = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    include: {
      posts: {
        include: {
          categories: true,
          author: { select: { name: true } }
        }
      }
    }
  });
}
```

### 4.2 N+1 问题与解决方案

N+1 问题是最常见的性能杀手：

```txt
N+1 问题示例：
假设查询 10 个 User，每个 User 有 5 篇 Post

❌ N+1（101 次查询）：
prisma.user.findMany({ take: 10 })
  → 1 次查询获取用户
  → 每个用户单独查询 posts（10 次）
  → 每个 post 单独查询 author（50 次）
  → 每个 post 单独查询 categories（50 次）
  → 总计: 1 + 10 + 50 + 50 = 111 次查询！

✅ 使用 include（1 次查询）：
prisma.user.findMany({
  take: 10,
  include: {
    posts: {
      include: { author: true, categories: true }
    }
  }
})
  → 1 次查询完成所有关联数据
```

```typescript
// ===== 避免 N+1 的策略 =====

async function avoidNPlusOne() {
  // 策略 1：使用 include 一次性加载
  const users = await prisma.user.findMany({
    take: 10,
    include: {
      posts: {
        where: { published: true },
        include: { categories: true }
      }
    }
  });

  // 策略 2：使用 findMany + map（需要多次查询但可控）
  // 适合分页场景
  const page = await prisma.user.findMany({
    take: 10,
    skip: 0
  });

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: page.map(u => u.id) },
      published: true
    }
  });

  // 按 authorId 分组
  const postsByAuthorId = posts.reduce((acc, post) => {
    if (!acc[post.authorId]) acc[post.authorId] = [];
    acc[post.authorId].push(post);
    return acc;
  }, {} as Record<string, typeof posts>);

  // 策略 3：使用 $transaction 打包多次查询
  const [users, posts, categories] = await prisma.$transaction([
    prisma.user.findMany({ take: 10 }),
    prisma.post.findMany({ where: { published: true } }),
    prisma.category.findMany()
  ]);
  // 3 次查询，事务保证一致性

  // 策略 4：Prisma 5 的 batch loading（自动优化）
  // Prisma Client 会自动批处理同一事务内的相同类型查询
}
```

### 4.3 分页与无限滚动

```typescript
// src/pagination.ts - 实战分页方案

// ===== 游标分页（Cursor-based，适合大数据量）=====

interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function cursorPaginate(
  take: number = 10,
  cursor?: string
): Promise<CursorPaginationResult<Post>> {
  const posts = await prisma.post.findMany({
    take: take + 1,  // 多取一条判断是否有更多
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1  // 跳过游标本身
    }),
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } } }
  });

  const hasMore = posts.length > take;
  const data = hasMore ? posts.slice(0, -1) : posts;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

// API 使用示例
// GET /api/posts?take=10&cursor=xxx
// 返回 { data: [...], nextCursor: "yyy", hasMore: true }

// ===== 无限滚动分页（前端）=====

async function infiniteScroll(limit: number = 10) {
  const posts = await prisma.post.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { author: true }
  });

  return posts.map(post => ({
    id: post.id,
    title: post.title,
    authorName: post.author.name,
    createdAt: post.createdAt.toISOString()
  }));
}

// ===== 搜索 + 分页组合 =====

interface SearchParams {
  query?: string;
  category?: string;
  page: number;
  pageSize: number;
}

async function searchWithPagination(params: SearchParams) {
  const { query, category, page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PostWhereInput = {
    published: true,
    ...(query && {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ]
    }),
    ...(category && {
      categories: {
        some: { slug: category }
      }
    })
  };

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, avatar: true } },
        categories: { select: { name: true, slug: true } },
        _count: { select: { comments: true } }
      }
    }),
    prisma.post.count({ where })
  ]);

  return {
    posts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}
```

## 五、事务与原子操作

### 5.1 事务基础

```typescript
// ===== Prisma 事务 =====

async function transactionExamples() {
  // 方式 1：$transaction（自动提交）
  const result = await prisma.$transaction(async (tx) => {
    // 创建用户
    const user = await tx.user.create({
      data: {
        email: 'alice@example.com',
        name: 'Alice',
        profile: { create: { bio: 'Developer' } }
      }
    });

    // 创建帖子
    const post = await tx.post.create({
      data: {
        title: 'Hello World',
        content: 'My first post',
        authorId: user.id
      }
    });

    // 更新用户帖子数
    // 注意：这里没法直接更新关联字段，需要单独查询
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { name: 'Alice Updated' }
    });

    return { user, post, updated };
  });

  // 方式 2：交互式事务（Interactive Transactions）
  // 允许你在事务中多次与数据库交互，并在最后决定提交或回滚
  const interactiveResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: 'bob@example.com', name: 'Bob' }
    });

    // 中间可以插入其他逻辑
    const validation = await validateUserData(user);
    if (!validation.valid) {
      throw new Error(validation.error);  // 自动回滚
    }

    return user;
  }, {
    timeout: 10,  // 事务超时（秒）
    isolationLevel: 'Serializable'  // 隔离级别
  });

  // 方式 3：批次事务（Batch Transactions）
  // Prisma 5.10+ 支持
  await prisma.$transaction([
    prisma.user.update({ where: { id: '1' }, data: { name: 'A' } }),
    prisma.user.update({ where: { id: '2' }, data: { name: 'B' } }),
    prisma.user.update({ where: { id: '3' }, data: { name: 'C' } }),
  ], {
    isolationLevel: 'ReadCommitted'
  });
}
```

### 5.2 实战：转账与库存扣减

```typescript
// ===== 转账（经典事务场景）=====

async function transferMoney(
  fromUserId: string,
  toUserId: string,
  amount: number
) {
  return await prisma.$transaction(async (tx) => {
    // 1. 检查源账户余额
    const fromAccount = await tx.account.findUnique({
      where: { userId: fromUserId }
    });

    if (!fromAccount || fromAccount.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // 2. 扣款
    await tx.account.update({
      where: { userId: fromUserId },
      data: { balance: { decrement: amount } }
    });

    // 3. 存款
    await tx.account.update({
      where: { userId: toUserId },
      data: { balance: { increment: amount } }
    });

    // 4. 记录流水
    await tx.transactionLog.create({
      data: {
        fromUserId,
        toUserId,
        amount,
        type: 'TRANSFER'
      }
    });

    return { success: true };
  }, {
    isolationLevel: 'Serializable'  // 最高隔离级别，防止并发问题
  });
}

// ===== 库存扣减（防止超卖）=====

async function reduceInventory(productId: string, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    // 使用 SELECT FOR UPDATE 锁定行（需要数据库支持）
    // Prisma 不直接支持 SELECT FOR UPDATE，但可以通过 raw query 实现
    const result = await tx.$executeRaw`
      UPDATE "Product"
      SET "stock" = "stock" - ${quantity}
      WHERE "id" = ${productId}
        AND "stock" >= ${quantity}
    `;

    if (result === 0) {
      throw new Error('Insufficient stock or product not found');
    }

    // 记录库存变动
    await tx.inventoryLog.create({
      data: {
        productId,
        change: -quantity,
        reason: 'ORDER'
      }
    });

    return { success: true, remainingStock: result };
  }, {
    isolationLevel: 'Serializable'
  });
}
```

## 六、迁移系统与数据库版本管理

### 6.1 Prisma Migrate 工作流

```bash
# ===== 迁移命令 =====

# 1. 初始化（首次创建 schema 后）
npx prisma migrate dev --name init

# 2. 开发阶段：修改 schema 后生成迁移
npx prisma migrate dev --name add_user_bio

# 3. 生产环境：应用迁移
npx prisma migrate deploy

# 4. 查看迁移状态
npx prisma migrate status

# 5. 重置数据库（危险！开发环境）
npx prisma migrate reset

# 6. 创建空迁移（手动编写 SQL）
npx prisma migrate dev --name custom_migration --create-only
# 然后手动编辑 prisma/migrations/xxxx_custom_migration/migration.sql
```

### 6.2 迁移文件结构

```sql
-- prisma/migrations/20240101000000_add_user_bio/migration.sql

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- AddForeignKey
ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey（反向：User → Profile）
ALTER TABLE "User"
  ADD COLUMN "profileId" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_profileId_fkey"
  FOREIGN KEY ("profileId")
  REFERENCES "Profile"(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

### 6.3 生产环境迁移策略

```typescript
// ===== 生产环境安全迁移策略 =====

// 策略 1：蓝绿部署
// 1. 在 staging 环境测试迁移
// 2. 部署新代码（包含迁移脚本）
// 3. 新 Pod 启动时自动执行 prisma migrate deploy
// 4. 验证无误后，切换流量到新 Pod

// 策略 2：使用 Reset（需配合数据备份）
// 适用于 schema 大改、可接受停机的情况

// 策略 3：渐进式迁移
// 1. 添加新字段（nullable）
// 2. 部署代码使用新字段
// 3. 后台数据迁移
// 4. 删除旧字段

// 示例：添加一个可空的新字段
// schema.prisma:
// model User {
//   ...
//   newField String?  // 可空，允许部署
// }

// 迁移后，运行数据迁移脚本
// npx ts-node scripts/migrate-data.ts

// scripts/migrate-data.ts
async function migrateData() {
  let migrated = 0;
  const batchSize = 1000;
  let skip = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where: { newField: null },
      take: batchSize,
      skip
    });

    if (users.length === 0) break;

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { newField: computeNewField(user) }
      });
    }

    migrated += users.length;
    skip += batchSize;
    console.log(`Migrated ${migrated} records...`);
  }

  console.log(`Migration complete: ${migrated} records`);
}
```

## 七、Prisma 5 新特性

```prisma
// Prisma 5 的关键改进

generator client {
  provider = "prisma-client-js"
  // Prisma 5: 预发布功能启用
  previewFeatures = ["relationJoins"]  // 关系 JOIN 优化
}

// 新增：omit 选项（避免返回敏感字段）
model User {
  id       String  @id @default(cuid())
  email    String  @unique
  password String  // 敏感字段，不应返回给前端
  name     String?

  // Prisma 5: 可以在查询时省略字段
}

// 新增：groupBy 增强
// 之前需要 raw query，现在原生支持
```

```typescript
// Prisma 5 新特性示例

async function prisma5Features() {
  // 1. omit（排除字段）
  const user = await prisma.user.findUnique({
    where: { id: 'xxx' },
    omit: {
      password: true,  // 不返回密码
      // token: true,
    }
  });
  // user 类型自动不包含 password 字段！

  // 2. $transaction 支持数组形式（批量事务）
  const results = await prisma.$transaction([
    prisma.user.create({ data: { email: 'a@test.com', name: 'A' } }),
    prisma.user.create({ data: { email: 'b@test.com', name: 'B' } }),
    prisma.user.create({ data: { email: 'c@test.com', name: 'C' } }),
  ]);
  // 返回所有创建结果的数组

  // 3. groupBy 原生支持
  const stats = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true },
    where: { deletedAt: null }
  });
  // 无需使用 $queryRaw

  // 4. findMany 支持 having（需要 Prisma 5.17+）
  const roles = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    having: { id: { _count: { gt: 5 } } }
  });

  // 5. 更好的错误信息
  // Prisma 5 改进了 ManyNotRelated 和其他常见错误提示
}
```

## 八、性能优化实战

### 8.1 Prisma Client 配置

```typescript
// src/lib/prisma.ts - Prisma Client 单例配置

import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 开发环境：全局复用（避免热重载创建多个连接）
// 生产环境：使用单例模式
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],

    // 连接池配置
    datasources: {
      db: {
        url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=20'
      }
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ===== 扩展 Prisma Client（添加自定义方法）=====

export const extendedPrisma = prisma.$extends({
  model: {
    user: {
      // 添加自定义查询方法
      async findByEmail(email: string) {
        return this.findUnique({
          where: { email }
        });
      },

      async findAdmins() {
        return this.findMany({
          where: { role: 'ADMIN' }
        });
      },

      // 添加自定义写入方法
      async createWithProfile(data: {
        email: string;
        name: string;
        bio: string;
      }) {
        return this.create({
          data: {
            email: data.email,
            name: data.name,
            profile: {
              create: { bio: data.bio }
            }
          }
        });
      }
    },

    post: {
      async publish(id: string) {
        return this.update({
          where: { id },
          data: { published: true }
        });
      },

      async unpublish(id: string) {
        return this.update({
          where: { id },
          data: { published: false }
        });
      }
    }
  },

  result: {
    user: {
      // 添加计算字段
      fullName: {
        needs: { name: true, email: true },
        compute(user) {
          return user.name || user.email.split('@')[0];
        }
      }
    }
  }
});

// 使用扩展
async function useExtendedPrisma() {
  const admin = await extendedPrisma.user.findAdmins();
  const user = await extendedPrisma.user.createWithProfile({
    email: 'alice@example.com',
    name: 'Alice',
    bio: 'Developer'
  });
  console.log(user.fullName);  // 自定义计算字段
}
```

### 8.2 索引与查询优化

```prisma
// ===== Schema 索引优化 =====

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String   @db.Text
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())

  // 单字段索引
  @@index([authorId])

  // 多字段复合索引（查询优化）
  @@index([published, createdAt])
  @@index([authorId, published])
}

// 对于高频查询，使用复合索引
// 例如: WHERE published = true ORDER BY createdAt DESC
// → 复合索引 [published, createdAt] 最优
```

```typescript
// ===== 查询优化检查清单 =====

async function queryOptimization() {
  // ✅ 使用 select/omit 减少数据传输
  const ids = await prisma.user.findMany({
    select: { id: true }
  });

  // ✅ 只加载需要的关联
  const users = await prisma.user.findMany({
    include: { profile: true }  // 不要 include 所有关联
  });

  // ✅ 使用 take 限制数量
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100  // 永远不要 select * 而不加 limit
  });

  // ✅ 使用 findFirst/findUnique 而非 findMany
  const firstAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  // ✅ 使用 count 而非 length(findMany())
  const userCount = await prisma.user.count({
    where: { role: 'USER' }
  });

  // ✅ 使用 exists 而非 count > 0
  const hasAdmins = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  }).then(user => !!user);

  // Prisma 5.6+: 使用 $exists
  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  // ✅ 避免在循环中查询
  // 错误 ❌:
  for (const userId of userIds) {
    const posts = await prisma.post.findMany({
      where: { authorId: userId }
    });
  }

  // 正确 ✅:
  const allPosts = await prisma.post.findMany({
    where: { authorId: { in: userIds } }
  });
  const postsByAuthor = groupBy(allPosts, 'authorId');
}
```

### 8.3 Raw Query 使用指南

```typescript
// ===== Prisma Raw Query =====

async function rawQueryExamples() {
  // $queryRaw → SELECT，返回结果
  const users = await prisma.$queryRaw`
    SELECT id, email, name
    FROM "User"
    WHERE "role" = ${'ADMIN'}
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;

  // $queryRawUnsafe → 参数化查询（需要手动防注入）
  const unsafeUsers = await prisma.$queryRawUnsafe(
    'SELECT * FROM "User" WHERE email = $1',
    ['alice@example.com']
  );

  // $executeRaw → INSERT/UPDATE/DELETE，返回影响行数
  const updateCount = await prisma.$executeRaw`
    UPDATE "User"
    SET "name" = 'Updated'
    WHERE "role" = ${'USER'}
  `;

  // 复杂聚合查询
  const monthlyStats = await prisma.$queryRaw<Array<{
    month: string;
    user_count: bigint;
    post_count: bigint;
  }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
      COUNT(DISTINCT "User".id)::bigint as user_count,
      COUNT(DISTINCT "Post".id)::bigint as post_count
    FROM "User"
    LEFT JOIN "Post" ON "Post"."authorId" = "User".id
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY month DESC
  `;

  // 全文搜索（PostgreSQL）
  const searchResults = await prisma.$queryRaw`
    SELECT * FROM "Post"
    WHERE to_tsvector('english', title || ' ' || COALESCE(content, ''))
          @@ plainto_tsquery('english', ${searchQuery})
    ORDER BY ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(content, '')),
      plainto_tsquery('english', ${searchQuery})
    ) DESC
    LIMIT 20
  `;
}
```

## 九、实战：构建完整的数据访问层

```typescript
// src/repositories/user.repository.ts - 仓储模式

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CreateUserDto {
  email: string;
  name?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
}

export interface UpdateUserDto {
  name?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
}

export interface UserFilters {
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
  search?: string;
  page?: number;
  pageSize?: number;
}

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true, _count: { select: { posts: true } } }
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
  }

  async findAll(filters: UserFilters) {
    const { role, search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { avatar: true } },
          _count: { select: { posts: true } }
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: users,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
  }

  async create(dto: CreateUserDto) {
    return prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role || 'USER'
      }
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    return prisma.user.update({
      where: { id },
      data: dto
    });
  }

  async delete(id: string) {
    // 软删除
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async hardDelete(id: string) {
    // 硬删除（物理删除）
    return prisma.user.delete({
      where: { id }
    });
  }

  async toggleRole(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    const roleMap = {
      USER: 'ADMIN',
      ADMIN: 'MODERATOR',
      MODERATOR: 'USER'
    };

    return prisma.user.update({
      where: { id },
      data: { role: roleMap[user.role] }
    });
  }
}

export const userRepository = new UserRepository();
```

## 十、总结与选型建议

**Prisma 适用场景：**

```
✅ 强烈推荐使用 Prisma：
├─ TypeScript 全栈项目（Next.js、Nuxt、NestJS）
├─ 快速原型开发，需要快速迭代
├─ 团队成员对 SQL 不熟悉
├─ 需要极致的类型安全
├─ PostgreSQL/MySQL/SQLite 为数据源
└─ 需要内建迁移系统

⚠️ 考虑其他方案：
├─ 高性能大数据量 → Drizzle ORM
├─ 复杂业务逻辑 → TypeORM 或直接 SQL
├─ 多数据库兼容 → TypeORM
└─ MongoDB 为主 → Mongoose 或 Prisma（MongoDB preview）
```

**Prisma vs Drizzle 选型决策树：**

```
                  团队 SQL 熟悉度？
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
    不熟悉 SQL                    熟悉 SQL
         │                             │
         ▼                             ▼
    Prisma（类型安全优先）        需要极致性能？
         │                             │
         │                      ┌──────┴──────┐
         │                      ▼             ▼
         │                   是              否
         │                    │              │
         │                    ▼              ▼
         │               Drizzle         两者皆可
         │                               看团队偏好
         │
         ▼
    Prisma（文档好，上手快）
```

Prisma 以其声明式的 Schema 设计、极致的类型安全性和优秀的开发体验，成为 TypeScript 生态中最受欢迎的 ORM 方案。配合 Prisma Studio 的可视化管理和 Prisma Migrate 的版本化迁移，构建数据层从未如此简单。

---

*本文由小虾子 🦐 撰写*
