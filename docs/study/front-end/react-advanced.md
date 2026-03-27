# React深入解析

React 是由 Facebook 开发的用于构建用户界面的 JavaScript 库。它以组件化、虚拟 DOM 和单项数据流为核心特性，已经成为现代前端开发的重要工具。在掌握了 React 基础之后，我们需要深入了解其核心原理和高级特性，以构建更高效、更可维护的应用。

## 1. Hooks原理与实现

Hooks 是 React 16.8 引入的新特性，它让我们能在不编写 class 的情况下使用 state 以及其它 React 特性。

### 1.1 Hooks的本质与设计思想

Hooks 的本质是函数，它们让你"钩入" React 的状态和生命周期等特性。Hooks 的设计遵循几个重要原则：

1. 只在最顶层调用 Hooks，不要在循环、条件或嵌套函数中调用
2. 只在 React 函数组件中调用 Hooks，不要在普通的 JavaScript 函数中调用

```javascript
// 正确的使用方式
function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
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

// 错误的使用方式
function MyComponent() {
  const [count, setCount] = useState(0);
  
  if (count > 0) {
    // 错误：在条件语句中调用 Hook
    useEffect(() => {
      document.title = `You clicked ${count} times`;
    });
  }
  
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

### 1.2 useState实现原理

useState 是最基础的 Hook，用于在函数组件中添加状态。

```javascript
// 简化的 useState 实现
let memorizedState = []; // 存储状态的数组
let index = 0; // 当前状态的索引

function useState(initialState) {
  // 初始化状态
  memorizedState[index] = memorizedState[index] || initialState;
  
  // 保存当前索引
  const currentIndex = index;
  
  // 设置新状态的函数
  function setState(newState) {
    memorizedState[currentIndex] = newState;
    // 触发组件重新渲染
    render();
  }
  
  // 返回当前状态和设置状态的函数
  return [memorizedState[index++], setState];
}

// 使用示例
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

### 1.3 useEffect实现机制

useEffect 用于处理副作用，相当于类组件中的 componentDidMount、componentDidUpdate 和 componentWillUnmount 的组合。

```javascript
// 简化的 useEffect 实现
let memorizedEffects = []; // 存储副作用的数组
let effectIndex = 0; // 当前副作用的索引

function useEffect(callback, deps) {
  // 获取当前副作用
  const currentEffect = memorizedEffects[effectIndex];
  
  // 判断是否需要执行副作用
  let hasChanged = true;
  
  if (currentEffect && deps) {
    // 比较依赖项
    hasChanged = deps.some((dep, i) => dep !== currentEffect.deps[i]);
  }
  
  // 如果依赖项改变或首次执行，则执行副作用
  if (hasChanged) {
    // 清除上次的副作用
    if (currentEffect && currentEffect.cleanup) {
      currentEffect.cleanup();
    }
    
    // 执行新的副作用
    const cleanup = callback();
    
    // 保存副作用信息
    memorizedEffects[effectIndex] = {
      cleanup,
      deps
    };
  }
  
  effectIndex++;
}

// 使用示例
function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // 副作用逻辑
    document.title = `You clicked ${count} times`;
    
    // 清除副作用
    return () => {
      console.log('清理副作用');
    };
  }, [count]); // 依赖项数组
  
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

### 1.4 useMemo与useCallback优化策略

useMemo 和 useCallback 用于优化性能，避免不必要的计算和重新渲染。

```javascript
// useMemo 用于缓存计算结果
function MyComponent({ a, b }) {
  // 只有当 a 或 b 改变时才重新计算 expensiveValue
  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(a, b);
  }, [a, b]);
  
  return <div>{expensiveValue}</div>;
}

// useCallback 用于缓存函数
function ParentComponent() {
  const [count, setCount] = useState(0);
  
  // 只有当 count 改变时才创建新的 handleClick 函数
  const handleClick = useCallback(() => {
    console.log('点击事件', count);
  }, [count]);
  
  return (
    <div>
      <ChildComponent onClick={handleClick} />
      <button onClick={() => setCount(count + 1)}>增加计数</button>
    </div>
  );
}
```

### 1.5 自定义Hooks的最佳实践

自定义 Hooks 让我们能提取组件逻辑到可重用的函数中。

```javascript
// 自定义 Hook：用于获取鼠标位置
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return position;
}

// 使用自定义 Hook
function MouseTracker() {
  const mousePosition = useMousePosition();
  
  return (
    <div>
      鼠标位置: {mousePosition.x}, {mousePosition.y}
    </div>
  );
}

// 自定义 Hook：用于数据获取
function useApi(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [url]);
  
  return { data, loading, error };
}

// 使用自定义 Hook
function UserProfile({ userId }) {
  const { data: user, loading, error } = useApi(`/api/users/${userId}`);
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;
  if (!user) return <div>未找到用户</div>;
  
  return <div>用户名: {user.name}</div>;
}
```

## 2. 渲染过程原理

React 的渲染过程涉及多个阶段，理解这些原理有助于优化应用性能。

### 2.1 React元素与组件的区别

React 元素是描述 UI 的普通对象，而组件是可以接收 props 并返回 React 元素的函数或类。

```javascript
// React 元素
const element = {
  type: 'button',
  props: {
    className: 'btn',
    children: 'Click me'
  }
};

// 函数组件
function Button({ className, children }) {
  return <button className={className}>{children}</button>;
}

// 类组件
class Button extends React.Component {
  render() {
    return <button className={this.props.className}>{this.props.children}</button>;
  }
}
```

### 2.2 reconciliation协调过程

协调是 React 比较新旧虚拟 DOM 树并确定最小更新的过程。

```javascript
// 简化的协调过程
function reconcileChildren(returnFiber, currentFirstChild, newChildren) {
  // 1. 比较新旧子节点
  // 2. 标记需要插入、删除或更新的节点
  // 3. 生成新的 fiber 树
  
  let resultingFirstChild = null;
  let previousNewFiber = null;
  
  let oldFiber = currentFirstChild;
  let newIdx = 0;
  
  // 遍历新子节点
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = createChild(returnFiber, newChildren[newIdx]);
    
    if (oldFiber) {
      // 比较新旧 fiber
      const sameType = oldFiber.type === newFiber.type;
      
      if (sameType) {
        // 更新现有 fiber
        newFiber.alternate = oldFiber;
        oldFiber = oldFiber.sibling;
      } else {
        // 删除旧 fiber，创建新 fiber
        deleteChild(returnFiber, oldFiber);
        oldFiber = oldFiber.sibling;
      }
    }
    
    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    
    previousNewFiber = newFiber;
  }
  
  return resultingFirstChild;
}
```

### 2.3 调和算法详解

React 使用启发式算法来优化协调过程，主要包括：

1. **双端比较算法**：同时从两端比较节点
2. **Key 优化**：使用 key 来标识节点身份
3. **类型比较**：只有相同类型的节点才会被更新

```javascript
// 双端比较算法示例
function updateFromMap(existingChildren, returnFiber, newIdx, newChild) {
  // 1. 从 Map 中查找对应的旧 fiber
  const matchedFiber = existingChildren.get(newChild.key || newIdx);
  
  if (matchedFiber) {
    // 2. 比较类型
    if (matchedFiber.elementType === newChild.type) {
      // 3. 更新现有 fiber
      const existing = useFiber(matchedFiber, newChild.props);
      existing.return = returnFiber;
      // 从 Map 中移除已匹配的 fiber
      existingChildren.delete(newChild.key || newIdx);
      return existing;
    }
  }
  
  // 4. 创建新 fiber
  return createFiberFromElement(newChild, returnFiber);
}
```

### 2.4 批量更新与状态合并

React 会批量处理状态更新以提高性能。

```javascript
function MyComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  const handleClick = () => {
    // 这些状态更新会被批量处理
    setCount(c => c + 1);
    setCount(c => c + 1);
    setName('React');
    
    // 在事件处理函数结束后，组件只会重新渲染一次
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <p>Name: {name}</p>
      <button onClick={handleClick}>更新状态</button>
    </div>
  );
}
```

## 3. Fiber架构

Fiber 是 React 16 引入的全新协调引擎，它解决了之前版本的一些性能问题。

### 3.1 Fiber架构解决的问题

之前的 React 协调过程是同步的，可能导致主线程阻塞，影响用户体验。Fiber 架构通过以下方式解决问题：

1. **增量渲染**：将渲染工作分解为小块，可以中断和恢复
2. **优先级调度**：高优先级的更新可以打断低优先级的更新
3. **时间切片**：利用浏览器空闲时间执行渲染工作

### 3.2 Fiber数据结构

Fiber 是一种链表结构，每个节点代表一个工作单元。

```javascript
// 简化的 Fiber 结构
class FiberNode {
  constructor(tag, pendingProps, key, mode) {
    // Fiber 类型标识
    this.tag = tag;
    
    // 组件的键值
    this.key = key;
    
    // 元素类型
    this.elementType = null;
    
    // Fiber 类型
    this.type = null;
    
    // 对应的真实 DOM 节点
    this.stateNode = null;
    
    // 指向父 Fiber
    this.return = null;
    
    // 指向第一个子 Fiber
    this.child = null;
    
    // 指向下一个兄弟 Fiber
    this.sibling = null;
    
    // 新的 props
    this.pendingProps = pendingProps;
    
    // 上一次渲染的 props
    this.memoizedProps = null;
    
    // 新的状态
    this.memoizedState = null;
    
    // 更新队列
    this.updateQueue = null;
    
    // 副作用标记
    this.effectTag = NoEffect;
    
    // 副作用列表的第一个和最后一个节点
    this.firstEffect = null;
    this.lastEffect = null;
  }
}
```

### 3.3 双缓冲树机制

Fiber 使用双缓冲树机制来优化渲染过程。

```javascript
// current 树：当前屏幕上显示的树
// workInProgress 树：正在构建的下一帧树

function beginWork(current, workInProgress, renderExpirationTime) {
  // 根据 current 和 workInProgress 构建新的 fiber
  // ...
  
  // 如果可以复用 current fiber
  if (current !== null && ... /* 一些条件 */) {
    // 复用 current fiber 的部分内容
    workInProgress.stateNode = current.stateNode;
    workInProgress.memoizedProps = current.memoizedProps;
    // ...
  } else {
    // 创建新的 fiber 节点
    // ...
  }
  
  return workInProgress.child;
}
```

### 3.4 工作循环(work loop)与时间切片

Fiber 的工作循环利用浏览器的空闲时间执行渲染任务。

```javascript
// 简化的工作循环
function workLoopConcurrent() {
  // 当还有工作要做且有空闲时间时继续工作
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork) {
  // 处理当前工作单元
  const current = unitOfWork.alternate;
  
  // beginWork：处理当前 fiber 的子 fiber
  let next = beginWork(current, unitOfWork, renderExpirationTime);
  
  if (next === null) {
    // 没有子 fiber，完成当前 fiber 的工作
    next = completeUnitOfWork(unitOfWork);
  }
  
  return next;
}

// 利用 requestIdleCallback 或 polyfill 实现时间切片
function shouldYield() {
  const currentTime = getCurrentTime();
  return currentTime >= deadline;
}
```

## 4. 状态管理深入

React 提供了多种状态管理方案，适用于不同的应用场景。

### 4.1 Context API原理与优化

Context API 用于跨组件传递数据，避免层层传递 props。

```javascript
// 创建 Context
const ThemeContext = React.createContext('light');

// Provider 组件
function App() {
  const [theme, setTheme] = useState('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// Consumer 组件
function Toolbar() {
  return (
    <div>
      <ThemedButton />
    </div>
  );
}

// 使用 useContext Hook
function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  
  return (
    <button 
      className={theme}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      切换主题
    </button>
  );
}

// 优化 Context 性能：将状态拆分为多个 Context
const ThemeContext = React.createContext();
const UserContext = React.createContext();

function AppProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <UserContext.Provider value={{ user, setUser }}>
        {children}
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}
```

### 4.2 Redux架构模式

Redux 是流行的状态管理库，遵循单一数据源、状态只读和纯函数修改状态的原则。

```javascript
// Redux 核心概念
// 1. Store：存储应用状态
// 2. Action：描述发生了什么的对象
// 3. Reducer：纯函数，指定状态如何响应动作

// Action 类型
const INCREMENT = 'INCREMENT';
const DECREMENT = 'DECREMENT';

// Action 创建函数
function increment() {
  return { type: INCREMENT };
}

function decrement() {
  return { type: DECREMENT };
}

// Reducer
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case INCREMENT:
      return { count: state.count + 1 };
    case DECREMENT:
      return { count: state.count - 1 };
    default:
      return state;
  }
}

// 创建 Store
import { createStore } from 'redux';
const store = createStore(counterReducer);

// 使用 Store
function Counter() {
  const [count, setCount] = useState(store.getState().count);
  
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCount(store.getState().count);
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => store.dispatch(increment())}>+</button>
      <button onClick={() => store.dispatch(decrement())}>-</button>
    </div>
  );
}
```

### 4.3 状态持久化方案

状态持久化可以保存用户的操作状态，提升用户体验。

```javascript
// 使用 localStorage 持久化状态
function useLocalStorage(key, initialValue) {
  // 从 localStorage 获取初始值
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  
  // 更新状态并保存到 localStorage
  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };
  
  return [storedValue, setValue];
}

// 使用示例
function MyComponent() {
  const [userPreferences, setUserPreferences] = useLocalStorage('userPrefs', {
    theme: 'light',
    language: 'en'
  });
  
  return (
    <div>
      <select 
        value={userPreferences.theme}
        onChange={(e) => setUserPreferences({
          ...userPreferences,
          theme: e.target.value
        })}
      >
        <option value="light">浅色主题</option>
        <option value="dark">深色主题</option>
      </select>
    </div>
  );
}
```

### 4.4 状态同步与竞态条件处理

在异步操作中处理状态同步和竞态条件是很重要的。

```javascript
// 使用 AbortController 处理竞态条件
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // 创建 AbortController
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url, { signal });
        const result = await response.json();
        
        // 检查请求是否被取消
        if (!signal.aborted) {
          setData(result);
        }
      } catch (err) {
        // 忽略取消错误
        if (err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // 清理函数：取消请求
    return () => {
      controller.abort();
    };
  }, [url]);
  
  return { data, loading, error };
}

// 使用 useRef 处理竞态条件
function useLatestData(apiCall) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  
  const fetchData = async () => {
    // 增加请求 ID
    const requestId = ++requestIdRef.current;
    setLoading(true);
    
    try {
      const result = await apiCall();
      
      // 只有当这是最新的请求时才更新状态
      if (requestId === requestIdRef.current) {
        setData(result);
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error(error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };
  
  return { data, loading, fetchData };
}
```

## 5. 性能优化策略

React 提供了多种性能优化手段，合理使用可以显著提升应用性能。

### 5.1 React.memo与PureComponent

React.memo 是高阶组件，用于优化函数组件的重新渲染。

```javascript
// 使用 React.memo 优化函数组件
const MyComponent = React.memo(function MyComponent(props) {
  /* 只有当 props 发生变化时才重新渲染 */
  return <div>{props.name}</div>;
});

// 自定义比较函数
const MyComponent = React.memo(function MyComponent(props) {
  return <div>{props.user.name}</div>;
}, (prevProps, nextProps) => {
  // 自定义比较逻辑
  return prevProps.user.name === nextProps.user.name;
});

// PureComponent 优化类组件
class MyComponent extends React.PureComponent {
  render() {
    return <div>{this.props.name}</div>;
  }
}
```

### 5.2 shouldComponentUpdate优化

shouldComponentUpdate 允许我们手动控制组件是否需要更新。

```javascript
class MyComponent extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    // 只有当 name 或 count 发生变化时才重新渲染
    return (
      nextProps.name !== this.props.name ||
      nextState.count !== this.state.count
    );
  }
  
  render() {
    return (
      <div>
        <p>Name: {this.props.name}</p>
        <p>Count: {this.state.count}</p>
      </div>
    );
  }
}
```

### 5.3 懒加载与代码分割

懒加载可以减少初始加载时间，提升用户体验。

```javascript
// 使用 React.lazy 进行代码分割
import React, { Suspense } from 'react';

const OtherComponent = React.lazy(() => import('./OtherComponent'));

function MyComponent() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <OtherComponent />
      </Suspense>
    </div>
  );
}

// 使用 lazy 和路由结合
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const Home = React.lazy(() => import('./Home'));
const About = React.lazy(() => import('./About'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// 使用 webpack 的 magic comments 进行预加载
const OtherComponent = React.lazy(() => 
  import(
    /* webpackChunkName: "other-component" */
    /* webpackPreload: true */
    './OtherComponent'
  )
);
```

### 5.4 Profiler性能分析工具

Profiler 可以帮助我们测量组件渲染的性能。

```javascript
import { Profiler } from 'react';

function onRenderCallback(
  id, // 发生提交的 Profiler 树的 id
  phase, // "mount" （如果组件树刚加载） 或 "update" （如果它重渲染了）
  actualDuration, // 本次更新 committed 花费的渲染时间
  baseDuration, // 估计不使用 memoization 的渲染时间
  startTime, // 本次更新中 React 开始渲染的时间
  commitTime, // 本次更新中 React committed 的时间
  interactions // 属于本次更新的 interactions 的集合
) {
  console.log({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions
  });
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Main />
    </Profiler>
  );
}
```

## 6. 事件系统

React 实现了自己的事件系统，称为合成事件（SyntheticEvent）。

### 6.1 合成事件(SyntheticEvent)机制

合成事件是对浏览器原生事件的跨浏览器包装。

```javascript
// 合成事件的特点
function MyComponent() {
  const handleClick = (event) => {
    // event 是 SyntheticEvent 实例
    console.log(event.target); // 获取触发事件的元素
    console.log(event.type); // 获取事件类型
    
    // 阻止默认行为
    event.preventDefault();
    
    // 阻止事件冒泡
    event.stopPropagation();
    
    // 如果需要访问原生事件
    console.log(event.nativeEvent);
  };
  
  return <button onClick={handleClick}>点击我</button>;
}

// 合成事件的优势
// 1. 跨浏览器一致性
// 2. 事件委托：所有事件都委托到 document 上
// 3. 自动内存管理
```

### 6.2 事件委托与冒泡

React 使用事件委托机制来提高性能。

```javascript
// React 事件委托的工作原理
document.addEventListener('click', function(event) {
  // React 在 document 上监听所有事件
  // 根据 event.target 找到对应的 React 组件
  // 调用相应的事件处理函数
});

// 事件冒泡示例
function Parent() {
  const handleParentClick = () => {
    console.log('父组件被点击');
  };
  
  return (
    <div onClick={handleParentClick}>
      <Child />
    </div>
  );
}

function Child() {
  const handleChildClick = (e) => {
    console.log('子组件被点击');
    // 阻止事件冒泡
    e.stopPropagation();
  };
  
  return <button onClick={handleChildClick}>点击我</button>;
}
```

### 6.3 事件池与内存优化

为了优化性能，React 使用事件池来复用 SyntheticEvent 对象。

```javascript
function MyComponent() {
  const handleClick = (event) => {
    // 注意：event 对象会在事件处理函数结束后被回收
    // 如果需要异步访问 event 对象，需要调用 persist()
    setTimeout(() => {
      console.log(event.target); // 可能无法正常工作
    }, 1000);
  };
  
  const handleAsyncClick = (event) => {
    // 保留 event 对象
    event.persist();
    
    setTimeout(() => {
      console.log(event.target); // 正常工作
    }, 1000);
  };
  
  return (
    <div>
      <button onClick={handleClick}>普通点击</button>
      <button onClick={handleAsyncClick}>异步点击</button>
    </div>
  );
}
```

## 7. 错误处理与边界

React 提供了错误边界机制来优雅地处理组件树中的 JavaScript 错误。

### 7.1 Error Boundaries实现

错误边界是 React 组件，它可以捕获并打印发生在其子组件树任何位置的 JavaScript 错误。

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  // 静态方法，用于捕获渲染阶段的错误
  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染可以显示降级 UI
    return { hasError: true };
  }
  
  // componentDidCatch 用于记录错误信息
  componentDidCatch(error, errorInfo) {
    // 可以将错误日志上报给服务器
    console.error('Error caught by boundary:', error, errorInfo);
    
    // 例如发送到错误监控服务
    // logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      // 可以渲染任何自定义的降级 UI
      return <h1>Something went wrong.</h1>;
    }
    
    return this.props.children;
  }
}

// 使用错误边界
function App() {
  return (
    <ErrorBoundary>
      <MyWidget />
    </ErrorBoundary>
  );
}
```

### 7.2 Suspense与异常处理

Suspense 组件可以等待某些操作完成后再渲染子组件。

```javascript
import { Suspense } from 'react';

// 使用 Suspense 处理懒加载组件
const ProfilePage = React.lazy(() => import('./ProfilePage'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProfilePage />
    </Suspense>
  );
}

// 使用 Suspense 处理数据获取（React 18+）
import { Suspense } from 'react';
import { fetchData } from './api';

// 组件内部使用 Suspense 获取数据
function ProfileDetails() {
  const user = fetchData('/api/user');
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <ProfileDetails />
    </Suspense>
  );
}
```

### 7.3 异步组件加载策略

合理使用异步加载可以提升应用性能。

```javascript
// 预加载策略
const LazyComponent = React.lazy(() => 
  import(/* webpackPreload: true */ './LazyComponent')
);

// 预获取策略
const LazyComponent = React.lazy(() => 
  import(/* webpackPrefetch: true */ './LazyComponent')
);

// 基于路由的预加载
function App() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <Suspense fallback="Loading...">
              <HomePage />
            </Suspense>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <Suspense fallback="Loading...">
              <ProfilePage />
            </Suspense>
          } 
        />
      </Routes>
    </Router>
  );
}

// 使用 Intersection Observer 实现可见时加载
function LazyLoadComponent({ component: Component, ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    });
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref}>
      {isVisible ? <Component {...props} /> : <div>Loading...</div>}
    </div>
  );
}
```

## 8. 其他核心知识

### 8.1 Portal与DOM操作

Portal 提供了一种将子节点渲染到存在于父组件以外的 DOM 节点的方式。

```javascript
// 创建 Portal
function Modal({ children }) {
  // 创建一个 div 元素来挂载 modal
  const el = document.createElement('div');
  
  useEffect(() => {
    // 将元素添加到 body
    document.body.appendChild(el);
    
    // 清理函数：移除元素
    return () => {
      document.body.removeChild(el);
    };
  }, [el]);
  
  // 使用 ReactDOM.createPortal 将 children 渲染到 el 中
  return ReactDOM.createPortal(children, el);
}

// 使用 Modal
function App() {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        显示模态框
      </button>
      
      {showModal && (
        <Modal>
          <div className="modal">
            <h2>模态框标题</h2>
            <p>模态框内容</p>
            <button onClick={() => setShowModal(false)}>
              关闭
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

### 8.2 Refs转发与访问

Refs 转发允许组件接收 ref 并将其向下传递给子组件。

```javascript
// 使用 forwardRef 转发 refs
const FancyButton = React.forwardRef((props, ref) => (
  <button ref={ref} className="fancy-button">
    {props.children}
  </button>
));

// 父组件可以获取到 button 的 DOM 节点
function App() {
  const buttonRef = useRef(null);
  
  const handleClick = () => {
    // 直接访问 button 元素
    buttonRef.current.focus();
  };
  
  return (
    <div>
      <FancyButton ref={buttonRef}>点击我</FancyButton>
      <button onClick={handleClick}>聚焦到上面的按钮</button>
    </div>
  );
}

// 在高阶组件中转发 refs
function logProps(Component) {
  class LogProps extends React.Component {
    componentDidUpdate(prevProps) {
      console.log('old props:', prevProps);
      console.log('new props:', this.props);
    }
    
    render() {
      const { forwardedRef, ...rest } = this.props;
      
      // 将自定义的 props 分配给被包装的组件
      return <Component ref={forwardedRef} {...rest} />;
    }
  }
  
  // 注意 React.forwardRef 回调的第二个参数 ref
  // 我们可以将其作为常规 props 属性传递给 LogProps，例如 forwardedRef
  // 然后它就可以被挂载到被包装的组件上
  return React.forwardRef((props, ref) => {
    return <LogProps {...props} forwardedRef={ref} />;
  });
}
```

### 8.3 高阶组件(HOC)模式

高阶组件是参数为组件，返回值为新组件的函数。

```javascript
// HOC 示例：添加日志功能
function withLogging(WrappedComponent) {
  return class extends React.Component {
    componentDidMount() {
      console.log(`组件 ${WrappedComponent.name} 已挂载`);
    }
    
    componentDidUpdate() {
      console.log(`组件 ${WrappedComponent.name} 已更新`);
    }
    
    componentWillUnmount() {
      console.log(`组件 ${WrappedComponent.name} 将要卸载`);
    }
    
    render() {
      // 传递所有 props 给被包装的组件
      return <WrappedComponent {...this.props} />;
    }
  };
}

// 使用 HOC
const EnhancedButton = withLogging(Button);

// 注意事项：
// 1. 不要在 render 方法中使用 HOC
// 2. 务必复制静态方法
// 3. Refs 不会被传递

// 复制静态方法
function enhance(WrappedComponent) {
  class Enhance extends React.Component {
    // ...
  }
  
  // 必须准确知道应该拷贝哪些方法
  Enhance.staticMethod = WrappedComponent.staticMethod;
  
  return Enhance;
}

// 使用 hoist-non-react-statics 自动拷贝所有非 React 静态方法
import hoistNonReactStatics from 'hoist-non-react-statics';

function enhance(WrappedComponent) {
  class Enhance extends React.Component {
    // ...
  }
  
  hoistNonReactStatics(Enhance, WrappedComponent);
  
  return Enhance;
}
```

### 8.4 Render Props模式

Render Props 是一个在 React 组件之间使用一个值为函数的 prop 共享代码的简单技术。

```javascript
// 使用 render prop 的组件
class Mouse extends React.Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };
  }
  
  handleMouseMove = (event) => {
    this.setState({
      x: event.clientX,
      y: event.clientY
    });
  };
  
  render() {
    return (
      <div style={{ height: '100vh' }} onMouseMove={this.handleMouseMove}>
        {/* 使用 render prop 动态决定要渲染的内容 */}
        {this.props.render(this.state)}
      </div>
    );
  }
}

// 使用 Mouse 组件
function App() {
  return (
    <div>
      <h1>移动鼠标!</h1>
      <Mouse render={mouse => (
        <p>鼠标位置: {mouse.x}, {mouse.y}</p>
      )} />
    </div>
  );
}

// 使用 children 作为函数
function Mouse({ children }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (event) => {
    setMouse({
      x: event.clientX,
      y: event.clientY
    });
  };
  
  return (
    <div style={{ height: '100vh' }} onMouseMove={handleMouseMove}>
      {children(mouse)}
    </div>
  );
}

// 使用 children render prop
function App() {
  return (
    <div>
      <h1>移动鼠标!</h1>
      <Mouse>
        {mouse => (
          <p>鼠标位置: {mouse.x}, {mouse.y}</p>
        )}
      </Mouse>
    </div>
  );
}
```

通过对 React 核心原理和高级特性的深入理解，我们可以更好地利用 React 构建高性能、可维护的应用程序。在实际开发中，我们应该根据项目需求选择合适的技术方案，并持续关注 React 生态的发展。