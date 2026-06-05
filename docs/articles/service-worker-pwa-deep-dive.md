# Service Worker 与 PWA 深度实践指南

在现代 Web 开发中，用户体验已经不满足于简单的页面展示，用户期望 Web 应用能够像原生应用一样：离线可用、快速加载、推送通知。Service Worker 作为 PWA（Progressive Web App）的核心技术，正是实现这些能力的关键。本文将深入探讨 Service Worker 的工作原理、生命周期管理、缓存策略，以及如何构建一个完整的 PWA 应用。

## Service Worker 是什么？

Service Worker 是一种运行在浏览器后台的脚本，独立于 Web 页面，充当浏览器和网络之间的代理服务器。它拦截网络请求，可以根据网络状态决定是从缓存还是网络获取资源。

### 核心特点

1. **独立线程运行**：Service Worker 运行在独立的 Worker 线程中，不会阻塞主线程
2. **事件驱动**：通过事件监听机制响应网络请求、推送消息等
3. **离线优先**：可以在离线状态下从缓存提供内容
4. **可编程控制**：开发者可以精确控制哪些请求被缓存、如何更新缓存

### 与普通 Web Worker 的区别

| 特性 | Service Worker | Web Worker |
|------|---------------|------------|
| 生命周期 | 跨会话持久化 | 页面关闭即销毁 |
| 作用域 | 可拦截网络请求 | 仅用于计算任务 |
| 运行环境 | 独立上下文 | 独立上下文 |
| 主要用途 | 缓存、离线、推送 | 计算、数据处理 |

## 注册 Service Worker

在页面中注册 Service Worker 是第一步。由于 Service Worker 是异步安装的，我们需要确保页面加载完成后再注册。

```javascript
// main.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'  // 控制的作用域范围
      });
      
      console.log('Service Worker 注册成功:', registration.scope);
      
      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本已安装，提示用户刷新
            console.log('新版本可用，请刷新页面');
          }
        });
      });
      
    } catch (error) {
      console.error('Service Worker 注册失败:', error);
    }
  });
}
```

### 注册注意事项

1. **HTTPS 要求**：生产环境必须使用 HTTPS（localhost 除外）
2. **路径问题**：Service Worker 文件的路径决定了它的作用域
3. **作用域限制**：默认只能控制同目录及其子目录下的页面

```javascript
// 如果 sw.js 在 /static/sw.js
// 需要显式指定 scope 才能控制根路径
navigator.serviceWorker.register('/static/sw.js', {
  scope: '/'
});
```

## Service Worker 生命周期

理解生命周期是正确管理 Service Worker 的关键。它包含以下几个状态：

```
解析 (Parsing) → 安装 (Installing) → 已安装 (Installed) → 激活 (Activating) → 已激活 (Activated) → 冗余 (Redundant)
```

### install 事件

`install` 事件在 Service Worker 首次注册或更新时触发。这是预缓存静态资源的最佳时机。

```javascript
// sw.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker 正在安装...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('预缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // 跳过等待，直接激活
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('预缓存失败:', error);
      })
  );
});
```

`skipWaiting()` 会让新的 Service Worker 立即激活，而不是等待所有标签页关闭。

### activate 事件

`activate` 事件在 Service Worker 激活时触发。这是清理旧缓存的好时机。

```javascript
self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('删除旧缓存:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // 立即控制所有页面
        return self.clients.claim();
      })
  );
});
```

`clients.claim()` 让激活的 Service Worker 立即控制所有客户端页面，而不需要刷新。

## 缓存策略详解

缓存策略决定了何时从缓存获取资源、何时从网络获取。以下是几种常用策略：

### 1. Cache First（缓存优先）

适用于静态资源，优先从缓存获取，缓存未命中时才请求网络。

```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 只处理 GET 请求
  if (request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // 缓存命中，直接返回
          return cachedResponse;
        }
        
        // 缓存未命中，请求网络
        return fetch(request)
          .then((response) => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 克隆响应（因为响应流只能读取一次）
            const responseToCache = response.clone();
            
            // 缓存响应
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          });
      })
  );
});
```

### 2. Network First（网络优先）

适用于需要最新数据的场景，优先从网络获取，网络失败时回退到缓存。

```javascript
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 尝试从网络获取
    const response = await fetch(request);
    
    if (response.ok) {
      // 缓存响应
      cache.put(request, response.clone());
      return response;
    }
    
    throw new Error('Network response was not ok');
  } catch (error) {
    console.log('网络请求失败，回退到缓存');
    
    // 从缓存获取
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 缓存也没有，返回离线页面
    return cache.match('/offline.html');
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
  }
});
```

### 3. Stale While Revalidate（后台更新）

先返回缓存，同时在后台更新缓存。适合对实时性要求不高但需要快速响应的资源。

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // 后台更新缓存
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);
  
  // 立即返回缓存（如果有的话）
  return cachedResponse || fetchPromise;
}
```

### 4. Network Only（仅网络）

适用于必须获取最新数据的场景。

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/admin/')) {
    event.respondWith(fetch(event.request));
  }
});
```

### 5. Cache Only（仅缓存）

适用于离线页面等静态资源。

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/offline.html')) {
    event.respondWith(caches.match(event.request));
  }
});
```

## 完整的缓存策略路由

实际项目中，我们需要根据不同类型的资源使用不同的缓存策略：

```javascript
// sw.js
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles/main.css',
  '/scripts/app.js'
];

// 判断请求类型
function isStaticAsset(url) {
  return url.pathname.startsWith('/static/') || 
         url.pathname.endsWith(('.css', '.js', '.png', '.jpg', '.webp'));
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// 缓存策略实现
const cacheStrategies = {
  cacheFirst: async (request) => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  },
  
  networkFirst: async (request) => {
    const cache = await caches.open(API_CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cache.match(request) || cache.match('/offline.html');
    }
  },
  
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => cached);
    
    return cached || fetchPromise;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理 GET 请求
  if (request.method !== 'GET') return;
  
  // 根据请求类型选择策略
  if (isStaticAsset(url)) {
    event.respondWith(cacheStrategies.cacheFirst(request));
  } else if (isApiRequest(url)) {
    event.respondWith(cacheStrategies.networkFirst(request));
  } else {
    event.respondWith(cacheStrategies.staleWhileRevalidate(request));
  }
});
```

## 更新策略与版本管理

Service Worker 更新是一个容易被忽视但至关重要的问题。

### 版本化缓存名称

```javascript
const CACHE_NAME = 'app-v2'; // 修改版本号触发更新

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.includes(CACHE_NAME.split('-')[0]))
          .map((key) => caches.delete(key))
      ))
  );
});
```

### 通知用户更新

```javascript
// sw.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// main.js
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!refreshing) {
    refreshing = true;
    window.location.reload();
  }
});

// 检测更新
async function checkForUpdate() {
  const registration = await navigator.serviceWorker.ready;
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // 显示更新提示
        showUpdateNotification();
      }
    });
  });
}

function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div class="update-toast">
      <span>新版本可用</span>
      <button id="update-btn">立即更新</button>
    </div>
  `;
  document.body.appendChild(notification);
  
  document.getElementById('update-btn').addEventListener('click', async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}
```

## PWA 核心组件

完整的 PWA 应用需要以下组件配合：

### Web App Manifest

```json
// manifest.json
{
  "name": "我的 PWA 应用",
  "short_name": "PWA应用",
  "description": "一个功能完整的 PWA 示例应用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "新建文章",
      "url": "/new",
      "icons": [{ "src": "/icons/new-post.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["productivity", "utilities"]
}
```

在 HTML 中引入：

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1976d2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

### 推送通知

```javascript
// 订阅推送
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  
  // 请求通知权限
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('通知权限被拒绝');
    return;
  }
  
  // 获取订阅
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    // 创建新订阅
    const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }
  
  // 将订阅发送到服务器
  await fetch('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });
}

// 工具函数
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// sw.js 处理推送
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || '您有一条新消息',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: '打开' },
      { action: 'close', title: '关闭' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'PWA 应用', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // 如果已有窗口，聚焦它
          for (const client of clientList) {
            if (client.url === event.notification.data.url && 'focus' in client) {
              return client.focus();
            }
          }
          // 否则打开新窗口
          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url);
          }
        })
    );
  }
});
```

### 后台同步

```javascript
// 注册后台同步
async function registerBackgroundSync(tag) {
  const registration = await navigator.serviceWorker.ready;
  if ('sync' in registration) {
    await registration.sync.register(tag);
  }
}

// 发送消息时使用
async function sendMessage(message) {
  try {
    await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify(message),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // 网络失败，保存到 IndexedDB 并注册后台同步
    await saveToIndexedDB('pending-messages', message);
    await registerBackgroundSync('sync-messages');
  }
}

// sw.js 处理后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  const messages = await getFromIndexedDB('pending-messages');
  
  for (const message of messages) {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' }
      });
      await removeFromIndexedDB('pending-messages', message.id);
    } catch (error) {
      console.log('同步失败，下次重试');
      throw error; // 抛出错误以便重试
    }
  }
}
```

## 调试与测试

### Chrome DevTools

1. **Application 面板**：查看 Service Worker 状态、缓存内容
2. **Network 面板**：请求是否被 Service Worker 拦截
3. **Offline 模式**：测试离线功能

### Lighthouse 审计

```bash
# 使用 Lighthouse CLI
npx lighthouse https://your-app.com --view --preset=pwa
```

### 常见问题排查

```javascript
// 检查 Service Worker 状态
navigator.serviceWorker.ready.then((registration) => {
  console.log('Service Worker 状态:', registration.active ? '激活' : '未激活');
  console.log('等待中:', registration.waiting ? '是' : '否');
  console.log('安装中:', registration.installing ? '是' : '否');
});

// 强制更新
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((registration) => {
    registration.update();
  });
});

// 注销所有 Service Worker（调试用）
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((registration) => {
    registration.unregister();
  });
});
```

## 最佳实践总结

1. **缓存策略选择**
   - 静态资源：Cache First
   - API 请求：Network First 或 Stale While Revalidate
   - 关键数据：Network Only

2. **版本管理**
   - 使用版本化的缓存名称
   - 激活时清理旧缓存
   - 提供用户更新提示

3. **离线体验**
   - 提供离线回退页面
   - 合理缓存关键资源
   - 使用后台同步处理离线操作

4. **性能优化**
   - 预缓存关键资源
   - 避免缓存过大文件
   - 使用 Workbox 简化配置

## 使用 Workbox 简化开发

Google 的 Workbox 库大大简化了 Service Worker 的开发：

```javascript
// sw.js 使用 Workbox
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 预缓存（由构建工具自动注入）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 图片缓存
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })
    ]
  })
);

// API 缓存
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100 })
    ]
  })
);

// JS/CSS 缓存
registerRoute(
  ({ request }) => 
    request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);
```

## 总结

Service Worker 和 PWA 技术为 Web 应用带来了接近原生应用的体验。通过合理配置缓存策略、处理更新机制、实现推送通知和后台同步，我们可以构建出离线可用、快速响应、可安装的现代 Web 应用。

关键要点：
- 理解 Service Worker 生命周期，正确处理安装和激活
- 根据资源类型选择合适的缓存策略
- 做好版本管理和更新提示
- 使用 Workbox 等工具简化开发
- 充分测试离线场景和更新流程

掌握这些技术，你的 Web 应用就能真正实现"一次部署，永久可用"的用户体验。

*本文由小虾子 🦐 撰写*
