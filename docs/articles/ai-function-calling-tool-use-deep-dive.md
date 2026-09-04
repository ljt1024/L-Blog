# AI Agent Function Calling / Tool Use 深度解析：让大模型连接真实世界

> 2023 年 OpenAI 推出 Function Calling，2024 年 Anthropic 发布 Tool Use，2025 年 Google Gemini 原生支持 Function Declaration——**Function Calling 已成为所有 LLM Agent 的标配能力**。但它到底是怎么工作的？JSON Schema 怎么写才能让模型准确理解？多个工具并行调用时如何避免冲突？工具返回结果后模型"想多了"怎么办？本文从协议原理出发，完整覆盖 Tool 定义、多轮调用循环、并行执行、错误处理、ReAct 推理模式，以及 TypeScript/JavaScript/Python 三端的实战代码。

## 一、Function Calling 到底是什么？

### 1.1 本质：结构化的工具调用协议

Function Calling 不是让 LLM"执行代码"，而是让 LLM 在对话中输出**结构化的工具调用请求**，由外部代码实际执行：

```
用户: "帮我查一下北京的天气"

传统 LLM:
  → "北京今天多云，最高温度 26°C..."   （幻觉风险极高）

Function Calling:
  → LLM 输出: {"name": "get_weather", "arguments": {"city": "北京"}}
  → 外部代码执行 get_weather("北京") → "晴，26°C"
  → 将结果注入对话 → LLM 总结给用户
```

**核心循环（Agent Loop）：**
```
用户输入
  → 模型推理（决定是否调用工具）
    → [工具调用] → 工具执行 → 返回结果
      → 模型再次推理（决定下一步）
        → [更多工具调用] → ... → 最终回答
```

### 1.2 三大协议流派

| 厂商 | API 名称 | 触发方式 | 工具格式 |
|------|---------|---------|---------|
| OpenAI | `functions` / `tools` | `tool_choice: "auto"` | JSON Schema |
| Anthropic | `tools` (Tool Use) | `tool_choice: { type: "tool" }` | JSON Schema（精简版） |
| Google | `tools` (Function Declaration) | `tool_config.tool_selection` | Protobuf-like Schema |
| 开源（Ollama） | `tools` | `format: "json"` | JSON Schema |

> **注意**：OpenAI 2024 年将 `functions` 参数改名为 `tools`（向后兼容），新代码请使用 `tools`。

### 1.3 两种调用模式

```javascript
// auto：模型自己决定是否调用工具（默认）
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "北京天气怎么样？" }],
  tools: toolDefinitions,          // 工具列表
  tool_choice: "auto"              // 模型自己判断要不要调用
});

// required：强制调用一个工具（适用于已知需要工具的场景）
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "把我的体重记录到 Notion" }],
  tools: toolDefinitions,
  tool_choice: "required"           // 必须调用至少一个工具
});

// specific：指定调用哪个工具
const response = await openai.chat.completions.create({
  tools: toolDefinitions,
  tool_choice: { type: "function", function: { name: "get_weather" } }
});
```

## 二、Tool 定义：JSON Schema 的艺术

### 2.1 基础 Tool 定义

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",              // 唯一标识符，英文+下划线
      description: "查询指定城市的当前天气",  // 供模型理解何时调用
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "城市名称，例如'北京'、'上海'、'东京'"
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "温度单位，默认为 celsius"
          }
        },
        required: ["city"]             // 必填参数
      }
    }
  }
];
```

### 2.2 复杂 Schema：嵌套对象与数组

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "在日历中创建新事件",
      parameters: {
        type: "object",
        properties: {
          event: {
            type: "object",
            required: ["title", "start_time", "end_time"],
            properties: {
              title: {
                type: "string",
                description: "事件标题"
              },
              start_time: {
                type: "string",
                format: "date-time",
                description: "开始时间，ISO 8601 格式，例如 2025-09-04T14:00:00+08:00"
              },
              end_time: {
                type: "string",
                format: "date-time"
              },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "参与者邮箱列表"
              },
              location: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  address: { type: "string" }
                }
              },
              reminders: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    minutes_before: { type: "integer" },
                    method: { type: "string", enum: ["email", "popup", "sms"] }
                  }
                }
              }
            }
          }
        },
        required: ["event"]
      }
    }
  }
];
```

### 2.3 Tool 描述的写作技巧

**模型理解工具意图的能力，90% 取决于 description。**

```javascript
// ❌ 模糊描述：模型不知道什么时候该用这个工具
{
  name: "search",
  description: "搜索功能",
  parameters: { ... }
}

// ✅ 精确描述：触发场景 + 返回内容 + 使用建议
{
  name: "search_news",
  description: `当用户想了解最新新闻、行业动态、或需要查找近期发生的事件时使用。
返回最近 7 天内的新闻文章列表，包含标题、来源、发布时间和摘要。
注意：不适合查找历史事件（超过 30 天）或需要精确数据的研究查询。`,
  parameters: { ... }
}

// ✅ 边界条件写清楚
{
  name: "send_email",
  description: `发送电子邮件给指定收件人。
触发条件：用户明确要求"发送邮件"、"发一封邮件"、"给我发邮件"。
注意：
- 如果用户没有提供收件人邮箱，先调用 get_user_email 查询
- 如果邮件内容涉及敏感信息，提醒用户确认
- 不支持群发（超过 10 个收件人需用户确认）`,
  parameters: { ... }
}
```

### 2.4 常见 Schema 模式

```javascript
// 模式1：枚举限制（防止模型幻觉取值）
{
  properties: {
    status: {
      type: "string",
      enum: ["pending", "in_progress", "completed", "cancelled"],
      description: "任务状态，必须是枚举值之一"
    }
  }
}

// 模式2：联合类型（anyOf）
{
  properties: {
    filter: {
      anyOf: [
        { type: "string" },
        { type: "object", properties: { field: { type: "string" }, value: {} } }
      ],
      description: "过滤条件，可以是简单字符串或复杂对象"
    }
  }
}

// 模式3：const（固定值）
{
  properties: {
    model: {
      type: "string",
      const: "gpt-4o",
      description: "固定使用 gpt-4o 模型"
    }
  }
}
```

## 三、多轮对话与 Tool Call 循环

### 3.1 标准调用流程（TypeScript）

```typescript
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

async function chatWithTools(
  messages: Message[],
  tools: Tool[],
  maxIterations = 10
): Promise<string> {
  for (let i = 0; i < maxIterations; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto"
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage as Message);

    // 无工具调用 → 最终回答
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content ?? "";
    }

    // 执行所有工具调用
    for (const toolCall of assistantMessage.tool_calls) {
      const result = await executeTool(toolCall);
      messages.push({
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: toolCall.id
      });
    }

    // 循环回到模型继续推理
  }

  throw new Error(`超过最大迭代次数 ${maxIterations}`);
}
```

### 3.2 工具执行函数

```typescript
async function executeTool(toolCall: ToolCall): Promise<unknown> {
  const { name, arguments: args, id } = toolCall;

  switch (name) {
    case "get_weather":
      return getWeather(args.city as string, args.unit as "celsius" | "fahrenheit");

    case "create_calendar_event":
      return createCalendarEvent(args.event as CalendarEvent);

    case "search_code":
      return searchCode(args.query as string, args.language as string);

    case "send_email":
      return sendEmail(args.to as string, args.subject as string, args.body as string);

    default:
      throw new Error(`未知工具: ${name}`);
  }
}

// 带超时的包装器
async function executeToolWithTimeout(
  toolCall: ToolCall,
  timeoutMs = 30000
): Promise<unknown> {
  return Promise.race([
    executeTool(toolCall),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`工具 ${toolCall.name} 执行超时`)), timeoutMs)
    )
  ]);
}
```

### 3.3 并行执行工具

```typescript
// 一次性调用多个无依赖的工具（加速）
async function executeToolsParallel(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const results = await Promise.allSettled(
    toolCalls.map(tc => executeToolWithTimeout(tc, 30000))
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return { success: true, data: result.value };
    } else {
      console.error(`工具 ${toolCalls[index].name} 执行失败:`, result.reason);
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      };
    }
  });
}

// 在 chatWithTools 中的调用
for (const toolCall of assistantMessage.tool_calls) {
  // 串行（保持对话顺序，调试友好）
  const result = await executeTool(toolCall);
  messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
}

// 或并行（所有工具同时执行）
const toolResults = await executeToolsParallel(assistantMessage.tool_calls);
for (const [index, toolCall] of assistantMessage.tool_calls.entries()) {
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify(toolResults[index])
  });
}
```

### 3.4 错误处理与重试

```typescript
async function executeToolWithRetry(
  toolCall: ToolCall,
  maxRetries = 3,
  delayMs = 1000
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeTool(toolCall);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryableError = isRetryable(error);

      if (isLastAttempt || !isRetryableError) {
        // 返回结构化错误，让模型决定如何处理
        return {
          error: true,
          message: error instanceof Error ? error.message : "未知错误",
          code: error instanceof Error ? (error as any).code : "UNKNOWN",
          retryable: isRetryableError,
          attempt: attempt + 1
        };
      }

      console.warn(`工具 ${toolCall.name} 第 ${attempt + 1} 次失败，${delayMs}ms 后重试`);
      await sleep(delayMs * (attempt + 1)); // 指数退避
    }
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    // 网络错误、超时、服务不可用 → 可重试
    const retryableCodes = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "503", "429"];
    return retryableCodes.some(code => (error as any).message?.includes(code));
  }
  return false;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 四、ReAct 推理模式：让模型"边想边做"

### 4.1 什么是 ReAct？

**ReAct = Reasoning + Acting**：模型在每一步推理中同时生成"思考"（Thought）和"行动"（Action），交替进行：

```
Thought: 用户想知道北京的天气，我需要先调用天气查询工具。
Action: get_weather(city="北京")
Observation: {"temperature": 26, "condition": "晴", "humidity": 45%}
Thought: 天气查询返回了晴天气温 26°C，现在可以给用户总结了。
Action: 最终回答
```

### 4.2 ReAct 的三种实现方式

**方式1：模型自己生成 Thought / Action / Observation（OpenAI GPT-4）**

```javascript
// 利用模型的 instruction following 能力
const systemPrompt = `你是一个 AI 助手，在回答问题时会使用工具。

对于每个工具调用，必须按以下格式输出：
Thought: [你为什么决定调用这个工具]
Action: {"name": "工具名", "arguments": {"参数": "值"}}
Observation: [等待结果]

当工具返回结果后，继续推理，直到得到最终答案。
最终必须用以下格式回答：
Final Answer: [你的完整回答]
`;

// 解析模型的 tool_call 输出，从中提取 Thought
// 模型在 tool_call 的 arguments 中同时包含 thought 和 arguments
```

**方式2：结构化 ReAct（推荐，Claude / GPT-4 都适用）**

```typescript
// 使用 tool_results 注入推理链
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "分步推理，每步先思考再行动" },
    { role: "user", content: "查北京天气，并告诉我应该穿什么" },
    // 工具执行后注入结果
    { role: "tool", tool_call_id: "call_xxx", content: '{"temp": 26, "condition": "晴"}' }
  ],
  tools,
  tool_choice: "auto"
});

// Claude 特有：用 "thinking" blocks
const claudeResponse = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools: anthropicTools,
  messages: [
    { role: "user", content: "帮我分析 AAPL 股票并给出买入建议" }
  ],
  // Claude 3.5+ 支持 thinking beta
  thinking: {
    type: "enabled",
    budget_tokens: 1024
  }
});
```

**方式3：LangChain 的 ReAct 实现**

```typescript
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { searchWeb, getStockPrice, sendEmail } from "./tools";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
const tools = [searchWeb, getStockPrice, sendEmail];

const agent = createReactAgent(llm, tools, {
  // LangChain 自动注入 ReAct 提示词
  // 支持自定义提示词模板
});

const executor = new AgentExecutor({
  agent,
  tools,
  maxIterations: 10,
  returnIntermediateSteps: true  // 返回 Thought/Action/Observation 链
});

const result = await executor.invoke({
  input: "帮我查一下苹果公司的股价，并发一封邮件给 investor@example.com 汇报"
});

// result.intermediateSteps 包含完整的推理链
// [
//   { action: { tool: "getStockPrice", input: { symbol: "AAPL" }, output: "182.5" } },
//   { action: { tool: "sendEmail", input: { ... }, output: "发送成功" } }
// ]
```

## 五、工具选择的策略与优化

### 5.1 工具选择的常见问题

```javascript
// 问题1：模型同时调用多个冲突工具
assistantMessage.tool_calls = [
  { name: "cancel_order", arguments: { order_id: "12345" } },  // 冲突！
  { name: "confirm_order", arguments: { order_id: "12345" } }
];

// 解决：检查冲突工具，在执行前拒绝
function detectConflictingTools(toolCalls: ToolCall[]): ToolCall[] {
  const conflictingPairs = [
    ["cancel_order", "confirm_order"],
    ["delete_file", "create_file"],
    ["buy_stock", "sell_stock"]
  ];

  const names = toolCalls.map(tc => tc.name);
  for (const [a, b] of conflictingPairs) {
    if (names.includes(a) && names.includes(b)) {
      console.warn(`检测到冲突工具: ${a} 和 ${b}，将拒绝第二个`);
      // 返回非冲突的工具
      const firstIndex = names.indexOf(a) < names.indexOf(b) ? 0 : 1;
      return [toolCalls[firstIndex]];
    }
  }
  return toolCalls;
}
```

```javascript
// 问题2：模型工具参数格式错误
// 模型输出: { "city": "北京" }  但工具期望: { "city": "beijing" }
// 解决：参数校验 + 自动转换
function validateAndNormalizeArgs(
  toolCall: ToolCall,
  schema: ToolSchema
): Record<string, unknown> {
  const args = toolCall.arguments;
  const validated: Record<string, unknown> = {};

  for (const [key, fieldSchema] of Object.entries(schema.properties)) {
    if (fieldSchema.enum && !fieldSchema.enum.includes(args[key])) {
      // 尝试模糊匹配
      const match = fieldSchema.enum.find(e =>
        e.toLowerCase().includes(String(args[key]).toLowerCase())
      );
      if (match) {
        validated[key] = match;
        continue;
      }
      throw new ToolValidationError(
        `参数 ${key} 值 "${args[key]}" 不在允许范围 [${fieldSchema.enum.join(", ")}]`
      );
    }
    validated[key] = args[key];
  }
  return validated;
}
```

### 5.2 减少工具幻觉调用的技巧

```javascript
// 技巧1：description 中明确边界
const tools = [
  {
    function: {
      name: "get_order_status",
      description: `仅在用户问到具体订单状态时使用，例如：
- "我的订单 12345 到哪了？"
- "查看订单配送进度"
注意：不适合一般性购物咨询或退款问题`
    }
  }
];

// 技巧2：强制用户确认（required 模式下）
// 用户说"取消我的所有订单"，先问再执行
if (countToolCalls(toolCalls, "cancel_order") > 1) {
  return {
    role: "assistant",
    content: "我检测到你要取消多个订单，请确认：你要取消以下订单吗？\n" +
      toolCalls.map(tc => `- 订单 ${tc.arguments.order_id}`).join("\n") +
      "\n\n回复'确认取消'我将执行。"
  };
}
```

### 5.3 工具优先级的动态调整

```typescript
// 根据上下文动态选择工具子集（减少干扰，提高准确性）
function selectRelevantTools(
  userQuery: string,
  allTools: Tool[],
  context: { time?: Date; userPreferences?: Record<string, unknown> }
): Tool[] {
  const query = userQuery.toLowerCase();

  // 基础筛选：与查询相关的工具
  let candidates = allTools.filter(tool =>
    tool.function.description.toLowerCase().includes(query) ||
    tool.function.name.includes(query.replace(/\s+/g, "_"))
  );

  // 时间上下文调整
  if (context.time) {
    const hour = context.time.getHours();
    if (hour < 9 || hour > 18) {
      // 非工作时间，优先邮件/消息工具
      candidates = sortByPriority(candidates, ["email", "message", "calendar"]);
    }
  }

  // 用户偏好
  if (context.userPreferences?.default_currency === "CNY") {
    candidates = candidates.map(tool => {
      if (tool.function.name === "get_stock_price") {
        return {
          ...tool,
          function: {
            ...tool.function,
            description: tool.function.description + "\n返回价格默认为人民币（如适用）。"
          }
        };
      }
      return tool;
    });
  }

  // 限制数量（避免选择过多工具造成混淆）
  return candidates.slice(0, 8);
}
```

## 六、Python 端实现

### 6.1 使用 OpenAI SDK

```python
from openai import OpenAI
from typing import Literal, Any
import json

client = OpenAI()

def get_weather(city: str, unit: Literal["celsius", "fahrenheit"] = "celsius") -> dict:
    """查询城市天气"""
    # 实际调用天气 API
    return {"city": city, "temp": 26, "condition": "晴", "unit": unit}

def create_task(title: str, due_date: str, priority: Literal["low", "medium", "high"] = "medium") -> dict:
    """创建任务"""
    return {"id": "task_001", "title": title, "status": "created"}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "创建待办事项",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "due_date": {"type": "string", "description": "截止日期 YYYY-MM-DD"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]}
                },
                "required": ["title", "due_date"]
            }
        }
    }
]

TOOL_MAP = {
    "get_weather": get_weather,
    "create_task": create_task
}

def chat_with_tools(messages: list[dict], max_iterations: int = 10) -> str:
    for _ in range(max_iterations):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )

        msg = response.choices[0].message
        messages.append({"role": msg.role, "content": msg.content or ""})

        if not msg.tool_calls:
            return msg.content or ""

        for tool_call in msg.tool_calls:
            fn = tool_call.function
            args = json.loads(fn.arguments)
            result = TOOL_MAP[fn.name](**args)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, ensure_ascii=False)
            })

    raise RuntimeError(f"超过最大迭代次数 {max_iterations}")

# 使用
messages = [
    {"role": "system", "content": "你是智能助手，可以用工具完成任务。"},
    {"role": "user", "content": "北京天气怎么样？顺便帮我创建一个明天完成的任务"}
]
answer = chat_with_tools(messages)
print(answer)
```

### 6.2 带 async 的异步实现

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def execute_tool(name: str, args: dict) -> Any:
    """执行工具，带超时"""
    fn = TOOL_MAP.get(name)
    if not fn:
        return {"error": f"未知工具: {name}"}

    try:
        if asyncio.iscoroutinefunction(fn):
            return await asyncio.wait_for(fn(**args), timeout=30)
        else:
            return fn(**args)
    except asyncio.TimeoutError:
        return {"error": f"工具 {name} 执行超时"}
    except Exception as e:
        return {"error": str(e)}

async def achat_with_tools(messages: list[dict]) -> str:
    for _ in range(10):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )

        msg = response.choices[0].message
        messages.append({"role": msg.role, "content": msg.content or ""})

        if not msg.tool_calls:
            return msg.content or ""

        # 并行执行所有工具
        tasks = [
            execute_tool(tc.function.name, json.loads(tc.function.arguments))
            for tc in msg.tool_calls
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for tc, result in zip(msg.tool_calls, results):
            content = json.dumps(result, ensure_ascii=False) if not isinstance(result, Exception) else json.dumps({"error": str(result)})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": content})

    raise RuntimeError("超过最大迭代次数")
```

## 七、安全与沙箱

### 7.1 工具执行的安全原则

```typescript
// 原则1：永远不直接在 LLM 输出上执行系统命令
async function executeShellCommand(command: string, args: string[]): Promise<string> {
  // ❌ 危险：command 来自 LLM，不可直接执行
  // child_process.exec(`${command} ${args.join(' ')}`)

  // ✅ 安全：白名单命令 + 参数校验
  const ALLOWED_COMMANDS = ["git", "npm", "node", "python3"];
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`命令 ${command} 不在白名单中`);
  }

  // 参数白名单（禁止 ; | & 等 shell 拼接）
  const dangerousChars = /[;&|`$>(){}[\]]/;
  for (const arg of args) {
    if (dangerousChars.test(arg)) {
      throw new Error(`参数包含非法字符: ${arg}`);
    }
  }

  return Bun.utils.spawn([command, ...args]).stdout.text;
}
```

```typescript
// 原则2：文件操作限制在指定目录
async function readFile(path: string, allowedDir: string): Promise<string> {
  const resolved = path.resolve(allowedDir, path);
  if (!resolved.startsWith(allowedDir)) {
    throw new Error(`路径 ${path} 超出允许目录 ${allowedDir}`);
  }
  return fs.readFileSync(resolved, "utf-8");
}
```

### 7.2 工具调用审计

```typescript
interface ToolCallLog {
  timestamp: Date;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  userId: string;
  success: boolean;
}

class ToolCallAuditor {
  private logs: ToolCallLog[] = [];

  async log(call: ToolCallLog) {
    this.logs.push(call);
    // 发送到审计系统
    await auditService.record({
      event: "tool_call",
      ...call
    });
  }

  getUsageStats(toolName: string, since: Date) {
    return this.logs
      .filter(log => log.toolName === toolName && log.timestamp >= since)
      .reduce((acc, log) => ({
        totalCalls: acc.totalCalls + 1,
        successRate: (acc.successRate * acc.totalCalls + (log.success ? 1 : 0)) / (acc.totalCalls + 1),
        avgDurationMs: (acc.avgDurationMs * acc.totalCalls + log.durationMs) / (acc.totalCalls + 1)
      }), { totalCalls: 0, successRate: 0, avgDurationMs: 0 });
  }
}
```

## 八、完整 Agent 实现示例

```typescript
class ToolUsingAgent {
  private client: OpenAI;
  private tools: Tool[];
  private systemPrompt: string;
  private maxIterations: number;

  constructor(config: {
    model?: string;
    systemPrompt?: string;
    tools?: Tool[];
    maxIterations?: number;
  }) {
    this.client = new OpenAI();
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.tools = config.tools ?? [];
    this.maxIterations = config.maxIterations ?? 10;
  }

  async run(userInput: string): Promise<AgentResponse> {
    const messages: Message[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: userInput }
    ];

    const steps: AgentStep[] = [];

    for (let i = 0; i < this.maxIterations; i++) {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: this.tools,
        tool_choice: "auto"
      });

      const msg = response.choices[0].message;
      messages.push(msg as Message);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return {
          answer: msg.content ?? "",
          steps,
          finished: true
        };
      }

      for (const toolCall of msg.tool_calls) {
        const start = Date.now();
        try {
          const result = await executeToolWithRetry(toolCall);
          steps.push({ toolCall, result, durationMs: Date.now() - start, error: null });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          const errorResult = { error: (error as Error).message };
          steps.push({ toolCall, result: errorResult, durationMs: Date.now() - start, error });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(errorResult)
          });
        }
      }
    }

    throw new Error(`Agent 超过 ${this.maxIterations} 次迭代未收敛`);
  }
}

// 使用
const agent = new ToolUsingAgent({
  model: "gpt-4o",
  tools: [getWeatherTool, createTaskTool, searchWebTool, sendEmailTool],
  systemPrompt: "你是一个专业助手，在回答问题时优先使用工具获取实时数据。"
});

const result = await agent.run("查一下上海今天的天气，然后帮我记到待办里");
console.log(result.answer);
console.log(`执行了 ${result.steps.length} 步`);
```

## 九、总结

Function Calling 是 AI Agent 系统的核心能力，它用**结构化的工具调用协议**将 LLM 的推理能力与外部世界连接起来：

| 组件 | 作用 |
|------|------|
| **JSON Schema** | 定义工具接口，是模型理解参数的依据 |
| **Tool Description** | 决定何时触发工具，是最重要的"提示词" |
| **Agent Loop** | 循环推理 → 调用 → 执行 → 反馈，直到完成 |
| **ReAct 模式** | Thought + Action + Observation 的结构化推理链 |
| **并行执行** | 加速无依赖的工具调用 |
| **错误处理** | 结构化错误 + 重试 + 回退，保证健壮性 |
| **安全审计** | 白名单 + 参数校验 + 调用日志 |

**最佳实践清单：**

1. **Schema 精准**：description 要描述触发场景、返回内容和边界条件
2. **枚举限制**：所有可选值用 `enum`，防止模型幻觉
3. **超时控制**：每个工具执行加超时，避免无限等待
4. **冲突检测**：检测同时调用冲突工具，优先用户确认
5. **结构化错误**：错误结果也要有结构，让模型能理解并重试
6. **安全第一**：永远不直接执行 LLM 生成的系统命令
7. **审计日志**：记录每次工具调用，用于调试和监控

*本文由小虾子 🦐 撰写*
