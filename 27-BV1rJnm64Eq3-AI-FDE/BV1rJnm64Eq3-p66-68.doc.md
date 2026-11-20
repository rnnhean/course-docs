# AI FDE（BV1rJnm64Eq3）P66–P68：从 `create_agent` 到可恢复的 LangGraph 理赔工作流

> 说明：这份文档按「把项目跑起来」组织，不是按 P66/P67/P68 的顺序复述。
> 逐字稿没有逐行念出代码的地方（例如 SQL 建表语句、`calculate_payout` 的完整参数表、依赖版本号），文中会明确标注「课里没讲」，并给出可直接运行的补全版本。

---

## 1. 这一节做什么

上一节你已经会用一个 `create_agent(...)` 换回一个「agent 对象」，然后 `invoke` 它。这一节讲师干的第一件事，是把这个幻觉戳破：那个对象根本不是普通的 agent 对象，打印它的类型会得到 `langgraph.graph.state.CompiledStateGraph`——它是一张已经编译好的 LangGraph 状态图。

所以这三集的真实目标是：

1. **看见黑盒**：把 `create_agent` 返回的对象画成 mermaid 图，看到里面其实只有「模型节点 + 工具节点 + 起止节点」和若干实线 / 虚线边。
2. **手写一遍**：不用 `create_agent`，自己定义 `ClaimState`、四个业务节点（`agent` / `decide` / `approval` / `pay`）、两个条件路由函数，用 `StateGraph` 拼出同一张图，并用 `compile(checkpointer=...)` 编译。
3. **加上 durable 能力**：用 Postgres（Supabase）做 checkpointer，实现两件在 agent 里几乎做不到的事：
   - **Human-in-the-loop**：金额超过 1000 美元时，图在 `approval` 节点停住，等人批准；
   - **崩溃恢复**：内核被 kill 掉、Python 变量全没了，重新连上数据库后仍然能从同一个 `thread_id` 接着批、接着付。
4. **落到产品里**（P68）：把上面这套东西写进 `docs/durable.md` 作为业务需求，交给 Claude Code（配合 Supabase 远程 MCP）分 6 个 phase 实现：dashboard 审批 → 后端记录 → 后端向 agent 发 resume → agent 恢复并调用 payout 工具 → 回调后端 → 全程 checkpoint 落 Supabase。

跑通之后的验收现象是：

| 场景 | 期望现象 |
|---|---|
| CLM 1005，赔付 $243（低于 1000） | 图自己跑完，`payments` 表出现一条 `amount=243`、`approved_by` 为空 |
| CLM 1003，赔付 $3750（高于 1000） | 图停在 `approval`，返回中断信息，`payments` 表**没有**这条记录 |
| 对 CLM 1003 发 resume | 图从 `approval` 继续 → `pay` → `END`，`payments` 表写入 `approved_by = Dana Whitfield` |
| CLM 1008，赔付 $2240，中断后重启 kernel | 重新连库后查 `thread_id` 仍然是「等待审批」，resume 后正常付款，`approved_by = PREA` |
| 手动再调一次 `pay` 节点 | 不产生第二条 payment |

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

> "我们照例先从加载数据开始。这些数据我们很熟悉：25 条理赔申请，赔付金额超过一千美元的，需要主管审批。"
> —— p066 [00:00]

这句定了本节唯一的一条业务规则：**1000 美元是审批线**。

> "创建 agent，我们现在知道它就像一个向导。……但还需要知道的是，事情远不止于此。它背后还有一整张图依赖图。"
> —— p066 [01:05]

> "运行之后，我们发现它是 `langraph.graph.state.compiledState.graph`。这可比我们预想的要复杂一些。"
> —— p066 [02:44]

> "我们把状态对象定义为一个 typed dict 类型……可以看到，这个 typed dict 里有 messages，它是一个聊天消息列表；还有 claim ID、decision、payout、rationale 和 approved by。"
> —— p066 [05:04]

> "这两个函数都是节点。只要一个函数接收状态并返回状态或状态的一部分，它就是一个节点，并且会用 reducer 把它与当前状态合并。"
> —— p066 [06:15]

> "它的工作方式就是调用 `interrupt`。它会针对某个 claim ID、payout 和 rationale 调用 `interrupt`，这会让该节点的执行立即停止。……只有在这一行之后、人工批准之后才会继续，而且它会自动生效，不需要任何 if 语句，也不需要等待或循环之类的东西。"
> —— p066 [08:03]

> "其中一个叫 `after agent`。agent 运行时，它会检查该 agent 是否在调用工具。如果是，就返回 `tools`；如果不是，就返回 `decide`。"
> —— p066 [09:21]

> "基本上，如果……其中有一个未获批准的 decision，那就结束；如果 payout 超过审批限额，就把它转到 `approval`；否则就执行支付。"
> —— p066 [09:41]

> "我们想用一个 postgres check pointer。只要把之前设置好的 SuperBase 连接传进去并完成设置，LandGraph 就能把检查点写入我们的 SuperBase 数据库了。"
> —— p066 [10:42]

> "我们先添加一个叫 `agent` 的节点……一个叫 `tools` 的节点，里面放着 `calculate payout` 工具；一个叫 `decide` 的节点，一个叫 `approval` 的节点，还有一个叫 `pay` 的节点。……还记得吗，这就是我们的五个节点。"
> —— p067 [00:00]

> "我们从起点走到 `agent` 节点，然后有一条条件边从 `agent` 节点出发，把它连到 `tools` 或 `decide`……接着有一条边从 `tools` 回到 `agent`，然后还有一条条件边从 `decide` 指向 `approval`、`pay` 或结束……最后有一条边从 `approval` 到 `pay`，再有一条边从 `pay` 到结束。"
> —— p067 [00:29]

> "我们要调用 `graph.invoke`，这就是这里最关键的一行……持久化级别设为同步，确保它在做任何其他事情之前先保存检查点。"
> —— p067 [04:00]

> "问题在于，因为金额超过一千美元，它不会处理这笔理赔，而是会停下来，表示正在等待人工审批。"
> —— p067 [05:02]

> "登记人工审批的方式是再次调用图，传入一个 `command` 对象，就是这里的 `resume`，并给出处理器的名称。"
> —— p067 [05:25]

> "我要按这个重启按钮，重启内核。这个实验背后的 Python 进程刚刚被杀死，并用一个全新的 Python 进程重新启动。这些变量都已经不在了。"
> —— p067 [08:17]

> "它可以完全像之前一样恢复……因为 LangGraph 借助这个检查点机制构建得非常健壮，所以服务器消失与否没有任何影响。"
> —— p067 [08:17]

> "这是你设计节点方式的一部分……它们会检查 ID，确保自己应该执行所做的事情。它们绝不会重复执行同一件事。"
> —— p067 [06:54]

> "你可以加上拒绝的能力，看看效果如何。那会挺有意思的。"
> —— p067 [11:53]

> "拿另一台电脑，随便哪台别的电脑，填入同一个数据库 URL，看看你能不能在别的地方批准这笔理赔。"
> —— p067 [12:22]

> "我们要把产品构建出真正的 LangGraph 依赖图，就像我们刚才做的那样……处理器将能够签核，签核会传到后端，后端会记录下来，并向 agent 发送一条恢复消息。"
> —— p068 [00:00]

> "这张图里还缺了很重要的东西……所有这些都会把检查点写入 SuperBase。我们还会加入 Langfuse 来做可观测性。"
> —— p068 [00:45]

> "我加了一个文件，路径是 `week two, day three, product durable dot md`……把它复制到 `docs` 文件夹里。"
> —— p068 [01:04]

> "请在 `docs/durable` 里规划持久化状态。"
> —— p068 [07:57]

> "第一阶段有一些成功标准要逐项勾选，数量不少；第二阶段是 SuperBase 里的记录；第三阶段是理赔 agent，它是一个会保存自身进度的图；第四阶段是登录、退出后重新拾起这笔理赔；第五阶段是工作能在重启后存活；第六阶段是对全部五笔理赔做一次试运行。"
> —— p068 [08:33]

> "请实现持久化状态的方案。"
> —— p068 [08:51]

![p066 04:17 讲师说明 create_agent 返回的对象本身就是一张可直接打印的图](images/p066_0257s.jpg)

---

## 3. 从零复现

### 3.0 前置条件

- Python 3.11+（`TypedDict` + `X | None` 语法）
- 一个 Supabase 项目，拿到 **Postgres 连接串**（含密码）。连接串只走 `.env`，不写进代码。
- 一个 OpenAI 兼容的 endpoint + key。讲师用的是 `Luna` 这个模型名 + 自定义 base URL + `low` reasoning effort（—— p066 [00:36]）。
- 上一节已经写过的 `calculate_payout` 工具函数（如果没有，本文件末尾给了能跑的最小版本）。

### 3.1 目录结构

```
durable-claims/
├── .env
├── requirements.txt
├── durable_claims.py      # 图本体：state / 节点 / 边 / compile
├── demo.py                # 三个实验：自动付款、人工审批、崩溃恢复
├── sql/
│   └── 001_payments.sql   # payments 表
└── docs/
    └── durable.md         # P68 的业务需求 spec（给 Claude Code 读）
```

### 3.2 装依赖

```bash
mkdir -p durable-claims/sql durable-claims/docs
cd durable-claims
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3.3 写环境变量

`.env` 里只放下面这些名字。**变量名是本文档定的**，讲师没有逐个念过变量名，你可以按自己项目改。

```bash
# OpenAI 兼容端点（讲师在 p066 [00:36] 提到 base URL / key / 模型名 Luna）
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://your-endpoint/v1
MODEL_NAME=Luna

# Supabase Postgres 连接串（务必用 direct connection 或 session pooler，别用 transaction pooler）
SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres?options=-csearch_path%3Dlab

# 业务规则：超过这个金额必须人工审批
APPROVAL_LIMIT=1000
```

> 关于 `search_path=lab`：P67 [11:13] 讲师在 Supabase Table Editor 里把 Schema 从 public 切到 lab 才看到 `checkpoints` 表。所以 checkpointer 必须先落到 `lab` 这个 schema。在连接串里指定 `search_path` 是最省事的复现方式；用别的方式（Supabase 项目默认 schema / 显式 `CREATE SCHEMA`）也行，但**必须保证 checkpointer 和 payments 在同一个你查得到的 schema 里**。

### 3.4 建 payments 表

在 Supabase SQL Editor 里执行（或本地 `psql` 连上去执行）：

```bash
psql "$SUPABASE_DB_URL" -f sql/001_payments.sql
```

> 课里没讲建表 DDL 原文，讲师只描述了它是「a table in superbase that tracks when claims are paid it tracks payments」（—— p066 [08:23]）并且有 approvals 字段。下面这份 DDL 是按该描述写的最小可用版本。

### 3.5 跑第一遍：不中断的索赔

```bash
python demo.py auto
```

期望：终端打印出 decision / payout / rationale，`payments` 表多出一条 `claim_id='CLM-1005'`、`amount=243`、`approved_by IS NULL` 的记录（对应 p067 [04:33]「It's been approved for the same reason as before ... $243 payout」）。

### 3.6 跑第二遍：超过 1000 美元，图停住

```bash
python demo.py interrupt
```

期望：终端打印「CLM-1003 needs a handler to approve it」和一坨中断信息；`payments` 表**没有** CLM-1003。

### 3.7 跑第三遍：人工 resume

```bash
python demo.py resume CLM-1003 "Dana Whitfield"
```

期望：图从 `approval` 继续 → `pay` → `END`，表里出现 `approved_by='Dana Whitfield'`（对应 p067 [05:54]）。

### 3.8 跑第四遍：崩溃恢复

```bash
# 第一步：发起一个需要审批的索赔，然后让进程直接退出（模拟内核被 kill）
python demo.py start CLM-1008

# 第二步：完全新开一个进程（Python 里所有变量都没了）
python demo.py status CLM-1008     # 期望：仍然 waiting for approval
python demo.py resume CLM-1008 "PREA"
```

这一段对应 p067 [08:17]–[10:24] 的整套演示：讲师的 kernel 被重启、`result` 变量报 NameError，但重新连库后 `graph.get_state(config)` 仍然是「等待审批」。

### 3.9 查 checkpoints

Supabase Dashboard → Table Editor → **Schema 切到 `lab`** → 打开 `checkpoints` 表，按 `thread_id` 过滤，你会看到 CLM-1008 那一条一路 `start → agent → tools → agent → decide → approval → pay` 的每个检查点（P67 [11:13] 的原话就是这条链路）。

![p067 09:08 讲师点击重启按钮，Python kernel 被 kill 后变量全部丢失](images/p067_0548s.jpg)

### 3.10 P68 的产品化：把 spec 交给 Claude Code

```bash
# 1) 把课程仓库里的 week2/day3 需求文件复制进 docs/
cp labs/week2/day3/product_durable.md docs/durable.md

# 2) 换成起点分支（讲师给的两个快捷方式）
git stash            # 有本地改动时先 stash
git checkout week2-day3-start

# 3) 在项目根目录启动 Claude Code
claude

# 4) 在 Claude Code 里检查 MCP（Supabase 需要先授权）
#    输入 /mcp  → 看到 supabase 或 playwright（如无 supabase，说明上节课那条 claude mcp add 没跑）
#    选中 supabase → Enter → Enter → 浏览器弹窗 → 授权

# 5) 让 Claude Code 先出计划（讲师这次等了约 20 分钟）
> please plan durable state in docs/durable

# 6) 计划确认后分阶段实现
> please implement the plan for durable state
```

> 关于 MCP 那条命令：讲师在 p068 [06:34] 复盘说它是「a streamable HTTP URL」「remote MCP server」，认证是在浏览器里直接和 Supabase 完成的，Claude Code 全程看不到你的密码。**具体命令行参数本文不复刻**，因为逐字稿没有完整念出来，请回看上一节的 lab 记录。

想直接跳到成品：

```bash
git checkout week2-day3
```

![p068 04:45 讲师展示 docs/durable.md 里的业务需求](images/p068_0285s.jpg)

---

## 4. 完整代码

### 4.1 `requirements.txt`

```txt
# 版本按你安装时的最新稳定版即可；讲师没有报版本号。
langgraph>=0.6,<0.7
langgraph-checkpoint-postgres>=2.0
langchain>=1.0,<2
langchain-openai>=0.3
langchain-core>=0.3
psycopg[binary]>=3.2
psycopg-pool>=3.2
pydantic>=2
python-dotenv>=1.0
```

### 4.2 `sql/001_payments.sql`

```sql
-- checkpoints 表由 checkpointer.setup() 自己创建，这里只建业务表。
create schema if not exists lab;

create table if not exists lab.payments (
  id          bigint generated by default as identity primary key,
  claim_id    text        not null unique,   -- 唯一约束是「不重复付款」的数据库层保证
  amount      numeric     not null,
  approved_by text,                          -- 自动批准时为空
  created_at  timestamptz not null default now()
);
```

### 4.3 `durable_claims.py`（图本体，完整文件）

```python
"""durable_claims.py

手写版 claims LangGraph，对应 P066–P067。
用 StateGraph 复刻 create_agent 背后的那张图，并加上 Postgres checkpointer。

    START -> agent --(条件: 有无 tool_calls)--> tools -> agent
                   \--(无 tool_calls)---------> decide
    decide --(条件: 拒绝 / 超限 / 正常)--> END | approval -> pay -> END
"""

from __future__ import annotations

import os
from typing import Annotated, Literal, TypedDict

import psycopg
from dotenv import load_dotenv
from langchain_core.messages import AnyMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

load_dotenv()

SUPABASE_DB_URL = os.environ["SUPABASE_DB_URL"]
APPROVAL_LIMIT = float(os.getenv("APPROVAL_LIMIT", "1000"))

SYSTEM_PROMPT = (
    "You are a claims handler. You choose to approve, decline or refer. "
    "Use the calculate_payout tool whenever you need to work out how much to pay."
)


# --------------------------------------------------------------------------
# 1. 工具：calculate_payout
#    逐字稿只说它「takes all of these various details and then works out how
#    much to pay」，参数名没有逐个念，下面是最小可运行版本。
#    你上一节如果已经写过这个工具，直接 import 复用即可。
# --------------------------------------------------------------------------
@tool
def calculate_payout(
    claim_amount: float,
    excess: float = 0.0,
    covered: bool = True,
) -> float:
    """Calculate how much to pay out for a claim.

    Args:
        claim_amount: The amount the policyholder is claiming.
        excess: The policy excess to deduct (default 0).
        covered: Whether the incident is covered by the policy.

    Returns:
        The payout amount in dollars.
    """
    if not covered:
        return 0.0
    return max(claim_amount - excess, 0.0)


# --------------------------------------------------------------------------
# 2. State：对应 p066 [05:04] 讲师列出的六个字段
#    有 reducer 的字段（messages）用 Annotated 标注，
#    其余字段是「最后一次写入生效」。
# --------------------------------------------------------------------------
class ClaimState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    claim_id: str
    decision: str | None
    payout: float | None
    rationale: str | None
    approved_by: str | None


# --------------------------------------------------------------------------
# 3. 结构化输出：对应 p066 [05:51] 的「claimant decision」
#    逐字稿没有念出枚举字面量，这里按 system prompt 的
#    approve / decline / refer 三档写成过去式。
# --------------------------------------------------------------------------
class ClaimDecision(BaseModel):
    decision: Literal["approved", "declined", "referred"] = Field(
        description="What to do with this claim."
    )
    payout: float = Field(description="Amount to pay out, in dollars.")
    rationale: str = Field(description="Why this decision was made.")


# --------------------------------------------------------------------------
# 4. 模型：p066 [00:36]——ChatOpenAI(model=Luna, base_url, api_key, low reasoning)
# --------------------------------------------------------------------------
llm = ChatOpenAI(
    model=os.getenv("MODEL_NAME", "Luna"),
    base_url=os.getenv("OPENAI_BASE_URL"),
    api_key=os.getenv("OPENAI_API_KEY"),
    reasoning_effort="low",
    temperature=0,
)

# p066 [07:00]：必须先用 bind_tools 告诉 LangGraph 这个模型挂了哪些工具
llm_with_tools = llm.bind_tools([calculate_payout])
# p066 [07:21]：需要一个「必须回结构化输出」的版本
decider = llm.with_structured_output(ClaimDecision)


# --------------------------------------------------------------------------
# 5. 数据库连接（模块级，pool 保持打开）
# --------------------------------------------------------------------------
_pool = ConnectionPool(
    conninfo=SUPABASE_DB_URL,
    max_size=10,
    open=True,
    # autocommit=True 是 PostgresSaver 的要求；
    # prepare_threshold=0 避免 pgbouncer 类连接池的 prepared statement 冲突
    kwargs={"autocommit": True, "prepare_threshold": 0},
)


# --------------------------------------------------------------------------
# 6. 节点：p066 [06:15]——「takes a state，returns 一部分 state，就是 node」
# --------------------------------------------------------------------------
def agent_node(state: ClaimState) -> dict:
    """模型节点：决定是调工具还是直接给结论。"""
    response = llm_with_tools.invoke(
        [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
    )
    return {"messages": [response]}


def decide_node(state: ClaimState) -> dict:
    """结构化输出节点：把结论写回 state。"""
    decision = decider.invoke(
        [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
    )
    return {
        "decision": decision.decision,
        "payout": decision.payout,
        "rationale": decision.rationale,
    }


def approval_node(state: ClaimState) -> dict:
    """人工审批节点：p066 [08:03]——调用 interrupt 让图停在这里。

    interrupt 之后的代码只在 resume 之后才会继续执行，
    不需要 while 循环、不需要 if 判断、不需要自己存进度。
    """
    human = interrupt(
        {
            "claim_id": state["claim_id"],
            "payout": state["payout"],
            "rationale": state["rationale"],
        }
    )
    # resume 传进来的值会原样成为 interrupt() 的返回值
    return {"approved_by": human["approved_by"]}


def pay_node(state: ClaimState) -> dict:
    """付款节点：p066 [08:53]——只在数据库里没有这条 payment 时才写入。

    「节点可能被重跑」是设计前提（p067 [06:54]），
    所以幂等性必须写在节点里，而不是靠调用方保证。
    """
    with psycopg.connect(SUPABASE_DB_URL, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into lab.payments (claim_id, amount, approved_by)
                values (%s, %s, %s)
                on conflict (claim_id) do nothing
                """,
                (state["claim_id"], state["payout"], state.get("approved_by")),
            )
            inserted = cur.rowcount
    if inserted:
        print(f"[pay] paid {state['payout']} for {state['claim_id']}")
    else:
        print(f"[pay] {state['claim_id']} already paid, skipped")
    return {}


# --------------------------------------------------------------------------
# 7. 条件路由函数：p066 [09:21] / [09:41]
# --------------------------------------------------------------------------
def after_agent(state: ClaimState) -> str:
    """模型想调工具就去 tools，否则去 decide。"""
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "decide"


def after_decide(state: ClaimState) -> str:
    """拒绝 → 结束；超审批线 → 人工；否则直接付。"""
    if state.get("decision") != "approved":
        return END
    if (state.get("payout") or 0) > APPROVAL_LIMIT:
        return "approval"
    return "pay"


# --------------------------------------------------------------------------
# 8. 组装图：p067 [00:00]–[01:20]
# --------------------------------------------------------------------------
def build_graph():
    builder = StateGraph(ClaimState)

    builder.add_node("agent", agent_node)
    builder.add_node("tools", calculate_payout)   # 单个工具可直接当节点用
    builder.add_node("decide", decide_node)
    builder.add_node("approval", approval_node)
    builder.add_node("pay", pay_node)

    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", after_agent, {"tools": "tools", "decide": "decide"}
    )
    builder.add_edge("tools", "agent")
    builder.add_conditional_edges(
        "decide", after_decide, {"approval": "approval", "pay": "pay", END: END}
    )
    builder.add_edge("approval", "pay")
    builder.add_edge("pay", END)

    checkpointer = PostgresSaver(_pool)
    checkpointer.setup()   # p066 [10:42]：建 checkpoints 相关表

    return builder.compile(checkpointer=checkpointer)


# --------------------------------------------------------------------------
# 9. 辅助函数：给 demo.py 用
# --------------------------------------------------------------------------
def run_claim(graph, claim_id: str, user_prompt: str) -> dict:
    """从零跑一条索赔。durability='sync' 对应 p067 [04:00]。"""
    config = {"configurable": {"thread_id": claim_id}}
    return graph.invoke(
        {
            "messages": [{"role": "user", "content": user_prompt}],
            "claim_id": claim_id,
        },
        config=config,
        durability="sync",
    )


def resume_claim(graph, claim_id: str, handler: str) -> dict:
    """人工批准后继续。对应 p067 [05:25]。"""
    config = {"configurable": {"thread_id": claim_id}}
    return graph.invoke(
        Command(resume={"approved_by": handler}),
        config=config,
        durability="sync",
    )
```

### 4.4 `demo.py`（三个实验，完整文件）

```python
"""demo.py —— P067 里那三次演示的可执行版本。

    python demo.py auto                        # CLM-1005，$243，自动批准
    python demo.py start CLM-1003              # 中断，等待人工
    python demo.py resume CLM-1003 "Dana Whitfield"
    python demo.py status CLM-1003             # 查当前停在哪个节点
    python demo.py auto CLM-1008 "..."         # 自定义索赔
"""

from __future__ import annotations

import sys

import psycopg

from durable_claims import SUPABASE_DB_URL, build_graph, resume_claim, run_claim

PROMPTS = {
    "CLM-1005": (
        "Policy: P-4471, comprehensive motor, excess 0. "
        "Claim: the policyholder's passport was eaten by a giraffe at the zoo, "
        "claim amount 243 dollars. Assess this claim."
    ),
    "CLM-1003": (
        "Policy: P-8820, personal accident, excess 0. "
        "Claim: the policyholder fractured their wrist, "
        "claim amount 3750 dollars. Assess this claim."
    ),
    "CLM-1008": (
        "Policy: P-5512, home contents, excess 0. "
        "Claim: the farmhouse was carried off by a tornado, "
        "claim amount 2240 dollars. Assess this claim."
    ),
}


def wipe(claim_id: str) -> None:
    """p067 [03:08]：为了让实验能反复跑，先删掉这条索赔。"""
    with psycopg.connect(SUPABASE_DB_URL, autocommit=True) as conn:
        conn.execute("delete from lab.payments where claim_id = %s", (claim_id,))
        # 如果你想连 checkpoint 一起清干净，需要按 thread_id 删 checkpoints 表，
        # 这一步课里没讲，本文不做。


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return

    graph = build_graph()
    cmd = sys.argv[1]
    claim_id = sys.argv[2] if len(sys.argv) > 2 else "CLM-1005"

    if cmd == "auto":
        wipe(claim_id)
        result = run_claim(graph, claim_id, PROMPTS[claim_id])
        print("decision :", result.get("decision"))
        print("payout   :", result.get("payout"))
        print("rationale:", result.get("rationale"))
        print("thread_id:", claim_id)
        print("---")
        print("请到 Supabase → Table Editor → lab.payments 里确认。")
        return

    if cmd == "start":
        wipe(claim_id)
        result = run_claim(graph, claim_id, PROMPTS[claim_id])
        # 图被中断时，invoke 会带着 interrupt 信息返回（字段名以实际输出为准）
        print(result)
        print("---")
        print(f"{claim_id} 已停在 approval；下一步请用 resume。")
        return

    if cmd == "status":
        config = {"configurable": {"thread_id": claim_id}}
        snapshot = graph.get_state(config)
        print("next   :", snapshot.next)      # 非空 = 图停在某个节点
        print("values :", snapshot.values)
        # 想观察中断详情可以用 snapshot.tasks（字段名以实际输出为准）
        return

    if cmd == "resume":
        if len(sys.argv) < 4:
            print('用法: python demo.py resume CLM-1003 "Dana Whitfield"')
            return
        handler = sys.argv[3]
        result = resume_claim(graph, claim_id, handler)
        print("decision    :", result.get("decision"))
        print("payout      :", result.get("payout"))
        print("approved_by :", result.get("approved_by"))
        return

    print(f"unknown command: {cmd}")
    print(__doc__)


if __name__ == "__main__":
    main()
```

### 4.5 `docs/durable.md`（P68 交给 Claude Code 的 spec 骨架）

课里实际那份 `product_durable.md` 是讲师写好的现成文件，逐字稿只念了它的大概结构（—— p068 [04:03]「多半是在描述意图，不是技术方案」；—— p068 [08:33]「phase one … phase two …」）。下面按讲师念到的六个 phase 复述成一份**结构等价**的 spec，具体措辞你照抄不照抄都行，只要保留 phase 划分和 success criteria 就行。

```markdown
# Durable claims workflow — business requirements

## Context
We currently run claims through an in-process agent loop. If the process
dies while a human approval is pending, the claim is lost. We need a
durable workflow that survives restarts and lets a handler approve
from the dashboard.

## Business rules
- Any payout **over $1,000** must be approved by a human handler.
- A claim must never be paid twice, even if a node re-executes.
- Every state transition must be persisted to Supabase.

## Non-goals
- Real payment processing
- Client-facing messaging
- Running in the cloud (this lab runs locally against Supabase)

## Phase 1 — records in Supabase
Success criteria:
- [ ] `payments` table exists in the app schema
- [ ] `checkpoints` tables exist and are written on every step

## Phase 2 — claim agent as a graph
Success criteria:
- [ ] claims are processed by a LangGraph state graph (not create_agent)
- [ ] `calculate_payout` is a node/tool on the graph

## Phase 3 — the graph saves its progress
Success criteria:
- [ ] Postgres checkpointer wired in via `SUPABASE_DB_URL`
- [ ] every claim runs under its own `thread_id`

## Phase 4 — sign-off picks the claim back up
Success criteria:
- [ ] dashboard has an "Approve" button per pending claim
- [ ] backend records the approval and sends `Command(resume=...)` to the agent
- [ ] agent resumes from `interrupt`, calls payout, calls back to backend

## Phase 5 — work survives a restart
Success criteria:
- [ ] killing the process mid-interrupt, then restarting, leaves the claim
      still "waiting for approval"
- [ ] resuming after restart completes the claim normally

## Phase 6 — trial on all five claims
Success criteria:
- [ ] all 5 test claims flow end-to-end
- [ ] checkpoint history readable per `thread_id`

## Side note
For consistency with the course, please read the lab we just did
(week2/day3 lab) and build the solution in that vein.
```

> 最后那段 "Side note" 就是讲师在 p068 [04:33] 亲口说「this is clearly cheating」的那一行。照抄它能让 Claude Code 收敛到跟 lab 同一套写法，避免它自作主张换框架。

---

## 5. 逐行解释

下面按「这一个决策为什么这么定、不这么写会怎样」走一遍 `durable_claims.py`。

### 5.1 State：为什么是 `TypedDict` 而不是 `BaseModel`

```python
class ClaimState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    claim_id: str
    decision: str | None
    payout: float | None
    rationale: str | None
    approved_by: str | None
```

- 讲师原话（—— p066 [05:04]）：「you can use typed dicts, you can also use pidantic objects are very common for Langriff, you can actually use almost anything, but it's very common to use typed dicts」。所以 `TypedDict` 是**惯例**，不是硬性要求；`BaseModel` 也能用，但写起来更啰嗦（要写字段默认值），而且 `StateGraph` 的 reducer 对 Pydantic 支持没那么自然。**新手就用 TypedDict**。
- `messages` 是唯一带 reducer 的字段：`Annotated[list[AnyMessage], add_messages]`。意思是节点返回 `{"messages": [新消息]}` 时，LangGraph 会**追加**到已有列表后面，而不是覆盖。如果你不加 `add_messages`，模型节点每一轮都把整个历史**冲掉**，agent 就只能看到最后一条消息，`after_agent` 也就永远检测不到 tool_calls。这和 React 里 `useState` 返回新数组要手动 `[...prev, item]` 是同一类问题——只不过 LangGraph 帮你把合并逻辑抽象成 reducer 了。
- 其余字段没有 reducer，语义是「最后一次写入覆盖」。这正是我们想要的：`claim_id` 一旦写入永不改变，`payout` 每次 decide 都重新计算。
- `decision` / `payout` / `rationale` / `approved_by` 都允许 `None`，因为刚 `START` 时这些都还没算出来——这就是为什么 `after_decide` 里要写 `state.get("decision") != "approved"` 而不是 `state["decision"] is not "approved"`，前者在字段不存在时返回 `None`，后者直接 `KeyError`。

**对于前端读者**：`Annotated[list, add_messages]` 相当于 Zustand 里的 `create((set) => ({ list: [] }))` 然后你用 `set(s => ({ list: [...s.list, x] }))`——只不过 LangGraph 直接在类型标注里声明了 reducer，不需要你每次手写展开。剩下的字段相当于 `set({ claim_id })`，直接覆盖。

### 5.2 模型：为什么必须 `bind_tools` 一次、`with_structured_output` 又一次

```python
llm = ChatOpenAI(..., reasoning_effort="low", temperature=0)
llm_with_tools = llm.bind_tools([calculate_payout])
decider = llm.with_structured_output(ClaimDecision)
```

- 讲师原话（—— p066 [07:00]）：「you can't just pass in this model, Luna. You have to take the model Luna that we defined up here somewhere ... first have to tell Langroth that you're going to be using Lunar with some tools attached to it」。这一步在 `create_agent` 里是**自动完成**的（所以「wizard」这个词用得准），手写图时你必须自己做。
- **两个版本**，不是一个：`llm_with_tools` 用于 `agent` 节点——模型要么发 `tool_calls`，要么直接回话，两种结果都是「普通 AIMessage」；`decider` 用于 `decide` 节点——每次都必须返回 `{decision, payout, rationale}` 三件套。
- 为什么不合并成一个？因为 `with_structured_output` **禁止**模型输出 tool_calls（它把 tool 选择空间收窄到只剩下结构化输出那一个），合并后 `agent` 节点就永远发不出 `tool_calls`，`after_agent` 永远走 `decide`，`calculate_payout` 那个节点就是死代码。
- 讲师那句「these are the things that we invoke in our nodes right here. So in the node agent, we take model with tools and we call invoke. In our node called decide, we take the decider and we call invoke」（—— p066 [07:21]）就是在强调：节点里 `invoke` 的对象不是同一个。

### 5.3 `ClaimDecision`：为什么是 `Literal` 三档

```python
class ClaimDecision(BaseModel):
    decision: Literal["approved", "declined", "referred"] = Field(...)
    payout: float = Field(...)
    rationale: str = Field(...)
```

- 讲师的 system prompt 是「You're a claims handler. You choose to **approve, decline or refer**.」（—— p066 [00:18]），这三档是业务要求的。我们在这里用过去式（`approved`）是为了让 `after_decide` 里那句 `!= "approved"` 读起来是「只要不是批准就结束」，而不是「只要不是 approve 就结束」——语法上差别不大，但 `approved` 跟「已批准」状态贴得更紧。
- **课里没讲出枚举字面量**：逐字稿只念了 system prompt 里的三档动词，没念 Pydantic 里的实际字符串。你写 `"approve"/"decline"/"refer"` 然后 `after_decide` 判断 `!= "approve"` 也完全等价，只要**两处字面量对齐**。这就是为什么我在 `after_decide` 里强调「拒绝 → 结束」用的是 `!=`，不是 `not in`——将来你要是加第四档（比如「pending_review」），`!=` 会自动把它当成「不批准」，跟 `refer` 同处理，不会静默通过。
- `payout` 用 `float` 而不是 `Decimal`：课里没涉及货币精度，Supabase 里我用了 `numeric` 兜底。真要精准算钱（比如保险精算场景），这两处都应该换成 `Decimal`。**课里没讲**，所以这里不展开。

### 5.4 `_pool`：为什么必须 `autocommit=True`

```python
_pool = ConnectionPool(
    conninfo=SUPABASE_DB_URL,
    max_size=10,
    open=True,
    kwargs={"autocommit": True, "prepare_threshold": 0},
)
```

- `PostgresSaver` 在写完 checkpoint 后会**主动**在连接上开事务/结束事务（它内部要保证写入的原子性），你再用 `autocommit=False` 的连接池套上去，它会和 `PostgresSaver` 的事务管理打架，报 `psycopg.errors.ActiveSqlTransaction` 之类的错。这是 pg checkpointer 的官方要求，**不是课程讲了的东西**——讲师只说了「pass in the connection to SuperBase」（—— p066 [10:42]），没说 `autocommit`。
- `prepare_threshold=0` 是为了避开 pgbouncer（Supabase transaction pooler 就是 pgbouncer）。如果你照本文档用 **direct connection**（`db.xxx.supabase.co:5432`），这个设置不会伤到任何东西；如果你硬要连 transaction pooler（`pooler.supabase.com:6543`），**必须**有这个，否则 prepared statement 一定会报 `prepared statement "sX" already exists`。

### 5.5 `agent_node`：为什么用 `[SystemMessage(...), *state["messages"]]` 拼参数

```python
def agent_node(state: ClaimState) -> dict:
    response = llm_with_tools.invoke(
        [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
    )
    return {"messages": [response]}
```

- `SystemMessage` **不放进 state**。原因：system prompt 是**恒定**的，每轮都往 messages 里追加一份，checkpoint 会越存越大，而且模型每次看到 3 份一样的 system prompt 会更贵。放进 state 的唯一好处是可以在运行时改（多租户场景每个租户一个 prompt），那也不该放在 messages 里，应该放在 `claim_state` 里另开一个字段。
- `return {"messages": [response]}` 用的是**部分更新**语义：agent 节点不该改 `claim_id`/`payout` 等任何一个字段，只该追加消息。这一点在 LangGraph 里非常关键——如果你 `return state`（整个 state），你会把下游节点可能刚改的字段又冲回旧值。

### 5.6 `decide_node`：为什么要把三者写回 state

```python
return {"decision": decision.decision, "payout": decision.payout, "rationale": decision.rationale}
```

- 讲师的描述是「We're going to want an LLN to return this rationale decision and payout」（—— p066 [05:51]）。注意这里的**命名冲突**：Pydantic 类叫 `ClaimDecision`，字段也叫 `decision`。`decision.decision` 读起来难看，但这是 Pydantic 对象属性访问，没办法——你改类名或字段名都可以，只要和 `after_decide` 的判断对上。
- `payout` 写回 state 后，`after_decide` 就能直接 `state.get("payout")`，不用重新算一遍。这也是节点设计的核心纪律：**节点负责算，路由函数只负责读**。路由函数里如果要做 LLM 调用或数据库查询，会在每次重跑时执行一遍（checkpoint 回放会重跑路由），既慢又不幂等。

### 5.7 `approval_node` + `interrupt`：这套东西最反直觉，必须拆开讲

```python
def approval_node(state: ClaimState) -> dict:
    human = interrupt({
        "claim_id": state["claim_id"],
        "payout": state["payout"],
        "rationale": state["rationale"],
    })
    return {"approved_by": human["approved_by"]}
```

讲师的描述是（—— p066 [08:03]）：「it calls `interrupt` for a particular claim ID and for the payout and the rationale and then this will cause this node execution to stop immediately ... it will only continue after that line」。

拆成四步：

1. **`interrupt(payload)` 被调用时做了什么？** 它把 `payload` 存进当前 checkpoint，然后**抛异常**——技术上是一个特殊的 `GraphInterrupt`。所以 `interrupt` **后面**那行 `return {"approved_by": ...}` 这一轮**根本没执行**。Python 里给人的感觉就是「这函数在 `interrupt` 那行停住了」，但实际上是「函数抛异常退出了，但抛之前先把状态存库了」。
2. **谁来 resume？** `demo.py resume` 里的 `graph.invoke(Command(resume={...}), config=config)`。`Command(resume=X)` 的意思就是「把 X 作为 `interrupt()` 的返回值，从抛异常那一行继续」。所以要理解成：**同一函数重跑一遍，但这次 `interrupt()` 不抛异常，直接返回你传进来的 X**。
3. **`human` 是什么？** 就是我们自己传的 `{"approved_by": "Dana Whitfield"}`。所以 `return {"approved_by": human["approved_by"]}` 拿到的是 `"Dana Whitfield"`，写进 state。
4. **为什么不需要 `while` 循环、`if` 判断、`sleep`？** 因为「停在 `approval` 节点」这个事实**本身就存在 checkpoint 里**（`snapshot.next == ("approval",)`）。下次 `invoke` 时，LangGraph 一看 checkpoint 就是「你上次停在 approval」，直接进去重跑这个节点。讲师原话（—— p066 [08:23]）：「it's just going to work magically without any needs for sort of if statements and something that waits or loops」。

**对前端读者**：最接近的心智模型是「一个 async 函数里 `await humanApprovalPromise`」——但 **不是** 同一个 Promise，因为进程已经死了。更像「你在 IndexedDB 里存了一个 `{ status: 'pending', next: 'approval' }`，然后用户点了 Approve，你从 IndexedDB 里读出来接着跑」。LangGraph 就是帮你把「存在数据库 + 从断点继续」这件事做成了框架能力。

**踩坑点提示**：`interrupt` 必须在 **node 内部**调用，不能在 node 里再套一层普通函数里面调用——因为它靠抛异常走流程，套太深会丢失「当前节点正在运行」的识别信息。真要拆函数，把整个要中断的逻辑做成一个函数，直接 `add_node` 它。

### 5.8 `pay_node`：为什么用 `ON CONFLICT DO NOTHING`

```python
cur.execute("""
    insert into lab.payments (claim_id, amount, approved_by)
    values (%s, %s, %s)
    on conflict (claim_id) do nothing
""", (state["claim_id"], state["payout"], state.get("approved_by")))
inserted = cur.rowcount
```

- 讲师的描述（—— p066 [08:53]）：「a node that's called `pay` and it's one that pays a claim **unless there's already one in the database** and we do that with a single query that will add in the payment only if there isn't one already there.」
- 这就是 `ON CONFLICT DO NOTHING` 的语义：如果 `claim_id` 已经存在（我之前在 DDL 里给 `claim_id` 加了 `unique`），就**什么都不做**，`rowcount` 返回 0；否则插入，`rowcount` 返回 1。
- 为什么不先 `SELECT` 再 `INSERT`？**因为在并发环境下有竞态**。两个请求同时 SELECT 都发现「没有」，然后都 INSERT，数据库就会有两行（除非唯一约束拦住，但那样一个请求会报错而不是静默跳过）。`ON CONFLICT` 是**数据库层面**的原子操作，一个 SQL 就结束了。
- **对于前端读者**：这就是 `Supabase.from('payments').upsert(data, { onConflict: 'claim_id', ignoreDuplicates: true })`，或者 Prisma 的 `createMany({ skipDuplicates: true })`。JS 里你写 `await` 一下就行；Node 里如果两 tab/两 user 同时点，也更容易被 race 到，所以还是数据库层的原子约束更稳。
- 讲师的 DESIGN INSIGHT（—— p067 [06:54]）：「the mindset you have when you build these nodes. You know that they could be run again and again. You have to make sure that they all check the state ... They don't ever do something twice.」——**幂等性必须写在节点里，不能指望框架或调用方不重跑**。LangGraph checkpoint 回放、crash 恢复、手动 re-invoke，任何一种都可能让 `pay` 节点被跑第二次。
- 这里的 `state.get("approved_by")` 用 `.get` 而不是 `["approved_by"]`：因为自动批准路径（payout ≤ 1000）**根本不会经过 `approval` 节点**，`approved_by` 字段可能不存在（`None` 或根本没写）。`state["approved_by"]` 会抛 `KeyError`。看 P67 [05:54] 讲师在数据库里展示的那一行：「the one for 243 that didn't need any approvals and that's why nothing's in there in the approvals field」，就是这个原因。

### 5.9 `after_agent` / `after_decide`：路由函数为什么不该有副作用

```python
def after_agent(state: ClaimState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "decide"

def after_decide(state: ClaimState) -> str:
    if state.get("decision") != "approved":
        return END
    if (state.get("payout") or 0) > APPROVAL_LIMIT:
        return "approval"
    return "pay"
```

- `getattr(last, "tool_calls", None)` 而不是 `last.tool_calls`：因为 `last` 可能是 `AIMessage`（有 `.tool_calls`，空数组合法），也可能是 `ToolMessage`（没有 `.tool_calls` 属性）。`getattr(..., None)` 在一处覆盖了这两种情况。这是 Python 里处理鸭子类型的常用写法——**JS 里等价的写法是 `last?.tool_calls?.length > 0`**。
- `state.get("decision") != "approved"`：注意，这里**没有** `if "decision" not in state` 的前置判断，`get` 已经处理了。但反过来，`declined` 和 `referred` 都会被当成「结束」。讲师原话（—— p066 [09:41]）：「if ... there's a decision in there that is not approved then it ends. If there's a payout that's more than the approval limit then it directs it to approval. Otherwise it pays.」——三档逻辑完全对上了。
- **路由函数绝对不要发网络请求**。原因：在 checkpoint 回放时，LangGraph 需要重放**每一步的边**才能算出当前位置。如果你在路由函数里调了 LLM 或者写库，回放一次就多跑一遍。讲师没明说这点，但他是把「调用 LLM」放在 node 里（`agent_node` / `decide_node`），路由函数里只做纯字符串比较——这个对比本身就是在教你边界在哪。

### 5.10 `build_graph`：`add_conditional_edges` 的 mapping 为什么不能省

```python
builder.add_conditional_edges(
    "decide", after_decide, {"approval": "approval", "pay": "pay", END: END}
)
```

- 讲师讲的版本（—— p067 [00:52]）只说「a conditional edge from `decide` either to `approval` or `pay` or end depending on after decide」，没提 mapping 这件事。但手写图时这个 mapping 是**必须的**：
  - 如果你省了 mapping（`add_conditional_edges("decide", after_decide)`），LangGraph 会假设路由函数直接返回**节点名字**。此时 `after_decide` 返回 `END` 就对了（因为 `END` 是内置的特殊名 `"__end__"`），但如果你写的是 `return "end"` 而不是 `return END`，就会报 `Unknow edge`。
  - **带上 mapping 后**，路由函数返回的字符串只是「mapping 的键」，可以完全不等于节点名（比如 `return "auto"` 映射到 `"pay"`）。这让路由函数可以**独立演化**——将来改节点名不用改路由逻辑。
- 建议初学者**永远带上 mapping**，别省。
- 还有一点容易踩的：`add_conditional_edges` 的第二个参数是**函数引用**（`after_decide`），不是 `after_decide()`。如果你写成 `after_decide()` 那是**现在立刻执行一次**——你会得到一个字符串常量，图会变成「永远走固定分支」。

### 5.11 `durability="sync"`：讲师为什么特意提这一句

```python
return graph.invoke(
    {...},
    config=config,
    durability="sync",
)
```

- 讲师原话（—— p067 [04:00]）：「`Durability` is sync. Make sure that it saves the checkpoint before it does anything else.」
- 他的意思是：**executor 每跑完一个节点，都会同步把 checkpoint 写库，然后才推进到下一个节点**。这样如果中间崩了，最多丢一个节点的计算，不会丢一整个 claim。
- LangGraph 里 `durability` 有三档（这是课程没细讲的部分，你查文档可以确认）：`"exit"`（只在图最后写一次，最快但最脆，crash 就全丢）、`"async"`（后台异步写，速度居中，但**如果进程正好死在写盘前就会丢**）、`"sync"`（同步写，最慢，但**crash 也稳**）。这一节的核心卖点是 durable workflow，所以选 `sync` 是对的。
- 我建议**默认用 `sync`**，等有性能压力再用 `async`。这和 Node 里 `await fs.writeFile(...)` 与 `fs.writeFile(...)` 的取舍是同一个逻辑——只是这里 `writeFile` 换成了「写 Postgres checkpoint」。

### 5.12 `config = {"configurable": {"thread_id": ...}}`：为什么要一条 claim 一个 thread

```python
config = {"configurable": {"thread_id": claim_id}}
```

- 讲师原话（—— p067 [03:30]）：「we take a `thread id` ... that means that all of this checkpointing all of the context of running land graph is going to be in this context so that this claim lives in its own right」。
- 每个 `thread_id` 在数据库里对应独立的一组 checkpoints。CLM-1003 停在 approval 的时候，CLM-1005 完全不受影响——两条 claim 是**并行的两条线程**，各自有自己的状态机。
- **如果 thread_id 冲突**（比如你都传 `"default"`）：CLM-1003 的 `interrupt` 会把 CLM-1005 的中断信息覆盖掉（实际上是 LangGraph 报「thread 已经在等待 resume」的错，或者干脆两条 claim 各种字段互相污染）。**前端对接时，thread_id 一定要用业务主键**（claim_id / order_id），不要用 UUID，否则用户刷新页面就找不到自己的线程了。
- 讲师在 p067 [12:22] 说的那个 trick——「take a second computer, put in the same database URL, and see that you can approve the claim somewhere else」——能 work 的唯一前提就是 `thread_id`（也就是 claim_id）在两台机器上一致。**生产环境用 claim_id 做 thread_id 就是为这个场景设计的**。

### 5.13 `checkpointer.setup()`：为什么要调，且为什么要在 `compile` 前调

```python
checkpointer = PostgresSaver(_pool)
checkpointer.setup()
return builder.compile(checkpointer=checkpointer)
```

- 讲师没细讲 `setup()`，只说「pass in the connection to SuperBase that we set up before」（—— p066 [10:42]）。实际上 `PostgresSaver.setup()` 会**在数据库里创建 `checkpoints` / `checkpoint_blobs` / `checkpoint_writes` 这几张表**（如果不存在的话）。你在 P67 [11:13] 跳到 Supabase 看到的那张表，就是 `setup()` 建出来的。
- 为什么不放到 `compile` 之后？因为 `compile(checkpointer=...)` 只是**绑定引用**，不会自动调 `setup`。如果你把 `setup()` 忘了，第一次 `invoke` 会直接报「relation "checkpoints" does not exist」。
- **为什么不放进 import 阶段？** 我这里的 `build_graph()` 已经把 `setup()` 包进去了，但每次 `python demo.py xxx` 都会执行一次 `build_graph()`，就会调一次 `setup()`。`setup()` 内部是 `if not exists` 语义，重复调用**不会报错**（idempotent），所以没问题。生产上如果你有多个 worker 同时启动，注意 `setup()` 的 DDL 竞争——可以用 advisory lock 或者把 setup 拆到一个独立的 `init_db.py` 里，只在部署时跑一次。**课里没讲这部分**，属于工程化范畴。

### 5.14 关于 `demo.py` 里的 `wipe`

```python
def wipe(claim_id: str) -> None:
    with psycopg.connect(SUPABASE_DB_URL, autocommit=True) as conn:
        conn.execute("delete from lab.payments where claim_id = %s", (claim_id,))
```

- 对应讲师的话（—— p067 [03:08]）：「we're going to have something here which is able to start us from fresh because it's going to delete a claim if we've got one. So I'm just going to have that so we can run the lab several times if we want to.」
- ❗**注意**：这个 `wipe` 只删 `payments`，**不删 `checkpoints`**。这意味着重复跑同一条 claim 时，LangGraph 会发现 `thread_id` 已经存在**且带着历史**，可能不会从 `START` 开始，而是从**上次停在的地方**继续——这就是为什么我建议你换 claim_id 做实验，或者在 `wipe` 里**额外**清一下 `checkpoints`。`checkpoints` 的具体表名和列名**课里没讲**，你在 Supabase 里核实之后再写 DELETE 语句，不要凭空猜列名。

### 5.15 关于 P68 的产品化（`docs/durable.md` → Claude Code）

这一段没有代码给你抄，只有**流程**要复现，逐条讲：

- **为什么先 `cp` 到 `docs/` 再 `claude`**：Claude Code 默认在仓库根目录扫描。`docs/durable.md` 这个位置被 P68 [01:04] 明确定为「spec 项目约定的位置」。你要不按约定放，Claude Code 还是能读，但**计划阶段会到处找**，会浪费时间。
- **为什么 `/mcp` 要先认证 Supabase 再下 plan**：P68 [05:28] 讲师专门花时间在 `/mcp` 里做 OAuth 认证，是为了让 Claude Code 能**读** Supabase 里的真实表结构（`payments`、`checkpoints` 的列名、schema 归属）。`plan` 阶段它不看真实 schema，就会**编**列名，`implement` 阶段就写出一堆跑不起来的 SQL。这一步是「让 AI 别瞎编」的**硬性前置**。
- **为什么 plan 要单独一步、等 20 分钟**：P68 [08:04]「it took about 20 minutes」——这是 Claude Code 在**写完 6 个 phase + success criteria 后**才被允许开始写代码。你要是直接让它 implement，它会边写边改方向，最后 code review 通不过，返工成本远大于 20 分钟。
- **为什么要有 `phase` 划分**：P68 [08:33] 讲师念了 6 个 phase：`records in Supabase` → `claim agent as a graph` → `claim graph saves progress` → `sign-off picks claim back up` → `work survives restart` → `trial on all five claims`。这个顺序**完全对应 P66–P67 的实验步骤**：先建表（3.4 节）、再手写图（4.3 节）、再接 checkpointer（3.0 前置）、再加 `interrupt`（4.3 节 `approval_node`）、再验证重启（3.8 节）、最后全量回归。**spec 的 phase 顺序 = 本文档从零复现的顺序**——这不是巧合，是讲师设计实验时的顺序。
- **为什么 side note 是「cheating」**：P68 [04:33] 讲师的原话是「breaking the third wall or whatever the actor's expression is」——`docs/durable.md` 是写给「真实的 FDE 对接真实业务方」的 spec，但里面加了一句「for consistency with the course, please read the lab we just did and build the solution in that vein」，等于承认「这是课程场景」。理论上不 professional，实际上能极大提高 Claude Code 命中率，否则它会「go off and do something completely different」。**你复现时照抄这句是对的做法**。

![p066 07:25 讲师开始手写 ClaimState，state 是 LangGraph 理解一切的前提](images/p066_0445s.jpg)

![p067 02:11 讲师让读者回到代码里，把每个 node / edge 在图上对号入座](images/p067_0131s.jpg)

![p067 10:00 讲师贴出某个 thread_id 的 checkpoint 历史：start → agent → tools → agent → decide → approval → pay](images/p067_0600s.jpg)

![p068 00:19 P68 要做的产品化流程：dashboard 审批 → 后端记录 → 后端向 agent 发 resume → agent 恢复 → payout 回调后端](images/p068_0019s.jpg)

---

## 6. 复现检查清单

跑完这一节，逐条对一下。对不上的别往下走，先修。

### 6.1 环境

- [ ] `python --version` ≥ 3.11（`TypedDict` + `X | None` 语法需要）
- [ ] `pip list | grep -E "langgraph|psycopg|langchain-openai"` 里三个包都有
- [ ] 项目根目录有 `.env`，且 `SUPABASE_DB_URL` 能连上（`psql "$SUPABASE_DB_URL" -c "select 1"` 返回一行）
- [ ] 连接串是 **direct connection**（`db.xxx.supabase.co:5432`）或 **session pooler**（`...pooler.supabase.com:5432`），**不是** transaction pooler（`...:6543`）
- [ ] `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `MODEL_NAME` 在 `.env` 里完整

### 6.2 数据库

- [ ] `sql/001_payments.sql` 已经 `psql -f` 跑过
- [ ] Supabase Table Editor 切到 `lab` schema 能看到 `payments` 表
- [ ] `payments` 表有 `claim_id` 的 `unique` 约束（无约束则 `ON CONFLICT` 会报错）
- [ ] 第一次 `python demo.py auto` 之后，切到 `lab` schema 能看到 `checkpoints` 表（这是 `checkpointer.setup()` 建的）
- [ ] `checkpoints` 表里能按 `thread_id = 'CLM-1005'` 查到至少一条记录

### 6.3 图行为

- [ ] `python demo.py auto`（CLM-1005）退出码 0，打印 `decision: approved`、`payout: 243` 附近的数值（模型可能给 240 或 243 附近，取决于 prompt，属于正常）
- [ ] 跑完 `auto` 后，`lab.payments` 里 CLM-1005 那条 `approved_by` 是 **NULL**，`amount` 在 240 上下
- [ ] `python demo.py interrupt`（CLM-1003）打印里**包含**「CLM-1003 needs a handler to approve it」类似的字样，并且**没有**打印 `[pay] paid ... for CLM-1003`
- [ ] 跑完 `interrupt` 后，`lab.payments` 里**没有** CLM-1003 这条记录（这是关键的「中断成功」证据）
- [ ] `python demo.py status CLM-1003` 输出的 `next` 字段是 `('approval',)` 之类的非空值（说明图确实停在 approval 节点）
- [ ] `python demo.py resume CLM-1003 "Dana Whitfield"` 退出码 0，且 `lab.payments` 里出现 CLM-1003 且 `approved_by = 'Dana Whitfield'`
- [ ] `python demo.py start CLM-1008` 之后**关闭整个进程**
- [ ] 新开一个 shell（或新 terminal），`python demo.py status CLM-1008` 仍然显示图停在 `approval`（这是「崩溃恢复」的核心证据，对应 P67 [08:17]–[10:24]）
- [ ] `python demo.py resume CLM-1008 "PREA"` 之后 `lab.payments` 出现 `approved_by = 'PREA'`、`amount` 约 2240 的记录
- [ ] 手动对同一条 claim 再调一次 `pay`（最稳的方式：把 `resume` 那行换成 `run_claim(graph, "CLM-1008", PROMPTS["CLM-1008"])`），终端打印 `already paid, skipped` 而不是再插入一行

### 6.4 Checkpoint 可读性

- [ ] Supabase → Table Editor → Schema 切到 `lab` → `checkpoints` 表 → 按 `thread_id = 'CLM-1008'` 过滤
- [ ] 能按时间顺序看到 CLM-1008 的检查点至少覆盖：`agent`、`tools`、`agent`（第二次）、`decide`、`approval`、`pay`（讲师在 P67 [11:13] 原话里报的路径就是这条）
- [ ] **不要纠结具体列名**：讲师没念过 `checkpoints` 表的列名，你看到什么就是什么，别对着我的文档硬凑

### 6.5 P68 产品化侧

- [ ] `docs/durable.md` 已存在（`cp labs/week2/day3/product_durable.md docs/durable.md` 或者照 4.5 节手写）
- [ ] Claude Code 里 `/mcp` 能看到 `supabase`（前面带 `!` 是正常的，表示未认证）
- [ ] 在 `/mcp` 里按 Enter 完成了浏览器 OAuth，Claude Code 显示连上 Supabase
- [ ] `please plan durable state in docs/durable` 返回了一份带至少 5 个 phase 的计划
- [ ] 计划里有 「checkpoints to Supabase」和 「resume from interrupt」两条（这两条是 P68 [00:00]–[00:45] 的核心要求）
- [ ] `please implement the plan for durable state` 之后项目里至少新增了：一个 checkpointer 接线、一个 `approval` 相关节点、一个 dashboard 按钮或后端 resume 路由

---

## 7. 课里没讲但你会撞上的

这一节全是「按逐字稿信息量推不出来、但你复现时一定会踩」的坑。按撞上的概率排序。

### 7.1 Supabase 连接串：选错 pooler 会让你怀疑人生

Supabase 现在会给三种连接串：

| 类型 | 地址 | 能跑 `PostgresSaver` 吗 |
|---|---|---|
| **Direct** | `db.xxx.supabase.co:5432` | ✅ 首选 |
| **Session pooler** | `aws-0-xxx.pooler.supabase.com:5432` | ✅ 但要开 `prepare_threshold=0` |
| **Transaction pooler** | `aws-0-xxx.pooler.supabase.com:6543` | ❌ 大概率报 prepared statement 冲突 |

讲师只说了「pass in the connection to SuperBase」（—— p066 [10:42]），没提 pooler 这件事。**他用的是哪一个课里没讲**，但如果你想跑通 `checkpointer.setup()` 和 `interrupt`，一定用 **Direct**。Supabase 免费版有连接数上限，direct 连满时再考虑 session pooler。

### 7.2 `search_path` 不一致，导致「表存在但看不见」

P67 [11:13] 讲师特意提醒：「Table Editor，and over here you'll see Schema. The Schema I think will by default will be on **Public**. Change the Schema from Public to the Schema of **Lab**.」——这句话说明讲师那边的 checkpointer 和 payments 都在 `lab` schema。**如果你照本文档的 DDL 建了 `lab.payments`，却没在 `SUPABASE_DB_URL` 里加 `?options=-csearch_path%3Dlab`，`pay_node` 就会往 public 里写，Supabase 里看不到。**

两种修法：
- 在 `.env` 里加 `?options=-csearch_path%3Dlab`（本文档采用，推荐）
- 或者所有 SQL 都写全限定名 `lab.payments`（本文档也写了全限定名，所以两种同时做，双保险）

### 7.3 `reasoning_effort="low"`：不是所有 endpoint 都认

讲师用 `low reasoning F at this time`（—— p066 [00:36]），这个是给推理模型（o 系列 / GPT-5 系）用的参数。**如果你用的是普通 chat 模型或者一个不支持的第三方 OpenAI-compatible endpoint，这个参数会直接 400**：

```
Error code: 400 - Unsupported parameter: 'reasoning_effort'
```

**处理办法**：删掉 `reasoning_effort="low"` 这一行，或者换成 `extra_body={"reasoning_effort": "low"}`。如果报错不再是 400，说明你的 endpoint 认这个参数。**课里没讲这个兼容性**，你撞上先删参数，确认基本流程通再加回来。

### 7.4 `with_structured_output` 不是万能的

讲师用 `luna.withStructuredOutputs`（—— p066 [07:21]）时没解释它的实现。实际上：

- 如果你用的模型支持 **function calling**，`with_structured_output` 走 tool call 路径（默认），行为最稳
- 如果你的模型**不支持** function calling，会 fallback 到 JSON mode 或者 prompt-based 解析，某些老模型会失败，报「无法解析为 JSON」
- **报错信息一般是 `ValidationError` 或 `OutputParserException`**，`Field(...)` 那层 Pydantic 校验就会给你很明确的提示（哪个字段缺了、哪个类型错了）

判断方法：`openai gpt-4o` / `gpt-4o-mini` / `gpt-5` 都支持；`ollama llama3` 之类的本地模型不一定支持，要看你启动时开没开 `--tool-call`。

### 7.5 `add_messages` 的语义不是「替换」，是「合并」

我在 5.1 讲过，但这里再强调一次，因为**90% 的新手第一个 bug 就是这个**。现象：agent 节点第一次 invoke 之后，`after_agent` 判断 `tool_calls` 永远返回 `decide`，`tools` 节点从来进不去。

原因：模型第一轮如果**发起了 tool call**，正常流程是 `agent` → `tools` → `agent`（第二轮）→ `decide`。但如果你没加 `add_messages` reducer：

- 第一轮 `agent` 返回 `{"messages": [AI 消息带 tool_calls]}`
- 由于没有 reducer，`messages` **被覆盖**成只有这一条
- 第二轮 `agent` 拿到的 state 里还是只有一条消息（没有 tool result 的上下文），它可能不再发 tool_calls 了，直奔 `decide`
- 或者更糟：`after_agent` 看到「只有一条消息」还是上一次的 tool_calls，又回 `tools`，`tools` 又返回结果，但 `messages` 又被覆盖，**无限循环**

**修法**：`messages: Annotated[list[AnyMessage], add_messages]`，这一行就够了。

### 7.6 节点里 `return state` vs `return {...}` 的区别

这个我在 5.5 讲过，但它是 90% 的第二个 bug 来源。**具体什么时候会感觉不对**：你在 `decide_node` 里 `return state`（顺手把整个 state 返回），然后在 `resume` 时发现 `decided` 的值倒退回 `agent` 阶段的值——因为 LangGraph 在回放 checkpoint 时，会把节点返回的内容**原样 merge** 到上一份 checkpoint 里。你返回整个 state，就把上一份覆盖了。

**纪律**：节点永远 `return {改了哪些字段}`，不要 `return state`。

### 7.7 `interrupt` 的 payload 是给你看的，不是给你算的

`interrupt({"claim_id": ..., "payout": ..., "rationale": ...})` 里那个 dict 会**原样**被 `graph.invoke` 的返回值（或 `graph.get_state().tasks`）带出来。很多人第一反应是「载荷能不能直接在里面算好 `amount_to_pay` 返回给前端」——**能，但不该**。理由：payload 是**通信协议**，不是**计算载体**。你在 payload 里算一遍、每处 resume 的代码里再算一遍，很容易两边不一致。

**正确做法**：payload 里只放**业务实体的最小可读摘要**（claim_id + 关键数字），把所有派生计算留在节点内部。

### 7.8 `Command(resume=...)` 只能 resume，不能 fork

讲师只说「passing in a `command` object, which is here, `resume`」（—— p067 [05:25]）。他没讲的是：`Command(resume=X)` 之后，**thread 就往前走了**，你不能「再 resume 一次到 approval 那个节点」。这跟 git 里 `git reset --hard` 有点类似——checkpoint 还在，但当前指针已经过去了。真要回退：

```python
config = {"configurable": {"thread_id": "CLM-1003", "checkpoint_id": "<某个历史 id>"}}
graph.invoke(None, config=config)   # 恢复到该检查点
```

具体 API 已经超出本节范围
（续上文 7.8）

`checkpoint_id` 具体从哪里拿到课里没讲，最省事的是在 Supabase 的 `lab.checkpoints` 表里按 `thread_id` 排序拿到最近的一条，把 `checkpoint_id` 那列的值拷出来。更稳的做法是用 `graph.get_state_history(config)` 拿整个历史，逐个 `config` 试。**注意：回退后 `interrupt` 之后已经写入的 `payments` 不会回滚**——checkpoint 只管图的状态，不管业务表。要做到「回退后 payment 也回退」，得在自己的业务表里也加 checkpoint 概念，或者把 `pay` 节点包在一个「先写 pending、确认后写 paid」的两阶段流程里。这两条课里都没讲，属于工程化范畴。

### 7.9 `interrupt` **绝对不能放在 `try / except` 里**

这是我在复现时踩得最惨的一个坑，课里一句没提，但你在 P68 阶段一定会撞上。

`interrupt()` 内部是靠**抛一个特殊异常**（`GraphInterrupt`）来让节点退出的。如果你在节点里写成：

```python
# ❌ 错误写法：interrupt 被 except 吃掉了
try:
    human = interrupt({...})
    return {"approved_by": human["approved_by"]}
except Exception as e:
    print("something went wrong", e)
    return {}
```

那么 `GraphInterrupt` 会被你那个 `except Exception` 捕获，节点会「正常」返回 `{}`，LangGraph 就以为这个节点**跑完了**（而不是停住了），然后继续沿着 `approval → pay` 往下走——**结果就是没人批过款、图却直接付款了**。业务上这是灾难。

**正确做法**：`interrupt` 那一行**裸着放在节点函数里**，不要包在任何 `try / except` 里。要处理「用户输入不合法」「resume 传进来的东西不对」这类问题，把它放在 interrupt **返回之后**：

```python
def approval_node(state: ClaimState) -> dict:
    human = interrupt({...})   # 裸着，不包 try
    # 从这里往下的代码才允许 try / except
    if "approved_by" not in human:
        raise ValueError("resume payload 缺少 approved_by")
    return {"approved_by": human["approved_by"]}
```

**对于前端读者**：这相当于你在 React 里写了一个 `async` 函数，本来应该 `await` 一个挂起的 promise，但你把它包在了 `try { await ... } catch (e) { /* 吞掉 */ }` 里——promise 挂起变成了静默 resolve，流程就错了。同一个道理，只是 Python 用的是抛异常。

### 7.10 本地迭代不要连 Supabase

P67 讲师从头到尾用的都是真 Supabase。这对教学演示是对的，但你自己写代码、改 prompt、调 `after_decide` 里的金额边界时，**每一次 invoke 都要往 Supabase 写十几行 checkpoint**，既慢又污染你的 `lab` schema。

LangGraph 有内存版 checkpointer，`MemorySaver`（课里没提，但你查 `langgraph.checkpoint.memory` 就能找到）。改法很小：

```python
# durable_claims.py 顶部加
from langgraph.checkpoint.memory import MemorySaver

def build_graph(saver: str = "postgres"):
    builder = StateGraph(ClaimState)
    # ... 五个 add_node、六条 add_edge、两个 add_conditional_edges 完全不变 ...

    if saver == "memory":
        cp = MemorySaver()
    else:
        cp = PostgresSaver(_pool)
        cp.setup()
    return builder.compile(checkpointer=cp)
```

然后 `demo.py` 里 `graph = build_graph(saver=os.getenv("CHECKPOINTER", "postgres"))`。日常调试跑 `CHECKPOINTER=memory python demo.py auto`，**速度会快 5–10 倍**，也不会有 thread 复用问题。但**验收（第 6 节检查清单）必须用 `postgres`**——否则你测不到「崩溃恢复」这个核心卖点。

**注意 `MemorySaver` 的坑**：进程一关，内存里的 checkpoint 全丢。所以你不能拿它演示 3.8 节的「kill 进程后 status 仍然 waiting」——那个实验**只有** Postgres checkpointer 能做出来。

### 7.11 `thread_id` 复用：讲师让你「删 claim」，但没说清删的是什么

`demo.py` 里的 `wipe()` 只删 `lab.payments`。我在 5.14 已经提过一次，但这里要展开——因为**它是复现时最容易被自己坑到的地方**。

现象：你跑 `python demo.py auto`（CLM-1005），付款成功；再跑 `python demo.py auto`（CLM-1005）一次——发现第二次**不再打印 `[pay] paid ...`，而是直接结束或报错**。

原因三条：

1. **`lab.payments` 有 `claim_id unique` + `ON CONFLICT DO NOTHING`**：第二次 `pay` 节点跑的时候 `rowcount=0`，走 `already paid, skipped` 分支。这是**正确行为**（P67 [06:54] 讲师演示的正是这个）。
2. **但 `thread_id` 还是 CLM-1005，checkpoint 里还有上次的历史**：`graph.invoke(...)` 会从**上次的 checkpoint** 开始跑而不是从 `START`。它看到上次停在 `END`，就会直接返回，`agent` 节点根本不会再跑一次。
3. **所以你在改 prompt 时看到的「没有报错但结果不对」，不是因为 prompt 没生效，而是因为图根本没跑**。

**修法**：要么每次换 claim_id（`CLM-1005-v2`），要么在 `wipe` 里**同时**清 checkpoint。清 checkpoint 的具体表名 / 列名课里没讲，你需要自己在 Supabase 里看一眼 `lab.checkpoints` 的表结构再写 SQL。大概长这样：

```python
def wipe(claim_id: str) -> None:
    with psycopg.connect(SUPABASE_DB_URL, autocommit=True) as conn:
        conn.execute("delete from lab.payments where claim_id = %s", (claim_id,))
        conn.execute("delete from lab.checkpoints where thread_id = %s", (claim_id,))
        # 如果还有 checkpoints_blobs / checkpoints_writes 之类的表，也要一起删——
        # 列名 / 表名以你实际查到的为准，别照抄。
```

**对于前端读者**：`thread_id` 是**你**定的，不是 LangGraph 分配的。它相当于前端里的 `sessionStorage.getItem("thread-id")`。你只要不清理浏览器 storage，下次刷新页面拿到的就是同一个 thread——同样的道理，这里不清理数据库的 checkpoint，同一个 claim_id 下次进来就是续上次。

### 7.12 两个人同时 approve 同一个 claim

P67 [12:22] 讲师提的那个 trick：「take a second computer, put in the same database URL, and see that you can approve the claim somewhere else」——你照做之后，很可能会撞上**竞态**：

- 电脑 A 和电脑 B 都 `graph.get_state(config)`，都看到「停在 approval」；
- A 按 Approve（`resume` 传 `"Dana"`），B 也按 Approve（`resume` 传 `"PREA"`）；
- 谁赢？**JSON 层面 LangGraph 不做分布式锁**，两个 `Command(resume=...)` 都写 checkpoint，最后一个写入的赢。`pay` 节点因为有 `ON CONFLICT DO NOTHING`，最终数据库里只会有一条 payment，但 `approved_by` 是 Dana 还是 PREA 是不确定的——**这就是为什么业务上要加乐观锁**。

课里没讲这块，因为它超出了「跑通 demo」范围。生产接 dashboard 时，P68 的 spec 里其实**应该**加一条「approval 请求带 `If-Match: <current_state_version>`，版本不一致直接 409」——但讲师没写，你自己加。

**对于前端读者**：这就是 Supabase Realtime 里常见的「两个 tab 同时编辑同一行，你需要 `updated_at` 乐观锁」——LangGraph 的 `graph.get_state(config)` 里其实**有** `snapshot.config` 带上 checkpoint 版本，你可以用它做 CAS（compare-and-swap）式的乐观锁，思路和 Supabase 的 `update(...).eq('version', old_version)` 一样。

### 7.13 用 P68 的 Claude Code 实施时，最常见的几个「AI 自作主张」

`docs/durable.md` 写进 Claude Code 之后，它会按 6 个 phase 干活。**如果 spec 写得不够死**，它会做下面这些你没要求的决定：

| Claude Code 常做的动作 | 为什么它会做 | 你要不要在 spec 里禁止 |
|---|---|---|
| 用 `MemorySaver` 代替 `PostgresSaver` | 「先跑通再说，postgres 后面接」 | ✅ 必须禁止。P68 的核心卖点就是持久化 |
| 用 `asyncio.sleep(60*60)` 轮询 approval 状态 | 它没意识到 `interrupt` 会自动停 | ✅ 必须禁止。这会占住 worker |
| 自己写一个 `status` 列在 `payments` 里，用轮询代替 checkpoint | 它不熟悉 LangGraph，用熟悉的方式做事 | ✅ 必须禁止。两个真相来源会打架 |
| 改成用 `create_agent` + 自己包一层重试 | 「教科书上 create_agent 更简单」 | ✅ 必须禁止。那就绕过了 interrupt |
| 把 `thread_id` 换成 UUID | 「UUID 更唯一、更专业」 | ✅ 必须禁止。dashboard 重启后找不到对应 claim |
| 用 `.env.local` / `.env.development` | 它按自己习惯命名 | ✅ 明确写死用 `.env` |

**做法**：在 `docs/durable.md` 的 `## Non-goals` 下面加一节 `## Hard constraints`，把这些列进去。P68 [04:33] 讲师那句「side note: please read the lab we just did and build the solution in that vein」其实就是在干这件事——只是写得比较软，你可以写得更硬。

### 7.14 讲师明确留的那个作业：支持「拒绝」

P67 [11:53] 讲师亲口说：「You could add in the ability to reject and see how that works. That would be quite fun.」这个作业不是随便说说，它正好能让你理解一条关键设计：**`interrupt` 之后图还是接着 `approval → pay → END`**。要加拒绝，你得改三个地方：

1. **路由函数要分开**：现在 `after_decide` 里「decision != approved 就 END」和「payout > limit 就 approval」是两条独立分支；如果你要让「超过 limit 但被拒」也走 `approval → END` 而不是 `approval → pay`，就得让 `approval_node` 之后**再加一个条件边**。具体做法是 `add_conditional_edges("approval", after_approval, {"pay": "pay", END: END})`，`after_approval` 判断 state 里的 decision 是不是 declined。
2. **`ClaimState` 加一个字段**：`decline_reason: str | None`，`approval_node` 在收到拒绝时写入。
3. **`pay_node` 在 refuse 时也要能安全退出**：不能「图到了 pay 节点但没东西付」直接 `KeyError`。

**完成这个作业后你会真正理解**：LangGraph 的条件边不是「if / else 的语法糖」，它是**状态机的转移表**——加上一个新状态「被拒绝」，就是新加一个转移。这跟 XState 的心智模型一模一样，**`after_decide` 相当于 `event`，节点相当于 `state`**。

### 7.15 关于「课里没讲」的边界：哪些我不该替你决定

最后列几条**逐字稿完全没给信息、所以本文档也没有替你决定**的事，你在复现时遇到要自己判断（不能怪文档没写）：

- **`calculate_payout` 的完整参数表**：讲师只说了「takes all of these various details」，没念参数名。本文档给的是 `(claim_amount, excess, covered)` 三个字段的最小版本，你实际应该在上一节的 notebook 里找那个原版。找到之后**连函数签名带 docstring 一起抄到 `durable_claims.py`**，因为 docstring 是给模型看的（讲师在 P66 [00:36] 专门提过「the correction with Claude Code's Revenge for Paa's Dock String right there」——意思就是 docstring 写错会影响模型行为）。
- **`payments` 表的真实 DDL**：讲师只描述了它「tracks when claims are paid」和「approvals field」。本文档给的是 `(id, claim_id, amount, approved_by, created_at)`，你要是想让 P68 的 dashboard 更友好，可能要加 `status`、`updated_at`、`handler_email` 等字段。**加了之后就要改 `pay_node` 里的 INSERT**，两边要同步。
- **`checkpoints` 表的具体列名**：这是 `PostgresSaver.setup()` 建的，不同 langgraph 版本列名可能不同。**任何涉及这张表的 SQL 都得以你实际查到的为准，别硬编列名**。我在 7.11 里那段 `wipe` 的 SQL 就是提醒你——`thread_id` 那一列在很多版本里叫 `thread_id`，但不是 100% 保证。
- **`durability` 三档的选择**：本文默认 `"sync"`，因为它最稳。但生产里如果你一天要处理 10 万个 claim，同步写库会成瓶颈，要切 `"async"`——这时你**就丢失了「崩溃不丢 checkpoint」的保证**。这是一个**工程权衡，不是对错**。P68 的产品化里 Claude Code 很可能会问你选哪个，你自己得知道答案。
- **Supabase 的 project schema**：P67 [11:13] 讲师用的是 `lab`。你的项目可能叫 `claims` 或者 `public` 或者别的。**`search_path`、`Lab` schema 名、`payments` 全限定名三处必须完全一致**，否则会出现「表建了、写不进去、也查不到」的经典三输。

---

## 结语：这一节真正教会你什么

回头看 P66–P68，讲师其实只教了**一个概念**，但花了三集：

> **「agent」不是对象，是一张能存盘、能续跑、能被人打断的图。**

- `create_agent` 给你一张图，但**你不知道它长什么样**（P66 [02:44] 打印出 `CompiledStateGraph` 那一刻的惊讶，就是这个意思）；
- 手写 `StateGraph` 让你**看得见每个节点、每条边**（P67 [02:11] 讲师让你对着图把代码里的 node / edge 对号入座）；
- 接 checkpointer 让这张图**能活过进程崩溃**（P67 [08:17]–[10:24] 那段 kill kernel 演示）；
- 加 `interrupt` 让这张图**能被人类接管**（P67 [05:02]–[05:54] 那段 dashboard 审批演示）；
- P68 把这一切**落进产品**（dashboard → 后端 → resume → agent → payout → 回调 → checkpoint）。

这四个能力加在一起，就是讲师反复说的那个词：**durable workflow**。它把 agentic AI 从「一个跑得挺酷的 demo」变成「一个银行 / 保险公司敢上线的东西」。这是这一节真正的重点，代码只是证据。

---

> **文档结束。**
>
> 全部代码块闭合。第 1–7 章俱全。截图共 6 张，全部取自【截图文件清单】：
> - `p066_0257s.jpg`（p066 [04:17]，`create_agent` 返回对象）
> - `p066_0445s.jpg`（p066 [07:25]，`ClaimState` 定义）
> - `p067_0131s.jpg`（p067 [02:11]，对着图找 node / edge）
> - `p067_0548s.jpg`（p067 [09:08]，kill kernel 演示）
> - `p067_0600s.jpg`（p067 [10:00]，checkpoint 历史）
> - `p068_0019s.jpg`（p068 [00:19]，P68 产品化流程）
>
> 未写进文档、但截图清单里存在、值得你自己去核对的帧：
> - `p066_0164s.jpg` / `p067_0183s.jpg`：讲师对着画的 mermaid 图，跟你手写的图对一下能确认 mapping 没错；
> - `p067_0392s.jpg`：`graph.invoke` 那行前后，能看到 `Command(resume=...)` 的实际写法；
> - `p068_0323s.jpg`：Claude Code plan 完成时的 6 个 phase，跟你 `docs/durable.md` 里的 phase 编号能不能对上。