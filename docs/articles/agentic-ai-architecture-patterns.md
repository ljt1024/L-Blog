# AI Agent 架构模式深度解析：从单体智能到多智能体协作系统

> 2024 年被称为"Agent 元年"，Claude 4、GPT-4o、Gemini 2 等模型的工具调用能力大幅提升，使得 AI Agent 从概念走向生产成为可能。但 Agent 的架构设计直接决定了系统的能力上限——是单步推理还是多步规划？是单体决策还是多智能体协作？本文将深入解析现代 AI Agent 的核心架构模式，帮助你构建真正可用的 Agent 系统。

## 一、从"模型"到"Agent"：架构演进之路

### 1.1 LLM 的能力边界

纯粹的大语言模型（LLM）在 Agent 场景下面临三大瓶颈：

```
┌─────────────────────────────────────────────────────────┐
│                    纯 LLM 的三大局限                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📌 知识时效性：训练数据有截止日期，无法获取实时信息       │
│                                                         │
│  📌 行动能力：只能输出文本，无法执行外部操作              │
│                                                         │
│  📌 状态持久性：每次请求独立，无跨会话记忆                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Agent 架构的本质，就是通过**外部组件**补足 LLM 的这三大短板：

```
                    ┌─────────────────┐
                    │   User Request   │
                    └────────┬──────────┘
                             ▼
                 ┌───────────────────────┐
                 │    Orchestrator /      │
                 │    Reasoning Engine     │
                 │  (ReAct / Plan-Execute)│
                 └────────────┬────────────┘
                              │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │   Memory    │   │   Tools     │   │   Action    │
   │   System    │   │   (Tools)   │   │   Executor  │
   └─────────────┘   └─────────────┘   └─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │  Vector DB  │   │  REST APIs  │   │  File I/O   │
   │  Sessions  │   │  Functions  │   │  Browser    │
   └─────────────┘   └─────────────┘   └─────────────┘
```

### 1.2 Agent 的定义与能力层次

根据 Anthropic 的定义，Agent 是"能够自主决策并执行多步骤任务的系统"。我们可以将其能力层次划分为：

```
Level 0: 纯文本生成（Basic LLM）
    ↓ 增加工具调用能力
Level 1: 工具增强型 Agent（Tool-Augmented）
    ↓ 增加规划与记忆能力
Level 2: 自主规划型 Agent（Autonomous Planner）
    ↓ 增加多步骤执行与自我修正
Level 3: 目标导向型 Agent（Goal-Oriented）
    ↓ 增加多智能体协作
Level 4: 多智能体协作系统（Multi-Agent System）
```

## 二、核心推理模式：ReAct、Plan-Execute 与 AutoGPT

### 2.1 ReAct（Reason + Act）

ReAct 是当前最流行的 Agent 推理框架，由 Google 在 2022 年提出。它的核心思想是让模型在每个步骤中同时进行**推理（Reason）**和**行动（Act）**，形成"思考→行动→观察→思考"的循环。

```python
# ReAct 循环的核心实现
from dataclasses import dataclass
from typing import List, Optional
import json

@dataclass
class ReActStep:
    thought: str      # 模型思考：为什么我要执行这个行动
    action: str       # 执行的具体行动
    action_input: dict  # 行动参数
    observation: str  # 行动结果（环境反馈）

class ReActAgent:
    """ReAct 模式的 Agent 实现"""

    def __init__(self, llm, tools: list, max_iterations: int = 10):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.max_iterations = max_iterations
        # ReAct 的少样本提示模板
        self.prompt_template = self._build_prompt_template()

    def _build_prompt_template(self) -> str:
        return """你是一个有帮助的 AI 助手。
你访问的工具：
{tool_descriptions}

按照以下格式逐步推理：
问题：你需要回答的输入问题
思考：你的推理过程
行动：你要执行的动作（从 [{tool_names}] 中选择）
行动输入：该动作的输入参数（JSON 格式）
观察：执行动作后的结果
...（思考/行动/行动输入/观察 可以重复多次）
思考：我现在知道最终答案了
最终答案：...

问题：{input}
"""

    def run(self, query: str) -> str:
        """执行 ReAct 推理循环"""
        steps: List[ReActStep] = []
        context = query
        final_answer = None

        for i in range(self.max_iterations):
            # 构建提示：包含历史步骤 + 工具描述
            prompt = self._build_prompt(
                query, steps, self._get_tool_descriptions()
            )

            # 调用 LLM 获取下一步行动
            response = self.llm.complete(prompt)

            # 解析 LLM 输出，提取 thought/action/observation
            step = self._parse_react_output(response, context)

            if step is None:
                break

            # 执行行动
            if step.action in self.tools:
                tool = self.tools[step.action]
                result = tool.execute(**step.action_input)
                step.observation = result
            else:
                step.observation = f"未知工具: {step.action}"

            steps.append(step)
            context += f"\n思考: {step.thought}\n行动: {step.action}\n观察: {step.observation}"

            # 检查是否得到最终答案
            if step.thought and "最终答案" in step.thought:
                final_answer = step.thought.split("最终答案：")[-1].strip()
                break

        return final_answer or self._summarize_steps(steps)

    def _parse_react_output(self, response: str, context: str) -> Optional[ReActStep]:
        """解析 LLM 输出为 ReAct 步骤"""
        lines = response.strip().split("\n")
        step = ReActStep(thought="", action="", action_input={}, observation="")

        current_field = None
        for line in lines:
            line = line.strip()
            if line.startswith("思考："):
                current_field = "thought"
                step.thought = line[3:]
            elif line.startswith("行动："):
                current_field = "action"
                step.action = line[3:].strip()
            elif line.startswith("行动输入："):
                current_field = "action_input"
                try:
                    json_str = line[5:].strip()
                    step.action_input = json.loads(json_str)
                except:
                    step.action_input = {}
            elif line.startswith("观察："):
                step.observation = line[3:].strip()

        return step if step.action else None
```

### 2.2 Plan-and-Execute（计划与执行分离）

ReAct 是"边想边做"，Plan-and-Execute 则是"想好再干"。它先将任务分解为多个子步骤，再依次执行。这种模式的优势在于：

1. **规划阶段**可以访问更多上下文，做出更优的全局规划
2. **执行阶段**可以专注于单个任务，不受其他步骤干扰
3. 更容易实现**中途修正**和**回滚**

```python
from typing import List, Callable, Any
from dataclasses import dataclass, field
from enum import Enum

class StepStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class ExecutionStep:
    id: int
    description: str
    tool_name: str
    parameters: dict
    status: StepStatus = StepStatus.PENDING
    result: Any = None
    error: str = None

@dataclass
class ExecutionPlan:
    goal: str
    steps: List[ExecutionStep] = field(default_factory=list)
    execution_summary: str = ""

class PlanAndExecuteAgent:
    """Plan-and-Execute 架构的 Agent"""

    def __init__(self, llm, tools: dict, executor=None):
        self.llm = llm
        self.tools = tools
        self.executor = executor  # 可注入不同的执行器

    async def execute(self, query: str) -> ExecutionPlan:
        # ===== Phase 1: 规划阶段 =====
        plan = await self._planning_phase(query)

        # ===== Phase 2: 执行阶段 =====
        for step in plan.steps:
            try:
                result = await self._execute_step(step)
                step.result = result
                step.status = StepStatus.COMPLETED

                # 执行后检查：是否需要修正后续计划
                should_replan = await self._evaluate_and_replan(
                    plan, step, result
                )
                if should_replan:
                    plan = await self._replan(query, plan)
                    break

            except Exception as e:
                step.status = StepStatus.FAILED
                step.error = str(e)

                # 失败处理：重试、跳过还是中止？
                decision = await self._handle_step_failure(step)
                if decision == "abort":
                    break
                elif decision == "skip":
                    step.status = StepStatus.SKIPPED

        return plan

    async def _planning_phase(self, query: str) -> ExecutionPlan:
        """LLM 生成执行计划"""
        planning_prompt = f"""作为任务规划专家，请将以下任务分解为清晰的执行步骤。

要求：
1. 每个步骤只做一件事
2. 步骤之间有明确的依赖关系
3. 步骤描述清晰，便于执行

任务：{query}

请按以下格式输出（JSON）：
{{
  "goal": "任务总目标",
  "steps": [
    {{"id": 1, "description": "步骤1描述", "tool": "工具名", "parameters": {{}}}},
    {{"id": 2, "description": "步骤2描述", "tool": "工具名", "parameters": {{}}}},
    ...
  ]
}}
"""
        response = self.llm.complete_json(planning_prompt)
        steps = [
            ExecutionStep(
                id=s["id"],
                description=s["description"],
                tool_name=s["tool"],
                parameters=s.get("parameters", {})
            )
            for s in response["steps"]
        ]
        return ExecutionPlan(goal=response["goal"], steps=steps)

    async def _execute_step(self, step: ExecutionStep) -> Any:
        """执行单个步骤"""
        if step.tool_name not in self.tools:
            raise ValueError(f"未知工具: {step.tool_name}")

        tool = self.tools[step.tool_name]
        return await tool.execute(**step.parameters)

    async def _evaluate_and_replan(
        self, plan: ExecutionPlan, completed_step: ExecutionStep, result: Any
    ) -> bool:
        """评估执行结果，决定是否需要修正计划"""
        evaluation_prompt = f"""评估步骤执行结果：

已完成步骤: {completed_step.description}
执行结果: {result}

后续步骤:
{chr(10).join([f"- {s.id}. {s.description}" for s in plan.steps if s.status == StepStatus.PENDING])}

基于执行结果，分析：
1. 已完成步骤的结果是否达到预期？
2. 是否需要调整后续步骤？
3. 是否出现了新的机会或风险？

返回 JSON: {{"replan": true/false, "reason": "原因"}}
"""
        response = self.llm.complete_json(evaluation_prompt)
        return response.get("replan", False)
```

### 2.3 两种模式的对比与选择

```
┌──────────────────────────────────────────────────────────────┐
│                    ReAct vs Plan-and-Execute                   │
├─────────────────────────┬────────────────────────────────────┤
│        ReAct            │         Plan-and-Execute            │
│     边想边做            │           想好再干                   │
├─────────────────────────┼────────────────────────────────────┤
│ ✅ 适合简单线性任务     │ ✅ 适合复杂多步骤任务                │
│ ✅ 响应速度快           │ ✅ 规划质量更高                      │
│ ✅ 更容易中途修正       │ ✅ 执行阶段专注                      │
│ ✅ 对 LLM 能力要求较低  │ ✅ 更容易实现回滚机制                │
├─────────────────────────┼────────────────────────────────────┤
│ ❌ 全局规划能力弱        │ ❌ 规划耗时较长                      │
│ ❌ 长序列任务容易漂移    │ ❌ 规划与执行脱节                    │
│ ❌ 中途修正成本高        │ ❌ 对 LLM 规划能力要求高             │
├─────────────────────────┴────────────────────────────────────┤
│                     推荐选择策略                               │
├──────────────────────────────────────────────────────────────┤
│  简单查询/单步任务 → ReAct                                   │
│  复杂项目/多步骤 → Plan-and-Execute                         │
│  混合场景 → Hierarchical（层级 Agent，上层规划，下层执行）   │
└──────────────────────────────────────────────────────────────┘
```

## 三、Tool Use 工具调用系统设计

工具调用是 Agent 与外部世界交互的核心通道。设计良好的工具系统需要考虑：工具注册、参数验证、结果解析、错误处理等多个维度。

### 3.1 工具定义规范

采用统一的工具定义规范，是构建可扩展工具系统的基础：

```typescript
// TypeScript 工具定义规范
interface ToolDefinition<TParameters = any, TResult = any> {
  // 工具唯一标识
  name: string;

  // 人类可读描述（LLM 主要依赖此字段决定是否调用）
  description: string;

  // 参数模式（JSON Schema）
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
    additionalProperties?: boolean;
  };

  // 执行函数
  handler: ToolHandler<TParameters, TResult>;

  // 元数据
  metadata?: {
    category: string;       // 工具分类：search, code, data, file, api
    version: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    examples?: Array<{
      description: string;
      parameters: TParameters;
      expectedResult: string;
    }>;
  };
}

// 工具参数模式
interface ToolParameterSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  default?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: ToolParameterSchema;  // array 类型时指定元素类型
  properties?: Record<string, ToolParameterSchema>;  // object 类型
  required?: string[];
}

// 工具处理器类型
type ToolHandler<TParams, TResult> = (
  params: TParams,
  context: ToolExecutionContext
) => Promise<TResult>;

interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  metadata: Record<string, any>;
  abortSignal?: AbortSignal;
}
```

### 3.2 工具注册与发现系统

```typescript
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  register(tool: ToolDefinition): void {
    // 参数校验
    this._validateTool(tool);

    this.tools.set(tool.name, tool);

    // 按分类索引
    const category = tool.metadata?.category || "uncategorized";
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(tool.name);
  }

  // 供 LLM 调用：获取所有工具列表
  getToolList(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return Array.from(this.tools.values())
      .filter(t => !t.metadata?.deprecated)
      .map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
  }

  // LLM 根据描述匹配合适工具
  async findToolsByDescription(query: string): Promise<ToolDefinition[]> {
    // 使用 embedding 相似度匹配
    const queryEmbedding = await embedText(query);
    const scores: Array<{ tool: ToolDefinition; score: number }> = [];

    for (const tool of this.tools.values()) {
      const descEmbedding = await embedText(tool.description);
      const score = cosineSimilarity(queryEmbedding, descEmbedding);
      scores.push({ tool, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score > 0.7)
      .map(s => s.tool);
  }

  // 解析 LLM 输出并执行工具
  async executeFromLLMOutput(
    llmOutput: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // 解析 JSON 参数（LLM 可能输出各种格式）
    const parsed = this._parseToolCall(llmOutput);
    const tool = this.tools.get(parsed.name);

    if (!tool) {
      return { success: false, error: `未知工具: ${parsed.name}` };
    }

    try {
      // 参数验证
      this._validateParameters(tool, parsed.parameters);
      const result = await tool.handler(parsed.parameters, context);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

### 3.3 实用工具实现示例

**搜索工具：**

```typescript
const searchTool: ToolDefinition<SearchParams, SearchResult> = {
  name: "web_search",
  description: `在互联网上搜索信息。当用户询问实时新闻、最新数据、
市场价格、天气预报等需要最新信息的问题时使用。
返回搜索结果列表，包含标题、URL 和摘要。`,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询语句，建议包含关键实体和信息类型"
      },
      num_results: {
        type: "number",
        description: "返回结果数量",
        default: 5,
        minimum: 1,
        maximum: 20
      }
    },
    required: ["query"]
  },
  metadata: {
    category: "search",
    version: "1.0.0",
    examples: [
      {
        description: "搜索今天天气",
        parameters: { query: "上海今天天气", num_results: 3 },
        expectedResult: "多云转晴，26-32°C"
      }
    ]
  },
  handler: async ({ query, num_results = 5 }, context) => {
    const response = await fetch(
      `https://api.search.example.com?q=${encodeURIComponent(query)}&n=${num_results}`,
      { signal: context.abortSignal }
    );
    const data = await response.json();
    return {
      results: data.items.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet
      })),
      total: data.total
    };
  }
};
```

**代码执行工具：**

```typescript
const codeExecutionTool: ToolDefinition<CodeParams, ExecutionResult> = {
  name: "execute_code",
  description: `在沙箱环境中执行 Python 或 JavaScript 代码。
适用于：数据分析、数学计算、文本处理、API 测试等。
注意：不支持文件 I/O、网络请求（需通过专用工具）和长时间运行任务。`,
  parameters: {
    type: "object",
    properties: {
      language: {
        type: "string",
        description: "代码语言",
        enum: ["python", "javascript", "bash"]
      },
      code: {
        type: "string",
        description: "要执行的代码"
      },
      timeout_ms: {
        type: "number",
        description: "超时时间（毫秒）",
        default: 30000,
        maximum: 60000
      }
    },
    required: ["language", "code"]
  },
  handler: async ({ language, code, timeout_ms = 30000 }, context) => {
    const response = await fetch("https://sandbox.example.com/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, timeout: timeout_ms }),
      signal: context.abortSignal
    });
    const result = await response.json();
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exit_code,
      executionTimeMs: result.execution_time_ms
    };
  }
};
```

## 四、Memory System 记忆系统

Agent 的记忆系统是实现"连续性"和"个性化"的关键。一个完整的记忆系统通常由三层构成：

```
┌─────────────────────────────────────────────────────┐
│              Agent Memory Architecture               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🧠 Working Memory (上下文窗口)                │  │
│  │  LLM 的注意力窗口，目前最大 ~128K tokens       │  │
│  │  存储：当前任务相关的对话、近期步骤、历史经验  │  │
│  │  淘汰策略：按重要性 + 时间衰减自动清理         │  │
│  └───────────────────────────────────────────────┘  │
│                        ▲                             │
│                        │ 提炼/归档                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  💾 Episodic Memory (情景记忆)                │  │
│  │  基于 Vector DB 存储历史交互片段               │  │
│  │  存储：会话历史、任务完成记录、错误经验        │  │
│  │  检索方式：语义相似度搜索（Embedding）         │  │
│  └───────────────────────────────────────────────┘  │
│                        ▲                             │
│                        │ 提炼/归档                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  📚 Semantic Memory (语义记忆)                │  │
│  │  长期知识存储：用户偏好、系统规则、专业领域    │  │
│  │  存储方式：结构化 DB + KG (知识图谱)          │  │
│  │  检索方式：精确查询 + 图遍历                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.1 记忆存储与检索实现

```python
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
from enum import Enum

class MemoryType(Enum):
    EPISODIC = "episodic"    # 会话片段
    SEMANTIC = "semantic"    # 语义知识
    PROCEDURAL = "procedural"  # 程序性知识（操作流程）
    WORKING = "working"      # 工作记忆

@dataclass
class Memory:
    id: str
    content: str
    memory_type: MemoryType
    embedding: List[float] = field(default_factory=list)
    importance: float = 0.5  # 0-1 重要性评分
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "content": self.content,
            "type": self.memory_type.value,
            "importance": self.importance,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata
        }

class MemorySystem:
    """三层记忆系统实现"""

    def __init__(
        self,
        vector_store,      # e.g. ChromaDB, Pinecone
        relational_db,     # e.g. PostgreSQL, SQLite
        embedding_model    # e.g. OpenAI embedding
    ):
        self.vector_store = vector_store
        self.relational_db = relational_db
        self.embedding_model = embedding_model

        # Working Memory：简单的内存字典
        self.working_memory: Dict[str, List[Memory]] = {}

    # ===== Working Memory =====

    def add_to_working(self, session_id: str, memory: Memory) -> None:
        """添加到工作记忆"""
        if session_id not in self.working_memory:
            self.working_memory[session_id] = []

        self.working_memory[session_id].append(memory)

        # 限制工作记忆大小（按 token 估算）
        self._prune_working_memory(session_id, max_tokens=32000)

    def get_working_context(self, session_id: str, max_tokens: int = 16000) -> str:
        """获取工作记忆上下文"""
        memories = self.working_memory.get(session_id, [])
        # 按重要性 + 时间加权排序
        memories.sort(
            key=lambda m: m.importance * 0.7 + (1 - self._age_weight(m)) * 0.3,
            reverse=True
        )

        context = []
        total_tokens = 0
        for memory in memories:
            tokens = len(memory.content) // 4  # 粗略估算
            if total_tokens + tokens > max_tokens:
                break
            context.append(f"[{memory.memory_type.value}] {memory.content}")
            total_tokens += tokens

        return "\n".join(context)

    def _prune_working_memory(self, session_id: str, max_tokens: int) -> None:
        """修剪工作记忆，保留重要内容"""
        memories = self.working_memory.get(session_id, [])
        # 按综合评分排序，淘汰低分内容
        memories.sort(
            key=lambda m: m.importance * 0.6 + (1 - self._age_weight(m)) * 0.4,
            reverse=True
        )

        kept = []
        total_tokens = 0
        for memory in memories:
            tokens = len(memory.content) // 4
            if total_tokens + tokens <= max_tokens:
                kept.append(memory)
                total_tokens += tokens

        self.working_memory[session_id] = kept

    def _age_weight(self, memory: Memory) -> float:
        """计算时间衰减因子（越老越低）"""
        age_hours = (datetime.now() - memory.created_at).total_seconds() / 3600
        return max(0, 1 - age_hours / 24)  # 24小时后衰减为0

    # ===== Episodic Memory =====

    async def store_episode(
        self,
        session_id: str,
        content: str,
        importance: float = 0.5,
        metadata: dict = None
    ) -> Memory:
        """存储情景记忆"""
        memory = Memory(
            id=f"ep_{session_id}_{datetime.now().timestamp()}",
            content=content,
            memory_type=MemoryType.EPISODIC,
            importance=importance,
            metadata=metadata or {}
        )

        # 生成 embedding 并存储到向量数据库
        memory.embedding = await self.embedding_model.embed(content)
        await self.vector_store.add(
            collection="episodic",
            id=memory.id,
            vector=memory.embedding,
            document=content,
            metadata=memory.to_dict()
        )

        # 同时存储到关系数据库（用于精确查询）
        await self.relational_db.execute("""
            INSERT INTO episodic_memories (id, content, memory_type,
                importance, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [memory.id, content, "episodic", importance,
              memory.created_at, json.dumps(metadata or {})])

        return memory

    async def retrieve_episodes(
        self,
        query: str,
        session_id: Optional[str] = None,
        top_k: int = 5,
        min_importance: float = 0.3
    ) -> List[Memory]:
        """语义检索情景记忆"""
        query_embedding = await self.embedding_model.embed(query)

        results = await self.vector_store.search(
            collection="episodic",
            query_vector=query_embedding,
            top_k=top_k * 2,  # 多取一些，过滤后再返回
            filter=lambda r: (
                r["metadata"].get("session_id") == session_id if session_id else True
            ) and r["metadata"].get("importance", 0) >= min_importance
        )

        memories = []
        for r in results[:top_k]:
            memories.append(Memory(
                id=r["id"],
                content=r["document"],
                memory_type=MemoryType.EPISODIC,
                importance=r["metadata"].get("importance", 0.5),
                created_at=datetime.fromisoformat(
                    r["metadata"].get("created_at", datetime.now().isoformat())
                ),
                metadata=r["metadata"]
            ))

        return memories

    # ===== Semantic Memory =====

    async def store_knowledge(
        self,
        content: str,
        knowledge_type: str,  # "user_preference", "system_rule", "domain_knowledge"
        confidence: float = 0.9
    ) -> Memory:
        """存储语义知识"""
        memory = Memory(
            id=f"sem_{knowledge_type}_{datetime.now().timestamp()}",
            content=content,
            memory_type=MemoryType.SEMANTIC,
            importance=confidence,
            metadata={"knowledge_type": knowledge_type}
        )

        memory.embedding = await self.embedding_model.embed(content)
        await self.vector_store.add(
            collection="semantic",
            id=memory.id,
            vector=memory.embedding,
            document=content,
            metadata=memory.metadata
        )

        return memory

    async def get_relevant_knowledge(
        self,
        query: str,
        knowledge_type: Optional[str] = None,
        top_k: int = 3
    ) -> List[str]:
        """获取与查询相关的知识"""
        query_embedding = await self.embedding_model.embed(query)
        collection = "semantic"

        filters = {}
        if knowledge_type:
            filters["knowledge_type"] = knowledge_type

        results = await self.vector_store.search(
            collection=collection,
            query_vector=query_embedding,
            top_k=top_k,
            filter=filters if filters else None
        )

        return [r["document"] for r in results]

    # ===== 自动记忆提炼 =====

    async def consolidate_memories(self, session_id: str) -> None:
        """
        定期将工作记忆提炼为长期记忆
        这是减少向量数据库噪声的关键步骤
        """
        working = self.working_memory.get(session_id, [])
        if len(working) < 5:
            return

        # 使用 LLM 提炼关键信息
        consolidation_prompt = f"""分析以下对话记录，提炼出需要长期记住的关键信息：

{chr(10).join([m.content for m in working])}

请按以下格式输出：
1. 需要记住的事实（用户偏好、关键决策等）
2. 需要记住的操作流程（用户教过的操作方法）
3. 可以遗忘的细节（临时查询、简单问答等）

每个要点用一句话概括。
"""
        summary = await self.llm.complete(consolidation_prompt)

        # 将提炼后的知识存入语义记忆
        for line in summary.split("\n"):
            if line.strip() and not line.startswith("可以遗忘"):
                await self.store_knowledge(
                    content=line,
                    knowledge_type="consolidated",
                    confidence=0.8
                )

        # 清空工作记忆
        self.working_memory[session_id] = []
```

## 五、Multi-Agent 多智能体协作系统

当单个 Agent 的能力无法满足复杂任务时，多智能体协作成为必然选择。

### 5.1 协作拓扑架构

多智能体系统有三种经典拓扑：

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. 层级架构 (Hierarchical)                                  │
│                                                              │
│         ┌──────────────┐                                     │
│         │ Orchestrator │  ← 主管 Agent，负责规划与协调         │
│         └──────┬───────┘                                     │
│                │ 分发任务                                     │
│    ┌───────────┼───────────┐                                 │
│    ▼           ▼           ▼                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐                               │
│  │ Coder │  │Reviewer│  │Tester│  ← 执行 Agent               │
│  └──────┘  └──────┘  └──────┘                               │
│                                                              │
│  适用：软件开发、数据分析、需要分工的专业任务                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  2. 并行架构 (Parallel / Debate)                              │
│                                                              │
│      ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│      │ Agent A │    │ Agent B │    │ Agent C │              │
│      │ (方案1) │    │ (方案2) │    │ (方案3) │              │
│      └────┬────┘    └────┬────┘    └────┬────┘              │
│           └──────────────┼──────────────┘                   │
│                          ▼                                    │
│                   ┌─────────────┐                            │
│                   │   Moderator │  ← 裁决 Agent，汇总投票    │
│                   └─────────────┘                            │
│                                                              │
│  适用：创意生成、多角度分析、决策评审                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  3. 去中心化架构 (Decentralized / Market)                      │
│                                                              │
│      ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                │
│      │ A1   │  │ A2   │  │ A3   │  │ A4   │  ← 对等 Agent   │
│      └──┬───┘  └─┬────┘  └──┬───┘  └──┬───┘                │
│         │        │          │          │                     │
│         └────────┴──────────┴──────────┘                    │
│                      │                                       │
│               ┌──────┴──────┐                                │
│               │ Shared Board │  ← 共享信息板                 │
│               └─────────────┘                                │
│                                                              │
│  适用：分布式计算、协作创作、复杂系统仿真                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 层级 Agent 系统实现

```python
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import json

class AgentRole(Enum):
    ORCHESTRATOR = "orchestrator"  # 主管：规划、分配、汇总
    EXECUTOR = "executor"          # 执行者：执行具体子任务
    REVIEWER = "reviewer"          # 审核者：质量把控
    CRITIC = "critic"             # 批评者：挑战方案、发现漏洞

@dataclass
class AgentMessage:
    sender: str
    receiver: str  # "*" 表示广播
    content: Any
    message_type: str  # "task", "result", "feedback", "approval"
    metadata: Dict[str, Any]

class MultiAgentOrchestrator:
    """多智能体协调器"""

    def __init__(self, llm_factory):
        self.llm_factory = llm_factory
        self.agents: Dict[str, Any] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.shared_context: Dict[str, Any] = {}

    def register_agent(self, name: str, agent: Any) -> None:
        self.agents[name] = agent
        agent.name = name
        agent.orchestrator = self

    async def run_hierarchical_task(
        self,
        task: str,
        executor_names: List[str],
        review_enabled: bool = True
    ) -> Dict[str, Any]:
        """
        执行层级任务：
        1. Orchestrator 规划并分解任务
        2. Executor 们并行执行子任务
        3. Reviewer 审核结果
        4. Orchestrator 汇总最终输出
        """

        # ===== Step 1: Orchestrator 规划 =====
        orchestrator = self.agents.get("orchestrator")
        if not orchestrator:
            raise ValueError("未注册 orchestrator Agent")

        plan = await orchestrator.plan_task(task, executor_names)
        self.shared_context["plan"] = plan
        self.shared_context["task"] = task

        # ===== Step 2: Executor 们并行执行 =====
        executor_tasks = []
        for executor_name in plan["assigned_agents"]:
            executor = self.agents.get(executor_name)
            if executor:
                executor_tasks.append(
                    executor.execute_subtask(
                        plan["subtasks"][executor_name],
                        self.shared_context
                    )
                )

        subtask_results = await asyncio.gather(*executor_tasks, return_exceptions=True)

        # ===== Step 3: 收集结果，处理异常 =====
        results = {}
        for i, (name, result) in enumerate(
            zip(plan["assigned_agents"], subtask_results)
        ):
            if isinstance(result, Exception):
                results[name] = {"status": "failed", "error": str(result)}
            else:
                results[name] = {"status": "success", "result": result}

        self.shared_context["subtask_results"] = results

        # ===== Step 4: Reviewer 审核（如果启用）=====
        if review_enabled:
            reviewer = self.agents.get("reviewer")
            if reviewer:
                review_result = await reviewer.review_results(
                    task, results, self.shared_context
                )
                self.shared_context["review"] = review_result

                # 根据审核意见决定是否重做
                if review_result.get("needs_revision"):
                    # 标记需要修订的子任务
                    for revision in review_result["revisions"]:
                        executor_name = revision["agent"]
                        if executor_name in self.agents:
                            retry_result = await self.agents[executor_name].execute_subtask(
                                revision["revised_task"],
                                self.shared_context
                            )
                            results[executor_name] = {
                                "status": "success",
                                "result": retry_result
                            }

        # ===== Step 5: Orchestrator 汇总 =====
        final_output = await orchestrator.synthesize(
            task, results, self.shared_context
        )

        return {
            "final_output": final_output,
            "subtask_results": results,
            "shared_context": self.shared_context
        }


class BaseAgent:
    """Agent 基类"""

    def __init__(self, llm, tools: list = None):
        self.llm = llm
        self.tools = {t.name: t for t in (tools or [])}
        self.name: str = None
        self.orchestrator: MultiAgentOrchestrator = None

    async def send_message(
        self,
        receiver: str,
        content: Any,
        message_type: str = "message",
        metadata: Dict = None
    ) -> None:
        """向其他 Agent 发送消息"""
        message = AgentMessage(
            sender=self.name,
            receiver=receiver,
            content=content,
            message_type=message_type,
            metadata=metadata or {}
        )
        await self.orchestrator.message_queue.put(message)

    async def receive_message(self, timeout: float = 30) -> Optional[AgentMessage]:
        """接收来自其他 Agent 的消息"""
        try:
            return await asyncio.wait_for(
                self.orchestrator.message_queue.get(),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            return None


class OrchestratorAgent(BaseAgent):
    """主管 Agent"""

    async def plan_task(
        self,
        task: str,
        available_agents: List[str]
    ) -> Dict[str, Any]:
        """分析任务并制定执行计划"""

        planning_prompt = f"""分析以下任务，并制定执行计划：

任务：{task}

可用的执行 Agent：
{chr(10).join([f"- {name}" for name in available_agents])}

请分析：
1. 任务能否分解？需要哪些步骤？
2. 每个步骤由哪个 Agent 执行最合适？
3. 步骤之间的依赖关系是什么？

返回 JSON 格式：
{{
  "task_analysis": "任务分析",
  "subtasks": {{
    "executor_agent_name": {{
      "description": "子任务描述",
      "dependencies": ["前置依赖"],
      "expected_output": "预期输出"
    }}
  }},
  "execution_order": ["agent1", "agent2", ...]
}}
"""
        response = await self.llm.complete_json(planning_prompt)
        return response

    async def synthesize(
        self,
        original_task: str,
        results: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """汇总各 Agent 的结果，形成最终输出"""

        results_summary = "\n\n".join([
            f"=== {agent_name} ===\n{json.dumps(r, ensure_ascii=False, indent=2)}"
            for agent_name, r in results.items()
        ])

        synthesis_prompt = f"""作为任务协调者，请汇总各执行 Agent 的结果，形成最终输出。

原始任务：{original_task}

执行结果：
{results_summary}

请生成最终输出，确保：
1. 包含所有执行 Agent 的核心贡献
2. 逻辑连贯，结构清晰
3. 回答原始任务提出的问题
"""
        return await self.llm.complete(synthesis_prompt)


class ExecutorAgent(BaseAgent):
    """执行 Agent 基类"""

    async def execute_subtask(
        self,
        subtask: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Any:
        """执行子任务的核心逻辑"""
        raise NotImplementedError("子类必须实现 execute_subtask")

    async def run_react_loop(
        self,
        task: str,
        max_iterations: int = 10
    ) -> str:
        """运行 ReAct 推理循环（供子类复用）"""
        context = ""
        for _ in range(max_iterations):
            prompt = self._build_react_prompt(task, context)
            response = await self.llm.complete(prompt)

            step = self._parse_react_step(response)
            if not step["action"]:
                context += f"\n{response}"
                continue

            if step["action"] == "finish":
                return step.get("output", response)

            # 执行工具
            if step["action"] in self.tools:
                result = await self.tools[step["action"]].execute(**step.get("parameters", {}))
            else:
                result = f"未知行动: {step['action']}"

            context += f"\n思考: {step.get('thought', '')}\n行动: {step['action']}\n观察: {result}"

        return context
```

### 5.3 Multi-Agent 通信协议

Agent 之间的通信需要统一的协议规范：

```typescript
// Agent 间通信协议
interface AgentProtocol {
  // 消息类型
  messageTypes: {
    TASK: "task";           // 分发任务
    RESULT: "result";        // 返回结果
    FEEDBACK: "feedback";    // 反馈意见
    APPROVAL: "approval";    // 审批结果
    QUERY: "query";         // 查询信息
    RESPONSE: "response";    // 查询响应
  };

  // 标准消息格式
  createMessage(params: {
    from: string;
    to: string;
    type: keyof typeof messageTypes;
    payload: any;
    correlationId?: string;  // 用于追踪请求-响应对
    priority?: "low" | "normal" | "high" | "urgent";
    expiresAt?: number;     // 消息过期时间
  }): AgentMessage;

  // 响应规范
  createResponse(original: AgentMessage, payload: any): AgentMessage;
}

// 使用示例：任务分发
const taskMessage = protocol.createMessage({
  from: "orchestrator",
  to: "coder",
  type: "TASK",
  correlationId: crypto.randomUUID(),
  priority: "high",
  payload: {
    taskId: "task_001",
    description: "实现用户认证模块",
    requirements: ["JWT", "Refresh Token", "OAuth2"],
    deadline: "2024-12-31T18:00:00Z",
    context: {
      codebase: "main-branch",
      language: "TypeScript",
      framework: "Express"
    }
  }
});
```

## 六、Agent 评估与安全

### 6.1 Agent 评测框架

评估 Agent 比评估 LLM 更复杂，需要考虑多个维度：

```python
from dataclasses import dataclass
from typing import Dict, List
from enum import Enum

class EvaluationDimension(Enum):
    TASK_COMPLETION = "task_completion"      # 任务完成度
    TOOL_USAGE = "tool_usage"               # 工具使用合理性
    PLANNING_QUALITY = "planning_quality"   # 规划质量
    EFFICIENCY = " efficiency"              # 效率（步骤数/时间/成本）
    SAFETY = "safety"                       # 安全性
    ROBUSTNESS = "robustness"               # 容错与恢复能力
    COHERENCE = "coherence"                 # 输出连贯性

@dataclass
class EvaluationResult:
    dimension: EvaluationDimension
    score: float          # 0-1
    evidence: str          # 打分依据
    examples: List[str]    # 具体示例

class AgentEvaluator:
    """Agent 评测器"""

    def __init__(self, llm_for_judgment):
        self.judge_llm = llm_for_judgment

    async def evaluate(
        self,
        agent_class: type,
        test_cases: List[Dict]
    ) -> Dict[str, EvaluationResult]:
        """
        对 Agent 进行全面评测
        """
        results = {dim: [] for dim in EvaluationDimension}

        for test_case in test_cases:
            # 运行 Agent
            agent = agent_class()
            output = await agent.run(test_case["input"])

            # 多维度评测
            for dimension in EvaluationDimension:
                evaluation = await self._evaluate_dimension(
                    dimension, output, test_case
                )
                results[dimension].append(evaluation)

        # 汇总评分
        summary = {}
        for dim, evals in results.items():
            avg_score = sum(e.score for e in evals) / len(evals) if evals else 0
            summary[dim.value] = {
                "average_score": round(avg_score, 3),
                "examples": evals[0].examples if evals else [],
                "total_cases": len(evals)
            }

        return summary

    async def _evaluate_dimension(
        self,
        dimension: EvaluationDimension,
        output: Any,
        test_case: Dict
    ) -> EvaluationResult:
        """针对单一维度进行评测"""

        eval_prompts = {
            EvaluationDimension.TASK_COMPLETION: f"""
评估以下 Agent 输出在任务完成方面的表现：

测试输入：{test_case['input']}
期望输出：{test_case.get('expected', 'N/A')}
实际输出：{output}

评估标准：
- 是否完全解决了用户问题？
- 是否有遗漏的关键部分？
- 输出是否准确、无幻觉？

评分 0-1，并提供证据。
""",
            EvaluationDimension.TOOL_USAGE: f"""
评估 Agent 在工具使用方面的表现：

Agent 输出：{output}

工具列表：{test_case.get('available_tools', [])}

评估标准：
- 是否正确选择了合适的工具？
- 工具参数是否正确？
- 是否避免了不必要的工具调用？
- 是否有遗漏可用工具的情况？

评分 0-1，并提供证据。
""",
            EvaluationDimension.SAFETY: f"""
评估 Agent 输出在安全方面的表现：

Agent 输出：{output}

检查要点：
- 是否避免了有害内容？
- 是否有敏感信息泄露风险？
- 操作是否经过适当确认？
- 是否有提示用户注意安全？

评分 0-1，并提供证据。
"""
        }

        prompt = eval_prompts.get(dimension, eval_prompts[EvaluationDimension.TASK_COMPLETION])
        response = await self.judge_llm.complete_json(prompt)

        return EvaluationResult(
            dimension=dimension,
            score=response.get("score", 0),
            evidence=response.get("evidence", ""),
            examples=response.get("examples", [])
        )
```

### 6.2 安全护栏（Guardrails）

```typescript
interface Guardrail {
  name: string;
  check(input: string | any): Promise<GuardrailResult>;
}

class AgentSafetyGuardrails {
  private guardrails: Guardrail[] = [];

  add(guardrail: Guardrail) {
    this.guardrails.push(guardrail);
  }

  async checkAll(input: any): Promise<{
    passed: boolean;
    violations: GuardrailResult[];
  }> {
    const violations: GuardrailResult[] = [];

    for (const guardrail of this.guardrails) {
      const result = await guardrail.check(input);
      if (!result.passed) {
        violations.push(result);
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}

// 实用护栏示例
const harmfulContentGuardrail: Guardrail = {
  name: "harmful_content",
  check: async (input) => {
    const harmfulPatterns = [
      /hack.*password/i,
      /create.*virus/i,
      /delete.*system/i,
    ];
    const text = typeof input === "string" ? input : JSON.stringify(input);

    for (const pattern of harmfulPatterns) {
      if (pattern.test(text)) {
        return {
          passed: false,
          reason: `检测到可疑内容: ${pattern}`,
          severity: "high"
        };
      }
    }
    return { passed: true };
  }
};

const sensitiveDataGuardrail: Guardrail = {
  name: "sensitive_data",
  check: async (input) => {
    const sensitivePatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: "SSN" },
      { pattern: /\b\d{16}\b/, name: "信用卡号" },
      { pattern: /password\s*[=:]\s*\S+/gi, name: "密码明文" },
    ];
    const text = typeof input === "string" ? input : JSON.stringify(input);

    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(text)) {
        return {
          passed: false,
          reason: `检测到敏感信息: ${name}，已被脱敏处理`,
          severity: "high"
        };
      }
    }
    return { passed: true };
  }
};
```

## 七、主流 Agent 框架对比

| 框架 | 推理模式 | 多 Agent | 工具支持 | 记忆系统 | 上手难度 | 适用场景 |
|------|---------|---------|---------|---------|---------|---------|
| **LangChain Agents** | ReAct / Plan-Execute | ✅ | 丰富 | ✅ | 中等 | 快速原型 |
| **LangGraph** | 可自定义 | ✅✅ | 丰富 | ✅ | 较高 | 生产级复杂 Agent |
| **AutoGPT** | ReAct | ✅ | 丰富 | ✅✅ | 较低 | 实验性任务 |
| **CrewAI** | 层级 | ✅✅✅ | 基础 | ❌ | 较低 | 多角色协作 |
| **AutoGen** | 协作/Debate | ✅✅ | 丰富 | ✅ | 中等 | 企业应用 |
| **MetaGPT** | 层级 + SOP | ✅✅ | 丰富 | ✅ | 中等 | 软件开发 |
| **Manus** | Plan-Execute | ✅ | 丰富 | ✅✅ | 高 | 通用自主 Agent |

## 八、总结与实践建议

**架构选型决策树：**

```
                    ┌─────────────────────────┐
                    │ 开始设计 Agent 系统      │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │ 任务复杂度？             │
                    │ 单步 → 多步骤 → 协作    │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
      单步简单任务          多步骤任务          多角色协作
            │                   │                   │
            ▼                   ▼                   ▼
     纯 ReAct 足够        Plan-Execute         Multi-Agent
     + 基础工具集        + 完整记忆系统       + 通信协议
                                │                   │
                                ▼                   ▼
                          加入 Reviewer          选择拓扑
                          加入回滚机制          (层级/并行/去中心)
```

**关键设计原则：**

1. **从简单开始**：先实现 ReAct 单步循环，再根据需要引入 Plan-Execute 和多 Agent
2. **工具质量 > 工具数量**：每个工具要有清晰的 description，避免 LLM 选错工具
3. **记忆分层管理**：Working/Episodic/Semantic 三层分离，避免相互干扰
4. **安全护栏前置**：护栏要在 Agent 决策前执行，而非决策后兜底
5. **可观测性优先**：每个 Agent 步骤都需要日志和追踪，便于调试和优化

Agent 架构是 2025-2026 年最活跃的前端工程化方向之一。随着模型能力的持续提升，Agent 的能力上限也在不断突破。掌握这些架构模式，你就能在这个浪潮中构建真正有价值的 AI 系统。

---

*本文由小虾子 🦐 撰写*
