1.标准盒模型：content = width + padding*2 +border*2
2.IE盒模型：触发条件： box-sizing: border-box;   
					当宽度大于  border*2 + padding *2    content = width
		 		     当宽度小于  border + padding  content = border*2 + padding *2
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>
    <style>
        *{
            margin: 0;
            padding: 0;
        }
        .box1{
            border:10px solid #ccc;
            background-color: pink;
            margin: 100px;
            padding: 100px;
            width: 300px;
            height: 300px;
        }
        .box2{
            box-sizing: border-box;
            border:10px solid #ccc;
            background-color:blue;
            margin: 100px;
            padding: 100px;
            width: 500px;
            height: 500px;
        }
        .box3{
            box-sizing: border-box;
            border:10px solid #ccc;
            background-color:yellow;
            margin: 100px;
            padding: 100px;
            width: 80px;
            height: 80px;
        }
    </style>
</head>
<body>
 <div class="box1">
<!--     标准盒模型 content = width + 2*border + 2*padding-->
 </div>
 <div class="box2">
<!--     ie盒模型1 当宽度大于  border + padding-->
 </div>
 <div class="box3">
<!--     ie盒模型2 当宽度小于  border + padding  content =2*border + padding-->
 </div>
</body>
</html>
```
![在这里插入图片描述](https://i-blog.csdnimg.cn/blog_migrate/d7e234c5c0279c959c684640a20dbb60.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/blog_migrate/e3e470b638ed19e16d3648b6fdd7e675.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/blog_migrate/8eb65e88ddcdd33425b98e7dd7f1c663.png)
