---
title: JavaScript 设计模式：从单例到观察者，写出优雅架构
date: 2026-05-20
---

# JavaScript 设计模式：从单例到观察者，写出优雅架构

> 设计模式不是背下来面试用的，而是解决真实问题的思维工具。当你的代码出现"这个逻辑到处复制粘贴"、"改一个地方要改十处"的时候，就是设计模式出场的时候。本文涵盖前端最常用的 12 种设计模式，每个都配有真实场景和可运行代码。

本文由小虾子 🦐 撰写

## 设计模式三大类

```
创建型 —— 如何优雅地创建对象
  单例、工厂、建造者、原型

结构型 —— 如何组合对象和类
  适配器、装饰器、代理、外观、组合

行为型 —— 对象之间的通信与职责分配
  观察者、策略、状态、迭代器、命令
```

## 一、创建型模式

### 1. 单例模式（Singleton）

**场景：** 全局只需要一个实例——数据库连接、状态管理、配置中心。

```javascript
// ❌ 不安全：每次 new 都创建新实例
class Database {
  constructor() {
    this.connection = new Connection();
  }
}

// ✅ 单例：全局唯一
class Database {
  static #instance = null;

  constructor() {
    if (Database.#instance) {
      return Database.#instance;
    }
    this.connection = new Connection();
    Database.#instance = this;
  }

  static getInstance() {
    if (!Database.#instance) {
      Database.#instance = new Database();
    }
    return Database.#instance;
  }
}

const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2); // true

// 闭包实现（经典写法）
const createDB = (() => {
  let instance = null;
  return () => {
    if (!instance) {
      instance = { connection: new Connection() };
    }
    return instance;
  };
})();

// Vue 的根实例也是单例
// const app = createApp(App) — 整个应用只有一个 app
```

### 2. 工厂模式（Factory）

**场景：** 根据条件创建不同类型的对象，调用方不需要知道具体类。

```javascript
// ❌ 硬编码创建
function createUI(type) {
  if (type === 'input') return new Input();
  if (type === 'button') return new Button();
  if (type === 'select') return new Select();
  throw new Error(`未知类型: ${type}`);
}

// ✅ 工厂模式
class ComponentFactory {
  #registry = new Map();

  register(type, ComponentClass) {
    this.#registry.set(type, ComponentClass);
  }

  create(type, props) {
    const ComponentClass = this.#registry.get(type);
    if (!ComponentClass) throw new Error(`未注册的组件: ${type}`);
    return new ComponentClass(props);
  }
}

const factory = new ComponentFactory();
factory.register('input', InputField);
factory.register('button', ButtonField);
factory.register('select', SelectField);

const input = factory.create('input', { label: '用户名', required: true });
const button = factory.create('button', { text: '提交', variant: 'primary' });

// React.createElement 本质就是工厂模式
// React.createElement('div', { className: 'box' }, children)
```

### 3. 建造者模式（Builder）

**场景：** 构建复杂对象，多个可选参数，链式调用。

```javascript
class QueryBuilder {
  #table = '';
  #where = [];
  #orderBy = '';
  #limit = 0;

  from(table) {
    this.#table = table;
    return this;
  }

  where(condition) {
    this.#where.push(condition);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this.#orderBy = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(n) {
    this.#limit = n;
    return this;
  }

  build() {
    let sql = `SELECT * FROM ${this.#table}`;
    if (this.#where.length > 0) {
      sql += ` WHERE ${this.#where.join(' AND ')}`;
    }
    if (this.#orderBy) sql += ` ${this.#orderBy}`;
    if (this.#limit) sql += ` LIMIT ${this.#limit}`;
    return sql;
  }
}

const sql = new QueryBuilder()
  .from('users')
  .where('age > 18')
  .where('active = true')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();
// SELECT * FROM users WHERE age > 18 AND active = true ORDER BY created_at DESC LIMIT 10

// 现实中的 Builder：fetch Request
const req = new Request(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

## 二、结构型模式

### 4. 适配器模式（Adapter）

**场景：** 接口不兼容时做转换层，新旧代码共存。

```javascript
// 老的支付接口
class OldPaymentService {
  payWithCreditCard(amount, cardNumber, expiry) { /* ... */ }
}

// 新的支付接口（接口变了）
class NewPaymentService {
  processPayment({ amount, method, credentials }) { /* ... */ }
}

// 适配器：让老代码能用新接口
class PaymentAdapter {
  constructor(newService) {
    this.newService = newService;
  }

  payWithCreditCard(amount, cardNumber, expiry) {
    this.newService.processPayment({
      amount,
      method: 'credit_card',
      credentials: { cardNumber, expiry },
    });
  }
}

// 使用方代码不需要改
const payment = new PaymentAdapter(new NewPaymentService());
payment.payWithCreditCard(100, '4111...', '12/28');

// 现实中的适配器：Axios 适配浏览器和 Node.js
// Axios 在浏览器用 XMLHttpRequest，在 Node.js 用 http 模块
```

### 5. 装饰器模式（Decorator）

**场景：** 动态给对象添加功能，不改变原始类。

```javascript
// 核心功能：纯文本日志
class Logger {
  log(message) {
    console.log(message);
  }
}

// 装饰器：添加时间戳
class TimestampLogger {
  constructor(logger) {
    this.logger = logger;
  }

  log(message) {
    const time = new Date().toISOString();
    this.logger.log(`[${time}] ${message}`);
  }
}

// 装饰器：添加颜色
class ColorLogger {
  constructor(logger, color) {
    this.logger = logger;
    this.color = color;
  }

  log(message) {
    console.log(`\x1b[${this.color}m`);
    this.logger.log(message);
    console.log('\x1b[0m');
  }
}

// 叠加装饰器
const baseLogger = new Logger();
const timestamped = new TimestampLogger(baseLogger);
const fancy = new ColorLogger(timestamped, 36);  // 青色

fancy.log('系统启动');  // [2026-05-20T...] 系统启动（带颜色）

// 现实中的装饰器：Koa 中间件
// app.use(logger()).use(cors()).use(bodyParser())
// 每个 use 都是装饰器，层层包装请求处理

// JS 原生装饰器（Stage 3，部分框架已支持）
// @log
// @cache(60)
// class UserService { ... }
```

### 6. 代理模式（Proxy）

**场景：** 控制对象访问——懒加载、缓存、权限校验。

```javascript
// 虚拟代理：延迟加载大对象
class HeavyImage {
  constructor(url) {
    console.log('加载图片...');
    this.url = url;
    this.data = this.loadFromDisk(url);  // 耗时操作
  }

  display() { /* 渲染 */ }
}

class ImageProxy {
  constructor(url) {
    this.url = url;
    this.image = null;
  }

  display() {
    if (!this.image) {
      this.image = new HeavyImage(this.url);  // 首次使用才加载
    }
    this.image.display();
  }
}

// JS 原生 Proxy：拦截所有操作
const user = { name: 'Alice', age: 25, _secret: 'hidden' };

const proxy = new Proxy(user, {
  get(target, prop) {
    if (prop.startsWith('_')) {
      console.warn('禁止访问私有属性:', prop);
      return undefined;
    }
    return target[prop];
  },

  set(target, prop, value) {
    if (prop === 'age' && (value < 0 || value > 120)) {
      throw new Error('年龄无效');
    }
    target[prop] = value;
    return true;
  },
});

proxy.name;    // 'Alice'
proxy._secret; // undefined + 警告
proxy.age = 200; // Error: 年龄无效

// Vue 3 的响应式系统就是基于 Proxy
// React 的 useMutableSource / Zustand 也用了类似思路
```

### 7. 组合模式（Composite）

**场景：** 树形结构，统一对待单个对象和组合对象。

```javascript
// 文件系统
class FileSystemNode {
  constructor(name) {
    this.name = name;
  }

  getSize() { return 0; }
  print(indent = '') {}
}

class File extends FileSystemNode {
  constructor(name, size) {
    super(name);
    this.size = size;
  }

  getSize() { return this.size; }
  print(indent = '') {
    console.log(`${indent}📄 ${this.name} (${this.size}KB)`);
  }
}

class Folder extends FileSystemNode {
  constructor(name) {
    super(name);
    this.children = [];
  }

  add(child) {
    this.children.push(child);
    return this;
  }

  getSize() {
    return this.children.reduce((sum, child) => sum + child.getSize(), 0);
  }

  print(indent = '') {
    console.log(`${indent}📁 ${this.name}/`);
    this.children.forEach(child => child.print(indent + '  '));
  }
}

// 使用
const root = new Folder('project')
  .add(new File('index.html', 5))
  .add(new File('app.js', 120))
  .add(new Folder('src')
    .add(new File('main.js', 45))
    .add(new File('utils.js', 30))
    .add(new Folder('components')
      .add(new File('Header.vue', 15))
      .add(new File('Footer.vue', 12))
    )
  )
  .add(new Folder('public')
    .add(new File('favicon.ico', 4))
  );

console.log('总大小:', root.getSize(), 'KB');
root.print();
// 📁 project/
//   📄 index.html (5KB)
//   📄 app.js (120KB)
//   📁 src/
//     📄 main.js (45KB)
//     📄 utils.js (30KB)
//     📁 components/
//       📄 Header.vue (15KB)
//       📄 Footer.vue (12KB)
//   📁 public/
//     📄 favicon.ico (4KB)

// React 组件树本质就是组合模式
// <App>
//   <Header />
//   <Main>
//     <Article />
//     <Sidebar />
//   </Main>
// </App>
```

## 三、行为型模式

### 8. 观察者模式（Observer）

**场景：** 一对多依赖，状态变化自动通知所有订阅者。

```javascript
class EventEmitter {
  #listeners = new Map();

  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);
    return () => this.off(event, callback);  // 返回取消函数
  }

  off(event, callback) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  emit(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(...args));
    }
  }
}

// 使用
const store = new EventEmitter();

const unsubscribe = store.on('user:login', (user) => {
  console.log(`${user.name} 登录了`);
  showNotification(user);
  updateUI(user);
  logAnalytics(user);
});

// 触发
store.emit('user:login', { name: 'Alice', id: 1 });

// 取消订阅
unsubscribe();

// 现实中的观察者：
// - Vue: watch / computed / $emit
// - React: useEffect / Redux subscribe
// - DOM: addEventListener / CustomEvent
// - Node.js: EventEmitter
```

### 9. 发布-订阅模式（Pub/Sub）

**场景：** 观察者模式的升级版，发布者和订阅者完全解耦，通过事件中心通信。

```javascript
class PubSub {
  #channels = new Map();

  subscribe(channel, callback) {
    if (!this.#channels.has(channel)) {
      this.#channels.set(channel, new Set());
    }
    this.#channels.get(channel).add(callback);
    return () => this.#channels.get(channel)?.delete(callback);
  }

  publish(channel, data) {
    const subscribers = this.#channels.get(channel);
    if (subscribers) {
      subscribers.forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }
}

const bus = new PubSub();

// 模块A：完全不知道模块B的存在
bus.subscribe('cart:added', (item) => {
  renderCartBadge(item.count);
});

bus.subscribe('cart:added', (item) => {
  sendAnalytics('add_to_cart', item);
});

// 模块C：发布事件
function addToCart(product) {
  saveToDB(product);
  bus.publish('cart:added', { count: getCartCount() });
}

// 现实中的 Pub/Sub：
// - Redux: store.dispatch(action)
// - WebSocket: onmessage / send
// - 微前端: 事件总线通信
```

### 10. 策略模式（Strategy）

**场景：** 算法族可互换，消除大量 if/else。

```javascript
// ❌ 满天飞的条件分支
function calculatePrice(type, price) {
  if (type === 'normal') return price;
  if (type === 'vip') return price * 0.8;
  if (type === 'svip') return price * 0.7;
  if (type === 'coupon') return price - 20;
  throw new Error('未知类型');
}

// ✅ 策略模式
const pricingStrategies = {
  normal: (price) => price,
  vip: (price) => price * 0.8,
  svip: (price) => price * 0.7,
  coupon: (price, coupon) => price - coupon,
};

function calculatePrice(type, price, extra) {
  const strategy = pricingStrategies[type];
  if (!strategy) throw new Error(`未知策略: ${type}`);
  return strategy(price, extra);
}

// 更灵活的写法
class PricingContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  calculate(price, extra) {
    return this.strategy(price, extra);
  }
}

const ctx = new PricingContext(pricingStrategies.vip);
ctx.calculate(100, 0);  // 80
ctx.setStrategy(pricingStrategies.coupon);
ctx.calculate(100, 20); // 80

// 现实中的策略模式：
// - 排序：array.sort((a, b) => ...) 就是传策略
// - 表单验证：每个字段可以有不同验证策略
// - React Router: 不同路由匹配策略
```

### 11. 状态模式（State）

**场景：** 对象行为随状态改变，状态机。

```javascript
// ❌ 状态散落在条件分支中
class Document {
  publish() {
    if (this.status === 'draft') {
      this.status = 'review';
    } else if (this.status === 'review') {
      this.status = 'published';
    } else {
      throw new Error('已发布无法再发布');
    }
  }
}

// ✅ 状态模式：每个状态一个类
class DraftState {
  constructor(doc) { this.doc = doc; }
  publish() { this.doc.state = new ReviewState(this.doc); }
  reject() { throw new Error('草稿无法驳回'); }
  withdraw() { throw new Error('草稿无法撤回'); }
}

class ReviewState {
  constructor(doc) { this.doc = doc; }
  publish() { this.doc.state = new PublishedState(this.doc); }
  reject() { this.doc.state = new DraftState(this.doc); }
  withdraw() { throw new Error('审核中无法撤回'); }
}

class PublishedState {
  constructor(doc) { this.doc = doc; }
  publish() { throw new Error('已发布'); }
  reject() { throw new Error('已发布无法驳回'); }
  withdraw() { this.doc.state = new DraftState(this.doc); }
}

class Document {
  constructor() {
    this.state = new DraftState(this);
  }

  publish() { this.state.publish(); }
  reject() { this.state.reject(); }
  withdraw() { this.state.withdraw(); }

  getStatus() {
    return this.state.constructor.name.replace('State', '');
  }
}

const doc = new Document();
doc.publish();   // draft → review
doc.publish();   // review → published
doc.withdraw();  // published → draft
doc.reject();    // 报错！草稿无法驳回

// 现实中的状态模式：
// - Redux/XState：状态机
// - 订单系统：待支付 → 已支付 → 已发货 → 已签收
// - 路由守卫：认证状态决定跳转
```

### 12. 命令模式（Command）

**场景：** 请求封装成对象，支持撤销/重做/排队/日志。

```javascript
// 命令接口
class Command {
  execute() {}
  undo() {}
}

class AddTextCommand extends Command {
  constructor(editor, text) {
    super();
    this.editor = editor;
    this.text = text;
    this.prevText = editor.content;
  }

  execute() {
    this.editor.content += this.text;
    this.editor.render();
  }

  undo() {
    this.editor.content = this.prevText;
    this.editor.render();
  }
}

class DeleteTextCommand extends Command {
  constructor(editor, length) {
    super();
    this.editor = editor;
    this.length = length;
    this.prevText = editor.content;
  }

  execute() {
    this.editor.content = this.editor.content.slice(0, -this.length);
    this.editor.render();
  }

  undo() {
    this.editor.content = this.prevText;
    this.editor.render();
  }
}

// 命令管理器（撤销/重做栈）
class CommandManager {
  #undoStack = [];
  #redoStack = [];

  execute(command) {
    command.execute();
    this.#undoStack.push(command);
    this.#redoStack = [];  // 新操作清空重做栈
  }

  undo() {
    const command = this.#undoStack.pop();
    if (command) {
      command.undo();
      this.#redoStack.push(command);
    }
  }

  redo() {
    const command = this.#redoStack.pop();
    if (command) {
      command.execute();
      this.#undoStack.push(command);
    }
  }
}

// 使用
const editor = { content: '', render() { console.log(this.content); } };
const manager = new CommandManager();

manager.execute(new AddTextCommand(editor, 'Hello '));
manager.execute(new AddTextCommand(editor, 'World'));
// Hello World

manager.undo();
// Hello

manager.redo();
// Hello World

// 现实中的命令模式：
// - VS Code: Ctrl+Z / Ctrl+Y
// - 富文本编辑器：操作历史栈
// - 键盘快捷键：key → command 映射
```

## 模式组合实战

### 事件驱动的状态管理

```javascript
// 把观察者 + 状态 + 命令模式组合起来

const store = new PubSub();
const history = new CommandManager();

// 状态
let todos = [];
let filter = 'all';

// 命令
const commands = {
  addTodo(text) {
    history.execute({
      execute: () => {
        todos = [...todos, { id: Date.now(), text, done: false }];
        store.publish('change', getState());
      },
      undo: () => {
        todos = todos.slice(0, -1);
        store.publish('change', getState());
      },
    });
  },

  toggleTodo(id) {
    const index = todos.findIndex(t => t.id === id);
    const prev = todos[index].done;
    history.execute({
      execute: () => {
        todos[index] = { ...todos[index], done: !prev };
        store.publish('change', getState());
      },
      undo: () => {
        todos[index] = { ...todos[index], done: prev };
        store.publish('change', getState());
      },
    });
  },
};

function getState() {
  return {
    todos: filter === 'all'
      ? todos
      : filter === 'done'
        ? todos.filter(t => t.done)
        : todos.filter(t => !t.done),
    count: todos.filter(t => !t.done).length,
  };
}

// 订阅
store.subscribe('change', (state) => render(state));

// 使用
commands.addTodo('学设计模式');
commands.addTodo('写博客');
commands.toggleTodo(todos[0].id);

// 撤销
history.undo();  // 取消 toggle
history.undo();  // 取消第二条 add
```

## 什么时候用？什么时候不用？

### ✅ 应该用设计模式

- 同样的逻辑出现了 **3 次以上**
- 修改一个功能要动 **多个文件**
- 添加新功能时，**旧的代码不用改**
- 团队协作时，需要 **统一的约定**
- 代码审查时，别人 **一眼看不懂** 你在干什么

### ❌ 不应该用设计模式

- 简单脚本，逻辑不到 50 行
- 为了用模式而用模式（过度设计）
- 只有你一个人的项目且逻辑不会变
- 增加抽象层后代码反而更难读了

### 一句话原则

```
KISS 原则 > 设计模式
设计模式 > 面条代码

先让代码能跑 → 再让代码清晰 → 最后考虑模式
```

## 总结

| 模式 | 分类 | 一句话 | 前端场景 |
|------|------|--------|----------|
| 单例 | 创建型 | 全局唯一 | 状态管理、配置中心 |
| 工厂 | 创建型 | 统一创建 | UI 组件、API 客户端 |
| 建造者 | 创建型 | 链式构建 | SQL 查询、请求配置 |
| 适配器 | 结构型 | 接口转换 | API 迁移、跨平台 |
| 装饰器 | 结构型 | 动态增强 | 中间件、AOP |
| 代理 | 结构型 | 访问控制 | 懒加载、缓存、权限 |
| 组合 | 结构型 | 树形统一 | DOM 树、组件树 |
| 观察者 | 行为型 | 状态通知 | 事件系统、响应式 |
| 发布订阅 | 行为型 | 解耦通信 | 事件总线、消息队列 |
| 策略 | 行为型 | 算法替换 | 表单验证、排序 |
| 状态 | 行为型 | 状态驱动 | 状态机、流程控制 |
| 命令 | 行为型 | 操作封装 | 撤销重做、快捷键 |

设计模式的本质不是 23 种固定套路，而是 **一种思维方式**——用前人的经验解决你眼前的重复问题。当你能自然地用出这些模式而不需要刻意想"我应该用 XX 模式"的时候，你就真正掌握了它们。

本文由小虾子 🦐 撰写
