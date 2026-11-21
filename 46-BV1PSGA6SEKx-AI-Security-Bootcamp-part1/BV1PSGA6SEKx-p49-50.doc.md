# AI Security Bootcamp Part 1：护栏 / 网关 / 可观测（P49–P50）

> 本课程覆盖两个模块：**P49 用 Redis 给 AI Agent 做对话记忆（Conversation Memory）**，**P50 用 Redis 做 API 限流（Rate Limiting）**。两节都是「Redis 在 AI 应用里的三大用例」中的两个（第三个 RAG 缓存留到后续模块）。文档按「先跑起来、再讲原理」的顺序组织，所有代码都是完整文件，可直接保存运行。

---

## 1. 这一节做什么

这两节课解决的是同一个问题的两个侧面：**LLM 本身是无状态的（stateless），而真实产品需要「记得住」和「扛得住」。**

- **P49：对话记忆。** 你直接调 OpenAI / Groq 的 API 时，每一次请求都是孤立的——第一次问「我叫 Alex」，第七次问「我叫什么」，模型会回答「不知道」。网页版 ChatGPT / Claude / Gemini 之所以记得你，是因为它们在自己的平台上内置了记忆层。你自己做 AI 应用，就必须自己接一个记忆存储。这节课用 **Redis 的 List 数据类型** 存对话历史，实现两种短期记忆策略：
  - **滑动窗口（Sliding Window）**：只保留最近 N 条消息，超出的从最旧的开始删；
  - **会话 TTL（Session TTL）**：给整个会话设过期时间（课里设 7200 秒 = 2 小时），到期自动清空。
  - 并演示**多用户会话隔离**：Alice 和 Bob 的记忆不能串。
- **P50：限流。** 只要你的项目里集成了 LLM，就一定在发 API 调用。不限流会导致两个后果：**成本上升**和**服务器过载**（甚至被 DDoS 打崩）。这节课用 Redis 的计数器 + TTL 实现两种限流算法：
  - **固定窗口（Fixed Window）**：按自然分钟计数，实现简单但有「跨窗口边界」漏洞；
  - **滑动窗口（Sliding Window）**：按「第一次请求的时间戳」起算 60 秒，堵住这个漏洞，但要多算时间戳、有额外资源开销。

最终产物是两套可运行的 Python 脚本：一套带记忆的聊天循环，一套带限流的 LLM 调用封装。

---

## 2. 讲师原话

> "你的 LLM 是无状态的，它们没有记忆。但你会说，我去 ChatGPT 网站、去 Claude 网站、去 Gemini 网站，它们是有记忆的。那记忆到底是什么？"
> —— p049 [00:29]

> "在 API 里，你发第一个问题，它给你响应；再发第二个问题，它再给你响应。但第一个和第二个是不相连的。你的第一个问题不会被第二个问题引用。所以如果你问第一个问题相关的东西，你的 OpenAI 不会回应，它 basically 不会记得。这就是我说的那个问题。"
> —— p049 [02:25]

> "所以我必须做什么？我必须接一个记忆存储，我必须给这段对话接上记忆，把记忆集成进对话里，这样我就有完整的上下文。"
> —— p049 [03:20]

> "记忆分两种：短期记忆和长期记忆。Redis 适合短期记忆，但不适合长期。长期你应该用别的数据库，比如向量数据库或者 SQL 数据库。"
> —— p049 [05:14]

> "假设你有一年的对话，大概 3 GB，而分配给 Redis 的 RAM 是 2 GB，那这 3 GB 的对话怎么存进 2 GB？不可能。但如果你用硬盘存储，你能有 512 GB、1000 GB。RAM 一般不可能有 1000 GB。"
> —— p049 [05:43]

> "滑动记忆，顾名思义，记忆会滑动。假设你在对话，第一问、第二问、第三、第四、第五问，你把滑动窗口设成 5，那就只保留五个问题。你一问第六个，因为一个会话里 Redis 一次只存五个问题，它就会把最旧的那个删掉。"
> —— p049 [07:07]

> "TTL 我之前解释过了，一个小时后自动让会话过期，自动过期，自动清理你的记忆，整个 Redis 记忆都被清掉。这就是提升短期记忆的两种方式。"
> —— p049 [08:02]

> "我们设了 max messages 是 20，就是我说的那个滑动窗口上限，它只保留最新的 20 条消息。TTL 秒数设成 7200 秒，你可以换算成分钟，7200 除以 60 就是 2 小时。"
> —— p049 [08:59]

> "现在我们做两个用户 Alice 和 Bob，我们同时给 session user one 和 session user two 聊天，看看它们是不是隔离的、会不会互相合并。它们应该是分开的。Bob 的记忆不能和 Alice 混在一起，Alice 的记忆必须只属于 Alice。"
> —— p049 [15:11]

> "对于长期记忆，一般不建议用 Redis，因为有很多复杂问题。短期记忆用 Redis，长期记忆去接 SQL 数据库或者向量数据库。不要试图用 Redis 做长期记忆，因为它是内存存储，它活在 RAM 里。"
> —— p049 [19:25]

> "限流对 API 调用非常有用。你调 LLM 模型时就是在发 API 调用。只要你的项目、你的 AI 系统里集成了 LLM，就一定会发 API 调用，而限流在这里扮演非常关键的角色。为什么？因为如果你不设限流，首先会带来成本和服务器负载。"
> —— p050 [00:00]

> "假设你的服务器每分钟只能接 100 个请求，来了一个人每分钟发 150 个请求，那显然服务器会有负载，因为容量只有 100，你发 150，服务器可能就崩了。所以我们需要限流。"
> —— p050 [01:26]

> "设了限流之后，你只允许 100 个请求通过，第 101 个请求要等冷却（cooldown）之后才放行。假设你设的是 1 分钟，1 分钟后计数器重置，又可以发 100 个请求。这样你也省了成本。"
> —— p050 [01:54]

> "为什么用 Redis？第一，它流行，流行就有好的社区支持，遇到错误有人帮你。第二，它快，小于 1 毫秒，检查限流不会增加延迟。第三，它是原子的（atomic）。"
> —— p050 [03:17]

> "什么叫原子？假设当前计数器是 7，总共限制每分钟 100 个请求，现在同时来了两个请求，一个请求一、一个请求二，并行到达。普通计数器会把两个都更新成 8，因为它们是同时来的。但 Redis 不会这样，即使同时来，它会给一个 8、另一个 9。这就是我们说的原子性——即使两个请求同时到，也不会给它们分配同一个值。"
> —— p050 [03:46]

> "第四是 TTL。你可以设一个限制，到了这个限制计时器就过期。比如我跑每分钟 100 个请求，1 分钟后计数器自动重置为 0，你不用手动做任何事，之前所有请求记录都会被移除。"
> —— p050 [05:13]

> "还有一个是共享（shared）。你在 Kubernetes 上部署应用，显然不会只部署一个副本，你会部署多个副本来扛负载。假设有三个 app 副本，你把三个都接到同一个 Redis 上，设了每分钟 100 个请求。一个请求到 app1、一个到 app2、一个到 app3，总计数器是 3，而不是各自有独立计数器。多个服务器可以共享同一个 Redis 实例，而且实时更新。"
> —— p050 [06:11]

> "限流有两种：固定窗口和滑动窗口。固定窗口不跟踪时间，滑动窗口跟踪时间。固定窗口有个漏洞。"
> —— p050 [08:05]

> "假设服务器每分钟只能处理 10 个请求，多发一个就崩。12 点 1 分 59 秒，黑客发了 10 个请求；12 点 2 分 00 秒，又发了 10 个请求。总共 2 秒内 20 个请求，但限制是每分钟 10 个，服务器就崩了。因为固定窗口是从 0 秒到 60 秒按分钟跟踪的，分钟一变计数器就重置。"
> —— p050 [09:59]

> "滑动窗口就不会有这个问题。它从你发出的第一个请求开始计时 60 秒。你发第一个请求，从那里开始 60 秒计时启动，计数器开始、计时器开始。这就是为什么叫滑动窗口。那个攻击者就没法做这种攻击了。"
> —— p050 [11:27]

> "两者做的事情一样，唯一区别是固定窗口不跟踪时间，滑动窗口跟踪时间——从第一个请求发出的那一刻起算 60 秒，60 秒内只允许 10 个请求，之后计数器自动重置。"
> —— p050 [12:24]

> "那为什么不全用滑动窗口？因为滑动窗口要计算时间戳这些东西，会增加你的运营成本。你在算时间，就要用资源，GPU、RAM 之类。小规模你觉得这点操作不算什么，但如果有几百万个请求、几百万次时间戳计算，成本是多少？"
> —— p050 [18:01]

> "所以人们即使使用固定窗口，也会把限额设得留有余量，即使有人攻击也不至于影响。假设服务器能扛每分钟 10 个请求，你可以把限额设成每分钟 3 个。黑客这边发 3 个、那边发 3 个，2 秒内总共还是只有 6 个，服务器能扛 10 个，所以还是安全的。"
> —— p050 [18:56]

---

## 3. 从零复现

### 3.1 环境准备

**目录结构**（建议）：

```
ai-security-bootcamp/
├── .env
├── requirements.txt
├── p49_memory/
│   ├── memory.py          # 对话记忆核心类
│   └── demo_memory.py     # 演示脚本（单用户 / 多用户 / 滑动窗口）
└── p50_ratelimit/
    ├── fixed_window.py    # 固定窗口限流器
    ├── sliding_window.py  # 滑动窗口限流器
    └── demo_llm.py        # 接 LLM 的限流演示
```

**依赖版本**（`requirements.txt`）：

```
redis==5.0.8
groq==0.9.0
python-dotenv==1.0.1
```

> 课里用的是 Groq API（不是 OpenAI）。讲师原话：「如果你想用 Groq 而不是 OpenAI，只需要在 client 那一段改这一行，并且确保所有写了 OpenAI client 的地方都换成 Groq client。」（p049 [08:31]）所以下面所有代码都用 Groq，但结构上和 OpenAI SDK 完全一致。

**`.env`**（课里说「我们在第一个视频里已经在 .env 文件里设好了」）：

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
GROQ_API_KEY=你的_groq_api_key
```

**启动 Redis**（本地 Docker 一行）：

```bash
docker run -d --name redis-memory -p 6379:6379 redis:7-alpine
```

**安装依赖并验证连接**：

```bash
pip install -r requirements.txt
python -c "import redis; r=redis.Redis(host='localhost',port=6379,db=0); print(r.ping())"
# 输出 True 即连接成功
```

### 3.2 P49 复现步骤：对话记忆

1. **建 Redis 客户端**，确认 `ping()` 返回 True，Groq API 能加载（讲师在 p049 [08:59] 现场跑过这一步：「你的 Gradients 连上了，Groq API 加载了，是的」）。
2. **写 `ConversationMemory` 自定义类**，构造参数：`max_messages=20`、`ttl_seconds=7200`。类里提供这些方法（讲师逐个念过，p049 [09:58]–[10:26]）：
   - `add_message(session_id, role, content)`：往会话 List 里追加一条；
   - `get_messages(session_id)`：取出全部消息；
   - `get_message_count(session_id)`：当前 Redis 里有多少条；
   - `clear_session(session_id)`：清空会话；
   - `get_ttl(session_id)`：还剩多少秒过期。
3. **写 `chat()` 主函数**：把记忆和 Groq 组合起来——每次发 API 请求前，先从 Redis 取出该 session 的历史消息拼进上下文；拿到响应后，把「用户这条」和「助手这条」都写回 Redis List；写回时如果超过 `max_messages`，从最旧的开始删（`LTRIM`）。
4. **单用户演示**：手动设 `session_id = "demo_session_001"`（讲师说「你可以写个自动生成 session id 的，但这里我手动设了」）。先清空旧会话，然后：
   - 发「Hi, my name is Alex. I am learning about Redis.」→ 模型回「Nice to meet you, Alex...」；
   - 打开 Redis 客户端刷新，能看到 key `demo_session_001`，TTL 显示 1 小时 59 分 22 秒（因为设的是 7200 秒）；
   - 再问「What is my name?」→ 模型答「Your name is Alex」；
   - 再问「What topic am I currently studying?」→ 模型答「You are currently studying about Redis」；
   - 问「Can you give me a quick summary what we have talked about so far?」→ 模型能总结出「自我介绍、打招呼、讨论 Redis、讨论学习主题」。
   - 查消息总数：8 条（4 条 user + 4 条 assistant），剩余 TTL 7182 秒。
5. **多用户隔离演示**：建两个 session（Alice / Bob），各自先清空，然后同时聊：
   - Alice：「Hi, I'm Alice. I work as a data scientist.」→ 回「Hello Alice...」；
   - Bob：「Hi, I'm Bob. I love cooking.」→ 回「Hello Bob...」；
   - 在 Alice 会话问「What's my name and what do I do?」→ 答「Hello Alice, you are a data scientist」；
   - 在 Bob 会话问「Do you know someone named Alice?」→ 答「No, I don't have any personal knowledge of individual」——证明两个会话完全隔离。
6. **滑动窗口小窗口演示**：新建 key `demo_small_window`，把 `max_messages` 设成 **6**（为了演示方便，不设 20），TTL 设 **300 秒**。依次问 4 个问题（What is Python / JavaScript / Go / Rust），每个问题都得到一条 user + 一条 assistant，理论上有 8 条，但上限是 6，所以最旧的 2 条（第一条 Python 的 user 和 assistant）被自动挤掉，Redis 里只剩 6 条，从 JavaScript 那轮开始。讲师原话：「总共 6 条消息，第一轮被推出去了。」（p049 [18:56]）
7. **长期记忆（不推荐）**：讲师用 `HSET` / `HGETALL` / `HDEL` 这类 hash 命令演示了把长期对话存 Redis 的写法，但明确说「不要用 Redis 做长期记忆，它不是为这个目的做的」（p049 [20:47]）。这段代码保留在文档第 4 节，但标注为「仅演示，不推荐生产使用」。

### 3.3 P50 复现步骤：限流

1. **连 Redis + 连 Groq**（同 P49 的客户端代码）。
2. **写固定窗口限流器** `FixedWindowRateLimiter`：
   - 构造参数：`limit`（窗口内允许的请求数）、`window_seconds`（窗口长度）；
   - 核心是 Redis 的 `INCR`（增加）和 `EXPIRE`（设过期）。讲师原话：「你可以看到这是 DECR 表示减少，INCR 表示增加，这是 IDECR（应为 INCR），你可以把它删掉。」（p050 [13:46]）——即计数器用 `INCR`，第一次 `INCR` 后如果返回 1 就 `EXPIRE` 设窗口 TTL。
   - `check(user_id)` 返回是否放行。
3. **跑假用户测试**：设 `limit=5`、`window_seconds=30`，给一个假用户连发 8 个请求。预期：前 5 个 allowed，第 6、7、8 个 blocked（讲师现场结果：1–5 allowed，6/7/8 blocked，p050 [14:15]）。
4. **接 LLM 测试**：设 `limit=3`、`window_seconds=60`，连问 5 个「What is Redis?」。预期：请求 1/2/3 allowed，请求 4 blocked 并提示「rate limit reached，52 秒后自动刷新」，等 60 秒过后请求 4、5 可以正常查询（p050 [14:45]）。
5. **写滑动窗口限流器** `SlidingWindowRateLimiter`：
   - 同样 `limit=10`、`window_seconds=60`；
   - 用 **pipeline** 做原子执行（讲师原话：「这次我们用 pipeline 做自动执行、原子执行」，p050 [16:11]）；
   - 核心数据结构是 Redis **Sorted Set（ZSET）**：member 用「时间戳+随机数」保证唯一，score 用当前时间戳；
   - 每次请求：先用 `ZREMRANGEBYSCORE` 清掉窗口外的旧记录 → `ZCARD` 数当前窗口内请求数 → 若小于 limit 则 `ZADD` 加入本次请求并设 TTL。
6. **跑滑动窗口测试**：同样连发请求，预期前几个 allowed、到限额后 blocked，行为和固定窗口在正常场景下一致（讲师原话：「两者工作方式一样，速度也一样，唯一区别是那个 bug」，p050 [17:07]）。

---

## 4. 完整代码

> 说明：课里没有 OCR 结果，以下代码依据逐字稿里讲师口述的方法名、参数、命令（`INCR`、`EXPIRE`、`HSET`、`HGETALL`、`HDEL`、`LTRIM`、`pipeline`、`ZADD` 等）和现场演示的行为还原。凡逐字稿没提到的具体实现细节，均在注释里标注「课里没讲，此处按 Redis 官方语义补全」。

### 4.1 `p49_memory/memory.py` —— 对话记忆核心类

```python
# p49_memory/memory.py
import os
import redis
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ---------- Redis 客户端 ----------
# 讲师 p049 [08:31]：想用 Groq 就把 client 这一段换掉，
# 并且确保所有写 OpenAI client 的地方都换成 Groq client。
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True,   # 课里没讲，但取回字符串必须加，否则拿到 bytes
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class ConversationMemory:
    """用 Redis List 存对话历史，实现滑动窗口 + 会话 TTL。"""

    def __init__(self, max_messages: int = 20, ttl_seconds: int = 7200):
        # 讲师 p049 [08:59]：max_messages=20，ttl_seconds=7200（=2 小时）
        self.max_messages = max_messages
        self.ttl_seconds = ttl_seconds
        self.redis = redis_client

    def _key(self, session_id: str) -> str:
        # 讲师 p049 [09:58]：key 就是 redis key，这里用 session_id 直接做 key
        return f"conversation:{session_id}"

    def add_message(self, session_id: str, role: str, content: str):
        """往会话 List 追加一条消息，并做滑动窗口裁剪 + 刷新 TTL。"""
        key = self._key(session_id)
        # 讲师 p049 [04:44]：用 Redis 的 List 数据类型，格式是 role user / role assistant
        self.redis.rpush(key, f"{role}:{content}")
        # 滑动窗口：只保留最新 max_messages 条，最旧的被删掉
        # 讲师 p049 [07:35]：设了上限 5，来第 6 条就删最旧的
        self.redis.ltrim(key, -self.max_messages, -1)
        # 每次写入刷新 TTL（课里没讲是否每次刷新，此处按「会话活跃即续期」补全）
        self.redis.expire(key, self.ttl_seconds)

    def get_messages(self, session_id: str):
        """取出会话全部消息，转成 Groq/OpenAI 要求的 message 格式。"""
        key = self._key(session_id)
        raw = self.redis.lrange(key, 0, -1)
        messages = []
        for item in raw:
            role, _, content = item.partition(":")
            messages.append({"role": role, "content": content})
        return messages

    def get_message_count(self, session_id: str) -> int:
        # 讲师 p049 [10:26]：这个函数查当前 Redis 里有多少条消息
        return self.redis.llen(self._key(session_id))

    def clear_session(self, session_id: str):
        # 讲师 p049 [10:26]：想清空会话就用这个
        self.redis.delete(self._key(session_id))

    def get_ttl(self, session_id: str) -> int:
        # 讲师 p049 [10:26]：查会话还剩多少秒过期
        return self.redis.ttl(self._key(session_id))


def chat(memory: ConversationMemory, session_id: str, user_input: str) -> str:
    """主函数：把记忆和 Groq 组合起来。"""
    # 1. 先把用户这条写进 Redis
    memory.add_message(session_id, "user", user_input)
    # 2. 取出该 session 的完整历史作为上下文
    history = memory.get_messages(session_id)
    # 3. 发 Groq API 请求
    # 讲师 p049 [10:53]：每次发 API 请求，prompt 和响应都存进 List，保持最新 20 条
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",   # 课里没讲具体模型名，此处用 Groq 常用模型
        messages=history,
    )
    assistant_text = response.choices[0].message.content
    # 4. 把助手这条也写回 Redis
    memory.add_message(session_id, "assistant", assistant_text)
    return assistant_text
```

### 4.2 `p49_memory/demo_memory.py` —— 演示脚本

```python
# p49_memory/demo_memory.py
from memory import ConversationMemory, chat, redis_client

# ---------- 演示 1：单用户记忆 ----------
def demo_single_user():
    mem = ConversationMemory(max_messages=20, ttl_seconds=7200)
    session_id = "demo_session_001"   # 讲师 p049 [11:21]：手动设 session id
    mem.clear_session(session_id)     # 先清空，保证从干净状态开始

    print(chat(mem, session_id, "Hi, my name is Alex. I am learning about Redis."))
    print(chat(mem, session_id, "What is my name?"))
    print(chat(mem, session_id, "What topic am I currently studying?"))
    print(chat(mem, session_id, "Can you give me a quick summary what we have talked about so far?"))

    print("消息总数:", mem.get_message_count(session_id))  # 预期 8
    print("剩余 TTL:", mem.get_ttl(session_id))            # 预期 ~7182


# ---------- 演示 2：多用户隔离 ----------
def demo_multi_user():
    mem = ConversationMemory(max_messages=20, ttl_seconds=7200)
    alice, bob = "session_user_one", "session_user_two"
    mem.clear_session(alice)
    mem.clear_session(bob)

    print("Alice:", chat(mem, alice, "Hi, I'm Alice. I work as a data scientist."))
    print("Bob:", chat(mem, bob, "Hi, I'm Bob. I love cooking."))

    print("Alice 问:", chat(mem, alice, "What's my name and what do I do?"))
    print("Bob 问:", chat(mem, bob, "Do you know someone named Alice?"))


# ---------- 演示 3：滑动窗口小窗口 ----------
def demo_sliding_window():
    # 讲师 p049 [17:02]：max_messages 设 6，TTL 设 300 秒
    mem = ConversationMemory(max_messages=6, ttl_seconds=300)
    session_id = "demo_small_window"
    mem.clear_session(session_id)

    for q in ["What is Python?", "What is JavaScript?", "What is Go?", "What is Rust?"]:
        chat(mem, session_id, q)

    # 4 问 × 2 条 = 8 条，但上限 6，最旧的 2 条（Python 那轮）被挤掉
    print("剩余消息数:", mem.get_message_count(session_id))  # 预期 6
    print("当前窗口:", mem.get_messages(session_id))


# ---------- 演示 4：长期记忆（仅演示，不推荐） ----------
def demo_long_term_hash():
    """讲师 p049 [19:54]：用 hash 存长期记忆，但明确不推荐生产使用。"""
    key = "long_term:user_001"
    # 讲师 p049 [20:22]：用 HSET 存，HGETALL 取，HDEL 删
    redis_client.hset(key, mapping={"name": "Alex", "profession": "data scientist"})
    print(redis_client.hgetall(key))
    redis_client.hdel(key, "profession")
    print(redis_client.hgetall(key))


if __name__ == "__main__":
    demo_single_user()
    demo_multi_user()
    demo_sliding_window()
    demo_long_term_hash()
```

### 4.3 `p50_ratelimit/fixed_window.py` —— 固定窗口限流器

```python
# p50_ratelimit/fixed_window.py
import os
import time
import redis
from dotenv import load_dotenv

load_dotenv()

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True,
)


class FixedWindowRateLimiter:
    """固定窗口限流：按自然窗口计数，窗口一到计数器自动重置。"""

    def __init__(self, limit: int = 10, window_seconds: int = 60):
        # 讲师 p050 [13:46]：limit=10 请求/分钟，window_seconds=60
        self.limit = limit
        self.window_seconds = window_seconds
        self.redis = redis_client

    def _key(self, user_id: str) -> str:
        return f"ratelimit:fixed:{user_id}"

    def check(self, user_id: str) -> bool:
        """返回 True 表示放行，False 表示被限流。"""
        key = self._key(user_id)
        # 讲师 p050 [13:46]：INCR 表示增加（DECR 是减少）
        current = self.redis.incr(key)
        if current == 1:
            # 第一次请求，设窗口 TTL，到点自动重置为 0
            # 讲师 p050 [05:13]：TTL 到了计数器自动重置，不用手动
            self.redis.expire(key, self.window_seconds)
        if current > self.limit:
            # 超限，返回剩余冷却时间给调用方
            ttl = self.redis.ttl(key)
            raise RateLimitExceeded(retry_after=ttl)
        return True


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit reached, retry after {retry_after}s")
```

### 4.4 `p50_ratelimit/sliding_window.py` —— 滑动窗口限流器

```python
# p50_ratelimit/sliding_window.py
import os
import time
import uuid
import redis
from dotenv import load_dotenv

load_dotenv()

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True,
)


class SlidingWindowRateLimiter:
    """滑动窗口限流：从第一个请求的时间戳起算 60 秒，用 ZSET 存时间戳。"""

    def __init__(self, limit: int = 10, window_seconds: int = 60):
        # 讲师 p050 [16:11]：同样 10 请求/分钟
        self.limit = limit
        self.window_seconds = window_seconds
        self.redis = redis_client

    def _key(self, user_id: str) -> str:
        return f"ratelimit:sliding:{user_id}"

    def check(self, user_id: str) -> bool:
        key = self._key(user_id)
        now = time.time()
        window_start = now - self.window_seconds

        # 讲师 p050 [16:11]：用 pipeline 做原子执行
        pipe = self.redis.pipeline()
        # 1. 清掉窗口外的旧记录（按 score=时间戳 删）
        pipe.zremrangebyscore(key, 0, window_start)
        # 2. 数当前窗口内请求数
        pipe.zcard(key)
        # 3. 加入本次请求，member 用「时间戳+uuid」保证唯一，score 用时间戳
        member = f"{now}:{uuid.uuid4().hex}"
        pipe.zadd(key, {member: now})
        # 4. 设 TTL，防止 key 永久残留
        pipe.expire(key, self.window_seconds)
        results = pipe.execute()

        current_count = results[1]   # zcard 的结果
        if current_count >= self.limit:
            # 超限：把刚加进去的这条撤掉，避免污染计数
            self.redis.zrem(key, member)
            ttl = self.redis.ttl(key)
            raise RateLimitExceeded(retry_after=ttl)
        return True


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit reached, retry after {retry_after}s")
```

### 4.5 `p50_ratelimit/demo_llm.py` —— 接 LLM 的限流演示

```python
# p50_ratelimit/demo_llm.py
import os
from groq import Groq
from dotenv import load_dotenv
from fixed_window import FixedWindowRateLimiter, RateLimitExceeded

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def ask_llm_with_limit(limiter, user_id: str, question: str):
    try:
        limiter.check(user_id)
    except RateLimitExceeded as e:
        return f"[BLOCKED] {e}"
    resp = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": question}],
    )
    return resp.choices[0].message.content


if __name__ == "__main__":
    # 讲师 p050 [14:45]：接 LLM 时设 limit=3、window=60
    limiter = FixedWindowRateLimiter(limit=3, window_seconds=60)
    user = "test_user_001"
    for i in range(1, 6):
        print(f"请求 {i}:", ask_llm_with_limit(limiter, user, "What is Redis?"))
```

---

## 5. 逐行解释

### 5.1 为什么用 List 存对话，而不是 String 或 Hash

讲师在 p049 [04:44] 明确说：「你会用 Redis 的 List 数据类型。」原因是对话天然是有序序列，`RPUSH` 追加、`LRANGE` 取全量、`LTRIM` 裁剪，三个操作正好对应「追加一条 / 读上下文 / 滑动窗口」。如果用 String，每次都要读出整个 JSON、改、写回，并发下会丢消息；如果用 Hash，字段无序，没法做「删最旧 N 条」。**在 JS/Node 里对应什么**：相当于你用 `ioredis` 的 `rpush` / `lrange` / `ltrim`，语义完全一致。

### 5.2 `ltrim(key, -max_messages, -1)` 这一行为什么是滑动窗口的核心

`LTRIM key start stop` 只保留 `[start, stop]` 区间。`-20, -1` 表示「从倒数第 20 条到倒数第 1 条」，也就是**永远只留最新 20 条**。讲师 p049 [07:35] 用「上限 5，来第 6 条删最旧」举例，就是这个语义。注意 `ltrim` 是 O(N)（N 是被删的数量），但因为每次只删 1 条，实际是 O(1)。

### 5.3 `expire` 为什么每次写入都要调

讲师 p049 [08:02] 说 TTL 是「自动过期、自动清理」。但 Redis 的 `EXPIRE` 默认是「从设置那一刻起算」，如果只在第一次 `add_message` 时设，那么一个持续活跃的会话也会在 2 小时后被清空——这通常不是想要的。所以代码里每次 `add_message` 都刷新 TTL，实现「活跃即续期」。**课里没讲**是否每次刷新，这里按常见做法补全；如果你要严格「从会话创建起算 2 小时」，把 `expire` 移到 `if not exists` 分支即可。

### 5.4 `get_messages` 里 `partition(":")` 的坑

存的时候是 `f"{role}:{content}"`，取的时候用 `partition(":")` 按第一个冒号切。**风险**：如果用户输入本身含冒号（比如「我的邮箱是 a@b.com:8080」），`partition` 只切第一个冒号，role 部分仍是 `user`，content 保留剩余全部——这是安全的。但如果 content 以冒号开头，role 会变成空串。生产环境建议改成 JSON 序列化（`json.dumps({"role":..., "content":...})`），课里没讲，属于你会撞上的坑。

### 5.5 固定窗口的 `INCR` + `EXPIRE` 为什么能工作

`INCR` 是原子操作，返回自增后的值。第一次请求返回 1，此时设 `EXPIRE 60`；之后 59 秒内每次 `INCR` 都返回 2、3、4……到 60 秒时 key 过期被删，下一次 `INCR` 又从 1 开始。讲师 p050 [05:13] 说的「计数器自动重置为 0，你不用手动做任何事」就是这个机制。**注意**：`INCR` 和 `EXPIRE` 是两条命令，不是原子的——如果 `INCR` 后进程崩溃、`EXPIRE` 没执行，key 会永不过期。生产环境要用 `SET key 0 EX 60 NX` + `INCR` 或 Lua 脚本。课里没讲这个边界，属于你会撞上的坑。

### 5.6 固定窗口的漏洞：为什么 2 秒能发 20 个请求

讲师 p050 [09:59] 的例子：限制 10 请求/分钟。12:01:59 发 10 个（计数器到 10），12:02:00 分钟一变、key 过期、计数器归零，再发 10 个（计数器又到 10）。**2 秒内实际发了 20 个**，是限额的 2 倍。根因是固定窗口的「窗口边界」和「请求到达时间」无关，攻击者可以卡在边界两侧。**在 JS/Node 里对应什么**：如果你用 `express-rate-limit` 的默认内存 store，它就是固定窗口，同样有这个漏洞。

### 5.7 滑动窗口为什么能堵住：ZSET 的 score 就是时间戳

滑动窗口不用「自然分钟」，而是「从当前时刻往回数 60 秒」。实现上把每次请求的时间戳作为 ZSET 的 score 存进去，每次新请求来：先 `ZREMRANGEBYSCORE key 0 (now-60)` 删掉 60 秒前的记录，再 `ZCARD` 数剩下的，如果小于 limit 就 `ZADD` 加入本次。这样「12:01:59 发的 10 个」在 12:02:00 时仍然在窗口内（才过了 1 秒），`ZCARD` 返回 10，第 11 个请求直接被拒——攻击失效。讲师 p050 [11:57] 说的「从第一个请求开始计时 60 秒」就是这个意思。

### 5.8 为什么滑动窗口更贵：每次都要算时间戳

讲师 p050 [18:01] 算了一笔账：滑动窗口每次请求都要 `ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` 三条命令，还要算时间戳、生成唯一 member。单次看是微秒级，但「几百万个请求、几百万次时间戳计算」累积起来就是实打实的 CPU 和内存开销。固定窗口只有一条 `INCR`，便宜得多。所以讲师的建议是：**能接受边界漏洞就用固定窗口，但把限额设得留余量**（服务器能扛 10/分钟，就设 3/分钟，攻击者卡边界最多发 6 个，仍安全）。

### 5.9 多副本共享计数器：为什么必须用 Redis 而不是进程内变量

讲师 p050 [06:11] 的场景：K8s 上 3 个 app 副本，如果每个副本用自己进程内的计数器，那么「每分钟 100 请求」实际会变成「每个副本 100、总共 300」。把三个副本都接到同一个 Redis，`INCR` 的是同一个 key，总计数器才是真正的全局值。这也是 Redis 相比「进程内限流库」的核心优势。**在 JS/Node 里对应什么**：`express-rate-limit` 默认用内存 store，多副本部署时同样会失效，必须换成 `rate-limit-redis`。

### 5.10 原子性：为什么两个并发请求不会拿到同一个计数

讲师 p050 [03:46] 的例子：计数器当前 7，两个请求同时到。普通「读-改-写」会两个都读到 7、都写回 8，丢一次计数。Redis 的 `INCR` 是单线程执行的原子命令，两个请求会分别拿到 8 和 9。**在 JS/Node 里对应什么**：Node 是单线程，但 `await` 会让出执行权，两个并发请求仍可能交错；用 Redis 的原子命令就绕开了这个问题。

---

## 6. 复现检查清单

**P49 记忆部分**

- [ ] `docker run` 起 Redis，`redis-cli ping` 返回 `PONG`
- [ ] `.env` 里 `GROQ_API_KEY` 有效，`python -c "from groq import Groq; ..."` 能跑通
- [ ] `ConversationMemory(max_messages=20, ttl_seconds=7200)` 实例化成功
- [ ] 单用户演示：问「What is my name?」能答出「Alex」
- [ ] 单用户演示：问「What topic am I studying?」能答出「Redis」
- [ ] `get_message_count` 返回 8（4 user + 4 assistant）
- [ ] `get_ttl` 返回 ~7182（不是 7200，因为已经过了几秒）
- [ ] 多用户演示：Bob 会话问「Do you know Alice?」答「不知道」
- [ ] 滑动窗口演示：4 问后 `get_message_count` 返回 6（不是 8）
- [ ] 滑动窗口演示：`get_messages` 里第一条是 JavaScript 那轮，Python 那轮已被挤掉
- [ ] 长期记忆 hash 演示能跑通（但记住：不推荐生产用）

**P50 限流部分**

- [ ] `FixedWindowRateLimiter(limit=5, window_seconds=30)` 连发 8 个，前 5 allowed、后 3 blocked
- [ ] `FixedWindowRateLimiter(limit=3, window_seconds=60)` 接 LLM，第 4 个请求返回 `[BLOCKED] ... retry after 52s`
- [ ] 等 60 秒后，第 4、5 个请求能正常返回
- [ ] `SlidingWindowRateLimiter(limit=10, window_seconds=60)` 正常场景下行为与固定窗口一致
- [ ] 用 `redis-cli keys "ratelimit:*"` 能看到计数器 key
- [ ] 用 `redis-cli ttl "ratelimit:fixed:test_user_001"` 能看到剩余秒数

**通用**

- [ ] 所有代码文件能 `python xxx.py` 直接跑，无 ImportError
- [ ] 没有把 API key 硬编码进代码（都在 `.env`）

---

## 7. 课里没讲但你会撞上的

1. **`decode_responses=True` 必须加。** 课里没提，但不加的话 `lrange` 返回 `bytes`，`partition(":")` 会报 `TypeError`。这是新手第一个坑。
2. **`INCR` + `EXPIRE` 不是原子的。** 课里只讲了「TTL 自动重置」，没讲进程崩溃导致 key 永不过期的边界。生产环境用 Lua 脚本或 `SET NX EX` 兜底。
3. **滑动窗口的 `ZADD` 在超限时要撤回。** 课里没讲这个细节。如果先 `ZADD` 再判断超限，被拒的请求也会占一个名额，导致窗口内实际可用数比 limit 少。上面代码里用 `zrem` 撤回了。
4. **`ZREMRANGEBYSCORE` 的区间是闭区间。** `0` 到 `now-60` 会把正好 60 秒前的记录也删掉，边界上可能多放行 1 个。要精确的话用 `(now-60`（开区间），课里没讲。
5. **多副本部署时 `session_id` 要全局唯一。** 课里手动设 `demo_session_001`，生产环境要用 `uuid4()` 或用户 ID + 设备指纹，否则两个用户可能撞到同一个 session。
6. **Groq 的模型名课里没讲。** 代码里用的 `llama-3.1-8b-instant` 是 Groq 常用模型，实际以你账号可用的为准；如果报 `model_not_found`，去 Groq 控制台查当前模型列表。
7. **长期记忆用 Redis 的 hash 只是演示。** 讲师反复强调「不要用 Redis 做长期记忆」（p049 [19:25]），因为 RAM 容量有限（他举的例子：1 年对话 3 GB，但 Redis 只分了 2 GB RAM）。生产环境长期记忆应该用向量数据库（如 Pinecone、Weaviate）或 SQL 数据库。
8. **`RateLimitExceeded` 的 `retry_after` 来自 `TTL` 命令。** 如果 key 刚好在这一刻过期，`TTL` 返回 `-2`，提示会变成「retry after -2s」。课里没讲这个边界，实际用的时候要 `max(ttl, 0)`。
9. **固定窗口的「留余量」策略是讲师的间接方案。** 讲师 p050 [18:56] 说：服务器能扛 10/分钟，就把限额设 3/分钟，攻击者卡边界最多发 6 个，仍安全。这不是算法层面的修复，是运维层面的妥协，课里明确说了「这是间接 approach」。
10. **课里没讲 RAG 缓存。** 讲师在 p049 [00:00] 说「RAG caching 留到后续模块」，p050 [19:41] 也说「下一个模块是 RAG caching」。这两节只覆盖了 memory 和 rate limiting 两个用例，第三个用例（RAG 缓存）不在本文档范围内。