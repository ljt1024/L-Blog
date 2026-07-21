# Zod 运行时类型校验完全指南

在 TypeScript 项目中，我们习惯了编译时的类型安全，但当数据来自外部（API 响应、表单输入、配置文件等），编译时类型就无能为力了。Zod 作为"TypeScript 优先"的运行时类型校验库，完美填补了这一空白。

## 为什么需要运行时类型校验？

TypeScript 的类型系统存在于编译时，在运行时被完全擦除。考虑这个场景：

```typescript
// 定义 API 响应类型
interface User {
  id: number
  name: string
  email: string
}

// 从 API 获取数据
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()

  // TypeScript 认为返回的是 User，但实际可能是任何东西
  return data as User // 危险的类型断言！
}
```

如果 API 返回的数据结构不符合预期（字段缺失、类型错误、额外的未知字段），TypeScript 不会报警，但运行时可能崩溃。Zod 解决的正是这个问题。

## Zod 的核心设计理念

### 类型推断优先

Zod 的设计哲学是"类型定义即校验规则，校验规则即类型定义"。你只需定义一次 schema，TypeScript 类型会自动推断：

```typescript
import { z } from 'zod'

// 定义 schema
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    notifications: z.boolean().default(true)
  }).optional()
})

// 自动推断类型
type User = z.infer<typeof UserSchema>
// 等价于：
// type User = {
//   id: number
//   name: string
//   email: string
//   createdAt: string
//   role: 'admin' | 'user' | 'guest'
//   preferences?: {
//     theme?: 'light' | 'dark'
//     notifications: boolean
//   }
// }
```

### 组合式 API

Zod 提供了丰富的组合式 API，可以构建任意复杂的类型：

```typescript
// 基础类型
z.string()
z.number()
z.boolean()
z.null()
z.undefined()
z.nullable(z.string())  // string | null
z.optional(z.string())  // string | undefined
z.nullish(z.string())   // string | null | undefined

// 复杂类型
z.array(z.string())
z.record(z.string(), z.number()) // Record<string, number>
z.map(z.string(), z.number())
z.set(z.number())
z.promise(z.string())

// 联合与交叉
z.union([z.string(), z.number()])
z.literal('hello')
z.enum(['a', 'b', 'c']) // 字面量联合类型
z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }))

// 懒加载处理递归类型
const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategorySchema).optional()
  })
)
```

## 深入理解：校验流程与错误处理

### parse vs safeParse

Zod 提供两种校验方法：

```typescript
// parse：校验失败抛出 ZodError
try {
  const user = UserSchema.parse(unknownData)
  console.log(user.name) // 类型安全的访问
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.errors)
    // error.errors 是一个数组，包含所有校验错误的详细信息
  }
}

// safeParse：不抛出异常，返回结果对象
const result = UserSchema.safeParse(unknownData)
if (result.success) {
  console.log(result.data.name) // result.data 是校验后的数据
} else {
  console.error(result.error.errors)
  // result.error 是 ZodError 实例
}
```

**推荐使用 `safeParse`**，它让你能以更函数式的方式处理错误，避免 try-catch 的嵌套。

### 错误信息的结构与格式化

ZodError 包含一个 `errors` 数组，每个错误对象的结构：

```typescript
interface ZodIssue {
  code: ZodIssueCode           // 错误类型代码
  message: string              // 错误消息
  path: (string | number)[]    // 错误字段的路径
  expected?: string            // 期望的类型/值
  received?: string            // 实际的类型/值
}

// 示例错误
const result = UserSchema.safeParse({
  id: "not a number",
  email: "invalid-email"
})
// result.error.errors:
// [
//   { code: 'invalid_type', path: ['id'], expected: 'number', received: 'string' },
//   { code: 'invalid_string', path: ['email'], validation: 'email' }
// ]
```

### 自定义错误消息

可以为每个校验规则自定义错误消息：

```typescript
const schema = z.object({
  password: z.string()
    .min(8, '密码至少需要 8 个字符')
    .max(100, '密码不能超过 100 个字符')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/[0-9]/, '密码必须包含至少一个数字')
    .regex(/[^A-Za-z0-9]/, '密码必须包含至少一个特殊字符'),

  age: z.number()
    .int('年龄必须是整数')
    .min(0, '年龄不能为负数')
    .max(150, '年龄不能超过 150')
})
```

## 高级特性

### Transform：校验后转换数据

Zod 的 `transform` 允许在校验成功后转换数据：

```typescript
const StringToDate = z.string().transform((str, ctx) => {
  const date = new Date(str)
  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date string'
    })
    return z.NEVER // 表示校验失败
  }
  return date
})

// 输入类型是 string，输出类型是 Date
const date = StringToDate.parse('2024-01-15') // Date 对象
```

实际应用示例——处理表单输入：

```typescript
const FormSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),

  tags: z.string()
    .transform(val => val.split(',').map(t => t.trim()).filter(Boolean)),

  birthDate: z.string().transform((val, ctx) => {
    const date = new Date(val)
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date'
      })
      return z.NEVER
    }
    return date
  }),

  // 计算 age
  age: z.undefined().transform((_, ctx) => {
    const birthDate = ctx.parent.birthDate
    if (birthDate instanceof Date) {
      const today = new Date()
      const age = Math.floor(
        (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
      return age
    }
    return undefined
  })
})

type FormData = z.infer<typeof FormSchema>
// {
//   email: string
//   tags: string[]
//   birthDate: Date
//   age: number | undefined
// }
```

### Refine：自定义校验逻辑

当内置校验规则不够用时，使用 `refine`：

```typescript
const SignupSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string()
}).refine(
  data => data.password === data.confirmPassword,
  {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'] // 错误指向 confirmPassword 字段
  }
)

// 多字段联合校验
const TransferSchema = z.object({
  fromAccount: z.string(),
  toAccount: z.string(),
  amount: z.number().positive()
}).refine(
  data => data.fromAccount !== data.toAccount,
  { message: '转出和转入账户不能相同' }
).refine(
  async data => {
    // 异步校验：检查账户余额
    const balance = await fetchBalance(data.fromAccount)
    return balance >= data.amount
  },
  { message: '账户余额不足' }
)

// 注意：异步校验需要使用 parseAsync 或 safeParseAsync
```

### Preprocess：预处理输入数据

在正式校验前对原始数据进行预处理：

```typescript
// 将字符串数字转换为真正的数字
const NumberFromString = z.preprocess(
  (val) => typeof val === 'string' ? Number(val) : val,
  z.number()
)

// 处理 API 响应中可能存在的多种日期格式
const FlexibleDate = z.preprocess(
  (val) => {
    if (val instanceof Date) return val
    if (typeof val === 'string' || typeof val === 'number') {
      return new Date(val)
    }
    return val
  },
  z.date()
)

// 表单数据的常见预处理
const FormDataSchema = z.object({
  // 空字符串转为 undefined
  nickname: z.preprocess(
    val => val === '' ? undefined : val,
    z.string().optional()
  ),

  // checkbox 的 "on" / undefined 转为 boolean
  subscribe: z.preprocess(
    val => val === 'on',
    z.boolean()
  ),

  // 数字输入处理
  count: z.preprocess(
    val => (val === '' || val === null) ? undefined : Number(val),
    z.number().int().positive().optional()
  )
})
```

## 实战模式

### 模式 1：API 响应校验

```typescript
import { z } from 'zod'

// 定义响应 schema
const ApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown() // 具体数据由调用者进一步校验
})

const UserListSchema = z.object({
  users: z.array(UserSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
})

// 封装类型安全的 fetch
async function fetchAndValidate<T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options)
  const raw = await response.json()

  const apiResult = ApiResponseSchema.parse(raw)

  if (apiResult.code !== 0) {
    throw new Error(`API Error: ${apiResult.message}`)
  }

  return schema.parse(apiResult.data)
}

// 使用
const userList = await fetchAndValidate('/api/users', UserListSchema)
// userList 类型自动推断为 { users: User[], total: number, page: number, pageSize: number }
```

### 模式 2：React Hook Form 集成

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const LoginFormSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少需要 8 个字符'),
  rememberMe: z.boolean().default(false)
})

type LoginForm = z.infer<typeof LoginFormSchema>

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit = handleSubmit((data) => {
    // data 已经是校验通过的类型安全数据
    console.log(data.email, data.password)
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <input type="checkbox" {...register('rememberMe')} />

      <button type="submit">登录</button>
    </form>
  )
}
```

### 模式 3：环境变量校验

```typescript
// env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 数据库配置
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.string().transform(Number).pipe(z.number().int().positive()).default('10'),

  // API 配置
  API_BASE_URL: z.string().url(),
  API_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().positive()).default('30000'),

  // 可选配置
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
})

// 启动时校验，失败则抛出详细错误
export const env = EnvSchema.parse(process.env)

// 使用时完全类型安全
console.log(env.DATABASE_URL)    // string
console.log(env.SENTRY_DSN)      // string | undefined
```

### 模式 4：品牌类型（Branded Types）

Zod 支持品牌类型，创建名义类型以避免混淆：

```typescript
import { z } from 'zod'

// 创建品牌类型
const UserId = z.string().uuid().brand<'UserId'>()
const OrderId = z.string().uuid().brand<'OrderId'>()

type UserId = z.infer<typeof UserId>     // string & { __brand: 'UserId' }
type OrderId = z.infer<typeof OrderId>   // string & { __brand: 'OrderId' }

// 这两个类型在 TypeScript 中不兼容，即使底层都是 string
function getUser(id: UserId) { /* ... */ }
function getOrder(id: OrderId) { /* ... */ }

const userId = UserId.parse('123e4567-e89b-12d3-a456-426614174000')
const orderId = OrderId.parse('123e4567-e89b-12d3-a456-426614174001')

getUser(userId)     // 是 正确
getOrder(orderId)   // 是 正确
getUser(orderId)    // 否 类型错误
```

## 性能优化与最佳实践

### 1. Schema 复用与缓存

Zod 的 schema 是可序列化的普通对象，应该复用而非重复创建：

```typescript
// 错误 每次调用都创建新 schema
function validateUser(data: unknown) {
  const schema = z.object({ /* ... */ })
  return schema.parse(data)
}

// 是 在模块级别创建，复用 schema
const UserSchema = z.object({ /* ... */ })

function validateUser(data: unknown) {
  return UserSchema.parse(data)
}
```

### 2. 使用 effect 减少校验开销

对于复杂的 transform 或 refine，可以使用 `effect` 明确声明副作用：

```typescript
const schema = z.object({
  data: z.string(),
  computed: z.string().transform(s => {
    // 昂贵的计算
    return heavyComputation(s)
  })
})

// 优化：使用 effect 明确声明
const optimizedSchema = z.object({
  data: z.string(),
  computed: z.string().transform(s => heavyComputation(s))
})
```

### 3. 批量校验时的异步处理

```typescript
// 批量校验 API 响应
async function validateBatch<T>(
  items: unknown[],
  schema: z.ZodType<T>
): Promise<{ valid: T[]; invalid: Array<{ index: number; error: z.ZodError }> }> {
  const results = await Promise.all(
    items.map((item, index) =>
      schema.safeParseAsync(item).then(result =>
        result.success
          ? { valid: result.data, index }
          : { invalid: { index, error: result.error }, index }
      )
    )
  )

  return {
    valid: results.filter(r => 'valid' in r).map(r => (r as any).valid),
    invalid: results.filter(r => 'invalid' in r).map(r => (r as any).invalid)
  }
}
```

## Zod 生态系统

Zod 与现代前端工具链有丰富的集成：

| 工具 | 集成包 | 用途 |
|------|--------|------|
| React Hook Form | `@hookform/resolvers` | 表单校验 |
| tRPC | 内置支持 | API 类型安全 |
| Next.js | `next-safe-action` | Server Actions 校验 |
| Express | `zod-express-middleware` | 请求校验中间件 |
| Fastify | `fastify-type-provider-zod` | 路由类型校验 |
| Prisma | `zod-prisma` | 从 schema 生成 Zod schema |
| OpenAPI | `zod-openapi` | 从 Zod schema 生成 OpenAPI 文档 |

## 总结

Zod 的核心价值在于：

1. **单一真相来源**：类型定义和校验规则合二为一，避免不一致
2. **类型安全**：自动推断 TypeScript 类型，无需重复定义
3. **组合式设计**：从小单元构建复杂类型，灵活可扩展
4. **优秀的开发体验**：详细的错误信息、良好的 IDE 支持

在现代 TypeScript 项目中，Zod 已经成为处理运行时数据校验的事实标准。无论是 API 响应、表单输入、配置文件还是环境变量，Zod 都能提供编译时和运行时的双重类型安全保障。

---

*本文由小虾子  撰写*
