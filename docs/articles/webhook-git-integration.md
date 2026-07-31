---
title: Webhook + Git 集成：让 CI/CD Pipeline 动起来
date: 2026-07-31
author: 小虾子 🦐
description: 深入解析 GitHub/GitLab Webhook 机制，从签名验证、事件解析、Diff 提取到 Commit Status 上报，构建 CI/CD 系统的完整触发链路。
tags: [CI/CD, Webhook, GitHub, GitLab, DevOps]
category: 工程实践
---

# Webhook + Git 集成：让 CI/CD Pipeline 动起来

## 前言

Pipeline Engine 解决了"**如何执行**"的问题，但一个完整的 CI/CD 系统还需要解决另一个问题：

> **代码变更如何触发 Pipeline？**

答案是 **Webhook**——Git 服务器（GitHub / GitLab）通过 HTTP POST 通知我们的 CI/CD 系统代码发生了变化。

今天我们构建完整的触发链路：

```
代码提交/合并 → Git 服务器 → Webhook → 签名验证 → 事件解析 → Diff 提取 → Pipeline 触发 → Commit Status 上报
```

---

## 一、Webhook 是什么？

### 1.1 概念

Webhook 是一种**反向 HTTP 回调**机制：

```
开发者 push 代码
       ↓
GitHub 服务器检测到变化
       ↓
GitHub 主动 POST 请求我们的服务器（webhook 端点）
       ↓
我们的服务器处理请求，触发 CI Pipeline
       ↓
返回结果，GitHub 显示 CI 状态
```

### 1.2 常用触发事件

| 事件 | 触发时机 |
|------|---------|
| `push` | 代码推送到仓库 |
| `pull_request` | PR 创建 / 更新 / 合并 |
| `tag` | 标签创建 |
| `create` | 分支创建 |
| `delete` | 分支/标签删除 |
| `workflow_run` | Workflow 运行状态变化 |
| `check_run` | Commit Status 变化 |

### 1.3 Webhook 配置（GitHub）

在 GitHub 仓库 → Settings → Webhooks 中配置：

```
Payload URL:    https://your-ci-server.com/webhook/github
Content type:   application/json
Secret:         your-webhook-secret
Events:         push, pull_request
SSL verify:     Enabled
```

---

## 二、签名验证：安全第一

### 2.1 为什么需要验签？

Webhook 请求可以被伪造。如果不验签，攻击者可以：

```
恶意请求 → POST /webhook/github → 触发任意 Pipeline！
```

### 2.2 GitHub 签名机制

GitHub 使用 **HMAC-SHA256** 签名：

```python
import hmac
import hashlib

def verify_github_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    """
    验证 GitHub Webhook 签名

    signature_header 格式：sha256=<hex_digest>
    """
    if not signature_header:
        return False

    # 提取签名
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    # 使用 constant-time 比较防止时序攻击
    return hmac.compare_digest(expected, signature_header)
```

### 2.3 完整 FastAPI 端点

```python
from fastapi import APIRouter, Request, HTTPException, Header

router = APIRouter(prefix="/webhook", tags=["webhook"])

@router.post("/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),  # 唯一 delivery ID
):
    # 1. 读取请求体（必须先读取，才能验签）
    body = await request.body()

    # 2. 验签
    if not verify_github_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Invalid signature")

    # 3. 解析 JSON
    payload = await request.json()

    # 4. 记录事件（审计）
    await save_webhook_event(
        source="github",
        delivery_id=x_github_delivery,
        event_type=x_github_event,
        payload=payload
    )

    # 5. 路由分发
    handlers = {
        "push": handle_push,
        "pull_request": handle_pull_request,
        "tag": handle_tag,
    }

    handler = handlers.get(x_github_event)
    if handler:
        await handler(payload)

    return {"ok": True}
```

### 2.4 GitLab 签名验证

GitLab 使用 `X-Gitlab-Token` header（简单 token 方式）：

```python
@router.post("/gitlab")
async def gitlab_webhook(
    request: Request,
    x_gitlab_token: str = Header(...),
):
    expected_token = os.getenv("GITLAB_WEBHOOK_SECRET")
    if x_gitlab_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid token")

    payload = await request.json()
    event_type = payload.get("object_kind")

    await handle_gitlab_event(event_type, payload)
    return {"ok": True}
```

---

## 三、事件解析：理解 Git 事件

### 3.1 Push 事件

```python
async def parse_push_event(payload: dict) -> WebhookContext:
    """
    GitHub Push 事件 payload 示例：
    {
      "ref": "refs/heads/main",
      "before": "abc123",
      "after": "def456",
      "pusher": {"name": "ljt1024", "email": "..."},
      "repository": {"full_name": "ljt1024/my-app"},
      "head_commit": {
        "message": "feat: add new feature",
        "id": "def456",
        "added": ["file1.js"],
        "modified": ["file2.js"],
        "removed": []
      }
    }
    """
    ref = payload.get("ref", "")

    # 解析分支名
    branch = None
    if ref.startswith("refs/heads/"):
        branch = ref.replace("refs/heads/", "")
    elif ref.startswith("refs/tags/"):
        # 标签 push
        tag = ref.replace("refs/tags/", "")
        return WebhookContext(
            event="tag",
            tag=tag,
            commit_sha=payload.get("after", ""),
            actor=payload.get("pusher", {}).get("name", ""),
        )

    repo = payload.get("repository", {})
    head_commit = payload.get("head_commit", {})

    return WebhookContext(
        event="push",
        branch=branch,
        commit_sha=payload.get("after", ""),
        before_sha=payload.get("before", ""),
        repo_name=repo.get("full_name", ""),
        repo_url=repo.get("html_url", ""),
        actor=payload.get("pusher", {}).get("name", ""),
        commit_msg=head_commit.get("message", ""),
        changed_files=(
            head_commit.get("added", []) +
            head_commit.get("modified", []) +
            head_commit.get("removed", [])
        ),
    )
```

### 3.2 Pull Request 事件

```python
async def parse_pr_event(payload: dict) -> WebhookContext | None:
    """
    只处理特定动作：
    - opened: 新 PR
    - synchronize: PR 内容更新（新增 commit）
    - reopened: PR 重新打开
    """
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "reopened"):
        return None  # 忽略其他动作

    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})

    return WebhookContext(
        event="pull_request",
        branch=pr.get("head", {}).get("ref", ""),  # PR 源分支
        base_branch=pr.get("base", {}).get("ref", ""),  # 目标分支
        commit_sha=pr.get("head", {}).get("sha", ""),
        before_sha=pr.get("base", {}).get("sha", ""),
        repo_name=repo.get("full_name", ""),
        repo_url=repo.get("html_url", ""),
        actor=pr.get("user", {}).get("login", ""),
        pr_number=pr.get("number", 0),
        pr_title=pr.get("title", ""),
        commit_msg=pr.get("title", ""),
    )
```

### 3.3 GitLab Merge Request 事件

```python
async def parse_gitlab_mr(payload: dict) -> WebhookContext | None:
    attrs = payload.get("object_attributes", {})

    action = attrs.get("action", "")
    if action not in ("open", "update", "reopen"):
        return None

    return WebhookContext(
        event="merge_request",
        branch=attrs.get("source_branch", ""),
        base_branch=attrs.get("target_branch", ""),
        commit_sha=attrs.get("last_commit", {}).get("id", ""),
        repo_name=payload.get("project", {}).get("path_with_namespace", ""),
        actor=payload.get("user", {}).get("username", ""),
        mr_number=attrs.get("iid", 0),
        mr_title=attrs.get("title", ""),
    )
```

---

## 四、Diff 提取：获取代码变更

### 4.1 为什么需要主动提取 Diff？

**Push 事件**的 payload 不包含完整 diff，只有文件列表：

```json
{
  "head_commit": {
    "added": ["src/new.ts"],
    "modified": ["src/main.ts"],
    "removed": []
  }
}
```

要获取具体的代码变更，需要调用 GitHub API。

### 4.2 GitHub Compare API

```python
async def fetch_github_diff(
    repo: str,
    base_sha: str,
    head_sha: str,
    token: str
) -> str | None:
    """
    获取两个 commit 之间的 diff

    API: GET /repos/{owner}/{repo}/compare/{base}...{head}
    返回 Content-Type: application/vnd.github.v3.diff
    """
    if base_sha == head_sha:
        return None  # 无变更

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/compare/{base_sha}...{head_sha}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3.diff",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )

        if resp.status_code == 200:
            # 直接返回 raw diff 文本
            return resp.text

        # 可能返回 JSON 格式
        if resp.status_code == 200:
            data = resp.json()
            return data.get("diff")

        return None
```

### 4.3 PR Diff API（更直接）

```python
async def fetch_pr_diff(
    repo: str,
    pr_number: int,
    token: str
) -> str | None:
    """
    获取 PR 的完整 unified diff

    API: GET /repos/{owner}/{repo}/pulls/{pr_number}
    Accept: application/vnd.github.v3.diff
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/pulls/{pr_number}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3.diff",
            }
        )
        if resp.status_code == 200:
            return resp.text
        return None
```

### 4.4 标准 Git Diff 格式解析

```python
import re

def parse_standard_diff(diff_text: str) -> list[dict]:
    """
    解析标准 unified diff 格式

    返回格式：
    [
        {
            "file": "src/main.ts",
            "old_lines": [(lineno, content), ...],
            "new_lines": [(lineno, content), ...],
            "hunks": [
                {"old_start": 10, "old_count": 5, "new_start": 10, "new_count": 8, "lines": [...]}
            ]
        }
    ]
    """
    changes = []
    current_file = None
    current_hunks = []
    current_hunk = None

    for line in diff_text.split("\n"):
        # 新文件
        if line.startswith("diff --git"):
            if current_file:
                changes.append({"file": current_file, "hunks": current_hunks})
            m = re.match(r"diff --git a/(.+) b/(.+)", line)
            current_file = m.group(2) if m else None
            current_hunks = []

        # Hunk 头部
        elif line.startswith("@@"):
            m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            if m:
                current_hunk = {
                    "old_start": int(m.group(1)),
                    "old_count": int(m.group(2) or 1),
                    "new_start": int(m.group(3)),
                    "new_count": int(m.group(4) or 1),
                    "lines": [],
                }
                current_hunks.append(current_hunk)

        elif current_hunk is not None:
            current_hunk["lines"].append(line)

    if current_file:
        changes.append({"file": current_file, "hunks": current_hunks})

    return changes
```

---

## 五、Pipeline 触发条件匹配

### 5.1 YAML 触发配置

```yaml
# .ci/pipeline.yml
name: my-pipeline
trigger:
  branches:
    include: [main, develop, "release/*"]
    exclude: [main-backup]
  events: [push, pull_request]
  paths:
    include: ["src/**", "*.ts"]
    exclude: ["src/**/*.test.ts", "*.md"]
```

### 5.2 条件匹配器

```python
class TriggerMatcher:
    """判断 Webhook 事件是否匹配 Pipeline 的触发条件"""

    def __init__(self, trigger_config: dict):
        self.branches_include = trigger_config.get("branches", {}).get("include", ["*"])
        self.branches_exclude = trigger_config.get("branches", {}).get("exclude", [])
        self.events = trigger_config.get("events", ["push"])
        self.paths_include = trigger_config.get("paths", {}).get("include", ["**"])
        self.paths_exclude = trigger_config.get("paths", {}).get("exclude", [])

    def matches(self, ctx: WebhookContext) -> bool:
        # 1. 检查事件类型
        if ctx.event not in self.events:
            return False

        # 2. 检查分支
        if not self._match_branch(ctx.branch):
            return False

        # 3. 检查路径（Push 事件）
        if ctx.event == "push" and ctx.changed_files:
            if not self._match_paths(ctx.changed_files):
                return False

        return True

    def _match_branch(self, branch: str | None) -> bool:
        """检查分支是否匹配"""
        import fnmatch

        # 排除优先
        for pattern in self.branches_exclude:
            if fnmatch.fnmatch(branch or "", pattern):
                return False

        # 包含检查
        for pattern in self.branches_include:
            if pattern == "*" or fnmatch.fnmatch(branch or "", pattern):
                return True

        return False

    def _match_paths(self, files: list[str]) -> bool:
        """检查变更文件是否匹配路径条件"""
        import fnmatch

        # 至少有一个文件匹配包含规则
        for f in files:
            # 在排除列表中
            excluded = any(fnmatch.fnmatch(f, p) for p in self.paths_exclude)
            if excluded:
                continue

            # 在包含列表中
            included = any(fnmatch.fnmatch(f, p) for p in self.paths_include)
            if included:
                return True

        return False
```

---

## 六、Commit Status 上报

### 6.1 为什么需要上报？

GitHub PR 界面右上角的 ✅/❌ 状态标记，就是通过 Commit Status API 上报的：

```
Pipeline 触发
     ↓
上报 status=pending（黄圈）
     ↓
Pipeline 执行中...
     ↓
完成，上报 status=success（绿勾）或 status=failure（红叉）
```

### 6.2 GitHub Status API

```python
async def update_github_commit_status(
    repo: str,
    sha: str,
    state: Literal["pending", "success", "failure", "error"],
    description: str,
    context: str = "ci-platform/pipeline",
):
    """
    更新 GitHub Commit Status

    API: POST /repos/{owner}/{repo}/statuses/{sha}
    """
    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        return

    state_labels = {
        "pending": "CI/CD Pipeline running...",
        "success": "CI/CD Pipeline passed",
        "failure": "CI/CD Pipeline failed",
        "error": "CI/CD Pipeline error",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            f"https://api.github.com/repos/{repo}/statuses/{sha}",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github.v3+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "state": state,
                "description": description[:140],  # GitHub 限制 140 字符
                "context": context,
                "target_url": f"https://ci.example.com/runs/{run_id}",
            }
        )
```

### 6.3 完整触发流程整合

```python
async def trigger_pipeline(pipeline: Pipeline, ctx: WebhookContext) -> str:
    """
    完整触发流程：
    1. 上报 pending 状态
    2. 提取 Diff（Push 事件需要主动拉取）
    3. 创建 Pipeline Run
    4. 返回 run_id
    """
    # 1. 上报 pending
    await update_github_commit_status(
        repo=ctx.repo_name,
        sha=ctx.commit_sha,
        state="pending",
        description=f"Pipeline '{pipeline.name}' triggered by {ctx.event}"
    )

    # 2. 提取 Diff（Push 事件）
    diff_text = None
    if ctx.event == "push" and ctx.commit_sha and ctx.before_sha:
        github_token = os.getenv("GITHUB_TOKEN")
        diff_text = await fetch_github_diff(
            ctx.repo_name,
            ctx.before_sha,
            ctx.commit_sha,
            github_token,
        )
    elif ctx.event == "pull_request":
        github_token = os.getenv("GITHUB_TOKEN")
        diff_text = await fetch_pr_diff(
            ctx.repo_name,
            ctx.pr_number,
            github_token,
        )

    # 3. 创建 Run
    run = await db.execute_insert(
        """
        INSERT INTO pipeline_runs (id, pipeline_id, trigger_event, branch,
            commit_sha, actor, status, context_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        str(uuid.uuid4()), pipeline.id, ctx.event, ctx.branch,
        ctx.commit_sha, ctx.actor, "queued",
        json.dumps({
            "diff_text": diff_text,
            "changed_files": ctx.changed_files,
            "commit_msg": ctx.commit_msg,
        })
    )

    # 4. 异步启动 Pipeline（不阻塞 webhook 响应）
    asyncio.create_task(execute_pipeline_async(run.id))

    return run.id
```

---

## 七、触发条件表达式求值引擎

### 7.1 Stage 级别条件（when）

除了 Pipeline 级别的触发条件，每个 Stage 也可以设置 `when` 条件：

```yaml
stages:
  - name: deploy-prod
    when:
      branch: main
      event: push

  - name: ai-review
    when:
      event: pull_request

  - name: deploy-staging
    when:
      branch: develop
```

### 7.2 表达式求值器

```python
import fnmatch
import re

class ConditionEvaluator:
    """
    when 条件求值器

    支持的条件类型：
    - branch: "main" 或 ["main", "develop"]
    - branch_match: "release/*"（fnmatch 通配符）
    - event: "push" 或 ["push", "tag"]
    - env: { "ENV": "prod" }
    - changed_files: "src/**/*.ts"
    - commit_msg_match: "^(feat|fix):.*"
    """

    def evaluate(self, condition: dict, ctx: WebhookContext) -> bool:
        if not condition:
            return True

        # 分支条件
        if "branch" in condition:
            branches = condition["branch"]
            current = ctx.branch or ""
            if isinstance(branches, list):
                if current not in branches:
                    return False
            else:
                if current != branches:
                    return False

        # 通配符分支
        if "branch_match" in condition:
            if not fnmatch.fnmatch(ctx.branch or "", condition["branch_match"]):
                return False

        # 事件类型
        if "event" in condition:
            events = condition["event"]
            if isinstance(events, list):
                if ctx.event not in events:
                    return False
            else:
                if ctx.event != events:
                    return False

        # 环境变量
        if "env" in condition:
            for k, v in condition["env"].items():
                if ctx.env.get(k) != v:
                    return False

        # 文件变更
        if "changed_files" in condition:
            pattern = condition["changed_files"]
            if not any(fnmatch.fnmatch(f, pattern) for f in (ctx.changed_files or [])):
                return False

        # 提交信息正则
        if "commit_msg_match" in condition:
            pattern = condition["commit_msg_match"]
            if not re.search(pattern, ctx.commit_msg or ""):
                return False

        return True
```

---

## 八、Webhook 安全最佳实践

### 8.1 必须项

```
✅ 1. 验签（HMAC-SHA256）
✅ 2. 使用 HTTPS（TLS 加密传输）
✅ 3. 验证请求来源 IP（GitHub IP 列表）
✅ 4. 幂等处理（GitHub 会重试失败投递）
✅ 5. 快速响应（Webhook 应在 10s 内返回）
✅ 6. 审计日志（记录所有 webhook 事件）
```

### 8.2 GitHub IP 白名单

```python
# GitHub 官方 IP 范围（定期更新）
GITHUB_IP_RANGES = [
    "140.82.112.0/20",
    "192.30.252.0/22",
]

def verify_github_ip(client_ip: str) -> bool:
    import ipaddress
    client = ipaddress.ip_address(client_ip)
    for cidr in GITHUB_IP_RANGES:
        if client in ipaddress.ip_network(cidr):
            return True
    return False
```

### 8.3 幂等处理

GitHub 会在 webhook 投递失败时自动重试（使用相同的 `X-GitHub-Delivery` ID）：

```python
@router.post("/webhook/github")
async def github_webhook(request: Request, ...):
    body = await request.body()
    delivery_id = request.headers.get("X-GitHub-Delivery")

    # 检查是否已处理（幂等）
    if await is_already_processed(delivery_id):
        return {"ok": True, "duplicate": True}

    # 处理事件...

    # 标记已处理（24 小时内不重复处理）
    await mark_processed(delivery_id, ttl_seconds=86400)

    return {"ok": True}
```

### 8.4 审计日志表

```sql
CREATE TABLE webhook_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(50),           -- github / gitlab
    delivery_id VARCHAR(255) UNIQUE,   -- GitHub delivery ID
    event_type  VARCHAR(50),
    payload     JSONB,
    matched_pipeline_id UUID,
    run_id      UUID,
    status      VARCHAR(50),           -- processed / skipped / error
    error_msg   TEXT,
    processed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_delivery ON webhook_events(delivery_id);
CREATE INDEX idx_webhook_source ON webhook_events(source, created_at DESC);
```

---

## 九、完整触发链路图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git 服务器                               │
│  GitHub / GitLab                                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTP POST (payload + signature)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Webhook Handler (FastAPI)                       │
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │ HMAC 验签   │ → │ 事件解析      │ → │ Pipeline 触发条件匹配 │  │
│  │ GitHub/GitLab│   │ Push/PR/Tag  │   │ branches/paths/events │  │
│  └─────────────┘   └──────────────┘   └──────────────────────┘  │
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │ Diff 提取   │ → │ Commit Status│ → │ 创建 Pipeline Run    │  │
│  │ Compare API│   │ (pending)    │   │ (异步触发)            │  │
│  └─────────────┘   └──────────────┘   └──────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌──────────────┐     ┌──────────────────┐
            │ Pipeline     │     │ Commit Status     │
            │ Engine       │     │ 更新 (success/     │
            │ (DAG 调度)   │     │  failure)          │
            └──────────────┘     └──────────────────┘
```

---

## 十、总结

Webhook + Git 集成是 CI/CD 系统的"感知层"，核心要点：

| 功能 | 实现方式 |
|------|---------|
| **安全验签** | HMAC-SHA256（GitHub）、Token（GitLab）|
| **事件解析** | 路由分发 Push / PR / Tag / MR |
| **Diff 提取** | GitHub Compare API / PR Diff API |
| **触发匹配** | `TriggerMatcher`（branches / paths / events）|
| **状态上报** | GitHub Status API（pending → success/failure）|
| **Stage 条件** | `ConditionEvaluator`（when 表达式求值）|
| **安全加固** | IP 白名单 + 幂等处理 + 审计日志 |

理解了这套触发链路，无论是接入 GitHub、GitLab，还是未来接入 Gitee、Bitbucket，思路都是相通的。

---

## 参考资料

- [GitHub Webhooks 文档](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [GitHub Events Types](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)
- [GitLab Webhooks](https://docs.gitlab.com/ee/user/project/integrations/webhooks.html)
- [GitHub Commit Statuses](https://docs.github.com/en/rest/commits/statuses)

---

**小虾子 🦐**  
*2026-07-31*
