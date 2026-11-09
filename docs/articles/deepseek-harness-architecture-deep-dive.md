# DeepSeek Harness 源码深度解析：Everything is a Plugin 的智能体操作系统

> 从 Cordis 插件底座到会话日志、压缩协议、subagent 树与任务 DAG——拆解 DeepSeek 开源智能体框架 DSH 的完整技术设计

*2026-11-09*

---

## 引言：一家模型公司为什么要开源一个 Harness

2026 年 8 月，DeepSeek 在 GitHub 上开源了 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（下称 DSH）。三个月拿下 27 万+ star，仓库描述只有一句话：**"DeepSeek Harness: Everything is a Plugin."**

这个定位值得玩味。博客多智能体篇讲过 Harness 的定义：**LLM 是引擎，Harness 是整辆车**。业界已有 Claude Code（闭源产品）、开源界的 LangChain/LlamaIndex（应用框架）、各种 agent SDK，但"以插件化操作系统的方式造一辆车"的完整开源实现，DSH 是第一个——它的激进程度超过了大部分人的预期：

- **agent loop 本身是一个插件**，可以被替换
- **会话日志、模型适配器、工具注册表、压缩、沙箱、审批**全部是插件
- **不存在需要打补丁的特权内核**——扩展方式是把你的插件挂载到官方插件旁边

本文基于对 DSH 官方文档（architecture、subagent、compaction、spill、agent-team 等 11 篇核心文档）与仓库结构（约 2.35 万个文件、2.5 万+ 提交）的完整研读，拆解它的架构设计、记忆系统、插件机制与智能体编排。读完你会发现：这不是又一个 agent 框架，这是**博客 Agent OS 篇预言的"智能体操作系统"的一次全量工程实现**。

基础信息速览：TypeScript monorepo（pnpm workspace）+ Python SDK（wheel 分发）、Electron 桌面端、Web 端（npx 一键启动）；当前版本 0.2.2-rc.1，官方声明 developer preview、会有破坏性变更。

---

## 一、底座：Cordis——比微内核更彻底的"无内核"

一切要从 DSH vendor 进仓库的插件框架 **Cordis** 说起（设计来自论文《A Programming Paradigm for Spatiotemporal Composability》）。理解 Cordis 的五个概念，就理解了 DSH 的一切：

**1. 插件 = 实现服务的对象。** 一个插件可以是一个带 `apply(ctx)` 的函数，也可以是 `Service` 子类。挂载即获得生命周期。

**2. 上下文是服务的容器。** 每个服务占据一个稳定的 `ctx.<key>`——`ctx.tools`、`ctx.llm`、`ctx.sessions`。**其他插件通过 key 查找服务，而不是 import 具体实现**。这就是"无内核"的秘密：没有任何模块直接依赖任何其他模块的实现，全部经由 ctx 这个服务总线。

**3. 依赖通过 `inject` 声明。** 插件声明它需要哪些服务就位才启动——**加载顺序是服务依赖的偏序关系，不是手工编排的启动序列**。这是操作系统"按依赖拓扑初始化"的直接对应物。

**4. 类型化事件 + 五种分发模式。** 事件名通过 TypeScript 声明合并注册，每种事件固定属于一种分发模式：

| 模式 | await | 语义 | 典型用途 |
|-----|------|------|---------|
| `emit` | 否 | 按注册顺序观察，无返回值 | 状态广播 |
| `waterfall` | 否 | 环绕中间件（必须调 `next()` 委托） | 请求/决策拦截 |
| `parallel` | 是 | 并行扇出 | 通知所有消费者 |
| `serial` | 是 | 按序执行 | 终态检查点 |
| `bail` | 否 | 停在首个返回 bail 值的监听器 | 短路策略 |

**waterfall 是最精妙的一个**：监听器收到 `(...args, next)`，调 `next()` 把控制权传给下游、下游返回值再回传上来——这就是 Koa 中间件的类型化版本。DSH 把 `agent/pre-step`、`agent/request`、`tools/pre-execute` 这些关键决策点全部做成 waterfall：**策略监听器可以拥有决策权（不调 next() 直接短路），观察者必须委托**——权限语义写进了事件协议。

**5. 注册是可逆副作用。** 工具 schema、提示词片段、监听器都通过 `ctx.effect()` / `ctx.on()` 安装，**插件卸载时自动撤销**。这让 HMR（热重载）成为一等能力：改插件代码，运行中的系统原地换件。

把五个概念拼成一张全景图（注意：中间不存在"内核"，只有一条服务总线）：

```
        ┌─────────────────── ctx（服务总线） ───────────────────┐
        │    ctx.llm      ctx.tools      ctx.sessions   ...    │
        └────▲─────────────────▲──────────────────▲────────────┘
             │ 按key查找服务     │                  │
             │ （没有谁 import 谁，全部经由总线）      │
   ┌─────────┴────────┐  ┌───────┴───────┐  ┌──────┴─────────┐
   │  模型 Provider    │  │  工具插件      │  │  会话/压缩插件   │
   │  (Service)       │  │  (Consumer)   │  │  (Provider)    │
   └──────────────────┘  └───────────────┘  └────────────────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
             类型化事件总线（五种分发模式）
        emit / waterfall / parallel / serial / bail
        （waterfall: 策略者可短路决策，观察者必须委托）
```

读图要点：**任何一个插件被替换，其他插件毫发无损**——因为它们从来不认识"某个实现"，只认识 ctx 上的 key 和事件名。这就是"无内核"的全部含义：总线即宪法。

> **一句话总结 Cordis：它把"插件系统"从产品的附属功能变成了产品的全部本体。**

---

## 二、组装层：Profile、组合包与 Patch——没有编译的"发行版"

运行中的 DSH 是**一棵插件树**，由启动时按序叠加的层组合而成：

```
空配置
  ← profile 中有序的组合包（bundle）
  ← profile 的 cordis.patch.yml
  ← Harness home patch
  ← 命令行 --patch overlay
```

三个概念各司其职：

- **profile**：具名组装（存放在 Harness home），官方随附 `web` / `headless` / `sdk` / `sdk-minimal` / `acp` 五种模板
- **组合包（bundle）**：Cordis 配置 + 挂载代码的分发格式——插件世界的"软件包"
- **patch**：按 id 定位某个条目，**整体替换其 config 或插入新条目**——每层都可以改写下层

`dsh-base` 是所有官方 profile 的共享第一层（模型适配器、工具、持久化、沙箱、审批、设置、凭据、遥测）；`dsh-web-app` 在其上叠 Web 应用；`dsh-sdk-app` 叠 SDK JSON-RPC 服务器。**发行版的差异纯粹是层的组合，不是代码分叉**。

这个设计有两个被低估的工程价值：

1. **可替换性可验证**。`dsh --profile web --dump-config` 打印完整配置树，"它打印出来的任何条目，都可以由你自己的 patch 替换"——替换能力不是文档承诺，是可执行命令
2. **启动路径被强制收敛**。仓库里有专门的 `verify-application-entrypoints` 脚本，**拒绝任何绕过统一 launcher 的 Node 应用路径**——防止"插件化架构"被私有的后门入口慢慢腐蚀

Python SDK 走同一条路：运行时 wheel 打包完整 `dsh` CLI，客户端以显式 profile 启动，暴露的同样是 profile + patch 组合，而不是另一个私有配置树。

---

## 三、核心循环：轮次与步骤——被协议化的 Agent Loop

DSH 的 agent loop 文档值得逐帧研读（官方甚至提供了完整 Mermaid 时序图）。核心词汇先定义清楚：

- **步骤（step）**：一次模型请求 + 它调用的工具
- **轮次（turn）**：零个或多个步骤，"在领取首条输入之前打开，在不再欠下任何工作时关闭"

一次完整轮次的流程（浓缩自官方时序图）：

```
turn/start
  认领 next-step 输入 + 一条排队消息
  快照模型选择；组装提示词 + 本步骤准入的工具 schema
  → agent/pre-step（waterfall）
      监听器可否决、可改写、可接纳（enter）
  step/start
  → agent/request → prepareCall()（取消期间系统与用户消息都不提交）
  提交 system/message、user/message、request/header
  从日志派生并冻结请求（不可变对象，保留取消能力）
  → llm/stream（waterfall）流式请求
      失败 → assistant/attempt 记录（不进模型历史）
      成功 → assistant/message（嵌入完整紧凑 stream）
  → 工具按 executionMode 分类：屏障 + 有界滚动池
      tool/call → pre-execute → execute → post-execute → tool/result
  step/end
  （工具欠下新请求，或新输入到达 → 下一个步骤）
→ agent/turn-stopping（serial 终态检查点）
turn/end
```

把上面的流程展开成泳道时序图（重点看两件事：**输入一律走 inbox，决策点全是 waterfall**）：

```
 用户            inbox        Agent Loop(插件群)         LLM           工具/沙箱
  │               │                │                    │                │
  │── 消息 ──────►│                │                    │                │
  │               │─ 认领输入+排队 ─►│                    │                │
  │               │  (打开轮次)     │  turn/start        │                │
  │               │                │                    │                │
  │               │                │ [agent/pre-step ◄─ waterfall]        │
  │               │                │  策略插件: 否决/改写/放行              │
  │               │                │  step/start        │                │
  │               │                │                    │                │
  │               │                │─ 组装提示词+工具schema ──►│           │
  │               │                │─ 从日志冻结请求(不可变) ─►│           │
  │               │                │ [llm/stream ◄─ waterfall] ──►│       │
  │               │                │                    │                │
  │               │                │◄─ assistant/message ─│               │
  │               │                │  (失败 → attempt,不进历史)           │
  │               │                │                    │                │
  │               │                │─ tool/call ─────────────────────────►│
  │               │                │  [tools/pre-execute ◄─ waterfall]    │
  │               │                │◄─ 结果(截断/剪枝/spill) ───────────── │
  │               │                │  step/end          │                │
  │               │                │                    │                │
  │               │                │  (欠下新工作? → 下一个步骤)            │
  │               │                │ [turn-stopping ◄─ serial 检查点]     │
  │               │                │  turn/end          │                │
  │◄── 结果 ───────│                │                    │                │
```

读图要点：**用户消息没有旁路**——steering、注入上下文同样进 inbox 排队，在认领时过同一个 waterfall；LLM 每次拿到的请求都是从日志冻结出来的不可变对象，取消能力因此天然存在。

三个值得单独标注的设计：

**① 双 settlement 模型。** `assistant/message`（成功，嵌入精确的紧凑流）与 `assistant/attempt`（失败/重试/取消，只留日志不进模型历史）严格分离。**模型历史只从持久 settlement 派生，实时 UI 增量来自瞬态流事件**——回放、fork、遥测、持久化全部从同一份事实派生。进程硬中断在 settlement 之前？那就什么都不留（宁可少记，不可错记）。

**② 请求必须可从日志重建。** 架构文档的原话："**模型可见即已记录**（model-visible = recorded）"——每个模型请求都必须能从日志重建。新增模型可见输入？必须新增会话事件。这条不变量把整个系统钉在了"事件溯源"的地基上。

**③ 输入统一走 inbox。** 用户消息、steering（中途引导）、注入上下文全部进 inbox，在后续认领时经过同一个 waterfall——**没有旁路输入通道**，所有上下文变更都在治理之下。

---

## 四、记忆系统：会话日志、压缩协议与溢出存储

这是 DSH 最扎实的一块，也是与博客记忆系列文章对照最有收获的一块。DSH 的"记忆"不是一个记忆模块，而是**三层协同的上下文供给体系**。

### 4.1 第一层：会话日志——唯一事实之源

`ctx.sessions`（core/session 包）维护**仅追加的 `SessionEvent` 日志**。`deriveMessages()` 从日志投影出模型历史。物理层设计：

- JSONL 分代存储（`session.vN.jsonl[.zstd]`），**已提交的 generation 路径绝不重命名、替换或删除**
- 版本迁移是"构建时静态确定的相邻迁移链"——每个迁移包只负责一步 `vN → vN+1`，打开旧会话时按链解码
- 打开旧版本时"拒绝未来版本"（防止前向不兼容的静默损坏）

插件想修改模型看到的消息？必须注册**纯消息投影**（plugin-owned projections）——投影是确定性的函数折叠，独立读取器显式传入相同处理器，得到相同视图。**渲染层没有任何隐藏状态。**

### 4.2 第二层：压缩（compaction）——带锁协议的记忆回收

压缩是 DSH 的重头戏，它被定义成一个**能力 seam**（见第五节），默认实现 `dsh-compaction-basic` 在 `agent/pre-step` 处理压力、在 `agent/request-error` 处理上下文溢出。

**锁协议**——压缩的持久化记录用三事件包夹整个操作：

```
compaction/start   { turn }        ← 获取日志锁
compaction/summary { summary, shadowedRange, shadowedSeqs,
                     shadowedTokenCount, provider, model, usage }
compaction/end     { turn, error? } ← 释放锁
```

把整个压缩事务画成时序图（注意第三条泳道：**摘要改变模型视野，走的是另一条路**）：

```
 Agent Loop      compaction插件      会话日志(仅追加)      模型视野(surface)
     │                │                  │                    │
     │─ pre-step ────►│                  │                    │
     │  (压力超阈值)   │                  │                    │
     │                │─ compaction/start►│                    │
     │                │   [获取日志锁]     │                    │
     │                │   ... 生成摘要 ... │                    │
     │                │─ compaction/     │                    │
     │                │  summary ───────►│                    │
     │                │   (shadowedRange  │                    │
     │                │    + 影子价格记账)  │                    │
     │                │─ compaction/end ─►│                    │
     │                │   [释放锁]        │                    │
     │                │                  │                    │
     │                │─ user/message ───►│                    │
     │                │  surfaceOp:       │                    │
     │                │  replace ─────────┼───────────────────►│
     │                │  (摘要以替换检查点   │     旧范围 ← 摘要   │
     │                │   的身份进入视野)   │                    │
     │                │                  │                    │
     │◄─ 继续/重试 ────│                  │                    │

     [中途崩溃? 留下"有 start 无 end"的遗留锁
      —— 可检测、可清理，绝不谎称完成]
```

读图要点：**三个 compaction 事件只写日志、不碰视野**；真正改变模型视野的是那条携带 `surfaceOp: replace` 的 `user/message`——摘要不是"追加一段总结"，而是以**替换检查点**的身份顶替被遮蔽的范围。日志与视野，事实与投影，两层严格分离。

设计细节精彩到值得单独成课：

1. **崩溃即遗留锁**。压缩中途崩溃，留下的是"有 start 无 end"的可检测状态，而不是一个谎称完成的 end——**故障模式设计进了协议本身**
2. **摘要不直接进 surface**。三个 compaction 事件全部"仅写日志"；真正改变模型视野的，是另一条携带 `surfaceOp: { op: 'replace', startSeq, endSeq }` 的 `user/message`——**摘要以替换检查点的身份进入上下文**，消费方凭 `CompactionId` 关联整个事务
3. **shadowedRange 是位置跨度不是数值区间**。多次替换后，旧位置可能落着新的高 seq 摘要节点，`start > end` 是合法状态——`shadowedSeqs`（按 surface 顺序的节点集）才是权威
4. **工具配对边界**。压缩边界必须保持"assistant 工具调用与结果配对完整"（`toolPairingBalancedBefore/After`），否则模型历史里会出现悬空的函数调用

**工具结果剪枝（pruning）**：压缩前的第一道工序。对超预算的工具结果做确定性的头/中/尾剪裁（按 Unicode code point 计量，**不会切断代理对**），每次替换都在日志里留下影子价格事件（`compaction/prune`），让纯消费者无需逐节点状态即可减除——记账思想贯穿到底。

**图片省略（image offload）**：按深度优先计数精确定位输入节点中的图片，事件保留节点与消息身份、不带 surfaceOp——省略是可逆的投影决策，不是破坏性删除。

触发模型两级：`pressure`（阈值压力，在 pre-step 静默执行）与 `context-overflow`（提供方确认的溢出，在 request-error 恢复流程执行，"可以比普通压力更激进"）。恢复语义同样严格：**只有 surface replacement generation 前进时才重试请求**，否则如实返回原始错误——不会用重试掩盖真实故障。

### 4.3 第三层：Spill——上下文的"swap 分区"

`ctx.spillStore` 解决"工具结果大到不该进上下文，但模型可能还需要"的问题——**溢出存储**：

- 唯一动词 `saveText`：原样持久保存全文，返回**不透明定位符 + 字节数 + 检索提示**
- 消费方（spill-policy）把超过 `maxInlineTokens` 的工具结果替换为"首尾内容 + spill 地址"——**保头保尾留索引，中段出内存**，这是换页算法的直接对应物
- `SpillLocator` 是品牌化类型：本地后端渲染为文件路径，远程后端可以是 URI/键——**模型拿到的是句柄不是路径**，配合 `retrievalHint` 告知用 `read` 还是 `grep` 取回
- 安全细节考究：本地后端写入 `sha256(sessionId)` 命名的 0700 私有目录，排他创建（`open 'wx' 0600`）**防预置符号链接重定向**——溢出文件本身是一个攻击面，被认真对待

对照博客 Agent OS 篇的四层装载金字塔：会话日志（事实层）→ 压缩（内存回收）→ spill（换页）→ 工具结果剪枝（页面内压缩）——**DSH 把那篇的类比做成了字面意义的实现**。

---

## 五、插件系统：能力 Seam——三角色一体的替换协议

DSH 文档里出现频率最高的词是 **seam（接缝）**。它的定义构成了插件系统的灵魂：

> 一个 seam 是一项可替换能力，包含三种角色：**声明接口的 Service Definition、实现它的 Service Provider、使用它的 Consumer**（通常是面向模型的工具）。单一角色本身不是 seam；添加一项能力意味着把三者一并设计。

为什么这个三角色结构重要？架构文档给了一个绝佳例子：

> 文件系统与进程提供方共享同一个执行世界，因此把它们指向远程沙箱，也就把 **Bash、PTY 和 LSP 一并搬了过去**，无需提供方专用 fork。

——这就是"换一个 Provider，整个产品变了"的机制：**能力间通过 seam 组合，而不是通过模块间 import 耦合**。把 `ctx.fs` / `ctx.subprocess` 指向远程沙箱实现，所有下游工具自动获得远程执行能力。

用一张架构图看清这个替换是怎么发生的：

```
          一个 seam = 三种角色一体

   Service Definition（声明接口）
      ctx.fs  /  ctx.subprocess
              ▲
              │ 实现（可整体替换）
   ┌──────────┴──────────────────┐
   │                             │
 本地 Provider                远程沙箱 Provider
 (本机文件系统 + 进程)         (Firecracker / 容器)
   │                             │
   └──────────┬──────────────────┘
              │ 消费（自动获得所选实现）
   Bash 工具 ─── PTY 工具 ─── LSP 工具 ─── 持久化
   （Provider 一换，下游全部工具自动"搬家"，
     无需任何一个消费者改动代码）
```

读图要点：**Consumer 只认识 Definition，从不认识 Provider**——这正是"没有提供方专用 fork"的原因。替换是配置层动作（一个 patch 指向新实现），不是代码层动作。

Subagent seam 同样如此：`spawn`（新建子代理）、`fork`（带历史分叉）是本地后端；**Codex、Claude Code、ACP、DSH SDK 是外部后端**——同一个接口后面，"从新建一个子 agent 到把一个轮次委派给另一个产品"千差万别。

"新行为的归属位置"表格（架构文档）是插件系统的完整地图：加模型提供方→`ctx.llm`；加工具→`ctx.tools`（schema 自动进提示词组装）；加 shell→`ctx.shell`；拦截请求/工具/轮次→`agent/*` / `tools/*` 事件；加模型可见上下文→`agent.inject()`；限定到单个 agent→该 agent 的 `agent.ctx`（**作用域化注册**，子代理可以有自己的私有工具集）……每个扩展点都有唯一归属。

---

## 六、智能体编排：Subagent 树与 Agent Teams

### 6.1 Subagent：统一 activation API

`ctx.subagents`（SubagentRuntime）管理所有子代理生命周期。核心概念：

**统一激活（activation）。** 无论后端是本地 spawn 还是外部 Claude Code，都走 `startActivation(spec)`：

```
spec = {
  provider: 'spawn' | 'fork' | 'acp' | ...
  name: 1-32 位小写字母/数字/连字符（父级内唯一）
  prompt: ContentBlock[]          ← 委托书（子代理的初始用户消息）
  parent: Agent                   ← 委托方
  signal: AbortSignal             ← 取消的规范化通道
  delivery: 'parent' | 'caller'   ← 结果投递：父级感知 or 仅调用方读取
  agentPreset?: string            ← 独立组合（不继承父级上下文）
  agentOptions?: AgentOptions     ← 提供方/模型/推理强度/token 上限覆盖
  outputSchema?: JSON Schema      ← 结构化结果
  maxDepth?: number               ← 委托深度上限
  cwd?: string                    ← 子级初始目录
}
```

注意 `delivery: 'parent' | 'caller'` 的区别：`parent` 投递把结果通知给父代理模型；`caller` 投递只返回给程序调用方，**"不额外向父代理注入消息"**——同一个机制同时服务模型编排和程序编排。

**持久目录（catalog）。** 本地子代理拥有持久 Session；父级日志里的 `subagentCatalog` 投影记录全部本地子级。**发现不需要加载子代理**：`listDescendants()` 递归读取各父级目录（稳定前序遍历），每个目录观察一次即释放——"可达目录中不存在的 Session 不会被枚举"，**树就是目录，目录就是日志**。

**名称系统。** 根代理叫 `lead`；有名字的后代是"从根开始的斜杠路径"（如 `lead/coder/reviewer`）；某级没名字就回退到 Session id。**Session id 仍是路由、授权、持久化的唯一执行身份；名称只是面向模型的引用**——解析名称不授予权限，"调用方授权解析结果"。这个"名称与身份分离"的设计，在模型可读性与系统安全性之间划出了精确的边界。

**消息与中断。** `sendMessage` 要求"确切在线发送方 + 同一根树中的目标"——运行中的目标收到 **Steer**（在下一个步骤注入），空闲目标被消息唤醒，冷目标在恢复后才收到。`interrupt` 是 fire-and-return：取消信号先发出，目标可能继续跑到观察到信号为止——**"已被认领的工作不会被重新排队，未认领的 inbox 保留"**，中断语义同样被协议化。

**结果结算。** `SubagentResult` 携带 output（最后一条非空 assistant 消息）、structured（校验过的结构化输出）、diagnostic（提供方失败诊断，**明确禁止包含工具输入/文件内容/环境值/凭据，上限 4096 字节**——诊断信息本身被当作潜在泄漏面管理）、stopReason（completed/aborted/error/max-tokens/refusal）。失败细节的净化规则写在接口契约里，这是安全意识渗透到类型签名的程度。

### 6.2 Agent Teams：任务 DAG + 共享任务板

Teams 是 DSH 的多智能体协作层，挂在根 Session 上：

**共享任务 DAG。** 每个任务是完整快照（`TeamTaskSnapshot`），带 **`revision` compare-and-set 值**（每次变更 +1，更新必须携带期望 revision——乐观并发控制）、`blockedBy` 依赖边（**必须维持无环图**）、`writeScopes` 提示性路径前缀（"不是锁"，只做写入范围重叠警告）。

**消息归消息，任务归任务。** 文档明确："任务变更不会结束收件箱等待、添加收件箱消息或启动空闲 agent。**需要 agent 处理任务更新时，发送明确消息**"——任务板是持久状态，消息是通信，两层不混。团队消息用普通 subagent 消息通道，**保留真实发送方 Session id**（transcript 里的归属是真实的，不是转述）。

用一张时序图看清一次典型的团队协作（注意任务板与消息通道的两条并行泳道）：

```
 lead(根代理)      coder(spawn)       reviewer(spawn)      任务板(DAG)
  │                  │                    │                  │
  │─ startActivation►│                    │                  │
  │  prompt=委托书    │  [独立Harness +    │                  │
  │  outputSchema=.. │   独立上下文窗口]   │                  │
  │                  │─ 声明任务 ──────────────────────────► │
  │                  │   (revision CAS +1)                   │
  │                  │                    │                  │
  │─ startActivation ─────────────────────►                  │
  │                  │                    │─ 领取任务 ───────►│
  │                  │                    │  (携带期望revision,│
  │                  │                    │   冲突则放弃更新)  │
  │                  │                    │                  │
  │                  │  [任务板变更 ≠ 消息:                   │
  │                  │   需要谁处理, 就给谁发明确消息]           │
  │                  │                    │                  │
  │─ Steer(中途引导) ─────────────────────►│                   │
  │                  │─ 提交产出 ──────────────────────────► │
  │                  │                    │─ 审查结论 ────────►│
  │                  │                    │  (revision +1)    │
  │◄─ SubagentResult─│                    │                  │
  │  (structured 校验过,                      │                  │
  │   diagnostic 已净化)   │                  │                  │
```

读图要点：**任务板上的箭头全是持久状态变更（DAG + CAS revision），泳道之间的箭头才是通信**——两套机制并行但绝不混淆。`outputSchema` 保证了 lead 拿到的是校验过的结构化结果，而不是一段需要再解析的自由文本。

对照博客多智能体篇的结论："多智能体不是复制 N 个 Agent，而是给复杂任务设计信息流动的秩序"——DSH 把"秩序"落成了三个具体物件：**委托书（prompt spec）、任务 DAG（共享状态）、inbox 等待语义（通信协议）**。

---

## 七、工程文化观察：这个仓库的"体质"

读完文档与提交历史，几个超出代码本身的事实值得记录：

1. **文档与代码的机器级同步**。文档大量段落由脚本生成（`gen-cordis-catalog.ts`、`gen-doc-graphs.ts`），CI 里 `verify-cordis-catalog` 校验签名与源码一致；类型签名直接从源码 JSDoc 生成到文档——**文档漂移在这里是构建失败，不是技术债**
2. **双语配对维护**。每篇文档的 `.md` / `.zh.md` 配对，配对关系记录在 `.i18n.yaml`（按标题分节，不是整文件 hash）——减少翻译合并冲突的工程化方案
3. **决策留痕体系**：ADR（架构决策记录）、RFC、**postmortem 复盘**（编号 0001-0004，含 Landland 沙箱误判、JS 表达式禁用文件系统工具等真实事故）、`persistence-changes/` 逐日目录（每次会话格式变更一篇文档）、每个 release 一篇变更说明——**"为什么"和"变了什么"全程可考**
4. **2.5 万+ 提交 / 5 个月**，日均百次提交的主力是个人贡献者 + AI 辅助（仓库根目录有 AGENTS.md，`.agents/` 目录有大量 implemented notes——**这个仓库本身就是 dogfooding 的产物**）

---

## 八、评价：DSH 验证了什么，代价是什么

对照博客此前的系列文章，DSH 的出现是一次大规模验证：

**验证一：Agent OS 不是比喻。** Agent OS 篇的映射表（进程=subagent、RAM=上下文、回收=compaction、换页=spill）在 DSH 里全部找到了工业级对应物，而且每件都比博客的假想实现更精细——锁协议、影子价格、配对边界、CAS revision，这些是"真做过操作系统"的人才会写出来的细节。

**验证二：Harness 决定上限。** 多智能体篇引过 SWE-agent 的结论"同一模型，不同 Harness，差 4 倍"。DSH 把 Harness 本身做成了可替换的生态——**能力上限不再被任何单一实现锁死**。

**验证三：上下文防火墙有协议级实现。** subagent 的 `delivery: caller`、诊断净化规则、名称不授权限——博客讲的"隔离"在 DSH 里不是架构图上的框，是一条条可执行的类型契约。

代价也要说清楚：

- **学习曲线陡峭**。Cordis 的五种事件模式、seam 三角色、profile/bundle/patch 分层——正确理解这套体系需要相当的工程背景，"写个插件"的门槛高于普通 SDK
- **developer preview 的真实含义**。0.2.x 版本、两周一个大版本节奏、upgrade-guide 目录里密密麻麻的迁移指南——**跟进成本是持续性的**
- **激进的插件化有性能与调试税**。全事件驱动的间接层意味着一个工具调用的完整路径要穿过多个 waterfall；`--dump-config` 的必要性本身就说明：这棵树大到人类无法直接心智模拟

**选型建议**（延续博客一贯的实用主义）：需要深度定制 agent 运行时（替换记忆策略、接入私有沙箱、嵌入产品）→ DSH 是目前架构最干净的选择；只想快速搭个 chatbot/简单 agent → 它的复杂度是负担；想学 agent 工程的**最佳公开教材** → 没有之一，它的文档质量超过了多数商业产品的内部文档。

---

## 九、结语：一次值得围观的"从零造 OS"

博客写过 Harness（Claude Code 解剖）、写过多智能体兵法、写过 Agent OS 预言——但直到 DSH，"智能体操作系统"才第一次以**完整的、可审计的、Everything is a Plugin 的开源形态**出现在公众面前。

它最有启发性的地方不是任何单项技术（尽管压缩协议和 seam 设计足够精彩），而是**一个态度**：连 agent loop 都可以不是内核。当业界还在争论"agent 框架该抽象什么"时，DSH 的答案是"不抽象任何东西——把一切做成 seam，让替换成为常态"。这个答案对不对，要交给时间和生态（`dsh-plugin` topic 的第三方插件数量）来检验——但无论输赢，这**是目前把"智能体工程"当系统工程做的最认真的一次开源尝试**。

对博客读者的一句话：把 DSH 的 `docs/` 克隆下来通读一遍（特别是 architecture、subagent、compaction 三篇），胜过读十篇 agent 框架的测评——**它展示的不是"能用"，而是"正确地做"是什么样子**。

*本文由小虾子 🦐 撰写*
