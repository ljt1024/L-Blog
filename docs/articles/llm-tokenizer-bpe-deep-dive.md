# Tokenizer 深度解析：LLM 如何读懂文字，从 BPE 原理到成本优化实战

> 你有没有算过一笔账：同样一句话，中文比英文多花 1.5~2 倍的 token？为什么 "strawberry" 里有几个 r 这种问题 LLM 会翻车？为什么上下文窗口标称 128K，实际可用只有 100K 出头？这一切的答案都藏在 **Tokenizer（分词器）** 里——LLM 眼中根本没有"字"，只有 token。理解分词器，你才能真正理解模型的能力边界、成本结构和上下文管理。本文从 Byte-Pair Encoding 算法原理讲到 tiktoken 实战，覆盖中文分词劣势、词汇表设计、token 计数、成本优化，以及那些由分词引发的经典 LLM 翻车现场。

## 一、Token：LLM 世界的原子单位

### 1.1 文字如何进入模型

LLM 无法直接处理字符串。输入的第一站是分词器：把文本切成 token 序列，再映射为词汇表中的整数 ID：

```
"我爱机器学习"
    │ Tokenizer (BPE)
    ▼
["我", "爱", "机器", "学习"]           ← token 序列
    │ 词表查找
    ▼
[3704, 8721, 24566, 44063]           ← 整数 ID 序列
    │ Embedding 查表
    ▼
[[0.12, -0.5, ...], ...]             ← 每个token一个向量（进入Transformer）
```

**关键认知：模型的一切能力边界都以 token 为单位——**

- 上下文窗口：128K = 128,000 个 token（不是字符）
- 计费：按输入 token + 输出 token 收费
- 生成速度：tokens/s（流式输出的"字数"）
- 位置编码：每个 token 一个位置

### 1.2 为什么不直接用字符或单词？

```
方案A：字符级（char-level）
"我爱机器学习" → 6 个 token
✅ 词表极小（几千），无 OOV 问题
❌ 序列太长（一篇英文文章 = 数万 token），注意力计算 O(n²) 爆炸
❌ 单个字符缺乏语义，模型要学"从字符拼出词"这一层

方案B：单词级（word-level）
"我爱机器学习" → 分词后 4 个 token
✅ 每个 token 语义完整
❌ 词表爆炸（英文常用词 + 专有名词 + 错拼 > 100万），Embedding 矩阵存不下
❌ 任何新词（人名、新术语）都是 OOV（未登录词）

方案C：子词级（subword）—— BPE / WordPiece / Unigram ✅
"我爱机器学习" → ["我", "爱", "机器", "学习"] 4 个 token
✅ 高频词完整保留（"学习"= 1 token），低频词拆成子词（"GraphRAG" → 多个片段）
✅ 词表可控（3万~25万），永不 OOV（最差拆到字节）
```

**子词是长度与词表大小的黄金平衡点，是现代 LLM 的统一选择。**

## 二、BPE：Byte-Pair Encoding 算法

### 2.1 训练过程：从字节到子词

BPE 的核心思想：**从字符（字节）开始，反复合并语料中最频繁的相邻对，直到词表达到目标大小。**

```python
from collections import Counter

def train_bpe(corpus: list[str], vocab_size: int) -> dict[tuple, tuple]:
    """
    简化版 BPE 训练（字符级演示，真实实现是字节级）
    corpus 已预先切分为"词 + 词频"
    """
    # 初始化：每个词拆成字符序列
    # lower() 演示用；真实 BPE 会加词尾标记 </w>
    word_freqs = Counter(corpus)
    splits = {
        tuple(word): freq for word, freq in word_freqs.items()
    }

    merges = {}  # 记录合并规则：pair -> 合并后的新token
    vocab = set(ch for word in splits for ch in word)

    while len(vocab) < vocab_size:
        # Step 1: 统计所有相邻字符对的频率（按词频加权）
        pair_freqs = Counter()
        for word, freq in splits.items():
            for i in range(len(word) - 1):
                pair_freqs[(word[i], word[i + 1])] += freq

        if not pair_freqs:
            break

        # Step 2: 取最高频对，合并成新 token
        best = pair_freqs.most_common(1)[0][0]
        new_token = best[0] + best[1]
        merges[best] = new_token
        vocab.add(new_token)

        # Step 3: 在所有词中应用这次合并
        new_splits = {}
        for word, freq in splits.items():
            new_splits[merge_word(word, best)] = freq
        splits = new_splits

    return merges

def merge_word(word: tuple, pair: tuple) -> tuple:
    """把词中的相邻对替换为合并后的单 token"""
    result, i = [], 0
    while i < len(word):
        if i < len(word) - 1 and (word[i], word[i+1]) == pair:
            result.append(word[i] + word[i+1])
            i += 2
        else:
            result.append(word[i])
            i += 1
    return tuple(result)

# 演示：小语料上 BPE 如何发现"机器学习"
corpus = ["机器学习", "机器", "学习", "机器学习", "深度学习",
          "学习", "机器", "机器学习", "学习机", "机器学习"]
# 轮次1: ("学","习") 频率最高 → 合并出 "学习"
# 轮次2: ("机","器") 高频 → 合并出 "机器"
# 轮次3: ("机器","学习") 高频 → 合并出 "机器学习"（整个词变 1 个 token！）
```

**BPE 的经济学本质：高频组合升格为独立 token（省序列长度），低频组合保持拆分状态（省词表空间）。**

### 2.2 编码过程：应用合并规则

```python
def bpe_encode(text: str, merges: dict) -> list[str]:
    """推理时编码：按训练时的合并顺序应用规则"""
    tokens = list(text)  # 先拆成字符
    while True:
        # 找当前序列中"优先级最高"（最早学到）的相邻对
        best_pair, best_rank = None, float("inf")
        for i in range(len(tokens) - 1):
            pair = (tokens[i], tokens[i+1])
            if pair in merges and merges_rank[pair] < best_rank:
                best_pair, best_rank = pair, merges_rank[pair]

        if best_pair is None:
            break  # 没有可合并的了，编码完成

        # 应用合并
        tokens = list(merge_word(tuple(tokens), best_pair))
    return tokens

# "机器学习机器人"
# → ["机器学习", "机器", "人"]
# 注意：贪心按规则优先级合并，不是最长匹配
```

### 2.3 字节级 BPE（BBPE）：GPT 系列的选择

GPT-2 之后的主流做法：先按 **UTF-8 字节**切分，再跑 BPE。

```python
# 为什么用字节而不是字符？
"_strawberry 🍓 中文"
# 字符级：遇到 emoji 🍓、生僻字——字符集不统一，词表难控
# 字节级：一切皆字节，天然覆盖全人类文字 + emoji + 代码

"🍓".encode("utf-8")  # b'\xf0\x9f\x8d\x93' → 4 个字节起步

# GPT-4 (cl100k_base) 的真实分词：
# "🦐" → 3 个 token（一个 emoji 三个 token！）
# "你好" → 2 个 token（常用中文词组 1-2 token）
# "	strawberry" → "str"(1) + "aw"(1) + "berry"(1) = 3 个 token
```

**词表构成（cl100k_base，约 100K tokens）：** 英文高频词完整收录（" learning"= 1 token）、常见词根（" token" " ization"）、数字（" 123"）、标点、CJK 常用字词、字节回退（任何未知内容拆到单字节）。

## 三、各家的分词器对比

| 模型系 | 分词器 | 词表大小 | 特点 |
|--------|--------|---------|------|
| GPT-3.5/4 | cl100k_base (tiktoken) | ~100K | BBPE，生态成熟 |
| GPT-4o | o200k_base | ~200K | 更大词表，多语言效率提升 |
| Llama 3 | SentencePiece BPE | 128K | 大词表重点优化多语言 |
| Qwen 2.5 | BBPE | 151K | 中文密度业界领先 |
| Gemma 2 | SentencePiece | 256K | 超大词表 |
| Claude | 定制 BPE | 未公开 | 观测对中文/代码友好 |

```bash
# 用 tiktoken 实测（pip install tiktoken）
```

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")     # GPT-3.5/4
enc2 = tiktoken.get_encoding("o200k_base")     # GPT-4o

text = "机器学习是人工智能的核心分支"

print(enc.encode(text))
# [3704, 8721, 24566, 44063, ...] → 12 个 token

# 中英对比实验（同样语义）：
zh = "我爱机器学习"                    # 6 个 token
en = "I love machine learning"         # 5 个 token
zh2 = "检索增强生成技术正在改变知识管理"   # 15+ 个 token
en2 = "RAG is transforming knowledge management"  # 7 个 token

# 结论：同样信息量，中文 token 数约为英文的 1.5~2.5 倍
# （近年新模型在持续改善，o200k 和 Qwen 对中文压缩率已大幅提升）
```

## 四、分词器引发的经典翻车现场

### 4.1 "strawberry 里有几个 r"—— 为什么数不清

```
"strawberry" 的 cl100k_base 分词：
["str", "aw", "berry"]  ← 3 个 token！

LLM 看到的不是一个字母序列，而是三个"语义块"
模型从未"看见"单独的 r —— 它要靠训练中学到的间接关联来数字母
→ 数错是常态，答对反而靠"背"

同类翻车：
- "单词 XX 的第三个字母是什么" —— 子词边界切断字母位置
- "写一个每行第三个字母大写的文本" —— 同理
- 字符级操作（倒序、逐字符变换）都是 token 结构的受害者
```

### 4.2 数字计算为什么烂

```
"1234567" 在 cl100k_base 中：
["123", "45", "67"]  ← 任意切断！

模型看到的是三个不相关的数字块
无法对齐数位 → 大数运算经常出错

对比：Llama 3 专门把数字按 3 位一组切（"1", "234", "567"）
数位对齐 → 算术能力显著提升（这是分词器改变模型能力的著名案例）
```

### 4.3 中文为什么更贵

```
一段 1000 字的中文文档（GPT-4 cl100k）：
≈ 1300~1800 tokens（很多双字词没进词表，拆成单字甚至字节）

同样信息量的英文文档：
≈ 700~900 tokens

→ API 成本直接差 1.5~2 倍
→ 上下文窗口的有效容量：中文约 3~4 万字（128K 窗口）
   英文约 8~10 万词

工程对策：
① 选对中文友好的模型（Qwen/DeepSeek/GPT-4o 的 o200k）
② 长文档走 RAG 摘要，不硬塞上下文
③ 高频场景（如缓存友好）统一文本规范（全半角、简繁体）
```

### 4.4 词边界陷阱：token 不跨空格

```
"hello world" → ["hello", " world"]  ← 空格粘在后一个token上
"hello"       → ["hello"]            ← 无空格版本是另一个token！

推论（写 Prompt 时的隐形坑）：
- 关键词前后加空格与否，会产生不同 token → 检索/分类特征受影响
- 代码缩进、全角空格、制表符都是独立 token → 大量空白 = 大量 token
- "  \$100"（两个空格）比 " \$100" 更贵
```

## 五、Token 计数：工程必备技能

### 5.1 精确计数

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

# 对话的完整 token = 系统提示 + 全部历史消息 + 每条消息的格式开销
# OpenAI 每条消息有固定开销（chat template 也占 token）：
# 每条 message ≈ 4 token 额外开销（role 标记等）

def count_chat_tokens(messages: list[dict], model="gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    total = 0
    for msg in messages:
        total += 4  # 每条消息固定开销
        total += len(enc.encode(msg.get("content", "")))
    total += 2  # 对话模板收尾
    return total
```

### 5.2 无词表时的估算（开源模型场景）

```python
# 没有官方 tokenizer 时的高效估算（误差 ±10%）
def estimate_tokens(text: str) -> int:
    # 经验系数（cl100k_base / 英中混合文本）
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    cjk_chars = len(text) - ascii_chars
    return int(ascii_chars / 3.8 + cjk_chars * 1.05)
    # 英文约 3.8 字符/token；中文约 1.0~1.1 字/token

# 更通用的口径（Anthropic 官方文档口径）：
# 1 token ≈ 3.5~4 个英文字符 ≈ 0.75 个英文单词
# 1 token ≈ 0.5~1.1 个中文字（取决于模型词表）
```

### 5.3 上下文窗口的真实账本

```
模型标称：128K context window

真实可用：
128K
- 对话模板开销           ~10 token/条消息 × N 条
- 系统 Prompt            500~2000
- 工具定义（tools 参数）  500~3000（很多人忽略！）
- 预留给输出             max_tokens（如 4096）
─────────────────────────────
实际可塞的文档：约 120K token ≈ 中文 3.5~4 万字

工程铁律：上下文水位线控制在 70% 以下
- 超过 70% 后，长上下文中的指令遵循显著退化（Lost in the Middle）
- 必须配套：历史裁剪 / 摘要压缩 / 滑动窗口（详见上下文工程）
```

## 六、分词器视角的成本优化实战

### 6.1 案例：一个 RAG 系统的 token 账单优化

```python
# 优化前的 Prompt（每次调用 3200 token）
BAD_PROMPT = """
你是一个专业的企业知识库助手。在回答问题时，你需要遵循以下原则：

第一，准确性原则。你需要确保所有回答都基于提供的参考文档内容，
如果参考文档中没有相关信息，你应该明确告知用户你无法回答这个问题，
而不是编造答案。这是非常重要的，因为编造答案会误导用户。

第二，完整性原则。你需要尽可能完整地回答用户的问题，
包括所有的相关细节和注意事项...

第三，格式规范原则。你的回答应该使用清晰的结构...

（此处省略 2000 token 的原则说明）

参考文档：
{context}

问题：{question}
"""

# 优化后（每次调用 900 token，指令内化 + 精简）
GOOD_PROMPT = """基于<docs>回答。无依据则答"文档中未提及"。
要求：先结论，后细节；引用文档段落编号。

<docs>
{context}
</docs>

问题：{question}"""

# 日均 50 万次调用 × 节省 2300 token × $2.5/1M（gpt-4o-mini输入价）
# = 每月节省约 $86 —— 纯 Prompt 瘦身，零效果损失（A/B 验证通过）
```

### 6.2 分词器感知的文本预处理

```python
class TokenAwareTextProcessor:
    """在入库/入上下文前，从 token 视角清洗文本"""

    def __init__(self, encoder):
        self.enc = encoder

    def token_count(self, text: str) -> int:
        return len(self.enc.encode(text))

    def truncate_to_budget(self, text: str, budget: int) -> str:
        """按 token 预算截断（不是按字符！避免截出半句话还超预算）"""
        tokens = self.enc.encode(text)
        if len(tokens) <= budget:
            return text
        # 先截 token 再解码，天然保证预算
        truncated = self.enc.decode(tokens[:budget])
        return truncated + "…"  # 显式截断标记，让 LLM 知道不完整

    def dedup_chunks_by_tokens(self, chunks: list[str], sim_threshold=0.92):
        """RAG 检索结果按 token 去重（近重复 chunk 是上下文浪费大户）"""
        import numpy as np
        seen_vecs, kept = [], []
        for chunk in chunks:
            vec = np.array(self.enc.encode(chunk)[:64])  # 粗指纹
            if any(cosine(vec, v) > sim_threshold for v in seen_vecs):
                continue
            seen_vecs.append(vec)
            kept.append(chunk)
        return kept

    def strip_whitespace_bloat(self, text: str) -> str:
        """空白膨胀清理：连续空白/缩进在 token 层面很贵"""
        import re
        text = re.sub(r'[ \t]+', ' ', text)        # 连续空格压成单个
        text = re.sub(r'\n{3,}', '\n\n', text)     # 连续空行压缩
        return text
        # 代码/表格场景慎用（缩进有语义）！
```

### 6.3 流式输出速度的 token 真相

```
模型标称 80 tokens/s 输出速度：

英文：80 tokens/s ≈ 60 单词/s ≈ 360 词/分钟（远超人类阅读）
中文：80 tokens/s ≈ 80~90 字/s（中文 1 token≈1 字）

体感差异来源：分词器
- 中文 1 token 通常是 1 个汉字 → 逐字蹦出
- 英文 1 token ≈ 0.75 单词 → 逐词蹦出
→ 同速下中文"看起来"输出得更多（单位信息更低）

优化输出成本的另一个视角：
输出 token 通常比输入贵 3~5 倍（如 gpt-4o：$2.5/M 输入 vs $10/M 输出）
→ 让模型"长话短说"的收益，比压缩输入更大
```

## 七、动手实验：可视化你自己的分词

```python
"""
token_visualizer.py: 直观感受不同模型的分词差异
依赖：pip install tiktoken transformers
"""
import tiktoken

def visualize(text: str, encoding_name: str):
    enc = tiktoken.get_encoding(encoding_name)
    tokens = enc.encode(text)
    # decode 每个token，用竖线分隔展示
    parts = []
    for t in tokens:
        piece = enc.decode([t]).replace("\n", "\\n").replace(" ", "␣")
        parts.append(piece)
    print(f"[{encoding_name}] {len(tokens)} tokens:")
    print(" | ".join(parts))
    print()

samples = [
    "我爱机器学习",
    "strawberry has three r's",
    "💰🦐🎉 emoji 很贵",
    "def hello_world(): print('hi')  # 代码",
    "检索增强生成（RAG）vs GraphRAG：多跳推理",
]

for s in samples:
    visualize(s, "cl100k_base")   # GPT-4
    visualize(s, "o200k_base")    # GPT-4o

# 典型输出（cl100k_base）：
# "我爱机器学习" → 我 | 爱 | 机器 | 学习                    = 4 tokens
# "strawberry..." → str | aw | berry | ...                  = 碎片化
# "💰🦐🎉..." → 💰(3字节乱码拆分) | 🦐 | 🎉 | emoji | ...   = emoji 大户
```

## 八、总结

Tokenizer 是 LLM 与文字世界之间的翻译官，它的切分方式决定了模型的能力边界和你的成本结构。

**核心知识地图：**

| 概念 | 一句话 |
|------|--------|
| Token | LLM 的原子单位，上下文/计费/速度全部以它计量 |
| BPE | 高频对合并：常用词成 token，低频词拆子词，永不 OOV |
| BBPE | 字节级 BPE：天然支持全语言 + emoji + 代码 |
| 子词切分的代价 | 字母计数、大数运算天然翻车（Llama3 数字按 3 位切是解药） |
| 中文税 | 同等信息量，中文 token 是英文的 1.5~2.5 倍（新模型在改善） |
| 词边界 | 空格粘连在下一个 token 上，空白是隐形 token 大户 |
| 上下文真实容量 | 标称 128K − 模板 − 工具定义 − 预留输出 ≈ 实际 120K，水位线 ≤ 70% |

**四条工程铁律：**

1. **计费前先数 token**——用 `tiktoken` 精确计数，别用字符数拍脑袋
2. **输入瘦身 + 输出克制**——输出 token 贵 3~5 倍，"长话短说"收益最大
3. **截断按 token 不按字符**——`encode → 截断 → decode`，天然不超预算
4. **选模型看分词器**——中文场景，Qwen/o200k 的词表能直接省下 30%+ 成本

理解了 token，你就理解了 LLM 世界的度量衡。下一篇当你看到"上下文工程""Prompt 缓存""成本优化"时，一切数字背后都是 token 在流动。

*本文由小虾子 🦐 撰写*
