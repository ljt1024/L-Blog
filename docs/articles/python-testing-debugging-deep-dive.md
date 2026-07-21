---
title: Python 测试与调试完全指南：从 pytest 到 pdb 的工程实战
date: 2026-07-17
---

# Python 测试与调试完全指南：从 pytest 到 pdb 的工程实战

> 不写测试的代码叫"草稿"，不调试就上线的项目叫"赌局"。从 `pytest` 的核心机制到 `pdb` 的交互调试，从 `fixture` 的依赖注入到 `mock` 的外部服务打桩，从 `coverage` 的覆盖率分析到性能剖析——本文覆盖 Python 测试与调试的每一个关键环节。

本文由小虾子  撰写

## 为什么需要测试？

```
测试价值金字塔：
─────────────────────────────────
顶层：业务正确性保障（CI 门禁）
中层：重构安全感（改了代码不怕）
底层：设计反馈（好的测试逼出好的设计）
─────────────────────────────────

没有测试的代码：
是 刚写完时运行正确
否 改了一个逻辑可能坏掉三个地方
否 不敢重构
否 新成员不敢改
否 代码质量只依靠"小心谨慎"
```

---

## pytest：Python 测试事实标准

### 基础用法

```python
# 安装
# pip install pytest

# 核心约定（自动发现测试）：
# 1. 文件以 test_ 开头（或 _test 结尾）
# 2. 函数以 test_ 开头
# 3. 类以 Test 开头（不含 __init__）

# test_math.py
def test_addition():
    """测试加法"""
    assert 1 + 1 == 2

def test_division():
    """测试除法"""
    assert 10 / 2 == 5

def test_division_by_zero():
    """测试除零异常"""
    with pytest.raises(ZeroDivisionError):  # 断言抛出异常
        1 / 0

# 运行测试
# pytest                     # 自动发现
# pytest test_math.py        # 指定文件
# pytest -v                  # 详细输出
# pytest -k "addition"       # 按名称过滤
# pytest -k "not slow"       # 排除
```

### 断言机制

```python
# pytest 的 assert 是增强版（不是简单的 True/False）

def test_assertions():
    # 相等断言（显示差异）
    result = {"name": "Alice", "age": 30}
    assert result == {"name": "Alice", "age": 30}

    # 近似相等
    assert 0.1 + 0.2 == pytest.approx(0.3)

    # 集合断言
    assert "Alice" in result.values()
    assert len(result) == 2
    assert all(v is not None for v in result.values())

    # 异常断言
    with pytest.raises(ValueError, match="invalid value"):
        raise ValueError("invalid value")

    # 警告断言
    import warnings
    with pytest.warns(UserWarning, match="deprecated"):
        warnings.warn("deprecated", UserWarning)

# pytest 失败的 assert 会自动展开显示：
# assert 1 + 1 == 3
# AssertionError:
# assert (1 + 1) == 3
#  +
#     2
```

---

## Fixture：依赖注入核心

### 基础 Fixture

```python
import pytest

# fixture：可复用的测试依赖（类似依赖注入）
@pytest.fixture
def db_connection():
    """提供数据库连接"""
    conn = Database.connect("test://localhost")
    yield conn  # yield 之前的代码在测试前执行
    conn.close()  # yield 之后的代码在测试后执行（清理）

# 使用 fixture 的方式 1：参数注入（推荐）
def test_insert(db_connection):  # 参数名匹配 fixture 名
    db_connection.insert("users", {"name": "Alice"})
    assert db_connection.query("users").count == 1

# 使用 fixture 的方式 2：显式请求
@pytest.mark.usefixtures("db_connection")
def test_with_fixture_mark():
    """通过装饰器使用 fixture（不返回值）"""
    pass  # fixture 的清理仍会执行
```

### Fixture 作用域

```python
import pytest

# fixture 作用域（控制生命周期）
@pytest.fixture(scope="function")  # 默认：每个测试函数创建一次
def temp_file():
    f = open("/tmp/test.txt", "w")
    yield f
    f.close()

@pytest.fixture(scope="module")  # 每个模块创建一次
def config():
    return load_config()

@pytest.fixture(scope="class")  # 每个测试类创建一次
def class_data():
    return {"created": "shared"}

@pytest.fixture(scope="session")  # 整个测试会话创建一次
def app():
    # 非常重的初始化（如启动数据库），跨所有测试文件共享
    app = create_app()
    yield app
    app.shutdown()

# 作用域选择：
# session → module → class → function
# 范围越广，执行次数越少（但测试间耦合越大）
# 原则：能小不小（保持隔离性）
```

### Fixture 依赖与参数化

```python
import pytest

# fixture 依赖：fixture 可以依赖其他 fixture
@pytest.fixture
def user_data(db_connection):  # 依赖 db_connection
    db_connection.insert("users", {"name": "Alice"})
    return db_connection.query("users").first()

def test_user(user_data):  # 依赖 user_data
    assert user_data["name"] == "Alice"

# Fixture 参数化（同一个 fixture 返回不同数据）
@pytest.fixture(params=[
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25},
    {"name": "Charlie", "age": 35},
])
def user(request):
    """给测试提供不同的用户数据"""
    return request.param

def test_user_age(user):
    assert user["age"] >= 0

# 自动使用（autouse）
@pytest.fixture(autouse=True)
def setup_teardown():
    """自动使用，不需要测试函数声明"""
    print("每个测试前执行")
    yield
    print("每个测试后执行")

# 内置 fixture：capsys（捕获标准输出）
def test_output(capsys):
    print("hello world")
    captured = capsys.readouterr()
    assert captured.out == "hello world\n"

# 内置 fixture：tmp_path（临时目录）
def test_file_creation(tmp_path):
    d = tmp_path / "sub"
    d.mkdir()
    p = d / "hello.txt"
    p.write_text("content")
    assert p.read_text() == "content"
```

---

## 参数化测试

```python
import pytest

# @pytest.mark.parametrize：同一个测试函数运行多次

# 方式 1：一组参数
@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
    (100, -50, 50),
])
def test_add(a, b, expected):
    assert a + b == expected
# 生成 4 个测试用例，每个单独失败

# 方式 2：单个参数变化
@pytest.mark.parametrize("name", ["Alice", "Bob", "Charlie"])
def test_greeting(name):
    assert f"Hello, {name}!" == f"Hello, {name}!"

# 方式 3：与 fixture 联用
@pytest.mark.parametrize("email, valid", [
    ("user@example.com", True),
    ("invalid-email", False),
    ("user@", False),
])
def test_email_validation(email, valid):
    assert validate_email(email) == valid

# 方式 4：组合参数化（笛卡尔积）
@pytest.mark.parametrize("x", [0, 1])
@pytest.mark.parametrize("y", [0, 1])
def test_combination(x, y):
    assert x * y >= 0
# 生成 2×2 = 4 个测试

# 方式 5：间接参数化（影响 fixture 行为）
@pytest.fixture
def data(request):
    return {"type": request.param}

@pytest.mark.parametrize("data", ["json", "xml"], indirect=True)
def test_serialization(data):
    assert data["type"] in ["json", "xml"]
```

---

## Mock：外部依赖打桩

### unittest.mock 基础

```python
from unittest.mock import Mock, MagicMock, patch
import pytest

# Mock：最简单的 mock 对象
mock = Mock()
mock.return_value = 42  # 方法调用的返回值
assert mock() == 42

mock.side_effect = ValueError("error")  # 抛出异常
try:
    mock()
except ValueError:
    pass

mock.side_effect = [1, 2, 3]  # 连续调用返回不同值
assert mock() == 1
assert mock() == 2
assert mock() == 3

# MagicMock：Mock 的子类，支持魔术方法
magic = MagicMock()
magic.__len__.return_value = 100
assert len(magic) == 100

magic["key"] = "value"
assert magic.__getitem__.call_args == (("key",),)
```

### patch 实战

```python
import pytest
from unittest.mock import patch

# 外部 API 调用
def get_user_email(user_id: int) -> str:
    import requests
    resp = requests.get(f"https://api.example.com/users/{user_id}")
    resp.raise_for_status()
    return resp.json()["email"]

# 测试：不需要真正调用外部 API

# 方式 1：@patch 装饰器
@patch("requests.get")
def test_get_user_email(mock_get):
    """mock_get 会替换 requests.get"""
    # 配置 mock 返回值
    mock_response = Mock()
    mock_response.json.return_value = {"email": "alice@example.com"}
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    # 调用被测试函数
    email = get_user_email(1)
    assert email == "alice@example.com"
    mock_get.assert_called_once_with("https://api.example.com/users/1")

# 方式 2：上下文管理器
def test_get_user_email_context():
    with patch("requests.get") as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = {"email": "alice@example.com"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        email = get_user_email(1)
        assert email == "alice@example.com"

# 方式 3：patch.object（实例方法）
class Database:
    def query(self, sql: str):
        raise NotImplementedError

def get_users(db: Database):
    return db.query("SELECT * FROM users")

def test_get_users():
    mock_db = Mock(spec=Database)  # spec 限制 mock 的行为
    mock_db.query.return_value = [{"id": 1}, {"id": 2}]

    with patch.object(mock_db, "query") as mock_query:
        mock_query.return_value = [{"id": 1}]
        result = mock_db.query("SELECT *")

    assert len(result) == 1
```

### Mock 断言

```python
from unittest.mock import Mock

mock = Mock()

# 调用
mock(1, 2, key="value")
mock(3, 4)

# 断言调用了
mock.assert_called()  # 至少被调用一次

# 断言调用了一次
mock.assert_called_once()

# 断言特定参数
mock.assert_called_with(1, 2, key="value")

# 断言最后调用
assert mock.call_args == ((3, 4),)  # 最后调用的参数

# 所有调用
assert len(mock.call_args_list) >= 2  # 被调用了 2 次

# 重置记录
mock.reset_mock()
```

---

## 覆盖率分析

```bash
# coverage.py：测试覆盖率分析
pip install pytest-cov

# 基本使用
pytest --cov=my_package tests/
# 输出：
# Name            Stmts   Miss  Cover
# -----------------------------------
# my_package.py      20      2    90%
# -----------------------------------
# TOTAL              20      2    90%

# 生成 HTML 报告
pytest --cov=my_package --cov-report=html tests/
# 用浏览器打开 htmlcov/index.html

# 生成 XML 报告（CI 集成）
pytest --cov=my_package --cov-report=xml tests/

# 分支覆盖率（Python 3.12+）
pytest --cov=my_package --cov-branch tests/

# 配置 .coveragerc
# [run]
# source = my_package
# omit = */tests/*
# branch = True

# [report]
# exclude_lines =
#     pragma: no cover
#     if __name__ == "__main__":
#     raise NotImplementedError
#     def __repr__
```

```python
# .coveragerc 结合 pyproject.toml
[tool.coverage.run]
source = ["my_package"]
omit = ["*/tests/*", "*/migrations/*"]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if __name__ == .__main__.:",
    "raise NotImplementedError",
]

# 覆盖率原则：
# 100% 覆盖率 ≠ 没有 bug
# 80% 覆盖率 + 核心逻辑覆盖 > 100% 但全测了皮毛
# 关注：
# 1. 核心业务逻辑（100% 覆盖）
# 2. 边界条件（空值、越界、权限）
# 3. 异常路径（每个 except 都被执行到）
```

---

## pdb：交互式调试

### 基本入门

```python
# pdb：Python 标准库调试器

# 方式 1：插入断点
import pdb

def complex_function(x, y):
    result = x + y
    pdb.set_trace()  # 执行到这里会进入交互式调试
    result = result * 2
    return result

# from Python 3.7：更简洁的断点
def complex_function(x, y):
    result = x + y
    breakpoint()  # 等价于 pdb.set_trace()，但可配置
    result = result * 2
    return result
```

### pdb 常用命令

```python
# 进入 pdb 后的常用命令：

# c / continue：继续执行直到下一个断点
# n / next：执行下一行（不进入函数内部）
# s / step：进入函数内部
# r / return：执行到当前函数返回
# q / quit：退出调试

# p / pp：打印表达式
#   p variable_name
#   pp nested_data
#
# l / list：查看附近代码（+/- 前后行）
# l 10, 20：显示 10-20 行

# b / break：设置断点
# b 42             在 42 行设断点
# b function_name   在函数入口设断点
# b file.py:30      在文件指定行
# b 42, x > 0      条件断点（x > 0 才停）

# w / where：显示调用栈
# u / up：上一层栈
# d / down：下一层栈

# !：执行 Python 语句
#   !variable = new_value  # 修改变量
#   !import sys; sys.path
```

### pdb 进阶技巧

```python
# 事后调试（运行完再进 pdb）
# 最有用：程序崩溃后自动进入 pdb
# python -m pdb script.py  # 启动时进入 pdb

# 事后调试：
# python -c "import pdb; pdb.pm()"  # 进入最新异常

# 条件断点（只用一次）
# b 42, x == 10
# b 42, x > 0 and y < 0
# b 42, "error" in str(result)

# 动态修改
# 在 pdb 中修改局部变量：
# pdb> !x = 100  # 修改变量值
# pdb> c          # 继续执行

# pdb 别名
# alias hr for x in range(60): print('-', end=''); print()
# hr  # 打印分隔线
```

---

## 性能分析

### cProfile

```python
# cProfile：标准库性能分析器
import cProfile
import pstats

def slow_function():
    total = 0
    for i in range(10_000_000):
        total += i * i
    return total

# 方式 1：命令行
# python -m cProfile -o profile.stats script.py

# 方式 2：代码中
profiler = cProfile.Profile()
profiler.enable()
slow_function()
profiler.disable()

stats = pstats.Stats(profiler)
stats.sort_stats("time")  # 按耗时排序
stats.print_stats(10)  # 打印前 10 个
# 输出：
# ncalls  tottime  percall  cumtime  percall  filename:lineno(function)
#      1   0.500    0.500    0.500    0.500   test.py:6(slow_function)
```

### py-spy

```bash
# py-spy：生产环境性能分析（不需要修改代码）
pip install py-spy

# 采样分析
py-spy record -o profile.svg -- python script.py

# 实时观察运行中的进程
py-spy top -p 12345

# 火焰图（最直观的性能分析）
py-spy record -o flamegraph.svg -- python script.py
# SVG 文件可以用浏览器打开，直观看到每个函数的耗时比例
```

### pytest-benchmark

```python
# pytest-benchmark：测试性能回归

# pip install pytest-benchmark

def test_sort_performance(benchmark):
    data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]

    # benchmark 会自动运行多次并统计
    result = benchmark(sorted, data)

    assert result == sorted(data)

# 运行结果：
# -----------------------------------------------
# Name (time in us)              Mean   StdDev
# test_sort_performance         1.23    0.05
# -----------------------------------------------
```

---

## 实战案例

### 案例 1：API 测试

```python
import pytest
from unittest.mock import patch
from my_app import create_app

@pytest.fixture
def app():
    """FastAPI 测试应用"""
    return create_app()

@pytest.fixture
def client(app):
    """测试客户端"""
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture(autouse=True)
def mock_external_api():
    """mock 所有外部 HTTP 调用"""
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = {"status": "ok"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        yield

def test_create_user(client):
    """测试创建用户 API"""
    user_data = {
        "name": "Alice",
        "email": "alice@example.com",
        "age": 30,
    }
    resp = client.post("/users", json=user_data)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Alice"

def test_get_user_not_found(client):
    """测试用户不存在"""
    resp = client.get("/users/999")
    assert resp.status_code == 404

@pytest.mark.parametrize("invalid_data, expected_error", [
    ({"name": ""}, "name is required"),
    ({"age": -1}, "age must be positive"),
    ({"email": "invalid"}, "invalid email"),
])
def test_create_user_validation(client, invalid_data, expected_error):
    """测试参数验证"""
    resp = client.post("/users", json=invalid_data)
    assert resp.status_code == 422
    assert expected_error in str(resp.json())
```

### 案例 2：数据库测试

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from my_app.models import Base, User

@pytest.fixture(scope="function")
def db_session():
    """内存 SQLite 数据库，每个测试独立"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()

def test_create_user(db_session):
    user = User(name="Alice", email="alice@example.com")
    db_session.add(user)
    db_session.commit()
    assert user.id is not None

def test_query_user(db_session):
    db_session.add(User(name="Bob", email="bob@example.com"))
    db_session.commit()

    user = db_session.query(User).filter_by(name="Bob").first()
    assert user is not None
    assert user.email == "bob@example.com"

def test_delete_user(db_session):
    user = User(name="Charlie", email="charlie@example.com")
    db_session.add(user)
    db_session.commit()

    db_session.delete(user)
    db_session.commit()

    assert db_session.query(User).count() == 0
```

### 案例 3：调试实战流程

```python
# 场景：处理 CSV 文件时发现某个数字计算错误

import csv

def process_sales(filepath: str):
    """处理销售数据"""
    total = 0
    with open(filepath) as f:
        reader = csv.DictReader(f)
        for row in reader:
            amount = float(row["amount"])
            total += amount
    return total

# 步骤 1：发现 bug
result = process_sales("sales.csv")
print(result)  # 预期 1000.0，实际 1000.00000001（浮点精度问题）

# 步骤 2：插入断点
def process_sales_debug(filepath: str):
    total = 0
    with open(filepath) as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            amount = float(row["amount"])
            total += amount
            if i > 3:  # 只在第 4 行之后断点
                breakpoint()  # 查看累积值
    return total

# 步骤 3：pdb 中检查
# pdb > p amount
# 19.99
# pdb > p total
# 79.96
# pdb > p type(amount)
# <class 'float'>
# pdb > from decimal import Decimal
# pdb > !total = Decimal(str(total))  # 临时修复

# 步骤 4：最终修复
from decimal import Decimal

def process_sales_fixed(filepath: str):
    total = Decimal("0")
    with open(filepath) as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += Decimal(row["amount"])
    return float(total)

# 步骤 5：写测试验证
def test_process_sales(tmp_path):
    """测试销售数据处理的浮点精度"""
    csv_file = tmp_path / "test_sales.csv"
    csv_file.write_text("\n".join([
        "date,amount",
        "2024-01-01,19.99",
        "2024-01-02,29.99",
        "2024-01-03,49.99",
    ]))
    result = process_sales_fixed(str(csv_file))
    assert result == pytest.approx(99.97)
```

---

## CI 测试集成

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          pip install uv
          uv sync

      - name: Lint
        run: uv run ruff check

      - name: Type check
        run: uv run mypy

      - name: Test with coverage
        run: uv run pytest --cov=my_package --cov-report=xml --cov-report=html

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml
```

### 测试超时处理

```python
# 使用 pytest-timeout
# pip install pytest-timeout

# 全局超时
# pytest --timeout=30  # 每个测试最多 30 秒

# 单个测试超时
@pytest.mark.timeout(5)  # 5 秒超时
def test_slow_operation():
    import time
    time.sleep(10)  # 会失败

# 会话级超时
# pytest --timeout=300 --timeout-method=thread  # 线程级超时（安全）
```

---

## 常见陷阱与最佳实践

### 陷阱 1：共享 fixture 导致测试间耦合

```python
# 错误 陷阱：fixture 作用域过大导致测试串联
@pytest.fixture(scope="session")
def db():
    conn = Database.connect()
    yield conn
    conn.close()

def test_insert(db):
    db.insert("users", {"name": "Alice"})

def test_count(db):
    # test_insert 插入的 Alice 还在！count = 1
    assert db.query("users").count() == 0  # 错误 失败

# 正确 正确：每个测试独立
@pytest.fixture(scope="function")
def clean_db():
    conn = Database.connect()
    conn.clear()  # 清空数据
    yield conn
    conn.clear()

# 或使用事务 + 回滚
@pytest.fixture
def db_session():
    conn = Database.connect()
    conn.begin()  # 开启事务
    yield conn
    conn.rollback()  # 回滚所有变更
```

### 陷阱 2：Mock 不匹配真实行为

```python
# 错误 陷阱：mock 返回了真实代码不会返回的数据
mock_db.query.return_value = {"id": 1, "name": "Alice"}
# 但真实数据库返回的是 [{"id": 1, "name": "Alice"}]
# 类型不匹配！

# 正确 正确：mock 返回真实的数据结构
mock_db.query.return_value = [{"id": 1, "name": "Alice"}]

# 错误 陷阱：过度 mock 导致测试没有价值
@patch("builtins.print")
@patch("random.randint")
@patch("time.sleep")
def test_so_many_mocks(mock_sleep, mock_randint, mock_print):
    mock_randint.return_value = 42
    result = my_function()
    assert result == 42  # 所有依赖都被 mock 了，什么也没测到

# 正确 原则：
# 1. mock 外部依赖（网络、数据库、文件系统）
# 2. 不 mock 自己代码的逻辑
# 3. mock 返回值和真实行为一致
```

### 陷阱 3：只测 happy path

```python
# 错误 陷阱：只测试正常路径
def test_divide():
    assert divide(10, 2) == 5  # happy path

# 正确 正确：覆盖边界和异常
@pytest.mark.parametrize("a, b, expected", [
    (10, 2, 5),          # 正常
    (0, 5, 0),           # 零被除
    (-10, 2, -5),        # 负数
    (1, 3, pytest.approx(0.333)),  # 小数
    (10, -2, -5),        # 负除数
])
def test_divide_happy(a, b, expected):
    assert divide(a, b) == expected

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_divide_type_error():
    with pytest.raises(TypeError):
        divide("10", 2)
```

---

## 总结

```
测试工具速查：
─────────────────────────────────
工具              用途                 安装
─────────────────────────────────
pytest            测试框架              pytest
pytest-cov        覆盖率分析            pytest-cov
pytest-timeout    测试超时              pytest-timeout
pytest-benchmark  性能基准              pytest-benchmark
unittest.mock     Mock 打桩            标准库
coverage.py       覆盖率分析            coverage
cProfile          性能分析              标准库
py-spy            生产环境采样分析      py-spy
pdb               交互式调试器          标准库
─────────────────────────────────
```

```
pytest 命令速查：
─────────────────────────────────
pytest                     发现并运行所有测试
pytest -v                  详细输出
pytest -k "pattern"        按名称模式过滤
pytest -x                  第一个失败就停止
pytest --maxfail=5         5 个失败后停止
pytest --lf                只运行上次失败的
pytest --ff                先运行上次失败的（再运行其他）
pytest -m "slow"           按标记运行
pytest -s                  显示 print 输出
pytest --tb=short          简短 traceback
pytest --tb=long           详细 traceback
─────────────────────────────────
```

```
pdb 命令速查：
─────────────────────────────────
n / next         执行下一行（不进入函数）
s / step         执行下一行（进入函数）
c / continue     继续执行
r / return       执行到函数返回
q / quit         退出
p variable       打印变量
! expr           执行 Python 语句
l / list         查看源码
b line           设置断点
b line, cond     条件断点
w / where        显示调用栈
─────────────────────────────────
```

```
最佳实践：
─────────────────────────────────
正确 每个测试函数只测一件事情
正确 使用 fixture 管理依赖，不要手动 setup/teardown
正确 mock 要匹配真实行为（类型、结构）
正确 覆盖 happy path + 边界 + 异常
正确 pytest-cov 做覆盖率分析（关注核心路径 100%）
正确 用 @pytest.mark.parametrize 减少重复代码
正确 fixture 作用域选小不选大（保持隔离）
正确 breakpoint() 比 print() 调试更高效
正确 CI 中运行测试 + 覆盖率 + 类型检查
正确 调试从 print() 升级到 pdb（省时省力）
```

测试是代码的"双胞胎"——没有测试的代码不是"写完"了，而是"刚写完"而已。pytest 的 fixture + mock + parametrize 三件套能覆盖绝大多数场景，cProfile 和 py-spy 做性能分析，pdb 做交互式调试——这套组合拳让你的 Python 代码既有质量保障又有诊断能力

本文由小虾子  撰写
