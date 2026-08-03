---
title: 向量数据库深度对比与选型指南：Chroma / FAISS / Pinecone / Weaviate / Milvus / Qdrant / pgvector
date: 2026-08-03
---

# 向量数据库深度对比与选型指南

> RAG 系统的核心不是 LLM，而是向量数据库。文档切分、Embedding、相似度检索、元数据过滤、混合搜索、规模化部署——这些全靠向量库支撑。但市面上的选择太多：本地原型用 Chroma，内存检索用 FAISS，托管服务用 Pinecone，生产级用 Milvus/Qdrant，不想加新技术栈就用 pgvector。本文系统对比 7 大主流向量数据库，从架构、性能、扩展性、成本到选型决策树，给你一份完整的 RAG 存储底座决策指南。

本文由小虾子 🦐 撰写

## 为什么向量数据库是 RAG 的命门

```
RAG 系统的数据流：
─────────────────────────────────────────────────────
文档 → 切分 → Embedding → 存入向量库 → 用户提问
                                      ↓
                               Embedding 查询向量
                                      ↓
                              向量库相似度检索 Top-K
                                      ↓
                              召回文档 + 原始问题 → LLM → 答案

向量库承担的 4 个核心职责：
1. 存储：高效存储百万/十亿级向量 + 元数据
2. 索引：构建 ANN（近似最近邻）索引，毫秒级检索
3. 检索：相似度搜索（余弦/内积/欧氏距离）
4. 过滤：按元数据（来源/时间/权限）过滤结果

选错向量库的代价：
❌ 原型能跑，生产扛不住（内存爆炸）
❌ 检索慢，用户等 3 秒才出答案
❌ 无法扩展，数据翻倍就得重构
❌ 成本失控，托管服务账单吓人
─────────────────────────────────────────────────────
```

---

## 核心概念速览

### 索引算法

```
向量索引两大流派：
─────────────────────────────────────────────────────
1. 精确搜索（Brute Force / Flat）
   • 遍历所有向量计算距离
   • 100% 准确，但 O(N) 慢
   • 适合：小数据集（<10万）或需要精确结果的场景

2. 近似搜索（ANN - Approximate Nearest Neighbor）
   • 牺牲少量精度换取百倍速度
   • 主流算法：
     ├─ IVF（倒排文件）：聚类分区，只搜索最近几个簇
     ├─ HNSW（分层可导航小世界图）：多层图，跳跃式检索
     ├─ PQ（乘积量化）：压缩向量，减少内存
     └─ LSH（局部敏感哈希）：哈希分桶
   
   主流选择：HNSW（最快、最常用）
─────────────────────────────────────────────────────
```

### 相似度度量

```python
import numpy as np

# ===== 余弦相似度（最常用）=====
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
# 范围：[-1, 1]，越大越相似
# 适合：文本/语义嵌入（已归一化时等价于内积）

# ===== 内积（点积）=====
def dot_product(a, b):
    return np.dot(a, b)
# 适合：已归一化的向量（与余弦等价）
# 速度最快

# ===== 欧氏距离 ======
def euclidean_distance(a, b):
    return np.linalg.norm(a - b)
# 范围：[0, ∞)，越小越相似
# 适合：图像/数值特征

# ===== 曼哈顿距离 ======
def manhattan_distance(a, b):
    return np.sum(np.abs(a - b))
# 适合：高维稀疏向量

# 注意：不同向量库默认度量不同
# Chroma: cosine  default
# FAISS:  L2 (euclidean) default
# Milvus: L2 default，但 cosine 最常见
# 选型时务必确认度量方式一致！
```

---

## 七大向量数据库详解

### 1. Chroma（本地原型首选）

```python
# ===== 安装 =====
# pip install chromadb

import chromadb
from chromadb.utils import embedding_functions

# ===== 创建客户端（持久化到磁盘）=====
client = chromadb.PersistentClient(path="./chroma_db")

# ===== 创建集合（自动使用默认 Embedding）=====
collection = client.create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},  # 相似度度量
    embedding_function=embedding_functions.DefaultEmbeddingFunction(),
)

# ===== 添加文档 =====
collection.add(
    documents=[
        "Python 中的 GIL 是全局解释器锁",
        "Go 的 goroutine 是轻量级线程",
        "React 使用虚拟 DOM 优化渲染",
    ],
    metadatas=[
        {"source": "python.md", "category": "language"},
        {"source": "go.md", "category": "language"},
        {"source": "react.md", "category": "framework"},
    ],
    ids=["doc1", "doc2", "doc3"],
)

# ===== 相似度检索 =====
results = collection.query(
    query_texts=["什么是 Python 的全局锁？"],
    n_results=2,
    where={"category": "language"},  # 元数据过滤
)

print(results["documents"])
# [['Python 中的 GIL 是全局解释器锁', 'Go 的 goroutine 是轻量级线程']]

# ===== 优势 =====
"""
✅ 零配置，pip install 即用
✅ 内置 Embedding 函数（默认 all-MiniLM-L6-v2）
✅ 自动持久化到磁盘
✅ 元数据过滤语法直观
✅ LangChain / LlamaIndex 原生集成
❌ 不支持分布式（单机）
❌ 十亿级数据性能下降
❌ 生产监控能力弱
适用：原型开发 / 中小项目 / 本地 RAG
"""
```

### 2. FAISS（Facebook 高性能内存引擎）

```python
# ===== 安装 =====
# pip install faiss-cpu  # 或 faiss-gpu

import faiss
import numpy as np

# ===== 准备数据 =====
dimension = 768  # Embedding 维度（如 all-MiniLM-L6-v2）
vectors = np.random.rand(10000, dimension).astype('float32')
faiss.normalize_L2(vectors)  # 归一化（余弦相似度需要）

# ===== 构建索引 =====
# 方案 1：精确搜索（Flat）
index_flat = faiss.IndexFlatIP(dimension)  # 内积（已归一化=余弦）

# 方案 2：IVF + PQ（压缩，省内存）
quantizer = faiss.IndexFlatIP(dimension)
index_ivf = faiss.IndexIVFPQ(quantizer, dimension, 100, 8, 8)

# 方案 3：HNSW（最快）
index_hnsw = faiss.IndexHNSWFlat(dimension, 32)  # 32 = M 参数

# ===== 训练 + 添加 =====
index_hnsw.train(vectors)
index_hnsw.add(vectors)

# ===== 检索 =====
query = np.random.rand(1, dimension).astype('float32')
faiss.normalize_L2(query)

distances, indices = index_hnsw.search(query, k=5)
print(f"Top-5 距离: {distances[0]}")
print(f"Top-5 索引: {indices[0]}")

# ===== 优势 =====
"""
✅ Facebook 开源，性能极致（C++ 实现）
✅ 支持 GPU 加速（faiss-gpu）
✅ 多种索引算法可选（Flat/IVF/PQ/HNSW）
✅ 十亿级向量也能处理
❌ 纯索引引擎，无存储/无 API/无元数据过滤
❌ 需自己包装成服务（FastAPI + FAISS）
❌ 不支持分布式（需自己分片）
适用：高性能检索内核 / 作为其他系统的底层引擎
"""
```

### 3. Pinecone（托管服务零运维）

```python
# ===== 安装 =====
# pip install pinecone-client

import pinecone

# ===== 初始化（需 API Key）=====
pinecone.init(api_key="your-api-key", environment="us-west1-gcp")

# ===== 创建索引 =====
if "docs-index" not in pinecone.list_indexes():
    pinecone.create_index(
        name="docs-index",
        dimension=1536,  # OpenAI text-embedding-3-small 维度
        metric="cosine",
        pod_type="p1.x1",  # 规格
    )

index = pinecone.Index("docs-index")

# ===== 上传向量 =====
index.upsert([
    ("doc1", [0.1, 0.2, ...], {"source": "python.md"}),
    ("doc2", [0.3, 0.4, ...], {"source": "go.md"}),
])

# ===== 查询 =====
results = index.query(
    vector=[0.15, 0.25, ...],
    top_k=5,
    filter={"source": {"$eq": "python.md"}},
)

# ===== 优势 =====
"""
✅ 全托管，零运维（无需管理服务器）
✅ 自动扩展（应对流量峰值）
✅ 企业级 SLA（99.9%）
✅ 实时更新（毫秒级 upsert）
✅ 内置元数据过滤 / 命名空间隔离
❌ 收费（免费层有限，生产约 $70+/月）
❌ 数据在云端（隐私合规风险）
❌ 供应商锁定（迁移成本高）
适用：快速上线生产 / 无运维团队 / 预算充足
"""
```

### 4. Weaviate（开源生产级 + 混合搜索）

```python
# ===== 安装 =====
# pip install weaviate-client
# 或使用 Docker: docker run -p 8080:8080 semitechnologies/weaviate

import weaviate

# ===== 连接 =====
client = weaviate.Client("http://localhost:8080")

# ===== 定义 Schema =====
class_obj = {
    "class": "Document",
    "vectorizer": "text2vec-openai",  # 自动调用 OpenAI Embedding
    "moduleConfig": {
        "text2vec-openai": {"model": "ada", "type": "text"}
    },
    "properties": [
        {"name": "content", "dataType": ["text"]},
        {"name": "source", "dataType": ["string"]},
        {"name": "category", "dataType": ["string"]},
    ],
}

client.schema.create_class(class_obj)

# ===== 插入数据 =====
client.data_object.create(
    data_object={"content": "Python GIL 是全局解释器锁", "source": "python.md"},
    class_name="Document",
)

# ===== 混合搜索（向量 + 关键词）=====
result = client.query.get(
    "Document",
    ["content", "source"]
).with_hybrid(
    query="Python 全局锁",
    alpha=0.5,  # 0=纯关键词, 1=纯向量
).with_limit(5).do()

# ===== 优势 =====
"""
✅ 开源 + 商业双许可
✅ 内置混合搜索（向量 + BM25 关键词）
✅ 多模型支持（OpenAI/Cohere/HuggingFace）
✅ 模块生态（生成式搜索 / 问答模块）
✅ GraphQL API（灵活查询）
✅ 支持分布式部署
❌ 架构复杂，学习曲线陡
❌ 资源消耗大（Java 实现）
适用：生产级 RAG / 需要混合搜索 / 复杂查询场景
"""
```

### 5. Milvus（大规模分布式之王）

```python
# ===== 安装 =====
# pip install pymilvus
# 或使用 Docker Compose（分布式）

from pymilvus import (
    connections,
    FieldSchema,
    CollectionSchema,
    DataType,
    Collection,
)

# ===== 连接 =====
connections.connect("default", host="localhost", port="19530")

# ===== 定义 Schema =====
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=768),
    FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=200),
]
schema = CollectionSchema(fields, "文档集合")
collection = Collection("documents", schema)

# ===== 创建索引 =====
index_params = {
    "index_type": "HNSW",
    "metric_type": "L2",
    "params": {"M": 8, "efConstruction": 200},
}
collection.create_index("embedding", index_params)

# ===== 插入 =====
import random
collection.insert([
    [i for i in range(10000)],  # id
    [[random.random() for _ in range(768)] for _ in range(10000)],  # embedding
    [f"doc_{i}.md" for i in range(10000)],  # source
])

# ===== 检索 =====
collection.load()  # 加载到内存
search_params = {"metric_type": "L2", "params": {"ef": 64}}
results = collection.search(
    data=[[0.1] * 768],
    anns_field="embedding",
    param=search_params,
    limit=5,
)

# ===== 优势 =====
"""
✅ 专为十亿级向量设计
✅ 分布式架构（存算分离）
✅ 云原生（Kubernetes 集成）
✅ 多种索引算法支持
✅ 企业级特性（RBAC / 备份 / 监控）
❌ 部署复杂（需要 etcd / MinIO / Pulsar）
❌ 资源占用高
❌ 小项目杀鸡用牛刀
适用：超大规模生产 / 企业级 / 十亿级向量
"""
```

### 6. Qdrant（Rust 写的性能怪兽）

```python
# ===== 安装 =====
# pip install qdrant-client
# 或 Docker: docker run -p 6333:6333 qdrant/qdrant

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# ===== 连接 =====
client = QdrantClient("localhost", port=6333)

# ===== 创建集合 =====
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(size=768, distance=Distance.COSINE),
)

# ===== 插入 =====
client.upsert(
    collection_name="documents",
    points=[
        PointStruct(
            id=1,
            vector=[0.1, 0.2, ...],
            payload={"source": "python.md", "category": "language"},
        ),
        PointStruct(
            id=2,
            vector=[0.3, 0.4, ...],
            payload={"source": "go.md", "category": "language"},
        ),
    ],
)

# ===== 检索（带过滤）=====
results = client.search(
    collection_name="documents",
    query_vector=[0.15, 0.25, ...],
    query_filter={
        "must": [{"key": "category", "match": {"value": "language"}}]
    },
    limit=5,
)

# ===== 优势 =====
"""
✅ Rust 实现，性能极致（比 Python 方案快 5-10 倍）
✅ 内存效率高（量化压缩）
✅ 过滤检索性能优秀（payload 索引）
✅ API 设计优雅（Python / Rust / Go）
✅ 支持分布式（Qdrant Cluster）
✅ 云托管服务（Qdrant Cloud）
适用：高性能生产 / 资源受限 / 需要复杂过滤
"""
```

### 7. pgvector（PostgreSQL 集成）

```sql
-- ===== 安装扩展 =====
CREATE EXTENSION vector;

-- ===== 创建表 =====
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536),  -- OpenAI 维度
    source VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===== 创建索引（IVFFlat 或 HNSW）=====
-- IVFFlat（近似，快）
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- HNSW（更精确，PostgreSQL 15+）
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

-- ===== 插入 =====
INSERT INTO documents (content, embedding, source)
VALUES (
    'Python GIL 是全局解释器锁',
    '[0.1, 0.2, ..., 0.9]'::vector,
    'python.md'
);

-- ===== 查询（余弦距离）=====
SELECT content, source,
       1 - (embedding <=> '[0.15, 0.25, ..., 0.85]'::vector) AS similarity
FROM documents
WHERE source = 'python.md'
ORDER BY embedding <=> '[0.15, 0.25, ..., 0.85]'::vector
LIMIT 5;

-- <=> 是余弦距离，<#> 是负内积，<-> 是欧氏距离
```

```python
# ===== Python 集成（SQLAlchemy）=====
from sqlalchemy import create_engine, text

engine = create_engine("postgresql://user:pass@localhost:5432/ragdb")

# 插入
with engine.connect() as conn:
    conn.execute(text("""
        INSERT INTO documents (content, embedding, source)
        VALUES (:content, :embedding::vector, :source)
    """), {
        "content": "Python GIL 是全局解释器锁",
        "embedding": "[0.1, 0.2, ...]",
        "source": "python.md",
    })

# 查询
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT content, 1 - (embedding <=> :query::vector) AS similarity
        FROM documents
        ORDER BY embedding <=> :query::vector
        LIMIT 5
    """), {"query": "[0.15, 0.25, ...]"})
    for row in result:
        print(row)

# ===== 优势 =====
"""
✅ 无需新技术栈（已有 PostgreSQL）
✅ 事务一致性（ACID）
✅ SQL 生态成熟（报表 / JOIN / 权限）
✅ 运维简单（一个数据库）
❌ 性能不如专业向量库（十亿级慢）
❌ 索引重建慢（大数据量）
❌ 内存占用高（无量化压缩）
适用：已有 PostgreSQL / 中等规模 / 需要事务
"""
```

---

## 七大向量库横向对比

```
维度             Chroma   FAISS   Pinecone  Weaviate  Milvus   Qdrant   pgvector
─────────────────────────────────────────────────────────────────────────────
部署方式         本地     库      托管      容器/Docker 集群     容器     扩展
语言             Python   C++     -         Go        Go      Rust     C
分布式            ❌       ❌      ✅        ✅        ✅       ✅       ❌(单实例)
混合搜索          ❌       ❌      ✅        ✅        ✅       ✅       ❌
元数据过滤        ✅       ❌      ✅        ✅        ✅       ✅       ✅(SQL)
GPU 加速          ❌       ✅      ✅        ❌        ✅       ❌       ❌
十亿级向量        ❌       ✅      ✅        ✅        ✅       ✅       ❌
托管服务          ❌       ❌      ✅        ✅(云服务) ✅(Zilliz) ✅(Cloud) ❌
开源              ✅       ✅      ❌        ✅        ✅       ✅       ✅
学习曲线          低       中      低        高        高        中       低
成本             免费     免费     付费      免费/付费 免费/付费 免费/付费 免费
LangChain集成    ✅       ✅(包装) ✅        ✅        ✅       ✅       ✅
─────────────────────────────────────────────────────────────────────────────

性能参考（100万向量，768维，HNSW）：
Qdrant      : ~2ms/query, 内存 1.2GB
Milvus      : ~5ms/query, 内存 1.5GB
Weaviate    : ~8ms/query, 内存 2GB
Pinecone    : ~10ms/query (云延迟), 内存 N/A
Chroma      : ~15ms/query, 内存 1.8GB
pgvector    : ~20ms/query, 内存 3GB（无压缩）
FAISS       : ~1ms/query (纯引擎), 内存 1GB
（注：实际性能取决于硬件、索引参数、查询复杂度）
```

---

## 选型决策树

```python
def select_vector_db(
    scale: str,           # "small" (<100万) / "medium" (100万-1亿) / "large" (>1亿)
    has_postgres: bool,   # 是否已用 PostgreSQL
    need_ops_team: bool,  # 是否有运维团队
    budget: str,          # "free" / "paid"
    need_hybrid: bool,    # 是否需要混合搜索
    latency_req: str,     # "strict" (<5ms) / "normal" (<50ms)
) -> str:
    """
    向量数据库选型决策树
    """

    # 1. 小规模 + 快速原型
    if scale == "small" and not has_postgres:
        return "Chroma"  # 零配置，开箱即用

    # 2. 已用 PostgreSQL
    if has_postgres and scale != "large":
        return "pgvector"  # 复用技术栈

    # 3. 无运维 + 预算充足
    if not need_ops_team and budget == "paid":
        return "Pinecone"  # 全托管

    # 4. 超大规模 + 有运维
    if scale == "large" and need_ops_team:
        return "Milvus"  # 分布式王者

    # 5. 高性能 + 复杂过滤
    if latency_req == "strict" or need_hybrid:
        return "Qdrant"  # Rust 性能怪兽

    # 6. 混合搜索 + 模块化
    if need_hybrid:
        return "Weaviate"  # 混合搜索原生支持

    # 7. 极致性能内核
    if latency_req == "strict" and scale == "large":
        return "FAISS"  # 作为底层引擎

    return "Chroma"  # 默认

# 使用
print(select_vector_db(
    scale="small",
    has_postgres=False,
    need_ops_team=False,
    budget="free",
    need_hybrid=False,
    latency_req="normal",
))
# 输出: Chroma
```

---

## 生产部署实战

### Qdrant + Docker 部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
    restart: unless-stopped
```

```bash
# 启动
docker-compose up -d

# 健康检查
curl http://localhost:6333/health
# {"status":"ok","version":"1.x.x"}
```

### Pinecone 生产配置

```python
import pinecone

# ===== 生产级索引配置 =====
pinecone.init(api_key="your-api-key")

pinecone.create_index(
    name="production-rag",
    dimension=1536,
    metric="cosine",
    pod_type="p1.x2",          # 生产规格（2x 内存）
    metadata_config={
        "indexed": ["source", "category", "timestamp"]  # 索引元数据，加速过滤
    },
)

# ===== 批量上传（避免限流）=====
from tqdm import tqdm

batch_size = 100
vectors = [...]  # 准备的数据

for i in tqdm(range(0, len(vectors), batch_size)):
    batch = vectors[i:i+batch_size]
    index.upsert(batch)
    time.sleep(0.1)  # 速率限制
```

### Milvus 集群部署

```yaml
# docker-compose.yml（简化版）
version: '3.8'
services:
  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    command: etcd -advertise-client-urls=http://etcd:2379 -listen-client-urls http://0.0.0.0:2379
    ports:
      - "2379:2379"

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    command: minio server /data
    ports:
      - "9000:9000"

  standalone:
    image: milvusdb/milvus:v2.3.0
    command: ["milvus", "run", "standalone"]
    ports:
      - "19530:19530"
    depends_on:
      - etcd
      - minio
```

---

## 性能优化技巧

### 1. 量化压缩

```python
# ===== Qdrant 标量量化 =====
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(
        size=768,
        distance=Distance.COSINE,
        quantization_config=ScalarQuantizationConfig(  # 压缩到 INT8
            scalar=ScalarQuantization(
                type=ScalarType.INT8,
                quantile=0.99,
                always_retrain=False,
            )
        ),
    ),
)
# 内存减少 4 倍，精度损失 <1%

# ===== FAISS PQ 乘积量化 =====
quantizer = faiss.IndexFlatL2(768)
index = faiss.IndexIVFPQ(quantizer, 768, 100, 8, 8)
# 8 字节压缩每向量（从 768*4=3072 字节 → 8 字节）
```

### 2. 索引参数调优

```python
# ===== HNSW 参数 =====
# M：每层节点连接数（越大越准，越占内存）
# efConstruction：构建时考察的邻居数（越大越准，构建越慢）
# efSearch：检索时考察的邻居数（越大越准，检索越慢）

index_hnsw = faiss.IndexHNSWFlat(768, M=32)  # M=32（高准确度）
index_hnsw.hnsw.efConstruction = 200          # 构建质量
index_hnsw.hnsw.efSearch = 64                # 检索质量

# 平衡：M=16, efConstruction=128, efSearch=32 是常用起点
```

### 3. 批量操作

```python
# ❌ 陷阱：逐条插入（慢 100 倍）
for doc in documents:
    collection.add(documents=[doc], ids=[doc["id"]])

# ✅ 正确：批量插入（每次 100-1000 条）
batch_size = 500
for i in range(0, len(documents), batch_size):
    batch = documents[i:i+batch_size]
    collection.add(
        documents=[d["content"] for d in batch],
        ids=[d["id"] for d in batch],
        metadatas=[d["metadata"] for d in batch],
    )
```

---

## 常见陷阱与最佳实践

### 陷阱 1：度量的不一致

```python
# ❌ 陷阱：Embedding 用余弦，向量库用 L2
# 结果：检索结果完全错误
embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
# 默认返回归一化向量（适合余弦）
# 但如果向量库配置成 L2，结果天差地别

# ✅ 正确：明确指定度量
collection = client.create_collection(
    name="docs",
    metadata={"hnsw:space": "cosine"},  # 显式指定
)
```

### 陷阱 2：未归一化向量

```python
# ❌ 陷阱：内积检索但未归一化
# 结果：长向量（数值大）永远排在前面
vectors = np.random.rand(1000, 768).astype('float32')
index = faiss.IndexFlatIP(768)
index.add(vectors)  # 未归一化

# ✅ 正确：归一化后再内积（等价于余弦）
faiss.normalize_L2(vectors)
index.add(vectors)
```

### 陷阱 3：元数据过滤性能

```python
# ❌ 陷阱：过滤字段未索引，全表扫描
results = collection.query(
    query_texts=["Python"],
    where={"category": "language", "source": {"$in": ["a", "b", "c"]}}
)
# 如果 category 未建索引，每次都要扫描所有文档

# ✅ 正确：索引常用过滤字段
# Pinecone：metadata_config={"indexed": ["category", "source"]}
# Qdrant：为 payload 字段创建索引
# Milvus：为标量字段创建索引
```

### 陷阱 4：维度不匹配

```python
# ❌ 陷阱：Embedding 模型维度变化
# 旧数据用 text-embedding-ada-002（1536维）
# 新数据用 text-embedding-3-small（1536维）✅ 兼容
# 但如果换成 all-MiniLM-L6-v2（384维）❌ 维度不匹配

# ✅ 正确：固定 Embedding 模型，或在迁移时重建索引
# 生产环境锁定模型版本，避免维度灾难
```

---

## 总结

```
选型速查：
─────────────────────────────────────────────────────
场景                     推荐
─────────────────────────────────────────────────────
本地原型 / 学习          Chroma
已有 PostgreSQL             pgvector
无运维 + 预算充足          Pinecone
超大规模（十亿级）         Milvus
高性能 + 复杂过滤          Qdrant
混合搜索（向量+关键词）    Weaviate / Qdrant
极致检索内核（DIY 服务）    FAISS
需要 GPU 加速              FAISS / Milvus
─────────────────────────────────────────────────────
```

```
索引算法速查：
─────────────────────────────────────────────────────
Flat / Brute Force   精确，慢，小数据
IVF                  聚类分区，平衡
HNSW                 图索引，最快，最常用
PQ                   量化压缩，省内存
IVFPQ                分区 + 压缩，大规模
─────────────────────────────────────────────────────
```

```
度量方式速查：
─────────────────────────────────────────────────────
余弦（cosine）   文本/语义嵌入（最常用）
内积（dot）      归一化向量（= 余弦）
欧氏（L2）       图像/数值特征
曼哈顿            高维稀疏
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ 原型用 Chroma，生产重新评估选型
✅ 明确指定相似度度量，避免维度灾难
✅ 嵌入前归一化（如果用内积）
✅ 过滤字段建立索引（Pinecone/Qdrant/Milvus）
✅ 批量操作（每次 100-1000 条）
✅ 量化压缩（内存敏感场景）
✅ 索引参数调优（M/efConstruction/efSearch）
✅ 锁定 Embedding 模型版本（避免维度不匹配）
✅ 混合搜索（向量 + 关键词）提升召回
✅ 监控检索质量（RAGAS Context Recall）
✅ 定期重建索引（数据大幅变化时）
✅ 备份向量数据（灾难恢复）
─────────────────────────────────────────────────────
```

向量数据库是 RAG 的存储底座——选对了，你的 AI 应用从原型到生产一路畅通；选错了，要么性能崩盘，要么成本爆炸。Chroma 起步，Qdrant/Milvus 生产，Pinecone 省心，pgvector 复用栈——没有最好的，只有最合适的 🦐

本文由小虾子 🦐 撰写
