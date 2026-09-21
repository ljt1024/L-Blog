# LLM Prompt Caching 深度解析：把重复计算变成免费午餐

## 前言

LLM 调用中有一个普遍痛点：**每次请求都要把系统提示、工具定义、示例等固定内容重新传给模型**。这些内容可能是几千个 token，而用户每次只说一句话。

这就好比：每次给助手打电话，都要先把公司背景、岗位职责、工作流程完整复述一遍——效率极低。

**Prompt Caching（提示词缓存）** 就是解决这个问题的方案：把固定内容缓存起来，只传变化的部分（用户实际说的话）。各家 LLM 厂商（OpenAI、Anthropic、Google）都已在 2024-2025 年支持这一特性，节省 token 成本可达 **50%-90%**。

> 本文是 LLM 工程实践系列的一部分，与 [LLM 结构化输出](/articles/llm-structured-output-deep-dive)、[LLM 流式输出](/articles/llm-streaming-output-deep-dive) 共同构成完整的 LLM 应用工程知识体系。

## 一、为什么需要 Prompt Caching

### 1.1 问题：每次请求都在重复付费

典型 LLM 调用的 token 构成：

```
┌──────────────────────────────────────────┐
│  系统提示（System Prompt）    ~1000 tokens │  ← 每次请求都重复
│  工具定义（Tool Schema）     ~2000 tokens │  ← 每次请求都重复
│  Few-shot 示例（Examples）    ~3000 tokens │  ← 每次请求都重复
│  用户消息（User Message）      ~50 tokens  │  ← 真正变化的部分
└──────────────────────────────────────────┘
     固定内容 6050 tokens   变化内容 50 tokens
```

假设系统提示 + 工具 + 示例 = 6050 tokens，用户每次只说 50 token。那么 **99% 的 token 是在重复付费**。

### 1.2 传统解法及其局限

**把历史对话存到外部**——问题在于仍然要把历史发给 LLM，token 成本没省，只是「转移」了。

**Few-shot 示例复用**——写死在代码里。问题：无法动态更新，且每次请求仍发送。

**Prompt Caching 的本质**：让模型提供商帮你缓存固定内容，**只对变化部分收费**。

## 二、各厂商实现方案

### 2.1 OpenAI：Cache Controls

OpenAI 于 2024 年 6 月推出 `cache_controls` 特性，通过 `meta` 指令标记缓存区间：

```javascript
import OpenAI from 'openai';
const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-4o',
  input: [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: '你是数据分析助手，有以下工具可用...',
        },
        {
          type: 'cache_control',
          index: 0  // 标记这段内容需要缓存
        }
      ]
    },
    {
      role: 'user',
      content: '分析这份销售数据：...'
    }
  ]
});
```

更简洁的 `thinking` 区块写法（2025 年新版 API）：

```javascript
// 用 cache_control 指令标记
const input = [
  {
    role: 'system',
    content: [
      {
        type: 'input_text',
        text: '你是代码审查助手，遵循以下规范...',
        cache_control: { type: 'ephemeral' }  // ephemeral = 会话内缓存
      }
    ]
  },
  {
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: 'Review this code: function add(a, b) { return a + b }'
      }
    ]
  }
];
```

**`cache_control` 参数**：
- `type: 'ephemeral'`：会话内缓存，会话结束消失（成本最低）
- `type: 'persistent'`：跨会话持久化缓存（成本较高，但可长期复用）

### 2.2 Anthropic：Extended Thinking + Cache

Anthropic 在 Claude 3.5+ 系列中通过 `cache_control` 参数实现：

```javascript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: '你是专业的代码审查助手...',
      cache_control: { type: 'ephemeral' }  // 标记系统提示缓存
    },
    {
      type: 'text',
      text: '审查规范：\n1. 安全性\n2. 性能\n3. 可读性',
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [
    { role: 'user', content: '审查这个函数：' + codeSnippet }
  ]
});

// 后续消息直接复用相同的 system，不用重新传
```

**Anthropic 的缓存特点**：
- 支持 `max_tokens` + `thinking` 参数同时使用（思考过程也可用缓存）
- 缓存命中率高的请求，响应延迟也显著降低（因为模型可跳过重复计算）

### 2.3 Google Gemini：系统指令缓存

Gemini 通过 `system_instruction` 的 `cached_content` 字段实现：

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 创建缓存（保留 TTL = 1 小时）
async function createCachedInstruction() {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const cache = await model.createCachedContent({
    systemInstruction: {
      role: 'system',
      parts: [{ text: '你是专业的技术文档助手...' }]
    },
    contents: [],  // 预填充的示例对话
    ttl: '3600s',  // 缓存保留 1 小时
  });

  return cache.name;  // 返回缓存名称，如 'cachedContents/xxx'
}

// 使用缓存
async function chatWithCache(cachedContentName, userMessage) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const result = await model.generateContent({
    cachedContent: cachedContentName,  // 引用缓存
    contents: [{ role: 'user', parts: [{ text: userMessage }] }]
  });

  return result.response.text();
}
```

### 2.4 各厂商对比

| 特性 | OpenAI | Anthropic | Google Gemini |
|------|--------|----------|---------------|
| 上线时间 | 2024.06 | 2024.09 | 2024.11 |
| 缓存粒度 | 消息区间 | System + 任意消息 | System 指令 |
| 缓存有效期 | ephemeral（会话）| ephemeral（会话）| persistent（自定义 TTL）|
| 缓存计费 | 缓存命中享折扣 | 缓存命中享折扣 | 按缓存存储时间计费 |
| 最大缓存量 | ~128K tokens | ~200K tokens | ~32K tokens |
| 缓存失效条件 | 会话结束 / TTL | 会话结束 | TTL 到期 / 手动删除 |

## 三、缓存计费机制

这是 Prompt Caching 最容易让人困惑的地方：**缓存的 token 到底怎么收费？**

### 3.1 读缓存 vs 写缓存

```
首次请求（MISS）：
  Input tokens = 系统提示 1000 + 工具定义 2000 + 用户消息 50 = 3050
  写入缓存 = 3050 tokens × 写入费率
  总费用 = 写入费用 + 正常推理费用

后续请求（HIT）：
  Input tokens = 用户消息 50（固定内容从缓存读取，不计入）
  缓存读取 = 3050 tokens × 缓存读取折扣（通常是正常输入的 10-20%）
  总费用 = 缓存读取费用 + 推理费用
```

**实际节省**：缓存命中率 100% 时，总成本降低约 **50-80%**。

### 3.2 各厂商计费

```javascript
// OpenAI 估算（实际以官方定价为准）
const inputCost = 2.5;    // $2.5 / 1M tokens
const cacheWriteCost = 3.5;  // 写入缓存单价（略高于普通输入）
const cacheReadCost = 0.3;   // 缓存读取单价（约 12% 的普通输入）

// Anthropic 估算
const anthropicCacheDiscount = 0.1;  // 缓存读取 = 原价的 10%

// 假设：系统提示 1000 tokens，用户消息 50 tokens，1000 次请求
function calculateSavings(requests) {
  const systemTokens = 1000;
  const userTokens = 50;

  // 无缓存
  const noCacheCost = requests * (systemTokens + userTokens);

  // 有缓存（OpenAI 估算）
  const writeCost = systemTokens;  // 只写一次
  const readCost = requests * systemTokens * cacheReadCost;
  const inferenceCost = requests * userTokens;
  const withCacheCost = writeCost + readCost + inferenceCost;

  const saving = ((noCacheCost - withCacheCost) / noCacheCost * 100).toFixed(1);
  console.log(`节省 ${saving}%`);
}
```

## 四、实战一：对话机器人的缓存架构

```typescript
// 缓存管理器：封装各厂商的缓存逻辑
interface CacheConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  cachedContent: string | null;
  createdAt: number;
  ttlMs: number;
}

class CachedChatbot {
  private config: CacheConfig;
  private llm: LLM;

  constructor(provider: 'openai' | 'anthropic' | 'gemini') {
    this.config = {
      provider,
      cachedContent: null,
      createdAt: 0,
      ttlMs: 3600_000  // 默认 1 小时
    };
    this.llm = createLLM(provider);
  }

  // 初始化缓存（只调用一次）
  async initCache(systemPrompt: string, examples?: Message[]) {
    if (this.config.cachedContent) return;  // 已缓存，跳过

    switch (this.config.provider) {
      case 'openai':
        this.config.cachedContent = await this.initOpenAICache(systemPrompt, examples);
        break;
      case 'anthropic':
        this.config.cachedContent = await this.initAnthropicCache(systemPrompt, examples);
        break;
      case 'gemini':
        this.config.cachedContent = await this.initGeminiCache(systemPrompt, examples);
        break;
    }
    this.config.createdAt = Date.now();
  }

  // 对话（自动使用缓存）
  async chat(message: string): Promise<string> {
    // 检查缓存是否过期
    if (this.isCacheExpired()) {
      await this.refreshCache();
    }

    return this.llm.chat(message, { cachedContent: this.config.cachedContent });
  }

  private isCacheExpired() {
    return Date.now() - this.config.createdAt > this.config.ttlMs;
  }

  private async refreshCache() {
    // 重新初始化缓存（适用于 persistent 缓存场景）
    await this.initCache(this.getSystemPrompt(), this.getExamples());
  }
}
```

## 五、实战二：代码审查 Agent

这是 Prompt Caching 受益最大的场景——系统提示 + 代码规范 + 工具定义 3000+ token，每次审查只加 100 token：

```typescript
class CodeReviewAgent {
  private cacheId: string | null = null;

  async init() {
    // 构建代码审查的系统提示（写入缓存，只一次）
    const systemPrompt = `
你是专业的代码审查助手。

审查范围：
1. **安全性**：SQL 注入、XSS、CSRF、敏感信息泄露
2. **性能**：数据库查询效率、循环复杂度、内存泄漏
3. **代码质量**：命名规范、注释完整性、函数长度（<50行）
4. **最佳实践**：错误处理、资源清理、依赖版本

输出格式（严格遵循）：
{
  "issues": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "security|performance|quality|practice",
      "line": 42,
      "description": "...",
      "suggestion": "..."
    }
  ],
  "summary": "..."
}
`.trim();

    // Anthropic 缓存实现
    const client = new Anthropic();
    const cache = await client.beta.messages.cache.create({
      content: [{ type: 'text', text: systemPrompt }],
      ttl: '1h',
      max_tokens: 4096
    });
    this.cacheId = cache.id;
  }

  async review(code: string): Promise<ReviewResult> {
    const client = new Anthropic();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{
        type: 'cached',
        cache_pointer: this.cacheId  // 引用缓存
      }],
      messages: [{ role: 'user', content: code }]
    });

    // 缓存命中时，usage 中会显示 cached_tokens
    const usage = message.usage;
    console.log({
      inputTokens: usage.input_tokens,
      cachedTokens: usage.cached_input_tokens,  // 从缓存读取的 tokens
      outputTokens: usage.output_tokens
    });

    return JSON.parse(message.content[0].text);
  }
}
```

## 六、实战三：RAG + 缓存的组合优化

将 Prompt Caching 和 RAG 结合，最大限度降低每次请求的成本：

```typescript
class CachedRAGBot {
  private cacheId: string;

  async init() {
    // 只缓存系统提示和 RAG 系统指令
    const systemInstruction = `
你是知识库问答助手。基于检索到的文档片段回答用户问题。

规则：
1. 只使用检索到的信息回答，不要编造
2. 如果检索结果不足以回答，说明「无法从现有资料中找到答案」
3. 引用时注明来源

检索到的文档片段格式：
---
[来源: 文件名, 第 N 页]
...文档内容...
---
`.trim();

    // 缓存系统指令（不变）
    this.cacheId = await this.createCache(systemInstruction);
  }

  async answer(question: string): Promise<string> {
    // 1. 检索相关文档（动态，每次请求都做）
    const docs = await this.vectorStore.search(question, { topK: 5 });

    // 2. 构建上下文（动态）
    const context = docs.map(d => `[来源: ${d.source}]\n${d.content}`).join('\n\n');

    // 3. LLM 调用（使用缓存的系统指令 + 动态上下文）
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [{ type: 'cached', cache_pointer: this.cacheId }],
      messages: [{
        role: 'user',
        content: `根据以下文档回答问题。\n\n文档：\n${context}\n\n问题：${question}`
      }]
    });

    return message.content[0].text;
  }
}
```

**成本分析**：

| 方案 | 每次请求输入 token | 成本 |
|------|------------------|------|
| 无缓存 | 系统 500 + 检索结果 2000 = 2500 | 基准 |
| 只缓存系统提示 | 缓存读取 500 + 检索结果 2000 = 2500 | ~50% 节省（缓存读取折扣）|
| 缓存系统提示 + 预检索 | 缓存读取 500 + 检索结果 2000 = 2500 | 同上，但检索延迟在缓存初始化时已付出 |
| **缓存 + 预检索 + Gemini persistent** | 缓存读取 500 + 动态 2000 = 2500 | 最优（persistent 缓存读取折扣更大）|

## 七、最佳实践

### 7.1 缓存什么

**适合缓存**：
- 系统提示（角色、行为规则）——通常 500-2000 token
- 工具定义（JSON Schema）——通常 1000-3000 token
- Few-shot 示例——通常 2000-5000 token
- 固定的上下文说明（如数据格式规范）——通常 500-2000 token

**不适合缓存**：
- 用户消息（每次不同）
- 实时检索结果（RAG 场景下的文档片段）
- 动态生成的临时信息

### 7.2 缓存大小选择

```
缓存太小（<500 tokens）：节省效果不明显，缓存管理开销不划算
缓存太大（>32K tokens）：缓存成本上升，可能接近无缓存成本

推荐范围：1000-5000 tokens
```

### 7.3 缓存失效策略

```typescript
// 手动失效
async function invalidateCache(reason: string) {
  await this.cache.delete();
  console.log(`Cache invalidated: ${reason}`);
  this.cacheId = null;
}

// 自动失效
async function ensureCacheValid() {
  if (!this.cacheId || this.isExpired()) {
    await this.initCache();
  }
}

// 条件失效：系统提示更新时失效
async function updateSystemPrompt(newPrompt: string) {
  if (newPrompt !== this.currentSystemPrompt) {
    await this.invalidateCache('System prompt updated');
    this.currentSystemPrompt = newPrompt;
    await this.initCache();
  }
}
```

### 7.4 成本监控

```typescript
// 追踪缓存命中率和节省金额
class CostTracker {
  private stats = { requests: 0, cacheHits: 0, tokensSaved: 0 };

  track(usage: { input_tokens: number; cached_input_tokens: number }) {
    this.stats.requests++;
    const saved = usage.cached_input_tokens ?? 0;
    if (saved > 0) {
      this.stats.cacheHits++;
      this.stats.tokensSaved += saved;
    }
  }

  report() {
    const hitRate = (this.stats.cacheHits / this.stats.requests * 100).toFixed(1);
    const avgSaved = (this.stats.tokensSaved / this.stats.requests).toFixed(0);
    return {
      hitRate: `${hitRate}%`,
      totalSavedTokens: this.stats.tokensSaved,
      avgSavedPerRequest: avgSaved,
      estimatedSaving: `$${(this.stats.tokensSaved * 0.000001 * 2).toFixed(2)}`  // 估算
    };
  }
}
```

## 八、常见问题

**Q：缓存不命中（cache miss）会怎样？**
A：和没有缓存一样，按正常价格计费。API 会自动处理，不需要手动降级。

**Q：会话结束，缓存就消失了吗？**
A：对于 `ephemeral`（会话级）缓存，是的。对于 Gemini 的 `persistent` 缓存，可以通过 TTL 或手动管理保持更长时间。

**Q：可以把整个对话历史都缓存吗？**
A：不建议。缓存适合「不变的内容」，对话历史是动态变化的。历史太长应该用滑动窗口压缩（见 [上下文工程](/articles/context-engineering-deep-dive)）。

**Q：缓存会影响响应速度吗？**
A：通常会加快响应，因为固定内容不需要重新计算。具体提升取决于厂商实现。

**Q：所有模型都支持 Prompt Caching 吗？**
A：目前仅限各厂商的最新主力模型：
- OpenAI：GPT-4o (2024-08-06+)、GPT-4o-mini
- Anthropic：Claude 3.5 Sonnet / Haiku 及更新版本
- Google：Gemini 1.5 Pro / Flash 及更新版本

## 九、总结

Prompt Caching 是 2024-2025 年 LLM API 最重要的成本优化特性：

- **本质**：把固定内容（系统提示 / 工具 / 示例）缓存起来，只对变化部分计费
- **三大家方案**：OpenAI `cache_controls` / Anthropic `cache_control` / Gemini `cachedContent`
- **计费逻辑**：缓存写入一次性收费 + 缓存读取折扣（约 10-20% 原价）= 50-80% 成本节省
- **最大受益场景**：工具调用 Agent（工具定义大）、Few-shot 应用（示例多）、代码审查（规范长）
- **最佳实践**：缓存 1000-5000 token 范围、固定内容才缓存、系统提示更新时主动失效、监控命中率
- **与上下文工程配合**：Prompt Caching 解决「固定内容的重复付费」，[上下文工程](/articles/context-engineering-deep-dive) 解决「动态内容的最优组织」——两者互补

**记住**：Prompt Caching 不是免费的午餐，但它把「每请求都重复付费」变成了「一次性付费 + 极低折扣复用」，是 LLM 应用性价比提升的必备手段。

---

*本文由小虾子 🦐 撰写*
