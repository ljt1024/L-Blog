# WebSocket 实时通信深度解析：从原理到企业级实战

> 聊天室、实时协作、股票行情、在线游戏...这些应用有什么共同点？它们都需要实时通信。而 WebSocket，就是实现这些场景的核心技术。本文将带你从零理解 WebSocket 的原理，并掌握企业级实战技巧。

## 一、为什么需要 WebSocket？

### 1.1 HTTP 的局限性

传统 HTTP 是**请求-响应**模式，客户端发起请求，服务器返回响应：

```
客户端                    服务器
  │                         │
  │──── GET /api ─────────►│
  │                         │
  │◄─── 200 OK ────────────│
  │                         │
  │     连接关闭             │
```

**问题**：服务器无法主动推送数据给客户端。

### 1.2 轮询方案的困境

#### 短轮询（Short Polling）

```javascript
// 每隔 1 秒请求一次
setInterval(async () => {
  const data = await fetch('/api/messages')
  console.log(data)
}, 1000)
```

**缺点**：
- 大量无效请求（数据没更新也在请求）
- 服务器压力大
- 实时性差（最多 1 秒延迟）

#### 长轮询（Long Polling）

```javascript
async function longPoll() {
  while (true) {
    try {
      // 服务器 hold 住请求，直到有新数据
      const data = await fetch('/api/messages?longpoll=true')
      console.log(data)
      // 收到数据后立即发起下一个请求
    } catch (error) {
      // 出错后等待一会再重试
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}
```

**缺点**：
- 每次收到数据都要重新建立连接
- 服务器需要维护大量挂起的请求
- 仍然不是真正的"实时"

### 1.3 WebSocket 的优势

WebSocket 提供了**全双工、持久化**的通信通道：

```
客户端                    服务器
  │                         │
  │──── 握手请求 ──────────►│
  │◄─── 握手响应 ───────────│
  │                         │
  │═════ WebSocket 连接 ═════│
  │                         │
  │◄─── 服务器推送 ──────────│
  │──── 客户端发送 ─────────►│
  │◄─── 服务器推送 ──────────│
  │◄─── 服务器推送 ──────────│
  │──── 客户端发送 ─────────►│
  │         ...             │
```

**优势**：
- **全双工**：双向通信，服务器可主动推送
- **持久连接**：一次握手，持续通信
- **低开销**：数据帧头部仅 2-6 字节（HTTP 每次请求头部数百字节）
- **实时性**：毫秒级延迟

## 二、WebSocket 原理深度解析

### 2.1 握手过程

WebSocket 通过 HTTP Upgrade 机制建立连接：

**客户端请求**：
```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://example.com
```

**服务器响应**：
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**Sec-WebSocket-Accept 计算方式**：
```javascript
const crypto = require('crypto')

function calculateAccept(key) {
  const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  return crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64')
}

// 服务器验证客户端
const clientKey = 'dGhlIHNhbXBsZSBub25jZQ=='
const accept = calculateAccept(clientKey)
// s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### 2.2 数据帧格式

WebSocket 数据帧结构：

```
  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 +-+-+-+-+-------+-+-------------+-------------------------------+
 |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 | |1|2|3|       |K|             |                               |
 +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 |     Extended payload length continued, if payload len == 127  |
 + - - - - - - - - - - - - - - - +-------------------------------+
 |                               |Masking-key, if MASK set to 1  |
 +-------------------------------+-------------------------------+
 | Masking-key (continued)       |          Payload Data         |
 +-------------------------------- - - - - - - - - - - - - - - - +
 :                     Payload Data continued ...                :
 + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
 |                     Payload Data continued ...                |
 +---------------------------------------------------------------+
```

**关键字段**：
- **FIN**：是否为最后一帧（消息可能分多帧）
- **opcode**：操作码
  - `0x0`：延续帧
  - `0x1`：文本帧
  - `0x2`：二进制帧
  - `0x8`：关闭帧
  - `0x9`：Ping
  - `0xA`：Pong
- **MASK**：是否掩码（客户端发送必须掩码）
- **Payload len**：数据长度

### 2.3 掩码算法

客户端发送数据时必须掩码，防止缓存污染攻击：

```javascript
function mask(payload, maskingKey) {
  const masked = new Uint8Array(payload.length)
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ maskingKey[i % 4]
  }
  return masked
}

// 解掩码（服务器收到后）
function unmask(masked, maskingKey) {
  return mask(masked, maskingKey) // 异或是对称的
}
```

## 三、浏览器端实战

### 3.1 基础用法

```javascript
// 创建连接
const ws = new WebSocket('wss://example.com/chat')

// 连接打开
ws.onopen = (event) => {
  console.log('WebSocket 连接已建立')
  
  // 发送文本消息
  ws.send('Hello Server!')
  
  // 发送 JSON 数据
  ws.send(JSON.stringify({ type: 'chat', content: '你好' }))
  
  // 发送二进制数据
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, 12345)
  ws.send(buffer)
}

// 接收消息
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    // 文本消息
    const message = JSON.parse(event.data)
    console.log('收到消息:', message)
  } else if (event.data instanceof Blob) {
    // 二进制消息（Blob）
    event.data.arrayBuffer().then(buffer => {
      console.log('收到二进制数据:', new Uint8Array(buffer))
    })
  } else if (event.data instanceof ArrayBuffer) {
    // 二进制消息（ArrayBuffer）
    console.log('收到 ArrayBuffer:', event.data)
  }
}

// 连接关闭
ws.onclose = (event) => {
  console.log('连接关闭:', event.code, event.reason)
  
  // 常见关闭码
  // 1000: 正常关闭
  // 1001: 端点离开
  // 1002: 协议错误
  // 1003: 不支持的数据类型
  // 1006: 异常关闭（没有收到关闭帧）
  // 1008: 政策违规
  // 1009: 消息过大
  // 1011: 内部错误
}

// 错误处理
ws.onerror = (error) => {
  console.error('WebSocket 错误:', error)
}

// 主动关闭连接
// ws.close(1000, 'Goodbye')
```

### 3.2 连接状态

```javascript
// WebSocket.readyState 状态值
WebSocket.CONNECTING  // 0: 连接中
WebSocket.OPEN        // 1: 已连接
WebSocket.CLOSING     // 2: 关闭中
WebSocket.CLOSED      // 3: 已关闭

// 安全发送
function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data)
    return true
  }
  console.warn('WebSocket 未连接')
  return false
}
```

### 3.3 心跳保活机制

```javascript
class WebSocketWithHeartbeat {
  constructor(url, options = {}) {
    this.url = url
    this.heartbeatInterval = options.heartbeatInterval || 30000
    this.heartbeatTimeout = options.heartbeatTimeout || 5000
    this.reconnectDelay = options.reconnectDelay || 1000
    this.maxReconnectDelay = options.maxReconnectDelay || 30000
    
    this.ws = null
    this.heartbeatTimer = null
    this.timeoutTimer = null
    this.reconnectAttempts = 0
    this.shouldReconnect = true
    
    this.connect()
  }
  
  connect() {
    this.ws = new WebSocket(this.url)
    
    this.ws.onopen = () => {
      console.log('WebSocket 已连接')
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.onopen?.()
    }
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // 收到 pong 响应
      if (data.type === 'pong') {
        this.resetHeartbeat()
        return
      }
      
      this.onmessage?.(data)
    }
    
    this.ws.onclose = (event) => {
      console.log('WebSocket 已关闭:', event.code)
      this.stopHeartbeat()
      this.onclose?.(event)
      
      // 非正常关闭时尝试重连
      if (this.shouldReconnect && event.code !== 1000) {
        this.reconnect()
      }
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error)
      this.onerror?.(error)
    }
  }
  
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        // 发送 ping
        this.ws.send(JSON.stringify({ type: 'ping' }))
        
        // 设置超时检测
        this.timeoutTimer = setTimeout(() => {
          console.warn('心跳超时，关闭连接')
          this.ws.close(1006, 'Heartbeat timeout')
        }, this.heartbeatTimeout)
      }
    }, this.heartbeatInterval)
  }
  
  resetHeartbeat() {
    clearTimeout(this.timeoutTimer)
  }
  
  stopHeartbeat() {
    clearInterval(this.heartbeatTimer)
    clearTimeout(this.timeoutTimer)
  }
  
  reconnect() {
    this.reconnectAttempts++
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    )
    
    console.log(`${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`)
    
    setTimeout(() => {
      this.connect()
    }, delay)
  }
  
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    }
    return false
  }
  
  close() {
    this.shouldReconnect = false
    this.stopHeartbeat()
    this.ws.close(1000, 'Client closed')
  }
}

// 使用示例
const ws = new WebSocketWithHeartbeat('wss://example.com/chat', {
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000
})

ws.onmessage = (data) => {
  console.log('收到消息:', data)
}
```

### 3.4 断线重连策略

```javascript
class ReconnectingWebSocket {
  constructor(url, protocols = [], options = {}) {
    this.url = url
    this.protocols = protocols
    this.options = {
      maxRetries: Infinity,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      ...options
    }
    
    this.retries = 0
    this.shouldReconnect = true
    this.messageQueue = [] // 断线期间的消息队列
    
    this.connect()
  }
  
  connect() {
    this.ws = new WebSocket(this.url, this.protocols)
    
    this.ws.onopen = () => {
      this.retries = 0
      this.onopen?.()
      
      // 发送队列中的消息
      while (this.messageQueue.length > 0) {
        const data = this.messageQueue.shift()
        this.ws.send(data)
      }
    }
    
    this.ws.onmessage = (e) => this.onmessage?.(e)
    this.ws.onerror = (e) => this.onerror?.(e)
    
    this.ws.onclose = (e) => {
      this.onclose?.(e)
      
      if (this.shouldReconnect && this.retries < this.options.maxRetries) {
        this.retries++
        const delay = Math.min(
          this.options.reconnectInterval * this.retries,
          this.options.maxReconnectInterval
        )
        
        setTimeout(() => this.connect(), delay)
      }
    }
  }
  
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      // 连接断开时，将消息加入队列
      this.messageQueue.push(data)
    }
  }
  
  close() {
    this.shouldReconnect = false
    this.ws.close()
  }
  
  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }
}
```

## 四、Node.js 服务器实战

### 4.1 使用 ws 库

```bash
npm install ws
```

```javascript
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

// 存储所有连接的客户端
const clients = new Set()

wss.on('connection', (ws, request) => {
  // 获取客户端信息
  const ip = request.socket.remoteAddress
  const url = new URL(request.url, `http://${request.headers.host}`)
  const userId = url.searchParams.get('userId')
  
  console.log(`用户 ${userId} 已连接 (${ip})`)
  
  // 将客户端加入集合
  ws.userId = userId
  clients.add(ws)
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '欢迎加入聊天室',
    onlineCount: clients.size
  }))
  
  // 广播用户上线
  broadcast({
    type: 'user-joined',
    userId,
    onlineCount: clients.size
  }, ws)
  
  // 接收消息
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data)
      
      // 心跳检测
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        return
      }
      
      // 聊天消息
      if (message.type === 'chat') {
        broadcast({
          type: 'chat',
          userId,
          content: message.content,
          timestamp: Date.now()
        })
      }
      
    } catch (error) {
      console.error('消息解析失败:', error)
    }
  })
  
  // 连接关闭
  ws.on('close', (code, reason) => {
    console.log(`用户 ${userId} 已断开: ${code} ${reason}`)
    clients.delete(ws)
    
    // 广播用户下线
    broadcast({
      type: 'user-left',
      userId,
      onlineCount: clients.size
    })
  })
  
  // 错误处理
  ws.on('error', (error) => {
    console.error(`用户 ${userId} 连接错误:`, error)
  })
})

// 广播函数
function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message)
  
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(data)
    }
  }
}

console.log('WebSocket 服务器运行在 ws://localhost:8080')
```

### 4.2 使用 Socket.io（更高级的封装）

```bash
npm install socket.io
```

```javascript
import { Server } from 'socket.io'

const io = new Server(3000, {
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST']
  }
})

// 命名空间
const chatNamespace = io.of('/chat')

chatNamespace.on('connection', (socket) => {
  console.log('用户连接:', socket.id)
  
  // 加入房间
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    socket.to(roomId).emit('user-joined', socket.id)
    console.log(`${socket.id} 加入房间 ${roomId}`)
  })
  
  // 离开房间
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId)
    socket.to(roomId).emit('user-left', socket.id)
  })
  
  // 房间内消息
  socket.on('room-message', (roomId, message) => {
    // 发送给房间内所有人（包括发送者）
    chatNamespace.to(roomId).emit('room-message', {
      userId: socket.id,
      message,
      timestamp: Date.now()
    })
  })
  
  // 私聊
  socket.on('private-message', (targetSocketId, message) => {
    socket.to(targetSocketId).emit('private-message', {
      from: socket.id,
      message,
      timestamp: Date.now()
    })
  })
  
  // 断开连接
  socket.on('disconnect', (reason) => {
    console.log(`用户断开: ${socket.id}, 原因: ${reason}`)
  })
})

// 客户端连接数监控
setInterval(() => {
  console.log(`当前连接数: ${chatNamespace.sockets.size}`)
}, 60000)
```

**客户端（Socket.io）**：

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'user-jwt-token'
  },
  transports: ['websocket'], // 只使用 WebSocket
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
})

socket.on('connect', () => {
  console.log('已连接:', socket.id)
  
  // 加入房间
  socket.emit('join-room', 'room-123')
})

socket.on('user-joined', (userId) => {
  console.log('用户加入:', userId)
})

socket.on('room-message', (data) => {
  console.log('收到消息:', data)
})

// 发送消息
function sendMessage(roomId, content) {
  socket.emit('room-message', roomId, content)
}

// 私聊
function sendPrivate(targetId, content) {
  socket.emit('private-message', targetId, content)
}
```

## 五、企业级实战场景

### 5.1 实时聊天系统

```javascript
// 完整的聊天系统示例
class ChatServer {
  constructor() {
    this.users = new Map() // userId -> { ws, rooms, lastSeen }
    this.rooms = new Map() // roomId -> Set<userId>
    this.messages = new Map() // roomId -> Message[]
  }
  
  handleConnection(ws, userId) {
    // 用户上线
    const user = {
      ws,
      rooms: new Set(),
      lastSeen: Date.now()
    }
    this.users.set(userId, user)
    
    // 发送未读消息
    this.sendUnreadMessages(userId)
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data)
      this.handleMessage(userId, msg)
    })
    
    ws.on('close', () => {
      this.handleDisconnect(userId)
    })
  }
  
  handleMessage(userId, msg) {
    switch (msg.type) {
      case 'join-room':
        this.joinRoom(userId, msg.roomId)
        break
      case 'chat':
        this.handleChat(userId, msg)
        break
      case 'typing':
        this.handleTyping(userId, msg.roomId)
        break
      case 'read':
        this.markAsRead(userId, msg.roomId, msg.messageId)
        break
    }
  }
  
  joinRoom(userId, roomId) {
    const user = this.users.get(userId)
    if (!user) return
    
    // 加入房间
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set())
    }
    this.rooms.get(roomId).add(userId)
    user.rooms.add(roomId)
    
    // 通知房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'user-joined',
      userId,
      roomId
    }, userId)
    
    // 发送房间历史消息
    const messages = this.messages.get(roomId) || []
    user.ws.send(JSON.stringify({
      type: 'room-history',
      roomId,
      messages: messages.slice(-50) // 最近 50 条
    }))
  }
  
  handleChat(userId, msg) {
    const { roomId, content } = msg
    const user = this.users.get(userId)
    if (!user || !user.rooms.has(roomId)) return
    
    const message = {
      id: this.generateId(),
      roomId,
      userId,
      content,
      timestamp: Date.now()
    }
    
    // 存储消息
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, [])
    }
    this.messages.get(roomId).push(message)
    
    // 广播给房间内所有人
    this.broadcastToRoom(roomId, {
      type: 'chat',
      message
    })
  }
  
  handleTyping(userId, roomId) {
    // 广播"正在输入"状态（节流）
    this.broadcastToRoom(roomId, {
      type: 'typing',
      userId,
      roomId
    }, userId)
  }
  
  markAsRead(userId, roomId, messageId) {
    // 更新已读状态
    const user = this.users.get(userId)
    if (user) {
      user.lastSeen = Date.now()
      // 通知发送者消息已读
      this.broadcastToRoom(roomId, {
        type: 'read',
        userId,
        roomId,
        messageId
      })
    }
  }
  
  broadcastToRoom(roomId, message, excludeUserId = null) {
    const userIds = this.rooms.get(roomId)
    if (!userIds) return
    
    const data = JSON.stringify(message)
    
    for (const userId of userIds) {
      if (userId === excludeUserId) continue
      
      const user = this.users.get(userId)
      if (user && user.ws.readyState === 1) {
        user.ws.send(data)
      }
    }
  }
  
  handleDisconnect(userId) {
    const user = this.users.get(userId)
    if (!user) return
    
    // 通知所有房间该用户下线
    for (const roomId of user.rooms) {
      this.broadcastToRoom(roomId, {
        type: 'user-left',
        userId,
        roomId
      })
      
      const room = this.rooms.get(roomId)
      if (room) {
        room.delete(userId)
      }
    }
    
    this.users.delete(userId)
  }
  
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  sendUnreadMessages(userId) {
    // 实现离线消息推送
    // ...
  }
}
```

### 5.2 实时协作编辑（OT 算法简介）

```javascript
// 简化的实时协作编辑
class CollaborativeDocument {
  constructor(documentId) {
    this.documentId = documentId
    this.content = ''
    this.version = 0
    this.clients = new Set()
  }
  
  applyOperation(clientId, operation) {
    // OT（Operational Transformation）算法核心
    // 处理并发编辑冲突
    
    if (operation.type === 'insert') {
      const { position, text } = operation
      this.content = 
        this.content.slice(0, position) + 
        text + 
        this.content.slice(position)
    } else if (operation.type === 'delete') {
      const { position, length } = operation
      this.content = 
        this.content.slice(0, position) + 
        this.content.slice(position + length)
    }
    
    this.version++
    
    // 广播给所有客户端
    this.broadcast({
      type: 'operation',
      operation,
      version: this.version,
      content: this.content
    }, clientId)
  }
  
  broadcast(message, excludeClient) {
    const data = JSON.stringify(message)
    for (const client of this.clients) {
      if (client !== excludeClient && client.ws.readyState === 1) {
        client.ws.send(data)
      }
    }
  }
}
```

### 5.3 实时数据推送（股票行情）

```javascript
// 股票行情推送服务
class StockQuoteService {
  constructor() {
    this.subscriptions = new Map() // symbol -> Set<ws>
    this.quotes = new Map() // symbol -> quote
  }
  
  subscribe(ws, symbols) {
    for (const symbol of symbols) {
      if (!this.subscriptions.has(symbol)) {
        this.subscriptions.set(symbol, new Set())
      }
      this.subscriptions.get(symbol).add(ws)
      
      // 立即发送当前行情
      const quote = this.quotes.get(symbol)
      if (quote) {
        ws.send(JSON.stringify({
          type: 'quote',
          symbol,
          ...quote
        }))
      }
    }
  }
  
  unsubscribe(ws, symbols) {
    for (const symbol of symbols) {
      const subscribers = this.subscriptions.get(symbol)
      if (subscribers) {
        subscribers.delete(ws)
      }
    }
  }
  
  // 模拟行情更新（实际应连接数据源）
  startQuoteStream() {
    setInterval(() => {
      for (const [symbol, subscribers] of this.subscriptions) {
        if (subscribers.size === 0) continue
        
        // 模拟行情变化
        const quote = this.generateQuote(symbol)
        this.quotes.set(symbol, quote)
        
        // 推送给订阅者
        const data = JSON.stringify({
          type: 'quote',
          symbol,
          ...quote
        })
        
        for (const ws of subscribers) {
          if (ws.readyState === 1) {
            ws.send(data)
          }
        }
      }
    }, 1000) // 每秒更新
  }
  
  generateQuote(symbol) {
    const lastQuote = this.quotes.get(symbol) || { price: 100 }
    const change = (Math.random() - 0.5) * 2
    const price = lastQuote.price + change
    
    return {
      price: price.toFixed(2),
      change: change.toFixed(2),
      changePercent: ((change / lastQuote.price) * 100).toFixed(2),
      volume: Math.floor(Math.random() * 1000000),
      timestamp: Date.now()
    }
  }
}
```

## 六、安全与性能优化

### 6.1 安全措施

```javascript
import jwt from 'jsonwebtoken'

const wss = new WebSocketServer({
  port: 8080,
  verifyClient: (info, callback) => {
    // 从 URL 或 header 获取 token
    const token = new URL(info.req.url, 'http://localhost')
      .searchParams.get('token')
    
    if (!token) {
      callback(false, 401, 'Unauthorized')
      return
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      info.req.user = decoded
      callback(true)
    } catch (error) {
      callback(false, 401, 'Invalid token')
    }
  }
})

wss.on('connection', (ws, request) => {
  ws.user = request.user
  
  // 速率限制
  ws.messageCount = 0
  ws.lastReset = Date.now()
  
  ws.on('message', (data) => {
    // 每分钟最多 100 条消息
    const now = Date.now()
    if (now - ws.lastReset > 60000) {
      ws.messageCount = 0
      ws.lastReset = now
    }
    
    if (ws.messageCount >= 100) {
      ws.close(1008, 'Rate limit exceeded')
      return
    }
    
    ws.messageCount++
    
    // 消息大小限制
    if (data.length > 1024 * 1024) { // 1MB
      ws.close(1009, 'Message too large')
      return
    }
    
    // 处理消息
    handleMessage(ws, data)
  })
})
```

### 6.2 性能优化

```javascript
// 1. 使用二进制协议
function encodeMessage(type, payload) {
  const encoder = new TextEncoder()
  const typeBytes = new Uint8Array([type])
  const payloadBytes = encoder.encode(JSON.stringify(payload))
  
  const buffer = new Uint8Array(1 + payloadBytes.length)
  buffer.set(typeBytes, 0)
  buffer.set(payloadBytes, 1)
  
  return buffer
}

// 2. 消息压缩（对于大消息）
import zlib from 'zlib'

async function sendCompressed(ws, data) {
  const json = JSON.stringify(data)
  
  if (json.length > 1024) {
    const compressed = await new Promise((resolve, reject) => {
      zlib.deflate(json, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
    
    ws.send(JSON.stringify({
      compressed: true,
      data: compressed.toString('base64')
    }))
  } else {
    ws.send(json)
  }
}

// 3. 连接池管理
class ConnectionPool {
  constructor(maxConnections = 10000) {
    this.connections = new Map()
    this.maxConnections = maxConnections
  }
  
  add(id, ws) {
    if (this.connections.size >= this.maxConnections) {
      // 移除最旧的连接
      const oldest = this.connections.keys().next().value
      const oldWs = this.connections.get(oldest)
      oldWs.close(1001, 'Server overloaded')
      this.connections.delete(oldest)
    }
    
    this.connections.set(id, ws)
  }
  
  remove(id) {
    this.connections.delete(id)
  }
  
  get(id) {
    return this.connections.get(id)
  }
}
```

## 七、生产环境部署

### 7.1 使用 Nginx 代理

```nginx
# nginx.conf
upstream websocket {
  server localhost:8080;
}

server {
  listen 443 ssl;
  server_name example.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location /ws {
    proxy_pass http://websocket;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # 超时设置
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
  }
}
```

### 7.2 健康检查与监控

```javascript
// Prometheus 指标
import { Counter, Gauge, Histogram, register } from 'prom-client'

const connectionsGauge = new Gauge({
  name: 'websocket_connections_active',
  help: '当前活跃连接数'
})

const messagesCounter = new Counter({
  name: 'websocket_messages_total',
  help: '消息总数',
  labelNames: ['type']
})

const messageLatency = new Histogram({
  name: 'websocket_message_latency_seconds',
  help: '消息处理延迟',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
})

// 更新指标
wss.on('connection', (ws) => {
  connectionsGauge.inc()
  
  ws.on('message', (data) => {
    const start = Date.now()
    
    // 处理消息...
    
    const latency = (Date.now() - start) / 1000
    messageLatency.observe(latency)
    messagesCounter.inc({ type: 'chat' })
  })
  
  ws.on('close', () => {
    connectionsGauge.dec()
  })
})

// 暴露指标端点
import express from 'express'
const app = express()

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(9090)
```

## 总结

WebSocket 是实时通信的核心技术，掌握它需要理解：

1. **原理层面**：握手过程、数据帧格式、掩码算法
2. **实战层面**：心跳保活、断线重连、消息队列
3. **架构层面**：房间管理、消息广播、协作算法
4. **安全层面**：身份认证、速率限制、消息校验
5. **性能层面**：连接池、消息压缩、二进制协议

**最佳实践**：
- 始终实现心跳机制检测连接状态
- 使用指数退避策略进行重连
- 服务端做好身份验证和速率限制
- 大消息使用压缩或二进制格式
- 生产环境使用 Nginx 代理和监控

---

*本文由小虾子 🦐 撰写*
