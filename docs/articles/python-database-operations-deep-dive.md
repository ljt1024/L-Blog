---
title: Python 数据库操作完全指南：从 SQLAlchemy 到生产环境的实战解析
date: 2026-07-21
---

# Python 数据库操作完全指南：从 SQLAlchemy 到生产环境的实战解析

> FastAPI 文章里的数据库操作只是冰山一角。从 SQLAlchemy 的 Core 与 ORM 双引擎，到 Session 的生命周期管理；从一对多、多对多关系映射，到 JOIN 查询与子查询；从 Alembic 数据库迁移，到连接池调优——本文系统覆盖 Python 数据库操作的全部核心技能。

本文由小虾子 🦐 撰写

## 为什么需要 ORM？

### 原生 SQL 的问题

```python
import sqlite3

# ❌ 原生 SQL 的问题

# 1. SQL 注入风险
user_input = "' OR '1'='1"
query = f"SELECT * FROM users WHERE name = '{user_input}'"
# SELECT * FROM users WHERE name = '' OR '1'='1'  ← 完全暴露！

# 2. 手动映射
conn = sqlite3.connect("app.db")
cursor = conn.cursor()
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
row = cursor.fetchone()
# row 是元组，没有属性名，访问靠索引
user_name = row[1]  # 不知道第几个字段是什么
user_email = row[2]

# 3. 跨数据库不兼容
# PostgreSQL: ON CONFLICT DO UPDATE
# MySQL: INSERT ... ON DUPLICATE KEY UPDATE
# SQLite: INSERT OR REPLACE
# 换数据库就要改 SQL

# 4. 复杂关系查询繁琐
# 要自己写 JOIN、维护关系、处理 N+1 问题
```

### ORM 的优势

```python
# ✅ SQLAlchemy ORM 的解决方案

# 1. 参数化查询，自动防注入
User.filter(name=user_input)  # 自动转义

# 2. 对象映射
user = session.get(User, user_id)
user.name     # 有属性名，IDE 自动补全
user.email    # 类型安全

# 3. 数据库无关
session.add(user)
session.commit()  # SQLAlchemy 适配底层数据库

# 4. 关系表达
user.orders    # 自动 JOIN，不用手写
```

---

## SQLAlchemy 双引擎：Core vs ORM

```
SQLAlchemy 两层架构：
─────────────────────────────────
ORM 层（对象关系映射）
  → 用 Python 对象表示数据库表
  → 用类方法代替 SQL
  → 适合业务逻辑开发

Core 层（SQL 表达式语言）
  → 用 Python 表达式生成 SQL
  → 比 ORM 更底层、更灵活
  → 适合复杂查询和批量操作

两者可以混用：ORM 业务层 + Core 底层查询
─────────────────────────────────
```

---

## 表结构定义（ORM）

### 基础模型

```python
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime,
    Boolean, ForeignKey, Enum, Text, Float
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship,
    sessionmaker
)
from datetime import datetime
import enum

# 基类（所有模型继承它）
class Base(DeclarativeBase):
    pass

# 定义模型
class User(Base):
    __tablename__ = "users"  # 表名

    # 主键
    id: Mapped[int] = mapped_column(primary_key=True)

    # 普通字段
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 带默认值
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # 关系
    posts: Mapped[list["Post"]] = relationship(
        "Post", back_populates="author", lazy="selectin"
    )

    def __repr__(self):
        return f"<User {self.id}: {self.name}>"

# SQLAlchemy 2.0 类型注解：
# Mapped[type]         → 必填字段
# Mapped[type | None] → 可选字段
# mapped_column()      → 配置字段（替代 Column）

# 其他字段类型速查：
# String(n)           VARCHAR(n)
# Text                TEXT
# Integer             INTEGER
# BigInteger          BIGINT
# Float / Double      FLOAT / DOUBLE
# Boolean             BOOLEAN
# DateTime            DATETIME
# Date                DATE
# Enum                ENUM
# JSON                JSON
# LargeBinary         BLOB
# PickleType          序列化对象
```

### 枚举字段

```python
import enum

class UserRole(str, enum.Enum):
    """用户角色枚举"""
    ADMIN = "admin"
    EDITOR = "editor"
    READER = "reader"

class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))

    # 枚举字段
    status: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        default=UserRole.READER,
    )

    # Python 3.11+ 可用 StrEnum
    # from enum import StrEnum
    # class Status(StrEnum):
    #     DRAFT = "draft"
    #     PUBLISHED = "published"
```

---

## 关系映射

### 一对多（One-to-Many）

```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship, Mapped

class Author(Base):
    __tablename__ = "authors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

    # 一对多：一个作者有多篇文章
    books: Mapped[list["Book"]] = relationship(
        "Book",
        back_populates="author",
        cascade="all, delete-orphan",  # 删除作者时级联删除书籍
        lazy="selectin",               # 预加载策略
    )

class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    author_id: Mapped[int] = mapped_column(
        ForeignKey("authors.id", ondelete="CASCADE")
    )

    author: Mapped["Author"] = relationship(
        "Author",
        back_populates="books",
    )

# lazy 加载策略详解：
# "select"     → 访问时单独查询（默认，N+1 问题来源）
# "selectin"   → 访问时 IN 查询（推荐，一次查 N 条）
# "joined"      → 主查询时 JOIN（适合一对少）
# "subquery"    → 子查询预加载
# "raise"       → 访问未加载的关系直接报错（强制显式加载）
# "noload"      → 从不加载（手动控制）
```

### 多对多（Many-to-Many）

```python
from sqlalchemy import Table, Column, ForeignKey, Integer, String

# 多对多关联表
article_tags = Table(
    "article_tags",
    Base.metadata,
    Column("article_id", ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))

    # 多对多：通过关联表访问标签
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=article_tags,  # 指定关联表
        back_populates="articles",
        lazy="selectin",
    )

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)

    articles: Mapped[list["Article"]] = relationship(
        "Article",
        secondary=article_tags,
        back_populates="tags",
    )

# 使用
article = session.get(Article, 1)
for tag in article.tags:
    print(tag.name)

# 添加标签
from sqlalchemy import insert
tag = session.get(Tag, 5)
article.tags.append(tag)
session.commit()
```

### 一对一（One-to-One）

```python
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,  # 关键：一对一必须 unique
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="profile",
    )

class User(Base):
    # ...

    profile: Mapped["UserProfile | None"] = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,  # 关键：一对一关系
        cascade="all, delete-orphan",
    )

# 使用
user = session.get(User, 1)
if user.profile:
    print(user.profile.avatar_url)
```

---

## Session 管理

### 创建与使用

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 1. 创建引擎
engine = create_engine(
    "sqlite:///./app.db",              # SQLite
    # "postgresql://user:pass@localhost/mydb",  # PostgreSQL
    # "mysql+pymysql://user:pass@localhost/mydb",  # MySQL
    echo=True,                          # 打印 SQL（开发用）
    pool_size=5,                        # 连接池大小
    max_overflow=10,                    # 溢出连接数
    pool_pre_ping=True,                 # 使用前 ping 检查连接
    pool_recycle=3600,                  # 回收连接时间（秒）
)

# 2. 创建 Session 类
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,  # 必须显式 commit
    autoflush=False,   # 必须显式 flush
)

# 3. 获取 Session（上下文管理器，推荐）
def get_db():
    """FastAPI 依赖注入用"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 或手动使用
with SessionLocal() as session:
    user = session.get(User, 1)
    print(user.name)
# 自动 close()

# ❌ 手动管理（容易忘记 close）
def bad_example():
    session = SessionLocal()
    user = session.get(User, 1)
    session.close()  # 容易漏掉
    return user

# ✅ 上下文管理器（推荐）
def good_example():
    with SessionLocal() as session:
        user = session.get(User, 1)
        return user  # 退出 with 时自动 close
```

### 增删改查（CRUD）

```python
# === CREATE ===
# 方式 1：add（单个）
user = User(name="Alice", email="alice@example.com")
session.add(user)
session.commit()
print(user.id)  # 自动生成的主键

# 方式 2：add_all（批量）
users = [
    User(name="Bob", email="bob@example.com"),
    User(name="Charlie", email="charlie@example.com"),
]
session.add_all(users)
session.commit()

# === READ ===
# 按主键查（推荐）
user = session.get(User, 1)

# 按条件查（返回第一个或 None）
user = session.query(User).filter(User.email == "alice@example.com").first()
# 或用 ORM 风格
user = session.query(User).filter_by(email="alice@example.com").first()

# 查所有
all_users = session.query(User).all()

# 条件查询（丰富表达式）
from sqlalchemy import and_, or_, not_, func

# AND
session.query(User).filter(
    and_(User.age >= 18, User.is_active == True)
).all()

# OR
session.query(User).filter(
    or_(User.name == "Alice", User.name == "Bob")
).all()

# NOT
session.query(User).filter(User.name != "Alice").all()

# LIKE / ILIKE
session.query(User).filter(User.name.like("A%")).all()       # 大小写敏感
session.query(User).filter(User.name.ilike("a%")).all()       # 大小写不敏感

# IN
session.query(User).filter(User.id.in_([1, 2, 3])).all()

# BETWEEN
from datetime import datetime, timedelta
recent = datetime.utcnow() - timedelta(days=7)
session.query(User).filter(User.created_at.between(recent, datetime.utcnow())).all()

# NULL
session.query(User).filter(User.bio.is_(None)).all()
session.query(User).filter(User.bio.isnot(None)).all()

# COUNT / SUM / AVG
from sqlalchemy import func
count = session.query(func.count(User.id)).scalar()
avg_age = session.query(func.avg(User.age)).scalar()
total_posts = session.query(func.count(Post.id)).filter(Post.author_id == 1).scalar()

# === UPDATE ===
# 方式 1：修改对象后 commit
user = session.get(User, 1)
user.name = "Alice Updated"
user.age = 25
session.commit()

# 方式 2：批量更新（Core 风格，性能更好）
from sqlalchemy import update
session.execute(
    update(User)
    .where(User.is_active == False)
    .values(is_active=True)
)
session.commit()

# 方式 3：filter + update
session.query(User).filter(User.age < 18).update({"age": 18})

# === DELETE ===
# 单个
user = session.get(User, 1)
session.delete(user)
session.commit()

# 批量
session.query(User).filter(User.is_active == False).delete()
session.commit()
```

### 分页与排序

```python
from sqlalchemy import desc, asc

# 分页
PAGE = 2
PAGE_SIZE = 20

users = (
    session.query(User)
    .order_by(User.created_at.desc())  # 排序
    .offset((PAGE - 1) * PAGE_SIZE)    # 跳过
    .limit(PAGE_SIZE)                  # 取多少条
    .all()
)

# 总数（分页时需要）
total = session.query(func.count(User.id)).scalar()
total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE

# 排序
session.query(User).order_by(User.name)                          # 升序
session.query(User).order_by(desc(User.created_at))             # 降序
session.query(User).order_by(User.is_active, User.name.desc())   # 多字段排序

# 随机排序（PostgreSQL）
from sqlalchemy import func
session.query(User).order_by(func.random()).first()
```

---

## 关系查询

### JOIN 表达式

```python
# === 一对多查询 ===

# 查所有文章及其作者（JOIN）
results = (
    session.query(Post, User.name)
    .join(User, Post.author_id == User.id)
    .all()
)

# 或用 ORM 关系
posts = session.query(Post).options(joinedload(Post.author)).all()
for post in posts:
    print(post.author.name)  # 已预加载，不会 N+1

# 查某作者的所有文章
author = session.get(User, 1)
posts = author.posts  # 通过关系访问

# === 筛选 + JOIN ===
# 查所有已发布文章及其作者邮箱
results = (
    session.query(Post.title, User.email)
    .join(User, Post.author_id == User.id)
    .filter(
        Post.status == "published",
        User.is_active == True,
    )
    .order_by(Post.created_at.desc())
    .limit(10)
    .all()
)

# === 子查询 ===
from sqlalchemy import select, exists

# 查有文章的用户
subquery = (
    select(Post.author_id)
    .distinct()
)
users_with_posts = (
    session.query(User)
    .filter(User.id.in_(subquery))
    .all()
)

# 查没有文章的用户（NOT EXISTS）
no_posts = (
    session.query(User)
    .filter(~exists().where(Post.author_id == User.id))
    .all()
)

# 用 has() 和 ~has()（更简洁）
from sqlalchemy.orm import has()
users_without_posts = session.query(User).filter(~has(User.posts)).all()
```

---

## Alembic 数据库迁移

### 初始化

```bash
# 安装
pip install alembic

# 初始化（生成 migrations 目录）
alembic init migrations

# 配置 alembic.ini
# sqlalchemy.url = postgresql://user:pass@localhost/mydb
# 或使用环境变量
# sqlalchemy.url = driver://user:pass@localhost/db?host=/var/lib/postgresql

# 配置 env.py（加载模型）
# 在 env.py 中添加：
# from my_app.models import Base
# target_metadata = Base.metadata
```

### 常用命令

```bash
# 创建迁移
alembic revision --autogenerate -m "add users table"
# 生成 migrations/versions/xxx_add_users.py

# 查看历史
alembic history --verbose

# 升级
alembic upgrade head          # 升级到最新
alembic upgrade +1           # 升级一个版本
alembic upgrade a1b2c3d4     # 升级到指定版本

# 降级
alembic downgrade -1        # 降级一个版本
alembic downgrade base       # 降级到初始状态

# 检查当前版本
alembic current

# 清理（删库重建，适合开发环境）
alembic downgrade base
alembic upgrade head
```

### 迁移文件示例

```python
# migrations/versions/xxx_add_users.py

def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

def downgrade():
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

# 常用操作
op.create_table(...)
op.drop_table("users")
op.add_column("users", sa.Column("age", sa.Integer()))
op.drop_column("users", "age")
op.alter_column("users", "name", new_column_name="username")
op.create_index(...)
op.drop_index(...)
op.add_foreign_key("posts", "users", ["author_id"], ["id"])
op.rename_table("old_name", "new_name")
```

---

## 实战案例

### FastAPI + SQLAlchemy 完整示例

```python
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

app = FastAPI()

# 数据库配置
DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 模型
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    author: Mapped["User"] = relationship("User", back_populates="posts")

# 创建表
Base.metadata.create_all(bind=engine)

# Session 依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schema
class UserCreate(BaseModel):
    name: str
    email: EmailStr

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}

class PostCreate(BaseModel):
    title: str
    content: str
    author_id: int

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    author_name: Optional[str] = None

    model_config = {"from_attributes": True}

# API 路由
@app.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # 检查邮箱是否已存在
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    db_user = User(name=user.name, email=user.email)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

@app.get("/users/", response_model=list[UserResponse])
def list_users(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return db.query(User).offset(skip).limit(limit).all()

@app.post("/posts/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    # 检查作者是否存在
    author = db.get(User, post.author_id)
    if not author:
        raise HTTPException(status_code=404, detail="作者不存在")

    db_post = Post(**post.model_dump())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    # 返回带作者名的响应
    return PostResponse(
        id=db_post.id,
        title=db_post.title,
        content=db_post.content,
        author_id=db_post.author_id,
        author_name=author.name,
    )

@app.get("/posts/", response_model=list[PostResponse])
def list_posts(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    posts = (
        db.query(Post)
        .options(joinedload(Post.author))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        PostResponse(
            id=p.id,
            title=p.title,
            content=p.content,
            author_id=p.author_id,
            author_name=p.author.name if p.author else None,
        )
        for p in posts
    ]

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()
```

---

## 生产环境优化

### 连接池配置

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool, NullPool

# PostgreSQL 典型配置
engine = create_engine(
    "postgresql://user:pass@localhost/mydb",
    poolclass=QueuePool,
    pool_size=10,           # 基础连接数
    max_overflow=20,        # 溢出最多 20 个
    pool_timeout=30,        # 等待连接超时（秒）
    pool_recycle=1800,     # 每 30 分钟回收连接
    pool_pre_ping=True,     # 使用前检查连接有效
)

# MySQL 典型配置
engine = create_engine(
    "mysql+pymysql://user:pass@localhost/mydb",
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
)

# SQLite（不支持连接池，用 NullPool）
engine = create_engine(
    "sqlite:///./app.db",
    poolclass=NullPool,     # SQLite 不适合连接池
    connect_args={"check_same_thread": False},
)

# 什么时候增大连接池：
# 1. 应用并发用户多
# 2. 数据库操作耗时长
# 3. 频繁短连接
# pool_size 建议：CPU 核心数 × 2 + 磁盘数
```

### N+1 查询问题与解决

```python
# N+1 问题：查 10 个用户 + 10 次查各自的文章
# 不好的写法：
users = session.query(User).limit(10).all()
for user in users:
    print(user.name, user.posts)  # 每访问一次 posts 就查一次！

# 解决方案 1：joinedload（JOIN 预加载）
from sqlalchemy.orm import joinedload

users = (
    session.query(User)
    .options(joinedload(User.posts))  # 一次 JOIN 搞定
    .limit(10)
    .all()
)
# SQL: SELECT users.*, posts.* FROM users LEFT JOIN posts ...

# 解决方案 2：selectinload（IN 查询，推荐）
from sqlalchemy.orm import selectinload

users = (
    session.query(User)
    .options(selectinload(User.posts))  # 先查用户，再 IN 查文章
    .limit(10)
    .all()
)
# SQL 1: SELECT * FROM users LIMIT 10
# SQL 2: SELECT * FROM posts WHERE author_id IN (1, 2, 3, ...)

# 解决方案 3：subqueryload
from sqlalchemy.orm import subqueryload

users = (
    session.query(User)
    .options(subqueryload(User.posts))
    .limit(10)
    .all()
)

# 怎么选？
# 一对少（用户→文章）：joinedload
# 一对多（文章→评论）：selectinload
# 复杂多表：分步查询 + selectinload
```

### 事务与并发

```python
# 并发写入：乐观锁
class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=0)  # 乐观锁版本

# 扣库存（乐观锁）
def decrease_stock(db: Session, product_id: int, quantity: int) -> bool:
    """乐观锁扣库存，版本冲突时返回 False"""
    result = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.stock >= quantity,
            Product.version == 0,  # 当前版本
        )
        .update(
            {
                Product.stock: Product.stock - quantity,
                Product.version: Product.version + 1,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return result > 0

# 显式事务控制
from sqlalchemy import text

def transfer(db: Session, from_id: int, to_id: int, amount: int):
    """转账：两个操作在同一个事务中"""
    try:
        db.execute(
            text("UPDATE accounts SET balance = balance - :amount WHERE id = :id"),
            {"amount": amount, "id": from_id}
        )
        db.execute(
            text("UPDATE accounts SET balance = balance + :amount WHERE id = :id"),
            {"amount": amount, "id": to_id}
        )
        db.commit()
    except Exception:
        db.rollback()  # 回滚
        raise
```

---

## 常见陷阱与最佳实践

### 陷阱 1：Session 泄露

```python
# ❌ 陷阱：Session 没有关闭
def get_user(user_id):
    session = SessionLocal()
    user = session.get(User, user_id)
    return user  # Session 未关闭，连接泄漏！

# ✅ 正确：上下文管理器
def get_user(user_id):
    with SessionLocal() as session:
        user = session.get(User, user_id)
        return user

# ✅ FastAPI 依赖注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 陷阱 2：autoflush 导致的奇怪行为

```python
# ❌ 陷阱：autoflush=True 导致的意外查询
session.query(User).filter(User.name == "Alice").all()
# 在这之前执行了 autoflush，未提交的变更被查出来

# ✅ 正确：理解 autoflush
session = SessionLocal(autoflush=True)  # 默认
# flush = 把 pending 变更发送到数据库（但不 commit）
# autoflush = 在 query 前自动 flush

# 关闭 autoflush（更可控）
session = SessionLocal(autoflush=False)
session.add(user)
# 此时不在数据库中，直到 session.commit() 或 session.flush()

# 在 query 前手动 flush
session.flush()
session.query(User).all()
```

### 陷阱 3：循环导入

```python
# ❌ 陷阱：models.py 互相导入
# models/user.py
from models.post import Post  # 循环导入！

# ✅ 正确：用字符串引用（SQLAlchemy 支持）
class User(Base):
    __tablename__ = "users"
    posts = relationship("Post", back_populates="author")

class Post(Base):
    __tablename__ = "posts"
    author_id = mapped_column(ForeignKey("users.id"))
    author = relationship("User", back_populates="posts")

# 或在文件末尾 imports
# models/user.py
# class User(Base): ...
# from models.post import Post  # 放在文件末尾
```

---

## 总结

```
SQLAlchemy 速查：
─────────────────────────────────
操作              方法
─────────────────────────────────
查单个            session.get(Model, id)
查首个            session.query(Model).filter_by(...).first()
查所有            session.query(Model).all()
条件查询          .filter(Model.field == value)
                .filter(Model.field.in_([1,2]))
                .filter(Model.field.like("%x%"))
AND/OR/NOT       and_() / or_() / not_()
排序             .order_by(Model.field.desc())
分页             .offset().limit()
统计             func.count() / func.sum() / func.avg()
新增            session.add(obj) / session.add_all([...])
更新            obj.field = x / session.query(...).update({...})
删除            session.delete(obj) / session.query(...).delete()
提交            session.commit()
回滚            session.rollback()
预加载           joinedload() / selectinload() / subqueryload()
─────────────────────────────────
```

```
relationship lazy 策略速查：
─────────────────────────────────
策略          行为                    推荐场景
─────────────────────────────────
"select"     访问时单独查询（默认）  不推荐，会 N+1
"selectin"   IN 查询预加载（推荐）   一对多
"joined"      主查询 JOIN             一对一 / 一对少
"subquery"    子查询预加载            复杂多表
"raise"       访问未加载则报错        强制显式加载
"noload"      从不加载               手动控制
─────────────────────────────────
```

```
最佳实践：
─────────────────────────────────
✅ 使用 SessionLocal + 上下文管理器或 FastAPI 依赖注入
✅ 一对多用 selectinload，多对一用 joinedload
✅ 用 session.get() 按主键查，用 query().filter() 按条件查
✅ Alembic 管理数据库迁移（不要手动改表）
✅ 生产环境配置连接池（pool_pre_ping=True）
✅ 乐观锁处理并发写入
✅ 显式事务控制（begin/commit/rollback）
✅ 用 Pydantic Schema 做 API 输入输出验证
✅ 连接字符串放环境变量，不硬编码
✅ autoflush=False 更可控，明确 session.flush()
✅ 使用 Mapped 类型注解（SQLAlchemy 2.0 推荐）
✅ unique index 在字段定义时指定（email=True）
✅ foreign_key 定义在子表一侧
✅ cascade="all, delete-orphan" 删除主表时级联删子表
─────────────────────────────────
```

SQLAlchemy 是 Python 数据库操作的瑞士军刀——Core 层处理复杂查询，ORM 层表达业务逻辑，Alembic 管理数据库迁移。三者配合使用，让你的 Python 应用拥有生产级的数据库能力 🦐

本文由小虾子 🦐 撰写
