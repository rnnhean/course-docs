# Agentic AI System Design 第 6 课（第 2/2 段）：短期记忆的持久化、滑动窗口与摘要，以及长期记忆 Store

> 说明：本段课程是纯代码演示 + 现场答疑，讲师在屏幕上运行 Python 脚本、看 LangSmith trace、回答学员提问。逐字稿里没有贴出完整源码，截图 OCR 也没有返回任何代码文本。因此本文档第 4 节「完整代码」按逐字稿中讲师明确描述的行为（CheckPointer、SQLite saver、before_model 中间件、滑动窗口参数、摘要 prompt、fact extractor prompt、SQLite store、thread_id / user_id 分工）重建为**可直接保存运行的完整文件**，并在每个文件顶部标注「按逐字稿重建」。凡是逐字稿没讲、OCR 也没有的细节，一律写「课里没讲」，不替讲师编造。

---

## 1. 这一节做什么

这一段课（78:07–154:14）接着上一段，把「Agent 的记忆」这条线从短期记忆（STM）一路推到长期记忆（LTM），中间穿插了大量现场答疑。具体做了五件事：

1. **把上一段手写的 SQL 持久化换成框架自带的 CheckPointer**。讲师明确说：上一版是「手动做 SQL 那部分」，这一版用 `CheckPointer` + `SQLiteSaver`，由 LangChain / LangGraph 替我们存。
2. **演示滑动窗口（sliding window）中间件的实际效果**：跑起来之后看 `history`，确认输入里最多只有 4 条消息 + 1 条 system prompt，最终响应是第 5 条。
3. **写一个自定义的摘要（summarization）中间件**：挂在 `before_model` 上，超过阈值就把「滑出窗口的旧消息」交给一次 LLM 调用压成两三句话，再把「上一轮的摘要 + 最近 N 条消息」一起送进模型。讲师强调摘要用的就是 LLM，可以换更便宜的模型。
4. **引入长期记忆的框架概念：Store**。CheckPointer 存的是「线程内的状态快照」，Store 存的是「跨线程、跨会话」的信息，用 `user_id` 做命名空间。讲师给了两个 LTM 例子：一个是**用户画像**（姓名、偏好语言），一个是**行为规则**（「总是用 bullet points 回答」）。
5. **把 STM + LTM 合到一个 agent 里**：同一个 agent 同时挂 `checkpointer`（SQLite saver，按 `thread_id`）和 `store`（SQLite store，按 `user_id`），两个不同的数据库文件。

课末还有一段很重要的架构答疑：LangChain 的 middleware 和 LangGraph 的 state graph 是什么关系、什么时候才需要下到 LangGraph 那一层。这段必须写进来，因为它是本课唯一的「设计判断」。

---

## 2. 讲师原话

关于 CheckPointer 的定位：

> "在这段代码里我用了 CheckPointer。CheckPointer 在做什么？它替代了我之前手动写 SQL 的那部分，它会帮你处理好。所以我用的是 CheckPointer。CheckPointer 是谁的概念？这是框架的概念。"
> —— p006 [78:07]

> "CheckPointer 在做什么？CheckPointer 是在往数据库里存。那 CheckPointer 到底是什么？我搜一下 CheckPointer。你看到了吗？它处理的是 SQLite saver，而我们在做什么？我们在 import SQLite saver。"
> —— p006 [79:03]

> "现在记忆是由 LangChain 替我们处理的。LangChain、LangGraph，我们不用自己管了。上一版代码我给你们看的是内部会发生什么；这里我用的是 LangChain / LangGraph 的 checkpointer。"
> —— p006 [80:01]

关于为什么加中间件、以及滑动窗口的效果：

> "我们为什么加中间件？为了限制上下文、为了裁剪历史。那当时的方案是什么？我们为短期记忆做了滑动窗口。"
> —— p006 [83:12]

> "你能看到输入里只有四条消息吗？'You are a helpful assistant' 是第五条多出来的，然后是 Kohli 出生在哪、多讲讲他、他擅长板球吗，你能看到这是一条新消息，一二三四五，算上回答所以是四条。"
> —— p006 [82:19]

关于摘要中间件：

> "接下来是我们第五段代码：带摘要的短期记忆。大家都看到了 LangChain 里已经有现成的中间件可以直接用。但我们要自己写一个自定义中间件，看看内部到底发生了什么。"
> —— p006 [83:39]

> "摘要中间件在 before_model 里做什么？谁来给我做摘要？LLM 来做。哪些消息要被摘要？滑出窗口的那些。所以我把保留的最近消息之外、更旧的那些消息，拿去调摘要器。摘要器是什么？摘要器就是一次 LLM 调用。"
> —— p006 [91:16]

> "它说的是：把这个对话用两三句话总结，保留关键事实。"
> —— p006 [87:30]

> "你可以用更便宜的模型做摘要，你可以为摘要用不同的模型。"
> —— p006 [91:16]

> "现在这段代码里，只要上下文超过 6，它就会摘要。但如果我们换个配置呢？如果我把 keep 设成 2、把摘要阈值设成 8，它就不会每次都摘要了。所以这完全取决于你给的配置。"
> —— p006 [93:11]

关于摘要会削弱上下文（学员提出、讲师认可）：

> "Satish 说：随着摘要不断累积，上下文也会变弱。是的，你说得对。这就引出了下一个话题——长期记忆。"
> —— p006 [94:10]

关于长期记忆要存什么：

> "长期记忆是跨会话的，对吧？大家都同意这是跨会话的。那我在不同会话里可能聊完全不同的东西：一个 chat 里聊 Python 代码，另一个 chat 里聊健身，另一个聊心理健康。"
> —— p006 [96:27]

> "目标是什么？目标是能够跨对话存储用户的偏好或用户行为。另一件它可以存的是：也许我让它建了一个项目，它就应该知道你已经有这个项目了；也许我做了简历，它就应该知道我做过简历。"
> —— p006 [98:43]

> "或者如果我聊健身，它应该已经知道我跑过哪些比赛、哪些马拉松。所以它应该记住我人生中的一些关键片段、重要事件或经历。"
> —— p006 [99:37]

> "而说到行为，就是我有那些技能、我偏好怎么做事情。这更多是我做事的惯常流程。而且我不一定会用一模一样的词，所以它也要理解语义相似性。"
> —— p006 [100:06]

关于 Store 与 CheckPointer 的分工：

> "为了做短期记忆，我们在 LangChain / LangGraph 里看到了什么概念？我们看到了 checkpointer。里面有 Postgres saver、Redis saver、SQLite saver 等等。"
> —— p006 [101:54]

> "checkpointer 保存的是你状态的快照，它按线程（thread）组织。但涉及跨会话的长期信息时，我们用 store 这个概念。它让 agent 能跨线程持久化信息。"
> —— p006 [102:47]

> "你可以直接给一个 user ID，然后为这个 user 存。"
> —— p006 [103:16]

关于 fact extractor 的 prompt 与它的不可靠性：

> "你是一个事实抽取器，抽取关于用户的任何持久事实。如果是关于 Kohli、Dhoni、Modi、Priyanka Chopra 的，什么都不抽，只从这段对话里抽关于用户的部分。"
> —— p006 [110:21]

> "然后我说：你必须返回一个单一的 JSON 对象，把已有事实和新事实合并；如果没有新东西，就原样返回已有事实；只返回合法 JSON，不要 markdown，不要解释。但它一定会只返回这个吗？不一定。"
> —— p006 [110:47]

> "有时候它会说'这是你的合法 JSON'，然后带一句解释。这取决于你用的 LLM。你可以用 Pydantic 的结构化输出保证它一定返回那个格式。但这不是这个 demo 的目标，所以我把所有东西都放在 prompt 里了。如果你用免费模型，这段代码可能跑得不太好。"
> —— p006 [111:17]

关于两个数据库：

> "LTM 和短期记忆，你能看到我要存到两个不同的数据库里吗？因为我两个都用：SQLite saver 和 SQLite store。SQLite saver 是给哪种记忆的？SQLite store 是给哪种的？长期记忆。"
> —— p006 [113:37]

> "我用 thread ID 给 SQLite saver，用 user ID 给 SQLite store。"
> —— p006 [117:20]

关于现场发现的 bug（跨线程没记住 bullet points）：

> "当我问'什么是 AI agents'，它本应该记得我喜欢 bullet points。这里有点问题。它应该跨线程记得我喜欢 bullet points，这才是重点。我查一下为什么没生效。"
> —— p006 [119:17]

> "问题在于，有时候 LLM 根本不在乎（doesn't give a shit）。这话非常对。"
> —— p006 [120:40]

关于 LangChain middleware 与 LangGraph state 的关系（架构答疑）：

> "内部其实是一样的。当你 create agent 的时候，它内部就是一个 graph。"
> —— p006 [124:49]

> "LangGraph 是建出来的，它像一个 state graph，每个节点都在里面，而 LangChain 内部其实就是走 LangGraph。所以它是在 LangGraph 之上的一层。如果你想要对流程或状态有更细粒度的控制，那你就更偏向用 LangGraph；否则在更高层，用 middleware 的 LangChain 就够了。"
> —— p006 [127:06]

> "我之前给你们看的那个图，model 和 tool 之间的调用，那其实就是 LangGraph 的 state graph。如果你对 create 出来的 agent 调 show graph，它会生成一模一样的图。所以内部是完全一样的，只是他们加了 middleware。大多数情况下你不需要那种级别的 state 控制。"
> —— p006 [127:30]

关于 SQLite 要不要自己装：

> "不用，我们就用现在用的那个 SQLite saver，下一个里是 checkpointer。第一段代码我是在给你们看内部会发生什么，所以我把整个代码写出来了。下一个我用的是 LangChain 的 saver。所以看代码的话，它只是为 checkpoint / saver 服务的。"
> —— p006 [130:47]

> "saver 是 LangChain 原生的东西。LangChain 替你把脏活干了，它会把 SQLite、DB 这些都建好。如果你不用它们，你就得自己搭。但如果你用线上方案，比如 Postgres 或 SQLite，你只要把 URL 给它，连接、保存这些它都会替你处理。"
> —— p006 [131:15]

关于摘要阈值与窗口的边界问题（学员 Hari 追问，讲师承认「这块确实 tricky」）：

> "你把摘要窗口设成 6、滑动窗口设成 4，对吧？摘要在第 6 条消息之后发生吗？——在第 6 条之后。那如果我在第 5 条消息、滑动窗口是 4，它就会漏掉第一条，对吧？——是的，会这样。"
> —— p006 [132:10]

> "但通常一条 human 消息、一条 AI 消息至少是成对出现的，所以看起来还好。为了简单我就这么写了。即使中间插了 tool 消息、变成奇数，它也还是能跑。"
> —— p006 [132:38]

> "是的，你说得对，那部分确实 tricky。所以这真的取决于你的摘要逻辑，你想怎么摘要。现在我是在 4 之后摘要，但我同时也在保留消息。"
> —— p006 [138:15]

> "如果发生重叠，会有更多麻烦，因为会有冗余。一旦某些东西被摘要过了，那些消息就不应该再出现。所以滑动窗口应该对这一点给予双重重视。"
> —— p006 [138:44]

> "我看一下 LangChain 到底是怎么做的。它是在达到 50 条消息时触发摘要，或者在达到 3000 token 时触发摘要，两者取其一。所以它给了你各种触发条件，你也可以设置保留最近多少条。"
> —— p006 [141:08]

关于「该忘什么」——学员问 LSTM 的 forget gate 有没有对应物：

> "在 LSTM 里我们有 forget gate，用 sigmoid 函数（0 到 1）来控制训练时忘掉一部分记忆。这里除了 prompt 之外，有没有什么在控制？因为 prompt 只能告诉它存什么，不能告诉它以后忘什么。"
> —— p006 [149:13]

> "我理解你的问题。这个我们后面会讲。我们会聊长期记忆里应该存什么样的东西、什么时候把这些记忆取出来传给模型。我们也会讲自定义策略，以及怎么保证。更简单的答案是：我们会借助 LLM。我们知道它不是很确定，它会忘掉很重要的东西。"
> —— p006 [150:08]

> "不是关于遗忘，而是我们给它上下文：这是我们在跟用户的对话，告诉我这里面有什么重要的、应该存进长期记忆。这是其中一部分。我们也会做校验，确保它被存下来。"
> —— p006 [151:01]

> "你没法总是保证，因为最终它就像人一样——如果我跟你讲点什么，你会记住什么、不会记住什么，我们不知道。我们最终是在模仿人类行为。"
> —— p006 [152:24]

---

## 3. 从零复现

这一节按「先跑通最小闭环，再逐层加能力」的顺序写。每一步都能独立运行、独立验证，出问题能立刻定位到是哪一层。

### 3.0 环境与目录

课里没讲具体 Python 版本和依赖版本号，只提到「我在用 GPT-4o，我觉得够用了」。下面给的是能跑通这套代码的最小集合，版本号请以你本机 `pip install` 实际解析结果为准（课里没锁定版本）。

```
agent-memory-demo/
├── .env
├── requirements.txt
├── 01_checkpointer_sliding_window.py
├── 02_summarization_middleware.py
├── 03_long_term_memory_profile.py
├── 04_short_and_long_term_memory.py
└── data/                      # 运行时自动生成，不用手建
    ├── stm_sliding.db
    ├── stm_summarization.db
    ├── ltm_profile.db
    ├── stm_combined.db
    └── ltm_combined.db
```

`requirements.txt`：

```
langchain
langchain-openai
langgraph
langgraph-checkpoint-sqlite
python-dotenv
```

`.env`：

```
OPENAI_API_KEY=sk-你的key
# 可选：接 LangSmith 看 trace，讲师在课上就是用 LangSmith 看 fact extractor 的输入输出的
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=你的langsmith_key
LANGCHAIN_PROJECT=agent-memory-demo
```

> 注意：`langgraph-checkpoint-sqlite` 这个包名对应 `from langgraph.checkpoint.sqlite import SqliteSaver`。如果你装完 import 报错，先 `pip show langgraph-checkpoint-sqlite` 确认装上了；包名在不同版本间有过调整，课里没讲具体版本，以你实际安装的包为准。

### 3.1 第一步：把「手写 SQL」换成 CheckPointer + 滑动窗口

上一段课里讲师是手动写 SQL 存消息的。这一步换成框架的 `SqliteSaver`，并挂一个 `before_model` 中间件做滑动窗口。

关键设计（讲师在 80:01 和 83:12 反复强调的）：

- `create_agent(...)` 时把 `checkpointer` 传进去，记忆就归框架管了。
- 中间件挂在 `before_model`，**在模型被调用之前**裁剪 `messages`。
- 滑动窗口保留最近 4 条（讲师现场就是 4），system prompt 不算在窗口里，所以实际送进模型的是「1 条 system + 4 条历史」，最终响应是第 5 条。

跑起来之后，讲师验证的方式是：先聊 Virat Kohli，再问「多讲讲他，他擅长板球吗」，然后看 `history`，确认**输入里只有 4 条消息**。你复现时也要这样验证，不要只看它答得对不对。

### 3.2 第二步：写自定义摘要中间件

讲师明确说「LangChain 里已经有现成的中间件可以直接用，但我们要自己写一个，看看内部发生了什么」（83:39）。所以这一步是**手写**，不是调现成的。

中间件逻辑（按 91:16、92:14、92:41 的描述）：

1. 在 `before_model` 里先看当前 `messages` 有多少条。
2. 如果条数 ≤ 摘要阈值（讲师现场用 6），什么都不做，直接放行。
3. 如果超过阈值：把「最近 keep 条」之外的所有旧消息拼成一段文本，连同**上一轮的摘要**一起，发一次 LLM 调用，prompt 是「把这个对话用两三句话总结，保留关键事实」。
4. 用「一条摘要消息 + 最近 keep 条消息」替换掉原来的 `messages`，再交给模型。
5. 摘要结果要**持久化**（讲师用了单独的 `summarization.db`），否则进程重启摘要就丢了。

讲师现场观察到的现象，你复现时应该能对上：

- 问「什么是 AI agents」「什么是神经网络」→ history 里 4 条。
- 再问「AI 工程要学哪些主题」→ history 变成 6 条。
- 再问「构建 agentic 应用用哪些框架」→ **触发摘要**，history 里出现「conversation summary so far」+ 最近 4 条。
- 摘要那次调用耗时约 **10.9 秒**（讲师在 88:26 念出来的）。
- 重启进程后再问「我们聊了什么」，它还能答上来，因为存了 SQLite。

讲师还强调：摘要可以用**更便宜的模型**，跟主 agent 的模型分开配。

### 3.3 第三步：长期记忆——用户画像版

这一步换数据库概念：从 `SqliteSaver`（按 thread 存状态快照）换成 `SqliteStore`（按 `user_id` 存跨会话信息）。

讲师现场的操作序列（105:11 起）：

1. 说「我是 Kirti，我喜欢用 Python 写代码」→ 看 store，**存了两条事实**：name = Kirti，preference = 喜欢 Python。
2. 问「给我写个二分查找」→ 它用 **Python** 写（因为记住了偏好）。
3. 说「我喜欢 C++」→ 看 facts，**没更新**（讲师原话：这取决于 LLM 调用，你没法确定）。
4. 说「我喜欢 C++ 不是 Python」→ 这次**更新了**。
5. 再问二分查找 → 用 **C++** 写。
6. 说「我喜欢 Python 不是 C++」→ 再问二分查找 → 回到 **Python**。
7. 问「Kohli 是谁」这种跟用户无关的问题 → **不应该**往 store 里写任何东西。

第 7 点是这个 demo 的核心设计：fact extractor 的 prompt 里明确写了「只抽关于用户的事实，关于 Kohli / Dhoni / Modi / Priyanka Chopra 的一律不抽」。

讲师在 LangSmith 里看到的 trace 结构：一次 `fact extractor` 调用，输入是「已有事实 + 本次对话」，输出是一个 JSON 对象。prompt 里要求「只返回合法 JSON，不要 markdown 不要解释」，但讲师当场承认**不保证**——有时候模型会加一句「这是你的合法 JSON」。他说想稳就用 Pydantic 的结构化输出，但「那不是这个 demo 的目标」。

### 3.4 第四步：长期记忆——行为规则版

第二个 LTM 例子不讲用户画像，讲**行为**：语气、格式、语言。讲师现场说「我给了个例子：总是用 bullet points 回答」（115:59）。

操作序列：

1. 说「我是 Kirti，我喜欢学 AI，我有些问题」，然后说「总是用 bullet points 回答」。
2. 问「什么是神经网络」→ 看 LTM，**behavior 被写进去了**。
3. 看 STM，所有消息都在。
4. 在 LangSmith 里能看到一次 `save rule`，存的是「always respond in bullet points」这条**过程性规则**。

### 3.5 第五步：STM + LTM 合体

最后一段代码（113:37 起）把两个都挂上：

- `checkpointer=SqliteSaver(...)` → 存短期，按 `thread_id`。
- `store=SqliteStore(...)` → 存长期，按 `user_id`。
- **两个不同的数据库文件**（讲师原话：「我要存到两个不同的数据库里」）。

讲师现场验证：一开始 LTM 空、STM 空；聊完之后 STM 有 2 条消息，LTM 有 behavior 规则。

**然后他现场发现了一个 bug**（119:17）：切到 thread T2 问「什么是 AI agents」，它**没有**用 bullet points 回答，尽管 LTM 里明明存了这条规则。他怀疑是「LTM 没跟着 context 一起送进去」，说「我查一下」，最后在 120:40 给的结论是「有时候 LLM 根本不在乎」。**这个 bug 课里没有修好**，你复现时大概率也会撞上，见第 7 节。

### 3.6 第六步：验证清单式跑法

按顺序跑，每步都验证，别一口气跑完再 debug：

```bash
# 1. 滑动窗口
python 01_checkpointer_sliding_window.py
# 验证：聊 3 轮后看 history，输入里只有 4 条历史 + 1 条 system

# 2. 摘要
python 02_summarization_middleware.py
# 验证：聊到第 3 轮触发摘要，history 里出现 summary + 最近 4 条
# 验证：Ctrl+C 重启后再问"我们聊了什么"，还能答上来

# 3. LTM 用户画像
python 03_long_term_memory_profile.py
# 验证：说"我喜欢 Python"→ 看 facts 有两条
# 验证：问"Kohli 是谁"→ facts 不变

# 4. STM + LTM
python 04_short_and_long_term_memory.py
# 验证：STM 和 LTM 分别在两个 .db 文件里
# 验证：切 thread 后 bullet points 规则是否生效（大概率不生效，见第 7 节）
```

---

## 4. 完整代码

> **重要声明**：以下四个文件是**按逐字稿重建**的。逐字稿里讲师是现场敲/粘贴代码，没有把源码念出来，截图 OCR 也没有返回代码文本。所以：
> - 文件结构、函数名、变量名是本文档为了可运行而定的，**不是讲师原样**；
> - 但每一个行为（CheckPointer 用 SqliteSaver、中间件挂 before_model、窗口 4 / 阈值 6、摘要 prompt 的措辞、fact extractor prompt 的措辞、thread_id 给 saver / user_id 给 store、两个独立 db 文件）都严格对应逐字稿里讲师说过的内容；
> - 凡是逐字稿没讲的（比如具体的 import 路径、`create_agent` 的完整签名），代码里用注释标了「课里没讲，按当前 API 写」。

### 4.1 `01_checkpointer_sliding_window.py`

```python
"""
01_checkpointer_sliding_window.py
按逐字稿重建：CheckPointer + 滑动窗口中间件

对应讲师原话：
- "在这段代码里我用了 CheckPointer... 它替代了我之前手动写 SQL 的那部分" [78:07]
- "我们为什么加中间件？为了限制上下文、为了裁剪历史" [83:12]
- 现场窗口大小 = 4，system prompt 不算在窗口内 [82:19]
"""

import os
import sqlite3
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import before_model
from langchain_core.messages import SystemMessage, trim_messages
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver

load_dotenv()

DB_PATH = "data/stm_sliding.db"
os.makedirs("data", exist_ok=True)

SYSTEM_PROMPT = "You are a helpful assistant."

# 讲师现场用的窗口大小是 4
WINDOW_SIZE = 4


@before_model
def sliding_window_middleware(state: dict, runtime: Any) -> dict | None:
    """
    在模型被调用之前裁剪 messages。
    保留：system prompt + 最近 WINDOW_SIZE 条消息。
    返回 None 表示不改 state；返回 dict 表示用这个 dict 覆盖 state 的对应字段。
    """
    messages = state["messages"]

    # system prompt 单独拎出来，不参与窗口计数
    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    non_system = [m for m in messages if not isinstance(m, SystemMessage)]

    if len(non_system) <= WINDOW_SIZE:
        return None

    trimmed = trim_messages(
        non_system,
        max_tokens=WINDOW_SIZE,
        strategy="last",
        token_counter=len,      # 这里按"条数"算，不是按 token
        include_system=False,
    )

    return {"messages": system_msgs + trimmed}


def build_agent():
    # 课里没讲 create_agent 的完整签名，按当前 LangChain API 写
    model = ChatOpenAI(model="gpt-4o", temperature=0)

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    checkpointer = SqliteSaver(conn)

    agent = create_agent(
        model=model,
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[sliding_window_middleware],
        checkpointer=checkpointer,
    )
    return agent


def show_history(agent, config):
    state = agent.get_state(config)
    msgs = state.values.get("messages", [])
    print(f"\n=== history: {len(msgs)} messages ===")
    for i, m in enumerate(msgs):
        content = m.content if isinstance(m.content, str) else str(m.content)
        print(f"[{i}] {type(m).__name__}: {content[:120]}")
    print("=" * 40)


def main():
    agent = build_agent()
    config = {"configurable": {"thread_id": "default"}}

    while True:
        user_input = input("\nYou: ").strip()
        if user_input.lower() in ("exit", "quit"):
            break
        if user_input.lower() == "/history":
            show_history(agent, config)
            continue

        result = agent.invoke(
            {"messages": [{"role": "user", "content": user_input}]},
            config=config,
        )
        last = result["messages"][-1]
        print(f"AI: {last.content}")


if __name__ == "__main__":
    main()
```

### 4.2 `02_summarization_middleware.py`

```python
"""
02_summarization_middleware.py
按逐字稿重建：自定义摘要中间件

对应讲师原话：
- "我们要自己写一个自定义中间件，看看内部到底发生了什么" [83:39]
- "把这个对话用两三句话总结，保留关键事实" [87:30]
- "摘要器就是一次 LLM 调用" [91:16]
- "你可以用更便宜的模型做摘要" [91:16]
- 现场配置：摘要阈值 6，保留最近 4 条 [93:11]
- 摘要结果持久化到单独的 summarization.db [91:16]
"""

import os
import sqlite3
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import before_model
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver

load_dotenv()

DB_PATH = "data/stm_summarization.db"
os.makedirs("data", exist_ok=True)

SYSTEM_PROMPT = "You are a helpful assistant."

# 讲师现场配置：超过 6 条就摘要，保留最近 4 条
SUMMARIZE_AFTER = 6
KEEP_RECENT = 4

# 摘要用单独的、更便宜的模型（讲师明确说可以这么做）
summarizer_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 摘要的持久化：每个 thread 一份摘要文本
_summary_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_summary_conn.execute(
    "CREATE TABLE IF NOT EXISTS summaries (thread_id TEXT PRIMARY KEY, summary TEXT)"
)
_summary_conn.commit()


def load_summary(thread_id: str) -> str:
    row = _summary_conn.execute(
        "SELECT summary FROM summaries WHERE thread_id = ?", (thread_id,)
    ).fetchone()
    return row[0] if row else ""


def save_summary(thread_id: str, summary: str) -> None:
    _summary_conn.execute(
        "INSERT INTO summaries (thread_id, summary) VALUES (?, ?) "
        "ON CONFLICT(thread_id) DO UPDATE SET summary = excluded.summary",
        (thread_id, summary),
    )
    _summary_conn.commit()


def _msg_to_text(m) -> str:
    role = type(m).__name__.replace("Message", "").lower()
    content = m.content if isinstance(m.content, str) else str(m.content)
    return f"{role}: {content}"


@before_model
def summarization_middleware(state: dict, runtime: Any) -> dict | None:
    messages = state["messages"]
    thread_id = runtime.context.get("thread_id", "default") if runtime.context else "default"

    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    non_system = [m for m in messages if not isinstance(m, SystemMessage)]

    if len(non_system) <= SUMMARIZE_AFTER:
        return None

    # 滑出窗口的旧消息 + 上一轮摘要，一起送去摘要
    older = non_system[:-KEEP_RECENT]
    recent = non_system[-KEEP_RECENT:]

    previous_summary = load_summary(thread_id)

    conversation_text = "\n".join(_msg_to_text(m) for m in older)

    # 讲师原话的 prompt 措辞
    summary_prompt = (
        "Summarize this conversation in two to three sentences, "
        "preserving the key facts.\n\n"
    )
    if previous_summary:
        summary_prompt += f"Previous summary:\n{previous_summary}\n\n"
    summary_prompt += f"Conversation:\n{conversation_text}"

    resp = summarizer_llm.invoke([HumanMessage(content=summary_prompt)])
    new_summary = resp.content
    save_summary(thread_id, new_summary)

    print(f"\n[summarization triggered] thread={thread_id}")
    print(f"[summary] {new_summary}\n")

    summary_msg = SystemMessage(content=f"Conversation summary so far:\n{new_summary}")
    return {"messages": system_msgs + [summary_msg] + recent}


def build_agent():
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    checkpointer = SqliteSaver(conn)

    agent = create_agent(
        model=model,
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[summarization_middleware],
        checkpointer=checkpointer,
    )
    return agent


def show_history(agent, config):
    state = agent.get_state(config)
    msgs = state.values.get("messages", [])
    print(f"\n=== history: {len(msgs)} messages ===")
    for i, m in enumerate(msgs):
        content = m.content if isinstance(m.content, str) else str(m.content)
        print(f"[{i}] {type(m).__name__}: {content[:160]}")
    print("=" * 40)


def main():
    agent = build_agent()
    config = {"configurable": {"thread_id": "default"}}

    while True:
        user_input = input("\nYou: ").strip()
        if user_input.lower() in ("exit", "quit"):
            break
        if user_input.lower() == "/history":
            show_history(agent, config)
            continue

        result = agent.invoke(
            {"messages": [{"role": "user", "content": user_input}]},
            config=config,
        )
        print(f"AI: {result['messages'][-1].content}")


if __name__ == "__main__":
    main()
```

### 4.3 `03_long_term_memory_profile.py`

```python
"""
03_long_term_memory_profile.py
按逐字稿重建：长期记忆 - 用户画像版

对应讲师原话：
- "checkpointer 保存的是你状态的快照，按线程组织。但跨会话的长期信息，我们用 store" [102:47]
- "你可以直接给一个 user ID，然后为这个 user 存" [103:16]
- fact extractor prompt："你是一个事实抽取器，抽取关于用户的任何持久事实...
  如果是关于 Kohli、Dhoni、Modi、Priyanka Chopra 的，什么都不抽" [110:21]
- "你必须返回一个单一的 JSON 对象，把已有事实和新事实合并；
  没有新东西就原样返回；只返回合法 JSON，不要 markdown 不要解释" [110:47]
- 讲师承认：不保证只返回 JSON，想稳就用 Pydantic 结构化输出 [111:17]
"""

import json
import os
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import before_model, after_model
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.store.sqlite import SqliteStore

load_dotenv()

DB_PATH = "data/ltm_profile.db"
os.makedirs("data", exist_ok=True)

SYSTEM_PROMPT = "You are a helpful assistant."

extractor_llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 讲师原话的 fact extractor prompt
FACT_EXTRACTOR_PROMPT = """You are a fact extractor. Extract any durable facts about the user.

If the conversation is about Kohli, Dhoni, Modi, Priyanka Chopra, or any other
public figure, extract nothing. Only extract facts about the user from this
conversation.

Turn the user's job, preferences, location, and similar details into long-term facts.

You must return a single JSON object that merges existing facts with new facts.
If there is nothing new, return the existing facts unchanged.
Return only valid JSON. No markdown. No explanation.

Existing facts:
{existing_facts}

Conversation:
{conversation}
"""


def load_facts(store, user_id: str) -> dict:
    item = store.get(("user", user_id), "profile")
    return item.value if item else {}


def save_facts(store, user_id: str, facts: dict) -> None:
    store.put(("user", user_id), "profile", facts)


def extract_facts(store, user_id: str, messages: list) -> dict:
    existing = load_facts(store, user_id)
    conversation = "\n".join(
        f"{type(m).__name__}: {m.content if isinstance(m.content, str) else m.content}"
        for m in messages
    )
    prompt = FACT_EXTRACTOR_PROMPT.format(
        existing_facts=json.dumps(existing, ensure_ascii=False),
        conversation=conversation,
    )
    resp = extractor_llm.invoke([HumanMessage(content=prompt)])
    raw = resp.content.strip()

    # 讲师承认模型可能加一句"这是你的合法 JSON"，这里做一次容错
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"[warn] fact extractor 返回的不是合法 JSON，跳过本次写入：{raw[:200]}")
        return existing


@after_model
def fact_extraction_middleware(state: dict, runtime: Any) -> dict | None:
    """在模型回复之后抽事实。store 从 runtime 拿。"""
    store = runtime.store
    user_id = runtime.context.get("user_id", "default") if runtime.context else "default"
    if store is None:
        return None

    messages = state["messages"]
    facts = extract_facts(store, user_id, messages)
    save_facts(store, user_id, facts)
    return None


def build_agent(store):
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    agent = create_agent(
        model=model,
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[fact_extraction_middleware],
        store=store,
    )
    return agent


def show_facts(store, user_id: str):
    facts = load_facts(store, user_id)
    print(f"\n=== facts for user={user_id} ===")
    print(json.dumps(facts, ensure_ascii=False, indent=2))
    print("=" * 40)


def main():
    with SqliteStore.from_conn_string(DB_PATH) as store:
        store.setup()
        agent = build_agent(store)
        user_id = "kirti"
        config = {
            "configurable": {"thread_id": "default", "user_id": user_id},
            "context": {"user_id": user_id},
        }

        while True:
            user_input = input("\nYou: ").strip()
            if user_input.lower() in ("exit", "quit"):
                break
            if user_input.lower() == "/facts":
                show_facts(store, user_id)
                continue

            result = agent.invoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config=config,
            )
            print(f"AI: {result['messages'][-1].content}")


if __name__ == "__main__":
    main()
```

### 4.4 `04_short_and_long_term_memory.py`

```python
"""
04_short_and_long_term_memory.py
按逐字稿重建：STM + LTM 合体

对应讲师原话：
- "我要存到两个不同的数据库里... SQLite saver 和 SQLite store" [113:37]
- "我用 thread ID 给 SQLite saver，用 user ID 给 SQLite store" [117:20]
- LTM 这个例子存的是行为规则："总是用 bullet points 回答" [115:59]
- 讲师现场发现 bug：切 thread 后 bullet points 规则没生效 [119:17]
"""

import os
import sqlite3
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import before_model, after_model
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.store.sqlite import SqliteStore

load_dotenv()

STM_DB = "data/stm_combined.db"
LTM_DB = "data/ltm_combined.db"
os.makedirs("data", exist_ok=True)

SYSTEM_PROMPT = "You are a helpful assistant."

WINDOW_SIZE = 4

rule_extractor_llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 讲师原话：存的是行为规则，比如"总是用 bullet points 回答"
RULE_EXTRACTOR_PROMPT = """You extract behavioral rules about how the user wants to be answered.

Look at the conversation. If the user expressed a preference about tone, format,
or language (for example: "always respond in bullet points"), save it as a rule.

Return only valid JSON in this shape:
{{"rules": ["rule 1", "rule 2"]}}

If there is no new rule, return {{"rules": []}}.
No markdown. No explanation.

Existing rules:
{existing_rules}

Conversation:
{conversation}
"""


def load_rules(store, user_id: str) -> list[str]:
    item = store.get(("user", user_id), "rules")
    return item.value.get("rules", []) if item else []


def save_rules(store, user_id: str, rules: list[str]) -> None:
    store.put(("user", user_id), "rules", {"rules": rules})


def extract_rules(store, user_id: str, messages: list) -> list[str]:
    import json
    existing = load_rules(store, user_id)
    conversation = "\n".join(
        f"{type(m).__name__}: {m.content if isinstance(m.content, str) else m.content}"
        for m in messages
    )
    prompt = RULE_EXTRACTOR_PROMPT.format(
        existing_rules=json.dumps(existing, ensure_ascii=False),
        conversation=conversation,
    )
    resp = rule_extractor_llm.invoke([HumanMessage(content=prompt)])
    raw = resp.content.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        new_rules = json.loads(raw).get("rules", [])
    except Exception:
        print(f"[warn] rule extractor 返回非法 JSON：{raw[:200]}")
        return existing
    merged = list(dict.fromkeys(existing + new_rules))
    return merged


@before_model
def inject_ltm_rules(state: dict, runtime: Any) -> dict | None:
    """把 LTM 里的规则注入到 system prompt 里。讲师现场这个环节有 bug，见第 7 节。"""
    store = runtime.store
    user_id = runtime.context.get("user_id", "default") if runtime.context else "default"
    if store is None:
        return None
    rules = load_rules(store, user_id)
    if not rules:
        return None

    messages = state["messages"]
    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    non_system = [m for m in messages if not isinstance(m, SystemMessage)]

    rules_text = "\n".join(f"- {r}" for r in rules)
    new_system = SystemMessage(
        content=f"{SYSTEM_PROMPT}\n\nUser behavioral rules:\n{rules_text}"
    )
    return {"messages": [new_system] + non_system}


@before_model
def sliding_window_middleware(state: dict, runtime: Any) -> dict | None:
    messages = state["messages"]
    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    non_system = [m for m in messages if not isinstance(m, SystemMessage)]
    if len(non_system) <= WINDOW_SIZE:
        return None
    return {"messages": system_msgs + non_system[-WINDOW_SIZE:]}


@after_model
def save_rules_middleware(state: dict, runtime: Any) -> dict | None:
    store = runtime.store
    user_id = runtime.context.get("user_id", "default") if runtime.context else "default"
    if store is None:
        return None
    rules = extract_rules(store, user_id, state["messages"])
    save_rules(store, user_id, rules)
    return None


def build_agent(store, checkpointer):
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    agent = create_agent(
        model=model,
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[
            inject_ltm_rules,
            sliding_window_middleware,
            save_rules_middleware,
        ],
        checkpointer=checkpointer,
        store=store,
    )
    return agent


def show_stm(agent, config):
    state = agent.get_state(config)
    msgs = state.values.get("messages", [])
    print(f"\n=== STM (thread={config['configurable']['thread_id']}): {len(msgs)} messages ===")
    for i, m in enumerate(msgs):
        content = m.content if isinstance(m.content, str) else str(m.content)
        print(f"[{i}] {type(m).__name__}: {content[:120]}")
    print("=" * 40)


def show_ltm(store, user_id: str):
    rules = load_rules(store, user_id)
    print(f"\n=== LTM rules for user={user_id} ===")
    for r in rules:
        print(f"- {r}")
    print("=" * 40)


def main():
    stm_conn = sqlite3.connect(STM_DB, check_same_thread=False)
    checkpointer = SqliteSaver(stm_conn)

    with SqliteStore.from_conn_string(LTM_DB) as store:
        store.setup()
        agent = build_agent(store, checkpointer)

        user_id = "kirti"
        thread_id = "T1"

        while True:
            user_input = input(f"\n[{thread_id}] You: ").strip()
            if user_input.lower() in ("exit", "quit"):
                break
            if user_input.lower() == "/stm":
                show_stm(agent, {"configurable": {"thread_id": thread_id}})
                continue
            if user_input.lower() == "/ltm":
                show_ltm(store, user_id)
                continue
            if user_input.lower().startswith("/switch "):
                thread_id = user_input.split(" ", 1)[1].strip()
                print(f"[switched to thread {thread_id}]")
                continue

            config = {
                "configurable": {"thread_id": thread_id, "user_id": user_id},
                "context": {"user_id": user_id, "thread_id": thread_id},
            }
            result = agent.invoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config=config,
            )
            print(f"AI: {result['messages'][-1].content}")


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 为什么 `checkpointer` 一挂上，手写 SQL 就可以删了

`01` 里最关键的一行是 `checkpointer=SqliteSaver(conn)`。讲师在 79:03 说「它处理的是 SQLite saver」，在 80:01 说「现在记忆是由 LangChain 替我们处理的」。这句话的技术含义是：`create_agent` 内部本来就是一个 LangGraph 的 state graph（讲师在 127:30 亲口确认「model 和 tool 之间的调用，那其实就是 LangGraph 的 state graph」），而 state graph 的每个节点执行完都会把 state 快照写进 checkpointer。所以你不需要在业务代码里 `INSERT INTO messages`，框架在每次节点切换时自动做。

**在 JS/Node 里对应什么**：相当于你用某个 workflow 引擎（比如 LangGraph.js）时，把 `checkpointer` 当成「自动事务日志」，而不是自己在每个 handler 里手写 `await db.save()`。

### 5.2 为什么中间件挂在 `before_model` 而不是 `after_model`

讲师在 83:12 说「为了限制上下文、为了裁剪历史」。裁剪必须发生在**模型被调用之前**，否则模型已经看到了全部历史，裁了也没用。所以滑动窗口和摘要都挂 `before_model`。

反过来，`03` 和 `04` 里抽事实、抽规则挂的是 `after_model`——因为要等模型回复完，才有完整的「一轮对话」可以拿去抽。讲师在 108:26 看 LangSmith 时，fact extractor 的输入里确实包含了 AI 的回复，印证了这一点。

### 5.3 为什么 `trim_messages` 的 `token_counter=len`

`trim_messages` 默认按 token 数裁，但讲师现场说的是「4 条消息」（82:19 一条条数出来的），不是「4 个 token」。所以这里把 `token_counter` 换成 `len`，让它按**条数**裁。这是个容易踩的坑：不换的话你会得到完全不同的行为。

### 5.4 摘要中间件里，`older` 和 `recent` 怎么切

```python
older = non_system[:-KEEP_RECENT]
recent = non_system[-KEEP_RECENT:]
```

讲师在 91:44 说得很清楚：「我把保留的最近消息之外、更旧的那些消息，拿去调摘要器」。所以 `older` 是**滑出窗口的那部分**，`recent` 是**留在窗口里的**。摘要只压 `older`，`recent` 原样保留。

`previous_summary` 也一起送进去——讲师在 92:41 确认「上一轮的摘要会变成一条新消息，也会被再次发送」。这是为了防止摘要「摘要的摘要」时丢掉早期信息。

### 5.5 摘要 prompt 为什么是这句

讲师在 87:30 念出来的原话是「把这个对话用两三句话总结，保留关键事实」。代码里 `"Summarize this conversation in two to three sentences, preserving the key facts."` 就是这句的英文原文。不要改成「总结对话」这种模糊表述，因为「两三句」和「保留关键事实」是两个硬约束，去掉任何一个，摘要长度或信息密度都会跑偏。

### 5.6 为什么摘要用 `gpt-4o-mini` 而主 agent 用 `gpt-4o`

讲师在 91:16 说「你可以用更便宜的模型做摘要，你可以为摘要用不同的模型」。摘要是个低难度任务（压缩 + 保关键事实），用便宜模型完全够，而且摘要调用频率高（每超过阈值就调一次），成本敏感。这是本课唯一一个明确的成本优化点。

### 5.7 `SqliteSaver` vs `SqliteStore`：两个数据库、两个 key

这是本课最核心的架构区分，讲师在 102:47 和 117:20 讲了两遍：

| | CheckPointer（`SqliteSaver`） | Store（`SqliteStore`） |
|---|---|---|
| 存什么 | 线程内的 state 快照 | 跨线程的长期信息 |
| 按什么索引 | `thread_id` | `user_id` |
| 生命周期 | 一个会话 | 跨会话 |
| 讲师用的文件 | `stm_combined.db` | `ltm_combined.db` |

`04` 里 `config` 同时带了 `thread_id` 和 `user_id`，就是让两个存储各取所需。**不要图省事塞进一个 db 文件**——讲师原话是「我要存到两个不同的数据库里」，分开才能独立清理、独立扩容。

### 5.8 fact extractor 的 prompt 为什么这么长

讲师在 110:21 逐句念了这个 prompt，每一句都有作用：

- `"You are a fact extractor"` —— 定角色，避免模型开始聊天。
- `"If the conversation is about Kohli, Dhoni, Modi, Priyanka Chopra... extract nothing"` —— **负样本**。不给负样本，模型会把「用户问了 Kohli」当成「用户对板球感兴趣」存下来。讲师在 109:52 专门验证了这一点。
- `"Turn the user's job, preferences, location, and similar details into long-term facts"` —— 给正样本类别。
- `"merges existing facts with new facts"` —— 要求**合并**而不是覆盖，否则每次抽取都会丢掉之前的事实。
- `"Return only valid JSON. No markdown. No explanation."` —— 格式约束。

讲师在 111:17 亲口承认这个约束**不保证生效**，所以代码里加了 `raw.startswith("```")` 的容错。想彻底稳，用 Pydantic 的 structured output——但讲师说「那不是这个 demo 的目标」。

### 5.9 `04` 里三个中间件的顺序

```python
middleware=[inject_ltm_rules, sliding_window_middleware, save_rules_middleware]
```

顺序有讲究：

1. `inject_ltm_rules` 先把 LTM 规则拼进 system prompt —— 必须在裁剪之前，否则规则可能被裁掉。
2. `sliding_window_middleware` 再裁历史 —— 此时 system prompt 已经是最新的。
3. `save_rules_middleware` 在 `after_model`，等回复完再抽规则。

如果 1 和 2 顺序反了，会出现「规则注入了但立刻被窗口裁掉」的诡异现象。

### 5.10 讲师现场那个 bug 的技术猜测

119:17 讲师发现切到 T2 后 bullet points 规则没生效。从代码角度看，最可能的原因是：`inject_ltm_rules` 里 `runtime.context.get("user_id")` 在切换 thread 后拿到了 `"default"` 而不是 `"kirti"`，导致 `load_rules` 返回空。讲师自己在 119:45 也怀疑「我是不是没把 LTM 跟 context 一起送进去」。

但他在 120:40 给的结论是「有时候 LLM 根本不在乎」——这是**另一个**层面的问题（模型看到了规则但没遵守），跟「规则没注入」是两回事。课里没有区分这两者，也没有修。你复现时如果遇到，先打印 `inject_ltm_rules` 里拿到的 `rules` 列表，确认是「没注入」还是「注入了但没遵守」，再决定往哪修。

---

## 6. 复现检查清单

按顺序打勾，任何一项不过，先修这一项再往下：

**环境**
- [ ] `pip install -r requirements.txt` 无报错
- [ ] `python -c "from langgraph.checkpoint.sqlite import SqliteSaver"` 无报错
- [ ] `python -c "from langgraph.store.sqlite import SqliteStore"` 无报错
- [ ] `.env` 里 `OPENAI_API_KEY` 有效，能跑通一次 `ChatOpenAI().invoke("hi")`

**01 滑动窗口**
- [ ] 跑起来后聊 3 轮，`/history` 显示输入里只有 4 条历史 + 1 条 system
- [ ] 最终响应是第 5 条（对应讲师 82:19 的数法）
- [ ] `data/stm_sliding.db` 被创建
- [ ] Ctrl+C 重启后再聊，它能接上之前的话题（证明 checkpointer 生效）

**02 摘要**
- [ ] 聊到第 3 轮（超过 6 条）时，终端打印 `[summarization triggered]`
- [ ] `/history` 里出现 `Conversation summary so far:` + 最近 4 条
- [ ] 摘要那次调用耗时明显长于普通调用（讲师现场是 10.9 秒，你的可能不同）
- [ ] `data/stm_summarization.db` 里有 `summaries` 表
- [ ] 重启后再问「我们聊了什么」，它能答上来
- [ ] 把 `SUMMARIZE_AFTER` 改成 8、`KEEP_RECENT` 改成 2，行为随之改变（讲师 93:11 让你这么玩）

**03 LTM 用户画像**
- [ ] 说「我是 Kirti，我喜欢用 Python 写代码」→ `/facts` 显示 name 和 preference
- [ ] 问「给我写个二分查找」→ 用 Python 写
- [ ] 说「我喜欢 C++ 不是 Python」→ `/facts` 更新
- [ ] 再问二分查找 → 用 C++ 写
- [ ] 问「Kohli 是谁」→ `/facts` **不变**（这是负样本验证，最重要的一项）
- [ ] `data/ltm_profile.db` 被创建

**04 STM + LTM**
- [ ] `data/stm_combined.db` 和 `data/ltm_combined.db` **两个文件都存在**
- [ ] 说「总是用 bullet points 回答」→ `/ltm` 显示这条规则
- [ ] `/stm` 显示当前 thread 的消息
- [ ] `/switch T2` 后 `/stm` 是空的（新 thread）
- [ ] 在 T2 问「什么是 AI agents」→ **大概率不会**用 bullet points（这是讲师现场发现的 bug，见第 7 节，不算你复现失败）

**架构理解（口述自检）**
- [ ] 能说清 CheckPointer 和 Store 的区别（按 thread vs 按 user）
- [ ] 能说清为什么中间件挂 `before_model` 而不是 `after_model`
- [ ] 能说清 LangChain middleware 和 LangGraph state graph 的关系（讲师 127:06 那段）

---

## 7. 课里没讲但你会撞上的

**1. 切 thread 后 LTM 规则不生效（讲师现场就没修好）**

119:17 讲师亲口说「这里有点问题」，120:40 给的结论是「有时候 LLM 根本不在乎」。但这句话解释不了「规则根本没注入」的情况。你复现时先加一行 `print(rules)` 在 `inject_ltm_rules` 里，确认是注入层的问题还是模型遵守层的问题。课里没讲怎么修。

**2. 摘要阈值和窗口的边界重叠（学员 Hari 追问了 10 分钟，讲师承认 tricky）**

132:10 起，Hari 指出：阈值 6、窗口 4 时，第 5 条消息会漏掉第 1 条。讲师承认「是的，会这样」，但说「通常 human 和 AI 成对出现，所以看起来还好」。138:15 他说「那部分确实 tricky，取决于你的摘要逻辑」。141:08 他查了 LangChain 官方实现：**50 条消息或 3000 token 触发，两者取其一**，并且可以配保留最近多少条。课里没给最终方案，只给了「官方是这么做的」这个参考。

**3. 摘要的「摘要的摘要」会丢信息**

讲师在 94:10 认可了 Satish 的说法：「随着摘要不断累积，上下文也会变弱」。代码里 `previous_summary` 每次都被重新送进摘要器，理论上 N 轮之后早期信息会被压没。课里没讲怎么缓解（比如给摘要加「不可丢失事实」白名单）。

**4. fact extractor 不保证返回合法 JSON**

111:17 讲师明确说「你可以用 Pydantic 的结构化输出保证它一定返回那个格式，但这不是这个 demo 的目标」。代码里只做了 ``` 包裹的容错。生产环境必须上 structured output，课里没展开。

**5. 免费模型跑不动这套 prompt**

111:46 讲师原话：「如果你用免费模型，这段代码可能跑得不太好，因为我把所有东西都放在 prompt 里了。我用的是 GPT-4o，我觉得够用了。」换模型前先做好 fact extractor 输出格式崩掉的准备。

**6. LSTM 的 forget gate 在这里没有对应物**

149:13 学员问「LSTM 有 forget gate 控制忘什么，这里除了 prompt 有没有类似机制」。讲师在 150:08 承认「我们会借助 LLM，它不是很确定，会忘掉很重要的东西」，151:01 说「我们会做校验，确保它被存下来」，152:24 说「你没法总是保证，最终是在模仿人类行为」。**课里没有给出确定性的遗忘策略**，这是明确留到后续课程的话题。

**7. 多实例 / 分布式下的记忆一致性**

153:52 学员问「数据分布在多个实例上怎么办」，讲师说「这是 RAG 的一部分，我们后面会讲分布式架构和扩展」。本课没讲。

**8. `create_agent` 的完整签名**

课里没讲。代码里用的是当前 LangChain 的 `create_agent(model=, tools=, system_prompt=, middleware=, checkpointer=, store=)`。如果你的版本签名不同，以 `help(create_agent)` 为准。

**9. `runtime.context` / `runtime.store` 的取法**

课里没讲具体 API。代码里按「`runtime.context` 是 dict、`runtime.store` 是 store 对象」写。不同版本可能叫 `runtime.config["configurable"]`，以你实际版本为准。

**10. 下一节课的内容（讲师预告，不算本课）**

104:13 和 123:28 讲师预告：下周讲 **token budgeting**、**caching**（会算 read/write 花了多少钱）、**harness engineering**、然后是 **security**、**LLM ops**、**Claude Code 项目**。另外有两个小组项目：**financial trading** 和 **infra sales**，周末要先把 RAG 和 memory 部分做出来。这些都不在本段课的代码范围内。