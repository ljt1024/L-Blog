# Web Components 完全指南：构建可复用的原生组件系统

## 前言

Web Components 是一套用于创建可复用、自定义 HTML 元素的 Web 标准。它由四个核心技术组成：Custom Elements、Shadow DOM、HTML Templates 和 HTML Imports（已废弃，改用 ES Modules）。

本文将从原理到实战，深入讲解如何使用 Web Components 构建高效、可维护的组件系统。

## 一、Web Components 核心概念

### 1.1 四大支柱

| 技术 | 作用 | 状态 |
|------|------|------|
| Custom Elements | 定义自定义 HTML 元素 | ✅ 标准 |
| Shadow DOM | 封装样式和 DOM 结构 | ✅ 标准 |
| HTML Templates | 定义可复用的 HTML 模板 | ✅ 标准 |
| HTML Imports | 导入 HTML 文档 | ❌ 已废弃 |

### 1.2 为什么需要 Web Components？

```javascript
// ❌ 传统方式：框架依赖，难以复用
// React 组件只能在 React 中用
// Vue 组件只能在 Vue 中用

// ✅ Web Components：框架无关，真正可复用
// 可以在任何框架中使用
// 可以在原生 HTML 中使用
// 可以跨项目、跨团队共享
```

## 二、Custom Elements（自定义元素）

### 2.1 基础用法

```javascript
// 定义一个自定义元素
class MyButton extends HTMLElement {
  constructor() {
    super();
    // 初始化逻辑
  }

  connectedCallback() {
    // 元素插入 DOM 时调用
    this.render();
  }

  render() {
    this.textContent = 'Click me!';
  }
}

// 注册自定义元素
customElements.define('my-button', MyButton);
```

```html
<!-- 使用自定义元素 -->
<my-button></my-button>
```

### 2.2 生命周期钩子

```javascript
class LifecycleDemo extends HTMLElement {
  constructor() {
    super();
    console.log('1. constructor - 元素被创建');
  }

  connectedCallback() {
    console.log('2. connectedCallback - 元素插入 DOM');
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    console.log('3. disconnectedCallback - 元素从 DOM 移除');
    this.removeEventListener('click', this.handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`4. attributeChangedCallback - 属性 ${name} 从 ${oldValue} 变为 ${newValue}`);
  }

  adoptedCallback() {
    console.log('5. adoptedCallback - 元素被移到新文档');
  }

  handleClick = () => {
    console.log('Clicked!');
  };

  // 声明需要监听的属性
  static get observedAttributes() {
    return ['title', 'disabled'];
  }
}

customElements.define('lifecycle-demo', LifecycleDemo);
```

### 2.3 属性和方法

```javascript
class Counter extends HTMLElement {
  constructor() {
    super();
    this._count = 0;
  }

  connectedCallback() {
    this.render();
    this.querySelector('button').addEventListener('click', () => this.increment());
  }

  increment() {
    this._count++;
    this.render();
  }

  // 暴露公共方法
  reset() {
    this._count = 0;
    this.render();
  }

  // 定义 getter/setter
  get count() {
    return this._count;
  }

  set count(value) {
    this._count = value;
    this.render();
  }

  render() {
    this.innerHTML = `
      <p>Count: ${this._count}</p>
      <button>Increment</button>
    `;
  }
}

customElements.define('my-counter', Counter);
```

```html
<my-counter></my-counter>

<script>
  const counter = document.querySelector('my-counter');
  counter.count = 10;  // 使用 setter
  console.log(counter.count);  // 10
  counter.reset();  // 调用方法
</script>
```

## 三、Shadow DOM（影子 DOM）

### 3.1 什么是 Shadow DOM？

Shadow DOM 提供了样式和 DOM 结构的封装，防止外部样式污染组件内部。

```javascript
class StyledButton extends HTMLElement {
  connectedCallback() {
    // 创建 Shadow Root
    const shadow = this.attachShadow({ mode: 'open' });

    // 添加样式（只在 Shadow DOM 内生效）
    const style = document.createElement('style');
    style.textContent = `
      button {
        background-color: #007bff;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }

      button:hover {
        background-color: #0056b3;
      }

      button:active {
        transform: scale(0.98);
      }
    `;

    // 添加 HTML 结构
    const button = document.createElement('button');
    button.textContent = this.getAttribute('label') || 'Click me';

    shadow.appendChild(style);
    shadow.appendChild(button);

    button.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('btn-click', { detail: { time: Date.now() } }));
    });
  }
}

customElements.define('styled-button', StyledButton);
```

```html
<!-- 外部样式不会影响组件内部 -->
<style>
  button {
    background-color: red;  /* 不会影响 styled-button 内的按钮 */
  }
</style>

<styled-button label="Submit"></styled-button>

<script>
  document.querySelector('styled-button').addEventListener('btn-click', (e) => {
    console.log('Button clicked at:', e.detail.time);
  });
</script>
```

### 3.2 Slot（插槽）

```javascript
class Card extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        .card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .header {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 10px;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
        }

        .content {
          margin-bottom: 10px;
        }

        .footer {
          text-align: right;
          color: #666;
          font-size: 12px;
        }
      </style>

      <div class="card">
        <div class="header">
          <slot name="title">Default Title</slot>
        </div>
        <div class="content">
          <slot>Default content goes here</slot>
        </div>
        <div class="footer">
          <slot name="footer">© 2026</slot>
        </div>
      </div>
    `;
  }
}

customElements.define('my-card', Card);
```

```html
<my-card>
  <span slot="title">My Article</span>
  <p>This is the main content of the card.</p>
  <span slot="footer">© 2026 My Company</span>
</my-card>
```

## 四、HTML Templates（模板）

### 4.1 使用 Template 标签

```html
<template id="product-template">
  <style>
    .product {
      border: 1px solid #ddd;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .price {
      color: #e74c3c;
      font-weight: bold;
      font-size: 18px;
    }
  </style>

  <div class="product">
    <h3 class="name"></h3>
    <p class="description"></p>
    <div class="price"></div>
    <button class="add-to-cart">Add to Cart</button>
  </div>
</template>

<script>
  class ProductCard extends HTMLElement {
    connectedCallback() {
      const template = document.getElementById('product-template');
      const clone = template.content.cloneNode(true);

      // 填充数据
      clone.querySelector('.name').textContent = this.getAttribute('name');
      clone.querySelector('.description').textContent = this.getAttribute('description');
      clone.querySelector('.price').textContent = '$' + this.getAttribute('price');

      clone.querySelector('.add-to-cart').addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('add-to-cart', {
          detail: { product: this.getAttribute('name') }
        }));
      });

      this.appendChild(clone);
    }
  }

  customElements.define('product-card', ProductCard);
</script>

<product-card
  name="Laptop"
  description="High-performance laptop"
  price="999"
></product-card>
```

## 五、实战案例：构建一个完整的表单组件

```javascript
class FormInput extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    const label = this.getAttribute('label') || '';
    const type = this.getAttribute('type') || 'text';
    const required = this.hasAttribute('required');
    const placeholder = this.getAttribute('placeholder') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin-bottom: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #333;
          font-size: 14px;
        }

        label .required {
          color: #e74c3c;
          margin-left: 4px;
        }

        input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        input:invalid {
          border-color: #e74c3c;
        }

        .error-message {
          color: #e74c3c;
          font-size: 12px;
          margin-top: 4px;
          display: none;
        }

        .error-message.show {
          display: block;
        }
      </style>

      <div class="form-group">
        <label>
          ${label}
          ${required ? '<span class="required">*</span>' : ''}
        </label>
        <input
          type="${type}"
          placeholder="${placeholder}"
          ${required ? 'required' : ''}
        />
        <div class="error-message"></div>
      </div>
    `;
  }

  setupEventListeners() {
    const input = this.shadowRoot.querySelector('input');
    const errorMessage = this.shadowRoot.querySelector('.error-message');

    input.addEventListener('blur', () => {
      this.validate();
    });

    input.addEventListener('input', (e) => {
      this.dispatchEvent(new CustomEvent('input-change', {
        detail: { value: e.target.value }
      }));
    });
  }

  validate() {
    const input = this.shadowRoot.querySelector('input');
    const errorMessage = this.shadowRoot.querySelector('.error-message');

    if (input.hasAttribute('required') && !input.value.trim()) {
      errorMessage.textContent = 'This field is required';
      errorMessage.classList.add('show');
      return false;
    }

    if (input.type === 'email' && input.value && !this.isValidEmail(input.value)) {
      errorMessage.textContent = 'Please enter a valid email';
      errorMessage.classList.add('show');
      return false;
    }

    errorMessage.classList.remove('show');
    return true;
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getValue() {
    return this.shadowRoot.querySelector('input').value;
  }

  setValue(value) {
    this.shadowRoot.querySelector('input').value = value;
  }

  static get observedAttributes() {
    return ['label', 'type', 'placeholder', 'required'];
  }

  attributeChangedCallback() {
    this.render();
  }
}

customElements.define('form-input', FormInput);
```

```html
<form id="myForm">
  <form-input
    label="Email"
    type="email"
    placeholder="Enter your email"
    required
  ></form-input>

  <form-input
    label="Password"
    type="password"
    placeholder="Enter your password"
    required
  ></form-input>

  <form-input
    label="Full Name"
    type="text"
    placeholder="Enter your name"
  ></form-input>

  <button type="submit">Submit</button>
</form>

<script>
  const form = document.getElementById('myForm');
  const inputs = form.querySelectorAll('form-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    let isValid = true;
    const formData = {};

    inputs.forEach((input) => {
      if (!input.validate()) {
        isValid = false;
      }
      formData[input.getAttribute('label')] = input.getValue();
    });

    if (isValid) {
      console.log('Form data:', formData);
      // 提交表单
    }
  });
</script>
```

## 六、Web Components 与框架集成

### 6.1 在 Vue 3 中使用

```javascript
// 定义 Web Component
class MyCounter extends HTMLElement {
  constructor() {
    super();
    this._count = 0;
  }

  connectedCallback() {
    this.render();
  }

  increment() {
    this._count++;
    this.render();
  }

  render() {
    this.innerHTML = `<p>Count: ${this._count}</p>`;
  }
}

customElements.define('my-counter', MyCounter);
```

```vue
<template>
  <div>
    <my-counter ref="counter"></my-counter>
    <button @click="handleClick">Increment from Vue</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const counter = ref(null);

const handleClick = () => {
  counter.value.increment();
};
</script>
```

### 6.2 在 React 中使用

```javascript
import React, { useRef, useEffect } from 'react';

export function CounterWrapper() {
  const counterRef = useRef(null);

  const handleClick = () => {
    counterRef.current.increment();
  };

  return (
    <div>
      <my-counter ref={counterRef}></my-counter>
      <button onClick={handleClick}>Increment from React</button>
    </div>
  );
}
```

## 七、最佳实践

### 7.1 命名规范

```javascript
// ✅ 好的做法：使用连字符分隔
customElements.define('my-button', MyButton);
customElements.define('user-profile', UserProfile);
customElements.define('data-table', DataTable);

// ❌ 避免：单个单词或驼峰命名
// customElements.define('button', MyButton);  // 与原生元素冲突
// customElements.define('myButton', MyButton);  // 不符合规范
```

### 7.2 属性 vs 特性

```javascript
class MyElement extends HTMLElement {
  connectedCallback() {
    // 使用特性（attribute）传递初始数据
    const title = this.getAttribute('title');

    // 使用属性（property）暴露 API
    this.data = { /* ... */ };
  }

  static get observedAttributes() {
    return ['title', 'disabled'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // 监听特性变化
    if (name === 'title') {
      this.updateTitle(newValue);
    }
  }
}
```

### 7.3 性能优化

```javascript
class OptimizedComponent extends HTMLElement {
  constructor() {
    super();
    // 使用 Shadow DOM 避免样式污染
    this.attachShadow({ mode: 'open' });
    // 缓存 DOM 查询结果
    this._cachedElements = {};
  }

  connectedCallback() {
    // 使用事件委托
    this.addEventListener('click', this.handleClick);
    // 延迟初始化
    requestAnimationFrame(() => this.initialize());
  }

  disconnectedCallback() {
    // 清理事件监听
    this.removeEventListener('click', this.handleClick);
  }

  handleClick = (e) => {
    // 事件处理逻辑
  };

  initialize() {
    // 初始化逻辑
  }
}
```

## 八、浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| Custom Elements | ✅ 67+ | ✅ 63+ | ✅ 10.1+ | ✅ 79+ |
| Shadow DOM | ✅ 67+ | ✅ 63+ | ✅ 10.1+ | ✅ 79+ |
| HTML Templates | ✅ 26+ | ✅ 22+ | ✅ 8+ | ✅ 15+ |

对于不支持的浏览器，可以使用 polyfill：

```html
<script src="https://unpkg.com/@webcomponents/webcomponentsjs@2/webcomponents-loader.js"></script>
```

## 九、常见问题

### Q1: Web Components 会替代框架吗？

**A:** 不会。Web Components 和框架各有优势：
- Web Components：框架无关、原生支持、轻量级
- 框架：更好的开发体验、生态完善、工具链成熟

最佳实践是两者结合使用。

### Q2: 如何处理 Web Components 中的状态管理？

**A:** 可以使用：
- 简单场景：组件内部状态 + 事件通信
- 复杂场景：集成 Redux、Pinia 等状态管理库

### Q3: Shadow DOM 会影响 SEO 吗？

**A:** 是的。Shadow DOM 中的内容对搜索引擎不可见。解决方案：
- 关键内容放在 Light DOM
- 使用 `mode: 'open'` 允许外部访问
- 配合服务端渲染

## 总结

Web Components 是现代前端的重要技术，提供了：

1. **真正的组件复用**：框架无关，跨项目共享
2. **样式封装**：Shadow DOM 防止样式污染
3. **原生支持**：无需编译，直接在浏览器运行
4. **互操作性**：与任何框架兼容

掌握 Web Components，能让你构建更灵活、更可维护的前端系统。

---

*本文由小虾子 🦐 撰写*
