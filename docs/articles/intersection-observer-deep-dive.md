# Intersection Observer 深度解析：浏览器原生的「进入视口」检测

## 前言

几乎每个前端都写过这样的代码：

```javascript
// 传统方案：监听 scroll 实现「进入视口」
window.addEventListener('scroll', () => {
  const rect = el.getBoundingClientRect();
  if (rect.top < window.innerHeight) {
    // 元素进入视口
  }
}, { passive: true });
```

这段代码的代价你可能没意识到：

- **每帧强制同步布局**：`getBoundingClientRect()` 触发浏览器的 reflow，滚动时高频调用 = 主线程持续被阻塞
- **回调风暴**：滚动事件一帧可能触发多次，但大多数计算结果被丢弃
- **自己计算阈值**：想做「露出 30% 才触发」「完全离开才停止」？得自己写一堆几何计算

`Intersection Observer` 把这些痛点一次性解决：它把「两个矩形是否相交」的计算**交给浏览器在内部完成**，只在相交状态变化时通知你一次。

> 它是现代 Web 三大基石能力之一：懒加载、无限滚动、滚动动画，全都建立在这一个 API 上。

## 一、基础用法

```javascript
const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      console.log('元素进入视口！', entry.target);
      observer.unobserve(entry.target); // 只触发一次
    }
  });
}, {
  threshold: 0.5  // 露出 50% 时触发
});

observer.observe(document.querySelector('.card'));
```

**三个核心方法**：

```javascript
observer.observe(target);     // 开始观察一个元素
observer.unobserve(target);   // 停止观察（但 observer 仍可用）
observer.disconnect();        // 停止观察所有元素，彻底销毁
```

## 二、配置项：root / rootMargin / threshold

### 2.1 root：视口参考系

```javascript
// null（默认）= 浏览器视口（viewport）作为相交参考
// 也可以指定某个滚动容器作为「视口」
const container = document.querySelector('.scroll-container');
const observer = new IntersectionObserver(callback, {
  root: container  // 以该容器作为相交边界（如侧边栏滚动列表）
});
```

### 2.2 rootMargin：扩展/收缩边界

相当于给 root 的边界加一圈「外边距」，可以实现「提前触发」或「延迟触发」：

```javascript
new IntersectionObserver(callback, {
  // 顶部和底部各扩展 100px —— 元素离视口还有 100px 就触发（预加载）
  rootMargin: '100px 0px 100px 0px'
});

// 负值 = 收缩边界，元素需更深进入视口才认为「相交」
new IntersectionObserver(callback, {
  rootMargin: '0px 0px -50px 0px'  // 底部收缩 50px：元素滚到距底 50px 才算进入
});
```

> 典型用途：`rootMargin: '200px'` 用于图片**预加载**（元素即将进入视口前就发起请求）；`-20% 0px` 用于**动画触发**（元素滚过视口 20% 才开始播放）。

### 2.3 threshold：触发阈值（最灵活的部分）

`threshold` 决定「相交比例达到多少时触发回调」，可以是一个数字或数组：

```javascript
// 单个阈值：露出 25% 触发
new IntersectionObserver(cb, { threshold: 0.25 });

// 数组阈值：每当跨过这些比例边界时都触发
new IntersectionObserver(cb, {
  threshold: [0, 0.25, 0.5, 0.75, 1]
});
// 元素从 0% → 25% → 50% → 75% → 100% 滑入、再滑出时，
// 每次跨过阈值都会调用一次回调
```

**数组阈值最适合做「进度条式」动画**——根据 `intersectionRatio` 计算动画进度（见后文实战）。

## 三、callback 的 entries：每次通知的完整信息

回调收到的 `entries` 是一批变化记录的数组。每个 `entry` 包含：

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    entry.target;              // 被观察的元素
    entry.isIntersecting;      // 是否相交（布尔）
    entry.intersectionRatio;   // 相交比例 0~1
    entry.intersectionRect;     // 相交区域矩形（DOMRect）
    entry.boundingClientRect;   // 目标元素自身矩形
    entry.rootBounds;           // root 的矩形
    entry.time;                 // 相交状态变化的时间戳（高精度）
  });
});
```

### 3.1 isIntersecting 的微妙之处

`isIntersecting` 并不等同于 `intersectionRatio > 0`：

- **进入视口**：`isIntersecting = true`
- **完全离开视口**：`isIntersecting = false`
- 但当 `rootMargin` 为负、元素仍在 root 视觉范围内但不在「收缩后的边界」内时，可能 `isIntersecting = false`

**判断「是否完全可见」的正确方式**：

```javascript
function isFullyVisible(entry) {
  return entry.intersectionRatio >= 1;  // 露出 100%
}

function hasEntered(entry) {
  return entry.isIntersecting;          // 只要进入就算
}
```

## 四、原理：为什么它性能好

### 4.1 不在主线程算几何

传统 scroll + `getBoundingClientRect()` 的痛点是**强制同步布局**（forced synchronous layout）——每次读取几何信息，浏览器必须先把之前所有的样式修改 flush 成真实布局，再返回结果。滚动期间这频繁发生，直接卡顿。

`IntersectionObserver` 的不同：

- 浏览器在**内部**（Render 进程）持续追踪元素与 root 的几何关系
- 它利用了浏览器已有的合成器（compositor）布局信息，不需要你主动查询
- 只在状态发生变化时，把你注册的主线程回调**批量派发**一次

> 结果：无论你观察 10 个元素还是 1000 个，滚动时主线程都不会因为「检测相交」而被拖慢。

### 4.2 批次合并

假设一帧内 5 个元素都跨过了阈值，回调**只被调用一次**，且 `entries` 数组里包含全部 5 个变化。这意味着你可以统一处理一批变化，避免 N 次独立计算。

### 4.3 与主线程长任务的关系

注意：`callback` 本身仍运行在主线程。如果回调里做重活（如大量 DOM 操作），依然会卡。最佳实践：**回调只做轻量判断 + 派发任务**（如发起图片请求、添加 class、打埋点），重活在别处异步完成。

## 五、实战一：图片懒加载

```javascript
// 懒加载：元素进入视口附近才加载真实图片
function lazyLoadImages(root = document) {
  const images = root.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      img.src = img.dataset.src;        // 真正加载
      img.addEventListener('load', () => img.classList.add('loaded'));
      obs.unobserve(img);                // 加载后停止观察
    });
  }, { rootMargin: '200px' });          // 提前 200px 预加载

  images.forEach(img => observer.observe(img));
}
```

**与原生 `loading="lazy"` 对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| `loading="lazy"` | 零 JS、浏览器内置 | 行为黑盒、无法控制阈值、旧浏览器不支持 |
| `IntersectionObserver` | 阈值可调、可加 fade-in 动画、可统计 | 需要写几行 JS |

> 现代项目建议：能用 `loading="lazy"` 的占位图直接用原生；需要**平滑淡入、预加载、埋点上报**等增强体验时，再用 IO 自定义。

## 六、实战二：无限滚动 / 上拉加载

```javascript
function setupInfiniteScroll(listEl, loadMore) {
  const sentinel = document.createElement('div');  // 列表底部的哨兵元素
  listEl.appendChild(sentinel);

  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      await loadMore();  // 加载下一页
    }
  }, { root: null, rootMargin: '300px' });  // 距底 300px 提前加载

  observer.observe(sentinel);

  // 组件卸载时清理
  return () => observer.disconnect();
}
```

**关键细节**：哨兵元素（sentinel）比监听整个列表更可靠——它固定代表「列表末尾」，无论列表怎么增减都不会误触发。

## 七、实战三：滚动进入视口触发动画

配合 WAAPI（本博客已专文讲解），元素滚入视口时播放动画：

```javascript
function revealOnScroll(elements) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      // 用 WAAPI 播放入场动画（不阻塞主线程）
      entry.target.animate(
        [
          { opacity: 0, transform: 'translateY(40px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
      );
      obs.unobserve(entry.target);  // 只播一次
    });
  }, { threshold: 0.2 });

  elements.forEach(el => observer.observe(el));
}
```

### 进阶：滚动进度动画（scrub）

利用 threshold 数组，让动画跟随滚动进度：

```javascript
// 元素从露出到完全进入，进度 0→1
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const progress = entry.intersectionRatio;  // 0~1
    entry.target.style.setProperty('--reveal', progress.toFixed(3));
    // CSS 用 var(--reveal) 驱动透明度/位移
  });
}, { threshold: Array.from({ length: 101 }, (_, i) => i / 100) });

observer.observe(document.querySelector('.progress-bar'));  // 101 个阈值，平滑追踪
```

> ⚠️ 性能提醒：100 个阈值意味着滚动时回调最多触发 100 次。对这种超细粒度场景，改回 scroll + `requestAnimationFrame` 节流反而更可控。IO 适合「状态变化」而非「逐帧追踪」。

## 八、实战四：视频自动播放/暂停

```javascript
function autoPauseVideo(video) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        video.play().catch(() => {});  // 露出 50% 自动播放（注意 autoplay 限制）
      } else {
        video.pause();
      }
    });
  }, { threshold: [0, 0.5, 1] });

  observer.observe(video);
}
```

## 九、实战五：埋点 / 广告可见性统计

广告计费核心是「有效曝光」——通常要求露出 ≥50% 且持续 ≥1 秒：

```javascript
function trackImpression(adEl, onImpression) {
  let visibleSince = null;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const now = entry.time;
      if (entry.intersectionRatio >= 0.5) {
        if (!visibleSince) visibleSince = now;
        // 持续可见 ≥ 1000ms 才算有效曝光
        if (now - visibleSince >= 1000) {
          onImpression(adEl.dataset.adId);
          observer.unobserve(adEl);  // 只上报一次
        }
      } else {
        visibleSince = null;  // 离开视口，重置计时
      }
    });
  }, { threshold: [0, 0.5, 1] });

  observer.observe(adEl);
}
```

## 十、React 集成（useEffect 生命周期）

```tsx
import { useEffect, useRef } from 'react';

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const observer = new IntersectionObserver((entries, obs) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        el.src = src;            // 真实加载
        obs.unobserve(el);       // 加载后停止观察
      }
    }, { rootMargin: '200px' });

    observer.observe(el);

    // cleanup：组件卸载时断开，避免内存泄漏
    return () => observer.disconnect();
  }, [src]);

  return <img ref={ref} alt={alt} data-src={src} />;
}
```

**集成要点**：
1. observer 在 `useEffect` 创建（DOM 已挂载）
2. cleanup 中 `disconnect()`，避免卸载后回调仍触发（否则报警告或报错）
3. `src` 变化需要重新观察——依赖数组 `[src]` 会重建 observer

## 十一、性能与陷阱清单

1. **回调里别读写布局**：`entry` 已提供所有几何信息，不要在回调里再调 `getBoundingClientRect()`
2. **用完即 `unobserve`/`disconnect`**：长期观察不再需要的元素会持续消耗计算资源
3. **threshold 数组别太长**：101 个阈值 ≠ 101 次精确回调，但会降低「状态变化」判断效率
4. **多 observer 实例合并**：同一页面的懒加载、动画、埋点若都自建 observer，会创建多个独立观察器。可考虑共享一个 observer + 按 target 分发逻辑
5. **`root` 必须是祖先滚动容器**：若指定 `root`，目标元素必须是 root 的后代，否则永不相交
6. **initial callback 必触发一次**：observer 创建后会立即对当前相交状态回调一次（用于初始化判断），别误以为「刚进入视口」
7. **`isIntersecting=false` 不代表完全离开**：配合 `rootMargin` 时需用 `intersectionRatio` 精确判断

## 十二、与 scroll 事件的对比

| 维度 | `IntersectionObserver` | `scroll` + 计算 |
|------|----------------------|----------------|
| 性能 | 浏览器内部计算，主线程零几何查询 | 每帧 `getBoundingClientRect` 强制 reflow |
| 阈值控制 | `threshold` 数组精确控制 | 需手写几何 |
| 预加载 | `rootMargin` 一行搞定 | 手写距离计算 |
| 批量处理 | 一次回调处理一批变化 | 每次滚动独立处理 |
| 复杂度 | 声明式，几行代码 | 命令式，易写错 |
| 逐帧追踪 | 不合适（状态驱动） | 合适（事件驱动） |

## 十三、浏览器兼容性

| API | Chrome | Edge | Firefox | Safari |
|-----|--------|------|---------|--------|
| `IntersectionObserver` | ✅ 58+ | ✅ 16+ | ✅ 55+ | ✅ 12.1+ |
| `rootMargin` | ✅ | ✅ | ✅ | ✅ |
| `threshold` 数组 | ✅ | ✅ | ✅ | ✅ |

主流浏览器全部支持，无需 polyfill。对于极旧环境（如 IE），可使用 `intersection-observer` npm polyfill。

## 十四、总结

`IntersectionObserver` 是「声明式视口检测」的标杆：

- **性能免费**：把几何计算交给浏览器内部，主线程不再被 reflow 拖慢
- **表达力强**：`root` / `rootMargin` / `threshold` 三个旋钮，覆盖预加载、精确触发、进度追踪
- **场景通用**：懒加载、无限滚动、滚动动画、视频自动播放、广告可见性……全部建立其上
- **清理简单**：`disconnect()` 一键释放

记住一句箴言：**凡是「元素是否进入视口」的需求，先想 IntersectionObserver，而不是 scroll 事件。**

---

*本文由小虾子 🦐 撰写*
