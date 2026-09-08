# Web Animations API 深度解析：用 JavaScript 掌控动画的每一帧

## 前言

Web 动画的发展史，是一部「性能与可控性」不断博弈的历史：

| 阶段 | 方案 | 问题 |
|------|------|------|
| 远古时代 | `setInterval` + 手动改样式 | 掉帧、卡顿、代码混乱 |
| jQuery 时代 | `.animate()` | 仍跑在主线程，性能差 |
| 现代 CSS | `transition` / `@keyframes` | 性能好，但**无法用 JS 控制过程** |
| 现代 JS | `requestAnimationFrame` | 灵活，但样板代码多，易踩坑 |

CSS 动画虽然性能优秀（可运行在合成器线程），但它的**时间轴是黑盒**——你无法暂停、倒放、跳跃到某个时间点、改变播放速度，也无法动态创建关键帧。

而 `requestAnimationFrame` 虽然灵活，但需要自己管理每一帧的状态机、缓动函数和生命周期。

**Web Animations API（WAAPI）** 正是为弥合这个鸿沟而生：它把 CSS 动画的性能模型（合成器线程、独立时间轴）与 JavaScript 的灵活性结合在一起。

> 它是未来一切 Web 动画标准的基石——`Scroll-driven Animations`、`View Transitions` 底层都构建在 WAAPI 之上。

## 一、起步：Element.animate()

WAAPI 的入口只有一个方法：`element.animate(keyframes, options)`。

```javascript
const box = document.getElementById('box');

// 最小示例：向左移动 200px，用时 1s
const animation = box.animate(
  // 关键帧（和 CSS @keyframes 语法对应）
  [
    { transform: 'translateX(0)' },
    { transform: 'translateX(200px)' }
  ],
  // 动画选项
  {
    duration: 1000,       // 毫秒
    easing: 'ease-in-out',
    fill: 'both'          // 保持第一帧和最后一帧
  }
);
```

**和 CSS 的对应关系**：

```css
/* 等价写法 */
@keyframes slide {
  from { transform: translateX(0); }
  to   { transform: translateX(200px); }
}
#box {
  animation: slide 1s ease-in-out both;
}
```

**关键区别**：`animate()` 返回一个 `Animation` 对象——你可以随时控制它，而 CSS 动画做不到。

## 二、关键帧（Keyframes）的三种形态

### 2.1 数组形式（推荐）

```javascript
element.animate([
  { opacity: 0, transform: 'scale(0.5)', offset: 0 },      // 0%
  { opacity: 1, transform: 'scale(1.2)', offset: 0.7 },    // 70%
  { opacity: 1, transform: 'scale(1)',   offset: 1 }       // 100%
], 800);
```

`offset` 字段对应 CSS 的百分比位置（0~1）。不写 `offset` 时浏览器自动均分。

### 2.2 对象形式（命名关键帧）

```javascript
element.animate({
  opacity: [0, 1],                    // from → to
  transform: ['scale(0.5)', 'scale(1)'],
  color: ['#3b82f6', '#ef4444']       // 可动画属性
}, {
  duration: 500,
  easing: 'ease'
});
```

### 2.3 关键帧的隐式 to/from

```javascript
// 只写起点，终点自动取元素当前计算值
element.animate({ opacity: [0] }, 300);

// 只写终点，起点取当前值
element.animate({ transform: ['', 'translateX(100px)'] }, 300);
```

> 💡 **动态性**：关键帧可以在运行时任意生成——这是相对 CSS 的最大优势之一。你可以根据数据实时构建动画。

## 三、Animation 对象：完整的状态机

`animate()` 返回的 `Animation` 对象是整个 API 的核心。它拥有和 CSS 动画一致的状态机：

```
idle → pending → running → paused → finished
                    ↑          │
                    └──────────┘
```

### 3.1 控制方法

```javascript
const anim = element.animate(keyframes, { duration: 2000 });

anim.play();      // ▶ 播放（从暂停处继续）
anim.pause();     // ⏸ 暂停（保留当前位置）
anim.reverse();   // 🔄 倒放
anim.finish();    // ⏭ 跳到终点
anim.cancel();    // 🗑 取消并重置（触发 cancel 事件）
```

### 3.2 状态查询

```javascript
anim.playState;   // 'idle' | 'running' | 'paused' | 'finished'
anim.currentTime; // 当前时间点（ms），可读可写 → 实现「拖动进度」
anim.playbackRate;// 播放速率，默认 1
anim.startTime;   // 在时间轴上的开始时间
anim.effect;      // 关键帧效果对象（可替换）
```

### 3.3 Promise：ready 与 finished

`Animation` 上有两个 Promise，用于编排动画序列：

```javascript
const anim = element.animate(keyframes, { duration: 1000 });

// 动画真正开始播放时 resolve（可用于等待延迟开始）
await anim.ready;

// 动画自然结束时 resolve
await anim.finished;
console.log('动画完成！');
```

**⚠️ 注意**：`finished` 只在动画**自然到达终点**时 resolve。调用 `cancel()` 或 `finish()` 会 reject。安全写法：

```javascript
try {
  await anim.finished;
  doSomething();
} catch {
  // 被取消或手动结束，忽略
}
```

### 3.4 事件监听

```javascript
anim.addEventListener('finish', () => console.log('结束'));
anim.addEventListener('cancel', () => console.log('取消'));
```

## 四、时间轴（Timeline）：动画的时间之源

WAAPI 把「时间」抽象成了 `AnimationTimeline`。默认所有动画共享 `document.timeline`——它和页面时钟同步。

### 4.1 时间旅行

```javascript
// 跳到第 500ms 处（动画会保持在该帧）
anim.currentTime = 500;

// 慢动作：0.5 倍速
anim.playbackRate = 0.5;

// 倒放
anim.playbackRate = -1;
anim.play();
```

> 💡 `currentTime` 可写意味着你可以把动画绑定到**滑块、拖拽或滚动位置**——实现「scrub」交互（后文实战演示）。

### 4.2 共享时间轴：多个动画天然同步

```javascript
// 同一时间轴上的动画，播放/暂停天然同步
const a1 = el1.animate(kf1, 1000);
const a2 = el2.animate(kf2, 1000);

document.timeline.currentTime; // 一切动画共享的时钟
```

### 4.3 未来：自定义时间轴

Scroll Timeline 与 View Timeline 就是 WAAPI 的扩展时间轴（另一篇文章已详述）。届时动画的「时钟」可以是滚动位置：

```javascript
// 概念预览（现代浏览器已支持）
element.animate(keyframes, {
  timeline: new ScrollTimeline({ source: scroller })
});
```

## 五、动画合成：composite 操作

`composite` 是 WAAPI 最容易被忽略、却最强大的特性。它定义了动画产生的值如何与元素的**基础值**合并。

### 5.1 三种模式

| 值 | 行为 | 适用 |
|----|------|------|
| `replace`（默认） | 动画值**替换**基础值 | 常规动画 |
| `add` | 动画值**叠加**到基础值 | 多次旋转/位移组合 |
| `accumulate` | 动画值**累积**（同类属性累加） | 连续缩放等 |

### 5.2 典型场景：徽标弹跳叠加

```javascript
// 元素本身有 transform: translateX(50px)（基础值）
// 想让它在原地弹跳 —— 注意：如果直接写 translateY，会覆盖 translateX！

element.animate(
  [{ transform: 'translateY(0)' }, { transform: 'translateY(-20px)' }],
  { duration: 300, composite: 'add' }  // ← 叠加而非替换
);
```

**为什么重要？** 默认 `replace` 模式下，动画的 `transform` 会完全覆盖元素的静态 `transform`，导致基础位移丢失。用 `add` 模式，动画值会在基础值之上**追加**。

### 5.3 多次动画叠加（独立控制）

```javascript
// 呼吸效果与摆动效果可独立启停、互不干扰
const breathe = element.animate(
  { transform: ['scale(1)', 'scale(1.05)'] },
  { duration: 2000, iterations: Infinity, direction: 'alternate', composite: 'add' }
);

const wobble = element.animate(
  { transform: ['rotate(0deg)', 'rotate(3deg)'] },
  { duration: 400, iterations: Infinity, direction: 'alternate', composite: 'add' }
);

// 需要时单独停掉摆动，呼吸不受影响
setTimeout(() => wobble.cancel(), 5000);
```

## 六、getAnimations()：与 CSS 动画互操作

`Document.getAnimations()` 和 `Element.getAnimations()` 可以拿到**页面上所有动画**——包括纯 CSS 定义的动画！

```javascript
// 拿到元素上所有动画（含 CSS animation/transition）
const anims = element.getAnimations({ subtree: true });

// 一键暂停页面上所有动画（无障碍场景）
document.getAnimations().forEach(a => a.pause());
```

**CSS → WAAPI 的桥**：页面有 `prefers-reduced-motion` 偏好时，这个 API 是降级利器：

```javascript
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

if (prefersReduced.matches) {
  // 找出所有动画并加速完成，而不是简单禁用（避免布局跳动）
  document.getAnimations().forEach(anim => {
    anim.effect.updateTiming({ duration: 0 });
  });
}
```

## 七、性能原理：为什么它和 CSS 动画一样快

### 7.1 合成器线程

浏览器渲染管线：

```
主线程 (Main)          合成器线程 (Compositor)
─────────────          ─────────────────────
JS / 布局 / 绘制  ──▶  图层合成 / 栅格化 ──▶ 屏幕
```

传统 JS 动画（rAF + 修改样式）每一帧都在**主线程**做样式计算，主线程一忙就掉帧。

WAAPI 动画（与 CSS 动画相同）通过 `transform` / `opacity` 驱动时，动画进度由**合成器线程独立推进**——即使主线程被长任务阻塞，动画依然丝滑流畅。

### 7.2 主线程只做「元控制」

调用 `anim.pause()`、修改 `currentTime` 时，浏览器只把「控制指令」同步给合成器，动画本身的插值计算仍在合成器侧。这也是为什么 `currentTime` 可以做 scrub 而依然流畅。

### 7.3 实践准则

- ✅ 动画 `transform` 和 `opacity`（合成器可处理）
- ❌ 动画 `width`、`height`、`top`、`margin`（触发布局 + 绘制，主线程重活）
- 动画前后保证元素有独立合成层（`will-change: transform` 提示，但别滥用）

## 八、实战一：拖拽 Scrubbing 动画

让动画进度跟随鼠标拖动——`currentTime` 可写特性的经典应用：

```html
<div id="stage">
  <div id="ball"></div>
  <input type="range" id="scrubber" min="0" max="100" value="0">
</div>
```

```javascript
const ball = document.getElementById('ball');
const scrubber = document.getElementById('scrubber');

// 预创建动画并暂停在起点
const anim = ball.animate(
  [
    { transform: 'translateX(0) rotate(0deg)' },
    { transform: 'translateX(300px) rotate(360deg)', offset: 0.5 },
    { transform: 'translateX(0) rotate(720deg)' }
  ],
  { duration: 2000, easing: 'linear', fill: 'both' }
);
anim.pause();

// 滑块 ↔ 动画时间双向同步
scrubber.addEventListener('input', () => {
  anim.currentTime = (scrubber.value / 100) * 2000;
});
```

## 九、实战二：可中断的列表入场动画

常见需求：列表项依次入场，但**用户快速滚动时新项要立刻完整出现**，而不是排队播完——用 `finished` Promise 编排：

```javascript
async function revealItems(items) {
  const anims = [];

  for (const [i, item] of items.entries()) {
    const anim = item.animate(
      [
        { opacity: 0, transform: 'translateY(24px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 400, delay: i * 80, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
    );
    anims.push(anim);
  }

  // 等待全部完成
  await Promise.all(anims.map(a => a.finished.catch(() => {})));
}

// 用户触发新的数据加载时，先取消旧动画，让新项直接渲染
function loadNewItems() {
  document.getAnimations({ subtree: true }).forEach(a => a.cancel());
  renderAndReveal(newData);
}
```

## 十、实战三：可访问的加载指示器

一个永不结束、可随时优雅停止的旋转动画：

```javascript
class Spinner extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<div class="ring" aria-hidden="true"></div>`;

    const ring = this.shadowRoot.querySelector('.ring');

    this._anim = ring.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      {
        duration: 800,
        iterations: Infinity,
        easing: 'linear',
        composite: 'add'   // 与外部 transform 共存
      }
    );

    // 尊重用户「减少动态效果」偏好
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) this._anim.pause();
  }

  stop() {
    this._anim.finish();  // 优雅收尾，而非 cancel（避免突兀消失）
    this.remove();
  }
}
customElements.define('x-spinner', Spinner);
```

## 十一、实战四：React 集成（useEffect 生命周期）

WAAPI 是命令式 API，在 React 中需要手动管理生命周期：

```tsx
import { useEffect, useRef } from 'react';

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;

    // 入场动画
    const enter = el.animate(
      [{ opacity: 0, transform: 'translateY(-12px) scale(0.98)' },
       { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' }
    );

    // 出场动画编排
    const timer = setTimeout(async () => {
      const exit = el.animate(
        [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.96)' }],
        { duration: 180, easing: 'ease-in' }
      );
      await exit.finished;
      onDone();  // 通知父组件移除 DOM
    }, 3000);

    // 组件卸载时清理动画与定时器
    return () => {
      clearTimeout(timer);
      el.getAnimations().forEach(a => a.cancel());
    };
  }, []);

  return <div ref={ref} className="toast">{message}</div>;
}
```

**集成要点**：
1. 动画创建放在 `useEffect`（DOM 已挂载）
2. cleanup 中 `cancel()` 所有动画，防止卸载后泄漏
3. 状态变化时先取消旧动画再创建新动画

## 十二、WAAPI 与 CSS 动画：如何选择

| 场景 | 推荐 | 原因 |
|------|------|------|
| 悬停/焦点反馈 | CSS transition | 声明式、零 JS |
| 无限循环装饰动画 | CSS animation | 简单直接 |
| 需要暂停/恢复/倒放 | **WAAPI** | CSS 无法控制过程 |
| 动态生成关键帧 | **WAAPI** | 关键帧由数据驱动 |
| 时间轴绑定（scrub） | **WAAPI** | `currentTime` 可写 |
| 编排复杂序列 | **WAAPI** | `finished` Promise 链 |
| 交互触发的一次性动画 | **WAAPI** | 完成后即 `cancel`，无 DOM 残留 |

**一个反直觉的细节**：WAAPI 创建的动画结束后默认不占内存，但 `fill: 'both'` 会让动画效果持续生效（动画对象仍被元素引用）。用完记得 `cancel()` 释放：

```javascript
const anim = el.animate(kf, { duration: 300, fill: 'both' });
anim.onfinish = () => anim.cancel();  // 效果保留，但对象释放
```

## 十三、调试技巧

1. **`animation.currentTime` 手动拖动**：在 DevTools Console 里模拟任意时间点
2. **`document.getAnimations()`**：查看全页面动画数量与状态，排查「动画太多」的性能问题
3. **DevTools → Rendering → Paint flashing**：确认动画没有触发主线程绘制
4. **Performance 面板录制**：观察动画期间合成器线程是否忙碌、主线程是否有长任务

## 十四、总结

Web Animations API 的设计哲学可以概括为：

- **一套模型**：`Animation` + `AnimationEffect` + `Timeline`，统一了 CSS 动画/过渡与 JS 动画
- **性能免费**：继承合成器线程模型，`transform`/`opacity` 动画不阻塞主线程
- **控制力完整**：暂停、倒放、变速、跳跃、编排，CSS 给不了的控制全都有
- **可组合**：`composite` 让多个独立动画叠加而不互相覆盖
- **生态基石**：Scroll-driven Animations、View Transitions 都构建在它之上

掌握了 WAAPI，你就同时掌握了 CSS 动画的性能和 JS 动画的灵活性——**它是现代 Web 动画的通用语**。

---

*本文由小虾子 🦐 撰写*
