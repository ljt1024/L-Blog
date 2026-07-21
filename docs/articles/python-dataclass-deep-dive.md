---
title: Python 数据类完全指南：@dataclass 从入门到精通
date: 2026-07-09
---

# Python 数据类完全指南：@dataclass 从入门到精通

> 如果你还在手写 `__init__`、`__repr__`、`__eq__`，那你需要认识一下 Python 3.7 引入的 `@dataclass`。它不仅是一个语法糖——背后是元类、描述符、装饰器的精密协作，是现代 Python 代码减少样板代码的利器。本文从原理到实战，从基础到高级用法，完整解析 dataclass 的所有细节。

本文由小虾子  撰写

## 为什么需要 dataclass？

### 传统数据类的问题

```python
# 传统的数据类：大量样板代码
class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point(x={self.x}, y={self.y})"

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))

    def distance_to(self, other):
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
print(p1)              # 需要手动实现 __repr__
print(p1 == p2)        # 需要手动实现 __eq__
print(hash(p1) == hash(p2))  # 需要手动实现 __hash__
```

### dataclass 的简洁方案

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def distance_to(self, other):
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 0.5

p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
print(p1)          # Point(x=1.0, y=2.0)  正确 自动 __repr__
print(p1 == p2)    # True                   正确 自动 __eq__
print(hash(p1) == hash(p2))  # True         正确 自动 __hash__（当所有字段可哈希时）

# dataclass 生成的代码等价于：
class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point(x={self.x!r}, y={self.y!r})"

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))
```

---

## @dataclass 的所有参数

### 参数一览

```python
from dataclasses import dataclass, field

@dataclass(
    eq=True,           # 是否生成 __eq__（基于所有字段，默认 True）
    order=False,       # 是否生成 __lt__/__le__/__gt__/__ge__（默认 False）
    frozen=False,      # 是否冻结（创建后不可修改，类似 immutables，默认 False）
    unsafe_hash=False, # 是否强制生成 __hash__（默认 False，当 frozen=True 时为 True）
    match_args=True,   # 是否生成 __match_args__（Python 3.10+，用于模式匹配）
    kw_only=False,     # 是否所有字段为 keyword-only（Python 3.10+，默认 False）
    slots=False,       # 是否使用 __slots__（Python 3.10+，减少内存占用，默认 False）
)
class Example:
    pass
```

### eq 与 order

```python
@dataclass(eq=True, order=True)
class Student:
    name: str
    score: int

s1 = Student("小虾子", 95)
s2 = Student("小虾子", 95)
s3 = Student("小明", 80)

print(s1 == s2)   # True（eq）
print(s1 < s3)    # True（order，按字段顺序比较）
print(s1 > s3)    # True
print(sorted([s3, s1, s2]))  # [Student(name='小明', score=80), Student(name='小虾子', score=95), ...]

# order=False 时比较操作会抛出 TypeError
@dataclass
class Bad:
    x: int

try:
    print(Bad(1) < Bad(2))
except TypeError as e:
    print(f"不支持比较: {e}")
```

### frozen：不可变数据类

```python
@dataclass(frozen=True)
class ImmutablePoint:
    x: float
    y: float

p = ImmutablePoint(1.0, 2.0)
p.x = 3.0  # FrozenInstanceError: cannot assign to field 'x'

# frozen=True 时自动生成 __hash__
print(hash(p))  # 正确 可哈希
print(hash(ImmutablePoint(1.0, 2.0)))  # 与 p 的 hash 相同

# 原理：frozen=True 用 __slots__ + __setattr__ 实现不可变
#        dataclass 生成的 __setattr__ 会抛出 FrozenInstanceError
```

### unsafe_hash

```python
# 问题：字段包含可变对象时，默认不生成 __hash__
@dataclass
class User:
    name: str
    friends: list[str]  # 可变对象

try:
    print(hash(User("小虾子", [])))
except TypeError as e:
    print(f"不可哈希: {e}")

# 解决方案 1：unsafe_hash=True（危险！改变哈希语义）
@dataclass(unsafe_hash=True)
class User1:
    name: str
    friends: list[str]

u = User1("小虾子", ["a", "b"])
# hash 基于对象 id？实际上 unsafe_hash 会让 hash 依赖可变对象（危险！）
# 注意 警告：不要对包含可变对象的 frozen=False dataclass 使用 unsafe_hash

# 解决方案 2：手动实现 __hash__ / 改用不可变容器
from dataclasses import dataclass
from typing import FrozenSet

@dataclass(frozen=True)
class User2:
    name: str
    friends: FrozenSet[str]  # 不可变的 frozenset

print(hash(User2("小虾子", frozenset(["a", "b"]))))  # 正确 安全

# 解决方案 3：排除可变字段
from dataclasses import field

@dataclass
class User3:
    name: str
    friends: list[str] = field(hash=False)  # 排除此字段

u = User3("小虾子", ["a"])
print(hash(u))  # 正确 只基于 name 哈希
```

### slots：内存优化

```python
# Python 3.10+：用 __slots__ 减少内存占用
@dataclass(slots=True)
class OptimizedUser:
    name: str
    email: str
    age: int

# slots=True vs slots=False 内存对比：
import sys
from dataclasses import dataclass

@dataclass
class NormalUser:
    name: str
    email: str
    age: int

@dataclass(slots=True)
class SlottedUser:
    name: str
    email: str
    age: int

normal = NormalUser("小虾子", "xia@xia.com", 25)
slotted = SlottedUser("小虾子", "xia@xia.com", 25)

print(sys.getsizeof(normal))      # 较大
print(sys.getsizeof(slotted))      # 较小

# 注意 注意：slots=True 时不能访问 __dict__
@dataclass(slots=True)
class Test:
    x: int

t = Test(1)
try:
    t.y = 2  # AttributeError: 'Test' object has no attribute 'y'
except AttributeError as e:
    print(f"slots 限制: {e}")
```

---

## field() 详解：精细控制每个字段

### field 的所有参数

```python
from dataclasses import field

@dataclass
class Config:
    # 默认值
    name: str = field(default="default_name")

    # 默认工厂（用于可变默认值）
    tags: list[str] = field(default_factory=list)  # 正确 正确：每个实例独立列表
    metadata: dict = field(default_factory=dict)
    scores: set[int] = field(default_factory=set)

    # 元数据（不影响 dataclass 行为，但可以存储自定义信息）
    description: str = field(default="", metadata={"doc": "配置名称"})

    # 哈希控制
    cache: list = field(default_factory=list, hash=False)

    # 比较控制（字段是否参与 __eq__）
    internal_id: int = field(default=0, compare=False)

    # 初始化控制（字段是否作为 __init__ 参数）
    computed_value: str = field(init=False, repr=False)
```

### 默认值陷阱与解决方案

```python
# 错误 错误：可变默认值（所有实例共享同一个列表！）
@dataclass
class BadStudent:
    name: str
    scores: list[int] = []  # 注意 所有实例共享同一个列表！

s1 = BadStudent("小虾子")
s1.scores.append(95)
s2 = BadStudent("小明")
print(s2.scores)  # [95] ← 被 s1 污染了！

# 正确 正确：使用 default_factory
@dataclass
class GoodStudent:
    name: str
    scores: list[int] = field(default_factory=list)
    tags: dict[str, str] = field(default_factory=dict)

s1 = GoodStudent("小虾子")
s1.scores.append(95)
s2 = GoodStudent("小明")
print(s2.scores)  # [] ← 独立的列表
```

### init=False 与计算字段

```python
@dataclass
class Rectangle:
    width: float
    height: float

    # 字段不在 __init__ 中，但可以在 __post_init__ 中计算
    area: float = field(init=False)
    perimeter: float = field(init=False)

    def __post_init__(self):
        self.area = self.width * self.height
        self.perimeter = 2 * (self.width + self.height)

r = Rectangle(3.0, 4.0)
print(r.area)         # 12.0 正确
print(r.perimeter)    # 14.0 正确
print(r)              # Rectangle(width=3.0, height=4.0, area=12.0, perimeter=14.0)
```

### repr=False 与 init=False

```python
@dataclass
class User:
    id: str = field(init=False, repr=False)
    name: str
    email: str
    password_hash: str = field(init=False, repr=False, compare=False)

    def __post_init__(self):
        import uuid
        import hashlib
        self.id = str(uuid.uuid4())
        self.password_hash = hashlib.sha256(b"default").hexdigest()

user = User(name="小虾子", email="xia@xia.com")
print(user)           # User(name='小虾子', email='xia@xia.com')  正确 不含敏感信息
print(user.id)        # uuid
print(user.password_hash)  # 可访问但不在 repr 中

# init=False 的字段不影响 __init__ 签名
import inspect
sig = inspect.signature(User)
print(list(sig.parameters))  # ['name', 'email']
```

---

## __post_init__：初始化钩子

### 基本用法

```python
@dataclass
class Person:
    name: str
    email: str
    age: int

    def __post_init__(self):
        # 验证
        if self.age < 0:
            raise ValueError(f"年龄不能为负数: {self.age}")
        if "@" not in self.email:
            raise ValueError(f"无效邮箱: {self.email}")

        # 自动规范化
        self.email = self.email.lower().strip()
        self.name = self.name.strip()

p = Person("  小虾子  ", "XIA@XIA.COM", 25)
print(p)           # Person(name='小虾子', email='xia@xia.com', age=25)
```

### 依赖注入与字段互引用

```python
@dataclass
class Order:
    items: list[str]
    unit_price: float
    discount_percent: float = 0.0

    total: float = field(init=False)
    discounted_total: float = field(init=False)
    tax: float = field(init=False)

    def __post_init__(self):
        subtotal = self.unit_price * len(self.items)
        discount = subtotal * self.discount_percent / 100
        self.total = subtotal
        self.discounted_total = subtotal - discount
        self.tax = self.discounted_total * 0.13

order = Order(items=["苹果", "香蕉"], unit_price=10.0, discount_percent=10)
print(order.discounted_total)  # 18.0
print(order.tax)               # 2.34
```

### 与 default_factory 组合

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class AuditLog:
    action: str
    user_id: str
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        # 规范化
        self.action = self.action.upper()
        if "source" not in self.metadata:
            self.metadata["source"] = "system"

log = AuditLog(action="user_login", user_id="u123")
print(log.created_at)  # 当前时间
print(log.metadata)   # {'source': 'system'}
```

---

## dataclass 与继承

### 基本继承

```python
@dataclass
class Animal:
    name: str
    age: int

@dataclass
class Dog(Animal):
    breed: str  # 子类新字段

dog = Dog(name="旺财", age=3, breed="金毛")
print(dog)
# Dog(name='旺财', age=3, breed='金毛')

# 父类字段 + 子类字段按顺序参与比较
d1 = Dog("旺财", 3, "金毛")
d2 = Dog("旺财", 3, "金毛")
print(d1 == d2)  # True
```

### 继承中的默认值问题

```python
# 错误 陷阱：子类新字段不能有默认值（除非父类字段也全有默认值）
@dataclass
class Parent:
    name: str

@dataclass
class Child(Parent):
    age: int = 10  # 错误 TypeError: non-default argument 'age' follows default argument

# 正确 正确：父类所有字段都有默认值，或子类新字段放在父类之前
@dataclass
class GoodParent:
    name: str = ""

@dataclass
class GoodChild(GoodParent):
    age: int = 10  # 正确 OK

# 或者父类新加字段：
@dataclass
class ParentFixed:
    id: str = field(default_factory=lambda: "unknown")

@dataclass
class ChildFixed(ParentFixed):
    name: str  # 错误 还是不行，因为 name 在继承链中不是最后一个

# 正确 完全解决方案：用 field(default=...)
@dataclass
class Parent2:
    name: str

@dataclass
class Child2(Parent2):
    age: int = 10  # 正确 OK！父类字段 name 没有默认值... 等等还是不行
```

正确理解：子类新增字段必须无默认值，**或者父类所有字段都有默认值**。

```python
# 正确 正确方案 A：父类字段全部有默认值
@dataclass
class ParentA:
    name: str = ""
    age: int = 0

@dataclass
class ChildA(ParentA):
    breed: str = "unknown"  # 正确 OK（父类全有默认值）

# 正确 正确方案 B：子类新增字段无默认值
@dataclass
class ParentB:
    name: str

@dataclass
class ChildB(ParentB):
    breed: str  # 正确 OK（子类字段无默认值）

# 正确 正确方案 C：用 field(default=...)
@dataclass
class ParentC:
    name: str

@dataclass
class ChildC(ParentC):
    age: int = field(default=10)  # 显式 default 也是默认值

c = ChildC(name="旺财")
print(c)  # ChildC(name='旺财', age=10)
```

---

## dataclasses 模块其他工具

### fields()、asdict()、astuple()

```python
from dataclasses import dataclass, fields, asdict, astuple, replace, is_dataclass

@dataclass
class Person:
    name: str
    age: int
    email: str = "unknown"

p = Person("小虾子", 25)

# fields()：获取所有字段定义
for f in fields(p):
    print(f"{f.name}: {f.type}, default={f.default}")  # Field 对象

# asdict()：转换为字典（深拷贝）
p_dict = asdict(p)
print(p_dict)  # {'name': '小虾子', 'age': 25, 'email': 'unknown'}

# astuple()：转换为元组
p_tuple = astuple(p)
print(p_tuple)  # ('小虾子', 25, 'unknown')

# replace()：创建修改后的副本（不可变风格的修改）
p2 = replace(p, age=26)
print(p2)  # Person(name='小虾子', age=26, email='unknown')
print(p)   # 原对象不变 正确

# is_dataclass()：检查是否为 dataclass
print(is_dataclass(p))  # True
print(is_dataclass("hello"))  # False
```

---

## dataclass vs attrs vs Pydantic

### 对比表

```
特性对比：
─────────────────────────────────
                    dataclass      attrs           Pydantic
标准库               正确             错误              错误
类型提示支持         正确             正确              正确
自动验证             错误             错误（需 @validate）正确
JSON序列化           错误（需手动）    错误（需添加器）    正确（内置）
不可变支持           frozen=True    @frozen         Immutable（Duck）
性能                 最快           快              中等（验证开销）
依赖                 无             attrs            pydantic
IDE支持              良好           良好             优秀

选型建议：
─────────────────────────────────
正确 dataclass：简单数据容器、标准库、无需验证的场景
正确 attrs：需要更多特性（ validators、converters）但不想加外部依赖
正确 Pydantic：API 请求/响应验证、JSON Schema 生成、复杂验证规则
```

### dataclass 与 Pydantic Model

```python
# Pydantic v2：Pydantic 是 dataclass 的超集
from pydantic import BaseModel, Field, field_validator

class UserPydantic(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., pattern=r'^[\w.-]+@[\w.-]+\.\w+$')
    age: int = Field(ge=0, le=150)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()

# 自动验证（超出 dataclass 能力）
try:
    UserPydantic(name="", email="invalid", age=-1)
except Exception as e:
    print(f"Pydantic 验证: {e}")

# dataclass：不做验证（只做类型提示）
@dataclass
class UserData:
    name: str
    email: str
    age: int

# name=""、email="invalid"、age=-1 全部接受！
# → dataclass 只存储数据，验证需要额外工具

# dataclass + TypeAdapter（Python 3.9+）
from dataclasses import dataclass
from typing import TypeAdapter, ValidationError

@dataclass
class UserDC:
    name: str
    email: str
    age: int

adapter = TypeAdapter(UserDC)
try:
    adapter.validate_python({"name": "小虾子", "email": "invalid", "age": -1})
except ValidationError as e:
    print(f"TypeAdapter 验证: {e.error_count()} 个错误")
```

### attrs 的快速参考

```python
# attrs：另一个流行的数据类库（早于 dataclass）
import attr

@attr.s(auto_attribs=True)
class UserAttrs:
    name: str
    age: int
    email: str = "unknown"

    @attr.s
    class Validator:
        @staticmethod
        def validate_email(instance, attribute, value):
            if "@" not in value:
                raise ValueError(f"{attribute.name} 必须是有效邮箱")

    validators = [Validator.validate_email]
```

---

## 实战案例

### 案例 1：API 请求/响应模型

```python
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

@dataclass
class ApiResponse:
    success: bool
    message: str
    data: Optional[dict] = None
    error_code: Optional[int] = None
    request_id: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class PaginatedResponse(ApiResponse):
    total: int = 0
    page: int = 1
    page_size: int = 20
    items: list = field(default_factory=list)

    @property
    def total_pages(self) -> int:
        return (self.total + self.page_size - 1) // self.page_size

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

response = PaginatedResponse(
    success=True,
    message="获取成功",
    data={"source": "database"},
    total=100,
    page=2,
    page_size=20,
    items=[{"id": 1}, {"id": 2}]
)
print(f"共 {response.total_pages} 页，{'有' if response.has_next else '无'}下一页")
```

### 案例 2：事件溯源（Event Sourcing）

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass(frozen=True)
class DomainEvent:
    event_id: str
    occurred_at: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict, frozen=False)

@dataclass(frozen=True)
class UserCreated(DomainEvent):
    user_id: str
    username: str
    email: str

@dataclass(frozen=True)
class UserEmailChanged(DomainEvent):
    user_id: str
    old_email: str
    new_email: str

@dataclass(frozen=True)
class UserDeactivated(DomainEvent):
    user_id: str
    reason: str

# 事件存储
class EventStore:
    def __init__(self):
        self._events: list[DomainEvent] = []

    def append(self, event: DomainEvent):
        self._events.append(event)

    def get_for(self, user_id: str) -> list[DomainEvent]:
        return [e for e in self._events if getattr(e, "user_id", None) == user_id]

store = EventStore()
store.append(UserCreated(event_id="e1", user_id="u1", username="小虾子", email="xia@xia.com"))
store.append(UserEmailChanged(event_id="e2", user_id="u1", old_email="old@old.com", new_email="xia@xia.com"))
print(store.get_for("u1"))
```

### 案例 3：命令模式

```python
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from datetime import datetime

@dataclass
class Command(ABC):
    command_id: str
    issued_by: str
    issued_at: datetime = field(default_factory=datetime.now)

@dataclass
class CreateOrderCommand(Command):
    customer_id: str
    items: list[str]
    priority: str = "normal"

@dataclass
class CancelOrderCommand(Command):
    order_id: str
    reason: str

@dataclass
class ShipOrderCommand(Command):
    order_id: str
    carrier: str
    tracking_number: str

# 命令处理器
class CommandHandler:
    def __init__(self):
        self._handlers = {
            CreateOrderCommand: self._handle_create,
            CancelOrderCommand: self._handle_cancel,
            ShipOrderCommand: self._handle_ship,
        }

    def handle(self, cmd: Command):
        handler = self._handlers[type(cmd)]
        return handler(cmd)

    def _handle_create(self, cmd: CreateOrderCommand):
        return {"order_id": f"ORD-{cmd.command_id[:8]}", "status": "created"}

    def _handle_cancel(self, cmd: CancelOrderCommand):
        return {"order_id": cmd.order_id, "status": "cancelled", "reason": cmd.reason}

    def _handle_ship(self, cmd: ShipOrderCommand):
        return {"order_id": cmd.order_id, "status": "shipped", "tracking": cmd.tracking_number}

handler = CommandHandler()
cmd = CreateOrderCommand(command_id="cmd-123", issued_by="u1", customer_id="c1", items=["书", "笔"])
result = handler.handle(cmd)
print(result)  # {'order_id': 'ORD-cmd-123', 'status': 'created'}
```

---

## 常见陷阱与最佳实践

### 陷阱 1：可变默认值

```python
# 错误 错误
@dataclass
class Bad:
    data: list = []

# 正确 正确
@dataclass
class Good:
    data: list = field(default_factory=list)
```

### 陷阱 2：frozen 与 field(hash=False) 混用

```python
@dataclass(frozen=True)
class FrozenBad:
    x: int
    y: list = field(default_factory=list, hash=False)  # 注意 frozen=True 时 hash=True 是隐式的！

f = FrozenBad(1, [])
try:
    hash(f)  # TypeError: unhashable type: 'list'
except TypeError as e:
    print(f"不可哈希: {e}")

# 正确 正确：frozen=True 时，所有字段必须是可哈希的
@dataclass(frozen=True)
class FrozenGood:
    x: int
    tags: frozenset = field(default_factory=lambda: frozenset())
```

### 陷阱 3：dataclass 不是 Python 独有的

```python
# dataclass 只是一个装饰器，不是魔法
# 理解它生成的代码，写起来更自信

# dataclass 本质：
# 1. 收集所有类型注解字段（排除 init=False）
# 2. 生成 __init__（按字段顺序，类型提示）
# 3. 生成 __repr__（包含所有字段，repr=True 时）
# 4. 生成 __eq__（逐字段比较，eq=True 时）
# 5. 生成 __hash__（当 frozen=True 或所有字段可哈希且 eq=True 且 unsafe_hash=True）
# 6. 生成 __match_args__（Python 3.10+，用于 match case）

# __post_init__ 在 __init__ 最后调用，用于验证和计算派生字段
```

---

## 总结

```
@dataclass 参数速查：
─────────────────────────────────
eq=True              自动生成 __eq__（基于所有字段）
order=False          自动生成 __lt__/__le__/__gt__/__ge__
frozen=False         不可变模式（frozen=True → 自动 __hash__）
unsafe_hash=False    强制生成 __hash__（危险慎用）
match_args=True      Python 3.10+，自动 __match_args__
kw_only=False        Python 3.10+，所有字段 keyword-only
slots=False          Python 3.10+，使用 __slots__ 减少内存
```

```
field() 参数速查：
─────────────────────────────────
default=value         字段默认值（与类属性二选一）
default_factory=list  可变默认值工厂（每次实例化一个新对象）
init=True             是否参与 __init__
repr=True             是否在 __repr__ 中显示
compare=True          是否参与 __eq__ / __hash__
hash=True/False/None  是否参与 __hash__（None=遵循 dataclass 规则）
metadata={}           元数据字典（不影响行为）
```

```
__post_init__ 使用场景：
─────────────────────────────────
正确 字段验证（检查值合法性）
正确 字段规范化（自动大小写、去空格）
正确 计算派生字段（基于已有字段计算新值）
正确 依赖注入（注入当前时间戳、UUID 等）
正确 调用其他初始化方法
```

```
选型决策树：
─────────────────────────────────
需要运行时验证？
  ↓ 是
  Pydantic / attrs + validator

只需要存储数据 + 类型提示？
  ↓ 否
  frozen=True + slots=True + __post_init__

标准库？无依赖？简单数据载体？
  → dataclass 正确

更多自定义？无外部依赖？
  → attrs 正确

API 验证？JSON Schema？复杂验证规则？
  → Pydantic 正确
```

dataclass 是 Python 标准库中最实用的功能之一——它用最少的代码实现了数据类最常见的需求。配合 `field()` 精细控制、`__post_init__` 钩子、`frozen=True` 不可变性，以及 `slots=True` 内存优化，你可以用 dataclass 构建从简单 DTO 到复杂领域模型的各类数据结构

本文由小虾子  撰写
