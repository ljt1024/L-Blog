# Vue 3 自定义指令详解

Vue.js 提供了一种机制，允许我们自定义指令来操作 DOM 元素。虽然 Vue 推荐使用组件来构建用户界面，但在某些情况下，我们仍然需要直接操作 DOM，这时自定义指令就派上用场了。

## 什么是自定义指令？

在 Vue 中，指令是以 `v-` 前缀开头的特殊属性，用于指示 Vue 在其绑定的元素上执行某些操作。除了 Vue 内置的指令（如 `v-model`、`v-show`、`v-if` 等），Vue 还允许我们注册自定义指令来满足特定需求。

常见的使用场景包括：
- 对 DOM 元素进行底层操作
- 复用涉及 DOM 元素的逻辑
- 封装第三方库的初始化逻辑

## Vue 3 中的指令钩子函数

Vue 3 中的自定义指令有一套完整的生命周期钩子函数，这些钩子函数会在不同的时机被调用：

### 钩子函数详解

1. **created**：在绑定元素的 attribute 或事件监听器被应用之前调用
2. **beforeMount**：在指令第一次绑定到元素并且在父组件挂载之前调用
3. **mounted**：在绑定元素的父组件被挂载后调用
4. **beforeUpdate**：在包含组件的 VNode 更新之前调用
5. **updated**：在包含组件的 VNode 及其子组件的 VNode 更新后调用
6. **beforeUnmount**：在卸载绑定元素的父组件之前调用
7. **unmounted**：在卸载绑定元素的父组件之后调用

这些钩子函数接收几个参数：
- `el`：指令绑定的元素，可以直接操作 DOM
- `binding`：包含指令信息的对象
- `vnode`：Vue 编译生成的虚拟节点
- `prevNode`：上一个虚拟节点（仅在 beforeUpdate 和 updated 钩子中可用）

## 自定义指令的注册方式

### 全局注册

```javascript
const app = Vue.createApp({})

// 注册一个全局自定义指令 `v-focus`
app.directive('focus', {
  // 当被绑定的元素挂载到 DOM 中时……
  mounted(el) {
    // 聚焦元素
    el.focus()
  }
})
```

### 局部注册

```javascript
export default {
  directives: {
    focus: {
      // 指令的定义
      mounted(el) {
        el.focus()
      }
    }
  }
}
```

## 实际应用示例

### 1. Focus 指令

最常见的例子是页面加载时自动聚焦到某个输入框：

```javascript
app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})
```

使用方式：
```vue
<template>
  <input v-focus placeholder="页面加载后会自动聚焦到这里">
</template>
```

### 2. Tooltip 指令

创建一个简单的 tooltip 指令：

```javascript
app.directive('tooltip', {
  mounted(el, binding) {
    // 创建 tooltip 元素
    const tooltip = document.createElement('div')
    tooltip.className = 'custom-tooltip'
    tooltip.innerText = binding.value
    
    // 设置样式
    tooltip.style.position = 'absolute'
    tooltip.style.backgroundColor = '#333'
    tooltip.style.color = '#fff'
    tooltip.style.padding = '4px 8px'
    tooltip.style.borderRadius = '4px'
    tooltip.style.fontSize = '12px'
    tooltip.style.zIndex = '1000'
    tooltip.style.display = 'none'
    
    // 添加到 DOM
    document.body.appendChild(tooltip)
    
    // 鼠标移入显示 tooltip
    el.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block'
      
      // 获取元素位置
      const rect = el.getBoundingClientRect()
      tooltip.style.left = rect.left + 'px'
      tooltip.style.top = (rect.top - 30) + 'px'
    })
    
    // 鼠标移出隐藏 tooltip
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none'
    })
    
    // 保存引用以便清理
    el._tooltip = tooltip
  },
  
  unmounted(el) {
    // 清理工作
    if (el._tooltip) {
      document.body.removeChild(el._tooltip)
      delete el._tooltip
    }
  }
})
```

使用方式：
```vue
<template>
  <button v-tooltip="'这是一个提示信息'">悬停查看提示</button>
</template>
```

### 3. Debounce 防抖指令

防止函数在短时间内被重复调用：

```javascript
app.directive('debounce', {
  mounted(el, binding) {
    if (typeof binding.value !== 'function') {
      console.warn('[debounce:] 提供的参数必须是一个函数')
      return
    }
    
    let timer = null
    el.addEventListener('click', () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        binding.value()
      }, binding.arg || 500)
    })
  }
})
```

使用方式：
```vue
<template>
  <button v-debounce:1000="handleClick">点击防抖</button>
</template>

<script>
export default {
  methods: {
    handleClick() {
      console.log('点击事件触发')
    }
  }
}
</script>
```

## 指令钩子函数参数详解

每个钩子函数都会接收到相同的参数：

```javascript
app.directive('example', {
  // 四个参数：
  // el: 指令绑定的元素
  // binding: 包含指令信息的对象
  // vnode: Vue 编译生成的虚拟节点
  // prevNode: 上一个虚拟节点（仅在 beforeUpdate 和 updated 钩子中可用）
  created(el, binding, vnode, prevNode) {
    // binding 对象包含以下属性：
    // name: 指令名，不包括 v- 前缀
    // value: 指令的绑定值
    // oldValue: 指令绑定的前一个值（仅在 beforeUpdate 和 updated 中可用）
    // expression: 字符串形式的指令表达式
    // arg: 传给指令的参数
    // modifiers: 包含修饰符的对象
    
    console.log(binding.name) // example
    console.log(binding.value) // 传递给指令的值
    console.log(binding.expression) // 字符串形式的指令表达式
    console.log(binding.arg) // 参数
    console.log(binding.modifiers) // 修饰符对象
  }
})
```

## 动态指令参数

指令的参数可以是动态的。例如：

```vue
<template>
  <div v-mydirective:[argument]="value"></div>
</template>

<script>
export default {
  data() {
    return {
      argument: 'someattr',
      value: 'hello'
    }
  }
}
</script>
```

## 函数式指令

对于只关心 `mounted` 和 `updated` 钩子的指令，可以以函数形式定义：

```javascript
app.directive('color', (el, binding) => {
  // 这将在 mounted 和 updated 时都调用
  el.style.color = binding.value
})
```

## 最佳实践建议

1. **优先使用组件**：尽可能使用组件而不是自定义指令来封装可重用的代码

2. **合理的使用场景**：
   - 需要直接操作 DOM 元素
   - 封装第三方库的初始化逻辑
   - 复用涉及 DOM 元素的逻辑

3. **注意内存泄漏**：
   - 在 `unmounted` 钩子中清理事件监听器
   - 移除创建的 DOM 元素
   - 清理定时器

4. **提供清晰的文档**：
   - 说明指令的用途
   - 列出接受的参数和修饰符
   - 提供使用示例

5. **保持简单性**：
   - 每个指令只做一件事
   - 避免过于复杂的逻辑

## 总结

Vue 3 的自定义指令为我们提供了一种直接操作 DOM 的方式，在特定场景下非常有用。通过合理使用自定义指令，我们可以更好地封装涉及 DOM 操作的逻辑，提高代码的可维护性和复用性。

需要注意的是，自定义指令应该谨慎使用，因为它们会增加应用程序的复杂性。在大多数情况下，我们应该优先考虑使用组件来解决问题。只有在确实需要直接操作 DOM 时，才应该使用自定义指令。