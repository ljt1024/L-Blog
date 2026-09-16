# LLM 结构化输出完全指南：让 AI 返回的 JSON 始终可用

## 前言

LLM 的输出是「下一个 token 的概率分布」——这意味着它本质上是个**自由文本生成器**。你让它「返回一个用户对象」，它可能返回：

```json
// ✅ 完美格式
{"name": "张三", "age": 28}

// ✅ 多了个注释
{"name": "张三", "age": 28}  // 用户信息

// ❌ 多余的 markdown 包装
```json
{"name": "张三", "age": 28}
```

// ❌ 字段名不一致
{"username": "张三", "years": 28}

// ❌ 语法错误
{"name": "张三", age: 28}
```

这就是 **「LLM 输出 JSON」问题的本质**：LLM 不保证 JSON 语法正确，更不保证字段和类型符合你的 schema。

**结构化输出（Structured Output）** 是解决这个问题的完整方案——它让 LLM 的输出严格遵循你定义的 schema，且可被程序可靠解析。本文覆盖 OpenAI、Anthropic、Google 各家的实现，以及用 Zod 做类型安全验证的完整工程实践。

## 一、为什么 JSON Mode 不够

你可能用过 `response_format: { type: "json_object" }`（OpenAI）或 `responseMimeType: "application/json"`（Google）——它们让 LLM **尽量**输出 JSON，但：

| 特性 | JSON Mode | 结构化输出 |
|------|----------|-----------|
| 保证输出是有效 JSON | ❌ 尽力而为，仍可能出错 | ✅ 必定是有效 JSON |
| 保证字段名正确 | ❌ 可能拼错 | ✅ 字段名由 schema 约束 |
| 保证类型正确 | ❌ `"28"` vs `28` 随意 | ✅ 严格类型校验 |
| 支持嵌套对象 | ✅ | ✅ |
| 支持 `const` 枚举 | ❌ | ✅ |

简单说：**JSON Mode 解决「格式问题」，结构化输出解决「正确性问题」**。

## 二、OpenAI：JSON Schema 约束

OpenAI 从 API 版本 `2024-04-01` 起支持 `response_format: { type: "json_schema", json_schema: {...} }`：

```javascript
import OpenAI from 'openai';

const client = new OpenAI();

const response = await client.chat.completions.create({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: '你是数据分析助手，严格按 schema 返回。' },
    { role: 'user', content: '分析以下销售数据，返回汇总报告：' + JSON.stringify(salesData) }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'SalesReport',
      strict: true,  // 严格模式：schema 之外的内容会被拒绝
      schema: {
        type: 'object',
        required: ['totalRevenue', 'topProducts', 'growthRate'],
        properties: {
          totalRevenue: {
            type: 'number',
            description: '总收入（单位：元）'
          },
          growthRate: {
            type: 'number',
            description: '同比增长百分比'
          },
          topProducts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'sales'],
              properties: {
                name: { type: 'string' },
                sales: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }
});

const report = JSON.parse(response.choices[0].message.content);
// report 类型安全：totalRevenue 是 number，topProducts 是数组……
```

**`strict: true` 的作用**：
- schema 中 `required` 的字段必须全部出现
- schema 中 `type` 必须严格匹配
- schema 之外的任何额外字段被禁止
- 如果 LLM 无法满足 schema，会直接返回 `refusal` 而非错误格式

### 2.1 最简用法：内联 schema

```javascript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'User',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    }
  }
}
```

## 三、Anthropic：XML + Schema 约束

Anthropic 的 Claude 使用 **XML 标签包裹输出**，通过 `output` 参数的 `json_schema` 约束结构：

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: '从用户评价中提取产品评分：' + reviewText }
  ],
  // Claude 4 支持 structured output
  output: {
    type: 'json_schema',
    name: 'ReviewAnalysis',
    json_schema: {
      type: 'object',
      required: ['sentiment', 'score', 'pros', 'cons'],
      properties: {
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative']
        },
        score: {
          type: 'number',
          minimum: 1,
          maximum: 5
        },
        pros: {
          type: 'array',
          items: { type: 'string' }
        },
        cons: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
});

const analysis = JSON.parse(message.content[0].text);
// analysis.sentiment 必定是 'positive' | 'neutral' | 'negative' 之一
```

**注意**：Anthropic 用 `enum` 做枚举约束，比 OpenAI 的 `json_schema` 更简洁。

## 四、Google Gemini：模式声明

Gemini 通过 `responseSchema` 和 `responseMimeType` 组合使用：

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
});

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: '从简历中提取关键信息' }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      required: ['name', 'skills', 'experience_years'],
      properties: {
        name: { type: 'STRING' },
        skills: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        experience_years: { type: 'INTEGER' },
        education: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              school: { type: 'STRING' },
              degree: { type: 'STRING' }
            }
          }
        }
      }
    }
  }
});

const resume = JSON.parse(result.response.text());
```

## 五、Zod：类型安全 + 结构验证（通用方案）

Zod 不仅是运行时验证库，它的 `z.infer<>` 可以从 schema 推导出 TypeScript 类型，与 LLM 输出结合是前端工程的最佳实践：

```typescript
import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// 第一步：定义 schema（Zod schema 本身就是类型定义）
const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number().positive(),
  tags: z.array(z.string()).default([]),
  inStock: z.boolean(),
});

type Product = z.infer<typeof ProductSchema>; // TypeScript 类型自动推导 ✅

// 第二步：将 Zod schema 转成 OpenAI JSON Schema
function zodToJsonSchema(schema: z.ZodTypeAny): object {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(shape).map(([k, v]) => [k, zodToJsonSchema(v as z.ZodTypeAny)])
      ),
      required: Object.keys(shape)
    };
  }
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodArray) return { type: 'array', items: zodToJsonSchema(schema.elementType) };
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema.innerType());
  return {};
}

// 第三步：LLM 调用 + 解析 + 验证
async function extractProduct(description: string): Promise<Product> {
  const client = new OpenAI();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: '从描述中提取产品信息，严格返回 JSON。' },
      { role: 'user', content: description }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'Product',
        schema: zodToJsonSchema(ProductSchema)
      }
    }
  });

  const raw = JSON.parse(response.choices[0].message.content);
  // 第四步：Zod 验证（即使 LLM 输出正确，验证也是最后的安全网）
  return ProductSchema.parse(raw);  // 抛出 ZodError 或返回 Product
}

// 使用
try {
  const product = await extractProduct('iPhone 15 Pro，售价 7999 元，有蓝色和银色可选，库存充足');
  console.log(product.name);  // string ✅
  console.log(product.price); // number ✅
} catch (err) {
  // Zod 验证失败：LLM 输出不符合 schema
  console.error('LLM 输出验证失败:', err);
}
```

### 5.1 Zod 验证的错误处理

```typescript
const result = ProductSchema.safeParse(raw);

if (!result.success) {
  // result.error 是 ZodError，包含详细的验证错误信息
  const issues = result.error.issues;
  console.log('验证失败:', issues);
  // [{ path: ['price'], message: 'Number must be positive', code: 'too_small' }]
}
```

**为什么即使 LLM 有结构化输出也要验证？** 因为：
1. API 兼容性问题（模型版本不支持结构化输出时的降级处理）
2. 边界情况（LLM 可能输出 schema 外的内容，即使 `strict: true` 也非 100%）
3. 防御性编程：验证层是最后的安全网

## 六、函数调用 vs 结构化输出：如何选择

| 场景 | 推荐 | 原因 |
|------|------|------|
| LLM 需要调用工具/插件 | **函数调用（Function Calling）** | 专为工具执行设计，参数类型丰富 |
| 只需返回结构化数据 | **结构化输出** | 更轻量，不引入工具框架 |
| 需要枚举约束、范围限制 | **结构化输出 + enum/range** | LLM 只能从给定选项中选 |
| 需要 100% 可靠性（生产环境） | **结构化输出 + Zod 验证** | 双保险 |
| 开放式生成（文章、摘要） | JSON Mode 或自由文本 | 不需要严格结构 |

## 七、实战一：多步骤数据提取流水线

从一份混乱的用户资料中提取结构化信息，每一步依赖前一步：

```typescript
// Step 1: 识别数据类型
const Step1Schema = z.object({
  type: z.enum(['resume', 'invoice', 'receipt', 'unknown'])
});
const { type } = await llmStructuredOutput(rawText, Step1Schema);

// Step 2: 根据类型提取对应字段
const extractors = {
  resume: ResumeSchema,
  invoice: InvoiceSchema,
  receipt: ReceiptSchema,
};

const extractor = extractors[type];
if (!extractor) throw new Error('不支持的数据类型: ' + type);

const data = await llmStructuredOutput(rawText, extractor);
```

## 八、实战二：批量处理 + 并发控制

```typescript
async function extractAll(products: string[]): Promise<Product[]> {
  // 限制并发数（避免 API 速率限制）
  const concurrency = 5;
  const results: Product[] = [];

  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(desc => extractProduct(desc))
    );

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`提取失败 [${i + idx}]:`, result.reason.message);
      }
    });
  }

  return results;
}
```

## 九、实战三：前端集成（流式展示结构化结果）

在 React 中，分步骤展示 LLM 的解析结果：

```tsx
import { useState } from 'react';

interface ExtractionStep {
  field: string;
  value: string | number | boolean;
  confidence: 'high' | 'medium' | 'low';
}

async function extractWithSteps(text: string): Promise<ExtractionStep[]> {
  // 每次提取一个字段，降低单次调用复杂度，提高准确性
  const fields = ['name', 'age', 'email', 'role'];

  return Promise.all(
    fields.map(async (field): Promise<ExtractionStep> => {
      const result = await llmStructuredOutput(text, FieldSchema(field));
      return { field, value: result.value, confidence: result.confidence };
    })
  );
}

function DataExtractor() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ExtractionStep[]>([]);
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    setLoading(true);
    try {
      const steps = await extractWithSteps(input);
      setResult(steps);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleExtract} disabled={loading}>
        {loading ? '提取中...' : '提取数据'}
      </button>
      <ul>
        {result.map(step => (
          <li key={step.field}>
            {step.field}: {String(step.value)}
            <span style={{ color: step.confidence === 'high' ? 'green' : 'orange' }}>
              ({step.confidence})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 十、常见错误与排查

### 10.1 LLM 输出了非 JSON 内容

```json
{
  "type": "json_object",
  "json_schema": { ... }
}
```

**原因**：模型不支持或未启用结构化输出。检查 API 版本和模型支持情况。

**解决**：添加 `strict: true`（OpenAI），或用 Zod 验证层兜底。

### 10.2 字段类型不匹配

```json
{ "age": "28" }  // 返回字符串而非数字
```

**原因**：即使有 schema 约束，LLM 仍可能选错类型。

**解决**：Zod 验证层捕获并抛出错误，或用 `z.coerce` 在验证时做类型转换。

### 10.3 缺少必需字段

**解决**：schema 中务必声明 `required`，结构化输出会保证它们存在。

### 10.4 响应太长被截断

```javascript
// 设置足够的 max_tokens（结构化输出的 JSON 通常比自由文本短，但仍需预留）
max_tokens: 4096  // 根据预期输出大小调整
```

### 10.5 流式响应不支持结构化输出

**原因**：结构化输出需要完整输出才能保证正确性，流式（streaming）模式下无法实现。

**解决**：使用非流式响应（`stream: false`），在完整生成后再解析。

## 十一、各大模型 Structured Output 支持情况

| 模型 | 支持情况 | 备注 |
|------|---------|------|
| GPT-4o (2024-08-06+) | ✅ 完整支持 | `strict: true` 最可靠 |
| GPT-4 Turbo (2024-04-09+) | ✅ 支持 | 需指定 `json_schema` |
| GPT-3.5 Turbo | ❌ 不支持 | 只能 JSON Mode |
| Claude 3.5 Sonnet+ | ✅ 完整支持 | `output.json_schema` |
| Claude 3 | ⚠️ 有限支持 | 建议升级 |
| Gemini 1.5 Pro | ✅ 完整支持 | `responseSchema` |
| Gemini 1.5 Flash | ✅ 完整支持 | 同上 |
| Claude 3.5 Haiku | ✅ 支持 | |
| Llama 3.1 (405B) | ⚠️ 需微调 | 开源模型中有限支持 |

> 更新提示：AI 模型能力迭代迅速，建议查阅各厂商最新文档确认支持情况。

## 十二、总结

结构化输出是 LLM 从「生成文本」进化到「生成程序可用数据」的关键一步：

- **OpenAI / Anthropic / Google 各有方案**：JSON Schema / output.json_schema / responseSchema
- **Zod 是类型安全的桥梁**：Zod schema → JSON Schema → LLM → JSON → Zod 验证 → TypeScript 类型
- **函数调用 ≠ 结构化输出**：前者用于工具调用，后者用于数据提取
- **双保险策略**：结构化输出（约束 LLM 行为）+ Zod 验证（拦截异常数据）
- **生产环境必选**：任何依赖 LLM 输出的下游系统，都不应该裸用 raw LLM text

**记住**：让 LLM 返回 JSON 不是「让它输出看起来像 JSON 的文字」，而是「用 schema 约束它的输出空间，用验证层兜住意外」。

---

*本文由小虾子 🦐 撰写*
