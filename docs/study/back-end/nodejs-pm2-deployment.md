# Node.js项目PM2部署详解

PM2 是一个先进的 Node.js 进程管理器，它内置负载均衡器，可以帮助我们在生产环境中管理和保持应用程序的运行。本文将详细介绍 PM2 的安装、配置以及如何使用 PM2 来部署 Node.js 应用程序。

## 1. PM2简介

PM2 是一个带有内置负载均衡器的 Node.js 应用进程管理器。它允许你永远保持应用程序的活跃状态，无需停机即可重新加载它们，并简化常见的系统管理任务。

### 1.1 PM2的主要特性

- 内建负载均衡器（通过 Node cluster 集群）
- 后台运行 Node.js 应用程序
- 0 秒停机重载应用
- 方便的进程监控
- 支持系统日志
- 可以配合 Docker 使用
- 支持多种环境配置

## 2. PM2安装

### 2.1 前提条件

确保你的服务器上已经安装了 Node.js 和 npm：

```bash
# 检查 Node.js 版本
node -v

# 检查 npm 版本
npm -v
```

### 2.2 全局安装PM2

```bash
# 使用 npm 全局安装 PM2
npm install -g pm2

# 或者使用 yarn 安装
yarn global add pm2
```

### 2.3 验证安装

```bash
# 检查 PM2 版本
pm2 -v

# 显示 PM2 帮助信息
pm2 --help
```

## 3. PM2基本使用

### 3.1 启动应用

```bash
# 启动应用并命名为 my-app
pm2 start app.js --name my-app

# 启动应用并指定多个实例（集群模式）
pm2 start app.js -i max --name my-app-cluster

# 启动应用并监听文件变化自动重启
pm2 start app.js --watch --name my-app-watch

# 启动应用并指定端口
pm2 start app.js --name my-app -- --port 3000
```

### 3.2 管理应用

```bash
# 列出所有运行的应用
pm2 list

# 停止指定应用
pm2 stop my-app

# 重启指定应用
pm2 restart my-app

# 删除指定应用
pm2 delete my-app

# 停止所有应用
pm2 stop all

# 重启所有应用
pm2 restart all

# 删除所有应用
pm2 delete all
```

### 3.3 监控应用

```bash
# 实时监控应用状态
pm2 monit

# 显示应用详细信息
pm2 show my-app

# 查看应用日志
pm2 logs my-app

# 查看所有应用日志
pm2 logs
```

## 4. PM2配置文件

PM2 支持通过配置文件来管理应用，这样可以更好地组织复杂的部署设置。

### 4.1 创建ecosystem.config.js文件

```javascript
module.exports = {
  apps : [{
    name: 'my-node-app',
    script: './app.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }],
  
  deploy : {
    production : {
      user : 'SSH_USERNAME',
      host : ['SERVER_IP'],
      ref  : 'origin/master',
      repo : 'GIT_REPOSITORY',
      path : 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
```

### 4.2 使用配置文件启动应用

```bash
# 启动配置文件中的所有应用
pm2 start ecosystem.config.js

# 启动生产环境配置
pm2 start ecosystem.config.js --env production

# 重启应用
pm2 reload ecosystem.config.js

# 停止应用
pm2 stop ecosystem.config.js

# 删除应用
pm2 delete ecosystem.config.js
```

## 5. PM2高级功能

### 5.1 日志管理

```bash
# 查看实时日志
pm2 logs

# 查看特定应用的日志
pm2 logs my-app

# 清空日志
pm2 flush

# 重载日志
pm2 reloadLogs

# 配置日志文件路径
pm2 start app.js --log /var/log/pm2/app.log
```

### 5.2 内存监控和重启

```bash
# 当内存超过100MB时重启应用
pm2 start app.js --max-memory-restart 100M

# 在配置文件中设置内存限制
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    max_memory_restart: '100M'
  }]
};
```

### 5.3 自动重启策略

```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '5s',
    restart_delay: 3000
  }]
};
```

## 6. PM2与系统集成

### 6.1 设置开机自启

```bash
# 保存当前应用列表
pm2 save

# 设置PM2开机自启
pm2 startup

# 取消开机自启
pm2 unstartup
```

### 6.2 导出和导入应用列表

```bash
# 导出当前应用列表
pm2 save

# 导入应用列表
pm2 resurrect
```

## 7. 生产环境部署最佳实践

### 7.1 环境变量管理

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    env: {
      NODE_ENV: 'development',
      DB_HOST: 'localhost',
      DB_PORT: 27017
    },
    env_production: {
      NODE_ENV: 'production',
      DB_HOST: 'prod-db-server',
      DB_PORT: 27017
    }
  }]
};
```

### 7.2 使用PM2进行负载均衡

```javascript
// 集群模式启动
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 'max',  // 根据CPU核心数启动实例
    exec_mode: 'cluster',
    max_memory_restart: '1G'
  }]
};
```

### 7.3 健康检查

```javascript
// 在应用中添加健康检查端点
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// PM2配置中启用就绪检查
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    wait_ready: true,
    listen_timeout: 5000,
    kill_timeout: 3000
  }]
};
```

## 8. 故障排除

### 8.1 常见问题

1. **应用启动失败**
   ```bash
   # 查看详细错误信息
   pm2 logs my-app --lines 100
   ```

2. **内存泄漏**
   ```bash
   # 设置内存限制自动重启
   pm2 start app.js --max-memory-restart 500M
   ```

3. **端口占用**
   ```bash
   # 查看端口使用情况
   lsof -i :3000
   
   # 杀掉占用端口的进程
   kill -9 PID
   ```

### 8.2 性能优化

```javascript
// 生产环境优化配置
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## 9. 安全考虑

### 9.1 用户权限

```bash
# 不要以root用户运行PM2
# 创建专门的应用用户
sudo adduser appuser
sudo su - appuser
pm2 start app.js
```

### 9.2 网络安全

```javascript
// 限制Node.js应用仅监听本地接口
app.listen(PORT, '127.0.0.1', () => {
  console.log(`App listening on port ${PORT}`);
});
```

## 10. 监控和维护

### 10.1 使用PM2 Web界面

```bash
# 启动PM2 Web监控界面
pm2 web

# 默认访问地址：http://localhost:9615
```

### 10.2 定期维护

```bash
# 更新PM2到最新版本
npm install -g pm2

# 更新PM2运行时
pm2 update
```

## 总结

PM2 是部署 Node.js 应用的强大工具，它不仅提供了进程管理功能，还具备负载均衡、日志管理、监控等多种特性。通过合理配置 PM2，我们可以确保 Node.js 应用在生产环境中的稳定运行。

在实际部署过程中，建议结合具体的业务需求和服务器环境，制定合适的 PM2 配置方案，并定期监控应用的运行状态，及时发现和解决问题。