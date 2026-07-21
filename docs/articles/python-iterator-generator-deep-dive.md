---
title: Python 生成器与迭代器完全指南：从协议到工程实战
date: 2026-07-08
---

# Python 生成器与迭代器完全指南：从协议到工程实战

> Python 的 for 循环为什么能遍历任何对象？列表推导式和生成器表达式有什么区别？为什么说生成器是 Python 最优雅的设计？本文从迭代器协议出发，完整解析生成器的原理、用法、实战场景，以及与 async/await 的内在联系——让你彻底掌握 Python 最精妙的特性之一。

本文由小虾子  撰写

## 迭代器协议：Python for 循环的真相

### for 循环的工作原理

```python
# Python 的 for 循环不是索引遍历，而是协议遍历
# for item in iterable 的等价代码：

iterator = iterable.__iter__()    # ① 获取迭代器
while True:
    try:
        item = iterator.__next__()  # ② 尝试取下一个元素
    except StopIteration:            # ③ 元素取完时抛出 StopIteration
        break                       # 退出循环
    # ④ 处理元素
    process(item)

# 这就是为什么 for 可以遍历列表、字符串、文件、生成器...
# 只要对象实现了 __iter__ 和 __next__，就能用 for 遍历
```

### 迭代器协议定义

```python
class Counter:
    """自定义迭代器：从 1 数到 n"""

    def __init__(self, n):
        self.n = n
        self.current = 0

    def __iter__(self):        # ① 返回迭代器本身
        return self

    def __next__(self):        # ② 返回下一个元素
        self.current += 1
        if self.current > self.n:
            raise StopIteration  # 元素取完，必须抛出 StopIteration
        return self.current

# 使用
for num in Counter(5):
    print(num)  # 1, 2, 3, 4, 5

# 等价于
counter = Counter(5)
iterator = iter(counter)    # 调用 __iter__
while True:
    try:
        num = next(iterator)  # 调用 __next__
        print(num)
    except StopIteration:
        break
```

### 迭代器 vs 可迭代对象

```python
# 可迭代对象（Iterable）：实现了 __iter__（返回迭代器）
# 迭代器（Iterator）：实现了 __iter__ 和 __next__（本身也是可迭代的）

# 列表是可迭代对象，不是迭代器
my_list = [1, 2, 3]
print(dir(my_list))
# ['__iter__', ...] 正确 有 __iter__
# ['__next__', ...] 错误 没有 __next__ → 不是迭代器

# iter() 作用于列表，返回列表迭代器
list_iter = iter(my_list)
print(type(list_iter))  # list_iterator

# 列表迭代器是真正的迭代器
print(dir(list_iter))
# ['__iter__', '__next__', ...] 正确 两者都有

# 一个对象可以同时是迭代器和可迭代对象
# 但通常：可迭代对象 __iter__ 返回新迭代器，迭代器 __iter__ 返回 self

class Counter(Iterator):  # Python 3.x 可直接继承 Iterator
    """直接继承 Iterator 更简洁"""
    def __init__(self, n):
        self.n = n
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        self.current += 1
        if self.current > self.n:
            raise StopIteration
        return self.current
```

---

## 生成器函数：yield 的魔法

### 从普通函数到生成器函数

```python
# 普通函数：一次性返回所有结果
def square_numbers(nums):
    results = []
    for n in nums:
        results.append(n * n)
    return results

# 生成器函数：按需产生结果（惰性求值）
def square_numbers_gen(nums):
    for n in nums:
        yield n * n    # yield = 暂停并返回值

# 调用普通函数：立即执行，返回列表
result1 = square_numbers([1, 2, 3])
print(result1)  # [1, 4, 9]

# 调用生成器函数：返回一个生成器对象（不执行函数体！）
gen = square_numbers_gen([1, 2, 3])
print(gen)  # <generator object square_numbers_gen at 0x...>
print(type(gen))  # <class 'generator'>

# 逐个取值
print(next(gen))  # 1（函数执行到第一个 yield）
print(next(gen))  # 4（从上次 yield 继续，执行到第二个 yield）
print(next(gen))  # 9（从上次 yield 继续，执行到第三个 yield）
print(next(gen))  # StopIteration（函数结束）
```

### 生成器的执行模型

```
生成器函数的执行流程：
─────────────────────────────────
def my_generator():
    print("A")           ← 执行（0%）
    yield 1              ← 暂停（100%），返回 1
    print("B")           ← 恢复执行
    yield 2              ← 暂停，返回 2
    print("C")
    yield 3              ← 暂停，返回 3
    print("D")
    return "完成"         ← 函数结束

gen = my_generator()     # 不打印任何东西！函数还没开始执行

next(gen)  # 打印 "A"，输出 1
next(gen)  # 打印 "B"，输出 2
next(gen)  # 打印 "C"，输出 3
next(gen)  # 打印 "D"，StopIteration: 完成（return 的值在异常中）

# for 循环自动处理 StopIteration
for item in my_generator():
    print(item)  # 1, 2, 3
```

### 生成器的状态

```python
import inspect

def running_gen():
    yield 1

gen = running_gen()
print(inspect.getgeneratorstate(gen))  # GEN_CREATED（刚创建，未启动）
next(gen)
print(inspect.getgeneratorstate(gen))  # GEN_SUSPENDED（暂停在 yield 处）
next(gen, None)  # 触发 StopIteration，gen 变为 closed
print(inspect.getgeneratorstate(gen))  # GEN_CLOSED（已关闭）

# 生成器的方法
gen = running_gen()
gen.send(42)  # 向生成器发送值（yield 会接收发送的值）
gen.throw(ValueError)  # 向生成器抛出异常
gen.close()  # 强制关闭生成器
```

---

## yield from：生成器委托

### yield from 的作用

```python
# 问题：如何遍历嵌套结构？
def flatten(nested):
    for sublist in nested:
        for item in sublist:
            yield item   # 双重循环，繁琐

# 正确 正确方案：yield from（Python 3.3+）
def flatten(nested):
    for sublist in nested:
        yield from sublist  # yield from = 委托给子迭代器

# 等价于
def flatten(nested):
    for sublist in nested:
        for item in sublist:
            yield item

# 使用
data = [[1, 2], [3, 4], [5, 6]]
print(list(flatten(data)))  # [1, 2, 3, 4, 5, 6]
```

### yield from 的委托机制

```python
# yield from 的完整等价形式：
def generator(parent_iterable):
    iterator = iter(parent_iterable)
    while True:
        try:
            item = next(iterator)
            yield item
        except StopIteration:
            break

# yield from 更强大之处：双向通道
def echo_gen():
    """回声生成器"""
    while True:
        received = yield
        print(f"收到: {received}")

def delegator():
    """委托生成器"""
    gen = echo_gen()
    next(gen)  # 启动回声生成器
    yield from gen  # 委托所有 send() 给回声生成器

# 测试
g = delegator()
g.send(None)  # 启动委托生成器
g.send("你好")  # 收到: 你好
g.send("Python")  # 收到: Python
```

### yield from 与异常传播

```python
# yield from 自动传播 StopIteration / return / 异常
def parent():
    yield from child()   # child 的返回值成为 parent 的返回值

def child():
    for i in range(3):
        yield i
    return "child done"

for item in parent():
    print(item)  # 0, 1, 2
# parent() 的 return 值可以通过 .send() 或 catch StopIteration 获取

# 自动异常传播
def bad_child():
    raise ValueError("子生成器错误")

def parent_bad():
    yield from bad_child()  # ValueError 会自动传播到 parent

try:
    list(parent_bad())
except ValueError as e:
    print(f"捕获异常: {e}")  # 子生成器的异常被传播
```

---

## 生成器表达式 vs 列表推导式

### 语法对比

```python
# 列表推导式（立即计算，生成列表）
squares_list = [x * x for x in range(10)]
print(squares_list)  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
print(type(squares_list))  # <class 'list'>

# 生成器表达式（惰性求值，生成生成器）
squares_gen = (x * x for x in range(10))
print(squares_gen)  # <generator object>
print(type(squares_gen))  # <class 'generator'>

# 两者区别：内存 vs 时间
print(list(squares_gen))  # 强制转换后和列表一样
```

### 性能对比

```python
import sys

# 内存占用对比
list_size = sys.getsizeof([x for x in range(1000000)])  # 列表大小
gen_size = sys.getsizeof((x for x in range(1000000)))  # 生成器大小

print(f"列表占用: {list_size:,} bytes")    # ~8MB
print(f"生成器占用: {gen_size:,} bytes")   # ~200 bytes

# 时间对比
import time

def timer(func):
    start = time.perf_counter()
    result = func()
    elapsed = time.perf_counter() - start
    return elapsed, result

# 列表：构造时就需要计算所有值
list_time, _ = timer(lambda: [x for x in range(1000000)])

# 生成器：构造时什么都不做
gen_time, _ = timer(lambda: (x for x in range(1000000)))

print(f"列表构造时间: {list_time:.4f}s")    # 需要完整计算
print(f"生成器构造时间: {gen_time:.8f}s")   # 几乎为 0

# 取前 10 个元素：生成器更优
gen = (x for x in range(1000000))
first_10 = [next(gen) for _ in range(10)]  # 只计算前 10 个
```

### 使用场景选择

```
选择指南：
─────────────────────────────────
用列表推导式 []：
  正确 需要多次遍历
  正确 需要 len() / 索引访问
  正确 需要排序 / 反转
  正确 数据集较小（< 10000）
  正确 需要立即看到全部结果

用生成器表达式 ()：
  正确 只遍历一次（流式数据）
  正确 数据集非常大或无限
  正确 内存敏感场景
  正确 只需要前 N 个元素
  正确 管道处理（多个生成器串联）
```

---

## 实战：生成器管道模式

### 数据处理管道

```python
# 生成器天然适合数据处理管道
def read_lines(filepath):
    """读取文件行（惰性）"""
    with open(filepath, encoding="utf-8") as f:
        for line in f:
            yield line.rstrip('\n')

def filter_non_empty(lines):
    """过滤空行"""
    for line in lines:
        if line.strip():
            yield line

def to_upper(lines):
    """转大写"""
    for line in lines:
        yield line.upper()

def add_line_number(lines):
    """添加行号"""
    for i, line in enumerate(lines, 1):
        yield f"{i:4d}: {line}"

# 管道组合（惰性求值，内存高效）
lines = to_upper(add_line_number(filter_non_empty(read_lines("large_file.txt"))))

# 只取前 100 行：只读取并处理前 100 行
for line in lines:
    print(line)
    if line.startswith(" 100"):
        break
```

### 多步数据转换

```python
# 电商数据处理管道
def parse_orders(order_strings):
    """解析订单数据"""
    import json
    for s in order_strings:
        try:
            yield json.loads(s)
        except json.JSONDecodeError:
            continue

def filter_valid(orders):
    """过滤有效订单"""
    for order in orders:
        if order.get("status") == "paid" and order.get("total", 0) > 0:
            yield order

def enrich_with_customer(orders):
    """补充客户信息"""
    for order in orders:
        order["customer_name"] = get_customer_name(order["customer_id"])
        yield order

def calculate_metrics(orders):
    """计算指标"""
    total_revenue = 0
    order_count = 0
    for order in orders:
        total_revenue += order["total"]
        order_count += 1
        yield {
            "running_count": order_count,
            "running_revenue": total_revenue,
            "order": order
        }

# 使用：惰性处理百万级订单
order_stream = parse_orders(large_order_strings)  # 百万条 JSON
valid_orders = filter_valid(order_stream)          # 只处理有效的
enriched = enrich_with_customer(valid_orders)      # 补充信息
metrics = calculate_metrics(enriched)               # 计算指标

# 取前 10 条指标
top_10 = [next(metrics) for _ in range(10)]
```

---

## itertools 标准库

### 无限迭代器

```python
import itertools

# count()：无限计数器
counter = itertools.count(start=1, step=2)  # 1, 3, 5, 7, ...
print(next(counter))  # 1
print(next(counter))  # 3

# cycle()：无限循环
cycler = itertools.cycle(["A", "B", "C"])  # A, B, C, A, B, C, ...
print(next(cycler))  # A

# repeat()：重复一个值
repeater = itertools.repeat("x", times=3)  # x, x, x
print(list(repeater))  # ['x', 'x', 'x']
```

### 有限迭代器

```python
import itertools

# accumulate()：累积计算
data = [1, 2, 3, 4, 5]
print(list(itertools.accumulate(data)))              # [1, 3, 6, 10, 15]
print(list(itertools.accumulate(data, func=max)))   # [1, 2, 3, 4, 5]

# chain()：连接多个可迭代对象
print(list(itertools.chain([1, 2], "abc", [3, 4])))  # [1, 2, 'a', 'b', 'c', 3, 4]

# chain.from_iterable()：展平嵌套列表
nested = [[1, 2], ["a", "b"], [True]]
print(list(itertools.chain.from_iterable(nested)))  # [1, 2, 'a', 'b', True]

# compress()：按条件筛选
data = ["a", "b", "c", "d"]
selector = [1, 0, 1, 1]
print(list(itertools.compress(data, selector)))  # ['a', 'c', 'd']

# dropwhile / takewhile
data = [1, 3, 5, 2, 4, 6]
print(list(itertools.dropwhile(lambda x: x < 5, data)))  # [5, 2, 4, 6]（从第一个不满足条件开始保留）
print(list(itertools.takewhile(lambda x: x < 5, data)))  # [1, 3]（遇到不满足条件停止）

# islice()：切片（支持无限迭代器）
print(list(itertools.islice(range(100), 5, 20, 2)))  # [5, 7, 9, 11, 13, 15, 17, 19]
```

### 组合迭代器

```python
import itertools

# product()：笛卡尔积
colors = ["红", "绿", "蓝"]
sizes = ["S", "M", "L"]
print(list(itertools.product(colors, sizes)))
# [('红', 'S'), ('红', 'M'), ('红', 'L'), ('绿', 'S'), ...]

# permutations()：排列（顺序有关）
print(list(itertools.permutations("ABC", 2)))
# [('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'A'), ('C', 'B')]

# combinations()：组合（顺序无关）
print(list(itertools.combinations("ABC", 2)))
# [('A', 'B'), ('A', 'C'), ('B', 'C')]

# combinations_with_replacement()：带重复的组合
print(list(itertools.combinations_with_replacement("AB", 3)))
# [('A', 'A', 'A'), ('A', 'A', 'B'), ('A', 'B', 'B'), ('B', 'B', 'B')]

# 实战：生成测试用例
def generate_test_cases():
    for a, b, c in itertools.product([True, False], repeat=3):
        yield {"a": a, "b": b, "c": c}

print(list(generate_test_cases()))  # 8 种组合
```

### groupby：分组

```python
import itertools

data = [("苹果", "水果"), ("香蕉", "水果"), ("白菜", "蔬菜"), ("萝卜", "蔬菜"), ("葡萄", "水果")]

# groupby 要求数据已排序
data.sort(key=lambda x: x[1])  # 按类别排序

for category, group in itertools.groupby(data, key=lambda x: x[1]):
    items = list(group)
    print(f"{category}: {items}")
# 水果: [('苹果', '水果'), ('香蕉', '水果'), ('葡萄', '水果')]
# 蔬菜: [('白菜', '蔬菜'), ('萝卜', '蔬菜')]

# 注意：group 是迭代器，只能消费一次
```

---

## 生成器与异步的内在联系

### async/await 的本质

```python
import asyncio

# async def 函数返回协程对象（不是生成器）
async def async_func():
    return 42

coro = async_func()
print(type(coro))  # <class 'coroutine'>
print(dir(coro))
# ['send', 'throw', 'close']  ← 协程也有 send/throw/close！

# 协程和生成器都支持 send/throw/close
# 它们都是"可以暂停和恢复的可调用对象"

# 运行协程
async def main():
    result = await async_func()
    print(result)  # 42

asyncio.run(main())
```

### 生成器模拟异步（历史背景）

```python
# Python 3.4 之前：使用生成器模拟协程
# 第三方库 gevent / tornado 使用生成器实现异步

def naive_async_http_get(url):
    """用生成器模拟异步 HTTP"""
    def on_response(response):
        # 这里需要手动 resume 生成器
        pass

    # 生成器在这里代表"挂起的异步操作"
    response = yield ("http_get", url, on_response)
    return response

# asyncio 的历史演进：
# Python 3.4: @asyncio.coroutine + yield from
# Python 3.5: async def / await（语法支持）
# Python 3.7+: asyncio.run() 简化
```

### 异步生成器（async for）

```python
import asyncio

# 异步生成器：在 async def 中使用 yield
async def async_data_stream():
    """模拟异步数据流"""
    for i in range(10):
        await asyncio.sleep(0.1)  # 模拟 I/O
        yield i

# 异步迭代器
class AsyncCounter:
    def __init__(self, n):
        self.n = n
        self.current = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.current >= self.n:
            raise StopAsyncIteration
        await asyncio.sleep(0.05)
        self.current += 1
        return self.current

# 使用
async def main():
    # async for：遍历异步生成器
    async for item in async_data_stream():
        print(item)

    # async for：遍历异步迭代器
    async for num in AsyncCounter(5):
        print(f"计数: {num}")

    # 异步列表推导式
    results = [x async for x in async_data_stream() if x % 2 == 0]
    print(results)  # [0, 2, 4, 6, 8]

asyncio.run(main())
```

### yield from 与 await 的关系

```python
# Python 3.3 前：用 yield from 委托给子生成器
def gen_a():
    yield 1
    yield from gen_b()  # 委托给 gen_b
    yield 2

# Python 3.5+：await 可以等待协程/可等待对象
async def coro_a():
    return 1

async def coro_b():
    return 2

async def main():
    # await 委托给协程（await 后面的对象必须可等待）
    result = await coro_a()

    # 多个异步任务并发
    r1, r2 = await asyncio.gather(coro_a(), coro_b())

# yield from gen()  vs  await coroutine
# 本质相同：暂停当前任务，转去执行另一个可等待对象
```

---

## 生成器在框架中的实际应用

### FastAPI 的 StreamingResponse

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def event_stream():
    """生成器驱动的 SSE 流"""
    for i in range(10):
        await asyncio.sleep(1)
        yield f"data: 第 {i+1} 条消息\n\n"

@app.get("/stream")
async def stream():
    """流式响应"""
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )

# FastAPI 会自动处理生成器：
# → 每次 yield 一个值就发送一个 chunk
# → 流式传输，适合长连接 / 实时推送

# 同步生成器的 FastAPI 处理
def sync_data_generator():
    for row in database_query():
        yield f"data: {row}\n\n".encode()

@app.get("/sync-stream")
def sync_stream():
    return StreamingResponse(
        sync_data_generator(),
        media_type="text/event-stream"
    )
```

### Django ORM 的 QuerySet

```python
# Django ORM QuerySet 底层使用生成器
# 惰性查询，避免一次性加载全部数据

# 这不会立即查询数据库
users = User.objects.filter(is_active=True)

# 遍历时才真正查询（生成器驱动）
for user in users:  # SELECT * FROM users WHERE is_active=True LIMIT 1000（分批）
    print(user.username)

# QuerySet.iterator()：显式使用生成器（避免在内存中缓存）
def process_all_users():
    for user in User.objects.all().iterator(chunk_size=1000):
        # 每处理 1000 条才从数据库取下一批
        process(user)
        # user 对象处理后立即释放内存
```

### Pydantic 的数据验证

```python
# Pydantic 底层大量使用生成器思维
from pydantic import BaseModel, Field
from typing import List

class User(BaseModel):
    name: str = Field(..., min_length=1)
    age: int = Field(..., ge=0, le=150)

# Pydantic 的验证过程：
# 1. 逐字段验证（yield 每一步验证结果）
# 2. 错误收集（StopIteration 收集所有错误）
# 3. 一次性报告

# 自定义字段验证器（生成器模式）
class UserModel(BaseModel):
    name: str
    age: int

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("名字不能为空")
        return v.strip()

    @field_validator('age')
    @classmethod
    def validate_age(cls, v):
        if v < 0:
            raise ValueError("年龄不能为负数")
        return v
```

---

## 常见陷阱与最佳实践

### 陷阱 1：生成器只能消费一次

```python
# 错误 错误：多次遍历已耗尽的生成器
def numbers():
    yield 1
    yield 2

gen = numbers()
print(list(gen))  # [1, 2]
print(list(gen))  # []  ← 生成器已耗尽，第二次遍历为空

# 正确 正确：每次需要新生成器时重新调用函数
def numbers():
    yield 1
    yield 2

print(list(numbers()))  # [1, 2]
print(list(numbers()))  # [1, 2]

# 正确 正确：用 itertools.tee 复制生成器
def numbers():
    yield 1
    yield 2

g1, g2 = itertools.tee(numbers())  # tee 会缓存已消费的元素
print(list(g1))  # [1, 2]
print(list(g2))  # [1, 2]
```

### 陷阱 2：生成器中的 return

```python
# return 值如何获取？
def gen():
    yield 1
    yield 2
    return "done"

g = gen()
list(g)  # [1, 2]
try:
    next(g)  # StopIteration: done
except StopIteration as e:
    print(f"返回值: {e.value}")  # done

# 正确 用 send() 获取返回值（协程方式）
def gen():
    yield 1
    yield 2
    return "done"

g = gen()
next(g)  # 启动
next(g)  # 推进到最后
try:
    g.send("trigger")  # 触发 return
except StopIteration as e:
    print(e.value)  # done
```

### 陷阱 3：生成器与异常处理

```python
# 错误 错误：在 finally 中使用 yield
def bad_generator():
    try:
        yield 1
        yield 2
    finally:
        yield 99  # 错误 RuntimeError: generator raised StopIteration

# 正确 正确：finally 只做清理，不做 yield
def good_generator():
    resource = acquire_resource()
    try:
        yield 1
        yield 2
    finally:
        release_resource(resource)  # 正确 清理代码在 finally 中

# 正确 用 contextmanager 封装资源
from contextlib import contextmanager

@contextmanager
def managed_resource():
    resource = acquire_resource()
    try:
        yield resource
    finally:
        release_resource(resource)

def gen_with_context():
    with managed_resource() as res:
        yield res
        # 退出 with 块时才清理
```

---

## 总结

```
迭代器协议速查：
─────────────────────────────────
__iter__()：返回迭代器本身（self）
__next__()：返回下一个元素，超出时 raise StopIteration

for 循环等价于：
  it = iter(iterable)
  while True:
      try: item = next(it)
      except StopIteration: break
```

```
生成器速查：
─────────────────────────────────
yield：暂停函数，返回值
yield from：委托给子迭代器
生成器表达式：(x for x in iterable)
next(gen)：取下一个值
gen.send(value)：发送值给生成器
generator.close()：强制关闭
generator.throw(Exception)：抛出异常
StopIteration：生成器结束时抛出

yield from 等价于：
  for item in iterable:
      yield item
```

```
itertools 速查：
─────────────────────────────────
count(start, step)：无限计数器
cycle(iterable)：无限循环
repeat(elem, times)：重复
accumulate(iterable, func)：累积
chain(*iterables)：连接
chain.from_iterable：展平
compress(data, selectors)：条件筛选
dropwhile/takewhile：条件过滤
islice(iterable, start, stop, step)：切片
product(*iterables, repeat)：笛卡尔积
permutations(iterable, r)：排列
combinations(iterable, r)：组合
groupby(iterable, key)：分组
```

```
使用场景指南：
─────────────────────────────────
正确 用生成器的场景：
  → 处理大数据集（内存友好）
  → 无限序列（count, cycle, repeat）
  → 数据管道（多个处理步骤串联）
  → 流式数据（HTTP 流、文件流、实时数据）
  → 按需计算（惰性求值）

正确 用列表的场景：
  → 需要多次遍历
  → 需要索引 / len()
  → 数据量较小
  → 需要排序 / 反转
```

Python 的生成器是惰性计算的完美体现——它让"按需生产"成为可能，让内存使用降到最低，让流式处理变得优雅。配合 itertools 标准库和异步生成器，Python 的迭代器体系构成了现代 Python 高性能编程的基石

本文由小虾子  撰写
