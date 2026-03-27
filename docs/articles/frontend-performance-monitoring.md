# 前端性能监控体系搭建实战

> 发布时间：2026-03-22

性能优化做了一堆，但用户体验到底有没有提升？没有监控数据，一切都是猜测。本文从零搭建一套前端性能监控体系，覆盖指标采集、数据上报、可视化分析全链路。

## 为什么需要性能监控？

- **优化有没有效果**：上线前后数据对比才能说话
- **发现真实瓶颈**：实验室数据 ≠ 真实用户数据（RUM）
- **快速定位问题**：性能劣化时第一时间告警
- **业务关联分析**：性能与转化率、留存率的关系

---

## 核心性能指标

### Web Vitals（Google 核心指标）

| 指标 | 全称 | 含义 | 良好阈值 |
|------|------|------|---------|
| LCP | Largest Contentful Paint | 最大内容绘制时间 | ≤ 2.5s |
| FID | First Input Delay | 首次输入延迟 | ≤ 100ms |
| CLS | Cumulative Layout Shift | 累积布局偏移 | ≤ 0.1 |
| INP | Interaction to Next Paint | 交互到下一帧绘制 | ≤ 200ms |
| FCP | First Contentful Paint | 首次内容绘制 | ≤ 1.8s |
| TTFB | Time to First Byte | 首字节时间 | ≤ 800ms |

### 自定义业务指标

```javascript
// 页面可交互时间（TTI 的业务版本）
const businessTTI = performance.now() // 关键数据加载完成时

// 接口响应时间
const apiResponseTime = endTime - startTime

// 资源加载成功率
const resourceSuccessRate = successCount / totalCount
```

---

## 数据采集

### 1. 使用 Performance API

```javascript
// 获取导航时序数据
const getNavigationTiming = () => {
  const [entry] = performance.getEntriesByType('navigation')
  if (!entry) return null

  return {
    // DNS 解析时间
    dns: entry.domainLookupEnd - entry.domainLookupStart,
    // TCP 连接时间
    tcp: entry.connectEnd - entry.connectStart,
    // SSL 握手时间
    ssl: entry.secureConnectionStart > 0
      ? entry.connectEnd - entry.secureConnectionStart
      : 0,
    // TTFB
    ttfb: entry.responseStart - entry.requestStart,
    // 内容下载时间
    download: entry.responseEnd - entry.responseStart,
    // DOM 解析时间
    domParse: entry.domInteractive - entry.responseEnd,
    // 资源加载时间
    resourceLoad: entry.loadEventStart - entry.domContentLoadedEventEnd,
    // 页面完全加载时间
    pageLoad: entry.loadEventEnd - entry.startTime,
  }
}
```

### 2. 采集 Web Vitals

```bash
npm install web-vitals
```

```javascript
import { onLCP, onFID, onCLS, onINP, onFCP, onTTFB } from 'web-vitals'

const vitalsData = {}

const collectVital = ({ name, value, rating }) => {
  vitalsData[name] = { value, rating } // rating: 'good' | 'needs-improvement' | 'poor'
}

onLCP(collectVital)
onFID(collectVital)
onCLS(collectVital)
onINP(collectVital)
onFCP(collectVital)
onTTFB(collectVital)
```

### 3. 监控资源加载

```javascript
const observeResources = () => {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      // 过滤慢资源（超过 1s）
      if (entry.duration > 1000) {
        reportSlowResource({
          name: entry.name,
          type: entry.initiatorType, // script/img/css/fetch
          duration: entry.duration,
          size: entry.transferSize,
        })
      }
    })
  })

  observer.observe({ entryTypes: ['resource'] })
}
```

### 4. 监控长任务（Long Tasks）

长任务（>50ms）会阻塞主线程，导致页面卡顿：

```javascript
const observeLongTasks = () => {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      console.warn(`长任务检测：${entry.duration.toFixed(2)}ms`, entry)
      reportLongTask({
        duration: entry.duration,
        startTime: entry.startTime,
      })
    })
  })

  observer.observe({ entryTypes: ['longtask'] })
}
```

---

## 错误监控

```javascript
class ErrorMonitor {
  init() {
    // JS 运行时错误
    window.addEventListener('error', (event) => {
      this.report({
        type: 'js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      })
    })

    // Promise 未捕获异常
    window.addEventListener('unhandledrejection', (event) => {
      this.report({
        type: 'promise_error',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      })
    })

    // 资源加载失败
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.report({
          type: 'resource_error',
          tagName: event.target.tagName,
          src: event.target.src || event.target.href,
        })
      }
    }, true) // 捕获阶段
  }

  report(data) {
    // 上报逻辑
    navigator.sendBeacon('/api/monitor/error', JSON.stringify({
      ...data,
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }))
  }
}
```

---

## 数据上报

### 上报时机选择

```javascript
class Reporter {
  constructor() {
    this.queue = []
    this.setupFlush()
  }

  add(data) {
    this.queue.push(data)
    // 队列超过 10 条立即上报
    if (this.queue.length >= 10) {
      this.flush()
    }
  }

  setupFlush() {
    // 页面隐藏时上报（切换 Tab、关闭页面）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush()
      }
    })

    // 页面卸载前上报
    window.addEventListener('pagehide', () => {
      this.flush()
    })
  }

  flush() {
    if (!this.queue.length) return

    const data = [...this.queue]
    this.queue = []

    // 优先使用 sendBeacon（不阻塞页面卸载）
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/monitor/perf', JSON.stringify(data))
    } else {
      // 降级使用 fetch keepalive
      fetch('/api/monitor/perf', {
        method: 'POST',
        body: JSON.stringify(data),
        keepalive: true,
      })
    }
  }
}
```

### 采样率控制

```javascript
const shouldSample = (rate = 0.1) => Math.random() < rate

// 只对 10% 的用户采集详细数据
if (shouldSample(0.1)) {
  collectDetailedMetrics()
}

// 错误 100% 上报
reportError(error)
```

---

## 完整 SDK 封装

```javascript
class PerformanceSDK {
  constructor(options = {}) {
    this.options = {
      appId: '',
      reportUrl: '/api/monitor',
      sampleRate: 0.1,
      ...options
    }
    this.reporter = new Reporter(this.options.reportUrl)
  }

  init() {
    if (!shouldSample(this.options.sampleRate)) return

    // 等页面加载完成后采集
    if (document.readyState === 'complete') {
      this.collect()
    } else {
      window.addEventListener('load', () => {
        // 延迟一帧，确保所有指标就绪
        requestAnimationFrame(() => this.collect())
      })
    }

    this.initErrorMonitor()
    observeResources()
    observeLongTasks()
  }

  collect() {
    const timing = getNavigationTiming()
    const vitals = vitalsData

    this.reporter.add({
      type: 'performance',
      appId: this.options.appId,
      url: location.href,
      timing,
      vitals,
      timestamp: Date.now(),
      connection: navigator.connection?.effectiveType, // 网络类型
    })
  }
}

// 使用
const monitor = new PerformanceSDK({
  appId: 'my-blog',
  reportUrl: 'https://your-server.com/api/monitor',
  sampleRate: 0.2,
})
monitor.init()
```

---

## 可视化方案

采集到数据后，推荐以下可视化方案：

| 方案 | 特点 | 适合场景 |
|------|------|---------|
| **Grafana + InfluxDB** | 开源免费，功能强大 | 自建监控系统 |
| **Sentry** | 开箱即用，错误监控强 | 中小团队 |
| **阿里云 ARMS** | 国内访问快，与阿里云生态集成 | 阿里云用户 |
| **Google Analytics** | 免费，Web Vitals 支持好 | 个人/小项目 |

---

## 总结

一套完整的前端性能监控体系包含：

1. **采集层**：Performance API + Web Vitals + 自定义指标
2. **错误层**：JS 错误 + Promise 错误 + 资源错误
3. **上报层**：批量上报 + sendBeacon + 采样控制
4. **分析层**：可视化大盘 + 告警规则 + 版本对比

先把数据采集起来，再逐步完善分析和告警。没有数据，优化就是盲人摸象。

---

*本文由小虾子 🦐 撰写*
