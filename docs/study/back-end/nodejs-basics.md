# Node.js基础

Node.js是一个基于Chrome V8引擎的JavaScript运行时环境，它使得JavaScript可以脱离浏览器在服务器端运行。本文将介绍Node.js的基本概念和使用方法。

## 什么是Node.js？

Node.js是建立在Chrome V8 JavaScript引擎上的服务器端平台，用于构建快速、可扩展的网络应用程序。它使用事件驱动、非阻塞I/O模型，使其轻量且高效。

## Node.js的特点

1. **单线程**：Node.js使用单线程事件循环模型处理请求
2. **非阻塞I/O**：避免等待I/O操作完成，提高性能
3. **跨平台**：可在Windows、Linux、Unix、Mac OS X等系统上运行
4. **NPM生态系统**：拥有庞大的开源库生态系统

## 安装Node.js

访问[Node.js官网](https://nodejs.org/)下载并安装适合你系统的版本。安装完成后，可以通过以下命令验证安装：

```bash
node -v  # 查看Node.js版本
npm -v   # 查看npm版本
```

## 第一个Node.js程序

创建一个简单的Node.js应用：

```javascript
// app.js
console.log("Hello, Node.js!");

// 创建一个简单的HTTP服务器
const http = require('http');

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
});

server.listen(3000, '127.0.0.1', () => {
    console.log('服务器运行在 http://127.0.0.1:3000/');
});
```

运行程序：
```bash
node app.js
```

## 核心模块

Node.js提供了许多内置核心模块：

### 文件系统(fs)
```javascript
const fs = require('fs');

// 读取文件
fs.readFile('example.txt', 'utf8', (err, data) => {
    if (err) throw err;
    console.log(data);
});

// 写入文件
fs.writeFile('output.txt', 'Hello Node.js', (err) => {
    if (err) throw err;
    console.log('文件已保存');
});
```

### 路径(path)
```javascript
const path = require('path');

console.log(path.join('/users', 'john', 'documents'));  // /users/john/documents
console.log(path.extname('index.html'));  // .html
```

### HTTP模块
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Home Page');
    } else if (req.url === '/about') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('About Page');
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

server.listen(3000);
```

## NPM包管理器

NPM(Node Package Manager)是Node.js的默认包管理器：

```bash
# 初始化项目
npm init

# 安装包
npm install lodash  # 安装到dependencies
npm install -D nodemon  # 安装到devDependencies

# 全局安装
npm install -g express-generator

# 查看已安装的包
npm list
```

## 总结

Node.js为JavaScript开发者提供了一个强大的服务器端开发平台。通过其非阻塞I/O模型和丰富的生态系统，我们可以构建高性能的网络应用程序。