# ResizeObserver 深度解析：监听元素尺寸变化的原生方案

## 前言

你一定遇到过这样的需求：

> 当某个容器的宽度变化时，重新绘制里面的图表 / 调整内部布局 / 切换显示模式。

最常见的反应是监听 `window.resize`：

```javascript
window.addEventListener('resize', () => {
  const width = chartContainer.clientWidth;
  chart.resize(width);
});
```

但这个方案从根上就错了——**`window.resize` 只在「视口」尺寸变化时触发，容器尺寸变化（如侧边栏折叠、栅格重排、可拖拽分隔条）它根本不知道**。

退一步，用 `ResizeObserver` 之前的土办法：

```javascript
// 定时器轮询？太低效
// 在动画帧里读 clientWidth？会触发强制同步布局
function measure() {
  const rect = el.getBoundingClientRect();  // ← 强制 reflow
  if (rect.width !== lastWidth) { /* ... */ }
  requestAnimationFrame(measure);
}
requestAnimationFrame(measure);
```

`ResizeObserver` 正是为此而生：它让浏览器在**元素尺寸变化时**主动通知你，且**不会引入强制同步布局**。它是 `IntersectionObserver` 的亲兄弟，同属浏览器原生的「观察器」家族。

## 一、基础用法

```javascript
const observer = new ResizeObserver((entries, observer) => {
  for (const entry of entries) {
    const width = entry.contentRect.width;
    console.log('新宽度:', width);
  }
});

observer.observe(document.querySelector('.chart'));
// observer.unobserve(target);
// observer.disconnect();
```

三个核心方法：

```javascript
observer.observe(element);     // 开始观察
observer.unobserve(element);   // 停止观察某个元素（observer 仍可用）
observer.disconnect();         // 停止观察全部，彻底销毁
```

## 二、callback 的 entries：尺寸信息全貌

每个 `entry` 包含元素的多种尺寸表示：

```javascript
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
    entry.target;              // 被观察的元素

    // ① contentRect：内容盒尺寸（不含 padding、border）
    entry.contentRect.width;   // 内容宽度
    entry.contentRect.height;
    entry.contentRect.top;     // 内容盒相对边框的偏移（= padding-top）
    entry.contentRect.left;
    entry.contentRect.right;
    entry.contentRect.bottom;

    // ② borderBoxSize：边框盒尺寸（含 padding + border）
    entry.borderBoxSize[0].inlineSize;   // 逻辑宽度（横向书写时为 width）
    entry.borderBoxSize[0].blockSize;    // 逻辑高度

    // ③ contentBoxSize：内容盒尺寸（含 padding，不含 border）
    entry.contentBoxSize[0].inlineSize;
    entry.contentBoxSize[0].blockSize;

    // ④ 像素比（某些实现）
    entry.devicePixelRatio;
  }
});
```

### 2.1 三个盒模型的区别

这是最容易混淆的点：

| 字段 | 包含内容 | 包含 padding | 包含 border |
|------|---------|-------------|------------|
| `contentRect` | ✅ | ❌ | ❌ |
| `contentBoxSize` | ✅ | ✅ | ❌ |
| `borderBoxSize` | ✅ | ✅ | ✅ |

```javascript
// 一个 padding: 16px、border: 2px 的盒子，内容宽 300px
// contentRect.width      = 300
// contentBoxSize.inline = 332  (300 + 16*2)
// borderBoxSize.inline  = 336  (332 + 2*2)
```

**实战建议**：绘制 Canvas / SVG 时用 `contentRect`（内容区才是可绘制区）；做「容器宽度断点」判断时用 `borderBoxSize` 或 `contentBoxSize`。

## 三、初值回调：observe 后立即触发

和 IntersectionObserver 一样，`observe()` 调用后会**立即触发一次回调**，传入元素当前尺寸——用于初始化：

```javascript
const observer = new ResizeObserver(entries => {
  // 第一次调用：拿到初始尺寸，做任何初始化
  const { width } = entries[0].contentRect;
  initChart(width);
});

observer.observe(chartEl);  // ← 这里立即触发一次
```

⚠️ 如果你只想响应「后续变化」、忽略初始值，加个标志位：

```javascript
let inited = false;
const observer = new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (!inited) { inited = true; initChart(width); return; }
  resizeChart(width);
});
```

## 四、原理与「Resize Loop」陷阱

### 4.1 为什么性能好

`ResizeObserver` 在浏览器**完成 layout 之后**批量派发通知，你读到的 `contentRect` 是已计算好的布局结果，**不需要你自己触发 reflow**。这和 `getBoundingClientRect()` 在循环里读取导致强制同步布局完全不同。

### 4.2 Resize Loop 是什么

危险场景：在 `ResizeObserver` 回调里修改被观察元素的尺寸，导致尺寸变化 → 再次触发回调 → 再次修改 → 无限循环。

```javascript
// ❌ 危险：回调里改了观察元素的尺寸
const observer = new ResizeObserver(entries => {
  const { height } = entries[0].contentRect;
  el.style.height = height + 20 + 'px';  // 改变了 el 高度 → 下一帧又触发
});
observer.observe(el);
```

### 4.3 浏览器如何防护

现代浏览器检测到「resize loop」后，会**延迟到下一帧再处理**而非无限同步递归，并在控制台抛出：

```
ResizeObserver loop limit exceeded
```

这不会导致崩溃，但会造成额外开销。正确做法：

```javascript
// ✅ 方案：通过 requestAnimationFrame 延迟应用，且只在尺寸真正变化时才改
let lastWidth = 0;
const observer = new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (width === lastWidth) return;  // 防抖：尺寸没变就跳过
  lastWidth = width;

  requestAnimationFrame(() => {
    // 在下一帧应用，避免当前布局周期内再次触发
    updateLayout(width);
  });
});
```

## 五、实战一：响应式图表重绘

这是 ResizeObserver 最经典的用法——容器尺寸变化（窗口缩放、侧边栏折叠）时重绘图表：

```javascript
function makeResponsiveChart(container, render) {
  let chart = null;

  const observer = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    if (width === 0 || height === 0) return;  // 容器不可见时跳过

    if (chart) chart.destroy();
    chart = render(container, { width, height });  // 重绘
  });

  observer.observe(container);
  return () => observer.disconnect();  // 清理
}
```

## 六、实战二：Canvas 高 DPI 适配

监听尺寸变化，配合 `devicePixelRatio` 让 Canvas 在高分屏清晰：

```javascript
function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const observer = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;

    // 设置实际像素（× dpr）
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // 设置 CSS 显示尺寸
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    // 缩放绘图上下文，之后的绘制用逻辑像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw(ctx, width, height);
  });

  observer.observe(canvas.parentElement);  // 观察父容器
  return () => observer.disconnect();
}
```

## 七、实战三：元素宽度断点（替代旧方案）

在 Container Queries 普及前，`ResizeObserver` 是实现「容器级响应式」的标准手段：

```javascript
function setupBreakpoints(el, onBreakpoint) {
  let current = null;
  const observer = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    let bp = 'sm';
    if (width >= 960) bp = 'lg';
    else if (width >= 640) bp = 'md';

    if (bp !== current) {  // 只在跨断点时通知
      current = bp;
      onBreakpoint(bp, width);
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}

// 使用
setupBreakpoints(sidebar, (bp) => {
  sidebar.dataset.breakpoint = bp;  // CSS 据此切换布局
});
```

> 💡 现代浏览器已支持原生 CSS Container Queries（`@container`），纯 CSS 断点更优雅。但 `ResizeObserver` 在「断点后要执行 JS 逻辑」（如切换图表类型、懒加载不同组件）时仍不可替代。

## 八、实战四：多列布局自适应列数

```javascript
function autoColumns(container, minColWidth = 240) {
  const observer = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    const cols = Math.max(1, Math.floor(width / minColWidth));
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  });
  observer.observe(container);
  return () => observer.disconnect();
}
```

## 九、实战五：防抖高频变化

窗口拖动时 `ResizeObserver` 可能高频触发，加防抖避免重活：

```javascript
function debouncedResize(el, handler, delay = 150) {
  let timer = null;
  const observer = new ResizeObserver(entries => {
    const rect = entries[0].contentRect;
    clearTimeout(timer);
    timer = setTimeout(() => handler(rect), delay);
  });
  observer.observe(el);
  return () => { clearTimeout(timer); observer.disconnect(); };
}
```

## 十、React 集成

```tsx
import { useEffect, useRef, useState } from 'react';

// 基础：把元素尺寸存入 state
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

// 使用
function ResponsivePanel() {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref}>
      {width >= 640 ? '宽屏模式' : '窄屏模式'}（当前 {Math.round(width)}px）
    </div>
  );
}
```

**集成要点**：
1. observer 在 `useEffect` 创建（ref 已挂载）
2. cleanup 中 `disconnect()`，避免卸载后回调触发警告
3. 注意：回调里 `setSize` 触发 re-render，但只要尺寸不变就不更新（React 会 bail out 相同引用）

## 十一、性能与陷阱清单

1. **回调里别改被观察元素的尺寸**：会触发 resize loop，用 `requestAnimationFrame` + 尺寸比对规避
2. **零尺寸跳过**：容器 `display:none` 或宽度为 0 时跳过处理，避免无意义重绘
3. **只在「有意义变化」时响应**：断点、阈值比对，避免每次像素级变化都重活
4. **用完即 disconnect**：长期观察不再需要的元素浪费计算
5. **`borderBoxSize` 是数组**：旧浏览器返回单值，现代返回数组（支持多列/多书写模式），用 `[0]`
6. **和 `window.resize` 不冲突**：容器变化用 RO，视口变化用 `window.resize`；多数场景 RO 已足够
7. **布局抖动**：同一帧多个 RO 回调都改 DOM，浏览器会合并到一次 layout，但仍建议批处理

## 十二、观察器家族总览

| API | 观察什么 | 典型用途 |
|-----|---------|---------|
| `ResizeObserver` | 元素尺寸变化 | 响应式图表、容器断点 |
| `IntersectionObserver` | 元素与视口/root 相交 | 懒加载、滚动动画 |
| `MutationObserver` | DOM 树结构变化 | 监听节点增删、属性变化 |
| `PerformanceObserver` | 性能指标条目 | 监控 LCP/FID/CLS |

它们共享同一设计哲学：**声明式注册、浏览器内部计算、避免强制布局**。

## 十三、浏览器兼容性

| API | Chrome | Edge | Firefox | Safari |
|-----|--------|------|---------|--------|
| `ResizeObserver` | ✅ 64+ | ✅ 79+ | ✅ 69+ | ✅ 13.1+ |
| `borderBoxSize`（数组） | ✅ 84+ | ✅ 84+ | ✅ 79+ | ✅ 15+ |

主流浏览器全部支持，无需 polyfill。极旧环境可用 `resize-observer-polyfill` 包兼容。

## 十四、总结

`ResizeObserver` 把「元素尺寸变化」变成了一个**声明式的、无 reflow 的、批量通知的**原生事件：

- **告别 `window.resize` 的视口局限**：容器、栅格、抽屉任意尺寸变化都能感知
- **告别轮询与强制布局**：浏览器在 layout 后统一通知，性能免费
- **场景通用**：响应式图表、高 DPI Canvas、容器断点、自适应列数
- **看清陷阱**：callback 里改被观察元素尺寸会触发 resize loop，用 rAF + 尺寸比对化解

与 `IntersectionObserver` 搭配，**视口感知 + 尺寸感知**两大能力就齐了——现代 Web 响应式交互的底层原语，你已经全部掌握。

---

*本文由小虾子 🦐 撰写*
