# Embeddings 深度解析：语义检索的数学基石，从原理到生产实战

> 所有 AI 检索系统的第一步，都是把文本变成向量。但你有想过吗：为什么"国王 - 男人 + 女人 ≈ 女王"这样的向量运算能成立？余弦相似度和欧氏距离到底该用哪个？为什么生产环境要用 MRL 截断向量？交叉编码器明明更准，为什么不能替代双编码器？本文从向量空间原理出发，覆盖 Embedding 模型架构、相似度计算、混合检索、MRL 动态维度、评估方法与生产级服务设计，一篇打通语义检索的数学底层。

## 一、Embedding 到底是什么？

### 1.1 从 one-hot 到稠密向量

计算机无法直接理解"猫"和"狗"的语义关系。最朴素的表示是 one-hot 编码：

```
词表：[猫, 狗, 汽车, 飞机]

猫 = [1, 0, 0, 0]
狗 = [0, 1, 0, 0]
汽车 = [0, 0, 1, 0]
飞机 = [0, 0, 0, 1]
```

one-hot 的致命问题：**所有向量两两正交**——"猫"和"狗"的距离，与"猫"和"飞机"的距离完全相等（都是 √2）。语义信息为零。

Embedding 的目标：把离散符号映射到**低维稠密向量空间**，让语义相近的词在空间中彼此靠近：

```
猫   = [0.8,  0.9, -0.1, ...]   ┐
狗   = [0.7,  0.8, -0.2, ...]   ┘ 语义相近，向量接近
汽车 = [-0.5, 0.1, 0.9, ...]       语义无关，向量远离
```

```
        维度 2
          │
    猫 ●  │
   狗 ●   │        ← 语义聚类：动物聚在一起
          │
──────────┼────────────── 维度 1
          │
     汽车 ●│ ● 飞机
          │        ← 语义聚类：交通工具聚在一起
```

### 1.2 著名的向量运算：国王 - 男人 + 女人 ≈ 女王

Word2Vec（2013）时代最惊人的发现：语义关系在向量空间中表现为**方向一致的偏移**。

```python
import numpy as np

# 理想化的示意向量（实际维度 300+）
king    = np.array([0.9, 0.8, 0.3])
man     = np.array([0.8, 0.7, 0.1])
woman   = np.array([0.7, 0.9, 0.1])
queen   = np.array([0.8, 1.0, 0.3])

# 国王 - 男人 + 女人 = ?
result = king - man + woman
# result ≈ [0.8, 1.0, 0.3] ≈ queen  ✅

# 验证相似度
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

print(cosine_similarity(result, queen))   # ≈ 1.0（几乎一致）
print(cosine_similarity(result, king))    # ≈ 0.7（相似但不同）
print(cosine_similarity(result, '汽车'))  # ≈ 0.1（语义无关）
```

这说明：**"性别"这个语义概念，在向量空间中是一个稳定的方向**。国王到女王的方向 ≈ 男人到女人的方向。

### 1.3 现代 Embedding 模型的能力演进

| 时代 | 代表模型 | 维度 | 特点 |
|------|---------|------|------|
| 2013 | Word2Vec | 300 | 静态词向量，一词一向量 |
| 2018 | BERT | 768 | 上下文相关，一词多义 |
| 2021 | sentence-BERT | 768 | 句级语义，检索友好 |
| 2023 | OpenAI text-embedding-3 | 1536/3072 | MRL 可截断、多语言 |
| 2024+ | BGE / GTE / Voyage / Cohere v3 | 1024+ | 指令感知、长文本、SOTA 检索 |

现代 Embedding 与 Word2Vec 的本质区别：

```python
# Word2Vec：静态——"苹果"无论在什么语境都是同一个向量
"我吃了一个苹果"    → apple_vec
"苹果发布了新手机"  → apple_vec  ❌ 语义混淆

# 现代 Embedding：上下文感知
"我吃了一个苹果"    → [食物语义向量]
"苹果发布了新手机"  → [公司语义向量]  ✅ 语义区分
```

## 二、相似度计算：检索的核心数学

### 2.1 四种相似度/距离

```python
import numpy as np

a = np.array([1.0, 2.0, 3.0])
b = np.array([2.0, 4.0, 6.0])
```

**① 余弦相似度（Cosine Similarity）—— 最常用**

```python
def cosine_similarity(a, b):
    """衡量向量方向的相似度，忽略长度"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 值域：[-1, 1]
#  1 → 方向完全相同
#  0 → 正交（无关）
# -1 → 方向完全相反

print(cosine_similarity(a, b))  # 1.0（方向相同，尽管长度不同）
```

**② 欧氏距离（Euclidean / L2）**

```python
def euclidean_distance(a, b):
    """衡量向量在空间中的绝对距离"""
    return np.linalg.norm(a - b)

print(euclidean_distance(a, b))  # ≈ 3.74
```

**③ 点积（Dot Product / Inner Product）**

```python
def dot_product(a, b):
    """同时考虑方向和长度，常用于推荐系统"""
    return np.dot(a, b)

print(dot_product(a, b))  # 28.0
```

**④ 曼哈顿距离（Manhattan / L1）**

```python
def manhattan_distance(a, b):
    """各维度差值绝对值之和，对异常值更鲁棒"""
    return np.sum(np.abs(a - b))

print(manhattan_distance(a, b))  # 6.0
```

### 2.2 该用哪一个？关键决策

```
选择决策树：

你的向量是归一化的吗（长度 = 1）？
  ├── 是 → 余弦相似度 = 点积 = 欧氏距离的单调函数
  │        （三者排序结果完全一致，用最快的点积即可）
  │
  └── 否 → 向量长度携带信息吗？
            ├── 携带（如词频、TF-IDF 加权、推荐系统）→ 点积
            └── 不携带（纯语义）→ 余弦相似度
```

```python
# 为什么归一化后三者等价？
# 归一化：v' = v / ||v||，则 ||v'|| = 1
# 点积：  a' · b' = |a'||b'|cos(θ) = cos(θ)          ← 就是余弦相似度
# 欧氏：  ||a'-b'||² = ||a'||² + ||b'||² - 2a'·b' = 2 - 2cos(θ)  ← 余弦的单调函数

# 所以生产环境的标准做法：
# 入库前全部归一化，检索时用点积（最快）
def normalize(v):
    return v / np.linalg.norm(v)
```

### 2.3 归一化的实战陷阱

```python
# ❌ 陷阱：查询向量忘记归一化
# 场景：文档向量已归一化，但查询向量没有
# 结果：点积大小只反映查询向量长度，排序完全失效

doc_vecs = normalize(np.random.rand(1000, 1536))  # 已归一化
query = np.random.rand(1536)                       # ❌ 未归一化，长度 ≈ 22

scores = doc_vecs @ query  # 排序被查询长度主导？不——此时点积 = ||q||·cos(θ)
# 好消息：单个查询内部排序不受影响（||q|| 是常数）
# 坏消息：跨查询的分数阈值失效、与余弦值不可比

# ✅ 正确做法：所有向量统一归一化管线
class EmbeddingPipeline:
    def encode(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts)
        vecs = np.asarray(vecs)
        # L2 归一化
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        return vecs / np.clip(norms, 1e-12, None)  # 防止除零
```

## 三、Embedding 模型的工作原理

### 3.1 双编码器架构（Bi-Encoder）

检索场景的 Embedding 模型几乎都是**双编码器**：查询和文档分别独立编码，各自得到一个向量。

```
查询 "如何退货"  →  Encoder  →  q_vec [1536]  ─┐
                                               ├─→ 余弦相似度（可预先计算）
文档 "退货政策..." → Encoder  →  d_vec [1536]  ─┘
```

```python
# 双编码器的核心优势：文档向量可以离线预计算
# 100 万文档 → 提前算好 100 万个向量入库
# 用户查询来了 → 只需编码 1 个查询 + 向量检索（毫秒级）

from openai import OpenAI
client = OpenAI()

def embed(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]

# 文档入库（离线、一次性）
docs = ["退货政策：7天无理由...", "配送范围：全国...", ...]
doc_vectors = embed(docs)   # 存入向量数据库

# 查询（在线、实时）
query_vec = embed(["如何退货"])[0]
```

### 3.2 交叉编码器（Cross-Encoder）：更准但更慢

交叉编码器把查询和文档**拼在一起**送入模型，直接输出相关性分数：

```
[CLS] 如何退货 [SEP] 退货政策：7天无理由... [SEP]
            ↓
        Cross-Encoder
            ↓
      相关性分数：0.92
```

```python
# 交叉编码器：每对 (查询, 文档) 都要跑一次完整的前向传播
# 无法预计算 → 无法用于百万级文档的粗检索
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
pairs = [
    ("如何退货", "退货政策：7天无理由退货..."),
    ("如何退货", "配送范围：全国包邮..."),
]
scores = reranker.predict(pairs)
# [0.92, 0.05]  ← 第一个文档高度相关
```

### 3.3 双编码器 vs 交叉编码器：生产组合

| 维度 | Bi-Encoder（双编码器） | Cross-Encoder（交叉编码器） |
|------|----------------------|---------------------------|
| 速度 | ✅ 毫秒级（向量预计算） | ❌ 慢（每对一次前向传播） |
| 精度 | 中等 | ✅ 高（token 级交互） |
| 可扩展性 | ✅ 百万~亿级文档 | ❌ 仅限 Top-K（K 通常 < 100） |
| 用途 | **召回**（粗排） | **重排**（精排） |

```
生产标准架构：召回 + 重排两阶段

百万文档 ──双编码器向量检索──→ Top 100 ──交叉编码器重排──→ Top 5 ──→ LLM
              （毫秒级）                  （几百毫秒）
```

## 四、MRL：可截断的魔法向量

### 4.1 什么是 Matryoshka Representation Learning

MRL（套娃表示学习，以俄罗斯套娃命名）让一个高维向量**前 N 维就能独立使用**：

```
text-embedding-3-large 的 3072 维向量：

[■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■]
 ↑ 前 256 维   → 保留 ~80% 精度，存储降至 1/12
 ↑ 前 1024 维  → 保留 ~95% 精度
 全部 3072 维  → 100% 精度

像套娃一样：大向量里面套着小向量，每一层都完整可用
```

```python
# OpenAI API 直接支持维度参数
response = client.embeddings.create(
    model="text-embedding-3-large",
    input=["如何退货"],
    dimensions=256  # 直接生成 256 维（服务端 MRL）
)

# 或者：本地截断（对开源 MRL 模型）
import numpy as np

def truncate_embedding(vec: np.ndarray, dims: int) -> np.ndarray:
    """截断后必须重新归一化！"""
    truncated = vec[:dims]
    return truncated / np.linalg.norm(truncated)

full = embed(["如何退货"])[0]         # 3072 维
small = truncate_embedding(full, 256) # 256 维，仍然可用
```

### 4.2 MRL 的生产价值：成本-精度滑块

```python
# 不同阶段的维度选择策略
DIMENSION_STRATEGY = {
    "实时搜索建议": 256,    # 追求极致速度，容忍精度损失
    "常规 RAG 检索": 1024,  # 平衡选择（大多数场景的最优解）
    "法律/医疗检索": 3072,  # 精度优先，成本不敏感
}

# 存储成本对比（100 万文档）
# 3072 维 float32: 3072 × 4 bytes × 1M ≈ 12.3 GB
# 1024 维 float32: 1024 × 4 bytes × 1M ≈ 4.1 GB   （-67%）
# 1024 维 int8:    1024 × 1 byte  × 1M ≈ 1.0 GB   （-92%）

# 量化 + MRL 组合：12.3 GB → 1 GB，精度损失 < 3%
```

### 4.3 量化：进一步压缩存储

```python
# int8 量化：float32 → int8，存储降至 1/4
def quantize_to_int8(vec: np.ndarray) -> tuple[np.ndarray, float, float]:
    """对称量化：记录 scale，映射到 [-127, 127]"""
    scale = 127.0 / np.max(np.abs(vec))
    quantized = np.round(vec * scale).astype(np.int8)
    return quantized, scale, 0.0

def dequantize(quantized: np.ndarray, scale: float) -> np.ndarray:
    return quantized.astype(np.float32) / scale

# 二值量化：存储降至 1/32，召回率约 90-95%
def quantize_to_binary(vec: np.ndarray) -> np.ndarray:
    """符号量化：正数→1，负数→0"""
    return (vec > 0).astype(np.uint8)

# 生产组合拳：二值粗筛 + int8 精筛 + float32 精排
# Milvus / Qdrant 等数据库原生支持这种多级索引
```

## 五、混合检索：Embedding 的最佳拍档

### 5.1 向量检索的盲区

纯向量检索在这些场景会翻车：

```python
# 盲区1：精确匹配（产品编号、错误码、人名）
query = "报错 ERR_CONNECTION_RESET 怎么解决"
# 向量检索可能返回各种"网络错误"文档，但ERR_CONNECTION_RESET这个精确串可能排不上

# 盲区2：罕见专有名词
query = "Zstandard 压缩算法"
# 低频词在向量空间中表达不佳

# 盲区3：否定语义
query = "不包含运费的价格"
# Embedding 对"不"这类否定词经常失灵

# 解药：BM25 关键词检索恰好互补
```

### 5.2 混合检索实现

```python
# 混合检索 = 向量检索（语义） + BM25（关键词） + RRF 融合
import rank_bm25

class HybridRetriever:
    def __init__(self, docs: list[str], embedder, vector_index):
        self.docs = docs
        self.embedder = embedder
        self.vector_index = vector_index
        # BM25 索引（中文需先分词）
        self.bm25 = rank_bm25.BM25Okapi([
            self.tokenize(d) for d in docs
        ])

    def tokenize(self, text: str) -> list[str]:
        # 生产建议用 jieba 或专业分词库
        import jieba
        return list(jieba.cut_for_search(text))

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        # 通道1：向量检索
        query_vec = self.embedder.encode([query])[0]
        vec_results = self.vector_index.search(query_vec, top_k=50)
        # 返回 [(doc_idx, cosine_score), ...]

        # 通道2：BM25 检索
        bm25_scores = self.bm25.get_scores(self.tokenize(query))
        bm25_results = sorted(
            enumerate(bm25_scores), key=lambda x: x[1], reverse=True
        )[:50]

        # 融合：Reciprocal Rank Fusion（RRF）
        return self.rrf_fuse(vec_results, bm25_results, top_k)

    def rrf_fuse(self, vec_results, bm25_results, top_k, k=60):
        """RRF：只看排名不看分数，天然免疫两通道分数量纲差异"""
        rrf_scores = {}
        for rank, (doc_idx, _) in enumerate(vec_results):
            rrf_scores[doc_idx] = rrf_scores.get(doc_idx, 0) + 1 / (k + rank + 1)
        for rank, (doc_idx, _) in enumerate(bm25_results):
            rrf_scores[doc_idx] = rrf_scores.get(doc_idx, 0) + 1 / (k + rank + 1)
        return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
```

## 六、指令感知 Embedding：给向量加上"目的"

新一代开源模型（BGE、GTE、NVIDIA NV-Embed）支持**指令前缀**——同一个文本，不同指令产生不同向量：

```python
# 同一篇文档，"用于检索"和"用于分类"的向量应该不同
# BGE 模型的用法：

# 查询侧：加检索指令前缀
query = "为这个句子生成表示以用于检索相关文章：如何退货"

# 文档侧：不加前缀（或加不同指令）
doc = "退货政策：7天无理由退货..."

# 为什么查询要加指令？
# 训练时模型学到：查询向量应靠近"能回答它的文档"向量
# 指令前缀让模型进入"检索模式"，显著提升召回质量（通常 +2~5 个百分点）
```

```python
# 不同任务的指令模板
INSTRUCTIONS = {
    "检索": "为这个句子生成表示以用于检索相关文章：",
    "聚类": "为这个句子生成表示以用于聚类：",
    "分类": "为这个句子生成表示以用于情感分类：",
    "重排": "为这个查询和文档对生成相关性表示：",
}
```

## 七、评估：如何科学衡量 Embedding 质量

### 7.1 信息检索标准指标

```python
def precision_at_k(retrieved: list, relevant: set, k: int) -> float:
    """前 K 个结果中相关的比例"""
    return len(set(retrieved[:k]) & relevant) / k

def recall_at_k(retrieved: list, relevant: set, k: int) -> float:
    """前 K 个结果覆盖了多少相关文档"""
    return len(set(retrieved[:k]) & relevant) / len(relevant)

def ndcg_at_k(retrieved: list, relevance_scores: dict, k: int) -> float:
    """考虑排名位置的增益（排得越前，贡献越大）"""
    import math
    dcg = sum(
        relevance_scores.get(doc, 0) / math.log2(i + 2)
        for i, doc in enumerate(retrieved[:k])
    )
    ideal = sorted(relevance_scores.values(), reverse=True)[:k]
    idcg = sum(rel / math.log2(i + 2) for i, rel in enumerate(ideal))
    return dcg / idcg if idcg > 0 else 0

# 示例：评估一次检索
retrieved = [101, 205, 300, 412, 508]        # 检索返回的文档 ID
relevant = {101, 412, 777}                    # 标注的相关文档
relevance_scores = {101: 3, 412: 2, 777: 3}   # 分级相关度

print(precision_at_k(retrieved, relevant, 5))  # 0.4（5个里2个相关）
print(recall_at_k(retrieved, relevant, 5))     # 0.67（3个相关找到2个）
print(ndcg_at_k(retrieved, relevance_scores, 5))  # 排名质量
```

### 7.2 MTEB：Embedding 模型的"高考"

选模型先看 [MTEB 榜单](https://huggingface.co/spaces/mteb/leaderboard)，它覆盖 56 个任务：

| 任务类型 | 说明 | 代表数据集 |
|---------|------|-----------|
| Retrieval | 检索（最重要） | MS MARCO, BEIR |
| STS | 语义文本相似度 | STSBenchmark |
| Reranking | 重排 | SCEval |
| Classification | 分类 | SST2, AmazonReviews |
| Clustering | 聚类 | ArxivClustering |
| PairClassification | 配对分类 | DuplicateQQ |

```python
// 选型经验法则：
// 1. 中文场景优先看 C-MTEB（中文榜）
// 2. 检索任务权重最高（那是你要用的场景）
// 3. 榜单分数差 < 1 个点时，选推理速度快的
// 4. 注意模型的 max_seq_len——长文档检索需要 8192+
```

### 7.3 构建自己的评估集

```python
# 生产环境必须用业务数据建评估集（榜单≠你的场景）
EVAL_DATASET = [
    {
        "query": "怎么开发票",
        "positive": ["开票流程：登录后进入订单页..."],      # 必须检索到
        "negative": ["发票税率说明：增值税..."],            # 容易误检的难负例
    },
    # 建议 100~500 条，覆盖高频/长尾/易混淆查询
]

def evaluate_model(model, dataset, k=5):
    recalls = []
    for item in dataset:
        query_vec = model.encode([item["query"]])[0]
        # ... 向量检索 top-k
        retrieved = search(query_vec, k)
        hit = any(doc in item["positive"] for doc in retrieved)
        recalls.append(1.0 if hit else 0.0)
    return sum(recalls) / len(recalls)  # Recall@5
```

## 八、生产级 Embedding 服务设计

### 8.1 批处理与缓存

```python
import hashlib
from typing import Optional
import asyncio

class EmbeddingService:
    """生产级 Embedding 服务：批处理 + 缓存 + 限流 + 降级"""

    def __init__(self, client, cache_ttl=86400):
        self.client = client
        self.cache = {}  # 生产用 Redis，key = hash(model + text)
        self.cache_ttl = cache_ttl
        self._batch_queue = []
        self._batch_lock = asyncio.Lock()

    def _cache_key(self, text: str) -> str:
        return hashlib.sha256(f"text-embedding-3-small:{text}".encode()).hexdigest()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # 1. 缓存命中
        results: list[Optional[list]] = []
        to_encode, to_encode_idx = [], []
        for i, text in enumerate(texts):
            key = self._cache_key(text)
            if key in self.cache:
                results.append(self.cache[key])
            else:
                results.append(None)
                to_encode.append(text)
                to_encode_idx.append(i)

        if not to_encode:
            return results  # type: ignore

        # 2. 分批调用（OpenAI 单批上限 2048 条 / 300K tokens）
        BATCH_SIZE = 100
        for batch_start in range(0, len(to_encode), BATCH_SIZE):
            batch = to_encode[batch_start:batch_start + BATCH_SIZE]
            response = await self.client.embeddings.create(
                model="text-embedding-3-small",
                input=batch
            )
            for j, item in enumerate(response.data):
                vec = item.embedding
                global_idx = to_encode_idx[batch_start + j]
                results[global_idx] = vec
                # 写缓存
                key = self._cache_key(batch[j])
                self.cache[key] = vec

        return results  # type: ignore
```

### 8.2 增量更新与版本管理

```python
# Embedding 模型的版本管理（最容易踩的坑！）

# ❌ 灾难：换模型后，新旧向量混在同一空间
# 旧向量：text-embedding-ada-002（1536维）
# 新向量：text-embedding-3-small（1536维）
# 维度相同但空间完全不同 → 检索结果全是噪声！

# ✅ 正确：模型版本与向量集合绑定
class VectorStoreVersioned:
    def __init__(self, db):
        self.db = db
        self.model_version = "text-embedding-3-small@2025-06"

    def collection_name(self) -> str:
        # 集合名包含模型版本
        safe = self.model_version.replace("@", "_").replace(".", "-")
        return f"docs_{safe}"

    async def migrate_model(self, new_version: str, docs: list[str]):
        """模型迁移：新集合全量重建 + 双写 + 原子切换"""
        old_collection = self.collection_name()
        self.model_version = new_version
        new_collection = self.collection_name()

        # 1. 全量重编码到新集合
        vecs = await self.embed_batch(docs)
        await self.db.upsert(new_collection, docs, vecs)

        # 2. 原子切换读流量（灰度验证后）
        # 3. 保留旧集合 N 天作为回滚兜底
```

### 8.3 常见坑清单

```
🚨 生产环境 Embedding 十大坑：

1. 新旧模型向量混用（空间不同，检索崩坏）
2. 查询向量忘记归一化（点积排序失效）
3. MRL 截断后忘记重新归一化
4. 输入超长被静默截断（超 max_seq_len 部分直接丢弃）
5. 前后空格/换行不一致导致缓存命中率低
6. 中文没分词就上 BM25（英文分词器按空格切，中文变一个长token）
7. 批量请求没做限流（429 限速被打爆）
8. 嵌入结果当绝对分数用（不同模型分数不可比，只看排序）
9. 文档分块太大（一个向量表达不了 2000 token 的多主题内容）
10. 忘记评估（换模型全凭感觉，没有 Recall@K 基线）
```

## 九、完整实战：语义搜索引擎

```python
"""
mini-semantic-search: 一个完整但精简的语义搜索实现
依赖：pip install numpy rank-bm25 jieba sentence-transformers
"""
import numpy as np
from sentence_transformers import SentenceTransformer
import rank_bm25
import jieba

class SemanticSearchEngine:
    def __init__(self, model_name="BAAI/bge-small-zh-v1.5"):
        self.model = SentenceTransformer(model_name)
        self.docs = []
        self.doc_vecs = None
        self.bm25 = None
        self.query_instruction = "为这个句子生成表示以用于检索相关文章："

    def index(self, docs: list[str]):
        """构建索引：向量化 + BM25"""
        self.docs = docs
        # 双通道索引
        doc_texts = [f"{self.query_instruction}{d}" for d in docs]
        self.doc_vecs = self.model.encode(
            doc_texts, normalize_embeddings=True, show_progress_bar=True
        )
        self.bm25 = rank_bm25.BM25Okapi([list(jieba.cut(d)) for d in docs])

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """混合检索 + RRF 融合"""
        # 向量通道
        q_vec = self.model.encode(
            [f"{self.query_instruction}{query}"], normalize_embeddings=True
        )[0]
        vec_scores = self.doc_vecs @ q_vec  # 已归一化，点积=余弦
        vec_ranking = np.argsort(-vec_scores)[:top_k * 4]

        # BM25 通道
        bm25_scores = self.bm25.get_scores(list(jieba.cut(query)))
        bm25_ranking = np.argsort(-bm25_scores)[:top_k * 4]

        # RRF 融合
        k, rrf = 60, {}
        for rank, idx in enumerate(vec_ranking):
            rrf[idx] = rrf.get(idx, 0) + 1 / (k + rank + 1)
        for rank, idx in enumerate(bm25_ranking):
            rrf[idx] = rrf.get(idx, 0) + 1 / (k + rank + 1)

        top = sorted(rrf.items(), key=lambda x: -x[1])[:top_k]
        return [
            {"doc": self.docs[i], "score": s,
             "vec_score": float(vec_scores[i]),
             "bm25_score": float(bm25_scores[i])}
            for i, s in top
        ]

# 使用
engine = SemanticSearchEngine()
engine.index([
    "退货政策：商品签收后7天内可无理由退货，定制商品除外。",
    "配送范围：全国大部分地区包邮，偏远地区需补运费。",
    "发票开具：支持电子发票，订单完成后可在个人中心申请。",
    "会员体系：银卡95折、金卡9折、钻石卡85折。",
])

for r in engine.search("买了东西想退", top_k=2):
    print(f"[{r['score']:.4f}] {r['doc']}")
# 退货政策排第一 ✅
```

## 十、总结

Embedding 是语义检索的数学基石，理解它就理解了 RAG、推荐系统、语义搜索的共同底层。

**核心知识地图：**

| 概念 | 一句话 |
|------|--------|
| Embedding | 把语义编码进稠密向量空间，相近含义→相近向量 |
| 余弦相似度 | 衡量方向而非长度，归一化后等价于点积 |
| 双编码器 | 查询/文档独立编码，可预计算，用于召回 |
| 交叉编码器 | 拼接编码，精度高但慢，用于重排 |
| MRL | 套娃向量，前 N 维可用，存储-精度可调 |
| 量化 | float32 → int8/二值，存储降 4~32 倍 |
| 混合检索 | 向量（语义）+ BM25（关键词）+ RRF 融合 |
| 指令前缀 | 告诉模型"向量用来干什么"，检索质量 +2~5pt |
| MTEB | 模型选型看榜单，生产必须有自建评估集 |

**三条工程铁律：**

1. **模型版本即集合边界**——不同模型的向量永远不混用，迁移必须全量重建
2. **归一化贯穿始终**——入库归一化、查询归一化、MRL 截断后重新归一化
3. **评估先行**——没有 Recall@K 基线，一切优化都是盲调

*本文由小虾子 🦐 撰写*
