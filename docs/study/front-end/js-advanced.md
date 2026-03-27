# JavaScript深入详解

在掌握了JavaScript的基础知识后，我们可以进一步探索JavaScript的高级特性和最佳实践。本文将详细介绍闭包与作用域、原型链与继承、异步编程、ES6+新特性、设计模式、模块化、性能优化等核心概念。

## 闭包与作用域

闭包是JavaScript中的一个重要概念，它允许函数访问并操作函数外部的变量。

### 作用域链

```javascript
// 全局作用域
var globalVar = "我是全局变量";

function outerFunction() {
    // 函数作用域
    var outerVar = "我是外层函数变量";
    
    function innerFunction() {
        // 内层函数可以访问外层函数和全局作用域的变量
        var innerVar = "我是内层函数变量";
        console.log(globalVar); // 访问全局变量
        console.log(outerVar);  // 访问外层函数变量
        console.log(innerVar);  // 访问自身变量
    }
    
    innerFunction();
}

outerFunction();
```

### 闭包的实际应用

```javascript
// 1. 数据私有化
function createCounter() {
    let count = 0; // 私有变量
    
    return {
        increment: function() {
            count++;
            return count;
        },
        decrement: function() {
            count--;
            return count;
        },
        getCount: function() {
            return count;
        }
    };
}

const counter = createCounter();
console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.getCount());  // 2
// console.log(count); // 错误：无法直接访问count

// 2. 函数工厂
function createMultiplier(multiplier) {
    return function(number) {
        return number * multiplier;
    };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15
```

## 原型链与继承

JavaScript是一门基于原型的语言，理解原型链对于掌握JavaScript至关重要。

### 原型基础

```javascript
// 构造函数
function Person(name, age) {
    this.name = name;
    this.age = age;
}

Person.prototype.sayHello = function() {
    console.log(`你好，我是${this.name}`);
};

const person1 = new Person("张三", 25);
person1.sayHello(); // 你好，我是张三

// 查看原型链
console.log(person1.__proto__ === Person.prototype); // true
console.log(Person.prototype.__proto__ === Object.prototype); // true
console.log(Object.prototype.__proto__ === null); // true
```

### ES6 Class语法

```javascript
// ES6 Class
class Animal {
    constructor(name) {
        this.name = name;
    }
    
    speak() {
        console.log(`${this.name} 发出声音`);
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);
        this.breed = breed;
    }
    
    speak() {
        super.speak();
        console.log(`${this.name} 汪汪叫`);
    }
    
    wagTail() {
        console.log(`${this.name} 摇尾巴`);
    }
}

const dog = new Dog("旺财", "金毛");
dog.speak(); // 旺财 发出声音 \n 旺财 汪汪叫
dog.wagTail(); // 旺财 摇尾巴
```

## 异步编程

JavaScript的异步编程是其核心特性之一，掌握异步编程对于构建现代Web应用至关重要。

### Promise详解

```javascript
// 创建Promise
function fetchData(url) {
    return new Promise((resolve, reject) => {
        // 模拟异步操作
        setTimeout(() => {
            if (url) {
                resolve(`数据来自: ${url}`);
            } else {
                reject(new Error("URL不能为空"));
            }
        }, 1000);
    });
}

// 使用Promise
fetchData("https://api.example.com/data")
    .then(data => {
        console.log(data);
        return fetchData("https://api.example.com/more-data");
    })
    .then(moreData => {
        console.log(moreData);
    })
    .catch(error => {
        console.error("错误:", error.message);
    });

// Promise.all 并行执行
Promise.all([
    fetchData("https://api.example.com/data1"),
    fetchData("https://api.example.com/data2"),
    fetchData("https://api.example.com/data3")
]).then(results => {
    console.log("所有数据:", results);
}).catch(error => {
    console.error("其中一个请求失败:", error);
});
```

### Async/Await语法

```javascript
// 使用async/await
async function fetchUserData() {
    try {
        const userData = await fetchData("https://api.example.com/user");
        console.log(userData);
        
        const userPermissions = await fetchData(`https://api.example.com/user/${userData.id}/permissions`);
        console.log(userPermissions);
        
        return { user: userData, permissions: userPermissions };
    } catch (error) {
        console.error("获取用户数据失败:", error.message);
        throw error;
    }
}

// 调用async函数
fetchUserData().then(result => {
    console.log("用户数据获取成功:", result);
}).catch(error => {
    console.error("处理用户数据时出错:", error);
});

// 并行执行多个异步操作
async function fetchMultipleData() {
    try {
        // 并行执行，而不是串行
        const [data1, data2, data3] = await Promise.all([
            fetchData("https://api.example.com/data1"),
            fetchData("https://api.example.com/data2"),
            fetchData("https://api.example.com/data3")
        ]);
        
        return { data1, data2, data3 };
    } catch (error) {
        console.error("获取数据失败:", error.message);
        throw error;
    }
}
```

## ES6+新特性

ES6及后续版本为JavaScript带来了许多强大的新特性。

### 解构赋值

```javascript
// 数组解构
const numbers = [1, 2, 3, 4, 5];
const [first, second, ...rest] = numbers;
console.log(first); // 1
console.log(second); // 2
console.log(rest); // [3, 4, 5]

// 对象解构
const person = { name: "张三", age: 25, city: "北京" };
const { name, age, city: location } = person;
console.log(name); // 张三
console.log(age); // 25
console.log(location); // 北京

// 函数参数解构
function printPerson({ name, age, city = "未知" }) {
    console.log(`姓名: ${name}, 年龄: ${age}, 城市: ${city}`);
}

printPerson(person); // 姓名: 张三, 年龄: 25, 城市: 北京
```

### 模板字符串

```javascript
const name = "张三";
const age = 25;

// 基本用法
const greeting = `你好，我是${name}，今年${age}岁`;
console.log(greeting); // 你好，我是张三，今年25岁

// 多行字符串
const multiline = `
这是第一行
这是第二行
这是第三行
`;

// 带表达式的模板字符串
const calculation = `10 + 20 = ${10 + 20}`;
console.log(calculation); // 10 + 20 = 30

// 标签模板
function highlight(strings, ...values) {
    let result = "";
    strings.forEach((string, i) => {
        result += string;
        if (values[i]) {
            result += `<strong>${values[i]}</strong>`;
        }
    });
    return result;
}

const message = highlight`你好，我是${name}，今年${age}岁`;
console.log(message); // 你好，我是<strong>张三</strong>，今年<strong>25</strong>岁
```

### 模块化

```javascript
// mathUtils.js - 命名导出
export const PI = 3.14159;

export function add(a, b) {
    return a + b;
}

export function multiply(a, b) {
    return a * b;
}

// 默认导出
export default function subtract(a, b) {
    return a - b;
}

// 另一种默认导出方式
// export default class Calculator {
//     add(a, b) { return a + b; }
//     subtract(a, b) { return a - b; }
// }

// main.js - 导入
import subtract, { PI, add, multiply } from './mathUtils.js';

console.log(PI); // 3.14159
console.log(add(2, 3)); // 5
console.log(multiply(4, 5)); // 20
console.log(subtract(10, 3)); // 7

// 导入所有命名导出
import * as mathUtils from './mathUtils.js';
console.log(mathUtils.PI); // 3.14159
console.log(mathUtils.add(1, 2)); // 3

// 导入时重命名
import { add as sum, multiply as product } from './mathUtils.js';
console.log(sum(2, 3)); // 5
console.log(product(4, 5)); // 20
```

## 设计模式

设计模式是在特定情况下解决软件设计问题的最佳实践。

### 单例模式

```javascript
// 单例模式实现
class DatabaseConnection {
    constructor() {
        if (DatabaseConnection.instance) {
            return DatabaseConnection.instance;
        }
        
        this.connection = null;
        DatabaseConnection.instance = this;
    }
    
    connect() {
        if (!this.connection) {
            // 模拟建立数据库连接
            this.connection = "数据库连接已建立";
            console.log(this.connection);
        } else {
            console.log("已经存在数据库连接");
        }
    }
    
    disconnect() {
        if (this.connection) {
            this.connection = null;
            console.log("数据库连接已断开");
        }
    }
}

// 使用单例
const db1 = new DatabaseConnection();
const db2 = new DatabaseConnection();

console.log(db1 === db2); // true

db1.connect(); // 数据库连接已建立
db2.connect(); // 已经存在数据库连接
```

### 观察者模式

```javascript
// 观察者模式实现
class Subject {
    constructor() {
        this.observers = [];
    }
    
    addObserver(observer) {
        this.observers.push(observer);
    }
    
    removeObserver(observer) {
        const index = this.observers.indexOf(observer);
        if (index > -1) {
            this.observers.splice(index, 1);
        }
    }
    
    notify(data) {
        this.observers.forEach(observer => observer.update(data));
    }
}

class Observer {
    constructor(name) {
        this.name = name;
    }
    
    update(data) {
        console.log(`${this.name} 收到通知: ${data}`);
    }
}

// 使用观察者模式
const subject = new Subject();

const observer1 = new Observer("观察者1");
const observer2 = new Observer("观察者2");

subject.addObserver(observer1);
subject.addObserver(observer2);

subject.notify("数据更新了"); 
// 观察者1 收到通知: 数据更新了
// 观察者2 收到通知: 数据更新了

subject.removeObserver(observer1);
subject.notify("又有新数据");
// 观察者2 收到通知: 又有新数据
```

## 性能优化

JavaScript性能优化对于提升用户体验至关重要。

### 内存管理

```javascript
// 避免内存泄漏
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    
    off(event, callback) {
        if (this.events[event]) {
            const index = this.events[event].indexOf(callback);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
    
    // 清理所有事件监听器，防止内存泄漏
    destroy() {
        this.events = {};
    }
}

// 使用WeakMap避免内存泄漏
const privateData = new WeakMap();

class MyClass {
    constructor(data) {
        privateData.set(this, data);
    }
    
    getData() {
        return privateData.get(this);
    }
}

// 当MyClass实例被垃圾回收时，WeakMap中的对应条目也会被自动清理
```

### 代码优化技巧

```javascript
// 1. 避免重复计算
function inefficientFilter(items, condition) {
    return items.filter(item => {
        // 每次迭代都会调用condition函数，效率低下
        return condition(item) && condition(item); // 重复计算
    });
}

function efficientFilter(items, condition) {
    return items.filter(item => {
        const result = condition(item); // 只计算一次
        return result && result;
    });
}

// 2. 使用文档片段减少DOM操作
function addItemsToList(items) {
    const fragment = document.createDocumentFragment();
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        fragment.appendChild(li);
    });
    
    document.getElementById('myList').appendChild(fragment);
}

// 3. 防抖和节流
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 使用防抖优化搜索
const searchInput = document.getElementById('search');
const debouncedSearch = debounce(function(event) {
    console.log('搜索:', event.target.value);
}, 300);

searchInput.addEventListener('input', debouncedSearch);
```

## 总结

通过本文的学习，我们深入了解了JavaScript的高级特性和最佳实践：

1. **闭包与作用域**：掌握闭包的概念和实际应用场景
2. **原型链与继承**：理解JavaScript的原型机制和ES6 Class语法
3. **异步编程**：熟练使用Promise和async/await处理异步操作
4. **ES6+新特性**：掌握解构赋值、模板字符串、模块化等现代JavaScript特性
5. **设计模式**：了解单例模式、观察者模式等常用设计模式的实现
6. **性能优化**：掌握内存管理和代码优化技巧

这些高级特性和最佳实践将帮助你构建更加现代化、高性能的Web应用。