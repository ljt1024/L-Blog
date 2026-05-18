# Python 基础语法

Python 是一门简洁优雅的编程语言，以"显式优于隐式、简单优于复杂"为设计哲学。本文将系统介绍 Python 的基础语法，帮助初学者快速上手。

## 安装与环境

### 安装 Python

访问 [Python 官网](https://www.python.org/) 下载安装最新版本（推荐 3.12+）。

```bash
# 验证安装
python3 --version

# 推荐使用 uv 管理环境（Rust 编写，极快）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 创建虚拟环境
uv venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# 安装包
uv add requests
```

### 第一个 Python 程序

```python
# hello.py
print("Hello, Python!")  # 输出

# Python 用缩进表示代码块，不需要花括号
if True:
    print("缩进就是作用域")
```

```bash
python3 hello.py
# 输出: Hello, Python!
#       缩进就是作用域
```

## 变量与数据类型

### 基本数据类型

```python
# 数字
age = 25              # int 整数
price = 9.99          # float 浮点数
complex_num = 3 + 4j  # complex 复数

# 大整数（Python 原生支持，不会溢出）
big = 10 ** 100
print(big)  # 1后面100个0

# 字符串
name = "Alice"
greeting = f"Hello, {name}!"  # f-string 格式化（推荐）
raw = r"C:\Users\path"        # 原始字符串，不转义

# 布尔值
is_student = True   # 注意大写
is_graduated = False

# 空值
result = None

# 类型检查
print(type(age))     # <class 'int'>
print(type(name))    # <class 'str'>
```

### 类型转换

```python
# 显式转换
x = int("42")        # 字符串 → 整数
y = float("3.14")    # 字符串 → 浮点数
z = str(100)         # 整数 → 字符串
w = bool(0)          # 0 → False, 非0 → True

# 隐式转换
result = 1 + 2.0     # int + float → float (3.0)
```

### 字符串操作

```python
s = "Hello, Python!"

# 索引与切片
print(s[0])       # 'H'
print(s[-1])      # '!'
print(s[0:5])     # 'Hello'
print(s[7:])      # 'Python!'
print(s[::-1])    # '!nohtyP ,olleH' 反转

# 常用方法
print(s.lower())          # 'hello, python!'
print(s.upper())          # 'HELLO, PYTHON!'
print(s.replace("Python", "World"))  # 'Hello, World!'
print(s.split(", "))      # ['Hello', 'Python!']
print(",".join(["a","b","c"]))       # 'a,b,c'
print(s.strip())          # 去除首尾空白
print(len(s))             # 13

# f-string 格式化（Python 3.6+）
name = "Alice"
age = 25
print(f"{name} is {age} years old")
print(f"{'centered':^20}")       # 居中对齐，宽度20
print(f"{3.14159:.2f}")          # 3.14
print(f"{255:#x}")               # 0xff 十六进制
```

## 运算符

```python
# 算术运算符
print(10 + 3)    # 13 加
print(10 - 3)    # 7  减
print(10 * 3)    # 30 乘
print(10 / 3)    # 3.333... 除（总是返回 float）
print(10 // 3)   # 3   整除
print(10 % 3)    # 1   取模
print(2 ** 10)   # 1024 幂运算

# 比较运算符
print(1 == 1)    # True  等于
print(1 != 2)    # True  不等于
print(1 < 2)     # True
print(1 >= 1)    # True

# 逻辑运算符
print(True and False)   # False
print(True or False)    # True
print(not True)         # False

# 身份运算符（比较内存地址）
a = [1, 2]
b = [1, 2]
c = a
print(a == b)    # True  值相等
print(a is b)    # False 不是同一个对象
print(a is c)    # True  同一个对象

# 成员运算符
print(1 in [1, 2, 3])       # True
print(4 not in [1, 2, 3])   # True
```

## 数据结构

### 列表（List）

```python
# 创建列表
fruits = ["apple", "banana", "cherry"]
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", True, 3.14]  # 可以混合类型

# 访问元素
print(fruits[0])    # 'apple'
print(fruits[-1])   # 'cherry'

# 切片
print(numbers[1:4])  # [2, 3, 4]
print(numbers[::2])  # [1, 3, 5] 步长2

# 修改
fruits[0] = "orange"     # 修改元素
fruits.append("grape")   # 末尾添加
fruits.insert(1, "kiwi") # 指定位置插入
fruits.remove("banana")  # 按值删除
last = fruits.pop()      # 弹出末尾元素

# 常用操作
print(len(fruits))               # 长度
print(sorted(fruits))            # 排序（返回新列表）
fruits.sort()                    # 原地排序
fruits.reverse()                 # 原地反转
print("orange" in fruits)        # 成员检查

# 列表推导式
squares = [x ** 2 for x in range(10)]
# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

evens = [x for x in range(20) if x % 2 == 0]
# [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]

# 嵌套推导式
matrix = [[1,2,3],[4,5,6],[7,8,9]]
flat = [x for row in matrix for x in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

### 元组（Tuple）

```python
# 元组：不可变列表
point = (3, 4)
rgb = (255, 128, 0)
single = (42,)   # 单元素元组必须加逗号

# 解包
x, y = point
r, g, b = rgb

# 扩展解包
first, *rest = [1, 2, 3, 4, 5]
print(first)  # 1
print(rest)   # [2, 3, 4, 5]

# 元组作为字典的键（列表不行）
location = {(35.6, 139.6): "Tokyo"}
```

### 字典（Dict）

```python
# 创建字典
user = {
    "name": "Alice",
    "age": 25,
    "email": "alice@example.com",
}

# 访问
print(user["name"])           # 'Alice'
print(user.get("phone", "N/A"))  # 'N/A' 安全访问

# 修改
user["age"] = 26              # 修改
user["phone"] = "123-4567"    # 新增
del user["email"]             # 删除
age = user.pop("age")         # 弹出

# 遍历
for key in user:              # 遍历键
    print(key)

for key, value in user.items():  # 遍历键值对
    print(f"{key}: {value}")

for value in user.values():   # 遍历值
    print(value)

# 字典推导式
word_lengths = {w: len(w) for w in ["hello", "world", "python"]}
# {"hello": 5, "world": 5, "python": 6}

# 合并字典（Python 3.9+）
defaults = {"theme": "dark", "lang": "zh"}
custom = {"lang": "en", "font": "mono"}
merged = defaults | custom  # {"theme": "dark", "lang": "en", "font": "mono"}
```

### 集合（Set）

```python
# 创建集合
colors = {"red", "green", "blue"}
nums = set([1, 2, 2, 3, 3])  # {1, 2, 3} 去重

# 操作
colors.add("yellow")
colors.remove("red")     # 不存在会报错
colors.discard("pink")   # 不存在不报错

# 集合运算
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
print(a | b)    # {1, 2, 3, 4, 5, 6} 并集
print(a & b)    # {3, 4} 交集
print(a - b)    # {1, 2} 差集
print(a ^ b)    # {1, 2, 5, 6} 对称差集

# 去重实战
data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
unique = list(set(data))  # [1, 2, 3, 4, 5, 6, 9]
```

## 控制流

### 条件语句

```python
# if / elif / else
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "D"

print(f"成绩: {grade}")  # 成绩: B

# 三元表达式
status = "成年" if age >= 18 else "未成年"

# match 语句（Python 3.10+）
def http_status(code):
    match code:
        case 200:
            return "OK"
        case 301:
            return "Moved Permanently"
        case 404:
            return "Not Found"
        case 500:
            return "Internal Server Error"
        case _:
            return "Unknown"
```

### 循环

```python
# for 循环
for i in range(5):
    print(i)  # 0 1 2 3 4

for i in range(1, 10, 2):
    print(i)  # 1 3 5 7 9

# 遍历列表
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(fruit)

# 带索引遍历
for index, fruit in enumerate(fruits):
    print(f"{index}: {fruit}")

# 同时遍历多个列表
names = ["Alice", "Bob"]
ages = [25, 30]
for name, age in zip(names, ages):
    print(f"{name}: {age}")

# while 循环
count = 0
while count < 5:
    print(count)
    count += 1

# break 和 continue
for n in range(10):
    if n == 3:
        continue  # 跳过3
    if n == 7:
        break     # 到7停止
    print(n)  # 0 1 2 4 5 6

# for-else：循环正常结束执行 else
for n in range(2, 10):
    for i in range(2, n):
        if n % i == 0:
            break
    else:
        print(f"{n} 是素数")
```

## 函数

### 基本函数

```python
# 定义函数
def greet(name):
    return f"Hello, {name}!"

# 调用
message = greet("Alice")
print(message)  # Hello, Alice!

# 默认参数
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Alice"))              # Hello, Alice!
print(greet("Bob", "Hi"))          # Hi, Bob!

# 关键字参数
def create_user(name, age, email=""):
    return {"name": name, "age": age, "email": email}

user = create_user(name="Alice", age=25, email="a@b.com")
user = create_user(age=30, name="Bob")  # 顺序无关

# 可变参数
def sum_all(*args):         # 任意数量位置参数
    return sum(args)

print(sum_all(1, 2, 3))     # 6
print(sum_all(1, 2, 3, 4))  # 10

def print_info(**kwargs):   # 任意数量关键字参数
    for key, value in kwargs.items():
        print(f"{key}: {value}")

print_info(name="Alice", age=25)
# name: Alice
# age: 25
```

### 返回值与多返回值

```python
# 返回多个值（元组）
def divide(a, b):
    quotient = a // b
    remainder = a % b
    return quotient, remainder

q, r = divide(17, 5)
print(q, r)  # 3 2

# 返回字典
def get_user_info(user_id):
    return {
        "id": user_id,
        "name": "Alice",
        "active": True,
    }
```

### Lambda 与高阶函数

```python
# Lambda 表达式（匿名函数）
square = lambda x: x ** 2
print(square(5))  # 25

add = lambda a, b: a + b
print(add(3, 4))  # 7

# 高阶函数
numbers = [1, 2, 3, 4, 5]

# map：映射
doubled = list(map(lambda x: x * 2, numbers))
# [2, 4, 6, 8, 10]

# filter：过滤
evens = list(filter(lambda x: x % 2 == 0, numbers))
# [2, 4]

# sorted：排序
users = [{"name": "Bob", "age": 30}, {"name": "Alice", "age": 25}]
sorted_users = sorted(users, key=lambda u: u["age"])
# [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 30}]

# reduce：累积
from functools import reduce
total = reduce(lambda acc, x: acc + x, numbers, 0)
# 15
```

## 文件操作

```python
# 读取文件
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()          # 读取全部
    # lines = f.readlines()    # 读取所有行到列表
    # line = f.readline()      # 读取一行

# 逐行读取（内存友好）
with open("data.txt", "r", encoding="utf-8") as f:
    for line in f:
        print(line.strip())

# 写入文件
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("Hello, Python!\n")
    f.writelines(["Line 1\n", "Line 2\n"])

# 追加
with open("output.txt", "a", encoding="utf-8") as f:
    f.write("Appended line\n")

# JSON 文件
import json

data = {"name": "Alice", "scores": [90, 85, 92]}

# 写入 JSON
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 读取 JSON
with open("data.json", "r", encoding="utf-8") as f:
    loaded = json.load(f)

# CSV 文件
import csv

with open("data.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["name"], row["age"])
```

## 异常处理

```python
# try / except
try:
    result = 10 / 0
except ZeroDivisionError:
    print("不能除以零！")

# 捕获多种异常
try:
    value = int("abc")
except ValueError as e:
    print(f"值错误: {e}")
except TypeError as e:
    print(f"类型错误: {e}")

# try / except / else / finally
try:
    result = 10 / 2
except ZeroDivisionError:
    print("出错了")
else:
    print(f"结果是 {result}")  # 没有异常时执行
finally:
    print("无论如何都执行")    # 总是执行

# 抛出异常
def validate_age(age):
    if age < 0 or age > 150:
        raise ValueError(f"无效的年龄: {age}")
    return age

# 自定义异常
class AppError(Exception):
    """应用基础异常"""
    pass

class NotFoundError(AppError):
    """资源未找到"""
    pass

class AuthError(AppError):
    """认证失败"""
    pass

try:
    raise NotFoundError("用户不存在")
except AppError as e:
    print(f"应用错误: {e}")
```

## 模块与包

```python
# 导入模块
import math
print(math.sqrt(16))    # 4.0
print(math.pi)          # 3.141592653589793

# 导入特定功能
from datetime import datetime, timedelta
now = datetime.now()
tomorrow = now + timedelta(days=1)

# 别名导入
import numpy as np
import pandas as pd
from collections import defaultdict as DD

# 导入所有（不推荐）
# from module import *

# 相对导入（在包内部）
# from . import sibling_module
# from .. import parent_module
```

### 创建自己的模块

```python
# my_utils.py
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b

PI = 3.14159

# 在其他文件中使用
# from my_utils import add, PI
# result = add(1, 2)
```

## 常用内置函数

```python
# 类型转换
int("42")        # 42
float("3.14")    # 3.14
str(100)         # "100"
list("abc")      # ['a', 'b', 'c']
tuple([1,2,3])   # (1, 2, 3)
set([1,1,2])     # {1, 2}
dict(a=1, b=2)   # {'a': 1, 'b': 2}

# 数学相关
abs(-5)          # 5 绝对值
round(3.14159, 2)  # 3.14 四舍五入
max(1, 5, 3)     # 5
min(1, 5, 3)     # 1
sum([1, 2, 3])   # 6
pow(2, 10)       # 1024

# 序列操作
len([1,2,3])     # 3
sorted([3,1,2])  # [1, 2, 3]
reversed([1,2,3])# <reversed object>
enumerate(["a","b"])  # (0,'a'), (1,'b')
zip([1,2], ['a','b']) # (1,'a'), (2,'b')

# 类型检查
isinstance(42, int)    # True
isinstance("hi", (int, str))  # True
type(42)               # <class 'int'>

# 其他
range(5)          # 0,1,2,3,4
id(obj)           # 对象内存地址
hash("hello")     # 哈希值
dir(str)          # 查看对象所有属性和方法
help(len)         # 查看帮助文档
```

## 小结

Python 基础语法的核心要点：

| 概念 | 关键点 |
|------|--------|
| 变量 | 动态类型，无需声明类型 |
| 字符串 | f-string 格式化，丰富的方法 |
| 列表 | 可变序列，推导式是精髓 |
| 元组 | 不可变，适合固定数据 |
| 字典 | 键值对，3.9+ 支持合并运算符 |
| 集合 | 去重与集合运算 |
| 函数 | 默认参数、可变参数、多返回值 |
| 文件 | with 语句自动管理资源 |
| 异常 | try/except/else/finally |
| 模块 | import 导入，包用 `__init__.py` |

下一步：学习 Python 进阶——面向对象、装饰器、生成器等高级特性。
