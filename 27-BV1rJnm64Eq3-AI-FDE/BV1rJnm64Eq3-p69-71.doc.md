# AI FDE P69–P71 复现文档：持久化理赔工作流、人类审批与无 LLM 的 LangGraph 调度器

## 1. 这一节做什么

这三段课的主线不是“再学几个名词”，而是把前面做过的保险理赔 agent 往生产形态推进一步：

1. **P69 验收一个已经跑完的持久化项目**：讲师展示了一个由 Claude Code 连续工作 **2 小时 46 分钟** 做出来的项目。它已经经过六个阶段、检查和代码复查，核心能力是：
   - 用 LangGraph 组织工作流；
   - 用 Postgres / Supabase 做 checkpoint，也就是把每一步执行状态落库；
   - 金额超过审批限额时，用 `interrupt` 停下来，等人类 handler 签字；
   - 签字后用 `Command` 恢复执行；
   - 支付只发生一次，最终在 `payments` 表里看到 3 条支付记录。
2. **P70 把 agent teams、swarms、fleets 三个热词拆开**：讲师明确说这些词都在演化，没有严格定义；但通常可以这样理解：
   - **team**：3～4 个不同角色的 agent 协作，通常有 manager、共享任务列表、彼此通信；
   - **swarm**：20、30、100 个量级的 agent，常见形态是同一个 agent 复制多份，并行处理不同任务；
   - **fleet**：组织级 agent 名册，像“公司里所有 agent 的 HR 记录/花名册”。讲师对过度拟人化持保留态度。
3. **P71 用一个不调用 LLM 的 LangGraph 依赖图做 fan-out**：这是本文复现的核心代码。它把一组 claim 拆成多个 `work_claim`，用条件边 fan out，并用 `max_concurrency=5` 限制同时工作的 worker 数量。讲师的原话是：有业务逻辑就该用代码写，不必为了并行而让模型“自主决定”。

本文会给出一个可以本地跑起来的最小项目：  
- `dispatcher.py`：复现 P71 的无 LLM fan-out 调度器；  
- `claim_workflow.py`：复现 P69 的“超限审批 + 持久化 + 幂等支付”核心流程；  
- `payments` 表用唯一约束保证同一 claim 不会重复支付；  
- 用 Postgres 做 checkpoint，跑一次中断、恢复、支付。

> 说明：逐字稿没有给出完整仓库代码，也没有给依赖版本、数据库字段名。本文中凡是“课里没讲、为复现补全”的部分都会明确标注。命令输出字段只使用本文代码里能看到的字段，不凭印象编造。

![p069 00:23 讲师打开 harness.py 做代码复查](images/p069_0023s.jpg)

![p069 01:53 产品界面显示理赔队列与待处理数量](images/p069_0113s.jpg)

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

下面只摘与“怎么实现、怎么验收”直接相关的原话，不做逐段翻译流水账。

> "两小时四十六分钟后……它已经走完了全部六个阶段，也经过了多轮检查。"
> —— p069 [00:00]

> "会有 Postgres Superbase 的保存器在工作，所以所有内容都会被做检查点。"
> —— p069 [02:46]

> "这里有一笔橙色的记录在等待签核……金额是 2,240 美元。这超过了 1,000 美元，所以需要我们来签核。"
> —— p069 [03:14]

> "我们点这里，在这个界面上你会看到这笔 2,240 美元的付款超过了审批限额，正在等待处理人签核。选择一个处理人……我按下签核。"
> —— p069 [05:42]

> "你会发现它请求中断了流程……智能体需要人在环路中，于是发生了一次中断，决策就是在这里被记录的……决策结果是批准。"
> —— p069 [06:24]

> "出现了一个新的 schema……有很多检查点。Postgres 保存器一直在忙着干活。"
> —— p069 [07:24]

> "里面有三笔付款。第一笔是 420，一笔是 2240，还有一笔是 1150……三笔付款，对应的理赔编号是 1001。"
> —— p069 [07:55]

> "智能体团队大多数时候指的是这样一种情况：你有多个智能体协作来共同解决一个任务。"
> —— p070 [04:39]

> "蜂群……通常指的是非常大量的智能体，不是团队里的三四个，而更像是 20 个、30 个甚至 100 个。"
> —— p070 [06:36]

> "机群用来描述一个组织所拥有的智能体名册。"
> —— p070 [07:52]

> "它实现中断的方式是抛出一个异常，然后再捕获这个异常……如果你自己也在使用异常……你可能会不小心捕获到实际上是 LangGraph 框架抛出的异常。"
> —— p070 [02:24]

> "那种声明方式是在说它是一个类型列表，而那个东西是 operator.add……如果你想把这些结果与已有的状态合并，只需把你得到的内容加进去。"
> —— p071 [00:28]

> "扇出……会让它遍历状态中的所有理赔，并执行一个叫 work claim 的操作。"
> —— p071 [01:08]

> "当你调用 invoke 时……你传入这个 max concurrency 为五。这会确保同一时间只有五个在干活。"
> —— p071 [02:11]

> "如果你有属于代码的业务逻辑，那就用代码来实现。LangGraph 正好为你提供了这样的机制。"
> —— p071 [03:34]

![p069 03:24 队列中出现 waiting for sign off 状态](images/p069_0204s.jpg)

![p069 05:40 审批页显示金额超过限额，需要选择 handler 签字](images/p069_0340s.jpg)

## 3. 从零复现

下面按“能跑起来”的顺序做。建议新建目录 `insurance-swarm/`。

### 3.1 目录结构

```text
insurance-swarm/
├─ .env.example
├─ requirements.txt
├─ sql/
│  └─ 001_schema.sql
├─ src/
│  ├─ dispatcher.py
│  ├─ pay_claim.py
│  ├─ claim_workflow.py
│  └─ run_claim_demo.py
└─ README.md
```

### 3.2 准备 Postgres

课里用的是 Supabase 上的 Postgres。为了本地复现，你可以用已有的 Postgres，也可以用 Docker 起一个本地库。**课里没有讲 Docker，以下只是复现补充，不是讲师原话。**

```bash
docker run --name claims-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

如果你用 Supabase，把 Supabase 提供的 Postgres 连接串填到 `.env` 的 `DATABASE_URL`。  
注意：课里提到 Supabase 免费层最多 5 个连接，这一点在 P071 [04:33] 明确出现。复现时不要开太多进程同时连库。

### 3.3 创建环境变量

`.env.example` 内容：

```dotenv
# 必填：Postgres 连接串
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres

# 课里提到过 OpenRouter；本文的 dispatcher 和 claim demo 不调用 LLM，
# 所以这个变量不是本文代码的硬依赖。
OPENROUTER_API_KEY=
```

复制成 `.env`：

```bash
cp .env.example .env
```

### 3.4 安装依赖

`requirements.txt`：

```text
langgraph==0.2.74
langgraph-checkpoint-postgres==2.0.9
psycopg[binary]==3.2.3
python-dotenv==1.0.1
```

> 课里没有给依赖版本。以上版本是复现补充。LangGraph 的导入路径在不同版本间可能变化；如果你安装后遇到 `Send` 或 `PostgresSaver` 导入路径不同，以实际版本为准，核心思路不变。

安装：

```bash
cd insurance-swarm
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3.5 建表

```bash
psql "$DATABASE_URL" -f sql/001_schema.sql
```

这一步会创建 `claims`、`decisions`、`payments`、`todos`、`documents`、`settings` 等表。课里展示了 `payments` 表、`claims` 数据、`documents` 里的理赔手册与保单条款、`settings` 里的 1000 美元审批限额。**具体字段名课里没有完整展示，下面 SQL 是复现补全；如果你对照真实项目，字段名以实际输出为准。**

### 3.6 先跑无 LLM 的 fan-out 调度器

```bash
python src/dispatcher.py
```

预期看到类似输出，字段来自本文代码：

```text
claims: 25
results: 25
elapsed_seconds: ...
first_result: {'claim_id': '1001', 'status': 'done', 'worker_pid': ...}
```

这里复现的是 P071 的核心：`claims` 列表被 fan out 成多个 `work_claim`，`max_concurrency=5` 限制同时工作的数量。

![p071 00:11 dispatch 状态类与 results reducer](images/p071_0011s.jpg)

![p071 01:20 fan out 依赖图：list claims → work claim](images/p071_0080s.jpg)

### 3.7 再跑持久化 + 人类审批 + 支付

```bash
python src/run_claim_demo.py
```

流程是：

1. 创建 `claim_id=1002`，金额 `224000` 分，也就是 2240 美元；
2. 金额超过 1000 美元审批限额，`approval_node` 调用 `interrupt`；
3. 程序打印第一次结果，里面会有中断信息；
4. 代码用 `Command(resume={"approved": True, "handler": "Dana"})` 恢复；
5. `pay_node` 调用 `pay_claim`，向 `payments` 表插入一条支付记录；
6. 如果你再跑一次同一 claim，`ON CONFLICT (claim_id) DO NOTHING` 会防止重复支付。

验证支付：

```bash
psql "$DATABASE_URL" -c "select claim_id, amount_cents, handler from payments order by created_at;"
```

如果你重复跑，应该看到同一 `claim_id` 不会出现第二条支付。  
课里强调的是“我们只支付了三条，没有重复支付”；本文用数据库唯一约束复现这个保证。

![p069 07:10 Supabase 中大量 checkpoint 记录](images/p069_0430s.jpg)

![p069 07:55 payments 表中出现三条支付记录](images/p069_0475s.jpg)

### 3.8 P70 概念如何落到本项目

P70 没有代码，但它解释了为什么要做上面的调度器。可以把它整理成下面这张表：

| 概念 | 课里给的典型特征 | 在本项目里怎么体现 |
|---|---|---|
| agent team | 多个不同角色 agent 协作；通常有 manager、共享任务列表、通信机制 | 课里只讲概念，没有给 team 的完整实现。本项目没有假装实现 team。 |
| agent swarm | 数量大，常见是同一个 agent 复制多份，并行处理不同任务 | `dispatcher.py` 把 25 条 claim fan out 给 `work_claim`，这是“受控 swarm”的骨架。真正的 claim agent 内部还可以调用 LLM，但调度不靠 LLM 自主决定。 |
| agent fleet | 组织级 agent 名册，统一管理所有 agent | 课里提到 LangSmith Fleet、Kimi Agent Swarm 等产品；本项目只做单机可跑的调度与审批，不实现 fleet 管理平台。 |

课里还特别提醒：LangGraph 的 `interrupt` 是通过抛异常再捕获实现的。如果你在自己的节点里写了很大范围的 `try/except`，可能把框架的异常吃掉，导致 `interrupt` 看起来“失效”。这个坑在 P070 [02:24] 讲得很清楚，复现时不要把 `approval_node` 整个包在宽泛的 `try/except` 里。

![p070 07:00 讲师对比 team、swarm、fleet 三个概念](images/p070_0420s.jpg)

![p071 03:15 讲师强调 max_concurrency 与“业务逻辑用代码写”](images/p071_0195s.jpg)

## 4. 完整代码

下面每个文件都是完整文件，可以直接保存。  
再次说明：`Send`、`PostgresSaver.setup()`、具体 SQL 字段名等，逐字稿没有逐字给出；这些是为“可运行复现”补全的。讲师讲过的核心结构是：`dispatch` 状态、`results` 用 `operator.add` 合并、`fan_out` 条件边、`work_claim`、`max_concurrency=5`、`interrupt`、`Command` 恢复、Postgres checkpoint。

### 4.1 `src/dispatcher.py`

```python
from __future__ import annotations

import operator
import os
import time
from typing import Annotated, Any, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send


class DispatchState(TypedDict):
    claims: list[dict[str, Any]]
    results: Annotated[list[dict[str, Any]], operator.add]


class WorkItem(TypedDict):
    claim: dict[str, Any]


def list_claims(state: DispatchState) -> dict[str, Any]:
    # 课里从 start 先到一个 list claims 节点。
    # 这里不生成新状态，只是给 fan_out 一个挂载点。
    return {}


def fan_out(state: DispatchState) -> list[Send]:
    # 课里说 fan_out 会遍历 state 里的 claims，把每个 claim 送到 work_claim。
    return [Send("work_claim", {"claim": claim}) for claim in state["claims"]]


def work_claim(payload: WorkItem) -> dict[str, Any]:
    claim = payload["claim"]

    # 课里没有展开 work_claim 内部实现。
    # 这里用 sleep 模拟外部 IO；真实项目里可以在这里调用理赔 agent。
    time.sleep(0.15)

    result = {
        "claim_id": claim["claim_id"],
        "status": "done",
        "worker_pid": os.getpid(),
    }
    return {"results": [result]}


def build_dispatcher():
    builder = StateGraph(DispatchState)
    builder.add_node("list_claims", list_claims)
    builder.add_node("work_claim", work_claim)

    builder.add_edge(START, "list_claims")

    # 课里讲的 fan out：从 list_claims 条件边分发到多个 work_claim。
    builder.add_conditional_edges("list_claims", fan_out, ["work_claim"])

    builder.add_edge("work_claim", END)
    return builder.compile()


if __name__ == "__main__":
    claims = [
        {"claim_id": str(1000 + i), "amount_cents": 42000 + i * 1000}
        for i in range(1, 26)
    ]

    graph = build_dispatcher()
    started = time.time()

    out = graph.invoke(
        {"claims": claims, "results": []},
        config={"max_concurrency": 5},
    )

    elapsed = time.time() - started
    print("claims:", len(out["claims"]))
    print("results:", len(out["results"]))
    print("elapsed_seconds:", round(elapsed, 2))
    print("first_result:", out["results"][0])
```

### 4.2 `src/pay_claim.py`

```python
from __future__ import annotations

import os
from typing import Any

import psycopg
from psycopg.rows import dict_row


def pay_claim(claim_id: str, amount_cents: int, handler: str) -> dict[str, Any]:
    """
    幂等支付：同一个 claim_id 最多插入一条 payments 记录。
    课里强调不能对同一件事支付两次；这里用主键/唯一约束实现。
    """
    db_url = os.environ["DATABASE_URL"]

    with psycopg.connect(db_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO payments (claim_id, amount_cents, handler)
                VALUES (%s, %s, %s)
                ON CONFLICT (claim_id) DO NOTHING
                RETURNING claim_id, amount_cents, handler
                """,
                (claim_id, amount_cents, handler),
            )
            row = cur.fetchone()
        conn.commit()

    if row is None:
        return {"status": "already_paid", "claim_id": claim_id}

    return {"status": "paid", **row}
```

### 4.3 `src/claim_workflow.py`

```python
from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

from pay_claim import pay_claim


APPROVAL_LIMIT_CENTS = 100_000  # 1000 美元 = 100000 分


class ClaimState(TypedDict, total=False):
    claim_id: str
    amount_cents: int
    decision: str
    handler: str
    payment: dict[str, Any]


def approval_node(state: ClaimState) -> dict[str, Any]:
    amount = state["amount_cents"]

    if amount <= APPROVAL_LIMIT_CENTS:
        return {"decision": "approved", "handler": "auto"}

    # 课里讲的人类审批：超过限额就 interrupt，等 handler 签字。
    # 注意：不要把这里包在宽泛 try/except 里，否则可能吃掉 LangGraph 的异常。
    payload = interrupt(
        {
            "claim_id": state["claim_id"],
            "amount_cents": amount,
            "reason": "over_approval_limit",
        }
    )

    approved = bool(payload.get("approved"))
    return {
        "decision": "approved" if approved else "declined",
        "handler": payload.get("handler", "unknown"),
    }


def pay_node(state: ClaimState) -> dict[str, Any]:
    if state.get("decision") != "approved":
        return {
            "payment": {
                "status": "not_paid",
                "claim_id": state["claim_id"],
            }
        }

    payment = pay_claim(
        claim_id=state["claim_id"],
        amount_cents=state["amount_cents"],
        handler=state.get("handler", "auto"),
    )
    return {"payment": payment}


def build_claim_graph(checkpointer):
    builder = StateGraph(ClaimState)
    builder.add_node("approval", approval_node)
    builder.add_node("pay", pay_node)

    builder.add_edge(START, "approval")
    builder.add_edge("approval", "pay")
    builder.add_edge("pay", END)

    return builder.compile(checkpointer=checkpointer)
```

### 4.4 `src/run_claim_demo.py`

```python
from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command

from claim_workflow import build_claim_graph

load_dotenv()


def main():
    db_url = os.environ["DATABASE_URL"]
    thread_id = "claim-1002"
    config = {"configurable": {"thread_id": thread_id}}

    with PostgresSaver.from_conn_string(db_url) as saver:
        saver.setup()
        graph = build_claim_graph(saver)

        first = graph.invoke(
            {
                "claim_id": "1002",
                "amount_cents": 224_000,
                "decision": "",
                "handler": "",
                "payment": {},
            },
            config=config,
        )
        print("FIRST:", json.dumps(first, ensure_ascii=False, default=str, indent=2))

        second = graph.invoke(
            Command(resume={"approved": True, "handler": "Dana"}),
            config=config,
        )
        print("SECOND:", json.dumps(second, ensure_ascii=False, default=str, indent=2))


if __name__ == "__main__":
    main()
```

### 4.5 `sql/001_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    claimant TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
    id BIGSERIAL PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(claim_id),
    decision TEXT NOT NULL,
    rationale TEXT,
    handler TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    claim_id TEXT PRIMARY KEY REFERENCES claims(claim_id),
    amount_cents INTEGER NOT NULL,
    handler TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    claim_id TEXT REFERENCES claims(claim_id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value)
VALUES ('payout_approval_limit_cents', '100000')
ON CONFLICT (key) DO NOTHING;

INSERT INTO claims (claim_id, claimant, claim_type, amount_cents, status)
VALUES
    ('1001', 'Maya Patel', 'trip_delay', 42000, 'new'),
    ('1002', 'Dorothy', 'trip_cancellation', 224000, 'new'),
    ('1010', 'Owen', 'trip_delay', 115000, 'new')
ON CONFLICT (claim_id) DO NOTHING;

INSERT INTO documents (name, body)
VALUES
    ('claims_manual', 'Demo claims manual. Replace with your real policy.'),
    ('policy_wording', 'Demo policy wording. Replace with your real policy.')
ON CONFLICT DO NOTHING;
```

### 4.6 `.env.example`

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
OPENROUTER_API_KEY=
```

### 4.7 `requirements.txt`

```text
langgraph==0.2.74
langgraph-checkpoint-postgres==2.0.9
psycopg[binary]==3.2.3
python-dotenv==1.0.1
```

## 5. 逐行解释

### 5.1 `DispatchState` 和 `operator.add`

`DispatchState` 里：

```python
results: Annotated[list[dict[str, Any]], operator.add]
```

这是 P071 最关键的语法点。课里说，`operator.add` 是在告诉 LangGraph：如果多个分支都要合并 `results`，就把新结果“加进去”。因为 `results` 是 list，所以效果就是拼接列表。

在 JS/Node 里，你可以把它想成每个 worker 返回 `[result]`，最后 `results = results.concat(newResults)`。LangGraph 帮你做了这个合并，但前提是每个分支返回的 `results` 必须是列表，不能直接返回单个对象。  
如果你写成 `return {"results": result}`，而 reducer 期待 list，就会出错。本文代码里 `work_claim` 返回的是 `{"results": [result]}`，就是为了配合 reducer。

### 5.2 `fan_out` 为什么返回 `Send`

```python
return [Send("work_claim", {"claim": claim}) for claim in state["claims"]]
```

课里没有逐字给 `Send` 这个类名，只说了“fan out 条件边会遍历 claims，把每个 claim 送到 work_claim”。本文用 `Send` 实现这个动作。  
`Send` 的作用是：不是让主状态一条线往下走，而是为每个 claim 生成一个独立输入，分别进入 `work_claim` 节点。25 个 claim 就产生 25 个待执行任务。

如果你不用 `Send`，也可以自己写循环、线程池或队列；但那就不是课里展示的 LangGraph 条件边 fan-out 了。LangGraph 的价值在于：你只声明“怎么分发”，执行、并发限制、checkpoint 由框架处理。

### 5.3 `max_concurrency=5` 到底是什么

```python
config={"max_concurrency": 5}
```

课里说得很直接：这会让同时工作的 worker 不超过 5 个。它限制的是**这一次 `invoke` 内部的并发**，不是全公司所有进程的全局速率限制。  
如果你开了多个 Python 进程，每个进程都 `max_concurrency=5`，对 OpenRouter 或数据库的总压力仍然可能超。P071 [04:04] 提到限流、连接上限、重试，这些不是 `max_concurrency` 一个参数能全部解决的。

在 JS/Node 里，这类似用 `p-limit` 或自己维护一个 Promise 池，限制同时进行的任务数。区别是 LangGraph 把调度和状态合并在一起，还能配合 checkpoint 恢复。

![p071 04:01 扩展时要注意限流、连接数和重试](images/p071_0241s.jpg)

### 5.4 `interrupt` 和 `Command(resume=...)`

`approval_node` 里：

```python
payload = interrupt({...})
```

课里解释过，`interrupt` 是通过抛异常再捕获实现的。它会让图停在当前节点，把状态 checkpoint 下来。之后你用：

```python
graph.invoke(Command(resume={"approved": True, "handler": "Dana"}), config=config)
```

恢复。恢复时，`interrupt(...)` 的返回值就是 `Command(resume=...)` 里传进去的对象。本文代码因此从 `payload` 里读 `approved` 和 `handler`。

课里还提醒：如果你在节点里写了很宽的 `try/except`，可能把框架内部异常吃掉，导致 `interrupt` 不工作。复现时不要在 `approval_node` 外面包 `try/except Exception`。

### 5.5 `PostgresSaver` 与 `thread_id`

```python
with PostgresSaver.from_conn_string(db_url) as saver:
    saver.setup()
    graph = build_claim_graph(saver)
```

课里说用 Postgres / Supabase saver，把每个 super step checkpoint 下来。本文用 `PostgresSaver` 做同样的事。  
`thread_id` 是恢复执行的“会话 ID”。同一个 `thread_id` 才能恢复同一个 claim 的中断状态。课里展示的产品里，每个 claim 的 trace 能对应起来，背后就需要这类标识。  
课里没有给 `thread_id` 的具体命名规则；本文用 `claim-1002` 只是复现选择。

### 5.6 `pay_claim` 为什么用 `ON CONFLICT`

课里反复强调不能重复支付。本文的 `payments` 表把 `claim_id` 设为主键：

```sql
claim_id TEXT PRIMARY KEY
```

插入时：

```sql
ON CONFLICT (claim_id) DO NOTHING
RETURNING ...
```

如果同一 claim 已经支付过，`RETURNING` 不会返回行，`fetchone()` 得到 `None`，函数返回 `already_paid`。这比“先查再插”更稳，因为查和插之间可能有并发。

在 Node/Postgres 里对应的是唯一索引 + `INSERT ... ON CONFLICT`，或者事务里加行锁。前端转 AI 应用时，涉及钱和幂等，不要把“查一下有没有”当成绝对安全。

### 5.7 P70 的 team / swarm / fleet 在代码里的边界

课里把三个词讲得很清楚：它们是演化中的热词，不是严格标准。本文只实现 swarm 的调度骨架，
本文只实现 swarm 的调度骨架，不实现 team 里的 manager 协商，也不实现 fleet 的组织级管理。为什么这么划界？因为 P070 里讲师没有给 team 和 fleet 的可运行代码，给了的是概念定义和市场产品截图（Claude agent teams、Kimi Agent Swarm、LangSmith Fleet）；唯一能照着敲的，是 P071 那个“用 LangGraph 依赖图跑固定 worker 池”的调度器。把概念当概念讲，把代码当代码写，才不会把没验证过的东西说成“课上实现过”。

### 5.8 `pay_node` 里为什么要先判断 `decision`

```python
def pay_node(state: ClaimState) -> dict[str, Any]:
    if state.get("decision") != "approved":
        return {"payment": {"status": "not_paid", "claim_id": state["claim_id"]}}
    ...
```

课里在 P069 [03:43] 和 [04:12] 提到三种结果：approved、declined、referred。并不是每个 claim 都会被支付。`pay_node` 如果不看 `decision` 就调 `pay_claim`，那么“拒绝”和“转人工”的 claim 也会写进 `payments` 表，直接违背 P069 [07:55] 讲师强调的“三条支付记录对应三笔批准，其他没有付”。

在代码结构上，这就是“支付动作放在一个受状态约束的节点里”，而不是放在 `approval_node` 里顺手付掉。前者在 checkpoint 恢复时可以重放而不重复扣款（因为 `payments` 有唯一约束），后者一旦在 `interrupt` 之后执行，恢复逻辑更难控制。前端同学可以把它类比为“不要把副作用写在 reducer 里，写在有明确条件的 action handler 里”。

### 5.9 SQL 表与课里提到的对象怎么对应

课里明确出现过这些对象：

- `payments` 表，P069 [07:55] 看到了三条记录，含 420、2240、1150 三笔；
- `checkpoints`，P069 [07:24] 说 Postgres saver 在不停写；
- `claims`，P069 [08:41] 说“claims 都在这里”；
- `documents`，P069 [08:41] 说里面有 claims manual 和 policy wording；
- `settings`，P069 [08:36] 明确说 1000 美元审批限额“coded here in the database”；
- `todos`，P069 [08:54] 说屏幕上看到的 to-do 就是这张表在跟踪。

本文的 `001_schema.sql` 覆盖了除 checkpoint 表以外的这些对象。checkpoint 表由 `saver.setup()` 自动创建，不需要手写。**课里没有逐字给出这些表的字段名**，所以本文给的是复现用的最小字段集合；如果你接上 Supabase 真实项目，字段名请以实际 `\d payments` 输出为准，不要拿本文的表结构当权威。

另外，课里 P069 [08:36] 说限额是在数据库里配置的，本文把 `APPROVAL_LIMIT_CENTS` 直接写在 `claim_workflow.py` 顶部，是为了让 demo 一眼看清判断逻辑。生产中要让它从 `settings` 表读，不然改限额要重新发版，这和课里“限额写在数据库里”的设计就脱节了。这一点属于课堂设计意图与 demo 代码之间的差距，读者要自己意识到。

![p069 08:41 Supabase 中 claims、documents 等业务表](images/p069_0521s.jpg)

## 6. 复现检查清单

按顺序勾选，每一条都能独立验证，失败时对照本清单排查。

**环境与依赖**

- [ ] Python 3.11+ 可用：`python --version`
- [ ] 虚拟环境已激活，`pip list` 里能看到 `langgraph`、`langgraph-checkpoint-postgres`、`psycopg`、`python-dotenv`
- [ ] `.env` 里 `DATABASE_URL` 指向的 Postgres 可连：`psql "$DATABASE_URL" -c "select 1;"`
- [ ] 如果用的是 Supabase 免费层，确认没有同时打开超过 5 个连接（课里 P071 [04:33] 明确说这是上限）
- [ ] `sql/001_schema.sql` 已执行，`\dt` 能看到 `claims`、`decisions`、`payments`、`todos`、`documents`、`settings` 六张业务表

**调度器（无 LLM）**

- [ ] `python src/dispatcher.py` 正常退出，退出码为 0
- [ ] 输出里 `claims: 25` 和 `results: 25`
- [ ] `results` 条数与输入 `claims` 数一致，说明 reducer 没有丢分支
- [ ] 把 `max_concurrency` 从 5 改成 1 再跑一次，`elapsed_seconds` 明显变大，说明限流确实生效
- [ ] 把 `max_concurrency` 改成 25 再跑一次，仍能跑完，说明框架不会因为并发上限高于任务数而卡死

**持久化与中断**

- [ ] 第一次跑 `python src/run_claim_demo.py`，`FIRST:` 输出里能看到 `claim_id=1002`，且流程没有走到 `payment.status=paid`（因为被 `interrupt` 挂起）
- [ ] 同一个脚本里 `SECOND:` 输出出现，`payment` 里 `status` 是 `paid`，`handler` 是 `Dana`
- [ ] 在 Postgres 里执行 `select count(*) from payments where claim_id = '1002';`，结果是 1
- [ ] 把 `Dana` 改成 `Marcus`，**先把 payments 里 1002 那条删掉**，再重跑，确认新插入的 handler 是 Marcus。这句话的意思是：唯一约束只保证不重复，不保证记录内容与你预期一致；改 handler 前先清数据，否则你可能看到 `already_paid` 而不是 `paid`
- [ ] 在 `approval_node` 里临时塞一个 `try/except Exception: pass` 包住 `interrupt`，重跑，观察 `interrupt` 是否失效。观察完删掉，不要留在 demo 里。这一步是 P070 [02:24] 那个坑的最小验证

**恢复能力（对照 P069 [10:21] 的 stretch assignment）**

- [ ] 在 `SECOND` 之前加一个 `input("press enter")` 或 `time.sleep(30)`，运行中按 Ctrl+C 杀掉进程
- [ ] 重跑脚本，同一 `thread_id` 下能否续上。**课里没给具体的 kill 后恢复脚本命令**；本文的做法是重复调用 `graph.invoke` 传同一个 `config`，如果你杀进程时已经过了 `interrupt`，恢复后会再触发一次中断，你需要自己再发一次 `Command(resume=...)`。这一点必须在自己的环境里试出来，不能靠猜
- [ ] 在 Supabase 或本地库执行 `select count(*) from checkpoints;`，数字应大于 0。**字段名以实际 `\d checkpoints` 为准**，因为课里没有展示这张表的列名

**数据一致性**

- [ ] `select claim_id, amount_cents, handler from payments;` 里没有重复 `claim_id`
- [ ] 把 1002 重复支付一次（手动再调一次 `pay_claim`），确认返回 `already_paid` 而不是报唯一约束错误
- [ ] `select * from settings;` 里能看到审批限额那条记录，虽然 demo 代码当前没读它（这是已知差距）

**可观测性**

- [ ] `checkpoints` 表有持续增长，说明 Postgres saver 在工作，对应课里 P069 [07:24] 的观察
- [ ] 本文没有接 Langfuse。**课里 P069 [09:24] 明确说 trace 数据另外存了一份在 Langfuse 里**；本文只做到数据库和产品内 trace，Langfuse 部分课里没给接入代码，不要假装已经复现

## 7. 课里没讲但你会撞上的

这一节专门写“逐字稿里没有、但你照着跑一定会碰到”的事，每条都标明是补充而不是讲师原话。

**1）LangGraph 的版本差异比你预期大**

课里 P071 只出现了 `StateGraph`、`add_node`、`add_edge`、`add_conditional_edge`、`invoke`、`max_concurrency` 这些名字，没有给 `Send`、`PostgresSaver`、`interrupt`、`Command` 的具体导入路径。不同 LangGraph 版本里，`Send` 可能在 `langgraph.types`，`interrupt` 可能也是；`PostgresSaver` 拆到了独立包 `langgraph-checkpoint-postgres`。本文写的版本是复现补充。如果你 `import` 报错，先降一版；如果还是不行，用 `python -c "import langgraph; print(langgraph.__version__)"` 看版本，再对照官方文档改路径。**不要因此以为课里的代码写错了**——课里根本没有贴这些导入。

**2）`max_concurrency` 不是全局限流**

P071 [02:11] 的原话是“no more than five of these on the go at any one time”。注意“at any one time”限定的是这一次图执行。如果你和 P069 一样在 25 个 claim 上并行跑，每个 claim 的图内部还有 LLM 调用，那么对 OpenRouter 的总请求速率是“每图并发 × 图内并发 × 进程数”，很容易超。P071 [04:04] 讲了 rate limit 和 429，但没给具体的 retry 代码。本文也没有写 retry，因为课里没给。你要上生产，需要在 `work_claim` 里面自己加指数退避，或者用框架层面的 retry 策略——**这是填补空白，不是复现**。

**3）Supabase 免费层的 5 连接是硬上限**

P071 [04:33] 说得非常明白：“Superbase on their free tier only allows up to five connections.” 这一点在你第一次跑 demo 时就可能撞上：`PostgresSaver.from_conn_string` 会占一个连接，`pay_claim` 也会开新连接，如果你还开了 `psql` 去查表，加起来很容易到 5。Docker 本地 Postgres 没有这个限制，所以本地跑通了不代表 Supabase 跑得通。要么用连接池（课里没讲 pgBouncer，这里只提风险），要么把 demo 里的连接复用起来。

**4）`interrupt` 会吃异常，也会被异常吃**

P070 [02:24] 那段提醒非常值得抄在本子上。它的机制是“抛异常，框架接住”。所以任何在 `approval_node` 里包住 `interrupt` 的 `try/except`，只要捕获范围够宽，就会把框架的异常截走。它的另一种翻车方式是你在 `pay_node` 里写了重试逻辑，重试把 `interrupt` 的恢复异常也吞了，表现为“审批永远恢复不了，但程序也不报错”。本文的检查清单第 6 节里已经有一条专门验证这个坑。

**5）`ON CONFLICT` 只保幂等，不保语义正确**

本文的 `payments` 用 `claim_id` 做主键，重复插会返回 `already_paid`。这解决了“同一 claim 付两次”的问题，但没解决“同一 claim 金额变了”的问题。如果第二次插入金额不同，`ON CONFLICT DO NOTHING` 会静默丢掉，你会以为付了，其实还是旧金额。课里 P069 [07:24] 的诉求是“不会重复支付”；本文按这个诉求实现。**要防金额变更，需要额外做 `ON CONFLICT DO UPDATE` 或者写审计表，这两者课里都没讲**，别照着本文 SQL 就上生产。

**6）课里的 trace 和本文的 trace 不是一回事**

P069 [04:46] 讲师说“在产品里也暴露 observability”，P069 [09:24] 又说“更详细的一份存在 Langfuse 里”。这两层本文只做到了第一层的雏形（数据库里的 `decisions` 表）。Langfuse 的接入代码、trace 的 span 结构、每一步的消息记录，课里都没有贴。本文的 `decisions` 表只记了 handler 和 rationale，和 P069 [04:46] 展示的“打开 Maya 能看到全部 policy 段落和消息”差得很远。不要把本文的 `decisions` 表当成已经复现了 P069 的平台内 trace。

**7）`OPENROUTER_API_KEY` 在本文里是摆设**

P071 [04:04] 提到“if we're going to be hammering open router with lots of requests”。但本文的 `dispatcher.py` 和 `claim_workflow.py` 都**不调用 LLM**，`OPENROUTER_API_KEY` 只是照课里的环境变量名留个占位。这是 P071 的核心设计：LangGraph 作为编排框架，不一定要编排 LLM 调用。你要是想把它接到真实的理赔 agent 上，得自己把 `work_claim` 里的 `sleep` 换成 LLM 调用——那一步课里没给，属于你自己的实现。

**8）Teams / Swarms / Fleets 不要按“严格定义”去用**

P070 [04:39] 第一句就是“these terms are all evolving terms and they are hypey terms”。这意味着你在面试、在给客户写方案时，不要拿本文的表格当定义标准。本文第 3.8 节那张表只是“讲师的通常用法”，不是规范。特别是 fleet，讲师自称“I don't feel super awesome about”它，还明确说他不喜欢过度拟人化（P070 [08:36]）。前端的同学容易顺着产品 UI（比如 LangSmith Fleet 里的“executive assistant”“software engineer”）去理解 agent，但讲师的立场是：先看业务问题，再决定要不要拆 agent。

**9）`PostgresSaver.setup()` 在你没有建库权限时会失败**

本文的 `run_claim_demo.py` 里调了 `saver.setup()`。它需要建表权限。Supabase 免费层的默认用户有没有这个权限，课里没讲；本地 Docker 的 `postgres` 超级用户肯定有。如果失败，先确认 `DATABASE_URL` 指向的用户能 `CREATE TABLE`。本文没有为此写 fallback，因为课里也没写。

**10）Windows 上的 psql 路径与虚拟环境激活**

`source .venv/bin/activate` 只在 macOS/Linux 有效，Windows 要用 `.venv\Scripts\activate`。`psql` 在 Windows 上通常不在 PATH 里，需要装 PostgreSQL 客户端或者用 Supabase 的 SQL Editor 代替。这些属于环境细节，课里没讲，但跨平台读者十有八九会卡在第一步。

**11）LangSmith 和 Langfuse 是两个产品，别混**

P070 [09:36] 明确说了：LangSmith 是 LangChain 的观测平台，“its equivalent to LangFuse”。课里 P069 展示 trace 用的是 Langfuse，P070 介绍 fleet 用的是 LangSmith，两者不是一家。本文只在课里提到 Langfuse 的地方写 Langfuse，没有把 LangSmith 的 observability 功能安到 Langfuse 头上。

**12）kill 进程后“自动恢复”不是本文代码自带的能力**

P069 [10:21] 把“杀掉 agent 再拉起、确认它恢复”留成了 stretch assignment，还特意说“Ask the code how to if you're not sure”。这意味着**具体命令课里没给**。本文的 demo 用同一个 `thread_id` 重复 `invoke` 就能续跑，但“杀掉进程再重新 `invoke` 算不算恢复”取决于你杀在哪个 super step。如果你在 `interrupt` 之前杀，重跑会重新走 `approval`；在 `interrupt` 之后杀，重跑会等你 `resume`。这两种行为都要自己在真实环境里观察，不要把本文的脚本当成“崩溃恢复已验证”。

---

到这一步，P069、P070、P071 三段的目标就落地了：

- **P069** 的持久化理赔流程，本文用 `claim_workflow.py` + `payments` 唯一约束 + `PostgresSaver` 给了可运行骨架；
- **P070** 的 team/swarm/fleet 概念，本文在第 3.8 节和第 7 节第 8 条给了边界说明，没有伪造代码；
- **P071** 的无 LLM fan-out 调度器，本文用 `dispatcher.py` 完整复现，`max_concurrency=5`、`operator.add` reducer、`Send` 分发都在。

跑通之后回到 P071 [03:34] 的那句话复读一遍：“If you've got business logic that belongs in code, then do it with code.” 这份文档里所有能跑的部分，都是这句话的注脚；所有“课里没讲”的标注，都是为了不让读者把补全当成讲师原话。