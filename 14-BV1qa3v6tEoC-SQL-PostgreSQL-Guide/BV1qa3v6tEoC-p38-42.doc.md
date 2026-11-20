# 把 latitude / longitude 两列换成一个 point 列：PostgreSQL 零停机数据迁移（P38–P42）

> 本文覆盖 BV1qa3v6tEoC 的 P38–P42。这五集讲的是同一件事：一个已经在跑、已经有人在用的表，怎么在不中断服务、不丢数据的前提下改掉它的列结构。读者照着第 3、4 段一步步做，最终会在 `localhost:3005/posts` 跑起一个可提交帖子的页面，并且完成一次真实的数据迁移。

---

## 1. 这一节做什么

前面几集里，讲师搭了一个极简的「社交网络」Web 应用：一个 Express 服务跑在 `3005` 端口，页面 `http://localhost:3005/posts` 上半部分是一个帖子列表表格，下半部分是一个表单。表单里填两个数字（经度、纬度），提交后这条记录就进 `posts` 表，并立刻出现在上面的表格里。库里已经攒了一些样本数据。

现在需求变了：`posts` 表原来用 `longitude`、`latitude` 两个数字列存坐标，接下来要改成用一个 PostgreSQL 的 `point` 类型列 `loc` 来存。注意这不是「重命名列」，而是**两种存储格式的替换**——旧数据是两列数字，新数据是一列几何类型，两者之间必须做一次数据搬运。

讲师把这件事拆成五步，并且给出了三条约束。这三条约束是整段内容的主线，后面所有的设计选择（双写、回填脚本、为什么不改前端表单）都是在为它们服务：

| 约束 | 讲师的说法 | 实际含义 |
|---|---|---|
| 每一步做完，表单都还能用 | 「at every step, we should still be able to add a post using that form inside the browser」 | 迁移过程中服务不能停，代码不能出现「必须一次性全部改完」的状态 |
| 每一步做完，数据都不能丢 | 「at every step we should always make sure that we're not losing any data」 | 老数据要被搬到新列，新数据不能只写一半 |
| 任意两步之间可以隔任意长时间 | 「we should be able to allow any arbitrary amount of time to pass between these different steps」 | 不是「一小时内做完」，中间可以隔一天、一周，系统都保持自洽 |

五步是：

1. **加列**：新建一个可空的 `loc point` 列，老数据这一列全是 null。
2. **双写**：改服务端插入逻辑，新帖子同时写 `longitude`、`latitude` 和 `loc`。
3. **回填**：写一个脚本，把历史行的 `longitude` / `latitude` 算成 `point` 填进 `loc`。
4. **切读切写**：服务端只读写 `loc`，不再碰旧的两列。
5. **删旧列**：把 `longitude`、`latitude` 两列 drop 掉。

**第五步课里没有讲。** P42 最后一句是「we'll come back and do our very last step, which is to finally drop the latitude and longitude columns」，然后视频就结束了。所以第 7 段我会单独说明这一步要自己补哪些判断。

P40 整集是「不写代码」的讨论集：讲师把回填方案摊成两个选项（JS 批量跑 vs. 纯 SQL 一条 UPDATE），逐条对比优劣，然后用 pgAdmin 里两个 Query Tool 窗口**现场演示了 PostgreSQL 的行锁**——一个长事务在改某一行，另一个事务想改同一行就会被卡住等待。这段演示是这五集里信息密度最高的部分，第 3.7 节会带你原样复现一遍。

---

## 2. 讲师原话

> 「we are going to imagine that we want to add in the new column location, and we want to take all the values from the latitude and longitude columns and merge them into that column. So we're going to go through this five step flow.」
>
> —— p038 [00:28]

> 「For every step, we should still be able to add a post using that form inside the browser. and at every step we should always make sure that we're not losing any data.」
>
> —— p038 [00:55]

> 「So we'll do a pgm.sql. Inside of here we want to add a new column for that we will write out alter table post add column LOC, and we want it to be of type point.」
>
> —— p038 [02:06]

> 「this little bit right there, that little string is just a little bit tricky. Just double check, make sure you've got the same thing as I. This is how we insert a point in Postgres. A point is defined as a set of parentheses, and then we put two numbers separated by a comma.」
>
> —— p039 [01:53]

> 「there's actually a lot of different considerations here and how we implement this. We're going to take a look at two possible solutions and then highlight some of the pros and cons around each of them.」
>
> —— p040 [00:00]

> 「If we wrote some kind of query like that and executed it, we could accidentally load up a million different records into our JavaScript server. And in that case, chances are we would eventually run out of memory and our node server would just crash entirely.」
>
> —— p040 [01:22]

> 「whenever a transaction is going to update a value, that entire row is going to get locked.」
>
> —— p040 [07:19]

> 「So on query tool window number two, well, we're still just sitting here and we're going to continue sitting here until we eventually commit the transaction or roll back the one inside of query tool number one.」
>
> —— p040 [11:36]

> 「The migration framework that we are using, the NodePgMigrate module, is only about managing or running the files directly inside of the migrations directory. So by placing this file inside of a nested data directory, this is a sign that is a data migration.」
>
> —— p041 [01:21]

> 「inside my editor, I've opened up my index.js file … You'll notice that this location column is going to be an object that has values of x and y.」
>
> —— p042 [00:28] / [00:57]

---

## 3. 从零复现

### 3.0 前置条件与环境

- **Node.js**：18 LTS 或以上（课里没讲版本，这是写作时验证可用的版本）。
- **PostgreSQL**：本机安装，或者任何你能连上的实例。**课里没讲怎么装数据库**，也没提 Docker，装法随你。
- **pgAdmin**：P038/P039/P040 里讲师全程用它看表、开 Query Tool。用 psql 也能做同样的事，但本文的截图和操作描述按 pgAdmin 来。
- 一个新建的数据库，课里叫 `social_network`。

**目录结构**（就是这一节最终的形态）：

```
social-network/
├── .env
├── package.json
├── index.js                          # Express 服务
├── schema.sql                        # 初始建表（含样本数据）
└── migrations/
    ├── 1717000000000_add-loc-to-posts.js   # 步骤一的 schema 迁移
    └── data/
        └── 01_lnglat_to_loc.js             # 步骤三的回填脚本
```

注意 `migrations/data/` 这个层级：`node-pg-migrate` 只会自动执行 `migrations/` **直接下面**的文件，放进子目录里的文件它不会碰，所以这个脚本必须**手动 `node` 执行**。讲师在 p041 [01:21] 明确说了这一点，这不是疏漏，是有意为之。

### 3.1 初始化数据库

先建库：

```bash
createdb social_network
# 如果你用的是别的账号/端口，改成：
# createdb -h localhost -U postgres social_network
```

然后建表并塞几条初始数据。**这里有一个关键点**：`longitude` 和 `latitude` 两列**一定不能加 NOT NULL**。原因见第 7 节——第四步之后服务端只往 `loc` 写，这两列会留空，加了 NOT NULL 会直接插入失败。讲师在 p042 [04:06] 检查 pgAdmin 时也看到这两列「showing up as null」，说明原始表就是可空的。

把下面内容保存成 `schema.sql`：

```sql
-- schema.sql
drop table if exists posts;

create table posts (
  id        serial primary key,
  url       varchar(300),
  longitude numeric,
  latitude  numeric
);

insert into posts (url, longitude, latitude) values
  ('https://example.com/1', 1.0, 1.0),
  ('https://example.com/2', 2.0, 2.0),
  ('https://example.com/3', 3.0, 3.0);
```

执行：

```bash
psql -d social_network -f schema.sql
```

### 3.2 装依赖、配环境变量

```bash
npm init -y
npm install express pg
npm install --save-dev node-pg-migrate
```

`.env`（**注意：这个文件名里的变量名 `DATABASE_URL` 是 `node-pg-migrate` 默认识别的，必须叫这个**）：

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network
```

`package.json` 里加两个 script：

```json
{
  "scripts": {
    "start": "node index.js",
    "migrate": "node-pg-migrate"
  }
}
```

`.env` 不会被 Node 自动读取。**课里没讲怎么加载环境变量**（讲师是在命令行上直接写 `DATABASE_URL=... npm run migrate up` 的），所以为了让脚本能跑，本文统一用命令行前缀传参的方式，见下面的命令。如果你愿意多装一个 `dotenv` 在 `index.js` 顶部 `require('dotenv').config()`，也完全等价。

### 3.3 跑起来，确认基线

`index.js` 的完整内容在第 4 段，先把**步骤四之后的最终版本**存进去（第 4 段的代码就是最终版）。但为了走一遍完整流程，建议你先用「改动前」的版本跑通基线：

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network node index.js
```

浏览器打开 `http://localhost:3005/posts`，应该看到三条记录和一个表单。填 `4.001` / `4.001` 提交，表格里应该多一行。这一步跑通了，再开始迁移。

> **注意端口**：讲师用的是 `3005`，不是 3000。

### 3.4 步骤一：加列（schema migration）

先生成迁移文件。讲师在 p038 [01:23] 的命令是：

```bash
npm run migrate create add loc to posts
```

`node-pg-migrate` 会生成 `migrations/<时间戳>_add-loc-to-posts.js`。打开它，把内容改成：

```js
// migrations/<timestamp>_add-loc-to-posts.js
exports.up = (pgm) => {
  pgm.sql('alter table posts add column loc point');
};

exports.down = (pgm) => {
  pgm.sql('alter table posts drop column loc');
};
```

**为什么用 `pgm.sql()` 写裸 SQL 而不是用 `pgm.addColumn()`？** 因为 `point` 是 PostgreSQL 的几何类型，`node-pg-migrate` 的列类型白名单里没有它，用 DSL 写会报错。讲师直接上裸 SQL 是这个原因（p038 [02:06]）。

执行：

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network npm run migrate up
```

讲师说的「that really long command」就是这个——把连接串写在命令前面。

验证：pgAdmin 里右键 `posts` 表 → `View/Edit Data` → `All Rows`，应该能看到 `url / longitude / latitude / loc` 四列，`loc` 全是 null。

![p038 02:22 编辑器里写迁移文件的 up 与 down，给 posts 表加 point 类型的 loc 列](images/p038_0226s.jpg)

![p038 03:12 pgAdmin 中查看 posts 全表，loc 列刚加完、值全为 null](images/p038_0243s.jpg)

**这一步做完，服务不用停**——因为 `loc` 可空，老代码只写 `longitude`/`latitude` 照样成功。这就是「第一步必须是加可空列」的原因。

### 3.5 步骤二：双写

现在改 `index.js` 里的插入语句。原来大概是：

```js
insert into posts (longitude, latitude) values ($1, $2)
```

改成：

```js
insert into posts (longitude, latitude, loc) values ($1, $2, $3)
```

第三个参数的值是一个模板字符串 `(${lng},${lat})`。讲师在 p039 [01:53] 反复强调这段「little bit tricky」：

![p039 01:18 编辑器中把插入语句改成三个占位符，第三个是拼出来的 point 字面量](images/p039_0110s.jpg)

改完重启服务（`Ctrl+C` 再 `node index.js`），回浏览器提交一条 `5.001` / `5.123`。再去 pgAdmin 看这一行，`loc` 列应该有值了，显示成 `(5.001,5.123)` 这种形式——**一个列里装了两个数**，讲师在 p039 [03:19] 特意点出了这一点。

![p039 03:19 pgAdmin 中新插入的行，loc 列已经按 point 语法存了两个数](images/p039_0245s.jpg)

> 注意：这个阶段新行会**同时**有 `longitude`/`latitude` 和 `loc`，老行只有前两列。这是刻意制造的中间态，不是 bug。

### 3.6 步骤三：回填历史数据

P40 整集在讨论方案，真正动手在 P41。讲师选了**方案二：纯 SQL 更新**（p041 [00:00]）。

新建目录和文件：

```bash
mkdir -p migrations/data
```

文件名 `01_lnglat_to_loc.js`，`01` 是排序序号，将来有第二个数据迁移脚本就排 `02`。完整内容见第 4 段。执行方式（讲师 p041 [03:16]）：

```bash
cd migrations/data
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network node 01_lnglat_to_loc.js
```

终端应该打印：

```
update complete
```

![p041 03:44 终端执行回填脚本，输出 update complete](images/p041_0251s.jpg)

**这个脚本可以重复执行。** 因为 WHERE 条件是 `where loc is null`，已经填过的行不会被再处理一遍。这一点很重要——真实环境里你可能会跑一半断了，再跑一次是安全的。

### 3.7 亲手复现「行锁」（P40 的核心演示）

这段不写代码，纯粹用 pgAdmin 感受一下为什么「一条大 UPDATE 包在一个事务里」是有风险的。**强烈建议真的做一遍**，五分钟，比看十遍讲解管用。

1. 在 pgAdmin 里对着 `social_network` 库打开**两个** Query Tool 窗口。
2. 窗口一执行：
   ```sql
   select * from posts;
   ```
   确认 `id = 1` 这一行现在 `loc` 是 `(1,1)`（longitude=1, latitude=1）。
3. 窗口一改成：
   ```sql
   begin;
   update posts set loc = point(2, 2) where id = 1;
   ```
   执行。**不要 commit。**
4. 切到窗口二，执行 `select * from posts;`。你会看到 `id = 1` 仍然是 `(1,1)`——因为窗口一的事务还没提交，改动只在它自己的事务里可见。
5. 窗口二执行：
   ```sql
   update posts set loc = point(10, 10) where id = 1;
   ```
   **这条语句会卡住。** 光标转圈，没有返回。它不是在报错，是在**等**。
6. 回到窗口一，执行 `commit;`。窗口二那条 UPDATE 立刻返回。

![p040 09:14 两个 Query Tool 窗口，一个开着事务改行，另一个准备改同一行](images/p040_0793s.jpg)

![p040 11:08 第二个窗口的 UPDATE 挂起等待，直到第一个事务提交才返回](images/p040_0793s.jpg)

讲师在 p040 [12:03] 强调最终结果是 `10`：窗口一提交后，`loc` 短暂变成 `(2,2)`，然后窗口二那条排队已久的 UPDATE 立刻生效，覆盖成 `(10,10)`。

**在 JS/Node 里对应什么？** 前端同学容易有个误解：「Node 是单线程，不会有并发问题」。这个场景里 Node 单线程完全帮不上忙——锁在**数据库那一侧**。你在 Node 里用 `pg` 发出两个并发的 `pool.query()`，第二个 return 的 Promise 就一直 pending、永远不 resolve、也不 reject，你的 `await` 就那么挂着。表象上很像 `await new Promise(() => {})`。所以真实业务里要设置 statement timeout / lock timeout，否则一个卡住的请求会一直占着连接池里的连接。

### 3.8 步骤四：切读写

回到 `index.js`，做两处改动：

**读**：`GET /posts` 里遍历 `rows` 时，原来打印 `row.longitude` / `row.latitude`，改成 `row.loc.x` / `row.loc.y`。

**写**：`POST /posts` 里，把 SQL 里的 `longitude`、`latitude` 两个列名和 `$2`、`$3` 两个占位符都删掉，只留 `loc` 和 `$1`。

**为什么 `loc` 变成 `{x, y}` 对象了？** 因为 `pg` 驱动对 `point` 类型（OID 600）有内置解析器，会把 `(4,5)` 解析成 `{ x: 4, y: 5 }`。讲师在 p042 [00:57] 用一句 `console.log(rows)` 现场确认了这一点：

![p042 00:57 终端打印查询结果，loc 字段是一个带 x 和 y 的对象](images/p042_0059s.jpg)

改完后：

![p042 01:35 把渲染表格的映射从旧的两列改成 row.loc.x 与 row.loc.y](images/p042_0127s.jpg)

重启服务，刷新页面。**注意：前端表单一个字段都没改**，仍然是经度、纬度两个输入框。讲师在 p042 [02:46] 解释了这个决定：改的只是数据库怎么存，不是 API 怎么收。服务端继续收两个数字，在插入时拼成 point。这样前端完全无感知。

再提交一条 `60` / `65`，pgAdmin 里 `select * from posts;`，应该看到 `loc` 是 `(60,65)`，而 `longitude`、`latitude` 两列是 null。

---

## 4. 完整代码

> 说明：`index.js` 是按逐字稿里出现的片段（p039 的插入语句、p042 的 `row.loc.x` 映射、`pg` 的 `Pool`、3005 端口）重建的完整可运行版本。讲师原始文件里的模板、变量名细节可能与这里不同（逐字稿没有完整贴出），但三条 SQL 与路由结构是一一对应的。

### 4.1 `package.json`

```json
{
  "name": "social-network",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node index.js",
    "migrate": "node-pg-migrate"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "node-pg-migrate": "^6.2.2"
  }
}
```

> 版本号课里没讲，以上是写作时可用的组合。装的时候以 `npm install` 实际解析出的版本为准。

### 4.2 `index.js`（步骤四之后的最终版）

```js
// index.js
const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();
app.use(express.urlencoded({ extended: true }));

function layout(body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Posts</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; margin-bottom: 1.5rem; }
      th, td { border: 1px solid #ccc; padding: 0.35rem 0.75rem; }
      label { margin-right: 1rem; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

app.get('/posts', async (req, res) => {
  try {
    const { rows } = await pool.query('select * from posts order by id');

    const tableRows = rows
      .map(
        (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${row.loc ? row.loc.x : ''}</td>
        <td>${row.loc ? row.loc.y : ''}</td>
      </tr>`
      )
      .join('');

    res.send(
      layout(`
      <h1>Posts</h1>
      <table>
        <thead>
          <tr><th>id</th><th>longitude</th><th>latitude</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <h2>Create a post</h2>
      <form method="post" action="/posts">
        <label>Longitude <input name="lng" type="number" step="any" required /></label>
        <label>Latitude <input name="lat" type="number" step="any" required /></label>
        <button type="submit">Create</button>
      </form>
    `)
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/posts', async (req, res) => {
  const { lng, lat } = req.body;

  try {
    await pool.query(
      'insert into posts (loc) values ($1)',
      [`(${lng},${lat})`]
    );
    res.redirect('/posts');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3005, () => {
  console.log('listening on http://localhost:3005/posts');
});
```

**步骤二阶段，`POST /posts` 那一段要换成这个**（其余不变）：

```js
    await pool.query(
      'insert into posts (longitude, latitude, loc) values ($1, $2, $3)',
      [lng, lat, `(${lng},${lat})`]
    );
```

**步骤四阶段，`GET /posts` 里那两行本来是**（如果你想完整走一遍再看效果）：

```js
        <td>${row.longitude}</td>
        <td>${row.latitude}</td>
```

### 4.3 `migrations/<timestamp>_add-loc-to-posts.js`

```js
// migrations/<timestamp>_add-loc-to-posts.js
// 步骤一：给 posts 表加一个 point 类型的 loc 列，默认可空
exports.up = (pgm) => {
  pgm.sql('alter table posts add column loc point');
};

// 回滚：直接丢掉这一列。注意 drop 会连同这一列里已经写入的数据一起丢掉
exports.down = (pgm) => {
  pgm.sql('alter table posts drop column loc');
};
```

### 4.4 `migrations/data/01_lnglat_to_loc.js`

```js
// migrations/data/01_lnglat_to_loc.js
// 步骤三：把历史行的 longitude / latitude 回填进 loc
// 这个文件不会被 node-pg-migrate 自动执行，必须手动 node 跑
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool
  .query('update posts set loc = point(longitude, latitude) where loc is null')
  .then(() => {
    console.log('update complete');
    return pool.end();
  })
  .catch((err) => {
    console.error(err.message);
  });
```

### 4.5 `schema.sql`

```sql
-- schema.sql
drop table if exists posts;

create table posts (
  id        serial primary key,
  url       varchar(300),
  longitude numeric,
  latitude  numeric
);

insert into posts (url, longitude, latitude) values
  ('https://example.com/1', 1.0, 1.0),
  ('https://example.com/2', 2.0, 2.0),
  ('https://example.com/3', 3.0, 3.0);
```

### 4.6 `.env`

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network
```

---

## 5. 逐行解释

**`pgm.sql('alter table posts add column loc point')`**
课程选的是**裸 SQL**，不是 migration 框架的 DSL。原因前面提过：`point` 不在 `node-pg-migrate` 的列类型表里。`add column` 不写 `not null`、不写 `default`，所以这一列立即可空——这是「第一步不破坏现有写入」的关键。

**`pgm.sql('alter table posts drop column loc')`**
`down` 必须是 `up` 的严格反操作，这样 `npm run migrate down` 才能把库退回去。注意：如果你已经跑过回填、`loc` 里已经有数据，`down` 会把这些数据一起丢掉，`down` 不负责还原数据。

**`alter table posts add column loc point` 里的表名是 `posts`**
讲师口述时一会儿说 `post`、一会儿说 `posts`。以你 `schema.sql` 里实际建的表名为准，本文统一 `posts`。

**`insert into posts (longitude, latitude, loc) values ($1, $2, $3)`**
`$1`、`$2`、`$3` 是**参数化占位符**，不是字符串拼接。`pg` 会把数组 `[lng, lat, ...]` 里的值按顺序绑定进去。这在 Node 里对应的是「永远不要把用户输入拼进 SQL 字符串」，否则就是 SQL 注入。讲师在 p039 [01:26] 说「we'll talk about why we are putting in the dollar sign values inside of here in just a little bit」，说的就是这件事。

**`(${lng},${lat})`**
这是 PostgreSQL 里 point 的**文本表示格式**：一对圆括号，两个数字，逗号分隔，中间不能有空格问题（有空格也认，但别加）。Postgres 会把这个字符串隐式转成 `point` 类型，因为目标列 `loc` 的类型就是 `point`。

**顺序是 `(lng, lat)` 而不是 `(lat, lng)`**
point 的 `x` 是第一个数、`y` 是第二个数，而地理坐标约定 `x` = 经度、`y` = 纬度。所以 `point(longitude, latitude)`，拼字符串时也是先 `lng` 后 `lat`。写反了不会报错，但所有点会沿对角线翻转——这是这类迁移最阴的 bug。讲师在 p039 [02:22] 举例 `4.001, 4.001` 时两个数一样，看不出顺序问题，务必自己用两个不同的数验证。

**`update posts set loc = point(longitude, latitude) where loc is null`**
`point()` 是 PostgreSQL 内置函数，用两个数值参数构造 point。`where loc is null` 让这条语句**幂等**：已经填过的行不会被碰第二次，所以脚本可以重跑、可以在中断后接着跑。注意这里用的是 `is null` 不是 `= null`，SQL 里 `= null` 永远为假。

**`pool.query(...).then(...).catch(...)`**
`pool.query` 返回 Promise。`.then` 里先 `console.log('update complete')`，再 `return pool.end()`——**返回值很重要**，`pool.end()` 本身也是返回 Promise 的，`return` 出去能让 `.then` 链等到连接池真正关闭。`.catch` 里打 `err.message`。这个脚本没有 `process.exit`，正常路径下 `pool.end()` 关掉连接池后 Node 事件循环空了会自己退出。

**`row.loc.x` / `row.loc.y`**
`pg` 驱动对 `point` 类型有内置解析器，会把 `(4,5)` 解析成 `{ x: 4, y: 5 }`。讲师在 p042 [00:57] 用 `console.log(rows)` 亲眼确认了这一点，这是本集一个很实用的调试手法：**不确定驱动把某个类型解析成什么，先打出来看**。

**`row.loc ? row.loc.x : ''`**
这个三元判断是我加的防御，课里没写。因为步骤三跑完之前 `loc` 可能是 null，直接 `row.loc.x` 会抛 `Cannot read properties of null`。

**`app.use(express.urlencoded({ extended: true }))`**
表单是 `method="post"`，浏览器发的是 `application/x-www-form-urlencoded`，必须挂这个中间件才能从 `req.body` 里读到 `lng` / `lat`。课里没提这一行（setup 视频里应该有），漏了会得到 `undefined`。

**`pool.end()` 与 Express 常驻进程**
`index.js` 里**不能**调 `pool.end()`，服务要一直跑着。只有 `01_lnglat_to_loc.js` 这种一次性脚本才需要主动关连接池，否则脚本跑完不退出。

**`where loc is null` 为什么能保证「不丢数据」**
步骤二之后新插入的行已经带 `loc` 了，回填脚本只处理 `loc is null` 的历史行，不会覆盖任何新数据。反过来，如果回填条件写成「全表更新」，在步骤二之后跑就会把新行重算一遍——结果一样但白干活，而且在大表上是不必要的长时间锁。

---

## 6. 复现检查清单

按顺序打勾，每一步做完都要回到浏览器和 pgAdmin 各确认一次。

**准备阶段**
- [ ] `createdb social_network` 成功，`psql -d social_network -f schema.sql` 无报错
- [ ] `posts` 表有 `id / url / longitude / latitude` 四列，`longitude`、`latitude` **没有** NOT NULL
- [ ] `node index.js` 后 `http://localhost:3005/posts` 能看到 3 条记录
- [ ] 表单提交一条新记录能出现在表格里

**步骤一：加列**
- [ ] `npm run migrate create add loc to posts` 生成了迁移文件
- [ ] `up` 是 `alter table posts add column loc point`，`down` 是 `drop column loc`
- [ ] `npm run migrate up` 成功
- [ ] pgAdmin 里 `posts` 多了 `loc` 列，全部为 null
- [ ] **服务不用重启，表单提交仍然成功**（这是本步的核心验收）

**步骤二：双写**
- [ ] SQL 改成 `(longitude, latitude, loc) values ($1, $2, $3)`
- [ ] 第三个参数是 `` `(${lng},${lat})` ``，注意是 lng 在前
- [ ] 重启服务后提交 `5.001` / `5.123`
- [ ] pgAdmin 里这一行 `loc` 是 `(5.001,5.123)`，方向没错（x=经度）
- [ ] 老数据的 `loc` 仍然是 null（这是正常的，等待步骤三）

**步骤三：回填**
- [ ] `migrations/data/01_lnglat_to_loc.js` 已创建
- [ ] 脚本里 `point(longitude, latitude)` 顺序正确
- [ ] `WHERE` 条件是 `loc is null`
- [ ] `node 01_lnglat_to_loc.js` 打印 `update complete` 且进程正常退出
- [ ] pgAdmin 里所有行的 `loc` 都不为 null
- [ ] **再跑一次脚本，仍然打印 `update complete`**（验证幂等）

**行锁体验（可选但强烈建议）**
- [ ] 窗口一 `begin; update ... where id = 1;` 不提交
- [ ] 窗口二 `select` 看到的是旧值
- [ ] 窗口二 `update` 同一行会挂起等待
- [ ] 窗口一 `commit` 后窗口二立刻返回

**步骤四：切读写**
- [ ] `GET /posts` 用 `row.loc.x` / `row.loc.y`
- [ ] `POST /posts` 的 SQL 只剩 `(loc) values ($1)`
- [ ] 页面刷新后历史数据仍能正常显示
- [ ] 提交 `60` / `65` 成功
- [ ] pgAdmin 里新行 `loc` 是 `(60,65)`，`longitude`、`latitude` 为 null
- [ ] **前端表单代码一行没改**

**步骤五：删旧列（课里没讲，自己补）**
- [ ] 全仓库搜索 `longitude`、`latitude`，确认没有代码还在读写
- [ ] 线上稳定运行一段时间
- [ ] 再做 drop 的迁移

---

## 7. 课里没讲但你会撞上的

**① 第五步（drop 旧列）完全没讲。** P42 结尾只说了「下一集我们做最后一步」，然后视频结束。你自己补这一步时要注意：`drop column` 是**不可逆的破坏性操作**，`down` 里写 `add column` 加回来也恢复不了数据。正确做法是先全仓库确认代码不再引用旧列，再考虑线上观察一段时间（几天到一周），最后