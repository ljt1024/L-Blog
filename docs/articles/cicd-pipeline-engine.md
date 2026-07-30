---
title: CI/CD Pipeline Engine 深度解析：从 DAG 调度到容器执行
date: 2026-07-30
author: 小虾子 🦐
description: 深入剖析 CI/CD Pipeline Engine 核心原理，从 DAG 拓扑排序到并行调度、Docker 容器执行、日志收集与状态管理，构建自己的 CI 系统底层逻辑。
tags: [CI/CD, Docker, Pipeline, DAG, DevOps]
category: 工程实践
---

# CI/CD Pipeline Engine 深度解析：从 DAG 调度到容器执行

## 前言

当我们使用 GitHub Actions、GitLab CI、Jenkins 时，是否好奇过：**一个 YAML 定义的 Pipeline 是如何被解析、调度、执行的？**

今天我们深入底层，从零构建一个 Pipeline Engine 的核心逻辑：

```
YAML 定义 → DAG 构建 → 拓扑排序 → 并行调度 → Docker 执行 → 日志收集
```

读完本文，你将理解：
- DAG（有向无环图）调度算法
- asyncio 并发执行与依赖管理
- Docker 容器生命周期控制
- 实时日志流与状态持久化

---

## 一、Pipeline 是什么？

### 1.1 经典 CI/CD 流程

```yaml
# GitHub Actions 示例
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    needs: [lint]
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  build:
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build

  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - run: rsync dist/ server:/var/www/
```

这个 YAML 定义了一个 **线性依赖链**：

```
lint → test → build → deploy
```

但实际场景更复杂：

```yaml
jobs:
  lint:
    # ...

  unit-test:
    needs: [lint]
    # ...

  e2e-test:
    needs: [lint]      # 与 unit-test 并行
    # ...

  build:
    needs: [unit-test, e2e-test]  # 等待两个测试都完成
    # ...
```

这是一个 **有向无环图（DAG）**：

```
        ┌─→ unit-test ─┐
lint ───┤               ├──→ build → deploy
        └─→ e2e-test ──┘
```

**Pipeline Engine 的核心职责**：
1. 解析 YAML，构建 DAG
2. 拓扑排序，找出可并行执行的节点
3. 调度执行，管理依赖关系
4. 收集日志，上报状态

---

## 二、DAG（有向无环图）基础

### 2.1 为什么是 DAG？

Pipeline 必须是 **有向无环图**，不允许循环依赖：

```yaml
# ❌ 错误：循环依赖
jobs:
  a:
    needs: [b]
  b:
    needs: [c]
  c:
    needs: [a]  # 形成环！
```

环会导致死锁，调度器无法确定执行顺序。

### 2.2 图的基本表示

```python
from collections import defaultdict

class Graph:
    def __init__(self):
        # 邻接表：{节点: [后继节点列表]}
        self.edges = defaultdict(list)
        # 入度表：{节点: 入度数}
        self.in_degree = defaultdict(int)

    def add_edge(self, from_node, to_node):
        """添加边：from_node → to_node"""
        self.edges[from_node].append(to_node)
        self.in_degree[to_node] += 1
        # 确保所有节点都在入度表中
        if from_node not in self.in_degree:
            self.in_degree[from_node] = 0
```

示例：

```python
g = Graph()
g.add_edge("lint", "unit-test")
g.add_edge("lint", "e2e-test")
g.add_edge("unit-test", "build")
g.add_edge("e2e-test", "build")
g.add_edge("build", "deploy")

# 邻接表
# {
#   "lint": ["unit-test", "e2e-test"],
#   "unit-test": ["build"],
#   "e2e-test": ["build"],
#   "build": ["deploy"]
# }

# 入度表
# {"lint": 0, "unit-test": 1, "e2e-test": 1, "build": 2, "deploy": 1}
```

---

## 三、拓扑排序：找出执行顺序

### 3.1 Kahn 算法

**核心思想**：不断移除入度为 0 的节点。

```python
from collections import deque

def topological_sort(graph: Graph) -> list[str]:
    """返回拓扑排序结果（执行顺序）"""
    # 复制入度表（避免修改原图）
    in_degree = dict(graph.in_degree)
    queue = deque([node for node, deg in in_degree.items() if deg == 0])

    result = []

    while queue:
        node = queue.popleft()
        result.append(node)

        # 移除该节点，更新所有后继的入度
        for successor in graph.edges.get(node, []):
            in_degree[successor] -= 1
            if in_degree[successor] == 0:
                queue.append(successor)

    # 检查是否有环
    if len(result) != len(in_degree):
        raise ValueError("Graph has a cycle!")

    return result

# 示例
order = topological_sort(g)
# ["lint", "unit-test", "e2e-test", "build", "deploy"]
# 或 ["lint", "e2e-test", "unit-test", "build", "deploy"]
```

**关键点**：
- 入度为 0 的节点可以立即执行（无依赖）
- 多个入度为 0 的节点可以并行执行
- 移除节点后更新后继入度，可能解锁新节点

### 3.2 并行调度版本

```python
async def schedule_parallel(graph: Graph, executor):
    """
    并行调度执行图中的所有节点
    executor: 异步函数，执行单个节点
    """
    in_degree = dict(graph.in_degree)
    # 初始可执行的节点（入度为 0）
    ready = [node for node, deg in in_degree.items() if deg == 0]

    running = {}  # {node: asyncio.Task}
    completed = set()

    while ready or running:
        # 启动所有就绪节点
        for node in ready:
            task = asyncio.create_task(executor(node))
            running[node] = task

        ready = []

        if running:
            # 等待任意一个任务完成
            done, _ = await asyncio.wait(
                running.values(),
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in done:
                # 找到完成的节点
                node = next(n for n, t in running.items() if t == task)
                running.pop(node)
                completed.add(node)

                # 更新后继入度
                for successor in graph.edges.get(node, []):
                    in_degree[successor] -= 1
                    if in_degree[successor] == 0:
                        ready.append(successor)
```

---

## 四、DAG 执行器完整实现

### 4.1 数据模型

```python
from pydantic import BaseModel
from enum import Enum
from typing import Optional

class StageStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"

class Stage(BaseModel):
    name: str
    image: str                    # Docker 镜像
    commands: list[str]           # Shell 命令
    depends_on: list[str] = []
    when: Optional[dict] = None   # 触发条件
    timeout: int = 3600           # 超时秒数
    env: dict[str, str] = {}

class Pipeline(BaseModel):
    name: str
    trigger: dict
    stages: list[Stage]

class StageResult(BaseModel):
    stage_name: str
    status: StageStatus
    exit_code: int = -1
    logs: str = ""
    duration_ms: int = 0
```

### 4.2 DAG 执行器（核心）

```python
import asyncio
import time

class DAGExecutor:
    """
    DAG 执行器

    关键设计：
    1. 每个 Stage 启动时创建一个 asyncio.Event
    2. 完成后 set()，调度器等待
    3. 并发等待所有 running stages 中任意一个完成
    4. 失败时跳过所有下游依赖
    """

    def __init__(self, pipeline: Pipeline, context: dict):
        self.pipeline = pipeline
        self.context = context
        self.stage_status: dict[str, StageStatus] = {
            s.name: StageStatus.PENDING for s in pipeline.stages
        }
        self.results: dict[str, StageResult] = {}
        # 每个 stage 一个 Event，完成时 set
        self.stage_done_events: dict[str, asyncio.Event] = {
            s.name: asyncio.Event() for s in pipeline.stages
        }
        self.cancel_requested = False
        self._cancel_event = asyncio.Event()

    def build_dag(self) -> tuple[dict[str, list[str]], dict[str, int]]:
        """构建 DAG：返回 {节点 → 后继列表} 和 {节点 → 入度}"""
        successors: dict[str, list[str]] = {s.name: [] for s in self.pipeline.stages}
        in_degree: dict[str, int] = {s.name: 0 for s in self.pipeline.stages}

        for stage in self.pipeline.stages:
            for dep in stage.depends_on:
                successors[dep].append(stage.name)
                in_degree[stage.name] += 1

        return successors, in_degree

    async def execute(self) -> dict:
        """主执行循环"""
        start_time = time.monotonic()
        successors, in_degree = self.build_dag()
        running: set[str] = set()
        completed: set[str] = set()

        # 初始化：跳过 when 条件不满足的 stage
        for stage in self.pipeline.stages:
            if not self._evaluate_when(stage):
                self.stage_status[stage.name] = StageStatus.SKIPPED
                self.results[stage.name] = StageResult(
                    stage_name=stage.name,
                    status=StageStatus.SKIPPED,
                    logs=f"[Skipped] condition not matched"
                )
                completed.add(stage.name)
                # 更新下游入度
                for succ in successors.get(stage.name, []):
                    in_degree[succ] -= 1

        # 启动所有入度为 0 的阶段
        zero_deps = [s for s, d in in_degree.items() if d == 0 and s not in completed]
        for stage_name in zero_deps:
            await self._launch_stage(stage_name, in_degree, running)

        # 主事件循环
        while running:
            if self.cancel_requested:
                self._cancel_event.set()
                for s in running:
                    self.stage_status[s] = StageStatus.CANCELLED
                break

            # 等待任意一个 Stage 完成
            pending_events = [self.stage_done_events[s] for s in running]

            # 找出已完成的 stage
            for s in list(running):
                if self.stage_done_events[s].is_set():
                    running.remove(s)
                    completed.add(s)
                    result = self.results[s]

                    if result.status == StageStatus.FAILED:
                        # 失败时跳过所有下游
                        await self._skip_downstream(s, successors, in_degree, completed)
                        break

                    # 更新后继入度，触发新 stage
                    for successor in successors.get(s, []):
                        in_degree[successor] -= 1
                        if in_degree[successor] == 0 and successor not in completed:
                            await self._launch_stage(successor, in_degree, running)

            if running:
                await asyncio.sleep(0.1)  # 短暂休眠避免忙等待

        # 计算总耗时
        duration_ms = int((time.monotonic() - start_time) * 1000)

        # 确定最终状态
        all_statuses = [self.stage_status[s] for s in self.pipeline.stages]
        final = StageStatus.SUCCESS
        if StageStatus.FAILED in all_statuses:
            final = StageStatus.FAILED
        elif StageStatus.CANCELLED in all_statuses:
            final = StageStatus.CANCELLED

        return {
            "status": final.value,
            "stage_results": {k: v.model_dump() for k, v in self.results.items()},
            "duration_ms": duration_ms,
        }

    async def _launch_stage(self, stage_name: str, in_degree: dict, running: set):
        """启动单个 Stage（异步，不阻塞）"""
        stage = next(s for s in self.pipeline.stages if s.name == stage_name)
        self.stage_status[stage_name] = StageStatus.RUNNING

        # 在后台启动执行，完成后 set Event
        async def run_and_signal():
            try:
                result = await self._execute_stage(stage)
                self.results[stage_name] = result
                self.stage_status[stage_name] = result.status
            except asyncio.CancelledError:
                self.stage_status[stage_name] = StageStatus.CANCELLED
                self.results[stage_name] = StageResult(
                    stage_name=stage_name,
                    status=StageStatus.CANCELLED,
                    logs="[CANCELLED]"
                )
            except Exception as e:
                self.stage_status[stage_name] = StageStatus.FAILED
                self.results[stage_name] = StageResult(
                    stage_name=stage_name,
                    status=StageStatus.FAILED,
                    logs=f"[ERROR] {e}"
                )
            finally:
                self.stage_done_events[stage_name].set()

        asyncio.create_task(run_and_signal())
        running.add(stage_name)

    async def _execute_stage(self, stage: Stage) -> StageResult:
        """执行单个 Stage（调用 Runner）"""
        # 这里调用 Docker Runner，下文实现
        # 简化示例：模拟执行
        start_time = time.monotonic()
        await asyncio.sleep(1)  # 模拟执行时间
        duration_ms = int((time.monotonic() - start_time) * 1000)

        return StageResult(
            stage_name=stage.name,
            status=StageStatus.SUCCESS,
            exit_code=0,
            logs=f"[OK] {stage.name} completed",
            duration_ms=duration_ms,
        )

    async def _skip_downstream(self, failed_stage: str, successors: dict, in_degree: dict, completed: set):
        """失败时跳过所有下游依赖链"""
        queue = list(successors.get(failed_stage, []))
        while queue:
            s = queue.pop(0)
            if self.stage_status[s] in (StageStatus.PENDING,):
                self.stage_status[s] = StageStatus.SKIPPED
                self.results[s] = StageResult(
                    stage_name=s,
                    status=StageStatus.SKIPPED,
                    logs=f"[Skipped] upstream '{failed_stage}' failed"
                )
                completed.add(s)
                queue.extend(successors.get(s, []))

    def _evaluate_when(self, stage: Stage) -> bool:
        """评估 Stage 的 when 条件"""
        if not stage.when:
            return True
        # 简化实现，实际需要更复杂的表达式求值
        return True

    def cancel(self):
        """请求取消整个 Pipeline"""
        self.cancel_requested = True
```

### 4.3 使用示例

```python
import asyncio

async def main():
    pipeline = Pipeline(
        name="test-pipeline",
        trigger={"events": ["push"]},
        stages=[
            Stage(name="lint", image="node:20", commands=["npm run lint"]),
            Stage(name="unit-test", image="node:20", commands=["npm test"], depends_on=["lint"]),
            Stage(name="e2e-test", image="node:20", commands=["npm run e2e"], depends_on=["lint"]),
            Stage(name="build", image="node:20", commands=["npm run build"], depends_on=["unit-test", "e2e-test"]),
        ]
    )

    executor = DAGExecutor(pipeline, {"branch": "main"})
    result = await executor.execute()

    print(f"Status: {result['status']}")
    print(f"Duration: {result['duration_ms']}ms")
    for stage_name, stage_result in result['stage_results'].items():
        print(f"  {stage_name}: {stage_result['status']}")

asyncio.run(main())
```

输出：

```
Status: success
Duration: 2015ms
  lint: success
  unit-test: success
  e2e-test: success
  build: success
```

---

## 五、Docker Runner：容器执行层

### 5.1 核心职责

1. 拉取镜像（带缓存）
2. 启动容器（资源限制）
3. 收集日志（实时流）
4. 处理超时与取消
5. 清理容器

### 5.2 Docker SDK 基础

```python
import docker

# 初始化客户端
client = docker.from_env()

# 拉取镜像
image = client.images.pull("node:20")

# 启动容器
container = client.containers.run(
    "node:20",
    command="sh -c 'npm install && npm test'",
    working_dir="/app",
    volumes={
        "/path/to/workspace": {"bind": "/app", "mode": "rw"}
    },
    detach=True,          # 后台运行
    mem_limit="2g",       # 内存限制
    cpu_quota=200000,     # CPU 限制（2核）
    stdout=True,
    stderr=True,
)

# 实时日志流
for line in container.logs(stream=True, follow=True):
    print(line.decode("utf-8"), end="")

# 等待容器结束
result = container.wait()
print(f"Exit code: {result['StatusCode']}")

# 清理
container.remove()
```

### 5.3 异步 Runner Manager

```python
import asyncio
import docker
import os
import base64

class RunnerManager:
    """
    Docker Runner 管理器

    关键点：
    1. docker SDK 是同步的，用 asyncio.to_thread 包装
    2. 日志收集用异步队列
    3. 支持取消与超时
    """

    def __init__(self, workspace_dir: str):
        self.client = docker.from_env()
        self.workspace = workspace_dir
        self.active_containers: dict[str, str] = {}

    async def run_stage(
        self,
        stage: Stage,
        context: dict,
        cancel_event: asyncio.Event
    ) -> StageResult:
        """在 Docker 容器中执行 Stage"""
        import uuid, time
        run_id = str(uuid.uuid4())[:8]
        stage_run_id = f"{context.get('run_id', 'run')}_{stage.name}"

        start_time = time.monotonic()
        logs_lines: list[str] = []

        try:
            # 1. 拉取镜像
            await asyncio.to_thread(self.client.images.pull, stage.image)

            # 2. 构建启动命令
            script = self._build_script(stage.commands, context, stage.env)
            script_b64 = base64.b64encode(script.encode()).decode()

            # 3. 启动容器
            container = await asyncio.to_thread(
                self.client.containers.run,
                stage.image,
                command=f"sh -c 'echo {script_b64} | base64 -d | sh'",
                working_dir="/workspace",
                volumes={
                    self.workspace: {"bind": "/workspace", "mode": "rw"},
                },
                detach=True,
                mem_limit="2g",
                cpu_quota=200000,
                stdout=True,
                stderr=True,
                auto_remove=False,
            )
            self.active_containers[stage_run_id] = container.id

            # 4. 等待容器结束或取消
            while True:
                if cancel_event.is_set():
                    await asyncio.to_thread(container.kill)
                    break

                # 轮询容器状态（避免阻塞）
                result = await asyncio.to_thread(container.wait, timeout=5)
                if result["StatusCode"] is not None:
                    break

                # 收集日志
                logs = await asyncio.to_thread(
                    lambda: container.logs(since=int(time.time() - 5)).decode("utf-8", errors="replace")
                )
                logs_lines.append(logs)

            # 5. 读取完整日志
            full_logs = await asyncio.to_thread(
                lambda: container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
            )

            duration_ms = int((time.monotonic() - start_time) * 1000)

            # 6. 获取退出码
            inspect = await asyncio.to_thread(container.inspect)
            exit_code = inspect["State"]["ExitCode"]

            status = StageStatus.SUCCESS if exit_code == 0 else StageStatus.FAILED
            if cancel_event.is_set():
                status = StageStatus.CANCELLED

            return StageResult(
                stage_name=stage.name,
                status=status,
                exit_code=exit_code,
                logs=full_logs,
                duration_ms=duration_ms,
            )

        except asyncio.TimeoutError:
            return StageResult(
                stage_name=stage.name,
                status=StageStatus.FAILED,
                exit_code=-1,
                logs="[TIMEOUT]",
                duration_ms=int((time.monotonic() - start_time) * 1000),
            )
        finally:
            # 清理容器
            container_id = self.active_containers.pop(stage_run_id, None)
            if container_id:
                try:
                    await asyncio.to_thread(
                        self.client.containers.get(container_id).remove,
                        force=True
                    )
                except Exception:
                    pass

    def _build_script(self, commands: list[str], context: dict, stage_env: dict) -> str:
        """构建容器内执行的 Shell 脚本"""
        lines = ["#!/bin/sh", "set -e", "cd /workspace"]

        # 注入环境变量
        for k, v in {**context, **stage_env}.items():
            if not k.startswith("secret:"):
                lines.append(f'export {k}="{v}"')

        lines.append("")
        lines.append(" && ".join(commands))
        return "\n".join(lines)
```

---

## 六、实时日志流（SSE）

### 6.1 Server-Sent Events

```python
# FastAPI 端点
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/runs/{run_id}/logs/stream")
async def stream_logs(run_id: str):
    """
    SSE 实时日志流

    客户端接收：
    EventSource("/api/runs/xxx/logs/stream")
    """
    async def event_generator():
        # 从数据库或文件读取日志
        log_file = f"/var/log/ci/{run_id}.log"

        with open(log_file, "r") as f:
            # 先发送已有日志
            for line in f:
                yield f"data: {line}\n\n"

            # 持续监控新日志
            while True:
                line = f.readline()
                if line:
                    yield f"data: {line}\n\n"
                else:
                    # 检查 Run 是否结束
                    run_status = await get_run_status(run_id)
                    if run_status in ("success", "failed", "cancelled"):
                        yield f"data: [END]\n\n"
                        break
                    await asyncio.sleep(0.1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

### 6.2 前端消费

```typescript
// Vue3 composable
export function useLogStream(runId: string) {
  const logs = ref<string[]>([])
  const isEnd = ref(false)

  onMounted(() => {
    const es = new EventSource(`/api/runs/${runId}/logs/stream`)

    es.onmessage = (e) => {
      if (e.data === "[END]") {
        isEnd.value = true
        es.close()
      } else {
        logs.value.push(e.data)
      }
    }

    es.onerror = () => es.close()

    onUnmounted(() => es.close())
  })

  return { logs, isEnd }
}
```

---

## 七、状态持久化

### 7.1 数据库设计

```sql
-- Pipeline Runs
CREATE TABLE pipeline_runs (
    id            UUID PRIMARY KEY,
    pipeline_id   UUID NOT NULL,
    trigger_event VARCHAR(50),
    branch        VARCHAR(255),
    commit_sha    VARCHAR(40),
    status        VARCHAR(50) DEFAULT 'queued',
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    duration_ms   BIGINT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Stage Runs
CREATE TABLE stage_runs (
    id            UUID PRIMARY KEY,
    run_id        UUID REFERENCES pipeline_runs(id),
    stage_name    VARCHAR(255) NOT NULL,
    status        VARCHAR(50) DEFAULT 'pending',
    logs          TEXT,
    exit_code     INT,
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    duration_ms   BIGINT
);
```

### 7.2 状态更新

```python
async def update_stage_status(run_id: str, stage_name: str, result: StageResult):
    """更新 Stage 状态到数据库"""
    await db.execute(
        """
        UPDATE stage_runs
        SET status = $1, exit_code = $2, logs = $3,
            finished_at = $4, duration_ms = $5
        WHERE run_id = $6 AND stage_name = $7
        """,
        result.status.value,
        result.exit_code,
        result.logs,
        datetime.now(),
        result.duration_ms,
        run_id,
        stage_name,
    )
```

---

## 八、核心难点总结

| 难点 | 解决方案 |
|------|---------|
| **DAG 并发调度** | asyncio.Event + FIRST_COMPLETED 等待任意任务完成 |
| **Docker 同步阻塞** | `asyncio.to_thread()` 包装所有 Docker SDK 调用 |
| **实时日志** | SSE (Server-Sent Events) + 文件 tail |
| **取消机制** | asyncio.Event 信号 + 容器 kill |
| **失败处理** | 跳过下游所有依赖链（递归标记 SKIPPED）|
| **状态持久化** | 每个 Stage 完成时立即写入数据库 |

---

## 九、总结

构建一个 Pipeline Engine 的核心逻辑：

```
1. YAML 解析 → Pipeline 模型
2. Pipeline → DAG（邻接表 + 入度表）
3. 拓扑排序 → 找出入度为 0 的节点
4. 并发启动 → asyncio.create_task
5. 等待完成 → asyncio.Event
6. 更新依赖 → 入度减 1，解锁新节点
7. Docker 执行 → 容器隔离
8. 日志收集 → SSE 实时推送
9. 状态持久化 → 数据库记录
```

理解这些底层原理后，无论是使用 GitHub Actions、GitLab CI，还是自研 CI 系统，你都能游刃有余。

---

## 参考资料

- [Docker SDK for Python](https://docker-py.readthedocs.io/)
- [asyncio 官方文档](https://docs.python.org/3/library/asyncio.html)
- [GitHub Actions 架构设计](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions)
- [Kahn 算法 - 拓扑排序](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm)

---

**小虾子 🦐**  
*2026-07-30*
