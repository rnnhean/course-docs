# 数据库工程基础 P25–P28：索引选择、并发建索引、布隆过滤器与十亿行表

> 本文覆盖 `BV1zNtU63Eqf` 的 P25–P28。目标不是“复述课堂”，而是搭一个**能跑起来的最小实验**：用 PostgreSQL 16.3 + Node.js 20 + Express 4.19.2 + pg 8.12.0，复现四件事：  
> 1）优化器如何在多个索引之间做选择；2）`CREATE INDEX CONCURRENTLY` 为什么能减少写入阻塞；3）布隆过滤器如何用极小内存挡掉“肯定不存在”的查询；4）十亿行表为什么要从“避免大表、索引、分区、分片、并行处理”逐层缩小。  
> 课里没有给完整项目代码，下面的代码是我为了复现概念补的最小实验；逐字稿没讲到的工程细节，我会明确写“课里没讲”。

---

## 1. 这一节做什么

这一节要做一个可复现的实验项目，目录如下：

```text
db-index-bloom-lab/
├── docker-compose.yml
├── .env.example
├── package.json
├── init.sql
├── partition.sql
├── queries.sql
└── server.js
```

技术栈与版本：

- PostgreSQL `16.3`，Docker 镜像 `postgres:16.3`
- Node.js `20.x`
- Express `4.19.2`
- `pg` `8.12.0`
- `dotenv` `16.4.5`

环境变量名：

- `DATABASE_URL`：PostgreSQL 连接串
- `PORT`：Express 端口，默认 `3000`
- `BLOOM_BITS`：布隆过滤器位数，默认 `64`

启动命令：

```bash
cp .env.example .env
docker compose up -d
npm install
npm start
```

实验目标：

1. 建一张 `users` 表，插入 100 万行演示数据，分别给 `username`、`state` 建索引。
2. 用 `EXPLAIN (ANALYZE, BUFFERS)` 观察优化器选择哪个索引，或者是否直接顺序扫描。
3. 用 `CREATE INDEX CONCURRENTLY` 演示“建索引时尽量不阻塞读写”。
4. 用 Node.js 在内存里实现一个 64 位布隆过滤器，提供 `/check/:username` 和 `/users` 接口。
5. 用 `partition.sql` 演示 PostgreSQL 声明式分区，理解“先分区、再索引、再分片”的缩小范围思路。

> 注意：逐字稿讲的是数据库工程概念，不是完整业务项目。下面的 Node.js 服务是为了让你能亲手看到“布隆过滤器挡查询”和“执行计划变化”，不是讲师原课里的代码。

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

P25 的核心问题是：**当表上有多个索引时，优化器到底用哪个？**

> "数据库优化器如何决定使用哪个索引，尤其是在有多个索引的情况下。"
> —— p025 [00:00]

![p025 00:23 讲师提出多个索引时优化器如何选择](images/p025_0023s.jpg)

讲师先给出“两个索引都可能被用”的场景：分别查 `f1idx` 和 `f2idx`，收集 row ID，再做交集或并集，最后按需回表。

> "它会查询 f1idx 查找值 1，收集匹配的行标识符；然后对 f2idx 做同样的搜索，只是查找值 4，收集另一组行标识符；接着本质上会对结果做交集或并集。"
> —— p025 [01:18]

![p025 01:18 两个索引分别查找并收集 row ID](images/p025_0113s.jpg)

但讲师马上强调：**不是所有查询都值得查两个索引**。如果结果集太小，查一个就够；如果结果集太大，可能直接全表扫描更便宜。

> "如果我们知道索引会返回太多行，那就不值得走索引。这种情况下，我们会走表扫描。"
> —— p025 [02:40]

![p025 03:09 只用一个索引再回表过滤的场景](images/p025_0204s.jpg)

讲师还解释了为什么“索引不是免费的”：

> "B 树并不便宜，各位；甚至 LSM 树也不便宜，索引搜索不是免费的。"
> —— p025 [04:27]

![p025 04:09 索引本身有成本，优化器要权衡](images/p025_0249s.jpg)

优化器靠什么知道“这个索引会返回多少行”？靠统计信息。

> "有一个东西叫统计信息……你也可以随时用 `ANALYZE` 命令更新这些统计信息。"
> —— p025 [04:57]

![p025 06:21 统计信息过期会导致错误执行计划](images/p025_0385s.jpg)

P26 讲生产环境建索引：普通 `CREATE INDEX` 会阻塞写入。

> "在生产数据库上创建索引，尤其是在大表上，可能耗时很长。不仅如此，它还会阻塞对表的写入。"
> —— p026 [00:00]

![p026 00:28 普通建索引会阻塞写入](images/p026_0019s.jpg)

所以有了 `CREATE INDEX CONCURRENTLY`：

> "`CREATE INDEX CONCURRENTLY`……允许在创建索引期间继续读写。"
> —— p026 [00:28]

![p026 00:57 并发建索引允许读写继续](images/p026_0057s.jpg)

但它不是没有代价：多次扫描、等待写事务、更耗 CPU/内存，而且可能失败。

> "它也可能失败……设想一下，如果这个索引本质上是唯一索引，而你在创建期间插入了重复值……索引最终会处于无效状态。"
> —— p026 [02:21]

P27 讲布隆过滤器。讲师先问“为什么需要它”，而不是直接背定义。

> "布隆过滤器是那种总让我困惑的概念之一……不是它是什么，而是它为什么存在。"
> —— p027 [00:00]

![p027 02:52 64 位布隆过滤器位图](images/p027_0130s.jpg)

核心判断只有两句：

> "如果这一位没有被设置，你就可以绝对地、100% 保证地说，这个用户名不存在。"
> —— p027 [03:47]

> "如果这一位被设置了，那只说明 Jack 可能存在。"
> —— p027 [04:11]

![p027 06:06 创建 jack 时设置对应 bit](images/p027_0242s.jpg)

P28 讲十亿行表。讲师给的顺序是：先别急着处理十亿行，先问“为什么要有一张十亿行表”。

> "也许我们可以一起避免这一切。你一开始为什么需要一张十亿行的表？"
> —— p028 [09:11]

![p028 05:30 分区、分片、索引逐层缩小范围](images/p028_0289s.jpg)

如果避免不了，就逐层缩小：索引、分区、分片、并行处理。

> "分片、分区，然后建索引，再精确找到我们要的那一行。"
> —— p028 [08:43]

![p028 09:11 先避免十亿行表，再考虑索引/分区/分片](images/p028_0447s.jpg)

---

## 3. 从零复现

### 3.1 前置条件

- 安装 Docker Desktop 或 Docker Engine
- 安装 Node.js 20+
- 可选：安装 `psql` 客户端；不装也可以用 `docker exec` 进容器执行 SQL

### 3.2 创建目录与文件

```bash
mkdir db-index-bloom-lab
cd db-index-bloom-lab
```

把第 4 节的 7 个文件完整保存到当前目录。

### 3.3 启动 PostgreSQL

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

首次启动时，`init.sql` 会挂载到 `/docker-entrypoint-initdb.d/init.sql` 并自动执行。它会建表、插入 100 万行、建两个索引、执行 `ANALYZE`。

如果你已经启动过、想重置数据：

```bash
docker compose down -v
docker compose up -d
```

### 3.4 安装依赖并启动 Node 服务

```bash
npm install
npm start
```

看到类似：

```text
listening on http://localhost:3000
```

### 3.5 验证布隆过滤器

先看健康检查：

```bash
curl http://localhost:3000/health
```

返回里会包含 `bloomBits` 和当前位图字符串。具体 JSON 字段以你实际输出为准。

创建一个用户 `jack`：

```bash
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"username":"jack","state":"CA"}'
```

再创建一个用户 `paul`：

```bash
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"username":"paul","state":"TX"}'
```

查询一个**没创建过**的用户：

```bash
curl http://localhost:3000/check/not_exist_user
```

如果布隆过滤器对应 bit 没被设置，会直接返回“不存在”，不会查 PostgreSQL。

查询 `jack`：

```bash
curl http://localhost:3000/check/jack
```

因为 bit 被设置，服务会去 PostgreSQL 查一次，返回“存在”。

> 注意：具体 bit 号由哈希函数决定，不保证和讲师例子里的 `jack -> 63`、`paul -> 3` 完全一样。讲师用的是示意例子。

### 3.6 观察执行计划

进入 PostgreSQL：

```bash
docker exec -it db-index-lab psql -U lab -d lab
```

执行：

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users
WHERE username = 'user_1' AND state = 'CA';
```

你会看到类似 `Index Scan`、`Bitmap Index Scan` 或 `Seq Scan` 的计划节点。**具体字段名和节点名以你本地 PostgreSQL 版本实际输出为准**。

更新统计信息：

```sql
ANALYZE users;
```

再执行一次 `EXPLAIN`，观察计划是否变化。

### 3.7 演示普通建索引阻塞写入

开两个终端。

终端 A：

```bash
docker exec -it db-index-lab psql -U lab -d lab
```

执行：

```sql
DROP INDEX IF EXISTS users_state_idx_slow;
CREATE INDEX users_state_idx_slow ON users (state);
```

终端 B：

```bash
docker exec -it db-index-lab psql -U lab -d lab
```

执行：

```sql
INSERT INTO users (username, state) VALUES ('blocked_user', 'CA');
```

如果表足够大，终端 B 会等待终端 A 的 `CREATE INDEX` 完成。1 万行可能太快，建议把 `init.sql` 里的 `generate_series(1, 1000000)` 改成 `5000000` 再试；生产不要照抄。

### 3.8 演示 `CREATE INDEX CONCURRENTLY`

先删掉刚才的索引：

```sql
DROP INDEX IF EXISTS users_state_idx_slow;
```

再执行：

```sql
CREATE INDEX CONCURRENTLY users_state_idx_slow ON users (state);
```

在它执行期间，另开终端执行插入：

```sql
INSERT INTO users (username, state) VALUES ('concurrent_user', 'CA');
```

你会看到写入不再被长时间阻塞。代价是建索引更慢、更耗 CPU/内存，而且失败后可能留下无效索引。

> `CREATE INDEX CONCURRENTLY` 不能在事务块里执行。课里没讲这个细节，但这是 PostgreSQL 的实际限制。

### 3.9 十亿行表：不要真的插十亿

本地只做概念验证。执行 `partition.sql`：

```bash
docker exec -i db-index-lab psql -U lab -d lab < partition.sql
```

然后：

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users_partitioned WHERE state = 'CA';
```

观察是否只扫描 `users_ca` 分区。具体输出以实际为准。

---

## 4. 完整代码

### 4.1 `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16.3
    container_name: db-index-lab
    environment:
      POSTGRES_USER: lab
      POSTGRES_PASSWORD: lab
      POSTGRES_DB: lab
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lab -d lab"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  pgdata:
```

### 4.2 `.env.example`

```dotenv
DATABASE_URL=postgres://lab:lab@localhost:5432/lab
PORT=3000
BLOOM_BITS=64
```

### 4.3 `package.json`

```json
{
  "name": "db-index-bloom-lab",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "init": "psql \"$DATABASE_URL\" -f init.sql"
  },
  "dependencies": {
    "dotenv": "16.4.5",
    "express": "4.19.2",
    "pg": "8.12.0"
  }
}
```

### 4.4 `init.sql`

```sql
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 插入 100 万行演示数据。
-- 生产不要直接照抄；本地实验够用。
INSERT INTO users (username, state)
SELECT
  'user_' || g,
  CASE WHEN g % 1000 = 0 THEN 'TX' ELSE 'CA' END
FROM generate_series(1, 1000000) AS g;

-- 两个索引，用来观察优化器选择。
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_state_idx ON users (state);

-- 更新统计信息，让优化器知道数据分布。
ANALYZE users;
```

### 4.5 `server.js`

```js
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://lab:lab@localhost:5432/lab';
const BLOOM_BITS = Number(process.env.BLOOM_BITS || 64);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const app = express();
app.use(express.json());

// 64 位布隆过滤器，用 BigInt 表示位图。
let bloom = 0n;

function hash64(str) {
  // FNV-1a 64-bit，仅用于演示。
  let h = 14695981039346656037n;
  const prime = 1099511628211n;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h;
}

function bitIndex(username) {
  return Number(hash64(username) % BigInt(BLOOM_BITS));
}

function bloomSet(username) {
  const idx = bitIndex(username);
  bloom |= 1n << BigInt(idx);
  return idx;
}

function bloomMaybe(username) {
  const idx = bitIndex(username);
  return (bloom & (1n << BigInt(idx))) !== 0n;
}

function bloomDump() {
  return bloom.toString(2).padStart(BLOOM_BITS, '0');
}

app.get('/health', async (req, res) => {
  const r = await pool.query('SELECT 1 AS ok');
  res.json({
    ok: r.rows[0].ok === 1,
    bloomBits: BLOOM_BITS,
    bloom: bloomDump(),
  });
});

app.get('/check/:username', async (req, res) => {
  const username = req.params.username;

  if (!bloomMaybe(username)) {
    return res.json({
      username,
      exists: false,
      source: 'bloom-filter',
      note: 'definitely not in database',
    });
  }

  const r = await pool.query(
    'SELECT username FROM users WHERE username = $1 LIMIT 1',
    [username]
  );

  res.json({
    username,
    exists: r.rowCount > 0,
    source: 'postgres',
    note: 'bloom filter said maybe',
  });
});

app.post('/users', async (req, res) => {
  const { username, state = 'CA' } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO users (username, state) VALUES ($1, $2)',
      [username, state]
    );

    // 演示：先设置 bit，再提交事务。
    // 生产环境要考虑事务回滚与布隆过滤器一致性问题。
    bloomSet(username);

    await client.query('COMMIT');

    res.status(201).json({
      username,
      state,
      bit: bitIndex(username),
      bloom: bloomDump(),
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get('/explain', async (req, res) => {
  const username = req.query.username || 'user_1';
  const state = req.query.state || 'CA';

  const sql = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM users
    WHERE username = $1 AND state = $2
  `;

  const r = await pool.query(sql, [username, state]);
  res.type('text/plain').send(r.rows.map((x) => x['QUERY PLAN']).join('\n'));
});

app.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
});
```

### 4.6 `queries.sql`

```sql
-- 1. 查看行数和表大小
SELECT count(*) FROM users;
SELECT pg_size_pretty(pg_total_relation_size('users')) AS total_size;

-- 2. 观察执行计划
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users
WHERE username = 'user_1' AND state = 'CA';

-- 3. 更新统计信息
ANALYZE users;

-- 4. 并发创建索引
-- 注意：CREATE INDEX CONCURRENTLY 不能在事务块里执行。
DROP INDEX IF EXISTS users_state_idx;
CREATE INDEX CONCURRENTLY users_state_idx ON users (state);

-- 5. 查看表结构和索引
\d users
\di
```

### 4.7 `partition.sql`

```sql
DROP TABLE IF EXISTS users_partitioned CASCADE;

CREATE TABLE users_partitioned (
  id BIGSERIAL,
  username TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, state)
) PARTITION BY LIST (state);

CREATE TABLE users_ca PARTITION OF users_partitioned FOR VALUES IN ('CA');
CREATE TABLE users_tx PARTITION OF users_partitioned FOR VALUES IN ('TX');
CREATE TABLE users_other PARTITION OF users_partitioned DEFAULT;

INSERT INTO users_partitioned (username, state)
SELECT
  'p_user_' || g,
  CASE WHEN g % 1000 = 0 THEN 'TX' ELSE 'CA' END
FROM generate_series(1, 100000) AS g;

ANALYZE users_partitioned;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users_partitioned WHERE state = 'CA';
```

---

## 5. 逐行解释

### 5.1 `docker-compose.yml`：为什么用容器

`postgres:16.3` 固定版本，避免“我本地能跑、你本地不能跑”。`POSTGRES_USER=lab`、`POSTGRES_PASSWORD=lab`、`POSTGRES_DB=lab` 是实验账号，生产不要明文。`healthcheck` 用 `pg_isready` 判断数据库是否可连接。`init.sql` 挂到 `/docker-entrypoint-initdb.d/`，只在数据卷首次初始化时执行；所以重置要用 `docker compose down -v`。

### 5.2 `init.sql`：造数据与统计信息

`BIGSERIAL` 是自增主键。`generate_series(1, 1000000)` 生成 100 万行。`CASE WHEN g % 1000 = 0 THEN 'TX' ELSE 'CA' END` 让 `CA` 占绝大多数、`TX` 很少，模拟“某个值很稀疏”的分布。`CREATE INDEX` 建两个单列索引。`ANALYZE users` 更新统计信息，让优化器知道列分布。

> 在 JS/Node 里对应什么？Node 里没有“统计信息”这个概念；统计信息是数据库层的。你能做的是：大批量写入后显式执行 `ANALYZE`，不要假设数据库立刻知道新数据分布。

### 5.3 `server.js` 的布隆过滤器

`bloom` 是一个 `BigInt`，用二进制位表示 64 个槽位。`hash64` 用 FNV-1a 64 位哈希，把用户名变成大整数。`bitIndex` 对 `BLOOM_BITS` 取模，得到 `0..63` 的 bit 下标。`bloomSet` 把对应位置 1。`bloomMaybe` 检查对应位是否为 1。

关键语义：

- `bloomMaybe(username) === false`：**100% 不存在**，可以直接返回，不查数据库。
- `bloomMaybe(username) === true`：**可能存在**，必须查数据库确认。

这就是讲师说的“没设置就绝对不存在；设置了只是可能存在”。假阳性来自哈希碰撞：别的用户名可能也落到同一个 bit。

> 在 JS/Node 里对应什么？这个布隆过滤器是**进程内存**。你开两个 Node 实例，它们各自一份位图，不共享。生产要多实例共享，需要 Redis 或专门的布隆过滤器服务；课里没讲具体实现。

### 5.4 `/users` 里的事务

`pool.connect()` 拿一个连接，`BEGIN` 开事务，`INSERT` 插入，`bloomSet` 设置位，`COMMIT` 提交，`ROLLBACK` 回滚，`client.release()` 归还连接。这里演示了“数据库事务”和“内存布隆过滤器”一起用。

> 注意：如果 `INSERT` 成功但 `COMMIT` 失败，或者事务回滚，布隆过滤器可能多一个假阳性。生产要更严谨地处理一致性。课里没讲这个细节。

> 在 JS/Node 里对应什么？`async/await` 只是异步写法，不等于数据库并发。数据库并发由连接池、事务隔离级别、锁决定。Java 的 `synchronized` 只是 JVM 内互斥，知道即可；它不能替代数据库的并发控制。

### 5.5 `/explain` 与执行计划

`EXPLAIN (ANALYZE, BUFFERS)` 会真正执行查询并返回计划。你会看到 `Seq Scan`、`Index Scan`、`Bitmap Index Scan` 等节点。优化器会根据统计信息、选择度、成本决定用哪个索引，或者不用索引。**具体字段名以你本地输出为准**，不要死记。

### 5.6 `CREATE INDEX CONCURRENTLY` 为什么特殊

普通 `CREATE INDEX` 会拿锁，阻塞写入。`CONCURRENTLY` 会做多次扫描、等待写事务结束，尽量不阻塞读写。代价是更慢、更耗资源，而且可能失败。失败后可能留下无效索引，需要 `DROP INDEX` 后重建。

> 课里没讲：`CREATE INDEX CONCURRENTLY` 不能在事务块里执行；唯一索引并发创建时，如果期间出现重复值，可能失败。生产要用迁移工具管理。

### 5.7 十亿行表的四层缩小

讲师给的顺序可以理解成：

1. **避免大表**：能不能把关注关系放进 profile 的 JSON/数组字段，或者用计数器、消息队列异步更新？
2. **索引**：能不能只扫一小部分，而不是全表？
3. **分区**：能不能按范围/列表把表切成多个物理部分，查询时只命中一个分区？
4. **分片**：能不能把不同用户放到不同数据库主机？代价是跨分片事务、客户端路由、再平衡。
5. **并行处理**：如果都不行，再考虑 MapReduce/多机并行。但事务型系统一边改一边扫，结果会过期。

`partition.sql` 只是第 3 层的 PostgreSQL 声明式分区演示。课里没讲具体分区 SQL，这是补充实验。

---

## 6. 复现检查清单

- [ ] `docker compose ps` 中 `db-index-lab` 是 `healthy`
- [ ] `docker exec -it db-index-lab psql -U lab -d lab -c "SELECT count(*) FROM users;"` 返回 `1000000`
- [ ] `\di` 能看到 `users_username_idx`、`users_state_idx`
- [ ] `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE username = 'user_1' AND state = 'CA';` 能输出计划；节点名以实际为准
- [ ] 执行 `ANALYZE users;` 后再次 `EXPLAIN`，观察计划是否变化
- [ ] 普通 `CREATE INDEX` 期间，另一个终端 `INSERT` 会等待（表越大越明显）
- [ ] `CREATE INDEX CONCURRENTLY` 期间，另一个终端 `INSERT` 不被长时间阻塞
- [ ] `curl http://localhost:3000/health` 返回 `bloomBits: 64`
- [ ] `POST /users` 创建 `jack` 后，`GET /check/jack` 返回 `source: "postgres"`
- [ ] `GET /check/not_exist_user` 返回 `source: "bloom-filter"` 且 `exists: false`
- [ ] `partition.sql` 执行后，`EXPLAIN` 查询 `state = 'CA'` 只命中 `users_ca` 分区（以实际输出为准）
- [ ] 你知道“布隆过滤器只能保证不存在，不能保证存在”
- [ ] 你知道“多 Node 实例的布隆过滤器不共享”

---

## 7. 课里没讲但你会撞上的

1. **`CREATE INDEX CONCURRENTLY` 不能在事务块里执行。** 很多迁移工具默认包事务，会直接报错。需要单独执行。
2. **并发建索引失败会留下无效索引。** 生产要检查索引有效性，具体系统表字段以 PostgreSQL 官方文档为准；不要凭印象写字段名。
3. **统计信息不是实时的。** 大批量插入后，`autovacuum` 异步更新；你刚插完就查，优化器可能还按旧统计做计划。显式 `ANALYZE` 是常见做法。
4. **`VACUUM FULL` 会锁表。** 逐字稿提到 `vacuum full` 清理垃圾，但生产大表要非常谨慎，它可能长时间阻塞。
5. **优化器选择不是稳定契约。** 同一个 SQL 在不同数据分布、不同版本、不同参数下可能选不同计划。不要硬编码“一定走某个索引”。
6. **PostgreSQL 没有 MySQL 那种 `USE INDEX` 风格提示。** 逐字稿提到“数据库 hinting”，但具体语法课里没讲；生产优先修统计信息、SQL 和索引设计。
7.