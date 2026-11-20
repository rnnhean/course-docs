# AI FDE 课程文档 · P62–P65：用 LangGraph 手写一张可中断、可崩溃恢复的理赔审批图

> 覆盖：P62（State / Node / Edge 三要素）、P63（Reducer / Checkpoint / Thread）、P64（Human-in-the-loop）、P65（Supabase 建库与接线）
> 读者：前端转 AI 应用工程师。LangGraph 是 Python 框架，本文对 Python 语法只做「知道即可」级标注，重点放在**数据流**和**你已经在 React/Redux 里见过的那些概念**上。

---

## 1. 这一节做什么

这四节课是一段转折：前面几节你一直在用 `create_agent`（LangChain 的封装）一行生成整个 agent，看不见里面；从 P62 开始，讲师把封装拆开，**用最原始的方式一个个 `add_node`、一条条 `add_edge`，亲手搭出一张图**，然后在这张图上做出三件生产环境必须有的事：

1. **状态可回放**——每一步的 state 都落盘成一个 checkpoint；
2. **流程可暂停**——遇到需要人拍板的节点，图停在那里，人可以几小时后、几天后再回来点「批准」；
3. **进程可崩溃**——把内核杀掉重启，用同一个 `thread_id` 重新 invoke，图从断点继续，不会重复给人打钱。

最终你要交付的产物是这样一个目录（本文后面会给出全部文件内容）：

```
week2/day3/
├── .env                    # DATABASE_URL + OPENROUTER_API_KEY
├── requirements.txt
├── state.py                # ClaimState：整张图的「宇宙快照」形状
├── nodes.py                # 5 个节点函数 + 2 个路由函数
├── graph.py                # 连边、编译、挂 checkpointer
├── run_claim.py            # 第一次跑，停在 interrupt
└── resume_claim.py         # 新进程里恢复，人工批准后继续
```

跑完之后你会得到：一张 5 节点、6 条边（4 固定 + 2 条件）的依赖图；一个把所有中间状态写进 Supabase（托管 Postgres）的 checkpointer；一次真实的「杀进程 → 重启 → 续跑」演示。

---

## 2. 讲师原话（按项目逻辑重排）

**关于三要素，讲师先给了最朴素的定义：**

> "state 是关于这个宇宙的全部信息的一个快照——凡是跟当前正在跑的东西有关的一切，每一份数据和信息，都被装进这一个对象里。它是整张图为了精确复现当前发生的事情所需要的全部信息。"
> —— p062 [00:29]

> "如果 state 先是 x，然后是 y，然后是 z（美国人念 zed 那个 z），那么 x、y、z 全都被保存下来，你可以在任何时候倒回去，倒回 y，倒回 x。这就是 state。"
> —— p062 [00:56]

> "node 代表一个工作单元，工作流里发生的某件事。实践中它到底是什么？它就是一个 Python 函数。它接收 state 作为输入，返回 state 作为输出——返回一个它在某个方面改动过的 state。"
> —— p062 [01:26]

> "edge 非常简单，就是你的节点之间的关系。比如 A、B、C 三个节点，你想让它们按 A 然后 B 然后 C 的顺序跑，你就是在说 B 依赖 A，C 依赖 B。这份依赖关系用边画出来，边决定了下一个跑哪个节点。"
> —— p062 [01:55] / [02:11]

**关于「state 不可变」这个最容易听懵的点：**

> "你会听到很多次 state 是不可变的……那是什么意思？不是说系统状态不会变，而是**这个 state 对象本身**不能改。它是一个快照。你从一个快照走到一个新快照。你**不能**钻进 state x 里去把它那些变量改来改去。state x 不可变，state y 不可变，但你可以从一个 state 走到下一个 state。"
> —— p062 [04:15]

**关于为什么今天要手写：**

> "过去我们一直享受 LangChain 的 `create_agent`，它像个向导，把所有这些 LangGraph 的东西都替你生成好了，我们从来不用操心。今天我们一行行来做。一开始会觉得头疼，但你会习惯的，它的神秘感会消失，然后就说得通了。"
> —— p062 [05:31]

**关于那块「 monstrous block of code」：**

> "第一行开始构建一个 LangGraph 图，并且指定我们用来维护 state 的对象——一个我们自己写的、叫 `ClaimState` 的类。图知道这就是我们描述宇宙的对象类型。然后接下来五行在创建节点……接下来六行创建六条边，其中两条是条件边，另外四条是固定边。所以我们定义了五个节点、六条边，这就是我们向 LangGraph 描述依赖图的方式。"
> —— p062 [06:16] / [07:01] / [07:28]

**关于 reducer（这是整段理论里最硬的一块）：**

> "当你定义一个 state 对象时，你同时也告诉 LangGraph 一件叫 reducer 的东西。reducer 是在告诉 LangGraph：当一个节点把 state 从 x 变成 y，它想对 state 做一些更新，**这就是你把新 state 和当前宇宙状态合并起来的方式**。"
> —— p062 [10:22]

> "node 1 拿到 state x，改了几个格子，返回 update Y；node 2 也拿到同一个 state x，改了另外几个格子，返回 update Z。reducer 告诉 LangGraph 怎么把这些合并起来，于是有了那个新 state：一些格子是绿的（没被改过），一些是蓝的（node 1 改的），一些是红的（node 2 改的）。"
> —— p063 [00:29] / [01:17]

> "这样的一次「图上走一轮、归并出一份新状态」的动作，LangGraph 叫它 super step，代码里常常简称 step。"
> —— p063 [03:01]

**关于 checkpoint 和 thread：**

> "每一个 super step 之后，LangGraph 的 state 都会被保存下来，这个保存就叫 checkpoint。"
> —— p063 [05:20]

> "thread 你可以理解成一条对话线，它是一份独立的 state，有它自己的一套 checkpoints。你在代码里指定一个 thread ID。"
> —— p063 [06:22]

> "但我们的场景不是每个会话一个 thread ID，因为我们做的是处理保险理赔的 agent。**我们给每一个 claim 一个 thread ID**。每一笔理赔都是图的一次独立调用，都有自己的 checkpoints。这样如果一笔理赔需要重跑、需要付款，全都被非常有序、持久地管理着。"
> —— p063 [07:22]

> "最简单的一个叫内存 checkpointer，把 checkpoint 存在内存里。还有一个叫 Postgres Checkpointer，这是我们今天要用的，因为它够生产级，会把 checkpoint 存进 Postgres 数据库。"
> —— p063 [08:06]

**关于那段「近乎魔法般简洁」的代码：**

> "先创建一个 Checkpointer 对象，一个能存到 Postgres 的 Postgres checkpointer；然后编译我们上一页设计好的图，告诉它「用这个 checkpointer 来做 checkpoint」；下一行建立 config 对象，意思是「我马上要调用你了，我要指定这次调用在这个特定的 thread 里」；最后一行 `graph.invoke`，传入初始 state（那个 claim 对象）和 config，告诉它这次跟哪个 thread 关联。"
> —— p063 [08:33] / [08:56] / [09:21]

**关于 interrupt：**

> "这是一个非常方便的函数 `interrupt`，它告诉 LangGraph 我们想在这个点上拿到人工批准。看那段代码，那个叫 `approval` 的函数就是一个节点。它拿 state 做输入，而这个节点实现的第一行就是调用 `interrupt`——它做的第一件事就是说「我不往下走了，我要停下来，这里需要人参与」。然后 LangGraph 靠着框架的魔法就把这事处理了。"
> —— p064 [00:21] / [00:47]

> "在未来的某个时间点，你调用 graph 的 invoke，把「要 resume、并且人工已经批准了」这件事传进去，那个节点就从它停下的地方继续跑，返回它已经被批准了。"
> —— p064 [01:13]

> "这里值得理解的一点是：**整个 approval 节点会第二次完整地跑一遍**。所以如果 interrupt 语句之前有任何副作用，它会再执行一次。所以别在 interrupt 之前做类似「给人打钱」这种没有检查的事。"
> —— p064 [02:28]

**关于人工审批该放哪儿（这段是设计方法论，不是代码）：**

> "作为一个 FDE，你会跟客户或业务方一起搞清楚：有哪些风险、有哪些权衡、哪里需要人来决策。通常你要理解阈值、你在处理什么类型的风险、什么程度的风险需要人工批准。也许是超过某个金额的付款；也许是评估结果或 agent 输出低于某个阈值；也许是任何不可逆的操作之前。"
> —— p064 [03:57]

> "还有一点：如果付款只是在你自己系统内的多个账户之间流转，风险可能低一些；但如果涉及资金转出你的平台，那就是风险。"
> —— p064 [04:27]

> "另一面是决定人需要拿到什么信息才能做出明智决定。也许光有这个 claim 的细节不够，他需要知道保单的相关条款；也许他需要知道这个人历史上还提过哪些理赔——如果这只是 10 美元的理赔，但他上周提了一万个 10 美元的理赔，那可能就有问题。"
> —— p064 [05:17]

> "然后显然还有他们能采取的动作，可能不只是批准和拒绝，可能还包括改金额、加备注；以及需要记录哪些信息，确保这个人的决定连同相关上下文被留痕。这是设计一个人工审批步骤时需要考虑的四个因素。"
> —— p064 [05:47]

> "但要权衡一下人在环里的代价。最明显的是成本——上一节课里，每次不必要的审批我们给自己记了 50 美元的罚款。当然也更慢。还有一个更微妙的：如果所有东西都送人工审批，会触发决策疲劳，那个人就是一路「是是是是是」，可能会漏掉真正需要他注意的那个。"
> —— p064 [06:13] / [06:57]

**关于 Supabase（P65 全是实操）：**

> "我们要用一个叫 Supabase 的产品，它有免费额度，这门课用它足够。它是一个托管的 Postgres 数据库服务，可以免费用上生产级的数据库。我们会用它来存 undercover 的记录，以及 agent 的 state。"
> —— p065 [00:11]

> "它是云上的 Postgres，而且如我所说免费，但如果你一周不用它，它会被暂停，所以有些坑要注意。你会通过 session pooler 去连它。"
> —— p065 [00:37]

> "这里有一个小坑：数据库密码必须**只用字母和数字**。不要有奇怪的符号、不要下划线、不要感叹号。虽然那样也是强密码，就做成一个由很多字母和数字组成的强密码。"
> —— p065 [04:42]

> "你选 Direct Connection String，然后往下选 Session Pooler 那个选项。这是一条 URL，很重要，我们就是用它从实验里连数据库。"
> —— p065 [06:41]

> "你会看到这个 URL 中间有一点奇怪的东西：写着 `[你的密码]` 的方括号。你要做的是把这个整条 URL 复制下来，粘到实验里，然后**把那对方括号连同里面的字一起替换掉**，换成你刚才留在手上的那个密码——没有方括号，没有 `your-password`，就是真的密码。"
> —— p065 [07:12]

> "我把这一行 `DATABASE_URL=...` 剪出来，放进 `.env` 文件，作为 secret。然后保存 `.env`，别忘了 Ctrl+S 或 Cmd+S。"
> —— p065 [08:25]

> "然后还有一件事：运行下一个 cell，它会打印出一条命令。这条命令我们待会儿运行，好让 Claude Code 能访问这个数据库。复制到剪贴板，开一个新终端，把这条命令原样跑一遍。"
> —— p065 [10:15]

---

## 3. 从零复现

### 步骤 0：准备目录与虚拟环境

课程里是在 Jupyter Notebook 里做的（讲师反复提到「set the kernel」「execute this next cell」）。但为了让你能真正把文件保存下来复跑，下面用等价的 `.py` 文件形式给出；如果你坚持用 Notebook，把每个文件内容分别贴进一个 cell、按顺序执行即可，效果一样。

```bash
mkdir -p week2/day3
cd week2/day3
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # requirements.txt 见第 4 节
```

目录结构就是第 1 节末尾那张图，先建好空文件，后面逐个填。

![p062 00:22 讲师开场，列出 LangGraph 三个核心概念 state、node、edge](images/p062_0022s.jpg)

### 步骤 1：在 Supabase 建库

1. 打开 `supabase.com`（讲师特意强调拼写是 S-U-P-A，不是 "super"）。
2. 注册 / 登录 → 建一个 **Organization**（讲师自己的叫 "Ed Donner 的研究"，就是个占位名）。
3. 进 Dashboard → **New Project** → 项目名填 `undercover`。
4. **数据库密码：只用字母和数字**，不用下划线、感叹号、`#`、`@`。长度尽量长。**把它抄下来**，后面要手打进去。这一步是整节课最容易翻车的地方，原因见第 7 节。
5. 区域（Region）：讲师选了 `US East 1`，你也可以留默认。实例规模选最小的 **micro**。
6. 点 **Create New Project**，等它初始化完。
7. 免费计划：**所有组织加起来最多 2 个免费项目**，讲师原话是「别想着再建一个组织来绕过，他们早就想到了」。另外免费项目**一周不用会被暂停**。

![p065 03:12 讲师在 Supabase 控制台讲解项目创建与免费额度限制](images/p065_0198s.jpg)

### 步骤 2：拿到连接串

1. 在项目里点绿色的 **Connect** 按钮。
2. 选择 **Direct Connection String**。
3. 在下面再选 **Session Pooler**（讲师原话：「这才是连它的正确方式，你马上就会看到为什么」）。
4. 复制那条 URL。它长这样（中间那段方括号是占位符）：

```
postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres
```

5. **把 `[YOUR-PASSWORD]` 连同方括号一起删掉**，换成你刚才手抄的那个纯字母数字密码。不要保留方括号，不要保留 `your-password` 字样。

![p065 06:57 讲师展示 Supabase 的 Connect 面板与带方括号占位符的连接 URL](images/p065_0417s.jpg)

### 步骤 3：写 `.env`

在 `week2/day3/.env` 里写两行（**保存文件，别忘 Ctrl+S**）：

```dotenv
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:你手打的密码@aws-0-xxx.pooler.supabase.com:5432/postgres
OPENROUTER_API_KEY=sk-or-v1-你自己的 key
```

讲师提到：某些系统上 `DATABASE_URL=` 后面的值需要加引号包裹，加上引号不会有坏处；他的 Mac 上不需要。

![p065 08:25 讲师把拼好的 DATABASE_URL 一行放进 .env 作为 secret](images/p065_0505s.jpg)

### 步骤 4：先跑一遍 `create_agent` 做对照（可选，但建议）

课程在这里插入了一段：先让 `create_agent` 生成一个 agent，把它的图打出来看，证明「`create_agent` 底下就是 LangGraph」。这一步是为了让你在拆开封装之前先知道封装里是什么。你可以用 `graph.get_graph().draw_mermaid()` 把图渲染出来对照，具体 API 以你安装的版本为准（课里没有念出这段代码，属于演示）。

### 步骤 5：定义 state 的形状

写 `state.py`（内容见第 4 节）。这一步只做一件事：告诉 LangGraph「这张图在任一时刻的宇宙长什么样」。讲师的原话是「LandGraph 知道这就是我们用来描述宇宙的对象类型」。

**这一步不要动手改字段去试**——先把后面的跑通，再回来加字段。字段一改，所有节点的返回值都要跟着对齐。

### 步骤 6：写 5 个节点函数

写 `nodes.py`。按讲师说的 5 个业务节点：`agent`、`tools`、`decide`、`approval`、`payment`。

每个节点都是同一个签名：**吃一个 `ClaimState`，吐一个 dict（只包含它改动的那几个字段）**。这里有个讲师在 P64 特意点出的技术细节：

> "那个 approval 节点拿了一个 state 对象，但它没有返回一个 state 对象，这可能让你困惑……这只是个小例外：你不需要返回完整的 state。这取决于 reducer。你可以只返回正在变化的那部分，然后 reducer 会拿它和当前 state 合并。"
> —— p064 [03:27]

所以你在 `nodes.py` 里看到的所有 `return {...}` 都是**增量**，不是完整快照。这一点和 React 的 `setState(prev => ({...prev, x: 1}))` 是一个心智模型，只是合并逻辑由 reducer 决定。

### 步骤 7：连边、编译、挂 checkpointer

写 `graph.py`。5 个 `add_node`，6 条边：

- 4 条固定边：`START→agent`、`tools→agent`、`approval→payment`、`payment→END`
- 2 条条件边：`agent` 后面用 `after_agent` 路由到 `tools` 或 `decide`；`decide` 后面用 `after_decide` 路由到 `approval` 或 `payment`

讲师在 P62 讲那张示意图时说得很清楚：

> "我们从 start 开始，然后有一条边，一条固定边，把我们带到 node one，这一步总会发生。然后是条件边，你可能会去 node two，也可能去 node three。"
> —— p062 [02:11] / [03:09]

> "实线是固定边，虚线是条件边。"
> —— p062 [03:18]

![p062 03:19 讲师展示固定边（实线）与条件边（虚线）的节点依赖示意图](images/p062_0199s.jpg)

然后挂 checkpointer（讲师说「近乎魔法般简洁」的那四行）：

```python
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)   # 建 Checkpointer
checkpointer.setup()                                          # 建表（课里没演示，见第 7 节）
graph = build_graph().compile(checkpointer=checkpointer)      # 编译并挂上
config = {"configurable": {"thread_id": claim_id}}            # 声明这次调用属于哪个 thread
result = graph.invoke(initial_state, config)                  # 跑
```

![p063 08:14 讲师展示 checkpointer、compile、config、invoke 四行代码](images/p063_0494s.jpg)

### 步骤 8：第一次 invoke，观察它停在 interrupt

跑 `python run_claim.py`。因为示例 claim 的金额超过了阈值，`decide` 会判 `needs_human=True`，路由到 `approval` 节点，`approval` 第一行就调 `interrupt(...)`，图停住。

此时到 Supabase 的表里看，应该已经有 checkpoint 行了（表名以实际建出来的为准）。同时 `graph.get_state(config)` 里能看到「下一个要跑的节点是 `approval`」。

### 步骤 9：杀掉进程，重启，resume

这一步就是讲师说的「我们要把它弄崩」：

> "最后我们要把它崩掉，让系统挂掉——其实就是重启内核，但我们会演得很戏剧化。然后重启内核，再恢复内核，确保它真的能从我们离开的地方接着跑。你甚至可以一周后再回来，它依然会完美工作。"
> —— p065 [02:10]

具体操作：先把 `run_claim.py` 的终端 `Ctrl+C` 掉（或者 `kill -9`），确认进程真的没了；然后**在一个全新进程**里跑 `python resume_claim.py`。

`resume_claim.py` 做三件事：用**同一个 `thread_id`** 重新编译图、`graph.get_state(config)` 打印断点在哪、然后 `graph.invoke(Command(resume={...}), config)` 续跑。

跑完你会看到 `payment` 节点执行、`paid=True`。**再跑一次 `resume_claim.py`**，`payment` 节点会检测到 `paid` 已经是 `True` 而跳过——这就是讲师说的防重复支付。

> "你可以确保不会重复付钱、不会不小心付两次。你可以把节点设计成不会发生这种事，可以加个 ID 检查确保它不可能发生，可以去查系统记录（system of record），也可以用 durability 保证下一步执行前 checkpoint 已经存好了。"
> —— p063 [10:03]

### 步骤 10：把 Supabase 挂给 Claude Code（MCP）

讲师在 P65 最后演示的是：跑 Notebook 里的某个 cell，它会**打印出一条命令**，你把这条命令粘到终端里执行一遍，Claude Code 就多了一个能访问这个 Supabase 数据库的 MCP server。

> "运行下一个 cell，你会看到打印出一条命令。这是我们待会儿要运行的命令，好让未来 Claude Code 能访问这个特定的数据库。把它复制到剪贴板，开一个新终端，把这条命令原样跑一遍。"
> —— p065 [10:15]

**注意**：讲师没有念出这条命令的具体内容，所以本文不替你猜。你需要在课程仓库 `labs/week2/day3` 的那个 Notebook 里找到对应 cell，运行它，复制它打印出来的那一行，到终端执行。执行完讲师补了一句「后面我们还需要登录一下，Claude 才有权限」。

---

## 4. 完整代码

> **重要声明**：P62–P65 的逐字稿里，讲师**没有逐字念出完整代码**，只描述了结构（一个 `ClaimState` 类、5 个节点、6 条边、其中 `after_agent` 和 `after_decide` 两个路由函数、checkpointer 那几行、`interrupt` 那几行）。下面这套代码是**按讲师描述的结构重建的最小可运行版本**：字段名、函数名、提示词是我为了让它能真跑起来而补的，**不是课程原稿**。结构（5 节点 / 6 边 / 2 条件边 / 2 个路由函数 / 先 decide 后 approval 再 payment）忠实于讲师描述。

### `requirements.txt`

```
langgraph>=0.2.60
langgraph-checkpoint-postgres>=2.0.0
langchain-openai>=0.2.14
langchain-core>=0.3.0
psycopg[binary]>=3.1.18
python-dotenv>=1.0.1
```

> 讲师没有给版本号。以上是能跑通本文代码的下限区间；如果你装到的版本更新、API 有变，请以 `pip show langgraph` 的结果和官方文档为准。

### `.env`（示例，不要提交到 git）

```dotenv
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:abc123abc123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx
MODEL_NAME=openai/gpt-4o-mini
HUMAN_APPROVAL_THRESHOLD=1000
```

> `MODEL_NAME`：讲师只说了他用的模型昵称是 "Luna"（"crazy cheap"），没有念出模型 ID。这里给的是 OpenRouter 上一个可用的占位模型，请换成你账号里能用的那个。

### `state.py`

```python
"""ClaimState：这张图在任一时刻的「宇宙快照」的形状。

逐字稿依据：p062 [06:16] 「第一行开始构建一个 LangGraph 图，
并且指定我们用来维护 state 的对象——一个我们自己写的、叫 ClaimState 的类。」
"""
import operator
from typing import Annotated, TypedDict

from langgraph.graph.message import add_messages


class ClaimState(TypedDict, total=False):
    # ---- 输入 ----
    claim_id: str                 # 一笔理赔一个 thread_id，见 p063 [07:22]
    claim: dict                   # 理赔单本身：金额、保单号、事故描述……

    # ---- 图运行中产生 ----
    messages: Annotated[list, add_messages]      # reducer: 追加而不是覆盖
    audit_log: Annotated[list[str], operator.add]  # reducer: 累加，演示「合并」
    assessment: str               # agent 给出的评估意见
    payout_amount: int            # decide 决定的赔付金额
    needs_human: bool             # decide 判断是否需要人工
    approved: bool                # 最终结论
    paid: bool                    # 是否已付款（幂等标记）
```

### `nodes.py`

```python
"""5 个业务节点 + 2 个路由函数。

逐字稿依据：p062 [07:01]「接下来五行在创建节点……每个节点有一个名字，
大多数情况下值是一个 Python 函数，用 state 做输入、期待 state 做输出。」
p062 [07:28]「接下来六行创建六条边，两条是条件边，另外四条是固定边。」
"""
import json
import os

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.types import interrupt

from state import ClaimState

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "openai/gpt-4o-mini")
HUMAN_APPROVAL_THRESHOLD = int(os.getenv("HUMAN_APPROVAL_THRESHOLD", "1000"))

# 课里没有给出真实保单库，这里是本地的假数据，只为让 tools 节点有东西可调
POLICY_DB = {
    "POL-1001": {"clause": "第 4.2 条 意外医疗", "limit": 5000},
    "POL-2002": {"clause": "第 7.1 条 行李延误", "limit": 800},
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_policy",
            "description": "根据保单号查询保单条款与赔付上限",
            "parameters": {
                "type": "object",
                "properties": {
                    "policy_no": {"type": "string", "description": "保单号，例如 POL-1001"}
                },
                "required": ["policy_no"],
            },
        },
    }
]

SYSTEM_PROMPT = (
    "你是一家保险公司的理赔分析助手。"
    "请阅读理赔单，必要时调用 lookup_policy 查保单条款，"
    "然后用三句话以内给出评估意见：是否符合条款、建议赔付金额、风险点。"
)


def _llm() -> ChatOpenAI:
    """OpenRouter 走的是 OpenAI 兼容协议，所以直接用 ChatOpenAI 改 base_url。"""
    return ChatOpenAI(
        model=MODEL_NAME,
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        temperature=0,
    )


def _claim_brief(state: ClaimState) -> str:
    return "理赔单如下：\n" + json.dumps(state["claim"], ensure_ascii=False, indent=2)


# --------------------------------------------------------------------------
# 节点 1：agent —— 调 LLM，可能产生 tool_calls
# --------------------------------------------------------------------------
def agent_node(state: ClaimState) -> dict:
    existing = list(state.get("messages") or [])
    new_msgs = []
    if not existing:
        new_msgs.append(HumanMessage(content=_claim_brief(state)))

    resp = _llm().bind_tools(TOOLS).invoke(
        [SystemMessage(content=SYSTEM_PROMPT), *existing, *new_msgs]
    )
    # 只返回「增量」：新追加的消息 + 一条审计日志
    return {"messages": [*new_msgs, resp], "audit_log": ["agent: 完成一轮分析"]}


# --------------------------------------------------------------------------
# 路由函数 1：after_agent —— 条件边
# --------------------------------------------------------------------------
def after_agent(state: ClaimState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "decide"


# --------------------------------------------------------------------------
# 节点 2：tools —— 执行工具调用
# --------------------------------------------------------------------------
def tools_node(state: ClaimState) -> dict:
    last = state["messages"][-1]
    out = []
    for call in last.tool_calls:
        policy_no = (call.get("args") or {}).get("policy_no", "")
        result = POLICY_DB.get(policy_no, {"error": f"未找到保单 {policy_no}"})
        out.append(
            ToolMessage(
                content=json.dumps(result, ensure_ascii=False),
                tool_call_id=call["id"],
            )
        )
    return {"messages": out, "audit_log": [f"tools: 执行 {len(out)} 次查询"]}


# --------------------------------------------------------------------------
# 节点 3：decide —— 把评估落成结构化决策（用规则，不走 LLM，结果可预测）
# --------------------------------------------------------------------------
def decide_node(state: ClaimState) -> dict:
    amount = int(state["claim"].get("amount", 0))
    assessment = state["messages"][-1].content if state.get("messages") else ""

    needs_human = amount >= HUMAN_APPROVAL_THRESHOLD
    return {
        "assessment": assessment,
        "payout_amount": amount,
        "needs_human": needs_human,
        # 不需要人工的，直接视为通过；需要人工的，approved 留 False 等 interrupt 回来改
        "approved": not needs_human,
        "audit_log": [f"decide: 金额 {amount}，需要人工={needs_human}"],
    }


# --------------------------------------------------------------------------
# 路由函数 2：after_decide —— 条件边
# --------------------------------------------------------------------------
def after_decide(state: ClaimState) -> str:
    return "approval" if state["needs_human"] else "payment"


# --------------------------------------------------------------------------
# 节点 4：approval —— 人工审批（interrupt 就在这里）
#
# 逐字稿 p064 [00:47]：「那个叫 approval 的函数就是一个节点……
# 它做的第一件事就是调用 interrupt，说『我不往下走了，这里需要人参与』。」
# 逐字稿 p064 [02:28]：「整个 approval 节点会第二次完整地跑一遍，
# 所以 interrupt 之前不能放副作用。」——所以这里只做纯读，不做任何写操作。
# --------------------------------------------------------------------------
def approval_node(state: ClaimState) -> dict:
    decision = interrupt(
        {
            "claim_id": state["claim_id"],
            "payout_amount": state["payout_amount"],
            "assessment": state.get("assessment", ""),
            # p064 [05:17]：人需要拿到「保单相关条款 + 历史理赔」才好判断
            "policy_clause": POLICY_DB.get(
                state["claim"].get("policy_no", ""), {}
            ).get("clause", "（无）"),
            "question": "是否批准这笔赔付？",
            "actions": ["approve", "reject"],
        }
    )

    if isinstance(decision, dict):
        approved = bool(decision.get("approved"))
        note = decision.get("note", "")
    else:
        approved = bool(decision)
        note = ""

    return {
        "approved": approved,
        "audit_log": [f"approval: 人工结论={approved} 备注={note!r}"],
    }


# --------------------------------------------------------------------------
# 节点 5：payment —— 付款，幂等
#
# 逐字稿 p063 [10:03]：「你可以确保不会重复付钱……可以加个 ID 检查，
# 可以去查系统记录，也可以用 durability 保证下一步执行前 checkpoint 已经存好了。」
# --------------------------------------------------------------------------
def payment_node(state: ClaimState) -> dict:
    if not state.get("approved"):
        return {"paid": False, "audit_log": ["payment: 未获批准，跳过"]}

    if state.get("paid"):
        return {"paid": True, "audit_log": ["payment: 已付过，跳过（幂等命中）"]}

    # 真实项目在这里调支付网关，并落一条 payment_id 到系统记录
    payment_id = f"PAY-{state['claim_id']}"
    return {
        "paid": True,
        "audit_log": [f"payment: 已打款 {state['payout_amount']}，流水号 {payment_id}"],
    }
```

### `graph.py`

```python
"""连边、编译、挂 Postgres checkpointer。

逐字稿依据 p062 [07:28]：五个节点、六条边（四条固定 + 两条条件）。
逐字稿依据 p063 [08:33]：「先创建一个 Checkpointer 对象……
然后编译我们设计好的图，告诉它用这个
checkpointer 来做 checkpoint。」

```python
"""连边、编译、挂 Postgres checkpointer。

逐字稿依据 p062 [07:28]：五个节点、六条边（四条固定 + 两条条件）。
逐字稿依据 p063 [08:33]：「先创建一个 Checkpointer 对象……
然后编译我们设计好的图，告诉它用这个 checkpointer 来做 checkpoint。」
"""
import os
from contextlib import contextmanager

from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from nodes import (
    after_agent,
    after_decide,
    agent_node,
    approval_node,
    decide_node,
    payment_node,
    tools_node,
)
from state import ClaimState

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def build_graph() -> StateGraph:
    """只描述结构：5 个节点 + 6 条边，不涉及任何 IO。

    对照讲师那张示意图：
        START --固定--> agent
        agent --条件--> tools 或 decide
        tools --固定--> agent
        decide --条件--> approval 或 payment
        approval --固定--> payment
        payment --固定--> END
    """
    g = StateGraph(ClaimState)

    # ---- 5 个节点（p062 [07:01]「接下来五行在创建节点」）----
    g.add_node("agent", agent_node)
    g.add_node("tools", tools_node)
    g.add_node("decide", decide_node)
    g.add_node("approval", approval_node)
    g.add_node("payment", payment_node)

    # ---- 4 条固定边（实线）----
    g.add_edge(START, "agent")
    g.add_edge("tools", "agent")
    g.add_edge("approval", "payment")
    g.add_edge("payment", END)

    # ---- 2 条条件边（虚线，各自挂一个路由函数）----
    g.add_conditional_edges(
        "agent",
        after_agent,
        {"tools": "tools", "decide": "decide"},
    )
    g.add_conditional_edges(
        "decide",
        after_decide,
        {"approval": "approval", "payment": "payment"},
    )

    return g


@contextmanager
def open_graph():
    """打开一个挂了 Postgres checkpointer 的、已编译的图。

    为什么包成 contextmanager：PostgresSaver.from_conn_string 在较新版本里
    返回的是上下文管理器（内部持有数据库连接），直接 `saver = ...` 拿到的是
    生成器而不是 saver 对象。用 with 写法在两种版本下都不会错。
    """
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL 没有读到，检查 .env 是否保存、路径是否在当前目录")

    with PostgresSaver.from_conn_string(DATABASE_URL) as saver:
        # 第一次跑必须建表；重复跑是幂等的（已存在就跳过）。
        # 课里没演示这一句，但缺了它会报表不存在，见第 7 节。
        saver.setup()
        yield build_graph().compile(checkpointer=saver)


def make_config(claim_id: str) -> dict:
    """p063 [08:56]：告诉 LangGraph，这次调用属于这个 thread。

    我们用 claim_id 当 thread_id（p063 [07:22]「每一笔理赔一个 thread ID」）。
    """
    return {"configurable": {"thread_id": claim_id}}
```

### `run_claim.py`

```python
"""第一次跑：跑到 approval 的 interrupt 就停住，进程正常退出。

跑完这一步，checkpoint 已经进了 Supabase。你可以把进程杀掉，
再用 resume_claim.py 从断点继续。
"""
from graph import make_config, open_graph

CLAIM = {
    "claim_id": "CLM-2024-0001",
    "claim": {
        "policy_no": "POL-1001",
        "amount": 3200,
        "incident": "2024-05-18 在机场摔倒，右手腕骨折，门诊治疗",
        "claimant": "张三",
    },
}


def main() -> None:
    claim_id = CLAIM["claim_id"]
    config = make_config(claim_id)

    with open_graph() as graph:
        result = graph.invoke(CLAIM, config)

        print("=== invoke 返回 ===")
        print(result)

        snapshot = graph.get_state(config)
        print("\n=== 当前快照 ===")
        print("下一个要跑的节点：", snapshot.next)   # 字段名以你安装版本的 StateSnapshot 为准
        print("已累积的审计日志：")
        for line in result.get("audit_log", []):
            print("  -", line)

        print("\n=== interrupt 抛给人工的载荷 ===")
        # interrupt 的内容会出现在 snapshot 的 tasks / interrupts 里，
        # 具体字段名请以实际打印结果为准
        print(snapshot)


if __name__ == "__main__":
    main()
```

### `resume_claim.py`

```python
"""新进程里恢复：用同一个 thread_id，把人工结论 resume 进去。

这一份文件就是讲师说的「崩溃之后重新启动有多简单」——
p063 [09:40]：「最后那一行展示了崩溃后重新把图跑起来有多简单，
我们会在实验里亲自做一遍。」
"""
from langgraph.types import Command

from graph import make_config, open_graph

CLAIM_ID = "CLM-2024-0001"     # 必须和 run_claim.py 里的一模一样


def main() -> None:
    config = make_config(CLAIM_ID)

    with open_graph() as graph:
        snapshot = graph.get_state(config)
        print("=== 恢复前，断点在哪里 ===")
        print("下一个要跑的节点：", snapshot.next)

        if not snapshot.next:
            print("没有待续跑的节点，说明这笔理赔已经跑完了。")
            return

        # 模拟人工在审批界面点了「批准」，并写了一句备注
        human_decision = {"approved": True, "note": "客户为首次理赔，材料齐全，按条款 4.2 全额赔付"}

        # p064 [01:13]：「你调用 invoke，把『要 resume、并且人工已经批准了』传进去，
        # 那个节点就从它停下的地方继续跑。」
        result = graph.invoke(Command(resume=human_decision), config)

        print("\n=== 续跑结果 ===")
        print("approved =", result.get("approved"))
        print("paid     =", result.get("paid"))
        print("\n=== 完整审计日志 ===")
        for line in result.get("audit_log", []):
            print("  -", line)


if __name__ == "__main__":
    main()
```

### 一次完整的执行序列

```bash
# 1) 第一次跑，会停在 interrupt
python run_claim.py

# 2) 把「崩溃」演出来：直接杀掉
#    Ctrl+C，或者另开终端 kill -9 <pid>
#    讲师做法是重启 Jupyter kernel，等价于把 Python 进程整个丢弃

# 3) 全新进程里恢复
python resume_claim.py

# 4) 再跑一次，验证幂等：payment 会因为 paid 已是 True 而跳过
python resume_claim.py
```

第 4 步的输出里，`audit_log` 会多出一条「payment: 已付过，跳过（幂等命中）」——如果你看到的是「payment: 已打款……」，说明幂等判断没生效，回去检查 `state.py` 里有没有 `paid` 字段、`payment_node` 里有没有先读 `state.get("paid")`。

![p065 02:34 讲师把 P65 的实验拆成四段：Supabase、create_agent 转图、审批暂停、崩溃重启](images/p065_0154s.jpg)

---

## 5. 逐行解释

### `state.py`

- **`class ClaimState(TypedDict, total=False)`**：`TypedDict` 只是给 dict 加类型标注，运行时它就是个普通 dict。`total=False` 表示字段可以缺——这很关键，因为图刚启动时你只传了 `claim_id` 和 `claim`，`audit_log`、`paid` 都还不存在。换成 Java/TS 的类比：这是个 `Partial<ClaimState>` 的字段表。
- **`messages: Annotated[list, add_messages]`**：这就是讲师讲了一整节的那个 **reducer**。
  > "当你定义一个 state 对象时，你同时也告诉 LangGraph 一件叫 reducer 的东西……这就是你把新 state 和当前宇宙状态合并起来的方式。"
  > —— p062 [10:22]
  `add_messages` 是 LangGraph 内置的 reducer，语义是「追加并按 message id 去重覆盖」。在 React 里你写 `setMsgs(prev => [...prev, next])`，在这里你写 `return {"messages": [next]}`，框架替你做了那个 `...prev`。**这解释了为什么节点只返回增量**——返回完整 state 会把 reducer 的逻辑搞乱，尤其是并行的两个节点同时改 `messages` 时。
- **`audit_log: Annotated[list[str], operator.add]`**：`operator.add` 作用于两个 list 就是拼接。讲师用 node 1 / node 2 抢同一个 `state x` 的那个例子，就是这个 reducer 在起作用：两个节点都只看得到旧状态、各自返回一份增量，reducer 把它们**并**成一份新状态。这正是 p063 [00:29]–[01:17] 描述的画面。
- **`paid: bool`**：这不是业务上「好看」的字段，是幂等的锚点。没有它，崩溃恢复后 `payment` 节点会二次执行，直接变成重复打款。p063 [10:03] 讲师提到的「ID 检查」「查系统记录」在生产里替换成对支付网关的查询，但在这个 lab 规模的实现里，`paid` 就是那个系统记录。
- **为什么必须声明成类而不是裸 dict**：p062 [06:16] 讲师说「图知道这就是我们描述宇宙的对象类型」。编译时 LangGraph 要靠它来推导每个字段的 reducer，字段没声明就会被静默丢弃——这是最常见的「我明明 return 了但状态没变」的原因。

### `nodes.py`

- **`def _llm()` 里 `base_url="https://openrouter.ai/api/v1"`**：讲师用的是 OpenRouter 上的便宜模型（"Luna"）。OpenRouter 走 OpenAI 兼容协议，所以复用 `ChatOpenAI` 只改 `base_url` 就够了。**课里没讲**这个 base_url 具体怎么填，这是为了让代码能跑而补的常规做法。
- **`agent_node` 里的 `if not existing:` 分支**：只在第一轮把理赔单塞进消息历史。如果每轮都塞，`tools → agent` 循环回来时会重复追加，消息会越来越长、token 爆掉。这个「只初始化一次」的判断是手写图里必须自己负责的——`create_agent` 时代是框架替你做的，这就是 p062 [05:31] 说的「手写一开始会觉得头疼」的具体位置之一。
- **`return {"messages": [*new_msgs, resp], "audit_log": [...]}`**：注意返回的 dict 里**没有** `claim`、没有 `claim_id`。节点只交增量，其余字段由 reducer 保留。对照 p064 [03:27]：「你可以只返回正在变化的那部分，然后 reducer 会拿它和当前 state 合并。」
- **`after_agent` 是一个纯函数，返回字符串而不是 state**：条件边上的函数叫 router，它的职责是「决定下一个跑谁」，不是「修改状态」。它**必须**只读不写，因为它可能在 print 图、做可视化时被反复调用。返回值 `"tools"` / `"decide"` 要和 `add_conditional_edges` 里那个映射表的 key 对上，写错会静默走到别的分支或直接报错。
- **`tools_node` 里 `tool_call_id=call["id"]`**：这个 id 必须原样回填，否则下一轮 LLM 会认为工具调用没有结果。这是 OpenAI function calling 协议的硬要求，LangGraph 不替你把关。
- **`decide_node` 用规则而不是 LLM**：这是个刻意的设计选择。审批阈值这种东西应该是**确定性**的——同样金额的理赔每次都该走到同样的分支，不然「可回放」就没意义了。讲师在 P63 反复强调「secret source 是 state 管理」，前提就是节点本身的行为可复现。
- **`approval_node` 里 `decision = interrupt({...})` 这一行的语义**：第一次执行到这里时，`interrupt(...)` **不返回**，它抛出/挂起整个图，函数在这一行「断」掉；等外部 `Command(resume=payload)` 进来后，**整个函数从第一行重新执行**，这次 `interrupt(...)` 的返回值就是 `payload`。这就是 p064 [02:28] 说的「整个节点会第二次完整地跑一遍」。所以：
  - `interrupt` 之前不能有 `pay()`、不能有 `db.insert()`、不能有计数器 `+=1`；
  - 想传给人看的信息要放在 `interrupt({...})` 的参数里，而不是之前先写进 state——写进去会在重跑时被覆盖一次（虽然是同值覆盖，但白跑一遍还浪费一个 checkpoint）。
- **`approval_node` 的返回值只有 `approved` 和 `audit_log`**：`payout_amount`、`assessment` 这些是 decide 阶段就写好的，这里不需要重复返回。
- **`payment_node` 的三段判断顺序**：先看批没批 →（简单网关场景还要先查幂等键 `payment_id` 是否已存在于系统记录）→ 最后才放行。顺序反了就会给「未批准」的理赔打款。
- **`payment_node` 里 `payment_id = f"PAY-{state['claim_id']}"`**：真实系统里这个 id 应该是**由支付侧生成并回查**的（p063 [10:25]「可以去查系统记录」），这里用确定性拼接是为了让重复执行产生同一个 id，从而可被下游幂等识别。这也顺带回答了讲师 P64 提出的设计原则：「任何不可逆的操作之前要有人的判断」，以及「不能靠『我记得我付过了』」。

### `graph.py`

- **`StateGraph(ClaimState)`**：把 state 的形状注册进去。这一步之后，每个 `add_node` 的返回值都会被 reducer 校验一遍。
- **`add_node` 的第二个参数是函数对象，不是函数调用**：`g.add_node("agent", agent_node)` 而不是 `agent_node()`。传调用结果会在建图时就执行一次节点，然后拿一个 dict 当节点用，报错很难看懂。
- **`START` / `END`**：讲师在 p062 [02:41] 说「start 和 end 是那种特殊的节点，代表旅程的开头结尾」。它们是哨兵，不对应任何 Python 函数。
- **`add_conditional_edges("agent", after_agent, {"tools": "tools", "decide": "decide"})`**：三个参数分别是「从哪个节点出发」「用哪个路由函数」「路由函数返回值 → 目标节点 的映射表」。讲师说「实线是固定边，虚线是条件边」，这个调用画出来的就是虚线。**讲师提到实际图里边的数量比 6 条看起来多**：
  > "边会稍微复杂一点，因为我们在 after agent 和 after decide 那里用了些东西，我那段代码里没写进去，你在 lab 里会看到。所以实际边数比你想的要多一点。"
  > —— p062 [07:58]
  原因就在这里：两个 `add_conditional_edges` 各自展开成两条带标签的边，所以渲染出来的图会比「5 节点 6 边」看起来密。
- **`PostgresSaver.from_conn_string(DATABASE_URL)` 套在 `with` 里**：这个 API 在不同小版本间有过变化（有的版本返回 saver 实例，有的返回上下文管理器）。用 `with` 写法两种都能过。**这是本文为了让代码稳定而做的处理，课里没讲这个细节**。
- **`saver.setup()`**：第一次跑会创建 LangGraph 需要的表（checkpoints / checkpoint_writes / checkpoint_blobs 之类，具体表名请以实际建出来的为准）。**这一句课里没演示**，但少了它第一次运行会直接报表不存在。它重复执行是安全的。
- **`compile(checkpointer=saver)`**：编译要做三件事——校验图结构（有没有孤立节点、有没有死路）、把 reducer 绑到字段上、给每个可能产生 checkpoint 的位置插入保存点。所以**编译之后不能改图**，想改必须重新 `build_graph()`。
- **`make_config(claim_id)`**：`{"configurable": {"thread_id": claim_id}}` 这个嵌套结构是 LangGraph 约定的固定形状，不能简化成 `{"thread_id": ...}`。p063 [06:22] 说「thread ID 是你怎么给这个特定 thread 保持一致的 checkpoints」，机制上就是靠这个 config 里那一层 `configurable` 找到对应的那串 checkpoint。

### `run_claim.py` / `resume_claim.py`

- **两个文件必须用同一个 `CLAIM_ID`**：thread 的全部身份就是这个字符串。改成 `CLM-2024-0002` 就等于开了一笔全新理赔，`get_state` 会返回空、`snapshot.next` 是 `START`，而**不会报错**——这是最容易「以为恢复了其实重头跑」的坑。
- **`graph.invoke(CLAIM, config)` 的返回值**：是停下来那一刻的完整 state（不是节点返回值）。所以你在 `main()` 里 `result.get("audit_log")` 拿到的是累加后的完整日志，因为 `operator.add` 这个 reducer 已经把它拼好了。
- **`snapshot = graph.get_state(config)`**：这是读 checkpoint 的入口，不触发任何节点执行。它是你在「恢复前」确认断点位置的唯一手段。`snapshot.next` 是「下一次会跑哪些节点」的集合，字段名请以你安装版本实际打印为准（本文用的是当前主流的 `next`）。
- **`graph.invoke(Command(resume=human_decision), config)`**：注意**第一个参数不是 state**，是 `Command` 对象。这是 interrupt 的专用恢复通道：LangGraph 靠它知道「不要去 START 重新开始，而是把这份 payload 当作被挂起的那个 `interrupt()` 的返回值，从那一点继续」。传 state 进去会变成「开新一轮」，之前的 checkpoint 就废了。
- **`if not snapshot.next: return`** 这个早退保护：第二次跑 `resume_claim.py` 时图已经跑到 `END` 了，`next` 为空。没有这个判断，`invoke(Command(resume=...))` 的行为会依赖版本实现，不如自己拦住。

![p063 05:22 讲师讲解 checkpoint 与 thread：每个 thread 一条独立的 checkpoint 序列](images/p063_0322s.jpg)

![p064 00:15 讲师展示 interrupt / resume 的代码，approval 节点第一行就是 interrupt](images/p064_0015s.jpg)

---

## 6. 复现检查清单

按顺序打勾，每一步没通过就不要往下走。

**环境**

- [ ] `python -m venv .venv` 建好并激活，`which python` 指向 `.venv` 里的解释器
- [ ] `pip install -r requirements.txt` 全部成功，`pip show langgraph` 能打出信息
- [ ] `.env` 文件在 `week2/day3/` 目录下，**并且已经 Ctrl+S 保存**（讲师专门强调过两次）
- [ ] `python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('DATABASE_URL'))"` 能打出完整连接串

**Supabase**

- [ ] 项目已创建，状态不是 paused
- [ ] 数据库密码**只含字母和数字**（不含 `@ # ! _ -` 等）
- [ ] 连接串取自 **Direct Connection String → Session Pooler**
- [ ] `[YOUR-PASSWORD]` 连同方括号已整个替换成本人密码，串里不含 `[` `]` 和 `your-password` 字样
- [ ] 免费项目数量 ≤ 2（超过会被要求付费）

**建图**

- [ ] `python -c "from graph import build_graph; g = build_graph(); print(g.nodes.keys())"` 能打出 5 个节点名
- [ ] `python -c "from graph import open_graph; print('ok')"` 不报 import 错（这时还没连库）
- [ ] 进到 `with open_graph() as g:` 这一步成功，说明 `saver.setup()` 建表通过
- [ ] 到 Supabase 的 Table Editor 里能看到 LangGraph 建出来的表（表名以实际为准）

**跑到 suspend**

- [ ] `python run_claim.py` 正常结束、没有异常堆栈
- [ ] 输出里 `下一个要跑的节点：` 是 `approval`（说明 `decide` 判了 `needs_human=True`；如果显示 `payment`，说明金额没超过阈值，把 claim 金额改大或把 `HUMAN_APPROVAL_THRESHOLD` 调小）
- [ ] `audit_log` 里能看到 `agent:` → `tools:`（可能有）→ `agent:` → `decide: 金额 … 需要人工=True` 这几条
- [ ] `interrupt` 的载荷里能看到 `claim_id` / `payout_amount` / `assessment` / `policy_clause` / `actions`

**崩溃与恢复**

- [ ] `run_claim.py` 的进程已彻底消失（`ps aux | grep run_claim` 无结果，或 Jupyter kernel 已 Restart）
- [ ] `python resume_claim.py` 里「恢复前」打印的下一个节点仍然是 `approval`——**这一行是整节课的核心验收点**：证明状态真的在数据库里，不在进程内存里
- [ ] 续跑后 `approved = True`、`paid = True`
- [ ] 审计日志里出现 `approval: 人工结论=True 备注='...'` 和 `payment: 已打款 …`
- [ ] 再跑一次 `resume_claim.py`，走到早退分支或幂等命中，**不会出现第二条「已打款」**

**MCP（P65 结尾）**

- [ ] 在课程 Notebook 的对应 cell 里跑出那条命令
- [ ] 开新终端粘进去执行，无报错
- [ ] Claude Code 里能看到/登录这个 Supabase 连接（讲师说「后面我们还需要登录一下」）

---

## 7. 课里没讲但你会撞上的

**① 密码里有特殊字符，连接串会被「吃掉」**
这是 P65 那个「只用字母和数字」的要求背后的真正原因。`postgresql://user:pa$$w@rd@host/db` 这种串，URL 解析器会把 `@` 当成分隔符，密码从 `pa$$w` 处截断，于是你看到的错误是「password authentication failed」而不是「URL 格式错误」，极难定位。**讲师只说了「必须只用字母和数字」，没解释为什么**，这里补上。如果已经建了带符号的密码：在 Supabase 控制台 Reset Database Password，改成纯字母数字，再重新拼串。

**② `saver.setup()` 这一句是必需的，但课里没演示**
逐字稿里只有「先创建一个 Checkpointer 对象」这一步，直接 `graph.invoke` 会报表不存在。如果你的报错信息里有 `relation "checkpoints" does not exist` 一类字样，就是漏了 `setup()`。它幂等，重复跑没事。

**③ `PostgresSaver.from_conn_string` 的返回类型随版本变过**
有的版本直接返回 saver，有的返回上下文管理器。本文用 `@contextmanager` 包了一层，两种都能跑。如果你按某些老教程写成 `checkpointer = PostgresSaver.from_conn_string(url)` 然后 `compile(checkpointer=checkpointer)` 报 `'generator' object has no attribute ...`，就是这个原因。

**④ `.env` 的引号因平台而异**
讲师原话：「在某些系统上你需要在 `.env` 里写成 `DATABASE_URL=` 加引号再把长串包起来、再闭合引号，那些引号不会有坏处；我的 Mac 上不需要，但某些系统可能需要。」Windows 上跑如果发现读到的值末尾多了空格或者 `\r`，除了加引号，还要确认编辑器存的是 UTF-8 无 BOM。**串尾的 `\r` 会让 host 变成 `...pooler.supabase.com\r`，报「域名解析失败」，看起来完全不像是 `.env` 的锅。**

**⑤ Supabase 免费项目一周不用会被暂停**
讲师明确提过：「如果你一周不用它，它会被暂停，所以有些坑要注意。」恢复需要在控制台手动 Resume，恢复后连接串不变。所以**隔一周回来跑恢复实验时如果连不上，先去控制台看项目是不是 paused**，别去改代码。

**⑥ Session Pooler vs 直连的区别课里没展开**
讲师只说「Session Pooler 才是连它的正确方式」。实际原因是 Supabase 的直连地址在 IPv4 环境下常常连不上（很多云环境只给 IPv6），pooler 地址是给你一个 IPv4 入口。如果你的连接是超时而不是认证失败，多半是选错了连接方式。

**⑦ `interrupt` 重跑整个节点这件事会影响你的日志**
第一次执行时 `audit_log` 里的那一条其实已经随 checkpoint 保存了一次，恢复时节点重跑会再造一条。所以你在最终日志里可能看到 `approval: 人工结论=True ...` 出现一次（因为第一次执行时 `interrupt` 挂在赋值那行，`return` 根本没走到），但如果你在 `interrupt` **之前**写了 `return` 不了的日志语句，它就会重复。**结论：`interrupt` 之前只做纯读**，这条纪律比讲师说的「别打钱」更宽一点。

**⑧ 在 JS/Node 里对应什么**
既然你是前端转过来的：LangGraph 有 JS 版，概念一一对应。更值得记住的是心智模型——
- `ClaimState` + reducer ≈ Redux 的 `store` + `combineReducers`；
- 节点返回值 ≈ 一个 action 提交的 patch，reducer 负责合并；
- `checkpoint` ≈ Redux DevTools 的 time-travel 但**真的写进了数据库**；
- `thread_id` ≈ 每个会话一个独立的 store 实例；
- `interrupt` / `Command(resume=...)` ≈ 一个挂起的 Promise，但**不占进程**——这是关键差别。前端直觉里「等用户点确认」意味着 `await` 住一个 Promise，进程得活着；LangGraph 的做法是**把整个进程扔掉，把续跑所需的全部信息写进数据库**，用户三天后点确认时，一个全新的进程读回来接着跑。这就是 p064 [01:58] 那句「没有任何东西在那里等着，没有 agent loop 在等审批」的含义。

**⑨ 课程里没有出现的字段名，别往代码里写**
本文明智地回避了 checkpoint 表的具体列名（`thread_id` / `checkpoint_id` / `parent_checkpoint_id` 之类）。你如果在 Supabase 里直接看这些表，会看到一堆序列化的 blob 和 metadata，**具体列名请以实际建表结果为准**，不要拿网上的博客去对。同理，`snapshot.next`、`snapshot.tasks`、`snapshot.interrupts` 这些属性名在不同版本间也有出入，本文只用了 `next` 并标注了「以实际打印为准」。

**⑩ `create_agent` 生成的图和你手写的图不会一模一样**
P65 的实验顺序是先跑 `create_agent` 看图、再手写对照。你会发现两者节点数和边数都对不上——`create_agent` 会额外插入一些内部节点，`agent` 与 `tools` 之间的循环也可能包在一个子图里。**这是正常的**，讲师自己在 p062 [07:58] 就承认过「实际边数比你预期的多」。不要试图让手写版和 `create_agent` 版逐节点一致，那不是在验证正确性。

**⑪ 关于「决策疲劳」的工程化落地**
讲师在 P64 花了不少时间讲审批太频繁的代价（成本、延迟、决策疲劳），但这些是**设计原则，不是代码**。落到代码上，你唯一能动的旋钮是 `HUMAN_APPROVAL_THRESHOLD` 这个阈值，以及 `decide_node` 里那个 `needs_human` 的判定逻辑。真实项目里这个判定通常不止看金额，还要看「该客户历史理赔次数」「是否为首次理赔」「是否涉及资金转出平台」（讲师 p064 [04:27] 的那条）。这个 lab 的 `decide_node` 只实现了金额这一维，属于示范简化，**别把它当成生产方案**。

**⑫ 课程里没有的东西**
本 lab 没有做：真实的支付网关集成、保单库的真实查询接口、人工审批的 UI（讲师说的是「人在某个工具里勾了 approve 并按了 OK」，这个工具在课里没有实现）、多用户并发下的 thread 隔离测试（讲师讲了 thread 的必要性，但 lab 里是串行跑一笔理赔）。这些都属于「你知道它在哪、但课里没做」的部分，不是本文遗漏。

![p062 04:48 讲师强调 state 对象本身不可变，节点只能从旧快照走到新快照](images/p062_0288s.jpg)

![p065 01:50 讲师拆解 P65 实验的四个环节与 Supabase 的定位](images/p065_0110s.jpg)
### 修正：`graph.py` 的完整可用版本（替换第 4 节中格式异常的那段）

第 4 节的 `graph.py` 在渲染时出现了代码块嵌套（外层 `docstring` 未闭合就开了内层 ```python），直接复制会报 `SyntaxError`。以下是干净版本，可原样保存覆盖：

```python
"""连边、编译、挂 Postgres checkpointer。

逐字稿依据 p062 [07:28]：五个节点、六条边（四条固定 + 两条条件）。
逐字稿依据 p063 [08:33]：「先创建一个 Checkpointer 对象……
然后编译我们设计好的图，告诉它用这个 checkpointer 来做 checkpoint。」
"""
import os
from contextlib import contextmanager

from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from nodes import (
    after_agent,
    after_decide,
    agent_node,
    approval_node,
    decide_node,
    payment_node,
    tools_node,
)
from state import ClaimState

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def build_graph() -> StateGraph:
    """只描述结构：5 个节点 + 6 条边，不涉及任何 IO。"""
    g = StateGraph(ClaimState)

    # ---- 5 个节点（p062 [07:01]「接下来五行在创建节点」）----
    g.add_node("agent", agent_node)
    g.add_node("tools", tools_node)
    g.add_node("decide", decide_node)
    g.add_node("approval", approval_node)
    g.add_node("payment", payment_node)

    # ---- 4 条固定边（实线）----
    g.add_edge(START, "agent")
    g.add_edge("tools", "agent")
    g.add_edge("approval", "payment")
    g.add_edge("payment", END)

    # ---- 2 条条件边（虚线，各自挂一个路由函数）----
    g.add_conditional_edges(
        "agent",
        after_agent,
        {"tools": "tools", "decide": "decide"},
    )
    g.add_conditional_edges(
        "decide",
        after_decide,
        {"approval": "approval", "payment": "payment"},
    )

    return g


@contextmanager
def open_graph():
    """打开一个挂了 Postgres checkpointer 的、已编译的图。"""
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL 没有读到，检查 .env 是否保存、路径是否在当前目录"
        )

    with PostgresSaver.from_conn_string(DATABASE_URL) as saver:
        saver.setup()  # 首次建表，重复执行是幂等的
        yield build_graph().compile(checkpointer=saver)


def make_config(claim_id: str) -> dict:
    """p063 [08:56]：告诉 LangGraph，这次调用属于这个 thread。"""
    return {"configurable": {"thread_id": claim_id}}
```

---

### `run_claim.py` / `resume_claim.py` 补完的逐行解释

上一节在这两个文件上传到 `result.get("audit_log")` 就结束了，但真正决定这门课成败的判断在最后三行，这里补上：

- **`snapshot = graph.get_state(config)` 不产生任何副作用**。这一点非常关键：它只是把 `config` 里那个 `thread_id` 在数据库里对应的**最新一份 checkpoint** 读出来反序列化，不推进图、不跑节点、不写新行。所以你可以无限次地调用它。在 Jupyter 里反复执行同一个 cell 调试时，靠它判断「我到底停在哪」，比读日志靠谱。

- **`snapshot.next` 是元组，不是字符串**。哪怕只有一个待跑节点，它也是 `('approval',)` 而非 `'approval'`。打印出来带一层括号、带一个逗