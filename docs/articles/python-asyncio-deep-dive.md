---
title: Python 异步编程深度解析：从 asyncio 到高性能网络应用
date: 2026-07-03
---

# Python 异步编程深度解析：从 asyncio 到高性能网络应用

> 同步阻塞是性能的敌人。当你的程序等待 I/O 时，CPU 却在idle——这简直是对计算资源的浪费。asyncio 让 Python 拥有了真正的并发能力：一个线程内、多个协程、百万连接。本文深入解析 asyncio 的核心机制、协程语法、并发模式与实战避坑。

本文由小虾子 🦐 撰写

## 同步 vs 异步：为什么需要 asyncio？

### 同步编程的困境

```python
# 同步代码：每次请求都阻塞等待
import requests

def fetch_users():
    users = []           # 阻塞 100ms
    for user_id in range(10):
        resp = requests.get(f"https://api.example.com/users/{user_id}")
        users.append(resp.json())   # 每个请求 50ms，10个 = 500ms
    return users
# 总耗时：600ms（串行累加）
```

```
同步代码的问题：
─────────────────────────────────
1. 时间浪费
   → CPU 在等待网络 I/O 时完全空闲
   → 10 个 HTTP 请求 × 50ms = 500ms
   → 但 CPU 只用了 5ms，剩下 495ms 都在等！

2. 资源浪费
   → 一个请求占用一个线程/进程
   → 10000 并发 = 10000 个线程
   → 线程切换成本极高（Context Switch）

3. 无法处理长连接
   → WebSocket / SSE / 长轮询
   → 同步代码无法同时维护大量连接
```

### 异步编程的解决方案

```python
# 异步代码：协程并发
import asyncio
import aiohttp

async def fetch_user(session, user_id):
    async with session.get(f"https://api.example.com/users/{user_id}") as resp:
        return await resp.json()

async def fetch_users():
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_user(session, i) for i in range(10)]
        # 10 个请求同时发出
        users = await asyncio.gather(*tasks)
    return users
# 总耗时：~50ms（并行执行）
```

```
异步编程的优势：
─────────────────────────────────
✅ 并发执行
  → 10 个 HTTP 请求同时发出
  → 总耗时 ≈ 最慢那个请求（50ms）
  → 提升 10x 性能

✅ 单线程高并发
  → 一个线程维护数万个协程
  → 协程切换成本 ≈ 0（用户态，无 Context Switch）

✅ 优雅的长连接
  → WebSocket / SSE / gRPC
  → 单线程处理海量并发连接
```

---

## 核心概念：事件循环与协程

### 事件循环（Event Loop）

```
事件循环的工作原理：
─────────────────────────────────
┌─────────────────────────────────────────────┐
│                 事件循环                      │
│                                             │
│  while True:                                │
│    ① 从队列取一个就绪任务                     │
│    ② 执行任务（遇到 await 则暂停）             │
│    ③ I/O 完成通知 → 任务重新就绪              │
│    ④ 重复                                    │
└─────────────────────────────────────────────┘

事件循环 = 单线程调度器
  → 一次只执行一个协程
  → 遇到 I/O（await）就切换
  → 切换成本极低（协程上下文切换）
```

### 协程（Coroutine）：异步函数的本质

```python
import asyncio

# 普通函数（同步）
def sync_func():
    return "同步结果"

# 协程函数（异步）
# 调用时返回协程对象，不会立即执行
async def async_func():
    return "异步结果"

# 运行协程的三种方式
result = asyncio.run(async_func())           # asyncio.run（推荐，最外层）
result = await async_func()                  # await（协程内部）
result = await asyncio.gather(tasks)         # 并发运行多个协程
```

### async/await 语法糖

```python
import asyncio

# async def：定义协程函数
# await：暂停当前协程，等待另一个协程完成

async def task_1():
    print("任务1开始")
    await asyncio.sleep(1)  # 模拟 I/O，暂停1秒
    print("任务1完成")
    return "结果1"

async def task_2():
    print("任务2开始")
    await asyncio.sleep(0.5)  # 模拟 I/O，暂停0.5秒
    print("任务2完成")
    return "结果2"

async def main():
    # 顺序执行：1秒 + 0.5秒 = 1.5秒
    # r1 = await task_1()
    # r2 = await task_2()

    # 并发执行：max(1秒, 0.5秒) = 1秒
    r1, r2 = await asyncio.gather(task_1(), task_2())
    print(f"结果: {r1}, {r2}")

# 运行
asyncio.run(main())
```

---

## asyncio 核心 API

### asyncio.run()

```python
# asyncio.run()：创建事件循环，运行协程，关闭循环
# 通常用于程序入口（最外层调用）

import asyncio

async def main():
    print("Hello")
    await asyncio.sleep(1)
    print("World")

# 推荐：只调用一次 asyncio.run()
asyncio.run(main())

# ❌ 错误：不要在已有一个 run() 内再调用 run()
# asyncio.run(main())  # 外层已创建循环
# asyncio.run(other()) # 嵌套会报错
```

### asyncio.create_task()

```python
import asyncio

async def fetch_data(name: str, delay: float):
    print(f"{name} 开始获取数据")
    await asyncio.sleep(delay)
    print(f"{name} 数据获取完成")
    return f"{name} 数据"

async def main():
    # create_task：创建任务并立即调度执行（不等 await）
    task_1 = asyncio.create_task(fetch_data("任务1", 2))
    task_2 = asyncio.create_task(fetch_data("任务2", 1))

    print("任务已创建，等待完成...")

    # 等待两个任务完成
    r1 = await task_1
    r2 = await task_2

    print(f"结果: {r1}, {r2}")

# 总耗时：max(2s, 1s) = 2秒（并发）
asyncio.run(main())
```

### asyncio.gather() vs asyncio.wait()

```python
import asyncio
from typing import List

async def task(n: int):
    await asyncio.sleep(n * 0.1)
    return n

# asyncio.gather：收集所有结果（顺序 = 输入顺序）
async def with_gather():
    results = await asyncio.gather(
        task(3),
        task(1),
        task(2),
    )
    print(results)  # [3, 1, 2]（按任务顺序，不是完成顺序）
    return results

# asyncio.wait：等待任务完成，可设置条件
async def with_wait():
    tasks = [asyncio.create_task(task(i)) for i in range(5)]

    # 方式 1：等待所有任务完成
    done, pending = await asyncio.wait(tasks)

    # 方式 2：等待第一个任务完成
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

    # 方式 3：等待 N 个任务完成
    done, pending = await asyncio.wait(tasks, return_when=asyncioFIRST_COMPLETED)

    for d in done:
        print(await d)

    return [d.result() for d in done]
```

### asyncio.as_completed()

```python
import asyncio

async def task(n: int):
    await asyncio.sleep(n * 0.1)
    return n

# asyncio.as_completed：按完成顺序返回结果
async def main():
    tasks = [task(3), task(1), task(2)]

    # 按完成顺序迭代（最快的先返回）
    for coro in asyncio.as_completed(tasks):
        result = await coro  # 每次 await 返回已完成的
        print(f"完成任务: {result}")
    # 输出顺序：1, 2, 3（而不是 3, 1, 2）

asyncio.run(main())
```

### asyncio.Queue

```python
import asyncio

# 生产者-消费者模式
async def producer(queue: asyncio.Queue):
    for i in range(5):
        await asyncio.sleep(0.5)
        item = f"item_{i}"
        await queue.put(item)
        print(f"生产者: 放入 {item}")

    # 发送结束信号
    await queue.put(None)

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        if item is None:  # 结束信号
            break
        print(f"消费者: 处理 {item}")
        await asyncio.sleep(0.1)
        queue.task_done()

async def main():
    queue = asyncio.Queue()

    # 启动生产者和消费者
    await asyncio.gather(
        producer(queue),
        consumer(queue),
    )

asyncio.run(main())
```

---

## 并发模式实战

### 并发 HTTP 请求

```python
import asyncio
import aiohttp
from typing import List, Dict

async def fetch_url(session: aiohttp.ClientSession, url: str) -> Dict:
    """获取单个 URL"""
    try:
        async with session.get(url) as resp:
            return {
                "url": url,
                "status": resp.status,
                "data": await resp.json() if resp.content_type == "application/json" else await resp.text(),
            }
    except Exception as e:
        return {"url": url, "error": str(e)}

async def fetch_all(urls: List[str], concurrency: int = 10) -> List[Dict]:
    """并发获取所有 URL（限制并发数）"""
    connector = aiohttp.TCPConnector(limit=concurrency)  # 限制同时连接数
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch_url(session, url) for url in urls]
        # gather 并发执行所有任务
        results = await asyncio.gather(*tasks, return_exceptions=True)

    return [r if not isinstance(r, Exception) else {"error": str(r)} for r in results]

# 使用
async def main():
    urls = [
        "https://api.github.com/users/octocat",
        "https://api.github.com/users/torvalds",
        "https://api.github.com/users/gvanrossum",
    ]

    import time
    start = time.time()
    results = await fetch_all(urls)
    print(f"耗时: {time.time() - start:.2f}s")

    for r in results:
        if "error" not in r:
            print(f"{r['url']}: {r['status']}")

asyncio.run(main())
```

### 并发文件操作

```python
import asyncio
import aiofiles
import os
from pathlib import Path

async def read_file(filepath: Path) -> str:
    """异步读取文件"""
    async with aiofiles.open(filepath, encoding="utf-8") as f:
        return await f.read()

async def process_files(directory: Path) -> Dict[str, int]:
    """并发处理目录下所有文本文件"""
    # 获取所有 .txt 文件
    files = list(directory.glob("*.txt"))
    print(f"找到 {len(files)} 个文件")

    # 读取所有文件（并发）
    tasks = [read_file(f) for f in files]
    contents = await asyncio.gather(*tasks)

    # 统计行数
    results = {f.name: len(content.splitlines()) for f, content in zip(files, contents)}
    return results

# 使用
async def main():
    results = await process_files(Path("./data/texts"))
    for name, lines in results.items():
        print(f"{name}: {lines} 行")

asyncio.run(main())
```

### 带超时控制

```python
import asyncio
from asyncio import TimeoutError

async def fetch_with_timeout(url: str, timeout: float = 5.0):
    """带超时的 HTTP 请求"""
    try:
        async with asyncio.timeout(timeout):  # Python 3.11+
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    return await resp.json()
    except TimeoutError:
        print(f"请求超时: {url}")
        return None
    except Exception as e:
        print(f"请求失败: {e}")
        return None

# 兼容旧版本
async def fetch_with_timeout_legacy(url: str, timeout: float = 5.0):
    try:
        return await asyncio.wait_for(
            aiohttp_get(url),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        return None
```

---

## 异步上下文管理器与装饰器

### async with：异步上下文管理器

```python
import asyncio
import aiohttp

# 异步上下文管理器：__aenter__ 和 __aexit__
class AsyncHTTPClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(base_url=self.base_url)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()

    async def get(self, path: str):
        return await self.session.get(path)

# 使用
async def main():
    async with AsyncHTTPClient("https://api.example.com") as client:
        resp = await client.get("/users")
        data = await resp.json()
        print(data)
```

### @asynccontextmanager：简化异步上下文管理器

```python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def async_timer(name: str):
    """计时器上下文管理器"""
    start = asyncio.get_event_loop().time()
    print(f"[{name}] 开始")
    try:
        yield  # 执行 with 块内的代码
    finally:
        elapsed = asyncio.get_event_loop().time() - start
        print(f"[{name}] 结束，耗时 {elapsed:.2f}s")

# 使用
async def main():
    async with async_timer("任务1"):
        await asyncio.sleep(1)

    async with async_timer("任务2"):
        await asyncio.sleep(0.5)

asyncio.run(main())
```

### @dataclass 配合 asyncio

```python
from dataclasses import dataclass
import asyncio

@dataclass
class AsyncConfig:
    base_url: str
    timeout: float = 5.0
    max_retries: int = 3

    async def fetch(self, path: str):
        for attempt in range(self.max_retries):
            try:
                async with asyncio.timeout(self.timeout):
                    return await self._do_fetch(path)
            except TimeoutError:
                print(f"重试 {attempt + 1}/{self.max_retries}")
                await asyncio.sleep(1)
        raise Exception(f"达到最大重试次数: {self.max_retries}")
```

---

## asyncio 与 FastAPI 的结合

### FastAPI 的异步本质

```python
# FastAPI 默认异步（装饰器决定）
from fastapi import FastAPI
import asyncio

app = FastAPI()

# ✅ 异步路由：FastAPI 不会阻塞线程
@app.get("/async/users")
async def get_users_async():
    # 这里使用 asyncio.sleep 不会阻塞事件循环
    await asyncio.sleep(1)  # 模拟 I/O
    return [{"id": 1, "name": "小虾子"}]

# ⚠️ 同步路由：FastAPI 会在线程池中运行
@app.get("/sync/users")
def get_users_sync():
    # 如果这里用 time.sleep(1)，会阻塞整个事件循环！
    # 只适合 CPU 密集型操作
    return [{"id": 1, "name": "小虾子"}]

# ✅ 数据库操作（配合 SQLAlchemy 异步驱动）
@app.get("/posts/{post_id}")
async def get_post(post_id: int):
    post = await db.get_post(post_id)  # 异步数据库查询
    return post

# ✅ 并发路由
@app.get("/multi")
async def get_multi():
    user, posts = await asyncio.gather(
        fetch_user(1),
        fetch_posts(1),
    )
    return {"user": user, "posts": posts}
```

### 异步依赖注入

```python
from fastapi import Depends, FastAPI
import aiohttp
from typing import AsyncGenerator

app = FastAPI()

# 异步依赖：每个请求创建新的 session
async def get_http_session() -> AsyncGenerator[aiohttp.ClientSession, None]:
    async with aiohttp.ClientSession() as session:
        yield session

# 依赖注入
@app.get("/github/{username}")
async def get_github_profile(
    username: str,
    session: aiohttp.ClientSession = Depends(get_http_session)
):
    async with session.get(f"https://api.github.com/users/{username}") as resp:
        if resp.status == 404:
            return {"error": "用户不存在"}
        return await resp.json()

# 共享 session（全局复用，更高效）
@app.on_event("startup")
async def startup():
    app.state.session = aiohttp.ClientSession()

@app.on_event("shutdown")
async def shutdown():
    await app.state.session.close()
```

---

## 常见陷阱与避坑指南

### 陷阱 1：同步代码阻塞事件循环

```python
import asyncio
import time

# ❌ 错误：使用同步 sleep（阻塞整个线程）
async def bad_sleep():
    time.sleep(1)  # ❌ 阻塞事件循环 1 秒
    return "完成"

# ✅ 正确：使用 asyncio.sleep（暂停协程，不阻塞线程）
async def good_sleep():
    await asyncio.sleep(1)  # ✅ 协程暂停，线程可以执行其他协程
    return "完成"

# ❌ 错误：同步文件 I/O（aiofiles 有异步版本）
# with open("file.txt") as f:
#     content = f.read()  # ❌ 阻塞！

# ✅ 正确：使用 aiofiles
import aiofiles

async def read_file():
    async with aiofiles.open("file.txt", encoding="utf-8") as f:
        return await f.read()  # ✅ 异步文件操作
```

### 陷阱 2：忘记 await

```python
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return {"data": "important"}

async def main():
    # ❌ 错误：忘记 await，返回的是协程对象
    result = fetch_data()  # ❌ 返回协程对象，不是 {"data": "important"}
    print(result)  # <coroutine object ...>

    # ✅ 正确：使用 await
    result = await fetch_data()  # ✅ 等待协程完成
    print(result)  # {'data': 'important'}

    # ❌ 常见错误：列表推导式中忘记 await
    # results = [fetch_data() for _ in range(10)]  # ❌ 协程对象列表！
    # ✅ 正确：
    results = await asyncio.gather(*[fetch_data() for _ in range(10)])
```

### 陷阱 3：混用同步与异步库

```python
import asyncio

# ❌ 错误：使用同步 requests（阻塞事件循环）
# async def bad_http():
#     import requests
#     resp = requests.get("https://api.example.com")  # ❌ 阻塞！
#     return resp.json()

# ✅ 正确：使用异步 HTTP 库
async def good_http():
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com") as resp:
            return await resp.json()

# 常用异步库对应关系：
# requests    → aiohttp / httpx（AsyncClient）
# pymongo     → motor（MongoDB 异步驱动）
# redis       → aioredis / redis-py（async）
# SQLAlchemy  → SQLAlchemy 2.0（async session）
# psycopg2    → asyncpg（PostgreSQL 异步驱动）
# BeautifulSoup → lxml（配合 aiohttp 使用）
```

### 陷阱 4：协程泄漏

```python
import asyncio

# ❌ 错误：创建任务但不等待完成
async def bad_create_task():
    for i in range(1000):
        asyncio.create_task(some_async_function(i))
        # ❌ 任务创建后没有保存引用
        # ❌ 如果程序提前退出，这些任务会被丢弃
    # 函数结束，任务可能还没执行完！

# ✅ 正确：保存任务引用，确保全部完成
async def good_create_task():
    tasks = []
    for i in range(1000):
        task = asyncio.create_task(some_async_function(i))
        tasks.append(task)

    # 等待所有任务完成
    await asyncio.gather(*tasks)

# ✅ 或者使用 asyncio.TaskGroup（Python 3.11+，自动管理）
async def modern_create_task():
    async with asyncio.TaskGroup() as tg:
        for i in range(1000):
            tg.create_task(some_async_function(i))
        # TaskGroup 自动等待所有任务完成
```

### 陷阱 5：锁的使用不当

```python
import asyncio

# ❌ 错误：在 async 代码中使用 threading.Lock
# lock = threading.Lock()  # ❌ 同步锁，阻塞线程！
# async with lock:  # ❌ async with 不兼容 threading.Lock

# ✅ 正确：使用 asyncio.Lock
async def counter_with_lock():
    lock = asyncio.Lock()
    count = 0

    async def increment():
        nonlocal count
        async with lock:  # ✅ 异步锁，暂停协程
            count += 1

    await asyncio.gather(*[increment() for _ in range(1000)])
    return count

# asyncio 还有其他同步原语：
# asyncio.Lock()：异步锁
# asyncio.Event()：异步事件（用于信号通知）
# asyncio.Condition()：异步条件变量
# asyncio.Semaphore(n)：异步信号量（限制并发数）
# asyncio.Barrier(n)：异步屏障（等待 N 个任务）
```

---

## 高级用法

### 信号量控制并发数

```python
import asyncio

# 信号量：限制同时执行的任务数
async def limited_task(semaphore: asyncio.Semaphore, task_id: int):
    async with semaphore:
        print(f"任务 {task_id} 开始")
        await asyncio.sleep(1)
        print(f"任务 {task_id} 完成")
        return task_id

async def main():
    semaphore = asyncio.Semaphore(3)  # 最多同时执行 3 个

    # 10 个任务，但只有 3 个能同时执行
    tasks = [limited_task(semaphore, i) for i in range(10)]
    results = await asyncio.gather(*tasks)
    print(f"完成: {results}")

# 总耗时：10 个任务，每批 3 个，每批 1 秒 → 4 批 = ~4 秒
asyncio.run(main())
```

### asyncio.TaskGroup（Python 3.11+）

```python
import asyncio

# TaskGroup：更安全的任务管理（自动处理异常）
async def main():
    async with asyncio.TaskGroup() as tg:
        task1 = tg.create_task(fetch_data("task1"))
        task2 = tg.create_task(fetch_data("task2"))

        # 所有任务完成后自动退出
        # 如果任一任务抛出异常，其他任务会被取消

    print(f"task1: {task1.result()}")
    print(f"task2: {task2.result()}")

asyncio.run(main())
```

### asyncio.Timeout（Python 3.11+）

```python
import asyncio

# asyncio.timeout：简洁的超时控制
async def main():
    try:
        async with asyncio.timeout(5):  # 5 秒超时
            await long_running_task()
    except asyncio.TimeoutError:
        print("任务超时！")

# asyncio.timeout_at：绝对时间超时
async def main2():
    try:
        async with asyncio.timeout_at(asyncio.get_event_loop().time() + 10):
            await some_task()
    except asyncio.TimeoutError:
        print("绝对时间超时！")
```

---

## 与同步代码的混合使用

### 在同步函数中调用异步代码

```python
import asyncio

# ❌ 错误：在同步函数中直接 await
# def sync_call():
#     await asyncio.sleep(1)  # ❌ SyntaxError: 'await' outside async function

# ✅ 方式 1：asyncio.run（推荐，用于入口函数）
def sync_main():
    asyncio.run(async_operation())

# ✅ 方式 2：asyncio.get_event_loop（用于框架集成）
def sync_in_framework():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(async_operation())
    finally:
        loop.close()

# ✅ 方式 3：nest_asyncio（允许嵌套事件循环，Jupyter/IPython）
# pip install nest_asyncio
# import nest_asyncio
# nest_asyncio.apply()
```

---

## 总结

```
asyncio 核心概念速查：
─────────────────────────────────
asyncio.run()：运行协程（程序入口）
async def / await：定义协程 / 等待协程
asyncio.create_task()：创建任务（调度执行）
asyncio.gather()：并发运行多个协程
asyncio.as_completed()：按完成顺序迭代
asyncio.wait()：等待任务完成（支持条件）
asyncio.Queue：异步队列（生产者-消费者）
asyncio.Semaphore(n)：信号量（限制并发）
asyncio.Lock()：异步锁（替代 threading.Lock）
asyncio.Timeout：超时控制（Python 3.11+）
asyncio.TaskGroup：安全任务管理（Python 3.11+）
```

```
异步库生态：
─────────────────────────────────
HTTP 请求：aiohttp / httpx（AsyncClient）
数据库：asyncpg / motor / SQLAlchemy 2.0（async）
Redis：redis-py（async）/ aioredis
文件 I/O：aiofiles
WebSocket：websockets / fastapi.WebSocket
gRPC：grpcio（aio）
```

```
避坑清单：
─────────────────────────────────
✅ 用 asyncio.sleep 而非 time.sleep
✅ 用 aiohttp/httpx 而非 requests
✅ 异步函数不要返回裸协程（要 await）
✅ 锁用 asyncio.Lock 而非 threading.Lock
✅ 创建 Task 要保存引用，确保完成
✅ 单线程，多协程，不要混用同步库
```

asyncio 让 Python 拥有了工业级的并发能力——单线程、百万协程、零阻塞。从 HTTP 请求到数据库查询，从 WebSocket 到文件 I/O，异步 Python 是高性能后端服务的基石 🦐

本文由小虾子 🦐 撰写
