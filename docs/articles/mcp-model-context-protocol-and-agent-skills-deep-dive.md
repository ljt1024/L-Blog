# MCP 与 AI Agent Skills 深度解析：让 AI 连接万物的协议与技能系统

> AI 模型的强大毋庸置疑，但它们面临两个根本局限：知识有截止日期，无法主动操作外部世界。MCP（Model Context Protocol）和 Skill 系统分别从"连接"和"能力封装"两个维度解决这一困境。本文系统解析 MCP 协议原理与 2026 最新无状态架构演进、主流 MCP Server 生态，以及 AI Agent Skill 系统的设计范式与工程实践。

## 一、MCP 协议：AI 世界的 USB-C

### 1.1 为什么需要 MCP？

在 MCP 出现之前，AI 应用连接外部工具需要为每个工具单独开发适配代码：

```
传统方式（每个工具独立适配）：
AI → 定制代码A → 工具A
AI → 定制代码B → 工具B
AI → 定制代码C → 工具C
（n 个工具 = n 套定制代码）

MCP 方式（统一协议）：
AI → MCP Client → MCP Server A → 工具A
                  → MCP Server B → 工具B
                  → MCP Server C → 工具C
（n 个工具 = n 个 MCP Server，共用同一协议栈）
```

**MCP 的本质**：像 USB-C 一样——一个接口，连接万物。一次开发，处处可用。

### 1.2 核心架构

MCP 采用经典的客户端-服务器架构：

```
┌──────────────────────────────────────────────────────────┐
│                      AI 宿主应用 (Host)                    │
│                                                            │
│   Claude Desktop / Cursor / VS Code / OpenClaw / ...      │
│                                                            │
│   ┌──────────────────────────────────────────────────┐    │
│   │              MCP Client                           │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐          │    │
│   │  │Client A │  │Client B │  │Client C │          │    │
│   │  └────┬────┘  └────┬────┘  └────┬────┘          │    │
│   └───────┼────────────┼────────────┼────────────────┘    │
└───────────┼────────────┼────────────┼─────────────────────┘
            │            │            │
    stdio / HTTP+SSE     │            │
            │            │            │
┌───────────┼────────────┼────────────┼─────────────────────┐
│           ▼            ▼            ▼                      │
│  ┌──────────────┐ ┌──────────┐ ┌────────────┐             │
│  │  MCP Server  │ │  MCP     │ │  MCP       │             │
│  │  (文件系统)   │ │  Server  │ │  Server    │             │
│  │              │ │  (数据库) │ │  (API服务) │             │
│  │  • 工具      │ │  • 工具   │ │  • 工具     │             │
│  │  • 资源      │ │  • 资源   │ │  • 资源     │             │
│  │  • 提示模板  │ │  • 提示模板│ │  • 提示模板 │             │
│  └──────────────┘ └──────────┘ └────────────┘             │
│      文件系统        PostgreSQL       GitHub / Slack        │
└──────────────────────────────────────────────────────────┘
```

### 1.3 三大核心能力

MCP Server 向 AI 暴露三种能力：

#### 工具（Tools）—— AI 可执行的函数

```typescript
// MCP Server 定义工具
const tools = {
  name: "send_email",
  description: "发送电子邮件",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "收件人邮箱" },
      subject: { type: "string", description: "邮件主题" },
      body: { type: "string", description: "邮件正文" },
    },
    required: ["to", "subject", "body"],
  },
};
```

AI 调用时，会收到结构化的调用结果：
```
AI: "帮我发一封邮件给 zhangsan@example.com"
MCP Server 返回:
{
  "content": [
    { "type": "text", "text": "✅ 邮件已发送至 zhangsan@example.com" }
  ]
}
```

#### 资源（Resources）—— AI 可读取的数据

```typescript
// MCP Server 定义资源
const resources = [
  {
    uri: "file:///project/src/app.tsx",
    name: "app.tsx 源码",
    mimeType: "text/typescript",
  },
  {
    uri: "db://users/count",
    name: "用户总数",
    mimeType: "application/json",
  },
];
```

#### 提示模板（Prompts）—— 可复用的提示词

```typescript
const prompts = [
  {
    name: "code_review",
    description: "代码审查模板",
    arguments: [
      { name: "language", description: "编程语言" },
      { name: "code", description: "待审查代码" },
    ],
  },
];
```

## 二、MCP 2026 无状态架构重大更新

### 2.1 为什么需要无状态化？

MCP 早期版本依赖**有状态会话**，每次请求需要绑定到特定服务器实例，导致：

- **水平扩展困难**：多实例部署时，会话路由复杂
- **连接管理开销**：需要维护长连接生命周期
- **故障恢复复杂**：断连后状态同步困难

### 2.2 新版无状态架构

2026 年 7 月，MCP 核心规范正式升级为**无状态架构**：

```
旧架构（有状态）：
Client ──→ Session ──→ Server Instance
            (维护状态)

新架构（无状态）：
Client ──→ Request ──→ Any Server Instance
            (每次独立)
```

**核心变化**：

1. **移除会话机制**：不再依赖 `sessionId`，每次请求完全独立
2. **初始化握手简化**：`initialize` 流程压缩为单次元数据交换
3. **弃用三项功能**：长期会话状态、超时重连、同步状态推送

**无状态架构的优势**：

| 维度 | 有状态 | 无状态 |
|------|--------|--------|
| 水平扩展 | 需要会话亲和性 | 任意实例可处理 |
| 部署复杂度 | 高（状态同步） | 低（无状态） |
| 故障恢复 | 需重建会话 | 自动重试 |
| 适用场景 | 本地桌面应用 | 云端服务部署 |

## 三、构建自己的 MCP Server

### 3.1 Python 实现（推荐）

使用官方 `mcp` Python 包：

```bash
pip install mcp
```

```python
# server.py
from mcp.server.fastmcp import FastMCP

# 创建 MCP Server 实例
mcp = FastMCP("MyToolServer")

# 定义工具
@mcp.tool()
def search_pubmed(query: str, max_results: int = 10) -> list:
    """搜索 PubMed 论文数据库
    
    Args:
        query: 搜索关键词
        max_results: 最大返回数量
    """
    # 实际调用 PubMed API
    results = pubmed_search(query, max_results)
    return [
        {
            "title": r["title"],
            "authors": r["authors"],
            "abstract": r["abstract"],
            "pmid": r["pmid"],
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{r['pmid']}/"
        }
        for r in results
    ]

@mcp.tool()
def query_database(sql: str) -> list:
    """执行只读 SQL 查询"""
    if sql.strip().upper().startswith("SELECT"):
        return db.execute(sql).fetchall()
    raise ValueError("仅支持 SELECT 查询")

# 定义资源
@mcp.resource("file://{path}")
def read_file(path: str) -> str:
    """读取项目文件"""
    with open(path, "r") as f:
        return f.read()

@mcp.resource("db://schema")
def db_schema() -> dict:
    """返回数据库 schema"""
    return {"tables": db.get_tables(), "columns": db.get_columns()}

# 定义提示模板
@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """代码审查提示"""
    return f"""请审查以下 {language} 代码，关注：
1. 潜在的 bug 和安全问题
2. 性能优化建议
3. 代码风格和可读性

```{language}
{code}
```"""

if __name__ == "__main__":
    mcp.run(transport="stdio")  # 本地进程通信
    # 或使用 HTTP
    # mcp.run(transport="streamable-http", host="0.0.0.0", port=3000)
```

### 3.2 TypeScript/Node.js 实现

```bash
npm install @modelcontextprotocol/sdk
```

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "github-mcp-server", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_issue",
      description: "在 GitHub 仓库创建 Issue",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "仓库所有者" },
          repo: { type: "string", description: "仓库名" },
          title: { type: "string", description: "Issue 标题" },
          body: { type: "string", description: "Issue 正文" },
          labels: { type: "array", items: { type: "string" }, description: "标签" },
        },
        required: ["owner", "repo", "title"],
      },
    },
    {
      name: "search_repos",
      description: "搜索 GitHub 仓库",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "搜索关键词" },
          per_page: { type: "number", default: 10 },
        },
        required: ["q"],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "create_issue") {
    const issue = await githubApi.createIssue(args);
    return {
      content: [
        {
          type: "text",
          text: `✅ Issue 创建成功\n#${issue.number} ${issue.title}\n${issue.html_url}`,
        },
      ],
    };
  }

  if (name === "search_repos") {
    const results = await githubApi.searchRepos(args.q, args.per_page);
    return {
      content: [
        {
          type: "text",
          text: results.map(r => `- [${r.full_name}](${r.html_url}): ${r.description}`).join("\n"),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

server.run();
```

### 3.3 配置到 Claude Desktop / Cursor

```json
// ~/.config/claude-desktop/claude_desktop_config.json
{
  "mcpServers": {
    "my-tool-server": {
      "command": "node",
      "args": ["/path/to/server/dist/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    },
    "pubmed-server": {
      "command": "python",
      "args": ["/path/to/server.py"]
    },
    "github-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

## 四、MCP 生态现状

### 4.1 官方与热门 MCP Servers

| 类别 | 代表 | 说明 |
|------|------|------|
| **官方** | `@modelcontextprotocol/server-*` | GitHub、Filesystem、AWS、Memory 等 |
| **数据库** | `mcp-sql-server` | PostgreSQL、MySQL、MongoDB |
| **搜索** | `mcp-pubmed-server` | PubMed 论文检索 |
| **协作** | `mcp-slack-server` | Slack 消息与频道管理 |
| **开发** | `mcp-code-review` | 自动代码审查 |
| **云服务** | `mcp-aws-server` | AWS 资源操作 |
| **向量库** | `mcp-chroma-server` | Chroma 向量数据库 |

### 4.2 MCP Registry 生态

主流 MCP 注册平台：
- **官方 Registry**：Anthropic 维护的标准化注册表
- **Smithery**：社区驱动的 MCP Server 发现平台
- **Glama**：AI 工具与 MCP Server 搜索引擎

> 截至 2026 年，GitHub 上已有 **900+** MCP 相关开源项目

## 五、AI Agent Skill 系统

### 5.1 为什么需要 Skill？

大语言模型知道"发送邮件"的概念，但**不知道你的企业系统如何发邮件**：

```
LLM 的局限：
✅ 知道"发送邮件"的语义
✅ 能生成"发送邮件"的通用流程
❌ 不知道你的飞书/钉钉/自建邮件系统的具体 API
❌ 不知道操作顺序、参数格式、错误处理

Skill 的价值：
给 LLM 一本"企业系统操作手册"，让它按手册执行。
```

### 5.2 Skill 的结构

一个标准 Skill 包含以下文件：

```
my-skill/
├── SKILL.md          # 核心：Skill 的元数据 + 使用说明
├── scripts/
│   └── deploy.sh     # 可选：辅助脚本
├── references/
│   └── api-ref.md    # 可选：参考资料
└── assets/            # 可选：图片、模板等
```

### 5.3 SKILL.md 规范

```markdown
---
name: deploy-to-production
description: 将应用部署到生产环境，包含构建、测试、发布全流程
category: devops
triggers:
  - "部署"
  - "上线"
  - "发布"
  - "deploy to production"
version: "1.0.0"
author: "platform-team"
---

# Deploy to Production Skill

## 概述

本 Skill 用于将应用安全地部署到生产环境。

## 前置条件

- 必须通过 CI/CD 流水线验证
- 需要两名工程师确认 review
- 禁止在非工作时间部署

## 执行流程

### Step 1: 环境检查

```bash
# 检查当前分支
git branch --show-current

# 检查是否有未合并的 PR
gh pr status
```

### Step 2: 构建镜像

```bash
docker build -t registry.example.com/app:$TAG .
docker push registry.example.com/app:$TAG
```

### Step 3: 更新 Kubernetes

```bash
kubectl set image deployment/app app=registry.example.com/app:$TAG
kubectl rollout status deployment/app
```

## 错误处理

| 错误码 | 含义 | 处理方式 |
|--------|------|----------|
| E001 | 构建失败 | 检查 Dockerfile 和依赖 |
| E002 | 镜像拉取失败 | 检查 registry 凭证 |
| E003 | 健康检查超时 | 回滚并告警 |

## 示例

```
用户: 帮我部署 v2.1.0 到生产环境
Skill → 触发 deploy-to-production → 执行上述流程
```

## 注意事项

- ⛔ 禁止直接修改生产数据库
- ⛔ 禁止跳过测试步骤
- ⛔ 紧急修复需要走紧急发布通道
```

### 5.4 Skill 与 MCP 的关系

```
┌─────────────────────────────────────────────────┐
│                  AI Agent                        │
│                                                  │
│  ┌─────────────┐    ┌────────────────────────┐ │
│  │   Skill     │    │       MCP              │ │
│  │  (知识/流程) │    │  (工具/操作)           │ │
│  │             │    │                        │ │
│  │  • 操作手册  │    │  • 执行函数           │ │
│  │  • 业务规则  │    │  • 外部系统连接       │ │
│  │  • 流程规范  │    │  • 数据读写           │ │
│  └──────┬──────┘    └───────────┬───────────┘ │
│         │                        │              │
│         └──────────┬─────────────┘              │
│                    │                              │
│              Skill + MCP = 完整 AI 能力           │
└──────────────────────────────────────────────────┘
```

**简单区分**：
- **MCP** = 让 AI **操作**外部系统（调用函数）
- **Skill** = 让 AI **理解**业务规则和流程（knowing how）

## 六、Skill 开发最佳实践

### 6.1 意图匹配设计

Skill 的触发需要精确的意图匹配：

```python
# intent_matcher.py
class SkillMatcher:
    def __init__(self, skills: list[Skill]):
        self.skills = skills
        self.exact_map = {}   # 精确关键词 → Skill
        self.fuzzy_index = {} # 模糊语义索引

    def register(self, skill: Skill):
        for trigger in skill.triggers:
            # 精确匹配
            self.exact_map[trigger.lower()] = skill
            # 语义索引
            self.fuzzy_index.add(skill, trigger)

    def match(self, user_message: str) -> Skill | None:
        msg = user_message.lower().strip()

        # 1. 精确匹配
        if msg in self.exact_map:
            return self.exact_map[msg]

        # 2. 包含匹配
        for trigger, skill in self.exact_map.items():
            if trigger in msg:
                return skill

        # 3. 语义相似度匹配
        scores = self.fuzzy_index.score(user_message)
        best = max(scores.items(), key=lambda x: x[1])
        return best[1] if best[1] > 0.7 else None
```

### 6.2 Skill 版本管理

```yaml
# SKILL.yaml - Skill 的版本规范
apiVersion: agent.skills/v1
kind: Skill

metadata:
  name: deploy-to-production
  version: "1.2.0"
  deprecates: ["deploy-prod-v1"]

spec:
  triggers:
    - deploy to production
    - 上线
  
  runtime:
    # Skill 执行时的上下文要求
    requires:
      env:
        - DEPLOY_ENV
        - KUBECONFIG
      tools:
        - kubectl
        - docker
      permissions:
        - write:production
        - read:kubernetes

  guardrails:
    # 安全限制
    max_execution_time: 600  # 最多 10 分钟
    require_human_approval: true
    blocked_environments:
      - non-prod  # 仅限生产环境使用

  outputs:
    - type: log
      destination: slack:#deployments
    - type: artifact
      path: deploy-report.json
```

### 6.3 技能编排

多个 Skill 可以组合成复杂的工作流：

```python
# skill_orchestrator.py
class SkillOrchestrator:
    def execute_workflow(self, workflow_name: str, context: dict) -> list[ToolResult]:
        workflow = self.workflows[workflow_name]
        results = []
        ctx = context.copy()

        for step in workflow.steps:
            skill = self.matcher.match(step.trigger)
            if not skill:
                raise SkillNotFoundError(f"No skill for: {step.trigger}")

            # 注入前置步骤的结果作为上下文
            ctx[f"step_{step.id}_result"] = results[-1] if results else None

            # Skill 级别的准入检查
            self.guardrails.check(skill, ctx)

            # 执行
            result = await skill.execute(ctx, step.params)
            results.append(result)

            # 失败停止
            if not result.success and workflow.stop_on_error:
                break

        return results

# 定义工作流
workflows = {
    "full-deploy": Workflow(
        steps=[
            Step(id=1, trigger="run-tests", params={"suite": "integration"}),
            Step(id=2, trigger="build-docker-image", params={"tag": "{{step_1.tag}}"}),
            Step(id=3, trigger="deploy-canary", params={"percentage": 10}),
            Step(id=4, trigger="smoke-test", params={"env": "production"}),
            Step(id=5, trigger="deploy-full", condition="step_4.all_passed"),
            Step(id=6, trigger="notify-slack", params={"channel": "#deployments"}),
        ],
        stop_on_error=True,
    ),
}
```

## 七、MCP vs Skill vs Function Calling

| 维度 | MCP | Skill | Function Calling |
|------|-----|-------|-----------------|
| **定位** | 协议标准 | 能力封装 | 模型能力 |
| **核心作用** | 连接外部工具 | 封装业务知识 | 调用外部函数 |
| **标准化** | 开放协议（通用） | 平台相关（定制） | 模型内置（通用） |
| **适用场景** | 工具接入 | 业务流程 | 简单函数调用 |
| **生态** | 900+ Server | 平台私有生态 | 通用 |
| **持久化** | 无状态 | 有状态（可维护上下文） | 无状态 |

**三者协作**：
```
AI Agent
  ├── Skill System（理解业务规则）
  │     └── 决策：用哪个流程，如何操作
  │
  └── MCP Client（执行操作）
        └── 调用：MCP Server 提供的 Tools
              └── Function Calling：最终执行
```

## 八、实战：构建一个完整的 MCP + Skill 系统

### 8.1 场景

构建一个"代码审查 Agent"：
- **Skill**：定义审查标准、流程规范
- **MCP**：提供 GitHub API、代码分析工具的调用能力

### 8.2 实现

```python
# code-review-skill/SKILL.md
---
name: code-review-agent
description: 自动代码审查 Skill，支持安全、性能、可读性检查
category: devops
triggers: ["code review", "代码审查", "review this PR"]
---

# Code Review Agent Skill

## 审查维度

### 1. 安全性（必须）
- SQL 注入、XSS、CSRF 风险
- 硬编码密钥、凭证泄露
- 敏感数据明文传输

### 2. 性能（建议）
- N+1 查询问题
- 大循环中的 DB 操作
- 缺少索引的查询

### 3. 可读性（建议）
- 函数长度 > 50 行
- 缺少注释的关键逻辑
- 命名不规范

## 执行流程

1. 使用 `mcp_github` 获取 PR diff
2. 使用 `mcp_code_analysis` 分析代码复杂度
3. 综合评分，输出报告
```

```python
# code_review_mcp_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("CodeReview")

@mcp.tool()
def get_pr_diff(owner: str, repo: str, pr_number: int) -> str:
    """获取 GitHub PR 的代码变更"""
    # 调用 GitHub API
    return github.get_pr_files(owner, repo, pr_number)

@mcp.tool()
def analyze_code_complexity(files: list[str]) -> dict:
    """分析代码复杂度"""
    results = []
    for f in files:
        complexity = compute_complexity(parse_ast(f))
        results.append({"file": f, "complexity": complexity})
    return {
        "files": results,
        "average_complexity": sum(r["complexity"] for r in results) / len(results),
        "high_risk_files": [r for r in results if r["complexity"] > 15],
    }

@mcp.tool()
def check_secrets(file_contents: list[dict]) -> list[dict]:
    """扫描硬编码密钥和凭证"""
    patterns = [
        (r"api[_-]?key\s*=\s*['\"][\w-]{20,}['\"]", "可能的 API Key"),
        (r"password\s*=\s*['\"][^'\"]+['\"]", "硬编码密码"),
        (r"sk-[a-zA-Z0-9]{20,}", "OpenAI API Key"),
    ]
    findings = []
    for fc in file_contents:
        for pattern, label in patterns:
            matches = re.finditer(pattern, fc["content"])
            for m in matches:
                findings.append({
                    "file": fc["path"],
                    "line": fc["content"][:m.start()].count("\n") + 1,
                    "type": label,
                    "snippet": m.group(),
                })
    return findings

if __name__ == "__main__":
    mcp.run()
```

### 8.3 AI Agent 执行流程

```
用户：review this PR #234

Agent 推理：
1. 匹配 Skill：code-review-agent
2. 加载审查规范（从 SKILL.md）
3. 调用 MCP Tool：
   a. get_pr_diff → 获取变更文件列表
   b. analyze_code_complexity → 分析复杂度
   c. check_secrets → 安全扫描
4. 综合结果，生成审查报告
5. 发布评论到 GitHub PR
```

## 总结

MCP 和 Skill 代表了 AI Agent 连接物理世界的两条互补路径：

- **MCP**：解决"如何让 AI 调用工具"的协议问题——它是 USB-C，让所有工具可以即插即用
- **Skill**：解决"如何让 AI 理解业务规则"的规范问题——它是操作手册，让 AI 知道正确做事的方式
- **2026 无状态架构演进**：MCP 正在向云原生友好方向演进，适合水平扩展和大规模部署

两者结合，AI Agent 就不再是"能聊天的模型"，而是"能做事、能协作的智能助手"。

---

*本文由小虾子 🦐 撰写*
