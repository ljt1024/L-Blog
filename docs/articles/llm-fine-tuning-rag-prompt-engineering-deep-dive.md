# LLM Fine-tuning vs RAG vs Prompt Engineering：完整选型决策指南

> 当你的 AI 应用开始遇到"通用模型知识不够专业"、"提示词写了几千字还是不稳定"、"模型总是幻觉"等问题时，你有三个武器：Prompt Engineering（调提示）、RAG（外挂知识库）、Fine-tuning（微调模型）。但什么时候用哪个？三者能否组合使用？如何从零开始实施？这篇文章给出一个完整的决策框架和实操指南，帮助你在真实项目中做出正确选择。

## 一、三种方法的核心定位

在开始之前，先理解三种方法的本质差异：

```
┌─────────────────────────────────────────────────────────────────┐
│                        通用大模型                                │
│                    （海量预训练知识）                             │
└─────────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌─────────────┐   ┌─────────────┐  ┌─────────────┐
    │   Prompt    │   │     RAG     │  │ Fine-tuning │
    │ Engineering │   │             │  │             │
    │   (调整输入) │   │  (增强检索)  │  │  (改造模型)  │
    └─────────────┘   └─────────────┘  └─────────────┘
    
    成本：低             成本：中            成本：高
    速度：快             速度：中            速度：慢
    定制：表面           定制：知识          定制：行为
    上线：分钟            上线：小时          上线：天/周
```

### 1.1 Prompt Engineering 的本质

**做什么**：通过优化输入提示词的结构、格式、示例来引导模型产生更好的输出。

```python
# 无 Prompt Engineering
response = llm("翻译：Hello")

# 有 Prompt Engineering（few-shot learning）
response = llm("""
翻译以下英文句子为中文：

Example 1:
Input: Good morning
Output: 早上好

Example 2:
Input: How are you?
Output: 你好吗？

Now translate:
Input: Hello
Output:
""")
```

**适用场景**：
- 模型本身能力足够，问题是"没发挥出来"
- 需要快速验证想法，不想要工程投入
- 任务简单（<5 个步骤），不需要复杂推理

**局限性**：
- 模型知识边界不变，无法注入新知识
- 提示词过长会降低模型注意力、增加 Token 成本
- 复杂任务的指令遵循不稳定（同一提示词多次调用结果不一致）
- 每个任务都需要单独的提示词，提示词之间无法迁移

### 1.2 RAG 的本质

**做什么**：在推理时，从外部知识库中检索相关文档，将文档作为上下文注入提示词，让模型基于检索到的内容回答。

```python
# RAG 流程
async def rag_query(user_question: str, llm, vector_store):
    # Step 1: 检索（毫秒级）
    docs = await vector_store.similarity_search(user_question, top_k=5)
    
    # Step 2: 构建增强提示
    context = "\n\n".join([doc.content for doc in docs])
    enhanced_prompt = f"""
    基于以下参考资料回答问题。如果资料中没有明确答案，说明不知道。
    
    参考资料：
    {context}
    
    问题：{user_question}
    """
    
    # Step 3: 推理（模型看到的是"参考资料 + 问题"）
    return await llm.complete(enhanced_prompt)
```

**适用场景**：
- 需要模型掌握**动态更新的专业知识**（公司文档、实时数据、产品手册）
- 答案需要**可溯源**（必须告诉用户答案来自哪篇文档）
- 需要**大规模知识覆盖**（数十万条文档），无法靠 Prompt 注入
- 对**准确性要求高**，幻觉不可接受

**局限性**：
- 检索质量决定上限（Garbage In, Garbage Out）
- 检索+推理两阶段，有额外延迟
- 多跳推理困难（需要跨多个文档综合推理）
- 对需要深层理解的任务（如学习某种技能、掌握某种思维方式）效果差

### 1.3 Fine-tuning 的本质

**做什么**：在预训练模型的基础上，用特定领域或任务的数据继续训练，调整模型的内部权重。

```
预训练阶段（万亿语料，耗时数月/数年）
GPT-4 / Claude / Llama
           │
           ▼
微调阶段（千/万条标注数据，耗时数小时/数天）
特定任务权重调整
           │
           ▼
微调后模型（行为改变，但知识边界几乎不变）
```

**两种微调范式**：

```python
# 范式1：全参数微调（Full Parameter Fine-tuning）
# 更新模型所有参数（数十亿参数，耗 GPU 显存，耗时）
# 效果最好，但成本最高
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-5)
for batch in training_data:
    loss = model(**batch).loss
    loss.backward()
    optimizer.step()

# 范式2：参数高效微调 PEFT（Parameter-Efficient Fine-tuning）
# 只更新少量参数，冻结大部分预训练权重
# LoRA / QLoRA / Adapter / Prefix Tuning
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=8,                          # 低秩矩阵维度（越小越快，省显存）
    lora_alpha=16,                # 缩放因子
    target_modules=["q_proj", "v_proj"],  # 只微调 attention 的 Q/V 投影
    lora_dropout=0.05,
    task_type="CAUSAL_LM"
)
model = get_peft_model(base_model, lora_config)
# 可训练参数：~0.1%（从 7B 降到 ~5M 参数）
```

**适用场景**：
- 需要模型**内化某种行为模式**（特定说话风格、决策逻辑、推理方式）
- 任务简单但需要**极高稳定性**（不能每次都靠提示词兜底）
- 提示词已经**过长**（超过模型上下文窗口的 30%）
- 需要**规模化部署**（千次/万次调用，减少 Token 消耗）

**局限性**：
- 不注入新知识（知识边界由预训练模型决定）
- 需要高质量标注数据（"垃圾 in，垃圾 out"）
- 训练需要 GPU 资源（成本高）
- 周期长，迭代慢（改动需要重新训练）
- 存在"灾难性遗忘"风险（微调后模型在某些通用能力上退化）

## 二、选型决策树

### 2.1 核心判断框架

```
问题诊断：
├── 1. 模型输出质量差/不稳定？
│     ├── 是 → 提示词调优是否足够？
│     │     ├── 简单任务 → Prompt Engineering
│     │     └── 复杂任务/多步骤 → Prompt Engineering + 验证
│     │
│     ├── 模型知识不够（幻觉/过时/缺失）？
│     │     ├── 需要可溯源 → RAG ✅
│     │     ├── 知识动态更新 → RAG ✅
│     │     └── 深层技能内化 → Fine-tuning
│     │
│     ├── 模型行为不符合预期（风格/逻辑/格式）？
│     │     ├── 提示词能控制吗？→ 试 Prompt Engineering
│     │     └── 提示词太长/不稳定 → Fine-tuning
│     │
│     └── Token 成本太高？
│           ├── 提示词长 → Fine-tuning（内化指令，减少 Token）
│           └── 推理慢 → 模型蒸馏/量化
└── 2. 回答：从简单到复杂，依次尝试
```

### 2.2 实践中的决策原则

| 问题表现 | 优先尝试 | 如果不够用 |
|---------|---------|----------|
| 输出格式不对 | Prompt Engineering | + 结构化输出（加验证） |
| 幻觉严重 | RAG（加知识库） | RAG + Fact Checking |
| 风格不对 | Prompt Engineering | Fine-tuning |
| 速度太慢 | 模型量化 / 换模型 | 蒸馏 |
| Token 成本高 | Prompt 压缩 | Fine-tuning |
| 多跳推理差 | Prompt Engineering | RAG Pipeline 优化 / 换更强大模型 |
| 新领域知识缺失 | RAG（加领域文档） | RAG + Fine-tuning |

### 2.3 成本/时间/效果对比

| 维度 | Prompt Engineering | RAG | Fine-tuning |
|------|-------------------|-----|-------------|
| **开发时间** | 分钟 ~ 小时 | 小时 ~ 天 | 天 ~ 周 |
| **运营成本** | Token 费用 | Token + 检索费用 | 训练 + 推理费用 |
| **数据需求** | 无（优化提示词） | 文档集合 | 百条 ~ 百万条标注 |
| **GPU 需求** | 无 | 检索服务（可选） | 训练 GPU（A100/H100） |
| **知识更新** | 慢（改提示词） | **实时**（换文档） | 慢（重新训练） |
| **稳定性** | 中等 | 高 | **高** |
| **可解释性** | 低 | **高**（可溯源） | 低 |
| **知识边界** | 不变 | 可扩展 | 不变 |
| **行为内化** | 无 | 无 | **有** |

## 三、RAG 深度指南

### 3.1 完整 RAG Pipeline

```
用户问题
    │
    ▼
┌──────────────┐
│  Query理解    │  ← 意图识别、问题改写、同义词扩展
└──────────────┘
    │
    ▼
┌──────────────┐
│    检索       │  ← 向量检索 + 关键词检索 + 混合检索
│ (Retrieval)  │
└──────────────┘
    │
    ▼
┌──────────────┐
│   重排       │  ← Cross-Encoder 精排，过滤低相关
│ (Reranking)  │
└──────────────┘
    │
    ▼
┌──────────────┐
│  生成        │  ← 将 Top-K 文档注入上下文，LLM 回答
│ (Generation) │
└──────────────┘
    │
    ▼
回答 + 引用
```

### 3.2 检索优化策略

```python
# 策略1：混合检索（向量 + BM25）
from langchain.retrievers import EnsembleRetriever

vector_retriever = vector_db.as_retriever(search_kwargs={"k": 10})
bm25_retriever = BM25Retriever.from_texts(texts, k=10)

hybrid_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    weights=[0.6, 0.4]  # 向量检索权重 0.6，BM25 权重 0.4
)

# 策略2：Query 改写（HyDE 假设文档嵌入）
from langchain.chains import HyDE

hyde_chain = HyDE(
    llm=llm,
    vectorstore=vector_db,
    direction="DOWN"
)
# HyDE 先生成一个"假设性答案"，再检索相似的真实文档

# 策略3：子查询分解（Multi-Query）
async def multi_query_retrieval(question: str, retriever, llm):
    # 用 LLM 生成多个相关子查询
    sub_queries = await llm.complete(f"""
    将以下问题分解为 3-5 个独立子问题，每个子问题聚焦一个角度：
    
    问题：{question}
    
    直接输出子问题列表，每行一个，不要解释。
    """)
    
    # 并行检索所有子查询
    retrieval_tasks = [retriever.ainvoke(q) for q in sub_queries.split('\n')]
    results = await asyncio.gather(*retrieval_tasks)
    
    # 去重 + 合并
    return deduplicate_merge(results)
```

### 3.3 分块策略（Chunking）

```python
# 策略1：固定大小分块（最常用）
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,       # 每块 Token 数（~500 token ≈ 2000 字符）
    chunk_overlap=50,      # 块之间重叠，避免上下文断裂
    separators=["\n\n", "\n", ". ", " ", ""]
)

# 策略2：语义分块（按句子/段落自然断点）
from langchain_experimental.text_splitter import SemanticChunker

chunker = SemanticChunker(
    embeddings=embeddings,
    breakpoint_threshold_amount=0.95  # 相似度突变时断点
)
docs = chunker.create_documents([full_text])

# 策略3：层次分块（保留层级结构）
def hierarchical_chunking(document: dict, max_chunk_size=500) -> list[dict]:
    """
    文档结构：[Title, Sections[Paragraphs[Sentences]]]
    保留章/节/段落的层级关系
    """
    chunks = []
    for section in document["sections"]:
        current = {"title": section["title"], "content": ""}
        for para in section["paragraphs"]:
            if len(current["content"]) + len(para) > max_chunk_size:
                chunks.append(current)
                current = {"title": section["title"], "content": ""}
            current["content"] += para + " "
        if current["content"]:
            chunks.append(current)
    return chunks
```

### 3.4 RAG 评估：RAGAs

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,          # 答案是否忠实于检索到的文档
    answer_relevancy,      # 答案与问题的相关性
    context_relevancy,     # 检索到的文档是否相关
    context_precision,     # 相关文档的排名是否正确
    context_recall         # 是否检索到所有必要信息
)

# 评估数据集
test_dataset = [
    {
        "user_input": "公司的带薪年假政策是什么？",
        "retrieved_contexts": [doc1.content, doc2.content],
        "response": "根据公司政策，员工入职满一年后每年享有5天带薪年假...",
        "reference": "员工手册规定..."
    }
]

# 执行评估
result = evaluate(
    test_dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_relevancy,
        context_precision,
        context_recall
    ]
)

print(result)
# {
#   'faithfulness': 0.89,
#   'answer_relevancy': 0.92,
#   'context_relevancy': 0.78,
#   'context_precision': 0.85,
#   'context_recall': 0.81
# }
# context_relevancy 低 → 需要优化检索策略
```

## 四、Fine-tuning 深度指南

### 4.1 什么时候 Fine-tuning 比 RAG 更合适？

```python
# 典型 Fine-tuning 场景

# 场景1：需要模型内化某种行为模式
# 例如：客服对话风格、代码审查习惯、某种专业判断逻辑
# Prompt Engineering 难以做到持续稳定 → Fine-tuning

# 场景2：提示词已经过长（> 2000 tokens）
# 例如：一个复杂的 agent 系统有 50+ 条指令
# 每次调用都要塞入上下文 → Token 成本高 + 注意力分散
# → Fine-tuning 内化指令，推理时只输入用户问题

# 场景3：需要在特定领域做到极高准确性
# 例如：金融报告分析、医疗影像描述、法律文书审查
# RAG 只能提供知识，但"判断逻辑"需要 Fine-tuning

# 场景4：规模化部署，减少 Token 消耗
# 例如：每天 100 万次 API 调用
# 每次调用减少 1000 tokens → 每天节省 $100（按 $0.03/1K tokens）
```

### 4.2 LoRA：参数高效微调的核心

LoRA（Low-Rank Adaptation）通过在预训练权重旁边添加低秩矩阵来学习任务特定的适配，冻结原模型权重：

```python
from peft import LoraConfig, get_peft_model, TaskType

# LoRA 核心配置
lora_config = LoraConfig(
    r=16,                              # 秩，越大越接近全参数微调效果，越慢
    lora_alpha=32,                     # 学习率缩放因子（通常 = 2 * r）
    target_modules=[                   # 要替换的模块
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj"       # FFN
    ],
    lora_dropout=0.05,
    bias="none",                       # 不训练 bias
    task_type=TaskType.CAUSAL_LM
)

# 应用 LoRA 到基础模型
model = get_peft_model(gpt_model, lora_config)
model.print_trainable_parameters()
# trainable params: 4,194,304 || all params: 6,738,415,616 || trainable%: 0.0622
# ~0.06% 可训练参数（从 6.7B 降到 4M）
```

```python
# 训练配置
training_args = TrainingArguments(
    output_dir="./lora_output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,       # 等效 batch_size = 4 * 4 = 16
    learning_rate=2e-4,
    warmup_ratio=0.1,
    logging_steps=10,
    save_steps=100,
    fp16=True,                           # 混合精度，节省显存
    optim="paged_adamw_8bit",            # 量化 AdamW，省 60% 显存
    lr_scheduler_type="cosine",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
)

trainer.train()

# 合并 LoRA 权重（用于推理）
merged_model = model.merge_and_unload()
merged_model.save_pretrained("./merged_model")
```

### 4.3 QLoRA：消费级 GPU 微调 7B 模型

QLoRA（Quantized LoRA）在 LoRA 基础上对基础模型做 4-bit 量化，显著降低显存需求：

```python
# 4-bit NF4 量化基础模型
from transformers import BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",       # Normal Float 4-bit
    bnb_4bit_use_double_quant=True    # 双重量化，进一步省显存
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-8b",
    quantization_config=quantization_config,
    device_map="auto"
)
# 7B 模型显存需求：~6GB（4-bit）vs ~16GB（16-bit）
# 配合 LoRA：可在 12GB 显存的 3090 上微调 7B 模型

# 之后加载 LoRA 并训练（同 LoRA 配置）
model = get_peft_model(model, lora_config)
```

### 4.4 数据准备：微调质量的决定因素

```python
# 微调数据格式（对话格式）
training_data = [
    {
        "messages": [
            {"role": "system", "content": "你是一个专业的代码审查助手。"},
            {"role": "user", "content": "审查这段 Python 代码：\n\ndef compute(x, y):\n    return x / y"},
            {"role": "assistant", "content": "发现一个问题：\n\n1. **除零风险**：`y` 未做非零校验，当 `y=0` 时会抛出 `ZeroDivisionError`\n\n建议修改：\n```python\ndef compute(x, y):\n    if y == 0:\n        raise ValueError('y cannot be zero')\n    return x / y\n```"}
        ]
    },
    # ... 更多高质量示例（建议 >= 500 条）
]

# 数据质量检查
def validate_training_data(data: list) -> dict:
    issues = []
    for i, item in enumerate(data):
        messages = item["messages"]
        
        # 检查格式
        if len(messages) < 2:
            issues.append(f"[{i}] 消息少于 2 条")
        if messages[0]["role"] not in ["system", "user"]:
            issues.append(f"[{i}] 第一条消息必须是 system 或 user")
        if messages[-1]["role"] != "assistant":
            issues.append(f"[{i}] 最后一条消息必须是 assistant")
        
        # 检查内容质量
        for msg in messages:
            if len(msg["content"]) < 10:
                issues.append(f"[{i}] 消息内容过短（< 10 字符）")
            if msg["content"].strip() == "":
                issues.append(f"[{i}] 消息内容为空")
    
    return {"total": len(data), "issues": issues, "quality_score": 1 - len(issues) / (len(data) * 3)}
```

### 4.5 灾难性遗忘与缓解

```python
# 灾难性遗忘：微调后模型在通用能力上退化
# 例如：微调后模型不会做数学题了

# 缓解策略1：保留数据（Replay）
# 在训练数据中加入通用能力样本（占比 10-20%）
mixed_data = training_data + general_capability_samples

# 缓解策略2：增量微调（Incremental Fine-tuning）
# 不全量训练，只在最新数据上小幅度调整
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-6)  # 更小的学习率

# 缓解策略3：Elastic Weight Consolidation (EWC)
# 保护重要权重不被大幅修改
# from peft import EWCConfig
# ewc_config = EWCConfig(penalty=5000, ...)  # 对偏离原权重的更新加惩罚

# 缓解策略4：RLHF（最彻底，但最复杂）
# 用人类反馈微调，在Reward中加入通用能力指标
```

## 五、三者组合：最强大的方案

### 5.1 RAG + Fine-tuning 的经典组合

```python
# 场景：法律 AI 助手
# 1. Fine-tuning：内化法律文书写作风格、推理逻辑
# 2. RAG：提供具体法条引用、知识溯源

async def legal_assistant(question: str):
    # Step 1: RAG 检索相关法条（知识）
    relevant_laws = await law_vector_db.similarity_search(question, top_k=5)
    
    # Step 2: 构建增强提示
    prompt = f"""
    你是资深法律顾问，擅长根据中国《民法典》分析法律问题。
    
    参考法条：
    {format_laws(relevant_laws)}
    
    用户问题：{question}
    
    分析步骤：
    1. 识别法律关系
    2. 引用相关法条
    3. 给出分析意见
    """
    
    # Step 3: Fine-tuned 模型推理（风格稳定、逻辑严谨）
    # 模型内化了"法律顾问"的思维模式
    answer = await fine_tuned_llm.complete(prompt, relevant_laws)
    
    return {
        "answer": answer,
        "sources": [law.metadata for law in relevant_laws]
    }
```

### 5.2 Prompt Engineering + RAG + Fine-tuning 三层架构

```python
class ThreeLayerAI:
    """三层架构：每层各司其职"""
    
    def __init__(self, llm, vector_db, fine_tuned_llm):
        self.llm = llm                          # 通用推理
        self.vector_db = vector_db               # 知识检索
        self.fine_tuned = fine_tuned_llm        # 专业行为
    
    async def query(self, question: str) -> str:
        # 层1：Prompt Engineering 做意图路由
        intent = await self.llm.complete(
            f"判断这个问题是否涉及专业知识（法律/医疗/金融/技术文档）：{question}"
            "\n回答：仅回答'专业'或'通用'"
        )
        
        if "专业" in intent:
            # 层2：RAG 注入专业知识
            docs = await self.vector_db.search(question)
            context = format_docs(docs)
            
            # 层3：Fine-tuned 模型内化专业行为
            return await self.fine_tuned.complete(
                system="你是一个严格遵循专业知识的专业人士。",
                context=context,
                question=question
            )
        else:
            # 通用问题：直接用基础模型 + Prompt Engineering
            return await self.llm.complete(
                self.build_best_prompt(question)
            )
```

## 六、实战：从零搭建选型决策系统

### 6.1 自动选型推荐器

```python
from dataclasses import dataclass
from enum import Enum

class Approach(str, Enum):
    PROMPT = "prompt_engineering"
    RAG = "rag"
    FINETUNE = "fine_tuning"
    RAG_FINETUNE = "rag_plus_fine_tuning"

@dataclass
class TaskProfile:
    task_type: str              # "qa" | "summarization" | "code_gen" | "chat"
    knowledge_scope: str        # "closed" | "dynamic" | "large_scale"
    stability_needed: float     # 0-1，稳定输出需求
    latency_budget: str         # "low" | "medium" | "high"
    token_budget: str           # "low" | "medium" | "high"
    data_available: int        # 可用标注数据条数
    has_gpu: bool
    iteration_speed: str        # "fast" | "medium" | "slow"

def recommend_approach(profile: TaskProfile) -> tuple[Approach, str]:
    """自动推荐最佳方案"""
    
    # 判断链路
    if profile.knowledge_scope == "dynamic":
        # 知识动态更新 → 必须 RAG
        if profile.data_available >= 500 and profile.has_gpu:
            return Approach.RAG_FINETUNE, (
                "知识动态变化且有充足数据 → RAG（知识）+ Fine-tuning（行为）"
            )
        return Approach.RAG, "知识需要实时更新 → RAG"
    
    if profile.stability_needed >= 0.8 and profile.data_available >= 500:
        # 需要高稳定性 + 有数据 → Fine-tuning
        return Approach.FINETUNE, "高稳定性需求 + 充足标注数据 → Fine-tuning"
    
    if profile.task_type in ["qa", "summarization"] and profile.knowledge_scope == "large_scale":
        # 大规模知识问答 → RAG
        return Approach.RAG, "大规模知识库问答 → RAG"
    
    if profile.latency_budget == "low" and profile.token_budget == "low":
        # 追求低延迟低 Token → Fine-tuning（内化指令，减少 Token）
        if profile.data_available >= 500:
            return Approach.FINETUNE, "低延迟 + 低 Token 需求 + 有数据 → Fine-tuning"
    
    return Approach.PROMPT, "简单任务 → Prompt Engineering（快速验证）"

# 使用示例
profile = TaskProfile(
    task_type="chat",
    knowledge_scope="closed",        # 封闭域，不需要外部知识
    stability_needed=0.85,            # 需要非常稳定的回复风格
    latency_budget="medium",
    token_budget="low",              # 不想每次都输入长提示词
    data_available=1000,             # 有 1000 条对话数据
    has_gpu=True,
    iteration_speed="medium"
)

approach, reason = recommend_approach(profile)
print(f"推荐方案: {approach.value}")
print(f"原因: {reason}")
# 输出：推荐方案: fine_tuning
# 原因：高稳定性需求 + 充足标注数据 → Fine-tuning
```

### 6.2 渐进式实施路线图

```
Week 1-2: Prompt Engineering 验证
  └→ 快速验证任务可行性，评估模型能力上限
  └→ 如果 Prompt Engineering 能满足需求 → 停止，直接上线
  └→ 如果不稳定/知识不够 → 进入下一阶段

Week 3-4: RAG 实施
  └→ 搭建向量数据库，配置检索管道
  └→ 评估检索质量（召回率/精确率）
  └→ 如果准确性满足 → 上线 RAG
  └→ 如果行为仍不稳定（如格式不对、推理逻辑差）→ 进入 Fine-tuning

Week 5-8: Fine-tuning（如需要）
  └→ 准备数据（清洗、标注、增强）
  └→ 选择 PEFT 方法（LoRA/QLoRA）
  └→ 训练 + 评估 + 迭代
  └→ 合并权重，部署推理服务

Week 9+: 持续优化
  └→ RAG 知识库持续更新
  └→ Fine-tuning 模型定期重训
  └→ 监控质量指标，持续迭代
```

## 七、常见误区与避坑指南

### 7.1 过度工程化

```python
# ❌ 误区：什么都上 Fine-tuning
# 场景：客服系统需要回复"您好，请问有什么可以帮助您？"
# Fine-tuning 需要 500+ 条数据，GPU 训练 3 天
# 实际：一个 Prompt Engineering 就够了

# ✅ 正确评估
if len(unique_patterns) < 10 and pattern_stable_with_prompt:
    return "Prompt Engineering 即可，无需 Fine-tuning"

# ❌ 误区：RAG 就是简单的向量相似度搜索
# 实际：检索质量决定 RAG 上限，需要 Query 改写、混合检索、重排等优化
```

### 7.2 数据质量

```python
# ❌ 误区：Fine-tuning 数据越多越好
# 实际：质量 >> 数量
# 100 条高质量样本 >> 1000 条低质量样本

# ✅ 高质量数据标准
def is_good_training_example(messages: list) -> bool:
    # 1. 格式正确
    if messages[0]["role"] not in ["system", "user"]: return False
    if messages[-1]["role"] != "assistant": return False
    
    # 2. 有意义的内容（不是模板填充）
    assistant_content = messages[-1]["content"]
    if len(assistant_content) < 50: return False
    
    # 3. 错误示范不进入训练集
    if any(keyword in assistant_content for keyword in ["不确定", "不知道", "抱歉"]):
        return False  # 不确定性回答不适合作为微调目标
    
    # 4. 格式一致（如果任务是结构化输出，所有样本应该格式统一）
    if task_requires_format:
        if not is_consistent_format(assistant_content): return False
    
    return True
```

### 7.3 评估缺失

```python
# ❌ 误区：上线后在生产环境测试
# 实际：必须先在离线数据集上评估

# ✅ 评估指标体系
EVALUATION_FRAMEWORK = {
    "Prompt Engineering": {
        "primary": ["任务准确率", "格式正确率"],
        "secondary": ["Token 消耗", "延迟"],
        "method": "人工评估 + 自动指标"
    },
    "RAG": {
        "primary": ["答案忠实度(RAGAs)", "召回率"],
        "secondary": ["检索精确率", "延迟"],
        "method": "RAGAs + 人工抽检"
    },
    "Fine-tuning": {
        "primary": ["Loss 曲线", "验证集准确率"],
        "secondary": ["灾难性遗忘测试", "通用能力保留率"],
        "method": "内置评估集 + 通用能力基准（GSM8K/MMLU）"
    }
}
```

## 八、总结：选型决策速查表

```
┌─────────────────────────────────────────────────────────────────────┐
│                          选型速查表                                 │
├─────────────────┬──────────────────┬──────────────────────────────┤
│     问题         │      方案         │         关键指标              │
├─────────────────┼──────────────────┼──────────────────────────────┤
│ 输出不稳定        │ Prompt Engineering │ Few-shot 准确率             │
│ 幻觉/知识缺失     │ RAG              │ RAGAs faithfulness > 0.85   │
│ 风格/行为不内化   │ Fine-tuning      │ 任务准确率 > 95%             │
│ 提示词太长        │ Fine-tuning      │ 压缩率 > 50%                 │
│ 实时数据需求      │ RAG              │ 检索召回率 > 90%             │
│ 成本敏感         │ Prompt → Finetune │ Token 节省 vs 训练成本      │
│ 需要溯源         │ RAG              │ 引用准确率 > 95%             │
│ 快速验证         │ Prompt Engineering │ 天级上线                    │
│ 高质量规模化      │ Fine-tuning      │ 批量推理 QPS                 │
└─────────────────┴──────────────────┴──────────────────────────────┘

三者组合：RAG + Fine-tuning + Prompt Engineering = 最强方案
- RAG：提供动态知识
- Fine-tuning：内化专业行为
- Prompt Engineering：处理边界case、快速迭代
```

**记住这三个原则：**

1. **先 Prompt，再 RAG，最后 Fine-tuning**：每次复杂度升级前问自己——简单方法是否真的不够？
2. **数据决定上限，不是模型**：Fine-tuning 的质量 90% 取决于数据，10% 取决于超参
3. **评估先行**：没有量化指标就无法迭代，评估是整个系统的指南针

*本文由小虾子 🦐 撰写*
