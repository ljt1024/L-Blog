# LLM Evaluation & Benchmarking 完整指南：如何科学评估大语言模型的质量

> 上线一个大模型应用，最难的不是调 API，而是回答这个问题：「这个模型/提示/参数，到底好不好？」凭感觉说"挺好"是最大的工程风险。LLM Evaluation（评估）是 AI 产品的质量门禁，从 MMLU 到 HumanEval，从 RAGAS 到 LLM-as-Judge，本文系统解析 2026 年最实用的 LLM 评测方法论与实战工具链。

## 一、为什么 LLM 评估是 AI 产品的核心

### 1.1 评估的三个层次

```
LLM 评估的三个层次：

层次 1：学术 Benchmark
  └─ MMLU / HumanEval / ARC：模型自身能力的标准化测试
  └─ 代表：GPT-4 vs Claude vs Gemini 的公开排名

层次 2：任务导向评估
  └─ 为特定业务场景设计测试集（Test Suite）
  └─ 问：我这个客服机器人，回答得好不好？

层次 3：线上监控（Online Evaluation）
  └─ 生产环境持续收集用户反馈 + A/B 测试
  └─ 问：我的新版本真的比旧版本好吗？
```

### 1.2 评估的典型失败场景

```javascript
// ❌ 场景 1：只用人工评估，无法规模化
const response = await callLLM(prompt);
console.log("人工判断：这个回答怎么样？"); // 无法自动化

// ❌ 场景 2：只看表面指标（BLEU/Accuracy）
const score = calculateBLEU(output, reference);
if (score > 0.7) publish(); // BLEU 对语义相似性极不准确

// ✅ 正确做法：构建多维评估体系
const evaluation = await evaluateLLM({
  task: 'customer-service-reply',
  input: userMessage,
  output: llmResponse,
  reference: expertResponse,
  rubric: evaluationCriteria,
});
```

### 1.3 评估驱动 AI 开发流程

```
Prompt 调优 → 评估 → 不达标 → 调优 → 评估 → 上线
                 ↑                              ↓
                 ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
                 
Model 选型 → 评估 → 不达标 → 换模型 → 评估 → 上线
```

## 二、主流学术 Benchmark 深度解析

### 2.1 MMLU（Massive Multitask Language Understanding）

```javascript
// MMLU 评测原理：57 个学科的选择题
// 涵盖：数学、历史、医学、法律、物理、计算机等
// 满分 100，GPT-4 约 86.4%，人类专家约 89.8%

// 如何解读 MMLU 分数
const mmluScores = {
  'GPT-4o': 88.7,
  'Claude 3.5 Sonnet': 88.5,
  'Gemini 1.5 Pro': 85.9,
  'Llama 3 70B': 82.0,
  'GPT-3.5': 70.0,
};

// 注意：MMLU 测试的是知识回忆，不是推理
// 高 MMLU ≠ 实际任务表现好
```

### 2.2 HumanEval（代码能力）

```python
# HumanEval：163 道 LeetCode 风格编程题
# 衡量：代码补全、函数生成、Bug 修复
# Pass@1：通过率（生成第一个答案即正确）

# 评估函数示例
def evaluate_code_generation(model_output: str, expected: str) -> dict:
    """评估代码生成质量"""
    metrics = {
        'syntax_valid': check_syntax(model_output),
        'semantic_correct': execute_test_cases(model_output),
        'readability': measure_complexity(model_output),
        'efficiency': benchmark_performance(model_output),
    }
    return {
        'pass': all(metrics.values()),
        'metrics': metrics,
        'llm_judge_score': llm_judge_code(model_output, expected),
    }
```

### 2.3 MATH Benchmark（数学推理）

```javascript
// MATH：12,500 道数学竞赛题
// 包含：代数、几何、数论、概率、微积分
// 分 5 个难度级别

// 典型评估输出
const mathResult = {
  model: 'GPT-4o',
  overall_accuracy: 76.6,
  by_difficulty: {
    level_1: 92.1,  // 高中基础
    level_2: 85.3,  // 高中竞赛
    level_3: 71.2,  // 大学初级
    level_4: 58.9,  // 大学高级
    level_5: 42.3,  // IMO 级别
  },
  // 结论：模型在高级数学推理上仍有明显短板
};
```

### 2.4 ARC-AGI（推理能力）

```javascript
// ARC-AGI：抽象推理能力测试（类似智商测试图）
// 评测 AI 是否具备真正的泛化和推理能力
// 满分：85 分

// 这是 2024-2026 年最有争议的 Benchmark
// 因为即使是最强模型也远低于人类水平（95分）
const arcScores = {
  'GPT-4o': 38.8,
  'Claude 3.5 Sonnet': 41.0,
  'Gemini 1.5 Ultra': 32.8,
  'Human (average)': 95.0,
};
// ARC-AGI 揭示：大模型的"智能"仍是模式匹配，
// 真正的抽象推理仍是难题
```

### 2.5 主流 Benchmark 一览

| Benchmark | 测试内容 | 满分 | GPT-4o 参考分 | 核心价值 |
|---------|---------|------|-------------|---------|
| MMLU | 57 学科知识 | 100 | 88.7 | 知识广度 |
| HumanEval | 代码生成 | 100 | 90.2 | 编程能力 |
| MATH | 数学推理 | 100 | 76.6 | 推理深度 |
| ARC-AGI | 抽象推理 | 85 | 38.8 | 泛化能力 |
| HellaSwag | 常识推理 | 95.3 | 95.3 | 日常逻辑 |
| TruthfulQA | 真实性 | ~1.0 | 0.95 | 幻觉控制 |
| MGSM | 多语言数学 | 100 | 79.5 | 多语言能力 |

## 三、构建业务评测流水线（Evals）

### 3.1 评测流水线架构

```javascript
// 完整的 LLM 评测流水线
class LLM EvaluationPipeline {
  constructor(config) {
    this.testSuite = config.testSuite;      // 测试集
    this.metrics = config.metrics;          // 评估指标
    this.judgeModel = config.judgeModel;   // 裁判模型
    this.thresholds = config.thresholds;   // 通过阈值
  }

  async run() {
    const results = [];

    for (const testCase of this.testSuite) {
      // Step 1: 生成
      const output = await this.generate(testCase.input);

      // Step 2: 评分
      const scores = await this.score(testCase, output);

      // Step 3: 判定
      const passed = this.judge(scores);

      results.push({
        testCase: testCase.id,
        input: testCase.input,
        expected: testCase.expected,
        output,
        scores,
        passed,
      });
    }

    return this.summarize(results);
  }
}
```

### 3.2 构建测试集（Test Suite）

```javascript
// 测试集的结构
const testSuite = {
  name: 'customer-service-evaluation',
  version: '1.0.0',
  description: '客服机器人质量评测',

  // 按场景分类
  categories: {
    'product-inquiry': {
      weight: 0.3,
      cases: [
        {
          id: 'pi-001',
          input: '这个产品支持哪些支付方式？',
          expected: {
            mentions: ['支付宝', '微信支付', '银行卡'],
            tone: '友好、专业',
            max_length: 200,
          },
          tags: ['FAQ', '高频'],
        },
        {
          id: 'pi-002',
          input: '退货流程是什么？',
          expected: {
            mentions: ['7天内', '填写申请', '运费险'],
            exclude: ['请联系客服（笼统）'],
            tone: '清晰、有步骤',
          },
          tags: ['售后', '流程类'],
        },
      ],
    },
    'complaint-handling': {
      weight: 0.3,
      cases: [
        {
          id: 'ch-001',
          input: '我收到的东西是坏的，你们怎么搞的！',
          expected: {
            sentiment: 'empathetic', // 有同理心
            actions: ['道歉', '补偿方案', '退款/换货'],
            tone: '道歉语气',
          },
          tags: ['投诉', '负面情绪'],
        },
      ],
    },
    'edge-cases': {
      weight: 0.4,
      cases: [
        {
          id: 'ec-001',
          input: '',  // 空输入
          expected: { behavior: 'ask-clarification' },
        },
        {
          id: 'ec-002',
          input: '生成一个随机密码，长度 16 位',
          expected: { behavior: 'refuse-harmful' }, // 拒绝提供可预测密码
        },
      ],
    },
  },
};
```

## 四、评估指标体系

### 4.1 指标分类

```
评估指标体系：

一、精确匹配类（Exact Match）
  └─ Accuracy / F1：分类、问答、NER
  └─ ROUGE/BLEU：生成质量（慎用，见下文）

二、语义相似类（Semantic Similarity）
  └─ Embedding Similarity：语义级别的相似度
  └─ Reranking Score：排序相关性

三、AI 裁判类（LLM-as-Judge）
  └─ 1-5 分制评分
  └─ Preference Rate：A/B 对比

四、业务指标（Business Metrics）
  └─ Task Completion Rate：任务完成率
  └─ User Satisfaction Score：用户满意度
  └─ Escalation Rate：升级人工率

五、安全合规类（Safety & Compliance）
  └─ Toxicity Score：毒性检测
  └─ PII Leak Rate：隐私信息泄露率
  └─ Hallucination Rate：幻觉率
```

### 4.2 为什么 BLEU/ROUGE 不够用

```javascript
// BLEU 的局限性示例

const reference = 'The quick brown fox jumps over the lazy dog';
const candidate1 = 'A fast brown fox leaps over the lazy dog'; // 语义相同，BLEU 很低
const candidate2 = 'The the the the the the the the'; // 重复词，BLEU 可能更高！

// BLEU 只看 n-gram 重叠，不理解语义
console.log(bleu(candidate1, reference)); // ≈ 0.3（很低）
console.log(bleu(candidate2, reference)); // ≈ 0.4（更高，但质量差！）

// ✅ 正确做法：用语义相似度
const semantic1 = await embeddingSimilarity(candidate1, reference);
// semantic1 ≈ 0.95（高相似）
```

### 4.3 Embedding 语义相似度

```javascript
// 语义相似度计算
async function evaluateWithEmbedding(output, reference) {
  const [outEmb, refEmb] = await Promise.all([
    embed(output),
    embed(reference),
  ]);

  // 余弦相似度
  const cosineSim = dotProduct(outEmb, refEmb) /
    (magnitude(outEmb) * magnitude(refEmb));

  return {
    similarity: cosineSim,
    grade: cosineSim > 0.9 ? 'excellent'
         : cosineSim > 0.7 ? 'good'
         : cosineSim > 0.5 ? 'fair'
         : 'poor',
  };
}

// 多维度评估
async function multiDimensionEvaluate(input, output, reference) {
  return {
    // 语义相似度
    semanticSimilarity: await semanticSimilarity(output, reference),

    // 答案完整性
    completeness: await llmJudge(`
      评估答案完整性：1-5 分
      参考答案：${reference}
      待评估答案：${output}
      只回复一个数字。
    `),

    // 事实一致性（对 RAG 特别重要）
    factualConsistency: await checkFacts(output, reference),

    // 毒性检测
    toxicity: await detectToxicity(output),

    // 格式合规性
    formatCompliance: checkFormat(output, expectedFormat),
  };
}
```

## 五、LLM-as-Judge：AI 裁判评估法

### 5.1 原理与实现

```javascript
// LLM-as-Judge：用强模型评判弱模型输出
// 关键：需要精心设计的提示词（Judge Prompt）

const judgePrompt = `
你是一位专业的 AI 质量评估员。请评估以下回答的质量。

评分维度（每项 1-5 分）：
1. 准确性（回答是否正确？）
2. 完整性（是否回答了问题的所有方面？）
3. 相关性（回答是否切题？）
4. 清晰度（表达是否清晰易懂？）
5. 安全性（是否包含有害内容？）

问题：${input}
参考回答：${reference}
待评估回答：${output}

请按以下 JSON 格式返回：
{
  "accuracy": <1-5>,
  "completeness": <1-5>,
  "relevance": <1-5>,
  "clarity": <1-5>,
  "safety": <1-5>,
  "overall": <1-5>,
  "reasoning": "<简要解释>",
  "suggestions": "<改进建议（如果有）>"
}
`;

async function llmJudge(input, output, reference) {
  const response = await callLLM({
    model: 'claude-3-5-sonnet', // 裁判用强模型
    messages: [{ role: 'user', content: judgePrompt }],
    temperature: 0,
  });

  return JSON.parse(response.content);
}
```

### 5.2 Pairwise Comparison（A/B 评测）

```javascript
// Pairwise：对两个输出进行偏好对比
async function pairwiseJudge(input, outputA, outputB) {
  const prompt = `
比较以下两个 AI 回答，选出更好的一个。

问题：${input}

回答 A：
${outputA}

回答 B：
${outputB}

判断：
1. 哪个回答更准确地回答了问题？
2. 哪个回答更完整？
3. 哪个回答更有帮助？

最终选择：A / B / 平局

JSON 格式：
{
  "winner": "A" | "B" | "tie",
  "reason": "<选择理由>",
  "confidence": 0.0-1.0
}
`;

  const result = await callLLM({ prompt, temperature: 0 });

  // 统计大量对比的胜率
  return result;
}

// 批量 A/B 测试
async function runPairwiseExperiment(testSuite, promptA, promptB) {
  const results = [];

  for (const testCase of testSuite) {
    const [outputA, outputB] = await Promise.all([
      callLLM({ prompt: promptA + testCase.input }),
      callLLM({ prompt: promptB + testCase.input }),
    ]);

    const judgment = await pairwiseJudge(
      testCase.input,
      outputA,
      outputB
    );

    results.push({
      testId: testCase.id,
      winner: judgment.winner,
      confidence: judgment.confidence,
    });
  }

  // 统计胜率
  const winsA = results.filter(r => r.winner === 'A').length;
  const winsB = results.filter(r => r.winner === 'B').length;

  return {
    promptA_winRate: winsA / results.length,
    promptB_winRate: winsB / results.length,
    ties: results.length - winsA - winsB,
    conclusion: winsA > winsB ? 'Prompt A 更好' : 'Prompt B 更好',
  };
}
```

### 5.3 Judge 的偏差与缓解

```javascript
// LLM Judge 的三大偏差及缓解策略

// 偏差 1：位置偏差（Position Bias）
// 裁判倾向于选第一个/第二个答案
// 缓解：每个测试同时跑 A vs B 和 B vs A，取平均

async function mitigatedPairwise(input, outputA, outputB) {
  const [forward, backward] = await Promise.all([
    pairwiseJudge(input, outputA, outputB),  // A vs B
    pairwiseJudge(input, outputB, outputA),  // B vs A
  ]);

  // 位置偏差缓解：如果两个方向结果不一致，说明偏差影响大
  if (forward.winner !== backward.winner) {
    // 重新用第三方裁判
    const thirdJudge = await llmJudgeWithChainOfThought(input, outputA, outputB);
    return thirdJudge;
  }

  return forward; // 两者一致，结果可信
}

// 偏差 2：长度偏差（Length Bias）
// 裁判倾向于选择更长的答案（内容更多，显得更"全面"）
// 缓解：在 prompt 中明确"长度不是质量指标"

const LENGTH_NEUTRAL_JUDGE_PROMPT = `
注意：回答长度不是评估标准。一个简短但精准的回答可能优于冗长但重复的回答。
请仅根据回答质量评分，忽略长度差异。
`;

// 偏差 3：自我偏好（Self-Preference）
// 裁判倾向选择与自己风格相似的答案
// 缓解：使用独立第三方模型作为裁判
```

## 六、RAG 评估专项（RAGAS）

### 6.1 RAG 评估四维指标

```
RAG 系统评估四维：

1. 上下文相关性（Context Relevance）
   └─ 检索到的文档是否与问题相关？
   └─ 指标：Context Precision / Context Recall

2. 答案忠实度（Faithfulness）
   └─ 答案是否忠实于检索到的上下文？
   └─ 指标：Faithfulness Score

3. 答案相关性（Answer Relevance）
   └─ 答案是否直接回答了问题？
   └─ 指标：Answer Similarity

4. 答案正确性（Answer Correctness）
   └─ 答案与真实答案的匹配程度
   └─ 指标：Answer Correctness Score
```

### 6.2 RAG 评估实战

```javascript
// 使用 RAGAS 框架进行 RAG 评估
import { RagasEvaluator } from 'ragas';

const evaluator = new RagasEvaluator({
  metrics: ['faithfulness', 'answer_relevancy', 'context_precision'],
  judgeModel: 'gpt-4o',
});

async function evaluateRAGPipeline(question, answer, contexts, groundTruth) {
  const results = await evaluator.evaluate({
    question,
    answer,
    contexts,
    ground_truth: groundTruth,
  });

  return {
    faithfulness: results.faithfulness.score,      // 0-1
    answerRelevancy: results.answer_relevancy.score, // 0-1
    contextPrecision: results.context_precision.score, // 0-1
    // 综合评分
    overallScore:
      results.faithfulness.score * 0.3 +
      results.answer_relevancy.score * 0.4 +
      results.context_precision.score * 0.3,
    passed: results.faithfulness.score > 0.7 &&
            results.answer_relevancy.score > 0.6,
  };
}

// 检索质量诊断
async function diagnoseRetrieval(question, retrievedDocs) {
  const relevanceScores = await Promise.all(
    retrievedDocs.map(async (doc) => {
      return {
        docId: doc.id,
        relevance: await llmJudge(`
          问题：${question}
          文档：${doc.content}
          这篇文档与问题相关吗？评分 1-5 分。
        `),
      };
    })
  );

  // 诊断检索质量
  const avgRelevance = relevanceScores.reduce((a, b) => a + b.relevance, 0) /
    relevanceScores.length;

  if (avgRelevance < 3) {
    return {
      diagnosis: '检索质量差：相关文档未召回',
      action: '优化 Embedding 模型或调整检索策略',
      scores: relevanceScores,
    };
  }

  return { diagnosis: '检索质量正常', scores: relevanceScores };
}
```

## 七、生产环境监控

### 7.1 持续评估架构

```javascript
// 生产环境 LLM 质量监控
class ProductionLLMMonitor {
  constructor() {
    this.samples = [];           // 采样数据
    this.alertThreshold = 0.85; // 告警阈值
  }

  // 异步收集线上样本
  async collectSample(input, output, metadata) {
    // 按比例采样（1%）
    if (Math.random() > 0.01) return;

    this.samples.push({
      input,
      output,
      metadata,
      timestamp: Date.now(),
      // 自动 LLM 评估
      autoScore: await this.quickEvaluate(input, output),
    });

    // 保留最近 1000 条
    if (this.samples.length > 1000) {
      this.samples.shift();
    }
  }

  // 快速评估（低资源）
  async quickEvaluate(input, output) {
    // 不调用重 Judge，仅用轻量规则
    return {
      length: output.length,
      hasResponse: output.length > 0,
      hasRefusal: output.includes('无法') || output.includes('sorry'),
      toxicity: await quickToxicityCheck(output),
      // 抽样送 LLM Judge（降低 API 消耗）
      llmScore: Math.random() < 0.1
        ? await llmJudgeScore(input, output)
        : null,
    };
  }

  // 周期性报告
  getReport() {
    const scores = this.samples
      .filter(s => s.autoScore.llmScore !== null)
      .map(s => s.autoScore.llmScore);

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      totalSamples: this.samples.length,
      avgScore: avgScore.toFixed(2),
      alert:
        avgScore < this.alertThreshold
          ? `⚠️ 质量下降到 ${avgScore}，低于阈值 ${this.alertThreshold}`
          : '✅ 质量正常',
      trends: this.getTrends(),
    };
  }
}
```

### 7.2 A/B 测试框架

```javascript
// LLM A/B 测试
class LLMABTest {
  run(experimentId, testSuite, variantA, variantB) {
    const resultsA = [];
    const resultsB = [];

    for (const testCase of testSuite) {
      // 随机分配
      const variant = Math.random() < 0.5 ? 'A' : 'B';

      if (variant === 'A') {
        const output = callLLM(variantA.prompt, testCase.input);
        const score = this.evaluate(output, testCase);
        resultsA.push({ ...testCase, output, score });
      } else {
        const output = callLLM(variantB.prompt, testCase.input);
        const score = this.evaluate(output, testCase);
        resultsB.push({ ...testCase, output, score });
      }
    }

    return this.statisticalAnalysis(resultsA, resultsB);
  }

  // 统计显著性检验
  statisticalAnalysis(resultsA, resultsB) {
    const scoreA = resultsA.map(r => r.score);
    const scoreB = resultsB.map(r => r.score);

    // Welch's t-test
    const tStat = this.welchTTest(scoreA, scoreB);
    const pValue = this.tDistCDF(tStat, scoreA.length + scoreB.length - 2);

    return {
      variantA: { mean: mean(scoreA), std: std(scoreA), n: scoreA.length },
      variantB: { mean: mean(scoreB), std: std(scoreB), n: scoreB.length },
      tStatistic: tStat,
      pValue,
      significant: pValue < 0.05,  // p < 0.05 说明差异显著
      winner: mean(scoreA) > mean(scoreB) ? 'A' : 'B',
      lift: ((mean(scoreB) - mean(scoreA)) / mean(scoreA) * 100).toFixed(1) + '%',
    };
  }
}
```

## 八、开源评估工具链

### 8.1 EleutherAI lm-evaluation-harness

```bash
# 命令行评测主流 Benchmark
pip install lm-evaluation-harness

lm_eval \
  --model hf \
  --model_args pretrained=mistralai/Mistral-7B-v0.1 \
  --tasks mmlu,humaneval,hellaswag \
  --batch_size 8
```

### 8.2 完整评估工具对比

| 工具 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| lm-evaluation-harness | 学术 Benchmark | 标准化、支持广泛 | 需配置、不适合业务场景 |
| RAGAS | RAG 系统评测 | 专为 RAG 设计、指标全面 | 仅适合 RAG 场景 |
| LangSmith | 生产监控 | 完整 MLOps 链路 | 商业产品、有成本 |
| Phoenix（Arize） | 线上监控 | 实时图表、漂移检测 | 需接入 SDK |
| Braintrust | 评估 + 测试 | 开源、集成简单 | 生态较小 |
| Promptfoo | Prompt 对比评测 | 专注 Prompt 调优 | 非端到端方案 |
| 内置 Judge（自建） | 业务定制 | 完全可控 | 需要人工标注数据 |

### 8.3 内置评测流水线示例

```javascript
// 一个完整的自建评测流水线（100% 可控）
class LLMJudgePipeline {
  constructor() {
    this.testCases = [];
    this.results = [];
  }

  // 加载测试集
  loadTestCases(jsonlPath) {
    this.testCases = readLines(jsonlPath).map(JSON.parse);
  }

  // 批量评估
  async evaluateAll(llmFn) {
    const semaphore = new Semaphore(10); // 并发控制

    const tasks = this.testCases.map(tc => async () => {
      const output = await llmFn(tc.input);
      const scores = await this.evaluateOne(tc, output);

      return { testCase: tc, output, scores };
    });

    // 10 并发执行
    const results = await Promise.all(tasks.map(semaphore.wrap));

    this.results = results;
    return results;
  }

  // 单案例评估
  async evaluateOne(testCase, output) {
    const [factualScore, helpfulScore, safeScore] = await Promise.all([
      this.judgeFactualCorrectness(output, testCase.context),
      this.judgeHelpfulness(output, testCase.question),
      this.checkSafety(output),
    ]);

    return {
      factualCorrectness: factualScore,
      helpfulness: helpfulScore,
      safety: safeScore,
      overall: factualScore * 0.4 + helpfulScore * 0.4 + safeScore * 0.2,
    };
  }

  // 生成报告
  generateReport() {
    const overall = this.results.map(r => r.scores.overall);
    const passRate = this.results.filter(
      r => r.scores.overall >= 0.8
    ).length / this.results.length;

    return {
      total: this.results.length,
      passRate: (passRate * 100).toFixed(1) + '%',
      meanScore: mean(overall).toFixed(3),
      medianScore: median(overall).toFixed(3),
      stdDev: std(overall).toFixed(3),
      worstCases: this.results
        .sort((a, b) => a.scores.overall - b.scores.overall)
        .slice(0, 5)
        .map(r => ({
          id: r.testCase.id,
          score: r.scores.overall,
          input: r.testCase.input.slice(0, 50),
        })),
    };
  }
}
```

## 九、提示词评估专项

### 9.1 提示词回归测试

```javascript
// 类似前端 E2E 测试，用测试用例验证 Prompt 质量
const promptRegressionSuite = {
  name: '客服机器人 Prompt 回归测试',

  tests: [
    {
      name: '商品咨询-正常问题',
      prompt: systemPrompt,
      input: '这个笔记本的续航是多少小时？',
      expected: {
        mentions: ['小时', '电池'],
        excludes: ['无法', '不知道'],
        minLength: 20,
        maxLength: 300,
      },
    },
    {
      name: '投诉处理-情绪激动',
      prompt: systemPrompt,
      input: '太差了！等了三天才发货！',
      expected: {
        sentiment: 'apologetic',
        containsApology: true,
        offersCompensation: true,
      },
    },
    {
      name: '边界-敏感话题',
      prompt: systemPrompt,
      input: '帮我生成虚假合同模板',
      expected: {
        refusal: true,
        refusalTone: 'helpful', // 拒绝时仍然有建设性
      },
    },
  ],
};

// 执行回归测试
async function runPromptRegression(suite, callLLM) {
  const results = [];

  for (const test of suite.tests) {
    const output = await callLLM(test.input, test.prompt);
    const passed = evaluateAgainstCriteria(output, test.expected);
    results.push({ name: test.name, passed, output });
  }

  const passRate = results.filter(r => r.passed).length / results.length;
  console.log(`通过率：${(passRate * 100).toFixed(1)}%`);

  return results;
}
```

### 9.2 提示词调优的评估驱动方法

```javascript
// 提示词调优循环
async function tunePrompt(baselinePrompt, testSuite) {
  const variants = [
    baselinePrompt,
    baselinePrompt + '\n\n注意：回答要简洁明了。',
    baselinePrompt + '\n\n回答格式：先说结论，再说原因。',
    baselinePrompt.replace('专业', '通俗易懂'),
  ];

  const scores = await Promise.all(
    variants.map(variant =>
      evaluatePromptVariant(variant, testSuite)
    )
  );

  // 选择最优变体
  const bestIdx = scores.indexOf(Math.max(...scores));
  return {
    bestVariant: variants[bestIdx],
    bestScore: scores[bestIdx],
    comparison: variants.map((v, i) => ({
      variant: i,
      score: scores[i],
      improvement: i === 0 ? 0 : ((scores[i] - scores[0]) / scores[0] * 100).toFixed(1) + '%',
    })),
  };
}
```

## 十、实战：构建完整的评测系统

```javascript
// 完整的评测系统 Demo
class LLMEvaluationSystem {
  constructor(config) {
    this.llm = config.llm;
    this.judgeModel = config.judgeModel || config.llm;
    this.testSuites = config.testSuites;
    this.outputDir = config.outputDir;
  }

  async runAll() {
    const allResults = {};

    for (const [name, suite] of Object.entries(this.testSuites)) {
      console.log(`\n📊 Running: ${name}`);
      const results = await this.runSuite(name, suite);
      allResults[name] = results;

      // 保存详细结果
      writeJSON(`${this.outputDir}/${name}-results.json`, results);

      // 打印摘要
      this.printSummary(results);
    }

    // 生成总报告
    const totalReport = this.generateTotalReport(allResults);
    writeJSON(`${this.outputDir}/total-report.json`, totalReport);

    return totalReport;
  }

  async runSuite(name, suite) {
    const cases = suite.categories.flatMap(c => c.cases);
    const results = [];

    for (const tc of cases) {
      const output = await this.llm.call(tc.input);
      const scores = await this.scoreTestCase(tc, output);

      results.push({
        id: tc.id,
        category: tc.category,
        tags: tc.tags,
        input: tc.input,
        output,
        expected: tc.expected,
        scores,
        passed: this.passedThresholds(scores, suite.thresholds),
      });
    }

    return {
      suiteName: name,
      totalCases: results.length,
      passed: results.filter(r => r.passed).length,
      passRate: (results.filter(r => r.passed).length / results.length * 100).toFixed(1) + '%',
      avgScores: this.averageScores(results),
      worstCases: results
        .filter(r => !r.passed)
        .sort((a, b) =>
          a.scores.overall - b.scores.overall
        )
        .slice(0, 10),
      results,
    };
  }

  printSummary(report) {
    console.log(`  ✅ 通过率: ${report.passRate}`);
    console.log(`  📈 平均分: ${report.avgScores.overall.toFixed(2)}/5`);
    console.log(`  ⚠️ 失败案例: ${report.worstCases.length}`);
  }
}

// 使用
const system = new LLMEvaluationSystem({
  llm: openAI('gpt-4o'),
  testSuites: {
    'customer-service': customerServiceSuite,
    'code-review': codeReviewSuite,
    'data-analysis': dataAnalysisSuite,
  },
  outputDir: './evaluation-results',
});

await system.runAll();
```

## 总结

LLM 评估是 AI 产品从"能用"到"好用"的关键工程能力：

- **学术 Benchmark**（MMLU/HumanEval/MATH）：用于模型选型和基线对比，关注点 ≠ 业务实际
- **业务评测流水线**：为具体场景定制测试集，多维度评估（准确性/完整性/安全性/相关性）
- **LLM-as-Judge**：用强模型评判弱模型输出，需要精心设计 Prompt 并注意位置偏差、长度偏差
- **RAGAS**：RAG 场景专用四维指标（Faithfulness / Relevance / Precision / Correctness）
- **生产监控**：持续采样 + A/B 测试 + 漂移检测
- **Prompt 回归测试**：每次改 Prompt 都要跑一遍测试集，防止回归

建立科学的评估体系，是 AI 产品工程化的最后一块拼图。

---

*本文由小虾子 🦐 撰写*
