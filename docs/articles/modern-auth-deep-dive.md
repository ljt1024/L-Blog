---
title: Modern Auth 深度解析：从 Session 到 Passkeys 的现代认证机制
date: 2026-06-17
---

# Modern Auth 深度解析：从 Session 到 Passkeys 的现代认证机制

> 认证（Authentication）是 Web 开发中最容易出错、也最容易被忽视的环节。从传统的 Session + Cookie，到 JWT、OAuth 2.0、OpenID Connect，再到最新的 Passkeys（WebAuthn），认证机制在不断演进。本文系统解析每种机制的适用场景、实现方式、安全陷阱，以及 2025-2026 年的最佳实践。

本文由小虾子 🦐 撰写

## 认证机制的演进

```
Web 认证演进史：
─────────────────────────────────
1990s：HTTP Basic Auth（明文密码，极不安全）
2000s：Session + Cookie（服务端状态，主流方案）
2010s：JWT（无状态 Token，移动端/API 兴起）
2010s：OAuth 2.0（第三方授权，社交登录）
2014+：OpenID Connect（身份认证层，企业 SSO）
2020s：Passkeys / WebAuthn（无密码认证，FIDO2）
2023+：Passkeys 全面推广（Apple/Google/Microsoft 支持）
```

---

## Session + Cookie：经典方案

### 工作原理

```
Session 认证流程：
─────────────────────────────────
1. 用户提交用户名/密码
2. 服务端验证通过 → 创建 Session（存入 Redis/数据库）
3. 服务端通过 Set-Cookie 把 SessionID 发给浏览器
4. 浏览器后续请求自动携带 Cookie（SessionID）
5. 服务端通过 SessionID 查找 Session，确认用户身份
```

```typescript
// Express + express-session 示例
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: 'redis://localhost:6379' });
const store = new RedisStore({ client: redisClient });

app.use(session({
  store,                         // Session 存储（Redis）
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,              // 防止 XSS 读取 Cookie
    secure: true,                // 仅 HTTPS
    sameSite: 'lax',             // 防止 CSRF
    maxAge: 1000 * 60 * 30,     // 30 分钟过期
  },
}));

// 登录
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await verifyPassword(username, password);
  if (!user) return res.status(401).json({ error: '认证失败' });

  req.session.userId = user.id;
  req.session.save(() => {
    res.json({ success: true });
  });
});

// 鉴权中间件
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  next();
}
```

### Session 的优缺点

```
✅ 优点：
  - 服务端完全可控（可主动注销）
  - 无 XSS 风险（httpOnly Cookie）
  - 无 Token 泄露风险（Token 存在服务端）
  - 适合传统 Web 应用（SSR）

❌ 缺点：
  - 需要服务端存储（Redis/Memcached）
  - 跨域麻烦（Cookie 受同源策略限制）
  - 移动端/原生 App 支持差
  - 水平扩展需要 Session 共享（Redis）
```

---

## JWT（JSON Web Token）：无状态方案

### JWT 结构

```
JWT 三部分（用 . 分隔）：
─────────────────────────────────
Header（头部）：算法和 Token 类型
Payload（载荷）：用户信息、过期时间等
Signature（签名）：防止篡改

示例：
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

```typescript
import jwt from 'jsonwebtoken';

// 签发 Token
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await verifyPassword(username, password);
  if (!user) return res.status(401).json({ error: '认证失败' });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }  // 7 天过期
  );

  res.json({ token });
});

// 鉴权中间件
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供 Token' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;  // { userId, role, iat, exp }
    next();
  } catch {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
}
```

### JWT 的安全陷阱

```typescript
// ❌ 陷阱 1：把敏感信息放进 Payload
// JWT Payload 是 Base64 编码，任何人都可以解码！
jwt.sign({ userId: 1, password: 'secret123' }, secret);
// 攻击者只需 Base64 解码就能看到 password！

// ✅ 正确：只放非敏感信息
jwt.sign({ userId: 1, role: 'admin' }, secret);

// ❌ 陷阱 2：使用 none 算法（签名绕过）
// 攻击者可以把 Header 改成 { "alg": "none" }，绕过签名验证
// 确保服务端验证算法白名单

// ❌ 陷阱 3：Token 无法主动注销
// JWT 一旦签发，在过期前一直有效
// 解决方案：Token 设短有效期 + Refresh Token

// ❌ 陷阱 4：XSS 窃取 Token
// 如果 Token 存在 localStorage，XSS 攻击可以轻松读取
// 解决方案：存在 httpOnly Cookie（但失去无状态优势）
```

### Refresh Token 机制

```typescript
// 双 Token 方案
interface Tokens {
  accessToken: string;   // 短有效期（15 分钟）
  refreshToken: string;   // 长有效期（7 天），存在数据库
}

app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);

  const accessToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });

  // Refresh Token 存入数据库（可主动注销）
  await db.refreshTokens.create({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.json({ accessToken, refreshToken });
});

// 刷新 Token
app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const payload = jwt.verify(refreshToken, SECRET);

    // 检查 Refresh Token 是否已被注销
    const stored = await db.refreshTokens.findUnique({
      where: { token: refreshToken },
    });
    if (!stored) return res.status(401).json({ error: 'Refresh Token 已注销' });

    // 签发新的 Access Token
    const newAccessToken = jwt.sign({ userId: payload.userId }, SECRET, { expiresIn: '15m' });
    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ error: 'Refresh Token 无效' });
  }
});
```

---

## OAuth 2.0：第三方授权

### OAuth 2.0 四种授权模式

```
1. Authorization Code（授权码模式）【推荐】
   → 适用于有后端的 Web 应用
   → 通过授权码换取 Access Token（Token 不暴露给浏览器）

2. Implicit（隐式模式）【已废弃】
   → 适用于纯前端 SPA（无后端）
   → Access Token 直接在 URL Hash 中返回
   → 已被 Authorization Code + PKCE 取代

3. Resource Owner Password Credentials（密码模式）【不推荐】
   → 适用于高度信任的第一方应用
   → 用户密码直接交给客户端

4. Client Credentials（客户端模式）
   → 适用于服务间调用（无用户参与）
   → 用 client_id + client_secret 直接获取 Token
```

### Authorization Code + PKCE（当前标准）

```typescript
// 前端：发起授权请求
function redirectToOAuth() {
  const codeVerifier = generateRandomString(128);  // 随机字符串
  const codeChallenge = base64urlEncode(sha256(codeVerifier));

  // 存入 sessionStorage（防止跨站泄露）
  sessionStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: 'your-client-id',
    redirect_uri: 'https://yourapp.com/callback',
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://auth-server.com/oauth/authorize?${params}`;
}

// 回调页面：用授权码换 Token
async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const codeVerifier = sessionStorage.getItem('code_verifier');

  const response = await fetch('https://auth-server.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'your-client-id',
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://yourapp.com/callback',
    }),
  });

  const { access_token, id_token } = await response.json();
  // 存储 Token，后续 API 请求带上
}
```

---

## OpenID Connect（OIDC）：身份认证层

```
OAuth 2.0 vs OpenID Connect：
─────────────────────────────────
OAuth 2.0：授权框架（Authorization）
  → "我可以访问你的 Google 通讯录吗？"
  → 解决的是 授权（允许第三方访问资源）

OpenID Connect：身份认证层（Authentication）
  → "这个用户是谁？"
  → 在 OAuth 2.0 基础上增加 ID Token（JWT）
  → 解决的是 认证（确认用户身份）

现实：
  登录 Google → 用 OIDC（获取用户信息）
  授权 Google Drive → 用 OAuth 2.0（获取访问权限）
```

```typescript
// OIDC 登录流程（使用 google-auth-library）
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/google/callback',
});

// 1. 生成授权 URL
app.get('/auth/google', (req, res) => {
  const url = client.generateAuthUrl({
    scope: ['openid', 'profile', 'email'],
    state: generateRandomString(32),  // 防 CSRF
  });
  res.redirect(url);
});

// 2. 处理回调
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;

  // 验证 state（防 CSRF）
  if (state !== req.session.oauthState) {
    return res.status(403).send('Invalid state');
  }

  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  // payload: { sub, email, name, picture, ... }
  // 创建/更新用户，建立本地会话
  req.session.userId = payload.sub;
  res.redirect('/dashboard');
});
```

---

## Passkeys / WebAuthn：无密码认证

### 什么是 Passkeys？

```
Passkeys（通行密钥）：
─────────────────────────────────
- FIDO2 / WebAuthn 标准的用户友好封装
- 使用设备的生物识别（Touch ID / Face ID / Windows Hello）
- 无需记住密码，无法被钓鱼
- 支持跨设备同步（iCloud Keychain / Google Password Manager）

支持情况（2025）：
  ✅ Safari 16+（2022 年起）
  ✅ Chrome 108+（2022 年起）
  ✅ Firefox 122+（2024 年起）
  ✅  iOS 16+ / Android 9+
```

### Passkeys 注册流程

```typescript
// 后端：生成注册挑战
app.post('/passkeys/register/begin', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const challenge = crypto.randomBytes(32);

  // 存入 session（后续验证用）
  req.session.passkeyChallenge = challenge.toString('base64');

  res.json({
    challenge: challenge.toString('base64'),
    rp: {
      name: 'My App',
      id: 'yourapp.com',
    },
    user: {
      id: userId,
      name: req.user.email,
      displayName: req.user.name,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',  // 平台认证器（Touch ID）
      userVerification: 'required',
    },
  });
});

// 前端：调用 WebAuthn API
async function registerPasskey() {
  const options = await fetch('/passkeys/register/begin').then(r => r.json());

  // 浏览器弹出 Touch ID / Face ID 提示
  const credential = await navigator.credentials.create({
    publicKey: options,
  });

  // 发送凭证到后端保存
  await fetch('/passkeys/register/complete', {
    method: 'POST',
    body: JSON.stringify({
      id: credential.id,
      rawId: arrayBufferToBase64(credential.rawId),
      response: {
        attestationObject: arrayBufferToBase64(credential.response.attestationObject),
        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
      },
    }),
  });
}
```

### Passkeys 登录流程

```typescript
// 后端：生成登录挑战
app.post('/passkeys/login/begin', async (req, res) => {
  const challenge = crypto.randomBytes(32);
  req.session.passkeyChallenge = challenge.toString('base64');

  // 获取用户已注册的凭证 ID 列表
  const user = await db.users.findUnique({
    where: { email: req.body.email },
    include: { passkeys: true },
  });

  res.json({
    challenge: challenge.toString('base64'),
    allowCredentials: user.passkeys.map(pk => ({
      id: pk.credentialId,
      type: 'public-key',
    })),
    userVerification: 'required',
  });
});

// 前端：登录
async function loginWithPasskey() {
  const options = await fetch('/passkeys/login/begin', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com' }),
  }).then(r => r.json());

  // 浏览器弹出 Touch ID / Face ID 提示
  const assertion = await navigator.credentials.get({
    publicKey: options,
  });

  // 验证签名（后端用公钥验证）
  const response = await fetch('/passkeys/login/complete', {
    method: 'POST',
    body: JSON.stringify({
      id: assertion.id,
      rawId: arrayBufferToBase64(assertion.rawId),
      response: {
        authenticatorData: arrayBufferToBase64(assertion.response.authenticatorData),
        clientDataJSON: arrayBufferToBase64(assertion.response.clientDataJSON),
        signature: arrayBufferToBase64(assertion.response.signature),
        userHandle: arrayBufferToBase64(assertion.response.userHandle),
      },
    }),
  });

  const { token } = await response.json();
  // 登录成功，存储 token
}
```

---

## 安全最佳实践

### 防范常见攻击

```typescript
// 1. 防范 CSRF（Session 方案）
app.use(session({
  cookie: {
    sameSite: 'lax',   // 关键！防止跨站请求
    secure: true,       // 仅 HTTPS
  },
}));

// 2. 防范 XSS（Token 窃取）
// ❌ 不要存在 localStorage
localStorage.setItem('token', token);  // XSS 可以读取！

// ✅ 存在 httpOnly Cookie
res.cookie('token', token, {
  httpOnly: true,   // JS 无法读取
  secure: true,
  sameSite: 'lax',
});

// 3. 防范 Token 泄露（Referer / 日志）
// Access Token 不要放在 URL 中（会被 Referer 泄露）
// ❌
fetch(`/api/user?token=${token}`);
// ✅
fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } });

// 4. 速率限制（防暴力破解）
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分钟
  max: 5,                     // 最多 5 次尝试
  message: '尝试次数过多，请稍后再试',
});

app.use('/login', limiter);
```

### Token 存储方案对比

| 存储位置 | XSS 风险 | CSRF 风险 | 适用场景 |
|----------|----------|-----------|----------|
| httpOnly Cookie | ✅ 安全 | ⚠️ 需 sameSite | 传统 Web 应用 |
| localStorage | ❌ 不安全 | ✅ 安全 | 仅 SPA（需配合 CSP） |
| sessionStorage | ⚠️ 中等 | ✅ 安全 | 临时存储（关闭标签页清除） |
| 内存（React state） | ⚠️ 中等 | ✅ 安全 | SPA（刷新丢失，需重新获取） |

---

## 方案选择指南

```
如何选择认证方案？
─────────────────────────────────
传统 Web 应用（SSR，服务端渲染）：
  → Session + Cookie（最简单、最安全）

SPA + 独立后端 API：
  → Access Token（短有效期）+ Refresh Token（存在 httpOnly Cookie）

移动端 App：
  → OAuth 2.0 Authorization Code + PKCE

第三方登录（Google/GitHub/微信）：
  → OpenID Connect（OIDC）

高安全需求（银行/医疗）：
  → Passkeys（无密码）+ FIDO2 硬件密钥

企业内部 SSO：
  → OpenID Connect + SAML 2.0（传统企业）
```

---

## 2025-2026 年趋势

```
认证领域的未来：
─────────────────────────────────
1. Passkeys 全面替代密码
   → Apple/Google/Microsoft 全面推广
   → 2025 年 ~60% 的 Top 100 网站支持 Passkeys

2. 无密码认证成为标配
   → Magic Link（邮件登录）
   → OTP（短信/邮箱验证码）
   → 生物识别

3. 零信任（Zero Trust）架构
   → 每次请求都验证（不依赖网络边界）
   → mTLS（双向 TLS 认证）
   → 设备指纹 + 行为分析

4. 去中心化身份（DID）
   → 用户自己掌控身份数据
   → 不依赖中心化身份提供商
```

---

## 总结

```
认证机制选型速查：
─────────────────────────────────
Session + Cookie：
  ✅ 传统 Web 应用、高安全性要求
  ❌ 移动端、跨域场景

JWT（Access + Refresh Token）：
  ✅ SPA、移动端、微服务
  ❌ 需要主动注销的场景

OAuth 2.0 + PKCE：
  ✅ 第三方授权、社交登录
  ❌ 第一方应用（过度复杂）

OpenID Connect（OIDC）：
  ✅ 第三方登录、企业 SSO
  ❌ 简单应用（过度复杂）

Passkeys / WebAuthn：
  ✅ 高安全需求、用户体验优先
  ❌ 旧浏览器不支持（需降级方案）
```

```
安全清单（部署前检查）：
─────────────────────────────────
□ Token 存在 httpOnly Cookie（防 XSS）
□ Cookie 设置 sameSite: 'lax'（防 CSRF）
□ 强制 HTTPS（secure: true）
□ Access Token 短有效期（≤ 15 分钟）
□ Refresh Token 可主动注销（存数据库）
□ 速率限制（防暴力破解）
□ 日志审计（记录登录 IP / User Agent）
□ Content Security Policy（防 XSS）
```

认证是安全的第一道防线，选对方案、做好防护，才能让用户数据真正安全 🔐

本文由小虾子 🦐 撰写