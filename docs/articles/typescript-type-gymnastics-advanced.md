# TypeScript 类型体操进阶：从入门到实战

> 发布时间：2026-03-26

TypeScript 的类型系统是图灵完备的，这意味着可以用类型做"计算"。这种能力被戏称为"类型体操"。本文从基础到高级，系统讲解 TypeScript 类型体操的核心技巧，让你的类型定义更加精准、灵活。

## 为什么需要类型体操？

**场景 1：自动推导组件 Props 类型**

```typescript
// 定义组件配置
const buttonConfig = {
  variant: ['primary', 'secondary', 'danger'] as const,
  size: ['sm', 'md', 'lg'] as const,
}

// 自动推导出 Props 类型
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'danger'
  size: 'sm' | 'md' | 'lg'
}

// 而不是手动定义，配置变了还得同步改
```

**场景 2：API 响应类型自动推导**

```typescript
// 根据接口定义自动生成响应类型
interface ApiRoutes {
  '/user/info': { id: number; name: string }
  '/user/posts': { posts: { id: number; title: string }[] }
}

// 自动推导：fetchApi('/user/info') 返回 { id: number; name: string }
```

---

## 基础工具类型

TypeScript 内置了一批工具类型，是类型体操的基础：

### Partial / Required / Readonly

```typescript
interface User {
  id: number
  name: string
  age: number
}

// Partial：所有属性变可选
type PartialUser = Partial<User>
// { id?: number; name?: string; age?: number }

// Required：所有属性变必选
type RequiredUser = Required<{ id?: number }>
// { id: number }

// Readonly：所有属性变只读
type ReadonlyUser = Readonly<User>
// { readonly id: number; readonly name: string; readonly age: number }
```

### Pick / Omit

```typescript
// Pick：选取部分属性
type UserName = Pick<User, 'id' | 'name'>
// { id: number; name: string }

// Omit：排除部分属性
type UserWithoutAge = Omit<User, 'age'>
// { id: number; name: string }
```

### Record

```typescript
// Record：构造对象类型
type UserMap = Record<string, User>
// { [key: string]: User }

type Status = Record<'pending' | 'success' | 'error', string>
// { pending: string; success: string; error: string }
```

### ReturnType / Parameters

```typescript
function createUser(name: string, age: number) {
  return { id: Math.random(), name, age }
}

// ReturnType：获取函数返回值类型
type User = ReturnType<typeof createUser>
// { id: number; name: string; age: number }

// Parameters：获取函数参数类型（元组）
type CreateUserParams = Parameters<typeof createUser>
// [name: string, age: number]
```

---

## 核心技巧：条件类型

### 基础条件类型

```typescript
type IsString = T extends string ? true : false

type A = IsString<string> // true
type B = IsString<number> // false
```

### infer 关键字

`infer` 可以在条件类型中"推断"类型：

```typescript
// 提取数组元素类型
type UnwrapArray = T extends (infer U)[] ? U : T

type A = UnwrapArray<string[]> // string
type B = UnwrapArray<number[]> // number
type C = UnwrapArray<string>   // string（不是数组，原样返回）

// 提取 Promise 值类型
type UnwrapPromise = T extends Promise<infer U> ? U : T

type D = UnwrapPromise<Promise<string>> // string
type E = UnwrapPromise<string>          // string

// 提取函数返回值类型（自己实现 ReturnType）
type MyReturnType = T extends (...args: any[]) => infer R ? R : never

type F = MyReturnType<() => string> // string
```

### 分布式条件类型

当 `T` 是联合类型时，条件类型会"分布式"地处理每个成员：

```typescript
type ToArray = T extends any ? T[] : never

type A = ToArray<string | number>
// 分布式展开：
// string extends any ? string[] : never → string[]
// number extends any ? number[] : never → number[]
// 结果：string[] | number[]

// 对比：不使用分布式
type ToArray2 = [T] extends [any] ? T[] : never
type B = ToArray2<string | number>
// (string | number)[]
```

**实战：过滤联合类型**

```typescript
type Filter<T, U> = T extends U ? T : never

type A = Filter<'a' | 'b' | 1 | 2, string>
// 'a' | 'b'（只保留 string 类型的成员）

type Exclude<T, U> = T extends U ? never : T
type B = Exclude<'a' | 'b' | 1 | 2, string>
// 1 | 2（排除 string 类型的成员）
```

---

## 核心技巧：映射类型

映射类型可以"遍历"对象类型的属性：

```typescript
type MyPartial = {
  [K in keyof T]?: T[K]
}

// 加上修饰符
type MyReadonly = {
  readonly [K in keyof T]: T[K]
}

// 移除修饰符
type Mutable = {
  -readonly [K in keyof T]: T[K]
}

type Required = {
  [K in keyof T]-?: T[K]
}
```

### 重映射（Key Remapping）

TypeScript 4.1+ 支持用 `as` 重映射 key：

```typescript
// 将所有 key 加上前缀
type Prefix<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<K & string>}`]: T[K]
}

interface User {
  name: string
  age: number
}

type PrefixedUser = Prefix<User, 'user'>
// { userName: string; userAge: number }
```

### 过滤属性

```typescript
// 只保留函数类型的属性
type FunctionProperties = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}

interface Component {
  name: string
  render(): void
  handleClick(): void
}

type ComponentMethods = FunctionProperties<Component>
// { render: () => void; handleClick: () => void }
```

---

## 核心技巧：模板字面量类型

TypeScript 4.1+ 支持"字符串模板"类型：

```typescript
type EventName = `on${Capitalize<string>}`

type A = EventName // `on${string}` → on + 首字母大写的字符串
type B = 'onClick' extends EventName ? true : false // true

// 组合联合类型
type Colors = 'red' | 'blue' | 'green'
type Sizes = 'sm' | 'md' | 'lg'

type ButtonClass = `btn-${Colors}-${Sizes}`
// 'btn-red-sm' | 'btn-red-md' | 'btn-red-lg' | 'btn-blue-sm' | ...

// 内置字符串工具类型
type A = Uppercase<'hello'>   // 'HELLO'
type B = Lowercase<'HELLO'>   // 'hello'
type C = Capitalize<'hello'>  // 'Hello'
type D = Uncapitalize<'Hello'> // 'hello'
```

---

## 实战案例

### 案例 1：深度 Partial

```typescript
// 普通 Partial 只处理第一层，深度 Partial 递归处理
type DeepPartial = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

interface Config {
  server: {
    host: string
    port: number
    ssl: {
      enabled: boolean
      cert: string
    }
  }
}

type PartialConfig = DeepPartial<Config>
// server?: { host?: string; port?: number; ssl?: { enabled?: boolean; cert?: string } }
```

### 案例 2：深度 Required

```typescript
type DeepRequired = T extends object
  ? { [K in keyof T]-?: DeepRequired<T[K]> }
  : T
```

### 案例 3：深度 Readonly

```typescript
type DeepReadonly = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T
```

### 案例 4：对象路径类型

```typescript
// 获取对象的所有可能路径
type Path = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Path<T[K]>}`
          : K
        : never
    }[keyof T]
  : never

interface Config {
  server: {
    host: string
    port: number
  }
  db: {
    name: string
    connection: {
      host: string
      port: number
    }
  }
}

type ConfigPath = Path<Config>
// 'server' | 'server.host' | 'server.port' | 'db' | 'db.name' | 'db.connection' | 'db.connection.host' | 'db.connection.port'
```

### 案例 5：根据路径获取值类型

```typescript
type ValueAtPath<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? ValueAtPath<T[K], Rest>
    : never
  : P extends keyof T
  ? T[P]
  : never

type Host = ValueAtPath<Config, 'server.host'>   // string
type Port = ValueAtPath<Config, 'db.connection.port'> // number
```

### 案例 6：提取数组元素类型

```typescript
type ExtractArrayElement = T extends (infer U)[] ? U : T

type A = ExtractArrayElement<string[]>  // string
type B = ExtractArrayElement<number[][]> // number[]
```

### 案例 7：将 Union 转为 Tuple

```typescript
type UnionToTuple = (
  UnionToIntersection<UnionToFunction>
) extends () => infer R
  ? [...UnionToTuple<Exclude<T, R>>, R]
  : []

type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

type UnionToFunction<U> = U extends any ? () => U : never

type Tuple = UnionToTuple<'a' | 'b' | 'c'>
// ['a', 'b', 'c']
```

### 案例 8：将 Object 转为 Union

```typescript
type ObjectToUnion<T> = T[keyof T]

interface User {
  name: string
  age: number
}

type UserValue = ObjectToUnion<User>
// string | number
```

---

## 高级技巧：递归类型

TypeScript 的类型递归有深度限制（约 1000 层），但足以应付大多数场景。

### 递归展开数组

```typescript
type FlattenArray = T extends (infer U)[]
  ? U extends any[]
    ? FlattenArray<U>
    : U
  : T

type A = FlattenArray<string[][][]>
// string
```

### 递归合并对象

```typescript
type DeepMerge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? A[K] extends object
        ? B[K] extends object
          ? DeepMerge<A[K], B[K]>
          : B[K]
        : B[K]
      : A[K]
    : K extends keyof B
    ? B[K]
    : never
}

type Merged = DeepMerge<{ a: { x: 1 } }, { a: { y: 2 } }>
// { a: { x: 1; y: 2 } }
```

---

## 实用工具类型库

```typescript
// 非空
type NonNullable = T extends null | undefined ? never : T

// 函数类型
type AnyFunction = (...args: any[]) => any

// 提取构造函数参数
type ConstructorParameters = T extends abstract new (
  ...args: infer A
) => any
  ? A
  : never

// 提取实例类型
type InstanceType = T extends abstract new (...args: any) => infer R
  ? R
  : never

// 忽略类型
type Ignore<T, K extends keyof T> = Omit<T, K>

// 重命名属性
type Rename<T, K extends keyof T, N extends string> = Omit<T, K> & {
  [P in N]: T[K]
}

// 将可选属性变为必选 + undefined
type OptionalWithUndefined = {
  [K in keyof T]-?: T[K] | undefined
}

// 提取可选属性
type OptionalKeys = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

// 提取必选属性
type RequiredKeys = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

// 将对象转为 getter/setter
type Getters = {
  [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K]
} & {
  [K in keyof T as `set${Capitalize<K & string>}`]: (value: T[K]) => void
}

type UserGetters = Getters<{ name: string; age: number }>
// { getName: () => string; setName: (value: string) => void; getAge: () => number; setAge: (value: number) => void }
```

---

## 总结

| 技巧 | 用途 | 关键语法 |
|------|------|---------|
| 条件类型 | 类型分支判断 | `T extends U ? X : Y` |
| infer | 类型推断 | `T extends Promise<infer U> ? U : T` |
| 映射类型 | 遍历对象属性 | `{ [K in keyof T]: T[K] }` |
| 重映射 | 转换 key | `{ [K in keyof T as NewKey]: T[K] }` |
| 模板字面量 | 字符串模板类型 | `` `prefix-${T}` `` |
| 递归类型 | 深度处理 | 自引用类型 |
| 分布式条件 | 联合类型展开 | `T extends any ? ... : never` |

掌握这些技巧，你就能写出精准、优雅的类型定义，让 TypeScript 成为你的得力助手。

---

*本文由小虾子 🦐 撰写*
