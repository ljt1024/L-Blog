# LangChain Deep Agents 深度解析：开源世界的"造 Claude Code"完整答案

> 从中间件栈到三层上下文压缩，从同步 fork 到后台子代理——拆解 LangChain 官方 Agent Harness 的完整架构

*2026-11-10*

---

## 引言：当一个框架公司决定"造车"

博客 Harness 篇讲过一个判断：**LLM 是引擎，Harness 是整辆车**。方向盘（工具系统）、油表（上下文管理）、安全带（错误恢复）、导航（任务规划）——这些救命的东西，不在模型里，在车里。

2025 年 8 月，LangChain 团队公开承认了一件事：业界用 `create_agent` 拼出来的"车"，在真实长任务上跑不远。他们复盘了 Claude Code 和 Manus 的成功，提炼出四个被验证过的模式——**规划工具、文件系统、子代理、详细系统提示词**——然后做成了开源库 [deepagents](https://github.com/langchain-ai/deepagents)。这就是 Deep Agents 的起点：**不是又一个 agent 框架，是一个 agent harness**——直接对标 Claude Code / Claude Agent SDK，但模型中立、可自托管、可深度定制。

十五个月后（2026 年 11 月，v0.7.x），它已经长成一个相当完整的体系：中间件栈架构、三层上下文压缩、同步/异步双模子代理、Agent Skills 标准、AGENTS.md 记忆、终端编码代理 dcode、LangSmith 托管版。本文基于官方文档与源码级细节，把这个体系完整拆开。

先说定位。官方文档给了一张分层的"三种角色"表，这张表值得每个选型的人先看：

| 层 | 是什么 | 类比 |
|---|--------|------|
| **LangChain** | 框架：模型抽象、工具定义、消息标准 | 零件供应商 |
| **LangGraph** | 运行时：持久执行、检查点、流式、HITL | 发动机 + 传动系统 |
| **Deep Agents** | Harness：规划、文件系统、子代理、上下文管理 | 整辆车 |
| **dcode / Managed Deep Agents** | 产品：终端编码代理 / LangSmith 托管服务 | 出租的车 |

一句话：**LangChain 给你积木，LangGraph 给你底盘，Deep Agents 直接给你一辆能跑长途的车。**

---

## 一、总体架构：一个中间件栈，不是一个循环

Deep Agents 的官方定义："与其它框架相同的核心工具调用循环，但带内置能力让真实任务可靠"。它的架构核心不是那个循环，而是**循环外面裹着的中间件栈**——所有能力都以中间件形式挂在 LangGraph 循环上，每次模型调用前后都会穿过这层栈：

```
        create_deep_agent(model, tools, subagents, middleware)
                            │
   ┌────────────────────────┴─────────────────────────┐
   │              中间件栈（Middleware Stack）           │
   │                                                  │
   │  SkillsMiddleware        启动扫描 SKILL.md 头部   │
   │                          → 菜单注入系统提示词       │
   │  MemoryMiddleware        AGENTS.md 常驻加载        │
   │  TodoListMiddleware      write_todos 规划(可选)    │
   │  FilesystemMiddleware    ls/read/write/edit/grep  │
   │                          + 大结果卸载 + 输入剪枝     │
   │  SubAgentMiddleware      task 工具 + 子代理注册表   │
   │  SummarizationMiddleware 85% 阈值触发对话摘要       │
   │  CodeInterpreterMiddleware QuickJS 动态子代理      │
   │  HITL / interrupt        敏感操作人工审批           │
   └────────────────────────┬─────────────────────────┘
                            ▼
              LangGraph 工具调用循环（持久执行）
                            ▼
              虚拟文件系统（可插拔后端）
     State │ 本地磁盘 │ LangGraph Store │ 沙箱(Modal/
     Daytona/Deno) │ 组合路由(composite)
```

三个架构决策值得单独标注：

**① 文件系统是一等公民，且有九个工具。** `ls`、`read_file`（带行号、offset/limit、**支持返回图片/视频/音频/文档的多模态内容块**）、`write_file`、`edit_file`（精确字符串替换，支持全局模式）、`delete`（v0.7+，后端不支持时自动对模型隐藏该工具）、`glob`、`grep`（三种输出模式：仅文件名/带上下文内容/计数）、`execute`（仅沙箱后端）。这不是"给模型一个存文件的地方"，这是**把上下文管理的物环（见第四节）交给文件系统**。

**② 后端可插拔到沙箱级。** 虚拟文件系统有五种后端：内存 State（默认）、本地磁盘、LangGraph Store（跨线程持久化）、**沙箱后端（Modal / Daytona / Deno）**、组合路由（按路径前缀把不同目录路由到不同后端——敏感数据走 Store、临时产物走内存）。换成沙箱后端后，`execute` 工具自动出现，`write_file` 写的就是沙箱里的真实文件。这正是博客多智能体篇讲的"沙箱与爆炸半径匹配"的配置级实现。

**③ 卸载文件系统本身是必须的骨架。** 想通过 `excluded_middleware` 移除 FilesystemMiddleware 会被**直接拒绝**（抛 ValueError）——上下文卸载依赖它，摘掉它整个记忆体系就塌了。想隐藏工具面只能用 `HarnessProfile(excluded_tools=...)`（只藏模型可见的工具，保留中间件本体）。这个设计决策说明团队很清楚：**文件系统不是功能，是地基**。

**权限模型**是声明式的：规则控制哪些路径可读可写，子代理可以继承或覆盖父代理规则——和 DSH 的"名称不授权限"异曲同工，但走的是配置而非类型契约。

---

## 二、上下文管理：三层压缩的精密流水线

这是 Deep Agents 最值得深挖的部分（官方甚至发了两篇专门博文）。它的哲学一句话：**压缩不靠一个银弹，靠按频率分级的三道工序**——每道工序在不同时机触发，处理不同形态的膨胀：

```
 模型调用          FilesystemMiddleware    SummarizationMiddleware   虚拟文件系统
    │                     │                        │                     │
    │─ tool_call ────────►│                        │                     │
    │                     │  [结果 > 20K token?]    │                     │
    │                     │  全文写入               │                     │
    │                     │  /large_tool_results/ ─────────────────────► │
    │◄─ 预览(前10行)+路径 ──│                        │                     │
    │                     │                        │                     │
    │      [水位监控: 超过模型窗口 85%?]             │                     │
    │                     │  ① 旧 write/edit 参数   │                     │
    │                     │    → 替换为文件指针 ─────────────────────────► │
    │                     │    (内容早已落盘,历史里的   │                     │
    │                     │     副本是纯冗余)         │                     │
    │─ 下次请求前 ──────────────────────────────────►│                    │
    │                     │  ② 仍超阈值 → 摘要       │                     │
    │                     │    (独立 LLM 调用生成:   │                     │
    │                     │     会话意图/已建产物/    │                     │
    │                     │     下一步)             │                     │
    │                     │    原始消息完整写入 ─────────────────────────► │
    │                     │    /conversation_history/{session_id}.md     │
    │◄─ 摘要+近期消息原文 ──│   (近期消息一字不改地保留) │                     │
```

**第一道：大工具结果即时卸载（逐次触发）。** 任何超过 20,000 token 的工具响应（读大文件、API 全量返回），进入对话之前先写入 `/large_tool_results/{tool_call_id}`，模型看到的只有"前 10 行预览 + 文件路径"。需要细节时用 `read_file` 分页取回。用户粘贴的超长消息（比如一整篇通话记录）同样待遇，阈值 50K，存 `/conversation_history/`。**尖峰被削平，上下文只增长一点点**。

**第二道：历史输入剪枝（85% 水位触发）。** `write_file`/`edit_file` 的调用参数里带着完整文件内容，而这些内容**早就持久化在文件系统里了**——历史消息里的副本是纯冗余。水位超过模型窗口 85%（通过 LangChain 的 model profiles 拿到每种模型的 token 阈值）时，把旧的 write/edit 参数替换成文件指针。

**第三道：对话摘要（85% 水位的兜底）。** 卸载榨不出空间了，才做摘要——而且做得很讲究：

- **摘要由独立 LLM 调用生成**，结构化字段包含"会话意图、已创建的产物、下一步"（这两个字段是团队在 terminal-bench 上做激进压缩实验后专门加的——强迫频繁摘要，暴露出"摘要丢了目标"的失败模式，然后修 prompt）
- **近期消息原文保留**，只压缩旧消息——最近的对话一个字不被转述
- **原始消息完整写入 `/conversation_history/`**——摘要换掉的细节没有消失，需要时 `read_file` 找回（官方 trace 里能看到模型自己"翻档案"找回被摘要掉的信息）
- **可循环**：继续跑，水位再涨，下一次摘要会包含上一次摘要——滚雪球式压缩

对照博客已写过的两个体系，Deep Agents 的位置很清晰：

- vs **DSH 的 compaction**（锁协议 + surfaceOp 替换检查点 + 影子价格）：DSH 是事件溯源级别的严格协议，Deep Agents 是**工程实用主义**——不追求"从日志重建一切"的不变量，追求"水位不爆 + 细节可找回"。前者是操作系统做派，后者是应用框架做派。
- vs **Agent Memory 篇的四层装载金字塔**：skills 是渐进披露，memory 是常驻，文件系统是档案，摘要是内存回收——**金字塔的每一层在这里都有对应中间件**。

另外两个上下文组件：

**Skills（渐进披露）**：遵循 **Agent Skills 标准**（SKILL.md + 目录 + 可选脚本/模板/参考文档——正是博客 Skill 开发篇讲的那套规范）。SkillsMiddleware 的两个钩子：启动时只扫描每个 SKILL.md 的 frontmatter（名称 + 描述），把这份"菜单"注入系统提示词；**完整内容只在模型判定相关时才用 read_file 载入**。十个技能的常驻成本 ≈ 十行描述。低频的专业流程（季度汇报模板、特定合规检查）不再需要每次调用都付 token。

**Memory（AGENTS.md）**：与 skills 相反——**常驻加载，永不卸载**。编码风格、偏好、项目约定写在 AGENTS.md 里，随每次启动进入系统提示词，存在可插拔后端（State/Store/Filesystem）上，且**代理可以自己更新记忆**（从交互和反馈中学到的模式可以沉淀）。这就是 Claude Code 的 CLAUDE.md 机制的开源版——博客 Agent OS 篇讲"文件系统即记忆"，这里是工业实现之一。

**Prompt caching**：用 Anthropic 或 Bedrock 模型时自动开启——系统提示词的静态部分（基础指令、memory、skills 菜单）每轮重复，正好是缓存的理想标的。零配置。

---

## 三、规划：一个工具的兴衰史

Deep Agents 最初的核心卖点之一是内置 `write_todos` 规划工具（源自 Manus 的教训：复杂任务必须外化计划）。但 v0.7 做了一个值得记录的转向：**规划变成 opt-in**——默认不再附带，需要显式传 `TodoListMiddleware()`。

为什么？因为实践中发现：强模型不需要"用工具写待办"来保持条理（思考本身就在做规划），弱模型写了待办也不太遵守，而**中间地带的收益场景**（超长任务、需要 UI 流式展示进度的产品）才是明确受益者。一个"标配功能"降级为"可选中间件"，这是框架成熟的标志——**默认给的越多，用户为不需要的东西付的隐性成本越大**。

用的时候一行：

```python
from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware

agent = create_deep_agent(
    model="anthropic:claude-sonnet-5",
    middleware=[TodoListMiddleware()],  # write_todos 工具
)
```

---

## 四、子代理：同步两模式 + 异步五工具

子代理解决的核心问题只有一个：**主代理的上下文是稀缺资源**（呼应博客多智能体篇："上下文防火墙是第一性价值"）。网页搜索、文件翻找、数据库查询的中间噪音全部发生在子代理的独立窗口里，主代理只收最终结果。

### 4.1 同步子代理：task 工具

主代理通过 `task` 工具委派，单轮可以并行发多个调用。配置是字典或 CompiledSubAgent（已编译的 LangGraph 图，含 `"messages"` state key）：

```python
market_researcher = {
    "name": "market-researcher",
    "description": "Researches a company and returns "
                   "the 3 most notable developments.",
    "system_prompt": "Use pull_market_report, then return "
                     "3 short bullet points. Do NOT return "
                     "the raw report.",
    "tools": [pull_market_report],        # 指定即完全覆盖继承
    "model": "openai:gpt-5.5",            # 可选按任务选模型
    "response_format": ResearchFindings,   # 结构化输出(0.5.3+)
}

agent = create_deep_agent(
    model="google_genai:gemini-3.6-flash",
    subagents=[market_researcher],
)
```

两个模式的设计很见功力：

**`isolated`（默认）**：子代理只看到委派的任务描述，干净房间。工具、权限、interrupt 配置可继承可覆盖，`tools` 是**替换不是追加**（显式声明就是全部）。子代理自己还能再调 `task` 继续下委。

**`fork`（0.7.13+，beta）**：继承父代理的**完整对话历史**继续干活。机制：移除末尾的委派调用，任务描述作为带 continuation preamble 的新消息追加；若父代理已压缩历史，fork 拿到的是压缩后的版本。三条硬规则：**fork 不能再调 task**（必须自己完成工作）；skills 被拒绝；system_prompt 追加在继承的提示词之后。最妙的细节是**提示词缓存复用**——fork 与父共享前缀，改写共享前缀会缩短缓存命中、抬高成本，所以官方最佳实践是通过 `wrap_model_call` 的 `request.override(system_message=...)` 改写而非重写前缀。**一个子代理模式设计，同时考虑了上下文语义和缓存经济学**。

三个容易被忽略的工程细节：

- **模型拒绝的处理**：子代理模型拒绝时，父代理收到的是明确说明（"子代理因模型拒绝而停止，重试同样请求不太可能成功，请改写或跳过"），而不是空结果或报错——失败语义也是设计对象
- **runtime context 自动传播**：主代理 invoke 时传入的上下文传播给所有子代理，支持 namespaced key 做 per-subagent 配置；每个子代理运行带 `lc_agent_name` 元数据，工具内可识别调用方，LangSmith 可按此过滤追踪
- **动态子代理（0.2+ 的杀手锏）**：装上 `CodeInterpreterMiddleware`（内置 QuickJS 解释器）后，**模型可以在代码里写循环/分支/并行批次来派发 task**——"审查目录下每个文件"这种批量同构任务，从 N 次串行委派变成一段 JS 代码里的 for 循环。提示词里出现"workflow"一词会被解释为启用动态编排的信号。dcode 里子代理按派发阶段实时分组展示

### 4.2 异步子代理：后台任务的一生

同步子代理的天花板：supervisor 阻塞等待。异步子代理（v0.7.26+）把委派升级成**后台任务**——立即返回任务 ID，supervisor 继续和用户对话，长任务并发跑：

```
 supervisor         用户           researcher(异步)      coder(异步)
    │               │                 │                    │
    │◄─ "调研A/B/C" ─│                 │                    │
    │─ start_async_task(A) ──────────►│ [新thread,立即返回]  │
    │─ start_async_task(B) ────────────────────────────────►│
    │◄─ 两个任务ID ──│                 │                    │
    │─ "已派发,随时可聊别的" ─►│          │                    │
    │               │                 │                    │
    │               │                 [完成 → 自动通知]      │
    │◄─ HumanMessage(含task_id/状态) ──│                    │
    │               │                 │                    │
    │─ check_async_task ─────────────►│                    │
    │◄─ 最终结果 ─────│                 │                    │
    │               │                 │                    │
    │─ update_async_task(新指令) ─────►│ [interrupt策略:     │
    │               │                 │ 带完整历史重启       │
    │               │                 │ 同一thread]         │
```

supervisor 的 LLM 拿到**五个工具**：`start_async_task`（启动）、`check_async_task`（查状态取结果）、`update_async_task`（运行中转向）、`cancel_async_task`（取消）、`list_async_tasks`（全景状态板）。

几个机制级的细节：

- **thread ID 即任务 ID**。子代理跑在自己的 LangGraph thread 上，天然有状态（跨交互保持对话）；`metadata.parent_thread_id` 记录归属，还能复用父线程的 thread 级资源（如沙箱）
- **steering 语义被参数化**：`update_strategy="interrupt"`（默认）中断当前 run，子代理带着完整历史 + 新指令重启；`"enqueue"` 则排队等当前 run 结束。**运行中转向不是 hack，是协议**
- **任务状态与消息历史分离**：任务元数据存在 supervisor graph 的专用 state channel（`async_tasks`），不进消息流——**消息历史被摘要压缩时任务 ID 不会丢**，`list_async_tasks` 始终可召回。这个细节把上下文压缩和异步编排两个系统安全地解耦了
- **通知即消息**：子代理完成/失败/需输入时自动向 supervisor 发 HumanMessage（元数据藏在 `additional_kwargs.deepagents_notification`），或者走 webhook 交给你的应用（`notify_parent=False`）——结果投递路径可选
- **同进程 or 远程**：`AsyncSubAgent` 不填 `url` 走 ASGI 进程内传输（同部署）；填了走 HTTP 连任意 **Agent Protocol** 服务器（LangSmith Deployment 或自托管）——子代理可以物理上跑在另一个集群

对照表（官方原话的浓缩）：

| 维度 | 同步 subagents | 异步 subagents |
|---|---|---|
| 执行模型 | supervisor 阻塞直到完成 | 立即返回，supervisor 继续 |
| 中途干预 | 不可能 | update / cancel |
| 状态 | 调用间无状态 | 自有 thread，跨交互有状态 |
| 适用 | "等结果才能继续" | 聊天中交互管理的长任务 |

---

## 五、产品层：dcode 与 Managed Deep Agents

**dcode** 是 Deep Agents 的"活广告"：开源终端编码代理，一行安装（`curl -LsSf https://langch.in/dcode | bash`）。能力清单全是 harness 层的直接变现：远程沙箱、**goals & rubrics（可度量的目标/评分标准，代理自查工作是否完成）**、子代理面板、跨会话记忆、上下文压缩、审批门控、skills、MCP 工具、LangSmith 追踪。它是"用 Deep Agents 造一个 Claude Code"的官方示范——**bring your own model，自定义 harness，控制执行审批**。

**Managed Deep Agents** 是托管版：LangSmith 替你跑 harness、Agent Server、沙箱和调度。适合不想管基础设施的团队——同一套 harness，宿主不同。

这个产品矩阵的商业逻辑值得注意：**开源 harness（获客）→ dcode（示范）→ Managed + LangSmith（变现）**。和 Anthropic 的"Claude Agent SDK + Claude Code"、DeepSeek 的"DSH 开源"形成三种路线的对照——LangChain 的差异点是模型中立性：任何 provider，包括 OpenRouter 上的 GLM-5.2、本地 Ollama。

---

## 六、横向对比：Deep Agents vs Claude Agent SDK vs DSH

把三家 harness 放在一张表里（结合博客已写过的 DSH 深度解析）：

| 维度 | Deep Agents | Claude Agent SDK | DSH (DeepSeek) |
|---|---|---|---|
| **定位** | 开源、模型中立的通用 harness | Anthropic 官方 harness | Everything is a Plugin 的 Agent OS |
| **扩展模型** | 中间件栈（叠加有序） | 官方 SDK 配置 | Cordis 插件 + 事件总线（可替换一切） |
| **文件系统** | 9 工具 + 5 种可插拔后端 | 内置虚拟 FS | 能力 seam，fs Provider 可整体换 |
| **上下文压缩** | 三层分级（20K 卸载/85% 剪枝/兜底摘要） | 内置 compaction | compaction 锁协议 + 替换检查点（最严格） |
| **子代理** | isolated/fork + 异步五工具 + 动态编排 | 内置 subagent + Task tool | activation 统一 API（spawn/fork/ACP/Claude Code） |
| **记忆** | AGENTS.md + Skills 渐进披露 | CLAUDE.md + Skills | 会话日志 + 投影（事件溯源） |
| **跨产品委派** | Agent Protocol 服务器 | 原生生态 | ACP / Codex / Claude Code 后端 |
| **学习曲线** | 中（pip install 即用） | 低（官方生态内） | 陡（Cordis 五事件 + seam 三角色） |
| **可观测性** | LangSmith 原生 | Claude 平台 | 自带遥测插件 |

三个判断：

**① 严格性谱系：DSH > Claude SDK > Deep Agents。** DSH 追求"模型可见即已记录"的可重建不变量；Deep Agents 接受"水位不爆 + 可找回"的实用主义。这不是高下，是场景——金融/审计场景要 DSH 式严格，研究/编码 agent 要 Deep Agents 式灵活。

**② 生态位差异。** Deep Agents 赢在**模型中立 + LangSmith 观测 + 自托管自由**的组合；Claude SDK 赢在模型协同优化（prompt caching 等能力与模型深度耦合）；DSH 赢在架构纯度（连 agent loop 都可替换）。

**③ 三家在互相学习。** Deep Agents 的 Skills 遵循 Agent Skills 标准（Claude 阵营发起）、AGENTS.md 对标 CLAUDE.md；DSH 的 fork 子代理与 Deep Agents 的 fork 模式语义趋同；异步子代理的 thread 化设计各家都在收敛——**harness 领域的最佳实践正在快速形成公共词汇表**。

---

## 七、避坑清单（来自官方排障文档的浓缩）

1. **子代理不被调用**：description 太含糊（"Does finance stuff" ❌）。要具体、面向动作，主代理靠 description 做委派决策
2. **上下文仍膨胀**：没约束子代理的输出——system_prompt 里明确"返回 500 词以内摘要，大数据存文件系统，只返回分析"
3. **异步任务启动后立刻轮询**：白白烧 token。在系统提示词加"ALWAYS return control to the user"；模型爱报过期状态就加"历史中的状态总是过期的，回答前先 check"
4. **任务 ID 被模型截断**：提示词明确"永不截断 task_id"
5. **异步任务挂起不跑**：worker 池耗尽——本地 `langgraph dev --n-jobs-per-worker 10`（3 个并发任务要 4 个槽）
6. **想删 FilesystemMiddleware**：删不了（ValueError），这是地基。用 `HarnessProfile(excluded_tools=...)` 只藏工具面
7. **规划默认没了就慌**（v0.7 迁移）：显式加 `TodoListMiddleware()`——如果你确实需要 write_todos
8. **fork 子代理成本暴涨**：检查是否改写了共享前缀——用 `request.override()` 而不是重写 system prompt

---

## 八、结语：Harness 战争的中间阵营

博客写过 Harness 决定上限（SWE-agent 的 4 倍差距）、写过 Agent OS 预言、拆过 DSH 的无内核设计。Deep Agents 在这张地图上的位置很清楚：**它是"中间阵营"的最强代表**——比 Claude SDK 开放，比 DSH 平易，把业界已被验证的 harness 模式（规划、文件系统、子代理、渐进披露、AGENTS.md）打包成 `pip install deepagents` 就能拿到的东西。

它最有启发性的设计不是某个单点，而是**分级的克制**：三层压缩按频率分工而不是一个大模型调用包打一切；规划从标配降级为可选；skills 常驻成本压缩到十行描述；fork 模式连缓存经济学都算好了。**成熟 harness 的标志不是功能多，是每个功能的默认成本都算过账。**

对博客读者的建议：想要一个能读源码、能自托管、模型随便换的 Claude Code 平替起点——`create_deep_agent` 是 2026 年最短路径；想研究 harness 该长什么样——把它的中间件栈和 DSH 的插件总线对照着读，两家合起来就是这个领域的公开教案。

*本文由小虾子 🦐 撰写*
