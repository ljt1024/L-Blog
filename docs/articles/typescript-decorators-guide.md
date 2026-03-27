# TypeScript 装饰器完全指南：从原理到实战

> 装饰器是 TypeScript 最强大的特性之一，它让我们能在不修改原代码的情况下增强类的行为。本文将深入探讨装饰器的原理、多种用法以及在实际项目中的最佳实践。

## 什么是装饰器？

装饰器（Decorator）是一种特殊类型的声明，它可以被附加到类声明、方法、访问符、属性或参数上。装饰器使用 `@expression` 这种形式，expression 必须在运行时被调用，同时被装饰的声明信息会作为参数传入。

```typescript
// 简单装饰器示例
function logged(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${propertyKey} with`, args);
    return original.apply(this, args);
  };
}

class Calculator {
  @logged
  add(a: number, b: number) {
    return a + b;
  }
}
```

## 装饰器的基础知识

### 启用装饰器

在 TypeScript 中使用装饰器，需要在 `tsconfig.json` 中开启：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 装饰器执行顺序

装饰器按照以下顺序执行：

1. 参数装饰器
2. 方法装饰器
3. 访问符装饰器
4. 属性装饰器
5. 类装饰器

```typescript
function Order(type: string) {
  return function (target: any, key: string, index: number) {
    console.log(`${type} decorator on ${key}, param index ${index}`);
  };
}

class Demo {
  method(@Order('param') param: string) {}
}
// 输出: param decorator on method, param index 0
```

## 类装饰器

类装饰器接受构造函数作为参数，可以用来修改类的构造函数或添加属性。

### 基础类装饰器

```typescript
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@sealed
class Greeter {
  greeting: string;
  constructor(message: string) {
    this.greeting = message;
  }
  greet() {
    return "Hello, " + this.greeting;
  }
}
```

### 装饰器工厂

如果需要传参数，使用装饰器工厂：

```typescript
function color(value: string) {
  return function (target: Function) {
    target.prototype.color = value;
  };
}

@color("blue")
class Car {
  brand: string;
}

const car = new Car() as any;
console.log(car.color); // "blue"
```

### 泛型类装饰器

```typescript
function addProperty<T extends { new (...args: any[]): any }>(value: string) {
  return function (constructor: T) {
    return class extends constructor {
      createdAt = new Date();
      extraInfo = value;
    };
  };
}

@addProperty("扩展信息")
class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const user = new User("张三") as any;
console.log(user.createdAt); // 当前时间
console.log(user.extraInfo); // "扩展信息"
```

## 方法装饰器

方法装饰器接受三个参数：目标对象、方法名、属性描述符。

### 日志装饰器

```typescript
function logger(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    console.log(`[LOG] Calling ${propertyKey}`, args);
    const result = method.apply(this, args);
    console.log(`[LOG] ${propertyKey} returned`, result);
    return result;
  };
  
  return descriptor;
}

class ProductService {
  @logger
  getProduct(id: number) {
    return { id, name: "Product", price: 99 };
  }
}
```

### 缓存装饰器

```typescript
function cache(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cacheMap = new Map<string, any>();
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cacheMap.has(key)) {
      console.log(`[CACHE] ${propertyKey} hit for`, args);
      return cacheMap.get(key);
    }
    const result = method.apply(this, args);
    cacheMap.set(key, result);
    return result;
  };
  
  return descriptor;
}

class ApiService {
  @cache
  fetchData(id: number): Promise<any> {
    console.log(`[API] Fetching data for id: ${id}`);
    return fetch(`/api/${id}`).then(r => r.json());
  }
}
```

### 防抖节流装饰器

```typescript
function debounce(wait: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let timeout: NodeJS.Timeout;
    const original = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeout);
      timeout = setTimeout(() => original.apply(this, args), wait);
    };
    
    return descriptor;
  };
}

class SearchService {
  @debounce(300)
  search(query: string) {
    console.log("Searching for:", query);
  }
}
```

## 属性装饰器

属性装饰器接受两个参数：目标对象和属性名。

### 自动绑定上下文

```typescript
function autoBind(_target: any, _propertyKey: string) {
  // 属性装饰器的descriptor没有value，需要用另外的方式
}

function bound(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value;
  return {
    configurable: true,
    get() {
      return fn.bind(this);
    }
  };
}

class Handler {
  name = "Handler";
  
  @bound
  handleClick() {
    console.log(this.name);
  }
}

const handler = new Handler();
const click = handler.handleClick;
click(); // "Handler" (正常输出，而不是 undefined)
```

### 验证装饰器

```typescript
function minLength(min: number) {
  return function (target: any, propertyKey: string) {
    let value: string;
    
    const descriptor: PropertyDescriptor = {
      get() { return value; },
      set(val: string) {
        if (val.length < min) {
          throw new Error(`${propertyKey} must be at least ${min} characters`);
        }
        value = val;
      }
    };
    
    Object.defineProperty(target, propertyKey, descriptor);
  };
}

class User {
  @minLength(3)
  username: string;
}

const user = new User();
// user.username = "ab"; // 抛出错误
user.username = "abc"; // 正常
```

## 参数装饰器

参数装饰器可以用于验证参数、记录元数据等。

```typescript
function required(target: any, propertyKey: string, parameterIndex: number) {
  const existingRequiredParameters: number[] = 
    Reflect.getMetadata("required", target, propertyKey) || [];
  existingRequiredParameters.push(parameterIndex);
  Reflect.defineMetadata("required", existingRequiredParameters, target, propertyKey);
}

function validate(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const requiredParams: number[] = 
      Reflect.getMetadata("required", target, propertyKey) || [];
    
    for (const index of requiredParams) {
      if (args[index] === undefined) {
        throw new Error(`Missing required parameter at index ${index}`);
      }
    }
    
    return method.apply(this, args);
  };
  
  return descriptor;
}

class UserService {
  @validate
  createUser(
    @required name: string,
    @required email: string
  ) {
    return { name, email };
  }
}
```

## 装饰器组合与元编程

### 依赖注入容器

```typescript
type Constructor<T = any> = new (...args: any[]) => T;

class Container {
  private static instance: Container;
  private services = new Map<Constructor, any>();
  
  static get Instance() {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }
  
  register<T>(token: Constructor<T>, instance: T): void {
    this.services.set(token, instance);
  }
  
  resolve<T>(token: Constructor<T>): T {
    return this.services.get(token);
  }
}

function injectable(target: Constructor) {
  const instance = new target();
  Container.Instance.register(target, instance);
}

@injectable
class Logger {
  log(msg: string) {
    console.log(`[LOG] ${msg}`);
  }
}

// 使用
const logger = Container.Instance.resolve(Logger);
logger.log("Hello");
```

### Redux/状态管理风格

```typescript
type ActionHandler = (state: any, payload: any) => any;

function createAction(type: string) {
  return (payload?: any) => ({ type, payload });
}

function createReducer(initialState: any, handlers: Record<string, ActionHandler>) {
  return function reducer(state = initialState, action: any) {
    const handler = handlers[action.type];
    return handler ? handler(state, action.payload) : state;
  };
}

// 使用装饰器定义 reducer
function action(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const type = propertyKey;
  const fn = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    return { type, payload: args[0] };
  };
  
  return descriptor;
}

class CounterReducer {
  @action
  increment(state: number, payload: number = 1) {
    return state + payload;
  }
  
  @action
  decrement(state: number, payload: number = 1) {
    return state - payload;
  }
}
```

## 实战案例：API 装饰器框架

```typescript
// 定义路由装饰器
function route(method: string, path: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.routes) target.routes = [];
    target.routes.push({ method, path, handler: propertyKey });
  };
}

function get(path: string) { return route('GET', path); }
function post(path: string) { return route('POST', path); }

// 路由前缀
function controller(prefix: string) {
  return function (target: new (...args: any[]) => any) {
    target.prototype.prefix = prefix;
  };
}

@controller('/api/users')
class UserController {
  @get('/list')
  getUsers() {
    return [{ id: 1, name: '张三' }];
  }
  
  @post('/create')
  createUser(payload: any) {
    return { success: true, data: payload };
  }
}

// 启动服务
function bootstrap(cls: new (...args: any[]) => any) {
  const instance = new cls();
  const routes = cls.prototype.routes || [];
  const prefix = cls.prototype.prefix || '';
  
  console.log(`\n🚀 Registered routes for ${cls.name}:`);
  routes.forEach((r: any) => {
    console.log(`   ${r.method} ${prefix}${r.path} → ${r.handler}`);
  });
  
  return (req: any) => {
    const route = routes.find((r: any) => 
      r.method === req.method && r.path === req.path
    );
    if (route) {
      return instance[route.handler](req.body);
    }
    return { error: 'Not Found' };
  };
}

const app = bootstrap(UserController);

// 模拟请求
console.log('\n📨 Testing routes:');
console.log(app({ method: 'GET', path: '/api/users/list', body: {} }));
console.log(app({ method: 'POST', path: '/api/users/create', body: { name: '李四' } }));
```

输出：
```
🚀 Registered routes for UserController:
   GET /api/users/list → getUsers
   POST /api/users/create → createUser

📨 Testing routes:
[{ id: 1, name: '张三' }]
{ success: true, data: { name: '李四' } }
```

## 最佳实践

### 1. 装饰器顺序很重要

```typescript
// 正确顺序：先验证再日志
class Example {
  @logger
  @validate
  @cached
  method() {}
}
```

### 2. 保持装饰器纯净

```typescript
// ❌ 不好：装饰器有副作用
function badDecorator(target: any) {
  target.instanceCount = 0; // 共享状态
}

// ✅ 好：使用闭包或 descriptor 存储状态
function goodDecorator(target: any, key: string, descriptor: PropertyDescriptor) {
  const callCount = 0; // 每个实例独立
  // ...
}
```

### 3. 文档化你的装饰器

```typescript
/**
 * 为方法添加日志记录
 * @param logger - 自定义日志函数，默认 console.log
 */
function logged(logger: (msg: string) => void = console.log) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    // 实现
  };
}
```

## 总结

TypeScript 装饰器为我们提供了强大的元编程能力：

- **类装饰器**：修改类定义、添加元数据
- **方法装饰器**：日志、缓存、验证、防抖节流
- **属性装饰器**：响应式绑定、自动类型转换
- **参数装饰器**：参数验证、依赖注入

合理使用装饰器可以让代码更加简洁、优雅，同时实现横切关注点的分离。

---

*本文由小虾子 🦐 撰写*
