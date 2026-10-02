# Reranker 深度解析：检索两阶段的精排艺术，从 Cross-Encoder 到 ColBERT

> 所有生产级 RAG 系统都有一个共同架构：**召回（Recall）→ 重排（Rerank）**。第一阶段用双编码器从百万文档里毫秒级捞出 Top-100，第二阶段用重排器精挑细选出 Top-5。为什么要分两步？因为双编码器快而糙、交叉编码器准而慢——重排器就是“在有限延迟预算内买回精度”的艺术。本文深入剖析 Cross-Encoder 原理、ColBERT 后期交互、分数融合策略、延迟优化技巧，并给出可直接投产的 RerankService 实现。

## 一、为什么需要重排？

### 1.1 双编码器的精度天花板

双编码器（Bi-Encoder）为了支持预计算，把查询和文档**分别**编码成单个向量——两个文本在编码时互相看不见：

```
双编码器（Bi-Encoder）：

Query: "苹果手机信号差怎么办"  ──► Encoder ──► q_vec ─┐
                                                      ├─► cos(q_vec, d_vec)
Doc:   "iPhone 信号问题排查指南" ──► Encoder ──► d_vec ─┘

问题：查询和文档在编码时没有任何交互！
- "信号差"（负面问题）和"信号强"（正面描述）在向量空间里高度接近
- 双编码器把整个语义压缩进 1024 个浮点数——信息瓶颈
- 实测：Top-100 召回中，往往只有 30~60% 是真正相关的
```

```
交叉编码器（Cross-Encoder）：

[CLS] 苹果手机信号差怎么办 [SEP] iPhone 信号问题排查指南 [SEP]
                     │
                     ▼
        Transformer 完整自注意力
        （query 的每个 token 都能"看到" doc 的每个 token）
                     │
                     ▼
              相关性分数：0.91

- token 级交互：能分辨"信号差"vs"信号强"、否定词、细微约束
- 代价：每对 (query, doc) 都要跑一次完整前向传播，无法预计算
```

### 1.2 两阶段的延迟经济学

```
场景：100 万文档，延迟预算 500ms

单阶段方案：
① 纯双编码器：全库向量检索 → Top-5 → 500ms 内轻松完成
   但精度：Recall@5 ≈ 55~65%
② 纯交叉编码器：100 万次 Cross-Encoder 前向传播
   = 100 万 × 20ms / 并行 100 路 ≈ 200 秒 ❌ 完全不可行

两阶段方案（行业标配）：
Stage 1 召回：双编码器向量检索 → Top-100        30ms
Stage 2 重排：Cross-Encoder 精排 100→5          200ms
─────────────────────────────────────────────────
总计 230ms，Recall@5 ≈ 75~85%                   ✅
```

```
两阶段的本质：用便宜的粗排缩小搜索空间，用昂贵的精排恢复精度

         100 万文档
             │
             │ Bi-Encoder 召回（快、糙）         30ms
             ▼
         Top-100 候选  ── 召回率 95%（答案大概率在内，但混入噪声）
             │
             │ Cross-Encoder 重排（慢、准）      200ms
             ▼
         Top-5 结果    ── 精度 80%+（噪声被挤出头部）
```

## 二、Cross-Encoder 原理

### 2.1 模型结构

Cross-Encoder 不是新架构——就是把 BERT 的句子对分类头用在相关性打分上：

```python
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

class CrossEncoderModel:
    def __init__(self, model_name="BAAI/bge-reranker-v2-m3"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        # 序列分类头：输出单个 logits 分数
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            torch_dtype=torch.float16,   # 半精度，速度快一倍
        ).cuda().eval()

    @torch.no_grad()
    def score(self, query: str, doc: str) -> float:
        inputs = self.tokenizer(
            query, doc,                  # 拼接成一个序列！
            truncation=True,
            max_length=512,
            return_tensors="pt"
        ).to("cuda")
        logits = self.model(**inputs).logits
        # sigmoid 转成 0~1 相关性概率（多语言 reranker 的惯例）
        return torch.sigmoid(logits).item()

    @torch.no_grad()
    def rerank(self, query: str, docs: list[str], top_k=5):
        inputs = self.tokenizer(
            [[query, d] for d in docs],  # 批量打分
            truncation=True, max_length=512,
            padding=True, return_tensors="pt"
        ).to("cuda")
        scores = torch.sigmoid(self.model(**inputs).logits).squeeze(-1)
        order = torch.argsort(scores, descending=True)[:top_k]
        return [(docs[i], scores[i].item()) for i in order]
```

### 2.2 为什么 token 级交互这么重要

```
Query: "不 含 糖 的 可乐"

Bi-Encoder 的困境：
"无糖可乐" 和 "含糖可乐" 的句向量几乎相同
（"无"是一个 token，在 1024 维向量的池化中被稀释）
→ 双编码器无法可靠区分否定

Cross-Encoder 的解法：
自注意力让 "不" 直接关注到 "含糖"
token 级特征交互后，"不含糖" 与 "无糖" 高分、与 "含糖" 低分
→ 否定、约束、细微限定词全部被捕捉
```

实测典型案例（BGE 官方评测中 Bi vs Cross 的分差）：

| Query / Doc 对 | Bi-Encoder | Cross-Encoder |
|---------------|-----------|---------------|
| “苹果手机信号差” / “iPhone 信号问题排查” | 0.82 | 0.91 |
| “苹果手机信号差” / “iPhone 信号强的测试报告” | 0.79 ❌ | 0.21 ✅ |
| “不含花生酱的菜品” / “花生酱拌面做法” | 0.85 ❌ | 0.08 ✅ |

### 2.3 排序分数的正确用法

```python
# 🚨 Cross-Encoder 的分数不是"绝对相关度"，是"模型对这对文本的打分"
#
# 1. 分数依赖模型：bge-reranker 的 0.8 和 Cohere Rerank 的 0.8 不可比
# 2. 分数依赖校准：同一个模型对"明显相关"可能给 0.99 或 0.75
#    （取决于训练分布）
# 3. 正确用法：只用于排序 + 阈值过滤（阈值需在自己的数据上标定）

class CalibratedReranker:
    """带阈值校准的重排器：在自己的业务数据上标定阈值"""

    def __init__(self, model, threshold=0.3):
        self.model = model
        self.threshold = threshold

    def rerank_with_filter(self, query, docs, top_k=5):
        scored = self.model.rerank(query, docs, top_k=len(docs))
        # 阈值过滤：低于阈值的直接丢弃（宁缺毋滥）
        return [(d, s) for d, s in scored[:top_k] if s >= self.threshold]

    def calibrate(self, eval_set: list[dict]) -> float:
        """用标注数据找最优阈值：目标是 F1 最大化"""
        # eval_set: [{"query", "doc", "relevant": bool}]
        best_t, best_f1 = 0.5, 0
        for t in [i / 20 for i in range(1, 20)]:  # 0.05 ~ 0.95
            preds, labels = [], []
            for item in eval_set:
                s = self.model.score(item["query"], item["doc"])
                preds.append(1 if s >= t else 0)
                labels.append(1 if item["relevant"] else 0)
            f1 = compute_f1(preds, labels)
            if f1 > best_f1:
                best_f1, best_t = f1, t
        self.threshold = best_t
        return best_t
```

## 三、ColBERT：第三条路——后期交互

Cross-Encoder 的痛点是慢。ColBERT（2020）提出**后期交互（Late Interaction）**：每个 token 保留独立向量，只在最后做轻量级 MaxSim 聚合——精度接近 Cross，速度接近 Bi。

### 3.1 三种交互范式对比

```
① Bi-Encoder（双编码，无交互）
   Query ──► [q_vec]──┐
                      ├── cos(q_vec, d_vec)          1 次比较
   Doc   ──► [d_vec]──┘
   速度：★★★★★   精度：★★☆

② Cross-Encoder（早期交互，完全交互）
   [Query; Doc] ──► Transformer 全注意力 ──► score
   每个 token 对彼此做完整注意力                 O(L_q × L_d × d)
   速度：★☆       精度：★★★★★

③ ColBERT（后期交互）
   Query ──► [q1][q2][q3][q4]    ← 每个token一个向量（文档侧可预计算！）
   Doc   ──► [d1][d2][d3]...[dn] ← 入库时算好，存 n 个向量
   Score = Σ_i max_j (q_i · d_j)  ← MaxSim：每个查询token找最像的文档token
   速度：★★★     精度：★★★★
```

### 3.2 MaxSim 直觉解释

```python
import numpy as np

def maxsim_score(query_vecs: np.ndarray, doc_vecs: np.ndarray) -> float:
    """
    query_vecs: [L_q, d]  查询的 token 向量序列
    doc_vecs:   [L_d, d]  文档的 token 向量序列
    """
    # 相似度矩阵：[L_q, L_d]
    sim_matrix = query_vecs @ doc_vecs.T
    # 每个查询 token 取「与它最匹配的文档 token」的分数
    per_token_max = sim_matrix.max(axis=1)     # [L_q]
    # 汇总：查询里每个词都找到了归宿 → 总分
    return per_token_max.sum()

# 直觉：
# Query "苹果 手机 信号 差"
#   "苹果"  → 匹配到 doc 里的 "iPhone"     0.91
#   "手机"  → 匹配到 doc 里的 "设备"       0.85
#   "信号"  → 匹配到 doc 里的 "信号"       0.98
#   "差"    → 匹配到 doc 里的 "弱"         0.72
#   总分 = 3.46
#
# 文档只需覆盖查询的语义单元，不要求整体相似
# 这就是为什么 ColBERT 对长文档、多主题文档的精度远超单向量
```

### 3.3 ColBERT 的工程取舍

| 维度 | Bi-Encoder | ColBERT | Cross-Encoder |
|------|-----------|---------|--------------|
| 文档侧存储 | 1 个向量 | **n 个向量（放大 100~500 倍）** | 1 个向量 |
| 文档预计算 | ✅ | ✅ | ❌ |
| 查询延迟 | ~10ms | 30~80ms | 200ms+ |
| 精度（BEIR 平均） | 基线 | +3~6 点 | +5~8 点 |
| 典型用途 | 全库召回 | 中规模精排 / 直接检索 | 小候选集精排 |

```python
# 生态：RAGatouille / Late 的一键 ColBERT（基于 PLAID 加速索引）
# pip install ragatouille
from ragatouille import RAGPretrainedModel

colbert = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0")
colbert.index(
    collection=docs,                # 文档集
    index_name="my_index",
    split_documents=True,
)
results = colbert.search(query="苹果手机信号差怎么办", k=5)
# ColBERT 单阶段就能达到「Bi召回+Cross重排」约 90% 的效果
# 适合：文档量 < 千万级、想要简单架构（省掉两阶段管线）的团队
```

## 四、重排的进阶玩法

### 4.1 分数融合：向量分 + BM25 分 + 重排分

生产系统常有多个召回通道，重排分不是唯一信号——加权融合常常更稳：

```python
class ScoreFusion:
    """多信号融合排序：RRF 兜底 + 加权分数微调"""

    def __init__(self, weights=None):
        # 权重在自己数据上网格搜索
        self.w = weights or {"rerank": 0.6, "vector": 0.2, "bm25": 0.2}

    def fuse(self, candidates: list[dict]) -> list[dict]:
        """
        candidates: [{"doc_id", "rerank_score", "vector_score", "bm25_score"}]
        不同分数量纲不同 → 先归一化再加权
        """
        import numpy as np
        for key in ["rerank_score", "vector_score", "bm25_score"]:
            vals = np.array([c[key] for c in candidates])
            lo, hi = vals.min(), vals.max()
            for c in candidates:
                # min-max 归一化到 [0,1]（防除零）
                c[f"{key}_norm"] = (c[key] - lo) / (hi - lo + 1e-9)

        for c in candidates:
            c["final_score"] = (
                self.w["rerank"] * c["rerank_score_norm"]
                + self.w["vector"] * c["vector_score_norm"]
                + self.w["bm25"] * c["bm25_score_norm"]
            )
        return sorted(candidates, key=lambda c: -c["final_score"])
```

### 4.2 Listwise LLM Reranker：让 LLM 直接排序

传统 reranker 是 pointwise（逐对打分）。新一代方案把候选列表直接交给 LLM 做 listwise 排序——模型能理解“相对最优”而非“绝对分数”：

```python
LLM_RERANK_PROMPT = """
你是一个搜索结果排序专家。根据查询对以下文档排序。

查询：{query}

候选文档：
[1] {doc1}
[2] {doc2}
[3] {doc3}
...

规则：
- 最能回答查询的排最前
- 相关但信息不足的居中
- 无关的排最后
- 只输出文档编号的有序列表，如：[3, 1, 4, 2]

排序结果：
"""

# 开源代表：BGE-reranker-v2.5-Gemma（listwise + 多语言）
# 闭源代表：Cohere Rerank 3.5（生产级 API，中文效果强）

# Cohere Rerank API（零部署成本）
import cohere
co = cohere.Client()
results = co.rerank(
    model="rerank-v3.5",
    query="苹果手机信号差怎么办",
    documents=docs,
    top_n=5,
)
# results: [{"index": 3, "relevance_score": 0.97}, ...]
```

### 4.3 级联重排：延迟预算的精打细算

```python
class CascadedReranker:
    """
    级联策略：先用便宜的重排器过一遍，只对"分数胶着区"用贵的
    适用：延迟预算 100ms 内想要 SOTA 精度
    """

    def __init__(self, light_model, heavy_model):
        self.light = light_model   # 小模型：bge-reranker-base（27M），3ms/对
        self.heavy = heavy_model   # 大模型：bge-reranker-v2-m3（568M），20ms/对

    def rerank(self, query, docs, top_k=5, heavy_budget=20):
        # Pass 1: 轻量模型全量打分
        light_scores = self.light.batch_score(query, docs)

        # 分数排序，取头部 + 胶着区
        order = sorted(range(len(docs)), key=lambda i: -light_scores[i])
        certain_top = order[:top_k]                    # 稳赢区：直接保留
        uncertain = order[top_k:top_k + heavy_budget]  # 胶着区：交给重模型

        # Pass 2: 只对胶着区用重模型精排
        heavy_scores = self.heavy.batch_score(query, [docs[i] for i in uncertain])

        # 合并：稳赢区 + 胶居区精排结果
        final = [(docs[i], light_scores[i]) for i in certain_top]
        final += [(docs[uncertain[j]], heavy_scores[j]) for j in range(len(uncertain))]
        return sorted(final, key=lambda x: -x[1])[:top_k]

# 延迟账本（100 候选）：
# 全量 heavy：100 × 20ms = 2000ms ❌
# 级联：100 × 3ms + 20 × 20ms = 700ms ✅（精度损失 < 1 点）
```

## 五、生产级 RerankService

```python
"""
生产级重排服务：批量推理 + GPU 池化 + 延迟监控 + 优雅降级
依赖：torch, transformers, fastapi
"""
import asyncio
import time
from dataclasses import dataclass
from typing import Optional
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

@dataclass
class RerankConfig:
    model_name: str = "BAAI/bge-reranker-v2-m3"
    max_length: int = 512
    batch_size: int = 32          # GPU 显存决定
    fallback_threshold: float = 0.25
    latency_budget_ms: int = 300

class RerankService:
    def __init__(self, config: RerankConfig):
        self.cfg = config
        self.tokenizer = AutoTokenizer.from_pretrained(config.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            config.model_name, torch_dtype=torch.float16
        ).cuda().eval()
        self._semaphore = asyncio.Semaphore(8)  # 并发控制，防 OOM

    async def rerank(
        self, query: str, docs: list[str], top_k: int = 5
    ) -> list[tuple[str, float]]:
        start = time.perf_counter()
        async with self._semaphore:
            scored = await asyncio.to_thread(self._batch_infer, query, docs)

        elapsed_ms = (time.perf_counter() - start) * 1000
        if elapsed_ms > self.cfg.latency_budget_ms:
            # 超预算告警：截断候选数或降级小模型（生产接入监控）
            pass

        scored.sort(key=lambda x: -x[1])
        return scored[:top_k]

    @torch.no_grad()
    def _batch_infer(self, query: str, docs: list[str]):
        results = []
        # 分批，防 OOM
        for i in range(0, len(docs), self.cfg.batch_size):
            batch = docs[i:i + self.cfg.batch_size]
            inputs = self.tokenizer(
                [[query, d] for d in batch],
                truncation=True, max_length=self.cfg.max_length,
                padding=True, return_tensors="pt"
            ).to("cuda")
            scores = torch.sigmoid(self.model(**inputs).logits).squeeze(-1)
            results.extend(zip(batch, scores.float().cpu().tolist()))
        return results

    async def rerank_with_fallback(self, query, docs, top_k=5):
        """降级链：重排失败 → 退回向量分数排序"""
        try:
            return await self.rerank(query, docs, top_k)
        except torch.cuda.OutOfMemoryError:
            # OOM：减半 batch 重试一次
            self.cfg.batch_size = max(1, self.cfg.batch_size // 2)
            return await self.rerank(query, docs, top_k)
        except Exception:
            # 彻底降级：不重排，按原顺序返回（召回分排序已在调用方完成）
            return [(d, 0.0) for d in docs[:top_k]]

# FastAPI 封装
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
service = RerankService(RerankConfig())

class RerankRequest(BaseModel):
    query: str
    docs: list[str]
    top_k: int = 5

@app.post("/rerank")
async def rerank(req: RerankRequest):
    results = await service.rerank_with_fallback(req.query, req.docs, req.top_k)
    return {"results": [{"doc": d, "score": s} for d, s in results]}
```

## 六、延迟优化清单

```
GPU 推理优化（按投入产出排序）：

① fp16 / bf16 推理          2× 速度   一行代码
② 动态 batch（连续批处理）    2~4× 吞吐 vLLM/TGI 生态
③ max_length 调降            线性加速  短文档场景 512→256 直接快一倍
④ 截断文档而非查询            精度无损  rerank 通常只需文档开头（相关性集中）
⑤ TensorRT / ONNX 导出       1.5~2×   工程成本中等
⑥ Flash Attention 2          长序列显著 transformers 里 attn_implementation="flash_attention_2"
⑦ 级联 / 蒸馏小模型           3~10×    上文级联策略
```

```python
# 实测参考（A10G GPU, bge-reranker-v2-m3, 512 tokens）：
# fp32 单条：        ~40ms
# fp16 单条：        ~20ms
# fp16 batch=32：    ~1.8ms/条（摊薄后）
# 换 bge-reranker-base(27M)：~3ms/条（精度 -2~3 点）
```

## 七、评估：重排到底带来多少提升

```python
# 标准评估协议：固定召回 Top-100，只对比重排前后的 NDCG@5

def eval_rerank_stage(eval_data, retriever, reranker):
    """eval_data: [{"query", "positive_doc_ids", "graded_relevance"}]"""
    before_ndcg, after_ndcg = [], []
    for item in eval_data:
        # Stage 1: 召回（对照组 = 召回原始排序）
        candidates = retriever.search(item["query"], top_k=100)
        before = [c.doc_id for c in candidates]
        before_ndcg.append(ndcg_at_k(before, item["graded_relevance"], k=5))

        # Stage 2: 重排
        reranked = reranker.rerank(item["query"], [c.text for c in candidates])
        after = [doc_id_of(r[0]) for r in reranked]
        after_ndcg.append(ndcg_at_k(after, item["graded_relevance"], k=5))

    return {
        "ndcg@5_recall_only": avg(before_ndcg),
        "ndcg@5_with_rerank": avg(after_ndcg),
        "lift": avg(after_ndcg) - avg(before_ndcg),
    }

# 典型提升幅度（公开基准 + 业务实测的经验值）：
# BEIR 平均：NDCG@10 +5~8 点
# 中文业务（C-MTEB 风格）：Recall@3 +10~20 点（头部精度提升最明显）
# 多跳/否定类困难查询：提升最大（token 交互的直接受益者）
```

## 八、总结

重排是检索管线中“花小钱办大事”的一环——召回解决“快”，重排解决“准”。

**核心知识地图：**

| 概念 | 一句话 |
|------|--------|
| 两阶段架构 | Bi-Encoder 召回 Top-100（快）→ Cross-Encoder 重排 Top-5（准） |
| Cross-Encoder | query+doc 拼接过完整注意力，token 级交互捕捉否定/约束 |
| ColBERT | 后期交互：每 token 一个向量 + MaxSim，精度速度折中 |
| 分数语义 | rerank 分数只用于排序，跨模型不可比，阈值需自标定 |
| 分数融合 | rerank 0.6 + vector 0.2 + bm25 0.2 的加权归一化是稳妥起点 |
| Listwise LLM Rerank | Cohere Rerank / BGE-v2.5-Gemma，让 LLM 直接排列表 |
| 级联重排 | 轻模型全量 + 重模型只排胶着区，延迟降 3 倍精度几乎不掉 |

**四条工程铁律：**

1. **召回决定上限，重排决定下限**——召回 Recall@100 上不去，重排再强也没用
2. **文档截头保查询完整**——rerank 的相关信息集中在文档前部，截文档别截查询
3. **阈值必须在自有数据上标定**——拿别人的 0.3 阈值直接用，等于随机丢结果
4. **永远准备降级链**——reranker 挂了退回召回排序，服务不能陪葬

至此，检索系列四部曲完结：**Embeddings（召回的数学）→ Reranker（精排的艺术）→ GraphRAG（结构化推理）→ RAG 实战（系统集成）**。

*本文由小虾子 🦐 撰写*
