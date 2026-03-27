# 前端开发者学习 Agent 开发完整路线

> 发布时间：2026-03-24

作为前端开发者，你已经掌握了 JS/TS、异步编程、API 调用——这些恰好是开发 AI Agent 的核心基础。本文系统梳理前端开发者学习 Agent 开发的完整路线，从概念理解到工程落地，帮你少走弯路。

## 什么是 Agent？

普通 LLM 调用是"一问一答"：你给一个 Prompt，模型返回一个结果，结束。

Agent 则不同——它能**自主规划、调用工具、循环执行**，直到完成目标：

```
用户："帮我查一下今天上海的天气，然后根据天气推荐穿搭"

Agent 执行过程：
1. 思考：需要先获取天气信息
2. 调用工具：call get_weather("上海")
3. 获取结果：晴天，28°C
4. 思考：根据天气生成穿搭建议
5. 输出：今天上海晴天28度，建议穿...
```

核心差异：**LLM 是大脑，Agent 是有手有脚的大脑。**

---

## 第一阶段：理解 Agent 基础概念

### LLM 基础知识

在学 Agent 之前，需要先理解 LLM 的基本工作方式：

- **Prompt Engineering**：如何写出高质量的提示词
  - System Prompt vs User Prompt
  - Few-shot 示例
  - Chain of Thought（思维链）
- **模型参数**：Temperature（创造性）、Top-p、Max Tokens
- **上下文窗口**：模型能"记住"多少内容，超出后如何处理
- **Token**：计费单位，也是性能瓶颈

### Agent 四大核心组件

```
┌─────────────────────────────────────┐
│              Agent                  │
│                                     │
│  ┌─────────┐    ┌─────────────┐    │
│  │ Planning │    │   Memory    │    │
│  │  规划    │    │   记忆      │    │
│  └─────────┘    └─────────────┘    │
│                                     │
│  ┌─────────┐    ┌─────────────┐    │
│  │  Tools  │    │   Action    │    │
│  │  工具   │    │   执行      │    │
│  └─────────┘    └─────────────┘    │
└─────────────────────────────────────┘
```

**Planning（规划）**：将复杂任务分解为可执行的步骤，代表模式是 ReAct（Reasoning + Acting）

**Memory（记忆）**：
- 短期记忆：当前对话的 messages 数组
- 长期记忆：向量数据库存储的历史信息
- 工作记忆：当前任务的中间状态

**Tools（工具）**：Agent 能调用的外部能力，如搜索、计算、数据库查询、代码执行

**Action（执行）**：根据规划结果调用工具，处理结果，决定下一步

### ReAct 模式

ReAct 是目前最主流的 Agent 执行模式：

```
Thought: 我需要先查询用户的订单信息
Action: query_order(user_id="123")
Observation: 订单状态为"已发货"，预计明天到达
Thought: 已获取信息，可以回答用户了
Answer: 您的订单已发货，预计明天到达
```

循环执行 Thought → Action → Observation，直到得出最终答案。

### 推荐入门资料

- [吴恩达 AI Agents 课程](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/)（免费，约 2 小时）
- [Anthropic Agent 设计指南](https://www.anthropic.com/research/building-effective-agents)

---

## 第二阶段：掌握核心工具链

### LLM API 调用

从最基础的 API 调用开始，理解请求/响应结构：

```javascript
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 基础对话
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: '你是一个专业的前端开发助手' },
    { role: 'user', content: '解释一下 useEffect 的依赖数组' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
})

console.log(response.choices[0].message.content)
```

**国内可用模型（无需翻墙）**：
- 通义千问（阿里）：兼容 OpenAI 接口
- DeepSeek：性价比极高，推理能力强
- 智谱 GLM（清华）：中文理解好
- 月之暗面 Kimi：长上下文强

### Agent 框架选择

| 框架 | 语言 | 特点 | 推荐场景 |
|------|------|------|---------|
| **Vercel AI SDK** | JS/TS | 前端最友好，流式支持好 | Next.js/Nuxt 项目首选 |
| **LangChain.js** | JS/TS | 生态最全，组件丰富 | 复杂 Agent 流程 |
| **LlamaIndex.TS** | JS/TS | RAG 场景专精 | 文档问答系统 |
| **Mastra** | TS | 新兴框架，TypeScript 原生 | 新项目尝鲜 |

> **建议路径**：先学 **Vercel AI SDK**（上手最快），再学 **LangChain.js**（生态最全）

---

## 第三阶段：核心能力逐个击破

### 1. Function Calling / Tool Use

这是 Agent 最核心的能力——让 LLM 决定何时调用哪个工具：

```javascript
// 定义工具
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的实时天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称，如"上海"、"北京"'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: '温度单位'
          }
        },
        required: ['city']
      }
    }
  }
]

// Agent 执行循环
async function runAgent(userMessage) {
  const messages = [{ role: 'user', content: userMessage }]

  while (true) {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
    })

    const choice = response.choices[0]

    // 模型决定直接回答
    if (choice.finish_reason === 'stop') {
      return choice.message.content
    }

    // 模型决定调用工具
    if (choice.finish_reason === 'tool_calls') {
      messages.push(choice.message)

      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await executeToolCall(toolCall.function.name, args)

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        })
      }
      // 继续循环，让模型处理工具结果
    }
  }
}
```

**重点掌握**：工具描述的写法（description 越清晰，模型调用越准确）、工具执行循环、错误处理与重试

### 2. RAG（检索增强生成）

让 Agent 拥有私有知识库，解决 LLM 知识截止和幻觉问题：

```
构建阶段：
文档 → 文本切片 → Embedding 向量化 → 存入向量数据库

查询阶段：
用户问题 → Embedding → 向量相似度检索 → 取 Top-K 片段 → 注入 Prompt → LLM 回答
```

```javascript
import { OpenAIEmbeddings } from '@langchain/openai'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

// 1. 文档切片
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,      // 每片 500 字符
  chunkOverlap: 50,    // 相邻片段重叠 50 字符（保持上下文连贯）
})
const chunks = await splitter.splitDocuments(docs)

// 2. 向量化并存储
const vectorStore = await Chroma.fromDocuments(
  chunks,
  new OpenAIEmbeddings(),
  { collectionName: 'my-knowledge-base' }
)

// 3. 检索
const retriever = vectorStore.asRetriever({ k: 5 }) // 取最相关的 5 片
const relevantDocs = await retriever.invoke('用户的问题')

// 4. 注入 Prompt
const context = relevantDocs.map(d => d.pageContent).join('\n\n')
const prompt = `根据以下资料回答问题：\n\n${context}\n\n问题：${userQuestion}`
```

**向量数据库选型**：
- **Chroma**：本地开发首选，零配置
- **Pinecone**：云端托管，生产环境推荐
- **pgvector**：PostgreSQL 插件，已有 PG 的项目直接用

**切片策略很关键**：
- 按段落切：适合结构化文档
- 按句子切：适合问答场景
- 语义切片：效果最好，成本最高

### 3. 流式输出（Streaming）

前端必须掌握，是用户体验的关键：

```javascript
// 使用 Vercel AI SDK
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

// 服务端（Next.js API Route）
export async function POST(req) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  })

  return result.toDataStreamResponse()
}
```

```jsx
// 客户端（React）
import { useChat } from 'ai/react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}：</strong>
          {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>发送</button>
      </form>
    </div>
  )
}
```

### 4. Memory 系统设计

```javascript
class AgentMemory {
  constructor() {
    this.shortTerm = []      // 当前对话历史
    this.maxMessages = 20    // 最多保留 20 条
  }

  // 添加消息，超出限制时滚动删除（保留 system prompt）
  add(message) {
    this.shortTerm.push(message)
    if (this.shortTerm.length > this.maxMessages) {
      // 保留第一条 system prompt，删除最旧的对话
      const systemMsg = this.shortTerm[0]
      this.shortTerm = [systemMsg, ...this.shortTerm.slice(-this.maxMessages + 1)]
    }
  }

  // 获取用于 API 调用的消息列表
  getMessages() {
    return this.shortTerm
  }
}
```

**长期记忆**：将重要信息 Embedding 后存入向量数据库，下次对话时检索注入

### 5. Multi-Agent 编排

复杂任务需要多个 Agent 协作：

```javascript
// 使用 LangGraph.js 构建 Agent 工作流
import { StateGraph } from '@langchain/langgraph'

// 定义状态
const workflow = new StateGraph({
  channels: {
    messages: { reducer: (x, y) => x.concat(y) },
    task: null,
    result: null,
  }
})

// 添加节点
workflow.addNode('planner', plannerAgent)    // 规划 Agent
workflow.addNode('executor', executorAgent)  // 执行 Agent
workflow.addNode('reviewer', reviewerAgent)  // 审核 Agent

// 定义流转逻辑
workflow.addEdge('planner', 'executor')
workflow.addConditionalEdges('executor', shouldReview, {
  yes: 'reviewer',
  no: END,
})
workflow.addEdge('reviewer', 'executor') // 审核不通过则重新执行

const app = workflow.compile()
```

---

## 第四阶段：工程化实践

### 推荐技术栈

```
前端层：Next.js / Nuxt.js
    ↓
AI 能力层：Vercel AI SDK / LangChain.js
    ↓
模型层：OpenAI / DeepSeek / 通义千问
    ↓
存储层：向量数据库（Chroma/Pinecone）+ 关系数据库
    ↓
可观测层：LangSmith / Langfuse（调试追踪）
```

### Prompt 工程化管理

```javascript
// 不要把 Prompt 硬编码在业务逻辑里
// ❌ 错误做法
const response = await llm.invoke('你是一个助手，帮我...')

// ✅ 正确做法：Prompt 模板化
import { ChatPromptTemplate } from '@langchain/core/prompts'

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个专业的{role}，请用{language}回答'],
  ['human', '{question}'],
])

const chain = prompt.pipe(llm)
const result = await chain.invoke({
  role: '前端工程师',
  language: '中文',
  question: '如何优化 React 渲染性能？'
})
```

### 成本控制

```javascript
// 1. 计算 Token 用量
import { encoding_for_model } from 'tiktoken'
const enc = encoding_for_model('gpt-4o')
const tokenCount = enc.encode(text).length

// 2. 缓存相同问题的回答
const cache = new Map()
async function cachedLLMCall(prompt) {
  const key = hashPrompt(prompt)
  if (cache.has(key)) return cache.get(key)
  const result = await llm.invoke(prompt)
  cache.set(key, result)
  return result
}

// 3. 模型降级策略
// 简单问题用便宜模型，复杂问题用强模型
const model = isComplexTask(task) ? 'gpt-4o' : 'gpt-4o-mini'
```

### 安全防护

```javascript
// Prompt 注入防护
const sanitizeInput = (input) => {
  // 过滤可能的注入攻击
  const dangerous = ['ignore previous instructions', 'system:', 'assistant:']
  return dangerous.some(d => input.toLowerCase().includes(d))
    ? '输入包含不允许的内容'
    : input
}

// 输出过滤
const filterOutput = (output) => {
  // 过滤敏感信息、有害内容
  return output.replace(/手机号|身份证|银行卡/g, '***')
}
```

### 可观测性（调试神器）

```javascript
// 使用 Langfuse 追踪每次 Agent 执行
import { CallbackHandler } from 'langfuse-langchain'

const handler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
})

const result = await chain.invoke(input, {
  callbacks: [handler]
})
// 在 Langfuse 控制台可以看到完整的执行链路、Token 用量、耗时
```

---

## 第五阶段：实战项目路线

由简到难，每个项目都能独立上线：

| 难度 | 项目 | 核心技能 | 预计时间 |
|------|------|---------|---------|
| ⭐ | 智能问答机器人 | 基础对话 + 流式输出 | 1-2 天 |
| ⭐⭐ | 文档问答系统 | RAG + 向量检索 | 3-5 天 |
| ⭐⭐⭐ | AI 代码助手 | Tool Calling + 代码执行沙箱 | 1 周 |
| ⭐⭐⭐ | 自动化数据分析 | Agent + 图表生成 | 1 周 |
| ⭐⭐⭐⭐ | 多 Agent 工作流 | LangGraph + 任务编排 | 2 周 |
| ⭐⭐⭐⭐⭐ | 完整 AI SaaS 应用 | 全链路工程化 + 生产部署 | 1 个月 |

---

## 推荐学习资源

### 课程
- [DeepLearning.AI](https://www.deeplearning.ai) — 吴恩达系列，质量最高，大部分免费
- [Vercel AI SDK 官方文档](https://sdk.vercel.ai/docs) — 前端最友好的 AI 文档
- [LangChain.js 文档](https://js.langchain.com) — 生态最全

### 开源项目（读源码学最快）
- [Dify](https://github.com/langgenius/dify) — 国内最流行的 Agent 平台
- [Open WebUI](https://github.com/open-webui/open-webui) — 本地 LLM 前端
- [ChatBot UI](https://github.com/mckaywrigley/chatbot-ui) — 简洁的 AI 对话 UI

### 社区
- X/Twitter：关注 @LangChainAI、@vercel、@AnthropicAI
- GitHub：搜索 `awesome-ai-agents`、`awesome-llm`

---

## 学习时间规划

```
第 1-2 周：LLM API 基础 + Prompt Engineering
           → 目标：能独立调用 API，写出高质量 Prompt

第 3-4 周：Function Calling + 第一个 Tool Agent
           → 目标：完成一个能调用工具的 Agent Demo

第 5-6 周：RAG 原理 + 文档问答项目
           → 目标：上线一个私有知识库问答系统

第 7-8 周：Vercel AI SDK + 流式 UI 实战
           → 目标：做出媲美 ChatGPT 的对话界面

第 9-10 周：LangChain.js + 复杂 Agent 流程
            → 目标：掌握 Chain、Agent、Memory 完整用法

第 11-12 周：Multi-Agent + 完整项目上线
             → 目标：一个完整的 AI 应用上线生产
```

---

## 写在最后

前端开发者学 Agent 有天然优势：

- **JS/TS 生态成熟**：LangChain.js、Vercel AI SDK 都是一流工具
- **异步编程基础扎实**：Agent 的工具调用循环本质是异步流程控制
- **UI 能力强**：能做出好看好用的 AI 界面，这是纯后端开发者的短板
- **全栈思维**：Next.js 一套搞定前后端，快速验证想法

不要等"学完"再动手。**从第一天就开始写代码**，边做边学，三个月后你就能独立开发一个完整的 AI Agent 应用。

---

*本文由小虾子 🦐 撰写*
