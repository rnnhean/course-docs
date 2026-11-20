## 1. 这一节做什么

这一节解决一个非常具体的问题：**上一节留下的 SQL 注入漏洞，怎么在不放弃“用户输入”的前提下补上**。

课程覆盖 P057–P062，最终产物是一个用 Express + `pg` 写出来的 `users` CRUD API：

- `GET /users`：查全部用户
- `GET /users/:id`：按 id 查一个用户，查不到返回 404
- `POST /users`：从 JSON body 里拿 `username`、`bio`，插入新用户并返回新记录
- `PUT /users/:id`：从 URL 拿 id、从 body 拿新 `username`/`bio`，更新并返回更新后的记录；id 不存在返回 404
- `DELETE /users/:id`：删除并返回被删记录；id 不存在返回 404

核心改造只有一句话：**所有带用户输入的 SQL，都从“拼接字符串”改成“SQL 模板 + 参数数组”**，也就是 PostgreSQL 的 prepared statement（预处理语句）。改造后，即使用户在 URL 里输入 `1; drop table users`，PostgreSQL 也只会把它当成一个普通字符串值去和 `id` 比较，不会执行第二条 SQL。

这一节还会踩一个很典型的坑：`INSERT` / `UPDATE` / `DELETE` 默认不返回被操作的行，必须显式写 `RETURNING *`，否则接口会误判成 404。

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

讲师在 P057 开头把方案拆成两条路：

> "如果我们想把用户提供的值放进查询里，要么在应用本身加一些代码来对用户提供的值做净化处理，要么采用第二种方案。第二种方案通常要好得多，优势非常明显。在第二种方案里，我们可以依赖 Postgres 替我们净化用户提供的值。"
> —— p057 [00:00]

这里“option number one”是自己写代码清洗用户输入，“option number two”是把清洗工作交给 PostgreSQL。讲师明确说第二种“preferable by a huge margin”，也就是优先用数据库的预处理能力。

接着他解释 `pg` 模块原本是怎么工作的：

> "PG 模块负责接收某条语句、执行该语句、发送到数据库并拿回响应。所以现在，我们只是把一条已经包含值的 SQL 语句交给 PG。"
> —— p057 [01:24]

改造后的写法是把一条 SQL 拆成两部分：

> "我们要给它一条类似模板的语句。注意现在 SQL 查询里，原来放 ID 的位置变成了美元符号一。你可以把美元符号一理解成一个标识符，意思是这里应该填入某个值。然后我们另外提供一个值数组，用来替换到这条语句里。"
> —— p057 [01:53]

关于 `$1` 和数组的对应关系：

> "它会进入那个值数组，找到第一个值，因为这里是美元符号一，然后用 127 替换掉这个美元符号一。"
> —— p057 [02:23]

关于 PostgreSQL 为什么能防注入：

> "Postgres 完全清楚你想用预处理语句做什么。它完全明白，当你调用 execute 并在这里提供一些值时，这些值应该被放进查询里，它们本身并不是查询。"
> —— p057 [05:11]

讲师还演示了最坏情况：如果用户传 `drop table users`，它会被当成字符串塞进 `$1` 的位置，最终查询变成“找 id 等于字符串 `drop table users` 的用户”，自然找不到，也不会执行删表。

但 prepared statement 有一个明确限制：

> "我们只能在想往查询里替换值时使用预处理语句。我们不能用预处理语句动态指定标识符，只能指定值，比如数字、字符串之类的字面值。"
> —— p057 [06:37] / [07:05]

也就是说，**表名、列名这类“标识符”不能参数化**。这一节只处理值，不处理动态表名/列名。

到 P058，讲师开始改代码。他先提醒数据库已经被上一节的注入测试删表了，需要重建：

> "不过，在修改任何代码之前，我们需要确保重置数据库，确保再次拥有用户表，因为刚才我们执行那个 SQL 注入请求时，不小心把用户表删掉了。"
> —— p058 [00:00]

然后改 `user-repo.js` 里的 `findById`：

> "在 user repo 里，我们要修改对 pool.query 的调用。把它拆成两组值。第一个参数是查询或实际的 SQL 语句，里面不再放任何值，而是放美元符号一。然后第二个参数，我放入一个数组，包含我们最终想替换进语句的所有值。"
> —— p058 [01:55]

改完 repo 还要改 `pool.js`，把第二个参数透传下去：

> "我们必须回到 pool.js。在这里接收第二个参数 values。我们经常把它称为查询的参数或 params。然后直接把它传给 params。"
> —— p058 [04:19]

P060 讲 `INSERT` 时，讲师特别强调 `RETURNING *`：

> "默认情况下，执行插入语句时，我们实际上拿不到任何关于所创建用户的信息。如果我们确实想拿到该用户的信息，那么在值语句后面，或者在最右侧，必须加上 returning star。这意味着插入这个用户之后，取出该用户的所有列并返回。"
> —— p060 [02:23]

P062 讲 `DELETE` 时，讲师自己漏了 `RETURNING *`，结果接口返回 404：

> "遗憾的是，我忘了写 RETURNING 语句……我们确实删除了用户，但查询没有返回任何能表明该用户已被删除的结果。因此，我们拿到的是空的行集。最终返回了 undefined，处理删除的 users 路由拿到的也是 undefined。于是代码进入了发送 404 状态码的分支。"
> —— p062 [02:24]

这个坑很值得单独记：**删除成功但没返回行，代码会误判成“没找到用户”**。

---

## 3. 从零复现

下面按“能跑起来”的顺序走。课里用的是 PostgreSQL + Express + `pg` + `node-pg-migrate`，数据库叫 `social_network`，服务端口 `3005`。

### 3.1 目录结构

先建出这个结构，后面每个文件都能对上：

```text
social-network/
├── .env
├── .env.example
├── package.json
├── migrations/
│   └── 1700000000000_create-users.js
└── src/
    ├── server.js
    ├── pool.js
    ├── routes/
    │   └── users.js
    ├── repositories/
    │   └── user-repo.js
    └── utils/
        └── to-camel-case.js
```

课里没有逐行展示 `package.json`、`server.js`、`to-camel-case.js` 的完整实现，但这些东西是跑通所必需的。下面会给出一套可直接保存运行的版本；第 7 节会单独标注哪些是课里明确讲的、哪些是按课程逻辑补齐的。

### 3.2 初始化项目和安装依赖

课里没讲 Node 版本。建议 Node 18 或 20。依赖版本课里也没讲，下面给的是写作时可用的参考版本，不是讲师指定的版本。

```bash
mkdir social-network
cd social-network
npm init -y
npm install express pg dotenv
npm install -D node-pg-migrate dotenv-cli
```

### 3.3 创建数据库

课里是用 pgAdmin 图形界面删库、重建库。命令行等价操作：

```bash
createdb social_network
```

如果 `createdb` 不存在，用 `psql`：

```sql
CREATE DATABASE social_network;
```

### 3.4 配置环境变量

新建 `.env`：

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_network
PORT=3005
```

把用户名、密码、端口换成你本机 PostgreSQL 的实际值。再复制一份 `.env.example`，内容一样，方便别人知道要配哪些变量。

### 3.5 写 migration 建 users 表

课里提到 `users` 表有 `id`、`username`、`bio`、`created_at`、`updated_at`。`created_at` / `updated_at` 在讲师返回用户记录时出现过，列名是 snake_case，所以前端拿到后要转 camelCase。

新建 `migrations/1700000000000_create-users.js`：

```js
exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    username: { type: 'varchar(255)', notNull: true },
    bio: { type: 'varchar(255)' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
```

跑迁移：

```bash
npm run migrate up
```

### 3.6 插入两条测试数据

课里在 pgAdmin 的 Query Tool 里执行了 `INSERT INTO users`，插入了 Allison14 和 Gia67。命令行等价：

```sql
INSERT INTO users (username, bio)
VALUES
  ('Allison14', 'This is my bio'),
  ('Gia67', 'A little bit about me');
```

确认：

```sql
SELECT * FROM users;
```

### 3.7 启动服务并测试

```bash
npm start
```

终端应看到类似 `Server listening on 3005`。然后用 curl 或 Postman / VS Code REST Client 测下面五组请求。

正常查询：

```bash
curl http://localhost:3005/users/1
curl http://localhost:3005/users/2
curl http://localhost:3005/users/3
```

第三个应该 404。

创建用户：

```bash
curl -X POST http://localhost:3005/users \
  -H "Content-Type: application/json" \
  -d '{"username":"cookie123","bio":"I am a cookie"}'
```

更新用户：

```bash
curl -X PUT http://localhost:3005/users/1 \
  -H "Content-Type: application/json" \
  -d '{"username":"Allison156","bio":"Allison, I am Allison"}'
```

删除用户：

```bash
curl -X DELETE http://localhost:3005/users/2
```

注入测试：

```bash
curl "http://localhost:3005/users/1;drop%20table%20users"
```

课里讲师直接在请求客户端里输入 `1; drop table users`。服务端终端会报 `invalid input syntax for type integer`，说明整段字符串被当成 `id` 的值，而不是被拆成两条 SQL。课里没有展示这个请求的 HTTP 响应体，实际会走 Express 默认错误处理，大概率是 500，具体以你的错误中间件为准。

---

## 4. 完整代码

下面每个文件都可以直接保存。课里直接展示过的部分，我在第 5 节逐行解释；课里没展示、但跑通必需的部分，在第 7 节标注。

### 4.1 `package.json`

```json
{
  "name": "social-network",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "migrate": "dotenv -e .env -- node-pg-migrate -m migrations"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "dotenv-cli": "^7.4.2",
    "node-pg-migrate": "^7.6.1"
  }
}
```

### 4.2 `migrations/1700000000000_create-users.js`

```js
exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    username: { type: 'varchar(255)', notNull: true },
    bio: { type: 'varchar(255)' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
```

### 4.3 `src/pool.js`

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query(text, params) {
    return pool.query(text, params);
  },
};
```

### 4.4 `src/utils/to-camel-case.js`

```js
module.exports = function toCamelCase(rows) {
  return rows.map((row) => {
    const entries = Object.entries(row);
    const converted = entries.map(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => {
        return char.toUpperCase();
      });
      return [camelKey, value];
    });
    return Object.fromEntries(converted);
  });
};
```

### 4.5 `src/repositories/user-repo.js`

```js
const pool = require('../pool');
const toCamelCase = require('../utils/to-camel-case');

module.exports = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM users');
    return toCamelCase(rows);
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return toCamelCase(rows)[0];
  },

  async insert(username, bio) {
    const { rows } = await pool.query(
      'INSERT INTO users (username, bio) VALUES ($1, $2) RETURNING *',
      [username, bio]
    );
    return toCamelCase(rows)[0];
  },

  async update(id, username, bio) {
    const { rows } = await pool.query(
      'UPDATE users SET username = $1, bio = $2 WHERE id = $3 RETURNING *',
      [username, bio, id]
    );
    return toCamelCase(rows)[0];
  },

  async delete(id) {
    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    return toCamelCase(rows)[0];
  },
};
```

### 4.6 `src/routes/users.js`

```js
const express = require('express');
const userRepo = require('../repositories/user-repo');

const router = express.Router();

router.get('/', async (req, res) => {
  const users = await userRepo.findAll();
  res.send(users);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await userRepo.findById(id);

  if (user) {
    res.send(user);
  } else {
    res.sendStatus(404);
  }
});

router.post('/', async (req, res) => {
  const { username, bio } = req.body;
  const user = await userRepo.insert(username, bio);
  res.send(user);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, bio } = req.body;
  const user = await userRepo.update(id, username, bio);

  if (user) {
    res.send(user);
  } else {
    res.sendStatus(404);
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await userRepo.delete(id);

  if (user) {
    res.send(user);
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
```

### 4.7 `src/server.js`

```js
require('dotenv').config();

const express = require('express');
const usersRouter = require('./routes/users');

const app = express();

app.use(express.json());
app.use('/users', usersRouter);

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
```

---

## 5. 逐行解释

### 5.1 为什么是 `$1` + 数组，而不是字符串拼接

`findById` 这一段是整节的核心：

```js
const { rows } = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [id]
);
```

`pool.query` 现在收两个参数：

1. 第一个是 SQL 模板，里面用 `$1` 占位；
2. 第二个是值数组，`$1` 对应数组第 1 个元素，`$2` 对应第 2 个，依此类推。

讲师在 P057 用 `127` 举例：`$1` 会被数组里的 `127` 替换。如果 SQL 里还有 `AND username = $2`，数组第二个元素就会替换 `$2`。

关键点不是“替换”这个动作，而是**谁来做替换**。字符串拼接是应用先拼好一整条 SQL，PostgreSQL 只能看到最终字符串，分不清哪部分是代码、哪部分是用户输入。参数化查询是应用把“SQL 模板”和“值”分开送到 PostgreSQL，PostgreSQL 在解析模板时就已经知道 `$1` 是一个值的位置，执行时只把值填进去，不会再把这个值当 SQL 语法解析。

所以注入字符串 `1; drop table users` 会变成“id 等于这个字符串”的比较，而不是两条语句。

![p057 01:49 讲师展示用 $1 占位符替代直接写入的 ID](images/p057_0109s.jpg)

### 5.2 `pool.js` 为什么要多接一个 `params`

`user-repo.js` 调的是自己封装的 `pool.query(text, params)`，不是 `pg` 原生的 `pool.query`。所以 `pool.js` 必须把第二个参数继续传下去：

```js
module.exports = {
  query(text, params) {
    return pool.query(text, params);
  },
};
```

讲师在 P058 [04:19] 专门提醒了这一点：如果只在 repo 里写两个参数，但 `pool.js` 只接收一个参数，`params` 会在中间层丢掉，最后 PostgreSQL 收到的还是不带参数的 SQL，直接报错。

![p058 04:17 讲师回到 pool.js 把 values/params 透传给 pg 的 query](images/p058_0257s.jpg)

### 5.3 `INSERT` 为什么必须加 `RETURNING *`

```js
'INSERT INTO users (username, bio) VALUES ($1, $2) RETURNING *'
```

默认情况下，`INSERT` 执行完只告诉你“插入了 1 行”，不返回这一行的列。讲师的 `POST /users` 想把新用户直接返回给客户端，所以必须加 `RETURNING *`。

`RETURNING *` 的意思是：插入成功后，把这一行所有列（`id`、`username`、`bio`、`created_at`、`updated_at`）一起返回。这样 `rows[0]` 就是新用户对象。

`UPDATE` 和 `DELETE` 同理：

```js
'UPDATE users SET username = $1, bio = $2 WHERE id = $3 RETURNING *'
'DELETE FROM users WHERE id = $1 RETURNING *'
```

P062 讲师漏了 `DELETE` 的 `RETURNING *`，结果删除其实成功了，但 `rows` 是空数组，`rows[0]` 是 `undefined`，路由层 `if (user)` 判断失败，返回 404。这个坑不是 SQL 写错，而是“返回值约定”没对上。

![p060 02:23 代码编辑器里给 INSERT 语句加上 RETURNING *](images/p060_0127s.jpg)

### 5.4 `UPDATE` 的参数顺序为什么是 `[username, bio, id]`

SQL 是：

```sql
UPDATE users
SET username = $1, bio = $2
WHERE id = $3
RETURNING *
```

所以数组必须是 `[username, bio, id]`。如果写成 `[id, username, bio]`，就会变成“把 username 设成 id、把 bio 设成 username、按 bio 找行”，数据会错得很隐蔽。

讲师在 P061 写的就是 `username first, then bio, then the ID`。这种位置对应关系是参数化查询最容易写错的地方，写完最好把 SQL 和数组并排看一眼。

![p061 01:23 代码编辑器里写 UPDATE users SET username = $1, bio = $2 WHERE id = $3](images/p061_0083s.jpg)

### 5.5 `toCamelCase(rows)[0]` 在干什么

PostgreSQL 返回的列名是 snake_case：`created_at`、`updated_at`。前端更习惯 camelCase：`createdAt`、`updatedAt`。`toCamelCase` 把每一行的 key 转掉，返回新数组。

`findById`、`insert`、`update`、`delete` 都只可能影响一行，所以取 `[0]`。`findAll` 返回多行，所以直接返回整个数组。

课里只出现了 `toCamelCase` 的调用，没有逐行展示实现。上面给的实现是按“把 `_x` 转成大写 X”写的，属于跑通所需的补齐代码。

### 5.6 路由层的 `if (user)` 为什么能区分 404

repo 方法在“没找到行”时返回 `toCamelCase(rows)[0]`，也就是 `undefined`。路由层：

```js
if (user) {
  res.send(user);
} else {
  res.sendStatus(404);
}
```

`undefined` 是 falsy，所以走 404。这里依赖的是 repo 的返回值约定：**找到返回对象，没找到返回 `undefined`**。如果 repo 改成抛异常，路由层就要用 `try/catch`，课里没讲这种改法。

![p062 02:19 讲师发现 DELETE 漏写 RETURNING * 导致接口返回 404](images/p062_0139s.jpg)

### 5.7 `express.json()` 为什么不能省

`POST /users` 和 `PUT /users/:id` 都从 `req.body` 取 `username`、`bio`。Express 默认不解析 JSON body，必须加：

```js
app.use(express.json());
```

没有这行，`req.body` 是 `undefined`，解构会直接抛错。课里 P059 复习了“POST 请求怎么带 body、怎么在 Express 里用 `req.body` 拿”，但没有逐行讲 `express.json()` 中间件；这是跑通必需的一行。

![p059 01:16 请求客户端里用 POST 发送 username 和 bio 的 JSON body](images/p059_0075s.jpg)

### 5.8 prepared statement 的边界：只能替换值，不能替换标识符

讲师在 P057 [06:37]–[07:05] 明确说了限制：prepared statement 只能替换“值”，比如数字、字符串；不能替换表名、列名这类标识符。

也就是说，下面这种需求**不能**靠 `$1` 解决：

```sql
SELECT $1 FROM users;        -- 不能指望 $1 变成 username 或 bio
SELECT * FROM $1;            -- 不能指望 $1 变成 users 表名
```

如果业务真的需要动态列名/表名，得另找方案（白名单、`pg-format` 之类），课里没有展开讲具体做法。

![p057 07:05 讲师指出 prepared statement 不能动态替换表名和列名](images/p057_0203s.jpg)

### 5.9 注入测试为什么报的是类型错误

请求 `/users/1;drop table users` 时，Express 的 `/:id` 会把整段 `1;drop table users` 当作 `id` 参数。repo 执行：

```sql
SELECT * FROM users WHERE id = $1
```

参数是字符串 `1;drop table users`。数据库 `id` 列是 integer，PostgreSQL 尝试把这个字符串转成 integer，失败，报：

```text
invalid input syntax for type integer
```

这个报错恰好证明：整段字符串被当成一个值，而不是被拆成 `1` 和 `drop table users` 两条语句。如果还是字符串拼接，这里就会先执行 `SELECT ... WHERE id = 1`，再执行 `drop table users`。

课里讲师在终端看到了这个报错，但没展示 HTTP 响应体。实际响应取决于你的错误处理中间件；默认 Express 会返回 500。

![p057 02:21 讲师展示 values 数组第一个元素 127 对应 $1](images/p057_0141s.jpg)

---

## 6. 复现检查清单

按顺序勾，任何一项不对，先修再往下走。

- [ ] PostgreSQL 已启动，`social_network` 数据库存在
- [ ] `.env` 里的 `DATABASE_URL` 能连上，用户名/密码/端口正确
- [ ] `npm run migrate up` 成功，`users` 表存在，有 `id`、`username`、`bio`、`created_at`、`updated_at`
- [ ] 已插入至少两条测试用户（Allison14、Gia67）
- [ ] `npm start` 后终端显示 `Server listening on 3005`
- [ ] `GET /users/1` 返回一个对象，字段是 camelCase
- [ ] `GET /users/999` 返回 404
- [ ] `POST /users` 带 JSON body，返回新用户，包含 `id`
- [ ] `PUT /users/1` 返回更新后的用户，`username` 和 `bio` 已变
- [ ] `PUT /users/999` 返回 404
- [ ] `DELETE /users/2` 返回被删用户
- [ ] 再 `GET /users`，确认 id=2 已消失
- [ ] `DELETE /users/999` 返回 404
- [ ] 注入请求 `/users/1;drop%20table%20users` 不会删表；终端出现 `invalid input syntax for type integer`
- [ ] 注入测试后再 `GET /users`，`users` 表仍然存在
- [ ] `user-repo.js` 里所有带用户输入的地方都是 `$1`/`$2`/`$3` + 数组，没有字符串拼接
- [ ] `pool.js` 的 `query(text, params)` 确实把 `params` 传给了 `pg`
- [ ] `INSERT`、`UPDATE`、`DELETE` 三条语句都带 `RETURNING *`

![p057 03:23 讲师说明 PG 模块用 prepare 关键字创建 prepared statement](images/p057_0203s.jpg)

---

## 7. 课里没讲但你会撞上的

这一节单独列“课程没有展开、但复现时一定会遇到”的点。不是讲师讲错了，而是课程范围没覆盖。

### 7.1 依赖版本和 Node 版本

课里没有说 `express`、`pg`、`node-pg-migrate` 的具体版本，也没有说 Node 版本。上面 `package.json` 里的版本是写作时的参考版本，不是讲师指定的。Node 建议 18+，因为 `Object.fromEntries` 和 `node-pg-migrate` 新版本都要求较新的运行时。

### 7.2 `express.json()` 中间件

课里讲了 `req.body` 怎么用，但没有逐行讲“必须注册 `express.json()`”。没有这行，`POST` / `PUT` 会在解构 `req.body` 时抛 `Cannot destructure property 'username' of 'req.body' as it is undefined`。

### 7.3 `dotenv` 的加载时机

`server.js` 第一行必须是：

```js
require('dotenv').config();
```

而且要在 `require('./pool')` 之前。因为 `pool.js` 在模块加载时就会读 `process.env.DATABASE_URL`。如果 `dotenv` 晚于 `pool` 加载，连接串会是 `undefined`。

`node-pg-migrate` 是 CLI，不会自动读 `.env`。上面的 `package.json` 用 `dotenv-cli` 包了一层：

```json
"migrate": "dotenv -e .env -- node-pg-migrate -m migrations"
```

课里没有展示这层配置，只说了 `npm run migrate up`。

### 7.4 `updated_at` 不会自动更新

migration 里给 `updated_at` 设了默认值 `now()`，但 `UPDATE` 语句只写了：

```sql
SET username = $1, bio = $2
```

没有写 `updated_at = now()`。所以更新用户后，`updated_at` 仍然是插入时的时间。课里没有讲触发器或自动更新时间戳的方案。如果要自动更新，需要加触发器或在 `UPDATE` 里显式写 `updated_at = now()`。

### 7.5 错误处理中间件缺失

`findById` 遇到非数字 id 时，`pool.query` 会 reject。路由 handler 是 `async`，但没有 `try/catch`，Express 4 不会自动捕获 async 异常，结果可能是请求挂起或走默认错误处理。课里在注入测试时只看了终端报错，没有讲 API 层怎么统一返回 JSON 错误。生产环境需要加错误处理中间件。

### 7.6 `id` 的类型转换

数据库 `id` 是 integer，URL 里拿到的是 string。PostgreSQL 会尝试把 string 隐式转成 integer：

- `"1"` → 成功
- `"1;drop table users"` → 失败，报 `invalid input syntax for type integer`

这不是 bug，而是参数化查询在起作用。课里正是用这个报错证明注入字符串没有被当 SQL 执行。

### 7.7 动态表名/列名没有解决方案

讲师明确说 prepared statement 不能替换标识符，但课里没有给替代方案。如果之后要做“按前端传的字段排序”或“动态选表”，需要自己做白名单校验，或者用 `pg-format` 这类库拼接标识符。**不要**直接把用户输入拼进 SQL 的标识符位置。

### 7.8 事务：这一节没有

本节所有操作都是单条 SQL，没有事务。如果以后要做“扣库存 + 写订单”这种多步操作，在 Node 里对应的是：

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // 多条 SQL
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

课里没有讲这段，知道有这回事即可。prepared statement 本身不提供事务能力，它只解决“值怎么安全地进 SQL”。

### 7.9 连接池没有调优

`new Pool({ connectionString })` 用的是默认连接池配置。课里没有讲 `max`、`idleTimeoutMillis` 这些参数。本地开发够用，生产环境要按数据库连接数上限调整。

### 7.10 测试还没写

P062 结尾讲师说下一步要写自动化测试，并且提到“测数据库需要比想象中更多对数据库和连接方式的理解”。这一节没有测试代码。复现时先用 curl / Postman 手工验证，测试留到下一节。

![p058 02:16 代码编辑器里把 findById 的查询改成 WHERE id = $1](images/p058_0136s.jpg)