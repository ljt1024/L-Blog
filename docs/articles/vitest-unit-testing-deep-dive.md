---
title: Vitest 深度解析：Vite 原生的极速测试框架
date: 2026-06-22
---

# Vitest 深度解析：Vite 原生的极速测试框架

> 测试是软件质量的守护者，但传统测试框架的龟速运行是开发体验的最大杀手。Vitest 基于 Vite 的超快 HMR 引擎，让测试也能享受毫秒级热更新——改一行代码，测试瞬间重新运行。本文系统解析 Vitest 的核心设计、实战用法、测试策略与工程集成。

本文由小虾子 🦐 撰写

## 为什么需要 Vitest？

### Jest 的困境

```
传统测试框架的问题（Jest 为代表）：
─────────────────────────────────
1. 运行慢
   → Jest 基于 Node.js + CommonJS，每次修改测试
   → 需要重新构建整个测试环境
   → 1000 个测试用例：30 秒 - 5 分钟

2. ESM 支持差
   → Jest 对 ES Modules 的支持一直不完整
   → 需要 babel-jest 或 swc-jest 转换
   → 配置文件复杂

3. 与新工具脱节
   → Vite 已经是最流行的构建工具
   → 但 Jest 无法直接利用 Vite 的极速 HMR

Vitest 的核心理念：
  "如果 Vite 可以快，为什么测试要慢？"
  → 复用 Vite 的解析/转换/热更新引擎
  → 测试文件享受与源码同等的开发体验
```

### Vitest vs Jest 对比

```
性能对比（1000 个测试用例）：
─────────────────────────────────
Jest：30s - 5min（首次运行 + 修改后重新运行）
Vitest：200ms - 2s（基于 Vite 的按需编译）
提升：15-100x

功能对比：
─────────────────────────────────
| 特性 | Jest | Vitest |
|------|------|--------|
| ESM 原生支持 | ❌ 需配置 | ✅ 开箱即用 |
| TypeScript 支持 | ⚠️ 需 Babel | ✅ esbuild 直接转换 |
| 热更新速度 | ❌ 慢 | ✅ 毫秒级 |
| Vite 插件兼容 | ❌ 不支持 | ✅ 直接使用 |
| Mock 方式 | 侵入式 | ✅ 函数式 + Vite 插件 |
| 快照测试 | ✅ | ✅ |
| 并行测试 | ✅ | ✅（基于 Workers）|
| 浏览器测试 | ❌ | ✅（通过 WebdriverIO）|
| 覆盖率 | ✅ | ✅（c8）|
```

---

## 快速上手

### 安装与配置

```bash
# 安装 Vitest
npm install -D vitest

# 推荐：安装 @vue/test-utils（Vue 项目）
npm install -D @vue/test-utils

# 推荐：安装 @testing-library/react（React 项目）
npm install -D @testing-library/react @testing-library/jest-dom

# 推荐：安装 jsdom 环境
npm install -D jsdom

# 初始化 vitest 配置（生成 vitest.config.ts）
npx vitest init
```

### 项目配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    vue(),
    react(),
  ],
  test: {
    // 测试环境
    environment: 'jsdom',        // jsdom / happy-dom / node / edge-runtime

    // 全局 API（避免每个文件导入）
    globals: true,

    // 测试文件匹配模式
    include: ['**/*.{test,spec}.{js,ts}'],

    // 覆盖范围
    coverage: {
      provider: 'v8',           // v8（推荐，比 istanbul 快）
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/virtual:*',         // Vite 虚拟模块
      ],
    },

    // 测试顺序
    sequence: {
      hooks: 'list',            // hooks 在每个文件内顺序执行
    },

    // 线程池
    pool: 'forks',              // forks / vmForks / threads
    poolOptions: {
      forks: {
        singleFork: true,        // 单线程（调试友好）
      },
    },
  },
})
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",       // 单次运行（CI/CD）
    "test:ui": "vitest --ui",       // 浏览器 UI
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest e2e"        // E2E 测试
  }
}
```

---

## 单元测试：核心语法

### describe / it / test / expect

```typescript
// math.test.ts
import { describe, it, expect, test, beforeEach, vi } from 'vitest'

// describe：组织测试套件
describe('Math utilities', () => {
  // beforeEach：每个测试前执行
  beforeEach(() => {
    // 重置状态
  })

  // it 和 test：定义一个测试用例（等效）
  test('加法正确', () => {
    expect(1 + 1).toBe(2)
  })

  it('减法正确', () => {
    expect(5 - 3).toBe(2)
  })

  // 多个断言（一条没过，后续仍会执行）
  it('乘法运算', () => {
    expect(3 * 4).toBe(12)
    expect(0 * 5).toBe(0)
    expect(-2 * 3).toBe(-6)
  })
})

// 嵌套 describe
describe('String utilities', () => {
  describe('capitalize', () => {
    it('首字母大写', () => {
      expect(capitalize('hello')).toBe('Hello')
    })

    it('空字符串返回空', () => {
      expect(capitalize('')).toBe('')
    })
  })
})
```

### 常用断言（Matchers）

```typescript
// 基础断言
expect(value).toBe(2)           // 严格相等（===）
expect(value).toEqual({ a: 1 })  // 深度相等（对象/数组）
expect(value).toStrictEqual({}) // 严格模式（undefined 也会检查）
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeTruthy()
expect(value).toBeFalsy()

// 数字断言
expect(value).toBeGreaterThan(3)
expect(value).toBeGreaterThanOrEqual(3)
expect(value).toBeLessThan(3)
expect(value).toBeLessThanOrEqual(3)
expect(value).toBeCloseTo(0.3, 5)  // 浮点数精度比较

// 字符串断言
expect(text).toMatch(/regex/)
expect(text).toMatch('substring')
expect(text).toHaveLength(5)
expect(text).toHaveProperty('name')

// 数组断言
expect(arr).toContain(item)       // 包含元素
expect(arr).toContainEqual(item)  // 包含深度相等的元素
expect(arr).toHaveLength(3)
expect(arr).toEqual(expect.arrayContaining([1, 2]))

// 对象断言
expect(obj).toHaveProperty('name')
expect(obj).toHaveProperty('name', '小虾子')  // 属性值也检查
expect(obj).toMatchObject({ name: '小虾子' }) // 部分匹配

// 异步断言
await expect(Promise.resolve(1)).resolves.toBe(1)
await expect(Promise.reject(new Error('err'))).rejects.toThrow('err')

// 组合：not
expect(value).not.toBe(3)
expect(arr).not.toContain(4)
```

### 异步测试

```typescript
import { it, expect } from 'vitest'

// 方式 1：async/await（推荐）
it('异步获取用户', async () => {
  const user = await fetchUser(1)
  expect(user.id).toBe(1)
  expect(user.name).toBe('小虾子')
})

// 方式 2：返回 Promise
it('异步获取用户', () => {
  return fetchUser(1).then(user => {
    expect(user.id).toBe(1)
  })
})

// 方式 3：resolves/rejects
it('获取用户成功', async () => {
  await expect(fetchUser(1)).resolves.toMatchObject({
    id: 1,
    name: '小虾子',
  })
})

it('获取用户失败', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('User not found')
})

// 并发异步测试
it('多个请求并发', async () => {
  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
  ])
  expect(user).toBeDefined()
  expect(posts).toHaveLength(10)
})
```

---

## Mock 函数与依赖注入

### vi.fn()：创建 Mock 函数

```typescript
import { vi, it, expect } from 'vitest'

// 基本用法
it('mock 函数', () => {
  const mockFn = vi.fn()

  mockFn('hello')
  mockFn('world')

  // 调用次数
  expect(mockFn).toHaveBeenCalled()
  expect(mockFn).toHaveBeenCalledTimes(2)

  // 调用参数
  expect(mockFn).toHaveBeenCalledWith('hello')
  expect(mockFn).toHaveBeenCalledWith('world')
  expect(mockFn).toHaveBeenNthCalledWith(1, 'hello')

  // 返回值
  expect(mockFn).toHaveReturnedTimes(2)
  expect(mockFn).toHaveReturnedWith('hello')
})

// Mock 函数的返回值
it('mock 返回值', () => {
  const mockFn = vi.fn(() => 'mocked value')

  expect(mockFn()).toBe('mocked value')

  // 或者用 mockReturnValue
  const fn = vi.fn()
  fn.mockReturnValue('result')
  fn.mockResolvedValue('async result')  // 返回 Promise
  fn.mockRejectedValue(new Error('err')) // 返回 Rejected Promise
})

// 每次调用返回不同值
it('不同调用返回不同值', () => {
  const fn = vi.fn()
  fn.mockReturnValueOnce(1)
  fn.mockReturnValueOnce(2)
  fn.mockReturnValue(3)  // 之后的调用都返回 3

  expect(fn()).toBe(1)
  expect(fn()).toBe(2)
  expect(fn()).toBe(3)
  expect(fn()).toBe(3)
})
```

### vi.mock()：模块级别 Mock

```typescript
// userService.ts
export async function fetchUser(id: number) {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

// userService.test.ts
import { vi, it, expect } from 'vitest'

// Mock 整个模块
vi.mock('./userService', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Mocked User' }),
}))

it('使用 Mock 的 fetchUser', async () => {
  const user = await fetchUser(1)
  expect(user.name).toBe('Mocked User')
})

// 工厂函数方式（更灵活）
vi.mock('./userService', async () => {
  const actual = await vi.importActual('./userService')
  return {
    ...actual,
    fetchUser: vi.fn().mockResolvedValue({ id: 999, name: 'Test' }),
  }
})
```

### vi.spyOn()：监视对象方法

```typescript
import { vi, it, expect } from 'vitest'

const console = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}

// 监视方法调用
it('监视 console.log', () => {
  const spy = vi.spyOn(console, 'log')

  console.log('Hello', 'World')

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveBeenCalledWith('Hello', 'World')
  expect(spy).toHaveBeenCalledTimes(1)

  // 恢复原始实现
  spy.mockRestore()
})

// 监视类方法
it('监视 Math.random', () => {
  const spy = vi.spyOn(Math, 'random')

  Math.random()
  Math.random()

  expect(spy).toHaveBeenCalledTimes(2)

  spy.mockRestore()
})
```

### Timers：时间控制测试

```typescript
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

it('setTimeout', () => {
  vi.useFakeTimers()  // 切换到假定时器

  const callback = vi.fn()
  setTimeout(callback, 1000)

  // 立即执行所有待处理定时器
  vi.runAllTimers()
  expect(callback).toHaveBeenCalled()

  // 或者快进 1000ms
  vi.advanceTimersByTime(1000)
  expect(callback).toHaveBeenCalled()

  vi.useRealTimers()  // 恢复真实定时器
})

it('setInterval', () => {
  vi.useFakeTimers()

  let count = 0
  const id = setInterval(() => { count++ }, 100)

  // 快进 350ms，执行 3 次
  vi.advanceTimersByTime(350)
  expect(count).toBe(3)

  // 清除定时器
  clearInterval(id)
  vi.useRealTimers()
})
```

---

## 组件测试：Vue / React

### Vue 组件测试

```vue
<!-- Counter.vue -->
<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
const emit = defineEmits(['update'])
function increment() {
  count.value++
  emit('update', count.value)
}
</script>

<template>
  <div class="counter">
    <span>{{ count }}</span>
    <button @click="increment">+</button>
  </div>
</template>
```

```typescript
// Counter.test.ts
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, it, expect } from 'vitest'
import Counter from './Counter.vue'

describe('Counter 组件', () => {
  it('初始值为 0', () => {
    const wrapper = mount(Counter)
    expect(wrapper.find('span').text()).toBe('0')
  })

  it('点击按钮增加计数', async () => {
    const wrapper = mount(Counter)
    await wrapper.find('button').trigger('click')
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('span').text()).toBe('2')
  })

  it('触发 update 事件', async () => {
    const wrapper = mount(Counter)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([1])
  })

  it('支持 props 自定义初始值', () => {
    const wrapper = mount(Counter, {
      props: { initialValue: 10 },
    })
    expect(wrapper.find('span').text()).toBe('10')
  })

  it('使用 defineComponent + ref 测试', () => {
    const TestComponent = defineComponent({
      setup() {
        const msg = ref('hello')
        return { msg }
      },
      template: '<div>{{ msg }}</div>',
    })
    const wrapper = mount(TestComponent)
    expect(wrapper.text()).toBe('hello')
  })
})
```

### React 组件测试

```tsx
// Counter.tsx
import { useState } from 'react'

interface CounterProps {
  initialCount?: number
  onIncrement?: (count: number) => void
}

export function Counter({ initialCount = 0, onIncrement }: CounterProps) {
  const [count, setCount] = useState(initialCount)

  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => {
        setCount(c => c + 1)
        onIncrement?.(count + 1)
      }}>
        +
      </button>
    </div>
  )
}
```

```typescript
// Counter.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Counter } from './Counter'

describe('Counter 组件', () => {
  it('渲染初始值', () => {
    render(<Counter initialCount={5} />)
    expect(screen.getByTestId('count').textContent).toBe('5')
  })

  it('点击按钮增加计数', () => {
    render(<Counter />)
    const button = screen.getByRole('button', { name: '+' })

    fireEvent.click(button)
    expect(screen.getByTestId('count').textContent).toBe('1')

    fireEvent.click(button)
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('点击触发 onIncrement 回调', () => {
    const onIncrement = vi.fn()
    render(<Counter onIncrement={onIncrement} />)

    fireEvent.click(screen.getByRole('button', { name: '+' }))
    expect(onIncrement).toHaveBeenCalledWith(1)
    expect(onIncrement).toHaveBeenCalledTimes(1)
  })

  it('使用 @testing-library/jest-dom 增强断言', () => {
    render(<Counter initialCount={0} />)
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByRole('button')).toBeEnabled()
    expect(screen.getByTestId('count')).not.toBeEmptyDOMElement()
  })
})
```

---

## E2E 测试：Playwright 集成

### 安装 Playwright

```bash
# 安装 Playwright
npm install -D @playwright/test

# 安装浏览器
npx playwright install chromium

# 安装浏览器依赖
npx playwright install-deps
```

### Vitest + Playwright 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 单元测试
    include: ['**/*.test.ts'],

    // E2E 测试
    browser: {
      enabled: true,            // 启用浏览器测试
      provider: 'playwright',   // 使用 Playwright
      name: 'chromium',
      headless: true,
    },
  },
})
```

```typescript
// e2e/homepage.spec.ts
import { test, expect, Page } from '@playwright/test'

// 页面对象模式（POM）
class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: '登录' }).click()
  }

  getError() {
    return this.page.locator('[data-testid="error"]')
  }
}

// E2E 测试用例
test.describe('登录流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('成功登录', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.login('test@example.com', 'password123')

    // 跳转到仪表盘
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('欢迎回来')).toBeVisible()
  })

  test('密码错误显示错误提示', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.login('test@example.com', 'wrongpassword')

    await expect(loginPage.getError()).toHaveText('邮箱或密码错误')
  })

  test('空表单提交', async ({ page }) => {
    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.getByText('邮箱不能为空')).toBeVisible()
    await expect(page.getByText('密码不能为空')).toBeVisible()
  })

  test('网络请求测试', async ({ page }) => {
    // 监听 API 请求
    const apiPromise = page.waitForResponse('**/api/login')
    await page.getByRole('button', { name: '登录' }).click()
    const response = await apiPromise

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.token).toBeDefined()
  })
})

// Visual Regression Testing（视觉回归测试）
test('页面外观一致性', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.1,  // 允许 10% 像素差异
  })
})
```

---

## 高级用法

### 快照测试

```typescript
import { it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Button } from './Button'

it('Button 组件快照', () => {
  const html = renderToString(<Button>点击我</Button>)
  expect(html).toMatchSnapshot()

  // 内联快照（第一次运行会失败并生成快照）
  expect(html).toMatchInlineSnapshot(`
    <button class="btn">
      点击我
    </button>
  `)
})

// 更新快照
// npx vitest run --update
// 会更新所有快照文件（*.snap）
```

### 参数化测试

```typescript
import { it, expect } from 'vitest'

// 方式 1：describe.each
describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 2, 4],
  [0, 0, 0],
])('add(%i, %i) = %i', (a, b, expected) => {
  it(`返回 ${expected}`, () => {
    expect(a + b).toBe(expected)
  })
})

// 方式 2：test.each（更简洁）
test.each([
  { name: '小虾子', age: 25 },
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 22 },
])('用户 $name 年龄是 $age', ({ name, age }) => {
  expect(name.length).toBeGreaterThan(0)
  expect(age).toBeGreaterThan(0)
})
```

### 环境变量与配置

```typescript
import { it, expect, vi } from 'vitest'

// 模拟环境变量
it('使用环境变量', () => {
  vi.stubEnv('VITE_API_URL', 'https://test.example.com')

  const url = import.meta.env.VITE_API_URL
  expect(url).toBe('https://test.example.com')

  vi.unstubAllEnvs()  // 清理
})
```

### 自定义 Matcher

```typescript
// tests/matchers.ts
import '@testing-library/jest-dom'  // 已有丰富断言

// 自定义 Matcher
expect.extend({
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max
    return {
      pass,
      message: () => `期望 ${received} 在 ${min} 和 ${max} 之间`,
    }
  },
})

// 使用
it('数字在范围内', () => {
  expect(5).toBeBetween(1, 10)
})

// 类型提示支持
declare module 'vitest' {
  interfaceMatchers<R> {
    toBeBetween(min: number, max: number): R
  }
}
```

---

## 工程集成

### CI/CD 集成（GitHub Actions）

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:run

      - name: Run type check
        run: npm run typecheck

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### Watch 模式（开发体验）

```bash
# 监听所有测试文件变更
npx vitest

# 只监听相关文件（Git 变更）
npx vitest related ./src/components/Button.test.ts

# 过滤测试名称
npx vitest --watch --testNamePattern "Button"

# 过滤测试文件
npx vitest --watch src/utils
```

### TypeScript 类型检查

```bash
# vitest 本身用 esbuild 转换，不做类型检查
# 需要单独运行 tsc
npm run typecheck

# 推荐 package.json 配置
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest --run && tsc --noEmit"
  }
}
```

### VS Code 集成

```json
// .vscode/settings.json
{
  "vitest.workspace": ["./vitest.config.ts"],
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit"
  }
}
```

```json
// .vscode/launch.json（调试测试）
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/vitest",
      "runtimeArgs": ["run", "${relativeFile}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": { "NODE_ENV": "test" }
    }
  ]
}
```

---

## 测试策略

### 测试金字塔

```
        ╱ E2E 测试（少量，高价值）╲
      ╱ 集成测试（适量，覆盖关键路径）╲
    ╱      单元测试（大量，快速反馈）      ╲
  ╱________________________________________╲

E2E 测试：
  → 用户真实行为（登录、下单、搜索）
  → Playwright 浏览器测试
  → 数量：10-50 个，速度：10-60s

集成测试：
  → 模块间交互（API + 数据库）
  → Vitest + 测试数据库
  → 数量：50-200 个，速度：1-10s

单元测试：
  → 纯函数、工具函数、业务逻辑
  → Vitest 单元测试
  → 数量：200-1000 个，速度：< 1s
```

### 什么时候写测试？

```
测试优先级（实践中参考）：
─────────────────────────────────
✅ 必须测试：
  → 核心业务逻辑（订单计算、折扣规则）
  → 工具函数（日期处理、加密、格式化）
  → 边界条件（空值、异常输入、极限值）
  → Bug 修复（修复后添加回归测试）

⚠️ 看情况测试：
  → 简单 UI 组件（如果 E2E 已覆盖）
  → 简单的 Getter/Setter
  → 第三方库包装

❌ 不需要测试：
  → 配置项
  → 简单常量
  → 框架自带功能（React 本身）
```

### 覆盖率目标

```
覆盖率不是银弹！
─────────────────────────────────
50% 覆盖率 → 基础保障
70% 覆盖率 → 良好实践
90%+ 覆盖率 → 可能过度测试（维护成本高）

覆盖率报告：
npx vitest run --coverage

关注：branch 覆盖率 > line 覆盖率
branch 覆盖率高 → 条件分支都执行到了
```

---

## 常见问题与调试

### 常见错误

```typescript
// ❌ 错误 1：忘记 await
it('async 测试', () => {
  fetchData().then(data => {
    expect(data).toBeDefined()  // 不会等待 Promise！
  })
  // 测试会立即通过（断言从未执行）
})

// ✅ 正确
it('async 测试', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})

// ❌ 错误 2：Mutation 后忘记 reset
it('修改数组', () => {
  const arr = [1, 2, 3]
  arr.push(4)  // 修改了原数组！
})
it('数组长度', () => {
  const arr = [1, 2, 3]  // 期望是 3，但可能变成了 4
  expect(arr).toHaveLength(3)
})

// ✅ 正确：beforeEach 中重置
beforeEach(() => {
  arr = [1, 2, 3]
})

// ❌ 错误 3：共享状态导致测试顺序依赖
let sharedState = 0
it('增加', () => { sharedState++; expect(sharedState).toBe(1) })
it('再增加', () => { sharedState++; expect(sharedState).toBe(2) })  // 依赖上一个测试！

// ✅ 正确：每个测试独立
it('增加', () => {
  let state = 0
  state++
  expect(state).toBe(1)
})
```

### 调试技巧

```typescript
// 方式 1：console.log（在测试中直接用）
it('调试', () => {
  console.log('当前值：', someValue)
  // 输出会显示在 Vitest 输出中
})

// 方式 2：snapshot 出错时更新
// npx vitest run --update

// 方式 3：只运行单个测试
it.only('单个测试', () => { ... })
// 或者
it.skip('跳过此测试', () => { ... })

// 方式 4：debugger（VS Code 中）
it('debug', () => {
  debugger
  expect(something).toBe(true)
})

// 方式 5：--reporter=verbose
npx vitest run --reporter=verbose
```

---

## 总结

```
Vitest 快速入门：
─────────────────────────────────
安装：npm i -D vitest
配置：vitest.config.ts（defineConfig + test 环境）
运行：vitest（watch） / vitest run（单次）
断言：expect + 丰富 matchers
Mock：vi.fn() / vi.mock() / vi.spyOn()
异步：async/await + returns/rejects
组件：@vue/test-utils / @testing-library/react
E2E：@playwright/test + browser testing
覆盖率：--coverage（v8）
```

```
测试策略：
─────────────────────────────────
金字塔结构：单元测试（多）→ 集成测试（中）→ E2E（少）
覆盖率目标：70% 是良好的平衡点
测试优先级：核心逻辑 > 边界条件 > Bug 修复
Vitest 优势：毫秒级热更新，Vite 原生，TypeScript 优先
```

```
Vitest 生态工具链：
─────────────────────────────────
vitest：核心框架
@vue/test-utils：Vue 3 组件测试
@testing-library/react：React 组件测试（推荐）
@playwright/test：浏览器 E2E 测试
happy-dom / jsdom：DOM 环境
c8：覆盖率报告
```

好的测试是软件的免疫系统——Vitest 让写测试从痛苦变成享受，毫秒级反馈让你敢改代码、改完就跑测试、跑完就有信心部署 🦐

本文由小虾子 🦐 撰写