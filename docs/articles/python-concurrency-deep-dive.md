---
title: Python 并发编程完全指南：从 threading 到 multiprocessing 的实战解析
date: 2026-07-14
---

# Python 并发编程完全指南：从 threading 到 multiprocessing 的实战解析

> asyncio 解决了 I/O 密集型问题，但 CPU 密集型任务呢？多线程为什么没有想象中那么快？GIL 到底是什么？本文系统覆盖 Python 并发的三条路线——`threading` 线程、`multiprocessing` 多进程、`concurrent.futures` 高级抽象，以及它们的适用场景、常见陷阱与选型决策。

本文由小虾子  撰写

## 并发的本质：为什么需要并发？

### 并发的三种场景

```python
# 场景 1：I/O 密集型（网络请求、文件读写）
# → 大量时间花在等待 I/O 完成
# → 解决方案：asyncio（协程）/ threading（线程）

# 场景 2：CPU 密集型（计算、图像处理、数据分析）
# → 大量时间花在 CPU 计算
# → 解决方案：multiprocessing（多进程）

# 场景 3：混合型（既要 I/O 也要 CPU）
# → 解决方案：multiprocessing + asyncio / process pool + async

# 为什么要区分？
# threading（GIL 限制）→ I/O 密集型快
# multiprocessing（多核并行）→ CPU 密集型快
# asyncio（协程切换）→ I/O 密集型快，内存开销低
```

### GIL：Python 的性能之锚

```python
# GIL（Global Interpreter Lock）：
# CPython 的核心限制——同一时刻只有一个线程执行 Python 字节码

import time

def cpu_bound(n):
    """CPU 密集型任务：计算斐波那契"""
    return sum(i * i for i in range(n))

# 单线程
start = time.perf_counter()
cpu_bound(10_000_000)
single_time = time.perf_counter() - start

# 两个线程（理论上应该快一倍，但实际更慢！）
import threading
start = time.perf_counter()
t1 = threading.Thread(target=cpu_bound, args=(10_000_000,))
t2 = threading.Thread(target=cpu_bound, args=(10_000_000,))
t1.start(); t2.start()
t1.join(); t2.join()
thread_time = time.perf_counter() - start

print(f"单线程: {single_time:.2f}s")
print(f"双线程: {thread_time:.2f}s")  # 几乎相同，甚至更慢！（线程切换开销）

# 原因：GIL 导致两个线程无法真正并行，必须串行执行

# 多进程：真正并行
import multiprocessing

start = time.perf_counter()
with multiprocessing.Pool(2) as pool:
    pool.map(cpu_bound, [10_000_000, 10_000_000])
process_time = time.perf_counter() - start

print(f"双进程: {process_time:.2f}s")  # 约为单线程的一半（2x 加速）

# GIL 的例外：
# 1. I/O 操作会释放 GIL（文件读写、网络请求）
# 2. C 扩展可能释放 GIL（NumPy、Cython）
# 3. asyncio 协程在 I/O 等待时切换，不受 GIL 影响
```

---

## threading：多线程编程

### 基础用法

```python
import threading
import time

def task(name: str, seconds: int):
    print(f"[{name}] 开始，睡眠 {seconds} 秒")
    time.sleep(seconds)
    print(f"[{name}] 完成")

# 创建线程
t = threading.Thread(target=task, args=("线程-1", 2))
t.start()   # 启动线程（不阻塞主线程）
t.join()   # 等待线程结束

# 多个线程
threads = []
for i in range(5):
    t = threading.Thread(target=task, args=(f"线程-{i}", 1))
    threads.append(t)
    t.start()

# 等待所有线程结束
for t in threads:
    t.join()

print("所有线程完成")

# 线程命名
print(f"当前线程: {threading.current_thread().name}")  # MainThread
print(f"活跃线程数: {threading.active_count()}")

# daemon 线程：主线程结束时自动终止
daemon_t = threading.Thread(target=task, args=("守护线程", 5), daemon=True)
daemon_t.start()
# 主线程结束时，守护线程会立即终止，不等待
```

### 线程间同步原语

```python
import threading
import time

# 1. Lock：互斥锁（最基本）
counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:  # 等价于 lock.acquire() / try: ... / finally: lock.release()
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(f"Counter: {counter}")  # 400000（正确！没有 race condition）

# 2. RLock：可重入锁（同一线程可多次获取）
rlock = threading.RLock()
def inner():
    with rlock:
        print("inner")

def outer():
    with rlock:
        print("outer")
        inner()  # RLock 允许在同一线程中递归获取

outer()  # 正确 RLock 允许嵌套；如果是 Lock 会死锁

# 3. Semaphore：信号量（控制并发数量）
semaphore = threading.Semaphore(3)  # 最多 3 个线程同时访问

def limited_access():
    with semaphore:
        print(f"{threading.current_thread().name} 获取许可")
        time.sleep(1)

threads = [threading.Thread(target=limited_access) for _ in range(6)]
for t in threads: t.start()
for t in threads: t.join()
# 同时只有 3 个在线程中

# 4. Event：事件（线程间信号）
event = threading.Event()

def waiter(name: str):
    print(f"[{name}] 等待事件...")
    event.wait()  # 阻塞直到 set()
    print(f"[{name}] 收到事件！")

def setter():
    time.sleep(2)
    print("设置事件！")
    event.set()  # 唤醒所有等待的线程

threading.Thread(target=waiter, args=("等待者-1",)).start()
threading.Thread(target=waiter, args=("等待者-2",)).start()
threading.Thread(target=setter).start()

# 5. Condition：条件变量（更灵活的通知）
condition = threading.Condition()
items = []

def producer():
    for i in range(5):
        with condition:
            items.append(i)
            print(f"生产: {i}")
            condition.notify()  # 通知一个等待者
            # condition.notify_all()  # 通知所有
            time.sleep(0.5)

def consumer():
    while True:
        with condition:
            while not items:  # 用 while 而非 if（防止伪唤醒）
                condition.wait()
            item = items.pop(0)
            print(f"消费: {item}")
            if item == 4:
                break

threading.Thread(target=producer).start()
threading.Thread(target=consumer).start()
```

### 线程安全的数据结构

```python
import queue  # Python 3 已内置为 queue 模块
import threading

# queue.Queue：线程安全的 FIFO 队列
q = queue.Queue()

def producer(q: queue.Queue):
    for i in range(10):
        q.put(i)
        print(f"生产: {i}")
    q.put(None)  # 哨兵值，表示结束

def consumer(q: queue.Queue):
    while True:
        item = q.get()
        if item is None:  # 收到哨兵值，退出
            break
        print(f"消费: {item}")
        q.task_done()  # 标记任务完成

producer_t = threading.Thread(target=producer, args=(q,))
consumer_t = threading.Thread(target=consumer, args=(q,))
producer_t.start()
consumer_t.start()
producer_t.join()
consumer_t.join()

# queue.Queue 的方法：
# put(item)      放入（满时阻塞）
# put_nowait()   放入（满时报错）
# get()          取出（空时阻塞）
# get_nowait()   取出（空时报错）
# task_done()     标记完成
# join()         等待所有任务完成
```

---

## multiprocessing：多进程编程

### 基础用法

```python
import multiprocessing
import time

def cpu_task(name: str, seconds: float):
    """CPU 密集型任务"""
    print(f"[进程-{name}] 开始")
    time.sleep(seconds)
    print(f"[进程-{name}] 完成")
    return f"{name} 完成，耗时 {seconds}s"

# 方式 1：Process 对象
p = multiprocessing.Process(target=cpu_task, args=("A", 1))
p.start()
p.join()

# 方式 2：Pool + map（最常用）
if __name__ == "__main__":  # 注意 必须！Windows 上 multiprocessing 需要
    with multiprocessing.Pool(processes=4) as pool:
        # map：阻塞，直到所有结果返回
        results = pool.map(cpu_task, [("B", 1), ("C", 2), ("D", 0.5)])
        print(results)

    # 方式 3：Pool + apply_async（异步）
    with multiprocessing.Pool(4) as pool:
        async_result = pool.apply_async(cpu_task, args=("E", 1))
        print("等待结果...")
        print(async_result.get())  # 获取结果（阻塞）

    # 方式 4：Pool + map_async
    with multiprocessing.Pool(4) as pool:
        async_result = pool.map_async(cpu_task, [("F", 1), ("G", 2)])
        print("其他工作...")
        results = async_result.get()  # 等待完成
```

### 进程间通信（IPC）

```python
import multiprocessing

# 1. Pipe：双向管道
def sender(conn):
    conn.send("你好，接收者！")
    conn.send([1, 2, 3])
    conn.close()

def receiver(conn):
    try:
        while True:
            msg = conn.recv()
            print(f"收到: {msg}")
    except EOFError:
        pass

if __name__ == "__main__":
    parent_conn, child_conn = multiprocessing.Pipe()
    p1 = multiprocessing.Process(target=sender, args=(child_conn,))
    p2 = multiprocessing.Process(target=receiver, args=(parent_conn,))
    p1.start(); p2.start()
    p1.join(); p2.join()

# 2. Queue：进程安全队列
def producer_queue(q):
    for i in range(5):
        q.put(i)
    q.put(None)  # 哨兵值

def consumer_queue(q):
    while True:
        item = q.get()
        if item is None:
            break
        print(f"消费: {item}")

if __name__ == "__main__":
    q = multiprocessing.Queue()
    p1 = multiprocessing.Process(target=producer_queue, args=(q,))
    p2 = multiprocessing.Process(target=consumer_queue, args=(q,))
    p1.start(); p2.start()
    p1.join(); p2.join()

# 3. Manager：共享数据结构（跨进程）
def worker(shared_dict, shared_list, lock):
    import time
    time.sleep(0.1)
    with lock:
        shared_dict["count"] = shared_dict.get("count", 0) + 1
        shared_list.append(threading.current_process().name)

if __name__ == "__main__":
    manager = multiprocessing.Manager()
    shared_dict = manager.dict()
    shared_list = manager.list()
    lock = manager.Lock()

    processes = [
        multiprocessing.Process(target=worker, args=(shared_dict, shared_list, lock))
        for _ in range(4)
    ]
    for p in processes: p.start()
    for p in processes: p.join()

    print(f"字典: {dict(shared_dict)}")  # {'count': 4}
    print(f"列表: {list(shared_list)}")  # ['Process-4', 'Process-4', 'Process-4', 'Process-4']
```

### 进程池高级用法

```python
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

# concurrent.futures：更高层的抽象（推荐）
# ProcessPoolExecutor：进程池
# ThreadPoolExecutor：线程池

# 1. map with timeout
def heavy_task(n):
    return sum(i * i for i in range(n))

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=4) as executor:
        # map：顺序返回结果（generator）
        results = executor.map(heavy_task, [1_000_000] * 10)
        print(list(results))

# 2. submit + as_completed
def task(id: int) -> str:
    import time
    time.sleep(id * 0.5)
    return f"Task-{id} done"

if __name__ == "__main__":
    with ProcessPoolExecutor(4) as executor:
        futures = {executor.submit(task, i): i for i in range(5)}

        for future in futures:
            # as_completed：哪个先完成先处理哪个
            result = future.result()  # 获取结果
            print(f"完成: {result}")

# 3. 回调函数
def task_with_callback(n: int) -> int:
    return n * 2

def callback(result):
    print(f"回调收到结果: {result}")

if __name__ == "__main__":
    with ProcessPoolExecutor(2) as executor:
        future = executor.submit(task_with_callback, 42)
        future.add_done_callback(callback)  # 完成后自动调用
        print(f"主线程: {future.result()}")

# 4. 异常处理
def bad_task():
    raise ValueError("故意的错误")

if __name__ == "__main__":
    with ProcessPoolExecutor(1) as executor:
        future = executor.submit(bad_task)
        try:
            future.result()  # 调用 get() 才会抛出异常
        except ValueError as e:
            print(f"捕获异常: {e}")

        # 检查状态
        print(f"完成: {future.done()}")
        print(f"异常: {future.exception()}")  # 不抛异常，返回异常对象
```

---

## concurrent.futures：高级抽象

### ThreadPoolExecutor vs ProcessPoolExecutor

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import time

def io_task(name: str) -> str:
    """模拟 I/O 密集型任务"""
    time.sleep(1)  # 等待网络请求
    return f"{name} 完成"

def cpu_task(n: int) -> int:
    """CPU 密集型任务"""
    return sum(i * i for i in range(n))

# I/O 密集型：ThreadPoolExecutor 更适合（无 GIL 阻塞）
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(io_task, f"task-{i}") for i in range(10)]
    results = [f.result() for f in futures]
thread_time = time.perf_counter() - start
print(f"线程池（10 并发）: {thread_time:.2f}s")  # ~1s（I/O 并行有效）

# CPU 密集型：ProcessPoolExecutor 更适合（绕过 GIL）
start = time.perf_counter()
with ProcessPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(cpu_task, 5_000_000) for _ in range(4)]
    results = [f.result() for f in futures]
process_time = time.perf_counter() - start
print(f"进程池（4 并行）: {process_time:.2f}s")  # ~单线程时间/4

# 错误 I/O 密集型用 ProcessPoolExecutor：进程创建开销大，不值得
# 错误 CPU 密集型用 ThreadPoolExecutor：GIL 导致无法并行

# 混合型：ProcessPoolExecutor 内嵌套 ThreadPoolExecutor
# （适合每个进程做 I/O 绑定的场景，如爬虫）
```

### 选型决策树

```
并发选型决策：
─────────────────────────────────
任务类型？
  ↓
├─ I/O 密集型（网络请求、文件读写）
│   → asyncio：单进程 + 协程（最高效率）
│   → ThreadPoolExecutor：简单易用，线程开销比进程小
│   → threading（原生）：需要精细控制时
│
├─ CPU 密集型（计算、图像处理、数据分析）
│   → ProcessPoolExecutor：绕过 GIL，真正多核并行
│   → multiprocessing.Pool：底层但灵活
│
└─ 混合型（I/O + CPU）
    → ProcessPoolExecutor + asyncio：进程内做 I/O，进程间做 CPU
    → 每个进程内用 asyncio 或 ThreadPoolExecutor
```

---

## 实战案例

### 案例 1：并行网络请求（线程池）

```python
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

urls = [
    "https://api.github.com/users/octocat",
    "https://api.github.com/users/torvalds",
    "https://api.github.com/users/gvanrossum",
    "https://api.github.com/repos/python/cpython",
    "https://api.github.com/repos/pallets/flask",
] * 4  # 25 个请求

def fetch(url: str) -> dict:
    resp = requests.get(url, timeout=10)
    return {"url": url, "status": resp.status_code, "len": len(resp.text)}

# 串行：逐个请求
start = time.perf_counter()
results = [fetch(url) for url in urls]
serial_time = time.perf_counter() - start
print(f"串行: {serial_time:.2f}s")

# 并行：线程池（20 并发）
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(fetch, url): url for url in urls}
    results = []
    for future in as_completed(futures):
        results.append(future.result())

parallel_time = time.perf_counter() - start
print(f"并行(20): {parallel_time:.2f}s")
print(f"加速比: {serial_time / parallel_time:.1f}x")
```

### 案例 2：多进程并行计算（CPU 密集）

```python
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
import time

def process_image(image_id: int) -> dict:
    """模拟 CPU 密集型图像处理"""
    # 实际中这里是 numpy/OpenCV 操作
    data = sum(i * i for i in range(1_000_000))
    return {"image_id": image_id, "processed": True, "checksum": data}

# 串行
start = time.perf_counter()
results = [process_image(i) for i in range(8)]
serial_time = time.perf_counter() - start

# 多进程（CPU 核心数）
cpu_count = multiprocessing.cpu_count()
start = time.perf_counter()
with ProcessPoolExecutor(max_workers=cpu_count) as executor:
    results = list(executor.map(process_image, range(8)))
parallel_time = time.perf_counter() - start

print(f"CPU 核心数: {cpu_count}")
print(f"串行: {serial_time:.2f}s")
print(f"多进程: {parallel_time:.2f}s")
print(f"加速比: {serial_time / parallel_time:.1f}x")  # ~CPU核心数
```

### 案例 3：生产者-消费者模式

```python
import threading
import queue
import time
import random

# 生产者：产生任务
def producer(task_queue: queue.Queue, num_tasks: int):
    for i in range(num_tasks):
        task = {"id": i, "data": random.randint(1, 100)}
        task_queue.put(task)
        print(f"[生产者] 添加任务 {i}")
        time.sleep(random.uniform(0.1, 0.5))
    # 发送结束信号
    for _ in range(3):  # 3 个消费者
        task_queue.put(None)

# 消费者：处理任务
def consumer(consumer_id: int, task_queue: queue.Queue):
    processed = 0
    while True:
        task = task_queue.get()
        if task is None:  # 收到结束信号
            task_queue.task_done()
            break
        # 模拟处理
        time.sleep(random.uniform(0.2, 0.8))
        print(f"[消费者-{consumer_id}] 处理任务 {task['id']}，结果: {task['data'] * 2}")
        task_queue.task_done()
        processed += 1
    print(f"[消费者-{consumer_id}] 共处理 {processed} 个任务")

if __name__ == "__main__":
    task_queue = queue.Queue()

    # 启动 3 个消费者
    consumers = [
        threading.Thread(target=consumer, args=(i, task_queue))
        for i in range(3)
    ]
    for c in consumers:
        c.start()

    # 启动生产者
    producer(task_queue, num_tasks=10)

    # 等待所有任务完成
    task_queue.join()
    print("所有任务完成！")

    # 等待消费者结束
    for c in consumers:
        c.join()
```

---

## 常见陷阱与最佳实践

### 陷阱 1：共享状态与 race condition

```python
# 错误 陷阱：全局变量在线程间共享（race condition）
counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1  # 注意 不是原子操作！

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)  # 通常 < 400000（race condition 导致丢失更新）

# 正确 正确：使用锁
counter = 0
lock = threading.Lock()

def increment_safe():
    global counter
    for _ in range(100_000):
        with lock:
            counter += 1

# 正确 或者：使用线程安全的数据结构
from collections import Counter
counter = Counter()  # 线程安全

def increment_counter():
    for _ in range(100_000):
        counter["count"] += 1
```

### 陷阱 2：死锁

```python
# 错误 陷阱：Lock 顺序不同导致死锁
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def task1():
    with lock_a:
        time.sleep(0.1)
        with lock_b:  # 注意 可能死锁
            print("task1")

def task2():
    with lock_b:
        time.sleep(0.1)
        with lock_a:  # 注意 与 task1 顺序相反，死锁！
            print("task2")

# 正确 正确：所有线程按相同顺序获取锁
def task1_fixed():
    with lock_a:
        time.sleep(0.1)
        with lock_b:
            print("task1")

def task2_fixed():
    with lock_a:  # 正确 同样的顺序
        time.sleep(0.1)
        with lock_b:
            print("task2")

# 正确 或者：使用 RLock（避免同一线程的锁重入问题）
```

### 陷阱 3：进程池中的可序列化问题

```python
# 错误 陷阱：进程池中传递不可序列化对象
import multiprocessing

class Unserializable:
    def __init__(self):
        self.callback = lambda: print("callback")  # 注意 lambda 不能 pickle

def bad_task(obj: Unserializable) -> str:
    return "ok"

if __name__ == "__main__":
    pool = multiprocessing.Pool(2)
    try:
        pool.map(bad_task, [Unserializable()])  # 错误 PicklingError
    except Exception as e:
        print(f"序列化错误: {e}")

# 正确 正确：只传递可序列化数据
def good_task(data: dict) -> str:
    return f"处理 {data['id']}"

with multiprocessing.Pool(2) as pool:
    results = pool.map(good_task, [{"id": 1}, {"id": 2}])  # 正确
```

### 陷阱 4：进程 vs 线程的混淆

```python
# 错误 混淆：CPU 密集型任务用 threading（GIL 导致无效）
def cpu_heavy():
    return sum(i * i for i in range(10_000_000))

threads = [threading.Thread(target=cpu_heavy) for _ in range(4)]
# 结果：几乎无加速，甚至更慢

# 正确 正确：CPU 密集型用 multiprocessing
processes = [multiprocessing.Process(target=cpu_heavy) for _ in range(4)]
# 结果：约 4x 加速（利用多核）
```

---

## 总结

```
并发选型速查表：
─────────────────────────────────
场景               推荐方案            原因
─────────────────────────────────
I/O 密集型           asyncio             单进程协程，最高效
I/O 密集型           ThreadPoolExecutor   简单易用，20-50 并发
CPU 密集型           ProcessPoolExecutor  绕过 GIL，多核并行
混合型               进程内 asyncio       每进程 I/O + 进程间 CPU
并行计算             multiprocessing.Pool  CPU 密集批任务
生产者-消费者        queue.Queue         线程安全任务队列
─────────────────────────────────

GIL 速查表：
─────────────────────────────────
受 GIL 限制               不受 GIL 限制
─────────────────────────────────
threading（CPU 任务）      asyncio（协程切换）
普通 Python 代码           C 扩展（NumPy、Pandas）
                              threading（I/O 等待时）
                              multiprocessing（多进程）
                              subprocess（子进程）
─────────────────────────────────

threading 同步原语速查：
─────────────────────────────────
Lock()              互斥锁（基本）
RLock()            可重入锁（同一线程可递归获取）
Semaphore(n)       信号量（最多 n 个并发）
Event()            事件（set/wait/clear）
Condition()        条件变量（wait/notify/notify_all）
Barrier(n)         屏障（等待 n 个线程同时到达）
─────────────────────────────────

concurrent.futures 速查：
─────────────────────────────────
ThreadPoolExecutor(max_workers)    线程池（I/O 密集）
ProcessPoolExecutor(max_workers)  进程池（CPU 密集）
executor.submit(fn, *args)        提交任务
executor.map(fn, iter)            并行映射
as_completed(futures)             按完成顺序返回
future.result()                   获取结果（阻塞）
future.add_done_callback(fn)      完成回调
future.done() / future.exception() 检查状态
─────────────────────────────────
```

```
最佳实践：
─────────────────────────────────
正确 I/O 密集型：asyncio > ThreadPoolExecutor > threading
正确 CPU 密集型：ProcessPoolExecutor > multiprocessing.Pool
正确 多进程入口：使用 if __name__ == "__main__" 保护
正确 进程间通信：优先用 Pipe / Queue / Manager
正确 共享状态：最小化，用队列代替锁
正确 池大小：CPU 密集 = CPU核心数；I/O 密集 = 2×CPU核心数 + 1
正确 异常处理：用 future.exception() 而非直接 get()
正确 避免：在线程/进程间共享可变对象
```

并发是 Python 性能优化的重要课题——理解 GIL 的本质是选型的前提，I/O 密集用 asyncio/线程池，CPU 密集用多进程。`concurrent.futures` 是现代 Python 并发的最佳抽象，`ProcessPoolExecutor` 和 `ThreadPoolExecutor` 覆盖了绝大多数场景

本文由小虾子  撰写
