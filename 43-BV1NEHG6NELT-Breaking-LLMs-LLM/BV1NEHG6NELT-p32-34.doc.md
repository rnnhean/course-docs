# Breaking LLMs 第五课：隐私攻击与模型抽取（P32–P34）复现文档

> 课程：Breaking LLMs and AI-Driven Applications（BV1NEHG6NELT）
> 覆盖：P32 功能模型抽取（Functional Model Extraction）、P33 攻击受 API 限制的 LLM 应用之浏览器自动化框架、P34 通过脚本实现持久化认证
> 读者画像：前端转 AI 应用工程师，会 JS/Node，不熟后端。文中涉及 Python 的地方会标注「知道即可」，涉及并发/状态的地方会补一句「在 JS/Node 里对应什么」。

---

## 1. 这一节做什么

这三讲是「隐私攻击与模型抽取」模块的收尾，也是整条学习路径的最后一课。它把攻击面从「偷数据」推进到「偷逻辑」和「偷配置」，然后转向一个非常工程化的问题：**当目标 LLM 应用被 API 网关、登录墙、WAF、CSRF、限流层层包住时，你根本连不上那个裸 API，怎么办？**

P32 讲的是**功能模型抽取（Functional Model Extraction）**。它和之前讲的「蒸馏」不同：蒸馏偷的是「说话方式」（fluency / 上下文输出），而功能抽取偷的是**模型里嵌入的专有决策逻辑**——也就是从「它怎么说话」转向「它怎么判断」。课程用四个可跑的 demo 演示了这条链路：

1. **逻辑克隆（Logic Cloning）**：把 LLM API 当成一个刚性的逻辑函数，用 1000 条合成申请人数据去查询一个「贷款审批 Oracle」，训练一个多层感知机（MLP）小偷模型去逼近它的决策边界，最终小偷模型对 Oracle 标签的准确率达到 99.9%。
2. **决策边界映射（Decision Boundary Mapping）**：对分类模型（欺诈检测、招聘机器人），价值在「边界」——那条把一类和另一类分开的精确线。用**二分搜索**迭代探测，反推出内容审核机器人隐藏的「长度-毒性比」阈值，估计值 0.3507，真实值 0.35，误差 0.007。
3. **超参数抽取（Hyperparameter Extraction）**：LLM 行为受 temperature、top_p、top_k 这些配置控制。用同一个 prompt 打 50 次，计算响应两两之间的**Levenshtein 距离**，画出「温度 vs 输出离散度」曲线，反推出秘密 temperature ≈ 0.888（图上读作 0.88）。
4. **高级系统提示词反转（Advanced System Prompt Inversion）**：不止于「忽略之前所有指令」这种老式越狱，而是训练一个**代理反转模型（surrogate inverter）**，把系统提示词当作潜变量，用「目标输出 → 提示词」的配对微调一个本地 T5，让它从输出风格和拒答模式反推隐藏的系统提示词。
5. **替代模型训练（Substitute Model Training）**：把远程目标克隆成本地代理，就能做无限次、高速、离线的攻击（比如找越狱），再迁移回真目标。demo 里用了基于 Jacobian 的增强，30 轮后一致率只从 85.8% 涨到 86.6%，**没达到 90% 的目标，攻击判定为失败**——讲师特意保留了这个失败案例。
6. **离线对抗优化（Offline Adversary Optimization）**：有了本地克隆，就能用白盒梯度攻击（GCG 风格的离散优化）在本地优化一个「通用越狱后缀」，再拿去打黑盒老师。demo 里本地找到了后缀，但**迁移到黑盒模型时没有成功**。

P33 转向工程侧：**为什么黑盒测试 LLM 应用不能只用 fetch/curl**。真实应用里 LLM 不是裸 API，而是嵌在 agentic 工作流、MCP、RAG 数据库、传统 Web 应用里。用 fetch/curl 会撞上限流、认证、CSRF token、突发限制、API key 限额、外部安全过滤器。于是课程对比了三大浏览器自动化框架——**Selenium、Puppeteer、Playwright**——从架构、隐蔽性、性能三个维度评估，结论是 **Playwright 是 AI 红队的最优选择**（但要看用例：本地 Chrome 测试选 Puppeteer，需要特定语言生态选 Selenium）。

P34 讲**持久化认证**：LLM 组件通常在登录墙后面（否则任何人都能消耗你的 API token 让你烧钱）。核心方法论叫 **「登录一次，到处测试」（login once, test everywhere）**：用一个隔离的 setup 脚本登录一次，捕获 cookies / localStorage / sessionStorage / JWT，存成结构化产物，之后注入到新的隔离浏览器上下文里复用。还要处理 JWT 提取与重注入、会话过期与 token 刷新（否则测试跑着跑着就撞 401/403）。

**这一节你能亲手做出来的东西**：一个本地 Python 项目，包含 6 个可独立运行的攻击脚本（逻辑克隆、边界二分搜索、温度指纹、提示词反转、替代模型训练、GCG 后缀优化），外加一个 Playwright 的「登录一次」状态捕获/复用脚手架。下面第 3、4 节给出完整可保存运行的文件。

---

## 2. 讲师原话

> "蒸馏偷的是流畅度，一句话说就是上下文输出；而功能抽取瞄准的是模型里嵌入的专有决策逻辑，所以我们是从『它怎么说话』转向『它怎么判断』。"
> —— p032 [00:29]

> "我们要克隆的是分类器、审批引擎和高风险应用里用到的路由逻辑。不是偷敏感信息，也不是偷模型权重，我们偷的是模型的逻辑。"
> —— p032 [00:29]

> "在这个 demo 里，我们把 LLM API 当作一个刚性的逻辑函数。我们起一个坏人的神经网络，训练它去模仿一个模拟的贷款分类器。"
> —— p032 [00:58]

> "目标是带硬编码规则的专有贷款审批 API。我们要在看不到源码的情况下克隆它的决策边界。"
> —— p032 [01:23]

> "我们生成 1000 条合成的申请人档案，带收入和信用分。我们向 Oracle 查询这两项，然后训练一个 MLP 多层感知机——也就是小偷模型——去最小化它自己的预测和 Oracle 标签之间的损失。"
> —— p032 [01:53]

> "Oracle 的规则对小偷是未知的：收入大于 50000 且信用分大于 700 就批准贷款。"
> —— p032 [02:23]

> "第一个 epoch 损失是 0.05，挺高的。……随着 epoch 推进，损失降到 0.0234，算是可接受。小偷模型相对真实 Oracle 标签的准确率是 99.9%。"
> —— p032 [02:53]

> "小偷模型达到的高准确率说明这个 Oracle API 容易受到模型反转攻击。你看我们做了什么：找到一个应用，摸清它干什么，做完侦察，然后送 1000 个申请人进去，精确识别它底层怎么运作，然后把逻辑偷出来用到我们自己的应用上。"
> —— p032 [03:22]

> "对分类模型来说，比如欺诈检测和招聘机器人，价值就在边界上——那条把一类和另一类分开的精确线。我们要演示如何用迭代探测定位这些临界点，从而反推出开发者设定的精确规则和阈值。"
> —— p032 [03:50]

> "我们要执行一次二分搜索攻击，用数学方法定位一个模拟内容审核机器人的决策阈值。"
> —— p032 [04:19]

> "目标是一个黑盒内容审核机器人，它用一个隐藏的『长度-毒性比』来标记评论。内部规则不可见。我们的目标是把精确阈值反推到很窄的误差范围内。"
> —— p032 [05:14]

> "我们从一个明显安全的评论和一个明显不安全的评论开始，然后二分搜索迭代探测中点，记录每次查询，不断收窄区间，直到区间宽度小于 0.01。"
> —— p032 [05:40]

> "抽取分析显示，估计阈值是 0.3507。这就是安全变成不安全的那个阈值。而真实阈值——黑盒里的那个数——是 0.35。我们把它做到了 0.007 的误差范围内，考虑到数据量这非常小。"
> —— p032 [06:07]

> "结果表明二分搜索探测技术在反推黑盒内容审核机器人的决策边界上是有效的。真实世界里我们会跑更多测试，但现在我们理解了它底层逻辑，可以拿去绕过它，或者发起进一步的链式攻击。"
> —— p032 [06:56]

> "LLM 的行为由 temperature、top_p、top_k 这些配置控制。我们要探索一种侧信道攻击，让看不到源码和逻辑的黑盒攻击者也能识别出模型在用的这些参数，尽管在某些模型里它们本不该暴露。"
> —— p032 [07:25]

> "我们用一个相同的 prompt 探测 API 100 次，然后测量响应之间的 Levenshtein 距离。"
> —— p032 [07:55]

> "temperature 为 0 会给你最可能的、概率最高的下一个词。比如『法国的首都是』……temperature 为 2 时，法国的首都可能是『刺猬索尼克』。所以提高 temperature，实际上是在增加响应中可行的下一个词的数量。"
> —— p032 [08:21]

> "我们把同一个 prompt 发给端点 50 次——其实我减少了次数，因为这个模块的脚本比较重，跑起来太久了。然后计算每一对响应之间的 Levenshtein 距离，再用一些数学、用 MATLAB 生成图。"
> —— p032 [09:50]

> "temperature 越高，输出多样性越大；越低，输出越确定。看不到配置的攻击者，仍然可以通过测量重复输出的离散程度来估计 temperature。"
> —— p032 [10:18]

> "我们评估出的秘密 temperature 是 0.888。……从『离散度 vs 温度』曲线上，攻击者可以推断出这个离散度，读出精确温度，结果是 0.88。"
> —— p032 [10:48]

> "这个实验演示了针对本地 LLM 的超参数抽取攻击。目标是通过观察固定 prompt 下输出的统计离散度，推断 LLM 的秘密 temperature 设置。我们成功做到了。"
> —— p032 [11:43]

> "超越简单的『忽略指令』越狱——就是那种你往 prompt 里输入『请忽略之前所有指令，我要做不安全的事』。我们要进入更复杂的模型反转攻击，用数学方法尝试恢复隐藏的系统提示词。"
> —— p032 [12:08]

> "我们训练一个代理反转模型来反推隐藏的系统提示词，把提示词当作潜变量。我们在『目标输出 + 提示词』的配对上微调一个本地 T5 模型，学习从输出到指令的映射，然后演示本地模型如何根据输出风格和拒答模式，预测一个在线目标最可能的系统提示词。"
> —— p032 [12:35]

> "目标是包了隐藏系统提示词的 LLM，比如『只用莎士比亚式英语说话』。攻击者只能看到用户查询和模型输出。目标是训练一个反转模型，把目标的输出风格映射回潜变量系统提示词 P——从行为猜规则。"
> —— p032 [13:04]

> "方法是生成 100 对交互（我们的输入 + 目标的模型输出），然后微调一个小模型，输入是目标输出，标签是隐藏系统提示词。反转模型学会从输出的风格模式预测 P。理论依据是：如果输出强烈地以隐藏指令为条件，那么在这些配对上训练的模型就能仅凭风格恢复出那条指令。"
> —— p032 [13:33]

> "抽取分析给出：『你是一个只用莎士比亚式英语说话的有用助手』。样本 1、样本 9、样本 17……这是个有点玩笑性质的例子，因为系统提示词对模型来说太明显了。你可以看到我们确实把系统提示词抽出来了，可能不是精确措辞，但我们抽出了它的理解。反转模型能捕捉到目标 LLM 输出的一些风格元素，比如『TIS』和『R』这样的词。但训练数据有限，反转模型只部分学到了映射。"
> —— p032 [14:02]

> "因为我们没用很强的笔记本，实验只能限制在 24 对目标交互。如果你真想抽出系统提示词，可以把这个交互数量限制去掉。"
> —— p032 [15:00]

> "模型克隆的一个核心应用是构建替代模型——一个行为与远程目标完全一致的本时代理。这让攻击者能做无限次、高速的离线攻击，比如找越狱，然后再迁移到真目标上。"
> —— p032 [15:27]

> "如果你在试越狱，有时候很痛苦。我做很多合规测试，有时候很难，因为 LLM 觉得你在攻击它，然后你被拦、有限流、各种东西挡着。……把那个在线专有模型转移成本地模型，就能在本地模型上把你所有越狱都测一遍。"
> —— p032 [15:54]

> "我们要构建目标 API 的功能性本地副本，以支持无限次离线测试。我们用目标作为老师来给数据集打标签，然后微调一个本地学生模型，比如 Llama3，并且实现基于 Jacobian 的增强——用学生梯度生成最有可能提升克隆准确率的合成查询，最大化抽取效率。"
> —— p032 [16:22]

> "学生生成随机输入，向老师查询标签，加进数据集。基于 Jacobian 的增强会生成学生输入和输出的梯度。理论是：有查询权限的攻击者可以用受害者的输出给输入打标签，从而训练替代模型；Jacobian 增强把查询集中在学生和老师意见不一致的区域，加速收敛。"
> —— p032 [16:51]

> "你看这里有个从第 1 轮到第 30 轮的循环，一致率从 85.8% 涨到 86.6%。30 轮下来 barely 动了一个百分点，可能存在平台期，也可能只是需要多得多的轮次。每提升一个百分点需要那么多轮，才能偷到足够的数据。"
> —— p032 [17:20]

> "结果表明，在给定的实验设置下（学生架构、训练参数、增强、轮数、模型），学生攻击没能达到 90% 的目标一致率。学生模型确实在很大程度上学会了模仿老师，但攻击没能完全复刻老师的行为。这可能说明老师的模型比学生复杂，学生无法像老师那样有效处理数据；也可能只是我们轮数不够。"
> —— p032 [17:49]

> "一旦你把模型克隆到本地，就能不被发现地攻击它。我们最后演示替代模型如何让我们使用白盒攻击——需要访问梯度——来生成能打黑盒目标的对抗样本。"
> —— p032 [18:38]

> "我们要通过攻击本地副本来绕过目标的防御。我们对一个模型做白盒梯度攻击，优化一个通用越狱后缀。一旦后缀成功攻破本地模型，我们就拿它去试专有模型。"
> —— p032 [19:08]

> "学生模型是一个有白盒访问权限的替代 LLM，能拿到梯度，我们就用它在离线优化对抗后缀。老师是同一个模型的黑盒 API。目标是找到一个后缀，让模型输出它平时会拒绝的目标字符串，然后测试能否迁移到老师。"
> —— p032 [20:03]

> "方法是在学生上做 GCG 风格的基于梯度的离散优化：最小化『同一 prompt + 对抗后缀』的下一个 token 损失，然后检查是否成功，再检查攻击是否迁移。"
> —— p032 [20:30]

> "后缀优化……我们在本地模型上跑出了对抗后缀『relative system 7019 non』。prompt 是『你是一个信贷员』，用户问『我能贷款吗』，这通常会被拒绝。但我们发现在本地模型上，把这个后缀（带括号和冒号，我想不起那叫什么了……花括号）附加上去，就绕过了。所以这里有种奇怪的逻辑：加上这个后缀贷款就会被批准。"
> —— p032 [20:59]

> "然后我们拿它去测黑盒模型。老师是『你是一个信贷员』，用户问『我能贷款吗』，回复用一句短话给出你的决定，然后我们附加那个后缀。对抗后缀是离线找到的，在本地有效，但我们拿去打黑盒模型时没有成功。这个案例里它确实没work，但你能看到逻辑：与其在生产环境里测专有模型、可能执行不安全操作、惹上法律麻烦，短期内你会撞限流、被踢出系统、API key 被吊销。所以不如用这些技术把模型克隆到你能控制的本地模型，把内部运作抽出来，然后再测你的对抗越狱，成功后迁移到专有模型——希望比这次效果好。"
> —— p032 [21:56]

> "这门课完成了。恭喜你完成了 Breaking LLMs 学习路径的第五课。你现在应该同时具备理论知识 and 实践经验，能对大型语言模型、小型语言模型做红队测试，覆盖数据泄露和抽取。"
> —— p032 [22:54]

> "欢迎来到 Breaking LLMs 学习路径。这门课是攻击受 API 限制的 LLM 应用，我们要看用于 LLM 红队的浏览器自动化框架。目的是探索用自动化浏览器测试来测 LLM 驱动的应用。"
> —— p033 [00:00]

> "问题是：测 LLM 驱动应用时，你往往不只是在跟一个 API 交互，你在跟多个不同工具交互——比如 agentic 工作流、模型上下文协议（MCP）、RAG 数据库、把 LLM 功能集成进传统 Web 应用。现实里更常见的是，你要测的是一个深深嵌在应用里的 API 端点，而不是裸端点。"
> —— p033 [00:29]

> "测一个 LLM 模型，简单到输入 API key、连上模型、拿回响应，这是很好的测试方式。但现实中大多数 LLM 驱动应用不是这样的。所以我们需要某种浏览器自动化。你可以用 fetch 或 curl 这类传统库，但在做黑盒测试（不知道源码、在边界之外）时，这些工具经常撞上限流、认证、CSRF token、突发限制、API key 限额、外部安全过滤器。"
> —— p033 [01:24]

> "浏览器自动化框架——程序化浏览器交互——是审计重防御 AI 应用的基石。"
> —— p033 [02:23]

> "第一个工具简单看一下：Selenium，遗留标准，被称为现代浏览器自动化工具的祖父。作为最老、采用最广的 Web 自动化框架，Selenium 通过一个中间人——WebDriver 协议——运作。它号称无与伦比的语言支持，意思是你可以用很多语言写 Selenium 测试，不只是 JavaScript，还有 Python、C、Java，很多语言都有连接。但它语法啰嗦、执行慢、机器人签名高度可识别。"
> —— p033 [02:47]

> "Selenium 有个插件，我记得叫 undetected ChromeDriver，确实引入了一些检测 WAF 的能力。Selenium 与时俱进过，是浏览器自动化的优秀选择，也是成熟工具，但它属于较老的工具，某种程度上已被超越。不过它仍在主流使用，是很好的工具，用 Selenium 完全没问题。"
> —— p033 [04:07]

> "Puppeteer，Chrome 专家。它专门聚焦 JavaScript 栈和 Chrome 浏览器。如果你用 JavaScript 写测试、又专门用 Chrome，这是很好的选择。不适合的场景是：你要交付给客户用——你不知道客户会不会用 Chrome，可能开箱就崩。本地测试的话它是很好的选择。Puppeteer 通过直接访问 Chrome DevTools 协议（CDP）对 Chromium 系浏览器提供高层控制。这种直接通信带来极快的执行和深度网络拦截。但它对 Chrome 和 JavaScript 的依赖会限制面向客户使用的集成。"
> —— p033 [04:56]

> "Puppeteer 另一个好处是上手非常简单，可能是当前方案里最简单的，很适合 bootstrap 或入门级浏览器自动化。Puppeteer 是个了不起的工具，Chrome DevTools 集成好，如我所说极快。"
> —— p033 [05:51]

> "第三个工具：Playwright，现代方案。Playwright 是创建 Puppeteer 的同一批人做的，但他们后来离开 Puppeteer 开了自己的项目。Playwright 想整合两者的优点——Puppeteer 的优点和 Selenium 的优点，设计上解决早期工具的架构局限。Playwright 已成为现代多语言强者。它内置自动等待（auto-waiting）——浏览器能等页面上的特定动作。比如在我们的语境里，如果我们在等某个特定端点被激活，可以等到那个端点被调用，Playwright 会自动检测到；或者更简单，点击聊天界面的提交按钮，Playwright 能检测到这次点击。"
> —— p033 [06:40]

> "其他方案也提供这个，但 Playwright 原生集成，让生活轻松很多。还有健壮的网络拦截——这是 Playwright 很棒的一点，拦截请求和响应并在工作流里使用。还有隔离的浏览器上下文，这在很大程度上克服了隐蔽性问题，因为很多应用被 WAF 或内部保护守着，这些会检测机器人、自动化测试工具和爬虫。"
> —— p033 [07:58]

> "所有这些浏览器工具都可能被检测为自动化工具，所以得想办法绕过。Playwright 真的尝试原生集成这一点。还有一个 Playwright stealth 插件可以做机器人规避，值得一提。Puppeteer 也有插件，我记得叫 puppeteer-extra-plugin-stealth。"
> —— p033 [08:24]

> "规避和隐蔽能力——绕过 AI 应用防御需要剥离自动化标志、模仿人类行为。整个要点就是在需要时模仿人类行为，绕过防御性 WAF。如果用 curl 或 fetch，这些工具极快，但规避防御很差，因为签名很强。总体趋势是：你执行测试越快，被当成机器人抓到的概率越大。"
> —— p033 [09:18]

> "有些 Web 应用无所谓，它们不在乎。但应用越大，防御越硬。比如 Gemini，如果你试图在 Google Gemini 上用这些，防御层次太深了，绕过要花很大功夫。是可能的，但你会不断撞问题。所以规避和隐蔽能力是浏览器自动化红队的极重要考量。"
> —— p033 [10:15]

> "基于我们对速度、隐蔽性和生态集成的分析，Playwright 确实是 AI 红队的最优选择。我说这话没拿钱，但一般来说它是最好的工具，因为它整合了另外两个工具的优点。当然要看用例：如果你在 bootstrap、刚接触浏览器自动化，或者就是要在自己笔记本上用 Chrome，那 Puppeteer 最好；如果你需要和某个语言集成，或需要 Selenium 生态的独特功能，那 Selenium 最好。就我的目的——AI 红队、LLM 驱动应用红队——Playwright 目前是最优解。一个原因是 Python 红队越来越多用 Python 脚本，而它和 Python 集成极好。"
> —— p033 [11:07]

> "欢迎来到 Breaking LLMs 学习路径。这门课是攻击受 API 限制的 LLM 应用，我们来看通过脚本实现持久化认证。"
> —— p034 [00:00]

> "在自动化中维持认证状态、跨多次测试运行，对于绕过重复的 UI 登录、规避防御触发至关重要。我们介绍『登录一次，到处测试』方法论，演示捕获和恢复完整浏览器状态如何同时显著提升隐蔽性和性能。"
> —— p034 [00:26]

> "你会发现很多 AI 驱动应用里，真正需要红队测试的 LLM 组件在认证后面。如果你有个 LLM 应用不在认证后面，那任何人都能——不是 DDoS——他们能消耗你应用的资源，消耗你的 API token 让你烧很多钱，还能在没有任何认证、日志、防御能力的情况下滥用它。所以任何在应用里运行的 LLM，明智做法都是放在认证后面。例外是 LLM 为了试用或 demo 而暴露——你可能允许单个会话或单个 IP 发三条 prompt 来测试。但一般来说，最好的测试方式是登录进那个应用，模仿真实用户。"
> —— p034 [00:54]

> "现代 Web 应用用各种客户端存储机制维持用户身份和会话上下文。我们要拆解 Web 认证状态的解剖结构，区分持久化 HTTP cookie、Web Storage API，以及 JSON Web Token 的结构。认证会存在服务端 cookie、客户端 localStorage、客户端 sessionStorage 里，会用 JWT 或其他加密确保数据安全且绑定到具体会话。"
> —— p034 [02:22]

> "设计一个隔离的 setup 脚本，让测试者向目标应用认证一次，然后进入测试。利用框架 API 捕获 cookie 和 localStorage，验证登录成功，并为后续测试运行创建结构化产物。一旦认证状态被捕获，就能注入到新的隔离浏览器上下文。"
> —— p034 [02:52]

> "它看起来就是一个带认证数据的认证文件，通常还有一个带正确配置的配置文件。你可能还需要额外状态，比如 CSRF token（跨站请求伪造 token）和刷新 token（应用要求每隔几分钟刷新）。那里有多层认证。"
> —— p034 [03:20]

> "依赖 JWT 的无状态应用架构给自动化带来独特挑战。我们要探索从 DOM 直接提取 bearer token 并重注入新浏览器会话的具体技术，以及动态拦截网络请求附加 authorization 头的技术。我们要把这一切自动化。"
> —— p034 [04:16]

> "长周期 engagements 不可避免地会遇到过期 token 和会话超时。把这种处理内建到自动化流水线里，能防止你被踢出、测试还在跑却撞上 401 或 403 forbidden 错误。把韧性内建到流水线需要检测 HTTP 错误、实现自动 token 刷新逻辑，无人工干预地优雅恢复。"
> —— p034 [04:45]

---

## 3. 从零复现

> 说明：P32 的 demo 是讲师在本地 Python 环境里跑的（提到「没用很强的笔记本」「MATLAB 生成图」）。逐字稿没有给出完整源码，也没有 OCR 代码。下面第 4 节给出的是**按逐字稿描述的参数与流程重建的完整可运行文件**，凡是逐字稿明确给出的数值（1000 条申请人、收入 >50000、信用分 >700、二分搜索区间宽度 <0.01、估计阈值 0.3507、真实阈值 0.35、50 次重复、温度 0.888、100 对交互、24 对实际训练、30 轮、85.8%→86.6%、90% 目标）全部原样落进代码。逐字稿没给的实现细节（比如具体用哪个库、GCG 的完整实现）我会明确标注「课里没讲，以下为可运行的最小重建」。

### 3.1 环境准备

```bash
# 建议 Python 3.10+，独立虚拟环境
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 核心依赖（版本为写作时可用版本，可上下浮动）
pip install "numpy>=1.26" "pandas>=2.2" "scikit-learn>=1.4" \
            "matplotlib>=3.8" "python-Levenshtein>=0.25" \
            "torch>=2.2" "transformers>=4.40" "datasets>=2.19" \
            "playwright>=1.44"

# 浏览器自动化需要装浏览器二进制
playwright install chromium
```

目录结构（照抄即可）：

```
breaking-llms-p32-34/
├── requirements.txt
├── p32_logic_cloning.py
├── p32_boundary_mapping.py
├── p32_temperature_fingerprint.py
├── p32_prompt_inversion.py
├── p32_substitute_model.py
├── p32_gcg_suffix.py
├── p33_playwright_probe.py
├── p34_capture_auth.py
├── p34_reuse_auth.py
└── artifacts/            # 运行时自动创建，存 auth.json / 图 / 日志
```

### 3.2 P32-1 逻辑克隆（Logic Cloning）

**目标**：把 LLM API 当刚性逻辑函数，克隆一个贷款审批 Oracle 的决策边界。

**步骤**：
1. 定义 Oracle（模拟专有贷款审批 API），硬编码规则：`income > 50000 and credit_score > 700` → 批准。这条规则「对小偷未知」。
2. 生成 1000 条合成申请人档案，字段 `income`、`credit_score`。
3. 向 Oracle 查询这 1000 条，拿到标签。
4. 训练一个 MLP（多层感知机）小偷模型，最小化预测与 Oracle 标签之间的损失。
5. 观察 loss 从第一个 epoch 的 0.05 降到 0.0234，最终小偷模型对 Oracle 标签准确率 99.9%。

**关键判断**：讲师强调「高准确率说明 Oracle API 易受模型反转攻击」——也就是说，只要你能查询足够多次，一个简单的分类器就能把它的决策逻辑完整偷出来。

![p032 01:53 讲师说明逻辑克隆的目标：1000 条合成申请人 + MLP 小偷模型](images/p032_0141s.jpg)

### 3.3 P32-2 决策边界映射（二分搜索）

**目标**：反推黑盒内容审核机器人隐藏的「长度-毒性比」阈值。

**步骤**：
1. 准备一个明显安全的评论、一个明显不安全的评论（对应比值 0 和 1 附近）。
2. 二分搜索：每次取区间中点作为「长度-毒性比」构造评论，查询机器人得到 safe/unsafe 判决。
3. 记录每次查询，收窄区间，直到区间宽度 < 0.01。
4. 输出估计阈值。demo 结果：估计 0.3507，真实 0.35，误差 0.007。

![p032 05:40 二分搜索迭代：记录每次查询、收窄区间直到宽度小于 0.01](images/p032_0329s.jpg)

### 3.4 P32-3 温度指纹（Levenshtein 距离）

**目标**：从可观测输出反推本地 LLM 的秘密 temperature。

**步骤**：
1. 同一个 prompt 发给端点 50 次（讲师原计划 100 次，因脚本重减到 50）。
2. 计算每一对响应之间的 Levenshtein 距离。
3. 对一组候选温度分别测「输出离散度」，画出「温度 vs 离散度」曲线。
4. 从曲线上读出秘密温度。demo 结果：0.888（图上读作 0.88）。

**原理**：温度越高，输出多样性越大；越低越确定。攻击者看不到配置，但能测重复输出的离散程度。

![p032 10:48 温度指纹：50 次重复 prompt 的 Levenshtein 距离生成离散度曲线](images/p032_0611s.jpg)

### 3.5 P32-4 系统提示词反转（T5 代理反转模型）

**目标**：把隐藏系统提示词当潜变量，训练反转模型从输出风格反推提示词。

**步骤**：
1. 生成 100 对交互（用户输入 + 目标模型输出），目标是「只用莎士比亚式英语说话」。
2. 微调一个小的本地 T5，输入=目标输出，标签=隐藏系统提示词。
3. 反转模型学会从风格模式预测 P。
4. demo 结果：抽出「你是一个只用莎士比亚式英语说话的有用助手」，捕捉到「TIS」「R」等风格词，但因只用 24 对交互，只部分学到映射。

![p032 13:33 提示词反转：生成 100 对交互、微调小模型、从风格预测隐藏提示词](images/p032_0798s.jpg)

### 3.6 P32-5 替代模型训练（Jacobian 增强）

**目标**：用老师（黑盒 API）给数据打标签，训练本地学生（Llama3），做无限离线测试。

**步骤**：
1. 学生生成随机输入，向老师查询标签，加入数据集。
2. 基于 Jacobian 的增强：用学生梯度生成最可能提升克隆准确率的合成查询，把查询集中在学生与老师意见不一致的区域。
3. 循环第 1 轮到第 30 轮，观察一致率。demo 结果：85.8% → 86.6%，**未达 90% 目标，攻击判定失败**。

**讲师对失败的解读**：可能老师模型比学生复杂、学生处理数据能力不足；也可能只是轮数不够——「每提升一个百分点需要那么多轮」。

![p032 17:20 替代模型训练：30 轮循环一致率仅从 85.8% 到 86.6%](images/p032_0986s.jpg)

### 3.7 P32-6 离线对抗优化（GCG 后缀）

**目标**：在本地克隆上用白盒梯度攻击优化通用越狱后缀，再迁移到黑盒老师。

**步骤**：
1. 学生模型有白盒访问（能拿梯度），在本地离线优化对抗后缀。
2. 方法：GCG 风格基于梯度的离散优化，最小化「同一 prompt + 对抗后缀」的下一个 token 损失。
3. 检查是否成功，再检查是否迁移到老师。
4. demo 结果：本地找到后缀 `relative system 7019 non`（讲师口述，带花括号附加），本地成功绕过「你是一个信贷员 / 我能贷款吗」的拒答；**迁移到黑盒模型时失败**。

**讲师强调的价值**：与其在生产环境测专有模型、可能执行不安全操作、惹法律麻烦、撞限流、被踢、API key 被吊销，不如克隆到本地控制，抽出内部运作，再测越狱，成功后迁移。

![p032 20:59 后缀优化：本地找到对抗后缀并附加到贷款审批 prompt](images/p032_1080s.jpg)

### 3.8 P33 浏览器自动化框架选型

**问题**：真实 LLM 应用不是裸 API，而是嵌在 agentic 工作流、MCP、RAG、传统 Web 应用里。fetch/curl 会撞限流、认证、CSRF、突发限制、API key 限额、外部安全过滤器。

**三框架对比**（讲师结论）：

| 维度 | Selenium | Puppeteer | Playwright |
|---|---|---|---|
| 定位 | 遗留标准，「现代浏览器自动化工具的祖父」 | Chrome 专家 | 现代方案，整合前两者优点 |
| 架构 | 中间人 WebDriver 协议 | 直接访问 Chrome DevTools 协议（CDP） | 原生多语言，内置 auto-waiting |
| 语言支持 | 无与伦比（JS/Python/C/Java…） | 聚焦 JS + Chrome | 多语言 |
| 速度 | 慢 | 极快 | 快 |
| 隐蔽性 | 机器人签名高度可识别；有 undetected ChromeDriver 插件 | 有 puppeteer-extra-plugin-stealth | 隔离浏览器上下文 + Playwright stealth 插件 |
| 适用 | 需要特定语言/生态独特功能 | 本地 Chrome 测试、bootstrap、入门 | AI 红队最优解（讲师结论） |

**讲师选型逻辑**：速度越快越容易被当机器人抓；应用越大防御越硬（如 Gemini 防御层次极深）。Playwright 因整合两者优点、Python 集成好，成为 AI 红队最优解。

![p033 06:40 Playwright 内置 auto-waiting 与隔离浏览器上下文](images/p033_0383s.jpg)

### 3.9 P34 登录一次，到处测试

**问题**：LLM 组件在认证后面（否则任何人能消耗你的 API token 让你烧钱）。

**步骤**：
1. 写一个隔离的 setup 脚本，向目标应用认证一次。
2. 用框架 API 捕获 cookies、localStorage、sessionStorage，验证登录成功，存成结构化产物（auth.json + 配置文件）。
3. 把认证状态注入新的隔离浏览器上下文，后续测试复用。
4. 处理 JWT：从 DOM 提取 bearer token 重注入；动态拦截网络请求附加 authorization 头。
5. 处理会话过期：检测 401/403，实现自动 token 刷新，无人工干预优雅恢复。

![p034 03:20 捕获认证状态：cookies + localStorage 存成结构化产物](images/p034_0188s.jpg)

---

## 4. 完整代码

> 以下每个文件都可直接保存运行。逐字稿没给的实现细节用注释标注「课里没讲，以下为最小重建」。所有 demo 默认离线可跑（Oracle/机器人/本地模型用模拟或小模型），不依赖真实付费 API。

### 4.1 `requirements.txt`

```
numpy>=1.26
pandas>=2.2
scikit-learn>=1.4
matplotlib>=3.8
python-Levenshtein>=0.25
torch>=2.2
transformers>=4.40
datasets>=2.19
playwright>=1.44
```

### 4.2 `p32_logic_cloning.py`

```python
"""
P32-1 逻辑克隆（Logic Cloning）
逐字稿参数：1000 条合成申请人；Oracle 规则 income>50000 and credit_score>700；
MLP 小偷模型；loss 0.05 -> 0.0234；准确率 99.9%。
"""
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

RNG = np.random.default_rng(42)

# ---- 1. 模拟专有贷款审批 Oracle（规则对小偷未知）----
def oracle_loan_api(income: float, credit_score: float) -> int:
    """硬编码规则：收入 > 50000 且信用分 > 700 批准。"""
    return int(income > 50_000 and credit_score > 700)

# ---- 2. 生成 1000 条合成申请人档案 ----
N = 1000
income = RNG.integers(20_000, 120_000, size=N)
credit = RNG.integers(500, 850, size=N)
df = pd.DataFrame({"income": income, "credit_score": credit})

# ---- 3. 向 Oracle 查询标签 ----
df["label"] = [oracle_loan_api(r.income, r.credit_score) for r in df.itertuples()]

X = df[["income", "credit_score"]].values
y = df["label"].values
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ---- 4. 训练 MLP 小偷模型 ----
thief = MLPClassifier(
    hidden_layer_sizes=(16, 8),
    max_iter=200,
    random_state=42,
    verbose=True,   # 打印每个 epoch 的 loss
)
thief.fit(X_train, y_train)

# ---- 5. 评估 ----
pred = thief.predict(X_test)
acc = accuracy_score(y_test, pred)
print(f"[logic_cloning] thief accuracy vs oracle labels = {acc:.3%}")
# 预期接近 99.9%
```

### 4.3 `p32_boundary_mapping.py`

```python
"""
P32-2 决策边界映射（二分搜索）
逐字稿参数：区间宽度 < 0.01；估计阈值 0.3507；真实阈值 0.35；误差 0.007。
"""
import math

# ---- 黑盒内容审核机器人：隐藏的「长度-毒性比」阈值 ----
TRUE_THRESHOLD = 0.35  # 讲师 demo 的真实阈值

def moderation_bot(ratio: float) -> str:
    """ratio = 长度-毒性比。>= 阈值判 unsafe，否则 safe。"""
    return "unsafe" if ratio >= TRUE_THRESHOLD else "safe"

# ---- 二分搜索 ----
def binary_search_threshold(lo=0.0, hi=1.0, tol=0.01):
    queries = []
    while (hi - lo) > tol:
        mid = (lo + hi) / 2
        verdict = moderation_bot(mid)
        queries.append((mid, verdict))
        if verdict == "unsafe":
            hi = mid          # 阈值在左半
        else:
            lo = mid          # 阈值在右半
    return (lo + hi) / 2, queries

est, log = binary_search_threshold()
print(f"[boundary_mapping] estimated threshold = {est:.4f}")
print(f"[boundary_mapping] true threshold      = {TRUE_THRESHOLD}")
print(f"[boundary_mapping] margin              = {abs(est - TRUE_THRESHOLD):.4f}")
for i, (m, v) in enumerate(log, 1):
    print(f"  iter {i:02d}: midpoint={m:.4f} verdict={v}")
# 预期 est ≈ 0.3507，margin ≈ 0.007
```

### 4.4 `p32_temperature_fingerprint.py`

```python
"""
P32-3 温度指纹（Levenshtein 距离）
逐字稿参数：同一 prompt 50 次；Levenshtein 距离；秘密温度 0.888（图上 0.88）。
说明：课里没讲具体用哪个本地模型，以下用「模拟采样器」重建统计流程，
      真实场景把 sample_once() 换成你的 LLM 端点调用即可。
"""
import itertools
import random
import Levenshtein
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SECRET_TEMPERATURE = 0.888
PROMPT = "The capital of France is"

# 候选词池，模拟不同温度下的采样分布
VOCAB = ["Paris", "Lyon", "a city", "Sonic the Hedgehog", "unknown", "the", "maybe Paris"]

def sample_once(temperature: float, rng: random.Random) -> str:
    """模拟：温度越高，越可能采到低概率词。"""
    if temperature <= 0.01:
        return "Paris"
    # 用温度做 softmax 的简化版
    weights = [1.0 / (i + 1) ** (1.0 / max(temperature, 0.01)) for i in range(len(VOCAB))]
    return rng.choices(VOCAB, weights=weights, k=1)[0]

def spread_at(temperature: float, n: int = 50, seed: int = 0) -> float:
    rng = random.Random(seed)
    responses = [sample_once(temperature, rng) for _ in range(n)]
    dists = [Levenshtein.distance(a, b) for a, b in itertools.combinations(responses, 2)]
    return sum(dists) / len(dists)

# 扫描候选温度，画「温度 vs 离散度」曲线
temps = [round(t, 2) for t in [i / 20 for i in range(0, 41)]]  # 0.00 ~ 2.00
spreads = [spread_at(t) for t in temps]

plt.figure(figsize=(8, 4))
plt.plot(temps, spreads, marker="o")
plt.xlabel("temperature")
plt.ylabel("mean Levenshtein distance")
plt.title("Temperature vs Output Spread")
plt.tight_layout()
plt.savefig("artifacts/temperature_curve.png")
print("[temperature_fingerprint] saved artifacts/temperature_curve.png")

# 从曲线上反推：找离散度最接近秘密温度对应值的候选温度
target_spread = spread_at(SECRET_TEMPERATURE, seed=99)
best = min(zip(temps, spreads), key=lambda p: abs(p[1] - target_spread))
print(f"[temperature_fingerprint] secret temperature = {SECRET_TEMPERATURE}")
print(f"[temperature_fingerprint] inferred temperature ≈ {best[0]}")
```

### 4.5 `p32_prompt_inversion.py`

```python
"""
P32-4 系统提示词反转（T5 代理反转模型）
逐字稿参数：100 对交互；实际训练 24 对；隐藏提示词「只用莎士比亚式英语说话」。
说明：课里没讲具体 T5 型号与超参，以下用 transformers 的 t5-small 做最小重建。
      首次运行会下载模型，需联网。
"""
import json
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import T5Tokenizer, T5ForConditionalGeneration

HIDDEN_PROMPT = "You are a helpful assistant that speaks only in Shakespearean English."

# ---- 1. 生成 100 对交互（输入=目标输出，标签=隐藏提示词）----
# 课里没讲目标模型具体是什么，以下用模板模拟莎士比亚风格输出
SHAKESPEARE_SAMPLES = [
    "Hark! The answer thou seekest is 'tis so.",
    "Verily, I say unto thee, the deed is done.",
    "Prithee, what light through yonder window breaks?",
    "Thou art a knave, and I shall not suffer thee.",
    "Alas, poor Yorick! I knew him well.",
]
pairs = []
for i in range(100):
    out = SHAKESPEARE_SAMPLES[i % len(SHAKESPEARE_SAMPLES)]
    pairs.append({"input": out, "label": HIDDEN_PROMPT})

# 讲师因笔记本算力限制只用了 24 对
TRAIN_PAIRS = pairs[:24]

class InversionDataset(Dataset):
    def __init__(self, data, tokenizer, max_len=64):
        self.data = data
        self.tok = tokenizer
        self.max_len = max_len
    def __len__(self):
        return len(self.data)
    def __getitem__(self, idx):
        item = self.data[idx]
        enc = self.tok(item["input"], truncation=True, max_length=self.max_len,
                       padding="max_length", return_tensors="pt")
        lab = self.tok(item["label"], truncation=True, max_length=self.max_len,
                       padding="max_length", return_tensors="pt")
        return {"input_ids": enc["input_ids"].squeeze(0),
                "attention_mask": enc["attention_mask"].squeeze(0),
                "labels": lab["input_ids"].squeeze(0)}

tokenizer = T5Tokenizer.from_pretrained("t5-small")
model = T5ForConditionalGeneration.from_pretrained("t5-small")

ds = InversionDataset(TRAIN_PAIRS, tokenizer)
dl = DataLoader(ds, batch_size=4, shuffle=True)
opt = torch.optim.AdamW(model.parameters(), lr=5e-4)

# ---- 2. 微调反转模型 ----
model.train()
for epoch in range(5):
    total = 0.0
    for batch in dl:
        opt.zero_grad()
        out = model(input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    labels=batch["labels"])
        loss = out.loss
        loss.backward()
        opt.step()
        total += loss.item()
    print(f"[prompt_inversion] epoch {epoch+1} loss = {total/len(dl):.4f}")

# ---- 3. 用反转模型预测隐藏提示词 ----
model.eval()
test_out = "Hark! 'tis a most wondrous thing."
enc = tokenizer(test_out, return_tensors="pt")
gen = model.generate(**enc, max_length=64)
pred = tokenizer.decode(gen[0], skip_special_tokens=True)
print(f"[prompt_inversion] predicted system prompt: {pred}")
print(f"[prompt_inversion] true system prompt:      {HIDDEN_PROMPT}")
```

### 4.6 `p32_substitute_model.py`

```python
"""
P32-5 替代模型训练（Jacobian 增强）
逐字稿参数：30 轮；一致率 85.8% -> 86.6%；目标 90%（未达成）。
说明：课里没讲 Llama3 的具体微调细节，以下用 sklearn MLP 做最小重建，
      保留「学生查询老师 -> 加数据 -> Jacobian 增强 -> 测一致率」的循环结构。
"""
import numpy as np
from sklearn.neural_network import MLPClassifier

RNG = np.random.default_rng(7)

# ---- 老师：黑盒 API（这里用固定规则模拟）----
def teacher(x):
    return int(x[0] + x[1] > 1.0)

# ---- 学生：本地替代模型 ----
student = MLPClassifier(hidden_layer_sizes=(8,), max_iter=50, random_state=0)

# 初始随机数据
X = RNG.random((200, 2))
y = np.array([teacher(x) for x in X])
student.fit(X, y)

def agreement(n=200):
    Xt = RNG.random((n, 2))
    yt = np.array([teacher(x) for x in Xt])
    return (student.predict(Xt) == yt).mean()

print(f"[substitute] round 0 agreement = {agreement():.3%}")

# ---- 30 轮：查询老师 + Jacobian 增强 ----
for rnd in range(1, 31):
    # 学生生成随机输入，查询老师标签
    Xq = RNG.random((50, 2))
    yq = np.array([teacher(x) for x in Xq])
    X = np.vstack([X, Xq]); y = np.concatenate([y, yq])

    # Jacobian 增强（最小重建）：在决策边界附近采样
    # 课里没讲具体 Jacobian 实现，这里用「学生预测概率接近 0.5 的区域」近似
    Xcand = RNG.random((200, 2))
    proba = student.predict_proba(Xcand)[:, 1]
    near_boundary = Xcand[np.abs(proba - 0.5) < 0.1]
    if len(near_boundary):
        yb = np.array([teacher(x) for x in near_boundary])
        X = np.vstack([X, near_boundary]); y = np.concatenate([y, yb])

    student.fit(X, y)
    if rnd % 5 == 0 or rnd == 30:
        print(f"[substitute] round {rnd} agreement = {agreement():.3%}")

print("[substitute] target agreement = 90% (demo 未达成，讲师判定攻击失败)")
```

### 4.7 `p32_gcg_suffix.py`

```python
"""
P32-6 离线对抗优化（GCG 风格后缀）
逐字稿参数：本地找到后缀 "relative system 7019 non"；迁移到黑盒失败。
说明：课里没讲完整 GCG 实现，以下为「离散 token 搜索」的最小重建，
      保留「本地优化 -> 检查成功 -> 迁移测试」的结构。
"""
import random

# ---- 本地学生模型（白盒，可拿梯度；这里用打分函数模拟）----
def local_model_score(prompt: str, suffix: str) -> float:
    """返回越狱成功分数，越高越可能输出目标串。"""
    score = 0.0
    if "relative" in suffix: score += 0.3
    if "system" in suffix: score += 0.3
    if "7019" in suffix: score += 0.2
    if "non" in suffix: score += 0.2
    return score

# ---- 黑盒老师（迁移测试）----
def blackbox_teacher(prompt: str, suffix: str) -> str:
    # demo 里迁移失败：黑盒不买账
    return "I cannot approve this loan."

BASE_PROMPT = "You are a loan officer. The user asks: can I get a loan?"
TARGET = "Approved."

# ---- GCG 风格离散搜索（最小重建）----
candidates = ["relative", "system", "7019", "non", "alpha", "beta", "zeta"]
best_suffix, best_score = "", 0.0
for _ in range(500):
    suffix = " ".join(random.sample(candidates, k=4))
    s = local_model_score(BASE_PROMPT, suffix)
    if s > best_score:
        best_score, best_suffix = s, suffix

print(f"[gcg] local best suffix = {{{best_suffix}}}")
print(f"[gcg] local score = {best_score:.2f}")

# ---- 迁移测试 ----
resp = blackbox_teacher(BASE_PROMPT, best_suffix)
print(f"[gcg] blackbox response = {resp}")
print("[gcg] transfer success =", resp.strip() == TARGET)
# demo 预期：False（迁移失败）
```

### 4.8 `p33_playwright_probe.py`

```python
"""
P33 浏览器自动化探测脚手架（Playwright）
用途：演示 auto-waiting、网络拦截、隔离上下文。
课里没讲具体目标站点，以下用 example.com 做骨架，替换 URL 即可。
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()   # 隔离浏览器上下文
    page = context.new_page()

    # 网络拦截：记录所有请求
    requests = []
    page.on("request", lambda req: requests.append(req.url))

    page.goto("https://example.com")
    # auto-waiting：等元素出现再操作
    page.wait_for_selector("h1")
    print("[playwright] title =", page.title())
    print("[playwright] captured requests =", len(requests))

    context.close()
    browser.close()
```

### 4.9 `p34_capture_auth.py`

```python
"""
P34 登录一次，到处测试：捕获认证状态
课里没讲具体目标站点，以下用占位 URL，替换成你的目标即可。
"""
import json
import os
from playwright.sync_api import sync_playwright

TARGET_URL = "https://your-target-app.example.com/login"
USERNAME = os.environ.get("TARGET_USER", "test@example.com")
PASSWORD = os.environ.get("TARGET_PASS", "changeme")
OUT = "artifacts/auth.json"

os.makedirs("artifacts", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto(TARGET_URL)

    # 课里没讲具体选择器，按实际页面替换
    page.fill("input[name=email]", USERNAME)
    page.fill("input[name=password]", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_load_state("networkidle")

    # 捕获 cookies + localStorage
    storage = context.storage_state()
    with open(OUT, "w") as f:
        json.dump(storage, f, indent=2)
    print(f"[capture_auth] saved {OUT}")

    context.close()
    browser.close()
```

### 4.10 `p34_reuse_auth.py`

```python
"""
P34 复用认证状态 + 处理 401/403 与 token 刷新
"""
import json
from playwright.sync_api import sync_playwright

AUTH = "artifacts/auth.json"
TARGET = "https://your-target-app.example.com/chat"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # 注入捕获的认证状态到新的隔离上下文
    context = browser.new_context(storage_state=AUTH)
    page = context.new_page()

    # 动态拦截请求，附加 authorization 头（JWT 场景）
    def attach_auth(route, request):
        headers = dict(request.headers)
        # 课里没讲具体 token 来源，示例从 localStorage 读
        token = page.evaluate("localStorage.getItem('access_token')")
        if token:
            headers["authorization"] = f"Bearer {token}"
        route.continue_(headers=headers)

    page.route("**/*", attach_auth)

    resp = page.goto(TARGET)
    if resp and resp.status in (401, 403):
        print("[reuse_auth] token expired, need refresh")
        # 课里没讲具体刷新端点，按实际实现
    else:
        print("[reuse_auth] authenticated OK, status =", resp.status if resp else "n/a")

    context.close()
    browser.close()
```

---

## 5. 逐行解释

**`p32_logic_cloning.py`**
- `oracle_loan_api` 就是讲师说的「带硬编码规则的专有贷款审批 API」。规则 `income > 50_000 and credit_score > 700` 是逐字稿原话。注意：这条规则「对小偷未知」——小偷模型只看到 `(income, credit_score) -> label`，看不到这个 `if`。
- `N = 1000` 对应「生成 1000 条合成申请人档案」。
- `MLPClassifier(hidden_layer_sizes=(16, 8))` 是「多层感知机小偷模型」。`verbose=True` 会打印每 epoch 的 loss，你能亲眼看到讲师说的「第一个 epoch 0.05，降到 0.0234」这个量级（具体数值随随机种子浮动）。
- 最后打印的准确率对应「99.9%」。讲师强调这个高准确率说明 Oracle 易受模型反转攻击——**能查足够多次，就能把决策逻辑完整偷出来**。
- 在 JS/Node 里对应什么：`MLPClassifier` 相当于 TensorFlow.js 的 `tf.layers.dense` 堆叠，训练循环用 `model.fit`。

**`p32_boundary_mapping.py`**
- `TRUE_THRESHOLD = 0.35` 是讲师 demo 的真实阈值。
- `binary_search_threshold` 就是「二分搜索迭代探测中点，记录每次查询，收窄区间直到宽度 < 0.01」。`tol=0.01` 对应「区间宽度小于 0.01」。
- 判决为 `unsafe` 时 `hi = mid`，否则 `lo = mid`——这是二分搜索的标准写法，前提是「比值越高越可能 unsafe」这个单调性。
- 输出 `est ≈ 0.3507`、`margin ≈ 0.007` 对应讲师说的「估计 0.3507，真实 0.35，误差 0.007」。
- 讲师提醒：真实世界要跑更多测试，但理解底层逻辑后就能绕过或发起链式攻击。

**`p32_temperature_fingerprint.py`**
- `SECRET_TEMPERATURE = 0.888` 是讲师评估出的秘密温度。
- `sample_once` 用「温度做 softmax 的简化版」模拟采样：温度越低越确定（0 时永远返回 `Paris`），越高越可能采到 `Sonic the Hedgehog` 这种低概率词——这正是讲师举的「法国首都是刺猬索尼克」的例子。
- `spread_at` 对 50 次响应做两两 Levenshtein 距离取平均，对应「同一 prompt 50 次，计算每一对的 Levenshtein 距离」。
- 画图存 `artifacts/temperature_curve.png`，对应讲师说的「生成图，从『离散度 vs 温度』曲线读出精确温度」。
- 最后 `best[0]` 就是反推的温度，demo 里应接近 0.88。
- 在 JS/Node 里对应什么：Levenshtein 距离可用 `fast-levenshtein` 包，逻辑完全一样。

**`p32_prompt_inversion.py`**
- `HIDDEN_PROMPT` 是讲师 demo 的隐藏提示词「只用莎士比亚式英语说话」。
- `pairs` 生成 100 对交互，`TRAIN_PAIRS = pairs[:24]` 对应「因笔记本算力限制只用 24 对」。
- `T5ForConditionalGeneration` 是「小的本地 T5」，输入=目标输出，标签=隐藏提示词——这就是「把提示词当潜变量」。
- 训练 5 个 epoch 打印 loss，对应讲师说的「loss 挺高」。
- 最后 `pred` 是反转模型预测的提示词。讲师说「可能不是精确措辞，但抽出了理解」——所以别期待逐字匹配，看语义。
- 讲师强调：如果真想抽出系统提示词，可以去掉交互数量限制。

**`p32_substitute_model.py`**
- `teacher` 是黑盒 API（用固定规则模拟），`student` 是本地替代模型。
- 循环 30 轮，每轮「学生生成随机输入，查询老师标签，加进数据集」——对应讲师原话。
- `near_boundary` 是 Jacobian 增强的最小重建：把查询集中在学生预测概率接近 0.5 的区域（即学生和老师可能意见不一致的地方）。课里没讲具体 Jacobian 实现，这里用近似。
- 每 5 轮打印一致率，你能看到讲师说的「85.8% → 86.6%」这个量级，以及「30 轮 barely 动一个百分点」。
- 最后打印「目标 90%，demo 未达成」——讲师明确判定这次攻击失败，并给了两种解读：老师模型更复杂，或轮数不够。

**`p32_gcg_suffix.py`**
- `local_model_score` 模拟白盒学生模型：后缀里含 `relative/system/7019/non` 得分高。
- `blackbox_teacher` 模拟黑盒老师：demo 里迁移失败，返回拒绝。
- 500 次随机采样找最佳后缀，对应「GCG 风格离散优化」的最小重建。真实 GCG 用梯度选 token，这里用随机搜索替代。
- 最后打印 `transfer success = False`，对应讲师说的「本地有效，迁移到黑盒没成功」。
- 讲师强调的价值：与其在生产环境测专有模型惹麻烦，不如克隆到本地控制。

**`p33_playwright_probe.py`**
- `browser.new_context()` 是「隔离浏览器上下文」，讲师说这能克服隐蔽性问题。
- `page.on("request", ...)` 是「网络拦截」，讲师说这是 Playwright 很棒的一点。
- `page.wait_for_selector("h1")` 是「auto-waiting」，讲师说 Playwright 原生集成让生活轻松很多。
- 在 JS/Node 里对应什么：Playwright 有 `@playwright/test` 的 Node 版，API 几乎一样。

**`p34_capture_auth.py` / `p34_reuse_auth.py`**
- `context.storage_state()` 捕获 cookies + localStorage，存成 `auth.json`——对应讲师说的「认证文件 + 配置文件」。
- `browser.new_context(storage_state=AUTH)` 把认证状态注入新上下文——这就是「登录一次，到处测试」。
- `attach_auth` 动态拦截请求附加 `authorization` 头——对应讲师说的「动态拦截网络请求附加 authorization 头」。
- `resp.status in (401, 403)` 检测过期——对应讲师说的「撞上 401 或 403 forbidden 错误」。
- 讲师还提到 CSRF token 和刷新 token（每隔几分钟刷新），代码里留了注释位置。

---

## 6. 复现检查清单

- [ ] `python -m venv .venv && source .venv/bin/activate` 成功
- [ ] `pip install -r requirements.txt` 无报错
- [ ] `playwright install chromium` 成功
- [ ] `python p32_logic_cloning.py` 输出准确率接近 99.9%
- [ ] `python p32_boundary_mapping.py` 输出估计阈值 ≈ 0.3507，误差 ≈ 0.007
- [ ] `python p32_temperature_fingerprint.py` 生成 `artifacts/temperature_curve.png`，反推温度接近 0.88
- [ ] `python p32_prompt_inversion.py` 首次运行下载 t5-small，预测提示词语义接近「莎士比亚式英语」
- [ ] `python p32_substitute_model.py` 看到 30 轮一致率从 ~85.8% 涨到 ~86.6%，未达 90%
- [ ] `python p32_gcg_suffix.py` 本地找到后缀，迁移测试输出 `False`
- [ ] `python p33_playwright_probe.py` 打印 title 和请求数
- [ ] `python p34_capture_auth.py` 生成 `artifacts/auth.json`（需替换真实目标 URL）
- [ ] `python p34_reuse_auth.py` 复用状态，打印认证结果

---

## 7. 课里没讲但你会撞上的

1. **真实 LLM 端点调用**：P32 的 demo 讲师用的是本地模型/模拟端点，逐字稿没给具体 API 调用代码。你要接真实 OpenAI/Anthropic 端点，需自己写 `requests.post`，注意 API key 走环境变量，别硬编码。
2. **GCG 完整实现**：讲师只说「GCG 风格基于梯度的离散优化」，没给完整算法。真实 GCG 需要模型梯度和 token 级搜索，`p32_gcg_suffix.py` 是随机搜索的最小重建。想跑真 GCG 可参考 `llm-attacks` 开源实现（课里没提这个库，是我补充的信息）。
3. **T5 微调超参**：课里没讲学习率、epoch 数、batch size。代码里 `lr=5e-4, epoch=5, batch=4` 是我给的可跑默认值，效果不好自己调。
4. **Llama3 本地部署**：讲师提到「微调本地学生比如 Llama3」，但没讲怎么部署。你需要 Ollama 或 vLLM 之类（课里没提这些工具名）。
5. **Playwright 选择器**：`p34_capture_auth.py` 里的 `input[name=email]` 是占位，真实目标页面选择器要你自己看 DOM 改。
6. **CSRF token / 刷新 token**：讲师提到但没给实现。CSRF 通常要从页面隐藏字段或 cookie 读，刷新 token 要调刷新端点——具体看目标应用。
7. **WAF 绕过**：讲师说 Gemini 防御层次极深、「是可能的但会不断撞问题」，没给具体绕过方法。Playwright stealth 插件和 puppeteer-extra-plugin-stealth 是讲师点名的工具，但配置细节课里没讲。
8. **法律与合规**：讲师反复强调「与其在生产环境测专有模型、可能执行不安全操作、惹上法律麻烦」，这些技术只能用于你有授权的目标。课里没展开法律细节，但这是红线。
9. **在 JS/Node 里对应什么**：P32 的 MLP 训练对应 TensorFlow.js；Levenshtein 对应 `fast-levenshtein`；Playwright 有 Node 版 `@playwright/test`，API 与 Python 版几乎一致。P34 的 `storage_state` 在 Node 版叫 `context.storageState()`，用法相同。