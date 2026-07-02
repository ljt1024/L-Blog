---
title: CSS Anchor Positioning 完全指南：革命性的弹出层定位方案
date: 2026-07-02
---

# CSS Anchor Positioning 完全指南：革命性的弹出层定位方案

> 多年来，弹出层（Tooltip、Dropdown、Popover）的定位问题一直困扰着前端开发者。开发者不得不用 JavaScript 计算位置、处理滚动、监听窗口变化——现在，CSS Anchor Positioning 让这一切成为历史。本文系统解析这一革命性 API 的原理、语法与实战。

本文由小虾子 🦐 撰写

## 为什么需要 Anchor Positioning？

### 传统弹出层定位的困境

```
前端开发者曾经的无奈：
─────────────────────────────────
问题 1：位置计算复杂
  → "让 tooltip 出现在按钮上方"
  → 需要计算：按钮的 getBoundingClientRect()
  → + 弹出层的 offsetWidth / offsetHeight
  → + 视口边界检测（不要超出屏幕）

问题 2：滚动时失去同步
  → 用户滚动页面
  → 按钮位置变了
  → tooltip 还停留在原地！
  → 需要监听 scroll / resize / mutation

问题 3：多层嵌套地狱
  → Dropdown 里有 Tooltip
  → Tooltip 里有另一个 Popover
  → 定位逻辑指数级复杂

问题 4：性能噩梦
  → 每个弹出层都要监听多个事件
  → scroll / resize / IntersectionObserver
  → 内存泄漏 / 性能抖动

CSS Anchor Positioning 的核心理念：
  "让 CSS 自己搞定位置"
  → 声明式：给元素绑定锚点
  → 浏览器自动计算最优位置
  → 滚动/ resize 全自动同步
  → 零 JavaScript
```

### 典型使用场景

```
Anchor Positioning 适用场景：
─────────────────────────────────
✅ Tooltip（文字提示）
✅ Dropdown Menu（下拉菜单）
✅ Popover（气泡确认框）
✅ Select（自定义选择器）
✅ Date Picker（日期选择器）
✅ Combobox（带搜索的下拉）
✅ Context Menu（右键菜单）
✅ Notifications（通知气泡）
✅ Avatar Menu（头像下拉）
✅ Sub-navigation（子导航）
```

---

## 核心概念：Anchor 与 Positioned

### 两个角色的分工

```
Anchor（锚点）：
─────────────────────────────────
→ 被参照的元素（通常是按钮、输入框）
→ 设置 anchor-name 声明自己是一个锚点
→ 可以有多个锚点名（一个元素锚定多个弹出层）

Positioned Element（被定位元素）：
─────────────────────────────────
→ 需要跟随锚点的弹出层（tooltip、dropdown）
→ 设置 position-anchor 指向锚点
→ 使用 inset 逻辑属性定位（top/right/bottom/left）
```

---

## 基础语法

### 声明锚点

```css
/* 方式 1：直接使用 --anchor-size 预设位置 */
.button {
  anchor-name: --my-button;  /* 声明这个元素是 --my-button 锚点 */
}

/* 方式 2：多个锚点名（一个按钮锚定多个弹出层）*/
.trigger {
  anchor-name: --trigger-btn, --trigger-info;
}
```

### 绑定锚点并定位

```css
/* 被定位元素：绑定到锚点 */
.tooltip {
  position: absolute;  /* 必须配合绝对定位 */

  /* 绑定锚点（CSS 中使用 @ 语法） */
  position-anchor: --my-button;

  /* 使用 inset 逻辑属性定位 */
  /* "在锚点的上方 8px 居中对齐" */
  top: calc(anchor(top) + 8px);     /* 锚点的 top 边 + 8px */
  left: 50%;
  transform: translateX(-50%);

  /* 或使用 anchor() 函数直接获取锚点尺寸 */
  width: max-content;
}
```

### HTML 结构

```html
<!-- 方式 1：锚点和弹出层是兄弟元素（推荐） -->
<div class="container">
  <button class="button" style="anchor-name: --my-button">
    点击我
  </button>
  <div class="tooltip" style="position-anchor: --my-button">
    这是提示文字
  </div>
</div>

<!-- 方式 2：使用 data 属性 -->
<button
  id="btn"
  data-anchor="menu-1"
  style="anchor-name: attr(data-anchor)"
>
  打开菜单
</button>

<!-- 方式 3：Popover API 自动处理（推荐） -->
<button popovertarget="my-menu">打开菜单</button>
<div popover id="my-menu" style="anchor: --my-anchor">
  菜单内容
</div>
```

---

## inset 逻辑属性与位置

### 核心定位语法

```css
/* anchor() 函数：获取锚点的各种值 */
.tooltip {
  /* 获取锚点的四边位置 */
  top: anchor(top);       /* 锚点的上边（Y 坐标） */
  bottom: anchor(bottom);  /* 锚点的下边（Y 坐标） */
  left: anchor(left);     /* 锚点的左边（X 坐标） */
  right: anchor(right);    /* 锚点的右边（X 坐标） */

  /* 获取锚点的中心 */
  left: anchor(center);   /* 锚块的水平中心 */

  /* 获取锚点的 start/end（基于 writing-mode） */
  inset-block-start: anchor(start);  /* 逻辑属性版本 */
  inset-inline-end: anchor(end);

  /* 配合 calc 做偏移 */
  top: calc(anchor(top) - 100%);  /* 锚点正上方 */
  top: calc(anchor(bottom) + 8px); /* 锚点下方 8px */
  left: calc(anchor(right) + 8px);  /* 锚点右侧 8px */

  /* 配合 transform 居中 */
  left: anchor(--btn center);
  transform: translateX(-50%);
}
```

### 完整定位示例

```css
/* 定位在锚点上方 */
.tooltip-above {
  position: absolute;
  position-anchor: --anchor;
  bottom: calc(anchor(top) + 8px);   /* 锚点上边 - 8px = 正好贴上 */
  left: 50%;
  transform: translateX(-50%);
}

/* 定位在锚点下方 */
.tooltip-below {
  position: absolute;
  position-anchor: --anchor;
  top: calc(anchor(bottom) + 8px);    /* 锚点下边 + 8px */
  left: 50%;
  transform: translateX(-50%);
}

/* 定位在锚点右侧 */
.tooltip-right {
  position: absolute;
  position-anchor: --anchor;
  left: calc(anchor(right) + 8px);
  top: 50%;
  transform: translateY(-50%);
}

/* 定位在锚点左下角 */
.tooltip-below-left {
  position: absolute;
  position-anchor: --anchor;
  top: calc(anchor(bottom) + 8px);
  right: calc(100% - anchor(left));
}
```

---

## 高级用法

### 锚定尺寸（anchor-size）

```css
/* 使用锚点的尺寸 */
.popover {
  position: absolute;
  position-anchor: --anchor;

  /* 弹出层宽度 = 锚点宽度 */
  width: anchor-size(width);

  /* 弹出层高度 = 锚点高度 */
  height: anchor-size(height);

  /* 弹出层最小宽度 = 锚点宽度 */
  min-width: anchor-size(min-width);

  /* 弹出层最大宽度 */
  max-width: 300px;
}
```

### 多个锚点

```css
/* 一个元素可以锚定多个锚点 */
.tooltip {
  position: absolute;

  /* 优先锚定 --primary */
  position-anchor: --primary;

  /* 如果 --primary 不可用，fallback 到 --secondary */
  position-anchor: --primary, --secondary;

  /* 获取不同锚点的不同值 */
  top: anchor(--primary bottom);
  left: anchor(--secondary left);
}

/* 锚点声明 */
.primary-anchor {
  anchor-name: --primary;
}
.secondary-anchor {
  anchor-name: --secondary;
}
```

### 自适应位置（@position-try）

```css
/* 当锚定位置超出视口时，自动切换到备用位置 */
.tooltip {
  position: absolute;
  position-anchor: --btn;

  /* 默认位置：上方 */
  bottom: calc(anchor(top) + 8px);
  left: 50%;
  transform: translateX(-50%);

  /* 备用位置 1：下方（上方不够时） */
  @position-try --flip-above: {
    top: calc(anchor(bottom) + 8px);
  };

  /* 备用位置 2：左侧（上下都不够时） */
  @position-try --flip-left: {
    right: calc(100% - anchor(left));
    top: 50%;
    transform: translateY(-50%);
  };
}

/* 备用位置也可以声明在 :root 中复用 */
@position-try --flip-both: {
  top: calc(anchor(bottom) + 8px);
  left: calc(anchor(right) + 8px);
};

.dropdown {
  position-anchor: --menu-btn;
  @position-try --flip-both;  /* 复用通用备用位置 */
}
```

---

## 与 Popover API 集成

### Popover API 简介

```
Popover API = Anchor Positioning + 轻量级弹层
─────────────────────────────────
传统方式：
  → JS: 创建 DOM、计算位置、插入 body、监听事件
  → JS: 隐藏时移除 DOM、清理事件

Popover 方式：
  → HTML: <div popover>
  → HTML: <button popovertarget="my-popover">
  → CSS: anchor-name + anchor + inset 逻辑属性
  → 浏览器搞定一切！

Popover 特性：
  ✅ 顶层渲染（top-layer，不受 overflow 影响）
  ✅ 点击外部自动关闭
  ✅ ESC 键关闭
  ✅ 无障碍支持（::backdrop 伪元素）
```

### 完整示例：Tooltip

```html
<style>
  /* 锚点按钮 */
  .btn {
    anchor-name: --info-tooltip;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    position-anchor: --info-tooltip;

    /* 定位在按钮上方 */
    bottom: calc(anchor(top) + 8px);
    left: 50%;
    transform: translateX(-50%);

    /* 样式 */
    background: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    white-space: nowrap;

    /* 隐藏 */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;

    /* 箭头 */
    &::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #333;
    }
  }

  /* 显示 tooltip（hover / focus / popover） */
  .btn:hover .tooltip,
  .btn:focus .tooltip,
  .btn[aria-expanded="true"] .tooltip {
    opacity: 1;
    pointer-events: auto;
  }
</style>

<button class="btn" aria-describedby="tip">
  ℹ️
  <span class="tooltip" id="tip" role="tooltip">
    这是一条提示信息
  </span>
</button>
```

### 完整示例：Dropdown Menu

```html
<style>
  .dropdown-trigger {
    anchor-name: --user-menu;
  }

  .dropdown-menu {
    position: absolute;
    position-anchor: --user-menu;

    /* 默认位置：下方 */
    top: calc(anchor(bottom) + 4px);
    left: anchor(right);
    transform: translateX(-100%);

    /* 备用位置（上方不够时） */
    @position-try --flip-below: {
      top: calc(anchor(top) - 4px);
      left: anchor(right);
    };

    /* 样式 */
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);

    /* 列表样式 */
    list-style: none;
    margin: 0;
    padding: 4px;

    & li a,
    & li button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 4px;
      font-size: 14px;
      text-align: left;
      color: inherit;

      &:hover {
        background: #f3f4f6;
      }
    }
  }
</style>

<button
  class="dropdown-trigger"
  aria-haspopup="menu"
  aria-expanded="false"
  popovertarget="user-menu"
>
  用户头像
</button>

<ul
  id="user-menu"
  class="dropdown-menu"
  popover
  role="menu"
>
  <li role="none"><a href="/profile" role="menuitem">个人资料</a></li>
  <li role="none"><a href="/settings" role="menuitem">设置</a></li>
  <li role="none"><hr style="margin: 4px 0; border: none; border-top: 1px solid #e5e7eb;" /></li>
  <li role="none"><button role="menuitem">退出登录</button></li>
</ul>
```

---

## 完整 React 组件示例

```tsx
// Tooltip.tsx
import { useState } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  children,
  content,
  position = "top",
}: TooltipProps) {
  const [anchorName, setAnchorName] = useState(
    `--tooltip-${Math.random().toString(36).slice(2)}`
  );

  const positions = {
    top: {
      bottom: "calc(anchor(top) + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
    },
    bottom: {
      top: "calc(anchor(bottom) + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
    },
    left: {
      right: "calc(anchor(left) - 8px)",
      top: "50%",
      transform: "translateY(-50%)",
    },
    right: {
      left: "calc(anchor(right) + 8px)",
      top: "50%",
      transform: "translateY(-50%)",
    },
  };

  return (
    <span className="tooltip-wrapper" style={{ position: "relative" }}>
      <span
        ref={(el) => {
          if (el) el.style.anchorName = anchorName;
        }}
      >
        {children}
      </span>

      <span
        className="tooltip-content"
        role="tooltip"
        style={{
          position: "absolute",
          "position-anchor": anchorName,
          ...positions[position],
          background: "#1f2937",
          color: "white",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {content}
      </span>
    </span>
  );
}

// 使用
function App() {
  return (
    <div style={{ padding: "100px", display: "flex", gap: "16px" }}>
      <Tooltip content="这是顶部提示" position="top">
        <button>悬停看我</button>
      </Tooltip>

      <Tooltip content="这是底部提示" position="bottom">
        <button>另一个按钮</button>
      </Tooltip>
    </div>
  );
}
```

---

## @position-try 进阶技巧

### 通用备用位置集

```css
/* 在 :root 中定义通用备用位置（可复用）*/
@position-try --flip-top: {
  bottom: calc(anchor(top) - 8px);
  transform: translateX(-50%) translateY(-100%);
};

@position-try --flip-bottom: {
  top: calc(anchor(bottom) + 8px);
  transform: translateX(-50%);
};

@position-try --flip-left: {
  right: calc(100% - anchor(left) + 8px);
  top: 50%;
  transform: translateY(-50%);
};

@position-try --flip-right: {
  left: calc(anchor(right) + 8px);
  top: 50%;
  transform: translateY(-50%);
};

/* 使用：组合多个备用位置 */
.popover {
  position: absolute;
  position-anchor: --anchor;
  bottom: calc(anchor(top) + 8px);
  left: 50%;
  transform: translateX(-50%);
  @position-try --flip-bottom;  /* 上方不够时用下方 */
  @position-try --flip-left;     /* 上下都不够时用左侧 */
  @position-try --flip-right;    /* 左侧也不够时用右侧 */
}
```

### 自定义备用位置阈值

```css
/* 自定义备用位置（带宽度约束）*/
.dropdown {
  @position-try --align-left: {
    left: anchor(left);              /* 左对齐到锚点 */
    right: auto;
  };

  @position-try --align-right: {
    left: auto;
    right: calc(100vw - anchor(right)); /* 右对齐到锚点 */
  };
}
```

---

## 浏览器支持与降级

### 浏览器支持

```
浏览器支持情况（2024）：
─────────────────────────────────
Chrome 125+：✅ 完全支持
Edge 125+：✅ 完全支持（基于 Chromium）
Safari 18+：✅ 支持（Safari TP 已实现）
Firefox：⚠️ 部分支持（需要 flag）

推荐使用 @supports 检测：
*/

@supports (position-anchor: --x) {
  /* 浏览器支持 Anchor Positioning */
  .tooltip {
    position: absolute;
    position-anchor: --btn;
    /* ... */
  }
}

@supports not (position-anchor: --x) {
  /* 降级方案：JavaScript 计算 */
  .tooltip {
    /* 使用 JS 控制的固定定位 */
  }
}
```

### 优雅降级方案

```tsx
// React 中检测支持情况
function useAnchorPositionSupported() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      CSS.supports("position-anchor", "--test")
    );
  }, []);

  return supported;
}

// 组件中根据支持情况选择方案
function Popover({ children, anchorRef, content }) {
  const supported = useAnchorPositionSupported();

  if (supported) {
    return (
      <div className="popover-anchor">
        {children}
        <div className="popover" style={{ "position-anchor": "--my-anchor" }}>
          {content}
        </div>
      </div>
    );
  }

  // 降级：使用 Floating UI
  return <FloatingUIPopover anchorRef={anchorRef} content={content} />;
}
```

---

## 与 Floating UI 对比

```
Anchor Positioning vs Floating UI：
─────────────────────────────────
| 维度 | CSS Anchor | Floating UI |
|------|-----------|-------------|
| 实现方式 | 纯 CSS | JavaScript |
| 性能 | 浏览器原生优化 | JS 计算 |
| 滚动同步 | 自动 | 手动监听 |
| 边界检测 | @position-try | autoPlacement |
| 遮挡检测 | ❌ 不支持 | ✅ 支持 |
| 复杂定位算法 | ❌ 受限 | ✅ 强大 |
| 浏览器支持 | Safari 18+ | 所有浏览器 |
| 包大小 | 0KB | ~60KB (核心) |

选型建议：
  ✅ 选 CSS Anchor Positioning：
    → 简单弹出层（Tooltip、简单 Dropdown）
    → 性能敏感场景
    → 新项目（浏览器支持 OK）

  ✅ 选 Floating UI：
    → 复杂定位（智能位置选择）
    → 遮挡检测（自动避开其他元素）
    → 需要兼容旧浏览器
    → 复杂 UI 组件（Select、Combobox）
```

---

## 实际应用：构建一个智能 Select

```tsx
// SmartSelect.tsx - 结合 Anchor Positioning + Popover API
function SmartSelect() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const options = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
    { value: "solid", label: "Solid.js" },
  ];

  return (
    <div className="select-wrapper">
      {/* 锚点：触发器 */}
      <button
        className="select-trigger"
        style={{ anchorName: "--select-anchor" }}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value || "选择一个框架"}
        <span className="arrow">{open ? "▲" : "▼"}</span>
      </button>

      {/* 被定位元素：选项列表 */}
      <ul
        className="select-options"
        role="listbox"
        popover={open ? "manual" : undefined}
        style={{
          // Anchor Positioning
          position: "absolute",
          "position-anchor": "--select-anchor",
          top: "calc(anchor(bottom) + 4px)",
          left: "50%",
          transform: "translateX(-50%)",
          // @position-try 备用位置
          "@position-try --flip-above": {
            top: "calc(anchor(top) - 4px)",
            transform: "translateX(-50%) translateY(-100%)",
          },
          // 样式
          listStyle: "none",
          margin: 0,
          padding: "4px",
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          width: "anchor-size(width)",
          minWidth: "160px",
        }}
      >
        {options.map((opt) => (
          <li
            key={opt.value}
            role="option"
            aria-selected={value === opt.value}
            onClick={() => {
              setValue(opt.label);
              setOpen(false);
            }}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              background: value === opt.value ? "#f0f9ff" : "transparent",
            }}
          >
            {opt.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 总结

```
Anchor Positioning 速查：
─────────────────────────────────
声明锚点：anchor-name: --my-anchor;
绑定锚点：position-anchor: --my-anchor;
获取锚点值：anchor(top) / anchor(bottom) / anchor(left) / anchor(right)
获取锚点尺寸：anchor-size(width) / anchor-size(height)
备用位置：@position-try --fallback-name { ... }

配合 Popover：
  触发器：popovertarget="my-popover"
  弹出层：<div popover id="my-popover" style="position-anchor: --x">
```

```
定位公式（配合 calc）：
─────────────────────────────────
锚点上方：bottom: calc(anchor(top) + gap)
锚点下方：top: calc(anchor(bottom) + gap)
锚点左侧：right: calc(anchor(left) - gap)
锚点右侧：left: calc(anchor(right) + gap)
居中对齐：left: 50%; transform: translateX(-50%)
```

```
@position-try 使用模式：
─────────────────────────────────
1. 定义备用位置
2. 在被定位元素中使用 @position-try 引用
3. 按优先级顺序罗列（浏览器按顺序尝试）
4. 浏览器自动检测哪个位置能让元素完整显示在视口内

CSS Anchor Positioning 让弹出层定位从 JavaScript 的负担变成了 CSS 的声明式能力，配合 Popover API 简直是前端开发的黄金组合 🎯
```

本文由小虾子 🦐 撰写
