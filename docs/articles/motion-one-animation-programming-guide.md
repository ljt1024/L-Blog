# Motion One 动画编程实战：浏览器动画的正确打开方式

> CSS 动画够用吗？够。但当你需要链式动画、手势驱动、复杂时序控制时，CSS 动画就开始力不从心了。Motion One 是目前最优雅的 Web 动画解决方案——基于 Waapi（Web Animations API），但比原生 API 好用 100 倍。

<!-- more -->

## 为什么不用 CSS 动画？

CSS 动画的问题：

1. **无法精确控制播放状态**——你无法轻易暂停、倒放、控制到某个百分比
2. **链式动画极难实现**——需要 JavaScript + setTimeout 配合，代码丑陋
3. **与手势/滚动绑定复杂**——scroll-driven animation 浏览器支持尚不完全
4. **动画完成没有可靠回调**——`animationend` 事件容易丢失

```css
/* CSS 动画：只能写死，无法动态控制 */
@keyframes slideIn {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

.box {
  animation: slideIn 0.5s ease-out;
  /* 无法暂停、无法控制播放速度、无法倒放 */
}
```

## Motion One 是什么？

Motion One 是一个**声明式动画库**，基于 Web Animations API 构建，压缩后仅 **3.8KB**。

```bash
# 安装
npm install motion
# 或
bun add motion
```

```typescript
import { animate, spring, timeline } from "motion";
```

## 基础动画：animate

```typescript
// 基础用法：让元素从 A 状态运动到 B 状态
const box = document.querySelector(".box")!;

animate(box, { opacity: 0, x: 100 }, { duration: 0.5 });
```

### 基本参数

```typescript
// 完整参数
animate(
  element,                    // 目标元素（支持选择器字符串）
  {
    // 起始/结束状态（与 CSS 属性一一对应）
    opacity: [1, 0],          // [from, to]
    x: [0, 200],
    rotate: [0, 360],
    scale: [1, 1.2, 1],       // 支持三段式：进入→停留→离开
  },
  {
    duration: 0.8,            // 动画时长（秒）
    easing: [0.33, 1, 0.68, 1], // 缓动函数（贝塞尔曲线）
    delay: 0.2,               // 延迟（秒）
    direction: "alternate",    // alternate | reverse | normal
    iterations: 2,            // 重复次数（Infinity 表示无限）
    fill: "forwards",         // 动画结束后保持结束状态
  }
);
```

### 支持的属性类型

```typescript
// 数值类型（number）
animate(element, { opacity: [1, 0], x: [0, 100] });

// 带单位数值
animate(element, { width: ["0px", "200px"], height: ["0px", "100px"] });

// 颜色（hex / rgb / hsl）
animate(element, { backgroundColor: ["#fff", "#4F8EF7"] });

// 变换（最推荐，性能最好）
animate(element, { x: 200, scale: 1.2, rotate: 45 });

// 多个属性
animate(element, {
  opacity: [0, 1],
  y: [40, 0],
  scale: [0.95, 1],
}, { duration: 0.6, easing: "ease-out" });
```

## 缓动函数

Motion One 内置了常用缓动曲线，也支持自定义贝塞尔曲线：

```typescript
import { easing } from "motion";

// 内置曲线
animate(element, { x: 200 }, { easing: easing.linear });
animate(element, { x: 200 }, { easing: easing.easeIn });
animate(element, { x: 200 }, { easing: easing.easeOut });
animate(element, { x: 200 }, { easing: easing.easeInOut });

// 弹跳效果（最常用的物理感曲线）
animate(element, { x: 200 }, { easing: easing.bounceOut });
animate(element, { x: 200 }, { easing: easing.bounceInOut });

// 弹性效果
animate(element, { x: 200 }, { easing: easing.anticipate });

// 自定义贝塞尔曲线（与 CSS cubic-bezier 一致）
animate(element, { x: 200 }, { easing: [0.33, 1, 0.68, 1] });
```

### 缓动曲线对照表

| 名称 | 效果 | 适合场景 |
|------|------|---------|
| `linear` | 匀速 | 进度条、数值滚动 |
| `easeIn` | 缓入 | 元素入场、快速甩出 |
| `easeOut` | 缓出 | 元素退场、减速停止 |
| `easeInOut` | 缓入缓出 | 开关、状态切换 |
| `bounceOut` | 弹跳出 | 吐司提示、飞入飞出 |
| `anticipate` | 预判反弹 | 拖拽释放、按钮点击 |
| `spring` | 弹簧物理 | 拖拽、交互动画 |

## 弹簧动画（Spring）

弹簧动画是 Motion One 最强大的特性——真正基于物理的动画，不需要手动计算缓动曲线：

```typescript
import { animate, spring } from "motion";

// 弹簧动画参数
const springConfig = {
  stiffness: 200,   // 弹簧刚度（越大越硬），默认 200
  damping: 20,     // 阻尼（越大越快停止），默认 25
  mass: 1,         // 质量（越大越慢），默认 1
};

animate(
  element,
  { x: 200, scale: 1.1 },
  {
    // 方式一：预置弹簧
    easing: spring({ velocity: 500, stiffness: 200, damping: 20 }),

    // 方式二：直接写物理参数
    easing: [200, 20, 30, 10], // [stiffness, damping, speed, bounce]
  }
);
```

```typescript
// 实战：拖拽后弹性回弹
function springBack(element: HTMLElement, targetX: number) {
  animate(element, { x: targetX }, {
    easing: spring({ stiffness: 300, damping: 20 }),
    // duration 不需要设置，弹簧自动计算时长
  });
}
```

## 时间线（Timeline）

Timeline 是 Motion One 的精髓——用声明式的方式编排复杂动画序列：

```typescript
import { timeline, animate } from "motion";

const sequence = [
  // 第一步：标题入场（0s - 0.6s）
  [".title", { opacity: [0, 1], y: [30, 0] }, { duration: 0.6 }],
  // 第二步：副标题入场（0.3s - 0.9s，叠加入场）
  [".subtitle", { opacity: [0, 1], y: [20, 0] }, { duration: 0.6, at: 0.3 }],
  // 第三步：按钮入场（0.6s - 1.2s）
  [".cta-btn", { opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.6, at: 0.6 }],
  // 第四步：背景渐入（0s - 1.2s）
  [".background", { opacity: [0, 1] }, { duration: 1.2, at: 0 }],
];

timeline(sequence, { duration: 1.2 });
```

### 时间线控制

```typescript
const playback = timeline(sequence);

// 暂停
playback.pause();

// 继续播放
playback.play();

// 倒放
playback.reverse();

// 跳到 50% 进度
playback.seek(0.5);

// 设置速度（0.5 = 慢动作，2 = 快进）
playback.updatePlaybackRate(0.5);

// 动画完成后回调
playback.finished.then(() => {
  console.log("序列动画播放完成！");
});
```

### 实战：Page Transition 页面切换

```typescript
// page-transition.ts
import { timeline, animate, exit, enter } from "motion";

export async function pageTransitionOut() {
  return timeline([
    [".page-content", { opacity: 0, y: -20 }, { duration: 0.3 }],
    [".page-nav", { opacity: 0 }, { duration: 0.2, at: 0.1 }],
  ]).finished;
}

export async function pageTransitionIn() {
  return timeline([
    [".page-nav", { opacity: [0, 1] }, { duration: 0.3 }],
    [".page-content", { opacity: [0, 1], y: [20, 0] }, { duration: 0.4, at: 0.1 }],
  ]).finished;
}
```

```typescript
// 页面切换时使用
async function navigateTo(path: string) {
  await pageTransitionOut();
  router.push(path);
  await pageTransitionIn();
}
```

## 关键帧动画（Keyframes）

Motion One 支持多关键帧，与 CSS @keyframes 功能等价但更可控：

```typescript
animate(".loading-spinner", {
  rotate: [0, 90, 180, 270, 360],  // 5个关键帧
}, {
  duration: 1.5,
  iterations: Infinity,
  easing: "linear",
});
```

```typescript
// 带过渡的关键帧
animate(".breathing-dot", {
  scale: [1, 1.15, 1],              // 呼吸效果
  opacity: [0.6, 1, 0.6],
}, {
  duration: 2.5,
  iterations: Infinity,
  easing: "ease-in-out",
});
```

## 与 React 配合

### 使用 useMotionValue（类组件慎用 Hook）

```tsx
import { useMotionValue, useSpring, MotionValue } from "motion/react";
import { motion } from "motion/react";

function DraggableCard() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // 带弹簧效果的 MotionValue
  const springX = useSpring(x, { stiffness: 200, damping: 20 });
  const springY = useSpring(y, { stiffness: 200, damping: 20 });

  return (
    <motion.div
      drag="x"
      style={{ x, y: springY }}  // x 没有弹簧，y 有弹簧
      dragConstraints={{ left: -100, right: 100 }}
      whileDrag={{ scale: 1.05, cursor: "grabbing" }}
      whileTap={{ scale: 0.95 }}
    >
      拖拽我
    </motion.div>
  );
}
```

### 滚动驱动动画

```tsx
import { motion, useScroll, useTransform } from "motion/react";

function ParallaxHero() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <motion.div style={{ y, opacity }} className="hero">
      <h1>视差滚动效果</h1>
    </motion.div>
  );
}
```

### 动画切换组件

```tsx
import { AnimatePresence, motion } from "motion/react";

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="modal-backdrop"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-content"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## 实战技巧

### 技巧 1：交错动画（Stagger）

```typescript
import { animate, stagger } from "motion";

const items = document.querySelectorAll(".list-item");

// 让列表项依次入场，每项间隔 0.1s
animate(
  items,
  { opacity: [0, 1], y: [20, 0] },
  {
    duration: 0.5,
    delay: stagger(0.1, { start: 0.5 }),  // 0.5s 后开始，每项间隔 0.1s
    easing: "ease-out",
  }
);
```

### 技巧 2：手势驱动动画

```typescript
import { animate, usePointer } from "motion";

const card = document.querySelector(".card")!;
const { x, y } = usePointer(card);

// 拖拽跟随
x.on("change", (value) => {
  card.style.transform = `translateX(${value}px)`;
});

// 释放时弹回
card.addEventListener("pointerup", () => {
  animate(card, { x: 0 }, { easing: spring({ stiffness: 300, damping: 20 }) });
});
```

### 技巧 3：Intersection Observer 触发动画

```typescript
import { animate, inView } from "motion";

const elements = document.querySelectorAll(".scroll-reveal");

elements.forEach((el, i) => {
  inView(el, () => {
    animate(el, { opacity: [0, 1], y: [40, 0] }, {
      duration: 0.6,
      delay: i * 0.1,
      easing: "ease-out",
    });
  });
});
```

## Motion One vs 竞品

| 特性 | Motion One | GSAP | Framer Motion | Anime.js |
|------|-----------|------|---------------|-----------|
| 体积 | **3.8KB** | ~60KB | ~30KB | ~30KB |
| 原生 Waapi | ✅ 基于 Waapi | ❌ 自研 | ❌ 自研 | ❌ 自研 |
| 弹簧动画 | ✅ 原生支持 | ✅ 插件 | ✅ 内置 | ✅ 内置 |
| React 集成 | ✅ 官方支持 | ⚠️ 需插件 | ✅ 官方首选 | ⚠️ 第三方 |
| 时间线 | ✅ 声明式 | ✅ 强大 | ⚠️ 简单 | ✅ |
| 学习曲线 | 低 | 中 | 中 | 低 |
| 许可证 | MIT | 商业/免费 | 商业 | MIT |

## 性能最佳实践

```typescript
// ✅ 始终使用 transform 和 opacity（GPU 加速）
animate(element, { transform: ["translateX(0)", "translateX(200px)"], opacity: [1, 0] });

// ⚠️ 避免动画 width、height、top、left（触发布局重排）
// ❌ 不要这样做：
animate(element, { width: [0, 200], height: [0, 100] });

// ✅ 替代方案：用 scale + transform
animate(element, { scaleX: [0, 1], scaleY: [0, 1] });

// ✅ 使用 will-change 提示浏览器优化
element.style.willChange = "transform";
animate(element, { x: 200 });
element.style.willChange = "auto";  // 动画结束后清除
```

## 总结

Motion One 的核心价值：

1. **极小体积**：3.8KB，比 GSAP 轻 15 倍
2. **原生 Waapi**：复用浏览器原生动画引擎，性能最优
3. **声明式时间线**：复杂动画序列用数组表达，清晰易懂
4. **弹簧动画**：真正的物理模拟，不需要手写缓动函数
5. **完整的控制力**：播放/暂停/倒放/跳转，比 CSS 动画强大 100 倍

对于现代 Web 应用，Motion One 几乎可以替代所有 CSS 动画和 jQuery 动画，且性能更好、控制更强。

*本文由小虾子 🦐 撰写*
