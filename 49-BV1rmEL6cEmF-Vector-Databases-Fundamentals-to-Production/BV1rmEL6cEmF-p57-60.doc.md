# Vector Databases Fundamentals to Production（P57–P60）复现文档

## 1. 这一节做什么

这四段课不是零散的知识点，而是一条连续的工程路线：先用 P57 建立“分块策略怎么选”的判断框架，再用 P58 把递归分块和语义分块放到同一份文档上跑一遍，最后用 P59–P60 把向量数据库从“概念上的赢家”落到本机 Docker 里的 PGVector 环境。读者照着本文做完，会得到两个可运行产物：

1. 一个 Python 实验：同一份 API 文档分别做递归分块和语义分块，打印块数量、块内容，写入两个 Chroma 向量库，再用同一组查询比较检索结果。
2. 一个本地 PGVector 容器：用 Docker 启动 PostgreSQL + pgvector 镜像，能用 `psql` 连接并执行 `select version();`。注意：P60 只做到“连接成功”，`CREATE EXTENSION vector` 是下一节才做的事，课里明确说“现在还不要加扩展”。

建议目录结构如下。课程仓库里讲师已经有 `chunking` 和 `pgvector` 相关目录；下面是把本文代码直接落盘的最小结构：

```text
vector-course/
├── pyproject.toml
├── uv.lock
├── .env
├── chunking/
│   ├── semantic_chunking.py
│   └── production_ready.py
└── pgvector/
    ├── setup.sh
    └── .env.example
```

环境变量只要一个 `.env`，放在项目根目录：

```bash
OPENAI_API_KEY=sk-your-key
PGVECTOR_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

Python 侧依赖用讲师使用的 `uv` 安装；也可以用 `pip install`，讲师明确说“我用 UV，不重要，你用什么都行”。命令是：

```bash
uv add langchain langchain-openai langchain-chroma langchain-experimental chromadb python-dotenv
```

课里没有给这些包的具体版本号，因此本文不编造版本；请保留 `uv.lock` 锁定实际安装结果。P58 的代码会调用 OpenAI 的 `text-embedding-3-small`，所以必须配置 `OPENAI_API_KEY`。P60 的 Docker 部分需要本机已安装 Docker Desktop。

---

## 2. 讲师原话

P57 先给固定分块下定义。固定分块最简单，也最容易把语义切碎：

> "固定大小分块就是每 N 个字符或 token 切一刀，就这样。"
> —— p057 [00:39]

讲师用一张示意图说明问题：句子会在词中间被切断，出现 “mid-word cut”，有的块只剩下 “ps over the la” 这种没有上下文的碎片，有的块又太小，完全没用。固定分块的优点是简单、快、大小可预测，适合快速原型或非常特定的约束；缺点是破坏意义、检索质量差、用户体验差。讲师的原话非常重：

> "不要在生产环境用固定分块，永远不要。"
> —— p057 [02:05]

第二个策略是递归分块。它不是随便切，而是按自然边界的优先级往下退：

> "递归分块会按偏好顺序在自然边界切分：段落、单换行、句子、从句、单词，最后才是字符。"
> —— p057 [02:57]

讲师强调，LangChain 和很多框架默认就用这种分块，因为可靠。它形成一棵“决策树式”的切分层级：先尝试双换行分段落，段落太大再试单换行，再试句子结束符，再试从句，再试单词，最后才退到字符。这个“最后才退到字符”的顺序很关键，因为字符切分是最后手段。

![p057 02:29 递归分块按自然边界形成决策树](images/p057_0229s.jpg)

第三个策略是语义分块。讲师说它是“premium option”，按意义而不是结构切：

> "语义分块按意义而不是结构切分；先嵌入每个句子，再比较相邻嵌入，相似度下降的地方就是切分点。"
> —— p057 [04:16]

具体步骤是：第一，嵌入每个句子；第二，比较相邻句子的 embedding；第三，相似度下降时切分。图上把 S1、S2、S3 归成一块，S4、S5、S6 归成另一块，切在主题变化的位置。语义分块适合高价值 RAG、法律文档、技术手册、知识库，适合“准确性比速度更重要”的场景，因为后台计算更多，速度会更低。

![p057 03:13 语义分块按相邻 embedding 相似度下降切分](images/p057_0313s.jpg)

第四个策略是 late chunking。要理解它，先理解传统分块：

> "传统分块在边界处丢失上下文，每个块彼此孤立；late chunking 先嵌入整篇文档，再池化成块嵌入，所以块知道彼此。"
> —— p057 [06:04]

传统流程是：文档 → 切块 → 每块单独 embedding。这样 chunk 5 完全不知道 chunk 1 到 4 写了什么。Late chunking 反过来：先嵌入整篇文档，再池化出 chunk 1、chunk 2、chunk 3 的 embedding，因此每个块都带着全文上下文。讲师给出的收益是 10% 到 12% 的准确率提升；优点是保留完整上下文、边界处理更好；缺点是不是所有 embedding 模型都支持，而且实现更复杂。要用 late chunking，需要类似 Jina Embeddings v2 这种支持它的模型。讲师判断它是“分块的未来”，但当前实际最佳仍是语义分块。

P57 最后给了决策框架和 80/20 规则：

> "递归分块加好的重叠能带你走完 80%，语义分块拿到最后 20%，但语义分块成本更高。"
> —— p057 [09:04]

讲师建议：先上递归分块，测检索质量；不够好再升级到语义分块。参考表是：一般文档用递归，块大小 500–1000；技术内容、法律文档用语义，块大小 auto；代码用 code splitter，块大小按函数；Markdown 用 MD splitter，按标题切。LangChain 有对应 wrapper class，调用后由它处理切分策略。

![p057 07:59 分块策略决策框架与参考表](images/p057_0479s.jpg)

P58 是实测。讲师先安装依赖，再导入环境变量和 `text-embedding-3-small`。他准备了一份字符串文档，包含四个非常不同的主题：webhooks、error handling、rate limiting、authentication。然后同时跑递归和语义分块。语义分块器的参数是：

> "语义分块器使用 percentile 作为断点阈值类型，阈值设为 90，也就是在相似度的第 90 百分位切分。"
> —— p058 [03:27]

实验结果很有意思：递归分块得到 4 块，语义分块得到 3 块。语义分块把 rate limiting 和 error handling 合并到了一块，因为两者都在讲 API 响应。讲师没有把这件事藏起来，反而说这是很好的教学时刻：

> "语义分块并不总是更好。对结构良好、标题清晰的文档，递归结构分块反而保留了逻辑边界，而语义分块可能破坏它。"
> —— p058 [09:54]

检索测试也验证了这一点。第一个查询 “How do I authenticate with OAuth2?” 两者都检索到 authentication guide；第二个查询 “What happens when I hit the rate limit?” 递归正确返回 rate limiting，语义却返回了 auth 相关内容；第三个 “How are webhooks secured?” 递归正确返回 webhook，语义因为合并了 error handling 和 webhooks 而变得嘈杂；第四个 “What format are errors returned in?” 递归正确返回 error handling，语义又因为合并而答错。讲师结论：语义分块在非结构化、主题变化没有标题标记的流动文本里更强；对结构良好的 Markdown 类文档，递归反而更好。最后他给了生产版 `smart_chunker`：语义为主，递归兜底，验证块大小，优雅处理错误：

> "语义分块作为主路径；如果语义失败，就用递归作为兜底；然后验证块大小，并优雅处理错误。"
> —— p058 [12:01]

P59 讲 PGVector 为什么赢。讲师把时间线拆成四段：2021–2022 向量搜索刚出现，Pinecone、Weaviate、Milvus 是专门的向量数据库；2023–2024 PGVector 成熟，HNSW 索引到来，性能提升；2025–2026 企业意识到问题；2026 录制时 70% 以上的 RAG 项目使用 PGVector。Snowflake 收购了向量公司并加入向量支持，AWS、Google、Azure 都把 PGVector 加到托管 PostgreSQL 里。市场结论是：

> "市场说话了：向量搜索属于你已经在用的数据库。"
> —— p059 [02:08]

五个原因分别是：零新基础设施，只要加一个扩展；团队已经会 SQL，没有学习曲线；ACID 事务让向量数据和关系数据在同一事务里更新；成本低；没有 vendor lock-in。讲师给的成本对比是 PGVector 每月 25 美元，Pinecone 低端约每月 150 美元，约 6 倍便宜。但也不是所有场景都用 PGVector：数十亿向量用 Milvus、Qdrant 扩展更好；需要大规模亚毫秒延迟要另选；完全没有 PostgreSQL 经验也别硬上。对 90% 的 RAG 应用，PGVector 是正确选择。

> "PGVector 不需要新基础设施，只需要加一个扩展，一行代码。"
> —— p059 [02:28]

![p059 02:28 PGVector 的五个获胜原因与成本对比](images/p059_0228s.jpg)

P60 开始动手。讲师给了三种方式：本地 Docker、已有 PostgreSQL、云。演示用 Docker。前置条件是 Docker Desktop：Mac 用 `brew install --cask docker` 或去 Docker 官网下载；Windows 去官网下载 Docker Desktop；Linux 用终端命令，课里没有展开具体 Linux 安装命令。安装后验证：

```bash
docker --version
docker ps
```

`docker --version` 会显示版本、build；`docker ps` 会显示容器 ID 和镜像，第一次安装可能什么都不显示。然后进入仓库的 `pgvector/setup`，给脚本执行权限并运行：

```bash
chmod +x setup.sh
./setup.sh
```

运行输出里先出现 “unable to find the image locally”，因为本机没有 pgvector 镜像；Docker 随后拉取所有层，最后容器运行。连接命令是 `psql` 连本机 PostgreSQL：

> "密码是 postgres。"
> —— p060 [04:50]

连接后执行 `select version();`，讲师屏幕上显示 PostgreSQL 16.13。讲师特别强调：现在只是连上了 PostgreSQL，还没有 PGVector，因为 pgvector 是扩展，下一节才添加。

![p060 03:28 Docker 拉取 pgvector 镜像并启动容器](images/p060_0208s.jpg)

---

## 3. 从零复现

### 3.1 先做 P58 的分块实验

第一步，创建项目并安装依赖。讲师在已有仓库里新建了 `chunking/semantic_chunking.py`，本文按同样路径放。依赖安装命令：

```bash
uv init vector-course
cd vector-course
uv add langchain langchain-openai langchain-chroma langchain-experimental chromadb python-dotenv
```

如果你的环境没有 `uv`，用 `pip install` 同样包名即可。不要把 `langchain-experimental` 漏掉，语义分块器 `SemanticChunker` 在这个包里；讲师专门说“有些 API 还在 experimental 阶段”。

第二步，写 `.env`。`OPENAI_API_KEY` 必须存在，因为 `text-embedding-3-small` 要调用 OpenAI。`PGVECTOR_URL` 是给后面 PGVector 用的，P58 不读它也没关系。

第三步，把第 4 节的 `semantic_chunking.py` 保存到 `chunking/semantic_chunking.py`。运行：

```bash
uv run python chunking/semantic_chunking.py
```

运行后你会看到两部分输出：先打印 recursive 和 semantic 的块数量、每块字符数、每块开头预览；然后分别对两个 Chroma collection 执行四个查询并打印检索结果。第一次运行会在 `chunking/chroma_recursive` 和 `chunking/chroma_semantic` 下持久化向量库。重复运行前建议删掉这两个目录，避免 Chroma 里重复追加文档；这一步课里没讲，但不删会撞上重复数据。

第四步，运行生产版 `smart_chunker`：

```bash
uv run python chunking/production_ready.py
```

它会默认走语义分块，打印总块数；如果把 `use_semantic=False` 传进去，就直接走递归兜底。这个文件是讲师在 P58 末尾给的“production ready”思路，不是课程前半段的实验脚本。

### 3.2 再做 P60 的 PGVector Docker 环境

第一步，安装 Docker Desktop。Mac：

```bash
brew install --cask docker
```

也可以去 Docker 官网下载。Windows 去 Docker 官网下载 Docker Desktop。Linux 讲师只说“用终端命令”，没有给具体命令，本文不编造；按 Docker 官方文档安装即可。

第二步，验证 Docker：

```bash
docker --version
docker ps
```

`docker --version` 输出 Docker 版本和 build；`docker ps` 输出正在运行的容器。第一次运行可能没有任何容器，这是正常的。

第三步，保存第 4 节的 `pgvector/setup.sh`，给执行权限并运行：

```bash
chmod +x pgvector/setup.sh
./pgvector/setup.sh
```

脚本会启动名为 `pgvector` 的容器，映射 `5432:5432`，用户、密码、数据库都叫 `postgres`。镜像使用 `pgvector/pgvector:pg16`；讲师口述里说的是 “pgvector16”，对应官方镜像标签 `pg16`。运行输出会先提示本地找不到镜像，然后拉取 layers，最后 `docker ps` 显示容器在运行。

第四步，连接 PostgreSQL。用 `psql`：

```bash
psql -h localhost -U postgres -d postgres
```

提示密码时输入 `postgres`。连接成功后执行：

```sql
select version();
```

讲师屏幕上输出 PostgreSQL 16.13；你的镜像小版本可能不同，以实际输出为准。注意：这一节不要执行 `CREATE EXTENSION vector;`，课里明确说扩展下一节才加。

也可以用一条命令非交互验证：

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "select version();"
```

连接字符串是：

```text
postgresql://postgres:postgres@localhost:5432/postgres
```

这个连接串后面接 LangChain、SQLAlchemy、Node 的 `pg` 都可以；P60 只验证连接，没有写应用代码。

---

## 4. 完整代码

> 说明：本段逐字稿没有 OCR 结果；以下代码按讲师口述的依赖、参数、类名和流程重建。讲师没有给完整文件原文的地方，本文用可运行实现补齐，并在注释里标明哪些是“课里没讲、为可重复运行加的”。所有命令、参数、类名都来自逐字稿中出现过的内容。

### 4.1 `chunking/semantic_chunking.py`

```python
from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

# 讲师在 P58 准备了一份字符串文档，包含四个非常不同的主题：
# webhooks、error handling、rate limiting、authentication。
# 下面按这四个主题重写为一份结构清晰的 Markdown 文档。
SAMPLE_DOCUMENT = """# API Integration Guide

## Authentication
All requests to the platform use OAuth2. The client first sends a POST request to /oauth/token with grant_type=client_credentials, client_id, and client_secret. The authorization server returns an access_token and expires_in value. Include the token in the Authorization header as Bearer <token>. Tokens expire after one hour; refresh before expiry. Never place tokens in query strings or logs.

## Rate Limiting
The API allows 100 requests per minute per API key. Every response includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. When the limit is exceeded, the server returns HTTP 429 Too Many Requests. Clients should respect Retry-After, back off exponentially, and retry idempotent requests only. Do not retry non-idempotent POST requests without an idempotency key.

## Error Handling
Errors use JSON with fields error.code, error.message, and error.request_id. Validation failures return HTTP 400. Authentication failures return HTTP 401. Authorization failures return HTTP 403. Missing resources return HTTP 404. Server failures return HTTP 500. Always check the HTTP status code and read error.message before deciding whether to retry. Log request_id for support.

## Webhooks
Webhooks notify your service about asynchronous events. Configure an HTTPS endpoint and a signing secret in the dashboard. Each delivery includes X-Signature, a HMAC-SHA256 signature over the raw request body. Verify the signature before parsing JSON. Respond with HTTP 2xx within five seconds. Failed deliveries are retried with exponential backoff. Webhook payloads are not a replacement for polling critical state.
"""


def build_embeddings() -> OpenAIEmbeddings:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is missing. Put it in .env")
    # 讲师明确使用 text-embedding-3-small。
    return OpenAIEmbeddings(model="text-embedding-3-small")


def to_documents(chunks: List[str], strategy: str) -> List[Document]:
    return [
        Document(
            page_content=chunk,
            metadata={"source": "sample_api_guide.md", "strategy": strategy},
        )
        for chunk in chunks
    ]


def print_chunks(name: str, docs: List[Document]) -> None:
    total = len(docs)
    avg = sum(len(doc.page_content) for doc in docs) / total if total else 0
    print("=" * 90)
    print(f"{name}: total_chunks={total}, avg_chars={avg:.1f}")
    for index, doc in enumerate(docs, 1):
        preview = doc.page_content.replace("\n", " ")[:180]
        print(f"[{name} {index}] chars={len(doc.page_content)} :: {preview}")


def build_store(
    docs: List[Document],
    embeddings: OpenAIEmbeddings,
    collection_name: str,
    persist_directory: str,
) -> Chroma:
    return Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=persist_directory,
    )


def test_retrieval(query: str, store: Chroma, name: str, k: int = 1) -> None:
    docs = store.similarity_search(query, k=k)
    print("-" * 90)
    print(f"QUERY [{name}]: {query}")
    for index, doc in enumerate(docs, 1):
        text = doc.page_content.replace("\n", " ")
        print(f"  result {index}: {text[:300]}")


def main() -> None:
    embeddings = build_embeddings()

    # 讲师参数：chunk_size=400，chunk_overlap=50。
    # 分隔符按讲师口述：双换行、单换行、句号加空格、逗号等。
    # 逐字稿把 commas 识别成了 comments，按上下文理解为逗号分隔符。
    recursive_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
    )
    recursive_chunks = recursive_splitter.split_text(SAMPLE_DOCUMENT)
    recursive_docs = to_documents(
```python
    recursive_docs = to_documents(recursive_chunks, "recursive")

    # 讲师参数：SemanticChunker 来自 langchain_experimental.text_splitter，
    # 传入 embeddings，breakpoint_threshold_type="percentile"，
    # breakpoint_threshold_amount=90，即在相似度第 90 百分位切分。
    semantic_splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=90,
    )
    semantic_chunks = semantic_splitter.split_text(SAMPLE_DOCUMENT)
    semantic_docs = to_documents(semantic_chunks, "semantic")

    print_chunks("RECURSIVE (chunk_size=400, overlap=50)", recursive_docs)
    print_chunks("SEMANTIC (percentile=90)", semantic_docs)

    recursive_store = build_store(
        docs=recursive_docs,
        embeddings=embeddings,
        collection_name="api_guide_recursive",
        persist_directory="chunking/chroma_recursive",
    )
    semantic_store = build_store(
        docs=semantic_docs,
        embeddings=embeddings,
        collection_name="api_guide_semantic",
        persist_directory="chunking/chroma_semantic",
    )

    # 讲师在 P58 用了四个查询，分别对应文档里的四个主题。
    test_queries = [
        "How do I authenticate with OAuth2?",
        "What happens when I hit the rate limit?",
        "How are webhooks secured?",
        "What format are errors returned in?",
    ]

    for query in test_queries:
        test_retrieval(query, recursive_store, "recursive", k=1)
        test_retrieval(query, semantic_store, "semantic", k=1)


if __name__ == "__main__":
    main()
```

### 4.2 `chunking/production_ready.py`

```python
from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

DEFAULT_CHUNK_SIZE = 400
DEFAULT_CHUNK_OVERLAP = 50
MIN_CHUNK_CHARS = 20  # 课里没讲这个具体数字；用于"验证块大小"的最低可读长度


def build_embeddings() -> OpenAIEmbeddings:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is missing. Put it in .env")
    return OpenAIEmbeddings(model="text-embedding-3-small")


def _recursive_fallback(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> List[str]:
    """内部递归兜底函数，使用 RecursiveCharacterTextSplitter。"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
    )
    return splitter.split_text(text)


def _validate_chunks(chunks: List[str]) -> List[str]:
    """第三条关键点：验证块大小。丢掉空白块和过短的碎片块。"""
    valid: List[str] = []
    for chunk in chunks:
        cleaned = chunk.strip()
        if len(cleaned) < MIN_CHUNK_CHARS:
            continue
        valid.append(cleaned)
    return valid


def smart_chunker(
    text: str,
    use_semantic: bool = True,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> List[str]:
    """语义为主、递归兜底。讲师 P58 末尾给出的生产版思路。

    - use_semantic=True：优先用 SemanticChunker
    - use_semantic=False：直接用递归
    - 语义失败（模型报错、返回空、全部块过短）自动降级到递归
    """
    if not text or not text.strip():
        return []

    if use_semantic:
        try:
            embeddings = build_embeddings()
            splitter = SemanticChunker(
                embeddings=embeddings,
                breakpoint_threshold_type="percentile",
                breakpoint_threshold_amount=90,
            )
            chunks = _validate_chunks(splitter.split_text(text))
            if chunks:
                return chunks
            # 语义切出空结果，落到兜底
        except Exception as exc:  # 第四条关键点：优雅处理错误
            print(f"[smart_chunker] semantic failed, fallback to recursive: {exc}")

    chunks = _validate_chunks(
        _recursive_fallback(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    )
    if not chunks:
        raise ValueError("Chunking produced no usable chunks")
    return chunks


if __name__ == "__main__":
    from semantic_chunking import SAMPLE_DOCUMENT  # 同目录复用示例文档

    chunks = smart_chunker(SAMPLE_DOCUMENT, use_semantic=True)
    print(f"smart_chunker(semantic=True) -> {len(chunks)} chunks")
    for index, chunk in enumerate(chunks, 1):
        print(f"[{index}] chars={len(chunk)} :: {chunk[:120]!r}")

    fallback_chunks = smart_chunker(SAMPLE_DOCUMENT, use_semantic=False)
    print(f"smart_chunker(semantic=False) -> {len(fallback_chunks)} chunks")
```

### 4.3 `pgvector/setup.sh`

```bash
#!/usr/bin/env bash
# 课里讲师运行的是仓库自带的 setup.sh；逐字稿没有逐条念出 docker 参数，
# 下面按讲师演示到的行为重写：镜像 pgvector/pgvector:pg16、
# 容器名 pgvector、用户/密码/库名都是 postgres、端口 5432。
set -euo pipefail

CONTAINER_NAME="pgvector"
IMAGE="pgvector/pgvector:pg16"
PORT="5432"

# 如果同名容器已存在，先停掉并删除，保证脚本可重复运行（课里没讲这步）
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "Removing existing container ${CONTAINER_NAME} ..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "Starting ${IMAGE} ..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p "${PORT}:5432" \
  "${IMAGE}"

echo "Waiting for PostgreSQL to accept connections ..."
for i in $(seq 1 30); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  sleep 1
done

docker ps --filter "name=${CONTAINER_NAME}"

cat <<'EOF'

Connect with:
  psql -h localhost -U postgres -d postgres
  # password: postgres

Connection string:
  postgresql://postgres:postgres@localhost:5432/postgres

NOTE: the vector extension is NOT created here. That is the next lesson.
EOF
```

### 4.4 `pgvector/.env.example`

```bash
# 课里只用到了下面这个连接串；数据库、用户、密码都是 postgres
PGVECTOR_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

---

## 5. 逐行解释

**`chunk_size=400, chunk_overlap=50`。** 这是讲师在 P58 里明确念出的两个数字。`chunk_size` 决定每块最多多长，`chunk_overlap` 决定相邻块重叠多少字符。为什么必须有 overlap？因为递归分块最终可能还是要在字符层面切一刀，重叠区保证被切断的句子至少在一块里是完整的。P57 的 80/20 规则里说的“递归分块加好的重叠”，指的就是这个 overlap。注意 P57 参考表给一般文档建议 500–1000，而 P58 的实验为了看清差异故意设成 400；两者不矛盾，一个是生产建议值，一个是教学用的偏小值。

**`separators=["\n\n", "\n", ". ", ", ", " ", ""]`。** 这个列表就是 P57 讲的“按偏好顺序在自然边界切分”。顺序是有意义的：先试双换行（段落边界），不行再试单换行，再试句号加空格（句子结束），再试逗号（从句），再试空格（单词），最后才是空字符串（纯字符切分，也就是 P57 说的“最后手段”）。逐字稿里这个词被语音识别成了 “comments”，第 5 个位置按上下文只能是逗号，不可能是注释——这个纠正必须写出来，否则读者照着字面写 `comments` 会直接报错。

![p058 03:53 语义分块器参数与 percentile 阈值设置](images/p058_0233s.jpg)

**`SemanticChunker(embeddings=..., breakpoint_threshold_type="percentile", breakpoint_threshold_amount=90)`。** 这是 P58 的核心参数组。第一个参数是 embedding 模型，语义分块必须能嵌入句子；`breakpoint_threshold_type="percentile"` 表示“用百分位确定切分点”；`breakpoint_threshold_amount=90` 表示“在相似度分布的第 90 百分位切”，也就是只有相似度掉得比较狠的地方才切，切点会比较少、块会比较大。这正是实验里语义分块只出 3 块、而递归出 4 块的原因之一。如果把 90 调低，比如 50，切点会变多，块会变碎。

**为什么语义分块会出现“主题混合”。** 这是 P58 最值得记住的一段。语义分块的判据是 embedding 相似度，不是标题。rate limiting 和 error handling 两节都在讲 API 响应（429、Retry-After、状态码、错误 JSON），向量空间里天然靠近，所以第 90 百分位那条线没有落在它们之间，两块被并成一块。讲师的原话是“它完全按设计工作，只是设计的目标不是保持主题分离”。理解这一点，你就不会在面试或评审里把语义分块当成无条件正确的选项。

**为什么同一份文档上递归反而赢。** 实验文档是带 Markdown 标题的结构化文档，每个 `##` 就是一个天然语义边界。递归分块的 `\n\n` 分隔符恰好落在标题前面，等于免费拿到了人工标注好的切分点。而语义分块看见的是向量距离，看不见 `## Webhooks` 这个字符串是个“章节开始”的信号。所以讲师结论是：结构良好的文档用递归，流动的无标题长文才用语义。这是 P58 从“理论”变成“工程判断”的关键一句。

**`smart_chunker` 为什么是“语义为主、递归兜底”。** 讲师给的四个关键点是：语义为主、语义失败递归兜底、验证块大小、优雅处理错误。代码里四条一一对应：`use_semantic` 布尔参数控制主路径；`except Exception` 捕获模型调用失败；`_validate_chunks` 丢掉空块和过短碎片；`if not text.strip(): return []` 和最后的 `raise ValueError` 处理边界。注意兜底不只是 catch 异常——语义分块“成功返回但结果不可用”（比如全是 3 个字符的碎片）同样要降级，所以代码在 `chunks` 为空时也走 fallback。这个细节课里只说“如果语义失败”，具体失败包括哪几种，本文按工程需要补齐了。

**Chroma 的 `collection_name` 和 `persist_directory`。** 讲师建了两个向量库，一个给递归、一个给语义，集合名不同、目录不同。这一步的目的是让两套结果物理隔离，检索时不会互相污染。如果你把两个 store 指向同一个目录同一个 collection，第二次 `from_documents` 会往同一个集合里追加，检索结果就变成两套块混在一起，实验结论会完全乱掉。这不是理论问题，是第一次跑就会撞上的问题。

**为什么检索测试用 `k=1`。** 讲师在 P58 的检索对比里每次只看最相关的一条，因为文档只有 3–4 块，看第一条就足够判断“有没有命中正确主题”。生产环境当然不会用 k=1，一般 k=4 到 k=10 再 rerank。这里保持 k=1 是为了复现讲师屏幕上的输出形态。

**Docker 的 `docker --version` 和 `docker ps`。** 这是 P60 的第一步验证，讲师强调“不管你在哪台机器上，都要先验证装好了并且在跑”。`docker --version` 证明 CLI 存在，`docker ps` 证明 daemon 在跑。这两个是不同层面的检查——只跑前一条，Docker Desktop 没启动时你会在下一步 `docker run` 时看到 “Cannot connect to the Docker daemon”。

![p060 01:17 讲师演示 docker --version 与 docker ps 验证](images/p060_0077s.jpg)

**`chmod +x setup.sh` 再 `./setup.sh`。** P60 里讲师先做这一步才运行脚本，逐字稿原话是“先确保这个文件可执行”。在 macOS/Linux 上不给执行位，`./setup.sh` 会报 Permission denied。Windows 上这步不适用，直接 `bash setup.sh` 即可。

**`-p 5432:5432` 和 `postgres/postgres`。** 端口映射让宿主机的 5432 连到容器的 5432，这样 `psql -h localhost` 才能连上。密码是讲师在终端里当场输入的 `postgres`，屏幕上明文可见。这是教学环境，生产环境必须换成强密码并从环境变量或 secret manager 注入——讲师没有展开讲这一点，本文在第 7 节标注。

**`select version();` 返回 `PostgreSQL 16.13`。** 这条命令是验证“容器里的数据库真的起来了”。讲师屏幕上显示 16.13，镜像标签 `pg16` 对应 PostgreSQL 16 系列，小版本会随镜像更新变化，所以你的输出可能是 16.14 或更高，以实际输出为准。

**P59 的 ACID 事务，在前端/Node 里对应什么。** P59 讲 PGVector 第三个优势是“向量数据和关系数据在同一事务里更新”：更新用户资料的同时更新他的 embedding，要么都成功要么都失败。在 Node 里这件事对应 `pg` 客户端的 `BEGIN / COMMIT / ROLLBACK`，或者 Prisma 的 `prisma.$transaction([...])`、Drizzle 的 `db.transaction(async (tx) => {...})`。如果你用 Pinecone 这类独立向量库，就需要自己写“调用数据库 → 调用向量库 → 失败时补偿回滚”的逻辑，分布式事务的复杂度立刻上来了。这就是为什么讲师把 ACID 单独列成一条理由，而不是并进“成本”里说。

![p058 09:05 递归与语义分块在四个查询上的检索结果对比](images/p058_0545s.jpg)

**P59 的成本对比 25 美元 vs 150 美元。** 讲师的原话是“这只是低端估算”，PGVector 每月约 25 美元、Pinecone 约 150 美元，约 6 倍差。这个数字不能当成报价单用，它是一个量级判断：你已经在付 PostgreSQL 的钱，加一个扩展是边际成本；而独立向量库是新增账单，外加新增运维。讲师强调“即使预算健康，能不多花钱也不会多花钱”，这句话是说给企业决策者听的。

**P59 什么情况下不该用 PGVector。** 三条边界必须记住：数十亿级向量用 Milvus / Qdrant（扩展性更好）；需要大规模亚毫秒延迟要另选；团队完全没有 PostgreSQL 经验也别硬上。讲师最后一句是“对 90% 的 RAG 应用，PGVector 是正确选择”——注意是 90%，不是 100%。

**P60 为什么这一节不建扩展。** 讲师明确说“现在还没有 PGVector，因为它是个扩展，我们下一节再加”。所以 P60 的验收标准只有一条：`psql` 连上、`select version();` 出结果。如果你在这里顺手执行了 `CREATE EXTENSION vector;`，不算错，但就跳过了下一节的第一步，后面的验证顺序会对不上。

---

## 6. 复现检查清单

Python 分块实验部分：

- [ ] `uv add` 五个包全部成功：`langchain`、`langchain-openai`、`langchain-chroma`、`langchain-experimental`、`chromadb`（外加 `python-dotenv`）。
- [ ] 项目根目录有 `.env`，里面 `OPENAI_API_KEY` 非空。
- [ ] `chunking/semantic_chunking.py` 能 `uv run python chunking/semantic_chunking.py` 跑通，不报 import 错。
- [ ] 输出里有 `RECURSIVE ... total_chunks=` 和 `SEMANTIC ... total_chunks=` 两行。
- [ ] 递归分块块数 ≥ 语义分块块数（本文示例文档下通常是 4 vs 3；如果你的文档不同，数字会变，不必强行对齐）。
- [ ] 能在语义分块的某一块里看到两个主题被合并（rate limiting + error handling），这是预期现象，不是 bug。
- [ ] 四个查询各打印两次结果（recursive / semantic），每查询至少一条 result。
- [ ] `chunking/chroma_recursive` 和 `chunking/chroma_semantic` 两个目录已生成。
- [ ] 重跑前删掉这两个目录，否则 Chroma 里会重复追加。
- [ ] `chunking/production_ready.py` 能跑通，`use_semantic=True` 和 `False` 两条路径都打印了块数。
- [ ] 把 `OPENAI_API_KEY` 临时改错，确认 `smart_chunker` 打印 `[smart_chunker] semantic failed, fallback to recursive:` 并仍返回块——这验证了兜底逻辑真的生效。

PGVector Docker 部分：

- [ ] `docker --version` 有输出，说明 CLI 装了。
- [ ] `docker ps` 不报 “Cannot connect to the Docker daemon”，说明 Docker Desktop 已启动。
- [ ] `chmod +x pgvector/setup.sh` 执行成功，`./pgvector/setup.sh` 能跑。
- [ ] 首次运行输出里出现本地找不到镜像、随后拉取 layers 的过程。
- [ ] `docker ps` 能看到 `pgvector` 容器处于 Up 状态，端口映射 `0.0.0.0:5432->5432/tcp`。
- [ ] `psql -h localhost -U postgres -d postgres` 输入密码 `postgres` 后能进交互界面。
- [ ] `select version();` 返回 `PostgreSQL 16.x`，以实际输出为准。
- [ ] 退出 psql 用 `\q`。
- [ ] 没有在这一步执行 `CREATE EXTENSION vector;`（那是下一节）。
- [ ] 如果本机 5432 已被占用，容器起不来；改宿主机端口（如 `-p 5433:5432`）并同步改连接串。

---

## 7. 课里没讲但你会撞上的

**1. `langchain-experimental` 的版本兼容。** 讲师只说“要装这个包，因为有些 API 还在 experimental 阶段”。实际上 `SemanticChunker` 在不同 `langchain` 大版本间签名变过（`breakpoint_threshold_type` 的取值集合、`embeddings` 参数名都调整过）。如果你装出来的 `langchain` 是很新的版本而 `langchain-experimental` 停在旧版，import 会失败或参数不认。解决办法：保留 `uv.lock`，或者按报错信息把两个包对齐到同一代版本。课里没讲具体版本，本文也不编造版本号。

**2. 语义分块会消耗 OpenAI 额度。** 语义分块要对每个句子调一次 embedding。讲师说语义分块“速度更低、后台计算更多”，但没说这直接等于花钱。一份长文档可能几百次 embedding 调用，第一次跑的读者很可能被账单或 rate limit 吓到。生产上要么缓存句子 embedding，要么用本地 embedding 模型。课里没讲缓存策略。

**3. Chroma 持久化目录重复追加。** 前面提过，这里再强调一次：`Chroma.from_documents` 是“写入”，不是“覆盖”。同一个 `collection_name` 加同一个 `persist_directory` 跑两次，集合里就有两份文档，`similarity_search` 会返回重复块，看起来像“检索质量突然变好/变差”。重跑前 `rm -rf chunking/chroma_recursive chunking/chroma_semantic`。课里没讲这一点。

**4. `psql` 可能根本没装。** P60 讲师直接用 `psql` 连库，但没有说明这个客户端从哪来。Docker Desktop 默认不带 `psql`。macOS 上 `brew install libpq` 后还要把 `$(brew --prefix libpq)/bin` 加进 PATH，或者用 `brew install postgresql` 连带装上。更省事的替代是用容器里的客户端：`docker exec -it pgvector psql -U postgres -d postgres`。课里没讲。

**5. 5432 端口冲突。** 如果本机已经跑着另一个 PostgreSQL（很常见，`brew services start postgresql` 之后默认就占 5432），`docker run -p 5432:5432` 会报端口被占用。改映射到 5433，连接串同步改成 `postgresql://postgres:postgres@localhost:5433/postgres`。课里没讲。

**6. `CREATE EXTENSION vector;` 会失败。** 这是下一节的内容，但很多人会提前试，然后拿到 `ERROR: could not open extension control file`。原因通常是你用了官方 `postgres:16` 镜像而不是 `pgvector/pgvector:pg16` —— 普通 PostgreSQL 镜像里没有 pgvector 的扩展文件，光执行 `CREATE EXTENSION` 是装不上的。讲师在 P60 说“我们还没有 PGVector”，隐含的前提正是他用的镜像是带扩展的 pgvector 镜像。课里没解释这层因果关系，但这是最容易踩的坑。

**7. 教学密码 `postgres/postgres` 不能进生产。** 讲师在终端当场输入明文密码。这在本地演示里没问题，但如果你把这个 `setup.sh` 直接搬进预发/生产，等于把数据库敞开。生产上至少要：密码从环境变量或 secret manager 读取，不要写进脚本；不要 `-p 5432:5432` 暴露到公网，走内网或 SSH 隧道；加 volume 做数据持久化，否则 `docker rm` 一次数据全没。课里全程没讲持久化和安全。

**8. `setup.sh` 没有数据卷。** 本文的脚本故意没写 `-v`，和讲师演示保持一致（他重建容器时数据是空的）。如果你开始往里灌真实数据，必须加 `-v pgvector_data:/var/lib/postgresql/data`，否则容器一删，向量数据一起消失。课里没讲。

**9. 语义分块"更好"不是定理。** P58 的实验结论非常反直觉：同一份结构化文档上，递归 4 块全部主题纯净，语义 3 块里有 1 块混合。讲师本人说“这是很好的教学时刻”。所以做技术选型时不要背结论，要跑自己文档上的 retrieval 评测。讲师给的 80/20 规则——先递归、测质量、不够再升级语义——就是为此设计的。课里给了方法论，但没给具体的评测指标代码（recall@k、MRR 等），这部分要自己补。

**10. Late chunking 目前不是能直接抄的选项。** P57 讲了 late chunking 的 10–12% 提升和“未来”定位，但明确说“不是所有 embedding 模型都支持”，需要 Jina Embeddings v2 这类模型。这意味着你现在在 LangChain 里找不到一个叫 `LateChunker` 的开箱即用类。想试要自己实现“整篇 embed → 按 token 边界池化成块向量”的流程。课里没讲实现细节。

**11. `smart_chunker` 的兜底不等于质量兜底。** 代码里语义失败会降级到递归，但降级后检索质量会变——你可能在语义成功时测出 recall 0.85，某天 OpenAI 超时降级成递归，recall 悄悄掉到 0.7，而日志里只有一行 print。生产上要把“是否降级”打成指标，不要让它静默发生。课里没讲可观测性。

**12. 前端背景的一个提醒。** 这套东西里唯一和“并发/事务”沾边的是 P59 的 ACID 那条。你在 Node 里写 `db.transaction` 时，向量列的写入和业务列的写入必须在同一个 `tx` 对象上，不要一个用 `tx`、一个用全局 `db`，否则事务压根没包住两件事。这和 Prisma/Drizzle 里常见的事务误用是同一个坑，只是这里多了一列 `vector`。课里没讲具体代码。
**13. 逐字稿里被语音识别打乱的产品名，不要照着搜。** 这段逐字稿有好几处识别错误，照着搜会找不到东西：`laid chunking` / `lay chunking` / `late chunking` 指的是同一个东西 **late chunking**；`length chain` / `Elension` / `Lension` 是 **LangChain**；`Jaina embedding v2` 是 **Jina Embeddings v2**；`melvis` / `Malvis` 是 **Milvus**；`quadrant` 是 **Qdrant**；`Viviet` 是 **Weaviate**；`PJ Vector` 是 **PGVector**；`H and SW indexes` 是 **HNSW 索引**。P60 里 `brew install dash dash cast Docker` 是 `brew install --cask docker` 被念出来的样子，`PGVector16` 对应镜像标签 `pg16`。还有 P59 那句 “Snowflake acquired a vector company that breaks added vector support”，`breaks` 大概率是某家数据平台的品牌名被听错，但逐字稿没有字幕可对照，本文不替它下结论——你只需要记住讲师说的是“Snowflake 收购向量公司并加入向量支持，三大云都把 PGVector 加到托管 PostgreSQL 里”这个事实层面。

**14. P58 里 `chunk_size` 那串数字是口误，不是三个参数。** 逐字稿原文是 “we say chunkings 400, overlap is 550, let's just say 50.500”，听上去像 400 / 550 / 50 / 500 四个数。结合上下文和后面打印出来的“fixed size 400 character”，实际只有两个参数：`chunk_size=400`、`chunk_overlap=50`。如果你真按 550 的 overlap 去配，`RecursiveCharacterTextSplitter` 会直接报 overlap 不能大于 chunk_size。这是复现时最容易卡住的一处，必须先纠正再动手。

**15. HNSW 只出现了名字，参数一个都没讲。** P59 说 2023–2024 年 “HNSW 索引到来，意味着性能提升”，这是 PGVector 成熟的标志之一。但 `m`、`ef_construction`、`ef_search` 这些索引参数，以及 `ivfflat` 的 `lists`、`probes`，本段四节课里全都没出现。讲师在 P59 结尾的目录里说这一节会讲“如何选择正确的索引”，但那属于后面的课。所以你在 P60 之后直接去建 HNSW 索引会没有任何参考值——课里没讲，别在本文档里找。同理，距离度量（cosine / l2 / inner product）课里也没讲，`vector` 列要不要带维度、`CREATE INDEX` 用什么 `ops` 类，全都留到下一节。

**16. `psql` 客户端和服务端的大版本要对得上。** 容器里是 PostgreSQL 16，如果你本机 `psql` 是 14 甚至更老，连上去可能报协议或认证相关的错。P60 讲师没遇到这个问题，因为他本机客户端就是新的。撞上时的排查顺序：先 `psql --version` 看客户端版本，低于 16 就升级，或者干脆用容器内的客户端 `docker exec -it pgvector psql -U postgres -d postgres` 绕开宿主机环境。这条纯属环境差异，课里没讲。

**17. Windows 上 `chmod +x` 是空操作，而且 CRLF 会让脚本直接崩。** P60 的流程是 `chmod +x` 再 `./setup.sh`，这只在 macOS / Linux 成立。Windows 上应该 `bash pgvector/setup.sh`，或者在 Git Bash / WSL 里跑。更隐蔽的坑是换行符：如果脚本是从网页复制粘贴到 Windows 编辑器再保存，文件会带 CRLF，运行时报 `bash: $'\r': command not found`，报错行号还很莫名。解决办法是 `dos2unix setup.sh`，或者编辑器里把行尾切成 LF。课里没讲，但这是 Windows 读者 100% 会遇到的第一道坎。

**18. Docker Desktop 在企业环境要 license。** 讲师让你装 Docker Desktop，但没提它在较大规模的企业里是付费订阅制。如果你在公司机器上照着装，可能撞上合规问题，替代方案是 Colima、Podman 或者公司统一发的容器运行时。P60 说“这是关于容器化，不是关于 Docker”，所以运行时换掉不影响这套流程——只要 `docker` 命令还在。课里没讲。

**19. Apple Silicon 上的镜像架构。** M 系列 Mac 默认拉 arm64 镜像。`pgvector/pgvector:pg16` 有 arm64 版本，所以讲师演示顺利；但如果你后面换成别的第三方 PG 镜像，可能只有 amd64，Docker 会走模拟层，慢到让你怀疑人生。撞上时用 `docker image inspect <image> --format '{{.Architecture}}'` 看一眼，必要时加 `--platform linux/amd64`。课里没讲。

**20. 容器不是“起来就完事”，它还会停。** 讲师演示到 `docker ps` 看到 Up 就结束了。实际上你重启电脑后容器是停止状态，需要 `docker start pgvector` 拉起来，`docker ps -a` 能看到已停止的容器。如果你按本文脚本重跑，脚本会先 `docker rm -f` 再重建——**所有数据会丢**，这也是第 8 条说必须加 volume 的原因。日常开发建议改成“已存在就 start，不存在才 run”，脚本里那段 `docker ps -a | grep` 就是给你改这个逻辑用的钩子。课里没讲。

**21. `.env` 必须进 `.gitignore`。** 本文让你把 `OPENAI_API_KEY` 写进 `.env`，但没提这件事。第一次 `git add .` 就把 key 提交上去、然后被人扫到刷爆额度的案例每年都有。项目一开始就加：

```bash
printf '.env\n.venv/\n__pycache__/\nchunking/chroma_recursive/\nchunking/chroma_semantic/\n' >> .gitignore
```

Chroma 的两个持久化目录也不该进版本库，它们是几百 MB 的二进制索引。课里没讲。

**22. 检索对比只看 `k=1`，等于没有评测。** P58 用四个查询、每次看最相关一条，够说明教学问题，但不足以支撑选型。真要做决策，至少要有：一个 20–50 条的查询集、每条标注哪些块算“命中”、然后算 recall@k 和 MRR。讲师给的 80/20 规则里那句“测你的检索质量”，指的就是这件事，但具体指标和代码课里没给。前端背景的读者如果不想自己写，可以先用 `ragas` 这类评测库，但注意它是独立工具，讲师全程没提过。课里没讲。

**23. 语义分块在中文文档上的行为，本段完全没有覆盖。** 讲师用的示例文档是英文 Markdown，`SemanticChunker` 默认按句子切，英文句号识别没问题；中文标点（`。`、`！`）能不能被正确当成句子边界，取决于分句器的实现。你的文档如果是中文，第一次跑务必先看打印出来的块内容，确认没有被切在句子中间。这不是“更好或更差”的问题，是“有没有按预期切”的问题。课里没讲。

**24. `text-embedding-3-small` 的向量维度课里没提。** 后面建表时 `vector(N)` 的 N 从哪来，是下一节要解决的事。本段四节课里既没写维度数字，也没写 `text-embedding-3-small` 支持维度裁剪的参数。所以本文不给这个数字——按 OpenAI 模型文档确认，别凭印象填。同理，P58 的 Chroma 存储不需要你手动指定维度，`from_documents` 会按实际向量长度建集合，这也是为什么这段实验能跑通而不涉及表结构。

---

## 勘误：4.1 节 `semantic_chunking.py` 中段有一处代码围栏错位

上面第 4.1 节的代码块在中段被一条多余的 ` ```python ` 打断，并且 `recursive_docs = to_documents(` 这一行重复出现了两次，直接复制会得到语法不完整的文件。把那一小段替换成下面这 6 行即可（其余部分不动）：

```python
    recursive_chunks = recursive_splitter.split_text(SAMPLE_DOCUMENT)
    recursive_docs = to_documents(recursive_chunks, "recursive")

    # 讲师参数：SemanticChunker 来自 langchain_experimental.text_splitter，
    # 传入 embeddings，breakpoint_threshold_type="percentile"，
    # breakpoint_threshold_amount=90，即在相似度第 90 百分位切分。
```

替换后整个文件应当只有一个 `recursive_docs = to_documents(...)` 赋值、一个 `semantic_docs = to_documents(...)` 赋值，且从 `from __future__ import annotations` 到 `if __name__ == "__main__":` 之间没有任何多余的围栏标记。改完先跑 `uv run python -c "import ast,pathlib; ast.parse(pathlib.Path('chunking/semantic_chunking.py').read_text())"`，不报错再执行主流程——这条自检命令课里没讲，但它能在你调 OpenAI 之前就把语法问题挡掉，省一次调用。