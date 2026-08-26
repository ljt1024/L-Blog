# WebGPU 与 Transformers.js 深度解析：浏览器端侧 AI 推理的完整实战

> 每一次调用云端 AI API，都是一次网络往返、一笔 Token 费用、一个隐私风险点。2026 年，WebGPU + Transformers.js 的组合让这一切成为历史：真正的端侧 AI 推理，零服务器成本，零数据传输，零 API Key。在 Chrome 113+、Firefox 147+、Safari 18+ 的今天，浏览器已经是完整的 GPU 计算平台。本文从原理到实战，系统解析如何在浏览器中跑起 LLM 和视觉模型。

## 一、为什么浏览器端侧 AI 在 2026 年已成现实

### 1.1 传统 AI 集成的三重代价

```javascript
// 传统方案：每一次调用都有代价
async function classifyText(text) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { /* API Key、Content-Type */ },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Classify: ${text}` }],
    }),
  });
  // 代价 1：网络往返延迟（200-800ms）
  // 代价 2：Token 计费（$0.15/1M tokens）
  // 代价 3：用户数据离开设备（GDPR/HIPAA 风险）
  return response.json();
}
```

### 1.2 端侧推理的核心优势

```
端侧 AI 推理的优势矩阵：

隐私         零数据传输，用户内容永不离开设备
延迟         无网络往返，本地 GPU 直接计算（1-50ms）
成本         模型下载一次，之后零 API 费用
离线         模型缓存后完全离线可用
规模化       用户越多，服务器成本为零
```

### 1.3 浏览器 GPU 能力的演进

```
WebGL（2011）：图形渲染专用，GPGPU hack
    ↓ 局限性：非原生 compute shader，性能受限
WebGPU（2023-2026）：原生 GPU compute API
    → Chrome 113（2023.6）/ Firefox 147（2026.1）/ Safari 18（2024.9）
    → Baseline 2026：87% 桌面 + 71% 移动端覆盖率
    → 计算着色器（Compute Shaders）：矩阵乘算速度 10-100x 提升
```

### 1.4 WebGPU vs WebGL 性能对比

| 操作 | WebGL | WebGPU | 提升倍数 |
|------|-------|--------|---------|
| 1024×1024 矩阵乘 | 45ms | 8ms | 5.6x |
| 4096×4096 矩阵乘 | 890ms | 95ms | 9.4x |
| Batch Attention (8 heads) | 120ms | 18ms | 6.7x |
| 125M 参数前向传播 | 340ms | 52ms | 6.5x |
| Qwen3 1.7B token 生成 | ~3 tok/s (WASM) | ~28 tok/s | 9x |

## 二、WebGPU 核心概念

### 2.1 架构概览

```javascript
// WebGPU 核心对象层次
const adapter = await navigator.gpu.requestAdapter({
  powerPreference: 'high-performance', // 请求独立显卡
});
// adapter：物理 GPU 设备抽象
// device：逻辑 GPU 设备，所有 API 的入口
// queue：命令提交队列
// buffer/texture：GPU 显存对象
// shaderModule：WGSL 着色器模块
// computePipeline：计算管线
```

### 2.2 完整的 WebGPU 初始化流程

```javascript
class WebGPUManager {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.queue = null;
  }

  async init() {
    // Step 1: 检测支持
    if (!navigator.gpu) {
      throw new Error('当前浏览器不支持 WebGPU');
    }

    // Step 2: 请求物理适配器（GPU 设备）
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance', // 优先独立显卡
    });

    if (!this.adapter) {
      throw new Error('无法获取 GPU 适配器');
    }

    // Step 3: 请求逻辑设备
    const features = [];
    // 启用所需特性
    if (this.adapter.features.has('float32-filterable')) {
      features.push('float32-filterable');
    }

    this.device = await this.adapter.requestDevice({
      defaultFormat: navigator.gpu.getPreferredCanvasFormat(),
      requiredFeatures: features,
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
      },
    });

    // Step 4: 处理设备丢失
    this.device.lost.then((info) => {
      console.error('WebGPU 设备丢失:', info.message);
      // 优雅降级或重新初始化
    });

    this.queue = this.device.queue;

    console.log(`WebGPU 初始化成功: ${this.adapter.info.vendor}, ${this.adapter.info.architecture}`);
    return true;
  }

  // 检测 WebGPU 可用性（静态方法）
  static async checkSupport() {
    if (!navigator.gpu) return { supported: false, reason: 'browser-no-support' };

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: 'adapter-null' };

    return {
      supported: true,
      adapter,
      info: adapter.info,
      isIntegrated: adapter.type === 'integrated',
      isDiscrete: adapter.type === 'discrete',
    };
  }
}

// 使用
const gpu = new WebGPUManager();
await gpu.init();
```

### 2.3 WGSL 计算着色器基础

```wgsl
// WGSL (WebGPU Shading Language) 计算着色器示例：向量加法
// 对应 JavaScript 创建管线：
// device.createComputePipeline({ compute: { module, entryPoint: 'main' } })

@group(0) @binding(0) var<storage, read> inputA : array<f32>;
@group(0) @binding(1) var<storage, read> inputB : array<f32>;
@group(0) @binding(2) var<storage, write> output : array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < arrayLength(&inputA)) {
    output[index] = inputA[index] + inputB[index];
  }
}
```

```javascript
// 在 JavaScript 中使用上述着色器
async function vectorAdd(device, queue, inputA, inputB) {
  const size = inputA.byteLength;

  // 创建 GPU Buffer
  const bufferA = device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(bufferA.getMappedRange()).set(inputA);
  bufferA.unmap();

  const bufferB = device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(bufferB.getMappedRange()).set(inputB);
  bufferB.unmap();

  const bufferOut = device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  // 编码命令
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(size / 64));
  passEncoder.end();
  queue.submit([commandEncoder.finish()]);

  // 读取结果
  const resultBuffer = device.createBuffer({ size, usage: GPUBufferUsage.COPY_SRC });
  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(bufferOut, 0, resultBuffer, 0, size);
  queue.submit([copyEncoder.finish()]);

  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());
  resultBuffer.unmap();

  return result;
}
```

## 三、Transformers.js：Hugging Face 的浏览器机器学习库

### 3.1 为什么选择 Transformers.js

```
Transformers.js 是 Hugging Face 将 Python transformers 库移植到 JavaScript 的作品：

核心优势：
  - 与 Python 版 API 设计几乎一致（pipeline 风格）
  - 自动选择最优后端：WebGPU > WebAssembly > JavaScript
  - 模型从 Hugging Face Hub 自动下载 + IndexedDB 缓存
  - 内置分词器（Tokenizer）、特征提取、模型量化
  - 支持：文本分类 / 生成 / 翻译 / 图像分类 / 语音识别 / Embedding

与 WebLLM 的对比：
  - Transformers.js：通用 NLP + 视觉 + 语音，支持 WASM 回退
  - WebLLM：专注聊天 UI，OpenAI 风格 API，仅 WebGPU
```

### 3.2 安装与基础配置

```bash
# npm 安装
npm install @huggingface/transformers

# 或 CDN（无构建工具场景）
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';
```

```javascript
import { pipeline, env } from '@huggingface/transformers';

// 关键配置项
env.allowLocalModels = false;       // 从 Hub 拉取模型（非本地）
env.useBrowserCache = true;          // 启用浏览器缓存
env.cacheDir = '/models';            // 自定义缓存目录

// WASM 配置（WebGPU 不可用时的 CPU 回退）
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
  env.backends.onnx.wasm.proxy = false; // 禁用代理模式，直接运行
}

// 后端自动选择：WebGPU > WASM > JS
async function pickBackend() {
  if (!navigator.gpu) return 'wasm';
  const adapter = await navigator.gpu.requestAdapter();
  return adapter ? 'webgpu' : 'wasm';
}
```

### 3.3 文本分类（5 行代码）

```javascript
import { pipeline } from '@huggingface/transformers';

// 情感分析：判断文本是正面还是负面
const classifier = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    device: 'webgpu',   // 自动回退到 'wasm' 如无 GPU
    dtype: 'q8',        // INT8 量化（~4x 内存节省）
  }
);

const result = await classifier(
  'Transformers.js makes browser-based AI surprisingly practical.'
);
// [{ label: 'POSITIVE', score: 0.9993 }]
```

### 3.4 文本 Embedding（向量检索核心）

```javascript
// 文本 Embedding 生成
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2', // 384 维，224MB（FP16）
  { device: 'webgpu', dtype: 'fp16' }
);

// 生成向量
const texts = [
  'What is WebGPU?',
  'How does browser AI work?',
  'Machine learning on the client side',
];

const embeddings = await embedder(texts, {
  pooling: 'mean',    // mean pooling
  normalize: true,    // L2 归一化
});

// embeddings.shape = [3, 384]
// 可直接用于余弦相似度计算
function cosineSimilarity(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
```

### 3.5 图像分类（完全端侧）

```javascript
// 图像分类：无需上传图片到服务器
const classifier = await pipeline(
  'image-classification',
  'Xenova/mobilenetv2-1.0-224',
  { device: 'webgpu', dtype: 'fp32' }
);

const imageUrl = 'https://example.com/sample-dog.jpg';
const result = await classifier(imageUrl);
// [
//   { label: 'golden retriever', score: 0.9821 },
//   { label: 'Labrador retriever', score: 0.0093 },
//   { label: 'beagle', score: 0.0031 },
// ]
```

### 3.6 命名实体识别（NER）

```javascript
// 本地 PII 检测：敏感数据永不离开浏览器
const extractor = await pipeline(
  'token-classification',
  'Xenova/bert-base-NER',
  { device: 'webgpu' }
);

const text = 'Please contact John Doe at john.doe@company.com or 555-1234';
const entities = await extractor(text);
// [
//   { entity: 'B-PER', score: 0.99, word: 'John', index: 2 },
//   { entity: 'I-PER', score: 0.98, word: 'Doe', index: 3 },
//   { entity: 'B-EMAIL', score: 0.99, word: 'john', index: 6 },
//   { entity: 'I-EMAIL', score: 0.98, word: '.doe', index: 7 },
//   { entity: 'B-EMAIL', score: 0.95, word: '@company', index: 8 },
//   { entity: 'B-PHONE', score: 0.91, word: '555', index: 11 },
// ]

// 本地脱敏
function maskPII(text, entities) {
  let result = text;
  const sortedEntities = [...entities].sort((a, b) => b.index - a.index);
  for (const entity of sortedEntities) {
    if (entity.entity.includes('PER')) {
      result = result.replace(entity.word, '***');
    } else if (entity.entity.includes('EMAIL')) {
      result = result.replace(entity.word, '[EMAIL_REDACTED]');
    }
  }
  return result;
}
```

## 四、浏览器端侧 LLM 推理实战

### 4.1 完整 Text Generation 流水线

```javascript
import { pipeline, env } from '@huggingface/transformers';

class LocalLLM {
  constructor() {
    this.generator = null;
    this.ready = false;
  }

  async load(modelName = 'Xenova/Qwen1.5-0.5B-Chat') {
    // 进度回调
    const progressCallback = (info) => {
      if (info.status === 'downloading') {
        const percent = Math.round((info.loaded / info.total) * 100);
        console.log(`下载中: ${info.file} — ${percent}%`);
        // 可在此更新 UI 进度条
      }
    };

    this.generator = await pipeline(
      'text-generation',
      modelName,
      {
        device: 'webgpu',
        dtype: 'q4',        // INT4 量化，内存最小
        // dtype: 'q8',     // INT8 量化，质量更高
        // dtype: 'fp16',   // 半精度，VRAM 充足时使用
        progress_callback,
      }
    );

    this.ready = true;
    console.log('模型加载完成');
  }

  async generate(prompt, options = {}) {
    if (!this.ready) throw new Error('模型未加载');

    const {
      max_new_tokens = 256,
      temperature = 0.7,
      top_p = 0.9,
      do_sample = true,
      repeat_penalty = 1.1,
    } = options;

    const output = await this.generator(prompt, {
      max_new_tokens,
      temperature,
      top_p,
      do_sample,
      repeat_penalty,
    });

    return output[0].generated_text;
  }

  // 流式生成（打字机效果）
  async *generateStream(prompt, options = {}) {
    if (!this.ready) throw new Error('模型未加载');

    const streamer = new (await import('@huggingface/transformers')).TextStreamer(
      this.generator.tokenizer,
      {
        skip_prompt: true,
        callback_function: (token) => {
          // 每个 token 生成时触发
        },
        timeout: 30000,
      }
    );

    const output = await this.generator(prompt, {
      ...options,
      streamer,
    });

    return output;
  }
}

// 使用
const llm = new LocalLLM();
await llm.load('Xenova/Qwen1.5-0.5B-Instruct');

const response = await llm.generate(
  'Explain WebGPU in one paragraph:',
  { max_new_tokens: 150, temperature: 0.7 }
);
console.log(response);
```

### 4.2 Web Worker 隔离执行（防 UI 阻塞）

```javascript
// inference.worker.ts
import { pipeline, env } from '@huggingface/transformers';
import { TextStreamer } from '@huggingface/transformers';

env.backends.onnx.wasm.proxy = false;

let generator = null;

async function loadModel(modelName) {
  generator = await pipeline('text-generation', modelName, {
    device: 'webgpu',
    dtype: 'q4',
    progress_callback: (info) => {
      self.postMessage({
        type: 'progress',
        status: info.status,
        file: info.file,
        progress: info.total
          ? Math.round((info.loaded / info.total) * 100)
          : null,
      });
    },
  });
  self.postMessage({ type: 'ready' });
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (type === 'load') {
    await loadModel(payload.model);
    return;
  }

  if (type === 'generate') {
    if (!generator) {
      self.postMessage({ type: 'error', message: 'Model not loaded' });
      return;
    }

    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        callback_function: (token) => {
          self.postMessage({ type: 'token', token });
        },
      });

      await generator(payload.prompt, {
        max_new_tokens: payload.max_new_tokens || 256,
        temperature: payload.temperature || 0.7,
        streamer,
      });

      self.postMessage({ type: 'done' });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
  }
};
```

```javascript
// main.ts：UI 层
class LLMChat {
  constructor() {
    this.worker = new Worker(
      new URL('./inference.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = this.handleMessage.bind(this);
  }

  async init(modelName) {
    this.worker.postMessage({ type: 'load', payload: { model: modelName } });
    return new Promise((resolve) => {
      this.onceReady = resolve;
    });
  }

  handleMessage(event) {
    const { type } = event.data;

    switch (type) {
      case 'ready':
        this.onceReady?.();
        break;
      case 'progress':
        this.updateProgress(event.data);
        break;
      case 'token':
        this.appendToken(event.data.token); // 打字机效果
        break;
      case 'done':
        this.onGenerationComplete?.();
        break;
      case 'error':
        this.onError(event.data.message);
        break;
    }
  }

  async generate(prompt, options = {}) {
    this.currentOutput = '';
    this.worker.postMessage({
      type: 'generate',
      payload: { prompt, ...options },
    });
  }
}
```

### 4.3 生产级模型缓存策略

```javascript
// 模型缓存管理：IndexedDB + Cache Storage
class ModelCacheManager {
  constructor() {
    this.dbName = 'transformers-cache';
    this.dbVersion = 1;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
        }
      };
    });
  }

  // 获取缓存的模型信息
  async getCachedModels() {
    const db = await this.openDB();
    const tx = db.transaction('models', 'readonly');
    const store = tx.objectStore('models');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  // 清理过期缓存
  async pruneCache(maxSizeGB = 2) {
    const db = await this.openDB();
    const models = await this.getCachedModels();
    const totalBytes = models.reduce((sum, m) => sum + (m.size || 0), 0);
    const maxBytes = maxSizeGB * 1024 * 1024 * 1024;

    if (totalBytes <= maxBytes) return;

    // 按最后访问时间排序，删除最旧的
    const sorted = models.sort((a, b) => (a.lastAccess || 0) - (b.lastAccess || 0));
    let freed = 0;
    const targetFree = totalBytes - maxBytes;

    for (const model of sorted) {
      if (freed >= targetFree) break;
      // 删除 IndexedDB 记录
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').delete(model.id);
      freed += model.size || 0;
    }
  }

  // 估算缓存大小
  async getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota, percent: ((usage / quota) * 100).toFixed(1) };
    }
    return null;
  }
}
```

## 五、ONNX Runtime Web：底层推理引擎

### 5.1 何时需要直接使用 ONNX

```javascript
// Transformers.js 底层是 ONNX Runtime Web
// 适合需要更精细控制或自定义 ONNX 模型的场景

import * as ort from 'onnxruntime-web/webgpu';

// 创建推理会话
const session = await ort.InferenceSession.create(
  '/models/my-model.onnx', // 本地模型文件
  {
    executionProviders: ['webgpu'],
    graphOptimizationLevel: 'all', // ORT_ENABLE_ALL
  }
);

// 准备输入张量
const inputIds = tokenize('Hello WebGPU');
const inputTensor = new ort.Tensor(
  'int64',
  new BigInt64Array(inputIds.map(BigInt)),
  [1, inputIds.length]
);

// 执行推理
const results = await session.run({
  'input_ids': inputTensor,
});

// results.logits: [batch, seq_len, vocab_size]
```

### 5.2 WebGPU 内存管理

```javascript
// WebGPU 内存压力处理
class WebGPUMemoryManager {
  constructor(device) {
    this.device = device;
    this.buffers = new Set();
    this.textures = new Set();
  }

  createBuffer(descriptor) {
    const buffer = this.device.createBuffer(descriptor);
    this.buffers.add(buffer);
    buffer.addEventListener('cleanup', () => {
      this.buffers.delete(buffer);
    });
    return buffer;
  }

  // 设备丢失时清理
  setupLostHandler() {
    this.device.lost.then((info) => {
      console.warn('WebGPU 设备丢失:', info.message);
      // 清理所有 Buffer
      for (const buffer of this.buffers) {
        buffer.destroy();
      }
      // 重置状态并尝试重新初始化
      this.buffers.clear();
      this.textures.clear();
    });
  }

  // 检测内存压力
  async checkMemoryPressure() {
    if (navigator.gpu) {
      // 尝试分配测试 Buffer 检测是否 OOM
      try {
        const testBuffer = this.device.createBuffer({
          size: 1024 * 1024 * 100, // 100MB
          usage: GPUBufferUsage.STORAGE,
        });
        testBuffer.destroy();
        return { pressure: 'normal' };
      } catch {
        return { pressure: 'high', recommendation: '降低 dtype 或切换到 WASM 后端' };
      }
    }
    return { pressure: 'unknown' };
  }
}
```

## 六、隐私优先实战案例

### 6.1 医疗文档本地 NER 脱敏

```javascript
// 场景：用户上传医疗记录，系统在本地检测并脱敏 PII
// 数据完全留在浏览器中，满足 HIPAA 合规要求

class MedicalDocProcessor {
  constructor() {
    this.nerPipeline = null;
  }

  async init() {
    // 使用专门的医疗 NER 模型
    this.nerPipeline = await pipeline('token-classification', 'd4data/biomedner-bert-base', {
      device: 'webgpu',
      dtype: 'fp16',
    });
  }

  async processDocument(text) {
    const entities = await this.nerPipeline(text);

    const redactionMap = {
      'B-PERSON': '***',
      'I-PERSON': '',
      'B-EMAIL': '[EMAIL]',
      'I-EMAIL': '',
      'B-PHONE': '[PHONE]',
      'I-PHONE': '',
      'B-DATE': '[DATE]',
      'I-DATE': '',
      'B-MEDICAL_RECORD': '[MRN]',
      'I-MEDICAL_RECORD': '',
      'B-SSN': '[SSN]',
      'I-SSN': '',
    };

    // 从后向前替换，保持索引正确
    const sorted = [...entities].sort((a, b) => b.index - a.index);
    let result = text;

    for (const entity of sorted) {
      if (redactionMap[entity.entity]) {
        result = result.substring(0, entity.start) +
          redactionMap[entity.entity] +
          result.substring(entity.end);
      }
    }

    return {
      original: text,
      redacted: result,
      entities: entities.filter((e) => e.entity.startsWith('B-')),
      // 隐私日志：仅记录实体类型，不记录具体内容
      auditLog: {
        timestamp: new Date().toISOString(),
        entityCounts: this.countByType(entities),
        processedLocally: true,
      },
    };
  }

  countByType(entities) {
    return entities
      .filter((e) => e.entity.startsWith('B-'))
      .reduce((acc, e) => {
        const type = e.entity.replace('B-', '');
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
  }
}
```

### 6.2 本地 RAG 知识库

```javascript
// 场景：私密笔记应用，在本地完成 Embedding + 检索
// 用户的笔记数据永不离开设备

class LocalRAG {
  constructor() {
    this.embedder = null;
    this.chunks = [];      // 原始文本块
    this.vectors = null;  // 对应向量
  }

  async init() {
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device: 'webgpu',
      dtype: 'fp16',
    });
  }

  // 添加文档到本地知识库
  async addDocument(text, metadata = {}) {
    // 分块（简单策略，实际可用更复杂的切分）
    const chunks = this.chunkText(text, 512);

    // 批量生成 Embedding
    const embeddings = await this.embedder(chunks, {
      pooling: 'mean',
      normalize: true,
    });

    this.chunks.push(
      ...chunks.map((chunk, i) => ({
        text: chunk,
        metadata,
        embedding: embeddings[i],
        addedAt: Date.now(),
      }))
    );
  }

  chunkText(text, maxChars) {
    const sentences = text.split(/[。！？\n]/);
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + sentence).length <= maxChars) {
        current += sentence + '。';
      } else {
        if (current) chunks.push(current.trim());
        current = sentence;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  // 本地语义检索
  async retrieve(query, topK = 3) {
    const queryEmbedding = await this.embedder(query, {
      pooling: 'mean',
      normalize: true,
    });

    // 暴力搜索（数据量小足够用）
    // 数据量大时可用 FAISS.js 或 hnswlib-js
    const scores = this.chunks.map((chunk) => ({
      chunk,
      score: this.cosine(queryEmbedding, chunk.embedding),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  cosine(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }
}
```

## 七、渐进增强与优雅降级

### 7.1 完整的后端选择策略

```javascript
// 完整后端选择：从最优到最差，自动适配
async function selectBackend() {
  // Level 1: WebGPU（最快）
  if (navigator.gpu) {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (adapter) {
      console.log('后端：WebGPU（独立显卡）');
      return 'webgpu';
    }
  }

  // Level 2: WebGPU（集成显卡）
  if (navigator.gpu) {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'low-power',
    });
    if (adapter) {
      console.log('后端：WebGPU（集成显卡）');
      return 'webgpu';
    }
  }

  // Level 3: WebAssembly SIMD（CPU 并行）
  if (typeof WebAssembly !== 'undefined') {
    const simdCheck = WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2,
        1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ])
    );
    if (simdCheck) {
      console.log('后端：WASM SIMD（CPU 多线程）');
      return 'wasm';
    }
  }

  // Level 4: WebAssembly 普通（单线程 CPU）
  console.log('后端：WASM 普通（CPU 单线程）');
  return 'wasm';
}
```

### 7.2 React Hook 封装

```javascript
// useLocalAI.ts：React 中的端侧 AI Hook
import { useState, useEffect, useRef, useCallback } from 'react';
import { pipeline, env } from '@huggingface/transformers';

export function useLocalAI(model, task, options = {}) {
  const [classifier, setClassifier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backend, setBackend] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const backendChoice = await selectBackend();
        if (!mounted) return;

        setBackend(backendChoice);

        const instance = await pipeline(task, model, {
          device: backendChoice === 'webgpu' ? 'webgpu' : 'wasm',
          dtype: options.dtype || 'q4',
          progress_callback: (info) => {
            if (info.status === 'downloading' && mounted) {
              // 可在此更新进度
            }
          },
        });

        if (mounted) {
          setClassifier(instance);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [model, task]);

  const run = useCallback(
    async (...args) => {
      if (!classifier) throw new Error('Classifier not loaded');
      return classifier(...args);
    },
    [classifier]
  );

  return { classifier, loading, error, backend, run };
}

// 使用
function SentimentAnalyzer() {
  const { loading, error, run } = useLocalAI(
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    'sentiment-analysis'
  );

  const [result, setResult] = useState(null);

  async function analyze(text) {
    const r = await run(text);
    setResult(r);
  }

  if (loading) return <div>加载模型中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      <button onClick={() => analyze('Amazing article!')}>分析</button>
      {result && <div>{result[0].label} ({result[0].score})</div>}
    </div>
  );
}
```

## 八、模型选择与生产清单

### 8.1 适合浏览器的模型规格

| 模型类型 | 推荐模型 | 参数量 | 量化 dtype | 浏览器内存 | 适用场景 |
|---------|---------|-------|-----------|-----------|---------|
| 情感分析 | DistilBERT-SST2 | 66M | fp16 | ~130MB | 快速分类 |
| Embedding | all-MiniLM-L6-v2 | 22M | fp16 | ~90MB | 语义检索 |
| 图像分类 | MobileNetV2 | 3.5M | fp32 | ~14MB | 移动端友好 |
| 文本生成 | Qwen1.5-0.5B | 500M | q4 | ~350MB | 聊天/摘要 |
| 文本生成 | Qwen2-1.5B | 1.5B | q4 | ~1GB | 高质量生成 |
| 翻译 | NLLB-200 | 600M | q8 | ~700MB | 多语言翻译 |

### 8.2 生产环境检查清单

```javascript
// 完整的生产检查清单
const PRODUCTION_CHECKLIST = {
  // 功能性
  webgpuSupport: !!navigator.gpu,
  modelLoading: false,           // 模型能正常加载
  inferenceWorks: false,         // 推理结果正确
  streamWorks: true,             // 流式输出正常
  workerIsolation: true,         // Worker 隔离正常
  memoryStable: true,            // 长时间运行无内存泄漏

  // 性能
  coldStartTime: 0,              // 首次加载时间（ms）
  tokenThroughput: 0,            // tokens/秒
  uiNoBlocking: true,             // UI 线程无阻塞

  // 降级
  wasmFallback: false,            // WASM 回退可用
  errorRecovery: true,            // 错误恢复机制

  // 隐私
  noTelemetry: true,              // 无第三方上报
  sameOriginPolicy: true,         // 同源策略
  dataInMemoryOnly: true,         // 数据仅存内存
};

// 每个指标都应监控和记录
async function runProductionChecks() {
  const results = { ...PRODUCTION_CHECKLIST };

  // 检测 WebGPU
  const support = await WebGPUManager.checkSupport();
  results.webgpuSupport = support.supported;

  // 计时冷启动
  const t0 = performance.now();
  const model = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Instruct', {
    device: 'webgpu',
    dtype: 'q4',
  });
  results.coldStartTime = performance.now() - t0;
  results.modelLoading = true;

  // 推理测试
  const testResult = await model('Hello', { max_new_tokens: 10 });
  results.inferenceWorks = testResult?.[0]?.generated_text?.length > 0;

  console.table(results);
}
```

## 总结

2026 年的浏览器已经成为真正的 AI 运行平台：

- **WebGPU**（Baseline 2026）提供了原生 GPU Compute 能力，矩阵乘法性能比 WebGL 快 5-10 倍，比纯 CPU 快 100 倍
- **Transformers.js**（Hugging Face）将 Python 机器学习生态完整移植到 JavaScript，pipeline API 3 行代码即可跑起 SOTA 模型
- **ONNX Runtime Web** 是底层引擎，WebGPU / WASM 双后端自动适配，设备不行就回退 CPU
- **端侧推理**的核心价值：隐私（数据永不离开设备）、成本（零 API 费用）、延迟（无网络往返）、离线（模型缓存后完全本地）
- **适合场景**：隐私敏感的文本处理、本地知识库 RAG、隐私优先的内容审核、低延迟的实时交互
- **不适合场景**：需要 GPT-4 级别推理能力、目标用户设备老旧（无 GPU）、模型体积超过设备 VRAM

从今天起，重新思考你的 AI 功能架构：有多少可以真正搬到浏览器里？

---

*本文由小虾子 🦐 撰写*
