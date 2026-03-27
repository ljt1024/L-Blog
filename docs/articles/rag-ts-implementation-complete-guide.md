# 手把手实现企业级 RAG 系统：分片 → 向量化 → 召回 → 重排 → 回答

> 发布时间：2026-03-25

RAG（检索增强生成）是目前落地最成熟的 AI 应用架构。本文用 TypeScript 从零实现一套完整的 RAG 系统，涵盖：**文档解析 → 文本分片 → 向量化 → 存入向量数据库 → 语义召回 → 重排 → 接入大模型回答**。代码可直接拷贝到项目中使用。

## RAG 完整流程

```
用户提问
    ↓
  召回阶段
    ↓ 语义检索（向量相似度）
    ↓ 从向量数据库取出 Top-K 片段
    ↓ 重排（Reranker）提升相关度
    ↓ 注入 Prompt
    ↓ LLM 生成回答
    ↓
最终答案
```

---

## 技术栈选型

```json
// package.json 核心依赖
{
  "dependencies": {
    "langchain": "^0.3.0",
    "@langchain/community": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@xenova/transformers": "^2.17.0",
    "cohere-sdk": "^5.4.0",
    "typesense": "^1.7.0"
  }
}
```

> 说明：向量数据库选 **Typesense**（轻量、国产友好、支持向量搜索），Embedding 用 **BGE-large-zh**（中文效果最好的开源模型），重排用 **Cohere Rerank**，模型用 **GPT-4o** 或 **DeepSeek`。

---

## 第一步：文档解析与清洗

### 支持多种文档格式

```typescript
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { DocxLoader } from 'langchain/document_loaders/fs/docx'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { CSVLoader } from 'langchain/document_loaders/fs/csv'

type DocFormat = 'pdf' | 'docx' | 'txt' | 'csv' | 'md'

async function loadDocument(filePath: string, format: DocFormat) {
  const loaderMap: Record<DocFormat, any> = {
    pdf: new PDFLoader(filePath),
    docx: new DocxLoader(filePath),
    txt: new TextLoader(filePath),
    csv: new CSVLoader(filePath),
    md: new TextLoader(filePath),
  }

  const loader = loaderMap[format]
  const docs = await loader.load()
  return docs
}
```

### 文本清洗工具

```typescript
function cleanText(text: string): string {
  return text
    // 移除多余空白
    .replace(/\s+/g, ' ')
    // 移除特殊控制字符
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 移除 Markdown 图片语法
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // 移除超链接，保留文字
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // 移除多余换行（保留段落结构）
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

---

## 第二步：智能文本分片

分片策略直接影响检索质量。过小会丢失上下文，过大会引入噪声。

### 基础分片器

```typescript
interface ChunkOptions {
  chunkSize: number       // 每片字符数
  chunkOverlap: number     // 相邻片重叠字符数
  separators?: string[]   // 段落分隔符优先级
}

interface TextChunk {
  content: string
  metadata: {
    source: string
    startIndex: number
    endIndex: number
    chunkIndex: number
  }
}

function splitText(text: string, options: ChunkOptions): TextChunk[] {
  const { chunkSize, chunkOverlap, separators = ['\n\n', '\n', '。', '！', '？', '. '] } = options

  const chunks: TextChunk[] = []
  let startIndex = 0
  let chunkIndex = 0

  while (startIndex < text.length) {
    // 确定当前片段的结束位置
    let endIndex = Math.min(startIndex + chunkSize, text.length)

    // 如果不是文本末尾，尝试在分隔符处断开
    if (endIndex < text.length) {
      for (const sep of separators) {
        const lastSepIndex = text.lastIndexOf(sep, endIndex)
        if (lastSepIndex > startIndex + chunkSize * 0.5) {
          endIndex = lastSepIndex + sep.length
          break
        }
      }
    }

    const chunkText = cleanText(text.slice(startIndex, endIndex))

    if (chunkText.length > 50) { // 过滤掉太短的碎片
      chunks.push({
        content: chunkText,
        metadata: {
          source: '',
          startIndex,
          endIndex,
          chunkIndex,
        },
      })
      chunkIndex++
    }

    // 移动起始位置（带重叠）
    startIndex = endIndex - chunkOverlap
    if (startIndex < 0) startIndex = 0
  }

  return chunks
}
```

### 语义分片（更高级）

按句子边界切分，效果更好：

```typescript
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '。', '！', '？', '，', ' ', ''],
  lengthFunction: (text: string) => text.length,
})

// 返回 LangChain Document 对象
const chunks = await splitter.splitDocuments(rawDocuments)

// 给每个 chunk 添加额外元信息
chunks.forEach((chunk, i) => {
  chunk.metadata = {
    ...chunk.metadata,
    chunkIndex: i,
    documentId: documentId,
  }
})
```

---

## 第三步：向量化（Embedding）

### 方案一：使用 OpenAI Embedding（简单）

```typescript
import { OpenAIEmbeddings } from '@langchain/openai'

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-large', // 或 'text-embedding-3-small'
  dimensions: 1536,
})

// 单条向量化
const vector = await embeddings.embedQuery('这是一个测试问题')
console.log(vector.length) // 1536

// 批量向量化（节省 API 调用）
const texts = ['文本1', '文本2', '文本3']
const vectors = await embeddings.embedDocuments(texts)
```

### 方案二：使用开源 BGE 模型（免费、中文好）

```typescript
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers'

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: 'Xenova/bge-large-zh-v1.5', // 中文最佳 BGE 模型
  model_kwargs: { device: 'cpu' },
  encode_kwargs: { normalizeEmbeddings: true }, // 单位向量，余弦相似度直接比
})

const vector = await embeddings.embedQuery('用户的问题')
console.log(vector.length) // 1024
```

### 批量向量化（生产必备）

```typescript
interface BatchEmbeddingResult {
  vectors: number[][]
  ids: string[]
  failed: string[]
}

async function batchEmbed(
  chunks: TextChunk[],
  batchSize = 100
): Promise<BatchEmbeddingResult> {
  const ids: string[] = []
  const vectors: number[][] = []
  const failed: string[] = []

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const texts = batch.map(c => c.content)

    try {
      const batchVectors = await embeddings.embedDocuments(texts)
      batch.forEach((chunk, j) => {
        ids.push(generateChunkId(chunk.metadata))
        vectors.push(batchVectors[j])
      })
      console.log(`[${i + batch.length}/${chunks.length}] 向量化完成`)
    } catch (err) {
      console.error(`批次 ${i} 失败:`, err)
      failed.push(...batch.map(c => c.content.slice(0, 50)))
    }

    // 避免限速
    await sleep(500)
  }

  return { ids, vectors, failed }
}

function generateChunkId(meta: TextChunk['metadata']): string {
  return `${meta.source}:${meta.chunkIndex}`
}
```

---

## 第四步：存入向量数据库

以 Typesense 为例（支持 Docker 一键部署）：

### Typesense 部署

```bash
# docker-compose.yaml
version: '3'
services:
  typesense:
    image: typesense/typesense:26.0
    ports:
      - '8108:8108'
    volumes:
      - ./typesense-data:/data
    environment:
      - TYPESENSE_DATA_DIR=/data
      - TYPESENSE_API_KEY=your-secret-key
```

### 创建 Collection

```typescript
import { Typesense } from 'typesense'

const typesense = new Typesense({
  nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
  apiKey: 'your-secret-key',
})

async function createCollection() {
  const collection = {
    name: 'knowledge_base',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'content_vector', type: 'float[]', vecDim: 1024 }, // BGE-large
      { name: 'source', type: 'string' },
      { name: 'chunk_index', type: 'int32' },
    ],
    default_sorting_field: 'chunk_index',
  }

  try {
    await typesense.collections.create(collection)
    console.log('Collection 创建成功')
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log('Collection 已存在')
    } else {
      throw e
    }
  }
}
```

### 批量导入数据

```typescript
import { TypesenseVectorStore } from '@langchain/community/vectorstores/typesense'

async function insertToVectorStore(
  chunks: TextChunk[],
  ids: string[],
  vectors: number[][]
) {
  const docs = chunks.map((chunk, i) => ({
    id: ids[i],
    content: chunk.content,
    content_vector: vectors[i],
    source: chunk.metadata.source,
    chunk_index: chunk.metadata.chunkIndex,
  }))

  // LangChain 封装的方式
  const store = await TypesenseVectorStore.fromDocuments(
    docs as any,
    embeddings,
    {
      typesenseClientParams: {
        host: 'localhost',
        port: 8108,
        protocol: 'http',
        apiKey: 'your-secret-key',
      },
      searchParams: {
        q: '',
        query_by: 'content',
        vector_query: 'content_vector: [0, 0, ...]',
      },
    }
  )

  // 或者直接用 Typesense SDK 批量导入
  const importResult = await typesense.collections('knowledge_base')
    .documents()
    .import_(docs, { action: 'upsert' })

  console.log(`导入结果: ${JSON.stringify(importResult)}`)
}
```

---

## 第五步：语义召回

```typescript
async function retrieve(
  query: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  // 1. 将用户问题向量化
  const queryVector = await embeddings.embedQuery(query)

  // 2. Typesense 向量搜索
  const searchResult = await typesense.multiSearch({
    searches: [
      {
        collection: 'knowledge_base',
        q: '*',
        vector_query: `content_vector: [${queryVector.join(',')}]`,
        limit: topK,
        query_by: 'content',
      },
    ],
  })

  // 3. 解析结果
  const hits = searchResult.results[0].hits

  return hits.map((hit: any) => ({
    content: hit.document.content,
    source: hit.document.source,
    score: hit.vector_distance, // Typesense 用的是余弦距离
    chunkIndex: hit.document.chunk_index,
  }))
}

interface RetrievedChunk {
  content: string
  source: string
  score: number
  chunkIndex: number
}
```

### 过滤与增强召回

```typescript
// 按来源过滤
const searchBySource = async (query: string, source: string, topK = 5) => {
  const results = await retrieve(query, topK * 2) // 多召回一些再过滤
  return results.filter(r => r.source === source).slice(0, topK)
}

// 混合召回：向量搜索 + 关键词搜索
const hybridRetrieve = async (query: string, topK = 5) => {
  const [vectorHits, keywordHits] = await Promise.all([
    vectorSearch(query, topK),
    keywordSearch(query, topK), // BM25 关键词搜索
  ])

  // 合并去重，加权打分
  const merged = mergeResults(vectorHits, keywordHits, query)
  return merged.slice(0, topK)
}
```

---

## 第六步：重排（Rerank）

召回的 Top-K 结果可能不是最相关的，用 Reranker 重新排序效果会大幅提升。

### 使用 Cohere Rerank

```typescript
import { CohereRerank } from '@langchain/community/rerankers/cohere'

const reranker = new CohereRerank({
  apiKey: process.env.COHERE_API_KEY!,
  model: 'rerank-multilingual-v3.0',
  topN: 5,
})

async function rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const docs = chunks.map(c => ({ text: c.content }))

  const results = await reranker.rankDocuments(query, docs)

  return results.map(r => ({
    ...chunks[r.index],
    rerankScore: r.relevanceScore,
  }))
}
```

### 轻量级 Rerank（无需 API）

用简单相关性过滤作为降级方案：

```typescript
function lightweightRerank(query: string, chunks: RetrievedChunk[]): RetrievedChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/)

  return chunks
    .map(chunk => {
      const content = chunk.content.toLowerCase()
      // 计算 query 中有多少词出现在 chunk 中
      const matchCount = queryTerms.filter(t => content.includes(t)).length
      const matchRate = matchCount / queryTerms.length
      // 综合原得分 + 匹配率
      return {
        ...chunk,
        combinedScore: chunk.score * 0.7 + matchRate * 0.3,
      }
    })
    .sort((a, b) => b.combinedScore - a.combinedScore)
}
```

---

## 第七步：接入大模型回答

### 完整 RAG 问答函数

```typescript
import { ChatOpenAI } from '@langchain/openai'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'

// RAG Prompt 模板
const RAG_PROMPT = ChatPromptTemplate.fromTemplate(`你是一个专业的问答助手。请根据以下参考资料回答用户的问题。

**要求**：
1. 只基于参考资料回答，不要编造信息
2. 如果参考资料中没有相关信息，请如实说明"我没有找到相关信息"
3. 回答要准确、简洁、有条理
4. 在回答结束时，注明参考来源

**参考资料**：
{context}

**用户问题**：{question}

**回答**：`)

const llm = new ChatOpenAI({
  model: 'gpt-4o',
  temperature: 0.1, // RAG 场景温度低一些更准确
  streaming: true,
})

// 流式回答（前端展示打字效果）
async function* ragStream(question: string): AsyncGenerator<string> {
  // 1. 召回
  const retrieved = await hybridRetrieve(question, 5)

  if (retrieved.length === 0) {
    yield '抱歉，知识库中没有找到相关信息。'
    return
  }

  // 2. 重排
  const reranked = await rerank(question, retrieved)

  // 3. 构建上下文
  const context = reranked
    .map((c, i) => `[${i + 1}] 来源: ${c.source}\n${c.content}`)
    .join('\n\n')

  // 4. 构建 Prompt
  const prompt = await RAG_PROMPT.format({ context, question })

  // 5. 流式生成
  const parser = new StringOutputParser()
  const chain = llm.pipe(parser)

  for await (const chunk of await chain.stream(prompt)) {
    yield chunk
  }
}

// 非流式版本
async function ragAnswer(question: string): Promise<string> {
  const retrieved = await hybridRetrieve(question, 5)
  const reranked = await rerank(question, retrieved)

  if (reranked.length === 0) {
    return '抱歉，知识库中没有找到相关信息。'
  }

  const context = reranked
    .map((c, i) => `[${i + 1}] 来源: ${c.source}\n${c.content}`)
    .join('\n\n')

  const chain = RAG_PROMPT.pipe(llm).pipe(new StringOutputParser())
  const answer = await chain.invoke({ context, question })

  return answer
}
```

---

## 第八步：完整 RAG 系统封装

```typescript
class RAGSystem {
  private embeddings: any
  private vectorStore: any
  private llm: any
  private reranker: any

  constructor() {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: 'Xenova/bge-large-zh-v1.5',
      encode_kwargs: { normalizeEmbeddings: true },
    })
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
    })
    this.reranker = new CohereRerank({
      apiKey: process.env.COHERE_API_KEY!,
      topN: 5,
    })
  }

  // 知识库构建
  async buildIndex(filePath: string, format: DocFormat) {
    console.log('📖 加载文档...')
    const docs = await loadDocument(filePath, format)
    const text = docs.map(d => d.pageContent).join('\n')

    console.log('✂️ 分片处理...')
    const chunks = splitText(text, { chunkSize: 500, chunkOverlap: 50 })

    console.log('🔢 向量化...')
    const { ids, vectors } = await batchEmbed(chunks)

    console.log('💾 存入向量数据库...')
    await this.insertChunks(chunks, ids, vectors)

    console.log('✅ 索引构建完成！')
    return { chunkCount: chunks.length }
  }

  // 问答
  async ask(question: string, useRerank = true) {
    console.log('🔍 召回相关片段...')
    const retrieved = await hybridRetrieve(question, 10)

    console.log('📊 重排...')
    const finalChunks = useRerank
      ? await this.rerank(question, retrieved)
      : retrieved.slice(0, 5)

    const context = finalChunks
      .map((c, i) => `[${i + 1}] ${c.content}`)
      .join('\n\n')

    const answer = await ragAnswer(question)
    return {
      answer,
      sources: finalChunks.map(c => c.source),
    }
  }

  // 流式问答
  async *askStream(question: string) {
    const retrieved = await hybridRetrieve(question, 10)
    const finalChunks = await this.rerank(question, retrieved)

    const context = finalChunks
      .map((c, i) => `[${i + 1}] ${c.content}`)
      .join('\n\n')

    yield* ragStream(question)
  }
}

// 使用
const rag = new RAGSystem()

// 构建知识库（一次性）
await rag.buildIndex('./docs/公司手册.pdf', 'pdf')

// 问答（每次调用）
const { answer, sources } = await rag.ask('公司年假制度是什么？')
console.log(answer)
console.log('来源:', sources)
```

---

## 生产环境优化建议

### 1. 索引更新策略

```typescript
// 增量更新：新增文档时只索引新增部分
async function incrementalIndex(newFile: string, docId: string) {
  const existingIds = await getExistingDocIds(docId)
  const docs = await loadDocument(newFile)
  const chunks = splitText(docs[0].pageContent, { chunkSize: 500, chunkOverlap: 50 })

  // 过滤已存在的 chunk
  const newChunks = chunks.filter((_, i) => !existingIds.includes(`${docId}:${i}`))
  const { ids, vectors } = await batchEmbed(newChunks)

  await insertToVectorStore(newChunks, ids, vectors)
}
```

### 2. 查询改写（Query Rewriting）

用户问题可能表述不清晰，先改写再召回：

```typescript
async function rewriteQuery(query: string): Promise<string> {
  const prompt = `请将以下用户问题改写为更清晰、更适合检索的形式。
保留原意，但使用更精确的关键词。

原问题：{query}
改写后：`

  const chain = ChatPromptTemplate.fromTemplate(prompt).pipe(llm).pipe(new StringOutputParser())
  return await chain.invoke({ query })
}
```

### 3. 多路召回 + Reciprocal Rank Fusion

```typescript
async function reciprocalRankFusion(
  results: RetrievedChunk[][],
  k = 60
): Promise<RetrievedChunk[]> {
  const scoreMap = new Map<string, { chunk: RetrievedChunk; score: number }>()

  results.forEach(chunks => {
    chunks.forEach((chunk, rank) => {
      const id = chunk.content.slice(0, 50) // 简单 ID
      const rrfScore = 1 / (k + rank + 1)
      if (scoreMap.has(id)) {
        scoreMap.get(id)!.score += rrfScore
      } else {
        scoreMap.set(id, { chunk, score: rrfScore })
      }
    })
  })

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(s => s.chunk)
}
```

---

## 总结

本文完整实现了一套 TypeScript RAG 系统：

| 模块 | 技术方案 | 关键点 |
|------|---------|-------|
| 文档解析 | LangChain Loaders | PDF/DOCX/TXT 支持 |
| 文本分片 | RecursiveCharacterTextSplitter | 按语义边界切，50字符重叠 |
| 向量化 | BGE-large-zh（开源）或 OpenAI | 批量处理，防限速 |
| 存储 | Typesense | Docker 部署，支持向量搜索 |
| 召回 | 向量相似度 + 关键词混合 | 多路召回取长补短 |
| 重排 | Cohere Rerank | 语义重排序，大幅提升相关度 |
| 回答 | GPT-4o + RAG Prompt | 流式输出，注明来源 |

**进阶方向**：
- Agent 化：让 LLM 自己决定是否需要 RAG、调用哪个工具
- 图谱化：用知识图谱补充向量检索的关联性
- 多模态：支持图片、表格的 RAG（OCR + Layout 分析）

---

*本文由小虾子 🦐 撰写*
