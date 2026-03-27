### 1. vue3中 data、method 和 setup
data 和 method 能使用 setup定义的数据和方法，但是setup无法使用data和method中的数据和方法。 setup中没有this

### 2.自定义组件的名称
```javascript
//原来的方式也能使用
<script lang="ts">
 export default {
    name: 'componentName'
 }
<script>

// 1安装 npm i vite-plugin-vue-setup-extend -D
// 2vite.config.ts
import VueSetupExtend from 'vite-plugin-vue-setup-extend'
export default defineConfig({
    plugins: [
        VueSetupExtend()
    ]
)}
// 3 自定义name名称
<script setup lang="ts" name="componentName">
<script/>
```

### 3 ref 和 reactive
ref可以定义基本、对象类型的响应式数据  打印的数据RefImpl {value}  value: Proxy('类型'){}  
reactive 只能定义对象类型的响应式数据  打印的数据Proxy('类型'){} 

区别: 
1. ref创建的变量必须使用.value(可以使用volar插件自动添加.value)
2. reactive 重新分配一个新对象，会失去响应式（可以使用Object.assign去在整体替换）

使用原则:  
1. 若需要一个基本类型的响应式数据必须用ref
2. 若需要一个响应式对象，层级不深，ref、reactive都可以
3. 若需要一个响应式对象，且层级较深，推荐使用reactive
```javascript
 import { ref, reactive } from 'vue'

 //person.value.name person.value.age
 let person = ref({
    name: '张三',
    age: 12
 })
 //address.value  price.value
 let address = ref('杭州')
 let price = ref(200)
 
 // person2.name person2.age
 let person2 = reactive({
    name: '李四',
    age: 16
 })

 function changePerson2() {
    Object.assign(car, {
        name: '王五',
        age: 18
    })
 }
```

### 4 toRefs和toRef
```javascript
import { reactive, toRefs } from 'vue'

let person = reactive({
    name: '张三',
    age: 12
})

let { name, age } = person // 解构出来的name和age并不是响应式对象

let { name, age } = toRefs(person) // 此时解构出来的name和age是响应式对象， name和age转换成person.name和person.age 的 ref对象

let age2 = toRef(person, 'age') // 把age解构成响应式对象

function changeName() {
   person.name = '李四'
   // 等同
   name.value = '李四'
}
```

### 5 computed
```html
<template>
  <div>
      姓：<input type="text" v-model="firstName">
      名：<input type="text" v-model="lastName">
      全名：{{ fullName }}
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'

let firstName = ref('zhang')
let lastName = ref('san')

// 这么定义的fullName是一个计算属性，且是只读的
// let fullName = computed(()=> {
//   return firstName.value.slice(0 ,1).toLocaleUpperCase() + firstName.value.slice(1) + ' ' + lastName.value
// })

// 这么定义的fullName是一个计算属性，可读可写
let fullName = computed({
   get() {
      return firstName.value.slice(0 ,1).toLocaleUpperCase() + firstName.value.slice(1) + ' ' + lastName.value
   },
   set(newVal) {
      console.log(newVal)
   }
})
</script>
```

### 6 watch
作用： 监视数据的变化（和Vue2中的watch作用一致）
特点： Vue3中的watch只能监视以下四种数据

1. ref定义的数据
2. reactive定义的数据
3. 函数返回一个值（getter 函数）
4. 一个包含上述内容的数组


情况1:监视ref定义的基本数据类型
```html
<template>
  <div>
    <h1>情况1:监视ref定义的基本数据类型</h1>
    当前值是{{ sum }}
    <button @click="add">点我加1</button>
  </div>
</template>
<script lang="ts" setup>
import { ref, watch } from 'vue'

let sum = ref(0)
function add() {
  sum.value += 1
}

const stopWatch = watch(sum, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
  if (newVal >= 10) {
    // 停止监视
    stopWatch()
  }
})
</script>
```
情况2: 监视ref定义的对象数据类型,监视的是对象的地址值,若想监视对象内部属性的变化，需要手动开启  
watch的第一个参数是: 被监视的数据   
watch的第二个参数是: 监视的回调  
watch的第三个参数是: 配置对象(deep、immediate等等)  
```html
<template>
  <div>
    <h1>情况1:监视ref定义的对象数据类型</h1>
    当前{{ person.name }}的年龄是{{ person.age }}
    <button @click="changeAge">点我加改变年龄</button>
  </div>
</template>
<script lang="ts" setup>
import { ref, watch } from 'vue'

let person = ref({
   name: '张三',
   age: 12
})
function changeAge() {
  person.value.age += 1
}

const stopWatch = watch(person, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
}, { deep:true, immediate:true })
</script>
```
情况3:监视reactive定义的对象数据类型,且默认是开启深度监听的
```html
<template>
  <div>
    <h1>情况3:监视reactive定义的对象数据类型</h1>
    当前{{ person.name }}的年龄是{{ person.age }}
    <button @click="changeAge">点我加改变年龄</button>
    测试{{obj.a.b.c}}
    <button @click="changeObj">改变obj</button>
  </div>
</template>
<script lang="ts" setup>
import { reactive, watch } from 'vue'

let person = reactive({
   name: '张三',
   age: 12
})
let obj = reactive({
   a: {
      b: {c: 666}
   }
})
function changeAge() {
  person.age += 1
}
function changeObj() {
  obj.a.b.c = 999  
}

watch(person, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
})
// 情况3:监视reactive定义的对象数据类型,且默认是开启深度监听的
watch(obj, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
})
</script>
```

情况4: 监视响应式对象中的某个属性,且该属性是对象类型,可以直接写,也能写函数,更推荐函数
```html
<template>
  <div>
    <h1>监视响应式对象中的某个属性,且该属性是对象类型,可以直接写,也能写函数,更推荐函数</h1>
    当前{{ person.name }}的年龄是{{ person.age }}
    车的名称{{person.car.name }}和车的类型{{person.car.type}}
    <button @click="changeAge">点我加改变年龄</button>
    <button @click="changeCar">换个车</button>
    <button @click="changeCarType">换个车型</button>
  </div>
</template>
<script lang="ts" setup>
import { reactive, watch } from 'vue'

let person = reactive({
   name: '张三',
   age: 12,
   car: {
    cname: 'BYD',
    type: 'suv'
   }
})

function changeAge() {
  person.age += 1
}

function changeCar() {
  person.car = {
    cname: 'YD',
    type: '电动自行车'
  }
}

function changeCarType() {
  person.car.type = 'mpv'
}

// 监视响应式对象的中某个属性,且该属性是基本类型的,要写成函数式的
watch(()=> person.age, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
})

// 可以监听car中某个属性发生变化,但是不能监听整个car被替换
watch(person.car, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
}) 

// 情况4: 监视响应式对象中的某个属性,且该属性是对象类型,可以直接写,也能写函数,更推荐函数
watch(()=> person.car, (newVal, oldVal)=> {
  console.log(newVal, oldVal)
}, { deep: true }) 
</script>
```

总结: 监视的要是对象里的属性,要么最好写成函数式,注意点:若是对象监视的是地址值,需要关注对象内部,需要开启深度监视。


情况5: 监视多个响应式数据,可以传入数组
```html
<template>
  <div>
    <h1>监视多个响应式数据,可以传入数组</h1>
    当前{{ person.name }}的年龄是{{ person.age }}
    车的名称{{person.car.name }}和车的类型{{person.car.type}}
    <button @click="changeAge">点我加改变年龄</button>
    <button @click="changeCar">换个车</button>
    <button @click="changeCarType">换个车型</button>
  </div>
</template>
<script lang="ts" setup>
import { reactive, watch } from 'vue'

let person = reactive({
   name: '张三',
   age: 12,
   car: {
    cname: 'BYD',
    type: 'suv'
   }
})

function changeAge() {
  person.age += 1
}

function changeCar() {
  person.car = {
    cname: 'YD',
    type: '电动自行车'
  }
}

function changeCarType() {
  person.car.type = 'mpv'
}

// 情况5: 监视多个响应式数据,可以传入数组
watch([()=> person.age, ()=> person.car], (newVal, oldVal)=> {
  console.log(newVal, oldVal)
}, { deep: true })
</script>
```

### 7 watchEffect
the watchEffect() function allows us to reactively track changes to a set of reactive dependencies and run a callback function whenever any of these dependencies change. It's similar to the watch() function, but it automatically tracks reactive dependencies used within the callback function, and it doesn't require us to explicitly specify the dependencies we want to watch.


```html 
<template>
  <div>
    <h1>123456789</h1>
    当前{{ person.name }}的年龄是{{ person.age }}
    <button @click="changeAge">点我加改变年龄</button>
    测试{{obj.a.b.c}}
    <button @click="changeObj">改变obj</button>
  </div>
</template>

<script lang="ts" setup>
  watch([()=> person.age, ()=> person.car], (newVal, oldVal)=> {
    console.log(newVal, oldVal)
  }, { deep: true })
</script>
```

### 8 标签的ref属性

作用：给标签添加ref属性，可以获取到该标签的DOM对象
     用在组件上，可以获取到组件实例对象
例子：  
  ```html
  <template>
    <div>
      <h1>123456789</h1>
      <h1 ref="myH1">123456789</h1>
      <button @click="changeAge">点我加改变年龄</button>
      <button @click="changeObj">改变obj</button>
    </div>
  </template>

  <script lang="ts" setup>
    import { ref, onMounted } from 'vue'
    let myH1 = ref(null)
    onMounted(() => {
      console.log(myH1.value)
    })
  </script>
  ```


### 9 props
父组件给子组件传递数据，子组件接收数据


```html
<template>
  <div>
    <h1>123456789</h1>    
    <button @click="changeAge">点我加改变年龄</button>
    <button @click="changeObj">改变obj</button>
    <Child :name="person.name" :age="person.age" :car="person.car" @childClick="parentClick">
    </Child>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue'
  import Child from './components/Child.vue'
  let myH1 = ref(null)
  onMounted(() => {
    console.log(myH1.value)
  })


  let person = reactive({
    name: '张三',
    age: 12,
    car: {
      cname: 'BYD',
      type: 'suv'
    }
  })

  function changeAge() {
    person.age += 1
  }

  function changeObj() {
    person.car = {
      cname: 'YD',
      type: '电动自行车'
    }

  }

  function parentClick() {
    console.log('子组件点击了')
  }
</script>
```

子组件接收数据
```html
<template>
  <div>
    <h1>子组件</h1>
    <h1>{{name}}</h1>
    <h1>{{age}}</h1>
    <h1>{{car}}</h1>
    <button @click="childClick">子组件按钮</button>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue'
  const props = defineProps(['name', 'age', 'car'])
  const emit = defineEmits(['childClick'])
  function childClick() {
    emit('childClick')
  }
</script>
```

### 10 Vue3的生命周期
Vue3的生命周期钩子函数，和Vue2的生命周期钩子函数类似，只是名字不同 


### 11 hooks
Vue3的hooks函数，和Vue2的mixin类似，但是hooks函数更加强大，可以复用代码，并且不会导致命名冲突

```html
<template>
  <div>
    <h1>123456789</h1>
    <h1>{{name}}</h1>
    <h1>{{age}}</h1>
    <h1>{{car}}</h1>    
    <button @click="childClick">子组件按钮</button>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue'
  import { usePerson } from './hooks/usePerson'
  const { name, age, car, changeAge, changeObj, childClick } = usePerson()
</script>
```

```ts
// usePerson.ts
import { ref, reactive, onMounted } from 'vue'

export function usePerson() {
  let name = ref('张三')
  let age = ref(12)

  let car = reactive({
    cname: 'BYD',
    type: 'suv'
  })

  function changeAge() {
    age.value += 1
  }     

  function changeObj() {
    car = {
      cname: 'YD',
      type: '电动自行车'
    }
  }

  function childClick() {
    console.log('子组件点击了')
  }

  return {
    name,
    age,
    car,
    changeAge,
    changeObj,
    childClick
  }
}
```



