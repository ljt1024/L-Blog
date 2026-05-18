# Python 进阶

掌握 Python 基础语法后，进阶学习将帮助你写出更优雅、更高效、更 Pythonic 的代码。本文涵盖面向对象、装饰器、生成器、上下文管理器等核心进阶特性。

## 面向对象编程

### 类与对象

```python
class User:
    """用户类"""

    # 类属性（所有实例共享）
    user_count = 0

    def __init__(self, name: str, age: int):
        """初始化方法（构造函数）"""
        self.name = name    # 实例属性
        self.age = age
        User.user_count += 1

    def greet(self):
        """实例方法"""
        return f"Hi, I'm {self.name}, {self.age} years old."

    @classmethod
    def from_dict(cls, data: dict):
        """类方法：创建对象"""
        return cls(data["name"], data["age"])

    @staticmethod
    def is_adult(age: int) -> bool:
        """静态方法：无访问 self/cls"""
        return age >= 18

    def __repr__(self) -> str:
        """调试友好的字符串表示"""
        return f"User(name='{self.name}', age={self.age})"


# 使用
alice = User("Alice", 25)
bob = User.from_dict({"name": "Bob", "age": 30})

print(alice.greet())        # Hi, I'm Alice, 25 years old.
print(bob)                   # User(name='Bob', age=30)
print(User.is_adult(16))     # False
print(User.user_count)        # 2
```

### 继承与多态

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        raise NotImplementedError("子类必须实现")


class Dog(Animal):
    def speak(self):
        return f"{self.name} says Woof!"


class Cat(Animal):
    def speak(self):
        return f"{self.name} says Meow!"


animals = [Dog("Buddy"), Cat("Whiskers")]
for animal in animals:
    print(animal.speak())
# Buddy says Woof!
# Whiskers says Meow!
```

### 鸭子类型

```python
def make_it_speak(obj):
    """不检查类型，只关心是否有 speak 方法"""
    return obj.speak()


class Robot:
    def speak(self):
        return "Beep Boop!"


make_it_speak(Dog("AIBO"))    # AIBO says Woof!
make_it_speak(Robot())          # Beep Boop!
```

### 魔术方法（Dunder Methods）

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __len__(self):
        """支持 len(obj)"""
        return int((self.x ** 2 + self.y ** 2) ** 0.5)

    def __getitem__(self, index):
        """支持下标访问 v[0], v[1]"""
        if index == 0:
            return self.x
        elif index == 1:
            return self.y
        raise IndexError("Vector index out of range")


v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)       # Vector(4, 6)
print(v1 * 3)        # Vector(3, 6)
print(len(v1))        # 2（向量的模）
```
---

## 装饰器（Decorators）

### 基础装饰器

```python
import functools
import time


def timer(func):
    """测量函数执行时间"""

    @functools.wraps(func)  # 保留原函数元信息
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 耗时: {elapsed:.6f}s")
        return result

    return wrapper


@timer  # 等价于 slow = timer(slow)
def slow(n: int):
    time.sleep(n)
    return n


result = slow(1)  # slow 耗时: 1.00xxs
print(result)  # 1
```

### 带参数的装饰器

```python
def retry(max_retries=3, delay=1):
    """失败自动重试"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"第 {attempt + 1} 次失败: {e}，{delay}s后重试...")
                        time.sleep(delay)
                    else:
                        raise

        return wrapper

    return decorator


@retry(max_retries=3, delay=2)
def fetch_data(url):
    response = requests.get(url)
    response.raise_for_status()
    return response.json()
```

### 类装饰器

```python
class Counter:
    """有状态的装饰器（统计调用次数）"""

    def __init__(self, func):
        self.func = func
        self.count = 0
        functools.wraps(func)(self)

    def __call__(self, *args, **kwargs):
        self.count += 1
        print(f"{self.func.__name__} 已被调用 {self.count} 次")
        return self.func(*args, **kwargs)


@Counter
def greet(name):
    return f"Hello, {name}!"


print(greet("Alice"))  # greet 已被调用 1 次 / Hello, Alice!
print(greet("Bob"))    # greet 已被调用 2 次 / Hello, Bob!
```
---

## 生成器（Generators）

### yield 关键字

```python
def fibonacci(limit):
    """斐波那契数列（生成器版）"""
    a, b = 0, 1
    while a < limit:
        yield a
        a, b = b, a + b


# 使用：惰性计算，不占用大量内存
for num in fibonacci(100):
    print(num, end=" ")  # 0 1 1 2 3 5 8 13 21 34 55 89
```

### 对比列表与生成器

```python
def get_all_numbers(n):
    """返回列表：立即创建所有数据"""
    return [i for i in range(n)]


def get_numbers_generator(n):
    """返回生成器：按需产生数据"""
    for i in range(n):
        yield i


# 对比
nums_list = get_all_numbers(1_000_000)    # 立即占用大量内存
# nums_gen = get_numbers_generator(1_000_000) # 几乎不占内存
```

### yield from：委托生成

```python
def read_large_file(filepath, chunk_size=8192):
    """逐块读取大文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            yield chunk


def process_files(filepaths):
    """处理多个大文件"""
    for filepath in filepaths:
        yield from read_large_file(filepath)  # 委托子生成器


# 使用
for chunk in process_files(["file1.txt", "file2.txt"]):
    process(chunk)  # 逐块处理
```

### 生成器表达式

```python
# 列表推导式：立即计算
squares = [x ** 2 for x in range(1_000_000)]  # 占用大量内存

# 生成器表达式：惰性计算（注意圆括号）
squares_gen = (x ** 2 for x in range(1_000_000))  # 几乎不占内存

# 仅在需要时计算
for s in squares_gen:
    if s > 100:
        break
    print(s)
```
---

## 上下文管理器（Context Manager）

### with 语句

```python
# 自动管理资源（文件、锁、连接等）
with open("data.txt", "w", encoding="utf-8") as f:
    f.write("Hello, Python!")
# 文件自动关闭（即使发生异常）

# JavaScript 没有等价语法
```

### 自定义上下文管理器

```python
class Timer:
    """计时上下文管理器"""

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed = time.perf_counter() - self.start
        print(f"代码块耗时: {elapsed:.6f}s")
        return False  # 不吞掉异常


with Timer() as t:
    time.sleep(1)
# 输出: 代码块耗时: 1.00xxs
```

### contextlib 简化

```python
from contextlib import contextmanager


@contextmanager
def timer(name="代码块"):
    """用装饰器语法定义上下文管理器"""
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f"{name} 耗时: {elapsed:.6f}s")


with timer("数据处理"):
    process_data()
```
---

## 迭代器与可迭代对象

### 可迭代 vs 迭代器

```python
# 可迭代（iterable）：可用 for 循环遍历
numbers = [1, 2, 3]  # list 是可迭代的
for n in numbers:
    print(n)


# 迭代器（iterator）：记住当前位置，只能遍历一次
numbers_iter = iter(numbers)
print(next(numbers_iter))  # 1
print(next(numbers_iter))  # 2
print(next(numbers_iter))  # 3
# print(next(numbers_iter))  # StopIteration 异常

# 自定义迭代器
class CountDown:
    def __init__(self, start):
        self.start = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.start <= 0:
            raise StopIteration
        self.start -= 1
        return self.start + 1


for num in CountDown(5):
    print(num)  # 5 4 3 2 1
```
---

## 函数式编程工具

### map / filter / reduce

```python
from functools import reduce

numbers = [1, 2, 3, 4, 5]

# map：映射
doubled = list(map(lambda x: x * 2, numbers))
# [2, 4, 6, 8, 10]

# filter：过滤
evens = list(filter(lambda x: x % 2 == 0, numbers))
# [2, 4]

# reduce：累积
total = reduce(lambda acc, x: acc + x, numbers, 0)
# 15

# 等价于列表推导式（更 Pythonic）
doubled = [x * 2 for x in numbers]
evens = [x for x in numbers if x % 2 == 0]
```

### any / all

```python
numbers = [1, 2, 3, 4, 5]

print(any(n > 4 for n in numbers))  # True（至少一个满足）
print(all(n > 0 for n in numbers))  # True（全部满足）
```

### 迭代器组合器（itertools）

```python
import itertools

# 无限迭代器
counter = itertools.count(start=10, step=2)
print(list(itertools.islice(counter, 5)))  # [10, 12, 14, 16, 18]

# 循环迭代器
cycle = itertools.cycle("ABC")
print([next(cycle) for _ in range(7)])  # ['A', 'B', 'C', 'A', 'B', 'C', 'A']

# 排列组合
print(list(itertools.permutations("ABC", 2)))  # 排列 AB AC BA BC CA CB
print(list(itertools.combinations("ABC", 2)))  # 组合 AB AC BC
print(list(itertools.product("AB", "XY")))      # 笛卡尔积 (A,X)(A,Y)(B,X)(B,Y)
```
---

## 类型提示（Type Hints）

### 基础类型提示

```python
def greet(name: str, age: int) -> str:
    return f"Hello, {name}, you are {age}."


result: str = greet("Alice", 25)
```

### 复杂类型（typing 模块）

```python
from typing import Optional, Union, List, Dict, Tuple, Set, Any


def find_user(user_id: int) -> Optional[Dict[str, Union[str, int]]]:
    """返回字典或 None"""
    pass


def get_tags() -> List[str]:
    return ["python", "web", "fastapi"]


def get_user_scores() -> Dict[str, int]:
    return {"Alice": 95, "Bob": 87}


def get_coordinates() -> Tuple[float, float]:
    return (35.6, 139.6)
```

### 类型别名与 TypeAlias

```python
from typing import TypeAlias

UserID: TypeAlias = int
UserName: TypeAlias = str
UserMap: TypeAlias = Dict[UserID, UserName]

users: UserMap = {1: "Alice", 2: "Bob"}
```

### 运行时验证（Pydantic）

```python
from pydantic import BaseModel, EmailStr, field_validator


class User(BaseModel):
    name: str
    age: int
    email: EmailStr

    @field_validator("age")
    @classmethod
    def validate_age(cls, v):
        if v < 0 or v > 120:
            raise ValueError("年龄无效")
        return v


# 自动验证
user = User(name="Alice", age=25, email="alice@example.com")
print(user.model_dump())  # 转为字典
```
---

## 并发与异步

### 多线程（threading）

```python
import threading
import time


def download(name):
    print(f"{name} 开始下载...")
    time.sleep(2)
    print(f"{name} 下载完成")


t1 = threading.Thread(target=download, args=("file1",))
t2 = threading.Thread(target=download, args=("file2",))

t1.start()
t2.start()
t1.join()
t2.join()
print("全部下载完成")
```

### 多进程（multiprocessing）

```python
import multiprocessing


def cpu_intensive(n):
    return sum(i * i for i in range(n))


if __name__ == "__main__":
    with multiprocessing.Pool(processes=4) as pool:
        results = pool.map(cpu_intensive, [10_000_000] * 8)
        print(results)
```

### 异步编程（asyncio）

```python
import asyncio
import aiohttp


async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()


async def main():
    async with aiohttp.ClientSession() as session:
        # 并发请求
        tasks = [
            fetch(session, "https://api.github.com"),
            fetch(session, "https://api.github.com/events"),
        ]
        results = await asyncio.gather(*tasks)
        return results


# 运行
data = asyncio.run(main())
```
---

## 常用内置模块

### datetime（日期时间）

```python
from datetime import datetime, timedelta, timezone

now = datetime.now()
print(now.strftime("%Y-%m-%d %H:%M:%S"))  # 2026-05-18 11:30:00

# 时间运算
tomorrow = now + timedelta(days=1)
print(tomorrow)

# 时区
tz_cst = timezone(timedelta(hours=8))
now_cst = datetime.now(tz_cst)
```

### pathlib（路径处理）

```python
from pathlib import Path

# 路径拼接（跨平台）
base_dir = Path("/home/user")
data_file = base_dir / "data" / "file.txt"

# 创建目录
data_file.parent.mkdir(parents=True, exist_ok=True)

# 遍历文件
for py_file in Path(".").glob("**/*.py"):
    print(py_file)
```

### collections（高性能容器）

```python
from collections import defaultdict, Counter, deque

# defaultdict：访问不存在的键自动创建
word_count = defaultdict(int)
for word in ["apple", "banana", "apple"]:
    word_count[word] += 1
# {"apple": 2, "banana": 1}

# Counter：计数
counter = Counter("hello world")
print(counter.most_common(3))  # [('l', 3), ('o', 2), (' ', 1)]

# deque：双端队列
dq = deque([1, 2, 3])
dq.appendleft(0)
dq.append(4)
print(dq)  # deque([0, 1, 2, 3, 4])
```
---

## 小结

Python 进阶的核心要点：

| 特性 | 作用 | 场景 |
|------|------|------|

| 面向对象 | 封装/继承/多态/魔术方法 | 组织复杂代码 |
| 装饰器 | 横切关注点（日志/重试/计时） | 重复逻辑抽象 |
| 生成器 | 惰性计算，节省内存 | 大数据处理 |
| 上下文管理器 | 资源自动管理 | 文件/锁/连接 |
| 函数式工具 | map/filter/reduce/itertools | 数据处理 |
| 类型提示 | 代码清晰 + 工具支持 | 大型项目 |
| 并发/异步 | threading/asyncio | I/O 密集型任务 |
| 常用模块 | datetime/pathlib/collections | 标准库能力 |

下一步可以学习：Python Web 开发实战（FastAPI）、数据分析（Pandas）、爬虫（Requests + BeautifulSoup / Scrapy）。
