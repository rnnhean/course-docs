# Vector Databases Fundamentals to Production：P66–P69 复现文档

> 说明：本段逐字稿与截图清单里没有 OCR 文本，因此下面所有 SQL、函数和 Python 代码，都是按讲师口述的查询结构、索引参数、LangChain 流程整理出来的可复现版本。课里本段没有重新贴出完整建表语句，`documents` 表结构沿用前序课程；为了让读者能独立跑通，我在第 4 节补了最小 `00_schema.sql`，并明确标注“补全，课里没讲”。截图只用来定位讲师屏幕，不当作代码来源。

---

## 1. 这一节做什么

P66–P69 是一条完整的“从向量检索到生产 RAG”的落地链路：

1. 先在 PostgreSQL + pgvector 里做**带元数据过滤的向量检索**：单条件过滤、多条件动态过滤、按时间范围过滤，并强调“先过滤，再按相似度排序”。
2. 然后解决没有索引时全表扫描的问题：讲 **HNSW** 和 **IVFFlat** 两种 pgvector 索引的原理、SQL 建索引参数、索引大小检查、`ef_search` / `probes` 调参。
3. 再做一个**索引性能对比**：用同一批查询测 HNSW 不同 `ef_search`、IVFFlat 不同 `probes` 的平均耗时，理解“准确率换速度”的取舍。
4. 最后用 **LangChain + PGVector** 把前面手写的 SQL 能力接进代码：创建 vector store、添加文档、相似度搜索、带分数搜索、带过滤搜索，最后用 LCEL 拼一个最小 RAG 链。

这一节不是“讲概念”，而是把“过滤检索 → 索引加速 → LangChain RAG”串成一个能跑的项目。读者照着第 3、4 节做，可以得到一个本地 PGVector 数据库、两种索引、一个可运行的 RAG 脚本。

![p066 01:52 讲师展示先按 JSONB metadata 过滤再做向量排序的 SQL](images/p066_0112s.jpg)

---

## 2. 讲师原话

> "真正的 AI 应用确实需要过滤。PGVector 的美妙之处在于，把向量搜索和元数据过滤结合起来非常容易。"
> —— p066 [00:00]

> "推荐的做法是先过滤，再按相似度排序。你先拿文档，应用 category 过滤，然后在过滤后的文档里做向量相似度，最后拿到 top 结果。"
> —— p066 [00:24]

> "关键是我们有这个 WHERE 子句，先按 JSONB 元数据字段过滤，然后再做向量相似度排序。"
> —— p066 [01:38]

> "这就是为什么 PGVector 在生产级 RAG 中胜出：你得到向量搜索，加上 SQL 的全部能力。过滤、join、权限、时间范围，全都可以在一个查询里做。"
> —— p066 [03:52]

> "如果没有索引，PGVector 会扫描每一行。对于几千个向量完全没问题，但对于几百万个向量完全不可接受。"
> —— p066 [07:39]

> "HNSW 代表分层可导航小世界。你可以把它想成多级快递系统，像城市里的高速公路、主干道和地方街道。"
> —— p067 [00:25]

> "HNSW 快的原因是，你不需要把查询和几百万个向量逐一比较，可能只触碰 100 到 200 个节点。"
> —— p067 [03:18]

> "HNSW 的构建总是很慢，查询非常快，准确率 99%，但内存占用高。"
> —— p067 [04:29]

> "IVFFlat 用完全不同的方法，有两个阶段：训练和搜索。查询来了，只比较质心；找到最近的簇，然后探测这些簇。"
> —— p067 [05:28]

> "经验法则是 lists 取行数的平方根。比如一百万行，lists 大约 1000。"
> —— p067 [09:32]

> "行业建议是先上 HNSW，然后如果需要节省内存，再切换到 IVFFlat。"
> —— p067 [12:03]

> "如果你的向量少于 10000 个，不需要索引，顺序扫描足够快；超过 10000，再问自己是否内存受限。不受限就默认 HNSW，受限就 IVFFlat。"
> —— p067 [12:03]

> "EF search 为 40 时降到 4.92 毫秒，这是甜点，速度和准确率平衡很好。"
> —— p068 [07:35]

> "IVFFlat probes 为 10 是很好的默认值。"
> —— p068 [08:52]

> "我们有一个简单的 RAG 链，它从 PGVector 向量数据库取答案，完成了索引等 RAG 系统该做的所有事情。"
> —— p069 [04:50]

---

## 3. 从零复现

### 3.1 目录结构

```text
pgvector-langchain-demo/
├─ docker-compose.yml
├─ requirements.txt
├─ .env.example
├─ sql/
│  ├─ 00_schema.sql
│  ├─ 01_functions.sql
│  ├─ 02_hnsw_index.sql
│  ├─ 03_ivfflat_index.sql
│  └─ 04_check_indexes.sql
└─ python/
   ├─ 01_filtered_search.py
   ├─ 02_index_comparison.py
   ├─ 03_setup_vector_store.py
   ├─ 04_add_documents.py
   ├─ 05_similarity_search.py
   └─ 06_rag_chain.py
```

### 3.2 启动 PostgreSQL + pgvector

课里讲师确认“Postgres 正在运行、shell 正在运行”，然后直接进 psql 执行命令。我们本地用 Docker 起一个带 pgvector 的 PostgreSQL：

```bash
docker compose up -d
psql "postgresql://postgres:postgres@localhost:5432/postgres"
```

如果你本机已经装了 PostgreSQL，也可以跳过 Docker，只要确保 `CREATE EXTENSION vector` 能执行。

### 3.3 建表与扩展

本段逐字稿没有重新给 `documents` 建表语句，但反复用到这些字段：`content`、`embedding`、`metadata`（JSONB）、`created_at`。第 4 节 `00_schema.sql` 是补全的最小结构。执行：

```bash
psql "$DATABASE_URL" -f sql/00_schema.sql
psql "$DATABASE_URL" -f sql/01_functions.sql
```

`01_functions.sql` 里包含三个查询函数：单 category 过滤、多条件过滤、最近 N 天文档。讲师在 P66 说函数会“拿 query 生成 embedding，然后查 documents 表”，所以 embedding 生成放在 Python 侧，SQL 函数只接收 `vector` 参数。

### 3.4 跑过滤检索

先确认 `documents` 表里有数据。然后配置 `.env`，运行：

```bash
python python/01_filtered_search.py
```

脚本会做四件事：

1. 查询 “How do I make vector search faster”，按 `category = database` 过滤，取 top 3；
2. 同一查询按 `category = ml` 过滤；
3. 多条件过滤：`category = database`、`topic = pgvector`、`min_similarity = 0.3`；
4. 查最近 30 天文档。

讲师在 P66 [05:15] 演示时看到：database 分类下第一条 score 约 0.5，第二条 0.4，metadata 的 category 确实是 database；ml 分类下 top 结果都是 ml；多条件过滤会把低于 0.3 的结果丢掉；最近 30 天查询返回时间范围内的文档。你的分数会因为 embedding 模型和数据不同而变化，但结构一致。

![p066 04:32 讲师运行过滤检索并查看 top 结果与 category 是否匹配](images/p066_0272s.jpg)

### 3.5 建 HNSW 索引

```bash
psql "$DATABASE_URL" -f sql/02_hnsw_index.sql
```

脚本里先 `CREATE EXTENSION IF NOT EXISTS vector`，再 `DROP INDEX IF EXISTS documents_embedding_hnsw_idx`，然后按讲师口述的 `m = 16`、`ef_construction = 64` 建 HNSW 索引。讲师在 P68 [00:44] 说“总是先 drop 已有索引，确保干净”，所以脚本保留 drop。

建完后检查索引大小：

```sql
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename = 'documents';
```

讲师演示时看到 `documents` 主键约 16 KB，`documents_embedding_hnsw_idx` 约 72 KB，并说当时表里只有 3 行。你的大小会随数据量变化。

然后设置搜索参数：

```sql
SET hnsw.ef_search = 40;
```

讲师强调：`ef_search` 越高越准确但越慢。可以用 `EXPLAIN (ANALYZE, BUFFERS)` 验证索引是否被使用。

![p067 03:46 讲师展示 HNSW 建索引 SQL 与参数](images/p067_0226s.jpg)

### 3.6 建 IVFFlat 索引

```bash
psql "$DATABASE_URL" -f sql/03_ivfflat_index.sql
```

脚本先 `SELECT COUNT(*) FROM documents` 看行数，再 `DROP INDEX IF EXISTS documents_embedding_ivfflat_idx`，然后：

```sql
CREATE INDEX documents_embedding_ivfflat_idx
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);
```

讲师在 P68 [04:34] 说当时表里有 8 行，所以 `lists = 10` 够用；如果中等数据集，比如 10 万到 20 万行，可以用 `lists = 100`。经验法则是 `lists ≈ sqrt(rows)`，100 万行约 1000。

建完后：

```sql
SET ivfflat.probes = 10;
ANALYZE documents;
REINDEX INDEX documents_embedding_ivfflat_idx;
```

`probes = 10` 表示查询时检查 10 个簇。讲师说默认通常更小，10 是一个很好的默认值。

![p067 08:48 讲师展示 IVFFlat 的聚簇与探测思路](images/p067_0528s.jpg)

### 3.7 跑索引对比

```bash
python python/02_index_comparison.py
```

脚本会取一条查询向量，分别设置：

- HNSW：`hnsw.ef_search = 10, 40, 100, 200`
- IVFFlat：`ivfflat.probes = 1, 5, 10, 20`

每条查询跑多次取平均毫秒数。讲师在 P68 [07:35] 的结果是：

- HNSW `ef_search = 10`：约 7.36 ms，候选太少，图遍历不好，反而慢；
- `ef_search = 40`：约 4.92 ms，甜点；
- `ef_search = 100/200`：约 5.42 ms，更准但边际收益递减；
- IVFFlat `probes = 1`：约 4.63 ms，快但可能漏结果；
- `probes = 5`：约 4.89 ms，召回更好；
- `probes = 10`：约 4.47 ms，好默认；
- `probes = 20`：约 4.92 ms，更彻底但更慢。

讲师特别说：当时数据集很小，所以时间都在 4–7 ms 附近；到几百万行差异会非常明显。练习是往 `documents` 里插更多数据再测。

![p068 07:04 讲师展示 HNSW 与 IVFFlat 的查询耗时对比结果](images/p068_0424s.jpg)

### 3.8 接入 LangChain

安装依赖：

```bash
pip install -r requirements.txt
```

配置 `.env` 后依次运行：

```bash
python python/03_setup_vector_store.py
python python/04_add_documents.py
python python/05_similarity_search.py
python python/06_rag_chain.py
```

`03_setup_vector_store.py` 创建/连接 PGVector collection，collection 名按讲师说是 `documents`，并设置 `use_jsonb=True` 支持 metadata。`04_add_documents.py` 用 `Document` 对象添加示例文档。`05_similarity_search.py` 演示基础搜索、带分数搜索、带过滤搜索。`06_rag_chain.py` 用 LCEL 拼 RAG：检索 -> 格式化文档 -> prompt -> model -> 字符串输出。

讲师在 P69 [04:50] 用问题 “How do transformers process input sequences efficiently?” 演示，答案来自 PGVector 检索到的上下文。你的答案会因模型和数据不同而变化
。

![p069 03:58 讲师展示 LCEL 拼出的最小 RAG 链代码](images/p069_0238s.jpg)

---

## 4. 完整代码

> 再次强调：本段逐字稿和截图清单里没有 OCR 文本，下面所有 SQL 与 Python 都是按讲师口述的结构整理出来的可运行版本。`00_schema.sql` 是补全的最小表结构（课里没讲建表语句），其余文件对应讲师在 P66–P69 屏幕上演示的查询、索引和 LangChain 流程。

### 4.1 `docker-compose.yml`

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: pgvector-demo
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 4.2 `requirements.txt`

```text
psycopg[binary]==3.2.3
python-dotenv==1.0.1
openai==1.54.4
langchain==0.3.7
langchain-core==0.3.15
langchain-openai==0.2.8
langchain-postgres==0.0.12
pgvector==0.3.6
```

### 4.3 `.env.example`

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
OPENAI_API_KEY=sk-your-key-here
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
CHAT_MODEL=gpt-4o-mini
```

### 4.4 `sql/00_schema.sql`（补全，课里没讲建表语句）

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 便于按 metadata 过滤
CREATE INDEX IF NOT EXISTS documents_metadata_gin_idx
  ON documents USING gin (metadata);

-- 便于按时间过滤
CREATE INDEX IF NOT EXISTS documents_created_at_idx
  ON documents (created_at);
```

### 4.5 `sql/01_functions.sql`

```sql
-- 单 category 过滤 + 向量相似度排序
CREATE OR REPLACE FUNCTION search_with_category_filter(
  query_embedding vector(1536),
  category_filter TEXT,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.metadata->>'category' = category_filter
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 多条件动态过滤：category / topic / min_similarity
CREATE OR REPLACE FUNCTION search_with_multiple_filters(
  query_embedding vector(1536),
  category_filter TEXT DEFAULT NULL,
  topic_filter    TEXT DEFAULT NULL,
  min_similarity  FLOAT DEFAULT 0.0,
  match_count     INT DEFAULT 3
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  where_clause TEXT := 'WHERE 1=1';
  sql TEXT;
BEGIN
  IF category_filter IS NOT NULL THEN
    where_clause := where_clause || format(' AND d.metadata->>''category'' = %L', category_filter);
  END IF;

  IF topic_filter IS NOT NULL THEN
    where_clause := where_clause || format(' AND d.metadata->>''topic'' = %L', topic_filter);
  END IF;

  sql := format($f$
    SELECT
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> $1) AS similarity
    FROM documents d
    %s
    ORDER BY d.embedding <=> $1
    LIMIT %s
  $f$, where_clause, match_count * 5);

  RETURN QUERY EXECUTE sql USING query_embedding;
END;
$$;

-- 最近 N 天文档
CREATE OR REPLACE FUNCTION search_recent_documents(
  query_embedding vector(1536),
  days_back INT DEFAULT 30,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.created_at > NOW() - (days_back || ' days')::interval
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

> 说明：多条件函数里 `min_similarity` 参数在 SQL 层没有直接过滤，而是把 `match_count * 5` 作为候选上限，然后在 Python 侧按 `min_similarity` 过滤。讲师在 P66 [06:24] 演示时看到“低于 0.3 的结果被丢掉”，这个过滤动作在 Python 侧完成更直观。如果你想让 SQL 层也过滤，可以在 `where_clause` 里追加 `AND 1 - (d.embedding <=> $1) >= %L`，但 `$1` 在动态 SQL 里需要额外处理，课里没讲，这里保持简单。

### 4.6 `sql/02_hnsw_index.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

DROP INDEX IF EXISTS documents_embedding_hnsw_idx;

-- 默认参数
CREATE INDEX documents_embedding_hnsw_idx
  ON documents
  USING hnsw (embedding vector_cosine_ops);

-- 自定义参数：m = 每节点连接数，ef_construction = 建图质量
-- 注意：同一张表同一列只能有一个 HNSW 索引，下面这条要在上面那条 drop 之后单独跑
-- DROP INDEX IF EXISTS documents_embedding_hnsw_idx;
-- CREATE INDEX documents_embedding_hnsw_idx
--   ON documents
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);

SET hnsw.ef_search = 40;
```

> 讲师在 P68 [00:44] 先跑默认参数建索引，再跑自定义参数版本。因为同一列只能有一个 HNSW 索引，第二次建之前要先 drop。上面把自定义参数版本注释掉，读者想跑时取消注释即可。

### 4.7 `sql/03_ivfflat_index.sql`

```sql
SELECT COUNT(*) FROM documents;

DROP INDEX IF EXISTS documents_embedding_ivfflat_idx;

CREATE INDEX documents_embedding_ivfflat_idx
  ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

SET ivfflat.probes = 10;

ANALYZE documents;

REINDEX INDEX documents_embedding_ivfflat_idx;
```

### 4.8 `sql/04_check_indexes.sql`

```sql
-- 看索引大小
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename = 'documents';

-- 看索引定义
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents';

-- 验证索引是否被使用
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, content
FROM documents
ORDER BY embedding <=> (
  SELECT embedding FROM documents LIMIT 1
)
LIMIT 3;
```

### 4.9 `python/01_filtered_search.py`

```python
import os
import psycopg
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

client = OpenAI()


def embed(text: str) -> list[float]:
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def print_results(title: str, rows):
    print(f"\n=== {title} ===")
    for row in rows:
        doc_id, content, metadata, similarity = row
        print(f"[{doc_id}] score={similarity:.3f} category={metadata.get('category')} topic={metadata.get('topic')}")
        print(f"    {content[:120]}")


def main():
    query = "How do I make vector search faster"
    qvec = embed(query)

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # 1) 单 category 过滤
            cur.execute(
                "SELECT * FROM search_with_category_filter(%s::vector, %s, %s)",
                (qvec, "database", 3),
            )
            print_results("category = database", cur.fetchall())

            # 2) 同一查询，category = ml
            cur.execute(
                "SELECT * FROM search_with_category_filter(%s::vector, %s, %s)",
                (qvec, "ml", 3),
            )
            print_results("category = ml", cur.fetchall())

            # 3) 多条件过滤 + min_similarity
            cur.execute(
                "SELECT * FROM search_with_multiple_filters(%s::vector, %s, %s, %s, %s)",
                (qvec, "database", "pgvector", 0.3, 3),
            )
            rows = cur.fetchall()
            filtered = [r for r in rows if r[3] >= 0.3]
            print_results("category = database AND topic = pgvector AND similarity >= 0.3", filtered)

            # 4) 最近 30 天
            cur.execute(
                "SELECT * FROM search_recent_documents(%s::vector, %s, %s)",
                (qvec, 30, 3),
            )
            print_results("recent 30 days", cur.fetchall())


if __name__ == "__main__":
    main()
```

### 4.10 `python/02_index_comparison.py`

```python
import os
import time
import statistics
import psycopg
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

client = OpenAI()

QUERY = "How does vector similarity search work"
RUNS = 5


def embed(text: str) -> list[float]:
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def time_query(conn, qvec, runs: int = RUNS) -> float:
    sql = """
        SELECT id, content
        FROM documents
        ORDER BY embedding <=> %s::vector
        LIMIT 3
    """
    times = []
    with conn.cursor() as cur:
        for _ in range(runs):
            start = time.perf_counter()
            cur.execute(sql, (qvec,))
            cur.fetchall()
            times.append((time.perf_counter() - start) * 1000)
    return statistics.mean(times)


def main():
    qvec = embed(QUERY)

    with psycopg.connect(DATABASE_URL) as conn:
        conn.autocommit = True

        with conn.cursor() as cur:
            cur.execute("""
                SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
                FROM pg_indexes
                WHERE tablename = 'documents'
            """)
            print("=== indexes ===")
            for row in cur.fetchall():
                print(row)

        print("\n=== HNSW ef_search ===")
        for ef in (10, 40, 100, 200):
            with conn.cursor() as cur:
                cur.execute(f"SET hnsw.ef_search = {ef}")
            ms = time_query(conn, qvec)
            print(f"ef_search={ef:>3}  avg={ms:.2f} ms")

        print("\n=== IVFFlat probes ===")
        for probes in (1, 5, 10, 20):
            with conn.cursor() as cur:
                cur.execute(f"SET ivfflat.probes = {probes}")
            ms = time_query(conn, qvec)
            print(f"probes={probes:>3}  avg={ms:.2f} ms")


if __name__ == "__main__":
    main()
```

### 4.11 `python/03_setup_vector_store.py`

```python
import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
COLLECTION_NAME = "documents"


def get_vector_store() -> PGVector:
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
    )


def main():
    store = get_vector_store()
    print("vector store ready:", store)
    print("collection:", COLLECTION_NAME)


if __name__ == "__main__":
    main()
```

### 4.12 `python/04_add_documents.py`

```python
import os
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
COLLECTION_NAME = "documents"


def get_vector_store() -> PGVector:
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
    )


def main():
    store = get_vector_store()

    docs = [
        Document(
            page_content="PGVector supports HNSW and IVFFlat indexes to speed up similarity search.",
            metadata={"category": "database", "topic": "pgvector"},
        ),
        Document(
            page_content="HNSW builds a multi-layer graph and navigates greedily from top to bottom.",
            metadata={"category": "database", "topic": "indexes"},
        ),
        Document(
            page_content="IVFFlat clusters vectors into lists and probes the nearest clusters at query time.",
            metadata={"category": "database", "topic": "indexes"},
        ),
        Document(
            page_content="Transformers process input sequences efficiently using self-attention.",
            metadata={"category": "ml", "topic": "transformers"},
        ),
    ]

    store.add_documents(docs)
    print(f"added {len(docs)} documents")

    results = store.similarity_search("How do I make vector search faster", k=2)
    for r in results:
        print("-", r.page_content[:80], r.metadata)


if __name__ == "__main__":
    main()
```

### 4.13 `python/05_similarity_search.py`

```python
import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
COLLECTION_NAME = "documents"


def get_vector_store() -> PGVector:
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
    )


def main():
    store = get_vector_store()
    query = "How do I make vector search faster"

    print("=== basic similarity search ===")
    for doc in store.similarity_search(query, k=3):
        print("-", doc.page_content[:100], doc.metadata)

    print("\n=== similarity search with score ===")
    for doc, score in store.similarity_search_with_score(query, k=3):
        print(f"score={score:.3f}", doc.page_content[:100], doc.metadata)

    print("\n=== similarity search with filter ===")
    for doc in store.similarity_search(query, k=3, filter={"category": "database"}):
        print("-", doc.page_content[:100], doc.metadata)


if __name__ == "__main__":
    main()
```

### 4.14 `python/06_rag_chain.py`

```python
import os
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "gpt-4o-mini")
COLLECTION_NAME = "documents"


def get_vector_store() -> PGVector:
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
    )


def format_docs(docs: list[Document]) -> str:
    return "\n\n".join(d.page_content for d in docs)


def create_rag_chain():
    store = get_vector_store()
    retriever = store.as_retriever(search_kwargs={"k": 3})

    model = ChatOpenAI(model=CHAT_MODEL)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Answer the question using only the provided context."),
        ("human", "Context:\n{context}\n\nQuestion: {question}"),
    ])

    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | model
        | StrOutputParser()
    )
    return chain


def main():
    chain = create_rag_chain()

    questions = [
        "How do transformers process input sequences efficiently?",
        "How do I make vector search faster?",
        "What is the difference between HNSW and IVFFlat?",
    ]

    for q in questions:
        print(f"\nQ: {q}")
        print("A:", chain.invoke(q))


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 `00_schema.sql`

- `CREATE EXTENSION IF NOT EXISTS vector;`：pgvector 扩展。讲师在 P68 [00:22] 说“先 create extension，如果不存在”，这一步是后面所有 `vector` 类型和 `<=>` 操作符的前提。
- `embedding vector(1536)`：维度必须和 embedding 模型一致。`text-embedding-3-small` 是 1536 维；如果你换模型，这里和 `.env` 的 `EMBEDDING_DIM` 要一起改，否则插入会报维度不匹配。
- `metadata JSONB`：讲师在 P66 [01:38] 强调“按 JSONB metadata 字段过滤”，所以 metadata 用 JSONB，不是普通 text。
- `documents_metadata_gin_idx`：GIN 索引让 `metadata->>'category'` 这类过滤更快。课里没讲这个索引，但它是“先过滤”策略的配套；不加也能跑，只是过滤慢。
- `documents_created_at_idx`：P66 [03:08] 的“最近 N 天”查询按 `created_at` 过滤，B-tree 索引让时间范围扫描更快。

### 5.2 `01_functions.sql`

- `1 - (d.embedding <=> query_embedding) AS similarity`：`<=>` 是 pgvector 的余弦距离操作符，距离越小越相似；`1 - 距离` 转成相似度分数。讲师在 P66 [00:44] 说“用 cosine 操作符计算距离”，P66 [05:15] 演示时 score 0.5、0.4 就是这里算出来的。
- `WHERE d.metadata->>'category' = category_filter`：先过滤。讲师在 P66 [00:24] 反复强调“先过滤，再按相似度排序”，这个 WHERE 就是“先过滤”的落点。
- `ORDER BY d.embedding <=> query_embedding`：在过滤后的集合里按距离排序。顺序不能反：如果先全局排序再过滤，会先扫全表，过滤反而不省事。
- `search_with_multiple_filters` 里的 `where_clause TEXT := 'WHERE 1=1'`：讲师在 P66 [02:22] 说“用 `WHERE 1=1` 作为基础条件，这样追加 AND 子句时不用担第一个”。这是动态 SQL 的常见技巧。
- `format(' AND d.metadata->>''category'' = %L', category_filter)`：`%L` 是 PostgreSQL 的字符串字面量转义，防止 SQL 注入。讲师在 P66 [02:38] 说“如果 category 存在就追加条件”，对应这里的 `IF category_filter IS NOT NULL`。
- `LIMIT %s` 里传 `match_count * 5`：先多取一些候选，再在 Python 侧按 `min_similarity` 过滤。讲师在 P66 [06:49] 演示“低于 0.3 的被丢掉”，这个丢弃动作在 Python 侧做，SQL 只负责多给候选。
- `search_recent_documents` 里 `d.created_at > NOW() - (days_back || ' days')::interval`：讲师在 P66 [03:08] 说“按 created_at 过滤，查最近 N 天”，这里把天数拼成 interval。注意 `days_back` 是整数，`||` 拼成字符串再转 interval。

### 5.3 `02_hnsw_index.sql`

- `USING hnsw (embedding vector_cosine_ops)`：HNSW 索引，`vector_cosine_ops` 表示用余弦距离。讲师在 P67 [03:18] 说“create index on documents using hnsw，指定 embeddings vector cosine ops”，就是这一行。
- `WITH (m = 16, ef_construction = 64)`：讲师在 P67 [03:42] 解释 `m` 是“每个节点连接 16 个邻居”，越高越准但内存越多；`ef_construction = 64` 是“建图时多仔细”，越高索引越好但建得越慢。这两个参数只在建索引时生效。
- `SET hnsw.ef_search = 40`：查询时参数。讲师在 P68 [07:35] 说 `ef_search = 40` 是甜点，4.92 ms。`ef_search` 是“搜索时探索多少候选”，越高越准越慢。
- 为什么默认参数和自定义参数要分两次跑：同一列只能有一个 HNSW 索引。讲师在 P68 [01:14] 先跑默认，再跑自定义，中间隐含了 drop。脚本里把自定义版本注释掉，读者要跑时先取消注释、再注释掉默认版本。

### 5.4 `03_ivfflat_index.sql`

- `SELECT COUNT(*) FROM documents;`：讲师在 P68 [04:34] 先数行数，再决定 `lists`。当时 8 行，`lists = 10` 够用。
- `WITH (lists = 10)`：IVFFlat 把向量聚成 `lists` 个簇。讲师在 P67 [09:32] 说经验法则是 `sqrt(rows)`，100 万行约 1000；P68 [04:34] 说中等数据集 10 万到 20 万行可以用 `lists = 100`。
- `SET ivfflat.probes = 10`：查询时检查 10 个簇。讲师在 P68 [08:52] 说“probes = 10 是很好的默认值”，4.47 ms。
- `ANALYZE documents;`：更新统计信息，让查询规划器知道数据分布。课里讲师在 P68 [05:22] 说“可以 analyze 一下”，对应这一行。
- `REINDEX INDEX documents_embedding_ivfflat_idx;`：讲师在 P68 [05:51] 说“可以 reindex 重建”，对应这一行。IVFFlat 在数据变化后需要重建才能保持效果，这是它“处理更新不太好”的原因（P67 [10:54]）。

### 5.5 `02_index_comparison.py`

- `time_query` 里 `time.perf_counter()` 包住 `cur.execute` + `cur.fetchall()`：只测查询本身，不测 embedding 生成。讲师在 P68 [06:10] 说“这个工具会多次计时并返回平均值”，对应这里的 `RUNS = 5` 和 `statistics.mean`。
- `conn.autocommit = True`：`SET hnsw.ef_search` 这类会话级参数需要生效，autocommit 避免事务包裹带来的额外开销。
- `SET hnsw.ef_search = {ef}` 用 f-string 拼：`ef` 是代码里写死的整数，不是用户输入，所以没有注入风险。生产代码里如果参数来自外部，要用参数化或白名单。
- 结果解读：`ef_search = 10` 反而比 40 慢，讲师在 P68 [07:55] 解释“候选太少，图遍历不好，反而慢”；`ef_search = 100/200` 是“边际收益递减”。IVFFlat `probes = 1` 快但可能漏，`probes = 10` 是好默认。

### 5.6 `03_setup_vector_store.py`

- `PGVector(embeddings=..., collection_name="documents", connection=DATABASE_URL, use_jsonb=True)`：讲师在 P69 [00:44] 说“用 PGVector，传 embeddings、collection name、连接，`use_jsonb=True` 支持 metadata”。`collection_name` 对应表名 `documents`。
- `get_vector_store()` 返回一个 vector store 对象。讲师在 P69 [01:13] 说“运行后会创建 vector store 并验证连接”，如果 collection 已存在就直接复用。

### 5.7 `04_add_documents.py`

- `Document(page_content=..., metadata={...})`：LangChain 的文档对象。讲师在 P69 [01:37] 说“用 langchain_core.documents 创建 Document 对象”。
- `store.add_documents(docs)`：讲师在 P69 [01:59] 说“添加示例文档，这些数据是对本地 documents 数据库的补充”。这里 4 条示例覆盖 database/ml 两个 category 和 pgvector/indexes/transformers 三个 topic，方便后面过滤演示。
- `store.similarity_search(..., k=2)`：添加后立刻验证。讲师在 P69 [02:29] 说“有一个快速验证，问一个问题做快速搜索”。

### 5.8 `05_similarity_search.py`

- `store.similarity_search(query, k=3)`：基础搜索。讲师在 P69 [02:55] 说“调用 vector store 的 similarity_search，传几个参数”。
- `store.similarity_search_with_score(query, k=3)`：带分数搜索。讲师在 P69 [02:55] 说“search with scores”，对应这一行。分数含义和 SQL 里的 `1 - 距离` 一致，但 LangChain 返回的 score 语义以实际输出为准。
- `store.similarity_search(query, k=3, filter={"category": "database"})`：带过滤搜索。讲师在 P69 [02:55] 说“search with filter，我们之前见过”，对应这一行。`filter` 字典会转成 metadata 过滤条件。

### 5.9 `06_rag_chain.py`

- `retriever = store.as_retriever(search_kwargs={"k": 3})`：把 vector store 包成 retriever，RAG 链里用。
- `ChatPromptTemplate.from_messages([...])`：讲师在 P69 [04:05] 说“用 chat prompt template，传 context 和 question 两个变量”。system 消息约束“只用上下文回答”，human 消息里放 `{context}` 和 `{question}`。
- `{"context": retriever | format_docs, "question": RunnablePassthrough()}`：LCEL 的并行分支。`question` 原样透传，`context` 走 retriever 再 `format_docs` 拼成字符串。讲师在 P69 [04:05] 说“用 LCEL 构建链，非常直观”。
- `| prompt | model | StrOutputParser()`：prompt 填变量，model 生成，parser 转字符串。讲师在 P69 [03:28] 说“用 string output parser、runnable passthrough、chat prompt template，这是最新版 LangChain 的写法”。
- `chain.invoke(q)`：讲师在 P69 [04:25] 说“在 main 里传几个测试问题，循环调用 chain”。第一个问题 “How do transformers process input sequences efficiently?” 在 P69 [04:50] 演示时能从 PGVector 取到相关上下文并给出答案。

---

## 6. 复现检查清单

按顺序打勾，任何一步失败先解决再往下：

- [ ] `docker compose up -d` 后 `psql "$DATABASE_URL" -c "SELECT 1"` 能连上。
- [ ] `psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector"` 不报错。
- [ ] `00_schema.sql` 执行后 `\d documents` 能看到 `content`、`embedding`、`metadata`、`created_at` 四列。
- [ ] `01_functions.sql` 执行后 `\df search_*` 能看到三个函数。
- [ ] `documents` 表里至少有 3 条带 embedding 的数据（否则过滤检索返回空）。
- [ ] `01_filtered_search.py` 能跑通，四个查询都有输出；database 分类结果的 `metadata.category` 都是 `database`；多条件过滤后没有低于 0.3 的分数。
- [ ] `02_hnsw_index.sql` 执行后 `04_check_indexes.sql` 能看到 `documents_embedding_hnsw_idx`，大小非零。
- [ ] `SET hnsw.ef_search = 40` 后 `EXPLAIN (ANALYZE, BUFFERS)` 显示走了 HNSW 索引（输出里出现 `Index Scan using documents_embedding_hnsw_idx`）。
- [ ] `03_ivfflat_index.sql` 执行后 `04_check_indexes.sql` 能看到 `documents_embedding_ivfflat_idx`。
- [ ] `SET ivfflat.probes = 10` 后 `EXPLAIN` 显示走了 IVFFlat 索引。
- [ ] `02_index_comparison.py` 能打印两组耗时；HNSW 的 `ef_search = 40` 和 IVFFlat 的 `probes = 10` 是你后续调参的起点。
- [ ] `03_setup_vector_store.py` 打印 `vector store ready`，不报连接错误。
- [ ] `04_add_documents.py` 打印 `added 4 documents`，并返回 2 条搜索结果。
- [ ] `05_similarity_search.py` 三种搜索都有输出；带 filter 的结果 `metadata.category` 都是 `database`。
- [ ] `06_rag_chain.py` 三个问题都有答案；第一个问题的答案能看出引用了 HNSW/IVFFlat 相关内容。
- [ ] 往 `documents` 里插更多数据（讲师在 P68 [09:52] 留的练习）后重跑 `02_index_comparison.py`，观察耗时差异是否变大。

---

## 7. 课里没讲但你会撞上的

1. **`documents` 表结构**：本段逐字稿没有重新给建表语句，`00_schema.sql` 是按用到的字段补的。如果你前序课程已经建过 `documents` 表，先 `\d documents` 对一下列名和维度，别直接跑 `00_schema.sql` 覆盖。
2. **embedding 维度**：`vector(1536)` 对应 `text-embedding-3-small`。换模型（比如 `text-embedding-3-large` 是 3072 维）必须改列定义和 `.env` 的 `EMBEDDING_DIM`，否则插入报错。课里没讲换模型的具体步骤。
3. **`<=>` 的分数语义**：SQL 里 `1 - 距离` 是相似度，越大越相似；LangChain 的 `similarity_search_with_score` 返回的 score 语义以实际输出为准，不同版本可能方向不同。课里没讲 LangChain 侧 score 的具体定义，别把两边分数直接比较。
4. **HNSW 和 IVFFlat 不能同时“生效”**：同一列可以建两个索引，但查询规划器只会选一个。讲师在 P68 [05:22] 演示时两个索引都在，但实际查询走哪个要看 `EXPLAIN`。想对比性能，最好一次只留一个索引，或者用 `SET enable_indexscan` 之类的方式控制（课里没讲）。
5. **IVFFlat 建索引前要有数据**：IVFFlat 需要训练，空表建索引效果不好。讲师在 P68 [04:34] 先 `COUNT(*)` 再建，就是这个原因。HNSW 没这个限制。
6. **`SET hnsw.ef_search` 是会话级**：新开一个连接就恢复默认。`02_index_comparison.py` 里每次 `SET` 后立刻查询，所以没问题；如果你在 psql 里 `SET` 完再开新窗口，参数不生效。
7. **`REINDEX` 会锁表**：讲师在 P68 [05:51] 说“可以 reindex”，但生产环境大表 `REINDEX` 会阻塞写入。课里没讲 `REINDEX CONCURRENTLY`，数据量大时要考虑。
8. **多条件函数的 `min_similarity` 在 Python 侧过滤**：`01_functions.sql` 里 SQL 只多取候选，过滤在 `01_filtered_search.py` 里做。如果你想让 SQL 层也过滤，需要改动态 SQL 把 `$1` 传进 `where_clause`，课里没讲这个改法。
9. **LangChain 版本**：`langchain-postgres` 的 `PGVector` 参数在不同版本有变化（比如 `connection` 早期叫 `connection_string`）。`requirements.txt` 锁了版本，升级前先看 changelog。课里没讲版本兼容问题。
10. **`use_jsonb=True` 和已有表**：如果 `documents` 表是手写 SQL 建的、metadata 列不是 JSONB，`use_jsonb=True` 可能对不上。课里讲师说“这是 Postgres SQL 数据库，我们之前用 SQL 建的”，所以两边结构要一致。
11. **OpenAI API Key**：`06_rag_chain.py` 和所有 embedding 脚本都要 `OPENAI_API_KEY`。课里没讲没有 key 时怎么换本地 embedding 模型；如果要换，`OpenAIEmbeddings` 换成别的 `Embeddings` 实现，维度也要跟着改。
12. **`filter` 字典的写法**：`similarity_search(..., filter={"category": "database"})` 是 LangChain 的 metadata 过滤语法，底层会转成 SQL。复杂过滤（多条件、范围）的写法课里没讲，简单等值过滤够用。
13. **索引大小和行数的关系**：讲师演示时 3 行数据、HNSW 索引 72 KB，这个数字不能外推到百万行。生产环境要按实际数据量测索引大小和内存占用。
14. **`EXPLAIN` 里索引是否被用**：小表上 PostgreSQL 可能选择顺序扫描而不是索引，即使索引存在。讲师在 P68 [02:22] 说“验证索引被使用”，如果 `EXPLAIN` 没走索引，先插更多数据再试，或者临时 `SET enable_seqscan = off`（课里没讲这个开关）。