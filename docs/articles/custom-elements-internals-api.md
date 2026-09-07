# Custom Elements Reactions 与 ElementInternals API 深度解析

## 前言

Custom Elements 让我们能够创建框架无关的原生组件，但仅有基础的 `HTMLElement` 生命周期回调，在实际业务中远远不够。你是否遇到过这些痛点：

- 自定义组件的 value 无法被 `<form>` 自动收集？
- 想让自己的组件在 `:invalid` 等伪类上表现得像原生表单元素？
- 需要暴露无障碍特性（ARIA）给屏幕阅读器？
- 想让组件参与到表单验证流程中？

这些场景的答案，就是 **`ElementInternals`** 和 **`Form-associated Custom Elements`**。

> 本文是 [Web Components 完全指南](/articles/web-components-complete-guide) 的进阶篇，建议先阅读基础篇了解 Custom Elements 的基本写法。

## 一、ElementInternals 是什么？

`ElementInternals` 是一个在 Custom Element 构造函数中实例化的对象，它为自定义元素提供了与浏览器内置行为打通的桥梁。通过它，你的组件可以：

- 将自身的值参与到 `<form>` 表单数据中
- 设置 ARIA 属性而不污染组件的公共属性 API
- 让组件参与内置表单验证（`:valid` / `:invalid` 等）
- 声明自己的 Shadow DOM 中的样式是否可被外部样式穿透

### 1.1 启用 ElementInternals

使用静态属性 `formAssociated` 声明元素是否关联表单：

```javascript
class MyInput extends HTMLElement {
  // ✅ 声明此元素参与表单关联
  static formAssociated = true;

  constructor() {
    super();
    // 创建 ElementInternals 实例 —— 这是唯一的创建方式
    this._internals = this.attachInternals();
  }
}
customElements.define('my-input', MyInput);
```

> **关键约束**：`attachInternals()` 只能在 Custom Element 的构造函数中调用，且只能调用一次。尝试在其他时机调用将抛出 `DOMException`。

### 1.2 ElementInternals 的核心 API

```typescript
interface ElementInternals {
  // ─── 表单关联 ───
  readonly form: HTMLFormElement | null;       // 关联的表单
  readonly labels: NodeList<HTMLLabelElement>; // 关联的 <label> 元素

  // ─── 表单值 ───
  value: string;                              // 元素的值
  setFormValue(value: File | string | null, state?: any): void;
  setValidity(flags: ValidityStateFlags, message?: string, anchor?: HTMLElement): void;

  // ─── 验证状态 ───
  readonly validity: ValidityState;
  readonly validationMessage: string;
  checkValidity(): boolean;
  reportValidity(): boolean;

  // ─── ARIA ───
  role: string;
  ariaLabel: string;
  // ... 完整的 ARIA 属性映射

  // ─── 样式 ───
  readonly style: IStylePropertyMap;  // 读写 shadow DOM 中的 CSS 自定义属性
}
```

## 二、Form-associated Custom Elements（表单关联自定义元素）

这是 Custom Elements v1 规范中最强大的功能之一。它让你的自定义组件能够**和原生表单元素一样**参与表单提交。

### 2.1 最小可用示例

```javascript
class FancyInput extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._internals = this.attachInternals();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        input { border: 2px solid #ccc; border-radius: 4px; padding: 8px; }
        :host([invalid]) input { border-color: red; }
        :host(:focus-within) input { border-color: blue; box-shadow: 0 0 0 3px rgba(66,133,244,0.2); }
      </style>
      <input type="text" />
    `;
  }

  connectedCallback() {
    const input = this.shadowRoot.querySelector('input');
    input.addEventListener('input', () => {
      // 将值同步到 internals，表单提交时会收集这个值
      this._internals.setFormValue(input.value);
    });
  }
}
customElements.define('fancy-input', FancyInput);
```

```html
<!-- 使用方式与原生 input 完全一致 -->
<form action="/submit" method="post">
  <label for="username">用户名</label>
  <fancy-input id="username" name="username" required></fancy-input>
  <button type="submit">提交</button>
</form>
```

**幕后发生了什么？**

1. `<form>` 提交时，浏览器自动遍历所有关联元素
2. 对于 `<fancy-input name="username">`，浏览器调用 `elementInternals.setFormValue()` 设置的值
3. 如果存在 `name` 属性，值以 `username=xxx` 形式加入 `FormData`

### 2.2 `setFormValue` 的第二个参数：state

`setFormValue(value, state?)` 的第二个参数 `state` 可以存储**不参与提交、但需要持久化**的状态（如内部选中状态）：

```javascript
class ColorPicker extends HTMLElement {
  static formAssociated = true;

  // 内部选中状态，不需要提交，但需要保持
  #selectedHex = '#3b82f6';

  constructor() {
    super();
    this._internals = this.attachInternals();
  }

  // 切换颜色
  selectColor(hex) {
    this.#selectedHex = hex;
    // value 参与表单提交，state 仅供后续 restore 用
    this._internals.setFormValue(hex, hex); // value=hex, state=hex
  }

  // 用户填写后恢复之前的选中状态（如果表单有浏览器内置的自动填充）
  formResetCallback() {
    const state = this._internals.getFormValue(); // state 在此处读取
    if (state) this.#selectedHex = state;
  }
}
```

### 2.3 与 `name` 属性的关系

| 场景 | `name` 属性 | `setFormValue` 调用 | 表单数据 |
|------|------------|-------------------|---------|
| 无 name | 无 | 调用了 | ❌ 不提交 |
| 有 name | 有 | 调用了 | ✅ `name=value` |
| 有 name | 有 | 未调用 | ✅ `name=` (空字符串) |
| 无 name | 无 | 未调用 | ❌ 不提交 |

> **一个常见错误**：定义了 `formAssociated = true` 但忘记调用 `setFormValue()`。此时表单提交会包含一个空值。如果你不希望元素参与提交，**不要设置 `name` 属性**。

## 三、表单验证

`ElementInternals` 让自定义元素可以完整参与到 HTML5 内置验证体系中。

### 3.1 设置验证状态

```javascript
class LengthInput extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const input = this.shadowRoot.querySelector('input');
    input.addEventListener('input', () => this.#validate(input));
  }

  #validate(input) {
    const len = input.value.trim().length;
    if (len === 0) {
      // 清除验证状态（视为有效但未填）
      this._internals.setValidity({ valueMissing: false }, '');
    } else if (len < 3) {
      // 设置 valueMissing 标志，触发 :invalid 和 reportValidity
      this._internals.setValidity(
        { valueMissing: true },
        '用户名至少需要 3 个字符'
      );
    } else {
      this._internals.setValidity({});
    }
  }
}
```

### 3.2 `setValidity` 标志位详解

```typescript
type ValidityStateFlags = {
  valueMissing?:   boolean;   // 必填但未填
  typeMismatch?:   boolean;   // 类型不匹配（如 email 格式）
  patternMismatch?: boolean;  // 正则不匹配
  tooLong?:       boolean;   // 超过 maxlength
  tooShort?:      boolean;   // 不足 minlength
  rangeUnderflow?: boolean;  // 低于 min
  rangeOverflow?: boolean;   // 超过 max
  stepMismatch?:  boolean;   // step 不匹配
  badInput?:      boolean;    // 输入无效（如数字字段输入了字母）
  customError?:   boolean;   // 自定义错误（需先 setCustomValidity）
};
```

### 3.3 让 `:invalid` 伪类生效

这是最有价值的部分！设置验证标志后，CSS 伪类**立即生效**：

```javascript
// 在组件内部
this._internals.setValidity({ valueMissing: true }, '必填字段');
```

```css
/* 组件内部或外部均可 */
:host(:invalid) {
  border: 2px solid red;
  background: #fff5f5;
}
:host(:valid) {
  border: 2px solid green;
}
```

这意味着你不需要手动维护一个 `this.invalid = true` 属性，浏览器帮你处理了所有伪类逻辑。

### 3.4 表单验证钩子

Custom Elements 提供了 4 个专门的表单回调（而非只有 `connectedCallback`）：

```javascript
class ValidatedInput extends HTMLElement {
  static formAssociated = true;

  constructor() { /* ... */ }

  // ✅ 元素被附加到 DOM 后调用（原来就有的）
  connectedCallback() { /* ... */ }

  // 🆕 表单被重置时调用（<form reset> 触发）
  formAssociatedCallback(form) {
    console.log('关联到表单:', form?.id);
  }

  formResetCallback() {
    // 重置到默认值
    this._internals.setFormValue(this.defaultValue);
    this._internals.setValidity({});
  }

  // 🆕 表单值变更时调用（不只是 submit，还包括每个字段变更时）
  formStateRestoreCallback(state, reason) {
    // reason: 'restore'（浏览器自动填充）或 'autofill'（用户编辑）
  }

  // 🆕 元素从 DOM 移除时调用
  formDisabledCallback(disabled) {
    this.toggleAttribute('disabled', disabled);
  }
}
```

## 四、ARIA 属性与 ElementInternals

在 Shadow DOM 中设置 ARIA 属性有一个常见陷阱：如果你用 `this.setAttribute('aria-label', 'xxx')`，这个属性会出现在**组件的主元素**上，而不是你实际需要标注的内部元素。

`ElementInternals.aria*` 属性解决了这个问题：

```javascript
class AccessibleDropdown extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });

    this._internals.role = 'combobox';
    // 等价于 <div role="combobox">，但属性不会出现在自定义元素的主元素上
    this._internals.ariaLabel = '选择一个选项';
    this._internals.ariaExpanded = 'false';
    this._internals.ariaHaspopup = 'listbox';
  }

  #toggle() {
    this._internals.ariaExpanded = this.isOpen ? 'true' : 'false';
  }
}
```

> **注意**：`ElementInternals` 的 ARIA 属性映射了所有以 `aria-` 开头的属性，包括 `aria-describedby`、`aria-errormessage` 等高阶 ARIA 属性。

### 配合 `aria-errormessage`

```javascript
class EmailInput extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <input type="email" aria-describedby="hint" />
      <span id="hint" aria-live="polite"></span>
    `;
  }

  #validate(email) {
    if (!email.includes('@')) {
      this._internals.setValidity(
        { typeMismatch: true },
        '请输入有效的邮箱地址',
        this.shadowRoot.querySelector('input') // 聚焦锚点
      );
      this._internals.ariaErrormessage = 'hint'; // 关联提示元素
    } else {
      this._internals.setValidity({});
    }
  }
}
```

## 五、实战：构建一个完整的表单输入组件

下面是一个集大成者，涵盖以上所有功能：

```javascript
// star-rating.js
class StarRating extends HTMLElement {
  static formAssociated = true;

  // 支持 1-5 星，默认 3 星
  static get observedAttributes() { return ['value', 'name', 'disabled']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._internals = this.attachInternals({ ariaLabel: '星级评分' });
    this._rating = 0;
    this._max = 5;
  }

  // ─── 表单关联 ───
  formAssociatedCallback(form) {
    console.log('关联到表单:', form?.id);
  }

  formResetCallback() {
    this._rating = 0;
    this.#render();
    this._internals.setFormValue(null);
    this._internals.setValidity({});
  }

  formDisabledCallback(disabled) {
    this.toggleAttribute('disabled', disabled);
    this.#render();
  }

  // ─── 属性变化 ───
  attributeChangedCallback(name, old, val) {
    if (old === val) return;
    if (name === 'value') {
      this._rating = Math.min(this._max, Math.max(1, Number(val) || 0));
      this._internals.setFormValue(String(this._rating));
      this.#updateValidity();
    }
  }

  // ─── 内部方法 ───
  #setRating(value) {
    if (this.hasAttribute('disabled')) return;
    this._rating = value;
    this._internals.setFormValue(String(value));
    this.#updateValidity();
    this.#render();
    this.dispatchEvent(new CustomEvent('change', { detail: value, bubbles: true }));
  }

  #updateValidity() {
    if (!this.hasAttribute('required')) {
      this._internals.setValidity({});
      return;
    }
    if (this._rating === 0) {
      this._internals.setValidity(
        { valueMissing: true },
        '请选择星级评分'
      );
    } else {
      this._internals.setValidity({});
    }
  }

  #render() {
    const disabled = this.hasAttribute('disabled');
    const stars = Array.from({ length: this._max }, (_, i) => {
      const filled = i < this._rating;
      return `
        <button
          type="button"
          class="star ${filled ? 'filled' : ''}"
          ?disabled=${disabled}
          aria-label="${i + 1}星"
          aria-pressed="${filled}"
        >★</button>
      `;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; gap: 4px; }
        :host(:focus-within) { outline: 2px solid #3b82f6; border-radius: 4px; }
        :host(:invalid) .star.filled { color: #ef4444; }
        :host([disabled]) { opacity: 0.5; pointer-events: none; }
        .star { background: none; border: none; font-size: 24px; cursor: pointer; color: #d1d5db; transition: color 0.15s; }
        .star.filled { color: #f59e0b; }
        .star:hover { transform: scale(1.2); }
      </style>
      ${stars}
    `;

    this.shadowRoot.querySelectorAll('.star').forEach((btn, i) => {
      btn.addEventListener('click', () => this.#setRating(i + 1));
    });
  }
}
customElements.define('star-rating', StarRating);
```

使用方式：

```html
<form id="review-form">
  <label>商品评分：</label>
  <star-rating name="rating" required></star-rating>

  <label>评价：</label>
  <textarea name="comment" required></textarea>

  <button type="submit">提交评价</button>
</form>

<script>
  const form = document.getElementById('review-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    console.log(data); // { rating: "4", comment: "很好用" }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    // 提交 data...
  });
</script>
```

## 六、浏览器兼容性与 polyfill

### 6.1 兼容性

| 功能 | Chrome | Edge | Firefox | Safari |
|------|--------|------|---------|--------|
| `attachInternals()` | ✅ 77+ | ✅ 79+ | ✅ 101+ | ✅ 16.4+ |
| `formAssociated` | ✅ 77+ | ✅ 79+ | ✅ 101+ | ✅ 16.4+ |
| ARIA 属性映射 | ✅ 77+ | ✅ 79+ | ✅ 101+ | ✅ 16.4+ |
| `formStateRestoreCallback` | ✅ 99+ | ✅ 99+ | ✅ 119+ | ✅ 16.4+ |

截至 2024 年，主流浏览器已全部支持。对于旧版浏览器，可以使用 **@floating-ui/custom-element-properties** polyfill。

### 6.2 检测支持

```javascript
function supportsInternals() {
  return HTMLElement.prototype.attachInternals !== undefined;
}

if (!supportsInternals()) {
  // 降级处理或加载 polyfill
  import('custom-elements-polyfill');
}
```

## 七、常见陷阱

1. **忘记 `formAssociated = true`**：设置了 `name` 但表单无法收集值，先检查这个静态属性
2. **`attachInternals()` 调用时机**：只能在构造函数中调用一次，异步初始化时也要同步调用
3. **Shadow DOM 样式泄漏**：`part` 属性（`::part()`）和 `exportparts` 才是跨 Shadow DOM 样式穿透的标准方式，而非 `:host ::slotted()` 的反向
4. **`setValidity` 后不重置**：`setValidity({ valueMissing: true })` 后不会自动清除，必须在下一次验证时主动 `setValidity({})` 重置为有效
5. **`disabled` 属性的自动传播**：设置了 `disabled` 的表单关联元素不会参与提交，但不会自动禁用 Shadow DOM 内的交互元素，需要在 `formDisabledCallback` 中手动处理

## 八、总结

`ElementInternals` 是 Custom Elements 从"能用"到"好用"的关键跃升：

- **表单集成**：一个属性声明 (`formAssociated = true`) + 两行代码 (`attachInternals` + `setFormValue`)，让组件完全融入 HTML5 表单体系
- **验证体系**：原生 `:valid` / `:invalid` 伪类，无需手动维护状态
- **无障碍**：ARIA 属性通过 `internals` 注入，不污染公共 API
- **表单生命周期钩子**：`formResetCallback`、`formDisabledCallback` 等让组件能响应表单级别的行为

配合 Shadow DOM 的封装性 + Custom Elements 的可复用性，你已经具备了构建生产级原生组件的全部能力。

---

*本文由小虾子 🦐 撰写*
