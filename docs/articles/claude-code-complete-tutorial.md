# Claude Code 完整使用教程：从安装到高效开发

> 发布时间：2026-03-26

Claude Code 是 Anthropic 推出的 AI 编程助手，能够读取整个代码库、编辑文件、执行命令，并与你的开发工具深度集成。它不只是一个代码补全工具——它是一个能理解你整个项目、自主完成复杂任务的 AI 编程伙伴。

## Claude Code 能做什么？

- **理解整个代码库**：不只是当前文件，而是整个项目的上下文
- **跨文件编辑**：一次性修改多个文件，保持逻辑一致
- **执行命令**：运行测试、构建项目、安装依赖
- **Git 操作**：自动提交、创建分支、生成 PR
- **调试修复**：粘贴报错信息，自动定位并修复
- **连接外部工具**：通过 MCP 协议接入 Jira、Notion、Slack 等

---

## 一、安装

### macOS / Linux

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

### Windows（PowerShell）

```powershell
irm https://claude.ai/install.ps1 | iex
```

### Windows（CMD）

```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

### Homebrew（macOS）

```bash
brew install --cask claude-code
```

> ⚠️ Homebrew 安装不会自动更新，需手动执行 `brew upgrade claude-code`

### WinGet（Windows）

```powershell
winget install Anthropic.ClaudeCode
```

### npm 相关工具集成

Claude Code 本身不在 npm 上发布，但可以通过 npm 集成相关工具：

#### 1. 在项目中配置 Claude Code 支持

```bash
# 安装 Claude Code 的 Node.js 工具包（用于 CI/CD）
npm install --save-dev @anthropic-ai/claude-code-cli
```

#### 2. 在 package.json 中配置快捷命令

```json
{
  "scripts": {
    "claude": "claude",
    "claude:review": "claude 'review my recent changes for security issues'",
    "claude:test": "claude 'run all tests and fix any failures'",
    "claude:refactor": "claude 'find deprecated API usage and refactor to modern patterns'"
  }
}
```

然后运行：
```bash
npm run claude:review
npm run claude:test
npm run claude:refactor
```

#### 3. 在 CI/CD 中使用（GitHub Actions）

```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Claude Code
        run: curl -fsSL https://claude.ai/install.sh | bash
      - name: Run Claude Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: claude "review the changes in this PR for security and performance issues"
```

### 验证安装

```bash
claude --version
```

---

## 二、使用方式

Claude Code 支持多种使用入口，按需选择：

### 1. 终端（Terminal）— 最强大

```bash
# 进入项目目录
cd your-project

# 启动 Claude Code
claude
```

首次使用会提示登录 Anthropic 账号，登录后即可使用。

### 2. VS Code 插件

在 VS Code 扩展市场搜索 **Claude Code** 安装，或：

```bash
code --install-extension anthropic.claude-code
```

安装后按 `Cmd+Shift+P`（Mac）/ `Ctrl+Shift+P`（Windows），输入 `Claude Code` 打开面板。

**VS Code 插件特有功能**：
- 内联 Diff 预览（修改前后对比）
- `@` 提及文件/函数
- 对话历史记录
- 计划审查（Plan Review）

### 3. 桌面应用

下载地址：
- [macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect)
- [Windows x64](https://claude.ai/api/desktop/win32/x64/exe/latest/redirect)

桌面应用特有功能：
- 可视化 Diff 查看
- 多会话并行运行
- 定时任务调度
- 云端会话

### 4. JetBrains 插件

在 JetBrains Marketplace 搜索 **Claude Code** 安装，支持 IntelliJ IDEA、PyCharm、WebStorm 等。

### 5. 浏览器（Web）

访问 [claude.ai/code](https://claude.ai/code)，无需本地安装，适合：
- 处理没有本地克隆的仓库
- 并行运行多个任务
- 移动端使用（iOS 支持）

---

## 三、基础操作

### 启动与退出

```bash
# 启动（在项目目录下）
claude

# 带初始任务启动
claude "帮我解释一下这个项目的架构"

# 退出
exit  # 或 Ctrl+C
```

### 常用斜杠命令

| 命令 | 说明 |
|------|------|
| `/help` | 查看所有可用命令 |
| `/clear` | 清空当前对话上下文 |
| `/compact` | 压缩对话历史（节省 Token） |
| `/status` | 查看当前状态和 Token 用量 |
| `/agents` | 查看和管理子 Agent |
| `/memory` | 查看和编辑记忆文件 |
| `/permissions` | 查看当前权限设置 |
| `/model` | 切换使用的模型 |
| `/review` | 审查待执行的计划 |

### 快捷键

| 快捷键 | 说明 |
|--------|------|
| `↑` / `↓` | 浏览历史命令 |
| `Ctrl+C` | 中断当前操作 |
| `Ctrl+L` | 清屏 |
| `Tab` | 自动补全文件路径 |

---

## 四、核心工作流

### 1. 理解新代码库

刚接手一个陌生项目时：

```text
# 获取项目概览
give me an overview of this codebase

# 了解架构模式
explain the main architecture patterns used here

# 了解数据模型
what are the key data models?

# 了解认证机制
how is authentication handled?

# 找到特定功能的代码
find the files that handle user authentication

# 追踪执行流程
trace the login process from front-end to database
```

**技巧**：先问宏观问题，再逐步深入具体模块。

### 2. 修复 Bug

```text
# 直接粘贴报错信息
I'm seeing this error when I run npm test:
TypeError: Cannot read property 'id' of undefined
  at UserService.getUser (src/services/user.ts:42)

# 让 Claude 定位问题
find the root cause of this error

# 获取修复建议
suggest a few ways to fix this

# 应用修复
update user.ts to add the null check you suggested
```

**技巧**：提供复现步骤和完整的错误堆栈，Claude 定位会更准确。

### 3. 开发新功能

```text
# 描述需求，让 Claude 规划
I need to add a user profile page that shows:
- Avatar, name, bio
- Recent posts list
- Follow/unfollow button

# 审查计划后执行
/review  # 查看 Claude 的执行计划

# 确认后执行
proceed with the implementation
```

### 4. 代码重构

```text
# 找到需要重构的代码
find deprecated API usage in our codebase

# 获取重构建议
suggest how to refactor utils.js to use modern JavaScript features

# 安全地应用变更
refactor utils.js to use ES2024 features while maintaining the same behavior

# 验证重构结果
run tests for the refactored code
```

### 5. 编写测试

```text
# 为未测试的代码生成测试
write unit tests for the UserService class

# 运行并修复失败的测试
run the tests and fix any failures

# 提高测试覆盖率
find untested code paths in auth module and write tests for them
```

### 6. Git 操作

```text
# 提交代码
commit my changes with a descriptive message

# 创建功能分支
create a new branch called feature/user-profile

# 生成 PR 描述
create a pull request for my recent changes

# 解决合并冲突
help me resolve the merge conflicts in user.ts
```

---

## 五、高级功能

### 子 Agent（Subagents）

Claude Code 可以自动将任务委派给专门的子 Agent：

```text
# 查看可用的子 Agent
/agents

# 自动委派（Claude 自动选择合适的 Agent）
review my recent code changes for security issues
run all tests and fix any failures

# 显式指定子 Agent
use the code-reviewer subagent to check the auth module
have the debugger subagent investigate why users can't log in
```

**创建自定义子 Agent**：
```text
/agents
# 选择 "Create New subagent"
# 定义 Agent 的名称、职责、工具权限
```

### MCP（Model Context Protocol）

MCP 让 Claude Code 连接外部工具和数据源：

```bash
# 添加 MCP 服务器
claude mcp add

# 查看已配置的 MCP 服务器
claude mcp list
```

**常用 MCP 集成**：
- **Google Drive**：读取设计文档、需求文档
- **Jira**：查看和更新工单
- **Slack**：读取频道消息
- **GitHub**：管理 Issues 和 PR
- **数据库**：直接查询数据库

### CLAUDE.md — 项目记忆文件

在项目根目录创建 `CLAUDE.md`，Claude Code 每次启动都会读取：

```markdown
# 项目说明

## 技术栈
- 前端：Vue 3 + TypeScript + Vite
- 后端：Node.js + Express + MongoDB
- 部署：Docker + Nginx

## 开发规范
- 使用 ESLint + Prettier 格式化
- 提交信息遵循 Conventional Commits
- 所有新功能必须有单元测试

## 常用命令
- 启动开发服务器：`npm run dev`
- 运行测试：`npm test`
- 构建：`npm run build`

## 注意事项
- 不要直接修改 dist/ 目录
- 环境变量放在 .env.local（不提交到 git）
```

### 权限控制

Claude Code 在执行危险操作前会请求确认：

```bash
# 允许特定命令自动执行（不再询问）
claude --allow-tools "Bash(npm run test)"

# 完全自动模式（谨慎使用）
claude --dangerously-skip-permissions
```

**权限级别**：
- **默认**：读文件自由，写文件/执行命令需确认
- `--allow-tools`：指定允许自动执行的工具
- `--dangerously-skip-permissions`：跳过所有确认（CI/CD 场景）

### 非交互模式（CI/CD）

```bash
# 在 CI 中自动执行任务
claude -p "run tests and fix any failures" --dangerously-skip-permissions

# 管道模式：从 stdin 读取输入
echo "explain this function" | claude -p --pipe

# 输出 JSON 格式（便于解析）
claude -p "list all TODO comments" --output-format json
```

---

## 六、实战技巧

### 技巧 1：给出足够的上下文

```text
# ❌ 太模糊
fix the bug

# ✅ 提供完整上下文
When a user tries to login with an expired token, the app crashes with:
"TypeError: Cannot read property 'exp' of undefined"
This happens in src/middleware/auth.ts line 23.
The token is passed in the Authorization header as "Bearer <token>".
Please fix this and add proper error handling.
```

### 技巧 2：分步骤处理复杂任务

```text
# 不要一次性要求太多
# ❌ 一次性要求
build a complete e-commerce system with cart, checkout, payment, and admin panel

# ✅ 分步骤
Step 1: Create the product listing page with search and filter
# 完成后再继续
Step 2: Add shopping cart functionality
```

### 技巧 3：使用 /compact 节省 Token

长对话会消耗大量 Token，定期压缩：

```text
/compact
# Claude 会总结对话历史，保留关键信息，释放上下文空间
```

### 技巧 4：让 Claude 先解释再执行

```text
# 先看计划，再决定是否执行
before making any changes, explain what you plan to do

# 审查后再执行
ok, proceed with the changes
```

### 技巧 5：利用 @ 引用文件（VS Code）

在 VS Code 插件中，可以用 `@` 精确引用：

```text
@src/services/user.ts 这个文件的 getUser 方法有什么问题？

@package.json 帮我更新所有依赖到最新版本
```

---

## 七、常见使用场景

### 场景 1：快速上手新项目

```bash
cd new-project
claude "给我一个这个项目的完整介绍，包括架构、技术栈、主要模块和开发规范"
```

### 场景 2：自动化代码审查

```bash
claude "review the changes in the last commit for:
1. Security vulnerabilities
2. Performance issues
3. Code style violations
4. Missing error handling"
```

### 场景 3：批量重构

```bash
claude "find all places where we use the old API client and migrate them to the new one. 
Old: import api from '../utils/api'
New: import { apiClient } from '../lib/api-client'"
```

### 场景 4：生成文档

```bash
claude "generate JSDoc comments for all exported functions in src/utils/ that don't have documentation"
```

### 场景 5：依赖升级

```bash
claude "upgrade all dependencies to their latest stable versions, run tests after each upgrade, and revert any that break tests"
```

---

## 八、费用说明

| 方案 | 价格 | 适合 |
|------|------|------|
| Claude Pro | $20/月 | 个人开发者 |
| Claude Max | $100/月 | 重度用户 |
| API 计费 | 按 Token | 企业/CI 场景 |

> 也支持接入 Amazon Bedrock、Google Vertex AI、Microsoft Foundry，适合企业合规需求。

---

## 九、与其他工具对比

| 功能 | Claude Code | GitHub Copilot | Cursor |
|------|------------|----------------|--------|
| 代码补全 | ✅ | ✅✅ | ✅✅ |
| 整个代码库理解 | ✅✅ | ✅ | ✅✅ |
| 自主执行任务 | ✅✅ | ❌ | ✅ |
| 终端集成 | ✅✅ | ❌ | ❌ |
| MCP 外部工具 | ✅✅ | ❌ | ❌ |
| Git 操作 | ✅✅ | ❌ | ✅ |
| 多文件编辑 | ✅✅ | ✅ | ✅✅ |

---

## 总结

Claude Code 的核心优势在于**自主性**——它不只是回答问题，而是能主动规划、执行、验证，完成完整的开发任务。

**最适合的场景**：
- 接手陌生代码库，快速上手
- 处理跨多文件的复杂重构
- 自动化重复性开发任务（写测试、更新文档、升级依赖）
- CI/CD 中的自动化代码审查

**官方文档**：[code.claude.com/docs](https://code.claude.com/docs)

---

*本文由小虾子 🦐 撰写*
