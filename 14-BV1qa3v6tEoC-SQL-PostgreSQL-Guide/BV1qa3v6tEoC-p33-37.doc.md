## 1. 这一节做什么

这一节围绕一个很具体的数据库改造任务展开：`social_network` 数据库里已经有一张 `posts` 表，初始结构包含 `id`、`url`、`latitude`、`longitude`；后续想把它改成只保留 `id`、`url`、`location`，其中 `location` 是 PostgreSQL 的 `point` 类型，用来同时保存经纬度坐标。课程先用这个例子区分 **schema migration（结构迁移）** 和 **data migration（数据迁移）**，再解释为什么不能把“加新列、复制数据、删旧列”塞进同一个事务里的同一个迁移，最后给出一个五步拆分方案，并在 P036—P037 实际创建初始 `posts` 表和一个很小的 Express 应用，让读者能通过网页查看、创建 posts。

![p033 00:08 讲师引入 posts 表与迁移场景](images/p033_0008s.jpg)

这里的关键区分是：**schema migration** 主要改数据库结构，例如建表、加列、改类型、删列；**data migration** 主要搬数据，例如把旧字段里的值计算后写入新字段，或者批量修正历史数据。课程例子中，“建 `posts` 表”“增加 `location` 列”“删除 `latitude`、`longitude` 列”属于结构迁移；“把经纬度拼成 `point` 并写进 `location`”“把旧行补全”属于数据迁移。两者可以协同，但不应该不加思考地把耗时很长的数据复制放进一个短事务里。

讲师还强调了事务中的快照问题：事务打开时，你看到的是某个时间点的数据视图；如果迁移事务运行期间，Web 应用还在新增或修改数据，这些并发写入不会自动进入当前事务已取到的快照。于是可能出现“旧数据已经复制完，但复制期间新增的行还只在旧列里有值，新列仍为 `NULL`”的状态。把改造拆成五步，就是为了让应用和数据库在一段时间内兼容新旧两套字段，降低不可控风险。

最终要能跑起来的东西有两块：

1. 一个可执行的 schema migration，创建 `posts` 表；
2. 一个运行在 `3005` 端口的 Express 应用，能读 `posts` 表、显示列表和表单，并能提交新 post 写入数据库。

P033—P035 的五步方案在本段视频里主要用于讲解，没有完整落成代码；P036—P037 实际写了初始迁移和 Web 应用。因此下面的“从零复现”会先复现课程实际写出的可运行部分，再把后五步按讲师给出的方案翻译成可执行 SQL，并明确标注哪些 SQL 是课程没有给出的补全。文中的“复现补全”只表示为了让示例可执行而补出的实现细节，不表示讲师在本段逐字稿里逐行写过这些内容。

---

## 2. 讲师原话

> “We could first add in an empty column called location that had type point. We could then somehow copy all these different latitude and longitude values over to this new column. And then once we have safely copied all those values over, we could then drop the original columns of latitude and longitude.”
>
> —— p033 [02:25]

> “Whenever we run a migration, it is very common to place a migration or execute it inside of a transaction… If anything goes wrong with dropping the column, we probably want to undo all the work that we had previously done during the migration.”
>
> —— p034 [03:21]

> “Whenever we open up a transaction, we can imagine that we’re kind of opening up a separate workspace… we are getting a copy of all the data inside of our post table at that instant in time.”
>
> —— p034 [04:48]

> “Break it up into a series of different operations. You’re going to do some initial change. You’ll make a change to your client… write to both the old column and the new column. You’ll manually copy over all the data… update your code again to only make use of the new column, and then finally drop the old column.”
>
> —— p035 [04:44]

> “For up, we’ll do a pgm.sql, then a multi-line string… put in here create table posts. We’ll give it an ID, a URL, and then a latitude, and a longitude.”
>
> —— p036 [02:47]

> “I’m going to first install two dependencies. One is going to be Express itself and the other will be a library that we can use to connect to Postgres directly from a node application… npm install, express and pg.”
>
> —— p037 [00:57]

> “We will do an app.post. We’re going to watch for a post request to slash post… we’re going to take a look at whatever data the user just submitted… create a new post and save a new post into the database.”
>
> —— p037 [11:57]

![p033 00:58 讲师解释 point 类型保存二维坐标](images/p033_0058s.jpg)

![p033 02:21 讲师把改造拆成加列、复制、删列三步](images/p033_0125s.jpg)

---

## 3. 从零复现

### 3.1 前置条件与目录

你需要本地已经安装并启动 PostgreSQL，并有一个名为 `social_network` 的数据库。课程里通过 PG Admin 查看表，因此 PG Admin 是可选工具；没有它也可以用 `psql`。Node 版本逐字稿没有给，按你机器上能运行 Express 的 Node 即可，不要凭空照抄一个“课程版本号”。

建议目录如下。迁移文件名里的时间戳由迁移工具自动生成，不要手写成固定日期：

```text
social-network/
├── migrations/
│   └── <timestamp>_add-post-table.js
├── index.js
├── package.json
└── package-lock.json
```

如果你是一路跟课程到这里的，项目里应该已经有 `npm run migrate` 脚本；如果你从空目录开始，需要自己补一个迁移 CLI 脚本。逐字稿本段只出现了 `npm run migrate create`、`npm run migrate` 和 `pgm.sql`，没有明说 CLI 包名。下面用 `node-pg-migrate` 作为复现补全，**这不是讲师在本段原话中点名的包**。

```bash
# 空目录才需要执行；已有课程项目可跳过
npm init -y
npm install express pg
npm install --save-dev node-pg-migrate
npm pkg set scripts.migrate="node-pg-migrate"
```

依赖版本：逐字稿只说 `npm install express pg`，没有给版本号；因此这里不编造版本号。执行安装后，以实际生成的 `package.json` 和 `package-lock.json` 为准，并把 lock 文件保留下来。

验证前置条件时，可以先确认 PostgreSQL 正在运行、数据库存在、当前用户能连上：

```bash
psql -l
```

如果列表里能看到 `social_network`，说明数据库大概率存在。再用下面的命令验证连接身份和当前数据库：

```bash
psql -d social_network -c "select current_database(), current_user;"
```

常见错误是数据库没建、PostgreSQL 没启动、用户名或密码不对。如果没有 `psql` 命令，说明 PostgreSQL 的 bin 目录可能不在 `PATH` 中，或者你只安装了 PG Admin 而没有安装完整的 PostgreSQL 客户端工具。

### 3.2 设置数据库连接环境变量

运行迁移前要设置 `DATABASE_URL`。逐字稿说“define one of these environment variables”，但没展开完整 URL 格式。下面是按课程用户名/密码规则写出的可用格式。

macOS / Linux，用户名是当前用户、密码为空时：

```bash
export DATABASE_URL="postgres://$(whoami)@localhost:5432/social_network"
```

Windows PowerShell，通常是 `postgres` 用户加安装时设置的密码：

```powershell
$env:DATABASE_URL="postgres://postgres:你的密码@localhost:5432/social_network"
```

Windows CMD：

```cmd
set DATABASE_URL=postgres://postgres:你的密码@localhost:5432/social_network
```

如果密码里有 `@`、`:`、`/` 等字符，需要先做 URL 编码；这个细节课里没讲，但实际连接会撞上。比如密码里的 `@` 在 URL 中有特殊含义，直接拼进去会让解析出现歧义。遇到这种密码，可以优先设置 `PGUSER`、`PGPASSWORD`、`PGDATABASE` 等环境变量，或者使用迁移工具支持的独立参数。

设置完后可以这样验证 `DATABASE_URL` 是否真的能连上：

```bash
psql "$DATABASE_URL" -c "select current_database(), current_user;"
```

PowerShell 中可以写：

```powershell
psql $env:DATABASE_URL -c "select current_database(), current_user;"
```

如果这一步失败，先不要运行迁移。迁移失败时很难判断是 SQL 写错，还是连接串本身就没通；先把连接问题定位清楚，后续排查会简单很多。

### 3.3 创建初始 posts 迁移

在项目根目录执行：

```bash
npm run migrate create add-post-table
```

课程口述的名字是 “add post table”，实际命令行建议用连字符，便于生成文件名。命令执行后会生成类似：

```text
migrations/<timestamp>_add-post-table.js
```

这个命令的作用是让迁移工具创建一个带时间戳的迁移文件骨架。时间戳用于排序，保证多个迁移按顺序执行；不要手动改成固定日期，否则多个人协作或以后新增迁移时可能发生顺序冲突。打开这个文件，把它改成下面“完整代码”里的迁移文件内容。课程里 `up` 用 `pgm.sql` + 反引号多行字符串创建表，`down` 做相反操作 `DROP TABLE`。

![p036 02:20 讲师在编辑器里实现迁移的 up/down](images/p036_0140s.jpg)

然后执行迁移。逐字稿口述是运行 `npm run migrate`；实际 CLI 通常需要指定方向。若你的 package script 已经把 `up` 封装进去，就按你的项目执行；否则用：

```bash
npm run migrate up
```

运行成功后，打开 PG Admin，右键 `social_network` 数据库刷新，依次展开 `Schemas` → `Tables`，应能看到 `posts` 表。这个刷新动作在 p036 [03:40] 附近被讲师演示。

![p036 03:35 讲师在终端设置环境变量并运行迁移](images/p036_0215s.jpg)

如果不用 PG Admin，可以用 `psql` 验证：

```bash
psql "$DATABASE_URL" -c "\d posts"
```

你应该能看到 `id`、`url`、`latitude`、`longitude` 四列。常见错误包括：迁移命令找不到、`DATABASE_URL` 未设置、数据库不存在、权限不足、表已存在。若表已存在，先确认是不是之前已经运行过迁移；不要在没搞清楚状态时反复执行 `CREATE TABLE posts`。

### 3.4 安装 Web 应用依赖

课程里执行：

```bash
npm install express pg
```

`express` 用来起 HTTP 服务，`pg` 用来从 Node 连接 PostgreSQL。逐字稿明确说：“npm install, express and pg”。

![p037 00:55 讲师安装 express 与 pg](images/p037_0030s.jpg)

安装后可以验证依赖是否在当前项目里：

```bash
npm ls express pg
```

如果出现 `Cannot find module 'express'` 或 `Cannot find module 'pg'`，通常是因为在错误目录运行了 `node index.js`，或者依赖没有装到当前项目的 `node_modules`。先确认终端当前目录就是包含 `package.json` 的项目根目录，再重新执行安装。

### 3.5 创建 index.js 并先验证数据库连接

在项目根目录创建 `index.js`，完整内容见下一节。课程先写 `PG.Pool` 连接本地 PostgreSQL，参数包括：

- host：`localhost`
- port：`5432`
- database：`social_network`
- user：与迁移命令一致的用户名
- password：与迁移命令一致的密码

讲师在 macOS 上用用户名 `SG`、空密码；Windows 上通常是用户名 `postgres` 加安装密码。为了让文件可复制运行，下面代码把用户名和密码接到 `PGUSER` / `PGPASSWORD` 环境变量，同时保留课程里的默认值；这是复现补全，不是讲师原话。

![p037 02:29 讲师展示 pg Pool 连接配置](images/p037_0149s.jpg)

先用 `node index.js` 启动一次，确认数据库能连上；然后访问：

```text
http://localhost:3005/posts
```

如果端口 `3005` 被别的进程占用，先停掉占用进程，或者临时改端口。课程录像里也出现了端口冲突后重新运行的情况。macOS / Linux 可以查端口：

```bash
lsof -i :3005
```

Windows 可以查：

```cmd
netstat -ano | findstr :3005
```

如果连接数据库时报 `password authentication failed`，先检查 `PGUSER`、`PGPASSWORD` 是否和迁移时一致；如果报 `relation "posts" does not exist`，说明服务连上了，但迁移没有成功运行，或者连到了另一个数据库。

### 3.6 实现列表和创建表单

`GET /posts` 执行 `SELECT * FROM posts`，把结果拼成 HTML 表格，并显示一个 `method="post"` 的表单。表单字段是：

- `lng`：经度
- `lat`：纬度

表单没有显式写 `action`，浏览器会提交到当前地址 `/posts`，因此后端对应写 `app.post('/posts', ...)`。逐字稿口述为 “slash post”，但为了和 GET 路由、表单当前地址一致，复现代码使用 `/posts`。

![p037 06:27 讲师在编辑器中拼 HTML 表格和表单](images/p037_0387s.jpg)

这里可以和前端表单行为对照一下：浏览器里 `<form method="post">` 表示提交时发 POST 请求；`<input name="lng">` 的 `name` 会成为请求体里的字段名；Express 端用 `req.body.lng` 读取。若把 `name="lng"` 写成 `name="longitude"`，后端却还读 `req.body.lng`，拿到的就是 `undefined`。若表单 `method` 写成 `get`，数据会出现在查询字符串里，而 `app.post('/posts')` 不会处理这个请求。

### 3.7 实现表单提交

`POST /posts` 从 `req.body` 取出 `lng`、`lat`，执行参数化插入：

```sql
INSERT INTO posts (latitude, longitude) VALUES ($1, $2)
```

参数数组按列顺序传 `[lat, lng]`。执行后 `res.redirect('/posts')` 回到列表页。

![p037 11:25 讲师写表单提交路由与参数化插入](images/p037_0685s.jpg)

重启 Node 服务，然后提交一个经度 `1`、纬度 `1`，页面应出现 `id=1, longitude=1, latitude=1` 的新行。再提交 `1.234` / `4.321` 也应成功。可以用 `psql` 直接验证数据库是否真的写入了：

```bash
psql "$DATABASE_URL" -c "select id, url, latitude, longitude from posts order by id;"
```

如果页面能打开、提交后也跳回了 `/posts`，但数据库没有新行，优先检查：`express.urlencoded()` 是否启用、表单字段名是否对得上、`INSERT` 的列名和参数顺序是否正确、当前连接的数据库是不是 `social_network`。

### 3.8 后续五步改造：先把方案固定下来

课程后续要做的五步是：

1. 用迁移给 `posts` 加 `location POINT`，此列初始必须允许 `NULL`；
2. 部署新版应用，新建或更新 post 时同时写 `latitude`、`longitude`、`location`；
3. 用脚本或 SQL 回填旧行：把 `latitude`、`longitude` 合成 `location`；
4. 再改应用，只写 `location`，不再依赖旧列；
5. 最后用迁移删除 `latitude`、`longitude`。

P035 的关键点是：每一步之间可以隔任意时间，不要把“复制几百万行”放进同一个 schema migration 事务里。P034 已经演示了风险：事务打开时拿到的是快照，事务运行期间 API 新增的行不会进入这个快照；事务提交后，新行的 `location` 可能仍是 `null`，甚至造成数据丢失或错误状态。

![p035 00:11 第一步先加允许 NULL 的 location 列](images/p035_0011s.jpg)

![p035 03:28 回填完成后再改应用、删旧列](images/p035_0208s.jpg)

下面是按这五步翻译出的可执行 SQL / 代码示例，均属于复现补全，课程没有在本段逐行给出完整实现。真正执行前要结合你的迁移工具、数据量、锁表和回滚策略。

第一步，加一个允许 `NULL` 的新列：

```sql
ALTER TABLE posts ADD COLUMN location POINT;
```

第二步，应用进入双写阶段：新建 post 时同时写旧列和新列。下面示例仍假设请求体里取出的参数是 `lat`、`lng`，SQL 中 `point($2, $1)` 表示先用经度作 x、纬度作 y；你需要和项目里实际采用的坐标顺序保持一致。

```js
await pool.query(
  'INSERT INTO posts (latitude, longitude, location) VALUES ($1, $2, point($2, $1))',
  [lat, lng]
);
```

第三步，回填旧行。只处理新列为空且旧列值完整的行：

```sql
UPDATE posts
SET location = point(longitude, latitude)
WHERE location IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;
```

第四步，应用改为只写新列。此时读取时可以从 `location` 中取坐标，或者短期内在页面层继续兼容旧字段；关键是新写入不再依赖旧列。

```js
await pool.query(
  'INSERT INTO posts (location) VALUES (point($1, $2))',
  [lng, lat]
);
```

第五步，确认没有代码再读写旧列、且数据回填完成后，删除旧列：

```sql
ALTER TABLE posts DROP COLUMN latitude, DROP COLUMN longitude;
```

这五步不能机械地一口气全跑在生产库上。第一步加列和第五步删列属于结构变更，第二到第四步涉及应用发布与数据回填。每一步都应该能单独验证：新列是否允许 `NULL`、双写是否覆盖所有写入口、回填是否还有遗漏、应用是否已经完全切到新列、旧列是否真的无人使用。若中途失败，能回退的边界也更容易控制。

---

## 4. 完整代码

### 4.1 初始迁移文件

文件路径：`migrations/<timestamp>_add-post-table.js`

> 说明：逐字稿只念了列名 `ID`、`URL`、`latitude`、`longitude`，没有念具体 SQL 类型。下面为了让迁移可直接执行，补全为 `SERIAL PRIMARY KEY`、`TEXT`、`DOUBLE PRECISION`。这些类型选择属于复现补全；如果你的课程项目已有既定类型，以课程项目为准。

```js
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      url TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE posts;
  `);
};
```

### 4.2 Express 应用

文件路径：`index.js`

> 说明：课程里连接参数使用本机 PostgreSQL；下面把用户名和密码接到 `PGUSER` / `PGPASSWORD` 环境变量，并保留课程中的默认用户名 `SG` 和空密码作为回退。错误处理中间件是复现补全，用于让排查更容易；课内最小示例可能更简略。

```js
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3005;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'social_network',
  user: process.env.PGUSER || 'SG',
  password: process.env.PGPASSWORD || '',
});

app.use(express.urlencoded({ extended: true }));

app.get('/posts', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, url, latitude, longitude FROM posts ORDER BY id'
    );

    const rows = result.rows
      .map((post) => {
        return `
          <tr>
            <td>${post.id}</td>
            <td>${post.url ?? ''}</td>
            <td>${post.longitude ?? ''}</td>
            <td>${post.latitude ?? ''}</td>
          </tr>
        `;
      })
      .join('');

    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Posts</title>
        </head>
        <body>
          <h1>Posts</h1>

          <table border="1" cellpadding="4" cellspacing="0">
            <thead>
              <tr>
                <th>id</th>
                <th>url</th>
                <th>longitude</th>
                <th>latitude</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <h2>Create a post</h2>
          <form method="post">
            <label>
              Longitude
              <input name="lng" />
            </label>
            <label>
              Latitude
              <input name="lat" />
            </label>
            <button type="submit">Create</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

app.post('/posts', async (req, res, next) => {
  try {
    const { lng, lat } = req.body;

    await pool.query(
      'INSERT INTO posts (latitude, longitude) VALUES ($1, $2)',
      [lat, lng]
    );

    res.redirect('/posts');
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}/posts`);
});
```

### 4.3 package.json 中的迁移脚本示例

若你使用 `node-pg-migrate` 作为复现工具，`package.json` 中至少应有类似脚本：

```json
{
  "scripts": {
    "migrate": "node-pg-migrate"
  }
}
```

启动应用与迁移时，终端里要保证环境变量可用。macOS / Linux 示例：

```bash
export DATABASE_URL="postgres://$(whoami)@localhost:5432/social_network"
export PGUSER="$(whoami)"
export PGPASSWORD=""
npm run migrate up
node index.js
```

Windows PowerShell 示例：

```powershell
$env:DATABASE_URL="postgres://postgres:你的密码@localhost:5432/social_network"
$env:PGUSER="postgres"
$env:PGPASSWORD="你的密码"
npm run migrate up
node index.js
```

### 4.4 后续五步改造的补全 SQL / 代码

以下内容均标注为复现补全，课程在本段没有给出完整迁移文件。它们用于把讲师方案落成可检查的步骤。

第一步，加可空 `location` 列：

```sql
ALTER TABLE posts ADD COLUMN location POINT;
```

第二步，双写旧列和新列：

```js
await pool.query(
  'INSERT INTO posts (latitude, longitude, location) VALUES ($1, $2, point($2, $1))',
  [lat, lng]
);
```

第三步，回填旧数据：

```sql
UPDATE posts
SET location = point(longitude, latitude)
WHERE location IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;
```

第四步，应用改为只写 `location`：

```js
await pool.query(
  'INSERT INTO posts (location) VALUES (point($1, $2))',
  [lng, lat]
);
```

第四步之后，读取列表时可以临时改成从 `location` 取坐标。PostgreSQL 的 `point` 可以按数组下标取分量，常见写法是 `location[0]` 表示 x、`location[1]` 表示 y；具体顺序要与你写入时保持一致：

```sql
SELECT
  id,
  url,
  location,
  location[0] AS longitude,
  location[1] AS latitude
FROM posts
ORDER BY id;
```

第五步，确认旧列完全无用后删除：

```sql
ALTER TABLE posts DROP COLUMN latitude, DROP COLUMN longitude;
```

---

## 5. 逐行解释

### 5.1 迁移文件逐行解释

```js
exports.up = (pgm) => {
```

`exports.up` 是迁移工具要求的“往上迁移”函数。执行 `npm run migrate up` 时，工具会找到尚未执行的迁移文件，并调用其中的 `up`。`pgm` 是迁移工具传入的对象，提供 `pgm.sql`、`pgm.createTable` 等 API。

```js
  pgm.sql(`
```

`pgm.sql` 表示直接执行一段原始 SQL。课程选择用原始 SQL 而不是迁移工具的高阶建表 API，是为了让 SQL 结构直观可见。反引号用于写多行字符串。

```sql
    CREATE TABLE posts (
```

创建 `posts` 表。执行前应确认数据库里没有同名表，或者当前迁移记录表明这张表尚未创建。如果手工在 PG Admin 里已经建过表，再跑迁移会报“relation already exists”。

```sql
      id SERIAL PRIMARY KEY,
```

`SERIAL` 会创建一个自增整数列；`PRIMARY KEY` 把它设为主键。复现补全使用 `SERIAL`，课程逐字稿只念了 `ID`，没有念具体类型。

```sql
      url TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION
```

`url` 保存帖子链接。`latitude`、`longitude` 保存纬度和经度。使用 `DOUBLE PRECISION` 是复现补全，用于保存带小数的坐标。最终改造时，这两列会被 `location POINT` 替代。

```js
  `);
};
```

结束 `pgm.sql` 调用和 `up` 函数。

```js
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE posts;
  `);
};
```

`down` 是回滚迁移时执行的函数。这里直接 `DROP TABLE posts`，会删除整张表及数据。它适合开发环境重置；在生产环境执行前必须确认数据备份和回滚策略。若表被其他表外键引用，`DROP TABLE` 可能失败，需要先处理依赖。

### 5.2 Express 应用逐行解释

```js
const express = require('express');
const { Pool } = require('pg');
```

引入 Express 和 `pg` 的 `Pool`。`Pool` 维护连接池，避免每个请求都重新建立数据库连接。它不是你手动创建的单个连接，而是按需分配和复用连接。

```js
const app = express();
const port = 3005;
```

创建 Express 应用实例，并指定监听端口 `3005`。若端口被占用，启动时会报 `EADDRINUSE`；这时不要误以为是数据库错误。

```js
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'social_network',
  user: process.env.PGUSER || 'SG',
  password: process.env.PGPASSWORD || '',
});
```

配置 PostgreSQL 连接。`host`、`port`、`database` 与课程一致；`user` 默认为 `SG`，但可以用 `PGUSER` 覆盖；`password` 默认为空，可用 `PGPASSWORD` 覆盖。Windows 上通常要把 `PGUSER` 设为 `postgres`，把 `PGPASSWORD` 设为安装密码。这里没有使用 `DATABASE_URL`，是因为课程用字段式配置演示；迁移工具则通常使用 `DATABASE_URL`。

```js
app.use(express.urlencoded({ extended: true }));
```

启用 `application/x-www-form-urlencoded` 请求体解析。浏览器提交普通 HTML 表单时，默认就是这种内容类型。没有这行，`req.body` 可能是 `undefined` 或空对象，`const { lng, lat } = req.body;` 就会拿不到值。

```js
app.get('/posts', async (req, res, next) => {
```

定义 GET `/posts` 路由。浏览器直接访问 `/posts` 时走这里。`async` 表示函数内部会 `await` 数据库查询；`next` 用于把错误交给错误处理中间件。

```js
    const result = await pool.query(
      'SELECT id, url, latitude, longitude FROM posts ORDER BY id'
    );
```

查询 `posts` 表，明确列出需要的列，并按 `id` 排序。课程里可能用 `SELECT *`，这里显式列名便于控制展示顺序。`await` 表示等待查询完成；如果表不存在，这里会抛错并进入 `catch`。

```js
    const rows = result.rows
      .map((post) => {
```

`result.rows` 是查询结果数组。`map` 把每一行转换成一段 HTML 表格行字符串。

```js
        return `
          <tr>
            <td>${post.id}</td>
            <td>${post.url ?? ''}</td>
            <td>${post.longitude ?? ''}</td>
            <td>${post.latitude ?? ''}</td>
          </tr>
        `;
```

拼接表格行。`?? ''` 表示当值为 `null` 或 `undefined` 时显示空字符串，避免页面出现 `null`。这里把 `longitude` 放在 `latitude` 前面，是为了和表头顺序一致；你在前端页面上核对时，要看清列标题，不要只看数字。

```js
      })
      .join('');
```

把多行 HTML 用空字符串连接成一个字符串，供后面插入 `<tbody>`。

```js
    res.send(`
      <!doctype html>
      ...
    `);
```

返回完整 HTML 页面。页面里包含一个表格和一个表单。表格的 `<thead>` 决定页面列标题；表单的 `method="post"` 决定提交请求方法；两个输入框的 `name="lng"`、`name="lat"` 决定后端 `req.body` 里的字段名。这里没有写 `action`，所以浏览器会提交到当前页面地址 `/posts`，正好对应下面的 `app.post('/posts', ...)`。

```js
app.post('/posts', async (req, res, next) => {
```

定义 POST `/posts` 路由。表单提交后进入这里。若你写成 `/post`，而表单提交到 `/posts`，就会得到 404。

```js
    const { lng, lat } = req.body;
```

从请求体解构出经度 `lng` 和纬度 `lat`。字段名必须和 HTML 输入框的 `name` 一致。如果表单里没有 `name`，浏览器不会提交这个字段；如果写成 `longitude`，这里就取不到 `lng`。

```js
    await pool.query(
      'INSERT INTO posts (latitude, longitude) VALUES ($1, $2)',
      [lat, lng]
    );
```

执行参数化插入。`$1` 对应参数数组第一个元素 `lat`，写入 `latitude` 列；`$2` 对应第二个元素 `lng`，写入 `longitude` 列。参数化查询把 SQL 文本和数据分开传，避免把用户输入直接拼进 SQL 字符串。注意：这里参数顺序是 `[lat, lng]`，而列顺序是 `latitude, longitude`，两者要对齐；如果写反，坐标会互换。

```js
    res.redirect('/posts');
```

插入成功后返回重定向响应。浏览器收到重定向后会再发一个 GET `/posts` 请求，所以页面会回到列表并显示刚插入的数据。若提交后没有看到新行，先检查插入是否真的成功，而不是只检查重定向。

```js
  } catch (err) {
    next(err);
  }
});
```

捕获异步错误并交给错误处理中间件。没有错误处理时，数据库报错可能表现为请求挂起、页面空白或服务端日志中的堆栈信息。错误处理不是课程逐字稿的重点，但实际复现时很有用。

```js
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});
```

错误处理中间件。把错误打印到终端，方便定位数据库连接、SQL 语法、字段不存在等问题；对浏览器返回 500。生产环境不应把内部细节直接返回给用户。

```js
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}/posts`);
});
```

启动 HTTP 服务并监听 `3005`。终端出现这行日志后，再访问 `http://localhost:3005/posts`。如果终端没有这行日志，说明服务没启动成功，先看是否有依赖缺失、端口占用或语法错误。

### 5.3 与前端的对照

- HTML 表单的 `method="post"` 对应后端的 `app.post`；表单的提交地址默认是当前页面 `/posts`，对应后端路由路径 `/posts`。
- 输入框的 `name` 是请求体字段名。`name="lng"` 对应 `req.body.lng`，`name="lat"` 对应 `req.body.lat`；名称不一致时，后端拿到 `undefined`。
- `express.urlencoded({ extended: true })` 负责把浏览器表单体解析成 `req.body`。没有它，后端不能按普通表单方式读取字段。
- `res.redirect('/posts')` 会让浏览器重新请求列表页，所以用户看到的是提交后的页面，而不是一段插入结果文本。
- 前端输入的数字看起来是“数字”，但通过表单提交到后端时通常是字符串。PostgreSQL 会根据目标列类型进行转换；如果转换成不了，会抛类型错误。
- 前端输入不能直接拼进 SQL。即使字段看起来是经纬度，也应该使用参数化查询，保持和课程示例一致的安全习惯。

### 5.4 代码层面的常见排查

如果 `node index.js` 启动时报 `Cannot find module`，先在项目根目录运行 `npm ls express pg`，确认依赖存在。如果访问页面报 `relation "posts" does not exist`，说明数据库连接成功但表没建好，回到迁移步骤。如果提交表单后 `req.body` 为空，检查 `express.urlencoded` 和输入框 `name`。如果插入后列值互换，检查 `INSERT` 的列顺序和参数数组顺序。如果页面显示 `null`，说明查询到了空值，可以在模板里用 `?? ''` 兜底，或在数据库层确认数据是否完整。

---

## 6. 复现检查清单

- [ ] **PostgreSQL 已启动，`social_network` 数据库存在。**  
  验证：运行 `psql -l` 能看到 `social_network`；运行 `psql -d social_network -c "选择 current_database(), current_user;"` 能返回当前数据库和用户。

- [ ] **已安装依赖 `express`、`pg`，以及复现用的迁移 CLI。**  
  验证：运行 `npm ls express pg`；若使用 `node-pg-migrate`，运行 `npm ls node-pg-migrate` 或执行 `npm run migrate -- --help` 看命令是否可用。

- [ ] **`DATABASE_URL` 已设置，且迁移能连上数据库。**  
  验证：macOS / Linux 运行 `echo $DATABASE_URL`；PowerShell 运行 `echo $env:DATABASE_URL`；再用 `psql "$DATABASE_URL" -c "select 1;"` 验证连接。

- [ ] **已生成初始迁移文件 `migrations/<timestamp>_add-post-table.js`。**  
  验证：打开 `migrations` 目录，确认文件名带时间戳且以 `_add-post-table.js` 结尾；文件内有 `exports.up` 和 `exports.down`。

- [ ] **迁移文件中的建表 SQL 与预期一致。**  
  验证：人工检查包含 `CREATE TABLE posts`、`id`、`url`、`latitude`、`longitude`；若使用本文补全类型，应看到 `SERIAL PRIMARY KEY`、`TEXT`、`DOUBLE PRECISION`。

- [ ] **已成功执行 `up` 迁移。**  
  验证：运行 `npm run migrate up` 后无报错；用 `psql "$DATABASE_URL" -c "\d posts"` 能看到 `posts` 表及四列。

- [ ] **PG Admin 刷新后能看到 `posts` 表。**  
  验证：在 PG Admin 中右键 `social_network` 数据库选择 Refresh，展开 `Schemas` → `Tables`，确认存在 `posts`。看不到时先确认连的是同一个数据库和 schema。

- [ ] **`index.js` 中的连接配置与当前机器匹配。**  
  验证：检查 `host`、`port`、`database`、`user`、`password`；Windows 常见用户是 `postgres`，macOS 课程示例是 `SG` 且空密码。用环境变量覆盖时，确认启动服务的终端里变量已生效。

- [ ] **Node 服务能启动并监听 `3005`。**  
  验证：运行 `node index.js`，终端应出现监听日志；访问 `http://localhost:3005/posts` 不应出现连接失败。若报 `EADDRINUSE`，用 `lsof -i :3005` 或 `netstat -ano | findstr :3005` 找到占用进程。

- [ ] **GET `/posts` 能显示表格和表单。**  
  验证：浏览器打开

## 7. 课里没讲但你会撞上的

| 现象 | 原因 | 怎么办 |
|---|---|---|
| `npm run migrate` 没生成迁移，或提示未知命令/方向参数。 | 逐字稿只说 `npm run migrate`，没有讲迁移 CLI 包名和 `up` 方向参数；从空目录开始时还需要自己补迁移脚本。（补充：课里没讲具体 CLI 包名和方向参数） | 已有课程项目就按项目自带脚本执行；空目录按文档用 `node-pg-migrate` 作为复现补全，并执行 `npm run migrate up`；不确定时先看 `--help`。 |
| 迁移报 `relation "posts" already exists`。 | 之前手工建过表，或重复执行了 `CREATE TABLE posts`，导致迁移记录和数据库实际状态不一致。（补充：课里没讲迁移状态不一致时怎么处理） | 先用 `psql "$DATABASE_URL" -c "\d posts"` 确认表是否存在，再查迁移记录；开发环境可清理后重跑，不要反复执行建表 SQL。 |
| 连接数据库失败，尤其是 `password authentication failed` 或 URL 解析异常。 | `DATABASE_URL` 与 Express 里的 `PGUSER` / `PGPASSWORD` 不一致；密码里含 `@`、`:`、`/` 等字符时未做 URL 编码。（补充：课里没讲密码特殊字符的 URL 编码） | 先用 `psql "$DATABASE_URL" -c "select 1;"` 验证连接；特殊字符密码改用环境变量或 URL 编码；保证迁移和 Node 使用同一套用户名密码。 |
| `node index.js` 报 `Cannot find module 'express'` 或 `Cannot find module 'pg'`。 | 依赖没装到当前项目，或终端不在包含 `package.json` 的项目根目录。（补充：课里没讲依赖找不到时的排查） | 在项目根目录执行 `npm install express pg`，再用 `npm ls express pg` 确认依赖存在，然后重新启动。 |
| 启动服务时报 `EADDRINUSE`。 | `3005` 端口被其他进程占用；课里演示过端口冲突，但具体排查命令课里没讲。（补充：课里没讲端口占用排查命令） | macOS/Linux 用 `lsof -i :3005`，Windows 用 `netstat -ano \| findstr :3005` 找到进程并停止，或临时改端口。 |
| 页面能打开 `/posts`，但提交后 `req.body` 为空，拿不到 `lat`、`lng`。 | 没有启用 `express.urlencoded()`，或输入框没写 `name`、`name` 与后端不一致，或表单 `method` 不是 `post`。（补充：课里没讲这些错误的完整排查） | 检查 `app.use(express.urlencoded({ extended: true }))`，检查 `name="lng"`、`name="lat"` 和 `method="post"`，必要时打印 `req.body` 看实际字段。 |
| 提交后页面跳回 `/posts`，但数据库没有新行。 | Node 可能连到了另一个数据库或用户；也可能是 INSERT 列名、参数不匹配导致失败，但页面仍重定向。（补充：课里没讲按当前连接身份排查） | 用 `select current_database(), current_user;` 确认连接；用 `psql` 直接查 `social_network.posts`；查看服务端错误日志和错误处理中间件。 |
| 插入后 `longitude` 和 `latitude` 数值互换。 | SQL 列顺序是 `latitude, longitude`，参数数组是 `[lat, lng]`；双写或读取 `location[0]/[1]` 时坐标顺序也可能不一致。（补充：课里没讲坐标顺序校验） | 固定一套坐标顺序并核对页面表头；用 `psql` 查插入结果；双写、回填和读取 `point(经度, 纬度)` 时保持顺序一致。 |
| 回填后仍有 `location IS NULL`，或切到只读 `location` 后出现空坐标。 | 回填 SQL 只处理旧列都非空的行，旧数据本身有 NULL 或回填范围遗漏；课里没讲回填遗漏检查。（补充：课里没讲回填后如何检查遗漏） | 先查 `SELECT ... WHERE location IS NULL`，明确旧数据 NULL 的处理策略，再切换读取或删旧列；不要跳过检查直接 `DROP COLUMN`。 |
| PG Admin 里看不到 `posts` 表，或列和预期不一致。 | 连到了不同数据库/schema，或没有刷新；课里讲了刷新，但“连错库/schema”的排查课里没讲。（补充：课里没讲连接目标不一致的排查） | 用 `psql` 确认 `current_database()` 和 `\d posts`；在 PG Admin 刷新 `Schemas → Tables`，确认连的是 `social_network`。 |
