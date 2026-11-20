# Postgres Sharding 课程复现文档（P005–P008）

> 课程：BV1K2xY63EDx ｜ 覆盖 P005–P008
> 读者定位：前端转 AI 应用工程师。涉及事务/并发处会补一句「在 JS/Node 里对应什么」。
> 本文档按「把项目跑起来」组织，不按视频顺序流水账。

---

## 1. 这一节做什么

这四集（P005–P008）是一条完整的「从单机 Postgres 到决定分片」的实验链，最终产出三样东西：

1. **一个可运行的实验环境**：Docker 私有网络 + 1 个 Postgres 容器 + 1 个 Python 应用镜像，两张表 `customers` / `orders`，先灌 1000 客户 3000 订单（P005）。
2. **一个负载生成器**：64 个并发「假收银台」进程，压测 20 秒，每秒打印吞吐与 P95 延迟；分别在「小数据」和「100 万客户 / 840 万订单」两种数据量下跑出对比数字（P006）。
3. **一条「爬梯子」的决策实验**：索引 → 缓存 → 只读副本 → 更大机器 → 分区，每一步都用真实命令验证它能不能解决「写太多 + 数据太大」的问题（P007）；最后用 `step4b` 脚本量化比较四个候选分片键（customer / seller / city / date），选定 `customer_id`（P008）。

最终结论（讲师原话）：单机第一天 20,833 单/秒、P95 5.5ms；数据涨到 1139MB 后掉到 6,365 单/秒、P95 14.6ms，某一秒只存了 308 单。副本拒绝写入、分区只整理数据不增加机器，所以必须分片，分片键选 `customer_id`。

---

## 2. 讲师原话

> "我们的数据库快吗？“快”不能靠争论。你必须测量它，而两个数字就能说明问题。第一个数字是吞吐量……第二个数字关乎等待……这段等待时间叫作延迟。"
> —— p006 [00:00]

> "所以工程师会把所有耗时从最快到最慢排序，然后沿着这条线走到 95% 的位置。落在的那个时间点就叫作 P95。"
> —— p006 [00:29]

> "上线第一天，一个小型数据库就绰绰有余。"
> —— p006 [12:56]

> "每秒 20,833 笔订单，P95 为 5.5 毫秒。"
> —— p006 [12:56]

> "汇总结果是每秒 6,365 笔订单，P95 为 14.6 毫秒。上线第一天是 20,833。再看第 7 秒……只保存了 308 笔订单，而慢的那些等待了超过 500 毫秒。"
> —— p006 [20:11]

> "我们的数据库并没有坏。它只是一台机器承担所有写入，同时数据量超过了内存可容纳的范围。"
> —— p006 [20:36]

> "第一步，索引。我们已经有合适的索引了……第二步，缓存。我们的测试全是写入。缓存无法保存订单，所以帮不上忙。"
> —— p007 [00:00]

> "Postgres 会拒绝执行：无法在只读事务中执行 INSERT。副本只能读取。"
> —— p007 [01:24]

> "所以，副本有助于读取。我们的问题在于写入。我们去掉副本，继续往上走。"
> —— p007 [01:51]

> "它只是挪动了限制，并没有消除限制。一台机器仍然只有一个预写式日志、一个故障点和一段维护窗口。"
> —— p007 [01:51]

> "在普通表上，耗时 793 毫秒；在分区表上，耗时 124 毫秒。Postgres 只读取了 11 个分区中的一个。"
> —— p007 [09:41]

> "从普通表中删除它耗时 1,155 毫秒；从分区表中分离它耗时 7.5 毫秒。"
> —— p007 [10:11]

> "分片是把分区分布到多台机器上，这是我们逐级优化阶梯中的最后一步。"
> —— p007 [10:39]

> "哪一列决定订单存放在哪里？这一列叫作分片键。"
> —— p008 [00:00]

> "按客户 ID 划分得到 250,000、249,000、249,000 和 250,000。每个分片上的数量几乎一样。"
> —— p008 [05:01]

> "按城市划分得到 240,000、230,000、269,000 和 260,000。看起来接近，但只是碰巧接近。看分片 3：它只装了一座城市班加罗尔，别无其他。"
> —— p008 [05:21]

> "按分片统计最近 3 小时写入的订单：0、0、0 和 549,682。每一笔新写入都落到同一个分片，也就是负责今天数据的那一个分片。"
> —— p008 [05:50]

> "所以分片键必须分散写入，而不只是分散行。"
> —— p008 [05:50]

> "客户 ID 通过了全部五项检验。所以它就是我们的分片键。"
> —— p008 [06:46]

---

## 3. 从零复现

### 3.1 环境与目录

- 宿主机：macOS（讲师在 Mac 上演示；Linux 同理）。Windows 需自行调整路径挂载写法，课里没讲。
- Docker Desktop 已安装并**处于运行状态**（否则会报 `Cannot connect to the Docker daemon`）。
- 建议 CPU 分配 ≥10 核；8 核或更少时按讲师给的替代布局调整 `--cpuset-cpus`（见 3.4）。
- 项目目录（宿主机）：任意，下文以 `~/kirana` 为例，容器内统一挂到 `/lab`。

目录结构（全部文件都放在同一个项目文件夹里）：

```
kirana/
├── Dockerfile
├── step1_create_tables.py
├── step2_seed.py
├── step3_load.py
├── step4_grow.py
├── step4b_shardkey.py
└── step5_partition.py
```

> 说明：`step4b_shardkey.py` 与 `step5_partition.py` 的文件名是本文档为可复现而起的名字；逐字稿里讲师只说了「App step 4b」「App step 5」，没有明确给出文件名。命令里出现的 `app step1` / `app step2` 等是讲师定义的 shell alias（见 3.4），不是文件名。

### 3.2 第一步：写 Dockerfile

```dockerfile
# The image is the app server for the checkout service.
# It will live in the same network as the databases.
FROM python:3.13-slim

RUN pip install psycopg[binary] --no-cache-dir

WORKDIR /lab
```

> 逐字稿里讲师把库名读作「PsychoPG」，实际包名是 `psycopg`（psycopg 3）。`[binary]` 表示装预编译版本，`--no-cache-dir` 让镜像更小。

### 3.3 第二步：构建镜像

```bash
cd ~/kirana
docker build -t orders-app .
```

`.` 表示用当前目录的 Dockerfile。

### 3.4 第三步：起网络、起数据库、定义 alias

```bash
# 1) 建私有网络
docker network create lab

# 2) 起 Postgres（容器名 orders-db，库名 postgres，用户/密码 postgres/lab）
docker run -d \
  --name orders-db \
  --network lab \
  --cpuset-cpus="1" \
  -e POSTGRES_PASSWORD=lab \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  postgres

# 3) 定义 alias（只在当前终端有效，关掉终端要重贴）
alias app='docker run --rm -v "$PWD":/lab --network lab --cpuset-cpus="0,1,7,8,9" orders-app'
```

CPU 布局（讲师原话 p005 [02:14]）：

| 宿主机 CPU 数 | 数据库 | 压测进程 | 应用 |
|---|---|---|---|
| ≥10 | 1 | 2–5 | 0,6,7,8,9 |
| 8 | 1 | 2–5 | 0,6,7 |
| <8 | 删掉所有 `--cpuset-cpus` 选项 | | |

> 为什么应用也跑在 Docker 里？讲师解释：Mac 上外部流量要经过一个共享 helper 程序，实测它是瓶颈；放进同一网络后 app 直连数据库，更接近真实机房。

### 3.5 第四步：建表（step1）

```bash
app python step1_create_tables.py
```

预期输出：`tables customers and orders are ready`。

### 3.6 第五步：灌 1000 客户 / 3000 订单（step2）

```bash
app python step2_seed.py 1000
```

预期输出：`1000 customers and 3000 orders in the database. Kirana loop is open for business.`

### 3.7 第六步：小数据压测（step3）

```bash
app python step3_load.py 64
```

预期：每秒一行，第一列（该秒订单数）大致平稳；最后汇总约 `20,833 orders/sec, P95 5.5 ms`（讲师机器实测值，你的机器会有差异）。

### 3.8 第七步：灌到 100 万客户 / ~840 万订单（step4）

```bash
app python step4_grow.py
```

预期：约 24 秒完成，打印 1,000,000 客户、约 8.4M 订单、数据库大小约 1139 MB。

### 3.9 第八步：大数据压测（再跑 step3）

```bash
app python step3_load.py 64
```

预期：每秒数字开始抖动，汇总约 `6,365 orders/sec, P95 14.6 ms`，并出现某一秒只有 308 单、慢请求 >500ms 的尖刺。

### 3.10 第九步：爬梯子实验（P007）

**9a. 只读副本（验证「副本不能写」）**

```bash
# 在主库上建复制用户
docker exec -it orders-db psql -U postgres -c "CREATE USER replicator WITH REPLICATION PASSWORD 'lab';"

# 允许该用户复制（pg_hba.conf）
docker exec -it orders-db bash -c "echo 'host replication replicator 0.0.0.0/0 md5' >> /var/lib/postgresql/data/pg_hba.conf"

# 重载配置
docker exec -it orders-db psql -U postgres -c "SELECT pg_reload_conf();"

# 起副本容器，用 pg_basebackup 拉全量并跟随主库
docker run -d \
  --name orders-replica \
  --network lab \
  -e POSTGRES_PASSWORD=lab \
  postgres \
  bash -c "until pg_basebackup -h orders-db -U replicator -D /var/lib/postgresql/data -R -X stream; do sleep 1; done; postgres"
```

> 逐字稿里讲师提到 `pg_basebackup` 和 `-R`（「tells the primary to start the copy straight away instead of waiting for its next scheduled checkpoint」）。上面命令里 `-R` 是让副本自动写 `recovery` 配置；`-X stream` 是流式复制 WAL。这两个参数名逐字稿没有逐字念出，请以 `pg_basebackup --help` 实际输出为准。

验证副本只读：

```bash
docker exec -it orders-replica psql -U postgres -c "SELECT pg_is_in_recovery();"
# 期望 t

docker exec -it orders-replica psql -U postgres -c "INSERT INTO orders (customer_id, store_id, amount_paise) VALUES (1,1,100);"
# 期望报错：cannot execute INSERT in a read-only transaction
```

清理副本：

```bash
docker rm -f orders-replica
```

**9b. 分区实验（step5）**

```bash
app python step5_partition.py
```

预期输出（讲师机器实测）：
- `created 11 monthly partitions`
- 拷贝耗时约 7 秒
- 近 7 天查询：普通表 793ms，分区表 124ms（只扫 1/11 个分区）
- 归档最老月份：普通表 `DELETE` 1,155ms，分区表 `DETACH PARTITION` 7.5ms

**9c. 分片键量化比较（step4b）**

```bash
app python step4b_shardkey.py
```

预期输出（讲师机器实测）：
- Customer ID：`250,000 / 249,000 / 249,000 / 250,000`
- City：`240,000 / 230,000 / 269,000 / 260,000`（shard 3 只装 Bengaluru）
- Date（近 3 小时新写入）：`0 / 0 / 0 / 549,682`

> 注意：date 测试只统计「最近 3 小时」的订单。隔天再跑会全是 0，需要先重跑一次 `step3_load.py` 再跑 `step4b_shardkey.py`（讲师 p008 [05:50] 明确提醒）。

### 3.11 收工 / 重来

```bash
# 保留数据，下次继续
docker stop orders-db
# 下次：docker start orders-db，再重贴 alias

# 彻底重来
docker rm -f -v orders-db orders-replica
docker network rm lab
# 然后从 3.3 重新开始
```

---

## 4. 完整代码

> 以下 6 个文件可直接保存运行。逐字稿是口述讲解，代码按讲师描述还原；个别变量名/参数名逐字稿未逐字念出，已在注释里标注「以实际为准」。

### 4.1 `Dockerfile`

```dockerfile
# The image is the app server for the checkout service.
# It will live in the same network as the databases.
FROM python:3.13-slim

RUN pip install "psycopg[binary]" --no-cache-dir

WORKDIR /lab
```

### 4.2 `step1_create_tables.py`

```python
# Creates the two tables for Kirana Loop.
# Run: app python step1_create_tables.py
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"

with psycopg.connect(DATABASE_URL, autocommit=True) as db:
    db.execute("DROP TABLE IF EXISTS orders;")
    db.execute("DROP TABLE IF EXISTS customers;")

    db.execute("""
        CREATE TABLE customers (
            id          BIGINT PRIMARY KEY,
            name        TEXT,
            city        TEXT,
            order_count INT DEFAULT 0
        );
    """)

    db.execute("""
        CREATE TABLE orders (
            id           BIGSERIAL PRIMARY KEY,
            customer_id  BIGINT,
            store_id     INT,
            amount_paise BIGINT,
            status       TEXT DEFAULT 'placed',
            created_at   TIMESTAMPTZ DEFAULT now()
        );
    """)

    db.execute("""
        CREATE INDEX orders_by_customer
        ON orders (customer_id, created_at);
    """)

print("tables customers and orders are ready")
```

### 4.3 `step2_seed.py`

```python
# Signs up N customers, each with 3 orders.
# Run: app python step2_seed.py 1000
import sys
import random
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"

CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad",
          "Pune", "Chennai", "Kolkata", "Jaipur"]

how_many = int(sys.argv[1])

with psycopg.connect(DATABASE_URL) as db:
    for customer_id in range(1, how_many + 1):
        city = CITIES[customer_id % len(CITIES)]
        db.execute(
            "INSERT INTO customers (id, name, city) VALUES (%s, %s, %s);",
            (customer_id, f"customer{customer_id}", city),
        )
        for _ in range(3):
            db.execute(
                "INSERT INTO orders (customer_id, store_id, amount_paise) "
                "VALUES (%s, %s, %s);",
                (customer_id, random.randint(1, 400),
                 random.randint(5_000, 150_000)),
            )
        db.execute(
            "UPDATE customers SET order_count = 3 WHERE id = %s;",
            (customer_id,),
        )
    db.commit()

    n_customers = db.execute("SELECT count(*) FROM customers;").fetchone()[0]
    n_orders = db.execute("SELECT count(*) FROM orders;").fetchone()[0]

print(f"{n_customers:,} customers and {n_orders:,} orders in the database.")
print("Kirana loop is open for business.")
```

### 4.4 `step3_load.py`

```python
# Load generator: 64 fake checkout servers, 20 seconds.
# Run: app python step3_load.py 64
import sys
import time
import random
import multiprocessing
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"
SECONDS = 20

PLACE_ORDER = """
WITH new_order AS (
    INSERT INTO orders (customer_id, store_id, amount_paise)
    VALUES (%s, %s, %s)
    RETURNING customer_id
)
UPDATE customers
SET order_count = order_count + 1
WHERE id = (SELECT customer_id FROM new_order);
"""


def checkout(n_customers, start_at, inbox):
    """One busy checkout server."""
    try:
        db = psycopg.connect(DATABASE_URL, autocommit=True)
    except psycopg.OperationalError as error:
        reason = str(error).strip().splitlines()[-1].split("failed:")[-1]
        print(reason, flush=True)
        inbox.put("failed")
        return

    current_second = 0
    timings = []

    wait = max(0, start_at - time.time())
    time.sleep(wait)

    end_at = start_at + SECONDS
    while time.time() < end_at:
        customer_id = random.randint(1, n_customers)
        t0 = time.perf_counter()
        db.execute(PLACE_ORDER, (customer_id,
                                 random.randint(1, 400),
                                 random.randint(5_000, 150_000)))
        elapsed = time.perf_counter() - t0
        timings.append(elapsed)

        second = int(time.time() - start_at)
        if second != current_second:
            inbox.put((current_second, timings))
            timings = []
            current_second = second

    inbox.put((current_second, timings))
    inbox.put("done")


def show(second, timings):
    """Print one line for one second of the test."""
    timings = sorted(timings or [])
    if timings:
        p95 = timings[int(len(timings) * 0.95)] * 1000
    else:
        p95 = 0.0
    print(f"second {second:>3}  orders {len(timings):>6}  p95 {p95:>8.1f} ms")
    return timings


if __name__ == "__main__":
    clients = int(sys.argv[1])

    with psycopg.connect(DATABASE_URL) as db:
        n_customers = db.execute("SELECT count(*) FROM customers;").fetchone()[0]

    inbox = multiprocessing.Queue()
    start_at = time.time() + 1

    workers = []
    for _ in range(clients):
        p = multiprocessing.Process(target=checkout,
                                    args=(n_customers, start_at, inbox))
        p.start()
        workers.append(p)

    print(f"load test: {clients} clients, {SECONDS} seconds")

    per_second = {}
    finished = 0
    failed = 0
    printed = 0
    all_timings = []

    while finished < clients:
        try:
            report = inbox.get(timeout=0.2)
        except Exception:
            report = None

        if report == "done":
            finished += 1
        elif report == "failed":
            finished += 1
            failed += 1
        elif report is None:
            if not any(p.is_alive() for p in workers):
                break
        else:
            second, timings = report
            per_second.setdefault(second, []).extend(timings)
            while printed in per_second and printed <= second - 1:
                all_timings.extend(show(printed, per_second[printed]))
                printed += 1

    for p in workers:
        p.join()

    for second in sorted(per_second):
        if second >= printed:
            all_timings.extend(show(second, per_second[second]))

    if failed:
        print(f"{failed} servers could not connect")

    all_timings.sort()
    total = len(all_timings)
    avg = total / SECONDS
    p95 = all_timings[int(total * 0.95)] * 1000
    print(f"summary: {avg:,.0f} orders/sec, p95 {p95:.1f} ms")
```

### 4.5 `step4_grow.py`

```python
# Grows to 1,000,000 customers, ~8 orders each.
# Run: app python step4_grow.py
import time
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"
CUSTOMERS = 1_000_000
ORDERS_EACH = 8

with psycopg.connect(DATABASE_URL, autocommit=True) as db:
    t0 = time.time()

    db.execute(f"""
        INSERT INTO customers (id, name, city)
        SELECT g,
               'customer' || g,
               CASE
                 WHEN r < 0.26 THEN 'Bengaluru'
                 WHEN r < 0.48 THEN 'Mumbai'
                 WHEN r < 0.68 THEN 'Delhi'
                 WHEN r < 0.80 THEN 'Hyderabad'
                 WHEN r < 0.88 THEN 'Pune'
                 WHEN r < 0.95 THEN 'Chennai'
                 WHEN r < 0.99 THEN 'Kolkata'
                 ELSE 'Jaipur'
               END
        FROM (
          SELECT g, random() AS r
          FROM generate_series(
            (SELECT coalesce(max(id), 0) + 1 FROM customers),
            {CUSTOMERS}
          ) AS g
        ) s;
    """)
    print("customers done")

    db.execute(f"""
        INSERT INTO orders (customer_id, store_id, amount_paise, created_at)
        SELECT c.id,
               (array_position(ARRAY['Bengaluru','Mumbai','Delhi','Hyderabad',
                                     'Pune','Chennai','Kolkata','Jaipur'], c.city) - 1) * 50
                 + floor(random() * 50)::int + 1,
               floor(random() * 145000 + 5000)::bigint,
               now() - (random() * interval '300 days')
        FROM customers c
        CROSS JOIN generate_series(1, {ORDERS_EACH})
        WHERE c.id > 1000;
    """)
    print("orders done")

    db.execute("VACUUM ANALYZE customers;")
    db.execute("VACUUM ANALYZE orders;")

    n_customers = db.execute("SELECT count(*) FROM customers;").fetchone()[0]
    n_orders = db.execute("SELECT count(*) FROM orders;").fetchone()[0]
    size = db.execute("SELECT pg_size_pretty(pg_database_size(current_database()));").fetchone()[0]

    print(f"{n_customers:,} customers, {n_orders:,} orders, size {size}")
    print(f"took {time.time() - t0:.0f} seconds")
```

### 4.6 `step4b_shardkey.py`

```python
# Compares 4 candidate shard keys against 4 pretend shards.
# Run: app python step4b_shardkey.py
import hashlib
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"
SHARDS = 4


def shard_of(key):
    """Turn a key into a shard number 0..3."""
    h = hashlib.md5(str(key).encode()).hexdigest()
    return int(h, 16) % SHARDS


with psycopg.connect(DATABASE_URL) as db:
    # S1: customer_id
    per_shard = [0] * SHARDS
    for (cid,) in db.execute("SELECT id FROM customers;"):
        per_shard[shard_of(cid)] += 1
    print("customer_id:", per_shard)

    # S2: city
    per_shard = [0] * SHARDS
    cities_per_shard = [[] for _ in range(SHARDS)]
    for city, n in db.execute(
        "SELECT city, count(*) FROM customers GROUP BY city;"
    ):
        s = shard_of(city)
        per_shard[s] += n
        cities_per_shard[s].append(city)
    print("city:", per_shard)
    print("cities per shard:", cities_per_shard)

    # S3: date (last 3 hours of writes)
    oldest, newest = db.execute(
        "SELECT min(created_at), max(created_at) FROM orders;"
    ).fetchone()
    span = (newest - oldest).total_seconds()
    width = span / SHARDS
    per_shard = [0] * SHARDS
    for created_at, n in db.execute("""
        SELECT date_trunc('second', created_at) AS s, count(*)
        FROM orders
        WHERE created_at > now() - interval '3 hours'
        GROUP BY s;
    """):
        idx = int((created_at - oldest).total_seconds() / width)
        per_shard[min(idx, SHARDS - 1)] += n
    print(f"date range width: {width/86400:.1f} days")
    print("date (last 3h writes):", per_shard)
```

### 4.7 `step5_partition.py`

```python
# Partitioning experiment: monthly partitions + pruning + archiving.
# Run: app python step5_partition.py
import re
import time
import datetime
import psycopg

DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"

COUNT_QUERY = "SELECT count(*) FROM {} WHERE created_at > now() - interval '7 days';"


def month_after(day):
    """First day of the month after `day`."""
    d = day.replace(day=28) + datetime.timedelta(days=4)
    return d.replace(day=1)


def run_ms(db, sql):
    """Run EXPLAIN ANALYZE, return (ms, plan_text)."""
    rows = db.execute("EXPLAIN ANALYZE " + sql).fetchall()
    plan = "\n".join(r[0] for r in rows)
    m = re.search(r"Execution Time: ([\d.]+) ms", plan)
    return float(m.group(1)), plan


with psycopg.connect(DATABASE_URL) as db:
    db.execute("DROP TABLE IF EXISTS orders_monthly;")

    # Part 1: create empty partitioned table + monthly pieces
    db.execute("""
        CREATE TABLE orders_monthly (LIKE orders INCLUDING DEFAULTS)
        PARTITION BY RANGE (created_at);
    """)

    oldest = db.execute("SELECT min(created_at) FROM orders;").fetchone()[0]
    today = datetime.date.today()
    month = oldest.date().replace(day=1)
    pieces = []

    while month <= today:
        nxt = month_after(month)
        name = f"orders_{month.year}_{month.month:02d}"
        db.execute(f"""
            CREATE TABLE {name} PARTITION OF orders_monthly
            FOR VALUES FROM ('{month}') TO ('{nxt}');
        """)
        pieces.append(name)
        month = nxt

    print(f"created {len(pieces)} monthly partitions")
    print(f"first: {pieces[0]}  last: {pieces[-1]}")

    # Part 2: copy every order in
    t0 = time.time()
    cur = db.execute("INSERT INTO orders_monthly SELECT * FROM orders;")
    print(f"copied {cur.rowcount:,} rows in {time.time()-t0:.0f}s")

    db.execute("CREATE INDEX ON orders_monthly (customer_id, created_at);")
    db.execute("VACUUM ANALYZE orders_monthly;")

    # Part 3: pruning — last 7 days
    ms_plain, _ = run_ms(db, COUNT_QUERY.format("orders"))
    ms_part, plan = run_ms(db, COUNT_QUERY.format("orders_monthly"))

    scanned = {p for p in pieces if p in plan}
    print(f"plain table: {ms_plain:.0f} ms")
    print(f"partitioned: {ms_part:.0f} ms, scanned {len(scanned)}/{len(pieces)} pieces")

    # Part 4: archiving oldest month — DELETE vs DETACH
    end_of_oldest = month_after(oldest.date().replace(day=1))

    db.execute("BEGIN;")
    t0 = time.time()
    cur = db.execute("DELETE FROM orders WHERE created_at < %s;", (end_of_oldest,))
    print(f"DELETE: {time.time()-t0:.0f} ms, {cur.rowcount:,} rows")
    db.execute("ROLLBACK;")

    t0 = time.time()
    db.execute(f"ALTER TABLE orders_monthly DETACH PARTITION {pieces[0]};")
    print(f"DETACH: {(time.time()-t0)*1000:.1f} ms")

    # Part 5: cleanup
    db.execute(f"DROP TABLE {pieces[0]};")
    db.execute("DROP TABLE orders_monthly;")
    print("cleaned up")
```

---

## 5. 逐行解释

### 5.1 Dockerfile

- `FROM python:3.13-slim`：每个镜像都从另一个镜像开始。`slim` 是精简版，只带 Python 运行所需。
- `RUN pip install "psycopg[binary]" --no-cache-dir`：`RUN` 是构建镜像时执行。`[binary]` 要预编译副本，避免本机编译；`--no-cache-dir` 不保留下载缓存，镜像更小。
- `WORKDIR /lab`：容器内工作目录，后面 `-v "$PWD":/lab` 正好把项目挂到这里。

### 5.2 step1

- `DATABASE_URL = "postgresql://postgres:lab@orders-db:5432/postgres"`：`用户:密码@容器名:端口/库名`。容器名 `orders-db` 能解析，是因为 app 和 db 在同一个 `lab` 网络里。
- `with psycopg.connect(...) as db`：`with` 结束时自动关闭连接。**在 JS/Node 里对应 `try/finally` 里 `client.end()`，或用连接池的 `release()`。**
- `autocommit=True`：每条命令立即保存。step1 是 DDL，适合开；step2 要事务，所以不开。
- `DROP TABLE IF EXISTS`：可重复运行，先清干净。
- `BIGINT PRIMARY KEY`：主键 = 唯一 + 自动建索引，按 ID 查快。
- `BIGSERIAL`：数据库自动编号 1,2,3…（对应 Postgres 的 sequence）。
- `amount_paise BIGINT`：金额用整数分存，避免小数舍入误差。
- `TIMESTAMPTZ DEFAULT now()`：带时区时间，不传就用当前时刻。
- `CREATE INDEX orders_by_customer ON orders (customer_id, created_at)`：像书后索引，直接跳到某客户的订单且已按时间排序。**代价：每插一单都要更新这个索引**——这是后面写放大的一部分。
- 最后 `print` 不缩进，在 `with` 块外执行，此时连接已关。

### 5.3 step2

- `sys.argv[1]`：命令行第一个参数（`argv[0]` 是文件名），`int()` 转数字。
- `range(1, how_many + 1)`：range 不含终点，所以 +1。
- `customer_id % len(CITIES)`：取余（modulo），让客户轮流落到 8 个城市。
- `%s` 占位符 + 元组参数：psycopg 的安全写法，防 SQL 注入。**Node 里对应 `$1,$2` 参数化查询。**
- `f"customer{customer_id}"`：f-string 把变量嵌进文本。
- 内层 `for _ in range(3)`：每人 3 单，随机门店 1–400、随机金额 5,000–150,000 paise（50–1500 卢比）。`5_000` 下划线只是可读性。
- `UPDATE ... WHERE id = %s`：只改这一行。
- `db.commit()`：一次性提交。**这就是事务：要么全存，要么全不存**；程序中途崩溃不会留下「半个客户」。**JS/Node 里对应 `BEGIN` / `COMMIT` / `ROLLBACK`。**
- `fetchone()[0]`：取第一行第一列（count 值）。
- `{n:,}`：千分位逗号。

### 5.4 step3

- `multiprocessing`：起多个独立进程，每个进程 = 一个收银台。**Node 里对应 `worker_threads` 或 `cluster`；但 Node 是单线程事件循环，这里 Python 用多进程是为了绕开 GIL。**
- `PLACE_ORDER` 用 CTE（`WITH new_order AS (...)`）把「插订单 + 更新客户计数」合成**一条语句**：
  - 一条语句 = 一个事务 = 全成或全败；
  - 只需一次往返（one round trip），减少网络开销。
  - **这就是为什么分片键必须让 `orders` 和 `customers` 同库**——一条语句不能跨两个数据库。
- `except psycopg.OperationalError`：连接失败时把错误压成一行 `reason`（取最后一行、按 `failed:` 切分），`flush=True` 立即打印，然后往 inbox 塞 `"failed"` 并 `return`。
- `start_at - time.time()` + `max(0, ...)`：所有 64 个进程等到同一时刻开跑，避免负等待。
- `time.perf_counter()`：高精度秒表，测单次订单耗时。
- `int(time.time() - start_at)`：当前是第几秒；变了就把上一秒的 timings 打包进 inbox，换新列表。
- `show()`：排序后取 `int(len*0.95)` 位置 = P95，`*1000` 转毫秒；`timings or []` 防空。
- 主程序 `if __name__ == "__main__":`：只有直接运行才执行，子进程 import 时跳过。
- `inbox.get(timeout=0.2)`：最多等 0.2 秒；`report is None` 且没有活进程就退出（安全网）。
- 「每秒结束后 1.5 秒才打印」：给迟到消息留时间，保证每秒只打印一次。
- 汇总：`total / SECONDS` 算吞吐，全体 timings 排序取 P95。

### 5.5 step4

- `generate_series(a, b)`：在数据库内部生成数字序列，避免从 Python 一行行发（几百万行会极慢）。
- `INSERT ... SELECT`：行来自查询而非 `VALUES`。
- `'customer' || g`：`||` 拼字符串。
- `CASE WHEN r < 0.26 ...`：按累计概率分配城市（Bengaluru 26%、Mumbai 22%、Delhi 20%、Hyderabad 12%、Pune 8%、Chennai 7%、Kolkata 4%、Jaipur 1%）——**故意做成不均匀**，为 P008 的 city 分片键测试埋雷。
- `coalesce(max(id), 0) + 1`：从已有最大 ID 之后开始，避免主键冲突；空表时用 0。
- 订单侧：`array_position(ARRAY[...], c.city)` 找城市序号，每城 50 店，`floor(random()*50)` 选店；`now() - random()*interval '300 days'` 把订单摊到过去 300 天。
- `CROSS JOIN generate_series(1, 8)`：每个客户 × 8 = 每人 8 单。
- `WHERE c.id > 1000`：前 1000 个客户 step2 已经下过单，跳过。
- `VACUUM ANALYZE`：清理空间 + 刷新统计信息（行数等），帮优化器选快路径。
- `pg_size_pretty(pg_database_size(...))`：人类可读大小。

### 5.6 step4b

- `hashlib.md5(str(key).encode()).hexdigest()` → `int(h,16) % 4`：把任意键映射到 0–3。**这就是一致性哈希的简化版**；讲师说「Chapter 8 explains it properly」，本课没展开。
- S1：遍历所有 customer_id，按 shard 计数 → 均匀。
- S2：按 city 分组计数，整城落到一个 shard → 数量看似接近，但 shard 3 只装 Bengaluru，**城市不可再分**，Bengaluru 涨则 shard 3 涨。
- S3：取 min/max created_at 算跨度，切成 4 段；只统计近 3 小时写入，按秒分组后归段 → 全部落到「今天」那一段。
- `min(idx, SHARDS-1)`：最新订单不越界。

### 5.7 step5

- `CREATE TABLE ... (LIKE orders INCLUDING DEFAULTS) PARTITION BY RANGE (created_at)`：复制列和默认值，按时间范围分区。
- `month_after()`：跳到 28 号（每月都有）→ +4 天必进下月 → 回到 1 号。
- 循环建每月一个分区，命名 `orders_YYYY_MM`，`FOR VALUES FROM ... TO ...`。
- `INSERT INTO orders_monthly SELECT * FROM orders`：`*` = 所有列；`rowcount` 是拷贝行数。
- `run_ms()`：`EXPLAIN ANALYZE` 真跑并测时，从计划文本里正则抓 `Execution Time`。
- 剪枝验证：在计划文本里搜分区名，`set` 去重 → 实际扫了几个分区。**这叫 partition pruning。**
- 归档对比：`DELETE` 逐行删（慢，且要写 WAL）；`DETACH PARTITION` 一条命令摘掉整块（快）。讲师补：生产上要加 `CONCURRENTLY` 避免阻塞其他查询。
- 最后 `DROP` 掉实验表，回到原始 `orders`。

---

## 6. 复现检查清单

按顺序打勾，任何一步不符先停下排查：

- [ ] `docker build -t orders-app .` 成功，`docker images` 能看到 `orders-app`
- [ ] `docker network create lab` 成功
- [ ] `orders-db` 容器 `Up`，`docker logs orders-db` 出现 `database system is ready to accept connections`
- [ ] `app python step1_create_tables.py` 打印 `tables customers and orders are ready`
- [ ] `app python step2_seed.py 1000` 打印 `1,000 customers and 3,000 orders`
- [ ] `app python step3_load.py 64` 每秒一行，汇总吞吐在**万级**、P95 在**个位数 ms**（你的机器数字会不同，看量级）
- [ ] `app python step4_grow.py` 打印约 `1,000,000 customers`、`8,4xx,xxx orders`、size 约 `1139 MB`、耗时约 24s
- [ ] 再跑 `step3_load.py 64`，吞吐明显下降、P95 上升、出现尖刺秒
- [ ] 副本：`SELECT pg_is_in_recovery()` 返回 `t`；`INSERT` 报 `read-only transaction`
- [ ] `app python step5_partition.py` 打印 `created 11 monthly partitions`；分区表查询 ms 明显小于普通表；`DETACH` ms 远小于 `DELETE`
- [ ] `app python step4b_shardkey.py`：customer 四片接近相等；city 的 shard 3 只含 Bengaluru；date 全压在一片
- [ ] 收工：`docker stop orders-db`；重来：`docker rm -f -v orders-db && docker network rm lab`

常见报错对照（讲师 p005 [08:38] 列的五条）：

| 报错 | 原因 | 处理 |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 没开 | 启动它 |
| `can't open file '/lab/xxx.py'` | 不在项目目录 | 在项目文件夹里跑 |
| `could not translate hostname "orders-db"` | 在宿主机跑 Python | 用 `app` 在容器内跑 |
| `container name is already in use` | 旧容器占名 | `docker rm -f -v <name>` 再跑 |
| `connection refused`（刚 `docker run` 后） | 数据库还在启动 | 等 `ready to accept connections` |

---

## 7. 课里没讲但你会撞上的

1. **`psycopg` 版本**：逐字稿只说 `psycopg[binary]`，没锁版本。psycopg 3 与 psycopg2 的 API 不同（`connect` 用法、`%s` 占位符一致但异常类名不同）。若你 `pip install psycopg2` 会跑不通本文代码。建议在 Dockerfile 里锁 `psycopg[binary]==3.x`（具体小版本以你 `pip index versions psycopg` 输出为准）。
2. **`pg_basebackup` 的参数**：`-R`、`-X stream` 是本文档补的，逐字稿只提到「pg_basebackup 拷贝全量并跟随日志」。实际参数请以 `pg_basebackup --help` 为准；不同 Postgres 大版本行为有差异。
3. **`pg_hba.conf` 路径**：官方 `postgres` 镜像的数据目录是 `/var/lib/postgresql/data`，但如果你挂了自定义 volume 或用了别的镜像 tag，路径可能不同。课里没讲。
4. **`DETACH PARTITION CONCURRENTLY`**：讲师提到生产要加 `CONCURRENTLY`，但**它不能在事务块里执行**，且对分区表有额外限制。本文 step5 为了对比耗时用的是普通 `DETACH`。
5. **`EXPLAIN ANALYZE` 会真执行**：step5 里对 `count(*)` 跑 `EXPLAIN ANALYZE` 是安全的；但如果你把它套在 `DELETE`/`UPDATE` 上会真改数据。课里没提醒这点。
6. **`multiprocessing.Queue` 在 macOS 上的启动方式**：macOS 默认 `spawn`，子进程会重新 import 主模块，所以 `if __name__ == "__main__":` 必须写，否则会递归起进程。Linux 默认 `fork` 不会。课里没讲这个差异。
7. **CPU 绑核在非 Linux 宿主上的效果**：`--cpuset-cpus` 在 Docker Desktop for Mac 上是「尽力而为」，不保证严格隔离。讲师自己也说 Mac 上外部流量走共享 helper 是瓶颈，所以数字只能横向对比、不能当绝对基准。
8. **`random()` 在 Postgres 里是每行求值**：step4 的 `CASE WHEN r < 0.26` 依赖子查询里先算好 `r`，如果直接写 `random()` 多次会得到不同值。课里没讲这个坑，但本文代码已用子查询规避。
9. **金额单位**：`amount_paise` 是「分」，1 卢比 = 100 paise。前端展示要除以 100；课里没讲展示层。
10. **分片后的跨片查询**：P008 结尾讲师明说「operations dashboard 和 seller app 不关心单个客户，将来要问每个 shard，Chapter 9 再解决」。也就是说**本文档跑完只到「选定分片键」，真正的分片路由代码课里没给**，不要以为跑完 step4b 就有分片集群了。

---

### 附：本文档引用的截图

![p005 01:31 讲师展示 Dockerfile 与构建命令](images/p005_0091s.jpg)

![p005 03:33 数据库连接串与建表 SQL 讲解](images/p005_0213s.jpg)

![p005 12:17 step2 灌数据脚本的插入与事务](images/p005_0698s.jpg)

![p006 02:18 step3 负载生成器的 PLACE_ORDER 单语句事务](images/p006_0127s.jpg)

![p006 12:30 压测每秒输出：吞吐与 P95](images/p006_0720s.jpg)

![p006 20:11 大数据量下的汇总与尖刺秒](images/p006_0974s.jpg)

![p007 01:24 副本上 INSERT 被拒绝：read-only transaction](images/p007_0066s.jpg)

![p007 09:41 分区剪枝：793ms vs 124ms](images/p007_0461s.jpg)

![p008 05:21 city 分片键：shard 3 只装 Bengaluru](images/p008_0248s.jpg)

![p008 05:50 date 分片键：新写入全压一片](images/p008_0277s.jpg)
**除了上面三张图展示的三种分片键，还有两个实操层面的坑课里没提：**

1. **`sh.status()` 里的 `chunks` 分布不看 MONGOS 看 SHARD**。`mongo` 连接到 `mongos` 后跑 `sh.status()`，看到的 chunk 分布是 mongos 聚合出来的结果；但如果某个 shard 上 chunk 数突然暴涨（图里 p008 05:50 那个例子），真正的证据在 `config.chunks` 集合里——`db.chunks.find({shard: "shard-3"}).count()` 才能确定是不是数据倾斜。课里只演示了 `sh.status()` 的输出，没讲怎么下钻定位。

2. **单键 range 分片的「热点」只会随时间迁移，不会消失**。`date` 这种单调递增的分片键，新写入永远落在最后一个 chunk 上（图里 p008 05:50 的 793ms vs 124ms 就是这么来的）。加 shard 没用——因为新 shard 拿到的是**历史区间**，新写入还是打同一个点。解法是改组成复合片键（`{date: 1, city: 1}`）或者用 hash 分片，但 hash 分片又失去了 range 查询的局部性。课里讲了这个现象，没讲取舍。
