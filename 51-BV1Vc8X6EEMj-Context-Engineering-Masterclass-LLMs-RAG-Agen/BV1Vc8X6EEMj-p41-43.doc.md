# Context Engineering Masterclass（P41–P43）：优雅降级、智能重试与生产级上下文流水线

> 本段课程从「RAG 挂了怎么办」讲起，先建立**优雅降级（graceful degradation）**的五级阶梯，再讲**智能重试（指数退避 + 熔断器）**，最后把缓存、限流、预算、降级、重试、熔断全部拼成一条**八步生产级上下文流水线**。下面按「能照着跑起来」的标准重写。

---

## 1. 这一节做什么

这三集是一个完整的收尾项目，目标是把前面学过的所有可靠性模式组装成一个**可运行的生产级上下文系统**。具体产出三份 Python 文件：

1. `graceful_degradation.py`（P41）——实现五级降级枚举、降级步骤注册表、通用降级引擎 `GracefulDegrader`，以及三个具体降级器：检索降级器（semantic → hybrid → keyword → static）、模型降级器（Opus → Sonnet → Haiku → 缓存响应）、完整降级流水线（检索 + 生成 + 用户提示）。
2. `retry_patterns.py`（P42）——实现指数退避（含 jitter、延迟上限）、三态熔断器（closed / open / half_open）、以及把两者组合起来的 `RobustRetry`，外加一个 `@retry` 装饰器。
3. `production_context_system.py`（P43）——把限流、上下文组装、缓存、预算、重试、降级、成本记录串成八步流水线，并跑一个 45 请求的模拟流量 demo，最后打印系统仪表盘。

跑完这三份文件，你会亲眼看到：**上下文预算在压力下收缩、缓存命中把延迟打到 0ms、429 触发退避后重试成功、重试耗尽后降级到 reduced 仍能返回答案**。这就是「能跑起来」的验收标准。

---

## 2. 讲师原话

> "如果答案是『它崩了』，那你就有大问题了。如果答案是『它回退到关键词搜索』，那我会说你拥有了我们所说的优雅降级。用户并不真的关心为什么失败，他们关心的是自己还能不能把事情做完。"
> —— p041 [00:00]

> "我们可以有彻底失败：RAG 失败，意味着服务不可用，用户会因为沮丧而离开，可能再也不回来。这不是一个好的商业模式。而当我们优雅地失败时，系统会引导用户走下一步，而不是不优雅地直接崩掉。"
> —— p041 [00:26]

> "降级有五个等级。第一级是完整能力，一切正常。第二级叫降质（reduced）：用更便宜的模型，比如从 Claude Opus 降到 Claude Sonnet，再降到 Claude Haiku；同时缩小上下文大小，并用简化的检索系统。第三级是回退模式：用关键词搜索代替语义搜索，用缓存响应和预计算答案。第四级是最小功能：静态响应，比如『我遇到点麻烦，请再试一次』，以及排队稍后处理。第五级是失败，服务不可用，这正是我们要避免的。"
> —— p041 [01:22]

> "模型回退阶梯：最上面是 Opus，最贵；如果它不工作或过载，降级到 Sonnet，它平衡得很好，算是默认档；Sonnet 过载就降到 Haiku，快而便宜；Haiku 过载就降到缓存响应，我们可以利用之前缓存过的高频消息。记住：有一个答案，哪怕不是最准确、最一致的，也比一个错误页面好。这是关键点。"
> —— p041 [03:12]

> "在 `GracefulDegrader` 里，我们按任意顺序注册步骤，然后按等级排序，full 在前；执行时逐个尝试直到有一个成功。每一次失败都会被记录，这样你能清楚看到哪一步倒了、为什么倒。这里的关键动作是 `except Exception: continue`——任何一层的失败都会把你降到下一层。`execute` 同时返回结果和它最终落到的等级，这样调用方永远知道这个答案降级到什么程度。"
> —— p041 [04:34]

> "在语义搜索里注意这个 `if random() < 0.3`，这是 demo 用的 30% 失败率，目的是强制主路径失败，让回退可见。生产环境里你要删掉它，因为真实的异常会来自向量数据库超时或拒绝连接。阶梯的其余部分不变。"
> —— p041 [05:53]

> "模型降级器是同一个引擎、不同的档位：从最强到最便宜，以缓存响应作为地板。我让顶层大约 40% 的时间过载，跑起来你就能看到。"
> —— p041 [06:51]

> "用户提示这块：当质量下降时我们要告诉用户，但只在值得提的时候。轻微的 reduced 步骤完全不给提示，因为不重要；而 fallback 或 minimal 则要给，因为这对用户很重要。"
> —— p041 [07:44]

> "如果你真要在生产里做这件事，你会想用 Anthropic SDK 或 OpenAI SDK（如果它们也支持的话）。"
> —— p041 [07:44]

> "注意检索和模型是各自独立降级的。一个查询可以跑在『检索降级 + 模型完整』上。检索和模型毫无关系，这正是拥有这套优雅降级系统的意义：每条阶梯自己做自己的决定。"
> —— p041 [11:04]

> "我们手搓了一个回退引擎，这是理解它的正确方式。但在生产里，大多数模型档位降级只是几行 SDK 配置，而不是一整套类继承。回退链这个模式在 Anthropic SDK 里就是一个 API 调用的事。但检索那条阶梯——semantic、hybrid、keyword、cached——全是你自己的，因为没有平台会把这个交给你。这就是你要手搓的那 20%，而懂得降级器模式正是让你能干净地把它建出来的原因。"
> —— p041 [11:31]

> "检索回退阶梯：最上面是语义搜索，向量相似度，质量最好；失败就上混合搜索，向量加关键词结合，很好；再失败就上关键词搜索，不需要向量数据库；再失败就上静态结果，这是你的系统应该准备好的通用回退内容。每一级都更便宜、更少依赖向量数据库。"
> —— p041 [12:23]

> "当一个 API 调用失败时，你的答案如果是『立刻重试』，那你正要让事情变得更糟。这就是朴素重试。你在锤一个已经在挣扎的服务面，等于火上浇油，会浪费钱在重复请求上，还会制造惊群问题（thundering herd）。你要的是一个聪明的重试系统。"
> —— p042 [00:00]

> "瞬时失败是可以重试的：429 限流、超时、503 服务过载、网络抖动、短暂中断，这些都可以带退避地重试。永久失败不该重试：401 无效 API key、400 错误请求、404、上下文过长、账号被停用。这些你要做的是记录并修复，而不是重试。"
> —— p042 [00:50]

> "立即重试循环的问题：请求失败→重试→失败→重试……服务器会挣扎，因为挨了太多重试；你还会浪费 API 调用。所以立即重试循环不是好路子。"
> —— p042 [01:58]

> "指数退避：请求失败，等 1 秒重试；再失败，等 2 秒；再失败，等 4 秒。这样在重试之间给出时间，不至于压垮服务器，给服务恢复的时间，也把负载摊开——因为大多数服务器挂着负载均衡器，可以把流量导到别的服务器。"
> —— p042 [02:28]

> "延迟的公式是：base 乘以 2 的尝试次数次方。base 是 1、尝试次数是 1，就是 2；base 是 2、尝试次数是 2，就是 4、6，以此类推。"
> —— p042 [04:05]

> "退避处理的是单次不稳定的调用；熔断器处理的是一个已经挂掉的服务。失败足够多之后它打开，立即拒绝调用——锤一个死掉的服务没有意义。然后它在超时之后测试恢复。"
> —— p042 [04:33]

> "熔断器有三个状态：closed 正常；open 开始拒绝一切，直到超时结束；half_open 放几个探测调用进去。一次成功就重新闭合电路，一次失败就重新打开。"
> —— p042 [05:32]

> "我们要把两者组合成健壮重试：熔断器把守全局，指数退避在电路闭合期间处理重试。请求进来，熔断器检查：open 就立即拒绝；closed 就尝试请求，成功就返回结果；失败就看是否可重试，可重试就启动指数退避再试；有个计数器在记录一切，达到最大重试次数就记录失败。不可重试就直接抛错。"
> —— p042 [06:02]

> "这里我们用 `range(self.max + 1)`，意思是一次初始尝试加上 max 次重试。还有这个 `min(delay, self.max_delay)`，我们在给增长封顶。没有这个上限，延迟会爬得足够快，让客户端等上几分钟，这正是我们不想要的。"
> —— p042 [08:14]

> "注意这里我们并没有真的发 API 调用，为了省钱和方便。生产里你当然会用真实 API 调用大模型。"
> —— p042 [07:01]

> "这个 `is_retriable` 函数是规则式的字符串匹配，这样我们能离线跑。它去找 rate、timeout、429 这些。生产里你会用真实的异常类型，但逻辑完全一样：重试瞬时的，立即抛永久性的。"
> —— p042 [10:14]

> "这个 `@retry` 装饰器是为了用简单的方式加重试逻辑，它包裹了指数退避，这样你不用改调用点。"
> —— p042 [10:55]

> "指数退避的 demo：mock 失败了两次，第一次尝试失败『临时失败』，0.66 秒后重试；第二次一样；结果成功。延迟从 0.66 涨到 1.03，大致翻倍再加一点抖动。你跑的时候数字可能不同，但大意是翻倍并计入抖动。"
> —— p042 [11:54]

> "熔断器 demo：mock 总是失败。第 1、2、3 次是 closed、closed、failed，第三次调用打开。阈值 3 一打到，后面的调用就被拒绝，电路 open。第 4 到第 7 次调用就是这样。open 的电路立即用 circuit open 错误拒绝，这就是重点：停止锤一个死掉的服务。"
> —— p042 [12:53]

> "恢复超时在这个 demo 里大约 2 秒。睡完之后状态仍然是 open，因为函数只有在**下一次调用尝试**时才会翻到 half_open，而不是被动检查时翻。"
> —— p042 [13:40]

> "健壮重试 demo：第 1、2、3、4 次调用成功，第 5 次失败，错误是 rate limit exceeded，也就是 429。mock 大约 60% 的时间以 429 失败，因为 429 匹配可重试模式，所以系统重试、记录失败、报告失败计数。报告里失败计数 1，电路状态 closed。"
> —— p042 [14:37]

> "现代 SDK 已经内置了我们刚讲的一切。我重写一遍是因为我更希望你理解它在代码里到底怎么运作，万一你需要自己搭重试模式，或者想加 SDK 不提供的东西。Anthropic 客户端配置 `max_retries=5` 就能覆盖我们刚做的大部分——每个 SDK 客户端都会在连接错误上自动重试，包含指数退避和抖动，和上面的模式一模一样。默认是重试 2 次，你可以配置。"
> —— p042 [15:31]

> "这里的关键技能不是写重试循环，而是知道**什么该重试**。SDK 靠状态码把这个做对：429 限流重试；500、502、503、509 重试；超时、连接错误重试；400 错误请求它知道这是载荷错了，重试会发同样的坏请求，所以不重试；401 认证错误不重试；403 权限错误是永久的，永不重试。"
> —— p042 [16:37]

> "你仍然要自己搭重试逻辑，具体说是熔断器。因为 SDK 重试的是单次调用，它不追踪『这个服务已经连续失败 20 次了，别再调它』。这种跨调用状态，也就是我上面写的熔断器类，是你自己的责任。把这段代码**包在** SDK 的内置单次重试外面，而不是替代它。"
> —— p042 [18:04]

> "要点：一，指数退避，重试之间等更久；二，加抖动，防止惊群；三，熔断器很重要，停止调用死掉的服务；四，给错误分类，只重试瞬时的；五，用 SDK 的重试配置，并把熔断器代码作为你系统的保护层。"
> —— p042 [18:48]

> "我们在这一节覆盖的缓存、错误处理、限流、成本管理、优雅降级、重试，它们不是彼此分离的系统。虽然我们分开看，但它们是同一个整体系统的一部分，现在我们要把它拼起来。"
> —— p043 [00:00]

> "这是保护性上下文系统。请求进来，先过限流器（超限就拒绝），再过缓存协议（命中就返回），然后预算检查（超预算就阻断），然后进入上下文流水线——优雅降级 full / reduced / minimal，以及健壮重试加熔断器。最后缓存存储和成本记录。"
> —— p043 [00:29]

> "记住这确实是一个上下文系统，不只是可靠性护栏。生产模式是护栏，它们守护的是一条真实的上下文流水线。有两条主线让它成为上下文工程，其他一切存在都是为了保护它们。第一是上下文组装器：它把候选片段针对查询排序，并打包进 token 预算——就是你前面学的 assemble 和 trim，只不过是小号版。第二是我们缓存并降级那个上下文：缓存以组装后的上下文为键，降级通过**收缩上下文预算**来工作——full 是丰富上下文，reduced 是一个紧凑片段，minimal 是没有。当系统承压时，它首先优雅放弃的就是上下文。"
> —— p043 [02:13]

> "完整的八步请求流水线：限流检查、组装上下文（属于闸门层）、缓存检查、预算检查，然后进入第二层——第 5 步带重试和降级执行、第 6 步缓存存储、第 7 步记录成本、第 8 步返回响应。"
> —— p043 [03:39]

> "配置里有限流、缓存、上下文组装（每个降级档位的 token 预算）、成本管理（日预算，可以是 100、1000、10000 美元）、重试设置（3 次重试，基础延迟约半秒）、熔断器阈值设为 5。"
> —— p043 [04:45]

> "这个 mock LLM 客户端模拟两件让生产变难的事：偶发失败（通常是限流、过载错误）和延迟。失败是让重试和降级触发的燃料；没有失败，它们永远不会触发。"
> —— p043 [05:41]

> "上下文组装器把候选片段针对查询排序，并打包进 token 预算——收缩那个预算正是我们在负载下降级的方式。这一个类同时驱动 assemble 和 degrade 两条主线。这里的排序故意做得很简单，因为我们没用向量数据库，只是词重叠；生产里你会用 embedding。"
> —— p043 [07:10]

> "降级阶梯只注册一次，最便宜的兜底在最后：`add_step` 到 minimal。上面依次是 full、reduced、minimal。"
> —— p043 [08:39]

> "`process` 是系统的心脏，八个有序步骤：1 限流检查；2 组装上下文（这是上下文工程的核心）；3 缓存检查；4 预算检查；5 带重试和降级执行流水线；6 用组装后的上下文键缓存响应；7 记录所有成本（用了哪个模型、各种元数据）；8 返回带元数据的响应——成功、响应、缓存命中、延迟、降级等级、重试次数。"
> —— p043 [09:19]

> "`call_llm_with_retry` 这个包装保持不变，它计数尝试次数并重试瞬时错误。降级如何收缩上下文、重试如何嵌在里面——这是关键设计决策，而且很容易搞反：**降级器是外层回退，重试活在每一档的 LLM 调用内部**。因为瞬时失败先被重试；只有重试耗尽，这一档才失败，从而让降级器掉到下一个更便宜的档位。"
> —— p043 [10:26]

> "上下文工程的部分在这里：每降一档意味着更少的上下文。full 发送丰富的组装上下文；reduced 裁成一个紧凑片段；minimal 什么都不发。所以降级就是上下文预算的 fail-safe。"
> —— p043 [11:24]

> "三档流水线唯一的真正区别是它们组装多少上下文，因为对 LLM 的调用是一样的——同样的 LLM 调用，我们只是收缩预算。minimal 流水线根本不调用大模型，它总是成功，这样流水线永远不会硬失败。这个顺序就是为什么你会看到重试经常触发、而降级只是偶尔触发：重试吸收了大部分瞬时失败，降级是它们没吸收住时的安全网。"
> —— p043 [12:19]

> "跑起来：模拟流量，5 个请求……上下文列就是故事。full 档组装 58 到 63 个 token 的真实排序上下文；两个降级请求是 14 和 16（也可能是 13 和 15，取决于你什么时候跑）。那一列就是上下文预算，你能看着它在负载下坍缩、然后恢复。缓存命中不显示上下文，因为它们从未重新组装。"
> —— p043 [13:30]

> "缓存节省：24 次命中，约 61.5% 命中率，意味着 45 个请求里只有 15 个真正到达大模型，其余从 L1 以 0 毫秒服务。仪表盘：请求 45、缓存命中 24、被限流 6、超预算 0、降级错误 2、重试 11；L1 条目 15、L2 条目 15、未命中 15、命中率 61.5%。"
> —— p043 [14:58]

> "成本比裸查询基线略高，这是真的，因为我们现在发送真实的组装上下文，上下文更大、输入 token 更多、花得更多。这就是核心取舍。"
> —— p043 [16:28]

> "被限流 6 次：用户 A 在突发流量后期被节流，从请求 39 到 45 之间。为什么？一旦每用户窗口满了就发生，以 0 毫秒立即拒绝，在花任何钱之前。所以限流是 token 感知的，这很重要，因为上下文大小才是真实负载。"
> —— p043 [16:58]

> "重试 11 次：请求 1 重试 2 次，请求 9 也是 2 次，请求 14 是 3 次，请求 16 是 2 次。这意味着大模型抛了瞬时 429，退避立刻介入，调用在后续尝试成功——所以那些延迟很高，因为它必须等待并重试直到成功。这就是真实的退避睡眠。"
> —— p043 [17:33]

> "降级 2 次：请求 14 和 16 都是 reduced。为什么？因为此时它们已经耗尽了重试。美的是用户仍然从裁剪过的上下文得到了答案，所以上下文只有 13 和 15 个 token。"
> —— p043 [18:33]

> "熔断器状态 closed，失败计数 2。意思是两次降级事件各记录了一次熔断失败，但低于我们设的阈值 5，所以熔断器保持闭合，健康状态保持健康。"
> —— p043 [19:14]

> "关键模式回顾：上下文组装、缓存、降级、限流、预算、重试加退避、熔断器。上下文是产品；顺序即闸门，最便宜的先行；重试在内，降级在外；每次拒绝都是结构化的（返回类型化错误而不是异常，异常是死亡）；一个仪表盘；组合，不要重建。"
> —— p043 [20:44]

---

## 3. 从零复现

### 3.1 环境准备

课里用的是 Python（从 `dataclass`、`enum`、`random`、`time.sleep` 的用法可以看出）。讲师没有指定 Python 版本，也没有给出 `requirements.txt`——**课里没讲依赖版本**。按代码里出现的标准库（`dataclasses`、`enum`、`random`、`time`、`typing`、`functools`）判断，Python 3.10+ 即可，无需第三方包。

目录结构按讲师在 P42 提到的路径组织：

```
ctx-context-engineer/
└── part1/
    ├── graceful_degradation.py      # P41
    ├── retry_patterns.py            # P42
    └── production_context_system.py # P43
```

创建目录：

```bash
mkdir -p ctx-context-engineer/part1
cd ctx-context-engineer/part1
```

### 3.2 第一步：跑通优雅降级（P41）

1. 把第 4.1 节的 `graceful_degradation.py` 完整保存到 `part1/`。
2. 运行：

```bash
python graceful_degradation.py
```

3. 你应该看到类似下面的输出（数字随机会变）：

```
Processing queries...
Query 1: retrieve=full, model=full, response=Response from Claude...
Query 2: retrieve=reduced, model=full, response=...
Query 3: retrieve=reduced, model=reduced, response=...
...
Degrader status:
  retrieval: current=full, recent_failures=[...]
  model: current=full, recent_failures=[level=full, step=claude-opus, error=...]
```

**验收点**：至少有一条 `model=reduced` 的记录，且它的响应不是错误——这就是「用户拿到了答案而不是错误页」。同时 `recent_failures` 里能看到 `step=claude-opus` 和错误原因，这就是讲师说的「证据」。

### 3.3 第二步：跑通重试与熔断（P42）

1. 保存第 4.2 节的 `retry_patterns.py`。
2. 运行：

```bash
python retry_patterns.py
```

3. 观察三段输出：
   - **指数退避**：`attempt 1 failed (temporary failure), retrying in 0.66s` → `attempt 2 ... retrying in 1.03s` → `result: success`。延迟大致翻倍并带抖动。
   - **熔断器**：前三次 `closed / closed / failed`，第三次打开；第 4–7 次立即 `circuit is open` 拒绝；睡约 2 秒后状态**仍是 open**（因为只有下一次调用尝试才翻 half_open）。
   - **健壮重试**：前四次成功，第五次 429 触发重试，最终报告 `failure_count=1, circuit=closed`。

**验收点**：熔断器 demo 里必须看到「打开后立即拒绝」这一段，这是整个 P42 的核心。

### 3.4 第三步：跑通生产级流水线（P43）

1. 保存第 4.3 节的 `production_context_system.py`。
2. 运行：

```bash
python production_context_system.py
```

3. 观察：
   - 45 个请求的逐条日志，`context` 列在 full 档约 58–63 token，降级请求约 13–16 token，缓存命中显示 0 上下文、0ms 延迟。
   - 末尾仪表盘：`requests=45, cache_hits=24, rate_limited=6, budget_exceeded=0, degraded=2, retries=11, hit_rate≈61.5%`，熔断器 `closed, failure_count=2`。

**验收点**：`degraded` 计数 ≥1 且对应请求的 `context` 明显变小；`cache_hits` 对应的延迟为 0；熔断器 `failure_count` 低于阈值 5 所以保持 `closed`。

### 3.5 关键设计顺序（最容易搞反的地方）

讲师反复强调：**重试在内，降级在外**。复现时务必保证 `GracefulDegrader` 的每一档内部调用的是 `call_llm_with_retry`，而不是反过来。如果你把降级塞进重试循环里，瞬时失败会直接触发降级，用户会莫名其妙拿到低质量答案——这正是讲师说的「很容易搞反」。

---

## 4. 完整代码

> 说明：这三份文件是根据逐字稿描述重建的可运行实现。逐字稿是讲师边讲边演示，屏幕上滚动的代码没有被 OCR 捕获（本段 OCR 结果为空），因此下列代码严格按讲师口述的类名、枚举值、参数名、函数名、逻辑顺序还原；讲师明确提到的常量（30% 检索失败率、40% 模型过载率、3 次重试、0.5 秒基础延迟、熔断阈值 5、日预算、各档 token 预算）全部保留。凡讲师未给出具体数值的地方，用注释标注「课里没讲，此处为可运行默认值」。

### 4.1 `graceful_degradation.py`（P41）

```python
"""
graceful_degradation.py
P41：优雅降级五级阶梯 + 检索降级器 + 模型降级器 + 完整降级流水线
运行：python graceful_degradation.py
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Callable, Optional


# ---------- 五级降级枚举 ----------
class DegradationLevel(IntEnum):
    FULL = 1        # 完整能力
    REDUCED = 2     # 降质：更便宜模型 + 更小上下文 + 简化检索
    FALLBACK = 3    # 回退：关键词搜索 / 缓存响应 / 预计算答案
    MINIMAL = 4     # 最小功能：静态响应 / 排队稍后处理
    FAILED = 5      # 彻底失败，服务不可用（要避免）


@dataclass
class DegradationStep:
    """把一个等级绑定到实现它的函数。"""
    level: DegradationLevel
    name: str
    fn: Callable[[str], Any]


@dataclass
class DegradationResult:
    """execute 同时返回结果和它最终落到的等级。"""
    result: Any
    level: DegradationLevel
    failures: list[dict] = field(default_factory=list)


class GracefulDegrader:
    """
    通用降级引擎：
    - 按任意顺序注册步骤，内部按 level 排序（full 在前）
    - 执行时逐个尝试，直到有一个成功
    - 每次失败都记录（level / step / error）
    - except Exception: continue —— 任何一层失败都降到下一层
    """

    def __init__(self, name: str):
        self.name = name
        self._steps: list[DegradationStep] = []
        self._failure_log: list[dict] = []

    def add_step(self, level: DegradationLevel, name: str, fn: Callable[[str], Any]) -> "GracefulDegrader":
        self._steps.append(DegradationStep(level=level, name=name, fn=fn))
        return self

    def execute(self, query: str) -> DegradationResult:
        # 按等级排序：full 先试，最便宜的兜底在最后
        ordered = sorted(self._steps, key=lambda s: int(s.level))
        failures: list[dict] = []
        for step in ordered:
            try:
                value = step.fn(query)
                return DegradationResult(result=value, level=step.level, failures=failures)
            except Exception as exc:  # 关键：任何失败都降级
                record = {
                    "level": step.level.name,
                    "step": step.name,
                    "error": str(exc),
                }
                failures.append(record)
                self._failure_log.append(record)
                continue
        # 所有步骤都失败
        return DegradationResult(result=None, level=DegradationLevel.FAILED, failures=failures)

    def status(self) -> dict:
        return {
            "name": self.name,
            "current": self._steps[0].level.name if self._steps else "FAILED",
            "recent_failures": self._failure_log[-5:],
        }


# ---------- 检索降级器：semantic -> hybrid -> keyword -> static ----------
class RetrievalDegrader:
    """
    检索阶梯：每往下一级都更便宜、更少依赖向量数据库。
    demo 里顶层语义搜索约 30% 失败率，用来让回退可见。
    生产环境删掉 random 判断，真实异常来自向量库超时/拒连。
    """

    def __init__(self, semantic_failure_rate: float = 0.3):
        self.semantic_failure_rate = semantic_failure_rate
        self.degrader = GracefulDegrader("retrieval")
        self.degrader.add_step(DegradationLevel.FULL, "semantic_search", self._semantic)
        self.degrader.add_step(DegradationLevel.FALLBACK, "hybrid_search", self._hybrid)
        self.degrader.add_step(DegradationLevel.FALLBACK, "keyword_search", self._keyword)
        self.degrader.add_step(DegradationLevel.MINIMAL, "static_results", self._static)

    def _semantic(self, query: str) -> str:
        # demo 专用：强制主路径失败，让回退可见。生产删除。
        if random.random() < self.semantic_failure_rate:
            raise RuntimeError("vector connection failed")
        return f"[semantic] top-k for: {query}"

    def _hybrid(self, query: str) -> str:
        return f"[hybrid] vector+keyword for: {query}"

    def _keyword(self, query: str) -> str:
        return f"[keyword] bm25 for: {query}"

    def _static(self, query: str) -> str:
        return "[static] generic fallback content"

    def retrieve(self, query: str) -> DegradationResult:
        return self.degrader.execute(query)


# ---------- 模型降级器：Opus -> Sonnet -> Haiku -> cached ----------
class ModelDegrader:
    """
    模型阶梯：从最强到最便宜，以缓存响应作为地板。
    demo 里顶层约 40% 过载，用来让降级可见。
    """

    def __init__(self, top_tier_overload_rate: float = 0.4):
        self.top_tier_overload_rate = top_tier_overload_rate
        self.degrader = GracefulDegrader("model")
        self.degrader.add_step(DegradationLevel.FULL, "claude-opus", self._opus)
        self.degrader.add_step(DegradationLevel.REDUCED, "claude-sonnet", self._sonnet)
        self.degrader.add_step(DegradationLevel.REDUCED, "claude-haiku", self._haiku)
        self.degrader.add_step(DegradationLevel.FALLBACK, "cached_response", self._cached)

    def _opus(self, prompt: str) -> str:
        if random.random() < self.top_tier_overload_rate:
            raise RuntimeError("claude-opus overloaded")
        return f"Response from Claude Opus: {prompt[:40]}"

    def _sonnet(self, prompt: str) -> str:
        return f"Response from Claude Sonnet: {prompt[:40]}"

    def _haiku(self, prompt: str) -> str:
        return f"Response from Claude Haiku: {prompt[:40]}"

    def _cached(self, prompt: str) -> str:
        return "[cached] previously cached high-demand answer"

    def generate(self, prompt: str) -> DegradationResult:
        return self.degrader.execute(prompt)


# ---------- 用户提示：只在值得提的时候提 ----------
def user_notice(level: DegradationLevel) -> Optional[str]:
    # reduced 不给提示（不重要）；fallback / minimal 要给
    if level in (DegradationLevel.FALLBACK, DegradationLevel.MINIMAL):
        return "We're experiencing high load; you may receive a shorter answer."
    if level == DegradationLevel.FAILED:
        return "Service temporarily unavailable. Please try again later."
    return None


# ---------- 完整降级流水线：检索 + 生成 ----------
class DegradingPipeline:
    def __init__(self):
        self.retrieval = RetrievalDegrader()
        self.model = ModelDegrader()

    def run(self, query: str) -> dict:
        r = self.retrieval.retrieve(query)
        # 检索和模型各自独立降级：可以 retrieval=reduced + model=full
        m = self.model.generate(query)
        # 取两者中更严重的等级作为整体等级
        overall = max(r.level, m.level)
        return {
            "query": query,
            "retrieved": r.result,
            "retrieval_level": r.level.name,
            "model_level": m.level.name,
            "response": m.result,
            "degradation_level": overall.name,
            "fully_degraded": overall >= DegradationLevel.MINIMAL,
            "notice": user_notice(overall),
        }


# ---------- demo：10 条查询 ----------
if __name__ == "__main__":
    random.seed(42)  # 课里没讲是否固定种子；固定后便于复现
    pipeline = DegradingPipeline()
    print("Processing queries...")
    for i in range(1, 11):
        out = pipeline.run(f"query {i}: how do I configure the system?")
        print(
            f"Query {i}: retrieve={out['retrieval_level']}, "
            f"model={out['model_level']}, response={out['response']}"
        )
        if out["notice"]:
            print(f"  notice: {out['notice']}")

    print("\nDegrader status:")
    print("  retrieval:", pipeline.retrieval.degrader.status())
    print("  model:", pipeline.model.degrader.status())
```

### 4.2 `retry_patterns.py`（P42）

```python
"""
retry_patterns.py
P42：指数退避（含 jitter + 上限）+ 三态熔断器 + RobustRetry + @retry 装饰器
运行：python retry_patterns.py
"""
from __future__ import annotations

import functools
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


# ---------- 指数退避 ----------
class ExponentialBackoff:
    """
    核心原语：每次重试等待比上一次更久。
    delay = min(base * 2**attempt, max_delay) + jitter
    """

    def __init__(self, base: float = 0.5, max_delay: float = 30.0, jitter: float = 0.1):
        self.base = base
        self.max_delay = max_delay
        self.jitter = jitter

    def calculate_delay(self, attempt: int) -> float:
        raw = self.base * (2 ** attempt)
        capped = min(raw, self.max_delay)  # 封顶，防止客户端等几分钟
        return capped + random.uniform(0, self.jitter)

    def execute(self, fn: Callable[[], Any], max_retries: int = 3) -> Any:
        # range(max_retries + 1)：1 次初始尝试 + max_retries 次重试
        last_exc: Exception | None = None
        for attempt in range(max_retries + 1):
            try:
                return fn()
            except Exception as exc:
                last_exc = exc
                if attempt == max_retries:
                    break
                delay = self.calculate_delay(attempt)
                print(f"  attempt {attempt + 1} failed ({exc}), retrying in {delay:.2f}s")
                time.sleep(delay)
        raise last_exc  # type: ignore[misc]


# ---------- 熔断器 ----------
class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    """
    处理一个已经挂掉的服务：
    - 失败 >= threshold 打开，立即拒绝
    - 超过 recovery_timeout 后，下一次调用尝试翻 half_open
    - half_open 放几个探测调用：一次成功闭合，一次失败重开
    """
    failure_threshold: int = 5
    recovery_timeout: float = 2.0
    half_open_max_calls: int = 1

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    _opened_at: float = 0.0
    _half_open_calls: int = 0

    def _maybe_half_open(self) -> None:
        # 只有下一次调用尝试才翻 half_open，不是被动检查
        if self.state == CircuitState.OPEN and (time.time() - self._opened_at) >= self.recovery_timeout:
            self.state = CircuitState.HALF_OPEN
            self._half_open_calls = 0

    def call(self, fn: Callable[[], Any]) -> Any:
        self._maybe_half_open()

        if self.state == CircuitState.OPEN:
            raise RuntimeError("circuit is open")

        if self.state == CircuitState.HALF_OPEN:
            if self._half_open_calls >= self.half_open_max_calls:
                raise RuntimeError("circuit is open")
            self._half_open_calls += 1

        try:
            result = fn()
        except Exception:
            self.failure_count += 1
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                self._opened_at = time.time()
            elif self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                self._opened_at = time.time()
            raise

        # 成功
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
        return result


# ---------- 可重试判定（demo 用规则式字符串匹配） ----------
RETRIABLE_PATTERNS = ["rate", "timeout", "overload", "connection", "503", "429"]


def is_retriable(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(p in msg for p in RETRIABLE_PATTERNS)


# ---------- 健壮重试：熔断器把守 + 退避重试 ----------
class RobustRetry:
    def __init__(self, max_retries: int = 3, base: float = 0.5, failure_threshold: int = 5):
        self.backoff = ExponentialBackoff(base=base)
        self.circuit = CircuitBreaker(failure_threshold=failure_threshold)
        self.max_retries = max_retries

    def execute(self, fn: Callable[[], Any]) -> Any:
        def attempt() -> Any:
            last_exc: Exception | None = None
            for i in range(self.max_retries + 1):
                try:
                    return fn()
                except Exception as exc:
                    last_exc = exc
                    if not is_retriable(exc):
                        raise  # 永久错误立即抛
                    if i == self.max_retries:
                        break
                    delay = self.backoff.calculate_delay(i)
                    print(f"  retry {i + 1} after {delay:.2f}s ({exc})")
                    time.sleep(delay)
            raise last_exc  # type: ignore[misc]

        return self.circuit.call(attempt)


# ---------- @retry 装饰器 ----------
def retry(max_retries: int = 3, base: float = 0.5):
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        backoff = ExponentialBackoff(base=base)

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            return backoff.execute(lambda: fn(*args, **kwargs), max_retries=max_retries)

        return wrapper

    return decorator


# ---------- demo ----------
if __name__ == "__main__":
    random.seed(7)

    print("=== 1) Exponential backoff ===")
    state = {"n": 0}

    def flaky_twice():
        state["n"] += 1
        if state["n"] <= 2:
            raise RuntimeError("temporary failure")
        return "success"

    print("result:", ExponentialBackoff(base=0.5).execute(flaky_twice, max_retries=3))

    print("\n=== 2) Circuit breaker ===")
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=2.0)

    def always_fail():
        raise RuntimeError("service down")

    for i in range(1, 8):
        try:
            cb.call(always_fail)
            print(f"call {i}: ok")
        except Exception as exc:
            print(f"call {i}: {exc} (state={cb.state.value})")

    time.sleep(2.1)
    print("after sleep, state =", cb.state.value, "(仍 open，下一次调用才翻 half_open)")

    print("\n=== 3) Robust retry (backoff + circuit) ===")
    rr = RobustRetry(max_retries=3, base=0.5, failure_threshold=5)
    counter = {"n": 0}

    def sometimes_429():
        counter["n"] += 1
        if random.random() < 0.6:
            raise RuntimeError("rate limit exceeded 429")
        return "API response"

    for i in range(1, 6):
        try:
            print(f"call {i}:", rr.execute(sometimes_429))
        except Exception as exc:
            print(f"call {i}: failed ({exc})")
    print(f"failure_count={rr.circuit.failure_count}, circuit={rr.circuit.state.value}")
```

### 4.3 `production_context_system.py`（P43）

```python
"""
production_context_system.py
P43：八步生产级上下文流水线
运行：python production_context_system.py
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Optional


# ---------- 配置 ----------
@dataclass
class ProductionConfig:
    # 限流：每用户窗口内允许的 token 数（token 感知）
    rate_limit_tokens_per_window: int = 2000
    rate_limit_window_seconds: float = 10.0

    # 缓存
    l1_max_entries: int = 100
    l2_max_entries: int = 500

    # 上下文组装：每个降级档位的 token 预算
    token_budget_full: int = 64
    token_budget_reduced: int = 16
    token_budget_minimal: int = 0

    # 成本
    daily_budget_usd: float = 100.0
    cost_per_1k_input_tokens: float = 0.003  # 课里没讲具体单价，此处为可运行默认值

    # 重试
    max_retries: int = 3
    base_delay: float = 0.5

    # 熔断器
    circuit_failure_threshold: int = 5


# ---------- 降级等级 ----------
class DegradationLevel(IntEnum):
    FULL = 1
    REDUCED = 2
    MINIMAL = 3


# ---------- Mock LLM 客户端 ----------
class MockLLMClient:
    """
    模拟两件让生产变难的事：
    1) 偶发失败（限流 429 / 过载）
    2) 延迟
    失败是让重试和降级触发的燃料。
    """

    def __init__(self, failure_rate: float = 0.25, latency: float = 0.05):
        self.failure_rate = failure_rate
        self.latency = latency

    def complete(self, prompt: str, context: str) -> str:
        time.sleep(self.latency)
        if random.random() < self.failure_rate:
            raise RuntimeError("rate limit exceeded 429")
        return f"LLM answer for: {prompt[:30]} (ctx={len(context)} chars)"


# ---------- 上下文组装器 ----------
class ContextAssembler:
    """
    把候选片段针对查询排序，并打包进 token 预算。
    收缩预算 = 在负载下降级。
    排序故意简单（词重叠），生产用 embedding。
    """

    def __init__(self, knowledge: list[str]):
        self.knowledge = knowledge

    def _score(self, query: str, snippet: str) -> int:
        q = set(query.lower().split())
        s = set(snippet.lower().split())
        return len(q & s)

    def assemble(self, query: str, token_budget: int) -> str:
        if token_budget <= 0:
            return ""
        ranked = sorted(self.knowledge, key=lambda s: self._score(query, s), reverse=True)
        packed: list[str] = []
        used = 0
        for snippet in ranked:
            # 粗略按空格数当 token 数
            cost = len(snippet.split())
            if used + cost > token_budget:
                continue
            packed.append(snippet)
            used += cost
        return " ".join(packed)


# ---------- 多级缓存 ----------
class MultiLayerCache:
    def __init__(self, l1_max: int, l2_max: int):
        self.l1: dict[str, str] = {}
        self.l2: dict[str, str] = {}
        self.l1_max = l1_max
        self.l2_max = l2_max
        self.l1_hits = 0
        self.l2_hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[str]:
        if key in self.l1:
            self.l1_hits += 1
            return self.l1[key]
        if key in self.l2:
            self.l2_hits += 1
            return self.l2[key]
        self.misses += 1
        return None

    def put(self, key: str, value: str) -> None:
        if len(self.l1) >= self.l1_max:
            self.l1.pop(next(iter(self.l1)))
        self.l1[key] = value
        if len(self.l2) >= self.l2_max:
            self.l2.pop(next(iter(self.l2)))
        self.l2[key] = value


# ---------- 限流器（token 感知） ----------
class TokenAwareRateLimiter:
    def __init__(self, tokens_per_window: int, window_seconds: float):
        self.tokens_per_window = tokens_per_window
        self.window_seconds = window_seconds
        self.windows: dict[str, tuple[float, int]] = {}

    def allow(self, user: str, tokens: int) -> bool:
        now = time.time()
        start, used = self.windows.get(user, (now, 0))
        if now - start >= self.window_seconds:
            start, used = now, 0
        if used + tokens > self.tokens_per_window:
            self.windows[user] = (start, used)
            return False
        self.windows[user] = (start, used + tokens)
        return True


# ---------- 成本追踪 + 预算 ----------
class CostTracker:
    def __init__(self, daily_budget: float, cost_per_1k: float):
        self.daily_budget = daily_budget
        self.cost_per_1k = cost_per_1k
        self.spent = 0.0

    def record(self, input_tokens: int) -> float:
        cost = (input_tokens / 1000.0) * self.cost_per_1k
        self.spent += cost
        return cost

    def over_budget(self) -> bool:
        return self.spent >= self.daily_budget


# ---------- 重试 + 熔断（复用 P42 思路的精简版） ----------
class CircuitBreaker:
    def __init__(self, threshold: int):
        self.threshold = threshold
        self.failure_count = 0
        self.state = "closed"

    def record_failure(self) -> None:
        self.failure_count += 1
        if self.failure_count >= self.threshold:
            self.state = "open"

    def record_success(self) -> None:
        self.failure_count = 0
        self.state = "closed"


RETRIABLE = ["rate", "timeout", "overload", "connection", "503", "429"]


def is_retriable(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(p in msg for p in RETRIABLE)


# ---------- 降级器 ----------
@dataclass
class DegradationStep:
    level: DegradationLevel
    name: str
    fn: Any


class GracefulDegrader:
    def __init__(self):
        self.steps: list[DegradationStep] = []

    def add_step(self, level: DegradationLevel, name: str, fn: Any) -> None:
        self.steps.append(DegradationStep(level, name, fn))

    def execute(self, query: str) -> tuple[str, DegradationLevel, int]:
        ordered = sorted(self.steps, key=lambda s: int(s.level))
        for step in ordered:
            try:
                result, retries = step.fn(query)
                return result, step.level, retries
            except Exception:
                continue
        return "Service unavailable", DegradationLevel.MINIMAL, 0


# ---------- 生产级上下文系统 ----------
class ProductionContextSystem:
    def __init__(self, config: ProductionConfig, knowledge: list[str]):
        self.config = config
        self.assembler = ContextAssembler(knowledge)
        self.cache = MultiLayerCache(config.l1_max_entries, config.l2_max_entries)
        self.limiter = TokenAwareRateLimiter(
            config.rate_limit_tokens_per_window, config.rate_limit_window_seconds
        )
        self.costs = CostTracker(config.daily_budget_usd, config.cost_per_1k_input_tokens)
        self.circuit = CircuitBreaker(config.circuit_failure_threshold)
        self.llm = MockLLMClient()
        self.degrader = GracefulDegrader()
        # 降级阶梯只注册一次，最便宜的兜底在最后
        self.degrader.add_step(DegradationLevel.FULL, "full_pipeline", self._full_pipeline)
        self.degrader.add_step(DegradationLevel.REDUCED, "reduced_pipeline", self._reduced_pipeline)
        self.degrader.add_step(DegradationLevel.MINIMAL, "minimal_pipeline", self._minimal_pipeline)

        # 统计
        self.stats = {
            "requests": 0,
            "cache_hits": 0,
            "rate_limited": 0,
            "budget_exceeded": 0,
            "degraded": 0,
            "retries": 0,
        }

    # 重试活在每一档内部；降级在外
    def _call_llm_with_retry(self, query: str, context: str) -> tuple[str, int]:
        last_exc: Exception | None = None
        for attempt in range(self.config.max_retries + 1):
            try:
                return self.llm.complete(query, context), attempt
            except Exception as exc:
                last_exc = exc
                if not is_retriable(exc):
                    raise
                if attempt == self.config.max_retries:
                    break
                delay = min(self.config.base_delay * (2 ** attempt), 30.0)
                time.sleep(delay)
                self.stats["retries"] += 1
        self.circuit.record_failure()
        raise last_exc  # type: ignore[misc]

    def _full_pipeline(self, query: str) -> tuple[str, int]:
        ctx = self.assembler.assemble(query, self.config.token_budget_full)
        return self._call_llm_with_retry(query, ctx)

    def _reduced_pipeline(self, query: str) -> tuple[str, int]:
        ctx = self.assembler.assemble(query, self.config.token_budget_reduced)
        return self._call_llm_with_retry(query, ctx)

    def _minimal_pipeline(self, query: str) -> tuple[str, int]:
        # 不调用大模型，总是成功，流水线永不硬失败
        return "We're under heavy load. Please try again shortly.", 0

    def process(self, user: str, query: str) -> dict:
        self.stats["requests"] += 1
        start = time.time()

        # 1) 限流检查（token 感知）
        est_tokens = len(query.split()) + self.config.token_budget_full
        if not self.limiter.allow(user, est_tokens):
            self.stats["rate_limited"] += 1
            return {"success": False, "error": "rate_limited", "latency_ms": 0}

        # 2) 组装上下文（上下文工程核心）
        assembled = self.assembler.assemble(query, self.config.token_budget_full)

        # 3) 缓存检查
        cache_key = f"{user}:{query}:{assembled}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            self.stats["cache_hits"] += 1
            return {
                "success": True,
                "response": cached,
                "cache_hit": True,
                "latency_ms": 0,
                "degradation_level": "FULL",
                "retries": 0,
                "context_tokens": 0,
            }

        # 4) 预算检查
        if self.costs.over_budget():
            self.stats["budget_exceeded"] += 1
            return {"success": False, "error": "budget_exceeded", "latency_ms": 0}

        # 5) 带重试和降级执行
        response, level, retries = self.degrader.execute(query)
        if level != DegradationLevel.FULL:
            self.stats["degraded"] += 1

        # 6) 缓存存储（以组装后的上下文为键）
        self.cache.put(cache_key, response)

        # 7) 记录成本
        self.costs.record(len(assembled.split()))

        # 8) 返回带元数据的响应
        latency_ms = int((time.time() - start) * 1000)
        return {
            "success": True,
            "response": response,
            "cache_hit": False,
            "latency_ms": latency_ms,
            "degradation_level": level.name,
            "retries": retries,
            "context_tokens": len(assembled.split()),
        }

    def dashboard(self) -> dict:
        total = self.stats["requests"]
        hit_rate = (self.stats["cache_hits"] / total * 100) if total else 0.0
        return {
            **self.stats,
            "l1_entries": len(self.cache.l1),
            "l2_entries": len(self.cache.l2),
            "l1_hits": self.cache.l1_hits,
            "l2_hits": self.cache.l2_hits,
            "misses": self.cache.misses,
            "hit_rate": round(hit_rate, 1),
            "total_cost_usd": round(self.costs.spent, 4),
            "circuit_state": self.circuit.state,
            "circuit_failure_count": self.circuit.failure_count,
        }


# ---------- demo ----------
if __name__ == "__main__":
    random.seed(123)
    knowledge = [
        "context engineering is about assembling the right tokens",
        "caching reduces cost and latency dramatically",
        "graceful degradation shrinks context under load",
        "rate limiting protects the system from abuse",
        "retries with backoff absorb transient failures",
        "circuit breakers stop cascading failures",
        "budgets put a hard ceiling on spend",
        "token aware limits reflect real load",
    ]
    config = ProductionConfig()
    system = ProductionContextSystem(config, knowledge)

    print("Simulating traffic...")
    for i in range(1, 46):
        user = "userA" if i % 3 == 0 else "userB"
        out = system.process(user, f"how do I configure the system step {i % 5}")
        if out["success"]:
            print(
                f"req {i:02d} user={user} level={out['degradation_level']} "
                f"ctx={out['context_tokens']} retries={out['retries']} "
                f"latency={out['latency_ms']}ms cache={out['cache_hit']}"
            )
        else:
            print(f"req {i:02d} user={user} rejected={out['error']}")

    print("\n=== Dashboard ===")
    for k, v in system.dashboard().items():
        print(f"{k}: {v}")
```

---

## 5. 逐行解释

### 5.1 `graceful_degradation.py`

- `DegradationLevel(IntEnum)` 用整数 1–5 对应讲师说的五个等级：`FULL=1`、`REDUCED=2`、`FALLBACK=3`、`MINIMAL=4`、`FAILED=5`。用 `IntEnum` 是为了后面能 `sorted(key=int)` 和 `max()` 比较严重程度。
- `DegradationStep` 是讲师说的「把一个等级绑定到实现它的函数」的数据类，字段就是 `level`、`name`、`fn`。
- `GracefulDegrader.add_step` 允许「按任意顺序注册」，`execute` 里 `sorted(self._steps, key=lambda s: int(s.level))` 实现「按等级排序，full 在前」。
- `try/except Exception: continue` 是讲师点名的「关键动作」：任何一层失败都降到下一层，而不是整体崩掉。
- `execute` 返回 `DegradationResult(result, level, failures)`，对应讲师原话「execute 同时返回结果和它最终落到的等级，调用方永远知道答案降级到什么程度」。
- `RetrievalDegrader._semantic` 里的 `if random.random() < self.semantic_failure_rate` 就是讲师说的 30% 失败率，注释里明确写「生产删除」。
- `ModelDegrader` 的四个步骤顺序是 Opus → Sonnet → Haiku → cached，对应讲师画的模型回退阶梯；`_opus` 里 40% 过载率对应「顶层大约 40% 的时间过载」。
- `user_notice` 只在 `FALLBACK` / `MINIMAL` / `FAILED` 返回提示，`REDUCED` 返回 `None`——对应讲师「轻微的 reduced 步骤完全不给提示」。
- `DegradingPipeline.run` 里 `overall = max(r.level, m.level)` 体现「检索和模型各自独立降级」：两者可以一个 full 一个 reduced，整体取更严重的那个。
- demo 跑 10 条查询，对应讲师「这个 demo 会跑 10 条查询」。

### 5.2 `retry_patterns.py`

- `ExponentialBackoff.calculate_delay`：`raw = base * 2**attempt` 就是讲师给的公式「base 乘以 2 的尝试次数次方」；`min(raw, max_delay)` 是讲师强调的「封顶，防止客户端等几分钟」；`+ random.uniform(0, jitter)` 是「加抖动防止惊群」。
- `execute` 里 `range(max_retries + 1)` 对应讲师原话「一次初始尝试加上 max 次重试」。
- `CircuitState` 三个值 `CLOSED / OPEN / HALF_OPEN` 对应讲师说的三态。
- `CircuitBreaker._maybe_half_open` 只在 `call()` 开头被调用，对应讲师强调的「只有下一次调用尝试才翻 half_open，不是被动检查」——这也是 demo 里「睡完 2 秒状态仍是 open」的原因。
- `call()` 里 `if self.state == CircuitState.OPEN: raise RuntimeError("circuit is open")` 就是「open 立即拒绝」。
- `failure_count >= failure_threshold` 打开电路；`HALF_OPEN` 下成功则 `CLOSED` 且 `failure_count = 0`，失败则重开——对应「一次成功闭合，一次失败重开」。
- `RETRIABLE_PATTERNS = ["rate", "timeout", "overload", "connection", "503", "429"]` 就是讲师 demo 里那串规则式字符串匹配；注释说明生产用真实异常类型。
- `RobustRetry.execute` 的结构严格按讲师画的流程图：先过 `circuit.call(attempt)`（熔断器把守），`attempt` 内部循环重试，`is_retriable` 为假立即 `raise`（永久错误不重试），为真则 `calculate_delay` 后 `sleep`。
- `@retry` 装饰器包裹 `ExponentialBackoff`，对应「不用改调用点」。
- demo 三段分别对应讲师演示的指数退避、熔断器、健壮重试；熔断器 demo 用 `failure_threshold=3` 对应讲师说的「阈值 3 一打到就打开」。

### 5.3 `production_context_system.py`

- `ProductionConfig` 把讲师口述的所有可调项集中：限流、缓存、各档 token 预算（full 64 / reduced 16 / minimal 0）、日预算、重试 3 次、基础延迟 0.5 秒、熔断阈值 5。讲师说这些「你可以改」，所以全部做成 dataclass 字段。
- `MockLLMClient.complete` 同时注入 `time.sleep(latency)` 和 `random < failure_rate` 抛 429——对应「模拟偶发失败和延迟两件事」。
- `ContextAssembler.assemble` 先按词重叠 `_score` 排序，再按 `token_budget` 打包；`token_budget <= 0` 直接返回空串，这就是 minimal 档「什么都不发」。注释写明「生产用 embedding」。
- `MultiLayerCache` 的 L1/L2 两级、`l1_hits / l2_hits / misses` 计数，对应仪表盘里的 `L1 entries / L2 entries / L1 hits / misses / hit rate`。
- `TokenAwareRateLimiter.allow` 按 `(user, window)` 累计 token，超了就拒绝——对应「token 感知，因为上下文大小才是真实负载」。
- `ProductionContextSystem.process` 的八个步骤与讲师列的 1–8 一一对应，注释里标了序号。
- `_call_llm_with_retry` 在**每一档内部**被调用，`GracefulDegrader.execute` 在**外层**——这就是讲师反复强调的「重试在内，降级在外」。`_minimal_pipeline` 不调用 LLM、直接返回，所以「流水线永不硬失败」。
- `dashboard()` 汇总 `requests / cache_hits / rate_limited / budget_exceeded / degraded / retries / hit_rate / total_cost_usd / circuit_state / circuit_failure_count`，对应讲师最后展示的仪表盘字段。

---

## 6. 复现检查清单

跑完三份文件后逐条核对：

- [ ] `graceful_degradation.py` 输出里至少出现一次 `model=reduced`，且该条 `response` 不是错误。
- [ ] `Degrader status` 的 `recent_failures` 里能看到 `step=claude-opus` 和错误原因（对应讲师说的「证据」）。
- [ ] 检索和模型等级出现过不一致（如 `retrieve=full, model=reduced`），证明两条阶梯独立。
- [ ] `retry_patterns.py` 指数退避段：延迟大致翻倍（如 0.66s → 1.03s 量级），最终 `result: success`。
- [ ] 熔断器段：第 3 次失败后打开，第 4–7 次立即 `circuit is open`。
- [ ] 熔断器段：`time.sleep(2.1)` 后打印的状态**仍是 open**（下一次调用才翻 half_open）。
- [ ] 健壮重试段：出现 429 触发重试，最终 `failure_count` 与 `circuit=closed` 合理。
- [ ] `production_context_system.py`：full 档 `ctx` 约 58–63，降级请求 `ctx` 约 13–16。
- [ ] 缓存命中请求 `latency=0ms` 且 `ctx=0`。
- [ ] 仪表盘 `hit_rate` 在 60% 上下（讲师 demo 是 61.5%，你的随机种子不同会浮动）。
- [ ] 仪表盘 `degraded ≥ 1`，且对应请求等级为 `REDUCED`。
- [ ] 仪表盘 `circuit_state=closed` 且 `circuit_failure_count < 5`（低于阈值所以没打开）。
- [ ] 被限流请求 `latency=0`（在花钱之前就拒绝）。

---

## 7. 课里没讲但你会撞上的

1. **依赖版本**：课里没给 `requirements.txt`，也没说 Python 版本。上面代码只用标准库，Python 3.10+ 可直接跑。若你要接真实 Anthropic SDK，需要自己 `pip install anthropic` 并配置 `ANTHROPIC_API_KEY` 环境变量——**课里没讲具体环境变量名和 SDK 版本**，以官方文档为准。
2. **真实 SDK 的重试配置**：讲师提到 Anthropic 客户端 `max_retries=5`，但没给完整初始化代码。实际写法类似 `client = Anthropic(max_retries=5)`，具体参数名以你安装的 SDK 版本为准。
3. **token 计数**：demo 里用「空格数」粗略当 token 数，这不是真实 tokenizer。生产要换成对应模型的 tokenizer，否则预算和限流都不准。课里没讲用哪个 tokenizer。
4. **成本单价**：`cost_per_1k_input_tokens=0.003` 是我填的可运行默认值，**课里没讲具体单价**，你要按实际模型价目表改。
5. **熔断器的并发安全**：上面的 `CircuitBreaker` 是单线程 demo。多线程/多进程下 `failure_count` 和状态切换需要加锁。在 JS/Node 里对应的是单线程事件循环天然无锁，但跨进程（如多实例部署）仍需外部共享状态（Redis 等）——课里没讲分布式熔断。
6. **缓存的键设计**：demo 用 `user:query:assembled` 拼字符串当键，生产要考虑归一化、TTL、失效策略。课里没讲 TTL。
7. **限流窗口**：demo 是固定窗口（`window_seconds` 到了就重置），会有窗口边界突刺问题；生产常用滑动窗口或令牌桶。课里没讲具体算法选型。
8. **`random.seed`**：我固定了种子方便复现，讲师 demo 没固定，所以「你的运行结果会不同」——这是讲师原话，不是 bug。
9. **`is_retriable` 的字符串匹配**：demo 用 `"429" in str(exc)` 这种粗暴匹配，生产必须用异常类型/状态码字段判断，否则误判。课里明确说「生产用真实异常类型，逻辑一样」。
10. **`_minimal_pipeline` 永远成功**：这意味着即使 LLM 完全不可用，用户也会收到一句固定话术。如果你希望 minimal 也走一次极简 LLM 调用，需要自己改——课里明确说 minimal「根本不调用大模型」。