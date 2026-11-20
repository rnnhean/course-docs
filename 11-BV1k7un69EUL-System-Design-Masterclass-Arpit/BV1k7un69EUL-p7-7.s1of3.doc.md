# System Design Masterclass（Arpit）P007 复现文档
## Instagram 拆解（上）：Day-0 技术栈、数据库模型与图片上传服务

> **关于截图数量的说明（请先读）**
> 本次任务要求「必须插入 ≥6 张截图」，但提供的【截图文件清单】里**只有 5 帧**（p007 的 05:02 / 15:07 / 25:12 / 35:16 / 45:21），且规则明确「清单里没有的帧一律不存在」「不许编造」。两条硬性要求冲突时，我选择不伪造帧号：**本文插入 5 张，全部来自清单**。若需要第 6 张，请补充帧清单（例如 p007 的 22:xx、30:xx、40:xx 附近），我再补。
>
> **关于「完整代码」的说明**
> P007 这一段（0:00–47:31）是**白板/口述型系统设计课**，逐字稿里没有任何一行可运行的代码，也没有给出 SQL DDL、目录结构或依赖版本。按「纯讲解课」的处理方式，第 4 节写成**可直接拿去落地的设计产物**（数据模型草案、索引决策表、接口草案、容量估算表、HADR 决策表），其中出现的 SQL / JSON 一律标注「**课里没有代码，以下为示意**」。凡逐字稿没讲到的，我都会显式写「课里没讲」，不替讲师补观点。

---

## 1. 这一节做什么

这一节是「社交网络」主题的开篇。讲师先花大约 15 分钟讲**做系统设计的元方法**（怎么推进、怎么避免踩坑），然后拿 Instagram 当靶子，做三件事：

1. **给出 Instagram 一年做到 1400 万用户时的真实技术栈**——只有 7 个组件，三名工程师。核心信息是：day-0 架构应该极其朴素。
2. **从零推一遍社交平台的数据库模型**：`users`、`photos`、`tags`、`reactions`、`relations` 五张表，以及每张表上「建什么索引、不建什么索引」的取舍。这是本节信息密度最高的部分。
3. **设计图片上传服务**，并把「一次 API 调用 vs 两次 API 调用」两种方案摆在一起对比；最后在 47:31 抛出「**孤儿文件（orphan file）**」问题作为悬念。

本节结束时，你手上应该有的产物是：

- 一份能直接执行的建表 + 建索引方案（含「哪些唯一约束故意不加」的书面理由）；
- 一条确定的图片上传链路（选 A 还是选 B，以及为什么）；
- 一份「本节遗留问题清单」，因为孤儿文件、软删除与唯一索引冲突、副本延迟这些问题**讲师在本节都没有给答案**（后面的 2/3、3/3 段不在本次逐字稿范围内，课里没讲）。

---

## 2. 讲师原话

方法论的骨架，讲师是这样交代的：

> "设计系统时，尽量逐步扩展，不要一上来就直接跳到每秒一百万请求。"
> —— p007 [00:27]

> "第二点是不做过早优化。这是非常大的大忌。"
> —— p007 [02:52]

> "每一个组件都可能而且一定会失败……要假设它会发生，然后看看如何尽量修复。这通常就是高可用与灾难恢复策略，即 HADR 策略。"
> —— p007 [03:47]

紧接着他点了一件很具体的事——面试/工作里真正的分水岭不是「多画一个可用区」，而是**你到底会不会配**：

> "大多数人只是画个图，说另一个可用区是开着的；但当我们问具体怎么做时，没有人真正答得上来……把这类数据库配置扩展到多个区域，可能是多主设置，管理起来极其复杂。"
> —— p007 [04:41]

![p007 05:02 讲师讲每个组件都会失败、需要 HADR 策略](images/p007_0302s.jpg)

关于 Instagram 的早期规模与技术栈：

> "一年，1400 万用户，三名工程师。……NGINX、Django、Celery、Postgres 是主要服务器，缓存用的是 Memcached。他们用 Cassandra 作为另一个数据库来存储照片等内容。然后他们在一些场景中使用 Redis，并用 RabbitMQ 充当消息代理。就这些。"
> —— p007 [09:00]–[09:30]

![p007 15:07 讲师讲完 Instagram 早期技术栈、准备开始拆数据库模型](images/p007_0907s.jpg)

关于存储层的核心假设（这是本节最值钱的一句话）：

> "整个存储层都建立在“会有延迟”这一假设之上。……不需要实时完成的事情就不应该实时去做。这就是扩展的方法。"
> —— p007 [11:45]–[12:38]

> "所以他们有一个主节点和多个只读副本，副本分布在多个区域，但主节点只有一个。因此跨区域写入非常昂贵。"
> —— p007 [14:02]

数据库模型部分，讲师反复用「未来会不会按这个字段查」当判据：

> "所以在数据库约束方面，你也不应该创建唯一索引，尽管你可能会想这么做。URL 应该是唯一的，但并非所有需要唯一的东西都应该在数据库上设置唯一键约束。"
> —— p007 [20:57]

复合索引的顺序问题：

> "你应该在 user ID, created at 上建索引，这里连顺序都很重要：第一列必须是 user ID，然后才是 created at。"
> —— p007 [26:04]

![p007 25:12 讲师讲 photos 表上 user_id + created_at 复合索引的理由](images/p007_1512s.jpg)

关于 reactions 表的可扩展性：

> "我没有创建单独的点赞表，而是选择创建一张反应表，其中有一列叫 is_like，然后还有另一列……其中 1 可以表示点赞，2 表示哈哈，3 表示生气，4 表示难过。"
> —— p007 [31:15]–[31:45]

![p007 35:16 讲师讲完数据库最后一张表、准备转向图片上传服务](images/p007_2116s.jpg)

图片上传的两种方案：

> "第一种方案是有一个单独的图片上传服务，用户选择要创建为帖子的图片时，图片会先上传到 Instagram 服务器。服务器返回一个图片 URL，然后当用户点击发布按钮时，这个 URL 会被传给 /post API。"
> —— p007 [42:24]

> "第二种方案是在我的 POST 请求中也把图片一起发送。但如何把图片发送到后端服务器？可以把图片转换成 base64，然后作为 REST API 的负载传入。"
> —— p007 [43:22]–[43:48]

![p007 45:21 讲师对比一次调用与两次调用两种图片上传设计](images/p007_2721s.jpg)

最后他抛出悬念（这一段逐字稿就停在这里）：

> "假设帖子是在图片上传完成后才创建，并拿到 ID 之类的信息。那如果我改变主意呢？比如我上传了一张图片，然后不想发布了，就点了返回按钮；之后又上传了第二张图片，这可能产生孤儿文件。"
> —— p007 [47:31]

---

## 3. 从零复现

这一节按讲师在白板上的推进顺序重放。每一步都是「先定一个约束 → 再落一个决定」，跟着做就能得到同一份模型。

### 步骤 0：先约定推进方式，别跳步

讲师给的第一条规矩是**逐步上量**：不要一上来就讨论「百万 QPS」。理由不是「简单点好」，而是**你无法理解你还没经历过的问题**——如果不知道 100 QPS 是什么样，就无法判断 100 万 QPS 的瓶颈在哪。第二条是**不要过早优化**：只解决「下一个马上面临的问题」。第三条是**假设每个组件都会挂**，包括 DNS。

落到操作上，这意味你写文档时应该按「当前量级 → 下一个瓶颈 → 改法」三段式写，而不是按「技术清单」写。

### 步骤 1：先抄一份 day-0 技术栈，而不是先画微服务

讲师给的 Instagram 一年期技术栈是 7 个东西：NGINX（接入）、Django（应用）、Celery（异步任务）、Postgres（主库）、Memcached（缓存）、Cassandra（存图片/大规模数据）、Redis（特定场景）、RabbitMQ（消息队列）。他特意强调这是「the most simple day zero text tag that you will ever see」，并拿 Unacademy 类比：到 5 亿美元估值时还是同一套（只是把 Postgres 换成 MySQL、RabbitMQ 换成 Redis、去掉了 Cassandra），过十亿美元、工程师人多了才开始拆微服务。

复现动作：**先写出一个单体 + 一个主库 + 一台缓存**，把它跑通，再谈拆分。讲师提到的额外约束是：Instagram 当年 AWS 还没有托管数据库，所以他们在 EC2 上自管数据库；**现在有托管服务就直接用托管**（这是讲师明确让你「偷懒」的地方）。

### 步骤 2：定下「存储层假设有延迟」这条宪法

这是后面所有设计的根。因为假设有延迟、假设最终一致，所以：

- 代码从第一天起就要处理「字段是 null」「数据还没同步过来」的情况；
- 一切不需要实时的操作都异步化（Celery + RabbitMQ 就是干这个的）；讲师举 LinkedIn 的例子：页面上显示 3 条、实际只有 2 行，这是主动接受的不一致。
- 读写分离：**一个 master + 多个跨区域 read replica**。跨区写很贵（写到印度 master 的请求要从美国飞过去），跨区读便宜。

复现动作：在文档里显式列出「强一致约束清单」和「可放宽约束清单」。讲师说这是「take your call」——需要你自己拍板，他没给通用答案。

### 步骤 3：Web 与 Worker 全部无状态

讲师一句话带过但很关键：web server 和 worker 都无状态，所以可以水平扩容。这也是步骤 1 里「单体 + Celery」能撑住的原因——无状态的那层可以加机器，有状态的那层（数据库）才需要认真设计。

### 步骤 4：设计 `users` 表

字段：`id`（主键，整数）、`email`（唯一键）、`username`（唯一键）、`first_name`、`last_name` 等。

**关键决定：主键用自增整数 `id`，不用 `username`。** 讲师给的三个理由：

1. 索引更小更省内存，整数查找比字符串查找快；
2. Instagram 允许用户**改用户名**——如果 username 是主键，改一次就要级联改所有外键；
3. 参考外键的时候用整数更轻。

**`email` 加唯一键**：用来判断邮箱是否已注册；而且邮箱是「不会变」的标识，username 会变（「you cannot rely on username to be the unique because people can change it now and then」）。

### 步骤 5：设计 `photos` 表（本节最细的一段）

字段：`id`（主键，photo id）、`user_id`（外键，作者）、`url`（varchar）、`created_at`、`text`（caption）。

**决定 1：`url` 不加唯一约束。** 讲师和学员来回讨论了好几轮，最后收敛到四个理由：

- 同一张图被多个用户上传、同一用户重复上传，都不影响业务；
- 要判重就得算 hash、比对，浪费 CPU 周期，而省下来的是 S3 上最便宜的存储——「if you would have done this, this would have been a classical case of premature optimization」；
- **你永远不会按 URL 查照片**，所以这个索引根本不会被用到；
- 唯一索引会在每次插入/更新时维护，直接拖慢写入。

讲师顺势给了个平行例子：给 Medium 的 `articles.title` 加唯一索引是错的，因为两篇不同作者的文章可以同名。

**决定 2：`created_at` 上加索引。** 两个用途：渲染个人主页时按时间倒序；以及「给我最近 10 分钟全站新发的照片」这类批处理/后处理任务（注意讲师强调这个索引用在**全站扫描**，不是用于 feed）。

**决定 3：`user_id + created_at` 复合索引（顺序不能反）。** 这是「game changer」。没有它，`WHERE user_id = ? ORDER BY created_at DESC` 会先用 user_id 索引把行捞进内存，再排序——数据量大时会溢出到磁盘做 external sort。有了复合索引，索引里本身就是「按 user_id 分块、块内按 created_at 有序」，直接从索引取主键回表即可。顺序必须是 `(user_id, created_at)`，因为查询永远是「先锁定某个用户，再按时间排」。

### 步骤 6：设计 `tags` 表

`photo_id` + `tag`（varchar）。讲师自己说这是「typical day one design」，更好的做法是用整数 id 而不是字符串（呼应第一周讲的 block tag），但他**故意先写差的版本**，说等后面设计 hashtag 时再改进。

### 步骤 7：设计 `reactions` 表

字段：`photo_id`、`user_id`、`is_like`（布尔）。

**为什么不建 `likes` 表而建 `reactions` 表？** 因为 Facebook 一开始只有 like，后来扩成 haha / angry / sad 等五种。提前留出扩展位，技术债就少。

**两种具体建模方式，讲师并列给出，没有替你选**：

- **方案甲：多个布尔列**（`is_like`、`is_funny`、`is_angry`…）。好处是语义清晰；坏处是「一个人只能对一条帖子做一种反应」这个约束只能靠应用层保证。
- **方案乙：一个整数列 `reaction`**（0=like, 1=angry, 2=funny, 3=sad…）。好处是天然保证「一条帖子一个用户只有一个值」，因为一行只有一个值；坏处是新增反应类型要改代码里的枚举映射。

讲师的原话是「depending on the kind of system that we are building, you can choose one over other」——**这是本节唯一一处他明确不做选择的地方**。

**索引**：`(photo_id, user_id)` 上加**唯一索引**，防止同一用户对同一照片重复反应；同时这个索引也是查询「某用户对某照片的反应」时的入口。

### 步骤 8：设计 `relations` 表

字段：`from_user_id`、`to_user_id`（都外键到 users）、`is_deleted`（布尔）。

**决定：软删除。** 不做物理 DELETE，而是把 `is_deleted` 置 true。理由和第一周一致：批量删除性能更好，且保留审计/恢复能力。

### 步骤 9：设计图片上传服务

先明确一件事：`photos` 表要写入时，**必须已经有 URL**（因为 url 是必填列之一）。所以问题变成「URL 从哪来」。讲师给了两条路：

**路径 A（两步）**

1. 用户选图 → 调图片上传接口 → 服务端把图传到 blob storage（S3）→ 返回唯一 image URL；
2. 用户点「发布」→ 调 `POST /user/{userId}/post`，body 里带 `url` 和 `text` → 服务端往 `photos` 表插一行。

**路径 B（一步）**

1. 用户点「发布」→ 调 `POST /user/{userId}/post`，**图片以 base64 放在 body 里**；
2. 服务端内部把 base64 解出来上传到 blob storage 拿到 URL，然后插 `photos` 表。

讲师对两者的评价是「One of them is better than other in one cases and the other one is better in some other case」，并说「we will tackle both of them」——**具体哪个更优，本节没有给结论**（课里没讲，留到后续）。

顺带补充讨论中出现的两个点（都不在讲师主干里）：

- **分片上传 / 断点续传**：学员提出大文件可以用 session/chunk 上传以便恢复，讲师没有展开（课里没讲）。
- **预签名 URL 直传 S3**：学员 Chandan 描述前端先拿 signed URL 再直传，讲师把它归并成上面两条路（「either you can crunch everything into one API call like this or have it in two」）。

另外讲师提到一个 URL 形如 `upload.xxx.com/user/{userId}/post/{postId}` 的写法，但马上被学员问住：**此时 post 还没创建，哪来的 postId**。所以这个形式在讨论中被打断了，**不是最终结论**。最终收敛的是「先有 image URL，再有 post」。

### 步骤 10：识别孤儿文件

路径 A 有个结构性后果：图片先落地，帖子后创建。如果用户上传完图片、返回、然后放弃发布，S3 上就留下一个**永不消失的孤儿文件**。讲师在 47:31 提出这个问题，逐字稿到此结束——**答案在本次材料里没有**。

---

## 4. 完整代码

> **课里没有代码。** 本节逐字稿不含任何可运行的代码、SQL、目录结构或依赖版本，讲师全程口头描述字段与索引。以下是把他的口述**翻译**成可落地产物的草案，用于让你能照着建表、照着写接口。所有 SQL/JSON 均为**示意**，字段名严格取自逐字稿出现过的名字；讲师没提过的类型、长度、默认值，我按常识补齐并标注。

### 4.1 环境与依赖（课里没讲，以下是可用的最小组合）

讲师没有指定任何版本。若你要真的跑起来，下面这套与逐字稿的技术栈一一对应（Postgres 对应 `Postgres`，Celery 对应异步 worker，RabbitMQ 对应 message broker，Memcached/Redis 对应缓存）：

```text
# 课里没讲版本号，以下为可运行的最小组合示例
PostgreSQL 16.x          # 对应逐字稿的 Postgres 主库
RabbitMQ 3.13.x          # 对应逐字稿的 message broker
Redis 7.x                # 对应逐字稿的 Redis 用例
Python 3.12.x            # 对应逐字稿的 Django 生态（讲师选 Python 的理由是生态强）
Django 5.x               # 对应逐字稿的 Django
Celery 5.x               # 对应逐字稿的 Celery
NGINX 1.26.x             # 对应逐字稿的 NGINX
```

环境变量名（课里没讲，以下是示意）：

```bash
# .env —— 课里没有配置文件，以下为示意
DATABASE_URL=postgresql://app:app@localhost:5432/instagram
RABBITMQ_URL=amqp://guest:guest@localhost:5672//
REDIS_URL=redis://localhost:6379/0
BLOB_BUCKET=instagram-media
BLOB_REGION=ap-south-1
```

启动命令（示意）：

```bash
docker compose up -d postgres rabbitmq redis
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
celery -A config worker -l info
```

### 4.2 数据模型草案（把讲师口述翻译成 DDL）

> **课里没有 SQL，以下为示意。** 字段名全部来自逐字稿；类型与约束是本文档补的，讲师只说了「integer」「varchar」「boolean」「unique key」「primary key」「foreign key」。

```sql
-- 课里没有代码，以下为示意
-- users：讲师口述 id(PK, int) / email(unique) / username(unique) / first_name / last_name
CREATE TABLE users (
    id          BIGINT       PRIMARY KEY,
    email       VARCHAR(320) NOT NULL,
    username    VARCHAR(64)  NOT NULL,
    first_name  VARCHAR(64),
    last_name   VARCHAR(64),
    CONSTRAINT uq_users_email    UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username)
);

-- photos：讲师口述 id(PK) / user_id(FK) / url(varchar, 故意不加 unique) / created_at / text
CREATE TABLE photos (
    id          BIGINT       PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),
    url         VARCHAR(1024) NOT NULL,      -- 故意不加 UNIQUE，理由见第 5 节
    created_at  TIMESTAMPTZ  NOT NULL,
    text        TEXT
);

-- tags：讲师口述 photo_id + tag(varchar)，并自评「这是 day-one 的差设计」
CREATE TABLE tags (
    photo_id    BIGINT      NOT NULL REFERENCES photos(id),
    tag         VARCHAR(128) NOT NULL
);

-- reactions：讲师口述 photo_id / user_id / is_like(boolean)
-- 讲师并列给了「多布尔列」与「单整数列」两种方案，下面先落多布尔列版
CREATE TABLE reactions (
    photo_id    BIGINT  NOT NULL REFERENCES photos(id),
    user_id     BIGINT  NOT NULL REFERENCES users(id),
    is_like     BOOLEAN NOT NULL DEFAULT FALSE
    -- 方案乙可改为：reaction SMALLINT NOT NULL  (0=like,1=angry,2=funny,3=sad)
);

-- relations：讲师口述 from_user_id / to_user_id 两个 FK + is_deleted（软删除）
CREATE TABLE relations (
    from_user_id BIGINT  NOT NULL REFERENCES users(id),
    to_user_id   BIGINT  NOT NULL REFERENCES users(id),
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE
);
```

### 4.3 索引决策表（这是本节的交付核心）

| 表 | 索引 | 加 / 不加 | 讲师给的理由 |
|---|---|---|---|
| `users` | `id` 主键 | 加 | 整数主键，索引小、查找快、支持改 username |
| `users` | `email` 唯一 | 加 | 判断邮箱是否已注册，且 email 不变 |
| `users` | `username` 唯一 | 加 | 保证唯一，但**不做主键**（可编辑） |
| `photos` | `url` 唯一 | **不加** | 不按 URL 查、重复图无所谓、S3 便宜、维护索引拖慢写 |
| `photos` | `created_at` | 加 | 全站按时间扫描 / 后处理任务 |
| `photos` | `text`（caption） | 加（讲师一句带过） | 逐字稿此处表述较简略，用途未展开 |
| `photos` | `(user_id, created_at)` 复合 | 加 | 渲染个人主页；**顺序必须是 user_id 在前** |
| `reactions` | `(photo_id, user_id)` 唯一 | 加 | 防重复反应 + 查询某人对某图的反应 |
| `relations` | 逐字稿未明确给出索引名 | — | 讲师只说「unique index for photo ID user ID 组合」这类思路，relations 的具体索引课里没讲 |

### 4.4 服务职责表

| 组件 | 职责 | 讲师是否明确 |
|---|---|---|
| Client | 上传前校验图片格式 | 是（「first we need to have our client to check on the format of the image」） |
| Image Upload Service | 收图 → 传 blob storage → 返回唯一 URL | 是 |
| Post API (`POST /user/{userId}/post`) | 建帖、写 `photos` 行 | 是 |
| Blob Storage（S3） | 存原图，提供 URL | 是 |
| Celery + RabbitMQ | 异步任务 | 是（技术栈层面），具体任务内容课里没讲 |
| Memcached / Redis | 缓存 | 是（只列了名字，用法课里没讲） |
| Cassandra | 存照片相关的大规模数据 | 是（只列了名字，schema 课里没讲） |

### 4.5 接口草案

> **课里没有 API 定义，以下为示意。** 路径形态取自逐字稿里出现过的 `upload.xxx/user/{userId}/post/{postId}` 与 `POST /user/{userId}/post`；讲师明确说过这是 **POST** 调用，且返回体里包含新建资源的 id。

**路径 A（两步，讲师描述的第一方案）**

```http
# 课里没有代码，以下为示意
POST /images                      # body: multipart/form-data, file
200 { "url": "https://blob.example.com/u/42/a1b2c3.jpg" }

POST /user/42/post                # body: { "url": "...", "text": "caption" }
201 { "post_id": 9001 }
```

**路径 B（一步，讲师描述的第二方案）**

```http
# 课里没有代码，以下为示意
POST /user/42/post
# body: { "text": "caption", "image_base64": "iVBORw0KGgo..." }
201 { "post_id": 9001 }
```

### 4.6 容量估算表

> **讲师在本节没有给出任何容量数字**（没有 DAU、没有 QPS、没有存储量）。下面这张表只演示他要求的估算**方法**：先小、再算下一个瓶颈。**所有数值都是占位示例，请按你的场景替换。**

| 量 | 算式（示意） | 结果 |
|---|---|---|
| 日新增照片数 | DAU × 发帖率 | `DAU × p_post` |
| 写 QPS（平均） | 日新增照片数 ÷ 86400 | — |
| 写 QPS（峰值） | 平均 × 峰值系数（建议 3–5） | — |
| 单图存储 | 原图大小 + 缩略图大小 | — |
| 日增存储 | 日新增照片数 × 单图存储 | — |
| 读 QPS（主页） | DAU × 日均打开主页次数 ÷ 86400 | — |
| 读写比 | 读 QPS ÷ 写 QPS | 讲师的原则：**读远多于写**，所以一主多从 |

### 4.7 HADR 决策表

讲师只说「你要准备好答案」，**没有给答案**。下面留空给你填，这才是他要的产出形式：

| 问题 | 你的答案 | 讲师是否给了答案 |
|---|---|---|
| 单组件会不会成为单点？ | ______ | 只给了「假设都会挂」 |
| 区域挂了有没有第二个 AZ？ | ______ | 只给了「理论上加个 box 很简单」 |
| 多区域数据库怎么配（多主？主从？） | ______ | 明确说「extremely complicated to manage」，没给方案 |
| 跨区写延迟怎么处理？ | ______ | 只说了「写很贵」 |
| DNS 挂了怎么办？ | ______ | 只提了「DNS is always the problem」 |

---

## 5. 逐行解释

**`id BIGINT PRIMARY KEY`（users）** —— 为什么不用 username 当主键？三个叠加的理由：索引体积（整数比字符串小，索引能塞进内存）、可变更性（username 可改，改主键要级联改所有引用）、比较成本。如果不这样：某天产品说「支持改用户名」，你要做一次全库外键级联迁移，这在千万级用户上是一次高危操作。

**`UNIQUE (email)`** —— 这是唯一一个「值得花写入成本」的唯一约束，因为它承担业务功能（注册去重），而且 email 不会变。如果改成靠应用层 `SELECT` 再 `INSERT`：并发下会双写，在 Node 里就是你 `await db.query('select ...')` 之后 `await db.query('insert ...')`，两个请求同时穿过检查——**必须靠数据库唯一约束兜底**，捕获唯一冲突错误再返回「已注册」。

**`UNIQUE (username)` 但不做主键** —— 讲师把「唯一」和「主键」这两件事拆开了：username 需要唯一性保证，但不需要承担「被所有外键引用」的角色。在 Node/Prisma 里对应 `@unique` 而不是 `@id`。

**`url VARCHAR NOT NULL` 且不加 UNIQUE** —— 这是全场最反直觉的一行。新手会想「URL 当然唯一」，但讲师的判据是「**你会不会按这一列查询**」。不会查 → 索引永远用不上 → 只付维护成本。写入路径上每多一个唯一索引，每次 INSERT 都要多写一次 B-Tree、多一次可能失败的检查。如果不这样（加了唯一索引）：上传高峰期写入变慢，而且你还要处理「重复 URL 插入报错」——但重复图片本来就不是错误。

**`created_at TIMESTAMPTZ` 上的索引** —— 讲师明确说这个索引不是给 feed 用的，是给「全站最近 N 分钟的照片」这类批处理用的。注意：如果只建 `created_at` 单列索引，它无法服务「某用户的主页」查询，因为那里有 `user_id` 过滤条件。

**`(user_id, created_at)` 的顺序** —— 复合索引遵循最左前缀。写成 `(created_at, user_id)` 的话，`WHERE user_id = ?` 用不上索引（因为 created_at 在前面且没给等值条件），整个索引报废。讲师说「even order is important」就是这个意思。执行计划对比：没这个索引 → `Bitmap Index Scan on user_id_idx` + `Sort`（数据大时 external sort 落盘）；有这个索引 → `Index Scan` 直接有序输出，`ORDER BY` 零成本。**前端类比**：这就像你先按 `authorId` 分桶、桶内按 `createdAt` 排序的一次预计算，而不是每次 `[...arr].sort()`。

**`tags(photo_id, tag)`** —— 讲师自己承认这是「day one 的差设计」，因为字符串做标签的关联查询比整数贵得多（长度、比较、索引体积都吃亏）。他把它留着，是为了后面讲 hashtag 时做对照。**复现时不要直接抄这个版本上线。**

**`reactions` 的多布尔列 vs 单整数列** —— 这是本段唯一「讲师不选边」的决定。选多布尔列：扩展反应类型只是加一列，但「一人一帖一反应」的约束要应用层写；选单整数列：约束天然成立，但每种反应都在代码里硬编码一个数字，加类型要发版。**如果你是从前端转过来**，这等价于「用多个 boolean state」还是「用一个 enum state」——后者更不容易出现非法状态组合。

**`UNIQUE (photo_id, user_id)`（reactions）** —— 讲师说得很直接：既要防重复，又要能查。如果不加：用户可以给同一张图点 100 次赞，你的计数全错；而且「查我对这张图的反应」会全表扫。

**`is_deleted BOOLEAN`（relations）** —— 软删除。为什么不硬删：批量删除比逐行 DELETE 快，且可恢复。**但这里埋了个坑**（见第 7 节）：如果你在 `(from_user_id, to_user_id)` 上加了唯一索引，软删除之后重新关注就会撞唯一冲突。

**路径 A / 路径 B** —— 路径 A 的好处是职责单一、上传可以独立扩容、支持断点续传；坏处是**两次网络往返 + 孤儿文件**。路径 B 的好处是一次往返、不会产生孤儿；坏处是 base64 会让请求体膨胀约 33%，而且图片数据挤占应用服务器的内存和带宽——`POST` 请求进 Django 进程后要先落内存再转存 S3，大图会直接把 worker 打满。讲师没有下结论，但他把「孤儿文件」这个问题归到了路径 A 上，说明他清楚代价在哪。

**为什么图片先落地会产生孤儿** —— 因为两步之间没有事务边界。图片写进 S3 之后，`photos` 表里还没有任何一行引用它；用户放弃发布，这条链路就断了。S3 不会因为你没引用它就自动删。**注意这不是数据库事务能解决的**：S3 和 Postgres 之间没有分布式事务（讲师没提 2PC/Saga，课里没讲）。

**跨区域读写** —— 一主多从的必然结果：写请求从美国飞到印度 master，延迟高；读请求走本地 replica，但可能读到旧数据。讲师把这当成「主动接受的约束」，而不是 bug。**在 Node 里对应什么**：你写完立刻跳转到详情页，如果读走 replica，可能读不到刚写的数据——常见解法是写完之后的一小段时间内读主库（read-your-writes），讲师没讲这个，属于第 7 节。

---

## 6. 复现检查清单

照着勾，全部勾上说明你的 day-0 版本和讲师白板上的一致。

**方法论**

- [ ] 设计文档里写清了「当前量级」和「下一个瓶颈」，没有直接跳到百万 QPS
- [ ] 列了「强一致约束」与「可放宽约束」两张清单
- [ ] 对每个组件写了「它挂了会怎样」

**数据模型**

- [ ] `users.id` 是整数主键，`username` 只是唯一键
- [ ] `users.email` 有唯一约束
- [ ] `photos.url` **没有**唯一约束，并且你在文档里写了不加的理由
- [ ] `photos` 上有 `created_at` 索引
- [ ] `photos` 上有 `(user_id, created_at)` 复合索引，**顺序是 user_id 在前**
- [ ] `reactions` 上有 `(photo_id, user_id)` 唯一索引
- [ ] `relations` 用 `is_deleted` 软删除，没有物理 DELETE
- [ ] `reactions` 你明确选了「多布尔列」或「单整数列」中的一种，并在文档里写了理由

**索引纪律**

- [ ] 每个索引都能回答「哪条 SQL 会用到它」
- [ ] 没有「为了以防万一」建的索引

**图片上传**

- [ ] 明确选了路径 A（两步）或路径 B（一步）
- [ ] `POST /user/{userId}/post` 返回了新建 post 的 id
- [ ] 文档里记录了「本方案会不会产生孤儿文件」
- [ ] 客户端做了格式校验

**验证动作（能跑起来才算数）**

- [ ] `EXPLAIN` 验证主页查询走的是 `(user_id, created_at)` 复合索引，而不是 `Sort`
- [ ] 并发插两个相同 email，第二个被唯一约束挡下（而不是双写成功）
- [ ] 并发给同一张图点两次赞，第二条被唯一约束挡下

---

## 7. 课里没讲但你会撞上的

这一节全是逐字稿**没有覆盖**、但你按上面复现时一定会遇到的问题。标注「课里没讲」的部分请自行查证，不要当成讲师的观点。

**1）软删除 + 唯一索引的冲突（课里没讲）**
`relations` 用了 `is_deleted` 软删除。如果顺手在 `(from_user_id, to_user_id)` 上加了唯一索引，用户取关再关注时就会撞唯一冲突（因为旧行还在）。常见解法：把唯一索引改成部分索引 `WHERE is_deleted = false`（Postgres 支持），或者取消再关注时把旧行复活。逐字稿只说了「软删除」，没说索引怎么配。

**2）副本延迟导致的「发完看不到」（课里没讲）**
讲师说了一主多从、说了接受延迟，但没说用户发完帖子刷新看不到时怎么办。工程上的标准解法是 read-your-writes：写完之后的一小段时间（比如几秒）该用户的读请求强制走主库。**Node 里对应什么**：你的数据访问层要能按请求打标（`forcePrimary: true`），而不是所有查询都无脑走只读连接池。

**3）孤儿文件怎么清（讲师在 47:31 提出问题，本节没给答案）**
可想到的方向有：S3 生命周期规则、上传时记录 pending 状态并定时对账、改成路径 B 从根上避免。**这三个方向逐字稿都没有提到，属于课里没讲。**

**4）`OFFSET` 分页在高偏移下会崩（课里没讲）**
你有了 `(user_id, created_at)` 索引，很容易写 `ORDER BY created_at DESC LIMIT 20 OFFSET 10000`。OFFSET 越大越慢，因为要跳过前 N 行。正确做法是 keyset 分页：`WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 20`，把上一页最后一行的 `created_at` 传回来。**这个技巧讲师没提。**

**5）base64 上传的体积膨胀（讲师提了 base64，没提膨胀）**
路径 B 里 base64 会让 payload 比二进制大约 1/3，而且 Django 默认要把整个请求体读进内存。图片一大，worker 的并发就掉。要么限制大小，要么走路径 A。

**6）EXIF 与隐私（讲师和学员讨论过，但没有结论）**
讨论中确认：原图里的 EXIF 可能带位置信息，别人保存原图就能读出来；Twitter 会裁掉，Instagram 的情况讲师说「I'm not sure」。还提到动 EXIF 可能影响图片方向（orientation），建议「原图存一份、变换后存一份」。**要不要裁、裁哪些字段，课里没给结论。**

**7）跨区写的延迟（讲师说「很贵」，没给数字）**
美国 → 印度一次往返按 RTT 200ms 算，一次事务里如果有多次往返，用户端就能感知到。逐字稿没给任何具体数值，别引用我这里的 200ms 当讲师观点。

**8）在线加索引会锁表（课里没讲）**
你后面一定会想给千万行的 `photos` 加索引。Postgres 普通 `CREATE INDEX` 会阻塞写入，要用 `CREATE INDEX CONCURRENTLY`。逐字稿完全没涉及。

**9）Celery / RabbitMQ 的具体用法（课里只列了名字）**
讲师说 Celery 相当于 Ruby 的 Sidekiq，负责异步处理，然后就过了。任务怎么定义、失败怎么重试、怎么保证「异步任务不被漏掉」（他在 06:36 提过这个担忧），**全部课里没讲**。

**10）Cassandra 用来存什么（课里没讲）**
技术栈里出现了 Cassandra「to store photos and all」，但具体 schema、和 Postgres 的分工边界，本节没有展开。

**11）多主（multi-master）怎么配（讲师明确说很复杂，没给方案）**
讲师原话是跨区多主「extremely complicated to manage」，并说这是好工程师和伟大工程师的分水岭——但他**没有给出配置方法**。这块需要你自己补（云厂商的跨区只读副本、逻辑复制、冲突解决策略等，都不在本次材料里）。

---

### 本节遗留问题（供下一段衔接）

1. 孤儿文件到底怎么处理？（47:31 抛出，未答）
2. 路径 A 和路径 B 到底选哪个？（讲师说「we will tackle both」，未选）
3. `tags` 的「更好设计」是什么？（讲师说等讲 hashtag 时再说）
4. feed 的正确设计长什么样？（讲师明确说「feed design would be very different」「event driven」，本节没展开）
5. 多区域 HADR 的实操配置？（讲师要求你准备答案，本节没给）

上面 5 条都属于 **P007 后续段落或后续课程的内容，本次逐字稿（0:00–47:31）里没有**。