---
title: LlamaIndex 深度解析：RAG 数据编排的工程正道
date: 2026-08-04
---

# LlamaIndex 深度解析：RAG 数据编排的工程正道

> LangChain 是通用 AI 应用框架，LlamaIndex 则是专注 RAG 的数据编排引擎——如果你只需要 RAG（检索增强生成），LlamaIndex 比 LangChain 更专注、更简洁、更可控。本文系统覆盖 LlamaIndex 核心概念（Index / Query Engine / Node / Retriever）、高级索引策略（Recursive / Knowledge Graph / SQL）、评估体系（RAGAS / G-eval）、与 LangChain 的融合方案，是你构建生产级 RAG 系统的完整指南。

本文由小虾子 🦐 撰写

## LlamaIndex vs LangChain

```
两个框架的定位差异：
─────────────────────────────────────────────────────
LangChain          LlamaIndex
─────────────────────────────────────────────────────
通用 AI 应用框架     专注 RAG 的数据编排框架
Chain（线性链）     Index（索引）+ Query（查询）
Agent 生态丰富       数据加载/解析/索引更强大
API 灵活但复杂       API 简洁但专注
适合：多工具 Agent  适合：知识库问答 / RAG
─────────────────────────────────────────────────────

核心概念对比：
LangChain: PromptTemplate + LLM + Memory + Tool → Chain
LlamaIndex: Document → Node → Index → QueryEngine → Response

两者可以混用：
LangChain 的 Chain + LlamaIndex 的 Index = 最强组合
─────────────────────────────────────────────────────
```

---

## 快速上手

### 安装与第一个 RAG

```bash
pip install llama-index llama-index-openai
```

```python
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.llm.openai import OpenAI

# ===== 1. 加载文档 =====
documents = SimpleDirectoryReader("./docs").load_data()
print(f"加载了 {len(documents)} 个文档")

# ===== 2. 构建索引 =====
# 底层：切分 → Embedding → 存入向量库
index = VectorStoreIndex.from_documents(documents)

# ===== 3. 查询 =====
query_engine = index.as_query_engine(llm=OpenAI(model="gpt-4o-mini"))

response = query_engine.query("文档的主要内容是什么？")
print(response)
# 文档主要讲述了...
print(f"来源节点: {[n.metadata for n in response.source_nodes]}")
```

### 完整 RAG 流水线

```python
from llama_index.core import (
    Document,
    SummaryIndex,
    VectorStoreIndex,
)
from llama_index.core.node_parser import (
    SentenceSplitter,
    TokenTextSplitter,
    SemanticSplitterNodeParser,
)
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import (
    SimilarityPostprocessor,
    KeywordNodePostprocessor,
)
from llama_index.embeddings.openai import OpenAIEmbedding

# ===== 完整流水线 =====
class RAGPipeline:
    def __init__(self, model_name="gpt-4o-mini", embed_model="text-embedding-3-small"):
        self.llm = OpenAI(model=model_name)
        self.embed_model = OpenAIEmbedding(model=embed_model)

    def build_index(self, documents, index_type="vector"):
        """构建索引"""

        # 文档切分
        node_parser = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=64,
        )
        nodes = node_parser.get_nodes_from_documents(documents)

        # 选择索引类型
        if index_type == "vector":
            index = VectorStoreIndex.from_documents(
                documents,
                embed_model=self.embed_model,
                node_parser=node_parser,
            )
        elif index_type == "summary":
            index = SummaryIndex.from_documents(
                documents,
                embed_model=self.embed_model,
            )
        else:
            raise ValueError(f"Unknown index type: {index_type}")

        return index

    def build_query_engine(
        self,
        index,
        similarity_top_k=5,
        rerank_top_n=2,
        mode="default",
    ):
        """构建查询引擎"""

        # 检索器
        retriever = VectorIndexRetriever(
            index=index,
            similarity_top_k=similarity_top_k,
        )

        # 后处理器（过滤 + 重排序）
        postprocessors = [
            SimilarityPostprocessor(similarity_cutoff=0.7),
        ]

        # 如果有 rerank 模型
        if rerank_top_n:
            from llama_index.core.postprocessor import SentenceTransformerRerank
            postprocessors.append(
                SentenceTransformerRerank(
                    model="cross-encoder/ms-marco-MiniLM-L-12-v2",
                    top_n=rerank_top_n,
                )
            )

        # 查询引擎
        query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            node_postprocessors=postprocessors,
            llm=self.llm,
        )

        return query_engine

    def query(self, index, question):
        """查询"""
        query_engine = self.build_query_engine(index)
        response = query_engine.query(question)
        return response


# 使用
pipeline = RAGPipeline()
index = pipeline.build_index(documents)
response = pipeline.query(index, "Python GIL 是什么？")
print(response)
```

---

## 数据加载

### 多种数据源

```python
from llama_index.core import SimpleDirectoryReader

# ===== 1. 目录加载 =====
loader = SimpleDirectoryReader(
    input_dir="./docs",
    recursive=True,           # 递归子目录
    required_exts=[".pdf", ".md", ".txt"],  # 只加载特定类型
    exclude=["*.tmp"],        # 排除某些文件
)
documents = loader.load_data()

# ===== 2. PDF 加载 =====
from llama_index.readers.file import PDFReader

loader = PDFReader()
documents = loader.load_data(file_path="./paper.pdf")

# ===== 3. 网页加载 =====
from llama_index.readers.web import SimpleWebPageReader

loader = SimpleWebPageReader()
documents = loader.load_data(urls=["https://example.com/article"])

# ===== 4. Notion 加载 =====
from llama_index.readers.notion import NotionPageReader

loader = NotionPageReader(api_key="notion-api-key")
documents = loader.load_data(page_ids=["page_id_1", "page_id_2"])

# ===== 5. Slack 加载 =====
from llama_index.readers.slack import SlackReader

loader = SlackReader(slack_token="xoxb-...")
documents = loader.load_data(
    channel_ids=["C01234", "C05678"],
    older_than_timestamp="2024-01-01T00:00:00Z",
)

# ===== 6. 数据库加载 =====
from llama_index.readers.database import SQLReader

reader = SQLReader(
    sql_engine="postgresql://user:pass@localhost/db",
    sql_query="SELECT title, content FROM articles",
)
documents = reader.load_data()

# ===== 7. 组合加载 =====
from llama_index.core import load_index_from_storage

# 从多个源构建组合索引
docs1 = SimpleDirectoryReader("./docs").load_data()
docs2 = PDFReader().load_data(file_path="./paper.pdf")

all_docs = docs1 + docs2
index = VectorStoreIndex.from_documents(all_docs)
```

### 自定义 Document

```python
from llama_index.core import Document

# ===== 自定义文档（带元数据）=====
class CustomDocument(Document):
    def __init__(self, text, metadata=None):
        super().__init__(text=text, metadata=metadata or {})

doc = CustomDocument(
    text="Python 的 GIL 是全局解释器锁...",
    metadata={
        "source": "python.md",
        "category": "language",
        "author": "小虾子",
        "date": "2024-01-01",
        "tags": ["python", "concurrency", "interpreter"],
    }
)

# ===== 批量处理 =====
import json

with open("knowledge_base.json") as f:
    data = json.load(f)

documents = [
    Document(
        text=item["content"],
        metadata={
            "id": item["id"],
            "title": item["title"],
            "category": item.get("category", "general"),
            **item.get("extra", {}),
        }
    )
    for item in data
]
```

---

## 文档切分策略

### 基础切分器

```python
from llama_index.core.node_parser import (
    SentenceSplitter,
    TokenTextSplitter,
)

# ===== 按句子切分（简单，推荐起步）=====
splitter = SentenceSplitter(
    chunk_size=512,        # 最大字符数
    chunk_overlap=64,      # 重叠字符数（保持上下文连贯）
    separator="\n",
)
nodes = splitter.get_nodes_from_documents(documents)

# ===== 按 Token 切分（更精确）=====
splitter = TokenTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    tokenizer_name="gpt2",  # 或 "cl100k_base"（ChatGPT tokenizer）
)
nodes = splitter.get_nodes_from_documents(documents)
```

### 语义切分（高级）

```python
from llama_index.core.node_parser import (
    SemanticSplitterNodeParser,
)
from llama_index.embeddings.openai import OpenAIEmbedding

# ===== 语义切分：按语义相似度自动决定切分点 =====
splitter = SemanticSplitterNodeParser(
    buffer_size=1,              # 对比窗口大小
    breakpoint_percent_threshold=95,  # 相似度低于此值则切分
    embed_model=OpenAIEmbedding(model="text-embedding-3-small"),
    tokenizer="cl100k_base",
)

nodes = splitter.get_nodes_from_documents(documents)
# 自动在语义断点处切分，比固定长度更合理

# ===== 代码专用切分 =====
from llama_index.core.node_parser import CodeSplitter

splitter = CodeSplitter(
    language="python",
    chunk_lines=40,       # 每块 40 行
    overlap_lines=5,      # 重叠 5 行
    max_chars=1500,       # 最大字符数
)
nodes = splitter.get_nodes_from_documents(code_docs)
```

### 层级切分

```python
# ===== 层级切分：同时生成小 chunk 和大 chunk =====
from llama_index.core.node_parser import HierarchicalNodeParser

parser = HierarchicalNodeParser(
    nodeParsers=[
        TokenTextSplitter(chunk_size=1024, chunk_overlap=100),   # 大块
        TokenTextSplitter(chunk_size=256, chunk_overlap=50),     # 中块
        TokenTextSplitter(chunk_size=64, chunk_overlap=20),      # 小块
    ]
)

nodes = parser.get_nodes_from_documents(documents)
# 自动建立层级关系：小 chunk → 中 chunk → 大 chunk
# 查询时可以灵活选择检索粒度
```

---

## 索引类型

### 1. Vector Store Index（向量索引）

```python
from llama_index.core import VectorStoreIndex

# ===== 最常用的索引类型 =====
index = VectorStoreIndex.from_documents(
    documents,
    embed_model=OpenAIEmbedding(model="text-embedding-3-small"),
)

# ===== 指定向量库（默认 Chroma）=====
from llama_index.vector_stores.faiss import FAISSVectorStore
import faiss

# 使用 FAISS 作为向量库
faiss_index = faiss.IndexFlatL2(1536)
vector_store = FAISSVectorStore(faiss_index=faiss_index)
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store,
)

# ===== 指定向量库（Qdrant）=====
from llama_index.vector_stores.qdrant import QdrantVectorStore

vector_store = QdrantVectorStore(
    collection_name="my_collection",
    client=QdrantClient("localhost", port=6333),
)
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store,
)
```

### 2. Summary Index（摘要索引）

```python
from llama_index.core import SummaryIndex

# ===== 适合：需要全文检索的场景 =====
# 每个文档作为一个节点，不切分
index = SummaryIndex.from_documents(documents)

# ===== 查询时使用 Refine 模式 ======
query_engine = index.as_query_engine(
    response_mode="refine",  # 逐节点优化答案
)
```

### 3. Knowledge Graph Index（知识图谱索引）

```python
from llama_index.core import KnowledgeGraphIndex
from llama_index.llm.openai import OpenAI

# ===== 知识图谱索引：将实体关系存入图数据库 ======
index = KnowledgeGraphIndex.from_documents(
    documents,
    kg_triple_extraction_template="""\
从以下文本中提取知识图谱三元组。
格式：(实体1, 关系, 实体2)

文本：{text}

三元组：""",
    max_triplets_per_chunk=10,
    storage_context=storage_context,
)

# ===== 查询知识图谱 =====
query_engine = index.as_query_engine(
    include_text=True,
    response_mode="tree_summarize",
)

response = query_engine.query("Python 和 GIL 是什么关系？")
# 答案来自图结构的关系推理，不只是向量相似度

# ===== 优势 =====
"""
✅ 关系推理：支持"谁的主管是谁"这类关系查询
✅ 可解释性强：答案来自实体关系路径
✅ 补充向量检索：知识图谱 + 向量 = 更全面
❌ 抽取三元组有错误率
❌ 图数据库（Neo4j/RediGraph）需要额外部署
"""
```

### 4. SQL Index（结构化查询索引）

```python
from llama_index.core import SQLStructGPTIndex

# ===== 在 SQL 数据库上构建自然语言查询接口 =====
index = SQLStructGPTIndex.from_schema(
    schema=sql_database.get_schema(),
    llm=OpenAI(model="gpt-4o"),
)

# 自然语言查询 SQL 数据库
query_engine = index.as_query_engine(sQL_database=sql_database)

response = query_engine.query("2024 年销售额最高的产品是什么？")
# 自动生成 SQL: SELECT product, SUM(amount) FROM sales WHERE year=2024 GROUP BY product ORDER BY SUM(amount) DESC LIMIT 1
```

### 5. Composed Index（组合索引）

```python
# ===== 组合多个索引 =====
from llama_index.core import ComposableGraph

# 为不同类别文档构建不同索引
category_indices = {}
for category in ["python", "go", "javascript"]:
    docs = [d for d in documents if d.metadata["category"] == category]
    category_indices[category] = VectorStoreIndex.from_documents(docs)

# 构建组合图
graph = ComposableGraph.from_indices(
    CompositeIndex,
    category_indices,
    index_summaries=[f"{cat} 相关文档" for cat in category_indices.keys()],
)

# ===== 查询时自动路由到对应子索引 ======
query_engine = graph.as_query_engine(
    recursive=True,  # 自动查询相关子索引
)
```

---

## 检索策略

### 基础检索

```python
from llama_index.core.retrievers import VectorIndexRetriever

# ===== 向量检索 =====
retriever = VectorIndexRetriever(
    index=vector_index,
    similarity_top_k=5,        # 召回 Top-K
    vector_store_query_mode="default",  # 或 "sparse"（只用关键词）
)

# ===== 关键词检索 =====
from llama_index.core.retrievers import KeywordTableRetriever

retriever = KeywordTableRetriever(
    index=summary_index,
    keyword_top_k=5,
)
```

### 高级检索

```python
# ===== 1. 混合检索（向量 + 关键词）=====
from llama_index.core.retrievers import QueryFusionRetriever

retriever = QueryFusionRetriever(
    retrievers=[
        VectorIndexRetriever(index=index),
        KeywordTableRetriever(index=summary_index),
    ],
    mode="reciprocal_ranked",  # RRFT 融合
    similarity_top_k=5,
)

# ===== 2. 多查询检索（生成多个相关查询）=====
from llama_index.core.retrievers import QueryFusionRetriever

retriever = QueryFusionRetriever(
    retrievers=[vector_retriever],
    mode="query_gen_plus",     # 自动生成多个查询
    query_gen_prompt="针对以下问题，生成 3 个相关的不同角度的查询...",
    similarity_top_k=5,
)

# ===== 3. 重排序（检索后用模型重排序）=====
from llama_index.core.postprocessor import SentenceTransformerRerank

postprocessor = SentenceTransformerRerank(
    model="cross-encoder/ms-marco-MiniLM-L-12-v2",
    top_n=3,                   # 重排后保留 Top-3
)

# ===== 4. 元数据过滤 + 检索 =====
from llama_index.core.vector_stores import MetadataFilter, Filters

retriever = VectorIndexRetriever(
    index=index,
    similarity_top_k=10,
    filters=Filters(
        filters=[
            MetadataFilter(key="category", operator="==", value="python"),
            MetadataFilter(key="date", operator=">=", value="2024-01-01"),
        ],
        condition="and",
    ),
)
```

### 自定义 Retriever

```python
# ===== 自定义混合检索器 =====
from llama_index.core import QueryBundle
from llama_index.core.retrievers import BaseRetriever

class HybridRetriever(BaseRetriever):
    def __init__(self, vector_retriever, keyword_retriever, alpha=0.5):
        self.vector_retriever = vector_retriever
        self.keyword_retriever = keyword_retriever
        self.alpha = alpha  # 权重：alpha=1.0 纯向量，alpha=0.0 纯关键词

    def _retrieve(self, query_bundle: QueryBundle, **kwargs):
        # 并行执行两种检索
        vector_nodes = self.vector_retriever.retrieve(query_bundle)
        keyword_nodes = self.keyword_retriever.retrieve(query_bundle)

        # 分数归一化 + 加权融合
        scored_nodes = {}

        for node in vector_nodes:
            scored_nodes[node.node.node_id] = {
                "node": node.node,
                "score": node.score * self.alpha,
            }

        for node in keyword_nodes:
            if node.node.node_id in scored_nodes:
                scored_nodes[node.node.node_id]["score"] += node.score * (1 - self.alpha)
            else:
                scored_nodes[node.node.node_id] = {
                    "node": node.node,
                    "score": node.score * (1 - self.alpha),
                }

        # 排序返回
        sorted_nodes = sorted(scored_nodes.values(), key=lambda x: x["score"], reverse=True)
        return [NodeWithScore(node=n["node"], score=n["score"]) for n in sorted_nodes[:10]]

retriever = HybridRetriever(vector_retriever, keyword_retriever, alpha=0.7)
```

---

## Query Engine

### 查询模式

```python
# ===== 6 种查询模式 =====
query_engine = index.as_query_engine(response_mode="...")

# 1. refine（默认）：逐节点优化答案
#    慢，但质量高，适合长回答
query_engine = index.as_query_engine(response_mode="refine")

# 2. compact：合并所有节点一次生成
#    快，适合简单问题
query_engine = index.as_query_engine(response_mode="compact")

# 3. simple_summarize：直接汇总
#    最快，适合"总结一下"类问题
query_engine = index.as_query_engine(response_mode="simple_summarize")

# 4. tree_summarize：层次化汇总
#    质量最高，适合复杂文档
query_engine = index.as_query_engine(response_mode="tree_summarize")

# 5. accumulation：累积答案
#    适合"列举 X 个"类问题
query_engine = index.as_query_engine(response_mode="accumulate")

# 6. generation_only：只生成，不检索
#    适合无知识库的直接生成
query_engine = index.as_query_engine(response_mode="generation_only")
```

### QueryPipeline（流水线编排）

```python
from llama_index.core.query_engine import QueryPipeline

# ===== 流水线：检索 → 重排序 → 生成 =====
pipeline = QueryPipeline(verbose=True)

pipeline.add_modules({
    "retriever": vector_retriever,
    "reranker": reranker,
    "prompt": custom_prompt,
    "llm": llm,
})

# 连接节点
pipeline.add_link("retriever", "reranker")
pipeline.add_link("reranker", "prompt", dest_key="context_str")
pipeline.add_link("prompt", "llm")

# 查询
response = pipeline.run(query="Python GIL 是什么？")
print(response)
```

---

## 评估体系

### RAGAS 集成

```python
# ===== RAGAS 评估（见上一篇文章详细说明）=====
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

# 准备评估数据
eval_data = [
    {
        "user_input": "Python GIL 是什么？",
        "retrieved_contexts": ["Python GIL 是全局解释器锁..."],
        "response": "GIL 是...",
        "reference": "GIL（Global Interpreter Lock）是...",
    }
]

dataset = Dataset.from_list(eval_data)

# 评估
result = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_precision])
print(result)
```

### LlamaIndex 原生评估

```python
# ===== G-eval（LLM 评估）=====
from llama_index.core.evaluation import (
    CorrectnessEvaluator,
    FaithfulnessEvaluator,
    RelevancyEvaluator,
)

evaluator = FaithfulnessEvaluator(llm=OpenAI(model="gpt-4o"))

# 评估单个响应
eval_result = evaluator.evaluate(
    query="Python GIL 是什么？",
    response="GIL 是 Python 的全局解释器锁...",
    contexts=["Python GIL 是全局解释器锁..."],
)

print(f"忠实度得分: {eval_result.score}")  # 0-1
print(f"反馈: {eval_result.feedback}")

# ===== 批量评估 =====
from tqdm import tqdm

def evaluate_dataset(dataset, query_engine):
    results = []
    for item in tqdm(dataset):
        response = query_engine.query(item["question"])

        eval_result = evaluator.evaluate(
            query=item["question"],
            response=str(response),
            contexts=[n.text for n in response.source_nodes],
        )

        results.append({
            "question": item["question"],
            "response": str(response),
            "faithfulness": eval_result.score,
        })

    return results

results = evaluate_dataset(eval_dataset, query_engine)
```

---

## 与 LangChain 融合

```python
# ===== LangChain Chain + LlamaIndex Index =====
from langchain_openai import ChatOpenAI
from llama_index.core import VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine

# LlamaIndex 构建索引
llamaindex_index = VectorStoreIndex.from_documents(documents)
retriever = llamaindex_index.as_retriever()

# LangChain 构建 Chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "基于以下上下文回答问题。\n\n上下文：\n{context}"),
    ("user", "{question}"),
])

chain = prompt | ChatOpenAI(model="gpt-4o-mini") | StrOutputParser()

# 自定义 LangChain Retriever（桥接 LlamaIndex）=====
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document

class LlamaIndexRetriever(BaseRetriever):
    def __init__(self, llamaindex_retriever):
        self.retriever = llamaindex_retriever

    def _get_relevant_documents(self, query: str) -> list[Document]:
        nodes = self.retriever.retrieve(query)
        return [
            Document(page_content=n.text, metadata=n.metadata)
            for n in nodes
        ]

# 使用 LangChain 的 LCEL
langchain_retriever = LlamaIndexRetriever(llamaindex_index.as_retriever())

chain = (
    {"context": langchain_retriever, "question": RunnablePassthrough()}
    | prompt
    | ChatOpenAI(model="gpt-4o-mini")
    | StrOutputParser()
)

result = chain.invoke("Python GIL 是什么？")
```

---

## 实战：生产级 RAG 系统

### 完整架构

```python
# ===== 生产级 RAG 系统 =====
import os
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    StorageContext,
    load_index_from_storage,
)
from llama_index.core.node_parser import (
    SemanticSplitterNodeParser,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.postprocessor import (
    SimilarityPostprocessor,
    SentenceTransformerRerank,
)

class ProductionRAG:
    def __init__(self):
        self.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
        self.llm = OpenAI(model="gpt-4o-mini", temperature=0.3)
        self.vector_store = None
        self.index = None

    def build_index(self, docs_path: str, persist_dir: str = "./storage"):
        """构建并持久化索引"""
        # 加载文档
        documents = SimpleDirectoryReader(docs_path).load_data()

        # 语义切分
        node_parser = SemanticSplitterNodeParser(
            embed_model=self.embed_model,
            buffer_size=1,
            breakpoint_percent_threshold=95,
        )

        # 使用 Qdrant 作为向量库
        self.vector_store = QdrantVectorStore(
            collection_name="production_rag",
            client=QdrantClient("localhost", port=6333),
            enable_compression=True,
        )

        # 构建索引
        self.index = VectorStoreIndex.from_documents(
            documents,
            vector_store=self.vector_store,
            node_parser=node_parser,
            embed_model=self.embed_model,
        )

        # 持久化
        self.index.storage_context.persist(persist_dir=persist_dir)

    def load_index(self, persist_dir: str = "./storage"):
        """从磁盘加载索引"""
        storage_context = StorageContext.from_defaults(
            persist_dir=persist_dir,
        )
        self.index = load_index_from_storage(
            storage_context,
            vector_store=self.vector_store,
        )

    def query(self, question: str, mode: str = "hybrid"):
        """查询"""
        # 构建检索器
        if mode == "hybrid":
            from llama_index.core.retrievers import QueryFusionRetriever
            from llama_index.core.retrievers import KeywordTableRetriever

            retriever = QueryFusionRetriever(
                retrievers=[
                    self.index.as_retriever(similarity_top_k=10),
                    KeywordTableRetriever(self.index),
                ],
                mode="reciprocal_ranked",
                similarity_top_k=5,
            )
        else:
            retriever = self.index.as_retriever(similarity_top_k=5)

        # 后处理：过滤 + 重排序
        postprocessors = [
            SimilarityPostprocessor(similarity_cutoff=0.7),
            SentenceTransformerRerank(
                model="cross-encoder/ms-marco-MiniLM-L-12-v2",
                top_n=3,
            ),
        ]

        # 查询引擎
        query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            node_postprocessors=postprocessors,
            llm=self.llm,
            response_mode="refine",
        )

        response = query_engine.query(question)

        return {
            "answer": str(response),
            "sources": [
                {
                    "text": node.text[:200] + "...",
                    "metadata": node.metadata,
                    "score": node.score,
                }
                for node in response.source_nodes
            ],
        }


# 使用
rag = ProductionRAG()
rag.build_index("./knowledge_base")
result = rag.query("项目的技术架构是什么？")
print(result["answer"])
```

### 增量更新

```python
# ===== 增量更新（新增文档，不重建索引）=====
def add_documents(index, new_docs_path: str):
    """增量添加文档到现有索引"""
    new_docs = SimpleDirectoryReader(new_docs_path).load_data()

    # 切分新文档
    node_parser = SemanticSplitterNodeParser(embed_model=OpenAIEmbedding())
    new_nodes = node_parser.get_nodes_from_documents(new_docs)

    # 插入索引
    for node in new_nodes:
        index.insert(node)

    print(f"新增 {len(new_nodes)} 个节点")

# ===== 删除文档 =====
def delete_document(index, doc_id: str):
    """从索引中删除文档"""
    index.delete_ref_doc(ref_doc_id=doc_id, delete_from_vector_store=True)
    print(f"已删除文档: {doc_id}")
```

---

## LlamaIndex vs LangChain 选型

```
选型决策：
─────────────────────────────────────────────────────
场景                          推荐
─────────────────────────────────────────────────────
只需 RAG 知识库               LlamaIndex（更专注）
需要多工具 Agent              LangChain（生态更全）
复杂数据加载（PDF/网页/数据库）  LlamaIndex（加载器更丰富）
多索引组合                     两者都强（LlamaIndex 更灵活）
生产级 RAG                     LlamaIndex（可控性强）
探索性原型                     LangChain（快速上手）
需要知识图谱                   LlamaIndex（原生支持 KG Index）
已有 LangChain 项目           LangChain + LlamaIndex Retriever
─────────────────────────────────────────────────────

最佳实践：两者结合
LangChain 的 Chain / Memory + LlamaIndex 的 Index / Retriever
= 最佳 RAG 体验
─────────────────────────────────────────────────────
```

---

## 常见陷阱与最佳实践

### 陷阱 1：chunk_size 随意设置

```python
# ❌ 陷阱：chunk_size=100（太小，上下文丢失）
# ❌ 陷阱：chunk_size=10000（太大，检索粒度粗）
# ❌ 陷阱：chunk_overlap=0（边界信息丢失）

# ✅ 正确：根据内容类型调整
CHUNK_SIZES = {
    "technical_docs": 512,    # 技术文档：中等粒度
    "code": 256,              # 代码：较小粒度
    "legal_docs": 1024,       # 法律文档：较大粒度
    "qa_pairs": 128,          # 问答对：小粒度
}
CHUNK_OVERLAP_RATIO = 0.2  # 重叠 20%

chunk_size = CHUNK_SIZES.get(doc_type, 512)
chunk_overlap = int(chunk_size * CHUNK_OVERLAP_RATIO)
```

### 陷阱 2：只用向量检索

```python
# ❌ 陷阱：只用 VectorIndexRetriever
# 结果：语义相似但字面不同的查询召回效果差

# ✅ 正确：混合检索（向量 + 关键词）
retriever = QueryFusionRetriever(
    retrievers=[vector_retriever, keyword_retriever],
    mode="reciprocal_ranked",
)
```

### 陷阱 3：没有后处理

```python
# ❌ 陷阱：检索完直接给 LLM
# 结果：噪声节点影响答案质量

# ✅ 正确：后处理过滤 + 重排序
postprocessors = [
    SimilarityPostprocessor(similarity_cutoff=0.7),  # 过滤低分
    SentenceTransformerRerank(top_n=3),               # 重排序
]
```

---

## 总结

```
LlamaIndex 核心组件速查：
─────────────────────────────────────────────────────
Document               文档对象（text + metadata）
Node                   切分后的节点（带父子关系）
SimpleDirectoryReader  文件目录加载器
SemanticSplitterNodeParser 语义切分
VectorStoreIndex       向量索引（最常用）
SummaryIndex           摘要索引
KnowledgeGraphIndex    知识图谱索引
SQLStructGPTIndex       SQL 索引
QueryFusionRetriever   混合检索器
RetrieverQueryEngine   查询引擎
SentenceTransformerRerank   重排序
response_mode          refine/compact/simple_summarize/tree_summarize
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ chunk_size 按内容类型调整（代码 256，技术 512，法律 1024）
✅ chunk_overlap 保持 15-20%（边界信息不丢失）
✅ 优先语义切分（SemanticSplitterNodeParser）
✅ 混合检索（向量 + 关键词）优于单一检索
✅ 检索后加后处理：过滤低分 + 重排序
✅ rerank 模型提升答案质量
✅ 知识图谱补充关系推理
✅ 持久化索引，避免重复 Embedding
✅ 增量更新，不重建索引
✅ 评估先行（RAGAS），量化改进效果
✅ LangChain + LlamaIndex 结合，取长补短
✅ 生产监控：检索召回率 + 生成质量
─────────────────────────────────────────────────────
```

LlamaIndex 是 RAG 系统的数据编排专家——从文档加载、切分、索引、检索到评估，每一步都有精细控制。与 LangChain 对比：LangChain 是 AI 应用的全能框架，LlamaIndex 是 RAG 的深度引擎。两者结合，你的知识库问答系统才能既快速开发又精准可控 🦐

本文由小虾子 🦐 撰写
