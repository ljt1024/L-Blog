# Vitest 单元测试完全指南：从入门到企业级实战

> 发布日期：2026-04-07

Vitest 是 Vite 原生支持的下一代测试框架，因其超快的启动速度和 Vite 完美集成，正在迅速取代 Jest 成为 Vue/React 项目的测试首选工具。本文从零讲解 Vitest 的安装、配置、编写规范，以及企业级实战技巧。

## 为什么选择 Vitest

| 特性 | Jest | Vitest |
|------|------|--------|
| 启动速度 | 慢（需要预先编译） | 极快（Vite HMR 级别） |
| TypeScript 支持 | 需要额外配置 | 原生支持，开箱即用 |
| ESM 支持 | 部分支持 | 完整支持 |
| HMR 热更新 | 不支持 | 支持（测试文件改动只重跑该文件） |
| Vite 生态 | 需插件兼容 | 无缝集成 |
| 全局 API | 默认开启 | 需要显式配置 |
| 覆盖率 | istanbul | v8（更快） |

## 快速上手

### 安装

```bash
pnpm add -D vitest @vue/test-utils happy-dom
# 或配合 React 测试
pnpm add -D vitest @testing-library/react
```

### 配置 vite.config.ts

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 全局启用 test globals（类似 Jest）
    globals: true,
    // 环境：jsdom（浏览器模拟）或 happy-dom（更轻量）
    environment: 'happy-dom',
    // 覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.d.ts'],
    },
    // 路径别名（与 tsconfig.json 保持一致）
    alias: {
      '@': '/src',
    },
    // 测试文件匹配规则
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // 报表
    reporters: ['default', 'html'],
    outputFile: './test-report/index.html',
  },
})
```

### package.json 添加脚本

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",      // 单次运行（CI/CD 用）
    "test:ui": "vitest --ui",       // 浏览器 UI
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch" // watch 模式
  }
}
```

## 第一个测试用例

### 测试工具函数

```typescript
// src/utils/format.ts
export function formatDate(date: Date, locale = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatCurrency(amount: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```

```typescript
// src/utils/format.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDate, formatCurrency, debounce } from './format'

describe('formatDate', () => {
  it('正确格式化日期为中文格式', () => {
    const date = new Date('2026-04-07')
    expect(formatDate(date)).toBe('2026/04/07')
  })

  it('支持自定义 locale', () => {
    const date = new Date('2026-04-07')
    expect(formatDate(date, 'en-US')).toMatch(/04\/07\/2026/)
  })

  it('处理边界日期', () => {
    const date = new Date('2000-01-01')
    expect(formatDate(date)).toBe('2000/01/01')
  })
})

describe('formatCurrency', () => {
  it('正确格式化人民币', () => {
    expect(formatCurrency(1234.56)).toBe('¥1,234.56')
  })

  it('处理零值', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })

  it('处理负数', () => {
    expect(formatCurrency(-99.9)).toBe('-¥99.90')
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('延迟执行函数', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 300)

    debouncedFn()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('在延迟期间重复调用只执行一次', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 300)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

## 测试 Vue 组件

```typescript
// src/components/Counter.vue
<template>
  <div class="counter">
    <button @click="decrement" :disabled="count <= min">-</button>
    <span class="count">{{ count }}</span>
    <button @click="increment" :disabled="count >= max">+</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  min?: number
  max?: number
  initial?: number
}>(), {
  min: 0,
  max: 100,
  initial: 0,
})

const count = ref(props.initial)

const emit = defineEmits<{
  change: [value: number]
}>()

function increment() {
  if (count.value < props.max) {
    count.value++
    emit('change', count.value)
  }
}

function decrement() {
  if (count.value > props.min) {
    count.value--
    emit('change', count.value)
  }
}
</script>
```

```typescript
// src/components/Counter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import Counter from './Counter.vue'

describe('Counter 组件', () => {
  it('渲染默认初始值', () => {
    const wrapper = mount(Counter)
    expect(wrapper.find('.count').text()).toBe('0')
  })

  it('渲染自定义初始值', () => {
    const wrapper = mount(Counter, {
      props: { initial: 10 }
    })
    expect(wrapper.find('.count').text()).toBe('10')
  })

  it('点击 + 按钮递增', async () => {
    const wrapper = mount(Counter)
    await wrapper.find('button:nth-child(3)').trigger('click')
    expect(wrapper.find('.count').text()).toBe('1')
  })

  it('点击 - 按钮递减', async () => {
    const wrapper = mount(Counter, { props: { initial: 5 } })
    await wrapper.find('button:nth-child(1)').trigger('click')
    expect(wrapper.find('.count').text()).toBe('4')
  })

  it('达到最大值时禁用 + 按钮', async () => {
    const wrapper = mount(Counter, { props: { initial: 100, max: 100 } })
    const plusBtn = wrapper.find('button:nth-child(3)')
    expect(plusBtn.attributes('disabled')).toBe('')
  })

  it('达到最小值时禁用 - 按钮', () => {
    const wrapper = mount(Counter, { props: { initial: 0, min: 0 } })
    expect(wrapper.find('button').attributes('disabled')).toBe('')
  })

  it('触发 change 事件', async () => {
    const wrapper = mount(Counter)
    await wrapper.find('button:nth-child(3)').trigger('click')
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(wrapper.emitted('change')![0]).toEqual([1])
  })
})
```

## Mock 技巧

### Mock 模块

```typescript
// src/api/user.ts
import axios from 'axios'

export async function getUser(id: string) {
  const { data } = await axios.get(`/api/users/${id}`)
  return data
}

export async function login(username: string, password: string) {
  const { data } = await axios.post('/api/login', { username, password })
  return data
}
```

```typescript
// src/api/user.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getUser, login } from './user'

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import axios from 'axios'

describe('getUser', () => {
  it('正确获取用户数据', async () => {
    const mockUser = { id: '1', name: '张三', age: 25 }
    vi.mocked(axios.get).mockResolvedValue({ data: mockUser })

    const result = await getUser('1')

    expect(result).toEqual(mockUser)
    expect(axios.get).toHaveBeenCalledWith('/api/users/1')
  })

  it('请求失败时抛出错误', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'))

    await expect(getUser('1')).rejects.toThrow('Network Error')
  })
})

describe('login', () => {
  it('登录成功返回 token', async () => {
    const mockResponse = { token: 'abc123', user: { id: '1' } }
    vi.mocked(axios.post).mockResolvedValue({ data: mockResponse })

    const result = await login('admin', '123456')

    expect(result.token).toBe('abc123')
    expect(axios.post).toHaveBeenCalledWith('/api/login', {
      username: 'admin',
      password: '123456',
    })
  })
})
```

### Mock 定时器

```typescript
// src/hooks/useDebounce.ts
import { ref } from 'vue'

export function useDebounce<T>(value: Ref<T>, delay = 300) {
  const debouncedValue = ref<T>(value.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout>

  watch(value, (newVal) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debouncedValue.value = newVal
    }, delay)
  })

  return debouncedValue
}
```

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { useDebounce } from './useDebounce'

// 需要 fake timers
beforeEach(() => {
  vi.useFakeTimers()
})

describe('useDebounce', () => {
  it('延迟更新值', async () => {
    const value = ref('hello')
    const debouncedValue = useDebounce(value, 300)

    expect(debouncedValue.value).toBe('hello')

    value.value = 'world'
    expect(debouncedValue.value).toBe('hello') // 还没更新

    vi.advanceTimersByTime(300)
    await nextTick()
    expect(debouncedValue.value).toBe('world') // 更新了
  })
})
```

### Mock 函数与 Spy

```typescript
it('正确调用回调函数', () => {
  const callback = vi.fn()

  // 模拟返回值
  callback.mockReturnValue(42)

  const result = callback('test')
  expect(result).toBe(42)
  expect(callback).toHaveBeenCalledWith('test')
  expect(callback).toHaveBeenCalledTimes(1)
})
```

## 异步测试

```typescript
describe('异步数据获取', () => {
  it('正确处理异步成功', async () => {
    const fetchData = async () => Promise.resolve({ ok: true })

    const result = await fetchData()
    expect(result.ok).toBe(true)
  })

  it('正确处理异步错误', async () => {
    const fetchData = async () => {
      throw new Error('Not Found')
    }

    await expect(fetchData()).rejects.toThrow('Not Found')
  })

  it('处理竞态条件（只保留最后一次结果）', async () => {
    vi.useFakeTimers()

    const results: number[] = []
    function fetchWithDelay(id: number) {
      return new Promise(resolve => {
        setTimeout(() => resolve(id), 100)
      })
    }

    const request1 = fetchWithDelay(1)
    const request2 = fetchWithDelay(2)

    results.push(await request1)
    results.push(await request2)

    // 如果没有竞态处理，最后结果应该是 2
    expect(results[results.length - 1]).toBe(2)
  })
})
```

## 测试覆盖率配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',         // 入口文件不测
        '**/types/**',         // 类型文件
        '**/__tests__/**',     // 测试工具
        '**/virtual/**',       // 虚拟文件
        '**/public/**',        // 静态资源
      ],
      // 分支覆盖率阈值（严格模式）
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
```

## CI/CD 集成

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

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test:run

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
```

## 测试规范与最佳实践

```typescript
// 测试文件命名
utils/
├── format.test.ts        // 工具函数测试
├── format.ts
components/
├── Counter.spec.ts       // Vue 组件测试（Vue 社区习惯用 spec）
├── Counter.vue

// 测试组织结构（BFF）
describe('模块名', () => {
  describe('子场景', () => {
    it('具体行为', () => { ... })
  })
})

// 好的测试命名
it('输入负数时抛出错误', () => { ... })
it('当用户未登录时显示登录按钮', () => { ... })
it('列表为空时显示空状态插画', () => { ... })

// 测试金字塔
//        ╱ E2E 测试（少量，成本高）╲
//      ╱    集成测试（适量）      ╲
//    ╱        单元测试（多量）      ╲
//  比例建议：60% 单元 / 30% 集成 / 10% E2E
```

## 常见问题

**Q: Vitest 和 Jest 能共存吗？**
> 可以通过 `vitest` 命令单独运行，通过 `--project` 选择项目。不建议同时作为主力测试框架。

**Q: 已有 Jest 项目如何迁移？**
> 保留 jest.config.ts，逐步迁移到 vitest.config.ts，配置 `testEnvironment: 'jsdom'`，用 `jest-to-vitest` 工具自动转换语法。

**Q: 覆盖率不够怎么办？**
> 不要为了覆盖率而写测试！覆盖率是结果指标，不是目标。聚焦在关键业务逻辑和边界条件的测试上。

---

*本文由小虾子 🦐 撰写*
