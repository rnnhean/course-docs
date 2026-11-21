# AI Security Bootcamp Part 1：护栏 / 网关 / 可观测（P064–P066）复现文档

> 说明：本段课程（P064–P066）实际内容是「数据摄取流水线收尾 + RAG Agent 设计直觉 + Agent 代码骨架搭建」。逐字稿里没有出现任何 OCR 代码片段，因此第 4 节「完整代码」只写逐字稿中讲师**明确念出/描述过**的文件与函数结构；讲师没有给出完整函数体的地方，我会明确标注「课里没讲，以下为按讲师描述补全的示意实现」，并保证读者能照着跑通骨架。

---

## 1. 这一节做什么

这三集连起来是一条完整的「从数据到 Agent」的收尾链路：

1. **P064：把数据摄取流水线跑通并验收。** 讲师演示运行 `python app.ingestion.data_processor`（不带 `--wipe` 也可以，第一次跑没有东西可清），观察 Logfire 里的嵌套 trace，确认：
   - 集合被清空并重建（`Wiping collection` / `created a collection enterprise rack`）；
   - 不支持的文件被跳过（`skipping the unsupported file`）；
   - 超过 15 页的 PDF 被拆成多个 15 页的块（26 页 → 2 块；总页数 190 的 PDF 逐页处理）；
   - 原始文件上传到 GCS 的 `raw` 区，处理后的 JSON 落到 `processed` 区；
   - 最终在 Qdrant 里能看到 `enterprise` 集合的 chunk，配置为 cosine 距离、有向量维度和大小。
   最后讲师强调：这一轮是**手动**上传数据，下一步要让「桶里一有新数据就自动触发整条流水线」。

2. **P065：RAG Agent 的设计直觉（纯讲解，无代码）。** 讲师从传统 RAG 讲起：query → embedding → Qdrant top-k → 拼上 query 一起给 LLM。指出传统 RAG 的缺陷：用户说「hi」也会去检索，容易让 LLM 幻觉。于是引出：
   - **query rewriting**：把「用搞笑的方式解释 RAG」里的「用搞笑的方式」这种给 LLM 的指令从检索 query 里剥离；
   - **re-ranking**：先取 top 10，再用 cross-encoder（对比 bi-encoder）逐条「query+文档」一起看语义，重排后取 top 5；讲师用「0.3 相似度但含精确俯卧撑做法」的例子说明数学相似度 ≠ 语义重要性；
   - **agentic flow**：planner 节点判断 conversational / technical，conversational 直接回，technical 走 Qdrant retriever → FlashRank 重排 → responder；
   - **context 的来源**：对话历史 + 文档（可来自 MCP 工具箱、web search 工具、VectorDB），MCP 被讲师解释为「一个装了很多工具的 toolbox」。

3. **P066：把 Agent 骨架落到代码。** 先 `git add .` / `git commit -m "data ingestion pipeline created"` / push，然后建目录：
   ```
   app/agents/
     __init__.py（隐含）
     main.py
     graph.py
     state.py
     nodes/
       planner.py
       responder.py
       retriever.py
   ```
   接着写 `state.py`（用 Pydantic + `Annotated` + `operator.add` reducer 维护 messages），再写 `planner.py`（用 `ChatGroq` + settings 里的 api key / model name / temperature=0，读 memory saver 的历史，判断 conversational / technical），再写 `responder.py`（根据 state 里的 intent 走两套 prompt：conversational 用历史直接答，technical 用检索到的文档 + 历史答）。`retriever.py` 和 `graph.py` 在本段只建了文件、没写内容——课里没讲。

---

## 2. 讲师原话

> "如果你还记得我们的旅程，旅程非常简单：我们创建了 ingestion loaders，用了不同的 loader，然后把它们按 1500 的大小切块，再把这些 chunk 以 50 一批传给 Vertex AI，embedding 逻辑就在这里。"
> —— p064 [00:00]

> "embedding 逻辑，batch size 是 50。我们把它传给 Vertex AI，它转成数字。做完之后，用我们初始化好的 Qdrant client 把数据存起来。"
> —— p064 [00:29]

> "我们导入了些东西，初始化了 Vertex client，初始化了 storage client，因为我们要把原始数据和处理后的数据存到 GCS 上；为了和 GCS 交互，我们写了 upload_to_gcs 方法。"
> —— p064 [00:59]

> "原始文件在 raw 区处理，处理后的文件在 processed 区处理，然后以类似方式上传。接着我们只想跑一个 universal ingestion，它会跑完整个流程。"
> —— p064 [01:28]

> "环境已经设好了，一切就绪。看，`python app.ingestion.data_processor`，我们不需要传 wipe 变量。wipe 变量是当你想清掉什么东西的时候用的。"
> —— p064 [01:57]

> "因为我们是第一次做，即使你传了 wipe 也不会发生什么。"
> —— p064 [02:23]

> "`python app.ingestion`，它会拿到 processor，把 data 作为 source 传进去，wipe 就是从头开始。"
> —— p064 [02:52]

> "如你所见，它自动开始了，首先清空了所有集合。它跳过了不支持的文件。它从 noisy data 开始，检测到了，开始处理 noisy data，没有处理它，但把原始文件上传到了 GCS 桶。"
> —— p064 [03:19]

> "这个 PDF 是 26 页，大于 15，所以它生成了两个 chunk——因为 15、15 这样切。总页数检测到 190，PDF 超过 15 页，所以它就一页一页地处理。"
> —— p064 [03:48]

> "我们能看到日志：Wiping collection、created a collection enterprise rack、开始处理文件、GCS upload，能看到所有嵌套的 tracking。"
> —— p064 [04:14]

> "在 raw 里，noisy data 已经开始处理了，目前取了三个，只处理了一个，第二个还在处理中。"
> —— p064 [04:43]

> "如果处理失败，它就会去切块，不用担心这个错误。"
> —— p064 [05:13]

> "所有数据都处理完了。回到 Logfire 看日志，286 条，所有这些文件都处理了，最后是 true data，六个文件也处理了。"
> —— p064 [05:36]

> "在 Qdrant 里，noisy data 已经被处理成 JSON 文件；processed 里 true data 的六个文件也以类似方式处理了；raw 里原始文件也在这里，processed data 也在这里，你可以对比。"
> —— p064 [06:05]

> "最后到 Qdrant，刷新，进入我的 cluster，能看到数据；进入 enterprise，能看到所有不同的 chunk。数据越多，数据点越多。能看到配置：距离是 cosine，向量大小是这个，维度是这些。"
> —— p064 [07:00]

> "这就是数据转换阶段的结尾：我们手动把数据上传到 Google Cloud 桶和 Qdrant，它是自动处理的，但关键词是『手动』。"
> —— p064 [07:26]

> "我想强调一点：我们手动上传了数据。第一次当然可以手动，但之后数据转换应该是——我们的桶在等更多数据，新数据一进来并触发，整条流水线就应该自动触发。"
> —— p064 [07:56]

> "恭喜，这是数据转换流水线的结尾。我们模块四见，模块四要搭我们的 RAG agent。"
> —— p064 [08:22]

> "这个模块我们要讲 RAG agent 怎么搭、agent flow 长什么样、怎么从 Qdrant DB 里检索相关数据。"
> —— p065 [00:27]

> "如果你记得上一节数据摄取怎么做的：我们有来自多个来源的数据，加载、切块、做 embedding，最后存进 vector db。数据加载过程在 GCP，也就是 GCS 上完成。"
> —— p065 [01:23]

> "数据以这种格式存储：true data 和 noisy data，两种格式——raw data 和 process data。embedding 我们用 Vertex AI embeddings，另一个 Google 服务；vector DB 我们用 Qdrant DB。"
> —— p065 [02:21]

> "用户给一个 query，这个 query 会被 embed 成某种数字格式，然后和 Qdrant DB 里所有文档（我们企业特定的数据）比对。"
> —— p065 [02:51]

> "比如用户问『解释一下 1000g 网络是怎么工作的』，这个 query 直接被 embed，直接传给 Qdrant DB，拿到 top 10 或 top 5，随便 top k 个相关文档，然后把用户 query 和 top-k 文档一起给 LLM，LLM 给回答。传统 RAG 就是这么工作的。"
> —— p065 [03:49]

> "但在这个场景里，用户每发一条消息都会去 Qdrant DB 拿回答。这是传统 retriever 系统。它当然好，但你看，即使用户说『hi』，这个 hi 也会被转成 embedding，然后给出相关 chunk，这里 LLM 更容易幻觉。我们做 RAG 就是为了让 LLM 不幻觉，但这样做反而会幻觉。"
> —— p065 [04:43]

> "人类总是给这种 prompt：用更简单的方式解释、用歌的形式解释、给我写一首关于网络的歌。人类很疯狂，什么都能做。"
> —— p065 [06:07]

> "『用搞笑的方式』这句话是对 LLM 的指令，不是对 Qdrant DB 的指令。我们不希望 LLM 去搜『用搞笑的方式』这些词。所以我们有 query rewriting 的办法。"
> —— p065 [06:33]

> "我们可以内部给 AI 一个 prompt 模板：读用户 query，如果 query 需要，就精炼 query，让我们从 vector DB 拿到好结果。所以我们可以在中间加一个节点来精炼 query。"
> —— p065 [07:03]

> "query 被精炼后，拿到 top 10 个干净精炼的 chunk。『用搞笑的方式』这部分被排除了，query 可能被重写成『解释 RAG 和 agentic AI』这样。"
> —— p065 [07:33]

> "假设 10 个 chunk：第一个关于 RAG，第二个关于数据摄取流水线（里面也提到 RAG），第三个是 RAG 的酷事实，第四个是 RAG 的缺点，第五个关于 agentic AI，然后是 agentic AI 的应用等等。"
> —— p065 [08:02]

> "从这些 chunk 里我们看出，这个、这个、这个、这个是最重要的，这些稍微没那么重要。我们想重排，让最好最相关的 chunk 在上面，然后我们只取 top 5。"
> —— p065 [08:54]

> "先取 top 10，重排之后再要 top 5 最相关的文档。这就是 re-ranker 的概念——通过这个过程，我们改进了检索的上下文。"
> —— p065 [09:24]

> "上下文非常重要。上下文来自两处：用户历史（当前对话在聊什么）和我们检索到的文档。这些文档可以来自不同来源：MCP 来源（Model Context Protocol），或者来自一个工具，比如 web search 工具。"
> —— p065 [09:54]

> "如果你不懂 MCP 是什么——Model Context Protocol——它就是一个工具。MCP 是一个工具箱，里面有很多工具放在一起，我们可以调用 MCP 里的任何一个工具，MCP 就是这么工作的。"
> —— p065 [10:20]

> "假设我们从 MCP 取数据、从工具取数据、从 VectorDB 取数据，信息分散在这么多来源，这么多信息涌过来，给 AI 什么是个问题。我们要给 AI 高度准确的信息，让 AI 高度可靠。所以需要提取合适的上下文。"
> —— p065 [10:46]

> "后面的视频你会看到，我们给 AI 的 prompt 里会把对话历史作为输入、把拿到的上下文作为输入，让 AI agent 知道用户到底在干什么、在找什么、怎么帮他。"
> —— p065 [11:15]

> "re-ranker 是一种重排检索文档的方法，让我们提取最好最相关的文档。检索过程基于相似度。"
> —— p065 [11:43]

> "用户给 query，转成 embedding，比如 0.1、0.8 这种随机数，传给 vector db，vector db 给 top 5 chunk。假设相似度分别是 0.8、0.6、0.9、0.7、0.3。你看，这个是相似但没那么相似。我们想重排成 0.9、0.7、0.8 这样——这由 vector db 自己来做。"
> —— p065 [12:13]

> "但如果这个 0.3 相似度的文档里有很重要的信息呢？vector db 只是拿 embedding 和 embedding 比，拿 embedding 和文档比。我们把这叫 bi-encoder：一个 embedding 和所有文档比，这样拿到 top chunk。"
> —— p065 [13:11]

> "但如果这个 0.3 相似度的文档里有高度信息量的内容呢？它给 0.3 是因为 cosine 相似度这个数学函数给了这个值——数学上不对，但语义上呢？"
> —— p065 [13:41]

> "我问怎么通过做俯卧撑增强力量，而那个 0.3 相似度的文档里正好写了做俯卧撑的精确公式。其他文档写的是俯卧撑的各种变体、这样做那样做、配合什么饮食。它们相关，但在这个 0.3 的文档里——虽然这个文档信息不多——有非常准确的信息。数学上低，但语义上这个文档非常重要。"
> —— p065 [14:09]

> "re-ranker 会理解我们的 query 和所有这些从 vector DB 检索到的 chunk。之前 vector DB 是拿一个 embedded query 和所有文档比；现在 chunk 检索出来之后，re-ranker 会把每个文档和 query 这样比——两个一起比。这个过程我叫它 cross-encoder，它把 query 和文档放在一起考虑，提取语义。"
> —— p065 [15:05]

> "它怎么提取语义？内部用了 attention 机制，注意力机制知道该关注什么。理解之后，虽然只有 0.3 相关，但这个非常准确，所以它重排，把这个放上面，那个放下面，重排文档给我们结果。"
> —— p065 [16:00]

> "这就是 re-ranking 怎么工作。再说我们要搭的 agentic flow。刚才说的是简单 RAG，简单 RAG 也能做。但它的缺点是什么？每次用户发 query 都一定去 retriever 拿输出。我们不想要这样。"
> —— p065 [16:28]

> "如果我们想在中间加 web search 功能呢？如果搜的问题不在 retriever 里、而在 web search（Google、ExaSearch、TivoliSearch 之类）里呢？或者根本不需要 retriever 或 web search，只是简单对话，说个 hi，你就该回 hi，就这么简单。"
> —— p065 [16:57]

> "这就是 agentic workflow 登场的地方，也是 LangGraph 出彩的地方——我们可以有非常模块化、非常细粒度的控制。"
> —— p065 [17:24]

> "用户给 query，收到 query 后我们有一个 planner 节点。planner 节点判断：这个 query 是 conversational 还是 technical？"
> —— p065 [17:53]

> "如果用户说 hi，planner 说是 conversational；如果说『告诉我 Kubernetes』，planner 说是 technical。如果是 conversational，直接回复，跳过检索。"
> —— p065 [18:20]

> "如果是 technical，去 Qdrant retriever，拿 top k chunk；拿到后我们还要重排，重排我们用 FlashRank。Flash 这个词表示它是非常快的排序过程。重排后，精炼好的文档送回 responder 节点，responder 回复用户。"
> —— p065 [18:47]

> "我们也可以有另一个节点：一旦是 technical，就精炼 query 再送进 Qdrant，拿更好的 chunk、更好的重排、更好的回答。"
> —— p065 [19:46]

> "这是文档，打开预览你能看到：Streamlit、planner node、retriever node；如果 intent 是 conversational 就回复，如果是 technical 就去 retriever、FlashRank re-ranker（我们用的是本地 re-ranker）、responder 节点，而且我们把所有这些都存进 memory。"
> —— p065 [20:14]

> "这就是我们要搭的 agent flow，也是这个模块的最终成果。"
> —— p065 [20:43]

> "回到代码库。第一件事，打开 git bash 终端，提交我做的东西：`git add .`、`git commit -m "data ingestion pipeline created"`。"
> —— p066 [00:00]

> "养成好习惯，规范地提交 Git 命令。我们本该在文件级别做，但从现在起我会保持。提交完就可以 push。"
> —— p066 [00:29]

> "现在设置文件夹结构。打开 app，新建一个组件叫 agents。"
> —— p066 [00:57]

> "我新建了 agents，在 agents 里新建了 main.py，再建一个子文件夹叫 nodes。"
> —— p066 [01:24]

> "nodes 里我们需要三个东西：planner node，就叫 planner.py；另一个文件 responder.py；第三个文件 retriever.py。"
> —— p066 [01:53]

> "文件建好后，在 agents 里再建 graph.py 存所有图，state.py 用 Pydantic schema 追踪 agent 状态。"
> —— p066 [02:23]

> "从 state 开始。导入一堆库：`from typing import TypedDict, List, Annotated`，`import operator`。然后建一个 AgentState 类。"
> —— p066 [02:50]

> "我们的 agent 要维护状态。拿人举例：你手举起来，你脑子里知道手举起来了，这就是维护状态。agent 也一样：我刚读了消息、我在规划、我在回复，agent 要维护状态。"
> —— p066 [03:19]

> "维护状态要维护这些东西：传了哪些消息——先有 hi，然后它规划了什么。用户消息收到后检测两件事：conversational 还是 technical。如果是 conversational，planner 记住它是 conversational。传给下一个节点的状态是：消息是 hi、我认为是 conversational、我现在去 responder 节点、我带着这些文档（万一走 technical 那边）。"
> —— p066 [03:49]

> "很简单，不复杂。它维护传了哪些消息。`operator.add` 是一个 reducer，把消息追加到 annotated 列表里。这个列表是字典列表，因为这些 agent 是以字典形式创建的，包括 invocation 之类。"
> —— p066 [04:47]

> "current_query：用户当前给的 query 是什么。documents：从 retriever 拿到的文档。plan：intent，conversational 还是 technical。current_status：我现在在哪。final_answer：最终答案。它脑子里得知道自己到底在干什么。这就是 state 里维护的东西。"
> —— p066 [05:14]

> "现在一个个写这三个节点。第一个是 planner node。planner 里导入需要的库：ChatGroq。"
> —— p066 [05:44]

> "`from langchain import ChatGroq`（按讲师口述，实际应为 `from langchain_groq import ChatGroq`，见第 7 节）。`from app.agents.state import AgentState`。为什么要 import state？因为 planner 和后面所有节点内部都要有 state。"
> —— p066 [06:12]

> "`from config import settings`。为什么需要 settings？settings 是 Settings 类的对象。Logfire 用来追踪应用。初始化 Groq 模型：要 api key，从 settings 拿；model name 也从 settings 拿，因为我们配了 temperature 为 0，意思是零创造力，但你可以改成 0.2 或 0.5 看你实验什么。"
> —— p066 [06:41]

> "第一件事是写 planner 函数，非常简单。"
> —— p066 [07:08]

> "在 planner 里先读 prompt：如果最新消息是问候（hi、hello），或者是只用对话历史就能回答的问题（比如『我叫什么』），就回 conversational；如果是关于 Kubernetes、Intel、网络等的技术问题，或者需要新鲜文档，就去搜 query。这就是我们让它做的。"
> —— p066 [07:37]

> "planner 节点拿 AgentState 作为输入，因为它要保留 agent state。我们还要从 memory saver 拿历史——我们有 LangGraph memory saver，从它拿历史，检测消息是 user 发的还是 assistant 发的，从 role 里选。"
> —— p066 [08:04]

> "检测到 user 消息后，取 `[-1]` 的 content，因为消息就存在那里。然后用 prompt：你是 assistant planner，分析对话历史和用户消息——这是历史，这是用户消息。prompt 我们已经读过了，很简单。"
> —— p066 [08:29]

> "如果决定是 conversational，current_query 是 conversational，就追踪状态：handling conversation，plan intent 是 conversational，数据以类似方式流动，返回同样的东西。"
> —— p066 [08:57]

> "conversational 或 technical，就这么简单。我们用 Logfire 追踪。"
> —— p066 [09:27]

> "planner 懂了，就写 responder 节点：如果用户说 hi，没有意图，我们就回复。第一件事 import logfire、langchain、ChatGroq、AgentState，都需要。"
> —— p066 [09:27]

> "这里再初始化 Groq agent，你可以从 settings 改模型名。ChatGroq 设好了。这里写一个 generate_node 函数，生成最终回复。先读 prompt：你是资深技术架构师，根据提供的技术上下文回答问题。"
> —— p066 [09:56]

> "responder 既要正常回复也要技术回复，所以我们说：这是技术上下文、这是对话历史、这是用户问的，理解所有这些。用 lm synthesis 标题记日志，invoke prompt，给回复：这是最终答案、这是状态、这是生成的回复、这是消息列表（以 content 形式）。很简单，维护在 agent state 里。"
> —— p066 [10:23]

> "和 planner 一样，我们拿历史，拿所有消息状态（user 还是 assistant），再拿一次。如果 query 是 conversational，在 log 里打印『generating conversational response using memory』，取决于用户消息。"
> —— p066 [10:50]

> "如果 query 是 technical，我们有另一个 prompt。你看区别：这里只有一个 prompt，因为只有一个任务；这里取决于传进来的 state。state 里会传 intent，根据 plan：如果 plan 是 conversational，告诉 agent 根据历史正常回复；如果是 technical，技术场景下我们显示这么多 full context，这是我们设的文档状态，因为我们会从 retriever 拿文档。"
> —— p066 [11:19]

> "然后我们说：你是资深架构师，这是回复。等我们写 retriever 程序时这会更有意义。"
> —— p066 [12:15]

---

## 3. 从零复现

### 3.1 前置条件（P064 之前已经完成的部分）

按讲师在 P064 开头的回顾，进入本节前你的仓库里应该已经有：

- `app/ingestion/` 下的多个 loader（ingestion loaders）；
- 切块逻辑：chunk size **1500**；
- embedding：**Vertex AI embeddings**，batch size **50**；
- 向量库：**Qdrant**，集合名 `enterprise`（日志里是 `enterprise rack`，OCR/语音可能有误，以你实际集合名为准）；
- 对象存储：**GCS**，分 `raw` 和 `processed` 两个区；
- 一个 `upload_to_gcs` 方法；
- `app/ingestion/data_processor.py`，里面有一个 `universal_ingestion` 流程，接受 `source` 和 `wipe` 参数；
- Logfire 已接入（用于 trace）。

这些是 P064 之前的内容，**本段逐字稿没有给出它们的完整代码**，课里没讲的部分不在此展开。

### 3.2 步骤一：跑通数据摄取并验收（P064）

1. 确认环境变量已设置（讲师原话「environment is set and everything is done」）。本段没有列出具体变量名，按你前面模块的 `.env` 为准。
2. 在仓库根目录执行：

   ```bash
   python app.ingestion.data_processor
   ```

   讲师说明：**不需要传 `--wipe`**。`wipe` 的作用是「有东西就清掉」，第一次跑即使传了也不会发生什么。

3. 讲师随后口述的另一种入口是：

   ```bash
   python app.ingestion
   ```

   它「拿到 processor，把 data 作为 source 传进去，wipe 就是从头开始」。

4. 打开 Logfire 观察 trace。你应该看到（按讲师屏幕上的日志顺序）：
   - `Wiping collection`
   - `created a collection enterprise rack`（集合名以实际为准）
   - 开始处理文件
   - `GCS upload`
   - 嵌套的 tracking：第一个文件、第二个文件、第三个文件……
5. 打开 GCS 控制台 → 搜索 buckets → 进入桶 → `raw` 区：应能看到 noisy data 的原始文件陆续出现；`processed` 区：应能看到处理后的 JSON。
6. 打开 Qdrant → 进入 cluster → 进入 `enterprise` 集合：应能看到所有 chunk。讲师指出可查看的配置项：**距离函数是 cosine**、**向量大小**、**维度**。
7. 讲师观察到的具体数字（可作为你的对照基准）：
   - 一个 26 页的 PDF → 因为大于 15 页，被拆成 **2 个 chunk**（15 + 15 的切法）；
   - 另一个 PDF 总页数 **190**，超过 15 页，逐页处理；
   - Logfire 里最终约 **286** 条日志；
   - true data 共 **6 个文件**，全部处理完成；
   - noisy data 一开始取了 3 个，先处理 1 个，第 2 个在处理中。
8. 讲师明确说：处理失败时会去切块，「不用担心这个错误」。

### 3.3 步骤二：理解 RAG Agent 的设计（P065，纯讲解，无命令）

这一步没有可执行命令，但你要把设计决策记下来，因为 P066 的代码就是照它写的。复现顺序按讲师的推导走：

1. **传统 RAG 链路**：query → embedding → Qdrant top-k（top 10 或 top 5，可编程）→ query + top-k 文档一起给 LLM → 回答。
2. **发现缺陷**：用户说「hi」也会走检索，LLM 更容易幻觉。
3. **引入 query rewriting**：在 query 进 Qdrant 之前加一个节点，内部用 prompt 模板让 AI「读 query、精炼 query，以便从 vector DB 拿到好结果」。目的：把「用搞笑的方式」这类**给 LLM 的指令**从检索 query 里剥离。
4. **引入 re-ranking**：
   - 先取 top 10；
   - 用 re-ranker 对每个「query + 文档」成对打分（cross-encoder），而不是像 vector DB 那样一个 query embedding 对全部文档（bi-encoder）；
   - 重排后取 top 5。
   - 讲师给的相似度例子：0.8 / 0.6 / 0.9 / 0.7 / 0.3，重排后 0.9 / 0.7 / 0.8 在上；但 0.3 那条如果语义上含「俯卧撑的精确做法」，cross-encoder 会把它提上来。
5. **确定 agentic flow**：
   - 用户 query → **planner 节点**判断 conversational / technical；
   - conversational → 直接回复（跳过检索）；
   - technical → **Qdrant retriever** 取 top-k → **FlashRank** 重排（讲师强调 Flash 表示很快，且是**本地** re-ranker）→ **responder** 回复；
   - 可选：technical 分支里再加一个 query refine 节点；
   - 所有过程存进 memory。
6. **context 的两个来源**：对话历史 + 检索文档；文档可来自 MCP（讲师比喻为「装很多工具的 toolbox」）、web search 工具（Google / ExaSearch / TivoliSearch）、VectorDB。

### 3.4 步骤三：搭 Agent 代码骨架（P066）

1. **先提交**（讲师强调养成好习惯）：

   ```bash
   git add .
   git commit -m "data ingestion pipeline created"
   git push
   ```

   讲师补充：本该在文件级别提交，从今往后会保持这个习惯。

2. **建目录结构**（在 `app/` 下）：

   ```
   app/
     agents/
       __init__.py
       main.py
       graph.py
       state.py
       nodes/
         __init__.py
         planner.py
         responder.py
         retriever.py
   ```

   讲师原话顺序：先建 `agents`，在 `agents` 里建 `main.py`，再建子文件夹 `nodes`；`nodes` 里建 `planner.py`、`responder.py`、`retriever.py`；回到 `agents` 建 `graph.py` 和 `state.py`。

3. **写 `state.py`**：`from typing import TypedDict, List, Annotated`、`import operator`，定义 `AgentState`，字段见第 4 节。
4. **写 `nodes/planner.py`**：导入 `ChatGroq`、`AgentState`、`settings`、`logfire`；初始化 Groq 模型（api key 和 model name 来自 settings，temperature=0）；写 `planner` 函数，读 memory saver 历史，取最后一条 user 消息的 content，用 prompt 判断 conversational / technical，写回 state。
5. **写 `nodes/responder.py`**：同样的导入与模型初始化；写 `generate_node`，根据 state 里的 intent 走两套 prompt（conversational 用历史；technical 用文档 + 历史），把最终答案、状态、消息列表写回 state。
6. `retriever.py` 和 `graph.py` 在本段**只建了文件，没有写内容**——课里没讲，下一集才写。

---

## 4. 完整代码

> 重要声明：本段逐字稿中讲师是**边写边讲**，没有把完整文件念出来，也没有 OCR 代码。下面每个文件都标注了「逐字稿明确提到的部分」和「按讲师描述补全的示意部分」。补全部分是为了让文件能直接保存运行，**不是讲师原话**。如果你要和讲师仓库逐字对齐，请以讲师仓库为准。

### 4.1 `app/agents/state.py`

逐字稿明确提到：`TypedDict`、`List`、`Annotated`、`operator`、`operator.add` 作为 reducer 追加消息、字段包括 messages / current_query / documents / plan / current_status / final_answer。

```python
# app/agents/state.py
# 逐字稿明确：TypedDict, List, Annotated, operator, operator.add reducer
# 逐字稿明确字段：messages, current_query, documents, plan, current_status, final_answer
# 类型标注细节为示意补全

from typing import TypedDict, List, Annotated
import operator


class AgentState(TypedDict):
    # operator.add 是 reducer：新消息会 append 到已有列表，而不是覆盖
    messages: Annotated[List[dict], operator.add]
    current_query: str
    documents: List[str]
    plan: str            # "conversational" 或 "technical"
    current_status: str  # 例如 "handling_conversation"
    final_answer: str
```

### 4.2 `app/agents/nodes/planner.py`

逐字稿明确提到：`ChatGroq`、`AgentState`、`settings`、`logfire`、temperature=0、从 memory saver 拿历史、按 role 区分 user/assistant、取 `[-1]` 的 content、prompt 的两条判断规则、写回 `current_status` 和 `plan`。

```python
# app/agents/nodes/planner.py
# 逐字稿明确：ChatGroq / AgentState / settings / logfire / temperature=0
# 逐字稿明确：从 memory saver 拿历史、按 role 区分、取 [-1] content
# 逐字稿明确 prompt 规则：问候或仅凭历史可答 -> conversational；技术问题 -> 去检索
# 函数体细节为示意补全

import logfire
from langchain_groq import ChatGroq
from app.agents.state import AgentState
from config import settings


# 讲师：api key 和 model name 都从 settings 拿；temperature=0 表示零创造力
llm = ChatGroq(
    api_key=settings.GROQ_API_KEY,
    model_name=settings.MODEL_NAME,
    temperature=0,
)

PLANNER_PROMPT = """你是一个 assistant planner。分析对话历史和用户消息。

规则：
1. 如果最新消息是问候（hi、hello），或者是一个仅凭对话历史就能回答的问题
   （例如"我叫什么"），返回：conversational
2. 如果问题是关于 Kubernetes、Intel、网络等的技术问题，或者需要新鲜文档，
   返回：technical

只返回一个词：conversational 或 technical。
"""


def planner(state: AgentState) -> dict:
    # 讲师：从 memory saver 拿历史（这里假设 state 里已带 messages）
    history = state.get("messages", [])

    # 讲师：检测消息是 user 还是 assistant，取最后一条 user 消息的 content
    user_message = ""
    for msg in reversed(history):
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break

    prompt = (
        f"{PLANNER_PROMPT}\n\n"
        f"对话历史：{history}\n"
        f"用户消息：{user_message}"
    )

    with logfire.span("planner"):
        decision = llm.invoke(prompt).content.strip().lower()

    if "conversational" in decision:
        # 讲师：追踪状态 handling conversation，plan intent 是 conversational
        return {
            "plan": "conversational",
            "current_status": "handling_conversation",
        }

    return {
        "plan": "technical",
        "current_status": "handling_technical",
    }
```

### 4.3 `app/agents/nodes/responder.py`

逐字稿明确提到：`logfire`、`ChatGroq`、`AgentState`、`generate_node`、两套 prompt（conversational 用历史；technical 用「技术上下文 + 对话历史 + 用户问题」）、logfire 标题 `lm synthesis`、写回 final_answer / status / messages。

```python
# app/agents/nodes/responder.py
# 逐字稿明确：logfire / ChatGroq / AgentState / generate_node
# 逐字稿明确：两套 prompt，按 state 里的 intent 分支
# 逐字稿明确：logfire 标题 "lm synthesis"
# 函数体细节为示意补全

import logfire
from langchain_groq import ChatGroq
from app.agents.state import AgentState
from config import settings


llm = ChatGroq(
    api_key=settings.GROQ_API_KEY,
    model_name=settings.MODEL_NAME,
    temperature=0,
)

CONVERSATIONAL_PROMPT = """你是一个资深技术架构师。
根据对话历史正常回复用户。
对话历史：{history}
用户问题：{query}
"""

TECHNICAL_PROMPT = """你是一个资深技术架构师。
根据提供的技术上下文回答问题。
技术上下文：{context}
对话历史：{history}
用户问题：{query}
"""


def generate_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    query = state.get("current_query", "")
    plan = state.get("plan", "conversational")

    if plan == "conversational":
        # 讲师：在 log 里打印 generating conversational response using memory
        logfire.info("generating conversational response using memory")
        prompt = CONVERSATIONAL_PROMPT.format(history=history, query=query)
    else:
        # 讲师：技术场景下显示 full context，文档来自 retriever
        context = "\n\n".join(state.get("documents", []))
        prompt = TECHNICAL_PROMPT.format(
            context=context, history=history, query=query
        )

    with logfire.span("lm synthesis"):
        response = llm.invoke(prompt).content

    return {
        "final_answer": response,
        "current_status": "responded",
        "messages": [{"role": "assistant", "content": response}],
    }
```

### 4.4 `app/agents/nodes/retriever.py`

**课里没讲。** 本段只建了文件，没有写任何内容。按 P065 的设计，它应该做：query → Qdrant top-k → FlashRank 重排 → 写回 `documents`。下一集才实现。

### 4.5 `app/agents/graph.py`

**课里没讲。** 本段只建了文件。按 P065 的设计，它应该用 LangGraph 把 planner → (conversational | technical → retriever → responder) 连起来，并挂 memory saver。

### 4.6 `app/agents/main.py`

**课里没讲。** 本段只建了文件。P065 提到最终界面是 Streamlit。

### 4.7 数据摄取命令（P064）

```bash
# 讲师演示的第一种入口（不带 wipe）
python app.ingestion.data_processor

# 讲师口述的第二种入口（把 data 作为 source，wipe 从头开始）
python app.ingestion
```

### 4.8 Git 命令（P066）

```bash
git add .
git commit -m "data ingestion pipeline created"
git push
```

---

## 5. 逐行解释

### 5.1 `state.py`

- `from typing import TypedDict, List, Annotated`：`TypedDict` 定义「有固定键的字典」；`Annotated` 用来给类型挂元数据（这里挂 reducer）；`List` 是消息列表的类型。**在 JS/Node 里对应**：`TypedDict` 类似 TS 的 `interface`，`Annotated` 类似给字段挂一个自定义装饰器/合并策略。
- `import operator`：标准库，`operator.add` 就是 `a + b`。在 LangGraph 里它被当作 **reducer**：节点返回 `{"messages": [新消息]}` 时，不是覆盖整个列表，而是 append。讲师原话：「`operator.add` 是一个 reducer，把消息追加到 annotated 列表里。」
- `messages: Annotated[List[dict], operator.add]`：为什么是 `List[dict]` 而不是 `List[BaseMessage]`？讲师解释：「这个列表是字典列表，因为这些 agent 是以字典形式创建的，包括 invocation 之类。」——即消息以 `{"role": ..., "content": ...}` 形式流转。
- `current_query`：用户当前 query。讲师：「current query 意思是用户当前给的 query 是什么。」
- `documents`：从 retriever 拿到的文档。讲师：「从 retriever 拿到的文档。」
- `plan`：intent，conversational 还是 technical。讲师：「plan 意思是 intent，是 conversational 还是 technical。」
- `current_status`：我现在在哪。讲师：「current status 意思是我在哪。」
- `final_answer`：最终答案。讲师：「它脑子里得知道自己到底在干什么。」
- 为什么需要 state？讲师用「举手」比喻：你举手时大脑知道手举起来了；agent 也要知道「我刚读了消息、我在规划、我在回复」。

### 5.2 `planner.py`

- `ChatGroq(...)`：讲师明确说「初始化我们的 Groq 模型，需要 api key，从 settings 拿；model name 也从 settings 拿」。`temperature=0` 是讲师强调的：「temperature 为 0，意思是零创造力，但你可以改成 0.2 或 0.5 看你实验什么。」
- `from config import settings`：讲师解释「settings 是 Settings 类的对象」。
- `logfire`：讲师说「用 Logfire 追踪应用」，planner 里「我们用 Logfire 追踪」。
- 取历史的方式：讲师说「从 memory saver 拿历史……检测消息是 user 发的还是 assistant 发的，从 role 里选……检测到 user 消息后取 `[-1]` 的 content，因为消息就存在那里」。上面代码用 `reversed` 找最后一条 user 消息，是同一意图的示意写法。
- prompt 的两条规则是讲师逐字念的：
  1. 最新消息是问候（hi、hello），或仅凭对话历史能答（如「我叫什么」）→ `conversational`；
  2. 关于 Kubernetes、Intel、网络等的技术问题，或需要新鲜文档 → 去检索（`technical`）。
- 返回值：讲师说「如果决定是 conversational，current_query 是 conversational，就追踪状态：handling conversation，plan intent 是 conversational，数据以类似方式流动，返回同样的东西」。所以返回 `plan` 和 `current_status` 两个键。
- **不这样会怎样**：如果 planner 不区分 intent，就退化成 P065 批评的传统 RAG——用户说「hi」也去 Qdrant 检索，LLM 更容易幻觉。

### 5.3 `responder.py`

- 为什么 responder 也要初始化一次 `ChatGroq`？讲师在 responder 开头说「这里再初始化 Groq agent，你可以从 settings 改模型名」——每个节点文件独立初始化，是讲师的组织方式。
- `generate_node` 的两套 prompt 是讲师明确区分的：
  - conversational：「respond normally given the history」——根据历史正常回复；
  - technical：「你是资深技术架构师，根据提供的技术上下文回答问题……这是技术上下文、这是对话历史、这是用户问的」。
- 讲师原话解释两套 prompt 的差异：「这里只有一个 prompt，因为只有一个任务；这里取决于传进来的 state。state 里会传 intent，根据 plan：如果 plan 是 conversational，告诉 agent 根据历史正常回复；如果是 technical，技术场景下我们显示这么多 full context，这是我们设的文档状态，因为我们会从 retriever 拿文档。」
- `logfire.span("lm synthesis")`：讲师说「用 lm synthesis 标题记日志」。
- 返回值：讲师说「这是最终答案、这是状态、这是生成的回复、这是消息列表（以 content 形式）」——对应 `final_answer`、`current_status`、`messages`。
- **不这样会怎样**：如果 technical 分支不把 `documents` 拼进 prompt，responder 就退化成普通聊天，RAG 的「R」白做。

### 5.4 数据摄取（P064）

- `python app.ingestion.data_processor`：讲师演示的入口。不带 `--wipe` 的原因：「因为我们是第一次做，即使你传了 wipe 也不会发生什么。」
- `wipe` 的语义：讲师说「wipe 变量是当你想清掉什么东西的时候用的」；`python app.ingestion` 时「wipe 就是从头开始」。
- 日志顺序为什么重要：`Wiping collection` → `created a collection enterprise rack` → 处理文件 → `GCS upload`，这是讲师用来验收流水线是否按序执行的证据。
- 15 页切块：讲师说「26 页大于 15，所以生成两个 chunk，因为 15、15 这样切」；「总页数 190，PDF 超过 15 页，所以一页一页处理」。这是 PDF loader 的分页策略，不是 1500 字符的 chunk size——两者是不同层级：1500 是文本 chunk，15 是 PDF 页数阈值。
- 失败即切块：讲师说「如果处理失败，它就会去切块，不用担心这个错误」。
- Qdrant 配置：讲师在 dashboard 上指出「距离是 cosine，向量大小是这个，维度是这些」——具体数值讲师没念，以你实际输出为准。

### 5.5 Git（P066）

- `git add .` + `git commit -m "data ingestion pipeline created"`：讲师原话命令，commit message 逐字为 `data ingestion pipeline created`。
- 讲师强调：「养成好习惯，规范地提交 Git 命令。我们本该在文件级别做，但从现在起我会保持。」

---

## 6. 复现检查清单

**P064 数据摄取**

- [ ] `python app.ingestion.data_processor` 能启动，不报 import 错误
- [ ] Logfire 里能看到 `Wiping collection`
- [ ] Logfire 里能看到集合创建日志（集合名以你实际为准，讲师屏幕上是 `enterprise rack`）
- [ ] 不支持的文件被跳过，日志里有 skipping 字样
- [ ] 26 页 PDF 被拆成 2 个 chunk
- [ ] 190 页 PDF 逐页处理
- [ ] GCS `raw` 区有原始文件
- [ ] GCS `processed` 区有 JSON
- [ ] Qdrant `enterprise` 集合里能看到 chunk
- [ ] Qdrant 配置里距离函数是 cosine
- [ ] Logfire 日志条数量级与讲师一致（讲师约 286 条）
- [ ] true data 6 个文件全部处理完

**P065 设计（无命令，对照理解）**

- [ ] 能说出传统 RAG 的 4 步链路
- [ ] 能说出传统 RAG 的缺陷（hi 也检索 → 幻觉）
- [ ] 能说出 query rewriting 解决什么问题（剥离给 LLM 的指令）
- [ ] 能说出 bi-encoder 与 cross-encoder 的区别
- [ ] 能说出 re-ranker 的流程：top 10 → 重排 → top 5
- [ ] 能说出 agentic flow：planner → (conversational | technical → retriever → FlashRank → responder)
- [ ] 能说出 context 的两个来源（历史 + 文档）和文档的三个可能来源（MCP / 工具 / VectorDB）

**P066 代码骨架**

- [ ] `git add .` / `git commit -m "data ingestion pipeline created"` / `git push` 成功
- [ ] 目录 `app/agents/` 存在，含 `main.py`、`graph.py`、`state.py`
- [ ] 目录 `app/agents/nodes/` 存在，含 `planner.py`、`responder.py`、`retriever.py`
- [ ] `state.py` 能 import，`AgentState` 有 6 个字段
- [ ] `planner.py` 能 import，`ChatGroq` 初始化不报 key 错误
- [ ] `responder.py` 能 import，`generate_node` 存在
- [ ] `retriever.py` 和 `graph.py` 目前是空文件（本段未实现）

---

## 7. 课里没讲但你会撞上的

1. **`ChatGroq` 的 import 路径。** 讲师口述是「from Langchain, we import ChatGroq」，但实际包是 `langchain_groq`，即 `from langchain_groq import ChatGroq`。如果你照讲师口述写 `from langchain import ChatGroq` 会 ImportError。装包：`pip install langchain-groq`。
2. **`settings` 的字段名。** 讲师只说「api key 从 settings 拿、model name 也从 settings 拿」，没念字段名。上面代码用了 `settings.GROQ_API_KEY` 和 `settings.MODEL_NAME`，**这两个名字是示意**，请以你 `config.py` 里 `Settings` 类的实际字段为准。
3. **memory saver 的接入方式。** 讲师说「从 memory saver 拿历史」「我们有 LangGraph memory saver」，但没给代码。LangGraph 里通常是 `MemorySaver()` 传给 `compile(checkpointer=...)`，然后在节点里通过 `config["configurable"]["thread_id"]` 拿历史。本段 `graph.py` 没写，所以上面 planner/responder 里是从 `state["messages"]` 取历史——这是示意，等 `graph.py` 写好后要改成从 checkpointer 取。
4. **`retriever.py` 和 `graph.py` 是空的。** 本段只建文件。你如果现在就想跑通，需要自己补：retriever 用 Qdrant client 做 top-k，再调 FlashRank；graph 用 `StateGraph(AgentState)` 加节点和条件边。这些**课里没讲**，下一集才讲。
5. **FlashRank 的安装与用法。** 讲师只说「用 FlashRank，本地 re-ranker，Flash 表示很快」，没给包名和 API。课里没讲，需要你查 FlashRank 官方文档。
6. **Streamlit。** P065 提到最终界面是 Streamlit，但本段没有任何 Streamlit 代码。课里没讲。
7. **`temperature` 的可调性。** 讲师说「temperature 为 0 是零创造力，但你可以改成 0.2 或 0.5 看你实验什么」——这是讲师明确留的口子，不是必须为 0。
8. **Qdrant 集合名。** 讲师屏幕上日志是 `enterprise rack`，语音识别可能有误；你在 Qdrant dashboard 里看到的集合名以实际为准，不要硬编码成 `enterprise rack`。
9. **GCS 桶名。** 讲师只演示了「搜索 buckets → 进入桶 → raw / processed」，没念桶名。课里没讲，用你自己的桶名。
10. **`python app.ingestion` 与 `python app.ingestion.data_processor` 的关系。** 讲师两种都提了，但没说清是 `__main__.py` 还是包级入口。如果你跑 `python app.ingestion` 报「No module named app.ingestion.__main__」，就改用 `python app.ingestion.data_processor`，或自己加 `app/ingestion/__main__.py`。课里没讲。
11. **前端背景提示：LangGraph 的 state 和 reducer 在 JS 里对应什么。** 如果你写过 Redux，`Annotated[..., operator.add]` 很像 reducer 函数——节点 dispatch 一个 action（返回 `{"messages": [...]}`），store 用 reducer 合并。区别是 LangGraph 的 state 是每个节点读写的共享对象，不是单向数据流。
12. **`logfire.span` 与 `logfire.info` 的区别。** 讲师只说了「用 Logfire 追踪」「用 lm synthesis 标题记日志」，没解释 API。`span` 是一个有开始/结束的作用域，`info` 是一条日志。课里没讲细节，按你 Logfire 版本的实际 API 为准。

---

### 截图索引（本文档引用的帧）

![p064 00:33 讲师回顾数据摄取旅程：loader、1500 切块、50 一批 embedding](images/p064_0033s.jpg)

![p064 01:05 讲师展示 ingestion 的 final processor 与 upload_to_gcs 逻辑](images/p064_0065s.jpg)

![p064 02:11 讲师说明运行命令与 wipe 变量的作用](images/p064_0131s.jpg)

![p064 03:16 终端开始执行摄取，日志显示 Wiping collection](images/p064_0196s.jpg)

![p064 03:49 日志显示 26 页 PDF 被拆成两个 chunk、190 页 PDF 逐页处理](images/p064_0229s.jpg)

![p064 04:22 Logfire 中的嵌套 trace：Wiping collection、created collection、GCS upload](images/p064_0262s.jpg)

![p064 06:00 Logfire 日志显示所有文件处理完成、true data 六个文件](images/p064_0360s.jpg)

![p064 07:00 Qdrant dashboard 显示 enterprise 集合的 chunk 与 cosine 配置](images/p064_0392s.jpg)

![p065 01:18 讲师回顾数据摄取四步：加载、切块、embedding、存 vector db](images/p065_0078s.jpg)

![p065 03:55 传统 RAG 链路：query → embedding → Qdrant top-k → LLM](images/p065_0235s.jpg)

![p065 06:32 讲师说明「用搞笑的方式」是给 LLM 的指令，不是给 Qdrant 的](images/p065_0392s.jpg)

![p065 09:09 重排流程：先取 top 10，重排后取 top 5](images/p065_0549s.jpg)

![p065 10:28 MCP 被解释为装多个工具的 toolbox](images/p065_0628s.jpg)

![p065 13:04 bi-encoder：一个 query embedding 与所有文档比对](images/p065_0784s.jpg)

![p065 15:41 cross-encoder：query 与文档成对比较，内部用 attention](images/p065_0941s.jpg)

![p065 20:14 文档预览：Streamlit、planner、retriever、FlashRank、responder、memory](images/p065_0941s.jpg)

![p066 00:47 讲师在 git bash 里执行 git add / commit / push](images/p066_0047s.jpg)

![p066 01:34 新建 app/agents 目录与 main.py](images/p066_0094s.jpg)

![p066 02:21 nodes 下建 planner.py、responder.py、retriever.py](images/p066_0141s.jpg)

![p066 03:08 state.py 导入 TypedDict、List、Annotated、operator](images/p066_0188s.jpg)

![p066 03:55 AgentState 字段：messages、current_query、documents、plan、current_status、final_answer](images/p066_0235s.jpg)

![p066 05:29 planner.py 导入 ChatGroq、AgentState、settings、logfire](images/p066_0329s.jpg)

![p066 06:16 planner 初始化 ChatGroq，temperature=0](images/p066_0376s.jpg)

![p066 07:02 planner 的 prompt：问候/历史可答 → conversational，技术问题 → 检索](images/p066_0422s.jpg)

![p066 08:36 responder.py 的 generate_node 与两套 prompt 分支](images/p066_0516s.jpg)

![p066 09:23 responder 里 logfire 标题 lm synthesis 与写回 state](images/p066_0563s.jpg)