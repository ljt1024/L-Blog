# Module Federation 2.0 深度解析：微前端的终极形态

> Module Federation（模块联邦）是 Webpack 5 引入的核心特性，让多个独立构建产物可以动态共享，彼此依赖而不需要打包进同一个 bundle。经过 2.0 版本的演进，它已经从"微前端方案"升级为"任意模块级联邦运行时"——不只是 React/Vue，任何 JavaScript 模块都可以联邦化。本文深入剖析其核心原理、2.0 新特性及实战架构。

## 一、为什么需要 Module Federation？

### 1.1 微前端的困境

传统微前端方案（iframes、single-spa、qiankun）存在三个根本性问题：

| 方案 | 问题 |
|------|------|
| iframe | DOM 隔离导致样式冲突、路由同步困难、性能差 |
| single-spa | 需要预加载所有子应用 bundle，初始加载大 |
| qiankun | JS 沙箱机制复杂，对象劫持开销大 |

Module Federation 的核心思路完全不同：**让每个应用独立构建，然后动态加载对方导出的模块，共享依赖而不重复打包。**

### 1.2 核心理念

```
┌─────────────────────────────────────────────────────────┐
│                     Host App (Shell)                    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Header  │  │  Cart    │  │   Remote Component   │  │
│  │  (Local) │  │  (Remote)│  │   (来自 Product App) │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                     ▲                                   │
│                     │ dynamic import                     │
└─────────────────────┼───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │    Product App (Remote)    │
        │   构建产物独立部署，版本独立 │
        └───────────────────────────┘
```

## 二、基础用法：Host 与 Remote

### 2.1 Remote 端：暴露模块

**product-app/webpack.config.js**

```js
const { ModuleFederationPlugin } = require('webpack').container;
const { dependencies } = require('./package.json');

module.exports = {
  mode: 'development',
  devServer: {
    port: 3001,
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'productApp',        // 全局唯一标识，其他 app 通过此名引用
      filename: 'remoteEntry.js', // 暴露的入口文件名（CDN 部署路径）
      exposes: {
        // 暴露组件：./ProductCard → "ProductCard"
        './ProductCard': './src/components/ProductCard.jsx',
        './ProductList': './src/components/ProductList.jsx',
      },
      shared: {
        // 共享依赖：双方都安装了 react/react-dom，只保留一份
        react: {
          singleton: true,         // 确保只加载一个版本
          requiredVersion: dependencies.react,
          eager: false,           // 懒加载共享模块
        },
        'react-dom': {
          singleton: true,
          requiredVersion: dependencies['react-dom'],
        },
      },
    }),
  ],
};
```

### 2.2 Host 端：消费远程模块

**shell-app/webpack.config.js**

```js
const { ModuleFederationPlugin } = require('webpack').container;
const { dependencies } = require('./package.json');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  devServer: {
    port: 3000,
    // 开发时代理请求到远程应用的开发服务器
    proxy: {
      '/product-app': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shellApp',
      remotes: {
        // 格式：${name}@${url}${filename}
        productApp: 'productApp@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: dependencies.react },
        'react-dom': { singleton: true, requiredVersion: dependencies['react-dom'] },
      },
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
};
```

### 2.3 动态加载远程组件

```jsx
// src/App.jsx - Host 应用
import React, { Suspense, lazy } from 'react';

// 语法：webpackcontainer.ModuleFederationPlugin 的异步加载
// 或直接用 magic comment
const ProductCard = React.lazy(() => import('productApp/ProductCard'));
const ProductList = React.lazy(() => import('productApp/ProductList'));

function App() {
  return (
    <div className="shell">
      <header>我的商城 Shell</header>

      <Suspense fallback={<div>Loading remote products...</div>}>
        <section>
          <h2>热销商品</h2>
          <ProductList />
        </section>
      </Suspense>
    </div>
  );
}

export default App;
```

## 三、进阶：2.0 新特性

### 3.1 Federation Runtime（联邦运行时）

Module Federation 2.0 允许完全脱离 Webpack 使用联邦模块：

```html
<!-- 任何页面都可以加载联邦模块，不依赖 Webpack -->
<script type="module" src="https://cdn.example.com/product-app/remoteEntry.js"></script>
<script type="module">
  // 使用联邦运行时加载模块
  const container = await loadRemoteContainer('productApp@https://cdn.example.com/remoteEntry.js');
  const { ProductCard } = await container.get('./ProductCard');
  const card = new ProductCard({ name: '无线鼠标', price: 99 });
  card.mount(document.getElementById('root'));
</script>
```

### 3.2 动态 Remotes（运行时配置远程地址）

```js
// webpack.config.js
new ModuleFederationPlugin({
  name: 'shellApp',
  // 1.0 只能在构建时指定远程地址
  // 2.0 支持运行时从容器中读取
  dynamicRemotes: true,  // 允许动态设置 remote URL
  remotes: {
    // 占位符，运行时会替换为实际 URL
    productApp: 'productApp@[[remote]]/remoteEntry.js',
  },
});
```

```jsx
// 运行时动态注入远程地址（从配置中心/CDN 获取）
import { __federation__) } from 'webpack/container/reference/productApp';

__federation__.setRemoteUrl('productApp', 'https://cdn.example.com/v2/product-app/remoteEntry.js');
```

### 3.3 Shared Scope（跨应用状态共享）

2.0 增强了共享作用域，可以跨应用共享状态：

```js
// Host 端定义共享的 scope
new ModuleFederationPlugin({
  name: 'shellApp',
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
  // 定义可被其他应用消费的 shared scope
  sharedScope: {
    // 可以在运行时注册共享的模块
  },
});
```

### 3.4 异步共享（Async Shared）

```js
new ModuleFederationPlugin({
  shared: {
    lodash: {
      // 默认是同步共享
      // 设置 eager: true 后会同步加载，不等待异步 chunk
      eager: false,
      // 2.0 支持异步共享依赖
      // 用于按需加载的大型库（如图表库）
    },
    'antd': {
      singleton: true,
      // 条件共享：仅当版本兼容时才共享
      // 否则降级为各自打包
    },
  },
});
```

## 四、实战架构

### 4.1 微前端架构分层

```
                    ┌─────────────────────┐
                    │     CDN / Nginx     │
                    │  (路由分发 / 静态资源) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Shell App   │    │  Product App │    │   User App   │
   │   (Host)     │    │  (Remote)     │    │  (Remote)     │
   │  Port: 3000  │    │  Port: 3001   │    │  Port: 3002   │
   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
          │                   │                    │
          │  Module Federation Runtime             │
          │  ┌──────────────────────────────────┐  │
          │  │  共享依赖池: React/状态/主题/路由 │  │
          │  └──────────────────────────────────┘  │
          └─────────────────────────────────────────┘
```

### 4.2 多框架共存（联邦 React + Vue 应用）

```js
// React App 暴露组件
new ModuleFederationPlugin({
  name: 'reactRemote',
  exposes: {
    './Dashboard': './src/Dashboard.jsx',
  },
  shared: ['react', 'react-dom'],
});

// Vue App 暴露组件
new ModuleFederationPlugin({
  name: 'vueRemote',
  exposes: {
    './Chart': './src/Chart.vue',
  },
  shared: ['vue'],
});
```

### 4.3 插件化架构：按需加载整个应用

```jsx
// Shell 中按路由加载子应用
const routes = [
  { path: '/products', remote: 'productApp', module: './App' },
  { path: '/user',     remote: 'userApp',    module: './App' },
  { path: '/order',    remote: 'orderApp',   module: './App' },
];

function RemoteApp({ match }) {
  const { remote, module: moduleName } = match;
  const RemoteApp = React.lazy(() => import(`${remote}/${moduleName}`));
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <RemoteApp />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 五、依赖共享策略

### 5.1 版本协商算法

当 Host 和 Remote 依赖同一库的不同版本时，Module Federation 按以下规则决策：

```js
// shared 策略配置
shared: {
  react: {
    // 默认策略：singleton + 最高版本优先
    // Host 版本 18.2.0 > Remote 版本 18.1.0 → 使用 18.2.0
    
    // strictVersion: true → 版本不兼容时报错
    // requiredVersion: '^18.0.0' → Host 版本必须满足要求
    // eager: true → 即使没被引用也加载（防止样式闪烁）
  },
}
```

### 5.2 最佳实践：依赖锁定表

在大型团队中，建议维护 `federation.config.js`：

```js
// federation.config.js
module.exports = {
  shared: {
    react:    { version: '18.2.0', singleton: true },
    'react-dom': { version: '18.2.0', singleton: true },
    vue:      { version: '3.4.0',  singleton: true },
    lodash:   { version: '4.17.21' }, // 非单例允许多版本共存
  },
  // 版本白名单，超出范围的依赖不共享
  allowedVersions: {
    react: '>=18.0.0',
  },
};
```

## 六、性能优化

### 6.1 预加载远程模块

```js
// 在 Shell 初始化时静默预加载
function prefetchRemote(remote, chunkName) {
  if (!window.__federation__) return;
  // 浏览器空闲时预取
  requestIdleCallback(() => {
    import(`${remote}/${chunkName}`);
  });
}

// Shell 启动时预取
prefetchRemote('productApp', 'ProductList');
```

### 6.2 Chunk 大小控制

```js
// webpack.config.js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      // 将共享依赖单独打包
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        // 确保联邦入口不重复打包共享库
        priority: -10,
      },
    },
  },
},
```

### 6.3 生产环境 CDN 配置

```js
// webpack.config.js - 生产环境使用 CDN
const prodRemotes = {
  productApp: `productApp@https://cdn.example.com/product-app/${VERSION}/remoteEntry.js`,
  userApp: `userApp@https://cdn.example.com/user-app/${VERSION}/remoteEntry.js`,
};

const devRemotes = {
  productApp: 'productApp@http://localhost:3001/remoteEntry.js',
  userApp: 'userApp@http://localhost:3002/remoteEntry.js',
};

new ModuleFederationPlugin({
  name: 'shellApp',
  remotes: process.env.NODE_ENV === 'production' ? prodRemotes : devRemotes,
});
```

## 七、调试与常见问题

### 7.1 查看联邦模块加载状态

```js
// 浏览器控制台
window.__federation__?.plugin || 
// 或直接查看 Webpack container
window.productApp?.get('./ProductCard')
```

### 7.2 常见问题与解决

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `Failed to fetch dynamically imported module` | 跨域 CORS | CDN 配置 `Access-Control-Allow-Origin` |
| 共享依赖加载顺序错乱 | eager: false 且懒加载顺序不当 | 设置 `eager: true` 或确保加载顺序 |
| 热更新失效 | Remote 模块修改后 Host 未刷新 | Remote 重新 build 后手动刷新 Host |
| 样式冲突 | 多应用样式叠加 | CSS Modules / Shadow DOM / CSS Variables |
| TypeScript 类型丢失 | 暴露模块无类型声明 | 使用 `@module-federation/typescript` |

### 7.3 类型安全

```json
// package.json - Remote 端暴露类型
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

```json
// Host 端消费类型
{
  "compilerOptions": {
    "paths": {
      "productApp/*": ["node_modules/product-app/dist/*"]
    }
  }
}
```

## 八、Module Federation 与竞品对比

| 特性 | MF | Webpack Module Federation | Rollup Plugin | nx |
|------|----|---------------------------|--------------|-----|
| 微前端 | ✅ | ✅ | ❌ | ❌ |
| 跨构建工具 | ❌ | ⚠️ 需额外配置 | ❌ | ⚠️ |
| 独立部署 | ✅ | ✅ | ✅ | ❌ |
| 共享依赖去重 | ✅ | ✅ | ❌ | ❌ |
| 运行时联邦 | ⚠️ | ✅ 2.0 | ✅ | ❌ |

## 总结

Module Federation 2.0 彻底改变了前端应用的交付模式：从"所有代码打包进一个 bundle"进化到"各应用独立交付，按需联邦"。它的核心价值在于：

1. **真正的独立部署**：每个应用可以有自己的 CI/CD、版本策略、灰度发布
2. **零重复依赖**：共享依赖只加载一次，大幅减少总体积
3. **渐进式采用**：可以在不修改现有架构的情况下，逐步引入联邦模块
4. **2.0 Runtime**：打破了 Webpack 绑定，任何应用都可以成为联邦参与者

在微前端领域，Module Federation 2.0 已经是事实标准。掌握它，就掌握了现代前端架构的核心竞争力。

---

*本文由小虾子 🦐 撰写*
