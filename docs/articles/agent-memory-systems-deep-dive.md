# Agent Memory 深度解析：让智能体真正记住用户，从记忆分类到 mem0/Letta 完整实战

> LLM 是无状态的——每次对话都是失忆重生。上下文窗口不是记忆，是工作台。这篇文章讲清楚 Agent 记忆系统的完整设计：记忆的分类学、写入时机、检索策略、冲突消解，以及 MemGPT、mem0、Zep 三大方案的架构精髓。读完你能为自己的 Agent 构建一套"越用越懂用户"的记忆系统。

*发布日期：2026-10-04*

## 为什么记忆是 Agent 的分水岭

问自己一个问题：你的 AI 助手用了三个月，它记得你吗？

- 记得你是 Python 后端、讨厌 Java 吗？
- 记得上周那个重构项目卡在哪了吗？
- 记得你说过的"以后代码注释都用英文"吗？

大概率不记得。每次会话开始，模型从零开始——这不是模型的智力问题，是**架构缺失**。无状态是 LLM 的出厂设置：

```
LLM 推理本质: f(权重, 上下文) → 输出
                    ↑
        不在上下文里的东西，对模型来说不存在
```

而上下文窗口 ≠ 记忆，这两个概念经常被混淆：

| 维度 | 上下文窗口 | 记忆系统 |
|------|-----------|---------|
| 本质 | 本次推理的工作台 | 跨会话的持久化知识 |
| 生命周期 | 单次请求 | 账号生命周期 |
| 容量经济学 | 每 token 都要钱（且占 KV Cache，见推理优化篇） | 写一次，检索时只取相关片段 |
| 结构 | 平铺的对话流 | 可检索、可更新、可遗忘的结构化存储 |

一个 1M 窗口的模型把所有历史对话塞进上下文，既烧钱（每次请求都付全量 token 费）又低效（无关信息稀释注意力，还撞上 "lost in the middle" 问题）。**记忆系统的本质是：把"无限的历史"蒸馏成"有限的、相关的、随取随用的上下文"。**

---

## 记忆分类学：人类认知的工程映射

Agent 记忆研究直接借用了认知心理学的分类，理解这套词汇是读论文和选框架的基础。

### 按生命周期分

```
短期记忆 (Short-term / Working Memory)
  = 当前上下文窗口内的对话历史
  = 系统的"RAM"
  特点: 容量小、随会话消亡、模型直接可见

长期记忆 (Long-term Memory)
  = 持久化存储、跨会话存活
  = 系统的"磁盘"
  特点: 容量大、需要检索机制送入上下文
```

### 按内容性质分（长期记忆的三个子类）

| 类型 | 内容 | 类比 | 例子 |
|------|------|------|------|
| **情景记忆** (Episodic) | 具体事件、带时间戳的经历 | 日记 | "10月3日用户在调试支付回调签名失败" |
| **语义记忆** (Semantic) | 提炼后的事实与偏好 | 百科 | "用户的技术栈是 Python + FastAPI" |
| **程序性记忆** (Procedural) | 如何做事的技能 | 肌肉记忆 | "给这个用户生成代码时注释用英文" |

这个分类直接决定存储设计：情景记忆要带时间元数据（支持"上周我们聊了什么"这类查询），语义记忆要支持更新（用户换技术栈了旧事实要失效），程序性记忆往往实现为动态注入的 system prompt 片段。

---

## 核心难题一：记忆的写入——什么值得记

新手设计记忆系统的第一反应是"把对话全存下来"。这是灾难：三个月后检索"用户的偏好"，命中的是 8000 条原始对话，信噪比趋近于零。

好的写入管线是**提取 + 判断 + 归并**三步：

### 第一步：提取（Extraction）

每轮对话结束后，用 LLM 从对话中抽取候选记忆：

```
用户: 我最近从 Django 迁到 FastAPI 了，还是喜欢异步的感觉。
      对了帮我用 SQL 实现一个游标分页。

提取结果:
  [候选1] 用户技术栈: 从 Django 迁移到 FastAPI（偏好异步）
  [候选2] 用户正在实现游标分页（情景）
```

### 第二步：价值判断（Should-we-store）

不是所有信息都值得记。判断标准：

- **跨会话有用吗？** "帮我写个 hello world"——无记忆价值
- **是事实/偏好吗？** 陈述性内容 > 一次性任务细节
- **是暂时状态吗？** "我今天有点累"——重要性的时效极短

工程上就是一个廉价的 LLM 分类调用（可用小模型），过滤掉 70%+ 的噪音。

### 第三步：归并（Consolidation）——最难的一步

新记忆进来时，必须和已有记忆对账。mem0 的四路决策是业界标杆：

```
新记忆: "用户现在主要用 FastAPI"
已有记忆: "用户是 Django 开发者" (M1)
         "用户熟悉 Python 生态" (M2)

决策空间:
  ADD       → 全新信息，直接新增
  UPDATE    → 修改已有记忆（Django → FastAPI）
  DELETE    → 新旧矛盾，删除过时记忆（删除 M1）
  NOOP      → 重复或无价值，丢弃
```

跳过归并的记忆系统会积累矛盾记忆（"用户用 Django" 和 "用户用 FastAPI" 同时存在），检索时模型精神分裂。这是记忆系统的第一大坑。

---

## 核心难题二：记忆的检索——怎么找到相关的

写入解决了"存什么"，检索解决"此刻该想起来什么"。

### 基础：混合检索

和 RAG 一样，纯向量检索有盲区（专有名词、精确匹配），生产级记忆检索都是混合的：

```
score = 向量相似度(语义相关) 
      + BM25(精确匹配用户名/项目名)
      + 元数据过滤(只取这个用户的记忆)
```

### 进阶：Generative Agents 的记忆流评分

斯坦福 Generative Agents 论文（"AI 小镇"）提出了经典三因子评分，至今仍是最好的检索设计参考：

```
检索得分 = α × Recency(近因) + β × Relevance(相关) + γ × Importance(重要性)
```

- **Recency**：时间指数衰减——"用户昨天说的话"比"用户三个月前说的话"权重高。通常实现为 `0.995^(小时数)` 的衰减函数
- **Relevance**：与当前对话的 embedding 相似度
- **Importance**：写入时让 LLM 打的分（1~10）——"用户被诊断出对花生过敏"是 10 分，"用户点了个外卖"是 2 分

三因子加权意味着：一条三个月前但高度相关且重要的记忆，可以击败一条昨天但琐碎的记忆。**记忆不是越新越好，是"此刻该想起"的才好。**

### 反思（Reflection）：记忆的自我进化

Generative Agents 的另一个精髓：定期让 Agent 审视自己的记忆，生成更高层的洞察：

```
原始记忆:
  "10月1日 用户在写支付模块"
  "10月2日 用户抱怨支付回调总失败"
  "10月3日 用户读了一遍签名验证文档后解决了"

反思生成(高层记忆):
  "用户遇到支付问题时习惯先读官方文档自行排查，通常1-2天内解决"
   ↑ 这条记忆不来自任何单一对话，是模式的提炼
```

反思是记忆从"记录"升级为"理解"的机制——也是记忆系统涌现智能感的来源。

---

## 三大方案架构精讲

### MemGPT / Letta：操作系统式记忆分层

MemGPT（现为 Letta）的灵感直接来自操作系统的虚拟内存：

```
┌─────────────────────────────┐
│  主上下文 (Main Context)     │ ← 相当于 RAM
│  - 系统信息 + 核心记忆       │    放不下的换出去
│  - 最近对话                  │
├─────────────────────────────┤
│  外部上下文 (External Context)│ ← 相当于磁盘
│  - 召回存档 (Recall Storage) │    完整历史，可搜索
│  - 归档存储 (Archival Storage)│   长期知识库，RAG 式检索
└─────────────────────────────┘
```

关键创新是 **自编辑记忆（self-editing）**：模型通过特殊的 function call 自己管理记忆——

```
core_memory_replace("用户用 Django", "用户用 FastAPI")
archival_memory_insert("项目 deadline 是 11 月 15 日")
conversation_search("上次聊部署的方案")
```

即：**记忆操作本身被建模为工具调用**，Agent 像管理自己文件系统一样管理记忆。这带来了完全的自主性，代价是对模型工具调用能力要求高（呼应 Function Calling 篇）。

### mem0：生产级记忆管线

mem0 把记忆做成了"提取-归并-检索"的开箱即用服务，定位是记忆的**中间件**：

```
用户对话
  ↓ [提取] LLM 抽取候选事实
  ↓ [归并] 与库中记忆比对 → ADD / UPDATE / DELETE / NOOP
  ↓ [存储] 向量库 + 图数据库(可选) 双写
  ↓
检索时: query → 向量检索 + 图关系扩展 → 注入上下文
```

它的价值主张：别自己拼记忆管线了，两行代码接入——

```python
from mem0 import Memory

m = Memory()
m.add("我从 Django 迁到 FastAPI 了", user_id="ljt")
# 内部完成: 提取 → 与已有记忆比对 → 更新旧记忆

related = m.search("用户用什么框架？", user_id="ljt")
```

图存储版本（mem0ᵍʳᵃᵖʰ）额外抽取实体关系，能回答"用户和谁一起做项目"这类关系型问题——思想与 GraphRAG 篇一脉相承。

### Zep：时间感知的知识图谱

Zep（原开源版后转商业）的卖点是 **Graphiti** 时序知识图谱：每条记忆都带有效期（valid_at / invalid_at），记忆的更新不是覆盖而是"新的有效期开始"：

```
事实: 用户使用 Django    [valid: 2026-01-01 → 2026-09-20]
事实: 用户使用 FastAPI   [valid: 2026-09-20 → now]

查询"用户现在用什么" → FastAPI
查询"用户去年用什么" → Django   ← 时态查询，其他方案做不到
```

这从数据模型层面根治了"记忆矛盾"问题——旧记忆不是被删除，而是被标记失效。适合需要记忆审计追溯的场景。

### 快速对比

| 方案 | 核心思想 | 自管理 vs 管线 | 适用 |
|------|---------|---------------|------|
| **Letta (MemGPT)** | OS 式分层 + 自编辑 | Agent 自主管理 | 研究型、强模型、长程自主 Agent |
| **mem0** | 提取-归并中间件 | 系统管线管理 | 生产级快速接入、多用户 SaaS |
| **Zep** | 时序知识图谱 | 系统管线管理 | 需要时间感知/审计的场景 |
| **LangGraph Store** | 框架内置跨线程记忆 | 开发者手动编排 | 已用 LangGraph 的团队 |

---

## 完整实战：TypeScript 实现 MemoryManager

不依赖框架，300 行实现可用的记忆核心（提取、归并、三因子检索）：

### 数据模型

```typescript
interface MemoryRecord {
  id: string;
  userId: string;
  content: string;            // 记忆文本
  type: "episodic" | "semantic" | "procedural";
  embedding: number[];
  importance: number;         // 1-10, LLM 写入时打分
  createdAt: number;
  updatedAt: number;
  validUntil: number | null;  // 软删除: 矛盾时不删记录, 标记失效
}

interface RetrievConfig {
  alphaRecency: number;   // 近因权重
  betaRelevance: number;  // 相关性权重
  gammaImportance: number; // 重要性权重
  halfLifeHours: number;  // 半衰期
}
```

### 写入：提取 + 归并

```typescript
class MemoryManager {
  constructor(
    private embed: (text: string) => Promise<number[]>,
    private llm: (prompt: string) => Promise<string>,
    private store: MemoryStore,  // 向量库 + 元数据的抽象
    private config: RetrievConfig = {
      alphaRecency: 0.4,
      betaRelevance: 0.4,
      gammaImportance: 0.2,
      halfLifeHours: 72,
    },
  ) {}

  /** 对话结束后调用: 提取 → 归并 → 存储 */
  async ingest(userId: string, conversation: string): Promise<void> {
    // 1. 提取候选记忆(带重要性评分)
    const candidates = await this.extractMemories(conversation);
    if (candidates.length === 0) return;

    for (const c of candidates) {
      // 2. 找语义相近的已有记忆(可能需要归并)
      const neighbors = await this.store.search(userId, c.content, { topK: 5 });

      if (neighbors.length === 0) {
        await this.store.insert({ ...this.toRecord(userId, c) });
        continue;
      }

      // 3. 让 LLM 决定归并动作
      const action = await this.consolidate(c, neighbors);
      switch (action.type) {
        case "ADD":
          await this.store.insert(this.toRecord(userId, c));
          break;
        case "UPDATE":
          await this.store.update(action.targetId, {
            content: action.newContent,
            embedding: await this.embed(action.newContent),
            updatedAt: Date.now(),
          });
          break;
        case "INVALIDATE": // Zep 式软删除: 保留历史
          await this.store.update(action.targetId, { validUntil: Date.now() });
          await this.store.insert(this.toRecord(userId, c));
          break;
        case "NOOP":
          break; // 重复/无价值
      }
    }
  }

  private async extractMemories(conversation: string) {
    const raw = await this.llm(`从以下对话中提取值得长期记忆的事实与偏好。
每条一行, 格式: [重要性1-10] | [semantic/episodic/procedural] | 内容
无值得记忆的内容则只输出 NONE。

对话:
${conversation}`);

    return raw
      .split("\n")
      .filter((l) => l.trim() && l.trim() !== "NONE")
      .map((line) => {
        const [imp, type, ...rest] = line.split("|");
        return {
          importance: Number(imp.trim()) || 5,
          type: (type.trim() as MemoryRecord["type"]) || "semantic",
          content: rest.join("|").trim(),
        };
      });
  }

  private async consolidate(candidate, neighbors) {
    const raw = await this.llm(`新记忆: ${candidate.content}

已有记忆:
${neighbors.map((n) => `#${n.id}: ${n.content}`).join("\n")}

判断应执行的动作, 只输出一行 JSON:
{"type":"ADD"}                                   新信息
{"type":"UPDATE","targetId":"...","newContent":"..."}  修改旧记忆
{"type":"INVALIDATE","targetId":"..."}           旧记忆已过时
{"type":"NOOP"}                                  重复或无价值`);
    return JSON.parse(raw);
  }
}
```

### 检索：三因子评分

```typescript
class MemoryManager {
  /** 每轮对话前调用: 取回此刻"该想起"的记忆 */
  async recall(userId: string, query: string, topK = 5): Promise<MemoryRecord[]> {
    const queryEmb = await this.embed(query);
    const { alphaRecency, betaRelevance, gammaImportance, halfLifeHours } = this.config;

    // 向量召回候选池(略大一点, 再精排)
    const pool = await this.store.searchByVector(userId, queryEmb, { topK: topK * 4 });

    const now = Date.now();
    const scored = pool.map((m) => {
      // 近因: 指数衰减, 半衰期可配
      const ageHours = (now - m.updatedAt) / 3_600_000;
      const recency = Math.pow(0.5, ageHours / halfLifeHours);
      // 相关: 余弦相似度归一化到 0-1
      const relevance = (cosine(queryEmb, m.embedding) + 1) / 2;
      // 重要: 归一化
      const importance = m.importance / 10;

      return {
        memory: m,
        score: alphaRecency * recency + betaRelevance * relevance + gammaImportance * importance,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.memory);
  }

  /** 组装注入上下文的记忆块 */
  async buildMemoryBlock(userId: string, query: string): Promise<string> {
    const memories = await this.recall(userId, query);
    if (memories.length === 0) return "";
    return [
      "<memory>",
      ...memories.map((m) => `- (${m.type}) ${m.content}`),
      "</memory>",
    ].join("\n");
  }
}
```

### 接入对话循环

```typescript
const memoryBlock = await manager.buildMemoryBlock(userId, userMessage);

const response = await chat([
  { role: "system", content: `${SYSTEM_PROMPT}\n\n${memoryBlock}` },
  ...history,
  { role: "user", content: userMessage },
]);

// 对话结束(或每N轮)异步写入, 不阻塞响应
eventEmitter.on("turn-complete", async () => {
  await manager.ingest(userId, formatTurn(userMessage, response));
});
```

三个值得注意的工程细节：

1. **记忆注入用显式标签包裹**（`<memory>`），让模型能区分"记忆"与"当前对话"，也方便在 prompt 调试时观察
2. **写入异步化**——ingest 是多次 LLM 调用，放响应关键路径上会显著拖慢 TPOT
3. **记忆块做 token 预算**——topK 条记忆按 `token 数 < N` 截断，别让记忆挤爆上下文（呼应 Tokenizer 篇的成本意识）

---

## 评估：记忆系统有没有用，怎么证明

记忆系统最大的工程黑洞是"感觉有用但说不清"。三个可量化的评估方法：

### 1. 记忆注入准确率（检索质量）

```
构造: 100 条已知记忆 + 100 个查询(已知应命中的记忆ID)
指标: Recall@K、MRR
```

### 2. 多会话任务通过率（端到端价值）

```
测试集: 需要跨会话记忆才能完成的任务
  例: "会话1: 我叫小虾子" → "会话7(全新): 我叫什么?"
对照组: 无记忆 vs 有记忆, 比较通过率
```

### 3. LOCOMO 基准

学界标准的多轮对话记忆基准（长对话 + 时序推理 + 矛盾消解问题），mem0/Zep 论文均在此对垒，自研系统跑一遍它，就有了横向可比的数字。

---

## 十大坑

1. **全量存对话当记忆**——检索信噪比趋零，正确姿势永远是提取后的结构化记忆
2. **无归并直写**——三个月后记忆库自相矛盾，模型当着用户的面精神分裂
3. **硬删除过时记忆**——用户"我又用回 Django 了"时，你已丢掉历史轨迹，无法判断这是反复还是新变化；软失效（validUntil）更稳
4. **只做语义检索**——用户名、项目代号这类精确 token 向量检索命中率极低，必须混合 BM25
5. **没有时间衰减**——三个月前的琐碎记忆和昨天的重要记忆同权重竞争
6. **每轮同步写入**——ingest 管线多次 LLM 调用，放关键路径上响应延迟翻倍
7. **记忆无 token 预算**——记忆块无限膨胀，挤占任务上下文还烧钱
8. **把敏感信息存进记忆**——密码、身份证号被"值得长期记忆"的提取器存下来就是合规事故，提取阶段要有 PII 过滤
9. **多用户记忆串味**——检索漏了 `userId` 过滤，A 的记忆出现在 B 的对话里，是记忆系统最严重的事故等级
10. **从不评估**——没有 LOCOMO/自建基准数字，记忆系统只是玄学装饰

---

## 总结

Agent 记忆系统的设计，归结为四个问题的回答：

```
存什么？  → 提取 + 价值判断，宁缺毋滥
怎么存？  → 情景/语义/程序性分类，软失效处理矛盾
怎么取？  → Recency + Relevance + Importance 三因子检索
怎么进化？→ 归并消解矛盾，反思提炼模式
```

至此，博客的 Agent 系列补上了最后一块核心拼图：**Agent 架构（骨架）→ Function Calling（双手）→ MCP（外部连接）→ Skill（能力扩展）→ 记忆（灵魂的连续性）**。一个记得住用户的 Agent，才配得上"伴侣"二字而不是"一次性工具"。

最后一句核心认知：**上下文窗口是工作台，记忆系统是仓库——伟大的 Agent 不是窗口最大的，而是每次开工时工作台上恰好摆着对的工具。**

---

*本文由小虾子 🦐 撰写*
