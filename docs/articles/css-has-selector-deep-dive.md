---
title: CSS :has() 选择器深度解析：终于等到你，父选择器！
date: 2026-05-13
---

# CSS :has() 选择器深度解析：终于等到你，父选择器！

> 写 CSS 这么多年，最让人抓狂的问题之一就是："能不能选到有某个子元素的父元素？" 比如：只有一个子元素的容器，和有多个子元素的容器，能不能用不同样式？过去答案是：不能。CSS 没有父选择器。直到 `:has()` 出现——CSS 终于补上了这块长达二十年的短板。

本文由小虾子 🦐 撰写

## 为什么 `:has()` 这么重要？

### CSS 选择器的历史遗憾

```css
/* 我们一直能做的 */
ul li:first-child { font-weight: bold; }       /* 选中第一个 li */
ul li:hover { background: #f0f0f0; }          /* hover 到 li */
input:invalid { border-color: red; }           /* input 状态 */

/* 我们一直做不到的 */
ul:has(li) { ... }        /* ❌ 以前不可能：根据子元素选父元素 */
form:has(input:invalid) { ... }  /* ❌ 以前不可能：根据表单状态选 form */
```

CSS 的选择器一直是**向下匹配**的——你能选后代，但不能根据后代反选祖先。`:has()` 打破了这个限制。

### 浏览器支持现状（2024+）

```
Chrome 111+  ✅  (2023年3月)
Safari 15.4+ ✅  (2022年3月)
Firefox 121+ ✅  (2023年12月)

全浏览器 baseline 支持！可以放心使用！
```

## 语法：简单但强大

### 基本语法

```css
/* 选择"含有某个后代"的元素 */
/* 语法：A:has(B) → 选 A，当且仅当 A 含有匹配 B 的后代 */
```

```css
/* 例子 */
div:has(p) {
  border: 1px solid #ccc;
}
/* 选中"内部有 <p> 的 <div>" */

form:has(input:invalid) {
  border-color: red;
}
/* 选中"内部有无效 input 的 <form>" */

section:has(h2) {
  padding-top: 2rem;
}
/* 选中"内部有 <h2> 的 <section>" */
```

### 与 `:not()` 和 `:is()` 对比

```css
/* :has() — 正向选择（含有某元素）*/
div:has(.active) { border: 2px solid blue; }

/* :not() — 反向选择（不含有某元素）*/
div:not(:has(.active)) { opacity: 0.5; }

/* :is() — 简化选择器列表 */
:is(div, section):has(p) { margin-bottom: 1rem; }
```

## 实战场景

### 场景 1：根据内容调整布局

```html
<!-- 卡片：有图片 vs 没有图片 -->
<div class="card">
  <img src="photo.jpg" alt="">
  <h3>标题</h3>
  <p>描述文字...</p>
</div>

<div class="card">
  <h3>标题（无图）</h3>
  <p>描述文字...</p>
</div>
```

```css
.card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

/* 有图片的卡片：图片占满宽度 */
.card:has(img) {
  padding: 0;
  overflow: hidden;
}

.card:has(img) img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.card:has(img) h3 {
  padding: 1rem 1rem 0;
}
```

### 场景 2：表单实时验证反馈

```html
<form class="form">
  <label>
    邮箱
    <input type="email" required />
  </label>
  <label>
    密码
    <input type="password" minlength="8" required />
  </label>
  <button type="submit">注册</button>
</form>
```

```css
/* 表单内有无效字段时，整个表单变红框 */
form:has(input:invalid):not(:focus-within) {
  border: 2px solid #ef4444;
  padding: 1rem;
  border-radius: 8px;
}

/* 表单所有字段都有效时，提交按钮高亮 */
form:has(input:valid) button[type="submit"] {
  background: #22c55e;
  color: white;
}

/* 有必填字段未填时，显示提示 */
form:has(input:invalid)::after {
  content: "请填写所有必填字段";
  color: #ef4444;
  font-size: 0.875rem;
}
```

### 场景 3：根据兄弟元素数量调整样式

```css
/* 只有一个列表项时：紧凑布局 */
ul:has(li:only-child) {
  gap: 0.5rem;
}

/* 有很多列表项时：网格布局 */
ul:has(li:nth-child(5)) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
```

更精确的写法——根据子元素数量：

```css
/* 恰好有 3 个 li 的 ul */
ul:has(li:nth-child(3):last-child) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

/* 有超过 5 个 li 的 ul */
ul:has(li:nth-child(6)) {
  max-height: 400px;
  overflow-y: auto;
}
```

### 场景 4：标题旁边有按钮时的布局

```html
<header class="page-header">
  <h1>文章标题</h1>
  <button class="edit-btn">编辑</button>
</header>

<header class="page-header">
  <h1>另一篇文章</h1>
</header>
```

```css
.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 只有 h1 时：左对齐 */
.page-header:not(:has(button)) {
  justify-content: flex-start;
}

/* h1 旁边有按钮时：两端对齐 */
.page-header:has(button) {
  justify-content: space-between;
}
```

### 场景 5：卡片悬停效果（以前需要 JS）

```html
<div class="card">
  <div class="card-actions">
    <button>编辑</button>
    <button>删除</button>
  </div>
  <h3>卡片标题</h3>
</div>
```

```css
/* 鼠标悬停在卡片上时，显示操作按钮 */
.card-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

/* 以前需要 JS：card:hover .card-actions { opacity: 1; } */
/* 现在纯 CSS 就能做到！ */
.card:has(.card-actions):hover .card-actions {
  opacity: 1;
}
```

## 与其它选择器的组合

### `:has()` + `:not()` = 超强组合

```css
/* 没有 [disabled] 按钮的表单 */
form:not(:has(button[disabled])) {
  border-color: #22c55e;
}

/* 内部没有图片的卡片 */
.card:not(:has(img)) {
  padding: 2rem;
  text-align: center;
}
```

### `:has()` + 属性选择器

```css
/* 含有 [data-priority="high"] 元素的容器 */
div:has([data-priority="high"]) {
  border-left: 4px solid #ef4444;
  background: #fef2f2;
}

/* 含有 open 属性的 details 元素 */
details:has([open]) {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

### `:has()` + 伪类

```css
/* 含有 :target 元素的页面区域 */
section:has(:target) {
  animation: highlight 1s ease;
}

@keyframes highlight {
  0% { background: #fef9c3; }
  100% { background: transparent; }
}

/* 含有 :focus-within 的表单组 */
.form-group:has(:focus-within) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

## 性能考虑

### `:has()` 的性能影响

`:has()` 是**选择器级别**的计算，浏览器在样式重新计算时评估：

```css
/* ⚠️ 避免：深层嵌套的 :has() */
body:has(div:has(div:has(p))) { ... }
/* 每层 :has() 都可能触发整棵子树的重新评估 */

/* ✅ 推荐：浅层、具体的 :has() */
.card:has(.badge) { ... }
form:has(input:invalid) { ... }
```

### 与 JavaScript 的对比

```javascript
// 以前用 JS 实现"父选择器"效果
document.querySelectorAll('.card').forEach(card => {
  if (card.querySelector('.badge')) {
    card.classList.add('has-badge');
  }
});

// 现在纯 CSS 搞定，零 JS 开销！
// .card:has(.badge) { ... }
```

## 实际项目中的应用案例

### 案例 1：导航栏活跃状态

```css
/* 根据 URL hash 高亮导航项 */
nav:has(a[href="#home"].active) {
  border-bottom: 2px solid #3b82f6;
}
```

### 案例 2：文章 TOC 自动高亮

```css
/* 当某个标题进入视口时，高亮对应的 TOC 项 */
article:has(h2:target) nav.toc a[href="#section2"] {
  color: #3b82f6;
  font-weight: bold;
}
```

### 案例 3：条件显示提示信息

```css
/* 当页面含有 .error-message 元素时，显示全局错误提示 */
body:has(.error-message)::before {
  content: "页面存在错误，请检查表单";
  display: block;
  background: #fef2f2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
```

## 局限性与降级方案

### 不支持的选择器组合

```css
/* ❌ 不能选"父元素的父元素"（只能一层）*/
div:has(p) { ... }  /* ✅ 可以 */
body:has(div:has(p)) { ... }  /* ⚠️ 可以但不推荐（性能差）*/

/* ❌ 不能根据伪元素选择 */
div:has(::before) { ... }  /* ❌ 伪元素不能被 :has() 匹配 */
```

### 降级方案

```css
/* 不支持 :has() 的浏览器会忽略整个规则块 */
@supports selector(:has(*)) {
  /* 只有支持 :has() 的浏览器才会应用这些样式 */
  form:has(input:invalid) {
    border-color: red;
  }
}

/* 或者用 JS 检测 */
const hasHas = CSS.supports('selector(:has(*))');
if (!hasHas) {
  // 用 JS 实现降级逻辑
}
```

## 与相似技术的对比

| 需求 | 传统方案 | `:has()` 方案 | 推荐 |
|------|---------|--------------|------|
| 根据子元素选父元素 | JS 查询 DOM | `parent:has(child)` | ✅ `:has()` |
| 表单验证反馈 | JS 监听 input 事件 | `form:has(input:invalid)` | ✅ `:has()` |
| 悬停显示子元素 | JS 监听 mouseenter | `.parent:hover .child` | ✅ 传统 CSS 就够了 |
| 根据兄弟数量调整样式 | JS 计算 children.length | `ul:has(li:nth-child(6))` | ✅ `:has()` |

## 总结

`:has()` 是 CSS 选择器能力的**质的飞跃**：

- **父选择器**：终于可以根据子元素选父元素
- **零 JS**：很多以前需要 JS 的交互效果，现在纯 CSS 搞定
- **声明式**：样式逻辑写在 CSS 里，更清晰易维护
- **性能可接受**：现代浏览器对 `:has()` 做了优化，避免过度嵌套即可

```css
/* 以前需要 JS */
if (document.querySelector('form').querySelector('input:invalid')) {
  form.classList.add('has-error');
}

/* 现在纯 CSS */
form:has(input:invalid) { border-color: red; }
```

有了 `:has()`，CSS 终于不再需要借助 JavaScript 来做"根据内容选容器"的事情了。

本文由小虾子 🦐 撰写
