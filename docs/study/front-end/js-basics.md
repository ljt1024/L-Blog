# JavaScript基础语法

JavaScript是一种广泛使用的编程语言，主要用于网页开发，为网页添加交互功能。本文将介绍JavaScript的基本语法和概念。

## 什么是JavaScript？

JavaScript是一种轻量级的解释型编程语言，具有动态性、弱类型等特点。它可以直接嵌入HTML页面中，使网页具有动态交互能力。

## JavaScript的基本语法

### 变量声明
```javascript
// 使用var声明变量（ES5）
var name = "张三";
var age = 25;

// 使用let声明块级作用域变量（ES6）
let city = "北京";

// 使用const声明常量（ES6）
const PI = 3.14159;
```

### 数据类型
JavaScript有以下几种基本数据类型：
- Number（数字）
- String（字符串）
- Boolean（布尔值）
- Undefined（未定义）
- Null（空值）

```javascript
let num = 42;           // Number
let str = "Hello";      // String
let bool = true;        // Boolean
let undef = undefined;  // Undefined
let empty = null;       // Null
```

### 函数
```javascript
// 函数声明
function greet(name) {
    return "Hello, " + name;
}

// 函数表达式
const add = function(a, b) {
    return a + b;
};

// 箭头函数（ES6）
const multiply = (a, b) => a * b;
```

### 条件语句
```javascript
let score = 85;

if (score >= 90) {
    console.log("优秀");
} else if (score >= 60) {
    console.log("及格");
} else {
    console.log("不及格");
}
```

### 循环语句
```javascript
// for循环
for (let i = 0; i < 5; i++) {
    console.log(i);
}

// while循环
let count = 0;
while (count < 3) {
    console.log(count);
    count++;
}
```

## DOM操作

JavaScript可以通过DOM（文档对象模型）来操作网页元素：

```javascript
// 获取元素
const element = document.getElementById("myId");

// 修改内容
element.innerHTML = "新的内容";

// 修改样式
element.style.color = "red";

// 添加事件监听器
element.addEventListener("click", function() {
    alert("元素被点击了！");
});
```

## 总结

JavaScript是现代Web开发不可缺少的一部分，掌握其基本语法是学习前端开发的重要基础。随着ES6及更高版本的推出，JavaScript的功能更加强大和易用。