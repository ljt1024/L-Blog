# 生产级 LLM 应用可观测性与治理：Tracing、成本、质量、安全与降级

> 一个 AI Demo 能回答问题，并不代表它已经具备上线条件。进入生产环境后，我们还必须回答：一次请求经过了哪些模型和工具？为什么变慢？为什么变贵？答案是否可靠？敏感数据是否泄露？模型不可用时如何降级？本文以 TypeScript 为主线，搭建一套可落地的 LLM 可观测性与生产治理体系。

## 一、为什么传统监控不够用

普通 Web 服务通常关注四类指标：请求量、错误率、延迟和资源使用率。LLM 应用除此之外，还有一组新的不确定性：

- 同一个 Prompt 的输出并不完全固定
- 请求成本与输入、输出 Token 数量直接相关
- Agent 可能连续调用模型、检索器和外部工具
- HTTP 返回 200，不代表答案正确或有帮助
- Prompt 注入、越权工具调用和敏感信息泄露会带来新的安全风险
- 模型供应商限流、超时或升级，都可能改变系统行为

因此，生产级 AI 应用需要同时观察四个层面：

```text
系统层：可用性、吞吐量、P95/P99 延迟、错误率
模型层：Token、成本、首 Token 延迟、生成速度、重试率
质量层：相关性、忠实度、任务成功率、用户反馈
治理层：敏感数据、内容安全、权限、审计、预算
```

## 二、先建立统一调用链

### 2.1 Trace、Span 与 Event

一次用户请求可以看作一个 Trace，内部每个步骤是一个 Span：

```text
Trace: 用户询问“退款政策是什么？”
├── Span: 身份与权限检查
├── Span: 查询改写
│   └── Span: LLM 调用
├── Span: 向量检索
├── Span: 文档重排
├── Span: 答案生成
│   └── Span: LLM 流式调用
└── Span: 内容安全检查
```

Event 则表示 Span 内发生的离散事件，例如重试、缓存命中、工具调用被拒绝。

推荐为所有调用统一携带这些标识：

```typescript
interface RequestContext {
  traceId: string
  userId?: string
  sessionId?: string
  tenantId?: string
  feature: string
  environment: 'development' | 'staging' | 'production'
}
```

不要把用户的邮箱、手机号直接当作 `userId`。应使用内部不可逆标识，并对日志设置访问权限和保留周期。

### 2.2 定义 LLM Span 数据结构

```typescript
type LLMSpanStatus = 'ok' | 'error' | 'cancelled'

interface LLMUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface LLMSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  operation: 'chat' | 'embedding' | 'rerank' | 'tool' | 'retrieval'
  provider?: string
  model?: string
  startedAt: number
  endedAt?: number
  firstTokenAt?: number
  status: LLMSpanStatus
  usage?: LLMUsage
  estimatedCostUsd?: number
  attributes: Record<string, string | number | boolean>
  error?: {
    name: string
    message: string
    code?: string
  }
}
```

这里有两个关键原则：

1. 记录结构化字段，不要只写一行不可查询的文本日志。
2. 默认不记录原始 Prompt 和完整回答，先脱敏或只保存哈希、模板版本与长度。

## 三、封装模型调用，而不是到处直接请求

如果业务代码到处直接调用模型 SDK，后续很难统一添加追踪、计费、重试与降级。应通过一个网关层收口。

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxOutputTokens?: number
  metadata: {
    traceId: string
    feature: string
    promptVersion: string
  }
}

interface ChatResult {
  text: string
  finishReason: string
  usage: LLMUsage
  providerRequestId?: string
}

interface ModelAdapter {
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult>
}
```

接着实现带观测能力的包装器：

```typescript
class ObservableModel implements ModelAdapter {
  constructor(
    private readonly inner: ModelAdapter,
    private readonly sink: { emit(span: LLMSpan): Promise<void> },
  ) {}

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const span: LLMSpan = {
      traceId: request.metadata.traceId,
      spanId: crypto.randomUUID(),
      operation: 'chat',
      model: request.model,
      startedAt: Date.now(),
      status: 'ok',
      attributes: {
        feature: request.metadata.feature,
        promptVersion: request.metadata.promptVersion,
        messageCount: request.messages.length,
        inputChars: request.messages.reduce((sum, item) => sum + item.content.length, 0),
      },
    }

    try {
      const result = await this.inner.chat(request, signal)
      span.usage = result.usage
      span.attributes.finishReason = result.finishReason
      span.attributes.providerRequestId = result.providerRequestId ?? 'unknown'
      return result
    } catch (error) {
      span.status = signal?.aborted ? 'cancelled' : 'error'
      span.error = normalizeError(error)
      throw error
    } finally {
      span.endedAt = Date.now()
      await this.sink.emit(span).catch(() => {
        // 监控写入失败不能阻断用户主请求
      })
    }
  }
}

function normalizeError(error: unknown): LLMSpan['error'] {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }
  return { name: 'UnknownError', message: String(error) }
}
```

可观测系统应当是旁路能力。除非审计记录属于强合规要求，否则不应因为监控平台短暂不可用而让 AI 功能整体失败。

## 四、必须监控的核心指标

### 4.1 延迟指标

只记录总耗时会掩盖真正的问题，至少拆分：

| 指标 | 含义 | 常见问题 |
| --- | --- | --- |
| TTFT | Time To First Token，首 Token 延迟 | 排队、网络、模型负载高 |
| TPOT | Time Per Output Token | 模型生成速度下降 |
| Retrieval Latency | 检索耗时 | 向量库索引或网络问题 |
| Tool Latency | 工具调用耗时 | 外部 API 不稳定 |
| End-to-End | 用户端到端耗时 | 整条链路综合体验 |

```typescript
function calculateLatency(span: LLMSpan) {
  const end = span.endedAt ?? Date.now()

  return {
    totalMs: end - span.startedAt,
    ttftMs: span.firstTokenAt
      ? span.firstTokenAt - span.startedAt
      : undefined,
  }
}
```

对于流式响应，服务端还应监听客户端取消事件，及时中止模型请求，避免用户已经离开页面后仍继续消耗 Token。

### 4.2 Token 与成本

成本必须按模型、功能、租户和用户维度聚合，而不是只看每月总账单。

```typescript
interface ModelPrice {
  inputPerMillion: number
  outputPerMillion: number
}

function estimateCost(usage: LLMUsage, price: ModelPrice): number {
  return (
    usage.inputTokens * price.inputPerMillion / 1_000_000 +
    usage.outputTokens * price.outputPerMillion / 1_000_000
  )
}
```

价格表不要硬编码在业务逻辑中，应存放在可配置的数据源里，并记录价格版本。模型供应商变更价格后，历史成本仍应能够正确解释。

值得建立的成本指标包括：

- 单次请求平均成本
- 每个成功任务的成本，而非每次调用成本
- 每个活跃用户的 AI 成本
- 缓存节省的 Token 和金额
- 重试、无效工具循环产生的浪费
- 输入 Token 与输出 Token 的比例

### 4.3 错误分类

“模型调用失败”太笼统。建议至少分为：

```typescript
type AIErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'MODEL_OVERLOADED'
  | 'CONTEXT_TOO_LONG'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'CONTENT_BLOCKED'
  | 'TOOL_EXECUTION_FAILED'
  | 'RETRIEVAL_FAILED'
  | 'BUDGET_EXCEEDED'
  | 'CLIENT_CANCELLED'
  | 'UNKNOWN'
```

分类后，告警和恢复策略才能精确：限流可以退避重试，超出上下文需要压缩输入，结构化输出错误可以修复解析，而权限错误不应重试。

## 五、质量监控：HTTP 200 不等于回答正确

### 5.1 在线反馈信号

生产环境可以收集显式和隐式反馈：

```text
显式反馈：点赞、点踩、问题标签、用户修正文本
隐式反馈：是否复制、是否重新提问、是否转人工、任务是否完成
业务结果：工单是否解决、SQL 是否执行成功、代码是否通过测试
```

不要把点赞率直接等同于准确率。它更接近用户满意度，还会受到语气、响应速度和 UI 体验影响。

```typescript
interface FeedbackEvent {
  traceId: string
  type: 'thumbs_up' | 'thumbs_down' | 'retry' | 'task_success' | 'task_failure'
  reason?: string
  createdAt: string
}
```

通过 `traceId` 将反馈关联到当时的模型版本、Prompt 版本、检索结果和工具调用，才能真正用于定位问题。

### 5.2 离线评估与线上监控联动

建议维护一套持续增长的 Golden Dataset：

```typescript
interface EvaluationCase {
  id: string
  input: string
  expectedFacts?: string[]
  expectedTool?: string
  referenceAnswer?: string
  tags: string[]
}
```

数据来源可以包括：

- 产品最核心的典型问题
- 线上点踩和失败案例
- 历史线上事故
- 边界条件与对抗样本
- 不同语言、地区和用户权限的数据

每次修改 Prompt、模型、检索策略或工具描述时，先跑离线回归，再进行小流量线上实验。

### 5.3 RAG 的专用质量指标

RAG 链路至少要分别观察检索和生成：

```text
检索层：Recall@K、MRR、命中文档比例、无结果率
生成层：Faithfulness、Answer Relevance、引用正确率
端到端：任务完成率、拒答准确率、用户满意度
```

一个常见误区是只评估最终答案。如果正确文档根本没有被召回，再强的生成模型也无法稳定回答。

## 六、Prompt 与模型版本管理

不要把生产 Prompt 散落在代码字符串里。至少为它建立版本标识：

```typescript
interface PromptTemplate {
  id: string
  version: string
  system: string
  userTemplate: string
  variables: string[]
  updatedAt: string
}

const supportPrompt: PromptTemplate = {
  id: 'support-answer',
  version: '2026-08-17.1',
  system: '你是客服助手。只根据提供的资料回答，资料不足时明确说明。',
  userTemplate: '资料：\n{{context}}\n\n问题：{{question}}',
  variables: ['context', 'question'],
  updatedAt: '2026-08-17T00:00:00Z',
}
```

一次线上 Trace 应能还原：

- 使用了哪个 Prompt 版本
- 使用了哪个模型和参数
- 检索索引与知识库版本
- 工具定义版本
- 应用发布版本

这样出现质量回退时，才能比较两个版本之间究竟改变了什么。

## 七、安全与隐私治理

### 7.1 日志脱敏

```typescript
const REDACTION_RULES = [
  { name: 'email', pattern: /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  { name: 'id_card', pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g },
]

function redact(text: string): string {
  return REDACTION_RULES.reduce(
    (result, rule) => result.replace(rule.pattern, `[REDACTED_${rule.name.toUpperCase()}]`),
    text,
  )
}
```

正则只能覆盖格式明确的信息。企业场景还需要结合数据分类、实体识别和业务字段白名单。更稳妥的原则是：能不记录就不记录，确需记录时再脱敏、加密和限制访问。

### 7.2 防止 Prompt 注入扩大权限

不要依赖一句“忽略恶意指令”的系统提示。真正的边界必须落在代码和权限系统中：

```typescript
interface ToolPolicy {
  tool: string
  allowedRoles: string[]
  requiresConfirmation: boolean
  maxCallsPerRequest: number
}

function authorizeTool(
  policy: ToolPolicy,
  userRoles: string[],
  callCount: number,
) {
  const hasRole = policy.allowedRoles.some(role => userRoles.includes(role))

  if (!hasRole) throw new Error('Tool permission denied')
  if (callCount >= policy.maxCallsPerRequest) {
    throw new Error('Tool call limit exceeded')
  }
}
```

对于付款、删除、发送邮件、修改权限等高风险操作，应展示待执行内容并要求用户确认，同时记录审计日志和幂等键。

### 7.3 多租户隔离

RAG 系统必须在检索阶段就过滤租户和权限，不能先查出全部文档再让模型“自行忽略”：

```typescript
const results = await vectorStore.search(queryEmbedding, {
  topK: 8,
  filter: {
    tenantId: context.tenantId,
    visibility: { $in: context.allowedScopes },
  },
})
```

模型不是访问控制系统。任何需要保密的数据，都不能仅靠 Prompt 约束。

## 八、可靠性：超时、重试、熔断与降级

### 8.1 超时必须分层设置

```typescript
async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await operation(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}
```

建议分别设置：

- 整个用户请求的总超时
- 单次模型调用超时
- 单个工具调用超时
- 向量检索超时

子步骤预算之和不能无限超过总预算。Agent 每轮执行前都应检查剩余时间。

### 8.2 只重试值得重试的错误

```typescript
const RETRYABLE = new Set<AIErrorCode>([
  'RATE_LIMITED',
  'PROVIDER_TIMEOUT',
  'MODEL_OVERLOADED',
])

async function retry<T>(
  task: () => Promise<T>,
  classify: (error: unknown) => AIErrorCode,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (!RETRYABLE.has(classify(error)) || attempt === maxAttempts) throw error

      const base = 300 * 2 ** (attempt - 1)
      const jitter = Math.floor(Math.random() * 200)
      await new Promise(resolve => setTimeout(resolve, base + jitter))
    }
  }

  throw lastError
}
```

工具调用若带有副作用，必须先保证幂等，否则重试可能造成重复付款、重复发信或重复创建记录。

### 8.3 设计分级降级策略

```text
Level 0：主模型 + 完整 RAG + 重排 + 全部工具
Level 1：备用模型 + 完整 RAG
Level 2：小模型 + 基础检索，不执行高风险工具
Level 3：返回搜索结果或固定知识库内容
Level 4：明确提示服务暂不可用，转人工处理
```

降级的目标不是假装系统正常，而是在能力受限时仍给用户一个诚实、可用的结果。

## 九、预算控制与限流

### 9.1 请求前预算检查

```typescript
interface BudgetState {
  dailyLimitUsd: number
  spentTodayUsd: number
  maxRequestUsd: number
}

function assertBudget(state: BudgetState, estimatedRequestUsd: number) {
  if (estimatedRequestUsd > state.maxRequestUsd) {
    throw new Error('Single request budget exceeded')
  }

  if (state.spentTodayUsd + estimatedRequestUsd > state.dailyLimitUsd) {
    throw new Error('Daily budget exceeded')
  }
}
```

生产系统可同时设置组织、租户、用户、功能四级预算。预算接近阈值时先告警，再切换低成本模型或降低输出上限，最后才完全拒绝。

### 9.2 控制 Agent 循环

```typescript
interface AgentLimits {
  maxSteps: number
  maxToolCalls: number
  maxTokens: number
  deadlineMs: number
}

function shouldStopAgent(state: {
  steps: number
  toolCalls: number
  tokens: number
  startedAt: number
}, limits: AgentLimits): boolean {
  return (
    state.steps >= limits.maxSteps ||
    state.toolCalls >= limits.maxToolCalls ||
    state.tokens >= limits.maxTokens ||
    Date.now() - state.startedAt >= limits.deadlineMs
  )
}
```

没有循环上限的 Agent 既是成本风险，也是安全风险。

## 十、缓存策略

AI 应用通常有三种缓存：

| 缓存 | Key | 适用场景 |
| --- | --- | --- |
| 精确缓存 | Prompt 与参数哈希 | 固定问答、分类、抽取 |
| 语义缓存 | 输入向量相似度 | 高频近义问题 |
| 中间结果缓存 | 文档哈希、查询、模型版本 | Embedding、检索、重排 |

```typescript
async function createCacheKey(request: ChatRequest): Promise<string> {
  const stable = JSON.stringify({
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0,
    maxOutputTokens: request.maxOutputTokens,
    promptVersion: request.metadata.promptVersion,
  })

  const bytes = new TextEncoder().encode(stable)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
```

包含用户私有数据、强时效信息或非零温度创作任务时，要谨慎使用缓存。缓存条目也必须包含租户边界和数据版本。

## 十一、告警与 SLO

### 11.1 不要为每个单次错误报警

单次超时很常见，真正值得报警的是趋势和用户影响：

```text
P1：核心功能 5 分钟成功率低于 90%
P1：发生跨租户数据访问或高风险工具越权
P2：P95 首 Token 延迟连续 15 分钟超过 4 秒
P2：每成功任务成本较 7 日均值上涨 50%
P2：内容安全拦截率异常上升
P3：某 Prompt 版本点踩率显著高于基线
```

### 11.2 一个可执行的 SLO 示例

```text
可用性：自然月内 99.9% 的请求能够获得有效响应或明确降级响应
延迟：95% 的对话请求在 2.5 秒内返回首个 Token
质量：核心评估集任务成功率不低于 92%
成本：客服问答每个成功任务平均成本不超过 $0.015
安全：高风险工具未经授权执行次数为 0
```

SLO 必须对应用户体验和业务目标。“模型接口返回 200”通常不是一个有意义的产品 SLO。

## 十二、上线前检查清单

### 调用链

- [ ] 每个请求都有 Trace ID，并能贯穿模型、RAG 和工具调用
- [ ] 记录模型、Prompt、知识库、工具和应用版本
- [ ] 能区分首 Token 延迟与总耗时
- [ ] 用户取消后能中止下游调用

### 成本与可靠性

- [ ] Token 和成本可按功能、租户、模型聚合
- [ ] 设置单请求、单用户和组织级预算
- [ ] 超时、重试、熔断与降级策略已经演练
- [ ] Agent 有步骤、工具、Token 和时间上限

### 质量与安全

- [ ] 有覆盖核心场景和历史事故的评估集
- [ ] 线上反馈能够回溯到完整 Trace
- [ ] Prompt 与日志中的敏感数据已脱敏
- [ ] 工具权限由服务端强制执行
- [ ] 多租户数据在检索层隔离
- [ ] 高风险副作用操作需要确认、审计并支持幂等

## 十三、推荐落地顺序

不要一开始就建设复杂平台，可以按风险逐步推进：

```text
第 1 阶段：统一模型网关 + Trace ID + 延迟/错误/Token
第 2 阶段：Prompt 版本管理 + 用户反馈 + 基础评估集
第 3 阶段：成本预算 + 限流 + 超时重试 + 模型降级
第 4 阶段：RAG/Agent 专用指标 + 安全策略 + 审计
第 5 阶段：自动回归、灰度实验、异常检测与容量预测
```

## 总结

生产级 LLM 应用的核心，不只是“选择更强的模型”，而是建立一套可观察、可评估、可控制、可恢复的工程系统。

可以记住五个关键问题：

1. **发生了什么**：Trace 能否还原完整调用链？
2. **表现怎么样**：延迟、成功率和质量是否达到 SLO？
3. **花了多少钱**：成本能否归因到功能、租户和成功任务？
4. **是否安全**：数据、权限、工具和审计边界是否由代码保证？
5. **失败怎么办**：是否有超时、重试、限流、降级和人工兜底？

当这五个问题都有清晰答案时，AI 应用才真正从可演示的原型，走向可持续运营的生产系统。
