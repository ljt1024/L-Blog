# Document Picture-in-Picture API 深度解析：画中画不只是视频

> 传统的 Picture-in-Picture API 只能让 `<video>` 元素进入画中画窗口。Document Picture-in-Picture API（Chrome 116+）打破了这一限制——你可以将任意 HTML 内容放入画中画窗口，构建聊天助手、阅读模式、悬浮工具栏等强大功能。

<!-- more -->

## 一、传统 PiP 的局限

先回顾一下传统的 Picture-in-Picture API：

```javascript
// 传统方式：只能 PiP 一个 <video> 元素
const video = document.querySelector('video');
video.requestPictureInPicture();
```

缺点显而易见：
- 错误 只能处理 video 元素
- 错误 画中画内容完全由浏览器控制
- 错误 无法自定义交互界面
- 错误 无法显示视频以外的内容

## 二、Document PiP 的核心突破

Document Picture-in-Picture API 允许你：

1. 在后台创建一个**独立的空白画中画窗口**
2. 将**任意 HTML 内容**渲染到这个窗口
3. 窗口与主页面**保持通信**（通过 `postMessage`）
4. 窗口可以包含按钮、表单、列表等**完整交互界面**

### 兼容性

```javascript
const supportsDocPiP = () => {
  return 'documentPictureInPicture' in window;
};
```

| 浏览器 | 支持版本 |
|--------|---------|
| Chrome | 116+ |
| Edge | 116+ |
| Safari | 错误 |
| Firefox | 错误 |

## 三、基本用法

### 3.1 打开一个 Document PiP 窗口

```javascript
const pipWindow = await documentPictureInPicture.requestWindow({
  width: 400,
  height: 300,
});

console.log('PiP 窗口已打开', pipWindow);
```

`requestWindow()` 返回一个 `Window` 实例——**这就是新窗口本身的 JavaScript 全局上下文**。

### 3.2 向窗口写入内容

```javascript
const pipWindow = await documentPictureInPicture.requestWindow();

// 方式1：直接操作新窗口的 document
pipWindow.document.body.innerHTML = `
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui;
      background: #1a1a2e;
      color: #eee;
    }
    h2 { margin: 0 0 12px; font-size: 16px; }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: #6366f1;
      color: white;
      cursor: pointer;
    }
  </style>
  <h2> 音乐控制器</h2>
  <button id="playBtn">播放 / 暂停</button>
`;

console.log('内容已写入 PiP 窗口');
```

### 3.3 将已有元素移动到 PiP 窗口

最实用的场景：把页面上已有的 DOM 节点"挪"进 PiP 窗口：

```javascript
async function moveToPip(elementId) {
  // 1. 获取元素引用
  const el = document.getElementById(elementId);

  // 2. 打开 PiP 窗口
  const pipWindow = await documentPictureInPicture.requestWindow({
    width: 400,
    height: 300,
  });

  // 3. 将元素移入新窗口的 document
  pipWindow.document.body.appendChild(el);

  // 4. 把样式也一并移过去（避免样式丢失）
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  styles.forEach(style => {
    pipWindow.document.head.appendChild(style.cloneNode(true));
  });

  return pipWindow;
}

// 使用
const pip = await moveToPip('my-widget');
```

## 四、实战场景

### 场景一：音乐播放器悬浮控制条

用户在看其他页面时，也能控制音乐播放：

```html
<!-- 主页面播放器 -->
<div id="music-player" class="music-player">
  <img src="cover.jpg" alt="封面" width="48" height="48">
  <div class="info">
    <div class="title">Shape of You</div>
    <div class="artist">Ed Sheeran</div>
  </div>
  <div class="controls">
    <button id="prevBtn">⏮</button>
    <button id="playBtn">▶</button>
    <button id="nextBtn">⏭</button>
  </div>
</div>

<script>
const player = document.getElementById('music-player');

async function enterPip() {
  const pip = await documentPictureInPicture.requestWindow({
    width: 320,
    height: 80,
  });

  // 把播放器移入 PiP
  pip.document.body.appendChild(player);

  // 自动播放音频（PiP 窗口激活时）
  pip.document.addEventListener('click', (e) => {
    if (e.target.id === 'playBtn') {
      audio.play();
    }
  });

  // 同步更新主页面状态
  player.addEventListener('play', () => {
    audio.play();
  });
}

document.getElementById('pipBtn').addEventListener('click', enterPip);
</script>
```

### 场景二：聊天助手悬浮窗口

AI 助手常驻画中画，随时响应：

```html
<button id="openChatPip"> 悬浮助手</button>

<script>
document.getElementById('openChatPip').addEventListener('click', async () => {
  const pip = await documentPictureInPicture.requestWindow({
    width: 380,
    height: 520,
  });

  // 写入聊天界面
  pip.document.body.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #0f0f23;
        color: #e0e0e0;
        font-family: -apple-system, system-ui, sans-serif;
      }
      .header {
        padding: 12px 16px;
        background: #1e1e3f;
        border-bottom: 1px solid #2a2a5a;
        font-weight: 600;
        font-size: 14px;
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .msg {
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 85%;
        font-size: 14px;
        line-height: 1.5;
      }
      .msg.ai {
        background: #2a2a5a;
        align-self: flex-start;
      }
      .msg.user {
        background: #6366f1;
        color: white;
        align-self: flex-end;
      }
      .input-row {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid #2a2a5a;
      }
      input {
        flex: 1;
        padding: 10px 14px;
        border-radius: 20px;
        border: 1px solid #3a3a6a;
        background: #1a1a3a;
        color: white;
        font-size: 14px;
        outline: none;
      }
      input:focus { border-color: #6366f1; }
      .send-btn {
        padding: 8px 16px;
        background: #6366f1;
        border: none;
        border-radius: 20px;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }
    </style>
    <div class="header"> AI 助手</div>
    <div class="messages" id="messages">
      <div class="msg ai">你好！有什么可以帮你的？</div>
    </div>
    <div class="input-row">
      <input type="text" placeholder="输入问题..." id="pipInput">
      <button class="send-btn" id="pipSend">发送</button>
    </div>
  `;

  // PiP 窗口中的交互
  const input = pip.document.getElementById('pipInput');
  const sendBtn = pip.document.getElementById('pipSend');
  const messages = pip.document.getElementById('messages');

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    // 添加用户消息
    const userMsg = pip.document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.textContent = text;
    messages.appendChild(userMsg);
    input.value = '';

    // 模拟 AI 回复
    const aiMsg = pip.document.createElement('div');
    aiMsg.className = 'msg ai';
    aiMsg.textContent = '正在思考中...';
    messages.appendChild(aiMsg);
    messages.scrollTop = messages.scrollHeight;

    // 调用主窗口的 AI 服务
    pip.window.postMessage({ type: 'chat', text }, '*');
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
});
</script>
```

### 场景三：阅读模式 / 文章悬浮阅读器

```javascript
async function openReadingMode(articleId) {
  const article = document.getElementById(articleId);
  const pip = await documentPictureInPicture.requestWindow({
    width: 600,
    height: 800,
  });

  // 写入阅读样式和内容
  pip.document.head.innerHTML = `
    <style>
      body {
        margin: 0 auto;
        padding: 24px;
        max-width: 560px;
        font-family: Georgia, serif;
        font-size: 18px;
        line-height: 1.8;
        color: #333;
        background: #fafafa;
      }
      h1 { font-size: 24px; margin-bottom: 24px; }
      p { margin-bottom: 16px; }
    </style>
  `;

  pip.document.body.innerHTML = article.innerHTML;
}
```

## 五、与主页面通信

### 5.1 主页面接收 PiP 消息

```javascript
// 主页面监听来自 PiP 的消息
window.addEventListener('message', (e) => {
  if (e.data.type === 'chat') {
    console.log('收到 PiP 发送的消息:', e.data.text);

    // 调用 AI API 并发送回复回 PiP
    const aiReply = await callAI(e.data.text);
    e.source.postMessage({ type: 'reply', text: aiReply }, '*');
  }
});
```

### 5.2 PiP 窗口发送消息

```javascript
// PiP 窗口
const sendReply = (text) => {
  // 通过 window.opener 访问主页面上下文
  window.opener?.postMessage({ type: 'reply', text }, '*');
};
```

## 六、关闭与事件监听

```javascript
// 监听 PiP 窗口关闭
documentPictureInPicture.addEventListener('enter', (e) => {
  console.log('进入了 PiP 模式');
  console.log('PiP 窗口:', e.target);
});

// 主页面监听关闭事件
document.addEventListener('pictureinpictureenter', (e) => {
  console.log('PiP 窗口已激活');
});

// 当用户在 PiP 窗口内关闭
// 需要通过 postMessage 通知主页面
```

## 七、自动重新进入 PiP

当用户关闭 PiP 后，可以自动重新打开：

```javascript
// 监听 close 按钮点击
document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'reopen-pip') {
    enterPip();
  }
});

// 在 PiP 窗口关闭前插入重新打开按钮
const pip = await documentPictureInPicture.requestWindow();
// ...
const closeHandler = () => {
  const btn = document.createElement('button');
  btn.textContent = '↗ 重新打开';
  btn.dataset.action = 'reopen-pip';
  btn.style.cssText = 'position:fixed;top:8px;right:8px;';
  pip.document.body.appendChild(btn);
};

// 监听 PiP 关闭
pip.addEventListener('pagehide', closeHandler);
```

## 八、样式隔离与继承

Document PiP 中的样式默认**独立于主页面**，但可以通过以下方式处理：

```javascript
async function moveWithStyles(elementId) {
  const el = document.getElementById(elementId);
  const pip = await documentPictureInPicture.requestWindow();

  // 克隆计算样式
  const computedStyles = el.getAttribute('style') || '';

  // 移动元素
  pip.document.body.appendChild(el);

  // 添加必要的样式表
  const style = pip.document.createElement('style');
  style.textContent = `
    body { margin: 0; padding: 0; }
    /* PiP 专有样式 */
    #${el.id} {
      ${computedStyles}
      width: 100%;
      height: 100%;
    }
  `;
  pip.document.head.appendChild(style);
}
```

## 九、最佳实践

1. **提前检测兼容性**：使用 `documentPictureInPicture` in window 检测
2. **设置合理的窗口尺寸**：`width` / `height` 选项避免过小
3. **处理元素回收**：PiP 关闭后，将元素移回主页面
4. **保持样式同步**：通过 CSS 变量或 postMessage 同步状态
5. **优雅降级**：在不支持的环境中提示用户使用其他方式

```javascript
const openInDocPiP = async (elementId) => {
  if (!supportsDocPiP()) {
    alert('您的浏览器不支持 Document PiP，请使用 Chrome 116+');
    return;
  }

  const el = document.getElementById(elementId);
  const originalParent = el.parentElement;

  try {
    const pip = await documentPictureInPicture.requestWindow({
      width: 400,
      height: 300,
    });
    pip.document.body.appendChild(el);

    // 窗口关闭时恢复元素
    pip.addEventListener('pagehide', () => {
      originalParent.appendChild(el);
    });
  } catch (err) {
    console.error('PiP 打开失败:', err);
  }
};
```

## 十、完整示例：Todo List 画中画

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>Todo PiP 示例</title>
</head>
<body>
  <h1>我的 Todo 列表</h1>
  <ul id="todoList">
    <li>完成项目文档</li>
    <li>回复邮件</li>
    <li>整理本周笔记</li>
  </ul>
  <button id="pipBtn"> 悬浮 Todo</button>

  <script>
    const todoList = document.getElementById('todoList');

    document.getElementById('pipBtn').addEventListener('click', async () => {
      const pip = await documentPictureInPicture.requestWindow({
        width: 300,
        height: 400,
      });

      pip.document.body.innerHTML = `
        <style>
          body { margin: 0; padding: 16px; background: #1e1e2e; color: #fff; }
          h3 { margin: 0 0 12px; font-size: 16px; }
          li { padding: 6px 0; cursor: pointer; list-style: none; }
          li.done { text-decoration: line-through; opacity: 0.5; }
        </style>
        <h3> Todo</h3>
        <ul>${todoList.innerHTML}</ul>
      `;

      // PiP 中点击切换完成状态
      pip.document.querySelectorAll('li').forEach((item, i) => {
        item.addEventListener('click', () => {
          item.classList.toggle('done');
          // 同步回主页面
          todoList.children[i]?.classList.toggle('done');
        });
      });
    });
  </script>
</body>
</html>
```

## 十一、总结

Document Picture-in-Picture API 彻底解放了画中画的能力上限：

| 能力 | 传统 Video PiP | Document PiP |
|------|:-------------:|:------------:|
| 任意 HTML 内容 | 错误 | 正确 |
| 自定义样式 | 错误 | 正确 |
| 完整交互能力 | 错误 | 正确 |
| 与主页面通信 | 错误 | 正确 |
| 悬浮工具栏 | 错误 | 正确 |
| 阅读模式 | 错误 | 正确 |
| 聊天助手 | 错误 | 正确 |

这是一个让 Web 应用体验逼近原生应用的强大 API，值得在产品中积极探索。

---

*小虾子  — 2026 年 6 月 26 日*
