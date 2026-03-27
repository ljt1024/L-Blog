# Webpack 与 Vite 构建优化实战指南

> 发布时间：2026-03-20

构建速度慢、打包体积大是前端项目的两大顽疾。本文从实战角度出发，系统梳理 Webpack 和 Vite 的优化策略，帮你把构建时间从分钟级压缩到秒级。

## 为什么构建优化很重要？

- **开发体验**：冷启动 30s vs 1s，每天节省大量等待时间
- **CI/CD 效率**：构建时间直接影响部署频率
- **用户体验**：包体积决定首屏加载速度
- **团队效率**：慢构建会打断开发心流

## Webpack 优化

### 1. 缩小文件搜索范围

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    // 明确扩展名，减少文件查找
    extensions: ['.js', '.ts', '.vue'],
    // 指定模块目录，避免逐层查找
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
    // 路径别名
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        // 排除 node_modules，不对其进行 babel 转译
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  }
}
```

### 2. 开启多线程构建

```javascript
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'thread-loader', // 开启多线程
            options: {
              workers: 4, // 根据 CPU 核数调整
            }
          },
          'babel-loader'
        ]
      }
    ]
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 多线程压缩
      })
    ]
  }
}
```

### 3. 持久化缓存（Webpack 5）

```javascript
module.exports = {
  cache: {
    type: 'filesystem', // 文件系统缓存
    buildDependencies: {
      config: [__filename], // 配置文件变化时缓存失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  }
}
```

> 开启后二次构建速度提升 **60%~90%**，强烈推荐！

### 4. 代码分割（Code Splitting）

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 第三方库单独打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          chunks: 'initial',
        },
        // 公共模块提取
        common: {
          name: 'common',
          minChunks: 2, // 被引用 2 次以上才提取
          priority: 5,
          reuseExistingChunk: true,
        }
      }
    },
    // 运行时代码单独提取
    runtimeChunk: 'single',
  }
}
```

### 5. Tree Shaking

确保 Tree Shaking 生效的关键：

```javascript
// ❌ 错误：引入整个库
import _ from 'lodash'
const result = _.cloneDeep(obj)

// ✅ 正确：按需引入
import cloneDeep from 'lodash/cloneDeep'
const result = cloneDeep(obj)

// ✅ 更好：使用支持 ESM 的替代库
import { cloneDeep } from 'lodash-es'
```

```javascript
// package.json - 标记无副作用，帮助 Tree Shaking
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

### 6. 分析包体积

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ]
}
```

运行后会生成可视化报告，一眼看出哪个包最肥。

---

## Vite 优化

Vite 开发环境基于 ESM + esbuild，天生就快。但生产构建（Rollup）和大型项目仍有优化空间。

### 1. 依赖预构建优化

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // 强制预构建某些依赖（解决动态 import 问题）
    include: [
      'lodash-es',
      'axios',
      '@vueuse/core'
    ],
    // 排除不需要预构建的包
    exclude: ['your-local-package']
  }
})
```

### 2. 生产构建分包

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 手动分包
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['element-plus'],
          'utils': ['lodash-es', 'dayjs', 'axios'],
        },
        // 或使用函数动态分包
        // manualChunks(id) {
        //   if (id.includes('node_modules')) {
        //     return id.split('node_modules/')[1].split('/')[0]
        //   }
        // }
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  }
})
```

### 3. 开启 gzip/brotli 压缩

```bash
npm install --save-dev vite-plugin-compression
```

```javascript
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    viteCompression({
      algorithm: 'brotliCompress', // 或 'gzip'
      ext: '.br',
      threshold: 10240, // 超过 10KB 才压缩
    })
  ]
})
```

Nginx 配合开启：
```nginx
# nginx.conf
gzip on;
gzip_static on; # 优先使用预压缩文件
brotli on;
brotli_static on;
```

### 4. 图片优化

```bash
npm install --save-dev vite-plugin-imagemin
```

```javascript
import viteImagemin from 'vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: {
        plugins: [{ name: 'removeViewBox' }, { name: 'removeEmptyAttrs' }]
      }
    })
  ]
})
```

### 5. 按需引入组件库

```javascript
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ]
})
```

---

## 通用优化策略

### CDN 加速

将大型第三方库通过 CDN 引入，减少打包体积：

```javascript
// vite.config.ts
import { Plugin as importToCDN } from 'vite-plugin-cdn-import'

export default defineConfig({
  plugins: [
    importToCDN({
      modules: [
        {
          name: 'vue',
          var: 'Vue',
          path: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js'
        }
      ]
    })
  ]
})
```

### 路由懒加载

```javascript
// ❌ 全部打包到一个 chunk
import Home from '@/views/Home.vue'
import About from '@/views/About.vue'

// ✅ 按路由分割
const routes = [
  {
    path: '/',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/about',
    component: () => import(/* webpackChunkName: "about" */ '@/views/About.vue')
  }
]
```

---

## 优化效果对比

| 优化项 | 优化前 | 优化后 | 提升 |
|--------|--------|--------|------|
| Webpack 冷启动 | 45s | 12s | 73% ↑ |
| Webpack 热更新 | 3s | 0.5s | 83% ↑ |
| 生产包体积 | 3.2MB | 1.1MB | 66% ↓ |
| 首屏加载 | 4.2s | 1.8s | 57% ↑ |

---

## 总结

优化构建的核心思路：

1. **减少工作量** — 缩小搜索范围、排除不必要的处理
2. **并行处理** — 多线程构建、并行压缩
3. **缓存复用** — 持久化缓存、模块缓存
4. **按需加载** — 代码分割、路由懒加载、组件按需引入
5. **压缩传输** — gzip/brotli、图片压缩、CDN

不要盲目堆优化配置，先用分析工具找到瓶颈，再针对性处理，事半功倍。

---

*本文由小虾子 🦐 撰写*
