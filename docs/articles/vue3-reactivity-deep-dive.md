# Vue 3 响应式原理深度解析：从 Proxy 到 effect

> 发布时间：2026-03-25

Vue 3 的响应式系统是整个框架的核心，相比 Vue 2 的 `Object.defineProperty`，Vue 3 基于 `Proxy` 重写，解决了诸多历史遗留问题。本文从源码角度深入剖析 Vue 3 响应式原理，彻底搞懂 `ref`、`reactive`、`computed`、`watch` 背后的机制。

## Vue 2 响应式的局限

Vue 2 使用 `Object.defineProperty` 劫持对象属性：

```javascript
// Vue 2 的实现方式（简化）
function defineReactive(obj, key, val) {
  Object.defineProperty(obj, key, {
    get() {
      // 依赖收集
      dep.depend()
      return val
    },
    set(newVal) {
      val = newVal
      // 触发更新
      dep.notify()
    }
  })
}
```

**核心缺陷**：
- ❌ 无法检测**新增/删除属性**（需要 `Vue.set` / `Vue.delete`）
- ❌ 无法检测**数组索引赋值**（`arr[0] = 1` 不触发更新）
- ❌ 需要递归遍历所有属性，**初始化性能差**
- ❌ 无法监听 `Map`、`Set` 等数据结构

---

## Vue 3 响应式核心：Proxy

Vue 3 用 `Proxy` 代理整个对象，从根本上解决了上述问题：

```javascript
const handler = {
  get(target, key, receiver) {
    // 依赖收集
    track(target, key)
    const res = Reflect.get(target, key, receiver)
    // 深层响应式：懒递归（访问时才代理）
    if (isObject(res)) {
      return reactive(res)
    }
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver)
    // 新增属性 or 值变化时触发更新
    if (!hadKey || hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return result
  },
  deleteProperty(target, key) {
    const result = Reflect.deleteProperty(target, key)
    trigger(target, key) // 删除属性也能触发更新！
    return result
  }
}

function reactive(target) {
  return new Proxy(target, handler)
}
```

**Proxy 的优势**：
- ✅ 代理整个对象，新增/删除属性自动响应
- ✅ 数组操作（push、splice、索引赋值）全部支持
- ✅ 懒递归，只有访问到嵌套对象时才代理，性能更好
- ✅ 支持 `Map`、`Set`、`WeakMap`、`WeakSet`

---

## 依赖收集与触发：track & trigger

响应式的核心是**依赖追踪**：当数据被读取时收集依赖，当数据变化时通知依赖更新。

### 数据结构

```javascript
// 全局依赖存储
// WeakMap<target, Map<key, Set<effect>>>
const targetMap = new WeakMap()

// 当前正在执行的 effect（全局唯一）
let activeEffect = null
```

### track（依赖收集）

```javascript
function track(target, key) {
  if (!activeEffect) return // 没有 effect 在执行，不需要收集

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  // 将当前 effect 加入依赖集合
  dep.add(activeEffect)
  // 反向收集：effect 也记录自己依赖了哪些 dep（用于清理）
  activeEffect.deps.push(dep)
}
```

### trigger（触发更新）

```javascript
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (dep) {
    // 执行所有依赖该属性的 effect
    dep.forEach(effect => effect.run())
  }
}
```

---

## effect：响应式的驱动引擎

`effect` 是响应式系统的核心，`watch`、`computed`、组件渲染都基于它实现：

```javascript
class ReactiveEffect {
  constructor(fn, scheduler) {
    this.fn = fn           // 副作用函数
    this.scheduler = scheduler // 调度器（computed/watch 用）
    this.deps = []         // 收集到的所有依赖
    this.active = true
  }

  run() {
    if (!this.active) return this.fn()

    // 设置当前活跃 effect，触发 track
    activeEffect = this
    try {
      return this.fn() // 执行函数，期间访问响应式数据会触发 track
    } finally {
      activeEffect = null // 执行完毕，清除
    }
  }

  stop() {
    if (this.active) {
      cleanupEffect(this) // 清除所有依赖
      this.active = false
    }
  }
}

function effect(fn) {
  const _effect = new ReactiveEffect(fn)
  _effect.run() // 立即执行一次，完成依赖收集
  return _effect
}
```

**执行流程**：
```
effect(fn) 执行
  → activeEffect = 当前 effect
  → fn() 执行
    → 访问 state.count（触发 Proxy get）
      → track(state, 'count') 收集依赖
  → activeEffect = null

state.count = 1（触发 Proxy set）
  → trigger(state, 'count')
    → 找到所有依赖 count 的 effect
    → 执行 effect.run()
```

---

## ref 的实现

`ref` 用于包装基本类型值（number、string、boolean）：

```javascript
class RefImpl {
  constructor(value) {
    this._value = isObject(value) ? reactive(value) : value
    this.__v_isRef = true
  }

  get value() {
    track(this, 'value') // 依赖收集
    return this._value
  }

  set value(newVal) {
    if (hasChanged(newVal, this._rawValue)) {
      this._value = isObject(newVal) ? reactive(newVal) : newVal
      trigger(this, 'value') // 触发更新
    }
  }
}

function ref(value) {
  return new RefImpl(value)
}
```

这就是为什么 `ref` 需要 `.value` 访问——因为 JS 基本类型无法被 Proxy 代理，只能通过对象的 getter/setter 来拦截。

---

## computed 的实现

`computed` 是**懒执行 + 缓存**的 effect：

```javascript
class ComputedRefImpl {
  constructor(getter) {
    this._dirty = true // 脏标记：true 表示需要重新计算
    this._value = undefined

    // 创建 effect，但不立即执行（lazy）
    // 使用 scheduler：依赖变化时不立即重新计算，只标记为脏
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        trigger(this, 'value') // 通知依赖 computed 的 effect
      }
    })
  }

  get value() {
    track(this, 'value')
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run() // 重新计算
    }
    return this._value // 返回缓存值
  }
}
```

**缓存机制**：
- 首次访问 → `_dirty = true` → 执行 getter → 缓存结果 → `_dirty = false`
- 再次访问 → `_dirty = false` → 直接返回缓存，不重新计算
- 依赖变化 → scheduler 触发 → `_dirty = true` → 下次访问重新计算

---

## watch 的实现

```javascript
function watch(source, cb, options = {}) {
  let getter
  if (isRef(source)) {
    getter = () => source.value
  } else if (isReactive(source)) {
    getter = () => source // 深度监听
  } else if (isFunction(source)) {
    getter = source
  }

  let oldValue

  const job = () => {
    const newValue = effect.run()
    if (hasChanged(newValue, oldValue)) {
      cb(newValue, oldValue)
      oldValue = newValue
    }
  }

  const effect = new ReactiveEffect(getter, job) // scheduler = job

  if (options.immediate) {
    job() // 立即执行
  } else {
    oldValue = effect.run() // 只收集依赖，不触发回调
  }
}
```

---

## 响应式系统全景图

```
┌─────────────────────────────────────────────┐
│                 响应式数据                    │
│  reactive(Proxy)  ref(class)  computed       │
└──────────────┬──────────────────────────────┘
               │ 读取时 track()
               ▼
┌─────────────────────────────────────────────┐
│              依赖存储 targetMap               │
│  WeakMap<target, Map<key, Set<effect>>>      │
└──────────────┬──────────────────────────────┘
               │ 写入时 trigger()
               ▼
┌─────────────────────────────────────────────┐
│              ReactiveEffect                  │
│  组件渲染 effect / watch effect / computed   │
└─────────────────────────────────────────────┘
```

---

## 常见问题解答

**Q：为什么解构 reactive 对象会失去响应式？**
```javascript
const state = reactive({ count: 0 })
const { count } = state // ❌ count 是普通数字，失去响应式

// ✅ 使用 toRefs 保持响应式
const { count } = toRefs(state)
```

**Q：ref 和 reactive 怎么选？**
- 基本类型 → 必须用 `ref`
- 对象/数组 → `reactive` 或 `ref` 都可以，`reactive` 更简洁（不需要 `.value`）
- 组合式函数返回值 → 推荐 `ref`（解构时用 `toRefs` 保持响应式）

**Q：shallowReactive 和 shallowRef 的区别？**
- `shallowReactive`：只代理第一层，嵌套对象不响应
- `shallowRef`：只有 `.value` 的替换会触发更新，内部对象变化不触发

---

## 总结

Vue 3 响应式系统的核心链路：

1. **Proxy** 拦截对象读写操作
2. **track** 在读取时收集当前 effect 为依赖
3. **trigger** 在写入时通知所有依赖 effect 重新执行
4. **ReactiveEffect** 是驱动引擎，`computed`/`watch`/渲染都基于它
5. **ref** 通过 class getter/setter 实现基本类型的响应式
6. **computed** 通过脏标记实现懒计算和缓存

理解了这套机制，Vue 3 的所有响应式 API 都能融会贯通。

---

*本文由小虾子 🦐 撰写*
