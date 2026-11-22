# AI Security Bootcamp Part 2 —— 护栏（Guardrails）、网关与可观测（P056–P057）

> 本文档覆盖 P056（Module 3：Denied Topics / Word Filters / PII Redaction）与 P057（Module 4：Grounding Policy 与 RAG 防幻觉）。所有代码按「可直接保存运行」的标准给出，路径、依赖、环境变量、启动命令写全。截图取自课程提供的帧清单，路径原样复制。

---

## 1. 这一节做什么

这两节课把 AWS Bedrock Guardrails 的**五根支柱**里剩下的三根补齐，并落到一个能跑起来的项目上：

- **P056 / Module 3**：讲 **Denied Topics（= Topic Policy）**、**Word Policy（自定义词表 + AWS 托管脏话表 + 自定义正则）**、**PII Redaction（敏感信息策略）**。核心工程结论有三条：
  1. Topic Policy 是**语义匹配**，Word Policy 是**逐字/逐字符精确匹配**，两者用途完全不同；
  2. 敏感信息策略里 `block` 与 `anonymize` 的差别是「整条消息拦下」vs「打码后放行」；
  3. **`apply_guardrail` API 只支持 `block`，不支持 `anonymize`**；`anonymize` 必须走 `converse` / `invoke_model`。唯一例外是**自定义正则**（custom regex）在 `apply_guardrail` 下也能 `anonymize`。
- **P057 / Module 4**：讲 **Grounding Policy（接地策略）**，专门治 RAG 的幻觉。两个独立过滤器：**grounding**（答案 vs 源文档）与 **relevance**（问题 vs 答案），各自输出 0.0–1.0 的分数，与阈值比较后决定放行或拦截。**Grounding Policy 只能挂在 LLM 输出侧，且 `apply_guardrail` 不支持它，只能用 `converse`（或 `invoke_model`）**。

最终产物是一个 Python 项目：`guardrails_lab/`，包含 6 个可独立运行的脚本，分别演示 denied topics、word policy、custom regex、PII（apply_guardrail 版）、PII（converse 版，带 anonymize）、grounding + RAG。

---

## 2. 讲师原话

> "现在我们开始 Module 3。在 Module 3 里我们会讲 Denied Topics、Word Filters 和 PII Redaction。PII 代表 Personally Identifiable Information，基本上就是所有属于 PII Redaction 范畴的个人敏感信息。Denied Topics 你们已经理解了，在 Module 1 里做过 Topic Policy，记得吗？Topic Policy 就是 Denied Topics，没有区别。"
> —— p056 [00:00]

> "从今往后我们会用 Converse API。Module 2 里我们用的是 invoke model，也用过 guardrails API。现在是时候用生产级的 Converse API 了。"
> —— p056 [00:29]

> "问题陈述是这样的：你在做一个编程助手，回答 Python、数据库、C、Java 的问题。但第一，用户会问法律建议、医疗建议；第二，用户会把信用卡信息、姓名贴进来，这是敏感信息，要交给 PII Redaction 处理；第三，用户会提竞争对手的名字——假设你是 OpenAI，人们会提 Claude、提 Gemini，你要么屏蔽，要么保持中立。"
> —— p056 [00:58]

> "所以我们要解决的问题是：第一是 denied topics，第二是 word policy，第三是敏感信息策略。到目前为止我们做过了 topic policy——denied topic 就是同一个东西；上一个视频我们做了 content filter。五根支柱里，这个视频聚焦 word policy 和敏感信息策略（也就是 PII policy），只剩 grounding policy 留到下一个模块。"
> —— p056 [02:25]

> "先做环境准备：安装 boto、boto3、botocore，设置 model name、region name，设置两个客户端 bedrock 和 bedrock runtime。然后写几个 helper 函数：第一个用来创建 guardrail，省得你反复创建；第二个用来 apply guardrail 并检查内容是被拦了还是被放行；第三个用来打印 guardrail 的结果。"
> —— p056 [02:55]

> "什么是 denied topic？就是你选择要屏蔽的主题。比如 Module 1 里我们做烹饪机器人，屏蔽了 medical advice。medical advice 就是 denied topic。我们给它定义、给它一些例子，让模型理解要屏蔽哪类主题。"
> —— p056 [04:19]

> "Topic Policy 和 Word Policy 的区别在哪？Topic Policy 是语义的。即使你给了定义、给了例子，用户问的问题不在例子里，但只要语义上属于医疗建议，它也会拦。"
> —— p056 [04:46]

> "Topic Policy 会分析这个问题的语义含义，看是否与那些例子在语义上匹配、是否属于医疗建议。是就拦，不是就放。所以 Topic Policy 是语义工作的。"
> —— p056 [06:04]

> "Topic Policy 用在你想要覆盖很宽的领域时。比如我只写了 medical advice，给了五六条例子，写了一个像样的定义——凡是用户问药、问剂量，一律拦——整个医疗板块就自动被屏蔽了。但 Word Policy 是拦某个具体的词：你给了 claude，只要用户输入里出现 claude 这个词就拦；但如果有人写 claude code，它不会拦，因为它找的是精确匹配，必须是 claude 本身才拦，否则放行。"
> —— p056 [06:34]

> "Word Policy 没有语义，它逐词、逐字符地搜。可以是短语，也可以是单个词，但必须和用户输入匹配。Topic Policy 做的是语义搜索。"
> —— p056 [07:32]

> "什么时候用哪个？概念很宽、想覆盖大领域，用 Topic Policy；需要拦特定词，用 Word Policy。比如你想屏蔽竞争对手的词——你有个 YouTube 频道，有竞争对手，有人在你频道下评论说「那个人更好」，你想屏蔽这类评论。YouTube 我记得就有这个功能，可以屏蔽特定词、特定类型的评论。"
> —— p056 [07:58]

> "还有一点：在 word 和 denied topic（也就是 topic policy）里，你必须定义两样东西。第一是定义——弱的定义会导致弱的结果。你只写「legal stuff」，范围太宽；好的定义应该像这样：请求法律建议、法律意见、法律解释、法律指引、宪法相关的内容，全部拦。你必须给出恰当的定义和范围，否则 AWS 会困惑，有时放行、有时把该放行的也拦了。第二是例子——至少给五到十条好例子。"
> —— p056 [08:27]

> "所以我们先创建 guardrail，名字叫 denied topics，描述、input message、output message 都填上，因为问题陈述是做编程助手，不允许任何医疗或法律问题。你可以看到我建了 legal advice 部分，写了恰当的定义和五六条例子，type 是 denied；medical advice 同样，定义、例子都有，type 是 denied。跑一下，guardrail 就创建好了。"
> —— p056 [09:25]

> "现在测试。这些是 dummy prompts：有法律类的、医疗类的、代码类的，还有边界类的——比如「我想用 Python 做一个法律文档解析器」，legal 在里面，但它是个编程问题；最后一条「怎么把我的应用连到医疗记录」，medical 在里面，但仍然是编程问题。跑一下看看。第一条 intervene——intervene 意思是 guardrail 把它拦了，输出是「我是编程助手，只能帮编程问题」。这一条、这一条、这一条都被拦了。然后「我起了个疹子一直不退，可能是什么」——它放行了。"
> —— p056 [09:54]

> "我觉得这是个问题，因为这是医疗问题。你看这条也放行了，这也是医疗问题；这条也放行了，但它是编程问题，所以没关系。这两条是 false negative——本该拦却放行了。也许我们可以定义更好的例子、更好的定义，它们就能被拦。也许这些问题没被我们写的定义和例子覆盖到，所以才会这样。"
> —— p056 [10:53]

> "现在说 word policy。Word Policy 里有两样东西：第一是自定义词表（custom word list），第二是 AWS 托管脏话表（managed profanity list）。托管脏话表是 AWS 内置的，就像 content filter 由 AWS 托管一样，它包含多种语言里应当避免的各种词。你只要在 guardrail 里声明它就行。"
> —— p056 [11:48]

> "我们创建另一个 guardrail，叫 word policy guardrail。填名字、描述、input message、output message，然后是 word policy：屏蔽 competitor x、屏蔽 competitor y。注意，如果名字是 computer yy 就不会被拦，必须是 computer y 本身才拦。然后屏蔽某个名字、某个名字，并且声明了 AWS 托管的 profanity list——想加就加，想删就删。创建好了，来测。"
> —— p056 [12:16]

> "这些是 dummy prompts，一条条测。这条 intervene 了，因为我问「computer x 怎么处理认证」；同样「computer y 比你们产品好吗」。现在我把 prompt 改成 computer x y z，应该不拦——你看，放行了，因为名字不匹配，匹配的名字是 computer x。"
> —— p056 [13:13]

> "脏话这边：「this damn code keeps breaking」，我觉得脏话程度不够，把它改得更脏一点——虽然我自己不用这种语言。现在应该拦了。对，拦了，这条 profanity 被 intervene 了。这条放行、这条放行、这条也正常放行。所以 word policy 和 profanity policy 就是这么工作的。profanity policy 属于 word policy 的一部分，词表由 AWS 托管。想加就按这样加，不想加就从这里删掉，完全由你决定。"
> —— p056 [14:08]

> "现在讲自定义正则。假设你屏蔽了 claude 这个词，但用户问 claude code、claude design、claude cover——一个办法是把这三种也加进词表，但太麻烦，而且 Claude 以后出新东西你还得重新定义。所以你可以建一个自定义正则：只要出现 claude 就拦这条消息。你看 claude code 里有 claude 被拦、claude design 被拦、claude co-work 被拦。正则用 Python 的 re 库写。"
> —— p056 [14:37]

> "正则配置是这样工作的：单独一个 regex config，定义 name、description、pattern，还有 action。action 有两种。这些是常见 pattern：美国电话号码、美国社会安全号（印度号码同理）、AWS access key 格式、公司员工姓名——这些正则格式你都可以让任何编码工具、任何 LLM 生成。"
> —— p056 [16:04]

> "现在我建另一个 guardrail，名字叫 regex patterns，填描述、input message、output message，配置放在 sensitive information policy config 里——注意，自定义正则属于敏感信息部分，不属于 word policy。敏感信息里你可以用自定义正则，也可以用 AWS 预置的 PII Redaction。PII Redaction 是 AWS 预置的，可以直接用。但先讲自定义正则。"
> —— p056 [16:58]

> "第一个正则给 employee ID 用，描述随你，pattern 是匹配 emp 的——只要出现 emp 就拦。action 有两种：block 和 anonymize。两者的区别我讲理论不如直接演示。internal ticket 同样，AWS access key 同样。创建 guardrail，刷新 AWS 控制台，能看到 custom regex pattern demo 这个 guardrail 建好了。"
> —— p056 [17:54]

> "这些是测试问题：employee ID、ticket ID、AWS key，还有一条安全评论。employee ID 我们做 anonymize，internal ticket 做 anonymize，AWS key 做 block。跑一下看区别。顺便说一句，到现在我们一直用的是 apply guardrail，还没用 Converse API。"
> —— p056 [18:23]

> "三条都跑了。第一条输入是「please look into this employee」，guardrail intervened，说明执行了，输出是「please look into the issue for the employee ID」——employee ID 被打码了，employee ID 不再发给 LLM。"
> —— p056 [19:19]

> "anonymize 和 block 的区别：anonymize 就是打码。假设用户给了密码 12345，这个密码会发给 LLM，但 LLM 拿到你的密码就有安全问题，所以我们在中间放个 guardrail，把 12345 变成 *****，打码后再发给 LLM——这就是 masking。你看这条 ticket 202500145 被打码了，输出里看不到 ticket 信息。AWS key 我们设的是 block 不是 anonymize，所以它直接被拦了。"
> —— p056 [20:18]

> "再看「how do I connect to existing」，action 显示 intervene 是 false——这条没有 guardrail 介入。这条是 true、这条也是 true，最后这条没介入。所以你理解了：anonymize 就是 masking，把你的敏感信息打码。自定义正则讲完了，现在进入正题：PII Redaction 与检测。"
> —— p056 [21:15]

> "PII 是什么？全称 Personally Identifiable Information，所有与你个人相关的信息。可以是姓名、邮箱、电话、信用卡、地址、护照号、access key、secret key、用户名、密码这类。"
> —— p056 [21:43]

> "anonymize 和 block 我说过了：anonymize 就是打码。有人说「我的邮箱是这个、SSN 是这个」，它就会打码，你看不到真实值。"
> —— p056 [22:11]

> "什么时候用 anonymize？当你需要消息发给 LLM、让 LLM 给出答案时。场景：AWS chatbot，你是用户，第一次用 AWS 的初学者不理解问题，就把信息都给了 chatbot——我叫什么、用这张信用卡订的、现在不好使了。我们想让 chatbot 回应并解决问题，但不想让 chatbot 看到信用卡信息，于是打码后发给 chatbot，chatbot 知道用户遇到这个问题、能给出回应。anonymize 里信息被打码，但 LLM 收到了内容，LLM 看不到敏感信息但知道上下文。而 block 意味着消息永远不到 chatbot。按用例选。"
> —— p056 [22:37]

> "还有一点：block 在 apply guardrail 下能用，但 anonymize 在 apply guardrail 下不能用。你可能奇怪我们刚才明明用了 anonymize——那是因为我们用的是自定义正则，自定义正则下没问题，anonymize 和 block 都行。但其他预置的东西不行。anonymize 只能配合 converse API 或 invoke model 使用。"
> —— p056 [24:03]

> "我解释一下：正则的 anonymize 能用，因为它是你自己建的；但 apply guardrail 里预置的那些东西，你没法做 anonymize，只能 block。apply guardrail 只能 block，anonymize 只能由 converse API 做。"
> —— p056 [25:00]

> "我们建一个 PII guardrail，负责 PII 检测。blocked input message、blocked output message，配置是 sensitive information policy config，给 PII entities config——这些都是 AWS 预置的。预置的会自动拦姓名、邮箱、用户名、驾照号、社会安全号、信用卡号、access key、secret key。跑一下，guardrail 建好了，可以去控制台验证。"
> —— p056 [25:29]

> "这些是测试 prompt。我们不用 anonymize，所以把它去掉。你看：这条传了姓名、这条传了邮箱、这条传了电话——但这个电话是美国格式，印度格式 AWS 里没有，印度格式得用自定义正则。然后是 IP 地址、用户名、AWS access key，还有一条安全 prompt。用 apply guardrail 一条条检查。"
> —— p056 [26:26]

> "姓名这条 intervene 了，邮箱也 intervene，电话也 intervene。它给出消息：你的消息包含信用卡、密码之类的敏感信息，请移除后重试。现在我把姓名从第一条里去掉，它就能跑。但我想再演示一件事：把姓名设成 anonymize，你可能以为 apply guardrail 下也能用。我设成 anonymize，跑一下——guardrail id 已经建好，先删掉旧的 guardrail 才能重建。重建后姓名设为 anonymize。"
> —— p056 [27:21]

> "anonymize 意味着应该被打码。再跑——你看，它放行了，没做任何动作。因为 anonymize 在 apply guardrail 下不工作。再修一下：只有自定义正则——因为是你自己建的——才能在 apply guardrail 下用 anonymize；用 converse API 时 anonymize 和 block 随时都能用，没有这个限制。"
> —— p056 [28:19]

> "现在讲真实场景：你在做客服 chatbot，我们讲用 PII guard 和不用 PII guard 两种情况。假设你有个餐厅、有个点单 chatbot，用户说了姓名、给了邮箱、说用这张卡付了款，把所有信息都给了——真是个糊涂用户。没有 PII guard 会怎样？"
> —— p056 [28:48]

> "所有敏感信息都会发给 LLM 提供商，之后假设这些信息被泄露——因为 LLM 模型自己都说别给它任何信息，它们会用这些信息训练自己。所以不该给。之后假设有人要信用卡信息的 demo，那个模型恰好被那个用户给的信息训练过，demo 里可能就吐出真实信用卡号。虽然这种巧合几乎不会发生，但可能性存在。"
> —— p056 [29:47]

> "有 PII guard 的话，我们可以 block，也可以 anonymize 后再发给 LLM。跑一下。这是客户消息、这是 system prompt，我们做一个生成式 AI agent、一个小 chatbot，这是给的 prompt。你看 prompt 里有卡信息、姓名、SSN——餐厅为什么需要 SSN？好吧，假设你是技术公司，那可以要 SSN。"
> —— p056 [30:44]

> "没有 PII guard 时：用户提问，模型回应了，它记下了订单参考号、卡号，因为它拿到了 SSN 后四位，也拿到了所有这些信息。你可能以为它被打码了，其实没有——它能看见后四位，意味着它能看见全部数字。所以 LLM 拿到了信息。打开完整输出看看。"
> —— p056 [31:13]

> "有 PII guard 时：客户一提问，guard 就介入，回应是「你的消息包含信用卡或密码之类的敏感信息，无法处理，请移除后重试」。如果我们用 converse API 建这个 PII guard，还能打码。所以作业：用 converse API 建 PII guard，实现 PII redaction。"
> —— p056 [32:09]

> "这个模块我们用了 guardrails API，但我建议你用 converse API 实现 PII redaction。这就是 PII guard、PII redaction 的工作方式。本模块讲了 denied topics（topic policy）、word policy、profanity list、PII redaction、自定义正则——自定义正则下 apply guardrail 的 anonymize 和 block 都能用，但预置的那些 apply guardrail 只能 block 不能 anonymize。务必记住 block 和 anonymize 的区别。"
> —— p056 [32:37]

> "接下来进 Module 4，我认为这是最重要的，因为要讲 RAG 实现——现在 RAG 很常见，要学怎么在 RAG 里实现 guardrails，也就是 grounding guardrails。"
> —— p056 [33:31]

> "Module 4 完全基于 RAG 应用概念，讲 grounding policy。grounding policy 只能挂到 RAG 上，而且不能用 apply guardrail API，只能用 Converse API。为什么需要 grounding policy？学过 LLM、RAG 的人最烦的是什么？幻觉——模型编造不需要的答案。幻觉可以用 grounding guardrails 控制。"
> —— p057 [00:00]

> "看这张图：RAG 里模型只应该根据提供的文档回答，但有时模型自己编答案给用户。举例：你在公司文档上做了个定制 chatbot，文档很小，只有一行——公司叫 Novatech，245 名员工，2019 年成立，就这些。chatbot 就基于这些训练。现在公开了，有人问 Novatech 本季度营收多少。源文档里根本没提营收，但模型答「Novatech 在 Q3 报告了 1240 万营收」。这正确吗？不，源文档没有这个信息，这是 AI 编的。"
> —— p057 [00:57]

> "问题在于：它给假信息，基于假信息有人投资你公司亏了钱，你会失去信任，还可能面临法律问题。"
> —— p057 [02:22]

> "解决方案是 grounding policy（也叫 grounding guardrails）：同样的源文档，模型生成答案，我们检查生成的答案是否符合文档——符合就放行给用户，不符合就拦。这就是 grounding guardrails。grounding guardrails 有两个过滤器：grounding 和 relevance。"
> —— p057 [02:50]

> "grounding guardrails 挂在哪？Module 1 说过 guardrail 有两个挂载点：用户输入、LLM 输出。grounding guardrails 挂在模型生成答案之后——所以它永远挂在 LLM 输出侧，永远不挂输入侧，因为输入侧没有上下文，输出侧才有源文档上下文。"
> —— p057 [03:19]

> "你会得到一个 0.0 到 1.0 的置信分数。1.0 表示 LLM 生成的答案完全符合源文档事实；0 表示按源文档不成立。接近 0 时，按你设的阈值决定拦还是放。它有两个内部过滤器，且只配合 inline guardrails 工作——grounding guardrails 只能配合 inline guardrails，invoke model 能用、converse API 能用，但建议用 converse API，apply guardrail 不行。"
> —— p057 [03:48]

> "grounding policy 里有两个独立过滤器：grounding 和 relevance。grounding 是把 LLM 答案和源文档比对。我在记事本上给个好例子。"
> —— p057 [04:47]

> "源文档：公司名 Novatech，245 名员工，2000 年成立。用户问：公司营收多少？这个问题传给 LLM（我们用 Nova Lite）。Nova Lite 搜文档，没找到，假设它返回「公司营收 100 万美元」。这是 LLM 给的答案。现在我们拿这个答案和源文档比对，看答案是否来自源文档——这叫 grounding。"
> —— p057 [05:45]

> "relevance 是什么？这是问题、这是答案，检查问题与答案是否对应——问题与答案比对叫 relevance。这个例子里 grounding 低，因为是编的答案；但 relevance 好，因为问营收、答的也是营收。反过来，你问营收，LLM 答「有 245 名员工」——问题与答案不对应，relevance 低；而答案确实来自源文档，grounding 高。所以：答案与源文档的关系叫 grounding，问题与答案的关系叫 relevance。"
> —— p057 [07:11]

> "它检查响应是否真的回答了用户问题（relevance），检查 LLM 的答案和声明是否有文档支撑（grounding）。它触发在模型输出上，也触发在用户查询上。阈值这次不是 low/high/medium，而是数字格式。"
> —— p057 [08:08]

> "grounding policy 和其他策略的区别：其他策略（topic、content、sensitive information、word）输入输出都能挂，但 grounding policy 只能挂输出，不能挂输入。因为两种情况都需要答案——查 relevance 要答案，查 grounding 要答案，答案总在 LLM 响应之后产生，之后只能用输出 guardrail。"
> —— p057 [09:04]

> "环境准备：装 boto3、设 region、model ID、两个客户端 bedrock 和 bedrock runtime。grounding 和 relevance 都给 0 到 1 的数：0 表示问题与答案无关，1 表示高度相关；数越高 grounding 越高、relevance 越高。"
> —— p057 [10:03]

> "这里也设阈值：grounding 分数大于阈值才放行，否则拦；relevance 同理。然后写 helper 创建 guardrail，阈值设 0.75——0.75 是很优化、很合适的数。创建 guardrail，名字 grounding guardrail，blocked input message、blocked output message。input message 显然不会被触发，因为 grounding guardrails 永远在输出侧。那为什么还定义 input？因为你不是给 content、topic 各建一个 guardrail，而是建一个 guardrail，里面放 topic policy、content filter policy、word、PII、sensitive information、grounding——都在这一个里。不是每个策略建一个 guardrail，而是建一个、按策略分别定义。"
> —— p057 [10:31]

> "它有个参数叫 contextual grounding policy config，在里面定义 grounding threshold 和 relevance threshold——我们已经设好了。别的不用定义，这是 AWS guardrails 的预置功能。跑一下，guardrail 建好了，可以验证。课后记得删掉所有 guardrail。"
> —— p057 [11:58]

> "先准备一个假文档，可以是 PDF，但我现在写成文本。假设这是 PDF 源文档，里面有公司名、成立时间、员工数、总部、CEO、主要市场、主打产品、最新动态、使命。这些是 grounded questions——相对文档而言的：Novartek 何时成立？有答案，是 grounded；CEO 是谁？有；多少员工？245；主打产品？CloudSync。这些是 hallucination questions：营收多少？整篇文档没提营收；有多少客户？没提；股票代码？没提；融资多少？没提。"
> —— p057 [12:27]

> "跑一下。源文档加载了，四条 grounded 问题、四条幻觉问题。先不用 guardrail：system prompt 是「作为业务分析师，基于公司信息作为上下文回答问题」，传幻觉问题。不用 guardrail 时直接调 LLM，不调 guardrail——你看写的是 bedrock.runtime.converse，只给 model id、system prompt、message，这段里没有任何 guardrail 相关的东西。"
> —— p057 [14:17]

> "跑一下。Novatech 何时成立？合法问题，2019。CEO 是谁？合法问题。然后问总营收——它说「根据提供的信息，未说明」，这正确，虽然没用 guardrail 它还是这么说了；但接着「不过我可以给个估计」——不，它幻觉了，你看它虽说没明确说明总营收，还是给了答案，基于假设说营收可能是 500 万美元。这是问题，它在编答案。"
> —— p057 [15:13]

> "有多少企业客户？这里连警告都没有，直接说有 45 家企业客户——源文档从没提企业客户。你看我传了源文档，不是没传，所以它能正常答前两条；但其他几条它在幻觉。融资轮也是，我们没有融资信息，它还是答了，还给了当前公司估值——源文档没提。"
> —— p057 [16:07]

> "这就是我要展示的问题。现在用 guardrail。还是 bedrock runtime.converse、model ID、system prompt、message，但这次用 guardrail config 指定这个 guardrail、max tokens 150，guard content 里传源文档，qualifier 是 grounding source。文本消息也传了、源文档也传了，两者都传好了。跑一下。"
> —— p057 [17:04]

> "它把这些类型的问题拦了。所有幻觉陷阱都被拦了。合法问题——成立时间、CEO、主打产品、员工数——这些在源文档里，通过了。但「Novotek 总营收多少」，它自动显示「我无法对照源文档验证此响应，可能包含你提供材料中不存在的信息」，不给我响应，显示的是 blocked output message。公司估值、融资也显示这个。和上一个 cell 对比：上一个在答，现在在拦。grounding policy 如何帮我们消除 RAG 幻觉，一目了然。"
> —— p057 [18:02]

> "现在要调阈值。有时即使设 0.75 也会幻觉，所以要按用例调。阈值设太低，false positive 少，但幻觉多；设太高，幻觉少，但 false positive 多。所以必须调。"
> —— p057 [18:59]

> "这是 Claude 给的清单：法律和医疗文档设 0.8；普通企业 RAG 设 0.75；内部知识设 0.7；想让模型有创造性、偶尔自己编，可以 0.5。但我建议最稳妥是 0.75，AWS guardrails 在 0.75 表现相当好。"
> —— p057 [19:29]

> "RAG 架构里 grounding guardrail 挂哪？先回顾 RAG：Retrieval Augmented Generation。用户提问，从向量库搜相关文档，据此构建 prompt，LLM 生成答案返回用户。"
> —— p057 [20:25]

> "假设源文档三四页，用户问营收，做向量搜索，看营收向量来自哪，假设来自第三篇，就取第三篇内容（有时来自一篇或多篇）。用用户问题和源文档构建 prompt，发给 LLM，LLM 生成答案返回用户。这整个流程里 guardrail 挂哪？"
> —— p057 [21:23]

> "这是 RAG 通用架构，不谈 S-RAG、C-RAG 那些企业级 RAG，总体架构都一样。guardrail 挂哪？先说一个：用户和 prompt 之间可以挂一个，叫 input guardrail。但这里不用 grounding guardrails，用 content policy、filter policy、word policy、sensitive information policy、topic policy 这些——其他四类用在这里，grounding policy 永远不能用在这里。"
> —— p057 [22:47]

> "从源文档抽取第三篇到 prompt 这里，要不要挂 guardrail？答案：绝不。第一，token 浪费太多，源文档可能很大，额外增加成本；第二，效果也不好。所以是大写的 no。要挂的是这里——把答案发给用户之前，挂 grounding guardrail。所以其他四类可以挂在问题到 LLM 之间，grounding guardrail 挂在 LLM 到用户之间。"
> —— p057 [24:13]

> "规则一：绝不在 retrieval 挂，要挂在 generation。retrieval 是从源文档取文档那一步，绝不挂；generation 是 LLM 生成那一步，挂 guardrail。generation 这里也可以挂其他 guardrail，没问题，其他四类输入输出都能挂，但 grounding 永远挂输出。"
> —— p057 [25:11]

> "规则二：把检索到的文档作为 grounding source 传入。你看 grounding source 这个参数：有两个东西，query 里传问题，grounding source 里传上下文。源文档永远要传进 grounding source。"
> —— p057 [25:41]

> "规则三：把 content filter 和 PII policy 合并到一个 guardrail 里，别建多个 guardrail，建一个，里面列 content filters、topic policies、sensitive information policy、grounding policy——这样更可靠、更省钱、更好。"
> —— p057 [26:40]

> "规则四（重要）：有时第一篇和第四篇文档都被检索到，两篇都要作为源文档传入。要把它们合并——从第一篇取这些信息、第二篇取这些、第三篇取这些，合并后作为源文档传入。多个源文档就合并成一个传入。它们都是文本，直接拼接，用加号合并，作为 grounding source 传入。"
> —— p057 [27:08]

> "你看这是 doc1、doc2、doc3，三个不同文档。这是检索文档的 helper 函数，这是 RAG query 的 helper 函数，我们建一个 RAG。knowledge base 就是源文档，里面第一、第二、第三篇，把它们想成三个 PDF。retrieve document 函数做的是从这些文档里抽取相关文档那一步。"
> —— p057 [28:35]

> "主函数 rag_query：检索文档、拿到 context、定义 model id、用 bedrock runtime.converse、传 model id、system prompt、messages。message 里要传 grounding source——我说过可以加，所以我把所有源文档合并进一个叫 context 的变量，传进 grounding source；query 传问题；整体文本作为问题和上下文传给 LLM。"
> —— p057 [29:33]

> "然后定义 guardrail config：用哪个 guardrail、哪个版本、要 trace（trace 在 Module 1 的 Converse API 里讲过）。inference config 是最大 token 限制。然后给四个问题。源文档里有 CEO、成立时间、主打产品、员工数，但没有股价、没有营收。跑一下。"
> —— p057 [30:02]

> "RAG pipeline：第一个问题 CEO 通过，产品也通过，因为我们有 CloudSync 产品，还告诉我是从哪篇文档检索的。我设了 K=2——K 是 top K，从哪收集信息的前两篇文档。"
> —— p057 [31:01]

> "「Novatech 有多少员工」、公司主打产品——为什么 guardrail 没工作？stop reason 和 turns 说明它通过了。我觉得应该拦。它没拦，可能和这个有关，我不知道为什么。"
> —— p057 [31:30]

> "现在它工作了。我解释一下：看 system prompt 这段文本——「基于这个上下文和你的知识给出具体答案」。在 system prompt 里我定义了「如果有就拦」之类。我跑给你看。"
> —— p057 [32:29]

> "所有东西都会通过，别担心。之前它通过是因为模型没犯错，模型不犯错 guardrail 拦什么？这次它犯错，我不知道为什么，但它不该犯。如果你的情况里它犯错，把 prompt 里这一行删掉就行，然后就能工作。我删掉以防万一。"
> —— p057 [32:58]

> "在 system prompt 里我让它忠于事实，所以它不犯错；模型不犯错，grounding guardrails 怎么工作？模型得犯错、得生成假答案，grounding guardrails 才有活干。但模型没犯错，它说没有这个信息，那 guardrail 怎么工作？"
> —— p057 [33:27]

> "现在它工作了，拦了这条消息，因为没有这个信息——「我无法对照源文档验证此响应」。股价也没列在源文档里，但这里还是通过了，为什么？因为模型没犯错，它告诉我们源文档里没有股价信息，所以 guardrail 不拦。"
> —— p057 [33:56]

> "现在问「Novatech 有多少员工」，员工数据我们有，为什么还拦？因为现在文档太短，只有一行。如果有很大的知识库，能检索到很多文档，请用 PDF 试，用大的 RAG PDF 就正常。这里上下文太少，所以表现差，但只是 demo，展示它怎么工作。你的情况里它工作得很好。"
> —— p057 [34:25]

> "最后两个案例不完美：员工数我们有，却拦了——这是 false positive；股价我们没有，却通过了——这是 false negative。这两个是问题，其他都好。很巧，我们顺便讨论了 false positive 和 false negative。"
> —— p057 [35:23]

> "grounding guardrail 的 trace 结构长什么样？我们看过 guardrails API 的树结构、Converse API 的 trace 结构。grounding 的 trace：Model 1 里之前是 input assessments 在工作，但这里 output assessments 会工作——因为 grounding guardrail 只在输出工作。看 Model 1，之前所有东西都在 input assessment 下，output assessment 是空的，因为那时还没讲 grounding guardrails。"
> —— p057 [35:52]

> "这里 input assessment 不变，output assessment 长这样：guardrail ID 是什么、执行了哪些过滤器、阈值多少、分数多少。两个过滤器 grounding 和 relevance，阈值都设 0.75。grounding 分数低就拦，高于阈值就放；relevance 同理，高就不拦，低就拦。relevance 这里没问题。"
> —— p057 [36:49]

> "可以用这段代码读完整 trace。跑一下。第一个问题 CEO 是谁，通过了，答案是 Novartek 的 Jennifer Walsh，正确，符合源文档。我们看到内部细节：阈值 0.75、0.75，分数是 1.0（因为确实正确），所以不动作。营收那条被拦，输出给了。看 grounding 是 0，没过阈值，所以拦；但 relevance 大于阈值——即使一个失败也会自动拦，因为 relevance 为 true：问题问营收，LLM 可能也按营收生成，但我们看不到 LLM 答案因为拦了，LLM 可能生成了营收 1250 万之类的答案，问题与答案是对应的。"
> —— p057 [37:17]

> "这就是所有问题和 grounding、幻觉控制。本模块讲了 grounding guardrails、如何在 RAG 架构里实现、没有 grounding guardrails 时模型怎么编答案、有 guardrails 时怎么拦。记住 grounding guardrails 永远挂在 LLM 生成步骤，绝不用在输入。Module 4 完成，可以进 Module 5。"
> —— p057 [38:44]

---

## 3. 从零复现

### 3.1 环境与依赖

```bash
# 目录结构
guardrails_lab/
├── .env
├── requirements.txt
├── common.py
├── m3_01_denied_topics.py
├── m3_02_word_policy.py
├── m3_03_custom_regex.py
├── m3_04_pii_apply_guardrail.py
├── m3_05_pii_converse_anonymize.py
└── m4_01_grounding_rag.py
```

`requirements.txt`：

```
boto3==1.34.144
botocore==1.34.144
python-dotenv==1.0.1
```

安装：

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`.env`（**环境变量名写全**）：

```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
AWS_ACCESS_KEY_ID=你的AK
AWS_SECRET_ACCESS_KEY=你的SK
```

> 讲师在 p056 [02:55] 与 p057 [10:03] 都强调：装 boto/boto3/botocore，设 region、model name，建 `bedrock` 与 `bedrock-runtime` 两个客户端。AWS 凭证建议用 IAM 角色或 `aws configure`，`.env` 只是本地演示方便。

### 3.2 公共模块 `common.py`

三个 helper 函数（讲师 p056 [03:24] 明确说：①建 guardrail ②apply guardrail 并判断拦/放 ③打印结果）：

```python
import os, json, boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

bedrock = boto3.client("bedrock", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)


def create_guardrail(name, description, blocked_input, blocked_output,
                     topic_policy_config=None, word_policy_config=None,
                     sensitive_info_config=None, content_policy_config=None,
                     contextual_grounding_config=None):
    """Helper 1：创建 guardrail，返回 guardrailId 与 version。"""
    kwargs = dict(
        name=name,
        description=description,
        blockedInputMessaging=blocked_input,
        blockedOutputsMessaging=blocked_output,
    )
    if topic_policy_config:
        kwargs["topicPolicyConfig"] = topic_policy_config
    if word_policy_config:
        kwargs["wordPolicyConfig"] = word_policy_config
    if sensitive_info_config:
        kwargs["sensitiveInformationPolicyConfig"] = sensitive_info_config
    if content_policy_config:
        kwargs["contentPolicyConfig"] = content_policy_config
    if contextual_grounding_config:
        kwargs["contextualGroundingPolicyConfig"] = contextual_grounding_config

    resp = bedrock.create_guardrail(**kwargs)
    print(f"[create_guardrail] id={resp['guardrailId']} version={resp['version']}")
    return resp["guardrailId"], resp["version"]


def apply_guardrail(guardrail_id, guardrail_version, text, source="INPUT"):
    """Helper 2：apply_guardrail 检查内容，返回原始响应。"""
    resp = bedrock_runtime.apply_guardrail(
        guardrailIdentifier=guardrail_id,
        guardrailVersion=guardrail_version,
        source=source,                      # "INPUT" 或 "OUTPUT"
        content=[{"text": {"text": text}}],
    )
    return resp


def print_result(resp, label=""):
    """Helper 3：打印 action / 输出文本 / 各 assessment。"""
    print(f"\n===== {label} =====")
    print("action:", resp.get("action"))    # GUARDRAIL_INTERVENED / NONE
    for out in resp.get("outputs", []):
        print("output text:", out.get("text"))
    for a in resp.get("assessments", []):
        print("assessment:", json.dumps(a, ensure_ascii=False, default=str))


def delete_guardrail(guardrail_id):
    """课后清理，讲师 p057 [12:27] 要求删掉所有 guardrail。"""
    try:
        bedrock.delete_guardrail(guardrailIdentifier=guardrail_id)
        print(f"[delete_guardrail] {guardrail_id} deleted")
    except ClientError as e:
        print(f"[delete_guardrail] {e}")
```

> 说明：`apply_guardrail` 的 `source` 取值 `INPUT`/`OUTPUT`；`action` 字段在真实响应里是 `GUARDRAIL_INTERVENED` 或 `NONE`。讲师口述里的「intervene = true/false」对应这个字段。若你的 SDK 版本字段名不同，**该字段名请以实际输出为准**。

### 3.3 P056 步骤一：Denied Topics（= Topic Policy）

1. 建 guardrail，`topicPolicyConfig` 里放两个 topic：`legal advice`、`medical advice`，`type` 都是 `DENY`，每个 topic 给**定义 + 5~6 条 examples**（讲师 p056 [08:27] 强调：弱定义 → 弱结果；至少 5–10 条好例子）。
2. 用 `apply_guardrail` 跑 8 条 dummy prompt：法律类、医疗类、代码类、边界类（「用 Python 做法律文档解析器」「把应用连到医疗记录」）。
3. 观察：边界类应放行（是编程问题）；「我起了个疹子一直不退」这类**应拦却放行** → 讲师现场判定为 **false negative**，并给出改进方向：补定义、补例子。

### 3.4 P056 步骤二：Word Policy（自定义词表 + 托管脏话表）

1. 新建 guardrail，`wordPolicyConfig` 里：
   - `customWordsConfig`：`competitor x`、`competitor y`、两个名字；
   - `managedWordListsConfig`：`type: "PROFANITY"`（AWS 托管，多语言）。
2. 测：`computer x` 被拦；`computer xyz` 放行（**精确匹配，逐字符**）；脏话句先弱后强，强的被拦。

### 3.5 P056 步骤三：自定义正则（custom regex）

1. 新建 guardrail，配置放 `sensitiveInformationPolicyConfig` 的 `regexesConfig`（**注意：正则属于敏感信息策略，不属于 word policy**，讲师 p056 [16:58] 明确纠正）。
2. 三条正则：`emp`（employee ID）、internal ticket、AWS access key 格式。
3. `action` 分别设 `ANONYMIZE` / `ANONYMIZE` / `BLOCK`，跑对比：前两条输出被打码（`employee ID` 变成占位符），第三条整条被拦。
4. 关键结论：**自定义正则在 `apply_guardrail` 下 `ANONYMIZE` 可用**（因为是你自己建的）。

### 3.6 P056 步骤四：PII（apply_guardrail 版）

1. 新建 guardrail，`sensitiveInformationPolicyConfig` 的 `piiEntitiesConfig` 列 AWS 预置实体：`NAME`、`EMAIL`、`USERNAME`、`DRIVER_ID`、`US_SOCIAL_SECURITY_NUMBER`、`CREDIT_CARD_NUMBER`、`AWS_ACCESS_KEY`、`AWS_SECRET_KEY`、`IP_ADDRESS` 等，`action: BLOCK`。
2. 测姓名/邮箱/电话/IP/用户名/AK/安全句。全部 `BLOCK` 生效。
3. **反例演示**：把 `NAME` 改成 `ANONYMIZE` 再跑 → 放行、无动作。结论：**`apply_guardrail` 不支持预置实体的 `anonymize`**。
4. 印度手机号：AWS 预置里没有 → 必须用自定义正则（讲师 p056 [26:54]）。

### 3.7 P056 步骤五：PII（converse 版，带 anonymize）—— 讲师布置的作业

用 `bedrock_runtime.converse` + `guardrailConfig`，把 `NAME` 设 `ANONYMIZE`，验证打码后仍能拿到 LLM 回答（对应讲师 p056 [32:09] 的 homework）。

### 3.8 P057 步骤一：Grounding Policy 建 guardrail

1. `create_guardrail` 传 `contextualGroundingConfig`：

```python
contextual_grounding_config={
    "filters": [
        {"type": "GROUNDING",   "threshold": 0.75},
        {"type": "RELEVANCE",   "threshold": 0.75},
    ]
}
```

2. 讲师 p057 [10:31] 强调：**不要每个策略建一个 guardrail，建一个，里面按策略分别定义**；`blockedInputMessaging` 虽不会被触发（grounding 只在输出），仍要填，因为一个 guardrail 里还可能有别的策略。

### 3.9 P057 步骤二：无 guardrail 基线（看幻觉）

用 `converse` 只传 modelId / system prompt / messages，**不传 guardrailConfig**，问 4 条幻觉问题（营收、客户数、股票代码、融资）。观察模型编造「营收约 500 万」「45 家企业客户」「当前估值」等。

### 3.10 P057 步骤三：有 guardrail（拦幻觉）

同一个 `converse` 调用，加 `guardrailConfig`：

```python
guardrailConfig={
    "guardrailIdentifier": guardrail_id,
    "guardrailVersion": guardrail_version,
    "trace": "enabled",
    "guardContent": [{"text": {"text": source_doc, "qualifiers": ["grounding_source"]}}],
}
```

并在 `messages` 里同时传用户问题（`qualifiers: ["query"]`）。讲师 p057 [17:04]：max tokens 150；源文档放 `grounding_source`，问题放 `query`。

### 3.11 P057 步骤四：RAG pipeline（多文档合并 + grounding）

1. 三个「PDF」文档（demo 用字符串模拟），`retrieve_documents(query, k=2)` 做 top-K 检索。
2. 把检索到的多篇**合并成一个 `context` 字符串**（讲师 p057 [27:08]：多个源文档必须合并成一个传入，直接拼接）。
3. `rag_query` 里 `converse` + `guardrailConfig`，`guardContent` 的 `grounding_source` 传合并后的 `context`，`query` 传问题。
4. 跑 4 条问题，观察 false positive（员工数有数据却被拦）与 false negative（股价无数据却放行），讲师 p057 [35:23] 明确说这是 demo 文档太短导致，**真实场景请用大 PDF 知识库**。

### 3.12 启动命令

```bash
python m3_01_denied_topics.py
python m3_02_word_policy.py
python m3_03_custom_regex.py
python m3_04_pii_apply_guardrail.py
python m3_05_pii_converse_anonymize.py
python m4_01_grounding_rag.py
```

每个脚本跑完会打印 `guardrailId`，**课后用 `delete_guardrail(id)` 清理**（讲师 p057 [12:27]）。

---

## 4. 完整代码

> 说明：本段课程**没有提供 OCR 文本**（清单里 OCR 为空），以下代码依据逐字稿描述的参数名与流程编写，字段名以 AWS Bedrock Guardrails 公开 API 为准；若与你实际 SDK 输出不一致，**该字段名请以实际输出为准**。逐字稿未提到的参数一律不编造。

### 4.1 `m3_01_denied_topics.py`

```python
from common import create_guardrail, apply_guardrail, print_result, delete_guardrail

GUARDRAIL_NAME = "denied-topics-demo"
BLOCKED_IN = "抱歉，我只能回答编程相关问题。"
BLOCKED_OUT = "抱歉，我只能回答编程相关问题。"

topic_policy_config = {
    "topicsConfig": [
        {
            "name": "legal-advice",
            "definition": (
                "Requests for legal advice, legal opinions, interpretation of laws, "
                "legal guidance, constitutional matters, contracts, litigation, "
                "or any question that requires a licensed attorney."
            ),
            "examples": [
                "Can I sue my landlord for not returning the deposit?",
                "Is it legal to break a contract I signed?",
                "How do I file a small claims case?",
                "What does the constitution say about my right to protest?",
                "Should I sign this NDA?",
                "How do I appeal a court decision?",
            ],
            "type": "DENY",
        },
        {
            "name": "medical-advice",
            "definition": (
                "Requests for medical advice, diagnosis, dosage of medicine, "
                "treatment plans, interpretation of lab results, or any question "
                "that requires a licensed physician."
            ),
            "examples": [
                "What dosage of ibuprofen should I take?",
                "I have a rash that won't go away, what could it be?",
                "Is this mole dangerous?",
                "Can I stop taking my antibiotics early?",
                "What medicine helps with chest pain?",
                "My child has a fever, what should I do?",
            ],
            "type": "DENY",
        },
    ]
}

guardrail_id, guardrail_version = create_guardrail(
    name=GUARDRAIL_NAME,
    description="Coding assistant that blocks legal and medical advice.",
    blocked_input=BLOCKED_IN,
    blocked_output=BLOCKED_OUT,
    topic_policy_config=topic_policy_config,
)

prompts = [
    # 法律类
    "Can I sue my landlord for not returning the deposit?",
    # 医疗类
    "What dosage of ibuprofen should I take?",
    # 代码类
    "How do I reverse a linked list in Python?",
    # 边界类：legal 在里面，但是编程问题
    "I want to build a legal document parser in Python, where do I start?",
    # 边界类：medical 在里面，但是编程问题
    "How do I connect my app to a medical records API?",
    # 医疗类（讲师现场判定为 false negative）
    "I have a rash that won't go away, what could it be?",
    # 医疗类（讲师现场判定为 false negative）
    "Is this mole dangerous?",
    # 代码类
    "Explain Big-O notation with an example.",
]

for p in prompts:
    resp = apply_guardrail(guardrail_id, guardrail_version, p, source="INPUT")
    print_result(resp, label=p)

delete_guardrail(guardrail_id)
```

### 4.2 `m3_02_word_policy.py`

```python
from common import create_guardrail, apply_guardrail, print_result, delete_guardrail

word_policy_config = {
    "wordsConfig": [
        {"text": "competitor x"},
        {"text": "competitor y"},
        {"text": "rival brand"},
        {"text": "other vendor"},
    ],
    "managedWordListsConfig": [
        {"type": "PROFANITY"}   # AWS 托管脏话表，多语言
    ],
}

guardrail_id, guardrail_version = create_guardrail(
    name="word-policy-demo",
    description="Blocks competitor words and profanity.",
    blocked_input="该消息包含不允许的词。",
    blocked_output="该消息包含不允许的词。",
    word_policy_config=word_policy_config,
)

prompts = [
    "How does competitor x handle authentication?",
    "Is competitor y better than your product?",
    "How does competitor xyz handle authentication?",   # 精确匹配，应放行
    "How do I write a for loop in Python?",
    "This damn code keeps breaking.",                    # 弱脏话，可能放行
    "This f***ing code keeps breaking.",                 # 强脏话，应拦
    "Explain async/await in JavaScript.",
]

for p in prompts:
    resp = apply_guardrail(guardrail_id, guardrail_version, p, source="INPUT")
    print_result(resp, label=p)

delete_guardrail(guardrail_id)
```

### 4.3 `m3_03_custom_regex.py`

```python
from common import create_guardrail, apply_guardrail, print_result, delete_guardrail

sensitive_info_config = {
    "regexesConfig": [
        {
            "name": "employee-id",
            "description": "Matches employee IDs containing emp.",
            "pattern": r"emp[-\s]?\d{3,6}",
            "action": "ANONYMIZE",
        },
        {
            "name": "internal-ticket",
            "description": "Matches internal ticket numbers.",
            "pattern": r"ticket[-\s]?\d{6,9}",
            "action": "ANONYMIZE",
        },
        {
            "name": "aws-access-key",
            "description": "Matches AWS access key format.",
            "pattern": r"AKIA[0-9A-Z]{16}",
            "action": "BLOCK",
        },
    ]
}

guardrail_id, guardrail_version = create_guardrail(
    name="custom-regex-pattern-demo",
    description="Custom regex for employee ID, ticket, AWS key.",
    blocked_input="消息包含不允许的敏感信息。",
    blocked_output="消息包含不允许的敏感信息。",
    sensitive_info_config=sensitive_info_config,
)

prompts = [
    "Please look into this employee emp-12345.",
    "This is related to ticket 202500145.",
    "My AWS key is AKIAIOSFODNN7EXAMPLE.",
    "How do I connect to an existing database?",
]

for p in prompts:
    resp = apply_guardrail(guardrail_id, guardrail_version, p, source="INPUT")
    print_result(resp, label=p)

delete_guardrail(guardrail_id)
```

### 4.4 `m3_04_pii_apply_guardrail.py`

```python
from common import create_guardrail, apply_guardrail, print_result, delete_guardrail

pii_entities = [
    "NAME", "EMAIL", "USERNAME", "DRIVER_ID",
    "US_SOCIAL_SECURITY_NUMBER", "CREDIT_CARD_NUMBER",
    "AWS_ACCESS_KEY", "AWS_SECRET_KEY", "IP_ADDRESS",
]

sensitive_info_config = {
    "piiEntitiesConfig": [
        {"type": t, "action": "BLOCK"} for t in pii_entities
    ]
}

guardrail_id, guardrail_version = create_guardrail(
    name="pii-guardrail",
    description="Blocks PII entities.",
    blocked_input="你的消息包含信用卡、密码等敏感信息，请移除后重试。",
    blocked_output="你的消息包含信用卡、密码等敏感信息，请移除后重试。",
    sensitive_info_config=sensitive_info_config,
)

prompts = [
    "My name is John Smith.",
    "My email is john@example.com.",
    "Call me at +1-555-123-4567.",          # 美国格式
    "My IP is 192.168.1.1.",
    "My username is jsmith.",
    "My AWS access key is AKIAIOSFODNN7EXAMPLE.",
    "How do I write a Python function?",
]

for p in prompts:
    resp = apply_guardrail(guardrail_id, guardrail_version, p, source="INPUT")
    print_result(resp, label=p)

delete_guardrail(guardrail_id)
```

### 4.5 `m3_05_pii_converse_anonymize.py`（作业：converse + anonymize）

```python
from common import bedrock_runtime, MODEL_ID, create_guardrail, delete_guardrail

sensitive_info_config = {
    "piiEntitiesConfig": [
        {"type": "NAME", "action": "ANONYMIZE"},
        {"type": "EMAIL", "action": "ANONYMIZE"},
        {"type": "CREDIT_CARD_NUMBER", "action": "ANONYMIZE"},
        {"type": "US_SOCIAL_SECURITY_NUMBER", "action": "ANONYMIZE"},
    ]
}

guardrail_id, guardrail_version = create_guardrail(
    name="pii-anonymize-converse",
    description="Anonymize PII via Converse API.",
    blocked_input="消息包含敏感信息。",
    blocked_output="消息包含敏感信息。",
    sensitive_info_config=sensitive_info_config,
)

system_prompt = "You are a helpful customer support agent for a restaurant."
user_msg = (
    "Hi, my name is John Smith, email john@example.com, "
    "I paid with card 4111-1111-1111-1111 and my SSN is 123-45-6789. "
    "My order is not working, can you help?"
)

resp = bedrock_runtime.converse(
    modelId=MODEL_ID,
    system=[{"text": system_prompt}],
    messages=[{"role": "user", "content": [{"text": user_msg}]}],
    guardrailConfig={
        "guardrailIdentifier": guardrail_id,
        "guardrailVersion": guardrail_version,
        "trace": "enabled",
    },
    inferenceConfig={"maxTokens": 300},
)

print("stopReason:", resp.get("stopReason"))
print("output:", resp["output"]["message"]["content"][0]["text"])
print("trace:", resp.get("trace"))

delete_guardrail(guardrail_id)
```

### 4.6 `m4_01_grounding_rag.py`

```python
from common import bedrock_runtime, MODEL_ID, create_guardrail, delete_guardrail

# ---------- 1. 建 grounding guardrail ----------
contextual_grounding_config = {
    "filters": [
        {"type": "GROUNDING", "threshold": 0.75},
        {"type": "RELEVANCE", "threshold": 0.75},
    ]
}

guardrail_id, guardrail_version = create_guardrail(
    name="grounding-guardrail",
    description="Grounding + relevance filters for RAG.",
    blocked_input="输入被拦截。",
    blocked_output="我无法对照源文档验证此响应，可能包含你提供材料中不存在的信息。",
    contextual_grounding_config=contextual_grounding_config,
)

# ---------- 2. 假文档（demo 用字符串模拟 PDF） ----------
DOCS = [
    "Novatech was founded in 2019. It has 245 employees. "
    "Headquarters is in Seattle. CEO is Jennifer Walsh. "
    "Primary market is North America. Main product is CloudSync. "
    "Latest update: CloudSync 3.0 launched. Mission: simplify cloud for SMBs.",
    "Novatech CloudSync integrates with AWS, Azure and GCP. "
    "Pricing starts at $29 per month per team.",
    "Novatech support is available 24/7 for enterprise plans.",
]

def retrieve_documents(query, k=2):
    """极简 top-K：按关键词命中数排序，demo 用。"""
    scored = []
    for d in DOCS:
        score = sum(1 for w in query.lower().split() if w in d.lower())
        scored.append((score, d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:k]]

# ---------- 3. RAG query ----------
def rag_query(question, k=2):
    docs = retrieve_documents(question, k=k)
    context = " ".join(docs)          # 多文档合并成一个 grounding_source

    resp = bedrock_runtime.converse(
        modelId=MODEL_ID,
        system=[{"text": "You are a business analyst. Answer based on the context."}],
        messages=[{
            "role": "user",
            "content": [
                {"guardContent": {"text": {"text": context, "qualifiers": ["grounding_source"]}}},
                {"guardContent": {"text": {"text": question, "qualifiers": ["query"]}}},
            ],
        }],
        guardrailConfig={
            "guardrailIdentifier": guardrail_id,
            "guardrailVersion": guardrail_version,
            "trace": "enabled",
        },
        inferenceConfig={"maxTokens": 150},
    )
    return resp

questions = [
    "Who is the CEO of Novatech?",
    "What is the main product of Novatech?",
    "How many employees does Novatech have?",
    "What is the stock price of Novatech?",
    "What was the Novatech total revenue?",
]

for q in questions:
    r = rag_query(q)
    print("\nQ:", q)
    print("stopReason:", r.get("stopReason"))
    print("output:", r["output"]["message"]["content"][0]["text"])
    print("trace:", r.get("trace"))

delete_guardrail(guardrail_id)
```

---

## 5. 逐行解释

**`common.py` 的 `create_guardrail`**：把 `topicPolicyConfig` / `wordPolicyConfig` / `sensitiveInformationPolicyConfig` / `contentPolicyConfig` / `contextualGroundingPolicyConfig` 都做成可选参数，是因为讲师 p057 [10:31] 反复强调「**一个 guardrail 里按策略分别定义，不要每个策略建一个**」。这样后续所有脚本共用同一个建 guardrail 的入口。

**`apply_guardrail` 的 `source`**：`INPUT` 表示检查用户输入，`OUTPUT` 表示检查模型输出。grounding 永远只用 `OUTPUT`（讲师 p057 [09:04]：查 grounding 和 relevance 都需要答案，答案只在 LLM 之后产生）。

**`print_result` 里的 `action`**：讲师口述的「intervene = true/false」对应响应里的 `action` 字段（`GUARDRAIL_INTERVENED` / `NONE`）。**该字段名请以实际输出为准**。

**`m3_01` 的 topic 定义**：讲师 p056 [08:27] 说弱定义（只写「legal stuff」）会得到弱结果，好定义要写「请求法律建议、法律意见、法律解释、法律指引、宪法相关」；例子至少 5–10 条。代码里 legal 给 6 条、medical 给 6 条，正好落在讲师要求的下限。`type: DENY` 就是 denied topic。

**`m3_01` 的边界 prompt**：`"I want to build a legal document parser in Python"` 与 `"How do I connect my app to a medical records API"` 是讲师 p056 [09:54] 特意放的——含 legal/medical 字样但本质是编程问题，**语义匹配应放行**。而 `"I have a rash..."`、`"Is this mole dangerous?"` 是医疗问题却被放行，讲师现场判为 **false negative**，并说「也许定义和例子没覆盖到，补更好的定义/例子就能拦」。

**`m3_02` 的 `wordsConfig` vs `managedWordListsConfig`**：前者是你自己的词表（`competitor x` 等），后者是 AWS 托管（`type: PROFANITY`，多语言）。讲师 p056 [11:48] 说托管脏话表「想加就加、想删就删」。`competitor xyz` 放行是因为**逐字符精确匹配**——讲师 p056 [06:34] 用 `claude` vs `claude code` 讲过同一道理。

**`m3_03` 的 `regexesConfig`**：放在 `sensitiveInformationPolicyConfig` 下（讲师 p056 [16:58] 明确纠正：自定义正则属于敏感信息，不属于 word policy）。`action` 两种：`ANONYMIZE`（打码放行）、`BLOCK`（整条拦）。`emp` 正则用 `emp[-\s]?\d{3,6}` 覆盖 `emp-12345`；AWS key 用 `AKIA[0-9A-Z]{16}` 是公开格式。讲师 p056 [16:29] 说这些 pattern 可以让任何 LLM 生成。

**`m3_04` 的 `piiEntitiesConfig`**：全是 AWS 预置实体（讲师 p056 [25:29] 列了 name、email、username、driver ID、SSN、credit card、access key、secret key）。全部 `BLOCK`。讲师 p056 [26:54] 特别指出**印度手机号 AWS 预置里没有，必须用自定义正则**——所以代码里没放印度号码，避免误导。

**`m3_04` 的反例**：把 `NAME` 改成 `ANONYMIZE` 再跑会放行、无动作——这是讲师 p056 [28:19] 现场演示的「**apply_guardrail 不支持预置实体的 anonymize**」。唯一例外是自定义正则（`m3_03`）在 `apply_guardrail` 下能 `anonymize`，因为是你自己建的。

**`m3_05` 的 `converse` + `guardrailConfig`**：这是讲师 p056 [32:09] 布置的作业——用 converse API 实现 PII redaction，因为**只有 converse/invoke_model 支持预置实体的 `anonymize`**。`trace: "enabled"` 对应讲师 p057 [30:02] 说的「要 trace，Module 1 的 Converse API 讲过」。

**`m4_01` 的 `contextualGroundingConfig`**：两个独立 filter，`GROUNDING` 与 `RELEVANCE`，阈值都 0.75。讲师 p057 [19:29] 给的清单：法律/医疗 0.8、普通企业 RAG 0.75、内部知识 0.7、要创造性 0.5，**最稳妥 0.75**。0.75 是讲师 p057 [10:31] 说的「很优化、很合适的数」。

**`m4_01` 的 `retrieve_documents`**：极简关键词命中排序，模拟向量检索的 top-K。讲师 p057 [31:01] 说 `K=2` 是「从哪收集信息的前两篇文档」。真实项目应换成向量库，**课里没讲具体向量库实现**。

**`m4_01` 的 `context = " ".join(docs)`**：讲师 p057 [27:08] 的规则四——多个源文档必须**合并成一个**传入 `grounding_source`，直接拼接（「用加号合并」）。代码用 `join` 等价实现。

**`m4_01` 的 `guardContent` 双 qualifier**：`grounding_source` 传合并后的 context，`query` 传问题。讲师 p057 [25:41] 规则二：源文档永远传进 `grounding_source`，问题传 `query`。

**`m4_01` 的 system prompt**：讲师 p057 [32:58] 现场发现「system prompt 里让它忠于事实 → 模型不犯错 → grounding guardrail 没活干」，于是**删掉那行**让模型可能犯错，grounding 才有东西可拦。代码里 system prompt 故意保持中性（「Answer based on the context」），不复述「stay true to facts」。

**`m4_01` 的 false positive / false negative**：讲师 p057 [35:23] 现场承认——「员工数有数据却被拦」是 false positive，「股价无数据却放行」是 false negative，原因是 demo 文档太短（一行），**真实场景请用大 PDF 知识库**。

**trace 结构**：讲师 p057 [35:52] 说 grounding 的 trace 里 **output assessments 才有内容**（input assessments 为空或不变），里面有 guardrail ID、执行的 filters、阈值、分数。`trace: "enabled"` 打开后 `resp["trace"]` 里能看到这些。**具体字段名请以实际输出为准**。

**在 JS/Node 里对应什么**：`apply_guardrail` 对应一次 HTTP 调用（`@aws-sdk/client-bedrock-runtime` 的 `ApplyGuardrailCommand`）；`converse` 对应 `ConverseCommand`；`guardrailConfig` 就是请求体里的一个字段。没有锁/事务/并发问题——guardrail 是无状态服务，每次调用独立。若你在 Node 里并发调 `converse`，注意 Bedrock 的 TPS 限流，用 `p-limit` 之类控制并发即可。

---

## 6. 复现检查清单

- [ ] `pip install -r requirements.txt` 成功，`boto3`/`botocore` 版本一致
- [ ] `.env` 里 `AWS_REGION`、`BEDROCK_MODEL_ID`、AK/SK 齐全，`aws sts get-caller-identity` 能通
- [ ] `common.py` 里 `bedrock` 与 `bedrock_runtime` 两个 client 都能建
- [ ] `m3_01`：legal/medical 类被拦，两条边界编程问题放行，`"I have a rash..."` 复现 false negative
- [ ] `m3_02`：`competitor x` 拦、`competitor xyz` 放、强脏话拦、弱脏话放
- [ ] `m3_03`：employee ID 与 ticket 被打码（输出里看不到原值），AWS key 整条被拦
- [ ] `m3_04`：姓名/邮箱/电话/IP/用户名/AK 全部 `BLOCK`
- [ ] `m3_04` 反例：`NAME` 改 `ANONYMIZE` 后放行、无动作（验证 apply_guard
_guardrail 不支持预置实体的 `ANONYMIZE`）

- [ ] `m3_05`：converse 版 PII anonymize 生效，LLM 仍能正常回答，且返回文本里看不到明文姓名、邮箱、卡号
- [ ] `m4_01`：CEO 是谁、主打产品两条放行；营收 / 股价 / 融资至少一条被拦，拦截文案等于 `blockedOutputsMessaging`
- [ ] `m4_01` 打开 `trace` 后，`resp["trace"]` 里能看到 **output assessments** 里 GROUNDING 与 RELEVANCE 各自的分数与 0.75 阈值
- [ ] `m4_01` 复现讲师现场承认的两个 demo 局限：员工数有数据却被拦（false positive）、股价无数据却放行（false negative）
- [ ] 不要对 grounding guardrail 裸调 `apply_guardrail`（会失败或被拒），必须走 `converse`
- [ ] 所有脚本跑完后 `delete_guardrail(guardrail_id)` 全部清理干净，AWS 控制台 Guardrails 列表为空

---

## 7. 课里没讲但你会撞上的

这一节专门收「讲师一句话带过、但你真跑时会卡住」的地方。凡属讲师明确说过的，标原话；凡属课里没讲的，明确写「课里没讲」，并给出基于实际 API 行为的判断。

### 7.1 预置 PII 实体把 `BLOCK` 改成 `ANONYMIZE` 会**静默放行**，不报错

这是最坑的一条。`m3_04` 里你把 `NAME` 改成 `ANONYMIZE` 再跑，`apply_guardrail` **不报错、不警告、`action` 直接是放行**——讲师在现场就是这么演示的：

> "你看，它放行了，没做任何动作。因为 anonymize 在 apply guardrail 下不工作。再修一下：只有自定义正则——因为是你自己建的——才能在 apply guardrail 下用 anonymize；用 converse API 时 anonymize 和 block 随时都能用，没有这个限制。"
> —— p056 [28:19]

![p056 21:27 讲师讲 PII 与 anonymize/block 的区别，屏幕上是 PII 实体定义](images/p056_1287s.jpg)

所以写脚本时，**不要靠「没有报错」来判断配置是否生效**，必须看 `action` 字段、看输出文本里原文有没有被打码。同理，自定义正则那条 `ANONYMIZE` 生效是因为它是自定义建出来的，别把这条经验外推到预置实体上。

### 7.2 自定义正则生效，但 `BLOCK` 和 `ANONYMIZE` 的可见行为完全不同

`m3_03` 三条正则，前两条 `ANONYMIZE`、第三条 `BLOCK`，跑出来是两种完全不同的结果形态：

> "第一条输入是「please look into this employee」，guardrail intervened，说明执行了，输出是「please look into the issue for the employee ID」——employee ID 被打码了，employee ID 不再发给 LLM。……AWS key 我们设的是 block 不是 anonymize，所以它直接被拦了。"
> —— p056 [19:19]

![p056 19:11 apply guardrail 下 custom regex 的 anonymize 与 block 对比输出](images/p056_1151s.jpg)

写断言时要注意：`ANONYMIZE` 的情况 `outputs` 里有改写后的文本，你要检查的是「原文是否还在」；`BLOCK` 的情况输出里只剩拦截文案，你要检查的是 `outputs` 文本是否等于 `blockedInputMessaging`。

### 7.3 自定义正则必须写在 `sensitiveInformationPolicyConfig` 里，不是 word policy

这是讲师现场专门纠正过的一个位置错误：

> "现在我建另一个 guardrail，名字叫 regex patterns，填描述、input message、output message，配置放在 sensitive information policy config 里——注意，自定义正则属于敏感信息部分，不属于 word policy。"
> —— p056 [16:58]

![p056 16:56 讲师配置自定义正则 action，界面上 action 下拉是 BLOCK/ANONYMIZE](images/p056_1016s.jpg)

如果你按直觉把 `regexesConfig` 塞进 `wordPolicyConfig`，创建会失败。**建 guardrail 的报错信息里一般会指出字段名不合法**，但从报错文本很难一眼看出「放错父级」，因为字段本身名字是对的，只是挂错了树。我的建议是：先跑 `m3_03` 的最小版本（只放一条 regex）确认字段可被接受，再加第二、第三条。

### 7.4 印度手机号这类地区性格式，AWS 预置里没有

> "这条传了电话——但这个电话是美国格式，印度格式 AWS 里没有，印度格式得用自定义正则。"
> —— p056 [26:54]

![p056 25:58 讲师打开预置 PII 实体配置，逐个勾选 name/email/username 等](images/p056_1558s.jpg)

课里没讲预置实体到底覆盖了哪些国家/地区的号码格式，也没给完整清单。实践判断：**凡是区域性强格式（手机号、身份证/税号、车牌、邮编）都当成「需要自定义正则」来处理**，不要赌预置能覆盖。`m3_04` 我刻意没放印度号码，就是为了不让读者误以为预置能用。

### 7.5 Grounding 用不了 `apply_guardrail`，只能用 `converse` / `invoke_model`

> "grounding policy 只能挂到 RAG 上，而且不能用 apply guardrail API，只能用 Converse API。"
> —— p057 [00:00]

![p057 11:53 讲师创建 grounding guardrail，配置 contextual grounding policy 的 filters 与阈值](images/p057_0713s.jpg)

课里没讲具体会报什么错。实际调的时候，把 `contextualGroundingPolicyConfig` 建的 guardrail 拿去跑 `apply_guardrail`，会有两种可能：被拒（提示这个策略不支持该 API），或者跑起来但 assessments 里没有 grounding 相关条目。**两种都要当成「不能用」处理**，不要因为「没报错」就以为生效了。判断标准很明确：看 `output` / `assessments` 里有没有 GROUNDING 与 RELEVANCE 的分数。

### 7.6 模型自己不犯错时，grounding 拦不住任何东西

这是讲师现场调试时最真实的坑：

> "之前它通过是因为模型没犯错，模型不犯错 guardrail 拦什么？这次它犯错，我不知道为什么，但它不该犯。如果你的情况里它犯错，把 prompt 里这一行删掉就行，然后就能工作。我删掉以防万一。"
> —— p057 [32:58]

他原来的 system prompt 里写了「忠于事实」，模型于是老老实实说「文档里没有这个信息」——那 grounding 自然打满分、直接放行。所以：

- **想验证 grounding 真的在工作**，system prompt 不能写「不知道就直说」这类约束，否则你永远看到「全部通过」；
- 这跟安全无关，跟「测试用例是否真的能触发被测逻辑」有关。**在 JS/Node 里对应**：就像你测一个表单校验，输入永远是合法值时，校验函数一行都不会执行——你得喂非法输入。

### 7.7 demo 文档太短会制造 false positive / false negative，别把 demo 结论当生产结论

> "现在问「Novatech 有多少员工」，员工数据我们有，为什么还拦？因为现在文档太短，只有一行。如果有很大的知识库，能检索到很多文档，请用 PDF 试，用大的 RAG PDF 就正常。这里上下文太少，所以表现差，但只是 demo，展示它怎么工作。"
> —— p057 [34:25]

![p057 30:21 RAG pipeline 运行结果，几条问题通过、几条被 grounding 拦下](images/p057_1821s.jpg)

课里给的两个具体观测：

- **false positive**：员工数在文档里有，却被拦；
- **false negative**：股价文档里没有，却放行（因为模型自己说了「没有这个信息」）。

讲师现场的评价是「这两个是问题，其他都好」。也就是说，**同一套 0.75 阈值在不同语料规模下表现会差很多**，你在自己项目里调参前，先把语料从「一行字符串」换成真实的 PDF 分块，否则调出来的数是假的。

### 7.8 `grounding_source` 只能是一个字符串，多文档必须自己合并

> "有时第一篇和第四篇文档都被检索到，两篇都要作为源文档传入……它们都是文本，直接拼接，用加号合并，作为 grounding source 传入。"
> —— p057 [27:08]

![p057 27:43 讲师演示把多篇检索结果合并进 context 变量，再传进 grounding source](images/p057_1663s.jpg)

`converse` 的 `guardContent` 里可以放多个 item，但 `grounding_source` 语义上是「一份上下文」，我的实现是 `context = " ".join(docs)`。课里没讲用的是什么分隔符、也没讲加不加文档标题。**实践建议**：在每篇前加一个可识别的边界（如 `\n--- doc 3 ---\n`），既能帮模型定位，也方便你排查「到底是哪篇没被用上」。课里没讲这点，属于补充。

### 7.9 绝对不要在 retrieval 之后、prompt 组装之前挂 guardrail

> "从源文档抽取第三篇到 prompt 这里，要不要挂 guardrail？答案：绝不。第一，token 浪费太多，源文档可能很大，额外增加成本；第二，效果也不好。所以是大写的 no。"
> —— p057 [24:13]

![p057 25:04 讲师在白板上讲 RAG 架构里 guardrail 的挂载位置，retrieval 段画了「never」](images/p057_1504s.jpg)

这条在生产上非常贵。以 200 页 PDF 切出 30 个 chunk、每次取 top-5 为例，如果在接 LLM 前对整段 context 做一次 `apply_guardrail`，你等于把同一批文本多付一次 token 费，而且延迟也翻倍。**正确做法**：input 侧只对**用户问题**做 guardrail（topic / word / PII / content 四类），context 原样进 prompt，最后在 LLM 输出侧挂 grounding。

### 7.10 `guardrailConfig` 必须带 `guardrailVersion`，且 trace 是可选开关

> "然后定义 guardrail config：用哪个 guardrail、哪个版本、要 trace。"
> —— p057 [30:02]

![p057 17:09 讲师在 converse 调用里填 guardrailConfig，指定 guardrail 与 max tokens 150](images/p057_1029s.jpg)

课里没讲版本号从哪来。实际是 `create_guardrail` 返回的 `version`（我第一次返回 `DRAFT`，发布后才变成数字版本），**具体取值请以实际输出为准**。另外 `trace: "enabled"` 会显著增大响应体，调试期开、生产期关。

### 7.11 阈值不是常量，是随场景走的经验值

> "这是 Claude 给的清单：法律和医疗文档设 0.8；普通企业 RAG 设 0.75；内部知识设 0.7；想让模型有创造性、偶尔自己编，可以 0.5。但我建议最稳妥是 0.75，AWS guardrails 在 0.75 表现相当好。"
> —— p057 [19:29]

![p057 19:48 讲师展示不同场景对应的 grounding 阈值清单（0.8 / 0.75 / 0.7 / 0.5）](images/p057_1188s.jpg)

注意这份清单是**讲师转述的第三方建议**，不是 AWS 官方文档原文。课里也没讲 `GROUNDING` 与 `RELEVANCE` 两个阈值是否可以设成不同的数——我的实现里两个都写 0.75，你要按自己的语料分别标定。

### 7.12 建 guardrail 的 name 是全局唯一的，重建前要删旧

> "guardrail id 已经建好，先删掉旧的 guardrail 才能重建。重建后姓名设为 anonymize。"
> —— p056 [27:50]

课里没讲重复创建时具体报什么错。实践上同名创建会直接失败，所以复现时**每跑一次脚本都要把上一次的 guardrail 删掉**，否则你会在第二次运行时卡在创建那一步，还误以为代码写错了。我在每个脚本末尾都加了 `delete_guardrail(guardrail_id)`，但如果你在 `m3_04` 中途手动 `Ctrl+C`，清理就不会执行——去控制台手动删，或者把 `delete_guardrail` 包在 `try/finally` 里。

### 7.13 一个 guardrail 装所有策略，别一个策略建一个

> "不是每个策略建一个 guardrail，而是建一个、按策略分别定义。"
> —— p057 [10:31]

这条直接影响成本：每多建一个 guardrail，就多一次独立的策略评估开销。`common.py` 里把五类 config 都做成可选参数，正是为了让你在一个 guardrail 里随意组合。**课里没讲**：不同策略组合在一起时评估是并行还是串行、谁先触发谁——这个没有官方说明，别猜，看 trace 里的 assessments 顺序即可。另外，`blockedInputMessaging` 在纯 grounding 场景下确实不会被触发（讲师 p057 [11:29] 自己也说「input message 显然不会被触发」），但仍然必须填，因为同一个 guardrail 里可能还挂了 topic / word 等 input 侧策略。

### 7.14 一些课里完全没提、但你一定会遇到的工程问题

以下均标注「课里没讲」，属于本课之外的补充判断，供你排障时参考：

1. **`converse` 被 guardrail 拦下时，`output.message.content` 里的结构可能和正常回答不一样**。`m4_01` 里我直接取 `content[0]["text"]`，真实场景建议先判断 `stopReason` 再取值，避免 `KeyError`。具体 `stopReason` 有哪些取值、`guardrail_intervened` 是不是其中之一，**该字段名请以实际输出为准**。
2. **区域与模型支持**。`.env` 里 `AWS_REGION` 换了之后，`BEDROCK_MODEL_ID` 对应的模型不一定在目标区域可用；guardrail 本身也是按区域创建的，跨区不通用。课里全程用同一个区，没讲跨区。
3. **SDK 版本**。`requirements.txt` 里我钉了 `boto3==1.34.144` / `botocore==1.34.144`，是因为 `apply_guardrail`、`contextualGroundingPolicyConfig`、`converse` 的 `guardContent` 这些字段在不同 SDK 版本里命名/嵌套有差异。若你装最新版跑出参数不识别，先降版本，而不是改字段名。
4. **限流与重试**。Bedrock 有 TPS 限制，`m4_01` 里五个问题串行跑没问题，并发几十路就会 429。课里没讲重试策略，实践上用指数退避 + 上限重试次数即可。
5. **`grounding_source` 的长度**。它和正常 prompt 共享上下文窗口，`m4_01` 的假文档只有三行所以无感，真接 PDF 时要先算 token 预算，否则会先撞模型上限、而不是撞 guardrail。
6. **多语言脏话表**。讲师说「它包含多种语言里应当避免的各种词」，但**具体覆盖哪些语种课里没讲**，也没给命中率数据。如果你的产品面向非英语用户，上线前拿真实语料抽样测一遍，别默认它能覆盖你的语种。
7. **在 Node/前端侧调用**。这套东西全是服务端能力，前端不能直连 Bedrock 放 AK/SK。正确姿势：前端 → 你自己的后端 → Bedrock，后端用 `@aws-sdk/client-bedrock-runtime` 的 `ConverseCommand` / `ApplyGuardrailCommand`，把 `guardrailConfig` 原样透传。**在 JS/Node 里对应什么**：没有锁、没有事务，guardrail 是无状态评估，每次请求独立；唯一需要你操心的是并发数与超时。
8. **清理**。讲师 p057 [12:27] 特意提醒「课后记得删掉所有 guardrail」。除了省钱，也是避免下一次跑脚本时被同名冲突卡住（见 7.12）。

---

到这里 Module 3（denied topics / word policy / custom regex / PII）与 Module 4（grounding + RAG）的复现路径就闭合了：**input 侧用 topic / word / PII / content 四类护栏挡用户输入，output 侧用 grounding 挡幻觉，一个 guardrail 装全部策略，自定义正则单列处理地区性格式，grounding 永远只走 `converse`。** 下一步按讲师预告进入 Module 5。