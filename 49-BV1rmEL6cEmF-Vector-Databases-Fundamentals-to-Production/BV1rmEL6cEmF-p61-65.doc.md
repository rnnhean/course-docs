# Vector Databases Fundamentals to Production — P61–P65 复现文档

> 本段课程（P61–P65）是整门课里「本地跑通 PGVector」的关键五集：从 Docker 起 Postgres、装 pgvector 扩展、用 Python 连库、建带 vector 列的表、插入 embedding、最后跑三种相似度检索。下面按「能照着做出来」的标准重写。

---

## 1. 这一节做什么

这五集要交付的是一个**完全跑在本地的 PGVector 最小可运行系统**，包含四层：

1. **基础设施层**：用 Docker 在本地起一个 PostgreSQL 容器，并在容器里启用 `vector` 扩展（pgvector）。讲师反复强调 pgvector 不是独立数据库，而是挂在 Postgres 上的扩展。这一层的产出物是一个能 `docker ps` 看到、能 `psql` 进去、能 `\dx` 列出 `vector` 的容器。它决定了后面所有代码能不能跑起来——容器镜像选错（比如用了不带 pgvector 的官方 `postgres` 镜像），后面 `CREATE EXTENSION vector` 会直接报 `could not open extension control file`，整个链路就断了。
2. **连接层**：用 Python（`psycopg` / `psycopg2-binary` + `pgvector` + `langchain-postgres`）通过 `DATABASE_URL` 连上本地库，写 `connect()` / `enable_vector()` / `verify_pgvector()` 三个函数。这一层的关键是把「连接串」和「扩展启用」拆成两个独立动作：连接串错了报的是 `connection refused`，扩展没启用报的是 `type "vector" does not exist`，两类错误现象完全不同，拆开写才好排查。
3. **数据层**：建一张 `documents` 表，含 `id`、`content`、`embedding vector(1536)`、`metadata jsonb`、`created_at`，并建 HNSW 索引；用 OpenAI `text-embedding-3-small` 生成 1536 维向量，批量插入 8 条文档。这一层是整个系统的「事实来源」——检索层查的就是这张表，表结构错了（维度不对、metadata 类型不对、索引 opclass 不对），检索层要么报错要么慢到不可用。
4. **检索层**：实现三种相似度检索——余弦（cosine，推荐）、L2 欧氏距离、内积（inner product），并解释每种算子为什么这样写、排序方向为什么这样翻。这一层是 RAG 的「心脏」：query 进来先 embed，再拿向量去表里找最近的邻居，返回的 top-k 就是喂给 LLM 的上下文。

学完这五集，你应该能在本地用一条 SQL 查出「和我的 query 最像的文档」，并且理解 `<=>`、`<->`、`<#>` 三个算子的区别。更重要的是，你应该能独立判断：什么时候该用余弦、什么时候 L2 也行、内积那个负号到底在翻什么——这三件事在真实项目里天天被问，答错了检索质量会悄悄下降，而且不报错，最难查。

---

## 2. 讲师原话

> "要启用这个扩展，我们必须写 create extension if not exists vector。"
> —— p061 [00:29]

> "现在我们可以看到它确实存在了，因为能看到这些字段、行和列，一切正常。"
> —— p061 [00:59]

> "记住，PGVector 不是独立的东西，它是我们可以挂到 PostgreSQL 数据库上的东西，这正是我们在这里做到的。"
> —— p061 [01:18]

> "我们传入 database URL，但最重要的是要传本地 Postgres 的连接串。大多数情况下都是一样的，你大概只需要看一下端口、localhost 端口是否正确。"
> —— p062 [00:47]

> "我用了 uv，如果你用 pip 也一样。我加了不止一个依赖：psycopg、psycopg2-binary、pgvector，因为 Python 连接需要它，当然还有 langchain-postgres。"
> —— p062 [01:41]

> "所有向量在同一列里必须有相同的维度。所以永远选一个模型然后坚持用它，绝对不要混用不同模型的维度。"
> —— p063 [01:09]

> "embedding 这里我们写类型是 vector，这非常重要，然后写 1536。意思是 OpenAI 的维度是 1536 维。"
> —— p063 [00:40]

> "我们创建一个 DocumentsTable，它有一个 vector 列，这就是重点。id 是主键由数据库生成，content 是 text not null，embedding 是 vector，1536 维，和 OpenAI 模型一致。"
> —— p064 [01:06]

> "然后我们建索引，用于更快的相似度检索，用的是 HNSW。"
> —— p064 [02:26]

> "在真实应用里你当然会用 OpenAI 生成 embedding。现在先用 Python 跑一遍。"
> —— p064 [03:13]

> "记得要把 metadata 包成 JSON 类，否则会报错，这就是我们刚才那个错误的原因。"
> —— p064 [06:06]

> "相似度检索的核心思想是找到离你的 query 最近的文档，这就是 AI、RAG 的全部要点。"
> —— p065 [00:00]

> "这是 L2 距离算子。欧氏距离的意思是距离越小，文档之间越相似。"
> —— p065 [01:24]

> "余弦距离算子的好处是它已经归一化了，这是 OpenAI embedding 模型用的，也是推荐的做法。"
> —— p065 [02:37]

> "为什么是 1 减去这个距离？因为余弦算子返回的是距离，越小越近。减 1 之后翻成相似度，越大越近，对排序结果更直观。"
> —— p065 [06:07]

> "内积的问题是 PostgreSQL 从小到大排序，但我们想要最大的内积排最前。所以 pgvector 通过乘 -1 翻转符号来解决。"
> —— p065 [11:23]

> "负号只是一个排序技巧，数学上没有区别，pgvector 只是把数字翻了个号。"
> —— p065 [12:05]

> "归一化之后，我们只比较方向，也就是语义含义，而不是数字大小的噪声。OpenAI、Cohere 和大多数 embedding API 通常返回归一化向量，所以余弦距离是标准选择。"
> —— p065 [09:45]

---

## 3. 从零复现

### 3.1 环境准备

- Docker Desktop（本地起 Postgres 容器）
- Python 3.11+
- `uv`（讲师用的包管理器；用 `pip` 等价）
- 一个 OpenAI API Key（用于生成 embedding）
- 可选：TablePlus（讲师用来可视化查看表，非必需）

环境准备这一步最容易出问题的是 Docker Desktop 没启动。`docker ps` 如果报 `Cannot connect to the Docker daemon`，不是命令写错了，是 Docker 服务没起来——Windows/macOS 上打开 Docker Desktop 等鲸鱼图标变绿，Linux 上 `sudo systemctl start docker`。这一步没通，后面所有 `docker run` / `docker exec` 都会失败，先确认再往下走。

### 3.2 起 Postgres + pgvector 容器

讲师在 P61 开头说「我们已经本地把 Postgres 起好了，`version` 能看到值就说明一切正常」。容器镜像必须带 pgvector，否则 `CREATE EXTENSION vector` 会失败。用官方 `pgvector/pgvector` 镜像：

```bash
docker run -d \
  --name pgvector-local \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

> 课里没讲具体镜像 tag，只说了「用 Docker 在本地起 Postgres」。上面用的是社区常用的 `pgvector/pgvector:pg16`，如果你的环境是 pg15 就改成 `pg16`→`pg15`。

逐段解释这条命令：`-d` 是后台运行，不加的话终端会被容器日志占住；`--name pgvector-local` 给容器起名，后面 `docker exec` 靠这个名字进容器，名字冲突会报 `Conflict. The container name is already in use`，先 `docker rm -f pgvector-local` 再重跑；三个 `-e` 是初始化数据库时的用户名、密码、库名，**只在容器第一次创建数据卷时生效**，改密码要删卷重建；`-p 5432:5432` 是「宿主机端口:容器端口」，左边是你在 `.env` 里写的端口，右边是容器内 Postgres 监听的端口，左边被占用（比如本机已经装了 Postgres）就改成 `-p 5433:5432`，同时 `.env` 里的 `DATABASE_URL` 也要改成 5433。

常见错误与排查：`docker run` 报 `port is already allocated`，说明 5432 被占，`lsof -i :5432` 看是谁，要么停掉要么换端口；容器起来后 `docker ps` 看不到，用 `docker ps -a` 看是不是 `Exited`，`docker logs pgvector-local` 看退出原因，最常见是数据卷权限或密码为空。

### 3.3 进入 psql shell 并启用扩展

```bash
docker exec -it pgvector-local psql -U postgres
```

进入后执行（P61 [00:29] 的原话命令）：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

验证（P61 [00:59]）：

```sql
\dx vector
```

看到 `vector` 出现在扩展列表里就对了。退出 psql 用 `\q`（P61 [00:00] 讲师说的是 `q`，实际 psql 里是 `\q`；P62 [00:00] 讲师也纠正成 `backslash q`）。

这一步的完整解释：`docker exec -it` 的 `-i` 是保持 stdin 打开、`-t` 是分配伪终端，两个一起用才能在容器里交互式敲 psql；`-U postgres` 指定用户名，和 `docker run` 时的 `POSTGRES_USER` 一致。`CREATE EXTENSION IF NOT EXISTS vector` 里的 `IF NOT EXISTS` 是幂等的关键——重复执行不报错，psql 会输出 `NOTICE: extension "vector" already exists, skipping`，这正是 P64 [00:51] 讲师演示时看到的那行输出。`\dx vector` 是 psql 的元命令，列出名字匹配 `vector` 的扩展，输出里能看到 `Name`、`Version`、`Schema`、`Description` 四列，`Name` 列是 `vector` 就说明装好了。

常见错误与排查：`CREATE EXTENSION` 报 `could not open extension control file ".../vector.control"`，说明镜像里没带 pgvector，换 `pgvector/pgvector:pg16` 镜像；报 `permission denied to create extension "vector"`，说明当前用户不是超级用户，`-U postgres` 进的就是超级用户，检查是不是连错了库；`\dx` 输出为空，说明扩展没建成，回到上一条看报错。

### 3.4 建项目目录

```
pgvector-demo/
├── .env
├── pyproject.toml
├── 01_setup/
│   └── quick_demo.py
├── 02_basic_connection/
│   └── basic_connect.py
├── 03_similarity_search/
│   ├── create_table.sql
│   ├── insert_vectors.py
│   └── similarity_search.py
```

目录按「课里的三个小节」分，`01_setup` 对应 P63 的 quick demo，`02_basic_connection` 对应 P62 的三函数，`03_similarity_search` 对应 P64–P65 的建表、插入、检索。这样分的好处是每一步都能单独跑、单独验证，出错时能快速定位是哪一层的问题。

### 3.5 装依赖

P62 [01:41] 讲师原话：`psycopg`、`psycopg2-binary`、`pgvector`、`langchain-postgres`。

```bash
uv add psycopg psycopg2-binary pgvector langchain-postgres openai python-dotenv
# 或 pip install psycopg psycopg2-binary pgvector langchain-postgres openai python-dotenv
```

每个依赖的作用：`psycopg` 是 v3 驱动，代码里 `psycopg.connect` 用的就是它；`psycopg2-binary` 是 v2 驱动，讲师装了但本段代码没用，属于「后面 LangChain 可能用到」的冗余依赖；`pgvector` 提供 Python 侧的 vector 类型适配（本段代码里其实靠 `%s::vector` 让 Postgres 自己转，没显式 import，但装了不亏）；`langchain-postgres` 是 LangChain 的 PGVector 集成，本段没 import，是下一段用的；`openai` 用来调 embedding API；`python-dotenv` 用来读 `.env`。

常见错误与排查：`uv add` 报 `No solution found`，多半是 Python 版本太低，`psycopg` v3 要求 3.8+，`langchain-postgres` 可能要求更高，升到 3.11 最稳；`pip install psycopg2-binary` 在 Apple Silicon 上偶尔要编译，报 `pg_config not found` 就改用 `psycopg[binary]` 只装 v3。

### 3.6 配置 `.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

> P62 [00:47] 讲师强调：`DATABASE_URL` 里 localhost 端口要和 Docker 映射的端口一致（默认 5432），端口不对就连不上。

连接串拆开看：`postgresql://` 是协议，`postgres:postgres` 是「用户名:密码」，`@localhost:5432` 是「主机:端口」，最后的 `/postgres` 是库名。四段里任何一段和 `docker run` 时的 `-e` 不一致都会连不上：用户名密码错了报 `password authentication failed`，库名错了报 `database "xxx" does not exist`，端口错了报 `connection refused`。`.env` 文件不要提交到 git，`.gitignore` 里加一行 `.env`。

### 3.7 建表 + 建索引

在 psql shell 里执行（P64 [00:51]–[02:26]）：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

验证表存在（P64 [02:52] 的 `\dt`）：

```sql
\dt
```

应看到 `documents` 和之前测试用的 `items`。

逐列解释：`id BIGSERIAL PRIMARY KEY` 是自增主键，`BIGSERIAL` 比 `SERIAL` 多一倍空间，文档量大时不会溢出；`content TEXT NOT NULL` 是原文，`NOT NULL` 保证不会有空文档混进来；`embedding vector(1536)` 是核心列，`1536` 必须和 embedding 模型输出维度一致，写错了插入时报 `expected 1536 dimensions, not xxx`；`metadata JSONB DEFAULT '{}'::jsonb` 是结构化标签，`JSONB` 是二进制存储、可建 GIN 索引、查询快，默认空对象保证插入时不传 metadata 也不报错；`created_at TIMESTAMPTZ DEFAULT NOW()` 是创建时间，`TIMESTAMPTZ` 带时区，比 `TIMESTAMP` 安全。

`CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)` 这行：`USING hnsw` 指定索引类型是 HNSW（分层可导航小世界图），比 IVFFlat 建索引慢但查询快、召回高；`vector_cosine_ops` 是 opclass，告诉索引「按余弦距离组织」，必须和查询时的 `<=>` 算子配套，配错了索引不生效。

常见错误与排查：`DROP TABLE IF EXISTS documents` 会丢数据，生产环境别这么干，本地复现无所谓；建索引报 `operator class "vector_cosine_ops" does not exist`，说明 pgvector 扩展没装或版本太老，回到 3.3 确认；建索引在大表上很慢，几百万行可能要几分钟，本地 8 条数据瞬间完成。

### 3.8 插入 8 条文档

运行 `03_similarity_search/insert_vectors.py`（完整代码见第 4 节）。它会：
1. 用 `text-embedding-3-small` 生成 1536 维向量；
2. 批量插入 8 条带 metadata 的文档；
3. 打印总数。

> P64 [06:06] 讲师踩过一个坑：metadata 必须包成 `Json(...)`，否则 psycopg 会报错。代码里已处理。

这一步的完整解释：脚本先 `setup_table` 建表建索引（幂等，重复跑不报错），再对 8 条文档逐条调 `get_embedding` 拿向量，最后 `INSERT`。8 条文档覆盖了 pgvector、embeddings、indexing、similarity、production、rag、postgres、supabase 八个主题，正好让后面的三条 query 能命中不同文档。`Json(d["metadata"])` 把 Python dict 包成 psycopg 认识的 JSON 适配器，不包的话 psycopg 会尝试把 dict 当普通参数传，Postgres 报 `can't adapt type 'dict'`。

常见错误与排查：`openai.AuthenticationError` 说明 `OPENAI_API_KEY` 没配或配错，检查 `.env` 有没有被 `load_dotenv()` 读到（在脚本里 `print(os.getenv("OPENAI_API_KEY")[:8])` 验证）；`openai.RateLimitError` 说明额度用完或频率超限，8 条不该触发，检查账户余额；`psycopg.errors.UndefinedColumn` 说明表结构不对，回到 3.7 重建表。

### 3.9 跑三种相似度检索

运行 `03_similarity_search/similarity_search.py`。它会依次跑三条 query：
- `How does vector similarity search work?`
- `What is the best way to deploy to production?`
- `Tell me about PostgreSQL`

每条 query 用 cosine 检索，打印 score + content + metadata。P65 [14:09] 讲师演示时第一条 query 的最高分文档是「pgvector is a Postgres extension...」，score 约 0.6，metadata 里 `topic=pgvector`、`category=database`。

这一步的完整解释：脚本对每条 query 调一次 `get_embedding`，然后走 `search_cosine`，SQL 里 `ORDER BY embedding <=> %s::vector LIMIT 5` 拿 top-5，`1 - (embedding <=> %s::vector)` 翻成相似度展示。三条 query 分别测「技术概念」「运维实践」「数据库本身」，能看出 embedding 对语义的区分度——第一条应该命中 pgvector 和 similarity 两条，第二条应该命中 production 那条，第三条应该命中 postgres 和 supabase 两条。

常见错误与排查：三条 query 返回结果完全一样，说明 embedding 没生效或 SQL 写错（比如 `ORDER BY` 漏了），检查 SQL；score 全是负数，说明余弦距离大于 1，两个向量方向相反，正常现象，但如果是同一主题的文档出现负分，检查是不是混用了不同模型的 embedding；返回条数少于 5，说明表里文档不够，回到 3.8 确认插了 8 条。

### 3.10 可选：TablePlus 可视化

P64 [07:28] 讲师用 TablePlus 连本地库：host `localhost`、port `5432`、user `postgres`、password `postgres`、database `postgres`。连上后能看到 `documents` 表的 content、embedding、metadata、created_at 四列。

TablePlus 不是必需的，但可视化能帮你快速确认「embedding 列里到底存了什么」——它显示成一长串浮点数数组，肉眼能看出维度是不是 1536。连不上时先确认 Docker 容器在跑、端口没被占、密码没改。

---

## 4. 完整代码

### 4.1 `01_setup/quick_demo.py`

P63 [01:31] 的 quick demo，建一张 3 维小表验证 pgvector 能跑：

```python
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def main():
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            cur.execute("DROP TABLE IF EXISTS items;")
            cur.execute("""
                CREATE TABLE items (
                    id BIGSERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding vector(3)
                );
            """)

            cur.execute("""
                INSERT INTO items (content, embedding) VALUES
                ('first item',  '[1,2,3]'),
                ('second item', '[4,5,6]'),
                ('third item',  '[1.1,2.1,3.1]');
            """)

            cur.execute("SELECT id, content, embedding FROM items;")
            for row in cur.fetchall():
                print(row)

            cur.execute("""
                SELECT id, content, embedding,
                       embedding <-> '[1,2,3]' AS distance
                FROM items
                ORDER BY distance
                LIMIT 3;
            """)
            print("--- similarity search ---")
            for row in cur.fetchall():
                print(row)

        conn.commit()


if __name__ == "__main__":
    main()
```

### 4.2 `02_basic_connection/basic_connect.py`

P62 [01:11]–[02:24] 的 connect / enable / verify 三函数：

```python
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def connect():
    return psycopg.connect(DATABASE_URL)


def enable_vector(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()


def verify_pgvector(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
        row = cur.fetchone()
        return row is not None


def main():
    conn = connect()
    enable_vector(conn)
    ok = verify_pgvector(conn)
    print("pgvector enabled:", ok)
    conn.close()


if __name__ == "__main__":
    main()
```

### 4.3 `03_similarity_search/create_table.sql`

P64 [00:51]–[02:26] 的建表 + HNSW 索引：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

### 4.4 `03_similarity_search/insert_vectors.py`

P64 [03:13]–[05:37] 的插入脚本：

```python
import os
import psycopg
from psycopg.types.json import Json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_embedding(text: str) -> list[float]:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return resp.data[0].embedding


def setup_table(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id BIGSERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                embedding vector(1536),
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS documents_embedding_idx
            ON documents USING hnsw (embedding vector_cosine_ops);
        """)
    conn.commit()


def insert_documents(conn, docs: list[dict]):
    with conn.cursor() as cur:
        for d in docs:
            emb = get_embedding(d["content"])
            cur.execute(
                """
                INSERT INTO documents (content, embedding, metadata)
                VALUES (%s, %s, %s);
                """,
                (d["content"], emb, Json(d["metadata"])),
            )
    conn.commit()


def insert_documents_batch(conn, docs: list[dict]):
    with conn.cursor() as cur:
        for d in docs:
            emb = get_embedding(d["content"])
            cur.execute(
                """
                INSERT INTO documents (content, embedding, metadata)
                VALUES (%s, %s, %s);
                """,
                (d["content"], emb, Json(d["metadata"])),
            )
    conn.commit()


def main():
    sample_documents = [
        {"content": "pgvector is a Postgres extension for vector similarity search.",
         "metadata": {"topic": "pgvector", "category": "database"}},
        {"content": "OpenAI text-embedding-3-small produces 1536-dimensional vectors.",
         "metadata": {"topic": "embeddings", "category": "ml"}},
        {"content": "HNSW is an approximate nearest neighbor index for fast retrieval.",
         "metadata": {"topic": "indexing", "category": "database"}},
        {"content": "Cosine distance is the recommended metric for OpenAI embeddings.",
         "metadata": {"topic": "similarity", "category": "ml"}},
        {"content": "Production deployment should use connection pooling.",
         "metadata": {"topic": "production", "category": "ops"}},
        {"content": "RAG combines retrieval with generation for grounded answers.",
         "metadata": {"topic": "rag", "category": "ml"}},
        {"content": "PostgreSQL is a relational database with strong ACID guarantees.",
         "metadata": {"topic": "postgres", "category": "database"}},
        {"content": "Supabase is a cloud service that runs Postgres with pgvector.",
         "metadata": {"topic": "supabase", "category": "cloud"}},
    ]

    conn = psycopg.connect(DATABASE_URL)
    setup_table(conn)
    insert_documents_batch(conn, sample_documents)

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM documents;")
        print("total documents in database:", cur.fetchone()[0])

    conn.close()


if __name__ == "__main__":
    main()
```

### 4.5 `03_similarity_search/similarity_search.py`

P65 [04:19]–[13:32] 的三种检索：

```python
import os
import psycopg
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_embedding(text: str) -> list[float]:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return resp.data[0].embedding


def search_cosine(conn, query: str, limit: int = 5):
    emb = get_embedding(query)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT content,
                   1 - (embedding <=> %s::vector) AS score,
                   metadata
            FROM documents
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
            """,
            (emb, emb, limit),
        )
        return cur.fetchall()


def search_l2(conn, query: str, limit: int = 5):
    emb = get_embedding(query)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT content,
                   embedding <-> %s::vector AS distance,
                   metadata
            FROM documents
            ORDER BY embedding <-> %s::vector
            LIMIT %s;
            """,
            (emb, emb, limit),
        )
        return cur.fetchall()


def search_inner_product(conn, query: str, limit: int = 5):
    emb = get_embedding(query)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT content,
                   (embedding <#> %s::vector) * -1 AS score,
                   metadata
            FROM documents
            ORDER BY embedding <#> %s::vector
            LIMIT %s;
            """,
            (emb, emb, limit),
        )
        return cur.fetchall()


def print_results(results):
    for content, score, metadata in results:
        print(f"score={score:.4f} | {content} | metadata={metadata}")


def main():
    conn = psycopg.connect(DATABASE_URL)

    queries = [
        "How does vector similarity search work?",
        "What is the best way to deploy to production?",
        "Tell me about PostgreSQL",
    ]

    for q in queries:
        print(f"\n=== Query: {q} ===")
        results = search_cosine(conn, q, limit=5)
        print_results(results)

    conn.close()


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 `CREATE EXTENSION IF NOT EXISTS vector`

P61 [00:29] 讲师原话：「要启用这个扩展，我们必须写 create extension if not exists vector。」`IF NOT EXISTS` 保证重复执行不报错——P64 [00:51] 讲师演示时 psql 输出 `already exists, skipping`，就是这条语句的幂等性在起作用。这条语句必须在**每个要用的数据库**里执行一次，不是全局的——换库（比如从 `postgres` 换到 `mydb`）要重新执行。执行者必须是超级用户或对该库有 `CREATE` 权限，否则报 `permission denied`。

### 5.2 `vector(1536)` 的维度

P63 [00:40] 讲师强调 1536 是 OpenAI 的维度。P63 [01:09] 又补了一句关键约束：「所有向量在同一列里必须有相同的维度，永远选一个模型然后坚持用它。」如果你换成 `text-embedding-3-large`（3072 维），必须重建表或改列类型，否则插入会报维度不匹配。改列类型用 `ALTER TABLE documents ALTER COLUMN embedding TYPE vector(3072);`，但已有数据会报错，得先清空或重建。维度写小了（比如 `vector(768)`）插入 1536 维向量报 `expected 768 dimensions, not 1536`；写大了（比如 `vector(3072)`）插入 1536 维向量不报错但浪费空间，且检索时维度对不上会静默出错。

### 5.3 `metadata JSONB DEFAULT '{}'::jsonb`

P64 [01:59] 讲师说 metadata 是 JSON 类型，默认空对象，用于后续过滤。P64 [05:07] 又解释：metadata 里存 `category`、`topic` 这类字段，是为了「更快的检索和更相关的结果，因为后面可以做过滤」。`JSONB` 和 `JSON` 的区别：`JSONB` 存二进制、支持索引、查询快但插入稍慢；`JSON` 存原文、保留空格和键顺序、不支持索引。检索场景选 `JSONB`。默认值 `'{}'::jsonb` 保证插入时不传 metadata 也不报 `null value in column "metadata" violates not-null constraint`。

### 5.4 `Json(d["metadata"])` 包装

P64 [06:06] 讲师踩坑原话：「记得要把 metadata 包成 JSON 类，否则会报错，这就是我们刚才那个错误的原因。」psycopg 不会自动把 Python dict 转成 JSONB，必须用 `psycopg.types.json.Json` 包一层。不包的报错是 `psycopg.errors.ProgrammingError: can't adapt type 'dict'`，看到这个错就知道是漏了 `Json()`。另一种写法是 `json.dumps(d["metadata"])` 再传字符串，但那样 Postgres 收到的是 text，要显式 `::jsonb` 转，不如 `Json()` 干净。

### 5.5 HNSW 索引

P64 [02:26] 讲师原话：「建索引用于更快的相似度检索，用的是 HNSW。」`vector_cosine_ops` 指定索引按余弦距离组织，和后面 `<=>` 算子配套。HNSW 是近似最近邻（ANN），不是精确检索，但速度快几个数量级。HNSW 的两个关键参数：`m`（每个节点的最大连接数，默认 16）和 `ef_construction`（建索引时的候选集大小，默认 64），数据量大、召回不够时调大，代价是内存和建索引时间。建索引语法里可以带参数：`CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 128);`，课里用默认值够用。

### 5.6 余弦算子 `<=>`

P65 [04:55]–[06:37] 讲师拆解：
- `embedding <=> %s::vector` 返回**距离**，范围 0–2，越小越近；
- `1 - (embedding <=> %s::vector)` 翻成**相似度**，越大越近，更直观；
- `ORDER BY embedding <=> %s::vector` 按距离升序，最近的排最前；
- `%s::vector` 是参数占位符 + 类型转换，把 Python 传进来的 list 转成 vector 类型。

P65 [06:37] 讲师原话：「1 减去这个距离，翻成相似度，越大越近，对排序结果更直观。」注意 `ORDER BY` 里用的是原始距离 `<=>` 不是 `1 - ...`，因为距离升序等价于相似度降序，用距离更直接、也能走索引；`SELECT` 里用 `1 - ...` 只是为了展示好看。`%s::vector` 的 `::` 是 Postgres 的类型转换语法，不加的话 psycopg 传的 list 会被当成数组，报 `operator does not exist: vector <=> numeric[]`。

### 5.7 L2 算子 `<->`

P65 [07:21] 讲师说：「L2 是欧氏距离，距离越小越相似。」所以 `search_l2` 里直接 `ORDER BY embedding <-> %s::vector`，不需要翻符号。返回的 `distance` 越小越好。L2 和余弦的区别：L2 受向量模长影响，余弦只看方向；OpenAI 返回的向量已归一化（模长 1），此时 L2 和余弦排序等价，但余弦更「对称正确」——两个向量互换，余弦距离不变，L2 也不变，但 L2 的数值范围随维度增长，余弦固定在 0–2，跨数据集比较时余弦更稳。

### 5.8 内积算子 `<#>`

P65 [11:23] 讲师原话：「PostgreSQL 从小到大排序，但我们想要最大的内积排最前。所以 pgvector 通过乘 -1 翻转符号来解决。」所以 SQL 里写 `ORDER BY embedding <#> %s::vector`（pgvector 内部已经返回负值），展示时再 `* -1` 翻回正数。P65 [12:05] 讲师强调：「负号只是一个排序技巧，数学上没有区别。」具体来说：内积 `a·b` 越大越相似，但 `ORDER BY` 默认升序，所以 pgvector 的 `<#>` 算子返回的是 `-a·b`，这样升序排就是「内积大的在前」；`SELECT` 里再 `* -1` 把展示值翻回正的内积。如果你自己写 `ORDER BY (embedding <#> %s::vector) DESC`，会得到完全相反的结果——这是最容易踩的坑。

### 5.9 归一化与余弦的关系

P65 [09:45] 讲师解释：未归一化时，两个向量可能因为方向或模长不同而距离变大；归一化后模长被去掉，只比方向，也就是语义。P65 [10:15] 原话：「OpenAI、Cohere 和大多数 embedding API 通常返回归一化向量，所以余弦距离是标准选择。余弦距离和欧氏距离产生相同排序，但余弦更对称正确。」数学上：归一化后 `||a|| = ||b|| = 1`，此时 `a·b = cos(θ)`，L2 距离 `||a-b||² = 2 - 2cos(θ)`，所以 L2 和余弦排序完全一致；内积 `a·b = cos(θ)` 也一致。三者对归一化向量等价，但余弦的数值范围固定、跨模型可比，所以推荐。

### 5.10 相似度检索流程

P65 [02:54] 讲师总结的流程：query 文本 → 用**和索引阶段同一个模型**生成 embedding → 走 SQL 检索（`ORDER BY` + 距离算子）→ 返回结果。P65 [03:24] 强调「永远用和索引阶段相同的模型」，否则向量空间不一致，检索结果无意义。举个例子：索引阶段用 `text-embedding-3-small`（1536 维），查询阶段用 `text-embedding-ada-002`（也是 1536 维），维度对得上不报错，但两个模型的向量空间不同，算出来的距离是噪声，检索结果随机——这种错最难查，因为不报错。

### 5.11 前端视角补充

- **连接池**：P65 [15:10] 讲师提到「production deployment should use connection pooling」。在 Node 里对应 `pg.Pool`，不要每次请求 `new Client()`。Python 里对应 `psycopg_pool.ConnectionPool`，用法是 `pool = ConnectionPool(DATABASE_URL, min_size=2, max_size=10)`，然后 `with pool.connection() as conn:`。本段代码每次 `psycopg.connect()` 新建连接，本地跑没问题，生产环境每秒几十个请求会把 Postgres 的连接数打满（默认 `max_connections=100`），报 `FATAL: sorry, too many clients already`。
- **事务**：本段代码用 `conn.commit()` 手动提交，等价于 Node 里 `await client.query('COMMIT')`。批量插入时如果中途失败，要么全成功要么全回滚，用 `with conn.transaction():` 包起来更安全（课里没讲，但生产必用）。psycopg v3 的 `with conn.transaction():` 会在块结束时自动 commit，异常时自动 rollback，比手动 `commit()` 少写一行、少一个漏 commit 的坑。
- **JSONB vs JSON**：`JSONB` 是二进制存储、可建索引；`JSON` 是文本存储。课里用的是 `JSONB`，前端传对象时记得 `JSON.stringify` 后再包 `Json()`。前端如果直接 `fetch` 传 `{metadata: {...}}`，后端拿到的是 dict，`Json()` 包一下即可；如果前端传的是字符串，后端要先 `json.loads` 再 `Json()`，否则存进去的是带转义的字符串而不是对象。

---

## 6. 复现检查清单

- [ ] `docker ps` 能看到 `pgvector-local` 容器在跑
  - 验证方法：输出里 `STATUS` 列是 `Up xxx`，`PORTS` 列有 `0.0.0.0:5432->5432/tcp`。看不到就 `docker ps -a` 看是不是 `Exited`，`docker logs pgvector-local` 看退出原因。
- [ ] `docker exec -it pgvector-local psql -U postgres` 能进 psql
  - 验证方法：提示符变成 `postgres=#`。报 `No such container` 说明容器名不对或没起；报 `psql: error: connection to server on socket ... failed` 说明容器内 Postgres 没起来。
- [ ] `\dx vector` 输出里有 `vector` 扩展
  - 验证方法：输出表格的 `Name` 列有 `vector`，`Version` 列有版本号（如 `0.7.0`）。输出 `Did not find any extension named "vector"` 说明扩展没建，回 3.3 执行 `CREATE EXTENSION`。
- [ ] `.env` 里 `DATABASE_URL` 端口和 Docker 映射端口一致（默认 5432）
  - 验证方法：`docker ps` 的 `PORTS` 列左边端口 = `.env` 里 `@localhost:` 后面的端口。不一致就改 `.env` 或改 `docker run -p`。
- [ ] `uv add` 或 `pip install` 装完 `psycopg`、`psycopg2-binary`、`pgvector`、`langchain-postgres`、`openai`、`python-dotenv`
  - 验证方法：`python -c "import psycopg, openai, dotenv; print('ok')"` 不报错。报 `ModuleNotFoundError` 说明没装到当前 Python 环境，检查是不是用了虚拟环境但没激活。
- [ ] `python 01_setup/quick_demo.py` 能打印 3 条 items 和相似度检索结果，第一条 distance=0
  - 验证方法：输出里 `--- similarity search ---` 之后第一行 `distance` 是 `0.0`（因为 query 就是 `[1,2,3]`，和第一条完全一样）。不是 0 说明 SQL 写错或数据插错。
- [ ] `python 02_basic_connection/basic_connect.py` 打印 `pgvector enabled: True`
  - 验证方法：输出最后一行是 `pgvector enabled: True`。打印 `False` 说明 `verify_pgvector` 查不到扩展，回 3.3 确认扩展建在当前库。
- [ ] psql 里 `\dt` 能看到 `documents` 表
  - 验证方法：输出表格的 `Name` 列有 `documents`。看不到说明建表脚本没跑或跑在别的库，`\c postgres` 切回默认库再看。
- [ ] `python 03_similarity_search/insert_vectors.py` 打印 `total documents in database: 8`
  - 验证方法：输出最后一行是 `total documents in database: 8`。打印 `0` 说明插入失败但没报错（检查 `conn.commit()` 有没有漏），打印 `16` 说明重复跑了两次，`TRUNCATE documents;` 清空重跑。
- [ ] psql 里 `SELECT id, content, metadata, created_at FROM documents;` 能看到 8 行，metadata 是 JSON 对象
  - 验证方法：`metadata` 列显示成 `{"topic": "pgvector", "category": "database"}` 这样的对象，不是字符串 `"{\"topic\":...}"`。是字符串说明存成了 text 不是 jsonb，检查建表语句。
- [ ] `python 03_similarity_search/similarity_search.py` 三条 query 都返回 5 条结果，score 从高到低
  - 验证方法：每条 query 下面 5 行，`score=` 后面的数字递减。不是递减说明 `ORDER BY` 写反了或漏了。
- [ ] 第一条 query 的最高分文档是「pgvector is a Postgres extension...」，metadata 里 `topic=pgvector`
  - 验证方法：第一条 query 输出的第一行 `content` 是 `pgvector is a Postgres extension for vector similarity search.`，`metadata` 里 `topic` 是 `pgvector`。不是这条说明 embedding 模型不对或数据插错。
- [ ] （可选）TablePlus 连 `localhost:5432`，能看到 `documents` 表的 embedding 列
  - 验证方法：连上后左侧树里 `postgres` → `public` → `documents`，双击表能看到 `embedding` 列显示成一长串浮点数。连不上回 3.10 检查 host/port/user/password。

---

## 7. 课里没讲但你会撞上的

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| `CREATE EXTENSION vector` 报 `could not open extension control file ".../vector.control"` | 用了官方 `postgres:16` 镜像，里面没带 pgvector | 换 `pgvector/pgvector:pg16` 镜像重建容器；或自己编译 pgvector 装进容器 |
| `psycopg.connect` 报 `ImportError: cannot import name 'connect' from 'psycopg2'` | 只装了 `psycopg2` 没装 `psycopg`（v3），代码用的是 v3 语法 | `pip install psycopg` 装 v3；或把代码改成 `psycopg2.connect`（不推荐，v3 更好用） |
| 装了 `langchain-postgres` 但代码里没 import，以为漏了什么 | 本段代码确实没用到，它是下一段 LangChain 集成用的 | 本段可以跳过不装；装了也不影响，只是多占空间 |
| HNSW 索引建了但查询还是慢，`EXPLAIN` 显示 `Seq Scan` | 索引 opclass 和查询算子不匹配（建了 `vector_cosine_ops` 却用 `<->` 查） | 用 `<=>` 查走 cosine 索引；要用 L2 就另建 `vector_l2_ops` 索引；要用内积就建 `vector_ip_ops` 索引 |
| 批量插入 8000 条时报 `openai.RateLimitError: 429` | OpenAI embedding API 有 RPM/TPM 限制，8 条不触发，8000 条会 | 加 `time.sleep(0.1)` 限速；或分批插入、每批之间 sleep；或升级 OpenAI 账户 tier |
| `created_at` 显示的时间和本地时间差 8 小时 | 用了 `TIMESTAMPTZ` 存 UTC，前端没做时区转换 | 前端展示时 `new Date(created_at).toLocaleString()` 转本地时区；或后端查询时 `created_at AT TIME ZONE 'Asia/Shanghai'` |
| 生产环境每秒几十个请求后报 `FATAL: sorry, too many clients already` | 每次请求 `psycopg.connect()` 新建连接，Postgres 默认 `max_connections=100` 被打满 | 用 `psycopg_pool.ConnectionPool` 或 Node 的 `pg.Pool`，池大小设 10–20，复用连接 |
| 抄本地 `DATABASE_URL` 连 Supabase 报 `connection refused` | Supabase 的 pooler 端口是 6543 不是 5432，host 是 `aws-0-[region].pooler.supabase.com` 不是 `localhost` | 用 Supabase 控制台给的连接串，端口 6543（pooler）或 5432（直连），密码是项目密码不是 Postgres 默认密码 |
| 余弦相似度 score 出现负数，以为算错了 | 余弦距离范围 0–2，`1 - distance` 范围 -1–1，负分说明两向量方向相反 | 正常现象，不用改；如果同主题文档出现负分，检查是不是混用了不同模型的 embedding |
| `ORDER BY embedding <#> %s::vector DESC` 结果和预期相反 | `<#>` 返回的是 `-内积`，升序排才是「内积大的在前」，加 `DESC` 就反了 | 去掉 `DESC`，或改成 `ORDER BY (embedding <#> %s::vector) ASC`；展示时 `* -1` 翻回正数 |
| `INSERT` 报 `expected 1536 dimensions, not 3072` | 用了 `text-embedding-3-large`（3072 维）但表是 `vector(1536)` | 换回 `text-embedding-3-small`；或 `ALTER TABLE documents ALTER COLUMN embedding TYPE vector(3072);` 后重插数据 |
| `INSERT` 报 `can't adapt type 'dict'` | metadata 没包 `Json()`，psycopg 不知道怎么把 dict 转成 JSONB | `from psycopg.types.json import Json`，插入时 `Json(d["metadata"])` |
| 查询结果三条 query 完全一样 | `ORDER BY` 漏了或写成了常量，或者 embedding 没传进去（`%s` 占位符没填） | 检查 SQL 里 `ORDER BY embedding <=> %s::vector` 的 `%s` 有没有在参数元组里；`print(emb[:3])` 确认 embedding 非空 |
| 建索引时卡住几分钟没反应 | 表里数据多，HNSW 建索引是 O(n log n) 但常数大，几百万行要几分钟 | 正常，等；或先 `SET maintenance_work_mem = '1GB';` 加速；或改用 IVFFlat 索引（建得快但召回稍低） |

---

![p061 00:29 讲师执行 CREATE EXTENSION IF NOT EXISTS vector](images/p061_0027s.jpg)

![p061 00:59 验证 vector 扩展已存在](images/p061_0058s.jpg)

![p062 01:41 安装 psycopg、pgvector、langchain-postgres 依赖](images/p062_0104s.jpg)

![p063 00:40 建表时指定 vector(1536) 维度](images/p063_0038s.jpg)

![p064 02:26 创建 HNSW 索引](images/p064_0139s.jpg)

![p064 06:25 插入 8 条文档后打印总数](images/p064_0376s.jpg)

![p065 06:07 解释 1 - cosine distance 翻成相似度](images/p065_0357s.jpg)

![p065 11:23 解释内积乘 -1 的排序技巧](images/p065_0682s.jpg)