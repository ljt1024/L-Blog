# PostgreSQL 基础进阶完全指南：从入门到生产级实践

> PostgreSQL 是世界上最先进的开源关系数据库，从 1996 年诞生至今已走过近三十年。它不仅是 MySQL/MariaDB 的替代品，更是一个功能完备的对象-关系型数据库系统（ORDBMS），支持 JSON、全文搜索、GIS、向量存储、事件溯源等现代数据处理能力。本文面向有一定 SQL 基础的开发者，系统梳理 PostgreSQL 的核心知识体系，从基础操作到高级特性，助你构建生产级数据库技能。

## 一、PostgreSQL 核心概念

### 1.1 为什么是 PostgreSQL

```
┌────────────────────────────────────────────────────────────────┐
│                    PostgreSQL vs MySQL vs SQLite                │
├──────────────────────────┬──────────────────┬───────────────────┤
│         特性             │    PostgreSQL    │      MySQL        │
├──────────────────────────┼──────────────────┼───────────────────┤
│  数据库类型              │ ORDBMS（对象关系）│ RDBMS（纯关系）    │
│  诞生年份                │ 1996             │ 1995              │
│  SQL 标准遵循            │ ✅ 近乎完整      │ 部分（MySQL 扩展） │
│  MVCC 隔离级别           │ 全部 4 种        │ 3 种（缺 SERIALIZABLE）│
│  JSON 支持               │ ✅ 原生 JSONB    │ 5.7 后支持（较弱） │
│  全文搜索                │ ✅ 内置           │ 需插件             │
│  GIS/地理扩展            │ PostGIS（最强）  │ 有限支持           │
│  向量存储                │ pgvector（原生） │ 需插件             │
│  继承表                  │ ✅ 原生支持       │ ❌ 不支持          │
│  自定义类型              │ ✅ 完全支持       │ 有限支持           │
│  外部数据包装器          │ ✅ FDW（多源）    │ ❌ 不支持          │
│  触发器                  │ 行级 + 语句级     │ 仅语句级           │
│  并发控制                │ MVCC + 乐观锁     │ MVCC + 表级锁      │
│  索引类型                │ 7+ 种（BTREE/GIN/│ 3 种               │
│                          │ GIST/SP-GIST/    │                    │
│                          │ HASH/BRIN/COVERING)│                  │
├──────────────────────────┼──────────────────┼───────────────────┤
│  适用场景                │ 企业级/复杂查询/  │ 简单读写/Web 应用  │
│                          │ 金融/分析/GIS     │ 创业公司首选       │
└──────────────────────────┴──────────────────┴───────────────────┘
```

### 1.2 MVCC 机制：并发控制的秘密

PostgreSQL 的多版本并发控制（MVCC）是其区别于 MySQL 的核心优势之一：

```
┌──────────────────────────────────────────────────────────────────┐
│                       MVCC 工作原理                                │
│                                                                  │
│  传统锁模型（MySQL InnoDB）：                                    │
│  ┌────────┐    ┌────────┐    ┌────────┐                        │
│  │事务 A  │    │事务 B  │    │事务 C  │                        │
│  │读取    │───▶│写入🔒 │    │等待... │                        │
│  │🔒 读取 │    │提交后  │    │🔒 读取 │                        │
│  └────────┘    └────────┘    └────────┘                        │
│  问题：读写互斥，高并发下性能差                                   │
│                                                                  │
│  MVCC 模型（PostgreSQL）：                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                        表数据（多版本共存）                  │ │
│  │  行版本1 [x=10, xmin=A, xmax=nil] ← 事务A写入              │ │
│  │  行版本2 [x=20, xmin=B, xmax=nil] ← 事务B覆盖（事务A仍读旧）│ │
│  └─────────────────────────────────────────────────────────────┘ │
│  事务A视角：看到 x=10（自己的快照）                              │
│  事务B视角：看到 x=20（自己的快照）                              │
│  事务C视角：看到 x=20（最新已提交）                              │
│  优势：读写不互斥，并发性能大幅提升                               │
└──────────────────────────────────────────────────────────────────┘
```

```sql
-- PostgreSQL 为每行隐式添加的元数据
-- xmin: 创建该行版本的事务 ID
-- xmax: 删除/更新该行版本的事务 ID（nil 表示未被删除）
-- xmax != 0 时，该行对大多数事务不可见

-- 示例：观察 MVCC
BEGIN;
SELECT xmin, xmax, * FROM accounts WHERE id = 1;
-- 结果: xmin=100, xmax=0, balance=1000

-- 在另一会话中更新
UPDATE accounts SET balance = 2000 WHERE id = 1;
-- 此时第一个事务仍看到 balance=1000（MVCC 快照）

-- VACUUM 清理旧版本后，行版本1被回收
-- VACUUM 是 PostgreSQL 特有的维护操作
```

### 1.3 WAL 机制：数据安全的基石

```
写前日志（Write-Ahead Logging）保证数据持久性和一致性：

事务提交流程：
1. 数据变更写入 WAL 缓冲区
2. WAL 缓冲区刷盘（WAL 文件）
3. 数据页写入共享缓冲区
4. 后台进程将脏页刷到磁盘

崩溃恢复：
PostgreSQL 启动时 → 读取最新 WAL → 重放所有已提交事务 → 数据恢复到一致状态
```

## 二、数据库与模式管理

### 2.1 连接与基础操作

```sql
-- 连接到 PostgreSQL
psql -U postgres -d mydb -h localhost -p 5432

-- 或使用环境变量
export PGDATABASE=mydb
export PGUSER=postgres
psql

-- 常用 psql 元命令
\l                    -- 列出所有数据库
\d                    -- 列出当前库所有表
\d table_name         -- 查看表结构
\du                   -- 列出所有用户
\di                   -- 列出所有索引
\dv                   -- 列出所有视图
\dt+ table_name       -- 查看表详细信息（大小、行数）
\df                   -- 列出所有函数
\sf function_name     -- 查看函数定义
\x                    -- 切换扩展显示模式（行列转换）
\timing               -- 显示查询耗时
\password username    -- 修改用户密码
\conninfo             -- 当前连接信息
```

### 2.2 数据库与模式操作

```sql
-- 创建数据库
CREATE DATABASE myapp
  WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0
    CONNECTION LIMIT = 100;

-- 克隆数据库（完整复制）
CREATE DATABASE myapp_test
  WITH TEMPLATE myapp;

-- 修改数据库
ALTER DATABASE myapp SET statement_timeout = '5s';
ALTER DATABASE myapp RENAME TO myapp_prod;

-- 删除数据库（必须先断开所有连接）
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'mydb' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS myapp;

-- ===== 模式（Schema）=====
-- 模式是数据库内的命名空间，类似于 MySQL 的数据库概念
-- PostgreSQL 一个实例可包含多个数据库，每个数据库可包含多个模式

-- 创建模式
CREATE SCHEMA IF NOT EXISTS blog;

-- 指定所有者
CREATE SCHEMA analytics AUTHORIZATION admin_user;

-- 在特定模式中创建对象
CREATE TABLE blog.posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL
);

-- 设置搜索路径（默认查找顺序）
SHOW search_path;
SET search_path TO blog, public, "$user";

-- 永久设置搜索路径
ALTER DATABASE myapp SET search_path TO blog, public;

-- 删除模式
DROP SCHEMA blog CASCADE;  -- CASCADE 同时删除所有对象
```

## 三、表与数据类型

### 3.1 常用数据类型详解

```sql
-- ===== 数值类型 =====

-- 整数
SMALLINT / INT2     -- 2字节, -32768~32767
INTEGER / INT / INT4 -- 4字节, -21亿~21亿（最常用）
BIGINT / INT8       -- 8字节, ±9.2×10¹⁸

-- 精确小数（用于货币计算）
DECIMAL(10, 2)      -- 总10位，小数2位（精确）
NUMERIC(10, 2)      -- DECIMAL 的别名，完全等价

-- 浮点数
REAL / FLOAT4       -- 4字节，6位精度
DOUBLE PRECISION / FLOAT8 -- 8字节，15位精度
-- 注意：浮点运算不精确，货币计算用 DECIMAL

-- 序列（自增）
SERIAL               -- 4字节自增（最常用）
BIGSERIAL            -- 8字节自增
SMALLSERIAL          -- 2字节自增

-- ===== 字符类型 =====

CHAR(10)             -- 定长，不足补空格（适合固定长度如手机号）
VARCHAR(255)         -- 变长，有最大长度限制（最灵活）
TEXT                 -- 变长，无长度限制（PostgreSQL 最推荐）
-- 存储建议：大多数场景用 TEXT，VARCHAR 仅在需要限制长度时使用

-- ===== 日期时间类型 =====

DATE                 -- 仅日期（2024-08-24）
TIME                 -- 仅时间（14:30:00）
TIMESTAMP            -- 日期时间，无时区（2024-08-24 14:30:00）
TIMESTAMPTZ          -- 日期时间，带时区（2024-08-24 14:30:00+08:00）

-- 当前时间函数
NOW() :: TIMESTAMPTZ           -- 当前时刻（含时区）
CURRENT_TIMESTAMP               -- NOW() 的 SQL 标准别名
CURRENT_DATE                    -- 当前日期
CURRENT_TIME                    -- 当前时间

-- INTERVAL 时间间隔
SELECT NOW() - INTERVAL '7 days';  -- 7天前
SELECT NOW() + INTERVAL '3 hours';  -- 3小时后
SELECT EXTRACT(YEAR FROM NOW());    -- 提取年份
SELECT DATE_TRUNC('month', NOW());  -- 月初

-- ===== 布尔与枚举 =====

BOOLEAN              -- TRUE/FALSE/null（也接受 't'/'f'/'1'/'0'）

-- 枚举类型（PostgreSQL 原生支持）
CREATE TYPE order_status AS ENUM (
  'pending',   -- 待处理
  'processing', -- 处理中
  'shipped',    -- 已发货
  'delivered',  -- 已送达
  'cancelled'   -- 已取消
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加枚举值（可追加，不可删除已有值）
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';
```

### 3.2 JSON 与数组类型

```sql
-- ===== JSON / JSONB 类型 =====
-- JSON: 存储原始 JSON，保留格式
-- JSONB: 二进制存储，索引友好，性能更好（推荐）

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  event_type TEXT,
  payload JSONB,           -- JSONB 推荐
  metadata JSON,            -- 仅当需要保留格式时用 JSON
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JSONB 写入
INSERT INTO events (event_type, payload) VALUES (
  'user_signup',
  '{
    "user_id": "123",
    "plan": "free",
    "referral": null,
    "utm": {
      "source": "google",
      "medium": "cpc"
    }
  }' :: JSONB
);

-- JSONB 查询
SELECT payload->>'user_id' AS user_id        -- 提取为文本
FROM events
WHERE payload->>'plan' = 'premium';           -- 路径过滤

-- JSONB 包含查询（索引友好）
SELECT * FROM events
WHERE payload @> '{"plan": "premium"}'::JSONB;  -- payload 包含该对象
WHERE payload ? 'referral';                     -- 包含某键
WHERE payload ?| array['plan', 'utm'];          -- 包含任一键

-- JSONB 索引（最重要！）
CREATE INDEX idx_events_payload ON events USING GIN (payload);
-- GIN 索引支持 @>, ?, ?|, ?& 等 JSONB 操作符，查询效率极高

-- 更新 JSONB 字段
UPDATE events
SET payload = jsonb_set(payload, '{plan}', '"enterprise"')
WHERE payload->>'user_id' = '123';

UPDATE events
SET payload = payload || '{"upgraded": true}'::JSONB;  -- 合并

UPDATE events
SET payload = payload - 'referral';  -- 删除字段

-- ===== 数组类型 =====

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT,
  skills TEXT[],             -- 数组字段
  phone_numbers TEXT ARRAY,
  scores INTEGER[3]          -- 固定长度数组
);

-- 数组写入
INSERT INTO employees (name, skills) VALUES
  ('Alice', ARRAY['Python', 'PostgreSQL', 'Docker']),
  ('Bob', '{"Go", "Kubernetes"}');  -- 两种写法等价

-- 数组查询
SELECT * FROM employees
WHERE 'PostgreSQL' = ANY(skills);          -- 包含某元素
WHERE skills && ARRAY['Python', 'Go'];     -- 包含任一元素
WHERE skills @> ARRAY['Python'];           -- 包含所有元素
WHERE array_length(skills, 1) > 2;         -- 数组长度 > 2

-- 数组函数
SELECT unnest(skills) FROM employees;  -- 展开为多行
SELECT array_agg(name) FROM employees; -- 聚合为数组
SELECT array_upper(skills, 1) FROM employees; -- 数组上界
SELECT array_to_string(skills, ', ') FROM employees; -- 数组转字符串

-- 数组索引
CREATE INDEX idx_employees_skills ON employees USING GIN (skills);
```

### 3.3 约束与触发器

```sql
-- ===== 约束详解 =====

CREATE TABLE products (
  id SERIAL PRIMARY KEY,

  -- 非空约束
  name TEXT NOT NULL,

  -- 唯一约束（可命名）
  sku TEXT UNIQUE CONSTRAINT unique_sku,

  -- 检查约束（强大！数据库层业务规则）
  price DECIMAL(10,2) NOT NULL
    CONSTRAINT positive_price CHECK (price > 0),

  quantity INTEGER NOT NULL DEFAULT 0
    CONSTRAINT non_negative_qty CHECK (quantity >= 0),

  category TEXT NOT NULL
    CONSTRAINT valid_category
    CHECK (category IN ('electronics', 'clothing', 'food')),

  discount DECIMAL(3,2)
    CONSTRAINT max_discount CHECK (
      discount IS NULL OR discount BETWEEN 0 AND 1
    ),

  -- 排他约束（独特的索引约束）
  exclude_daterange EXCLUDE USING GIST (
    period WITH &&
  ) WHERE (status = 'active'),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 表级约束
  CONSTRAINT price_vs_discount CHECK (
    price * (1 - COALESCE(discount, 0)) >= 0
  )
);

-- ===== 触发器 =====

-- 场景：自动更新 updated_at 时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 场景：审计日志——记录数据变更历史
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,        -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, action, new_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      to_jsonb(NEW),
      current_user
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, action, old_data, new_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      to_jsonb(OLD),
      to_jsonb(NEW),
      current_user
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, action, old_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      to_jsonb(OLD),
      current_user
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为表创建审计触发器
CREATE TRIGGER products_audit
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 条件触发器（仅在特定条件下触发）
CREATE TRIGGER log_orders_only_high_value
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.total > 10000)  -- 仅高价值订单记录审计
  EXECUTE FUNCTION audit_trigger_function();
```

## 四、高级查询

### 4.1 关联查询与集合操作

```sql
-- ===== 基础连接（JOIN）=====

-- INNER JOIN：仅保留匹配行
SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN：保留左表所有行
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
-- 未匹配的右表字段为 NULL

-- RIGHT JOIN：保留右表所有行
-- FULL OUTER JOIN：保留两边所有行

-- CROSS JOIN：笛卡尔积（慎用）
SELECT * FROM sizes CROSS JOIN colors;

-- ===== 多表连接与别名 =====

SELECT
  p.title,
  u.name AS author_name,
  c.name AS category_name,
  COUNT(DISTINCT cm.id) AS comment_count
FROM posts p
JOIN users u ON p.user_id = u.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN comments cm ON p.id = cm.post_id
WHERE p.published = true
  AND p.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, u.name, c.name
HAVING COUNT(DISTINCT cm.id) >= 3
ORDER BY p.created_at DESC
LIMIT 20;

-- ===== 集合操作（UNION/INTERSECT/EXCEPT）=====

-- UNION：合并去重
SELECT email FROM users
UNION
SELECT email FROM admins;  -- 自动去重

-- UNION ALL：合并不去重（更快）
SELECT email FROM users
UNION ALL
SELECT email FROM admins;  -- 保留所有行

-- INTERSECT：交集
SELECT email FROM users
INTERSECT
SELECT email FROM newsletter_subscribers;

-- EXCEPT：差集（在A中但不在B中）
SELECT email FROM users
EXCEPT
SELECT email FROM blocked_users;
```

### 4.2 子查询与 CTE（公用表表达式）

```sql
-- ===== 标量子查询 =====

-- 查询价格高于平均价的商品
SELECT name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products);

-- 查询每个用户的订单数（使用标量子查询）
SELECT
  name,
  (SELECT COUNT(*) FROM orders WHERE user_id = users.id) AS order_count
FROM users;

-- ===== 表子查询 =====

SELECT *
FROM (
  SELECT
    p.*,
    u.name AS author_name,
    RANK() OVER (PARTITION BY u.id ORDER BY p.view_count DESC) AS rank
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.published = true
) AS ranked_posts
WHERE rank <= 3;  -- 每个作者排名前3的文章

-- ===== CTE（WITH 子句）—— 更清晰的可读写法 =====

-- 普通 CTE
WITH
  active_users AS (
    SELECT id, name, email
    FROM users
    WHERE last_login > NOW() - INTERVAL '30 days'
  ),
  user_orders AS (
    SELECT user_id, SUM(total) AS total_spent, COUNT(*) AS order_count
    FROM orders
    WHERE user_id IN (SELECT id FROM active_users)
    GROUP BY user_id
  )
SELECT
  au.name,
  au.email,
  COALESCE(uo.total_spent, 0) AS total_spent,
  COALESCE(uo.order_count, 0) AS order_count
FROM active_users au
LEFT JOIN user_orders uo ON au.id = uo.user_id
ORDER BY total_spent DESC;

-- 递归 CTE（树形结构遍历）
-- 示例：组织架构树
WITH RECURSIVE org_tree AS (
  -- 基础查询（根节点）
  SELECT
    id,
    name,
    manager_id,
    1 AS depth,
    name::TEXT AS path
  FROM employees
  WHERE manager_id IS NULL  -- CEO（根节点）

  UNION ALL

  -- 递归部分
  SELECT
    e.id,
    e.name,
    e.manager_id,
    ot.depth + 1,
    ot.path || ' > ' || e.name
  FROM employees e
  JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree ORDER BY path;

-- 递归 CTE：评论嵌套结构
WITH RECURSIVE comment_tree AS (
  -- 顶级评论
  SELECT
    id,
    content,
    parent_id,
    1 AS depth,
    ARRAY[id] AS path
  FROM comments
  WHERE parent_id IS NULL

  UNION ALL

  -- 子评论
  SELECT
    c.id,
    c.content,
    c.parent_id,
    ct.depth + 1,
    ct.path || c.id
  FROM comments c
  JOIN comment_tree ct ON c.parent_id = ct.id
)
SELECT
  REPEAT('  ', depth - 1) || content AS indented_comment
FROM comment_tree
ORDER BY path;
```

### 4.3 窗口函数（Window Functions）

窗口函数是 PostgreSQL 最强大的查询特性之一，它在不对数据进行分组聚合的情况下，计算基于"窗口"（一组相关行）的聚合或排名：

```sql
-- ===== 窗口函数核心概念 =====

-- 窗口函数 vs 聚合函数的区别：
-- 聚合函数：N 行 → 1 行（GONE BY 将数据压缩）
-- 窗口函数：N 行 → N 行（保留原始行，增加计算列）

-- 基础语法
SELECT
  name,
  department,
  salary,
  -- 聚合为窗口
  AVG(salary) OVER (PARTITION BY department) AS dept_avg_salary,
  SUM(salary) OVER (PARTITION BY department) AS dept_total_salary,
  COUNT(*) OVER (PARTITION BY department) AS dept_count,

  -- 占部门工资的比例
  ROUND(
    salary::NUMERIC / SUM(salary) OVER (PARTITION BY department) * 100,
    1
  ) AS pct_of_dept,

  -- 占公司总工资的比例
  ROUND(
    salary::NUMERIC / SUM(salary) OVER () * 100,
    1
  ) AS pct_of_total
FROM employees;

-- ===== 排名窗口函数 =====

SELECT
  name,
  department,
  salary,
  -- 部门内排名（1=最高）
  RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank,
  -- 排名（允许并列，跳过）
  DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rank,
  -- 排名（允许并列，不跳过）
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
  -- 百分比排名（0-1）
  PERCENT_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS pct_rank,
  -- 四分位数
  NTILE(4) OVER (PARTITION BY department ORDER BY salary DESC) AS quartile
FROM employees;

-- ===== 导航窗口函数 =====

SELECT
  name,
  hire_date,
  salary,
  -- 前一行（按分区排序）
  LAG(salary) OVER (PARTITION BY department ORDER BY hire_date) AS prev_salary,
  -- 前N行
  LAG(salary, 2) OVER (PARTITION BY department ORDER BY hire_date) AS prev_2_salary,
  -- 后一行
  LEAD(salary) OVER (PARTITION BY department ORDER BY hire_date) AS next_salary,
  -- 后一行（自定义默认值）
  LEAD(salary, 1, 0) OVER (PARTITION BY department ORDER BY hire_date) AS next_salary_default,

  -- 与前一行差值
  salary - LAG(salary) OVER (PARTITION BY department ORDER BY hire_date) AS salary_change,
  -- 与部门平均差值
  salary - AVG(salary) OVER (PARTITION BY department) AS vs_dept_avg
FROM employees;

-- ===== FIRST_VALUE / LAST_VALUE / NTH_VALUE =====

SELECT
  name,
  department,
  hire_date,
  salary,
  FIRST_VALUE(salary) OVER (
    PARTITION BY department
    ORDER BY hire_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  -- 默认是 RANGE
  ) AS first_salary_in_dept,

  LAST_VALUE(salary) OVER (
    PARTITION BY department
    ORDER BY hire_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS last_salary_in_dept,

  NTH_VALUE(salary, 3) OVER (
    PARTITION BY department
    ORDER BY hire_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS third_salary_in_dept
FROM employees;

-- ===== 窗口帧（Window Frame）=====

-- 累计求和（分区内，从开头到当前行）
SELECT
  date,
  revenue,
  SUM(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  -- 累计到当前行
  ) AS cumulative_revenue,

  -- 移动平均（最近7天）
  AVG(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW  -- 当前行+前6行=7天
  ) AS moving_avg_7d,

  -- 移动平均（前后各3天）
  AVG(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
  ) AS moving_avg_centered,

  -- 当前行对比前后行的最大值
  MAX(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
  ) AS local_max
FROM daily_revenue
ORDER BY date;

-- ===== 实际案例：计算用户留存率 =====

WITH daily_users AS (
  SELECT DATE(created_at) AS signup_date, id
  FROM users
),
first_activity AS (
  SELECT id, signup_date, MIN(DATE(created_at)) AS first_active_date
  FROM events
  GROUP BY id, signup_date
),
retention AS (
  SELECT
    fu.signup_date,
    COUNT(DISTINCT fu.id) AS d0_users,
    COUNT(DISTINCT CASE WHEN fa.first_active_date = fu.signup_date + INTERVAL '1 day' THEN fu.id END) AS d1_users,
    COUNT(DISTINCT CASE WHEN fa.first_active_date = fu.signup_date + INTERVAL '7 days' THEN fu.id END) AS d7_users
  FROM first_activity fa
  JOIN daily_users fu ON fa.id = fu.id
  GROUP BY fu.signup_date
)
SELECT
  signup_date,
  d0_users,
  d1_users,
  ROUND(d1_users::NUMERIC / d0_users * 100, 2) AS d1_retention_pct,
  d7_users,
  ROUND(d7_users::NUMERIC / d0_users * 100, 2) AS d7_retention_pct
FROM retention
ORDER BY signup_date DESC;
```

### 4.4 复杂查询综合实战

```sql
-- 场景：电商平台销售报表
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH monthly_sales AS (
  SELECT
    DATE_TRUNC('month', o.created_at) AS month,
    u.region,
    u.tier,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(o.total) AS gmv,
    SUM(o.total) / COUNT(DISTINCT o.id) AS aov,
    COUNT(DISTINCT o.user_id) AS unique_customers
  FROM orders o
  JOIN users u ON o.user_id = u.id
  WHERE o.status NOT IN ('cancelled', 'refunded')
    AND o.created_at >= NOW() - INTERVAL '12 months'
  GROUP BY 1, 2, 3
),
monthly_growth AS (
  SELECT
    month,
    region,
    tier,
    gmv,
    LAG(gmv) OVER (
      PARTITION BY region, tier
      ORDER BY month
    ) AS prev_month_gmv,
    ROUND(
      (gmv - LAG(gmv) OVER (PARTITION BY region, tier ORDER BY month))::NUMERIC
      / LAG(gmv) OVER (PARTITION BY region, tier ORDER BY month) * 100,
      2
    ) AS mom_growth_pct,
    -- 同比
    LAG(gmv, 12) OVER (
      PARTITION BY region, tier
      ORDER BY month
    ) AS prev_year_gmv
  FROM monthly_sales
)
SELECT
  TO_CHAR(month, 'YYYY-MM') AS month,
  region,
  tier,
  order_count,
  unique_customers,
  ROUND(gmv, 2) AS gmv,
  ROUND(aov, 2) AS aov,
  mom_growth_pct,
  COALESCE(
    ROUND(
      (gmv - prev_year_gmv)::NUMERIC / prev_year_gmv * 100, 2
    ),
    0
  ) AS yoy_growth_pct
FROM monthly_growth
ORDER BY month DESC, gmv DESC;
```

## 五、索引与性能优化

### 5.1 索引类型全解

```
┌────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 索引类型对比                           │
├─────────────┬─────────────────────────────────┬───────────────────┤
│  索引类型    │ 适用场景                         │ 特点               │
├─────────────┼─────────────────────────────────┼───────────────────┤
│ BTREE       │ 等值查询、范围查询、排序          │ 默认，最常用       │
│ GIN         │ 数组包含、全文搜索、JSONB          │ 倒排索引           │
│ GIST        │ 几何类型、GIS、范围类型、全文搜索  │ 通用搜索树         │
│ SP-GIST     │ 非平衡结构、几何类型              │ 分区空间树         │
│ HASH        │ 仅等值查询（大字段）              │ 最快等值查询       │
│ BRIN        │ 物理顺序相关的大表（时序数据）    │ 极小空间占用       │
│ Partial     │ 过滤条件固定的查询                │ 减少索引体积       │
│ Covering    │ 覆盖索引（减少回表）              │ 索引覆盖查询       │
└─────────────┴─────────────────────────────────┴───────────────────┘
```

### 5.2 索引创建与使用

```sql
-- ===== BTREE 索引（默认）=====

-- 单列索引
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- 复合索引（列顺序很重要！）
CREATE INDEX idx_posts_user_published ON posts(user_id, published);
-- 等效查询：WHERE user_id = X AND published = Y
--            WHERE user_id = X（可以）
--            WHERE published = Y（不可以！）

-- 表达式索引
CREATE INDEX idx_posts_title_lower ON posts(LOWER(title));

-- 部分索引（只索引满足条件的行）
CREATE INDEX idx_posts_published ON posts(created_at)
  WHERE published = true;  -- 只索引已发布的文章
-- 优势：索引体积小、写入更快、仅覆盖目标查询

CREATE INDEX idx_users_active ON users(last_login)
  WHERE deleted_at IS NULL AND status = 'active';

-- ===== GIN 索引（数组/全文搜索）=====

CREATE INDEX idx_products_tags ON products USING GIN(tags);

CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- 全文搜索索引
CREATE INDEX idx_posts_fts ON posts
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- ===== BRIN 索引（时序数据）=====
-- 适合物理存储顺序与逻辑顺序一致的大表（时序数据、日志）

CREATE INDEX idx_logs_created_at ON logs USING BRIN(created_at);
-- 存储空间约为 BTREE 的 1%，但仅在数据物理有序时高效

-- ===== 多列 BRIN（分区表）=====
CREATE INDEX idx_partitioned_logs ON logs USING BRIN(created_at, partition_key);

-- ===== 唯一索引 =====
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 唯一索引 + 部分条件
CREATE UNIQUE INDEX idx_posts_slug_published ON posts(slug)
  WHERE published = true;  -- 仅对已发布文章强制唯一

-- ===== 索引分析与优化 =====

-- 查看查询执行计划
EXPLAIN SELECT * FROM posts WHERE user_id = 'xxx';

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.*, u.name
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.published = true
ORDER BY p.created_at DESC
LIMIT 10;
-- ANALYZE: 实际执行并显示时间
-- BUFFERS: 显示缓存命中情况
-- FORMAT TEXT/JSON/YAML: 输出格式

-- 查看索引使用情况
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 查找未使用的索引
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  idx_scan
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE idx_scan = 0
  AND NOT indisunique
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- 删除未使用的索引
DROP INDEX IF EXISTS idx_unused_index;

-- 创建索引（并发执行，不锁表）
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts(created_at);
DROP INDEX CONCURRENTLY IF EXISTS idx_old_index;
```

### 5.3 EXPLAIN 解读

```sql
-- ===== EXPLAIN 输出详解 =====

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  u.name,
  COUNT(p.id) AS post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name
ORDER BY post_count DESC
LIMIT 20;

-- 预期输出（简化）：
-- Limit  (cost=xxx..xxx rows=20 width=xxx)
--   ->  Sort  (cost=xxx..xxx rows=xxx width=xxx)
--         Sort Key: (COUNT(p.id)) DESC
--         Sort Method: top-N heapsort
--         ->  Hash Left Join  (cost=xxx..xxx rows=xxx width=xxx)
--               Hash Cond: (u.id = p.user_id)
--               ->  Seq Scan on users  (cost=xxx..xxx rows=xxx width=xxx)
--                     Filter: (created_at > '2024-07-25')
--                     Rows Removed by Filter: xxx
--               ->  Hash  (cost=xxx..xxx rows=xxx width=xxx)
--                     ->  Seq Scan on posts  (cost=xxx..xxx rows=xxx width=xxx)

-- 关键指标解读：
-- cost=start..end: 预估代价（start=启动代价, end=总代价）
--                  1 cost ≈ 读取1个磁盘页的代价
-- rows=xxx: 预估返回行数
-- actual rows=xxx: 实际返回行数（ANALYZE 时显示）
-- actual time=xxx..xxx: 实际耗时（启动..结束，毫秒）
-- Buffers: shared hit=从缓存读, read=从磁盘读
-- Rows Removed by Filter: 被过滤掉的行数（越大说明效率低）

-- ===== 常见操作节点类型 =====

-- Seq Scan: 全表扫描（小表、过滤后数据量大时正常）
-- Index Scan: 索引扫描（从索引定位到数据行）
-- Index Only Scan: 纯索引扫描（无需回表，数据全在索引中）
-- Bitmap Heap Scan: 位图扫描（多列索引，大量数据时比 Index Scan 更优）
-- Nested Loop: 嵌套循环连接（小表驱动大表时高效）
-- Hash Join: 哈希连接（大表等值连接）
-- Merge Join: 归并连接（已排序的数据）
-- Sort: 排序
-- Hash: 哈希聚合
-- Aggregate: 聚合函数
-- Limit: 限制返回行数

-- ===== 常见问题诊断 =====

-- 问题1：Seq Scan on large table
-- 解决：添加 WHERE 条件索引，或 ANALYZE 更新统计信息
SET statistics = 100;  -- 增加统计收集精度
ALTER TABLE posts ALTER COLUMN user_id SET STATISTICS 500;
ANALYZE posts;

-- 问题2：预估行数 vs 实际行数差异巨大
-- 解决：ANALYZE + 增加 default_statistics_target
SET default_statistics_target = 500;
ANALYZE posts;

-- 问题3：Hash Join 内存溢出
-- 解决：增加 work_mem 或改写查询
SET work_mem = '256MB';
```

### 5.4 VACUUM 与自动维护

```sql
-- ===== VACUUM：清理死亡元组 =====
-- MVCC 机制下，被 UPDATE/DELETE 的行版本不会立即删除
-- VACUUM 回收这些空间，但不阻塞并发读写

VACUUM posts;                           -- 清理指定表
VACUUM VERBOSE posts;                   -- 显示详细输出
VACUUM FULL posts;                      -- 彻底回收（会锁表，生产慎用！）
VACUUM (ANALYZE) posts;                -- 清理 + 更新统计信息

-- ===== AUTOVACUUM：自动清理 =====
-- PostgreSQL 默认启用 AUTOVACUUM，无需手动干预
-- 参数配置（postgresql.conf）

-- 触发阈值：当 dead tuples 超过 threshold 时触发
-- table: autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * 表格行数
ALTER TABLE posts SET (autovacuum_vacuum_scale_factor = 0.01);  -- 1% 触发
ALTER TABLE posts SET (autovacuum_analyze_scale_factor = 0.005); -- 0.5% 触发

-- 高频更新表的优化配置
ALTER TABLE counters SET (
  autovacuum_vacuum_threshold = 100,
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_analyze_scale_factor = 0,
  autovacuum_vacuum_cost_delay = 2ms  -- 降低 IO 影响
);

-- ===== ANALYZE：更新统计信息 =====
-- 统计信息用于查询优化器制定执行计划
ANALYZE posts;                          -- 分析指定表
ANALYZE;                                -- 分析所有表
ANALYZE VERBOSE posts;                  -- 详细输出

-- ===== 查看表膨胀 =====
SELECT
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_pct,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- ===== 监控连接数 =====
SELECT
  state,
  COUNT(*) AS count,
  pg_blocking_pids(pid) AS blocked_by
FROM pg_stat_activity
WHERE datname = 'mydb'
GROUP BY state, pg_blocking_pids(pid);
```

## 六、分区与扩展

### 6.1 表分区（Partitioning）

```sql
-- ===== 范围分区（RANGE）=====
-- 按时间分区是最常见的分区策略

CREATE TABLE orders (
  id SERIAL,
  user_id INTEGER NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- 创建分区（按月）
CREATE TABLE orders_2024_01 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02 PARTITION OF orders
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE orders_2024_03 PARTITION OF orders
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- 创建未来默认分区（捕获未匹配的数据）
CREATE TABLE orders_future PARTITION OF orders DEFAULT;

-- ===== 列表分区（LIST）=====

CREATE TABLE products (
  id SERIAL,
  name TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2)
) PARTITION BY LIST (category);

CREATE TABLE products_electronics PARTITION OF products
  FOR VALUES IN ('electronics', 'computers', 'phones');

CREATE TABLE products_clothing PARTITION OF products
  FOR VALUES IN ('clothing', 'shoes', 'accessories');

-- ===== 分区表索引 =====
-- 每个分区会自动继承父表的索引定义

CREATE INDEX ON orders(user_id);
CREATE INDEX ON orders(status);

-- 性能优势：
-- 1. 查询裁剪（PRUNE）：只扫描相关分区
--    SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'
--    → 自动只扫描 orders_2024_01，跳过其他分区
-- 2. 独立维护：可以单独 VACUUM/REINDEX 分区
-- 3. 批量删除：使用 DROP TABLE 代替 DELETE（瞬间完成）

-- ===== 分区裁剪验证 =====
EXPLAIN SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-15' AND '2024-01-20';

-- 应看到：Index Scan using orders_2024_01_pkey on orders_2024_01
-- 而非：Seq Scan on orders
```

### 6.2 常用扩展

PostgreSQL 的扩展生态是其强大之处，以下是生产必备扩展：

```sql
-- ===== pg_stat_statements（查询性能统计）=====
-- 必须添加到 postgresql.conf 的 shared_preload_libraries
-- shared_preload_libraries = 'pg_stat_statements'

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 查看最慢的查询
SELECT
  query,
  calls,
  total_exec_time / 1000 AS total_seconds,
  mean_exec_time AS avg_ms,
  rows / calls AS avg_rows,
  ROUND(stddev_exec_time, 2) AS stddev_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- 查看最频繁的查询
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- 重置统计（需要超级用户）
SELECT pg_stat_statements_reset();

-- ===== pg_trgm（模糊匹配/相似度搜索）=====

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);

-- 模糊搜索
SELECT name, similarity(name, 'alise') AS sim
FROM users
WHERE name % 'alise'  -- 相似度匹配（返回相似度 > 0.3 的行）
ORDER BY similarity(name, 'alise') DESC;

-- 相似度阈值搜索
SELECT name
FROM users
WHERE similarity(name, 'alise') > 0.5;

-- ===== uuid-ossp（UUID 生成）=====

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT uuid_generate_v4();          -- v4 随机 UUID
SELECT uuid_generate_v1();           -- v1 时间戳 UUID
SELECT uuid_generate_v1mc();        -- v1mc 多播 MAC UUID（隐私友好）

-- ===== hstore（键值存储）=====

CREATE EXTENSION IF NOT EXISTS hstore;

ALTER TABLE users ADD COLUMN metadata hstore;

UPDATE users SET metadata = hstore(ARRAY['key1', 'value1', 'key2', 'value2']);

SELECT metadata->'key1' FROM users WHERE metadata?'key1';

-- ===== citext（大小写不敏感文本）=====

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email CITEXT UNIQUE
);

-- citext 自动忽略大小写，无需 LOWER()
INSERT INTO users (email) VALUES ('Test@Example.com');
INSERT INTO users (email) VALUES ('test@example.com');  -- 会报唯一约束冲突！
```

## 七、事务与并发控制

### 7.1 事务隔离级别

```sql
-- PostgreSQL 支持全部 4 种标准隔离级别

-- READ COMMITTED（默认）：只能看到已提交的数据
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- 其他事务未提交的修改不可见
-- 其他事务已提交的修改才可见（每次查询都重新获取快照）

-- REPEATABLE READ：事务内多次读取结果一致
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- 事务开始时创建快照，整个事务内不变
-- 写入冲突时触发 serialization failure（需重试）

-- SERIALIZABLE：最强隔离，事务按串行执行
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- 严格串行化，可避免幻读（Phantom Read）
-- 性能最低，适用于严格一致性要求的场景

-- READ UNCOMMITTED（PostgreSQL 等同于 READ COMMITTED）
-- MVCC 机制使 READ UNCOMMITTED 无实际意义

-- 设置默认隔离级别（postgresql.conf）
-- default_transaction_isolation = 'read committed'
```

### 7.2 事务与保存点

```sql
-- ===== 基础事务 =====

BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;  -- 全部成功

BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- 出现错误
ROLLBACK;  -- 全部回滚

-- ===== 保存点（Savepoint）=====

BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;

SAVEPOINT sp1;  -- 创建保存点

UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- 决定只保留第一个 UPDATE，回滚第二个
ROLLBACK TO SAVEPOINT sp1;

-- 继续执行，提交第一个 UPDATE
COMMIT;  -- balance(id=1) = -100, balance(id=2) = 不变

-- ===== 事务嵌套 =====

BEGIN;  -- 事务1
  INSERT INTO logs(event) VALUES ('start');

  SAVEPOINT nested;
    INSERT INTO logs(event) VALUES ('nested');
    ROLLBACK TO SAVEPOINT nested;  -- 回滚嵌套事务

  INSERT INTO logs(event) VALUES ('after rollback');

COMMIT;  -- 只提交 start 和 after rollback

-- ===== 隔离级别与并发问题 =====

-- 脏读（Dirty Read）：读取未提交数据
-- PostgreSQL: 不允许（所有隔离级别都禁止）

-- 不可重复读（Non-repeatable Read）：同一事务两次读取结果不同
-- PostgreSQL READ COMMITTED: 可能发生
-- PostgreSQL REPEATABLE READ / SERIALIZABLE: 不会发生

-- 幻读（Phantom Read）：同一事务两次查询返回的行数不同
-- PostgreSQL REPEATABLE READ: 可能发生（PostgreSQL 实际实现比标准更严格）
-- PostgreSQL SERIALIZABLE: 不会发生

-- 序列化异常（Serialization Anomaly）
-- PostgreSQL SERIALIZABLE: 防止，可通过重试解决
```

## 八、实用管理命令

```sql
-- ===== 数据库大小 =====
SELECT
  pg_database.datname AS database_name,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

-- ===== 表大小 =====
-- 数据大小（不含索引）
SELECT pg_size_pretty(pg_relation_size('posts'));

-- 总大小（含索引）
SELECT pg_size_pretty(pg_total_relation_size('posts'));

-- 索引大小
SELECT pg_size_pretty(pg_indexes_size('posts'));

-- 所有表大小排名
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size,
  pg_size_pretty(pg_indexes_size(relid)) AS index_size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- ===== 慢查询配置 =====
-- 记录超过 100ms 的查询
ALTER SYSTEM SET log_min_duration_statement = '100ms';
SELECT pg_reload_conf();

-- 或仅在当前会话设置
SET log_min_duration_statement = '100ms';

-- ===== 连接与性能监控 =====
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  backend_start,
  state,
  query,
  state_change,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY backend_start;

-- 终止长时间运行的查询
SELECT pg_cancel_backend(pid)  -- 优雅取消（推荐）
  , pg_terminate_backend(pid);  -- 强制终止（最后手段）

-- ===== 序列（Serial）的当前值 =====
SELECT last_value FROM orders_id_seq;

-- 重置序列（慎用！）
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));

-- ===== 查看当前连接配置 =====
SHOW all;

-- 常用配置
SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;
SHOW effective_cache_size;
SHOW maintenance_work_mem;
SHOW random_page_cost;
SHOW effective_io_concurrency;
```

## 九、最佳实践总结

```
┌──────────────────────────────────────────────────────────────┐
│               PostgreSQL 开发与运维最佳实践                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📐 设计与建模                                               │
│  ├─ 为每个表定义主键（推荐 UUID 或 BIGSERIAL）              │
│  ├─ 为频繁查询的列创建索引（BTREE 满足大多数场景）         │
│  ├─ 使用部分索引减少索引体积（published=true 等）          │
│  ├─ 大文本用 TEXT，不用 VARCHAR(255)（PostgreSQL 无惩罚）  │
│  └─ 时间序数据考虑分区表                                   │
│                                                              │
│  🔍 查询优化                                                 │
│  ├─ 始终用 EXPLAIN ANALYZE 验证查询计划                     │
│  ├─ 避免 SELECT *，明确列出需要的字段                       │
│  ├─ 大量插入使用 COPY 或批量 INSERT，减少事务开销           │
│  ├─ 需要大量更新/删除时，使用 COPY + TRUNCATE 代替 DELETE  │
│  └─ 定期 ANALYZE 更新统计信息                              │
│                                                              │
│  🛡️ 安全                                                   │
│  ├─ 最小权限原则：应用用户只授予必要权限                    │
│  ├─ 使用 prepared statements 防止 SQL 注入                 │
│  ├─ 敏感字段加密存储（AES/PGP）                            │
│  └─ 开启 SSL 连接                                          │
│                                                              │
│  🔧 运维                                                   │
│  ├─ 监控 AUTOVACUUM 工作状态                               │
│  ├─ 定期检查 pg_stat_statements 发现慢查询                 │
│  ├─ 监控连接数，避免超过 max_connections                   │
│  ├─ 定期检查索引使用情况，删除无用索引                      │
│  └─ 重要数据开启 WAL + 定期备份                             │
│                                                              │
│  ⚡ 性能调优                                                 │
│  ├─ shared_buffers: 设为系统内存的 25%                      │
│  ├─ work_mem: 单次排序/哈希操作内存，复杂查询可增大         │
│  ├─ effective_cache_size: 设为系统内存的 75%                │
│  ├─ random_page_cost: SSD 设为 1.1，HDD 保持默认 4         │
│  └─ 表达式索引替代函数调用（避免每次查询重新计算）          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 十、总结

PostgreSQL 以其强大的 SQL 标准遵循、丰富的索引类型、原生的 JSON/数组支持、完善的 MVCC 机制和活跃的扩展生态，成为现代数据驱动应用的首选数据库。

从本文可以看出，PostgreSQL 的深度远超"增删改查"——窗口函数、CTE、触发器、分区、RLS、MVCC 等高级特性，配合 GIN/BRIN/SP-GIST 等专用索引和 pg_trgm/pg_stat_statements 等扩展工具，共同构成了一套完整的企业级数据管理解决方案。

掌握 PostgreSQL，不仅是学会一个数据库，更是掌握了一把打开数据工程、GIS、向量检索、事件溯源等众多领域大门的钥匙。

---

*本文由小虾子 🦐 撰写*
