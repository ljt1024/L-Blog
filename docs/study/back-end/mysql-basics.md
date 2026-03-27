# MySQL基础教程

MySQL是世界上最流行的开源关系型数据库管理系统之一。本文将介绍MySQL的基本概念、安装配置和常用操作。

## 什么是MySQL？

MySQL是一个关系型数据库管理系统（RDBMS），由瑞典MySQL AB公司开发，目前属于Oracle公司。它使用结构化查询语言（SQL）进行数据库管理。

### MySQL的特点

1. **开源免费**：MySQL是开源软件，可以免费使用
2. **跨平台**：支持多种操作系统（Windows、Linux、macOS等）
3. **高性能**：优化的SQL查询算法，查询速度快
4. **可靠性高**：支持事务处理，保证数据一致性
5. **易于使用**：SQL语言简单易学
6. **可扩展性强**：支持大型数据库，支持集群部署

## MySQL安装与配置

### Windows系统安装

1. 访问MySQL官网下载MySQL Community Server
2. 运行安装程序，选择合适的安装类型
3. 配置root用户密码
4. 启动MySQL服务

### Linux系统安装（Ubuntu为例）

```bash
# 更新包列表
sudo apt update

# 安装MySQL服务器
sudo apt install mysql-server

# 启动MySQL服务
sudo systemctl start mysql

# 设置开机自启
sudo systemctl enable mysql
```

### macOS系统安装

```bash
# 使用Homebrew安装
brew install mysql

# 启动MySQL服务
brew services start mysql
```

## MySQL基本操作

### 连接MySQL

```bash
# 连接到MySQL服务器
mysql -u root -p

# 连接到指定数据库
mysql -u root -p database_name
```

### 数据库操作

```sql
-- 查看所有数据库
SHOW DATABASES;

-- 创建数据库
CREATE DATABASE mydb;

-- 使用数据库
USE mydb;

-- 删除数据库
DROP DATABASE mydb;
```

### 表操作

#### 创建表

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 查看表结构

```sql
-- 查看表结构
DESCRIBE users;

-- 或者使用
DESC users;
```

#### 修改表结构

```sql
-- 添加列
ALTER TABLE users ADD COLUMN age INT;

-- 修改列
ALTER TABLE users MODIFY COLUMN age TINYINT;

-- 删除列
ALTER TABLE users DROP COLUMN age;
```

#### 删除表

```sql
-- 删除表
DROP TABLE users;

-- 删除表（如果存在）
DROP TABLE IF EXISTS users;
```

### 数据操作

#### 插入数据

```sql
-- 插入单条记录
INSERT INTO users (username, email, password) 
VALUES ('john_doe', 'john@example.com', 'password123');

-- 插入多条记录
INSERT INTO users (username, email, password) 
VALUES 
    ('alice', 'alice@example.com', 'pass456'),
    ('bob', 'bob@example.com', 'pass789');
```

#### 查询数据

```sql
-- 查询所有数据
SELECT * FROM users;

-- 查询指定列
SELECT username, email FROM users;

-- 条件查询
SELECT * FROM users WHERE id = 1;

-- 模糊查询
SELECT * FROM users WHERE username LIKE '%john%';

-- 排序查询
SELECT * FROM users ORDER BY created_at DESC;

-- 限制查询结果数量
SELECT * FROM users LIMIT 10;

-- 分页查询
SELECT * FROM users LIMIT 10 OFFSET 20;
```

#### 更新数据

```sql
-- 更新单条记录
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- 更新多条记录
UPDATE users SET password = 'newpassword' WHERE created_at < '2023-01-01';
```

#### 删除数据

```sql
-- 删除指定记录
DELETE FROM users WHERE id = 1;

-- 删除所有记录（谨慎使用）
DELETE FROM users;
```

## SQL查询进阶

### 聚合函数

```sql
-- 统计记录数
SELECT COUNT(*) FROM users;

-- 求平均值
SELECT AVG(age) FROM users;

-- 求最大值
SELECT MAX(created_at) FROM users;

-- 求最小值
SELECT MIN(id) FROM users;

-- 求和
SELECT SUM(age) FROM users;
```

### 分组查询

```sql
-- 按条件分组统计
SELECT department, COUNT(*) as employee_count 
FROM employees 
GROUP BY department;

-- 分组后筛选
SELECT department, COUNT(*) as employee_count 
FROM employees 
GROUP BY department 
HAVING COUNT(*) > 5;
```

### 多表查询

#### 内连接

```sql
SELECT users.username, orders.order_date 
FROM users 
INNER JOIN orders ON users.id = orders.user_id;
```

#### 左连接

```sql
SELECT users.username, orders.order_date 
FROM users 
LEFT JOIN orders ON users.id = orders.user_id;
```

#### 子查询

```sql
SELECT username, email 
FROM users 
WHERE id IN (SELECT user_id FROM orders WHERE order_amount > 1000);
```

## MySQL索引

索引是提高查询速度的重要手段。

### 创建索引

```sql
-- 创建普通索引
CREATE INDEX idx_username ON users(username);

-- 创建唯一索引
CREATE UNIQUE INDEX idx_email ON users(email);

-- 创建复合索引
CREATE INDEX idx_user_email ON users(username, email);
```

### 查看索引

```sql
-- 查看表的索引
SHOW INDEX FROM users;
```

### 删除索引

```sql
-- 删除索引
DROP INDEX idx_username ON users;
```

## MySQL用户权限管理

### 创建用户

```sql
-- 创建用户
CREATE USER 'newuser'@'localhost' IDENTIFIED BY 'password';

-- 创建用户并指定主机
CREATE USER 'newuser'@'%' IDENTIFIED BY 'password';
```

### 授权

```sql
-- 授予所有权限
GRANT ALL PRIVILEGES ON mydb.* TO 'newuser'@'localhost';

-- 授予特定权限
GRANT SELECT, INSERT, UPDATE ON mydb.users TO 'newuser'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;
```

### 查看权限

```sql
-- 查看用户权限
SHOW GRANTS FOR 'newuser'@'localhost';
```

### 撤销权限

```sql
-- 撤销权限
REVOKE INSERT ON mydb.users FROM 'newuser'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;
```

## MySQL事务处理

事务是数据库操作的最小单元，要么全部成功，要么全部失败。

```sql
-- 开始事务
START TRANSACTION;

-- 执行一系列操作
INSERT INTO users (username, email, password) VALUES ('testuser', 'test@example.com', 'password');
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;

-- 提交事务
COMMIT;

-- 或者回滚事务
-- ROLLBACK;
```

## MySQL备份与恢复

### 备份数据库

```bash
# 备份整个数据库
mysqldump -u root -p mydb > mydb_backup.sql

# 备份多个数据库
mysqldump -u root -p --databases db1 db2 > backup.sql

# 备份所有数据库
mysqldump -u root -p --all-databases > all_backup.sql
```

### 恢复数据库

```bash
# 恢复数据库
mysql -u root -p mydb < mydb_backup.sql
```

## MySQL配置优化

### 配置文件位置

- Windows: `my.ini`
- Linux/macOS: `/etc/mysql/my.cnf` 或 `/etc/my.cnf`

### 常用配置参数

```ini
[mysqld]
# 最大连接数
max_connections = 200

# 缓冲池大小
innodb_buffer_pool_size = 1G

# 查询缓存大小
query_cache_size = 64M

# 日志文件大小
innodb_log_file_size = 256M
```

## MySQL常用命令

```sql
-- 查看MySQL版本
SELECT VERSION();

-- 查看当前用户
SELECT USER();

-- 查看当前数据库
SELECT DATABASE();

-- 查看表状态
SHOW TABLE STATUS LIKE 'users';

-- 查看进程列表
SHOW PROCESSLIST;

-- 查看变量设置
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
```

## 总结

MySQL作为最流行的关系型数据库之一，掌握其基本操作对于后端开发人员至关重要。本文介绍了MySQL的安装配置、基本操作、查询语法、索引优化、权限管理等内容。

在实际开发中，还需要深入了解：
1. 数据库设计原则（范式）
2. 性能优化技巧
3. 主从复制和集群部署
4. 安全防护措施
5. 存储引擎选择（InnoDB、MyISAM等）

通过不断实践和学习，你将能够熟练运用MySQL构建稳定高效的数据库应用。