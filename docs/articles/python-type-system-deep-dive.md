---
title: Python 类型系统完全指南：从基础类型提示到高级泛型编程
date: 2026-07-10
---

# Python 类型系统完全指南：从基础类型提示到高级泛型编程

> Python 从"动态语言不需要类型"到"typing 是现代 Python 工程的基石"，只用了不到十年。类型提示不仅让 IDE 自动补全更准确、让重构更安全——更深刻地影响了 Python 自身的演进方向： dataclass、Protocol、Generic、TypedDict……本文从基础类型注解出发，完整覆盖 typing 模块的每一个重要特性，以及 mypy 静态检查的实战技巧。

本文由小虾子  撰写

## 类型提示的哲学：Python 为什么要加类型？

### 类型提示是什么？

```python
# Python 类型提示（Type Hints）：给变量/函数加"元信息"
# 作用：IDE 提示 / 重构安全 / 文档化 / 静态检查

# 运行时：Python 依然是一门动态语言，类型提示不影响执行！
def greet(name: str, age: int) -> str:
    return f"Hello, {name}, you are {age} years old"

# mypy 运行时会报错，但 python 解释器正常执行
greet(42, "小虾子")  # python3 正常运行，不报错

# 类型提示的正确理解：
# 1. 类型检查器（mypy / pyright）在编译期检查
# 2. Python 解释器在运行时完全忽略类型提示
# 3. __annotations__ 字典存储了类型元信息（运行时可访问）
print(greet.__annotations__)
# {'name': <class 'str'>, 'age': <class 'int'>, 'return': <class 'str'>}
```

### 基本类型注解

```python
# 变量注解
name: str = "小虾子"
age: int = 25
price: float = 99.9
is_active: bool = True
data: bytes = b"hello"
nothing: None = None

# 容器类型注解（Python 3.9+ 使用内置类型）
from __future__ import annotations  # 允许使用字符串形式的类型注解（向后兼容）

# Python 3.8 及以下（使用 typing 模块）
from typing import List, Dict, Set, Tuple
names: List[str] = ["小虾子", "小明"]
scores: Dict[str, int] = {"语文": 95, "数学": 98}
unique_ids: Set[int] = {1, 2, 3}
point: Tuple[int, int, int] = (1, 2, 3)  # 固定长度

# Python 3.9+（直接用内置类型，更简洁）
names: list[str] = ["小虾子", "小明"]
scores: dict[str, int] = {"语文": 95, "数学": 98}
unique_ids: set[int] = {1, 2, 3}
point: tuple[int, int, int] = (1, 2, 3)
```

### 函数注解

```python
from typing import Optional, Union

# 参数注解 + 返回值注解
def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("除数不能为零")
    return a / b

# Optional[X] 等价于 Union[X, None]
def find_user(user_id: int) -> Optional[dict]:
    """查找用户，未找到返回 None"""
    users = {1: {"name": "小虾子"}, 2: {"name": "小明"}}
    return users.get(user_id)

# Union：多类型
def process(value: Union[int, float, str]) -> str:
    if isinstance(value, int):
        return f"整数: {value}"
    elif isinstance(value, float):
        return f"浮点数: {value}"
    return f"字符串: {value}"

# Python 3.10+：使用 | 表示 Union（更简洁）
def find_user_v2(user_id: int) -> dict | None:
    pass

def process_v2(value: int | float | str) -> str:
    pass

# 注意：| 在 Python 3.10+ 才支持，3.9 及以下需用 Union
```

---

## typing 模块核心类型

### Any：任意类型

```python
from typing import Any

# Any：绕过所有类型检查（慎用）
def json_loads(data: Any) -> Any:
    """JSON 解析，不关心输入输出类型"""
    import json
    return json.loads(data)

result: str = json_loads('"hello"')  # 返回值是 str，但 Any 不报错
reveal_type(result)  # mypy: Revealed type is "Any"（类型信息丢失！）

# 使用原则：
# 正确 合法：与不支持类型提示的旧代码交互时
# 正确 合法：处理完全动态的数据（如 JSON）
# 错误 避免：正常代码中使用 Any（会丢失所有类型保护）
```

### Never / NoReturn：底部类型

```python
from typing import NoReturn, Never

# NoReturn：函数永不返回（用于 sys.exit 等）
import sys

def fatal(msg: str) -> NoReturn:
    print(f"Fatal: {msg}")
    sys.exit(1)

# Never（Python 3.11+）：逻辑上不可能执行到的代码
def unreachable() -> Never:
    raise AssertionError("Never reach here")

# Never 的用途：穷尽检查（exhaustive checking）
from typing import Literal

def handle_status(status: Literal["pending", "approved", "rejected"]) -> str:
    match status:
        case "pending":
            return "等待中"
        case "approved":
            return "已批准"
        case "rejected":
            return "已拒绝"
        case _:
            # 如果忘记处理新状态，Never 帮助发现
            unreachable()
```

### Literal：字面量类型

```python
from typing import Literal

# Literal：精确到值的类型（Python 3.8+）
Mode = Literal["r", "w", "a"]  # 只能是这三个字符串之一
Status = Literal[200, 201, 204]  # 只能是这三个整数之一

def open_file(path: str, mode: Mode) -> None:
    ...

open_file("a.txt", "r")    # 正确
open_file("a.txt", "x")    # 错误 mypy 报错

# 实战：Django/FastAPI HTTP 方法
HttpMethod = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]

def make_request(method: HttpMethod, url: str) -> dict:
    ...

make_request("GET", "https://api.example.com")   # 正确
make_request("TRACE", "https://api.example.com") # 错误

# Literal + 类型别名：构建安全的 API
PageSize = Literal[10, 20, 50, 100]
def fetch_page(page: int, size: PageSize = 20) -> list[dict]:
    ...
```

### TypeAlias：类型别名

```python
from typing import TypeAlias

# TypeAlias（Python 3.10+）：显式声明类型别名
Vector: TypeAlias = list[float]
Matrix: TypeAlias = list[list[float]]
JSON: TypeAlias = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None

# Python 3.9 及以下
Vector = list[float]  # 也可以直接赋值

# 类型别名的作用：
# 1. 简化复杂类型声明
# 2. 自文档化
# 3. 便于修改底层类型

def dot_product(v1: Vector, v2: Vector) -> float:
    return sum(a * b for a, b in zip(v1, v2))

result: float = dot_product([1.0, 2.0], [3.0, 4.0])
```

---

## 泛型：TypeVar、Generic、Type

### TypeVar：类型变量

```python
from typing import TypeVar

# TypeVar：创建可在多个位置使用的类型占位符
T = TypeVar("T")  # 泛型类型变量
K = TypeVar("K", bound=str)  # 有上界的类型变量
V = TypeVar("V", int, str)   # 受约束的类型变量

# 泛型函数
def first(lst: list[T]) -> T | None:
    """返回列表第一个元素，类型与列表元素一致"""
    return lst[0] if lst else None

names: list[str] = ["a", "b"]
nums: list[int] = [1, 2, 3]

reveal_type(first(names))  # mypy: Revealed type is "str | None"
reveal_type(first(nums))    # mypy: Revealed type is "int | None"
reveal_type(first([True, False]))  # mypy: Revealed type is "bool | None"

# TypeVar 约束
Number = TypeVar("Number", int, float)  # 只能是 int 或 float

def add(a: Number, b: Number) -> Number:
    return a + b

add(1, 2)      # 正确 int
add(1.5, 2.5)  # 正确 float
add(1, 2.5)    # 正确 int | float（mypy 允许同一调用中的混用）

# TypeVar 上界
Comparable = TypeVar("Comparable", bound=int | float | str)

def max_value(a: Comparable, b: Comparable) -> Comparable:
    return a if a > b else b
```

### Generic：泛型类

```python
from typing import Generic, TypeVar

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")

# 泛型容器类
class Box(Generic[T]):
    """泛型盒子"""
    def __init__(self, content: T):
        self.content = content

    def get(self) -> T:
        return self.content

    def set(self, content: T) -> None:
        self.content = content

# 使用时指定类型参数
int_box: Box[int] = Box(42)
str_box: Box[str] = Box("hello")
print(int_box.get())  # 42（类型是 int）
print(str_box.get())  # hello（类型是 str）

# 泛型字典
class KeyedBox(Generic[K, V]):
    def __init__(self, key: K, value: V):
        self.key = key
        self.value = value

    def to_tuple(self) -> tuple[K, V]:
        return (self.key, self.value)

box: KeyedBox[str, int] = KeyedBox("answer", 42)
k: str = box.key    # 正确 类型正确
v: int = box.value  # 正确 类型正确

# 多继承 Generic
class Pair(Generic[T]):
    def __init__(self, first: T, second: T):
        self.first = first
        self.second = second

    def to_list(self) -> list[T]:
        return [self.first, self.second]

p: Pair[float] = Pair(1.0, 2.0)
print(p.to_list())  # [1.0, 2.0]
```

### Type：类本身作为类型

```python
from typing import Type

# Type[T]：类本身作为值，而非实例
class Animal:
    def speak(self) -> str:
        return "..."

class Dog(Animal):
    def speak(self) -> str:
        return "汪汪"

class Cat(Animal):
    def speak(self) -> str:
        return "喵喵"

# 错误 错误：Class 是 Animal 的实例类型，不是类本身
def create_animal(Class: Animal) -> Animal:
    return Class()  # 错误 mypy 报错：需要 Animal 实例

# 正确 正确：使用 Type[Animal]
def create_animal(Class: Type[Animal]) -> Animal:
    return Class()  # 正确 调用类本身创建实例

dog = create_animal(Dog)
print(dog.speak())  # 汪汪

# Type 与泛型结合：工厂函数
T = TypeVar("T", bound=Animal)

def register_and_create(cls: Type[T]) -> T:
    """注册并创建实例"""
    registry.append(cls)
    return cls()

# TypeVar 上界约束
def instantiate(cls: Type[Animal]) -> Animal:
    return cls()
```

---

## Protocol：结构化子类型（静态 duck typing）

### Protocol 的核心思想

```python
from typing import Protocol, runtime_checkable

# Protocol = 静态 duck typing
# "如果你走起来像鸭子、叫起来像鸭子，你就是鸭子"
# 但在类型检查时，不需要显式继承！

class Drawable(Protocol):
    """可绘制的接口"""
    def draw(self) -> None: ...

    @property
    def width(self) -> int: ...

    @property
    def height(self) -> int: ...

# 定义：任何实现了 draw()/width/height 的类都满足 Drawable
class Circle:
    def __init__(self, radius: int):
        self.radius = radius

    def draw(self) -> None:
        print(f"画圆，半径={self.radius}")

    @property
    def width(self) -> int:
        return self.radius * 2

    @property
    def height(self) -> int:
        return self.radius * 2

class Rectangle:
    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h

    def draw(self) -> None:
        print(f"画矩形 {self.w}x{self.h}")

    @property
    def width(self) -> int:
        return self.w

    @property
    def height(self) -> int:
        return self.h

# 函数接受 Drawable：不需要显式继承 Circle/Rectangle！
def render_all(items: list[Drawable]) -> None:
    for item in items:
        item.draw()
        print(f"  尺寸: {item.width}x{item.height}")

# Circle 和 Rectangle 都满足 Drawable，但它们没有继承任何东西！
render_all([Circle(10), Rectangle(20, 30)])  # 正确 mypy 通过
```

### runtime_checkable Protocol

```python
from typing import Protocol, runtime_checkable, TypeGuard

# Protocol 默认只在静态检查时生效（mypy/pyright）
# @runtime_checkable 可以在运行时 isinstance() 检查

@runtime_checkable
class Serializable(Protocol):
    def to_json(self) -> str: ...

class User:
    def __init__(self, name: str):
        self.name = name

    def to_json(self) -> str:
        return f'{{"name": "{self.name}"}}'

user = User("小虾子")
print(isinstance(user, Serializable))  # True 正确（runtime_checkable 生效）

# 如果 User 没有 to_json 方法
class BadUser:
    pass

bad = BadUser()
print(isinstance(bad, Serializable))  # False 正确

# 注意：runtime_checkable 有性能开销，只在需要 isinstance() 时使用
```

### Protocol 的高级用法

```python
# 泛型 Protocol
from typing import Generic, TypeVar, Protocol as Proto, Callable

T = TypeVar("T")
R = TypeVar("R")

class Transformer(Proto, Generic[T, R]):
    """转换器协议"""
    def transform(self, input: T) -> R: ...

class StringToInt:
    def transform(self, input: str) -> int:
        return len(input)

class IntToBool:
    def transform(self, input: int) -> bool:
        return input > 0

def apply_transform(transformer: Transformer[T, R], value: T) -> R:
    return transformer.transform(value)

print(apply_transform(StringToInt(), "hello"))  # 5（str → int）
print(apply_transform(IntToBool(), 42))          # True（int → bool）

# Callable 协议：函数参数化
class AsyncHandler(Proto):
    """异步处理器协议"""
    async def __call__(self, event: dict) -> None: ...

# 可选方法
class PartialHandler(Proto):
    def required_method(self) -> str: ...
    def optional_method(self) -> int: ...  # 如果不实现也可以
```

---

## TypedDict：类型化字典

### 基本用法

```python
from typing import TypedDict, NotRequired, Required

# TypedDict：类型化字典，字段有名称和类型
class User(TypedDict):
    id: int
    name: str
    email: str
    age: int

# 使用
user: User = {"id": 1, "name": "小虾子", "email": "xia@xia.com", "age": 25}
name: str = user["name"]  # 正确 字段类型已检查

# 错误 错误：mypy 检测类型不匹配
bad_user: User = {"id": "1", "name": 123}  # 错误 id 必须是 int，name 必须是 str

# NotRequired：可选字段（可不提供）
class Config(TypedDict, total=True):
    host: Required[str]           # 必填
    port: Required[int]           # 必填
    debug: NotRequired[bool]      # 可选
    timeout: NotRequired[int]      # 可选

def load_config() -> Config:
    return {
        "host": "localhost",
        "port": 8080,
        # debug 和 timeout 可省略
    }
```

### TypedDict 继承与合并

```python
from typing import TypedDict, NotRequired

# TypedDict 可以继承
class Animal(TypedDict):
    name: str
    age: int

class Dog(Animal):
    breed: str  # 新增字段

dog: Dog = {"name": "旺财", "age": 3, "breed": "金毛"}  # 正确

# 合并多个 TypedDict
class Address(TypedDict):
    city: str
    street: str

class Contact(TypedDict):
    email: str
    phone: str

# 方式 1：类继承（多重继承）
class UserProfile(Address, Contact):
    name: str

profile: UserProfile = {
    "name": "小虾子",
    "city": "北京",
    "street": "中关村大街1号",
    "email": "xia@xia.com",
    "phone": "13800138000",
}

# 方式 2：使用类型别名
UserProfile2: type = Address | Contact  # TypedDict 不支持 | 操作符
# Python 3.12+ 支持类型别名中使用 TypedDict 合并
```

### TypedDict 在 FastAPI/Pydantic 中的应用

```python
# FastAPI 的 Request Model 用 TypedDict
from typing import TypedDict

class CreateUserRequest(TypedDict):
    username: str
    email: str
    password: str

class UpdateUserRequest(TypedDict, total=False):
    username: str
    email: str
    bio: str

async def create_user(body: CreateUserRequest) -> dict:
    # body 已经被 FastAPI 验证为 CreateUserRequest 结构
    user = await db.users.create(**body)
    return {"id": user.id}

async def update_user(user_id: int, body: UpdateUserRequest) -> dict:
    # body 中只有提供的字段
    updates = {k: v for k, v in body.items() if v is not None}
    await db.users.update(user_id, **updates)
    return {"status": "updated"}

# 注意：FastAPI/Pydantic 实际用 Pydantic Model 做验证
# TypedDict 主要用于静态类型检查 + 文档化
```

---

## 高级类型：@overload 与 TypeGuard

### @overload：函数重载

```python
from typing import overload, Union

# @overload：声明多个函数签名（静态类型用）
@overload
def parse(value: str) -> list[str]: ...
@overload
def parse(value: bytes) -> list[bytes]: ...
@overload
def parse(value: None) -> None: ...

def parse(value: str | bytes | None) -> list[str] | list[bytes] | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value.split()
    return value.split()

# mypy 的好处：知道返回值类型
result: list[str] = parse("hello world")  # 正确
result2: list[bytes] = parse(b"a b c")    # 正确
result3: None = parse(None)                # 正确

# @overload 的典型应用：返回类型取决于参数类型
@overload
def find_user(id: int) -> "User": ...
@overload
def find_user(name: str) -> list["User"]: ...

def find_user(id_or_name: int | str) -> "User" | list["User"]:
    if isinstance(id_or_name, int):
        return User(id=id_or_name)  # 返回单个用户
    return User.find_by_name(id_or_name)  # 返回用户列表
```

### TypeGuard：类型守卫

```python
from typing import TypeGuard

# TypeGuard：告诉类型检查器某个条件缩小了类型范围
def is_string_list(value: list[object]) -> TypeGuard[list[str]]:
    """如果所有元素都是字符串，返回 True"""
    return all(isinstance(x, str) for x in value)

def process(value: list[object]) -> None:
    if is_string_list(value):
        # mypy 知道 value 现在是 list[str]！
        print(value[0].upper())  # 正确 str 有 upper()
        reveal_type(value)        # mypy: Revealed type is "list[str]"
    else:
        reveal_type(value)        # mypy: Revealed type is "list[object]"

# TypeGuard vs TypeGuard[list[str]] 的区别
# TypeGuard[X]：函数返回 True → 参数类型缩小为 X
# TypeGuard[list[str]]：函数返回 True → 参数类型缩小为 list[str]

# TypeGuard 的本质：条件分支中的类型收窄
def is_dict(value: object) -> TypeGuard[dict]:
    return isinstance(value, dict)

def handle(obj: object) -> None:
    if is_dict(obj):
        reveal_type(obj)  # mypy: dict
        print(obj.keys())  # 正确
```

---

## mypy 实战：从入门到CI集成

### 基础配置

```toml
# pyproject.toml（PEP 517/518 现代标准）
[project]
name = "my-project"
version = "0.1.0"
requires-python = ">=3.10"

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true      # 不允许无类型注解
disallow_incomplete_defs = true    # 不允许不完整的类型注解
check_untyped_defs = true         # 检查所有函数
no_implicit_optional = true       # 不允许隐式 Optional
warn_redundant_casts = true       # 警告冗余的类型转换
strict_equality = true            # 严格相等检查
disallow_any_generics = false      # 允许泛型 Any

[[tool.mypy.overrides]]
module = "pandas.*"
ignore_missing_imports = true     # 第三方库可忽略类型

[[tool.mypy.overrides]]
module = "numpy.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "torch.*"
ignore_missing_imports = true
```

### 常见错误与修复

```python
# 错误 1：Any 返回值
# 错误
def read_file(path: str) -> Any:
    with open(path) as f:
        return json.load(f)

# 正确
from typing import Any
def read_file(path: str) -> Any:  # 如果真的无法确定返回类型
    ...

# 错误 2：隐式 Optional
# 错误
def find(key: str) -> dict:  # 如果找不到返回 None
    ...

# 正确
from typing import Optional
def find(key: str) -> Optional[dict]:  # 或 dict | None (Python 3.10+)
    ...

# 错误 3：类型与注解不匹配
x: int = "hello"  # 错误 mypy 报错

# 错误 4：Protocol 实现遗漏方法
from typing import Protocol

class Handler(Protocol):
    def handle(self) -> None: ...

class BadHandler:
    def process(self) -> None: ...  # 错误 缺少 handle

# 正确 正确实现
class GoodHandler:
    def handle(self) -> None:
        print("handled")

# 错误 5：泛型参数不指定
def identity(x: T) -> T:  # 错误 T 未定义
    return x

from typing import TypeVar
T = TypeVar("T")
def identity(x: T) -> T:  # 正确
    return x
```

### CI 集成

```yaml
# .github/workflows/type-check.yml
name: Type Check

on: [push, pull_request]

jobs:
  mypy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install mypy
      - run: mypy src/ --strict

# 本地运行
# pip install mypy
# mypy src/  # 检查 src/ 目录
# mypy src/ --strict  # 严格模式
# mypy src/ --ignore-missing-imports  # 忽略第三方库

# pre-commit hook
# .pre-commit-config.yaml
# repos:
#   - repo: https://github.com/pre-commit/mirrors-mypy
#     rev: v1.7.0
#     hooks:
#       - id: mypy
#         args: [--ignore-missing-imports]
```

---

## pyright（PyLance）vs mypy

```
对比表：
─────────────────────────────────
特性                 mypy              pyright (PyLance)
语言                 Python            Python
实现                 Python (编译)      TypeScript
速度                 中等              快（用 Node.js）
微软支持              错误               正确（VS Code 内置）
默认严格程度           较宽松            较严格
Protocol 支持         正确               正确（更完善）
TypedDict 支持       正确               正确
泛型支持              正确               正确（更标准）
渐进步骤              正确（--strict-flags）错误（配置文件切换）
流行度                高（标准库）       高（VS Code 默认）
虚拟环境支持           需要配置          自动检测

推荐：
─────────────────────────────────
正确 VS Code 用户：直接用 Pyright（内置，无需配置）
正确 独立工具 + CI：mypy（社区标准，广泛支持）
正确 严格类型项目：pyright --strict
正确 兼容旧代码：mypy --ignore-missing-imports
```

---

## 常见陷阱与最佳实践

### 陷阱 1：类型注解 vs 类型转换

```python
# 错误 陷阱：类型注解不进行运行时转换
user_id: int = input("ID: ")  # input 返回 str，mypy 报错！

# 正确 正确：显式转换
user_id: int = int(input("ID: "))

# 错误 陷阱：注解了 str，运行时仍是其他类型
x: str = "123"  # str 类型
y: int = x  # 错误 mypy 报错：str 不是 int
z: int = int(x)  # 正确 显式转换
```

### 陷阱 2：泛型 Any

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class Container(Generic[T]):
    def __init__(self, value: T):
        self.value = value

    def get(self) -> T:
        return self.value

# 错误 陷阱：丢失泛型信息
c: Container = Container(42)  # Container[Any]！没有指定 T

# 正确 正确：指定类型参数
c: Container[int] = Container(42)
```

### 陷阱 3：TypedDict 与 dict 的混淆

```python
from typing import TypedDict

class Config(TypedDict):
    port: int

config: Config = {"port": 8080}
config2: dict = {"port": 8080}

# config 和 config2 类型不同，但值相同
# 错误 TypedDict 实例不能直接赋值给 dict
def process(data: dict) -> None:
    ...

process(config)  # 错误 mypy 报错：TypedDict 到 dict 不是安全的赋值

# 正确 正确：使用 dict[str, int] 代替
ConfigDict: type = dict[str, int]
config3: ConfigDict = {"port": 8080}
process(config3)  # 正确

# 或在函数签名中使用 TypedDict
def process(data: Config) -> None:
    ...
```

---

## 总结

```
类型提示速查表：
─────────────────────────────────
基础类型：str, int, float, bool, bytes, None
容器：list[T], dict[K,V], set[T], tuple[T,...]
Optional[X]：X | None
Union[X,Y]：X | Y（Python 3.10+）
Literal["a","b"]：精确字面量值
Any：绕过所有类型检查
Never / NoReturn：永不返回的函数
Type[T]：类本身（而非实例）
ClassVar[T]：类变量（非实例变量）
```

```
泛型速查：
─────────────────────────────────
TypeVar：泛型类型变量
Generic[T]：泛型类定义
Protocol：静态 duck typing（结构化子类型）
@runtime_checkable：运行时 isinstance() 支持
TypedDict：类型化字典（字段有名有类型）
@overload：函数签名重载声明
TypeGuard：条件类型收窄
```

```
类型守卫速查：
─────────────────────────────────
isinstance(x, T)：运行时检查
TypeGuard[X]：条件成立时类型收窄为 X
Union 类型收窄：if isinstance(x, int | float)
Literal 收窄：match value: case "ok": → value = Literal["ok"]
```

```
选型建议：
─────────────────────────────────
正确 Protocol：用接口协议替代 ABC（静态 duck typing）
正确 TypedDict：结构化字典（API 请求/响应）
正确 TypeVar + Generic：泛型容器和工具函数
正确 Literal：枚举值的精确类型
正确 @overload：多签名函数
正确 TypeGuard：复杂条件类型收窄
正确 mypy / pyright：CI 中的静态类型检查
```

类型提示是 Python 工程化的重要里程碑——它让动态语言拥有了静态检查的能力，让 IDE 拥有了精确的自动补全，让重构拥有了安全保障。掌握 Protocol 的结构化子类型、泛型的 TypeVar 与 Generic、TypedDict 的结构化字典，以及 mypy 的实战配置，你就拥有了现代 Python 工程的核心竞争力

本文由小虾子  撰写
