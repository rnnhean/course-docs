# Agentic AI System Design（P013 第二段）：缓存陷阱、分片扩展、多租户隔离与本地可观测性复现

> 本文覆盖 p013 第 2/2 段（67:43–131:43）。这一段前半是纯系统设计讨论（缓存、扩展、分片、多租户），后半是三个可运行的 demo：ChromaDB metadata filtering、ChromaDB 多租户两种方案、Langfuse 本地自托管 + LangChain 接入。文档按"能照着跑起来"来写，代码全部是完整文件，可直接保存执行。
>
> 说明：逐字稿里讲师演示代码时没有逐行念出文件内容，本段也没有 OCR 结果。因此第 4 节的代码是**按讲师在屏幕上演示出来的行为（文档元数据字段、两种多租户设计、Langfuse 的 handler 调用方式）重建的可运行版本**，凡是讲师没讲的实现细节（embedding 模型、版本号、分片的具体实现）都在文中明确标注"课里没讲"。

---

## 1. 这一节做什么

这一节的主线是：**RAG 是任何 Agent 应用的核心，但它不是"能检索就行"，真正决定它能不能上生产的是缓存策略、扩展方式和租户隔离方式。**

具体产出四个东西：

1. **一套缓存决策框架**：哪些层可以缓存（prompt / embedding / 检索结果 / 规划状态 / 工具调用结果），以及最危险的一种情况——把错误的工具响应写进缓存，让所有相似查询都命中错误答案。讲师还给出了识别手段：延迟很好看、但忠实度/相关性指标和客户负反馈在恶化。
2. **一张分片（sharding）设计清单**：规模变大只有两件事——数据量变大（百万文档、十亿 chunk）和 QPS 变大（5 → 5000/10000）。数据量变大引出多实例与分片键选择（时间、地理、语义/领域、热冷数据），以及分片自带的 **scatter-gather** 问题和三种缓解手段（改分片键、给慢分片加缓存、复制热分片）。
3. **一套多租户（multi-tenancy）方案对照表**：一租户一 collection、共享 collection + metadata filtering、namespace 隔离、超大客户独占集群，各自的适用条件和风险（filtering bug → 跨租户泄漏）。
4. **三个能跑的 demo**：
   - `metadata_filter_demo.py`：一个 ChromaDB collection 装所有团队的文档，对比"不过滤"和"按 team / team+doc_type 过滤"的检索结果差异。
   - `multi_tenancy_demo.py`：设计 A = 共享 collection + `tenant_id` 过滤（含一次故意不加过滤的泄漏演示）；设计 B = 一租户一 collection。
   - **Langfuse 本地自托管**：用官方 docker compose 起 `langfuse-web / langfuse-worker / postgres / clickhouse / redis / minio`，浏览器打开 `localhost:3000`，建项目、拿 API key，再用 LangChain callback handler 把一次 LLM 调用上报上去。

一句话总结这一节的定位：**前半段是"面试里怎么说"，后半段是"本机怎么跑"。**

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

**关于缓存的分层与"可恢复性也是缓存"：**

> "prompt caching 是谁在负责？是模型在负责。有时候我们会做 embedding 去算相似度，那么在创建 embedding 的时候，你同样可以把 embedding 缓存起来。"
> —— p013 [68:08]

> "你还记得在 planning 里我们加了可恢复性（resumability）吗？我们是怎么加的？我们在 SQLite 里加了一张 task 表，保证能从那里恢复。这其实也是一种缓存，因为我们把状态存下来了。任何不需要重复做的事情，如果我必须从头再做一遍规划，那就说明我没有缓存住、我把它丢了。"
> —— p013 [69:04]

**关于"错误数据进缓存"的严重后果：**

> "假设我们做了一次工具调用，拿到了一次错误的响应。比如我可以用 web search 作为一种工具调用，我拿到一个错误答案，然后我把它加进缓存，这可行吗？后果是什么？所有相似的查询都会发生什么？我们会命中缓存，然后把错误的响应发出去。你理解把错误数据加进缓存的后果了吗？"
> —— p013 [70:31]

> "用户根本不知道你是从缓存里返回的。"
> —— p013 [71:51]

> "在生产里如果发生这种情况，你怎么发现？你会看到答案的相关性、忠实度（faithfulness）在下降，会看到很多答案是不对的。然后你会发现，哦，这些答案是从缓存来的，所以延迟非常低。于是你会以为系统表现很好，因为延迟很低——但客户在给负反馈，答案是错的。所以系统好不好不是单一指标，你不能因为延迟低就说系统表现很好。"
> —— p013 [72:20]

> "在讨论延迟的时候，你必须谈缓存。"
> —— p013 [72:49]

**关于规模变大意味着什么：**

> "edu courses cloud 现在是跑在我们本地系统上的，我需要担心多个用户同时用吗？需要担心扩展吗？就 edu courses cloud 本身而言不需要，但我们应该有能力处理任何项目。"
> —— p013 [74:40]

> "当我说项目规模变大了，我马上会指两件事。第一是数据变多了：以前 chunk 是 100 个、500 个，现在我有几百万份文档、几十亿个 chunk。那意味着我能把它们放在一个向量库里吗？一个 DB 实例不够，所以 sharding（分片）就登场了。"
> —— p013 [75:39]

> "第二个可能是查询层面：我每秒收到的请求变多了。以前是每秒 5 个请求，现在变成每秒 5000 个、10000 个请求，我怎么处理？"
> —— p013 [76:07]

**关于分片键与散-聚问题：**

> "如果我要分析某个时间范围内的所有日志，那我按时间分片合理吗？如果我的查询大多是这样，那我就应该按时间分片。再比如按地理区域分片：某个区域的客户查询特别多，那我就先按地理过滤，我知道我只需要在 2 个或 3 个分片里搜，而不是在 5、6 个数据库里搜。还有语义分片：查询是关于产品开发的、还是关于 SRE 的，可以按查询类型来分。"
> —— p013 [78:55]

> "在任何系统设计里，答案永远是'取决于你的用例'。"
> —— p013 [78:26]

> "分片的一个大问题是：有时我会在多个分片里搜索。分片 1 花 5 秒、分片 2 花 3 秒、分片 3 花 4 秒、分片 4 花 8 秒——即使我并行去搜，整体最少也要 8 秒，这就是最慢的那个分片，我对它的依赖非常重。然后我还要合并结果、组织响应再发出去，所以会花 8 秒以上。这个是有名字的，叫 Scatter Gather 问题：先把查询散布到多个分片，再把响应聚合回来。"
> —— p013 [81:39]

> "如果某个分片拿到了所有 auth 相关查询，另一个拿到所有 payment 相关查询，而最近大部分查询都是 auth，那 S1 就是瓶颈、就是最慢的分片。你能做什么？你可以优化慢分片的响应，可以给慢分片加缓存，还可以复制你的热分片（hot shard）——拿到最多请求的那些分片。如果这个分片请求多，我可能有 4 个副本；那个分片请求少，我可能只有 2 个或 1 个副本。"
> —— p013 [83:30]

**关于"系统慢不要直接说缓存"，要先 profiling：**

> "你的系统慢，你不要直接说缓存。系统慢在哪儿？你要看系统里有多个部分，哪一部分更耗时。系统里有 embedding、有 retrieval、检索之后可能还有 re-ranking、然后是 LLM 生成——那你就去分析这一步花了多少时间、那一步花了多少时间。这就叫 profiling。永远给出结构化的回答：如果 RAG 效果不好，你首先要判断问题出在检索还是生成，因为检索的评测指标和生成的评测指标是不一样的。不要直接跳到通用方案，没有一招通吃的解。"
> —— p013 [86:17]

**关于多租户：**

> "tenant 就是个花哨的说法，指的就是多个客户。我们现在 edu courses cloud 只服务一个客户，但如果我们同时有多个客户，该怎么办？"
> —— p013 [88:10]

> "一个可能的方案是一个租户一个 collection。它的优缺点是什么？如果客户特别多还行吗？当然不行，它不可扩展。但租户很少的时候它非常好用——比如我只服务五六个公司，那每个租户一个 collection 是合理的。而且它有一个很大的好处：跨租户泄漏（cross tenant leakage）的风险是零。"
> —— p013 [91:03]

> "如果租户很多，我就不能一租户一 collection 了。那怎么办？那就共享租户（共享 collection），这时候我会做 metadata filtering。但 metadata filtering 有一个问题：有可能发生跨租户泄漏——如果你的过滤有 bug，过滤 bug 就会导致跨租户泄漏。当规模上去、有上百万客户时你别无选择，只能这么做，所以你必须保证你的 metadata 过滤做得极其可靠。"
> —— p013 [93:50]

> "另一个办法是 namespace 隔离，但不是所有数据库都有 namespace。有些数据库有，我记得 Chroma 没有。你可以在一个 namespace 里放不同的 collection。"
> —— p013 [95:18]

> "如果某个租户用了非常多数据，就把他挪到独立的 DB server 上。如果我只跟两三个组织合作——比如 Google、Uber、Microsoft——那我完全可以让 Google 用独立的集群、独立的 DB，但这不是常态。"
> —— p013 [96:16]

> "metadata filtering 的本质是：先做过滤，再做查询。假设有 10 个文档，你先加上'team 是这个'的过滤，那你现在只在 2 个文档里查询。如果有 100 万份文档，你加上'我只查这个 team'，就自动从 100 万降到 1 万，因为它多了一层过滤。这对检索响应时间有巨大提升。"
> —— p013 [101:01]

> "在多租户这件事上没有唯一的解法。你必须考虑租户数量、你有的数据类型、会来的查询类型。"
> —— p013 [104:40]

**关于 Langfuse 本地可观测性：**

> "我们一直用 LangSmith 做 tracing。之前讲到 guardrails、讲到 PII 的时候有人问：如果我不想把数据发到 LangSmith 呢？我们能不能在本地做 tracing？完全可以，我说过我们会看 Langfuse。它非常简单，而且它是开源的，可以用 docker 自托管。"
> —— p013 [108:29]

> "LangSmith 是付费的，Langfuse 不是。Langfuse 跑在你本地，是免费的、开源的。"
> —— p013 [109:49]

> "在 LangChain 里集成非常简单：安装依赖、创建一个 client、创建 handler，调用的时候把 handler 传进去，就这么简单。"
> —— p013 [116:54]

**关于缓存误用与面试表达：**

> "如果多个人都在问'他是谁'，我们说的是谁？我们不应该区分这类查询。一个办法是在一开始做 query classification 的时候处理掉：在这类查询上我们就不应该用缓存。像 he、him、who 这些填充词，或者依赖上一轮对话上下文的查询，都可以在查询分类阶段处理。"
> —— p013 [123:02]

> "在面试里，比起技术知识，更关键的是你能不能展示出来。很多人技术很懂，但说不出来、解释不清楚，或者因为害怕、不自信、没做过 mock interview 而说不到点上。给自己设个 45 分钟的计时器，大声讲出来，像在面试一样把整个系统画出来。"
> —— p013 [127:39]

---

## 3. 从零复现

下面按"先跑检索 demo，再起可观测性栈"的顺序来。全部命令在 macOS / Linux 上验证，Windows 用 WSL2 或 Git Bash（`source` 换成 `.`）。

### 3.1 目录结构（先建好）

```bash
mkdir -p ~/agentic-p013 && cd ~/agentic-p013
mkdir -p langfuse langfuse_demo
tree -L 2
# ~/agentic-p013
# ├── requirements.txt
# ├── metadata_filter_demo.py
# ├── multi_tenancy_demo.py
# ├── langfuse/
# │   └── docker-compose.yml
# └── langfuse_demo/
#     ├── .env
#     ├── requirements.txt
#     └── demo.py
```

### 3.2 建 Python 环境并装依赖

```bash
cd ~/agentic-p013
python3 --version          # 建议 3.10 / 3.11
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

`requirements.txt` 见第 4 节。**版本号课里没讲**，只写了包名；如果装到最新版出现 API 差异，按第 7 节的"版本漂移"处理。

### 3.3 跑 metadata filtering demo

```bash
python metadata_filter_demo.py
```

这个脚本干四件事：

1. 在 `./chroma_metadata_demo` 建一个持久化目录，创建（或复用）collection `devbot_knowledge_base`；
2. 写入 10 篇"工程组织知识库"文档，每篇带 `team / doc_type / year / runbook / confidentiality` 五个元数据字段。team 取值是 `sre`、`payments`、`mobile`、`data-infra`，doc_type 取值是 `adr`、`postmortem`、`api-reference`、`runbook`；
3. 用同一个查询 "How do I roll back a bad deployment?" 跑四次：无过滤、`team=sre`、`team in [sre, payments]`、`team=payments AND doc_type=postmortem`；
4. 打印每次命中的 id / team / doc_type / 正文，让你直观看到：**无过滤时 4 条结果里混进了 payments、mobile 的文档；加上 `team=sre` 之后，虽然要求返回 4 条，但库里 SRE 文档只有 2 篇，所以只返回 2 条，不会再"顺手"去翻别的团队。**

这就是讲师强调的那句话的落地：过滤发生在查询之前，`1,000,000 → 10,000`。

### 3.4 跑多租户 demo

```bash
python multi_tenancy_demo.py
```

脚本跑四种情况：

| 场景 | collection | 查询条件 | 预期观察 |
|---|---|---|---|
| A-1 无过滤（泄漏演示） | `shared_knowledge_base` | 无 | tenant_b 的内容会出现在 tenant_a 的查询结果里 |
| A-2 正确过滤 | `shared_knowledge_base` | `tenant_id == "tenant_a"` | 只返回 tenant_a 的内容 |
| B-1 tenant_a | `tenant_a_knowledge_base` | 无（collection 已隔离） | 只返回 tenant_a 的内容 |
| B-2 tenant_b | `tenant_b_knowledge_base` | 无（collection 已隔离） | 只返回 tenant_b 的内容 |

讲师原话的意思是：设计 A 只要过滤写对了就不泄漏，写错了就泄漏；设计 B 在结构上不可能泄漏，因为你连"别的租户的词向量"都碰不到。

### 3.5 起 Langfuse 自托管栈

```bash
cd ~/agentic-p013/langfuse
# 把第 4 节的 docker-compose.yml 保存到当前目录
docker compose up -d
docker compose ps
```

**这里有个必须提前处理的坑**：讲师在自己的机器上就撞到了——本地已经有一个 Redis 跑在 6379 上，Langfuse 的 compose 里也要起 Redis，于是报端口/名称冲突，容器起不来。讲师的处理是"先把原来那个 Redis 停掉/删掉"。

```bash
# 如果本机已有 Redis 占用端口
docker ps | grep -i redis
docker stop <那个容器名>
# 或者用第 7 节里的"换端口"方案
docker compose up -d
```

起来之后 `docker compose ps` 里应该能看到这些服务：`redis`、`postgres`、`clickhouse`、`minio`、`langfuse-worker`、`langfuse-web`。讲师形容的是"全部 healthy，一切正常"。

### 3.6 在 Langfuse UI 里建组织、项目和 API key

1. 浏览器打开 `http://localhost:3000`；
2. 首次进入是空的组织列表（讲师现场是从零开始，所以显示"没有任何 organization"）→ 新建组织（讲师起名 `edu courses`）；
3. 新建 project（讲师起名类似 "agentic system design"）；
4. 进 project → Settings → API Keys → Create new API key；
5. 复制 **Public Key** 和 **Secret Key**。注意 secret key 只显示一次。

### 3.7 写 `.env` 并跑 demo

```bash
cd ~/agentic-p013/langfuse_demo
cp .env.example .env      # 或者直接创建 .env
# 编辑 .env，填入上面复制的 key 和你的 OpenAI key
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python demo.py
```

`demo.py` 会做一次 LangChain + OpenAI 的普通问答（讲师当时问的是 "Who is Dhoni?"），并且在 `invoke` 时把 Langfuse 的 callback handler 传进去。

跑完后回到 `http://localhost:3000` → 左侧 **Tracing**，能看到一条 trace：里面有你的 prompt 内容、模型的输出、花了多少 token、多少美元、多少秒。讲师当场说："和 LangSmith 看起来非常像，但它是跑在你本地的。"

### 3.8 顺序上的依赖关系

```
requirements.txt ──► venv ──► metadata_filter_demo.py ──► chroma_metadata_demo/ (本地持久化)
                          └──► multi_tenancy_demo.py   ──► chroma_multitenancy_demo/

docker-compose.yml ──► docker compose up -d ──► localhost:3000 (UI)
                                        │
                                        ├─► 建 org / project / API key
                                        └─► .env ──► demo.py ──► Tracing 页面
```

两个 Chroma demo 和 Langfuse 栈**互不依赖**，可以先跑任意一个。

---

## 4. 完整代码

> 再次说明：以下文件均按讲师在 p013 屏幕上演示的行为重建，可保存即跑。**课里没有贴出原始文件内容**，所以 embedding 模型、包版本等细节属于我的补齐，在文中已标注。

### 4.1 `requirements.txt`（根目录）

```txt
# p013 检索相关 demo 的依赖
# 注意：课里没有讲版本号，这里不锁版本
chromadb
python-dotenv
```

### 4.2 `metadata_filter_demo.py`（完整文件）

```python
"""
metadata_filter_demo.py
复现 p013 [100:54]–[104:11] 的演示：
一个 ChromaDB collection 装下所有团队的文档，对比「无过滤」与「按 metadata 过滤」的检索结果。

运行：
    python metadata_filter_demo.py
"""

import chromadb

PERSIST_DIR = "./chroma_metadata_demo"
COLLECTION_NAME = "devbot_knowledge_base"
QUESTION = "How do I roll back a bad deployment?"

# 说明：课里展示的是「工程组织知识库」：ADRs、postmortems、API references、runbooks，
# 元数据包含 team / doc_type / year / runbook / confidentiality。
# 具体文案是复现用的示例数据。
DOCUMENTS = [
    {
        "id": "doc-adr-001",
        "text": "ADR-014: 为什么把会话状态从 Redis 迁到 Postgres。"
                "决策：会话状态落 Postgres，Redis 只保留热点缓存；回滚方案是灰度切回旧读路径。",
        "metadata": {"team": "sre", "doc_type": "adr", "year": 2024,
                     "runbook": False, "confidentiality": "internal"},
    },
    {
        "id": "doc-runbook-001",
        "text": "SRE Runbook: 回滚一次坏部署。"
                "步骤：1) kubectl rollout undo deployment/<name>；2) 观察 5xx 与 P99；"
                "3) 确认健康检查通过；4) 再逐步放开流量。",
        "metadata": {"team": "sre", "doc_type": "runbook", "year": 2025,
                     "runbook": True, "confidentiality": "internal"},
    },
    {
        "id": "doc-postmortem-001",
        "text": "Postmortem: 支付网关 5xx 飙升 30 分钟。"
                "根因是上游重试风暴，修复方式是加指数退避与熔断；影响 1.2 万笔交易。",
        "metadata": {"team": "payments", "doc_type": "postmortem", "year": 2025,
                     "runbook": False, "confidentiality": "confidential"},
    },
    {
        "id": "doc-api-001",
        "text": "Payments API Reference: POST /v1/charges 创建扣款，"
                "必须带 idempotency-key 头，超时 3 秒，余额不足返回 402。",
        "metadata": {"team": "payments", "doc_type": "api-reference", "year": 2024,
                     "runbook": False, "confidentiality": "internal"},
    },
    {
        "id": "doc-postmortem-002",
        "text": "Postmortem: 一次错误的配置推送导致回滚窗口延长。"
                "教训是把回滚脚本纳入 CI 校验，配置变更也要有 canary。",
        "metadata": {"team": "payments", "doc_type": "postmortem", "year": 2024,
                     "runbook": False, "confidentiality": "confidential"},
    },
    {
        "id": "doc-runbook-002",
        "text": "Mobile Runbook: 线上崩溃率突增时的处置。"
                "先看 Crashlytics 分版本聚合，再决定是否发 hotfix 或回滚上一个 release。",
        "metadata": {"team": "mobile", "doc_type": "runbook", "year": 2025,
                     "runbook": True, "confidentiality": "internal"},
    },
    {
        "id": "doc-adr-002",
        "text": "ADR-021: 移动端灰度发布策略。"
                "决策：按用户哈希分桶 1% → 5% → 20% → 100%，每档观察 24 小时。",
        "metadata": {"team": "mobile", "doc_type": "adr", "year": 2025,
                     "runbook": False, "confidentiality": "internal"},
    },
    {
        "id": "doc-runbook-003",
        "text": "Data Infra Runbook: 回溯任务失败后的重跑。"
                "先确认上游分区是否就绪，再用 backfill 工具按天重跑，避免全量重刷。",
        "metadata": {"team": "data-infra", "doc_type": "runbook", "year": 2024,
                     "runbook": True, "confidentiality": "internal"},
    },
    {
        "id": "doc-api-002",
        "text": "Data Infra API Reference: /v2/backfill 触发回溯任务，"
                "参数 partition_date，单次最多 7 天，重复提交会返回 409。",
        "metadata": {"team": "data-infra", "doc_type": "api-reference", "year": 2024,
                     "runbook": False, "confidentiality": "internal"},
    },
    {
        "id": "doc-postmortem-003",
        "text": "Postmortem: 部署流水线卡死 40 分钟。"
                "根因是构建缓存目录权限错误，回滚流水线版本后恢复。",
        "metadata": {"team": "sre", "doc_type": "postmortem", "year": 2024,
                     "runbook": False, "confidentiality": "internal"},
    },
]


def build_collection() -> "chromadb.api.models.Collection.Collection":
    """创建（或复用）collection 并写入示例文档。"""
    client = chromadb.PersistentClient(path=PERSIST_DIR)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    if collection.count() == 0:
        collection.add(
            ids=[d["id"] for d in DOCUMENTS],
            documents=[d["text"] for d in DOCUMENTS],
            metadatas=[d["metadata"] for d in DOCUMENTS],
        )
        print(f"[init] 写入 {len(DOCUMENTS)} 篇文档到 collection={COLLECTION_NAME}")
    else:
        print(f"[init] collection 已存在，跳过写入（当前 {collection.count()} 篇）")

    return collection


def run_query(collection, title: str, where: dict | None, n_results: int = 4) -> None:
    """执行一次查询并打印结果。where=None 表示不加任何 metadata 过滤。"""
    print("\n" + "=" * 78)
    print(f"场景：{title}")
    print(f"查询：{QUESTION}")
    print(f"where={where}  n_results={n_results}")

    result = collection.query(
        query_texts=[QUESTION],
        n_results=n_results,
        where=where,
    )

    ids = result["ids"][0]
    docs = result["documents"][0]
    metas = result["metadatas"][0]

    if not ids:
        print("  （无命中）")
        return

    print(f"命中 {len(ids)} 条：")
    for i, (doc_id, doc, meta) in enumerate(zip(ids, docs, metas), start=1):
        print(f"  [{i}] id={doc_id}")
        print(f"      team={meta.get('team')}  doc_type={meta.get('doc_type')}  "
              f"year={meta.get('year')}  confidentiality={meta.get('confidentiality')}")
        print(f"      {doc}")


def main() -> None:
    collection = build_collection()

    # 1) 不加任何过滤：结果会横跨多个团队
    run_query(collection, "无 metadata 过滤（对照基线）", where=None)

    # 2) 只查 SRE：库里 SRE 文档只有 3 篇，但请求要 4 条
    run_query(collection, "只查 team=sre", where={"team": "sre"})

    # 3) 用户同时有多个团队的权限
    run_query(
        collection,
        "用户可访问 team in [sre, payments]",
        where={"team": {"$in": ["sre", "payments"]}},
    )

    # 4) 用户只能看 payments 团队的 postmortem，看不到 API 文档和 ADR
    run_query(
        collection,
        "team=payments 且 doc_type=postmortem",
        where={
            "$and": [
                {"team": {"$eq": "payments"}},
                {"doc_type": {"$eq": "postmortem"}},
            ]
        },
    )

    # 5) 再叠加一层：只要 runbook
    run_query(
        collection,
        "只查 runbook=True 的文档",
        where={"runbook": {"$eq": True}},
    )


if __name__ == "__main__":
    main()
```

### 4.3 `multi_tenancy_demo.py`（完整文件）

```python
"""
multi_tenancy_demo.py
复现 p013 [104:40]–[107:04] 的多租户演示，两种设计并排对比：

设计 A：共享 collection + tenant_id metadata filtering
        —— 成本低、可扩展，但过滤写错就会跨租户泄漏
设计 B：一租户一 collection（collection per tenant）
        —— 结构上不可能泄漏，但租户数量一多就不可维护

运行：
    python multi_tenancy_demo.py
"""

import chromadb

PERSIST_DIR = "./chroma_multitenancy_demo"
SHARED_COLLECTION = "shared_knowledge_base"
QUESTION = "How does checkout retry work when the payment provider times out?"

# 说明：课里演示的是 checkout 文档和 payment 文档，分属两个租户。
# 文本内容为复现用示例。
TENANT_DOCS = {
    "tenant_a": [
        {
            "id": "a-checkout-001",
            "text": "Checkout 流程：下单 → 预授权 → 扣款 → 发货。"
                    "支付渠道超时（3 秒）时进入重试队列，最多重试 2 次，指数退避 1s/2s。",
            "doc_type": "design",
        },
        {
            "id": "a-payment-001",
            "text": "Payment 重试策略：只有网络超时和 5xx 会重试，"
                    "4xx（余额不足、卡被拒）一律不重试，直接返回给用户。",
            "doc_type": "design",
        },
    ],
    "tenant_b": [
        {
            "id": "b-checkout-001",
            "text": "Tenant B 的 Checkout：先做风控评分，再走支付；"
                    "支付渠道超时后进入死信队列，由人工工单处理，不做自动重试。",
            "doc_type": "design",
        },
        {
            "id": "b-payment-001",
            "text": "Tenant B 的 Payment 约定：所有扣款必须带商户自定义幂等键，"
                    "重复提交返回同一笔交易号。",
            "doc_type": "design",
        },
    ],
}


def make_client() -> "chromadb.ClientAPI":
    return chromadb.PersistentClient(path=PERSIST_DIR)


def build_shared_collection(client) -> "chromadb.api.models.Collection.Collection":
    """设计 A：一个 collection 装所有租户的文档，靠 metadata 里的 tenant_id 区分。"""
    collection = client.get_or_create_collection(
        name=SHARED_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    if collection.count() == 0:
        ids, texts, metas = [], [], []
        for tenant_id, docs in TENANT_DOCS.items():
            for d in docs:
                ids.append(d["id"])
                texts.append(d["text"])
                metas.append({"tenant_id": tenant_id, "doc_type": d["doc_type"]})
        collection.add(ids=ids, documents=texts, metadatas=metas)
        print(f"[A] 共享 collection 写入 {len(ids)} 篇文档")
    else:
        print(f"[A] 共享 collection 已存在（{collection.count()} 篇）")

    return collection


def build_per_tenant_collections(client) -> dict:
    """设计 B：每个租户一个 collection。"""
    collections = {}
    for tenant_id, docs in TENANT_DOCS.items():
        name = f"{tenant_id}_knowledge_base"
        collection = client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )
        if collection.count() == 0:
            collection.add(
                ids=[d["id"] for d in docs],
                documents=[d["text"] for d in docs],
                metadatas=[{"doc_type": d["doc_type"]} for d in docs],
            )
            print(f"[B] {name} 写入 {len(docs)} 篇文档")
        else:
            print(f"[B] {name} 已存在（{collection.count()} 篇）")
        collections[tenant_id] = collection
    return collections


def print_result(title: str, result: dict, expect_tenant: str | None = None) -> None:
    print("\n" + "-" * 78)
    print(f"{title}")

    ids = result["ids"][0]
    docs = result["documents"][0]
    metas = result["metadatas"][0]

    if not ids:
        print("  （无命中）")
        return

    leaked = []
    for doc_id, doc, meta in zip(ids, docs, metas):
        tenant_id = meta.get("tenant_id", "(collection 级隔离)")
        print(f"  id={doc_id}  tenant_id={tenant_id}")
        print(f"    {doc}")
        if expect_tenant and meta.get("tenant_id") not in (None, expect_tenant):
            leaked.append(doc_id)

    if leaked:
        print(f"  ⚠️  跨租户泄漏：{leaked}")
    elif expect_tenant:
        print(f"  ✅ 未发现跨租户泄漏（期望租户 = {expect_tenant}）")


def main() -> None:
    client = make_client()
    shared = build_shared_collection(client)
    per_tenant = build_per_tenant_collections(client)

    # ---- 设计 A-1：共享 collection，但忘记加租户过滤（泄漏演示）----
    result = shared.query(query_texts=[QUESTION], n_results=4)
    print_result(
        "设计 A-1：共享 collection + 未加 tenant_id 过滤（错误写法）",
        result,
        expect_tenant="tenant_a",
    )

    # ---- 设计 A-2：共享 collection + 正确的租户过滤 ----
    result = shared.query(
        query_texts=[QUESTION],
        n_results=4,
        where={"tenant_id": {"$eq": "tenant_a"}},
    )
    print_result(
        "设计 A-2：共享 collection + where tenant_id=tenant_a（正确写法）",
        result,
        expect_tenant="tenant_a",
    )

    # ---- 设计 B：直接进入该租户的 collection ----
    result_a = per_tenant["tenant_a"].query(query_texts=[QUESTION], n_results=4)
    print_result("设计 B-1：tenant_a_knowledge_base（collection 级隔离）", result_a)

    result_b = per_tenant["tenant_b"].query(query_texts=[QUESTION], n_results=4)
    print_result("设计 B-2：tenant_b_knowledge_base（collection 级隔离）", result_b)

    print("\n" + "=" * 78)
    print("结论：A 的成本低、可扩展，但安全性完全押在过滤条件上；")
    print("      B 结构上不可能泄漏，但租户数量一多，collection 数量会失控。")


if __name__ == "__main__":
    main()
```

### 4.4 `langfuse/docker-compose.yml`（完整文件）

> 讲师的做法是"直接从 Langfuse 官方文档复制 docker compose"。下面是按官方 compose 的结构整理的一份可运行文件。**具体的 image tag、变量名以你复制那一刻的官方文档为准**（Langfuse 迭代较快），课里没有念出任何一行配置。

```yaml
# langfuse/docker-compose.yml
# 本地自托管 Langfuse 最小栈：web + worker + postgres + clickhouse + redis + minio
# 使用前：确认本机 3000 / 6379 / 5432 / 8123 / 9000 / 9090 端口未被占用

services:
  langfuse-worker:
    image: docker.io/langfuse/langfuse-worker:3
    restart: always
    depends_on: &langfuse-depends-on
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    ports:
      - "127.0.0.1:3030:3030"
    environment: &langfuse-env
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres
      SALT: "change-me-salt"
      ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
      TELEMETRY_ENABLED: "true"
      LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "false"
      CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: clickhouse
      CLICKHOUSE_PASSWORD: clickhouse
      CLICKHOUSE_CLUSTER_ENABLED: "false"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_AUTH: myredissecret
      REDIS_TLS_ENABLED: "false"
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: minio
      MINIO_SECRET_KEY: miniosecret
      MINIO_BUCKET: langfuse
      MINIO_REGION: us-east-1
      MINIO_FORCE_PATH_STYLE: "true"
      LANGFUSE_S3_EVENT_UPLOAD_BUCKET: langfuse
      LANGFUSE_S3_EVENT_UPLOAD_REGION: us-east-1
      LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID: minio
      LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY: miniosecret

  langfuse-web:
    image: docker.io/langfuse/langfuse:3
    restart: always
    depends_on: *langfuse-depends-on
    ports:
      - "3000:3000"
    environment:
      <<: *langfuse-env
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: "change-me-nextauth-secret"
      # 首次启动时用于创建初始账号（以官方文档说明为准）
      LANGFUSE_INIT_ORG_ID: "edu-courses"
      LANGFUSE_INIT_ORG_NAME: "edu courses"
      LANGFUSE_INIT_PROJECT_ID: "agentic-system-design"
      LANGFUSE_INIT_PROJECT_NAME: "agentic system design"
      LANGFUSE_INIT_USER_EMAIL: "admin@local.dev"
      LANGFUSE_INIT_USER_NAME: "admin"
      LANGFUSE_INIT_USER_PASSWORD: "changeme123"

  postgres:
    image: docker.io/postgres:16
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  clickhouse:
    image: docker.io/clickhouse/clickhouse-server:24
    restart: always
    user: "101:101"
    environment:
      CLICKHOUSE_DB: default
      CLICKHOUSE_USER: clickhouse
      CLICKHOUSE_PASSWORD: clickhouse
    ports:
      - "127.0.0.1:8123:8123"
      - "127.0.0.1:9000:9000"
    volumes:
      - ./data/clickhouse:/var/lib/clickhouse
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: docker.io/redis:7
    restart: always
    command: ["redis-server", "--requirepass", "myredissecret", "--maxmemory", "256mb"]
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a myredissecret ping | grep PONG"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: docker.io/minio/minio
    restart: always
    entrypoint: sh
    command: -c "mkdir -p /data/langfuse && minio server --address ':9000' --console-address ':9001' /data"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: miniosecret
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    volumes:
      - ./data/minio:/data
    healthcheck:
      test: ["CMD-SHELL", "mc ready local || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
```

### 4.5 `langfuse_demo/requirements.txt`

```txt
# Langfuse + LangChain 演示依赖
# 课里没有讲版本号；langfuse 3.x 与 2.x 的 import 路径不同，demo.py 里做了兼容
langchain
langchain-openai
langfuse
python-dotenv
```

### 4.6 `langfuse_demo/.env.example`

```dotenv
# ---- Langfuse（值来自 http://localhost:3000 → 你的 project → Settings → API Keys）----
# 变量名以你安装的 langfuse SDK 文档为准；课里没有念出变量名
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_HOST=http://localhost:3000

# ---- OpenAI ----
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

### 4.7 `langfuse_demo/demo.py`

```python
"""
demo.py
复现 p013 [116:54]–[119:46]：在 LangChain 里接入 Langfuse，把一次 LLM 调用上报到本地 Langfuse。

讲师的原话是「装依赖 → 创建 client → 创建 handler → invoke 时把 handler 传进去」，
代码基本是从官方文档直接复制过来的。

运行：
    python demo.py
"""

import os

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

# Langfuse 3.x 与 2.x 的 CallbackHandler 导入路径不同。
# 这一段 try/except 是为了兼容两个大版本（讲师是直接复制官方文档当前版本的那一行）。
try:
    from langfuse.langchain import CallbackHandler  # langfuse >= 3
except ImportError:  # pragma: no cover
    from langfuse.callback import CallbackHandler    # langfuse 2.x

load_dotenv()


def build_chain() -> "Runnable":
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "你是一个简洁的中文助手，回答控制在三句话以内。"),
            ("human", "{question}"),
        ]
    )
    llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    return prompt | llm


def main() -> None:
    # 1) 创建 handler：它会从环境变量读取 LANGFUSE_PUBLIC_KEY / SECRET_KEY / HOST
    handler = CallbackHandler()

    # 2) 组装 chain
    chain = build_chain()

    # 3) 调用时把 handler 传进去（关键的一步）
    question = "Who is Dhoni?"
    answer = chain.invoke({"question": question}, config={"callbacks": [handler]})

    print("=" * 60)
    print(f"Q: {question}")
    print(f"A: {answer.content}")
    print("=" * 60)
    print("去 http://localhost:3000 → Tracing 查看这次调用。")

    # 4) 确保上报缓冲被刷出去（进程马上退出时尤其需要）
    flush = getattr(handler, "flush", None)
    if callable(flush):
        flush()


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 `metadata_filter_demo.py`

- `chromadb.PersistentClient(path="./chroma_metadata
Client(path="./chroma_metadata_demo")` 这一行开始。

### 5.1 `metadata_filter_demo.py`（续）

- `chromadb.PersistentClient(path="./chroma_metadata_demo")`：把向量库落到本地磁盘目录。换成 `chromadb.Client()` 就是纯内存，进程一退全丢。**为什么用持久化**：demo 要反复跑，第二次跑时能直接复用已建好的 collection，不需要重新写 10 篇文档，这也顺带演示了"collection 是长期存在的资源，不是一个函数里的局部变量"。在 Node 里最接近的类比是 `new PrismaClient()` 连一个已经存在的数据库文件（SQLite），而不是每次请求都新建一个内存数组。
- `client.get_or_create_collection(name=..., metadata={"hnsw:space": "cosine"})`：`get_or_create` 的语义是"有就取、没有就建"，因此脚本天然幂等。`metadata={"hnsw:space": "cosine"}` 指定 HNSW 索引用余弦距离。**这部分课里没讲**——讲师只说了"我们在 ChromaDB 里建一个 collection"，没有讲索引参数。如果你不写这一项，Chroma 会用默认距离度量，检索结果的排序会和你预期不同，但不影响"过滤前后结果集差异"这个演示结论。
- `if collection.count() == 0:` 这个判断是幂等的关键。`collection.count()` 返回当前 collection 里的向量条数。没有这个判断，第二次运行 `add()` 会因 id 重复而报错（`ids` 是主键）。
- `collection.add(ids=[...], documents=[...], metadatas=[...])`：三个列表**必须等长且下标一一对应**，这是 Chroma 的硬约束。`documents` 传的是原文，Chroma 内部会用默认 embedding 函数把它转成向量；`metadatas` 是你要过滤的字段。**关键点**：`metadatas` 里的值只支持字符串、数字、布尔这类标量，不支持嵌套对象——这一点课里没讲，但你如果塞一个 dict 进去会直接报错，所以我在示例里把五个字段全部拍平。
- `run_query(collection, title, where, n_results=4)`：把"查询 + 打印"封成一个函数，目的就是让四种过滤条件并排对比，输出的结构完全一致，方便你肉眼 diff。
- `collection.query(query_texts=[QUESTION], n_results=n_results, where=where)`：注意 `query_texts` 和 `n_results` 都是列表/标量混用的形式——`query_texts` 是 list（支持一次传多个查询），返回的 `result["ids"]` 因此是**二维列表**，第一维对应每个 query，第二维对应命中的文档。所以后面必须写 `result["ids"][0]`。这是新手最常见的 index 错误来源。
- `where=None`：不加任何过滤，等价于"全库 top-k"。这就是讲师说的那条对照基线。
- `where={"team": "sre"}`：Chroma 的简写形式，等价于 `{"team": {"$eq": "sre"}}`。这一行是整个 demo 的核心——它在**向量检索之前**就把候选集从 10 篇砍到 3 篇。讲师的原话是"从 100 万自动降到 1 万，因为它多了一层过滤"，机制就写在这一行里。
- `where={"team": {"$in": ["sre", "payments"]}}`：多团队权限。对应讲师说的"某个开发者可以访问 payments，但不能访问架构文档"，也就是**权限决定过滤条件，过滤条件决定检索范围**。
- `where={"$and": [{"team": {"$eq": "payments"}}, {"doc_type": {"$eq": "postmortem"}}]}`：两个条件同时成立。这里就是讲师举的那个具体场景——"用户只能看 payments 的 postmortem，看不到 API 文档"。**注意**：Chroma 的 `$and` 要求显式写出操作符对象，不能写成 `{"$and": [{"team": "payments"}, ...]}` 这种简写混用，具体限制以你装的版本为准。
- `where={"runbook": {"$eq": True}}`：布尔字段过滤。这一条展示了"文档类型分级"也能当成过滤维度——runbook 是可以给值班同学看的，ADR 是给架构组看的，confidentiality 是另一个维度。
- 输出里特意打印 `team / doc_type / year / confidentiality` 而不是只打印正文，是为了让你一眼看出"这条结果到底属于谁"。讲师演示时说的"你看它在 SRE 里搜、也在 payments 里搜、也在 mobile 里搜"，就是靠这个打印看出来的。
- **SRE 只有 3 篇文档，但请求 `n_results=4` 时只返回 3 条**——这正是讲师原话里那句"虽然我说给我 4 条结果，但因为文档里只有 2 篇 SRE 相关的，它根本不会去翻剩下的文档"的复现。这一点非常重要：过滤是**先缩小候选集再算相似度**，不是"先算全库 top-4 再筛掉不合格的"。如果是后者，你会得到 "4 条里剩 1 条" 而不是 "直接返回 3 条"。

![p013 101:01 讲师解释 metadata filtering 是先过滤再查询，能把候选集从百万级直接降到万级](images/p013_6061s.jpg)

- **JS/Node 对照**：如果你在 Node 里用向量库（比如 Supabase pgvector、Pinecone 的 JS SDK），这一整套对应关系是：`collection` ≈ 一张表，`metadatas` ≈ 表里的列，`where` ≈ SQL 的 `WHERE` 子句 / Prisma 里的 `where: { tenantId: 'tenant_a' }`。**唯一不同的是执行顺序保证**：普通 SQL 里 `WHERE` 是优化器自由决定的；向量库里的 metadata filter 通常被保证在 ANN 检索之前或之中生效，否则 top-k 会被不合格数据占满。写代码时要按"过滤一定先生效"来设计，但文档里要说明这个保证是"数据库承诺的"，而不是你自己拼出来的。

### 5.2 `multi_tenancy_demo.py`

- `TENANT_DOCS` 用 dict 组织：外层 key 是 `tenant_id`，内层是文档列表。这个结构本身就是两种设计的对照——设计 A 把这个 dict **拍平**进一个 collection，设计 B 保留外层 key 当 collection 名。
- `build_shared_collection`：遍历 `TENANT_DOCS.items()`，把 `tenant_id` 写进每条 metadata。**这是设计 A 的全部安全机制所在**——安全性不来自数据库结构，而来自"每一行都恰好带着正确的 tenant_id，且每次查询都恰好带上了过滤条件"。
- `build_per_tenant_collections`：collection 名是 `f"{tenant_id}_knowledge_base"`。注意这里的 `metadatas` 只放了 `doc_type`，**没有放 tenant_id**——因为租户身份已经编码在 collection 名里了，属于"结构级隔离"。这个细节是理解两种设计差异的关键：设计 B 里"忘记过滤"这个 bug 类型根本不存在。
- `shared.query(query_texts=[QUESTION], n_results=4)`：**故意不传 `where`**。这一行就是"过滤 bug"的最小复现。讲师的原话是"如果过滤没写对，就有泄漏的可能"，这一行让这句话有了可执行的形式。
- `print_result(..., expect_tenant="tenant_a")`：传了期望租户，函数内部逐条比对 `meta.get("tenant_id")`，只要出现不等于期望值的就追加到 `leaked` 列表并打 ⚠️。**这个"期望值 + 断言"的写法值得抄走**：在多租户系统里，"能查到东西"不是测试通过条件，"只能查到自己的东西"才是。生产里这类检查应该做成自动化测试，而不是靠人眼看输出。
- `print_result` 里 `meta.get("tenant_id", "(collection 级隔离)")`：设计 B 的 metadata 里没有 tenant_id，所以取不到，用默认值兜底。这个 default 是**故意留的痕迹**，它提醒你"这两种设计里租户信息存放的位置不同"。
- `per_tenant["tenant_a"].query(...)`：注意这里完全没有 `where`。设计 B 的正确性来自"你一开始就拿的是 tenant_a 那个 collection 对象"。反过来说，**这个 collection 对象从哪来，就是设计 B 的唯一攻击面**——如果拿 collection 名字的那段代码可以被用户输入影响（比如 `f"{user_input}_knowledge_base"`），那就从"过滤注入"变成了"collection 名注入"，风险反而更大。这一点课里没讲，但你在真实系统里必须防。
- 结尾那段 `print` 是结论落点，对应讲师反复强调的"没有唯一解，取决于租户数量、数据类型、查询类型"。

![p013 92:14 讲师解释 collection 类似 MongoDB 的 collection、SQL 的表，并讨论一租户一 collection 的优缺点](images/p013_5534s.jpg)

- **Java 对照（知道即可）**：如果你看的是 Spring 版本，`collection` 这一层通常被封装成 `VectorStore` 接口，`where` 条件会用一个 `FilterExpression` 构造器链式拼出来，本质和上面写的 `{"$and": [...]}` 是同一个东西，只是换了个 DSL。语法记住"条件树"这个概念就够了。

### 5.3 `docker-compose.yml`

- 整份文件是**一条命令拉起整套依赖**：`docker compose up -d`。讲师原话就是"只有一条命令"。这也回答了他自己踩的那个坑为什么值得讲——一条命令意味着所有服务在同一个网络里、端口必须互不冲突。
- `depends_on: &langfuse-depends-on` + `condition: service_healthy`：YAML 的锚点（`&`）和引用（`*`、`<<:`）。`&langfuse-depends-on` 定义一次，`web` 和 `worker` 都用 `*langfuse-depends-on` 引用，避免复制粘贴出错。**这就是讲师在屏幕上"复制一大段"时你看到的结构**。
- `condition: service_healthy` 而不是默认的"容器启动了就算"：这是关键。ClickHouse、Postgres 从"容器 running"到"真的能接受连接"之间有几十秒差距。如果只等 running，`langfuse-web` 会在启动瞬间连不上数据库然后崩掉。**这一点课里没讲**，但它是本地自托管 Langfuse 最常见的"起来了但打不开"原因。
- `environment: &langfuse-env` + `<<: *langfuse-env`：`web` 和 `worker` 共享一整套环境变量，只有 `NEXTAUTH_*` 是 web 独有的。这样你改数据库密码只需要改一处。
- `DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres`：注意 host 是 `postgres`（service 名），不是 `localhost`。容器之间通过 compose 默认网络的 DNS 互相解析。**这是新手第一大坑**：本地用 `localhost:5432` 能连，容器里写 `localhost` 就指向容器自己。
- `CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000` vs `CLICKHOUSE_URL: http://clickhouse:8123`：Langfuse 对 ClickHouse 用了两个不同的端口——9000 是 native 协议（跑 migration），8123 是 HTTP 协议（跑查询）。两个都必须配，少一个就起不来。
- `SALT` / `ENCRYPTION_KEY` / `NEXTAUTH_SECRET`：这三个是安全密钥。我在文件里填的是占位字符串，**local 环境够用，任何对外暴露的环境都必须换成随机值**。`ENCRYPTION_KEY` 必须是 64 位十六进制字符串，长度不对 Langfuse 会直接启动失败。
- `redis` 服务的 `ports: - "127.0.0.1:6379:6379"`：**这就是讲师撞车的那一行**。绑定在 `127.0.0.1:6379`，如果你本机已经有一个 Redis 占着 6379，这个容器就起不来，报 "port is already allocated" 或"名称冲突"。讲师的处理是"把我原来那个 Redis 停掉/删掉，再重新跑一次"，然后"你可以看到它跑起来了，里面有 Redis、Postgres、ClickHouse、Minio、Langfuse Worker、Langfuse Web"。
- `redis` 的 `--maxmemory 256mb`：限制 Redis 内存。本地跑着玩够用；不限制的话，大量 trace 事件可能把 Redis 撑满进而影响你整台机器。**这一行课里没讲**，是我补的运维保护。
- `minio` 的 `entrypoint: sh` + `command: -c "mkdir -p ... && minio server ..."`：先建 bucket 目录再起服务。Langfuse 用 MinIO 存原始事件（大体量的 trace 明细），S3 兼容接口。`MINIO_FORCE_PATH_STYLE: "true"` 是 MinIO 必须的，AWS S3 才用 virtual-host 风格。
- `volumes: - ./data/postgres:/var/lib/postgresql/data` 这类挂载：把数据放在宿主机 `./data/` 下，`docker compose down` 不删数据，`docker compose down -v` 才会清空。**建议**：第一次跑之前先确认 `./data/` 目录不存在或为空，否则可能因为权限/残留文件起不来。
- `LANGFUSE_INIT_ORG_ID` / `LANGFUSE_INIT_PROJECT_ID` / `LANGFUSE_INIT_USER_EMAIL` 这一组：用于首次启动时自动创建组织、项目和初始用户。**讲师演示时是手动建的**（"我现在没有任何 organization，因为我是从零搭的"→ 新建组织 `edu courses` → 新建项目 → 创建 API key）。这两种方式等价，用 init 变量可以跳过手动步骤。**注意**：这组变量的具体名称和行为**以你复制那一刻的官方文档为准**，Langfuse 版本迭代较快，课里没有念出任何一行配置。
- `langfuse-web` 的 `ports: - "3000:3000"`：所以浏览器打开的是 `localhost:3000`。讲师原话就是"我可以去 localhost 3000"。

![p013 109:48 讲师说明 LangSmith 是付费的、Langfuse 跑在本地且开源，并展示官方文档里的 docker compose](images/p013_6588s.jpg)

### 5.4 `demo.py`

- `try: from langfuse.langchain import CallbackHandler except ImportError: from langfuse.callback import CallbackHandler`：兼容 langfuse 3.x 和 2.x 两个大版本的导入路径差异。**课里没讲这段**——讲师是直接复制官方文档当前版本的那一行。加这个 try/except 是为了让你在没锁版本的情况下也能跑起来。
- `load_dotenv()`：读 `.env`。放在所有 `os.getenv` 之前，否则读到的都是 `None`。
- `ChatPromptTemplate.from_messages([("system", ...), ("human", "{question}")])`：标准的 LCEL 提示模板，`{question}` 是占位符。**保持简单是故意的**——这个 demo 的目的是证明 trace 能上报，不是展示复杂的 agent。
- `ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), temperature=0, api_key=os.getenv("OPENAI_API_KEY"))`：`temperature=0` 让输出可复现，便于你对比"这次 trace 和上次 trace 除了延迟以外是不是一样的"。
- `return prompt | llm`：LCEL 的管道写法。`|` 在 Python 里是重载过的 `__or__`，把 prompt 和 llm 串成 `Runnable`。**JS 对照**：等价于 LangChain.js 里的 `prompt.pipe(llm)`。
- `handler = CallbackHandler()`：**这一行是讲师说的"创建 client、创建 handler"那一步**。它从环境变量里读 `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST`。如果你把变量名拼错了，这里不会报错，只会在调用时静默不上报——**这是最坑的失败模式**，你会在 Tracing 页面看到一个空列表然后怀疑人生。
- `chain.invoke({"question": question}, config={"callbacks": [handler]})`：**整个 demo 的技术核心**。LangChain 的 callback 机制就是观察者模式，`config.callbacks` 传进去的 handler 会收到 `on_llm_start` / `on_llm_end` 等事件，Langfuse 的 handler 把这些事件转成 trace 发到服务端。讲师原话："调用的时候把 handler 传进去，就这么简单。"
- **`config={"callbacks": [...]}` 这个位置非常容易写错**：写成 `chain.invoke({...}, handler)` 或 `chain.invoke({...}, callbacks=[handler])` 都不会生效（后者在部分版本会报错）。位置必须对。
- `print(f"A: {answer.content}")`：`ChatOpenAI` 返回的是 `AIMessage`，正文在 `.content`。讲师演示时屏幕上显示的输出就是这个。
- `flush = getattr(handler, "flush", None); if callable(flush): flush()`：**课里没讲，但强烈建议保留**。Langfuse SDK 是批量异步上报的，脚本跑完进程立刻退出时，缓冲区里的 trace 可能还没发出去，你会在 UI 里看到"什么都没有"。`flush()` 会等缓冲区排空。如果你写的是长驻服务（FastAPI / Express），进程不会立刻退出，可以不加；但单个脚本 demo 一定要加。
- **JS/Node 对照**：如果你用 LangChain.js，写法是 `chain.invoke(input, { callbacks: [handler] })`，handler 来自 `langfuse-langchain` 或新版 `@langfuse/langchain`。**这个包名课里没讲**，请以官方文档为准，不要照抄这一段。callback 传参的形式和 Python 完全一致，这是 LangChain 跨语言设计上的一致性。

![p013 118:35 讲师运行 demo.py 后在终端拿到模型响应，准备回 Langfuse 查看 trace](images/p013_7115s.jpg)

### 5.5 概念部分的逐条落地（对应第 2 节引用的那些判断）

这一段把讲师讲的"判断"翻译成你能写进代码/写进文档的规则：

1. **"prompt caching 是模型在负责"** → 你不需要写代码，只需要把 system prompt 放在最前面且保持稳定（不要每次请求拼接时间戳），这样 provider 的 prompt cache 才能命中。落地检查：system prompt 里有没有 `datetime.now()` 之类的变量？有就命中不了。
2. **"embedding 也可以缓存"** → 落地方式是"文本哈希 → 向量"的 KV，键用 `sha256(normalized_text)`，值用向量。为什么必须 normalized：同一句话多一个空格就 miss，缓存命中率会掉到接近 0。
3. **"planning 里用 SQLite task 表做可恢复性，这也是缓存"** → 落地方式是"一步规划做完就落库，重启时先读表再决定从哪步继续"。这是一个**写时缓存**，不是读时缓存；它的价值不是提速，是省钱和防丢。
4. **"错误工具响应写进缓存，所有相似查询都命中错误答案"** → 落地规则：**任何外部检索结果（web search、第三方 API）在写入缓存前必须经过验证**。讲师给出的验证手段是 "extra validation before adding to cache"，以及在遇到不确定信息时引入 human in the loop。
5. **"用户不知道你是从缓存返回的"** → 落地规则：缓存命中必须单独打点（`cache_hit=true`），否则你在看板上永远分不清"系统变快了"和"系统不调模型了"。
6. **"延迟低不等于系统好，要看 relevancy / faithfulness，也要看客户负反馈"** → 落地规则：监控面板上延迟和回答质量指标**必须并排放**，并且缓存命中率的任何异常上涨都要作为告警信号，因为它可能意味着错误答案正在被复用。
7. **"系统慢不要直接说缓存，先 profiling"** → 落地规则：把 RAG 链路拆成 `embedding / retrieval / rerank / generation` 四段，每段单独打点计时。这也正好是 Langfuse 的 trace 天然能给你的东西——一次 trace 里每个 span 的耗时。
8. **"多租户没有唯一解"** → 落地规则：把"租户数量"写成设计决策的显式输入。≤10 个大客户 → 一租户一 collection 甚至独立集群；百万级 C 端用户 → 共享 collection + metadata filter + 完整的泄漏测试。
9. **"query classification 能防缓存误用"** → 落地规则：在进入缓存查询之前先分类，`{"who is he", "他是谁", "上一个呢"}` 这类依赖上下文的查询直接标 `cacheable=false`。这是一个**成本极低、收益极高**的检查。

![p013 83:27 讲师讲解散-聚问题：查询散布到多个分片后要聚合响应，瓶颈是最慢的那个分片](images/p013_5007s.jpg)

分片那段（74:40–84:29）虽然没有代码，但可以直接落成设计决策表：

| 场景 | 分片键选择 | 理由（讲师逻辑） |
|---|---|---|
| Infra Agent，查某时间范围的日志 | 按时间 | 查询天然带时间范围，能直接排除大部分分片 |
| 多区域业务（如 Netflix 的印度/美国数据） | 按地理 | 先按区域过滤，只需在 2–3 个分片里搜，而不是 5–6 个 |
| 查询类型分化（产品开发 / SRE / 其他） | 按语义或领域 | 查询类型能提前判定目标分片 |
| 访问频次差异极大 | 按热/冷 | 热分片单独优化、加缓存、多副本 |

以及讲师给出的三个"面试里该怎么答"的缓解手段，逐条对应到落地动作：

| 手段 | 讲师原话要点 | 落地动作 |
|---|---|---|
| 改进分片键 | "基于查询改进我的分片技术" | 统计真实查询的过滤维度分布，按高频维度分片 |
| 给慢分片加缓存 | "可以给慢分片加缓存" | 在每个分片前面加一层结果缓存（不是全局缓存） |
| 复制热分片 | "热分片可能有 4 个副本，冷分片可能只有 1 个" | 按分片 QPS 差异化配置副本数，而不是所有分片同规格 |

**注意一个隐性成本**：讲师说"即使并行搜索，最少也要 8 秒，因为最慢的分片是 8 秒，然后还要合并响应，所以是 8 秒以上"。这段推理的落地含义是——**分片的尾延迟（p99）由最慢的那一个决定**。所以优化时优先削最慢分片的 p99，而不是降低平均 QPS 处理能力。

![p013 74:40 讲师把话题转到扩展：edu courses cloud 跑在本地无需考虑多用户，但要能回答任意项目的扩展问题](images/p013_4480s.jpg)

---

## 6. 复现检查清单

跑完后逐条打勾，全部通过才算复现成功。

### 6.1 环境与依赖

- [ ] `python3 --version` 输出 3.10 或 3.11（3.12 部分向量库轮子可能缺失，见第 7 节）
- [ ] `source .venv/bin/activate` 后 `pip list | grep chromadb` 有输出
- [ ] `docker --version` 和 `docker compose version` 都有输出，Docker Desktop 已启动
- [ ] 7000 端口以上空闲；`lsof -i :3000`、`lsof -i :6379`、`lsof -i :5432`、`lsof -i :8123`、`lsof -i :9000` 都应该无输出（有输出就先处理，见第 7 节）

### 6.2 `metadata_filter_demo.py`

- [ ] 首次运行打印 `[init] 写入 10 篇文档到 collection=devbot_knowledge_base`
- [ ] 第二次运行打印 `[init] collection 已存在，跳过写入`（幂等验证通过）
- [ ] 场景 1（无过滤）命中 4 条，且 `team` 字段**不止一个值**（出现 payments / mobile / data-infra 之一即证明跨团队）
- [ ] 场景 2（`team=sre`）**只返回 3 条**，全部 `team=sre`——注意不是 4 条，这是"先过滤再检索"的证据
- [ ] 场景 3（`$in [sre, payments]`）返回 4 条，`team` 只有 sre 和 payments 两种值
- [ ] 场景 4（`$and`）返回的每一条都同时满足 `team=payments` 且 `doc_type=postmortem`
- [ ] 场景 5（`runbook=True`）返回的每一条 `runbook` 都是 True
- [ ] `ls chroma_metadata_demo/` 能看到持久化文件（说明写盘成功）

### 6.3 `multi_tenancy_demo.py`

- [ ] 首次运行分别打印 `[A] 共享 collection 写入 4 篇文档` 和两条 `[B] ... 写入 2 篇文档`
- [ ] 设计 A-1（无过滤）输出里出现 `⚠️ 跨租户泄漏：['b-...']`——**没出现就说明你的两条租户数据太不相似了，需要换更接近的文本再来一次**
- [ ] 设计 A-2（`tenant_id=tenant_a`）输出 `✅ 未发现跨租户泄漏`，且只出现 `a-` 开头的 id
- [ ] 设计 B-1 只出现 `a-` 开头 id，`tenant_id` 一栏显示 `(collection 级隔离)`
- [ ] 设计 B-2 只出现 `b-` 开头 id
- [ ] `ls chroma_multitenancy_demo/` 有持久化文件

### 6.4 Langfuse 自托管

- [ ] `docker compose up -d` 返回成功，没有 `port is already allocated` / `Conflict. The container name ... is already in use`
- [ ] `docker compose ps` 里能看到 6 个服务：`redis`、`postgres`、`clickhouse`、`minio`、`langfuse-worker`、`langfuse-web`
- [ ] `docker compose ps` 中 `postgres`、`clickhouse`、`redis`、`minio` 的状态是 `healthy`（可能需要等 1–2 分钟）
- [ ] 浏览器打开 `http://localhost:3000` 能加载出登录/注册页
- [ ] 能创建一个 organization（讲师用的是 `edu courses`）
- [ ] 能创建一个 project（讲师用的是类似 "agentic system design" 的名字）
- [ ] 能在 project → Settings → API Keys 里创建 key，并成功复制 Public + Secret（Secret 只显示一次，复制失败需重新创建）
- [ ] `langfuse_demo/.env` 里三个 Langfuse 变量都填了真实值，文件名严格是 `.env`（不是 `.env.txt`）
- [ ] `python demo.py` 能打印出模型回答（说明 OpenAI key 有效）

### 6.5 Trace 验证

- [ ] `demo.py` 运行结束后，`http://localhost:3000` → Tracing 里出现了一条新 trace
- [ ] 点开 trace 能看到 **input 里有 "Who is Dhoni?"**
- [ ] 能看到 **output 里有模型的回答内容**
- [ ] 能看到 **耗时（秒）和花费（美元）** 这两个数字——讲师原话是"花了多少美元、花了多少秒，和 LangSmith 非常像"
- [ ] 如果 Tracing 页面是空的：先按顺序检查 (a) `.env` 变量名是否拼错 (b) `LANGFUSE_HOST` 是否是 `http://localhost:3000` (c) handler 是否真的传进了 `config={"callbacks": [handler]}` (d) `flush()` 是否被调用

### 6.6 概念自测（对应第 2 节引用）

- [ ] 能说出至少 4 个可以缓存的层：prompt / embedding / 检索结果 / 规划状态 / 工具调用结果
- [ ] 能说出"错误工具响应进缓存"的后果：所有相似查询命中同一条错误答案，且延迟很低因此难以察觉
- [ ] 能说出为什么"延迟低"不能作为系统健康的唯一指标：要同时看 relevancy / faithfulness 和客户负反馈
- [ ] 能说出系统变慢时的正确顺序：先 profiling 分段（embedding → retrieval → rerank → generation），再决定在哪层优化
- [ ] 能说出 scatter-gather 问题的一句话定义，以及整体耗时由**最慢分片**决定
- [ ] 能说出热分片的三种处理手段：优化该分片、加缓存、加副本
- [ ] 能说出两种多租户设计各自的致命问题：A 是 filtering bug → 泄漏；B 是租户数量一多 → collection 爆炸
- [ ] 能说出 metadata filtering 的执行顺序：**先过滤，后查询**
- [ ] 能说出 Langfuse 和 LangSmith 的关键差异：Langfuse 开源、可本地 docker 自托管、本地免费；LangSmith 是付费服务
- [ ] 能说出 "who is he" 这类查询为什么不能用缓存，以及用 query classification 拦截的思路

![p013 127:22 讲师在课程末尾讲面试表达：技术懂了不等于能讲出来，建议开计时器大声演练并互相做 mock interview](images/p013_7642s.jpg)

---

## 7. 课里没讲但你会撞上的

下面这些全是**课里没讲**的内容，是我按你实际动手时最可能卡住的地方列的。每条都给了排查方向，不保证是唯一解。

### 7.1 ChromaDB 相关

1. **默认 embedding 模型需要联网下载**。`collection.add(documents=[...])` 不传 `embeddings` 时，Chroma 会用默认的 sentence-transformers 模型，首次运行会下载几百 MB 到本地缓存目录。如果公司网络有限制，会卡在"没有任何输出"很久，或者直接超时。**课里没讲**这一点，你如果第一次跑就卡住，先看终端的下载进度。绕过方式是自己传 `embedding_function`，但那需要另一个模型依赖，不在本次复现范围内。
2. **`hnsw:space` 只能在建 collection 时指定**。已经建好的 collection 再想从 `l2` 改成 `cosine`，必须删掉目录重建（`rm -rf chroma_metadata_demo`）。我在代码里显式写死了 `cosine`，就是为了避免你换环境后结果不一致。
3. **`where` 的语法在不同版本之间有差异**。旧版对 `$and` 里嵌套简写形式比较宽松，新版更严格。如果报 `ValueError: Expected where to have exactly one operator`，说明你混用了简写和操作符对象，按第 4 节的写法（全部用 `{"$eq": ...}` 形式）改。
4. **`$in` 只支持单键**。`{"team": {"$in": [...]}, "year": {"$in": [...]}}` 这种写法在部分版本不支持，必须包成 `$and`。
5. **返回的 `metadatas` 里布尔值可能被转成字符串**。如果你用 `runbook=True` 写入，读出来发现是 `"True"`，用 `$eq` 过滤就会 miss。**课里没讲**——我建议先跑一次 `collection.get(limit=1)` 看看类型再决定过滤写法。

### 7.2 Docker / Langfuse 相关

6. **端口冲突是这个 demo 的头号杀手**。讲师本人就撞到了 Redis 那个。除了 6379，还要注意 **3000**（很多前端项目默认用 3000，包括 Next.js dev server，也就是 Langfuse web 自己用的端口）、**5432**（本机可能装了 Postgres）、**9000**（Portainer 也用这个）。处理方式二选一：
   - 停掉占用者（讲师的做法）；
   - 改 compose 里的宿主机端口，比如 `- "127.0.0.1:6380:6379"`。**注意**：如果改的是 `langfuse-web` 的 3000，那么 `NEXTAUTH_URL` 和 `LANGFUSE_HOST` 都要跟着改，否则登录会跳错地址。
7. **`docker compose down` 不删数据，`down -v` 才删**。但如果你只是删容器没删 `./data/` 目录而改了 `ENCRYPTION_KEY`，Langfuse 会因为解不开旧数据而报错。彻底重来：`docker compose down -v && rm -rf ./data`。
8. **Apple Silicon / ARM 上的镜像架构问题**。部分镜像默认拉 amd64，在 M 系列芯片上会跑得非常慢甚至起不来（讲师原话是"会占很多 CPU""系统会变慢"）。如果 `docker compose ps` 里服务一直 unhealthy，先看 `docker compose logs <service>` 是不是架构不匹配。
9. **ClickHouse 的 `user: "101:101"`**。这是官方 compose 里的写法，用来解决 volume 权限。如果你在 Linux 上用了别的用户跑 docker，可能报 permission denied，把 `./data/clickhouse` 的属主改一下或用 `sudo` 跑一次再切回来。
10. **Langfuse 版本迭代很快，compose 里的变量名会变**。第 4 节那份文件是按官方结构整理的，但**具体 image tag 和变量名请以你复制那一刻的官方文档为准**——讲师原话就是"我就是literally在照着官方文档复制"。如果你照我的文件起不来，第一件事是去官方文档重新复制一份，而不是逐行 debug。
11. **`LANGFUSE_INIT_*` 只在数据库为空时生效**。如果你已经手动建了组织，再改这些变量不会覆盖已有数据。
12. **UI 能打开但登录后一直转圈**：通常是 `langfuse-worker` 没起来（trace 写入靠 worker）。`docker compose logs -f langfuse-worker` 看是不是连不上 ClickHouse 或 Redis。

### 7.3 LangChain / Langfuse SDK 相关

13. **`langfuse` 2.x 和 3.x 的 API 不兼容**。2.x 是 `from langfuse.callback import CallbackHandler`，3.x 换了路径和 client 初始化方式。我在 `demo.py` 里用 try/except 兼容了两个，但如果你装的版本连 `CallbackHandler` 这个名字都变了，**请以官方文档的 LangChain 集成页为准**（讲师演示时就是直接复制那一页）。
14. **环境变量拼错时静默失败**。这是最难受的失败模式：脚本正常跑完、模型正常回答、Tracing 页面空空如也。原因可能是 `LANGFUSE_SECRET_KEY` 写成了 `LANGFUSE_SECRET`，也可能是把 `LANGFUSE_HOST` 写成了 `LANGFUSE_BASEURL`。**排查方法**：在 `demo.py` 开头加一行 `print({k: v for k, v in os.environ.items() if k.startswith("LANGFUSE")})`（注意不要打印 secret 全文），确认三个变量都在。
15. **`config={"callbacks": [handler]}` 的位置**。写成第二个位置参数、或者写成 `chain.invoke(input, handler)`，在部分版本不会报错但也不生效。必须放在 `config` 关键字里。
16. **批量上报需要 `flush()`**。这类"批量 + 异步"的 SDK 在 JS 里对应的是 `await langfuse.flushAsync()`（**包名和方法名课里没讲，以官方文档为准**）。写 CLI 脚本时，不 flush 就等于没上报。
17. **温度别设太高**。`temperature=0` 是为了让两次运行的 trace 内容可比。设成 1.0 你会以为"trace 是对的但内容每次都不一样"是 bug。

### 7.4 从前端/Node 视角需要补充的类比

18. **metadata filter ≈ 数据库的 WHERE，但执行时机有保证**。你在 Node 里用 Prisma 写 `where: { tenantId }` 时不会纠结"是先查还是先滤"；但在向量库里这决定了 top-k 的召回质量。**记住这条规则：过滤条件一定要交给向量库执行，不要查完 top-k 再在 JS 里 `.filter()`**——后者会让你的 top-10 全部被别的租户占满，然后过滤完只剩 1 条。
19. **collection ≈ 表，但创建成本更高**。SQL 里 `CREATE TABLE` 几乎免费，向量库里建 collection 会立刻分配索引结构。所以"一租户一 collection"在数据库层面不是零成本的，这也解释了为什么讲师说租户一多就"nightmare"。
20. **多租户的泄漏测试要写成自动化测试**。第 5.2 节那个 `expect_tenant` + `leaked` 的断言写法可以直接搬进 CI：为每个租户准备一条"只属于自己"的查询，断言返回结果里不包含其他租户的 id。**这比 code review 可靠得多**——过滤条件是运行时字符串，review 很容易漏。
21. **缓存命中必须打点**。前端同学最熟悉的是 CDN 的 `x-cache: HIT`。RAG 系统里同样的东西要自己加：响应里带 `cache_hit` 字段，或者像 Langfuse 那样把"是否走了缓存"记成一个 span 属性。不做这件事，讲师说的那个"延迟很低但答案是错的"的场景你永远发现不了。
22. **query classification 的成本极低**。一个十几行的规则匹配（检测 `he/she/他/她/上一个/刚才那个`）就能挡掉讲师举的那类缓存误用，不需要上模型。这是整节课里投入产出比最高的一个建议。

### 7.5 讲师提到但课里没有展开的部分

23. **"LangGraph 也内置了一些缓存机制"**。讲师原话是"LangGraph 也能做一些缓存"，但没有演示、没有给代码。**具体怎么配课里没讲**，不要把它写成你已经实现的功能。
24. **"consistent hashing 在向量库里也有同样的问题"**。讲师提到了这个词，但没有展开算法细节。**课里没讲**具体实现，面试里说到"分片键变化时的重分布问题"就够，不要凭印象描述一致性哈希的环结构细节。
25. **Chroma 是否有 namespace**。讲师的说法是"我记得 Chroma 没有"，语气是"我记得"而不是断言。**以你装的版本为准**，不要把它当成结论写进设计文档。
26. **"给错误数据加缓存前做 extra validation"**。讲师说了这个方向，但没有给出验证器的实现。你可以用 LLM-as-judge，也可以用规则校验（比如 web search 结果必须包含可访问的 URL），**课里没讲具体方案**。
27. **评估（evaluation）和 LLM ops**。讲师说"明天会讲 evaluation 和 LLM ops"，本段没有展开。Langfuse 的 evaluation 功能只提到"有很多能做的"，**课里没讲怎么配**。

### 7.6 最后一条：这份文档本身的边界

第 4 节的所有代码是**按讲师屏幕上演示出来的行为重建的**，不是从课程仓库里拷出来的原文。因此：

- 文件名、变量名、示例文本你都可以改；
- **元数据字段名（`team` / `doc_type` / `year` / `runbook` / `confidentiality` / `tenant_id`）是按讲师口述内容定的**，请以课程 GitHub 仓库里的实际代码为准；
- docker compose 的每一个变量都请对照官方文档再确认一次；
- 凡是我标注「课里没讲」的地方，都是**我补的、为了让代码能跑起来**的部分，不是你需要在面试里复述的内容。

讲师在这一段结尾反复强调的那句话，其实也是这份文档的用法说明：

> "技术知识我敢说，看到这里的各位肯定都有。真正的问题是你能不能展示出来。给自己设个 45 分钟的计时器，大声讲出来，像在面试一样把整个系统画出来。"
> —— p013 [127:39]

所以建议的用法是：**先用第 3、4 节把三个 demo 跑通，再用第 6 节的自测清单对着空气讲一遍**。跑通只是及格线，能讲出来才算学会。