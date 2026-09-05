# WebRTC 实时通信深度解析：从原理到 1v1 视频通话实战

> 你用过的视频会议、语音房、屏幕共享、甚至某些"面对面"客服，背后大概率都站着 WebRTC。它让浏览器在没有插件、不依赖中心服务器转发媒体流的前提下，直接在两个用户之间建立毫秒级的点对点连接。WebSocket 擅长传"消息"，WebRTC 擅长传"画面与声音"。本文从协议原理讲到可运行的 1v1 视频通话，再到生产环境才会踩的坑，一次讲透。

<!-- more -->

## 一、WebRTC 到底是什么，为什么它和 WebSocket 不一样

很多前端同学第一次接触实时通信时，脑子里只有 `WebSocket`。但 WebSocket 本质是**应用层长连接**，所有数据都要经过你的服务器中转。当你要传两路 1080p 视频流时，服务器带宽是按"上行 + 下行 × 用户数"爆炸式增长的。

WebRTC（Web Real-Time Communication）是一组浏览器原生 API，它的目标是：**让两个浏览器直接对话，媒体流（音视频）点对点（P2P）传输，服务器只负责"牵线搭桥"这一小段信令**。

```text
WebSocket / WebTransport 模型：
  浏览器 A ──▶ 服务器 ──▶ 浏览器 B   （所有数据都过服务器）

WebRTC 模型：
  浏览器 A ════════════▶ 浏览器 B    （媒体流直接 P2P）
            │           ▲
            └─ 信令 ─────┘            （仅 SDP/ICE 走服务器）
```

三者的定位差异：

| 维度 | WebSocket | WebTransport | WebRTC |
| --- | --- | --- | --- |
| 传输内容 | 文本/二进制消息 | 可靠的流与数据报 | 音视频轨道 + 任意数据 |
| 连接方式 | 经服务器中转 | 经服务器中转 | 点对点（P2P）直连 |
| 延迟 | 低（但过服务器） | 极低（QUIC） | 最低（直连，无中转） |
| 典型场景 | 聊天、通知、游戏状态 | 高性能数据传输 | 视频通话、屏幕共享、P2P 文件 |
| 是否需要信令服务器 | 否（自己就是服务器） | 否 | 是（仅交换连接信息） |

记住一句话：**WebRTC 不帮你传信令，它只负责在两端连上之后高效地传媒体和数据。** 信令（谁要连谁、用什么编解码、网络地址在哪）需要你自己用 WebSocket 之类的方式传。

## 二、WebRTC 的三大核心 API

整个 WebRTC 的 JS 接口可以浓缩成三个对象，理解了它们就理解了 80%。

### 2.1 MediaStream：音视频的抽象

`MediaStream` 就是"一路媒体"，由若干 `MediaStreamTrack`（轨道）组成——一条音频轨道、一条视频轨道。

```javascript
// 获取摄像头 + 麦克风
const localStream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: {
    echoCancellation: true,   // 回声消除
    noiseSuppression: true,    // 降噪
    autoGainControl: true,     // 自动增益
  },
});

// 把本地画面贴到 <video> 上
const localVideo = document.querySelector('#local');
localVideo.srcObject = localStream;
localVideo.muted = true; // 本地预览一定要静音，否则会听到自己的回声
```

只共享屏幕时：

```javascript
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: { ideal: 15 } },
  audio: false,
});
```

### 2.2 RTCPeerConnection：连接的心脏

这是整个 WebRTC 最重要的对象，代表"与对端的那一条连接"。所有轨道的收发、ICE 候选地址的收集、SDP 的协商，都围绕它进行。

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    // STUN：帮 NAT 后的浏览器发现自己的公网地址，不转发流量
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN：当 P2P 直连失败时，作为中继转发（需要自己部署，见第八节）
    {
      urls: 'turn:turn.example.com:3478',
      username: 'webrtc',
      credential: 'secret',
    },
  ],
});
```

### 2.3 RTCDataChannel：任意数据通道

除了音视频，WebRTC 还能开一条"数据通道"，传文字、JSON、甚至文件分片。它比 WebSocket 更省（不经过你的服务器），且支持可靠/不可靠两种模式。

```javascript
// 发起方创建数据通道
const chatChannel = pc.createDataChannel('chat', {
  ordered: true,        // 可靠、有序（类似 TCP）
  // maxRetransmits: 0 + ordered:false 则是不可靠、最低延迟（类似 UDP）
});

chatChannel.onopen = () => console.log('数据通道已打开');
chatChannel.onmessage = (e) => console.log('收到:', e.data);
chatChannel.send('你好，对面！');

// 接收方监听
pc.ondatachannel = (e) => {
  const channel = e.channel;
  channel.onmessage = (ev) => console.log('收到对面消息:', ev.data);
};
```

## 三、信令（Signaling）：WebRTC 把最难也最灵活的部分留给了你

WebRTC 标准刻意**不规定信令协议和传输方式**。为什么？因为不同场景差异太大：你想用 WebSocket、Socket.IO、甚至 MQTT 都行；你想自己设计房间、鉴权、广播逻辑也行。

信令服务器只干一件事：**把一端产生的连接信息，可靠地转发给另一端**。要转发两类信息：

1. **SDP（Session Description Protocol）**：描述"我要支持的编解码、分辨率、传输参数"。
2. **ICE Candidate**：描述"我这个设备能用来通信的网络地址（可能有多个）"。

下面是一个最小化的 Node.js 信令服务器（基于 `ws`），逻辑是"两个客户端连上来，互相转发消息"：

```javascript
// server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
let peers = [];

wss.on('connection', (ws) => {
  peers.push(ws);
  // 只支持 2 人房间：第三个人加入时通知满员
  if (peers.length > 2) {
    ws.send(JSON.stringify({ type: 'room-full' }));
    ws.close();
    return;
  }

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    // 把消息转发给"另一个"客户端
    const other = peers.find((p) => p !== ws);
    if (other) other.send(raw);
  });

  ws.on('close', () => {
    peers = peers.filter((p) => p !== ws);
  });
});

console.log('信令服务器运行在 ws://localhost:8080');
```

## 四、连接建立的完整流程：SDP 协商 + ICE 收集

### 4.1 SDP：描述"我们怎么聊"

SDP 不是 WebRTC 独有的，它是个标准文本格式。在 WebRTC 里，连接建立靠"提议（Offer）/ 应答（Answer）"两轮交换：

1. **发起方** 调用 `createOffer()` 生成 Offer SDP，`setLocalDescription(offer)` 存本地，`send(offer)` 给对端。
2. **接收方** `setRemoteDescription(offer)` 认下对面的能力，再 `createAnswer()` 生成 Answer，`setLocalDescription(answer)`，`send(answer)` 回去。
3. **发起方** `setRemoteDescription(answer)`。两边都进入 `stable` 状态，SDP 协商完成。

```javascript
// 发起方
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
signal({ description: pc.localDescription }); // 通过 WebSocket 发给对端

// 接收方
pc.onmessage_signal = async ({ description }) => {
  await pc.setRemoteDescription(description); // 认下对方的 SDP
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  signal({ description: pc.localDescription });
};
```

> 现代浏览器（2021+）支持 `setLocalDescription()` **不带参数**，它会自动按当前状态生成 offer 或 answer，代码更简洁。本文第七节"完美协商"就用这种写法。

### 4.2 ICE：发现彼此的真实网络地址

现实网络里，大多数设备都在 NAT/防火墙后面，没有固定的公网 IP。ICE（Interactive Connectivity Establishment）负责"找出所有能用的通信地址"，然后两端互相试探，选出一条能通的。

候选地址（Candidate）分三种：

```text
host（主机候选）   ：本机内网地址，如 192.168.1.10 —— 同一局域网内直接连
srflx（反射候选）  ：STUN 帮发现的公网地址，如 203.0.113.5 —— 多数情况够用
relay（中继候选）  ：TURN 服务器地址 —— 直连彻底失败时的兜底
```

收集过程是"边协商边上报"的（Trickle ICE）：

```javascript
// 每当发现一个新候选地址，就通过信令发给对端
pc.onicecandidate = (event) => {
  if (event.candidate) {
    signal({ candidate: event.candidate });
  }
};

// 收到对端的候选地址，加入连接
async function onRemoteCandidate(candidate) {
  try {
    await pc.addIceCandidate(candidate);
  } catch (err) {
    console.error('添加候选失败', err);
  }
}
```

### 4.3 完整时序（文字版）

```text
  发起方 A                          信令服务器                       接收方 B
     │                                 │                               │
     │── createOffer() ───────────────▶│                               │
     │── setLocalDescription(offer) ──▶│── 转发 offer ───────────────▶│
     │                                 │                               │ setRemoteDescription(offer)
     │                                 │                               │ createAnswer()
     │                                 │◀── 转发 answer ───────────────│ setLocalDescription(answer)
     │◀── 转发 answer ────────────────│                               │
setRemoteDescription(answer)           │                               │
     │                                 │                               │
     │════ ICE 候选互相转发（Trickle）══│═══════════════════════════════│
     │                                 │                               │
     │════════════ 建立 P2P 直连，开始传音视频 ═══════════════════════│
```

## 五、实战：手写一个 1v1 视频通话

光讲原理不够，下面是一份**能直接跑**的最小实现。

### 5.1 前端 HTML

```html
<!-- index.html -->
<video id="local" autoplay playsinline muted></video>
<video id="remote" autoplay playsinline></video>
<button id="call">开始通话</button>
<script type="module" src="./client.js"></script>
```

### 5.2 前端逻辑 client.js

```javascript
const localVideo = document.querySelector('#local');
const remoteVideo = document.querySelector('#remote');
const callBtn = document.querySelector('#call');

// 1. 连接信令服务器
const ws = new WebSocket('ws://localhost:8080');

let pc; // RTCPeerConnection，延迟到"开始通话"再建

// 收到对端消息
ws.onmessage = async (e) => {
  const msg = JSON.parse(e.data);

  if (msg.description) {
    // 对方发来 SDP
    await pc.setRemoteDescription(msg.description);
    if (msg.description.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ description: pc.localDescription }));
    }
  } else if (msg.candidate) {
    // 对方发来 ICE 候选
    try { await pc.addIceCandidate(msg.candidate); } catch (err) { console.error(err); }
  }
};

function createPeerConnection() {
  const connection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  // 关键：收到对方媒体轨道时，挂到 remote video 上
  connection.ontrack = (event) => {
    // event.streams[0] 才是完整的一路媒体流
    remoteVideo.srcObject = event.streams[0];
  };

  // 把本地发现的候选地址发给对端
  connection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ candidate: event.candidate }));
    }
  };

  return connection;
}

callBtn.onclick = async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true, audio: true,
  });
  localVideo.srcObject = localStream;

  pc = createPeerConnection();
  // 把本地每一路轨道加进连接（音频轨道 + 视频轨道）
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // 作为发起方，生成 offer 并发出
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ description: pc.localDescription }));
};
```

### 5.3 跑起来

```bash
npm init -y
npm install ws
node server.js          # 信令服务器
# 用任意静态服务器托管 index.html 和 client.js，例如：
npx serve .
```

用两个浏览器标签（或两台设备，注意 HTTPS/localhost 才能用摄像头）打开页面，一个先点"开始通话"生成 offer，另一个再点加入，就能看到双向画面了。

### 5.4 两个最容易翻车的细节

**① `ontrack` 被触发两次**：因为本地加了"音频 + 视频"两条轨道，`ontrack` 会分别触发两次。但**不要**在 `ontrack` 里反复 `new MediaStream()` 覆盖，正确做法是直接挂 `event.streams[0]`（浏览器已经帮你把同源轨道归到同一个 stream 里了）。

**② 自动播放被浏览器拦截**：`remoteVideo` 必须加 `playsinline` 和 `autoplay`，且**不能** `muted`（只有本地预览才需要静音）。Chrome 对"有声视频自动播放"有限制，确保用户点过按钮（有用户手势）再建立连接即可绕过。

## 六、完美协商（Perfect Negotiation）：解决"两边同时报价"的冲突

真实业务里，两端可能因为"网络变化"（比如插上耳机触发重新协商）在同一时刻都想发 Offer，这叫 **glare（ glare 冲突）**。WebRTC 官方给出的标准解法是"完美协商模式"：约定一端是 polite（礼貌方），一端是 impolite（强硬方），冲突时礼貌方退让。

```javascript
let makingOffer = false;
let ignoreOffer = false;
let isSettingRemoteAnswerPending = false;

const polite = /* 由信令服务器分配，比如按连接顺序：第一个进房为 false */ false;

// 任何需要重新协商的事件（加轨道、换设备）都会触发它
pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true;
    await pc.setLocalDescription(); // 无参：自动生成 offer
    signal({ description: pc.localDescription });
  } catch (err) {
    console.error(err);
  } finally {
    makingOffer = false;
  }
};

pc.onicecandidate = ({ candidate }) => signal({ candidate });

// 收到对端信令
async function onSignal({ description, candidate }) {
  try {
    if (description) {
      const offerCollision =
        description.type === 'offer' &&
        (makingOffer || pc.signalingState !== 'stable');

      ignoreOffer = !polite && offerCollision;
      if (ignoreOffer) return; // 强硬方：直接忽略对方的 offer

      await pc.setRemoteDescription(description); // 礼貌方：回滚自己的 offer 再接收
      if (description.type === 'offer') {
        await pc.setLocalDescription(); // 自动生成 answer
        signal({ description: pc.localDescription });
      }
    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOffer) throw err; // 礼貌方在回滚期间忽略候选错误
      }
    }
  } catch (err) {
    console.error(err);
  }
}
```

这段代码是 WebRTC 官方示例的精炼版，能正确处理 99% 的并发协商场景。写实时通信，**直接抄这一段**比自己造轮子稳得多。

## 七、RTCDataChannel 实战：实时文字 + 文件传输

在视频通话基础上叠加一条数据通道，就能做"边聊边传文件"。关键点是**文件要分片**——单条 `send()` 有大小上限（建议每片 16KB~64KB），而且要用 `bufferedAmountLow` 事件做背压，否则大文件会撑爆缓冲区。

```javascript
// 建立连接后，发起方创建通道
const fileChannel = pc.createDataChannel('file', { ordered: true });

// 发送端：分片发送文件
function sendFile(file, channel) {
  const CHUNK = 16 * 1024; // 16KB
  const reader = file.stream().getReader();
  let offset = 0;

  channel.bufferedAmountLowThreshold = 1 * 1024 * 1024; // 1MB 阈值

  async function pump() {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        channel.send(JSON.stringify({ type: 'eof', name: file.name }));
        return;
      }
      // 背压：缓冲区快满就等它降下来
      if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
        await new Promise((r) => channel.addEventListener('bufferedamountlow', r, { once: true }));
      }
      channel.send(value); // value 是 Uint8Array 分片
      offset += value.length;
      updateProgress(offset / file.size);
    }
  }
  pump();
}

// 接收端：拼接分片
pc.ondatachannel = (e) => {
  const channel = e.channel;
  const chunks = [];
  channel.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      const meta = JSON.parse(ev.data);
      if (meta.type === 'eof') {
        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
        // 触发下载
        const a = document.createElement('a');
        a.href = url; a.download = meta.name; a.click();
        chunks.length = 0;
      }
    } else {
      chunks.push(ev.data); // 二进制分片
    }
  };
};
```

> 提示：`file.stream()` 是现代浏览器 API；若需兼容老浏览器，用 `file.arrayBuffer()` 切片再 `send()` 同样可行。

## 八、TURN 与 NAT 穿透的残酷现实

很多初学者以为"加了 STUN 就能连上所有人"，上线后才发现：**大约 10%~20% 的用户根本无法 P2P 直连**（对称型 NAT、企业防火墙、严格住宅网关）。这时候必须上 **TURN 服务器做中继**——流量由你的服务器转发，带宽成本又回来了，但至少能连上。

自建 TURN 最常用 `coturn`：

```bash
# 安装（Ubuntu）
sudo apt install coturn

# /etc/turnserver.conf 关键配置
listening-port=3478
tls-listening-port=5349
relay-ip=你的内网IP
external-ip=你的公网IP
user=webrtc:secret
realm=turn.example.com
# 长期凭证，防止被当免费代理
lt-cred-mech
```

然后在 `RTCPeerConnection` 的 `iceServers` 里加上它。生产环境建议：

- **STUN + TURN 一起配**，让浏览器优先直连、失败再中继；
- TURN 强制鉴权，否则你的服务器会被当成免费中转被刷爆；
- 全球多节点 TURN（或用 Twilio、Xirsys 等商用服务）降低跨国延迟。

## 九、性能与体验优化技巧

视频通话卡顿，八成不是代码错，而是参数没调。这几招立竿见影：

**① 动态限速**：网络差时主动降码率，比"卡死"体验好。

```javascript
const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
const params = sender.getParameters();
if (!params.encodings) params.encodings = [{}];
params.encodings[0].maxBitrate = 800_000; // 800 kbps
await sender.setParameters(params);
```

**② Simulcast（联播）**：同时发 180p/360p/720p 三档，让接收方按自己的能力选，适合一对多直播。

```javascript
params.encodings = [
  { maxBitrate: 200_000, scaleResolutionDownBy: 4 }, // 小窗
  { maxBitrate: 500_000, scaleResolutionDownBy: 2 }, // 中窗
  { maxBitrate: 1_500_000, scaleResolutionDownBy: 1 }, // 大窗
];
await sender.setParameters(params);
```

**③ 用 `getStats()` 做监控**：实时拿到帧率、丢包、RTT，驱动上面的动态策略。

```javascript
setInterval(async () => {
  const stats = await pc.getStats();
  stats.forEach((report) => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      console.log(`帧率: ${report.framesPerSecond}, 丢包: ${report.packetsLost}`);
    }
  });
}, 1000);
```

**④ 网络切换无缝恢复**：监听 `pc.oniceconnectionstatechange`，当状态变为 `disconnected` 时尝试 `restartIce()`，让移动端切 WiFi/5G 不中断通话。

## 十、常见坑与排查清单

| 现象 | 根因 | 解法 |
| --- | --- | --- |
| 拿不到摄像头 | 非 HTTPS/localhost、用户拒绝权限 | 用 `https` 或 `localhost` 部署；捕获 `NotAllowedError` 友好提示 |
| 只有一方有画面 | `addTrack` 顺序/`ontrack` 用法错 | 两端都要 `addTrack`；接收方挂 `event.streams[0]` |
| 一直 `checking` 连不上 | 对称 NAT 且无 TURN | 配置 TURN 中继 |
| 画面卡顿/马赛克 | 码率超带宽 | `setParameters` 降 `maxBitrate` |
| 自动播放黑屏 | 浏览器策略拦截有声视频 | `autoplay playsinline` + 用户手势触发 |
| ICE 失败 `failed` | 防火墙阻断 UDP | 确认 TURN 可用、端口放行 |

**终极调试工具**：浏览器打开 `chrome://webrtc-internals`（Chrome）或 `about:webrtc`（Firefox），能看到每一次 SDP 交换、每个 ICE 候选、码率曲线，是定位问题的"显微镜"。

## 十一、2026 年的 WebRTC：正在发生的演进

WebRTC 仍在进化，几个值得关注的方向：

- **WebRTC NV（Next Version）**：把可插入流（Insertable Streams）标准化，让你能在编码后、发送前对帧做端到端加密（E2EE）或 AI 处理；
- **SFrame**：面向 WebRTC 的端到端加密标准，配合 Insertable Streams 实现"服务器也看不到内容"的隐私通话；
- **与 WebCodecs / WebGPU 打通**：用 WebCodecs 拿到原始帧、用 WebGPU 做实时美颜/虚拟背景，再把处理完的帧塞回 WebRTC 发送，把"滤镜"从服务端搬到客户端。

## 总结

WebRTC 看似吓人，但拆开就是三件事：**MediaStream 拿媒体、RTCPeerConnection 建连接、RTCDataChannel 传数据**。难点不在 API，而在"信令怎么设计、NAT 怎么穿透、弱网怎么兜底"——这恰恰是生产环境和玩具 demo 的分水岭。

回顾本文主线：

1. 用 `getUserMedia` 拿到音视频，理解 `MediaStream`；
2. 用 `RTCPeerConnection` + 自建 WebSocket 信令，完成 SDP 与 ICE 的 Offer/Answer 交换；
3. 套用**完美协商**模式，扛住并发重协商；
4. 用 `RTCDataChannel` 顺手把文字聊天和文件传输也做了；
5. 真上线时，别忘了 **TURN 中继**和 `getStats` 动态调优。

当你第一次看到两个浏览器窗口里出现彼此的脸，那种"数据真的点对点飞过去了"的爽感，就是 WebRTC 最迷人的地方。

*本文由小虾子 🦐 撰写*
