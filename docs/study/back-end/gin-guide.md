# Gin框架入门指南

Gin是一个用Go语言编写的轻量级Web框架，它提供了类似Martini的API，但性能更好。Gin非常适合构建RESTful API和Web应用。本文将介绍Gin框架的基本使用方法。

## 什么是Gin框架？

Gin是基于httprouter开发的Web框架，它提供了更好的性能和更多的功能。Gin的主要特点包括：

1. **快速**：基于Radix树的路由，小内存占用，没有反射，可预测的API性能
2. **中间件支持**：支持丰富的中间件，如日志、认证、压缩等
3. **崩溃处理**：内置崩溃处理机制，确保服务稳定运行
4. **JSON验证**：支持JSON验证和绑定
5. **路由分组**：支持路由分组和嵌套路由
6. **错误管理**：提供便捷的错误管理和报告

## 安装Gin

在项目目录下初始化Go模块并安装Gin：

```bash
# 初始化模块
go mod init myginapp

# 安装Gin
go get -u github.com/gin-gonic/gin
```

## 第一个Gin应用

创建一个简单的HTTP服务器：

```go
package main

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
)

func main() {
    // 创建默认路由引擎
    r := gin.Default()
    
    // 定义路由
    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Hello, Gin!",
        })
    })
    
    // 启动HTTP服务器
    r.Run(":8080") // 默认监听在0.0.0.0:8080
}
```

运行程序：
```bash
go run main.go
```

访问`http://localhost:8080`可以看到返回的JSON响应。

## 路由定义

### 基本路由

```go
func main() {
    r := gin.Default()
    
    // GET请求
    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "message": "pong",
        })
    })
    
    // POST请求
    r.POST("/user", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "message": "create user",
        })
    })
    
    // 支持所有HTTP方法
    r.Any("/test", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "method": c.Request.Method,
        })
    })
    
    r.Run()
}
```

### 路由参数

```go
func main() {
    r := gin.Default()
    
    // 路径参数
    r.GET("/user/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(200, gin.H{
            "id": id,
        })
    })
    
    // 查询参数
    r.GET("/welcome", func(c *gin.Context) {
        firstname := c.DefaultQuery("firstname", "Guest")
        lastname := c.Query("lastname") // 如果不存在则返回空字符串
        
        c.JSON(200, gin.H{
            "firstname": firstname,
            "lastname":  lastname,
        })
    })
    
    // 表单参数
    r.POST("/form_post", func(c *gin.Context) {
        message := c.PostForm("message")
        nick := c.DefaultPostForm("nick", "anonymous")
        
        c.JSON(200, gin.H{
            "status":  "posted",
            "message": message,
            "nick":    nick,
        })
    })
    
    r.Run()
}
```

## 中间件

### 全局中间件

```go
func main() {
    // 创建不包含Logger和Recovery中间件的路由引擎
    // r := gin.New()
    
    // 创建包含Logger和Recovery中间件的路由引擎
    r := gin.Default()
    
    // 添加自定义全局中间件
    r.Use(func(c *gin.Context) {
        // 请求前
        t := time.Now()
        
        // 处理请求
        c.Next()
        
        // 请求后
        latency := time.Since(t)
        log.Print(latency)
    })
    
    r.GET("/test", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "test"})
    })
    
    r.Run()
}
```

### 局部中间件

```go
// 定义中间件函数
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 检查认证逻辑
        if c.GetHeader("Authorization") == "" {
            c.AbortWithStatusJSON(401, gin.H{"error": "未授权"})
            return
        }
        
        // 继续处理请求
        c.Next()
    }
}

func main() {
    r := gin.Default()
    
    // 仅为特定路由添加中间件
    authorized := r.Group("/admin", AuthRequired())
    {
        authorized.POST("/users", func(c *gin.Context) {
            c.JSON(200, gin.H{"message": "创建用户"})
        })
        
        authorized.DELETE("/users/:id", func(c *gin.Context) {
            id := c.Param("id")
            c.JSON(200, gin.H{"message": "删除用户", "id": id})
        })
    }
    
    r.Run()
}
```

## 数据绑定和验证

### 模型绑定

```go
type Login struct {
    User     string `form:"user" json:"user" binding:"required"`
    Password string `form:"password" json:"password" binding:"required"`
}

func main() {
    r := gin.Default()
    
    // JSON绑定
    r.POST("/loginJSON", func(c *gin.Context) {
        var login Login
        
        // 绑定JSON
        if err := c.ShouldBindJSON(&login); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        
        if login.User != "manu" || login.Password != "123" {
            c.JSON(http.StatusUnauthorized, gin.H{"status": "unauthorized"})
            return
        }
        
        c.JSON(http.StatusOK, gin.H{"status": "you are logged in"})
    })
    
    // 表单绑定
    r.POST("/loginForm", func(c *gin.Context) {
        var login Login
        
        // 绑定表单数据
        if err := c.ShouldBind(&login); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        
        if login.User != "manu" || login.Password != "123" {
            c.JSON(http.StatusUnauthorized, gin.H{"status": "unauthorized"})
            return
        }
        
        c.JSON(http.StatusOK, gin.H{"status": "you are logged in"})
    })
    
    r.Run(":8080")
}
```

## 返回不同格式的数据

```go
func main() {
    r := gin.Default()
    
    // JSON
    r.GET("/someJSON", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "hey", "status": http.StatusOK})
    })
    
    // XML
    r.GET("/moreXML", func(c *gin.Context) {
        c.XML(http.StatusOK, gin.H{"message": "hey", "status": http.StatusOK})
    })
    
    // YAML
    r.GET("/someYAML", func(c *gin.Context) {
        c.YAML(http.StatusOK, gin.H{"message": "hey", "status": http.StatusOK})
    })
    
    r.Run(":8080")
}
```

## 文件上传

```go
func main() {
    r := gin.Default()
    
    // 单文件上传
    r.POST("/upload", func(c *gin.Context) {
        file, _ := c.FormFile("file")
        log.Println(file.Filename)
        
        // 保存文件
        c.SaveUploadedFile(file, "./uploads/"+file.Filename)
        
        c.String(http.StatusOK, fmt.Sprintf("'%s' uploaded!", file.Filename))
    })
    
    // 多文件上传
    r.POST("/uploadMultiple", func(c *gin.Context) {
        form, _ := c.MultipartForm()
        files := form.File["upload[]"]
        
        for _, file := range files {
            log.Println(file.Filename)
            c.SaveUploadedFile(file, "./uploads/"+file.Filename)
        }
        
        c.String(http.StatusOK, fmt.Sprintf("%d files uploaded!", len(files)))
    })
    
    r.Run(":8080")
}
```

## 总结

Gin框架以其高性能和简洁的API成为Go语言中最受欢迎的Web框架之一。通过本文的学习，你应该掌握了Gin的基本使用方法，包括路由定义、中间件使用、数据绑定和验证等核心功能。在实际开发中，你可以结合这些知识点构建功能完善的Web应用。