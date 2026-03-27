# React基础入门

官方网站: [React 官方文档](https://reactjs.org/docs/getting-started.html)

React是由Facebook开发的一个用于构建用户界面的JavaScript库。它是目前最流行的前端框架之一，以其组件化思想和虚拟DOM技术著称。

## 什么是React？

React是一个用于构建用户界面的JavaScript库。它不是一个完整的框架，而是一个专注于视图层的库。React的主要特点包括：

- **组件化**：将UI拆分成独立可复用的组件
- **虚拟DOM**：提高性能，减少直接操作真实DOM的开销
- **单向数据流**：使数据流动更加可预测
- **JSX语法**：允许在JavaScript中编写类似HTML的语法

## React核心概念

### JSX语法

JSX是JavaScript的语法扩展，允许我们在JavaScript中编写类似HTML的代码。

```jsx
const element = <h1>Hello, world!</h1>;
```

JSX并不是必须的，但它使React变得更加直观和易于理解。

### 组件

React应用由一个个组件构成。组件可以是函数组件或类组件。

#### 函数组件

```jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}
```

#### 类组件

```jsx
class Welcome extends React.Component {
  render() {
    return <h1>Hello, {this.props.name}</h1>;
  }
}
```

### Props（属性）

Props是组件的输入参数，允许我们将数据从父组件传递给子组件。

```jsx
function App() {
  return (
    <div>
      <Welcome name="Alice" />
      <Welcome name="Bob" />
    </div>
  );
}
```

### State（状态）

State是组件内部的数据，当state发生变化时，组件会重新渲染。

#### 函数组件中的State（使用Hooks）

```jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

#### 类组件中的State

```jsx
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  render() {
    return (
      <div>
        <p>You clicked {this.state.count} times</p>
        <button onClick={() => this.setState({ count: this.state.count + 1 })}>
          Click me
        </button>
      </div>
    );
  }
}
```

## React Hooks

Hooks是React 16.8引入的新特性，它让你可以在不编写class的情况下使用state以及其他的React特性。

### useState Hook

用于在函数组件中添加state：

```jsx
import React, { useState } from 'react';

function Example() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

### useEffect Hook

用于处理副作用，相当于类组件中的componentDidMount、componentDidUpdate和componentWillUnmount的组合：

```jsx
import React, { useState, useEffect } from 'react';

function Example() {
  const [count, setCount] = useState(0);

  // 相当于 componentDidMount 和 componentDidUpdate:
  useEffect(() => {
    // 更新文档标题
    document.title = `You clicked ${count} times`;
  });

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

## 事件处理

React中的事件处理与DOM元素的事件处理有一些语法差异：

1. React事件使用驼峰命名而不是小写
2. 使用JSX语法传递函数作为事件处理器而不是字符串

```jsx
function ActionLink() {
  function handleClick(e) {
    e.preventDefault();
    console.log('The link was clicked.');
  }

  return (
    <a href="#" onClick={handleClick}>
      Click me
    </a>
  );
}
```

## 条件渲染

React中的条件渲染与JavaScript中的条件语句类似：

```jsx
function Greeting(props) {
  const isLoggedIn = props.isLoggedIn;
  
  if (isLoggedIn) {
    return <UserGreeting />;
  }
  return <GuestGreeting />;
}
```

或者使用逻辑&&操作符：

```jsx
function Mailbox(props) {
  const unreadMessages = props.unreadMessages;
  return (
    <div>
      <h1>Hello!</h1>
      {unreadMessages.length > 0 &&
        <h2>
          You have {unreadMessages.length} unread messages.
        </h2>
      }
    </div>
  );
}
```

## 列表渲染

使用map()函数渲染列表：

```jsx
function NumberList(props) {
  const numbers = props.numbers;
  const listItems = numbers.map((number) =>
    <li key={number.toString()}>
      {number}
    </li>
  );
  return (
    <ul>{listItems}</ul>
  );
}
```

注意：每个列表项都需要一个唯一的key prop。

## 表单处理

React中的表单处理有两种方式：受控组件和非受控组件。

### 受控组件

表单数据由React组件管理：

```jsx
class NameForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: '' };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    alert('A name was submitted: ' + this.state.value);
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Name:
          <input type="text" value={this.state.value} onChange={this.handleChange} />
        </label>
        <input type="submit" value="Submit" />
      </form>
    );
  }
}
```

## React开发工具

### Create React App

Create React App是官方支持的创建React单页应用的方式，它提供了无需配置的现代构建流程。

#### 安装和使用：

```bash
npx create-react-app my-app
cd my-app
npm start
```

#### 项目结构说明：

创建完成后，项目目录结构如下：
```
my-app/
├── README.md
├── node_modules/
├── package.json
├── public/
│   ├── index.html
│   └── favicon.ico
└── src/
    ├── App.css
    ├── App.js
    ├── App.test.js
    ├── index.css
    ├── index.js
    └── logo.svg
```

主要文件说明：
- `public/index.html` - 页面模板
- `src/index.js` - JavaScript入口点
- `src/App.js` - 根组件

#### 开发命令：

```bash
# 启动开发服务器
npm start

# 构建生产版本
npm run build

# 运行测试
npm test

# 移除构建工具并将其配置暴露出来（不可逆操作）
npm run eject
```

#### 使用Vite创建React项目（推荐）：

Vite是新一代前端构建工具，具有更快的冷启动速度和热更新。

```bash
# 使用npm
npm create vite@latest my-react-app -- --template react

# 使用yarn
yarn create vite my-react-app --template react

# 使用pnpm
pnpm create vite my-react-app --template react
```

安装依赖并启动开发服务器：
```bash
cd my-react-app
npm install
npm run dev
```

### React Developer Tools

React Developer Tools是一个浏览器扩展，可以帮助你检查React组件层次结构。

## 生态系统

React拥有丰富的生态系统：

- **React Router**：官方路由解决方案
- **Redux/MobX**：状态管理库
- **Styled Components**：CSS-in-JS解决方案
- **Next.js**：服务端渲染框架
- **Gatsby**：静态站点生成器

## 总结

React以其简洁的设计理念和强大的生态系统成为了现代前端开发的重要工具。通过组件化思想、虚拟DOM技术和丰富的Hook API，React让构建复杂的用户界面变得更加简单和高效。

掌握React需要理解其核心概念，包括JSX、组件、Props、State、生命周期和Hooks等。随着实践经验的积累，你将能够构建出功能强大且性能优秀的Web应用。