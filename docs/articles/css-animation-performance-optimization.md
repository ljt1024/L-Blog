# CSS 动画性能优化：让页面丝滑流畅的终极指南

> 动画卡顿是前端性能问题中最"肉眼可见"的一种。本文从浏览器渲染原理出发，深入解析 CSS 动画性能优化的核心技巧。

## 为什么动画会卡顿？

在深入优化之前，我们需要理解浏览器是如何渲染页面的。

### 渲染流水线

```
JavaScript → Style → Layout → Paint → Composite
```

当修改元素的属性时，浏览器需要重新执行渲染流水线。不同属性触发的步骤不同：

| 属性修改 | 触发阶段 | 性能成本 |
|---------|---------|---------|
| `width`, `height`, `margin` | Layout（重排） |  高 |
| `background`, `color`, `border` | Paint（重绘） |  中 |
| `transform`, `opacity` | Composite（合成） |  低 |

**关键结论**：只有 `transform` 和 `opacity` 不会触发布局和绘制变化，直接在 GPU 层面合成，这就是动画性能优化的核心。

## transform 与 opacity 的魔力

### 实战对比

```css
/* 错误 低性能：触发重排 */
.badge {
  animation: moveRight 1s ease;
}

@keyframes moveRight {
  from { left: 0; }
  to { left: 100px; }
}

/* 正确 高性能：使用 transform */
.badge {
  animation: moveRight 1s ease;
}

@keyframes moveRight {
  from { transform: translateX(0); }
  to { transform: translateX(100px); }
}
```

### 为什么 transform 这么快？

1. **GPU 加速**：transform 和 opacity 由 GPU 处理，不占用 CPU
2. **不触发重排/重绘**：修改的是渲染层的合成属性
3. **独立图层**：transform 变化可以分配到独立的合成层

## will-change：提前告知浏览器

### 使用技巧

```css
.card {
  /* 告诉浏览器：这个元素将要变化 */
  will-change: transform;

  /* 变化结束后移除，释放内存 */
  transition: transform 0.3s ease;
}

.card:hover {
  transform: scale(1.05);
}

/* 动画结束后移除 will-change */
.card:hover {
  will-change: auto;
}
```

### 注意事项

- **不要过度使用**：每个合成层都会消耗内存
- **提前设置**：在动画开始前设置，不要在动画过程中添加
- **及时清理**：动画结束后设为 `auto`

## 实战技巧汇总

### 1. 位移用 translate，勿用 top/left

```css
/* 正确 正确 */
.element {
  transform: translateX(50px);
  transform: translateY(50px);
  transform: translate(50px, 50px); /* 组合写法 */
}

/* 错误 错误 */
.element {
  top: 50px;
  left: 50px;
}
```

### 2. 缩放用 scale，勿用 width/height

```css
/* 正确 正确 */
.modal {
  transform: scale(1.1);
}

/* 错误 错误 */
.modal {
  width: 110%;
  height: 110%;
}
```

### 3. 旋转用 rotate，勿用 margin/padding

```css
/* 正确 正确 */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误 错误 */
.spinner {
  /* 永远不要用这种方式做旋转动画！*/
}
```

### 4. 透明度动画替代 display/visibility

```css
/* 错误 错误：会触发布局变化 */
.modal {
  display: none;
}
.modal.active {
  display: block;
}

/* 正确 正确：仅触发合成层 */
.modal {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}
.modal.active {
  opacity: 1;
  visibility: visible;
}
```

### 5. 列表动画的最佳实践

```css
.list-item {
  /* 初始状态 */
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.list-item.leaving {
  /* 离开时 */
  opacity: 0;
  transform: translateX(-20px);
  /* 使用 will-change 优化 */
  will-change: transform, opacity;
}
```

## 性能检测工具

### Chrome DevTools

1. 打开 DevTools → Performance 面板
2. 录制动画性能
3. 查看 "Rendering" 中的 "FPS" 计数器
4. 启用 "Paint flashing" 观察重绘区域

### 实际案例：优化列表拖拽

```javascript
// 优化前：每帧都修改 DOM 位置
function onDrag(element, x, y) {
  element.style.left = x + 'px';
  element.style.top = y + 'px';
}

// 优化后：使用 transform
function onDrag(element, x, y) {
  element.style.transform = `translate(${x}px, ${y}px)`;
}
```

性能对比：
- 优化前：60 FPS → 30 FPS（卡顿明显）
- 优化后：60 FPS → 60 FPS（丝滑流畅）

## 常见误区

### 错误 滥用 will-change

```css
/* 错误：给所有元素都加 will-change */
* {
  will-change: transform;
}
```

### 错误 在动画中修改布局属性

```css
/* 错误：动画过程中修改 width */
@keyframes grow {
  0% { width: 100px; }
  100% { width: 200px; }
}
```

### 错误 忽略硬件加速的副作用

```css
/* 某些情况下可能导致字体模糊 */
.text {
  transform: translateZ(0); /* 强制 GPU */
}
```

## 总结

| 优化技巧 | 原理 | 效果 |
|---------|-----|-----|
| 使用 transform/opacity | 避免重排/重绘 |  |
| 合理使用 will-change | 创建合成层 |  |
| 使用 translate/scale | GPU 加速 |  |
| 避免布局属性动画 | 减少 CPU 消耗 |  |

记住这个黄金法则：**动画用 transform 和 opacity 就对了！**

---

*本文由小虾子  撰写*
