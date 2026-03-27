# Go语言基础详解

Go（又称Golang）是由Google开发的一种静态强类型、编译型、并发型，并具有垃圾回收功能的编程语言。本文将详细介绍Go语言的基础语法、数据类型、运算符、流程控制、数组、切片、map、函数等内容。

## 什么是Go语言？

Go是一种开源编程语言，能够轻松构建简单、可靠和高效的软件。Go语言最初由Robert Griesemer、Rob Pike和Ken Thompson在Google设计，于2009年正式发布。

### Go语言的特点

1. **简洁高效**：语法简洁，执行效率高
2. **并发支持**：内置goroutine和channel，天然支持并发编程
3. **内存安全**：自动垃圾回收机制
4. **快速编译**：编译速度极快
5. **跨平台**：支持多种操作系统和架构
6. **标准库丰富**：内置大量实用的标准库

## Go语言安装与配置

### Windows系统安装

1. 访问[Go官网](https://golang.org/dl/)下载Windows版本安装包
2. 运行安装程序，默认会安装到`C:\Go\`目录
3. 安装完成后，将`C:\Go\bin`添加到系统PATH环境变量中

### Linux系统安装（Ubuntu为例）

```bash
# 下载Go安装包
wget https://golang.org/dl/go1.19.linux-amd64.tar.gz

# 解压到/usr/local目录
sudo tar -C /usr/local -xzf go1.19.linux-amd64.tar.gz

# 添加环境变量到~/.bashrc或~/.zshrc
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### macOS系统安装

```bash
# 使用Homebrew安装
brew install go

# 或者从官网下载pkg安装包直接安装
```

### 验证安装

```bash
# 查看Go版本
go version

# 查看Go环境信息
go env
```

## 第一个Go程序

创建一个简单的Go程序：

```go
// main.go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go!")
}
```

运行程序：
```bash
go run main.go
```

编译程序：
```bash
go build main.go
./main
```

## Go语言基础语法详解

### 1. 变量声明

Go语言中有多种声明变量的方式：

```go
// 方式一：显式声明类型
var name string = "Go"
var age int = 10

// 方式二：自动推导类型（类型推断）
var name = "Go"
var age = 10

// 方式三：短变量声明（仅在函数内可用）
name := "Go"
age := 10

// 批量声明变量
var (
    width  int = 100
    height int = 200
    title  string = "My App"
)

// 零值声明（变量会被赋予默认零值）
var a int      // 0
var b string   // ""
var c bool     // false
var d float64  // 0.0
```

### 2. 基本数据类型

Go语言的基本数据类型包括：

#### 数值类型

```go
// 整数类型
var a int8   = 127    // -128 到 127
var b int16  = 32767  // -32768 到 32767
var c int32  = 2147483647  // -2147483648 到 2147483647
var d int64  = 9223372036854775807  // 更大范围
var e int    = 100    // 平台相关，32位系统为int32，64位系统为int64
var f uint8  = 255    // 无符号整数
var g byte   = 255    // byte是uint8的别名

// 浮点类型
var h float32 = 3.14  // 单精度浮点数
var i float64 = 3.141592653589793  // 双精度浮点数（默认）

// 复数类型
var j complex64 = 1 + 2i
var k complex128 = 3 + 4i
```

#### 布尔类型

```go
var flag bool = true
var isValid bool = false
```

#### 字符串类型

```go
var str string = "Hello, Go!"
var rawStr string = `这是一个原始字符串，
可以包含换行符和特殊字符，不会被转义`
```

#### 字符类型

```go
// Go没有专门的char类型，使用byte或rune表示字符
var ch1 byte = 'A'    // ASCII字符
var ch2 rune = '中'   // Unicode字符
```

### 3. 常量

```go
// 普通常量
const pi = 3.14159
const appName = "MyApp"

// 显式类型常量
const maxUsers int = 1000

// 批量常量声明
const (
    Monday = 1
    Tuesday = 2
    Wednesday = 3
)

// iota枚举
const (
    Red = iota   // 0
    Green        // 1
    Blue         // 2
)
```

### 4. 运算符

#### 算术运算符

```go
a, b := 10, 3
fmt.Println(a + b)  // 加法：13
fmt.Println(a - b)  // 减法：7
fmt.Println(a * b)  // 乘法：30
fmt.Println(a / b)  // 除法：3
fmt.Println(a % b)  // 取模：1

// 自增自减（只有后缀形式）
a++  // 等价于 a = a + 1
b--  // 等价于 b = b - 1
```

#### 比较运算符

```go
a, b := 10, 20
fmt.Println(a == b)  // 相等：false
fmt.Println(a != b)  // 不等：true
fmt.Println(a < b)   // 小于：true
fmt.Println(a <= b)  // 小于等于：true
fmt.Println(a > b)   // 大于：false
fmt.Println(a >= b)  // 大于等于：false
```

#### 逻辑运算符

```go
flag1, flag2 := true, false
fmt.Println(flag1 && flag2)  // 逻辑与：false
fmt.Println(flag1 || flag2)  // 逻辑或：true
fmt.Println(!flag1)          // 逻辑非：false
```

#### 位运算符

```go
a, b := 5, 3  // 二进制：101, 011
fmt.Println(a & b)   // 按位与：1 (001)
fmt.Println(a | b)   // 按位或：7 (111)
fmt.Println(a ^ b)   // 按位异或：6 (110)
fmt.Println(a &^ b)  // 位清空：4 (100)
fmt.Println(a << 1)  // 左移：10 (1010)
fmt.Println(a >> 1)  // 右移：2 (10)
```

### 5. 流程控制

#### 条件语句

```go
// 基本if语句
age := 18
if age >= 18 {
    fmt.Println("成年人")
} else {
    fmt.Println("未成年人")
}

// 带初始化语句的if
if score := 85; score >= 90 {
    fmt.Println("优秀")
} else if score >= 80 {
    fmt.Println("良好")
} else {
    fmt.Println("一般")
}

// switch语句
grade := "B"
switch grade {
case "A":
    fmt.Println("优秀")
case "B":
    fmt.Println("良好")
case "C":
    fmt.Println("及格")
default:
    fmt.Println("不及格")
}

// switch表达式
switch n := 3; n {
case 1, 3, 5, 7, 9:
    fmt.Println("奇数")
case 2, 4, 6, 8:
    fmt.Println("偶数")
default:
    fmt.Println("其他")
}

// 无条件switch（替代if-else链）
score := 85
switch {
case score >= 90:
    fmt.Println("优秀")
case score >= 80:
    fmt.Println("良好")
case score >= 60:
    fmt.Println("及格")
default:
    fmt.Println("不及格")
}
```

#### 循环语句

```go
// for循环（Go只有一个循环关键字）
// 基本for循环
for i := 0; i < 5; i++ {
    fmt.Println(i)
}

// while循环形式
sum := 0
i := 0
for i < 10 {
    sum += i
    i++
}
fmt.Println(sum)

// 无限循环
count := 0
for {
    count++
    if count > 3 {
        break  // 跳出循环
    }
    fmt.Println(count)
}

// range循环（遍历数组、切片、map等）
numbers := []int{1, 2, 3, 4, 5}
for index, value := range numbers {
    fmt.Printf("索引:%d, 值:%d\n", index, value)
}

// 只获取索引
for i := range numbers {
    fmt.Println(i)
}

// 只获取值
for _, value := range numbers {
    fmt.Println(value)
}
```

#### 跳转语句

```go
// break - 跳出循环
for i := 0; i < 10; i++ {
    if i == 5 {
        break
    }
    fmt.Println(i)  // 输出0,1,2,3,4
}

// continue - 跳过本次循环
for i := 0; i < 5; i++ {
    if i == 2 {
        continue
    }
    fmt.Println(i)  // 输出0,1,3,4
}

// goto - 跳转到标签
i := 0
LOOP:
    if i < 3 {
        fmt.Println(i)
        i++
        goto LOOP
    }
```

### 6. 数组

数组是固定长度的序列，长度是数组类型的一部分：

```go
// 声明数组
var arr1 [5]int                    // 声明长度为5的int数组
var arr2 [3]string = [3]string{"a", "b", "c"}  // 声明并初始化
arr3 := [5]int{1, 2, 3, 4, 5}      // 简短声明
arr4 := [...]int{1, 2, 3}          // 编译器推断长度

// 访问元素
fmt.Println(arr3[0])  // 1
arr3[1] = 10          // 修改元素

// 数组长度
fmt.Println(len(arr3))  // 5

// 遍历数组
for i := 0; i < len(arr3); i++ {
    fmt.Println(arr3[i])
}

for index, value := range arr3 {
    fmt.Printf("索引:%d, 值:%d\n", index, value)
}

// 多维数组
var matrix [3][3]int
matrix[0][0] = 1
```

### 7. 切片（Slice）

切片是对数组的封装，提供了动态数组的功能：

```go
// 创建切片
var slice1 []int              // nil切片
slice2 := []int{1, 2, 3}     // 字面量创建
slice3 := make([]int, 5)     // 使用make创建，长度为5
slice4 := make([]int, 3, 5)  // 长度为3，容量为5

// 从数组创建切片
arr := [5]int{1, 2, 3, 4, 5}
slice5 := arr[1:4]  // [2, 3, 4]，包含arr[1]到arr[3]
slice6 := arr[:3]   // [1, 2, 3]，从开头到arr[2]
slice7 := arr[2:]   // [3, 4, 5]，从arr[2]到结尾

// 切片操作
fmt.Println(len(slice2))  // 长度：3
fmt.Println(cap(slice2))  // 容量：3

// 添加元素
slice2 = append(slice2, 4)
slice2 = append(slice2, 5, 6)  // 添加多个元素

// 复制切片
src := []int{1, 2, 3}
dst := make([]int, len(src))
copy(dst, src)  // dst现在是[1, 2, 3]

// 切片共享底层数组
original := []int{1, 2, 3, 4, 5}
sub := original[1:3]  // [2, 3]
sub[0] = 99           // original变为[1, 99, 3, 4, 5]
```

### 8. Map

Map是键值对的集合，类似于其他语言中的字典或哈希表：

```go
// 创建map
var m1 map[string]int           // nil map
m2 := map[string]int{}          // 空map
m3 := map[string]int{
    "one": 1,
    "two": 2,
    "three": 3,
}
m4 := make(map[string]int)      // 使用make创建

// 操作map
m4["key1"] = 100                // 添加或更新
value := m4["key1"]             // 获取值
fmt.Println(value)              // 100

// 检查键是否存在
if val, ok := m4["key1"]; ok {
    fmt.Println("键存在，值为:", val)
} else {
    fmt.Println("键不存在")
}

// 删除键
delete(m4, "key1")

// 遍历map
for key, value := range m3 {
    fmt.Printf("键:%s, 值:%d\n", key, value)
}

// 获取map长度
fmt.Println(len(m3))  // 3
```

### 9. 函数

函数是Go程序的基本构建块：

```go
// 基本函数定义
func add(a int, b int) int {
    return a + b
}

// 参数类型相同可合并
func multiply(a, b int) int {
    return a * b
}

// 多返回值函数
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("除数不能为0")
    }
    return a / b, nil
}

// 命名返回值
func calc(a, b int) (sum, product int) {
    sum = a + b
    product = a * b
    return  // 自动返回sum和product
}

// 可变参数函数
func sum(nums ...int) int {
    total := 0
    for _, num := range nums {
        total += num
    }
    return total
}

// 函数调用示例
result := add(3, 5)                    // 8
quotient, err := divide(10, 2)         // 5, nil
sumResult, productResult := calc(3, 4) // 7, 12
total := sum(1, 2, 3, 4, 5)            // 15

// 传递切片给可变参数函数
numbers := []int{1, 2, 3}
total = sum(numbers...)  // 使用...展开切片
```

### 10. defer语句

defer用于延迟执行函数，常用于资源清理：

```go
func readFile(filename string) {
    file, err := os.Open(filename)
    if err != nil {
        log.Fatal(err)
    }
    defer file.Close()  // 函数结束时关闭文件
    
    // 处理文件...
    // file.Close()会在函数返回前自动调用
}

// 多个defer按LIFO顺序执行
func example() {
    defer fmt.Println("第一个defer")
    defer fmt.Println("第二个defer")
    defer fmt.Println("第三个defer")
    // 输出顺序：第三个defer -> 第二个defer -> 第一个defer
}
```

## 包管理

Go使用模块（module）进行依赖管理：

```bash
# 初始化模块
go mod init myproject

# 添加依赖
go get github.com/gin-gonic/gin

# 查看依赖
go mod tidy

# 更新依赖
go get -u github.com/gin-gonic/gin

# 查看模块信息
go list -m all
```

## 错误处理

Go推崇显式的错误处理：

```go
// 自定义错误
err := errors.New("这是一个错误")

// 格式化错误
err = fmt.Errorf("发生错误: %v", "具体原因")

// 错误检查
file, err := os.Open("filename.txt")
if err != nil {
    log.Fatal(err)
}
defer file.Close()
```

## 总结

Go语言以其简洁、高效和强大的并发特性，在现代软件开发中越来越受欢迎。掌握Go语言的基础知识是学习更高级特性和框架的前提。本文详细介绍了Go语言的基础语法、数据类型、运算符、流程控制、数组、切片、map和函数等内容，为进一步学习Go语言打下了坚实的基础。