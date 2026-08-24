# Supabase 深度解析：开源 Firebase 替代方案的完整工程实践

> Firebase 以其"后端即服务"的理念改变了全栈开发的格局，但闭源生态和定价策略让许多团队望而却步。Supabase 以开源姿态登场，基于 PostgreSQL 构建，提供数据库、认证、实时订阅、存储、Edge Functions 一站式服务，成为 2024 年增长最快的开发者平台之一。本文将从架构设计、核心服务、开发实战的维度，带你全面掌握这个"开源 Firebase"。

## 一、为什么选择 Supabase

### 1.1 Firebase vs Supabase 对比

```
┌────────────────────────────────────────────────────────────────────┐
│                    Firebase vs Supabase 全面对比                    │
├─────────────────────────┬──────────────────┬───────────────────────┤
│         特性            │     Firebase     │      Supabase         │
├─────────────────────────┼──────────────────┼───────────────────────┤
│  开源                   │ ❌ 闭源          │ ✅ 完全开源            │
│  数据库                 │ Cloud Firestore  │ PostgreSQL            │
│  数据模型               │ 文档型（NoSQL）  │ 关系型（SQL）         │
│  数据所有权             │ Google 托管      │ 自有 PostgreSQL       │
│  数据导出               │ 困难             │ 标准 SQL 导出         │
├─────────────────────────┼──────────────────┼───────────────────────┤
│  认证                   │ Firebase Auth    │ GoTrue（开源）        │
│  实时订阅               │ Firestore 实时   │ PostgreSQL Replication│
│  文件存储               │ Cloud Storage    │ Supabase Storage      │
│  Serverless 函数        │ Cloud Functions  │ Edge Functions        │
│  静态托管               │ Firebase Hosting │ Supabase Storage      │
├─────────────────────────┼──────────────────┼───────────────────────┤
│  定价模式               │ 按读写计费       │ 按项目计费            │
│  免费额度               │ 较低             │ 较高（500MB 数据库）  │
│  成本可预测性           │ ❌ 难预测        │ ✅ 透明可控           │
├─────────────────────────┼──────────────────┼───────────────────────┤
│  SQL 支持               │ ❌ 无            │ ✅ 完整 PostgreSQL    │
│  JOIN 查询              │ ❌ 手动实现      │ ✅ 原生支持           │
│  复杂查询               │ ❌ 受限          │ ✅ 完整 SQL 能力      │
│  数据迁移               │ ❌ 困难          │ ✅ 标准 pg_dump       │
├─────────────────────────┼──────────────────┼───────────────────────┤
│  自托管                 │ ❌ 不支持        │ ✅ Docker 自部署      │
│  云提供商绑定           │ ❌ 绑定 Google   │ ✅ 可迁移             │
│  社区生态               │ Google 官方      │ 开源社区 + 官方       │
└─────────────────────────┴──────────────────┴───────────────────────┘
```

### 1.2 Supabase 的核心价值主张

```
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase 核心价值                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔓 开源透明                                                    │
│     所有组件开源，可自托管，无厂商锁定                           │
│                                                                 │
│  🐘 PostgreSQL 之力                                             │
│     企业级关系数据库，完整 SQL，成熟稳定                         │
│                                                                 │
│  🚀 开发者体验                                                  │
│     Dashboard + CLI + SDK，从原型到生产无缝衔接                  │
│                                                                 │
│  💰 可预测的定价                                                │
│     免费层 generous，付费层透明，无惊喜账单                      │
│                                                                 │
│  🔗 全栈一站式                                                  │
│     数据库 + 认证 + 存储 + 实时 + 函数，无需拼凑服务             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Supabase 技术栈                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Client SDK                              │   │
│  │   supabase-js / supabase-dart / supabase-flutter / etc.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     API Gateway (Kong)                       │   │
│  │      路由 / 认证 / 限流 / 日志                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│    ┌─────────────────────────┼─────────────────────────┐           │
│    ▼                         ▼                         ▼           │
│  ┌──────────┐         ┌──────────┐              ┌──────────┐      │
│  │ GoTrue   │         │ PostgREST│              │ Realtime │      │
│  │ (认证)   │         │ (REST API)│             │ (实时订阅)│      │
│  └──────────┘         └──────────┘              └──────────┘      │
│                              │                                      │
│  ┌──────────┐         ┌──────────────────────────────────────┐    │
│  │ Storage  │         │         PostgreSQL                    │    │
│  │ (文件)   │         │  • 数据存储                           │    │
│  └──────────┘         │  • 行级安全策略 (RLS)                 │    │
│                       │  • 全文搜索                           │    │
│                       │  • 实时发布                           │    │
│                       └──────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Edge Functions (Deno)                      │   │
│  │              服务端逻辑 / Webhook / 定时任务                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 二、项目初始化与配置

### 2.1 创建 Supabase 项目

```bash
# 方式一：通过 Dashboard（推荐新手）
# 访问 https://supabase.com → New Project

# 方式二：通过 CLI（推荐开发者）
npm install -g supabase

# 登录
supabase login

# 初始化本地项目
supabase init

# 创建远程项目并链接
supabase projects create my-app --org-id <org-id>
supabase link --project-ref <project-ref>

# 启动本地开发环境
supabase start
```

### 2.2 项目配置文件

```toml
# supabase/config.toml - Supabase 项目配置

# 项目基础信息
project_id = "my-app"

# API 配置
[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

# 数据库配置
[db]
port = 54322
shadow_port = 54320
major_version = 15

# 认证配置
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
refresh_token_rotation_enabled = true
secure_password_change_enabled = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[auth.sms]
enable_signup = true
enable_confirmations = true
template = "Your code is {{ .Code }}"

# 第三方登录
[auth.external.apple]
enabled = false
client_id = ""
secret = ""

[auth.external.google]
enabled = true
client_id = "xxx.apps.googleusercontent.com"
secret = "xxx"
redirect_uri = "https://xxx.supabase.co/auth/v1/callback"

[auth.external.github]
enabled = true
client_id = "xxx"
secret = "xxx"

# 存储配置
[storage]
enabled = true
file_size_limit = "50MB"

# 实时配置
[realtime]
enabled = true

# Edge Functions
[edge_runtime]
enabled = true
```

### 2.3 客户端初始化

```typescript
// src/lib/supabase.ts - Supabase 客户端配置

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';  // 自动生成的类型

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 浏览器端客户端（使用 anon key）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,           // 持久化会话
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,         // 自动刷新 token
    detectSessionInUrl: true,       // 从 URL 检测会话（OAuth 回调）
  },
  realtime: {
    params: {
      eventsPerSecond: 10,          // 实时事件频率限制
    },
  },
  global: {
    headers: {
      'x-application-name': 'my-app',
    },
  },
});

// 服务端客户端（使用 service_role key，绕过 RLS）
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// 类型定义（通过 supabase gen types 生成）
// npx supabase gen types typescript --project-id xxx > src/lib/database.types.ts
```

```typescript
// src/lib/database.types.ts（自动生成）

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          user_id: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string | null;
          user_id: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string | null;
          user_id?: string;
          published?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      // ...
    };
    Functions: {
      // ...
    };
    Enums: {
      user_role: 'admin' | 'user' | 'moderator';
    };
  };
}

// 便捷类型导出
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
```

## 三、PostgreSQL 数据库深度使用

### 3.1 表结构设计

Supabase 使用 PostgreSQL，所有表定义都是标准 SQL：

```sql
-- supabase/migrations/20240101000000_initial_schema.sql

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- 用户表（扩展 auth.users）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 触发器：自动同步 auth.users 变更到 profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 文章表
CREATE TABLE public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  cover_image TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_published ON public.posts(published);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_slug ON public.posts(slug);

-- 全文搜索索引
CREATE INDEX idx_posts_search ON public.posts
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- 评论表
CREATE TABLE public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- 标签表（多对多）
CREATE TABLE public.tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE public.post_tags (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### 3.2 行级安全策略（RLS）

RLS 是 Supabase 安全模型的核心，在数据库层面实现权限控制：

```sql
-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ===== Profiles 策略 =====

-- 所有人可查看公开 profile
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

-- 用户只能更新自己的 profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能插入自己的 profile
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ===== Posts 策略 =====

-- 所有人可查看已发布的文章
CREATE POLICY "posts_select_published" ON public.posts
  FOR SELECT USING (published = true);

-- 作者可查看自己的所有文章（包括草稿）
CREATE POLICY "posts_select_own" ON public.posts
  FOR SELECT USING (auth.uid() = user_id);

-- 已认证用户可创建文章
CREATE POLICY "posts_insert_authenticated" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 作者可更新自己的文章
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

-- 作者可删除自己的文章
CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- ===== Comments 策略 =====

-- 所有人可查看评论
CREATE POLICY "comments_select_all" ON public.comments
  FOR SELECT USING (true);

-- 已认证用户可创建评论
CREATE POLICY "comments_insert_authenticated" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 评论作者可更新自己的评论
CREATE POLICY "comments_update_own" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- 评论作者或文章作者可删除评论
CREATE POLICY "comments_delete_own_or_post_author" ON public.comments
  FOR DELETE USING (
    auth.uid() = user_id
    OR
    auth.uid() = (
      SELECT user_id FROM public.posts WHERE id = post_id
    )
  );

-- ===== 辅助函数 =====

-- 检查用户是否为管理员
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT raw_user_meta_data->>'role' = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理员策略示例
CREATE POLICY "posts_all_admin" ON public.posts
  FOR ALL USING (public.is_admin());
```

### 3.3 PostgREST API 自动生成

Supabase 基于表结构自动生成 RESTful API：

```typescript
// PostgREST 自动映射规则
// 表名 → 路径
// posts → GET /rest/v1/posts
// posts?id=eq.xxx → WHERE id = 'xxx'
// posts?select=id,title,user_id(name,email) → JOIN 查询

// ===== 客户端查询 =====

// 基础查询
const { data, error } = await supabase
  .from('posts')
  .select('id, title, content, created_at')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .limit(10);

// 关联查询
const { data: postsWithAuthor } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    user_id (
      id,
      name,
      avatar_url
    )
  `)
  .eq('published', true);

// 多层关联
const { data: fullPosts } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    content,
    user_id (name, avatar_url),
    comments (
      id,
      content,
      user_id (name)
    ),
    tags (name)
  `)
  .eq('id', postId)
  .single();

// 聚合查询（需要数据库函数）
const { data: stats } = await supabase
  .rpc('get_post_stats', { user_id_param: userId });

// 创建
const { data: newPost, error } = await supabase
  .from('posts')
  .insert({
    title: 'New Post',
    content: 'Content here',
    user_id: user.id,
    published: false
  })
  .select()
  .single();

// 更新
const { data: updated, error } = await supabase
  .from('posts')
  .update({ title: 'Updated Title' })
  .eq('id', postId)
  .select()
  .single();

// 删除
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId);

// 批量操作
const { data: batchInsert } = await supabase
  .from('posts')
  .insert([
    { title: 'Post 1', user_id: userId },
    { title: 'Post 2', user_id: userId },
    { title: 'Post 3', user_id: userId }
  ])
  .select();

// Upsert（存在则更新，不存在则创建）
const { data: upserted } = await supabase
  .from('profiles')
  .upsert({
    id: userId,
    name: 'John Doe',
    email: 'john@example.com'
  }, {
    onConflict: 'id'
  })
  .select()
  .single();
```

### 3.4 数据库函数与触发器

```sql
-- supabase/migrations/20240102000000_functions.sql

-- 全文搜索函数
CREATE OR REPLACE FUNCTION public.search_posts(search_query TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  excerpt TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    COALESCE(p.excerpt, LEFT(p.content, 200)) AS excerpt,
    ts_rank(
      to_tsvector('english', p.title || ' ' || COALESCE(p.content, '')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM public.posts p
  WHERE
    p.published = true
    AND to_tsvector('english', p.title || ' ' || COALESCE(p.content, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 获取文章统计
CREATE OR REPLACE FUNCTION public.get_post_stats(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_posts', (SELECT COUNT(*) FROM posts WHERE user_id = user_id_param),
    'published_posts', (SELECT COUNT(*) FROM posts WHERE user_id = user_id_param AND published = true),
    'total_views', (SELECT COALESCE(SUM(view_count), 0) FROM posts WHERE user_id = user_id_param),
    'total_comments', (
      SELECT COUNT(*) FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE p.user_id = user_id_param
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 更新浏览量
CREATE OR REPLACE FUNCTION public.increment_view_count(post_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = post_id_param AND published = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 软删除触发器
CREATE OR REPLACE FUNCTION public.soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET deleted_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 阅读历史记录
CREATE TABLE public.read_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- 自动更新阅读时间
CREATE OR REPLACE FUNCTION public.update_read_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.read_history (user_id, post_id, read_at)
  VALUES (NEW.user_id, NEW.id, NOW())
  ON CONFLICT (user_id, post_id) DO UPDATE
  SET read_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_read_history_on_view
  AFTER UPDATE OF view_count ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_read_history();
```

## 四、认证系统实战

### 4.1 邮箱密码认证

```typescript
// src/lib/auth.ts - 认证服务封装

import { supabase } from './supabase';

export class AuthService {
  // 注册
  static async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  }

  // 登录
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  // 登出
  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // 获取当前用户
  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  // 获取当前会话
  static async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  // 发送密码重置邮件
  static async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  }

  // 更新密码
  static async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }

  // 更新用户信息
  static async updateProfile(data: { name?: string; avatar_url?: string }) {
    const { error } = await supabase.auth.updateUser({
      data,
    });
    if (error) throw error;
  }
}
```

### 4.2 OAuth 第三方登录

```typescript
// src/lib/oauth.ts - OAuth 登录

export class OAuthService {
  // Google 登录
  static async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
    return data;
  }

  // GitHub 登录
  static async signInWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'repo user',
      },
    });
    if (error) throw error;
    return data;
  }

  // Apple 登录
  static async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  }

  // 处理 OAuth 回调
  static async handleCallback() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session) {
      // 同步用户信息到 profiles 表
      await supabase.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata?.name,
        avatar_url: session.user.user_metadata?.avatar_url,
      }, { onConflict: 'id' });
    }

    return session;
  }
}

// OAuth 回调页面
// src/app/auth/callback/page.tsx
import { OAuthService } from '@/lib/oauth';
import { redirect } from 'next/navigation';

export default async function AuthCallbackPage() {
  try {
    const session = await OAuthService.handleCallback();
    if (session) {
      redirect('/dashboard');
    }
  } catch (error) {
    redirect('/auth/error');
  }
}
```

### 4.3 认证状态管理

```typescript
// src/hooks/useAuth.ts - React Hook

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Tables<'profiles'> | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // 初始化：获取当前会话
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          });
        } else {
          setState({ user: null, session: null, profile: null, loading: false, error: null });
        }
      } catch (error: any) {
        if (mounted) {
          setState({ user: null, session: null, profile: null, loading: false, error: error.message });
        }
      }
    };

    initAuth();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setState({ user: session.user, session, profile, loading: false, error: null });
        } else {
          setState({ user: null, session: null, profile: null, loading: false, error: null });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}

// 使用示例
function ProfilePage() {
  const { user, profile, loading, error } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Please sign in</div>;

  return (
    <div>
      <h1>{profile?.name || user.email}</h1>
      <img src={profile?.avatar_url} alt="Avatar" />
    </div>
  );
}
```

## 五、实时订阅（Realtime）

### 5.1 Realtime 原理

```
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Realtime 架构                      │
│                                                             │
│  Client (WebSocket)                                         │
│       │                                                     │
│       ▼                                                     │
│  Realtime Server                                            │
│       │                                                     │
│       ▼                                                     │
│  PostgreSQL WAL (Write-Ahead Log)                          │
│       │                                                     │
│       ▼                                                     │
│  数据变更广播到订阅者                                        │
│                                                             │
│  支持的变更类型：                                            │
│  • INSERT - 新记录插入                                       │
│  • UPDATE - 记录更新                                         │
│  • DELETE - 记录删除                                         │
│  • * - 所有变更                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 实时订阅实战

```typescript
// src/hooks/useRealtime.ts - 实时订阅 Hook

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimePosts(channelName: string = 'posts') {
  const [posts, setPosts] = useState<Tables<'posts'>[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    // 初始加载
    const fetchInitialPosts = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, user_id(name, avatar_url)')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (data) setPosts(data);
    };

    fetchInitialPosts();

    // 创建实时订阅
    const realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: 'published=eq.true',
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case 'INSERT':
              setPosts(prev => [newRecord as Tables<'posts'>, ...prev]);
              break;
            case 'UPDATE':
              setPosts(prev =>
                prev.map(p => (p.id === newRecord.id ? newRecord as Tables<'posts'> : p))
              );
              break;
            case 'DELETE':
              setPosts(prev => prev.filter(p => p.id !== oldRecord.id));
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    setChannel(realtimeChannel);

    return () => {
      realtimeChannel.unsubscribe();
    };
  }, [channelName]);

  return { posts, channel };
}

// 评论实时订阅
export function useRealtimeComments(postId: string) {
  const [comments, setComments] = useState<Tables<'comments'>[]>([]);

  useEffect(() => {
    // 初始加载
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, user_id(name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (data) setComments(data);
    };

    fetchComments();

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case 'INSERT':
              setComments(prev => [...prev, newRecord as Tables<'comments'>]);
              break;
            case 'UPDATE':
              setComments(prev =>
                prev.map(c => (c.id === newRecord.id ? newRecord as Tables<'comments'> : c))
              );
              break;
            case 'DELETE':
              setComments(prev => prev.filter(c => c.id !== oldRecord.id));
              break;
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [postId]);

  return comments;
}

// 在线状态追踪
export function usePresence(roomId: string, userId: string) {
  const [users, setUsers] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        setUsers(new Map(Object.entries(newState)));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: userId,
          });
        }
      });

    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [roomId, userId]);

  return users;
}

// Broadcast（广播消息）
export function useBroadcast(roomId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`broadcast:${roomId}`);

    ch.on('broadcast', { event: 'message' }, (payload) => {
      setMessages(prev => [...prev, payload.payload]);
    }).subscribe();

    setChannel(ch);

    return () => {
      ch.unsubscribe();
    };
  }, [roomId]);

  const sendMessage = useCallback(async (message: any) => {
    await channel?.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });
  }, [channel]);

  return { messages, sendMessage };
}
```

## 六、文件存储（Storage）

### 6.1 存储桶配置

```sql
-- 创建存储桶（通过 SQL 或 Dashboard）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', false);

-- Storage RLS 策略
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_own_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 6.2 文件上传实战

```typescript
// src/lib/storage.ts - Storage 服务

import { supabase } from './supabase';

export class StorageService {
  // 上传头像
  static async uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    // 获取公开 URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // 更新用户 profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    return publicUrl;
  }

  // 上传文章图片
  static async uploadPostImage(postId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `posts/${postId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('posts')
      .upload(fileName, file);

    if (error) throw error;

    // 获取签名 URL（私有桶）
    const { data: signedUrlData } = await supabase.storage
      .from('posts')
      .createSignedUrl(fileName, 3600); // 1 小时有效

    return signedUrlData?.signedUrl;
  }

  // 批量上传
  static async uploadMultiple(
    bucket: string,
    files: File[],
    path: string
  ) {
    const uploads = files.map((file, index) => {
      const fileName = `${path}/${Date.now()}-${index}-${file.name}`;
      return supabase.storage.from(bucket).upload(fileName, file);
    });

    const results = await Promise.all(uploads);

    return results.map((result, index) => ({
      success: !result.error,
      path: result.data?.path,
      error: result.error,
    }));
  }

  // 删除文件
  static async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  // 列出文件
  static async listFiles(bucket: string, path: string) {
    const { data, error } = await supabase.storage.from(bucket).list(path, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    return data;
  }

  // 下载文件
  static async downloadFile(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    return data; // Blob
  }
}
```

## 七、Edge Functions

### 7.1 Edge Functions 基础

```typescript
// supabase/functions/hello-world/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const { name } = await req.json();

  return new Response(
    JSON.stringify({ message: `Hello, ${name}!` }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
    }
  );
});
```

### 7.2 实战：支付 Webhook

```typescript
// supabase/functions/payment-webhook/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  try {
    // 验证 webhook 签名
    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();

    // 验证签名逻辑（根据支付提供商不同）
    // const isValid = verifySignature(body, signature);
    // if (!isValid) {
    //   return new Response('Invalid signature', { status: 401 });
    // }

    const payload = JSON.parse(body);

    // 处理支付事件
    switch (payload.event) {
      case 'payment.completed':
        await handlePaymentCompleted(payload.data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload.data);
        break;
      case 'subscription.created':
        await handleSubscriptionCreated(payload.data);
        break;
      default:
        console.log('Unknown event:', payload.event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function handlePaymentCompleted(data: any) {
  const { user_id, amount, transaction_id } = data;

  // 更新订单状态
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      paid_at: new Date().toISOString(),
      transaction_id,
    })
    .eq('user_id', user_id)
    .eq('status', 'pending');

  if (error) throw error;

  // 发送邮件通知（可以调用其他 Edge Function 或第三方服务）
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      to: user_id,
      subject: 'Payment Completed',
      template: 'payment_completed',
      data: { amount, transaction_id },
    }),
  });
}

async function handlePaymentFailed(data: any) {
  // 记录失败日志
  await supabase.from('payment_logs').insert({
    user_id: data.user_id,
    event: 'payment_failed',
    data: data,
    created_at: new Date().toISOString(),
  });
}

async function handleSubscriptionCreated(data: any) {
  // 更新用户订阅状态
  await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_id: data.subscription_id,
      subscription_plan: data.plan,
    })
    .eq('id', data.user_id);
}
```

### 7.3 Cron 定时任务

```sql
-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每天凌晨清理过期会话
SELECT cron.schedule(
  'cleanup_expired_sessions',
  '0 0 * * *',  -- 每天午夜
  $$
  DELETE FROM auth.refresh_tokens
  WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);

-- 每小时更新热门文章
SELECT cron.schedule(
  'update_trending_posts',
  '0 * * * *',  -- 每小时
  $$
  UPDATE posts
  SET trending_score = (
    SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND created_at > NOW() - INTERVAL '24 hours'
  ) * 2 + view_count * 0.1;
  $$
);

-- 每周生成报告
SELECT cron.schedule(
  'weekly_report',
  '0 9 * * 1',  -- 每周一早上 9 点
  $$
  INSERT INTO weekly_reports (week_start, total_users, total_posts, total_comments)
  SELECT
    DATE_TRUNC('week', NOW()),
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM posts WHERE created_at > DATE_TRUNC('week', NOW()) - INTERVAL '1 week'),
    (SELECT COUNT(*) FROM comments WHERE created_at > DATE_TRUNC('week', NOW()) - INTERVAL '1 week');
  $$
);
```

## 八、完整项目实战：博客平台

```typescript
// src/app/blog/[slug]/page.tsx - 博客详情页

import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { Comments } from '@/components/Comments';
import { incrementViewCount } from '@/lib/posts';

export default async function PostPage({ params }: { params: { slug: string } }) {
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      user_id (name, avatar_url),
      tags (name, slug)
    `)
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (error || !post) notFound();

  // 增加浏览量
  await incrementViewCount(post.id);

  return (
    <article className="max-w-3xl mx-auto py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-gray-600">
          <img
            src={post.user_id.avatar_url || '/default-avatar.png'}
            alt={post.user_id.name}
            className="w-10 h-10 rounded-full"
          />
          <span>{post.user_id.name}</span>
          <span>·</span>
          <time>{new Date(post.created_at).toLocaleDateString()}</time>
          <span>·</span>
          <span>{post.view_count} views</span>
        </div>
        <div className="flex gap-2 mt-4">
          {post.tags.map((tag: any) => (
            <a
              key={tag.slug}
              href={`/blog/tag/${tag.slug}`}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm"
            >
              {tag.name}
            </a>
          ))}
        </div>
      </header>

      {post.cover_image && (
        <img src={post.cover_image} alt={post.title} className="w-full mb-8 rounded-lg" />
      )}

      <div className="prose prose-lg max-w-none">
        {post.content}
      </div>

      <hr className="my-12" />

      <Comments postId={post.id} />
    </article>
  );
}

// src/lib/posts.ts - 文章服务

import { supabase } from './supabase';

export async function getPosts(page = 1, pageSize = 10) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [postsResult, countResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, slug, excerpt, cover_image, created_at, user_id(name, avatar_url), tags(name)')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('published', true),
  ]);

  return {
    posts: postsResult.data || [],
    total: countResult.count || 0,
    totalPages: Math.ceil((countResult.count || 0) / pageSize),
  };
}

export async function getPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user_id (name, avatar_url),
      tags (id, name, slug)
    `)
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error) return null;
  return data;
}

export async function incrementViewCount(postId: string) {
  await supabase.rpc('increment_view_count', { post_id_param: postId });
}

export async function searchPosts(query: string) {
  const { data, error } = await supabase.rpc('search_posts', {
    search_query: query,
  });

  if (error) return [];
  return data;
}
```

## 九、部署与最佳实践

### 9.1 部署流程

```bash
# 1. 生成迁移
supabase db diff --schema public

# 2. 应用迁移到远程
supabase db push

# 3. 部署 Edge Functions
supabase functions deploy payment-webhook

# 4. 更新类型定义
supabase gen types typescript --project-id xxx > src/lib/database.types.ts
```

### 9.2 最佳实践清单

```
┌────────────────────────────────────────────────────────────┐
│                Supabase 最佳实践清单                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🔒 安全                                                   │
│  ├─ 启用 RLS（Row Level Security）                        │
│  ├─ 使用 anon key + RLS，而非 service_role key            │
│  ├─ 验证用户输入，防止 SQL 注入                           │
│  └─ 敏感操作使用 Edge Functions + service_role            │
│                                                            │
│  📊 性能                                                   │
│  ├─ 创建适当的索引                                        │
│  ├─ 使用 select 限定返回字段                              │
│  ├─ 避免 N+1：使用关联查询而非循环查询                    │
│  └─ 分页查询使用 range 或 cursor                          │
│                                                            │
│  🔄 实时                                                   │
│  ├─ 仅订阅必要的表和事件                                  │
│  ├─ 及时 unsubscribe 避免内存泄漏                         │
│  └─ 使用 presence 而非轮询实现在线状态                    │
│                                                            │
│  🚀 部署                                                   │
│  ├─ 使用迁移而非手动修改 schema                           │
│  ├─ 保持迁移文件版本控制                                  │
│  └─ 生产环境使用 service_role key 谨慎                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 十、总结

Supabase 以开源姿态和 PostgreSQL 的强大能力，为全栈开发者提供了一站式的后端解决方案。从数据库设计到认证、从实时订阅到文件存储、从 Edge Functions 到定时任务，所有服务开箱即用且彼此深度集成。

**选择 Supabase 的理由：**
- 开源透明，可自托管，无厂商锁定
- PostgreSQL 的完整能力：关系查询、事务、索引、全文搜索
- 开发者体验优先：Dashboard + CLI + 类型安全 SDK
- 定价透明，免费层 generous，适合个人项目和小团队

**不适合的场景：**
- 需要 MongoDB 文档模型的场景
- 需要极度复杂的数据库架构（考虑自托管 PostgreSQL）
- 需要中国内地低延迟访问（考虑自托管或国内云服务）

Supabase 是 Firebase 的最佳开源替代，也是 2024 年最值得关注的后端即服务平台。

---

*本文由小虾子 🦐 撰写*
