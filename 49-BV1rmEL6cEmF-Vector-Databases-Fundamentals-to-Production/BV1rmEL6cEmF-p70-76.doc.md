# Vector Databases Fundamentals to Production：从本地 PGVector 到 Supabase 生产部署与混合检索（P70–P76）

> 本段课程（P70–P76）的主线是：**收尾索引选型 → 三条上云路径对比 → 在 Supabase 上开通 PGVector → 用 LangChain 连上云端 PGVector 跑通 RAG → 讲清向量检索的失效场景 → 用 BM25 + 向量 + RRF 手写混合检索**。下面按“能照着跑起来”的标准组织。

---

## 1. 这一节做什么

这一段是整门课的“落地段”。前面几节你在本地用 Docker 起了 PGVector、建了表、跑了相似度查询；这一段要解决三件事：

1. **把索引选型定下来**：HNSW 还是 IVF Flat，什么时候干脆不建索引。
2. **把本地代码搬到云上**：对比 Supabase / Neon / AWS RDS 三条生产路径，实际在 Supabase 免费层开通 PGVector 扩展，拿到连接串，用 LangChain 的 `PGVector` 向量库把文档写进去、做相似度检索、跑一个最小 RAG。
3. **补上向量检索的短板**：讲清向量检索在“产品型号、缩写、错误码、人名”这类**无语义的精确字符串**上会彻底失败，然后用 BM25 + 向量检索 + Reciprocal Rank Fusion（RRF）手写一个混合检索器，并给出生产注意事项（BM25 不支持增量更新、权重调参、K 值、延迟）。

最终你会得到两个可直接运行的文件：`prod_hybrid_search.py`（混合检索）和 Supabase 版的 `03_production_example.py`（云端 RAG）。**注意：P76 里讲师明确说 LangChain 已经把 `EnsembleRetriever` 从 SDK 里移除了，所以最终生产版是他自己手写的 RRF 算法**——这一点必须照做，否则你跑不起来。

---

## 2. 讲师原话

> "HNSW 内部就是这种分层图导航，顶层稀疏、底层稠密。它查询快、精度高、对更新处理得好，但内存占用大得多。IVF Flat 则是聚类，构建时用我们讲过的质心生成聚类向量，内存占用更低、索引构建更快，但数据变化时需要重建。这就是取舍。"
> —— p070 [00:00]

> "如果你有不到 10,000 个向量，那就不需要建索引，直接用你一直在做的方式就行。HNSW 通常是默认该用的索引。内存紧张时选 IVF Flat。最重要的是，永远用你自己的数据去测，因为基准测试可能是骗人的。"
> —— p070 [00:49]

> "Supabase 是推荐的那一个，因为他们有免费层，是真的免费。Pro 是每月 25 美元，你能拿到很多东西——录制这个视频时，Pro 层大约给你 8GB 数据库，当然包含 PGVector，还有很多其他东西，很划算，而且全是云上的。"
> —— p071 [00:29]

> "Neon 是基于 serverless 的云数据库基础设施。他们有 512MB 存储的免费层，Pro 大约每月 19 美元，而且可以缩容到零，也就是空闲时能省钱。如果你负载是波动的，Neon 是个不错的起点。"
> —— p071 [01:18]

> "AWS RDS 是给企业用的，起步价每月 60 美元。我们能租的中档实例大约每月 60 美元，小的是每月 30 美元。这是企业级、开箱即用的，什么都有。所以它显然是给已经在 AWS 或 Google Cloud 上的团队用的。"
> —— p071 [02:02]

> "这门课里你一分钱都不用花，因为他们有一个非常扎实的免费层，所以我要演示怎么连到 Supabase，把我们之前做的事一模一样地做一遍，让你看到全貌。"
> —— p071 [02:38]

> "这里非常重要：我可以在这里生成一个密码。它生成了密码，我要复制这个密码，因为你后面连接数据库时真的会需要它。"
> —— p072 [01:53]

> "直接连接适合有持久长连接的应用程序。事务池（transaction pooler）适合无状态应用，比如 serverless 函数，每次和 Postgres 的交互都很短、很隔离。会话池（session pooler）只建议作为直接连接的替代方案。"
> —— p072 [03:21]

> "数据库是 Postgres，用户是 Postgres，端口非常重要，是 5432，主机就是这个……所有这些信息其实都拼在这一条长命令里了。"
> —— p072 [04:18]

> "现在扩展这里，我要找 PGVector。它在这儿。我需要它，我们可以手动加，但我也可以直接从这里加。点这里启用扩展。"
> —— p072 [05:20]

> "要记住的一点是，我们需要在这里填密码。这个密码是什么？就是我们一开始创建并复制的那个数据库密码。这就是为什么我说你必须把那个密码存下来。"
> —— p072 [06:38]

> "如果你忘了数据库密码，很简单：去 Databases，然后 Settings，在这里可以重置密码。点 reset，你得重新生成密码再点 reset。你必须点 reset，然后复制新密码。"
> —— p072 [07:45]

> "所以现在因为我们配置了 Supabase，它应该会去用 Supabase 而不是本地。"
> —— p072 [07:59]

> "这个类叫 RAG service，是生产就绪的、基于 PGVector 的 RAG service。它不一定是优化过的 RAG 系统，但它是为了展示怎么用 Supabase 上托管在云端的 PGVector。"
> —— p073 [00:54]

> "这里有个很重要的点：BM25 不支持增量更新。所以加文档的时候你需要重建它。这就是为什么每次调用 add documents，你会看到我这里重新构建了 BM25 retriever。这在生产里非常非常重要。"
> —— p076 [09:47]

> "另外，调权重时从 50/50 开始，然后根据查询模式调整，并且要监控哪个检索器在贡献结果。"
> —— p076 [10:43]

> "K 值，也就是要检索的文档数，建议用 K=4，也就是你想检索 4 篇文档，然后让 RRF 去排序。"
> —— p076 [11:06]

> "混合检索会增加 20 到 50 毫秒延迟。延迟是大事，你必须把它算进去。而且你做混合检索时是两次搜索而不是一次，大多数情况下为了精度这是值得的。"
> —— p076 [11:21]

> "结果发现 ensemble retriever 这个依赖已经不在 LangChain 里了，但我通过自己写这个函数手动做完了全部事情，它做的和 ensemble retriever 完全一样。就是同一个算法。"
> —— p076 [05:29]

---

## 3. 从零复现

### 3.1 环境与依赖

课程用 `uv` 管理依赖（P76 里讲师执行的是 `uv add rank-bm25`）。如果你用 pip，等价命令写在括号里。

```bash
# 目录约定（与课程一致）
mkdir -p pgvector/06_supabase pgvector/07_hybrid_search
cd pgvector

# 初始化项目（若还没有）
uv init
uv venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 依赖（课程里出现过的全部）
uv add langchain langchain-openai langchain-postgres langchain-community \
       langchain-chroma psycopg[binary] python-dotenv rank-bm25

# pip 等价：
# pip install langchain langchain-openai langchain-postgres langchain-community \
#             langchain-chroma "psycopg[binary]" python-dotenv rank-bm25
```

版本说明：**课里没讲具体版本号**。`langchain-postgres` 提供 `PGVector`，`langchain-community` 提供 `BM25Retriever`，`rank-bm25` 是 BM25 的底层实现。`EnsembleRetriever` 在较新版本里已从 SDK 移除（讲师 P76 亲口说明），所以本文档按讲师做法**手写 RRF**，不依赖它。

环境变量文件 `.env`（放在项目根目录）：

```bash
# .env
OPENAI_API_KEY=sk-你的key

# Supabase 连接串（下面 3.3 会一步步拿到）
SUPABASE_DATABASE_URL=postgresql://postgres.你的项目ID:你的数据库密码@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# 本地 PGVector（前面章节 Docker 起的那个），用于回退
LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

### 3.2 第一步：把索引选型定下来（P70）

讲师给的决策表，直接照抄成你的选型依据：

| 条件 | 选择 | 理由（讲师原话要点） |
|---|---|---|
| 向量数 < 10,000 | **不建索引** | 直接暴力检索就够 |
| 默认情况 | **HNSW** | 查询快、精度高、更新友好，代价是内存 |
| 内存紧张 | **IVF Flat** | 内存占用低、构建快，但数据变化要重建 |
| 任何情况 | **用自己的数据测** | 基准测试可能是骗人的 |

![p070 00:26 讲师对比 HNSW 与 IVF Flat 的取舍：分层图 vs 聚类探测](images/p070_0026s.jpg)

HNSW 的“顶层稀疏、底层稠密”分层图结构，对应到代码里就是建索引时那几个参数（`m`、`ef_construction`）；IVF Flat 的“构建时用质心聚类”，对应 `lists` 参数。这一段课里只讲原理，**没有给建索引的 SQL**，建索引语句在更早的章节。

### 3.3 第二步：在 Supabase 开通 PGVector 并拿到连接串（P72）

按讲师的操作顺序，一步不落：

1. 打开 `supabase.com`，点 **Pricing** 看免费层：无限 API 请求、50,000 月活用户、**500MB 数据库**、5GB egress、5GB 缓存 egress、1GB 文件存储、社区支持，$0/月。Pro 是 $25/月（约 8GB 数据库），Team 是 $5.99/月（讲师口误说成 $5.99，页面上的 Team 价格以实际为准）。
2. 点 **Start for free**，用 Google 登录或填信息。
3. 创建组织（讲师命名为 `vector course`），保持 Personal，选 $0/月。
4. 创建项目：**生成数据库密码并立刻复制保存**——这是后面连接串里唯一要你手填的东西。
5. 选区域（讲师选 North Virginia）。
6. 勾选 **Enable Data API**，点 Create project。
7. 项目创建好后点 **Connect**，拿到：
   - **Direct connection string**（直连串）
   - **Project URL**
   - **Publishable key**
   - **CLI setup command**（讲师说“不必要，但一并拿走”）
8. 在 Connect 面板里选 **URI → PSQL**，会生成一条完整的 `psql` 连接命令。讲师强调：**数据库是 `postgres`，用户是 `postgres`，端口是 `5432`，主机就是面板上那个 host**，这些信息全都拼在那条长命令里。
9. 连接方式三选一（讲师原话解释见第 2 节）：
   - **Direct connection**：持久长连接的应用
   - **Transaction pooler**：无状态应用（serverless 函数），每次交互短且隔离
   - **Session pooler**：仅作为直连的替代方案
10. 左侧 **Database → Extensions**，搜索 `vector`，点 **Enable**，PGVector 扩展就装好了。

![p072 03:19 讲师在 Supabase Connect 面板选择连接方式（直连/事务池/会话池）](images/p072_0199s.jpg)

![p072 05:32 讲师在 Extensions 页面搜索并启用 PGVector 扩展](images/p072_0332s.jpg)

**拼连接串**（讲师在 P72 [06:38] 逐段拆解过）：

```
postgresql://postgres.<项目ID>:<数据库密码>@<host>:5432/postgres
```

- `<项目ID>`：已经在 Supabase 给你的 URL 里了，不用改
- `<数据库密码>`：**唯一需要你手动替换的**，去掉方括号，直接贴
- 端口必须是 `5432`，没有就补上

忘了密码怎么办（讲师 P72 [07:45]）：**Database → Settings → Reset password**，生成新密码后**必须点 reset**，然后复制新密码。

### 3.4 第三步：验证云端连接（P72 后半）

讲师写了一个连接测试脚本：连上 Supabase → 用 LangChain 建一个测试文档 → 写入 → 做一次相似度检索 → 删除该文档清理。跑通后他**故意再跑一次但不清理**，然后回 Supabase 的 Table Editor 里看到 LangChain 自动建的两张表：

- `langchain_pg_collection`（3 列）
- `langchain_pg_embedding`（5 列）

并且 Supabase 自动给它们建了索引。点进 `langchain_pg_collection` 能看到 `name = production_docs`；点进 `langchain_pg_embedding` 能看到那条测试文档的 embedding 和 metadata。

![p072 04:47 讲师从 Supabase 面板复制直连串与项目信息](images/p072_0287s.jpg)

### 3.5 第四步：跑云端 RAG（P73）

`03_production_example.py` 的结构（讲师逐段讲过）：

1. 一个 `@dataclass` 配置类：有 `SUPABASE_DATABASE_URL` 就用云，否则回退本地。
2. 集合名 `production_documents`。
3. 嵌入模型用 `text-embedding-3-small`，聊天模型用 `gpt-4o-mini`。
4. 检索参数：`search_k = 5`，`similarity_threshold = 0.5`。
5. `RAGService` 类：初始化 `PGVector`（传 embedding、collection name、connection string、`use_jsonb=True`）→ 用 LangChain 组 chain（retriever + prompt template + LLM + 输出转字符串）。
6. `add_documents()` 加 3 条测试文档；`search()` 带 metadata 过滤；`query()` 走 RAG 并返回 content / metadata / similarity score。

运行结果：打印 “Service is ready / Adding sample documents / Added 3 documents / Testing RAG”，然后对 “What is PGVector and how to use it?” 给出回答。回 Supabase 刷新，能看到 `production_documents` 集合和三条文档，metadata 里的 `topic`、`source` 都在。

![p073 02:23 讲师在 Supabase 表编辑器里查看 LangChain 自动创建的集合与嵌入表](images/p073_0143s.jpg)

**安全提醒（讲师 P73 [06:16] 特别指出）**：LangChain 建的表默认显示 “unrestricted — 任何人可通过 Data API 访问，因为 RLS 被禁用”。点 **View policies → Enable RLS**，两张表都要开。RLS 就是行级安全策略，**生产必须开**。

![p073 03:59 讲师为 LangChain 自动建的表启用 RLS 行级安全](images/p073_0239s.jpg)

### 3.6 第五步：理解向量检索为什么会失败（P75）

讲师列了四类真实生产失败场景，每一类都值得背下来：

| 失败类型 | 例子 | 为什么向量检索会挂 |
|---|---|---|
| 产品型号 / SKU | 查 `SQ7742X specs` | 型号对嵌入模型是无意义字符串，只会返回“规格”类文档，漏掉那一款 |
| 缩写 / 首字母 | 查 `WCAG compliance` | 模型不知道 WCAG = Web Content Accessibility Guidelines |
| 人名 / 精确名称 | 查 `John Smith accounting` | 语义会压过具体，返回“会计”和“叫 John 的人”，漏掉 John Smith 本人 |
| 错误码 / 技术标识 | 查 `ECONNREFUSED` | 纯字面串，需要精确匹配，嵌入模型没有概念 |

根因归纳成四条：无语义、模型不懂缩写、精确名称被语义覆盖、错误码只是字符。

**BM25 是“关键词冠军”**：它完全不理解语义，只数词。它擅长精确匹配、稀有词、代码和 ID；不擅长同义词和语义。所以——**一个漏的另一个补**，这就是混合检索。

![p075 02:52 讲师列举向量检索失效的错误码场景](images/p075_0172s.jpg)

**混合检索流水线**（讲师画的流程）：查询进来 → 分两路 → 向量检索出一份排名（doc3 第一、doc7 第二…）+ BM25 出一份排名 → 两路结果送进 **Reciprocal Rank Fusion** 融合排序 → 输出最终 1、2、3。关键洞察：**在两路里都排得靠前的文档会浮到顶部**；BM25 第一但向量里没出现的文档，可能输给两路都第三的文档。

![p075 03:55 讲师画出混合检索流水线：向量 + BM25 → RRF 融合](images/p075_0235s.jpg)

**什么时候用 / 不用混合检索**（讲师明确给了边界）：

- **用**：企业数据带代码和 ID、技术文档、法律文档、混合查询类型、精度至关重要的场景
- **不用**：简单问答机器人、创意写作助手、快速原型、时间敏感要极快的场景
- 结论：**生产环境有真实用户，就上混合检索**，精度提升值得那点复杂度

### 3.7 第六步：手写混合检索（P76）

这是本段最核心的可运行产物。讲师原计划用 `EnsembleRetriever`，但发现它已从 LangChain SDK 移除，于是**自己实现了等价的加权 RRF**。三个组件：

1. **向量检索器**：`vector_store.as_retriever(search_kwargs={"k": 3})`，负责语义理解。
2. **BM25 检索器**：`BM25Retriever.from_documents(docs, k=3)`，**不需要传 embedding**，它自己会算。
3. **融合**：手写 `reciprocal_rank_fusion()`，对两路结果按 `1/(k + rank)` 加权求和后重排。

权重语义（讲师 P76 [04:01] 讲得很清楚）：`weights=[bm25_weight, vector_weight]`。`[0.3, 0.7]` 偏语义；`[0.7, 0.3]` 偏代码/ID；**从 `[0.5, 0.5]` 起步**，再按查询模式调。

**生产铁律**：BM25 不支持增量更新，所以 `add_documents()` 里**每次都要重建 BM25 检索器**。讲师在最终生产版里就是这么写的。

![p076 04:23 讲师运行向量 / BM25 / 混合三路对比，展示每条查询的排名](images/p076_0263s.jpg)

实测结论（讲师逐条念了结果）：`SQ77 specifications` 向量和混合都对；`ECONNREFUSED` 向量第一正确、BM25 第一也正确、混合第一正确；`how do I authenticate` **BM25 彻底失败**（第一条是 WCAG，完全不相关），向量和混合都对；`WCAG compliance` 三者都对；`router configuration` 三者都对。总结：**向量懂语义、BM25 匹配精确词、混合两者兼得**；但 RRF 的数学意味着结果不总是两个列表的简单合并。

---

## 4. 完整代码

> 说明：以下代码按讲师在 P72/P73/P76 屏幕上展示的结构与函数名还原。**逐字稿没有逐字念出全部源码，OCR 也没有提供代码文本**，因此变量名、提示词文案等细节以讲师口述的结构为准；凡讲师明确说过的函数名（`RAGService`、`add_documents`、`search`、`query`、`reciprocal_rank_fusion`、`HybridRetriever`）均保留。可直接保存运行。

### 4.1 `pgvector/06_supabase/01_test_connection.py`（P72 连接验证）

```python
"""
Supabase PGVector 连接验证脚本。
流程：连接 -> 建测试文档 -> 写入 -> 相似度检索 -> 删除清理。
把 CLEANUP 改成 False 再跑一次，就能在 Supabase 表编辑器里看到留下的数据。
"""
import os
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from langchain_core.documents import Document

load_dotenv()

SUPABASE_DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")
LOCAL_DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")

# 有 Supabase 就用 Supabase，否则回退本地（对应讲师 "use local if supabase not configured"）
CONNECTION = SUPABASE_DATABASE_URL or LOCAL_DATABASE_URL
COLLECTION_NAME = "production_docs"
CLEANUP = True  # 想保留数据做检查时改成 False

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

vector_store = PGVector(
    embeddings=embeddings,
    collection_name=COLLECTION_NAME,
    connection=CONNECTION,
    use_jsonb=True,          # metadata 用 jsonb 存
)

print("Supabase Connection Test")
print("Connection:", "Supabase" if SUPABASE_DATABASE_URL else "Local")
# 只打印 host 部分，避免把密码打到日志里
print("Host:", CONNECTION.split("@")[-1].split("/")[0])

print("Running verification...")
test_doc = Document(
    page_content="This is a test document to verify Supabase.",
    metadata={"source": "connection-test", "topic": "verification"},
)

ids = vector_store.add_documents([test_doc])
print("Added test document:", ids)

results = vector_store.similarity_search("verify supabase connection", k=1)
print("Search hit:", results[0].page_content if results else "none")

if CLEANUP:
    vector_store.delete(ids)
    print("Cleaned up test document.")
else:
    print("Kept test document for inspection.")
```

### 4.2 `pgvector/06_supabase/03_production_example.py`（P73 云端 RAG）

```python
"""
生产就绪的 PGVector RAG service（Supabase 云端版）。
与本地版逻辑一致，只是连接串指向云端。
"""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_postgres import PGVector
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

load_dotenv()


@dataclass
class Config:
    connection: str
    collection_name: str = "production_documents"
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    search_k: int = 5
    similarity_threshold: float = 0.5


def build_config() -> Config:
    conn = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("LOCAL_DATABASE_URL")
    if not conn:
        raise RuntimeError("既没有 SUPABASE_DATABASE_URL 也没有 LOCAL_DATABASE_URL")
    return Config(connection=conn)


class RAGService:
    """生产就绪的、基于 PGVector 的 RAG service。"""

    def __init__(self, config: Config):
        self.config = config
        self.embeddings = OpenAIEmbeddings(model=config.embedding_model)
        self.llm = ChatOpenAI(model=config.chat_model, temperature=0)

        self.vector_store = PGVector(
            embeddings=self.embeddings,
            collection_name=config.collection_name,
            connection=config.connection,
            use_jsonb=True,
        )
        self.retriever = self.vector_store.as_retriever(
            search_kwargs={"k": config.search_k}
        )
        self.chain = self._build_chain()

    def _format_docs(self, docs):
        return "\n\n".join(d.page_content for d in docs)

    def _build_chain(self):
        prompt = ChatPromptTemplate.from_template(
            "Answer the question using only the context below.\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}"
        )
        return (
            {"context": self.retriever | self._format_docs,
             "question": RunnablePassthrough()}
            | prompt
            | self.llm
            | StrOutputParser()
        )

    def add_documents(self, docs):
        return self.vector_store.add_documents(docs)

    def search(self, query: str, metadata_filter: dict | None = None):
        """带 metadata 过滤的相似度检索，返回带分数的结果。"""
        return self.vector_store.similarity_search_with_score(
            query, k=self.config.search_k, filter=metadata_filter
        )

    def query(self, question: str):
        answer = self.chain.invoke(question)
        sources = self.search(question)
        return {
            "answer": answer,
            "sources": [
                {"content": d.page_content,
                 "metadata": d.metadata,
                 "score": score}
                for d, score in sources
            ],
        }


if __name__ == "__main__":
    service = RAGService(build_config())
    print("Service is ready")

    print("Adding sample documents...")
    docs = [
        Document(page_content="PGVector is Postgres extension for vector similarity search.",
                 metadata={"topic": "pgvector", "source": "docs"}),
        Document(page_content="PGVector stores embeddings in a Postgres column and supports HNSW and IVFFlat indexes.",
                 metadata={"topic": "indexing", "source": "docs"}),
        Document(page_content="Supabase provides hosted Postgres with the PGVector extension enabled.",
                 metadata={"topic": "supabase", "source": "docs"}),
    ]
    service.add_documents(docs)
    print(f"Added {len(docs)} documents")

    print("Testing RAG...")
    result = service.query("What is PGVector and how to use it?")
    print("Answer:", result["answer"])
    for s in result["sources"]:
        print("-", s["score"], s["metadata"])
```

### 4.3 `pgvector/07_hybrid_search/prod_hybrid_search.py`（P76 生产混合检索，最终版）

```python
"""
生产混合检索：BM25 + 向量检索 + 手写加权 RRF。
注意：LangChain 已移除 EnsembleRetriever，这里按讲师做法手写等价算法。
"""
import os
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document

load_dotenv()


def reciprocal_rank_fusion(result_lists, weights, rrf_k=60):
    """
    加权 Reciprocal Rank Fusion。
    result_lists: [[Document, ...], [Document, ...]]  每一路的有序结果
    weights:      [w_bm25, w_vector]                  与 result_lists 一一对应
    分数 = sum( weight_i / (rrf_k + rank_i) )
    """
    scores = {}
    doc_map = {}
    for results, weight in zip(result_lists, weights):
        for rank, doc in enumerate(results, start=1):
            key = doc.page_content
            doc_map[key] = doc
            scores[key] = scores.get(key, 0.0) + weight / (rrf_k + rank)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(doc_map[k], s) for k, s in ranked]


class HybridRetriever:
    """BM25 + 向量检索的混合检索器。"""

    def __init__(self, documents, embeddings, collection_name="hybrid_docs",
                 k=3, weights=(0.5, 0.5)):
        self.k = k
        self.weights = list(weights)  # [bm25_weight, vector_weight]
        self.documents = documents

        self.vector_store = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            collection_name=collection_name,
        )
        self.vector_retriever = self.vector_store.as_retriever(
            search_kwargs={"k": k}
        )
        # BM25 不需要 embedding
        self.bm25_retriever = BM25Retriever.from_documents(documents, k=k)

    def add_documents(self, new_docs):
        """BM25 不支持增量更新，必须重建。"""
        self.documents.extend(new_docs)
        self.vector_store.add_documents(new_docs)
        self.bm25_retriever = BM25Retriever.from_documents(self.documents, k=self.k)

    def search(self, query: str):
        vector_results = self.vector_retriever.invoke(query)
        bm25_results = self.bm25_retriever.invoke(query)
        return reciprocal_rank_fusion(
            [bm25_results, vector_results], self.weights
        )


if __name__ == "__main__":
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    docs = [
        Document(page_content="SQ7742X specifications: 12V input, 3A output, IP67 rated.",
                 metadata={"type": "sku"}),
        Document(page_content="XR9000 specifications: 24V input, 5A output, IP65 rated.",
                 metadata={"type": "sku"}),
        Document(page_content="WCAG 2.1 guidelines require text contrast ratio of at least 4.5:1.",
                 metadata={"type": "standard"}),
        Document(page_content="Error ECONNREFUSED means the target host actively refused the connection.",
                 metadata={"type": "error"}),
        Document(page_content="To authenticate, send a POST to /oauth/token with client credentials.",
                 metadata={"type": "auth"}),
        Document(page_content="Router configuration guide: set the gateway to 192.168.1.1 and enable NAT.",
                 metadata={"type": "network"}),
    ]

    hybrid = HybridRetriever(docs, embeddings, k=3, weights=(0.5, 0.5))

    queries = [
        "SQ7742X specifications",
        "ECONNREFUSED error",
        "how do I authenticate",
        "WCAG compliance",
        "router configuration",
    ]
    for q in queries:
        print(f"\n=== {q} ===")
        for doc, score in hybrid.search(q):
            print(f"{score:.4f}  {doc.page_content[:70]}")
```

---

## 5. 逐行解释

**`PGVector(..., use_jsonb=True)`**：让 metadata 以 Postgres 的 `jsonb` 类型存储，这样 `search()` 里的 `filter={"topic": "pgvector"}` 才能高效过滤。不设的话 metadata 走默认列，过滤能力受限。讲师在 P72 [08:29] 和 P73 [01:21] 两次强调这个参数。

**`connection=CONNECTION`**：`langchain-postgres` 接受连接串字符串，内部用 psycopg 建连接池。讲师在 P72 [06:38] 拆解过这个串的每一段——**你唯一要改的是密码**，项目 ID 已经在 Supabase 给的串里了。

**`as_retriever(search_kwargs={"k": 3})`**：把向量库包装成检索器接口，`k` 是返回条数。P76 里向量和 BM25 都取 `k=3`，最终生产建议 `K=4`（讲师 P76 [11:06]）。

**`BM25Retriever.from_documents(docs, k=3)`**：注意**没有 embedding 参数**——BM25 只统计词频和逆文档频率，不理解语义。这就是它能精确命中 `SQ7742X` 的原因，也是它面对 “how do I authenticate” 时把 WCAG 排第一的原因（词面碰巧有重叠）。

**`reciprocal_rank_fusion` 的公式**：`score = Σ weight_i / (rrf_k + rank_i)`。`rrf_k=60` 是 RRF 的常用平滑常数（**课里没讲这个常数的取值来源**，这里用通用默认值）。rank 从 1 开始。一个文档在两路里都排第 1，得分是 `0.5/61 + 0.5/61`；只在 BM25 排第 1、向量里没有，得分只有 `0.5/61`——**这就是“两路都靠前才浮顶”的数学原因**，也是讲师说“结果不总是两个列表简单合并”的原因。

**`weights=(0.5, 0.5)` 的顺序**：讲师 P76 [04:01] 明确说“BM25 在左、向量在右”，所以是 `[bm25_weight, vector_weight]`。`[0.3, 0.7]` 偏语义，`[0.7, 0.3]` 偏代码/ID。**从 50/50 起步**是讲师给的生产建议。

**`add_documents` 里重建 BM25**：这是全段最重要的生产细节。BM25 的统计量（文档频率、平均文档长度）是**在构建时一次性算好的**，新文档进来不会自动更新，所以必须 `BM25Retriever.from_documents(self.documents, ...)` 全量重建。讲师 P76 [09:47] 和 [10:15] 连说两遍“非常非常重要”。对比一下：向量库支持增量 `add_documents`，BM25 不支持——**在 JS/Node 里对应的是“内存索引需要重建”这类问题，不是数据库事务问题**。

**`Chroma.from_documents(...)`**：P76 里向量库用的是 Chroma（讲师 import 的是 `langchain_chroma`），不是 PGVector。混合检索这一节是独立 demo，用 Chroma 起本地库最快；生产里把 `Chroma` 换成 `PGVector` 即可，`as_retriever` 接口完全一样。

**`similarity_search_with_score`**：返回 `(Document, score)` 元组。注意不同向量库的 score 语义不同（距离 vs 相似度），**课里没讲 Chroma/PGVector 各自的分数方向**，跨库比较前先确认。

**RLS**：Supabase 里 LangChain 自动建的表默认 “unrestricted”，任何人可通过 Data API 访问。P73 [06:48] 讲师演示了 **View policies → Enable RLS**，两张表都要开。这是数据库层的行级权限，**不是应用层鉴权**，生产必须开。

---

## 6. 复现检查清单

- [ ] `uv add` 装齐 `langchain`、`langchain-openai`、`langchain-postgres`、`langchain-community`、`langchain-chroma`、`psycopg[binary]`、`python-dotenv`、`rank-bm25`
- [ ] `.env` 里 `OPENAI_API_KEY`、`SUPABASE_DATABASE_URL`、`LOCAL_DATABASE_URL` 三个都在
- [ ] Supabase 项目已建，**数据库密码已保存**
- [ ] 连接串格式 `postgresql://postgres.<项目ID>:<密码>@<host>:5432/postgres`，端口是 5432
- [ ] Supabase **Extensions 里 PGVector 已 Enable**
- [ ] 跑 `01_test_connection.py`，看到 “Connection: Supabase” 和 host，且检索命中
- [ ] 把 `CLEANUP` 改 `False` 再跑一次，回 Supabase Table Editor 能看到 `langchain_pg_collection`（3 列）和 `langchain_pg_embedding`（5 列），集合名 `production_docs`
- [ ] 跑 `03_production_example.py`，看到 “Service is ready / Added 3 documents / Testing RAG” 并拿到回答
- [ ] 回 Supabase 看到 `production_documents` 集合和三条文档，metadata 的 `topic`/`source` 都在
- [ ] **两张表都 Enable RLS**，表编辑器里不再显示 “unrestricted”
- [ ] 跑 `prod_hybrid_search.py`，五条查询都出结果；确认 `how do I authenticate` 这条 BM25 会翻车、混合能救回来
- [ ] 确认代码里**没有** `from langchain.retrievers import EnsembleRetriever`（已从 SDK 移除）
- [ ] 确认 `add_documents` 里**重建了 BM25Retriever**
- [ ] 权重从 `(0.5, 0.5)` 起步，按你的查询模式再调

---

## 7. 课里没讲但你会撞上的

1. **`EnsembleRetriever` 的导入路径**。讲师只说“已从 LangChain 移除”，没给具体版本号。如果你在旧教程里看到 `from langchain.retrievers import EnsembleRetriever`，在你装的版本上大概率 ImportError。本文档的手写 RRF 就是替代方案，**不要试图装回旧版 LangChain 去凑**。

2. **`rrf_k=60` 的出处**。课里没讲这个常数怎么来的，只说“加权 RRF”。60 是文献里的常用默认值，你可以调，但调之前先固定权重做对照实验。

3. **Chroma 与 PGVector 的 score 方向**。`similarity_search_with_score` 在不同后端返回的可能是距离（越小越好）也可能是相似度（越大越好）。课里没讲，跨库迁移时**先用一条已知答案的查询校准方向**。

4. **Supabase 连接池选型的坑**。讲师给了三种连接方式的适用场景，但没讲：serverless 环境（Vercel/Cloudflare Workers）用直连会耗尽连接数，必须用 transaction pooler；而 transaction pooler **不支持 prepared statements**，某些 ORM 要关掉预处理。你前端转过来部署到 serverless 平台时一定会撞上。

5. **`text-embedding-3-small` 的维度**。课里没讲维度数，但 PGVector 建表时列类型是 `vector(N)`，N 必须和模型维度一致。换嵌入模型 = 重建表 + 重灌全部向量，**不能原地改**。

6. **BM25 重建的成本**。讲师强调必须重建，但没讲数据量大时重建很慢。生产里常见做法是把 BM25 索引放内存、启动时构建、增量文档走“定期重建 + 新文档单独检索再合并”，或者换支持增量的搜索引擎（如 Elasticsearch/OpenSearch）。课里没讲这些方案。

7. **RLS 开了之后 LangChain 还能不能写**。讲师只演示了 Enable RLS，没讲策略怎么写。开了 RLS 但没建 policy，默认是**全部拒绝**，你的 `add_documents` 会失败。生产里要么给 service role 建 bypass policy，要么按用户建 policy——这部分课里没讲，得查 Supabase 文档。

8. **延迟预算**。讲师说混合检索增加 20–50ms，但没算嵌入 API 的往返时间。真实 RAG 的 P99 往往卡在嵌入调用上，混合检索那 20–50ms 反而不是瓶颈。做容量规划时把嵌入调用单独计时。

9. **迁移路径**。P74 [00:26] 讲师给了从 Pinecone 迁到 PGVector 的步骤：导出向量 → 建 pgvector schema → `COPY` 导入 → 重建索引 → 更新连接。但**没给具体 SQL 和导出脚本**，真迁移时这部分要自己写。

---

**附：本段引用的截图清单**

- `p070_0026s.jpg` — HNSW vs IVF Flat 取舍
- `p072_0199s.jpg` — Supabase 三种连接方式
- `p072_0287s.jpg` — 复制直连串与项目信息
- `p072_0332s.jpg` — 启用 PGVector 扩展
- `p073_0143s.jpg` — 表编辑器里查看 LangChain 自动建表
- `p073_0239s.jpg` — 为表启用 RLS
- `p075_0172s.jpg` — 向量检索失效的错误码场景
- `p075_0235s.jpg` — 混合检索流水线（向量 + BM25 → RRF）
- `p076_0263s.jpg` — 三路检索结果对比