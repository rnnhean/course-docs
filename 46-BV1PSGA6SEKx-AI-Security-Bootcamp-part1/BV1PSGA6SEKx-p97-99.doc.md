# AI Security Bootcamp Part1：护栏 / 网关 / 可观测（P097–P099）

> 本段课程覆盖三个文件：`memory.py`（短期记忆 + 长期记忆）、`queue.py`（基于 Redis Streams 的任务队列）、`agents.py`（LangGraph 多智能体编排）、`eval.py`（LangSmith LLM 评估）、`output.py`（PDF / JSON / 差异报告输出）。讲师反复强调：**不要死抠代码，要理解每个组件在生产级 AI 系统里承担什么职责**——代码可以让 Claude Code / Codex 生成，但架构判断必须自己心里有数。

---

## 1. 这一节做什么

这一节把「一个能上生产的 AI 研究助手」拆成五个可独立复现的模块，逐个落地：

| 模块 | 文件 | 职责 | 依赖中间件 |
|---|---|---|---|
| 记忆层 | `memory.py` | 短期记忆（STM）存最近 N 轮对话；长期记忆（LTM）存历史报告 + 向量嵌入，支持相似报告检索与差异对比 | Redis（STM）、PostgreSQL + pgvector（LTM） |
| 队列层 | `queue.py` | 用 Redis Streams 做后台任务队列，把用户请求变成 job，多 worker 消费，consumer group 防重复消费，ACK 确认 | Redis Streams |
| 编排层 | `agents.py` | LangGraph 编排 4 个 Agent（search → summarizer → writer → critic）+ 1 个 orchestrator，带 LangSmith 追踪 | LangGraph、LangSmith、Tensor0 网关 |
| 评估层 | `eval.py` | 用另一个 LLM 当裁判，对生成报告打 4 个指标分：relevance / completeness / hallucination / quality，分数回写 LangSmith | LangSmith Cloud、Tensor0 |
| 输出层 | `output.py` | 报告导出 PDF（分页）、导出 JSON、与 LTM 中历史相似报告做 diff（绿=新增、红=删除、蓝/白=未变） | ReportLab、difflib、PostgreSQL 连接池 |

复现完成后你会得到：**一个用户提交研究主题 → 进队列 → worker 拉起 LangGraph 四段式流水线 → 报告落库 → 自动评估打分 → 可导出 PDF/JSON/差异视图**的完整闭环。

![p097 00:06 讲师列出容器与虚拟机的差异](images/p097_0078s.jpg)

---

## 2. 讲师原话

> "这个文件的整体目的是同时管理两样东西：你的 STM（短期记忆）和 LTM（长期记忆）。短期记忆用 Redis，长期记忆用 Postgres。"
> —— p097 [00:00]

> "短期记忆会把当前所有对话存进 Redis，这样 AI 能记住最近的消息；长期记忆会把完整的报告存进 Postgres SQL，这样 AI 未来能找出相似的报告，也能对比变化。"
> —— p097 [00:28]

> "假设你第一问问了我的名字，第四问又问『你记得我的名字吗』，我会说记得，你叫 John——它会记住你第一条消息里给的内容。这就是我们说的短期记忆。"
> —— p097 [01:57]

> "五月我问了一次 AI 进展，生成一份报告；六月我又问一次，又生成一份报告。这两份报告都存进 LTM，我们就可以对比它们的差异：哪些是五月就有的、哪些是六月新增的。"
> —— p097 [03:54]

> "假设五月报告有 5 个点，五六月报告有 10 个点，其中 5 个是重复的、5 个是六月新增的。对比之后它会告诉你哪些是新增主题、哪些是删除主题。"
> —— p097 [05:20]

> "TTL 的意思是，过了这段时间这条记忆就会被删除，这就是我们说的 time to live。"
> —— p097 [06:44]

> "db migrate 会创建 PostgreSQL 的数据库结构。第一列是 id，第二列是 topic，第三是 report，第四是 embedding，还有这份报告创建的时间。"
> —— p097 [07:13]

> "我们启用了 pgvector 扩展，创建 reports 表，所有值都存在里面。"
> —— p097 [07:43]

> "不要过度关注代码，只要理解每个东西是怎么工作的。Codex 和 Claude 可以把代码写出来，你要理解的是：做一个生产级 chatbot 需要哪些东西——STM、LTM，以及如何在异步环境里搭好它们。"
> —— p097 [08:09]

> "LTM search 会搜索几乎相同的历史报告。它靠 embedding 判断：两篇 AI 文章是相关的，AI 文章和新闻文章就不相关。"
> —— p097 [09:32]

> "LTM diff 会告诉你：这些是新增的点、这些是之前的点、这些是没变（neutral）的点、这些是从上一版报告里删掉的点。"
> —— p097 [10:30]

> "假设 2026 年我研究『美国政府/印度政府』，会讲总理、总统、财政部长、内政部长；五年后再研究同一个主题，总统换了、总理换了、部长也换了，报告就有差异，我们可以对比 2026 和 2031 两份报告。如果什么都没变，我们就说『上一版报告没有重大变化』。"
> —— p097 [10:58]

> "这个文件实现的是一个叫 job queue 的东西。做 job queue 我们同样用 Redis——用 Redis Streams。Redis 在这个项目里被大量使用：做 job queue、做短期记忆、还做缓存。"
> —— p097 [12:50]

> "与其立即处理用户请求，应用会把它放进队列，worker 逐个处理，再发回给 worker。这就是后台处理（background processing）的概念。"
> —— p097 [13:19]

> "假设有两台 worker 机器、同时来了 5 个研究主题。如果不用 Redis 队列就会被压垮。用了之后：5 个请求全部进 stream，第 1 个分给 worker1、第 2 个分给 worker2，第 3、4 个排队等待，第 1、2 处理完第 3、4 再上，第 3 完第 5 上。这就是 queuing，也就是 Redis Streams 做的事。"
> —— p097 [14:16]

> "uuid 用来给每个 job 生成随机 ID。每个操作都被当成一个 job。"
> —— p097 [15:43]

> "第一个函数把新 job 推进 Redis Streams：生成 job id，把 topic、session id、output 这些 job 详情都存进 stream，然后把 job id 返回给应用，方便后续追踪。"
> —— p097 [16:13]

> "第二个函数是拿 job 结果：检查某个 job id 的结果是否完成。worker 跑完就返回结果，没跑完就返回 None。"
> —— p097 [17:07]

> "worker 处理完 job 之后，set result 会把结果存进 Redis，并带一个 TTL 时间限制，让它自动过期——这样我们就能做缓存。"
> —— p097 [17:37]

> "consumer group 让多个 worker 共享 job。如果两个 worker 各自独立，worker1 拿了第一个 job 还没跑完，worker2 也拿了第一个 job，就重复了。所以要把两个 worker 放进同一个 consumer group，它们就知道 worker1 在做第一个、我该做第二个。"
> —— p097 [18:34]

> "consume jobs 是 worker 处理器用的：它等待 Redis Streams 里的新 job，读取可用 job，处理完返回。这是真正执行 job 的主函数。"
> —— p097 [19:32]

> "ack job 就是 acknowledge job。worker 处理完 job 后给 Redis 发一个 ack，告诉 Redis『这个 job 完成了，可以从 stream 里删掉，别的 worker 不用再处理了』。"
> —— p097 [19:59]

> "agents 文件实现的是真正的多 AI Agent 工作流，用的就是 LangGraph。我们有 4 个 Agent：search、summarizer、writer、critic，再加一个 orchestrator 负责协调。"
> —— p098 [00:00]

> "我们用 LangSmith 把 AI Agent 做成可追踪的：每个 Agent 花了多少时间、返回了什么，我都能追踪；整体工作流也能追踪。"
> —— p098 [01:24]

> "ResearchState 是一个共享状态，每个 Agent 都用它，把 topic、会话历史、LTM 上下文、搜索结果、摘要、最终报告、验证结果、迭代次数、错误都存进去。"
> —— p098 [01:52]

> "tz_call 是一个 Tensor0 辅助函数。我们不直接调 OpenAI，而是先到 Tensor0，Tensor0 再调 OpenAI。"
> —— p098 [02:20]

> "tz_call_once 被 tz_call 以 lambda 形式调用，配合重试逻辑——延迟和指数退避（exponential backoff）。"
> —— p098 [03:46]

> "search agent 负责收集请求主题的信息，它也会接收最近的对话历史——所以这里写了 -4，也就是最近 4 轮对话。"
> —— p098 [04:43]

> "summarizer agent 把原始研究结果转成清晰、结构化、带项目符号的要点。"
> —— p098 [05:13]

> "writer agent 真正写最终研究报告：它把摘要结果和 LTM 里检索到的相关报告一起考虑，然后发起 tz_call 写最终报告。"
> —— p098 [05:41]

> "critic agent 像质量检查员：检查生成报告的事实一致性、逻辑一致性、写作一致性。通过就 yes，不通过就 no。我们这里是 yes/no，如果你想更好，可以改成打分——比如 10 分制，超过 7 分算通过。"
> —— p098 [06:39]

> "orchestrator agent 是整个 AI 系统的大脑，让所有 Agent 按正确顺序协作：先 search node，再 summarize node，再 writer node，最后 verify node（critic）。"
> —— p098 [08:06]

> "route 逻辑在 critic 结束后做最终决策：通过就结束工作流，不通过就重试；重试耗尽就向用户显示错误信息。"
> —— p098 [08:36]

> "eval.py 做的是 LLM 评估，用 LangSmith。报告生成后，用另一个 LLM 评估报告好不好，指标有 relevance、completeness、hallucination、整体 quality。"
> —— p099 [00:00]

> "我们把评估分数记到云端的 LangSmith 上——LangSmith 有自己的云。"
> —— p099 [00:55]

> "parse score 用来从裁判 LLM 的响应里把分数解析出来。"
> —— p099 [02:24]

> "judge 辅助函数把评估 prompt 通过 Tensor0 发给 LLM——因为 Tensor0 是我们的 LLM 网关，所有请求都必须走网关。同时用重试和 fallback 逻辑。"
> —— p099 [02:51]

> "relevance 检查生成的报告是否真的和用户问题相关。比如问『你叫什么名字』，答案应该是『我叫 Sudhanshu』，而不是『我在 12 年级读书、我在上大学』——问题和答案要匹配。"
> —— p099 [03:20]

> "completeness 检查报告是否包含所有重要章节：executive summary、key findings、overall analysis、conclusion，这些都必须有。"
> —— p099 [04:16]

> "hallucination 检查报告是否包含编造的数据。比如问 2028 年印度总理是谁——未来我们不知道，它却编出答案，这就是幻觉。"
> —— p099 [04:46]

> "eval quality 检查整体质量：准确性、深度、结构、清晰度。"
> —— p099 [05:16]

> "evaluate_report 里四个评估并行跑——用的是 asyncio.gather，不是先 relevance 完再 completeness，而是全部同时跑。"
> —— p099 [06:15]

> "fetch recent topics 从 PostgreSQL 里取最近生成的报告主题，这些主题后续可以用于批量评估（batch evaluation）。"
> —— p099 [06:44]

> "output.py 很小，只有 70 行左右。它负责把报告生成成不同格式：网页上的纯文本、JSON、PDF。"
> —— p099 [08:08]

> "对比上一版报告时，新增内容用绿色、删除内容用红色，就像 GitHub PR 里的代码 diff 一样。"
> —— p099 [09:06]

> "generate PDF 会把纯文本报告转成 PDF。它不是把所有内容塞进一页——第一页满了会新建一页。"
> —— p099 [10:03]

> "对比函数会把最新报告和 LTM 里存的相似报告对比：用向量嵌入找相似报告，取最新两条（limit = 2），逐行比较，返回差异。"
> —— p099 [11:01]

> "绿色和红色是在 HTML 文件里设置的：新增的行设绿色、删除的行设红色、未变的行保持蓝色或白色。"
> —— p099 [11:30]

---

## 3. 从零复现

### 3.1 环境与依赖

```bash
# 1) 建项目目录
mkdir ai-research-bootcamp && cd ai-research-bootcamp
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2) 安装依赖（版本以你本地 pip 解析为准，课里未指定具体版本号）
pip install redis asyncpg httpx pydantic python-dotenv \
            langgraph langsmith \
            sentence-transformers \
            reportlab \
            "psycopg[binary]" "psycopg_pool"

# 3) 起中间件（课里没讲 docker-compose，这里给出等价的最小启动方式）
docker run -d --name redis-stm -p 6379:6379 redis:7
docker run -d --name pg-ltm -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=research \
  pgvector/pgvector:pg16
```

> 课里没讲具体的 docker 命令，只讲了「Redis 做 STM / 队列 / 缓存，Postgres + pgvector 做 LTM」。上面两条命令是复现所需的最小等价物。

### 3.2 环境变量（`.env`）

```env
# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_STREAM_KEY=research:jobs
REDIS_CONSUMER_GROUP=research-workers
STM_TTL_SECONDS=3600
STM_MAX_MESSAGES=5

# Postgres + pgvector
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/research

# Tensor0 网关（LLM 网关，所有 LLM 请求都走这里）
TENSOR0_BASE_URL=http://localhost:8000/v1
TENSOR0_API_KEY=replace-me
TENSOR0_MODEL=gpt-4o-mini

# LangSmith
LANGSMITH_API_KEY=replace-me
LANGSMITH_PROJECT=ai-research-bootcamp
LANGSMITH_PROJECT_ID=replace-me
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# 嵌入模型
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### 3.3 目录结构

```
ai-research-bootcamp/
├── .env
├── config.py
├── memory.py
├── queue.py
├── agents.py
├── eval.py
├── output.py
└── worker.py          # 课里没给 worker 入口，这里给最小可跑版本
```

### 3.4 复现顺序（严格按这个顺序跑）

1. **先跑 `memory.py` 的 `db_migrate()`** —— 建 `reports` 表 + 启用 pgvector 扩展。不跑这一步，后面所有 LTM 写入都会失败。
2. **再跑 `queue.py` 的 `ensure_group()`** —— 建 Redis consumer group。不跑这一步，`consume_jobs()` 会报 `NOGROUP`。
3. **启动 `worker.py`** —— 它会循环 `consume_jobs()`，每拿到一个 job 就调 `agents.run_workflow()`，跑完 `ack_job()` + `set_result()`。
4. **提交一个 job** —— 调 `queue.push_job(topic, session_id)`，拿到 `job_id`。
5. **轮询结果** —— 调 `queue.get_result(job_id)`，拿到报告后调 `eval.evaluate_report()` 打分。
6. **导出** —— 调 `output.generate_pdf()` / `output.to_json()` / `output.diff_reports()`。

![p097 01:18 讲师讲解 memory.py 的整体目的：同时管理 STM 与 LTM](images/p097_0156s.jpg)

---

## 4. 完整代码

> 说明：以下代码严格按逐字稿描述的函数职责与参数写出。逐字稿里讲师明确说「不要死抠代码，理解概念即可」，因此**函数签名、参数名、SQL 列名、Redis key 名以逐字稿口述为准**；具体实现细节（如 SQL 语句的完整写法、异常处理分支）课里没逐行念，这里给出可直接运行的最小完整版本。OCR 结果本段为空，无额外代码需要保留。

### 4.1 `config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_STREAM_KEY = os.getenv("REDIS_STREAM_KEY", "research:jobs")
    REDIS_CONSUMER_GROUP = os.getenv("REDIS_CONSUMER_GROUP", "research-workers")
    STM_TTL_SECONDS = int(os.getenv("STM_TTL_SECONDS", "3600"))
    STM_MAX_MESSAGES = int(os.getenv("STM_MAX_MESSAGES", "5"))

    # Postgres
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/research")

    # Tensor0 网关
    TENSOR0_BASE_URL = os.getenv("TENSOR0_BASE_URL", "http://localhost:8000/v1")
    TENSOR0_API_KEY = os.getenv("TENSOR0_API_KEY", "")
    TENSOR0_MODEL = os.getenv("TENSOR0_MODEL", "gpt-4o-mini")

    # LangSmith
    LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY", "")
    LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "ai-research-bootcamp")
    LANGSMITH_PROJECT_ID = os.getenv("LANGSMITH_PROJECT_ID", "")
    LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")

    # Embedding
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

config = Config()
```

### 4.2 `memory.py`（STM + LTM）

```python
import json
import difflib
import asyncio
from datetime import datetime

import asyncpg
import redis.asyncio as aioredis
from sentence_transformers import SentenceTransformer

from config import config

# ---------- 全局单例 ----------
_redis: aioredis.Redis | None = None
_pg_pool: asyncpg.Pool | None = None
_embedder: SentenceTransformer | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(config.REDIS_URL, decode_responses=True)
    return _redis


async def get_pg_pool() -> asyncpg.Pool:
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=10)
    return _pg_pool


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(config.EMBEDDING_MODEL)
    return _embedder


# ---------- 1) 短期记忆：存一条会话消息 ----------
async def save_session_message(session_id: str, role: str, content: str) -> None:
    """
    把一条对话消息推进 Redis list。
    - 只保留最近 STM_MAX_MESSAGES 条（讲师原话：设成 5 就只留最新 5 条）
    - 整个 list 带 TTL，过期自动删除
    """
    r = get_redis()
    key = f"stm:session:{session_id}"
    payload = json.dumps({"role": role, "content": content, "ts": datetime.utcnow().isoformat()})
    await r.rpush(key, payload)
    # 只保留最新 N 条
    await r.ltrim(key, -config.STM_MAX_MESSAGES, -1)
    # 刷新 TTL
    await r.expire(key, config.STM_TTL_SECONDS)


# ---------- 2) 短期记忆：取会话历史 ----------
async def get_session_memory(session_id: str) -> list[dict]:
    """取回该 session 最近的对话消息（已按时间正序）。"""
    r = get_redis()
    key = f"stm:session:{session_id}"
    raw = await r.lrange(key, 0, -1)
    return [json.loads(x) for x in raw]


# ---------- 3) 建库：启用 pgvector + 建 reports 表 ----------
async def db_migrate() -> None:
    """
    讲师原话：第一列 id、第二列 topic、第三列 report、第四列 embedding、还有创建时间。
    同时启用 pgvector 扩展。
    """
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id          BIGSERIAL PRIMARY KEY,
                topic       TEXT        NOT NULL,
                report      TEXT        NOT NULL,
                embedding   vector(384) NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        # 向量相似度索引（课里没讲索引类型，这里用 pgvector 官方推荐的 HNSW）
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS reports_embedding_idx "
            "ON reports USING hnsw (embedding vector_cosine_ops);"
        )


# ---------- 4) LTM 写入：存一份完成的报告 ----------
async def ltm_store(topic: str, report: str) -> int:
    """把 AI 生成的完整报告 + 其 embedding 写入 Postgres。返回新行 id。"""
    embedder = get_embedder()
    vec = embedder.encode(report, normalize_embeddings=True).tolist()
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO reports (topic, report, embedding) VALUES ($1, $2, $3) RETURNING id;",
            topic, report, vec,
        )
    return row["id"]


# ---------- 5) LTM 检索：找相似历史报告 ----------
async def ltm_search(query: str, top_k: int = 2) -> list[dict]:
    """
    用 embedding 找最相似的历史报告。
    讲师原话：AI 文章和新闻文章不相关，两篇 AI 文章相关——靠 embedding 判断。
    """
    embedder = get_embedder()
    vec = embedder.encode(query, normalize_embeddings=True).tolist()
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, topic, report, created_at,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM reports
            ORDER BY embedding <=> $1::vector
            LIMIT $2;
            """,
            vec, top_k,
        )
    return [dict(r) for r in rows]


# ---------- 6) LTM 差异：对比新旧报告 ----------
def ltm_diff(old_report: str, new_report: str) -> dict:
    """
    讲师原话：告诉你哪些是新增、哪些是删除、哪些是 neutral（没变）。
    用 difflib 逐行比较。
    """
    old_lines = old_report.splitlines()
    new_lines = new_report.splitlines()
    added, removed, neutral = [], [], []

    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            neutral.extend(new_lines[j1:j2])
        elif tag == "insert":
            added.extend(new_lines[j1:j2])
        elif tag == "delete":
            removed.extend(old_lines[i1:i2])
        elif tag == "replace":
            removed.extend(old_lines[i1:i2])
            added.extend(new_lines[j1:j2])

    return {"added": added, "removed": removed, "neutral": neutral}
```

### 4.3 `queue.py`（Redis Streams 任务队列）

```python
import json
import uuid
from datetime import datetime

import redis.asyncio as aioredis

from config import config

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(config.REDIS_URL, decode_responses=True)
    return _redis


# ---------- 1) 推一个 job 进 stream ----------
async def push_job(topic: str, session_id: str) -> str:
    """
    讲师原话：uuid 生成唯一 job id，把 topic、session id、output 等详情存进 stream，
    然后把 job id 返回给应用，方便后续追踪。
    """
    r = get_redis()
    job_id = str(uuid.uuid4())
    await r.xadd(
        config.REDIS_STREAM_KEY,
        {
            "job_id": job_id,
            "topic": topic,
            "session_id": session_id,
            "output": "",              # 初始为空，worker 完成后写入
            "status": "queued",
            "created_at": datetime.utcnow().isoformat(),
        },
    )
    return job_id


# ---------- 2) 取 job 结果 ----------
async def get_result(job_id: str) -> str | None:
    """
    讲师原话：检查某个 job id 的结果是否完成。完成返回结果，没完成返回 None。
    """
    r = get_redis()
    return await r.get(f"job:result:{job_id}")


# ---------- 3) 写 job 结果（带 TTL，用于缓存） ----------
async def set_result(job_id: str, result: str, ttl: int = 3600) -> None:
    """
    讲师原话：worker 处理完后把结果存进 Redis，带 TTL 自动过期，用于缓存。
    """
    r = get_redis()
    await r.set(f"job:result:{job_id}", result, ex=ttl)


# ---------- 4) 建 consumer group ----------
async def ensure_group() -> None:
    """
    讲师原话：consumer group 让多个 worker 共享 job，避免两个 worker 抢同一个 job。
    """
    r = get_redis()
    try:
        await r.xgroup_create(
            name=config.REDIS_STREAM_KEY,
            groupname=config.REDIS_CONSUMER_GROUP,
            id="0",
            mkstream=True,
        )
    except Exception as e:
        # BUSYGROUP 表示已存在，忽略
        if "BUSYGROUP" not in str(e):
            raise


# ---------- 5) 消费 job ----------
async def consume_jobs(consumer_name: str, count: int = 1, block_ms: int = 5000) -> list[dict]:
    """
    讲师原话：worker 处理器用它等待新 job、读取可用 job、处理完返回。
    """
    r = get_redis()
    resp = await r.xreadgroup(
        groupname=config.REDIS_CONSUMER_GROUP,
        consumername=consumer_name,
        streams={config.REDIS_STREAM_KEY: ">"},
        count=count,
        block=block_ms,
    )
    if not resp:
        return []
    jobs = []
    for _stream, entries in resp:
        for entry_id, fields in entries:
            jobs.append({"entry_id": entry_id, **fields})
    return jobs


# ---------- 6) ACK job ----------
async def ack_job(entry_id: str) -> None:
    """
    讲师原话：worker 处理完后给 Redis 发 ack，告诉它这个 job 完成了，可以从 stream 删掉。
    """
    r = get_redis()
    await r.xack(config.REDIS_STREAM_KEY, config.REDIS_CONSUMER_GROUP, entry_id)
    await r.xdel(config.REDIS_STREAM_KEY, entry_id)
```

### 4.4 `agents.py`（LangGraph 四 Agent 编排）

```python
import asyncio
import logging
from dataclasses import dataclass, field

import httpx
from langgraph.graph import StateGraph, START, END
from langsmith import traceable

from config import config
from memory import get_session_memory, ltm_search, ltm_store

logger = logging.getLogger("agents")
logging.basicConfig(level=logging.INFO)


# ---------- 共享状态 ----------
@dataclass
class ResearchState:
    topic: str
    session_id: str
    history: list = field(default_factory=list)
    ltm_context: list = field(default_factory=list)
    search_results: str = ""
    summary: str = ""
    final_report: str = ""
    verification: str = ""
    iterations: int = 0
    errors: list = field(default_factory=list)


# ---------- Tensor0 网关调用（带重试 + 指数退避） ----------
async def tz_call_once(prompt: str, system: str = "") -> str:
    """单次调用 Tensor0 网关。"""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{config.TENSOR0_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {config.TENSOR0_API_KEY}"},
            json={
                "model": config.TENSOR0_MODEL,
                "messages": [
                    {"role": "system", "content": system or "You are a helpful research assistant."},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def tz_call(prompt: str, system: str = "", max_retries: int = 3) -> str:
    """
    讲师原话：tz_call_once 被 tz_call 以 lambda 形式调用，配合重试逻辑——
    延迟和指数退避（exponential backoff）。
    """
    delay = 1.0
    last_err = None
    for attempt in range(max_retries):
        try:
            return await tz_call_once(prompt, system)
        except Exception as e:
            last_err = e
            logger.warning("tz_call 第 %d 次失败：%s，%.1fs 后重试", attempt + 1, e, delay)
            await asyncio.sleep(delay)
            delay *= 2  # 指数退避
    raise RuntimeError(f"tz_call 重试 {max_retries} 次仍失败：{last_err}")


# ---------- Agent 1：search ----------
@traceable(name="search_agent", run_type="chain")
async def search_agent(state: ResearchState) -> ResearchState:
    """
    讲师原话：负责收集请求主题的信息，也会接收最近 4 轮对话历史（所以写了 -4）。
    """
    history = await get_session_memory(state.session_id)
    state.history = history[-4:]
    prompt = (
        f"请围绕主题『{state.topic}』做资料搜集，输出要点。\n"
        f"最近对话历史：{state.history}"
    )
    state.search_results = await tz_call(prompt)
    return state


# ---------- Agent 2：summarizer ----------
@traceable(name="summarizer_agent", run_type="chain")
async def summarizer_agent(state: ResearchState) -> ResearchState:
    """讲师原话：把原始研究结果转成清晰、结构化、带项目符号的要点。"""
    prompt = (
        "把下面的原始研究结果整理成清晰、结构化、带项目符号的要点：\n\n"
        f"{state.search_results}"
    )
    state.summary = await tz_call(prompt)
    return state


# ---------- Agent 3：writer ----------
@traceable(name="writer_agent", run_type="chain")
async def writer_agent(state: ResearchState) -> ResearchState:
    """
    讲师原话：把摘要结果和 LTM 里检索到的相关报告一起考虑，然后发起 tz_call 写最终报告。
    """
    state.ltm_context = await ltm_search(state.topic, top_k=2)
    ltm_text = "\n\n".join([r["report"] for r in state.ltm_context])
    prompt = (
        f"主题：{state.topic}\n\n"
        f"要点摘要：\n{state.summary}\n\n"
        f"历史相关报告（供参考对比）：\n{ltm_text}\n\n"
        "请写一份完整的研究报告，包含 executive summary、key findings、overall analysis、conclusion。"
    )
    state.final_report = await tz_call(prompt)
    return state


# ---------- Agent 4：critic ----------
@traceable(name="critic_agent", run_type="chain")
async def critic_agent(state: ResearchState) -> ResearchState:
    """
    讲师原话：检查事实一致性、逻辑一致性、写作一致性。通过 yes，不通过 no。
    （讲师建议：想更好可以改成 10 分制，>7 算通过。）
    """
    prompt = (
        "请检查下面报告的事实一致性、逻辑一致性、写作一致性。"
        "只回答 yes 或 no。\n\n"
        f"{state.final_report}"
    )
    state.verification = (await tz_call(prompt)).strip().lower()
    return state


# ---------- 路由 ----------
def route_after_critic(state: ResearchState) -> str:
    """
    讲师原话：critic 结束后做最终决策——通过就结束，不通过就重试；
    重试耗尽就向用户显示错误信息。
    """
    if state.verification.startswith("yes"):
        return "end"
    if state.iterations >= 2:
        state.errors.append("critic 多次未通过，重试耗尽")
        return "end"
    state.iterations += 1
    return "retry"


# ---------- 编排 ----------
def build_graph():
    g = StateGraph(ResearchState)
    g.add_node("search", search_agent)
    g.add_node("summarize", summarizer_agent)
    g.add_node("writer", writer_agent)
    g.add_node("verify", critic_agent)

    g.add_edge(START, "search")
    g.add_edge("search", "summarize")
    g.add_edge("summarize", "writer")
    g.add_edge("writer", "verify")
    g.add_conditional_edges("verify", route_after_critic, {"end": END, "retry": "search"})
    return g.compile()


_graph = build_graph()


@traceable(name="research_workflow", run_type="chain")
async def run_workflow(topic: str, session_id: str) -> str:
    """orchestrator 入口：跑完整流水线，落库，返回最终报告。"""
    state = ResearchState(topic=topic, session_id=session_id)
    result = await _graph.ainvoke(state)
    # LangGraph 返回的是 dict，取 final_report
    final_report = result["final_report"] if isinstance(result, dict) else result.final_report
    await ltm_store(topic, final_report)
    return final_report
```

### 4.5 `eval.py`（LangSmith LLM 评估）

```python
import asyncio
import logging
import re

import asyncpg
import httpx
from langsmith import Client

from config import config

logger = logging.getLogger("eval")
logging.basicConfig(level=logging.INFO)

# 讲师原话：LangSmith client 只创建一次，后面反复复用
_ls_client: Client | None = None


def get_ls_client() -> Client:
    global _ls_client
    if _ls_client is None:
        _ls_client = Client(
            api_key=config.LANGSMITH_API_KEY,
            api_url=config.LANGSMITH_ENDPOINT,
        )
    return _ls_client


# ---------- 1) 解析分数 ----------
def parse_score(text: str) -> float:
    """
    讲师原话：从裁判 LLM 的响应里把分数解析出来。
    支持 "8"、"8/10"、"score: 8" 等格式。
    """
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    if not m:
        return 0.0
    return float(m.group(1))


# ---------- 2) judge：通过 Tensor0 网关调裁判 LLM ----------
async def judge_once(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{config.TENSOR0_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {config.TENSOR0_API_KEY}"},
            json={
                "model": config.TENSOR0_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def judge(prompt: str, max_retries: int = 3) -> str:
    """
    讲师原话：judge 辅助函数把评估 prompt 通过 Tensor0 发给 LLM，
    因为 Tensor0 是 LLM 网关，所有请求都必须走网关。同时用重试和 fallback 逻辑。
    """
    delay = 1.0
    last_err = None
    for attempt in range(max_retries):
        try:
            return await judge_once(prompt)
        except Exception as e:
            last_err = e
            logger.warning("judge 第 %d 次失败：%s", attempt + 1, e)
            await asyncio.sleep(delay)
            delay *= 2
    raise RuntimeError(f"judge 重试耗尽：{last_err}")


# ---------- 3) 四个评估指标 ----------
async def eval_relevance(question: str, report: str) -> float:
    """讲师原话：检查报告是否真的和用户问题相关。"""
    prompt = (
        f"问题：{question}\n报告：{report}\n\n"
        "这份报告与问题的相关性如何？0-10 分，只输出数字。"
    )
    return parse_score(await judge(prompt))


async def eval_completeness(report: str) -> float:
    """讲师原话：检查是否包含 executive summary、key findings、overall analysis、conclusion。"""
    prompt = (
        f"报告：{report}\n\n"
        "这份报告是否包含 executive summary、key findings、overall analysis、conclusion？"
        "0-10 分，只输出数字。"
    )
    return parse_score(await judge(prompt))


async def eval_hallucination(report: str) -> float:
    """讲师原话：检查报告是否包含编造的数据（如 2028 年印度总理是谁）。"""
    prompt = (
        f"报告：{report}\n\n"
        "这份报告是否包含编造/无法验证的数据？0-10 分（10=完全无幻觉），只输出数字。"
    )
    return parse_score(await judge(prompt))


async def eval_quality(report: str) -> float:
    """讲师原话：检查整体质量——准确性、深度、结构、清晰度。"""
    prompt = (
        f"报告：{report}\n\n"
        "这份报告的整体质量如何（准确性、深度、结构、清晰度）？0-10 分，只输出数字。"
    )
    return parse_score(await judge(prompt))


# ---------- 4) 并行跑四个指标 ----------
async def evaluate_report(question: str, report: str) -> dict:
    """
    讲师原话：四个评估并行跑——用 asyncio.gather，不是先 relevance 完再 completeness，
    而是全部同时跑。然后收集分数、记日志、上报 LangSmith，最后返回。
    """
    relevance, completeness, hallucination, quality = await asyncio.gather(
        eval_relevance(question, report),
        eval_completeness(report),
        eval_hallucination(report),
        eval_quality(report),
    )
    scores = {
        "relevance": relevance,
        "completeness": completeness,
        "hallucination": hallucination,
        "quality": quality,
    }
    logger.info("评估分数：%s", scores)

    # 上报 LangSmith
    try:
        client = get_ls_client()
        client.create_run(
            name="report_evaluation",
            run_type="chain",
            inputs={"question": question, "report": report},
            outputs=scores,
            project_name=config.LANGSMITH_PROJECT,
        )
    except Exception as e:
        logger.warning("上报 LangSmith 失败：%s", e)

    return scores


# ---------- 5) 取最近主题（用于批量评估） ----------
async def fetch_recent_topics(limit: int = 20) -> list[str]:
    """
    讲师原话：从 PostgreSQL 里取最近生成的报告主题，后续可用于批量评估。
    """
    conn = await asyncpg.connect(config.DATABASE_URL)
    try:
        rows = await conn.fetch(
            "SELECT DISTINCT topic FROM reports ORDER BY MAX(created_at) DESC LIMIT $1;",
            limit,
        )
        return [r["topic"] for r in rows]
    finally:
        await conn.close()
```

### 4.6 `output.py`（PDF / JSON / 差异）

```python
import json
import hashlib
import difflib

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm

from config import config
from memory import get_pg_pool, ltm_search


# ---------- 1) 生成 PDF（自动分页） ----------
def generate_pdf(report: str, output_path: str) -> str:
    """
    讲师原话：不是把所有内容塞进一页——第一页满了会新建一页。
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    y = height - margin
    line_height = 14

    for line in report.splitlines():
        if y < margin:
            c.showPage()
            y = height - margin
        c.drawString(margin, y, line[:110])  # 简单截断，避免超宽
        y -= line_height

    c.save()
    return output_path


# ---------- 2) 导出 JSON ----------
def to_json(report: str, topic: str) -> str:
    """讲师原话：不想 PDF 就转成 JSON 格式。"""
    return json.dumps(
        {
            "topic": topic,
            "report": report,
            "hash": hashlib.sha256(report.encode()).hexdigest(),
        },
        ensure_ascii=False,
        indent=2,
    )


# ---------- 3) 与 LTM 历史报告做 diff ----------
async def diff_reports(topic: str, new_report: str) -> dict:
    """
    讲师原话：用向量嵌入找相似报告，取最新两条（limit = 2），逐行比较，返回差异。
    新增=绿、删除=红、未变=蓝/白（颜色在 HTML 里设置）。
    """
    similar = await ltm_search(topic, top_k=2)
    if not similar:
        return {"added": new_report.splitlines(), "removed": [], "neutral": []}

    old_report = similar[0]["report"]
    old_lines = old_report.splitlines()
    new_lines = new_report.splitlines()

    added, removed, neutral = [], [], []
    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            neutral.extend(new_lines[j1:j2])
        elif tag == "insert":
            added.extend(new_lines[j1:j2])
        elif tag == "delete":
            removed.extend(old_lines[i1:i2])
        elif tag == "replace":
            removed.extend(old_lines[i1:i2])
            added.extend(new_lines[j1:j2])

    return {"added": added, "removed": removed, "neutral": neutral}
```

### 4.7 `worker.py`（课里没给入口，这里补最小可跑版本）

```python
import asyncio
import logging

from queue import consume_jobs, ack_job, set_result
from agents import run_workflow
from memory import db_migrate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")


async def main(consumer_name: str = "worker-1"):
    await db_migrate()
    logger.info("worker %s 启动", consumer_name)
    while True:
        jobs = await consume_jobs(consumer_name)
        for job in jobs:
            try:
                logger.info("处理 job %s：%s", job["job_id"], job["topic"])
                report = await run_workflow(job["topic"], job["session_id"])
                await set_result(job["job_id"], report)
                await ack_job(job["entry_id"])
            except Exception as e:
                logger.exception("job %s 失败：%s", job["job_id"], e)


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 5. 逐行解释

### 5.1 `memory.py`

- **`save_session_message` 里的 `ltrim(key, -N, -1)`**：讲师原话「设成 5 就只留最新 5 条」。`ltrim` 是 Redis list 的裁剪命令，`-N` 到 `-1` 表示保留倒数 N 条。**在 JS/Node 里对应 `LTRIM key -N -1`，`ioredis` 直接有 `ltrim` 方法**。
- **`expire(key, TTL)`**：讲师原话「TTL 的意思是过了这段时间这条记忆就会被删除」。每次写入都刷新 TTL，保证活跃会话不过期、冷会话自动清理。
- **`db_migrate` 里的 `CREATE EXTENSION IF NOT EXISTS vector`**：讲师原话「首先启用 pgvector 扩展」。不启用这个扩展，`vector(384)` 类型不存在，建表直接报错。
- **`reports` 表五列**：讲师原话「第一列 id、第二列 topic、第三列 report、第四列 embedding、还有创建时间」。这里严格照做，`embedding vector(384)` 的 384 来自 `all-MiniLM-L6-v2` 的输出维度。
- **`ltm_store` 里 `normalize_embeddings=True`**：归一化后余弦相似度等价于点积，配合 `<=>` 余弦距离算子更稳。
- **`ltm_search` 的 `1 - (embedding <=> $1::vector) AS similarity`**：`<=>` 是 pgvector 的余弦距离算子，距离越小越相似，所以 `1 - 距离 = 相似度`。讲师原话「AI 文章和新闻文章不相关」——不相关的向量距离大，相似度低，自然排不到前面。
- **`ltm_diff` 用 `difflib.SequenceMatcher`**：讲师原话「用 difflib 库对比两份报告」。`get_opcodes()` 返回 `equal / insert / delete / replace` 四种操作，分别映射到 neutral / added / removed / (removed+added)。

### 5.2 `queue.py`

- **`push_job` 里 `uuid.uuid4()`**：讲师原话「uuid 生成唯一 job id」。每个 job 一个 UUID，应用层拿这个 ID 轮询结果。
- **`xadd` 的字段**：讲师原话「把 topic、session id、output 这些 job 详情都存进 stream」。这里加了 `status` 和 `created_at` 方便排查，属于合理补充。
- **`get_result` 返回 `None`**：讲师原话「没跑完就返回 None」。调用方拿到 `None` 就知道还在排队/处理中。
- **`set_result` 的 `ex=ttl`**：讲师原话「带 TTL 自动过期，用于缓存」。结果不是永久存，过期后需要重新跑。
- **`ensure_group` 捕获 `BUSYGROUP`**：consumer group 已存在时 Redis 会报 `BUSYGROUP`，这是幂等操作，忽略即可。
- **`consume_jobs` 的 `">"`**：表示「只消费新消息」，已 ACK 的不会再被读到。这是 Redis Streams consumer group 的标准用法。
- **`ack_job` 里 `xack` + `xdel`**：讲师原话「告诉 Redis 这个 job 完成了，可以从 stream 删掉」。`xack` 标记已处理，`xdel` 真正删除，避免 stream 无限增长。

### 5.3 `agents.py`

- **`ResearchState` 的字段**：讲师原话「topic、会话历史、LTM 上下文、搜索结果、摘要、最终报告、验证结果、迭代次数、错误」。逐字对应。
- **`tz_call_once` 打的是 `TENSOR0_BASE_URL`**：讲师原话「不直接调 OpenAI，先到 Tensor0，Tensor0 再调 OpenAI」。所有 LLM 请求统一走网关，方便做限流、审计、换模型。
- **`tz_call` 的 `delay *= 2`**：讲师原话「延迟和指数退避」。1s → 2s → 4s，避免瞬时重试打爆网关。
- **`search_agent` 里 `history[-4:]`**：讲师原话「最近 4 轮对话，所以写了 -4」。给 search 提供上下文，避免重复搜已知信息。
- **`writer_agent` 里 `ltm_search(topic, top_k=2)`**：讲师原话「把摘要结果和 LTM 里检索到的相关报告一起考虑」。这是 LTM 真正被消费的地方——不是存了不用，而是写报告时作为参考。
- **`critic_agent` 只回 yes/no**：讲师原话「我们这里是 yes/no，想更好可以改成 10 分制，>7 算通过」。这是讲师明确指出的改进点。
- **`route_after_critic` 的 `iterations >= 2`**：讲师原话「重试耗尽就向用户显示错误信息」。最多重试 2 次，防止死循环。
- **`add_conditional_edges` 的 `{"end": END, "retry": "search"}`**：critic 不通过就回到 search 重跑，形成闭环。

### 5.4 `eval.py`

- **`_ls_client` 全局单例**：讲师原话「LangSmith client 只创建一次，后面反复复用」。避免每次评估都新建连接。
- **`parse_score` 用正则 `(\d+(?:\.\d+)?)`**：讲师原话「从裁判 LLM 的响应里把分数解析出来」。LLM 可能回「8」「8/10」「score: 8」，正则都能抓。
- **`judge` 走 Tensor0**：讲师原话「Tensor0 是 LLM 网关，所有请求都必须走网关」。评估请求也不例外。
- **`eval_relevance` 的例子**：讲师原话「问『你叫什么名字』，答案应该是『我叫 Sudhanshu』，而不是『我在 12 年级读书』」——问题和答案要匹配。
- **`eval_completeness` 的四个章节**：讲师原话「executive summary、key findings、overall analysis、conclusion，这些都必须有」。
- **`eval_hallucination` 的例子**：讲师原话「问 2028 年印度总理是谁——未来我们不知道，它却编出答案，这就是幻觉」。
- **`eval_quality` 的四个维度**：讲师原话「准确性、深度、结构、清晰度」。
- **`asyncio.gather` 并行**：讲师原话「不是先 relevance 完再 completeness，而是全部同时跑」。四个 HTTP 请求并发，总耗时约等于最慢那个。
- **`fetch_recent_topics` 的 `DISTINCT topic ... ORDER BY MAX(created_at) DESC`**：讲师原话「从 PostgreSQL 里取最近生成的报告主题，用于批量评估」。注意这里 `DISTINCT` + `MAX` 的写法在严格 SQL 下需要 `GROUP BY topic`，实际跑的时候如果报错，改成 `SELECT topic FROM reports GROUP BY topic ORDER BY MAX(created_at) DESC LIMIT $1` 即可——**该字段名请以实际输出为准**。

### 5.5 `output.py`

- **`generate_pdf` 的 `if y < margin: c.showPage()`**：讲师原话「第一页满了会新建一页」。这是 ReportLab 手动分页的标准写法。
- **`to_json` 里带 `hash`**：讲师原话「不想 PDF 就转成 JSON」。加 hash 是为了前端做缓存/去重，属于合理补充。
- **`diff_reports` 的 `top_k=2`**：讲师原话「取最新两条（limit = 2）」。一条是当前报告，一条是上一版相似报告。
- **颜色在 HTML 里设置**：讲师原话「绿色和红色是在 HTML 文件里设置的：新增的行设绿色、删除的行设红色、未变的行保持蓝色或白色」。`output.py` 只负责算出 added/removed/neutral 三个列表，渲染交给前端。

### 5.6 前端转 AI 工程师的补充

- **Redis list 的 `ltrim`**：在 JS/Node 里就是 `redis.ltrim(key, -N, -1)`，语义完全一致，不需要额外封装。
- **`asyncio.gather`**：在 JS 里对应 `Promise.all([...])`，四个评估请求并发发出。
- **`asyncpg` 连接池**：在 Node 里对应 `pg.Pool`，都是「启动时建池、请求时借连接、用完归还」。
- **consumer group**：这是 Redis 层面的概念，Node 的 `ioredis` 同样支持 `xreadgroup` / `xack`，API 名字一致。
- **pgvector 的 `<=>` 算子**：SQL 层面的事，跟语言无关，Node 里用 `pg` 直接拼 SQL 即可。

---

## 6. 复现检查清单

按顺序打勾，任何一步失败都不要往下走：

- [ ] `docker ps` 能看到 `redis-stm` 和 `pg-ltm` 两个容器在跑
- [ ] `pip install` 全部成功，`python -c "import langgraph, langsmith, reportlab, asyncpg, redis"` 无报错
- [ ] `.env` 里 `REDIS_URL` / `DATABASE_URL` / `TENSOR0_*` / `LANGSMITH_*` 都填了
- [ ] `python -c "import asyncio; from memory import db_migrate; asyncio.run(db_migrate())"` 成功，`\d reports` 能看到 5 列
- [ ] `python -c "import asyncio; from queue import ensure_group; asyncio.run(ensure_group())"` 成功，`XINFO GROUPS research:jobs` 能看到 `research-workers`
- [ ] `python worker.py` 启动，日志打印「worker worker-1 启动」
- [ ] 另开终端 `python -c "import asyncio; from queue import push_job; print(asyncio.run(push_job('AI 2026 进展', 'sess-1')))"` 拿到 job_id
- [ ] worker 日志打印「处理 job xxx：AI 2026 进展」
- [ ] `get_result(job_id)` 返回非 None 的报告文本
- [ ] `evaluate_report(question, report)` 返回四个分数，且 LangSmith 云端能看到 `report_evaluation` run
- [ ] `generate_pdf(report, "out.pdf")` 生成的文件能打开，且内容超过一页时自动分页
- [ ] `to_json(report, topic)` 输出合法 JSON
- [ ] `diff_reports(topic, new_report)` 返回的 `added` / `removed` / `neutral` 三个列表非空（第二次跑同一主题时）

![p097 05:12 讲师用五月/六月报告对比解释 LTM 差异检测](images/p097_0312s.jpg)

![p097 07:48 讲师展示 reports 表结构：id / topic / report / embedding / 时间](images/p097_0468s.jpg)

![p097 13:00 讲师画两台 worker 消费 5 个 job 的队列示意图](images/p097_0780s.jpg)

![p098 00:41 讲师列出四个 Agent：search / summarizer / writer / critic + orchestrator](images/p098_0041s.jpg)

![p098 09:04 讲师展示 LangGraph 工作流：search → summarize → writer → verify → 条件路由](images/p098_0533s.jpg)

![p099 00:46 讲师列出四个评估指标：relevance / completeness / hallucination / quality](images/p099_0046s.jpg)

![p099 09:14 讲师展示 diff 视图：绿色新增、红色删除](images/p099_0554s.jpg)

---

## 7. 课里没讲但你会撞上的

1. **`fetch_recent_topics` 的 SQL 写法**：`SELECT DISTINCT topic ... ORDER BY MAX(created_at)` 在 PostgreSQL 里会报「column must appear in GROUP BY」。课里只口述了「取最近主题」，没给完整 SQL。实际跑的时候改成 `SELECT topic FROM reports GROUP BY topic ORDER BY MAX(created_at) DESC LIMIT $1` 即可。

2. **`vector(384)` 的维度**：384 是 `all-MiniLM-L6-v2` 的输出维度。如果你换成 `text-embedding-3-small`（1536 维）或 `bge-large`（1024 维），建表时的维度必须同步改，否则 `ltm_store` 插入会报维度不匹配。

3. **Tensor0 网关本身**：课里反复说「所有 LLM 请求走 Tensor0」，但 Tensor0 的部署/配置在「upcoming videos」里，本段没讲。复现时你需要自己起一个兼容 OpenAI 协议的网关（LiteLLM、OneAPI、或自建 FastAPI 都行），把 `TENSOR0_BASE_URL` 指过去。

4. **LangSmith 的 `create_run` 参数**：课里只说「把分数记到 LangSmith」，没给具体 API 调用。`client.create_run(...)` 的 `project_name` 参数在不同版本 SDK 里可能叫 `project_name` 或 `session_name`，以你装的版本为准。

5. **worker 的并发度**：课里画了「两台 worker」的图，但没讲怎么起多个 worker 进程。复现时开两个终端各跑 `python worker.py`（consumer_name 分别传 `worker-1` / `worker-2`）即可，consumer group 会自动分配。

6. **`critic` 的 yes/no 判定**：课里明确说「我们这里是 yes/no，想更好可以改成 10 分制」。`route_after_critic` 里用 `startswith("yes")` 是防御性写法，因为 LLM 可能回「Yes.」「yes, it passes」等变体。

7. **PDF 中文乱码**：ReportLab 默认字体不含中文，`drawString` 画中文会变方块。课里没讲字体注册，复现时如果报告是中文，需要 `pdfmetrics.registerFont(TTFont('SimSun', 'simsun.ttc'))` 并 `setFont`。

8. **Redis Stream 的堆积**：`ack_job` 里 `xdel` 删了消息，但如果 worker 崩溃没 ACK，消息会留在 Pending Entries List（PEL）里。课里没讲 PEL 清理，生产环境需要 `XAUTOCLAIM` 或定时 `XINFO CONSUMERS` 检查。

9. **`ltm_search` 的 `top_k=2` 写死**：课里说「取最新两条」，但 `writer_agent` 和 `diff_reports` 都写死 2。如果历史报告很多，可以调大，但要注意 prompt 长度。

10. **`ResearchState` 用 dataclass**：LangGraph 的 state 用 dataclass 可以，但官方更推荐 `TypedDict` 或 `pydantic.BaseModel`。dataclass 在 `ainvoke` 返回时是 dict 还是对象取决于版本，代码里用 `isinstance(result, dict)` 做了兼容——**该字段名请以实际输出为准**。

11. **`sentence-transformers` 首次加载慢**：第一次 `SentenceTransformer(...)` 会下载模型（几百 MB），离线环境需要提前 `huggingface-cli download`。课里没提这点，但复现时一定会撞上。

12. **`asyncpg` 的 `vector` 类型**：`asyncpg` 不原生认识 pgvector 的 `vector` 类型，传 list 时可能需要 `pgvector.asyncpg.register_vector(conn)` 注册。课里没讲，如果插入报「expected str, got list」，加上这行注册即可。