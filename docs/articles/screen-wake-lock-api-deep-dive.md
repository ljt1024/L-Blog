# Screen Wake Lock API 深度解析：防止屏幕熄灭的浏览器原生方案

> 你有没有遇到过这种情况：用浏览器做一个实时数据大屏，投屏到会议室的电视上，结果 5 分钟后电视熄灭了——因为电视检测到"没有用户操作"就自动进入待机。传统方案是写一个 JS `setInterval` 每秒模拟一次点击，但这会让页面无法进入低功耗状态，性能浪费。**Screen Wake Lock API** 是浏览器的原生解决方案：告诉系统"这个页面需要屏幕保持亮着"，由浏览器统一处理，零 hack，零性能浪费。本文深入讲解其用法、生命周期、与 Page Visibility API 的协作，以及实际应用场景。

## 一、Wake Lock 是什么？

### 1.1 问题背景

浏览器标签页在以下情况下会自动熄灭屏幕或关闭显示器：

```
用户操作 → 5~30 分钟无操作 → 系统判定"用户离开了" → 屏幕熄灭/显示器进入待机
```

对于**非交互式内容展示场景**，这是个大问题：

| 场景 | 痛点 |
|------|------|
| 投屏大屏数据看板 | 5 分钟后屏幕熄灭，数据看不到了 |
| 实时监控仪表盘 | 需要持续展示，但无用户交互 |
| 视频通话应用 | 通话期间屏幕不应该熄灭 |
| 在线烹饪教程 | 用户跟着做菜，手是湿的，无法触屏 |
| 电子书阅读器 | 阅读时不应因无操作而熄屏 |
| 音乐播放器（浏览器端） | 切歌不需要亮屏，但播放进度条需要 |

### 1.2 传统方案的缺陷

```javascript
// ❌ 方案1：setInterval 空调用（性能浪费）
let wakeLockInterval = setInterval(() => {
  document.body.style.opacity = '0.999';   // 微小可见变化，骗过检测
  setTimeout(() => { document.body.style.opacity = '1'; }, 50);
}, 30000);   // 每 30 秒调用一次

// 问题：
// 1. 页面进入后台时 setInterval 会停止（浏览器优化）
// 2. 即使页面不可见仍在消耗 CPU
// 3. 部分电视/设备会忽略这种 hack

// ❌ 方案2：用户点击开始时锁定（交互式）
// 问题：用户必须持续操作，无法自动保持

// ❌ 方案3：浏览器扩展
// 问题：用户需要安装扩展，无法在生产环境使用
```

### 1.3 Screen Wake Lock API 的优势

```javascript
// ✅ Screen Wake Lock API（原生解决方案）
async function requestWakeLock() {
  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    console.log('屏幕已锁定，电视不会熄灭了');
    
    // 监听释放
    wakeLock.addEventListener('release', () => {
      console.log('Wake Lock 已释放');
    });
    
    return wakeLock;
  } catch (err) {
    console.error(`Wake Lock 获取失败: ${err.message}`);
  }
}

// 页面可见性变化时自动重新获取（关键！）
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await requestWakeLock();   // 页面重新可见时重新获取 Wake Lock
  }
});
```

**核心优势：**

1. **系统级**：由浏览器向操作系统申请，不是页面的 hack
2. **零性能浪费**：只在需要时申请，不消耗 CPU
3. **自动释放**：页面隐藏时自动释放，页面恢复时自动重新申请
4. **标准化**：W3C 标准 API，主流浏览器全部支持

## 二、基本用法

### 2.1 请求 Screen Wake Lock

```javascript
// 基础用法
async function enableWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('当前浏览器不支持 Screen Wake Lock API');
    return;
  }
  
  const wakeLock = await navigator.wakeLock.request('screen');
  
  // 监听 release 事件
  wakeLock.addEventListener('release', (e) => {
    console.log('Wake Lock 已释放', e.target.releaseReason);
    // releaseReason: 'release' | 'hidden' | 'error'
  });
  
  console.log('✅ 屏幕常亮已开启');
  return wakeLock;
}

// 在需要时调用（例如：用户点击"开始演示"按钮）
startBtn.addEventListener('click', async () => {
  const lock = await enableWakeLock();
  startPresentation();
});
```

### 2.2 释放 Wake Lock

```javascript
async function disableWakeLock(wakeLock) {
  if (!wakeLock) return;
  await wakeLock.release();
  wakeLock = null;
  console.log('屏幕常亮已关闭');
}

// 示例：用户点击退出按钮
exitBtn.addEventListener('click', async () => {
  await disableWakeLock(currentWakeLock);
  endPresentation();
});
```

### 2.3 检测支持情况

```javascript
function supportsWakeLock() {
  return 'wakeLock' in navigator && 'request' in navigator.wakeLock;
}

// 带降级的完整检查
async function requestWakeLockWithFallback() {
  if (!supportsWakeLock()) {
    console.warn('浏览器不支持 Wake Lock，使用 setInterval fallback');
    startIntervalHack();
    return null;
  }
  
  try {
    return await navigator.wakeLock.request('screen');
  } catch (err) {
    // 某些情况下会被拒绝（如页面已在后台）
    console.warn(`Wake Lock 请求失败: ${err.name} - ${err.message}`);
    return null;
  }
}
```

## 三、Wake Lock 生命周期

### 3.1 自动释放与重新获取

**Wake Lock 会在以下情况自动释放：**

| 触发条件 | 说明 |
|---------|------|
| 页面进入后台 | 切换标签页、最小化窗口 |
| 页面被卸载 | 用户关闭标签页、刷新页面 |
| 电池电量低 | 系统节电模式激活 |
| 系统休眠 | 电脑进入睡眠状态 |
| Wake Lock 对象被 GC | 失去引用后可能自动释放 |

**最重要的行为：页面从后台恢复时，必须手动重新申请！**

```javascript
class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.init();
  }
  
  async init() {
    // 初始化时请求
    await this.acquire();
    
    // 页面可见性变化时重新获取
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.acquire();   // 页面恢复可见时重新申请
      }
    });
    
    // 页面卸载时释放
    window.addEventListener('beforeunload', () => {
      this.release();
    });
  }
  
  async acquire() {
    if (!supportsWakeLock()) return;
    if (this.wakeLock?.released === false) return;  // 已有有效锁
    
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        console.log('Wake Lock 释放原因:', this.wakeLock.releaseReason);
      });
      console.log('✅ Wake Lock 已获取');
    } catch (err) {
      console.error('获取 Wake Lock 失败:', err);
    }
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('🔓 Wake Lock 已释放');
    }
  }
  
  isActive() {
    return this.wakeLock?.released === false;
  }
}

// 使用
const wakeLockManager = new WakeLockManager();
```

### 3.2 多标签页场景

Wake Lock 在不同标签页之间**不共享**——每个标签页需要单独申请。但同一个标签页中的多个组件可以共享同一个 WakeLockManager：

```javascript
// 在大屏应用中，多个组件可能都想申请 Wake Lock
// 方案：使用单例 Manager，只请求一次
const globalWakeLock = new WakeLockManager();

// Dashboard 组件
class Dashboard {
  constructor() {
    this.wakeLock = null;
  }
  
  async start() {
    // 获取全局 Wake Lock 的引用
    this.wakeLock = await navigator.wakeLock.request('screen');
  }
}

// ControlPanel 组件
class ControlPanel {
  async togglePresentation() {
    if (this.isPresenting) {
      // 释放 Wake Lock
      globalWakeLock.release();
    } else {
      // 获取 Wake Lock
      await globalWakeLock.acquire();
    }
  }
}
```

### 3.3 releaseReason 详解

```javascript
navigator.wakeLock.request('screen').then(wakeLock => {
  wakeLock.addEventListener('release', (e) => {
    switch (e.target.releaseReason) {
      case 'release':
        console.log('手动 release() 调用');
        break;
      case 'hidden':
        console.log('页面进入后台（visibilitychange）');
        break;
      case 'error':
        console.log('系统级错误，例如电池电量低');
        break;
      default:
        console.log('未知原因释放');
    }
  });
});
```

## 四、与 Page Visibility API 的协作

### 4.1 完整集成：数据看板场景

```javascript
class DashboardWakeLock {
  constructor() {
    this.wakeLock = null;
    this.presentationId = null;
  }
  
  async startPresentation() {
    // 仅在屏幕方向为横向时申请（适合投屏）
    if (screen.orientation?.type.includes('landscape')) {
      await this.acquire();
    }
    
    // 监听可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // 监听屏幕方向变化（从竖屏切换到横屏时申请）
    screen.orientation?.addEventListener('change', async () => {
      if (screen.orientation.type.includes('landscape')) {
        await this.acquire();   // 进入横屏，申请锁
      } else {
        await this.release();   // 进入竖屏，释放锁（用户可能在手机上查看）
      }
    });
  }
  
  async handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // 页面恢复可见，重新获取 Wake Lock
      await this.acquire();
      
      // 恢复数据刷新
      this.resumeDataRefresh();
    } else {
      // 页面进入后台，释放 Wake Lock（节省资源）
      await this.release();
      
      // 暂停数据刷新（节省流量和 CPU）
      this.pauseDataRefresh();
    }
  }
  
  async acquire() {
    if (!supportsWakeLock()) return;
    if (this.wakeLock?.released === false) return;
    
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock 释放');
      });
      console.log('投屏模式：屏幕常亮开启');
    } catch (err) {
      console.error('Wake Lock 获取失败（可能是权限被拒绝）:', err);
    }
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
  
  pauseDataRefresh() {
    if (this.presentationId) {
      clearInterval(this.presentationId);
      this.presentationId = null;
    }
  }
  
  resumeDataRefresh() {
    if (!this.presentationId) {
      this.presentationId = setInterval(() => this.fetchDashboardData(), 30000);
    }
  }
  
  async fetchDashboardData() {
    const data = await fetch('/api/dashboard').then(r => r.json());
    this.render(data);
  }
}

// 使用
const dashboard = new DashboardWakeLock();
document.getElementById('present-btn').addEventListener('click', () => {
  dashboard.startPresentation();
});
```

### 4.2 配合 Battery Status API（高级）

```javascript
// 在电池电量低时优雅降级
async function acquireWithBatteryCheck() {
  // 检查电池状态
  if ('getBattery' in navigator) {
    const battery = await navigator.getBattery();
    
    if (battery.level < 0.2) {
      console.warn('电池电量低于 20%，不申请 Wake Lock 以节省电量');
      return null;
    }
    
    // 监听电池变化
    battery.addEventListener('levelchange', () => {
      if (battery.level < 0.2) {
        wakeLockManager.release();   // 电量过低，释放锁
        showLowBatteryWarning();
      }
    });
  }
  
  return await wakeLockManager.acquire();
}
```

## 五、实战：多种应用场景

### 5.1 场景1：视频会议（通话期间常亮）

```javascript
class VideoConferenceWakeLock {
  constructor() {
    this.isInCall = false;
    this.wakeLock = null;
  }
  
  async startCall() {
    this.isInCall = true;
    await this.acquire();
    
    // 通话期间禁止屏幕熄灭
    // 但允许显示器进入低功耗（降低刷新率），不影响 Wake Lock
  }
  
  async endCall() {
    this.isInCall = false;
    await this.release();
  }
  
  async acquire() {
    if (this.wakeLock?.released === false) return;
    
    try {
      // 视频通话通常在竖屏/横屏都可能，保持常亮即可
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('视频会议 Wake Lock 请求失败:', err.message);
    }
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

### 5.2 场景2：在线烹饪教程（跟随模式）

```javascript
class CookingModeWakeLock {
  constructor() {
    this.stepIndex = 0;
    this.wakeLock = null;
  }
  
  // 进入跟随模式，屏幕常亮
  async enterFollowMode(recipe) {
    // 用户点击"开始跟着做"
    await this.acquire();
    this.renderRecipeSteps(recipe);
  }
  
  async exitFollowMode() {
    await this.release();
    this.showNormalRecipe();
  }
  
  // 每完成一步，自动进入下一步（无需用户触碰屏幕）
  async nextStep() {
    this.stepIndex++;
    if (this.stepIndex < this.totalSteps) {
      // 更新UI，显示下一步内容
      this.showStep(this.stepIndex);
      
      // Wake Lock 保持，无需重新申请（只要页面保持可见）
    } else {
      // 完成所有步骤，退出常亮模式
      await this.release();
      this.showCompletion();
    }
  }
  
  async acquire() {
    if (!supportsWakeLock()) {
      this.showWarning('您的浏览器不支持屏幕常亮，请保持手指触碰屏幕');
      return;
    }
    this.wakeLock = await navigator.wakeLock.request('screen');
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

### 5.3 场景3：沉浸式阅读器

```javascript
class ReadingWakeLock {
  constructor() {
    this.wakeLock = null;
    this.readingMode = false;
  }
  
  async startReading() {
    this.readingMode = true;
    await this.acquire();
    
    // 阅读模式下隐藏系统 UI（配合 Fullscreen API）
    if (document.fullscreenElement === null) {
      await document.documentElement.requestFullscreen();
    }
    
    // 监听键盘快捷键退出阅读模式
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }
  
  async stopReading() {
    this.readingMode = false;
    await this.release();
    
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
  }
  
  handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'q') {
      this.stopReading();
    }
  }
  
  async acquire() {
    if (!supportsWakeLock()) return;
    this.wakeLock = await navigator.wakeLock.request('screen');
    
    // 监听可见性变化
    document.addEventListener('visibilitychange', this.handleVisibility.bind(this));
  }
  
  async handleVisibility() {
    if (document.visibilityState === 'visible' && this.readingMode) {
      // 阅读模式 + 页面恢复可见时重新获取
      await this.acquire();
    }
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

### 5.4 场景4：音乐播放器（后台播放）

```javascript
class MusicPlayerWakeLock {
  constructor() {
    this.wakeLock = null;
    this.isPlaying = false;
  }
  
  async togglePlayPause() {
    if (this.isPlaying) {
      await audio.pause();
      await this.release();
      this.isPlaying = false;
    } else {
      await audio.play();
      await this.acquire();
      this.isPlaying = true;
    }
  }
  
  async acquire() {
    if (!supportsWakeLock()) return;
    
    // 音乐播放时申请 Wake Lock
    this.wakeLock = await navigator.wakeLock.request('screen');
    
    // 用户切换歌曲时，保持 Wake Lock（音乐不中断）
    audio.addEventListener('ended', async () => {
      await this.togglePlayPause();   // 播放结束，释放锁
    });
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

## 六、与其他 API 的组合使用

### 6.1 配合 Fullscreen API（沉浸式展示）

```javascript
async function startFullscreenPresentation() {
  // 1. 进入全屏
  await document.documentElement.requestFullscreen();
  
  // 2. 锁定屏幕方向（如果支持）
  if (screen.orientation?.lock) {
    await screen.orientation.lock('landscape');
  }
  
  // 3. 申请 Wake Lock
  const wakeLock = await navigator.wakeLock.request('screen');
  
  // 4. 退出全屏时释放所有
  document.addEventListener('fullscreenchange', async () => {
    if (!document.fullscreenElement) {
      if (screen.orientation?.unlock) {
        screen.orientation.unlock();
      }
      if (wakeLock.released === false) {
        await wakeLock.release();
      }
    }
  });
}
```

### 6.2 配合 Presentation API（第二屏幕）

```javascript
// Presentation API：内容发送到第二屏幕（Chromecast/外接显示器）
class DualScreenWakeLock {
  async startPresentation(url) {
    const presentation = navigator.presentation;
    
    if (!presentation) {
      console.warn('浏览器不支持 Presentation API');
      return;
    }
    
    // 请求展示会话
    const request = presentation.requestSession({ url });
    
    request.addEventListener('sessionconnect', async (e) => {
      const session = e.session;
      
      // 第二屏幕连接后，申请 Wake Lock 保持主屏幕常亮
      // （用户可以在第二屏幕看内容，主屏幕做控制）
      const wakeLock = await navigator.wakeLock.request('screen');
      
      session.addEventListener('terminate', async () => {
        // 第二屏幕断开时释放 Wake Lock
        await wakeLock.release();
      });
    });
  }
}
```

### 6.3 配合 Idle Detection API（智能节能）

```javascript
// Idle Detection：检测用户是否真的离开了
class SmartWakeLock {
  constructor() {
    this.wakeLock = null;
    this.idleDetector = null;
  }
  
  async init() {
    if (!('IdleDetector' in window)) {
      console.warn('浏览器不支持 Idle Detection API');
      return;
    }
    
    // 请求 Idle Detection 权限
    const permission = await IdleDetector.requestPermission();
    if (permission !== 'granted') {
      console.warn('Idle Detection 权限未授予');
      return;
    }
    
    // 监听用户空闲状态
    this.idleDetector = new IdleDetector({ threshold: 60000 });  // 60秒空闲
    this.idleDetector.addEventListener('change', () => {
      const userState = this.idleDetector.userState;
      const screenState = this.idleDetector.screenState;
      
      if (userState === 'idle') {
        // 用户空闲超过 60 秒，释放 Wake Lock
        this.release();
        console.log('用户空闲，释放 Wake Lock');
      } else {
        // 用户回来了，重新获取
        this.acquire();
        console.log('用户回来，重新获取 Wake Lock');
      }
    });
    
    this.idleDetector.start();
  }
  
  async acquire() {
    if (this.wakeLock?.released === false) return;
    this.wakeLock = await navigator.wakeLock.request('screen');
  }
  
  async release() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

## 七、浏览器支持与注意事项

### 7.1 浏览器支持情况

```
✅ Chrome 84+    （2020-07）
✅ Edge 84+
✅ Firefox 126+  （2024-06，较晚支持）
✅ Safari 16.4+  （2023-03）
✅ 移动端：Chrome Android 84+, Safari iOS 16.4+
```

```javascript
// 完整兼容性检查
function getWakeLockSupport() {
  if (!('wakeLock' in navigator)) {
    return { supported: false, reason: '浏览器不支持' };
  }
  
  if (!('request' in navigator.wakeLock)) {
    return { supported: false, reason: 'Wake Lock API 未实现' };
  }
  
  return {
    supported: true,
    version: navigator.wakeLock.version || 'unknown'
  };
}
```

### 7.2 常见错误处理

```javascript
async function safeRequestWakeLock() {
  // 错误1：页面已在后台
  // Error: NotAllowedError
  if (document.visibilityState === 'hidden') {
    console.warn('页面已在后台，无法申请 Wake Lock');
    return null;
  }
  
  // 错误2：权限被用户拒绝
  // Error: NotAllowedError: Permission denied
  try {
    return await navigator.wakeLock.request('screen');
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.error('Wake Lock 权限被拒绝，请检查浏览器设置');
      // 提示用户：在设置中允许屏幕常亮
    }
    return null;
  }
  
  // 错误3：系统策略限制（如某些企业设备）
  // Error: NotSupportedError
}
```

### 7.3 不适用于 Wake Lock 的场景

```javascript
// ❌ 以下场景不适合使用 Wake Lock
// Wake Lock 是"保持屏幕开启"，不是"阻止用户设备休眠"

// ❌ 长时间后台任务 → 使用 Web Workers + Background Sync
// ❌ 推送通知 → 使用 Push API
// ❌ 定时后台同步 → 使用 Background Sync API
// ❌ 离线缓存 → 使用 Service Worker + Cache API

// ✅ Wake Lock 只用于：用户正在观看的场景，屏幕需要保持常亮
// 投屏展示、阅读、烹饪跟随、视频通话等
```

## 八、完整实现：投屏大屏组件

```javascript
/**
 * PresentationMode - 完整的投屏大屏组件
 * 包含：Wake Lock + Fullscreen + 屏幕方向锁定 + 退出确认
 */
class PresentationMode {
  constructor(config = {}) {
    this.config = {
      contentSelector: config.contentSelector || '#presentation-content',
      onEnter: config.onEnter || (() => {}),
      onExit: config.onExit || (() => {}),
      ...config
    };
    
    this.wakeLock = null;
    this.isActive = false;
    
    this.setupKeyboardShortcuts();
    this.setupVisibilityHandler();
  }
  
  async enter() {
    if (this.isActive) return;
    
    // 1. 进入全屏
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn('全屏模式不可用:', err.message);
    }
    
    // 2. 锁定屏幕方向（移动端）
    if (screen.orientation?.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch (err) {
        console.warn('屏幕方向锁定不可用:', err.message);
      }
    }
    
    // 3. 申请 Wake Lock（核心！）
    await this.acquireWakeLock();
    
    // 4. 更新状态
    this.isActive = true;
    this.config.onEnter();
    
    // 5. 隐藏滚动条
    document.body.style.overflow = 'hidden';
  }
  
  async exit() {
    if (!this.isActive) return;
    
    // 1. 释放 Wake Lock
    await this.releaseWakeLock();
    
    // 2. 退出全屏
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    
    // 3. 解锁屏幕方向
    if (screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
    
    // 4. 恢复滚动
    document.body.style.overflow = '';
    
    // 5. 更新状态
    this.isActive = false;
    this.config.onExit();
  }
  
  async acquireWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.warn('浏览器不支持 Screen Wake Lock API');
      return;
    }
    
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      
      this.wakeLock.addEventListener('release', () => {
        console.log('Wake Lock 释放:', this.wakeLock?.releaseReason);
      });
      
      console.log('✅ 屏幕常亮已开启');
    } catch (err) {
      console.error('Wake Lock 获取失败:', err);
    }
  }
  
  async releaseWakeLock() {
    if (this.wakeLock && this.wakeLock.released === false) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('🔓 屏幕常亮已关闭');
    }
  }
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // ESC 或 F 键退出全屏模式
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
        if (this.isActive) {
          this.exit();
        }
      }
      
      // F11 也可以触发全屏（配合我们的 Wake Lock）
      if (e.key === 'F11') {
        e.preventDefault();
        this.isActive ? this.exit() : this.enter();
      }
    });
  }
  
  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.isActive) {
        // 页面恢复可见时，重新获取 Wake Lock
        await this.acquireWakeLock();
      }
    });
  }
}

// 使用
const presentation = new PresentationMode({
  onEnter: () => {
    showNotification('投屏模式已开启，屏幕将保持常亮');
  },
  onExit: () => {
    showNotification('投屏模式已退出');
  }
});

document.getElementById('start-presentation').addEventListener('click', () => {
  presentation.enter();
});

document.getElementById('end-presentation').addEventListener('click', () => {
  presentation.exit();
});
```

## 总结

Screen Wake Lock API 是浏览器提供的一个简洁而强大的 API，解决了"让屏幕在特定场景下保持常亮"这个看似简单但实际很有价值的问题。

**核心要点：**

| 场景 | 用法 |
|------|------|
| **投屏展示** | Fullscreen + Wake Lock + 屏幕方向锁定 |
| **视频通话** | 通话期间申请，结束时释放 |
| **阅读器** | 阅读模式开启，退出阅读模式时释放 |
| **实时监控** | 与 Page Visibility 配合，后台暂停、前台恢复 |
| **配合 Idle Detection** | 智能判断用户是否真的离开了，精确节能 |

**最佳实践：**

1. **始终配合 `visibilitychange` 事件**：页面恢复可见时重新申请 Wake Lock
2. **页面卸载时释放**：在 `beforeunload` 中清理
3. **提供降级方案**：不支持 Wake Lock 时提示用户
4. **不要滥用**：只在用户真正需要屏幕常亮的场景使用
5. **与 Fullscreen / Orientation Lock 组合**：打造完整的投屏体验

```javascript
// 一行代码开启屏幕常亮
await navigator.wakeLock?.request('screen');

// 配合可见性变化
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.wakeLock?.request('screen');
  }
});
```

*本文由小虾子 🦐 撰写*
