---
title: Python 虚拟环境与依赖管理完全指南：从 venv 到 uv 的实战解析
date: 2026-07-16
---

# Python 虚拟环境与依赖管理完全指南：从 venv 到 uv 的实战解析

> 每个 Python 项目的第一步不是写代码——而是搞清楚依赖怎么管。从 `venv` 到 `virtualenv`，从 `pip` 到 `poetry`，从 `requirements.txt` 到 `pyproject.toml`，从 `pip-tools` 到 `uv`，Python 生态的依赖管理方案多到让人困惑。本文系统梳理每条路线的定位、优劣与选型决策，帮你为项目选对工具。

本文由小虾子  撰写

## 为什么需要虚拟环境？

### 全局安装的灾难

```bash
# 错误 全局安装的后果
pip install requests==2.28.0
pip install flask  # flask 依赖 requests>=2.30，pip 自动升级了 requests
# 现在 requests 是 2.32+，你之前测试的 2.28.0 代码可能出问题

# 项目 A 需要 Django 4.0，项目 B 需要 Django 5.0
# 全局只能装一个版本 → 冲突！

# pip install 会把包装到系统 Python 的 site-packages
# 你的操作系统依赖系统 Python（Ubuntu 的 apt、macOS 的 Homebrew）
# 污染系统 Python → 系统工具可能崩溃
```

### 虚拟环境的作用

```bash
# 虚拟环境：隔离的 Python 解释器 + 独立的 site-packages
# 每个项目一个虚拟环境，互不干扰

# 原理：
# 1. 复制（或软链接）Python 解释器到目标目录
# 2. 创建独立的 site-packages 目录
# 3. 激活后，pip install 只影响当前环境
# 4. 退出后恢复全局 Python

# 类比：
# 全局 Python = 公共厨房
# 虚拟环境 = 每个项目一个独立厨房（自己的食材、调料）
```

---

## venv：标准库方案

### 创建与使用

```bash
# Python 3.3+ 内置 venv（推荐）

# 创建虚拟环境
python3 -m venv .venv

# 目录结构
.venv/
├── bin/          # 可执行文件（Linux/macOS）
│   ├── python    # Python 解释器（软链接）
│   ├── pip
│   └── activate  # 激活脚本
├── lib/
│   └── python3.x/
│       └── site-packages/  # 第三方包
├── include/      # 头文件
└── pyvenv.cfg   # 配置文件

# 激活
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate            # Windows CMD
.venv\Scripts\Activate.ps1        # Windows PowerShell

# 激活后提示符变化
(.venv) $ which python
/Users/project/.venv/bin/python  # 正确 指向虚拟环境

# 退出
deactivate

# 常用操作
(.venv) $ pip install requests
(.venv) $ pip freeze > requirements.txt
(.venv) $ pip install -r requirements.txt
```

### venv 选项

```bash
# 指定 Python 版本
python3.12 -m venv .venv  # 用 Python 3.12 创建

# 不安装 pip（极简环境）
python3 -m venv .venv --without-pip

# 升级已有环境的 pip
python3 -m venv --upgrade .venv

# 清理环境（删除并重建）
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### .python-version 文件

```bash
# pyenv + venv 的配合
# 项目根目录放一个 .python-version 文件
echo "3.12.4" > .python-version

# pyenv 会自动读取这个文件，切换到指定版本
# 然后用这个版本创建虚拟环境
pyenv local  # 读取 .python-version 并切换
python3 -m venv .venv
```

---

## virtualenv：第三方增强

```bash
# virtualenv：venv 的超集（更快、更多功能）
pip install virtualenv

# 与 venv 的区别：
# 1. 更快（不复制解释器，用软链接）
# 2. 可以指定 Python 版本（不用先切换 pyenv）
# 3. 支持创建可复制的环境
# 4. 历史更悠久（Python 2 时代就有了）

# 基本用法
virtualenv .venv

# 指定 Python 版本
virtualenv -p python3.12 .venv
virtualenv --python=3.12 .venv

# 不使用系统 site-packages（完全隔离）
virtualenv --no-site-packages .venv

# venv 已经足够好，virtualenv 的优势在 Python 2 时代更大
# Python 3 推荐直接用 venv
```

---

## pip：包管理器

### 基本用法

```bash
# 安装
pip install requests              # 最新版
pip install requests==2.31.0       # 指定版本
pip install "requests>=2.28,<3"   # 版本范围
pip install requests[socks]       # 带 extras
pip install git+https://github.com/psf/requests.git  # 从 Git
pip install ./local-package/      # 本地路径
pip install -e .                  # 当前项目（可编辑模式）

# 卸载
pip uninstall requests

# 查询
pip show requests                 # 包详情
pip list                          # 已安装列表
pip list --outdated               # 可更新的包

# 更新
pip install --upgrade requests
pip install -U requests

# 搜索（pip 10+ 移除了 search，用 pip-index）
pip index versions requests
```

### requirements.txt

```bash
# requirements.txt：最经典的依赖锁定方式

# 生成（冻结当前环境的所有包版本）
pip freeze > requirements.txt

# 典型的 requirements.txt：
# requests==2.31.0
# flask==3.0.0
# numpy==1.26.0

# 安装
pip install -r requirements.txt

# 问题：freeze 包含所有间接依赖
# → requirements.txt 变成"快照"而非"声明"
# → 间接依赖版本被锁死，更新困难

# 更好的做法：分离"声明"和"锁定"
# requirements.in  → 声明直接依赖
# requirements.txt → 锁定所有依赖（含间接依赖）
```

### pip 配置

```bash
# 国内镜像源（加速下载）
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 信任 HTTP 源
pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 超时设置
pip config set global.timeout 120

# 配置文件位置
# Linux/macOS: ~/.config/pip/pip.conf 或 ~/.pip/pip.conf
# Windows: %APPDATA%\pip\pip.ini

# 临时使用镜像
pip install requests -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## pip-tools：声明 + 锁定

### pip-compile

```bash
# pip-tools：解决 requirements.txt 的"声明 vs 锁定"问题
pip install pip-tools

# requirements.in：只写直接依赖
# requests
# flask
# numpy

# 编译：生成完整的锁定文件
pip-compile requirements.in

# 输出 requirements.txt：
# requests==2.31.0
#   # via -r requirements.in
# flask==3.0.0
#   # via -r requirements.in
# werkzeug==3.0.1
#   # via flask
# ...所有间接依赖

# 更新
pip-compile --upgrade requirements.in
# 或只更新某个包
pip-compile --upgrade-package requests requirements.in

# 输出到指定文件
pip-compile requirements.in -o requirements.txt
```

### pip-sync

```bash
# pip-sync：让环境与 requirements.txt 完全一致
pip-sync requirements.txt

# 会安装缺失的包，卸载多余的包
# 等价于：
# pip uninstall -y $(pip list --format=freeze | grep -v -f requirements.txt -)
# pip install -r requirements.txt
```

---

## Poetry：现代依赖管理

### 初始化与配置

```bash
# 安装
curl -sSL https://install.python-poetry.org | python3 -
# 或
pip install poetry

# 新项目
poetry new my-project
# my-project/
# ├── pyproject.toml
# ├── README.md
# ├── my_project/
# │   └── __init__.py
# └── tests/

# 已有项目
poetry init
# 交互式创建 pyproject.toml

# 配置虚拟环境位置
poetry config virtualenvs.in-project true  # 在项目目录内创建 .venv
# 默认：~/.cache/pypoetry/virtualenvs/
```

### pyproject.toml

```toml
# pyproject.toml：现代 Python 项目的配置中心
[tool.poetry]
name = "my-project"
version = "0.1.0"
description = "A sample project"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.10"
requests = "^2.31"
flask = "^3.0"
numpy = "^1.26"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4"
black = "^24.0"
mypy = "^1.8"

[tool.poetry.group.prod.dependencies]
gunicorn = "^21.0"

# Poetry 的版本约束语法：
# ^1.2.3  → >=1.2.3, <2.0.0  （兼容更新，只允许 minor/patch）
# ~1.2.3  → >=1.2.3, <1.3.0  （只允许 patch 更新）
# >=1.2   → >=1.2            （最低版本）
# *       → 任意版本
# ==1.2.3 → 精确版本
```

### 日常操作

```bash
# 安装所有依赖
poetry install
# 会自动创建虚拟环境 + 安装依赖 + 安装当前项目

# 只安装生产依赖（不装 dev）
poetry install --without dev

# 添加依赖
poetry add requests
poetry add "requests>=2.31"  # 带版本约束
poetry add pytest --group dev  # 添加到 dev 组

# 移除依赖
poetry remove requests

# 更新依赖
poetry update              # 更新所有
poetry update requests     # 只更新一个

# 查看依赖树
poetry show --tree
# my-project
# ├── requests (^2.31)
# │   ├── charset-normalizer (^3.0)
# │   ├── urllib3 (^2.0)
# │   └── certifi (^2024.0)
# └── flask (^3.0)
#     └── werkzeug (^3.0)

# 锁定文件
poetry.lock  # 自动生成，包含所有依赖的精确版本

# 在虚拟环境中运行命令
poetry run python script.py
poetry run pytest

# 激活虚拟环境
poetry shell

# 导出 requirements.txt（给不支持 poetry 的工具用）
poetry export -f requirements.txt --output requirements.txt
poetry export --without dev -f requirements.txt --output requirements.txt
```

---

## uv：Rust 编写的新势力

### 为什么选择 uv？

```bash
# uv：Astral 开发的极速依赖管理器（Rust 编写）
# 2024 年发布，已成为 Python 生态最快的工具

# 核心优势：
# 1. 速度：比 pip 快 10-100 倍
# 2. 兼容：pip install 的直接替代
# 3. 一体化：venv + pip + pip-tools + poetry 的功能整合
# 4. Rust 编写：无 Python 运行时依赖

# 安装
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或
pip install uv
# 或
brew install uv
```

### uv 基本用法

```bash
# 创建虚拟环境
uv venv                      # 默认 .venv
uv venv my-env               # 指定名称
uv venv --python 3.12        # 指定 Python 版本

# 安装包（完全兼容 pip）
uv pip install requests
uv pip install "requests>=2.31"
uv pip install -r requirements.txt
uv pip install -e .

# 卸载
uv pip uninstall requests

# 查看
uv pip list
uv pip show requests

# 冻结
uv pip freeze > requirements.txt

# 同步（让环境与 requirements.txt 一致）
uv pip sync requirements.txt  # 等价于 pip-sync

# 编译（等价于 pip-compile）
uv pip compile requirements.in -o requirements.txt
```

### uv 项目管理

```bash
# uv init：初始化项目
uv init my-project
# 创建：
# my-project/
# ├── .python-version
# ├── README.md
# ├── main.py
# └── pyproject.toml

# pyproject.toml（uv 格式）
# [project]
# name = "my-project"
# version = "0.1.0"
# requires-python = ">=3.12"
# dependencies = []

# uv add：添加依赖
uv add requests
uv add "requests>=2.31"
uv add --dev pytest

# uv remove：移除依赖
uv remove requests

# uv sync：安装所有依赖（自动创建虚拟环境）
uv sync
# 等价于 poetry install，但快 10 倍以上

# uv run：在项目环境中运行
uv run python script.py
uv run pytest

# uv lock：生成锁定文件
uv lock
# 生成 uv.lock（类似 poetry.lock）
```

### uv 速度对比

```bash
# 安装 100 个包的对比（示例数据）
# pip install:        45s
# pip-tools:          52s
# poetry install:     38s
# uv pip install:     2.1s   ← 20x 加速

# 冷启动缓存（无缓存）
# pip:    120s
# uv:      8.3s  ← 14x 加速

# uv 的速度来源：
# 1. Rust 实现（无 Python 解释器开销）
# 2. 全局缓存 + 硬链接（不复制文件）
# 3. 并行下载（pip 是串行的）
# 4. 预编译 wheel 优先
```

---

## pyproject.toml：现代配置标准

### PEP 517/518

```toml
# pyproject.toml：PEP 518 定义的 Python 项目配置标准
# 取代 setup.py / setup.cfg / requirements.txt 的碎片化

# [build-system]：构建后端声明
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.backends._legacy:_Backend"

# Poetry 的构建后端
[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

# uv/hatch 的构建后端
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

# [project]：项目元数据（PEP 621）
[project]
name = "my-package"
version = "1.0.0"
description = "A sample package"
readme = "README.md"
requires-python = ">=3.10"
license = { text = "MIT" }
authors = [{ name = "Your Name", email = "you@example.com" }]
keywords = ["web", "api"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.12",
]

# 依赖声明
dependencies = [
    "requests>=2.31",
    "flask>=3.0",
    "numpy>=1.26",
]

# 可选依赖（extras）
[project.optional-dependencies]
dev = ["pytest>=7.4", "black>=24.0"]
docs = ["mkdocs>=1.5"]
```

### 工具配置集中化

```toml
# pyproject.toml 可以集中配置所有工具
[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
addopts = "-v --cov=my_package"

[tool.black]
line-length = 100
target-version = ["py312"]

[tool.ruff]
line-length = 100
target-version = "py312"
select = ["E", "F", "I", "N", "W", "UP"]

[tool.mypy]
python_version = "3.12"
strict = true

[tool.coverage.run]
source = ["my_package"]
omit = ["tests/*"]
```

---

## 工具选型对比

### 选型决策树

```
依赖管理选型：
─────────────────────────────────
项目规模？
  ↓
├─ 脚本/小项目（<5 个依赖）
│   → venv + pip + requirements.txt
│   → 简单直接，无额外学习成本
│
├─ 中型项目（5-30 个依赖）
│   → uv（推荐）
│   → 或 poetry（成熟稳定）
│
├─ 大型项目/库（30+ 依赖）
│   → uv + pyproject.toml + uv.lock
│   → 或 poetry + pyproject.toml + poetry.lock
│
└─ 团队协作 / CI/CD
    → 必须有 lock 文件
    → uv（快，CI 缓存友好）
    → 或 poetry（生态成熟，文档丰富）
```

### 功能对比表

```
功能              venv+pip   pip-tools   poetry     uv
─────────────────────────────────────────────────────
虚拟环境          正确          正确          正确          正确
依赖安装          正确          正确          正确          正确
依赖锁定          错误          正确          正确          正确
依赖声明          错误          错误          正确          正确
依赖树可视化      错误          错误          正确          正确
pyproject.toml   错误          错误          正确          正确
版本约束语法      ==          ==          ^ ~ >=      ^ ~ >=
速度              慢          慢          中          极快
学习成本          低          中          高          低
Rust 编写         错误          错误          错误          正确
全局缓存          错误          错误          错误          正确
```

---

## .gitignore 策略

```gitignore
# .gitignore：虚拟环境相关

# 虚拟环境目录（不提交）
.venv/
venv/
env/

# 但要提交依赖声明文件
# 正确 提交：pyproject.toml, requirements.in, uv.lock, poetry.lock
# 错误 不提交：requirements.txt（如果是 freeze 生成的）

# uv
# uv.lock 要提交（锁定文件）
# .venv/ 不提交

# poetry
# poetry.lock 要提交
# .venv/ 不提交（如果 virtualenvs.in-project = true）

# pip-tools
# requirements.txt 要提交（锁定文件）
# requirements.in 要提交（声明文件）

# Python 缓存
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
```

---

## CI/CD 集成

### GitHub Actions + uv

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3

      - name: Set up Python
        run: uv python install ${{ matrix.python-version }}

      - name: Install dependencies
        run: uv sync --all-extras

      - name: Run tests
        run: uv run pytest

      - name: Lint
        run: uv run ruff check

      - name: Type check
        run: uv run mypy
```

### GitHub Actions + poetry

```yaml
name: CI

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

      - name: Install poetry
        run: pip install poetry

      - name: Install dependencies
        run: poetry install --with dev

      - name: Run tests
        run: poetry run pytest
```

### Docker + uv

```dockerfile
# Dockerfile + uv（极快的 Docker 构建）
FROM python:3.12-slim

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 利用 Docker 缓存：先复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装依赖（利用 uv 全局缓存）
RUN uv sync --frozen --no-dev

# 复制代码
COPY . .

# 运行
CMD ["uv", "run", "python", "main.py"]

# uv 的 Docker 优势：
# 1. 安装速度快（减少 Docker 构建时间）
# 2. uv.lock --frozen 保证可复现
# 3. --no-dev 不安装开发依赖（减小镜像）
```

---

## 实战案例

### 案例 1：从零搭建 FastAPI 项目

```bash
# 使用 uv
uv init fastapi-project
cd fastapi-project

uv add fastapi
uv add "uvicorn[standard]"
uv add sqlalchemy
uv add pydantic-settings

# 开发依赖
uv add --dev pytest
uv add --dev httpx  # FastAPI 测试用
uv add --dev ruff

# 项目结构
# fastapi-project/
# ├── .python-version
# ├── pyproject.toml
# ├── uv.lock
# ├── README.md
# ├── main.py
# └── tests/

# 运行
uv run uvicorn main:app --reload

# 测试
uv run pytest
```

### 案例 2：迁移到 uv

```bash
# 从 poetry 迁移
# 1. 导出 requirements.txt
poetry export -f requirements.txt --output requirements.txt --without dev

# 2. 用 uv 创建环境并安装
uv venv
uv pip install -r requirements.txt

# 3. 迁移 pyproject.toml
# poetry 的 [tool.poetry.dependencies] → [project] dependencies
# 手动调整格式

# 4. 用 uv 管理项目
uv lock
uv sync

# 从 pip + requirements.txt 迁移
# 1. 直接安装
uv venv
uv pip install -r requirements.txt

# 2. 升级为 uv 项目
uv init --no-readme  # 生成 pyproject.toml
uv add $(cat requirements.txt | grep -v "#" | tr '\n' ' ')
```

### 案例 3：Monorepo 多包管理

```bash
# uv workspace（类似 pnpm workspace）

# 根 pyproject.toml
[tool.uv.workspace]
members = ["packages/*"]

# packages/
# ├── core/
# │   └── pyproject.toml
# ├── api/
# │   └── pyproject.toml
# └── cli/
#     └── pyproject.toml

# api/pyproject.toml
[project]
dependencies = [
    "core",  # 引用 workspace 内的包
]

[tool.uv.sources]
core = { workspace = true }

# 根目录运行
uv sync  # 安装所有 workspace 成员
uv run --package api python -m api.main
```

---

## 常见陷阱与最佳实践

### 陷阱 1：虚拟环境提交到 Git

```bash
# 错误 把 .venv 提交到 Git
git add .venv/
git commit -m "add venv"
# .venv 可能有几百 MB，而且不可移植（路径不同）

# 正确 只提交依赖声明
echo ".venv/" >> .gitignore
git add pyproject.toml uv.lock .gitignore
git commit -m "add project config"

# 别人 clone 后自己创建虚拟环境
uv sync  # 或 poetry install, 或 pip install -r requirements.txt
```

### 陷阱 2：版本不锁定

```bash
# 错误 requirements.txt 只写包名，不写版本
# requests
# flask
# numpy
# 问题：每次安装可能得到不同版本，不可复现

# 正确 用 lock 文件锁定
# uv.lock / poetry.lock / requirements.txt（pip-compile 生成）
# 包含所有依赖（含间接依赖）的精确版本
```

### 陷阱 3：开发依赖混入生产

```bash
# 错误 开发依赖和生产依赖混在一起
pip install pytest  # 生产环境也会有 pytest

# 正确 分组管理
# pyproject.toml
[project.optional-dependencies]
dev = ["pytest", "black", "ruff"]

# 或用 uv/poetry 的分组
[dependency-groups]
dev = ["pytest", "ruff"]

# 安装时排除 dev
uv sync --no-dev
poetry install --without dev
```

---

## 总结

```
工具选型速查：
─────────────────────────────────
工具         定位                 推荐场景
─────────────────────────────────
venv         标准库虚拟环境        所有 Python 3 项目
virtualenv   venv 增强版           需要更多功能时
pip          基础包管理器          简单项目
pip-tools    声明+锁定            传统 pip 项目
poetry       全功能项目管理        中大型项目
uv           极速一体化工具        新项目首选
─────────────────────────────────

文件速查：
─────────────────────────────────
文件                  作用
─────────────────────────────────
requirements.txt      依赖锁定（pip）
requirements.in       依赖声明（pip-tools）
pyproject.toml        项目配置标准（PEP 518/621）
poetry.lock           Poetry 锁定文件
uv.lock               uv 锁定文件
.python-version       Python 版本声明
.gitignore            排除 .venv/ 等目录
─────────────────────────────────
```

```
最佳实践：
─────────────────────────────────
正确 每个项目一个虚拟环境（不要全局安装）
正确 用 pyproject.toml 作为项目配置中心
正确 提交 lock 文件（确保可复现）
正确 不要提交 .venv/ 目录
正确 分离开发依赖和生产依赖
正确 新项目首选 uv（最快、最现代）
正确 已有 poetry 项目可以迁移到 uv
正确 CI/CD 用 uv sync --frozen 保证一致性
正确 Docker 中用 uv 减少构建时间
正确 用 .python-version 声明 Python 版本
```

Python 依赖管理经历了从 `pip + requirements.txt` 到 `poetry + pyproject.toml` 再到 `uv + uv.lock` 的演进——venv 做隔离，pip/poetry/uv 做管理，pyproject.toml 做配置，lock 文件做锁定。理解这条工具链的每个环节，你的项目基建就稳了

本文由小虾子  撰写
