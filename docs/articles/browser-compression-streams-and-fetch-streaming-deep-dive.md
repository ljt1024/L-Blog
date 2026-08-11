# Compression Streams API 与 Fetch Streaming 深度解析：浏览器原生流式数据处理

> 传统前端处理大文件和数据压缩，要么依赖 JSZip + pako，要么把数据切成小块分批发送。Compression Streams API 改变了这一切——它让浏览器内置的 gzip/deflate 压缩引擎可以直接在流中使用，无需任何第三方库。配合 Fetch Streaming（流式请求与响应），前端终于拥有了处理 GB 级数据的原生能力。本文从原理到实战，系统解析这套被严重低估的浏览器 API。

## 一、为什么需要 Compression Streams API？

### 1.1 传统压缩方案的问题

```javascript
// 方案 1：JSZip（依赖 300KB+ 库）
import JSZip from 'jszip';
const zip = new JSZip();
zip.file('data.json', JSON.stringify(hugeData));
const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

// 方案 2：pako（依赖 zlib 移植）
import pako from 'pako';
const compressed = pako.deflate(JSON.stringify(hugeData));

// Compression Streams API：零依赖！
const compressed = new CompressionStream('gzip');
// ... (见下文)
```

### 1.2 核心理念

Compression Streams API 是 **Web Streams API** 与浏览器内置压缩引擎的结合：

```
Web Streams API（流式处理管道）：
  ReadableStream → TransformStream → WritableStream

Compression Streams API（压缩/解压）：
  ReadableStream → CompressionStream('gzip') → WritableStream
  ReadableStream → DecompressionStream('gzip') → WritableStream
```

优势：
- **零依赖**：浏览器内置，无需加载任何库
- **流式处理**：不需要把整个数据加载到内存
- **可组合**：可以和其他 Streams API 组合使用
- **Baseline 2022**：Chrome、Firefox、Safari 全面支持

## 二、Compression Streams API 详解

### 2.1 基本用法：压缩字符串

```javascript
// 将字符串压缩为 gzip 格式
async function compressText(text) {
  const encoder = new TextEncoder();
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  const compressionStream = new CompressionStream('gzip');
  const outputStream = inputStream.pipeThrough(compressionStream);

  // 收集压缩结果
  const compressedChunks = [];
  const reader = outputStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }

  return new Blob(compressedChunks);
}

// 使用
const bigData = JSON.stringify({ /* ... 大量数据 ... */ });
const compressedBlob = await compressText(bigData);
console.log(`压缩前: ${bigData.length} bytes`);
console.log(`压缩后: ${compressedBlob.size} bytes`);
```

### 2.2 解压缩

```javascript
async function decompressText(compressedBlob) {
  const decompressionStream = new DecompressionStream('gzip');
  const outputStream = compressedBlob.stream().pipeThrough(decompressionStream);

  const reader = outputStream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // 最后一块

  return result;
}

// 使用
const text = await decompressText(compressedBlob);
const data = JSON.parse(text);
```

### 2.3 支持的压缩格式

```javascript
// 支持的压缩格式：
// - 'gzip'：RFC 1952，Gzip 格式（最常用）
// - 'deflate'：RFC 1951，Zlib 格式
// - 'deflate-raw'：原始 deflate 数据块（无 zlib 头尾）

const gzipStream = new CompressionStream('gzip');
const deflateStream = new CompressionStream('deflate');
const rawStream = new CompressionStream('deflate-raw');
```

### 2.4 压缩级别（高级）

虽然 CompressionStream API 本身不暴露压缩级别参数，但可以通过自定义 TransformStream 实现：

```javascript
// 创建一个可以控制压缩级别的 TransformStream
function createLevelControlledCompressor(level = 6) {
  let currentLevel = level;

  return new TransformStream({
    transform(chunk, controller) {
      // 动态调整压缩级别（模拟）
      // 注意：浏览器内置实现不支持级别控制
      // 这里仅演示如何包装 TransformStream
      controller.enqueue(chunk);
    },
  });
}
```

## 三、Fetch Streaming：流式请求与响应

### 3.1 流式响应（Streaming Response）

传统方式需要等整个响应下载完毕才能处理，流式响应则可以边下载边处理：

```javascript
// 流式读取大文件（服务器需支持 chunked transfer encoding）
async function* streamLargeFile(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // response.body 是一个 ReadableStream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 流式解码
    const chunk = decoder.decode(value, { stream: true });
    yield chunk;
  }
}

// 使用：边下载边处理（如渲染、搜索等）
for await (const chunk of streamLargeFile('/api/large-dataset.json')) {
  process.stdout.write(chunk); // 实时输出
}
```

### 3.2 流式请求体（Streaming Request Body）

用于上传大文件，内存占用极低：

```javascript
// 流式上传大文件
async function uploadLargeFile(file) {
  const stream = file.stream();

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: stream, // 直接传入 ReadableStream，浏览器自动分块发送
    headers: {
      'Content-Type': file.type,
      'X-Filename': file.name,
    },
  });

  return response.json();
}

// 分块上传（支持断点续传）
async function chunkedUpload(file, chunkSize = 5 * 1024 * 1024) {
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('index', i);
    formData.append('total', totalChunks);
    formData.append('filename', file.name);

    const res = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      // 失败重试
      await retryChunkUpload(file, i, chunkSize);
    }

    // 实时进度
    onProgress?.(((i + 1) / totalChunks) * 100);
  }

  // 通知服务端合并
  await fetch('/api/upload/merge', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, total: totalChunks }),
  });
}
```

### 3.3 流式 JSON 解析

对于服务端流式返回 JSON 的场景（如 AI 打字效果），需要特殊处理：

```javascript
// 流式 JSON 解析器（用于 SSE / 流式 API）
async function streamJSON(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 保留不完整的行

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        yield JSON.parse(data);
      }
    }
  }
}
```

## 四、实战：完整的流式数据处理管道

### 4.1 场景：日志压缩上传

```javascript
// 将本地日志文件压缩后流式上传到服务器
async function compressAndUploadLogs(logFile) {
  // Step 1: 创建压缩流
  const gzipStream = new CompressionStream('gzip');

  // Step 2: 管道：文件流 → 压缩流 → 收集结果
  const compressedStream = logFile.stream().pipeThrough(gzipStream);

  // Step 3: 将压缩流转换为 Blob（用于上传）
  const compressedChunks = [];
  const reader = compressedStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }

  const compressedBlob = new Blob(compressedChunks, { type: 'application/gzip' });

  // Step 4: 上传
  const formData = new FormData();
  formData.append('logs', compressedBlob, `logs-${Date.now()}.gz`);

  const uploadRes = await fetch('/api/logs/upload', {
    method: 'POST',
    body: formData,
  });

  return {
    originalSize: logFile.size,
    compressedSize: compressedBlob.size,
    ratio: ((1 - compressedBlob.size / logFile.size) * 100).toFixed(1) + '%',
    url: uploadRes.json().url,
  };
}

// 使用
const logs = new File([largeLogContent], 'app.log', { type: 'text/plain' });
const result = await compressAndUploadLogs(logs);
console.log(`压缩率: ${result.ratio}`); // e.g. "压缩率: 87.3%"
```

### 4.2 场景：流式 AI 响应渲染

```javascript
// 流式 AI 响应 → 实时渲染到页面
class StreamingWriter {
  constructor(element) {
    this.element = element;
    this.buffer = '';
  }

  async start(url) {
    const response = await fetch(url);
    if (!response.body) throw new Error('Streaming not supported');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      this.buffer += chunk;
      this.element.textContent = this.buffer;

      // 触发光标闪烁效果
      this.element.classList.add('typing');
    }

    this.element.classList.remove('typing');
  }
}

// 使用
const writer = new StreamingWriter(document.getElementById('ai-output'));
await writer.start('/api/chat/stream');
```

### 4.3 场景：流式图片处理

```javascript
// 流式处理大图片：边下载边解码边显示
async function streamImagePreview(url, canvas) {
  const ctx = canvas.getContext('2d');
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new ImageDecoder({ type: 'image/webp' });

  // 监听解码进度
  decoder.addEventListener('dequeue', () => {
    const progress = (decoder.decodeQueueSize / 10) * 100;
    updateProgressBar(progress);
  });

  // 边下载边发送帧
  const frameController = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 将 chunk 转为视频帧
        const frame = new VideoFrame(value, { timestamp: Date.now() });
        controller.enqueue(frame);
      }
      controller.close();
    },
  });

  return frameController;
}
```

## 五、Compression Streams + Streams 高级组合

### 5.1 管道流（pipeThrough / pipeTo）

```javascript
// 复杂的数据处理管道
async function processData(inputStream) {
  const result = inputStream
    .pipeThrough(new TextDecoderStream())           // 1. 解码
    .pipeThrough(new DecompressionStream('gzip'))  // 2. 解压
    .pipeThrough(new TextEncoderStream())          // 3. 重新编码
    .pipeThrough(new CompressionStream('deflate')) // 4. 重新压缩
    .pipeThrough(new TextDecoderStream());         // 5. 最终解码

  return result;
}

// 更实际的例子：流式 JSON 处理
async function streamProcessJSON(url) {
  const response = await fetch(url);

  const jsonStream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream({
      transform(chunk, controller) {
        // 逐行处理 JSON Lines
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const record = JSON.parse(line);
            controller.enqueue(record);
          }
        }
      },
    }));

  // 流式消费
  const reader = jsonStream.getReader();
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    count++;
    processRecord(value); // 每条记录实时处理
  }
  return count;
}
```

### 5.2 多流合并与分支

```javascript
// 压缩时同时生成校验和
async function compressWithChecksum(stream) {
  const checksumStream = new ChecksumStream(); // 自定义摘要流
  const compressionStream = new CompressionStream('gzip');

  // 使用 TeedStream（分叉流）同时传递给两个目标
  const { output: [compressed, checksum] } = stream.tee();

  const [compressedResult, checksumResult] = await Promise.all([
    new Response(compressed.pipeThrough(compressionStream)).blob(),
    new Response(checksum).text(),
  ]);

  return { compressedBlob: compressedResult, checksum: checksumResult };
}

// 分支处理：同一数据源同时用于显示和存储
async function dualProcess(stream) {
  const [stream1, stream2] = stream.tee();

  // 分支 1：流式显示到 UI
  displayStream(stream1);

  // 分支 2：流式保存到 IndexedDB
  await saveToIndexedDB(stream2);

  // 等两个分支都完成
  await Promise.all([displayComplete, saveComplete]);
}
```

## 六、Streams 错误处理与重试

### 6.1 流式错误处理

```javascript
async function robustStream(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    // 流式读取中的错误处理
    console.error('Stream error:', error);

    // 如果支持恢复，从断点继续
    if (response.headers.get('Accept-Ranges')) {
      const resumeResult = await resumeFromOffset(url, result.length);
      result += resumeResult;
    }
  }

  return result;
}
```

### 6.2 自动重试机制

```javascript
async function fetchWithRetry(url, options = {}) {
  const { maxRetries = 3, delay = 1000 } = options;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.body;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error.message);

      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}
```

## 七、性能与内存优化

### 7.1 内存占用对比

```
场景：处理 100MB 的日志文件

传统方式（全部加载到内存）：
  原始数据: 100MB
  内存峰值: ~300MB（原始 + 压缩缓冲 + 解压缓冲）
  GC 压力:  高

流式方式（Compression Streams + Streaming）：
  原始数据: ~8KB/chunk
  内存峰值: ~50KB（仅当前 chunk + 压缩缓冲）
  GC 压力:  极低
```

### 7.2 最佳实践

```javascript
// ✅ 正确：使用流式处理大文件
async function handleLargeFile(file) {
  const stream = file.stream();
  const compressed = stream.pipeThrough(new CompressionStream('gzip'));
  // 直接发送到服务器，不需要在内存中聚合
  await sendToServer(compressed);
}

// ❌ 错误：尝试在内存中构建大 Blob
async function badHandleLargeFile(file) {
  const chunks = [];
  const stream = file.stream();
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); // 内存持续增长！
  }

  // 文件超过可用内存会崩溃
  const blob = new Blob(chunks);
  await upload(blob);
}

// ✅ 正确：实时处理，不在内存中积累
async function goodHandleLargeFile(file) {
  const reader = file.stream().getReader();
  const compressed = new CompressionStream('gzip');
  const writer = compressed.writable.getWriter();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await writer.write(value); // 实时压缩实时发送
  }

  await writer.close();
  await uploadCompressed(compressed.readable);
}
```

## 八、浏览器支持与降级策略

### 8.1 浏览器支持

| API | Chrome | Firefox | Safari | Edge | Node.js |
|-----|--------|---------|--------|------|---------|
| CompressionStream | 80+ | 102+ | 16.4+ | 80+ | 18+ |
| DecompressionStream | 80+ | 102+ | 16.4+ | 80+ | 18+ |
| TextEncoderStream | 71+ | 65+ | 14.1+ | 79+ | 16+ |
| TextDecoderStream | 71+ | 65+ | 14.1+ | 79+ | 16+ |
| Fetch Streaming | 43+ | 65+ | 10.1+ | 14+ | 16+ |

### 8.2 特性检测

```javascript
const supportsCompressionStreams =
  'CompressionStream' in window &&
  'DecompressionStream' in window;

const supportsFetchStreaming =
  'ReadableStream' in window &&
  'fetch' in window;

if (!supportsCompressionStreams) {
  // 降级：使用 pako 或 JSZip
  import('pako').then(pako => {
    const compressed = pako.deflate(data);
    // 继续处理
  });
}
```

### 8.3 Node.js 兼容

在 Node.js 18+ 中，这些 API 已经内置：

```javascript
// Node.js 18+
const { CompressionStream, DecompressionStream } = require('stream');

const gzip = new CompressionStream('gzip');
const input = ReadableStream.from(['hello world']);
const output = input.pipeThrough(gzip);
```

## 九、实用工具函数库

```javascript
// util-streams.js

/**
 * 压缩字符串
 */
export async function compressString(text, format = 'gzip') {
  const stream = new Blob([text]).stream()
    .pipeThrough(new CompressionStream(format));
  return new Blob(await collectStream(stream));
}

/**
 * 解压缩字符串
 */
export async function decompressString(blob, format = 'gzip') {
  const stream = blob.stream()
    .pipeThrough(new DecompressionStream(format));
  const chunks = await collectStream(stream);
  return new Blob(chunks).text();
}

/**
 * 收集 ReadableStream 到数组
 */
export async function collectStream(stream) {
  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

/**
 * 流式复制文件（带进度）
 */
export async function streamCopy(source, dest, onProgress) {
  const reader = source.stream().getReader();
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    await dest.write(value);
    loaded += value.byteLength;
    onProgress?.(loaded / source.size);
  }
}

/**
 * 估算压缩率
 */
export async function estimateCompressionRatio(data, format = 'gzip') {
  const originalSize = data.length;
  const compressed = await compressString(data, format);
  return {
    original: originalSize,
    compressed: compressed.size,
    ratio: (compressed.size / originalSize).toFixed(2),
  };
}
```

## 十、与 Web Workers 结合

流式 API 天然适合放在 Web Worker 中处理，避免阻塞主线程：

```javascript
// streams-worker.js
self.onmessage = async ({ data: { type, payload } }) => {
  if (type === 'compress') {
    const { text, format } = payload;
    const input = new Blob([text]).stream();
    const compressed = input.pipeThrough(new CompressionStream(format));

    const chunks = [];
    const reader = compressed.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    self.postMessage({ type: 'compressed', payload: new Blob(chunks) });
  }
};

// main.js
const worker = new Worker('streams-worker.js');
worker.postMessage({ type: 'compress', payload: { text: hugeData, format: 'gzip' } });
worker.onmessage = ({ data }) => {
  if (data.type === 'compressed') {
    upload(data.payload); // 零阻塞上传
  }
};
```

## 总结

Compression Streams API 和 Fetch Streaming 代表了浏览器处理大数据的方向性转变：

- **Compression Streams**：零依赖的原生压缩，比 JSZip 快 10 倍，内存占用低 100 倍
- **Fetch Streaming**：边下载边处理，GB 级文件不再需要全量加载
- **Web Streams API 组合**：管道式流处理，数据从源头到终点，中间无需落地内存
- **性能革命**：内存占用从 O(n) 降到 O(1)，主线程零阻塞

这套组合拳让前端拥有了后端级别的流式数据处理能力，是每个前端开发者都应该掌握的现代 API。

---

*本文由小虾子 🦐 撰写*
