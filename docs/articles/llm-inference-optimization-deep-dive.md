# LLM 推理优化深度解析：KV Cache、Continuous Batching、PagedAttention 与量化，从原理到 vLLM 实战

> 调 API 时你付的是"每 token 价格"；自己部署时你面对的是"每 GPU 小时能吐多少 token"。这篇文章讲清楚推理引擎榨干 GPU 的全部底层技术——读完你会明白 vLLM 为什么快、KV Cache 显存怎么算、什么时候该离开 API 自建推理服务。

*发布日期：2026-10-03*

## 为什么需要理解推理优化

大多数开发者的 LLM 之旅止步于 OpenAI SDK。但以下场景会把你推向自部署：

| 场景 | API 的问题 | 自部署的解法 |
|-----|-----------|-------------|
| 高吞吐离线任务（每天百万 token 级） | 按 token 计费，成本线性失控 | 单卡 A100 吞吐打满后，成本可降 5~20 倍 |
| 数据合规（医疗/金融/政务） | 数据出境即违规 | 内网部署，数据不出机房 |
| 长尾模型（微调后的垂直模型） | API 不托管你的 LoRA | vLLM 直接加载 |
| 极低延迟（< 100ms 首 token） | 网络往返 + 排队不可控 | 同机房部署，TTFT 可控在 50ms 内 |
| 批量结构化抽取 | 限流 + 排队抖动 | 自己的集群自己排队 |

但自部署的第一课往往是被现实毒打：**同一张 A100，用 `transformers` 裸跑和用 vLLM 跑，吞吐量差 20~40 倍**。差距来自哪里？来自这篇文章要讲的每一个技术：KV Cache、Continuous Batching、PagedAttention、量化、投机解码。

理解它们，你才能：

- 看懂推理引擎的参数（`gpu-memory-utilization`、`max-num-seqs`、`enable-prefix-caching`）到底在调什么
- 准确估算"我的模型需要几张什么卡"
- 在延迟和吞吐之间做出正确的权衡

---

## Transformer 推理的两个阶段：Prefill 与 Decode

要理解一切优化，先理解 LLM 生成文本的两段式本质。

### Prefill（预填充）阶段

你输入了一段 2000 token 的 prompt，模型要做的第一件事是**并行处理全部输入**：

```
输入: [t1, t2, t3, ..., t2000]
  ↓ 一次前向传播（矩阵乘法可以完全并行）
输出: 第一个新 token 的概率分布
```

这个阶段是**计算密集型（compute-bound）**的。GPU 的并行计算能力被充分利用，特点是：

- 快：2000 token 的 prompt 通常几十毫秒就能处理完
- 贵：FLOPs 消耗与 prompt 长度的平方成正比（注意力）或线性（FlashAttention 优化后）

### Decode（解码）阶段

从第二个 token 开始，画风突变。自回归生成**必须一个一个来**：

```
t1 t2 ... t2000 → 生成 t2001
                  t1 ... t2001 → 生成 t2002
                                t1 ... t2002 → 生成 t2003
                                ...（串行，每步只能出一个 token）
```

这个阶段是**访存密集型（memory-bound）**的。每生成一个 token，都要把模型的全部权重从显存读一遍。关键洞察：

> **Decode 阶段的瓶颈不是计算，而是显存带宽。** 每 token 需要读全部权重（7B 模型 FP16 约 14GB），A100 带宽 2TB/s，意味着单请求解码速度上限约 2000GB/s ÷ 14GB ≈ 140 token/s——与算力无关。

### 两阶段的性能指标

这直接对应两个用户体验指标：

- **TTFT（Time To First Token）**：主要由 Prefill 决定——用户感知"模型开始反应了"
- **TPOT（Time Per Output Token）**：主要由 Decode 决定——用户感知"打字速度"

流式输出（见之前的 Streaming 文章）之所以体验好，正是因为它把 TTFT 和 TPOT 的感知分离了。

---

## KV Cache：自回归生成的救命缓存

### 没有缓存的世界有多糟

回顾自注意力计算。生成第 N 个 token 时，注意力需要第 N 个 token 的 Query 与**所有前文 token** 的 Key/Value 做点积。

如果没有缓存，生成第 100 个 token 时要重算前 99 个 token 的 K/V；生成第 101 个时重算前 100 个……总计算量是 O(N²) 次前向传播。1000 token 的生成任务要跑 1000 次完整前向，且每次都重复计算 99% 相同的东西。

### KV Cache 的本质

**已生成 token 的 K/V 不会变，缓存它们。**

```python
# 伪代码：带 KV Cache 的解码循环
past_kv = None
for step in range(max_new_tokens):
    if step == 0:
        # Prefill: 整个 prompt 一起算
        out, past_kv = model(prompt_ids, past_key_values=None)
    else:
        # Decode: 只输入上一步生成的 1 个 token
        out, past_kv = model(last_token_id, past_key_values=past_kv)
    last_token_id = out.argmax(-1)
```

每步只前向传播 **1 个 token**，K/V 追加进缓存。计算量从 O(N²) 降为 O(N)。

代价是显存。KV Cache 的大小公式：

```
KV Cache 显存 = 2 (K和V) × 层数 × KV头数 × 头维度 × 序列长度 × 精度字节数 × 批大小
```

以 Llama-2-7B（32 层，32 头，头维 128，FP16）为例，单请求 4096 token 上下文：

```
2 × 32 × 32 × 128 × 4096 × 2 bytes = 2,147,483,648 bytes ≈ 2 GB
```

**一个 7B 模型（权重 14GB），跑一条 4K 上下文的请求，光 KV Cache 就要 2GB。** 若批大小 16，KV Cache 吃掉 32GB——比权重还大。这就是为什么长上下文 + 大批量是显存杀手，也是后面 PagedAttention 要解决的核心矛盾。

### MQA 与 GQA：用"共享钥匙"砍缓存

Multi-Head Attention 中 32 个头各自有独立的 K/V。三代演进：

```
MHA  (Multi-Head Attention)      : 32 个 Q 头，32 个 KV 头   → KV Cache 最大
MQA  (Multi-Query Attention)     : 32 个 Q 头，1  个 KV 头   → KV Cache 缩小 32 倍，质量下降
GQA  (Grouped-Query Attention)   : 32 个 Q 头，8  个 KV 头   → KV Cache 缩小 4 倍，质量几乎无损 ✅
```

GQA 是质量与显存的工程平衡点，Llama-3、Qwen2、Mistral 全部采用。阅读模型卡时看到 "GQA-8" 或 "grouped-query attention"，就该知道它在为推理显存让路。

### KV Cache 与 Prompt Caching 的关系

之前写过 Prompt Caching（API 按 cache hit 打折）。其原理正是服务商把 KV Cache 在请求间**持久化**：同前缀的请求直接复用已算好的 KV，跳过整个 Prefill。

- 应用层 Prompt Caching：把稳定前缀放头部、变量放尾部 → cache 命中 → TTFT 骤降
- 推理层 Prefix Caching：vLLM 的 `--enable-prefix-caching`，自建服务也能享受同样红利

两层是同一枚硬币的两面。

---

## Continuous Batching：静态批处理的效率革命

### 静态 batching 的浪费

朴素服务这样处理并发：攒一批请求 → 整批一起推理 → 全部完成 → 返回 → 攒下一批。

致命问题是**请求完成时间严重不均**：

```
批内 4 个请求，生成长度分别为 10 / 50 / 200 / 500 tokens

时间线（静态批）：
请求A: ██████████ (10 tokens 后就完成了，但必须干等)
请求B: ████████████████████████████████████████ (50)
请求C: ████████...(200)...████████
请求D: ███████████████████████████████████████████████...(500)...████

GPU 利用率：A 完成后的 490 步，它占的槽位全程空转
```

实验数据表明静态 batching 的 GPU 利用率常低于 40%。批内最长请求决定了整批时间，短请求的槽位白白浪费。

### Continuous Batching（又名 in-flight batching / iteration-level scheduling）

Orca 论文（2022）的核心思想：**调度粒度从"请求级"细化到"步级"。**

```
时间线（连续批）：
步1:  A B C D     ← 4 个请求同时解码
步2:  A B C D
...
步10: - B C D     ← A 生成完毕立即返回，槽位空出
步11: - B C D E   ← 新请求 E 立即插入，不等这批结束！
...
步50: - - C D E F ← B 完成返回，F 插入
```

每个解码步（decoder iteration）都是一次调度机会：完成的请求离开、排队的请求进入。配合 Prefill 与 Decode 的交织（chunked prefill 可以把长 prompt 的预填充切成块，避免堵塞解码），GPU 始终满载。

这是 vLLM、TGI 吞吐量相差 20 倍以上的第一大功臣。

---

## PagedAttention：vLLM 的显存碎片治理

Continuous Batching 解决了"槽位浪费"，但 KV Cache 的显存管理还剩一个难题。

### 预分配的困境

KV Cache 的显存需求随序列长度增长，引擎必须提前预留。传统方案按 `max_seq_len`（比如 4096）预分配连续显存：

- **内部碎片**：请求实际只用了 500 token，却占着 4096 的预留空间 → 浪费 87%
- **外部碎片**：大量预留块大小不一，即使总空闲显存足够，也找不到连续大块

vLLM 论文测量：传统方案下 KV Cache 实际利用率仅 20~40%。

### 操作系统级别的灵感

PagedAttention 把**虚拟内存分页机制**搬进了 GPU 显存管理：

```
逻辑视角：每个序列有一条"虚拟"连续的 KV Cache
物理视角：KV Cache 被切成固定大小的 block（默认 16 token/块），散落在显存各处
映射：    块表（block table）维护 逻辑块 → 物理块 的映射
```

效果：

| 维度 | 预分配 | PagedAttention |
|-----|--------|----------------|
| 内部碎片 | 最多浪费 max_len - actual_len | 最多浪费一个块（<16 token） |
| 外部碎片 | 严重 | 几乎为零（块本来就是离散的） |
| 显存利用率 | 20~40% | > 90% |
| 内存共享 | 不可能 | 天然支持（见下） |

### 意外的收获：prefix sharing

分页化之后，**不同序列可以共享物理块**。Beam search 的多个候选共享前缀、system prompt 相同的多个请求共享 system 块——共享块用引用计数管理，只在写时复制（copy-on-write）。这成为 vLLM Prefix Caching 的实现基础。

---

## 投机解码：让小模型替大模型打草稿

Decode 阶段 memory-bound 的本质是"读一遍权重只出 1 个 token"。投机解码（Speculative Decoding）的反直觉解法：**一次前向，验证多个 token。**

```
1. 起草（Draft）: 小模型（如 1B）快速生成 k 个候选 token（串行但便宜）
                   "今天天气真" → 好 / 啊 / ，/ 很

2. 验证（Verify）: 大模型一次前向，并行计算这 k 个位置的概率分布
                   对照候选，从头保留第一个不匹配之前的所有 token

3. 结果: 一次大模型前向可能接受 2~4 个 token（而不是 1 个）
         拒绝处用大模型的分布采样，保证输出分布与原模型严格一致！
```

两个关键性质：

- **输出分布数学上等价于大模型自己生成**（这是论文的精妙之处，验证-拒绝机制保证了这一点）
- 加速比取决于"小模型与大模型的契合度"：通用文本 2~3 倍，代码等结构化场景 3~4 倍

变体生态：Medusa（大模型自己长出多个预测头）、EAGLE（特征级自回归起草）、Lookahead Decoding。vLLM 已内置 `--speculative-model` 支持。这在 TPOT（打字速度）敏感的对话场景价值巨大。

---

## 量化：砍掉显存的四板斧

权重是显存第一大户。降低权重精度 = 更小显存 + 更快 Decode（带宽消耗少了）。

| 精度 | 字节/参数 | 7B 模型显存 | 说明 |
|------|----------|------------|------|
| FP32 | 4 | 28 GB | 训练遗留，推理没人用 |
| FP16/BF16 | 2 | 14 GB | 推理基线，无损 |
| INT8 (W8A8) | 1 | 7 GB | 权重+激活都量化，几乎无损 |
| FP8 (W8A8) | 1 | 7 GB | H100 原生支持，硬件级加速 |
| INT4 (GPTQ/AWQ) | 0.5 | 3.5 GB | 消费级卡跑 7B 的钥匙 |
| GGUF Q4 | ~0.55 | ~3.8 GB | llama.cpp 生态，CPU/混合推理 |

三种主流 INT4 方法的定位：

- **GPTQ**：逐层最小化量化误差（基于二阶信息），GPU 推理老牌方案
- **AWQ**：观察激活分布，保护"重要权重"（激活大的通道保持高精度），量化误差更小、速度快于 GPTQ，目前最常用
- **GGUF**：llama.cpp 自家的格式，支持 CPU offload（部分层放内存），Mac M 系列统一内存的天然选择

经验法则：**7B-AWQ 量化后在 A10（24GB）上的服务质量，约等于 FP16 在 A100 上的 85%，但硬件成本 1/8。** 量化不是"降级"，是绝大多数生产部署的正确起点。

质量损失预期：INT8 < 1%（忽略不计）；INT4 在通用任务 1~3%，数学/代码等精确任务 3~8%，需要用你的评估集验证（呼应之前的 LLM 评估文章）。

---

## 推理引擎选型：一张表看懂

| 引擎 | 定位 | 优势 | 适用 |
|------|------|------|------|
| **vLLM** | 高吞吐 GPU 服务事实标准 | PagedAttention、Continuous Batching、prefix caching、OpenAI 兼容 API、生态最全 | 生产 GPU 服务首选 |
| **SGLang** | 高性能新锐 | RadixAttention（前缀树缓存）、结构化输出极快、超并发 | 复杂 prompting 程序、agent 负载 |
| **TGI** (HuggingFace) | 企业级 | 成熟稳定，Docker 一键部署 | HF 生态用户 |
| **TensorRT-LLM** (NVIDIA) | 极致性能 | kernel 级优化最深、FP8/In-flight batching | NVIDIA 重度用户，调优成本高 |
| **llama.cpp** | 边缘/本地 | GGUF、CPU/Metal/CUDA 全平台、零依赖 | 本地开发、Mac、边缘设备 |
| **Ollama** | llama.cpp 的易用壳 | `ollama pull` 即用，开发者体验极佳 | 个人本地、原型 |

选型速查：GPU 生产 → vLLM；Agent 高并发前缀复用 → 试试 SGLang；笔记本本地跑 → Ollama。

---

## 实战：vLLM 部署 Qwen2.5-7B 完整流程

### 安装与启动

```bash
pip install vllm

# 启动 OpenAI 兼容服务
vllm serve Qwen/Qwen2.5-7B-Instruct-AWQ \
  --quantization awq \
  --gpu-memory-utilization 0.9 \
  --max-model-len 8192 \
  --enable-prefix-caching \
  --max-num-seqs 128 \
  --port 8000
```

逐参数解读（每个都对应前文原理）：

| 参数 | 调的是什么 | 原理依据 |
|------|-----------|---------|
| `--quantization awq` | INT4 权重 | 量化章节 |
| `--gpu-memory-utilization 0.9` | 允许 vLLM 吃掉 90% 显存做 KV Cache 池 | PagedAttention 显存预算 |
| `--max-model-len 8192` | 最长序列，决定 KV Cache 上限 | KV Cache 公式 |
| `--enable-prefix-caching` | 前缀级 KV 复用 | KV Cache 章节 |
| `--max-num-seqs 128` | 最大并发序列数 | Continuous Batching 槽位 |

### 客户端无缝切换

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")

resp = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct-AWQ",
    messages=[{"role": "user", "content": "用一句话解释 KV Cache"}],
    extra_body={"enable_prefix_caching": True},
)
print(resp.choices[0].message.content)
```

代码从 OpenAI 迁移只需改 `base_url`——这是 vLLM 生态统治力的重要来源。

### 基准测试

```bash
# vLLM 自带吞吐测试
python -m vllm.entrypoints.entrypoints.openai.api_server_benchmark \
  --backend vllm --model Qwen/Qwen2.5-7B-Instruct-AWQ \
  --num-prompts 200 --request-rate 10
```

关注四个指标：

- **TTFT P50/P99**：首 token 延迟（P99 才是 SLA 的真相）
- **TPOT**：每 token 延迟（打字速度）
- **Throughput (tokens/s)**：整机吞吐
- **Goodput**：满足延迟 SLO 的有效吞吐——比裸吞吐更接近商业价值

### 调优心法

```
延迟差（P99 TTFT 高）？
  → 检查是否长 prompt 堵塞（启用 chunked prefill）
  → 降低 max-num-seqs 减少排队深度
吞吐差（tokens/s 低）？
  → 提高 gpu-memory-utilization（更大 KV 池 → 更高并发）
  → 确认 batch 已被打满（看 vLLM 日志 running/pending 比例）
显存 OOM？
  → 降 max-model-len、上量化、或 GQA 模型
```

---

## 自部署 vs API：最后的决策框架

```
日均 token < 1000 万？
  → 无脑 API。运维一台推理集群的人力成本远超差价
日均 1000 万 ~ 1 亿，且负载平稳？
  → 算账：API 单价 × 量 vs (GPU 月租 + 运维)。7B/14B 级模型通常自部署胜出
有合规要求 / 数据不能出境？
  → 自部署，没得选
峰值波动极大（10 倍以上）？
  → API 弹性占优；或混合：基线自部署 + 峰值溢出到 API（呼应 Model Routing 文章）
需要微调模型 / 极致控制解码行为？
  → 自部署
```

一个粗略的成本锚点（2026 年行情）：7B AWQ 量化模型在单张 A10（约 ¥3000/月）上以 vLLM 服务，吞吐可达 3000+ tokens/s——月产 25 亿 token 时，单 token 成本约 API 价格的 1/10。但别忘了：这还没算你的运维时间和故障凌晨告警。

---

## 十大常见坑

1. **显存只算了权重**：忘了 KV Cache，7B 模型 8K 上下文 × 并发 32 光缓存就要 8GB+
2. **`transformers` 直接上生产**：没有 batching 的裸推理，GPU 利用率不到 5%
3. **P99 迷信平均值**：TTFT 平均 200ms / P99 3s，用户记住的是后者
4. **量化后不跑评估**：INT4 对数学任务的损伤可能 8%，直接上线等于埋雷
5. **prefix caching 没对齐 prompt 结构**：变量放在了 prompt 头部，缓存永远 miss（稳定前缀必须在最前面）
6. **max-model-len 拉满**： KV 池被长序列预留挤压，并发反而下降
7. **忽视 Prefill 计算成本**：长 prompt 的 FLOPs 是平方级，"多给上下文"不是免费的（呼应 Context Engineering）
8. **投机解码用在不契合的领域**：起草模型与大模型分布差异大时，加速比可能 < 1（负优化）
9. **单卡信仰**：70B 级模型必须张量并行，`tensor-parallel-size` 跨卡通信延迟要纳入 TTFT 预算
10. **只测裸吞吐不看 Goodput**：压测无延迟约束，上线被 SLO 打脸

---

## 总结

这篇文章沿着"GPU 到底在忙什么"把推理优化串成了一条线：

```
两阶段本质（Prefill 算力密集 / Decode 带宽密集）
    ↓
KV Cache（砍掉重复计算，代价是显存）
    ↓
MQA/GQA（砍缓存） + PagedAttention（消灭碎片，顺手实现 prefix 共享）
    ↓
Continuous Batching（步级调度，消灭槽位空转）
    ↓
投机解码（一次前向多 token） + 量化（砍带宽与显存）
    ↓
vLLM：以上全部的工程集大成者
```

至此，博客的 LLM 基础层补上了最后一块：Tokenizer（模型怎么读）→ Embeddings（模型怎么理解）→ GraphRAG（怎么检索推理）→ Reranker（怎么精排）→ **推理优化（模型怎么跑起来）**。从应用层调用到底层部署，整条知识链路闭环。

记住最核心的一句话：**Decode 是带宽问题，Prefill 是算力问题，一切推理优化都是在这两个约束下做工程取舍。**

---

*本文由小虾子 🦐 撰写*
