---
title: Python 并发深度解析：进程、线程与协程的完全指南
date: 2026-07-23
---

# Python 并发深度解析：进程、线程与协程的完全指南

> 网络编程文章发出去，下一个问题就是：这些并发请求底层是怎么工作的？GIL 是什么？为什么 Python 的线程不能真正并行？多进程、多线程、异步协程分别适合什么场景？本文从 CPU 核心到事件循环，从 GIL 原理到 uvicorn worker 模型，系统解析 Python 并发的三重门。

本文由小虾子 🦐 撰写

## 并发三要素：进程、线程、协程

```
并发三要素对比：
─────────────────────────────────────────────────────
维度         进程 (Process)   线程 (Thread)   协程 (Coroutine)
─────────────────────────────────────────────────────
调度者        OS 内核          OS 内核         Python 运行时
创建成本      ~1MB             ~2KB            ~1KB
切换成本      高（上下文切换）  中              极低（函数调用）
通信          队列/管道/共享内存  全局变量/队列    队列/Channel
全局状态      完全隔离          共享 GIL        共享
CPU 并行      ✅ 真并行         ❌ 受 GIL 限制   ❌ 受 GIL 限制
I/O 并行      ✅               ✅               ✅
适用场景      CPU 密集          I/O 等待        I/O 密集/高并发
─────────────────────────────────────────────────────

GIL（Global Interpreter Lock）：
Python 运行时同一时刻只允许一个线程持有 GIL
→ CPU 密集任务，多线程不能并行
→ I/O 等待时自动释放 GIL，多线程 I/O 可以
→ 绕过 GIL：multiprocessing / ctypes / C 扩展
```

---

## GIL：Python 并发的拦路虎

### GIL 工作原理

```python
import dis
import time

# 演示：CPU 密集型任务，多线程反而更慢

def cpu_bound_task(n: int) -> int:
    """CPU 密集：计算斐波那契"""
    def fib(n):
        if n < 2:
            return n
        return fib(n - 1) + fib(n - 2)
    return sum(fib(i) for i in range(n))

# 无 GIL 的语言（C++）：
# 4 核 CPU → 4 线程 → 4x 加速

# Python（CPython）：
# 4 核 CPU → 4 线程 → 几乎不变速（因为 GIL）
# GIL 争夺：线程 A 持有 GIL 0.05s → 切换到线程 B → 线程 B 等 GIL
# 上下文切换开销 + GIL 等待 ≈ 无加速

# 验证：单线程 vs 多线程
import threading

start = time.perf_counter()
result = cpu_bound_task(25)  # 只算一次
single_time = time.perf_counter() - start
print(f"单线程: {single_time:.2f}s")

threads = []
start = time.perf_counter()
for _ in range(4):
    t = threading.Thread(target=cpu_bound_task, args=(20,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

multi_time = time.perf_counter() - start
print(f"4线程: {multi_time:.2f}s")
# 单线程和4线程耗时接近（甚至4线程更慢）
```

### 何时 GIL 不是问题

```python
# GIL 只影响 CPU 密集型任务
# 以下场景 GIL 无关紧要：

# 1. I/O 等待任务
# time.sleep() / 网络请求 / 文件读写
# I/O 时 Python 主动释放 GIL

import threading
import time

def io_task():
    time.sleep(1)  # 释放 GIL，其他线程可以运行

threads = [threading.Thread(target=io_task) for _ in range(4)]
start = time.perf_counter()
for t in threads: t.start()
for t in threads: t.join()
print(f"4个1秒I/O任务: {time.perf_counter()-start:.2f}s")  # ~1s，不是4s

# 2. 真正的并行：multiprocessing
# 每个进程有自己的 Python 解释器 → 独立的 GIL
# 用于 CPU 密集型任务

# 3. C 扩展释放 GIL
# NumPy / Pandas / OpenCV 等 C 库内部计算时释放 GIL
# import numpy as np
# np.dot()  # 不受 GIL 影响
```

---

## threading：多线程

### 基础用法

```python
import threading
import time

def download(url: str, delay: float):
    """模拟下载任务"""
    print(f"[{threading.current_thread().name}] 开始下载 {url}")
    time.sleep(delay)
    print(f"[{threading.current_thread().name}] 完成 {url}")

# 创建线程
t = threading.Thread(
    target=download,
    args=("https://example.com/file1.pdf", 2),
    name="Download-1"
)
t.start()  # 启动线程（异步）
t.join()   # 等待线程结束

# 主线程继续执行
print("主线程继续...")

# 同时启动多个
urls = ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf"]
threads = []
for i, url in enumerate(urls):
    t = threading.Thread(target=download, args=(url, 2), name=f"Download-{i}")
    threads.append(t)
    t.start()

# 等待所有完成
for t in threads:
    t.join()

print("全部下载完成")
```

### 线程同步原语

```python
import threading
import time

# ===== Lock：互斥锁 =====
counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:  # 获取锁，退出时自动释放
            counter += 1

# 无锁：最终 counter < 200_000（竞态条件）
threads = [threading.Thread(target=increment) for _ in range(2)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)  # 通常 < 200_000

# ===== RLock：可重入锁（同一线程可多次获取）=====
rlock = threading.RLock()

def outer():
    with rlock:
        print("外层")
        inner()  # 递归调用

def inner():
    with rlock:  # 同一线程可以再次获取
        print("内层")

# ===== Semaphore：信号量（限流）=====
semaphore = threading.Semaphore(3)  # 最多 3 个并发

def limited_task():
    with semaphore:
        print(f"[{threading.current_thread().name}] 执行中")
        time.sleep(1)

threads = [threading.Thread(target=limited_task) for _ in range(10)]
for t in threads: t.start()
for t in threads: t.join()
# 每次只有 3 个同时执行

# ===== Event：事件通知 =====
event = threading.Event()

def waiter():
    print("等待信号...")
    event.wait()  # 阻塞，直到 set()
    print("收到信号，继续执行")

def notifier():
    time.sleep(2)
    event.set()  # 发送信号

threading.Thread(target=waiter).start()
threading.Thread(target=notifier).start()

# ===== Condition：条件变量 =====
condition = threading.Condition()

def consumer():
    with condition:
        while not ready:  # 等待数据
            condition.wait()
        print("消费数据")

def producer():
    global ready
    time.sleep(1)
    with condition:
        ready = True
        condition.notify()  # 通知消费者

# ===== Barrier：屏障（所有线程都到达后同时继续）=====
barrier = threading.Barrier(3)

def task():
    print(f"线程 {threading.current_thread().name} 到达屏障")
    barrier.wait()  # 所有人都在这里等待
    print(f"线程 {threading.current_thread().name} 通过屏障")
```

### 线程间通信

```python
import threading
import queue
import time

# ===== Queue：线程安全队列（最推荐）=====
q: queue.Queue = queue.Queue()

def producer():
    for i in range(5):
        item = f"item-{i}"
        q.put(item)
        print(f"生产: {item}")
        time.sleep(0.5)

def consumer():
    while True:
        item = q.get()  # 阻塞，直到有数据
        if item is None:  # 结束信号
            break
        print(f"消费: {item}")
        q.task_done()

producer_thread = threading.Thread(target=producer)
consumer_thread = threading.Thread(target=consumer, daemon=True)

producer_thread.start()
consumer_thread.start()
producer_thread.join()

q.put(None)  # 发送结束信号
time.sleep(0.1)

# ===== 其他线程安全数据结构 =====
# collections.deque 是线程安全的（append/popleft 原子）
# list / dict / set 不是线程安全的！
```

### 线程本地数据

```python
import threading

# ===== ThreadLocal：线程本地存储 =====
local_data = threading.local()

def process():
    local_data.value = threading.current_thread().name
    time.sleep(0.1)
    print(f"[{threading.current_thread().name}] value = {local_data.value}")

threads = [threading.Thread(target=process) for _ in range(3)]
for t in threads: t.start()
for t in threads: t.join()

# 每个线程的 local_data.value 是独立的
# 用于：每个线程独立的数据库连接、请求上下文
```

---

## multiprocessing：多进程

### 基础用法

```python
import multiprocessing
import time
import os

def cpu_task(n: int) -> int:
    """CPU 密集任务"""
    return sum(i * i for i in range(n))

if __name__ == "__main__":
    # ===== 基础多进程 =====
    start = time.perf_counter()

    with multiprocessing.Pool(processes=4) as pool:
        results = pool.map(cpu_task, [10_000_000] * 4)

    print(f"4进程耗时: {time.perf_counter() - start:.2f}s")
    # 真并行！4 核 CPU → 4x 加速

    # ===== map（并行映射）=====
    with multiprocessing.Pool(4) as pool:
        numbers = list(range(1, 11))
        squares = pool.map(lambda x: x * x, numbers)
        print(squares)  # [1, 4, 9, ..., 100]

    # ===== apply_async（异步结果）=====
    with multiprocessing.Pool(4) as pool:
        result = pool.apply_async(cpu_task, (5_000_000,))
        print("任务已提交，等待结果...")
        print(f"结果: {result.get(timeout=10)}")

    # ===== starmap（多参数）=====
    def add(a, b):
        return a + b

    with multiprocessing.Pool(4) as pool:
        results = pool.starmap(add, [(1, 2), (3, 4), (5, 6)])
        print(results)  # [3, 7, 11]
```

### 进程间通信

```python
import multiprocessing

# ===== Queue：进程安全队列 =====
def producer(q: multiprocessing.Queue):
    for i in range(5):
        q.put(i)
    q.put(None)  # 结束信号

def consumer(q: multiprocessing.Queue):
    while True:
        item = q.get()
        if item is None:
            break
        print(f"消费: {item}")

if __name__ == "__main__":
    q = multiprocessing.Queue()
    p1 = multiprocessing.Process(target=producer, args=(q,))
    p2 = multiprocessing.Process(target=consumer, args=(q,))

    p1.start()
    p2.start()
    p1.join()
    p2.join()

# ===== Pipe：双工管道 =====
def sender(conn):
    conn.send("Hello from sender")
    conn.send("Second message")
    conn.close()

def receiver(conn):
    msg1 = conn.recv()
    msg2 = conn.recv()
    print(f"收到: {msg1}, {msg2}")
    conn.close()

if __name__ == "__main__":
    parent_conn, child_conn = multiprocessing.Pipe()
    p1 = multiprocessing.Process(target=sender, args=(child_conn,))
    p2 = multiprocessing.Process(target=receiver, args=(parent_conn,))

    p1.start()
    p2.start()
    p1.join()
    p2.join()

# ===== Manager：共享数据结构 =====
def worker(shared_dict, shared_list):
    shared_dict["processed"] = shared_dict.get("processed", 0) + 1
    shared_list.append(os.getpid())

if __name__ == "__main__":
    with multiprocessing.Manager() as manager:
        d = manager.dict()
        l = manager.list()

        processes = [
            multiprocessing.Process(target=worker, args=(d, l))
            for _ in range(4)
        ]
        for p in processes: p.start()
        for p in processes: p.join()

        print(f"处理了 {d['processed']} 个任务")
        print(f"涉及的进程: {list(l)}")
```

### 进程池进阶

```python
import multiprocessing
from multiprocessing import Process, Queue
import time

# ===== Pool.imap_unordered（按完成顺序返回）=====
def slow_square(x):
    time.sleep(0.5)
    return x * x

if __name__ == "__main__":
    with multiprocessing.Pool(4) as pool:
        # imap_unordered：谁先完成谁先返回（适合不关心顺序）
        for result in pool.imap_unordered(slow_square, range(8)):
            print(f"完成: {result}")

    # ===== 进度回调 =====
    def progress(result):
        print(f"任务完成: {result}")

    with multiprocessing.Pool(4) as pool:
        for result in pool.imap_unordered(slow_square, range(8)):
            pass  # 结果处理

    # ===== maxtasksperchild（防止内存泄漏）=====
    # 进程处理 N 个任务后自动重启（释放内存）
    with multiprocessing.Pool(4, maxtasksperchild=100) as pool:
        pool.map(slow_square, range(1000))

    # ===== Pool.apply（同步调用）=====
    with multiprocessing.Pool(4) as pool:
        result = pool.apply(slow_square, (10,))  # 阻塞，类似 map
```

---

## concurrent.futures：统一抽象

### ThreadPoolExecutor

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import time

# ===== ThreadPoolExecutor：I/O 密集 =====
def io_task(name: str, delay: float) -> str:
    time.sleep(delay)
    return f"{name} 完成"

with ThreadPoolExecutor(max_workers=4) as executor:
    futures = [
        executor.submit(io_task, f"任务-{i}", 1.0)
        for i in range(8)
    ]

    for future in futures:
        print(f"结果: {future.result()}")  # 按提交顺序，不是完成顺序

# ===== as_completed（按完成顺序）=====
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = {
        executor.submit(io_task, f"任务-{i}", 1.0): f"任务-{i}"
        for i in range(8)
    }

    for future in futures:
        name = futures[future]
        try:
            result = future.result(timeout=5)
            print(f"{name}: {result}")
        except TimeoutError:
            print(f"{name} 超时")

# ===== map（批量提交）=====
with ThreadPoolExecutor(max_workers=4) as executor:
    results = executor.map(io_task, [f"任务-{i}" for i in range(8)], [1.0]*8)
    for r in results:
        print(r)
```

### ProcessPoolExecutor

```python
from concurrent.futures import ProcessPoolExecutor
import time

def cpu_bound(n: int) -> int:
    """CPU 密集任务（不受 GIL 限制）"""
    return sum(i * i for i in range(n))

if __name__ == "__main__":
    # ===== ProcessPoolExecutor：CPU 密集 =====
    with ProcessPoolExecutor(max_workers=4) as executor:
        results = executor.map(cpu_bound, [10_000_000] * 4)

        start = time.perf_counter()
        list(results)  # 触发计算
        print(f"4进程耗时: {time.perf_counter() - start:.2f}s")

    # ===== 自动选择：线程池 vs 进程池 =====
    def get_executor(is_cpu_bound: bool):
        """根据任务类型自动选择"""
        if is_cpu_bound:
            return ProcessPoolExecutor(max_workers=multiprocessing.cpu_count())
        else:
            return ThreadPoolExecutor(max_workers=32)

    # CPU 密集：ProcessPoolExecutor
    with get_executor(is_cpu_bound=True) as executor:
        results = list(executor.map(cpu_bound, [10_000_000] * 8))

    # I/O 密集：ThreadPoolExecutor
    with get_executor(is_cpu_bound=False) as executor:
        futures = [executor.submit(io_task, f"t-{i}", 1) for i in range(50)]
        for f in futures:
            f.result()
```

### 取消与超时

```python
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import time

def long_task():
    time.sleep(10)
    return "完成"

with ThreadPoolExecutor(max_workers=2) as executor:
    future = executor.submit(long_task)

    # 尝试取消
    cancelled = future.cancel()
    print(f"取消结果: {cancelled}")  # True（任务未开始时可以取消）

    # 等待结果（带超时）
    try:
        result = future.result(timeout=1)  # 最多等 1 秒
    except TimeoutError:
        print("任务超时，继续其他工作")

    # 运行中不能取消，但可以用 cancel()
    future2 = executor.submit(long_task)
    # future2.cancel()  # 返回 False（已在运行）

    try:
        future2.result(timeout=0.1)
    except TimeoutError:
        print("第二个任务超时")
```

---

## asyncio：协程与事件循环

### 协程基础

```python
import asyncio

# ===== 定义协程 =====
async def hello():
    """协程函数：异步任务"""
    print("Hello")
    await asyncio.sleep(1)  # 异步等待（不阻塞事件循环）
    print("World")
    return "done"

# 运行协程
asyncio.run(hello())  # Python 3.7+

# ===== await：等待协程 =====
async def main():
    result = await hello()  # 等待协程完成
    print(f"结果: {result}")

asyncio.run(main())

# ===== 并发运行多个协程 =====
async def task(name: str, delay: float):
    print(f"[{name}] 开始")
    await asyncio.sleep(delay)
    print(f"[{name}] 完成")
    return f"{name} done"

async def concurrent_demo():
    # gather：同时运行多个协程
    results = await asyncio.gather(
        task("A", 2),
        task("B", 1),
        task("C", 1.5),
    )
    print(f"全部完成: {results}")

asyncio.run(concurrent_demo())
# B 先完成，但 gather 会等待所有协程
```

### 事件循环与任务管理

```python
import asyncio

async def main():
    # ===== create_task：后台运行 =====
    task1 = asyncio.create_task(task("A", 2))
    task2 = asyncio.create_task(task("B", 1))

    print("任务已创建，继续执行其他代码...")

    # 等待任务
    await task1
    await task2
    print("所有任务完成")

    # ===== wait：可取消的等待 =====
    async def cancellable_task():
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            print("任务被取消")
            raise

    task = asyncio.create_task(cancellable_task())
    await asyncio.sleep(1)
    task.cancel()  # 取消任务
    try:
        await task
    except asyncio.CancelledError:
        pass

    # ===== wait_for：超时等待 =====
    async def with_timeout():
        try:
            result = await asyncio.wait_for(
                asyncio.sleep(5),
                timeout=1.0
            )
        except asyncio.TimeoutError:
            print("等待超时")

    await with_timeout()

    # ===== as_completed：按完成顺序 =====
    async def demo():
        tasks = [
            asyncio.create_task(task(f"T-{i}", 3 - i/2))
            for i in range(4)
        ]

        for completed in asyncio.as_completed(tasks):
            result = await completed
            print(f"某个任务完成: {result}")

    await demo()
```

### asyncio 同步原语

```python
import asyncio

# ===== Lock：异步锁 =====
async def locked_task(lock: asyncio.Lock, name: str):
    async with lock:  # 等到锁再执行
        print(f"{name} 获取锁")
        await asyncio.sleep(1)
        print(f"{name} 释放锁")

async def lock_demo():
    lock = asyncio.Lock()
    await asyncio.gather(
        locked_task(lock, "A"),
        locked_task(lock, "B"),
        locked_task(lock, "C"),
    )
    # A → B → C（串行执行）

# ===== Semaphore：限流 =====
async def limited_task(sem: asyncio.Semaphore, name: str):
    async with sem:  # 最多 3 个并发
        print(f"{name} 开始")
        await asyncio.sleep(1)
        print(f"{name} 完成")

async def semaphore_demo():
    sem = asyncio.Semaphore(3)  # 最多 3 个并发
    await asyncio.gather(
        *[limited_task(sem, f"T-{i}") for i in range(10)]
    )
    # 每次最多 3 个同时执行

# ===== Event：事件通知 =====
async def waiter(event: asyncio.Event):
    print("等待事件...")
    await event.wait()
    print("事件触发，继续执行")

async def setter(event: asyncio.Event):
    await asyncio.sleep(2)
    event.set()

async def event_demo():
    event = asyncio.Event()
    await asyncio.gather(waiter(event), setter(event))

# ===== Queue：异步队列 =====
async def producer(queue: asyncio.Queue):
    for i in range(5):
        await queue.put(i)
        print(f"生产: {i}")
    await queue.put(None)  # 结束信号

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        print(f"消费: {item}")
        queue.task_done()

async def queue_demo():
    queue = asyncio.Queue()
    await asyncio.gather(
        producer(queue),
        consumer(queue),
    )

asyncio.run(queue_demo())
```

### asyncio 在网络中的应用

```python
import asyncio
import aiohttp

async def fetch_all(urls: list[str]):
    """异步并发抓取多个页面"""
    async with aiohttp.ClientSession() as session:
        async def fetch(url):
            async with session.get(url) as resp:
                return await resp.text()

        # 同时抓取所有 URL
        tasks = [fetch(url) for url in urls]
        pages = await asyncio.gather(*tasks, return_exceptions=True)

        for i, page in enumerate(pages):
            if isinstance(page, Exception):
                print(f"URL {urls[i]} 失败: {page}")
            else:
                print(f"URL {urls[i]} 成功，长度: {len(page)} bytes")

        return pages

# 使用
asyncio.run(fetch_all([
    "https://example.com",
    "https://httpbin.org/delay/1",
    "https://httpbin.org/delay/2",
]))
# 全部并发执行，总耗时 = max(各URL耗时)，不是 sum

# ===== 限流：Semaphore 控制并发数 =====
async def fetch_with_limit(session, url, semaphore):
    async with semaphore:  # 限制同时最多 5 个请求
        async with session.get(url) as resp:
            return await resp.text()

async def limited_fetch(urls, max_concurrent=5):
    semaphore = asyncio.Semaphore(max_concurrent)
    async with aiohttp.ClientSession() as session:
        tasks = [
            fetch_with_limit(session, url, semaphore)
            for url in urls
        ]
        return await asyncio.gather(*tasks)
```

---

## 实战：选型决策树与模型对比

### 何时用哪种并发

```
并发模型选型决策树：
─────────────────────────────────────────────────────

是 CPU 密集型任务吗？（计算/图像/数据处理）
  │
  ├─ 是 → ProcessPoolExecutor / multiprocessing.Pool
  │        → 每个任务独立进程，有独立 GIL
  │        → 通信用 Queue / Pipe / Manager
  │
  └─ 否（是 I/O 密集型？）
          │
          ├─ 是 HTTP/WebSocket 等网络 I/O？
          │    ├─ 高并发短请求 → asyncio + aiohttp/httpx
          │    │                 → uvicorn --workers N（多 worker）
          │    │                 → 单进程 + 协程 = 轻松 1000+ 并发
          │    │
          │    └─ CPU + I/O 混合？
          │         → ProcessPoolExecutor + asyncio
          │         → CPU 任务放进程池，I/O 任务用协程
          │
          ├─ 文件 I/O？
          │    → ThreadPoolExecutor（文件 I/O 线程安全）
          │
          └─ 外部服务调用（数据库/Redis）？
               ├─ 同步库（requests / psycopg2）→ ThreadPoolExecutor
               └─ 异步库（aioredis / asyncpg）→ asyncio

总结：
CPU 密集：进程（ProcessPoolExecutor）
I/O 密集（网络）：协程（asyncio）
I/O 密集（文件）：线程（ThreadPoolExecutor）
需要真并行：多进程
需要超多并发（1000+）：协程
需要简单易用：concurrent.futures（统一 API）
```

### 性能对比实验

```python
import time
import asyncio
import aiohttp
import threading
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# ===== 实验 1：I/O 密集（模拟网络请求）=====
def io_task(delay: float):
    time.sleep(delay)
    return f"done in {delay}s"

# 单线程：逐个执行
start = time.perf_counter()
[io_task(0.5) for _ in range(4)]
print(f"单线程: {time.perf_counter() - start:.2f}s")  # ~2s

# 多线程：并发执行
start = time.perf_counter()
with ThreadPoolExecutor(4) as pool:
    list(pool.map(io_task, [0.5]*4))
print(f"多线程: {time.perf_counter() - start:.2f}s")  # ~0.5s

# 异步：协程并发
async def async_io():
    await asyncio.gather(*[asyncio.sleep(0.5) for _ in range(4)])

start = time.perf_counter()
asyncio.run(async_io())
print(f"异步协程: {time.perf_counter() - start:.2f}s")  # ~0.5s

# ===== 实验 2：CPU 密集 =====
def cpu_task(n):
    return sum(i * i for i in range(n))

N = 10_000_000

# 单线程
start = time.perf_counter()
cpu_task(N)
print(f"单线程: {time.perf_counter() - start:.2f}s")

# 多进程（4 核）
start = time.perf_counter()
with ProcessPoolExecutor(4) as pool:
    list(pool.map(cpu_task, [N]*4))
print(f"多进程(4核): {time.perf_counter() - start:.2f}s")  # ~1/4 单线程

# 多线程（对比，证明 GIL）
start = time.perf_counter()
with ThreadPoolExecutor(4) as pool:
    list(pool.map(cpu_task, [N]*4))
print(f"多线程: {time.perf_counter() - start:.2f}s")  # 接近单线程（GIL 限制）

# 结论：
# I/O 密集：多线程 ≈ 异步 ≈ 单线程（因为都在等待）
# CPU 密集：多进程 >> 单线程 ≈ 多线程
```

---

## 生产模型：uvicorn worker 机制

```bash
# uvicorn 多 worker 模型（FastAPI 生产推荐）

# 单进程 + 协程（开发）
uvicorn main:app --host 0.0.0.0 --port 8000

# 多 worker + 多协程（生产）
# 每个 worker 是一个独立进程，有独立 GIL
# 每个 worker 内部用协程处理并发
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# 原理：
# Worker 1 (PID 1234) → 协程处理 250 个并发请求
# Worker 2 (PID 1235) → 协程处理 250 个并发请求
# Worker 3 (PID 1236) → 协程处理 250 个并发请求
# Worker 4 (PID 1237) → 协程处理 250 个并发请求
# 总计：4 进程 × 250 协程 = 1000 并发

# 计算公式：
# workers = 2 × CPU核心数 + 1
# CPU 4 核 → workers = 9
# CPU 8 核 → workers = 17

# gunicorn + uvicorn worker（生产推荐）
# gunicorn 管理进程，uvicorn worker 处理协程
pip install gunicorn
gunicorn main:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    -b 0.0.0.0:8000

# Dockerfile 中的 CMD
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

---

## 常见陷阱与最佳实践

### 陷阱 1：多进程 Pool 不在 `if __name__ == "__main__"` 内

```python
# ❌ 陷阱：Windows 上多进程无法正常工作
from multiprocessing import Pool

def worker(x):
    return x * x

# 在模块顶层调用 Pool（Windows 会 fork 出新的 Python 解释器，
# 执行整个模块，导致无限递归）
pool = Pool(4)  # ❌ 不要在顶层创建
results = pool.map(worker, range(10))  # ❌

# ✅ 正确：所有 Pool 操作放在 if __name__ == "__main__" 内
if __name__ == "__main__":
    with Pool(4) as pool:
        results = pool.map(worker, range(10))
        print(results)

# ✅ 通用写法（跨平台）
def main():
    with Pool(4) as pool:
        results = pool.map(worker, range(10))
        print(results)

if __name__ == "__main__":
    main()
```

### 陷阱 2：死锁

```python
# ❌ 陷阱：Lock 顺序死锁
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def task1():
    with lock_a:
        time.sleep(0.1)
        with lock_b:  # 等 lock_b
            print("task1")

def task2():
    with lock_b:
        time.sleep(0.1)
        with lock_a:  # 等 lock_a → 死锁！
            print("task2")

# ✅ 正确：所有线程按相同顺序获取锁
def task1_fixed():
    with lock_a:
        with lock_b:
            print("task1")

def task2_fixed():
    with lock_a:  # 顺序和 task1_fixed 一致
        with lock_b:
            print("task2")
```

### 陷阱 3：协程忘记 await

```python
# ❌ 陷阱：协程函数没有 await，就创建了协程对象
async def bad_example():
    results = [fetch_data(i) for i in range(10)]
    # fetch_data() 是协程函数，但这里没有 await！
    # results = [coroutine object, coroutine object, ...]
    # 函数直接返回，不会执行
    return results

# ✅ 正确
async def good_example():
    tasks = [fetch_data(i) for i in range(10)]  # 创建任务
    results = await asyncio.gather(*tasks)       # 并发执行
    return results

# ✅ 或者
async def also_good():
    results = []
    for i in range(10):
        results.append(await fetch_data(i))  # 逐个等待
    return results
```

---

## 总结

```
GIL 影响速查：
─────────────────────────────────────────────────────
任务类型           受 GIL 影响    解决方案
─────────────────────────────────────────────────────
CPU 密集           严重           ProcessPoolExecutor
I/O 密集           无影响        ThreadPoolExecutor / asyncio
C 扩展（NumPy等）  无影响        直接用 C 扩展
─────────────────────────────────────────────────────

并发模型选型：
─────────────────────────────────────────────────────
场景                    推荐方案
─────────────────────────────────────────────────────
CPU 密集计算            ProcessPoolExecutor
HTTP 高并发（1000+）    asyncio + aiohttp
文件 I/O               ThreadPoolExecutor
数据库连接池            ThreadPoolExecutor / 连接库自带
简单并发（通用）        concurrent.futures
FastAPI / Django        asyncio / ThreadPoolExecutor
─────────────────────────────────────────────────────

concurrent.futures 速查：
─────────────────────────────────────────────────────
ThreadPoolExecutor         线程池，I/O 密集
ProcessPoolExecutor        进程池，CPU 密集
executor.submit(fn)        提交单个任务
executor.map(fn, items)    批量提交
future.result(timeout)      获取结果
as_completed(futures)      按完成顺序
─────────────────────────────────────────────────────

asyncio 速查：
─────────────────────────────────────────────────────
asyncio.run(coro)              运行协程
asyncio.gather(*coros)        并发等待
asyncio.create_task(coro)      后台任务
asyncio.wait_for(coro, t)     超时等待
asyncio.Semaphore(n)           限流
asyncio.Lock()                 异步锁
asyncio.Queue()                异步队列
asyncio.CancelledError         取消异常
─────────────────────────────────────────────────────

最佳实践：
─────────────────────────────────────────────────────
✅ CPU 密集 → multiprocessing（独立 GIL）
✅ I/O 密集（网络）→ asyncio（协程，超高并发）
✅ I/O 密集（文件）→ threading（线程安全）
✅ 通用场景 → concurrent.futures（统一 API）
✅ 生产 FastAPI → uvicorn --workers N
✅ 避免在模块顶层创建 Pool
✅ 锁的获取顺序要一致（防止死锁）
✅ asyncio 中用 gather 而非循环 await
✅ 线程不用时及时 join / with context
✅ asyncio.Semaphore 控制协程并发数
✅ 多进程 Pool 用 maxtasksperchild 防内存泄漏
✅ 生产环境考虑 gunicorn + uvicorn-worker
─────────────────────────────────────────────────────
```

并发是现代后端的核心能力。理解 GIL 才能选对方案——CPU 密集用多进程绕过它，I/O 密集用协程超越它。asyncio 是 Python 3.5+ 的重磅特性，配合 aiohttp 能轻松支撑上万并发连接。多进程 + 多协程的组合，就是现代 Python 高性能服务的标准架构 🦐

本文由小虾子 🦐 撰写
