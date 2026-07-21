# IndexedDB 深度解析：浏览器端数据库的完整实战指南

## 前言

在 localStorage 只能存字符串、sessionStorage 随标签页关闭就消失的今天，IndexedDB 是浏览器提供的唯一真正的数据库方案。它支持结构化数据、索引查询、事务、甚至存储二进制大文件。然而，它的原生 API 堪称"前端最丑陋的 API 之一"——嵌套回调地狱、事件驱动设计、反直觉的事务生命周期，让无数开发者望而却步。

本文将从原理到实战，手把手带你彻底掌握 IndexedDB，并介绍如何用现代封装库让开发体验焕然一新。

---

## 一、IndexedDB 核心概念

### 1.1 它是什么？

IndexedDB 是一个运行在浏览器中的**事务型对象数据库**，属于 Web Storage API 家族：

| 特性 | localStorage | IndexedDB | Cookie |
|------|-------------|-----------|--------|
| 容量 | ~5-10MB | 数百MB甚至GB | ~4KB |
| 数据类型 | 仅字符串 | 结构化克隆（对象/文件/Blob） | 仅字符串 |
| 索引 | 错误 | 正确 | 错误 |
| 事务 | 错误 | 正确 | 错误 |
| 异步 | 同步 | 异步 | 同步 |
| 性能 | 小数据快 | 大数据高效 | 每次请求都携带 |

**核心能力：**
- 存储结构化克隆算法支持的所有类型（Object、Array、Blob、File、Date 等）
- 基于索引的高性能查询
- ACID 事务保证数据一致性
- 跨页面/标签页共享数据
- 存储大量数据而不阻塞主线程

### 1.2 关键术语

```
Database（数据库）
  └── Object Store（对象仓库，类似"表"）
        ├── Record（记录，以 key-value 形式存储）
        ├── Key（主键，唯一标识每条记录）
        └── Index（索引，基于记录属性加速查询）
```

- **Database**：顶级容器，每个源（origin）可以有多个数据库
- **Object Store**：数据存储的基本单元，类似关系型数据库的表
- **Key**：每条记录的唯一标识，可以是自增整数或外部指定
- **Index**：在 Object Store 上创建的索引，支持按属性快速查找
- **Transaction**：读写操作的封装，保证原子性
- **Cursor**：遍历大量记录的游标对象

---

## 二、原生 API 完整实战

### 2.1 数据库的打开与版本管理

```javascript
// 打开（或创建）数据库
const request = indexedDB.open('MyAppDB', 1)

request.onerror = (event) => {
  console.error('数据库打开失败:', event.target.error)
}

request.onsuccess = (event) => {
  const db = event.target.result
  console.log('数据库打开成功:', db.name, '版本:', db.version)
  // 在这里执行数据库操作...
}

// 版本号变化时触发——这是唯一可以创建/修改对象仓库的地方
request.onupgradeneeded = (event) => {
  const db = event.target.result

  // 创建对象仓库
  if (!db.objectStoreNames.contains('users')) {
    const userStore = db.createObjectStore('users', {
      keyPath: 'id',
      autoIncrement: true
    })

    // 创建索引
    userStore.createIndex('email', 'email', { unique: true })
    userStore.createIndex('name', 'name', { unique: false })
    userStore.createIndex('createdAt', 'createdAt', { unique: false })
  }

  if (!db.objectStoreNames.contains('posts')) {
    const postStore = db.createObjectStore('posts', {
      keyPath: 'id',
      autoIncrement: true
    })
    postStore.createIndex('authorId', 'authorId', { unique: false })
    postStore.createIndex('publishedAt', 'publishedAt', { unique: false })
    postStore.createIndex('status', 'status', { unique: false })
  }
}
```

**关键点：**
- `indexedDB.open(name, version)` 返回 `IDBOpenDBRequest`
- 版本号只能**递增**，不能降级
- `onupgradeneeded` 是唯一可以修改数据库结构的地方
- 多个 Object Store 可以在同一个 Transaction 中创建

### 2.2 CRUD 操作的完整封装

```javascript
class DB {
  constructor(dbName, version) {
    this.dbName = dbName
    this.version = version
    this.db = null
  }

  // 打开数据库
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onupgradeneeded = (event) => {
        this._onUpgrade(event.target.result)
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve(this.db)
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  // 子类覆写此方法定义结构
  _onUpgrade(db) {
    // override me
  }

  // 通用事务执行器
  _tx(stores, mode = 'readonly') {
    const tx = this.db.transaction(stores, mode)
    const storeObjects = Array.isArray(stores)
      ? stores.map(s => tx.objectStore(s))
      : [tx.objectStore(stores)]

    return { tx, stores: storeObjects, promise: new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })}
  }

  // 新增
  async add(storeName, data) {
    const { tx, stores, promise } = this._tx(storeName, 'readwrite')
    const request = stores[0].add(data)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      promise.catch(reject)
    })
  }

  // 更新（put = upsert）
  async put(storeName, data) {
    const { tx, stores, promise } = this._tx(storeName, 'readwrite')
    const request = stores[0].put(data)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      promise.catch(reject)
    })
  }

  // 通过主键获取
  async get(storeName, key) {
    const { stores } = this._tx(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = stores[0].get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 通过索引查询
  async getByIndex(storeName, indexName, value) {
    const { stores } = this._tx(storeName, 'readonly')
    const index = stores[0].index(indexName)
    return new Promise((resolve, reject) => {
      const request = index.get(value)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 获取所有记录
  async getAll(storeName) {
    const { stores } = this._tx(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = stores[0].getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 删除
  async delete(storeName, key) {
    const { tx, stores, promise } = this._tx(storeName, 'readwrite')
    stores[0].delete(key)
    return promise
  }

  // 清空整个 Store
  async clear(storeName) {
    const { tx, stores, promise } = this._tx(storeName, 'readwrite')
    stores[0].clear()
    return promise
  }
}
```

### 2.3 使用 Cursor 遍历和高级查询

Cursor 是 IndexedDB 处理大量数据的核心机制——它不会一次性加载所有数据，而是逐条遍历：

```javascript
// 使用游标遍历
async function iterateUsers(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly')
    const store = tx.objectStore('users')
    const request = store.openCursor()

    const results = []

    request.onsuccess = (event) => {
      const cursor = event.target.result

      if (cursor) {
        // cursor.value 是当前记录
        // cursor.key 是当前记录的主键
        // cursor.update(newValue) 可以更新当前记录
        // cursor.delete() 可以删除当前记录
        // cursor.advance(n) 跳过 n 条记录

        if (cursor.value.active) {
          results.push(cursor.value)
        }

        cursor.continue() // 移动到下一条
      } else {
        // 遍历完成
        resolve(results)
      }
    }

    request.onerror = () => reject(request.error)
  })
}
```

### 2.4 使用 IDBKeyRange 进行范围查询

这是 IndexedDB 查询能力的精髓：

```javascript
const store = tx.objectStore('users')
const index = store.index('createdAt')

// IDBKeyRange 支持多种范围定义

// 所有 key
index.openCursor() // 不传参数 = 所有记录

// 精确匹配
index.openCursor(IDBKeyRange.only('2025-01-15'))

// 范围查询
index.openCursor(IDBKeyRange.lowerBound('2025-01-01'))     // >= 2025-01-01
index.openCursor(IDBKeyRange.upperBound('2025-12-31'))     // <= 2025-12-31
index.openCursor(IDBKeyRange.bound('2025-01-01', '2025-06-30')) // 闭区间
index.openCursor(IDBKeyRange.bound('2025-01-01', '2025-06-30', true, true)) // 开区间

// 组合条件：查询某作者在某个时间段内发布的文章
async function getPostsByAuthorInTimeRange(db, authorId, start, end) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly')
    const store = tx.objectStore('posts')

    // 使用 authorId 索引
    const authorIndex = store.index('authorId')
    const request = authorIndex.openCursor(IDBKeyRange.only(authorId))

    const results = []

    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        // 在游标回调中进行二次过滤
        if (cursor.value.publishedAt >= start && cursor.value.publishedAt <= end) {
          results.push(cursor.value)
        }
        cursor.continue()
      } else {
        resolve(results)
      }
    }

    request.onerror = () => reject(request.error)
  })
}
```

### 2.5 事务深入：生命周期与陷阱

IndexedDB 的事务有一个极其反直觉的特性——**事务在不活跃时会自动提交**：

```javascript
function badTransactionExample(db) {
  const tx = db.transaction('users', 'readwrite')
  const store = tx.objectStore('users')

  // 错误 错误：tx 在 .get() 的 onsuccess 回调之前就已经自动提交了！
  // 因为 JavaScript 是单线程的，事件循环中 tx 没有被"保持活跃"
  store.add({ name: 'Alice' })
  store.add({ name: 'Bob' })
  // 如果这里没有任何异步操作等待 tx 完成，tx 可能在第二个 add 执行前就提交了

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve('OK')
    tx.onerror = () => reject(tx.error)
  })
}

function goodTransactionExample(db) {
  const tx = db.transaction('users', 'readwrite')
  const store = tx.objectStore('users')

  // 正确 正确：保持对 tx 的引用
  const add1 = store.add({ name: 'Alice' })
  const add2 = store.add({ name: 'Bob' })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve('OK')
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
```

**规则：** 在同一微任务中发起的所有请求会保持事务活跃。一旦回到事件循环等待异步结果，事务可能提前提交。最佳实践是在发起第一个请求之前就设置好事务的回调。

---

## 三、封装库：idb 让开发体验质变

原生 API 太痛苦了，`idb`（由 Jake Archibald，即 Chrome 团队成员开发）是一个仅 1.3KB 的 Promise 化封装库：

### 3.1 安装

```bash
npm install idb
# 或
pnpm add idb
```

### 3.2 完整实战：一个笔记应用的存储层

```typescript
// src/lib/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
  isPinned: boolean
}

interface Attachment {
  id: string
  noteId: string
  name: string
  type: string // MIME type
  blob: Blob
  createdAt: number
}

interface AppDB extends DBSchema {
  notes: {
    key: string
    value: Note
    indexes: {
      'by-createdAt': number
      'by-updatedAt': number
      'by-tag': string
      'by-pinned': number // 复合索引用
    }
  }
  attachments: {
    key: string
    value: Attachment
    indexes: {
      'by-noteId': string
    }
  }
}

let dbInstance: IDBPDatabase<AppDB> | null = null

export async function getDB() {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<AppDB>('NotesApp', 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 版本 1：创建 notes store
      if (oldVersion < 1) {
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' })
        noteStore.createIndex('by-createdAt', 'createdAt')
        noteStore.createIndex('by-updatedAt', 'updatedAt')
      }

      // 版本 2：添加 attachments store + tags 索引 + pinned 索引
      if (oldVersion < 2) {
        const noteStore = transaction.objectStore('notes')
        noteStore.createIndex('by-tag', 'tags', { multiEntry: true })
        noteStore.createIndex('by-pinned', 'isPinned')

        const attachStore = db.createObjectStore('attachments', { keyPath: 'id' })
        attachStore.createIndex('by-noteId', 'noteId')
      }
    },
    blocked() {
      console.warn('数据库升级被阻塞（可能有其他标签页正在使用旧版本）')
    },
    blocking() {
      console.warn('此连接正在阻塞其他标签页的升级')
    },
    terminated() {
      dbInstance = null // 连接意外断开，重置实例
      console.error('数据库连接被意外终止')
    },
  })

  return dbInstance
}
```

### 3.3 CRUD 操作变得优雅

```typescript
// 创建笔记
export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDB()
  const note: Note = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.add('notes', note)
  return note
}

// 更新笔记
export async function updateNote(id: string, data: Partial<Omit<Note, 'id' | 'createdAt'>>) {
  const db = await getDB()
  const tx = db.transaction('notes', 'readwrite')
  const store = tx.objectStore('notes')

  const existing = await store.get(id)
  if (!existing) throw new Error(`Note ${id} not found`)

  const updated: Note = {
    ...existing,
    ...data,
    updatedAt: Date.now(),
  }
  await store.put(updated)

  return updated
}

// 使用索引查询：获取所有置顶笔记
export async function getPinnedNotes() {
  const db = await getDB()
  const index = db.transaction('notes').objectStore('notes').index('by-pinned')
  // key = 1 表示 isPinned 为 true
  return index.getAll(IDBKeyRange.only(1))
}

// 按更新时间倒序获取笔记列表
export async function getNotesByRecent(limit = 50) {
  const db = await getDB()
  const index = db.transaction('notes').objectStore('notes').index('by-updatedAt')
  // prev 表示降序（从大到小）
  return index.getAll(null, limit) // getAll(keyRange, count)
}

// 使用 multiEntry 索引按标签查询
export async function getNotesByTag(tag: string) {
  const db = await getDB()
  const index = db.transaction('notes').objectStore('notes').index('by-tag')
  return index.getAll(IDBKeyRange.only(tag))
}

// 删除笔记及其附件
export async function deleteNote(id: string) {
  const db = await getDB()
  const tx = db.transaction(['notes', 'attachments'], 'readwrite')

  // 先删除关联附件
  const attachIndex = tx.objectStore('attachments').index('by-noteId')
  let cursor = await attachIndex.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  // 再删除笔记
  await tx.objectStore('notes').delete(id)

  await tx.done // 等待事务完成
}
```

### 3.4 存储和读取文件（Blob/ArrayBuffer）

IndexedDB 非常适合存储离线资源，比如图片、PDF、缓存数据：

```typescript
// 保存图片附件
export async function saveAttachment(noteId: string, file: File) {
  const db = await getDB()
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    noteId,
    name: file.name,
    type: file.type,
    blob: file,
    createdAt: Date.now(),
  }
  await db.add('attachments', attachment)
  return attachment
}

// 读取附件并创建 Object URL
export async function getAttachmentUrl(id: string) {
  const db = await getDB()
  const attachment = await db.get('attachments', id)
  if (!attachment) return null
  return URL.createObjectURL(attachment.blob)
}
```

---

## 四、进阶实战：离线优先的数据同步架构

### 4.1 同步队列设计

在离线场景中，用户可能在无网络时执行操作，需要等恢复连接后同步到服务端：

```typescript
interface SyncRecord {
  id: string
  action: 'create' | 'update' | 'delete'
  storeName: string
  data: unknown
  timestamp: number
  retryCount: number
}

// 在 DB Schema 中添加 syncQueue
interface AppDB extends DBSchema {
  // ... 之前的 notes 和 attachments
  syncQueue: {
    key: string
    value: SyncRecord
    indexes: {
      'by-timestamp': number
    }
  }
}

// 写入操作同时入队
export async function createNoteWithSync(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDB()
  const note: Note = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const tx = db.transaction(['notes', 'syncQueue'], 'readwrite')

  await tx.objectStore('notes').add(note)
  await tx.objectStore('syncQueue').add({
    id: crypto.randomUUID(),
    action: 'create',
    storeName: 'notes',
    data: note,
    timestamp: Date.now(),
    retryCount: 0,
  })

  await tx.done
  return note
}

// 网络恢复时批量同步
export async function syncPendingChanges() {
  const db = await getDB()
  const store = db.transaction('syncQueue', 'readwrite').objectStore('syncQueue')
  const index = store.index('by-timestamp')

  let cursor = await index.openCursor()
  while (cursor) {
    const record = cursor.value

    try {
      // 尝试同步到服务端
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })

      // 同步成功，从队列中移除
      await cursor.delete()
    } catch (error) {
      // 同步失败，更新重试次数
      if (record.retryCount >= 3) {
        console.error(`同步失败，已重试3次，放弃: ${record.id}`)
        await cursor.delete()
      } else {
        await cursor.update({
          ...record,
          retryCount: record.retryCount + 1,
        })
      }
    }

    cursor = await cursor.continue()
  }
}
```

### 4.2 使用 BroadcastChannel 跨标签页同步

```typescript
// 当一个标签页修改了数据，通知其他标签页更新
const channel = new BroadcastChannel('notes-sync')

// 写入后广播
async function broadcastChange(action: string, data: unknown) {
  channel.postMessage({ action, data, timestamp: Date.now() })
}

// 其他标签页监听
channel.onmessage = (event) => {
  const { action, data } = event.data
  switch (action) {
    case 'note:created':
      // 更新本地 UI
      break
    case 'note:updated':
      // 更新本地 UI
      break
    case 'note:deleted':
      // 从 UI 移除
      break
  }
}
```

---

## 五、性能优化技巧

### 5.1 批量写入优化

```typescript
// 错误 慢：逐条 add，每次都创建一个事务
async function importNotesSlow(notes: Note[]) {
  for (const note of notes) {
    await db.add('notes', note) // 每次一个事务！
  }
}

// 正确 快：一个事务中批量写入
async function importNotesFast(notes: Note[]) {
  const tx = db.transaction('notes', 'readwrite')
  const store = tx.objectStore('notes')
  for (const note of notes) {
    store.add(note) // 不 await，在同一个事务中排队
  }
  await tx.done
}
```

**性能差距：** 批量写入比逐条写入快 **10-100 倍**，因为事务提交的开销是固定的，与记录数量无关。

### 5.2 分页加载大数据集

```typescript
// 使用游标分页
async function getNotesPage(pageSize: number, offset: number) {
  const db = await getDB()
  const store = db.transaction('notes').objectStore('notes')
  const index = store.index('by-updatedAt')

  const results: Note[] = []
  let skipped = 0

  let cursor = await index.openCursor(null, 'prev') // 降序
  while (cursor && results.length < pageSize) {
    if (skipped < offset) {
      skipped++
      cursor = await cursor.continue()
      continue
    }
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}
```

### 5.3 使用 compound index 优化复合查询

```typescript
// 创建时定义 compound index
// keyPath 为数组，查询时 IDBKeyRange 也需要传数组
store.createIndex('by-authorAndDate', ['authorId', 'publishedAt'])

// 查询某作者在某个时间之后的文章
const range = IDBKeyRange.bound(
  [authorId, startDate],
  [authorId, endDate]
)
index.openCursor(range)
```

---

## 六、IndexedDB 在实际项目中的应用场景

### 6.1 离线优先 PWA

```typescript
// sw.ts - Service Worker 中使用 IndexedDB 缓存 API 响应
async function cacheResponse(request: Request, response: Response) {
  const db = await getDB()
  await db.put('apiCache', {
    url: request.url,
    method: request.method,
    body: await response.clone().arrayBuffer(),
    headers: Object.fromEntries(response.headers.entries()),
    timestamp: Date.now(),
  })
}

async function getCachedResponse(request: Request): Promise<Response | null> {
  const db = await getDB()
  const cached = await db.get('apiCache', request.url)
  if (!cached) return null

  return new Response(cached.body, {
    headers: cached.headers,
  })
}
```

### 6.2 客户端全文搜索

```typescript
// 存储时建立倒排索引
interface SearchIndex {
  id: string
  noteId: string
  term: string // 分词后的词条
}

// 写入笔记时更新索引
async function updateSearchIndex(note: Note) {
  const db = await getDB()
  const tx = db.transaction(['notes', 'searchIndex'], 'readwrite')

  // 删除旧索引
  const oldIndex = tx.objectStore('searchIndex')
  let cursor = await oldIndex.openCursor(IDBKeyRange.only(note.id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  // 建立新索引（简单分词：按空格和标点拆分，去重，转小写）
  const terms = new Set(
    `${note.title} ${note.content}`
      .toLowerCase()
      .split(/[\s,.\-;:!?/（）【】]+/)
      .filter(w => w.length > 1)
  )

  for (const term of terms) {
    await oldIndex.add({
      id: crypto.randomUUID(),
      noteId: note.id,
      term,
    })
  }
}
```

### 6.3 大文件分片存储

IndexedDB 不适合存单个超大 Blob（>500MB），需要分片：

```typescript
const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB 每片

async function saveLargeFile(file: File) {
  const db = await getDB()
  const tx = db.transaction('fileChunks', 'readwrite')
  const store = tx.objectStore('fileChunks')

  const fileId = crypto.randomUUID()
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    store.add({
      fileId,
      chunkIndex: i,
      data: await chunk.arrayBuffer(),
      totalChunks,
    })
  }

  // 存储文件元信息
  await db.put('fileMeta', {
    id: fileId,
    name: file.name,
    type: file.type,
    size: file.size,
    totalChunks,
    createdAt: Date.now(),
  })

  await tx.done
  return fileId
}
```

---

## 七、调试技巧

### 7.1 Chrome DevTools

打开 DevTools → **Application** → 左侧面板 **IndexedDB**：

- 查看所有数据库、Object Store、索引
- 浏览和编辑记录
- 手动添加/删除数据
- 查看数据库版本和连接状态

### 7.2 代码中调试事务

```typescript
// 捕获所有事务错误
const originalTransaction = IDBDatabase.prototype.transaction
IDBDatabase.prototype.transaction = function (...args) {
  const tx = originalTransaction.apply(this, args)
  tx.addEventListener('error', (event) => {
    console.error('[IndexedDB TX Error]', {
      stores: Array.from(args[0]),
      mode: args[1],
      error: (event.target as IDBTransaction).error,
      stack: new Error().stack,
    })
  })
  return tx
}
```

---

## 八、IndexedDB 与其他存储方案的配合

在真实项目中，IndexedDB 通常不是单独使用的：

```
                        ┌─ 结构化数据（文章、用户等）→ IndexedDB
                        │
用户数据 ──── 选择方案 ──┼─ 简单配置/KV 缓存 → localStorage
                        │
                        └─ 二进制资源/离线缓存 → Cache API + IndexedDB
```

**Cache API** 是 Service Worker 专用的 HTTP 缓存 API，适合缓存网络请求。但它不能像 IndexedDB 那样灵活查询。最佳实践是：

- **Cache API**：缓存页面静态资源（HTML/CSS/JS/图片）
- **IndexedDB**：存储应用数据 + API 响应缓存 + 大文件

---

## 九、常见陷阱与解决方案

### 9.1 版本迁移失败导致数据丢失

```typescript
// 正确 使用事务确保原子性
upgrade(db, oldVersion) {
  if (oldVersion < 2) {
    // 重命名 Object Store（IndexedDB 不支持直接重命名）
    const oldStore = db.objectStore('memo')
    db.deleteObjectStore('memo')
    const newStore = db.createObjectStore('notes', { keyPath: 'id' })
    // 注意：deleteObjectStore 后数据丢失！
    // 正确做法：先读取再迁移
  }
}

// 正确 安全迁移：先读后写
async upgradeWithMigration(db: IDBPDatabase, oldVersion: number) {
  if (oldVersion < 2) {
    // 阶段 1：在 onupgradeneeded 中创建新 store
    const newStore = db.createObjectStore('notes_v2', { keyPath: 'id' })

    // 阶段 2：升级后迁移数据
    setTimeout(async () => {
      const tx = db.transaction(['notes', 'notes_v2'], 'readwrite')
      const oldData = await tx.objectStore('notes').getAll()
      for (const item of oldData) {
        await tx.objectStore('notes_v2').put({
          ...item,
          migratedAt: Date.now(),
        })
      }
      await tx.done

      // 阶段 3：下次升级时删除旧 store
    }, 0)
  }
}
```

### 9.2 IndexedDB 被浏览器清理

浏览器在存储压力下可能清除 IndexedDB 数据（尤其 Safari）：

```javascript
// 监听存储压力事件
window.addEventListener('storage', (event) => {
  if (event.key === 'estimatedQuota') {
    console.warn('存储配额变化，可能即将被清理')
  }
})

// 使用 navigator.storage 主动检查
const estimate = await navigator.storage.estimate()
console.log(`已用: ${(estimate.usage! / 1024 / 1024).toFixed(1)}MB`)
console.log(`配额: ${(estimate.quota! / 1024 / 1024).toFixed(1)}MB`)

// 请求持久化存储权限（Chrome/Edge）
const persisted = await navigator.storage.persist()
if (!persisted) {
  console.warn('存储未被标记为持久化，可能被浏览器自动清理')
}
```

### 9.3 Structured Clone 的限制

IndexedDB 使用 Structured Clone Algorithm，以下类型**不支持**：
- `Function`
- `Symbol`
- `DOM HTMLElement`
- `WeakMap`/`WeakSet`

```typescript
// 正确 存储前清理不支持的类型
function sanitizeForStorage(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj

  // 处理 Date
  if (obj instanceof Date) return obj

  // 处理 Map → 转为 Array
  if (obj instanceof Map) {
    return Array.from(obj.entries())
  }

  // 处理 Set → 转为 Array
  if (obj instanceof Set) {
    return Array.from(obj)
  }

  // 处理 ArrayBuffer → 直接支持
  // 处理 Blob → 直接支持
  // 处理 File → 直接支持

  if (Array.isArray(obj)) return obj.map(sanitizeForStorage)

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'function' || typeof value === 'symbol') continue
    result[key] = sanitizeForStorage(value)
  }
  return result
}
```

---

## 总结

IndexedDB 是浏览器中唯一能够满足**复杂离线数据存储**需求的方案。虽然原生 API 设计古老，但通过 `idb` 这类现代封装库，开发者完全可以获得类型安全、Promise-based、优雅的开发体验。

**核心要点回顾：**
1. 用 `idb` 库替代原生 API，获得 Promise + TypeScript 类型支持
2. 所有 schema 变更必须在 `onupgradeneeded` 中处理，版本号只能递增
3. 注意事务的生命周期——在同一微任务中发起请求保持事务活跃
4. 批量操作使用单个事务，性能提升 10-100 倍
5. 结合 Service Worker + Cache API 构建完整的离线优先架构
6. 监听 `navigator.storage` 事件应对存储清理
7. 使用 BroadcastChannel 实现跨标签页数据同步

在 PWA、离线编辑器、本地优先应用日益流行的今天，IndexedDB 已经从"可选"变成了"必备"。掌握它，就是掌握了现代 Web 应用的离线能力的核心。

---

*本文由小虾子  撰写*
