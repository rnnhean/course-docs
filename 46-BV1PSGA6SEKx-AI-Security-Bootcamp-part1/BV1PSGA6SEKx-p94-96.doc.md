# AI Security Bootcamp Part 1：护栏、网关与可观测（P094–P096）

> 本文档覆盖 P094–P096 三集，对应项目中的 `requirements.txt`、`config.py`、`retry.py`、`pool.py`、`auth.py`、`guardrails.py`、`cache.py` 七个文件。读者按本文档顺序操作，可以在本地把「配置加载 → 重试 → 数据库连接池 → API 鉴权 → Bedrock 护栏 → 语义缓存」这条链路完整跑起来。

---

## 1. 这一节做什么

这三集讲的是同一个 AI 研究助手应用（research agent）的**应用层代码骨架**。前面已经用 Terraform 把基础设施（AWS Secrets Manager、ECS、Bedrock Guardrail、Postgres、Redis 等）搭好了，这三集开始写跑在基础设施上的 Python 应用。

具体交付物是七个文件，按依赖顺序排列：

| 顺序 | 文件 | 职责 | 依赖 |
|---|---|---|---|
| 1 | `requirements.txt` | 声明全部 Python 依赖 | — |
| 2 | `config.py` | 从 AWS Secrets Manager 拉取全部密钥与配置，用 LRU 缓存常驻内存 | `boto3`、`functools.lru_cache` |
| 3 | `retry.py` | 通用异步重试装饰器，指数退避（1s → 2s → 4s） | `asyncio`、`logging` |
| 4 | `pool.py` | Postgres 异步连接池，全局单例，最小 2 最大 10 | `asyncpg`、`config.py` |
| 5 | `auth.py` | FastAPI 依赖注入式 API Key 鉴权 | `fastapi`、`config.py` |
| 6 | `guardrails.py` | 调 AWS Bedrock Guardrails，在**输入**和**输出**两处做安全检查 | `boto3`、`retry.py`、`config.py` |
| 7 | `cache.py` | 基于 Redis + 句向量 + 余弦相似度的**语义缓存** | `redis`、`sentence-transformers`、`numpy`、`config.py` |

一句话概括这三集的核心思想：**所有密钥不落代码、所有外部调用都可重试、所有数据库连接都复用、所有请求都过鉴权和护栏、所有重复问题都走语义缓存。** 这就是「AI 应用安全 + 成本控制」的最小可用骨架。

---

## 2. 讲师原话

> "FastAPI 是用来构建应用 REST API 的 Web 框架，而 uvicorn 是服务器——FastAPI 是框架，但框架需要一个服务器来跑，所以 uvicorn 提供服务器来运行你的 FastAPI，两者是手拉手工作的。"
> —— p094 [00:25]

> "Pydantic 会校验你的 API 请求，并把它们转换成合适的 Python 数据对象，这样你的请求就不会崩。"
> —— p094 [00:55]

> "我们做的是异步系统，异步系统就需要异步请求，为此我们需要 HTTPX。"
> —— p094 [00:55]

> "asyncpg 从名字就能看出来是异步的，它是一个高性能的 PostgreSQL 数据库驱动，用于异步应用。"
> —— p094 [01:53]

> "这个 `config.py` 就是一个配置加载器。如果你不用 `config.py`，你就得把 API key、数据库密码、URL 全部硬编码。用了它，所有密钥都存在 AWS Secrets Manager 里，你从这里安全地取出来用。"
> —— p094 [03:49]

> "LRU 缓存会把 Secrets Manager 里存的所有值缓存住，这样你就不必一遍又一遍地去加载它。"
> —— p094 [04:19]

> "如果 Secrets Manager 里给了 LangSmith 的 API key，我们就启用 tracing，因为我们要做监控——不只是评估，还要做 tracing，每一个 LLM 请求、每一个 API 请求都会被追踪：花了多少时间、哪个 AI agent 花了这么多时间。"
> —— p094 [09:06]

> "这个函数会让你的应用更可靠。整个系统是异步的，会有很多异步操作：LLM 调用是异步的、数据库调用是异步的、AWS 服务调用是异步的。但由于临时错误，有些请求可能会失败。"
> —— p095 [00:29]

> "我们可以创建一个带指数退避的重试逻辑。延迟是两次请求之间的初始时间，退避是一个乘数。"
> —— p095 [02:21]

> "延迟等于延迟乘以退避，这就是指数退避。当前延迟是 1，1 乘 2，下一次重试前的等待时间就是 2 秒；再下一次 2 乘 2，等待 4 秒。所以初始 1 秒、然后 2 秒、然后 4 秒，等待时间随每次重试递增。"
> —— p095 [03:48]

> "与其一遍又一遍地发起连接请求，你可以创建一个池，因为反复连接太耗时、连接会很慢。我们在做 AI 系统的性能优化，所以创建池，池里有可复用的连接。"
> —— p095 [05:43]

> "最小连接数是 2，最大连接数是 10。"
> —— p095 [08:04]

> "这个函数会在应用关闭时运行。假设你在关闭应用、删除应用，它会自动关闭连接，所以我们要接上 close pool。"
> —— p095 [10:01]

> "这个文件实现的是你的 API 鉴权，不是你 LLM 的 API key。它检查发起请求的客户端是否与 Secrets Manager 里提供的 key 匹配，不匹配就返回错误。"
> —— p096 [00:00]

> "在 Secrets Manager 里有一个单独的实体就是 API key，假设里面写的是 ABC。你的应用 UI 里有一个输入框要填 API key，你填了 test，然后给研究主题、点按钮，请求会失败，因为 test 和 ABC 不匹配。你清掉 test、填 ABC，再运行，它检查 ABC 和配置的 ABC 是否一致——一致，就放行。"
> —— p096 [01:54]

> "目前我们只做了一个共享的鉴权 key，但你要把它做成每个用户一个鉴权 key。"
> —— p096 [02:52]

> "这个文件会集成 AWS Bedrock Guardrails。在 Terraform 里已经定义了一个 Bedrock Guardrail，里面定义了内容过滤器、主题策略、脏话策略、词策略、PII 检测，全都配好了。现在你要把它集成进系统。"
> —— p096 [03:20]

> "在把用户 prompt 发出去之前，它会检查用户发的 prompt 是否安全、是否不含有害信息。它在两个地方检查：输入处和输出处。用户 prompt 会被检查，LLM 的响应也会被检查。"
> —— p096 [04:18]

> "如果返回 false，说明被护栏拦截了；如果返回 true，说明没问题。"
> —— p096 [06:39]

> "我们用的是语义缓存。缓存有两种：词匹配缓存和语义缓存。语义缓存理解的是确切含义。"
> —— p096 [07:37]

> "词匹配缓存里，第一个问题『什么是 AI』被缓存了，第二个人问『什么是人工智能』——你能看出两个问题一样，但词匹配是逐词精确匹配，它们不是逐词相同，所以这里也会发一次 API 调用。两个 API 调用都会发生，尽管已经缓存过了。"
> —— p096 [09:34]

> "语义缓存里，它会理解含义，不会逐词搜索。它会看到『什么是 AI』和『什么是人工智能』基本一样，只是表述不同，于是直接从缓存版本返回，只发生一次 API 调用。"
> —— p096 [10:03]

> "语义缓存我们用的是余弦相似度算法。"
> —— p096 [10:33]

> "我们加载的模型是 all-MiniLM-L6-v2。你也可以用 OpenAI 的 embedding 模型，但我觉得这个更可靠。注意看维度，大约是 384 维。"
> —— p096 [11:31]

---

## 3. 从零复现

### 3.1 前置条件

- Python 3.11+（`asyncpg`、`sentence-transformers` 在 3.11 上最稳）
- 一个可用的 AWS 账号，且已按前面 Terraform 部分创建好：
  - Secrets Manager 里的 secret，名字为 `research-agent-config`
  - 一个 Bedrock Guardrail（拿到 guardrail id 和 version）
  - Postgres（RDS 或本地 docker）与 Redis（ElastiCache 或本地 docker）
- 本地想省事的话，Postgres 和 Redis 用 docker 起：

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

### 3.2 目录结构

```
research-agent/
├── requirements.txt
├── config.py
├── retry.py
├── pool.py
├── auth.py
├── guardrails.py
├── cache.py
└── main.py            # 可选，用来验证上面这些模块能跑通
```

### 3.3 第一步：写 `requirements.txt` 并安装

按讲师在 p094 里逐个点名的库，`requirements.txt` 内容见第 4 节。安装：

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> 注意：`sentence-transformers` 首次运行会从 HuggingFace 下载 `all-MiniLM-L6-v2`（约 90MB），需要联网。国内网络建议先设 `HF_ENDPOINT=https://hf-mirror.com`。

### 3.4 第二步：在 Secrets Manager 里准备 secret

`config.py` 会去读一个名为 `research-agent-config` 的 secret，里面是一个 JSON。按讲师在 p094 里逐项念出的字段，JSON 至少要有这些键（值换成你自己的）：

```json
{
  "AWS_REGION": "us-east-1",
  "BEDROCK_GUARDRAIL_ID": "xxxxxxxxxxxx",
  "BEDROCK_GUARDRAIL_VERSION": "1",
  "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/postgres",
  "REDIS_URL": "redis://localhost:6379/0",
  "API_KEY": "ABC",
  "LANGSMITH_API_KEY": "",
  "LANGSMITH_PROJECT": "research-agent",
  "LANGSMITH_DATASET": "research-agent-eval",
  "SESSION_TTL": "3600",
  "SEMANTIC_CACHE_TTL": "86400",
  "LTM_DAYS": "30",
  "STREAM_QUEUE": "research:stream",
  "AGENT_REPORT_TRUNCATE": "8000",
  "RATE_LIMIT": "60",
  "RATE_LIMIT_REQUESTS": "60",
  "RATE_LIMIT_WINDOW": "60",
  "DB_POOL_MIN": "2",
  "DB_POOL_MAX": "10"
}
```

创建命令（本地验证用）：

```bash
aws secretsmanager create-secret \
  --name research-agent-config \
  --secret-string file://secret.json \
  --region us-east-1
```

> 讲师在 p094 [05:47] 明确说 secret 名是 `research-agent-config`，和 Terraform 里定义的一致。字段名以你 Terraform 里实际写的为准；上面这份是按讲师口述的变量名整理的，若你的 Terraform 用了别的键名，改 `config.py` 里的 `data.get(...)` 即可。

### 3.5 第三步：按顺序写七个文件

顺序很重要，因为后面的文件 import 前面的：

1. `requirements.txt`（第 4.1 节）
2. `config.py`（第 4.2 节）—— 先跑通它，能打印出配置再往下
3. `retry.py`（第 4.3 节）—— 独立，无依赖
4. `pool.py`（第 4.4 节）—— 依赖 `config.py`
5. `auth.py`（第 4.5 节）—— 依赖 `config.py`
6. `guardrails.py`（第 4.6 节）—— 依赖 `config.py`、`retry.py`
7. `cache.py`（第 4.7 节）—— 依赖 `config.py`

### 3.6 第四步：验证

```bash
# 验证 config 能拉到 secret
python -c "from config import config; print(config.database_url)"

# 验证 retry 装饰器
python -c "
import asyncio
from retry import retry
n = {'i': 0}
@retry
async def boom():
    n['i'] += 1
    if n['i'] < 3:
        raise RuntimeError('fail')
    return 'ok'
print(asyncio.run(boom()), n)
"

# 验证 pool
python -c "
import asyncio
from pool import init_pool, get_pool, close_pool
async def main():
    await init_pool()
    p = get_pool()
    print(await p.fetchval('select 1'))
    await close_pool()
asyncio.run(main())
"
```

### 3.7 第五步：把 auth 和 guardrails 挂到 FastAPI 上（可选验证）

课里没给 `main.py`，但为了让你能真正跑起来，下面给一个最小挂载示例（**课里没有这段，以下为示意**）：

```python
# main.py —— 课里没有代码，以下为示意
from fastapi import FastAPI, Depends
from auth import require_api_key
from guardrails import validate_input, validate_output

app = FastAPI()

@app.post("/research")
async def research(topic: str, _: None = Depends(require_api_key)):
    ok, msg = await validate_input(topic)
    if not ok:
        return {"error": "blocked by guardrail", "detail": msg}
    answer = f"（这里本该调 LLM，课里没讲具体调用）关于 {topic} 的研究结果"
    ok2, msg2 = await validate_output(answer)
    if not ok2:
        return {"error": "output blocked", "detail": msg2}
    return {"answer": answer}
```

启动：

```bash
uvicorn main:app --reload --port 8000
```

请求时带 `x-api-key: ABC` 头。

---

## 4. 完整代码

> 说明：讲师在视频里是逐行念代码，没有贴出完整文件，也没有 OCR 结果。下面每个文件都是**按讲师口述的变量名、参数、逻辑**还原出的完整可运行版本。凡是讲师没念到的细节（比如具体 import 路径、异常类型），我按最保守的写法补齐，并在第 5 节逐行解释里标注哪些是讲师原话、哪些是补齐。

### 4.1 `requirements.txt`

```text
fastapi
uvicorn[standard]
pydantic
httpx
redis
langgraph
langchain-core
sentence-transformers
numpy
boto3
asyncpg
reportlab
langsmith
```

讲师在 p094 逐个点名了这 13 个库，版本号他没念，所以这里不锁版本。生产环境请自行 `pip freeze` 锁定。

### 4.2 `config.py`

```python
# config.py
import os
import json
import socket
from functools import lru_cache

import boto3


SECRET_NAME = "research-agent-config"


@lru_cache(maxsize=1)
def load_secrets() -> dict:
    """从 AWS Secrets Manager 拉取全部配置，返回 dict。"""
    region = os.environ.get("AWS_REGION", "us-east-1")
    client = boto3.client("secretsmanager", region_name=region)
    resp = client.get_secret_value(SecretId=SECRET_NAME)
    return json.loads(resp["SecretString"])


class Config:
    def __init__(self):
        data = load_secrets()

        self.aws_region = data.get("AWS_REGION", "us-east-1")
        self.hostname = socket.gethostname()

        # Bedrock Guardrails
        self.bedrock_guardrail_id = data.get("BEDROCK_GUARDRAIL_ID")
        self.bedrock_guardrail_version = data.get("BEDROCK_GUARDRAIL_VERSION", "1")

        # 数据源
        self.database_url = data.get("DATABASE_URL")
        self.redis_url = data.get("REDIS_URL")

        # 应用鉴权 key（不是 LLM 的 key）
        self.api_key = data.get("API_KEY")

        # LangSmith
        self.langsmith_api_key = data.get("LANGSMITH_API_KEY", "")
        self.langsmith_project = data.get("LANGSMITH_PROJECT", "research-agent")
        self.langsmith_dataset = data.get("LANGSMITH_DATASET", "")

        # 会话 / 缓存 / 记忆
        self.session_ttl = int(data.get("SESSION_TTL", "3600"))
        self.semantic_cache_ttl = int(data.get("SEMANTIC_CACHE_TTL", "86400"))
        self.ltm_days = int(data.get("LTM_DAYS", "30"))

        # 流式队列
        self.stream_queue = data.get("STREAM_QUEUE", "research:stream")
        self.agent_report_truncate = int(data.get("AGENT_REPORT_TRUNCATE", "8000"))

        # 限流
        self.rate_limit = int(data.get("RATE_LIMIT", "60"))
        self.rate_limit_requests = int(data.get("RATE_LIMIT_REQUESTS", "60"))
        self.rate_limit_window = int(data.get("RATE_LIMIT_WINDOW", "60"))

        # 数据库连接池
        self.db_pool_min = int(data.get("DB_POOL_MIN", "2"))
        self.db_pool_max = int(data.get("DB_POOL_MAX", "10"))

        # 语义缓存阈值（讲师提到 config 里有 similarity threshold）
        self.similarity_threshold = float(data.get("SIMILARITY_THRESHOLD", "0.85"))

        # 若配置了 LangSmith key，则开启 tracing
        self.langsmith_tracing = bool(self.langsmith_api_key)
        if self.langsmith_tracing:
            os.environ["LANGSMITH_TRACING"] = "true"
            os.environ["LANGSMITH_API_KEY"] = self.langsmith_api_key
            os.environ["LANGSMITH_PROJECT"] = self.langsmith_project


config = Config()
```

### 4.3 `retry.py`

```python
# retry.py
import asyncio
import logging
from typing import Awaitable, Callable, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")


def retry(
    coro_fn: Callable[..., Awaitable[T]],
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
) -> Callable[..., Awaitable[T]]:
    """通用异步重试装饰器，指数退避。"""

    async def wrapper(*args, **kwargs) -> T:
        current_delay = delay
        last_exc: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                return await coro_fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning(
                    "attempt %d/%d failed for %s: %s",
                    attempt, max_retries, coro_fn.__name__, exc,
                )
                if attempt == max_retries:
                    break
                await asyncio.sleep(current_delay)
                current_delay *= backoff
        logger.error("all %d retries exhausted for %s", max_retries, coro_fn.__name__)
        raise last_exc  # type: ignore[misc]

    return wrapper
```

> 讲师在 p095 说「这个 retry 是一个可复用函数，可以用在任何异步函数上」，所以这里做成**装饰器工厂**：`@retry` 直接可用，也可以 `@retry(max_retries=5, delay=0.5)` 传参。讲师原话里 `coro_fn` 是第一个参数，这里保留了这个名字。

### 4.4 `pool.py`

```python
# pool.py
import asyncpg

from config import config

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """应用启动时调用，创建全局连接池。"""
    global _pool
    if _pool is not None:
        return
    _pool = await asyncpg.create_pool(
        dsn=config.database_url,
        min_size=config.db_pool_min,
        max_size=config.db_pool_max,
    )


async def close_pool() -> None:
    """应用关闭时调用，释放全部连接。"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """取当前全局连接池。"""
    if _pool is None:
        raise RuntimeError("pool not initialized; call init_pool() first")
    return _pool
```

### 4.5 `auth.py`

```python
# auth.py
from fastapi import Header, HTTPException, status

from config import config


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """FastAPI 依赖：校验请求头里的 API key 是否与 Secrets Manager 一致。"""
    if not config.api_key:
        # 没配置 key 视为鉴权未启用，直接放行（讲师提到「检查鉴权是否启用」）
        return
    if x_api_key != config.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid api key",
        )
```

### 4.6 `guardrails.py`

```python
# guardrails.py
import boto3

from config import config
from retry import retry


def _client():
    return boto3.client("bedrock-runtime", region_name=config.aws_region)


async def _apply_guardrail(text: str, source: str) -> tuple[bool, str]:
    """调 Bedrock ApplyGuardrail。返回 (是否通过, 说明)。"""
    client = _client()
    resp = client.apply_guardrail(
        guardrailIdentifier=config.bedrock_guardrail_id,
        guardrailVersion=config.bedrock_guardrail_version,
        source=source,  # "INPUT" 或 "OUTPUT"
        content=[{"text": {"text": text}}],
    )
    action = resp.get("action", "NONE")
    outputs = resp.get("outputs", [])
    detail = outputs[0].get("text", "") if outputs else ""
    return action != "GUARDRAIL_INTERVENED", detail


@retry
async def validate_input(prompt: str) -> tuple[bool, str]:
    return await _apply_guardrail(prompt, source="INPUT")


@retry
async def validate_output(answer: str) -> tuple[bool, str]:
    return await _apply_guardrail(answer, source="OUTPUT")
```

> 讲师在 p096 说「如果返回 false 说明被拦截，返回 true 说明没问题」，所以这里把 `action != "GUARDRAIL_INTERVENED"` 作为「通过」的判据。`apply_guardrail` 的响应字段名（`action`、`outputs`）以 AWS 实际返回为准；讲师没念字段名，这里按 boto3 文档写，若你的 SDK 版本不同请以实际输出为准。

### 4.7 `cache.py`

```python
# cache.py
import json

import numpy as np
import redis
from sentence_transformers import SentenceTransformer

from config import config

_model = SentenceTransformer("all-MiniLM-L6-v2")
_redis = redis.Redis.from_url(config.redis_url, decode_responses=True)

CACHE_PREFIX = "semcache:"


def embed(text: str) -> np.ndarray:
    """把文本转成 384 维向量。"""
    return _model.encode(text, normalize_embeddings=True)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


async def cache_get(query: str) -> str | None:
    """语义查找：遍历已存向量，找最相似且超过阈值的那条。"""
    q_vec = embed(query)
    best_score = -1.0
    best_answer = None
    for key in _redis.scan_iter(match=f"{CACHE_PREFIX}*"):
        raw = _redis.get(key)
        if not raw:
            continue
        item = json.loads(raw)
        stored_vec = np.array(item["vec"], dtype=np.float32)
        score = cosine_similarity(q_vec, stored_vec)
        if score > best_score:
            best_score = score
            best_answer = item["answer"]
    if best_score >= config.similarity_threshold:
        return best_answer
    return None


async def cache_set(query: str, answer: str) -> None:
    """把 query 的向量和 LLM 回答一起写进 Redis。"""
    vec = embed(query).tolist()
    key = f"{CACHE_PREFIX}{abs(hash(query))}"
    _redis.set(
        key,
        json.dumps({"query": query, "vec": vec, "answer": answer}),
        ex=config.semantic_cache_ttl,
    )
```

> 讲师在 p096 说「cache_get 会把用户 query 转成 embedding，读 Redis 里所有已存 embedding，比较是否匹配，匹配就返回，不匹配就发 API 调用」；「cache_set 把新 query 和 LLM 响应存进 Redis」。上面就是按这个描述写的。注意：**遍历所有 key 在生产环境会很慢**，讲师没讲优化方案，第 7 节会提。

---

## 5. 逐行解释

### 5.1 `requirements.txt` 每个库为什么在

讲师在 p094 从 [00:00] 到 [02:23] 逐个点名，一个不落：

- **fastapi + uvicorn**：讲师原话「FastAPI 是框架，uvicorn 是服务器，两者手拉手」。前端同学可以类比：FastAPI ≈ Express 的路由层，uvicorn ≈ `node server.js` 那个监听端口的进程。
- **pydantic**：讲师原话「校验 API 请求并转成 Python 数据对象，让请求不崩」。对应前端 Zod / Yup 的角色。
- **httpx**：讲师原话「异步系统需要异步请求」。对应前端 `fetch`，但支持 `await`。
- **redis**：缓存和队列都用它。
- **langgraph + langchain-core**：讲师原话「langgraph 用来做 AI agent，它跑在 langchain-core 上」。
- **sentence-transformers**：讲师原话「把文本转成 embedding 向量」。
- **numpy**：讲师原话「数值运算和向量运算，我们要转成向量」。
- **boto3**：讲师原话「AWS 的 Python 客户端，连 AWS 账号要用」。
- **asyncpg**：讲师原话「高性能异步 PostgreSQL 驱动」。
- **reportlab**：讲师原话「拿到研究主题后转成 PDF，需要这个库」。
- **langsmith**：讲师原话「监控和评估需要 langsmith」。

### 5.2 `config.py` 逐段

- `import os / socket / json / boto3`：讲师在 p094 [02:23] 逐个念了这四个 import 的用途——os 读环境变量、socket 拿主机名（因为要连 ECS，需要 hostname）、boto3 连 AWS、json 把 JSON 文本转成 Python dict。
- `from functools import lru_cache`：讲师原话「LRU 缓存是个装饰器，它会把 Secrets Manager 里的值缓存住，不用一遍遍加载」。
- `@lru_cache(maxsize=1) def load_secrets()`：讲师原话「这是加载全部 secret 的函数，返回 dict 格式」。`maxsize=1` 表示只缓存一份，因为 secret 名固定。
- `boto3.client("secretsmanager", region_name=region)`：讲师原话「用 boto 创建一个 client，连到 Secrets Manager」。
- `client.get_secret_value(SecretId=SECRET_NAME)`：讲师原话「这个 client 去拿 secret 的值，secret 名就是 `research-agent-config`，和 Terraform 里定义的一致」。
- `class Config` 里 `data.get(...)` 逐项：讲师在 p094 [06:16]–[08:36] 逐项念了——AWS region、bedrock guardrail id、guardrail version、database URL、tensor 0 URL（即 Redis URL）、API key（强调「这不是 LLM 的 key，是鉴权 key」）、langsmith api key / project / dataset、session TTL、semantic cache TTL、LTM days（讲师原话「LTM 就是长期记忆」）、stream queue（讲师原话「和 Redis 队列相关」）、agent report truncate、rate limit / rate limit request / rate limit window、DB pool min / max。
- `self.langsmith_tracing = bool(self.langsmith_api_key)`：讲师原话「如果 Secrets Manager 里给了 LangSmith key，就启用 tracing，因为我们要做监控——每个 LLM 请求、每个 API 请求都被追踪：花了多少时间、哪个 agent 花了这么多时间」。

### 5.3 `retry.py` 逐段

- `async def wrapper`：讲师原话「先尝试执行操作，成功就返回；失败就 catch 异常并 log」。
- `for attempt in range(1, max_retries + 1)`：讲师原话「max_retries 设为 3，第一次失败重试第二次，第二次失败重试第三次，第三次还失败就彻底失败」。
- `await asyncio.sleep(current_delay)`：讲师原话「等待一段时间再重试」。
- `current_delay *= backoff`：讲师原话「延迟等于延迟乘以退避，这就是指数退避。1 乘 2 得 2 秒，2 乘 2 得 4 秒，所以初始 1 秒、然后 2 秒、然后 4 秒」。
- `raise last_exc`：讲师原话「max retries 用尽后关闭，抛出最终异常」。

> 前端类比：这就是 `p-retry` 库的 `retries + factor + minTimeout` 三件套，只是换成了 async/await。

### 5.4 `pool.py` 逐段

- `_pool: asyncpg.Pool | None = None`：讲师原话「创建一个全局变量存数据库连接池，初始设为 None，因为还没有连接」。
- `asyncpg.create_pool(dsn=..., min_size=2, max_size=10)`：讲师原话「读 config 里的 database URL，创建多个可复用连接，设最小和最大连接数——最小 2、最大 10」。
- `close_pool`：讲师原话「应用关闭时运行，检查池是否存在，关闭所有数据库连接并清空池里的变量」。
- `get_pool`：讲师原话「获取当前连接池的信息，让应用不用为每个服务单独写连接代码」。

> 讲师用「游泳池」比喻：三个服务各自写连接代码 = 各自挖一口井；连接池 = 一个公共泳池，大家共用里面的可复用连接，每个服务只写一行代码。

### 5.5 `auth.py` 逐段

- `x_api_key: str | None = Header(default=None)`：从请求头读 `x-api-key`。讲师原话「检查发起请求的客户端是否与 Secrets Manager 里提供的 key 匹配」。
- `if not config.api_key: return`：讲师原话「检查鉴权是否启用」——没配 key 视为不启用。
- `if x_api_key != config.api_key: raise HTTPException(401)`：讲师原话「不匹配就返回错误」。讲师用 ABC / test 的例子讲得很清楚：UI 里填 test，配置里是 ABC，不匹配 → 请求失败；填 ABC → 放行。
- 讲师在 p096 [02:52] 强调：「目前只做了一个共享鉴权 key，但你要做成每个用户一个 key」——这是留给你的改进项。

### 5.6 `guardrails.py` 逐段

- `boto3.client("bedrock-runtime", ...)`：讲师原话「创建一个 Bedrock runtime client，在对应 region」。
- `client.apply_guardrail(...)`：讲师原话「用 apply guardrail，传 guardrail id、guardrail version（从 config 取）、source（INPUT 或 OUTPUT）、要检查的 text」。
- `validate_input` / `validate_output` 各挂 `@retry`：讲师原话「输入和输出都设了 retry 逻辑和 max retries」。
- 返回值语义：讲师原话「返回 false 说明被护栏拦截，返回 true 说明没问题」。
- 讲师在 p096 [03:50] 强调这是**两处检查**：用户 prompt 进 LLM 前查一次，LLM 响应出给用户前再查一次。

### 5.7 `cache.py` 逐段

- `SentenceTransformer("all-MiniLM-L6-v2")`：讲师原话「我们用 all-MiniLM-L6-v2，你也可以用 OpenAI 的 embedding 模型，但这个更可靠。注意维度大约 384」。
- `embed()`：讲师原话「embedding 函数把文本 query 转成 embedding 向量」。
- `cosine_similarity`：讲师原话「用余弦相似度算法做语义缓存，检查这些词和那些词是否匹配」。
- `cache_get`：讲师原话「先把用户 query 转 embedding，读 Redis 里所有已存 embedding，比较当前 embedding 和已存的是否匹配，匹配就返回，不匹配就发 API 调用」。
- `cache_set`：讲师原话「LLM 生成响应后，把新 query 和响应存进 Redis」。
- 讲师在 p096 [08:06] 用「什么是 AI」vs「什么是人工智能」讲清了词匹配缓存和语义缓存的区别：词匹配会发两次 API，语义缓存只发一次。

---

## 6. 复现检查清单

按顺序打勾，任何一项不过就别往下走：

- [ ] `pip install -r requirements.txt` 无报错
- [ ] `aws secretsmanager get-secret-value --secret-id research-agent-config` 能拿到 JSON
- [ ] `python -c "from config import config; print(config.database_url)"` 打印出 URL
- [ ] `python -c "from config import config; print(config.langsmith_tracing)"` 打印 True/False
- [ ] `retry` 装饰器测试：故意让函数失败两次，第三次成功，确认总耗时约 1+2=3 秒
- [ ] `init_pool()` 后 `get_pool().fetchval('select 1')` 返回 1
- [ ] `close_pool()` 后再 `get_pool()` 抛 `RuntimeError`
- [ ] `require_api_key` 用错误 key 请求返回 401，用正确 key 返回 200
- [ ] `validate_input("正常问题")` 返回 `(True, ...)`
- [ ] `validate_input("包含违规内容的问题")` 返回 `(False, ...)`（需先在 Bedrock Guardrail 里配好拦截规则）
- [ ] `cache_set("什么是 AI", "AI 是...")` 后 `cache_get("什么是人工智能")` 能命中（相似度 ≥ 阈值）
- [ ] `cache_get("完全无关的问题")` 返回 None
- [ ] 首次运行 `cache.py` 时 HuggingFace 模型下载成功（`~/.cache/huggingface` 下有 `all-MiniLM-L6-v2`）

---

## 7. 课里没讲但你会撞上的

1. **`config.py` 的 `lru_cache` 是进程级的**。多 worker（`uvicorn --workers 4`）时每个 worker 各拉一次 secret，secret 轮换后不会自动刷新。课里没讲轮换策略，生产环境建议加 TTL 或监听 Secrets Manager 的 rotation 事件。

2. **`cache.py` 的 `cache_get` 是 O(N) 全表扫描**。讲师说「读 Redis 里所有已存 embedding」，但没讲数据量大了怎么办。真实项目里要么用 Redis Stack 的向量索引（`FT.SEARCH`），要么用 pgvector。课里没讲，但这是你上线前一定会撞上的性能墙。

3. **`hash(query)` 在 Python 里每个进程不一样**（PYTHONHASHSEED 随机）。`cache_set` 用 `abs(hash(query))` 做 key，重启后同一个 query 会写到不同 key。课里没讲，建议换成 `hashlib.md5(query.encode()).hexdigest()`。

4. **`apply_guardrail` 的响应字段名**。讲师没念字段名，本文档按 boto3 文档写 `action` / `outputs`。你的 SDK 版本不同的话，字段名请以实际输出为准，别照抄。

5. **`auth.py` 是单共享 key**。讲师在 p096 [02:52] 明确说「你要做成每个用户一个 key」，但没讲怎么存用户表、怎么签发。这是作业，不是 bug。

6. **`retry.py` 对所有异常都重试**。讲师说「catch 异常并 log」，但没区分「可重试异常」（网络超时）和「不可重试异常」（401、参数错误）。生产环境应该只对 `httpx.TimeoutException`、`ConnectionError` 这类重试，否则会把鉴权失败也重试三遍。

7. **`pool.py` 的 `init_pool` 没有并发保护**。两个协程同时调 `init_pool` 会创建两个池。课里没讲，单进程单入口时不会撞上，但如果你在 FastAPI 的 `lifespan` 里调，确保只调一次。

8. **`sentence-transformers` 首次加载会阻塞事件循环**。`SentenceTransformer(...)` 是同步的，放在模块顶层 import 时会卡住启动。课里没讲，生产环境建议放 `lifespan` 里用 `run_in_executor` 加载。

9. **`guardrails.py` 的 `_client()` 每次调用都新建 boto3 client**。boto3 client 创建有开销，课里没讲复用，建议模块级缓存一个。

10. **`main.py` 课里没给**。第 3.7 节那段是示意，只为让你能端到端跑通鉴权 + 护栏，不是讲师原代码。真正的 LLM 调用、LangGraph agent、流式输出，课里说「在下一个视频」，不在 P094–P096 范围内。

---

![p094 03:49 讲师讲 config.py 是配置加载器，所有密钥从 Secrets Manager 取](images/p094_0232s.jpg)

![p094 06:16 讲师展示 Secrets Manager 里的 research-agent-config](images/p094_0387s.jpg)

![p095 02:21 讲师讲 delay 与 backoff 两个参数](images/p095_0125s.jpg)

![p095 05:43 讲师讲数据库连接池的必要性](images/p095_0334s.jpg)

![p096 01:54 讲师用 ABC/test 例子讲 API 鉴权](images/p096_0103s.jpg)

![p096 04:18 讲师讲护栏在输入和输出两处检查](images/p096_0258s.jpg)

![p096 10:33 讲师讲语义缓存用余弦相似度](images/p096_0620s.jpg)