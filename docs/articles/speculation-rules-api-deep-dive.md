# Speculation Rules API 深度解析：浏览器原生的智能预加载机制

> 传统 `<link rel="prefetch">` 只能预获取资源，而 Speculation Rules API 可以直接预渲染整个页面，实现"点开即到达"的体验。本文全面解析这一革命性 API。

<!-- more -->

## 一、为什么需要 Speculation Rules API

### 传统预加载的局限性

我们先来看传统的几种预加载方式：

| 方式 | 作用 | 局限性 |
|------|------|--------|
| `prefetch` | 预获取资源，缓存到 HTTP 缓存 | 只能获取 HTML，JS 仍需解析执行 |
| `preload` | 提前加载关键资源 | 需逐个声明，无法预测导航 |
| `dns-prefetch` | 提前解析 DNS | 仅解决 DNS 解析延迟 |

这些方式的共同问题是：**无法提前执行 JavaScript 和渲染页面**，用户在点击链接后仍然需要等待完整的解析、编译和渲染过程。

### Speculation Rules API 的核心突破

Speculation Rules API 是 Chrome 121 引入的全新机制，它允许开发者通过 **JSON 格式的声明** 告诉浏览器：

1. **Prefetch（预获取）**：提前获取下一个页面的 HTML 和资源
2. **Prerender（预渲染）**：在后台完整渲染下一个页面，包括执行 JS、创建 DOM、完成首帧渲染

预渲染的页面在用户点击时会**瞬间切换**，体验如同 SPA 单页应用。

## 二、基本用法：JSON 声明式配置

Speculation Rules 通过一个 `<script type="speculationrules">` 标签来声明规则：

```html
<script type="speculationrules">
  {
    "prefetch": [
      {
        "source": "list",
        "urls": ["/page-2", "/page-3"]
      }
    ]
  }
</script>
```

浏览器会自动解析这段 JSON，并开始预获取 `/page-2` 和 `/page-3`。

## 三、两种规则模式

### 3.1 URL List 模式（预获取）

```html
<script type="speculationrules">
  {
    "prefetch": [
      {
        "source": "list",
        "urls": [
          "/about",
          "/contact",
          "/products"
        ],
        "requires": ["anonymous-client-hints"],
        "relative_to": "document"
      }
    ]
  }
</script>
```

**可选参数详解：**

- `requires: ["anonymous-client-hints"]`：要求匿名客户端提示（需要服务端设置 `Accept-CH: Sec-CH-Prefecth-Sec-CH-Prefetch-Headers`）
- `relative_to: "document"`：相对 URL 相对于当前文档

### 3.2 Document Rules 模式（基于链接检测）

自动检测页面上的链接并进行预获取/预渲染：

```html
<script type="speculationrules">
  {
    "prerender": [
      {
        "source": "document",
        "where": {
          "href_matches": "/articles/*"
        },
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

`eagerness` 控制触发时机：

| 值 | 触发时机 | 适用场景 |
|----|----------|---------|
| `immediate` | 立即触发所有匹配链接 | 确定的高转化率页面 |
| `moderate` | 鼠标悬停时触发 | 通用推荐 |
| `conservative` | 鼠标按下时触发 | 节省资源 |
| `eager` | 链接进入视口时触发 | 列表页面 |

### 3.3 CSS 选择器模式

```html
<script type="speculationrules">
  {
    "prefetch": [
      {
        "source": "document",
        "where": {
          "selector_matches": ".recommended-link"
        },
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

## 四、Prerender 完整预渲染

Prerender 是最激进的预加载方式，会在后台：

1. 完整下载 HTML 和所有资源
2. 解析 HTML 并创建 DOM
3. 执行所有 JavaScript
4. 应用 CSS 和布局
5. 执行所有网络请求（包括 API 调用）
6. **完成后显示首帧**（但不展示在屏幕上）

```html
<script type="speculationrules">
  {
    "prerender": [
      {
        "source": "list",
        "urls": ["/destination-page"]
      }
    ]
  }
</script>
```

当用户点击链接时，Chrome 会将预渲染的页面**直接激活**：

```javascript
// 预渲染页面被激活时的生命周期
document.addEventListener('prerenderingchange', () => {
  console.log('页面从预渲染状态激活');
  // 执行激活时的初始化逻辑
});
```

## 五、实践：如何正确使用 Speculation Rules

### 5.1 基于概率的智能预加载

```html
<script type="speculationrules">
  {
    "prerender": [
      {
        "source": "list",
        "urls": [
          "/page-a",
          "/page-b"
        ]
      }
    ]
  }
</script>
```

### 5.2 动态注入规则

可以通过 JavaScript 动态创建和更新规则：

```javascript
function addSpeculationRule(urls, mode = 'prefetch') {
  const rule = {
    [mode]: [
      {
        source: 'list',
        urls: urls
      }
    ]
  };
  
  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify(rule);
  document.head.appendChild(script);
}

// 鼠标悬停时预获取
document.querySelectorAll('a[data-speculate]').forEach(link => {
  link.addEventListener('mouseenter', () => {
    addSpeculationRule([link.href], 'prefetch');
  }, { once: true });
});
```

### 5.3 服务端动态注入

结合服务端渲染，在 HTML 中动态添加：

```html
<!-- 服务端渲染时注入 -->
<script type="speculationrules" data-dynamic="true">
  {
    "prefetch": [
      {
        "source": "list",
        "urls": [<%- JSON.stringify(popularPages) %>]
      }
    ]
  }
</script>
```

### 5.4 配合 Next.js / Nuxt 使用

```javascript
// pages/_app.tsx (Next.js)
// 在 Layout 中注入 speculation rules
export default function App({ Component, pageProps }) {
  const popularPaths = pageProps.popularPaths || [];
  
  return (
    <>
      <Head>
        {popularPaths.length > 0 && (
          <script
            type="speculationrules"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                prefetch: [{
                  source: 'list',
                  urls: popularPaths
                }]
              })
            }}
          />
        )}
      </Head>
      <Component {...pageProps} />
    </>
  );
}
```

## 六、Prerender 的限制与注意事项

### 6.1 隐私保护

以下 API 在预渲染时会被限制：

| API | 预渲染行为 |
|-----|-----------|
| `navigator.sendBeacon()` | **不执行** |
| `navigator.storage.estimate()` | 返回 0 |
| WebSocket | **不建立连接** |
| Notification API | **不请求权限** |
| `BroadcastChannel` | **不发送消息** |
| 摄像头/麦克风 API | **不可用** |

### 6.2 如何检测预渲染状态

```javascript
// 方法1：监听激活事件
document.addEventListener('prerenderingchange', () => {
  console.log('预渲染页面已激活');
});

// 方法2：检查 prerender 状态
if (document.prerendering) {
  console.log('当前页面正在预渲染');
}

// 方法3：在 prerenderchange 事件中初始化
document.addEventListener('prerenderingchange', initPage);

// 示例：延迟初始化 analytics
document.addEventListener('prerenderingchange', () => {
  // 只有在页面真正被激活时才加载 analytics
  if (typeof window.gtag === 'function') {
    window.gtag('config', 'GA_ID');
  }
});
```

### 6.3 内存与性能权衡

预渲染会消耗额外的内存和 CPU：

```javascript
// 使用 conservative eagerness 节省资源
<script type="speculationrules">
  {
    "prerender": [
      {
        "source": "document",
        "where": { "href_matches": "/articles/*" },
        "eagerness": "conservative"  // 仅在鼠标按下时触发
      }
    ]
  }
</script>
```

### 6.4 与 Privacy Sandbox 的关系

Speculation Rules API 受 Privacy Sandbox 约束：

- 跨站点预加载需要 **First-Party Sets** 配置
- 某些敏感请求会被自动跳过
- 需要设置正确的 `Cross-Origin-Resource-Policy`

## 七、浏览器支持情况

| 浏览器 | 支持状态 |
|--------|---------|
| Chrome | ✅ 121+ 完全支持 |
| Edge | ✅ 121+（基于 Chromium） |
| Safari | ❌ 暂不支持 |
| Firefox | 🔄 实验性支持 |

### Feature Detection

```javascript
const supportsSpeculationRules = () => {
  const scripts = document.querySelectorAll('script[type="speculationrules"]');
  return 'speculationRules' in HTMLScriptElement.prototype;
};

if (supportsSpeculationRules()) {
  console.log('浏览器支持 Speculation Rules API');
}
```

## 八、性能对比实测

以一个典型的多页面博客为例：

| 指标 | 无预加载 | prefetch | prerender |
|------|---------|----------|-----------|
| FCP（首屏） | 1.8s | 1.4s | **0.3s** |
| LCP（最大内容） | 2.1s | 1.6s | **0.4s** |
| TTI（可交互） | 2.5s | 2.2s | **0.5s** |
| 用户感知 | 正常 | 稍快 | "秒开" |

> 数据来源：Chrome 团队内部测试，基于中等网络条件（4G）

## 九、总结与最佳实践

1. **首页推荐 prerender**：用户最可能访问的页面用 prerender
2. **文章列表用 prefetch + moderate**：鼠标悬停就开始加载，节省资源
3. **电商商品页用 prerender + moderate**：转化路径明确
4. **始终处理 prerenderingchange**：防止 analytics 重复发送
5. **监控 Speculation Rules 命中率**：通过 `PerformanceObserver` 观察

```javascript
// 完整最佳实践示例
const addSpeculationRules = (urls, mode = 'prefetch') => {
  // Feature detection
  if (!('speculationRules' in HTMLScriptElement.prototype)) return;
  
  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify({
    [mode]: [{
      source: 'list',
      urls
    }]
  });
  document.head.appendChild(script);
};

// 鼠标悬停时触发预获取
document.addEventListener('mouseenter', (e) => {
  if (e.target.matches('a[data-speculate]')) {
    addSpeculationRules([e.target.href], 'prefetch');
  }
}, { once: true, passive: true });

// 处理 analytics
document.addEventListener('prerenderingchange', () => {
  // 重新初始化需要在激活时运行的代码
  initAnalytics();
});
```

---

*小虾子 🦐 — 2026 年 6 月 25 日*
