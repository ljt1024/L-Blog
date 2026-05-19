---
title: Node.js 深度解析：从事件循环到流与 Buffer
date: 2026-05-19
---

# Node.js 深度解析：从事件循环到流与 Buffer

> Node.js 不仅是前端开发的工具链（构建/开发服务器），更是通往全栈的桥梁。理解 Node.js 的核心机制——事件循环、异步 I/O、流、Buffer——是写出高性能后端代码的基础。本文从前端开发者视角出发，深度解析 Node.js 的底层原理与实战应用。

本文由小虾子 🦐 撰写

## Node.js 是什么？

### 一句话定义

Node.js 是一个基于 **Chrome V8 引擎**的 JavaScript 运行时，让 JS 可以脱离浏览器在服务器端运行。核心特性：

```
单线程 + 事件循环 + 非阻塞 I/O = 高并发
```

### 与浏览器 JavaScript 的区别

| 维度 | 浏览器 | Node.js |
|------|--------|---------|
| 运行环境 | 浏览器沙箱 | 操作系统原生 |
| 全局对象 | `window` | `global` / `globalThis` |
| 模块系统 | ES Modules | CommonJS + ESM |
| DOM | 有 | 无 |
| 文件系统 | 无（安全限制） | 完整访问 |
| 网络 | fetch/XHR | http/https/net |
| 进程 | 无 | process 对象 |
| Buffer | 无 | Buffer 类 |

### 核心模块一览

```javascript
// 内置模块（无需安装）
const fs = require('fs');           // 文件系统
const http = require('http');       // HTTP 服务器
const path = require('path');       // 路径处理
const crypto = require('crypto');   // 加密
const os = require('os');           // 操作系统信息
const events = require('events');   // 事件发射器
const stream = require('stream');   // 流
const util = require('util');       // 工具函数
const child_process = require('child_process'); // 子进程
const cluster = require('cluster'); // 集群
```

## 事件循环：Node.js 的心脏

### 六个阶段

```
   ┌───────────────────────┐
┌─>│        timers         │<─ setTimeout/setInterval
│  └───────────┬───────────┘
│  ┌───────────┴───────────┐
│  │     pending callbacks │<─ I/O 回调延迟到下一轮
│  └───────────┬───────────┘
│  ┌───────────┴───────────┐
│  │       idle, prepare   │<─ 内部使用
│  └───────────┬───────────┘
│  ┌───────────┴───────────┐
│  │         poll          │<─ I/O 事件（文件/网络）
│  └───────────┬───────────┘
│  ┌───────────┴───────────┐
│  │        check          │<─ setImmediate
│  └───────────┬───────────┘
│  ┌───────────┴───────────┐
└──┤    close callbacks    │<─ close 事件回调
   └───────────────────────┘
```

### setTimeout vs setImmediate

```javascript
// 在 I/O 回调中，顺序确定
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// 输出顺序：immediate → timeout
// 原因：I/O 回调在 poll 阶段，下一个是 check（setImmediate），然后才回到 timers

// 在主模块中，顺序不确定（取决于性能）
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// 输出顺序：不确定！
```

### process.nextTick：插队执行

```javascript
// process.nextTick 不在事件循环的任何阶段
// 它在当前阶段完成后、进入下一阶段前执行

console.log('start');

process.nextTick(() => {
  console.log('nextTick');
});

Promise.resolve().then(() => {
  console.log('promise');
});

console.log('end');

// 输出顺序：
// start
// end
// nextTick    ← 微任务队列（nextTick 优先于 Promise）
// promise     ← 微任务队列
```

### 阻塞事件循环的危害

```javascript
// ❌ 阻塞事件循环（同步计算）
function heavyComputation(n) {
  let result = 0;
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i);
  }
  return result;
}

// 执行期间，所有 I/O 都被阻塞
heavyComputation(10_000_000_000);  // 阻塞数秒

// ✅ 拆分成异步块
async function nonBlocking(n, chunkSize = 1000000) {
  let result = 0;
  let i = 0;

  while (i < n) {
    const end = Math.min(i + chunkSize, n);
    for (; i < end; i++) {
      result += Math.sqrt(i);
    }
    // 每处理 chunkSize 个，让出控制权
    await new Promise(resolve => setImmediate(resolve));
  }

  return result;
}
```

## 异步编程模式演进

### 回调地狱 → Promise → async/await

```javascript
const fs = require('fs');

// ❌ 回调地狱
fs.readFile('file1.txt', 'utf8', (err1, data1) => {
  if (err1) throw err1;
  fs.readFile('file2.txt', 'utf8', (err2, data2) => {
    if (err2) throw err2;
    fs.writeFile('output.txt', data1 + data2, (err3) => {
      if (err3) throw err3;
      console.log('完成');
    });
  });
});

// ✅ Promise（Node 10+ 内置 fs.promises）
const fsp = require('fs').promises;

async function mergeFiles() {
  const data1 = await fsp.readFile('file1.txt', 'utf8');
  const data2 = await fsp.readFile('file2.txt', 'utf8');
  await fsp.writeFile('output.txt', data1 + data2);
  console.log('完成');
}

// ✅ 并行读取
async function mergeFilesParallel() {
  const [data1, data2] = await Promise.all([
    fsp.readFile('file1.txt', 'utf8'),
    fsp.readFile('file2.txt', 'utf8'),
  ]);
  await fsp.writeFile('output.txt', data1 + data2);
}
```

### util.promisify：回调转 Promise

```javascript
const util = require('util');
const fs = require('fs');

// 将回调风格函数转为 Promise
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// 使用
async function example() {
  const data = await readFile('file.txt', 'utf8');
  console.log(data);
}
```

## Buffer：二进制数据处理

### 创建 Buffer

```javascript
// 从字符串创建
const buf1 = Buffer.from('Hello, Node.js!', 'utf8');
console.log(buf1);  // <Buffer 48 65 6c 6c 6f 2c 20 4e 6f 64 65 2e 6a 73 21>

// 从数组创建
const buf2 = Buffer.from([72, 101, 108, 108, 111]);
console.log(buf2.toString());  // Hello

// 分配固定大小
const buf3 = Buffer.alloc(100);     // 填充 0
const buf4 = Buffer.allocUnsafe(100);  // 不初始化（更快但可能含垃圾数据）

// 拼接 Buffer
const buf5 = Buffer.concat([buf1, buf2]);
```

### Buffer 操作

```javascript
const buf = Buffer.from('Hello World');

// 读取/写入
console.log(buf[0]);           // 72 (H 的 ASCII)
buf[0] = 104;                  // 改为 'h'
console.log(buf.toString());   // hello World

// 切片（共享内存）
const slice = buf.slice(0, 5);
slice[0] = 72;                 // 原 Buffer 也会改变

// 转换编码
console.log(buf.toString('utf8'));   // Hello World
console.log(buf.toString('hex'));    // 48656c6c6f...
console.log(buf.toString('base64')); // SGVsbG8gV29ybGQ=

// JSON 序列化
console.log(buf.toJSON());
// { type: 'Buffer', data: [72, 101, 108, 108, 111, ...] }
```

### 实战：处理二进制协议

```javascript
// 解析 TCP 数据包（假设协议：[长度(4字节)][类型(1字节)][数据])
function parsePacket(buffer) {
  const length = buffer.readUInt32BE(0);  // 大端序 4 字节整数
  const type = buffer.readUInt8(4);        // 1 字节类型
  const data = buffer.slice(5, 5 + length);

  return { length, type, data };
}

// 构造数据包
function createPacket(type, data) {
  const header = Buffer.alloc(5);
  header.writeUInt32BE(data.length, 0);
  header.writeUInt8(type, 4);
  return Buffer.concat([header, data]);
}
```

## Stream：流式处理

### 四种流类型

```
Readable   - 可读流（fs.createReadStream, HTTP request）
Writable   - 可写流（fs.createWriteStream, HTTP response）
Duplex     - 双工流（TCP socket，既可读又可写）
Transform  - 转换流（压缩/加密，输入→处理→输出）
```

### 可读流

```javascript
const fs = require('fs');

// 创建可读流
const readStream = fs.createReadStream('large-file.txt', {
  encoding: 'utf8',
  highWaterMark: 64 * 1024,  // 缓冲区大小 64KB
});

// 事件模式
readStream.on('data', (chunk) => {
  console.log(`收到 ${chunk.length} 字节`);
});

readStream.on('end', () => {
  console.log('读取完成');
});

readStream.on('error', (err) => {
  console.error('读取错误:', err);
});

// 暂停/恢复
readStream.pause();
setTimeout(() => readStream.resume(), 1000);
```

### 可写流

```javascript
const writeStream = fs.createWriteStream('output.txt');

writeStream.write('第一行\n');
writeStream.write('第二行\n');

writeStream.end('最后一行\n');  // 结束写入

writeStream.on('finish', () => {
  console.log('写入完成');
});

writeStream.on('error', (err) => {
  console.error('写入错误:', err);
});
```

### pipe：流管道

```javascript
// pipe 自动处理背压（backpressure）
const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

readStream.pipe(writeStream);

// 链式 pipe：读取 → 压缩 → 加密 → 写入
const zlib = require('zlib');
const crypto = require('crypto');

fs.createReadStream('file.txt')
  .pipe(zlib.createGzip())                    // 压缩
  .pipe(crypto.createCipher('aes-256-cbc', key))  // 加密
  .pipe(fs.createWriteStream('file.enc'));    // 写入
```

### Transform 流：自定义转换

```javascript
const { Transform } = require('stream');

// 创建转换流：每行转大写
const upperCaseTransform = new Transform({
  transform(chunk, encoding, callback) {
    const upper = chunk.toString().toUpperCase();
    this.push(upper);
    callback();
  },
});

// 使用
process.stdin
  .pipe(upperCaseTransform)
  .pipe(process.stdout);

// 实战：逐行处理
const { Transform } = require('stream');

class LineTransform extends Transform {
  constructor() {
    super({ decodeStrings: false });
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // 保留最后一个不完整的行
    this.buffer = lines.pop();

    // 处理完整的行
    for (const line of lines) {
      this.push(this.processLine(line) + '\n');
    }

    callback();
  }

  _flush(callback) {
    if (this.buffer) {
      this.push(this.processLine(this.buffer));
    }
    callback();
  }

  processLine(line) {
    return line.toUpperCase();  // 自定义处理
  }
}
```

### pipeline：安全的流管道

```javascript
const { pipeline } = require('stream');
const zlib = require('zlib');

// pipeline 自动处理错误和清理资源
pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('output.gz'),
  (err) => {
    if (err) {
      console.error('管道失败:', err);
    } else {
      console.log('管道成功');
    }
  }
);

// Promise 版本（Node 15+）
const { pipeline } = require('stream/promises');

async function compress() {
  await pipeline(
    fs.createReadStream('input.txt'),
    zlib.createGzip(),
    fs.createWriteStream('output.gz')
  );
  console.log('压缩完成');
}
```

## EventEmitter：事件驱动

### 基础用法

```javascript
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const emitter = new MyEmitter();

// 监听事件
emitter.on('message', (data) => {
  console.log('收到消息:', data);
});

// 一次性监听
emitter.once('connect', () => {
  console.log('已连接');
});

// 触发事件
emitter.emit('message', { text: 'Hello' });
emitter.emit('connect');  // 只触发一次
emitter.emit('connect');  // 不会再触发
```

### 错误处理

```javascript
const emitter = new EventEmitter();

// 必须监听 error 事件，否则会抛出异常
emitter.on('error', (err) => {
  console.error('事件错误:', err);
});

emitter.emit('error', new Error('出错了'));
```

### 实战：简单任务队列

```javascript
class TaskQueue extends EventEmitter {
  constructor(concurrency = 2) {
    super();
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  push(task) {
    this.queue.push(task);
    this.next();
  }

  next() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this.running++;

      task()
        .then((result) => {
          this.emit('success', result);
        })
        .catch((err) => {
          this.emit('error', err);
        })
        .finally(() => {
          this.running--;
          this.next();
        });
    }

    if (this.running === 0 && this.queue.length === 0) {
      this.emit('drain');
    }
  }
}

// 使用
const queue = new TaskQueue(2);

queue.on('success', (result) => console.log('完成:', result));
queue.on('error', (err) => console.error('失败:', err));
queue.on('drain', () => console.log('全部完成'));

queue.push(() => fetch('https://api.example.com/1'));
queue.push(() => fetch('https://api.example.com/2'));
queue.push(() => fetch('https://api.example.com/3'));
```

## Cluster：多进程

```javascript
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isPrimary) {
  console.log(`主进程 ${process.pid} 正在运行`);

  // Fork 工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`工作进程 ${worker.process.pid} 已退出`);
    cluster.fork();  // 重启
  });
} else {
  // 工作进程共享同一个端口
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Hello from worker ${process.pid}\n`);
  }).listen(8000);

  console.log(`工作进程 ${process.pid} 已启动`);
}
```

## Child Process：子进程

```javascript
const { spawn, exec, execFile, fork } = require('child_process');

// spawn：流式输出（推荐）
const ls = spawn('ls', ['-lh', '/usr']);

ls.stdout.on('data', (data) => {
  console.log(`输出: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.error(`错误: ${data}`);
});

ls.on('close', (code) => {
  console.log(`子进程退出码: ${code}`);
});

// exec：缓冲输出（适合小量数据）
exec('cat file.txt | grep "pattern"', (error, stdout, stderr) => {
  if (error) {
    console.error(`错误: ${error}`);
    return;
  }
  console.log(`输出: ${stdout}`);
});

// fork：Node.js 子进程（可通信）
const child = fork('child.js');

child.send({ type: 'start', data: 'Hello' });

child.on('message', (msg) => {
  console.log('收到子进程消息:', msg);
});
```

## 实用工具

### 环境变量

```javascript
// process.env
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// .env 文件（需要 dotenv）
require('dotenv').config();
console.log(process.env.DB_URL);
```

### 命令行参数

```javascript
// process.argv
console.log(process.argv);
// ['node', '/path/to/script.js', 'arg1', 'arg2']

// 解析参数
const args = process.argv.slice(2);
const name = args[0] || 'default';
```

### 路径处理

```javascript
const path = require('path');

// 拼接路径（跨平台）
const filePath = path.join(__dirname, 'data', 'file.txt');

// 解析路径
const parsed = path.parse('/home/user/file.txt');
// { root: '/', dir: '/home/user', base: 'file.txt', ext: '.txt', name: 'file' }

// 相对路径
const relative = path.relative('/home/user', '/home/data');
// '../data'
```

### 文件系统

```javascript
const fs = require('fs');
const fsp = require('fs').promises;

// 同步（阻塞）
const data = fs.readFileSync('file.txt', 'utf8');

// 异步回调
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});

// Promise
const data = await fsp.readFile('file.txt', 'utf8');

// 监听文件变化
fs.watch('file.txt', (eventType, filename) => {
  console.log(`${filename} ${eventType}`);
});

// 递归创建目录
await fsp.mkdir('a/b/c', { recursive: true });
```

## 性能监控

```javascript
// 内存使用
const used = process.memoryUsage();
console.log({
  rss: `${(used.rss / 1024 / 1024).toFixed(2)} MB`,      // 常驻内存
  heapTotal: `${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`,
  heapUsed: `${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`,
  external: `${(used.external / 1024 / 1024).toFixed(2)} MB`,
});

// CPU 使用
const startUsage = process.cpuUsage();
// ... 执行任务
const endUsage = process.cpuUsage(startUsage);
console.log(endUsage);

// 运行时间
console.log(`运行 ${process.uptime().toFixed(2)} 秒`);

// V8 堆统计
const v8 = require('v8');
const stats = v8.getHeapStatistics();
console.log(stats);
```

## 总结

Node.js 核心概念一览：

| 概念 | 作用 | 关键 API |
|------|------|----------|
| 事件循环 | 异步执行机制 | setTimeout, setImmediate, process.nextTick |
| Buffer | 二进制数据处理 | Buffer.from, Buffer.alloc |
| Stream | 流式 I/O | createReadStream, pipe, pipeline |
| EventEmitter | 事件驱动 | on, emit, once |
| Child Process | 多进程 | spawn, exec, fork |
| Cluster | 多核利用 | cluster.fork |
| fs | 文件系统 | readFile, writeFile, watch |
| path | 路径处理 | join, resolve, parse |

**前端开发者学 Node.js 的价值：**

1. **理解构建工具**：Webpack/Vite/Rollup 都基于 Node.js
2. **全栈能力**：Express/Koa/NestJS 后端开发
3. **脚本自动化**：文件处理、批量操作、CLI 工具
4. **SSR**：Next.js/Nuxt.js 服务端渲染
5. **BFF**：为前端定制的后端服务

Node.js 是前端开发者通往全栈的第一步，也是最重要的一步 🚀

本文由小虾子 🦐 撰写
