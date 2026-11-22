# AI Security Bootcamp part2：用 LangGraph 构建多智能体架构（简单 / 监督者 / 层级）

> 说明：本节 P025 是一节纯代码实操课，讲师在 Jupyter Notebook（VS Code 里打开）中现场敲代码，演示三种多智能体架构中的前两种——**简单多智能体（Simple Multi-Agent）** 和 **监督者多智能体（Supervisor Multi-Agent）**，第三种**层级式（Hierarchical）**作为课后作业布置。逐字稿里没有出现任何 OCR 文本，因此第 4 节「完整代码」是根据逐字稿逐句还原的可运行版本，凡是逐字稿没念到的细节（例如具体 import 路径、提示词全文）我会明确标注「课里没讲，以下为按逐字稿语义补全」。

---

## 1. 这一节做什么

这一节的目标是：**用 LangGraph 从零搭出两种可运行的多智能体工作流**，并理解第三种（层级式）该怎么扩展。

具体产出三样东西：

1. **简单多智能体图**：`researcher → writer → END` 的线性图。researcher 节点绑定一个 `search_web` 工具（底层调 Tavily 搜索），把搜索结果交给 writer 节点，writer 用 LLM 写总结。讲师现场跑通并打印出最终摘要。
2. **监督者多智能体图**：一个 `supervisor` 节点持有控制权，根据当前 state（研究是否完成、分析是否完成、报告是否完成）决定下一个该谁干活——`researcher` / `analyst` / `writer` / `END`。每个子 agent 干完活把控制权交回 supervisor，supervisor 再判断。讲师现场用「AI 在医疗行业的好处与风险」这个问题跑通，输出了最终报告。
3. **层级式架构的作业**：CEO → 研究组长 / 写作组长 → 各自组员，讲师只给了业务描述，没给代码。

对前端转 AI 应用工程师的读者，这一节的核心心智模型是：**LangGraph 的图 = 状态机 + 路由函数**。你在 React 里写 reducer + 路由，这里是 `State + Node + Conditional Edge`，概念一一对应。

---

## 2. 讲师原话

> "我们将讨论三个重要的架构，它们几乎覆盖了所有情况。第一个是简单多智能体：独立的 agent 之间互相通信、互相创建，信息从一个 agent 流向另一个 agent。"
> —— p025 [00:00]

> "第二个是监督者多智能体。你可以看到这里有一个 supervisor，这个 supervisor 负责把流程传给 analyst、researcher、writer，一旦工作完成，请求会回到 supervisor，然后 supervisor 结束整个工作流。"
> —— p025 [00:26]

> "监督者多智能体在很多公司里被使用。比如说建筑公司里会有一个主管，针对某项工作需要多少员工，由他来决定。他把任务发给某个工人，工人完成后把结论交回给主管。主管拿到后觉得还需要继续做，就再把工作派给另一个工人。"
> —— p025 [00:26]

> "第三个技术是层级式 AI agent 架构。把这三个重要架构都覆盖到，你用 LangGraph 实现多 AI agent 的部分就完整了。"
> —— p025 [00:54]

> "state 会拥有贯穿整个图流动的所有信息。"
> —— p025 [05:02]

> "researcher agent 的工作非常简单：它使用 LLM 加上绑定的工具，工具就是 web search。Tavily 搜索做的事情就由这个函数来完成。然后拿到的所有响应会交给 writer，writer 去写总结。"
> —— p025 [06:51]

> "我们之所以叫它多智能体，是因为两个节点在互相通信。这个节点大概在做工具搜索、拿到信息，然后把下一份数据发给 writer。"
> —— p025 [13:08]

> "这里你能看到一个非常主要的缺点：从 researcher 到 writer，从 writer 回不到 researcher。你可以再加一条从 writer 到 researcher 的线，但你觉得它能正常工作吗？因为它会一直处在循环里。要么你可以加一个条件边，说把 writer 变成一个工具节点，需要的时候才执行它。所以简单多智能体架构有很多缺点，你没法只靠它构建一个非常高效的系统。"
> —— p025 [13:36]

> "接下来我们要用的是监督者多智能体架构。我们要创建一个 supervisor 节点，一旦拿到输入，它就应该决定是传给 analyst、researcher 还是 writer。"
> —— p025 [14:34]

> "比如我说：supervisor，你需要写一篇关于 agent 的文章。supervisor 可以直接给 writer，也可以直接给 researcher，researcher 做完研究再交给 writer 去写。如果 supervisor 说：分析这份报告然后帮我写出来，那么 supervisor 需要先传给 analyst，analyst 再传给 writer。"
> —— p025 [15:02]

> "supervisor 完全依赖被分配的任务，这是一种非常高效的做事方式。"
> —— p025 [15:29]

> "这个 chain 是一个 supervisor chain。提示词说：你是一个管理 agent 团队的 supervisor。有三个 agent：researcher 收集信息和数据，analyst 分析数据并提供洞察，writer 创建报告和总结。根据当前状态和对话，决定下一个该哪个 agent 工作。如果任务完成，回复 done。"
> —— p025 [17:21]

> "当控制权交回 supervisor 时，supervisor 必须再跑一遍那个功能，返回当前是什么情况。"
> —— p025 [21:04]

> "writer agent 会拿 researcher 给的研究数据、拿分析数据、拿当前任务，然后以专业写作者的身份，基于这个任务写一份报告。"
> —— p025 [22:02]

> "router 函数取决于你具体想怎么路由，因为你要基于特定条件从一个节点路由到另一个。它拿 supervisor state，根据 `state.get("next_agent")` 路由到下一个 agent。如果没有 next_agent，默认回到 supervisor；如果 next_agent 是 end，就结束；如果是 supervisor / researcher / analyst / writer，就交给对应的下一个 agent；否则返回 supervisor。"
> —— p025 [25:21]

> "请记住我们用的那张图和那个 graph。先创建 workflow，加 supervisor 节点、researcher 节点、analyst 节点、writer 节点，入口设为 supervisor。然后加条件边：要么去 supervisor，要么去 researcher；从 researcher 再回到 supervisor。"
> —— p025 [26:18]

> "层级式架构里，一个 CEO 拿到任务后决定是给研究组长还是写作组长。给到研究组长，研究组长让数据研究员和市场研究员干活；干完后回到 CEO，CEO 再交给写作组长，由技术写手和总结写手完成。"
> —— p025 [30:02]

---

## 3. 从零复现

### 3.1 环境准备

讲师用的是 VS Code 里的 Jupyter Notebook + `uv` 管理依赖。逐字稿里明确出现的安装命令只有一条：

```bash
uv add langchain_community
```

讲师原话是「我打开终端，进到命令行，然后写 `uv add langchain_community`，这就是我们要用的库」。安装后重新执行 import 就成功了。

> 课里没讲：完整的依赖清单（`langgraph`、`langchain-groq`、`tavily-python`、`python-dotenv` 等）讲师没有逐条 `uv add`，但从 import 语句可以反推。下面给出的是按逐字稿 import 内容反推的最小依赖集合，版本号课里没讲，用当前稳定版即可。

**目录结构（建议）**

```
multi-agent-demo/
├── .env
├── pyproject.toml          # uv init 生成
├── simple_multi_agent.ipynb
└── supervisor_multi_agent.ipynb
```

**依赖（`pyproject.toml` 里由 uv 管理，或直接 `uv add`）**

```bash
uv init multi-agent-demo
cd multi-agent-demo
uv add langgraph langchain langchain-groq langchain-community tavily-python python-dotenv
```

**环境变量（`.env`）**

讲师原话：「我用 `os.environ`，这里用我的 `GROQ_API_KEY`，我已经演示过怎么用了。`getenv`，它就是 `GROQ_API_KEY`。」

```dotenv
GROQ_API_KEY=你的_groq_key
TAVILY_API_KEY=你的_tavily_key
```

> 课里没讲：讲师只明确提到 `GROQ_API_KEY`。`TAVILY_API_KEY` 是 Tavily 搜索库的常规要求，逐字稿里 `TavilySearchResults` 被调用但没念出 key 名，这里按 Tavily 官方约定补上，请以你实际拿到的 key 名为准。

### 3.2 简单多智能体：搭建步骤

**Step 1 — 导入库。** 讲师逐字念出的 import 包括：`TypedDict`、`Annotated`、`List`、`Literal`、`BaseMessage`、`HumanMessage`、`AIMessage`、`SystemMessage`、`ChatGroq`、`StateGraph`、`MessagesState`、`ToolNode`、`create_react_agent`、`TavilySearchResults`、`init_chat_model`、`load_dotenv`、`os`。

**Step 2 — 加载环境变量。** `load_dotenv()` + `os.getenv("GROQ_API_KEY")`。

**Step 3 — 定义 State。** 讲师原话：「我创建一个 state，写 `class AgentState`，继承 `MessagesState`。`MessagesState` 里有一个变量叫 `messages`。我再创建一个变量叫 `next_agent`，类型是 string，表示下一个该哪个 agent 走。」

**Step 4 — 定义两个工具。**
- `search_web`：用 `TavilySearchResults(max_results=3)` 并 `.invoke`，加 `@tool` 装饰器转成工具。
- `write_summary`：接收 findings，把前 500 字符内容写进 summary，同样 `@tool`。

**Step 5 — 初始化 LLM。** 讲师原话：「用 `init_chat_model`，初始化 `ChatGroq`，模型是 `llama-3.1-8b-instant`。」

**Step 6 — 写 researcher 节点。** 取 state 里所有 messages，追加一条 SystemMessage：「你是一个研究助手，用 search_web 工具查找用户请求的信息。」然后 `llm.bind_tools([search_web])`，`invoke(system + messages)`，把返回的 message 放进 `messages`，`next_agent` 设为 `"writer"`。

**Step 7 — 写 writer 节点。** 追加 SystemMessage：「你是一个技术写作者，审阅对话并为发现创建清晰简洁的总结。」`llm.invoke(system + messages)`，返回，`next_agent` 设为 `"end"`（因为按图它要走到 END）。

**Step 8 — 写工具执行节点。** 讲师原话：「创建一个 tool executor node，就是 `execute_tools` 的定义。拿 state 的 messages，取最后一条，检查是不是 tool call。如果是，就创建一个 `ToolNode`，里面放 `search_web` 和 `write_summary`，把 ToolNode 的响应返回。」

**Step 9 — 建图。** 讲师现场把之前写的一大段 `create_minimal_multi_agent` 函数删掉，改成直接建图：

```python
workflow = StateGraph(MessagesState)
workflow.add_node("researcher", researcher_agent)
workflow.add_node("writer", writer_agent)
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", END)
final_workflow = workflow.compile()
```

讲师原话：「我创建了一个 messages state 的 state graph。第一件事是 researcher 节点——我有没有定义 researcher 节点的函数？这里你会看到，我不写 researcher node，我写 researcher_agent。然后是 researcher_agent、writer_agent，接着 researcher 到 writer、writer 到 end。我们写 workflow，编译，返回。」

**Step 10 — 执行。** `final_workflow.invoke({"messages": [HumanMessage(content="research about the use case of generative AI in business")]})`，然后取 `response["messages"][-1].content` 打印。

讲师原话：「我拿到这个信息，看到 AI message summary……基于源结果，我识别出与这个用例相关的关键点……所有信息都在这里显示出来了。你也可以用 pretty print 来显示。」

### 3.3 监督者多智能体：搭建步骤

**Step 1 — 扩展 State。** 讲师原话：「在 state 定义里，`MessagesState` 内部有 message 变量。除此之外我给信息：`current_agent`（后来改成 `next_agent`）、`task_assignments`（字典 string→list of string，追踪每个 agent 该做什么）、`agent_outputs`（存每个 agent 的输出）、`workflow_stage`、`maximum_iteration`、`final_output`。」

讲师现场把 `current_agent` 改名为 `next_agent`，最终 state 字段是：`next_agent`、`research_data`、`analysis`、`final_report`、`tasks_complete`、`current_task`。

**Step 2 — 建 supervisor chain。** 用 `ChatGroq` + 一个 prompt，prompt 内容见第 2 节引用。chain 的输出是下一个 agent 的名字或 `done`。

**Step 3 — 写 supervisor 节点。** 讲师原话：「拿 state 的 messages，取最后一条。如果有消息就看它，否则说没有任务。一旦用户给了输入，我们就读这个输入当作 task。然后看 `research_data` 变量里有没有东西，没有就设条件。接着 `get_llm_decision`，用同一个 supervisor chain 做决策。task 有值、几个布尔值……如果全是 done，就拿 decision text。如果 decision text 是 done 或者包含 report，就结束工作流。如果 decision text 里有 researcher，下一个 agent 就是 researcher，supervisor 消息是『让我们从研究开始，分配给 researcher』。如果是 analyst，就是『研究完成，该分析了，分配给 analyst』。如果是 writer，同样传给 writer。如果 next agent 是 end，就完成任务。」

**Step 4 — 写 writer / researcher / analyst 三个子 agent 节点。** 每个都是「取 state 里的相关字段 → 拼 prompt → `llm.invoke` → 返回更新后的 state」。

**Step 5 — 写 router 函数。** 讲师原话见第 2 节引用，核心是 `state.get("next_agent")` 的分支判断。

**Step 6 — 建图。** 讲师原话：「创建 `StateGraph(SupervisorState)`，加 supervisor、researcher、analyst、writer 四个节点，`set_entry_point("supervisor")`。然后加条件边：要么去 supervisor，要么去 researcher；从 researcher 再回 supervisor。supervisor→supervisor、researcher→researcher、analyst→analyst、writer→writer 都要有。最后 `workflow.compile()`。」

**Step 7 — 执行。** `graph.invoke({"messages": [HumanMessage(content="What are the benefits and risks of AI in healthcare?")]})`，取 `response["messages"][-1].content` 或 `final_report` 字段打印。

讲师现场踩了一个坑：`chat prompt template is not defined`，他 Google 了一下 `ChatPromptTemplate` 的 import 路径，补上后重新执行成功。

### 3.4 层级式架构（作业）

讲师只给了业务描述，没给代码。复现思路（**课里没讲代码，以下为按讲师业务描述的结构化设计**）：

- 顶层 `ceo` 节点：拿任务，决定给 `research_team_lead` 还是 `writing_team_lead`。
- `research_team_lead` 节点：把任务拆给 `data_researcher` 和 `market_researcher`。
- `writing_team_lead` 节点：把任务拆给 `technical_writer` 和 `summary_writer`。
- 每个组员干完回组长，组长汇总回 CEO，CEO 再决定下一步或结束。
- 实现上就是「supervisor 模式套两层」：CEO 层一个 router，每个 team lead 内部再一个 router。

---

## 4. 完整代码

> 以下代码按逐字稿逐句还原，可直接保存为 `.py` 运行。逐字稿没念到的细节（如部分 import 路径、prompt 全文、`write_summary` 的完整实现）已标注「课里没讲，按语义补全」。OCR 无内容，故无 OCR 代码可保留。

### 4.1 `simple_multi_agent.py`

```python
# simple_multi_agent.py
# 简单多智能体：researcher -> writer -> END
# 依赖：uv add langgraph langchain langchain-groq langchain-community tavily-python python-dotenv

import os
from typing import Annotated, List, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_core.tools import tool
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


# ---------- State ----------
class AgentState(MessagesState):
    # MessagesState 已自带 messages 字段
    next_agent: str


# ---------- Tools ----------
@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    search = TavilySearchResults(max_results=3)
    results = search.invoke(query)
    return str(results)


@tool
def write_summary(findings: str) -> str:
    """Write a summary of the findings."""
    # 课里没讲完整实现，讲师只说「把前 500 字符内容显示在 summary 里」
    return f"Summary of findings:\n{findings[:500]}"


# ---------- LLM ----------
# 讲师原话：用 init_chat_model 初始化 ChatGroq，模型 llama-3.1-8b-instant
researcher_llm = init_chat_model(
    "llama-3.1-8b-instant",
    model_provider="groq",
    api_key=GROQ_API_KEY,
)
writer_llm = init_chat_model(
    "llama-3.1-8b-instant",
    model_provider="groq",
    api_key=GROQ_API_KEY,
)


# ---------- Nodes ----------
def researcher_agent(state: AgentState):
    messages = state["messages"]
    system = SystemMessage(
        content=(
            "You are a research assistant. "
            "Use the search_web tool to find information about the user request."
        )
    )
    llm_with_tools = researcher_llm.bind_tools([search_web])
    response = llm_with_tools.invoke([system] + messages)
    return {"messages": [response], "next_agent": "writer"}


def writer_agent(state: AgentState):
    messages = state["messages"]
    system = SystemMessage(
        content=(
            "You are a technical writer. Review the conversation and "
            "create a clear, concise summary of the findings."
        )
    )
    response = writer_llm.invoke([system] + messages)
    return {"messages": [response], "next_agent": "end"}


def execute_tools(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if getattr(last_message, "tool_calls", None):
        tool_node = ToolNode([search_web, write_summary])
        response = tool_node.invoke(state)
        return response
    return state


# ---------- Graph ----------
workflow = StateGraph(MessagesState)
workflow.add_node("researcher", researcher_agent)
workflow.add_node("writer", writer_agent)
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", END)

final_workflow = workflow.compile()


if __name__ == "__main__":
    response = final_workflow.invoke(
        {
            "messages": [
                HumanMessage(
                    content="research about the use case of generative AI in business"
                )
            ]
        }
    )
    print(response["messages"][-1].content)
```

### 4.2 `supervisor_multi_agent.py`

```python
# supervisor_multi_agent.py
# 监督者多智能体：supervisor 决定 researcher / analyst / writer / END
# 依赖同 simple_multi_agent.py

import os
from typing import Annotated, List, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, MessagesState, END

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


# ---------- State ----------
class SupervisorState(MessagesState):
    next_agent: str
    research_data: str
    analysis: str
    final_report: str
    tasks_complete: bool
    current_task: str


# ---------- LLM ----------
llm = init_chat_model(
    "llama-3.1-8b-instant",
    model_provider="groq",
    api_key=GROQ_API_KEY,
)


# ---------- Supervisor chain ----------
# 课里没讲 prompt 全文，以下按讲师口述的 supervisor prompt 语义补全
supervisor_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a supervisor managing a team of agents. "
            "There are three agents: "
            "researcher gathers information and data, "
            "analyst analyzes data and provides insights, "
            "writer creates reports and summaries. "
            "Based on the current state and conversation, decide which agent should work next. "
            "If the task is complete, respond with 'done'.",
        ),
        (
            "human",
            "Current state: has_research={has_research}, "
            "has_analysis={has_analysis}, has_report={has_report}. "
            "Task: {task}",
        ),
    ]
)
supervisor_chain = supervisor_prompt | llm


# ---------- Supervisor node ----------
def supervisor_agent(state: SupervisorState):
    messages = state["messages"]
    last_message = messages[-1] if messages else None
    task = last_message.content if last_message else "no task"

    has_research = bool(state.get("research_data"))
    has_analysis = bool(state.get("analysis"))
    has_report = bool(state.get("final_report"))

    decision = supervisor_chain.invoke(
        {
            "has_research": has_research,
            "has_analysis": has_analysis,
            "has_report": has_report,
            "task": task,
        }
    )
    decision_text = decision.content.lower()

    if "done" in decision_text or "report" in decision_text:
        return {
            "messages": [AIMessage(content="Workflow complete.")],
            "next_agent": "end",
            "current_task": task,
        }

    if "researcher" in decision_text:
        return {
            "messages": [AIMessage(content="Let's start with research, assigning to researcher.")],
            "next_agent": "researcher",
            "current_task": task,
        }

    if "analyst" in decision_text:
        return {
            "messages": [AIMessage(content="Research is done. Time for analysis, assigning to analyst.")],
            "next_agent": "analyst",
            "current_task": task,
        }

    if "writer" in decision_text:
        return {
            "messages": [AIMessage(content="Assigning to writer.")],
            "next_agent": "writer",
            "current_task": task,
        }

    return {
        "messages": [AIMessage(content="Returning to supervisor.")],
        "next_agent": "supervisor",
        "current_task": task,
    }


# ---------- Sub-agents ----------
def researcher_agent(state: SupervisorState):
    task = state.get("current_task", "")
    prompt = (
        f"As a research specialist, research the following topic thoroughly: {task}. "
        "Return detailed findings."
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "research_data": response.content,
        "messages": [AIMessage(content=f"Completed research on: {task}")],
        "next_agent": "supervisor",
    }


def analyst_agent(state: SupervisorState):
    research_data = state.get("research_data", "")
    task = state.get("current_task", "")
    prompt = (
        f"As an analyst, analyze the following research data for the task: {task}.\n"
        f"Research data:\n{research_data}\n"
        "Provide key insights and patterns."
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "analysis": response.content,
        "messages": [AIMessage(content="Analysis complete.")],
        "next_agent": "supervisor",
    }


def writer_agent(state: SupervisorState):
    research_data = state.get("research_data", "")
    analysis = state.get("analysis", "")
    task = state.get("current_task", "")
    prompt = (
        f"As a professional writer, create an exclusive report based on this task: {task}.\n"
        f"Research findings:\n{research_data}\n"
        f"Analysis findings:\n{analysis}\n"
        "Create a well-structured document with all this information."
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "final_report": response.content,
        "messages": [AIMessage(content="Final report created.")],
        "next_agent": "supervisor",
    }


# ---------- Router ----------
def router(state: SupervisorState) -> Literal["supervisor", "researcher", "analyst", "writer", "end"]:
    next_agent = state.get("next_agent")
    if not next_agent:
        return "supervisor"
    if next_agent == "end":
        return "end"
    if next_agent in ("supervisor", "researcher", "analyst", "writer"):
        return next_agent
    return "supervisor"


# ---------- Graph ----------
workflow = StateGraph(SupervisorState)
workflow.add_node("supervisor", supervisor_agent)
workflow.add_node("researcher", researcher_agent)
workflow.add_node("analyst", analyst_agent)
workflow.add_node("writer", writer_agent)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    router,
    {
        "supervisor": "supervisor",
        "researcher": "researcher",
        "analyst": "analyst",
        "writer": "writer",
        "end": END,
    },
)
workflow.add_edge("researcher", "supervisor")
workflow.add_edge("analyst", "supervisor")
workflow.add_edge("writer", "supervisor")

graph = workflow.compile()


if __name__ == "__main__":
    response = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content="What are the benefits and risks of AI in healthcare?"
                )
            ]
        }
    )
    print(response.get("final_report", response["messages"][-1].content))
```

### 4.3 层级式架构（作业骨架，课里没讲代码，以下为示意）

```python
# hierarchical_multi_agent.py
# 课里没有代码，以下为按讲师业务描述的结构化示意，仅帮助理解，不是讲师原版

from langgraph.graph import StateGraph, MessagesState, END

class HierarchicalState(MessagesState):
    next_agent: str
    research_data: str
    market_data: str
    final_report: str
    current_task: str

# 节点：ceo / research_team_lead / writing_team_lead
#       data_researcher / market_researcher / technical_writer / summary_writer
# 路由：ceo 决定去 research_team_lead 还是 writing_team_lead
#       research_team_lead 决定去 data_researcher 还是 market_researcher
#       writing_team_lead 决定去 technical_writer 还是 summary_writer
#       每个组员干完回自己的 team lead，team lead 汇总回 ceo
```

---

## 5. 逐行解释

### 5.1 简单多智能体

- `class AgentState(MessagesState)`：继承 `MessagesState` 就白拿一个 `messages` 字段，LangGraph 会自动做消息追加（类似 Redux 里 `messages: [...state.messages, action.payload]` 的 reducer）。讲师原话：「`MessagesState` 里有一个变量叫 `messages`。」
- `next_agent: str`：讲师加这个字段是为了让节点能告诉图「下一个该谁」。在简单图里其实用 `add_edge` 硬编码了，这个字段更多是为监督者图做铺垫。
- `@tool` 装饰器：把普通 Python 函数转成 LLM 能调用的工具。**在 JS/Node 里对应**：相当于给函数加一个 JSON Schema 描述，让模型知道参数类型。
- `TavilySearchResults(max_results=3)`：讲师明确说「max result 等于 3」。`max_results` 控制返回条数，3 是讲师选的保守值。
- `llm.bind_tools([search_web])`：把工具 schema 绑到 LLM 上，模型返回的 message 里会带 `tool_calls` 字段。**注意**：绑了工具不代表模型一定会调，它可能直接回答。
- `execute_tools` 里 `getattr(last_message, "tool_calls", None)`：讲师原话「检查是不是 tool call」。这是防御性写法，因为普通 AIMessage 没有 `tool_calls` 属性。
- `ToolNode([search_web, write_summary])`：LangGraph 预置节点，自动执行 tool_calls 并返回 ToolMessage。讲师原话：「创建一个 ToolNode，里面放 search_web 和 write_summary。」
- `workflow.add_edge("researcher", "writer")`：硬编码边，这就是讲师说的「主要缺点」——writer 回不到 researcher。讲师原话：「从 writer 回不到 researcher……它会一直处在循环里。」
- `workflow.compile()`：把图编译成可执行对象，返回的 `final_workflow` 有 `.invoke()` 方法。
- `response["messages"][-1].content`：取最后一条消息的内容。讲师原话：「response 的 messages，我要最后一个，最后一个的 content。」

### 5.2 监督者多智能体

- `SupervisorState` 比 `AgentState` 多了 6 个字段：`next_agent`、`research_data`、`analysis`、`final_report`、`tasks_complete`、`current_task`。讲师原话：「`task_assignments` 是字典 string→list of string，追踪每个 agent 该做什么；`agent_outputs` 存每个 agent 的输出；还有 `workflow_stage`、`maximum_iteration`、`final_output`。」——注意讲师口述的字段名和最终代码里的字段名不完全一致，最终 state 用的是 `research_data` / `analysis` / `final_report` / `tasks_complete` / `current_task`，以最终代码为准。
- `supervisor_chain = supervisor_prompt | llm`：LCEL 管道语法，等价于 `llm.invoke(supervisor_prompt.format(...))`。**在 JS/Node 里对应**：类似 `pipe(prompt, llm)`。
- `supervisor_agent` 里的 `has_research = bool(state.get("research_data"))`：讲师原话「这是布尔变量，当前 state 里研究数据有没有创建、分析数据有没有创建」。用 `bool()` 把空字符串转 False。
- `if "done" in decision_text or "report" in decision_text`：讲师原话「如果 decision text 是 done 或者包含 report，就结束工作流」。这里用子串匹配是讲师现场的简化写法，生产环境建议用结构化输出（`with_structured_output`），**课里没讲**。
- `router` 函数返回 `Literal[...]`：类型标注帮助 LangGraph 做静态检查。讲师原话：「它拿 supervisor state，根据 `state.get("next_agent")` 路由。」
- `add_conditional_edges("supervisor", router, {...})`：条件边的三参数形式——源节点、路由函数、路由函数返回值到目标节点的映射。讲师原话：「要么去 supervisor，要么去 researcher；从 researcher 再回 supervisor。」
- `workflow.add_edge("researcher", "supervisor")`：子 agent 干完活无条件回 supervisor。讲师原话：「当控制权交回 supervisor 时，supervisor 必须再跑一遍那个功能。」
- `set_entry_point("supervisor")`：图的入口是 supervisor，不是 researcher。这是监督者模式和简单模式最大的结构差异。

### 5.3 讲师现场踩的坑

- **`No module called langchain_community`**：讲师原话「我打开终端，进到命令行，写 `uv add langchain_community`」。装完重新执行 import 就成功。
- **`chat prompt template is not defined`**：讲师原话「chat prompt template 没定义，没关系，我 Google 一下 `ChatPromptTemplate` 在哪」。补上 `from langchain_core.prompts import ChatPromptTemplate` 后成功。
- **`unexpected indent`**：讲师原话「有一些缩进问题，我修一下」。Python 缩进敏感，复制粘贴时容易多空格。

---

## 6. 复现检查清单

跑完这一节，逐项打勾：

- [ ] `uv add langchain_community` 执行成功，`import langchain_community` 不报错
- [ ] `.env` 里 `GROQ_API_KEY` 已填，`load_dotenv()` 后 `os.getenv` 能拿到值
- [ ] `simple_multi_agent.py` 能跑通，终端打印出 researcher 的搜索结果 + writer 的总结
- [ ] 简单图的 `final_workflow.get_graph().draw_mermaid()` 能看到 `researcher → writer → END` 三个节点
- [ ] `supervisor_multi_agent.py` 能跑通，终端打印出 `final_report`
- [ ] 监督者图的 `graph.get_graph().draw_mermaid()` 能看到 `supervisor` 为中心、`researcher`/`analyst`/`writer` 三个子节点都指回 `supervisor`
- [ ] 用「AI 在医疗行业的好处与风险」这个问题跑，能看到 supervisor 依次派活给 researcher → analyst → writer
- [ ] 故意把 `GROQ_API_KEY` 改错，确认报错信息能定位到 key 问题
- [ ] 层级式架构作业：至少画出 CEO → 两个 team lead → 四个组员的图结构（代码可暂不跑通）

---

## 7. 课里没讲但你会撞上的

1. **`init_chat_model` 的 `model_provider` 参数**：讲师只念了「初始化 ChatGroq，模型 llama-3.1-8b-instant」，没念 `model_provider="groq"`。实际调用时这个参数必填，否则 LangChain 不知道用哪个 provider 的客户端。
2. **`TavilySearchResults` 的 import 路径**：讲师只念了类名，没念 `from langchain_community.tools.tavily_search import TavilySearchResults`。不同 langchain-community 版本路径可能变，报 `ImportError` 时去官方文档查当前路径。
3. **`ToolNode` 的 import 路径**：讲师念了 `ToolNode`，实际在 `langgraph.prebuilt` 下。LangGraph 版本升级时这个路径改过，以你装的版本为准。
4. **supervisor 的决策稳定性**：讲师用子串匹配（`"researcher" in decision_text`）判断下一个 agent，LLM 输出稍微变个措辞就可能匹配失败。生产环境建议用 `llm.with_structured_output(Schema)` 强制输出枚举值，**课里没讲**。
5. **无限循环风险**：监督者图里 supervisor → researcher → supervisor → ... 如果没有 `maximum_iteration` 兜底，LLM 一直说「还没完成」就会死循环。讲师在 state 里提了 `maximum_iteration` 字段但没在代码里用，**课里没讲怎么用**。LangGraph 的 `compile()` 支持 `recursion_limit` 参数，可以设个上限。
6. **`write_summary` 工具在简单图里其实没被调用**：讲师定义了它，但简单图的 researcher 只绑了 `search_web`，writer 节点也没绑工具。这个工具在简单图里是「定义了但没用上」，别以为是 bug。
7. **Groq 的 rate limit**：`llama-3.1-8b-instant` 免费额度有限，监督者图一次 invoke 会调多次 LLM（supervisor 每轮都调），跑几次就可能 429。**课里没讲**，但你会撞上。
8. **Jupyter 的 cell 执行顺序**：讲师在 notebook 里现场改代码、删函数、重跑 cell，如果你按顺序从上到下跑，可能因为前面 cell 定义了后面又删掉的函数而报 `NameError`。建议把最终代码存成 `.py` 跑，别在 notebook 里追讲师的编辑历史。
9. **`MessagesState` 的 `messages` 是追加语义**：每次节点返回 `{"messages": [new_msg]}`，LangGraph 会 append 而不是覆盖。如果你想要覆盖，得用 `RemoveMessage` 或自定义 reducer，**课里没讲**。
10. **层级式架构的「组长汇总」逻辑**：讲师只说了「组员干完回组长，组长回 CEO」，但没说组长怎么汇总多个组员的输出（是拼接？是再调一次 LLM 总结？）。这是作业里最需要你自己设计的地方，**课里没讲**。

---

**参考截图位置建议**（按内容相关性，实际插入时请按上文格式放到对应章节旁）：

- 简单图结构讲解处：`![p025 01:02 讲师开始讲三种多智能体架构](images/p025_0062s.jpg)`
- State 定义处：`![p025 05:10 讲师定义 AgentState 继承 MessagesState](images/p025_0310s.jpg)`
- 工具定义处：`![p025 07:13 讲师展示 search_web 与 write_summary 两个工具](images/p025_0433s.jpg)`
- 简单图执行结果处：`![p025 13:25 简单多智能体跑通输出摘要](images/p025_0805s.jpg)`
- 监督者 state 定义处：`![p025 15:29 讲师扩展 SupervisorState 字段](images/p025_0929s.jpg)`
- supervisor chain 处：`![p025 17:32 讲师展示 supervisor prompt 与 chain](images/p025_1052s.jpg)`
- router 函数处：`![p025 21:40 讲师写 router 路由函数](images/p025_1300s.jpg)`
- 监督者图跑通处：`![p025 23:44 监督者图输出最终报告](images/p025_1424s.jpg)`