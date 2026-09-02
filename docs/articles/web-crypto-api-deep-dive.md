# Web Crypto API 深度解析：浏览器原生的密码学能力

> 你还在引入 `crypto-js` 或 `js-sha256` 来做 MD5/SHA 哈希？还在用 `uuid` 包生成 UUID？在现代浏览器中，这一切都可以用 **Web Crypto API** 零依赖完成。Web Crypto API 是 W3C 标准的浏览器内置密码学接口，底层调用 OS 原生加密库（Windows CNG / macOS Security.framework / Linux OpenSSL），性能与安全性与 Node.js `crypto` 模块旗鼓相当。本文深入讲解 Hash、AES-GCM、RSA、PBKDF2、JWT 验签、UUID 生成等实战场景。

## 一、Web Crypto API 概述

### 1.1 为什么选择 Web Crypto？

| 对比项 | 纯 JS 库 (crypto-js) | Web Crypto API |
|--------|---------------------|----------------|
| 依赖 | 需 npm 安装 (~500KB) | 零依赖，浏览器内置 |
| 性能 | JS 实现，较慢 | OS 原生加密库，极快 |
| 算法质量 | 参差不齐（MD5/SHA1 仍在列） | 强制推荐安全算法，禁用弱算法 |
| 随机数 | Math.random() | CSPRNG（密码学安全） |
| JIT 友好 | 中等 | 原生接口，V8 直接调用 |
| SSR/Node 支持 | 通用 | 需适配（Node 18+ 有 `globalThis.crypto`） |

**核心约束：** Web Crypto API 是**同步设计**（Promise），不支持流式大文件加密（可用 Streams API 配合 `crypto.subtle`）。

### 1.2 基本架构

```javascript
// 全局暴露在 window.crypto（标准）或 self.crypto（Worker）
const subtle = crypto.subtle;   // 核心加密操作
const randomUUID = crypto.randomUUID;  // 便捷方法
const getRandomValues = crypto.getRandomValues;  // 填充 Uint8Array

// 注意：不要用 Math.random() 做密码学用途！
// ❌ 危险：可预测
const bad = Math.random();  // 例如：seed = Date.now()，可被预测

// ✅ 安全：CSPRNG
const good = new Uint8Array(16);
crypto.getRandomValues(good);  // 密码学安全的随机数
```

### 1.3 通用模式：所有加密操作的共同流程

```javascript
async function cryptoOperation(input) {
  // Step 1: 生成或导入密钥
  const key = await crypto.subtle.generateKey(/* algorithm */, false, /* usages */);

  // Step 2: 执行加密操作
  const result = await crypto.subtle.encrypt(/* algorithm */, key, /* data */);

  // Step 3: 使用结果（ArrayBuffer）
  return new Uint8Array(result);
}
```

`usages` 参数指定密钥的用途：`["encrypt", "decrypt"]`、`["sign", "verify"]` 等。

## 二、哈希与摘要

### 2.1 SHA 系列哈希

```javascript
// 文本 → SHA-256 哈希
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

// ArrayBuffer → Hex 字符串
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

console.log(sha256('hello'));  // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

```javascript
// 完整示例：带分片的大文件哈希（避免阻塞主线程）
async function sha256File(file, onProgress) {
  const chunkSize = 1024 * 1024;  // 1MB 分片
  const hashAlgo = 'SHA-256';
  let offset = 0;

  // 使用 Streams API + crypto.subtle 在 Worker 中计算
  const stream = file.stream();
  const hashBuffer = await crypto.subtle.digest(
    { name: 'SHA-256' },
    await file.arrayBuffer()
  );
  return bufferToHex(hashBuffer);
}

// Worker 中的实现（不阻塞 UI）
// worker.js
self.onmessage = async (e) => {
  const { data } = e;
  const hash = await crypto.subtle.digest('SHA-256', data);
  self.postMessage({ hash: bufferToHex(hash) });
};
```

### 2.2 支持的哈希算法

```javascript
// SHA-1（仅兼容性场景，已不推荐）
const sha1 = await crypto.subtle.digest('SHA-1', data);  // 160-bit，碰撞风险

// SHA-256（推荐，256-bit）
const sha256 = await crypto.subtle.digest('SHA-256', data);

// SHA-384（384-bit）
const sha384 = await crypto.subtle.digest('SHA-384', data);

// SHA-512（512-bit）
const sha512 = await crypto.subtle.digest('SHA-512', data);

// ⚠️ 以下已被 Web Crypto 禁用（不安全）：
// ❌ MD5  ❌ SHA-1（已从标准中移除） ❌ DES  ❌ RC4
```

## 三、对称加密：AES-GCM

AES-GCM 是最推荐的现代对称加密算法——它同时提供**加密**和**完整性校验**，是 TLS 1.3 的默认算法。

### 3.1 密钥生成与导出

```javascript
// 生成 AES-256-GCM 密钥（256-bit）
async function generateAESKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable：是否可导出原始密钥材料
    ['encrypt', 'decrypt']
  );
  return key;
}

// 导出密钥为可存储格式（base64）
async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

// 从 base64 导入密钥
async function importKey(base64Key) {
  const keyData = base64ToBuffer(base64Key);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
```

### 3.2 加密与解密

```javascript
// 加密： plaintext → ciphertext
async function encrypt(plaintext, key) {
  // AES-GCM 需要 12 字节的 IV（初始化向量），每次加密必须不同
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    iv,           // IV 需要与密文一起存储（不需要保密，但不可重复使用）
    ciphertext
  };
}

// 解密： ciphertext → plaintext
async function decrypt(iv, ciphertext, key) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

### 3.3 完整加解密流程

```javascript
// 示例：加密用户数据后存储到 localStorage
async function secureStore(userData, key) {
  const { iv, ciphertext } = await encrypt(JSON.stringify(userData), key);
  const record = {
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext)
  };
  localStorage.setItem('secure_data', JSON.stringify(record));
}

async function secureLoad(key) {
  const record = JSON.parse(localStorage.getItem('secure_data'));
  const iv = base64ToBuffer(record.iv);
  const ciphertext = base64ToBuffer(record.data);
  const plaintext = await decrypt(iv, ciphertext, key);
  return JSON.parse(plaintext);
}

// ⚠️ 实际应用中注意：
// 1. 密钥不要存储在 localStorage（放 IndexedDB 或内存中）
// 2. IV 绝对不可重复使用（AES-GCM 的 IV 重复会泄露密钥）
```

## 四、非对称加密：RSA-OAEP

RSA 用于密钥交换（加密少量数据，如传输 AES 密钥）或数字签名（验证数据来源）。

### 4.1 生成 RSA 密钥对

```javascript
// 生成 RSA-OAEP 2048-bit 密钥对（加密用）
async function generateRSAKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,    // 可选 2048 / 4096 / 1024
      publicExponent: new Uint8Array([1, 0, 1]),  // 65537（行业标准）
      hash: 'SHA-256'         // OAEP 摘要算法
    },
    true,   // extractable
    ['encrypt', 'decrypt']
  );
  return keyPair;  // { publicKey, privateKey }
}

// 导出公钥（可安全发送给任何人）
async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return bufferToBase64(exported);
}

// 导出私钥（必须保密！）
async function exportPrivateKey(privateKey) {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return bufferToBase64(exported);
}
```

### 4.2 用公钥加密（小数据）

```javascript
// RSA-OAEP 加密（输入数据 ≤ key_size/8 - 2*hash_len - 2 字节）
// RSA-2048 + SHA-256：最大加密 190 字节
async function rsaEncrypt(data, publicKey) {
  const encoded = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    encoded
  );
  return bufferToBase64(encrypted);
}

// RSA-OAEP 解密
async function rsaDecrypt(encryptedBase64, privateKey) {
  const encrypted = base64ToBuffer(encryptedBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}
```

> **实用技巧**：RSA 不适合加密大量数据。实践中通常用 RSA 加密 AES 会话密钥，再用 AES 加密实际数据（RSA-OAEP + AES-GCM 混合加密）。

## 五、数字签名：RSA-PSS 与 ECDSA

### 5.1 RSA-PSS 签名

```javascript
// 生成签名密钥对（与加密密钥对不同用途）
async function generateSigningKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']   // 注意：这里是 sign/verify，不是 encrypt/decrypt
  );
}

// 签名
async function sign(message, privateKey) {
  const encoded = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },  // saltLength 推荐 32 字节
    privateKey,
    encoded
  );
  return bufferToBase64(signature);
}

// 验签
async function verify(message, signatureBase64, publicKey) {
  const encoded = new TextEncoder().encode(message);
  const signature = base64ToBuffer(signatureBase64);
  return crypto.subtle.verify(
    { name: 'RSA-PSS', saltLength: 32 },
    publicKey,
    signature,
    encoded
  );
}

// 使用示例
async function demo() {
  const { publicKey, privateKey } = await generateSigningKeyPair();

  const message = 'Transfer $100 to account 12345';
  const signature = await sign(message, privateKey);

  const isValid = await verify(message, signature, publicKey);
  console.log('验签结果:', isValid);  // true

  // 篡改消息后验签
  const tampered = await verify('Transfer $999 to account 12345', signature, publicKey);
  console.log('篡改后验签:', tampered);  // false
}
```

### 5.2 ECDSA（更推荐的签名算法）

ECDSA 使用更短的密钥（256-bit vs RSA 2048-bit）达到同等安全级别，且签名速度更快：

```javascript
// 生成 ECDSA P-256 密钥对
async function generateECDSAKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },  // P-256 / P-384 / P-521
    true,
    ['sign', 'verify']
  );
}

// 签名（ECDSA）
async function ecdsaSign(message, privateKey) {
  const encoded = new TextEncoder().encode(message);
  return crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded
  );
}

async function ecdsaVerify(message, signature, publicKey) {
  const encoded = new TextEncoder().encode(message);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signature,
    encoded
  );
}
```

## 六、密钥派生：PBKDF2 与 Scrypt

从密码生成加密密钥时，直接用密码做 AES 密钥是不安全的（密码熵低）。正确做法是用 **PBKDF2** 或 **Scrypt** 从密码派生高熵密钥。

### 6.1 PBKDF2（推荐）

```javascript
async function deriveKeyPBKDF2(password, salt, iterations = 310000) {
  // PBKDF2 需要：密码、盐、迭代次数、输出长度、算法
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,                      // 盐：随机生成，每密码唯一，≥16 字节
      iterations,                // 迭代次数：越大越慢越安全（建议 ≥310,000）
      hash: 'SHA-256'            // 摘要函数
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },  // 派生为 AES-256 密钥
    true,
    ['encrypt', 'decrypt']
  );
}

// 完整示例：基于密码加密数据
async function passwordEncrypt(password, plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(16));  // 随机盐
  const key = await deriveKeyPBKDF2(password, salt);
  const { iv, ciphertext } = await encrypt(plaintext, key);
  return { salt, iv, ciphertext };
}

async function passwordDecrypt(password, salt, iv, ciphertext) {
  const key = await deriveKeyPBKDF2(password, salt);
  return decrypt(iv, ciphertext, key);
}
```

### 6.2 盐的作用

```javascript
// 盐防止彩虹表攻击：同一密码 + 不同盐 → 不同密钥
const salt1 = crypto.getRandomValues(new Uint8Array(16));
const salt2 = crypto.getRandomValues(new Uint8Array(16));

const key1 = await deriveKeyPBKDF2('password123', salt1);  // 不同的密钥
const key2 = await deriveKeyPBKDF2('password123', salt2);  // 不同的密钥

// ⚠️ 存储时必须保存盐（可以公开，不需要保密）
const stored = {
  salt: bufferToBase64(salt),
  iv: bufferToBase64(iv),
  ciphertext: bufferToBase64(ciphertext)
};
```

## 七、JWT 验签实战

前端常见的场景：后端返回 JWT，前端验证签名确保数据未被篡改。

```javascript
// JWT 结构：header.payload.signature（base64url）
async function verifyJWT(jwt, publicKey) {
  const [headerB64, payloadB64, signatureB64] = jwt.split('.');

  // Step 1: 重建签名数据（header.payload，不含末尾的 signature）
  const signingInput = `${headerB64}.${payloadB64}`;

  // Step 2: 用公钥验签
  const isValid = await ecdsaVerify(signingInput, base64urlToBuffer(signatureB64), publicKey);
  if (!isValid) throw new Error('JWT 签名无效');

  // Step 3: 解析 payload
  const payload = JSON.parse(atob(payloadB64));

  // Step 4: 检查过期
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('JWT 已过期');
  }

  return payload;
}

// base64url → ArrayBuffer（JWT 使用 base64url 编码）
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
```

## 八、随机数与 UUID

### 8.1 密码学安全的随机数

```javascript
// 生成 16 字节随机数（128-bit）
const randomBytes = new Uint8Array(16);
crypto.getRandomValues(randomBytes);

// 生成 0-255 之间的随机整数
const randomInt = randomBytes[0];  // 直接从 CSPRNG 读取

// 生成 0-99 的随机整数（无偏差）
const random100 = randomBytes[0] % 100;  // ⚠️ 轻微偏差（0-55 多 1/256 概率）
```

### 8.2 UUID v4 生成

```javascript
// 方式1：Web Crypto API 手动生成（标准 UUID v4 格式）
function generateUUID() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 设置版本号（4）和变体（RFC 4122）
  bytes[6] = (bytes[6] & 0x0f) | 0x40;  // 版本 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;  // 变体 10xx

  // 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// 方式2：现代浏览器直接支持
const uuid = crypto.randomUUID();  // Chrome 122+, Firefox 122+, Safari 16.5+
```

## 九、SubtleCrypto 兼容性问题

### 9.1 Node.js / Deno 适配

```javascript
// 检测是否可用
const hasWebCrypto = typeof crypto !== 'undefined' && crypto.subtle;

if (!hasWebCrypto) {
  // Node.js 18+ / Deno 自带 Web Crypto
  // 旧版 Node.js 需要引入 polyfill
  // import { webcrypto } from 'crypto';
  // globalThis.crypto = webcrypto;
}
```

### 9.2 跨上下文传递

`CryptoKey` 对象可以在 `postMessage` 传递（支持结构化克隆），但原始密钥材料（ArrayBuffer）不行：

```javascript
// ✅ CryptoKey 可以 postMessage
worker.postMessage({ type: 'encrypt', key: cryptoKey });  // 自动克隆

// ❌ 原始 ArrayBuffer 需要 Transfer
const rawKey = await crypto.subtle.exportKey('raw', key);
worker.postMessage({ rawKey }, [rawKey]);  // 转移所有权，防止复制
```

### 9.3 安全上下文限制

Web Crypto API 仅在**安全上下文**（HTTPS / localhost / file://）中可用：

```javascript
if (self.isSecureContext) {
  console.log('Web Crypto API 可用');
} else {
  console.warn('非安全上下文，Web Crypto 不可用');
}
```

## 十、实战：完整的前端加密存储方案

```javascript
/**
 * 前端安全存储：密码 + 盐 + PBKDF2 派生 AES 密钥 + AES-GCM 加密
 * 适合：加密 localStorage/IndexedDB 中的敏感数据
 */
class SecureStorage {
  constructor(masterPassword) {
    this.masterPassword = masterPassword;
  }

  async _getKey(salt) {
    const passwordKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(this.masterPassword),
      'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  }

  async setItem(key, value) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const derivedKey = await this._getKey(salt);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, derivedKey,
      new TextEncoder().encode(JSON.stringify(value))
    );

    const record = {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      data: bufferToBase64(ciphertext)
    };
    localStorage.setItem(`secure_${key}`, JSON.stringify(record));
  }

  async getItem(key) {
    const raw = localStorage.getItem(`secure_${key}`);
    if (!raw) return null;
    const { salt, iv, data } = JSON.parse(raw);
    const derivedKey = await this._getKey(base64ToBuffer(salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(iv) }, derivedKey,
      base64ToBuffer(data)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }
}

// 使用
const storage = new SecureStorage('your-master-password');
await storage.setItem('apiToken', 'sk-xxx');     // 加密存储
const token = await storage.getItem('apiToken'); // 解密读取
```

## 十一、总结

Web Crypto API 是前端密码学的完整解决方案，无需任何第三方库：

| 场景 | 推荐算法 |
|------|---------|
| 哈希摘要 | SHA-256 / SHA-384 |
| 对称加密 | AES-GCM（带认证加密） |
| 非对称加密 | RSA-OAEP（密钥交换） |
| 数字签名 | ECDSA P-256（推荐）或 RSA-PSS |
| 密钥派生 | PBKDF2（iterations ≥ 310,000） |
| 随机 UUID | `crypto.randomUUID()` |
| JWT 验签 | ECDSA P-256 公钥验签 |

**安全使用原则：**

1. **永远不要自己实现加密算法**：用 Web Crypto API，它底层调用 OS 原生库
2. **IV/盐绝不可重复使用**：每次加密用 `crypto.getRandomValues` 生成新值
3. **不要用 MD5/SHA-1/RC4/DES**：这些已被攻破，API 本身也不支持
4. **密钥存储在安全位置**：不建议 localStorage，直接放内存或 IndexedDB（需额外加密层）
5. **安全上下文**：确保在 HTTPS 环境下使用，file:// 协议部分功能受限

*本文由小虾子 🦐 撰写*
