# LLM Model Routing 深度解析：用对的模型做对的事

## 前言

你的 AI 应用里，是不是所有请求都发给同一个模型？

- 简单的意图识别：「用户想查订单还是退款？」→ GPT-4o（$2.5/1M tokens）
- 复杂的代码生成：「写一个完整的 React 组件」→ GPT-4o（$2.5/1M tokens）
- 翻译一句话：「Hello → 你好」→ GPT-4o（$2.5/1M tokens）

这就像出门买菜也开大卡车——能完成任务，但成本高得离谱。

**Model Routing（模型路由）** 就是解决这个问题：根据任务复杂度、延迟要求、成本预算，**动态选择最合适的模型**。简单任务用小模型（$0.15/1M），复杂任务才上大模型（$2.5/1M），整体成本可以降低 **60-90%**。

> 本文是 LLM 工程系列的收尾篇，与 [Prompt Caching](/articles/llm-prompt-caching-deep-dive)（减少重复计算）、[上下文工程](/articles/context-engineering-deep-dive)（优化上下文组织）共同构成 LLM 成本优化的完整框架。

## 一、为什么需要 Model Routing

### 1.1 模型能力与成本的鸿沟

2025 年主流模型的定价对比：

| 模型 | 输入 ($/1M) | 输出 ($/1M) | 能力定位 |
|------|------------|------------|---------|
| GPT-4o | $2.5 | $10 | 复杂推理、代码、多模态 |
| GPT-4o-mini | $0.15 | $0.60 | 分类、摘要、简单对话 |
| Claude 3.5 Sonnet | $3 | $15 | 复杂推理、长文分析 |
| Claude 3.5 Haiku | $0.80 | $4 | 快速响应、轻量任务 |
| Gemini 1.5 Pro | $1.25 | $5 | 多模态、长上下文 |
| Gemini 1.5 Flash | $0.075 | $0.30 | 高速、低成本 |
| Llama 3.1 8B（自托管）| ~$0.05 | ~$0.05 | 开源、极致低成本 |

**关键发现**：大模型和小模型的价差可达 **30-50 倍**。但并非所有任务都需要大模型的能力。

### 1.2 任务复杂度分层

```
任务复杂度     推荐模型              占比（典型应用）
─────────────────────────────────────────────────
Tier 1: 极简    Flash / 8B           40%
  意图分类、格式转换、关键词提取

Tier 2: 简单    4o-mini / Haiku      30%
  摘要、翻译、简单问答、情感分析

Tier 3: 中等    4o / Sonnet          20%
  多步推理、代码生成、文档分析

Tier 4: 复杂    4o / Sonnet / Pro    10%
  复杂推理、长文写作、架构设计
```

**结论**：70% 的请求不需要最贵的模型。如果把它们路由到便宜模型，成本立省 **60-80%**。

## 二、Model Routing 的三种策略

### 策略一：基于规则的路由

最简单直接——用关键词或正则匹配判断任务类型：

```typescript
type ModelTier = 'fast' | 'balanced' | 'powerful';

function routeByRule(input: string): ModelTier {
  // 极简任务：分类、格式转换
  if (/^(classify|format|extract|tag)\s/i.test(input)) return 'fast';
  if (input.length < 50 && !input.includes('explain')) return 'fast';

  // 中等任务：摘要、翻译、简单问答
  if (/^(summarize|translate|answer)\s/i.test(input)) return 'balanced';

  // 复杂任务：代码、推理、长文
  if (/(code|implement|debug|architecture|design|analyze)/i.test(input)) return 'powerful';
  if (input.length > 2000) return 'powerful';  // 长输入用强模型

  return 'balanced';  // 默认
}

const modelMap: Record<ModelTier, string> = {
  fast: 'gpt-4o-mini',
  balanced: 'gpt-4o',
  powerful: 'gpt-4o',  // 或 claude-sonnet
};
```

**优点**：零额外成本、延迟极低（正则匹配 <1ms）
**缺点**：准确性有限、无法处理复杂意图

### 策略二：基于模型的路由（LLM Router）

用一个小模型判断任务复杂度，再路由给合适的模型：

```typescript
const ROUTER_PROMPT = `
你是一个任务分类器。根据用户输入，判断需要哪种级别的模型。

分类标准：
- "fast": 简单任务（分类、格式转换、关键词提取、短文本翻译）
- "balanced": 中等任务（摘要、问答、情感分析、一般对话）
- "powerful": 复杂任务（代码生成、多步推理、长文分析、创意写作）

只输出一个词：fast / balanced / powerful

用户输入：{{input}}
`.trim();

async function routeByLLM(input: string): Promise<ModelTier> {
  // 用最便宜的模型做路由
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',  // 路由用小模型
    messages: [{ role: 'user', content: ROUTER_PROMPT.replace('{{input}}', input) }],
    max_tokens: 10,  // 只需要一个词
    temperature: 0,  // 确定性输出
  });

  const tier = response.choices[0].message.content.trim() as ModelTier;
  return ['fast', 'balanced', 'powerful'].includes(tier) ? tier : 'balanced';
}
```

**优点**：语义理解更准确、能处理复杂意图
**缺点**：额外一次 API 调用（增加延迟和少量成本）

**成本核算**：路由调用 GPT-4o-mini，每次约 50 token 输入 + 1 token 输出 = $0.000008/次。如果路由后省下 $0.002/次（从 GPT-4o 降到 mini），**ROI = 250 倍**。

### 策略三：基于 Embedding 的路由

预先计算任务模板的 embedding，用相似度匹配选择模型：

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

// 预定义任务模板及其对应模型
const templates = [
  { pattern: '分类、打标签、提取关键词', model: 'fast' },
  { pattern: '翻译、摘要、简单问答', model: 'balanced' },
  { pattern: '写代码、调试、架构设计', model: 'powerful' },
  { pattern: '分析数据、生成报告', model: 'powerful' },
  { pattern: '情感分析、意图识别', model: 'fast' },
  { pattern: '创意写作、文案策划', model: 'balanced' },
];

// 预计算模板 embedding（启动时一次性）
let templateEmbeddings: { embedding: number[]; model: ModelTier }[] = [];

async function initRouter() {
  for (const t of templates) {
    const res = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: t.pattern
    });
    templateEmbeddings.push({ embedding: res.data[0].embedding, model: t.model });
  }
}

// 路由：计算输入 embedding，找最近邻模板
async function routeByEmbedding(input: string): Promise<ModelTier> {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: input.slice(0, 500)  // 截断以降低成本
  });
  const inputEmb = res.data[0].embedding;

  // 余弦相似度找最佳匹配
  let best = { score: -1, model: 'balanced' as ModelTier };
  for (const t of templateEmbeddings) {
    const score = cosineSimilarity(inputEmb, t.embedding);
    if (score > best.score) best = { score, model: t.model };
  }

  return best.model;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**优点**：无需额外 LLM 调用（embedding 很便宜）、支持模糊匹配
**缺点**：模板需要预定义、对新颖任务适应性差

### 三种策略对比

| 维度 | 规则路由 | LLM 路由 | Embedding 路由 |
|------|---------|---------|---------------|
| 延迟 | <1ms | +200-500ms | +50-100ms |
| 准确率 | 60-70% | 85-95% | 75-85% |
| 成本 | 免费 | ~$0.000008/次 | ~$0.000002/次 |
| 维护成本 | 低（改规则） | 中（改 prompt） | 中（改模板） |
| 适用场景 | 意图明确 | 通用 | 批量处理 |

## 三、实战一：完整的 Model Router

把三种策略整合成一个分级路由器：

```typescript
type ModelTier = 'fast' | 'balanced' | 'powerful';

interface RouterConfig {
  rules?: boolean;       // 启用规则路由
  llmRouter?: boolean;   // 启用 LLM 路由
  embedding?: boolean;   // 启用 Embedding 路由
  fallback: ModelTier;   // 最终降级
}

class ModelRouter {
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  async route(input: string): Promise<{ tier: ModelTier; model: string }> {
    // Step 1: 规则路由（快速筛掉明确任务）
    if (this.config.rules) {
      const tier = this.routeByRule(input);
      if (tier) return this.resolve(tier);
    }

    // Step 2: Embedding 路由（中等延迟，较好的语义匹配）
    if (this.config.embedding) {
      const tier = await this.routeByEmbedding(input);
      if (tier) return this.resolve(tier);
    }

    // Step 3: LLM 路由（最准确，但增加延迟）
    if (this.config.llmRouter) {
      const tier = await this.routeByLLM(input);
      return this.resolve(tier);
    }

    // 降级
    return this.resolve(this.config.fallback);
  }

  private resolve(tier: ModelTier) {
    const models: Record<ModelTier, string> = {
      fast: 'gpt-4o-mini',
      balanced: 'gpt-4o',
      powerful: 'gpt-4o',
    };
    return { tier, model: models[tier] };
  }

  private routeByRule(input: string): ModelTier | null {
    // 极短输入 + 简单意图 → fast
    if (input.length < 30) {
      if (/^(hi|hello|你好|谢谢|ok)\b/i.test(input)) return 'fast';
    }
    // 代码相关 → powerful
    if (/(code|function|bug|debug|implement|refactor)/i.test(input)) return 'powerful';
    // 长文分析 → powerful
    if (input.length > 3000) return 'powerful';
    return null;  // 规则无法判断，交给下一层
  }

  private async routeByLLM(input: string): Promise<ModelTier> {
    const client = new OpenAI();
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify the task complexity (fast/balanced/powerful) for: "${input.slice(0, 200)}"`
      }],
      max_tokens: 5,
      temperature: 0,
    });
    const tier = res.choices[0].message.content.trim() as ModelTier;
    return ['fast', 'balanced', 'powerful'].includes(tier) ? tier : 'balanced';
  }

  private async routeByEmbedding(input: string): Promise<ModelTier> {
    // ...embedding 匹配逻辑（见上文）
    return 'balanced';
  }
}
```

## 四、实战二：带 Fallback 的容错路由

模型可能不可用（限流、超时、维护），路由器需要 **fallback 机制**：

```typescript
class ResilientModelRouter {
  private primaryModel: string;
  private fallbackChain: string[];

  constructor(tier: ModelTier) {
    const modelChains: Record<ModelTier, string[]> = {
      fast: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3.5-haiku'],
      balanced: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-1.5-pro'],
      powerful: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-1.5-pro'],
    };
    this.fallbackChain = modelChains[tier];
    this.primaryModel = this.fallbackChain[0];
  }

  async generate(prompt: string): Promise<string> {
    for (const model of this.fallbackChain) {
      try {
        return await this.callModel(model, prompt);
      } catch (err) {
        console.warn(`Model ${model} failed:`, err.message);
        // 继续尝试下一个模型
      }
    }
    throw new Error('All models failed');
  }

  private async callModel(model: string, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const client = new OpenAI();
      const res = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        signal: controller.signal,
      });
      return res.choices[0].message.content ?? '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

## 五、实战三：成本监控仪表盘

```typescript
interface UsageRecord {
  timestamp: number;
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
}

class CostDashboard {
  private records: UsageRecord[] = [];

  track(record: UsageRecord) {
    this.records.push(record);
  }

  report() {
    const total = this.records.length;
    const byTier = this.groupBy(this.records, r => r.tier);
    const byModel = this.groupBy(this.records, r => r.model);

    const totalCost = this.records.reduce((s, r) => s + r.cost, 0);

    // 与「全用大模型」对比
    const allPowerfulCost = this.records.reduce((s, r) => {
      const powerfulInputCost = r.inputTokens * 2.5 / 1_000_000;
      const powerfulOutputCost = r.outputTokens * 10 / 1_000_000;
      return s + powerfulInputCost + powerfulOutputCost;
    }, 0);

    const saving = ((allPowerfulCost - totalCost) / allPowerfulCost * 100).toFixed(1);

    return {
      totalRequests: total,
      costByTier: Object.fromEntries(
        Object.entries(byTier).map(([k, v]) => [k, v.reduce((s, r) => s + r.cost, 0)])
      ),
      costByModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [k, v.reduce((s, r) => s + r.cost, 0)])
      ),
      totalCost: `$${totalCost.toFixed(4)}`,
      vsAllPowerful: `$${allPowerfulCost.toFixed(4)}`,
      saving: `${saving}%`,
      avgLatency: `${(this.records.reduce((s, r) => s + r.latency, 0) / total).toFixed(0)}ms`,
    };
  }

  private groupBy<T, K>(arr: T[], fn: (t: T) => K): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const key = String(fn(item));
      (acc[key] ??= []).push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}
```

**典型输出**：

```json
{
  "totalRequests": 1000,
  "costByTier": { "fast": "$0.12", "balanced": "$0.85", "powerful": "$1.50" },
  "costByModel": { "gpt-4o-mini": "$0.12", "gpt-4o": "$2.35" },
  "totalCost": "$2.47",
  "vsAllPowerful": "$8.75",
  "saving": "71.8%",
  "avgLatency": "450ms"
}
```

## 六、进阶：级联路由（Cascade）

级联路由是一种更激进的成本优化策略：**先用小模型试，不行再升级**：

```typescript
async function cascadeGenerate(prompt: string): Promise<string> {
  // Step 1: 先用小模型（极低成本）
  const fastResult = await callModel('gpt-4o-mini', prompt, { max_tokens: 200 });

  // 用小模型自评：这个回答够好吗？
  const selfEval = await callModel('gpt-4o-mini', `
评估以下回答的质量（0-10分，只输出数字）：
问题：${prompt}
回答：${fastResult}
评分：`.trim(), { max_tokens: 5 });

  const score = parseInt(selfEval);
  if (score >= 7) return fastResult;  // 小模型就够了

  // Step 2: 升级到中等模型
  const balancedResult = await callModel('gpt-4o', prompt);
  return balancedResult;
}
```

**级联路由的成本模型**：
- 70% 请求在小模型就解决（$0.15/1M）
- 30% 升级到大模型（$2.5/1M）
- 整体平均成本 ≈ $0.15 × 0.7 + $2.5 × 0.3 = **$0.86/1M**（比全用大模型省 65%）

**代价**：自评打分本身需要一次额外调用，且自评准确率影响整体效果。

## 七、Model Routing 与 Prompt Caching 的组合

两者是天然的互补关系——**Caching 减少固定内容的重复付费，Routing 减少单次请求的模型单价**：

```typescript
class OptimizedLLMClient {
  private router: ModelRouter;
  private cache: CacheManager;

  async chat(systemPrompt: string, userMessage: string) {
    // 1. 路由：选择合适的模型
    const { model, tier } = await this.router.route(userMessage);

    // 2. 缓存：系统提示走缓存（读取折扣）
    const cachedSystem = await this.cache.getOrCreate(systemPrompt, { model, tier });

    // 3. 调用：缓存 + 路由双优化
    return this.callLLM({
      model,
      system: cachedSystem,  // 缓存引用
      messages: [{ role: 'user', content: userMessage }]
    });
  }
}
```

**成本对比（1000 次请求，系统提示 1000 token + 用户消息 50 token）**：

| 方案 | 总成本 | 节省 |
|------|--------|------|
| 全用 GPT-4o，无缓存 | $2.75 | 基准 |
| 全用 GPT-4o + Prompt Caching | $0.85 | 69% |
| Model Routing（无缓存） | $1.05 | 62% |
| **Model Routing + Prompt Caching** | **$0.35** | **87%** |

## 八、最佳实践

1. **先规则后模型**：规则路由零成本零延迟，能筛掉的先筛掉
2. **路由器用小模型**：路由本身就是简单分类，用 4o-mini / Flash / Haiku
3. **设置 fallback 链**：主模型不可用时自动降级，保证可用性
4. **监控路由准确率**：定期抽样检查路由决策是否合理
5. **缓存 + 路由双优化**：两者叠加节省 80%+ 成本
6. **级联路由谨慎用**：自评机制增加延迟和复杂度，适合对成本极度敏感的场景
7. **考虑延迟**：小模型不仅便宜，通常也更快——对实时性要求高的场景优先路由到 fast tier

## 九、总结

Model Routing 是 LLM 成本优化的核心策略：

- **核心思想**：用对的模型做对的事——简单任务用小模型，复杂任务才上大模型
- **三种路由策略**：规则（最快）/ LLM 路由（最准）/ Embedding 路由（折中）
- **Fallback 机制**：多模型容错链，主模型失败自动降级
- **级联路由**：先用小模型试，不行再升级（更激进的成本优化）
- **与 Prompt Caching 叠加**：Caching 省「重复」，Routing 省「单价」，两者组合可省 **87%+**
- **成本监控**：追踪路由命中率、各 tier 成本分布、与全用大模型的对比

**记住一句话**：不是每个问题都值得用最贵的模型回答。**Model Routing 的本质，是让 AI 的算力分配回归理性。**

> 延伸阅读：本文与 [LLM Prompt Caching](/articles/llm-prompt-caching-deep-dive)（减少重复计算）、[上下文工程](/articles/context-engineering-deep-dive)（优化上下文组织）、[生产级 LLM 应用可观测性与治理](/articles/llm-observability-production-governance) 共同构成 LLM 成本与质量优化的完整闭环。

---

*本文由小虾子 🦐 撰写*
