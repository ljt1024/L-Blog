# GraphRAG 深度解析：知识图谱 + 检索增强生成，攻克多跳推理的最后堡垒

> 向量 RAG 有个天花板：它能找到"与问题相似的内容"，却回答不了"A 的负责人的上级参与了哪些项目"这种需要跨文档、多跳关系推理的问题；也回答不了"这 100 份年报的整体趋势是什么"这种全局摘要问题。**GraphRAG（Graph-based RAG）** 把知识图谱引入检索管线，用"实体-关系"网络取代纯向量相似度，让 AI 拥有结构化推理能力。微软 2024 年开源的 GraphRAG 项目引爆了这个方向，随后 LightRAG、HippoRAG、PathRAG 百花齐放。本文深入剖析其原理、知识图谱构建、社区检测算法、检索策略，并从零实现一个 mini-GraphRAG。

## 一、向量 RAG 的三大痛点

### 1.1 痛点1：多跳推理（Multi-hop Reasoning）

```python
# 问题："张三所在部门的负责人，参加过哪些融资项目？"

# 需要的推理链：
# 张三 --属于--> 部门A
# 部门A --负责人是--> 李四
# 李四 --参与--> 融资项目X
#
# 这是一个 3-hop 推理，答案分散在至少 3 份不同文档中

# 向量 RAG 的困境：
query_vec = embed("张三所在部门的负责人参加过哪些融资项目")
# 这条查询的向量会同时"像"人事文档（张三、部门）
# 又"像"组织架构文档（负责人）又"像"融资新闻（融资项目）
# → 检索回来一堆"各自相似"但"彼此无关"的碎片
# → LLM 拿到碎片也串不起完整推理链
```

```
向量 RAG 检索结果：
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 人事档案：张三，  │ │ 架构文档：部门A  │ │ 融资新闻：项目X  │
│ 属于部门A        │ │ 负责人李四       │ │ 完成B轮融资      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
   ↑ 三块碎片都检索到了，但"李四 ↔ 项目X"的连接关系丢失了
     LLM 需要自己猜：李四参加过项目X吗？——文档里没说，幻觉开始
```

### 1.2 痛点2：全局摘要（Global Summarization）

```python
# 问题："总结这 5000 份客服工单中最常见的投诉主题"

# 向量 RAG 的困境：
# ① 检索 Top-K（比如 K=50）只是"与'投诉主题'相似的 50 条"
#    ——5000 条里的 4950 条被完全忽略
# ② 即使分批检索全部，上下文窗口也塞不下
# ③ 无法做"主题聚类 + 计数 + 排序"这类聚合统计

# 这类问题的本质：答案不在某个局部文档，而在整个语料库的"整体结构"中
```

### 1.3 痛点3：关系密集型问答

```python
# 问题："哪些供应商同时给我们的竞争对手供货？"

# 需要：供应商关系 × 竞争关系 的"交集运算"
# 向量相似度无法表达"交集"这种结构化查询
# 但图数据库一行 Cypher 就能解决：
cypher = """
MATCH (s:Supplier)-[:SUPPLIES]->(c:Company)
WHERE c IN $competitors AND (s)-[:SUPPLIES]->(us)
RETURN DISTINCT s.name
"""
```

**GraphRAG 的答案：把"相似度检索"升级为"结构化遍历 + 相似度检索"的混合体。**

## 二、GraphRAG 核心思想

### 2.1 知识图谱：另一种知识表示

```
                    ┌────────┐
        任职于       │  张三   │       朋友
   ┌──────────────►│ (Person)│◄──────────────┐
   │                └────────┘                │
┌──┴─────┐            │领导                    │
│ 公司A   │            ▼                  ┌────┴───┐
│(Company)│        ┌────────┐   开发      │ 李四    │
└──┬─────┘  部署于 │ 部门A   │◄───────────│(Person)│
   │              │(Dept)   │            └────────┘
   ▼              └────┬────┘               │参与
┌────────┐             │使用                 ▼
│ 云平台X │             ▼                ┌────────┐
│(Cloud)  │        ┌────────┐           │ 项目Y   │
└────────┘        │ 系统Z   │           │(Project)│
                  │(System)│            └────────┘
                  └────────┘

实体（节点）+ 关系（边）+ 类型（标签）= 可推理的知识网络
```

| 维度 | 向量库 | 知识图谱 |
|------|--------|---------|
| 知识单元 | 文本块（chunk） | 实体 + 关系（三元组） |
| 检索方式 | 相似度（模糊） | 图遍历（精确）+ 相似度 |
| 多跳推理 | ❌ 弱 | ✅ 天然支持 |
| 全局摘要 | ❌ 不支持 | ✅ 社区摘要 |
| 关系交集 | ❌ | ✅ 图查询语言 |
| 细节召回 | ✅ 强 | ⚠️ 需要文本锚定 |
| 构建成本 | 低（嵌入即得） | 高（需要抽取管线） |

### 2.2 GraphRAG 的双层架构

微软 GraphRAG 的精妙之处：**不是用图替代向量，而是图与向量双轨并行**。

```
                    ┌─────────────────────────────┐
                    │        索引阶段（离线）        │
                    └─────────────────────────────┘

原始文档 ──► 分块 ──► LLM 实体/关系抽取 ──► 知识图谱
                          │                    │
                          ▼                    ▼
                    实体描述向量          Leiden 社区检测
                          │                    │
                          ▼                    ▼
                    向量索引              分层社区摘要
                   (entity vectors)    (community summaries)
                                              │
                                    每层社区摘要也向量化
                                              │
                                              ▼
                    ┌─────────────────────────────┐
                    │        查询阶段（在线）        │
                    └─────────────────────────────┘

局部问题 ──► Local Search ──► 种子实体 + 邻居子图 + 原文 ──► LLM
全局问题 ──► Global Search ──► 社区摘要 Map-Reduce ──► LLM
```

## 三、索引阶段：构建知识图谱

### 3.1 实体与关系抽取（信息抽取）

GraphRAG 的第一步：用 LLM 从每个文本块抽取三元组。

```python
EXTRACTION_PROMPT = """
你是一个知识图谱构建专家。从以下文本中抽取实体和关系。

抽取规则：
1. 实体类型：人物、组织、地点、产品、事件、技术、概念
2. 每个实体包含：名称、类型、描述
3. 关系包含：源实体、目标实体、关系描述
4. 只抽取文本中明确表达的信息，不要推断

输出 JSON 格式：
{
  "entities": [
    {"name": "张三", "type": "人物", "description": "公司A的部门负责人"}
  ],
  "relationships": [
    {"source": "张三", "target": "部门A", "relationship": "负责管理", "strength": 0.9}
  ]
}

文本：
{chunk_text}
"""

async def extract_triples(chunk: str, llm) -> dict:
    response = await llm.complete(
        EXTRACTION_PROMPT.replace("{chunk_text}", chunk),
        response_format={"type": "json_object"}
    )
    return json.loads(response)

# 一次抽取的输出示例
sample_output = {
    "entities": [
        {"name": "张三", "type": "人物", "description": "公司A算法部负责人，主导RAG项目"},
        {"name": "公司A", "type": "组织", "description": "一家人工智能独角兽企业"},
        {"name": "RAG项目", "type": "项目", "description": "企业知识库检索增强系统"}
    ],
    "relationships": [
        {"source": "张三", "target": "公司A", "relationship": "任职于", "strength": 1.0},
        {"source": "张三", "target": "RAG项目", "relationship": "主导开发", "strength": 0.95},
        {"source": "公司A", "target": "RAG项目", "relationship": "立项投资", "strength": 0.9}
    ]
}
```

### 3.2 共指消解（Entity Resolution）

不同文档对同一实体的称呼不同——"张三"、"张总"、"张经理"是同一个人。不合并会导致图碎片化：

```python
class EntityResolver:
    """实体消解：合并指向同一现实实体的节点"""

    def __init__(self, embedder, similarity_threshold=0.88):
        self.embedder = embedder
        self.threshold = similarity_threshold

    async def resolve(self, entities: list[dict]) -> dict[str, str]:
        """返回 name -> canonical_name 的映射"""
        # 策略1：名称归一化
        normalized = {}
        for e in entities:
            key = self.normalize_name(e["name"])  # 去头衔、统一大小写
            normalized.setdefault(key, []).append(e)

        # 策略2：名称+描述向量相似度聚类
        names = list(normalized.keys())
        vecs = self.embedder.encode([
            f"{n}: {normalized[n][0]['description']}" for n in names
        ])

        # 策略3：LLM 最终裁决（对相似度边界上的候选对）
        # "张三(公司A算法部负责人)" vs "张总(公司A算法部)" → 同一实体？
        mapping = {}
        for i, name in enumerate(names):
            for j in range(i + 1, len(names)):
                sim = cosine(vecs[i], vecs[j])
                if sim > self.threshold:
                    canonical = await self._llm_confirm(names[i], names[j])
                    mapping[names[j]] = canonical
        return mapping

    def normalize_name(self, name: str) -> str:
        # "张总" → "张"，"CEO 马斯克" → "马斯克"
        for title in ["总", "经理", "总监", "博士", "教授", "CEO", "CTO"]:
            if name.endswith(title) and len(name) > len(title):
                return name[:-len(title)]
        return name.strip().lower()
```

### 3.3 社区检测：Leiden 算法

GraphRAG 的灵魂步骤：把图划分成"社区"（Community）——内部连接紧密、外部连接稀疏的子图。然后**对每个社区生成 LLM 摘要**，这些摘要就是回答全局问题的钥匙。

```python
import networkx as nx
from cdlib import algorithms

def detect_communities(graph: nx.Graph) -> list[list[str]]:
    """
    Leiden 算法：
    - 目标：最大化模块度（Modularity）
      Q = Σ[ (社区内部边权重/总边权重) - (社区节点度数和/2总边权重)² ]
    - 相比 Louvain：保证社区连通性，不会产生"孤岛社区"
    - 层次化运行：大社区内部再检测小社区 → 层次摘要树
    """
    # node2community: {entity_name: community_id}
    coms = algorithms.leiden(graph, weights="weight")
    communities = {}
    for cid, nodes in enumerate(coms.communities):
        communities[cid] = nodes
    return list(coms.communities)


def build_hierarchical_communities(graph: nx.Graph, max_levels=3) -> list[dict]:
    """层次化社区检测：自底向上逐层合并"""
    levels = []
    current_graph = graph.copy()
    current_nodes = list(graph.nodes())

    for level in range(max_levels):
        communities = detect_communities(current_graph)
        if len(communities) <= 1:
            break
        levels.append({
            "level": level,
            "communities": communities  # level 0 最细粒度，逐层变粗
        })
        # 下一层：把每个社区压缩成超节点
        current_graph = contract_communities(current_graph, communities)

    return levels
```

```
层次社区结构（3 层示例）：

Level 2:  [_______ 全局摘要：公司整体业务 _______]
                    /                    \
Level 1:  [__ 技术线摘要 __]      [__ 商业线摘要 __]
           /      |      \          /        |      \
Level 0: [AI部] [平台部] [数据部]  [销售]  [市场]  [BD]
         (最细粒度，每个社区 5~20 个实体)
```

### 3.4 社区摘要生成

```python
COMMUNITY_SUMMARY_PROMPT = """
你是一个分析师。以下是知识图谱中一个"社区"（紧密相关的实体群）的信息。

实体列表：
{entities}

实体间关系：
{relationships}

请生成一份结构化摘要，包含：
1. 社区主题（这个社区讨论的核心话题是什么）
2. 关键实体及其角色
3. 实体间的重要关系和互动模式
4. 值得注意的洞察（冲突、趋势、异常）

摘要应独立可读，让没有见过原始文档的人也能理解。
"""

async def summarize_community(community_nodes, graph, llm) -> str:
    entities = "\n".join(f"- {n}: {graph.nodes[n]['description']}" for n in community_nodes)
    relationships = "\n".join(
        f"- {s} --[{d['relationship']}]--> {t}"
        for s, t, d in graph.edges(community_nodes, data=True)
    )
    prompt = COMMUNITY_SUMMARY_PROMPT.format(
        entities=entities, relationships=relationships
    )
    return await llm.complete(prompt)
```

## 四、查询阶段：三种检索策略

### 4.1 Local Search：局部问题

适用：**具体实体相关的问题**（"张三负责什么？"）。从问题中的实体出发，向周围扩展子图：

```python
class LocalSearch:
    """局部搜索：种子实体 → 邻域扩展 → 上下文组装"""

    def __init__(self, graph, entity_vector_index, textstore, llm):
        self.graph = graph
        self.entity_index = entity_vector_index   # 实体向量索引
        self.textstore = textstore                # 原始文本块存储
        self.llm = llm

    async def search(self, query: str, k_entities=10, depth=2) -> dict:
        # Step 1: 向量检索找到种子实体
        seed_entities = self.entity_index.search(query, top_k=k_entities)

        # Step 2: 图遍历扩展邻域（BFS，限制深度与宽度）
        subgraph_entities = set()
        subgraph_edges = []
        frontier = [e["name"] for e in seed_entities]
        for d in range(depth):
            next_frontier = []
            for node in frontier:
                for neighbor, attrs in self.graph[node].items():
                    if neighbor not in subgraph_entities:
                        subgraph_entities.add(neighbor)
                        subgraph_edges.append((node, neighbor, attrs))
                        if len(next_frontier) < 20:  # 宽度限制，防爆炸
                            next_frontier.append(neighbor)
            frontier = next_frontier
            if not frontier:
                break

        # Step 3: 关联原始文本（图给你骨架，文本给你血肉）
        related_chunks = self.textstore.get_chunks_mentioning(
            subgraph_entities, top_k=20
        )

        # Step 4: 组装上下文给 LLM
        return {
            "entities": subgraph_entities,
            "relationships": subgraph_edges,
            "text_units": related_chunks,
        }
```

**关键设计：图 + 原文双通道。** 图遍历保证关系链完整，原文锚定保证细节不丢失（图谱抽取时可能丢失细节）。

### 4.2 Global Search：全局问题

适用：**语料库整体性问题**（"这批文档的主要主题是什么？"）。用社区摘要做 **Map-Reduce**：

```python
class GlobalSearch:
    """全局搜索：社区摘要 Map-Reduce"""

    def __init__(self, community_summaries, llm):
        self.summaries = community_summaries  # 分层的社区摘要
        self.llm = llm

    async def search(self, query: str, level=1) -> str:
        # 选定层级的所有社区摘要（level 越高摘要越粗）
        summaries = self.summaries[level]

        # ---- MAP 阶段：并行让每个社区摘要回答问题 ----
        map_tasks = [
            self._map_step(query, summary, cid)
            for cid, summary in enumerate(summaries)
        ]
        partial_answers = await asyncio.gather(*map_tasks)

        # 过滤"本社区无相关信息"的部分结果
        valid = [p for p in partial_answers if p and p["score"] > 0]

        # ---- REDUCE 阶段：汇总各社区视角 ----
        return await self._reduce_step(query, valid)

    async def _map_step(self, query, summary, cid):
        prompt = f"""
        你在分析一组文档的一部分。以下是这个部分的摘要：

        --- 社区 {cid} 摘要 ---
        {summary}
        ---

        问题：{query}

        根据以上摘要，如果包含相关信息，给出部分答案。
        输出 JSON：{{"score": 0-10的相关度, "answer": "部分答案"}}
        如果摘要与问题无关，score 给 0。
        """
        resp = await self.llm.complete(prompt, response_format={"type": "json_object"})
        return json.loads(resp)

    async def _reduce_step(self, query, partials):
        # 500 个社区不能全塞给 LLM，按 score 排序取 Top-N
        top = sorted(partials, key=lambda p: -p["score"])[:20]
        combined = "\n\n".join(
            f"[部分答案 {i}，相关度 {p['score']}]\n{p['answer']}"
            for i, p in enumerate(top)
        )
        prompt = f"""
        多个分析视角对同一问题给出了部分答案：

        {combined}

        问题：{query}

        请综合以上所有视角，给出完整、有层次的最终答案。
        注意观点之间的共性与分歧，标注支撑度最强的结论。
        """
        return await self.llm.complete(prompt)
```

```
Global Search 执行流：

问题："这 5000 份工单中最常见的投诉主题？"
    │
    ├── MAP ──► 社区摘要1 → "主要是物流延迟问题" (score 8)
    ├── MAP ──► 社区摘要2 → "退款流程太繁琐" (score 9)
    ├── MAP ──► 社区摘要3 → "客服响应慢" (score 7)
    ├── MAP ──► 社区摘要4 → "与问题无关" (score 0, 丢弃)
    │    ... × N 个社区（并行）
    │
    └── REDUCE ──► "Top 3 投诉主题：①退款流程繁琐（多个社区一致提及）
                     ②物流延迟 ③客服响应慢。其中退款问题在 X 个
                     社区中被反复提及，是跨产品的系统性问题..."
```

### 4.3 DRIFT Search：先全局后局部

微软后续提出的混合策略：先用 Global 摘要定位相关社区（粗定位），再用 Local 遍历深挖细节（精检索）。适合"既要知道全貌又要具体案例"的复合问题。

```python
class DriftSearch:
    """DRIFT：Global 定位 → Local 深挖 的迭代搜索"""

    async def search(self, query: str, max_hops=3) -> dict:
        # Hop 1: 全局摘要粗定位
        community_scores = await self._global_scan(query)
        top_communities = sorted(community_scores, key=lambda x: -x[1])[:3]

        # Hop 2..N: 在 Top 社区内做局部搜索，循环细化
        context = {"entities": set(), "chunks": [], "traversed": set()}
        for hop in range(max_hops):
            follow_up = await self._generate_followup(query, context)
            new_findings = await self._local_search_within(
                follow_up, top_communities
            )
            if not self._is_new_info(new_findings, context):
                break  # 收敛：没有新信息了
            context = self._merge(context, new_findings)

        return context
```

## 五、从零实现 mini-GraphRAG

```python
"""
mini-graphrag: ~150 行实现核心管线
依赖：pip install networkx cdlib openai
"""
import asyncio
import json
import networkx as nx
from openai import AsyncOpenAI

class MiniGraphRAG:
    def __init__(self, model="gpt-4o-mini"):
        self.llm = AsyncOpenAI()
        self.model = model
        self.graph = nx.Graph()
        self.entity_index = {}      # name -> embedding
        self.textstore = {}         # entity -> [chunks]
        self.community_summaries = []

    # ========== 索引阶段 ==========

    async def index(self, chunks: list[str]):
        for i, chunk in enumerate(chunks):
            extraction = await self._extract(chunk)
            await self._merge_into_graph(extraction, chunk)
            print(f"[{i+1}/{len(chunks)}] 实体抽取完成，图节点: {self.graph.number_of_nodes()}")

        self._detect_and_summarize_communities()
        print(f"社区检测完成：{len(self.community_summaries)} 个社区")

    async def _extract(self, chunk: str) -> dict:
        resp = await self.llm.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": f"""
从文本抽取实体和关系，输出 JSON：
{{"entities": [{{"name": "...", "type": "...", "description": "..."}}],
  "relationships": [{{"source": "...", "target": "...", "relationship": "..."}}]}}

文本：{chunk}"""}]
        )
        return json.loads(resp.choices[0].message.content)

    async def _merge_into_graph(self, extraction: dict, chunk: str):
        for ent in extraction["entities"]:
            name = ent["name"]
            if name in self.graph:
                # 已有实体：合并描述、累积提及
                self.graph.nodes[name]["description"] += f"；{ent['description']}"
                self.graph.nodes[name]["mentions"] += 1
            else:
                self.graph.add_node(name, **ent, mentions=1)
            # 实体 ↔ 原文锚定
            self.textstore.setdefault(name, []).append(chunk)

        for rel in extraction["relationships"]:
            s, t = rel["source"], rel["target"]
            if self.graph.has_edge(s, t):
                self.graph[s][t]["weight"] += 1  # 重复关系增强权重
            else:
                self.graph.add_edge(s, t, relationship=rel["relationship"], weight=1)

    def _detect_and_summarize_communities(self):
        if self.graph.number_of_nodes() < 3:
            return
        # 贪婪模块度社区检测（NetworkX 内置，无需 cdlib）
        from networkx.algorithms.community import greedy_modularity_communities
        communities = list(greedy_modularity_communities(
            self.graph, weight="weight"
        ))
        # 对 Top 社区生成摘要（异步批量）
        tasks = [self._summarize_community(list(c)) for c in communities if len(c) >= 3]
        self.community_summaries = asyncio.get_event_loop().run_until_complete(
            asyncio.gather(*tasks)
        ) if tasks else []

    async def _summarize_community(self, nodes: list[str]) -> str:
        entities = "\n".join(f"- {n}({self.graph.nodes[n].get('type','?')}): "
                            f"{self.graph.nodes[n]['description'][:100]}" for n in nodes)
        resp = await self.llm.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": f"""
以下是一组紧密关联的实体，请生成 3-5 句主题摘要：
{entities}"""}]
        )
        return resp.choices[0].message.content

    # ========== 查询阶段 ==========

    async def query(self, question: str, mode: str = "local") -> str:
        if mode == "local":
            context = self._local_context(question)
            prompt = self._build_prompt(question, context)
        else:  # global
            context = "\n\n".join(self.community_summaries)
            prompt = f"以下是语料库各部分的摘要：\n{context}\n\n问题：{question}"

        resp = await self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.choices[0].message.content

    def _local_context(self, question: str, depth=2) -> str:
        # 简化版：问题中提到的实体 + 1~2 跳邻居 + 锚定文本
        mentioned = [n for n in self.graph.nodes if n in question]
        if not mentioned:
            # 没有显式实体：退化为全图概览
            mentioned = sorted(
                self.graph.nodes, key=lambda n: self.graph.degree(n), reverse=True
            )[:5]

        context, visited = [], set(mentioned)
        for node in mentioned:
            context.append(f"◆ {node}: {self.graph.nodes[node]['description']}")
            for neighbor in self.graph.neighbors(node):
                if neighbor not in visited:
                    visited.add(neighbor)
                    edge = self.graph[node][neighbor]
                    context.append(f"  └─{edge['relationship']}→ {neighbor}: "
                                  f"{self.graph.nodes[neighbor]['description'][:80]}")
        # 锚定原文（Top 实体的原文块）
        for node in mentioned[:3]:
            for chunk in self.textstore.get(node, [])[:1]:
                context.append(f"[原文] {chunk[:200]}")
        return "\n".join(context)

    def _build_prompt(self, question, context):
        return f"""基于以下知识图谱上下文回答问题。如果上下文不足以回答，明确说明。

上下文：
{context}

问题：{question}"""

# ========== 使用示例 ==========
docs = [
    "张三是公司A算法部的负责人，他主导的RAG项目获得了年度创新奖。",
    "李四在公司A的商业化部门工作，与张三在RAG项目上有密切合作。",
    "RAG项目使用向量数据库和知识图谱技术，解决了企业知识检索的痛点。",
    "公司A在2024年完成B轮融资，投资方看重其知识管理产品线。",
    "王五负责公司A的基础设施团队，为RAG项目提供GPU算力支持。",
]

rag = MiniGraphRAG()
rag.index(docs)  # 同步封装内含异步
answer = rag.query("张三的同事参与了哪些项目？")  # local search
```

## 六、GraphRAG 变体生态

微软 GraphRAG 开源后，社区演化出多个更轻量的变体：

| 方案 | 核心创新 | 索引成本 | 适用场景 |
|------|---------|---------|---------|
| **微软 GraphRAG** | 社区检测 + 分层摘要（最完整） | 极高（每个 chunk 多次 LLM 调用） | 全局摘要刚需、预算充足 |
| **LightRAG** | 图 + 双层检索（实体级/主题级），无社区检测 | 中（约 GraphRAG 的 1/10） | 大多数场景的性价比之选 |
| **HippoRAG** | 模拟海马体记忆，Personalized PageRank 做图检索 | 低 | 多跳问答基准表现强 |
| **PathRAG** | 检索时动态裁剪图路径，避免无关子图爆炸 | 低 | 大图 + 实时查询 |
| **nano-graphrag** | 微软 GraphRAG 的 1000 行极简复刻 | 同微软（但代码可读性极佳） | 学习原理 / 二次开发 |

```python
# LightRAG 快速上手（推荐的工程起点）
# pip install lightrag-hku
from lightrag import LightRAG, QueryParam

rag = LightRAG(
    working_dir="./rag_storage",
    llm_model_func=your_llm_function,      # 任意 LLM（含本地 Ollama）
    embedding_func=your_embedding_function
)

await rag.ainsert(docs)                     # 索引：抽实体建图

# 4 种查询模式
answer = await rag.aquery(
    "张三的同事参与了哪些项目？",
    param=QueryParam(mode="local")    # local: 实体邻域
)
answer = await rag.aquery(
    "这批文档的整体主题是什么？",
    param=QueryParam(mode="global")   # global: 高层关键词
)
answer = await rag.aquery(
    "RAG项目和融资的关系？",
    param=QueryParam(mode="hybrid"))  # hybrid: local+global 混合
```

## 七、成本与工程决策

### 7.1 索引成本核算（真实痛点）

```
微软 GraphRAG 索引 100 万 token 文档的 LLM 调用（gpt-4o-mini）：

阶段                    调用次数        Token 消耗（约）
────────────────────────────────────────────────────
实体/关系抽取            每 chunk 1 次      原文 ×1.5
实体消解                 边界对数 ×1        少量
社区摘要（3层）          社区数 ×3          每摘要 ~2K
社区摘要向量化            社区数 ×3          少量
────────────────────────────────────────────────────
总成本 ≈ 原始文本嵌入成本的 50~100 倍（！）

工程结论：
① 先用 LightRAG/无摘要模式验证效果，再决定是否上完整管线
② 实体抽取用小模型（gpt-4o-mini / Qwen2.5-7B），只有摘要用大模型
③ 增量文档只跑增量抽取，全图重建仅在结构剧变时做
```

### 7.2 图存储选型

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 原型验证 | NetworkX（内存图） | 零部署，百万节点内够用 |
| 中小型生产 | SQLite/PostgreSQL + JSONB | 图规模 < 千万边，SQL 足够 |
| 大规模生产 | Neo4j / NebulaGraph | 需要 Cypher/nGQL 图查询、可视化 |
| 已有向量库 | Qdrant payload / pgvector + 递归查询 | 避免引入新组件 |

### 7.3 什么时候该用 GraphRAG

```
决策检查表（命中 2 条以上 → 值得评估 GraphRAG）：

□ 问答需要跨文档的关系推理（"A 的合作伙伴的客户是谁"）
□ 需要全局性摘要/主题分析（"整批文档讲了什么"）
□ 领域实体关系密集（金融、法律、医药、情报、企业组织）
□ 现有向量 RAG 在多跳问题上幻觉率不可接受
□ 文档集相对稳定（知识图谱的构建成本可被长期摊销）

全部不命中 → 老老实实用向量 RAG（更便宜、更简单、召回够用）
```

## 八、评估：GraphRAG 效果到底如何

```python
# GraphRAG 论文报告的关键实验结果（Microsoft, 2024）

# 全局理解任务（1000 个新闻文档，生成 4 类问题）：
#   GraphRAG (Global) vs 向量RAG (Top-K) vs Map-Reduce 全文
#
#   胜率（LLM-as-judge，GPT-4 评判）：
#   GraphRAG 全面优于向量 RAG：72-83% 的对比中胜出或平局
#   尤其在 "comprehensiveness（全面性）" 和 "diversity（多样性）" 上碾压
#   在 "empowerment（直接可用性）" 上与 Map-Reduce 持平，但 token 少一个数量级

# 多跳问答（MultiHop-RAG 等基准）：
#   HippoRAG 在多跳问题上比强基线 Recomp + Contriever 高 3~20 个点
#   证明"图结构遍历"对关系推理的增益是真实的

# 但是！成本敏感场景：
#   LightRAG 论文显示：微软 GraphRAG 索引成本是 LightRAG 的 ~10 倍
#   而多数基准上 LightRAG 效果与微软版持平或更优
```

## 九、总结

GraphRAG 是 RAG 演进的关键分支：**用知识图谱的结构化推理能力，补上向量检索在多跳推理和全局理解上的先天缺陷。**

**核心知识地图：**

| 概念 | 一句话 |
|------|--------|
| GraphRAG | 图遍历（精确关系）+ 向量检索（模糊语义）的混合管线 |
| 索引管线 | 分块 → LLM 抽取三元组 → 实体消解 → 建图 → 社区检测 → 分层摘要 |
| Leiden 算法 | 把图切成"内密外疏"的社区，是分层摘要的基础 |
| Local Search | 种子实体 + BFS 邻域 + 原文锚定 → 具体问题 |
| Global Search | 社区摘要 Map-Reduce → 全局问题 |
| DRIFT Search | 全局粗定位 + 局部深挖的迭代混合 |
| 实体消解 | "张总"="张三"，不合并则图碎片化 |
| 成本真相 | 索引成本约为纯向量 RAG 的 10~100 倍，LightRAG 是性价比拐点 |

**三条工程铁律：**

1. **先向量后图**——向量 RAG 解决不了的（多跳/全局），才值得为它支付图谱构建成本
2. **图 + 原文双通道**——图给推理骨架，原文锚定细节，缺一个都会幻觉
3. **小模型抽取、大模型摘要**——成本控制的命门在索引阶段，不在查询阶段

*本文由小虾子 🦐 撰写*
