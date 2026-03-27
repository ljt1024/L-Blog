```javascript
function Person(name,age){
    this.name = name
    this.age = age
    this.speak = function (a,b,c) {
        console.log(`${this.name}年龄是${this.age},${a},${b},${c}`)
    }
}
var p2 = {
    name: '李四',
    age:'24'
}
var p1 = new Person('张三',18)
p1.speak()
var p3 =p1.speak.call(p2,'王五',20)
console.log(p3);
var p4 = p1.speak.apply(p2,['hehe',111])
console.log(p4);
var p5 = p1.speak.bind(p2,'heihei',222)()
console.log(p5);

// 手写call
 Function.prototype._mycall = function (obj,...args) {
        console.log(this)   // this 指向调用它的函数
        const fn = Symbol('fn')
        obj.fn = this
        let res = obj.fn(...args)
        delete obj.fn
        return res
 }
 var p6 = p1.speak._mycall(p2,'xixi',666)
 console.log(p6);
 // 手写apply
 Function.prototype._myapply = function (obj,args) {
     const fn = Symbol('fn')
     obj.fn = this
     var res =  args && args.length ? obj.fn(...args) : obj.fn()
     delete obj.fn
     return res
 }
var p7 = p1.speak._myapply(p2,['xixihaha',777])
console.log(p7)
// 手写bind
Function.prototype._mybind = function (obj,...args) {
    const fn = Symbol('fn')
    obj.fn = this
    return  (...rest) => { //  不可以使用arguments对象，该对象在函数体内不存在。如果要用，可以用 rest 参数(剩余参数)代替。
        // console.log(rest)
        // let res = obj.fn(...[...args,...arguments])
        let res = obj.fn(...[...args,...rest])
        delete obj.fn
        return res
    }
}
var p8 = p1.speak._mybind(p2,'bind',888)(999)
console.log(p8);

```
