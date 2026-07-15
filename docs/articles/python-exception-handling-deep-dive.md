---
title: Python 错误处理与异常体系完全指南：从 try/except 到 ExceptionGroup
date: 2026-07-15
---

# Python 错误处理与异常体系完全指南：从 try/except 到 ExceptionGroup

> 异常不是"出错时才碰的东西"——它是 Python 控制流的一等公民。从内置异常层级到自定义异常设计，从 `try/except/else/finally` 的完整语义到 Python 3.11 的 `ExceptionGroup`，从异常链 `raise ... from` 到 `@contextmanager` 异常传递，本文系统覆盖 Python 异常处理的每一个重要细节。

本文由小虾子 🦐 撰写

## 异常的本质：不只是"出错了"

### 异常作为控制流

```python
# 异常不只是错误信号，它是 Python 控制流机制的一部分
# 1. 异常是对象（有类型、有属性、有继承关系）
# 2. 异常可以捕获、传递、修改、重新抛出
# 3. 异常可以携带上下文信息（traceback、cause、context）

# 异常 vs 返回值：
# 返回值：调用者必须主动检查（容易被忽略）
# 异常：不处理就会向上传播（很难被忽略）

# 典型场景：字典查找
# 方式 1：返回值检查（容易忘记处理 None）
def get_value(key):
    return data.get(key)  # 找不到返回 None

value = get_value("name")
if value is not None:  # 容易忘记
    print(value)

# 方式 2：异常（不处理就崩溃，很难忽略）
def get_value_strict(key):
    if key not in data:
        raise KeyError(f"Key '{key}' not found")
    return data[key]

try:
    value = get_value_strict("name")
except KeyError as e:
    print(f"键不存在: {e}")
```

### Python 异常层级

```python
# Python 内置异常层级（简化版）
# BaseException
# ├── SystemExit                  # sys.exit() 触发
# ├── KeyboardInterrupt          # Ctrl+C
# ├── GeneratorExit              # 生成器关闭
# └── Exception                  ← 大部分异常的基类
#     ├── StopIteration          # 迭代结束
#     ├── ArithmeticError
#     │   ├── ZeroDivisionError
#     │   ├── OverflowError
#     │   └── FloatingPointError
#     ├── LookupError
#     │   ├── KeyError
#     │   └── IndexError
#     ├── OSError
#     │   ├── FileNotFoundError
#     │   ├── PermissionError
#     │   ├── TimeoutError
#     │   └── ConnectionError
#     │       ├── ConnectionRefusedError
#     │       └── ConnectionResetError
#     ├── TypeError
#     ├── ValueError
#     │   └── UnicodeError
#     │       ├── UnicodeDecodeError
#     │       └── UnicodeEncodeError
#     ├── AttributeError
#     ├── NameError
#     │   └── UnboundLocalError
#     ├── RuntimeError
#     │   ├── RecursionError
#     │   └── NotImplementedError
#     ├── StopAsyncIteration      # 异步迭代结束
#     ├── ImportError
#     │   └── ModuleNotFoundError
#     └── Warning
#         ├── DeprecationWarning
#         ├── UserWarning
#         └── FutureWarning

# 关键区别：Exception vs BaseException
# Exception：常规异常的基类（应该捕获）
# BaseException：包括 SystemExit/KeyboardInterrupt（不应该随意捕获）

# ❌ 危险：捕获 BaseException
try:
    while True:
        pass
except BaseException:  # 连 Ctrl+C 都捕获了！
    print("永远停不下来")

# ✅ 正确：只捕获 Exception
try:
    do_something()
except Exception as e:
    print(f"出错了: {e}")
    # Ctrl+C 仍然可以中断
```

---

## try/except/else/finally 完整语义

### 四段式结构

```python
# try/except/else/finally 的完整语义

def safe_divide(a, b):
    """安全除法，演示完整的 try 结构"""
    result = None
    try:
        # try 块：可能抛出异常的代码
        result = a / b
    except ZeroDivisionError as e:
        # except 块：捕获特定异常
        print(f"除零错误: {e}")
        result = float('inf')
    except TypeError as e:
        # 多个 except 块：从具体到通用
        print(f"类型错误: {e}")
        result = None
    except Exception as e:
        # 兜底捕获（尽量少用）
        print(f"未知错误: {e}")
        raise  # 重新抛出
    else:
        # else 块：try 没有抛出异常时执行
        # 只有成功时才执行（与 try 块分离，避免意外捕获）
        print(f"计算成功: {result}")
    finally:
        # finally 块：无论如何都执行（清理资源）
        print("除法运算结束")

    return result

print(safe_divide(10, 2))
# 计算成功: 5.0
# 除法运算结束
# 5.0

print(safe_divide(10, 0))
# 除零错误: division by zero
# 除法运算结束
# inf
```

### else 的意义

```python
# else 块的作用：避免意外捕获

# ❌ 没有 else：else 中的代码异常也会被 except 捕获
def bad_example():
    try:
        data = load_data()
        process(data)  # 如果这里出错，也会被 except 捕获！
    except FileNotFoundError:
        print("文件不存在")

# 问题：process() 的错误被误当成 load_data() 的错误
# 解决：用 else 分离

# ✅ 有 else：只捕获 try 中的异常
def good_example():
    try:
        data = load_data()
    except FileNotFoundError:
        print("文件不存在")
        return
    else:
        process(data)  # 这里的异常不会被上面的 except 捕获

# else 的典型场景：文件读取后处理
def read_and_parse(filepath: str):
    try:
        with open(filepath) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"文件不存在: {filepath}")
        return None
    except PermissionError:
        print(f"无权限: {filepath}")
        return None
    else:
        # 只在文件成功读取后才解析
        return parse_json(content)  # 解析错误不会被上面的 except 捕获
```

### finally 的保证

```python
# finally：无论如何都会执行（即使 try/except 中有 return）

def example():
    try:
        return "try"
    finally:
        print("finally 也会执行！")  # 先打印，再返回 "try"

print(example())
# finally 也会执行！
# try

# finally 中的 return 会覆盖 try 中的 return
def bad_return():
    try:
        return "try"
    finally:
        return "finally"  # ⚠️ 覆盖了 try 的返回值！

print(bad_return())  # finally（不是 try！）

# finally 用于资源清理
def read_file_safe(filepath: str):
    f = None
    try:
        f = open(filepath)
        return f.read()
    except IOError as e:
        print(f"读取失败: {e}")
        return ""
    finally:
        if f:
            f.close()  # 确保文件关闭

# 更 Pythonic：用 with 语句代替 try/finally
def read_file_pythonic(filepath: str):
    with open(filepath) as f:
        return f.read()
    # with 语句自动调用 __exit__，等价于 finally: f.close()
```

### 多异常捕获

```python
# 捕获多个异常
try:
    value = int(input("输入数字: "))
except (ValueError, TypeError) as e:
    print(f"输入无效: {e}")

# 异常的属性
try:
    raise ValueError("参数错误")
except ValueError as e:
    print(f"消息: {e}")           # 参数错误
    print(f"参数: {e.args}")      # ('参数错误',)
    print(f"字符串: {str(e)}")    # 参数错误
    print(f"类型: {type(e)}")     # <class 'ValueError'>

# 异常重新抛出
def process_data(data):
    try:
        return transform(data)
    except KeyError as e:
        print(f"处理失败，缺少键: {e}")
        raise  # 重新抛出当前异常（保留 traceback）

# raise vs raise e 的区别
try:
    ...
except SomeError as e:
    raise       # 保留原始 traceback（推荐）
    raise e     # 会重置 traceback（不推荐）
    raise Exception("新异常") from e  # 异常链（推荐）
```

---

## 自定义异常设计

### 何时创建自定义异常

```python
# 原则：当内置异常无法精确描述业务错误时

# ❌ 不好的做法：用内置异常表达业务逻辑
def withdraw(account, amount):
    if amount > account.balance:
        raise ValueError("余额不足")  # 语义不清晰
    if amount < 0:
        raise ValueError("金额不能为负")  # 无法区分

# ✅ 好的做法：自定义异常层级
class BankError(Exception):
    """银行系统异常基类"""
    pass

class InsufficientFundsError(BankError):
    """余额不足"""
    def __init__(self, balance: float, amount: float):
        self.balance = balance
        self.amount = amount
        super().__init__(f"余额不足: 当前 {balance}，尝试取出 {amount}")

class InvalidAmountError(BankError):
    """无效金额"""
    def __init__(self, amount: float):
        self.amount = amount
        super().__init__(f"金额无效: {amount}")

class AccountFrozenError(BankError):
    """账户冻结"""
    def __init__(self, account_id: str):
        self.account_id = account_id
        super().__init__(f"账户已冻结: {account_id}")

def withdraw(account, amount):
    if account.frozen:
        raise AccountFrozenError(account.id)
    if amount < 0:
        raise InvalidAmountError(amount)
    if amount > account.balance:
        raise InsufficientFundsError(account.balance, amount)
    account.balance -= amount
    return account.balance

# 使用方可以精确捕获
try:
    withdraw(my_account, 1000)
except InsufficientFundsError as e:
    print(f"余额不足: 当前 {e.balance}，需要 {e.amount}")
except AccountFrozenError:
    print("账户已冻结，请联系客服")
except BankError as e:
    print(f"银行错误: {e}")
```

### 异常层级设计原则

```python
# 原则 1：建立业务异常基类
class AppError(Exception):
    """应用异常基类"""
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code or "UNKNOWN"
        super().__init__(message)

# 原则 2：按领域分组
class DatabaseError(AppError):
    """数据库相关异常"""
    pass

class ValidationError(AppError):
    """数据验证异常"""
    pass

class AuthError(AppError):
    """认证授权异常"""
    pass

# 原则 3：具体异常继承领域异常
class ConnectionFailedError(DatabaseError):
    pass

class QueryTimeoutError(DatabaseError):
    pass

class InvalidTokenError(AuthError):
    pass

class PermissionDeniedError(AuthError):
    pass

# 原则 4：携带结构化数据
class ValidationError(AppError):
    """验证错误，携带字段级别的错误信息"""
    def __init__(self, errors: dict[str, str]):
        self.errors = errors  # {"email": "格式错误", "age": "必须为正数"}
        super().__init__(
            f"验证失败: {', '.join(f'{k}: {v}' for k, v in errors.items())}",
            code="VALIDATION_ERROR"
        )

# 使用
try:
    raise ValidationError({"email": "格式错误", "age": "必须为正数"})
except ValidationError as e:
    for field, msg in e.errors.items():
        print(f"  {field}: {msg}")
    print(f"错误码: {e.code}")
```

---

## 异常链：raise ... from

### 显式异常链（cause）

```python
# raise NewException from original_exception
# 表示"新异常是由原始异常引起的"

def load_config(filepath: str) -> dict:
    try:
        with open(filepath) as f:
            import json
            return json.load(f)
    except FileNotFoundError as e:
        # 链式异常：把 FileNotFoundError 包装成 ConfigError
        raise ConfigError(f"配置文件不存在: {filepath}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"配置文件格式错误: {filepath}") from e

class ConfigError(Exception):
    pass

try:
    config = load_config("missing.json")
except ConfigError as e:
    print(f"配置错误: {e}")
    print(f"原始异常: {e.__cause__}")  # FileNotFoundError 实例
    # traceback 会显示：
    # FileNotFoundError: [Errno 2] No such file or directory: 'missing.json'
    # The above exception was the direct cause of the following exception:
    # ConfigError: 配置文件不存在: missing.json
```

### 隐式异常链（context）

```python
# 在 except 块中 raise 新异常时，Python 自动设置 __context__
# 不需要 from，Python 自动链接

def process(data):
    try:
        result = data["key"]  # 可能 KeyError
    except KeyError:
        # 在 except 块中抛出新异常，自动设置 __context__
        raise RuntimeError("处理数据时发生错误")  # __context__ 自动设为 KeyError

try:
    process({})
except RuntimeError as e:
    print(f"异常: {e}")
    print(f"上下文: {e.__context__}")  # KeyError 实例
    # traceback 显示：
    # KeyError: 'key'
    # During handling of the above exception, another exception occurred:
    # RuntimeError: 处理数据时发生错误
```

### from None：抑制异常链

```python
# 有时不希望暴露原始异常（安全考虑）
def authenticate(token: str):
    try:
        decoded = decode_jwt(token)
    except Exception:
        # from None：不暴露原始异常信息
        raise AuthError("认证失败") from None

try:
    authenticate("invalid_token")
except AuthError as e:
    print(e)  # 认证失败（没有 __cause__，也没有 __context__）
    # traceback 只显示 AuthError，不显示 JWT 解码错误
```

---

## ExceptionGroup（Python 3.11+）

### 为什么需要 ExceptionGroup？

```python
# 传统问题：一次只能抛出一个异常
# 但并发场景中，多个任务可能同时失败

# Python 3.11 引入 ExceptionGroup：一次抛出多个异常

def parallel_tasks():
    errors = []
    for i in range(3):
        try:
            task(i)
        except Exception as e:
            errors.append(e)

    if errors:
        # 一次抛出所有错误
        raise ExceptionGroup("多个任务失败", errors)

# except* 语法：捕获 ExceptionGroup 中的特定异常
try:
    parallel_tasks()
except* ValueError as eg:
    # eg 是 ExceptionGroup，包含所有 ValueError
    for e in eg.exceptions:
        print(f"ValueError: {e}")
except* TypeError as eg:
    for e in eg.exceptions:
        print(f"TypeError: {e}")

# except* vs except
# except：一次只捕获一个异常
# except*：从 ExceptionGroup 中提取特定类型的异常
```

### ExceptionGroup 实战

```python
# 场景：批量验证
class ValidationError(Exception):
    pass

def validate_user(user: dict):
    errors = []

    if not user.get("name"):
        errors.append(ValidationError("用户名不能为空"))
    if not user.get("email"):
        errors.append(ValidationError("邮箱不能为空"))
    elif "@" not in user["email"]:
        errors.append(ValidationError("邮箱格式错误"))
    if user.get("age", 0) < 0:
        errors.append(ValidationError("年龄不能为负数"))

    if errors:
        raise ExceptionGroup("用户验证失败", errors)

try:
    validate_user({"name": "", "email": "invalid", "age": -1})
except* ValidationError as eg:
    print(f"共 {len(eg.exceptions)} 个验证错误:")
    for e in eg.exceptions:
        print(f"  - {e}")
# 共 3 个验证错误:
#   - 用户名不能为空
#   - 邮箱格式错误
#   - 年龄不能为负数

# 嵌套 ExceptionGroup
def validate_batch(users: list[dict]):
    all_errors = []
    for i, user in enumerate(users):
        try:
            validate_user(user)
        except ExceptionGroup as eg:
            # 嵌套：每个用户的错误组成子组
            all_errors.append(ExceptionGroup(f"用户 #{i}", eg.exceptions))

    if all_errors:
        raise ExceptionGroup("批量验证失败", all_errors)
```

---

## 异常与上下文管理器

### @contextmanager 中的异常处理

```python
from contextlib import contextmanager

# @contextmanager 中的异常会传递到 with 块
@contextmanager
def open_database(connection_string: str):
    conn = None
    try:
        conn = connect(connection_string)
        yield conn  # with 块中的代码在这里执行
    except Exception as e:
        # 捕获 with 块中抛出的异常
        print(f"数据库操作出错: {e}")
        if conn:
            conn.rollback()
        raise  # 重新抛出
    finally:
        if conn:
            conn.close()

# 使用
with open_database("postgresql://localhost/mydb") as db:
    db.execute("INSERT INTO users VALUES (...)")  # 如果出错，会 rollback

# 抑制异常（@contextmanager 特有）
from contextlib import suppress

# suppress：忽略指定异常（等价于 try/except/pass）
with suppress(FileNotFoundError):
    os.remove("temp.txt")  # 文件不存在时不报错

# 等价于：
try:
    os.remove("temp.txt")
except FileNotFoundError:
    pass

# 多个异常
with suppress(FileNotFoundError, PermissionError):
    os.remove("temp.txt")
```

### 上下文管理器组合

```python
from contextlib import ExitStack

# ExitStack：动态管理多个上下文
def process_files(files: list[str]):
    with ExitStack() as stack:
        # 动态打开多个文件
        handles = [
            stack.enter_context(open(f))
            for f in files
        ]
        # 所有文件会在 with 结束时自动关闭
        for h in handles:
            print(h.read())

# ExitStack + suppress：条件抑制
def safe_cleanup(files: list[str]):
    with ExitStack() as stack:
        for f in files:
            stack.enter_context(suppress(FileNotFoundError))
            os.remove(f)  # 不存在的文件不会报错
```

---

## 异常与日志

### 异常记录最佳实践

```python
import logging
import traceback

logger = logging.getLogger(__name__)

# 1. 记录异常 + traceback
try:
    do_something()
except Exception as e:
    logger.exception("操作失败")  # 自动包含 traceback
    # 等价于 logger.error("操作失败", exc_info=True)

# 2. 记录但不抛出
def safe_call(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logger.error(f"调用 {func.__name__} 失败: {e}", exc_info=True)
        return None

# 3. traceback 格式化
try:
    do_something()
except Exception as e:
    tb_str = traceback.format_exc()
    logger.error(f"异常详情:\n{tb_str}")

# 4. 结构化异常日志
try:
    process_order(order_id)
except Exception as e:
    logger.error(
        "订单处理失败",
        extra={
            "order_id": order_id,
            "error_type": type(e).__name__,
            "error_message": str(e),
        },
        exc_info=True,
    )
    raise  # 记录后重新抛出，让上层也处理
```

### 重试机制

```python
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

def retry(max_attempts=3, delay=1.0, exceptions=(Exception,)):
    """重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    logger.warning(
                        f"{func.__name__} 第 {attempt}/{max_attempts} 次失败: {e}"
                    )
                    if attempt < max_attempts:
                        time.sleep(delay * attempt)  # 指数退避
            raise last_exception  # 所有重试都失败
        return wrapper
    return decorator

# 使用
@retry(max_attempts=3, delay=1.0, exceptions=(ConnectionError, TimeoutError))
def fetch_data(url: str):
    import requests
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
    return resp.json()

# 带指数退避的重试
@retry(max_attempts=5, delay=0.5, exceptions=(ConnectionError,))
def api_call(endpoint: str):
    # 第一次失败等 0.5s，第二次 1s，第三次 1.5s...
    return requests.get(endpoint).json()
```

---

## 实战案例

### 案例 1：API 错误处理

```python
from dataclasses import dataclass
from enum import Enum

class ErrorCode(Enum):
    VALIDATION = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    INTERNAL = "INTERNAL_ERROR"

class APIError(Exception):
    def __init__(self, code: ErrorCode, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)

class UserNotFoundError(APIError):
    def __init__(self, user_id: str):
        super().__init__(
            ErrorCode.NOT_FOUND,
            f"用户不存在: {user_id}",
            status=404,
        )

class ValidationError(APIError):
    def __init__(self, errors: dict):
        self.errors = errors
        super().__init__(
            ErrorCode.VALIDATION,
            "请求参数验证失败",
            status=422,
        )

# FastAPI 集成
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status,
        content={
            "error": {
                "code": exc.code.value,
                "message": exc.message,
                "details": getattr(exc, "errors", None),
            }
        },
    )

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    user = find_user(user_id)
    if not user:
        raise UserNotFoundError(user_id)
    return user
```

### 案例 2：资源清理链

```python
class ResourceManager:
    """多资源管理：确保所有资源都被正确清理"""

    def __init__(self):
        self.resources = []

    def acquire(self, name: str):
        print(f"获取资源: {name}")
        self.resources.append(name)
        return self

    def release_all(self):
        """逆序释放所有资源"""
        while self.resources:
            name = self.resources.pop()
            print(f"释放资源: {name}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release_all()
        if exc_type:
            print(f"异常被捕获: {exc_type.__name__}: {exc_val}")
        return False  # 不抑制异常

# 使用
with ResourceManager() as rm:
    rm.acquire("数据库连接")
    rm.acquire("文件句柄")
    rm.acquire("网络锁")
    # 模拟异常
    raise ValueError("业务错误")
# 输出：
# 获取资源: 数据库连接
# 获取资源: 文件句柄
# 获取资源: 网络锁
# 释放资源: 网络锁
# 释放资源: 文件句柄
# 释放资源: 数据库连接
# 异常被捕获: ValueError: 业务错误
# 然后异常继续传播
```

---

## 常见陷阱与最佳实践

### 陷阱 1：过宽的异常捕获

```python
# ❌ 过宽：捕获所有异常（隐藏 bug）
try:
    result = process(data)
except:  # 裸 except，捕获一切（包括 KeyboardInterrupt！）
    result = None

# ❌ 捕获 Exception 但不做任何处理
try:
    result = process(data)
except Exception:
    pass  # 静默吞掉异常（问题被隐藏）

# ✅ 正确：捕获具体异常
try:
    result = process(data)
except (ValueError, KeyError) as e:
    logger.warning(f"数据处理失败: {e}")
    result = None
except Exception as e:
    logger.exception("未知错误")
    raise  # 重新抛出未知异常
```

### 陷阱 2：异常控制流滥用

```python
# ❌ 滥用：用异常代替条件判断
try:
    value = data[key]
except KeyError:
    value = default

# ✅ 正确：用 get() 方法
value = data.get(key, default)

# ❌ 滥用：用异常做循环退出
while True:
    try:
        item = next(iterator)
    except StopIteration:
        break

# ✅ 正确：用 for 循环
for item in iterator:
    ...

# 但有些场景用异常是正确的：
# 1. 调用第三方库（它抛异常，你必须捕获）
# 2. 在深层函数中报告错误，在高层函数中处理
# 3. 资源获取失败（文件不存在、网络超时）
```

### 陷阱 3：丢失 traceback

```python
# ❌ 丢失 traceback：重新创建异常
try:
    do_something()
except SomeError as e:
    raise SomeError(f"包装: {e}")  # 原始 traceback 丢失！

# ✅ 保留 traceback：使用 from
try:
    do_something()
except SomeError as e:
    raise SomeError(f"包装: {e}") from e  # 保留原始异常链

# ✅ 或者直接 raise
try:
    do_something()
except SomeError:
    raise  # 完全保留原始异常
```

---

## 总结

```
异常层级速查：
─────────────────────────────────
BaseException              所有异常的基类
├── SystemExit             sys.exit()
├── KeyboardInterrupt      Ctrl+C
├── GeneratorExit          生成器关闭
└── Exception              常规异常基类（自定义异常继承这个）
    ├── ValueError         值错误
    ├── TypeError          类型错误
    ├── KeyError           键不存在
    ├── IndexError         索引越界
    ├── AttributeError     属性不存在
    ├── OSError            系统错误
    │   ├── FileNotFoundError
    │   ├── PermissionError
    │   └── TimeoutError
    ├── RuntimeError       运行时错误
    │   └── RecursionError
    ├── ImportError        导入错误
    └── StopIteration      迭代结束
```

```
try/except/else/finally 语义：
─────────────────────────────────
try       尝试执行（可能抛出异常）
except    捕获异常（可多个，从具体到通用）
else      try 没有抛出异常时执行（避免意外捕获）
finally   无论如何都执行（资源清理）
```

```
异常链速查：
─────────────────────────────────
raise NewError from orig    显式链（__cause__）
raise NewError              隐式链（__context__，在 except 块中）
raise NewError from None    抑制链（不暴露原始异常）
```

```
最佳实践：
─────────────────────────────────
✅ 捕获具体异常，不要裸 except
✅ 自定义异常继承 Exception（不是 BaseException）
✅ 建立业务异常层级（基类 → 领域 → 具体错误）
✅ 异常携带结构化数据（不只是消息字符串）
✅ 用 raise ... from 保留异常链
✅ logger.exception() 记录完整 traceback
✅ else 块分离"可能出错"和"后续处理"
✅ finally 块做资源清理（或用 with 语句）
✅ ExceptionGroup 处理并发多错误（Python 3.11+）
✅ 避免用异常代替条件判断
```

异常处理是软件可靠性的基石——好的异常设计让错误可见、可追踪、可恢复，坏的异常设计让 bug 隐藏、调试困难、系统脆弱。掌握 Python 异常体系的完整图景，从内置层级到自定义设计，从 `try/except/else/finally` 到 `ExceptionGroup`，你的代码将拥有生产级的健壮性 🦐

本文由小虾子 🦐 撰写
