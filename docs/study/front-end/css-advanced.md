# CSS深入详解

在掌握了CSS的基础知识后，我们可以进一步探索CSS的高级特性和最佳实践。本文将详细介绍CSS选择器进阶、布局深入、动画与过渡、响应式设计、预处理器、架构方法论以及现代CSS特性等核心概念。

## CSS选择器进阶

CSS选择器是样式规则的第一部分，决定了哪些元素会被选中并应用样式。

### 属性选择器

属性选择器可以根据元素的属性及属性值来选择元素：

```css
/* 选择具有title属性的元素 */
[title] {
    color: blue;
}

/* 选择type属性值为"text"的input元素 */
input[type="text"] {
    border: 1px solid #ccc;
}

/* 选择class属性值包含"button"的元素 */
[class*="button"] {
    padding: 10px 20px;
}

/* 选择href属性值以"https"开头的链接 */
a[href^="https"] {
    background: url(lock-icon.png) no-repeat right center;
}

/* 选择href属性值以".pdf"结尾的链接 */
a[href$=".pdf"] {
    background: url(pdf-icon.png) no-repeat right center;
}
```

### 伪类与伪元素

伪类选择器用于选择处于特定状态的元素，伪元素选择器用于选择元素的特定部分：

```css
/* 伪类选择器 */
a:hover {
    color: red;
}

input:focus {
    outline: 2px solid blue;
}

li:first-child {
    font-weight: bold;
}

li:last-child {
    border-bottom: none;
}

tr:nth-child(even) {
    background-color: #f2f2f2;
}

tr:nth-child(odd) {
    background-color: #ffffff;
}

/* 伪元素选择器 */
p::first-line {
    font-weight: bold;
}

p::first-letter {
    font-size: 2em;
    float: left;
}

.quote::before {
    content: """;
}

.quote::after {
    content: """;
}

.tooltip::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    background: black;
    color: white;
    padding: 5px;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.3s;
}

.tooltip:hover::before {
    opacity: 1;
}
```

### 组合选择器

组合选择器用于选择元素之间的关系：

```css
/* 后代选择器 */
.nav ul li a {
    color: #333;
}

/* 子选择器 */
.nav > ul > li {
    display: inline-block;
}

/* 相邻兄弟选择器 */
h1 + p {
    font-size: 1.2em;
}

/* 通用兄弟选择器 */
h1 ~ p {
    color: #666;
}
```

### 选择器优先级计算

CSS优先级按以下规则计算（从高到低）：
1. 内联样式 (1000)
2. ID选择器 (100)
3. 类选择器、属性选择器、伪类 (10)
4. 元素选择器、伪元素 (1)
5. 通配符选择器 (0)

```css
/* 优先级示例 */
#header .nav li a { /* 100 + 10 + 1 + 1 = 112 */
    color: blue;
}

.nav ul li a { /* 10 + 1 + 1 + 1 = 13 */
    color: red;
}

/* !important可以覆盖所有优先级 */
.nav li a {
    color: green !important; /* 优先级最高 */
}
```

## CSS布局深入

现代CSS提供了多种强大的布局方式，可以满足复杂的页面布局需求。

### Flexbox弹性布局

Flexbox是一维布局模型，适用于沿单行或单列排列元素：

```css
.flex-container {
    display: flex;
    flex-direction: row; /* 主轴方向: row | row-reverse | column | column-reverse */
    flex-wrap: nowrap; /* 换行: nowrap | wrap | wrap-reverse */
    justify-content: flex-start; /* 主轴对齐: flex-start | flex-end | center | space-between | space-around | space-evenly */
    align-items: stretch; /* 交叉轴对齐: flex-start | flex-end | center | baseline | stretch */
    align-content: flex-start; /* 多行对齐: flex-start | flex-end | center | space-between | space-around | stretch */
}

.flex-item {
    flex-grow: 0; /* 放大比例 */
    flex-shrink: 1; /* 缩小比例 */
    flex-basis: auto; /* 基础大小 */
    /* 简写: flex: grow shrink basis */
    flex: 0 1 auto;
    
    order: 0; /* 排列顺序 */
    align-self: auto; /* 单独对齐: auto | flex-start | flex-end | center | baseline | stretch */
}

/* 实际应用示例 */
.navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #333;
    color: white;
}

.nav-links {
    display: flex;
    gap: 2rem;
}

.nav-link {
    text-decoration: none;
    color: inherit;
}

/* 垂居中 */
.centered {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}
```

### Grid网格布局

Grid是二维布局模型，适用于创建复杂的网格结构：

```css
.grid-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* 3列，每列占1份 */
    grid-template-rows: auto 1fr auto; /* 3行，高度分别为自动、1份、自动 */
    grid-gap: 1rem; /* 网格间距 */
    /* 简写: grid-template: rows / columns */
    grid-template: auto 1fr auto / repeat(3, 1fr);
}

.grid-item {
    grid-column: 1 / 3; /* 占据第1到第3列 */
    grid-row: 1 / 2; /* 占据第1到第2行 */
    /* 简写: grid-area: row-start / column-start / row-end / column-end */
    grid-area: 1 / 1 / 2 / 3;
}

/* 命名网格线 */
.layout {
    display: grid;
    grid-template-columns: [start] 1fr [middle] 1fr [end];
    grid-template-rows: [header] auto [content] 1fr [footer];
}

.header {
    grid-column: start / end;
    grid-row: header;
}

.sidebar {
    grid-column: start / middle;
    grid-row: content;
}

.main {
    grid-column: middle / end;
    grid-row: content;
}

/* 实际应用示例 */
.dashboard {
    display: grid;
    grid-template-areas: 
        "header header header"
        "sidebar main aside"
        "footer footer footer";
    grid-template-columns: 200px 1fr 200px;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
}

.dashboard-header {
    grid-area: header;
}

.dashboard-sidebar {
    grid-area: sidebar;
}

.dashboard-main {
    grid-area: main;
}

.dashboard-aside {
    grid-area: aside;
}

.dashboard-footer {
    grid-area: footer;
}
```

### 多列布局

多列布局适用于报纸风格的文本排版：

```css
.multicolumn {
    column-count: 3; /* 列数 */
    column-width: 200px; /* 列宽 */
    column-gap: 2rem; /* 列间距 */
    column-rule: 1px solid #ccc; /* 列间分割线 */
}

.column-break {
    break-inside: avoid; /* 避免在此处分列 */
    page-break-inside: avoid; /* 兼容性 */
}

/* 实际应用 */
.newspaper {
    column-count: 4;
    column-gap: 2rem;
    column-rule: 1px solid #eee;
}

.news-article {
    break-inside: avoid;
    margin-bottom: 1rem;
}
```

### 定位机制详解

CSS提供了多种定位方式来精确控制元素的位置：

```css
/* 静态定位 - 默认值 */
.static {
    position: static;
}

/* 相对定位 - 相对于自身原来位置偏移 */
.relative {
    position: relative;
    top: 10px;
    left: 20px;
}

/* 绝对定位 - 相对于最近的已定位祖先元素 */
.absolute {
    position: absolute;
    top: 0;
    right: 0;
}

.parent {
    position: relative; /* 为子元素提供定位上下文 */
}

.child {
    position: absolute;
    top: 10px;
    left: 10px;
}

/* 固定定位 - 相对于视口固定 */
.fixed {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: white;
    z-index: 1000;
}

/* 粘性定位 - 在特定位置变为固定定位 */
.sticky {
    position: sticky;
    top: 0;
    background: white;
    z-index: 100;
}

/* 层叠上下文 */
.stacking-context {
    position: relative;
    z-index: 1; /* 创建层叠上下文 */
}

.overlay {
    position: absolute;
    z-index: 2; /* 相对于父级层叠上下文 */
}
```

## CSS动画与过渡

CSS动画可以让网页元素产生动态效果，提升用户体验。

### CSS过渡效果

过渡可以在元素状态改变时平滑地改变样式：

```css
.transition-example {
    width: 100px;
    height: 100px;
    background: blue;
    transition: all 0.3s ease-in-out; /* 属性 持续时间 缓动函数 延迟 */
}

.transition-example:hover {
    width: 200px;
    height: 200px;
    background: red;
    transform: rotate(45deg);
}

/* 多个过渡属性 */
.multi-transition {
    transition-property: width, height, background-color;
    transition-duration: 0.3s, 0.5s, 0.2s;
    transition-timing-function: ease, linear, ease-in-out;
}

/* 简写形式 */
.shorthand-transition {
    transition: width 0.3s ease, height 0.5s linear 0.1s;
}
```

### CSS关键帧动画

关键帧动画可以创建复杂的动画序列：

```css
@keyframes slideIn {
    0% {
        transform: translateX(-100%);
        opacity: 0;
    }
    100% {
        transform: translateX(0);
        opacity: 1;
    }
}

.slide-in-animation {
    animation-name: slideIn;
    animation-duration: 0.5s;
    animation-timing-function: ease-out;
    animation-delay: 0.1s;
    animation-iteration-count: 1;
    animation-direction: normal;
    animation-fill-mode: forwards;
    /* 简写: animation: name duration timing-function delay iteration-count direction fill-mode play-state */
    animation: slideIn 0.5s ease-out 0.1s 1 normal forwards;
}

/* 循环动画 */
.pulse {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        transform: scale(1);
    }
}

/* 多个关键帧 */
.color-change {
    animation: colorChange 3s infinite;
}

@keyframes colorChange {
    0% { background: red; }
    25% { background: yellow; }
    50% { background: green; }
    75% { background: blue; }
    100% { background: red; }
}
```

### 3D变换与透视

CSS 3D变换可以创建立体效果：

```css
.perspective-container {
    perspective: 1000px; /* 设置透视距离 */
    width: 200px;
    height: 200px;
    margin: 100px auto;
}

.transform-element {
    width: 100%;
    height: 100%;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    transform-style: preserve-3d; /* 保留3D变换 */
    transition: transform 1s;
}

.perspective-container:hover .transform-element {
    transform: rotateY(180deg) rotateX(15deg);
}

/* 3D立方体 */
.cube {
    position: relative;
    width: 200px;
    height: 200px;
    transform-style: preserve-3d;
    animation: rotate 10s infinite linear;
}

.cube-face {
    position: absolute;
    width: 200px;
    height: 200px;
    border: 2px solid black;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
    font-weight: bold;
}

.front { transform: translateZ(100px); background: rgba(255, 0, 0, 0.7); }
.back { transform: rotateY(180deg) translateZ(100px); background: rgba(0, 255, 0, 0.7); }
.right { transform: rotateY(90deg) translateZ(100px); background: rgba(0, 0, 255, 0.7); }
.left { transform: rotateY(-90deg) translateZ(100px); background: rgba(255, 255, 0, 0.7); }
.top { transform: rotateX(90deg) translateZ(100px); background: rgba(255, 0, 255, 0.7); }
.bottom { transform: rotateX(-90deg) translateZ(100px); background: rgba(0, 255, 255, 0.7); }

@keyframes rotate {
    from { transform: rotateX(0) rotateY(0); }
    to { transform: rotateX(360deg) rotateY(360deg); }
}
```

### 动画性能优化

优化CSS动画性能的关键是使用合适的属性和避免重排重绘：

```css
/* 好的动画属性 - 只触发合成 */
.optimized-animation {
    will-change: transform; /* 提示浏览器该元素将要发生变化 */
    transform: translateZ(0); /* 创建新的合成层 */
    backface-visibility: hidden; /* 优化3D变换 */
}

.move-animation {
    animation: move 1s ease-in-out;
}

@keyframes move {
    from { transform: translateX(0); }
    to { transform: translateX(100px); }
}

/* 避免触发布局或绘制的属性 */
.bad-animation {
    /* 避免这些属性做动画 */
    /* width, height, margin, padding, border, top, left, color, background-color */
}

.good-animation {
    /* 优先使用这些属性做动画 */
    /* transform, opacity, filter */
}
```

## 响应式设计

响应式设计确保网站在不同设备上都能良好显示。

### 媒体查询详解

媒体查询允许根据不同设备特征应用不同样式：

```css
/* 基本媒体查询 */
@media screen and (max-width: 768px) {
    .container {
        width: 100%;
        padding: 1rem;
    }
}

/* 复杂媒体查询 */
@media screen and (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) {
    .sidebar {
        width: 30%;
    }
}

/* 设备特性查询 */
@media (hover: hover) {
    /* 支持悬停的设备 */
    .button:hover {
        background: #007bff;
    }
}

@media (hover: none) {
    /* 不支持悬停的设备（触摸屏） */
    .button:active {
        background: #007bff;
    }
}

/* 高分辨率屏幕 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .logo {
        background-image: url(logo@2x.png);
        background-size: 100px 50px;
    }
}

/* 打印样式 */
@media print {
    .navigation,
    .advertisement {
        display: none;
    }
    
    .content {
        font-size: 12pt;
        color: black;
    }
}
```

### 移动优先设计

移动优先的设计理念是从最小屏幕开始设计，然后逐步增强：

```css
/* 基础样式 - 移动设备 */
.grid {
    display: block;
}

.grid-item {
    width: 100%;
    margin-bottom: 1rem;
}

/* 平板设备 */
@media (min-width: 768px) {
    .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
    
    .grid-item {
        width: auto;
        margin-bottom: 0;
    }
}

/* 桌面设备 */
@media (min-width: 1024px) {
    .grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* 大屏设备 */
@media (min-width: 1200px) {
    .grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
```

### 断点策略

合理的断点策略应该基于内容而非设备：

```css
/* 常用断点 */
:root {
    --breakpoint-xs: 0;
    --breakpoint-sm: 576px;
    --breakpoint-md: 768px;
    --breakpoint-lg: 992px;
    --breakpoint-xl: 1200px;
    --breakpoint-xxl: 1400px;
}

/* 容器查询 - 现代响应式方案 */
.container {
    container-type: inline-size;
}

@container (min-width: 400px) {
    .card {
        display: flex;
        gap: 1rem;
    }
    
    .card-image {
        flex: 0 0 150px;
    }
}
```

### 弹性单位

使用相对单位创建更灵活的布局：

```css
/* rem单位 - 相对于根元素字体大小 */
html {
    font-size: 16px; /* 基准字体大小 */
}

.title {
    font-size: 2rem; /* 32px */
    margin-bottom: 1rem; /* 16px */
}

/* em单位 - 相对于父元素字体大小 */
.button {
    font-size: 0.875rem; /* 14px */
    padding: 0.5em 1em; /* 7px 14px */
}

/* 视口单位 */
.hero {
    height: 100vh; /* 视口高度 */
    width: 100vw; /* 视口宽度 */
}

.responsive-text {
    font-size: calc(1rem + 1vw); /* 响应式字体大小 */
}

/* clamp函数 - 更精确的响应式值 */
.heading {
    font-size: clamp(1.5rem, 4vw, 3rem); /* 最小值，首选值，最大值 */
}
```

## CSS预处理器

CSS预处理器扩展了CSS的功能，提供了变量、嵌套、混合等功能。

### Sass/SCSS基础

Sass有两种语法：缩进语法(.sass)和SCSS语法(.scss)：

```scss
// SCSS变量
$primary-color: #007bff;
$secondary-color: #6c757d;
$font-size-base: 1rem;
$border-radius: 0.25rem;

// 嵌套规则
.navbar {
    background: $primary-color;
    
    .nav-link {
        color: white;
        padding: 0.5rem 1rem;
        
        &:hover {
            background: darken($primary-color, 10%);
        }
        
        &.active {
            font-weight: bold;
        }
    }
    
    @media (max-width: 768px) {
        flex-direction: column;
    }
}

// 父选择器引用
.button {
    background: $primary-color;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: $border-radius;
    
    &:hover {
        background: darken($primary-color, 10%);
    }
    
    &:active {
        transform: translateY(1px);
    }
    
    &:focus {
        outline: 2px solid lighten($primary-color, 20%);
        outline-offset: 2px;
    }
}
```

### 变量与混合

变量和混合是预处理器的核心功能：

```scss
// 变量
$colors: (
    primary: #007bff,
    secondary: #6c757d,
    success: #28a745,
    danger: #dc3545
);

$spacing: (
    xs: 0.25rem,
    sm: 0.5rem,
    md: 1rem,
    lg: 1.5rem,
    xl: 3rem
);

// 函数
@function map-get-default($map, $key, $default: null) {
    @if map-has-key($map, $key) {
        @return map-get($map, $key);
    }
    @return $default;
}

// 混合
@mixin button-variant($background, $border, $hover-background: darken($background, 7.5%), $hover-border: darken($border, 10%)) {
    color: color-yiq($background);
    background-color: $background;
    border-color: $border;
    
    &:hover {
        color: color-yiq($hover-background);
        background-color: $hover-background;
        border-color: $hover-border;
    }
    
    &:focus,
    &.focus {
        box-shadow: 0 0 0 0.2rem rgba($background, 0.25);
    }
}

// 使用混合
.btn-primary {
    @include button-variant(map-get($colors, primary), map-get($colors, primary));
}

.btn-secondary {
    @include button-variant(map-get($colors, secondary), map-get($colors, secondary));
}

// 占位符选择器
%clearfix {
    &::after {
        display: block;
        content: "";
        clear: both;
    }
}

.row {
    @extend %clearfix;
}
```

### 函数与继承

预处理器提供了强大的函数和继承机制：

```scss
// 内置函数
.text-shadow {
    text-shadow: 
        darken($primary-color, 10%) 2px 2px 4px,
        lighten($primary-color, 20%) 0 0 10px;
}

.gradient-bg {
    background: linear-gradient(
        to right,
        $primary-color,
        adjust-hue($primary-color, 30deg)
    );
}

// 自定义函数
@function strip-unit($number) {
    @if type-of($number) == 'number' and not unitless($number) {
        @return $number / ($number * 0 + 1);
    }
    @return $number;
}

@function rem($px-value) {
    @return #{strip-unit($px-value) / 16}rem;
}

.spacing {
    margin: rem(24px);
    padding: rem(16px);
}

// 继承
.alert {
    padding: 1rem;
    margin-bottom: 1rem;
    border: 1px solid transparent;
    border-radius: $border-radius;
}

.alert-success {
    @extend .alert;
    background-color: #d4edda;
    border-color: #c3e6cb;
    color: #155724;
}

.alert-danger {
    @extend .alert;
    background-color: #f8d7da;
    border-color: #f5c6cb;
    color: #721c24;
}
```

### 模块化管理

使用模块化管理大型样式项目：

```scss
// _variables.scss
$primary-color: #007bff;
$secondary-color: #6c757d;
$font-size-base: 1rem;

// _mixins.scss
@mixin clearfix {
    &::after {
        display: block;
        content: "";
        clear: both;
    }
}

// _buttons.scss
@import 'variables';
@import 'mixins';

.btn {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    font-size: $font-size-base;
    border: 1px solid transparent;
    border-radius: $border-radius;
}

.btn-primary {
    @include button-variant($primary-color, $primary-color);
}

// main.scss
@import 'variables';
@import 'mixins';
@import 'buttons';
@import 'forms';
@import 'components/card';
@import 'components/navbar';
@import 'utilities';
```

## CSS架构与方法论

良好的CSS架构可以提高代码的可维护性和可扩展性。

### BEM命名规范

BEM (Block Element Modifier) 是一种流行的CSS命名方法论：

```css
/* Block - 独立的组件 */
.card {
    display: block;
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Element - Block的组成部分 */
.card__header {
    padding: 1rem;
    border-bottom: 1px solid #eee;
}

.card__title {
    margin: 0;
    font-size: 1.25rem;
}

.card__body {
    padding: 1rem;
}

.card__footer {
    padding: 1rem;
    border-top: 1px solid #eee;
    text-align: right;
}

/* Modifier - Block或Element的不同状态或变体 */
.card--featured {
    border: 2px solid gold;
}

.card__title--large {
    font-size: 1.5rem;
}

.card__button--primary {
    background: #007bff;
    color: white;
}

.card__button--secondary {
    background: #6c757d;
    color: white;
}
```

### SMACSS架构

SMACSS (Scalable and Modular Architecture for CSS) 将样式分为五类：

```css
/* 1. Base - 默认样式 */
body {
    font-family: Arial, sans-serif;
    line-height: 1.5;
}

/* 2. Layout - 页面布局 */
.l-header {
    background: #333;
    color: white;
}

.l-main {
    display: flex;
    min-height: calc(100vh - 100px);
}

.l-sidebar {
    flex: 0 0 250px;
    background: #f5f5f5;
}

.l-content {
    flex: 1;
    padding: 1rem;
}

/* 3. Module - 可重用的UI组件 */
.button {
    display: inline-block;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

/* 4. State - 状态样式 */
.is-hidden {
    display: none !important;
}

.is-active {
    background: #007bff;
    color: white;
}

/* 5. Theme - 主题样式 */
.theme-dark {
    --bg-color: #333;
    --text-color: #fff;
    --border-color: #555;
}
```

### OOCSS原则

OOCSS (Object Oriented CSS) 强调结构和皮肤的分离：

```css
/* 结构样式 - 定义布局和尺寸 */
.media {
    display: flex;
    align-items: flex-start;
}

.media-object {
    flex: 0 0 auto;
    margin-right: 1rem;
}

.media-body {
    flex: 1;
}

/* 皮肤样式 - 定义视觉外观 */
.box {
    padding: 1rem;
    border: 1px solid;
}

.box-light {
    background: white;
    border-color: #ddd;
}

.box-dark {
    background: #333;
    border-color: #555;
    color: white;
}

/* 使用示例 */
<div class="media box box-light">
    <img class="media-object" src="avatar.jpg" alt="">
    <div class="media-body">
        <h3>标题</h3>
        <p>内容...</p>
    </div>
</div>
```

### CSS-in-JS

CSS-in-JS将CSS样式直接写在JavaScript中：

```javascript
// styled-components示例
import styled from 'styled-components';

const Button = styled.button`
    background: ${props => props.primary ? '#007bff' : '#6c757d'};
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    
    &:hover {
        background: ${props => props.primary ? '#0056b3' : '#545b62'};
    }
    
    @media (max-width: 768px) {
        width: 100%;
        margin-bottom: 0.5rem;
    }
`;

const Container = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    
    ${props => props.fluid && `
        max-width: 100%;
        padding: 0;
    `}
`;

// 使用
function App() {
    return (
        <Container>
            <Button primary>主要按钮</Button>
            <Button>次要按钮</Button>
        </Container>
    );
}
```

## 现代CSS特性

现代CSS引入了许多强大的新特性，极大地提升了开发体验。

### CSS自定义属性(CSS变量)

CSS自定义属性提供了真正的变量支持：

```css
:root {
    --primary-color: #007bff;
    --secondary-color: #6c757d;
    --font-size-base: 1rem;
    --border-radius: 0.25rem;
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 3rem;
}

.button {
    background: var(--primary-color);
    color: white;
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
    cursor: pointer;
}

.button:hover {
    background: color-mix(in srgb, var(--primary-color), black 20%);
}

/* 动态修改变量 */
.dark-theme {
    --primary-color: #375a7f;
    --background-color: #222;
    --text-color: #fff;
}

/* 媒体查询中的变量 */
@media (max-width: 768px) {
    :root {
        --font-size-base: 0.875rem;
        --spacing-md: 0.75rem;
    }
}

/* 内联样式覆盖 */
<div style="--primary-color: #28a745;">
    <button class="button">自定义颜色按钮</button>
</div>
```

### CSS Grid高级用法

CSS Grid的高级特性可以创建复杂的布局：

```css
/* minmax函数 */
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
}

/* auto-fit vs auto-fill */
.auto-fit {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.auto-fill {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

/* dense packing */
.dense-grid {
    grid-auto-flow: dense;
}

.span-two {
    grid-column: span 2;
}

/* subgrid - 嵌套网格继承父网格线 */
.parent-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto 1fr;
}

.nested-grid {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
}
```

### CSS Shapes

CSS Shapes允许文本围绕不规则形状排列：

```css
.shape {
    float: left;
    shape-outside: circle(50%);
    shape-margin: 1rem;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, #007bff, #0056b3);
    clip-path: circle(50%);
}

/* 多边形形状 */
.polygon-shape {
    float: right;
    shape-outside: polygon(0 0, 100% 0, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0 75%);
    width: 300px;
    height: 300px;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
}

/* 路径形状 */
.path-shape {
    float: left;
    shape-outside: path('M10 10 H 90 V 90 H 10 L 10 10');
    width: 100px;
    height: 100px;
}
```

### CSS Scroll Snap

CSS Scroll Snap创建吸附滚动效果：

```css
.scroll-container {
    scroll-snap-type: x mandatory; /* x | y | both */
    overflow-x: scroll;
    display: flex;
    height: 300px;
}

.scroll-item {
    scroll-snap-align: start; /* start | end | center */
    flex: 0 0 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
}

/* 垂直滚动吸附 */
.vertical-scroll {
    scroll-snap-type: y proximity; /* proximity | mandatory */
    height: 100vh;
    overflow-y: scroll;
}

.section {
    scroll-snap-align: start;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

## 总结

通过本文的学习，我们深入了解了CSS的高级特性和最佳实践：

1. **CSS选择器进阶**：掌握属性选择器、伪类与伪元素、组合选择器以及优先级计算
2. **CSS布局深入**：精通Flexbox、Grid、多列布局和定位机制
3. **CSS动画与过渡**：学会创建流畅的过渡效果和关键帧动画，掌握3D变换
4. **响应式设计**：理解媒体查询、移动优先设计、断点策略和弹性单位
5. **CSS预处理器**：掌握Sass/SCSS的变量、混合、函数和模块化管理
6. **CSS架构与方法论**：了解BEM、SMACSS、OOCSS和CSS-in-JS等架构方法
7. **现代CSS特性**：熟练使用CSS变量、Grid高级用法、Shapes和Scroll Snap等新特性

这些高级特性和最佳实践将帮助你构建更加现代化、高性能的Web应用界面。