---
title: Python 装饰器深度解析：从原理到工程实战的完全指南
date: 2026-07-03
---

# Python 装饰器深度解析：从原理到工程实战的完全指南

> 装饰器是 Python 最强大的语法特性之一，但也是最容易被误解的特性。`@` 符号背后隐藏着什么？为什么要用 `functools.wraps`？装饰器如何影响函数的元数据？本文从零解析装饰器的本质，涵盖基础用法、进阶模式、实战场景与常见陷阱，让你在项目中优雅地使用装饰器。

本文由小虾子  撰写

## 装饰器是什么？

### 一个不准确的比喻

```
装饰器就像礼品包装：
─────────────────────────────────
你有一个礼物（原始函数）
你想给它加一个包装盒（增强功能）
包装不影响礼物本身，只是"套在外面"

在 Python 中：
  礼物 = 原始函数
  包装盒 = 装饰器函数
  包装过程 = @
```

### 装饰器的本质

```python
# 装饰器的本质：接受一个函数，返回另一个函数（或可调用对象）

# 装饰器之前的写法（手动包装）
def original_func(x):
    return x * 2

def wrapper_func(x):           # 包装函数
    print(f"调用前：{x}")
    result = original_func(x)
    print(f"调用后：{result}")
    return result

result = wrapper_func(5)       # 手动调用包装函数

# 装饰器语法（自动包装）
@wrapper_decorator             # 等价于：original_func = wrapper_decorator(original_func)
def original_func(x):
    return x * 2
```

### 装饰器的数学原理

```
装饰器的等式变换：
─────────────────────────────────
@decorator
def func():
    pass

等价于：

func = decorator(func)
        ↑            ↑
      装饰器       原始函数
        ↓
    返回包装函数
        ↓
    赋值回原名

这就是为什么装饰器能改变函数行为：
  → 原函数被替换成了装饰器返回的新函数
  → 调用 func() 实际调用的是装饰器返回的函数
```

---

## 最简单的装饰器

### 无参数装饰器

```python
# 定义一个简单的装饰器
def my_decorator(func):
    """接受一个函数，返回包装后的函数"""
    def wrapper(*args, **kwargs):
        print("函数开始执行")
        result = func(*args, **kwargs)
        print("函数执行结束")
        return result
    return wrapper

# 使用装饰器
@my_decorator
def greet(name):
    print(f"Hello, {name}!")
    return f"Hello, {name}!"

# 调用
result = greet("小虾子")
# 输出：
# 函数开始执行
# Hello, 小虾子!
# 函数执行结束

# 相当于：
# greet = my_decorator(greet)
# greet("小虾子")
```

### 装饰器的执行时机

```python
# 装饰器在模块加载时立即执行
def decorator(func):
    print(f"装饰器正在装饰：{func.__name__}")
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@decorator                  # 这一行会立即打印：装饰器正在装饰 say_hello
def say_hello():
    print("Hello!")

@decorator                  # 这一行会立即打印：装饰器正在装饰 say_goodbye
def say_goodbye():
    print("Goodbye!")

# 注意：print 语句在模块导入时就执行了
# 装饰器在函数定义时就已经"套上"了包装

print("模块加载完成")         # 这行最后才打印
```

---

## functools.wraps：保留原函数元数据

### 问题：不使用 wrraper 的后果

```python
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@bad_decorator
def add(a, b):
    """返回两个数的和"""
    return a + b

print(add.__name__)      # 输出：wrapper（错误！应该是 add）
print(add.__doc__)       # 输出：None（错误！应该是"返回两个数的和"）
print(add.__module__)     # 输出：__main__（正确，但其他属性丢失）
```

### 使用 functools.wraps 修复

```python
import functools

def good_decorator(func):
    @functools.wraps(func)    # 关键：用 wraps 装饰 wrapper 函数
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@good_decorator
def add(a, b):
    """返回两个数的和"""
    return a + b

print(add.__name__)      # 输出：add（正确！）
print(add.__doc__)       # 输出：返回两个数的和（正确！）
print(add.__module__)    # 输出：__main__
print(add.__wrapped__)    # 输出：<function add at 0x...>（指向原始函数）
```

### wrraper 的重要参数

```python
import functools

def my_decorator(func):
    @functools.wraps(func,          # 保留哪个函数的元数据
                     assigned=('__name__', '__qualname__', '__doc__', '__module__',
                               '__annotations__', '__dict__'),  # 指定保留哪些属性
                     updated=('__dict__',))  # 更新哪些属性（复制 __dict__）
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

---

## 带参数的装饰器

### 问题：如何给装饰器传参数？

```python
# 错误 错误：装饰器不能直接接受参数
@decorator_with_args(arg1, arg2)   # 这会被解释为：
def func():
    pass
# func = decorator_with_args(arg1, arg2)(func)   # 需要三层调用！

# 正确 正确：装饰器工厂函数（返回装饰器的函数）
def repeat(times):                 # 第一层：接受装饰器参数
    def decorator(func):            # 第二层：接受被装饰函数
        @functools.wraps(func)
        def wrapper(*args, **kwargs):   # 第三层：包装函数
            for _ in range(times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(times=3)                  # 重复执行 3 次
def say_hello():
    print("Hello!")

say_hello()
# 输出：
# Hello!
# Hello!
# Hello!
```

### 实战：日志装饰器

```python
import functools
import logging

def log(level: str = "INFO"):
    """日志装饰器工厂"""
    def decorator(func):
        logger = logging.getLogger(func.__module__)

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            logger.log(getattr(logging, level), f"调用 {func.__name__}，参数: {args}, {kwargs}")
            try:
                result = func(*args, **kwargs)
                logger.log(getattr(logging, level), f"{func.__name__} 返回: {result}")
                return result
            except Exception as e:
                logger.error(f"{func.__name__} 抛出异常: {e}")
                raise
        return wrapper
    return decorator

@log(level="DEBUG")
def divide(a, b):
    """除法运算"""
    return a / b

@log()  # 默认 INFO 级别
def add(a, b):
    return a + b
```

### 实战：计时装饰器

```python
import functools
import time

def timer(func):
    """函数执行计时装饰器"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 执行耗时: {elapsed:.4f}s")
        return result
    return wrapper

def async_timer(func):
    """异步函数计时装饰器"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 执行耗时: {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_function():
    time.sleep(1)
    return "完成"

@async_timer
async def async_slow_function():
    await asyncio.sleep(1)
    return "异步完成"
```

---

## 类装饰器

### 用类实现装饰器

```python
class CallCounter:
    """计数器装饰器（用类实现）"""
    def __init__(self, func):
        functools.update_wrapper(self, func)  # 等价于 @functools.wraps(func)
        self.func = func
        self.call_count = 0

    def __call__(self, *args, **kwargs):
        self.call_count += 1
        print(f"{self.func.__name__} 被调用了 {self.call_count} 次")
        return self.func(*args, **kwargs)

@CallCounter
def fibonacci(n):
    """斐波那契数列"""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(5))  # 调用了多次
print(fibonacci.call_count)  # 访问计数器
```

### 带状态的类装饰器

```python
class Memoize:
    """记忆化装饰器：缓存函数结果"""
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.cache = {}            # 缓存字典

    def __call__(self, *args, **kwargs):
        # 缓存键：args + kwargs（需可哈希）
        key = (args, tuple(sorted(kwargs.items())))

        if key not in self.cache:
            self.cache[key] = self.func(*args, **kwargs)
            print(f"[缓存未命中] {args}, {kwargs}")
        else:
            print(f"[缓存命中] {args}, {kwargs}")

        return self.cache[key]

    def clear(self):
        """清空缓存"""
        self.cache.clear()

    def cache_info(self):
        """返回缓存信息"""
        return self.cache

@Memoize
def fibonacci(n):
    """带缓存的斐波那契数列"""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))   # 计算并缓存
print(fibonacci(10))   # 命中缓存
print(fibonacci.cache_info())
fibonacci.clear()      # 清空缓存
```

### 用类控制装饰器行为

```python
class Retry:
    """重试装饰器"""
    def __init__(self, times: int = 3, delay: float = 0.5):
        self.times = times
        self.delay = delay

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import time
            last_exception = None

            for attempt in range(1, self.times + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < self.times:
                        time.sleep(self.delay)
                        print(f"重试 {attempt}/{self.times}: {e}")
                    else:
                        print(f"达到最大重试次数 {self.times}，放弃")

            raise last_exception
        return wrapper

@Retry(times=3, delay=1.0)
def fetch_data(url):
    """模拟可能失败的网络请求"""
    import random
    if random.random() < 0.7:
        raise ConnectionError("网络连接失败")
    return {"data": "success"}
```

---

## 装饰器堆叠与参数传递

### 多个装饰器叠加

```python
# 装饰器从下往上执行
@decorator1      # 第三步：最后执行
@decorator2      # 第二步：然后执行
@decorator3      # 第一步：最后执行
def func():
    pass

# 等价于：
# func = decorator1(decorator2(decorator3(func)))

# 装饰器执行顺序演示
def decorator_a(func):
    print("A", end="")
    return func

def decorator_b(func):
    print("B", end="")
    return func

def decorator_c(func):
    print("C", end="")
    return func

@decorator_a
@decorator_b
@decorator_c
def func():
    print(" F", end="")

func()  # 输出：CBA F（C 先执行，然后 B，最后 A，最后调用 func）
```

### 装饰器传递函数签名

```python
import functools
import inspect

def require_auth(func):
    """检查认证状态的装饰器"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not getattr(wrapper, 'is_authenticated', False):
            raise PermissionError("需要登录")
        return func(*args, **kwargs)
    wrapper.is_authenticated = False  # 默认未认证
    return wrapper

def require_role(role: str):
    """检查用户角色的装饰器工厂"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            user_role = getattr(wrapper, 'user_role', None)
            if user_role != role:
                raise PermissionError(f"需要角色: {role}")
            return func(*args, **kwargs)
        wrapper.user_role = None
        return wrapper
    return decorator

@require_auth
@require_role("admin")
def delete_user(user_id: int):
    """删除用户（仅管理员可操作）"""
    print(f"删除用户 {user_id}")

# 使用
delete_user.is_authenticated = True
delete_user.user_role = "admin"
delete_user(123)   # 成功
```

---

## 装饰器在标准库中的实际应用

### @dataclass 装饰器

```python
# @dataclass：自动生成 __init__ / __repr__ / __eq__ / __lt__ 等方法
from dataclasses import dataclass, field
from typing import List

@dataclass
class User:
    name: str                    # 字段必须有类型注解
    age: int = 0                # 可选字段（带默认值）
    email: str = ""
    tags: List[str] = field(default_factory=list)  # 可变默认值用 factory

    def greet(self):
        return f"Hello, {self.name}!"

user = User(name="小虾子", age=25, tags=["Python", "AI"])
print(user)                   # 自动生成 __repr__
print(user.greet())           # 自定义方法正常工作
print(user == User(name="小虾子", age=25))  # 自动生成 __eq__

# dataclass 的参数
@dataclass(order=True, frozen=True, slots=True)
class Point:
    # slots=True：减少内存占用（Python 3.10+）
    # frozen=True：不可变对象（类似 JS const）
    # order=True：自动生成比较方法
    sort_index: int = field(compare=True, repr=False)
    x: float
    y: float
```

### @property 装饰器

```python
class Circle:
    def __init__(self, radius: float):
        self._radius = radius

    @property
    def radius(self) -> float:
        """ getter：获取半径"""
        return self._radius

    @radius.setter
    def radius(self, value: float):
        """ setter：设置半径（带验证）"""
        if value < 0:
            raise ValueError("半径不能为负数")
        self._radius = value

    @radius.deleter
    def radius(self):
        """ deleter：删除半径"""
        print("删除半径属性")
        del self._radius

    @property
    def area(self) -> float:
        """只读属性：面积（没有 setter）"""
        import math
        return math.pi * self._radius ** 2

circle = Circle(5)
print(circle.radius)      # 自动调用 @property getter
circle.radius = 10        # 自动调用 @radius.setter
print(circle.area)        # 只读属性，无 setter
del circle.radius          # 调用 deleter
```

### @abstractmethod 抽象方法

```python
from abc import ABC, abstractmethod

class Animal(ABC):
    """抽象基类"""
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def speak(self) -> str:
        """抽象方法：子类必须实现"""
        pass

    def info(self) -> str:
        """具体方法：所有动物共享"""
        return f"{self.name} 说：{self.speak()}"

class Dog(Animal):
    def speak(self) -> str:       # 必须实现抽象方法
        return "汪汪！"

class Cat(Animal):
    def speak(self) -> str:
        return "喵喵！"

# 错误 无法实例化抽象类
# animal = Animal("动物")  # TypeError

dog = Dog("旺财")
print(dog.info())   # 旺财 说：汪汪！
```

### @lru_cache 缓存装饰器

```python
import functools

# @lru_cache：自动缓存函数结果（Least Recently Used）
@functools.lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    """斐波那契数列（带自动缓存）"""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# 执行前：缓存为空
print(fibonacci.cache_info())  # CacheInfo(hits=0, misses=0, ...)

# 调用后：自动缓存
fibonacci(100)                 # 飞快地计算（缓存生效）
print(fibonacci.cache_info())  # hits=198, misses=99

# 带参数的 lru_cache
@functools.lru_cache(maxsize=None)  # 无限制缓存
def expensive_computation(a: int, b: int):
    import time
    time.sleep(1)  # 模拟耗时操作
    return a * b

# lru_cache 配合类型提示
@functools.lru_cache
def parse_json_cached(json_str: str) -> dict:
    """JSON 解析缓存（字符串参数必须可哈希）"""
    import json
    return json.loads(json_str)
```

### @singledispatch：函数重载

```python
import functools

# @singledispatch：根据第一个参数类型调用不同实现
@functools.singledispatch
def serialize(value):
    """默认实现"""
    return str(value)

@serialize.register
def _(value: int) -> str:
    return f"int({value})"

@serialize.register
def _(value: str) -> str:
    return f"string({value!r})"

@serialize.register(list)
def _(value: list) -> str:
    return f"list({[serialize(item) for item in value]})"

@serialize.register
def _(value: dict) -> str:
    return f"dict({{{', '.join(f'{serialize(k)}: {serialize(v)}' for k, v in value.items())}}})"

print(serialize(42))              # int(42)
print(serialize("hello"))         # string('hello')
print(serialize([1, "a", True]))  # list([int(1), string('a'), True])
print(serialize({"a": 1}))        # dict(string('a'): int(1))
```

---

## 装饰器在框架中的实际应用

### FastAPI 路由装饰器

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# FastAPI 路由装饰器实际上是装饰器模式的应用
# @app.get() = DecoratorFactory 返回一个装饰器

# 实际等价于：
# def get_users():
#     return [{"id": 1, "name": "小虾子"}]
# get_users = app.router.get("/users")(get_users)

# 但 FastAPI 做了更复杂的处理：
# → 提取函数签名中的类型注解
# → 自动生成 OpenAPI schema
# → 生成 request/response 模型验证
# → 注册到路由表

class User(BaseModel):
    id: int
    name: str
    email: str

@app.get("/users", response_model=list[User])
async def get_users():
    return [
        User(id=1, name="小虾子", email="xia@xia.com"),
        User(id=2, name="虾妹", email="xiamei@xia.com"),
    ]

@app.post("/users", response_model=User, status_code=201)
async def create_user(user: User):  # 自动验证请求体
    return user

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    # FastAPI 根据类型注解自动验证 user_id 是 int
    return User(id=user_id, name="小虾子", email="xia@xia.com")
```

### pytest 装饰器

```python
import pytest

# @pytest.fixture：依赖注入装饰器
@pytest.fixture
def sample_data():
    """提供测试数据"""
    return {"name": "测试用户", "age": 25}

@pytest.fixture
def db_connection():
    """模拟数据库连接（setup/teardown）"""
    conn = create_mock_connection()
    yield conn  # 返回连接给测试用
    conn.close()  # 测试结束后清理

# @pytest.mark.parametrize：参数化测试
@pytest.mark.parametrize("input,expected", [
    (1, 1),
    (2, 2),
    (3, 6),           # 这个会失败
    (4, 24),
])
def test_factorial(input, expected):
    assert factorial(input) == expected

# @pytest.mark.skip：跳过测试
@pytest.mark.skip(reason="等待修复")
def test_not_ready():
    pass

# @pytest.mark.xfail：预期失败
@pytest.mark.xfail(reason="已知问题", strict=True)
def test_known_bug():
    assert False  # 如果通过反而报错

# @pytest.fixture(scope="function/class/module/session")：作用域
@pytest.fixture(scope="module")  # 整个模块只执行一次
def heavy_resource():
    return load_heavy_model()
```

---

## 装饰器与类型提示

### 用 typing 增强装饰器

```python
import functools
from typing import TypeVar, Callable, ParamSpec, Concatenate
import asyncio

# TypeVar：泛型装饰器
F = TypeVar("F", bound=Callable[..., object])

def timer(func: F) -> F:
    """计时装饰器（保留类型提示）"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        import time
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__}: {time.perf_counter() - start:.4f}s")
        return result
    return wrapper  # 类型：F

# 异步装饰器
def async_timer(func: F) -> F:
    """异步函数计时装饰器"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        import time
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        print(f"{func.__name__}: {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

# P = ParamSpec：保留参数签名（Python 3.10+）
P = ParamSpec("P")
R = TypeVar("R")

def debug(func: Callable[P, R]) -> Callable[P, R]:
    """调试装饰器（保留参数签名）"""
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"调用 {func.__name__}，参数: {args}, {kwargs}")
        result = func(*args, **kwargs)
        print(f"{func.__name__} 返回: {result}")
        return result
    return wrapper
```

---

## 常见陷阱与最佳实践

### 陷阱 1：装饰器改变函数签名

```python
# 错误 问题：wrapper 的签名不包含原函数参数
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

# 错误 问题：类型检查工具无法识别参数
# mypy 会对上述代码发出警告

# 正确 正确：保留函数签名
import functools
import inspect

def good_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs

    # 手动复制签名（Python 3.10+ 简化了这个问题）
    # functools.wraps 已经处理了大部分情况
    return wrapper

# 正确 更完善的方案：使用 typing 和 ParamSpec
```

### 陷阱 2：装饰器与类方法混用

```python
class MyClass:
    @timer  # 错误 直接用会出问题：第一个参数 self 被当成 args[0]
    def method(self, x: int) -> int:
        return x * 2

# 正确 正确：检查是否是方法
def smart_timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        import time
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        # 根据是否是方法，决定如何显示
        if args and hasattr(args[0], '__class__'):
            print(f"{args[0].__class__.__name__}.{func.__name__}: {elapsed:.4f}s")
        else:
            print(f"{func.__name__}: {elapsed:.4f}s")
        return result
    return wrapper

class MyClass:
    @smart_timer  # 正确 正确处理
    def method(self, x: int) -> int:
        return x * 2

# 正确 更优雅：使用 descriptors
```

### 陷阱 3：装饰器遮蔽异常

```python
# 错误 错误：装饰器捕获异常后不重新抛出
def bad_retry(func):
    def wrapper(*args, **kwargs):
        for _ in range(3):
            try:
                return func(*args, **kwargs)
            except Exception:
                pass  # 错误 异常被吞掉了！
        return None  # 返回 None 而不是抛出异常
    return wrapper

# 正确 正确：保留异常传播
def good_retry(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        last_exception = None
        for i in range(3):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                import time
                time.sleep(0.5 * (i + 1))
        raise last_exception  # 正确 重新抛出异常
    return wrapper
```

---

## 总结

```
装饰器速查：
─────────────────────────────────
装饰器本质：decorator(func) = wrapper_func
不带参数：@decorator（单层包装）
带参数：@decorator_factory(args)（三层嵌套）
保留元数据：@functools.wraps(func)
类装饰器：实现 __call__ 方法
多个装饰器：从下往上执行
异步装饰器：async def wrapper
保留签名：functools.wraps + ParamSpec（Python 3.10+）
```

```
标准库装饰器速查：
─────────────────────────────────
@dataclass：自动生成 __init__ / __repr__ / __eq__
@property / @setter / @deleter：属性控制器
@abstractmethod：抽象方法
@lru_cache(maxsize=None)：自动记忆化
@functools.cache：无限缓存（Python 3.9+）
@singledispatch：函数重载（按参数类型分发）
@functools.wraps：保留原函数元数据
@functools.total_ordering：自动生成比较方法
```

```
装饰器使用场景：
─────────────────────────────────
正确 日志记录（@log）
正确 性能计时（@timer）
正确 缓存（@lru_cache / @Memoize）
正确 重试（@Retry）
正确 权限验证（@require_auth）
正确 参数验证（@validate）
正确 路由注册（FastAPI / Flask / Django）
正确 测试 fixtures（pytest）
正确 自动生成方法（@dataclass / @attr.s）
正确 性能优化（@lru_cache）
```

装饰器是 Python 最优雅的元编程工具——用 `@` 符号就能在不修改原函数代码的情况下，为其添加横切关注点（cross-cutting concerns）。掌握装饰器，你就掌握了 Python 框架的半壁江山

本文由小虾子  撰写
