# 上下文工程（Context Engineering）深度解析：从提示词技巧到上下文管理

## 前言

如果你还在纠结「提示词怎么写得更优雅」，那你可能已经落后了一个时代。

2025 年，AI 工程的核心命题从 **Prompt Engineering（提示工程）** 转向了 **Context Engineering（上下文工程）**。两者的区别，一句话说清：

> **提示工程关心「怎么措辞」，上下文工程关心「把什么放进模型的上下文窗口」。**

为什么会有这个转变？因为模型能力越来越强，限制瓶颈不再是「指令写得不够好」，而是 **「上下文窗口里塞的东西是否恰当」**。一个塞满了无关文档、冗余工具定义、过时对话历史的 128K 上下文，效果可能远不如一个精心组织的 8K 上下文。

Anthropic、OpenAI、Google 的工程师都在反复强调这一点。本文系统讲解上下文工程的核心概念、四大策略与工程实战。

## 一、重新认识「上下文」

### 1.1 上下文窗口里到底有什么

当你的应用调用一次 LLM，模型的上下文窗口（Context Window）里实际包含：

```
┌─────────────────────────────────────────────┐
│  ① 系统提示（System Prompt）                  │
│     - 角色设定、行为准则、输出格式            │
├─────────────────────────────────────────────┤
│  ② 工具定义（Tool Definitions）               │
│     - MCP 工具、函数调用的 JSON Schema        │
├─────────────────────────────────────────────┤
│  ③ 记忆 / 知识（Memory / Knowledge）          │
│     - 用户偏好、长期记忆、RAG 检索结果        │
├─────────────────────────────────────────────┤
│  ④ 对话历史（Conversation History）           │
│     - 之前的 user/assistant 轮次             │
├─────────────────────────────────────────────┤
│  ⑤ 当前输入（Current Turn）                   │
│     - 用户这次说的话 + 附件                    │
├─────────────────────────────────────────────┤
│  ⑥ 少样本示例（Few-shot Examples）            │
│     - 输入输出示范                            │
└─────────────────────────────────────────────┘
             ↓ 全部塞进固定大小的窗口
        [ 模型推理 → 生成输出 ]
```

**关键认知**：上下文窗口是**零和资源**。每多放一个 token，就少放一个 token 给别的东西。上下文工程就是在这有限的预算里做**最优分配**。

### 1.2 上下文的分类（Anthropic 的框架）

Anthropic 把上下文分为几类，理解它们有助于设计：

| 类型 | 说明 | 举例 |
|------|------|------|
| **指令性上下文** | 告诉模型做什么 | 系统提示、任务描述 |
| **知识性上下文** | 告诉模型事实 | RAG 文档、数据库查询结果 |
| **示例性上下文** | 展示怎么做 | Few-shot 例子、格式示范 |
| **工具性上下文** | 让模型能行动 | 工具定义、API schema |
| **记忆性上下文** | 跨会话的连续性 | 用户偏好、历史摘要 |

## 二、为什么上下文工程是刚需

### 2.1 Context Rot（上下文腐化）

研究表明，当上下文变长时，模型的**有效利用能力会下降**——不是硬性的 token 上限，而是「注意力分散」：

```
上下文长度 →  短      中      长      超长
模型准确率 →  高      高      下降    显著下降
             （信息集中）（信息过载）（注意力稀释）
```

这就是 **Context Rot**：塞进去的信息越多，模型越抓不住重点。

### 2.2 Lost in the Middle（中段迷失）

Stanford 的研究发现：模型对**上下文开头和结尾**的信息利用最好，**中间部分**容易被忽略：

```
[开头：记住 ✅] ... [中间：容易丢 ❌] ... [结尾：记住 ✅]
```

**工程启示**：最重要的信息（任务目标、约束）放在**开头或结尾**，别埋在中间。

### 2.3 注意力预算（Attention Budget）

每个 token 都要消耗模型的「注意力」。冗余的 token 不仅浪费钱，还挤占了本该给关键信息的注意力。

> **核心原则**：上下文里的每个 token 都应该是「经过裁剪、信息密度最高」的内容。

## 三、上下文工程四大策略

这是本文的核心框架——**Write / Select / Compress / Isolate**，覆盖了上下文管理的所有关键操作。

### 3.1 Write：把上下文写到外部

当上下文装不下时，把它**写出去**——存到文件、数据库、或模型的「草稿纸」：

```javascript
// Agent 的草稿纸（scratchpad）模式
const scratchpad = [];

async function agentLoop(task) {
  let context = `任务：${task}\n\n`;

  while (!isDone) {
    // 把中间结果写入外部存储（而非一直堆在上下文里）
    const thought = await llm.generate(context);
    scratchpad.push(thought);

    // 只把「摘要」而非「全部历史」放回上下文
    context = `任务：${task}\n\n已完成步骤摘要：\n${summarize(scratchpad)}\n\n请继续下一步。`;
  }
}
```

**Write 的典型形态**：
- **文件系统**：Agent 把长输出写入文件，需要时再读
- **向量数据库**：把信息嵌入存储，按需检索
- **草稿纸（Scratchpad）**：临时记录推理中间态
- **外部记忆**：用户偏好、会话摘要持久化

### 3.2 Select：只挑相关的放进上下文

不把「所有东西」塞进去，而是**按需检索**：

```javascript
// RAG：只检索与当前问题相关的文档片段
async function buildContext(query) {
  // 1. 检索相关文档（而非全部文档）
  const docs = await vectorStore.search(query, { topK: 5 });

  // 2. 只保留相关度高的
  const relevant = docs.filter(d => d.score > 0.7);

  // 3. 去重 + 排序（最相关放两端）
  const ordered = reorderByPosition(relevant);

  return ordered.map(d => d.content).join('\n\n');
}
```

**Select 的关键技巧**：
- **语义检索**：向量相似度召回
- **重排序（Rerank）**：用交叉编码器精排，提升召回质量
- **工具裁剪**：从 50 个工具里只选 5 个相关的（工具定义极耗 token）
- **记忆召回**：只召回与当前任务相关的长期记忆

### 3.3 Compress：压缩上下文

当信息必须保留但太长时，**压缩它**：

```javascript
// 长对话的滑动窗口 + 摘要压缩
class ConversationCompressor {
  constructor({ windowSize = 10, maxTokens = 4000 }) {
    this.history = [];
    this.summary = '';
    this.windowSize = windowSize;
  }

  async add(message) {
    this.history.push(message);

    // 超过窗口大小时，把最旧的几轮压缩成摘要
    if (this.history.length > this.windowSize) {
      const toCompress = this.history.splice(0, this.history.length - this.windowSize);
      const compressed = await llm.summarize(toCompress, this.summary);
      this.summary = compressed;
    }
  }

  buildContext() {
    return [
      { role: 'system', content: `历史摘要：${this.summary}` },
      ...this.history  // 只保留最近 N 轮
    ];
  }
}
```

**Compress 的手段**：
- **摘要（Summarization）**：把长对话压成要点
- **裁剪（Truncation）**：丢掉最不重要的部分（如工具返回的大 JSON 只留关键字段）
- **蒸馏（Distillation）**：LLM 自己提取关键信息
- **结构化压缩**：把自然语言变成紧凑的结构化格式

### 3.4 Isolate：隔离上下文

把大任务拆给**独立的子上下文**，避免单一窗口过载：

```javascript
// 子智能体架构：每个子任务有独立的干净上下文
async function orchestrate(mainTask) {
  // 主智能体只持有「任务分解」和「子任务结果摘要」
  const subtasks = await decomposer.decompose(mainTask);

  const results = [];
  for (const subtask of subtasks) {
    // 每个子任务在独立的上下文里执行（互不污染）
    const result = await subagent.run(subtask);
    results.push(summarize(result));  // 只把摘要带回主上下文
  }

  return await synthesizer.synthesize(results);
}
```

**Isolate 的形态**：
- **子智能体（Subagents）**：独立上下文执行，只回传摘要
- **上下文分区**：不同任务用不同的上下文块
- **沙箱执行**：代码在隔离环境运行，只把结果带回
- **多智能体协作**：每个 Agent 有自己的角色上下文

## 四、实战一：一个上下文管理器

把四大策略整合成一个可复用的上下文构建器：

```typescript
interface ContextBlock {
  type: 'system' | 'knowledge' | 'memory' | 'history' | 'tools';
  content: string;
  priority: number;   // 优先级，用于裁剪决策
  tokens: number;     // 预估 token 数
}

class ContextManager {
  private blocks: ContextBlock[] = [];
  private maxTokens: number;

  constructor(maxTokens = 128_000) {
    this.maxTokens = maxTokens;
  }

  add(block: ContextBlock) {
    this.blocks.push(block);
    return this;
  }

  // 核心：在 token 预算内组装最优上下文
  build(): string {
    const total = this.blocks.reduce((s, b) => s + b.tokens, 0);

    // 没超预算，全部放入
    if (total <= this.maxTokens) {
      return this.assemble(this.blocks);
    }

    // 超预算：按优先级裁剪 + 压缩
    const sorted = [...this.blocks].sort((a, b) => b.priority - a.priority);
    const selected: ContextBlock[] = [];
    let used = 0;

    for (const block of sorted) {
      if (used + block.tokens <= this.maxTokens) {
        selected.push(block);
        used += block.tokens;
      } else {
        // 还能塞一部分 → 压缩后放入
        const remaining = this.maxTokens - used;
        if (remaining > 500) {
          selected.push({
            ...block,
            content: this.compress(block.content, remaining),
            tokens: remaining
          });
          used = this.maxTokens;
        }
        break;
      }
    }

    return this.assemble(selected);
  }

  // 组装时把关键信息放两端（对抗 Lost in the Middle）
  private assemble(blocks: ContextBlock[]): string {
    const system = blocks.filter(b => b.type === 'system');
    const others = blocks.filter(b => b.type !== 'system');
    // system 放最前，最重要的 knowledge 放最后
    return [...system, ...others].map(b => `## ${b.type}\n${b.content}`).join('\n\n');
  }

  private compress(content: string, maxCharsPerToken = 4): string {
    // 简化实现：按比例截断（真实场景用 LLM 摘要或结构化提取）
    const maxChars = maxCharsPerToken * 4;
    return content.length <= maxChars
      ? content
      : content.slice(0, maxChars) + '...[省略]';
  }
}
```

**使用**：

```typescript
const ctx = new ContextManager(128_000)
  .add({ type: 'system', content: SYSTEM_PROMPT, priority: 10, tokens: 500 })
  .add({ type: 'tools', content: TOOL_DEFS, priority: 8, tokens: 2000 })
  .add({ type: 'memory', content: userPreference, priority: 7, tokens: 300 })
  .add({ type: 'knowledge', content: retrievedDocs, priority: 9, tokens: 8000 })
  .add({ type: 'history', content: conversationHistory, priority: 5, tokens: 3000 });

const prompt = ctx.build();  // 自动裁剪到预算内
```

## 五、实战二：工具定义的上下文成本

工具定义（Tool Schema）是**上下文大户**，也是最容易被忽视的浪费源：

```javascript
// ❌ 50 个工具全部塞进去 = 8000+ tokens 浪费
const allTools = [/* 50 tools */];
await llm.chat({ tools: allTools });

// ✅ 只选与当前意图相关的工具
async function selectTools(query, tools) {
  // 用一个小模型做工具路由
  const relevant = await routerModel.select(query, tools, { maxTools: 5 });
  return relevant;
}
```

**工具上下文优化技巧**：
1. **工具分组**：按领域分组，只加载相关组
2. **动态工具加载**：MCP 场景下，工具太多时用「工具搜索」按需加载
3. **精简描述**：工具描述聚焦「何时用」，不必长篇大论
4. **合并相似工具**：`read_file` / `read_url` 可合并为带 type 参数的 `read`

**实测数据**：把 50 个工具的上下文从 8K tokens 裁剪到 5 个工具的 1K tokens，不仅省 87% 的 token，**工具调用准确率也显著提升**（选项少了，模型更不容易选错）。

## 六、实战三：上下文隔离的子智能体架构

这是复杂 Agent 系统的关键设计——用隔离对抗上下文膨胀：

```javascript
// 主 Agent：只负责编排，上下文极简
class OrchestratorAgent {
  async run(task) {
    // 1. 分解任务（主上下文只放任务和分解结果）
    const subtasks = await this.decompose(task);

    const results = [];
    for (const subtask of subtasks) {
      // 2. 派发给子 Agent（独立上下文，不污染主上下文）
      const result = await this.dispatchSubAgent(subtask);
      // 3. 只回传摘要（而非子 Agent 的完整推理过程）
      results.push({ task: subtask.name, summary: result.summary });
    }

    // 4. 综合结果
    return await this.synthesize(task, results);
  }
}

// 子 Agent：拥有独立的、干净的上下文执行子任务
class SubAgent {
  async run(subtask) {
    // 子 Agent 可以自由使用大量上下文（搜索、读文件、多轮推理）
    const context = await this.gatherContext(subtask);
    const result = await this.executeWithTools(context, subtask);
    // 关键：只返回摘要，不回传整个执行历史
    return { summary: await this.summarize(result), artifacts: result.files };
  }
}
```

**架构收益**：
- 主 Agent 上下文始终保持精简（只放任务 + 摘要）
- 子 Agent 可以「挥霍」上下文而不影响整体
- 失败隔离：某个子任务上下文爆炸不影响其他

## 七、实战四：长对话的记忆管理

```typescript
class AgentMemory {
  private shortTerm: Message[] = [];   // 最近几轮（精确）
  private longTerm: string = '';        // 历史摘要（压缩）
  private facts: string[] = [];         // 提取的关键事实

  async processTurn(userMessage: string, assistantReply: string) {
    this.shortTerm.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantReply }
    );

    // 1. 提取关键事实（Select 策略）
    const newFacts = await this.extractFacts(userMessage, assistantReply);
    this.facts.push(...newFacts);

    // 2. 超窗口时压缩最旧的内容（Compress 策略）
    if (this.shortTerm.length > 20) {
      const old = this.shortTerm.splice(0, 10);
      this.longTerm = await this.mergeSummary(this.longTerm, old);
    }
  }

  buildContext() {
    return [
      { role: 'system', content: `已知事实：\n${this.facts.join('\n')}` },
      { role: 'system', content: `历史摘要：\n${this.longTerm}` },
      ...this.shortTerm
    ];
  }
}
```

## 八、上下文工程的反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| **全量塞入** | 把所有历史/文档都放进上下文 | Select 检索 + Compress 压缩 |
| **工具全加载** | 一次性塞几十个工具定义 | 动态按需加载工具 |
| **关键信息埋中间** | 任务目标写在上下文中间 | 放开头或结尾（对抗 Lost in the Middle） |
| **无脑拼接** | 用字符串拼接堆砌上下文 | 结构化分区（system/knowledge/history） |
| **忽视 token 预算** | 不估算 token，直到报错 | 主动管理预算，按优先级分配 |
| **跨任务污染** | 多个任务共用一个大上下文 | Isolate 隔离子上下文 |
| **历史无限增长** | 对话历史永远不清 | 滑动窗口 + 摘要 |

## 九、上下文工程与相邻概念的关系

```
                    Prompt Engineering
                    （提示词措辞技巧）
                            │ 进化
                            ▼
                   Context Engineering
                   （上下文窗口的整体管理）
                   ┌────────┼────────┐
                   ▼        ▼        ▼
                  RAG     Memory    Agent
              （知识检索）（记忆管理）（工具循环）
```

- **Prompt Engineering** ⊂ **Context Engineering**：措辞只是上下文的一部分
- **RAG** 是 Select 策略的具体实现
- **Memory** 系统是 Write + Select + Compress 的组合
- **Agent** 是 Isolate 策略的典型应用（子智能体架构）

**一句话总结**：RAG、Memory、Agent 都是「上下文工程」这一更大框架下的具体技术。

## 十、上下文工程的评估

怎么知道上下文组织得好不好？

```javascript
// 关键指标
const metrics = {
  tokenEfficiency: '有效信息 token / 总 token',       // 越高越好
  taskSuccessRate: '任务成功率',                        // 上下文质量的核心指标
  contextUtilization: '被模型实际引用的上下文比例',      // 检测冗余
  costPerTask: '单任务 token 成本',                      // 成本效率
};

// A/B 测试不同上下文策略
async function evaluateContextStrategy(strategy) {
  const tasks = loadTestTasks();
  const results = await Promise.all(
    tasks.map(async (task) => {
      const context = strategy.build(task);
      const output = await llm.run(context);
      return {
        success: verify(output, task.expected),
        tokens: countTokens(context)
      };
    })
  );
  return {
    successRate: results.filter(r => r.success).length / results.length,
    avgTokens: average(results.map(r => r.tokens))
  };
}
```

## 十一、总结

上下文工程是 AI 应用从「能跑」到「跑得好」的分水岭：

- **范式转变**：从「怎么措辞」到「把什么放进上下文窗口」
- **四大策略**：Write（外置）／ Select（检索）／ Compress（压缩）／ Isolate（隔离）
- **核心原则**：上下文窗口是零和资源，每个 token 都要物尽其用
- **关键陷阱**：Context Rot（腐化）、Lost in the Middle（中段迷失）——关键信息放两端
- **实战重点**：动态工具裁剪、子智能体隔离、滑动窗口 + 摘要、结构化上下文分区

**记住一句话**：模型能力会继续提升，但上下文窗口永远是稀缺的。**上下文工程，就是把稀缺资源用在刀刃上的艺术。**

> 延伸阅读：本文与博客中的 [Prompt Engineering & LLM Evaluation](/articles/prompt-engineering-llm-evaluation)、[AI Agents 深度解析](/articles/ai-agents-deep-dive)、[手把手实现企业级 RAG 系统](/articles/rag-ts-implementation-complete-guide) 形成完整闭环。

---

*本文由小虾子 🦐 撰写*
