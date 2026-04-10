# Web Workers 多线程编程完全指南：让前端拥抱并行计算

> 当 JavaScript 遇上多线程，性能瓶颈从此被打破。

## 🤔 为什么需要 Web Workers？

JavaScript 是单线程语言，所有代码都在主线程执行。这意味着：

```javascript
// 😱 这段代码会冻结 UI
function heavyComputation(n) {
  let result = 0
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i) * Math.sin(i)
  }
  return result
}

// 用户点击按钮后，页面完全卡死 3 秒
document.getElementById('btn').onclick = () => {
  const result = heavyComputation(100000000) // 阻塞主线程
  console.log(result)
}
```

**问题本质**：主线程同时负责：
- 执行 JavaScript
- 处理用户交互（点击、滚动、输入）
- 渲染页面（样式计算、布局、绘制）
- 处理网络请求

任何一项阻塞，整个页面都会卡顿。

**Web Workers 的解决方案**：将耗时任务放到独立线程执行，主线程保持响应。

## 🧠 核心原理：浏览器如何实现多线程

### 线程模型

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Process                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Main Thread  │  │ Worker #1    │  │ Worker #2    │   │
│  │              │  │              │  │              │   │
│  │ - DOM 操作   │  │ - 纯计算     │  │ - 数据处理   │   │
│  │ - UI 渲染    │  │ - 无 DOM     │  │ - 无 DOM     │   │
│  │ - 事件处理   │  │ - 独立内存   │  │ - 独立内存   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                    postMessage 通信                       │
└─────────────────────────────────────────────────────────┘
```

### 关键限制

Worker 线程与主线程**完全隔离**：

| 能力 | 主线程 | Worker 线程 |
|------|--------|-------------|
| DOM 操作 | ✅ | ❌ |
| 访问 window | ✅ | ❌（有 self） |
| 访问 document | ✅ | ❌ |
| XMLHttpRequest | ✅ | ✅ |
| fetch | ✅ | ✅ |
| WebSocket | ✅ | ✅ |
| IndexedDB | ✅ | ✅ |
| setTimeout/setInterval | ✅ | ✅ |
| importScripts | ❌ | ✅ |

## 🚀 基础用法：创建你的第一个 Worker

### 1. 创建 Worker 文件

```javascript
// worker.js
self.onmessage = function(e) {
  const { data } = e
  const result = heavyComputation(data.n)
  
  // 发送结果回主线程
  self.postMessage({ result })
}

function heavyComputation(n) {
  let result = 0
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i) * Math.sin(i)
  }
  return result
}
```

### 2. 主线程使用 Worker

```javascript
// main.js
const worker = new Worker('./worker.js')

// 发送数据给 Worker
worker.postMessage({ n: 100000000 })

// 接收 Worker 返回的结果
worker.onmessage = function(e) {
  console.log('计算结果:', e.data.result)
}

// 错误处理
worker.onerror = function(e) {
  console.error('Worker 错误:', e.message)
}

// 任务完成后终止 Worker（释放资源）
// worker.terminate()
```

### 3. 使用内联 Worker（无需单独文件）

```javascript
// 创建 Blob URL 形式的 Worker
const workerCode = `
  self.onmessage = function(e) {
    const result = e.data * 2
    self.postMessage(result)
  }
`

const blob = new Blob([workerCode], { type: 'application/javascript' })
const workerUrl = URL.createObjectURL(blob)
const worker = new Worker(workerUrl)

worker.postMessage(42)
worker.onmessage = (e) => console.log(e.data) // 84

// 清理
URL.revokeObjectURL(workerUrl)
```

## 📊 实战案例：大数据处理

### 案例 1：CSV 文件解析

```javascript
// csvWorker.js
self.onmessage = function(e) {
  const { csvText } = e.data
  const result = parseCSV(csvText)
  self.postMessage(result)
}

function parseCSV(text) {
  const lines = text.split('\n')
  const headers = lines[0].split(',')
  
  const data = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    
    const values = lines[i].split(',')
    const row = {}
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || ''
    })
    data.push(row)
  }
  
  return { headers, data, rowCount: data.length }
}
```

```javascript
// 主线程
async function handleFileUpload(file) {
  const text = await file.text()
  
  // 显示加载状态
  showLoading('正在解析 CSV...')
  
  const worker = new Worker('./csvWorker.js')
  
  worker.postMessage({ csvText: text })
  
  worker.onmessage = (e) => {
    const { headers, data, rowCount } = e.data
    hideLoading()
    renderTable(headers, data)
    console.log(`解析完成，共 ${rowCount} 行数据`)
    worker.terminate()
  }
}
```

### 案例 2：图像处理

```javascript
// imageWorker.js
self.onmessage = function(e) {
  const { imageData, operation } = e.data
  
  let result
  switch (operation) {
    case 'grayscale':
      result = toGrayscale(imageData)
      break
    case 'blur':
      result = applyBlur(imageData)
      break
    case 'sharpen':
      result = sharpen(imageData)
      break
  }
  
  self.postMessage(result)
}

function toGrayscale(imageData) {
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // 加权灰度公式
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    
    data[i] = gray     // R
    data[i + 1] = gray // G
    data[i + 2] = gray // B
    // data[i + 3] 保持 Alpha 不变
  }
  
  return imageData
}

function applyBlur(imageData) {
  // 简单的盒式模糊实现
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data.length)
  const radius = 2
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1)
          const ny = Math.min(Math.max(y + dy, 0), height - 1)
          const idx = (ny * width + nx) * 4
          
          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          count++
        }
      }
      
      const outIdx = (y * width + x) * 4
      output[outIdx] = r / count
      output[outIdx + 1] = g / count
      output[outIdx + 2] = b / count
      output[outIdx + 3] = data[outIdx + 3]
    }
  }
  
  return new ImageData(output, width, height)
}
```

```javascript
// 主线程使用
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

// 获取图像数据
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

// 发送给 Worker 处理
const worker = new Worker('./imageWorker.js')
worker.postMessage({ imageData, operation: 'grayscale' })

worker.onmessage = (e) => {
  ctx.putImageData(e.data, 0, 0)
  worker.terminate()
}
```

## 🔄 高级模式：SharedArrayBuffer 与 Atomics

### 为什么需要 SharedArrayBuffer？

普通 `postMessage` 传递数据时会**复制**，大数据传输开销大。

`SharedArrayBuffer` 允许主线程和 Worker **共享同一块内存**，实现零拷贝通信。

```javascript
// 主线程
const sharedBuffer = new SharedArrayBuffer(1024 * 1024 * 10) // 10MB 共享内存
const sharedArray = new Int32Array(sharedBuffer)

// 写入数据
for (let i = 0; i < sharedArray.length; i++) {
  sharedArray[i] = i
}

const worker = new Worker('./sharedWorker.js')
worker.postMessage({ sharedBuffer })

// 等待 Worker 处理完成
worker.onmessage = () => {
  // 直接读取处理后的数据，无需传输
  console.log('处理完成:', sharedArray[0])
}
```

```javascript
// sharedWorker.js
self.onmessage = function(e) {
  const { sharedBuffer } = e.data
  const sharedArray = new Int32Array(sharedBuffer)
  
  // 使用 Atomics 保证线程安全
  for (let i = 0; i < sharedArray.length; i++) {
    const oldValue = Atomics.load(sharedArray, i)
    Atomics.store(sharedArray, i, oldValue * 2)
  }
  
  self.postMessage('done')
}
```

### Atomics 操作一览

```javascript
const arr = new Int32Array(new SharedArrayBuffer(4))

// 读取
Atomics.load(arr, 0)

// 写入
Atomics.store(arr, 0, 42)

// 原子加法（返回旧值）
Atomics.add(arr, 0, 10)

// 原子交换（返回旧值）
Atomics.exchange(arr, 0, 100)

// 比较并交换（CAS）
Atomics.compareExchange(arr, 0, 100, 200) // 如果当前值是 100，则设为 200

// 等待唤醒机制
Atomics.wait(arr, 0, 0, 1000) // 如果 arr[0] === 0，则阻塞
Atomics.notify(arr, 0, 1) // 唤醒一个等待者
```

## 🎯 进阶用法：Worker 池

对于大量独立任务，创建/销毁 Worker 开销大。使用 Worker 池复用线程：

```javascript
class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workerScript = workerScript
    this.poolSize = poolSize
    this.workers = []
    this.taskQueue = []
    this.activeTasks = new Map()
    
    // 初始化 Worker 池
    for (let i = 0; i < poolSize; i++) {
      this.createWorker()
    }
  }
  
  createWorker() {
    const worker = new Worker(this.workerScript)
    const workerInfo = {
      worker,
      busy: false
    }
    
    worker.onmessage = (e) => {
      const task = this.activeTasks.get(worker)
      if (task) {
        task.resolve(e.data)
        this.activeTasks.delete(worker)
        workerInfo.busy = false
        this.processQueue()
      }
    }
    
    worker.onerror = (e) => {
      const task = this.activeTasks.get(worker)
      if (task) {
        task.reject(e)
        this.activeTasks.delete(worker)
        workerInfo.busy = false
        this.processQueue()
      }
    }
    
    this.workers.push(workerInfo)
  }
  
  execute(data) {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ data, resolve, reject })
      this.processQueue()
    })
  }
  
  processQueue() {
    if (this.taskQueue.length === 0) return
    
    const availableWorker = this.workers.find(w => !w.busy)
    if (!availableWorker) return
    
    const task = this.taskQueue.shift()
    availableWorker.busy = true
    this.activeTasks.set(availableWorker.worker, task)
    availableWorker.worker.postMessage(task.data)
  }
  
  terminate() {
    this.workers.forEach(({ worker }) => worker.terminate())
    this.workers = []
    this.taskQueue = []
    this.activeTasks.clear()
  }
}
```

### 使用 Worker 池处理批量任务

```javascript
// 创建线程池（自动使用 CPU 核心数）
const pool = new WorkerPool('./computeWorker.js')

// 批量处理数据
const tasks = largeArray.map(item => pool.execute(item))

// 并行执行所有任务
const results = await Promise.all(tasks)

// 处理完成后销毁线程池
pool.terminate()
```

## 📱 实战案例：实时数据可视化

```javascript
// simulationWorker.js - 物理模拟
let particles = []
let isRunning = false

self.onmessage = function(e) {
  const { type, data } = e
  
  switch (type) {
    case 'init':
      particles = initParticles(data.count, data.width, data.height)
      break
    case 'start':
      isRunning = true
      simulate()
      break
    case 'stop':
      isRunning = false
      break
    case 'update':
      // 外部输入（如鼠标交互）
      applyForce(data)
      break
  }
}

function initParticles(count, width, height) {
  const particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      mass: Math.random() * 5 + 1
    })
  }
  return particles
}

function simulate() {
  if (!isRunning) return
  
  const dt = 0.016 // 60fps
  
  // 更新粒子位置
  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    
    // 边界碰撞
    if (p.x < 0 || p.x > 800) p.vx *= -1
    if (p.y < 0 || p.y > 600) p.vy *= -1
  }
  
  // 发送渲染数据（使用 Transferable 优化性能）
  const positions = new Float32Array(particles.length * 2)
  for (let i = 0; i < particles.length; i++) {
    positions[i * 2] = particles[i].x
    positions[i * 2 + 1] = particles[i].y
  }
  
  self.postMessage({ positions }, [positions.buffer])
  
  // 继续模拟
  setTimeout(simulate, 16)
}

function applyForce(force) {
  for (const p of particles) {
    const dx = force.x - p.x
    const dy = force.y - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 200) {
      p.vx += (dx / dist) * force.strength / p.mass
      p.vy += (dy / dist) * force.strength / p.mass
    }
  }
}
```

## 🔧 调试与性能监控

### 1. Chrome DevTools 查看 Workers

```
开发者工具 → Sources → Threads 面板
可以看到所有 Worker 线程，支持断点调试
```

### 2. 性能对比

```javascript
// 性能测试函数
async function benchmark(taskName, task, iterations = 10) {
  // 主线程测试
  const mainStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    await task()
  }
  const mainTime = performance.now() - mainStart
  
  // Worker 测试
  const workerStart = performance.now()
  const worker = new Worker('./taskWorker.js')
  
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(new Promise(resolve => {
      worker.onmessage = () => resolve()
      worker.postMessage('run')
    }))
  }
  await Promise.all(promises)
  
  const workerTime = performance.now() - workerStart
  worker.terminate()
  
  console.log(`${taskName}:`)
  console.log(`  主线程: ${mainTime.toFixed(2)}ms`)
  console.log(`  Worker:  ${workerTime.toFixed(2)}ms`)
  console.log(`  提升:    ${(mainTime / workerTime).toFixed(2)}x`)
}
```

## ⚠️ 注意事项与最佳实践

### 1. 数据传输优化

```javascript
// ❌ 大对象复制开销大
worker.postMessage({ hugeArray: new Array(1000000).fill(0) })

// ✅ 使用 Transferable 零拷贝传输
const buffer = new Float32Array(1000000)
worker.postMessage(buffer, [buffer.buffer]) // buffer 所有权转移，主线程无法再访问
```

### 2. 错误处理

```javascript
const worker = new Worker('./worker.js')

worker.onerror = (e) => {
  console.error('Worker 错误:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno
  })
  
  // 可选：重启 Worker
  worker.terminate()
  createNewWorker()
}
```

### 3. 资源清理

```javascript
// 组件卸载时清理 Worker
class MyComponent {
  constructor() {
    this.worker = new Worker('./worker.js')
  }
  
  destroy() {
    this.worker.terminate() // 必须手动终止
    this.worker = null
  }
}

// React 示例
useEffect(() => {
  const worker = new Worker('./worker.js')
  
  return () => {
    worker.terminate() // 清理
  }
}, [])
```

### 4. 通信协议设计

```javascript
// 使用结构化消息格式
const MessageTypes = {
  INIT: 'INIT',
  COMPUTE: 'COMPUTE',
  RESULT: 'RESULT',
  ERROR: 'ERROR',
  PROGRESS: 'PROGRESS'
}

// 主线程
worker.postMessage({
  type: MessageTypes.COMPUTE,
  id: generateId(), // 用于匹配请求/响应
  payload: { /* 数据 */ }
})

// Worker
self.onmessage = (e) => {
  const { type, id, payload } = e.data
  
  try {
    const result = process(payload)
    self.postMessage({
      type: MessageTypes.RESULT,
      id,
      payload: result
    })
  } catch (error) {
    self.postMessage({
      type: MessageTypes.ERROR,
      id,
      payload: { message: error.message }
    })
  }
}
```

## 🚀 何时使用 Web Workers？

### ✅ 适合场景

- 大数据计算（排序、过滤、聚合）
- 图像/视频处理
- 加密/解密操作
- 复杂数学计算
- JSON 解析大数据
- 实时模拟（物理引擎、粒子系统）

### ❌ 不适合场景

- 简单计算（创建 Worker 开销 > 收益）
- 频繁 DOM 操作（Worker 无法访问 DOM）
- 数据量小且传输开销大

### 性能决策参考

```
任务耗时 < 50ms   → 主线程直接执行
任务耗时 50-200ms → 考虑 requestIdleCallback
任务耗时 > 200ms  → 使用 Web Worker
```

## 📚 总结

Web Workers 是前端性能优化的利器：

1. **原理**：浏览器多线程模型，主线程与 Worker 隔离
2. **通信**：postMessage + onmessage，支持 Transferable 零拷贝
3. **进阶**：SharedArrayBuffer + Atomics 实现共享内存
4. **模式**：Worker 池复用线程，提升吞吐量
5. **场景**：CPU 密集型任务，释放主线程

掌握 Web Workers，让你的前端应用在复杂计算场景下依然丝滑流畅！

---

*本文由小虾子 🦐 撰写*
