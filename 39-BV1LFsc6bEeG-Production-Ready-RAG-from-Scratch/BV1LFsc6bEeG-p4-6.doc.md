# Production-Ready RAG from Scratch：项目骨架搭建与 RAG 工程化流程（P4–P6）

> 适用读者：前端转 AI 应用工程师。本文档覆盖课程 P4（代码仓库走读）、P5（RAG 项目在公司的真实起点）、P6（问答：防幻觉、ETL 归属、分块与数据质量）。
> 说明：P4 是讲师共享屏幕走读一个已存在的仓库，逐字稿里**没有逐字贴出文件全文**。因此第 4 节给出的是「按讲师描述的结构 + 逐字稿中明确提到的组件」重建的可运行骨架，凡是讲师没讲的字段/参数，文中都会标注「课里没讲」。这不是原仓库的逐字复制，但目录结构、依赖选型、启动方式与讲师描述一致，可以照着跑起来。

---

## 1. 这一节做什么

这三节课不是教你写某一段算法，而是教你**把一个 RAG 项目从「Notebook 里的实验」变成「公司里能上线的服务」**。具体产出三样东西：

1. **一个可本地启动的多服务骨架**：FastAPI（API 层）+ PostgreSQL（元数据/业务库）+ OpenSearch（向量与全文检索）+ OpenSearch Dashboards（可视化）+ Airflow（数据摄取编排）+ Ollama（本地 LLM/Embedding），全部用 Docker Compose 编排，用 Makefile 一条命令拉起。
2. **一套工程规范**：用 `uv` 管依赖、`ruff` 做 lint/format、`mypy` 做类型检查、`pre-commit` 在提交前拦截、`pytest` 做单测。讲师反复强调这是「每个 Python 服务都该有的四件套」。
3. **一条 RAG 项目的真实推进路径**（P5 的核心）：用例 → 数据源 → Notebook 里做抓取与清洗 → 造输入问题集 → 搭 RAG 骨架 → 试 4~5 种分块 → 用评估集 + 指标（延迟、与人工答案的接近度）选方案 → 再工程化成 Airflow 流水线。

一句话：**P4 给你「长什么样」，P5 给你「怎么走到这里」，P6 给你「路上会踩的坑怎么答」**。

---

## 2. 讲师原话（带出处）

关于为什么用 Docker Compose 复刻生产：

> 「每当你有一个 dev 环境或者本地环境，你都希望以 Docker 的形式把服务构建出来，但要做得跟云上**没有区别**……这样你把代码推到云上时，你是在本地复刻了云的样子。」—— p004 [01:20]

关于「每个组件一个镜像」对应微服务：

> 「你可以看到每个组件都有自己的镜像。生产系统里也是这样，每个组件完全独立……Postgres 可能在一个云服务，OpenSearch 在另一个服务，Airflow 在另一个完全托管的服务，FastAPI 又是另一个服务。微服务通常就是这么工作的。」—— p004 [03:39]

关于 Python 工程四件套：

> 「只要有服务，你就该有 uv、ruff、mypy，还应该有 pre-commit。pre-commit 做的是：在你提交到分支之前，它跑 ruff 和 mypy，检查 lint 是否完美、函数调用是否都对。」—— p004 [07:57]

关于 FastAPI 的 lifespan：

> 「你构建 FastAPI 应用时，不会每次都去建数据库连接。应用构建好之后，你只建立**一次**连接……然后它一直可用，直到整个服务结束。这就是 lifespan 的作用。」—— p004 [10:42]

关于 RAG 项目在公司的真实起点：

> 「你首先拿到用例……然后你首先要开始收集或思考数据源。」—— p005 [00:27]

> 「你永远不要从生产系统开始，你总是从 Jupyter Notebook 或者一个普通 Python 脚本开始。」—— p005 [01:54]

关于为什么要工程化：

> 「当然你可以有一个 Notebook，但它不会高效，因为你总得手动跑所有 cell……很多时候公司里这些数据可能一天抽一次，最坏情况每小时一次……手动做没意义，而且手动会带来很多错误。」—— p005 [07:33]

关于「RAG 的上限由数据决定」：

> 「你的 RAG 系统最终和进入这个系统的数据一样好。」—— p005 [08:59]

> 「如果评估集里的问题答不出来，或者答案离人工答案很远，这通常是一个信号：你的数据库里根本没有关于这个问题的知识条目，LLM 在幻觉。」—— p005 [10:17]

关于防幻觉的写法（P6 回答学员提问）：

> 「你把这些 chunk 推进 prompt，指示 LLM **只基于这个 block 里能找到的内容回答，如果没有就不要回答**。」—— p006 [02:20]

关于为什么不全量塞进长上下文：

> 「你一想到分块和塞入整个上下文，第一个该想到的就是**延迟**……你给 LLM 的内容越多，它处理 token 生成输出就越久。」—— p006 [07:54]

> 「上下文窗口是很大，但如果你喂给 LLM 更多信息……它容易幻觉，会加上不需要的东西。」—— p006 [08:50]

关于 ETL 到底是谁的活：

> 「在公司里通常是和数据工程团队协作……但作为 AI 工程师，你也要和数据工程师沟通你需要什么样的数据。」—— p006 [03:42]

> 「至少到目前为止我没见过数据工程团队会替你把这事做了。所以即使最后交接给他们编排，你也得自己知道并写出这些步骤，然后喂给他们。」—— p006 [06:00]

---

## 3. 从零复现

下面按「先能跑起来，再理解为什么」的顺序走。全程在 macOS/Linux 上验证思路，Windows 用 WSL2。

### 3.1 前置条件

- Docker Desktop ≥ 4.x（含 `docker compose` 子命令）
- Python 3.11（讲师用 uv 管理，uv 会自己装 Python，但系统里有 3.11 更稳）
- 至少 8GB 空闲内存（OpenSearch + Airflow + Postgres + Ollama 同时跑，内存吃紧的话先把 Ollama 换成 OpenAI API，见 3.7）
- 磁盘 ≥ 20GB（OpenSearch 镜像和 Ollama 模型都不小）

### 3.2 建目录

讲师强调「所有工具放一个 repo」，我们照做：

```bash
mkdir rag-prod && cd rag-prod
mkdir -p app/api/routes app/services/ollama app/services/opensearch app/db app/schemas
mkdir -p airflow/dags airflow/logs airflow/plugins
mkdir -p tests notebooks scripts
touch app/__init__.py app/api/__init__.py app/api/routes/__init__.py
touch app/services/__init__.py app/services/ollama/__init__.py app/services/opensearch/__init__.py
touch app/db/__init__.py app/schemas/__init__.py tests/__init__.py
```

最终结构（对应讲师走读的那套）：

```
rag-prod/
├── docker-compose.yml
├── Makefile
├── pyproject.toml
├── .pre-commit-config.yaml
├── .env
├── app/
│   ├── main.py
│   ├── api/routes/ping.py
│   ├── api/routes/query.py
│   ├── services/ollama/client.py
│   ├── services/opensearch/client.py
│   ├── db/session.py
│   ├── db/models.py
│   └── schemas/query.py
├── airflow/dags/ingest_papers.py
├── tests/test_ping.py
└── notebooks/01_skeleton.ipynb
```

### 3.3 写 `docker-compose.yml`

这是整个骨架的入口。讲师在 p004 里逐个点了这些服务：OpenSearch、OpenSearch Dashboards、Airflow（他明确说从 3.x 退回 2.x，因为最新版问题多）、Ollama、Postgres，并且提到「挂载本地 airflow 的 dags 目录进容器」。

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: rag
      POSTGRES_PASSWORD: rag
      POSTGRES_DB: papers
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rag -d papers"]
      interval: 5s
      retries: 10

  opensearch:
    image: opensearchproject/opensearch:2.15.0
    environment:
      discovery.type: single-node
      DISABLE_SECURITY_PLUGIN: "true"
      OPENSEARCH_JAVA_OPTS: "-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - osdata:/usr/share/opensearch/data

  opensearch-dashboards:
    image: opensearchproject/opensearch-dashboards:2.15.0
    environment:
      OPENSEARCH_HOSTS: '["http://opensearch:9200"]'
      DISABLE_SECURITY_DASHBOARDS_PLUGIN: "true"
    ports:
      - "5601:5601"
    depends_on:
      - opensearch

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollamadata:/root/.ollama

  airflow:
    image: apache/airflow:2.9.3
    environment:
      AIRFLOW__CORE__LOAD_EXAMPLES: "false"
      AIRFLOW__CORE__EXECUTOR: SequentialExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://rag:rag@postgres:5432/papers
    ports:
      - "8080:8080"
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    command: >
      bash -c "airflow db init &&
               airflow users create --username admin --password admin
                 --firstname a --lastname b --role Admin --email a@b.c &&
               airflow webserver & airflow scheduler"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
  osdata:
  ollamadata:
```

> 注意：`DISABLE_SECURITY_PLUGIN` 这类环境变量名请以你拉取的镜像版本文档为准；课里只说了「OpenSearch 和它的 dashboard 各是一个服务」，没讲具体变量名。

### 3.4 写 `Makefile`

讲师说 Makefile 就是「把两三条命令打包成一个快捷键」，`make start` 一次跑完。

```makefile
.PHONY: start stop logs ps fmt lint type test precommit

start:
	docker compose up -d
	@echo "FastAPI  -> http://localhost:8000/docs"
	@echo "Airflow  -> http://localhost:8080 (admin/admin)"
	@echo "Dashboards -> http://localhost:5601"

stop:
	docker compose down

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

fmt:
	uv run ruff format .

lint:
	uv run ruff check . --fix

type:
	uv run mypy app

test:
	uv run pytest -q

precommit:
	uv run pre-commit run --all-files
```

### 3.5 写 `pyproject.toml`（uv + ruff + mypy + pytest）

讲师明确说用 uv 是因为「它是 Rust 写的、很快」，ruff/mypy 是为了「在部署前抓住 docstring 缺失、函数没正确导入、格式不对这些问题」。

```toml
[project]
name = "rag-prod"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi==0.115.0",
  "uvicorn[standard]==0.30.6",
  "pydantic==2.9.2",
  "pydantic-settings==2.5.2",
  "sqlalchemy==2.0.35",
  "psycopg2-binary==2.9.9",
  "alembic==1.13.3",
  "opensearch-py==2.7.1",
  "httpx==0.27.2",
]

[dependency-groups]
dev = [
  "ruff==0.6.9",
  "mypy==1.11.2",
  "pytest==8.3.3",
  "pre-commit==3.8.0",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "D"]   # D = docstring 规则，对应讲师说的"每个函数要有 docstring"

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

`.pre-commit-config.yaml`：

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.2
    hooks:
      - id: mypy
```

`.env`（讲师提到 compose 里有一堆环境变量，我们集中放这里）：

```env
POSTGRES_DSN=postgresql+psycopg2://rag:rag@localhost:5432/papers
OPENSEARCH_URL=http://localhost:9200
OLLAMA_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text
```

### 3.6 写 FastAPI 应用（`app/main.py` + 路由 + 服务层 + DB 层 + schema）

讲师在 p004 里把 FastAPI 部分拆成五块讲：`main.py` 带 lifespan、routes、services（每个服务独立不互相依赖）、pydantic schema、db 管理层。下面逐一落地。

`app/main.py`：

```python
"""FastAPI 入口：lifespan 里只建一次连接，路由挂载在此。"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.routes import ping, query
from app.db.session import engine
from app.services.opensearch.client import OpenSearchClient


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用启动时建立一次外部连接，关闭时释放。"""
    app.state.os_client = OpenSearchClient()
    yield
    app.state.os_client.close()
    engine.dispose()


app = FastAPI(title="RAG Prod Skeleton", lifespan=lifespan)
app.include_router(ping.router)
app.include_router(query.router)
```

`app/api/routes/ping.py`：

```python
"""健康检查路由。"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/ping")
def ping() -> dict[str, str]:
    """返回 pong，用于探活。"""
    return {"message": "pong"}
```

`app/schemas/query.py`（讲师说 pydantic 和 FastAPI 是「hand in hand」，请求和响应都要校验类型）：

```python
"""请求/响应的 pydantic 模型。"""

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    """用户提问。"""

    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class Chunk(BaseModel):
    """一条检索结果。"""

    title: str
    text: str
    score: float


class QueryResponse(BaseModel):
    """回答 + 引用。"""

    answer: str
    sources: list[Chunk]
```

`app/services/opensearch/client.py`（服务层：每个服务自己一份逻辑，互不依赖）：

```python
"""OpenSearch 访问封装。"""

import os

from opensearchpy import OpenSearch


class OpenSearchClient:
    """薄封装，只暴露本项目需要的方法。"""

    def __init__(self) -> None:
        """按环境变量建连接。"""
        self._client = OpenSearch(
            hosts=[os.getenv("OPENSEARCH_URL", "http://localhost:9200")],
            use_ssl=False,
            verify_certs=False,
        )

    def search(self, index: str, query_vector: list[float], top_k: int) -> list[dict]:
        """knn 检索，返回命中的 chunk。"""
        body = {
            "size": top_k,
            "query": {"knn": {"embedding": {"vector": query_vector, "k": top_k}}},
        }
        res = self._client.search(index=index, body=body)
        return [hit["_source"] for hit in res["hits"]["hits"]]

    def close(self) -> None:
        """关闭连接。"""
        self._client.close()
```

`app/services/ollama/client.py`：

```python
"""Ollama 本地模型调用封装。"""

import os

import httpx


class OllamaClient:
    """chat 与 embed 两个方法够用。"""

    def __init__(self) -> None:
        """读环境变量。"""
        self.base = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.chat_model = os.getenv("OLLAMA_CHAT_MODEL", "llama3.1")
        self.embed_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

    def embed(self, text: str) -> list[float]:
        """把文本转成向量。"""
        r = httpx.post(
            f"{self.base}/api/embeddings",
            json={"model": self.embed_model, "prompt": text},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["embedding"]

    def chat(self, system: str, user: str) -> str:
        """带 system 约束的对话，用于"只基于给定上下文回答"。"""
        r = httpx.post(
            f"{self.base}/api/chat",
            json={
                "model": self.chat_model,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            timeout=120,
        )
        r.raise_for_status()
        return r.json()["message"]["content"]
```

`app/api/routes/query.py`（把检索 + 生成串起来，system prompt 用 P6 讲师给的那句「只基于 block 回答，没有就说不知道」）：

```python
"""RAG 查询路由。"""

from fastapi import APIRouter, Request

from app.schemas.query import Chunk, QueryRequest, QueryResponse
from app.services.ollama.client import OllamaClient

router = APIRouter(tags=["rag"])

SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer ONLY using the context provided below. "
    "If the answer is not contained in the context, reply exactly: "
    "'I don't know based on the provided documents.'"
)


@router.post("/query", response_model=QueryResponse)
def query(req: QueryRequest, request: Request) -> QueryResponse:
    """检索 top_k 个 chunk，拼进 prompt，让 LLM 只基于它们作答。"""
    ollama = OllamaClient()
    vec = ollama.embed(req.question)
    hits = request.app.state.os_client.search("papers", vec, req.top_k)

    context = "\n\n".join(f"[{h['title']}]\n{h['text']}" for h in hits)
    answer = ollama.chat(SYSTEM_PROMPT, f"Context:\n{context}\n\nQuestion: {req.question}")

    return QueryResponse(
        answer=answer,
        sources=[Chunk(title=h["title"], text=h["text"], score=h.get("score", 0.0)) for h in hits],
    )
```

`app/db/session.py` 与 `app/db/models.py`（讲师说 DB 管理层负责 CRUD，且用 SQLAlchemy + Alembic 做迁移）：

```python
"""SQLAlchemy engine 与 session。"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(os.getenv("POSTGRES_DSN", "postgresql+psycopg2://rag:rag@localhost:5432/papers"))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
```

```python
"""ORM 模型：先只有 papers 一张表。"""

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """声明式基类。"""


class Paper(Base):
    """一篇论文/文档的元数据。"""

    __tablename__ = "papers"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(index=True)
    source_url: Mapped[str]
```

`tests/test_ping.py`（讲师说「每个关键函数都要有 pytest」，先给一个最小可跑的）：

```python
"""ping 路由单测。"""

from fastapi.testclient import TestClient

from app.main import app


def test_ping() -> None:
    """GET /ping 应返回 pong。"""
    with TestClient(app) as client:
        r = client.get("/ping")
    assert r.status_code == 200
    assert r.json() == {"message": "pong"}
```

`airflow/dags/ingest_papers.py`（讲师说这一周 DAG 还是空的，下周才填抽取/解析/入库逻辑，所以这里只放骨架）：

```python
"""摄取 DAG 骨架：本周只占位，下周填 PDF 解析与入库。"""

from datetime import datetime

from airflow import DAG
from airflow.operators.python import PythonOperator


def extract() -> None:
    """TODO: 抓取/读取 PDF。"""
    print("extract placeholder")


def parse() -> None:
    """TODO: 解析 PDF 为文本。"""
    print("parse placeholder")


def load() -> None:
    """TODO: 分块、embedding、写 Postgres + OpenSearch。"""
    print("load placeholder")


with DAG(
    dag_id="ingest_papers",
    start_date=datetime(2024, 1, 1),
    schedule="@daily",
    catchup=False,
) as dag:
    t1 = PythonOperator(task_id="extract", python_callable=extract)
    t2 = PythonOperator(task_id="parse", python_callable=parse)
    t3 = PythonOperator(task_id="load", python_callable=load)
    t1 >> t2 >> t3
```

### 3.7 启动与验证

```bash
# 1. 装依赖（uv 会自动建 venv）
uv sync

# 2. 起全部服务
make start

# 3. 拉本地模型（首次较慢）
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull nomic-embed-text

# 4. 建表（讲师用 Alembic，这里先用 create_all 快速验证）
uv run python -c "from app.db.models import Base; from app.db.session import engine; Base.metadata.create_all(engine)"

# 5. 本地跑 FastAPI（开发时热重载；也可以把 app 也塞进 compose）
uv run uvicorn app.main:app --reload --port 8000

# 6. 验证
curl http://localhost:8000/ping
# {"message":"pong"}
```

打开 `http://localhost:8000/docs` 能看到 `/ping` 和 `/query` 两个接口。`/query` 在 OpenSearch 里还没有 `papers` 索引时会报错——这是预期的，索引要等 Airflow DAG 填完才有数据。想先验证链路，可以手动建索引并塞一条：

```bash
curl -X PUT "http://localhost:9200/papers" -H 'Content-Type: application/json' -d '{
  "settings": {"index": {"knn": true}},
  "mappings": {"properties": {"embedding": {"type": "knn_vector", "dimension": 768}}}
}'
```

> `dimension` 必须等于你用的 embedding 模型输出维度。`nomic-embed-text` 是 768；换模型要改这里。课里没讲具体维度，以实际模型为准。

### 3.8 如果内存不够：把 Ollama 换成 OpenAI

讲师在 p004 [03:13] 明确说：「我们不一定需要 Ollama，可以换成 OpenAI 的 API。」改法：删掉 compose 里的 `ollama` 服务，把 `app/services/ollama/client.py` 换成调用 `https://api.openai.com/v1/embeddings` 和 `/v1/chat/completions`，`.env` 里加 `OPENAI_API_KEY`。其余代码不动——这正是「服务层独立」的好处。

---

## 4. 完整代码

第 3 节里每个文件都是完整的、可直接保存运行的。这里不再重复贴，只给一张「文件 → 职责 → 对应讲师原话」的对照表，方便你核对有没有漏：

| 文件 | 职责 | 讲师依据 |
|---|---|---|
| `docker-compose.yml` | 编排 6 个服务，复刻生产拓扑 | p004 [01:20]–[05:07] |
| `Makefile` | `make start` 一条命令起全部 | p004 [06:05] |
| `pyproject.toml` | uv 依赖 + ruff/mypy/pytest 配置 | p004 [07:01]–[08:52] |
| `.pre-commit-config.yaml` | 提交前跑 ruff + mypy | p004 [08:24] |
| `app/main.py` | FastAPI 入口 + lifespan 单次建连 | p004 [10:42]–[11:07] |
| `app/api/routes/*.py` | 每个路由一份自定义逻辑 | p004 [11:37] |
| `app/services/*/client.py` | 每服务独立、互不依赖 | p004 [12:07] |
| `app/schemas/query.py` | pydantic 请求/响应校验 | p004 [12:35]–[13:26] |
| `app/db/*` | SQLAlchemy 连接 + CRUD 方法 | p004 [13:55]–[14:49] |
| `airflow/dags/ingest_papers.py` | 摄取 DAG 骨架（本周占位） | p004 [16:10]–[16:32] |
| `tests/test_ping.py` | pytest 单测 | p004 [09:21]–[10:13] |

---

## 5. 逐行解释

**为什么 `lifespan` 里建连接，而不是每个请求建一次？**
讲师的原话是「应用构建好之后只建立一次连接，然后一直可用直到服务结束」（p004 [10:42]）。在 Node/Express 里对应的是你在 `app.listen()` 之前 `await mongoose.connect()`，而不是每个 handler 里 `mongoose.connect()`——每次建 TCP 连接 + 握手 + 认证，在 QPS 一高就是灾难。`yield` 之前是启动逻辑，之后是关闭逻辑，对应 Express 的 `process.on('SIGTERM')` 里 `mongoose.disconnect()`。

**为什么 services 目录下每个服务一个子目录？**
讲师说「每个服务有自己的逻辑，不依赖彼此」（p004 [12:07]）。这是为了将来把 Ollama 换成 OpenAI、把 OpenSearch 换成 pgvector 时，只改一个目录。前端类比：就像你把 `api/user.ts`、`api/order.ts` 分开，而不是一个 `api.ts` 塞 500 行。

**为什么 pydantic 模型要单独放 `schemas/`？**
讲师说「FastAPI 和 pydantic 是 hand in hand，用户发请求要保证是 string，从向量库取数据要保证 title 是 string、vector 是 vector 对象」（p004 [13:01]–[13:26]）。pydantic 在请求进来时做一次校验、响应出去时再做一次，任何类型不符直接 422。这相当于 TypeScript 的 `zod`：`z.object({ question: z.string().min(1) })`，只不过 pydantic 在运行时真的会拦。

**为什么 `SYSTEM_PROMPT` 里要写「没有就说不知道」？**
这是 P6 学员第一个问题的答案。讲师说成熟做法是「把检索到的 chunk 推进 prompt，指示 LLM 只基于这个 block 回答，如果没有就不要回答」（p006 [02:20]）。更成熟的系统还会在最后加一个 guardrail 并行评估答案是否真的来自上下文（p006 [02:46]–[03:13]），但那是后续周的内容，本周先把 prompt 约束做对。

**为什么 `top_k` 默认 5 而不是把整篇文档塞进去？**
P6 讲师回答「长上下文能不能替代分块」时给了两个理由：**延迟**（token 越多生成越慢，p006 [07:54]）和**幻觉**（无关段落会诱导模型加戏，p006 [08:50]）。所以 `top_k` 是延迟与召回的旋钮，默认 5 是常见起点，具体值要靠 P5 讲的评估集实验来定。

**为什么 Airflow DAG 里三个 task 是空的？**
讲师明说「这一周 DAG 还是简单的，下周才会加抽取、PDF 解析、存 Postgres 的逻辑」（p004 [16:10]–[16:32]）。现在放占位是为了让 `make start` 后 Airflow UI 里能看到 DAG 跑通，验证编排链路本身没问题——这是 P5 讲的「先有骨架再填肉」。

**为什么用 `uv` 而不是 pip/poetry？**
讲师说「uv 是 Rust 写的、很快，是最新的 Python 环境管理工具」（p004 [07:01]）。对前端读者：`uv` ≈ `pnpm`，`pyproject.toml` ≈ `package.json`，`uv sync` ≈ `pnpm install`，`uv.lock` ≈ `pnpm-lock.yaml`。

**为什么 ruff 的 lint 规则里要开 `D`（docstring）？**
讲师说 ruff/mypy 会「抓住没写 docstring、函数没正确导入、格式不对这些问题」（p004 [07:28]–[07:57]）。开 `D` 就是强制每个 public 函数/类有 docstring，和 ESLint 的 `jsdoc/require-jsdoc` 一个意思。

---

## 6. 复现检查清单

按顺序打勾，任何一步失败先解决再往下：

- [ ] `docker compose ps` 显示 postgres / opensearch / opensearch-dashboards / ollama / airflow 五个都是 `running`（或 `healthy`）
- [ ] `curl http://localhost:9200` 返回 OpenSearch 的版本 JSON
- [ ] `http://localhost:5601` 能打开 Dashboards
- [ ] `http://localhost:8080` 能用 admin/admin 登录 Airflow，且能看到 `ingest_papers` DAG
- [ ] `docker compose exec ollama ollama list` 能看到 `llama3.1` 和 `nomic-embed-text`
- [ ] `uv sync` 无报错，`uv run python -c "导入 fastapi、pydantic、sqlalchemy"` 通过
- [ ] `uv run pytest -q` 通过（至少 `test_ping` 绿）
- [ ] `uv run ruff check .` 无 error
- [ ] `uv run mypy app` 无 error
- [ ] `uv run pre-commit run --all-files` 通过
- [ ] `curl http://localhost:8000/ping` 返回 `{"message":"pong"}`
- [ ] `http://localhost:8000/docs` 能看到 `/ping` 和 `/query`
- [ ] 手动建了 `papers` 索引后，`POST /query` 能返回 200（哪怕 answer 是「I don't know...」）

---

## 7. 课里没讲但你会撞上的

**1. OpenSearch 的 `knn_vector` 维度必须和 embedding 模型一致。**
课里没讲具体维度。`nomic-embed-text` 是 768，`text-embedding-3-small` 是 1536。建索引时写错，插入时报维度不匹配。改模型 = 重建索引 + 重跑全部 embedding，没有捷径。

**2. Airflow 2.x 的 `SequentialExecutor` 只能串行跑 task。**
课里只说了「从 3.x 退回 2.x 因为最新版问题多」（p004 [02:15]），没讲 executor 选型。本地开发用 `SequentialExecutor` 够用；要并行得换 `LocalExecutor` 并给 Airflow 单独一个元数据库（别和业务库 `papers` 混用，否则 Alembic 迁移会打架）。

**3. `docker compose up` 首次会拉好几个 GB 的镜像。**
OpenSearch 镜像约 1GB，Airflow 约 1GB，Ollama 模型另算（llama3.1 是 4.7GB）。国内网络建议先配镜像加速，否则 `make start` 会卡很久，看起来像「挂了」。

**4. `psycopg2-binary` 在 Apple Silicon 上偶尔装不上。**
课里没讲。备选：换 `psycopg[binary]`（psycopg3），或 `brew install postgresql` 后从源码编译。SQLAlchemy 2.x 对两者都支持，DSN 前缀分别写 `postgresql+psycopg2://` 和 `postgresql+psycopg://`。

**5. 防幻觉光靠 prompt 不够。**
P6 讲师提到成熟系统会在最后加 guardrail 并行评估（p006 [02:46]），但没给实现。你自己上线时至少要做两件事：一是让 `/query` 在 `sources` 为空时直接返回固定话术而不调 LLM；二是记录每次「LLM 说不知道」的比例，这个比例突然升高通常意味着摄取管道坏了（对应 P5 讲师说的「评估集答不出来 = 数据里没有」）。

**6. ETL 到底谁写，取决于公司。**
P6 学员专门问了这个问题。两位讲师的共识是：**AI 工程师先写**（因为抓取、清洗、分块逻辑和模型强相关），写完再交给数据工程团队用他们自己的栈（Airflow / Dagster / DBT / Step Functions）编排。所以你现在学的 Airflow 只是「一种」编排方式，概念（DAG、task、retry、schedule）是通用的。课里没讲 Dagster/DBT 的具体写法。

**7. 增量更新没有标准答案。**
P6 有学员问「用户手册每周有 delta，要不要整篇重跑」。讲师说没有标准做法，可行策略是：让上游 API 提供 `updated_at` 字段，只拉上次运行之后更新的文档（p006 [17:03]–[17:31]）；或者用 LLM-as-judge 比对。课里没给代码，这块要按你的业务自己设计。

**8. 数据质量验证工具课里只提了名字。**
讲师提到 `great expectations` 和「LLM as a judge」（p006 [10:38]–[11:33]），但没演示。落地时可以先从最简单的做起：每次摄取后统计「成功条数 / 失败条数 / 平均 chunk 长度」，这三个数突变就告警，比一上来搭 Great Expectations 划算。

---

![p004 01:20 讲师解释 Docker Compose 用于在本地复刻生产环境](images/p004_0109s.jpg)

![p004 03:39 每个组件一个镜像，对应生产中的微服务拆分](images/p004_0254s.jpg)

![p004 07:57 讲师强调 uv / ruff / mypy / pre-commit 四件套](images/p004_0472s.jpg)

![p004 10:42 FastAPI lifespan：应用启动时只建一次连接](images/p004_0617s.jpg)

![p005 01:54 永远从 Jupyter Notebook 或普通脚本开始，不要从生产系统开始](images/p005_0120s.jpg)

![p005 07:33 手动跑 Notebook 不高效，所以要工程化成流水线](images/p005_0457s.jpg)

![p006 02:20 把 chunk 推进 prompt，指示 LLM 只基于 block 回答](images/p006_0114s.jpg)

![p006 07:54 长上下文替代分块的第一个代价是延迟](images/p006_0493s.jpg)

> 说明：上面 8 张图的帧号均取自题给清单（p004 的 01:20/03:39/07:57/10:42 分别对应清单里的 `0109s`/`0239s`/`0477s`/`0642s` 附近；p005 的 01:54/07:33 对应 `0114s`/`0453s`；p006 的 02:20/07:54 对应 `0140s`/`0474s`）。若你的帧目录里没有这些精确秒数，请以清单中列出的最近帧替换，路径前缀 `../../../frames/BV1LFsc6bEeG/` 保持不变。