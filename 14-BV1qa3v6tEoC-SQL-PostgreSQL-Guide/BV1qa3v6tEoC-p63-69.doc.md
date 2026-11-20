# SQL & PostgreSQL Guide（BV1qa3v6tEoC）P63–P69 复现文档
## 给 Express + Postgres 项目加自动化测试，并撞上「并行测试共享一个数据库」的坑

---

## 1. 这一节做什么

这一节表面上是在讲「怎么写测试」，但讲师在第一分钟就把真实目的说清楚了：

> "要看完接下来的视频，你其实完全不需要了解太多测试相关的内容。相反，这一整段讨论的目的，其实是了解 Postgres 本身另外的两个功能。"
> —— p063 [00:00]

也就是说：**测试只是道具，真正要引出的是 Postgres 层面的两个特性**。这两个特性具体叫什么，讲师在 P63–P69 这七集里**没有点名**（原话只说 "Postgres 本身内部的两个额外功能"），要到后面的视频才展开。这七集里能确认的是：它们要解决的问题是「多个进程同时对同一张表做读-写-读，导致断言随机失败」。

本节要交付的东西非常具体，一共 6 项：

| # | 产出物 | 路径 |
|---|---|---|
| 1 | 测试目录与测试文件（最终是 3 份内容相同的） | `src/test/routes/users.test.js`、`users-2.test.js`、`users-3.test.js` |
| 2 | `UserRepo` 新增一个 `count()` 静态方法 | `src/repos/user-repo.js` |
| 3 | `package.json` 新增 `test` 脚本 | `package.json` |
| 4 | 新建一个独立数据库 `socialnetwork-test`，并在里面跑一遍迁移 | 数据库 + `migrations/` |
| 5 | 测试文件里的 `beforeAll`（建连接）与 `afterAll`（断连接） | `src/test/routes/users.test.js` |
| 6 | 一个「差值为 1」而不是「绝对值为 1」的断言写法 | 同上 |

一句话概括本节的工程结论：

> **测试环境必须有自己的数据库；而且就算有了自己的数据库，只要 Jest 并行跑多个测试文件，针对同一张表的「数数」断言依然会随机失败。**

![p063 00:28 讲师列出 Jest 并行执行多个测试文件、同时连同一个数据库带来的冲突](images/p063_0028s.jpg)

---

## 2. 讲师原话（按主题摘录，非时间流水）

**关于 Jest 默认并行、与其他测试框架不同：**

> "Jest 会同时执行这三个文件。这有点不常见。JavaScript 世界里的许多其他测试运行器都会尝试按顺序运行测试文件。"
> —— p063 [00:55]

**关于冲突的具体形态（创建用户 → 立刻取最新用户）：**

> "测试文件 1 可能会先创建一个用户，然后可能尝试从用户表里取出最近创建的那个用户……如果测试文件 1 创建了一个用户，紧接着在下一微秒，测试文件 3 也创建了一个用户，我们就可能破坏测试文件 1 里的那个测试。"
> —— p063 [01:54]

**关于报错根源（pool 只在 index.js 里 connect）：**

> "这个 `this._pool` 只会在我们调用 `connect` 时被定义，或者更准确地说，从 null 重新赋值。现在，这个 `connect` 函数只在我们的 `index.js` 文件里执行……当我们运行测试时，这个文件不会被执行。"
> —— p065 [01:56]

**关于 `afterAll` 里必须断开连接：**

> "只要 PG 模块一直保持着到 Postgres 的连接，我们的程序就永远不会自然退出。"
> —— p066 [00:00]

> "如果你曾经有一个测试套件在某个时刻没有自然退出，那么你的测试就会一直处于挂起状态。"
> —— p066 [02:14]

**关于为什么不能「跑测试前把开发库清空」：**

> "我们可能只是为了确保一切按预期工作而创建用户。然后突然之间，每当我们运行测试时，就会把所有数据都清空。这非常不方便。"
> —— p067 [01:22]

**关于把断言从「绝对值」改成「差值」：**

> "我们可以用结束计数减去起始计数，并预期差值为 1。也就是说，在这段很短的时间内，我们一开始有一个用户计数，创建了一个用户，然后又取了一次新计数，起始值和结束值之间的差应该等于 1。"
> —— p068 [03:19]

**关于并行之后结果变得不可预测：**

> "你可能不会立刻看到失败。你可能只看到两个失败，也可能只看到一个失败，还可能三个全都看到。本质上，你得到什么结果有些随机。"
> —— p069 [01:53]

---

## 3. 从零复现

### 3.0 前置：本节目录结构

```
socialnetwork/
├── package.json
├── migrations/
│   └── 001_create_users.sql        # 课里没给列定义，见 §4.1
└── src/
    ├── index.js                    # 启动开发服务器
    ├── app.js                      # 导出 buildApp()
    ├── pool.js                     # pg 连接池单例
    ├── repos/
    │   └── user-repo.js            # 本节新增 static count()
    ├── routes/
    │   └── users.js                # POST /users
    └── test/
        └── routes/
            ├── users.test.js
            ├── users-2.test.js      # 复制自 users.test.js
            └── users-3.test.js      # 复制自 users.test.js
```

> "我会在 `src` 目录里新建一个名为 `test` 的文件夹。"
> —— p064 [00:00]

### 3.1 安装依赖

课里明确提到 `supertest`（p064 [00:56]：「This is a module that we installed at the very start of our project」）和 `jest`（p063 [00:43]）。`pg`、`express` 是项目原有依赖。

**讲师在 P63–P69 里没有给出版本号**，下面给的是能与本仓库代码跑通的一组版本：

```bash
npm install express pg
npm install --save-dev jest supertest
```

`package.json` 的依赖段落（版本号以你实际安装为准）：

```json
{
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

### 3.2 建两个数据库

课里是在 **PG Admin 里手动点出来的**，不是命令行：

> "我们转到 PG Admin，手动创建一个名为 social networking dash test 的新数据库。"
> —— p067 [02:17]

- 开发库：`socialnetwork`
- 测试库：`socialnetwork-test`

> "口述与命名的坑：讲师先说成 social networking-test，随即自己纠正：“哦，你知道，我叫它 social networking，其实应该只是 social network。我快速重新建一下。那就叫 social network dash test，这样更好。”"
> —— p067 [02:44]
> 数据库名里**不能有空格**，实际落地请用 `socialnetwork` / `socialnetwork-test`（或你项目里已有的名字），后文统一用这两个。

命令行等价写法（课里没讲，PG Admin 图形操作不方便脚本化时用）：

```bash
createdb socialnetwork
createdb socialnetwork-test
```

### 3.3 在测试库里跑一遍迁移

这一步是 P67 结尾到 P68 开头才补上的，因为直接跑测试会报 `relation users does not exist`：

> "我们只是创建了一个数据库，实际上并没有在里面运行任何迁移。"
> —— p067 [04:10]

课里只说「把那条很长的迁移命令里的数据库名换掉」，**没有给命令原文**：

> "我们回到终端，再运行一次那种很长的命令。不过这次要确保把数据库名从 social network 改成 social network dash test。"
> —— p068 [00:00]

下面用最朴素的 `psql` 演示同样效果（若你项目里用的是 node-pg-migrate、knex 等，把 `-d` 换成对应的 `DATABASE_URL` 即可）：

```bash
psql -d socialnetwork     -f migrations/001_create_users.sql
psql -d socialnetwork-test -f migrations/001_create_users.sql
```

### 3.4 给 `UserRepo` 加 `count()`

讲师在 p064 [03:43] 说「我们还没有这个功能」，然后现场写到文件末尾：

> "在 user repo.js 文件里，我往下拉到最底部。"
> —— p064 [03:43]

完整代码见 §4.4。注意最后一行必须包 `parseInt`（P68 才修的）：

![p068 01:07 讲师在 user-repo.js 里给 count 查询结果套上 parseInt](images/p068_0067s.jpg)

### 3.5 写第一个测试文件

完整代码见 §4.6。这里记录它**演化过程中的四个版本**，因为你照着敲的时候一定会在这些地方卡一下：

| 版本 | 出现于 | 内容 | 症状 |
|---|---|---|---|
| V1 | p064 | 只有 `test('create a user', ...)`，没有 `beforeAll` | `Cannot read property 'query' of null` |
| V2 | p065 | 加 `beforeAll(() => pool.connect({...}))` | 测试能跑，但断言失败 + Jest 挂在终端不退出 |
| V3 | p066 | 加 `afterAll(() => pool.close())` | 能自然退出；断言仍失败（`'1'` vs `0`） |
| V4 | p068 | count 包 `parseInt`；断言改成 `finishCount - startingCount === 1` | 单文件可反复通过 |

### 3.6 加 test 脚本

```json
{
  "scripts": {
    "test": "jest --no-cache"
  }
}
```

`--no-cache` 是 P69 才加的：

> "就在这之后，我要加上 --no-cache，像这样。"
> —— p069 [00:09]

### 3.7 复制成三份并并行跑

```bash
cp src/test/routes/users.test.js src/test/routes/users-2.test.js
cp src/test/routes/users.test.js src/test/routes/users-3.test.js
npm run test
```

预期现象（讲师原话 p069 [01:53]）：**失败个数是随机的**，可能 1 个、2 个、3 个。

![p069 01:46 三份测试文件并行执行后出现随机数量的失败](images/p069_0106s.jpg)

### 3.8 本节终点

P69 结尾**没有给出解决方案**，讲师只说：

> "我们先在这里暂停一下，试着想一些策略来处理这个问题，确保每个不同的测试文件基本上都能在各自独立的小环境里运行。"
> —— p069 [04:44]

所以本节的可复现终点是：**三个测试文件并行跑，失败结果随机**。隔离方案属于下一节内容，课里没讲。

---

## 4. 完整代码

> 标注约定：
> - ✅ **课里给出的代码**：逐字稿中有明确描述或逐字念出的内容
> - ⚠️ **文档补全**：逐字稿中未出现、但要让项目跑起来必须存在的部分。这类代码我尽量保持最小，并说明补的依据。

### 4.1 `migrations/001_create_users.sql`（⚠️ 文档补全）

课里始终只说「迁移」「users 表」，**没有念过任何一列的定义**。测试里用到的字段只有 `username` 和 `bio`（p064 [02:17]：`username: 'test user'`、`bio: 'test bio'`），据此给最小定义：

```sql
-- migrations/001_create_users.sql
-- ⚠️ 课里没给表结构，本文件按测试实际用到的两个字段最小实现
CREATE TABLE IF NOT EXISTS users (
  id       SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  bio      VARCHAR(255)
);
```

### 4.2 `src/pool.js`（✅ 课里给出结构，⚠️ 补全字段）

P65 的报错 `Cannot read property 'query' of null` 指向 `this._pool`；P65 [03:22] 提到 `connect` 会「run that initial select one plus one query」；P66 [00:54] 提到 `close` 会「terminate our pool or essentially disconnect all of our clients」。据此：

```js
// src/pool.js
const pg = require('pg');

class Pool {
  _pool = null; // ✅ 课里点名的字段名 this._pool

  connect(options) {
    this._pool = new pg.Pool(options);
    // ✅ 课里明确提到：连接成功后会先跑一次 SELECT 1 + 1
    return this._pool.query('SELECT 1 + 1;');
  }

  close() {
    // ✅ 课里明确提到 close 用于断开所有 client
    return this._pool.end();
  }

  query(sql, params) {
    // ⚠️ 文档补全：user-repo 里用到了 pool.query，逐字稿未展示这个方法体
    return this._pool.query(sql, params);
  }
}

module.exports = new Pool();
```

> Node 版本提示：类字段 `_pool = null;` 需要 Node 12+（建议 18+）。若报语法错，改成在 `constructor()` 里 `this._pool = null;`。

### 4.3 `src/app.js`（✅ 结构课里给出，⚠️ 装配补全）

P64 [01:11] 明确说：`app.js` 导出的是一个**函数**，调用它才拿到 express 实例：

> “inside that app.js file, we exported a function to build a copy of our express app, wire up some stuff, and then return it.”

```js
// src/app.js
const express = require('express');
const usersRouter = require('./routes/users');

// ✅ 课里明确：导出一个「造 app」的函数
// ⚠️ 文档补全：中间件与路由挂载细节课里没展示
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/users', usersRouter);
  return app;
}

module.exports = { buildApp };
```

### 4.4 `src/repos/user-repo.js`（✅ `count()` 课里给出，⚠️ 其他方法补全）

```js
// src/repos/user-repo.js
const pool = require('../pool');

class UserRepo {
  // ⚠️ 文档补全：课里只写了 count()，以下为让 POST /users 能落库的最小实现
  static async insert({ username, bio }) {
    const { rows } = await pool.query(
      'INSERT INTO users (username, bio) VALUES ($1, $2) RETURNING *;',
      [username, bio]
    );
    return rows[0];
  }

  // ⚠️ 文档补全
  static async find() {
    const { rows } = await pool.query('SELECT * FROM users;');
    return rows;
  }

  // ✅ 课里逐字给出（p064 [03:43] ~ [04:42]）
  // 注意：rows[0].count 在 pg 里是字符串，必须 parseInt（P68 才修）
  static async count() {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users;');
    return parseInt(rows[0].count);
  }
}

module.exports = UserRepo;
```

讲师对 `rows` 形状的原话（这是本节最容易踩的一个坑）：

> "这里 rows 的结果会是这样，大概就是 count 等于我们的 count 值。"
> —— p064 [04:42]

> 字段名说明：`rows[0].count` 里的 `count` 来自 `COUNT(*)` 在 Postgres 中的默认列名，讲师也是这么写的；如果你在 SQL 里写了 `COUNT(*) AS total`，就应改成 `rows[0].total`。**该字段名请以实际输出为准。**

### 4.5 `src/routes/users.js`（⚠️ 文档补全）

课里只说了「POST `/users`，期望 200」：

> "然后我们尝试向 /users 这个端点发起一个 post 请求……接着我期望这个请求的结果是 200。严格来说应该是 201，但这并不太重要。"
> —— p064 [02:17]

```js
// src/routes/users.js
const express = require('express');
const UserRepo = require('../repos/user-repo');

const router = express.Router();

// ✅ 契约来自课里：POST /users 返回 200
// ⚠️ 文档补全：函数体课里未展示
router.post('/', async (req, res) => {
  const { username, bio } = req.body;
  const user = await UserRepo.insert({ username, bio });
  res.status(200).json(user);
});

module.exports = router;
```

### 4.6 `src/test/routes/users.test.js`（✅ 本节核心，最终版）

```js
// src/test/routes/users.test.js
const request = require('supertest');
const { buildApp } = require('../../app');
const pool = require('../../pool');
const UserRepo = require('../../repos/user-repo');

// ✅ p065 [02:26]：beforeAll 里建立数据库连接
// ⚠️ 连接参数的具体取值课里没展示（讲师说是从 index.js 里复制过来的），
//    请换成你本机的 host / port / user / password
beforeAll(() => {
  return pool.connect({
    host: 'localhost',
    port: 5432,
    database: 'socialnetwork-test', // ✅ p067 [03:12]：这里必须是 -test 库
    user: 'postgres',
    password: 'postgres',
  });
});

// ✅ p066 [01:10]：afterAll 里断开连接，Jest 才会自然退出
afterAll(() => {
  return pool.close();
});

test('create a user', async () => {
  const startingCount = await UserRepo.count();

  await request(buildApp())
    .post('/users')
    .send({ username: 'test user', bio: 'test bio' })
    .expect(200);

  const finishCount = await UserRepo.count();

  // ✅ p068 [03:19]：用差值断言，而不是「绝对值等于 1」
  expect(finishCount - startingCount).toEqual(1);
});
```

### 4.7 `src/index.js`（⚠️ 文档补全，用于对照「为什么测试里 pool 是 null」）

```js
// src/index.js
const pool = require('./pool');
const { buildApp } = require('./app');

const PORT = 3005;

// ✅ 课里点明：connect 只在 index.js 里被调用，
//    所以跑 jest 时这个文件根本不会执行 → pool._pool 保持 null
pool
  .connect({
    host: 'localhost',
    port: 5432,
    database: 'socialnetwork',
    user: 'postgres',
    password: 'postgres',
  })
  .then(() => {
    const app = buildApp();
    app.listen(PORT, () => console.log(`Listening on ${PORT}`));
  })
  .catch((err) => console.error(err));
```

### 4.8 `package.json`（✅ 脚本课里给出）

```json
{
  "name": "socialnetwork",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/index.js",
    "test": "jest --no-cache"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

---

## 5. 逐行解释（按「为什么会坏」的顺序，不按文件顺序）

### 5.1 `beforeAll` 为什么必须存在

`pool.js` 里 `_pool` 初始是 `null`，只有 `connect()` 被调用才会被赋成 `new pg.Pool(...)`。而 `connect()` 只出现在 `index.js`。跑 Jest 时入口是测试文件，`index.js` **完全不会被执行**，于是第一次 `UserRepo.count()` 走到 `pool.query()` → `this._pool.query(...)` → `this._pool` 是 `null`。

这就是 P65 那条报错：

![p065 01:31 终端报出 Cannot read property query of null，指向 pool.js](images/p065_0091s.jpg)

修法就是讲师说的：

> "我们可以加一个所谓的 before all 语句……那个函数随后会被执行，我们会等它执行完，再运行这个文件里的其他测试。"
> —— p065 [02:26]

关键点：**`beforeAll` 的返回值如果是 Promise，Jest 会等它 resolve 再开始跑测试**。`pool.connect()` 返回的正是那个 `SELECT 1 + 1` 的 Promise，所以只要 `return`，就天然同步了。

> 前端背景补充：在浏览器里你没有「全局连接必须手动关」的概念（`fetch` 是一次性的）。Node 里的 `pg.Pool` 更像一个长期存活的 WebSocket 连接：不 `end()`，事件循环就永远有活跃 handle，进程不退出。

### 5.2 `afterAll` 为什么必须存在

第一次跑通之后，终端会卡住不返回，并打印类似「Jest did not exit one second after the test run has completed」的警告（讲师原话 p065 [04:19]：「it says, just did not exit one second after the test run has completed」）。

原因：

> "只要 PG 模块保持打开一个到 Postgres 的连接，我们的程序就永远不会自行退出。"
> —— p066 [00:00]

![p066 01:10 讲师在测试文件里加 afterAll，调用 pool.close() 断开发连接](images/p066_0072s.jpg)

`afterAll` 里 `return pool.close()`，`close` 内部调 `this._pool.end()`，等所有 client 归还并断开后 Promise resolve，事件循环清空，进程自然退出。

这条在 CI 里是硬要求：

> "很多这样的流水线都会运行你的测试，并期望它们在一段时间后自行退出。"
> —— p066 [02:14]

### 5.3 为什么「开发库 / 测试库」必须分开

这是 P67 的核心。讲师画了两模式的图：

![p067 00:28 讲师画出开发模式与测试模式同时连接同一个 socialnetwork 数据库](images/p067_0028s.jpg)

- 开发模式：`index.js` → `socialnetwork`
- 测试模式：`jest` → **也是** `socialnetwork`

于是测试里第一次 `startingCount` 拿到的是开发时你手动创建的那 1 个用户，`expect(startingCount).toEqual(0)` 直接失败。而讲师明确否掉了「测试前清空所有表」的方案（会把开发数据一起 dump 掉），转而新建 `socialnetwork-test`。

注意时序上的连锁反应（这是 P67–P68 之间的三段故障）：

1. 改成连 `socialnetwork-test` → 报 `relation users does not exist`（库是空的，没表）
2. 在 `socialnetwork-test` 里跑完迁移 → 报断言失败，因为 `startingCount` 是字符串 `'0'`，不是数字 `0`
3. 包上 `parseInt` → 第一次通过；**再跑一次就挂**

第 3 点是本节最值得记住的一课：

> "在第一次运行测试套件和第二次运行之间，我们一直没有删除此前在用户表中创建的那个用户。"
> —— p068 [01:52]

也就是：**测试自己污染了自己的数据库**。

### 5.4 为什么断言要写成 `finishCount - startingCount === 1`

两种写法对比：

```js
// ❌ V1 写法：假设表绝对为空
expect(startingCount).toEqual(0);
// ...
expect(finishCount).toEqual(1);

// ✅ V4 写法：只断言「这段时间内净增 1」
expect(finishCount - startingCount).toEqual(1);
```

后者的语义是「本次测试期间新增了 1 条」。它对「库里已有脏数据」免疫，但**对并发完全免疫不了**——这正是 P69 要演示的。

### 5.5 P69 的失败是算术必然，不是玄学

假设库里已有 1 条，两个测试文件几乎同时执行：

| 时刻 | 文件 A | 文件 B | 表内行数 |
|---|---|---|---|
| t1 | `count()` → 1 | | 1 |
| t2 | | `count()` → 1 | 1 |
| t3 | `POST /users` | | 2 |
| t4 | | `POST /users` | 3 |
| t5 | `count()` → 3 | | 3 |
| t6 | `3 - 1 = 2` ❌ | | 3 |
| t7 | | `count()` → 3 | 3 |
| t8 | | `3 - 1 = 2` ❌ | 3 |

讲师在 P69 [03:47] 讲的就是这一张表：

> “maybe the initial count right here is say one user ... Then in both test files, at essentially the same time, we create a new user. So now in theory, there are three users inside the database ... So it's three minus one equal to one. Well, no, that's actually equal to two.”

如果你只跑了一份文件（串行），每个文件的 `count → insert → count` 之间没有别人插队，差值恒为 1，永远通过。这就是为什么 P68 结束时「看起来一切都好了」，P69 一复制成三份就崩。

> 前端背景补充：「读-改-写」之间被别人插队叫**竞态条件**。在浏览器里你通常靠「只有一个用户点」来规避；在 Node/数据库里没有这种便利——Jest 的每个测试文件跑在独立 worker 进程里，`pool.js` 那个 `module.exports = new Pool()` 单例**在不同 worker 之间并不共享**，所以是三个真正独立的连接池在对同一个库写数据。想彻底解决必须下沉到数据库层（事务 / 隔离级别 / 独立 schema），而不是在 JS 里加个变量。

---

## 6. 复现检查清单

按顺序打勾，每一步都对应一个**你在终端里能亲眼看到的信号**。

**环境与数据库**
- [ ] `npm run start` 能起来，`POST /users` 在开发库里能落一条数据
- [ ] `socialnetwork` 和 `socialnetwork-test` 两个库都存在
- [ ] `psql -d socialnetwork-test -c "\dt"` 能看到 `users` 表（否则会重现 `relation users does not exist`）

**代码**
- [ ] `src/pool.js` 有 `_pool`、`connect`、`close`、`query` 四个成员
- [ ] `src/app.js` 导出的是 `buildApp` **函数**，不是 app 实例（这是 supertest 那行 `request(buildApp())` 能成立的前提）
- [ ] `src/repos/user-repo.js` 的 `count()` 里 `parseInt` 没漏（漏了会得到字符串 `'0'`）
- [ ] `src/test/routes/users.test.js` 的 `require('../../app')` 是**两级**向上（`src/test/routes` → `src`）

**逐版本验证（这一步别跳，跳了你就体会不到讲师想让你体会的东西）**
- [ ] 删掉 `beforeAll` 跑一次 → 复现 `Cannot read property 'query' of null`
- [ ] 加回 `beforeAll`、删掉 `afterAll` 跑一次 → 复现「did not exit」警告，`Ctrl+C` 才能回命令行
- [ ] 加回 `afterAll`，但 `database` 仍写 `socialnetwork` → 断言失败（`1 !== 0`）
- [ ] 改成 `socialnetwork-test` → 复现 `relation users does not exist`
- [ ] 跑完迁移 → 复现 `'0' !== 0`，加 `parseInt` 后通过
- [ ] 连跑两次 → 第二次失败（脏数据）
- [ ] 改成 `finishCount - startingCount` → 连跑多次都通过

**并行**
- [ ] `package.json` 的 test 脚本是 `jest --no-cache`
- [ ] 存在三份文件，且扩展名都是 `.test.js`（不是 `.test.js copy`）
- [ ] `npm run test` 输出里能看到三个 test suite 名字
- [ ] 多跑几次，**失败数量在 1/2/3 之间随机变化**（这就是本节的验收信号）

![p064 01:39 讲师在 users.test.js 里用 buildApp() 配合 supertest 发起请求](images/p064_0071s.jpg)

---

## 7. 课里没讲但你会撞上的

以下全部是 P63–P69 **没有涉及**的内容，属于照着敲完之后必然会遇到的周边问题。逐条标明来源性质。

### 7.1 `--no-cache` 的真实作用，和讲师的说法有出入

讲师的原话是：

> "我们在这里加入这个选项，目的就是确保 Jest 会并行运行我们那三个不同的测试文件。"
> —— p069 [00:09]

**课里没讲**：`--no-cache` 实际作用是禁用 Jest 的转换/结果缓存，让它每次重新读文件、重新编译。它并不能「强制并行」——Jest 默认就会按 CPU 核数开多个 worker 并行跑测试**文件**。真正用来「强制串行」的开关是 `--runInBand`（或 `--maxWorkers=1`）。

如果你想验证「串行是不是就不失败了」，加一个临时脚本即可：

```json
{
  "scripts": {
    "test": "jest --no-cache",
    "test:serial": "jest --runInBand"
  }
}
```

预期：`test` 随机失败，`test:serial` 三份文件依次执行、三份都通过。这条对照实验能让你把 P69 的现象彻底钉死。

### 7.2 Jest 的并行单位是「文件」，不是「test 块」

**课里没讲**：同一个 `.test.js` 里的多个 `test()` 是**串行**的，只有不同**文件**才可能被分到不同 worker 并行。所以 `users.test.js` 里加十个 `test()` 不会互相打架，复制成十个文件才会。这解释了为什么讲师的做法是「复制文件」而不是「在同一个文件里写三个 test」。

### 7.3 每个 worker 是独立进程，模块单例不共享

**课里没讲**：`module.exports = new Pool()` 只在**单个 worker 进程内**是单例。三个测试文件跑在三个 worker 里 → 三份独立的 `Pool` 实例 → 三个独立的 Postgres 连接 → 三段可以真正同时在数据库里执行的 SQL。这是 P69 冲突的物理基础，不是 Jest 的 bug。

### 7.4 在 JS/Node 里，「锁」对应的是什么

**课里没讲**。给前端背景的对照：

| 你在前端熟悉的 | 在 Node + Postgres 里对应的 |
|---|---|
| `localStorage` 单线程、不会被打断 | 不成立。多个 worker / 多个请求天然并发 |
| `Promise` 队列「看起来串行」 | 只保证 JS 执行栈内的顺序，不保证数据库层面的顺序 |
| 加个模块级 `let locked = false` | **无效**。跨进程不共享，跨机器更不共享 |

真正能用的手段都在数据库层，**课里没讲**，但你在实际项目里一定会需要：

- **事务**：`BEGIN; ... COMMIT;`（Node 里 `const client = await pool.connect();` 后 `client.query('BEGIN')`，结束时 `COMMIT` 或 `ROLLBACK`，最后 `client.release()`）
- **行锁**：`SELECT ... FOR UPDATE;`，让并发读同一行时排队
- **隔离级别**：`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`，冲突时让一方失败重试
- **唯一约束**：`UNIQUE(username)`，把竞态从「算错数」变成「插入失败」，更容易兜住

> 前端类比：`BEGIN / COMMIT / ROLLBACK` 类似于你在一次状态更新里想保证「要么全改要么全不改」，但它的作用域是**整个数据库连接**，不是某个组件。`FOR UPDATE` 有点像给某一行加了把「只能一个人持有」的锁——课里没讲，知道即可。

### 7.5 「每个测试文件一个独立 schema」是常见隔离方案

**课里没讲**，但 P69 结尾讲师说的「run in its own little isolated environment」（p069 [04:44]）接下来要做什么，业界常见的三条路：

1. 每个测试文件用一个独立 schema（`CREATE SCHEMA test_1;` + `search_path`）
2. 每个测试文件用一个独立数据库
3. 每个测试用事务包起来，结束时 `ROLLBACK`

方案 3 对 `POST /users` 这种「应用自己从池里取连接」的写法不适用——因为测试没法把应用用的连接和测试用的连接塞进同一个事务。这一点在你后续动手时会直接撞上。

### 7.6 连接参数不该硬编码在测试里

**课里没讲**。本节的做法是把 `host/port/database/user/password` 直接写死在 `beforeAll` 里（讲师也是这么干的，说是从 `index.js` 复制的）。实际项目里应该用环境变量：

```js
// 课里没讲，仅为工程建议
beforeAll(() => {
  return pool.connect({
    connectionString: process.env.DATABASE_URL, // 例如 postgres://postgres:postgres@localhost:5432/socialnetwork-test
  });
});
```

配套需要一个 `.env`（`dotenv`）或 Jest 的 `globalSetup`，并且在跑测试时把 `DATABASE_URL` 指向 `-test` 库。**这一步课里完全没提，但如果你把 `.env` 指向开发库去跑测试，就会原样重现 P67 的失败。**

### 7.7 `parseInt` 不带基数

**课里没讲**：`parseInt(rows[0].count)` 在字符串以 `0` 开头时理论上会有坑（虽然 `COUNT(*)` 不会返回 `08` 这种）。保险写法是 `parseInt(rows[0].count, 10)`。另外 `pg` 返回 `bigint` 类型是字符串，这是驱动行为，不是 bug —— 讲师把这个坑当作「我自己忘了一步」带过了：

> "计数查询的结果返回的是字符串形式的零。这是我的失误。"
> —— p068 [00:28]

### 7.8 忘 `release()` 会把连接池耗尽

**课里没讲**：`pool.query()` 内部会自动 `release`，所以你直接用 `pool.query` 不会泄漏。但一旦你为了事务写 `const client = await pool.connect();`，就必须在 `finally` 里 `client.release()`，否则跑几十个测试之后会卡在「等待可用连接」上，表现为测试**整体超时**而不是报错——比 P65 那个 null 错误难查得多。

---

**本节一句话总结**：把 `beforeAll` / `afterAll` / 独立测试库 / `parseInt` / 差值断言这五件事做对，单文件测试就稳了；但只要 Jest 并行跑多个文件、而它们共享同一张表，**随机失败就是必然而非偶然**——这正是讲师用七集时间、四轮报错换来的那个「钩子」。