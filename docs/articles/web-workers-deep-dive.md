# Web Workers 深度解析：解锁前端多线程能力

> 当你在页面中处理大量数据计算时，页面卡死了吗？当用户看到"页面无响应"提示时，你知道问题出在哪吗？答案就在 JavaScript 的单线程模型。而 Web Workers，就是打破这个限制的钥匙。

## 一、为什么需要 Web Workers？

### 1.1 JavaScript 的单线程困境

JavaScript 从诞生之初就是单线程语言。这个设计源于它的主要用途：处理用户交互和 DOM 操作。单线程意味着：

```javascript
// ❌ 这段代码会阻塞主线程
function heavyComputation() {
  let result = 0
  for (let i = 0; i < 10000000000; i++) {
    result += Math.sqrt(i) * Math.sin(i)
  }
  return result
}

// 调用期间，页面完全冻结
// - 用户无法点击按钮
// - 动画停止
// - 滚动无响应
// - 浏览器可能弹出"页面无响应"警告
const result = heavyComputation()
```

**主线程的职责清单**：
- 执行 JavaScript 代码
- 处理用户交互（点击、输入、滚动）
- 渲染页面（样式计算、布局、绘制）
- 处理网络请求回调
- 执行定时器回调

当计算任务占用主线程时，所有这些都会被阻塞。

### 1.2 Web Workers 的解决方案

Web Workers 让 JavaScript 真正拥有了多线程能力：

```
┌─────────────────────────────────────────────────────┐
│                    浏览器进程                        │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐              │
│  │   主线程      │    │  Worker 线程 │              │
│  │              │    │              │              │
│  │ - DOM 操作   │◄──►│ - 纯计算     │              │
│  │ - 用户交互   │    │ - 数据处理   │              │
│  │ - 页面渲染   │    │ - 算法执行   │              │
│  │              │    │              │              │
│  └──────────────┘    └──────────────┘              │
│         ▲                    ▲                      │
│         │    postMessage     │                      │
│         └────────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

**核心特点**：
- **独立线程**：Worker 在独立线程中运行，不阻塞主线程
- **无法操作 DOM**：没有 `document`、`window` 对象，避免并发问题
- **通信机制**：通过 `postMessage` 和 `onmessage` 与主线程通信
- **独立作用域**：有自己的全局对象 `self`（等同于 `DedicatedWorkerGlobalScope`）

## 二、Web Workers 基础实战

### 2.1 创建第一个 Worker

**主线程代码**：

```javascript
// main.js
const worker = new Worker('worker.js')

// 发送数据给 Worker
worker.postMessage({
  type: 'calculate',
  data: { numbers: [1, 2, 3, 4, 5] }
})

// 接收 Worker 返回的结果
worker.onmessage = function(e) {
  console.log('Worker 返回结果:', e.data)
  // { type: 'result', sum: 15, avg: 3 }
}

// 处理错误
worker.onerror = function(error) {
  console.error('Worker 错误:', error.message)
}

// 终止 Worker（不再需要时）
// worker.terminate()
```

**Worker 线程代码**：

```javascript
// worker.js
self.onmessage = function(e) {
  const { type, data } = e.message
  
  if (type === 'calculate') {
    const { numbers } = data
    const sum = numbers.reduce((a, b) => a + b, 0)
    const avg = sum / numbers.length
    
    // 发送结果回主线程
    self.postMessage({
      type: 'result',
      sum,
      avg
    })
  }
}
```

### 2.2 使用 Blob URL 创建内联 Worker

实际开发中，单独的 worker 文件可能不方便。可以用 Blob URL 创建内联 Worker：

```javascript
// 内联 Worker 创建函数
function createInlineWorker(workerFunction) {
  const blob = new Blob([`(${workerFunction.toString()})()`], {
    type: 'application/javascript'
  })
  const url = URL.createObjectURL(blob)
  const worker = new Worker(url)
  
  // 清理 URL（Worker 仍然可用）
  // URL.revokeObjectURL(url)
  
  return worker
}

// 使用示例
const worker = createInlineWorker(() => {
  self.onmessage = function(e) {
    const result = e.data.map(x => x * x)
    self.postMessage(result)
  }
})

worker.postMessage([1, 2, 3, 4, 5])
worker.onmessage = e => console.log(e.data) // [1, 4, 9, 16, 25]
```

### 2.3 使用 Transferable Objects 优化传输

当传输大量数据时，使用 **Transferable Objects** 可以实现零拷贝传输：

```javascript
// 主线程
const largeArray = new Float64Array(10000000)
for (let i = 0; i < largeArray.length; i++) {
  largeArray[i] = Math.random()
}

const worker = new Worker('worker.js')

// ❌ 普通传输：数据会被序列化/反序列化（耗时）
// worker.postMessage(largeArray)

// ✅ Transferable 传输：所有权转移，零拷贝
worker.postMessage(largeArray, [largeArray.buffer])

// 注意：传输后，largeArray 在主线程中变为空！
console.log(largeArray.length) // 0
```

```javascript
// worker.js
self.onmessage = function(e) {
  const array = e.data
  // 处理数据...
  const sum = array.reduce((a, b) => a + b, 0)
  self.postMessage(sum)
}
```

**支持 Transferable 的类型**：
- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `ReadableStream`
- `WritableStream`
- `TransformStream`

## 三、实战场景与最佳实践

### 3.1 大数据排序

```javascript
// main.js - 主线程
const sortWorker = new Worker('sort-worker.js')

function parallelSort(array) {
  return new Promise((resolve) => {
    sortWorker.onmessage = (e) => resolve(e.data)
    sortWorker.postMessage(array, [array.buffer])
  })
}

// 使用
const largeArray = new Float64Array(1000000)
// ...填充数据
const sorted = await parallelSort(largeArray)
```

```javascript
// sort-worker.js
self.onmessage = function(e) {
  const array = e.data
  
  // 快速排序实现
  function quickSort(arr, left = 0, right = arr.length - 1) {
    if (left >= right) return
    
    const pivot = arr[Math.floor((left + right) / 2)]
    let i = left, j = right
    
    while (i <= j) {
      while (arr[i] < pivot) i++
      while (arr[j] > pivot) j--
      if (i <= j) {
        [arr[i], arr[j]] = [arr[j], arr[i]]
        i++
        j--
      }
    }
    
    quickSort(arr, left, j)
    quickSort(arr, i, right)
  }
  
  quickSort(array)
  self.postMessage(array, [array.buffer])
}
```

### 3.2 图像处理

```javascript
// main.js
const imageWorker = new Worker('image-worker.js')

async function processImage(imageBitmap, filter) {
  return new Promise((resolve) => {
    imageWorker.onmessage = (e) => resolve(e.data)
    imageWorker.postMessage(
      { image: imageBitmap, filter },
      [imageBitmap] // Transferable
    )
  })
}

// 使用
const img = document.querySelector('img')
const bitmap = await createImageBitmap(img)
const processed = await processImage(bitmap, 'grayscale')
document.querySelector('canvas').getContext('2d').drawImage(processed, 0, 0)
```

```javascript
// image-worker.js
self.onmessage = function(e) {
  const { image, filter } = e.data
  
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data
  
  if (filter === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = data[i + 1] = data[i + 2] = avg
    }
  } else if (filter === 'invert') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  // 返回处理后的 ImageBitmap
  canvas.convertToBlob().then(blob => {
    createImageBitmap(blob).then(bitmap => {
      self.postMessage(bitmap, [bitmap])
    })
  })
}
```

### 3.3 JSON 解析优化

大 JSON 文件解析会阻塞主线程：

```javascript
// json-worker.js
self.onmessage = function(e) {
  const jsonString = e.data
  try {
    const data = JSON.parse(jsonString)
    self.postMessage({ success: true, data })
  } catch (error) {
    self.postMessage({ success: false, error: error.message })
  }
}
```

```javascript
// main.js
async function parseJSONInWorker(jsonString) {
  const worker = new Worker('json-worker.js')
  
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.success) {
        resolve(e.data.data)
      } else {
        reject(new Error(e.data.error))
      }
    }
    worker.postMessage(jsonString)
  })
}

// 使用
const response = await fetch('/api/large-data')
const jsonString = await response.text()
const data = await parseJSONInWorker(jsonString)
```

### 3.4 Worker 池（Pool）

对于大量独立任务，使用 Worker 池提高效率：

```javascript
class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = []
    this.taskQueue = []
    this.availableWorkers = []
    
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript)
      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }
  
  execute(data, transferList) {
    return new Promise((resolve, reject) => {
      const task = { data, transferList, resolve, reject }
      
      if (this.availableWorkers.length > 0) {
        this.runTask(task)
      } else {
        this.taskQueue.push(task)
      }
    })
  }
  
  runTask(task) {
    const worker = this.availableWorkers.pop()
    
    const handler = (e) => {
      worker.removeEventListener('message', handler)
      this.availableWorkers.push(worker)
      task.resolve(e.data)
      
      if (this.taskQueue.length > 0) {
        this.runTask(this.taskQueue.shift())
      }
    }
    
    worker.addEventListener('message', handler)
    worker.postMessage(task.data, task.transferList)
  }
  
  terminate() {
    this.workers.forEach(w => w.terminate())
  }
}

// 使用示例
const pool = new WorkerPool('compute-worker.js', 8)

const tasks = largeDataArray.map(data => 
  pool.execute(data)
)

const results = await Promise.all(tasks)
pool.terminate()
```

## 四、Worker 类型详解

### 4.1 Dedicated Worker（专用 Worker）

最常用的类型，一对一通信：

```javascript
const worker = new Worker('worker.js')
worker.postMessage('hello')
```

### 4.2 Shared Worker（共享 Worker）

多个页面共享同一个 Worker：

```javascript
// page1.js 和 page2.js 都可以使用
const sharedWorker = new SharedWorker('shared-worker.js')
sharedWorker.port.onmessage = (e) => console.log(e.data)
sharedWorker.port.start()
sharedWorker.port.postMessage('from page 1')
```

```javascript
// shared-worker.js
const connections = []

self.onconnect = function(e) {
  const port = e.ports[0]
  connections.push(port)
  
  port.onmessage = function(e) {
    // 广播给所有连接
    connections.forEach(p => p.postMessage(e.data))
  }
}
```

**使用场景**：
- 多标签页同步状态
- 共享长连接 WebSocket
- 统一管理资源

### 4.3 Service Worker

用于 PWA 和离线缓存，这是另一个话题，但本质上也是 Worker：

```javascript
// 注册 Service Worker
navigator.serviceWorker.register('/sw.js')

// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  )
})
```

## 五、调试与性能监控

### 5.1 Chrome DevTools 调试

Chrome 开发者工具支持 Worker 调试：

1. 打开 DevTools → Sources 面板
2. 在左侧导航中找到 "Workers" 节点
3. 点击 worker 文件可以设置断点
4. Console 中也可以选择 worker 上下文

### 5.2 性能对比

```javascript
// 性能测试函数
async function benchmark(task, data, useWorker = false) {
  const start = performance.now()
  
  if (useWorker) {
    await new Promise(resolve => {
      const worker = new Worker('worker.js')
      worker.onmessage = () => {
        worker.terminate()
        resolve()
      }
      worker.postMessage(data)
    })
  } else {
    task(data)
  }
  
  return performance.now() - start
}

// 对比测试
const data = new Float64Array(10000000)
const mainThreadTime = await benchmark(heavyTask, data, false)
const workerTime = await benchmark(null, data, true)

console.log(`主线程: ${mainThreadTime}ms`)
console.log(`Worker: ${workerTime}ms`)
```

### 5.3 错误处理最佳实践

```javascript
class SafeWorker {
  constructor(scriptURL) {
    this.worker = new Worker(scriptURL)
    this.messageId = 0
    this.pending = new Map()
    
    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data
      const { resolve, reject } = this.pending.get(id)
      this.pending.delete(id)
      
      if (error) {
        reject(new Error(error))
      } else {
        resolve(result)
      }
    }
    
    this.worker.onerror = (e) => {
      console.error('Worker error:', e)
    }
  }
  
  execute(data, transferList) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, data }, transferList)
    })
  }
  
  terminate() {
    this.worker.terminate()
    this.pending.forEach(({ reject }) => {
      reject(new Error('Worker terminated'))
    })
    this.pending.clear()
  }
}
```

## 六、兼容性与降级策略

### 6.1 浏览器支持检测

```javascript
function checkWorkerSupport() {
  return {
    basic: typeof Worker !== 'undefined',
    shared: typeof SharedWorker !== 'undefined',
    service: 'serviceWorker' in navigator,
    transferable: typeof ArrayBuffer !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined'
  }
}

const support = checkWorkerSupport()
if (!support.basic) {
  console.warn('Web Workers 不支持，将使用主线程')
}
```

### 6.2 优雅降级

```javascript
class ComputeEngine {
  constructor() {
    this.useWorker = typeof Worker !== 'undefined'
    if (this.useWorker) {
      this.worker = new Worker('compute-worker.js')
    }
  }
  
  async compute(data) {
    if (this.useWorker) {
      return new Promise(resolve => {
        this.worker.onmessage = e => resolve(e.data)
        this.worker.postMessage(data)
      })
    } else {
      // 降级：分片执行避免阻塞
      return this.computeInChunks(data)
    }
  }
  
  async computeInChunks(data, chunkSize = 1000) {
    const results = []
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      results.push(...this.processChunk(chunk))
      // 让出主线程
      await new Promise(r => setTimeout(r, 0))
    }
    return results
  }
}
```

## 七、框架集成

### 7.1 React + Web Worker

```jsx
import { useEffect, useRef, useState } from 'react'

function useWorker(workerScript, initialState) {
  const [result, setResult] = useState(initialState)
  const [error, setError] = useState(null)
  const workerRef = useRef(null)
  
  useEffect(() => {
    workerRef.current = new Worker(workerScript)
    
    workerRef.current.onmessage = (e) => {
      setResult(e.data)
    }
    
    workerRef.current.onerror = (e) => {
      setError(e.message)
    }
    
    return () => workerRef.current?.terminate()
  }, [workerScript])
  
  const postMessage = (data, transferList) => {
    workerRef.current?.postMessage(data, transferList)
  }
  
  return { result, error, postMessage }
}

// 使用
function DataProcessor() {
  const { result, postMessage } = useWorker('/workers/data-processor.js', null)
  
  const handleProcess = (data) => {
    postMessage(data)
  }
  
  return (
    <div>
      <button onClick={() => handleProcess(largeData)}>处理数据</button>
      {result && <div>结果: {result}</div>}
    </div>
  )
}
```

### 7.2 Vue 3 + Web Worker

```javascript
// composables/useWorker.js
import { ref, onUnmounted } from 'vue'

export function useWorker(workerScript) {
  const result = ref(null)
  const error = ref(null)
  const isWorking = ref(false)
  
  const worker = new Worker(workerScript)
  
  worker.onmessage = (e) => {
    result.value = e.data
    isWorking.value = false
  }
  
  worker.onerror = (e) => {
    error.value = e.message
    isWorking.value = false
  }
  
  const postMessage = (data, transferList) => {
    isWorking.value = true
    worker.postMessage(data, transferList)
  }
  
  onUnmounted(() => {
    worker.terminate()
  })
  
  return { result, error, isWorking, postMessage }
}
```

```vue
<template>
  <div>
    <button @click="processData" :disabled="isWorking">
      {{ isWorking ? '处理中...' : '开始处理' }}
    </button>
    <div v-if="result">结果: {{ result }}</div>
  </div>
</template>

<script setup>
import { useWorker } from '@/composables/useWorker'

const { result, isWorking, postMessage } = useWorker('/workers/compute.js')

const processData = () => {
  postMessage(largeDataSet)
}
</script>
```

## 八、性能优化建议

### 8.1 何时使用 Worker

**适合场景**：
- 大数据排序/过滤（> 1000 条）
- 复杂数学计算（加密、压缩、图像处理）
- 大 JSON 解析（> 1MB）
- 实时数据处理（音视频编解码）
- 长时间运行的算法

**不适合场景**：
- 简单计算（创建 Worker 有开销）
- 频繁的小任务（通信开销大）
- 需要 DOM 操作的任务

### 8.2 通信优化

```javascript
// ❌ 频繁发送小数据
for (let i = 0; i < 10000; i++) {
  worker.postMessage({ index: i, value: data[i] })
}

// ✅ 批量发送
const batchSize = 1000
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize)
  worker.postMessage({ startIndex: i, batch })
}
```

### 8.3 内存管理

```javascript
// Worker 中避免内存泄漏
self.onmessage = function(e) {
  const result = process(e.data)
  self.postMessage(result)
  
  // 清理大对象
  e.data = null
}

// 主线程及时终止不用的 Worker
function processOnce(data) {
  const worker = new Worker('worker.js')
  return new Promise(resolve => {
    worker.onmessage = (e) => {
      worker.terminate() // 用完即销毁
      resolve(e.data)
    }
    worker.postMessage(data)
  })
}
```

## 总结

Web Workers 是前端性能优化的重要工具，掌握它能让你：

1. **解决主线程阻塞**：将耗时计算移出主线程
2. **提升用户体验**：保持页面流畅响应
3. **充分利用多核**：现代 CPU 都是多核，单线程浪费了性能
4. **处理大数据**：前端也能处理以前需要后端处理的任务

**记住关键点**：
- Worker 无法操作 DOM，但可以通过 postMessage 通知主线程操作
- 使用 Transferable Objects 优化大数据传输
- 合理使用 Worker 池处理大量任务
- 注意兼容性，做好降级方案
- 及时终止不用的 Worker，避免内存泄漏

---

*本文由小虾子 🦐 撰写*
