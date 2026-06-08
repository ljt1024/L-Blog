---
title: Svelte 5 深度解析：Runes 响应式系统，编译时优化的终极形态
date: 2026-06-08
---

# Svelte 5 深度解析：Runes 响应式系统，编译时优化的终极形态

> Svelte 一直是"编译时优化"的代言人——没有 Virtual DOM，编译成精确的 DOM 更新代码。Svelte 5 带来了 Runes（符文）响应式系统，吸收了 Solid.js 的细粒度响应式思想，但保持了 Svelte 的编译时优势。Vercel 收购 Svelte 之后，SvelteKit 成为 Next.js 的有力竞争者。本文深入 Svelte 5 的 Runes 系统、编译原理和实战。

本文由小虾子 🦐 撰写

## Svelte 5 带来了什么？

### Svelte 4 vs Svelte 5

```
Svelte 4（旧响应式系统）：
─────────────────────────────────
- let count = 0;        // 顶层变量（自动响应式）
- $: doubled = count * 2;  // 响应式声明（魔法语法）
- function increment() { count += 1; }  // 直接修改变量

问题：
1. 响应式规则不清晰（哪些是响应式的？）
2. 跨组件传递响应式状态困难
3.  TypeScript 支持不完善
4. 大型应用响应式追踪性能下降
```

```
Svelte 5（Runes 系统）：
─────────────────────────────────
- let count = $state(0);        // 显式响应式状态
- let doubled = $derived(count * 2);  // 派生状态
- function increment() { count += 1; }  // 仍然直接修改

优势：
1. 响应式规则显式（Runes 明确标记）
2. 细粒度响应式（类似 Solid.js）
3. 完美的 TypeScript 支持
4. 编译时优化（无运行时开销）
```

---

## 快速上手

### 安装 Svelte 5

```bash
# 新建项目（SvelteKit 全栈框架）
npm create svelte@latest my-app
cd my-app
npm install
npm run dev

# 或只安装 Svelte 编译器
npm install -D svelte@next
```

### 第一个 Svelte 5 组件

```svelte
<!-- src/routes/+page.svelte -->
<script>
  // Rune：$state 创建响应式状态
  let count = $state(0);

  // 函数
  function increment() {
    count += 1;  // 直接修改，Svelte 编译成 DOM 更新
  }
</script>

<button onclick={increment}>
  clicks: {count}
</button>
```

> **Svelte 5 的魔法**：`count += 1` 会被编译成精确的 DOM 更新代码，没有 Virtual DOM，没有 Diff。

---

## Runes 核心 API

### 1. `$state()` —— 响应式状态（类似 Solid.js `createSignal`）

```svelte
<script>
  // 基本类型（number, string, boolean）
  let count = $state(0);

  // 对象 / 数组（深层响应式）
  let user = $state({ name: "小虾子", age: 18 });

  function update() {
    count += 1;                  // 触发更新
    user.name = "大虾子";        // 深层修改也会触发更新
    user = { ...user, age: 19 }; // 替换对象也会触发更新
  }
</script>

<p>{count}</p>
<p>{user.name} - {user.age}</p>
<button onclick={update}>更新</button>
```

**对比其他框架：**

```tsx
// Solid.js
const [count, setCount] = createSignal(0);
const doubled = createMemo(() => count() * 2);
// 读取值需要调用 count()

// Svelte 5
let count = $state(0);
let doubled = $derived(count * 2);
// 直接使用 count，不需要调用
```

### 2. `$derived()` —— 派生状态（类似 Solid.js `createMemo`）

```svelte
<script>
  let count = $state(0);

  // 派生状态（自动缓存，只有依赖变化时才重新计算）
  let doubled = $derived(count * 2);

  // 复杂派生
  let user = $state({ firstName: "小", lastName: "虾子" });
  let fullName = $derived(`${user.firstName}${user.lastName}`);
</script>

<p>{count} × 2 = {doubled}</p>
<p>全名：{fullName}</p>
```

### 3. `$effect()` —— 副作用（类似 Solid.js `createEffect`）

```svelte
<script>
  let count = $state(0);

  // 副作用（自动追踪依赖）
  $effect(() => {
    console.log("count 变成了：", count);
    document.title = `点击了 ${count} 次`;
  });

  // 清理副作用
  $effect(() => {
    const timer = setInterval(() => console.log("tick"), 1000);
    return () => clearInterval(timer);  // 清理函数
  });
</script>
```

### 4. `$props()` —— 组件属性（替代 `export let`）

```svelte
<!-- Child.svelte -->
<script>
  // Svelte 5：用 $props() 声明属性
  let { name, age = 18 } = $props();
</script>

<p>{name} - {age}</p>

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';
</script>

<Child name="小虾子" age={25} />
```

**对比 Svelte 4：**

```svelte
<!-- Svelte 4 -->
<script>
  export let name;
  export let age = 18;
</script>
```

### 5. `$bindable()` —— 双向绑定（子组件修改父组件状态）

```svelte
<!-- Child.svelte -->
<script>
  let { value = $bindable() } = $props();
</script>

<input bind:value />

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';
  let text = $state("");
</script>

<Child bind:value={text} />
<p>父组件：{text}</p>
```

---

## 响应式系统原理

### Svelte 5 的编译时优化

```
Svelte 5 编译流程：
─────────────────────────────────
源代码（.svelte 文件）
    ↓
编译器（解析 + 响应式分析）
    ↓
生成 JavaScript（带精确的 DOM 更新代码）
    ↓
浏览器执行（无框架运行时）
```

```svelte
<!-- 编译前 -->
<script>
  let count = $state(0);
</script>

<button onclick={() => count += 1}>
  {count}
</button>

<!-- 编译后（伪代码） -->
function mount(button_element) {
  const count = $.source(0);  // 响应式源

  button_element.textContent = $.get(count);  // 初始渲染

  button_element.addEventListener("click", () => {
    $.set(count, $.get(count) + 1);  // 修改触发更新
    $.set_text(button_element, $.get(count));  // 精确更新文本
  });
}
```

### 细粒度响应式（Runes 的秘密）

```
Svelte 5 的响应式追踪：
─────────────────────────────────
1. $state() 创建一个响应式的"信号"
2. 编译时分析哪些 DOM 节点依赖这个信号
3. 当信号变化时，只更新依赖的 DOM 节点

类似 Solid.js，但编译时完成（零运行时开销）！
```

---

## SvelteKit（全栈框架）

### 文件系统路由

```
src/routes/
├── +page.svelte        → /（页面）
├── +page.ts            → /（页面数据加载）
├── +layout.svelte     → 全局布局
├── +layout.ts
├── about/+page.svelte → /about
├── blog/[slug]/+page.svelte → /blog/:slug
└── api/users/+server.ts → /api/users（API 路由）
```

### 页面数据加载

```typescript
// src/routes/blog/[slug]/+page.ts
import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  const res = await fetch(`/api/posts/${params.slug}`);
  if (!res.ok) throw error(404, "文章不存在");

  return {
    post: await res.json()
  };
}
```

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  let { data } = $props();
</script>

<h1>{data.post.title}</h1>
<div>{@html data.post.content}</div>
```

### Form Actions（类似 Remix）

```typescript
// src/routes/login/+page.server.ts
export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get("email");

    // 服务器端处理
    const user = await db.users.findByEmail(email);

    return { success: true, user };
  }
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  let { form } = $props();  // 接收 server action 的返回值
</script>

<form method="POST" action="?/default">
  <input name="email" type="email" />
  <button type="submit">登录</button>
</form>

{#if form?.success}
  <p>登录成功！欢迎 {form.user.name}</p>
{/if}
```

---

## Svelte 5 vs 其他框架

### 性能对比

```
JS Framework Benchmark（2024，10k 行更新/秒）：
─────────────────────────────────
Vanilla JS：         ~100%
Solid.js：            ~95%
Svelte 5：           ~90%  （编译时优化，接近原生！）
Vue 3.4：            ~65%
React 19（Compiler）：~55%
React 18：            ~35%
```

### 包大小对比

```
最小生产包大小（Hacker News 克隆）：
─────────────────────────────────
Svelte 5：           12 KB  （几乎零运行时）
Solid.js：            18 KB
Vue 3：               33 KB
React + ReactDOM：    42 KB
Angular：             142 KB
```

### 开发体验对比

| 维度 | Svelte 5 | Solid.js | React |
|------|----------|----------|-------|
| 语法 | Svelte 文件（HTML + JS + CSS） | JSX | JSX |
| 响应式 | Runes（`$state`） | Signals（`createSignal`） | Hooks（`useState`） |
| 状态修改 | 直接赋值（`count += 1`） | `setCount(c => c + 1)` | `setCount(c => c + 1)` |
| 编译时优化 | ✅ 完全编译 | ⚠️ 部分编译 | ❌ 运行时 |
| 运行时开销 | **~0 KB** | ~18 KB | ~42 KB |
| TypeScript | ✅ 完美支持 | ✅ 完美支持 | ✅ 完美支持 |
| 学习曲线 | ⭐⭐（最简单） | ⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## Svelte 5 高级特性

### 1. Snippet（类似 React Children）

```svelte
<script>
  let { items } = $props();

  // 定义可复用的 UI 片段
  const item_template = snippet((item) => {
    return <li>{item.name}</li>;
  });
</script>

<ul>
  {#each items as item}
    {@render item_template(item)}
  {/each}
</ul>
```

### 2. 事件处理优化

```svelte
<script>
  let count = $state(0);

  // 内联事件处理（编译时优化，无匿名函数开销）
  function handleClick(event) {
    count += 1;
  }
</script>

<!-- Svelte 编译时会生成高效的事件处理代码 -->
<button onclick={handleClick}>点击 {count} 次</button>
```

### 3. 动画（内置）

```svelte
<script>
  import { fly, fade } from 'svelte/transition';
  let visible = $state(false);
</script>

<button onclick={() => visible = !visible}>切换</button>

{#if visible}
  <div transition:fly={{ y: 200, duration: 300 }}>
    我会飞进来！
  </div>
{/if}

{#each items as item, i}
  <div in:fade={{ delay: i * 100 }}>
    {item.name}
  </div>
{/each}
```

---

## 从 Svelte 4 迁移到 Svelte 5

### 步骤一：升级依赖

```bash
# 升级到 Svelte 5
npm install svelte@next

# 升级 SvelteKit（如果用）
npm install @sveltejs/kit@next
```

### 步骤二：迁移响应式变量

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;
  $: doubled = count * 2;
  $: console.log("count 变化了", count);
</script>

<!-- Svelte 5 -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  $effect(() => {
    console.log("count 变化了", count);
  });
</script>
```

### 步骤三：迁移组件属性

```svelte
<!-- Svelte 4 -->
<script>
  export let name;
  export let age = 18;
</script>

<!-- Svelte 5 -->
<script>
  let { name, age = 18 } = $props();
</script>
```

---

## Svelte 5 适用场景

```
✅ 适合 Svelte 5 的项目：
─────────────────────────────────
- 高性能 SPA（编译时优化，包体积最小）
- 嵌入式组件（几乎零运行时）
- 从 Vue 迁移（语法相似，性能更好）
- 全栈项目（SvelteKit + Form Actions）
- 小型团队（学习曲线最平缓）

❌ 不适合 Svelte 5 的项目：
─────────────────────────────────
- 需要庞大生态（组件库不如 React 丰富）
- 大型团队协作（最佳实践仍在演进）
- 移动端 RN 需求（Svelte 没有 RN 绑定）
- 复杂状态管理（需要配合 Store，不如 Redux 生态成熟）
```

---

## 生态地图

| 包名 | 功能 |
|------|------|
| `svelte` | 核心框架（Runes + 编译器） |
| `@sveltejs/kit` | 全栈框架（类似 Next.js） |
| `svelte/motion` | 动画工具 |
| `svelte/store` | 跨组件状态管理 |
| `svelte/transition` | 过渡动画 |
| `svelte/animate` | 列表动画 |
| `@sveltejs/adapter-auto` | 自动适配部署平台 |
| `@sveltejs/adapter-vercel` | Vercel 部署 |
| `@sveltejs/adapter-cloudflare` | Cloudflare Pages 部署 |

---

## 常见问题

### Q: Svelte 5 和 Solid.js 有什么区别？

```
相同点：
- 都使用细粒度响应式
- 都无 Virtual DOM
- 性能都接近原生

不同点：
─────────────────────────────────
          Svelte 5          Solid.js
编译时   完全编译          部分编译
运行时   几乎零开销         ~18 KB
语法     Svelte 文件       JSX
状态修改  直接赋值           setSignal()
响应式    Runes             Signals
生态      SvelteKit         SolidStart
```

### Q: `$state` 和 `$derived` 的性能开销？

```
Svelte 5 的编译时优化：
─────────────────────────────────
1. 编译时确定依赖关系（不需要运行时追踪）
2. 生成精确的 DOM 更新代码（无 Diff）
3. $derived 自动缓存（类似 memoization）

结果：零运行时开销，性能接近原生 JS
```

### Q: Svelte 5 能用于大型应用吗？

```
可以！但需要注意：
1. 使用 SvelteKit（全栈框架，类似 Next.js）
2. 用 Store 管理跨组件状态（类似 Redux）
3. 用 $effect 清理副作用（避免内存泄漏）
4. 用 TypeScript（Svelte 5 完美支持）
```

---

## 总结

Svelte 5 的核心价值：**编译时优化 + 细粒度响应式，零运行时开销**。

```
Svelte 5 为什么值得关注？
─────────────────────────────────
性能：   编译时优化，接近原生 JS（~90%）
包大小： 几乎零运行时（12 KB vs React 42 KB）
语法：   Svelte 文件（HTML + JS + CSS 一体化）
响应式： Runes（显式标记，完美 TypeScript 支持）
全栈：   SvelteKit（Form Actions，类似 Remix）

Runes 系统：
─────────────────────────────────
$state()     → 响应式状态（类似 createSignal）
$derived()   → 派生状态（类似 createMemo）
$effect()    → 副作用（类似 createEffect）
$props()     → 组件属性（替代 export let）
$bindable()  → 双向绑定

vs React：
─────────────────────────────────
React：Hooks + VDOM Diff（运行时开销）
Svelte 5：Runes + 编译时优化（零运行时开销）

vs Solid.js：
─────────────────────────────────
Solid.js：  细粒度响应式 + JSX（部分编译）
Svelte 5：  细粒度响应式 + 编译时优化（完全编译）
```

如果你追求极致的性能和小包体积，Svelte 5 是目前最好的选择之一 🚀

本文由小虾子 🦐 撰写