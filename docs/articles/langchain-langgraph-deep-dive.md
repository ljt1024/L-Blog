---
title: LangChain 与 LangGraph 深度解析：Python AI 应用开发完整指南
date: 2026-07-28
---

# LangChain 与 LangGraph 深度解析：Python AI 应用开发完整指南

> LLM（大语言模型）只是大脑，LangChain 才是神经中枢。它把模型、提示词、向量数据库、工具调用、记忆系统串联成完整应用。LangGraph 更进一步，用状态图构建多 Agent 协作的复杂流程。本文系统覆盖 LangChain 核心概念（Chain / Prompt / Memory / RAG / Agent）和 LangGraph 状态机模型，是你开发生产级 AI 应用的完整指南。

本文由小虾子 🦐 撰写

## LangChain 架构概览

```
LangChain 核心组件：
─────────────────────────────────────────────────────
┌─────────────────────────────────────────────────┐
│                LangChain 应用                    │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Chain  │  │  Agent   │  │  Memory  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│       ↓             ↓             ↓            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Prompt  │  │  Tools   │  │  Vector  │      │
│  │ Template │  │ 调用工具  │  │  Store   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│       ↓             ↓             ↓            │
│  ┌──────────────────────────────────────────┐  │
│  │          LLM / Chat Model                │  │
│  │   OpenAI / Anthropic / 本地模型          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

核心概念：
• Chain：链式调用，串联多个组件（Prompt → LLM → Parser）
• Agent：智能体，根据输入动态选择工具执行
• Memory：记忆系统，保存对话历史
• RAG：检索增强生成，从向量库召回相关文档
• Tool：工具，LLM 可以调用的外部功能（搜索/计算/API）
─────────────────────────────────────────────────────
```

---

## 快速上手

### 安装与第一个应用

```bash
pip install langchain langchain-openai langchain-community
```

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# ===== 1. 初始化模型 =====
model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
    api_key="your-api-key",  # 或从环境变量 OPENAI_API_KEY
)

# ===== 2. 定义提示词模板 =====
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个专业的{role}，回答要简洁专业。"),
    ("user", "{question}")
])

# ===== 3. 创建输出解析器 =====
parser = StrOutputParser()

# ===== 4. 组装 Chain =====
chain = prompt | model | parser  # LCEL（LangChain Expression Language）

# ===== 5. 调用 =====
response = chain.invoke({
    "role": "前端工程师",
    "question": "React 和 Vue 的主要区别是什么？"
})

print(response)
# React 采用虚拟 DOM 和单向数据流...
```

### LCEL：LangChain 表达式语言

```python
# LCEL 核心操作符：|（管道）
# 将组件串联成链：prompt | model | parser

from langchain_core.runnables import RunnablePassthrough, RunnableParallel

# ===== RunnablePassthrough：透传输入 =====
chain = RunnablePassthrough() | model | parser
# 输入: "Hello" → 模型 → 输出: "Hi there!"

# ===== RunnableParallel：并行执行 =====
chain = RunnableParallel({
    "joke": prompt | model,
    "poem": prompt | model,
})

result = chain.invoke({"question": "写一首关于春天的诗"})
# {"joke": ..., "poem": ...}

# ===== 条件分支 =====
from langchain_core.runnables import RunnableBranch

branch = RunnableBranch(
    (lambda x: x["topic"] == "math", math_chain),
    (lambda x: x["topic"] == "history", history_chain),
    default_chain,  # 默认分支
)

result = branch.invoke({"topic": "math", "question": "1+1=?"})
```

---

## Prompt 模板

### 基础模板

```python
from langchain_core.prompts import (
    ChatPromptTemplate,
    PromptTemplate,
    FewShotChatMessagePromptTemplate,
)

# ===== 1. 字符串模板 =====
template = PromptTemplate.from_template("给我讲一个关于{topic}的笑话")
prompt = template.format(topic="程序员")
print(prompt)  # 给我讲一个关于程序员的笑话

# ===== 2. ChatPromptTemplate：多角色对话 =====
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}，回答要{style}。"),
    ("user", "{question}"),
    ("assistant", "好的，我来回答："),
])

formatted = prompt.format_messages(
    role="Python 专家",
    style="简洁专业",
    question="Python 中的 GIL 是什么？"
)

for msg in formatted:
    print(f"{msg.type}: {msg.content}")
```

### Few-Shot 示例

```python
# ===== Few-Shot：提供示例提升模型表现 =====
examples = [
    {"input": "开心", "output": "😊 心情不错！"},
    {"input": "难过", "output": "😢 别难过，来个拥抱"},
    {"input": "愤怒", "output": "😤 深呼吸，冷静一下"},
]

example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}"),
])

few_shot_prompt = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples,
)

final_prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个情感助手，根据用户情绪给出回应。"),
    few_shot_prompt,
    ("human", "{input}"),
])

chain = final_prompt | model | parser
response = chain.invoke({"input": "紧张"})
print(response)  # 😰 别紧张，深呼吸放松...
```

### 消息历史

```python
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import MessagesPlaceholder

# ===== 手动构造历史 =====
history = [
    HumanMessage(content="你好"),
    AIMessage(content="你好！有什么可以帮你的？"),
    HumanMessage(content="我叫小明"),
    AIMessage(content="你好小明！"),
]

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个友好的助手。"),
    MessagesPlaceholder(variable_name="history"),  # 插入历史
    ("user", "{question}"),
])

chain = prompt | model | parser
response = chain.invoke({
    "history": history,
    "question": "还记得我叫什么吗？"
})
print(response)  # 你叫小明！
```

---

## 记忆系统

### ConversationBufferMemory

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

# ===== 内存记忆（开发调试用）=====
memory = ConversationBufferMemory()

# 添加对话历史
memory.save_context({"input": "你好"}, {"output": "你好！我是 AI 助手"})
memory.save_context({"input": "我叫小明"}, {"output": "你好小明！很高兴认识你"})

# 获取历史
print(memory.load_memory_variables({}))
# {'history': 'Human: 你好\nAI: 你好！我是 AI 助手\nHuman: 我叫小明\nAI: 你好小明！很高兴认识你'}

# ===== 使用 ConversationChain =====
chain = ConversationChain(
    llm=model,
    memory=memory,
    verbose=True,  # 打印详细日志
)

response = chain.predict(input="还记得我叫什么吗？")
print(response)  # 你叫小明！
```

### 持久化记忆

```python
from langchain_community.chat_message_histories import (
    FileChatMessageHistory,
    RedisChatMessageHistory,
    SQLChatMessageHistory,
)

# ===== 文件持久化 =====
memory = ConversationBufferMemory(
    chat_memory=FileChatMessageHistory("chat_history.json"),
    return_messages=True,
)

# ===== Redis 持久化 =====
memory = ConversationBufferMemory(
    chat_memory=RedisChatMessageHistory(
        session_id="user_123",
        url="redis://localhost:6379",
    )
)

# ===== SQL 持久化 =====
memory = ConversationBufferMemory(
    chat_memory=SQLChatMessageHistory(
        session_id="user_123",
        connection_string="sqlite:///chat.db",
    )
)

# ===== 使用 RunnableWithMessageHistory =====
from langchain_core.runnables.history import RunnableWithMessageHistory

chain = prompt | model | parser

chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=lambda session_id: FileChatMessageHistory(f"chat_{session_id}.json"),
    input_messages_key="question",
    history_messages_key="history",
)

response = chain_with_history.invoke(
    {"question": "你好"},
    config={"configurable": {"session_id": "user_123"}}
)
```

### 滑动窗口与摘要

```python
from langchain.memory import (
    ConversationBufferWindowMemory,
    ConversationSummaryMemory,
)

# ===== 滑动窗口：只保留最近 N 轮 =====
memory = ConversationBufferWindowMemory(k=2)  # 只保留最近 2 轮

# ===== 摘要记忆：用 LLM 总结历史 =====
memory = ConversationSummaryMemory(
    llm=model,
    max_token_limit=500,  # 摘要最大长度
)

# 对话过程中自动生成摘要
memory.save_context({"input": "我去了北京"}, {"output": "北京很好玩！"})
memory.save_context({"input": "然后去了上海"}, {"output": "上海也很不错"})

print(memory.load_memory_variables({}))
# {'history': '用户去了北京和上海旅游...'}（摘要）
```

---

## RAG：检索增强生成

### 向量数据库

```python
from langchain_community.vectorstores import Chroma, FAISS, Pinecone
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ===== 1. 加载文档 =====
loader = TextLoader("knowledge.txt")
documents = loader.load()

# ===== 2. 文档切分 =====
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # 每个 chunk 最大 1000 字符
    chunk_overlap=200,      # chunk 之间重叠 200 字符
    separators=["\n\n", "\n", " ", ""],
)

chunks = text_splitter.split_documents(documents)
print(f"切分成 {len(chunks)} 个片段")

# ===== 3. 生成嵌入并存储到向量库 =====
embeddings = OpenAIEmbeddings()

# Chroma（本地向量库，适合开发）
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db",  # 持久化目录
)

# FAISS（Facebook 开源，纯内存，快速）
vectorstore = FAISS.from_documents(chunks, embeddings)

# Pinecone（云端向量库，生产推荐）
# vectorstore = Pinecone.from_documents(chunks, embeddings, index_name="my-index")

# ===== 4. 相似度检索 =====
results = vectorstore.similarity_search("什么是机器学习？", k=3)

for doc in results:
    print(f"内容: {doc.page_content[:100]}...")
    print(f"来源: {doc.metadata.get('source')}\n")

# ===== 5. 向量检索 + LLM =====
retriever = vectorstore.as_retriever(
    search_type="mmr",      # 最大边际相关性（减少重复）
    search_kwargs={"k": 3, "fetch_k": 10},
)
```

### RAG Chain

```python
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# ===== 基础 RAG =====
rag_prompt = ChatPromptTemplate.from_messages([
    ("system", "根据以下上下文回答问题，如果上下文没有相关信息，回答"我不知道"。\n\n上下文：{context}"),
    ("user", "{question}"),
])

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | rag_prompt
    | model
    | parser
)

response = rag_chain.invoke("什么是机器学习？")
print(response)
```

### 高级 RAG 技术

```python
from langchain.retrievers import (
    ContextualCompressionRetriever,
    EnsembleRetriever,
    MultiQueryRetriever,
)

# ===== 1. 多查询检索：生成多个相关查询 =====
multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=retriever,
    llm=model,
)

# 自动生成多个查询词，提高召回率
docs = multi_query_retriever.get_relevant_documents("机器学习")

# ===== 2. 混合检索：关键词 + 向量 =====
from langchain_community.retrievers import BM25Retriever

bm25_retriever = BM25Retriever.from_documents(chunks)
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, retriever],
    weights=[0.4, 0.6],  # BM25 权重 0.4，向量权重 0.6
)

# ===== 3. 重排序：检索后用模型重排序 =====
from langchain.retrievers.document_compressors import LLMChainExtractor

compressor = LLMChainExtractor.from_llm(model)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=retriever,
)

# 检索后提取相关部分
docs = compression_retriever.get_relevant_documents("机器学习")
```

---

## Agent 与工具调用

### 工具定义

```python
from langchain_core.tools import tool
from langchain_community.tools import (
    DuckDuckGoSearchRun,
    WikipediaQueryRun,
    PythonREPLTool,
)

# ===== 1. 装饰器定义工具 =====
@tool
def get_weather(city: str) -> str:
    """
    获取指定城市的天气信息
    
    Args:
        city: 城市名称，如"北京"、"上海"
    
    Returns:
        天气信息字符串
    """
    # 实际应调用天气 API
    weather_data = {
        "北京": "晴天，温度 25°C",
        "上海": "多云，温度 28°C",
    }
    return weather_data.get(city, f"未找到 {city} 的天气信息")

@tool
def calculate(expression: str) -> str:
    """
    计算数学表达式
    
    Args:
        expression: 数学表达式，如"2+3*4"
    
    Returns:
        计算结果
    """
    try:
        result = eval(expression)
        return str(result)
    except Exception as e:
        return f"计算错误: {e}"

# ===== 2. 内置工具 =====
search_tool = DuckDuckGoSearchRun()
wiki_tool = WikipediaQueryRun()
python_tool = PythonREPLTool()

# ===== 3. 工具列表 =====
tools = [
    get_weather,
    calculate,
    search_tool,
]

# 查看工具描述
for t in tools:
    print(f"工具名: {t.name}")
    print(f"描述: {t.description}\n")
```

### ReAct Agent

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

# ===== 1. 定义提示词 =====
agent_prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个有用的助手，可以使用工具回答问题。"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),  # Agent 思考过程
])

# ===== 2. 创建 Agent =====
agent = create_tool_calling_agent(model, tools, agent_prompt)

# ===== 3. 创建执行器 =====
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,           # 打印详细过程
    handle_parsing_errors=True,
    max_iterations=5,       # 最多迭代 5 次
)

# ===== 4. 运行 =====
response = agent_executor.invoke({
    "input": "北京今天天气怎么样？然后计算 25 + 30"
})

print(response["output"])
# 北京今天晴天，温度 25°C。25 + 30 = 55
```

### Structured Tool Agent

```python
from langchain.agents import create_structured_chat_agent
from pydantic import BaseModel, Field

# ===== 定义结构化输入 =====
class SearchInput(BaseModel):
    """搜索引擎输入"""
    query: str = Field(description="搜索关键词")
    num_results: int = Field(default=5, description="返回结果数量")

@tool(args_schema=SearchInput)
def search_web(query: str, num_results: int = 5) -> str:
    """
    使用搜索引擎搜索信息
    
    Args:
        query: 搜索关键词
        num_results: 返回结果数量
    """
    # 实际调用搜索 API
    return f"搜索 {query}，找到 {num_results} 条结果"

# 创建结构化 Agent
agent = create_structured_chat_agent(model, [search_web], agent_prompt)
executor = AgentExecutor(agent=agent, tools=[search_web], verbose=True)

response = executor.invoke({
    "input": "搜索 Python 教程，返回 3 条结果"
})
```

---

## LangGraph：状态图 Agent

### LangGraph 核心概念

```
LangGraph = 状态机 + Agent
─────────────────────────────────────────────────────
节点（Node）：执行函数，接收状态，返回状态更新
边（Edge）：节点之间的转移条件
状态（State）：在节点间共享的数据结构
图（Graph）：节点和边组成的有向图

vs LangChain Chain：
Chain：线性流程（A → B → C）
Graph：复杂流程（条件分支/循环/并行）
─────────────────────────────────────────────────────
```

### 基础图

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

# ===== 1. 定义状态 =====
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 对话历史
    question: str
    answer: str
    iterations: int

# ===== 2. 定义节点函数 =====
def generate_answer(state: AgentState) -> dict:
    """生成回答"""
    question = state["question"]
    response = model.invoke(question)
    return {
        "answer": response.content,
        "iterations": state.get("iterations", 0) + 1,
    }

def check_answer(state: AgentState) -> str:
    """检查回答质量"""
    answer = state["answer"]
    
    # 简单规则：回答太短则重试
    if len(answer) < 50 and state["iterations"] < 3:
        return "retry"
    return "end"

# ===== 3. 构建图 =====
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("generate", generate_answer)

# 设置入口
workflow.set_entry_point("generate")

# 添加条件边
workflow.add_conditional_edges(
    "generate",
    check_answer,
    {
        "retry": "generate",  # 重试 → 回到 generate
        "end": END,           # 结束
    }
)

# ===== 4. 编译并运行 =====
app = workflow.compile()

result = app.invoke({
    "question": "什么是 Python？",
    "iterations": 0,
})

print(result["answer"])
```

### 多 Agent 协作

```python
from langgraph.prebuilt import create_agent_executor
from langchain_core.messages import HumanMessage

# ===== 定义专门的 Agent =====
def researcher_agent(state: AgentState) -> dict:
    """研究 Agent：负责搜索信息"""
    question = state["question"]
    
    # 使用搜索工具
    search_result = search_tool.run(question)
    
    return {
        "messages": [HumanMessage(content=f"研究结果：{search_result}")],
    }

def writer_agent(state: AgentState) -> dict:
    """写作 Agent：负责撰写回答"""
    messages = state["messages"]
    
    # 根据研究结果写作
    response = model.invoke(messages)
    
    return {
        "messages": [response],
        "answer": response.content,
    }

def reviewer_agent(state: AgentState) -> dict:
    """审查 Agent：检查回答质量"""
    answer = state["answer"]
    
    prompt = f"""
    请审查以下回答的质量，如果满意返回 "approved"，否则返回 "needs_revision"：
    
    回答：{answer}
    """
    
    review = model.invoke(prompt).content
    
    if "approved" in review.lower():
        return {"approved": True}
    return {"approved": False}

# ===== 构建协作图 =====
class MultiAgentState(TypedDict):
    question: str
    messages: Annotated[list, add_messages]
    answer: str
    approved: bool

workflow = StateGraph(MultiAgentState)

workflow.add_node("researcher", researcher_agent)
workflow.add_node("writer", writer_agent)
workflow.add_node("reviewer", reviewer_agent)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", "reviewer")

workflow.add_conditional_edges(
    "reviewer",
    lambda state: "end" if state["approved"] else "rewrite",
    {
        "end": END,
        "rewrite": "writer",  # 不通过则重写
    }
)

app = workflow.compile()

result = app.invoke({"question": "写一篇关于 AI 的文章"})
print(result["answer"])
```

### 记忆与持久化

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

# ===== 内存持久化（开发用）=====
checkpointer = MemorySaver()

app = workflow.compile(checkpointer=checkpointer)

# 多轮对话
config = {"configurable": {"thread_id": "conversation_123"}}

response1 = app.invoke(
    {"question": "我叫小明"},
    config=config,
)

response2 = app.invoke(
    {"question": "我叫什么？"},
    config=config,
)
print(response2["answer"])  # 你叫小明

# ===== SQLite 持久化（生产用）=====
with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
    app = workflow.compile(checkpointer=checkpointer)
    
    # 持久化存储对话历史
    result = app.invoke(
        {"question": "你好"},
        config={"configurable": {"thread_id": "user_456"}},
    )
```

---

## 实战案例

### 案例 1：智能客服机器人

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.runnables import RunnablePassthrough

# ===== 知识库 RAG =====
def setup_knowledge_base():
    """加载产品知识库"""
    # 加载产品文档
    loader = TextLoader("product_faq.txt")
    documents = loader.load()
    
    # 切分
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_documents(documents)
    
    # 向量化
    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(chunks, embeddings)
    
    return vectorstore.as_retriever(search_kwargs={"k": 3})

# ===== 构建客服 Chain =====
class CustomerServiceBot:
    def __init__(self):
        self.model = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        self.retriever = setup_knowledge_base()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history",
        )
        
        # Prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是客服机器人，根据产品知识库回答问题。
            
产品知识库：
{context}

如果知识库没有相关信息，请诚实说不知道，不要编造。
回答要礼貌、简洁、专业。"""),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "{question}"),
        ])
        
        self.chain = (
            {
                "context": self.retriever | format_docs,
                "question": RunnablePassthrough(),
                "chat_history": lambda _: self.memory.load_memory_variables({})["chat_history"],
            }
            | self.prompt
            | self.model
            | StrOutputParser()
        )
    
    def chat(self, question: str) -> str:
        response = self.chain.invoke(question)
        self.memory.save_context({"input": question}, {"output": response})
        return response

# 使用
bot = CustomerServiceBot()
print(bot.chat("你们的退货政策是什么？"))
print(bot.chat("订单多久能发货？"))
```

### 案例 2：文档问答系统

```python
from langchain_community.document_loaders import (
    PyPDFLoader,
    UnstructuredMarkdownLoader,
    DirectoryLoader,
)
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

# ===== 批量加载文档 =====
def load_documents(directory: str):
    """加载目录下的所有文档"""
    loaders = {
        ".pdf": PyPDFLoader,
        ".md": UnstructuredMarkdownLoader,
        ".txt": TextLoader,
    }
    
    documents = []
    for ext, loader_class in loaders.items():
        loader = DirectoryLoader(
            directory,
            glob=f"**/*{ext}",
            loader_cls=loader_class,
        )
        documents.extend(loader.load())
    
    return documents

# ===== 构建向量库 =====
def build_vector_store(documents, persist_dir="./vector_db"):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.split_documents(documents)
    
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma.from_documents(
        chunks,
        embeddings,
        persist_directory=persist_dir,
    )
    
    return vectorstore

# ===== 问答 Chain =====
class DocumentQA:
    def __init__(self, persist_dir="./vector_db"):
        self.vectorstore = Chroma(
            persist_directory=persist_dir,
            embedding_function=OpenAIEmbeddings(),
        )
        self.retriever = self.vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"k": 5, "fetch_k": 20},
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """根据文档内容回答问题。
            
文档内容：
{context}

请引用来源（文件名和页码）。"""),
            ("user", "{question}"),
        ])
        
        self.chain = (
            {"context": self.retriever | format_docs, "question": RunnablePassthrough()}
            | self.prompt
            | ChatOpenAI(model="gpt-4o")
            | StrOutputParser()
        )
    
    def ask(self, question: str) -> str:
        # 先检索
        docs = self.retriever.invoke(question)
        sources = [f"{doc.metadata.get('source', '未知')} - 页 {doc.metadata.get('page', '?')}" 
                   for doc in docs]
        
        # 生成回答
        answer = self.chain.invoke(question)
        
        return f"{answer}\n\n来源：{', '.join(sources)}"

# 使用
qa = DocumentQA()
print(qa.ask("项目的技术架构是什么？"))
```

### 案例 3：多工具 Agent

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_community.tools import (
    DuckDuckGoSearchRun,
    WikipediaQueryRun,
    PythonREPLTool,
)
from langchain_experimental.utilities import PythonREPL

# ===== 定义工具集 =====
@tool
def send_email(to: str, subject: str, body: str) -> str:
    """发送邮件"""
    # 实际应调用邮件 API
    return f"邮件已发送给 {to}，主题：{subject}"

@tool
def query_database(sql: str) -> str:
    """执行 SQL 查询"""
    # 实际应连接数据库
    return f"查询结果：[{sql}] 返回 10 条记录"

@tool
def generate_chart(data: str, chart_type: str) -> str:
    """生成图表"""
    return f"已生成 {chart_type} 图表，数据：{data}"

tools = [
    DuckDuckGoSearchRun(),
    WikipediaQueryRun(),
    PythonREPLTool(),
    send_email,
    query_database,
    generate_chart,
]

# ===== 创建 Agent =====
prompt = ChatPromptTemplate.from_messages([
    ("system", """你是一个全能助手，可以使用以下工具：
- search: 网络搜索
- wikipedia: 维基百科查询
- python_repl: 执行 Python 代码
- send_email: 发送邮件
- query_database: 数据库查询
- generate_chart: 生成图表

根据用户需求选择合适的工具完成任务。"""),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(ChatOpenAI(model="gpt-4o"), tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True, max_iterations=10)

# ===== 运行 =====
result = executor.invoke({
    "input": "搜索 Python 最新版本特性，然后写一个邮件总结发给 team@example.com"
})

print(result["output"])
```

---

## LangChain vs 原生 API

```
对比维度          LangChain              原生 OpenAI API
───────────────────────────────────────────────────────────
开发速度          ⚡ 极快                 🐢 需手动组装
学习成本          中等                   低
灵活性            高（抽象层可替换）      低（绑定 OpenAI）
RAG 支持          ✅ 开箱即用            ❌ 需自己实现
Agent 工具调用    ✅ 自动解析            ❌ 需手动解析
记忆系统          ✅ 多种实现            ❌ 需自己管理
向量库集成        ✅ 20+ 集成            ❌ 需单独集成
调试能力          ✅ LangSmith           ❌ 需自己记录
生产成本          高（抽象开销）          低（无中间层）
适合场景          快速原型 / RAG / Agent  简单对话 / 成本敏感
───────────────────────────────────────────────────────────

结论：
快速开发 / RAG / 多工具 Agent → LangChain
简单调用 / 成本敏感 / 高性能 → 原生 API
两者可以混用（LangChain 底层仍是 OpenAI API）
```

---

## 常见陷阱与最佳实践

### 陷阱 1：Prompt 不明确导致幻觉

```python
# ❌ 陷阱：Prompt 不明确，模型可能编造
prompt = "介绍一下 Python"

# ✅ 正确：明确上下文和限制
prompt = """你是一个 Python 讲师，请用 200 字以内介绍 Python 的主要特点。
要求：
1. 列出 3 个核心特点
2. 每个特点用一句话说明
3. 不要涉及具体语法细节
"""
```

### 陷阱 2：向量库未持久化

```python
# ❌ 陷阱：每次启动都重新向量化（成本高）
vectorstore = FAISS.from_documents(documents, embeddings)

# ✅ 正确：持久化存储
import pickle

# 保存
vectorstore.save_local("faiss_index")

# 加载
vectorstore = FAISS.load_local(
    "faiss_index",
    embeddings,
    allow_dangerous_deserialization=True,
)

# 或用 Chroma 自动持久化
vectorstore = Chroma.from_documents(
    documents,
    embeddings,
    persist_directory="./chroma_db",
)
```

### 陷阱 3：Agent 无限循环

```python
# ❌ 陷阱：Agent 可能陷入循环调用工具
executor = AgentExecutor(agent=agent, tools=tools)

# ✅ 正确：限制迭代次数和超时
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    max_iterations=5,           # 最多迭代 5 次
    max_execution_time=60,      # 最多执行 60 秒
    handle_parsing_errors=True, # 解析错误时优雅处理
)
```

---

## 总结

```
LangChain 核心组件速查：
─────────────────────────────────────────────────────
ChatOpenAI                   LLM 模型
ChatPromptTemplate           提示词模板
StrOutputParser              输出解析器
ConversationBufferMemory     对话记忆
FAISS / Chroma               向量数据库
RecursiveCharacterTextSplitter  文档切分
@tool                        工具定义
create_tool_calling_agent    Agent 创建
AgentExecutor                Agent 执行器
─────────────────────────────────────────────────────
```

```
LangGraph 核心概念速查：
─────────────────────────────────────────────────────
StateGraph                   状态图
TypedDict                    状态类型定义
add_node                     添加节点
add_edge                     添加边
add_conditional_edges        添加条件边
set_entry_point              设置入口
compile()                    编译图
checkpointer                 持久化
─────────────────────────────────────────────────────
```

```
最佳实践：
─────────────────────────────────────────────────────
✅ Prompt 要明确：角色 / 上下文 / 输出格式 / 限制
✅ 向量库要持久化：避免每次重新向量化
✅ Agent 要限制迭代：max_iterations / max_execution_time
✅ 记忆要持久化：File / Redis / SQL
✅ 工具要写描述：LLM 根据描述选择工具
✅ RAG 要重排序：提高召回质量
✅ 监控要开启：LangSmith 追踪调用链
✅ 成本要控制：温度参数 / 模型选择 / 缓存
✅ 错误要处理：try-except / handle_parsing_errors
✅ 测试要充分：Few-Shot 示例 / 边界情况
─────────────────────────────────────────────────────
```

LangChain 把 LLM 从"对话模型"升级成"应用开发框架"。Chain 串联组件，Agent 动态决策，RAG 增强知识，LangGraph 编排复杂流程。掌握这套工具链，你就能从"调用 API"进化到"构建 AI 应用" 🦐

本文由小虾子 🦐 撰写
