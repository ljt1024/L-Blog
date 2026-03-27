# GORM入门指南

GORM是Go语言的一个功能强大的ORM（对象关系映射）库，它提供了简洁的API来操作数据库。GORM支持多种数据库，包括MySQL、PostgreSQL、SQLite、SQL Server等。本文将介绍GORM的基本使用方法。

## 什么是GORM？

GORM是一个全功能的ORM库，具有以下特性：

1. **全功能ORM**：关联（Has One、Has Many、Belongs To、Many To Many）、预加载等
2. **钩子函数**：Before/After Create/Save/Update/Delete/Find等生命周期钩子
3. **预加载**：支持嵌套预加载
4. **事务支持**：提供事务支持
5. **复合主键**：支持复合主键
6. **SQL生成器**：支持构造复杂的SQL查询
7. **迁移工具**：支持自动迁移数据库表结构

## 安装GORM

安装GORM和对应的数据库驱动：

```bash
# 安装GORM
go get -u gorm.io/gorm

# 安装MySQL驱动（根据需要选择其他数据库驱动）
go get -u gorm.io/driver/mysql

# 其他数据库驱动：
# PostgreSQL: go get -u gorm.io/driver/postgres
# SQLite: go get -u gorm.io/driver/sqlite
# SQL Server: go get -u gorm.io/driver/sqlserver
```

## 连接数据库

### 连接MySQL数据库

```go
package main

import (
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
)

func main() {
    // 参考 https://github.com/go-sql-driver/mysql#dsn-data-source-name 获取详情
    dsn := "user:pass@tcp(127.0.0.1:3306)/dbname?charset=utf8mb4&parseTime=True&loc=Local"
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
    
    if err != nil {
        panic("failed to connect database")
    }
    
    // 测试连接
    sqlDB, err := db.DB()
    if err != nil {
        panic("failed to get database instance")
    }
    
    // 设置连接池
    sqlDB.SetMaxIdleConns(10)
    sqlDB.SetMaxOpenConns(100)
    
    // 使用db进行数据库操作
    // ...
}
```

## 定义模型

在GORM中，模型是标准的struct，其字段对应数据库表的列：

```go
package main

import (
    "gorm.io/gorm"
    "time"
)

// User 用户模型
type User struct {
    ID        uint           `gorm:"primaryKey"`
    Name      string         `gorm:"not null"`
    Email     string         `gorm:"uniqueIndex;not null"`
    Age       int            
    Birthday  *time.Time     
    CreatedAt time.Time      
    UpdatedAt time.Time      
    DeletedAt gorm.DeletedAt `gorm:"index"` // 软删除
}

// Product 商品模型
type Product struct {
    gorm.Model // 内嵌gorm.Model，包含ID,CreatedAt,UpdatedAt,DeletedAt字段
    Code       string
    Price      uint
    UserID     uint   // 外键
    User       User   `gorm:"foreignKey:UserID"` // 关联User模型
}
```

## 自动迁移

GORM支持自动迁移数据库表结构：

```go
// 迁移schema
db.AutoMigrate(&User{}, &Product{})

// 注意：AutoMigrate会创建表、缺失的外键、约束、列和索引
// 不会删除未使用的列以保护数据
```

## 基本的CRUD操作

### 创建记录

```go
// 创建单条记录
user := User{Name: "张三", Email: "zhangsan@example.com", Age: 25}
result := db.Create(&user) // 通过数据的指针来创建

// 获取插入记录的主键
userID := user.ID

// 检查错误
if result.Error != nil {
    // 处理错误
}

// 获取插入记录的数量
rowsAffected := result.RowsAffected

// 批量插入
users := []User{
    {Name: "李四", Email: "lisi@example.com", Age: 30},
    {Name: "王五", Email: "wangwu@example.com", Age: 28},
}
db.Create(&users)
```

### 查询记录

```go
// 获取第一条记录（按主键排序）
var user User
db.First(&user)
// SELECT * FROM users ORDER BY id LIMIT 1;

// 获取一条记录，没有指定排序字段
db.Take(&user)
// SELECT * FROM users LIMIT 1;

// 获取最后一条记录（按主键排序）
db.Last(&user)
// SELECT * FROM users ORDER BY id DESC LIMIT 1;

// 根据主键获取记录
db.First(&user, 10)
// SELECT * FROM users WHERE id = 10;

// 根据条件获取记录
db.First(&user, "email = ?", "zhangsan@example.com")
// SELECT * FROM users WHERE email = 'zhangsan@example.com' ORDER BY id LIMIT 1;

// 获取全部记录
var users []User
db.Find(&users)
// SELECT * FROM users;

// 条件查询
// String条件
db.Where("name = ?", "张三").First(&user)
// SELECT * FROM users WHERE name = '张三' ORDER BY id LIMIT 1;

// Struct条件
db.Where(&User{Name: "张三", Age: 25}).First(&user)
// SELECT * FROM users WHERE name = '张三' AND age = 25 ORDER BY id LIMIT 1;

// Map条件
db.Where(map[string]interface{}{"name": "张三", "age": 25}).Find(&users)
// SELECT * FROM users WHERE name = '张三' AND age = 25;

// Not条件
db.Not("name = ?", "张三").First(&user)
// SELECT * FROM users WHERE NOT(name = '张三') ORDER BY id LIMIT 1;

// Or条件
db.Where("name = ?", "张三").Or("name = ?", "李四").Find(&users)
// SELECT * FROM users WHERE name = '张三' OR name = '李四';
```

### 更新记录

```go
// 保存所有字段
db.First(&user)
user.Name = "新名字"
user.Age = 30
db.Save(&user)
// UPDATE users SET name='新名字', age=30, updated_at='2023-01-01 00:00:00' WHERE id=1;

// 更新单个列
db.Model(&user).Update("name", "新名字")
// UPDATE users SET name='新名字', updated_at='2023-01-01 00:00:00' WHERE id=1;

// 更新多个列
db.Model(&user).Updates(map[string]interface{}{"name": "新名字", "age": 30})
// UPDATE users SET name='新名字', age=30, updated_at='2023-01-01 00:00:00' WHERE id=1;

db.Model(&user).Updates(User{Name: "新名字", Age: 30})
// UPDATE users SET name='新名字', age=30, updated_at='2023-01-01 00:00:00' WHERE id=1;

// 选定字段更新
db.Model(&user).Select("name").Updates(map[string]interface{}{"name": "新名字"})
// UPDATE users SET name='新名字', updated_at='2023-01-01 00:00:00' WHERE id=1;
```

### 删除记录

```go
// 删除记录（软删除）
db.Delete(&user)
// UPDATE users SET deleted_at='2023-01-01 00:00:00' WHERE id = 1;

// 永久删除
db.Unscoped().Delete(&user)
// DELETE FROM users WHERE id = 1;

// 批量删除
db.Where("age > ?", 60).Delete(&User{})
// DELETE FROM users WHERE age > 60;

// 查找包含软删除的记录
db.Unscoped().Find(&users)
// SELECT * FROM users;
```

## 关联查询

### Belongs To关联

```go
// User模型
type User struct {
    gorm.Model
    Name string
}

// Product模型，属于User
type Product struct {
    gorm.Model
    Name   string
    UserID uint
    User   User // Belongs To关联
}

// 查询产品及其用户信息
var product Product
db.Preload("User").First(&product, 1)
// SELECT * FROM products WHERE id = 1;
// SELECT * FROM users WHERE id = 1;
```

### Has One关联

```go
// User模型，拥有一张信用卡
type User struct {
    gorm.Model
    Name string
    CreditCard CreditCard // Has One关联
}

// CreditCard模型
type CreditCard struct {
    gorm.Model
    Number string
    UserID uint // 外键
}

// 查询用户及其信用卡信息
var user User
db.Preload("CreditCard").First(&user, 1)
```

### Has Many关联

```go
// User模型，拥有多个订单
type User struct {
    gorm.Model
    Name   string
    Orders []Order // Has Many关联
}

// Order模型
type Order struct {
    gorm.Model
    UserID uint   // 外键
    Amount uint
}

// 查询用户及其所有订单
var user User
db.Preload("Orders").First(&user, 1)
// SELECT * FROM users WHERE id = 1;
// SELECT * FROM orders WHERE user_id = 1;
```

### Many To Many关联

```go
// User模型
type User struct {
    gorm.Model
    Name   string
    Languages []Language `gorm:"many2many:user_languages;"` // Many To Many关联
}

// Language模型
type Language struct {
    gorm.Model
    Name  string
    Users []User `gorm:"many2many:user_languages;"` // Many To Many关联
}

// 查询用户及其掌握的语言
var user User
db.Preload("Languages").First(&user, 1)
```

## 高级查询

### 预加载

```go
// 预加载关联
db.Preload("Orders").Find(&users)
// SELECT * FROM users;
// SELECT * FROM orders WHERE user_id IN (1,2,3,4);

// 嵌套预加载
db.Preload("Orders.OrderItems.Product").Find(&users)

// 条件预加载
db.Preload("Orders", "state NOT IN (?)", "cancelled").Find(&users)

// 自定义预加载SQL
db.Preload("Orders", func(db *gorm.DB) *gorm.DB {
    return db.Order("orders.amount DESC")
}).Find(&users)
```

### Scopes

```go
func AmountGreaterThan1000(db *gorm.DB) *gorm.DB {
    return db.Where("amount > ?", 1000)
}

func PaidWithVXPay(db *gorm.DB) *gorm.DB {
    return db.Where("pay_method = ?", "vx_pay")
}

// 使用Scopes
db.Scopes(AmountGreaterThan1000, PaidWithVXPay).Find(&orders)
// SELECT * FROM orders WHERE amount > 1000 AND pay_method = 'vx_pay';
```

## 错误处理

```go
// 检查错误
result := db.First(&user)
if errors.Is(result.Error, gorm.ErrRecordNotFound) {
    // 记录未找到
} else if result.Error != nil {
    // 其他错误
}

// 检查受影响行数
if result.RowsAffected == 0 {
    // 没有记录被影响
}
```

## 事务处理

```go
// 简单事务
err := db.Transaction(func(tx *gorm.DB) error {
    // 在事务中执行一些 db 操作（从这里开始，使用 'tx' 而不是 'db'）
    if err := tx.Create(&User{Name: "张三"}).Error; err != nil {
        // 返回任何错误都会回滚事务
        return err
    }
    
    if err := tx.Create(&User{Name: "李四"}).Error; err != nil {
        return err
    }
    
    // 返回 nil 提交事务
    return nil
})

// 手动事务控制
// 开始事务
tx := db.Begin()

// 在事务中执行数据库操作
if err := tx.Create(&User{Name: "张三"}).Error; err != nil {
    tx.Rollback() // 回滚事务
    return err
}

if err := tx.Create(&User{Name: "李四"}).Error; err != nil {
    tx.Rollback()
    return err
}

// 提交事务
return tx.Commit().Error
```

## 总结

GORM是一个功能强大且易于使用的Go语言ORM库。通过本文的学习，你应该掌握了GORM的基本使用方法，包括模型定义、CRUD操作、关联查询、预加载、事务处理等核心功能。在实际开发中，你可以结合这些知识点构建功能完善的数据库应用。