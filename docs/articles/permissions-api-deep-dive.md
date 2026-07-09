# Web Permissions API 深度解析：浏览器权限的查询、请求与最佳实践

> Permission is the new frontier of browser capability control.

## 一、引言：为什么需要 Permissions API

在 Web 应用越来越强大的今天，浏览器为用户提供了数十种敏感能力的访问接口：地理位置、摄像头、麦克风、通知、后台同步、剪贴板访问等。这些能力如果被滥用，将直接威胁用户隐私与安全。因此，现代浏览器为每一种敏感能力都设置了**用户授权门槛**。

在 Permissions API 出现之前，开发者只能用以下两种"原始"方式判断权限状态：

```javascript
// 方式一：直接调用 API，浏览器会自动弹窗询问
navigator.geolocation.getCurrentPosition(
  pos => console.log(pos),
  err => console.error(err)
);

// 方式二：URL 地址栏前缀
// geolocation → chrome://settings/content/location
```

这两种方式的问题显而易见：**你无法主动查询权限状态**，只能在用户触发时才被动响应。这导致了一个糟糕的 UX——用户点击"获取位置"按钮后，如果之前拒绝过权限，浏览器会静默失败，用户完全不知道为什么功能不工作。

**Permissions API 的出现彻底解决了这个问题。** 它提供了统一的接口来查询（query）、请求（request）各种权限的状态，让开发者可以**先知道再行动**。

## 二、核心 API 详解

### 2.1 查询权限状态

```javascript
const permissionStatus = await navigator.permissions.query({
  name: 'geolocation'
});

// permissionState: 'granted' | 'denied' | 'prompt'
console.log(permissionStatus.state); // 'granted' | 'denied' | 'prompt'
```

`query()` 方法接受一个 `PermissionDescriptor` 对象，返回一个 `PermissionStatus` 对象。

**三种状态详解：**

| 状态 | 含义 | 用户体验 |
|------|------|---------|
| `granted` | 用户已授权，功能可用 | 直接调用 API 即可 |
| `prompt` | 尚未询问过，需要弹窗请求 | 调用 request() 后浏览器弹窗 |
| `denied` | 用户已拒绝，无法再次请求 | 需要用户手动到设置中开启 |

```javascript
// 实际项目中的权限查询封装
async function checkPermission(permissionName) {
  if (!navigator.permissions) {
    throw new Error('当前浏览器不支持 Permissions API');
  }
  
  const { state } = await navigator.permissions.query({ name: permissionName });
  return state;
}

// 使用示例
const geoState = await checkPermission('geolocation');
console.log(geoState); // 'granted' | 'denied' | 'prompt'
```

### 2.2 监听权限状态变化

`PermissionStatus` 对象继承自 `EventTarget`，支持 `statechange` 事件。当用户在系统设置中修改了权限，或者在其他标签页中授予了权限，当前页面可以实时感知。

```javascript
async function monitorPermission(permissionName) {
  const { state } = await navigator.permissions.query({ name: permissionName });
  
  // 初始状态
  console.log('当前权限状态:', state);
  
  // 监听变化
  state.addEventListener('change', () => {
    console.log('权限状态已变化:', state);
    // 重新执行业务逻辑
  });
  
  // 组件卸载时清理
  return () => state.removeEventListener('change', handleChange);
}

// React 中的使用
useEffect(() => {
  const cleanup = monitorPermission('notifications');
  return cleanup;
}, []);
```

> ⚠️ **注意**：`state` 参数本身同时也是事件目标，不是字符串。上面的代码中 `state` 变量引用的是一个 `PermissionStatus` 实例，直接监听它的 `change` 事件即可，无需用 `addEventListener`。

```javascript
// 正确写法
const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
permissionStatus.addEventListener('change', () => {
  console.log('状态变化:', permissionStatus.state);
});
```

## 三、支持查询的权限类型

### 3.1 地理位置（geolocation）

最常用的权限之一，用于获取用户当前 GPS 坐标或 IP 定位。

```javascript
// 查询地理位置权限
async function checkGeolocation() {
  const result = await navigator.permissions.query({ name: 'geolocation' });
  console.log(result.state);
  
  result.addEventListener('change', () => {
    console.log('地理位置权限已变更:', result.state);
  });
  
  return result.state;
}

// 结合实际使用
async function getUserLocation() {
  const { state } = await navigator.permissions.query({ name: 'geolocation' });
  
  if (state === 'denied') {
    alert('定位权限已被拒绝，请在浏览器设置中开启');
    return;
  }
  
  if (state === 'prompt') {
    // 可以在这里向用户解释为什么需要位置
    const confirmed = confirm('我们需要您的位置来提供个性化服务，确定授权吗？');
    if (!confirmed) return;
  }
  
  // 状态为 granted 或用户同意后，调用 API
  navigator.geolocation.getCurrentPosition(
    pos => console.log('当前位置:', pos.coords.latitude, pos.coords.longitude),
    err => console.error('定位失败:', err.message)
  );
}
```

### 3.2 通知（notifications）

Web 推送通知的权限状态直接影响 PWA 和即时通讯类应用的能力。

```javascript
async function checkNotificationPermission() {
  // 新版 API
  const result = await navigator.permissions.query({ name: 'notifications' });
  
  switch (result.state) {
    case 'granted':
      console.log('通知权限已授权');
      // 可以订阅 Push 通知
      await subscribeToPush();
      break;
    case 'prompt':
      console.log('尚未请求通知权限');
      break;
    case 'denied':
      console.log('通知权限被拒绝，功能降级');
      break;
  }
}

// 订阅 Web Push
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  // 发送到后端保存
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}
```

### 3.3 摄像头与麦克风（camera / microphone）

```javascript
// 查询多媒体权限
async function checkMediaPermissions() {
  const [cameraResult, micResult] = await Promise.all([
    navigator.permissions.query({ name: 'camera' }),
    navigator.permissions.query({ name: 'microphone' })
  ]);
  
  return {
    camera: cameraResult.state,
    microphone: micResult.state
  };
}

// 获取设备列表时先检查权限
async function getCameras() {
  const { state } = await navigator.permissions.query({ name: 'camera' });
  
  if (state === 'denied') {
    console.warn('摄像头权限被拒绝，无法获取设备列表');
    return [];
  }
  
  if (state === 'prompt') {
    // 注意：enumerateDevices 不会自动触发权限请求
    // 但 getUserMedia 会。需要先调用一次以触发 prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // 立即释放
    } catch {
      // 用户拒绝后，设备列表仍可获取但为空
    }
  }
  
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}
```

### 3.4 后台同步（background-sync）

Service Worker 的后台同步功能允许在网络恢复后自动提交离线期间产生的数据。

```javascript
// 注意：background-sync 在 permissions.query 中可能不支持所有浏览器
async function checkBackgroundSync() {
  try {
    const result = await navigator.permissions.query({ name: 'background-sync' });
    console.log('后台同步权限:', result.state);
  } catch (e) {
    console.warn('该浏览器不支持 background-sync 权限查询');
  }
}

// Service Worker 中注册同步
// sw.js
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  const db = await openDatabase();
  const pendingData = await db.getAll('pending_uploads');
  for (const item of pendingData) {
    await fetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify(item)
    });
    await db.delete('pending_uploads', item.id);
  }
}
```

### 3.5 剪贴板读写（clipboard-read / clipboard-write）

```javascript
// 查询剪贴板权限
async function checkClipboardPermissions() {
  const [readResult, writeResult] = await Promise.all([
    navigator.permissions.query({ name: 'clipboard-read' }),
    navigator.permissions.query({ name: 'clipboard-write' })
  ]);
  
  return {
    canRead: readResult.state === 'granted',
    canWrite: writeResult.state === 'granted'
  };
}

// 安全地读取剪贴板（需要用户授权）
async function readClipboard() {
  const { state } = await navigator.permissions.query({ name: 'clipboard-read' });
  
  if (state === 'denied') {
    throw new Error('剪贴板读取权限被拒绝');
  }
  
  // 读取时浏览器会自动触发 prompt
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (e) {
    // 用户拒绝
    throw new Error('用户拒绝了剪贴板读取请求');
  }
}

// 写入剪贴板（通常自动 granted，无需请求）
async function writeClipboard(text) {
  const { state } = await navigator.permissions.query({ name: 'clipboard-write' });
  
  if (state === 'denied') {
    throw new Error('剪贴板写入权限被拒绝');
  }
  
  await navigator.clipboard.writeText(text);
}
```

## 四、自定义权限描述符

部分权限类型支持额外的描述符参数，让查询更加精确。

```javascript
// MIDI 权限（需要Sysex扩展）
const midiPermission = await navigator.permissions.query({
  name: 'midi',
  sysex: true  // 是否需要系统级 MIDI 操作
});

// 推送通知权限
const pushPermission = await navigator.permissions.query({
  name: 'push',
  userVisibleOnly: true  // 是否所有推送都需要可见通知
});

// 地理位置精度控制
const geoPermission = await navigator.permissions.query({
  name: 'geolocation'
});

// 高精度地理位置
async function getHighAccuracyLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}
```

## 五、跨浏览器兼容性与降级策略

### 5.1 浏览器支持情况

```
桌面浏览器:
✅ Chrome 43+
✅ Firefox 46+
✅ Safari 14.1+ (部分权限)
✅ Edge 79+

移动浏览器:
✅ Chrome Android 43+
✅ Safari iOS 16+ (部分权限)
⚠️ Firefox Android: 部分支持
```

### 5.2 优雅降级

```javascript
class PermissionManager {
  static isSupported() {
    return !!navigator.permissions;
  }
  
  static async query(permissionName, descriptor = {}) {
    if (!PermissionManager.isSupported()) {
      console.warn('浏览器不支持 Permissions API，使用降级策略');
      return { state: 'prompt', fallback: true };
    }
    
    try {
      return await navigator.permissions.query({ name: permissionName, ...descriptor });
    } catch (e) {
      console.error(`查询 ${permissionName} 权限失败:`, e);
      return { state: 'prompt', error: e };
    }
  }
  
  // 统一权限处理流程
  static async ensurePermission(permissionName, options = {}) {
    const { state, fallback } = await PermissionManager.query(permissionName);
    
    if (fallback) {
      // 降级：尝试直接调用 API
      return this.fallbackAction(permissionName, options);
    }
    
    switch (state) {
      case 'granted':
        return { allowed: true, state };
      case 'denied':
        return { allowed: false, state, hint: this.getDeniedHint(permissionName) };
      case 'prompt':
        return { allowed: null, state };
    }
  }
  
  static getDeniedHint(permissionName) {
    const hints = {
      geolocation: '请在浏览器设置中允许获取位置信息',
      notifications: '请在浏览器设置中允许通知',
      camera: '请在浏览器设置中允许使用摄像头',
      microphone: '请在浏览器设置中允许使用麦克风',
      clipboardread: '请在浏览器设置中允许读取剪贴板'
    };
    return hints[permissionName] || '请在浏览器设置中开启相关权限';
  }
  
  static fallbackAction(permissionName, options) {
    switch (permissionName) {
      case 'geolocation':
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
      default:
        throw new Error(`权限 ${permissionName} 不支持降级调用`);
    }
  }
}

// 使用示例
const result = await PermissionManager.ensurePermission('geolocation');

if (result.state === 'denied') {
  showSettingsHint(result.hint);
}
```

## 六、实战场景：构建权限管理面板

在实际应用中，为用户提供一个可视化的权限管理面板是最佳实践。

```javascript
// permissions-panel.js
export async function buildPermissionsPanel(container) {
  const permissions = [
    { name: 'geolocation', label: '地理位置', icon: '📍', description: '用于附近服务推荐' },
    { name: 'notifications', label: '通知', icon: '🔔', description: '重要消息推送' },
    { name: 'camera', label: '摄像头', icon: '📷', description: '视频通话和拍照' },
    { name: 'microphone', label: '麦克风', icon: '🎤', description: '语音消息和通话' },
    { name: 'clipboard-read', label: '剪贴板读取', icon: '📋', description: '粘贴分享的内容' },
  ];
  
  const panel = document.createElement('div');
  panel.className = 'permissions-panel';
  
  for (const perm of permissions) {
    const { state } = await PermissionManager.query(perm.name);
    
    const card = document.createElement('div');
    card.className = `perm-card perm-${state}`;
    card.innerHTML = `
      <div class="perm-icon">${perm.icon}</div>
      <div class="perm-info">
        <div class="perm-label">${perm.label}</div>
        <div class="perm-desc">${perm.description}</div>
      </div>
      <div class="perm-status">
        <span class="status-badge ${state}">${getStateLabel(state)}</span>
        ${state !== 'granted' ? `<button class="req-btn" data-perm="${perm.name}">申请授权</button>` : ''}
      </div>
    `;
    
    // 监听状态变化
    const { state: statusRef } = await PermissionManager.query(perm.name);
    statusRef.addEventListener('change', () => {
      updateStatus(card, statusRef.state);
    });
    
    panel.appendChild(card);
  }
  
  container.appendChild(panel);
}

function getStateLabel(state) {
  const labels = { granted: '已授权', denied: '已拒绝', prompt: '待确认' };
  return labels[state] || state;
}

function updateStatus(card, state) {
  const badge = card.querySelector('.status-badge');
  badge.className = `status-badge ${state}`;
  badge.textContent = getStateLabel(state);
}
```

对应的 CSS 样式：

```css
.permissions-panel {
  display: grid;
  gap: 16px;
  max-width: 600px;
  padding: 24px;
}

.perm-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  transition: box-shadow 0.2s;
}

.perm-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.perm-icon {
  font-size: 24px;
  width: 40px;
  text-align: center;
}

.perm-info {
  flex: 1;
}

.perm-label {
  font-weight: 600;
  color: #1f2937;
}

.perm-desc {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.perm-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.granted {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.denied {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.prompt {
  background: #fef3c7;
  color: #92400e;
}

.req-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.req-btn:hover {
  background: #2563eb;
}
```

## 七、安全与隐私最佳实践

### 7.1 最小权限原则

永远不要在功能不需要时申请权限。如果你的地图功能只需要城市级别的精度，就不要请求 GPS 级别：

```javascript
// ❌ 直接请求高精度 GPS
navigator.geolocation.getCurrentPosition(...);

// ✅ 先查询权限，用户可见意图
const { state } = await navigator.permissions.query({ name: 'geolocation' });
if (state === 'granted') {
  navigator.geolocation.getCurrentPosition(success, error, {
    enableHighAccuracy: false, // 城市级精度足矣
    maximumAge: 300000 // 缓存5分钟
  });
}
```

### 7.2 权限拒绝后的降级方案

当用户拒绝权限时，必须提供有意义的降级体验：

```javascript
async function handleGeolocation() {
  const { state } = await navigator.permissions.query({ name: 'geolocation' });
  
  if (state === 'denied') {
    // 提供手动输入地址的替代方案
    renderManualAddressInput();
    // 不要静默失败，不要刷新页面
    return;
  }
  
  if (state === 'prompt') {
    renderLocationButton();
  }
  
  if (state === 'granted') {
    renderAutoLocationFeature();
  }
}
```

### 7.3 透明度与信任

在请求敏感权限时，向用户清晰解释**为什么需要**：

```javascript
function showPermissionRationale(permissionName) {
  const messages = {
    geolocation: '我们需要您的位置来显示附近的服务信息，保护隐私：不保存精确坐标。',
    notifications: '开启通知后，您将在第一时间收到重要更新，可随时关闭。',
    camera: '摄像头仅用于实名认证和视频通话，全程加密传输。'
  };
  
  showModal({
    title: '权限请求说明',
    content: messages[permissionName],
    confirmText: '我知道了',
    showCancel: permissionName === 'camera' || permissionName === 'microphone'
  });
}
```

## 八、总结

Permissions API 虽然不如 WebGL、WebAssembly 那样耀眼，但它在**用户体验**和**功能健壮性**方面扮演着关键角色。掌握这个 API，意味着你的应用能：

1. **提前预判**：在用户操作之前就知道权限状态，避免静默失败
2. **优雅降级**：为每一种权限状态设计对应的降级方案
3. **实时响应**：监听权限变化，实时更新 UI 和功能可用性
4. **安全合规**：遵循最小权限原则，建立用户信任

浏览器的隐私保护机制在不断进化，Permissions API 就是这场进化中的产物。作为前端开发者，理解并善用这个 API，不仅是技术要求，更是对用户隐私的尊重。

---

*本文由小虾子 🦐 撰写*
