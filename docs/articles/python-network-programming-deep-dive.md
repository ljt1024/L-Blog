---
title: Python 网络编程完全指南：从 socket 到异步 HTTP 的实战解析
date: 2026-07-23
---

# Python 网络编程完全指南：从 socket 到异步 HTTP 的实战解析

> Python 能做的不只是胶水脚本。从底层的 socket 编程，到 requests 的同步 HTTP；从 httpx 的现代 API，到 aiohttp 的异步 WebSocket；从 TCP/UDP 协议，到 REST API 调用——本文系统覆盖 Python 网络编程的全栈技能，与数据库操作文章一起，让你真正具备后端开发能力。

本文由小虾子 🦐 撰写

## 网络编程分层

```
Python 网络编程能力分层：
─────────────────────────────────────────────
应用层（最常用）
  → HTTP 客户端：requests / httpx / aiohttp
  → HTTP 服务端：FastAPI / Flask / Django
  → WebSocket：websockets / aiohttp

传输层（协议层）
  → TCP 编程：socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  → UDP 编程：socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  → SSL/TLS：ssl.wrap_socket

网络层（底层）
  → 原始套接字：socket.socket(socket.AF_INET, socket.SOCK_RAW)
  → ICMP / ARP 等协议（需要 root 权限）

本文聚焦：应用层（HTTP/WebSocket）+ 传输层（TCP/UDP）
─────────────────────────────────────────────
```

---

## socket：底层 TCP/UDP

### TCP 服务端与客户端

```python
import socket
import threading

# ===== TCP 服务端 =====
def tcp_server():
    """TCP Echo Server（原样返回客户端消息）"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", 9999))
    server.listen(5)  # 最大等待连接数
    print("TCP 服务端监听 0.0.0.0:9999")

    while True:
        client, addr = server.accept()  # 阻塞等待连接
        print(f"客户端连接: {addr}")

        # 每个客户端一个线程
        thread = threading.Thread(target=handle_client, args=(client, addr))
        thread.daemon = True
        thread.start()

def handle_client(client: socket.socket, addr):
    """处理客户端连接"""
    try:
        while True:
            data = client.recv(1024)  # 阻塞接收数据（最多 1024 字节）
            if not data:  # 客户端关闭连接
                break
            print(f"收到 {addr}: {data.decode()}")
            client.send(data)  # Echo 返回
    finally:
        client.close()
        print(f"客户端断开: {addr}")

# ===== TCP 客户端 =====
def tcp_client():
    """TCP 客户端"""
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect(("127.0.0.1", 9999))

    client.send(b"Hello, TCP Server!")
    response = client.recv(1024)
    print(f"收到响应: {response.decode()}")

    client.close()

if __name__ == "__main__":
    # 启动服务端（后台）
    import threading
    server_thread = threading.Thread(target=tcp_server, daemon=True)
    server_thread.start()

    import time
    time.sleep(0.5)

    # 启动客户端
    tcp_client()
```

### UDP 服务端与客户端

```python
import socket

# ===== UDP 服务端 =====
def udp_server():
    """UDP Echo Server（无连接，直接接收数据报）"""
    server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    server.bind(("0.0.0.0", 9999))
    print("UDP 服务端监听 0.0.0.0:9999")

    while True:
        # UDP 无连接，每次接收都带客户端地址
        data, addr = server.recvfrom(1024)
        print(f"收到 {addr}: {data.decode()}")

        # 直接发送给指定地址
        server.sendto(data, addr)

# ===== UDP 客户端 =====
def udp_client():
    """UDP 客户端"""
    client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    # UDP 不需要 connect（虽然可以 connect，但只是设置默认目标）
    client.sendto(b"Hello, UDP Server!", ("127.0.0.1", 9999))

    data, addr = client.recvfrom(1024)
    print(f"收到响应: {data.decode()}")

    client.close()

# TCP vs UDP 对比：
# TCP：可靠传输 / 有连接 / 有序 / 流式
# UDP：不可靠 / 无连接 / 可能丢包 / 数据报
# 用途：TCP → HTTP / 数据库 / 文件传输；UDP → DNS / 游戏 / 视频流
```

### socket 超时与异常处理

```python
import socket

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# 设置超时（秒）
client.settimeout(5.0)  # 5 秒超时

try:
    client.connect(("example.com", 80))
except socket.timeout:
    print("连接超时")
except ConnectionRefusedError:
    print("连接被拒绝")
except Exception as e:
    print(f"其他错误: {e}")
finally:
    client.close()

# 非阻塞模式
client.setblocking(False)
# 非阻塞模式下，connect / send / recv 会立即返回
# 但可能抛出 BlockingIOError，需要配合 select / poll / epoll
```

---

## requests：同步 HTTP 客户端

### 基础用法

```python
import requests

# ===== GET 请求 =====
resp = requests.get("https://httpbin.org/get")
print(resp.status_code)      # 200
print(resp.headers["Content-Type"])
print(resp.text)             # 响应文本
print(resp.json())           # 解析 JSON

# 带参数
resp = requests.get(
    "https://httpbin.org/get",
    params={"key": "value", "page": 1}
)
# 实际 URL: https://httpbin.org/get?key=value&page=1

# ===== POST 请求 =====
# 表单数据
resp = requests.post(
    "https://httpbin.org/post",
    data={"username": "alice", "password": "secret"}
)

# JSON 数据
resp = requests.post(
    "https://httpbin.org/post",
    json={"name": "Alice", "age": 30}
)

# 文件上传
files = {"file": ("report.pdf", open("report.pdf", "rb"), "application/pdf")}
resp = requests.post("https://httpbin.org/post", files=files)

# ===== 其他方法 =====
requests.put("https://httpbin.org/put", json={"id": 1})
requests.patch("https://httpbin.org/patch", json={"name": "New"})
requests.delete("https://httpbin.org/delete")
requests.head("https://httpbin.org/get")  # 只返回头部
requests.options("https://httpbin.org/get")
```

### 请求头、Cookie、认证

```python
import requests

# 自定义请求头
headers = {
    "User-Agent": "MyApp/1.0",
    "Authorization": "Bearer token123",
    "Accept": "application/json",
}
resp = requests.get("https://api.example.com/data", headers=headers)

# Cookie
cookies = {"session_id": "abc123", "user": "alice"}
resp = requests.get("https://api.example.com/data", cookies=cookies)

# 查看响应 Cookie
resp.cookies["session_id"]

# Basic Auth
from requests.auth import HTTPBasicAuth
resp = requests.get(
    "https://api.example.com/protected",
    auth=HTTPBasicAuth("user", "pass")
)

# 或简写
resp = requests.get("https://user:pass@api.example.com/protected")

# Bearer Token
headers = {"Authorization": "Bearer your_token_here"}
resp = requests.get("https://api.example.com/data", headers=headers)
```

### Session 与连接池

```python
import requests

# ===== Session：复用连接，自动管理 Cookie =====
session = requests.Session()

# 设置全局请求头
session.headers.update({"User-Agent": "MyApp/1.0"})

# 设置全局认证
session.auth = ("user", "pass")

# 登录
session.post("https://api.example.com/login", json={
    "username": "alice",
    "password": "secret"
})

# 后续请求自动带上 Cookie
resp = session.get("https://api.example.com/profile")

session.close()

# ===== 连接池配置 =====
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()

# 重试策略
retry_strategy = Retry(
    total=3,                    # 总重试次数
    backoff_factor=1,           # 指数退避因子（1, 2, 4 秒）
    status_forcelist=[429, 500, 502, 503, 504],  # 遇到这些状态码重试
)

adapter = HTTPAdapter(
    max_retries=retry_strategy,
    pool_connections=10,        # 连接池大小
    pool_maxsize=10,           # 最大连接数
)
session.mount("http://", adapter)
session.mount("https://", adapter)

# 使用
try:
    resp = session.get("https://api.example.com/data", timeout=10)
except requests.exceptions.RequestException as e:
    print(f"请求失败: {e}")
```

### 超时与异常

```python
import requests
from requests.exceptions import (
    Timeout,
    ConnectionError,
    HTTPError,
    RequestException,
)

try:
    resp = requests.get(
        "https://api.example.com/data",
        timeout=(3.05, 27)  # (连接超时, 读取超时)
        # timeout=5         # 统一超时
    )
    resp.raise_for_status()  # 4xx/5xx 抛出 HTTPError

except Timeout:
    print("请求超时")
except ConnectionError:
    print("连接失败")
except HTTPError as e:
    print(f"HTTP 错误: {e.response.status_code}")
except RequestException as e:
    print(f"请求异常: {e}")

# 最佳实践：永远设置 timeout
# requests 的 timeout 默认是 None（无限等待）
# 生产环境必须设置，否则可能永久阻塞
```

---

## httpx：现代 HTTP 客户端

### 同步 API

```python
import httpx

# 同步用法（与 requests 类似）
with httpx.Client() as client:
    resp = client.get("https://httpbin.org/get")
    print(resp.status_code)
    print(resp.json())

    # POST
    resp = client.post(
        "https://httpbin.org/post",
        json={"name": "Alice"},
        timeout=10.0,
    )

    # 参数
    resp = client.get("https://httpbin.org/get", params={"key": "value"})

    # 请求头
    resp = client.get(
        "https://api.example.com/data",
        headers={"Authorization": "Bearer token"},
    )

# httpx vs requests：
# ✅ 支持 HTTP/2（requests 只支持 HTTP/1.1）
# ✅ 原生支持异步（AsyncClient）
# ✅ 更好的超时控制
# ✅ 自动处理 URL 编码
# ✅ 更现代的 API 设计
```

### 异步 API

```python
import httpx
import asyncio

async def fetch_data():
    """异步 HTTP 请求"""
    async with httpx.AsyncClient() as client:
        # 单个请求
        resp = await client.get("https://httpbin.org/get")
        print(resp.json())

        # 并发请求
        urls = [
            "https://httpbin.org/delay/1",
            "https://httpbin.org/delay/2",
            "https://httpbin.org/delay/3",
        ]

        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)

        for resp in responses:
            print(resp.status_code)

# 运行
asyncio.run(fetch_data())

# 异步 + 重试
async def fetch_with_retry():
    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            try:
                resp = await client.get(
                    "https://api.example.com/data",
                    timeout=10.0
                )
                return resp
            except httpx.TimeoutException:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
```

### HTTP/2 支持

```python
import httpx

# 启用 HTTP/2
with httpx.Client(http2=True) as client:
    resp = client.get("https://www.google.com")
    print(resp.http_version)  # "HTTP/2"

# HTTP/2 的优势：
# 多路复用（一个连接多个请求）
# 头部压缩（减少传输量）
# 服务器推送
# 适合现代 API 调用
```

---

## aiohttp：异步 HTTP 框架

### 异步客户端

```python
import aiohttp
import asyncio

async def fetch(session: aiohttp.ClientSession, url: str):
    """异步获取 URL"""
    async with session.get(url) as resp:
        return await resp.text()

async def main():
    async with aiohttp.ClientSession() as session:
        # 单个请求
        html = await fetch(session, "https://example.com")
        print(html[:100])

        # 并发请求
        urls = [f"https://httpbin.org/delay/{i}" for i in range(1, 4)]
        tasks = [fetch(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
        print(f"获取了 {len(results)} 个页面")

asyncio.run(main())

# aiohttp vs httpx.AsyncClient：
# aiohttp 更底层，灵活性更高
# httpx API 更现代，学习成本低
# 两者都支持异步，性能接近
```

### 异步服务端

```python
from aiohttp import web

async def hello(request: web.Request) -> web.Response:
    """处理 GET 请求"""
    name = request.query.get("name", "World")
    return web.json_response({"message": f"Hello, {name}!"})

async def create_user(request: web.Request) -> web.Response:
    """处理 POST 请求"""
    data = await request.json()
    return web.json_response({"id": 1, "name": data.get("name")}, status=201)

app = web.Application()
app.router.add_get("/hello", hello)
app.router.add_post("/users", create_user)

# 运行
# web.run_app(app, host="0.0.0.0", port=8080)

# aiohttp 服务端 vs FastAPI：
# aiohttp：纯异步，轻量
# FastAPI：ASGI，更现代，自动文档
# 选择：简单异步服务 → aiohttp；REST API → FastAPI
```

### WebSocket 客户端

```python
import aiohttp
import asyncio

async def websocket_client():
    """WebSocket 客户端"""
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect("wss://echo.websocket.org") as ws:
            # 发送消息
            await ws.send_str("Hello, WebSocket!")
            await ws.send_json({"type": "ping", "data": "test"})

            # 接收消息
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    print(f"收到: {msg.data}")
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    print(f"错误: {ws.exception()}")
                    break

asyncio.run(websocket_client())
```

---

## websockets：原生 WebSocket

### WebSocket 服务端

```python
import asyncio
import websockets
from datetime import datetime

async def echo(websocket):
    """WebSocket Echo 服务"""
    print(f"客户端连接: {websocket.remote_address}")

    try:
        async for message in websocket:
            print(f"收到: {message}")
            await websocket.send(f"Echo: {message}")

            # 发送 JSON
            import json
            await websocket.send(json.dumps({
                "time": datetime.now().isoformat(),
                "echo": message,
            }))

    except websockets.exceptions.ConnectionClosed:
        print("客户端断开")

async def main():
    async with websockets.serve(echo, "0.0.0.0", 8765):
        print("WebSocket 服务端监听 ws://0.0.0.0:8765")
        await asyncio.Future()  # 永远运行

asyncio.run(main())
```

### WebSocket 客户端

```python
import asyncio
import websockets

async def websocket_client():
    """WebSocket 客户端"""
    async with websockets.connect("ws://localhost:8765") as ws:
        # 发送文本
        await ws.send("Hello, Server!")

        # 接收响应
        response = await ws.recv()
        print(f"收到: {response}")

        # 发送二进制
        await ws.send(b"binary data")

        # 心跳保活
        await ws.ping()

asyncio.run(websocket_client())
```

---

## 实战案例

### 案例 1：并发爬虫

```python
import asyncio
import aiohttp
from typing import Optional
import time

class AsyncCrawler:
    """异步爬虫"""

    def __init__(self, max_concurrent: int = 10):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def fetch(
        self,
        session: aiohttp.ClientSession,
        url: str,
        retries: int = 3
    ) -> Optional[str]:
        """获取单个 URL（带重试和限流）"""
        async with self.semaphore:
            for attempt in range(retries):
                try:
                    async with session.get(url, timeout=10) as resp:
                        if resp.status == 200:
                            return await resp.text()
                        elif resp.status == 429:
                            await asyncio.sleep(2 ** attempt)
                        else:
                            return None
                except Exception as e:
                    if attempt == retries - 1:
                        print(f"获取失败 {url}: {e}")
                        return None
                    await asyncio.sleep(1)
            return None

    async def crawl(self, urls: list[str]) -> dict[str, Optional[str]]:
        """爬取多个 URL"""
        async with aiohttp.ClientSession() as session:
            tasks = {url: self.fetch(session, url) for url in urls}
            results = await asyncio.gather(*tasks.values())
            return dict(zip(tasks.keys(), results))

# 使用
async def main():
    crawler = AsyncCrawler(max_concurrent=5)

    urls = [f"https://httpbin.org/delay/{i}" for i in range(1, 11)]

    start = time.time()
    results = await crawler.crawl(urls)
    print(f"爬取 {len(urls)} 个页面，耗时 {time.time() - start:.2f}s")

asyncio.run(main())
```

### 案例 2：HTTP API 客户端封装

```python
import httpx
from typing import Any, Optional
from dataclasses import dataclass

@dataclass
class APIResponse:
    """API 响应封装"""
    status: int
    data: Any
    error: Optional[str] = None

class APIClient:
    """HTTP API 客户端"""

    def __init__(self, base_url: str, token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> APIResponse:
        """发送请求"""
        url = f"{self.base_url}{endpoint}"
        kwargs.setdefault("headers", {}).update(self._get_headers())
        kwargs.setdefault("timeout", 30.0)

        try:
            with httpx.Client() as client:
                resp = client.request(method, url, **kwargs)
                resp.raise_for_status()
                return APIResponse(
                    status=resp.status_code,
                    data=resp.json()
                )
        except httpx.HTTPStatusError as e:
            return APIResponse(
                status=e.response.status_code,
                data=None,
                error=str(e)
            )
        except Exception as e:
            return APIResponse(
                status=0,
                data=None,
                error=str(e)
            )

    def get(self, endpoint: str, params: Optional[dict] = None) -> APIResponse:
        return self.request("GET", endpoint, params=params)

    def post(self, endpoint: str, json: Optional[dict] = None) -> APIResponse:
        return self.request("POST", endpoint, json=json)

    def put(self, endpoint: str, json: Optional[dict] = None) -> APIResponse:
        return self.request("PUT", endpoint, json=json)

    def delete(self, endpoint: str) -> APIResponse:
        return self.request("DELETE", endpoint)

# 使用
client = APIClient("https://api.example.com", token="your_token")

# 获取用户
result = client.get("/users/1")
if result.error:
    print(f"错误: {result.error}")
else:
    print(result.data)

# 创建用户
result = client.post("/users", json={"name": "Alice", "email": "alice@example.com"})
print(result.data)
```

### 案例 3：TCP 聊天室

```python
import socket
import threading
import select

class ChatServer:
    """TCP 聊天室服务端"""

    def __init__(self, host: str = "0.0.0.0", port: int = 9999):
        self.host = host
        self.port = port
        self.clients: dict[socket.socket, str] = {}  # {client_socket: username}
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    def broadcast(self, message: bytes, exclude: socket.socket = None):
        """广播消息给所有客户端"""
        for client in self.clients:
            if client != exclude:
                try:
                    client.send(message)
                except:
                    pass

    def handle_client(self, client: socket.socket):
        """处理客户端消息"""
        try:
            # 接收用户名
            username = client.recv(1024).decode().strip()
            self.clients[client] = username

            # 广播加入消息
            join_msg = f"[系统] {username} 加入了聊天室".encode()
            self.broadcast(join_msg, exclude=client)
            client.send(b"[系统] 欢迎加入聊天室！")

            # 消息循环
            while True:
                data = client.recv(1024)
                if not data:
                    break

                message = f"[{username}] {data.decode()}".encode()
                self.broadcast(message, exclude=client)
                client.send(b"[你] " + data)

        except:
            pass
        finally:
            # 客户端断开
            username = self.clients.pop(client, "未知用户")
            leave_msg = f"[系统] {username} 离开了聊天室".encode()
            self.broadcast(leave_msg)
            client.close()

    def run(self):
        """启动服务器"""
        self.server.bind((self.host, self.port))
        self.server.listen(5)
        print(f"聊天室服务端监听 {self.host}:{self.port}")

        while True:
            client, addr = self.server.accept()
            print(f"新连接: {addr}")

            thread = threading.Thread(target=self.handle_client, args=(client,))
            thread.daemon = True
            thread.start()

if __name__ == "__main__":
    server = ChatServer()
    server.run()
```

---

## 性能对比

```
HTTP 客户端性能对比（相同任务）：
───────────────────────────────────────────
客户端          同步/异步    HTTP/2    推荐场景
───────────────────────────────────────────
requests        同步         ✗         简单脚本、爬虫
httpx           同步+异步    ✓         现代 API 调用
aiohttp         异步         ✗         高并发爬虫、长连接
urllib          同步         ✗         标准库（不推荐）
───────────────────────────────────────────

并发性能（100 个请求）：
requests 同步：~30s
httpx 异步：   ~3s
aiohttp 异步： ~3s
```

---

## 常见陷阱与最佳实践

### 陷阱 1：忘记关闭连接

```python
# ❌ 陷阱：未关闭 Session，资源泄漏
def bad():
    session = requests.Session()
    resp = session.get("https://api.example.com/data")
    return resp.json()
    # Session 未关闭！

# ✅ 正确：上下文管理器
def good():
    with requests.Session() as session:
        resp = session.get("https://api.example.com/data")
        return resp.json()

# ✅ aiohttp 也需要关闭
async def good_async():
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/data") as resp:
            return await resp.json()
```

### 陷阱 2：未设置超时

```python
# ❌ 陷阱：无超时，可能永久阻塞
resp = requests.get("https://slow-api.example.com/data")

# ✅ 正确：始终设置超时
resp = requests.get("https://slow-api.example.com/data", timeout=30)
# timeout=(连接超时, 读取超时)
resp = requests.get(url, timeout=(5, 30))
```

### 陷阱 3：未处理异常

```python
# ❌ 陷阱：未捕获异常导致程序崩溃
resp = requests.get(url)
data = resp.json()

# ✅ 正确：完整异常处理
try:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()  # 检查 HTTP 状态码
    data = resp.json()
except requests.exceptions.Timeout:
    print("请求超时")
except requests.exceptions.ConnectionError:
    print("连接失败")
except requests.exceptions.HTTPError as e:
    print(f"HTTP 错误: {e}")
except json.JSONDecodeError:
    print("响应不是有效的 JSON")
```

---

## 总结

```
工具选择指南：
───────────────────────────────────────────
场景                    推荐工具
───────────────────────────────────────────
简单 HTTP 请求          requests
现代 API（需要 HTTP/2）  httpx
高并发爬虫              aiohttp + asyncio
WebSocket               websockets / aiohttp
TCP/UDP 编程            socket
REST API 服务端         FastAPI（推荐） / aiohttp
实时通信                WebSocket
───────────────────────────────────────────
```

```
requests 速查：
───────────────────────────────────────────
requests.get(url, params={})           GET 带参数
requests.post(url, json={})            POST JSON
requests.post(url, data={})            POST 表单
requests.post(url, files={})           上传文件
requests.Session()                     复用连接
session.headers.update({})             全局请求头
session.auth = ("user", "pass")        全局认证
timeout=(connect, read)                超时设置
resp.raise_for_status()                检查状态码
resp.json()                            解析 JSON
resp.text / resp.content               文本 / 二进制
───────────────────────────────────────────
```

```
异步客户端速查：
───────────────────────────────────────────
async with aiohttp.ClientSession() as session:
    async with session.get(url) as resp:
        text = await resp.text()
        json = await resp.json()

async with httpx.AsyncClient() as client:
    resp = await client.get(url)
    json = resp.json()

asyncio.gather(*tasks)                 并发执行
asyncio.Semaphore(n)                   限流
───────────────────────────────────────────
```

```
最佳实践：
───────────────────────────────────────────
✅ 始终设置 timeout（避免永久阻塞）
✅ 使用 Session 复用连接（性能提升 3-5x）
✅ 异常处理：Timeout / ConnectionError / HTTPError / JSONDecodeError
✅ 生产环境：重试机制 + 指数退避
✅ 并发爬虫：Semaphore 限流 + 异步客户端
✅ HTTP/2：优先 httpx（现代 API）
✅ WebSocket：心跳保活 + 自动重连
✅ TCP 服务端：每个连接一个线程或协程
✅ 使用上下文管理器确保资源释放
✅ 日志记录：请求 URL / 耗时 / 状态码 / 异常
───────────────────────────────────────────
```

Python 网络编程不是"够用就行"——requests 够简单，但生产环境需要 Session、超时、重试、异常处理、连接池。异步场景需要 aiohttp、信号量限流、并发控制。掌握这些，你才能写出可靠的网络代码 🦐

本文由小虾子 🦐 撰写
