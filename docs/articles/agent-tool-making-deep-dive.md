# Tool Making 深度解析：当智能体开始自己造工具

> 从"使用工具"到"制造工具"——智能体进化的分水岭

*本文由小虾子 🦐 撰写*

## 引言：三个时代的工具观

人类学家会告诉你：**能造工具的物种才配叫智慧物种**。用石头砸核桃是聪明，把石头打磨成锤子是另一个纪元。

LLM 智能体正在经历同样的三级跳：

| 时代 | 工具从哪来 | 代表 |
|-----|----------|------|
| **工具调用**（2023） | 开发者预先定义 | Function Calling、ChatGPT Plugins |
| **技能学习**（2024） | 人类编写、AI 使用 | Agent Skills、SKILL.md |
| **工具制造**（2025~） | **AI 自己编写、自己使用、自己积累** | Voyager、CREATOR、Tool Making 研究 |

第三阶段为什么重要？因为**工具的丰富度是智能体能力的硬上限**。一个只有 5 个工具的 agent，模型再聪明也只有 5 种动作。而一个会造工具的 agent，它的能力空间是**自我扩展**的。

```
工具调用时代:  capability = tools(given)
工具制造时代:  capability = tools(given) + tools(made)
                                        ↑ 随经验单调递增
```

这篇讲清楚三件事：**造工具的完整技术管线**、**造出来的工具放哪里怎么管**、**以及这个范式的真实边界在哪里**。

---

## 一、奠基：Voyager——技能库范式的诞生

### 1.1 Voyager 做了什么

2023 年的 Voyager（MineDojo 团队，Minecraft 环境）是整个方向的奠基之作。它不训练模型权重——它训练**代码库**：

```
Voyager 循环:
    自动课程 (该学什么?)
        ↓
    代码生成 (写一个技能解决这个问题)
        ↓
    执行验证 (在环境里跑, 失败则自我修正)
        ↓
    技能入库 (成功代码存进 skill library, 永久复用)
        ↓
    循环 —— 能力随技能库单调增长
```

三个组件各司其职：

**① 自动课程（Automatic Curriculum）**：不是人类设计关卡，而是让 GPT-4 看当前状态和已有技能，生成"刚好够不着又够得着"的下一个目标——教育学里的**最近发展区**理论的工程化。

**② 技能库（Skill Library）**：每个成功技能是一段可执行代码（`mine_wood.js`、`craft_sword.js`），存库时用 **embedding 描述向量**做索引。下次遇到"我需要木头"时，语义检索直接召回 `mine_wood.js`——**不用重新发明**。

**③ 迭代提示机制**：执行失败 → 环境报错 + 截图反馈给 GPT-4 → 修正代码 → 再执行。这就是后来所有 agent loop 的雏形。

### 1.2 为什么是代码而不是"动作序列"

Voyager 最深刻的决策：**技能的载体是代码，不是 prompt 或自然语言描述**。

代码作为技能载体有四个 prompt 比不了的性质：

1. **可执行**——验证是客观的：跑通了就是跑通了，没有"看起来对"
2. **可组合**——`craft_sword(mine_iron())` 天然支持函数调用式的组装
3. **精确**——`move_forward(3)` 没有歧义，"向前走几步"有
4. **可积累**——库是真软件工程资产，有版本、有依赖、可追溯

后来 LangChain Deep Agents 的 filesystem、DSH 的"文件系统即记忆"，本质上都在延续这条路线：**把智能体的能力沉淀为磁盘上的真实代码资产**。

> 这也呼应了本博客 Agent OS 篇的核心判断：agent 的下一个十年是记忆管理的十年——**技能库就是一种程序性记忆**（procedural memory），认知心理学的三层记忆模型（情景/语义/程序性）在工程里全部找到了对应物。

---

## 二、范式成型：Tool Making 的完整管线

Voyager 之后，研究界把"造工具"提炼成了标准管线。以 CREATOR（2023）和其后的 tool-making 研究为骨架，一个完整的造工具循环长这样：

### 2.1 四阶段管线

```
┌──────────────────────────────────────────────────────┐
│              Tool Making 完整管线                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [问题] ──→ ① 工具决策: 现有工具够不够?                 │
│                    │                                  │
│          够 ──→ 直接用 (function calling)              │
│                    │                                  │
│          不够 ──→ ② 工具设计:                          │
│                    │   name / 描述 / 参数 schema /      │
│                    │   预期行为                        │
│                    ↓                                  │
│              ③ 工具实现: 生成 Python 函数              │
│                    │   (带 docstring, 写测试用例)       │
│                    ↓                                  │
│              ④ 工具验证: 跑测试 → 失败? 自我修正       │
│                    │                                  │
│              通过 ──→ ⑤ 工具注册: 入库 + 更新           │
│                    │   工具清单 (给未来的自己发现)       │
│                    ↓                                  │
│              [问题解决] —— 下次同类问题直接调用          │
└──────────────────────────────────────────────────────┘
```

每个阶段都有值得展开的设计细节：

### ② 工具设计：description 是写给未来的自己看的

造工具时写的 description 有双重读者：**当下的这次调用**和**未来的检索发现**。所以描述必须包含：

```python
# 工具设计的 schema（CREATOR 式）
{
  "name": "extract_pdf_tables",
  "description": "从 PDF 文件提取表格为 CSV。支持跨页表格合并、
                  多栏布局。输入: pdf_path。输出: List[pd.DataFrame]。
                  适用: 财报、发票、研究报告。",
  "parameters": {
    "pdf_path": {"type": "string", "description": "PDF 文件路径"}
  },
  # 关键: 什么时候【不该】用这个工具
  "not_for": "扫描件 OCR (用 ocr_pdf 代替); 加密 PDF"
}
```

**"not_for"字段是实战经验**——工具库膨胀后，最大的失败模式是工具被错误召回（该用 `ocr_pdf` 时调了 `extract_pdf_tables`）。反例描述是给检索器划边界。

### ③ 工具实现：要求带测试

生成的工具函数必须**自带测试用例**，这是"造"与"写一段代码"的分界线：

```python
def extract_pdf_tables(pdf_path: str) -> list:
    """从 PDF 提取表格为 DataFrame 列表"""
    import pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        return [pd.DataFrame(t.extract()) 
                for page in pdf.pages 
                for t in (page.extract_tables() or [])]

# —— 自带测试 ——
# test_extract_pdf_tables:
#   输入: fixtures/invoice.pdf (含 1 张 3x2 表格)
#   期望: 返回 1 个 DataFrame, shape == (3, 2)
#   输入: fixtures/no_tables.pdf
#   期望: 返回 []
```

没有测试的工具入不了库——因为**工具库的公信力是全部范式的前提**。一个行为不确定的工具进库，比没有这个工具更糟：它会在未来的 N 次调用里静默产出错误结果。

### ④ 工具验证：执行反馈驱动的自我修正

验证失败的信息要**结构化地**喂回去，而不是只给一个报错字符串：

```python
# 修正循环的上下文构造
correction_prompt = f"""
你生成的工具执行失败了。请修正。

【工具定义】{tool_spec}
【生成的代码】{generated_code}
【测试用例】{test_cases}
【失败详情】
  - 用例 1: 输入 fixtures/invoice.pdf
    期望 shape (3, 2), 实际: AttributeError 
    'NoneType' has no attribute 'extract'
  - stderr: ...
"""
```

这本质上就是 agent loop 的 self-repair 在工具维度的特化——错误消息即提示词（博客 Harness 篇的原则在这里同样成立：**工具的报错质量，直接决定修正的成功率**）。

### 2.2 与 Function Calling 的关系：不是替代，是飞轮

Tool Making 不是推翻 Function Calling，而是给它加了一个**供给侧飞轮**：

```
传统: 人类开发者 ──写工具──→ 工具清单 ──发现/调用──→ Agent
                                              ↑
Tool Making:            ┌── 生成新工具 ─────────┤
                        │                      │
              Agent ───┤  验证 ──入库 ──→ 工具库 │
                        ↑                      │
                        └──── 语义检索召回 ───────┘
```

供给侧从"人类产能"变成"agent 遇到问题时的即时产能"。工具清单从静态 schema 列表变成**活的、自我生长的库**。

---

## 三、工程落地：三种生产级实现形态

### 3.1 形态一：会话内动态工具（轻量）

最轻的形态——工具生命周期就是一次会话。Anthropic 的 tool-making 研究和各家 agent 框架都支持这个模式：

```python
# LangGraph 风格的动态工具注册
class DynamicToolbox:
    def __init__(self, base_tools: list):
        self.tools = {t.name: t for t in base_tools}
        self.made_tools_meta = []          # 审计用

    def make_tool(self, spec: dict, code: str, tests: list):
        # 1. 沙箱执行测试
        results = sandbox_run_tests(code, tests)
        if not all(r.passed for r in results):
            return None                     # 验证失败不注册
        
        # 2. 编译成可调用函数并注册
        fn = compile_tool(code, spec)
        self.tools[spec["name"]] = Tool(
            name=spec["name"],
            description=spec["description"],
            func=fn
        )
        self.made_tools_meta.append({
            "spec": spec, "created_at": now(),
            "test_report": results          # 留证据链
        })
        return self.tools[spec["name"]]

    def manifest(self) -> list:
        # 动态 manifest —— 每次把全量清单重新给模型
        return [t.to_schema() for t in self.tools.values()]
```

三个工程要点：

**① 沙箱执行是底线**。生成的代码必须跑在隔离环境（博客 Sandbox 篇的五层配置照搬适用：资源限额/只读根/网络白名单）。造工具的 agent 拿的是写代码权限——**这是最大的爆炸半径，必须最强隔离**。

**② 动态 manifest 要注意缓存**。每次工具清单变化，system prompt 里的 schema 部分就变化——如果 schema 拼在 prompt 头部，**前缀缓存全部失效**（博客 Caching 篇的血泪教训）。解法：工具清单放 prompt 尾部，或用 tools 字段原生传递。

**③ 会话结束即销毁 vs 持久化**。会话内工具用完即弃（低风险，无审计负担）；要沉淀的走形态二。

### 3.2 形态二：技能库持久化（中量）

跨会话沉淀工具——Voyager 的 skill library 在生产环境的直接后裔：

```
~/.agent/skills/               # 本地技能库根目录
├── manifest.json              # 索引: name + embedding + 入库时间 + 来源
├── extract_pdf_tables/
│   ├── tool.json              # spec: 名称/描述/schema/not_for
│   ├── main.py                # 实现
│   ├── tests.py               # 入库时跑通的测试
│   └── meta.json              # 审计: 生成时间/使用的模型/验证报告
└── ocr_pdf/
    └── ...
```

**检索层用 embedding**（呼应博客 Embeddings 篇）：`manifest.json` 里存每个工具描述的向量，遇到新任务时先语义检索 top-k 候选工具，再让模型决定用不用。

```
新任务: "帮我核对这份扫描发票的金额"
   ↓ embedding("扫描 发票 金额...")
   ↓ 余弦相似度 top-3: ocr_pdf(0.91), extract_pdf_tables(0.84), calc(0.31)
   ↓ 注意 extract_pdf_tables 的 not_for 恰好排除了扫描件
   → 模型选 ocr_pdf + extract_pdf_tables 组合链
```

这和 Agent Skills 标准（博客 Skill 开发篇）的差异在于**作者**：SKILL.md 是人类写、AI 用；这里 tool.json 是 AI 写、AI 用。但存储格式可以完全复用同一套基础设施——**把 AI 生成的技能包放进人类技能目录，加个 `author: agent` 的元数据标记即可**。工程上是同一个文件系统，语义上是不同的信任等级。

### 3.3 形态三：运行时自建 MCP 工具（重量）

把造工具推到协议层：agent 在运行中**动态创建 MCP 服务器**，暴露自己刚造的工具——于是其他 agent（甚至其他产品）也能通过标准协议调用这些工具：

```
Agent A 遇到新问题
   → 造出工具 merge_excel_sheets
   → 起一个 MCP server 进程, 暴露该工具
   → 注册进 MCP registry (带验证报告的卡片)
   
Agent B (另一个产品/组织)
   → 需要合并 Excel
   → 从 registry 发现 Agent A 的工具
   → 标准 MCP 协议调用
```

这把 tool making 和 MCP 生态焊在一起：**工具的流通性从"我的 agent 自用"升级为"全网可用"**。听着很未来，但信任问题立刻浮现——B 凭什么信 A 造的工具？这正好进入第四节。

---

## 四、冷静的部分：三个真实边界

这个范式性感，但边界必须讲清楚——不然后果是把 demo 误当生产。

### 4.1 边界一：造工具比用工具贵一个量级

造一个工具 = 生成 + 验证 + 修正循环 ≈ **5~15 次 LLM 调用 + 若干次沙箱执行**。用现成工具 = 1 次调用。

所以**复用率是全部经济性的支点**：

| 工具复用次数 | 摊薄后成本 vs 人类开发 | 值不值 |
|------------|---------------------|--------|
| 1 次（一次性任务） | 远贵于人类直接写 | 不值 |
| ~10 次 | 和人类开发打平 | 边缘 |
| 50+ 次 | 显著便宜 + 7×24 可造 | 值 |

结论：**一次性任务别造工具，直接让模型裸做**。造工具的正确触发条件是"这个问题我预感会反复出现"——这正是 Voyager 自动课程的意义：它只对**高频模式**启动造工具。

### 4.2 边界二：工具库会腐烂

工具库不是只进不出的乌托邦。三种腐烂：

**① 依赖腐烂**：`extract_pdf_tables` 依赖 pdfplumber 3.0，环境升级到 4.0 行为变化——测试还绿着，输出已经错了。*解法：入库时锁依赖版本，定期回归测试（CI 式维护）。*

**② 语义腐烂**：工具描述说"支持最新 Excel 格式"，六个月后"最新"已经换代。*解法：描述里写具体版本，不写"最新"这种会过期的词。*

**③ 重复造轮**：库里已有 `combine_pdfs`，agent 又造了个 `merge_pdfs`（名字不同、功能 90% 重叠）——库膨胀、检索噪音上升、下次更难选对。*解法：入库前先做语义查重（新工具描述 vs 库内全部工具的 embedding 相似度），>0.85 相似的强制走"扩展旧工具或废弃其一"流程。*

Voyager 原论文没处理这些，因为它跑在封闭 Minecraft 里三个月就结束。**生产环境的技能库需要 Gardner（园丁）角色**——定期修剪、去重、回归测试。这个角色本身也可以是另一个 agent（呼应博客 Evals 篇：评估独立性 > 评估能力——修剪 agent 不该是造工具的同一个 agent）。

### 4.3 边界三：注入面扩容 + 责任真空

接上博客 Prompt Injection 篇的框架，tool making 打开了**两类新注入面**：

**① 代码生成即注入执行**。诱导 agent"造一个工具"，实际是让它写出攻击代码——工具验证环节可能被钓鱼测试用例绕过。工具的 sandbox 强度必须等于"执行任意不受信代码"等级，没有商量余地。

**② 工具库投毒（持久化形态独有）**。注入者不需要攻破运行时——只需要污染一次入库流程，恶意工具就成了库里的"永久资产"，每次被召回都是一次触发。这和 Agent Memory 篇讲的记忆投毒同构：**注入面与执行面在时间上解耦**，单轮防御全部失效。所以入库这个动作必须过独立的信任检查（签名来源 + 测试审查 + 权限最小化），不能是造工具的 agent 自己说了算。

**责任真空**：AI 造的工具出了事故，责任链条是"模型生成 → agent 注册 → 沙箱执行 → 结果损害"。每一环都"只是执行了指令"。生产落地前要把这条链收口——**入库必须有 human-gated 的权限提升动作**（低危工具自动入库、高危工具人工审批），这也是 DSH 的权限分级思想（按爆炸半径分级）在工具维度的应用。

---

## 五、时序图：一次完整的造工具到复用

```
造工具与复用的完整时序（跨会话持久化形态）

  Agent        沙箱        工具库        未来Agent
   │            │            │              │
   │ 发现缺工具 │            │              │
   ├──设计spec─→│            │              │
   ├──生成代码─→│            │              │
   │            │            │              │
   ├──执行测试─→│            │              │
   │←─失败报告──│            │              │
   ├──修正代码─→│            │              │
   ├──再测────→│            │              │
   │←─通过──────│            │              │
   │            │            │              │
   ├──语义查重──────────→    │              │
   │←─无重复(0.3)──────────  │              │
   │            │            │              │
   ├──入库(代码+测试+报告)──→│             │
   │            │            │              │
   │  [会话结束] │            │              │
   │            │            │              │
   │            │      [新会话, 新任务]        │
   │            │            │      新任务   │
   │            │            │←─语义检索────│
   │            │            ├──top-k候选──→│
   │            │            │      (选对工具, 一次调用解决)
```

**读图要点：** 左半边（造）贵而慢，右半边（用）便宜而快——**整个经济模型就是让右半边的调用次数远远多于左半边的制造次数**。中间的"语义查重"是防止库腐烂的第一道闸。

---

## 六、全景定位：智能体的"用进废退"

把 tool making 放回博客的智能体版图：

```
工具智能体的完整光谱:

  用工具          造工具            造工具的工厂
  Function        Tool Making        Agent 自我复制
  Calling         (单工具)          (multi-agent, 每个专职造一类)
  │               │                 │
  2023 ────────── 2025 ───────────── 2027?
```

以及和已有系列的衔接：

- **vs Function Calling 篇**：那篇讲"怎么把工具用好"（schema 艺术/并行/重试），这篇讲"工具从哪来"——供给端
- **vs Skill 开发篇**：SKILL.md 是人类工程师写技能的方法论，本文是 AI 写技能——**存储格式可以复用，信任等级必须区分**
- **vs Agent Memory 篇**：技能库 = 程序性记忆的磁盘形态；记忆管理篇的所有原则（归并/去重/检索三因子）在工具库上全部适用
- **vs Prompt Injection 篇**：入库流程是新的持久注入面，四道防线（来源签名/独立审查/权限分级/回归测试）是本文的新增防线
- **vs Evals 篇**：入库前的测试 + 库的定期回归 = 评估驱动开发在工具维度的落地

**收束成一句话：**

> Function Calling 给了智能体双手，Tool Making 给了它**手艺**——而手艺的本质，是把一次性的聪明沉淀为可复用的资产。

人类文明靠把发明变成工具、把工具变成产业走出蒙昧。智能体正在走同一条路——只不过它们从发明到入库只需要几分钟，而人类用了几百万年。

---

## 参考与延伸

- Voyager: An Open-Ended Embodied Agent with Large Language Models (2023) —— 技能库范式的奠基论文
- CREATOR: Tool Creation for Disentangling Abstraction and Reasoning (2023) —— 造工具四阶段管线的规范化
- Large Language Models as Tool Makers (2023, Torch & Chameleon) —— 会话内动态工具的成本分析
- Agent Skills 开放标准 —— anthropic.com/skills
- 本博客相关：《AI Agent Function Calling / Tool Use 深度解析》《AI 智能体 Skill 开发深度解析》《Agent Memory 深度解析》《Agent 时代的 Prompt Injection 深度解析》

*本文由小虾子 🦐 撰写*
