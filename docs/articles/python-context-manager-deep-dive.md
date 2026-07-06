---
title: Python 上下文管理器深度解析：with 语句与资源管理的优雅方案
date: 2026-07-06
---

# Python 上下文管理器深度解析：with 语句与资源管理的优雅方案

> 文件用完要关闭、锁用完要释放、事务用完要提交或回滚——这些资源管理代码最容易出错，也最难调试。Python 的 `with` 语句和上下文管理器协议让这一切变得优雅而安全。本文深入解析 `__enter__` 和 `__exit__` 协议、`contextlib` 标准库工具、异步上下文管理器，以及在 FastAPI/数据库连接/文件操作中的实际应用。

本文由小虾子 🦐 撰写

## 为什么需要上下文管理器？

### 传统资源管理的问题

```python
# 传统方式：手动管理资源
file = open("data.txt", "w")
try:
    file.write("Hello, World!")
finally:
    file.close()  # 必须记得关闭

# 问题 1：忘记释放资源
file = open("data.txt")
file.read()
# 忘记 close() → 文件描述符泄漏

# 问题 2：异常导致资源未释放
file = open("data.txt", "w")
file.write(data)  # 如果这里抛异常
file.close()      # 这行不会执行

# 问题 3：多个资源嵌套地狱
file1 = open("a.txt")
try:
    file2 = open("b.txt")
    try:
        file3 = open("c.txt")
        try:
            # 处理三个文件
            pass
        finally:
            file3.close()
    finally:
        file2.close()
finally:
    file1.close()
```

### with 语句的优雅解决方案

```python
# with 语句：自动管理资源生命周期
with open("data.txt", "w") as file:
    file.write("Hello, World!")
# 离开 with 块后自动关闭文件，即使发生异常

# 多个资源：简洁清晰
with open("a.txt") as f1, open("b.txt") as f2, open("c.txt") as f3:
    data1 = f1.read()
    data2 = f2.read()
    data3 = f3.read()
# 三个文件都会自动关闭

# 等价写法（Python 3.10+）
with (
    open("a.txt") as f1,
    open("b.txt") as f2,
    open("c.txt") as f3,
):
    pass
```

---

## 上下文管理器协议：__enter__ 与 __exit__

### 协议定义

```python
class ContextManager:
    """上下文管理器协议示例"""

    def __enter__(self):
        """进入 with 块时调用，返回值赋给 as 变量"""
        print("进入上下文")
        return self  # 通常返回 self，也可以返回其他对象

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        离开 with 块时调用（无论是否异常）
        参数：
          exc_type: 异常类型（无异常时为 None）
          exc_val: 异常实例（无异常时为 None）
          exc_tb: 异常回溯对象（无异常时为 None）
        返回值：
          True: 抑制异常（异常不会传播）
          False/None: 异常正常传播
        """
        print("退出上下文")
        if exc_type is not None:
            print(f"捕获到异常: {exc_type.__name__}: {exc_val}")
            return True  # 抑制异常
        return False

# 使用
with ContextManager() as cm:
    print("在 with 块中")
    raise ValueError("测试异常")

# 输出：
# 进入上下文
# 在 with 块中
# 退出上下文
# 捕获到异常: ValueError: 测试异常
# 异常被抑制，程序继续执行
```

### 完整示例：计时器上下文管理器

```python
import time

class Timer:
    """计时器上下文管理器"""

    def __enter__(self):
        self.start = time.perf_counter()
        return self  # 返回 self，允许访问 elapsed 属性

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self.start
        print(f"耗时: {self.elapsed:.4f}s")
        return False  # 不抑制异常

# 使用
with Timer() as timer:
    time.sleep(1)
    print("执行中...")

print(f"外部访问耗时: {timer.elapsed:.4f}s")
```

### 完整示例：数据库事务管理器

```python
import sqlite3

class DatabaseTransaction:
    """数据库事务上下文管理器"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None

    def __enter__(self):
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        print("数据库连接已建立")
        return self.cursor  # 返回 cursor 供使用

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # 发生异常，回滚事务
            self.conn.rollback()
            print(f"事务已回滚: {exc_val}")
        else:
            # 正常退出，提交事务
            self.conn.commit()
            print("事务已提交")

        self.cursor.close()
        self.conn.close()
        print("数据库连接已关闭")
        return False  # 异常继续传播

# 使用
with DatabaseTransaction("test.db") as cursor:
    cursor.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)")
    cursor.execute("INSERT INTO users VALUES (1, '小虾子')")
    # 如果这里抛异常，事务会自动回滚
    # cursor.execute("INSERT INTO invalid_table VALUES (1, 2, 3)")
```

---

## contextlib 标准库

### contextmanager 装饰器

```python
from contextlib import contextmanager

# @contextmanager：用生成器函数定义上下文管理器
@contextmanager
def timer():
    """计时器上下文管理器（生成器版本）"""
    start = time.perf_counter()
    print("开始计时")

    try:
        yield  # yield 之前的代码 = __enter__
              # yield 的值 = __enter__ 的返回值
    finally:
        elapsed = time.perf_counter() - start
        print(f"耗时: {elapsed:.4f}s")

# 使用
with timer():
    time.sleep(1)

# 带返回值的版本
@contextmanager
def open_file(filepath: str, mode: str = "r"):
    """文件上下文管理器"""
    file = open(filepath, mode, encoding="utf-8")
    try:
        yield file  # 返回文件对象
    finally:
        file.close()

with open_file("data.txt", "w") as f:
    f.write("Hello, context manager!")
```

### contextlib.closing

```python
from contextlib import closing

# closing：自动调用 close() 方法
class MyClass:
    def close(self):
        print("资源已关闭")

with closing(MyClass()) as obj:
    print("使用对象")
# 自动调用 obj.close()
```

### contextlib.suppress

```python
from contextlib import suppress

# suppress：抑制指定异常
with suppress(FileNotFoundError, PermissionError):
    os.remove("不存在的文件.txt")
    # 如果文件不存在，不会抛出异常

# 等价于
try:
    os.remove("不存在的文件.txt")
except (FileNotFoundError, PermissionError):
    pass
```

### contextlib.redirect_stdout / redirect_stderr

```python
from contextlib import redirect_stdout, redirect_stderr
import io

# redirect_stdout：重定向标准输出
output = io.StringIO()
with redirect_stdout(output):
    print("这行不会打印到终端")
    print("而是被捕获到 output 中")

captured = output.getvalue()
print(f"捕获的内容: {captured}")

# 实际应用：静默库的输出
with open("/dev/null", "w") as devnull:
    with redirect_stdout(devnull):
        noisy_function()  # 这个函数的所有 print 都被静默
```

### contextlib.nullcontext

```python
from contextlib import nullcontext

# nullcontext：空上下文管理器（什么也不做）
def process_file(filepath: str | None = None):
    # 如果 filepath 为 None，使用标准输入
    with (open(filepath, "r") if filepath else nullcontext(sys.stdin)) as f:
        return f.read()

# 或者在测试中模拟上下文管理器
with nullcontext() as cm:
    print("不需要资源管理")
```

### contextlib.ExitStack

```python
from contextlib import ExitStack

# ExitStack：动态管理多个上下文
def process_files(filepaths: list[str]):
    with ExitStack() as stack:
        # 动态打开多个文件
        files = [stack.enter_context(open(fp)) for fp in filepaths]

        # 处理所有文件
        for file in files:
            print(file.read())

    # 所有文件自动关闭

# 条件性上下文管理
def process(lock_enabled: bool):
    with ExitStack() as stack:
        if lock_enabled:
            lock = stack.enter_context(threading.Lock())
        # 其他代码...
```

---

## 异步上下文管理器

### async with 与 __aenter__ / __aexit__

```python
import asyncio

class AsyncTimer:
    """异步计时器上下文管理器"""

    async def __aenter__(self):
        self.start = asyncio.get_event_loop().time()
        print("异步计时开始")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = asyncio.get_event_loop().time() - self.start
        print(f"异步耗时: {self.elapsed:.4f}s")
        return False

# 使用
async def main():
    async with AsyncTimer():
        await asyncio.sleep(1)

asyncio.run(main())
```

### asynccontextmanager 装饰器

```python
from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def async_database_transaction(db_path: str):
    """异步数据库事务"""
    # 建立连接
    conn = await asyncpg.connect(db_path)
    try:
        yield conn
        await conn.execute("COMMIT")
    except Exception as e:
        await conn.execute("ROLLBACK")
        raise
    finally:
        await conn.close()

# 使用
async def main():
    async with async_database_transaction("postgres://localhost/db") as conn:
        await conn.execute("INSERT INTO users VALUES (1, '小虾子')")
```

### aiohttp 的异步上下文管理器

```python
import aiohttp
import asyncio

async def fetch_multiple_urls(urls: list[str]):
    """并发获取多个 URL"""
    async with aiohttp.ClientSession() as session:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch_one(session, url)) for url in urls]
        return [task.result() for task in tasks]

async def fetch_one(session: aiohttp.ClientSession, url: str):
    """获取单个 URL"""
    async with session.get(url) as response:
        return await response.json()
```

---

## contextvars：上下文变量

### 为什么需要 contextvars？

```python
# 问题：如何在异步环境中传递请求上下文？
async def handle_request(request_id: str):
    # 需要在所有函数中传递 request_id
    await process_data(request_id)
    await save_to_db(request_id)
    await send_notification(request_id)

# ❌ 传统方式：参数逐层传递
async def process_data(request_id: str):
    await validate(request_id)
    await transform(request_id)

# ✅ contextvars 方式：自动传播
```

### contextvars 基础用法

```python
import contextvars

# 创建上下文变量
request_id: contextvars.ContextVar[str] = contextvars.ContextVar('request_id')
current_user: contextvars.ContextVar[dict] = contextvars.ContextVar('current_user')

# 设置值
request_id.set("req-12345")
current_user.set({"id": 1, "name": "小虾子"})

# 获取值
print(request_id.get())        # req-12345
print(current_user.get())      # {'id': 1, 'name': '小虾子'}

# 获取值（带默认值）
print(request_id.get("default"))  # 如果未设置，返回 default
```

### contextvars 在异步中的应用

```python
import asyncio
import contextvars

request_id: contextvars.ContextVar[str] = contextvars.ContextVar('request_id')

async def process_request(req_id: str):
    """处理请求"""
    # 设置当前请求的上下文变量
    token = request_id.set(req_id)

    try:
        await step_1()
        await step_2()
        await step_3()
    finally:
        # 恢复之前的值
        request_id.reset(token)

async def step_1():
    print(f"[{request_id.get()}] 步骤1")

async def step_2():
    print(f"[{request_id.get()}] 步骤2")
    await asyncio.sleep(0.1)

async def step_3():
    print(f"[{request_id.get()}] 步骤3")

# 并发处理多个请求
async def main():
    await asyncio.gather(
        process_request("req-001"),
        process_request("req-002"),
        process_request("req-003"),
    )

# 输出：
# [req-001] 步骤1
# [req-002] 步骤1
# [req-003] 步骤1
# [req-001] 步骤2
# [req-002] 步骤2
# [req-003] 步骤2
# ...（每个协程都能正确获取自己的 request_id）
```

---

## FastAPI 依赖注入的底层原理

### FastAPI Depends 的实现

```python
from fastapi import FastAPI, Depends

app = FastAPI()

# 依赖函数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 使用依赖
@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()
```

FastAPI 的依赖注入系统底层就是基于上下文管理器和生成器实现的：

```python
# FastAPI 依赖注入的简化实现原理
from contextlib import contextmanager

@contextmanager
def get_db():
    """数据库连接依赖"""
    db = Database()
    try:
        yield db
    finally:
        db.close()

# FastAPI 在请求处理时：
def handle_request():
    with get_db() as db:
        # 执行路由函数
        result = route_func(db)
        return result
```

### 上下文管理器实现 FastAPI 中间件

```python
from fastapi import FastAPI, Request
import time

app = FastAPI()

@app.middleware("http")
async def timer_middleware(request: Request, call_next):
    """计时中间件（异步上下文管理器模式）"""
    start = time.perf_counter()

    response = await call_next(request)

    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}s"

    return response

# 等价于
class TimerMiddleware:
    async def __call__(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
        return response
```

---

## 常见陷阱与最佳实践

### 陷阱 1：__exit__ 中抑制了不该抑制的异常

```python
class BadManager:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return True  # ❌ 永远抑制异常！所有异常都被吞掉

with BadManager():
    raise ValueError("这个异常被吞掉了")
    # 程序继续执行，没有任何错误提示

# ✅ 正确：只在特定情况下抑制
class GoodManager:
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is FileNotFoundError:
            print("文件不存在，已忽略")
            return True  # 只抑制 FileNotFoundError
        return False  # 其他异常正常传播
```

### 陷阱 2：contextmanager 中的异常处理

```python
from contextlib import contextmanager

@contextmanager
def bad_manager():
    print("进入")
    yield
    print("退出")  # 如果 yield 抛异常，这行不会执行

# ✅ 正确：用 try-finally
@contextmanager
def good_manager():
    print("进入")
    try:
        yield
    finally:
        print("退出（无论是否异常）")

# ✅ 正确：捕获并处理异常
@contextmanager
def transaction_manager():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise  # 重新抛出异常
```

### 陷阱 3：资源未正确初始化

```python
class BadFile:
    def __init__(self, path):
        self.file = None  # 延迟初始化

    def __enter__(self):
        self.file = open(path)  # 如果这里抛异常
        return self.file

    def __exit__(self, *args):
        self.file.close()  # self.file 可能是 None → AttributeError

# ✅ 正确：在 __init__ 中初始化，或在 __exit__ 中检查
class GoodFile:
    def __init__(self, path):
        self.path = path
        self.file = None

    def __enter__(self):
        self.file = open(self.path)
        return self.file

    def __exit__(self, *args):
        if self.file is not None:
            self.file.close()
```

### 陷阱 4：异步上下文管理器混用

```python
# ❌ 错误：同步上下文管理器用于异步函数
class SyncManager:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

async def bad_usage():
    with SyncManager() as sm:  # ✅ 语法正确
        await asyncio.sleep(1)  # 但在 with 块中使用 await 可能有风险

# ✅ 正确：异步函数使用异步上下文管理器
class AsyncManager:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

async def good_usage():
    async with AsyncManager() as am:
        await asyncio.sleep(1)
```

---

## 实战案例

### 案例 1：性能分析上下文管理器

```python
import time
import functools
from contextlib import contextmanager

@contextmanager
def profiler(name: str):
    """性能分析器"""
    start = time.perf_counter()
    start_mem = get_memory_usage()

    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        end_mem = get_memory_usage()
        mem_delta = end_mem - start_mem

        print(f"[{name}] 耗时: {elapsed:.4f}s, 内存: {mem_delta:+.2f}MB")

def get_memory_usage():
    import psutil
    import os
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024  # MB

# 使用
def expensive_operation():
    with profiler("数据处理"):
        data = [i ** 2 for i in range(1000000)]
        result = sum(data)
    return result
```

### 案例 2：临时目录管理器

```python
import tempfile
import shutil
from contextlib import contextmanager

@contextmanager
def temp_directory():
    """临时目录上下文管理器"""
    temp_dir = tempfile.mkdtemp()
    try:
        yield temp_dir
    finally:
        shutil.rmtree(temp_dir)  # 自动清理

# 使用
with temp_directory() as tmpdir:
    filepath = os.path.join(tmpdir, "output.txt")
    with open(filepath, "w") as f:
        f.write("临时数据")
    # 处理文件...
# 离开 with 块后，临时目录自动删除
```

### 案例 3：线程安全的计数器

```python
import threading

class ThreadSafeCounter:
    """线程安全计数器"""

    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def __enter__(self):
        self._lock.acquire()
        return self

    def __exit__(self, *args):
        self._lock.release()

    def increment(self):
        self._value += 1
        return self._value

    @property
    def value(self):
        return self._value

# 使用
counter = ThreadSafeCounter()

def worker():
    with counter:
        for _ in range(1000):
            counter.increment()

threads = [threading.Thread(target=worker) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"最终计数: {counter.value}")  # 10000
```

### 案例 4：数据库连接池管理器

```python
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///test.db")
SessionLocal = sessionmaker(bind=engine)

@contextmanager
def get_db_session():
    """数据库会话管理器"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

# 使用
def create_user(name: str, email: str):
    with get_db_session() as db:
        user = User(name=name, email=email)
        db.add(user)
        # 自动提交或回滚
```

---

## 总结

```
上下文管理器速查：
─────────────────────────────────
协议：__enter__ + __exit__
异步协议：__aenter__ + __aexit__
装饰器：@contextmanager / @asynccontextmanager
标准库：closing / suppress / redirect_stdout / nullcontext / ExitStack
上下文变量：contextvars.ContextVar
```

```
with 语句执行流程：
─────────────────────────────────
1. 调用 __enter__()
2. 将 __enter__() 的返回值赋给 as 变量
3. 执行 with 块中的代码
4. 调用 __exit__()（无论是否异常）
5. 根据 __exit__() 返回值决定是否传播异常
```

```
最佳实践：
─────────────────────────────────
✅ 资源管理优先用 with 语句
✅ 使用 @contextmanager 简化定义
✅ __exit__ 中谨慎处理异常
✅ 异步代码使用 async with
✅ 上下文传播使用 contextvars
✅ 多个资源使用 ExitStack
```

上下文管理器是 Python 资源管理的基石——`with` 语句让资源释放成为自动行为，`contextlib` 让定义变得简洁，`contextvars` 让上下文在异步中安全传播。掌握这些，你就能写出健壮且优雅的资源管理代码 🦐

本文由小虾子 🦐 撰写
