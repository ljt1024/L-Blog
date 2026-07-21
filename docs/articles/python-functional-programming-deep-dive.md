---
title: Python 函数式编程完全指南：从 map/reduce 到函数组合的优雅之道
date: 2026-07-13
---

# Python 函数式编程完全指南：从 map/reduce 到函数组合的优雅之道

> Python 不是 Haskell，但 Python 的函数式特性远比你想的丰富。当你在列表推导式和 for 循环之间选择时，你其实已经在函数式和命令式之间做权衡了。本文从一等函数、高阶函数出发，系统覆盖 `map`/`filter`/`reduce`、`functools` 完整工具集、偏函数与函数组合、闭包的工程应用，以及如何在 Python 中写出既 Pythonic 又函数式的优雅代码。

本文由小虾子  撰写

## 函数式编程的核心思想

### 什么是函数式编程？

```python
# 函数式编程的三大支柱：
# 1. 一等函数：函数是值，可以赋值、传递、返回
# 2. 纯函数：无副作用，给定输入总返回相同输出
# 3. 不可变性：避免修改共享状态

# 对比：命令式 vs 函数式
data = [1, 2, 3, 4, 5]

# 命令式：怎么做（how）
result = []
for x in data:
    if x % 2 == 0:
        result.append(x * x)
print(result)  # [4, 16]

# 函数式：做什么（what）
result = list(map(lambda x: x * x, filter(lambda x: x % 2 == 0, data)))
print(result)  # [4, 16]

# 更 Pythonic 的写法（列表推导式也是函数式思想的体现）
result = [x * x for x in data if x % 2 == 0]
print(result)  # [4, 16]
```

### 一等函数：函数是值

```python
# 函数是对象，可以像任何其他值一样使用
def greet(name: str) -> str:
    return f"Hello, {name}"

# 1. 赋值给变量
say_hello = greet
print(say_hello("小虾子"))  # Hello, 小虾子
print(type(say_hello))     # <class 'function'>

# 2. 作为参数传递
def apply_twice(func: callable, value: str) -> str:
    return func(func(value))

print(apply_twice(greet, "world"))  # 两次 greet 调用

# 3. 作为返回值
def create_greeter(prefix: str):
    def greeter(name: str) -> str:
        return f"{prefix}, {name}!"
    return greeter

say_hi = create_greeter("Hi")
say_greetings = create_greeter("Greetings")

print(say_hi("小虾子"))      # Hi, 小虾子!
print(say_greetings("小明"))  # Greetings, 小明!

# 4. 存入容器
functions = [greet, say_hi, say_greetings]
for fn in functions:
    print(fn("world"))  # 调用所有函数
```

### 纯函数与副作用

```python
# 纯函数：无副作用，结果只取决于输入
def pure_add(a: int, b: int) -> int:
    return a + b  # 无论何时调用，a + b 总是相同

# 非纯函数（有副作用）
counter = 0
def impure_increment():
    global counter
    counter += 1
    return counter

# 副作用的类型：
# 1. 修改全局状态
# 2. 修改传入参数
# 3. I/O 操作（打印、读写文件、网络请求）
# 4. 抛出异常

# 为什么纯函数更好？
# 正确 可测试（不需要 mock）
# 正确 可缓存（同样的输入 → 同样的输出）
# 正确 可并行（无共享状态冲突）
# 正确 可组合（输出可以直接作为下一个函数的输入）

# Python 函数式编程的目标不是"不用 for 循环"
# 而是减少副作用、提高函数的组合性
```

---

## map / filter / reduce：三剑客

### map：逐元素转换

```python
# map(function, iterable) → 生成器，逐元素应用函数

# 求平方
nums = [1, 2, 3, 4, 5]
squares = map(lambda x: x ** 2, nums)
print(list(squares))  # [1, 4, 9, 16, 25]

# 字符串处理
names = ["alice", "BOB", "Charlie"]
normalized = map(str.lower, names)
print(list(normalized))  # ['alice', 'bob', 'charlie']

# 多参数
a = [1, 2, 3]
b = [4, 5, 6]
products = map(lambda x, y: x * y, a, b)
print(list(products))  # [4, 10, 18]

# map 返回迭代器（惰性），不占用额外内存
squares_gen = map(lambda x: x ** 2, range(10**6))  # 不计算，直到遍历
print(next(squares_gen))  # 0
print(next(squares_gen))  # 1

# 注意：map 对象只能消费一次
m = map(str, [1, 2, 3])
print(list(m))  # ['1', '2', '3']
print(list(m))  # [] ← 第二次消费为空！
```

### filter：条件筛选

```python
# filter(function, iterable) → 生成器，保留使函数返回 True 的元素

nums = range(-5, 6)
positive = filter(lambda x: x > 0, nums)
print(list(positive))  # [1, 2, 3, 4, 5]

# 过滤 None 值
data = [1, None, 3, None, 5]
clean = filter(None, data)  # None 作为函数时，只保留 truthy 值
print(list(clean))  # [1, 3, 5]

# 过滤对象
class User:
    def __init__(self, name: str, active: bool):
        self.name = name
        self.active = active

users = [User("Alice", True), User("Bob", False), User("Carol", True)]
active_users = filter(lambda u: u.active, users)
print([u.name for u in active_users])  # ['Alice', 'Carol']

# filter 与列表推导式的对比
# [x for x in data if f(x)]  ←→  filter(lambda x: f(x), data)
# 两者等价，列表推导式更 Pythonic
```

### reduce：累积计算

```python
# reduce(function, iterable, initial) → 单值，累积折叠

from functools import reduce

# 求和
nums = [1, 2, 3, 4, 5]
total = reduce(lambda acc, x: acc + x, nums, 0)
print(total)  # 15

# 等价于
total = sum(nums)

# 阶乘
def factorial(n: int) -> int:
    return reduce(lambda acc, x: acc * x, range(1, n + 1), 1)

print(factorial(5))  # 120

# 最大值
scores = [72, 95, 85, 60, 90]
max_score = reduce(lambda a, b: a if a > b else b, scores)
print(max_score)  # 95

# 展平嵌套列表
nested = [[1, 2], [3, 4], [5, [6, 7]]]
flattened = reduce(lambda acc, x: acc + (x if isinstance(x, list) else [x]), nested, [])
print(flattened)  # [1, 2, 3, 4, 5]

# 连接字符串
words = ["Hello", "World", "Python"]
sentence = reduce(lambda acc, w: f"{acc} {w}", words)
print(sentence)  # Hello World Python

# reduce 的 initial 参数
# 不提供时，从第一个元素开始（无 initial → acc = iterable[0]）
# 提供 initial 时，acc = initial，从第一个元素开始
result = reduce(lambda acc, x: acc + x, [1, 2, 3])        # 6（无 initial）
result = reduce(lambda acc, x: acc + x, [1, 2, 3], 10)     # 16（有 initial，10+1+2+3）
```

### 三剑客组合：管道式处理

```python
from functools import reduce

# 函数式数据处理管道
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# 管道：取偶数 → 平方 → 求和
result = reduce(
    lambda acc, x: acc + x,
    map(lambda x: x ** 2,
        filter(lambda x: x % 2 == 0, data)
    ),
    0
)
print(result)  # 220 = 2+4+6+8+10

# 写成函数组合形式（更优雅）
def pipe(*functions):
    """函数管道：f1 ∘ f2 ∘ f3"""
    return reduce(lambda f, g: lambda x: f(g(x)), functions, lambda x: x)

is_even = lambda x: x % 2 == 0
square = lambda x: x ** 2
sum_all = lambda xs: reduce(lambda a, b: a + b, xs, 0)

process = pipe(sum_all, partial(map, square), partial(filter, is_even))
print(process(data))  # 220
```

---

## functools 完整工具集

### lru_cache：记忆化缓存

```python
from functools import lru_cache, wraps

# lru_cache：自动缓存函数调用结果（基于参数哈希）
@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    """记忆化斐波那契，避免指数级重复计算"""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(100))  # 瞬间计算完成（缓存命中）
print(fibonacci.cache_info())  # CacheInfo(hits=98, misses=101, ...)

# 等价于手写的记忆化：
_cache = {}
def fib_cached(n: int) -> int:
    if n not in _cache:
        _cache[n] = fib_cached(n - 1) + fib_cached(n - 2) if n >= 2 else n
    return _cache[n]

# lru_cache 参数
@lru_cache(maxsize=None)  # 无限制缓存
def heavy_computation(x):
    ...

@lru_cache(maxsize=1024)  # 最多缓存 1024 条
def api_call(endpoint: str) -> dict:
    ...

# 清空缓存
api_call.cache_clear()
api_call.cache_info()  # CacheInfo(hits=0, misses=0, ...)

# 注意：参数必须可哈希（hashable）
@lru_cache
def bad_func(items: list) -> int:  # 错误 TypeError: unhashable type 'list'
    return sum(items)

@lru_cache
def good_func(*items) -> int:  # 正确 元组可哈希
    return sum(items)
```

### cache（Python 3.9+）

```python
from functools import cache  # Python 3.9+

# cache = lru_cache(maxsize=None)
# 无限缓存，适合纯函数、配置查找

@cache
def factorial_cached(n: int) -> int:
    return n * factorial_cached(n - 1) if n else 1

print(factorial_cached(100))  # 无限制缓存
print(factorial_cached.cache_info())  # CacheInfo(...)
```

### partial：偏函数（部分参数）

```python
from functools import partial

# partial：固定函数的部分参数，创建新函数
def power(base: float, exponent: float) -> float:
    return base ** exponent

# 固定 exponent = 2（创建平方函数）
square = partial(power, exponent=2)
cube = partial(power, exponent=3)
sqrt = partial(power, exponent=0.5)

print(square(5))   # 25.0
print(cube(3))     # 27.0
print(sqrt(16))    # 4.0

# 固定位置参数
power_of_2 = partial(power, 2)  # 第一个参数固定为 2
print(power_of_2(10))  # 1024 = 2^10

# 偏函数的应用：创建事件处理器
def handle_event(handler: callable, event_type: str, data: dict):
    return handler(data)

# 偏函数工厂
def create_handler(handler: callable):
    return partial(handle_event, handler)

process_user = create_handler(lambda d: f"处理用户: {d['name']}")
process_order = create_handler(lambda d: f"处理订单: {d['order_id']}")

print(process_user("order", {"name": "小虾子"}))
print(process_order("order", {"order_id": "ORD-001"}))
```

### singledispatch：函数重载（泛型函数）

```python
from functools import singledispatch

@singledispatch
def serialize(value) -> str:
    """默认实现"""
    return str(value)

@serialize.register
def _(value: int) -> str:
    return f"int:{value}"

@serialize.register
def _(value: str) -> str:
    return f"str:{value}"

@serialize.register
def _(value: list) -> str:
    return f"list:{','.join(map(str, value))}"

@serialize.register
def _(value: dict) -> str:
    items = ','.join(f"{k}={v}" for k, v in value.items())
    return f"dict:{items}"

print(serialize(42))           # int:42
print(serialize("hello"))      # str:hello
print(serialize([1, 2, 3]))    # list:1,2,3
print(serialize({"a": 1}))     # dict:a=1
print(serialize(3.14))         # 3.14（默认实现）

# 注册多个类型到同一处理函数
@serialize.register(int)
@serialize.register(float)
def _(value):
    return f"number:{value}"
```

### cmp_to_key：自定义排序

```python
from functools import cmp_to_key

# cmp_to_key：将比较函数转换为 key 函数（Python 3 移除 cmp 参数）
nums = [5, 2, 8, 1, 9]

# Python 2 风格：comparator
def cmp(a, b):
    return b - a  # 降序

# Python 3 风格：key 函数
nums.sort(key=cmp_to_key(lambda a, b: b - a))
print(nums)  # [9, 8, 5, 2, 1]

# 自然排序（"file2" < "file10"）
import re
versions = ["file10.txt", "file2.txt", "file1.txt", "file20.txt"]

def natural_cmp(a: str, b: str) -> int:
    """自然排序比较"""
    def extract_numbers(s: str):
        return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', s)]

    a_parts = extract_numbers(a)
    b_parts = extract_numbers(b)

    for a_part, b_part in zip(a_parts, b_parts):
        if a_part != b_part:
            if isinstance(a_part, int):
                return -1
            if isinstance(b_part, int):
                return 1
            return -1 if a_part < b_part else 1
    return 0

versions.sort(key=cmp_to_key(natural_cmp))
print(versions)  # ['file1.txt', 'file2.txt', 'file10.txt', 'file20.txt']
```

### reduce（已讲）、@wraps（元编程已覆盖）

---

## 函数组合与管道

### 手动函数组合

```python
# 函数组合：(f ∘ g)(x) = f(g(x))
def compose(f, g):
    """组合两个函数：先 g，再 f"""
    def composed(x):
        return f(g(x))
    return composed

def double(x): return x * 2
def square(x): return x ** 2
def add_ten(x): return x + 10

# compose 后的函数：从右到左执行
f = compose(double, square)  # double ∘ square
print(f(5))  # double(square(5)) = double(25) = 50

g = compose(add_ten, double)  # add_ten ∘ double
print(g(5))  # add_ten(double(5)) = add_ten(10) = 20
```

### pipe：管道（从左到右）

```python
from functools import reduce

def pipe(*functions):
    """从左到右的函数管道"""
    return reduce(lambda f, g: lambda x: g(f(x)), functions, lambda x: x)

# pipe 后的函数：从左到右执行
process = pipe(
    lambda x: x * 2,     # 1. 乘以 2
    lambda x: x + 10,    # 2. 加上 10
    lambda x: x ** 0.5   # 3. 开平方
)

print(process(5))  # pipe: 5→10→20→4.47

# 数据处理管道
def clean(s: str) -> str:
    return s.strip().lower()

def remove_special(s: str) -> str:
    return ''.join(c for c in s if c.isalnum() or c.isspace())

def count_words(s: str) -> int:
    return len(s.split())

pipeline = pipe(clean, remove_special, count_words)
print(pipeline("  Hello, World!  "))  # 2
```

### fold：折叠（reduce 的别名）

```python
# fold = reduce（不同社区的叫法）
# foldl = reduce（从左折叠）
# foldr = reduce（从右折叠，但实现不同）

from functools import reduce

# foldl（从左折叠）
def foldl(func, iterable, initial):
    return reduce(func, iterable, initial)

# foldr（从右折叠）
def foldr(func, iterable, initial):
    return reduce(lambda a, b: func(b, a), reversed(list(iterable)), initial)

# 示例：foldl 和 foldr 的区别
foldl(lambda acc, x: f"({acc} {x})", ["a", "b", "c"], "Z")
# (((Z a) b) c) = "(((Z a) b) c)"

foldr(lambda x, acc: f"({x} {acc})", ["a", "b", "c"], "Z")
# (a (b (c Z))) = "(a (b (c Z)))"
```

---

## 闭包与作用域

### 闭包详解

```python
# 闭包 = 函数 + 捕获的外部变量
def make_multiplier(factor: int):
    """工厂函数：创建乘法器"""
    multiplier = factor  # 自由变量，被闭包捕获

    def multiply(value: int) -> int:
        return value * multiplier  # 引用外部变量

    return multiply

times_3 = make_multiplier(3)
times_5 = make_multiplier(5)

print(times_3(10))  # 30
print(times_5(10))  # 50

# 闭包捕获的是变量引用，而非值！
def create_counters():
    counters = []
    for i in range(3):
        def counter():
            return i  # 捕获的是 i 的引用，不是值！
        counters.append(counter)
    return counters

c0, c1, c2 = create_counters()
print(c0(), c1(), c2())  # 2, 2, 2 错误 全部是 2！

# 正确 正确：使用默认参数捕获值
def create_counters_fixed():
    counters = []
    for i in range(3):
        def counter(j=i):  # 默认参数在定义时绑定值
            return j
        counters.append(counter)
    return counters

c0, c1, c2 = create_counters_fixed()
print(c0(), c1(), c2())  # 0, 1, 2 正确

# 或者用 partial
from functools import partial

def create_counters_with_partial():
    counters = []
    for i in range(3):
        counters.append(partial(lambda x: x, i))
    return counters
```

### 闭包的应用：记忆化

```python
from functools import wraps

def memoize(func):
    """记忆化装饰器（通用版）"""
    cache = {}

    @wraps(func)
    def wrapper(*args, **kwargs):
        # 构建可哈希的缓存键
        key = (args, tuple(sorted(kwargs.items())))
        if key not in cache:
            cache[key] = func(*args, **kwargs)
        return cache[key]

    wrapper.cache = cache  # 可访问缓存
    return wrapper

@memoize
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(100))  # 354224848179261915075
print(len(fib.cache))  # 101（缓存了 101 个值）
```

---

## 匿名函数与 Lambda

### Lambda 的正确用法

```python
# Lambda：单表达式匿名函数
square = lambda x: x ** 2
print(square(5))  # 25

# Lambda 的适用场景：短回调函数
data = [("apple", 5), ("banana", 2), ("cherry", 8)]
data.sort(key=lambda x: x[1])  # 按数量排序
print(data)  # [('banana', 2), ('apple', 5), ('cherry', 8)]

# map / filter / sorted 的回调
print(list(map(lambda x: x ** 2, range(5))))  # [0, 1, 4, 9, 16]
print(list(filter(lambda x: x > 2, range(5))))  # [3, 4]

# Lambda 的限制：
# 1. 只能有单个表达式，不能有语句
# 2. 不能有赋值语句（不能 func(x) = 5）
# 3. 复杂逻辑用 def，不要用 Lambda

# 错误 滥用 Lambda
# 错误：将 Lambda 赋值给变量（使用 def 更清晰）
square = lambda x: x ** 2  # 错误 应该用 def square(x): ...

# 正确 Lambda 的正确场景：作为参数传递（回调）
sorted_words = sorted(words, key=lambda w: len(w))
```

### Lambda 与高阶函数组合

```python
from functools import reduce

# 用 Lambda 构建数据处理管道
data = [1, 2, 3, 4, 5]

# 链式处理
result = reduce(
    lambda acc, fn: fn(acc),
    [
        lambda x: [i * 2 for i in x],      # 1. 乘以 2
        lambda x: [i for i in x if i > 3],  # 2. 过滤 > 3
        lambda x: sum(x),                   # 3. 求和
    ],
    data
)
print(result)  # (2+4+6+8+10 过滤后) 4+6+8+10 = 28

# 条件映射
def conditional_map(data: list, predicate, true_fn, false_fn):
    return list(map(lambda x: true_fn(x) if predicate(x) else false_fn(x), data))

nums = [1, 2, 3, 4, 5]
labels = conditional_map(nums, lambda x: x % 2 == 0, lambda x: "偶", lambda x: "奇")
print(labels)  # ['奇', '偶', '奇', '偶', '奇']
```

---

## 迭代器与生成器进阶

### iter() 的函数形式

```python
# iter(callable, sentinel) → 迭代器，callable 返回 sentinel 时停止
import sys

# 逐行读取直到空行
def read_until_empty():
    for line in iter(input, ""):
        print(line)

# 从文件读取直到特定行
with open("data.txt") as f:
    for line in iter(lambda: f.readline(), "END\n"):
        print(line.rstrip())

# 无限计数器（但有哨兵值时停止）
def counter(start=0):
    n = start
    while True:
        yield n
        n += 1

nums = iter(lambda: next(counter()) if next(counter()) < 10 else StopIteration, StopIteration)
# 注意：这个例子太复杂，实际用 takewhile 更简洁

# takewhile / dropwhile
from itertools import takewhile, dropwhile, islice

data = range(20)

# 取前 10 个偶数
evens = takewhile(lambda x: x < 10, (x for x in range(20) if x % 2 == 0))
print(list(evens))  # [0, 2, 4, 6, 8]

# 跳过前 5 个
rest = islice(data, 5, None)
print(list(rest))  # [5, 6, 7, 8, 9, 10, ...]
```

### itertools 中的函数式工具

```python
import itertools

# accumulate = 扫描（scan）
from itertools import accumulate
nums = [1, 2, 3, 4, 5]
print(list(accumulate(nums)))              # [1, 3, 6, 10, 15]（累加和）
print(list(accumulate(nums, max)))        # [1, 2, 3, 4, 5]（累加最大值）
print(list(accumulate(nums, lambda a, b: a * b)))  # [1, 2, 6, 24, 120]（累积乘积）

# starmap：展开参数调用
data = [(2, 5), (3, 2), (10, 3)]
print(list(itertools.starmap(pow, data)))  # [32, 9, 1000]

# tee：复制迭代器
original, copy = itertools.tee(["a", "b", "c"])
print(list(original))  # ['a', 'b', 'c']
print(list(copy))     # ['a', 'b', 'c']

# zip_longest：长度不等的压缩
a = [1, 2, 3]
b = ['a', 'b']
print(list(itertools.zip_longest(a, b, fillvalue="?")))
# [(1, 'a'), (2, 'b'), (3, '?')]
```

---

## 实战：函数式 vs 命令式对比

### 场景 1：日志分析

```python
# 命令式
def analyze_logs_commandary(logs: list[dict]) -> dict:
    error_logs = []
    for log in logs:
        if log["level"] == "ERROR":
            error_logs.append(log)

    error_by_module = {}
    for log in error_logs:
        module = log["module"]
        if module not in error_by_module:
            error_by_module[module] = 0
        error_by_module[module] += 1

    return error_by_module

# 函数式
from collections import Counter

def analyze_logs_functional(logs: list[dict]) -> dict:
    return dict(Counter(
        log["module"]
        for log in logs
        if log["level"] == "ERROR"
    ))

# 更优雅的管道版本
from functools import partial
from operator import itemgetter

analyze_logs_pipe = partial(
    map,
    itemgetter("module")
)

error_by_module = dict(Counter(
    filter(
        lambda log: log["level"] == "ERROR",
        logs
    )
))
```

### 场景 2：数据转换

```python
from dataclasses import dataclass

@dataclass
class Order:
    order_id: str
    customer: str
    items: list[dict]
    status: str

orders = [
    Order("ORD-1", "Alice", [{"sku": "A", "qty": 2, "price": 10}], "shipped"),
    Order("ORD-2", "Bob", [{"sku": "B", "qty": 1, "price": 50}], "pending"),
    Order("ORD-3", "Alice", [{"sku": "C", "qty": 3, "price": 20}], "shipped"),
]

# 函数式计算：Alice 的已发货订单总额
def calc_revenue(orders: list[Order]) -> float:
    return sum(
        reduce(
            lambda acc, item: acc + item["qty"] * item["price"],
            order.items,
            0.0
        )
        for order in orders
        if order.customer == "Alice" and order.status == "shipped"
    )

print(calc_revenue(orders))  # 80.0 = 2*10 + 3*20
```

### 场景 3：验证链

```python
from functools import reduce
from dataclasses import dataclass

@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]

def validate(not_empty_fn, min_len_fn, pattern_fn):
    """验证器组合"""
    def combined(value: str) -> ValidationResult:
        errors = []
        for validator in [not_empty_fn, min_len_fn, pattern_fn]:
            result = validator(value)
            if not result.valid:
                errors.extend(result.errors)
        return ValidationResult(valid=len(errors) == 0, errors=errors)
    return combined

def not_empty(value: str) -> ValidationResult:
    return ValidationResult(valid=bool(value), errors=["不能为空"] if not value else [])

def min_length(min_len: int):
    def validator(value: str) -> ValidationResult:
        return ValidationResult(
            valid=len(value) >= min_len,
            errors=[f"长度至少 {min_len}"] if len(value) < min_len else []
        )
    return validator

def matches_pattern(pattern: str):
    import re
    def validator(value: str) -> ValidationResult:
        return ValidationResult(
            valid=bool(re.match(pattern, value)),
            errors=["格式不匹配"] if not re.match(pattern, value) else []
        )
    return validator

# 组合验证器
validate_username = validate(
    not_empty,
    min_length(3),
    matches_pattern(r'^[a-zA-Z0-9_]+$')
)

result = validate_username("ab")
print(result)  # ValidationResult(valid=False, errors=['长度至少 3', '格式不匹配'])
```

---

## 常见陷阱与最佳实践

### 陷阱 1：Lambda 捕获可变对象

```python
# 错误 陷阱：Lambda 捕获循环变量的引用
funcs = [lambda: i for i in range(5)]
print([f() for f in funcs])  # [4, 4, 4, 4, 4] 错误

# 正确 正确：用默认参数捕获值
funcs = [lambda i=i: i for i in range(5)]
print([f() for f in funcs])  # [0, 1, 2, 3, 4] 正确
```

### 陷阱 2：map/filter vs 列表推导式

```python
# 错误 过度使用 map/filter（不够 Pythonic）
result = list(map(lambda x: x ** 2, filter(lambda x: x % 2 == 0, data)))

# 正确 优先用列表推导式（更直观）
result = [x ** 2 for x in data if x % 2 == 0]

# 正确 map/filter 的合适场景：需要与其他高阶函数组合时
from functools import reduce

result = reduce(
    lambda acc, x: acc + x,
    map(str.strip,
        filter(None, data)
    ),
    0
)
# 这个场景列表推导式反而更复杂
```

### 陷阱 3：函数组合的可读性

```python
# 错误 过度抽象导致代码难以理解
result = compose(compose(double, square), add_ten)(5)

# 正确 适度使用：保持代码可读性
# 简单逻辑用列表推导式
# 复杂管道（>3步）用 pipe/compose
# 数据密集型处理用 functools 工具
```

---

## 总结

```
函数式核心工具速查：
─────────────────────────────────
map(fn, iter)              → 逐元素转换（返回迭代器）
filter(fn, iter)           → 条件筛选（返回迭代器）
reduce(fn, iter, init)     → 累积折叠（返回单值）
accumulate(iter, fn)       → 扫描/前缀累积（itertools）
takewhile / dropwhile       → 条件截取（itertools）

functools 工具速查：
─────────────────────────────────
@lru_cache(maxsize)        → 记忆化缓存
@cache                     → 无限制缓存（Python 3.9+）
partial(fn, *args, **kws)  → 偏函数（固定部分参数）
@singledispatch            → 泛型函数（类型分派）
@wraps                     → 保留原函数元信息
cmp_to_key(fn)             → 比较函数转 key 函数
```

```
函数组合速查：
─────────────────────────────────
compose(f, g)(x) = f(g(x))    → 从右到左执行
pipe(f, g, h)(x) = h(g(f(x))) → 从左到右执行
partial(fn, x)(y) = fn(x, y)  → 固定部分参数
```

```
函数式 vs 命令式选型：
─────────────────────────────────
正确 函数式适合：
  → 数据转换管道（map/filter/reduce）
  → 纯计算（无副作用）
  → 并行化需求
  → 组合多个简单操作

正确 命令式适合：
  → 有副作用的操作（I/O）
  → 复杂控制流
  → 需要调试的代码
  → 可读性优先时

最佳实践：
─────────────────────────────────
正确 纯函数优先（无副作用）
正确 不可变数据结构（dataclass frozen / tuple / frozenset）
正确 小函数组合（大函数拆成小函数）
正确 列表推导式优先（简单场景）
正确 functools 工具（复杂场景）
正确 类型注解（函数式代码更依赖类型）
```

Python 的函数式特性不是 Haskell 的替代品，而是一种强大的补充——`map`/`filter`/`reduce` 让数据处理管道化，`functools` 让函数可组合、可缓存、可泛型，`partial` 让参数部分绑定成为可能。掌握函数式思维，你的 Python 代码将更加简洁、更加可测试、更加优雅

本文由小虾子  撰写
