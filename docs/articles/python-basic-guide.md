---
title: Python 基础完全指南：从零构建坚实的编程地基
date: 2026-06-18
---

# Python 基础完全指南：从零构建坚实的编程地基

> Python 是目前最受欢迎的编程语言之一，语法简洁、生态丰富、应用广泛。本文面向零基础读者，系统覆盖 Python 环境搭建、基本语法、数据结构、函数、模块、面向对象与异常处理，帮助你建立坚实的 Python 基础。本文由小虾子  撰写

## 为什么选择 Python？

```
Python 的三大优势：
─────────────────────────────────
1. 简洁易学
   → 英语一样的语法：print("Hello World")
   → 自动内存管理，无需手动释放
   → 缩进即代码块，无需花括号

2. 应用广泛
   → Web 开发（Django、FastAPI）
   → 数据科学（pandas、numpy）
   → 人工智能（PyTorch、TensorFlow）
   → 自动化脚本、爬虫、DevOps

3. 生态丰富
   → PyPI 有 40万+ 开源包
   → 一行命令安装：pip install xxx
```

---

## 环境搭建

### 安装 Python（推荐 pyenv 管理版本）

```bash
# macOS 安装 pyenv
brew install pyenv

# 在 ~/.zshrc 中配置
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc

# 安装 Python 3.12
pyenv install 3.12.0
pyenv global 3.12.0

# 验证
python --version
# Python 3.12.0
```

### 使用 uv（最快的包管理器）

```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 创建项目（自动虚拟环境）
uv init myproject
cd myproject

# 安装依赖（比 pip 快 10-100 倍）
uv add requests
uv add "numpy>=1.26"

# 运行脚本
uv run python main.py
```

### IDE 推荐

```
VS Code + Python Extension：
  → 免费、轻量、智能提示
  → settings.json 配置：
  {
    "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python",
    "editor.formatOnSave": true,
    "python.linting.enabled": true
  }

PyCharm Community（推荐初学者）：
  → 功能全面、调试友好
  → 社区版免费

Cursor / Claude Code（AI 辅助）：
  → 智能代码补全、错误检测
```

---

## 基本语法

### 变量与数据类型

```python
# 变量：无需声明类型，Python 自动推断
name = "小虾子"          # str（字符串）
age = 25                  # int（整数）
height = 1.75            # float（浮点数）
is_active = True         # bool（布尔值）
scores = [90, 85, 78]    # list（列表，可变）
config = {"theme": "dark"}  # dict（字典）
point = (10, 20)         # tuple（元组，不可变）

# 多变量赋值
x, y, z = 1, 2, 3

# 类型注解（Python 3.5+，推荐写上）
name: str = "小虾子"
age: int = 25
scores: list[int] = [90, 85, 78]
config: dict[str, str] = {"theme": "dark"}
```

### 字符串处理

```python
# 字符串基础
name = "小虾子"
greeting = f"你好，{name}！"       # f-string（Python 3.6+）
print(greeting)  # 你好，小虾子！

# 常用操作
text = "  Python is awesome  "
text.strip()        # 去除首尾空格
text.lower()        # 转小写
text.upper()        # 转大写
text.replace("awesome", "amazing")  # 替换
text.split(",")     # 分割成列表
",".join(["a", "b", "c"])  # 用逗号连接

# 字符串切片
s = "Hello, World!"
s[0:5]      # "Hello"（索引 0-4）
s[-6:-1]    # "World"（倒数第6到倒数第1）
s[::2]      # "Hlo ol!"（步长2）
s[::-1]     # "!dlroW ,olleH"（反转）
```

### 数值运算

```python
# 基本运算
a, b = 10, 3
a + b    # 13
a - b    # 7
a * b    # 30
a / b    # 3.333...（浮点除法）
a // b   # 3（整数除法）
a % b    # 1（取余）
a ** b   # 1000（幂运算）

# 数学函数
import math
math.sqrt(16)      # 4.0（平方根）
math.ceil(3.14)    # 4.0（向上取整）
math.floor(3.14)   # 3.0（向下取整）
math.pow(2, 10)    # 1024.0（幂运算）
math.pi            # 3.141592653589793
math.e             # 2.718281828459045

# 随机数
import random
random.randint(1, 100)          # 1-100 随机整数
random.choice(["a", "b", "c"])   # 随机选择
random.shuffle([1, 2, 3, 4, 5])  # 随机打乱（原地）
```

---

## 数据结构

### 列表（List）

```python
# 创建
fruits = ["apple", "banana", "orange"]
numbers = list(range(1, 6))  # [1, 2, 3, 4, 5]

# 增删改查
fruits.append("grape")       # 末尾添加
fruits.insert(1, "mango")    # 指定位置插入
fruits.remove("banana")     # 删除第一个匹配项
popped = fruits.pop()       # 删除末尾并返回
fruits[0] = "pear"          # 修改
fruits[1:3] = ["a", "b"]    # 批量修改

# 遍历
for fruit in fruits:
    print(fruit)

for i, fruit in enumerate(fruits):
    print(f"{i}: {fruit}")

# 排序
numbers.sort()              # 原地排序
sorted_fruits = sorted(fruits, key=len, reverse=True)  # 按长度降序

# 列表推导式（Pythonic）
squares = [x**2 for x in range(1, 6)]          # [1, 4, 9, 16, 25]
evens = [x for x in range(1, 21) if x % 2 == 0] # [2, 4, 6, ..., 20]
matrix = [[i*j for j in range(1, 4)] for i in range(1, 4)]  # 3x3 矩阵
```

### 字典（Dict）

```python
# 创建
user = {
    "name": "小虾子",
    "age": 25,
    "city": "Shanghai",
}

# 安全访问
user.get("name")           # "小虾子"（不存在返回 None）
user.get("email", "N/A")    # 不存在返回默认值 "N/A"

# 增删改查
user["email"] = "xia@xia.com"  # 添加
user["age"] = 26              # 修改
del user["city"]             # 删除
popped = user.pop("age")    # 删除并返回值

# 遍历
for key in user:             # 遍历键
    print(key, user[key])

for key, value in user.items():  # 遍历键值对
    print(f"{key}: {value}")

for value in user.values():  # 遍历值
    print(value)

# 字典推导式
squares = {x: x**2 for x in range(1, 6)}
filtered = {k: v for k, v in user.items() if v != "N/A"}
```

### 集合（Set）与元组（Tuple）

```python
# 集合：无序、不重复
a = {1, 2, 3, 3, 3}  # {1, 2, 3}（自动去重）
b = {3, 4, 5}

a | b   # {1, 2, 3, 4, 5}（并集）
a & b   # {3}（交集）
a - b   # {1, 2}（差集）
a ^ b   # {1, 2, 4, 5}（对称差集）

a.add(6)     # 添加元素
a.remove(1)  # 删除（不存在会报错）
a.discard(9)  # 删除（不存在不报错）

# 元组：不可变列表（安全、内存高效）
point = (10, 20)
x, y = point  # 解包
rgb = (255, 0, 0)  # 常用于颜色、坐标

# 命名元组（更清晰）
from collections import namedtuple
Point = namedtuple('Point', ['x', 'y', 'z'])
p = Point(10, 20, 30)
print(p.x, p.y, p.z)  # 10 20 30
```

---

## 控制流

### 条件判断

```python
# 基础 if-elif-else
score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "D"

# 三元表达式
grade = "A" if score >= 90 else "B" if score >= 80 else "C"

# 多条件
age = 25
has_ticket = True
if age >= 18 and has_ticket:
    print("允许入场")

# in 操作符
fruit = "apple"
if fruit in ["apple", "banana", "orange"]:
    print("是水果")

# match-case（Python 3.10+，类似 switch）
status = "success"
match status:
    case "success":
        print("操作成功")
    case "error":
        print("操作失败")
    case "pending":
        print("处理中")
    case _:
        print("未知状态")
```

### 循环

```python
# for 循环
for i in range(5):          # 0-4
    print(i)

for i in range(1, 10, 2):    # 1, 3, 5, 7, 9（步长2）
    print(i)

# while 循环
count = 0
while count < 5:
    print(count)
    count += 1
else:
    print("循环正常结束")  # 循环不被 break 时执行

# 循环控制
for i in range(10):
    if i == 3:
        continue  # 跳过本次，继续下一轮
    if i == 7:
        break     # 跳出循环
    print(i)

# 并行遍历
names = ["Alice", "Bob", "Charlie"]
scores = [90, 85, 92]
for name, score in zip(names, scores):
    print(f"{name}: {score}")
```

---

## 函数

### 函数定义与参数

```python
# 基础函数
def greet(name: str) -> str:
    """问候函数"""
    return f"你好，{name}！"

# 默认参数
def greet(name: str, greeting: str = "你好") -> str:
    return f"{greeting}，{name}！"

# 关键字参数（顺序无关）
greet(greeting="Hello", name="World")

# 可变参数 *args **kwargs
def func(*args, **kwargs):
    print(args)   # tuple：(1, 2, 3)
    print(kwargs) # dict：{"a": 1, "b": 2}

# 参数解包
def greet(first, last):
    print(f"{first} {last}")

person = {"first": "小", "last": "虾子"}
greet(**person)  # 解包字典

# Lambda 表达式（匿名函数）
square = lambda x: x ** 2
add = lambda x, y: x + y
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
numbers.sort(key=lambda x: -x)  # 降序排序
```

### 作用域与闭包

```python
# 作用域 LEGB 规则
# Local → Enclosing → Global → Built-in

x = "global"  # 模块级全局变量

def outer():
    x = "enclosing"  # 闭包变量

    def inner():
        x = "local"  # 局部变量
        print(x)    # → local

    inner()
    print(x)        # → enclosing

# global 关键字（在函数内修改全局变量）
counter = 0
def increment():
    global counter
    counter += 1
    return counter

# nonlocal 关键字（修改闭包变量）
def outer():
    count = 0
    def inner():
        nonlocal count
        count += 1
        return count
    return inner

counter = outer()
counter()  # 1
counter()  # 2
```

---

## 模块与包

### 导入与使用

```python
# 标准库导入
import math
import random
import datetime
from datetime import datetime, timedelta  # 部分导入
from collections import defaultdict as dd  # 别名导入

# 自定义模块
# mymodule.py
PI = 3.14159
def circle_area(radius: float) -> float:
    return PI * radius ** 2

# 使用
import mymodule
mymodule.circle_area(5)

# 相对导入（包内）
from . import utils
from .submodule import helper
from .. import sibling_module
```

### 包的结构与 __init__.py

```
mypackage/
├── __init__.py      # 包初始化，可控制导出
├── module1.py       # 模块1
├── module2.py       # 模块2
└── subpackage/
    ├── __init__.py
    └── utils.py
```

```python
# __init__.py 示例
# 控制导出内容（隐藏内部实现）
from .module1 import public_function
from .module2 import PublicClass

__all__ = ["public_function", "PublicClass"]
__version__ = "1.0.0"
```

---

## 面向对象编程（OOP）

### 类与对象

```python
class Dog:
    """狗类"""

    # 类变量（所有实例共享）
    species = "哺乳动物"

    # 构造函数
    def __init__(self, name: str, age: int):
        self.name = name    # 实例变量
        self.age = age
        self._tricks = []   # 私有变量（约定）

    # 实例方法
    def bark(self) -> str:
        return f"{self.name} 在叫：汪汪！"

    def learn_trick(self, trick: str):
        self._tricks.append(trick)

    def show_tricks(self) -> list:
        return self._tricks

    # __str__ 和 __repr__
    def __str__(self):
        return f"{self.name}，{self.age}岁"

    def __repr__(self):
        return f"Dog(name={self.name!r}, age={self.age!r})"

    # 属性（@property）
    @property
    def is_puppy(self) -> bool:
        return self.age < 1

# 使用
dog = Dog("旺财", 3)
print(dog)          # 旺财，3岁
print(dog.bark())   # 旺财 在叫：汪汪！
```

### 继承与多态

```python
class Animal:
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        raise NotImplementedError("子类必须实现 speak 方法")

class Cat(Animal):
    def speak(self) -> str:
        return f"{self.name} 在叫：喵~"

class Dog(Animal):
    def speak(self) -> str:
        return f"{self.name} 在叫：汪汪！"

# 多态
animals: list[Animal] = [Cat("小白"), Dog("旺财"), Cat("咪咪")]
for animal in animals:
    print(animal.speak())

# 方法覆盖与 super()
class Child(Dog):
    def speak(self) -> str:
        parent_sound = super().speak()  # 调用父类方法
        return f"{parent_sound} + 小奶音"
```

### 特殊方法（Magic Methods）

```python
from functools import total_ordering

@total_ordering  # 只需定义 __eq__ 和一个比较方法
class Vector:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __eq__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __lt__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return (self.x ** 2 + self.y ** 2) < (other.x ** 2 + other.y ** 2)

    def __add__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return Vector(self.x + other.x, self.y + other.y)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __len__(self):
        return 2

    def __iter__(self):
        return iter([self.x, self.y])
```

---

## 异常处理

### 基础 try-except

```python
# 基础结构
try:
    result = 10 / 0
except ZeroDivisionError as e:
    print(f"除零错误：{e}")
except Exception as e:
    print(f"其他错误：{e}")
else:
    print("没有异常时执行")
finally:
    print("无论如何都执行")

# 捕获多个异常
try:
    int("abc")
    data[100]
except (ValueError, IndexError) as e:
    print(f"错误类型：{type(e).__name__}，消息：{e}")
```

### 自定义异常

```python
# 自定义异常类
class ValidationError(Exception):
    """验证错误"""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")

# 使用
def validate_age(age: int):
    if age < 0:
        raise ValidationError("age", "年龄不能为负数")
    if age > 150:
        raise ValidationError("age", "年龄超出合理范围")
    return True

try:
    validate_age(-5)
except ValidationError as e:
    print(f"验证失败：{e.field} - {e.message}")
```

---

## 文件操作

### 读写文件

```python
# 推荐方式：with 语句（自动关闭）
# 读取
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()           # 读取全部
    lines = f.readlines()         # 读取所有行
    # 逐行读取（大数据文件）
    for line in f:
        print(line.strip())

# 写入
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("Hello\n")
    f.writelines(["line1\n", "line2\n"])

# 追加
with open("log.txt", "a", encoding="utf-8") as f:
    f.write("new log entry\n")

# JSON 文件
import json
data = {"name": "小虾子", "scores": [90, 85, 78]}
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

with open("data.json", "r", encoding="utf-8") as f:
    loaded = json.load(f)

# CSV 文件
import csv
with open("users.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "age", "city"])
    writer.writeheader()
    writer.writerow({"name": "小虾子", "age": 25, "city": "Shanghai"})

with open("users.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row)
```

---

## 实用技巧

### 海象运算符（:=）（Python 3.8+）

```python
# 避免重复计算
if (n := len(data)) > 10:
    print(f"数据量大：{n} 条")

# 列表推导式中使用
[print(x) for x in (data := [1, 2, 3])]  # data 同时被赋值和使用

# while 循环
while (line := input("> ")) != "quit":
    print(line)
```

### 解包操作

```python
# 基础解包
a, *b, c = [1, 2, 3, 4, 5]  # a=1, b=[2,3,4], c=5

# 嵌套解包
(a, (b, c)), d = (1, (2, 3)), 4

# 交换变量
a, b = b, a  # 无需 temp

# * 在函数参数中
def average(*numbers):
    return sum(numbers) / len(numbers)

# 字典合并（Python 3.9+）
default = {"theme": "dark", "lang": "zh"}
user = {"lang": "en", "font": "Arial"}
merged = default | user  # {"theme": "dark", "lang": "en", "font": "Arial"}
```

### 上下文管理器

```python
# 文件操作（最常用）
with open("file.txt") as f:
    content = f.read()

# 自定义上下文管理器
class Timer:
    def __enter__(self):
        import time
        self.start = time.time()
        return self

    def __exit__(self, *args):
        import time
        elapsed = time.time() - self.start
        print(f"耗时：{elapsed:.2f}秒")

with Timer() as t:
    sum(range(10**8))

# 或者用 @contextmanager
from contextlib import contextmanager

@contextmanager
def timer():
    import time
    start = time.time()
    try:
        yield
    finally:
        print(f"耗时：{time.time() - start:.2f}秒")

with timer():
    # 耗时操作
    pass
```

---

## 总结

```
Python 基础速查：
─────────────────────────────────
变量：name = "value"  # 无需声明类型
字符串：f"{name}" / s[0:5] / s.split()
列表：[].append() / [x for x in list if x > 0]
字典：{}.get(key, default) / {k: v for k, v in d.items()}
函数：def f(x: int) -> int: ...
类：class ClassName: def __init__(self): ...
异常：try/except/finally
文件：with open() as f:
```

```
学习路径建议：
─────────────────────────────────
第一阶段：语法基础（1-2周）
  → 变量、数据类型、控制流
  → 函数、模块、基础数据结构
  → 完成 50 道 LeetCode 简单题

第二阶段：面向对象 + 实践（2-3周）
  → 类、继承、特殊方法
  → 文件操作、异常处理
  → 完成一个小项目（爬虫/CLI工具）

第三阶段：进阶技能（持续）
  → 装饰器、生成器、并发编程
  → 常用标准库（collections、itertools、functools）
  → Web 开发或数据科学方向深入
```

Python 的优雅在于"简单但不简陋"——掌握好基础，你就能写出清晰、高效的代码

本文由小虾子  撰写