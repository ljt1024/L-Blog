新版本微信小程序通过getUserInfo获取到用户的头像是灰色，昵称显示为微信用户，这是微信版本更新了，现在需要用getUserProfile来获取用户的头像和昵称，并且只能页面产生点击事件（例如 button 上 bindtap 的回调中）后才可调用，也就是说你不能在一个方法里面去触发这个事件，这是需要值得注意的。详见[微信官方文档说明](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)
	

```javascript
<button @click="logins">测试登录</button>
logins() {
	uni.getUserProfile({
		desc:"用于完善用户信息",  //必填，声明获取用户个人信息后的用途，不超过30个字符
		success: (res) => {
			console.log(res)
			uni.showToast({
				icon:"none",
				title:'获取成功'
			})
		},
		fail: (err) => {
			console.log(err)
			uni.showToast({
				icon:"none",
				title:'用户拒绝获取'
			})
		}  
	})
},
```
成功获取到了用户信息
![在这里插入图片描述](https://i-blog.csdnimg.cn/blog_migrate/825e38df6b2a918892f69d96f7d85b95.png)
获取手机号示例,需要用户授权解密后才能得到手机号

```javascript
 <button open-type="getPhoneNumber" @getphonenumber="getPhoneNumber" >微信手机号授权</button>
	getPhoneNumber(e) {
      	if(e.detail.errMsg === "getPhoneNumber:ok"){
			wx.request({
	 			 url: this.$apiUrls + 'authStart/phone',
				  method: 'post',
				  data: {
				    'encryptedData': e.detail.encryptedData,
				    'iv': e.detail.iv,
				    'sessionKey': uni.getStorageSync('systemInfo').session_key,
				    'openId': uni.getStorageSync('systemInfo').openid,
				  },
				  success: function (res) {
				  	uni.setStorageSync('phone',res.data.data)
				   uni.setStorageSync('isLogin',true)
				   uni.switchTab({
						url:'./index'
				   })
	 			 }
			});
      }else{
         uni.showToast({
         	title: "获取手机授权失败",
         	icon: "none"
         });
     }
 }
```
