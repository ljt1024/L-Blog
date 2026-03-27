# CSS基础

CSS（Cascading Style Sheets）用于控制网页的样式和布局。本文将介绍CSS的基本语法和常用属性。

## 什么是CSS？

CSS是一种样式表语言，用于描述HTML文档的外观和格式。它可以控制元素的颜色、字体、间距、布局等视觉效果。

## CSS语法

CSS规则由选择器和声明块组成：

```css
selector {
    property: value;
    property: value;
}
```

例如：
```css
h1 {
    color: blue;
    font-size: 24px;
}
```

## 引入CSS的方式

### 内联样式
```html
<p style="color: red;">红色文本</p>
```

### 内部样式表
```html
<head>
    <style>
        p {
            color: blue;
        }
    </style>
</head>
```

### 外部样式表
```html
<head>
    <link rel="stylesheet" href="styles.css">
</head>
```

## 常用CSS属性

### 文本样式
```css
color: #333;           /* 文字颜色 */
font-size: 16px;       /* 字体大小 */
font-family: Arial;    /* 字体族 */
text-align: center;    /* 文本对齐 */
```

### 盒模型
```css
width: 200px;          /* 宽度 */
height: 100px;         /* 高度 */
padding: 10px;         /* 内边距 */
margin: 20px;          /* 外边距 */
border: 1px solid #000; /* 边框 */
```

## CSS选择器

### 元素选择器
```css
p { color: red; }  /* 选择所有<p>元素 */
```

### 类选择器
```css
.highlight { background-color: yellow; }  /* 选择class="highlight"的元素 */
```

### ID选择器
```css
#header { background-color: #333; }  /* 选择id="header"的元素 */
```

## 总结

CSS是网页美化的重要工具，掌握基本的CSS语法和属性能够帮助我们创建美观的网页界面。