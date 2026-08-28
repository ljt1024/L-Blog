# 数据库索引原理与查询优化深度解析：让 SQL 从慢如蜗牛到快如闪电

> "为什么我的 SQL 跑了 10 秒而别人的只要 10 毫秒？" 答案几乎永远是：**索引**。但索引不是银弹——用错索引比没用索引更危险。本文从底层数据结构出发，系统讲解索引原理、B-Tree vs Hash、复合索引设计、EXPLAIN 实战读图，以及那些让你 SQL 飞起来的优化技巧。

## 一、为什么需要索引？

先看一个真实场景：假设有一张 `orders` 表，1000 万条订单记录，执行以下查询：

```sql
SELECT * FROM orders WHERE customer_id = 12345;
```

**无索引时**：数据库引擎需要做 **全表扫描（Full Table Scan）**，逐行比对 `customer_id`，平均需要检查 500 万行才能找到所有匹配记录。时间复杂度 **O(n)**。

**有索引时**：通过 `customer_id` 上的索引，数据库可以在 **B-Tree 结构中二分查找**，将时间复杂度降到 **O(log n)**。1000 万条记录只需要大约 **23 次比较**。

索引的本质：**用额外的存储空间换取查询时间**，以空间换时间。

## 二、索引的底层数据结构

### 2.1 B-Tree：关系型数据库的默认选择

B-Tree（Balanced Tree，平衡多路搜索树）是 PostgreSQL、MySQL（InnoDB）、SQLite 等主流数据库的默认索引结构。

```
                    [50]
           /        |        \
      [15,30]   [50,60]   [80,90]
       /  \       /  \       /  \
   [..] [..]  [..] [..]  [..] [..]
   
   层级越深 → 磁盘 I/O 越多 → 查询越慢
   B-Tree 通过"多路"设计控制高度（通常 3-4 层）
```

**B-Tree 的特点：**
- 所有数据按键值有序存储
- 叶子节点在同一层级，保证 O(log n) 查找
- 支持范围查询（`BETWEEN`、`>`、`<`）
- 平衡性由数据库引擎自动维护

**B-Tree 的搜索过程：**

```python
def btree_search(root, target):
    """模拟 B-Tree 查找过程"""
    node = root
    depth = 0
    while not node.is_leaf:
        depth += 1
        # 在当前节点中找到目标所在区间
        for i, key in enumerate(node.keys):
            if target < key:
                node = node.children[i]
                break
        else:
            node = node.children[len(node.keys)]
    
    # 在叶子节点中查找
    for i, key in enumerate(node.keys):
        if key == target:
            return node.values[i], depth  # 找到！
    return None, depth  # 未找到


# 1000万条记录的B-Tree：
# - 假设每个节点可存 100 个键
# - 3层B-Tree 可存 100³ = 1,000,000 条记录
# - 4层B-Tree 可存 100⁴ = 100,000,000 条记录
# → 查找最多只需 4 次磁盘 I/O！
```

### 2.2 B+Tree：B-Tree 的进化版

B+Tree 是 MySQL InnoDB 的实际实现，相比 B-Tree 做了两项关键改进：

1. **非叶子节点只存储键**（不存储数据），同样大小的页能容纳更多键 → 树更扁平
2. **叶子节点之间用双向链表连接** → 范围查询只需遍历链表，无需回溯父节点

```
B-Tree:
        [50: data1]
    [20]  [60: data2]
    
B+Tree (InnoDB):
        [50]
    [20]  [60]
    [leaf nodes with data, linked: ... ↔ ... ↔ ...]
```

这就是为什么 MySQL 在大表上用 InnoDB 索引通常比 MyISAM 快。

### 2.3 Hash Index：极致查找，但代价是什么？

Hash Index 用哈希函数将键映射到桶（bucket），查找时间复杂度为 **O(1)** —— 理论上比 B-Tree 的 O(log n) 更快。

```sql
-- PostgreSQL：使用 Hash Index
CREATE INDEX idx_orders_customer_hash ON orders USING HASH (customer_id);

-- MySQL：MEMORY 存储引擎默认使用 Hash Index
CREATE INDEX idx_customer_hash ON orders (customer_id) USING HASH;
```

```python
class HashIndex:
    """简化版 Hash Index 实现"""
    
    def __init__(self, bucket_size=65536):
        self.buckets = [[] for _ in range(bucket_size)]  # 链地址法解决冲突
    
    def _hash(self, key):
        return hash(key) % self.bucket_size
    
    def insert(self, key, value):
        bucket = self.buckets[self._hash(key)]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)  # 更新
                return
        bucket.append((key, value))  # 插入
    
    def lookup(self, key):
        bucket = self.buckets[self._hash(key)]
        for k, v in bucket:
            if k == key:
                return v
        return None  # O(1) 查找！
    
    def delete(self, key):
        bucket = self.buckets[self._hash(key)]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                return
```

**Hash Index 的致命缺陷：**

| 操作 | B-Tree | Hash Index |
|------|--------|-----------|
| 等值查找 `=` | O(log n) | **O(1)** ✅ |
| 范围查找 `>`、`<`、`BETWEEN` | **O(log n)** ✅ | ❌ 不支持 |
| 前缀匹配 `LIKE 'abc%'` | **O(log n)** ✅ | ❌ 不支持 |
| 排序 `ORDER BY` | **利用索引** ✅ | ❌ 需要额外排序 |
| 最左前缀原则 | **支持** ✅ | ❌ 不支持 |

因此 **Hash Index 只适合等值查找**：`WHERE email = 'xxx'`（Redis 的本质就是 Hash Index）。

### 2.4 磁盘 I/O：被忽视的性能瓶颈

索引再聪明，最终也要从磁盘读写数据。理解 I/O 模型才能真正优化性能：

```sql
-- PostgreSQL：查看表和索引的 I/O 统计
SELECT
  relname,
  idx_blks_read,
  idx_blks_hit,
  ROUND(idx_blks_hit::numeric / NULLIF(idx_blks_read + idx_blks_hit, 0) * 100, 2) AS hit_rate
FROM pg_stat_user_indexes
ORDER BY idx_blks_read DESC
LIMIT 10;
```

**关键指标：缓存命中率（Cache Hit Rate）**

- 索引页如果在内存中（Buffer Pool / Page Cache），I/O 几乎为零
- 如果需要从磁盘读取，每次磁盘 I/O 延迟约 **0.1ms~10ms**（SSD vs 机械硬盘）
- B+Tree 的 3-4 层结构意味着一次查询最多 3-4 次磁盘 I/O
- 减少 I/O 的方法：**增大 Buffer Pool / Page Cache**

```sql
-- PostgreSQL 配置：增大 shared_buffers（建议为系统内存的25%）
ALTER SYSTEM SET shared_buffers = '8GB';

-- MySQL InnoDB 配置：增大 innodb_buffer_pool_size（建议为系统内存的70%）
SET GLOBAL innodb_buffer_pool_size = 8589934592;
```

## 三、索引类型全景图

### 3.1 主键索引 vs 唯一索引 vs 普通索引

```sql
-- 主键索引：自动 NOT NULL + UNIQUE，表中只能有一个
ALTER TABLE orders ADD PRIMARY KEY (id);

-- 唯一索引：值唯一，允许 NULL（可以有多个 NULL）
CREATE UNIQUE INDEX idx_user_email ON users (email);

-- 普通索引：最常见，允许重复
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- 多列唯一索引
CREATE UNIQUE INDEX idx_order_item ON order_items (order_id, product_id);
```

### 3.2 复合索引：最强大的武器

复合索引（Composite Index）是在多个列上创建的索引，遵循 **最左前缀原则（Leftmost Prefix Rule）**：

```sql
CREATE INDEX idx_orders_composite ON orders (customer_id, status, created_at);
```

这条索引可以支持以下查询：

```sql
-- ✅ 全匹配：使用了全部三列
SELECT * FROM orders WHERE customer_id = 1 AND status = 'pending' AND created_at > '2024-01-01';

-- ✅ 最左前缀：只用 customer_id（走索引）
SELECT * FROM orders WHERE customer_id = 1;

-- ✅ 前两列：customer_id + status（走索引）
SELECT * FROM orders WHERE customer_id = 1 AND status = 'pending';

-- ❌ 跳过最左列：没用 customer_id（不走索引，全表扫描）
SELECT * FROM orders WHERE status = 'pending';

-- ❌ 范围查询后的列：created_at 使用了范围，status 不走索引
SELECT * FROM orders WHERE customer_id = 1 AND status = 'pending' AND created_at > '2024-01-01';
-- → customer_id 走索引，created_at 走索引，status 在索引中被截断
```

**复合索引的列顺序选择原则：**

```
原则1：等值条件（=、IN）优先于范围条件（>、<）优先排序（ORDER BY）
原则2：区分度（Selectivity）高的列放前面
原则3：考虑查询的实际频率，平衡各方需求
```

**区分度计算：**

```sql
-- PostgreSQL：计算列的区分度
SELECT
  attname AS column_name,
  n_distinct AS selectivity  -- 越接近 1 区分度越高
FROM pg_stats
WHERE tablename = 'orders'
  AND attname IN ('customer_id', 'status', 'created_at');

-- MySQL：用 Cardinality 近似
SHOW INDEX FROM orders;
-- Cardinality / 表行数 ≈ 区分度
```

### 3.3 覆盖索引：查询直接在索引中完成

覆盖索引（Covering Index）是复合索引的进阶用法——**查询所需的所有列都在索引中，无需回表**：

```sql
-- 普通索引：找到 id，回表查 full_name
CREATE INDEX idx_user_id ON users (id);
SELECT full_name FROM users WHERE id = 1;
-- 需要 2 步：① 索引找 id → ② 回表查 full_name

-- 覆盖索引：查询直接在索引中完成，零回表
CREATE INDEX idx_user_covering ON users (id) INCLUDE (full_name);
SELECT full_name FROM users WHERE id = 1;
-- 只需 1 步：索引中直接返回 full_name
```

```
无覆盖索引的执行路径：
Table Scan ──────────────────────────────────► Row（慢）

覆盖索引的执行路径：
Index Only Scan ──────────────────────────────────► Done（快！无回表）
```

```sql
-- PostgreSQL 语法（INCLUDE 是 MySQL 语法，PG 用覆盖列在索引键中）
CREATE INDEX idx_orders_covering ON orders (customer_id) INCLUDE (status, total_amount);

-- MySQL 语法
CREATE INDEX idx_orders_covering ON orders (customer_id, status, total_amount);
```

### 3.4 其他索引类型

```sql
-- 局部索引（Partial Index）：只索引满足条件的行，省空间
-- PostgreSQL 特有
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';  -- 只索引未完成订单

-- 前缀索引：只索引字符串前 N 个字符，适合长文本列
CREATE INDEX idx_user_email_prefix ON users (email(10));

-- 全文索引：支持文本搜索
-- PostgreSQL
CREATE INDEX idx_article_fulltext ON articles USING GIN (to_tsvector('english', title || ' ' || body));

-- MySQL
ALTER TABLE articles ADD FULLTEXT INDEX idx_fulltext (title, body);

-- 表达式/函数索引：在表达式上建索引，查询时不破坏索引使用
CREATE INDEX idx_orders_date ON orders (DATE(created_at));
-- 正常查询走索引：WHERE DATE(created_at) = '2024-01-01'

-- GiST 索引：几何/地理数据
CREATE INDEX idx_locations_geo ON locations USING GIST (coordinates);

-- BRIN 索引：超大型时序数据的"范围索引"
-- 比 B-Tree 小 1000 倍，适合按插入顺序访问的数据（日志、IoT）
CREATE INDEX idx_logs_brin ON logs USING BRIN (created_at);
```

## 四、EXPLAIN 实战：读懂查询计划

### 4.1 PostgreSQL EXPLAIN 深度解析

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total_amount, u.name
FROM orders o
JOIN users u ON o.customer_id = u.id
WHERE o.status = 'pending'
  AND o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;
```

输出示例：

```
Limit  (cost=0.43..526.43 rows=20 width=44) (actual time=0.052..0.089 rows=20 loops=1)
  ->  Nested Loop  (cost=0.43..526.43 rows=20 width=44) (actual time=0.049..0.085 rows=20 loops=1)
        Buffers: shared hit=45
        ->  Index Scan using idx_orders_status_date on orders o  (cost=0.43..320.21 rows=20 width=28) (actual time=0.032..0.059 rows=20 loops=1)
              Index Cond: ((status = 'pending') AND (created_at > (now() - '7 days'::interval)))
              Buffers: shared hit=40
        ->  Index Scan using users_pkey on users u  (cost=0.00..0.28 rows=1 width=24) (actual time=0.002..0.003 rows=1 loops=20)
              Index Cond: (id = o.customer_id)
              Buffers: shared hit=5
Planning Time: 1.2 ms
Execution Time: 0.12 ms
```

**关键指标解读：**

```
cost=0.43..526.43
 ↑    ↑
 |    └─ 最坏情况成本（估算）
 └─ 最好情况成本（读取第一行的估算）

actual time=0.052..0.089
 ↑            ↑
 └─ 第一行返回时间(ms)  最末行返回时间(ms)

Buffers: shared hit=45
 ↑                       ↑
 共享缓冲区命中数        读取磁盘的块数（越低越好）

rows=20 loops=1
 ↑         ↑
 估算行数   执行次数（>1 说明有回表/重复扫描）
```

### 4.2 常见执行类型红绿灯

| 执行类型 | 颜色 | 含义 |
|---------|------|------|
| `Index Only Scan` | 🟢 绿 | 最优，查询直接在索引中完成 |
| `Index Scan` | 🟡 黄 | 好，索引查找 + 回表 |
| `Bitmap Heap Scan` | 🟠 橙 | 可接受，多行数据聚合后回表 |
| `Seq Scan` | 🔴 红 | 危险，全表扫描 |
| `Nested Loop` | 🟡 黄 | 小表 JOIN 好，大表可能慢 |
| `Hash Join` | 🟢 绿 | 大表 JOIN 友好 |
| `Sort` / `Sort Key` | 🟡 黄 | 如果数据量大，考虑加 ORDER BY 索引 |
| `Limit` | ⚪ 灰 | 本身不是问题，但配合 top-N 要看子节点 |

### 4.3 常见问题诊断

**问题1：明明有索引为什么还是全表扫描？**

```sql
-- 场景：status 列有索引，但 EXPLAIN 显示 Seq Scan

EXPLAIN SELECT * FROM orders WHERE status = 'pending';

-- 原因分析：
-- 1. 查询返回比例太高（> 5%~20%）
--    SELECT * 会读取所有列，如果结果集太大，引擎认为回表成本更高

-- 解决1：使用覆盖索引避免回表
CREATE INDEX idx_status_covering ON orders (status) INCLUDE (id, customer_id, total_amount, created_at);

-- 2. 统计信息过期（数据库不知道数据分布）
ANALYZE orders;  -- PostgreSQL
ANALYZE TABLE orders;  -- MySQL

-- 3. 函数破坏了索引
-- ❌ 函数导致索引失效
WHERE DATE(created_at) = '2024-01-01'

-- ✅ 使用表达式索引
CREATE INDEX idx_created_date ON orders (DATE(created_at));
WHERE DATE(created_at) = '2024-01-01'  -- 走索引

-- 4. 隐式类型转换
-- ❌ email 是 VARCHAR，但传入了整数
WHERE email = 123  -- 隐式 CAST(email AS INTEGER) = 123，全表扫描

-- ✅ 类型匹配
WHERE email = '123'
```

**问题2：索引扫描但速度依然很慢？**

```sql
-- 查看索引使用情况和 I/O
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 12345;

-- 如果 Buffers: shared hit 远小于总行数，说明大量数据需要从磁盘读取
-- 解决方案：增加 shared_buffers / innodb_buffer_pool_size
```

**问题3：JOIN 导致性能恶化？**

```sql
-- 大表 JOIN 小表：Hash Join 最优
-- 小表 JOIN 大表：Nested Loop + 索引最快

-- 查看 JOIN 实际使用了哪种算法
EXPLAIN (ANALYZE)
SELECT * FROM large_table l JOIN small_table s ON l.id = s.ref_id;

-- 如果是小表全表扫描大表：
-- → 给小表 JOIN 键加索引
CREATE INDEX idx_small_ref ON small_table (ref_id);

-- PostgreSQL 特有：让小表完全加载到内存用于 Hash Join
SET work_mem = '256MB';  -- 增大 work_mem
```

## 五、查询优化实战技巧

### 5.1 分页优化：告别 OFFSET

```sql
-- ❌ 低效分页：OFFSET 越大越慢（数据库仍要扫描前面的所有行）
SELECT * FROM orders
ORDER BY id DESC
LIMIT 20 OFFSET 100000;  -- 扫描了100020行，只用20行

-- ✅ 游标分页：始终 O(1) 扫描
SELECT * FROM orders
WHERE id < 100000  -- 上页最后一条的 id
ORDER BY id DESC
LIMIT 20;

-- ✅ 复合游标分页（多列排序）
SELECT * FROM orders
WHERE (created_at, id) < ('2024-01-01 12:00:00', 99999)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

```sql
-- 动态生成下一页游标（应用层）
const getNextPage = async (lastItem) => {
  const rows = await db.query(`
    SELECT * FROM orders
    WHERE created_at < $1 OR (created_at = $1 AND id < $2)
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `, [lastItem.created_at, lastItem.id]);
  return rows;
};
```

### 5.2 IN vs EXISTS vs JOIN

```sql
-- ❌ IN 子查询：子查询先执行，如果结果集很大可能变成全表扫描
SELECT * FROM orders
WHERE customer_id IN (
  SELECT id FROM users WHERE created_at > '2024-01-01'
);

-- ✅ JOIN + DISTINCT：通常更优
SELECT DISTINCT o.* FROM orders o
JOIN users u ON o.customer_id = u.id
WHERE u.created_at > '2024-01-01';

-- ✅ EXISTS：子查询找到第一条就停止（对于有索引的列非常高效）
SELECT * FROM orders o
WHERE EXISTS (
  SELECT 1 FROM users u WHERE u.id = o.customer_id AND u.created_at > '2024-01-01'
);
```

### 5.3 聚合查询优化

```sql
-- ❌ 每次 GROUP BY 都全表聚合
SELECT customer_id, SUM(total_amount), COUNT(*)
FROM orders
GROUP BY customer_id;

-- ✅ 使用物化视图 / 聚合索引（PostgreSQL）
CREATE MATERIALIZED VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  customer_id,
  SUM(total_amount) AS revenue,
  COUNT(*) AS order_count
FROM orders
GROUP BY 1, 2
WITH DATA;

CREATE UNIQUE INDEX ON monthly_revenue (month, customer_id);

-- 刷新（增量或全量）
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;

-- ✅ 近似查询：大数据量时用 APPROX_COUNT_DISTINCT
SELECT APPROX_COUNT_DISTINCT(customer_id) FROM orders;  -- 快，但有误差
```

### 5.4 批量插入：压测与优化

```sql
-- ❌ 逐条插入：1000 条数据 × N 次 I/O
for order in orders:
    INSERT INTO orders VALUES (...);  -- 触发 N 次事务提交

-- ✅ 批量插入 + 单事务
INSERT INTO orders VALUES
  (1, 'A', 100), (2, 'B', 200), (3, 'C', 300), ...;  -- 一次 I/O

-- ✅ PostgreSQL COPY 命令：最快（比 INSERT 快 10 倍）
COPY orders (id, status, total_amount)
FROM STDIN WITH (FORMAT csv);
1,pending,100
2,shipped,200
3,completed,300
\.

-- ✅ 禁用索引后批量导入（数据仓库场景）
ALTER TABLE orders DISABLE TRIGGER ALL;
COPY orders FROM '/data/orders.csv' WITH (FORMAT csv);
ALTER TABLE orders ENABLE TRIGGER ALL;
REINDEX TABLE orders;
```

## 六、索引维护：不要建了就丢下

### 6.1 索引监控

```sql
-- PostgreSQL：找出从未被使用过的索引（占空间但不干活）
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelid NOT IN (
    SELECT conindid FROM pg_constraint WHERE contype IN ('p', 'u')
  )
ORDER BY pg_relation_size(indexrelid) DESC;

-- MySQL：分析索引使用情况
SELECT
  TABLE_NAME,
  INDEX_NAME,
  CARDINALITY,
  SEQ_IN_INDEX,
  COLUMN_NAME,
  NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'mydb'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 找出高修改、低使用的不必要索引
SELECT
  OBJECT_NAME,
  INDEX_NAME,
  USER_SEEKS,
  USER_SCANS,
  USER_UPDATES
FROM sys.dm_db_index_usage_stats
WHERE database_id = DB_ID()
  AND USER_UPDATES > 1000
  AND (USER_SEEKS + USER_SCANS) < 10;
```

### 6.2 索引膨胀与重建

```sql
-- PostgreSQL：检查膨胀率
SELECT
  schemaname || '.' || tablename AS table,
  indexname,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  pg_size_pretty(pg_relation_size(i.indrelid)) AS table_size,
  ROUND(100.0 * pg_relation_size(i.indexrelid) /
    pg_relation_size(i.indrelid), 2) AS index_ratio
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE idx_scan = 0  -- 未使用的索引
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- 重建膨胀的索引
-- PostgreSQL（不锁表）
REINDEX INDEX CONCURRENTLY idx_orders_customer;

-- MySQL（在线重建）
ALTER TABLE orders DROP INDEX idx_old, ADD INDEX idx_new (...);

-- 删除不需要的索引
DROP INDEX idx_unused ON orders;
```

### 6.3 部分索引实战：只索引活跃数据

```sql
-- 场景：订单表 90% 是已完成订单，但查询主要针对活跃订单

-- ❌ 普通索引：所有 1000 万行都索引（浪费空间）
CREATE INDEX idx_orders_status ON orders (status);

-- ✅ 部分索引：只索引 100 万活跃订单（节省 90% 空间 + 更快查询）
CREATE INDEX idx_orders_pending ON orders (created_at DESC)
WHERE status IN ('pending', 'processing', 'shipped');

-- 查询自动使用该索引（因为条件匹配）
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;
```

## 七、高级主题：数据库特定优化

### 7.1 PostgreSQL 高级特性

```sql
-- 表达式索引：让函数调用也能走索引
CREATE INDEX idx_lower_email ON users (LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'john@example.com';

-- 联合索引的 INCLUDE：存储额外列避免回表
CREATE INDEX idx_orders_composite ON orders (customer_id, status)
INCLUDE (total_amount, created_at);

-- BRIN 索引：时序数据的极致压缩
-- 100GB 表只需要几 MB 的 BRIN 索引
CREATE INDEX idx_logs_brin ON logs USING BRIN (created_at)
WITH (pages_per_range = 128);
```

### 7.2 MySQL (InnoDB) 专项

```sql
-- 主键设计：InnoDB 表按主键顺序物理存储（聚簇索引）
-- → 主键越小越好（减少所有二级索引大小）
-- → 优先使用自增主键或 UUID v7（时间有序）

-- UUID v7 生成（MySQL 8.0.16+）
-- SELECT UUID_TO_BIN(UUID(), TRUE);

-- 联合索引列顺序验证
EXPLAIN SELECT * FROM orders WHERE customer_id = 1 AND status = 'pending';
-- Extra 列出现 "Using index condition" 说明使用了索引下推（Index Condition Pushdown）

-- Long Unique Key 问题：InnoDB 最大索引长度 767 字节
-- → 使用前缀索引或哈希索引
CREATE INDEX idx_url_prefix ON pages (url(255));  -- 前 255 字符
```

## 八、总结：索引优化决策树

```
收到慢查询告警
    │
    ├── 运行 EXPLAIN (ANALYZE, BUFFERS)
    │
    ├── 看到 Seq Scan（红）？
    │       │
    │       ├── 检查 WHERE 条件列是否有索引
    │       ├── 检查查询是否隐式类型转换 / 函数包裹
    │       ├── 估算返回比例是否过高（→ 考虑覆盖索引）
    │       └── ANALYZE 表更新统计信息
    │
    ├── 看到 Index Scan / Bitmap Scan（黄）？
    │       │
    │       ├── 检查回表次数（loops 次数）
    │       ├── 考虑 INCLUDE 列减少回表
    │       └── 检查 I/O（Buffers hit rate）
    │
    ├── 看到排序（Sort）？
    │       │
    │       └── 检查 ORDER BY 列是否在索引中
    │
    └── 发现缺失索引？
            │
            └── 添加索引 → 验证 → 监控使用情况
```

**三条铁律：**
1. **EXPLAIN 先行**：永远不要在没有分析执行计划的情况下优化
2. **测量 > 猜测**：用 `ANALYZE` 确认统计信息，用 `pg_stat_user_indexes` 确认索引被使用
3. **宁缺毋滥**：每个索引都有写入成本，定期清理无效索引

*本文由小虾子 🦐 撰写*
