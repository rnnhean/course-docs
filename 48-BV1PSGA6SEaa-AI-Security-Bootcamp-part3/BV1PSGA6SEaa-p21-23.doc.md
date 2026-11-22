# AI Security Bootcamp part3：护栏 / 网关 / 可观测（P21–P23）复现文档

> 说明：本段课程（P21–P23）逐字稿实际讲的是 **Deep Agents 的 Skills（技能）与 Sub Agents（子代理）**，并在 P23 用一个 Streamlit 聊天应用把前面所有能力（memory、context engineering、backend、skills、sub agents）串起来。逐字稿里没有出现「护栏 / 网关 / 可观测」的具体实现，也没有任何 OCR 代码片段。因此本文严格按逐字稿内容复现，凡是逐字稿没讲的地方一律标注「课里没讲」。

---

## 1. 这一节做什么

这三节是 Deep Agents 模块的收尾，目标是把前面几节散落的能力拼成一个能跑起来的完整应用。具体做三件事：

1. **P21：Skills（技能）**。给 deep agent 建一个 `skills/` 目录，里面每个子目录代表一项专门能力（Python、LangGraph、AWS、报告撰写），每个技能目录里有 `skill.md`、`instruction.md`、`examples.md` 等 Markdown 文件。Agent 平时不加载这些文件，只有当用户提问命中某个技能时才按需读取（讲师称之为 progressive disclosure，渐进式披露），任务结束后释放，保持上下文干净。讲师用 Claude Code 生成这些技能文件，然后在 notebook 里用 `pathlib` 读取 `skill.md`，把内容作为参考塞进 `create_deep_agent` 的调用里，验证 agent 会自动挑中正确的技能文件。
2. **P22：Sub Agents（子代理）**。给主 agent 配一个「研究子代理」，子代理有自己的 system prompt、自己的工具（Tavily 联网搜索）、自己的模型（可选，不填就继承主 agent 的模型）。主 agent 收到任务后把活派给子代理，子代理干完把结果交回。讲师先演示同步子代理（主 agent 阻塞等待），再演示用 Pydantic 模型给子代理加 `response_format`，让子代理直接返回结构化结果（summary / confidence / sources）。
3. **P23：端到端 Streamlit 应用**。用 Claude Code 生成一个 Streamlit 聊天界面，把模型选择、backend 选择（state / file system / store）、agents.md 加载、skills 加载、sub agents 委派、checkpoint 线程记忆全部接进去，跑起来验证：问 LLM gateway 会触发研究和报告撰写技能，问 EC2 会触发 AWS 技能。

技术栈：Python + LangChain 的 deep agents SDK（`create_deep_agent`）+ OpenAI 模型 + Tavily 搜索 + Pydantic + Streamlit。讲师反复强调「用 AI 编码代理（Claude Code）来写这些代码是当前最高效的方式」。

---

## 2. 讲师原话

> "技能和 deep agent 就像按需提供的专业知识，带渐进式披露。技能是专门的能力模块，只有当它们与用户请求相关时，agent 才会加载。"
> —— p021 [00:29]

> "关键思想是：不要一直把所有东西都加载进来，而是在正确的时间、为正确的任务加载正确的技能。"
> —— p021 [02:20]

> "它会先理解任务、识别需求，然后基于给定的查询去搜索那个特定的技能并尝试加载它，只选择和加载与问题相关的技能，任何时刻都不会把所有技能全部加载。"
> —— p021 [02:50]

> "技能在执行完成后会被释放。这样就能保持上下文干净。"
> —— p021 [03:14]

> "记忆是始终注入到 system prompt 里的；技能只在相关时才加载。全局规则、偏好、架构和约定属于记忆；详细的工作流、领域知识、分步指导就是技能。"
> —— p021 [03:42]

> "记忆我理解为像是一个超集，技能只是信息的一部分，是某种特定的能力。"
> —— p021 [04:11]

> "记忆没有渐进式披露——一旦加载就不会释放；技能有披露机制，只在需要时才加载。"
> —— p021 [04:11]

> "在技能里面会有什么？会有一个技能文件夹，里面还有一个文件夹，里面有一个 MD 文件、instruction.md 文件，还会有一些 examples 文件、一些 best practices 文件。"
> —— p021 [04:34]

> "所有这些文件都会被当作上下文提供给 deep agent，当用户提出查询时，技能会在内部被使用。"
> —— p021 [07:50]

> "上下文工程就是：以正确的格式，在正确的时间，提供正确的信息和工具。"
> —— p021 [09:16]

> "我们还可以给 deep agent 接入更多工具，但一开始为了加载这些特定技能，我们可以直接这样用。"
> —— p021 [12:01]

> "我什么都没做，我只是用 Claude Code 来做这件事。重要的是，你要高效地去用同样的技术。"
> —— p021 [12:54]

> "deep agent 可以创建一个子代理来委派工作。你可以在 sub agents 参数里指定自定义子代理。子代理对上下文隔离很有用，能保持主 agent 的上下文干净，并提供专门的指令。"
> —— p022 [00:26]

> "在同步子代理里，supervisor 会阻塞，直到子代理完成。"
> —— p022 [00:55]

> "子代理是专门的 AI agent，主 agent 把任务委派给它们。每个子代理有自己的上下文、工具、记忆和指令，去完成一项聚焦的工作并返回结果。"
> —— p022 [01:53]

> "为什么要用子代理？很简单：它帮你把复杂任务拆成可管理的部分；并行跑任务以提升速度；隔离上下文以减少噪音和 token 消耗；为每项工作使用正确的工具和技能；提升可靠性和可维护性。"
> —— p022 [02:21]

> "主 agent 理解总体目标、规划并拆解任务、委派给子代理、汇总所有结果并返回最终答案。而子代理聚焦于特定任务，有自己的上下文、自己的工具和技能，返回结构化结果。"
> —— p022 [02:49]

> "子代理把一个通用 agent 变成一支专家团队。把正确的任务交给正确的专家。"
> —— p022 [03:17]

> "模型这一项非常重要的一点是：它是可选的，可以覆盖主 agent 的默认模型。如果这个模型不工作，就会用主 agent 所用的那个模型。"
> —— p022 [06:38]

> "这个 create_deep_agent 有很多参数，它有 memory、有 skills、有 sub agents 所有这些。"
> —— p022 [09:57]

> "在 Claude Code 里也有子代理、有 agent views 这些东西，我们这里是想用 LangChain SDK 把同样的东西搭出来，用的是 deep agents。"
> —— p022 [16:23]

> "创建一个 Streamlit 应用，它像一个对话式聊天机器人，用上 deep agent demo 文件夹里讨论过的所有特性。"
> —— p023 [00:29]

> "要运行 Streamlit 应用，你需要用命令 `streamlit run streamlit_app.py`。"
> —— p023 [02:53]

> "无论我们做什么对话，都可以保存到 state backend、file system backend、store backend，你想存哪就存哪。"
> —— p023 [03:21]

> "deep agent 加载时，你会看到我们在加载 agents.md 文件，技能也在加载。然后根据问题，特定的技能会被用到。"
> —— p023 [03:21]

> "这个 deep agent 能做规划，它有虚拟文件系统访问、上下文工程、技能、子代理、可切换的 backend、通过 checkpoint 实现的线程记忆，还有很多。"
> —— p023 [04:18]

> "系统提示词是：你是一个专家级 AI 助手和研究员。你在需要时使用联网搜索工具做深入研究。用 to-do 规划多步工作，把冗长的查询卸载出去，把深度研究委派给你的子代理。"
> —— p023 [04:18]

> "它做了规划、to-do，收集 LLM gateway 的当前信息、综合、找细节……然后它做了网页搜索，很可能把任务委派给了子代理，然后又做网页搜索、联网搜索、规划、写作。它还加载了我们专门创建的 report writer 的 skill.md 文件，还有 instruction.md 文件。"
> —— p023 [05:15]

> "我给了技能访问权限，问怎么初始化 EC2 实例，它就应该用 AWS 那个已经创建好的技能。这里你也能看到 state 里的虚拟文件，报告已经生成了。"
> —— p023 [06:12]

> "它选中了 AWS 的 skill.md，这很神奇吧？这是我的 read file，它在读整个文件，也在读 instruction.md，然后它把结果写出来。结果很漂亮，因为它用了另一个技能——报告撰写。"
> —— p023 [07:08]

---

## 3. 从零复现

### 3.1 环境准备

讲师用的是 Python + `uv` 管理依赖（P21 里执行 `uv add -r requirement.txt`）。目录结构按讲师在 P21 里描述的样子搭：

```
deep-agent-demo/
├── .env
├── requirement.txt
├── skills/
│   ├── python/
│   │   ├── skill.md
│   │   ├── instruction.md
│   │   └── examples.md
│   ├── langgraph/
│   │   ├── skill.md
│   │   ├── instruction.md
│   │   └── examples.md
│   ├── aws/
│   │   ├── skill.md
│   │   ├── instruction.md
│   │   └── examples.md
│   └── report_writer/
│       ├── skill.md
│       ├── instruction.md
│       └── examples.md
├── agents.md
├── streamlit_app.py
└── notebooks/
    ├── 01_skills.ipynb
    ├── 02_subagents.ipynb
    └── 03_structured_subagents.ipynb
```

`.env` 里放三个 key（P22 明确提到 OpenAI、Groq、Tavily 三个 API key）：

```
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
```

`requirement.txt` 里至少要有（讲师在 P21 里明确提到 `langchain-quickjs`，其余按 deep agents SDK 的常规依赖补齐；课里没给完整清单，以下为可运行的最小集合）：

```
deepagents
langchain
langchain-openai
langchain-community
tavily-python
pydantic
streamlit
python-dotenv
langchain-quickjs
```

安装：

```bash
uv add -r requirement.txt
```

> 讲师在 P21 [14:21] 的原命令是 `uv add minus rrequirement.txt`（语音识别把 `-r` 念成了 "minus r"），实际命令就是 `uv add -r requirement.txt`。

### 3.2 第一步：用 Claude Code 生成技能文件（P21）

讲师没有手写技能文件，而是在命令行里敲 `claude` 打开 Claude Code，然后给了一段自然语言指令，让它批量生成技能目录。复现时你可以照抄这个思路（提示词按讲师口述整理）：

```
在 skills 文件夹下创建以下技能：
1. python skill —— 专门回答 Python 相关问题
2. langgraph skill —— 专门回答 LangGraph 相关问题
3. aws skill —— 专门回答 AWS 相关问题
4. report writer skill —— 在 deep agent 回答完任何问题后，用来写报告

每个技能目录下都要有：
- skill.md（技能的名称、描述、元数据）
- instruction.md（这个技能的工作流和规则）
- examples.md（示例）

所有文件都用 Markdown 写，内容要能被当作上下文喂给 deep agent。
```

生成后逐个检查。讲师在 P21 [10:09]–[11:32] 演示了检查过程：`python/` 目录下有 `skill.md`、`instruction.md`、`examples.md`；`examples.md` 里是 Python 代码示例；`instruction.md` 里写的是「对每一个 Python 相关查询都遵循这个工作流：先识别用户要什么——是新代码、修 bug、重构、解释还是 review——先设计再写码」。`aws/` 目录同理。

> 讲师强调：这些文件不用手写，用 Claude Code 生成即可，"如果直接预览，你就能看到这个 MD 文件是怎么生成的"（p021 [11:32]）。

### 3.3 第二步：读取技能文件（P21）

在 notebook 里先装依赖、重启 kernel（讲师在 P21 [15:42] 遇到 `NoModuleLangChainQuickJS`，重启 kernel 后解决），然后用 `pathlib` 读单个技能文件：

```python
from pathlib import Path

skill_content = Path("skills/langgraph/skill.md").read_text(encoding="utf-8")
```

讲师在这里踩了一个坑：变量名写成了 `skill content`（带空格），报 `name 'skill content' is not defined`，改成 `skill_content` 后正常（p021 [16:37]）。

然后批量读取所有技能目录下的 `skill.md`：

```python
from pathlib import Path

skills_dir = Path("skills")
skill_files = sorted(skills_dir.glob("*/skill.md"))

all_skills = {}
for f in skill_files:
    all_skills[f.parent.name] = f.read_text(encoding="utf-8")

for name, content in all_skills.items():
    print(f"===== {name} =====")
    print(content[:500])
```

讲师在 P21 [17:28] 说明为什么要读这些文件："因为当我调用 deep agent 时，我应该能把所有这些 MD 文件的引用交给它。"

### 3.4 第三步：把技能挂到 deep agent 上（P21）

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

agent = create_deep_agent(
    model="openai:gpt-5.4",
    backend=state_backend,
    skills="/skills",
    checkpointer=MemorySaver(),
)
```

讲师在 P21 [17:28]–[17:58] 逐项说明：模型用 OpenAI GPT-5.4；backend 用 state backend；`skills` 参数给的是 `/skills`，即根目录下的 skills 文件夹；checkpointer 用内存版。

第一次调用先问「你有哪些技能可用、各自什么时候用」，并把所有技能文件内容作为参考一起传进去：

```python
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What skills do you have available and when would you use each?",
            }
        ],
        "skills": all_skills,   # 把所有 skill.md 内容作为参考
    },
    config={"configurable": {"thread_id": "thread-skills-1"}},
)
print(result["messages"][-1].content)
```

讲师在 P21 [18:25] 说输出里会列出「available skills are aws，用于 AWS 服务架构、EC2、S3、Lambda 等」。

然后换一个问题触发技能加载：

```python
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "How do I build a LangGraph with conditional routing and memory? Show a minimal example.",
            }
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-2"}},
)
for m in result["messages"]:
    m.pretty_print()
```

讲师在 P21 [19:51]–[20:45] 描述输出：先出现 human message，然后能看到 agent 加载了 `langgraph/skill.md`，从里面的 name、description、metadata 匹配到这是 LangGraph 问题，接着读取具体文件，拿到上下文后生成回答（"state graph plus router"），还更新了 `report.md` 文件。

同样的方式再问 AWS：

```python
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "How do I set up an EC2 instance in AWS?"}
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-3"}},
)
for m in result["messages"]:
    m.pretty_print()
```

讲师在 P21 [22:09] 指出输出里能看到 tool call，参数里出现 `aws/skill.md`，然后 agent 给出「登录 AWS 控制台」之类的步骤。

再问 Python：

```python
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "Write me Python code to do binary search."}
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-4"}},
)
for m in result["messages"]:
    m.pretty_print()
```

讲师在 P21 [23:05] 提到：第一次问「给一个 Python 里 OOP 的例子」时 agent 直接给了 AI message，没有触发技能调用；把问题改成「写 Python 代码做二分查找」之后才触发。这是一个很实用的经验：**问题描述越具体、越像「要产出代码」，越容易命中技能**。

### 3.5 第四步：建子代理（P22）

先建一个联网搜索工具（Tavily）：

```python
import os
from typing import Literal
from tavily import TavilyClient
from deepagents import create_deep_agent

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search."""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
```

讲师在 P22 [05:14]–[05:43] 逐项解释参数：`query`、`max_results`（返回几条）、`topic`（搜哪类内容：general / news / finance，默认 general）、`include_raw_content`（布尔，默认 false）；函数体里用 Tavily client 按这些参数返回结果；docstring 写 "Run a web search"。

然后把这个工具包成子代理：

```python
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in-depth questions",
    "system_prompt": "You are a great researcher.",
    "tools": [internet_search],
    "model": "openai:gpt-5.4",   # 可选，不填则继承主 agent 的模型
}
```

讲师在 P22 [06:12]–[06:38] 说明每个子代理必须给的字段：name（子代理叫什么）、description（描述，这里是「用来研究更深入的问题」）、system_prompt（"你是一个出色的研究员"，讲师说 system prompt 可以随便写）、tools（这里就是 internet_search，可以加任意多个工具）、model（可选，会覆盖主 agent 的默认模型；如果这个模型不工作，就用主 agent 的模型）。

挂到主 agent 上：

```python
agent = create_deep_agent(
    model="openai:gpt-5.4",
    subagents=[research_subagent],
)
```

讲师在 P22 [07:08]–[08:01] 说：`subagents` 是 `create_deep_agent` 的一个参数，把刚才那个子代理放进去；模型用 5.4，也可以用 Groq 的模型。讲师还试过加 `verbose=True`，但报 `unexpected argument`，说明这个参数在当前版本不存在（p022 [08:30]），所以最终没加。

调用：

```python
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "Research about LLM gateways and provide me a detailed summary.",
            }
        ]
    }
)
for m in result["messages"]:
    m.pretty_print()
```

讲师在 P22 [09:57]–[11:21] 描述输出：主 agent 先建 to-do list（"Research LLM gateways definition, capabilities, vendors"），to-do 本身是一次 tool call，然后不断更新 to-do、探索信息，最后给出总结。整个过程要等一会儿，因为子代理在联网搜索。

### 3.6 第五步：让子代理返回结构化输出（P22）

用 Pydantic 定义返回结构：

```python
from pydantic import BaseModel, Field
from typing import List
from deepagents import create_deep_agent

class ResearchFindings(BaseModel):
    """Structured research findings."""
    summary: str = Field(description="Summary of findings")
    confidence: float = Field(description="Confidence score from 0 to 1")
    sources: List[str] = Field(description="List of source URLs")
```

讲师在 P22 [12:44]–[13:13] 逐字段说明：`summary` 是字符串，描述是「发现的总结」；`confidence` 是 float，0 到 1 的置信度；`sources` 是 URL 列表。

给子代理加 `response_format`：

```python
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in-depth questions",
    "system_prompt": "You are a great researcher.",
    "tools": [internet_search],
    "model": "openai:gpt-5.4",
    "response_format": ResearchFindings,
}

agent = create_deep_agent(
    model="openai:gpt-5.4",
    subagents=[research_subagent],
)
```

讲师在 P22 [13:39] 说：子代理里再加一个参数 `response_format`，赋值为刚才定义的 `ResearchFindings`（讲师口述时也说过可以叫 `findings`，因为会拿到多个 URL）。

调用：

```python
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "Research recent advances in quantum computing."}
        ]
    }
)
for m in result["messages"]:
    m.pretty_print()
```

讲师在 P22 [14:35]–[15:57] 描述输出：human message 之后是 AI message，AI message 里有一次子代理的 tool call，tool message 里就是结构化结果——summary、confidence score、sources（一堆 URL）。主 agent 拿到这个结构化结果后再汇总成最终回答。

### 3.7 第六步：端到端 Streamlit 应用（P23）

讲师没有手写这个 app，而是打开 Claude Code 给了一句指令（P23 [00:29]–[01:28] 口述整理）：

```
创建一个 Streamlit 应用，它像一个对话式聊天机器人，
用上 deep agent demo 文件夹里讨论过的所有特性：
基础 agent、deep agent、context engineering、backend、sub agents、skills、agents.md。
把 deep agents 相关 notebook 里解释过的所有特性都包含进去。
```

Claude Code 会自己去读 notebook、读 skills 目录、读 agents.md，然后生成 `streamlit_app.py`。讲师在 P23 [02:24] 说它「搜索模式、读五个文件、从 skills 到 memory、context engineering 全都读一遍」。

运行命令（讲师在 P23 [02:53] 明确给出）：

```bash
streamlit run streamlit_app.py
```

界面能力（讲师在 P23 [02:53]–[03:21] 演示）：

- 顶部可以选模型（讲师演示选了 OpenAI GPT-5.5）
- 可以选对话保存位置：state backend / file system backend / store backend
- 启动时加载 `agents.md` 和 skills
- 提问后按问题内容决定加载哪个技能

系统提示词（讲师在 P23 [04:18] 念出来的原文，译文）：

> "你是一个专家级 AI 助手和研究员。你在需要时使用联网搜索工具做深入研究。用 to-do 规划多步工作，把冗长的查询卸载出去，把深度研究委派给你的子代理。"

验证一：问「Research about LLM gateways and provide me a detailed survey.」，输出里能看到 planning、to-do、web search、子代理委派、再次 web search、规划、写作，并且加载了 `report_writer/skill.md` 和 `instruction.md`（p023 [05:15]）。

验证二：问「How to initialize an EC2 instance」，输出里能看到它选中了 `aws/skill.md`，读了整个文件和 `instruction.md`，然后写结果，写结果时又用了 report writer 技能（p023 [07:08]）。

讲师在 P23 [06:12] 还提到界面上能看到「state 里的虚拟文件」和生成的报告。

---

## 4. 完整代码

> 本节所有代码均来自逐字稿口述内容整理。逐字稿没有贴出完整源码，也没有 OCR 片段，因此以下是把讲师口述的每一行还原成可运行文件的结果；凡是讲师没说的细节（如 import 顺序、默认值），按 SDK 常规写法补齐，并在第 7 节标注。

### 4.1 `requirement.txt`

```
deepagents
langchain
langchain-openai
langchain-community
tavily-python
pydantic
streamlit
python-dotenv
langchain-quickjs
```

### 4.2 `.env`

```
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
```

### 4.3 `skills/python/skill.md`

```markdown
# Python Skill

name: python-expert
description: Specialized capability for answering Python-related questions and writing Python code.
metadata:
  domain: programming
  language: python

## When to use
Use this skill for any Python-related query: writing new code, fixing bugs,
refactoring, explaining code, or reviewing code.
```

### 4.4 `skills/python/instruction.md`

```markdown
# Python Skill Instructions

Follow this workflow for every Python-related query:

1. Identify what the user wants:
   - new code
   - bug fix
   - refactor
   - explanation
   - review
2. Design before coding.
3. Write clean, readable Python.
4. Explain the key decisions briefly.
```

### 4.5 `skills/python/examples.md`

```markdown
# Python Examples

## Binary search

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```
```

### 4.6 `skills/langgraph/skill.md`

```markdown
# LangGraph Skill

name: langgraph-expert
description: Specialized capability for answering LangGraph questions, including state graphs, conditional routing, and memory.
metadata:
  domain: ai-framework
  framework: langgraph

## When to use
Use this skill for any LangGraph-related query.
```

### 4.7 `skills/langgraph/instruction.md`

```markdown
# LangGraph Skill Instructions

For every LangGraph-related query:
1. Identify the user's goal (graph construction, routing, memory, checkpointing).
2. Prefer minimal, runnable examples.
3. Show the state schema and the routing function explicitly.
```

### 4.8 `skills/aws/skill.md`

```markdown
# AWS Skill

name: aws-expert
description: Specialized capability for answering AWS questions: services, architecture, EC2, S3, Lambda.
metadata:
  domain: cloud
  provider: aws

## When to use
Use this skill for any AWS-related query.
```

### 4.9 `skills/aws/instruction.md`

```markdown
# AWS Skill Instructions

For every AWS-related query:
1. Identify which AWS service is involved.
2. Give step-by-step console or CLI instructions.
3. Mention prerequisites (IAM permissions, region, etc.).
```

### 4.10 `skills/report_writer/skill.md`

```markdown
# Report Writer Skill

name: report-writer
description: Triggered after answering any question, to write a structured report.
metadata:
  domain: writing

## When to use
Trigger after answering any question, to produce a report.
```

### 4.11 `skills/report_writer/instruction.md`

```markdown
# Report Writer Instructions

After answering a question:
1. Write a report to `report.md`.
2. Include: question, answer summary, key steps, sources.
```

### 4.12 `notebooks/01_skills.ipynb`（对应 P21）

```python
# cell 1
from pathlib import Path

skill_content = Path("skills/langgraph/skill.md").read_text(encoding="utf-8")
print(skill_content[:500])

# cell 2
from pathlib import Path

skills_dir = Path("skills")
skill_files = sorted(skills_dir.glob("*/skill.md"))

all_skills = {}
for f in skill_files:
    all_skills[f.parent.name] = f.read_text(encoding="utf-8")

for name, content in all_skills.items():
    print(f"===== {name} =====")
    print(content[:500])

# cell 3
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

agent = create_deep_agent(
    model="openai:gpt-5.4",
    backend=state_backend,
    skills="/skills",
    checkpointer=MemorySaver(),
)

# cell 4
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What skills do you have available and when would you use each?",
            }
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-1"}},
)
print(result["messages"][-1].content)

# cell 5
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "How do I build a LangGraph with conditional routing and memory? Show a minimal example.",
            }
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-2"}},
)
for m in result["messages"]:
    m.pretty_print()

# cell 6
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "How do I set up an EC2 instance in AWS?"}
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-3"}},
)
for m in result["messages"]:
    m.pretty_print()

# cell 7
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "Write me Python code to do binary search."}
        ],
        "skills": all_skills,
    },
    config={"configurable": {"thread_id": "thread-skills-4"}},
)
for m in result["messages"]:
    m.pretty_print()
```

> 注：`state_backend` 在逐字稿里只被提到名字（"backend 用 state backend"），没有给出构造代码。课里没讲它的具体 import 路径，请以 deep agents SDK 文档为准。

### 4.13 `notebooks/02_subagents.ipynb`（对应 P22 前半）

```python
# cell 1
import os
from typing import Literal
from tavily import TavilyClient
from deepagents import create_deep_agent

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search."""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )

# cell 2
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in-depth questions",
    "system_prompt": "You are a great researcher.",
    "tools": [internet_search],
    "model": "openai:gpt-5.4",
}

# cell 3
agent = create_deep_agent(
    model="openai:gpt-5.4",
    subagents=[research_subagent],
)

# cell 4
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "Research about LLM gateways and provide me a detailed summary.",
            }
        ]
    }
)
for m in result["messages"]:
    m.pretty_print()
```

### 4.14 `notebooks/03_structured_subagents.ipynb`（对应 P22 后半）

```python
# cell 1
from pydantic import BaseModel, Field
from typing import List
from deepagents import create_deep_agent

class ResearchFindings(BaseModel):
    """Structured research findings."""
    summary: str = Field(description="Summary of findings")
    confidence: float = Field(description="Confidence score from 0 to 1")
    sources: List[str] = Field(description="List of source URLs")

# cell 2
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in-depth questions",
    "system_prompt": "You are a great researcher.",
    "tools": [internet_search],
    "model": "openai:gpt-5.4",
    "response_format": ResearchFindings,
}

# cell 3
agent = create_deep_agent(
    model="openai:gpt-5.4",
    subagents=[research_subagent],
)

# cell 4
result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "Research recent advances in quantum computing."}
        ]
    }
)
for m in result["messages"]:
    m.pretty_print()
```

### 4.15 `agents.md`

```markdown
# Project Rules

- You are an expert AI assistant and researcher.
- Use internet search tools when needed.
- Plan multi-step work with a to-do list.
- Offload bulky queries.
- Delegate deep research to your sub-agents.
```

### 4.16 `streamlit_app.py`（对应 P23）

> 讲师没有贴出这个文件的源码，只说了它是 Claude Code 生成的、包含所有特性、用 `streamlit run streamlit_app.py` 启动。以下是根据讲师在 P23 演示的界面能力（模型选择、backend 选择、agents.md 加载、skills 加载、sub agents、checkpoint 线程记忆）整理的示意实现。**课里没有给出这个文件的实际代码，以下为示意**。

```python
import os
import streamlit as st
from pathlib import Path
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

st.set_page_config(page_title="Deep Agent Chatbot", layout="wide")
st.title("Deep Agent Chatbot")

# 模型选择
model = st.selectbox(
    "Model",
    ["openai:gpt-5.4", "openai:gpt-5.5", "groq:llama-3.3-70b"],
)

# backend 选择
backend_choice = st.selectbox(
    "Backend",
    ["state", "filesystem", "store"],
)

# 加载 agents.md
agents_md = Path("agents.md").read_text(encoding="utf-8")

# 加载所有 skills
skills_dir = Path("skills")
all_skills = {}
for f in sorted(skills_dir.glob("*/skill.md")):
    all_skills[f.parent.name] = f.read_text(encoding="utf-8")

st.sidebar.write("Loaded skills:", list(all_skills.keys()))

# 子代理
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in-depth questions",
    "system_prompt": "You are a great researcher.",
    "tools": [internet_search],
    "model": model,
}

agent = create_deep_agent(
    model=model,
    subagents=[research_subagent],
    skills="/skills",
    checkpointer=MemorySaver(),
)

thread_id = st.text_input("Thread ID", value="thread-1")

query = st.chat_input("Ask something...")
if query:
    with st.chat_message("user"):
        st.write(query)
    result = agent.invoke(
        {
            "messages": [{"role": "user", "content": query}],
            "skills": all_skills,
        },
        config={"configurable": {"thread_id": thread_id}},
    )
    with st.chat_message("assistant"):
        st.write(result["messages"][-1].content)
```

---

## 5. 逐行解释

**`skills="/skills"`**：讲师在 P21 [17:58] 说这个参数给的是「根目录下的 skills 文件夹」。注意这里写的是绝对路径风格的 `/skills`，不是相对路径 `skills/`。它的作用是告诉 deep agent 技能目录在哪，agent 内部按需去读。

**`backend=state_backend`**：讲师在 P21 [10:37] 提到 backend 可以是 state backend，也可以是别的 middleware，比如 code interpreter middleware。P23 的界面上给了三种：state backend、file system backend、store backend。在 JS/Node 里对应的是「把会话状态存在内存对象 / 存到磁盘 / 存到外部 KV」这三种选择。

**`checkpointer=MemorySaver()`**：讲师在 P21 [17:58] 说「我用了内存 checkpointer」。它的作用是按 `thread_id` 保存对话历史，所以后面每次 invoke 都要传 `config={"configurable": {"thread_id": ...}}`。讲师在 P21 [21:13] 换问题时特意「改 thread，让之前的对话不要串进来，就像开一个新聊天」。在 JS/Node 里对应的是给每个会话一个 session id，把消息数组按 session id 存起来。

**`"skills": all_skills`**：这是 invoke 时额外传的参考内容。讲师在 P21 [17:28] 说「因为当我调用 deep agent 时，我应该能把所有这些 MD 文件的引用交给它」。注意它和 `create_deep_agent(skills="/skills")` 是两回事：前者是把内容直接塞进这次调用的上下文，后者是告诉 agent 技能目录的位置、让它自己按需读。

**`m.pretty_print()`**：讲师在 P21 [19:23] 说用它打印所有消息。输出里能看到 human message、AI message、tool call（参数里带 `langgraph/skill.md` 或 `aws/skill.md`）、tool message、最终 AI message。这是验证「技能到底有没有被加载」最直接的办法。

**`topic: Literal["general", "news", "finance"] = "general"`**：讲师在 P22 [05:14] 逐项解释：topic 是搜哪类内容，默认 general。`Literal` 是 Python 的类型标注，限定只能取这三个值。前端同学可以理解为 TS 里的联合类型 `"general" | "news" | "finance"`。

**`include_raw_content: bool = False`**：讲师在 P22 [05:14] 说这是布尔值，默认 false，控制要不要返回网页原始内容。

**`"model": "openai:gpt-5.4"`（子代理里）**：讲师在 P22 [06:38] 强调这是**可选**的，会覆盖主 agent 的默认模型；如果这个模型不工作，就用主 agent 的模型。所以子代理可以比主 agent 用更便宜或更强的模型。

**`"response_format": ResearchFindings`**：讲师在 P22 [13:39] 说这是子代理的又一个参数，赋值为 Pydantic 模型，子代理就会按这个结构返回。在 JS/Node 里对应的是用 zod schema 约束 LLM 的结构化输出。

**`Field(description=...)`**：讲师在 P22 [13:13] 逐字段说明：`summary` 是字符串、描述「发现的总结」；`confidence` 是 float、0 到 1 的置信度；`sources` 是 URL 列表。description 会作为提示词的一部分告诉模型这个字段该填什么。

**`verbose=True`**：讲师在 P22 [08:01] 试过加这个参数想看更多信息，但报 `unexpected argument`（p022 [08:30]），说明当前版本的 `create_deep_agent` 不接受它。所以复现时不要加。

**`streamlit run streamlit_app.py`**：讲师在 P23 [02:53] 明确给出的启动命令。Streamlit 是 Python 的轻量 Web 框架，跑起来会自动开浏览器。

**为什么技能要「按需加载」而不是全塞进 system prompt**：讲师在 P21 [03:42] 对比了 memory 和 skill——memory 是全局规则、偏好、架构约定，量小、始终注入；skill 是详细工作流、领域知识、分步指导，量大、按需加载、用完释放。如果把所有技能都塞进 system prompt，上下文会被撑爆、token 成本高、还会干扰模型判断。这就是讲师说的「不要一直把所有东西都加载进来」。

**为什么子代理能省 token**：讲师在 P22 [02:21] 说子代理「隔离上下文以减少噪音和 token 消耗」。主 agent 只拿到子代理返回的结构化结果，不需要把子代理中间那一大堆搜索过程都装进自己的上下文。在 JS/Node 里对应的是「把重活丢给一个独立 worker，只把结果传回主线程」。

**为什么同步子代理会阻塞**：讲师在 P22 [00:55] 说「supervisor 会阻塞，直到子代理完成」。主 agent 派活之后要等子代理干完才能继续。讲师在 P22 [01:24] 预告后面还会讲异步子代理（"a sync sub agent"），那时主 agent 就不阻塞了——但这一段课里没讲异步的实现。

---

## 6. 复现检查清单

按顺序打勾，每一条都能在终端或 notebook 输出里看到对应现象：

- [ ] `.env` 里三个 key 都填了：`OPENAI_API_KEY`、`GROQ_API_KEY`、`TAVILY_API_KEY`
- [ ] `uv add -r requirement.txt` 成功，`langchain-quickjs` 装上了
- [ ] **重启 kernel**（讲师在 P21 [15:42] 就是因为没重启报 `NoModuleLangChainQuickJS`）
- [ ] `skills/` 下有 `python/`、`langgraph/`、`aws/`、`report_writer/` 四个目录
- [ ] 每个目录下都有 `skill.md`、`instruction.md`、`examples.md`
- [ ] `Path("skills/langgraph/skill.md").read_text(encoding="utf-8")` 能打印出内容（变量名别写成带空格的 `skill content`，讲师在 P21 [16:37] 踩过这个坑）
- [ ] 批量读取后 `all_skills` 的 key 是四个技能名
- [ ] `create_deep_agent(model=..., backend=..., skills="/skills", checkpointer=MemorySaver())` 不报错
- [ ] 问「你有哪些技能」时，输出里列出了 aws 等技能及用途
- [ ] 问 LangGraph 条件路由时，`pretty_print` 里能看到 tool call 参数含 `langgraph/skill.md`
- [ ] 问 EC2 时，能看到 tool call 参数含 `aws/skill.md`
- [ ] 问「Python 里 OOP 的例子」可能不触发技能；改成「写 Python 代码做二分查找」才触发（讲师在 P21 [23:05] 的现象）
- [ ] `internet_search` 单独调用能返回 Tavily 结果
- [ ] `create_deep_agent(subagents=[research_subagent])` 不报错
- [ ] 问「Research about LLM gateways」时，输出里先出现 to-do tool call，再出现子代理的 tool message
- [ ] 加 `response_format=ResearchFindings` 后，tool message 里能看到 summary / confidence / sources 三个字段
- [ ] `streamlit run streamlit_app.py` 能起服务
- [ ] 界面上能选模型、选 backend
- [ ] 启动时侧边栏/日志里能看到 agents.md 和 skills 被加载
- [ ] 问 LLM gateway 时能看到 report_writer 技能被加载
- [ ] 问 EC2 时能看到 aws 技能被加载，且最终报告用了 report writer 技能

---

## 7. 课里没讲但你会撞上的

1. **`state_backend` 的构造代码**。讲师在 P21 [17:28] 只说「backend 用 state backend」，没有给出 import 和实例化代码。你需要查 deep agents SDK 文档确认它的类名和参数。同理 `file system backend`、`store backend` 在 P23 只出现在界面选项里，没有代码。
2. **`create_deep_agent` 的完整参数表**。讲师在 P22 [09:57] 说它「有 memory、有 skills、有 sub agents 所有这些」，但只演示了 `model`、`backend`、`skills`、`checkpointer`、`subagents` 五个。`memory` 参数怎么传、传什么格式，课里没讲。
3. **异步子代理**。讲师在 P22 [01:24] 明确预告「下一节会看到 a sync sub agent，那时主 agent 不阻塞」，但 P22 这一段只演示了同步的。异步怎么写，课里没讲。
4. **`verbose` 参数**。讲师试了报 `unexpected argument`，说明当前版本没有。如果你在别的版本上看到这个参数，以你装的版本为准。
5. **`streamlit_app.py` 的实际源码**。讲师全程用 Claude Code 生成，没有贴出来。第 4.16 节是示意实现，不是讲师的原文件。你要复现讲师的界面，最靠谱的办法是照抄他在 P23 [00:29] 给 Claude Code 的那段指令，让 Claude Code 读你的 notebook 和 skills 目录自己生成。
6. **`agents.md` 的确切内容**。讲师在 P23 [04:18] 念了系统提示词的要点（专家级助手和研究员、需要时联网搜索、用 to-do 规划、卸载冗长查询、把深度研究委派给子代理），但没给出文件全文。第 4.15 节是按这段口述整理的。
7. **技能文件的完整内容**。讲师只展示了 `python/examples.md` 里有 Python 代码示例、`python/instruction.md` 里有「先识别需求再设计再写码」的工作流，其余技能文件的具体文字没有逐字展示。第 4.3–4.11 节是按讲师口述的字段（name、description、metadata、workflow、examples）整理的模板，不是讲师的原文件。
8. **`langchain-quickjs` 的用途**。讲师在 P21 [13:52] 说「有一个非常重要的库叫 langchain-quickjs」，装完就继续往下走了，没有解释它具体干什么。课里没讲。
9. **Tavily 的返回结构**。讲师只说「用 Tavily client 按 query、max_results、include_raw_content、topic 返回结果」，没有展示返回的 JSON 长什么样。`internet_search` 直接把 `tavily_client.search(...)` 的返回值原样返回，所以子代理拿到的就是 Tavily 的原始结构。字段名请以 Tavily 实际输出为准。
10. **`report.md` 是谁写的**。讲师在 P21 [20:45] 说输出里「更新了 report.md」，在 P23 [06:40] 说「报告已经生成了」，但没有讲这个文件是 agent 通过哪个工具写的、写到哪个路径。从上下文看是 report_writer 技能驱动的，但具体机制课里没讲。
11. **成本与延迟**。讲师在 P22 [14:35] 和 P23 [06:40] 反复说「deep agent 会花不少时间，取决于 API key、网速等」。实际跑的时候一次研究任务可能要几十秒到几分钟，别以为是卡死了。