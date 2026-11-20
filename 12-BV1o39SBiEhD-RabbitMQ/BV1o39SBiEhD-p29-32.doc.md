# RabbitMQ 逻辑隔离与最小权限实操：vhost、用户、权限正则、插件与 tracing

> 适用范围：本文对应课程 P29–P32。P29 是上一节消息模型/可靠性内容的总结，并预告下一节进入 RabbitMQ 管理；真正可操作的是 P30–P32：virtual host、认证与授权、用户权限正则、管理 UI tags、`rabbitmqctl` 命令行、插件启停与 tracing。  
> 说明：逐字稿里有些名字被转写成 `picker queue`、`pico queue`、`PQQ`、`RevitMQ`，本文为可复现统一写成 `pika_queue`、`RabbitMQ`。如果你的管理 UI 里实际名字不同，权限正则跟着改即可。课里没有指定 RabbitMQ 镜像版本、Docker Compose、Node 客户端；下面凡是这些补充内容，都会明确标成“课里没讲，本文为复现补充”。

---

## 1. 这一节做什么

这一节不是写业务代码，而是在单机 RabbitMQ 上搭出一套“能隔离、能限制、能验证”的管理结构。你要完成的事情可以串成一条线：

1. 启动一个带管理 UI 的 RabbitMQ 服务；
2. 创建一个 virtual host，用它把某一组应用和默认 `/` 隔离；
3. 创建应用用户，给它最小权限；
4. 用权限正则把该用户限制在 `pika_queue` 这个名字上；
5. 在管理 UI 里用带 `management` tag 的用户登录，验证“看得到但改不了”；
6. 用 `rabbitmqctl` 从命令行复现同样的用户/权限创建；
7. 创建 `pika_queue` 队列、同名 direct exchange 和绑定；
8. 启用 `rabbitmq_tracing` 插件，发一条消息，看到 tracing 记录；
9. 最后禁用插件并清理环境。

这条顺序不是随便排的：vhost 必须先存在，后面的权限才有“作用域”；用户必须先创建，`set_permissions` 才有对象；应用用户和 UI 验证用户要分开，否则你会把“能登录后台”和“能读写消息”混在一起；tracing 要放在队列、exchange、binding 都验证通过之后，否则你看到“没有 tracing 记录”时，很难判断是插件问题还是消息根本没进队列。每条命令执行后都应该用 `list_vhosts`、`list_users`、`list_permissions` 或管理 UI 做一次确认，而不是一口气跑完再猜哪一步错了。

从排查角度看，最常见的错误是“在默认 `/` 里建了队列，却用 `app_vhost` 去连接”，表现通常是应用侧找不到队列或权限被拒。还有一个常见误区是把前端界面上的按钮隐藏当成安全措施；管理 UI 隐藏按钮只是体验层，真正的权限仍由 RabbitMQ 服务端根据 vhost、用户和 `configure/read/write` 正则判断。前端路由守卫、按钮禁用都不能替代服务端授权。

P29 讲师总结说，前面讲了 queues、declare/find、properties、RPC、PubSub、publish/subscribe 与 fire-and-forget 的差异，以及可靠性；下一节进入 RabbitMQ queue management，包括 virtual host、access control、插件、HTTP API、运行时配置。本文只覆盖 P30–P32 的管理部分，不把 P29 的总结扩写成新内容。

![p030 00:09 讲师讲解 virtual host 的逻辑隔离](images/p030_0009s.jpg)

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

下面引用逐字稿中的关键原话，保留英文原句，后面用中文说明它在实操里的含义。

> "虚拟主机用于逻辑隔离……每个虚拟主机在 RabbitMQ 代理服务器中都是一个完整且相互隔离的 RabbitMQ 实例。"
> —— p030 [00:00]

讲师强调 vhost 是逻辑隔离：一个 broker 里可以看起来有多个“小 RabbitMQ”。注意这不是多进程，而是同一服务端内的隔离边界。你创建 `app_vhost` 后，里面的 exchange、queue、用户权限都跟默认 `/` 分开。实践上要特别记住：连接时必须指定 vhost，管理 UI 右上角也必须切到对应 vhost；否则你在 `/` 里看到的队列和 `app_vhost` 里的队列不是同一套东西。跟前端类比，它更像“同一后端服务里的租户/环境命名空间”，但隔离和鉴权都在服务端完成，不是前端切个下拉框就能保证安全。

> "身份验证是证明你是谁的过程……授权则是判断你是否被允许执行某项操作或访问给定资源。"
> —— p030 [00:52]

认证是“你是谁”，授权是“你能做什么”。在 RabbitMQ 里，用户负责认证；`configure/read/write` 权限负责授权。这里要把两件事分开排查：用户登录失败通常是用户名、密码、tag 或 vhost 问题；登录成功但发不了消息、建不了队列，则要查该用户在目标 vhost 下的权限正则。tgas 只影响管理 UI 插件，不会自动给数据面权限；反过来，数据面权限也不会让用户自动获得管理 UI 入口。

![p030 00:43 讲师对比认证与授权](images/p030_0043s.jpg)

> "权限通过正则表达式设置，并针对每种不同的访问权限分别设置，包括配置、读取和写入权限。"
> —— p031 [00:00]

权限不是给某个队列点一下复选框，而是给 `configure`、`read`、`write` 三类操作各写一个正则。课程示例是把正则限制到 `pika_queue` 这类名字上。这里要理解成“服务端按资源名做匹配”，不是前端表单校验；正则是 RabbitMQ 服务端使用的，不是 JavaScript 的 `/.../` 字面量，写进命令时不要加斜杠。常用 `^...$` 是为了把匹配锚定在整串名字上，避免 `pika_queue_xxx` 这类名字被误匹配。

> "标签仅用于管理界面插件……管理界面只应提供给人类用户使用。"
> —— p031 [00:00] / p031 [01:20]

tags 只影响管理 UI 插件。应用用户不应该随便给 `management`，否则它可能登录后台改配置。讲师建议只给人使用管理 UI 的账号加 tag。排查时也要注意：一个用户没有管理 tag，不代表它不能连 AMQP；它可能仍然可以按权限消费/发布，只是不能进管理 UI。跟前端对照，管理 tag 像“后台管理页面的入口权限”，而 `configure/read/write` 像“后端 API 的资源级 ACL”，两者不能混为一谈。

> "rabbitmq-plugins 提供 enable、disable 和 list 等操作……跟踪插件会监听我们绑定到的任何队列，并检查所有消息。"
> —— p032 [00:00] / p032 [00:56]

插件用 `rabbitmq-plugins` 管理。tracing 插件可以绑定队列并记录消息，用于观察消息是否到达；讲师也提醒插件可能带来性能开销，生产只开需要的。常见错误是启用插件后没有刷新或重新登录管理 UI，就以为入口没出现；也可能是 trace 绑定了错误的 vhost/queue，导致你发布的消息没有被记录。跟前端调试类比，tracing 有点像服务端的“网络面板/消息抓包”，但它有运行时成本，不应该长期无脑开着。

---

## 3. 从零复现

### 3.1 目录与前置条件

你需要本机有 Docker 与 Docker Compose。本文用如下目录：

```text
rabbitmq-course/
├── docker-compose.yml
├── .env
└── scripts/
    ├── 01-bootstrap.sh
    └── 99-down.sh
```

课里使用的是带 management 插件的 RabbitMQ Docker 镜像；课里没有指定具体版本。本文为可复现锁定 `rabbitmq:3.13.7-management`，如果你的环境拉不到这个 tag，改成 `rabbitmq:3.13-management` 或你本地可用的 management 镜像即可。这个版本选择是复现补充，不是讲师原话。

执行前先确认 `docker --version` 和 `docker compose version` 能正常输出版本；如果命令不存在，先解决 Docker/Compose 安装问题，不要继续往下跑脚本。常见错误是把旧版 `docker-compose` 和本文的 `docker compose` 混用，或者当前用户没有权限访问 Docker daemon。跟前端本地开发类比，这一步相当于先保证本地后端服务能启动，再谈接口联调。

### 3.2 启动 RabbitMQ 并打开管理 UI

在项目根目录执行：

```bash
docker compose up -d
docker compose ps
```

浏览器打开：

```text
http://localhost:15672
```

默认登录：`guest / guest`。注意 `guest` 默认只允许本机访问；我们通过 Docker 映射到 localhost，所以本机浏览器可以登录。课里没有展开这个限制，但这是常见坑。`docker compose up -d` 是后台启动，`docker compose ps` 用来确认容器状态和端口映射；如果 UI 打不开，先看 `docker compose logs rabbitmq`，再检查 15672 是否被其他进程占用。

验证时不要只看命令返回成功，要看 `docker compose ps` 里容器是否处于运行状态、端口是否映射出来。如果容器反复退出，通常是镜像拉取失败、配置错误或宿主机端口冲突。跟前端对照，这相当于启动本地 mock 服务后先看端口是否监听，再打开浏览器。

### 3.3 创建 vhost 与用户

执行本文后面的 `scripts/01-bootstrap.sh`。它会：

- 创建 vhost：`app_vhost`；
- 创建应用用户：`from_cli / pass123`，无管理 UI tag；
- 给 `from_cli` 设置权限正则 `^pika_queue$`；
- 创建 UI 验证用户：`ui_viewer / pass123`，tag 为 `management`，只有读权限；
- 为教学方便给 `guest` 在 `app_vhost` 全权限，方便你先在 UI 里建队列。生产不要这样做。

执行：

```bash
chmod +x scripts/01-bootstrap.sh
./scripts/01-bootstrap.sh
```

脚本最后会打印 vhost、用户、权限列表。你不需要记住具体输出列名，只要看到 `app_vhost`、`from_cli`、`ui_viewer` 和对应权限记录即可；如果你用的 RabbitMQ 版本输出列名不同，以实际输出为准。

这里最容易撞上的错误是“脚本从错误目录执行”或“`.env` 没被正确读取”。脚本里的 `cd "$(dirname "$0")/.."` 就是为了让你在任意目录执行时仍回到项目根目录；`source .env` 则要求 `.env` 存在且语法正确。如果 `set_permissions` 报用户不存在，检查 `add_user` 是否因为密码不合规或参数顺序错误失败；如果权限记录为空，检查 `.env` 里正则的引号是否被错误保留。这个脚本相当于前端的 seed 脚本：它负责把本地环境初始化到可复现状态，但生产环境不应把教学便利权限带进去。

### 3.4 在管理 UI 创建队列、exchange、binding

用 `guest / guest` 登录 `http://localhost:15672`，右上角把 virtual host 切到 `app_vhost`。

1. 创建队列：`Queues and Streams` → `Add a new queue` → name 填 `pika_queue`。其他参数课里没讲，保持默认即可。
2. 创建 exchange：`Exchanges` → `Add a new exchange` → name 填 `pika_queue`，type 选 `direct`，其他保持默认。
3. 创建绑定：进入 exchange `pika_queue` → `Bindings` → To queue 填 `pika_queue`，Routing key 填 `pika_queue` → Bind。
4. 发布测试消息：进入 queue `pika_queue` → `Publish message` → payload 填 `hello from pika_queue` → Publish。

这一段的常见排查点是：第一，确认右上角 vhost 真的是 `app_vhost`，不是 `/`；第二，exchange 类型必须选 `direct`，否则 routing key 的匹配语义会变；第三，binding 的 routing key 要和发布时使用的 routing key 一致，本文两边都用 `pika_queue`；第四，创建动作要用有权限的用户，`ui_viewer` 只有读权限，不能拿来建队列。跟前端路由对照，exchange 像路由入口，binding 像路由规则，routing key 像请求路径或路由键，三者任何一处不一致，消息就会“看起来发了但没进目标队列”。

![p031 00:11 权限用正则表达式设置](images/p031_0011s.jpg)

### 3.5 验证最小权限：能读，不能乱建

退出 `guest`，用 `ui_viewer / pass123` 登录。这个用户有 `management` tag，所以能进管理 UI；但它的 `configure` 和 `write` 是空权限，只有 `read` 匹配 `^pika_queue$`。

你应该能观察到：

- 能看到 `pika_queue` 相关消息/队列内容；
- 尝试创建新队列或新 exchange 会被拒绝；
- 尝试修改/绑定不属于 `pika_queue` 权限范围的对象也会被拒绝。

逐字稿里讲师就是用这种方式演示“管理 UI tag 能让你看见界面，但权限正则决定你能不能动手”。课里没有给出具体错误码，本文也不编造错误码；你看到“access refused / not permitted”一类提示时，以你当前版本 UI 文案为准。

如果 `ui_viewer` 登录不了，先查它是否有 `management` tag；如果登录后看不到 `pika_queue`，先查 `read` 正则是否写成了完全匹配 `^pika_queue$` 并且 vhost 是否选对；如果它居然能创建队列，先确认你是不是还登录着 `guest`，或者脚本是否误给了 `configure` 权限。跟前端对照，UI 上按钮灰掉不等于服务端拒绝，真正安全的验证方式是尝试操作并观察服务端返回。

![p031 00:34 管理 UI 的 tags 选项](images/p031_0034s.jpg)

![p031 00:57 创建用户与设置权限的界面](images/p031_0057s.jpg)

### 3.6 用 CLI 再创建/查看一遍

逐字稿在 P31 后段切到命令行：进入 Docker 容器，用 `rabbitmqctl` 的 `add_user`、`set_permissions` 等命令。本文的脚本已经替你做了。你也可以手动执行：

```bash
docker compose exec -T rabbitmq rabbitmqctl list_vhosts
docker compose exec -T rabbitmq rabbitmqctl list_users
docker compose exec -T rabbitmqctl list_permissions -p app_vhost
```

上面最后一行是错误示例，正确写法是：

```bash
docker compose exec -T rabbitmq rabbitmqctl list_permissions -p app_vhost
```

注意：逐字稿口述 `add_user` 时提到 `-p` 指定 virtual host；实际 `rabbitmqctl add_user` 只接收用户名和密码，vhost 是在 `set_permissions -p <vhost>` 里指定的。你复现时以 `rabbitmqctl help` 为准，不要照抄口述里的 `-p` 到 `add_user` 后面。

这里的错误示例很有价值：`docker compose exec -T` 后面必须先是服务名 `rabbitmq`，再是要在容器里执行的命令 `rabbitmqctl`；少了 `rabbitmq` 就会变成让 Docker 去找一个不存在的命令或服务。另一个常见错误是把 `-p` 放错位置：它属于 `set_permissions`/`list_permissions` 这类需要 vhost 的子命令，不属于 `add_user`。跟前端 CLI 对照，这就像 `npm run` 和脚本参数的位置，参数挂错一层就会完全变义。

![p031 01:20 管理 UI 中验证队列权限](images/p031_0080s.jpg)

![p031 03:14 使用 rabbitmqctl 创建用户和设置权限](images/p031_0194s.jpg)

### 3.7 启用 tracing 插件并观察消息

逐字稿 P32 用 `rabbitmq-plugins` 演示：

```bash
docker compose exec -T rabbitmq rabbitmq-plugins list
docker compose exec -T rabbitmq rabbitmq-plugins enable rabbitmq_tracing
```

然后回到管理 UI，刷新页面，在 `Admin` 区域能看到 tracing 相关入口。创建一个 trace，名字例如 `trace_one`，绑定到 `pika_queue`，再向 `pika_queue` 发一条消息，就能在 tracing 日志里看到该消息的记录。

观察完再禁用：

```bash
docker compose exec -T rabbitmq rabbitmq-plugins disable rabbitmq_tracing
```

禁用后 UI 可能仍显示旧页面，刷新或重新登录后再看。逐字稿也提醒：插件有性能开销，生产只保留真正需要的。

排查 tracing 时，先看 `rabbitmq-plugins list` 里插件是否真的 enabled；再看管理 UI 是否刷新/重登；再看 trace 是否绑定到你发布消息的同一个 vhost 和队列；最后确认消息发布时 routing key 能进 `pika_queue`。如果前面 binding 就不对，tracing 当然看不到目标队列消息。跟前端抓包对照，tracing 是服务端观察工具，不是消息可靠性保证本身。

![p032 00:09 rabbitmq-plugins 查看插件列表](images/p032_0013s.jpg)

![p032 00:43 tracing 插件记录消息](images/p032_0040s.jpg)

### 3.8 清理

```bash
./scripts/99-down.sh
```

它会执行 `docker compose down -v`，连数据卷一起删除，避免下次启动还残留用户/权限/vhost。只执行 `docker compose down` 不删卷，容器虽然没了，但命名卷里的 RabbitMQ 状态还在，下次启动可能继续看到旧用户和旧 vhost。跟前端清理本地数据库类似，清理脚本要明确是否删数据；本文为了复现干净，选择连卷一起删。

---

## 4. 完整代码

下面文件都可以直接保存运行。再次说明：Docker Compose、`.env`、等待健康检查、`ui_viewer`、给 `guest` 授权这些是“课里没讲，本文为可复现补充”；`rabbitmqctl add_vhost/add_user/set_permissions/list_*`、`rabbitmq-plugins` 是课程 P31–P32 讲到的命令方向。

### 4.1 `docker-compose.yml`

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13.7-management
    container_name: rabbitmq-course
    hostname: rabbitmq-course
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

volumes:
  rabbitmq-data:
```

这份 Compose 的关键点是镜像带 management、5672 给 AMQP、15672 给管理 UI、环境变量保留默认用户、命名卷持久化状态。保存后如果 `docker compose up -d` 失败，先看镜像 tag 是否能拉取，再看端口是否被占用。

### 4.2 `.env`

```bash
RABBITMQ_VHOST=app_vhost
RABBITMQ_APP_USER=from_cli
RABBITMQ_APP_PASS=pass123
RABBITMQ_UI_USER=ui_viewer
RABBITMQ_UI_PASS=pass123
RABBITMQ_PERM_REGEX='^pika_queue$'
```

`.env` 里正则用单引号包住，是为了让 `source` 读到字面量 `^pika_queue$`，而不是让 shell 提前展开特殊字符。不要把正则写成 `/^pika_queue$/`，那是 JavaScript 字面量习惯，RabbitMQ 命令里不需要斜杠。

### 4.3 `scripts/01-bootstrap.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source .env

docker compose up -d

until docker compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; do
  sleep 1
done

docker compose exec -T rabbitmq rabbitmqctl add_vhost "$RABBITMQ_VHOST" 2>/dev/null || true

docker compose exec -T rabbitmq rabbitmqctl set_permissions -p "$RABBITMQ_VHOST" guest ".*" ".*" ".*"

docker compose exec -T rabbitmq rabbitmqctl add_user "$RABBITMQ_APP_USER" "$RABBITMQ_APP_PASS" 2>/dev/null || true
docker compose exec -T rabbitmq rabbitmqctl set_user_tags "$RABBITMQ_APP_USER"
docker compose exec -T rabbitmq rabbitmqctl set_permissions -p "$RABBITMQ_VHOST" "$RABBITMQ_APP_USER" "$RABBITMQ_PERM_REGEX" "$RABBITMQ_PERM_REGEX" "$RABBITMQ_PERM_REGEX"

docker compose exec -T rabbitmq rabbitmqctl add_user "$RABBITMQ_UI_USER" "$RABBITMQ_UI_PASS" 2>/dev/null || true
docker compose exec -T rabbitmq rabbitmqctl set_user_tags "$RABBITMQ_UI_USER" management
docker compose exec -T rabbitmq rabbitmqctl set_permissions -p "$RABBITMQ_VHOST" "$RABBITMQ_UI_USER" "" "$RABBITMQ_PERM_REGEX" ""

echo "---- vhosts ----"
docker compose exec -T rabbitmq rabbitmqctl list_vhosts

echo "---- users ----"
docker compose exec -T rabbitmq rabbitmqctl list_users

echo "---- permissions in ${RABBITMQ_VHOST} ----"
docker compose exec -T rabbitmq rabbitmqctl list_permissions -p "$RABBITMQ_VHOST"
```

这个脚本不是“跑完就万事大吉”，它的末尾输出就是让你逐项核对 vhost、用户、权限是否落地。`2>/dev/null || true` 只应该吞掉“对象已存在”这类可预期错误；如果后面 `set_permissions` 失败，仍然要回到前面检查用户和 vhost 是否真的创建成功。

### 4.4 `scripts/99-down.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose down -v
```

这个脚本只做清理，不保留数据。你如果还要保留 trace 日志或权限配置，就不要执行它，或者先备份数据卷。

---

## 5. 逐行解释

`docker-compose.yml` 里，`image: rabbitmq:3.13.7-management` 是带管理 UI 插件的镜像；课程说他们使用的是 management Docker 镜像，但没有指定版本。`ports` 把 AMQP 的 5672 和管理 UI 的 15672 暴露到宿主机。`RABBITMQ_DEFAULT_USER/PASS` 让默认用户仍是 `guest/guest`，方便按课程 UI 复现。`volumes` 让 RabbitMQ 数据持久化到命名卷，重启容器不丢 vhost/用户/权限。常见错误是镜像 tag 拉不到、宿主机端口被占用、修改了默认账号却仍用 `guest/guest` 登录；跟前端本地开发对照，这相当于本地服务配置，配置错时先看容器日志和端口映射，不要直接怀疑业务代码。

`.env` 里，`RABBITMQ_VHOST=app_vhost` 是本节要创建的隔离边界；`RABBITMQ_APP_USER=from_cli` 对应课程里从命令行创建的用户；`RABBITMQ_PERM_REGEX='^pika_queue$'` 是权限正则，`^` 和 `$` 把匹配锚定到整串，避免 `pika_queue_xxx` 被意外匹配。注意：权限正则是 RabbitMQ 服务端用的，不是 JS 正则；写法类似，但不要加 `/.../`。如果你在 `.env` 里加了多余空格、中文引号或反斜杠，脚本传给 `set_permissions` 的就不是预期正则，表现可能是“用户存在但什么也读不到/写不了”。

`01-bootstrap.sh` 的 `set -euo pipefail` 让脚本遇到错误立即停止，避免“用户没创建成功但后面还在跑”。`source .env` 读取变量。`docker compose up -d` 启动容器。`rabbitmq-diagnostics -q ping` 是本文补充的等待逻辑，课程没讲；它的作用是等 broker 真正可用再执行 `rabbitmqctl`。如果没有这段等待，容器刚启动时 `rabbitmqctl` 可能连接失败，脚本看起来像权限命令有问题。`add_vhost` 创建 vhost；重复执行会失败，所以用 `2>/dev/null || true` 忽略“已存在”的情况。给 `guest` 在 `app_vhost` 设 `.* .* .*` 是为了让你能先用 `guest` 在 UI 里创建队列、exchange、binding；这是教学便利，生产应删除。

`set_user_tags "$RABBITMQ_APP_USER"` 不传 tag，表示这个应用用户没有管理 UI tag；按逐字稿的说法，tags 只用于管理 UI，应用用户不该有。`set_permissions -p "$RABBITMQ_VHOST" "$RABBITMQ_APP_USER" "$RABBITMQ_PERM_REGEX" "$RABBITMQ_PERM_REGEX" "$RABBITMQ_PERM_REGEX"` 的三个正则依次对应 `configure`、`read`、`write`。这里三个都限制到 `pika_queue`，所以该用户只能在 `app_vhost` 里对匹配这个名字的资源做配置、读、写。如果写成没有 `^...$` 的 `pika_queue`，名字包含该子串的其他资源也可能被匹配到，最小权限就不再“最小”。

`ui_viewer` 那行 `set_user_tags ... management` 让它能登录管理 UI；后面权限传 `"" "$RABBITMQ_PERM_REGEX" ""`，表示 configure 空、read 匹配、write 空，用于验证“看得到但改不了”。空字符串在 RabbitMQ 权限里表示不给该类权限；如果你在 UI 里看到空列，不要以为是脚本没执行。排查时可以用 `list_permissions -p app_vhost` 对照：如果 `configure`、`write` 列是空的，说明空权限已写入，而不是“权限未设置”的中间状态。

从测试角度，`from_cli` 是数据面应用用户，适合验证 AMQP 连接和消息收发；`ui_viewer` 是管理面观察用户，适合验证管理 UI tag 与只读权限。两者不要合并成一个“又省事又能用”的管理员账号，否则你既测不出最小权限，也容易把生产账号权限放大。跟前端对照，这类似“业务 API 账号”和“后台只读运营账号”分离，前端页面能否显示按钮不能替代后端权限校验。

`99-down.sh` 的 `docker compose down -v` 会删除容器和命名卷。只执行 `down` 不删卷，下次启动用户、vhost、权限还在，容易让你误以为“重新开始但结果不对”。如果你发现脚本重复执行时没有报错、但旧状态仍在，先检查卷是否被保留，再决定是否需要 `down -v`。

---

## 6. 复现检查清单

- [ ] `docker compose ps` 能看到 `rabbitmq-course` 处于运行状态。验证：`STATUS` 应为运行中，且 5672/15672 端口有映射；如果不是，先看 `docker compose logs rabbitmq`。
- [ ] 浏览器能打开 `http://localhost:15672`，`guest/guest` 能登录。验证：登录后能看到管理 UI 首页；如果打不开，先查端口占用和容器状态。
- [ ] 右上角 virtual host 下拉里能看到 `app_vhost`。验证：切换下拉后页面上下文变成 `app_vhost`；看不到就回查 `list_vhosts` 和脚本输出。
- [ ] `rabbitmqctl list_vhosts` 输出里有 `app_vhost`。验证：逐行核对输出，不要只看脚本 `echo`；没有则重跑创建 vhost 的命令并看报错。
- [ ] `rabbitmqctl list_users` 输出里有 `from_cli` 和 `ui_viewer`。验证：确认两个用户名都存在；缺少哪个就查对应的 `add_user` 是否失败。
- [ ] `rabbitmqctl list_permissions -p app_vhost` 能看到 `from_cli` 的权限记录；具体列名以你的版本输出为准。验证：确认 vhost 是 `app_vhost`，并核对三个权限列是否按预期出现；不要拿 `/` 的权限输出代替。
- [ ] 用 `ui_viewer/pass123` 能登录管理 UI，但创建新队列/新 exchange 被拒绝。验证：先确认登录用户名不是 `guest`，再尝试创建一个新队列，观察服务端拒绝提示；如果能创建，查它的 `configure/write` 是否误配。
- [ ] 在 `app_vhost` 里成功创建 `pika_queue` 队列。验证：`Queues and Streams` 中能看到该队列，且页面右上角 vhost 是 `app_vhost`；失败时先查当前用户是否有创建权限。
- [ ] 成功创建 `pika_queue` direct exchange，并绑定到 `pika_queue` 队列，routing key 为 `pika_queue`。验证：进入 exchange 的 Bindings 列表，确认 To queue 和 Routing key 都是 `pika_queue`，类型是 `direct`。
- [ ] 能向 `pika_queue` 发布一条测试消息。验证：发布后回到队列页，看消息计数或 Get messages；没有消息就查 exchange、routing key、binding 三者是否一致。
- [ ] `rabbitmq-plugins list` 能看到插件列表；`rabbitmq-plugins enable rabbitmq_tracing` 后管理 UI 出现 tracing 入口。验证：命令输出里确认插件状态，UI 刷新/重登后再看 `Admin` 区域；没有入口先查插件是否 enabled。
- [ ] 创建 trace 并发布消息后，tracing 记录里能看到消息。验证：确认 trace 绑定的是 `app_vhost` 下的 `pika_queue`，再向同一队列发布一条易识别 payload；没有记录就回查绑定和发布路径。
- [ ] 执行 `rabbitmq-plugins disable rabbitmq_tracing` 后刷新/重登，tracing 入口消失或不可用。验证：先看 `rabbitmq-plugins list` 状态，再刷新 UI；不要仅凭旧页面判断。
- [ ] 执行 `./scripts/99-down.sh` 后容器和卷被删除，再次启动是干净环境。验证：`docker compose ps` 不再显示容器，`docker volume ls` 里对应卷消失；再启动时应重新创建 vhost/用户/权限。

---

## 7. 课里没讲但你会撞上的

| 现象 | 原因 | 怎么办 |
|---|---|---|
| `guest` 在远程机器登录 15672 失败，或本机可以、远程不可以 | `guest` 默认只允许本机访问；课程直接用 management 镜像和 UI，没有展开这个限制 | 本文通过 localhost 映射规避；远程访问时不要依赖 `guest`，创建有 management tag 的人类用户，或按你的环境安全要求调整。 |
| 照口述在 `add_user` 后面加 `-p` 报参数错误 | 逐字稿口述在 `add_user` 时说用 `-p` 指定 vhost，但实际 vhost 是 `set_permissions -p <vhost>` 的参数 | 以 `rabbitmqctl help` 为准；`add_user` 只接用户名和密码，vhost 放到 `set_permissions`/`list_permissions` 的 `-p` 后面。 |
| 应用用户 `from_cli` 连不上管理 UI 或登录被拒 | 无 tag 的应用用户不能登录管理 UI；它适合被应用连接使用，不适合打开 15672 | 要验证 UI 就用本文的 `ui_viewer`，并且只给读权限；不要把应用用户随手加 `management`。 |
| 用户明明有 `pika_queue` 权限，却能访问名字包含它的其他资源 | 只写 `pika_queue` 可能匹配到包含它的其他名字；课程用 `^...$` 的思路锚定 | 本文的 `.env` 已加锚定；检查权限正则是否为 `^pika_queue$`，不要写成 JS 的 `/.../` 形式。 |
| 以为 `ui_viewer` 的 `configure/write` 是“没设置”，所以它应该能建队列 | 空权限不是“没设置”；`configure` 或 `write` 传空字符串，表示该类操作不允许 | 用 `list_permissions -p app_vhost` 核对权限列；UI 上空白列不要误判，实际行为以服务端拒绝/允许为准。 |
| 启用 tracing 后 UI 看不到入口，或禁用后入口还在 | 插件启用后 UI 需要刷新/重登；P32 讲师也演示了刷新、退出再登录后 tracing 入口消失/出现 | 先执行 `rabbitmq-plugins list` 看状态，再刷新或重新登录管理 UI；不要以为命令没生效。 |
| tracing 开着时系统变慢或消息吞吐受影响 | 逐字稿明确提醒插件会带来 drain on performance；生产只开需要的插件 | 观察完就执行 `rabbitmq-plugins disable rabbitmq_tracing`；生产只保留真正需要的插件。 |
| 反复实验后发现旧用户、旧 vhost、旧权限还在 | Docker 卷会保留权限状态；`docker compose down` 不删卷，`down -v` 才删 | 要干净环境就执行本文的 `99-down.sh`；只做 `down` 时先检查命名卷是否仍存在。 |
| Node/前端侧连接 `app_vhost` 时提示找不到队列或权限被拒 | RabbitMQ 的 vhost 不是数据库 schema，也不是 JS 里的锁；它是 broker 内部的隔离边界，连接串和权限都要对 | 连接串要带 vhost，例如 `amqp://from_cli:pass123@localhost:5672/app_vhost`；先查用户是否在目标 vhost 有 `configure/read/write`，再查队列/exchange 名字是否被正则覆盖。 |
| 以为前端隐藏按钮或路由守卫已经实现了权限隔离 | 管理 UI 隐藏按钮只是体验层，真正的权限由服务端 vhost、用户和权限正则判断 | 用服务端命令和 UI 实际操作验证；不要信任前端可见性，生产权限必须在 RabbitMQ 侧配置正确。 |
| 应用里想靠 JS 单线程 mutex 解决消费并发/顺序问题 | 并发消费在 Node 里通常靠多进程/多实例和 broker 的投递模型处理，不是靠 JS 单线程 mutex 解决；本课没有展开消费者并发 | 先把 vhost、用户、权限、队列和 binding 排查清楚；并发消费设计需要另开主题，按 broker 投递模型和业务幂等性处理。 |