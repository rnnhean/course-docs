# 课程文档：博客系统的数据模型与可运行 API 复现（p001 51:35–104:01）

> 说明：本节逐字稿覆盖的是 p001 的 51:35–104:01，内容是系统设计讨论，不是逐行敲代码课。课里重点讨论了博客需求、数据库类型、表结构、软删除、大字段、标签规范化、时间字段和 API/数据库分层。为了让读者能“照着跑起来”，本文把课里明确讨论的数据模型落成一个最小可运行项目：PostgreSQL + Node.js/Express + Docker Compose。  
> 课里没讲的工程脚手架（Docker、Express、pg、端口、启动命令、测试数据）会在文中明确标注为“复现补充”，不冒充讲师原话。  
> 另外，题目给出的截图清单只有 5 个可选帧；为满足“≥6 处插图”且不编造清单外帧号，本文在索引小节复用 p001 87:21 一帧，其余均使用清单内唯一帧。

---

## 1. 这一节做什么

这一节要做的不是“背数据库名词”，而是把一个博客系统从需求推到可执行的数据模型和 API。

课里给出的博客需求包括：

- 读者可以通过搜索栏找到文章。
- 博客按时间排序。
- 预期支持 100 万并发读者。
- 博客可用性 99.999%。
- 博客要“快”，但讲师强调“快”必须客观化，例如页面 500ms 内加载、API 服务端计算小于 5ms，而不是笼统说“fast”。

讲师把系统设计拆成六个必须考虑的面：

1. database：持久化层；
2. caching：缓存；
3. scaling：水平或垂直扩展；
4. delegation：把工作委托出去，讲师认为这是最被低估的性能手段；
5. concurrency：并发用户、线程、锁、临界区；
6. communication：HTTP、gRPC、WebSocket、TCP、UDP 等通信方式。

![p001 56:31 讲师总结数据库、缓存、扩展、委托、并发与通信六大组件](images/p001_3391s.jpg)

这节课真正落地到代码的部分，是数据库设计：

- `users`：用户表，字段有 `id`、`name`、`bio`。
- `blogs`：博客表，字段有 `id`、`title`、`user_id`、`published`、`body`、`excerpt`、`slug`、`is_deleted`，讨论中还提到 `updated` 用于审计/更新时间。
- `tags`：标签表，字段有 `id`、`name`。
- `blogs_tags`：博客和标签的映射表，存 `blog_id` 和 `tag_id`。

课里还讨论了几个关键设计决策：

- 删除用软删除：加 `is_deleted` 标记，而不是每次直接 `DELETE`。
- 博客正文 `body` 是否放在主表里，要考虑行大小、磁盘 IO、长文本类型、对象存储。
- 标签不要直接在博客表里存字符串，而是拆成 `tags` 和 `blogs_tags`，用整数 `tag_id` 做匹配。
- 时间字段可以用 `datetime`，也可以用 epoch 秒/毫秒整数；讲师认为整数范围查询更快，并建议后端统一 UTC。

本文复现的目标是：

- 用 Docker 启动 PostgreSQL。
- 自动执行建表和种子数据。
- 用 Node.js/Express 提供最小 API：
  - 健康检查；
  - 按时间倒序列出博客；
  - 按标题/摘要搜索；
  - 按 slug 读取博客详情和标签；
  - 创建博客，并在事务里写入标签映射；
  - 软删除博客。
- 让读者可以用 `curl` 直接验证。

不在本节代码里实现的内容：100 万并发、99.999% 高可用、缓存、消息队列、批量硬删除任务、全文搜索引擎、前端页面。课里没有给出这些的可运行实现，本文也不编造。

这里再把复现边界说明白：本文只把课里讨论到的“数据模型”落成最小可运行服务，并不宣称这个服务已经满足 100 万并发或 99.999% 可用性。对前端读者来说，可以把这里的 API 当成“后端最小闭环”：浏览器里用 `fetch` 调用的 `/api/blogs`、`/api/search`、`/api/blogs/:slug`，和本文用 `curl` 调用的接口是同一套 HTTP 语义；区别只是 `curl` 把请求和响应直接展示在终端里。你可以先用 `curl` 验证数据层是否正确，再接前端页面；这样出错时能更快判断是数据库、API 还是页面状态管理的问题。

---

## 2. 讲师原话（带「—— p001 [MM:SS]」）

下面只摘录与复现直接相关的原话，保留英文原句，避免曲解。

> "无论你选择哪种系统，都必须定义它的六个组成部分：数据库、缓存、扩展、委托、并发和通信。"
> —— p001 [53:52]

> "如果你的某个前端表现不佳，它就会成为你扩展时的瓶颈。"
> —— p001 [56:42]

> "is deleted 是一个字段，用来标记某条博客是否已被删除……这通常称为软删除。"
> —— p001 [71:19]

> "当你执行删除时，会发生磁盘读写，并且它基本上会删除整行数据……它可能还需要重新平衡 B+ 树。"
> —— p001 [74:08]

> "长文本……会保存一个指向它的引用……这会让你的数据行更精简。"
> —— p001 [88:01]

> "字符串匹配不如整数匹配快；显然，整数匹配快如闪电。"
> —— p001 [92:41]

> "存储 Unix 时间戳的秒值或毫秒值……比存储 datetime 对象快得多。"
> —— p001 [97:57]

![p001 66:48 讲师讨论对象存储、查询工具与数据库边界](images/p001_4008s.jpg)

这些原话在本文复现中的落点分别是：六大组件用来提醒读者不要把“能跑起来”误当成“系统设计完成”；`is_deleted` 落到 `blogs` 表和所有读接口的过滤条件；磁盘 IO 和 B+ 树重平衡用于解释为什么不要频繁硬删除；长文本讨论落到 `body TEXT` 的最小选择；字符串与整数匹配落到 `tags`、`blog_tags` 的规范化；epoch 整数落到 `published_at`、`updated_at` 的 `BIGINT` 字段。需要说明的是，本文代码只是复现课里讨论的数据模型，不等同于讲师给出的唯一生产实现。

---

## 3. 从零复现

### 3.1 目录结构

在空目录下创建：

```text
blog-system/
├── .dockerignore
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── sql/
│   ├── 001_schema.sql
│   └── 002_seed.sql
└── src/
    ├── db.js
    └── server.js
```

### 3.2 环境要求

- Docker 24+，Docker Compose V2（命令是 `docker compose`）。
- 如果不用 Docker 跑 API，本机需要 Node.js 20+。
- 默认端口：
  - PostgreSQL：`5432`
  - API：`3000`

### 3.3 启动命令

```bash
mkdir -p blog-system/src blog-system/sql
cd blog-system
# 把第 4 节的 8 个文件按路径保存好
cp .env.example .env
docker compose up -d --build
docker compose ps
```

第一次启动时，PostgreSQL 容器会执行 `sql/001_schema.sql` 和 `sql/002_seed.sql`。如果数据库卷已经存在，初始化脚本不会重复执行；要重置请用：

```bash
docker compose down -v
docker compose up -d --build
```

命令的完整解释如下：

- `mkdir -p blog-system/src blog-system/sql`：创建项目目录和子目录；`-p` 表示父目录不存在时一起创建，已存在时不报错。
- `cd blog-system`：进入项目目录，后续文件路径都相对于这个目录。
- `cp .env.example .env`：复制环境变量模板。这个 `.env` 主要用于本机直接跑 Node 时读取；`docker compose` 中的 `api` 服务在本文的 `docker-compose.yml` 里已经显式注入了 `DATABASE_URL`，所以即使 `.env` 不存在，容器内的 API 仍能按 compose 里的环境变量连接数据库。
- `docker compose up -d --build`：启动服务；`-d` 表示后台运行，`--build` 表示先根据 `Dockerfile` 重新构建 API 镜像。第一次运行会拉取 `postgres:16-alpine` 和 `node:20-alpine` 镜像，耗时取决于网络。
- `docker compose ps`：查看容器状态。`db` 应该显示 `healthy`，`api` 应该显示 `running` 或 `up`。
- `docker compose down -v`：停止并删除容器，同时删除命名卷 `pgdata`；注意 `-v` 会清空数据库数据，只在你想重新执行初始化 SQL 时使用。
- `docker compose up -d --build`：重置后重新启动并重新执行初始化脚本。

常见错误与排查（本段为复现补充）：

- 如果 `docker compose up` 报 “Cannot connect to the Docker daemon”，先确认 Docker Desktop 或 Docker 服务已经启动。
- 如果 `docker compose ps` 里 `db` 一直不是 healthy，先用 `docker compose logs db` 看 PostgreSQL 是否启动失败，常见原因是端口 `5432` 已被本机其他 PostgreSQL 占用。
- 如果 `db` 是 healthy 但 `api` 启动失败，先用 `docker compose logs api` 看是否缺少 `DATABASE_URL` 或 npm 安装失败。
- 如果你修改了 `sql/001_schema.sql` 或 `sql/002_seed.sql`，但数据库卷已经存在，初始化脚本不会重跑；这时需要 `docker compose down -v` 后重新启动。不要误以为修改 SQL 会立即生效。
- 如果本机直接跑 Node，`DATABASE_URL` 里的主机名要用 `localhost`；如果在 Docker Compose 的 `api` 容器里跑，主机名是 `db`。这是最容易把“本机跑”和“容器跑”混在一起的地方。

### 3.4 验证 API

健康检查：

```bash
curl http://localhost:3000/health
```

按时间倒序列出博客：

```bash
curl "http://localhost:3000/api/blogs?limit=10&offset=0"
```

搜索：

```bash
curl "http://localhost:3000/api/search?q=database"
```

按 slug 读取详情：

```bash
curl http://localhost:3000/api/blogs/why-databases-matter
```

创建博客：

```bash
curl -X POST http://localhost:3000/api/blogs \
  -H "Content-Type: application/json" \
  -d '{
    "authorId": 1,
    "title": "My First Reproduced Blog",
    "slug": "my-first-reproduced-blog",
    "excerpt": "A small post created through the API.",
    "body": "This body is stored in the blogs table in this minimal reproduction.",
    "tags": ["database", "system-design"]
  }'
```

软删除博客 1：

```bash
curl -X DELETE http://localhost:3000/api/blogs/1
```

再次列出时，软删除的博客不会出现在列表和搜索里。

这些 `curl` 命令的完整解释如下：

- `/health` 会执行 `SELECT 1`，返回 `{"ok":true}` 表示 API 能连上数据库。
- `/api/blogs?limit=10&offset=0` 里的 `limit` 和 `offset` 是查询参数；`limit` 控制每页条数，`offset` 控制跳过多少条。代码会把 `limit` 限制在 1 到 100，避免一次请求过大。
- `/api/search?q=database` 里的 `q` 是搜索关键词；代码只搜索 `title` 和 `excerpt`，不搜索 `body`。如果 `q` 为空，会返回 400。
- `/api/blogs/why-databases-matter` 用 slug 读取详情；如果博客不存在或已软删除，会返回 404。
- `POST /api/blogs` 必须带 `Content-Type: application/json`；请求体里 `title`、`authorId` 必须有，`tags` 必须是数组。创建成功后返回 201。
- `DELETE /api/blogs/1` 不是直接删行，而是把 `is_deleted` 改成 true。如果该博客不存在或已经软删除，会返回 404。

对前端读者来说，这些命令对应浏览器的 `fetch` 请求：GET 列表对应 `fetch('/api/blogs?...')`，POST 创建对应 `fetch('/api/blogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`。前端需要根据 HTTP 状态码区分成功、参数错误和冲突，例如 400 表示请求参数不完整，409 表示 slug 冲突，404 表示资源不存在。

### 3.5 如果你想本机跑 Node

先只启动数据库：

```bash
docker compose up -d db
npm install
DATABASE_URL=postgres://blog:blog@localhost:5432/blog PORT=3000 npm start
```

`docker-compose.yml` 里 API 容器会用自己的 `DATABASE_URL=postgres://blog:blog@db:5432/blog`，不依赖你本机的 `.env`。

本机跑 Node 时，常见问题有两个：一是 PostgreSQL 还没 healthy 就开始连，导致第一次请求失败；可以先 `docker compose ps` 确认 `db` 是 healthy，再启动 Node。二是本机 Node 和容器 API 同时占用 `3000` 端口，导致启动失败；如果要同时跑，需要给本机 Node 换一个 `PORT`，或先停掉容器里的 `api`。

![p001 77:05 讲师讨论博客 body 应该放在哪里](images/p001_4625s.jpg)

---

## 4. 完整代码

### 4.1 `package.json`

```json
{
  "name": "blog-system",
  "version": "1.0.0",
  "private": true,
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "express": "4.19.2",
    "pg": "8.12.0"
  }
}
```

### 4.2 `.env.example`

```bash
# 本机直接跑 node 时使用；docker compose 里的 api 服务会注入自己的 DATABASE_URL
DATABASE_URL=postgres://blog:blog@localhost:5432/blog
PORT=3000
```

### 4.3 `.dockerignore`

```text
node_modules
npm-debug.log
.env
.git
```

### 4.4 `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["node", "src/server.js"]
```

### 4.5 `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: blog
      POSTGRES_PASSWORD: blog
      POSTGRES_DB: blog
    ports:
      - "5432:5432"
    volumes:
      - ./sql:/docker-entrypoint-initdb.d:ro
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blog -d blog"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://blog:blog@db:5432/blog
      PORT: 3000
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

### 4.6 `sql/001_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT
);

CREATE TABLE IF NOT EXISTS blogs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT,
  published_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS blog_tags (
  blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_blogs_published_at
  ON blogs (published_at DESC, id DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_blogs_slug
  ON blogs (slug);

CREATE INDEX IF NOT EXISTS idx_blog_tags_tag_id
  ON blog_tags (tag_id, blog_id);
```

### 4.7 `sql/002_seed.sql`

```sql
INSERT INTO users (id, name, bio) VALUES
  (1, 'Arpit', 'Instructor account for the reproduced blog system.'),
  (2, 'Guest Writer', 'A second author used by the seed data.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO blogs (
  id,
  user_id,
  title,
  slug,
  excerpt,
  body,
  published_at,
  updated_at,
  is_deleted
) VALUES
  (
    1,
    1,
    'Why Databases Matter',
    'why-databases-matter',
    'A short seed article about database choices.',
    $$This is seed body for the first blog. In this minimal reproduction the body is stored in the blogs table as TEXT.$$,
    1720000000,
    1720000000,
    false
  ),
  (
    2,
    1,
    'Soft Delete vs Hard Delete',
    'soft-delete-vs-hard-delete',
    'A seed article about is_deleted and recoverability.',
    $$This is seed body for the second blog. The API filters is_deleted = false when reading.$$,
    1720003600,
    1720003600,
    false
  ),
  (
    3,
    2,
    'Blog Platform Requirements',
    'blog-platform-requirements',
    'A seed article about objective requirements.',
    $$This is seed body for the third blog. Search in this reproduction uses title and excerpt.$$,
    1720007200,
    1720007200,
    false
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (id, name) VALUES
  (1, 'database'),
  (2, 'system-design'),
  (3, 'sql')
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_tags (blog_id, tag_id) VALUES
  (1, 1),
  (1, 2),
  (2, 1),
  (2, 3),
  (3, 2)
ON CONFLICT DO NOTHING;
```

### 4.8 `src/db.js`

```javascript
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
  process.exit(1);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
```

### 4.9 `src/server.js`

```javascript
const express = require('express');
const { pool, query } = require('./db');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

app.get('/health', async (req, res, next) => {
  try {
    const result = await query('SELECT 1 AS ok');
    res.json({ ok: result.rows[0].ok === 1 });
  } catch (err) {
    next(err);
  }
});

app.get('/api/blogs', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const result = await query(
      `
        SELECT
          b.id,
          b.title,
          b.slug,
          b.excerpt,
          b.published_at,
          b.updated_at,
          u.id AS author_id,
          u.name AS author_name
        FROM blogs b
        JOIN users u ON u.id = b.user_id
        WHERE b.is_deleted = false
        ORDER BY b.published_at DESC, b.id DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json({ items: result.rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

app.get('/api/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'q is required' });
    }

    const like = `%${q}%`;
    const result = await query(
      `
        SELECT
          b.id,
          b.title,
          b.slug,
          b.excerpt,
          b.published_at,
          u.name AS author_name
        FROM blogs b
        JOIN users u ON u.id = b.user_id
        WHERE b.is_deleted = false
          AND (b.title ILIKE $1 OR b.excerpt ILIKE $1)
        ORDER BY b.published_at DESC, b.id DESC
        LIMIT 50
      `,
      [like]
    );

    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/blogs/:slug', async (req, res, next) => {
  try {
    const result = await query(
      `
        SELECT
          b.id,
          b.title,
          b.slug,
          b.excerpt,
          b.body,
          b.published_at,
          b.updated_at,
          u.id AS author_id,
          u.name AS author_name,
          COALESCE(
            json_agg(
              json_build_object('id', t.id, 'name', t.name)
              ORDER BY t.name
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) AS tags
        FROM blogs b
        JOIN users u ON u.id = b.user_id
        LEFT JOIN blog_tags bt ON bt.blog_id = b.id
        LEFT JOIN tags t ON t.id = bt.tag_id
        WHERE b.slug = $1
          AND b.is_deleted = false
        GROUP BY b.id, u.id
      `,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'blog not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/blogs', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      title,
      slug,
      excerpt = '',
      body = '',
      authorId,
      tags = []
    } = req.body || {};

    if (!title || !authorId || !Array.isArray(tags)) {
      return res.status(400).json({
        error: 'title, authorId and tags[] are required'
      });
    }

    const finalSlug = slug ? slugify(slug) : slugify(title);
    if (!finalSlug) {
      return res.status(400).json({ error: 'slug is empty after slugify' });
    }

    const ts = nowEpochSeconds();

    await client.query('BEGIN');

    const blogResult = await client.query(
      `
        INSERT INTO blogs (
          user_id,
          title,
          slug,
          excerpt,
          body,
          published_at,
          updated_at,
          is_deleted
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, false)
        RETURNING id, title, slug, excerpt, published_at, updated_at
      `,
      [authorId, title, finalSlug, excerpt, body, ts]
    );

    const blog = blogResult.rows[0];

    for (const rawTag of tags) {
      const name = String(rawTag || '').trim().toLowerCase();
      if (!name) {
        continue;
      }

      const tagResult = await client.query(
        `
          INSERT INTO tags (name)
          VALUES ($1)
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id, name
        `,
        [name]
      );

      const tag = tagResult.rows[0];

      await client.query(
        `
          INSERT INTO blog_tags (blog_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [blog.id, tag.id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(blog);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed', rollbackErr);
    }

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'slug or tag conflict',
        detail: err.detail
      });
    }

    next(err);
  } finally {
    client.release();
  }
});

app.delete('/api/blogs/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be integer' });
    }

    const result = await query(
      `
        UPDATE blogs
        SET is_deleted = true,
            updated_at = $2
        WHERE id = $1
          AND is_deleted = false
        RETURNING id, is_deleted, updated_at
      `,
      [id, nowEpochSeconds()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'blog not found or already deleted' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`blog api listening on ${PORT}`);
});
```

---

## 5. 逐行解释

### 5.1 表结构为什么这样拆

`users` 表对应课里说的用户实体：`id`、`name`、`bio`。即使当前是单用户，讲师也明确说“keeping the future extensibility in mind”，所以用户单独成表。

`blogs` 表里，`user_id` 是作者外键；`published_at` 和 `updated_at` 用 `BIGINT` 存 epoch 秒，对应课里关于“整数范围查询更快”的讨论；`is_deleted` 对应软删除。课里还提到 `updated` 字段用于审计和更新时间，本文落成 `updated_at`。

`tags` 和 `blog_tags` 是规范化设计：标签名只存一份，博客和标签的关系存映射表。这样标签可以复用、改标签名不影响博客行、整数比较比字符串匹配快。代价是查询标签时要 join，课里也明确说“joins could be expensive”。

![p001 87:21 讲师解释大字段、行大小与索引边界](images/p001_5241s.jpg)

再往深一层看，`blogs` 和 `tags` 拆开之后，读列表时只查 `blogs` 和 `users`，不把标签 join 进来；读详情时才 join `blog_tags` 和 `tags`。这是为了不让列表页承担不必要的 join 成本。对前端来说，列表页通常只需要标题、摘要、作者、发布时间；详情页才需要正文和标签。如果前端列表页误把详情接口的返回结构照搬过去，就会把标签和正文也拉下来，页面更慢，后端压力也更大。本文把列表和详情分开，就是为了让前端按页面需要选择接口。

常见排查：如果详情接口返回的 `tags` 不是数组，先检查 `COALESCE(..., '[]'::json)` 是否被误删；如果列表接口慢了，先确认列表 SQL 是否误加了 `blog_tags` join。标签规范化本身不是错，错在把所有页面都按最重的查询来写。

### 5.2 软删除怎么落地

`DELETE /api/blogs/:id` 没有执行 `DELETE FROM blogs`，而是：

```sql
UPDATE blogs
SET is_deleted = true,
    updated_at = $2
WHERE id = $1
  AND is_deleted = false
```

所有读接口都带 `WHERE b.is_deleted = false`。这就是课里说的“应用侧跳过 is_deleted = true 的行”。

课里还提到硬删除会造成磁盘 IO、B+ 树重平衡、数据不可恢复；软删除可以恢复，也可以夜间批量硬删除。本文只实现软删除，没有实现夜间批量硬删除任务，课里也没有给出该任务的代码。

软删除的常见错误是“只改了删除接口，忘了改读接口”。如果你发现删除后详情还能被查到，先检查该查询有没有 `is_deleted = false`。另一个常见错误是重复删除：第二次调用 `DELETE /api/blogs/1` 时，`WHERE is_deleted = false` 不再匹配，因此返回 404；这不是 bug，而是当前最小实现用 404 表达“没有可删除的未删除行”。对前端来说，删除成功后应该从当前列表状态里移除该条，或者重新拉取列表；不要仅凭本地状态假装删除，因为刷新页面后仍要以 API 返回为准。

### 5.3 列表为什么按 `published_at DESC, id DESC`

需求说博客按时间排序。代码用：

```sql
ORDER BY b.published_at DESC, b.id DESC
```

`id DESC` 是同一秒发布时的稳定排序。索引 `idx_blogs_published_at` 也按 `published_at DESC, id DESC` 建，并且只索引 `is_deleted = false` 的行。

注意：课里没有讲游标分页；本文用 `limit/offset` 是最小实现。大规模下 offset 会变慢，这属于“课里没讲但你会撞上”的问题。

对前端来说，`limit/offset` 分页和“页码分页”很接近：第 1 页 `offset=0`，第 2 页 `offset=limit`。但如果列表在翻页过程中有新博客插入，单纯用 offset 可能出现重复或漏条；这不是本文代码要解决的完整分页问题，只是提醒你在真实页面上要考虑稳定排序和游标分页。排查时可以先看返回顺序是否严格按 `published_at` 倒序；如果同一秒内顺序不稳定，确认 `id DESC` 是否保留。

### 5.4 搜索为什么用 `ILIKE`

课里只说“search bar enables reader to find an article”，没有指定全文搜索引擎。本文为了可运行，用 PostgreSQL 的 `title ILIKE` 和 `excerpt ILIKE` 做最小搜索，只搜标题和摘要，不搜正文。课里没有说必须用 Elasticsearch，也没有给出全文搜索实现。

`ILIKE` 是大小写不敏感的匹配；`%database%` 表示关键词出现在任意位置。常见错误是请求里没有 `q`，此时 API 返回 400；如果搜索不到刚创建的文章，先确认新文章的标题或摘要是否包含关键词，因为本文不搜正文。对前端来说，搜索框应该做空值校验，并在用户输入时决定是即时搜索还是点按钮搜索；不要假设后端会搜索正文。

### 5.5 创建博客为什么用事务

`POST /api/blogs` 里先 `BEGIN`，插入博客，再循环插入标签和映射，最后 `COMMIT`。任何一步失败就 `ROLLBACK`。

对前端转 Node 的读者：在 JS/Node 里，事务不是“一个 async 函数自动包住”，而是同一个数据库连接上的 `BEGIN/COMMIT`。所以代码里用 `const client = await pool.connect()`，后续都走这个 `client`，不能用 `pool.query` 分散到不同连接。否则 `BEGIN` 和 `INSERT` 可能不在同一个连接上。可以把它理解成“数据库连接级别的临界区”，比 JS 的单线程事件循环更底层。

这段代码的常见错误有三个。第一，事务里混用 `pool.query`：`BEGIN` 在一个连接上，后续插入可能跑到另一个连接，导致事务不生效或报错。第二，忘记 `client.release()`：连接池会被慢慢耗尽，表现为 API 越来越慢甚至卡住；本文放在 `finally` 里释放。第三，未处理外键错误：如果 `authorId` 在 `users` 里不存在，PostgreSQL 会返回外键约束错误，当前最小实现没有专门把它转成 400，最终会落到 500；调用方应先确认作者存在。至于重复 slug，代码捕获 `23505` 并返回 409，前端应该提示“slug 已被占用”，而不是让用户重复提交。

### 5.6 `body` 为什么先放主表

课里讨论了 `body` 是否应该放主表：如果 body 很大，行存储会变胖，顺序扫描和索引回表都会读更多磁盘块；长文本类型可能存引用，让行更瘦；更大的对象（如图片）应该放对象存储，数据库只存 URL。课里也计算过 5000 词、UTF-8 每字符 4 字节，大约 100KB，认为常规博客不一定是大问题。

本文为了最小可运行，把 `body` 放在 `blogs` 表，用 PostgreSQL 的 `TEXT`。这是复现选择，不是讲师给出的唯一结论。课里讲的是 MySQL/通用 SQL 的 `longtext` 思路；PostgreSQL 的 `TEXT` 内部存储细节课里没讲，实际行为请以 PostgreSQL 文档和你的实测为准。

另外，`express.json({ limit: '2mb' })` 给请求体设了大小上限，避免无限制大 JSON 打进来。前端如果要上传图片或超大正文，不应该把这些内容塞进这个 JSON；按课里的思路，大对象放对象存储，数据库只保存 URL 或引用。排查时如果 POST 大正文失败，先看请求体是否超过限制，再看错误处理有没有正确区分 413 和 500。本文的最小错误处理比较粗，真实系统应该按错误类型返回更准确的状态码。

### 5.7 时间为什么存 epoch

课里建议后端统一 UTC，前端负责时区展示；时间字段可以用 epoch 秒/毫秒整数，范围查询更快。本文所有时间写 `BIGINT` epoch 秒，API 返回也是整数。前端拿到后可以自己 `new Date(epoch * 1000)` 转本地时区。

![p001 97:38 讲师比较 datetime 与 epoch 整数范围查询](images/p001_5858s.jpg)

对前端来说，API 返回的 `published_at`、`updated_at` 不是可直接展示的字符串，而是秒级整数。展示时应乘以 1000 再交给 `Date`，例如 `new Date(row.published_at * 1000).toLocaleString()`。常见错误是把 epoch 秒当毫秒用，结果显示成 1970 年附近；如果后端某天改用毫秒，前端也要同步调整。本文统一用秒，是为了和 `nowEpochSeconds()` 保持一致。

### 5.8 索引为什么这样建

- `idx_blogs_published_at`：服务“按时间倒序列出未删除博客”。
- `idx_blogs_slug`：服务“按 slug 读详情”。
- `idx_blog_tags_tag_id`：服务“按标签找博客”的方向，虽然本文没有提供按标签查询的 API，但映射表查询会用到。

课里强调：索引能加速查找，但如果单行太大，读一行仍然要读很多数据。本文把索引和大字段分开讨论，不把索引当成万能药。

![p001 87:21 大字段导致读放大时索引也有边界的复用截图](images/p001_5241s.jpg)

排查索引问题时，不要只看“有没有索引”，还要看查询条件是否和索引列匹配。比如列表查询是 `WHERE is_deleted = false ORDER BY published_at DESC, id DESC`，本文用部分索引覆盖未删除行；如果你把查询改成先取所有行再在应用层过滤，索引就用不上。`idx_blogs_slug` 虽然是唯一约束 `slug` 已经会建索引，本文仍显式写了 `CREATE INDEX IF NOT EXISTS`，是为了让读者在文件里一眼看到 slug 查询的意图；在真实 PostgreSQL 中，重复建相同索引的语句可能不会创建第二个，但不要依赖这一点，设计时应避免无意义重复索引。

---

## 6. 复现检查清单

按顺序检查，每条都给出验证方法和预期结果：

- [ ] `docker compose up -d --build` 后，`docker compose ps` 里 `db` 是 healthy，`api` 是 running。  
  验证：运行 `docker compose ps`，看 `db` 的 `STATUS` 是否包含 `healthy`，`api` 的 `STATE` 是否为 `running`。失败时运行 `docker compose logs db` 和 `docker compose logs api`，先解决启动错误。

- [ ] `curl http://localhost:3000/health` 返回 `{"ok":true}`。  
  验证：直接观察响应 JSON；如果返回 500 或连接失败，说明 API 没启动或连不上数据库。先查 `docker compose logs api`，再确认 `DATABASE_URL` 是否指向 `db:5432`。

- [ ] `curl "http://localhost:3000/api/blogs"` 返回 `items` 数组，且按 `published_at` 倒序。  
  验证：观察 `items` 里每一项的 `published_at`，应从大到小排列；同一时间再看 `id` 是否从大到小。如果顺序不对，检查 SQL 的 `ORDER BY` 和索引是否被误改。

- [ ] `curl "http://localhost:3000/api/search?q=database"` 能搜到种子数据里的标题或摘要。  
  验证：返回的 `items` 不应为空，且标题或摘要包含 `database`。如果为空，先确认种子数据是否已初始化；如果数据库卷已存在，需要 `docker compose down -v` 后重启。

- [ ] `curl http://localhost:3000/api/blogs/why-databases-matter` 返回博客详情，且 `tags` 是数组。  
  验证：响应里应包含 `body`、`author_name` 和 `tags`；`tags` 的 JSON 类型应为数组，而不是字符串。如果 404，先确认该 slug 是否被软删除或种子数据未导入。

- [ ] `POST /api/blogs` 创建成功后，再查列表能看到新博客。  
  验证：POST 返回 201 和新建的 `id`；随后再请求列表，确认该 `id` 出现在返回结果里。如果列表看不到，检查创建时 `is_deleted` 是否为 false，以及列表查询是否过滤了未删除行。

- [ ] 创建时传重复 slug，应返回 409，而不是 500。  
  验证：用同一个 slug 连续 POST 两次；第二次预期 409，并带有 `error` 和 `detail`。如果返回 500，检查 `err.code === '23505'` 分支是否被误删。

- [ ] `DELETE /api/blogs/1` 后，列表和搜索都不再出现 id=1 的博客。  
  验证：先记录删除前的列表和搜索结果，删除后重新请求，确认 id=1 不再出现；详情接口请求该 slug 也应返回 404，因为详情查询带 `is_deleted = false`。

- [ ] 直接查数据库仍能看到 id=1 的行，`is_deleted` 为 true，证明是软删除。  
  验证：进入数据库容器执行查询，例如 `docker compose exec db psql -U blog -d blog -c "SELECT id, is_deleted FROM blogs WHERE id = 1;"`，预期 `is_deleted` 为 `t`。如果行不存在，说明误用了硬删除。

- [ ] `docker compose down -v` 后重新启动，种子数据会重新初始化。  
  验证：先 `docker compose down -v`，再 `docker compose up -d --build`；重新请求列表，种子博客应重新出现。注意 `-v` 会删除数据卷，不要在需要保留数据时执行。

如果某一步失败，先看：

```bash
docker compose logs db
docker compose logs api
```

常见问题：

- 端口 `5432` 或 `3000` 被占用。验证：`docker compose ps` 看容器是否反复重启，或换端口后重试。
- 修改了 `sql/` 但数据库卷已存在，初始化脚本不会重跑；需要 `down -v`。验证：看日志里是否出现 `already contains data` 一类提示。
- 本机跑 Node 时 `DATABASE_URL` 仍写成 `db` 主机名，应该用 `localhost`。验证：本机终端里用 `psql` 或 `nc` 能否连到 `localhost:5432`。

---

## 7. 课里没讲但你会撞上的

下表把课里没讲、但在本文复现和后续上线中容易遇到的问题归纳为“现象 / 原因 / 怎么办”。表格内容属于复现补充，不冒充讲师原话。

| 现象 | 原因 | 怎么办 |
|---|---|---|
| Docker、Express、pg 的版本或启动命令与本文不一致，项目起不来 | 课里没有讲这些工程细节；本文选 `postgres:16-alpine`、`express@4.19.2`、`pg@8.12.0` 是为了给出可运行复现，不代表讲师指定 | 按第 4 节文件保存；用 `docker compose logs api` 和 `docker compose logs db` 定位是镜像、依赖、端口还是环境变量问题；不要混用旧版 Compose 命令和 V2 命令 |
| PostgreSQL 的 `TEXT` 行为与课里提到的 MySQL `longtext` 不一致 | 课里讨论的是长文本存储引用、让行更瘦；PostgreSQL 的 `TEXT` 是否有 TOAST、什么时候行外存储，课里没讲 | 不要把 MySQL 行为直接套到 PostgreSQL；用本文最小模型先跑通，再以 PostgreSQL 文档和实测为准；大对象按课里思路放对象存储，数据库只存 URL 或引用 |
| 搜索能跑但数据量一大就慢 | 课里只说有搜索栏；本文用 `ILIKE` 搜标题和摘要，规模大了会慢 | 先确认当前只是最小复现；真实系统再评估全文索引、搜索引擎、搜索排序和分页；不要宣称 `ILIKE` 能扛住大规模搜索 |
| 翻页越到后面越慢，或者出现重复/漏条 | 本文用 `limit/offset`；课里没有讲游标分页；大偏移量会变慢，数据变化时分页也不稳定 | 小规模先用 offset；大规模再改游标分页或键集分页，并保持 `published_at DESC, id DESC` 这类稳定排序 |
| 100 万并发和 99.999% 可用性没有实现 | 课里把它们作为需求提出，但没有给出可运行的高可用架构 | 本文只复现数据模型和最小 API；缓存、读写分离、多副本、故障转移、压测和监控都需要另做，不要把本地跑通当成满足需求 |
| 软删除后数据一直留在表里，占用越来越大 | 课里提到可以夜间跑任务批量硬删除；本文没有实现定时任务，也没有硬删除接口 | 先接受软删除用于恢复；后续单独设计批量硬删除任务、保留窗口、审计和备份；不要在 API 请求里直接硬删 |
| 按标签查询或详情 join 变慢 | 课里说规范化会带来 join 成本，也提到没有合适索引时 join 可能很贵 | 本文建了 `blog_tags(tag_id, blog_id)` 索引，但没有压测；真实系统要结合查询方向补索引，并用 `EXPLAIN` 验证 |
| 并发创建同一 slug 时一个成功一个失败 | 本文靠数据库唯一约束返回 409；真实系统还要考虑重试、幂等键、前端提示，课里没讲这些 | 前端提示 slug 冲突并让用户修改；后端可加幂等键或重试策略；不要靠“先查再插”完全避免并发竞态 |
| 前端显示时间差了好几个小时或变成 1970 年 | 课里建议后端统一 UTC，前端负责展示；本文存 epoch 秒，没有实现前端时区转换代码 | 前端用 `new Date(epoch * 1000)` 再按本地时区展示；确认秒/毫秒单位一致；后端继续统一 UTC |
| 不知道 `body` 何时该拆出去 | 课里讨论了对象存储、长文本、行大小，但没有给出“超过多少 KB 必须拆”的硬阈值 | 本文把 body 放主表只是最小实现；如果存大图或超大正文，按课里思路把大对象放对象存储，数据库只存 URL 或引用，并用真实数据量实测 |