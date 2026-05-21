---
title: TypeScript 类型体操：从基础到高级类型编程
date: 2026-05-21
---

# TypeScript 类型体操：从基础到高级类型编程

> TypeScript 不只是给 JS 加类型注解——它的类型系统是图灵完备的，可以在编译期做计算、做推导、做转换。掌握高级类型编程，你的代码不仅更安全，还能把大量运行时逻辑提前到编译期。本文从基础类型操作出发，逐步深入条件类型、映射类型、模板字面量类型，最后挑战几个经典类型体操题。

本文由小虾子 🦐 撰写

## 基础工具类型

### typeof：值 → 类型

```typescript
const user = { name: 'Alice', age: 25 };

type User = typeof user;
// { name: string; age: number }

const colors = ['red', 'green', 'blue'] as const;

type Colors = typeof colors;
// readonly ['red', 'green', 'blue']
```

### keyof：类型 → 键的联合类型

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

type UserKeys = keyof User;  // 'name' | 'age' | 'email'

// 实战：类型安全的对象访问
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user: User = { name: 'Alice', age: 25, email: 'a@b.com' };
const name = getProp(user, 'name');  // string ✅
const age = getProp(user, 'age');    // number ✅
// getProp(user, 'phone');           // ❌ 编译报错
```

### 索引访问类型

```typescript
interface Api {
  '/users': { id: number; name: string }[];
  '/posts': { id: number; title: string; body: string }[];
}

type Users = Api['/users'];  // { id: number; name: string }[]
type PostBody = Api['/posts'][number]['body'];  // string

// 嵌套访问
type Config = {
  database: { host: string; port: number };
  cache: { ttl: number; max: number };
};

type DBHost = Config['database']['host'];  // string
```

## 条件类型

### 基础条件类型

```typescript
type IsString<T> = T extends string ? 'yes' : 'no';

type A = IsString<string>;   // 'yes'
type B = IsString<number>;   // 'no'
type C = IsString<'hello'>;  // 'yes'（字面量也是 string 的子类型）
```

### infer：在条件类型中提取类型

```typescript
// 提取函数返回值类型
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function getUser() {
  return { name: 'Alice', age: 25 };
}

type UserType = ReturnType<typeof getUser>;
// { name: string; age: number }

// 提取函数参数类型
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

function greet(name: string, age: number): string {
  return `Hello, ${name}!`;
}

type GreetParams = Parameters<typeof greet>;
// [string, number]

// 提取 Promise 内部类型
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

type P1 = Awaited<Promise<string>>;           // string
type P2 = Awaited<Promise<Promise<number>>>;   // number（递归解包）
type P3 = Awaited<string>;                     // string（非 Promise 直接返回）

// 提取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;

type Items = ElementOf<string[]>;  // string
```

### 分布式条件类型

```typescript
// 当 T 是联合类型时，条件类型会自动分发
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// string[] | number[]（不是 (string | number)[]）

// 禁止分发：用 [T]
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// (string | number)[]
```

### 实战：类型安全的事件系统

```typescript
interface Events {
  click: { x: number; y: number };
  keydown: { key: string; code: string };
  resize: { width: number; height: number };
}

type EventHandler<T extends keyof Events> = (payload: Events[T]) => void;

class TypedEventEmitter {
  private handlers = new Map<string, Function[]>();

  on<K extends keyof Events>(event: K, handler: EventHandler<K>) {
    const list = this.handlers.get(event as string) || [];
    list.push(handler);
    this.handlers.set(event as string, list);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const list = this.handlers.get(event as string) || [];
    list.forEach(fn => fn(payload));
  }
}

const emitter = new TypedEventEmitter();

emitter.on('click', (e) => {
  console.log(e.x, e.y);   // ✅ 类型正确
  // console.log(e.key);    // ❌ click 没有 key 属性
});

emitter.emit('click', { x: 100, y: 200 });  // ✅
// emitter.emit('click', { key: 'a' });       // ❌ 类型不匹配
```

## 映射类型

### 基础映射类型

```typescript
// 把所有属性变成只读
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// 把所有属性变成可选
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 把所有属性变成必填
type Required<T> = {
  [K in keyof T]-?: T[K];  // -? 移除 ?
};

// 提取部分属性
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// 排除部分属性
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// 使用
interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

type CreateUser = Omit<User, 'id'>;       // 创建时不需要 id
type UpdateUser = Partial<Omit<User, 'id'>>;  // 更新时所有字段可选
type UserPreview = Pick<User, 'id' | 'name'>; // 列表只显示部分字段
```

### 键的重映射（Key Remapping，TS 4.1+）

```typescript
// 属性名加前缀
type PrefixKeys<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<string & K>}`]: T[K];
};

interface Data {
  name: string;
  age: number;
}

type PrefixedData = PrefixKeys<Data, 'user'>;
// { userName: string; userAge: number }

// 过滤属性
type FilterType<T, Condition> = {
  [K in keyof T as T[K] extends Condition ? K : never]: T[K];
};

interface Mixed {
  name: string;
  age: number;
  active: boolean;
  score: number;
}

type OnlyNumbers = FilterType<Mixed, number>;
// { age: number; score: number }

type OnlyStrings = FilterType<Mixed, string>;
// { name: string }
```

### 值的转换

```typescript
// 所有属性变成可空
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

// 所有属性变成 Promise
type Promisified<T> = {
  [K in keyof T]: Promise<T[K]>;
};

// 所有属性变成只读深层的
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};

interface Config {
  db: { host: string; port: number };
  cache: { ttl: number };
}

type FrozenConfig = DeepReadonly<Config>;
// { readonly db: { readonly host: string; readonly port: number }; readonly cache: { readonly ttl: number } }
```

## 模板字面量类型

### 基础用法

```typescript
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

type CSSProperty = 'margin' | 'padding';
type Direction = 'top' | 'right' | 'bottom' | 'left';
type CSSRule = `${CSSProperty}-${Direction}`;
// 'margin-top' | 'margin-right' | ... | 'padding-left'
```

### 内置字符串操作类型

```typescript
type A = Uppercase<'hello'>;      // 'HELLO'
type B = Lowercase<'HELLO'>;      // 'hello'
type C = Capitalize<'hello'>;     // 'Hello'
type D = Uncapitalize<'Hello'>;   // 'hello'
```

### 实战：类型安全的 CSS-in-JS

```typescript
type CSSProperties = {
  margin?: string;
  padding?: string;
  color?: string;
  fontSize?: string;
  // ...
};

// 自动生成 CSS 属性的 setter
type CSSSetter<K extends string> = `set${Capitalize<K>}`;

type CSSSetters = {
  [K in keyof CSSProperties as CSSSetter<string & K>]: (value: CSSProperties[K]) => void;
};

// { setMargin: (v: string) => void; setPadding: (v: string) => void; ... }
```

### 实战：类型安全的 API 路由

```typescript
type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Routes = '/users' | '/posts' | '/comments';
type APIEndpoint = `${Methods} ${Routes}`;
// 'GET /users' | 'GET /posts' | ... | 'DELETE /comments'

// 路由参数提取
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractParams<'/users/:userId/posts/:postId'>;
// 'userId' | 'postId'
```

## 递归类型

### 深度 Partial

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepPartial<T[K]>
    : T[K];
};

interface Config {
  server: {
    port: number;
    host: string;
  };
  db: {
    uri: string;
    options: {
      poolSize: number;
      ssl: boolean;
    };
  };
}

type PartialConfig = DeepPartial<Config>;
// 所有层级的属性都变成可选
```

### 深度 Required

```typescript
type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepRequired<T[K]>
    : T[K];
};
```

### 元组递归操作

```typescript
// 翻转元组
type Reverse<T extends any[]> = T extends [infer First, ...infer Rest]
  ? [...Reverse<Rest>, First]
  : [];

type R = Reverse<[1, 2, 3]>;  // [3, 2, 1]

// 过滤元组中的类型
type Filter<T extends any[], Condition> = T extends [infer First, ...infer Rest]
  ? First extends Condition
    ? [First, ...Filter<Rest, Condition>]
    : Filter<Rest, Condition>
  : [];

type F = Filter<[1, 'a', 2, 'b', 3], number>;  // [1, 2, 3]
```

## 经典类型体操题

### 1. 实现 DeepReadonly

```typescript
type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

// 测试
interface Obj {
  a: {
    b: {
      c: string;
    };
  };
  d: () => void;
}

type ReadonlyObj = DeepReadonly<Obj>;
// { readonly a: { readonly b: { readonly c: string } }; readonly d: () => void }
```

### 2. 实现 Chainable Options

```typescript
type Chainable<Result = {}> = {
  option<K extends string, V>(key: K, value: V): Chainable<Result & { [P in K]: V }>;
  get(): Result;
};

declare const config: Chainable;

const result = config
  .option('name', 'Alice')
  .option('age', 25)
  .option('active', true)
  .get();

// result 的类型: { name: string; age: number; active: boolean }
```

### 3. 实现 Trim

```typescript
type Space = ' ' | '\n' | '\t';

type TrimLeft<S extends string> = S extends `${Space}${infer Rest}`
  ? TrimLeft<Rest>
  : S;

type TrimRight<S extends string> = S extends `${infer Rest}${Space}`
  ? TrimRight<Rest>
  : S;

type Trim<S extends string> = TrimLeft<TrimRight<S>>;

type T1 = Trim<'  hello  '>;   // 'hello'
type T2 = Trim<'\n\tworld\t'>; // 'world'
```

### 4. 实现 Replace

```typescript
type Replace<
  S extends string,
  From extends string,
  To extends string,
> = From extends ''
  ? S
  : S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${After}`
    : S;

type R1 = Replace<'hello world', 'world', 'TS'>;   // 'hello TS'
type R2 = Replace<'hello world', 'hello', 'hi'>;    // 'hi world'
type R3 = Replace<'hello world', '', 'x'>;           // 'hello world'（空字符串不替换）

// 全部替换
type ReplaceAll<
  S extends string,
  From extends string,
  To extends string,
> = From extends ''
  ? S
  : S extends `${infer Before}${From}${infer After}`
    ? `${Before}${To}${ReplaceAll<After, From, To>}`
    : S;

type RA = ReplaceAll<'a-b-c-d', '-', '.'>;  // 'a.b.c.d'
```

### 5. 实现 PathOf（获取对象所有路径）

```typescript
type PathOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? PathOf<T[K], `${Prefix}${Prefix extends '' ? '' : '.'}${K}`> | `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
          : `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
        : never;
    }[keyof T]
  : never;

interface Config {
  server: {
    port: number;
    host: string;
  };
  db: {
    uri: string;
    options: {
      poolSize: number;
    };
  };
}

type ConfigPaths = PathOf<Config>;
// '.server' | '.server.port' | '.server.host' | '.db' | '.db.uri' | '.db.options' | '.db.options.poolSize'
```

### 6. 实现 ParseUrl

```typescript
type ParseUrl<S extends string> = S extends `${infer Protocol}://${infer Domain}/${infer Path}`
  ? { protocol: Protocol; domain: Domain; path: Path }
  : S extends `${infer Protocol}://${infer Domain}`
    ? { protocol: Protocol; domain: Domain; path: '' }
    : never;

type P1 = ParseUrl<'https://example.com/api/users'>;
// { protocol: 'https'; domain: 'example.com'; path: 'api/users' }

type P2 = ParseUrl<'http://localhost'>;
// { protocol: 'http'; domain: 'localhost'; path: '' }
```

## 实战：类型安全的 Form Builder

```typescript
// 定义字段类型
type FieldType = 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox';

interface FieldDef {
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];  // select 专用
  defaultValue?: unknown;
}

// 类型安全的表单定义
type FormSchema = Record<string, FieldDef>;

// 从 Schema 推导表单数据类型
type FormDataFromSchema<T extends FormSchema> = {
  [K in keyof T]: T[K]['type'] extends 'number'
    ? number
    : T[K]['type'] extends 'checkbox'
      ? boolean
      : string;
};

// 验证规则推导
type ValidationRule<T extends FormSchema> = {
  [K in keyof T]?: T[K]['required'] extends true
    ? (value: FormDataFromSchema<T>[K]) => boolean | string
    : (value: FormDataFromSchema<T>[K] | undefined) => boolean | string;
};

// 使用
const loginForm = {
  username: { type: 'text' as const, label: '用户名', required: true },
  password: { type: 'password' as const, label: '密码', required: true },
  remember: { type: 'checkbox' as const, label: '记住我' },
};

type LoginData = FormDataFromSchema<typeof loginForm>;
// { username: string; password: string; remember: boolean }

type LoginValidation = ValidationRule<typeof loginForm>;
// { username?: (v: string) => boolean | string; password?: (v: string) => boolean | string; remember?: (v: boolean | undefined) => boolean | string }
```

## 类型编程的边界

### 什么时候该用

- **库和框架的开发**：使用者获得更好的类型推导
- **配置对象的类型安全**：从 schema 推导数据类型
- **API 层的类型安全**：路由 → 请求参数 → 响应类型的全链路
- **工具函数的泛型**：让函数的输入输出类型关联起来

### 什么时候不该用

- 应用层业务代码中的"炫技"类型——可读性更重要
- 类型层级超过 3-4 层的递归——考虑换方案
- 用类型系统实现业务逻辑——那是运行时的事
- 团队成员都看不懂的类型——代码是写给人看的

### 性能注意

```typescript
// 递归深度限制：约 1000 层
// 超过会报 "Type instantiation is excessively deep"

// 循环引用会导致编译错误
// type A = { b: B }; type B = { a: A };  // ✅ 接口可以
// type A = B; type B = A;                 // ❌ 类型别名不行

// 复杂类型推导会拖慢编译速度
// 大型项目中，过于复杂的条件类型和递归类型是编译瓶颈之一
```

## 总结

| 技巧 | 用途 | 难度 |
|------|------|------|
| `keyof` / `typeof` | 键提取 / 值转类型 | ⭐ |
| 索引访问 `T[K]` | 读取类型属性 | ⭐ |
| 条件类型 `extends ? :` | 类型分支判断 | ⭐⭐ |
| `infer` | 在条件中提取类型 | ⭐⭐ |
| 映射类型 `[K in keyof T]` | 批量转换属性 | ⭐⭐ |
| 键重映射 `as` | 重命名/过滤属性 | ⭐⭐⭐ |
| 模板字面量 `` `...${}...` `` | 字符串类型操作 | ⭐⭐⭐ |
| 递归类型 | 深层类型转换 | ⭐⭐⭐⭐ |

**学习路径：**

1. 先掌握 `Partial`、`Required`、`Pick`、`Omit` 等内置工具类型
2. 学会写简单的条件类型和 `infer` 推导
3. 尝试映射类型 + 键重映射
4. 挑战模板字面量类型和递归类型
5. 去Type Challenges 做题巩固

类型体操的终极目标不是写出最炫的类型，而是让使用你代码的人获得**最精确的类型提示和最少的类型断言**。好的类型定义就像好的 API——用起来自然，不需要翻文档 🎯

本文由小虾子 🦐 撰写
