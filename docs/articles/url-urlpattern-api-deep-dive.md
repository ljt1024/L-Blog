# URL / URLPattern API 深度解析：浏览器原生 URL 处理完全指南

## 前言

每个前端工程师每天都在和 URL 打交道。你可能写过无数次的：

```javascript
// 手动拼接 —— 痛苦、容易出错
const url = 'https://api.example.com/users/' + userId + '?page=' + page + '&limit=' + limit;

// 字符串替换 —— 脆弱
const url = '/users/:id?page=:page'.replace(':id', userId).replace(':page', page);
```

这些「土办法」的问题在于：**URL 的结构被当成字符串处理，而不是有语义的结构化对象**。

`URL` 和 `URLPattern` API 正是为此而生。它们是浏览器原生的 URL 解析与匹配工具，让 URL 操作从字符串操作升级为语义安全的 API 调用。

> 很多人以为这些 API 不过是 `new URL()` 这么简单，但 `URL` 构造函数的细节、`blob:` URL 的生命周期、`URLPattern` 的路由匹配能力，你可能从未真正掌握。

## 一、URL 构造函数的细节

### 1.1 基础用法

```javascript
const url = new URL('/users', 'https://api.example.com');
// https://api.example.com/users ✅

const url2 = new URL('https://api.example.com/users?id=1');
// 直接解析完整 URL
```

### 1.2 相对 URL 的解析规则

`URL` 构造函数接受两个参数：`input`（输入）和 `base`（基准）。这里有几个容易踩坑的点：

```javascript
// 相对路径：相对于 base
new URL('/users', 'https://api.example.com/a/b'); // → https://api.example.com/users ✅
// 注意：/users 不继承 b，而是回到根路径！

// 只有相对路径（无前导 /）：从 base 路径继承
new URL('users', 'https://api.example.com/a/b');   // → https://api.example.com/a/users ✅
new URL('./users', 'https://api.example.com/a/b'); // → https://api.example.com/a/users ✅
new URL('../users', 'https://api.example.com/a/b'); // → https://api.example.com/users ✅

// 数据 URL
new URL('data:text/plain,hello');                  // ✅ 支持
new URL('javascript:alert(1)');                    // ✅ 支持（但会被标记）

// 绝对路径（带协议）
new URL('//cdn.example.com/img.png', 'https://a.com'); // → https://cdn.example.com/img.png
```

### 1.3 构造失败与 URL.canParse()

直接用 `new URL()` 构造无效 URL 会抛出异常：

```javascript
try {
  new URL('not-a-url');
} catch (e) {
  e instanceof TypeError; // ✅
}

// 用 canParse 安全检查（推荐用于用户输入）
if (URL.canParse(userInput, window.location.origin)) {
  const url = new URL(userInput, window.location.origin);
  // ...
}
```

> `URL.canParse()` 是现代浏览器的安全网——先检查再构造，避免 try-catch 的样板代码。

## 二、URL 的组成部分：属性全览

`URL` 实例的每个部分都有独立的 getter/setter，直接赋值即可修改 URL：

```javascript
const url = new URL('https://user:pass@api.example.com:8080/path/to/resource?foo=1&foo=2#section');

url.protocol;   // 'https:'
url.host;       // 'api.example.com:8080'
url.hostname;   // 'api.example.com'（不含端口）
url.port;       // '8080'
url.pathname;   // '/path/to/resource'
url.search;     // '?foo=1&foo=2'
url.hash;       // '#section'
url.username;   // 'user'
url.password;   // 'pass'
url.origin;     // 'https://api.example.com:8080'（只读，无法赋值）

// ⚠️ hostname 不含端口，host 含端口，origin 才是完整来源
```

**直接赋值修改 URL**：

```javascript
url.port = '9090';    // → https://user:pass@api.example.com:9090/path/to/resource?...
url.search = '?page=2'; // → https://.../?page=2
url.pathname = '/new';   // → https://.../new?page=2
url.hash = '';          // 移除 hash
```

修改后整个 URL 会实时更新——这对动态构建 URL 非常方便。

### 2.1 origin 的特殊性

`origin` 是**只读**的，你无法直接赋值：

```javascript
url.origin = 'https://other.com'; // 静默无效，不报错！
// 正确方式：重新构造
const newUrl = new URL(url.href);
newUrl.hostname = 'other.com';
```

## 三、searchParams：URLSearchParams 的完整能力

`url.searchParams` 是 `URLSearchParams` 实例，它让查询参数的处理变得优雅：

```javascript
const url = new URL('https://api.example.com/search?q=react&page=1&lang=en');

url.searchParams.get('q');       // 'react'
url.searchParams.getAll('lang'); // ['en'] — getAll 返回数组
url.searchParams.has('page');    // true
url.searchParams.keys();         // URLSearchParamsIterator { 'q', 'page', 'lang' }
url.searchParams.values();       // URLSearchParamsIterator { 'react', '1', 'en' }
url.searchParams.entries();       // URLSearchParamsIterator { ['q', 'react'], ... }
url.searchParams.toString();     // 'q=react&page=1&lang=en'
```

### 3.1 增删改查

```javascript
// 添加参数（不删除同名参数）
url.searchParams.append('tag', 'frontend'); // ?q=react&...&tag=frontend

// 设置参数（覆盖同名参数）
url.searchParams.set('tag', 'js');          // ?q=react&...&tag=js

// 删除参数
url.searchParams.delete('tag');

// 排序（按 key 字母顺序）
url.searchParams.sort();

// 删除所有参数
url.searchParams = new URLSearchParams();
```

### 3.2 常见错误：重复参数

```javascript
// ❌ 常见错误：直接拼接导致重复参数
url.search += '&page=2'; // 之前已有 page=1，变成 ?q=react&page=1&page=2

// ✅ 正确：用 searchParams API
url.searchParams.set('page', '2');
```

### 3.3 自动编码：不需要手动 encodeURIComponent

```javascript
url.searchParams.set('q', 'React & Vue');     // ✅ 自动编码为 'React%20%26%20Vue'
url.searchParams.set('tag', 'node.js, react'); // ✅ 自动编码

// url.search 现在是 ?q=React%20%26%20Vue&...
// 读取时自动解码
url.searchParams.get('q'); // 'React & Vue' ✅
```

### 3.4 从对象一键生成查询参数

```javascript
const params = { q: 'react hooks', page: 1, limit: 20 };
const url = new URL('https://api.example.com/search');
Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
url.href; // https://api.example.com/search?q=react%20hooks&page=1&limit=20
```

更简洁的写法——用 `URLSearchParams` 构造函数直接接受对象：

```javascript
const params = new URLSearchParams({ q: 'react', page: 1 });
// URLSearchParams 构造函数接受 Record<string, string> 或 迭代器
// 但注意：数字会被 toString() 转成字符串
```

## 四、Blob URL / Object URL：内存中的临时链接

`URL.createObjectURL()` 从 `Blob` 或 `File` 生成一个 `blob:` URL，用于在浏览器中引用内存中的二进制数据：

```javascript
// 从 File input 获取文件
const file = fileInput.files[0];
const blobUrl = URL.createObjectURL(file);
// → 'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000'

// 用于 img/video/audio 或 fetch
img.src = blobUrl;  // ✅
video.src = blobUrl; // ✅
```

### 4.1 生命周期：必须手动释放

**这是最容易踩的坑。** `blob:` URL 是内存引用，不会被浏览器自动垃圾回收。你必须手动释放：

```javascript
const blobUrl = URL.createObjectURL(file);

// 不用时必须释放，否则内存泄漏
URL.revokeObjectURL(blobUrl);
```

**生命周期管理最佳实践：**

```javascript
class MediaPreview {
  #blobUrl = null;

  loadFile(file) {
    this.#release();  // 先释放旧的
    this.#blobUrl = URL.createObjectURL(file);
    this.#img.src = this.#blobUrl;
  }

  #release() {
    if (this.#blobUrl) {
      URL.revokeObjectURL(this.#blobUrl);
      this.#blobUrl = null;
    }
  }

  destroy() {
    this.#release();
    this.#img = null;
  }
}
```

### 4.2 blob URL 与跨域

`blob:` URL 是同源策略的——它只能在创建它的页面中使用。如果你在 `iframe` 中创建，`blob:` URL 不能被父页面访问。

对于**跨域的 blob 数据**，使用 `URL.createObjectURL` 之前请三思。更好的方案是：

```javascript
// 跨域文件预览：用 fetch + blob + blob: URL（需后端 CORS 支持）
const res = await fetch(corsEnabledUrl, { mode: 'cors' });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
```

## 五、URLPattern：路由匹配与路由提取

`URLPattern` 是 2022 年新加入 Web 平台的 API，用于**匹配 URL 路径或检测 URL 是否符合某种模式**。它最初是浏览器为 CDD（Custom Elements）设计，后来扩展为通用 URL 匹配工具。

### 5.1 基础匹配

```javascript
// 匹配一个 URL pattern
const pattern = new URLPattern({
  pathname: '/users/:id/posts/:postId',
  hash: ''
});

const result = pattern.test('https://example.com/users/42/posts/100');
result; // true ✅

// 非匹配
pattern.test('https://example.com/users/42/comments/5'); // false ❌
```

### 5.2 提取参数（最有价值的部分）

```javascript
const pattern = new URLPattern({
  pathname: '/users/:userId/posts/:postId',
  search: '?page=:page',
  hash: ''
});

const result = pattern.exec('https://example.com/users/42/posts/99?page=3');
// result 中包含提取的参数！

result.pathname.groups;
// { userId: '42', postId: '99' }

result.search.groups;
// { page: '3' }

result.url.href;
// 完整 URL
```

### 5.3 精确匹配 vs 通配符

```javascript
// :name —— 命名段，匹配任意字符（非 /）
// * —— 零个或多个字符（跨越路径段）
// (regex) —— 内联正则

// 匹配 /articles/2024/03/15 这种路径
const datePattern = new URLPattern({
  pathname: '/articles/:year/:month/:day'
});
datePattern.test('/articles/2024/03/15'); // true ✅
datePattern.test('/articles/2024/03');   // false ✅（段数不同）

// 匹配任意 /api 下所有路径
const apiPattern = new URLPattern({ pathname: '/api/*' });
apiPattern.test('/api/users');       // true
apiPattern.test('/api/users/42');    // true

// 正则段（带约束）
const idPattern = new URLPattern({
  pathname: '/users/:id(\\d+)'  // 只匹配数字
});
idPattern.test('/users/42');    // true
idPattern.test('/users/abc');  // false
```

### 5.4 在路由框架中使用 URLPattern

手写路由匹配费时费力，`URLPattern` 让路由注册变得简洁：

```javascript
// 轻量级路由实现
class Router {
  #routes = [];

  add(method, pattern, handler) {
    this.#routes.push({
      method: method.toUpperCase(),
      pattern: new URLPattern({ pathname: pattern }),
      handler
    });
  }

  navigate(url) {
    const method = 'GET';
    for (const route of this.#routes) {
      if (route.method !== method) continue;

      const match = route.pattern.exec(url);
      if (match) {
        route.handler({ params: match.pathname.groups, search: match.search.groups });
        return;
      }
    }
    console.warn('No route matched:', url);
  }
}

const router = new Router();
router.add('GET', '/users/:userId/posts/:postId', ({ params }) => {
  console.log(`加载用户 ${params.userId} 的帖子 ${params.postId}`);
});

router.navigate('https://app.com/users/5/posts/99');
// 加载用户 5 的帖子 99
```

## 六、实战一：安全构建 API URL（防止注入）

拼接 URL 参数时，`searchParams` 的自动编码是安全的基础：

```javascript
// ❌ 危险：手动拼接导致 URL 注入
const bad = `${baseUrl}?q=${query}&page=${page}`;
// query = 'react&xss=<script>alert(1)</script>'
// → ?q=react&xss=<script>alert(1)</script>&page=1

// ✅ 安全：searchParams 自动处理转义
function buildSearchUrl(baseUrl, { q, page, sort }) {
  const url = new URL(baseUrl);
  if (q)     url.searchParams.set('q', q);
  if (page)  url.searchParams.set('page', String(page));
  if (sort)  url.searchParams.set('sort', sort);
  return url.href;
}
```

## 七、实战二：URL 重构迁移

产品改版中 URL 结构变了，但需要兼容旧链接：

```javascript
// 旧格式：/article?id=123
// 新格式：/articles/:id

const legacyPattern = new URLPattern({ pathname: '/article', search: '?id=:id' });
const currentPattern = new URLPattern({ pathname: '/articles/:id' });

function migrateLegacyUrl(legacyUrl) {
  const match = legacyPattern.exec(legacyUrl);
  if (match) {
    const { id } = match.search.groups;
    return `https://yourblog.com/articles/${id}`;
  }
  return legacyUrl;
}
```

## 八、实战三：多条件搜索（带分页的 Filter Builder）

```javascript
function buildFilterUrl(baseUrl, filters) {
  const url = new URL(baseUrl);
  const { category, minPrice, maxPrice, q, sort, page } = filters;

  if (category)  url.searchParams.set('category', category);
  if (minPrice)  url.searchParams.set('min_price', String(minPrice));
  if (maxPrice)  url.searchParams.set('max_price', String(maxPrice));
  if (q)         url.searchParams.set('q', q);
  if (sort)      url.searchParams.set('sort', sort);
  if (page)      url.searchParams.set('page', String(page));

  // 保持现有参数（如来源追踪参数 utm_*）
  return url.href;
}

// 使用：用户勾选了「电子产品」「价格 100-500」「排序为销量」
const searchUrl = buildFilterUrl('https://shop.com/products', {
  category: 'electronics',
  minPrice: 100,
  maxPrice: 500,
  sort: 'sales',
  page: 1
});
```

## 九、实战四：文件下载（带进度）

```javascript
async function downloadFile(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();

  // 创建 blob URL 并触发下载
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // 立即清理
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  return blob;
}
```

## 十、URL API 与 URLPattern 的浏览器支持

| API | Chrome | Edge | Firefox | Safari |
|-----|--------|------|---------|--------|
| `URL` 构造函数 | ✅ | ✅ | ✅ | ✅ |
| `URL.canParse()` | ✅ 120+ | ✅ 120+ | ✅ 120+ | ✅ 17+ |
| `URL.createObjectURL()` | ✅ | ✅ | ✅ | ✅ |
| `URL.revokeObjectURL()` | ✅ | ✅ | ✅ | ✅ |
| `URLPattern` | ✅ 102+ | ✅ 102+ | ✅ 118+ | ✅ 16.4+ |

对于旧版浏览器，`urlpattern-polyfill` npm 包可以提供兼容支持。

## 十一、总结

`URL` 和 `URLPattern` 构成了浏览器原生的 URL 处理基础设施：

- **`URL`**：结构化 URL 解析、查询参数 API、自动编码解码、Blob URL 生成与释放
- **`URLPattern`**：URL 路由匹配、参数提取、正则约束、通配符模式

两者结合，你不再需要任何第三方 URL 处理库。浏览器已经为你搭好了安全、高效、可组合的 URL 处理层。

> 性能提示：`URL` 实例创建成本很低，每次搜索参数操作都在内部重新解析字符串。对于性能敏感的循环场景（如处理上万个 URL），可考虑缓存复用 `URL` 实例。

---

*本文由小虾子 🦐 撰写*
