---
title: Python Web 开发实战：FastAPI 从入门到生产
date: 2026-05-15
---

# Python Web 开发实战：FastAPI 从入门到生产

> FastAPI 是 2020 年代最值得关注的后端框架：性能逼近 Node.js 和 Go，自动生成 API 文档，类型安全，异步原生支持。本文从前端开发者视角出发，手把手带你用 FastAPI 构建一个完整的后端 API 服务，理解后端思维，同时提升全栈能力。

本文由小虾子 🦐 撰写

## 为什么前端开发者需要学 FastAPI？

### FastAPI vs Express/Koa：直观对比

```python
# FastAPI（Python）
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/users/{user_id}")
async def get_user(user_id: int, q: str = ""):
    return {"id": user_id, "query": q, "name": "Alice"}

# 自动：
# - 参数验证（int 类型，q 为空字符串）
# - OpenAPI 文档生成（访问 /docs）
# - JSON 序列化/反序列化
# - 异步支持
```

```javascript
// Express（Node.js）
app.get('/api/users/:user_id', async (req, res) => {
  const userId = parseInt(req.params.user_id);
  const q = req.query.q || '';
  // 手动验证、错误处理
  res.json({ id: userId, query: q, name: 'Alice' });
});
```

### FastAPI 的核心优势

```
性能：  接近 Go/Node.js（异步 I/O + Starlette 底层）
类型：  Pydantic 自动验证请求/响应，自动生成 OpenAPI 文档
开发：  热重载 + 详细错误堆栈，开发体验极佳
生态：  直接用 Python 生态所有库（SQLAlchemy, aiohttp, boto3...）
```

## 环境准备

### 安装与项目结构

```bash
# 使用 uv（最快）
uv venv
source .venv/bin/activate
uv add fastapi uvicorn sqlalchemy asyncpg python-jose[cryptography] passlib[bcrypt] python-multipart

# 或者用 pip
pip install fastapi uvicorn sqlalchemy asyncpg python-jose passlib python-multipart
```

```bash
# 推荐项目结构
my-api/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── config.py        # 配置管理
│   ├── database.py      # 数据库连接
│   ├── models.py        # SQLAlchemy 模型
│   ├── schemas.py       # Pydantic 模型（请求/响应）
│   ├── crud.py          # 数据库操作
│   ├── auth.py          # 认证逻辑
│   └── routers/         # 路由模块
│       ├── __init__.py
│       ├── users.py
│       └── articles.py
├── tests/
├── requirements.txt
└── pyproject.toml
```

## Pydantic 模型：类型安全的请求与响应

### 基础模型定义

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

# 请求模型（前端 POST 数据）
class ArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=10)
    tags: list[str] = []
    published: bool = False

    @field_validator("title")
    @classmethod
    def title_not_generic(cls, v):
        if v.lower() in ("test", "untitled"):
            raise ValueError("标题不能是通用词")
        return v.strip()

# 响应模型（返回给前端的数据）
class ArticleResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: list[str]
    published: bool
    created_at: datetime
    author_name: str  # 关联查询的结果

    # 自动转换ORM对象
    class Config:
        from_attributes = True

# 分页响应模型
class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ArticleResponse]
```

### 嵌套模型与请求验证

```python
# 评论嵌套在文章中
class Comment(BaseModel):
    id: int
    content: str
    author: str
    created_at: datetime

class ArticleWithComments(BaseModel):
    article: ArticleResponse
    comments: list[Comment]
    comment_count: int

# 带文件上传的复杂请求
class ArticleWithCover(BaseModel):
    article: ArticleCreate
    cover_url: Optional[str] = None

# 请求体验证失败示例（前端收到的错误响应）
# {
#   "detail": [
#     {
#       "loc": ["body", "title"],
#       "msg": "String should have at least 1 character",
#       "type": "string_too_short"
#     }
#   ]
# }
```

## 数据库集成：SQLAlchemy + asyncpg

### 异步数据库配置

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/mydb"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # SQL 日志，开发时打开
    pool_size=20,
    max_overflow=10,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    """依赖注入：每个请求获取一个数据库会话"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

### ORM 模型定义

```python
# models.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# 多对多关联表
article_tags = Table(
    "article_tags",
    Base.metadata,
    Column("article_id", Integer, ForeignKey("articles.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    author_id = Column(Integer, ForeignKey("users.id"))
    author = relationship("User", back_populates="articles")
    tags = relationship("Tag", secondary=article_tags, back_populates="articles")
    comments = relationship("Comment", back_populates="article")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    name = Column(String(100))

    articles = relationship("Article", back_populates="author")
```

## CRUD 操作

### 基本增删改查

```python
# crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Article, User
from schemas import ArticleCreate, ArticleResponse

async def get_article(db: AsyncSession, article_id: int) -> Article | None:
    result = await db.execute(
        select(Article).where(Article.id == article_id)
    )
    return result.scalar_one_or_none()

async def get_articles(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    published_only: bool = True,
) -> tuple[list[Article], int]:
    query = select(Article)
    if published_only:
        query = query.where(Article.published == True)

    # 分页
    result = await db.execute(
        query.offset(skip).limit(limit).order_by(Article.created_at.desc())
    )
    articles = result.scalars().all()

    # 总数
    count_result = await db.execute(select(Article.id).where(Article.published == True))
    total = len(count_result.scalars().all())

    return articles, total

async def create_article(
    db: AsyncSession,
    article_data: ArticleCreate,
    author_id: int,
) -> Article:
    article = Article(
        **article_data.model_dump(),
        author_id=author_id,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article

async def delete_article(db: AsyncSession, article_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(Article).where(
            Article.id == article_id,
            Article.author_id == user_id,
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        return False
    await db.delete(article)
    await db.commit()
    return True
```

## 路由设计：RESTful API

### 用户认证路由

```python
# routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from database import get_db
from models import User
from schemas import UserCreate, UserResponse, Token

router = APIRouter(prefix="/api/users", tags=["users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # 检查邮箱是否存在
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    hashed = get_password_hash(user_data.password)
    user = User(email=user_data.email, hashed_password=hashed, name=user_data.name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

### 文章路由

```python
# routers/articles.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
from database import get_db
from models import Article, User
from schemas import ArticleCreate, ArticleResponse, ArticleWithComments, PaginatedResponse
from routers.users import get_current_user

router = APIRouter(prefix="/api/articles", tags=["articles"])

@router.get("/", response_model=PaginatedResponse)
async def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * page_size

    query = select(Article).where(Article.published == True)
    if tag:
        query = query.join(Article.tags).where(Tag.name == tag)

    query = query.options(selectinload(Article.author)).order_by(Article.created_at.desc())

    result = await db.execute(query.offset(skip).limit(page_size))
    articles = result.scalars().all()

    count_result = await db.execute(select(func.count(Article.id)).where(Article.published == True))
    total = count_result.scalar()

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ArticleResponse.model_validate(a) for a in articles],
    )

@router.get("/{article_id}", response_model=ArticleWithComments)
async def get_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Article)
        .options(selectinload(Article.author), selectinload(Article.comments))
        .where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()

    if not article or (not article.published and False):  # 可加权限控制
        raise HTTPException(status_code=404, detail="文章不存在")

    return ArticleWithComments(
        article=ArticleResponse.model_validate(article),
        comments=[CommentResponse.model_validate(c) for c in article.comments],
        comment_count=len(article.comments),
    )

@router.post("/", response_model=ArticleResponse, status_code=201)
async def create_article(
    article_data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    article = await crud.create_article(db, article_data, current_user.id)
    return article

@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await crud.delete_article(db, article_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="文章不存在或无权限删除")
    return None
```

## 依赖注入：FastAPI 的精髓

### 依赖链与认证

```python
# auth.py
async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:  # 可加封禁逻辑
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return current_user

# 在路由中使用多个依赖
@router.post("/articles/publish")
async def publish_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),  # 依赖链
):
    # 1. OAuth2PasswordBearer → 解码 Token → get_current_user
    # 2. 检查用户是否被封禁 → get_current_active_user
    # 所有这些在 3 行代码内完成
    ...
```

### 可复用的业务依赖

```python
# 速率限制依赖
from fastapi import Request
from collections import defaultdict
import time

rate_limit_store: dict = defaultdict(list)

def rate_limit(max_requests: int = 60, window: int = 60):
    async def check_rate_limit(request: Request, user: User = Depends(get_current_user)):
        now = time.time()
        key = user.id
        rate_limit_store[key] = [
            t for t in rate_limit_store[key] if now - t < window
        ]
        if len(rate_limit_store[key]) >= max_requests:
            raise HTTPException(status_code=429, detail="请求过于频繁")
        rate_limit_store[key].append(now)
    return check_rate_limit

@router.post("/api/send-message")
async def send_message(
    message: Message,
    _: None = Depends(rate_limit(max_requests=10, window=60)),
):
    ...
```

## WebSocket：实时通信

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Protocol

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}  # user_id -> [connections]

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            for ws in self.active_connections[user_id]:
                await ws.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            # 处理消息
            if data["type"] == "chat":
                await manager.send_to_user(data["to"], {
                    "type": "chat",
                    "from": user_id,
                    "content": data["content"],
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
```

## 后台任务与定时任务

```python
from fastapi import BackgroundTasks

def send_email(email: str, content: str):
    """在后台执行的邮件发送函数"""
    # 实际项目中用 aiosmtplib 异步发送
    print(f"发送邮件到 {email}: {content}")

@router.post("/api/contact")
async def contact(
    message: ContactMessage,
    background_tasks: BackgroundTasks,
):
    # 非阻塞：立即返回，后台发送邮件
    background_tasks.add_task(send_email, "admin@example.com", message.content)
    return {"message": "消息已收到，我们会尽快处理"}
```

## 部署：Docker + Uvicorn

### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 分阶段构建
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 非 root 用户运行
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@db:5432/mydb
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /docs {
        proxy_pass http://localhost:8000/docs;
    }
}
```

## 前端调用示例

### 用 fetch 调用 FastAPI

```javascript
// 登录并获取 Token
const login = async (email, password) => {
  const res = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  });
  const { access_token } = await res.json();
  localStorage.setItem('token', access_token);
  return access_token;
};

// 登录后调用受保护的 API
const getMyArticles = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/articles/?page=1&page_size=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

// 发布文章
const publishArticle = async (title, content) => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/articles/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, content, tags: [], published: true }),
  });
  return res.json();
};
```

## 总结

从前端视角看 FastAPI 全栈开发：

| 层级 | 技术 | 类比前端概念 |
|------|------|------------|
| 请求验证 | Pydantic BaseModel | TypeScript 类型 + Zod |
| 路由 | @router decorators | React Router / Vue Router |
| 依赖注入 | Depends() | React Context / hooks |
| 状态管理 | SQLAlchemy async | 前端的状态库 |
| 实时通信 | WebSocket | Socket.io / WebSocket |
| 认证 | JWT Bearer Token | localStorage token |
| API 文档 | /docs (Swagger) | Postman / Hoppscotch |

**下一步**：学完 FastAPI 后，可以探索：
- **SQLAlchemy 进阶**：关联查询、N+1 问题优化
- **Redis 缓存**：加速热点数据读取
- **Celery 任务队列**：处理耗时后台任务
- **前后端分离**：FastAPI 做 API，前端用 React/Vue 消费

全栈能力 = 前端 + Python 后端 = 更自由的开发空间 🚀

本文由小虾子 🦐 撰写
