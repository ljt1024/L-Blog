# MongoDB深入解析：安装、配置与高级特性

MongoDB是一个开源的文档数据库，采用NoSQL技术，具有高性能、高可用性和易扩展性等特点。它是面向文档存储的数据库，以JSON-like的BSON格式存储数据，非常适合现代Web应用和大数据场景。本文将详细介绍MongoDB的安装、配置和高级特性。

## 1. MongoDB简介

MongoDB由MongoDB Inc.开发，于2009年首次发布。它是一个分布式的文档数据库，旨在为Web应用提供可扩展的高性能数据存储解决方案。

### 1.1 MongoDB的主要特性

- **面向文档存储**：数据以BSON（Binary JSON）格式存储
- **高可用性**：通过副本集（Replica Set）实现自动故障转移
- **水平扩展**：通过分片（Sharding）实现水平扩展
- **丰富的查询语言**：支持动态查询、聚合管道、文本搜索等功能
- **索引支持**：支持多种类型的索引，提高查询性能
- **GridFS**：用于存储和检索大文件
- **聚合框架**：强大的数据分析和处理能力

### 1.2 MongoDB与关系型数据库对比

| 特性 | MongoDB | 关系型数据库 |
|------|---------|-------------|
| 数据模型 | 文档模型 | 表模型 |
| 查询语言 | MongoDB查询语言 | SQL |
| 数据结构 | 动态schema | 固定schema |
| 扩展性 | 水平扩展 | 垂直扩展为主 |
| 事务支持 | 有限支持 | 完整ACID事务 |
| JOIN操作 | 不支持 | 支持 |

## 2. MongoDB安装

### 2.1 在CentOS上安装MongoDB

```bash
# 添加MongoDB官方仓库
sudo tee /etc/yum.repos.d/mongodb-org.repo <<-'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

# 更新yum缓存
sudo yum clean all
sudo yum makecache

# 安装MongoDB
sudo yum install -y mongodb-org

# 启动MongoDB服务
sudo systemctl start mongod

# 设置开机自启
sudo systemctl enable mongod

# 检查MongoDB状态
sudo systemctl status mongod
```

### 2.2 在Ubuntu上安装MongoDB

```bash
# 导入MongoDB公钥
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# 添加MongoDB仓库
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 更新软件包索引
sudo apt update

# 安装MongoDB
sudo apt install -y mongodb-org

# 启动MongoDB服务
sudo systemctl start mongod

# 设置开机自启
sudo systemctl enable mongod

# 检查MongoDB状态
sudo systemctl status mongod
```

### 2.3 Docker安装MongoDB

```bash
# 拉取MongoDB镜像
docker pull mongo:7.0

# 运行MongoDB容器
docker run --name mongodb -p 27017:27017 -d mongo:7.0

# 运行带身份验证的MongoDB容器
docker run --name mongodb-auth -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -d mongo:7.0

# 进入MongoDB容器
docker exec -it mongodb mongo
```

## 3. MongoDB基本配置

### 3.1 配置文件位置

- CentOS: `/etc/mongod.conf`
- Ubuntu: `/etc/mongod.conf`

### 3.2 主要配置项

```yaml
# mongod.conf

# 系统日志配置
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# 存储引擎配置
storage:
  dbPath: /var/lib/mongo
  journal:
    enabled: true

# 进程管理配置
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid

# 网络接口配置
net:
  port: 27017
  bindIp: 127.0.0.1  # 仅本地访问
  # bindIp: 0.0.0.0  # 允许所有IP访问（生产环境需谨慎）

# 安全配置
security:
  authorization: enabled  # 启用身份验证

# 复制集配置
replication:
  replSetName: rs0

# 分片配置
sharding:
  clusterRole: shardsvr
```

### 3.3 启动MongoDB服务

```bash
# 使用配置文件启动MongoDB
sudo mongod -f /etc/mongod.conf

# 或者使用systemctl
sudo systemctl start mongod
sudo systemctl restart mongod
```

## 4. MongoDB基本操作

### 4.1 连接到MongoDB

```bash
# 连接本地MongoDB
mongo

# 连接远程MongoDB
mongo --host hostname --port 27017

# 连接带身份验证的MongoDB
mongo -u username -p password --authenticationDatabase admin
```

### 4.2 数据库操作

```javascript
// 显示所有数据库
show dbs

// 切换/创建数据库
use myDatabase

// 显示当前数据库
db

// 删除数据库
db.dropDatabase()
```

### 4.3 集合操作

```javascript
// 显示所有集合
show collections

// 创建集合
db.createCollection("users")

// 插入文档
db.users.insertOne({
  name: "张三",
  age: 25,
  email: "zhangsan@example.com",
  hobbies: ["读书", "游泳", "编程"]
})

// 批量插入文档
db.users.insertMany([
  {
    name: "李四",
    age: 30,
    email: "lisi@example.com",
    hobbies: ["音乐", "旅行"]
  },
  {
    name: "王五",
    age: 28,
    email: "wangwu@example.com",
    hobbies: ["电影", "摄影"]
  }
])

// 查询所有文档
db.users.find()

// 格式化查询结果
db.users.find().pretty()

// 删除集合
db.users.drop()
```

### 4.4 文档查询

```javascript
// 精确匹配查询
db.users.find({name: "张三"})

// 条件查询
db.users.find({age: {$gt: 25}})  // 年龄大于25
db.users.find({age: {$lt: 30}})  // 年龄小于30
db.users.find({age: {$gte: 25, $lte: 30}})  // 年龄在25-30之间

// 数组查询
db.users.find({hobbies: "读书"})  // 爱好包含"读书"
db.users.find({hobbies: {$all: ["读书", "编程"]}})  // 爱好同时包含"读书"和"编程"

// 正则表达式查询
db.users.find({name: /^张/})  // 姓张的用户

// 投影（只返回指定字段）
db.users.find({}, {name: 1, age: 1, _id: 0})

// 限制返回数量
db.users.find().limit(2)

// 跳过指定数量
db.users.find().skip(1).limit(2)

// 排序（1升序，-1降序）
db.users.find().sort({age: 1})
```

### 4.5 文档更新

```javascript
// 更新单个文档
db.users.updateOne(
  {name: "张三"},
  {$set: {age: 26}}
)

// 更新多个文档
db.users.updateMany(
  {age: {$lt: 30}},
  {$set: {status: "young"}}
)

// 数组操作
db.users.updateOne(
  {name: "张三"},
  {$push: {hobbies: "跑步"}}  // 添加元素到数组
)

db.users.updateOne(
  {name: "张三"},
  {$pull: {hobbies: "游泳"}}  // 从数组中移除元素
)

// 数值操作
db.users.updateOne(
  {name: "张三"},
  {$inc: {age: 1}}  // 年龄增加1
)
```

### 4.6 文档删除

```javascript
// 删除单个文档
db.users.deleteOne({name: "张三"})

// 删除多个文档
db.users.deleteMany({age: {$lt: 25}})

// 删除所有文档
db.users.deleteMany({})
```

## 5. MongoDB索引

### 5.1 索引类型

```javascript
// 单字段索引
db.users.createIndex({name: 1})

// 复合索引
db.users.createIndex({name: 1, age: -1})

// 唯一索引
db.users.createIndex({email: 1}, {unique: true})

// 数组索引
db.users.createIndex({"hobbies": 1})

// 文本索引
db.articles.createIndex({title: "text", content: "text"})

// 地理空间索引
db.places.createIndex({location: "2dsphere"})
```

### 5.2 索引管理

```javascript
// 查看索引
db.users.getIndexes()

// 删除索引
db.users.dropIndex({name: 1})

// 删除所有索引
db.users.dropIndexes()

// 查看索引统计信息
db.users.aggregate([{$indexStats: {}}])
```

## 6. MongoDB聚合框架

### 6.1 聚合管道操作符

```javascript
// 基本聚合示例
db.orders.aggregate([
  // 匹配条件
  {$match: {status: "completed"}},
  
  // 分组统计
  {$group: {
    _id: "$customerId",
    totalAmount: {$sum: "$amount"},
    orderCount: {$sum: 1}
  }},
  
  // 排序
  {$sort: {totalAmount: -1}},
  
  // 限制结果
  {$limit: 10}
])

// 复杂聚合示例
db.sales.aggregate([
  {$match: {
    date: {
      $gte: ISODate("2023-01-01"),
      $lt: ISODate("2024-01-01")
    }
  }},
  {$group: {
    _id: {
      year: {$year: "$date"},
      month: {$month: "$date"}
    },
    totalSales: {$sum: "$amount"},
    avgSales: {$avg: "$amount"},
    count: {$sum: 1}
  }},
  {$sort: {"_id.year": 1, "_id.month": 1}}
])
```

### 6.2 常用聚合操作符

```javascript
// $project - 重塑文档结构
db.users.aggregate([
  {$project: {
    fullName: {$concat: ["$firstName", " ", "$lastName"]},
    age: 1,
    email: 1,
    _id: 0
  }}
])

// $lookup - 连接集合
db.orders.aggregate([
  {$lookup: {
    from: "customers",
    localField: "customerId",
    foreignField: "_id",
    as: "customerInfo"
  }}
])

// $unwind - 展开数组
db.users.aggregate([
  {$unwind: "$hobbies"},
  {$group: {
    _id: "$hobbies",
    count: {$sum: 1}
  }}
])
```

## 7. MongoDB复制集（Replica Set）

### 7.1 复制集配置

```javascript
// 初始化复制集
rs.initiate({
  _id: "rs0",
  members: [
    {_id: 0, host: "mongo1.example.com:27017"},
    {_id: 1, host: "mongo2.example.com:27017"},
    {_id: 2, host: "mongo3.example.com:27017"}
  ]
})

// 查看复制集状态
rs.status()

// 查看复制集配置
rs.conf()

// 添加成员
rs.add("mongo4.example.com:27017")

// 移除成员
rs.remove("mongo4.example.com:27017")
```

### 7.2 复制集读写操作

```javascript
// 设置读偏好
db.collection.find().readPref("primary")     // 从主节点读取
db.collection.find().readPref("secondary")   // 从从节点读取

// 查看当前节点状态
db.isMaster()
```

## 8. MongoDB分片（Sharding）

### 8.1 分片集群组件

1. **Shard**：存储实际数据的分片
2. **Config Server**：存储集群元数据和配置信息
3. **Mongos**：查询路由器，客户端访问入口

### 8.2 分片配置示例

```javascript
// 连接到mongos
mongo --host mongos.example.com --port 27017

// 启用分片
sh.enableSharding("myDatabase")

// 选择分片键
sh.shardCollection("myDatabase.myCollection", {userId: 1})

// 查看分片状态
sh.status()
```

## 9. MongoDB安全配置

### 9.1 启用身份验证

```javascript
// 创建管理员用户
use admin
db.createUser({
  user: "admin",
  pwd: "password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// 创建普通用户
use myDatabase
db.createUser({
  user: "appUser",
  pwd: "password",
  roles: ["readWrite"]
})
```

### 9.2 配置文件安全设置

```yaml
# 启用身份验证
security:
  authorization: enabled

# 启用TLS/SSL
net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem

# 绑定IP地址
net:
  bindIp: 127.0.0.1,192.168.1.100
```

## 10. MongoDB性能优化

### 10.1 查询优化

```javascript
// 使用explain()分析查询性能
db.users.find({name: "张三"}).explain("executionStats")

// 创建合适的索引
db.users.createIndex({name: 1, age: 1})

// 避免全表扫描
db.users.find({name: /^张/})  // 使用索引
db.users.find({name: /张$/})  // 避免使用，会导致全表扫描
```

### 10.2 写入优化

```javascript
// 批量插入
db.users.insertMany([
  {/* document 1 */},
  {/* document 2 */},
  {/* document 3 */}
], {ordered: false})  // 无序插入，提高性能

// 使用write concern
db.users.insertOne(
  {name: "赵六"},
  {writeConcern: {w: 1, j: true, wtimeout: 1000}}
)
```

### 10.3 内存优化

```javascript
// 调整WiredTiger缓存大小
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # 根据系统内存调整
```

## 11. MongoDB备份与恢复

### 11.1 使用mongodump备份

```bash
# 备份整个数据库
mongodump --host localhost --port 27017 --out /backup/

# 备份指定数据库
mongodump --db myDatabase --out /backup/

# 备份指定集合
mongodump --db myDatabase --collection users --out /backup/

# 带身份验证的备份
mongodump --username admin --password --authenticationDatabase admin --out /backup/
```

### 11.2 使用mongorestore恢复

```bash
# 恢复整个备份
mongorestore --host localhost --port 27017 /backup/

# 恢复指定数据库
mongorestore --db myDatabase /backup/myDatabase/

# 恢复指定集合
mongorestore --db myDatabase --collection users /backup/myDatabase/users.bson
```

### 11.3 文件系统快照备份

```bash
# 停止MongoDB服务
sudo systemctl stop mongod

# 创建文件系统快照（LVM或云服务商快照）

# 启动MongoDB服务
sudo systemctl start mongod
```

## 12. MongoDB监控

### 12.1 使用db.stats()

```javascript
// 数据库统计信息
db.stats()

// 集合统计信息
db.users.stats()
```

### 12.2 使用MongoDB Compass

MongoDB Compass是MongoDB官方提供的图形化管理工具，可以直观地查看数据库结构、执行查询和分析性能。

### 12.3 使用第三方监控工具

```bash
# 使用mongostat监控实时操作
mongostat --host localhost:27017

# 使用mongotop监控读写时间
mongotop --host localhost:27017
```

## 13. MongoDB故障排除

### 13.1 常见错误及解决方案

#### 1. 连接被拒绝

```bash
# 检查MongoDB服务状态
sudo systemctl status mongod

# 检查端口是否被占用
netstat -tlnp | grep 27017

# 检查防火墙设置
sudo firewall-cmd --list-all
```

#### 2. 磁盘空间不足

```bash
# 检查磁盘使用情况
df -h

# 清理不必要的数据
db.collection.deleteMany({/* 条件 */})
```

#### 3. 内存不足

```bash
# 检查内存使用情况
free -h

# 调整WiredTiger缓存大小
# 在配置文件中设置 storage.wiredTiger.engineConfig.cacheSizeGB
```

### 13.2 日志分析

```bash
# 查看MongoDB日志
tail -f /var/log/mongodb/mongod.log

# 搜索错误信息
grep "ERROR" /var/log/mongodb/mongod.log
```

## 总结

MongoDB作为一个强大的NoSQL数据库，具有灵活的数据模型、优秀的水平扩展能力和丰富的查询功能。通过本文的学习，你应该掌握了：

1. MongoDB在不同操作系统下的安装方法
2. MongoDB的基本配置和管理操作
3. MongoDB的增删改查操作和高级查询功能
4. 索引的创建和管理
5. 聚合框架的使用
6. 复制集和分片的配置
7. 安全配置和身份验证
8. 性能优化技巧
9. 备份与恢复策略
10. 监控和故障排除方法

在实际应用中，应该根据具体业务需求合理设计数据模型，创建合适的索引，配置适当的复制集或分片策略，以充分发挥MongoDB的优势。