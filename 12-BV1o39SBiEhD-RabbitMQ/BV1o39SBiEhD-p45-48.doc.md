# RabbitMQ 实战复现文档：Shovel 插件、吞吐量调优与日志监控（P45–P48）

> 课程：BV1o39SBiEhD ｜ 覆盖 P45–P48
> 目标读者：前端转 AI 应用工程师
> 读完你能得到：一个跑得起来的 Docker + RabbitMQ + Python(pika) 工程，里面有一个「把消息从 A 队列搬到 B 交换机」的动态 Shovel、一套吞吐量调优的队列参数对照、以及日志/监控的落地命令。

---

## 1. 这一节做什么

这四集不是四个独立知识点，而是**一条完整的运维链路**：

1. **P45 用 Shovel 插件做「队列 → 交换机」的消息搬运**。讲师在管理后台建了一个**动态 Shovel**（dynamic shovel），把 `pika-queue` 里的消息全部转发到内置交换机 `amq.direct`，routing key 是 `shovel-queue`；再建一个同名队列 `shovel-queue` 绑上去，最后用 Python 的 `pika` 库写一个只连 `shovel-queue` 的消费者，验证消息确实被搬过来了。
2. **P46 讲吞吐量（throughput）的取舍**。讲师明确说这是 trade-off：想「单位时间塞进最多消息」，就要牺牲一部分可靠性。他给了队列侧和客户端侧各一组「该避免什么 / 该做什么」。
3. **P47 是整段高可用 + 吞吐量的复盘**（集群、镜像队列、Shovel、吞吐量定义）。
4. **P48 是日志与监控的导论**：日志用来「事后定位失败原因」，监控用来「实时介入」；讲了日志级别、日志分类、Firehouse（firehose tracer）以及 HTTP API 的 aliveness test。

所以本文的复现目标只有一个：**把 P45 的 Shovel 全链路跑通**，然后把 P46 的调优旋钮和 P48 的日志监控命令挂到同一个环境上，让你能自己动手改参数、看效果。

---

## 2. 讲师原话（带时间戳）

> "我们首先需要启用 shovel 插件，同时还会启用 shovel 管理插件。"
> —— p045 [00:00]

> "在右侧可以看到 shovel 状态和 shovel 管理选项卡……其中显示的是动态 shovel，这就是我们要创建的内容。"
> —— p045 [00:20]

> "我们会把 Pika 队列中的所有消息推送出去，发送到 amq.direct 交换机，使用标准虚拟主机，路由键为 shovel queue。"
> —— p045 [00:47]

> "队列已经空了，所以没有消息再被发布，也就是说它们已经被转发到 shovel 队列了。"
> —— p045 [01:55]

> "我们使用确认模式，以确保消息被正常转发出去。"
> —— p045 [02:09]

> "使用 Python 的 Pika 库创建一个只连接到 shovel 队列的客户端。"
> —— p045 [02:36]

> "配置一个 shovel，用于将消息从队列重新发布到交换机。"
> —— p045 [03:15]

> "首先显然要用惰性队列，因为它会立即把到达队列的所有消息存储到磁盘。"
> —— p046 [01:01]

> "应避免使用持久化消息，因为它们同样会立即写入磁盘。"
> —— p046 [01:22]

> "可以使用队列的存活时间或最大长度属性。"
> —— p046 [02:15]

> "队列数量绝对应当与节点上的核心数相匹配。"
> —— p046 [02:45]

> "在客户端应用中，不应在线程之间共享信道。"
> —— p046 [04:12]

> "应使用消息预取，并最终针对你的应用进行调优。"
> —— p046 [05:06]

> "日志记录大多数时候用于定位失败之处，并查明发生了什么以及原因。"
> —— p048 [00:26]

> "其中之一是 Firehose，可用于跟踪消息。"
> —— p048 [01:22]

> "对于日志机制，我们有不同的日志级别……调试、信息、警告、错误、严重。"
> —— p048 [02:20]

> "HTTP API 中还内置了存活检测。"
> —— p048 [03:19]

> **关于队列命名的说明**：逐字稿的语音识别把源队列写成了 "picker queue" / "pqq"，把 `pika` 库写成了 "picker library"。按上下文（"使用 Python 的 Pika 库"）这里就是 **pika**。下文统一写作 `pika-queue`，你实际命名随意，只要**源队列名、Shovel 配置、发布脚本三处保持一致**即可。

---

## 3. 从零复现

### 3.1 目录结构

在任意空目录下建出这套文件（后面第 4 节给完整内容）：

```
rabbitmq-shovel-demo/
├── docker-compose.yml      # 起 RabbitMQ
├── rabbitmq.conf           # 放开 guest 的 loopback 限制 + 日志级别
├── enabled_plugins         # 开机自动启用 shovel 相关插件
├── requirements.txt        # pika==1.3.2
├── setup_topology.py       # 声明 pika-queue / shovel-queue / 绑定
├── publisher.py            # 往 pika-queue 发消息
├── consumer.py             # 只消费 shovel-queue
├── queue_args.py           # P46 吞吐量参数对照（声明两种队列）
└── bench_publish.py        # P46 吞吐量压测小脚本
```

### 3.2 起容器

```bash
cd rabbitmq-shovel-demo
docker compose up -d
docker compose logs -f rabbitmq     # 看到 "Server startup complete" 再继续
```

管理后台：<http://localhost:15672>，账号密码都是 `guest`。

![p045 00:20 讲师打开 Admin 标签，右侧出现 Shovel Status 与 Shovel Management 面板](images/p045_0020s.jpg)

### 3.3 确认插件已启用

讲师在 P45 开头第一件事就是开两个插件：`rabbitmq_shovel` 和 `rabbitmq_shovel_management`。我们的 `enabled_plugins` 文件已经写死了，容器起来就是开的。验证：

```bash
docker exec rabbitmq-shovel-demo rabbitmq-plugins list | grep shovel
```

期望能看到（版本号以你实际拉到的镜像为准）：

```
[E*] rabbitmq_shovel               3.13.x
[E*] rabbitmq_shovel_management    3.13.x
```

`E*` 表示 enabled。如果你是用别的镜像、插件没开，手动补一条：

```bash
docker exec rabbitmq-shovel-demo rabbitmq-plugins enable rabbitmq_shovel rabbitmq_shovel_management
```

> 注意：`rabbitmq_shovel_management` 只是给管理后台加一个 Shovel 的 UI 页签，**真正干活的是 `rabbitmq_shovel`**。两个都要开，否则你在 Admin 页找不到 Shovel 面板。

### 3.4 建拓扑：两个队列 + 一条绑定

讲师是在 UI 里点出来的，我们先用脚本一次性建好，省得点错：

```bash
pip install -r requirements.txt
python setup_topology.py
```

输出：

```
[setup] pika-queue   已声明
[setup] shovel-queue 已声明
[setup] shovel-queue 已绑定 amq.direct (routing_key=shovel-queue)
[setup] 拓扑就绪
```

这一步做完，`shovel-queue` 已经挂在 `amq.direct` 上了。**顺序很重要**：Shovel 的目标 exchange 和 routing key 必须能路由到某个队列，否则消息会被交换机静默丢弃（direct 类型没有匹配的 binding 就直接扔）。

![p045 01:42 创建 shovel-queue 并把它绑定到 amq.direct 交换机](images/p045_0047s.jpg)

### 3.5 创建动态 Shovel

打开 <http://localhost:15672> → 顶部 **Admin** 标签 → 右侧 **Shovel Status / Shovel Management** 区域 → 展开 **Add a new shovel**，按下表填：

| 字段 | 值 | 说明 |
|---|---|---|
| Name | `pika-to-shovel` | 随便起，后面查状态用 |
| Virtual host | `/` | 讲师说的 "带斜杠的那个标准版本" |
| Source · URI | `amqp://guest:guest@localhost:5672/%2f` | 讲师用的 "以默认用户 guest/guest 连接本地服务器" |
| Source · Queue | `pika-queue` | 被搬运的源队列 |
| Destination · URI | `amqp://guest:guest@localhost:5672/%2f` | 同一个 broker |
| Destination · Exchange | `amq.direct` | 内置直连交换机 |
| Destination · Virtual host | `/` | |
| Destination · Routing key | `shovel-queue` | 必须和 3.4 的绑定一致 |
| Ack mode | `on-confirm` | 讲师说的 "确认模式" |

点 **Add shovel**。回到 **Shovel Status**，`pika-to-shovel` 的 State 应该是 `running`。

![p045 01:14 Shovel Status 里新建的 shovel 状态为 running](images/p045_0074s.jpg)

> **URI 里的 `%2f` 是什么？** 就是 vhost `/` 的 URL 编码。写成 `amqp://guest:guest@localhost:5672/` 会连到「空 vhost」然后报 `NOT_FOUND`。这是新手第一个坑。

**等价命令行版**（不想点 UI 就用这个，效果完全一样）：

```bash
curl -u guest:guest -X PUT \
  'http://localhost:15672/api/parameters/shovel/%2f/pika-to-shovel' \
  -H 'content-type: application/json' \
  -d '{
    "value": {
      "src-uri": "amqp://guest:guest@localhost:5672/%2f",
      "src-queue": "pika-queue",
      "dest-uri": "amqp://guest:guest@localhost:5672/%2f",
      "dest-exchange": "amq.direct",
      "dest-exchange-key": "shovel-queue",
      "ack-mode": "on-confirm"
    }
  }'
```

### 3.6 验证「消息被搬走了」

```bash
python publisher.py "from pika-queue via shovel, black magic added"
```

然后去 UI 的 **Queues** 页看：

- `pika-queue` 的 Ready 应该是 **0**（消息已经被 Shovel 取走并确认）
- `shovel-queue` 的 Ready 应该是 **1**

讲师当时的原话就是："队列是空的，因此没有发布任何消息，所以它们已经被转移到 Shovel 队列"。

![p045 02:09 从 shovel-queue 里 Get Message，看到被搬运过来的消息体](images/p045_0088s.jpg)

点进 `shovel-queue` → **Get messages** → 把 payload 拿出来，你会看到 `from pika-queue via shovel, black magic added`。

> **注意**：Shovel 是「搬」不是「抄」。`ack-mode: on-confirm` 意味着目标端确认收到之后，源队列那条消息才会被 ack 删除。如果你想要「复制一份」，得改成 `ack-mode: no-ack`（但那样源消息也会被删，只是不等确认）——真正意义上的「保留源消息」Shovel 做不到，需要自己在消费端重新 publish。

### 3.7 用 pika 写消费者

讲师在 P45 最后写了一个「只连 `shovel-queue`」的 Python 消费者。跑起来：

```bash
python consumer.py
```

再开一个终端发消息：

```bash
python publisher.py "hello shovel"
```

消费者终端输出：

```
[consumer] 等待消息，Ctrl+C 退出
[consumer] 收到消息: hello shovel
[consumer] routing_key=shovel-queue exchange=amq.direct
```

![p045 02:36 用 pika 编写只连接 shovel-queue 的 Python 消费者](images/p045_0102s.jpg)

到这里 P45 的链路就闭环了：**publisher → pika-queue → Shovel → amq.direct → shovel-queue → consumer**。

### 3.8 P46：吞吐量旋钮怎么落到代码里

讲师在 P46 给的是一组「避免 / 应该」的对照。下面这张表是我把他口述的内容翻译成**具体队列参数**，你可以直接改 `queue_args.py` 里的值做对比实验：

| 讲师说的 | 对应参数 | 吞吐量优先 | 可靠性优先 |
|---|---|---|---|
| 避免 lazy queue | `x-queue-mode` | 不设（默认 default） | `lazy` |
| 避免 durable message | `BasicProperties(delivery_mode=)` | `1`（transient） | `2`（persistent） |
| 避免 priority queue | `x-max-priority` | 不设 | `10` |
| 让队列变短 | `x-message-ttl` | `60000`（1 分钟） | 不设 |
| 让队列变短 | `x-max-length` | `100000` | 不设 |
| 自动清理不用的队列 | `auto_delete` / `x-expires` | `auto_delete=True` | `False` |

跑一下：

```bash
python queue_args.py
```

它会声明两个队列 `bench-fast`（吞吐优先）和 `bench-safe`（可靠性优先），你在 UI 的 Queues 页能直接看到 Features 列不一样。

然后是压测：

```bash
python bench_publish.py
```

输出类似：

```
[publish] 5000 条 / 1.83s -> 2732 msg/s
```

把 `bench_publish.py` 里的 `delivery_mode` 从 `1` 改成 `2` 再跑一次，你会看到明显的下降——这就是讲师说的「durable messages 会立刻写盘，是你要避免的」。

![p046 02:15 用 TTL 与 max-length 让队列保持短](images/p046_0135s.jpg)

**关于「队列数 = CPU 核数」这条**：讲师的原话是 "队列数量必须与节点上的核心数完全一致"，理由是队列是 Erlang 进程、进程是线程抽象、一个核同一时刻只能跑一个线程。落到实操上：

```bash
# 看容器分到几个核
docker inspect rabbitmq-shovel-demo --format '{{.HostConfig.NanoCpus}}'
nproc
```

如果你 `nproc` 是 8，那这个 broker 上**长期活跃**的队列数量最好也接近 8，而不是 80。队列太多会导致线程上下文切换开销吃掉吞吐量。

![p046 02:45 队列数量应与节点 CPU 核数匹配](images/p046_0159s.jpg)

**客户端侧**，讲师强调了两条：

1. **多个客户端消费同一个队列**（横向扩消费者）——这是最省事的提吞吐方式。
2. **不要跨线程共享 channel**。原话："不应在客户端应用的各个线程之间共享信道"。

在 Python 里，`pika.BlockingConnection` **不是线程安全的**，正确做法是每个线程一个 connection（或至少一个 channel）：

```python
# 错误示范：多线程共用一个 channel
# 正确做法：线程内自己建
import threading, pika

def worker(idx: int):
    conn = pika.BlockingConnection(pika.ConnectionParameters(host="localhost"))
    ch = conn.channel()
    ch.basic_qos(prefetch_count=10)
    ch.basic_consume(queue="shovel-queue", on_message_callback=lambda *a: None)
    ch.start_consuming()

for i in range(4):
    threading.Thread(target=worker, args=(i,), daemon=True).start()
```

> **给前端同学**：Node.js 里对应的是 `amqplib` 的 `channel`。Node 是单线程事件循环，看起来「不会有多线程共享 channel」的问题，但一旦你用 `worker_threads` 或 `cluster` 起多进程，**每个 worker 必须自己 `amqp.connect()` 建自己的 channel**，不能把主线程的 channel 传过去。prefetch 在 amqplib 里是 `channel.prefetch(n)`。

![p046 04:12 客户端不要跨线程共享 channel](images/p046_0209s.jpg)

**prefetch 的取舍**：讲师说得很清楚——"这很繁琐，而且你必须找到 prefetch 的最佳取值"，而且**不建议一上来就调它**，应该先扩消费者/扩队列，最后再动 prefetch。代码里就是 `channel.basic_qos(prefetch_count=N)`，N 从 10 开始试，逐步加到 50 / 100 看吞吐和延迟。

![p046 05:06 prefetch 与 ack 的取舍：不开 auto-ack 时才需要调它](images/p046_0233s.jpg)

### 3.9 P48：日志与监控

讲师在 P48 只做了**导论**，给了概念和方向，具体命令他说「后面再看」。这里把能立刻跑的命令补上。

**① 日志级别**（讲师列的：debug / information / warning / error / critical）

`rabbitmq.conf` 里改：

```ini
log.console.level = info
log.file.level = debug
```

改完 `docker compose restart rabbitmq` 生效。

**② 日志分类**：讲师说 RabbitMQ 可以按 category 分文件，他点名的有 `connection`、`channel`、`queue`、`mirroring`（高可用）、`federation`。配置形如：

```ini
log.file.level = info
log.file.formatter = json
```

> 具体 category 的配置键名，**课里没讲**，请以你实际版本的官方配置文档为准，不要照抄。

**③ Firehouse / firehose tracer**：讲师说它「把消息同时投递到一个 tracing 队列」，本质就是给交换机挂一个额外的消费者。RabbitMQ 里对应的插件是 `rabbitmq_tracing`（课里叫 Firehouse，以 `rabbitmq-plugins list` 实际输出为准）：

```bash
docker exec rabbitmq-shovel-demo rabbitmq-plugins enable rabbitmq_tracing
```

启用后管理后台会出现 **Tracing** 页签，可以建一个 trace，指定 pattern（比如 `#` 全匹配）和目标文件。

![p048 01:22 Firehouse tracer 把消息同时投递到 tracing 队列](images/p048_0077s.jpg)

**④ aliveness test**：讲师说 HTTP API 内置了 aliveness test，它会「往一个交换机发消息、再消费掉」，从而验证 broker 真的能干活（而不只是 TCP 通）。

```bash
curl -u guest:guest http://localhost:15672/api/aliveness-test/%2f
```

正常返回：

```json
{"status":"ok"}
```

如果 broker 内部出问题（比如磁盘满、队列进程崩了），这个接口会返回 500。**它和心跳的区别**：心跳只证明 TCP 连接还在，aliveness 证明 broker 能完成一次完整的消息流转。

![p048 03:19 HTTP API 的 aliveness test 会走一遍完整的消息流转](images/p048_0163s.jpg)

**⑤ 心跳 / 基础健康检查**：

```bash
docker exec rabbitmq-shovel-demo rabbitmq-diagnostics status
docker exec rabbitmq-shovel-demo rabbitmq-diagnostics check_port_connectivity
docker exec rabbitmq-shovel-demo rabbitmq-diagnostics check_local_alarms
```

> 这三条命令**课里没给**，是我按 P48 讲的「heartbeat / CPU / 磁盘 IO / 内存」补的常用诊断入口，字段名以你实际输出为准。

---

## 4. 完整代码

### `docker-compose.yml`

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13-management
    container_name: rabbitmq-shovel-demo
    hostname: rabbitmq
    ports:
      - "5672:5672"     # AMQP
      - "15672:15672"   # 管理后台
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - ./rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  rabbitmq_data:
```

### `rabbitmq.conf`

```ini
# 允许 guest 从容器外（宿主机）登录。
# 默认 guest 只能从 loopback 登录，Docker 端口映射后源 IP 是 docker0 网关，会被拒。
loopback_users.guest = false

# 日志级别：debug / info / warning / error / critical
log.console.level = info
log.file.level = info
```

### `enabled_plugins`

```
[rabbitmq_management,rabbitmq_shovel,rabbitmq_shovel_management].
```

> 注意结尾那个英文句号，是 Erlang 的语法要求，少了容器起不来。

### `requirements.txt`

```
pika==1.3.2
```

### `setup_topology.py`

```python
"""声明 P45 需要的拓扑：pika-queue、shovel-queue、以及 shovel-queue 到 amq.direct 的绑定。"""
import pika

AMQP_HOST = "localhost"
AMQP_PORT = 5672
VHOST = "/"
USER = "guest"
PASSWORD = "guest"

SOURCE_QUEUE = "pika-queue"
DEST_QUEUE = "shovel-queue"
EXCHANGE = "amq.direct"
ROUTING_KEY = "shovel-queue"


def main() -> None:
    credentials = pika.PlainCredentials(USER, PASSWORD)
    params = pika.ConnectionParameters(
        host=AMQP_HOST,
        port=AMQP_PORT,
        virtual_host=VHOST,
        credentials=credentials,
    )
    connection = pika.BlockingConnection(params)
    channel = connection.channel()

    # durable=False：和 P46「避免 durable messages」保持一致
    channel.queue_declare(queue=SOURCE_QUEUE, durable=False)
    print(f"[setup] {SOURCE_QUEUE}   已声明")

    channel.queue_declare(queue=DEST_QUEUE, durable=False)
    print(f"[setup] {DEST_QUEUE} 已声明")

    # amq.direct 是内置交换机，重复声明是幂等的，只要 type 一致
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="direct", durable=True)

    channel.queue_bind(
        queue=DEST_QUEUE,
        exchange=EXCHANGE,
        routing_key=ROUTING_KEY,
    )
    print(f"[setup] {DEST_QUEUE} 已绑定 {EXCHANGE} (routing_key={ROUTING_KEY})")

    connection.close()
    print("[setup] 拓扑就绪")


if __name__ == "__main__":
    main()
```

### `publisher.py`

```python
"""往 pika-queue 发一条消息，Shovel 会把它搬到 amq.direct -> shovel-queue。"""
import sys

import pika

SOURCE_QUEUE = "pika-queue"
DEFAULT_BODY = "from pika-queue via shovel, black magic added"


def main() -> None:
    body = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BODY

    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            port=5672,
            virtual_host="/",
            credentials=pika.PlainCredentials("guest", "guest"),
        )
    )
    channel = connection.channel()
    channel.queue_declare(queue=SOURCE_QUEUE, durable=False)

    channel.basic_publish(
        exchange="",                 # 空字符串 = 默认交换机，按 routing_key 直接投队列
        routing_key=SOURCE_QUEUE,
        body=body,
        properties=pika.BasicProperties(delivery_mode=1),  # 1=transient，P46 的吞吐量选择
    )
    print(f"[publisher] 已发送到 {SOURCE_QUEUE}: {body}")
    connection.close()


if __name__ == "__main__":
    main()
```

### `consumer.py`

```python
"""只消费 shovel-queue，验证 Shovel 搬运成功。"""
import pika

QUEUE = "shovel-queue"


def on_message(ch, method, properties, body: bytes) -> None:
    print(f"[consumer] 收到消息: {body.decode()}")
    print(f"[consumer] routing_key={method.routing_key} exchange={method.exchange}")
    ch.basic_ack(delivery_tag=method.delivery_tag)


def main() -> None:
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            port=5672,
            virtual_host="/",
            credentials=pika.PlainCredentials("guest", "guest"),
        )
    )
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE, durable=False)

    # P46：prefetch 要自己调，10 是个保守起点
    channel.basic_qos(prefetch_count=10)

    channel.basic_consume(
        queue=QUEUE,
        on_message_callback=on_message,
        auto_ack=False,   # P46：需要可靠性就不要开 auto-ack
    )

    print("[consumer] 等待消息，Ctrl+C 退出")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
    finally:
        connection.close()


if __name__ == "__main__":
    main()
```

### `queue_args.py`

```python
"""P46 吞吐量对照：声明一个「吞吐优先」队列和一个「可靠性优先」队列。"""
import pika

FAST_QUEUE = "bench-fast"
SAFE_QUEUE = "bench-safe"


def main() -> None:
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            port=5672,
            virtual_host="/",
            credentials=pika.PlainCredentials("guest", "guest"),
        )
    )
    channel = connection.channel()

    # 吞吐优先：短队列 + 自动清理 + 不设优先级 + 不设 lazy
    channel.queue_declare(
        queue=FAST_QUEUE,
        durable=False,
        auto_delete=True,
        arguments={
            "x-message-ttl": 60_000,   # 1 分钟没被消费就丢
            "x-max-length": 100_000,   # 最多 10 万条
        },
    )
    print(f"[queue_args] {FAST_QUEUE} 已声明（吞吐优先）")

    # 可靠性优先：持久化 + 优先级 + 不过期
    channel.queue_declare(
        queue=SAFE_QUEUE,
        durable=True,
        auto_delete=False,
        arguments={
            "x-max-priority": 10,
        },
    )
    print(f"[queue_args] {SAFE_QUEUE} 已声明（可靠性优先）")

    connection.close()


if __name__ == "__main__":
    main()
```

### `bench_publish.py`

```python
"""P46 吞吐量小压测：改 delivery_mode 对比 1(transient) 与 2(persistent)。"""
import time

import pika

QUEUE = "bench-fast"
TOTAL = 5000
PAYLOAD = b"x" * 256
DELIVERY_MODE = 1  # 改成 2 再跑一次，对比吞吐量


def main() -> None:
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            port=5672,
            virtual_host="/",
            credentials=pika.PlainCredentials("guest", "guest"),
        )
    )
    channel = connection.channel()
    channel.queue_declare(
        queue=QUEUE,
        durable=False,
        arguments={"x-max-length": 200_000},
    )

    start = time.perf_counter()
    for _ in range(TOTAL):
        channel.basic_publish(
            exchange="",
            routing_key=QUEUE,
            body=PAYLOAD,
            properties=pika.BasicProperties(delivery_mode=DELIVERY_MODE),
        )
    elapsed = time.perf_counter() - start

    print(f"[publish] {TOTAL} 条 / {elapsed:.2f}s -> {TOTAL / elapsed:.0f} msg/s")
    connection.close()


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

**`setup_topology.py`**

- `pika.PlainCredentials(USER, PASSWORD)`：明文账号密码。生产环境应该用 `ExternalCredentials` + TLS，但课里就是 guest/guest，先跑通。
- `virtual_host="/"`：对应讲师说的 "带斜杠的那个标准版本"。**这个 `/` 在 URI 里必须写成 `%2f`**，在 `ConnectionParameters` 里直接写 `/` 就行。
- `channel.queue_declare(queue=..., durable=False)`：`durable` 决定队列元数据是否落盘。P46 讲师明确说吞吐量场景要避免 durable，所以这里给 `False`。
- `channel.exchange_declare(exchange="amq.direct", exchange_type="direct", durable=True)`：`amq.direct` 是 RabbitMQ 自带的，重复声明是幂等的，**但 type 必须一致**，写成 `topic` 会报 `PRECONDITION_FAILED`。
- `channel.queue_bind(...)`：把队列挂到交换机上。**没有这一步，Shovel 把消息投到 `amq.direct` 时会被直接丢弃**，而且不会有任何报错——这是最阴的坑。

**`publisher.py`**

- `exchange=""`：空字符串代表「默认交换机」（default exchange），它会把消息按 routing_key 直接投到同名队列，不需要显式绑定。
- `properties=pika.BasicProperties(delivery_mode=1)`：`1` = transient（不落盘），`2` = persistent（落盘）。P46 讲师说的 "避免使用持久化消息" 就是让你用 `1`。

**`consumer.py`**

- `channel.basic_qos(prefetch_count=10)`：一次最多预取 10 条未 ack 的消息。**不调用这个方法时，broker 会尽可能多地往客户端推**，消费者一慢就内存爆掉。
- `auto_ack=False` + `ch.basic_ack(...)`：手动 ack。P46 讲师说「需要可靠性就不能开 auto-ack」，因为 auto-ack 在消息投递瞬间就删了，消费者崩了消息就丢了。
- `method.routing_key` / `method.exchange`：从投递信息里读出来的字段，用来验证消息确实是从 `amq.direct` 带着 `shovel-queue` 这个 key 过来的。

**`queue_args.py`**

- `x-message-ttl`：消息在队列里活多久（毫秒）。P46 讲师说的 "time to live"。
- `x-max-length`：队列最多存多少条，超了就丢最老的。P46 讲师说的 "最大长度属性"。
- `x-max-priority`：优先级队列。讲师说「always avoid priority on queues」，尤其吞吐量场景，因为优先级队列内部要做排序，是纯开销。
- **重要**：队列的 `arguments` **一旦声明就不能改**。想改必须先在 UI 里删掉队列，或者 `channel.queue_delete(queue=...)` 重建，否则报 `PRECONDITION_FAILED - inequivalent arg`。

**`bench_publish.py`**

- `time.perf_counter()`：比 `time.time()` 精度高，适合测短耗时。
- `PAYLOAD = b"x" * 256`：256 字节的假消息，接近真实业务消息量级。太小（比如 1 字节）测出来的数字没有参考意义。
- 改 `DELIVERY_MODE = 2` 再跑，你会看到吞吐量掉一大截——这就是 P46 整节在讲的 trade-off 的直观体现。

---

## 6. 复现检查清单

按顺序打勾，任何一项不过就别往下走：

- [ ] `docker compose ps` 里 `rabbitmq-shovel-demo` 是 `healthy`
- [ ] <http://localhost:15672> 能用 `guest/guest` 登录
- [ ] `docker exec rabbitmq-shovel-demo rabbitmq-plugins list | grep shovel` 输出里两个插件都是 `[E*]`
- [ ] Admin 页右侧能看到 **Shovel Status** 和 **Shovel Management** 两个面板
- [ ] `python setup_topology.py` 输出「拓扑就绪」
- [ ] Queues 页能看到 `pika-queue` 和 `shovel-queue` 两个队列
- [ ] `shovel-queue` 的 Bindings 里有 `amq.direct` / `shovel-queue`
- [ ] 建完 Shovel 后，Shovel Status 里 `pika-to-shovel` 的 State 是 `running`
- [ ] `python publisher.py "test"` 之后，`pika-queue` 的 Ready 是 0
- [ ] 同一时刻 `shovel-queue` 的 Ready 是 1
- [ ] `python consumer.py` 能打印出 `[consumer] 收到消息: test`
- [ ] `python queue_args.py` 之后，Queues 页的 Features 列里 `bench-fast` 有 `TTL` 和 `Lim`
- [ ] `python bench_publish.py` 能打印出 `msg/s` 数字
- [ ] `curl -u guest:guest http://localhost:15672/api/aliveness-test/%2f` 返回 `{"status":"ok"}`

---

## 7. 课里没讲但你会撞上的

**① `guest` 用户从宿主机连不上**

报错长这样：

```
pika.exceptions.ProbableAuthenticationError: ConnectionClosedByBroker: (403)
ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN.
```

原因：RabbitMQ 默认 `loopback_users.guest = true`，`guest` 只能从 `127.0.0.1` 登录。Docker 端口映射后，你从宿主机连过去的源 IP 是 `172.17.0.1`（docker0 网关），不是 loopback，所以被拒。

解法（本文 `rabbitmq.conf` 已经写了）：

```ini
loopback_users.guest = false
```

生产环境别这么干，应该建一个专用用户：

```bash
docker exec rabbitmq-shovel-demo rabbitmqctl add_user app_user 'S3cret!'
docker exec rabbitmq-shovel-demo rabbitmqctl set_permissions -p / app_user ".*" ".*" ".*"
```

**② Shovel 的 URI 里 vhost 忘了 URL 编码**

`amqp://guest:guest@localhost:5672/` 和 `amqp://guest:guest@localhost:5672/%2f` 是**两个不同的 vhost**。前者是空字符串 vhost（不存在），后者才是 `/`。写错了 Shovel 会一直 `starting` 然后报 `NOT_FOUND`。

**③ 源队列不存在时 Shovel 起不来**

Shovel 启动时会去连源队列，队列不存在就报错。**先跑 `setup_topology.py`，再建 Shovel**，顺序不能反。

**④ 目标 exchange 写错，消息静默消失**

`amq.direct` 是 direct 类型，如果 `shovel-queue` 没绑上（或者 routing key 写错），消息会被交换机**直接丢弃，不报错、不进死信**。验证方法：发一条消息后看 `shovel-queue` 的 Ready 是不是 1。如果是 0 而 `pika-queue` 也是 0，那就是被丢了。

**⑤ 队列 `arguments` 改不了**

```
PRECONDITION_FAILED - inequivalent arg 'x-max-length' for queue 'bench-fast'
```

这是 RabbitMQ 的设计：队列参数在声明时固化。改参数必须删队列重建。**在 JS/Node 里对应的是**：`amqplib` 的 `channel.assertQueue(name, { durable, maxLength })` 也一样，参数不一致直接抛错。

**⑥ `pika.BlockingConnection` 不是线程安全的**

一个 connection 只能在一个线程里用。多线程消费要每个线程自己 `BlockingConnection`。**在 Node 里对应**：`amqplib` 的 `Connection` 可以共享，但 `Channel` 不要跨 `worker_threads` 传，每个 worker 自己 `createChannel()`。

**⑦ 日志文件到底在哪**

P48 讲师说「we will look at where those log files are located」，但**这一集没给具体路径**。容器里通常是 `/var/log/rabbitmq/`，你可以：

```bash
docker exec rabbitmq-shovel-demo ls -l /var/log/rabbitmq/
```

以实际输出为准，别照抄。

**⑧ 吞吐量没有标准答案**

讲师在 P47 复盘时说得非常直白："很难说应该这样做或那样做才能获得更高的吞吐量，因为这取决于你的应用和硬件"。所以本文给的 `prefetch_count=10`、`x-max-length=100000` 都只是**起点**，不是最优值。正确做法是：先按本文跑通，再用 `bench_publish.py` 做 A/B，用你自己的消息体大小和消费逻辑去测。

**⑨ 关于「锁 / 事务 / 并发」**

这四集**没有涉及**数据库锁或事务，RabbitMQ 这边对应的是 **publisher confirm**（发布确认）和 **consumer ack**（消费确认）。讲师在 P45 提到的 "确认模式" 就是 publisher confirm 的 `on-confirm` 模式。**在 JS/Node 里对应**：`amqplib` 的 `channel.createConfirmChannel()` + `channel.publish(..., callback)`，回调里拿到 broker 的确认。

---

**下一篇预告**：P47 结尾讲师说 "下一节我们将介绍使用 RabbitMQ 进行监控和日志记录"，也就是 P48 之后会进入具体的日志配置和监控搭建。本文第 3.9 节给的是能立刻跑的命令，等你看完后续集数再回来补细节即可。