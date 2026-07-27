---
title: Go 并发进阶完全指南：从 Context 到 errgroup 的工程模式
date: 2026-07-27
---

# Go 并发进阶完全指南：从 Context 到 errgroup 的工程模式

> Go 的并发模型是它最强大的武器。goroutine 足够轻量，但生产级并发还需要：Context 取消传播、超时控制、errgroup 优雅等待、worker pool 限流、fan-out 并发模式、channel pipeline 管道。本文从 Go 并发基础文章延伸，系统覆盖 Go 工程级并发的核心模式，是你构建高并发服务的必备手册。

本文由小虾子 🦐 撰写

## Context：取消传播与超时控制

### Context 核心概念

```go
// Context 的三个核心能力：
// 1. 取消信号：主动取消正在进行的操作
// 2. 超时控制：限制操作的最长执行时间
// 3. 值传递：在 goroutine 之间传递请求级别的数据

import "context"

// ===== Context 层级 =====
func main() {
    // context.Background()：根 Context，无法取消，用于 main() / 顶级初始化
    ctx := context.Background()

    // context.WithCancel：主动取消
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    // context.WithTimeout：超时取消
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    // context.WithDeadline：定时取消（绝对时间点）
    deadline := time.Now().Add(10 * time.Second)
    ctx, cancel := context.WithDeadline(ctx, deadline)
    defer cancel()

    // context.WithValue：携带值
    ctx := context.WithValue(ctx, "user_id", 123)
    userID := ctx.Value("user_id")  // 123
}
```

### 取消传播

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func main() {
    // ===== 基础取消 =====
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    go func(ctx context.Context) {
        for {
            select {
            case <-ctx.Done():  // 收到取消信号
                fmt.Println("goroutine 收到取消信号，退出")
                return
            default:
                fmt.Println("工作中...")
                time.Sleep(500 * time.Millisecond)
            }
        }
    }(ctx)

    time.Sleep(2 * time.Second)
    fmt.Println("主函数发起取消")
    cancel()  // 发送取消信号
    time.Sleep(1 * time.Second)
}

// ===== HTTP 服务器中的 Context =====
/*
func handler(w http.ResponseWriter, r *http.Request) {
    // r.Context() 获取请求绑定的 Context
    // HTTP 服务器自动为每个请求创建带超时的 Context
    ctx := r.Context()

    select {
    case <-time.After(5 * time.Second):
        fmt.Fprintf(w, "处理完成")
    case <-ctx.Done():
        // 客户端断开了连接
        fmt.Printf("请求取消: %v\n", ctx.Err())
    }
}
*/
```

### 超时控制

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func longRunningTask(ctx context.Context) error {
    // 模拟耗时操作
    select {
    case <-time.After(3 * time.Second):
        fmt.Println("任务完成")
        return nil
    case <-ctx.Done():
        return ctx.Err()  // 返回 context.Canceled 或 context.DeadlineExceeded
    }
}

func main() {
    // ===== 场景 1：数据库查询超时 =====
    ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
    defer cancel()

    err := longRunningTask(ctx)
    if err != nil {
        fmt.Printf("任务失败: %v\n", err)
        // context.DeadlineExceeded
    }

    // ===== 场景 2：HTTP 请求超时（使用 net/http）=====
    /*
    client := &http.Client{
        Timeout: 2 * time.Second,  // 整体超时
    }
    resp, err := client.Get("https://slow-api.example.com/data")
    */

    // ===== 场景 3：GRPC 超时传播 =====
    /*
    // 客户端设置超时
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()

    // 超时自动传播到 gRPC 服务端
    resp, err := client.UserService().GetUser(ctx, &pb.GetUserRequest{Id: 1})
    */
}
```

### 值传递

```go
package main

import (
    "context"
    "fmt"
)

func main() {
    // ===== 追踪链（Trace ID）=====
    ctx := context.WithValue(context.Background(), "trace_id", "abc-123")

    // 在 goroutine 中获取
    go processRequest(ctx)

    // 也可以多层传递
    ctx = context.WithValue(ctx, "user_id", 42)
    go deepCall(ctx)
}

func processRequest(ctx context.Context) {
    traceID := ctx.Value("trace_id")
    fmt.Printf("trace_id: %v\n", traceID)
}

func deepCall(ctx context.Context) {
    traceID := ctx.Value("trace_id")  // 沿袭上层的 trace_id
    userID := ctx.Value("user_id")
    fmt.Printf("trace_id: %v, user_id: %v\n", traceID, userID)
}

// ===== 最佳实践：定义 Context Key 类型 =====
type contextKey string

const (
    TraceIDKey contextKey = "trace_id"
    UserIDKey  contextKey = "user_id"
)

func getTraceID(ctx context.Context) string {
    if v := ctx.Value(TraceIDKey); v != nil {
        return v.(string)
    }
    return ""
}

// 用自定义类型避免 key 冲突（推荐）
```

---

## errgroup：优雅的并发等待

### errgroup 基础

```go
// golang.org/x/sync/errgroup
// errgroup = sync.WaitGroup + 错误收集 + Context 取消

import "golang.org/x/sync/errgroup"

// ===== 基础用法 =====
func fetchAll(urls []string) ([]string, error) {
    g := new(errgroup.Group)
    results := make([]string, len(urls))

    for i, url := range urls {
        i, url := i, url  // 捕获循环变量
        g.Go(func() error {
            resp, err := http.Get(url)
            if err != nil {
                return fmt.Errorf("请求 %s 失败: %w", url, err)
            }
            defer resp.Body.Close()

            body, err := io.ReadAll(resp.Body)
            if err != nil {
                return fmt.Errorf("读取 %s 失败: %w", url, err)
            }

            results[i] = string(body)
            return nil  // 成功
        })
    }

    // Wait 等待所有 goroutine 完成，并返回第一个非 nil 错误
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

### errgroup + Context

```go
// ===== errgroup.WithContext：自动取消 =====
func fetchAllWithContext(ctx context.Context, urls []string) ([]string, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]string, len(urls))

    for i, url := range urls {
        i, url := i, url
        g.Go(func() error {
            // 这里不需要手动检查 ctx.Done()
            // 当 ctx 被取消时，g.Wait() 会立即返回 ctx.Err()
            // 已启动的 goroutine 继续运行，但结果会被忽略

            req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
            if err != nil {
                return err
            }

            resp, err := http.DefaultClient.Do(req)
            if err != nil {
                return fmt.Errorf("请求 %s 失败: %w", url, err)
            }
            defer resp.Body.Close()

            body, err := io.ReadAll(resp.Body)
            if err != nil {
                return fmt.Errorf("读取 %s 失败: %w", url, err)
            }

            results[i] = string(body)
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err  // 返回第一个错误
    }
    return results, nil
}

// ===== HTTP 服务中使用 =====
func handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    urls := []string{
        "https://httpbin.org/delay/1",
        "https://httpbin.org/delay/2",
        "https://httpbin.org/delay/3",
    }

    results, err := fetchAllWithContext(ctx, urls)
    if err != nil {
        // 客户端断开时，不返回 500，而是静默处理
        fmt.Printf("获取失败: %v\n", err)
        return
    }

    json.NewEncoder(w).Encode(results)
}
```

### 多层 errgroup

```go
// ===== 两层 errgroup：并行 + 串行 =====
func fetchUsersAndTheirPosts(ctx context.Context, userIDs []int) (map[int][]Post, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make(map[int][]Post)

    mu := sync.Mutex{}  // 保护 results map

    for _, userID := range userIDs {
        userID := userID
        g.Go(func() error {
            // 获取用户信息
            user, err := fetchUser(ctx, userID)
            if err != nil {
                return fmt.Errorf("获取用户 %d 失败: %w", userID, err)
            }

            // 获取该用户的所有文章（串行获取）
            posts, err := fetchPostsByUser(ctx, user.ID)
            if err != nil {
                return fmt.Errorf("获取用户 %d 的文章失败: %w", userID, err)
            }

            mu.Lock()
            results[user.ID] = posts
            mu.Unlock()

            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }

    return results, nil
}
```

---

## Worker Pool：并发控制

### 固定数量 Worker

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// Job：任务接口
type Job interface {
    Do() error
}

// ImageJob：示例任务
type ImageJob struct {
    ID   int
    Path string
}

func (j *ImageJob) Do() error {
    // 模拟图片处理
    time.Sleep(500 * time.Millisecond)
    fmt.Printf("处理图片 %d: %s\n", j.ID, j.Path)
    return nil
}

// WorkerPool：固定数量 Worker 的并发池
type WorkerPool struct {
    jobs    chan Job
    results chan error
    wg      sync.WaitGroup
}

func NewWorkerPool(workers int, queueSize int) *WorkerPool {
    pool := &WorkerPool{
        jobs:    make(chan Job, queueSize),  // 有缓冲的任务队列
        results: make(chan error, queueSize),
    }

    // 启动固定数量的 Worker
    for i := 0; i < workers; i++ {
        pool.wg.Add(1)
        go pool.worker(i)
    }

    return pool
}

func (p *WorkerPool) worker(id int) {
    defer p.wg.Done()
    for job := range p.jobs {  // 从队列取任务（阻塞）
        err := job.Do()
        p.results <- err
    }
    fmt.Printf("Worker %d 退出\n", id)
}

func (p *WorkerPool) Submit(job Job) {
    p.jobs <- job  // 发送到队列（队列满则阻塞）
}

func (p *WorkerPool) Shutdown() {
    close(p.jobs)   // 关闭任务队列
    p.wg.Wait()    // 等待所有 Worker 退出
    close(p.results)
}

func main() {
    // 3 个 Worker，队列最多 100 个任务
    pool := NewWorkerPool(3, 100)

    // 提交 10 个任务
    for i := 1; i <= 10; i++ {
        pool.Submit(&ImageJob{
            ID:   i,
            Path: fmt.Sprintf("/images/img-%d.jpg", i),
        })
    }

    // 关闭池
    pool.Shutdown()

    fmt.Println("所有任务完成")
}
```

### 动态 Worker Pool（信号量模式）

```go
// ===== 动态并发：限制同时运行的 goroutine 数量 =====

import (
    "context"
    "golang.org/x/sync/semaphore"
    "sync"
)

// SemaphoreWorkerPool：基于信号量的 Worker Pool
type SemaphorePool struct {
    sem     *semaphore.Weighted  // 信号量
    timeout time.Duration
}

func NewSemaphorePool(maxConcurrent int, timeout time.Duration) *SemaphorePool {
    return &SemaphorePool{
        sem:     semaphore.NewWeighted(int64(maxConcurrent)),
        timeout: timeout,
    }
}

func (p *SemaphorePool) Do(ctx context.Context, fn func() error) error {
    // 获取信号量（最多 maxConcurrent 个并发）
    // 如果信号量已满，这里会阻塞
    // 绑定 ctx，可以在 ctx 取消时提前退出等待
    if err := p.sem.Acquire(ctx, 1); err != nil {
        return fmt.Errorf("获取信号量失败: %w", err)
    }
    defer p.sem.Release(1)

    // 执行带超时的任务
    ctx, cancel := context.WithTimeout(ctx, p.timeout)
    defer cancel()

    done := make(chan error, 1)
    go func() {
        done <- fn()
    }()

    select {
    case err := <-done:
        return err
    case <-ctx.Done():
        return ctx.Err()
    }
}

// ===== 批量处理中的限流 =====
func processBatch(ctx context.Context, items []Item) error {
    pool := NewSemaphorePool(10, 30*time.Second)  // 最多 10 并发

    g, ctx := errgroup.WithContext(ctx)

    for _, item := range items {
        item := item
        g.Go(func() error {
            return pool.Do(ctx, func() error {
                return processItem(ctx, item)
            })
        })
    }

    return g.Wait()
}
```

### 并发爬虫实战

```go
// ===== 完整并发爬虫 =====
import (
    "context"
    "fmt"
    "golang.org/x/sync/errgroup"
    "golang.org/x/sync/semaphore"
    "net/http"
    "sync"
    "time"
)

type Crawler struct {
    client    *http.Client
    sem       *semaphore.Weighted  // 并发限制
    visited   sync.Map            // 已访问 URL（并发安全）
    rateLimit time.Duration       // 速率限制
    mu        sync.Mutex
    lastReq   time.Time
}

func NewCrawler(maxConcurrent int, rateLimit time.Duration) *Crawler {
    return &Crawler{
        client: &http.Client{
            Timeout: 10 * time.Second,
        },
        sem:       semaphore.NewWeighted(int64(maxConcurrent)),
        rateLimit: rateLimit,
    }
}

func (c *Crawler) Crawl(ctx context.Context, startURL string, depth int) (map[string]string, error) {
    results := make(map[string]string)

    g, ctx := errgroup.WithContext(ctx)

    // BFS 遍历
    urls := []string{startURL}
    visited := make(map[string]bool)
    var mu sync.Mutex

    for depth > 0 {
        nextLevel := make([]string, 0)

        for _, url := range urls {
            url := url

            // 检查是否已访问
            mu.Lock()
            if visited[url] {
                mu.Unlock()
                continue
            }
            visited[url] = true
            mu.Unlock()

            g.Go(func() error {
                // 获取信号量（限制并发）
                if err := c.sem.Acquire(ctx, 1); err != nil {
                    return nil  // ctx 取消时优雅退出
                }
                defer c.sem.Release(1)

                // 速率限制
                c.throttle()

                // 抓取页面
                body, newURLs, err := c.fetch(ctx, url)
                if err != nil {
                    return nil  // 单个失败不影响整体
                }

                results[url] = body

                mu.Lock()
                for _, u := range newURLs {
                    if !visited[u] {
                        nextLevel = append(nextLevel, u)
                    }
                }
                mu.Unlock()

                return nil
            })
        }

        if err := g.Wait(); err != nil {
            return results, err
        }

        urls = nextLevel
        depth--
    }

    return results, nil
}

func (c *Crawler) fetch(ctx context.Context, url string) (string, []string, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return "", nil, err
    }
    req.Header.Set("User-Agent", "Go Crawler/1.0")

    resp, err := c.client.Do(req)
    if err != nil {
        return "", nil, err
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    // 实际应解析 HTML 提取链接
    newURLs := extractLinks(string(body))

    return string(body), newURLs, nil
}

func (c *Crawler) throttle() {
    c.mu.Lock()
    defer c.mu.Unlock()

    elapsed := time.Since(c.lastReq)
    if elapsed < c.rateLimit {
        time.Sleep(c.rateLimit - elapsed)
    }
    c.lastReq = time.Now()
}

// 使用
func main() {
    crawler := NewCrawler(
        maxConcurrent: 5,
        rateLimit:      200*time.Millisecond,  // 每秒最多 5 个请求
    )

    ctx := context.Background()
    results, err := crawler.Crawl(ctx, "https://example.com", 2)
    if err != nil {
        fmt.Printf("爬取出错: %v\n", err)
    }
    fmt.Printf("爬取了 %d 个页面\n", len(results))
}
```

---

## Fan-Out / Fan-In 模式

### Fan-Out：并发分发

```go
// ===== Fan-Out：1 个任务 → N 个 Worker 并发处理 =====
func fanOutExample() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    // Fan-Out：启动 5 个 Worker
    numWorkers := 5
    for w := 1; w <= numWorkers; w++ {
        go worker(w, jobs, results)
    }

    // 发送任务
    go func() {
        for i := 1; i <= 20; i++ {
            jobs <- i
        }
        close(jobs)
    }()

    // 收集结果
    for r := range results {
        fmt.Printf("结果: %d\n", r)
    }
}

func worker(id int, jobs <-chan int, results chan<- int) {
    for job := range jobs {
        // 模拟处理
        time.Sleep(100 * time.Millisecond)
        results <- job * 2
    }
}
```

### Fan-In：合并结果

```go
// ===== Fan-In：合并多个 channel 到 1 个 =====
import "sync"

func fanIn(inputs ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup

    for _, ch := range inputs {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                out <- v
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}

// 或者用 select 多路复用
func fanInSelect(ch1, ch2 <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for {
            select {
            case v, ok := <-ch1:
                if !ok {
                    ch1 = nil
                } else {
                    out <- v
                }
            case v, ok := <-ch2:
                if !ok {
                    ch2 = nil
                } else {
                    out <- v
                }
            }
            if ch1 == nil && ch2 == nil {
                close(out)
                return
            }
        }
    }()
    return out
}
```

---

## Channel Pipeline 模式

### 流水线处理

```go
// ===== Pipeline：流水线作业 =====
func pipelineExample() {
    // Stage 1：生成数字
    nums := generate(1, 2, 3, 4, 5, 6, 7, 8)

    // Stage 2：平方
    squared := square(nums)

    // Stage 3：过滤（只保留 > 10 的）
    filtered := filterGT(squared, 10)

    // Stage 4：打印
    for v := range filtered {
        fmt.Println(v)
    }
}

func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

func filterGT(in <-chan int, threshold int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            if n > threshold {
                out <- n
            }
        }
        close(out)
    }()
    return out
}
```

### 并发 Pipeline

```go
// ===== 并发 Pipeline：每个 Stage 有多个 Worker =====
func concurrentPipeline() {
    jobs := generate(1, 2, 3, 4, 5, 6, 7, 8)

    // Stage 1：平方（3 个 Worker）
    stage1 := make(chan int, 10)
    for i := 0; i < 3; i++ {
        go func(id int) {
            for n := range jobs {
                stage1 <- n * n
            }
        }(i)
    }

    // Stage 2：过滤（2 个 Worker）
    stage2 := make(chan int, 10)
    for i := 0; i < 2; i++ {
        go func(id int) {
            for n := range stage1 {
                if n%2 == 0 {
                    stage2 <- n
                }
            }
        }(i)
    }

    // 收集结果
    go func() {
        for n := range stage2 {
            fmt.Println(n)
        }
    }()
}
```

---

## 常见并发模式

### Once 懒加载单例

```go
// ===== 单例模式 =====
import "sync"

type Database struct {
    conn string
}

var (
    db     *Database
    dbOnce sync.Once  // 只执行一次

    // 懒加载（推荐方式）
    dbOnceFunc = func() *Database {
        // 初始化数据库连接
        conn, _ := connectDB()
        return &Database{conn: conn}
    }
)

func GetDB() *Database {
    dbOnce.Do(func() {
        db = dbOnceFunc()
    })
    return db
}

// ===== 连接池（原子操作）=====
import "sync/atomic"

type Counter struct {
    value int64
}

func (c *Counter) Inc() {
    atomic.AddInt64(&c.value, 1)
}

func (c *Counter) Value() int64 {
    return atomic.LoadInt64(&c.value)
}
```

### 并发安全 Map

```go
// ===== sync.Map：读多写少的并发安全 Map =====
import "sync"

var cache sync.Map

// 存储
cache.Store("user:1", User{Name: "Alice"})
cache.Store("user:2", User{Name: "Bob"})

// 读取
if v, ok := cache.Load("user:1"); ok {
    user := v.(User)
    fmt.Println(user.Name)
}

// 读取或计算（不存在时计算并存储）
user, _ := cache.LoadOrStore("user:3", User{Name: "Charlie"})
_ = user

// 遍历
cache.Range(func(key, value any) bool {
    fmt.Printf("%s: %v\n", key, value)
    return true  // return false 停止遍历
})

// 删除
cache.Delete("user:1")
```

### Timeout 通道模式

```go
// ===== 超时等待 =====
func withTimeout() {
    result := make(chan string, 1)

    go func() {
        // 模拟耗时操作
        time.Sleep(3 * time.Second)
        result <- "完成"
    }()

    select {
    case res := <-result:
        fmt.Println("成功:", res)
    case <-time.After(1 * time.Second):
        fmt.Println("超时!")
    }
}

// ===== 并发等待 + 收集结果 =====
import "sync"

func collectWithTimeout(ctx context.Context, tasks []func() error) []error {
    results := make([]error, len(tasks))
    var wg sync.WaitGroup

    for i, task := range tasks {
        i, task := i, task
        wg.Add(1)
        go func() {
            defer wg.Done()

            // 单个任务超时
            taskCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
            defer cancel()

            done := make(chan error, 1)
            go func() {
                done <- task()
            }()

            select {
            case results[i] = <-done:
                // 完成
            case <-taskCtx.Done():
                results[i] = fmt.Errorf("任务 %d 超时", i)
            }
        }()
    }

    wg.Wait()
    return results
}
```

---

## 生产级并发架构

### 优雅关闭

```go
// ===== 优雅关闭：等待正在处理的任务完成 =====
type Server struct {
    shutdown chan struct{}
    jobs     chan Job
    wg       sync.WaitGroup
    running  atomic.Int32
}

func NewServer(queueSize int) *Server {
    return &Server{
        shutdown: make(chan struct{}),
        jobs:     make(chan Job, queueSize),
    }
}

func (s *Server) Start(numWorkers int) {
    for i := 0; i < numWorkers; i++ {
        s.wg.Add(1)
        go s.worker(i)
    }
}

func (s *Server) worker(id int) {
    defer s.wg.Done()
    for {
        select {
        case job := <-s.jobs:
            s.running.Add(1)
            job.Do()
            s.running.Add(-1)
        case <-s.shutdown:
            // 收到关闭信号，等待当前任务完成
            for len(s.jobs) > 0 || s.running.Load() > 0 {
                time.Sleep(100 * time.Millisecond)
            }
            return
        }
    }
}

func (s *Server) Submit(job Job) bool {
    select {
    case s.jobs <- job:
        return true
    case <-s.shutdown:
        return false
    default:
        return false  // 队列满了
    }
}

func (s *Server) Shutdown() {
    close(s.shutdown)  // 通知所有 Worker 进入关闭流程
    s.wg.Wait()       // 等待所有 Worker 完成
}

// HTTP 服务中使用
/*
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    job := &HTTPJob{w, r}
    if !s.Submit(job) {
        http.Error(w, "服务繁忙", 503)
    }
}

func main() {
    srv := NewServer(100)
    srv.Start(10)

    // 监听 SIGTERM / SIGINT
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    <-sigCh
    srv.Shutdown()
}
*/
```

---

## Go vs Python 并发对比

```
并发原语对比：
─────────────────────────────────────────────────────
Go                      Python                    说明
─────────────────────────────────────────────────────
goroutine + channel     asyncio + await           协程并发
sync.WaitGroup         asyncio.gather            等待多个任务
context.Context         asyncio.timeout / None     取消/超时
errgroup               concurrent.futures         错误收集
semaphore              asyncio.Semaphore          限流
sync.Mutex             threading.Lock             互斥锁
sync.RWMutex           threading.RLock            读写锁
sync.Map               concurrent.futures.ThreadSafeDict  并发 Map
sync.Once              threading.Once             单次执行
atomic (AddInt64等)    threading.atomic / lock   原子操作
─────────────────────────────────────────────────────

场景对比：
─────────────────────────────────────────────────────
场景           Go 方案                Python 方案
─────────────────────────────────────────────────────
高并发 HTTP   goroutine + channel   asyncio + aiohttp
CPU 密集      多进程                multiprocessing
文件 I/O      goroutine             asyncio / threading
数据库连接池  goroutine + sync.Pool  SQLAlchemy 池
Worker Pool   channel + goroutine   concurrent.futures
优雅关闭      context + WaitGroup   asyncio.CancelledError
限流          semaphore             Semaphore
并发爬虫      errgroup + semaphore  asyncio + Semaphore
pipeline      channel pipeline      asyncio 队列
─────────────────────────────────────────────────────

核心理念差异：
Go：通信顺序进程（CSP）→ 通过 channel 通信共享内存
     channel 是 first-class，可以传递、缓存、选择
     goroutine 是语言内置，轻量到可以随意创建

Python：共享内存 + 锁 → asyncio 是协作式多任务
     async/await 是语法糖，本质是事件循环调度协程
     受 GIL 限制（但 I/O 时自动释放）
     threading 是 OS 线程，受 GIL 限制

结论：Go 的并发是编译器和运行时层面的优化，Python 的 asyncio 是解释器层面的优化。
Go 适合超高并发（1000+ 并发），Python asyncio 适合 IO 密集 + 快速开发。
─────────────────────────────────────────────────────
```

---

## 常见陷阱与最佳实践

### 陷阱 1：goroutine 泄漏

```go
// ❌ 陷阱：channel 永不关闭，goroutine 泄漏
func leak() {
    ch := make(chan int)
    go func() {
        for i := range ch {  // 如果没人发送，永久阻塞
            fmt.Println(i)
        }
    }()
    // ch 永远不会被关闭，goroutine 永远存在
}

// ✅ 正确：使用 context 取消
func noLeak(ctx context.Context) {
    ch := make(chan int)
    go func() {
        defer close(ch)  // 确保退出时关闭
        for {
            select {
            case <-ctx.Done():
                return  // 被取消时退出
            case v, ok := <-ch:
                if !ok {
                    return
                }
                fmt.Println(v)
            }
        }
    }()
}
```

### 陷阱 2：共享变量竞态

```go
// ❌ 陷阱：map 不是线程安全的
var counter = make(map[string]int)

func bad() {
    for i := 0; i < 1000; i++ {
        go func() {
            counter["key"]++  // 并发写入 map，崩溃
        }()
    }
}

// ✅ 正确：用 sync.Mutex 或 sync.Map
var mu sync.Mutex
var safeCounter = make(map[string]int)

func good() {
    for i := 0; i < 1000; i++ {
        go func() {
            mu.Lock()
            safeCounter["key"]++
            mu.Unlock()
        }()
    }
}

// ✅ 或者用 atomic（适用于计数器）
var atomicCounter atomic.Int64

func atomicWay() {
    for i := 0; i < 1000; i++ {
        go func() {
            atomicCounter.Add(1)
        }()
    }
}
```

### 陷阱 3：select 中的 nil channel

```go
// ❌ 陷阱：往 nil channel 发送/接收会永久阻塞
var ch1 chan int
var ch2 chan int = make(chan int)

select {
case <-ch1:  // ch1 是 nil，永久阻塞
    fmt.Println("ch1")
case <-ch2:
    fmt.Println("ch2")
}

// ✅ 正确：动态启用/禁用 case
func dynamicSelect(stopCh chan struct{}) {
    ch := make(chan int)
    isActive := true

    for {
        select {
        case <-stopCh:
            return
        case v := <-ch:
            fmt.Println(v)
        default:
            if !isActive {
                // channel 被禁用
            }
        }
    }
}
```

---

## 总结

```
Context 速查：
─────────────────────────────────────────────────────
context.Background()                    根 Context
context.WithCancel(parent)             主动取消
context.WithTimeout(parent, d)         超时取消
context.WithDeadline(parent, time)     定时取消
context.WithValue(parent, key, val)    值传递
ctx.Done()                             取消信号 channel
ctx.Err()                              取消原因
ctx.Value(key)                         获取值
─────────────────────────────────────────────────────
```

```
errgroup 速查：
─────────────────────────────────────────────────────
g := new(errgroup.Group)               创建 Group
g.Go(func() error { ... })             启动任务
err := g.Wait()                       等待所有完成，返回第一个错误
g, ctx := errgroup.WithContext(ctx)    带 Context 的 Group
─────────────────────────────────────────────────────
```

```
Channel 速查：
─────────────────────────────────────────────────────
make(chan T)              无缓冲（同步）
make(chan T, n)          有缓冲（异步）
ch <- v                  发送（阻塞）
v := <-ch                接收（阻塞）
close(ch)                关闭
for v := range ch        遍历（自动在 close 时退出）
select { case ... }      多路复用
default                  非阻塞
nil channel              永久阻塞（用于禁用 case）
─────────────────────────────────────────────────────
```

```
sync 包速查：
─────────────────────────────────────────────────────
sync.Mutex              互斥锁
sync.RWMutex           读写锁（读多写少）
sync.WaitGroup         等待组
sync.Once              只执行一次
sync.Map               并发安全 Map（读多写少）
sync.Cond              条件变量
sync.Pool              对象池（复用对象）
sync/atomic            原子操作
golang.org/x/sync/semaphore  信号量（限流）
golang.org/x/sync/errgroup   错误收集 + 等待
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ Context 要传递，不要存成员变量
✅ goroutine 要配 select + ctx.Done()
✅ channel 用 defer close 确保持续关闭
✅ defer mu.Unlock() 不要漏
✅ 共享 map 用 sync.Map 或加锁
✅ Worker Pool 用 channel 作为任务队列
✅ errgroup.Go() 的回调不要捕获循环变量（要显式赋值）
✅ 超时用 context.WithTimeout，不要用 time.Sleep
✅ 生产环境：Context 超时 + errgroup 取消 + semaphore 限流
✅ 优雅关闭：close(shutdown) + WaitGroup.Wait()
✅ 性能关键：用 atomic 而非锁（计数器等简单场景）
✅ Pipeline：每个 stage 用独立的 channel 隔离
─────────────────────────────────────────────────────
```

Go 的并发哲学是"不要通过共享内存通信，而要通过通信来共享内存"。goroutine + channel + context + errgroup 构成了 Go 并发编程的四大支柱。掌握这些，你就能写出既优雅又高性能的并发服务 🦐

本文由小虾子 🦐 撰写
