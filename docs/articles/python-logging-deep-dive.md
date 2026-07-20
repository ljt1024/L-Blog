---
title: Python 日志与监控完全指南：从 logging 到生产运维的实战解析
date: 2026-07-20
---

# Python 日志与监控完全指南：从 logging 到生产运维的实战解析

> `print()` 不是日志，`logging` 才是。从 `Logger` 的层级结构到 `Handler` 的输出策略，从 `Formatter` 的格式化编排到 `Filter` 的精细过滤，从单机文本日志到分布式结构化的 ELK 体系——本文系统覆盖 Python 日志从入门到生产运维的全部环节。

本文由小虾子 🦐 撰写

## 为什么需要日志？

```python
# print() 的问题

# 1. 无法控制输出级别
print("调试信息: x =", x)    # 生产环境还在输出
print("重要提示: 请求成功")  # 和调试信息混在一起

# 2. 无法区分输出目标
print("错误: 数据库连接失败")  # 终端和文件不能分开

# 3. 没有时间戳
print("用户登录")  # 什么时候发生的？

# 4. 没有上下文
print("处理失败")  # 哪个请求？哪个用户？

# 5. 无法动态开关
# 要关闭调试输出只能删代码

# logging 的解决方案：
# 1. 五个日志级别（DEBUG/INFO/WARNING/ERROR/CRITICAL）
# 2. 灵活的输出目标（终端/文件/网络）
# 3. 可配置的格式（时间戳/文件名/行号）
# 4. 运行时动态调整级别
# 5. 支持结构化输出（JSON）
```

---

## logging 模块核心结构

### 四大组件

```python
import logging

# Logger：日志记录器（你的代码调用它）
# Handler：处理器（决定日志去哪：终端/文件/网络）
# Formatter：格式化器（决定日志长什么样）
# Filter：过滤器（决定哪些日志能通过）

# 它们的关系：
# Logger.log() → Filter 检查 → Handler.emit() → Formatter 格式化
# 一个 Logger 可以有多个 Handler
# 每个 Handler 有自己的 Formatter 和 Filter

# 使用流程：
logger = logging.getLogger(__name__)  # 1. 获取 Logger

handler = logging.StreamHandler()      # 2. 创建 Handler
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
handler.setFormatter(formatter)        # 3. 绑定 Formatter

logger.addHandler(handler)             # 4. 绑定 Handler
logger.setLevel(logging.DEBUG)         # 5. 设置级别

# 6. 使用
logger.debug("调试信息")
logger.info("一般信息")
logger.warning("警告信息")
logger.error("错误信息")
logger.critical("严重错误")
```

### 日志级别

```python
import logging

# Python 的 5 + 1 个日志级别（数字越小越严重？不，数字越大越严重）

# CRITICAL = 50    致命错误（系统不可用）
# ERROR    = 40    错误（某个功能不可用）
# WARNING  = 30    警告（可能有问题）
# INFO     = 20    一般信息（正常运行信息）
# DEBUG    = 10    调试信息（详细的诊断信息）
# NOTSET   = 0     未设置（继承父 Logger 的级别）

# 级别过滤原则：
# Logger 和 Handler 各有一个 level
# 两个 level 都通过才会输出
# 即：log_level >= max(logger_level, handler_level)

# 比较：
# print()           → 统一级别，无法区分
# logger.debug()    → 只有 DEBUG 及以上才输出
# logger.info()     → 只有 INFO 及以上才输出
# logger.warning()  → 只有 WARNING 及以上才输出

# 生产环境建议：root logger 设为 WARNING
# 开发环境建议：root logger 设为 DEBUG
# 关键模块：单独设为 INFO

# 修改日志级别
logger.setLevel(logging.DEBUG)  # 运行时动态改变

# 临时降级一个第三方库的日志
logging.getLogger("urllib3").setLevel(logging.WARNING)
```

---

## Logger 层级结构

```python
import logging

# Logger 是树形结构（按名字的 . 分隔）
# root = logging.getLogger()  # 根 Logger
# ├── my_app                    # logging.getLogger("my_app")
# │   ├── my_app.api            # logging.getLogger("my_app.api")
# │   └── my_app.models         # logging.getLogger("my_app.models")
# └── third_party               # logging.getLogger("third_party")

# 子 Logger 默认向上传播给父 Logger
# my_app.api 的日志也传给 my_app，再传给 root

# 这种结构的好处：
# 1. 按模块精细控制级别
# 2. 每个模块有自己的 Context
# 3. 父 Logger 可以统一配置

# 在模块中使用（最佳实践）
# my_app/api/__init__.py
logger = logging.getLogger(__name__)  # __name__ = "my_app.api"

# my_app/models/user.py
logger = logging.getLogger(__name__)  # __name__ = "my_app.models.user"

# 在入口处配置
def setup_logging():
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.WARNING)

    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # 某个模块需要更多日志
    logging.getLogger("my_app").setLevel(logging.INFO)
    logging.getLogger("my_app.api").setLevel(logging.DEBUG)

# 关闭传播（某些 Handler 不希望向上传递）
logger.propagate = False  # 日志只在这层处理，不上传给父 Logger
```

---

## Handler：日志输出目标

### 常用 Handler

```python
import logging

# 1. StreamHandler → 终端/任意流
console = logging.StreamHandler()          # sys.stderr（默认）
console = logging.StreamHandler(sys.stdout)  # sys.stdout

# 2. FileHandler → 文件
file_handler = logging.FileHandler("app.log")            # 追加写入
file_handler = logging.FileHandler("app.log", mode="w")  # 覆盖写入
file_handler = logging.FileHandler("app.log", encoding="utf-8")

# 3. RotatingFileHandler → 按大小轮转
from logging.handlers import RotatingFileHandler

rotating = RotatingFileHandler(
    "app.log",
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,               # 保留 5 个备份
)
# app.log → app.log.1 → app.log.2 → ... → app.log.5

# 4. TimedRotatingFileHandler → 按时间轮转
from logging.handlers import TimedRotatingFileHandler

timed_rotating = TimedRotatingFileHandler(
    "app.log",
    when="midnight",     # 每天午夜轮转
    interval=1,          # 间隔
    backupCount=30,      # 保留 30 天
    encoding="utf-8",
)
# when 参数："S" 秒 / "M" 分 / "H" 时 / "D" 天 / "midnight" 午夜 / "W0-W6" 周几

# 5. WatchedFileHandler → 文件被外部工具切割时自动重开
from logging.handlers import WatchedFileHandler
# logrotate 切割日志后，自动打开新文件

# 典型配置组合
def setup_production_logging():
    # 所有级别 → 文件（用于诊断）
    file_handler = RotatingFileHandler(
        "app.log", maxBytes=10_485_760, backupCount=10
    )
    file_handler.setLevel(logging.DEBUG)

    # WARNING 及以上 → 终端（实时监控）
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)

    # ERROR 及以上 → 单独的错误文件
    error_handler = RotatingFileHandler(
        "error.log", maxBytes=10_485_760, backupCount=5
    )
    error_handler.setLevel(logging.ERROR)

    # 应用配置
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(lineno)d | %(message)s"
    )

    for handler in [file_handler, console_handler, error_handler]:
        handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(error_handler)
```

### 自定义 Handler

```python
import logging
import json
from datetime import datetime

# 自定义 Handler：发送到 Webhook
class WebhookHandler(logging.Handler):
    def __init__(self, webhook_url: str):
        super().__init__()
        self.webhook_url = webhook_url
        self.setLevel(logging.WARNING)  # 只发送警告及以上

    def emit(self, record: logging.LogRecord):
        """日志记录时触发"""
        import requests
        try:
            log_data = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "function": record.funcName,
                "line": record.lineno,
            }
            requests.post(
                self.webhook_url,
                json=log_data,
                timeout=5,
            )
        except Exception:
            self.handleError(record)  # 使用内置的错误处理

# 使用
webhook = WebhookHandler("https://hooks.example.com/logs")
webhook.setFormatter(logging.Formatter("%(message)s"))  # 只需要消息
logging.getLogger().addHandler(webhook)

# 自定义 Handler：发送到 Slack
class SlackHandler(logging.Handler):
    def __init__(self, webhook_url: str, channel: str = "#errors"):
        super().__init__()
        self.webhook_url = webhook_url
        self.channel = channel
        self.setLevel(logging.ERROR)

    def emit(self, record: logging.LogRecord):
        import requests
        message = {
            "channel": self.channel,
            "text": f"[{record.levelname}] {record.getMessage()}",
            "username": "Python Bot",
        }
        try:
            requests.post(self.webhook_url, json=message, timeout=5)
        except Exception:
            self.handleError(record)
```

---

## Formatter：日志格式

### 内置字段

```python
import logging

# 所有可用字段
# %(name)s           Logger 名
# %(levelno)s        日志级别数字
# %(levelname)s      日志级别名称
# %(pathname)s       代码文件路径
# %(filename)s       代码文件名
# %(module)s         模块名
# %(funcName)s       函数名
# %(lineno)d         行号
# %(created)f        创建时间（time.time()）
# %(asctime)s        格式化时间
# %(msecs)d          毫秒
# %(relativeCreated)d 相对程序启动的时间（毫秒）
# %(thread)d         线程 ID
# %(threadName)s     线程名
# %(process)d        进程 ID
# %(processName)s    进程名
# %(message)s        日志消息

# 常用格式
default_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
# 2026-07-20 16:00:00,123 - my_app.api - INFO - 请求成功

detailed_format = "[%(asctime)s] %(levelname)-8s %(name)s:%(filename)s:%(lineno)d -> %(message)s"
# [2026-07-20 16:00:00] INFO     my_app.api:views.py:42 -> 请求成功

time_only_format = "[%(asctime)s.%(msecs)03d] %(levelname)s %(message)s"
custom_datefmt = "%Y-%m-%d %H:%M:%S"
# [2026-07-20 16:00:00.123] INFO 请求成功

# 设置日期格式
formatter = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",  # 默认是 ISO-8601
)
```

### 结构化 JSON 日志

```python
import logging
import json
from datetime import datetime

# 生产环境中推荐 JSON 格式（便于 ELK 等工具解析）

class JSONFormatter(logging.Formatter):
    """将日志格式化为 JSON 对象"""
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
            "process": record.process,
            "thread": record.thread,
        }

        # 如果有异常信息，添加到日志中
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        # 如果有额外的上下文
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)

        return json.dumps(log_entry, ensure_ascii=False)

# 使用 JSON Formatter
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())

logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

# 使用
logger.info("用户登录成功")
# {"timestamp": "2026-07-20T16:00:00", "level": "INFO", "module": "views", "message": "用户登录成功", ...}

# 带异常
try:
    1 / 0
except ZeroDivisionError:
    logger.exception("除数不能为零")
# 包含 exception 字段
```

---

## Filter：精细过滤

```python
import logging
import re

# Filter：决定哪些日志记录能通过

# 1. 按名称过滤
class ModuleFilter(logging.Filter):
    """只允许特定模块的日志通过"""
    def __init__(self, allowed_modules: list[str]):
        super().__init__()
        self.allowed_modules = allowed_modules

    def filter(self, record: logging.LogRecord) -> bool:
        return any(
            record.name.startswith(mod) for mod in self.allowed_modules
        )

# 使用
handler = logging.StreamHandler()
handler.addFilter(ModuleFilter(["my_app.api", "my_app.services"]))
# 只输出 my_app.api 和 my_app.services 的日志

# 2. 按消息内容过滤
class SensitiveDataFilter(logging.Filter):
    """过滤敏感信息（如密码、Token）"""
    def __init__(self, patterns: list[str]):
        super().__init__()
        self.patterns = [re.compile(p, re.IGNORECASE) for p in patterns]

    def filter(self, record: logging.LogRecord) -> bool:
        # 检查消息中是否包含敏感词
        msg = record.getMessage()
        for pattern in self.patterns:
            if pattern.search(msg):
                return False  # 丢弃这条日志
        return True

# 使用
handler.addFilter(SensitiveDataFilter([
    r"password[=:]\s*\S+",
    r"token[=:]\s*\S+",
    r"secret[=:]\s*\S+",
    r"api_key[=:]\s*\S+",
]))

# 3. 添加额外上下文（Filter 也可以修改 record）
class RequestContextFilter(logging.Filter):
    """为日志添加请求级别的上下文"""
    def filter(self, record: logging.LogRecord) -> bool:
        # 添加自定义字段
        record.request_id = getattr(thread_context, "request_id", None)
        record.user_id = getattr(thread_context, "user_id", None)
        return True  # 总是通过
```

---

## 配置方式

### basicConfig（快速）

```python
import logging

# basicConfig：快速配置（只能调用一次）
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    filename="app.log",           # 可选：输出到文件
    filemode="a",                 # 追加模式
)

logger = logging.getLogger(__name__)
logger.info("应用启动")  # 自动使用 basicConfig 的配置

# 注意：如果已经调用了 logging 的任何方法
#（如 logging.info()、logging.getLogger().addHandler()）
# basicConfig 就失效了（因为 root logger 已经配置了）
```

### dictConfig（推荐）

```python
from logging.config import dictConfig

# dictConfig：完整的配置（可切分、可维护）

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,

    # Formatter 定义
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "detailed": {
            "format": "[%(asctime)s] %(levelname)-8s %(name)s:%(filename)s:%(lineno)d %(message)s",
        },
        "json": {
            "()": "my_app.logging_config.JSONFormatter",
        },
    },

    # Handler 定义
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "detailed",
            "filename": "logs/app.log",
            "maxBytes": 10_485_760,
            "backupCount": 10,
            "encoding": "utf8",
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": "detailed",
            "filename": "logs/error.log",
            "maxBytes": 10_485_760,
            "backupCount": 5,
        },
        "json_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "json",
            "filename": "logs/app.jsonl",
            "maxBytes": 10_485_760,
            "backupCount": 10,
        },
    },

    # Logger 定义
    "loggers": {
        "my_app": {
            "level": "DEBUG",
            "handlers": ["console", "file"],
            "propagate": False,
        },
        "my_app.api": {
            "level": "DEBUG",
            "handlers": ["console", "file"],
            "propagate": False,
        },
        "uvicorn": {
            "level": "INFO",
        },
        "sqlalchemy": {
            "level": "WARNING",
        },
    },

    # Root Logger
    "root": {
        "level": "WARNING",
        "handlers": ["console", "error_file", "json_file"],
    },
}

# 应用配置
dictConfig(LOGGING_CONFIG)
```

---

## 实战集成

### FastAPI 集成

```python
import logging
from fastapi import FastAPI, Request
import time
import uuid

# 配置日志
from logging.config import dictConfig

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "my_app.logging_config.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "default",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "default",
            "filename": "logs/api.jsonl",
            "maxBytes": 10_485_760,
            "backupCount": 10,
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "file"],
    },
}

dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("my_app")

app = FastAPI()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """请求日志中间件"""
    request_id = str(uuid.uuid4())[:8]
    start = time.time()

    logger.info(
        "request_start",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
        },
    )

    try:
        response = await call_next(request)
        duration = time.time() - start

        logger.info(
            "request_complete",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            },
        )
        return response
    except Exception as e:
        duration = time.time() - start
        logger.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "duration_ms": round(duration * 1000, 2),
                "error": str(e),
            },
        )
        raise

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    logger.info("查询用户", extra={"user_id": user_id})
    # ... 业务逻辑 ...
    return {"user_id": user_id}
```

### Django 集成

```python
# settings.py
import os
from logging.config import dictConfig

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "logs/django.log"),
            "when": "midnight",
            "backupCount": 30,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
        },
        "django.request": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

# 使用
import logging
logger = logging.getLogger(__name__)

def my_view(request):
    logger.info("处理请求", extra={"user": request.user.id})
```

---

## 生产运维最佳实践

### 日志轮转策略

```python
from logging.handlers import TimedRotatingFileHandler, RotatingFileHandler

# 方案 1：按大小轮转（适合单机）
file_handler = RotatingFileHandler(
    "app.log",
    maxBytes=100 * 1024 * 1024,  # 100MB
    backupCount=10,               # 保留 10 个 => 最多 1GB
)

# 方案 2：按时间轮转（适合长时间运行）
file_handler = TimedRotatingFileHandler(
    "app.log",
    when="midnight",    # 每天午夜轮转
    backupCount=30,     # 保留 30 天
)

# 方案 3：外部工具 logrotate（生产推荐）
# /etc/logrotate.d/myapp
# /var/log/myapp/*.log {
#     daily
#     rotate 30
#     compress
#     delaycompress
#     missingok
#     notifempty
#     copytruncate    # 复制并截断（不影响应用写入）
#     postrotate
#         kill -HUP $(cat /var/run/myapp.pid)
#     endscript
# }
```

### 日志等级动态调整

```python
import logging
import os

# 通过环境变量控制日志级别
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))

# 生产环境：
# LOG_LEVEL=WARNING python app.py
# 开发环境：
# LOG_LEVEL=DEBUG python app.py

# 运行时动态调整（暴露 API 或 endpoint）
@app.post("/debug/log-level")
async def set_log_level(level: str):
    """运行时修改日志级别（调试用）"""
    level = level.upper()
    if level not in ["DEBUG", "INFO", "WARNING", "ERROR"]:
        return {"error": "无效级别"}
    logging.getLogger().setLevel(getattr(logging, level))
    return {"level": level}
```

### 敏感信息过滤

```python
import logging
import re

class SensitiveDataFilter(logging.Filter):
    """过滤日志中的敏感信息"""
    SENSITIVE_PATTERNS = [
        (r"(password|passwd|secret|token|api_key)[=:]\s*\S+", r"\1=***"),
        (r'"password"\s*:\s*"[^"]+"', '"password": "***"'),
        (r'"token"\s*:\s*"[^"]+"', '"token": "***"'),
        (r'"credit_card"\s*:\s*"[^"]+"', '"credit_card": "***"'),
        (r'\b\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}\b', '****-****-****-****'),
        (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '***@***'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "msg") and isinstance(record.msg, str):
            for pattern, replacement in self.SENSITIVE_PATTERNS:
                record.msg = re.sub(pattern, replacement, record.msg)
            # 也处理 args 中的字符串参数
            if record.args:
                record.args = tuple(
                    self._mask_arg(arg) for arg in record.args
                )
        return True

    def _mask_arg(self, arg):
        if isinstance(arg, str):
            for pattern, replacement in self.SENSITIVE_PATTERNS:
                arg = re.sub(pattern, replacement, arg)
        return arg

# 应用
handler = logging.StreamHandler()
handler.addFilter(SensitiveDataFilter())

logger = logging.getLogger(__name__)
logger.addHandler(handler)

# 密码会被自动遮盖
logger.info("用户 %s 注册成功，密码: %s", "Alice", "secret123")
# 输出：用户 Alice 注册成功，密码: ***
```

---

## 常见陷阱与最佳实践

### 陷阱 1：重复日志

```python
# ❌ 陷阱：在模块中 addHandler 导致重复输出
# module_a.py
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
logger.addHandler(handler)  # ❌ 每次 import 都可能重复添加！

# ✅ 正确：只在入口配置
# main.py
logging.basicConfig(level=logging.INFO)

# module_a.py
logger = logging.getLogger(__name__)  # 继承 root 的配置
logger.info("这条日志不会重复")

# ✅ 或者：检查是否已有 Handler
if not logger.handlers:
    logger.addHandler(handler)
```

### 陷阱 2：异常信息丢失

```python
# ❌ 陷阱：只用 error() 不传 exc_info
try:
    1 / 0
except ZeroDivisionError:
    logging.error("计算失败")  # traceback 丢失！

# ✅ 正确：使用 exception() 或 exc_info=True
try:
    1 / 0
except ZeroDivisionError:
    logging.exception("计算失败")  # 自动包含 traceback
    # 等价于：
    logging.error("计算失败", exc_info=True)
```

### 陷阱 3：字符串格式化性能

```python
# ❌ 陷阱：使用 f-string 总是执行格式化
logger.debug(f"用户 {get_user_data()} 登录")  # 即使 DEBUG 被禁用，get_user_data() 也执行了

# ✅ 正确：使用 % 格式化（延迟求值）
logger.debug("用户 %s 登录", get_user_data())  # 只有 level 通过时才会格式化

# ✅ 或者：先检查级别
if logger.isEnabledFor(logging.DEBUG):
    logger.debug(f"用户 {get_user_data()} 登录")
```

### 陷阱 4：日志文件路径不存在

```python
# ❌ 陷阱：目录不存在导致 FileHandler 创建失败
handler = logging.FileHandler("logs/app.log")
# FileNotFoundError: [Errno 2] No such file or directory: 'logs/app.log'

# ✅ 正确：确保目录存在
import os
log_dir = "logs"
os.makedirs(log_dir, exist_ok=True)
handler = logging.FileHandler(os.path.join(log_dir, "app.log"))
```

---

## 总结

```
logging 组件速查：
─────────────────────────────────
组件             作用                 常用实现
─────────────────────────────────
Logger           日志记录器            getLogger(__name__)
Handler          输出目标             StreamHandler / FileHandler
                                       RotatingFileHandler
                                       TimedRotatingFileHandler
                                       WatchedFileHandler
                                       HTTPHandler / SocketHandler
Formatter        格式编排             Formatter / JSONFormatter
Filter           过滤决策             Filter（按模块/内容过滤）
─────────────────────────────────
```

```
日志级别速查：
─────────────────────────────────
级别      数值    使用场景
─────────────────────────────────
DEBUG     10      开发调试（函数入口/变量值/流程追踪）
INFO      20      运行信息（请求/响应/用户操作）
WARNING   30      潜在问题（即将过期/资源紧张/降级处理）
ERROR     40      功能失效（数据库连接失败/第三方服务超时）
CRITICAL  50      系统崩溃（磁盘满/内存耗尽/无法恢复）
─────────────────────────────────
```

```
Handler 配置选择：
─────────────────────────────────
场景                    Handler 方案
─────────────────────────────────
开发调试                 StreamHandler(stdout)
单机部署                 RotatingFileHandler (100MB × 10)
长时间服务               TimedRotatingFileHandler (midnight × 30天)
分布式系统               结构化 JSON → ELK/Logstash
云原生/Docker             stdout 结构化 JSON（由容器平台收集）
实时告警                  WebhookHandler / SlackHandler / HTTPHandler
─────────────────────────────────
```

```
最佳实践：
─────────────────────────────────
✅ 使用 __name__ 获取 Logger（自动反映模块层级）
✅ 只在入口（main.py）配置 logging，模块只获取 Logger
✅ 用 logging.exception() 记录异常（自动含 traceback）
✅ 结构化日志用 JSON（便于 ELK/Splunk 分析）
✅ 日志轮转防止磁盘写满
✅ 过滤敏感信息（密码/Token/信用卡）
✅ 使用 % 格式化而非 f-string（延迟求值）
✅ CRITICAL 级别发送实时告警（邮件/Slack/短信）
✅ dictConfig 管理配置（比 basicConfig 更强大）
✅ 每个日志记录考虑"看到这个日志的人需要知道什么？"
─────────────────────────────────
```

日志是软件的"飞行记录仪"——没有日志的生产环境就像没有仪表盘的飞机。理解 logging 的四大组件（Logger/Handler/Formatter/Filter），合理配置轮转策略，结构化输出到中央日志系统，你的 Python 应用就有了生产级可观测性 🦐

本文由小虾子 🦐 撰写
