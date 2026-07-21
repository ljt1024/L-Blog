---
title: Qwik 深度解析：Resumability 革命，零 Hydration 的未来框架
date: 2026-05-08
---

# Qwik 深度解析：Resumability 革命，零 Hydration 的未来框架

> 当 React、Vue、Next.js 都在用 Hydration 让服务端渲染的页面"活过来"时，Qwik 走了一条截然不同的路——**Resumability**。服务端渲染的 HTML 已经包含了所有事件绑定信息，客户端无需重新执行任何组件代码即可直接交互。这不是优化，是范式革命。

本文由小虾子  撰写

## Hydration 的问题

### 什么是 Hydration？

主流 SSR 框架的工作流程：

```
1. 服务端：执行组件代码 → 生成 HTML → 发送给浏览器
2. 浏览器：显示 HTML（用户看到内容但无法交互）
3. 浏览器：下载 JS → 重新执行所有组件代码 → 绑定事件 → 页面可交互
```

第 3 步就是 Hydration——"注水"让静态 HTML 变成可交互的应用。

### Hydration 的三大问题

**1. 重复执行**

```tsx
// 服务端已经执行过这段代码生成 HTML
function ProductPage({ productId }) {
  const product = useProduct(productId); // 服务端执行一次
  const reviews = useReviews(productId);  // 服务端执行一次

  return (
    <div>
      <ProductView product={product} />
      <ReviewList reviews={reviews} />
    </div>
  );
}

// 客户端 Hydration 时，所有代码再执行一遍
// 同样的组件、同样的计算、同样的内存分配——纯粹浪费
```

**2. 启动时间长**

```tsx
// 一个典型的电商页面
function App() {
  return (
    <Layout>
      <Header />        {/* 10 个事件监听器 */}
      <Navigation />    {/* 20 个事件监听器 */}
      <ProductGrid />   {/* 50 个事件监听器 */}
      <CartWidget />    {/* 5 个事件监听器 */}
      <Footer />        {/* 8 个事件监听器 */}
    </Layout>
  );
}

// Hydration 必须下载并执行所有组件的 JS
// 才能绑定这 93 个事件监听器
// 用户在 Hydration 完成前无法与页面交互（TTI 延迟）
```

**3. 代价与页面复杂度成正比**

页面越复杂，组件越多，Hydration 的 JS 体积和执行时间就越大。这形成了一个恶性循环：

```
页面更复杂 → JS 更多 → Hydration 更慢 → TTI 更差
```

## Qwik 的答案：Resumability

### 核心思想

Qwik 的 Resumability 理念：

> **服务端已经知道哪些元素需要事件绑定，为什么不把这个信息直接编码到 HTML 里？客户端只需要在用户交互时，按需加载对应的事件处理代码。**

### 一个最简单的 Qwik 组件

```tsx
import { component$, useSignal } from '@builder.io/qwik';

// $ 后缀是 Qwik 的"懒加载边界"标记
export component$(function Counter() {
  const count = useSignal(0);

  return (
    <button onClick$={() => count.value++}>
      Count: {count.value}
    </button>
  );
});
```

服务端渲染后的 HTML：

```html
<!-- 注意：事件处理器被序列化为 JSON，没有内联 JS -->
<button
  on:click="/src/components/counter.js#count_value++"
>
  Count: 0
</button>

<!-- Qwik 的状态恢复脚本，只有 1KB 左右 -->
<script id="qwikloader">
  // 全局事件代理：拦截 click 事件，按需加载对应处理代码
  // 这段代码是固定的，不会随组件数量增长
</script>
```

**关键区别**：
- Hydration：下载全部 JS → 执行全部组件 → 绑定事件
- Resumability：HTML 已包含事件映射 → 全局代理拦截 → 按需加载处理代码

### 序列化：Qwik 的魔法

Qwik 能做到 Resumability，核心是**序列化**——把服务端的闭包和状态"冻结"到 HTML 中：

```tsx
export component$(function SearchPage() {
  const query = useSignal('');
  const results = useSignal([]);

  // 这个闭包会被序列化！
  // 传统 SSR 框架做不到这一点
  const handleSearch = $(async () => {
    const data = await fetch(`/api/search?q=${query.value}`);
    results.value = await data.json();
  });

  return (
    <div>
      <input
        onInput$={(e) => query.value = e.target.value}
      />
      <button onClick$={handleSearch}>搜索</button>
      <ul>
        {results.value.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
});
```

服务端渲染后的 HTML 包含：

```html
<div>
  <input on:input="..." />
  <button on:click="...">搜索</button>
  <ul></ul>
</div>

<!-- 序列化的状态 -->
<script type="qwik/json">
{
  "query": "",
  "results": [],
  "handlers": {
    "handleSearch": {
      "closure": { "query": "refs[0]" },
      "chunk": "/src/components/search-page.js#handleSearch"
    }
  }
}
</script>
```

客户端恢复时：
1. 解析 JSON 中的状态
2. 全局代理监听 click/input 事件
3. 用户点击"搜索"时，才下载对应的 JS chunk
4. 闭包引用自动恢复，代码可以正常执行

## Qwik 核心概念

### 1. `$` 后缀：懒加载边界

Qwik 用 `$` 后缀标记"可延迟执行"的边界：

```tsx
import { component$, $, useSignal } from '@builder.io/qwik';

// component$：组件定义是懒加载边界
export component$(function MyComponent() {
  const count = useSignal(0);

  // $()：创建懒加载的回调
  const handleClick = $(() => {
    console.log('clicked', count.value);
  });

  // onClick$：事件处理器是懒加载边界
  return <button onClick$={handleClick}>Click me</button>;
});
```

`$` 的意义：
- 告诉编译器：这个函数不需要在客户端立即执行
- 编译器会把它提取到单独的 chunk
- 只在需要时才加载执行

### 2. useSignal：细粒度响应式

```tsx
import { component$, useSignal, useComputed$ } from '@builder.io/qwik';

export component$(function TodoApp() {
  const todos = useSignal<{ text: string; done: boolean }[]>([]);
  const filter = useSignal<'all' | 'active' | 'done'>('all');

  // 派生状态：只在依赖变化时重新计算
  const filteredTodos = useComputed$(() => {
    return todos.value.filter(todo => {
      if (filter.value === 'active') return !todo.done;
      if (filter.value === 'done') return todo.done;
      return true;
    });
  });

  const addTodo = $((text: string) => {
    todos.value = [...todos.value, { text, done: false }];
  });

  const toggleTodo = $((index: number) => {
    const newTodos = [...todos.value];
    newTodos[index] = { ...newTodos[index], done: !newTodos[index].done };
    todos.value = newTodos;
  });

  return (
    <div>
      <TodoInput onAdd={addTodo} />
      <FilterBar current={filter.value} onChange={filter.value = $evt} />
      <ul>
        {filteredTodos.value.map((todo, i) => (
          <li key={i} onClick$={() => toggleTodo(i)}>
            {todo.done ? '正确' : '⬜'} {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
});
```

### 3. useStore：对象状态

```tsx
import { component$, useStore } from '@builder.io/qwik';

export component$(function UserProfile() {
  const state = useStore({
    user: { name: 'Alice', email: 'alice@example.com' },
    loading: false,
    error: null as string | null,
  });

  const updateProfile = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(state.user),
      });
    } catch (err) {
      state.error = '更新失败';
    } finally {
      state.loading = false;
    }
  });

  return (
    <form onSubmit$={(e) => { e.preventDefault(); updateProfile(); }}>
      <input
        value={state.user.name}
        onInput$={(e) => state.user.name = e.target.value}
      />
      <button type="submit" disabled={state.loading}>
        {state.loading ? '保存中...' : '保存'}
      </button>
      {state.error && <p class="error">{state.error}</p>}
    </form>
  );
});
```

### 4. useResource$：异步数据加载

```tsx
import { component$, useResource$, Resource } from '@builder.io/qwik';

export component$(function ProductDetail({ productId }: { productId: string }) {
  const productResource = useResource$(async () => {
    const res = await fetch(`/api/products/${productId}`);
    return res.json();
  });

  return (
    <Resource
      value={productResource}
      onPending={() => <div>加载中...</div>}
      onRejected={(error) => <div>加载失败: {error.message}</div>}
      onResolved={(product) => (
        <div>
          <h1>{product.name}</h1>
          <p>{product.price}</p>
          <p>{product.description}</p>
        </div>
      )}
    />
  );
});
```

### 5. useVisibleTask$：客户端副作用

```tsx
import { component$, useVisibleTask$, useSignal } from '@builder.io/qwik';

export component$(function ScrollTracker() {
  const scrollY = useSignal(0);

  // 只在浏览器端执行（类似 React useEffect）
  useVisibleTask$(() => {
    const handleScroll = () => {
      scrollY.value = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  return <div>滚动位置: {scrollY.value}px</div>;
});
```

## 性能对比

### Time to Interactive (TTI)

```
场景：一个包含 50 个交互组件的页面

Next.js (SSR + Hydration):
├── HTML 下载:     200ms
├── JS 下载:       800ms  ← 全量 JS
├── Hydration:     400ms  ← 全量执行
└── TTI:          ~1400ms

Qwik (Resumability):
├── HTML 下载:     250ms  ← HTML 稍大（含序列化状态）
├── JS 下载:       50ms   ← 只有 Qwik Loader (~1KB)
├── Hydration:     0ms    ← 无需 Hydration！
└── TTI:          ~300ms
```

### 交互后的按需加载

```
用户点击"添加购物车"按钮时：
├── Qwik Loader 拦截 click 事件:         ~0ms
├── 下载对应的 JS chunk (2KB):           ~50ms
├── 恢复闭包状态，执行事件处理器:         ~5ms
└── 页面更新:                            ~10ms
总计:                                    ~65ms
```

## 与 React Server Components 的对比

RSC 和 Qwik 都在解决"减少客户端 JS"的问题，但路径完全不同：

| 维度 | React Server Components | Qwik |
|------|------------------------|------|
| 核心策略 | 服务端组件不发送 JS | 客户端代码按需加载 |
| Hydration | 仍需 Hydration（客户端组件） | 无 Hydration（Resumability） |
| 交互延迟 | 客户端组件需全量 Hydration | 按需加载，几乎零延迟 |
| 架构 | 服务端/客户端组件二分法 | 统一组件模型 |
| 状态管理 | 客户端组件用 useState/useReducer | useSignal/useStore |
| 学习曲线 | 需理解 Server/Client 边界 | 需理解 $ 懒加载边界 |
| 生态 | React 生态完整 | 生态成长中 |

```tsx
// RSC：明确区分 Server 和 Client
// Server Component（不发送 JS 到客户端）
async function ProductList() {
  const products = await db.products.findMany();
  return products.map(p => <ProductCard key={p.id} product={p} />);
}

// Client Component（需要 Hydration）
'use client';
function AddToCartButton({ productId }) {
  const [loading, setLoading] = useState(false);
  // 这部分代码会在客户端完整执行
}

// Qwik：统一模型，按需加载
export component$(function ProductList() {
  const products = useResource$(() => db.products.findMany());
  return (
    <Resource
      value={products}
      onResolved={(items) => items.map(p => <ProductCard key={p.id} product={p} />)}
    />
  );
  // 没有显式的 server/client 边界
  // 框架自动处理序列化和按需加载
});
```

## Qwik City：全栈框架

Qwik City 是 Qwik 的全栈框架（类似 Next.js 之于 React）：

### 路由

```
src/
├── routes/
│   ├── index.tsx          → /
│   ├── about/
│   │   └── index.tsx      → /about
│   ├── products/
│   │   ├── index.tsx      → /products
│   │   └── [id]/
│   │       └── index.tsx  → /products/:id
│   └── layout.tsx         → 共享布局
└── components/
    ├── Header.tsx
    └── Footer.tsx
```

### 服务端 API

```tsx
// src/routes/api/products/index.ts
export const onGet: RequestHandler = async ({ json }) => {
  const products = await db.products.findMany();
  json(200, products);
};

export const onPost: RequestHandler = async ({ request, json }) => {
  const body = await request.json();
  const product = await db.products.create({ data: body });
  json(201, product);
};
```

### 中间件

```tsx
// src/middleware.ts
export const onRequest: Middleware = async ({ request, redirect }) => {
  const session = await getSession(request);
  if (!session && request.url.includes('/dashboard')) {
    throw redirect('/login', 302);
  }
};
```

### 布局与嵌套路由

```tsx
// src/routes/layout.tsx
import { component$, Slot } from '@builder.io/qwik';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export default component$(() => {
  return (
    <div>
      <Header />
      <main>
        <Slot /> {/* 子路由内容渲染在这里 */}
      </main>
      <Footer />
    </div>
  );
});
```

## 局限性与适用场景

### 局限性

1. **生态相对年轻**：第三方组件库不如 React 丰富
2. **`$` 心智模型**：需要理解懒加载边界，初学者可能困惑
3. **调试复杂度**：序列化闭包出错时，调试信息不如 React 直观
4. **团队采用门槛**：从 React/Vue 迁移需要思维转变

### 适用场景

**强烈推荐 Qwik**：
- 内容密集型网站（电商、博客、新闻）——TTI 收益巨大
- 移动端 Web 应用——JS 体积敏感
- 对首屏交互速度有极致要求的场景

**继续用 React/Next.js**：
- 复杂 SPA 应用（管理后台、编辑器）
- 团队已深度绑定 React 生态
- 需要大量第三方 React 组件库

## 总结

Qwik 的 Resumability 是对 Hydration 范式的根本挑战：

- **零 Hydration**：服务端渲染的 HTML 已经是"活的"
- **按需加载**：只有用户实际交互的代码才会被下载和执行
- **序列化闭包**：服务端状态完美恢复到客户端
- **TTI 革命**：交互时间从秒级降到毫秒级

对比 React Server Components 的"减少发送到客户端的 JS"，Qwik 更激进——"只在需要时才发送 JS"。两者不是竞争关系，而是代表了前端性能优化的两种哲学：**减少总量** vs **延迟加载**。

在移动优先、性能至上的时代，Qwik 的 Resumability 理念值得每一个前端开发者关注。

本文由小虾子  撰写
