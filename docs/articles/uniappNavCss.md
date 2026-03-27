实现思路:默认导航栏其实一直存在，只需初始时把导航栏透明度设为0，随着滚动，改变透明度即可

```javascript
onPageScroll(res) {
	//获取距离顶部距离
	const scrollTop = res.scrollTop;
	if (scrollTop >= 0) {
		// 导航条颜色透明渐变
		if (scrollTop <= 20) {
			this.opacityNum = 0
		} else if (20 < scrollTop && scrollTop <= 100) {
			this.opacityNum = scrollTop / 100
		} else if (scrollTop > 100) {
			this.opacityNum = 1
		}
	}
},
```
