# Express深入解析

Express 是一个基于 Node.js 平台的极简、灵活的 web 应用框架，它提供了一系列强大的特性，帮助我们创建各种 Web 和移动设备应用。在掌握了 Express 基础之后，我们需要深入了解其核心原理和高级特性，以构建更高效、更安全的应用。

## 1. Express核心概念

### 1.1 Express简介与架构

Express 是一个轻量级的 Web 应用框架，它基于 Node.js 内置的 HTTP 模块构建。Express 的设计理念是"最小化"和"灵活性"，它不会强制开发者使用特定的项目结构或模式，而是提供了基础的路由和中间件功能。

```javascript
// Express 基本结构
const express = require('express');
const app = express();

// 路由定义
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// 启动服务器
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

Express 的核心组件包括：
1. **应用程序对象 (app)** - Express 应用的实例
2. **请求对象 (req)** - HTTP 请求对象的增强版
3. **响应对象 (res)** - HTTP 响应对象的增强版
4. **中间件 (middleware)** - 处理请求和响应的函数
5. **路由 (routing)** - 确定应用如何响应客户端请求

### 1.2 中间件机制详解

中间件是 Express 应用的核心概念，它是一个函数，可以访问请求对象 (req)、响应对象 (res) 和应用请求-响应循环中的下一个中间件函数 (next)。

```javascript
// 中间件的基本结构
function middleware(req, res, next) {
  // 处理请求
  console.log('Middleware executed');
  
  // 调用下一个中间件
  next();
}

// 使用中间件
app.use(middleware);

// 有条件地跳过中间件
function conditionalMiddleware(req, res, next) {
  if (req.headers['x-skip-middleware']) {
    // 跳过中间件
    next();
  } else {
    // 处理请求
    console.log('Conditional middleware executed');
    next();
  }
}
```

中间件的类型：
1. **应用级中间件** - 使用 app.use() 或 app.METHOD() 绑定到 app 实例
2. **路由器级中间件** - 使用 router.use() 或 router.METHOD() 绑定到 router 实例
3. **错误处理中间件** - 接收四个参数 (err, req, res, next)
4. **内置中间件** - Express 内置的中间件函数
5. **第三方中间件** - 通过 npm 安装的中间件

### 1.3 路由系统深入

Express 的路由系统允许我们定义应用如何响应客户端的不同 HTTP 请求。

```javascript
// 基本路由
app.get('/', (req, res) => {
  res.send('GET request to homepage');
});

app.post('/', (req, res) => {
  res.send('POST request to homepage');
});

// 路由参数
app.get('/users/:userId/books/:bookId', (req, res) => {
  res.send(req.params);
  // { "userId": "34", "bookId": "8989" }
});

// 查询字符串
app.get('/search', (req, res) => {
  res.send(req.query);
  // GET /search?q=tobi+ferret&order=desc
  // { "q": "tobi ferret", "order": "desc" }
});

// 正则表达式路由
app.get(/.*fly$/, (req, res) => {
  res.send('/.*fly$/');
});
```

### 1.4 请求与响应对象

Express 扩展了 Node.js 的原生请求和响应对象，提供了更多的实用方法。

```javascript
// 请求对象常用属性和方法
app.get('/user/:id', (req, res) => {
  console.log(req.params); // 路由参数
  console.log(req.query);  // 查询字符串
  console.log(req.body);   // 请求体（需要 body-parser）
  console.log(req.headers); // 请求头
  console.log(req.method);  // HTTP 方法
  console.log(req.url);     // 请求 URL
});

// 响应对象常用方法
app.get('/response-examples', (req, res) => {
  // 发送文本响应
  res.send('Hello World');
  
  // 发送 JSON 响应
  res.json({ message: 'Hello World' });
  
  // 发送文件
  res.sendFile('/path/to/file.txt');
  
  // 设置状态码
  res.status(404).send('Not Found');
  
  // 设置响应头
  res.set('Content-Type', 'text/plain');
  
  // 重定向
  res.redirect('/login');
  
  // 下载文件
  res.download('/path/to/file.pdf');
});
```

## 2. 中间件深度解析

### 2.1 内置中间件

Express 提供了一些内置中间件函数：

```javascript
// express.static - 提供静态文件服务
app.use(express.static('public'));

// express.json - 解析 JSON 请求体
app.use(express.json());

// express.urlencoded - 解析 URL-encoded 请求体
app.use(express.urlencoded({ extended: true }));

// express.raw - 解析原始 Buffer 请求体
app.use(express.raw());

// express.text - 解析文本请求体
app.use(express.text());
```

### 2.2 第三方中间件

常用的第三方中间件：

```javascript
// body-parser - 解析请求体（Express 4.16.0 之前必需）
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// cors - 处理跨域资源共享
const cors = require('cors');
app.use(cors());

// morgan - HTTP 请求日志记录
const logger = require('morgan');
app.use(logger('combined'));

// helmet - 安全头设置
const helmet = require('helmet');
app.use(helmet());

// compression - 响应压缩
const compression = require('compression');
app.use(compression());
```

### 2.3 自定义中间件开发

创建可重用的自定义中间件：

```javascript
// 日志中间件
function logger(req, res, next) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
}

// 认证中间件
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  try {
    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// 错误处理中间件
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
}

// 注册中间件
app.use(logger);
app.use('/api', requireAuth);
app.use(errorHandler);
```

### 2.4 错误处理中间件

错误处理中间件必须有四个参数：

```javascript
// 错误处理中间件
function errorHandler(err, req, res, next) {
  // 错误日志记录
  console.error(err.stack);
  
  // 根据错误类型返回不同的响应
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  
  if (err instanceof AuthenticationError) {
    return res.status(401).json({ error: err.message });
  }
  
  // 默认错误响应
  res.status(500).json({ error: 'Internal Server Error' });
}

// 异步错误处理
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 使用异步错误处理
app.get('/async-route', asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
}));
```

## 3. 路由与控制器

### 3.1 路由参数与查询字符串

深入理解路由参数和查询字符串的处理：

```javascript
// 路由参数验证
app.get('/users/:userId(\\d+)', (req, res) => {
  // 只匹配数字类型的 userId
  res.send(`User ID: ${req.params.userId}`);
});

// 可选参数
app.get('/posts/:postId?', (req, res) => {
  if (req.params.postId) {
    res.send(`Post ID: ${req.params.postId}`);
  } else {
    res.send('All posts');
  }
});

// 通配符参数
app.get('/files/*', (req, res) => {
  res.send(`File path: ${req.params[0]}`);
});

// 查询字符串数组
app.get('/search', (req, res) => {
  // GET /search?tags=nodejs&tags=express&tags=api
  const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
  res.json({ tags });
});
```

### 3.2 路由组与模块化

使用 Router 对象组织路由：

```javascript
// users.js - 用户路由模块
const express = require('express');
const router = express.Router();

// 中间件仅应用于这个路由器
router.use((req, res, next) => {
  console.log('Users router middleware');
  next();
});

// 路由定义
router.get('/', (req, res) => {
  res.json({ message: 'Get all users' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get user ${req.params.id}` });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create user', data: req.body });
});

module.exports = router;

// app.js - 主应用文件
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);
```

### 3.3 控制器设计模式

分离路由和业务逻辑：

```javascript
// controllers/userController.js
class UserController {
  static async getAllUsers(req, res, next) {
    try {
      const users = await User.findAll();
      res.json(users);
    } catch (err) {
      next(err);
    }
  }
  
  static async getUserById(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
  
  static async createUser(req, res, next) {
    try {
      const user = await User.create(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;

// routes/users.js
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

router.get('/', UserController.getAllUsers);
router.get('/:id', UserController.getUserById);
router.post('/', UserController.createUser);

module.exports = router;
```

### 3.4 RESTful API设计

遵循 RESTful 设计原则：

```javascript
// RESTful 路由设计示例
app.get('/api/posts', getAllPosts);        // 获取所有文章
app.post('/api/posts', createPost);        // 创建文章
app.get('/api/posts/:id', getPostById);    // 获取特定文章
app.put('/api/posts/:id', updatePost);     // 更新文章
app.delete('/api/posts/:id', deletePost);  // 删除文章

// 嵌套路由
app.get('/api/posts/:postId/comments', getCommentsByPost);
app.post('/api/posts/:postId/comments', createComment);
app.put('/api/comments/:id', updateComment);
app.delete('/api/comments/:id', deleteComment);

// 状态码规范
// 200 - 成功
// 201 - 创建成功
// 400 - 请求错误
// 401 - 未认证
// 403 - 无权限
// 404 - 未找到
// 500 - 服务器错误
```

## 4. 数据验证与安全

### 4.1 输入验证

使用 Joi 进行数据验证：

```javascript
const Joi = require('joi');

// 定义验证模式
const userSchema = Joi.object({
  name: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')).required(),
  age: Joi.number().integer().min(0).max(120),
  roles: Joi.array().items(Joi.string()).unique()
});

// 验证中间件
function validateUser(req, res, next) {
  const { error, value } = userSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  req.validatedBody = value;
  next();
}

// 使用验证中间件
app.post('/api/users', validateUser, (req, res) => {
  // req.validatedBody 包含已验证的数据
  res.json({ message: 'User created', data: req.validatedBody });
});
```

### 4.2 身份认证与授权

实现 JWT 认证：

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// 登录路由
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  // 查找用户
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // 验证密码
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // 生成 JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token, user: { id: user.id, email: user.email } });
});

// 认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  });
}

// 授权中间件
function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user.roles.includes(requiredRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// 使用认证和授权
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.delete('/api/users/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ message: 'User deleted' });
});
```

### 4.3 CSRF防护

实施 CSRF 防护：

```javascript
const csrf = require('csurf');

// CSRF 保护中间件
const csrfProtection = csrf({ cookie: true });

// 为需要保护的路由添加 CSRF 保护
app.use('/api/admin', csrfProtection);

// 提供 CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// 在表单中使用 CSRF token
/*
<form method="POST" action="/api/admin/users">
  <input type="hidden" name="_csrf" value="{{csrfToken}}">
  <input type="text" name="username">
  <button type="submit">Create User</button>
</form>
*/
```

### 4.4 安全头设置

使用 Helmet 设置安全头：

```javascript
const helmet = require('helmet');

app.use(helmet());

// 自定义安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  dnsPrefetchControl: false,
  expectCt: {
    enforce: true,
    maxAge: 30,
  },
}));

// 速率限制
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制每个 IP 15 分钟内最多 100 个请求
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
```

## 5. 数据库集成

### 5.1 MongoDB与Mongoose

使用 Mongoose 操作 MongoDB：

```javascript
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 定义 Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// 添加实例方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 添加静态方法
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email });
};

// 创建 Model
const User = mongoose.model('User', userSchema);

// CRUD 操作
// 创建
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 查询
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({ isActive: true });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 删除
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 5.2 PostgreSQL与Sequelize

使用 Sequelize 操作 PostgreSQL：

```javascript
const { Sequelize, DataTypes } = require('sequelize');

// 创建连接
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'postgres'
});

// 定义模型
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'users'
});

// 同步模型到数据库
sequelize.sync();

// CRUD 操作
// 创建
app.post('/api/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 查询
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const { rows, count } = await User.findAndCountAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      users: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 关联查询
const Post = sequelize.define('Post', {
  title: DataTypes.STRING,
  content: DataTypes.TEXT
});

User.hasMany(Post);
Post.belongsTo(User);

app.get('/api/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{
        model: Post,
        attributes: ['id', 'title', 'createdAt']
      }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.Posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 5.3 数据库连接池

配置数据库连接池：

```javascript
// MongoDB 连接池配置
mongoose.connect('mongodb://localhost:27017/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // 连接池最大连接数
  serverSelectionTimeoutMS: 5000, // 服务器选择超时时间
  socketTimeoutMS: 45000, // Socket 超时时间
});

// PostgreSQL 连接池配置
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'postgres',
  pool: {
    max: 20, // 最大连接数
    min: 5,  // 最小连接数
    acquire: 30000, // 获取连接的超时时间
    idle: 10000 // 连接空闲时间
  }
});
```

### 5.4 事务处理

在数据库操作中使用事务：

```javascript
// MongoDB 事务
app.post('/api/transfer', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { fromAccountId, toAccountId, amount } = req.body;
    
    // 从账户扣款
    const fromAccount = await Account.findByIdAndUpdate(
      fromAccountId,
      { $inc: { balance: -amount } },
      { session, new: true }
    );
    
    if (fromAccount.balance < 0) {
      throw new Error('Insufficient funds');
    }
    
    // 向账户存款
    await Account.findByIdAndUpdate(
      toAccountId,
      { $inc: { balance: amount } },
      { session }
    );
    
    // 提交事务
    await session.commitTransaction();
    session.endSession();
    
    res.json({ message: 'Transfer successful' });
  } catch (err) {
    // 回滚事务
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: err.message });
  }
});

// PostgreSQL 事务
app.post('/api/orders', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // 创建订单
    const order = await Order.create(req.body, { transaction });
    
    // 更新库存
    await Product.decrement('stock', {
      by: req.body.quantity,
      where: { id: req.body.productId },
      transaction
    });
    
    // 提交事务
    await transaction.commit();
    res.status(201).json(order);
  } catch (err) {
    // 回滚事务
    await transaction.rollback();
    res.status(400).json({ error: err.message });
  }
});
```

## 6. 性能优化

### 6.1 缓存策略

实现多层缓存：

```javascript
const redis = require('redis');
const client = redis.createClient();

// Redis 缓存中间件
function cacheMiddleware(duration = 300) {
  return async (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    
    try {
      const cached = await client.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // 重写 res.send 方法来缓存响应
      res.sendResponse = res.send;
      res.send = (body) => {
        client.setex(key, duration, body);
        res.sendResponse(body);
      };
      
      next();
    } catch (err) {
      next();
    }
  };
}

// 使用缓存
app.get('/api/users', cacheMiddleware(600), async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// 内存缓存
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 });

function memoryCacheMiddleware(req, res, next) {
  const key = req.originalUrl || req.url;
  const cached = cache.get(key);
  
  if (cached) {
    return res.json(cached);
  }
  
  res.sendResponse = res.send;
  res.send = (body) => {
    cache.set(key, JSON.parse(body));
    res.sendResponse(body);
  };
  
  next();
}
```

### 6.2 数据库查询优化

优化数据库查询：

```javascript
// 索引优化
// 为经常查询的字段创建索引
User.index({ email: 1 });
User.index({ createdAt: -1 });

// 查询优化
app.get('/api/users', async (req, res) => {
  try {
    // 只选择需要的字段
    const users = await User.find({}, { name: 1, email: 1, _id: 1 });
    
    // 分页查询
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const users = await User.find({})
      .select('name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 聚合管道优化
app.get('/api/users/stats', async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 6.3 压缩与静态资源处理

优化静态资源：

```javascript
const compression = require('compression');
const expressStaticGzip = require('express-static-gzip');

// 响应压缩
app.use(compression());

// 静态资源压缩
app.use('/static', expressStaticGzip('public', {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  serveStatic: {
    maxAge: '1y'
  }
}));

// ETag 设置
app.set('etag', 'strong'); // 或 'weak'

// 条件请求处理
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});
```

### 6.4 负载均衡

集群模式部署：

```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // 重启 worker
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  const app = require('./app');
  
  app.listen(3000, () => {
    console.log(`Worker ${process.pid} started`);
  });
}
```

## 7. 错误处理与日志

### 7.1 统一错误处理

建立统一的错误处理机制：

```javascript
// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 全局错误处理中间件
function globalErrorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // 开发环境显示详细错误信息
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    // 生产环境隐藏敏感信息
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // 编程错误或其他未知错误
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!'
      });
    }
  }
}

// 异步错误处理包装器
function catchAsync(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// 使用示例
app.get('/api/users/:id', catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json(user);
}));
```

### 7.2 日志记录

使用 Winston 记录日志：

```javascript
const winston = require('winston');
const expressWinston = require('express-winston');

// 创建 logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// 在生产环境中也输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 请求日志中间件
app.use(expressWinston.logger({
  transports: [
    new winston.transports.File({ filename: 'logs/request.log' })
  ],
  format: winston.format.combine(
    winston.format.json()
  ),
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
  ignoreRoute: function (req, res) { return false; }
}));

// 使用 logger
app.get('/api/test', (req, res) => {
  logger.info('Test endpoint accessed');
  logger.warn('This is a warning');
  res.json({ message: 'Success' });
});
```

### 7.3 异常监控

集成异常监控服务：

```javascript
// Sentry 集成
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// 在路由之后添加错误处理
app.use(Sentry.Handlers.errorHandler());

// 自定义异常上报
function reportError(err, req) {
  Sentry.captureException(err, {
    user: req.user,
    extra: {
      url: req.url,
      method: req.method,
      headers: req.headers
    }
  });
}
```

### 7.4 调试技巧

使用调试工具：

```javascript
// 使用 debug 模块
const debug = require('debug')('app:startup');
const dbDebug = require('debug')('app:db');

debug('Starting application...');
dbDebug('Connecting to database...');

// 环境变量控制调试输出
// DEBUG=app:* npm start
// DEBUG=app:db npm start
// DEBUG=* npm start

// 性能监控
console.time('Database Query');
const users = await User.find({});
console.timeEnd('Database Query');

// 内存使用监控
app.use((req, res, next) => {
  const used = process.memoryUsage();
  console.log('Memory usage:', used);
  next();
});
```

## 8. 测试与部署

### 8.1 单元测试与集成测试

使用 Jest 进行测试：

```javascript
// __tests__/userController.test.js
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('User API', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });
  
  describe('GET /api/users', () => {
    it('should get all users', async () => {
      await User.create({ name: 'John', email: 'john@example.com' });
      
      const res = await request(app)
        .get('/api/users')
        .expect(200);
      
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('John');
    });
  });
  
  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Jane',
        email: 'jane@example.com',
        password: 'password123'
      };
      
      const res = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);
      
      expect(res.body.name).toBe('Jane');
      expect(res.body.email).toBe('jane@example.com');
      
      const user = await User.findOne({ email: 'jane@example.com' });
      expect(user).toBeTruthy();
    });
    
    it('should return 400 for invalid data', async () => {
      const invalidData = {
        name: 'J',
        email: 'invalid-email'
      };
      
      await request(app)
        .post('/api/users')
        .send(invalidData)
        .expect(400);
    });
  });
});

// 单元测试示例
// __tests__/utils.test.js
const { validateEmail } = require('../utils/validation');

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });
    
    it('should return false for invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
    });
  });
});
```

### 8.2 API测试

使用 Postman 或 Newman 进行 API 测试：

```javascript
// test/api-tests.js
const newman = require('newman');

newman.run({
  collection: require('./api-tests.postman_collection.json'),
  environment: require('./local.postman_environment.json'),
  reporters: ['cli', 'json'],
  reporter: {
    json: {
      export: './reports/api-test-results.json'
    }
  }
}, function (err) {
  if (err) {
    throw err;
  }
  console.log('API tests completed!');
});
```

### 8.3 Docker容器化部署

创建 Docker 配置：

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mongodb://mongo:27017/myapp
    depends_on:
      - mongo
      - redis
    volumes:
      - ./logs:/app/logs

  mongo:
    image: mongo:4.4
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

### 8.4 性能监控

集成性能监控：

```javascript
// 使用 Prometheus 监控指标
const client = require('prom-client');

// 创建默认指标
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// 自定义指标
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
});

// 中间件记录指标
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      code: res.statusCode
    };
    
    end(labels);
  });
  
  next();
});

// 暴露指标端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

通过对 Express 核心概念和高级特性的深入理解，我们可以更好地利用 Express 构建高性能、可维护的 Web 应用程序。在实际开发中，我们应该根据项目需求选择合适的技术方案，并持续关注 Node.js 和 Express 生态的发展。