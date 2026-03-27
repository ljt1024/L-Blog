```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>礼物编辑</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      list-style-type: none;
      text-decoration: none;
    }
    .container {
      display: flex;
      padding: 20px;
    }
    .handle {
      margin: 100px;
      width: 340px;
    }
    .tit {
      padding: 16px;
      text-align: center;
      font-size: 20px;
    }
    .input-item {
      display: flex;
      align-items: center;
    }
    .input-item + .input-item {
      margin-top: 20px;
    }
    label {
      width: 50px;
    }
    input {
      -webkit-appearance: none;
      background-color: #fff;
      background-image: none;
      border-radius: 4px;
      border: 1px solid #dcdfe6;
      box-sizing: border-box;
      color: #606266;
      display: inline-block;
      font-size: inherit;
      height: 40px;
      line-height: 40px;
      outline: none;
      padding: 0 15px;
      transition: border-color .2s cubic-bezier(.645,.045,.355,1);
      width: 240px;
      cursor: pointer;
    }
    input:hover {
      border-color: #c0c4cc;
    }
    input:focus {
      outline: none;
      border-color: #409eff;
    }
    .btn {
      color: #fff;
      margin: 20px 0 0 0;
      background-color: #409eff;
      font-size:12px;
      cursor: pointer;
      text-align: center;
      font-weight: 500;
      border-color: #409eff;
      border-radius: 3px;
      padding: 9px 15px;
      width: 100px;
    }
    .btn-group {
      display: flex;
    }
    .btn-group .btn + .btn{
     margin-left: 24px;
     background-color: #e73d3d;
    }
    .confirm {
      margin-left: 50px;
    }
    .gift-list {
      margin: 100px;
      width: calc(100% - 240px);
      height: 100%;
    }
    .list {
      border: 2px solid rgb(200, 173, 196);
      border-radius: 8px;
      cursor: pointer;
      padding: 20px;
      min-height: 200px;
      max-height: 440px;
      overflow-y: auto;
    }
    .list ul li {
      display: flex;
      justify-content: space-between;
      padding: 8px;
    }
    .list ul li:hover {
      background-color: #f5f7fa;;
    }
    .del {
      color: #e73d3d;
    }

    .pop-box{
      display: none;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 999;
    }
    .pop-box:after{
      content: "";
      display: inline-block;
      height: 100%;
      width: 0;
      vertical-align: middle;
    }
    .pop {
      width: 420px;
      text-align: left;
      display: inline-block;
      backface-visibility: hidden;
      overflow: hidden;
      box-shadow: 0 2px 12px 0 rgb(0 0 0/10%);
      z-index: 999;
      color: #333;
      border-radius:4px ;
      background-color: #fff;
      border: 1px solid #ebeef5;
      padding-bottom: 15px;
      vertical-align: middle;
    }
    .model{
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      height: 100%;
      width: 100%;
      background-color: #000;
      opacity: 0.5;
      z-index: 50;
    }
     .model-tit{
      color: #303133;
      font-size: 18px;
      padding: 15px 15px 10px;
    }
    .model-btn{
      text-align: right;
      padding: 5px 15px 0;
    }
    .back {
      color: #fff;
      margin-top: 20px;
      background-color: #409eff;
      font-size:12px;
      cursor: pointer;
      text-align: center;
      font-weight: 500;
      border-color: #409eff;
      border-radius: 3px;
      padding: 9px 15px;
    }
    .back + .back {
      margin-left: 16px;
    }
    .content{
      padding: 10px 15px;
      color: #606266;
      font-size: 14px;
    }
  </style>
</head>
<body>
<div class="container">
  <div class="handle">
    <div class="tit">添加奖品</div>
    <div class="input-item">
      <label for="gift">名称:</label><input type="text" autocomplete="off" maxlength="12" class="ipt" name="gift" value="" id="gift">
    </div>
    <div class="input-item">
      <label for="num">数量:</label><input type="number" autocomplete="off" maxlength="12" class="ipt num" name="num" value="1" id="num" min="1">
    </div>
    <div class="btn confirm">确定</div>
  </div>
  <div class="gift-list">
    <div class="tit">
      奖品列表
    </div>
    <div class="list">
      <ul>
      <!--  <li>
            <div class="value">1.11111</div>
            <div class="del">删除</div>
        </li>-->
      </ul>
    </div>
    <div class="btn-group">
      <div class="btn save">保存</div>
      <div class="btn reset">清空</div>
    </div>
  </div>
</div>
<div class="pop-box">
  <div class="pop">
    <div class="model-tit">提示</div>
    <div class="model-content">确认重置吗！</div>
    <div class="model-btn">
      <a href="#" class="back" id="confirm">
        确认
      </a>
      <a href="#" class="back" id="cancel">
        取消
      </a>
    </div>
  </div>
</div>
<div class="model"></div>
<script>
  const giftIpt = document.querySelectorAll('[name="gift"]')[0]
  const numIpt = document.querySelectorAll('[name="num"]')[0]
  const confirm = document.querySelectorAll('.confirm')[0]
  const ulBox = document.querySelectorAll('ul')[0]
  const reset = document.querySelectorAll('.reset')[0]
  const save = document.querySelectorAll('.save')[0]
  let delList = document.querySelectorAll('.del')
  let value = ''
  let num = 1
  giftIpt.oninput = function() {
      value = giftIpt.value
  }
  numIpt.oninput = function() {
      num = numIpt.value
  }
  confirm.onclick = function() {
    if  (value === '') {
      alert('名称不能为空!')
      return
    }
    // 判断新添加的是否在奖品列表中包含，包含则数量相加
    const liList = document.querySelectorAll('li')
    const len = liList.length
    let flag = false
    if (len >= 1) {
        for (let i = 0; i < len; i++) {
            let giftName = liList[i].querySelectorAll('.value .giftName')[0].innerHTML
            let giftNum = liList[i].querySelectorAll('.value .num')[0].innerHTML
            if (value === giftName) {
                liList[i].querySelectorAll('.value .num')[0].innerHTML = giftNum / 1 + num / 1
                flag = true
                break
            }
        }
        if (!flag) {
            add(len)
        }
    } else {
        add(len)
    }

    value = ''
    num = 1
    giftIpt.value = ''
    numIpt.value = 1
    delList = document.querySelectorAll('.del')
    del(delList)
  }
  function add(len) {
      let li = document.createElement('li')
      li.innerHTML = `
            <div class="value"><span class="giftName">${value}</span>×<span class="num"> ${num}</span></div>
            <div class="del" data-index= "${len + 1}">删除</div>
    `
      ulBox.appendChild(li)
  }
  function del (nodeList) {
      for (let i = 0; i < nodeList.length; i++) {
          nodeList[i].onclick = function() {
              ulBox.removeChild(this.parentNode)
          }
      }
      // 删除后重新排列
  }
  reset.onclick = function () {
      ulBox.innerHTML = ''
  }
  save.onclick = function() {
     window.localStorage.setItem('giftList', '')
     const liList = document.querySelectorAll('li')
     if (liList.length === 0) {
         alert('奖品不能为空!')
         return
     }
     let giftList = []
     for (let i = 0; i < liList.length; i++) {
        let giftName = liList[i].querySelectorAll('.value .giftName')[0].innerHTML
        let giftNum = liList[i].querySelectorAll('.value .num')[0].innerHTML / 1
        for (let j = 0; j < giftNum; j++) {
            giftList.push(giftName)
        }
     }
     localStorage.setItem('giftList', giftList.toString())
     setTimeout(()=> {
         alert('保存成功!')
         window.location.href = './index.html'
     }, 500)
  }
</script>
</body>
</html>

```


```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>辛运抽奖</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      list-style-type: none;
      user-select: none;
      text-decoration: none;
    }
    .container {
      position: fixed;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      background-image: url('./images/texture.png');
      transition: background-color 2s ease-in;
      background-color: rgb(200, 173, 196);
    }
    .title {
      padding: 40px 40px 0 40px;
      text-align: center;
      font-size: 36px;
      color: rgb(237, 47, 106);
    }
    .screen {
      position: fixed;
      right: 180px;
      top: 20px;
      color: #333;
      font-weight: bold;
      font-size: 16px;
      cursor: pointer;
    }
    .reset {
      position: fixed;
      right: 120px;
      top: 20px;
      color: #333;
      font-weight: bold;
      font-size: 16px;
      cursor: pointer;
    }
    .edit-gift {
      position: fixed;
      right: 30px;
      top: 20px;
      color: #333;
      font-weight: bold;
      font-size: 16px;
      cursor: pointer;
    }
     ul {
       display: flex;
       flex-wrap: wrap;
     }
     li {
       position: relative;
       padding: 80px 100px;
       width: 100px;
     }

    .front {
      position: absolute;
      width: 100px;
      height: 140px;
      cursor: pointer;
      z-index: 2;
      transition: 0.6s;
      background-image: url("./images/front.png");
      background-size: 100% 100%;
    }
    .end {
      position: absolute;
      width: 100px;
      height: 140px;
      cursor: pointer;
      transition: 0.6s;
      transform: rotateY(180deg);
      background-image: url("./images/end.png");
      background-size: 100% 100%;
      text-align: center;
      color: #333;
      font-size: 20px;
      font-weight: bold;
      padding: 18px;
    }
    .text {
      display: flex;
      align-items: center;
      height: 100%;
      width: 100%;
    }
    .pop-box{
      display: none;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 999;
    }
    .pop-box:after{
      content: "";
      display: inline-block;
      height: 100%;
      width: 0;
      vertical-align: middle;
    }
    .pop{
      width: 420px;
      text-align: left;
      display: inline-block;
      backface-visibility: hidden;
      overflow: hidden;
      box-shadow: 0 2px 12px 0 rgb(0 0 0/10%);
      z-index: 999;
      color: #333;
      border-radius:4px ;
      background-color: #fff;
      border: 1px solid #ebeef5;
      padding-bottom: 15px;
      vertical-align: middle;
    }
    .model{
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      height: 100%;
      width: 100%;
      background-color: #000;
      opacity: 0.5;
      z-index: 50;
    }
    .tit{
      color: #303133;
      font-size: 18px;
      padding: 15px 15px 10px;
    }
    .btn{
      text-align: right;
      padding: 5px 15px 0;
    }
    .back {
      color: #fff;
      margin-top: 20px;
      background-color: #409eff;
      font-size:12px;
      cursor: pointer;
      text-align: center;
      font-weight: 500;
      border-color: #409eff;
      border-radius: 3px;
      padding: 9px 15px;
    }
    .back + .back {
      margin-left: 16px;
    }
    .content{
      padding: 10px 15px;
      color: #606266;
      font-size: 14px;
    }
  </style>
</head>
<body>
 <div class="container">
    <span class="screen">全屏</span>
    <span class="reset">重置</span>
    <span class="edit-gift">编辑奖品</span>
    <div class="title">幸运抽奖</div>
    <div class="content">
      <ul>
<!--
        <li>
          <div class="front"></div>
          <div class="end">
            <div class="text">钢笔一支</div>
          </div>
        </li>
-->
      </ul>
    </div>
 </div>
 <div class="pop-box">
   <div class="pop">
     <div class="tit">提示</div>
     <div class="content">确认重置吗！</div>
     <div class="btn">
       <a href="#" class="back" id="confirm">
         确认
       </a>
       <a href="#" class="back" id="cancel">
         取消
       </a>
     </div>
   </div>
 </div>
 <div class="model"></div>
 <script>
    let gift = localStorage.getItem('giftList').split(',') || []
    gift.sort(function () {
        return Math.random() - 0.5
    })
    // const gift = [
    //     '钢笔一支',
    //     '练习册一本',
    //     '一杯奶茶',
    //     '一包零食',
    //     '钢笔一支',
    //     '练习册一本',
    //     '一杯奶茶',
    //     '一包零食',
    //     '钢笔一支',
    //     '练习册一本',
    //     '一杯奶茶',
    //     '一包零食',
    //     '钢笔一支',
    //     '练习册一本',
    //     '一杯奶茶',
    //     '一包零食'
    // ]
    const ulBox = document.querySelectorAll('ul')[0]
    let liList = ''
    for (let i = 0; i < gift.length; i++) {
        liList +=  `
                    <li>
                      <div class="front"></div>
                      <div class="end">
                        <div class="text">${gift[i]}</div>
                      </div>
                    </li>
                    `
    }
    ulBox.innerHTML = liList
    const frontList = document.querySelectorAll('.front')
    const backList = document.querySelectorAll('.end')
    const screenBox = document.querySelectorAll('.screen')[0]
    const resetBtn = document.querySelectorAll('.reset')[0]
    const popBox = document.querySelectorAll('.pop-box')[0]
    const model = document.querySelectorAll('.model')[0]
    const confirmBtn = document.querySelector('#confirm')
    const cancelBtn = document.querySelector('#cancel')
    const editGiftBtn = document.querySelectorAll('.edit-gift')[0]
    for( let i = 0; i < frontList.length; i++) {
        frontList[i].onclick = function () {
            this.style.transform = 'rotateY(180deg)'
            this.style.zIndex = '-1'
            backList[i].style.transform = 'rotateY(0deg)'
        }
    }
    function fullScreen() {
        let de = document.documentElement
        if (de.requestFullscreen) {
            de.requestFullscreen()
        } else if (de.mozRequestFullScreen) {
            de.mozRequestFullScreen();
        } else if (de.webkitRequestFullScreen) {
            de.webkitRequestFullScreen()
        }
    }
    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    let flag = false
    screenBox.onclick = function () {
        flag = !flag
        if (flag) {
            this.innerText = '退出全屏'
            fullScreen()
        } else {
            this.innerText = '全屏'
            exitFullscreen()
        }
    }

    resetBtn.onclick = function () {
        model.style.display = 'block'
        popBox.style.display = 'block'
    }

    confirmBtn.addEventListener('click', function () {
        model.style.display = 'none'
        popBox.style.display = 'none'
        for( let i = 0; i < frontList.length; i++) {
            frontList[i].style.transform = 'rotateY(0deg)'
            frontList[i].style.zIndex = '2'
            backList[i].style.transform = 'rotateY(180deg)'
        }
    })

    cancelBtn.addEventListener('click', function () {
        model.style.display = 'none'
        popBox.style.display = 'none'
    })

    editGiftBtn.addEventListener('click', function () {
        window.location.href = './editGiftList.html'
    })
 </script>
</body>
</html>

```
