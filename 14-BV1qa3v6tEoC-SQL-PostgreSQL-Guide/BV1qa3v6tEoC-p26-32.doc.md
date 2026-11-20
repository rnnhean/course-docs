# 用 node-pg-migrate 给 PostgreSQL 做 schema migration（P26–P32 复现文档）

这一节的目标很具体：把「打开 PG Admin 手点改表结构」换成「写迁移文件 + 一条命令应用」，并且能一条命令撤销。做完之后你手上会有一个 `ig/` 项目、两个迁移文件、一个 `social_network` 数据库，以及一张 `comments` 表（列名从 `contents` 变成 `body`）。

---

## 1. 这一节做什么

前几节里，所有表结构变更都是直接在 PG Admin 里敲 SQL 完成的。讲师在 P26 开头把上一节留下的两个教训总结成两条：

1. 改数据库结构的时候，必须同时改连接它的客户端；
2. 和别的工程师协作时，必须能把「数据库结构」和「某个版本的代码」绑定在一起。

这一节的解法是 **schema migration file（迁移文件）**：一个文件里同时写「怎么改」和「怎么改回去」，用命令应用（apply）和撤销（revert）。P26–P32 走完了完整闭环：

- P26–P27：概念与它解决的两个问题；
- P28：选型，确定用 `node-pg-migrate`，并强调**手写 SQL**；
- P29–P30：建项目、装依赖、建空库、生成第一个迁移文件并写 `CREATE TABLE`；
- P31：配置 `DATABASE_URL`，执行 `up`、验证、再执行 `down`；
- P32：写第二个迁移，把 `contents` 改名成 `body`，并演示 `down` 只回退一步。

最终目录结构（时间戳前缀以你机器上生成的为准）：

```
ig/
├── migrations/
│   ├── 17xxxxxxxxx_create-table-comments.js
│   └── 17xxxxxxxxx_rename-contents-to-body.js
├── node_modules/
├── package-lock.json
└── package.json
```

数据库侧最终状态：

```
social_network
└── public
    ├── comments        （id / created_at / updated_at / body）
    └── pgmigrations    （记录哪些迁移被执行过、什么时候执行的）
```

前置条件：本机已按前面课程装好 PostgreSQL 和 PG Admin，Node.js 与 npm 可用。逐字稿里没有重复讲安装过程，这一节直接从终端开始。

![p026 01:50 迁移文件里 up 与 down 两段结构示意](images/p026_0110s.jpg)

---

## 2. 讲师原话

> "每当我们更改数据库结构时，都必须确保同时更改连接到该数据库的客户端。"
> —— p026 [00:00]

这是「为什么要迁移文件」的出发点。手点 PG Admin 时，数据库变了、代码没变，中间那段时间线上就是坏的。

> "一个模式迁移文件内部会包含两个不同的部分。我们把其中一个部分称为升级，另一个部分可以称为回滚或降级。"
> —— p026 [01:24]

一个文件 = 一次变更 + 一次精确的反向变更。`up` 干什么，`down` 就干相反的事。

> "一旦这个新版本的 API 准备好开始接收流量，我们就可以自动运行项目内所有可用的迁移。"
> —— p027 [00:26]

部署时把「跑迁移」放在新版本接流量之前，把不一致窗口压到最小。

> "另一位工程师可以获取这个代码审查请求中的全部代码。他可以应用迁移……最后，审查完成后，这位工程师再回滚这次迁移。"
> —— p027 [01:23]

Code review 时迁移文件跟代码一起提交，reviewer 应用 → 测试 → 回滚，本地环境不会被我污染。

> "我强烈、非常强烈地建议你使用纯 SQL 自己手动编写所有迁移。"
> —— p028 [02:21]

这是本节最重要的一条纪律。库能帮你自动生成迁移，但它会对默认值、是否可空、索引选项做隐含假设，你不知道背后发生了什么。

> "相反，你和我将写出 pgm.sql。然后我们会放入一个多行字符串……接着在这里面写出一些原始 SQL。"
> —— p030 [03:51]

所以只用库的「脚手架」（`up` / `down` 两个函数 + CLI），SQL 全部自己写。

> "向下迁移会撤销最近一次迁移。"
> —— p031 [06:12]

以及 P32 的补充：

> "当我们执行向下迁移时，它每次只会回滚一步。"
> —— p032 [02:22]

`down` 一次只退一个迁移，不会把库清空。

---

## 3. 从零复现

### 3.1 建项目、装依赖

逐字稿里讲师把项目目录叫 `ig`（Instagram 的缩写），并说明**不动**已有的 `instagram` 数据库，另建一个 `social_network` 库来练手。

```bash
mkdir ig
cd ig
npm init -y
npm install node-pg-migrate pg
```

- `npm init -y` 生成 `package.json`；
- `node-pg-migrate` 是迁移工具；
- `pg` 是 Node 连接 PostgreSQL 的驱动，迁移工具底层要用它。

课程没有指定版本号，装的是当时的最新版。装完可以自己确认一下实际版本：

```bash
npm ls node-pg-migrate pg
```

![p029 00:06 终端里创建 ig 目录并初始化 npm 项目](images/p029_0006s.jpg)

装完打开编辑器，应该看到 `node_modules/`、`package.json`、`package-lock.json` 三样东西：

![p029 01:27 编辑器里的项目结构：node_modules、package.json、package-lock.json](images/p029_0087s.jpg)

### 3.2 在 PG Admin 里建空库

讲师的做法是：右键 `localhost` → `Create` → `Database` → 名字填 `social_network` → `Save`。建完点开 `Schemas` → `public` → `Tables`，里面是空的。

注意库名：逐字稿里口述是 "social network"，拼成 URL 时写成 `social_network`（下划线）。如果你的库名用了别的写法，后面 `DATABASE_URL` 必须一字不差地对上。

![p030 00:14 在 PG Admin 里新建 social_network 空数据库](images/p030_0014s.jpg)

### 3.3 一次性配置：把 CLI 挂到 npm scripts

打开 `package.json`，找到 `scripts`，把默认那条 `test` 删掉，换成：

```json
"scripts": {
  "migrate": "node-pg-migrate"
}
```

讲师原话是这一步只做一次，之后就能用 `npm run migrate ...` 调起 CLI。这一步不做，后面所有 `npm run migrate` 都会报「missing script」。

![p030 01:12 package.json 的 scripts 改成 node-pg-migrate](images/p030_0072s.jpg)

### 3.4 生成第一个迁移文件

```bash
npm run migrate create create-table-comments
```

讲师当时输入的是 `create table comments` 这样的描述性名字。名字只影响文件名可读性，**执行顺序由文件名前面的时间戳决定**。用连字符是为了避免空格被 shell 拆成多个参数；如果你坚持带空格，请整体加引号，例如 `npm run migrate create "创建 comments 表"`。

执行后项目里出现 `migrations/` 目录，里面有 `<时间戳>_create-table-comments.js`。打开它，模板长这样（不同版本可能多一行 `exports.shorthands = undefined;`，留着不影响）：

```js
exports.up = (pgm) => {
};

exports.down = (pgm) => {
};
```

![p030 02:10 生成的迁移文件里包含 up 与 down 两个函数](images/p030_0130s.jpg)

### 3.5 写第一个迁移的 SQL

按讲师的要求，不用 `pgm.createTable(...)` 这类自动生成函数，而是用 `pgm.sql()` 包一段多行字符串（反引号）写裸 SQL：

- `up`：建 `comments` 表，四列 `id` / `created_at` / `updated_at` / `contents`；
- `down`：`DROP TABLE comments`。

完整文件见第 4 节。

![p030 03:36 在 pgm.sql 的反引号里手写建表 SQL](images/p030_0216s.jpg)

### 3.6 配置 DATABASE_URL 并执行 up

`node-pg-migrate` 通过环境变量 `DATABASE_URL` 找数据库。格式是：

```
postgres://用户名:密码@localhost:5432/数据库名
```

讲师特别说明：上面这行里的空格只是为了看清楚，真正写的时候不能有空格。分系统：

**macOS + Postgres.app**：用户名就是你的系统用户名（`whoami` 查），没有密码，所以连冒号一起去掉：

```bash
DATABASE_URL=postgres://你的用户名@localhost:5432/social_network npm run migrate up
```

**Windows + Git Bash**：写法同上，但要把密码带上：

```bash
DATABASE_URL=postgres://postgres:你的密码@localhost:5432/social_network npm run migrate up
```

**Windows + CMD**：用 `set`，并且 `&&` 两边不要留空格（否则空格会被算进变量值里）：

```
set DATABASE_URL=postgres://postgres:你的密码@localhost:5432/social_network&&npm run migrate up
```

**Windows PowerShell**：讲师在屏幕上给过一条示例，逐字稿没有逐字念出具体字符，这里给等价写法，执行前请对照你看到的画面：

```powershell
$env:DATABASE_URL="postgres://postgres:你的密码@localhost:5432/social_network"; npm run migrate up
```

Windows 上的密码就是当初装 PostgreSQL 那个向导里让你设的 master password。讲师建议：忘了就先试 `password`。

![p031 03:09 讲师演示不同操作系统下设置 DATABASE_URL 的命令](images/p031_0189s.jpg)

### 3.7 观察输出并验证

成功时终端会打印出「正在执行哪个迁移文件」「执行完成」这类信息（具体措辞随版本略有差异）。然后回 PG Admin：

1. 刷新 `social_network` → `public` → `Tables`，应出现 `comments`；
2. 点开 `comments` 看列，应为 `id`、`created_at`、`updated_at`、`contents`；
3. 还会多一张 `pgmigrations` 表，这是工具自动建的，用来记录「哪些迁移已经跑过、什么时候跑的」，防止重复执行。讲师口述时念作 "PG migrations"，你在界面上看到的实际表名以自己屏幕为准。

![p031 03:38 终端执行 migrate up 成功，迁移被应用](images/p031_0218s.jpg)

### 3.8 重复执行 up 和撤销

再跑一次同样的命令，会提示没有可执行的迁移（讲师的原话是 "没有需要运行的迁移"），因为 `pgmigrations` 里已经有记录了。

把命令末尾的 `up` 换成 `down`：

```bash
DATABASE_URL=postgres://你的用户名@localhost:5432/social_network npm run migrate down
```

`down` 执行的是最近一个迁移的 `down` 段，也就是 `DROP TABLE comments`。回 PG Admin 刷新，`comments` 消失，只剩 `pgmigrations`；再刷新 `pgmigrations` 的数据，里面没有行了——表示当前没有任何已应用的迁移。

> 注意：`DROP TABLE` 会把表和数据一起删掉。这里表是空的所以无所谓，真实项目里这是危险操作，见第 7 节。

### 3.9 生成并写第二个迁移

```bash
npm run migrate create rename-contents-to-body
```

打开新文件，`up` 写重命名列，`down` 写反向重命名。完整文件见第 4 节。

![p032 01:06 第二个迁移文件里用 ALTER TABLE 重命名列](images/p032_0066s.jpg)

### 3.10 执行第二个迁移并观察「补跑」

如果你在 3.8 里执行过 `down`，此时数据库里是没有 `comments` 表的。再跑一次 `up`，工具会按时间戳顺序**把没跑过的迁移全部补上**：先建表，再改名。讲师在 P32 里观察到的正是这个现象——「it looks like that created first the comments table for me and then went ahead and applied that renaming step」。

```bash
DATABASE_URL=postgres://你的用户名@localhost:5432/social_network npm run migrate up
```

回 PG Admin 刷新，`comments` 表回来了，列里没有 `contents`，只有 `body`。

接着演示「一次只退一步」：执行 `down`，只会把 `body` 改回 `contents`，`comments` 表还在；再执行 `up`，又变回 `body`。

![p032 01:20 终端执行 up，两个迁移按时间戳顺序依次被应用](images/p032_0080s.jpg)

---

## 4. 完整代码

### 4.1 `package.json`

```json
{
  "name": "ig",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "migrate": "node-pg-migrate"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "node-pg-migrate": "*",
    "pg": "*"
  }
}
```

说明：`npm init -y` 生成的字段（name/version/description/main/keywords/author/license）保持原样即可，你只需要改 `scripts`。`dependencies` 里写 `*` 是为了不编造版本号——**推荐直接执行 `npm install node-pg-migrate pg`，让 npm 把真实版本写进去**，然后以 `package.json` 里的实际内容为准。

### 4.2 `migrations/<时间戳>_create-table-comments.js`

```js
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE comments (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      contents VARCHAR(240) NOT NULL
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE comments;
  `);
};
```

### 4.3 `migrations/<时间戳>_rename-contents-to-body.js`

```js
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE comments
    RENAME COLUMN contents TO body;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE comments
    RENAME COLUMN body TO contents;
  `);
};
```

### 4.4 执行命令汇总（macOS + Postgres.app 为例）

```bash
# 在 ig/ 目录下
export DATABASE_URL=postgres://你的用户名@localhost:5432/social_network

npm run migrate up      # 应用所有未执行的迁移
npm run migrate down    # 只撤销最近一个迁移
```

`export` 写法是我为了让命令短一点给的，课里讲师用的是「命令前缀」写法：`DATABASE_URL=... npm run migrate up`，只对当条命令生效。两种都可以，但用 `export` 之后**换一个终端窗口就失效了**，需要重新设置。

---

## 5. 逐行解释

### 5.1 迁移文件的外壳

`exports.up = (pgm) => { ... }` 是 CommonJS 语法：把一个函数挂到模块导出对象上，工具在「应用」时调用它。等价的 ESM 写法是 `export const up = (pgm) => { ... }`。参数 `pgm` 是工具传进来的对象，课上只用到它的 `pgm.sql()` 方法。

讲师原话是「this export stuff ... is just plain not important」——重要的是你在里面写了什么 SQL，而不是这层 JavaScript 壳子。对前端来说，可以把它理解成「一个回调函数，工具在正确时机替你调用」。

### 5.2 `pgm.sql()` 与反引号

`pgm.sql(\`...\`)` 把一段字符串原样交给数据库执行。反引号是 JavaScript 的模板字符串，允许多行，所以 SQL 可以像平时写 SQL 一样换行缩进。注意：里面**不要**写 `${...}`，那会被 JS 当插值处理。

### 5.3 建表语句

- `id SERIAL PRIMARY KEY`：`SERIAL` 是「自增整数」，插入时不给值会自动分配；`PRIMARY KEY` 同时意味着唯一 + 非空。PostgreSQL 内部会为它建一个 sequence。
- `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`：带时区的时间戳，不传值时默认取当前时间。前端同学注意：它存的是带时区信息的时刻，不是「一串本地时间字符串」。
- `updated_at` 同上。课上只给了默认值，**没有讲自动更新 `updated_at` 的触发器**，那是另一件事。
- `contents VARCHAR(240) NOT NULL`：最长 240 个字符（PostgreSQL 的 `varchar(n)` 按字符算，不是字节），`NOT NULL` 表示插入时必须提供值。讲师的理由很直白：一条没有正文的评论没有意义。

### 5.4 `DROP TABLE comments;`

`down` 必须精确反做 `up`：建表 ↔ 删表，改列名 ↔ 改回去。这也是为什么讲师反复强调手写：只有你自己写，才知道 `down` 该反做什么。

### 5.5 改名语句

`ALTER TABLE comments RENAME COLUMN contents TO body;` 只改列名，不动数据、不动类型。反向就是 `body` 改回 `contents`。

### 5.6 时间戳前缀

文件名前面的数字是创建时刻，工具按它排序决定执行顺序。所以「建表」必须早于「改表」——你先创建迁移文件，顺序自然就对了。如果两个文件的时间戳相同（同一秒内创建），顺序可能不符合预期，这也是为什么不要手改名去「调整顺序」。

### 5.7 `pgmigrations` 表

工具自动维护，记录已执行的迁移名和执行时间。它相当于「已应用补丁清单」：有记录就跳过，没记录就执行。所以重复 `up` 不会报错，只会提示没有可执行的迁移。

---

## 6. 复现检查清单

按顺序打勾，任何一项不通过就回到对应小节：

- [ ] `node -v`、`npm -v` 都有输出（3.1）
- [ ] `ig/` 下存在 `package.json`、`package-lock.json`、`node_modules/`（3.1）
- [ ] `package.json` 的 `scripts` 里只有 `"migrate": "node-pg-migrate"`，没有残留的 `test`（3.3）
- [ ] `npm run migrate create create-table-comments` 之后 `migrations/` 里出现带时间戳的 `.js` 文件（3.4）
- [ ] 该文件里有 `exports.up` 和 `exports.down` 两个函数（3.4）
- [ ] PG Admin 里能看到 `social_network` 库，且初始 `public` 下没有表（3.2）
- [ ] 设置 `DATABASE_URL` 后执行 `npm run migrate up` 没有报错，输出里出现刚创建的迁移文件名（3.7）
- [ ] PG Admin 刷新后出现 `comments` 和 `pgmigrations` 两张表（3.7）
- [ ] `comments` 的列为 `id`、`created_at`、`updated_at`、`contents`（3.7）
- [ ] `pgmigrations` 里有 1 条记录（3.7）
- [ ] 再执行一次 `up`，提示没有可执行的迁移（3.8）
- [ ] 执行 `down` 后 `comments` 消失，`pgmigrations` 变空（3.8）
- [ ] 第二个迁移 `up` 执行后，`comments` 的列变成 `body`，没有 `contents`（3.10）
- [ ] 执行一次 `down` 后，`body` 变回 `contents`，表还在（3.10）
- [ ] 再执行 `up`，又变回 `body`（3.10）

---

## 7. 课里没讲但你会撞上的

**1）数据迁移怎么做，课里没讲。**
P32 结尾讲师自己把这一点列为开放问题：比如把两列合并成一列、改列的数据类型，都可能需要「搬运/清洗数据」。这一节两个迁移都只动结构、不动数据，所以你没看到 `UPDATE` 语句出现在迁移里。

**2）零停机变更，课里没讲。**
讲师在 P32 结尾明确说还没讨论「能不能做到零停机地改结构」。P27 讲的只是「把不一致窗口压小」，不是消除。真正要做到零停机，通常要把一次变更拆成多步（先加新列、双写、回填、再删旧列），这套流程课里没有展开。

**3）`down` 会丢数据。**
`DROP TABLE` 连数据一起删。这一节表是空的所以安全，但真实项目里「回滚」不等于「无损回滚」。课里没有讨论生产环境该不该允许 `down`。

**4）多实例同时启动时并发跑迁移。**
如果部署了多个 API 实例，每个实例启动都跑一遍 `up`，就可能撞车。课里没讲锁、也没讲只让一个实例跑迁移的做法。用 Node 的类比：这就像多个进程同时写同一个文件，你需要一把「只有一个人能拿到的锁」。

**5）迁移文件写完就不能再改。**
`pgmigrations` 只记录「跑过没跑过」，不校验文件内容。如果你改了已经执行过的迁移文件，工具不会提醒你，别人的库和你的库就会不一致。正确做法是新增一个迁移去修正，而不是改旧文件。课里没讲这一点。

**6）密码不该写死在命令行里。**
讲师把密码直接拼进 `DATABASE_URL` 前缀。这只适合本地练习；`.env` 文件、dotenv 之类的做法课里完全没提。

**7）Windows 上 PowerShell 与 CMD 的写法不同。**
讲师给了四种写法并提醒 `&&` 周围不要空格。如果你在 PowerShell 里用 CMD 的 `set`，变量不会按你期望的方式生效。

**8）ESM 与 CommonJS 的坑。**
如果你生成的模板是 `export const up = ...`，而 `package.json` 里没有 `"type": "module"`，Node 会直接报语法错误。课里用的是 `exports.up` 这种 CommonJS 风格；两种只能选一种，别混着写。

**9）`SERIAL` 与 `TIMESTAMP WITH TIME ZONE` 在 JS 里的样子。**
`pg` 驱动把时间戳读出来通常会给到你一个 `Date` 对象，具体行为以你实际拿到的结果为准；`SERIAL` 对应的自增序列在 `INSERT` 时不返回，需要 `RETURNING` 才能拿到新 id——这些都属于后面查询部分的内容，本节没讲。