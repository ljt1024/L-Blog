---
title: AI Agents 深度解析：从单步推理到多智能体协作
date: 2026-08-14
---

# AI Agents 深度解析：从单步推理到多智能体协作

> ChatGPT 回答问题，AI Agent 完成任务——这是两者最根本的区别。前者是被动的问答机器，后者是主动规划、调用工具、记忆上下文、迭代执行的智能代理。本文系统覆盖 AI Agent 核心架构（规划 / 记忆 / 工具 / 执行）、主流 Agent 框架（ReAct / Plan-and-Execute / AutoGPT / BabyAGI / CAMEL）、多智能体协作模式（Agent Supervisor / 同级协作 / 层级协作）、生产级工具调用设计，以及 7 大 Agent 反模式与防御策略，是你构建自主 AI 系统的完整工程指南。

本文由小虾子 🦐 撰写

## 什么是 AI Agent？

```
AI Agent vs LLM 的本质区别：
─────────────────────────────────────────────────────
LLM（大型语言模型）       AI Agent
─────────────────────────────────────────────────────
被动：用户问 → LLM 答     主动：目标 → 规划 → 执行 → 迭代
单轮：每次独立             多轮：记忆上下文
无工具：纯生成             工具调用：搜索/代码/数据库
无执行：只返回文本         执行动作：操作外部系统
无反思：一次生成            自我反思：评估结果 → 修正
─────────────────────────────────────────────────────

Agent 核心循环（Agent Loop）：
┌─────────────────────────────────────────┐
│  1. Thought（思考）                       │
│     LLM 分析当前状态，决定下一步行动         │
│  2. Action（行动）                       │
│     调用工具 / 执行代码 / 查询 API           │
│  3. Observation（观察）                     │
│     收集行动结果，更新状态                   │
│  4. Loop（循环）                          │
│     直到达到目标或超过最大步数               │
└─────────────────────────────────────────┘
```

---

## Agent 核心架构

### 四件套：规划 / 记忆 / 工具 / 执行

```python
# ===== AI Agent 核心架构 =====
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class Message:
    """记忆中的单条消息"""
    role: str              # "user" / "assistant" / "system" / "tool"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict = field(default_factory=dict)

@dataclass
class Tool:
    """工具定义"""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema

    def execute(self, **kwargs) -> str:
        raise NotImplementedError

@dataclass
class AgentState:
    """Agent 状态"""
    goal: str
    memory: List[Message] = field(default_factory=list)
    artifacts: Dict[str, Any] = field(default_factory=dict)  # 中间产物
    step: int = 0

class BaseAgent(ABC):
    """
    Agent 核心类：规划 + 记忆 + 工具 + 执行循环
    """

    def __init__(self, name: str, llm, tools: List[Tool], max_steps: int = 20):
        self.name = name
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.max_steps = max_steps

    def run(self, goal: str) -> str:
        """主循环"""
        state = AgentState(goal=goal)

        while state.step < self.max_steps:
            state.step += 1

            # 1. Thought：思考下一步
            thought = self.think(state)

            # 2. 如果思考认为已完成
            if thought.get("type") == "finish":
                return thought["output"]

            # 3. Action：执行行动
            if thought["type"] == "tool":
                result = self.execute_tool(thought["tool"], thought["input"])
                state.artifacts[thought["tool"]] = result
            elif thought["type"] == "code":
                result = self.execute_code(thought["code"])
                state.artifacts["code_result"] = result

            # 4. Observation：记录到记忆
            self.remember(state, thought, result)

        return f"达到最大步数 {self.max_steps}，未能完成任务"

    @abstractmethod
    def think(self, state: AgentState) -> Dict:
        """思考：分析状态，决定下一步（子类实现）"""
        pass

    def remember(self, state, thought, result):
        """记忆：记录思考和结果"""
        state.memory.append(Message(
            role="assistant",
            content=f"Thought: {thought} | Result: {result}",
        ))

    def execute_tool(self, tool_name: str, input_data: Any) -> str:
        if tool_name not in self.tools:
            return f"错误：未知工具 {tool_name}"
        return self.tools[tool_name].execute(**input_data)

    def execute_code(self, code: str) -> str:
        """安全执行代码（沙箱环境）"""
        try:
            local_vars = {}
            exec(code, {"__builtins__": {}}, local_vars)
            return str(local_vars.get("result", "代码执行完成"))
        except Exception as e:
            return f"代码执行错误：{e}"
```

---

## ReAct Agent（推理 + 行动）

```python
# ===== ReAct Agent 实现 =====
import re

class ReActAgent(BaseAgent):
    """
    ReAct = Reasoning + Acting
    核心思想：交替进行推理和行动，
    用推理指导行动，用行动验证推理
    """

    SYSTEM_PROMPT = """你是一个 ReAct Agent，需要通过推理和行动完成任务。

可用的工具：
{tool_descriptions}

输出格式（每一步必须严格遵循）：
Thought: [你的推理过程，分析当前状态，决定下一步]
Action: [工具名] 或 "finish"
Action_Input: [工具参数 JSON 或 "null"]
Observation: [上一步行动的结果，此字段由系统自动填入]

规则：
- 每步只能做一个 Action
- 如果任务完成，输出 Action: finish
- 如果需要更多信息，先推理再行动
- Observation 字段留空，由系统填入实际结果

开始！
"""

    def think(self, state: AgentState) -> Dict:
        # 构建提示词
        tool_descs = "\n".join([
            f"- {name}: {tool.description}"
            for name, tool in self.tools.items()
        ])

        # 添加历史（Observation）
        history = ""
        for msg in state.memory[-6:]:  # 最近 6 条记忆
            history += f"\n{msg.content}"

        prompt = f"""
{SYSTEM_PROMPT.format(tool_descriptions=tool_descs)}

当前目标：{state.goal}
当前步骤：{state.step}/{self.max_steps}
{history}

请开始第一步思考：
"""

        # 调用 LLM
        response = self.llm.invoke(prompt)
        text = response.content

        # 解析输出
        thought = re.search(r"Thought:\s*(.+)", text)
        action = re.search(r"Action:\s*(\w+)", text)
        action_input = re.search(r"Action_Input:\s*(\{[^}]+\}|null)", text)

        result = {"type": "unknown"}

        if action:
            action_text = action.group(1)
            if action_text.lower() == "finish":
                result = {"type": "finish", "output": text}
            elif action_text in self.tools:
                input_json = action_input.group(1) if action_input else "{}"
                if input_json == "null":
                    input_data = {}
                else:
                    import json
                    input_data = json.loads(input_json)
                result = {"type": "tool", "tool": action_text, "input": input_data}

        return result

# ===== 使用示例 =====

# 定义工具
class SearchTool(Tool):
    def __init__(self):
        super().__init__(
            name="search",
            description="搜索网络信息，返回搜索结果摘要",
            parameters={"query": {"type": "string", "description": "搜索关键词"}}
        )

    def execute(self, **kwargs) -> str:
        # 实际调用搜索 API
        return f"搜索结果：关于 {kwargs['query']} 的信息..."

class CalculatorTool(Tool):
    def __init__(self):
        super().__init__(
            name="calculate",
            description="计算数学表达式",
            parameters={"expression": {"type": "string"}}
        )

    def execute(self, **kwargs) -> str:
        try:
            result = eval(kwargs["expression"])
            return str(result)
        except:
            return "计算错误"

# 创建 Agent
tools = [SearchTool(), CalculatorTool()]
agent = ReActAgent(
    name="researcher",
    llm=llm,
    tools=tools,
    max_steps=10,
)

result = agent.run("搜索 2024 年诺贝尔物理学奖得主，并计算他们的平均获奖年龄")
print(result)
```

---

## Plan-and-Execute Agent（规划先行）

```python
# ===== Plan-and-Execute 模式 =====
"""
Plan-and-Execute vs ReAct：
• ReAct：边想边做（交错推理和行动）
• Plan-and-Execute：先制定完整计划，再按计划执行
  → 适合：多步骤复杂任务（旅游规划、项目管理等）
  → 优势：计划可审查、可调整、可复用
  → 劣势：灵活性稍低（环境变化时计划可能过时）
"""

class PlanAndExecuteAgent:
    def __init__(self, llm, tools: List[Tool]):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.executor = ReActAgent("executor", llm, tools)

    def plan(self, goal: str) -> List[Dict]:
        """制定执行计划"""
        prompt = f"""
目标：{goal}

请将这个目标分解为可执行的步骤。
每个步骤必须：
1. 有明确的输出（可以被下一步使用）
2. 可以独立执行或依赖前序步骤的输出
3. 是原子操作（不能再拆分）

请以 JSON 数组格式输出：
[
  {{
    "step": 1,
    "action": "步骤描述",
    "uses_previous": false,
    "output": "这一步会产出什么"
  }}
]

只输出 JSON，不要有其他内容：
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def execute_step(self, step: Dict, context: Dict) -> str:
        """执行单个步骤"""
        # 为每步构建子目标
        sub_goal = f"{step['action']}"
        if step.get("uses_previous") and context:
            sub_goal += f"\n前置信息：{json.dumps(context)}"

        return self.executor.run(sub_goal)

    def run(self, goal: str) -> Dict:
        """完整流程：规划 → 执行 → 汇总"""
        print(f"🎯 目标：{goal}")

        # 1. 制定计划
        print("📋 制定计划中...")
        plan = self.plan(goal)
        for i, step in enumerate(plan):
            print(f"  {i+1}. {step['action']}")

        # 2. 按计划执行
        results = {}
        context = {}

        for i, step in enumerate(plan):
            print(f"\n🔄 执行步骤 {i+1}：{step['action']}")
            result = self.execute_step(step, context)
            results[i+1] = result
            context[step["action"]] = result
            print(f"  ✅ {result[:100]}...")

        # 3. 汇总结果
        print("\n📊 汇总结果...")
        summary_prompt = f"""
目标：{goal}
各步骤结果：
{json.dumps(results, indent=2, ensure_ascii=False)}

请根据各步骤结果，给出最终答案：
"""
        final_answer = self.llm.invoke(summary_prompt)

        return {
            "goal": goal,
            "plan": plan,
            "results": results,
            "answer": final_answer.content,
        }


# 使用示例：旅游规划
agent = PlanAndExecuteAgent(llm, tools=[
    SearchTool(),
    CalculatorTool(),
    # 实际项目中还有：机票查询、天气查询、酒店预订等工具
])

result = agent.run("帮我规划一个 5 天的北京之旅，包括每天的景点和用餐建议")
print(result["answer"])
```

---

## AutoGPT 风格 Agent

```python
# ===== AutoGPT 风格：自主目标分解 + 自我批评 =====
"""
AutoGPT 核心特性：
1. 自主目标分解（LLM 自己决定子目标）
2. 自我批评（反思上一步做得好不好）
3. 长期记忆（持久化存储）
4. 优先级排序（根据反馈调整）
"""

class AutoGPTAgent:
    def __init__(self, llm, tools: List[Tool], memory_backend=None):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.memory = memory_backend or InMemoryMemory()
        self.max_loops = 50

    def run(self, goal: str) -> str:
        """AutoGPT 主循环"""
        self.memory.add("user", f"目标：{goal}")

        task_list = []  # 待执行任务队列
        completed = []   # 已完成任务

        # 初始化：从主目标生成子任务
        task_list = self.decompose_goal(goal)

        for loop in range(self.max_loops):
            if not task_list:
                break

            # 取最高优先级任务
            current_task = task_list.pop(0)

            # 执行
            result = self.execute_task(current_task)
            completed.append((current_task, result))

            # 自我批评：检查结果质量
            critique = self.self_critique(current_task, result)

            # 根据批评调整
            if critique.get("needs_retry"):
                # 重试或分解为子任务
                new_tasks = self.decompose_goal(critique["feedback"])
                task_list = new_tasks + task_list
            else:
                # 添加到长期记忆
                self.memory.add("assistant", f"完成：{current_task} → {result[:200]}")

            # 自我批评：是否有新任务产生
            new_tasks = self.identify_new_tasks(current_task, result)
            task_list.extend(new_tasks)

        return self.summarize(completed)

    def decompose_goal(self, goal: str) -> List[str]:
        """LLM 自主分解目标为子任务"""
        prompt = f"""
目标：{goal}

请将这个目标分解为具体的子任务列表。
每个子任务应该：
- 可以独立执行
- 有明确的完成标准
- 产出可用于后续任务的结果

输出 JSON 数组：
["任务1", "任务2", ...]

只输出 JSON：
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def execute_task(self, task: str) -> str:
        """执行单个任务（调用 ReAct 风格推理）"""
        # 简化的执行逻辑
        if task in self.tools:
            return self.tools[task].execute()
        return f"执行任务：{task} → 完成"

    def self_critique(self, task: str, result: str) -> Dict:
        """自我批评：评估任务完成质量"""
        prompt = f"""
任务：{task}
执行结果：{result}

请评估这个结果：
1. 是否完全解决了任务要求？
2. 有什么遗漏或错误？
3. 是否需要重试？

JSON 格式：
{{"needs_retry": true/false, "feedback": "批评说明"}}
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def identify_new_tasks(self, completed_task: str, result: str) -> List[str]:
        """识别是否有新任务产生"""
        prompt = f"""
已完成任务：{completed_task}
执行结果：{result}

基于这个结果，是否需要执行额外的任务？
输出 JSON 数组（没有则为空）：
["新任务1", ...]
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def summarize(self, completed: List) -> str:
        """汇总所有完成的任务"""
        summary = "\n".join([f"- {t}: {r[:100]}..." for t, r in completed])
        return f"完成 {len(completed)} 个任务：\n{summary}"


# ===== 长期记忆实现 =====
class InMemoryMemory:
    """简单的内存记忆（生产环境用向量数据库）"""
    def __init__(self):
        self.messages = []

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def get_recent(self, n: int = 10) -> str:
        return "\n".join([
            f"{m['role']}: {m['content']}"
            for m in self.messages[-n:]
        ])
```

---

## BabyAGI 风格 Agent

```python
# ===== BabyAGI 核心循环 =====
"""
BabyAGI 的三组件：
1. Task Creation Agent：根据结果创建新任务
2. Task Execution Agent：执行任务
3. Task Prioritization Agent：对任务排序

核心循环：
结果 → 创建新任务 → 排序 → 执行 → 结果 → ...
"""

class BabyAGI:
    def __init__(self, llm, objective: str):
        self.llm = llm
        self.objective = objective
        self.task_list = []

    def run(self, max_iterations: int = 5):
        """BabyAGI 主循环"""
        # 初始化任务列表
        self.task_list = self.create_initial_tasks(self.objective)

        completed = []
        iteration = 0

        while self.task_list and iteration < max_iterations:
            iteration += 1
            print(f"\n=== 迭代 {iteration} ===")

            # 1. 优先级排序
            self.task_list = self.prioritize_tasks(self.objective, self.task_list, completed)

            # 2. 取出最重要任务
            task = self.task_list.pop(0)

            # 3. 执行
            print(f"执行：{task}")
            result = self.execute_task(task)

            # 4. 创建新任务
            new_tasks = self.create_tasks(
                self.objective,
                completed + [(task, result)],
            )
            self.task_list.extend(new_tasks)

            completed.append((task, result))

            # 5. 显示状态
            print(f"  完成：{len(completed)} | 待办：{len(self.task_list)}")

        return self.final_answer(self.objective, completed)

    def create_initial_tasks(self, objective: str) -> List[str]:
        """创建初始任务列表"""
        prompt = f"""
目标：{objective}

请分解为初始任务列表（3-5 个核心任务）：
JSON 数组格式：["任务1", "任务2", ...]
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def create_tasks(
        self,
        objective: str,
        completed: List[tuple],
    ) -> List[str]:
        """根据已完成任务创建新任务"""
        completed_str = "\n".join([f"- {t}: {r[:100]}" for t, r in completed])

        prompt = f"""
目标：{objective}
已完成任务：
{completed_str}

基于已完成任务的结果，需要添加哪些新任务？
（如果没有新任务，返回空数组）
JSON 数组：["新任务1", ...]
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def prioritize_tasks(
        self,
        objective: str,
        tasks: List[str],
        completed: List[tuple],
    ) -> List[str]:
        """任务优先级排序"""
        completed_str = "\n".join([f"- {t}" for t, _ in completed])

        prompt = f"""
目标：{objective}
已完成：{completed_str}
待排序任务：{json.dumps(tasks)}

请按优先级排序（最相关的在前）：
JSON 数组：["优先级1", "优先级2", ...]
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)

    def execute_task(self, task: str) -> str:
        """执行单个任务"""
        prompt = f"""
任务：{task}

请完成任务，给出详细结果：
"""
        return self.llm.invoke(prompt).content

    def final_answer(self, objective: str, completed: List) -> str:
        """生成最终答案"""
        completed_str = "\n".join([f"## {t}\n{r}\n" for t, r in completed])

        prompt = f"""
原始目标：{objective}
所有完成的任务及结果：
{completed_str}

请给出完整的最终答案：
"""
        return self.llm.invoke(prompt).content
```

---

## CAMEL：角色扮演多智能体协作

```python
# ===== CAMEL：双 Agent 对话协作 =====
"""
CAMEL 核心思想：
两个 Agent 扮演不同角色，通过对话协作完成任务。
AI Scientist（助手）+ AI User（用户）
助手引导用户，用户提供反馈，协作探索。

典型场景：
• AI 助手（专家）+ AI 用户（学习者）→ 教学
• AI 助手（代码助手）+ AI 用户（产品经理）→ 需求分析
• AI 助手（评审）+ AI 用户（开发者）→ 代码审查
"""

class CAMELCollaboration:
    def __init__(self, llm):
        self.llm = llm

    def run(
        self,
        assistant_role: str,
        user_role: str,
        task: str,
        max_turns: int = 10,
    ):
        """CAMEL 协作"""
        system_prompt = f"""你是一个{assistant_role}。

规则：
1. 你的角色是{assistant_role}，不要偏离角色
2. 每次回复应包含"Thought:"、"Role:"、"Content:"三个部分
3. 始终引导对话朝任务完成方向发展
4. 当任务完成时，明确说明"任务完成"
"""
        messages = [{"role": "system", "content": system_prompt}]

        # 用户角色提示
        user_prompt = f"你是{user_role}。你的任务：{task}"
        messages.append({"role": "user", "content": user_prompt})

        for turn in range(max_turns):
            # 助手回复
            response = self.llm.invoke(messages)
            assistant_msg = response.content
            messages.append({"role": "assistant", "content": assistant_msg})

            # 检查是否完成
            if "任务完成" in assistant_msg:
                break

            # 用户回复
            user_response = self.generate_user_response(
                user_role, assistant_msg, task
            )
            messages.append({"role": "user", "content": user_response})

            if "任务完成" in user_response:
                break

        return self.extract_final_answer(messages)

    def generate_user_response(self, role: str, assistant_msg: str, task: str) -> str:
        """生成用户角色的回复"""
        prompt = f"""你扮演{role}。

助手说：{assistant_msg}
原始任务：{task}

以{role}的身份回复助手。回复应该：
1. 符合{role}的身份和知识水平
2. 提供有用的反馈或信息
3. 推动任务向前发展

回复：
"""
        return self.llm.invoke(prompt).content

    def extract_final_answer(self, messages: List) -> str:
        """从对话中提取最终答案"""
        # 最后一条助手消息即为答案
        for msg in reversed(messages):
            if msg["role"] == "assistant" and "任务完成" in msg["content"]:
                return msg["content"]
        return messages[-1]["content"]


# ===== 示例：AI 科学家 + AI 用户协作研究 =====
collaboration = CAMELCollaboration(llm)
result = collaboration.run(
    assistant_role="AI 科学家，专注机器学习和人工智能研究",
    user_role="好奇的学生，对 AI 有基础了解",
    task="解释什么是 Transformer 架构，以及它为什么比 RNN 更好",
)
print(result)
```

---

## 多智能体协作架构

### 三种协作模式

```python
# ===== 模式 1：Supervisor 模式（层级）=====
"""
         Supervisor Agent
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
Researcher  Writer  Reviewer
    │         │         │
    └─────────┴─────────┘
              │
         Supervisor 决策
"""

class SupervisorMultiAgent:
    """
    Supervisor 编排多个子 Agent
    Supervisor 决定调用哪个子 Agent
    """

    def __init__(self, llm, agents: Dict[str, BaseAgent]):
        self.llm = llm
        self.agents = agents
        self.history = []

    def run(self, task: str) -> str:
        self.history = [{"role": "user", "content": task}]

        while len(self.history) < 30:
            # Supervisor 决定下一步
            decision = self.decide_next(self.history)
            print(f"Supervisor 决策：{decision}")

            if decision["type"] == "finish":
                return decision["output"]

            if decision["type"] == "agent":
                # 调用子 Agent
                agent = self.agents[decision["agent"]]
                result = agent.run(decision["task"])
                self.history.append({
                    "role": "system",
                    "content": f"[{decision['agent']}] {result}"
                })

        return "达到最大步数"

    def decide_next(self, history: List) -> Dict:
        """Supervisor 决策下一个行动"""
        agent_names = list(self.agents.keys())
        history_text = "\n".join([f"{h['role']}: {h['content'][:200]}" for h in history[-5:]])

        prompt = f"""
当前对话：
{history_text}

可用 Agent：{agent_names}

决定下一步：
{{"type": "agent", "agent": "xxx", "task": "..."}} 或
{{"type": "finish", "output": "最终答案"}}
"""
        response = self.llm.invoke(prompt)
        import json
        return json.loads(response.content)


# ===== 模式 2：同级别协作（Agent 间直接通信）=====
"""
  Agent A ←───────→ Agent B
    │                   │
    └─────────┬─────────┘
              ▼
        共享上下文存储
"""

class SharedContext:
    """共享上下文（可以用 Redis / 数据库）"""
    def __init__(self):
        self.data = {}

    def write(self, key: str, value: Any):
        self.data[key] = {"value": value, "timestamp": datetime.now()}

    def read(self, key: str) -> Any:
        return self.data.get(key, {}).get("value")

    def read_all(self) -> Dict:
        return {k: v["value"] for k, v in self.data.items()}


# ===== 模式 3：层级协作（pipeline）=====
"""
输入 → Agent A → 输出1 → Agent B → 输出2 → Agent C → 最终输出
"""

class PipelineMultiAgent:
    """流水线多 Agent"""
    def __init__(self, pipeline: List[tuple]):
        """
        pipeline: [(agent_name, prompt_template), ...]
        前一个 Agent 的输出自动填入下一个 Agent 的模板
        """
        self.pipeline = pipeline

    def run(self, initial_input: str) -> str:
        current = initial_input

        for name, prompt_template in self.pipeline:
            agent = self.agents[name]
            prompt = prompt_template.format(previous_output=current)
            result = agent.run(prompt)
            current = result
            print(f"[{name}] → {result[:100]}...")

        return current
```

---

## 工具调用设计

### 工具定义最佳实践

```python
# ===== 生产级工具定义 =====
from typing import Optional, get_type_hints
from pydantic import BaseModel, Field

class ToolInput(BaseModel):
    """工具输入 Schema（用于验证和文档生成）"""

class SearchInput(ToolInput):
    query: str = Field(description="搜索查询，不超过 100 字符", max_length=100)
    source: Optional[str] = Field(None, description="指定数据源（可选）")

class CalculatorInput(ToolInput):
    expression: str = Field(description="数学表达式，仅支持 + - * / ( )")
    precision: int = Field(4, ge=0, le=10, description="小数位数")

class SendEmailInput(ToolInput):
    to: str = Field(description="收件人邮箱")
    subject: str = Field(max_length=200, description="邮件主题")
    body: str = Field(max_length=5000, description="邮件正文")

def validate_expression(expr: str) -> bool:
    """安全验证数学表达式"""
    import re
    # 只允许数字和基本运算符
    return bool(re.match(r'^[\d\s\+\-\*\/\.\(\)]+$', expr))

def validate_email(email: str) -> bool:
    import re
    return bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email))

# 工具执行
def execute_tool(name: str, input_data: dict) -> str:
    """统一的工具执行入口"""
    validators = {
        "search": lambda d: True,  # search 暂时不验证
        "calculate": lambda d: validate_expression(d.get("expression", "")),
        "send_email": lambda d: validate_email(d.get("to", "")),
    }

    if name not in validators:
        return f"未知工具：{name}"

    if not validators[name](input_data):
        return f"输入验证失败"

    # 实际执行（这里用模拟）
    return f"工具 {name} 执行成功"
```

### OpenAI Function Calling / Tool Use

```python
# ===== OpenAI Tool Use =====
from openai import OpenAI

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如北京、上海",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位",
                    },
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "计算数学表达式",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 2+3*4",
                    },
                },
                "required": ["expression"],
            },
        },
    },
]

messages = [
    {"role": "system", "content": "你是一个有用的助手。"},
    {"role": "user", "content": "北京的天气怎么样？另外帮我算一下 15% 的税率是多少？"},
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
    tool_choice="auto",
)

# 处理工具调用
assistant_message = response.choices[0].message

if assistant_message.tool_calls:
    for call in assistant_message.tool_calls:
        tool_name = call.function.name
        args = json.loads(call.function.arguments)
        print(f"调用工具：{tool_name}({args})")

        # 执行工具
        if tool_name == "get_weather":
            result = get_weather(**args)
        elif tool_name == "calculate":
            result = str(eval(args["expression"]))

        # 将结果返回给 LLM
        messages.append({
            "role": "assistant",
            "content": assistant_message.content,
            "tool_calls": assistant_message.tool_calls,
        })
        messages.append({
            "role": "tool",
            "tool_call_id": call.id,
            "content": result,
        })

    # 再次调用获取最终回复
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    print(final_response.choices[0].message.content)
```

---

## Agent 评估

```python
# ===== Agent 评估指标 =====
"""
Agent vs LLM 评估的核心区别：
LLM 评估：输出质量（BLEU / ROUGE / 人工）
Agent 评估：任务完成度 + 效率 + 稳定性

Agent 评估维度：
1. 任务完成率：Agent 是否成功完成任务
2. 步数效率：用了多少步完成（越少越好）
3. 工具使用正确率：调用的工具是否合适
4. 幻觉率：是否产生了不存在的行动或结果
5. 循环检测：是否陷入重复循环
6. 超时率：是否经常超时
"""

class AgentEvaluation:
    def __init__(self, tasks: List[Dict]):
        self.tasks = tasks  # [{"task": "...", "expected": "..."}]

    def evaluate(self, agent: BaseAgent) -> Dict:
        results = []

        for task_data in self.tasks:
            task = task_data["task"]
            expected = task_data["expected"]

            # 运行 Agent
            result = agent.run(task)

            # 评估
            evaluation = self.evaluate_single(task, result, expected, agent.history)
            results.append(evaluation)

        return self.summarize(results)

    def evaluate_single(
        self,
        task: str,
        result: str,
        expected: str,
        history: List,
    ) -> Dict:
        """评估单次运行"""
        # 1. 任务完成率
        completion = self.check_completion(result, expected)

        # 2. 步数
        steps = len(history)

        # 3. 工具使用正确率
        tool_usage = self.check_tool_usage(history)

        # 4. 循环检测
        loops = self.detect_loops(history)

        # 5. 幻觉检测
        hallucinations = self.detect_hallucinations(history)

        return {
            "task": task,
            "result": result,
            "completion_score": completion,
            "steps": steps,
            "tool_accuracy": tool_usage,
            "loop_detected": loops,
            "hallucinations": hallucinations,
        }

    def check_completion(self, result: str, expected: str) -> float:
        """检查任务完成度"""
        # 简单实现：关键词覆盖率
        expected_words = set(expected.lower().split())
        result_words = set(result.lower().split())
        coverage = len(expected_words & result_words) / max(len(expected_words), 1)
        return coverage

    def detect_loops(self, history: List) -> bool:
        """检测是否陷入循环"""
        if len(history) < 4:
            return False

        # 检查最近 4 条是否有重复
        recent = [str(h) for h in history[-4:]]
        return len(set(recent)) == 1

    def detect_hallucinations(self, history: List) -> List[str]:
        """检测幻觉行动"""
        # 简化：检查是否调用了不存在的工具
        hallucinations = []
        for h in history:
            if "未知工具" in str(h):
                hallucinations.append(str(h))
        return hallucinations

    def summarize(self, results: List[Dict]) -> Dict:
        """汇总评估结果"""
        n = len(results)
        return {
            "total_tasks": n,
            "avg_completion": sum(r["completion_score"] for r in results) / n,
            "avg_steps": sum(r["steps"] for r in results) / n,
            "tool_accuracy": sum(r["tool_accuracy"] for r in results) / n,
            "loop_rate": sum(1 for r in results if r["loop_detected"]) / n,
            "hallucination_rate": sum(len(r["hallucinations"]) for r in results) / n,
        }
```

---

## 七大 Agent 反模式与防御

### 反模式 1：无限循环

```python
# ❌ 陷阱：没有循环检测，Agent 陷入死循环
# while True:
#     thought = agent.think(state)
#     ...

# ✅ 防御：严格限制步数 + 循环检测
MAX_STEPS = 20
visited_states = set()

for step in range(MAX_STEPS):
    state_key = hash((state.goal, tuple(state.memory[-3:])))

    if state_key in visited_states:
        print("⚠️ 检测到循环，提前终止")
        break

    visited_states.add(state_key)
```

### 反模式 2：工具注入攻击

```python
# ❌ 陷阱：用户输入直接拼进工具参数
user_input = '"); execute_system_command("rm -rf /")'
tool.execute(query=user_input)  # SQL 注入式攻击

# ✅ 防御：严格输入验证 + 沙箱
class SandboxedTool(Tool):
    def execute(self, **kwargs) -> str:
        # 1. 类型检查
        for key, expected_type in self.parameters.items():
            if key in kwargs and not isinstance(kwargs[key], eval(expected_type)):
                return f"类型错误：{key}"

        # 2. 白名单验证
        if hasattr(self, "validate"):
            self.validate(kwargs)

        # 3. 沙箱执行
        return self._sandbox_execute(kwargs)
```

### 反模式 3：无记忆盲目调用

```python
# ❌ 陷阱：每次调用都是全新上下文，没有记忆
# agent.run("task1")
# agent.run("task2")  # 完全没有 task1 的记忆

# ✅ 防御：持久化记忆 + 上下文注入
class PersistentMemoryAgent:
    def __init__(self, memory_backend):
        self.memory = memory_backend  # Vector DB / Redis / SQL

    def remember(self, query: str, n: int = 5) -> str:
        """检索相关记忆"""
        return self.memory.search(query, top_k=n)
```

### 反模式 4：过度依赖单一 Agent

```python
# ❌ 陷阱：一个 Agent 做所有事
# → 代码复杂、难以调试、能力有上限

# ✅ 防御：多 Agent 分解（见上文多智能体架构）
```

### 反模式 5：没有超时机制

```python
# ❌ 陷阱：某个工具调用卡住，整个 Agent 永久等待

# ✅ 防御：工具调用超时
import signal

class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("工具执行超时")

def safe_execute(tool, timeout=5, **kwargs):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)
    try:
        result = tool.execute(**kwargs)
    finally:
        signal.alarm(0)
    return result
```

### 反模式 6：没有回退机制

```python
# ❌ 陷阱：工具调用失败就崩溃，没有重试

# ✅ 防御：指数退避重试
def retry_with_backoff(fn, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"重试 {attempt+1}/{max_retries}，等待 {delay}s")
            time.sleep(delay)
```

### 反模式 7：缺乏人工监督

```python
# ❌ 陷阱：完全自主运行，没有人工确认机制

# ✅ 防御：高风险操作需要确认
HIGH_RISK_TOOLS = ["send_email", "execute_code", "delete_data"]

def execute_with_confirmation(tool_name: str, input_data: dict, dry_run: bool = True):
    if tool_name in HIGH_RISK_TOOLS:
        if dry_run:
            print(f"⚠️ 预览将要执行：{tool_name}({input_data})")
            # 这里接入人工确认流程
            confirmed = confirm_with_human(tool_name, input_data)
            if not confirmed:
                return "操作已取消"
    return execute_tool(tool_name, input_data)
```

---

## 总结

```
Agent 架构速查：
─────────────────────────────────────────────────────
四件套：规划(Think) → 工具(Tool) → 记忆(Memory) → 执行(Action)
核心循环：Thought → Action → Observation → Loop
─────────────────────────────────────────────────────
```

```
主流 Agent 框架速查：
─────────────────────────────────────────────────────
ReAct              推理+行动交替，最基础、最常用
Plan-and-Execute  先规划后执行，适合复杂多步骤任务
AutoGPT           自主目标分解+自我批评+长期记忆
BabyAGI            任务创建+排序+执行循环，三组件协作
CAMEL             双 Agent 角色扮演协作，对话式
─────────────────────────────────────────────────────
```

```
多智能体协作模式：
─────────────────────────────────────────────────────
Supervisor         层级：一个 Agent 指挥多个子 Agent
同级别协作         Agent 间直接通信，共享上下文
Pipeline          流水线：一个 Agent 输出作为下一个输入
─────────────────────────────────────────────────────
```

```
七大反模式：
─────────────────────────────────────────────────────
1. 无限循环        → 步数限制 + 循环检测
2. 工具注入        → 输入验证 + 沙箱
3. 无记忆          → 持久化记忆 + 上下文注入
4. 单一 Agent      → 多 Agent 分解
5. 无超时          → signal.alarm 超时机制
6. 无回退          → 指数退避重试
7. 无人工监督      → 高风险操作确认
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ 规划先行：复杂任务先用 Plan-and-Execute
✅ 工具 Schema 完整：描述 + 类型 + 验证
✅ 记忆持久化：用向量数据库存储历史
✅ 循环检测：visited_states set + 步数限制
✅ 重试机制：指数退避 + 超时控制
✅ 高风险确认：人工审核关键操作
✅ 评估驱动：任务完成率 / 步数 / 幻觉率
✅ 多 Agent 协作：按能力分解，非一股脑全塞给一个
✅ 工具注入防御：输入白名单 + 沙箱执行
✅ 日志可追溯：每步 Thought/Action/Observation 完整记录
─────────────────────────────────────────────────────
```

AI Agent 是 LLM 从"被动回答"到"主动执行"的关键跨越。ReAct 是基础，Plan-and-Execute 适合复杂任务，AutoGPT/BabyAGI 展示了自主性上限，CAMEL 开辟了多 Agent 协作的新范式。掌握这套方法论，你的 AI 才能从"会说"进化到"会做" 🦐

本文由小虾子 🦐 撰写
