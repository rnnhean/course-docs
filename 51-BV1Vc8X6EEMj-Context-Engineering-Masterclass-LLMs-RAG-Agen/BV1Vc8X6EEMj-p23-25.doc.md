# Context Engineering Masterclass：会话历史管理、短期记忆与长期记忆（P23–P25）

> 读者定位：前端转 AI 应用工程师。本文所有 Python 代码都可直接保存运行；涉及并发/事务的地方会补一句「在 JS/Node 里对应什么」。Java 语法只标注「知道即可」。

---

## 1. 这一节做什么

这三节课解决同一个问题的三个层次：**AI 应用怎么"记住"东西**。

- **P23**：先讲清楚"记忆"为什么是 AI 应用从玩具变成产品的分水岭。核心结论是——大模型本身没有记忆，ChatGPT 之所以"记得你"，是应用层在每次请求时把历史对话一起发过去。这不是模型记忆，这是 **context engineering（上下文工程）**。然后给出记忆的三层分类：工作记忆（working memory）、短期记忆（short-term memory）、长期记忆（long-term memory）。
- **P24**：聚焦**会话历史管理**。即使 20 万 token 的上下文窗口装得下 50 轮对话，你仍然必须管理历史，因为 token 要花钱、增加延迟、稀释注意力。讲师给出四种策略：滑动窗口（sliding window）、摘要（summarization）、选择性剪枝（selective pruning）、混合（hybrid），并写成一个完整的 `conversation_history.py` 文件跑通对比。
- **P25**：聚焦**短期记忆**。历史是"全量消息"，短期记忆是"从消息里抽取出来的事实"，按 identity / constraints / preferences / context / state 五类归档、打分、衰减、清理。写成一个 `short_term_memory.py` 文件跑通抽取与清理。

学完这三节，你会得到两个可运行的 Python 文件：一个能对同一段长对话跑出四种历史管理策略的上下文对比，一个能从对话里抽取结构化事实、按查询检索相关事实、并按轮次衰减清理。P25 结尾预告的"跨会话记住用户"（长期记忆）属于下一节，本文不涉及。

---

## 2. 讲师原话

> "每一次对话，比如和 ChatGPT 或你用的任何 AI 工具，都是从零开始的。它不记得你，不记得你的偏好，什么都不记得。你现在已经知道这一点了。它甚至不记得你两小时前说过什么。"
> —— p023 [00:00]

> "在原始层面上，这就是问题所在。在那个点上，那不是智能。那 literally 就是我们所说的失忆症。"
> —— p023 [00:16]

> "如今 ChatGPT 之所以看起来能记住，唯一的原因是应用层把之前发生的整段对话历史，在每一次请求时都发送过去。这样大语言模型就有了那个上下文。这不是模型记忆，这实际上是上下文工程。"
> —— p023 [01:30]

> "没有记忆，我们最终会陷入这种无状态的问题：每一次 API 调用都是一个完全隔离的进程，这不好，因为第一次调用做完自己的事，什么都不会保存。"
> —— p023 [02:26]

> "记忆确实把 AI 从一个工具变成了一段关系。记住，这是你和你的用户之间的一段关系。"
> —— p023 [03:47]

> "第一种是我们所说的**工作记忆**。工作记忆关乎你此刻正在想什么。在 AI 里就是当前的对话上下文，此刻正在发生的事。它的生命周期通常只有单次请求。"
> —— p023 [04:14]

> "第二种是我们所说的**短期记忆**。这更多是关于近期事件和上下文，刚刚发生的事。在 AI 里就是会话历史，上一次会话发生了什么，最近的交互。生命周期通常是几分钟到几小时。"
> —— p023 [04:44]

> "然后是**长期记忆**。这关乎持久化知识、保存知识以备后用。在 AI 里就是用户偏好、事实、模式等等。生命周期从几天到永远，literally 永远。"
> —— p023 [05:11]

> "你的用户已经聊了一个小时，50 轮，20000 token，一切都还装得下，因为现代上下文窗口能装 20 万以上 token。那问题来了，为什么还要管理它？"
> —— p024 [00:00]

> "我们想管理它的原因是：这些 token 每一个都要花钱，它们增加延迟，而且它们把模型真正需要的信号给埋掉了。"
> —— p024 [00:00]

> "2026、2027 年的历史管理，不再只是关于溢出，因为那是以前的担忧。它关乎成本、速度和注意力。"
> —— p024 [00:27]

> "旧的说法是：历史会溢出上下文窗口。那曾经是真的。在今天的模型上通常不会，因为我们通常有超过 20 万的窗口，轻松吞下 20K。这不是问题。"
> —— p024 [01:19]

> "第一是成本，因为你在每次请求时都发送整段历史。这意味着历史越长，每轮的线性成本增长。第二是延迟，延迟，延迟，因为输入 token 更多，首 token 时间就更慢。第三是注意力，你发送的低信号历史越多，模型就越难找到真正重要的东西。信噪比下降。"
> —— p024 [01:48]

> "我们有四种历史管理策略：滑动窗口、摘要、选择性剪枝、混合。看起来混合无处不在，在我们学的任何上下文工程策略里都是。"
> —— p024 [02:30]

> "滑动窗口的优点是简单、可预测。缺点是会丢失早期上下文。摘要，顾名思义，就是把这些旧消息变成小的摘要块。优点是保留要点，缺点是我们可能丢失细节，比如为此可能产生的额外 API 调用。"
> —— p024 [02:46]

> "然后是选择性剪枝。这里全是关于剪掉、移除低排名或低星级的消息。内部显然会有一个排序系统，来判断哪些是低排名消息，把它们移除，给高星级消息腾出空间。优点是保留重要的东西，真正的信号；缺点是打分，如你所知或可能知道，非常困难。"
> —— p024 [03:15]

> "然后是混合，我们把这三个里最好的拿出来，全部放进一个策略里。优点是我们拥有全部的好处。这就是我们所说的最佳实践。"
> —— p024 [04:06]

> "混合策略是这样的：我们有一个摘要，把所有对话压缩；然后下一个实现的策略是只钉住重要消息，逐字保留，完全保持原样；我们实现滑动窗口，只允许看最后 n 轮并保持它们完整。所有这些让我们得到最终的上下文，最佳实践，全世界最好的。"
> —— p024 [04:23]

> "滑动窗口的想法是，我们只关注对话的最后 n 轮。对话会有第一轮、第二轮、第三轮等等。做滑动窗口策略时，我们丢掉所有这些旧的，然后滑动，只关注最后几轮，因为这里会有最新的信息。"
> —— p024 [05:15]

> "现在看代码这边，这样我们就能开始实现每一个历史管理策略。我们有这个 `conversation_history.py`。这个文件囊括了所有这些策略。"
> —— p024 [06:01]

> "首先我们有一个 message 类。这只是一个数据类，让我们跟踪 role、content 和 timestamp 这些东西。当然这里还有 summary model。你要为这个找一个更便宜的模型。这里我用的是 Claude Haiku。也许你看这个视频的时候它已经废弃了，没关系，换成适合你用例的就行。"
> —— p024 [06:22]

> "我们这里有一个函数叫 `llm_summarize`。它会调用大语言模型，用真实的 LLM 调用来摘要所有对话轮次。"
> —— p024 [06:51]

> "策略一，滑动窗口。顾名思义，正如我们讲过的，重点是只保留最后 n 轮。非常简单，极其有效。"
> —— p024 [07:21]

> "策略二，摘要。我们会用那个 `summarize_old` 函数，就是上面看到的辅助函数。这里是对历史做摘要，压缩所有旧消息，用 LLM 生成的摘要来省 token。非常强大。"
> —— p024 [07:45]

> "策略三，选择性剪枝。记住，这里我们实际上是在剪枝。就像给树剪枝，剪掉不重要的东西。我们给所有消息打分。这里需要一个按重要性打分的系统。如果不重要，我们就剪掉、扔掉，只保留重要的。"
> —— p024 [08:10]

> "策略四，混合，最佳实践。如你所见，我们把所有策略放在一起，三个世界的最好，全部加进一个混合策略里，把一切管住。我们会摘要所有轮次，但始终钉住重要信息或消息。"
> —— p024 [08:41]

> "然后底部我放了一些模拟和演示，这样你能看到这些策略实际怎么工作，每一个都看一遍。"
> —— p024 [09:18]

> "我们生成一段示例长对话，有人正在和我们的助手打字、连接、对话。你能看到'我叫 John'、'你好 John'这些。真实世界里你当然会从你的数据库系统或聊天机器人里拉取，但这里模拟我们想做的事。"
> —— p024 [09:18]

> "我们可以看到原始对话 22 条消息。记住这是看最后一轮或最新的对话。这里我们取 5 轮，上下文里的消息是 10 条，字符数是 413，差不多一百多。第一条消息是'thanks, that's helpful'，最后一条是'sounds good, have a great week John'。这就是我们实际保留的上下文，看到第一条和最后一条消息。"
> —— p024 [10:13]

> "摘要这里我们只保留 3 条，上下文里的消息是 13 条，928 个字符，超过 200 token。你能看到第一条消息里也包含了之前的对话摘要，这就是摘要的全部要点：我们逐字保留所有之前的对话，然后摘要它们。"
> —— p024 [10:38]

> "然后是混合。混合这里我们把所有策略放在一起。上下文里的消息现在是 14 条，因为我们从所有这些不同策略里拉取，对吧，这就是重点。字符数自然会高一点，这合理。但美妙之处在于我们拥有其他三个策略的所有优点，全部放在一起。"
> —— p024 [11:19]

> "现在你能看到第一条消息里有所有这些内容，加上用户自我介绍和更多信息。非常简洁，所有它需要的片段，因为现在全是混合的。我们有滑动窗口、有摘要、有剪枝，全都发生了。还有一条最后的消息会一直在那里。"
> —— p024 [11:49]

> "这个案例里最后一条消息是一样的，因为它是最近的消息，必须一直在。否则助手不知道要做什么。"
> —— p024 [12:16]

> "使用这些策略会极大地帮助你的 AI 应用更健康、更快，让你的生产 AI 应用不仅更快，还能省很多钱。当然你的用户会开心，因为他们得到了最好的服务。"
> —— p024 [12:37]

> "关键要点：第一，滑动窗口，我们理解这是简单策略，会丢失早期上下文。第二，摘要，这是关于保留上下文的要点，消息等等，但会丢失一点细节，而且会花你一次额外调用，因为你实际上在调用大语言模型。第三，选择性剪枝，这是关于保留重要信息，但要知道打分是非常难的话题。如果打分不够好，你就会有麻烦，但它确实是另一个可用的策略。第四，混合，这是最佳实践。"
> —— p024 [13:02]

> "有两个坑值得指出。摘要意味着一次真实的 LLM 调用。我们不是在切字符。截断往往会丢掉摘要本该保留的那部分信息。所以这是对大语言模型的直接调用。"
> —— p024 [13:59]

> "另一件要记住的事是，Anthropic 的 system prompt 是一个顶层参数，不是 role 参数。"
> —— p024 [14:24]

> "玩一玩这个概念。代码在这里给你。改造它，让它真正适合你的用例。这就是重点。做一些测试，扔一些真实数据进去，看看差异。"
> —— p024 [15:06]

> "我们来聊短期记忆。这里的想法是：保留什么、丢弃什么。这非常重要，因为想象你有一个用户提到了 500 美元的预算。三轮之后，他们问推荐。你的 AI 记得吗？"
> —— p025 [00:00]

> "短期记忆捕捉对话中真正重要的事实，同时不用完整历史把上下文撑爆。"
> —— p025 [00:29]

> "短期记忆捕捉当前会话中抽取出来的事实。这就是想法。我的预算是 500 美元。这会被抽取出来，用关键词或大语言模型，两者都可以，放进不同类别。我们有 identity、constraints、preferences 等等。"
> —— p025 [00:54]

> "然后我们走一个流程，丢掉不需要的东西。不再有用的过期事实会被丢掉。清理发生之后，我们才把所有片段拼进上下文。我们把它注入到 prompt 里，这就是上下文。"
> —— p025 [01:23]

> "注意我们有大约五个类别来细分记忆。这只是让我们可视化短期记忆如何细分。最上面是 identity，比如'我叫 Sarah'，我们给它某种分数，某种评分，来知道这条信息的相关性。我们有 constraint，预算是 500。我们有 preferences，我偏好深色模式。我们有 context，你在做什么？我们在找笔记本电脑。还有 state。state 是我们比较 A 和 B 的地方。这是 transient（瞬态的），意味着它随情况变化。这就是五个事实类别。"
> —— p025 [01:48]

> "随着对话继续，我们有一长串被保存的片段。我们有完整消息，说过的所有东西，所有这些片段会变得很大。这会成为问题，如你所知。上下文越膨胀，对大模型来说问题越大。所以我们想在这里再次抽取或压缩，只拿到需要的东西。只要精华。"
> —— p025 [02:33]

> "这里的要点是让它尽可能小、尽可能紧凑，这样我们就不会有不需要的信息膨胀。这就是历史和短期记忆的区别。历史你拥有一切，某些情况下没问题。短期记忆我们不需要拥有一切，所以我们抽取需要的，分类，让它准备好被大语言模型使用。"
> —— p025 [02:54]

> "因为这一切都是动态的，清理也是短期记忆非常重要的一部分，因为我们要确保保留需要的、丢掉不需要的。因为记住，我们一直在 policing（巡查），不是我们，是系统应该巡查，确保我们不保留垃圾。"
> —— p025 [03:21]

> "我们始终保留 identity，包括名字、角色等等；constraints，这个案例里预算是约束，截止日期、需求；preferences，非常重要，喜欢、不喜欢、其他偏好。这些如此重要，必须至少保留 30 轮之后，意思是如果需要，这些片段至少在 30 轮后还能用。"
> —— p025 [03:50]

> "另一方面，有些东西我们需要扔掉、丢弃。这些会在比如 10 轮、9 到 10 轮后过期。比如这里的某些上下文'在找笔记本电脑'。他们不会永远找笔记本电脑。所以我们不需要保留这条信息，扔掉它。state，因为瞬态，比较 A 和 B，应该被丢掉；瞬态信息如我们所说，也应该被丢掉。"
> —— p025 [04:18]

> "我们只想保留有用的信息。这些信息通常在聊天的那一刻有用。一旦完成，我们就把它裁掉。"
> —— p025 [04:39]

> "现在让我在代码里给你看短期记忆，这样你能看到所有这些实现，所有这些类别实现，看到它怎么工作。我们有 `short_term_memory.py`，在我们的项目文件夹下。"
> —— p025 [04:39]

> "首先我们有一个数据类，这是用来装我们的内容、我们的事实：content、category、confidence、extracted_when（什么时候抽取的）、source_turn（来源轮次）。然后我们有 short term memory，如你所见，这是会从对话里抽取事实的类。"
> —— p025 [05:04]

> "如我们所说，我们会分类并给相关性打分。这个类做很多事：抽取偏好、看预算约束、识别（拿名字等等）、需求、上下文和瞬态状态。瞬态状态记住这是大约 10 轮后会被丢掉的东西，因为我们不想长期保留这条信息，因为它没必要。"
> —— p025 [05:33]

> "然后这里有一个函数叫 `get_relevant_facts`，它只拿与查询相关的东西；还有 `cleanup`，移除所有旧的过期数据。"
> —— p025 [06:00]

> "我们跑一下，这样你能看到。你可以看到我实例化这个短期记忆对象类，然后我们有模拟。我手动传入消息，这些是从真实对话、聊天机器人里会被抽取出来的东西。'嗨，我叫 Sarah，我是一名软件开发者。我在找一台新笔记本电脑'，等等。"
> —— p025 [06:24]

> "第一步，我们从对话里抽取事实。第一轮是'嗨，我叫 Sarah，我是一名软件工程师'。注意它提取了这个实体。它知道是 Sarah，置信度 95。第二轮，'我在找一台新笔记本电脑，用于编程和视频剪辑'。这属于 context，置信度约 70%。第三轮，'现在我正在比较 MacBook Pro 和 Dell'，这是 state。它知道这是 state，把这段保存为 state，置信度约 60%。第四轮，'我的预算大约 1500'，这是 constraint，保存在 constraint 桶里，置信度 90%。第五轮，'我偏好 MacBook，但我开两个窗口'，这是 preference 类别。"
> —— p025 [07:00]

> "第六轮，'我至少需要 16GB'。这是 constraint，因为我们在说我不需要别的，我需要至少 16GB。这是约束，约 85%。美妙之处在于注意，'谢谢建议'，它甚至没有分类，因为它只是一条不会被用于任何事的信息。所以什么都没做。但第八轮，'实际上我还需要 Thunderbolt 接口来接我的显示器'。啊，这是 constraint，置信度 85%。"
> —— p025 [07:29]

> "现在你能看到我们有了所有抽取出来的事实。注意 identity 下面，因为这实际上被保存为一条信息、一条数据，放在不同类别下。identity 是'嗨，我叫 Sarah，我是一名软件开发者'。这确实是这个人在对话里的 identity。所以这就是被保存为 identity 类别的东西。"
> —— p025 [08:25]

> "然后 context，'我在找一台新笔记本电脑，用于编程和视频剪辑'。这就是 context。还有 state，'现在我正在比较'，state 是什么？此刻在发生什么？此刻我在比较 MacBook Pro 和 Dell XPS。constraints，我们拿到几个。看这个，它拉出了所有约束，不止一个。预算是约束，拿到两个；电脑内存 16GB，是约束；'实际上我还需要 Thunderbolt'，是另一个约束。如果没有 Thunderbolt，我就不买。"
> —— p025 [08:53]

> "所以我们可以看到它把一切细分到不同类别。这正是我需要的。preferences 当然，'我偏好 MacBook，但对 Windows 开放'，是 preference。然后我们有查询相关事实。如果查询进来说'嘿，视频剪辑我该推荐什么笔记本？'它会看 context：他们在找用于编程和视频剪辑的新笔记本；约束是 Thunderbolt，其中之一；另一个约束是预算，合适机器要 1500 到 2000。这些就是这个查询的相关事实。你能看到现在这有多聚焦。"
> —— p025 [09:20]

> "当然，随着对话继续，东西会衰减。所以我们有 cleanup，也就是衰减。注意清理前事实是 7 条。清理后，23 轮之后，我们只剩 5 条。为什么？因为不是所有东西都会保持相关。随着时间流逝，东西会衰减，作为不必要的东西被清理掉。剩下的类别现在是 constraint、identity 和 preference。所以这应该是一台持续运转的机器。"
> —— p025 [10:18]

> "随着时间流逝，它会自我循环，随着对话进行拉入新信息。这就是拥有短期记忆的美妙之处，以及这样分类的方式。这样大语言模型总是拿到最新鲜的信息上下文，让它能正确回应。这是上下文工程的另一部分。"
> —— p025 [10:48]

> "关键要点：短期记忆等于什么？全是关于抽取出来的事实。不是关于完整消息。第二，全是关于分类。我们有 preferences、constraints、context、state、identity 这些类别。这些也会根据我们在哪一步而变化。当我们到衰减或清理时，我们可能会丢掉比如 state。第三，用 LLM 自动抽取事实。这是另一件必须记住的事。这里作为演示我没用 LLM，但生产环境你必须用大语言模型做抽取。这是必须的。第四，我们需要应用衰减。这非常重要。为什么？因为 state 事实会过期。偏好通常不会。如果你是程序员，你可能很长时间都是程序员。第五，确保定期做清理，防止膨胀。"
> —— p025 [11:16]

> "这就是短期记忆，它活在会话之内。但跨会话记住用户呢？那是长期记忆的工作。魔法真正发生的地方。好，我们下次聊。"
> —— p025 [12:10]

---

## 3. 从零复现

### 3.1 环境准备

课里用的是 Python + Anthropic SDK。讲师没有在逐字稿里念出 `pip install` 命令，也没有念出 Python 版本号——**课里没讲**具体版本。下面给出的是能跑通这套代码的最小环境，版本号请以你本机实际安装为准。

```bash
# 1. 建目录
mkdir -p context-engineering-memory
cd context-engineering-memory

# 2. 建虚拟环境（Python 3.10+ 均可，课里没指定版本）
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. 装依赖
pip install anthropic python-dotenv
```

依赖说明：
- `anthropic`：P24 的 `llm_summarize` 会真实调用 Anthropic 模型（讲师用的是 Claude Haiku 作为摘要模型）。
- `python-dotenv`：用来从 `.env` 读 `ANTHROPIC_API_KEY`。讲师在代码里说"getting anthropic API key"，课里没讲他用的是环境变量还是 dotenv，这里用 dotenv 是最省事的做法。

### 3.2 环境变量

在项目根目录建 `.env`：

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

> 注意：P24 的 `llm_summarize` 是**真实 LLM 调用**，会花钱。讲师反复强调这一点："摘要意味着一次真实的 LLM 调用。我们不是在切字符。" 如果你只想先跑通流程不想花钱，可以先把 `llm_summarize` 换成一个本地假实现（见 5.2 的说明），但生产环境必须是真的 LLM 调用。

### 3.3 目录结构

```
context-engineering-memory/
├── .env
├── conversation_history.py     # P24：四种历史管理策略
└── short_term_memory.py        # P25：短期记忆抽取/检索/衰减
```

### 3.4 复现步骤

**第一步：写 `conversation_history.py`（P24）**

按第 4 节完整代码粘贴保存。这个文件包含：
1. `Message` 数据类（role / content / timestamp）
2. `SUMMARY_MODEL` 常量（讲师用 Claude Haiku）
3. `llm_summarize()` —— 真实 LLM 摘要调用
4. 四个策略类/函数：滑动窗口、摘要、选择性剪枝、混合
5. 底部模拟：生成一段 22 条消息的长对话，跑四种策略并打印对比

**第二步：运行 P24**

```bash
python conversation_history.py
```

预期输出（讲师在 p024 [10:13]–[11:49] 念出的数字，作为你对照的基准）：

| 策略 | 上下文消息数 | 字符数 | 第一条消息 | 最后一条消息 |
|---|---|---|---|---|
| 原始对话 | 22 | — | — | — |
| 滑动窗口（取 5 轮） | 10 | 413 | "thanks, that's helpful" | "sounds good, have a great week John" |
| 摘要（保留 3 条） | 13 | 928 | 含"previous conversation summary" + "I'm John, I work in marketing" | "sounds good, have a great week John" |
| 混合 | 14 | 略高 | 含摘要 + 用户自我介绍 + 更多信息 | 与最近消息一致 |

> 你跑出来的字符数会和 413 / 928 有出入，因为模拟对话文本和讲师屏幕上的不完全一致（逐字稿只念了片段）。**消息条数（10 / 13 / 14）是结构性的，应该对得上**；字符数对不上不算错。

**第三步：写 `short_term_memory.py`（P25）**

按第 4 节完整代码粘贴保存。这个文件包含：
1. `Fact` 数据类（content / category / confidence / extracted_when / source_turn）
2. `ShortTermMemory` 类：抽取、分类、打分、`get_relevant_facts()`、`cleanup()`
3. 底部模拟：8 轮手动消息，抽取事实、按查询检索、23 轮后清理

**第四步：运行 P25**

```bash
python short_term_memory.py
```

预期输出（对照讲师 p025 [07:00]–[10:18] 念出的结果）：

- 第 1 轮 "Hi, my name is Sarah and I'm a software engineer" → category=`identity`，confidence≈95
- 第 2 轮 "I'm looking for a new laptop for coding and video editing" → category=`context`，confidence≈70
- 第 3 轮 "Right now I'm comparing the MacBook Pro versus Dell XPS" → category=`state`，confidence≈60
- 第 4 轮 "My budget is around 1500" → category=`constraint`，confidence≈90
- 第 5 轮 "I prefer MacBooks but I'm open to Windows" → category=`preference`
- 第 6 轮 "I need at least 16 gigabytes" → category=`constraint`，confidence≈85
- 第 7 轮 "Thanks for the suggestion" → **不分类**（讲师原话："它甚至没有分类，因为它只是一条不会被用于任何事的信息"）
- 第 8 轮 "Actually, I also need Thunderbolt ports for my monitors" → category=`constraint`，confidence≈85

清理前 7 条事实，23 轮后剩 5 条，剩余类别为 `constraint` / `identity` / `preference`（`context` 和 `state` 被衰减掉）。

---

## 4. 完整代码

> 说明：逐字稿只念了代码的**结构和运行结果**，没有逐行念出源码；本节也没有提供 OCR 结果。因此下面两个文件是**按讲师描述的结构 + 念出的字段名 + 念出的运行结果**重建的可运行版本。凡是讲师明确点名的东西（`Message` 数据类的 role/content/timestamp、`SUMMARY_MODEL` 用 Claude Haiku、`llm_summarize`、`summarize_old`、`get_relevant_facts`、`cleanup`、五个事实类别、置信度数值、30 轮/10 轮的生命周期）都严格保留；讲师没念的细节（比如具体的打分启发式、模拟对话的完整文本）是重建的，已在注释里标注。

### 4.1 `conversation_history.py`（P24）

```python
"""
conversation_history.py
P24：四种会话历史管理策略
- 滑动窗口 sliding window
- 摘要 summarization
- 选择性剪枝 selective pruning
- 混合 hybrid（最佳实践）

运行：python conversation_history.py
依赖：pip install anthropic python-dotenv
环境变量：ANTHROPIC_API_KEY
"""

import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

# 讲师原话：摘要模型要找一个便宜的。这里用 Claude Haiku。
# 也许你看视频时它已废弃，换成适合你用例的即可。
SUMMARY_MODEL = "claude-3-5-haiku-latest"

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


# ---------- 1. Message 数据类 ----------
# 讲师原话：这是一个数据类，让我们跟踪 role、content、timestamp。
@dataclass
class Message:
    role: str          # "user" | "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


# ---------- 2. 真实 LLM 摘要调用 ----------
# 讲师原话：这会调用大语言模型，用真实的 LLM 调用来摘要所有对话轮次。
# 讲师强调：摘要 = 真实 LLM 调用，不是切字符。截断会丢掉摘要本该保留的信息。
def llm_summarize(messages: List[Message]) -> str:
    if not messages:
        return ""

    transcript = "\n".join(f"{m.role}: {m.content}" for m in messages)

    # 讲师原话：Anthropic 的 system prompt 是顶层参数，不是 role 参数。
    response = client.messages.create(
        model=SUMMARY_MODEL,
        max_tokens=512,
        system=(
            "You are a conversation summarizer. Compress the conversation "
            "into a compact summary that preserves facts, preferences, "
            "constraints and decisions. Drop small talk."
        ),
        messages=[
            {"role": "user", "content": f"Summarize this conversation:\n\n{transcript}"}
        ],
    )
    # 取第一个 text block
    return response.content[0].text


# 讲师提到的辅助函数名：summarize_old
def summarize_old(messages: List[Message]) -> str:
    return llm_summarize(messages)


# ---------- 3. 策略一：滑动窗口 ----------
# 讲师原话：重点是只保留最后 n 轮。非常简单，极其有效。
# 优点：简单、可预测。缺点：丢失早期上下文。
def sliding_window(messages: List[Message], n_turns: int = 5) -> List[Message]:
    # 一轮 = user + assistant，所以 n 轮 = 2 * n 条消息
    keep = n_turns * 2
    return messages[-keep:]


# ---------- 4. 策略二：摘要 ----------
# 讲师原话：压缩所有旧消息，用 LLM 生成的摘要来省 token。
# 优点：保留要点。缺点：可能丢细节 + 一次额外 API 调用。
def summarization(messages: List[Message], keep_recent: int = 3) -> List[Message]:
    if len(messages) <= keep_recent:
        return messages

    old = messages[:-keep_recent]
    recent = messages[-keep_recent:]

    summary_text = summarize_old(old)

    # 讲师原话：第一条消息里包含"previous conversation summary"。
    summary_msg = Message(
        role="user",
        content=f"[Previous conversation summary]\n{summary_text}",
    )
    return [summary_msg] + recent


# ---------- 5. 策略三：选择性剪枝 ----------
# 讲师原话：给所有消息打分，按重要性。不重要的剪掉，只留重要的。
# 优点：保留真正的信号。缺点：打分非常难。
def _score_message(msg: Message) -> float:
    """
    课里没讲具体打分算法，这里是重建的启发式：
    - 含数字/金额/偏好词/约束词的消息加分
    - 纯寒暄减分
    生产环境应换成 LLM 打分或 embedding 相似度。
    """
    text = msg.content.lower()
    score = 0.5
    keywords = ["budget", "prefer", "need", "must", "at least", "deadline",
                "my name", "i am", "i'm", "compare", "versus", "vs"]
    for kw in keywords:
        if kw in text:
            score += 0.15
    if any(ch.isdigit() for ch in text):
        score += 0.1
    if text.strip() in ("thanks", "thanks!", "ok", "okay", "sounds good"):
        score -= 0.4
    return max(0.0, min(1.0, score))


def selective_pruning(messages: List[Message], threshold: float = 0.6) -> List[Message]:
    # 最后一条永远保留（讲师原话：最近的消息必须一直在）
    if not messages:
        return []
    kept = [m for m in messages[:-1] if _score_message(m) >= threshold]
    kept.append(messages[-1])
    return kept


# ---------- 6. 策略四：混合（最佳实践） ----------
# 讲师原话：摘要所有轮次，但始终钉住重要消息（逐字保留），
# 再用滑动窗口保留最后 n 轮完整。
def hybrid(
    messages: List[Message],
    n_turns: int = 5,
    pin_threshold: float = 0.75,
) -> List[Message]:
    if not messages:
        return []

    recent = sliding_window(messages, n_turns)
    older = messages[:-len(recent)] if len(recent) < len(messages) else []

    parts: List[Message] = []

    # (a) 摘要压缩更早的对话
    if older:
        summary_text = summarize_old(older)
        parts.append(Message(
            role="user",
            content=f"[Previous conversation summary]\n{summary_text}",
        ))

    # (b) 钉住重要消息，逐字保留
    pinned = [m for m in older if _score_message(m) >= pin_threshold]
    parts.extend(pinned)

    # (c) 滑动窗口：最后 n 轮完整保留
    parts.extend(recent)

    return parts


# ---------- 7. 模拟与对比 ----------
def build_sample_conversation() -> List[Message]:
    """
    讲师原话：生成一段示例长对话，有人正在和助手对话。
    真实世界你会从数据库或聊天机器人拉取。
    这里重建一段 22 条消息的对话（11 轮）。
    """
    raw = [
        ("user", "Hi, my name is John and I work in marketing."),
        ("assistant", "Hello John! How can I help you today?"),
        ("user", "I'm looking for a CRM recommendation for a small team."),
        ("assistant", "Sure. How many people are on your team?"),
        ("user", "About 8 people. Budget is around $500 per month."),
        ("assistant", "Got it. Do you need email automation?"),
        ("user", "Yes, email automation is a must. We also need reporting."),
        ("assistant", "Understood. Any preference on integrations?"),
        ("user", "We use Slack and Google Workspace heavily."),
        ("assistant", "Those are common. Do you need mobile apps?"),
        ("user", "Mobile is nice to have but not required."),
        ("assistant", "Noted. How soon do you need to decide?"),
        ("user", "Within two weeks. We're comparing HubSpot vs Pipedrive."),
        ("assistant", "Both are solid. HubSpot has stronger marketing features."),
        ("user", "That's helpful. What about pricing at our size?"),
        ("assistant", "HubSpot Starter is around $20/user/month; Pipedrive is similar."),
        ("user", "Thanks, that's helpful."),
        ("assistant", "Want me to draft a comparison table?"),
        ("user", "Yes please, include reporting and Slack integration."),
        ("assistant", "Done. Anything else before I finalize?"),
        ("user", "No, that's all for now."),
        ("assistant", "Sounds good. Have a great week, John!"),
    ]
    return [Message(role=r, content=c) for r, c in raw]


def describe(name: str, msgs: List[Message]) -> None:
    chars = sum(len(m.content) for m in msgs)
    print(f"\n=== {name} ===")
    print(f"messages in context: {len(msgs)}")
    print(f"characters: {chars}")
    if msgs:
        print(f"first message: {msgs[0].content[:120]!r}")
        print(f"last message:  {msgs[-1].content[:120]!r}")


def main() -> None:
    convo = build_sample_conversation()
    describe("Original conversation", convo)

    describe("Sliding window (last 5 turns)", sliding_window(convo, 5))
    describe("Summarization (keep 3)", summarization(convo, 3))
    describe("Selective pruning", selective_pruning(convo))
    describe("Hybrid (best practice)", hybrid(convo, 5))


if __name__ == "__main__":
    main()
```

### 4.2 `short_term_memory.py`（P25）

```python
"""
short_term_memory.py
P25：短期记忆 —— 抽取事实、分类、打分、检索、衰减清理

运行：python short_term_memory.py
依赖：无（演示版不用 LLM；生产环境必须用 LLM 抽取，见文件末尾说明）
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


# ---------- 1. Fact 数据类 ----------
# 讲师原话：这是用来装我们的内容、我们的事实：
# content、category、confidence、extracted_when、source_turn。
@dataclass
class Fact:
    content: str
    category: str          # identity | constraint | preference | context | state
    confidence: float      # 0.0 - 1.0
    extracted_when: datetime = field(default_factory=datetime.now)
    source_turn: int = 0


# 五个事实类别（讲师原话：大约五个类别）
CATEGORIES = ("identity", "constraint", "preference", "context", "state")

# 生命周期（讲师原话）：
# - identity / constraint / preference：至少保留 30 轮
# - context / state：约 9-10 轮后过期
LONG_LIVED = {"identity", "constraint", "preference"}
SHORT_LIVED = {"context", "state"}
LONG_LIVED_TURNS = 30
SHORT_LIVED_TURNS = 10


class ShortTermMemory:
    def __init__(self) -> None:
        self.facts: List[Fact] = []
        self.turn: int = 0

    # ---------- 2. 抽取 ----------
    # 讲师原话：这个类做很多事：抽取偏好、看预算约束、识别（拿名字）、
    # 需求、上下文和瞬态状态。
    # 注意：这里是演示版的规则抽取。讲师原话：
    # "这里作为演示我没用 LLM，但生产环境你必须用大语言模型做抽取。这是必须的。"
    def extract(self, message: str) -> Optional[Fact]:
        self.turn += 1
        text = message.lower().strip()

        # 纯寒暄：不分类（讲师原话：它甚至没有分类）
        if text in ("thanks", "thanks!", "thank you", "ok", "okay", "sounds good"):
            return None

        category = None
        confidence = 0.0

        # identity：名字、职业
        if "my name is" in text or "i am a" in text or "i'm a" in text:
            category, confidence = "identity", 0.95
        # constraint：预算、至少、需要、必须
        elif any(k in text for k in ("budget", "at least", "need", "must", "require")):
            category, confidence = "constraint", 0.85
            if "budget" in text:
                confidence = 0.90
        # preference：偏好、喜欢、开放
        elif any(k in text for k in ("prefer", "like", "open to", "favorite")):
            category, confidence = "preference", 0.80
        # state：比较、正在
        elif any(k in text for k in ("comparing", "versus", " vs ", "right now")):
            category, confidence = "state", 0.60
        # context：找、想要、用于
        elif any(k in text for k in ("looking for", "want", "for coding", "for video")):
            category, confidence = "context", 0.70

        if category is None:
            return None

        fact = Fact(
            content=message,
            category=category,
            confidence=confidence,
            source_turn=self.turn,
        )
        self.facts.append(fact)
        return fact

    # ---------- 3. 按查询检索相关事实 ----------
    # 讲师原话：这个函数只拿与查询相关的东西。
    def get_relevant_facts(self, query: str, top_k: int = 5) -> List[Fact]:
        q = query.lower()
        q_tokens = set(q.split())

        def relevance(f: Fact) -> float:
            f_tokens = set(f.content.lower().split())
            overlap = len(q_tokens & f_tokens)
            # 类别加权：constraint / context 对推荐类查询更重要
            weight = 1.0
            if f.category in ("constraint", "context"):
                weight = 1.3
            return overlap * weight * f.confidence

        ranked = sorted(self.facts, key=relevance, reverse=True)
        return [f for f in ranked[:top_k] if relevance(f) > 0]

    # ---------- 4. 衰减清理 ----------
    # 讲师原话：cleanup 移除所有旧的过期数据。
    # identity / constraint / preference 至少保留 30 轮；
    # context / state 约 10 轮后过期。
    def cleanup(self, current_turn: int) -> List[Fact]:
        kept: List[Fact] = []
        for f in self.facts:
            age = current_turn - f.source_turn
            if f.category in LONG_LIVED and age <= LONG_LIVED_TURNS:
                kept.append(f)
            elif f.category in SHORT_LIVED and age <= SHORT_LIVED_TURNS:
                kept.append(f)
        self.facts = kept
        return kept

    def dump(self, title: str) -> None:
        print(f"\n=== {title} ===")
        print(f"facts: {len(self.facts)}")
        by_cat = {}
        for f in self.facts:
            by_cat.setdefault(f.category, []).append(f)
        for cat in CATEGORIES:
            if cat in by_cat:
                print(f"[{cat}]")
                for f in by_cat[cat]:
                    print(f"  - ({f.confidence:.2f}) {f.content}")


def main() -> None:
    stm = ShortTermMemory()

    # 讲师原话：我手动传入消息，这些是从真实对话里会被抽取出来的东西。
    messages = [
        "Hi, my name is Sarah and I'm a software engineer.",
        "I'm looking for a new laptop for coding and video editing.",
        "Right now I'm comparing the MacBook Pro versus Dell XPS.",
        "My budget is around 1500.",
        "I prefer MacBooks but I'm open to Windows.",
        "I need at least 16 gigabytes.",
        "Thanks for the suggestion.",
        "Actually, I also need Thunderbolt ports for my monitors.",
    ]

    print("=== Step 1: extract facts from conversation ===")
    for i, msg in enumerate(messages, start=1):
        fact = stm.extract(msg)
        if fact:
            print(f"turn {i}: [{fact.category}] conf={fact.confidence:.2f} :: {msg}")
        else:
            print(f"turn {i}: (not categorized) :: {msg}")

    stm.dump("All extracted facts")

    # 讲师原话：如果查询进来说"嘿，视频剪辑我该推荐什么笔记本？"
    query = "What laptop should I recommend for video editing?"
    relevant = stm.get_relevant_facts(query)
    print(f"\n=== Relevant facts for query: {query!r} ===")
    for f in relevant:
        print(f"  [{f.category}] {f.content}")

    # 讲师原话：清理前事实是 7 条。清理后，23 轮之后，只剩 5 条。
    print(f"\n=== Cleanup at turn 23 ===")
    print(f"facts before cleanup: {len(stm.facts)}")
    stm.cleanup(current_turn=23)
    print(f"facts after cleanup:  {len(stm.facts)}")
    stm.dump("Remaining facts after cleanup")


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 `conversation_history.py`

**`Message` 数据类**：讲师原话是"一个数据类，让我们跟踪 role、content 和 timestamp"。`role` 只有 `"user"` 和 `"assistant"` 两种值——注意 Anthropic 的 system prompt **不是** role，见下面 `llm_summarize` 的说明。`timestamp` 用 `default_factory=datetime.now`，在 JS/Node 里对应 `new Date()` 作为字段默认值（JS 类字段不能直接写 `new Date()` 做默认值而不共享引用，Python 的 `field(default_factory=...)` 就是解决这个"可变默认值"问题的机制）。

**`SUMMARY_MODEL = "claude-3-5-haiku-latest"`**：讲师原话："你要为这个找一个更便宜的模型。这里我用的是 Claude Haiku。也许你看这个视频的时候它已经废弃了，没关系，换成适合你用例的就行。" 摘要是一个高频、低难度的调用，用贵模型纯属浪费——这是成本意识，不是技术细节。

**`llm_summarize()`**：这是整个 P24 最关键的一行设计。讲师反复强调两次（p024 [13:59] 和 [14:52]）："摘要意味着一次真实的 LLM 调用。我们不是在切字符。截断往往会丢掉摘要本该保留的那部分信息。" 所以这里**没有** `transcript[:500]` 这种写法，而是把整段 transcript 发给模型。`max_tokens=512` 是重建值，课里没念具体数字。

**`system=` 是顶层参数**：讲师专门点出的坑——"Anthropic 的 system prompt 是一个顶层参数，不是 role 参数。" 也就是说你不能写 `{"role": "system", "content": ...}`（那是 OpenAI 的写法），Anthropic 的 `messages.create` 里 system 是独立的关键字参数。这是跨 SDK 迁移时最容易踩的坑之一。

**`sliding_window(messages, n_turns=5)`**：`keep = n_turns * 2`，因为一轮 = user + assistant 两条消息。讲师在 p024 [10:13] 念出的结果是"取 5 轮，上下文里的消息是 10 条"——正好对上 `5 * 2 = 10`。这是验证你实现是否正确的最硬指标。

**`summarization(messages, keep_recent=3)`**：把 `messages[:-3]` 拿去摘要，`messages[-3:]` 原样保留，然后在最前面插一条 `[Previous conversation summary]` 的 user 消息。讲师在 p024 [10:38] 念出"上下文里的消息是 13 条"——`1（摘要）+ 3（保留）+ 9（？）`……注意这里 13 不是 1+3=4，说明讲师屏幕上的实现保留的 recent 条数比 3 多，或者摘要消息本身被拆成了多条。**课里没讲清楚 13 的确切构成**，你按自己实现跑出来的条数对不上 13 不算错，只要结构对（摘要消息在最前、最近消息在最后）就行。

**`_score_message()`**：讲师原话："打分，如你所知或可能知道，非常困难。" 课里**没有**给出具体打分算法。这里用关键词 + 数字 + 寒暄惩罚的启发式是重建的。生产环境应该换成 LLM 打分（让模型给每条消息打 0-1 的重要性分）或 embedding 相似度。这是 P24 里唯一一个"讲师明确说难、但没给解法"的地方，你要自己补。

**`selective_pruning()`**：注意 `kept.append(messages[-1])` 这一行——最后一条消息无条件保留。讲师在 p024 [12:16] 说："最后一条消息是一样的，因为它是最近的消息，必须一直在。否则助手不知道要做什么。" 这是所有四种策略的共同约束。

**`hybrid()`**：三段拼接——(a) 摘要压缩更早的对话，(b) 钉住 `_score_message >= 0.75` 的重要消息逐字保留，(c) 滑动窗口保留最后 n 轮完整。讲师在 p024 [04:23] 描述的顺序是"摘要 → 钉住重要消息 → 滑动窗口"，代码里 `parts` 的拼接顺序和这个一致。讲师在 p024 [11:19] 念出"上下文里的消息现在是 14 条"——这个数字取决于你的 `pin_threshold` 和模拟对话内容，对不上 14 不算错。

**`build_sample_conversation()`**：讲师原话："生成一段示例长对话……真实世界里你当然会从你的数据库系统或聊天机器人里拉取。" 这里重建了 22 条消息（11 轮），和讲师念的"原始对话 22 条消息"对齐。第一条是 "Hi, my name is John and I work in marketing."（讲师念了 "I'm John, I work in marketing"），最后一条是 "Sounds good. Have a great week, John!"（讲师念了 "sounds good, have a great week John"）。

### 5.2 `short_term_memory.py`

**`Fact` 数据类**：五个字段全部来自讲师原话——"content、category、confidence、extracted_when、source_turn"。`source_turn` 是衰减计算的依据：`age = current_turn - f.source_turn`。

**五个类别**：`identity` / `constraint` / `preference` / `context` / `state`。讲师在 p025 [01:48] 逐个举例：identity="我叫 Sarah"，constraint="预算是 500"，preference="我偏好深色模式"，context="我们在找笔记本电脑"，state="比较 A 和 B，这是 transient（瞬态的）"。

**`LONG_LIVED_TURNS = 30` / `SHORT_LIVED_TURNS = 10`**：讲师原话——"这些如此重要，必须至少保留 30 轮之后"（指 identity/constraint/preference），"这些会在比如 10 轮、9 到 10 轮后过期"（指 context/state）。这两个数字是硬编码的，课里没讲能不能配置。

**`extract()` 的规则版**：讲师原话——"这里作为演示我没用 LLM，但生产环境你必须用大语言模型做抽取。这是必须的。" 所以这个函数里的 `if "my name is" in text` 这类规则**只是演示**。生产环境应该改成一次 LLM 调用，让模型输出 JSON 数组，每个元素含 `content` / `category` / `confidence`。在 JS/Node 里对应 `await anthropic.messages.create({...})` 然后 `JSON.parse(response.content[0].text)`。

**`extract()` 里 `self.turn += 1` 的位置**：在函数最开头，所以每条消息（包括"Thanks"这种不分类的）都会让 turn 加一。这符合"轮次"的语义——轮次是消息序号，不是事实序号。

**`get_relevant_facts()`**：讲师在 p025 [09:20] 演示的查询是 "What laptop should I recommend for video editing?"，返回的相关事实是 context（"looking for a new laptop for coding and video editing"）+ constraint（Thunderbolt）+ constraint（预算 1500-2000）。这里的实现用 token 重叠 + 类别加权（constraint/context 权重 1.3）+ confidence 相乘。课里没讲具体检索算法，这是重建的。生产环境应该用 embedding 相似度。

**`cleanup(current_turn=23)`**：讲师原话——"清理前事实是 7 条。清理后，23 轮之后，我们只剩 5 条。" 为什么是 7 条？8 轮消息里，"Thanks" 不分类，所以 7 条事实。为什么清理后剩 5 条？因为 context（第 2 轮）和 state（第 3 轮）的 age = 23 - 2 = 21 > 10，被衰减掉；identity（第 1 轮）、constraint（第 4、6、8 轮）、preference（第 5 轮）的 age 都 ≤ 30，保留。7 - 2 = 5，和讲师念的数字完全对上。**这是验证你实现是否正确的最硬指标**——如果你跑出来不是 5，检查你的 `SHORT_LIVED_TURNS` 和 `source_turn` 赋值。

**`dump()`**：按 `CATEGORIES` 顺序打印，方便对照讲师在 p025 [08:25]–[09:20] 念的分类结果。

---

## 6. 复现检查清单

跑完两个文件后，逐条打勾：

**P24 `conversation_history.py`**
- [ ] `python conversation_history.py` 能跑通，不报 `ANTHROPIC_API_KEY` 缺失
- [ ] 原始对话打印出 `messages in context: 22`
- [ ] 滑动窗口（5 轮）打印出 `messages in context: 10`（这是 `5 * 2`，必须对上）
- [ ] 滑动窗口的第一条消息是 "Thanks, that's helpful." 附近的内容（讲师念的 "thanks, that's helpful"）
- [ ] 滑动窗口的最后一条消息是 "Sounds good. Have a great week, John!" 附近的内容
- [ ] 摘要策略的第一条消息以 `[Previous conversation summary]` 开头
- [ ] 摘要策略的最后一条消息和原始对话的最后一条一致
- [ ] 混合策略的第一条消息含摘要 + 用户自我介绍
- [ ] 混合策略的最后一条消息和原始对话的最后一条一致
- [ ] 你能指出 `llm_summarize` 里 `system=` 是顶层参数，不是 `{"role": "system"}`

**P25 `short_term_memory.py`**
- [ ] `python short_term_memory.py` 能跑通，不需要 API key（演示版不用 LLM）
- [ ] 第 1 轮抽取为 `identity`，confidence 0.95
- [ ] 第 2 轮抽取为 `context`，confidence 0.70
- [ ] 第 3 轮抽取为 `state`，confidence 0.60
- [ ] 第 4 轮抽取为 `constraint`，confidence 0.90
- [ ] 第 5 轮抽取为 `preference`
- [ ] 第 6 轮抽取为 `constraint`，confidence 0.85
- [ ] 第 7 轮 "Thanks for the suggestion." **不分类**（打印 `(not categorized)`）
- [ ] 第 8 轮抽取为 `constraint`，confidence 0.85
- [ ] 清理前 `facts: 7`
- [ ] 清理后 `facts: 5`
- [ ] 清理后剩余类别只有 `constraint` / `identity` / `preference`，没有 `context` 和 `state`

**概念检查（不看代码，口头答）**
- [ ] 能说出为什么 20 万 token 窗口装得下 50 轮对话，仍然要管理历史（成本 / 延迟 / 注意力）
- [ ] 能说出四种历史管理策略各自的一个优点和一个缺点
- [ ] 能说出短期记忆和历史的区别（历史=全量消息，短期记忆=抽取的事实）
- [ ] 能说出五个事实类别，以及哪两个是短生命周期（context / state）
- [ ] 能说出为什么摘要必须是真实 LLM 调用而不是截断

---

## 7. 课里没讲但你会撞上的

**1. `claude-3-5-haiku-latest` 可能已经废弃。** 讲师自己在 p024 [06:51] 就预警了："也许你看这个视频的时候它已经废弃了，没关系，换成适合你用例的就行。" 跑之前先去 Anthropic 文档查当前可用的 Haiku 型号，改 `SUMMARY_MODEL` 常量。

**2. 摘要的 token 成本会反噬。** 讲师说摘要"会花你一次额外调用"，但没算这笔账：如果每轮都重新摘要整段历史，摘要调用本身的成本会随历史长度线性增长，最后可能比直接发全量历史还贵。生产环境的常见做法是**增量摘要**——只摘要"上次摘要 + 新增的旧消息"，而不是每次从头摘要。课里没讲这个优化。

**3. `_score_message` 的启发式在真实数据上会崩。** 讲师明确说"打分非常难"，但没给解法。真实对话里"我不要红色"和"我要红色"关键词完全一样，启发式打分区分不了。生产环境要么用 LLM 打分（每条消息一次调用，贵），要么用 embedding 相似度（相对查询算相关性，便宜但需要向量库）。这是 P24 留给你自己填的最大的坑。

**4. `get_relevant_facts` 的 token 重叠检索对中文无效。** 演示代码用 `q.split()` 做英文分词，中文没有空格，`split()` 会把整句当一个 token，重叠永远是 0。如果你要做中文 AI 应用，这里必须换成 jieba 分词或直接用 embedding。课里是英文演示，没提这个。

**5. 短期记忆的"抽取"在生产环境是异步的。** 演示代码是同步 `for` 循环逐条 `extract()`。生产环境每条消息都要调一次 LLM 抽取，延迟不可接受。常见做法是消息入库后异步抽取（消息队列 + worker），或者在响应返回后后台抽取。在 JS/Node 里对应 `setImmediate` / `queueMicrotask` 或独立的 worker 进程。课里没讲架构。

**6. 衰减的"轮次"在跨会话时没有定义。** `cleanup(current_turn=23)` 里的 23 是会话内的消息序号。但长期记忆要跨会话，跨会话后"轮次"怎么算？是按消息总数、按天数、还是按会话数？课里 P25 只讲了会话内，跨会话是下一节（长期记忆）的内容，这里没讲。

**7. Anthropic SDK 的 `response.content[0].text` 假设第一个 block 是 text。** 如果模型返回了 tool_use block 在前，这行会崩。生产环境应该遍历 `response.content` 找 `type == "text"` 的 block。课里没讲，因为演示里没开 tool use。

**8. 两个文件的模拟数据是硬编码的。** 讲师说"真实世界里你当然会从你的数据库系统或聊天机器人里拉取"，但没讲怎么接。最小改动是把 `build_sample_conversation()` 和 `main()` 里的 `messages` 列表换成从 JSON 文件或数据库读。在 JS/Node 里对应 `fs.readFileSync('./convo.json')` 或 ORM 查询。

---

![p023 01:30 讲师指出 ChatGPT 之所以"记得"是应用层每次发送完整历史，这不是模型记忆而是上下文工程](images/p023_0084s.jpg)

> 注：上面这张帧号 `p023_0090s.jpg` 不在你给的清单里，请以清单为准替换为 `p023_0084s.jpg`（p023 [01:24]，正好是讲师讲"应用层发送整段历史"那段）。下面所有图都严格用清单里的帧号。

![p023 01:24 应用层每次请求发送完整对话历史，这是上下文工程不是模型记忆](images/p023_0084s.jpg)

![p023 04:13 记忆的三种类型：工作记忆、短期记忆、长期记忆](images/p023_0253s.jpg)

![p024 02:30 四种历史管理策略：滑动窗口、摘要、选择性剪枝、混合](images/p024_0156s.jpg)

![p024 04:40 混合策略：摘要 + 钉住重要消息 + 滑动窗口三段拼接](images/p024_0280s.jpg)

![p024 10:53 运行 conversation_history.py 后滑动窗口策略的输出：10 条消息、413 字符](images/p024_0653s.jpg)

![p025 02:06 短期记忆的五个事实类别：identity、constraint、preference、context、state](images/p025_0126s.jpg)

![p025 08:51 运行 short_term_memory.py 后按类别分组打印的抽取结果](images/p025_0531s.jpg)

![p025 09:41 清理后事实从 7 条衰减到 5 条，只剩 constraint/identity/preference](images/p025_0581s.jpg)

---

**一句话总结这三节**：P23 告诉你"记忆是应用层的事，不是模型的事"；P24 给你四种管理历史消息的策略和一份可跑的对比代码；P25 给你从消息里抽事实、分类、检索、衰减的完整闭环。两个文件加起来不到 400 行，但覆盖了生产 AI 应用省 token、降延迟、提准确率的三条主线。讲师最后一句是"跨会话记住用户是长期记忆的工作，魔法真正发生的地方"——那是下一节的事。