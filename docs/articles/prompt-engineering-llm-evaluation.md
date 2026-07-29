---
title: Prompt Engineering & LLM Evaluation 完全指南：从软技巧到工程实践
date: 2026-07-29
---

# Prompt Engineering & LLM Evaluation 完全指南：从软技巧到工程实践

> Prompt 是你和 LLM 之间的接口——写得好，GPT-4o 也只是你的工具；写得烂，再强的模型也会跑偏。但光有好 Prompt 不够，还需要评估体系来量化改进：RAG 答案质量怎么打分？幻觉率怎么测？多版本 Prompt 怎么 A/B 对比？本文系统覆盖 Prompt Engineering 核心技巧（CoT / ToT / ReAct / Few-Shot / 结构化输出）和 LLM Evaluation 工程实践（RAGAS / LangSmith / Golden Data），是你构建 AI 产品的完整方法论。

本文由小虾子 🦐 撰写

## 为什么 Prompt Engineering 重要？

```
Prompt 质量 vs 模型能力 的关系：
─────────────────────────────────────────────────────
模型弱 + Prompt 差 → ❌ 完全不可用
模型弱 + Prompt 好 → ⚠️ 勉强可用，有上限
模型强 + Prompt 差 → ⚠️ 表现不稳定，容易跑偏
模型强 + Prompt 好 → ✅ ✅ 最佳状态

核心观点：
• 同样的模型，Prompt 好坏可以让效果差 30-50%
• Prompt 优化是最快、成本最低的"模型升级"
• Prompt 是产品，不是调试工具
• 好的 Prompt = 角色 + 上下文 + 任务 + 格式 + 约束
─────────────────────────────────────────────────────
```

---

## Prompt 基础结构

### CRISPER 框架

```
Prompt = Context + Role + Instruction + Steps + Examples + Response format
─────────────────────────────────────────────────────
C (Context)    背景信息：为 LLM 提供必要的上下文
R (Role)       角色：让 LLM 进入专家心态
I (Instruction) 指令：明确告诉它做什么（动词开头）
S (Steps)       步骤：将复杂任务分解成步骤
E (Examples)    示例：用 Few-Shot 演示期望输出
P (Parameters) 参数：温度 / top_p / 最大 token
R (Response)    响应格式：JSON / Markdown / 纯文本
─────────────────────────────────────────────────────
```

### 完整 Prompt 示例

```python
from openai import OpenAI

client = OpenAI()

# ===== 完整 Prompt =====
prompt = """
# 上下文
我们是一家提供电商技术咨询的公司，客户是中小型电商团队。

# 角色
你是一个资深电商架构师，有 10 年经验，熟悉微服务、高并发、数据库优化。

# 任务
请分析以下系统架构存在的问题，并给出改进建议。

# 约束
- 每个问题用一句话描述
- 按严重程度排序（高/中/低）
- 每个问题给出具体的解决方案
- 回答限制在 500 字以内

# 输出格式
```json
{
  "problems": [
    {
      "severity": "高",
      "description": "问题描述",
      "solution": "解决方案"
    }
  ]
}
```

# 输入
{architecture_description}
"""

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt.format(
        architecture_description="单节点 MySQL，前端 Vue，后端 Django，单体架构..."
    )}],
    temperature=0.3,      # 低温度，更稳定的输出
    response_format={"type": "json_object"},
)

import json
result = json.loads(response.choices[0].message.content)
print(json.dumps(result, indent=2, ensure_ascii=False))
```

---

## Chain-of-Thought（CoT）推理链

### 零样本 CoT

```python
# ===== Zero-shot CoT：简单指令触发推理 =====
prompt = """
请逐步推理以下问题：

问题：小明有 5 个苹果，小红给了他 3 个，小明吃掉了 2 个。小明现在有多少个苹果？

让我们一步步思考：
"""

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.3,
)
print(response.choices[0].message.content)
# 小明有 5 个苹果
# 小红给了 3 个 → 5 + 3 = 8 个
# 吃掉了 2 个 → 8 - 2 = 6 个
# 答案：6 个
```

### Few-shot CoT

```python
# ===== Few-shot CoT：提供示例演示推理过程 =====
cot_prompt = """
请像示例一样逐步推理。

示例 1：
问题：小张有 10 块钱，买了 3 本书，每本 2 元。小张还剩多少钱？
推理：10 - (3 × 2) = 10 - 6 = 4 元
答案：4 元

示例 2：
问题：一辆汽车每小时行驶 60 公里，行驶 2.5 小时后，还剩 50 公里到达目的地。总路程是多少？
推理：已行驶 = 60 × 2.5 = 150 公里；总路程 = 150 + 50 = 200 公里
答案：200 公里

示例 3：
问题：{question}
推理：
"""

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": cot_prompt.format(
        question="一个水池每小时注入 100 升水，同时每小时流出 80 升。2 小时后水池有多少水？初始有 200 升。"
    )}],
    temperature=0.3,
)
print(response.choices[0].message.content)
# 注入 = 100 × 2 = 200 升
# 流出 = 80 × 2 = 160 升
# 净增加 = 200 - 160 = 40 升
# 最终 = 200 + 40 = 240 升
# 答案：240 升
```

### Self-Consistency（自洽性）

```python
# ===== 自洽性：多次采样 + 投票 =====
import json
from collections import Counter

def self_consistency(prompt, n_samples=5, temperature=0.7):
    """
    多次采样，统计最一致的答案
    核心思想：复杂问题没有唯一正确答案，
    但合理的推理路径应该指向同一个答案
    """
    answers = []
    reasoning_chains = []

    for i in range(n_samples):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        content = response.choices[0].message.content

        # 提取推理链和最终答案
        # （实际应用中用 LLM 提取，或正则匹配）
        lines = content.strip().split('\n')
        reasoning = '\n'.join(lines[:-1])  # 除了最后一行都是推理
        answer = lines[-1] if lines else content  # 最后一行是答案

        answers.append(answer)
        reasoning_chains.append(reasoning)

    # 投票：最常见的答案
    counter = Counter(answers)
    most_common = counter.most_common(1)[0]

    return {
        "final_answer": most_common[0],
        "vote_count": most_common[1],
        "total_samples": n_samples,
        "confidence": most_common[1] / n_samples,
        "all_answers": dict(counter),
        "reasoning_chains": reasoning_chains,
    }

# 使用
result = self_consistency(
    prompt="一个商店周一是100元，周二涨了10%，周三又跌了10%。周三结束时是多少钱？",
    n_samples=10,
)
print(f"最终答案：{result['final_answer']}")
print(f"置信度：{result['confidence']:.0%}")
print(f"投票分布：{result['all_answers']}")
```

---

## Tree-of-Thought（ToT）思维树

```python
# ===== ToT：探索多条推理路径 =====
from typing import TypedDict, List
import json

class ThoughtState(TypedDict):
    thoughts: List[str]
    value: str
    solutions: List[str]

def tree_of_thought(
    question: str,
    num_thoughts: int = 3,
    max_depth: int = 3,
) -> dict:
    """
    ToT 核心思想：
    不是线性推理，而是像树一样探索多条路径，
    每条路径评估后选择最优继续
    """

    current_thoughts = []

    for depth in range(max_depth):
        if depth == 0:
            # 第一层：生成初始思路
            prompt = f"""
问题：{question}

请生成 {num_thoughts} 种不同的思考方向/策略。
每种策略用一句话描述思考角度。

输出 JSON：
{{"thoughts": ["策略1", "策略2", "策略3"]}}
"""
        else:
            # 后续层：基于当前路径扩展
            thoughts_str = "\n".join([f"- {t}" for t in current_thoughts])
            prompt = f"""
当前已探索的路径：
{thoughts_str}

请为每条路径继续深入思考，给出下一步推理。
如果某条路径已得出确定答案，标注"完成：答案"。
如果某条路径走入死胡同，标注"放弃"。

输出 JSON：
{{"thoughts": ["路径1继续：...", "完成：答案", "放弃"]}}
"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )

        new_thoughts = json.loads(response.choices[0].message.content)["thoughts"]

        # 过滤已完成的和放弃的
        active_thoughts = []
        solutions = []
        for t in new_thoughts:
            if t.startswith("完成："):
                solutions.append(t[3:])
            elif not t.startswith("放弃"):
                active_thoughts.append(t)

        current_thoughts = active_thoughts

        if solutions:
            break

    return {
        "solutions": solutions,
        "remaining_paths": current_thoughts,
        "depth_reached": depth + 1,
    }

# 示例：数学优化问题
result = tree_of_thought(
    question="如何在一小时内完成：做饭、健身、洗澡、学习？"
)
print(f"解决方案：{result['solutions']}")
```

---

## ReAct：推理 + 行动

```python
# ===== ReAct = Reasoning + Acting =====
# 核心思想：LLM 交替进行"推理"和"行动"，
# 推理决定下一步行动，行动获取新信息，循环直到得出答案

import re
from typing import List, Tuple

class ReActAgent:
    def __init__(self, tools: dict):
        self.tools = tools
        self.max_steps = 10

    def run(self, question: str) -> str:
        steps = []
        observations = []

        prompt = f"""
你是一个 ReAct Agent，需要通过推理和行动来回答问题。

可用的工具：
{self._format_tools()}

输出格式（每一步）：
Thought: [你的推理]
Action: [工具名] 或 "finish"
Action_Input: [工具参数] 或 [最终答案]

开始！
"""

        context = prompt
        for _ in range(self.max_steps):
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "你是一个严谨的推理 Agent。"},
                    {"role": "user", "content": context},
                ],
                temperature=0.3,
            )

            text = response.choices[0].message.content
            context += f"\n\n{text}"

            # 解析下一步行动
            action = self._parse_action(text)

            if action["type"] == "finish":
                return action["input"]

            # 执行工具
            if action["type"] in self.tools:
                observation = self.tools[action["type"]](action["input"])
                context += f"\nObservation: {observation}"
                observations.append(observation)
            else:
                context += f"\nObservation: 未知工具：{action['type']}"

            steps.append(text)

        return f"达到最大步数 {self.max_steps}，未得出答案"

    def _format_tools(self) -> str:
        return "\n".join([f"- {name}: {desc}" for name, (_, desc) in self.tools.items()])

    def _parse_action(self, text: str) -> dict:
        thought = re.search(r"Thought:\s*(.+)", text)
        action = re.search(r"Action:\s*(\w+)", text)
        action_input = re.search(r"Action_Input:\s*(.+)", text)

        return {
            "thought": thought.group(1) if thought else "",
            "type": action.group(1) if action else "unknown",
            "input": action_input.group(1) if action_input else "",
        }

# ===== 定义工具 =====
def search(query: str) -> str:
    """搜索信息"""
    # 实际调用搜索 API
    return f"搜索结果：{query} 相关结果约 1000 万条..."

def calculate(expr: str) -> str:
    """计算数学表达式"""
    try:
        result = eval(expr)
        return str(result)
    except:
        return "计算错误"

def get_weather(city: str) -> str:
    """获取天气"""
    return f"{city}今天晴天，25°C"

tools = {
    "search": (search, "搜索网络信息"),
    "calculate": (calculate, "计算数学表达式"),
    "weather": (get_weather, "获取城市天气"),
}

# 使用
agent = ReActAgent(tools)
result = agent.run("北京今天天气如何？计算 25 + 37 的结果，然后搜索这个和。")
print(result)
```

---

## Few-Shot 高级技巧

### 动态 Few-Shot

```python
# ===== 根据输入动态选择示例 =====
from langchain_core.example_selectors import SemanticSimilarityExampleSelector
from langchain_openai import OpenAIEmbeddings
from langchain_core.prompts import FewShotPromptTemplate, PromptTemplate

examples = [
    {"input": "你好", "output": "你好！很高兴认识你。"},
    {"input": "你叫什么名字", "output": "我叫小虾子，是你的 AI 助手。"},
    {"input": "谢谢", "output": "不客气！有什么需要帮忙的？"},
    {"input": "再见", "output": "再见！祝你有美好的一天！"},
    {"input": "天气怎么样", "output": "我需要知道具体城市才能查天气，请告诉我哪个城市？"},
]

example_prompt = PromptTemplate(
    input_variables=["input", "output"],
    template="用户：{input}\n助手：{output}",
)

# 基于语义相似度选择示例
selector = SemanticSimilarityExampleSelector.from_examples(
    examples,
    OpenAIEmbeddings(),
    FAISS,  # 或 Chroma
    k=2,    # 选择最相似的 2 个示例
)

def dynamic_few_shot_prompt(user_input: str) -> str:
    selected = selector.select_examples({"query": user_input})

    prompt = FewShotPromptTemplate(
        examples=selected,
        example_prompt=example_prompt,
        suffix="用户：{input}\n助手：",
        input_variables=["input"],
    )

    return prompt.format(input=user_input)

# 使用
user_input = "我叫小明，很高兴见到你"
print(dynamic_few_shot_prompt(user_input))
# 自动选择最相关的示例（"你好"/"你叫什么名字"）
```

---

## 结构化输出

### Pydantic 模型约束

```python
# ===== Pydantic 模型 =====
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

class Person(BaseModel):
    name: str = Field(description="人名")
    age: int = Field(description="年龄", ge=0, le=150)
    email: Optional[str] = None
    skills: List[str] = Field(default_factory=list, max_length=10)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v and "@" not in v:
            raise ValueError("Invalid email format")
        return v

from openai import OpenAI

client = OpenAI()

# 使用 Pydantic 约束输出
completion = client.beta.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[{"role": "user", "content": "从以下文本中提取信息：张三，28岁，邮箱是 alice@example.com，擅长 Python、Go 和机器学习"}],
    response_format=Person,
)

person = completion.choices[0].message.parsed
print(person.name)        # 张三
print(person.age)         # 28
print(person.skills)      # ["Python", "Go", "机器学习"]
```

### 枚举约束

```python
from pydantic import BaseModel
from enum import Enum

class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class ReviewAnalysis(BaseModel):
    sentiment: Sentiment
    confidence: float = Field(ge=0.0, le=1.0)
    key_phrases: list[str] = Field(max_length=5)
    summary: str = Field(max_length=100)

completion = client.beta.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[{"role": "user", "content": "分析这个评论：产品非常好用，推荐购买！"}],
    response_format=ReviewAnalysis,
)

result = completion.choices[0].message.parsed
print(f"情感：{result.sentiment.value}")  # positive
print(f"置信度：{result.confidence}")     # 0.95
```

---

## LLM Evaluation：评估体系

### 为什么需要评估？

```
没有评估的 Prompt 优化 = 盲人摸象
─────────────────────────────────────────────────────
问题 1：主观判断不稳定
  "我觉得这个回答不错" → 换个时间/心情判断标准不同

问题 2：无法规模化
  100 个用例全靠人工看 → 成本高、速度慢、不一致

问题 3：无法回归检测
  改了一个 Prompt，其他用例的效果变差了 → 不知道

解决方案：
✅ 建立 Golden Dataset（标准答案数据集）
✅ 选择合适的评估指标（Accuracy / F1 / RAGAS / BLEU）
✅ 自动化评估流程（CI/CD 集成）
✅ 持续监控生产环境表现
─────────────────────────────────────────────────────
```

### Golden Dataset 构建

```python
# ===== Golden Dataset =====
from typing import TypedDict

class EvaluationSample(TypedDict):
    id: str
    input: str                    # 用户输入
    expected_output: str          # 期望输出（人工标注）
    context: str                   # 额外的上下文（如 RAG 的检索文档）
    metadata: dict                 # 标签：难度/类别/敏感度

golden_dataset = [
    EvaluationSample(
        id="q1",
        input="Python 中的 GIL 是什么？",
        expected_output="GIL（Global Interpreter Lock）是 Python 的一个机制，它确保任何时候只有一个线程执行 Python 字节码...",
        context="",
        metadata={"category": "technical", "difficulty": "intermediate"},
    ),
    EvaluationSample(
        id="q2",
        input="帮我写一个快速排序",
        expected_output="```python\ndef quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    ...\n```",
        context="",
        metadata={"category": "code", "language": "python"},
    ),
    EvaluationSample(
        id="q3",
        input="北京今天天气",
        expected_output="请问您想了解北京今天的具体天气情况（温度/湿度/风力等）？我可以为您联网查询。",
        context="",
        metadata={"category": "weather", "expected_behavior": "ask_clarification"},
    ),
]

# 评估函数
def evaluate_response(
    sample: EvaluationSample,
    actual_output: str,
) -> dict:
    """评估单个回答"""

    # 1. 精确匹配（Exact Match）
    exact_match = sample["expected_output"].strip() == actual_output.strip()

    # 2. 包含关键内容（Key Content Match）
    expected_keywords = set(sample["expected_output"].lower().split())
    actual_keywords = set(actual_output.lower().split())
    key_coverage = len(expected_keywords & actual_keywords) / len(expected_keywords)

    # 3. 长度合理性
    length_ratio = len(actual_output) / max(len(sample["expected_output"]), 1)
    length_ok = 0.5 <= length_ratio <= 2.0

    # 4. 格式检查（如果有）
    format_ok = True
    if "```" in sample["expected_output"]:
        format_ok = "```" in actual_output

    return {
        "sample_id": sample["id"],
        "exact_match": exact_match,
        "key_coverage": round(key_coverage, 3),
        "length_ok": length_ok,
        "format_ok": format_ok,
        "overall_pass": key_coverage >= 0.6 and length_ok,
    }
```

### RAGAS 评估框架

```python
# ===== RAGAS：RAG 系统专业评估 =====
"""
RAGAS 四大核心指标：
• Faithfulness（忠实度）：回答是否忠实于检索到的上下文？
• Answer Relevance（回答相关性）：回答是否切题地回答了问题？
• Context Precision（上下文精确度）：检索到的文档有多少是相关的？
• Context Recall（上下文召回率）：上下文是否包含所有必要的答案信息？
"""

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

# ===== 准备评估数据 =====
eval_data = [
    {
        "user_input": "Python GIL 是什么？",
        "retrieved_contexts": ["GIL 是 Python 的全局解释器锁...", "Python 使用引用计数..."],
        "response": "GIL（Global Interpreter Lock）是 Python 的一个机制...",
        "reference": "GIL 是 Python 的全局解释器锁，确保同一时刻只有一个线程执行 Python 字节码...",
    },
    {
        "user_input": "快速排序怎么做？",
        "retrieved_contexts": ["快速排序使用分治策略...", "选择基准值 pivot..."],
        "response": "def quick_sort(arr):...",
        "reference": "快速排序：1.选择基准 2.分区 3.递归排序左右部分",
    },
]

dataset = Dataset.from_list(eval_data)

# ===== 运行评估 =====
score = evaluate(
    dataset,
    metrics=[
        faithfulness,       # 忠实度
        answer_relevancy,   # 回答相关性
        context_precision,  # 上下文精确度
        context_recall,    # 上下文召回率
    ],
)

# 打印结果
df = score.to_pandas()
print(df)

# 各维度得分：
# faithfulness: 0.85  → 85% 的内容忠实于上下文
# answer_relevancy: 0.92  → 回答相关性 92%
# context_precision: 0.88  → 88% 的检索内容相关
# context_recall: 0.90    → 90% 的必要信息被检索到
```

### LangSmith 监控

```python
# ===== LangSmith：生产环境追踪 =====
import os
from langsmith import traceable
from langsmith.client import Client

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-app-production"

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

model = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}。"),
    ("user", "{question}"),
])
chain = prompt | model

# ===== traceable 追踪 =====
@traceable(
    project_name="my-app",
    tags=["production", "user-facing"],
    metadata={"version": "2.1.0"},
)
def my_ai_feature(question: str, role: str = "助手") -> str:
    return chain.invoke({"question": question, "role": role})

# 使用：自动追踪每次调用
result = my_ai_feature("Python 的特点是什么？", role="Python 讲师")

# ===== 在 LangSmith Dashboard 查看 =====
# - 每次调用的输入/输出/延迟/token 消耗
# - 追溯完整的 Chain 执行路径
# - 标记和收藏特定调用
# - 统计各指标趋势（延迟、token、错误率）
```

### A/B 测试 Prompt

```python
# ===== Prompt A/B 测试 =====
import hashlib
from collections import defaultdict
import time

class PromptABTest:
    def __init__(self, experiment_name: str):
        self.experiment_name = experiment_name
        self.results = defaultdict(list)
        self.client = Client()

    def get_variant(self, user_id: str) -> str:
        """根据用户 ID 分配变体（一致性：同一用户始终看到同一变体）"""
        hash_val = int(hashlib.md5(f"{user_id}:{self.experiment_name}".encode()).hexdigest(), 16)
        return "A" if hash_val % 2 == 0 else "B"

    def run(
        self,
        user_id: str,
        prompt_variant: str,
        question: str,
        expected: str,
    ) -> dict:
        start = time.time()

        if prompt_variant == "A":
            prompt = f"简洁回答：{question}"
        else:
            prompt = f"你是一个专业助手。请详细且准确地回答：{question}"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )

        latency = time.time() - start
        answer = response.choices[0].message.content

        # 计算指标
        score = self._calculate_score(answer, expected)

        record = {
            "user_id": user_id,
            "variant": prompt_variant,
            "latency": latency,
            "score": score,
            "answer_length": len(answer),
        }

        self.results[prompt_variant].append(record)
        return record

    def _calculate_score(self, answer: str, expected: str) -> float:
        """简单评分：关键词覆盖率"""
        expected_words = set(expected.lower().split())
        answer_words = set(answer.lower().split())
        return len(expected_words & answer_words) / max(len(expected_words), 1)

    def report(self) -> dict:
        """生成 A/B 测试报告"""
        report = {}
        for variant, records in self.results.items():
            scores = [r["score"] for r in records]
            report[variant] = {
                "n": len(records),
                "avg_score": sum(scores) / len(scores),
                "avg_latency": sum(r["latency"] for r in records) / len(records),
                "avg_length": sum(r["answer_length"] for r in records) / len(records),
            }
        return report

# 使用
ab_test = PromptABTest("prompt-v2-optimization")

for user_id, question, expected in golden_dataset:
    variant = ab_test.get_variant(user_id)
    ab_test.run(user_id, variant, question, expected)

print(ab_test.report())
# {'A': {'n': 50, 'avg_score': 0.82, 'avg_latency': 1.2},
#  'B': {'n': 50, 'avg_score': 0.87, 'avg_latency': 1.8}}
# 结论：B 变体得分更高（+6%），但延迟增加 50%，需权衡
```

---

## 幻觉检测与防护

```python
# ===== 幻觉检测 =====
from typing import List

class HallucinationDetector:
    def __init__(self, model):
        self.model = model

    def check(self, context: str, answer: str) -> dict:
        """
        检测回答是否在上下文中得到支持
        核心思想：用 LLM 自己来检测幻觉
        """

        prompt = f"""
你是一个幻觉检测专家。请判断回答是否忠实于给定的上下文。

上下文：
{context}

回答：
{answer}

请判断：
1. 回答中的每个陈述是否在上下文中直接支持？
2. 哪些陈述是上下文之外的（可能是模型编造的）？
3. 用 0-1 分评估忠实度（1=完全忠实，0=大量幻觉）

JSON 格式：
{{
  "faithfulness_score": 0.0-1.0,
  "unsupported_statements": ["陈述1", "陈述2"],
  "analysis": "分析说明"
}}
"""

        response = self.model.invoke(prompt)
        import json
        result = json.loads(response.content)
        return result

    def check_multi_source(self, answer: str, sources: List[str]) -> dict:
        """多源验证：多个来源交叉验证答案"""
        checks = []
        for source in sources:
            result = self.check(source, answer)
            checks.append(result)

        # 至少 2/3 来源支持才认为是可信的
        trustworthy = sum(1 for c in checks if c["faithfulness_score"] >= 0.7)
        is_trustworthy = trustworthy >= len(sources) * 0.67

        return {
            "is_trustworthy": is_trustworthy,
            "source_checks": checks,
            "support_rate": trustworthy / len(sources),
        }


# 使用
detector = HallucinationDetector(model)

doc1 = "Python 由 Guido van Rossum 于 1991 年创建。"
doc2 = "Python 是一种高级编程语言。"

result = detector.check_multi_source(
    answer="Python 由 Guido van Rossum 于 1991 年创建。",
    sources=[doc1, doc2],
)
print(f"可信度：{result['is_trustworthy']}")  # True
```

---

## 完整评估流水线

```python
# ===== 完整 LLM 评估流水线 =====
"""
评估流水线：
1. 准备 Golden Dataset
2. 批量运行模型生成答案
3. 计算各项指标
4. 生成报告
5. 触发告警（如果质量下降）
"""

from typing import List
import json

class LLM EvaluationPipeline:
    def __init__(
        self,
        model,
        golden_dataset: List[EvaluationSample],
        metrics: List[callable],
        alert_threshold: float = 0.8,
    ):
        self.model = model
        self.golden_dataset = golden_dataset
        self.metrics = metrics
        self.alert_threshold = alert_threshold

    def run(self) -> dict:
        results = []

        for sample in self.golden_dataset:
            # 生成回答
            output = self.model.invoke(sample["input"])

            # 评估
            eval_result = {
                "sample_id": sample["id"],
                "input": sample["input"],
                "output": output,
                "expected": sample["expected_output"],
            }

            for metric in self.metrics:
                eval_result[metric.__name__] = metric(sample, output)

            results.append(eval_result)

        # 汇总
        summary = self._summarize(results)

        # 告警
        if summary["overall_score"] < self.alert_threshold:
            self._send_alert(summary)

        return {
            "results": results,
            "summary": summary,
        }

    def _summarize(self, results: List[dict]) -> dict:
        """汇总指标"""
        metric_names = [k for k in results[0].keys()
                        if k not in ("sample_id", "input", "output", "expected")]

        summary = {}
        for name in metric_names:
            scores = [r[name] for r in results]
            summary[name] = {
                "avg": sum(scores) / len(scores),
                "min": min(scores),
                "max": max(scores),
                "count": len(scores),
            }

        # 整体得分
        summary["overall_score"] = sum(
            s["avg"] for s in summary.values()
        ) / len(summary)

        return summary

    def _send_alert(self, summary: dict):
        """发送告警"""
        print(f"⚠️ 告警：整体得分 {summary['overall_score']:.2%} 低于阈值 {self.alert_threshold:.2%}")
        # 实际可接入 Slack / 邮件通知


# 运行
pipeline = LLM EvaluationPipeline(
    model=my_chain,
    golden_dataset=golden_dataset,
    metrics=[evaluate_accuracy, evaluate_relevance, evaluate_conciseness],
    alert_threshold=0.85,
)

report = pipeline.run()
print(json.dumps(report["summary"], indent=2))
```

---

## 常见陷阱与最佳实践

### 陷阱 1：Prompt 越来越长

```python
# ❌ 陷阱：Prompt 不断追加变成 3000 字的怪物
prompt = """
你是一个助手...
（500字规则）
（又加了200字规则）
（再加300字例外情况）
（再加100字格式要求）
...（结果：Prompt 比输入还长）
"""

# ✅ 正确：定期重构 Prompt
# 1. 删除过时的规则
# 2. 用结构化（JSON/YAML）管理复杂规则
# 3. 原则：Prompt 应比输入短
# 4. 用 Few-Shot 代替长说明
```

### 陷阱 2：过度依赖 Few-Shot

```python
# ❌ 陷阱：塞入 20 个示例 → token 成本爆炸
few_shot_prompt = [
    Example("输入1", "输出1"),
    # ... 20 个
]

# ✅ 正确：动态选择 2-3 个最相关示例
# 见上文 SemanticSimilarityExampleSelector
```

### 陷阱 3：评估指标脱离业务

```python
# ❌ 陷阱：用 BLEU/ROUGE 评估对话系统
# BLEU 是机器翻译指标，不适合对话

# ✅ 正确：选择业务相关的评估指标
# 对话助手 → 人类偏好 / 任务完成率 / 情感准确率
# 客服机器人 → 答案准确率 / 解决率 / 客户满意度
# 代码助手 → 功能正确性 / 安全性 / 可读性
# RAG → RAGAS 四维指标
```

### 陷阱 4：没有回归测试

```python
# ❌ 陷阱：改 Prompt 后不测试旧用例
# "新版本效果好了，但旧用例全崩了"

# ✅ 正确：维护回归测试集
def regression_test(old_chain, new_chain, regression_dataset):
    """回归测试：确保新版本不破坏旧功能"""
    results = []
    for sample in regression_dataset:
        old_out = old_chain.invoke(sample["input"])
        new_out = new_chain.invoke(sample["input"])

        # 关键用例必须保持相同输出
        if sample.get("critical"):
            assert old_out == new_out, f"关键用例 {sample['id']} 输出不一致"

        results.append({
            "id": sample["id"],
            "changed": old_out != new_out,
        })

    return results
```

---

## 总结

```
Prompt Engineering 技巧速查：
─────────────────────────────────────────────────────
CoT (Chain-of-Thought)          逐步推理，适用于复杂问题
Zero-shot CoT                   "请逐步思考" 简单触发
Few-shot CoT                    提供推理示例演示
Self-Consistency               多次采样 + 投票
ToT (Tree-of-Thought)           多路径探索 + 评估
ReAct                          推理 + 行动交替
Dynamic Few-Shot               语义相似度动态选示例
结构化输出                     Pydantic / JSON Schema
─────────────────────────────────────────────────────
```

```
LLM Evaluation 指标速查：
─────────────────────────────────────────────────────
精确匹配（EM）                  输出完全一致
关键词覆盖（KF）                包含多少关键词
BLEU / ROUGE                   机器翻译/摘要（不适用于对话）
RAGAS Faithfulness             回答忠实于上下文
RAGAS Answer Relevance         回答相关性
RAGAS Context Precision        检索精确度
RAGAS Context Recall           检索召回率
人类偏好（A/B 测试）            哪个版本更好
幻觉率                         回答有多少在上下文中找不到
任务完成率                     用户意图被满足的比例
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ Prompt 结构化：Context + Role + Instruction + Format + Constraints
✅ CoT 先行：复杂问题先尝试 Zero-shot CoT
✅ Few-Shot 精选：2-3 个高质量示例胜过 20 个凑数示例
✅ 自洽性投票：关键决策用多次采样提高置信度
✅ 评估先于优化：没有指标衡量，优化就是盲人摸象
✅ Golden Dataset 要持续维护：新 case / 边界情况 / 用户投诉 case
✅ RAG 评估用 RAGAS：对症下药
✅ 生产监控用 LangSmith：追踪每次调用
✅ Prompt A/B 测试：数据驱动决策
✅ 回归测试：每次 Prompt 变更都跑全量测试集
✅ 幻觉检测：RAG 场景必须验证忠实度
✅ 评估指标对齐业务：不用 BLEU 评对话
✅ 告警机制：质量下降时自动通知
─────────────────────────────────────────────────────
```

Prompt Engineering 和 LLM Evaluation 是 AI 工程的左右手——一个优化输入，一个验证输出。没有评估的优化是盲目的，没有优化的评估是无意义的。掌握这套方法论，你的 AI 产品才能从"玄学调参"进化到"工程化迭代" 🦐

本文由小虾子 🦐 撰写
