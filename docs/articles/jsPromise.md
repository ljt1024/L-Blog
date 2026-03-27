```javascript
/*
*  自定义Promise函数模块
*/


(function (window){
    /*
    *  Promise构造函数
    *  excutor:执行器函数(同步执行)
    */
    const PENDING = 'pending'
    const RESOLVED = 'resolved'
    const REJECTED = 'rejected'
    function  Promise_(excutor) {
        this.status = PENDING  //给promise对象指定status属性,初始化值为pending
        this.data = undefined    //给promise对象指定一个用于存储结果数据的属性
        this.callbacks = []      //每个元素的结构： { onResolved() {}, onRejected() {}}
        const resolve = value=> {
            // 如果状态不是pending则直接返回
            if(this.status !== PENDING) {
                return
            }
            // 状态改为resolved
            this.status = RESOLVED
            this.data = value
            // 判断是否有异步执行函数，如果有则执行onResolved()方法,并传入value
                if(this.callbacks.length>0) {
                    setTimeout(()=>{
                        this.callbacks.forEach(callbacksObj=>{
                            callbacksObj.onResolved(value)
                        })
                    })
                }

        }
        const reject = reason=> {
            // 如果状态不是pending则直接返回
            if(this.status !== PENDING) {
                return
            }
            this.status = REJECTED
            this.data = reason
            // 判断是否有异步执行函数，如果有则执行onRejected()方法并传入reason
            if(this.callbacks.length>0) {
                setTimeout(()=> {
                    this.callbacks.forEach(callbacksObj => {
                        callbacksObj.onRejected(reason)
                    })
                })
            }
        }

        /*
          立即同步执行excutor
          捕获异常，如果异常执行reject()
        */
        try{
            excutor(resolve,reject)
        }
        catch(error){
            reject(error)
        }
    }

    /*
        Promise原型对象的then()
        指定成功和失败的回调函数
        返回一个新的promise对象
    */

    Promise_.prototype.then = function (onResolved,onRejected) {
        // 向后传递成功的value
        onResolved = typeof onResolved === 'function' ? onResolved : value=>value
        //默认指定失败的回调（实现错误/异常传透的关键点）
        onRejected = typeof onRejected === 'function' ? onRejected : reason=>{throw reason}
        // 返回一个新的promise对象
        return new Promise_((resolve,reject)=>{
            /*
            *  调用指定回调函数处理，根据执行结果，改变return的promise的状态
            */
            const handle = callback => {
                /*
                 * 1.如果抛出异常，return的promise就会失败，reason就是error
                 * 2.如果回调函数返回的不是promise,return的promise就会成功,value就是返回的值
                 * 3.如果回调函数返回的promise，return的promise结果就是这个promise的结果
                 */
                try{
                    const result = callback(this.data)
                    if(result instanceof Promise_) {
                        //3如果回调函数返回的promise，return的promise结果就是这个promise的结果
                        result.then(resolve,reject)
                    }else{
                        //2如果回调函数返回的不是promise,return的promise就会成功,value就是返回的值
                        resolve(result)
                    }
                }catch (error) {
                    //1如果抛出异常，return的promise就会失败，reason就是error
                    reject(error)
                }
            }
            //当前状态还是pending状态，将回调函数保存起来
            if(this.status === PENDING) {
                this.callbacks.push({
                    onResolved(value) {
                        handle(onResolved)
                    },
                    onRejected(reason) {
                        handle(onRejected)
                    },
                })
            }else if(this.status === RESOLVED) { //如果当前是resolved状态，异步执行onResolved并改变return的promise的状态
                setTimeout(()=>{
                    handle(onResolved)
                })
            }else {
                setTimeout(()=>{ //如果当前是rejected状态，异步执行onRejected并改变return的promise的状态
                    handle(onRejected)
                })
            }
        })

    }

    /*
      Promise原型对象的catch()
      指定失败的回调函数
      返回一个新的promise对象
    */
    Promise_.prototype.catch  = function (onRejected) {
        return this.then(undefined,onRejected)
    }

    /*
      Promise函数对象的resolve方法
      返回一个指定结果成功的promise
    */
    Promise_.resolve = function (value) {
        //返回一个成功或者失败的promise
        return new Promise_((resolve,reject)=>{
            // value值是promise
            if(value instanceof Promise_) {  //使用value的结果作为promise的结果
                value.then(resolve,reject)
            }else {  //value值不是promise
                resolve(value)
            }
        })

    }

    /*
      Promise函数对象reject的方法
      返回一个指定结果失败的promise
    */
    Promise_.reject = function (reason) {
        //返回的是一个失败的promise
        return new Promise_((resolve,reject)=>{
            reject(reason)
        })
    }

    /*
      Promise函数对象all的方法
      返回一个promise,只有所有promise都成功才成功，否则失败
    */
    Promise_.all = function (promiseArr) {
        // 转成数组
        let newPromiseArr = Array.from(promiseArr)
        let len = newPromiseArr.length
        let num = 0
        let result = []
        return new Promise_((resolve,reject)=>{
            newPromiseArr.forEach((value, index)=>{
                Promise_.resolve(value).then((res)=>{
                    result[index] = res
                    if(++num === len) resolve(result)
                }).catch((err)=>{
                    reject(err)
                })
            })
        })
    }

    /*
     Promise函数对象race的方法
     返回一个promise,其结果由第一个完成的promise决定
   */
    Promise_.race = function (promiseArr) {
        let newPromiseArr = Array.from(promiseArr)
        return new Promise_((resolve,reject)=>{
            newPromiseArr.forEach((value, index)=>{
                Promise_.resolve(value).then((res)=>{
                    //一旦有成功了，将return变成成功
                   resolve(res)
                }).catch((err)=>{
                    //一旦有失败了，将return变成成功
                    reject(err)
                })
            })
        })
    }
    // 向外暴露Promise函数
    window.Promise_ = Promise_
})(window)
```
