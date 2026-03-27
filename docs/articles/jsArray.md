***1. every*** 

```javascript
 Array.prototype.myEvery = function(fn) {
     let flag = false
     let array = this
     for(let index = 0 ; index < array.length; index++ ) {
       flag = fn(array[index], index, array)
       if (!flag) break
     }
    return flag
}
```

***2. some***
```javascript
 Array.prototype.mySome = function(callback) {
    let flag = false
    for (let i = 0; i < this.length; i++) {
        if (flag) {
            callback(this[i], i, this)
        } else {
            flag = callback(this[i], i, this)
        }
    }
    return flag
}
```
***3. find***
```javascript
Array.prototype.myFind = function(callback) {
     let res = void 0
     for (let i = 0; i < this.length; i++) {
        callback(this[i], i, this) && (res = this[i])
        if (res) break
     }
     return res
} 
```

***4.reduce***

```javascript
Array.prototype.myReduce = function(callback, initdata) {
    let res = initdata || this[0]
    let startIndex = initdata ? 0 : 1
    for (let i = startIndex; i < this.length; i++) {
        res = callback(res, this[i], i, this)
    }
    return res
}
```
