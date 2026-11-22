# Agentic AI System Design（P10）：Guardrails 中间件 + 长任务规划器（Planner）

> 本文覆盖 P10（第 2/2 段，67:36–137:06）。这一段干了两件事：先把「安全」收尾——**guardrails 就是 middleware**，演示 PII 脱敏与内容过滤；然后切入整门课的高潮——**长任务（long running task）的 Planner 架构**：把复杂需求拆成 DAG 任务图，落库到 SQLite，逐条执行、逐条用 LLM 评审，最终在磁盘上真的生成一个 Todo App，并且还能 `/ask` 追问、改样式。
>
> **关于代码的说明（必读）**：讲师本段是在屏幕上直接展示自己仓库里的源码，但本段提供的截图 OCR 结果为空，逐字稿也只念了部分代码。因此第 4 节给出的是**按讲师口述的文件名、函数名、字段名、中间件策略重建的可直接运行实现**，凡是课里明确说过的（`planner.py`、`orchestrator.py`、`approval.py`、`task.db`、`execution_plan`、`depends_on`、`acceptance_criteria`、`max_retry`、`execution_order` 等）都原样保留；课里没念到的细节，我会在第 4、7 节明确标注「课里没讲，这里是本实现的补全」。这样你既能跑起来，也不会把我的推测当成讲师的原话。

---

## 1. 这一节做什么

这一段的目标产物有两个，都能在终端里亲手跑出来。

**产物一：一个带 guardrails 的对话 Demo。** 你在终端里输入「我的卡号是 4111 1111 1111 1111」「我的 API key 是 sk-xxxx」「我的密码是 abc123」，程序在**把用户输入发给 LLM 之前**就把这些 PII 按策略处理掉（脱敏、掩码、哈希或者直接拦截报错），你在 LangSmith 的 trace 里能看到 `PII middleware` 调用、能看到「最终发给模型的那条消息里已经不含明文」。同时你还输入「怎么 hack prod db」，会被一个自定义的 `content_filter_middleware` 在模型调用前短路掉，直接返回「我无法处理包含不当内容的请求」。关键认知只有一句：**guardrails 不是另一个神秘系统，它就是你在框架里注册的一个 middleware**，和你之前写的记忆中间件、摘要中间件、调用次数限制中间件是同一类东西。

**产物二：一个 Planner Agent，也就是「你自己版本的 Claude Code」的最小可行版。** 你在主菜单里输入 `/plan 用 HTML、CSS、JavaScript 做一个好看的 Todo App`，它会：

1. 调 LLM，用**结构化输出**（Pydantic schema）产出一份 `ExecutionPlan`：项目名、目标摘要、技术栈、预估总时长、5–20 个子任务、风险、假设；
2. 每个子任务带 `id`、`title`、`description`、`type`（design / implement / test / review / integrate / configure）、`depends_on`（依赖关系，整体必须是 **DAG**）、`acceptance_criteria`、`output_files`；
3. 把计划打印出来让你 **approve / modify / reject / replan**；
4. 你 approve 之后，计划被写进 SQLite 的 `task.db`，你会看到 10 行任务，第一行 `in_progress`，其余 `pending`；
5. 一个 `while` 循环不断挑出「依赖已全部完成」的下一个任务，用接入了**文件系统 MCP server**（stdio 传输、allow directory 限定目录）的 agent 去执行，把产物**写进磁盘**——`index.html`、`style.css`、`app.js`、`review-notes.md`、`test-report.md` 真的会出现在工作目录里；
6. 每完成一个任务，用 **LLM as judge** 评一次质量，把上一个任务的结果**摘要后**作为下一个任务的上下文；
7. 全部跑完后，你可以 `/ask` 继续追问「解释一下 app.js 的代码」，因为生成的代码被**重新索引进了 ChromaDB**，所以 RAG 能检索到刚生成的产物；你也可以让它改样式，它会通过 filesystem MCP 落到文件上。

整个过程中你会亲眼看到讲师踩的那个坑：**在 agent factory 里既保留了旧的 file tools、又接入了 MCP server，模型会困惑，导致「找不到文件 / path not allowed」**。这个坑的修法在第 3 节第 9 步。

另外，这一段还顺带澄清了几件事：ReAct agent 的「推理—行动」循环为什么天然会重复调工具、为什么必须加调用次数限制中间件；deterministic guardrail 与 model-based guardrail 的区别；为什么「屏蔽脏词」可以直接发给模型让它改写，但「信用卡、密码」必须在发送前拦住；以及为什么这套五周做出来的东西**不能**直接替代公司里真正的 Claude Code。

---

## 2. 讲师原话

先给这段的定调。讲师在切入 guardrails 时先解释了它存在的意义：

> "Guardrails 帮助你构建安全、合规的 AI 应用，防止 PII 泄漏。"
> —— p010 [68:00]

紧接着定义了 PII（Personally Identifiable Information，个人可识别信息）：

> "什么是 PII？就是 Personally Identifiable Information。举个例子：你的信用卡号、你的密码，甚至你的邮箱、位置、健康记录、驾照号。"
> —— p010 [68:29]

然后给出了本节最重要的一个判断——**guardrails 的载体就是 middleware**：

> "guardrails 是通过 middleware 实现的，你完全说得对。你去看看你预置的 middleware 列表，是不是有一个专门做 PII 检测的 middleware？"
> —— p010 [70:49]

对于 PII 的处理策略，讲师列了四种，并强调这是「策略」而不是「功能」：

> "一种是 redact，看到邮箱就替换成 ABC，或者直接写「已脱敏的邮箱」，不给你看；一种是 mask，除了最后四位，其他数字都盖掉；hash 是把真实值换成哈希；block 就是直接抛错——你为什么要这么干？所以处理个人信息有不同的策略。"
> —— p010 [69:55]

最关键的一条工程判断，是「拦截点放在哪」：

> "当我发出去的时候，你觉得这个改动应该由 LLM 来做，还是应该在发给 LLM 之前就被拦掉？应该在发给 LLM 之前就拦住。所以这不只是给工具用的，在用户 query 发到 LLM 之前，我们就得做这个检查。"
> —— p010 [75:00]

guardrails 分两类，讲师用 evals 做了类比：

> "往下翻你会看到 guardrails 有两种：一种是 deterministic（确定性的），一种是 model-based（用模型的）。确定性就是规则，正则匹配、关键词匹配；model-based 就是用 LLM。就跟 evals 一样，你可以跑公式，也可以用 LLM as judge。到处都是这两个选项：要么写死规则，要么让模型来判断。"
> —— p010 [83:57]

那到底该不该把请求发给模型？讲师说这取决于你要解决什么问题：

> "这取决于 guardrail 的类型。比如只是屏蔽关键词，像 hacking、ransomware 这种，你可以发给模型，让它改写、让它避开这些词；但如果是信用卡、是你的密码，那你就必须保证它不会被发给模型。所以这取决于你在解决什么问题——这就是为什么我给了你们这么多种不同的例子。"
> —— p010 [85:50]

安全部分收尾后，讲师转到长任务，先补了 ReAct 的定义：

> "我们到目前为止一直在创建的这种 agent，叫 ReAct agent。ReAct 是什么？是 reasoning and action——推理和行动。先调工具，然后发生一些推理、一些思考过程，然后采取行动，所以它是推理和行动的组合，是一个循环。"
> —— p010 [87:45]

这个循环正是为什么必须加调用次数上限：

> "所以我们必须给模型调用次数、工具调用次数加个限制，这就是我们加 middleware 的原因——因为有循环，它会一遍一遍地做。"
> —— p010 [89:38]

进入 Planner，讲师先讲它和 ReAct 的区别，以及为什么需要持久化：

> "如果我跟你说「设计一个 Claude Code」，你第一件事会做什么？你会把它拆成小任务，或者先做计划。所以会有很多子任务要处理，而且如果崩溃了，我们还得能恢复——所以我们需要持久化，才能处理崩溃和恢复。"
> —— p010 [90:06]

计划本身必须落库，所以要有一个 task store 去和 DB 说话：

> "现在我们必须把这些任务存到持久化层，这很重要。如果要用 SQLite，我就得有一个 task store，所有任务都存在这里，它就是跟持久化层、跟 DB 打交道的那个东西。我们还需要一个 planner 层。"
> —— p010 [91:00]

Planner 的 system prompt 讲师逐条念过，这是整段最值得抄下来的部分：

> "第一个问题是：你是一个资深软件架构师，你的职责是把它拆成 5 到 20 个任务。你要给我 task ID；一个任务依赖哪些别的任务——因为我想让子任务能够并行跑，所以顺序必须是一个 DAG。你能告诉我为什么吗？因为我们要拓扑序，才能保证一个任务在另一个之后；否则出现循环依赖，就一个任务都跑不了。output files 必须列出每一个文件；每个任务要写验收标准；task type 必须是 design、implement、test、review、integrate 或 configure 之一。"
> —— p010 [101:25]

关于结构化输出要不要再校验，讲师给了一个省事的答案：

> "我们需要校验输出 schema 吗？如果你用的是结构化输出（structured response），就不需要，因为框架已经帮你处理了。"
> —— p010 [105:35]

最后是那个真实的 debug 现场。讲师先复现了故障：

> "我犯的错是：虽然我加了 MCP server，但在 agent factory 的 create agent 里我原来就有这些工具，我没把它们删掉。所以有时候它会困惑，这就是它没能正确写文件的原因。所以只要把原来的工具删掉，我觉得就能工作。"
> —— p010 [126:07]

以及 MCP server 的启动方式：

> "用了 allow directory 之后，它就在 stdio 上跑这个 filesystem server，你能看到它说已经更新了。"
> —— p010 [129:27]

模型配置讲师也交代了：

> "我现在用的模型是什么？看 config.yaml，现在是 4.0。如果我用 5.5，我确定它生成的会好得多。"
> —— p010 [130:52]

顺带解释了为什么小 demo 不用 poetry：

> "因为它就是一个单文件的 demo，不是一个我要安装到别处的正式包，就是一个 Python 文件。做小项目、就一两个文件、只是演示的时候，requirements.txt 就够了。"
> —— p010 [132:44]

![p010 68:34 讲师切入 guardrails 并解释 PII 的定义与四类处理策略](images/p010_4114s.jpg)

---

## 3. 从零复现

这一节是操作手册。你按顺序做，最后应该得到：一个能拦截 PII 的终端 Demo + 一个能生成 Todo App 的 Planner。

### 3.0 环境与目录

Python 3.11+。Node.js 18+（filesystem MCP server 通过 `npx` 启动，必须装）。一个能用的模型 API Key（讲师用的是 `config.yaml` 里写的模型，OpenAI 兼容即可）。可选但强烈建议：LangSmith 账号（后面所有「看到 middleware 调用」都是靠它）。

目录结构（`safety_demos` 按讲师说的，把 guardrails 和 human-in-the-loop 放在同一个环境下）：

```
agentic-capstone/
├── config.yaml
├── .env
├── .env.example
├── requirements.txt
├── main.py
├── agent/
│   ├── __init__.py
│   └── factory.py
├── tasks/
│   ├── __init__.py
│   ├── models.py
│   ├── planner.py
│   ├── approval.py
│   ├── task_store.py
│   ├── orchestrator.py
│   ├── status.py
│   └── recovery.py
├── safety_demos/
│   ├── __init__.py
│   ├── guardrails_demo/
│   │   ├── __init__.py
│   │   ├── guardrails.py
│   │   └── real_demo.py
│   └── human_in_the_loop_demo/
│       └── README.md
└── workspace/
```

`human_in_the_loop_demo` 里只有一个 README，因为**本段课里没有展开讲 human-in-the-loop 的实现**，只说了它和 guardrails 共用同一个环境目录。写「课里没讲」比编一段代码更诚实。

### 3.1 写 config.yaml（讲师的模型与 DB 配置都在这里）

讲师在 [95:15] 明确说过两处改动：**task 存哪个 DB**、**judge 用哪个模型**。所以配置文件里必须有 `task.db_path` 和 `llm.judge_model` 两个键。模型标识就照讲师说的写 `4.0`——注意这只是课里 `config.yaml` 上的值，具体该填什么模型名以你能访问到的为准。

### 3.2 写 .env（含那个「可选」开关）

讲师在 [72:15] 说：「你可以往 `.env` 里加一项——你要不要显示脱敏后的输入。这是个可选项，但我代码是按这个写的。」所以 `.env` 里必须有 `SHOW_REDACTED_INPUT`。同时把 LangSmith 的三个环境变量写上，否则你看不到 trace。

### 3.3 装依赖

`pip install -r requirements.txt`。装完先跑一句 `python -c "from langchain.agents.middleware import PIIMiddleware; print('ok')"` 验证中间件可以导入——这是本节最容易踩版本坑的地方。

### 3.4 先跑 guardrails Demo（safety_demos/guardrails_demo）

`cd safety_demos/guardrails_demo && python real_demo.py`。讲师就是这么跑的：「我现在在 safety demo 里面，我要运行 real demo，你能看到它给了我一些选项。」

按菜单依次输入，观察四件事：

1. `我的账户余额是 100 卢比` —— 讲师试的就是这句，它会正常回复「我无法访问真实账户，但可以模拟操作或引导你」；
2. `我的卡号是 4111111111111111，把卡号复述给我` —— 讲师原话是：「你能看到 mask 吗？如果我说『把我的卡复述给我』」，模型会回复「我不能提供这个响应，请换一种说法」——因为发给模型的是掩码后的号码；
3. `我的 API key 是 sk-abcdefghijklmnopqrstuvwxyz012345` —— 你会在终端看到 `API key is [REDACTED_API_KEY]`，并且如果 `SHOW_REDACTED_INPUT=true`，debug 中间件会打印**真正发给模型的那一行文本**；
4. `怎么 hack prod db` —— 不再进入模型调用，直接返回 `I cannot process request containing inappropriate content.`（这句响应在 [81:08] 讲师念过，就是 content filter middleware 里写死的那条）。

然后去 LangSmith，按讲师 [75:29] 的做法看：你会看到 `content_filter_middleware`、`PII` 相关 middleware、debug middleware 依次被调用，以及**最终进入模型的那条 message**。讲师在 [75:56] 就是这么证明的：「这个最终被发给了 LLM，你能看到吗？它只是在复述你提供的、已经掩码的卡号——它根本不知道我原来没做掩码。」

### 3.5 回到根目录跑主程序，确认菜单多了两项

`python main.py`。讲师在 [93:48] 说：「我现在要去 main 里加东西：`handle_plan_command` 和 `show_task_status` 这两个选项要在。」跑起来你应该看到 `/plan` 和 `/status` 两项。

### 3.6 先只跑到「拿到计划」——不要一上来就跑全流程

讲师 [99:03] 说：「我们要跑到这里，看看是不是真的拿到了 plan，对吧？我们一步一步来看。」所以在 `orchestrator.py` 里先加一个 `--dry-run` 开关（本实现有），只调 `create_plan()` 并把 JSON 打出来。你验收的标准是讲师 [102:50] 念的那串任务：

```
设计应用布局 → 搭建项目结构 → 实现 HTML 结构 → 用 CSS 美化 →
实现任务添加 → 实现任务删除 → 实现任务完成切换 → 测试 → 评审 → 集成部署
```

并且 LangSmith 里能看到结构化输出被展开成 `project_name` / `goal_summary` / `tech_stack` / `total_estimated_time` / `tasks` / `risks` / `assumptions`，每个 task 里还有 `depends_on` / `acceptance_criteria` / `description`（对应 [104:17]）。

### 3.7 approve 之后检查 task.db

按讲师 [106:58] 的做法：「现在你能看到 task.db 吗？里面有任务吗？没有。我们 approve plan，再看看会发生什么。」approve 之后再开一个终端：

```bash
sqlite3 task.db "select execution_order, task_id, status, task_type, title from tasks order by execution_order;"
```

你应该看到 10 行、第一行 `in_progress`、其余 `pending`（[107:52]）。再等一会刷新，会看到前三行 `completed`、第四行 `in_progress`（[108:49]）。已完成的那些 `output` 列里要有结果——讲师强调过：「完成的任务也给出了结果作为产出，我们会把它用在下一个任务里，让下一个任务知道上一个任务的产出是什么。我是把上一个任务的结果摘要之后留存下来的。」

### 3.8 看磁盘

全部跑完后，`workspace/<project_name>/` 下应该有 `index.html`、`style.css`、`app.js`、`review-notes.md`、`test-report.md`。讲师 [111:08] 就是挨个点开给你看的。

### 3.9 修那个「path not allowed」的坑（本段最有价值的一步）

讲师在 [112:35] 演示：`/ask 改进 style.css 的样式`，agent 报 **unable to access the files**；`/ask` 让它读文件，它说 **Access denied. Path not allowed.** 讲师 [113:04] 说：「为什么 path not allowed？上课一定要知道点什么，不然就会出错。」

真正的根因在 [126:07] 被他自己找到了：**agent factory 里原来的 file tools 没删，和新接入的 MCP filesystem tools 同时存在，模型在选择工具时会困惑。** 修法就是把 `agent/factory.py` 里的旧 tools 列表清空，只保留 MCP 提供的 tools。改完重试：

- `/ask 在 review 文件夹里写一个文件` —— 讲师 [128:34] 试了这条，成功了；
- `/ask 更新 css 文件夹里 style.css 的样式，让它更好看` —— 讲师 [129:01] 试了这条，agent 先请求确认 `would you like to proceed`，回 yes 之后它跑起 stdio 的 filesystem server，回复「已用改进后的样式更新」；
- `/ask 把 app 的 UI 主色从蓝色改成红色` —— 讲师 [130:24] 试了这条，它自己判断出改哪个文件，并真的改成功了。

### 3.10 再验一次 RAG 的「新鲜度」

`/ask 解释一下 app.js 的代码`。讲师 [114:28] 说：「你能看到 retrieval 也在发生，因为 RAG 在那儿。生成出来的代码在生成的那一刻我就重新索引了，更新了 ChromaDB，所以它现在能回答我。」这一步能过，说明你的「生成→重索引→可检索」闭环打通了。

![p010 77:43 讲师打开主程序与 build_guardrails 函数，说明 guardrails 也是中间件](images/p010_4663s.jpg)

---

## 4. 完整代码

> 再次提醒：本段截图 OCR 为空，课里没有给出这些文件的完整文本。以下代码是按讲师口述的文件名/函数名/字段名/策略重建的**可运行实现**；凡课里明确念到的标识符都保持原样。若你在自己环境里 import 失败，请看第 7 节第 1 条。

### 4.1 `requirements.txt`

```text
# 课里没有给出 requirements.txt 的完整内容（只说了「单文件小 demo 用 requirements.txt 就够」）。
# 下面是一组能跑通本方案的版本；若 pip 解析失败，把它们放宽成区间即可，
# middleware 的具体 API 以你安装版本的 langchain.agents.middleware 导出为准。
langchain==1.0.3
langchain-openai==1.0.2
langgraph==1.0.2
langchain-mcp-adapters==0.1.9
langsmith==0.4.37
pydantic==2.11.9
python-dotenv==1.1.1
PyYAML==6.0.3
```

### 4.2 `config.yaml`

```yaml
llm:
  provider: openai
  # 讲师原话：看 config.yaml，现在是 4.0；如果我用 5.5 会好得多。
  # 这里填你能访问到的模型名。
  model: "4.0"
  judge_model: "4.0"          # 每个子任务跑完，用它当裁判评质量
  temperature: 0

task:
  db_path: "task.db"          # 所有任务存在这个 SQLite 文件里
  max_retry: 2                # 任务失败重试上限（tasks 表里的 max_retry 列）
  min_tasks: 5                # planner prompt：拆 5 到 20 个任务
  max_tasks: 20
  judge_enabled: true

workspace:
  root: "./workspace"         # 生成出来的文件落在这里
  allowed_dirs: ["./workspace"]  # filesystem MCP server 的 allow directory

guardrails:
  show_redacted_input_env: "SHOW_REDACTED_INPUT"
```

### 4.3 `.env.example`

```dotenv
OPENAI_API_KEY=sk-your-real-key

# LangSmith（讲师所有「看 middleware 调用」的演示都靠这个）
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=lsv2_pt_xxx
LANGCHAIN_PROJECT=agentic-capstone

# 讲师在 .env 里加的可选项：要不要把「脱敏后真正发给模型的输入」打印出来
SHOW_REDACTED_INPUT=false
```

### 4.4 `tasks/models.py`（结构化输出的 Pydantic schema）

```python
from typing import Literal
from pydantic import BaseModel, Field

TaskType = Literal["design", "implement", "test", "review", "integrate", "configure"]

# 状态枚举：课里只出现了 in_progress 与 completed（[107:52]、[108:49]），
# 其余取值是本实现补的。
TaskStatus = Literal["pending", "in_progress", "completed", "failed", "blocked"]


class TaskSpec(BaseModel):
    id: str = Field(description="任务唯一编号，例如 T1、T2")
    title: str = Field(description="一句话任务标题")
    description: str = Field(description="这个任务具体要做什么")
    type: TaskType = Field(description="任务类型")
    depends_on: list[str] = Field(
        default_factory=list,
        description="依赖的任务 id；整体必须构成有向无环图（DAG）",
    )
    acceptance_criteria: list[str] = Field(
        default_factory=list, description="可验证的验收标准"
    )
    output_files: list[str] = Field(
        default_factory=list, description="这个任务会写出的每一个文件路径"
    )
    estimated_minutes: int = Field(default=10, description="预估耗时（分钟）")


class ExecutionPlan(BaseModel):
    project_name: str
    goal_summary: str
    tech_stack: list[str]
    total_estimated_time: str
    tasks: list[TaskSpec]
    risks: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
```

### 4.5 `tasks/planner.py`

```python
from langchain.agents import create_agent

from tasks.models import ExecutionPlan
from agent.factory import build_chat_model

# 讲师在 [101:25] 逐条念过这段 system prompt 的内容，这里是中文还原。
PLANNER_SYSTEM_PROMPT = """你是一名资深软件架构师。
你的职责是把用户的需求拆解成 5 到 20 个可以独立执行的子任务。

必须遵守的规则：
1. 每个任务必须有唯一的 task id，并在 depends_on 里声明它依赖哪些任务。
2. 任务之间的依赖整体必须构成有向无环图（DAG），不允许出现循环依赖，
   这样才能对任务做拓扑排序，也才能让互不依赖的子任务并行执行。
3. output_files 必须列出该任务会写出的每一个文件。
4. 每个任务必须给出可验证的 acceptance_criteria。
5. type 只能是 design、implement、test、review、integrate、configure 之一。
6. 如果需求信息不足，把你做的假设写进 assumptions，不要停下来反问。
"""


def create_plan(goal: str, config: dict) -> ExecutionPlan:
    """把一句自然语言需求，变成结构化执行计划。"""
    model = build_chat_model(config, role="planner")
    agent = create_agent(
        model=model,
        tools=[],                                # planner 不调工具，只产出计划
        system_prompt=PLANNER_SYSTEM_PROMPT,
        response_format=ExecutionPlan,           # 结构化输出，框架负责校验 schema
    )
    result = agent.invoke({"messages": [{"role": "user", "content": goal}]})
    return result["structured_response"]
```

### 4.6 `tasks/approval.py`

```python
from tasks.models import ExecutionPlan

# 课里没有用 langchain 现成的 human-in-the-loop，而是自己 print + input。
# 讲师原话：literally asking approve, modify or reject，还可以 re-plan。
def present_plan_for_approval(plan: ExecutionPlan):
    print("\n================ 执行计划 ================")
    print(f"项目名    : {plan.project_name}")
    print(f"目标      : {plan.goal_summary}")
    print(f"技术栈    : {', '.join(plan.tech_stack)}")
    print(f"预估耗时  : {plan.total_estimated_time}")
    if plan.risks:
        print(f"风险      : {'; '.join(plan.risks)}")
    if plan.assumptions:
        print(f"假设      : {'; '.join(plan.assumptions)}")
    print("------------------------------------------")
    for i, t in enumerate(plan.tasks, 1):
        deps = ",".join(t.depends_on) or "-"
        print(f"{i:>2}. [{t.type:<9}] {t.title}  (id={t.id}, depends_on={deps})")
    print("==========================================\n")

    choice = input("approve / modify / reject / replan > ").strip().lower()
    if choice == "approve":
        return {"action": "approve", "feedback": ""}
    if choice == "modify":
        feedback = input("想改什么？> ").strip()
        return {"action": "modify", "feedback": feedback}
    if choice == "replan":
        feedback = input("重新规划时要注意什么？> ").strip()
        return {"action": "replan", "feedback": feedback}
    return {"action": "reject", "feedback": ""}
```

### 4.7 `tasks/task_store.py`（跟 SQLite 打交道的唯一入口）

```python
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DDL = """
CREATE TABLE IF NOT EXISTS projects (
    project_id   TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    goal         TEXT NOT NULL,
    plan_json    TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id            TEXT PRIMARY KEY,
    project_id         TEXT NOT NULL,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL,
    task_type          TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending',
    depends_on         TEXT NOT NULL DEFAULT '[]',
    output_files       TEXT NOT NULL DEFAULT '[]',
    acceptance_criteria TEXT NOT NULL DEFAULT '[]',
    output             TEXT,
    review             TEXT,
    retry              INTEGER NOT NULL DEFAULT 0,
    max_retry          INTEGER NOT NULL DEFAULT 2,
    execution_order    INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT,
    started_at         TEXT,
    completed_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class TaskStore:
    def __init__(self, db_path: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL;")

    def init_schema(self):
        self.conn.executescript(DDL)
        self.conn.commit()

    # ---------- project ----------
    def create_project(self, project_name: str, goal: str, plan_json: str) -> str:
        pid = f"proj_{uuid.uuid4().hex[:8]}"
        self.conn.execute(
            "INSERT INTO projects(project_id, project_name, goal, plan_json, created_at)"
            " VALUES (?,?,?,?,?)",
            (pid, project_name, goal, plan_json, _now()),
        )
        self.conn.commit()
        return pid

    # ---------- tasks ----------
    def insert_tasks(self, project_id: str, tasks_in_order, max_retry: int = 2):
        """按拓扑序写入，execution_order 就是它在拓扑序里的位置。"""
        rows = []
        for order, t in enumerate(tasks_in_order):
            rows.append(
                (
                    t.id,
                    project_id,
                    t.title,
                    t.description,
                    t.type,
                    "pending",
                    json.dumps(t.depends_on, ensure_ascii=False),
                    json.dumps(t.output_files, ensure_ascii=False),
                    json.dumps(t.acceptance_criteria, ensure_ascii=False),
                    max_retry,
                    order,
                    _now(),
                )
            )
        self.conn.executemany(
            "INSERT OR REPLACE INTO tasks(task_id, project_id, title, description,"
            " task_type, status, depends_on, output_files, acceptance_criteria,"
            " max_retry, execution_order, created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
        self.conn.commit()

    def list_tasks(self, project_id: str):
        cur = self.conn.execute(
            "SELECT * FROM tasks WHERE project_id=? ORDER BY execution_order", (project_id,)
        )
        return [dict(r) for r in cur.fetchall()]

    def next_runnable_task(self, project_id: str):
        """状态为 pending，且它依赖的任务全部 completed 的第一个任务。"""
        rows = self.list_tasks(project_id)
        done = {r["task_id"] for r in rows if r["status"] == "completed"}
        for r in rows:
            if r["status"] != "pending":
                continue
            deps = json.loads(r["depends_on"])
            if all(d in done for d in deps):
                return r
        return None

    def mark_in_progress(self, task_id: str):
        self.conn.execute(
            "UPDATE tasks SET status='in_progress', started_at=? WHERE task_id=?",
            (_now(), task_id),
        )
        self.conn.commit()

    def mark_completed(self, task_id: str, output: str, review: str):
        self.conn.execute(
            "UPDATE tasks SET status='completed', output=?, review=?, completed_at=?"
            " WHERE task_id=?",
            (output, review, _now(), task_id),
        )
        self.conn.commit()

    def mark_failed(self, task_id: str, review: str):
        self.conn.execute(
            "UPDATE tasks SET status='failed', review=? WHERE task_id=?", (review, task_id)
        )
        self.conn.commit()

    def bump_retry(self, task_id:
```python
    def bump_retry(self, task_id: str) -> int:
        self.conn.execute("UPDATE tasks SET retry = retry + 1 WHERE task_id=?", (task_id,))
        self.conn.commit()
        row = self.conn.execute(
            "SELECT retry FROM tasks WHERE task_id=?", (task_id,)
        ).fetchone()
        return int(row["retry"])

    def requeue_in_progress(self, project_id: str):
        """进程崩溃重启后，把卡在 in_progress 的任务退回 pending。
        课里只说这件事由 recovery manager 配合 SQLite store 负责，具体 SQL 没讲。"""
        self.conn.execute(
            "UPDATE tasks SET status='pending', started_at=NULL"
            " WHERE project_id=? AND status='in_progress'",
            (project_id,),
        )
        self.conn.commit()

    def progress(self, project_id: str) -> dict:
        rows = self.list_tasks(project_id)
        done = sum(1 for r in rows if r["status"] == "completed")
        return {"total": len(rows), "completed": done, "rows": rows}
```

### 4.8 `tasks/recovery.py`（断点续跑）

```python
# 讲师原话：这次的简单流程不谈 resumability，resume 是「已经有项目在建」时走的另一条分支，
# 入口在 SQLite store，由 recovery manager 负责。这里给出最小实现。
# 课里没有展示 recovery.py 的代码内容，以下为按口述职责补全。


class RecoveryManager:
    def __init__(self, store):
        self.store = store

    def has_resumable_project(self, project_id: str) -> bool:
        progress = self.store.progress(project_id)
        if progress["total"] == 0:
            return False
        # 有任务没跑完（pending / in_progress / failed）就算「可恢复」
        return any(
            r["status"] in ("pending", "in_progress", "failed")
            for r in progress["rows"]
        )

    def prepare_resume(self, project_id: str) -> dict:
        """把崩溃时卡在 in_progress 的任务退回 pending，然后返回下一个可跑的任务。"""
        self.store.requeue_in_progress(project_id)
        return {
            "progress": self.store.progress(project_id),
            "next_task": self.store.next_runnable_task(project_id),
        }
```

### 4.9 `tasks/status.py`（任务状态展示）

```python
def show_task_status(store, project_id: str):
    if not project_id:
        print("还没有任何项目，先执行 /plan 创建一个。")
        return

    progress = store.progress(project_id)
    if progress["total"] == 0:
        print(f"项目 {project_id} 下还没有任务。")
        return

    print(f"\n项目 {project_id}：{progress['completed']}/{progress['total']} 已完成")
    print("-" * 118)
    print(f"{'序':>2} {'task_id':<8} {'type':<10} {'status':<12} {'retry':<7} 标题")
    print("-" * 118)
    for i, r in enumerate(progress["rows"], 1):
        retry = f"{r['retry']}/{r['max_retry']}"
        print(f"{i:>2} {r['task_id']:<8} {r['task_type']:<10} {r['status']:<12} {retry:<7} {r['title']}")
    print("-" * 118)

    # 讲师在 [108:49] 演示过：点开某一行能看到 output、创建/开始/完成时间
    for r in progress["rows"]:
        if r["status"] == "completed" and r["output"]:
            head = r["output"].strip().splitlines()
            brief = head[0][:70] if head else ""
            print(f"  · {r['task_id']} 产出摘要：{brief}")
            print(f"    created={r['created_at']}  started={r['started_at']}  completed={r['completed_at']}")
            if r.get("review"):
                print(f"    judge 评审：{r['review']}")
```

### 4.10 `tasks/orchestrator.py`（`/plan` 的总入口）

```python
import asyncio
import json

from agent.factory import build_chat_model, build_executor_agent, build_mcp_tools
from tasks.approval import present_plan_for_approval
from tasks.planner import create_plan

MAX_ITERATIONS = 40  # 等价于之前给 ReAct agent 加的调用次数上限，防止死循环


def topo_sort(tasks):
    """Kahn 算法。
    讲师在 [101:54] 强调 depends_on 必须是 DAG：要拓扑序，否则循环依赖会让一个任务都跑不了。
    """
    id_to_task = {t.id: t for t in tasks}
    indeg = {t.id: 0 for t in tasks}
    children = {t.id: [] for t in tasks}

    for t in tasks:
        for d in t.depends_on:
            if d not in id_to_task:
                raise ValueError(f"任务 {t.id} 依赖了不存在的任务 {d}")
            indeg[t.id] += 1
            children[d].append(t.id)

    queue = [tid for tid, n in indeg.items() if n == 0]
    order = []
    while queue:
        tid = queue.pop(0)
        order.append(id_to_task[tid])
        for c in children[tid]:
            indeg[c] -= 1
            if indeg[c] == 0:
                queue.append(c)

    if len(order) != len(tasks):
        raise ValueError("计划里存在循环依赖，无法拓扑排序")
    return order


def handle_plan_command(goal: str, config: dict, store, dry_run: bool = False) -> str:
    """第一步：创建计划；第二步：给它审批；第三步：落库；第四步：逐条执行。"""
    # ---- 1. 创建计划（应有一个 planner.py 来干这件事）----
    plan = create_plan(goal, config)

    # 讲师 [99:03]：先跑到这里，看看是不是真的拿到了 plan，一步一步来
    if dry_run:
        print(json.dumps(plan.model_dump(), ensure_ascii=False, indent=2))
        return ""

    # ---- 2. 审批：approve / modify / reject / replan ----
    while True:
        decision = present_plan_for_approval(plan)
        if decision["action"] == "approve":
            break
        if decision["action"] == "reject":
            print("已放弃这份计划。")
            return ""
        if decision["action"] == "modify":
            plan_hash = json.dumps(plan.model_dump(), ensure_ascii=False)
            plan = create_plan(
                f"{goal}\n\n在你上一版计划的基础上做如下修改：{decision['feedback']}\n"
                f"上一版计划：{plan_hash}",
                config,
            )
            continue
        if decision["action"] == "replan":
            goal = f"{goal}\n\n重新规划时的额外要求：{decision['feedback']}"
            plan = create_plan(goal, config)
            continue

    # ---- 3. 落库：先拓扑排序，再按顺序写进 task.db ----
    ordered = topo_sort(plan.tasks)
    project_id = store.create_project(
        plan.project_name, goal, json.dumps(plan.model_dump(), ensure_ascii=False)
    )
    store.insert_tasks(project_id, ordered, max_retry=config["task"]["max_retry"])
    print(f"计划已写入 DB，project_id={project_id}，共 {len(ordered)} 个任务。")

    # ---- 4. 执行 ----
    execute_plan(project_id, config, store)
    return project_id


def execute_plan(project_id: str, config: dict, store):
    """一个 while 循环，不断挑出「依赖已全部完成」的下一个任务。
    讲师 [115:22]：任务 DB 里会有多条任务，会有一个 while 循环把所有任务跑完，并不断更新 DB。
    """
    mcp_tools = asyncio.run(build_mcp_tools(config))
    context = ""          # 上一个任务结果的摘要，会喂给下一个任务
    iterations = 0

    while iterations < MAX_ITERATIONS:
        iterations += 1
        task = store.next_runnable_task(project_id)
        if task is None:
            print("没有可执行的任务了，检查是否还有 pending/failed。")
            break

        store.mark_in_progress(task["task_id"])
        print(f"\n▶ 开始执行 {task['task_id']}：{task['title']}")

        try:
            output = run_single_task(task, context, config, mcp_tools)
        except Exception as exc:                      # 任务级失败不炸整个流程
            store.bump_retry(task["task_id"])
            store.mark_failed(task["task_id"], f"执行异常：{exc}")
            print(f"✗ {task['task_id']} 执行失败：{exc}")
            continue

        # 每个子任务跑完，用 LLM as judge 评一次质量
        review = judge_task(task, output, config) if config["task"]["judge_enabled"] else "{}"
        store.mark_completed(task["task_id"], output, review)
        print(f"✓ {task['task_id']} 完成，judge 结论：{review}")

        # 把结果摘要，带进下一个任务
        context = summarize_output(output, config)


def run_single_task(task: dict, context: str, config: dict, mcp_tools) -> str:
    agent = build_executor_agent(config, mcp_tools)

    criteria = json.loads(task["acceptance_criteria"])
    files = json.loads(task["output_files"])
    prompt = f"""你在执行一个多任务项目里的单个子任务。

任务 id：{task['task_id']}
任务类型：{task['task_type']}
任务标题：{task['title']}
任务描述：{task['description']}
需要写出的文件：{files}
验收标准：{criteria}

上一个任务的结果摘要（可能为空）：
{context or "（无）"}

请直接使用文件系统工具把文件写到工作目录里，然后在回复里简述你做了什么、写了哪些文件。
"""

    result = agent.invoke(
        {"messages": [{"role": "user", "content": prompt}]},
        config={"recursion_limit": 60},   # 又是一个循环上限
    )
    return result["messages"][-1].content


def judge_task(task: dict, output: str, config: dict) -> str:
    """LLM as judge：讲师 [95:15] 说为此专门加了一个 judge 模型。"""
    model = build_chat_model(config, role="judge")
    criteria = json.loads(task["acceptance_criteria"])
    prompt = f"""你是严格的代码评审。请判断下面这个子任务是否达成验收标准。

任务：{task['title']}
验收标准：{criteria}
执行者自述：
{output}

只输出 JSON：{{"passed": true/false, "score": 0-10, "issues": ["..."]}}
"""
    resp = model.invoke([{"role": "user", "content": prompt}])
    return resp.content if isinstance(resp.content, str) else str(resp.content)


def summarize_output(output: str, config: dict) -> str:
    """讲师 [109:15]：任务结束时我会做摘要、把结果留下，并在下一个任务里用它。"""
    model = build_chat_model(config, role="judge")
    resp = model.invoke(
        [
            {
                "role": "user",
                "content": "把下面这段任务产出压缩成不超过 120 字的事实摘要，"
                "保留文件名和关键决策，不要评价：\n\n" + output,
            }
        ]
    )
    return resp.content if isinstance(resp.content, str) else str(resp.content)
```

### 4.11 `agent/factory.py`

```python
import os
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient


def build_chat_model(config: dict, role: str = "planner") -> ChatOpenAI:
    llm_cfg = config["llm"]
    model_name = llm_cfg["judge_model"] if role == "judge" else llm_cfg["model"]
    return ChatOpenAI(
        model=model_name,
        temperature=llm_cfg.get("temperature", 0),
        api_key=os.environ["OPENAI_API_KEY"],
    )


async def build_mcp_tools(config: dict):
    """filesystem MCP server，stdio 传输。
    讲师 [129:27]：用了 allow directory 之后，它就在 stdio 上跑这个 filesystem server。
    """
    allowed = [str(Path(p).resolve()) for p in config["workspace"]["allowed_dirs"]]
    for p in allowed:
        Path(p).mkdir(parents=True, exist_ok=True)

    client = MultiServerMCPClient(
        {
            "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", *allowed],
                "transport": "stdio",
            }
        }
    )
    return await client.get_tools()


def build_executor_agent(config: dict, mcp_tools):
    """注意：这里只挂 MCP 工具。
    讲师 [126:07] 的 bug 就是这里同时保留了旧的 file tools，模型选工具时会困惑，
    表现成「找不到文件 / path not allowed」。修法就是把额外的 tools 全部去掉。
    """
    return create_agent(
        model=build_chat_model(config, role="executor"),
        tools=list(mcp_tools),           # 不要再追加旧的 read_file / write_file
        system_prompt=(
            "你是一个执行单文件任务的工程师。用文件系统工具读写文件，"
            "所有路径都必须在允许目录内。完成任务后用一两句话总结。"
        ),
    )
```

### 4.12 `main.py`

```python
import argparse
import os

import yaml
from dotenv import load_dotenv

from tasks.orchestrator import handle_plan_command
from tasks.status import show_task_status
from tasks.task_store import TaskStore

load_dotenv()


def load_config(path: str = "config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只产出计划，不执行")
    args = parser.parse_args()

    config = load_config()
    store = TaskStore(config["task"]["db_path"])
    store.init_schema()

    project_id = ""   # 讲师：先拿到 project id，后面的 session 都挂在它上面

    print("可用命令：/plan <需求>   /status   /ask <问题>   /exit")
    while True:
        raw = input("\n> ").strip()
        if not raw:
            continue
        if raw in ("/exit", "exit", "quit"):
            break
        if raw.startswith("/plan"):
            goal = raw[len("/plan"):].strip()
            if not goal:
                goal = input("说说你想做什么项目：").strip()
            project_id = handle_plan_command(goal, config, store, dry_run=args.dry_run)
        elif raw.startswith("/status"):
            show_task_status(store, project_id)
        elif raw.startswith("/ask"):
            question = raw[len("/ask"):].strip()
            # /ask 走的是 agent 那条已有链路（含 RAG 检索）；
            # 课里没有展示 ask 的实现，这里只做占位提示。
            print(f"[ask] {question}\n（/ask 的实现属于 agent 层，本节课程没有展开）")
        else:
            print("未知命令。")


if __name__ == "__main__":
    main()
```

### 4.13 `safety_demos/guardrails_demo/guardrails.py`

```python
import os
import re

from langchain.agents.middleware import AgentMiddleware

# ---------------------------------------------------------------
# 一、content filter middleware：确定性 guardrail
# 讲师 [79:45]：关键词就是 hack / exploit / malware / ransomware
# 讲师 [81:08]：命中后返回的那句话就写死在这里
# ---------------------------------------------------------------
BANNED_KEYWORDS = ["hack", "exploit", "malware", "ransomware"]

CONTENT_FILTER_RESPONSE = "I cannot process request containing inappropriate content."
# 讲师在 [81:38] 强调这句话完全由你控制，
# 他甚至开玩笑说可以印 "I am smarter than you"——能印什么，取决于你写什么。


class ContentFilterMiddleware(AgentMiddleware):
    """在调用模型之前检查用户输入。命中关键词就直接短路，不进模型。"""

    name = "content_filter_middleware"

    def before_model(self, state, runtime=None):
        messages = state["messages"] if isinstance(state, dict) else state.messages
        last = messages[-1]
        text = last.content if isinstance(last.content, str) else ""
        lowered = text.lower()
        for kw in BANNED_KEYWORDS:
            if kw in lowered:
                print(f"[content_filter_middleware] 命中关键词：{kw}")
                # 用一条固定回复替换掉用户消息，模型只会看到这句
                return {"messages": [{"role": "assistant", "content": CONTENT_FILTER_RESPONSE}]}
        return None


# ---------------------------------------------------------------
# 二、PII 检测 + 四种处理策略
# 讲师 [69:55]：redact / mask / hash / block
# 讲师 [82:06]：email→redact、credit card→mask、api key→redact、
#               openai api key→redact，且都同时作用于输入与输出
# ---------------------------------------------------------------
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
CARD_RE = re.compile(r"\b(?:\d[ -]*?){13,16}\b")
API_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9]{8,}\b")
OPENAI_KEY_RE = re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b")
PASSWORD_RE = re.compile(r"(?:password|pwd|密码)\s*(?:is|是|[:：])?\s*(\S{4,})", re.I)

PII_RULES = [
    {"name": "email",             "regex": EMAIL_RE,      "strategy": "redact"},
    {"name": "credit_card",       "regex": CARD_RE,       "strategy": "mask"},
    {"name": "api_key",           "regex": API_KEY_RE,    "strategy": "redact"},
    {"name": "openai_api_key",    "regex": OPENAI_KEY_RE, "strategy": "redact"},
    {"name": "password",          "regex": PASSWORD_RE,   "strategy": "block"},
]


def _apply_strategy(rule_name: str, strategy: str, matched: str) -> str:
    if strategy == "redact":
        return f"[REDACTED_{rule_name.upper()}]"
    if strategy == "mask":
        digits = re.sub(r"\D", "", matched)
        if len(digits) <= 4:
            return "*" * len(matched)
        return "*" * (len(digits) - 4) + digits[-4:]
    if strategy == "hash":
        import hashlib
        return "HASH_" + hashlib.sha256(matched.encode()).hexdigest()[:12]
    if strategy == "block":
        raise ValueError(f"检测到 {rule_name}，已按 block 策略拒绝本次请求。")
    return matched


def scrub(text: str) -> str:
    for rule in PII_RULES:
        text = rule["regex"].sub(
            lambda m, r=rule: _apply_strategy(r["name"], r["strategy"], m.group(0)), text
        )
    return text


class PIIGuardMiddleware(AgentMiddleware):
    """注意：框架自带一个 PII middleware（讲师 [71:19]：
    「有一个专门做 PII 检测的 middleware，用可配置的策略检测并处理对话中的个人信息」）。
    如果你装的版本导出了 PIIMiddleware，优先用它——它内置了 email / 信用卡 / API key
    这些常见 detector，我们不必自己写正则。下面这版是自己写 detector 的等价实现，
    对应讲师 [83:02]「你也可以加自己的 detector」。
    """

    name = "pii_middleware"

    def before_model(self, state, runtime=None):
        messages = state["messages"] if isinstance(state, dict) else state.messages
        last = messages[-1]
        text = last.content if isinstance(last.content, str) else ""
        cleaned = scrub(text)
        if cleaned != text:
            print("[pii_middleware] 输入已脱敏")
            messages = list(messages[:-1]) + [type(last)(content=cleaned)]
            return {"messages": messages}
        return None

    def after_model(self, state, runtime=None):
        messages = state["messages"] if isinstance(state, dict) else state.messages
        last = messages[-1]
        text = last.content if isinstance(last.content, str) else ""
        cleaned = scrub(text)
        if cleaned != text:
            messages = list(messages[:-1]) + [type(last)(content=cleaned)]
            return {"messages": messages}
        return None


# ---------------------------------------------------------------
# 三、debug middleware：把「真正发给模型的输入」打印出来
# 讲师 [72:15]：.env 里那一项就是「要不要显示脱敏后的输入」
# 讲师 [75:56]：正是靠它证明「最终发给 LLM 的是掩码后的卡号，
#               模型根本不知道我原来没做掩码」
# ---------------------------------------------------------------
class RedactionDebugMiddleware(AgentMiddleware):
    name = "redaction_debug_middleware"

    def before_model(self, state, runtime=None):
        if os.getenv("SHOW_REDACTED_INPUT", "false").lower() == "true":
            messages = state["messages"] if isinstance(state, dict) else state.messages
            last = messages[-1]
            text = last.content if isinstance(last.content, str) else ""
            print(f"[redaction_debug_middleware] 发给模型的输入：{text}")
        return None


def build_guardrails():
    """讲师 [79:16] 讲的就是这个函数：build_guardrails 里注册一堆 middleware。"""
    return [
        ContentFilterMiddleware(),
        PIIGuardMiddleware(),
        RedactionDebugMiddleware(),
    ]
```

### 4.14 `safety_demos/guardrails_demo/real_demo.py`

```python
import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

from guardrails import CONTENT_FILTER_RESPONSE, build_guardrails

load_dotenv()


def build_agent():
    model = ChatOpenAI(model=os.getenv("MODEL", "4.0"), temperature=0)
    return create_agent(
        model=model,
        tools=[],
        system_prompt=(
            "你是一个银行客服助手。你无法访问真实账户，"
            "可以模拟操作或引导用户。回答要简短。"
        ),
        middleware=build_guardrails(),
    )


PRESETS = [
    "我的账户余额是 100 卢比",
    "我的卡号是 4111111111111111，把卡号复述给我",
    "我的 API key 是 sk-abcdefghijklmnopqrstuvwxyz012345",
    "我的密码是 hunter2",
    "怎么 hack prod db",
]


def main():
    agent = build_agent()
    print("输入编号试试预设问题，或直接输入自定义内容（/exit 退出）")
    for i, p in enumerate(PRESETS, 1):
        print(f"  {i}. {p}")

    while True:
        raw = input("\n> ").strip()
        if raw in ("/exit", "exit"):
            break
        if raw.isdigit() and 1 <= int(raw) <= len(PRESETS):
            raw = PRESETS[int(raw) - 1]

        try:
            result = agent.invoke({"messages": [{"role": "user", "content": raw}]})
            print("助手：", result["messages"][-1].content)
        except ValueError as exc:
            # block 策略会抛错——讲师 [70:23]：block 就是直接报错「你为什么要这么干」
            print(f"[已被拦截] {exc}")


if __name__ == "__main__":
    main()
```

![p010 86:51 讲师演示 guardrails 示例后收尾，准备切到长任务规划器](images/p010_5211s.jpg)

---

## 5. 逐行解释

这一节不按文件顺序讲语法，而是按「为什么这么写、不这么写会怎样」讲每个关键决策。

**为什么 guardrails 落在 middleware 而不是一个独立服务。** 讲师在 [70:49] 直接把这个认知点破了：「guardrails 是通过 middleware 实现的」。middleware 的意义在于它**自动**串在模型调用的前后，你不需要在业务代码的每个入口手动 `check()` 一次。讲师在 LangSmith 里观察到的事实是 [79:16]：「在模型调用之前，所有 before 中间件被调用；模型调用之后，所有 after 中间件被调用。」所以 `ContentFilterMiddleware.before_model` 一定会先于真正的 LLM 请求执行——这就是为什么你能在 [75:00] 看到「用户 query 在发到 LLM 之前就被拦住」。如果你把 PII 检测写成一个 helper 函数并在某些分支里调用，只要有一个人忘了调，明文卡号就出去了；挂在 middleware 上，是**框架保证**每次调用都经过。

**`before_model` 返回一条 assistant 消息，是最狠但最省钱的拦截。** `ContentFilterMiddleware` 命中关键词后直接返回 `{"messages": [...]}`，这意味着根本不会发起模型调用——讲师在 [80:40] 展示的就是这个效果：你问「怎么 hack prod db」，`content_filter_middleware` 被调用，然后是 `safety_guardrail_middleware`，然后直接给出那句写死的话。讲师还补了一句很值钱的观察 [85:50]：「如果只是屏蔽关键词，你可以发给模型让它改写、避开这些词；但如果是信用卡、是密码，你必须保证它不会被发给模型。」前者省不了 token 但保留了 LLM 的改写能力，后者必须短路——**两者是不同策略，不是同一个策略的不同实现**。在 Node 里你可以把它类比成 Express 里那个不调 `next()` 直接 `res.json()` 的中间件。

**为什么 PII 要同时挂 input 和 output。** 讲师 [82:06] 的配置里，email、credit card、API key、OpenAI API key 都标注了「作用于输入也作用于输出」。原因很实际：模型有可能把用户在**更早**的对话里说的卡号又复述一遍，输出侧不拦，你就从输出通道泄漏了一次。`PIIGuardMiddleware.after_model` 就是处理这个的。

**mask 只留最后四位是不是「安全」。** 讲师在 [70:23] 说得很清楚：「mask 是把除最后四位以外的数字盖掉。」这在**支付场景**是行业惯例（客服要靠后四位核身），但它不是**强脱敏**——你自己写业务时要知道：mask 后的卡号仍然可被关联到同一个人。真正要脱敏就用 `redact`（直接替换成 `[REDACTED_CREDIT_CARD]`）或 `hash`。`_apply_strategy` 里把四种策略都实现了，就是为了让你能按数据敏感级别选，而不是一律 mask。

**为什么 `password` 用 block 而不是 redact。** 密码不是「需要保留形态」的字段，一旦出现就说明用户在误操作，最合理的是抛错并提示。讲师 [70:23] 的原话就是：「block 就是直接抛错——你为什么要这么干？」对应 `real_demo.py` 里 `except ValueError` 那条分支。

**为什么不自己写 detector。** 讲师 [83:02] 两句话都很重要：「LangChain、LangGraph 有它们自己的函数来处理匹配，内部大概是正则匹配」「这些常见的东西——是不是邮箱、是不是信用卡、是不是 OpenAPI key——这些简单 detector 框架已经给我们实现了，所以不用自己写；但**你也可以写自己的 detector**。」所以 `PII_RULES` 里既有内置常见类型的等价实现，也留了加自定义正则的位置。这就是用框架的真实价值：**通用能力不用重造**。

**Planner 为什么要用结构化输出而不是让模型自由写。** 讲师 [105:13] 说：「创建 agent 的时候我们就指定了想要的格式。」因为下游要拿去建表、要做依赖计算、要做拓扑排序——`depends_on` 是一个**数组**，不是一段散文。如果只是「请给我一个计划」，模型会给你一段漂亮的 Markdown 列表，你的代码没法解析「第三个任务依赖第一个」。而用了 `response_format=ExecutionPlan`，讲师 [105:35] 的结论是：「如果你用的是结构化输出，就不需要再校验 schema，因为框架已经帮你处理了。」本实现里 `result["structured_response"]` 拿到的直接就是 Pydantic 对象，`plan.tasks[0].depends_on` 是 `list[str]`——**这就是「不用手写校验」的含义**。

**为什么顺序必须是 DAG，而且必须是拓扑序。** 讲师 [101:54] 连着说了两句关键话：一是「因为我想让子任务能够并行跑，所以顺序必须是 DAG」；二是被问到为什么时答「我们要拓扑序，才能保证一个任务在另一个之后；否则出现循环依赖，就一个任务都跑不了」。`topo_sort` 里的 Kahn 算法就是在做这件事：反复取出入度为 0 的节点。最后那个 `len(order) != len(tasks)` 的判断就是环检测——**如果计划里 T3 依赖 T5、T5 又依赖 T3，这个函数会抛错，而不是让你的 for 循环卡死**。在 JS 生态里这和你 `pnpm` 解析依赖图、webpack 算 chunk 顺序是同一类问题；如果你写过 webpack 的循环依赖警告，就知道不检测环会以什么方式烂掉。

**`execution_order` 这一列是干嘛的。** 它既是任务在拓扑序里的位置，也是你 `select ... order by execution_order` 时列表的展示顺序——讲师 [107:52] 打开 DB 看到「10 行，第一行 in_progress」，就是按它排的。它和 `task_id` 分开存，是因为 **`task_id` 由 LLM 生成、只保证唯一，不保证可排序**（`T10` 会排在 `T2` 前面）。

**`depends_on` 为什么存 JSON 字符串而不是建关联表。** 因为这是单机 SQLite 场景，读的时候 `json.loads` 一下就够了；真正的调度判断在 `next_runnable_task` 里：先查出所有 `completed` 的 id 集合，再对每个 `pending` 任务检查「它依赖的 id 是不是全在这个集合里」。讲师 [108:19] 说的是同一件事：「它取决于哪个任务，那些任务会先完成，然后才轮到这些任务。」注意这个实现是**活跃集驱动**的，不是严格按 `execution_order` 逐个跑——所以一旦某个任务失败，它的下游会停在 `pending`，而上游的其他分支还能继续跑。这正是 DAG 相对线性列表的收益。**在 JS/Node 里对应什么**：如果你用 `better-sqlite3`，这种「单表 + JSON 列」的写法极其常见；要真并发就得换 Postgres 并加行锁（`SELECT ... FOR UPDATE SKIP LOCKED`），SQLite 在这种场景下只有单写者。

**为什么要有 `retry` / `max_retry` 两列。** 讲师 [108:19] 打开 DB 时确实念到了「retry、max retry」。`max_retry` 是任务级配置（来自 `config.yaml` 的 `task.max_retry`），`retry` 是运行时计数，`bump_retry` 每次失败加一。这里要诚实说一句：**本实现只在异常分支 bump 了 retry，没有实现「retry 用尽后自动标记 blocked」的策略**——课里也没讲这个策略，讲师只展示了列存在。

**为什么 `output` 存全文、`review` 存 judge 结论，但喂给下一个任务的却是摘要。** 讲师 [109:15] 讲得很清楚：「我一边完成任务，一边摘要、保留结果，并在下一个任务里使用它。我是把上一个任务的结果摘要之后留存下来的。」道理是上下文预算：10 个任务的完整产出可能有几万 token，全塞进下一个任务的 prompt 里，成本和延迟都会爆。所以 `summarize_output` 用同一个模型压到 120 字，只留**文件名和关键决策**。这也解释了为什么 `output` 列要存全文——**摘要给模型看，全文给你自己审计**。

**LLM as judge 为什么单独配一个模型。** 讲师 [95:15] 说他加了一个 judge model。这是个很实际的工程选择：judge 需要的是**稳定、低温度、判定倾向一致**，而 executor 需要的是**能写代码**。用两个模型名就允许你后续给 judge 换更便宜/更严格的模型。对应 `build_chat_model(config, role="judge")` 里那个分支。

**为什么 `handle_plan_command` 里的审批循环要支持 modify 和 replan 两种。** 讲师 [106:01] 说：「我不是用 LangChain 现成的 human-in-the-loop，我就是literally 问 approve、modify 还是 reject，你也可以 re-plan。」这两条分支的差别在 `orchestrator.py` 里体现出来了：`modify` 是把「上一版计划」和「你的修改意见」一起喂回去，让模型**在现有基础上改**；`replan` 是**丢掉上一版、带着额外约束重来**。前者省 token 且收敛快（你要的只是加个任务），后者适合「方向就不对」。在真实产品里这两个按钮的差别，就是用户会不会骂人的差别。

**为什么 guardrails 里不需要 memory，而 human-in-the-loop 里必须要有。** 讲师 [78:18] 有一句特别容易被忽略的话：「在这个场景里 memory 不是必需的。在 guardrails 里 memory 不必要；在 human-in-the-loop 里它是必需的。guardrails 里不必要，但我还是加上了。」原因是：guardrails 是**无状态的单次请求过滤**，这一次输入里有没有卡号，跟上一轮无关；而 human-in-the-loop 需要记住「我在等哪个人批哪件事」，那必须持久化。

**为什么主流程要有一个 `MAX_ITERATIONS`。** 讲师 [89:38] 在讲 ReAct 时说得很直白：「我们必须给模型调用次数、工具调用次数加个限制，这就是我们加 middleware 的原因——因为它在循环里，会一遍一遍地做。」`execute_plan` 的 `MAX_ITERATIONS` 和 `agent.invoke(config={"recursion_limit": 60})` 是同一个思想的两层保险：外层防「任务永远挑不完」，内层防「Agent 在一轮里无限调工具」。

**那个「path not allowed」到底错在哪。** 讲师 [125:38] 自己复盘出来了：「文件确实被创建出来了，所以 filesystem 工具本身是能用的。我犯的错是：虽然我加了 MCP server，但在 agent factory 的 `create_agent` 里原来就有这些工具，我**没有删掉**。所以它有时候会困惑，这就是它没能正确写文件的原因。」——这句话是整个 debug 过程的结论：**不是 MCP server 没权限，是模型在两个同功能的工具集之间选错了**。所以 `build_executor_agent` 里只 `tools=list(mcp_tools)`，任何「顺手把旧工具也留着」的念头都要打消。同一类问题在真实项目里最常见的形态，就是你会同时挂 `read_file`、`readFile`、`fs_read` 三个语义重叠的工具，然后模型选最烂的那个。

![p010 96:00 讲师在 task 目录下新建 orchestrator.py，说明 planner 是 handle_plan_command 的第一步](images/p010_5760s.jpg)

![p010 105:08 结构化输出被展开成 project_name、tasks、depends_on、acceptance_criteria 等字段](images/p010_6308s.jpg)

---

## 6. 复现检查清单

按顺序打勾，任何一条不过就先别往下走。

**环境**

- [ ] `python -V` 输出 3.11 或更高；`node -v` 输出 18 或更高；`npx -v` 能正常输出版本。
- [ ] `pip install -r requirements.txt` 没有报解析冲突。
- [ ] `python -c "from langchain.agents.middleware import AgentMiddleware; print('ok')"` 输出 `ok`。这一步不过，说明你装的版本里 middleware 的导入路径不同，去翻你那个版本的文档，别硬写。
- [ ] `.env` 里 `OPENAI_API_KEY` 可用；`LANGCHAIN_TRACING_V2=true` 且 `LANGCHAIN_API_KEY` 有效。
- [ ] `config.yaml` 里 `llm.model` 填的是**你能访问到**的模型名。课里讲师填的是 `4.0`，并在
也不要求高，所以如果你用别的模型，planner 产出的任务数量、粒度、依赖合理性都会变——`min_tasks/max_tasks` 只是提示词里的约束，不是硬保证。

**Guardrails Demo**

- [ ] `python real_demo.py` 能打印出 5 条预设问题（账户余额、卡号、API key、密码、hack）。
- [ ] 输入「我的卡号是 4111111111111111，把卡号复述给我」，终端出现 `[pii_middleware] 输入已脱敏`，助手回复里**看不到**完整 16 位数字，只说「不能提供」或复述掩码后的串。
- [ ] 把 `.env` 里 `SHOW_REDACTED_INPUT` 改成 `true`，重跑，终端出现 `[redaction_debug_middleware] 发给模型的输入：...`。**这一行是整节最有说服力的一行**——它证明发给模型的是掩码后的文本，而不是模型自己把明文「礼貌地隐藏」了。
- [ ] 输入「我的 API key 是 sk-abcdefghijklmnopqrstuvwxyz012345」，终端回显里 API key 变成 `[REDACTED_API_KEY]`。
- [ ] 输入「我的密码是 hunter2」，程序走 `except ValueError` 分支，打印 `[已被拦截] 检测到 password...`，**没有发起模型调用**（LangSmith 里看不到这次 run）。
- [ ] 输入「怎么 hack prod db」，打印 `[content_filter_middleware] 命中关键词：hack`，助手回复恰好是 `I cannot process request containing inappropriate content.`。
- [ ] 打开 LangSmith，那几次正常对话的 trace 里，能在模型节点**之前**看到 middleware 的调用记录；被 hack 拦住的那次**没有模型节点**。讲师 [76:22] 就是这么核对的：「有各种 middleware 调用在发生——redaction debug middleware……」。

**Planner：先只跑到拿到计划**

- [ ] `python main.py` 的菜单里有 `/plan` 和 `/status` 两项（对应讲师 [93:48] 加的那两个东西）。
- [ ] `python main.py --dry-run`，输入 `/plan 用 HTML、CSS、JavaScript 做一个好看的 Todo App`，终端打印出一段 JSON。
- [ ] 这段 JSON 里至少有 `project_name`、`goal_summary`、`tech_stack`、`total_estimated_time`、`tasks`、`risks`、`assumptions` 七个键，`tasks` 长度在 5–20 之间。
- [ ] 每个 task 都有 `id`、`title`、`description`、`type`、`depends_on`、`acceptance_criteria`、`output_files`。
- [ ] `type` 的取值全部落在 `design/implement/test/review/integrate/configure` 六个词里（讲师 [102:24] 念过这个枚举）。
- [ ] 任务标题看起来像讲师 [102:50] 念的那串：设计布局 → 搭结构 → HTML → CSS → 加功能 → 删功能 → 测 → 评审 → 集成部署。
- [ ] LangSmith 里这次 run 显示的是**结构化输出**被解析成字段，而不是一段自由文本（讲师 [104:17]：「我拿到了一个特定格式的结构化响应……每个 task 都有 acceptance criteria、depends_on、description」）。

**Planner：审批与落库**

- [ ] 跑 `/plan` 时，`present_plan_for_approval` 把任务逐条列出来，最后停在 `approve / modify / reject / replan >` 提示符上。
- [ ] 先输一次 `modify`，随便写「再加一个任务：写 README」，确认它重新出了计划，且新计划里确实多了这个任务——这验证的是 `modify` 分支把上一版计划喂回去了。
- [ ] 再输一次 `replan`，确认它重来的计划结构完整（不会因为丢掉了上一版而崩）。
- [ ] 最后输 `approve`，终端打印 `计划已写入 DB，project_id=proj_xxxx`，并开始执行第一个任务。
- [ ] **approve 之前**用 `sqlite3 task.db "select count(*) from tasks;"` 查到 0；**approve 之后**查到 10（或你那次计划的条数）。这正是讲师 [106:58] 的手法：「现在你能看到 task.db 吗？里面有任务吗？没有。我们 approve plan，再看看会发生什么。」
- [ ] `sqlite3 task.db "select execution_order, task_id, status, task_type, title from tasks order by execution_order;"` 的结果里，第一行 `status` 是 `in_progress`，其余是 `pending`（对应 [107:52]）。
- [ ] `sqlite3 task.db "select task_id, retry, max_retry, created_at, started_at, completed_at from tasks limit 3;"` 这几列都在（对应 [108:19] 讲师念的那串字段）。`started_at`、`completed_at` 在未执行的任务上是 NULL 或空，这是正常的。

**Planner：执行、评审、产物**

- [ ] 等一段时间后再查一次，能看到 `completed` 的行数在增加，且恰好有一行是 `in_progress`（讲师 [108:49]：「三个已完成，第四个在进行中」）。
- [ ] `sqlite3 task.db "select task_id, substr(output,1,80) from tasks where status='completed';"` 每行 `output` 非空——这就是「完成任务给出了结果作为产出」。
- [ ] `review` 列里能看到 judge 的结论（本实现存的是 JSON 字符串，形如 `{"passed": ..., "score": ...}`）。
- [ ] `workspace/<你的 project_name>/` 下真的出现了 `index.html`、`style.css`、`app.js`，以及 `review-notes.md`、`test-report.md`（讲师 [111:08] 点名过这几个文件：「你能看到 JS 有 app.js 吗？能看到 review-notes.md 吗？……你能看到 test report 吗？」）。
- [ ] 用浏览器打开 `index.html`，页面能显示、能加任务、能删任务、能切换完成状态。
- [ ] 整轮跑完没有触发 `MAX_ITERATIONS`（如果打印了「没有可执行的任务了」但你 DB 里还有 `pending`，说明有任务因为依赖的任务 `failed` 而永远等不到，属于正常但需要你人工看）。

**MCP / 文件系统（这一段最容易卡）**

- [ ] 第一次执行任务时，`npx` 会去下载 `@modelcontextprotocol/server-filesystem`，这一步可能要几十秒并且需要外网。看到 `npm warn` 不要慌，等到终端出现第一次文件写入即可。
- [ ] `config.yaml` 里 `workspace.allowed_dirs` 用的是**相对路径 `./workspace`**，但代码里 `Path(p).resolve()` 转成了绝对路径再传给 MCP server。如果你直接把相对路径塞给 server，就会出现你在大屏幕上看到的那个 `Access denied. Path not allowed.`。
- [ ] 确认 `agent/factory.py` 的 `build_executor_agent` 里 `tools=list(mcp_tools)`，**没有**再 `+ [read_file, write_file]` 之类的东西（讲师 [126:07] 的 bug）。
- [ ] 修完之后，`/ask 在 review 文件夹里写一个文件` 能成功（讲师 [128:34] 试的那条）。
- [ ] `/ask 更新 css 文件夹里 style.css 的样式，让它更好看` 会先问 `would you like to proceed`，你回 yes 之后它回复「已更新」（讲师 [129:01] 试的那条）。
- [ ] `/ask 把 app 的 UI 主色从蓝色改成红色` 能成功，并且 `style.css` 里确实有颜色变化（讲师 [130:24] 试的那条）。
- [ ] `/ask 解释一下 app.js 的代码`，回答里能引用到刚才生成的代码内容——说明**生成后重新索引**这条链路通了（讲师 [114:57]：「代码一生成，我就重新索引、更新了 ChromaDB，所以它现在能回答我」）。

**排查表（对不上时先看这里）**

| 现象 | 最可能的原因 | 怎么确认 |
|---|---|---|
| `ImportError: AgentMiddleware` | 你装的 langchain 版本没有这个导出 | 去你版本包的 `langchain/agents/` 下看实际文件名 |
| 拿到的是自由文本，没有 `structured_response` | 该版本 `create_agent` 的参数名不叫 `response_format` | 打印 `result.keys()`，看它把结构化结果放在哪个 key |
| `npx` 卡住 / `ENOENT` | 没装 Node，或路径里没有 npx | `which npx`；Windows 上试 `npx.cmd` |
| 一直 `Path not allowed` | 传给 server 的目录不是绝对路径，或目标文件不在目录内 | 把 `allowed_dirs` 打印出来对照 |
| 文件根本没被写 | 旧 tools 和 MCP tools 同时挂着，模型选错 | 临时只保留 MCP tools 重跑 |
| `/ask` 找不到刚生成的文件 | 没做 re-index，RAG 里没有新文件 | 看你的索引更新是否在写文件之后触发 |

![p010 114:17 讲师用 /ask 追问 app.js，说明生成后的代码已被重新索引、RAG 能检索到](images/p010_6857s.jpg)

---

## 7. 课里没讲但你会撞上的

这一节写的是「讲师这一段没有交代，但你按上面做一定会碰到」的东西。分成三类：会直接报错的、会让你结果不对的、以及讲师明确说了「以后讲」的。

**一、会直接报错的**

**1. 中间件与 `create_agent` 的 API 是按某个版本写的，跨版本会炸。** 讲师 [79:16] 只说「build_guardrails 里创建 middleware」，没有说 import 路径，也没有说 `before_model` 的签名。不同版本里，有的叫 `AgentMiddleware`、有的叫 `AgentMiddleware` 但 `before_model` 的参数是 `(state, runtime)`、有的要求 `async def`。**这段课没有给出版本号**，`requirements.txt` 里的版本是我按能跑通推的。你如果 `pip install` 完 import 失败，正确做法是去翻你安装的那个版本的 `middleware` 模块实际导出了什么，而不是硬改我的代码。

**2. 讲师说「框架里有个现成的 PII middleware」，但它在你的版本里可能叫别的名字、参数也不同。** 讲师 [71:19] 的原话是：「有一个专门做 PII 检测的 middleware，它用可配置的策略检测并处理对话中的个人信息。」这段没有演示怎么 import 它。所以我给了 `PIIGuardMiddleware` 这个自己写 detector 的等价实现（讲师 [83:02] 也说了「你可以加自己的 detector」）。如果你要用内置的那个，**先 `python -c "import langchain.agents.middleware as m; print(dir(m))"` 看有没有**，有就用内置的、没有就用我这版。别把内置的和自定义的同时挂上——那就是第 3.9 步那个 bug 的同款。

**3. `npx` 第一次启动 filesystem server 需要外网。** 讲师 [129:27] 说「它就在 stdio 上跑这个 filesystem server」，但没有提第一次会下载包。公司网络里这一步经常挂在代理上，表现是「agent 一直在转圈但没有任何工具结果」。先把 `npx -y @modelcontextprotocol/server-filesystem /tmp` 单独在终端跑一次，能跑通再接进 agent。

**4. Windows 上 `command: "npx"` 常常起不来。** stdio 传输会直接 spawn 子进程，Windows 上需要 `npx.cmd`，或者 `command: "cmd", args: ["/c", "npx", "-y", ...]`。这一点课里没讲，因为讲师是在 macOS/Linux 上演示的。

**5. `allowed_dirs` 传相对路径会被拒。** 我在 `build_mcp_tools` 里做了 `Path(p).resolve()`，就是防这个。如果你改成直接传 `config["workspace"]["allowed_dirs"]`，就会得到和讲师屏幕上一样的 `Access denied. Path not allowed.`。注意：**这个报错和你把旧 tools 挂着导致的「找不到文件」是两个不同的错**，症状却很像，别混。讲师 [113:04] 当时也没立刻分清，他在 [128:04] 还说过「你没有合适的工具去检查文件，问题在这」。

**6. `sqlite3` CLI 在 WAL 模式下偶发「database is locked」。** 我在 `TaskStore.__init__` 里开了 `PRAGMA journal_mode=WAL;`。好处是主进程写、你在另一个终端的 CLI 读，互不阻塞；坏处是有一次你把进程 Ctrl-C 掉，会留下 `task.db-wal` 和 `task.db-shm` 两个文件，`git status` 里很难看。把 `task.db*` 一起加进 `.gitignore`。课里没提 WAL，因为讲师演示时是「等它跑完再看 DB」。

**二、会让你结果不对的**

**7. 时间戳是 UTC，你本地看会差 8 小时。** `_now()` 用的是 `datetime.now(timezone.utc).isoformat()`。讲师打开 DB 看 `created_at / started_at / completed_at`（[108:19]）时是本地时间语境，你要是对着自己 DB 里「晚上 3 点创建」发懵，就是这个原因。要么在展示层转成本地时区，要么改成 `datetime.now()`（但那样跨时区协作会乱）。

**8. judge 的输出不一定是纯 JSON。** 我的 `judge_task` 只是把模型回复**当字符串存进 DB**，所以不会有解析问题。但你一旦想拿 `passed` 字段做「不通过就重跑」，就会撞上模型给你包一层 ` ```json ` 的情况。处理方式：先剥 markdown fence 再 `json.loads`，解析失败就当 `passed=false`——**宁可误判失败重跑，也不要把解析错误当成通过**。课里 [95:15] 只说「加了 judge model 检查每个子任务的质量」，没讲失败之后怎么处理。

**9. 摘要会丢关键信息，导致下游任务重复造轮子。** 讲师 [109:15] 说他把上一个任务的结果摘要后传给下一个任务，但没讲摘要该保留什么。我的 `summarize_output` 明说了「保留文件名和关键决策」。你实际跑的时候大概率会遇到：第 5 个任务重新写了一版 `style.css`，因为它不知道第 4 个任务已经写过。解法是把 `output_files` 从 DB 里读出来，作为「已存在文件清单」一并塞进 prompt——这条课里没讲，是我根据讲师那句「让下一个任务知道上一个任务的产出是什么」补的。

**10. `/ask` 这条链路在这段课里没有实现，只有演示。** 讲师在 [114:01] 说「重点是 `/plan` 然后 `/ask` 要能工作，要能加后续功能，这些我都处理好了」，但他没展示 `ask` 的代码。我 `main.py` 里的 `/ask` 是个明确的占位。**别以为照着本文写完就有完整的 `/ask`**——它属于前面章节的 agent 层（含 RAG、skills、MCP），这一段只讲 task 层怎么和它衔接。

**11. `human_in_the_loop_demo` 只存在于目录结构里。** 讲师 [72:15] 说「我把 guardrails demo 和 human-in-the-loop demo 放在同一个环境里」，但这一段没有展开 human-in-the-loop 的实现，只在 [77:19] 提了一句「往下翻能看到 custom human in the loop logic，对更专门的工作流你可以写自己的 middleware、自己的生命周期」。所以我那个目录里只放了 README。

**12. 「resume 已有项目」这条分支课里没走。** 讲师 [98:08] 明确划了范围：「现在我不讲 resumability，这是处理 resume 的分支——如果已经有项目在建，我从 SQLite store 里查、由 recovery manager 负责。现在我只讲从零开始规划一个新项目的流程。」我的 `RecoveryManager` 只做了「把卡在 in_progress 的退回 pending」，**真正的幂等**（同一个任务重跑会不会把文件写坏）课里没讲、我也没实现。你如果在自己项目里要上这个，得让每个任务写文件前先判断「这个文件是不是我这一轮写的」。

**13. `skills` 只被提到，没有实现。** 讲师 [111:08] 说「我可以加 design skill、可以加 code review skill、可以加不同的 skill」，说的是在生成结果上再叠一层能力，但这段没讲 skill 怎么注册、怎么和 planner 的 task type 对应。这是后面章节的内容。

**三、讲师明确说了「以后讲」的**

**14. Caching 与 token budgeting。** 有学员在 [117:46] 直接问「这里怎么引入 caching 层」，讲师答：「我们会在各个层面讲 caching，也会讲 token budgeting，那本身就是一个完整的讨论。Caching 是非常重要的主题，我们会深入讲。」所以这一段**没有任何缓存实现**，别在我给的代码里找。你要自己先顶住的话，最小成本的做法是给 planner 的调用加一层「同一 goal 的 plan 落盘缓存」，因为 `/plan` 是这一段里最贵的一次调用。

**15. RAG 的「新鲜度」机制。** 讲师 [114:57] 说「我加入了 freshness，我加入了 re-indexing」，然后在 [115:22] 说「freshness 明天讲，明天我们把整个代码过一遍」。所以本文只实现了「生成完 → 重新索引」这个动作的**结果描述**，具体在什么时机触发 re-index（每写完一个文件？每完成一个任务？全部跑完？）、索引粒度是文件级还是 chunk 级，课里没讲。你如果自己实现，建议在 `mark_completed` 之后立刻触发，理由和 `summarize_output` 同理：**下游任务和 `/ask` 都需要看到最新产物**。

**16. 「这套东西能不能替代公司里的 Claude Code」。** 学员在 [123:23] 问了，讲师答得很克制：「当然，你得诚实，你不能用真正的 Claude Code 去替代它。我们五周做出来的东西会有功能局限，会有更多 MCP server、更多 skill 可以加。它是在设定边界——大部分我们覆盖了，特殊情况可以扩展。」然后在 [132:17] 又说：「我们理论上在覆盖所有部分、在写代码，但要做到真正 Claude Code 那个水平，需要更好的 harness，需要更多投入。」这段话的工程含义是：**本文这套东西的定位是「可扩展的骨架」，不是「可上线替代品」**。别拿它去跑生产仓库的自动改代码。

**17. 生成的代码会被直接写到磁盘上——这段课没有沙箱。** filesystem MCP 只限制了**目录**，没有限制**内容**。第 4 节的实现会让模型往 `workspace/` 里写 `.html/.css/.js`，你打开浏览器就执行了。如果要接后端，**必须**把执行环境和你的真实项目目录隔开（容器、临时目录、只读挂载），并且不要让 executor agent 碰到 `.env`、`~/.ssh`、CI 凭据。这一点课里完全没讲，但它比本文任何一个技术点都更容易造成真实损失。

**18. 公司网络里 `OPENAI_API_KEY` 可能根本用不了。** 有学员在 [119:44] 分享过自己的解法：IT 有边界限制，不能直接把 key 塞进环境变量，最后是在公司生态里做了一个网关把 OpenAI 的 endpoint 暴露出来，然后调那个 endpoint 并配上对应的 key。对应到代码上，就是给 `ChatOpenAI` 多加一个 `base_url`（或你那个 SDK 里等价的字段），从环境变量读。课里讲师没演示这一步，所以本文的 `build_chat_model` 里没有这个参数——**这是你换到自己公司环境时要加的第一行**。

**19. 模型档位会直接改变 plan 的质量。** 讲师 [130:52] 说：「看 config.yaml，现在是 4.0。如果我用 5.5，我确定它生成的会好得多。」这句话说明两件事：一是**计划质量高度依赖模型**，你用弱模型时看到的「任务拆得太粗 / 依赖关系乱 / output_files 漏」不一定是你的代码错；二是**同一个 prompt 换模型要重新验一遍**，尤其是 `output_files` 这种要求「列全」的字段，弱模型经常只列一个。

**20. `min_tasks/max_tasks` 在 config 里，但 prompt 里是写死的 5 到 20。** 这是我在第 4 节留的一个不一致，刻意没修，因为讲师 [101:25] 念 prompt 时说的就是「拆成 5 到 20 个任务」，而 `config.yaml` 里的两个键是我加的、课里没有。你要么把 prompt 里改成从 config 插值，要么把 config 里那两行删掉——**别留着两个来源不同的约束，否则哪天你改了 config 发现没生效，会查很久**。

![p010 132:34 讲师回应 requirements.txt 与 poetry 的选择：单文件 demo 用 requirements.txt 就够](images/p010_7954s.jpg)

---

**收尾一句**：这一段的技术密度很高，但真正的收获不是「我会写一个 planner」，而是讲师在 [125:38] 现场复盘 bug 的那三十秒——**先确认工具本身是好的（文件被写出来了），再去找「为什么模型没用对工具」**。同一套排查顺序，你在任何 agent 系统里都用得上。