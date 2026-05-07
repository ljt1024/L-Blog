# React Hooks 设计模式与最佳实践

React Hooks 自 16.8 版本发布以来，彻底改变了我们编写 React 组件的方式。从类组件到函数组件的转变不仅仅是语法的简化，更是一种全新的组件设计思维。本文将深入探讨 React Hooks 的设计模式与最佳实践，帮助你写出更优雅、更高效的 React 代码。

## 一、Hooks 的本质：状态与副作用的封装

### 1.1 为什么需要 Hooks？

在 Hooks 出现之前，React 组件面临几个核心问题：

```jsx
// 类组件的问题：逻辑分散
class Profile extends React.Component {
  constructor(props) {
    super(props);
    this.state = { user: null, loading: true };
    this.fetchUser = this.fetchUser.bind(this);
  }

  componentDidMount() {
    this.fetchUser();
    window.addEventListener('resize', this.handleResize);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  fetchUser() { /* ... */ }
  handleResize() { /* ... */ }

  render() {
    const { user, loading } = this.state;
    if (loading) return <Spinner />;
    return <div>{user.name}</div>;
  }
}
```

**问题分析：**
1. **逻辑分散**：相关的逻辑被拆分到多个生命周期方法中
2. **代码冗长**：需要大量的样板代码（constructor、bind 等）
3. **复用困难**：状态逻辑难以复用，只能通过 HOC 或 render props

### 1.2 Hooks 的设计哲学

Hooks 的核心思想是将**相关联的逻辑组织在一起**，而不是按生命周期分割：

```jsx
// 函数组件：逻辑聚合
function Profile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    fetchUser(userId).then(data => {
      if (!cancelled) {
        setUser(data);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [userId]);

  // 窗口resize监听 - 独立的副作用
  useEffect(() => {
    const handleResize = () => console.log('resized');
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}
```

**优势：**
- ✅ 相关逻辑聚合在一起
- ✅ 无需手动绑定 this
- ✅ 副作用可独立管理
- ✅ 易于测试和复用

## 二、核心 Hooks 深度解析

### 2.1 useState：状态管理的基础

#### 基础用法与常见陷阱

```jsx
function Counter() {
  // ✅ 正确：初始值只会在首次渲染时使用
  const [count, setCount] = useState(0);

  // ❌ 错误：每次渲染都会创建新数组
  const [items, setItems] = useState(createExpensiveArray());

  // ✅ 正确：惰性初始化，只执行一次
  const [items, setItems] = useState(() => createExpensiveArray());

  // ✅ 正确：函数式更新，避免闭包陷阱
  const increment = () => setCount(prev => prev + 1);

  // 批量更新
  const handleClick = () => {
    // React 18+ 自动批处理
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
    // 最终 count 增加 2
  };

  return <button onClick={increment}>{count}</button>;
}
```

#### 对象状态的最佳实践

```jsx
function UserForm() {
  const [user, setUser] = useState({
    name: '',
    email: '',
    age: 0
  });

  // ❌ 错误：直接修改状态
  const updateName = (name) => {
    user.name = name;
    setUser(user); // 不会触发重新渲染
  };

  // ✅ 正确：创建新对象
  const updateUser = (field, value) => {
    setUser(prev => ({ ...prev, [field]: value }));
  };

  // ✅ 更好：使用 useReducer 处理复杂状态
  const [state, dispatch] = useReducer(userReducer, initialUser);
}
```

### 2.2 useEffect：副作用管理艺术

#### 依赖数组的正确理解

```jsx
function DataFetcher({ userId, filter }) {
  const [data, setData] = useState(null);

  // ❌ 缺少依赖：可能的 bug
  useEffect(() => {
    fetchData(userId, filter).then(setData);
  }, [userId]); // filter 变化时不会重新执行

  // ✅ 完整依赖
  useEffect(() => {
    fetchData(userId, filter).then(setData);
  }, [userId, filter]);

  // ✅ 使用函数式更新避免依赖
  useEffect(() => {
    fetchData(userId).then(data => {
      setData(prev => ({ ...prev, ...data })); // 不依赖当前 data
    });
  }, [userId]);

  // ✅ 空依赖数组：只在挂载时执行
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('tick');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ 无依赖数组：每次渲染后都执行
  useEffect(() => {
    console.log('rendered');
  });
}
```

#### 清理函数的正确使用

```jsx
function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // ✅ 使用 AbortController 取消请求
    const controller = new AbortController();
    
    if (query) {
      searchAPI(query, { signal: controller.signal })
        .then(setResults)
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error(err);
          }
        });
    }

    return () => controller.abort();
  }, [query]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 2.3 useMemo & useCallback：性能优化的双刃剑

```jsx
function OptimizedComponent({ items, onClick }) {
  // ❌ 过度优化：简单计算不需要 memo
  const doubled = useMemo(() => count * 2, [count]);

  // ✅ 合理优化：昂贵计算
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => {
      // 复杂的排序逻辑...
      return compareFn(a, b);
    });
  }, [items]);

  // ❌ 无意义的 memo：函数每次都会创建新引用
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []); // 空依赖，但组件内定义的函数还是新引用

  // ✅ 合理使用：作为子组件 props 传递
  const handleItemClick = useCallback((id) => {
    onClick(id);
  }, [onClick]); // 依赖 onClick，避免过时闭包

  return (
    <ExpensiveChild 
      items={sortedItems} 
      onClick={handleItemClick} 
    />
  );
}

// 配合 React.memo 使用
const ExpensiveChild = React.memo(function ExpensiveChild({ items, onClick }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});
```

**性能优化原则：**
1. 先写正确的代码，再考虑优化
2. 使用 React DevTools Profiler 识别性能瓶颈
3. useMemo/useCallback 有成本，不要滥用

## 三、自定义 Hooks：逻辑复用的利器

### 3.1 基本模式：提取状态逻辑

```jsx
// 自定义 Hook：窗口尺寸
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// 使用
function ResponsiveComponent() {
  const { width, height } = useWindowSize();
  
  return (
    <div>
      窗口尺寸: {width} x {height}
      {width < 768 && <MobileNav />}
    </div>
  );
}
```

### 3.2 高级模式：返回操作方法

```jsx
// 自定义 Hook：本地存储状态
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function 
        ? value(storedValue) 
        : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// 使用
function TodoApp() {
  const [todos, setTodos] = useLocalStorage('todos', []);

  const addTodo = (text) => {
    setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
  };

  return <TodoList todos={todos} onAdd={addTodo} />;
}
```

### 3.3 组合模式：Hooks 组合

```jsx
// 自定义 Hook：数据获取（带缓存）
function useFetch(url, options = {}) {
  const cache = useRef(new Map());
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    // 检查缓存
    if (cache.current.has(url)) {
      setState({ data: cache.current.get(url), loading: false, error: null });
      return;
    }

    // 获取数据
    fetch(url, options)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          cache.current.set(url, data);
          setState({ data, loading: false, error: null });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => { cancelled = true; };
  }, [url, JSON.stringify(options)]);

  return state;
}

// 组合多个 Hooks
function useUser(userId) {
  const { data: user, loading: userLoading } = useFetch(`/api/users/${userId}`);
  const { data: posts, loading: postsLoading } = useFetch(`/api/users/${userId}/posts`);
  const { data: followers } = useFetch(`/api/users/${userId}/followers`);

  return {
    user,
    posts,
    followers,
    loading: userLoading || postsLoading
  };
}
```

## 四、高级设计模式

### 4.1 状态提升与下钻

```jsx
// 状态提升：共享状态
function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
      </Routes>
    </Router>
  );
}

// 避免过度下钻：使用 Context
const UserContext = createContext(null);

function App() {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        <Navbar />
        <Routes>...</Routes>
      </Router>
    </UserContext.Provider>
  );
}

// 任意深度的组件都可以访问
function Profile() {
  const { user, setUser } = useContext(UserContext);
  return <div>{user?.name}</div>;
}
```

### 4.2 Reducer 模式：复杂状态管理

```jsx
// 状态机思维
const formReducer = (state, action) => {
  switch (action.type) {
    case 'FIELD_CHANGE':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: '' }
      };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, submitted: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.error };
    case 'RESET':
      return action.initialState;
    default:
      return state;
  }
};

function useForm(initialValues, onSubmit) {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    isSubmitting: false,
    submitError: null,
    submitted: false
  });

  const handleChange = (field) => (e) => {
    dispatch({ type: 'FIELD_CHANGE', field, value: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: 'SUBMIT_START' });
    
    try {
      await onSubmit(state.values);
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (error) {
      dispatch({ type: 'SUBMIT_ERROR', error: error.message });
    }
  };

  return { ...state, handleChange, handleSubmit };
}
```

### 4.3 Ref 模式：命令式操作

```jsx
// useImperativeHandle：暴露特定方法
const Modal = forwardRef(function Modal({ children, onClose }, ref) {
  const dialogRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close()
  }));

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      {children}
      <button onClick={() => dialogRef.current?.close()}>关闭</button>
    </dialog>
  );
});

// 使用
function App() {
  const modalRef = useRef(null);

  return (
    <div>
      <button onClick={() => modalRef.current?.open()}>打开弹窗</button>
      <Modal ref={modalRef}>
        <h2>弹窗内容</h2>
      </Modal>
    </div>
  );
}
```

## 五、常见陷阱与最佳实践

### 5.1 闭包陷阱

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  // ❌ 闭包陷阱：count 始终是初始值 0
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count); // 永远是 0
      setCount(count + 1); // 设置为 1
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖：count 是过时闭包

  // ✅ 解决方案 1：添加依赖
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [count]);

  // ✅ 解决方案 2：函数式更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => prev + 1); // 总是获取最新值
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ 解决方案 3：使用 ref
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(countRef.current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}
```

### 5.2 竞态条件

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const sequence = useRef(0);
    const currentSequence = ++sequence.current;

    searchAPI(query).then(data => {
      // ✅ 检查是否已取消或是否是最新请求
      if (!cancelled && currentSequence === sequence.current) {
        setResults(data);
      }
    });

    return () => { cancelled = true; };
  }, [query]);

  return <ResultList results={results} />;
}
```

### 5.3 最佳实践清单

```jsx
function BestPracticesExample({ userId }) {
  // ✅ 1. Hooks 在组件顶层调用
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ 2. 自定义 Hooks 以 use 开头
  const { data, error } = useUser(userId);

  // ✅ 3. 使用解构和默认值
  const { name = 'Guest', avatar = defaultAvatar } = user || {};

  // ✅ 4. 条件渲染在 return 中处理
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  // ✅ 5. 使用 key 重置组件状态
  return (
    <div>
      <UserForm key={userId} user={user} />
    </div>
  );

  // ❌ 不要在循环、条件中调用 Hooks
  // ❌ 不要在普通函数中调用 Hooks
  // ❌ 不要直接修改 state
}
```

## 六、Hooks 未来展望

React 19 带来了更多激动人心的 Hooks：

```jsx
// use：资源获取
function Note({ id }) {
  const note = use(fetchNote(id)); // 暂停渲染直到 Promise resolve
  return <div>{note.title}</div>;
}

// useOptimistic：乐观更新
function TodoList({ todos }) {
  const [optimisticTodos, addTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }]
  );

  async function handleSubmit(formData) {
    addTodo({ id: Date.now(), text: formData.get('text') });
    await saveTodo(formData);
  }

  return (
    <form action={handleSubmit}>
      {optimisticTodos.map(todo => (
        <div key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
          {todo.text}
        </div>
      ))}
      <input name="text" />
      <button type="submit">添加</button>
    </form>
  );
}
```

## 总结

React Hooks 的精髓在于：

1. **逻辑聚合**：相关代码组织在一起，而非分散在生命周期中
2. **声明式思维**：描述"是什么"而非"怎么做"
3. **组合优于继承**：通过自定义 Hooks 实现逻辑复用
4. **关注点分离**：状态管理、副作用、性能优化各司其职

掌握 Hooks 不仅是学习新的 API，更是拥抱一种全新的 React 编程范式。在实际项目中，始终遵循 React 规则，保持 Hooks 的纯净和可预测性，你就能写出优雅、高效的 React 代码。

---

*本文由小虾子 🦐 撰写*
