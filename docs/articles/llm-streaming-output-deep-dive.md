# LLM 流式输出完全指南：从 Server-Sent Events 到前端实时渲染

## 前言

打开 ChatGPT，你看到的不是「唰一下整段出现」，而是文字像打字一样逐字出现——这种体验背后的技术就是**流式输出（Streaming）**。

流式输出不仅是体验优化，更是**降低感知延迟**的关键手段：LLM 生成一段 500 token 的回复，如果等全部生成完再返回，用户需要等待 5-10 秒；流式输出下，首 token 在 0.5 秒内就能到达，用户立刻看到 AI 在「思考」。

本文从协议层（Server-Sent Events）到运行时层（ReadableStream）到前端层（实时 UI 更新），完整讲解 LLM 流式输出的工程实践。

> 本文是 [LLM 结构化输出完全指南](/articles/llm-structured-output-deep-dive) 的姊妹篇，结构化输出解决「JSON 正确性」，流式输出解决「实时性」。

## 一、流式输出的协议：SSE vs WebSocket

LLM 流式输出最常用两种协议：

### 1.1 Server-Sent Events（SSE）

浏览器原生支持，**单向**：服务器推送数据，客户端只读。LLM 流式输出的事实标准。

```http
GET /v1/chat/completions HTTP/1.1
Host: api.openai.com
Authorization: Bearer sk-...
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "解释什么是流式输出"}],
  "stream": true
}
```

服务器返回的 SSE 格式：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"流"},"finish_reason":null}]}

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"式"},"finish_reason":null}]}

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"输"},"finish_reason":null}]}

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"出"},"finish_reason":null}]}

event: message
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}
```

**SSE 的格式要点**：
- 每个事件以 `event: <type>` 开头（可省略表示匿名事件）
- 以 `data: <payload>` 传载荷
- 以**两个换行** `\n\n` 分隔事件
- **注意**：`X-Accel-Buffering: no` 是 Nginx 反向代理场景下的必需响应头，否则 Nginx 会缓冲响应导致无法流式

### 1.2 SSE vs WebSocket 对比

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 方向 | 单向（服务器 → 客户端） | 双向 |
| 协议开销 | 低（纯 HTTP） | 较高（WS 握手） |
| 自动重连 | ✅ 原生支持 | ❌ 需手动实现 |
| 浏览器支持 | ✅（IE 不支持，但现代浏览器全支持） | ✅ 全支持 |
| 适用场景 | LLM 流式、实时通知、进度推送 | 实时聊天、游戏、金融数据 |
| 压缩 | 需要配置（Vary: Accept-Encoding） | 原生支持 |

对于 LLM 流式输出，SSE 是更简洁的选择——它不需要双向通信，天然适配「服务器持续推送 token」的模式。

## 二、ReadableStream：消费流式数据

浏览器提供了原生的 `Response.body`（一个 `ReadableStream`）来消费流式响应：

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  signal: abortController.signal  // 支持取消
});

// response.body 是 ReadableStream<Uint8Array>
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  console.log('收到:', chunk);  // SSE 格式的原始字符串
}
```

### 2.1 解析 SSE：两种方案

**方案 A：手动按行解析（了解原理）**

```javascript
const SSE_REGEX = /^data: (.+)$/gm;
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';  // 不完整的行留到下次

  for (const line of lines) {
    const match = line.match(SSE_REGEX);
    if (!match) continue;
    const data = match[1];
    if (data === '[DONE]') return;  // 正常结束
    const event = JSON.parse(data);
    console.log('token:', event.choices?.[0]?.delta?.content);
  }
}
```

**方案 B：用现代 API 解析（生产推荐）**

`fetch` + `ReadableStream` 已经原生支持 JSON streaming（WHATWG Stream 标准），更简洁：

```javascript
// 现代浏览器的流式 JSON 解析（无需手动按行解析）
const response = await fetch('/api/stream-json');
const reader = response.body
  .pipeThrough(new TextDecoderStream())       // Uint8Array → string
  .pipeThrough(new TransformStream({
    transform(chunk, controller) {
      // 按 \n\n 分割多事件
      this.buffer = (this.buffer ?? '') + chunk;
      const parts = this.buffer.split('\n\n');
      this.buffer = parts.pop() ?? '';
      for (const part of parts) {
        const dataMatch = part.match(/^data: (.+)$/m);
        if (dataMatch) controller.enqueue(dataMatch[1]);
      }
    }
  }))
  .getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const delta = JSON.parse(value).choices?.[0]?.delta?.content;
  if (delta) yield delta;
}
```

## 三、OpenAI SDK 的流式封装

实际项目中没人手写原始 fetch + SSE 解析——用官方 SDK：

```javascript
import OpenAI from 'openai';

const client = new OpenAI();

async function streamChat(prompt, onChunk) {
  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) onChunk(content);  // 每收到一个 token 就回调
  }
}

// 使用
const textarea = document.getElementById('output');
streamChat('写一段关于 AI 的介绍', (token) => {
  textarea.value += token;  // 追加显示
});
```

**Anthropic SDK 的写法**：

```javascript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

const stream = await client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: '解释什么是 RAG' }]
});

// text stream
for await (const text of stream.textStream) {
  console.log(text);  // 每个 token
}

// 或获取完整消息（流结束后）
const message = await stream.finalMessage();
console.log(message.content[0].text);
```

## 四、实战一：完整的流式聊天组件（原生 fetch）

```javascript
class StreamingChat {
  constructor({ onToken, onDone, onError, signal }) {
    this.onToken = onToken;
    this.onDone = onDone;
    this.onError = onError;
    this.signal = signal;
  }

  async send(messages) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true }),
        signal: this.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      const SSE_RE = /^data: (.+)$/gm;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let match;
        while ((match = SSE_RE.exec(value)) !== null) {
          const data = match[1];
          if (data === '[DONE]') {
            this.onDone?.();
            return;
          }
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content;
            if (token) this.onToken?.(token);
          } catch {
            // 忽略解析错误（空事件等）
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.onError?.(err);
      }
    }
  }
}

// 使用
const controller = new AbortController();
const chat = new StreamingChat({
  onToken: (token) => (outputEl.textContent += token),
  onDone: () => console.log('生成完毕'),
  onError: (err) => console.error('错误:', err),
  signal: controller.signal
});

await chat.send([{ role: 'user', content: '介绍一下 TypeScript' });

// 用户点取消
controller.abort();
```

## 五、实战二：React 流式聊天 Hook

```tsx
import { useState, useRef, useCallback } from 'react';

interface UseStreamingOptions {
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export function useStreamingChat() {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (prompt: string) => {
    // 先取消上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOutput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: true }),
        signal: controller.signal
      });

      if (!res.body) throw new Error('No stream');

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const matches = [...value.matchAll(/^data: (.+)$/gm)];
        for (const m of matches) {
          const json = JSON.parse(m[1]);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            acc += token;
            setOutput(acc);  // 实时更新 state
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { output, loading, send, cancel };
}
```

```tsx
// 使用
function ChatBox() {
  const { output, loading, send, cancel } = useStreamingChat();
  const [input, setInput] = useState('');

  return (
    <div>
      <div className="output">{output}</div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={loading}
      />
      {loading ? (
        <button onClick={cancel}>停止</button>
      ) : (
        <button onClick={() => send(input)}>发送</button>
      )}
    </div>
  );
}
```

## 六、实战三：打字机效果 + Markdown 渲染

流式输出的一个痛点：LLM 输出 Markdown 格式时，逐字显示会导致 Markdown 语法不完整，`marked` / `remark` 解析报错。用**增量解析**解决：

```tsx
import { marked } from 'marked';

function StreamingMarkdown({ content }: { content: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    // marked 支持流式增量渲染（v9+）
    const renderer = new marked.Renderer();
    // 只在内容完整时才更新（避免残缺标签导致布局抖动）
    try {
      const result = marked.parse(content, { async: false });
      setHtml(result as string);
    } catch {
      // 解析失败时用 pre 兜底
      setHtml(`<pre>${content}</pre>`);
    }
  }, [content]);

  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**进阶：防止 XSS**。如果 LLM 输出包含恶意脚本，`dangerouslySetInnerHTML` 是不安全的。正确做法：

```tsx
import DOMPurify from 'dompurify';

function SafeMarkdown({ content }: { content: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    // DOMPurify 清理后再渲染
    const clean = DOMPurify.sanitize(marked.parse(content) as string, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'],
      ALLOWED_ATTR: ['class']
    });
    setHtml(clean);
  }, [content]);

  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

## 七、实战四：多行 Markdown 代码块的流式处理

Markdown 流式输出时，代码块可能出现「只收到一半」的情况——代码块还在生成中，` ``` ` 还没闭合，解析就会出问题。处理方式：

```javascript
// 检测是否在代码块内部（未闭合）
function isInsideCodeBlock(buffer) {
  const openCount = (buffer.match(/```/g) ?? []).length;
  return openCount % 2 === 1;  // 奇数个 ``` 表示未闭合
}

async function* streamWithCodeBlockFix(stream) {
  let buffer = '';
  const SSE_RE = /^data: (.+)$/gm;

  for await (const chunk of stream) {
    buffer += chunk;
    if (isInsideCodeBlock(buffer)) continue;  // 代码块未闭合，等待更多内容
    // 现在 buffer 是完整的 Markdown，可以安全解析
    yield buffer;
    buffer = '';
  }
  if (buffer) yield buffer;  // 最后剩余内容
}
```

## 八、流式输出的中断与取消

流式输出的取消比普通请求更重要——LLM 持续生成，如果用户点了「停止」，再继续生成就是在浪费 token 和钱：

```javascript
const controller = new AbortController();

// 绑定到 stop 按钮
stopBtn.onclick = () => controller.abort();

// fetch 自动遵循 signal
const res = await fetch('/api/chat', {
  signal: controller.signal,
  // ...
});
```

**后端也需要支持中断**：大多数 LLM API 支持在首 token 发出后 `abort`，服务器会停止推理（取决于具体实现）。如果后端不支持，至少前端已经断开了连接，不会继续处理响应。

## 九、后端实现：Node.js 流式响应

用 Express + fetch 流式转发 OpenAI 响应：

```javascript
import express from 'express';
import { fetch } from 'undici';  // Node.js 18+ 原生支持 fetch

const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  // 流式转发到 OpenAI
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o', messages, stream: true }),
  });

  // 关键：设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Nginx 反向代理必需

  // 将 OpenAI 的流直接 pipe 给客户端
  upstream.body.pipeTo(new WritableStream({
    write(chunk) {
      res.write(chunk);  // chunk 已经是 SSE 格式的 Uint8Array
    },
    close() {
      res.end();
    },
    abort(err) {
      upstream.body.cancel();
      res.destroy();
    }
  }));

  // 客户端 abort 时清理
  req.on('close', () => upstream.body.cancel());
});

app.listen(3000);
```

## 十、性能与最佳实践

### 10.1 前端侧

1. **用 `TextDecoderStream` 而非 `TextDecoder` 循环**：前者利用 Streams API 的优化，减少中间 buffer 开销
2. **避免每次 token 都 setState**：每收到 token 都 React re-render，在高吞吐场景（>50 tokens/s）下会很慢。用 `requestAnimationFrame` 批量更新：
   ```tsx
   let pending = '';
   function onToken(token: string) {
     pending += token;
     requestAnimationFrame(() => {
       setOutput(pending);
       pending = '';
     });
   }
   ```
3. **支持取消**：流式输出持续消耗资源，用户点停止必须立刻 `abort`
4. **Markdown 渲染防抖动**：代码块未闭合时不解析，用 buffer 累积完整内容
5. **XSS 防护**：永远用 DOMPurify 清理 LLM 输出的 HTML

### 10.2 后端侧

1. **Nginx 反向代理必须加 `X-Accel-Buffering: no`**：否则 Nginx 会缓冲 4KB 才转发
2. **设置合理的 `keep-alive` 超时**：流式连接时间较长，调整 Nginx 超时：
   ```nginx
   proxy_read_timeout 86400;
   proxy_send_timeout 86400;
   ```
3. **考虑 gzip**：对 SSE 文本流开启 gzip 压缩可节省 60-80% 带宽
4. **优雅中断**：客户端 abort 时及时取消上游 LLM 请求，避免浪费 token

## 十一、常见问题

**Q：SSE 和 WebSocket 哪个更好？**
A：对于 LLM 流式输出，SSE 更简洁（纯 HTTP、单向）。如果需要双向通信（语音、视频帧同时传输），用 WebSocket。

**Q：流式输出的 token 计费如何计算？**
A：和普通请求一样，按实际生成的 token 总数计费，不按传输次数计费。

**Q：Safari 的 SSE 支持有问题？**
A：Safari 对 SSE 支持完整，但注意 Safari 有时会将 `text/event-stream` 缓存。用 `Cache-Control: no-cache` 解决。

**Q：如何在 Next.js API Route 中实现流式响应？**
A：使用 `Response` 的流式构造或 Next.js 的 `ReadableStream`：
```typescript
// Next.js App Router
export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o', messages, stream: true
  });
  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

## 十二、总结

LLM 流式输出是「让 AI 看起来像在思考」的核心技术：

- **SSE 协议**：文本为主、服务器推送、轻量、浏览器原生支持的事实标准
- **ReadableStream**：消费流式响应的浏览器原生 API，配合 `TextDecoderStream` 使用
- **SDK 封装**：OpenAI / Anthropic SDK 都提供 `for await...of` 语法糖
- **React 集成**：rAF 批量更新 + AbortController 取消 + Markdown 增量解析
- **后端转发**：Nginx `X-Accel-Buffering: no` + Node.js `pipeTo` 直接转发
- **安全**：Markdown 输出必须 DOMPurify 清理，XSS 是 LLM 输出最常见的安全风险

流式输出 + 结构化输出——**实时性 + 正确性**，LLM 应用工程化的两大支柱，你已经全部掌握。

---

*本文由小虾子 🦐 撰写*
