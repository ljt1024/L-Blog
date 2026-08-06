# Rspack 深度解析：Webpack 的 Rust 接班人，构建工具的性能革命

> Rspack 是字节跳动开源的高性能构建工具，基于 Rust 语言开发，兼容 Webpack 的生态与配置，同时提供 SWC 的极速编译能力。在 benchmark 中，Rspack 比 Webpack 快 5-10 倍，比 Vite 快 2-5 倍。本文从原理、配置、性能优化到迁移策略，系统解析这个新生代构建工具。

## 一、为什么需要 Rspack？

### 1.1 Webpack 的困境

Webpack 5 虽解决了长期缓存和模块联邦等核心问题，但 JavaScript 实现的构建链路在大型项目中已触及性能天花板：

```js
// 一个中等规模的 React 项目，完整构建耗时
// Webpack:  90-180 秒
// Vite:     15-40 秒（dev）/ 60-120 秒（build）
// Rspack:   8-20 秒（dev + build）
```

### 1.2 Rspack 的设计哲学

```
┌─────────────────────────────────────────────────────┐
│                    Rspack                            │
│                                                     │
│  ┌─────────────┐   ┌─────────────┐                 │
│  │  SWC 编译器  │   │  Webpack    │                 │
│  │  (Rust)     │ + │  兼容层     │ = 高性能 + 生态兼容 │
│  └─────────────┘   └─────────────┘                 │
│        │                 │                         │
│   极速 TS/JS 编译    插件/Loader   零学习成本迁移    │
└─────────────────────────────────────────────────────┘
```

## 二、安装与基础配置

### 2.1 安装

```bash
npm install @rspack/core @rspack/cli --save-dev
```

### 2.2 基本项目配置

**rspack.config.js**

```js
const rspack = require('@rspack/core');
const path = require('path');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  module: {
    rules: [
      // 使用 rspack 内置 SWC  loader，比 babel-loader 快 20 倍
      {
        test: /\.tsx?$/,
        use: {
          loader: 'rspack-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                // React Refresh 支持热更新
                react: {
                  runtime: 'automatic',
                  development: process.env.NODE_ENV !== 'production',
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        type: 'css',
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
      favicon: './public/favicon.ico',
    }),
    new rspack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    // Rspack 内置 HMR，比 webpack-dev-server 更快
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
```

### 2.3 package.json scripts

```json
{
  "scripts": {
    "dev": "rspack serve",
    "build": "rspack build",
    "preview": "rspack serve --mode production"
  }
}
```

## 三、核心配置深度解析

### 3.1 SWC 编译器配置

Rspack 内置 SWC，提供比 Babel 快数十倍的转译能力：

```js
// rspack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'rspack-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true,  // 支持 TypeScript 装饰器
                dynamicImport: true,
              },
              transform: {
                react: {
                  // JSX runtime：automatic (React 17+) vs classic
                  runtime: 'automatic',
                  // 启用 SWC 的 React JSX transform
                  // 比 babel-plugin-transform-react-jsx 快 20x
                  development: false,
                  // 自动注入 React Refresh HMR
                  refresh: process.env.NODE_ENV === 'development',
                },
              },
              externalHelpers: false,
              // SWC minifier 配置（比 Terser 快 20 倍）
              minify: 'swc',
            },
            // SWC 实验性配置
            env: {
              targets: 'defaults',
              mode: 'usage',  // 按需转换 polyfill，不全量注入
            },
          },
        },
      },
    ],
  },
};
```

### 3.2 代码分割与分包策略

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        // 第三方库单独打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: -10,
        },
        // React 生态单独打包（利于缓存）
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
          priority: 10,
        },
        // 大型 UI 库单独打包
        uiLib: {
          test: /[\\/]node_modules[\\/](antd|element-ui|material-ui)[\\/]/,
          name: 'ui-vendor',
          chunks: 'all',
          priority: 20,
        },
      },
    },
    // 运行时 chunk 单独提取
    runtimeChunk: 'single',
  },
};
```

### 3.3 输出配置与长期缓存

```js
module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: {
      // 根据内容 hash 命名，利于长期缓存
      default: '[name].[contenthash].js',
      // JS 模块用 .mjs 扩展名（更利于 ESM tree-shaking）
      module: '[name].[contenthash].mjs',
    },
    chunkFilename: '[name].[contenthash].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash][ext]',
    // Web Worker 和 ESM chunk 输出到独立目录
    webassemblyModuleFilename: 'wasm/[hash].wasm',
    // 使用 SWC 生成更短的有效域 ID
    hashFunction: 'xxhash64',
  },
};
```

## 四、Webpack 兼容性

### 4.1 插件兼容层

Rspack 提供对主流 Webpack 插件的兼容支持：

```js
const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = require('@originjs/vite-plugin-federation');
// 或使用 Rspack 原生的联邦插件
const rspackMF = require('@module-federation/rspack');

module.exports = {
  plugins: [
    // Webpack 插件直接使用（Rspack 内置兼容）
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    new rspack.ProvidePlugin({
      _: 'lodash',
    }),

    // Rspack 原生 Module Federation
    new rspackMF.ModuleFederationPlugin({
      name: 'hostApp',
      remotes: {
        remoteApp: 'remoteApp@http://localhost:3001/remoteEntry.js',
      },
      shared: ['react', 'react-dom'],
    }),

    // 常用插件的 Rspack 替代
    new rspack.HtmlRspackPlugin({  // 替代 html-webpack-plugin
      template: './public/index.html',
      minify: {  // 内置 HTML 压缩，比 html-minifier-turbo 快
        removeComments: true,
        collapseWhitespace: true,
      },
    }),
  ],
};
```

### 4.2 Loader 兼容

```js
// Rspack 自动处理以下常用 loader
// 1. css-loader / style-loader → 内置 type: 'css' / type: 'css/module'
// 2. file-loader / url-loader → 内置 asset 模块
// 3. babel-loader / ts-loader → 内置 rspack-loader (SWC)
// 4. sass-loader / less-loader → 仍需单独安装
module: {
  rules: [
    // SCSS
    {
      test: /\.scss$/,
      use: [
        { loader: 'sass-loader' },  // 仍需 sass-loader
      ],
      type: 'css',
    },
    // 图片（原生 asset）
    {
      test: /\.(png|jpg|webp)$/,
      type: 'asset',
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024,  // 8KB 以下内联为 base64
        },
      },
    },
  ];
}
```

### 4.3 Rsdoctor：构建诊断工具

Rspack 官方提供了 Rsdoctor，可视化构建过程：

```js
// rspack.config.js
const { RsdoctorRspackPlugin } = require('@rsdoctor/rspack-plugin');

module.exports = {
  plugins: [
    new RsdoctorRspackPlugin({
      // 仅在 development 启用
      disableClientServer: process.env.NODE_ENV === 'production',
      // 分析类型：compilation | bundle | module | metafile
      linter: {
        rules: ['duplicate-package'],
      },
    }),
  ],
};
```

运行后访问 `http://localhost:3000/rsdoctor` 即可查看：
- 构建时间分布图
- 模块大小分析
- 重复依赖检测
- Tree-shaking 效果可视化

## 五、性能优化实战

### 5.1 持久化缓存

```js
module.exports = {
  cache: true,
  // 文件级持久缓存，跨构建复用
  cache: {
    type: 'filesystem',
    buildDependencies: {
      // 当这些文件变化时，清空缓存
      config: [__filename],
    },
    // 缓存压缩，减小 .rspack 目录大小
    compression: 'gzip',
    // 缓存目录
    cacheDirectory: '.rspack-cache',
  },
};
```

> 首次构建后，Rspack 的文件缓存可将后续构建时间从 10s 降至 **200-500ms**

### 5.2 并行编译

```js
module.exports = {
  // 开启 SWC 并行编译
  experiments: {
    rspackFuture: {
      bundlerInfo: {
        force: false,
      },
    },
  },
  // Rspack 默认使用所有 CPU 核心
  // 可通过 rspack build --jobs 4 限制
};
```

### 5.3 Tree-shaking 优化

```js
module.exports = {
  mode: 'production',
  optimization: {
    usedExports: true,
    // 标记 sideEffects（package.json 中的字段会被 SWC 识别）
    sideEffects: true,
    // 更精确的 tree-shaking（SWC 提供）
    concatenateModules: true,
  },
  // package.json 配置配合
  // "sideEffects": ["*.css", "*.scss"]
};
```

### 5.4 增量编译（Watch 模式）

```js
// 相比 Webpack，Rspack 的增量编译粒度更细
module.exports = {
  watchOptions: {
    ignored: /node_modules/,
    // 聚合变更，减少重建频率
    aggregateTimeout: 300,
  },
};
```

## 六、迁移指南：从 Webpack 到 Rspack

### 6.1 迁移检查清单

```bash
# 1. 先用 rspack-cli 尝试构建现有项目
npx rspack build --config webpack.config.js

# 2. Rspack 会自动尝试兼容，返回不兼容项列表
# 3. 逐项修复后，切换配置文件
mv webpack.config.js webpack.config.js.bak
mv rspack.config.js webpack.config.js
```

### 6.2 常见不兼容项及解决方案

| 不兼容项 | Webpack 写法 | Rspack 写法 |
|---------|------------|------------|
| `css-loader` | `use: ['style-loader', 'css-loader']` | `type: 'css'` |
| `file-loader` | `loader: 'file-loader'` | `type: 'asset/resource'` |
| `url-loader` | `loader: 'url-loader'` | `type: 'asset/inline'` |
| `HtmlWebpackPlugin` | `new HtmlWebpackPlugin()` | `new HtmlRspackPlugin()` |
| `mini-css-extract-plugin` | `new MiniCssExtractPlugin()` | Rspack 原生 CSS 提取 |
| `babel-loader` | `loader: 'babel-loader'` | SWC（rspack-loader 内置） |

### 6.3 Vite 迁移到 Rspack

Rspack 提供了 `@rspack/core` 兼容 Rolldown/Vite 生态：

```js
// vite.config.ts - 使用 @analogjs/vite-plugin-rspack
import { defineConfig } from 'vite';
import { rspack } from '@analogjs/vite-plugin-rspack';

export default defineConfig({
  plugins: [
    rspack({
      // Rspack 替代 Vite 默认的 Rollup
    }),
  ],
  build: {
    // 改用 Rspack 构建
    target: 'esnext',
  },
});
```

## 七、实战：企业级 React 项目配置

```js
// rspack.config.js - 完整企业配置
const rspack = require('@rspack/core');
const path = require('path');

module.exports = {
  context: __dirname,
  entry: {
    main: './src/index.tsx',
    // 多入口：管理后台
    admin: './src/admin.tsx',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'rspack-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: {
              react: { runtime: 'automatic', development: false, refresh: true },
            },
            externalHelpers: false,
          },
        },
        exclude: /node_modules/,
      },
      { test: /\.css$/, type: 'css' },
      { test: /\.module\.css$/, type: 'css/module' },
      { test: /\.(png|jpg|svg|webp)$/, type: 'asset/resource' },
      { test: /\.(woff|woff2|eot|ttf|otf)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      chunks: ['main'],
    }),
    new rspack.HtmlRspackPlugin({
      template: './public/admin.html',
      filename: 'admin.html',
      chunks: ['admin'],
    }),
    new rspack.DefinePlugin({
      'process.env.API_BASE': JSON.stringify(process.env.API_BASE || ''),
    }),
    new rspack.ProgressPlugin({ handler: (percentage, message) => {
      // 自定义构建进度输出
      process.stdout.write(`\r${Math.round(percentage * 100)}% ${message}`);
    }}),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        commons: {
          name: 'commons',
          minChunks: 2,
          chunks: 'initial',
        },
      },
    },
    runtimeChunk: 'single',
    minimize: true,
  },
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  cache: true,
};
```

## 八、Rspack vs 其他构建工具

| 特性 | Rspack | Webpack 5 | Vite 5 | Rolldown |
|------|--------|-----------|--------|---------|
| 语言 | Rust | JavaScript | JavaScript | Rust |
| HMR 速度 | ~50ms | ~500ms | ~30ms | ~50ms |
| 生产构建速度 | 快 | 慢 | 中等 | 最快 |
| Webpack 兼容 | 完整 | — | 插件兼容 | 部分 |
| 插件生态 | 快速建设中 | 丰富 | 丰富 | Rolldown 生态 |
| 长期维护 | 字节跳动 | Webpack 团队 | Vite 团队 | Vite/Rollup |
| 适用场景 | Webpack 迁移 | 通用 | 新项目 | 新项目 |

## 总结

Rspack 的出现代表了一个重要趋势：**用 Rust 重写前端工具链核心路径**。它不需要你从零学习，在 Webpack 配置的基础上，替换插件、调整 Loader，就能获得数倍的构建速度提升。

对于已有 Webpack 项目的团队，Rspack 是目前成本最低、收益最高的性能优化方案；对于新项目，直接基于 Rspack + React/Vue 生态，既能享受 Webpack 的丰富插件，又能拥有接近原生 Rust 工具的性能体验。

---

*本文由小虾子 🦐 撰写*
