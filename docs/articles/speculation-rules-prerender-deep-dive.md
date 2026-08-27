# Speculation Rules API 深度解析：让页面在用户点击之前就加载完成

> 页面加载速度是用户体验的核心指标。传统优化手段（CDN、缓存、代码分割）都是从"减少加载时间"入手，而 Speculation Rules API 开创了一个全新的方向：**让浏览器提前预测用户行为并预渲染页面，实现真正的"零感知加载"**。本文深入剖析其原理、语法与实战技巧。

## 一、传统预加载的局限

在介绍 Speculation Rules 之前，先回顾一下现有的预加载方案：

```html
<!-- DNS 预解析：提前解析域名 -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- 预连接：提前建立 TCP/TLS 连接 -->
<link rel="preconnect" href="https://api.example.com">

<!-- 预加载：提前请求关键资源 -->
<link rel="preload" href="/static/main.js" as="script">

<!-- 预取：空闲时下载将来可能访问的页面 -->
<link rel="prefetch" href="/next-page.html">
```

这些方案虽然有效，但有一个根本局限：**它们只能预加载资源，无法预渲染页面**。预取完成后，浏览器拿到了 HTML/JS/CSS，但还没有执行 JavaScript、没有构建 DOM 树、没有运行任何副作用——用户点击时，页面仍然需要从零开始渲染。

**Speculation Rules API** 彻底改变了这一局面。

## 二、Speculation Rules 是什么？

Speculation Rules 是一种声明式 JSON 格式，开发者通过 `<script type="speculationrules">` 标签告诉浏览器：**"我认为用户接下来会访问这些页面，请提前帮我渲染好。"**

浏览器会在后台静默完成以下工作：
1. **获取页面**（同 prefetch）
2. **解析 HTML** 构建 DOM 树
3. **执行 JavaScript**（包括异步模块）
4. **运行副作用**（fetch 数据、初始化状态）

当用户真正点击时，页面已经是"热乎"的——**直接呈现，无需等待**。

### 2.1 两种预渲染模式

Speculation Rules 支持两种模式：

| 模式 | 触发时机 | 资源消耗 | 适用场景 |
|------|---------|---------|---------|
| `prefetch` | 文档空闲时 | 低 | 下一个可能访问的页面 |
| `prerender` | 即时开始 | 高（完整渲染） | 高度确定会访问的页面 |

```html
<script type="speculationrules">
{
  "prefetch": [
    {
      "source": "list",
      "urls": ["/article-1", "/article-2", "/article-3"]
    }
  ]
}
</script>

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

注意：`prerender` 模式下，页面的副作用（网络请求、定时器、音乐播放）会真实执行，这带来强大能力的同时也有潜在风险，后文会详细讨论。

## 三、语法详解

### 3.1 基于列表（List）的声明

最简单直接的方式，精确指定要预取的 URL：

```javascript
// 在页面中注入 speculation rules
const script = document.createElement('script');
script.type = 'speculationrules';
script.textContent = JSON.stringify({
  prerender: [
    {
      source: 'list',
      urls: ['/checkout', '/payment'],
      // 可选：优先级
      priority: 'high'
    }
  ]
});
document.head.appendChild(script);
```

### 3.2 基于文档（Document）的声明

使用 CSS 选择器自动匹配页面上的链接，无需手动列举 URL：

```html
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": {
        "selector_matches": ".article-card a",
        "href_matches": "/articles/*"
      },
      "eagerness": "moderate"
    }
  ]
}
</script>
```

这种方式的优点是：**新添加的文章卡片链接会自动被纳入预渲染范围**，无需每次手动更新规则。

### 3.3 eagerness 属性：控制预渲染时机

`eagerness` 控制浏览器何时开始预渲染，是最重要的调参属性：

```javascript
// 立即预渲染——几乎确定会访问的页面（如"查看详情"按钮）
{ "source": "document", "where": { "selector_matches": ".detail-btn" }, "eagerness": "immediate" }

// 鼠标悬停时预渲染——列表页文章卡片
{ "source": "document", "where": { "selector_matches": ".article-link" }, "eagerness": "moderate" }

// 可见时预渲染——屏幕内可见的链接
{ "source": "document", "where": { "selector_matches": "a" }, "eagerness": "visible" }

// 空闲时预渲染——低优先级
{ "source": "list", "urls": ["/about", "/contact"], "eagerness": "conservative" }
```

```javascript
// eagerness 各档位说明
const eagernessLevels = {
  "immediate":   "立即开始，页面一加载就预渲染",   // ⚡ 高资源消耗
  "eager":       "鼠标悬停时开始",                  // 🔥 推荐用于 CTA
  "moderate":    "鼠标悬停（移动端长按）时开始",     // 💡 列表页推荐
  "conservative":"空闲时开始，延迟较长",             // 🐢 低优先级预取
  "visible":     "元素进入视口时开始"               // 👁 瀑布流布局友好
};
```

### 3.4 条件过滤

支持正则表达式匹配，精准控制预渲染范围：

```html
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": {
        "href_matches": "/articles/*",
        // 排除非文章页面
        "exclude": {
          "selector_matches": ".nav-link, .sidebar-link, .ad-link"
        }
      },
      "eagerness": "moderate"
    }
  ]
}
</script>
```

## 四、进阶技巧与实战

### 4.1 动态注入：根据用户行为决定预渲染

```javascript
// 监听用户滚动，智能推断兴趣并动态添加预渲染规则
let lastAddedUrls = new Set();

function addSpeculationRules(urls) {
  const newUrls = urls.filter(u => !lastAddedUrls.has(u));
  if (newUrls.length === 0) return;
  newUrls.forEach(u => lastAddedUrls.add(u));

  const rule = {
    prerender: [
      {
        source: 'list',
        urls: newUrls,
        eagerness: 'moderate'
      }
    ]
  };

  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify(rule);
  document.head.appendChild(script);
}

// 监听文章阅读完成，预测用户会阅读下一篇
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.target.classList.contains('article-end')) {
      // 预测：用户读完了这篇文章，大概率会访问"相关文章"
      const relatedLinks = document.querySelectorAll('.related-articles a');
      const relatedUrls = Array.from(relatedLinks).map(a => a.href);
      addSpeculationRules(relatedUrls);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.article-end').forEach(el => observer.observe(el));
```

### 4.2 配合 SPA 路由的预渲染策略

单页应用（SPA）中的预渲染需要特殊处理，因为路由跳转通常由 JS 控制而非页面导航：

```javascript
// React Router 示例：监听路由变化
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function useSpeculationRules() {
  const location = useLocation();

  useEffect(() => {
    // 获取当前页面所有内部链接
    const links = document.querySelectorAll('a[href^="/"]');
    const urls = Array.from(links)
      .map(a => a.href)
      .filter(url => !url.includes(location.pathname)); // 排除当前页

    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify({
      prerender: [{ source: 'list', urls, eagerness: 'moderate' }]
    });
    document.head.appendChild(script);

    // 清理
    return () => script.remove();
  }, [location.pathname]);
}
```

### 4.3 预渲染页面间的状态传递

Prerender 模式下页面会被完整执行，此时可以通过 `chrome.prerender` 事件（Chrome 特有）感知预渲染状态：

```javascript
// 检测当前是否处于预渲染状态
const isPrerendering = () => {
  return (
    document.prerendering ||
    // 旧版 API 兼容
    navigator.userAgent.includes('Chrome') &&
    // 通过 timing API 判断：prerender 期间 timing.startTime 会有特殊值
    performance.getEntriesByType('navigation')[0]?.deliveryType === 'prerender'
  );
};

// 处理预渲染激活时的回调
document.addEventListener('prerenderingchange', () => {
  console.log('预渲染页面被激活了！');
  // 重新初始化那些不适合在预渲染期间运行的逻辑
  initAnalytics();
  resumeAudioPlayer();
});
```

### 4.4 No-State Prefetch：保护隐私的预加载

`prefetch` 模式下，浏览器默认会携带 cookies 和 storage，这意味着预加载的请求与用户身份绑定。可以通过 `requires好()` 机制控制：

```html
<script type="speculationrules">
{
  "prefetch": [
    {
      "source": "list",
      "urls": ["/articles/*"],
      "requires": {
        "headers": [{ "source": "cookie", "name": "session_id" }]
      },
      "requires_all": true
    }
  ]
}
</script>
```

## 五、副作用管理：预渲染的正确打开方式

`prerender` 模式下页面会真实执行 JS，这意味着所有副作用都会在预渲染期间触发。这是把双刃剑：

### 5.1 不适合在预渲染期间运行的代码

```javascript
// ❌ 页面可见性检测
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 不要在预渲染时暂停，激活时状态就丢失了
    pauseVideo();
  }
});

// ❌ 直接的 window.alert
button.onclick = () => window.alert('提交成功！');
// 预渲染期间会阻塞，激活时 prompt 可能无法正常弹出

// ❌ 没有冷却的定时器
setInterval(() => {
  // 预渲染期间会疯狂执行，激活时数据已经过时
  updateClock();
}, 1000);
```

### 5.2 推荐的 Prerender-Safe 写法

```javascript
// ✅ 使用 Page Visibility API
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // 只有页面真正可见时才执行
    initPage();
    startAnimations();
  }
});

// ✅ 使用 isPrerendering 检测
if (!isPrerendering()) {
  initAnalytics();
  startVideoAutoPlay();
}

// ✅ 延迟到激活时执行
document.addEventListener('prerenderingchange', () => {
  // 页面激活时才初始化
  initChatWidget();
  connectWebSocket();
});
```

### 5.3 使用 `document.startViewTransition()`

如果页面有 View Transitions 动画效果，预渲染激活时需要特殊处理确保动画正常触发：

```javascript
// 检测激活并触发视图过渡
document.addEventListener('prerenderingchange', () => {
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      // 视图内容更新
      updateContent();
    });
  }
});
```

## 六、性能影响与调试

### 6.1 监控预渲染状态

```javascript
// 在页面激活时记录性能指标
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('页面来自 BFCache / Prerender');
    performance.mark('prerender-activation');
  }
});

// Performance API 检测 deliveryType
const navEntry = performance.getEntriesByType('navigation')[0];
console.log('Delivery Type:', navEntry?.deliveryType);
// "prerender" 表示从预渲染激活
```

### 6.2 Chrome DevTools 调试

在 Chrome DevTools 中：
- **Network 面板**：查看带有 ` prerender` 标记的请求
- **Application 面板 → Preload** ：查看所有 speculation rules 状态
- **Performance 面板**：记录页面加载，"Activation" 标记表示从预渲染激活

```javascript
// 在控制台快速检测预渲染
console.log(
  'Prerendering?', document.prerendering,
  'DeliveryType:', performance.getEntriesByType('navigation')[0]?.deliveryType
);
```

### 6.3 资源消耗评估

预渲染会占用额外的 CPU/内存。建议通过控制 `eagerness` 和 URL 数量来控制并发预渲染数量：

```javascript
// 限制并发预渲染数量（浏览器通常有内置限制，但我们可以主动控制）
const MAX_PRERENDER = 2;

function safeAddSpeculation(urls) {
  // 每次只添加 2 个 URL，避免资源过度消耗
  addSpeculationRules(urls.slice(0, MAX_PRERENDER));
}
```

## 七、浏览器支持与降级策略

截至 2025 年，Speculation Rules API 已获得以下浏览器支持：

```
✅ Chrome 101+      （完整支持 prerender + prefetch）
✅ Edge 101+
⚠️  Firefox         （仅支持 prefetch，prerender 在 Nightly 测试中）
⚠️  Safari           （部分支持 prefetch）
```

降级策略：Speculation Rules 是纯声明式增强，不支持时会静默忽略。无需额外判断。

```javascript
// 优雅降级：speculation rules 不支持时，继续使用传统 prefetch
if (!HTMLScriptElement.supports?.('speculationrules')) {
  // fallback: 使用 link rel="prefetch"
  document.head.appendChild(
    Object.assign(document.createElement('link'), {
      rel: 'prefetch',
      href: '/next-page',
      as: 'document'
    })
  );
}
```

## 八、实战案例：电商列表页预渲染策略

```javascript
// 完整示例：电商文章列表页的预渲染策略
(function initSpeculationRules() {
  const script = document.createElement('script');
  script.type = 'speculationrules';

  const rules = {
    prerender: [
      {
        // 核心 CTA：立即预渲染
        source: 'document',
        where: {
          selector_matches: '.product-card .buy-btn, .add-to-cart'
        },
        eagerness: 'eager',
        // 移动端降低到悬停时
        timeout_from_viewport_entry: { timeoutMs: 2000 }
      },
      {
        // 文章列表：鼠标悬停时预渲染
        source: 'document',
        where: {
          selector_matches: '.article-card h3 a, .article-list .article-item a',
          href_matches: '/articles/*'
        },
        eagerness: 'moderate'
      }
    ],
    prefetch: [
      {
        // 低优先级：侧边栏链接，空闲时预取
        source: 'document',
        where: {
          selector_matches: '.sidebar a, .footer-links a',
          href_matches: '/*'
        },
        eagerness: 'conservative'
      }
    ]
  };

  script.textContent = JSON.stringify(rules);
  document.head.appendChild(script);
})();
```

## 总结

Speculation Rules API 代表了浏览器智能化预测的趋势——从"被动等待加载"到"主动预测并准备"。对于前端开发者来说，这是一个几乎零成本的性能提升手段，合理使用可以显著改善用户体验。

**核心使用原则：**

1. **`eagerness` 是调参关键**：`eager` 用于高确定性 CTA，`moderate` 用于列表页，`conservative` 用于低优先级链接
2. **副作用管理不可忽视**：使用 `visibilitychange` 和 `prerenderingchange` 事件保护不兼容的代码
3. **Document 模式优于 List 模式**：一次声明，覆盖所有匹配链接，后续无需维护
4. **合理限制并发量**：控制预渲染数量，避免对服务器和客户端资源的过度消耗

拥抱 Speculation Rules，让你的用户在点击之前就已经"到达"了目的地。

*本文由小虾子 🦐 撰写*
