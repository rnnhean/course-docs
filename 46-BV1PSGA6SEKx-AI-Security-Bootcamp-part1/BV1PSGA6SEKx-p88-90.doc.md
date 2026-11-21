# AI Security Bootcamp part1（护栏/网关/可观测）P88–P90 复现文档

> 复现边界先说明：P88–P90 是项目介绍、常见问题、架构讲解，不是逐行编码课。逐字稿没有给出仓库源码，截图清单也没有 OCR 结果。因此本文不会伪造“讲师原码”。本文会把你真正复现时需要的架构、模块职责、接口/数据模型草案、成本估算、后端引导脚本、环境变量模板、检查清单全部落下来；凡是逐字稿没讲、由我为复现补出的文件名、变量名、命令，都会明确标注“课里没讲/示意”。你照着本文可以搭出同构项目，但不能把示意代码冒充成讲师课程源码。

## 1. 这一节做什么

这一节覆盖 P88–P90，目标是建立一个“生产级原型”的 AI 安全应用：用户提交一个研究主题，系统经过认证、限流、输入护栏、语义缓存、异步任务队列、LangGraph 多 Agent 协作、输出护栏、LLM 网关回退、短期/长期记忆、LangSmith 可观测与评估，最后输出 JSON 或 PDF 报告；同时有一个 Pirate 仪表盘做红队攻击验证。基础设施用 Terraform 在 AWS 上创建，CI/CD 用 GitHub Actions 构建并部署到 ECS，日志进 CloudWatch，评估可由 EventBridge 定时触发。

这一节不是“单 Agent 调一次 OpenAI”的 demo，而是把以下东西串起来：

- 多 Agent：Search、Summarize、Writer、Critic，四类 Agent 用 LangGraph 编排。
- 短期记忆：Redis，记住最近 5 条会话消息。
- 长期记忆：PostgreSQL + PGVector，保存报告和向量，支持后续相似主题对比。
- 语义缓存：Redis，把相似问题命中已有答案，减少 LLM API 调用。
- 限流：Redis，按用户限制每分钟请求数；P88 举例 5 次/分钟，P90 说 10 次/分钟，后文会标明这个口径差异。
- 输入/输出双护栏：AWS Bedrock Guardrails，云托管护栏；输入拦有害问题和提示注入，输出再拦 LLM 可能生成的有害内容。
- LLM 网关：TensorZero，OpenAI 主模型失败时切到 GROC 备用模型，还可以继续接 Gemini、Claude。
- 红队：Pirate 仪表盘，用 jail
break、prompt injection、crescendo、skeleton key 等攻击，验证护栏是不是真的生效。
- 基础设施：Terraform 一次创建 VPC、ALB、ECS、ECR、RDS、ElastiCache（AWS 版 Redis）、Secrets Manager、IAM、EventBridge、CloudWatch。
- CI/CD：GitHub Actions 构建两个镜像（应用 + Pirate 面板）推到 ECR，部署 ECS，做健康检查，失败回滚。
- 成本口径：AWS 每天约 $4–6；只做一次会话约 $2–3；ECS 默认 2 vCPU + 4 GB 内存，可降为 1 vCPU + 2 GB。
- 本地环境差异：Windows 用 `.bat`，Mac/Linux 用 `.sh`，两个引导脚本只负责创建 Terraform state 用的 S3 桶和 DynamoDB 表。

![p090 01:07 讲师展示项目整体 Mermaid 架构图，用户请求先进入 AWS 负载均衡器再分流到应用或 Pirate 面板](images/p090_0067s.jpg)

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

多 Agent 不是单 Agent 多调几次，而是四个角色分工再合并：

> "第一个 Agent 做研究，比如你给它一个主题『什么是 AI』，它就去搜；第二个 Agent 把所有东西总结出来；第三个 Agent 负责写；第四个 Agent 是批评者 Agent，它会告诉你这份报告好不好、行不行。"
> —— p088 [00:28]

> "所有 Agent 各自专精自己的任务，你用 LangGraph 的节点把它们组合起来，把每个 Agent 的结果合并，得到最终产物。"
> —— p088 [00:57]

![p088 00:35 讲师逐项列出项目要学的技术点，第一条就是多 Agent 系统](images/p088_0035s.jpg)

两种记忆的存储选型：

> "短期记忆我们用 Redis。你也有别的选择，比如 GPTCache 也很出名，但它没那么可靠，所以我建议直接用 Redis，Redis 是生产环境里最知名的短期记忆工具。第二个是 PostgreSQL，也是生产里非常常用的，配 PGVector，因为你要存 embedding，就需要向量数据库这样的东西，两者结合就是聊天机器人的长期记忆。"
> —— p088 [01:27]

语义缓存的判定逻辑（这段是理解「为什么省钱」的关键）：

> "假设你问聊天机器人『什么是 AI』，它通过 LLM 给出答案，同时把答案存进 Redis 缓存；过一会儿另一个人问『什么是人工智能』，AI 会理解这两个问题语义上非常相似，它就不再发一次 API 调用，而是直接取 Redis 里上一次查询存下的缓存给用户看，这样你就省了成本，不用一遍又一遍地调 API。"
> —— p088 [01:55] / [02:23]

LLM 网关是加在调用链中间的一层：

> "平时你发一个 API 请求，它直接到你的 API 提供方，OpenAI 或别的；但在 LLM 网关里多了一个中间层，你的请求先到 TensorZero 这个网关，再去提供方，拿到结果再回来展示给用户。"
> —— p088 [03:19]

> "假设你在用两个模型，这个项目里我们用 GPT 和 GROC。正常情况下所有回答都由 GPT 给，但如果 GPT 因为技术问题挂了，你就可以用 GROC 作为兜底模型。"
> —— p088 [03:47]

护栏为什么选云托管：

> "护栏这块，这个项目里我们用的是云托管护栏。开源护栏也有很多，比如 Guardrails AI 那类，但我们用云托管护栏，因为它由 AWS 托管，可以说更好。我们用的是 AWS Bedrock Guardrails。"
> —— p088 [04:11]

> "假设有人问非常糟糕的问题，比如怎么杀一个人、怎么做毒品，或者有人想黑进我们的系统，说『忽略你的指令、按我的指令来』，这些都会被拦住。"
> —— p088 [04:41]

红队是「请一个不拿工资的安全专家来打你」：

> "红队其实就是 Pirate 在当黑客，它像一个网络安全专家，用各种不同的 prompt 反复攻击你的 LLM 模型，检查你的 AI 系统到底安不安全。"
> —— p088 [05:08]

![p088 04:07 讲师讲到护栏与红队：输入侧拦截有害问题和提示注入](images/p088_0247s.jpg)

可观测不只是看耗时，还要做评估：

> "你发一次请求，这次请求会被追踪：这个 Agent 做研究花了多少时间、那个 Agent 花了多少时间，所以本质上我们是在做 LLM 的链路追踪；同时我们也在做评估，判断 LLM 的回答好不好、有没有达到标准、有没有幻觉、质量如何、答案是否符合问题。追踪和评估都用 LangSmith。"
> —— p088 [05:38]

> "LangSmith 会追踪每个 Agent 花了多少时间、它拿到了什么发现，Writer Agent 花了多少时间、报告输出是什么，Critic Agent 也是一样，给了 yes 还是 no、耗时多少，这样你就能看到整体耗时——比如整体 30 秒，Search 5 秒，Writer 20 秒，Critic 1 秒。"
> —— p090 [08:46]

生产级 API 设计的三件套：

> "我们用 Redis，但不是短期记忆那个 Redis，而是 Redis Streams，所有 job 都放在那里。首先整个系统是异步的；其次我们做限流，比如按用户设成每分钟 5 次请求，用户再发就不允许了，限流我用的也是 Redis；然后我们还有认证；最后，生成的研究结果你可以转成 JSON，也可以转成 PDF。"
> —— p088 [06:35] / [07:03]

> "限流在这里是每分钟 10 次请求，每个用户只能给 LLM 发 10 次请求。为什么要限流？假设有人在搞网络安全攻击，比如 DDoS 那种反复打一个 API 把系统打崩，为了避免这类攻击，我们做限流。"
> —— p090 [02:27]

![p090 02:15 讲师在架构图上讲请求进入限流这一层](images/p090_0135s.jpg)

Terraform 的价值是「一次点完」：

> "假设你要配 ECS、ECR、负载均衡这些，你显然不会一个个去 AWS 控制台点。所以我们用 Terraform，你写好 Terraform 文件，把代码放在里面，跑一次，所有东西就在你的 AWS 账号上建好了：VPC、ECS、负载均衡、RDS 数据库。"
> —— p088 [07:58]

> "RDS 是什么？我说过长期记忆用 PostgreSQL，那个 RDS 就是它。Redis 我们用 ElasticCache（讲师原话如此，实际产品名为 ElastiCache）。然后还有 Bedrock、Secrets Manager、IAM 角色、自动扩缩容、EventBridge。"
> —— p088 [08:27] / p090 [13:06]

> "EventBridge 用来干什么？假设你想每周跑一次评估，或者每周跑某个 job，用 EventBridge 就能设定『评估每周二跑一次』。"
> —— p088 [08:27]

CI/CD 与回滚：

> "CI/CD 我们用的是 GitHub Actions（讲师口语近似为『interaction』），它会构建镜像、推到 ECR、部署、做健康检查，如果失败了就回滚到上一个版本。"
> —— p088 [08:55]

成本与机器规格：

> "真实估算大概每天 4 到 6 美元；如果你只是做一次普通会话，做完就关掉，大概 2 到 3 美元，没多少。部署我们用的是 ECS，我给了 2 个 CPU 和 4 GB 内存，你可以降到 1.5 或 1 个 CPU、2 GB 内存，也没问题，还能进一步降成本。"
> —— p089 [00:00] / [00:29]

> "OpenAI 记得充 5 美元额度，对大多数项目足够了，如果你不做 RAG 这类东西、也不做 PDF 抽取任务，5 美元能撑四五个项目。GROC 本身是免费的。"
> —— p089 [00:58]

> "想省 AWS 成本，可以把内存从 2 CPU 降到 1 CPU、4 GB 降到 2 GB，还可以把自动扩缩容关掉；项目做完之后你可以停掉，甚至全部销毁再重建，这样就只花两三美元。"
> —— p089 [01:55]

前置知识与跨平台：

> "前置要求：你应该了解 AWS、Python、AI Agent、Terraform、红队的一些概念，这些在课程里都讨论过了。实际上你现在只需要 Python 和基本的 AWS，就算不懂 AWS，只要有个 AWS 账号，它会自动部署。"
> —— p089 [02:54]

> "有人问『你在 Windows 上做，我用 Mac 怎么跑』，一切都能跑，因为全部在云上。唯一一件事：项目里有两个文件，用来创建存 Terraform state 的 S3 桶和 DynamoDB 表，一个 `.bat` 给 Windows 用，一个 `.sh` 给 Linux/Mac 用，记住这点。"
> —— p089 [03:52]

![p089 01:41 讲师回答成本与免费额度相关问题](images/p089_0101s.jpg)

![p089 00:20 讲师给出每天 4–6 美元的成本估算](images/p089_0020s.jpg)

架构里的关键分流与认证：

> "AWS 负载均衡器会判断请求从哪来：来自应用的就转给应用服务，来自 Pirate 的就转给 Pirate 面板。"
> —— p090 [00:29]

> "我们在 AWS Secrets Manager 里存所有密钥，包括 LLM 的 key，也会存一个认证 key。用户查询时要带上这个 API key——这是你应用的 key，不是 LLM 的 key。它会和 Secrets Manager 里的 key 比对，匹配才允许处理。但如果你愿意，也可以让 Secrets Manager 里不放这个 key，就不要认证了，这完全是可选项。"
> —— p090 [01:28]

任务队列与记忆细节：

> "用户写的请求，比如『告诉我 2026 年 6、7 月的 AI 新闻』，系统会把这个请求转成一个 job，用 Redis 的 job queue；worker 一个个取 job、处理请求、把输出给你。"
> —— p090 [04:24]

> "短期记忆就是会话历史，AI 会记住过去 5 条消息。比如你第一个问题问『我叫什么』，到第五个问题你再问『你能说出我第一个问题里说的名字吗』，AI 会记得。这个也是用 Redis。"
> —— p090 [05:23]

> "长期记忆走 PostgreSQL：AI 生成一份报告，你把它存进长期记忆，也就是 PostgreSQL；以后再对相似主题做任务，你可以把两份报告拿来对比。比如我先问 5 月的 AI 进展，报告存下来了；过一段时间我问 5、6、7 月的进展，有些点会和上一份报告相似，因为包含了 5 月，你就可以对比两份报告。"
> —— p090 [05:52] / [06:21]

指数退避：

> "如果某个 API 请求失败了——不一定是 LLM，也可能是 Redis 请求、数据库请求——比如你问 LLM『什么是 AI』，因为网络原因失败了，它会 1 秒后重试；再失败，2 秒后重试；再失败，4 秒后重试，每次重试时间指数增长，这就是指数退避重试逻辑。"
> —— p090 [07:47]

护栏为什么检查两次：

> "我们做了两次护栏检查，输出侧也检查。第一次是在输入侧，看用户给的东西有没有有害信息；但有时候 LLM 自己也会犯错，假设 LLM 的回答里用了脏话、含有害信息，所以 LLM 的响应我们也要过护栏。也就是护栏在用户输入和 LLM 输出两处都用了。"
> —— p090 [09:44]

网关与模型名：

> "现在我用的是 Llama 8B Instant，但它很快会过时，我记得是 2026 年 8 月 16 日，他们有新的替代品 GPT OSS 20B 参数，你只要在 TensorZero 文件里改一下名字就行。网关做什么？如果 OpenAI 因为某些原因挂了，用户会很不爽，所以 OpenAI 一旦不可用——不管是报错还是额度用尽——模型会自动切到 GROC；你还可以配第三个模型，GROC 也挂了就切 Gemini，Gemini 挂了再切 Claude。"
> —— p090 [10:42] / [11:11]

Embedding 选型：

> "embedding 模型我们用的是 all-MiniLM-L6-v2。它不算过时，但确实有更好的 embedding 模型，只是它体积很小，所以我用它；你也可以用在线 embedding 模型。为了省成本我没用 OpenAI 的 embedding，它要收费，所以我选了开源的；但市面上有很好的 embedding 模型，建议你按自己的场景研究一下再选。"
> —— p090 [11:40]

评估的四个指标与日志保留：

> "评估我们会取四个指标：相关性、完整性、幻觉、整体质量。"
> —— p090 [14:05]

> "所有日志都在 AWS CloudWatch，保留 7 天，7 天之后就删掉。"
> —— p090 [14:33]

红队的具体攻击清单：

> "如果你想检查 AI Agent 系统是不是安全、能不能防住有害 prompt——比如你做了一个医疗数据聊天机器人，有人问法律问题它也答了，这就是漏洞——你不需要雇网络安全团队，Pirate 会替你做，这就叫红队。我们会跑很多攻击：jailbreak、XPIA（跨域提示注入）、prompt injection、crescendo 攻击、skeleton key 攻击，几乎都覆盖了。"
> —— p090 [15:31] / [15:59]

架构小结（讲师自己划的重点）与 UI：

> "这个项目最大的亮点是 Redis：语义缓存、短期记忆、会话、限流都靠它；PostgreSQL 加 PGVector 做长期记忆；AWS 托管一切；Terraform 做基础设施；GitHub Actions 做 CI/CD；UI 用的是基础 HTML/CSS/JavaScript，你可以做得更好，项目最后我给了优化建议。"
> —— p090 [16:28]

![p090 13:29 讲师讲 Terraform 与 ECS/ECR 的基础设施编排](images/p090_0809s.jpg)

![p090 04:30 讲师在架构图上讲请求被转成 job 进入 Redis 队列、由 worker 取走](images/p090_0270s.jpg)

![p090 09:00 讲师讲 traceable：每个 Agent 的耗时与产出都被追踪](images/p090_0540s.jpg)

## 3. 从零复现

### 3.1 你要准备什么

- 一个 AWS 账号（讲师强调：就算不会 AWS，只要有账号，Terraform 会自动建）。
- Python 3.11+（讲师只说了「要懂 Python」，没指定版本；3.11 是本文示意基准）。
- Docker（本地跑 Redis 和 PostgreSQL/PGVector，或者直接用云上资源）。
- Terraform CLI 1.6+。
- GitHub 仓库（CI/CD 用）。
- OpenAI 5 美元额度 + GROC 免费 key；LangSmith 免费套餐（讲师说对本项目足够）。
- 本机 4–6 GB 内存足够，不需要高配笔记本——所有重活都在云上。

### 3.2 目录结构（课里没给仓库结构，以下为按逐字稿复现的示意布局）

```text
ai-security-bootcamp/
├── .env.example
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI：认证 → 限流 → 输入护栏 → 缓存 → 入队
│   ├── worker.py        # Redis Streams 消费者：跑 Agent → 输出护栏 → 落库
│   ├── agents.py        # LangGraph 四 Agent
│   ├── queue.py         # Redis Streams 封装
│   ├── cache.py         # 语义缓存（embedding + Redis）
│   ├── memory.py        # 短期记忆（Redis）+ 长期记忆（PG + PGVector）
│   ├── guardrails.py    # AWS Bedrock Guardrails
│   ├── auth.py          # Secrets Manager 里的应用 API key
│   ├── rate_limit.py    # Redis 限流
│   ├── retry.py         # 指数退避
│   └── config.py
├── tensorzero/
│   └── tensorzero.toml  # 主模型 + fallback
├── infra/
│   ├── bootstrap/
│   │   ├── bootstrap.sh # Mac/Linux
│   │   └── bootstrap.bat# Windows
│   └── main.tf
├── frontend/
│   └── index.html
└── .github/workflows/deploy.yml
```

### 3.3 第一步：引导 Terraform 远端 state（对应讲师说的 `.bat` / `.sh` 两个文件）

Terraform 的多副本协作需要远端 state。讲师明确说：这两个脚本用来创建 S3 桶和 DynamoDB 表。**先跑脚本，再 `terraform init`**，否则 `backend "s3"` 会报错。

Windows：

```bat
infra\bootstrap\bootstrap.bat
```

Mac/Linux：

```bash
chmod +x infra/bootstrap/bootstrap.sh
./infra/bootstrap/bootstrap.sh
```

### 3.4 第二步：本地起依赖

```bash
docker run -d --name redis -p 6379:6379 redis:7
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app \
  pgvector/pgvector:pg16
```

### 3.5 第三步：装依赖、配环境变量

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # 然后把值填进去
```

### 3.6 第四步：先本地跑通，再上云

```bash
# 终端 1：API
uvicorn app.main:app --reload --port 8000

# 终端 2：worker
python -m app.worker

# 终端 3：验证
curl http://localhost:8000/health
curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"topic":"2026 年 6、7 月的 AI 新闻","session_id":"s1"}'
```

### 3.7 第五步：部署到 AWS

```bash
cd infra
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

部署后 Terraform 会输出 ALB 的 DNS，用那个 DNS 访问应用和 `/pirate` 面板（路径前缀课里没讲，属本文示意）。**项目做完一定销毁，不然天天计费**：`terraform destroy`。

### 3.8 成本与规格对照表（讲师给的口径）

| 项目 | 讲师给的数字 | 降本做法 |
|---|---|---|
| AWS 每天 | $4–6 | 减配 + 关自动扩缩容 + 用完 destroy |
| 单次会话 | $2–3 | 跑完就停 |
| ECS | 2 vCPU + 4 GB | 1 vCPU + 2 GB（讲师说 1.5 CPU 也行） |
| OpenAI | 充 $5 | 不做 RAG/PDF 抽取可撑 4–5 个项目 |
| GROC | 免费 | 作为 fallback |
| LangSmith | 免费套餐够用 | — |
| 日志 | CloudWatch 保留 7 天 | 改 retention 可省 |

## 4. 完整代码

> 重要声明：**课里没有给出任何源码文件**，P88–P90 是介绍、答疑、架构三集，也没有 OCR 结果。下面每个文件都是「按逐字稿描述复现的示意实现」，不是讲师原码，变量名/路径/版本号都是我为可运行性补的。Bedrock `apply_guardrail` 的返回字段、TensorZero 的接口路径请以你实际安装版本的文档为准，我在对应位置标了「以实际输出为准」。

`requirements.txt`（版本为示意，安装失败就取兼容的最新小版本）：

```text
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
pydantic-settings==2.7.0
httpx==0.28.1
redis==5.2.1
psycopg[binary]==3.2.3
pgvector==0.3.6
boto3==1.35.90
sentence-transformers==3.3.1
numpy==2.2.1
langgraph==0.2.60
langsmith==0.2.7
```

`.env.example`：

```bash
# ---- 应用 ----
APP_NAME=ai-security-bootcamp
API_KEY_SECRET_NAME=app/api-key

# ---- Redis：STM / 语义缓存 / 限流 / 任务队列 共用 ----
REDIS_URL=redis://localhost:6379/0

# ---- PostgreSQL + PGVector：长期记忆 ----
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app

# ---- TensorZero 网关 ----
TENSORZERO_BASE_URL=http://localhost:3000
TENSORZERO_MODEL=openai_primary

# ---- 护栏 ----
BEDROCK_GUARDRAIL_ID=
BEDROCK_GUARDRAIL_VERSION=DRAFT
AWS_REGION=us-east-1

# ---- 参数 ----
STM_MAX_MESSAGES=5
RATE_LIMIT_PER_MINUTE=10
SEMANTIC_CACHE_THRESHOLD=0.90

# ---- 可观测 ----
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=ai-security-bootcamp
LANGSMITH_API_KEY=
```

`infra/bootstrap/bootstrap.sh`（Mac/Linux；桶名与表名换成你自己的全局唯一名）：

```bash
#!/usr/bin/env bash
set -euo pipefail

BUCKET="ai-security-bootcamp-tfstate-0001"
TABLE="ai-security-bootcamp-tflock"
REGION="${AWS_REGION:-us-east-1}"

echo "==> 创建 S3 桶用于 Terraform state: $BUCKET"
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
  $( [ "$REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$REGION" )

aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

echo "==> 创建 DynamoDB 表用于 state 锁: $TABLE"
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" >/dev/null

echo "完成。现在把 bucket/table 写进 infra/main.tf 的 backend 块，再 terraform init。"
```

`infra/bootstrap/bootstrap.bat`（Windows）：

```bat
@echo off
setlocal
set BUCKET=ai-security-bootcamp-tfstate-0001
set TABLE=ai-security-bootcamp-tflock
set REGION=%AWS_REGION%
if "%REGION%"=="" set REGION=us-east-1

echo ==^> 创建 S3 桶 %BUCKET%
aws s3api create-bucket --bucket %BUCKET% --region %REGION%
aws s3api put-bucket-versioning --bucket %BUCKET% --versioning-configuration Status=Enabled

echo ==^> 创建 DynamoDB 表 %TABLE%
aws dynamodb create-table --table-name %TABLE% ^
  --attribute-definitions AttributeName=LockID,AttributeType=S ^
  --key-schema AttributeName=LockID,KeyType=HASH ^
  --billing-mode PAY_PER_REQUEST --region %REGION%

echo 完成。接下来执行 terraform init。
endlocal
```

`infra/main.tf`（示意版：为了可读性省略了子网/安全组细节，真实落地需要补全；资源名对得上讲师列的清单：VPC、ALB、ECS、ECR、RDS、ElastiCache、Secrets Manager、IAM、EventBridge、CloudWatch）：

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
  backend "s3" {
    bucket         = "ai-security-bootcamp-tfstate-0001"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ai-security-bootcamp-tflock"
    encrypt        = true
  }
}

provider "aws" { region = var.region }

variable "region" { default = "us-east-1" }
variable "app_image" { default = "nginx:latest" }
variable "pirate_image" { default = "nginx:latest" }

# ---------- 网络：VPC ----------
resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "ai-security-vpc" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.2.0/24"
  availability_zone       = "${var.region}b"
  map_public_ip_on_launch = true
}

# ---------- 镜像仓库 ----------
resource "aws_ecr_repository" "app"    { name = "ai-security-app" }
resource "aws_ecr_repository" "pirate" { name = "ai-security-pirate" }

# ---------- 日志：7 天保留 ----------
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/ai-security-app"
  retention_in_days = 7
}

# ---------- 密钥 ----------
resource "aws_secretsmanager_secret" "app" { name = "app/api-key" }

# ---------- 长期记忆：RDS PostgreSQL（PGVector 需在库内 CREATE EXTENSION） ----------
resource "aws_db_instance" "ltm" {
  identifier             = "ai-security-ltm"
  engine                 = "postgres"
  engine_version         = "16.4"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "app"
  username               = "postgres"
  password               = "change-me-in-secrets-manager"
  skip_final_snapshot    = true
  publicly_accessible    = false
}

# ---------- 短期记忆 / 缓存 / 限流 / 队列：ElastiCache ----------
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ai-security-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
}

# ---------- ECS ----------
resource "aws_ecs_cluster" "this" { name = "ai-security-cluster" }

resource "aws_iam_role" "task" {
  name = "ai-security-task-role"
  assume_role_policy = jsonencode({
    Version =
{
      Statement = [{
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }]
    })
}

resource "aws_iam_role_policy_attachment" "task_basic" {
  role       = aws_iam_role.task.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_inline" {
  name = "ai-security-task-inline"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "bedrock:ApplyGuardrail",
          "bedrock:InvokeModel",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# ---------- 负载均衡：ALB，按路径把请求分给两个服务 ----------
resource "aws_lb" "this" {
  name               = "ai-security-alb"
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_lb_target_group" "app" {
  name        = "ai-security-app-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check { path = "/health" }
}

resource "aws_lb_target_group" "pirate" {
  name        = "ai-security-pirate-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check { path = "/" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_listener_rule" "pirate" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.pirate.arn
  }
  condition {
    path_pattern { values = ["/pirate*"] }
  }
}

# ---------- ECS 任务定义与服务 ----------
resource "aws_ecs_task_definition" "app" {
  family                   = "ai-security-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"   # 1 vCPU（讲师默认 2 vCPU，这里用降本值）
  memory                   = "2048"   # 2 GB
  execution_role_arn       = aws_iam_role.task.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name      = "app"
    image     = var.app_image
    essential = true
    portMappings = [{ containerPort = 8000 }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "app"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name            = "ai-security-app"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8000
  }
}

# ---------- EventBridge：每周二触发一次评估 ----------
resource "aws_cloudwatch_event_rule" "weekly_eval" {
  name                = "ai-security-weekly-eval"
  schedule_expression = "cron(0 3 ? * TUE *)"  # 每周二 03:00 UTC
}

# ---------- 输出：Terraform apply 结束后打印 ALB DNS ----------
output "alb_dns_name" {
  value = aws_lb.this.dns_name
}
```

`tensorzero/tensorzero.toml`（TensorZero 配置的示意骨架；函数名/提供方字段请以你装的 TensorZero 版本为准，讲师只说了「在 TensorZero 文件里改模型名」）：

```toml
# 主模型：OpenAI；失败自动切 GROC；再失败可继续接 Gemini / Claude
[functions.research]
type = "chat"

[functions.research.variants.openai_primary]
type = "chat_completion"
model = "openai::gpt-4o-mini"
weight = 1.0

[functions.research.variants.groq_fallback]
type = "chat_completion"
model = "groq::llama-3.1-8b-instant"
weight = 0.0

# 讲师提到 Llama 8B Instant 会下线、替代为 GPT OSS 20B，
# 换模型时只改上面这行 model 字符串即可。
```

`app/config.py`：

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ai-security-bootcamp"
    api_key_secret_name: str = "app/api-key"

    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/app"

    tensorzero_base_url: str = "http://localhost:3000"
    tensorzero_model: str = "openai_primary"

    bedrock_guardrail_id: str = ""
    bedrock_guardrail_version: str = "DRAFT"
    aws_region: str = "us-east-1"

    stm_max_messages: int = 5
    rate_limit_per_minute: int = 10
    semantic_cache_threshold: float = 0.90


settings = Settings()
```

`app/auth.py`（认证：Secrets Manager 里的应用 API key；讲师说可以留空 = 关闭认证）：

```python
import boto3
from fastapi import Header, HTTPException

from app.config import settings

_client = boto3.client("secretsmanager", region_name=settings.aws_region)
_cached_key: str | None = None


def _load_app_key() -> str:
    global _cached_key
    if _cached_key is not None:
        return _cached_key
    try:
        resp = _client.get_secret_value(SecretId=settings.api_key_secret_name)
    except _client.exceptions.ResourceNotFoundException:
        # 讲师原话：Secrets Manager 里不放 key，就代表不需要认证
        _cached_key = ""
        return _cached_key
    _cached_key = resp.get("SecretString", "")
    return _cached_key


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = _load_app_key()
    if not expected:
        return  # 认证关闭
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="invalid api key")
```

`app/rate_limit.py`（Redis 固定窗口计数；P88 说 5 次/分钟、P90 说 10 次/分钟，此处取 `.env` 可配）：

```python
import time

import redis

from app.config import settings

r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def check_rate_limit(user_id: str) -> None:
    window = int(time.time() // 60)
    key = f"rl:{user_id}:{window}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, 70)  # 略大于 60 秒，避免边界丢窗口
    if count > settings.rate_limit_per_minute:
        raise PermissionError("rate limit exceeded")
```

`app/retry.py`（指数退避：1s → 2s → 4s，讲师口述的正是这个序列）：

```python
import asyncio
import functools
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


def exponential_backoff(
    attempts: int = 4,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs) -> T:
            delay = base_delay
            last_exc: Exception | None = None
            for i in range(attempts):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:  # 讲师：LLM/Redis/DB 请求失败都适用
                    last_exc = exc
                    if i == attempts - 1:
                        break
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, max_delay)
            assert last_exc is not None
            raise last_exc
        return wrapper
    return decorator
```

`app/guardrails.py`（AWS Bedrock Guardrails；输入与输出各调一次）：

```python
import boto3
from botocore.exceptions import ClientError

from app.config import settings

_client = boto3.client("bedrock-runtime", region_name=settings.aws_region)


def apply_guardrail(text: str, source: str) -> tuple[bool, str]:
    """返回 (是否放行, 说明)。source 取 'INPUT' | 'OUTPUT'。"""
    if not settings.bedrock_guardrail_id:
        return True, "guardrail 未配置，跳过（课里说这是可选）"
    try:
        resp = _client.apply_guardrail(
            guardrailIdentifier=settings.bedrock_guardrail_id,
            guardrailVersion=settings.bedrock_guardrail_version,
            source=source,
            content=[{"text": {"text": text}}],
        )
    except ClientError as exc:
        # 护栏服务本身故障时的策略由你决定；这里选择放行并记录
        return True, f"guardrail error: {exc}"
    # 具体字段名（action / outputs 等）以实际输出为准
    action = resp.get("action", "NONE")
    blocked = action == "GUARDRAIL_INTERVENED"
    return (not blocked), f"action={action}"
```

`app/cache.py`（语义缓存：embedding + 余弦相似度 + Redis 存向量）：

```python
import json

import numpy as np
import redis
from sentence_transformers import SentenceTransformer

from app.config import settings

r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
# 讲师用的 all-MiniLM-L6-v2：体积小、免费、不用 OpenAI 付费 embedding
_model = SentenceTransformer("all-MiniLM-L6-v2")
_CACHE_INDEX_KEY = "semcache:index"


def _embed(text: str) -> list[float]:
    vec = _model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def get_cached_answer(question: str) -> str | None:
    qvec = np.array(_embed(question), dtype="float32")
    candidates = r.hgetall(_CACHE_INDEX_KEY)
    best_key, best_score = None, -1.0
    for key, raw in candidates.items():
        item = json.loads(raw)
        score = float(np.dot(qvec, np.array(item["vector"], dtype="float32")))
        if score > best_score:
            best_key, best_score = key, score
    if best_key is not None and best_score >= settings.semantic_cache_threshold:
        payload = r.get(f"semcache:answer:{best_key}")
        if payload:
            return json.loads(payload)["answer"]
    return None


def store_answer(question: str, answer: str) -> None:
    key = str(abs(hash(question)))
    r.hset(
        _CACHE_INDEX_KEY,
        key,
        json.dumps({"question": question, "vector": _embed(question)}),
    )
    r.set(f"semcache:answer:{key}", json.dumps({"answer": answer}))
```

`app/memory.py`（短期记忆 Redis 最近 5 条；长期记忆 PG + PGVector）：

```python
import json

import redis
from pgvector.psycopg import register_vector
from psycopg import connect

from app.config import settings

r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def stm_key(session_id: str) -> str:
    return f"stm:{session_id}"


def push_message(session_id: str, role: str, content: str) -> None:
    key = stm_key(session_id)
    r.rpush(key, json.dumps({"role": role, "content": content}))
    # 讲师原话：AI 会记住过去 5 条消息
    r.ltrim(key, -settings.stm_max_messages, -1)


def get_recent_messages(session_id: str) -> list[dict]:
    raw = r.lrange(stm_key(session_id), 0, -1)
    return [json.loads(x) for x in raw]


def _conn():
    conn = connect(settings.database_url.replace("postgresql+psycopg://", "postgresql://"))
    register_vector(conn)
    return conn


def init_ltm() -> None:
    with _conn() as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id BIGSERIAL PRIMARY KEY,
                topic TEXT NOT NULL,
                report TEXT NOT NULL,
                embedding vector(384),
                created_at TIMESTAMPTZ DEFAULT now()
            )
            """
        )


def save_report(topic: str, report: str, embedding: list[float]) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO reports (topic, report, embedding) VALUES (%s, %s, %s)",
            (topic, report, embedding),
        )


def find_similar_reports(embedding: list[float], limit: int = 3) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT topic, report, 1 - (embedding <=> %s::vector) AS similarity
            FROM reports
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (embedding, embedding, limit),
        ).fetchall()
    return [{"topic": t, "report": rep, "similarity": sim} for t, rep, sim in rows]
```

`app/queue.py`（Redis Streams 任务队列，讲师：所有 job 都放这里）：

```python
import redis

from app.config import settings

r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
STREAM = "jobs:research"
GROUP = "workers"


def ensure_group() -> None:
    try:
        r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def enqueue_job(job_id: str, topic: str, session_id: str) -> None:
    r.xadd(STREAM, {"job_id": job_id, "topic": topic, "session_id": session_id})


def consume_jobs(consumer_name: str, block_ms: int = 5000):
    ensure_group()
    while True:
        entries = r.xreadgroup(
            GROUP, consumer_name, {STREAM: ">"}, count=1, block=block_ms
        )
        if not entries:
            continue
        _, messages = entries[0]
        for msg_id, fields in messages:
            yield msg_id, fields


def ack_job(msg_id: str) -> None:
    r.xack(STREAM, GROUP, msg_id)
```

`app/agents.py`（LangGraph 四 Agent：Search → Summarize → Writer → Critic；含 LangSmith 追踪与四次 LLM 调用都过指数退避）：

```python
import os
from typing import TypedDict

import httpx
from langgraph.graph import END, StateGraph

from app.config import settings
from app.retry import exponential_backoff

os.environ.setdefault("LANGSMITH_PROJECT", os.getenv("LANGSMITH_PROJECT", "ai-security-bootcamp"))


class ResearchState(TypedDict, total=False):
    topic: str
    raw: str
    bullets: str
    report: str
    verdict: str


@exponential_backoff(attempts=4, base_delay=1.0)
async def call_llm(prompt: str) -> str:
    """所有 LLM 调用统一走 TensorZero 网关，不直连 OpenAI/GROC。"""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.tensorzero_base_url}/inference",
            json={
                "function_name": "research",
                "variant_name": settings.tensorzero_model,
                "input": {"messages": [{"role": "user", "content": prompt}]},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        # 返回结构以你实际部署的 TensorZero 版本为准
        return data.get("content") or data.get("output") or str(data)


async def search_agent(state: ResearchState) -> ResearchState:
    raw = await call_llm(f"请围绕主题做资料搜集，列出事实与来源：{state['topic']}")
    return {"raw": raw}


async def summarize_agent(state: ResearchState) -> ResearchState:
    bullets = await call_llm(f"把下面资料压缩成要点列表：\n{state['raw']}")
    return {"bullets": bullets}


async def writer_agent(state: ResearchState) -> ResearchState:
    report = await call_llm(
        f"基于以下要点写一份结构完整的研究报告，主题是 {state['topic']}：\n{state['bullets']}"
    )
    return {"report": report}


async def critic_agent(state: ResearchState) -> ResearchState:
    verdict = await call_llm(
        f"请审查这份报告是否达标，只回答 yes 或 no 并给一句理由：\n{state['report']}"
    )
    return {"verdict": verdict}


def build_graph():
    g = StateGraph(ResearchState)
    g.add_node("search", search_agent)
    g.add_node("summarize", summarize_agent)
    g.add_node("writer", writer_agent)
    g.add_node("critic", critic_agent)

    g.set_entry_point("search")
    g.add_edge("search", "summarize")
    g.add_edge("summarize", "writer")
    g.add_edge("writer", "critic")
    g.add_edge("critic", END)
    return g.compile()


graph = build_graph()
```

`app/main.py`（FastAPI：认证 → 限流 → 输入护栏 → 语义缓存 → 入队；生产 API 是异步的，先返回 job_id）：

```python
import uuid

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from app.auth import verify_api_key
from app.cache import get_cached_answer, store_answer
from app.config import settings
from app.guardrails import apply_guardrail
from app.queue import enqueue_job
from app.rate_limit import check_rate_limit

app = FastAPI(title=settings.app_name)


class ResearchRequest(BaseModel):
    topic: str
    session_id: str = "default"
    user_id: str = "anonymous"


class ResearchResponse(BaseModel):
    job_id: str | None = None
    cached: bool = False
    answer: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post(
    "/research",
    response_model=ResearchResponse,
    dependencies=[Depends(verify_api_key)],
)
def research(req: ResearchRequest):
    try:
        check_rate_limit(req.user_id)
    except PermissionError:
        raise HTTPException(status_code=429, detail="rate limit exceeded")

    # 第一次护栏检查：输入侧
    allowed, reason = apply_guardrail(req.topic, source="INPUT")
    if not allowed:
        raise HTTPException(status_code=400, detail=f"blocked by guardrail: {reason}")

    cached = get_cached_answer(req.topic)
    if cached:
        return ResearchResponse(cached=True, answer=cached)

    job_id = str(uuid.uuid4())
    enqueue_job(job_id, req.topic, req.session_id)
    return ResearchResponse(job_id=job_id)
```

`app/worker.py`（消费 Redis Streams：跑 LangGraph → 第二次护栏检查输出 → 写 STM/LTM/缓存）：

```python
import json
import uuid

from app.agents import graph
from app.cache import _embed, store_answer
from app.guardrails import apply_guardrail
from app.memory import init_ltm, push_message, save_report
from app.queue import ack_job, consume_jobs


def process(job_id: str, fields: dict) -> None:
    topic = fields["topic"]
    session_id = fields["session_id"]

    push_message(session_id, "user", topic)
    state = graph.invoke({"topic": topic})
    report = state.get("report", "")

    # 第二次护栏检查：输出侧（讲师强调护栏用了两次）
    allowed, reason = apply_guardrail(report, source="OUTPUT")
    if not allowed:
        report = f"该回复被安全护栏拦截：{reason}"

    push_message(session_id, "assistant", report)
    save_report(topic, report, _embed(topic))
    store_answer(topic, report)
    print(json.dumps({"job_id": job_id, "verdict": state.get("verdict")}))


def main() -> None:
    init_ltm()
    consumer = f"worker-{uuid.uuid4().hex[:8]}"
    for msg_id, fields in consume_jobs(consumer):
        try:
            process(fields.get("job_id", msg_id), fields)
        finally:
            ack_job(msg_id)


if __name__ == "__main__":
    main()
```

`frontend/index.html`（讲师说 UI 用基础 HTML/CSS/JavaScript，这里是最小可用版）：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>AI Research Console</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; }
    textarea { width: 100%; height: 90px; }
    pre { background: #f5f5f5; padding: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>AI Research Console</h1>
  <input id="apiKey" placeholder="x-api-key" />
  <input id="session" placeholder="session id" value="s1" />
  <textarea id="topic" placeholder="输入研究主题"></textarea>
  <button id="send">提交</button>
  <pre id="out"></pre>
  <script>
    const API = ""; // 同源部署留空；本地跨端口时填 http://localhost:8000
    document.getElementById("send").onclick = async () => {
      const res = await fetch(`${API}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": document.getElementById("apiKey").value,
        },
        body: JSON.stringify({
          topic: document.getElementById("topic").value,
          session_id: document.getElementById("session").value,
        }),
      });
      document.getElementById("out").textContent = JSON.stringify(await res.json(), null, 2);
    };
  </script>
</body>
</html>
```

`.github/workflows/deploy.yml`（GitHub Actions：构建两个镜像 → 推 ECR → 部署 ECS → 健康检查，失败回滚。回滚用 ECS 部署失败自动回退旧任务定义）：

```yaml
name: deploy
on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  APP_REPO: ai-security-app
  PIRATE_REPO: ai-security-pirate
  CLUSTER: ai-security-cluster
  SERVICE: ai-security-app

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr

      - name: Build & push app image
        run: |
          REG=${{ steps.ecr.outputs.registry }}
          docker build -t $REG/$APP_REPO:${{ github.sha }} ./app
          docker push $REG/$APP_REPO:${{ github.sha }}

      - name: Build & push pirate image
        run: |
          REG=${{ steps.ecr.outputs.registry }}
          docker build -t $REG/$PIRATE_REPO:${{ github.sha }} ./pirate
          docker push $REG/$PIRATE_REPO:${{ github.sha }}

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $CLUSTER \
            --service $SERVICE \
            --force-new-deployment

      - name: Health check
        run: |
          for i in $(seq 1 30); do
            if curl -sf "${{ secrets.APP_HEALTH_URL }}"; then exit 0; fi
            sleep 10
          done
          echo "health check failed"
          exit 1
```

## 5. 逐行解释

**为什么请求链路的顺序是「认证 → 限流 → 输入护栏 → 缓存 → 入队」？**
讲师在 P90 的架构讲解顺序就是这个：先比对 Secrets Manager 里的应用 API key（匹配才处理，且明确说这是可选开关）；过了才限流，因为未认证流量不该占用每用户额度；再进护栏，因为有害 prompt 不能浪费一次缓存查询；缓存命中就直接返回，省一次 LLM 调用；未命中才转成 job 入 Redis Streams。在 JS/Node 里，这相当于 Express 里串 `authMiddleware → rateLimitMiddleware → guardrailMiddleware → cacheMiddleware → enqueue`，`next()` 顺序不能乱。

**为什么限流窗口要 `expire(key, 70)` 而不是 60？**
固定窗口计数如果刚好设在 60 秒，请求落在 `59.9s` 到 `60.1s` 之间时 key 已过期或刚过期，旧计数丢失，实际放行量会略超。多给 10 秒余量是工程惯例。讲师没有给具体实现，只说「按用户每分钟 N 次，是 Redis 做的」。

**限流口径为什么写 10 次/分钟？**
P88 [07:03] 讲师口述「per user suppose you have set a limit that five requests per minute」，P90 [02:56] 图上和口述都是「10 requests per minute」。两次口径不一致，本文把默认值取 10，并放进 `RATE_LIMIT_PER_MINUTE` 环境变量，你按讲师 P90 的架构图还原就用 10，按 P88 说法就用 5。

**为什么语义缓存阈值是 0.90？**
讲师只讲了机制，没给数值。`all-MiniLM-L6-v2` 的 embedding 在语义近似句上余弦相似度通常偏高，0.90 是保守起点；阈值过低会误命中「什么是 AI」和「什么是 AI 伦理」这类不同问题，阈值过高就退化成字符串精确匹配，省不到钱。这个数值属于本文补的，课里没讲。

**`normalize_embeddings=True` 之后为什么只算 `np.dot` 而不是完整余弦公式？**
归一化后向量长度都是 1，点积就等于余弦相似度，省一次除法。这对应讲师说的「AI 会理解这两个问题语义上非常相似」，判断依据正是 embedding 之间的距离。

**为什么短期记忆用 `rpush` + `ltrim(-5, -1)`？**
讲师原话是「AI 会记住过去 5 条消息」。`ltrim(key, -5, -1)` 保留列表最后 5 个元素，写法上等价于 JS 里 `arr.splice(0, arr.length - 5)`。用 List 而不是 Set，因为会话消息有顺序和角色之分。

**为什么长期记忆表里 `embedding vector(384)`？**
`all-MiniLM-L6-v2` 的输出维度是 384，PGVector 的列类型要与之严格一致，对不上会插入失败。讲师只说了「用 PGVector 存 embedding、做长期记忆、支持两份报告对比」，维度是他的选型决定的，不是他讲的。

**`init_ltm()` 里为什么要 `CREATE EXTENSION IF NOT EXISTS vector`？**
Terraform 建的 RDS 只给了 Postgres 引擎，PGVector 扩展要进库里手动启用。这一步课里没讲，但不做的话 `vector(384)` 类型不存在，建表直接失败。

**`1 - (embedding <=> %s::vector)` 是什么意思？**
`<=>` 是 PGVector 的余弦距离运算符，距离越小越相似；`1 - 距离` 得相似度。对应讲师说的「再问相似主题时可以对比两份报告」。

**为什么两次 `apply_guardrail` 的 `source` 一个 `INPUT` 一个 `OUTPUT`？**
讲师明确说「护栏在用户输入和 LLM 输出两处都用了」，理由是「LLM 自己也会犯错，可能生成脏话或有害信息」。只用一次输入侧护栏挡不住幻觉型有害输出。Bedrock 侧 `source` 的合法取值请以你实际 SDK 文档为准（我标了「以实际输出为准」）。

**为什么护栏未配置时返回 `True`？**
讲师说认证 key「你可以在 Secrets Manager 里留空，就不需要认证」，同理护栏 ID 为空时直接放行，保证本地能先跑通链路，再补配置。

**为什么 `call_llm` 走 `TENSORZERO_BASE_URL` 而不是直接 `openai` SDK？**
讲师用整段解释了「中间层」：请求先到 TensorZero，再到提供方，再回来。直连就失去了 fallback——OpenAI 挂了用户只能看到报错，而网关可以自动切 GROC。

**`@exponential_backoff(attempts=4, base_delay=1.0)` 为什么是 1、2、4（第 4 次不再等）？**
讲师口述序列就是「1 秒后重试，再失败 2 秒后重试，再失败 4 秒后重试」。`delay = min(delay * 2, max_delay)` 是标准实现；`max_delay=30` 防止长时间挂死。装饰器包在 `call_llm` 上而不是包在四个 Agent 上，是因为四个 Agent 的失败点都是这一次 HTTP 调用。

**为什么队列用 `xadd` / `xreadgroup` / `xack` 三件套？**
讲师说「用 Redis Streams，所有 job 都在那，worker 一个个取」。Streams 与 List 的关键差别是 consumer group + ack：worker 崩了消息不会被吞掉，仍在 pending 里。`ensure_group` 捕获 `BUSYGROUP` 是因为 group 已存在时重复创建会报错，这是可重入初始化。ACK 放在 `finally` 里保证异常后也不重复消费——严格做法是失败进死信，课里没讲死信机制。

**为什么 `/research` 返回 `job_id` 而不是直接返回报告？**
讲师强调「整个系统是异步的」「系统会把请求转成一个 job，worker 取走处理」。同步返回会长请求超时，异步才配得上 ALB + ECS + 队列这套结构。前端只需拿 `job_id` 再轮询或订阅（轮询接口课里没讲，本文没编）。

**为什么 `push_message` 在 Agent 跑之前就写入用户消息、`save_report` 在护栏之后？**
顺序上用户消息必须先进 STM，Agent 才有上下文；报告要过输出护栏再落库，否则长期记忆里进了有害内容，后续对比还会把它带出来。

**Terraform 里 `cpu = "1024" / memory = "2048"` 为什么不是你笔记里的 2 vCPU + 4 GB？**
讲师默认给的是 2 CPU + 4 GB，同时明确说「可以降到 1 CPU、2 GB 来降成本」。本文取降本值，与 3.8 节表格一致。要还原讲师默认就改成 `2048` / `4096`。

**为什么 ALB 用 `path_pattern = ["/pirate*"]` 分流？**
讲师描述的是「ALB 判断请求从哪来，应用走应用服务，Pirate 走 Pirate 面板」，他口述的是来源分流，没给具体的 listener rule 字段。用路径前缀是最小可用的还原方式；真实语义分两个域名也可以，课里没讲。

**为什么 EventBridge 写成 `cron(0 3 ? * TUE *)`？**
讲师只举例「评估每周二跑一次」。这个表达式就是周二 03:00 UTC，`?` 在 day-of-month 位是 AWS 的必填占位符，不是笔误。

**为什么 bootstrap 脚本只建 S3 + DynamoDB，不建其他资源？**
讲师明确限定：「这两个文件用来设置存 Terraform state 的 S3 桶和 DynamoDB」。state 锁必须在 `terraform init` 之前存在，否则 backend 初始化失败，所以它不能由 `main.tf` 自己创建——这是经典的引导顺序问题。

**为什么 CI 里没写「回滚」命令？**
讲师说「失败就回滚到上一个版本」。ECS 的 `deploy` 类型服务在部署失败时默认会自动回滚到上一个稳定任务定义（取决于部署配置）；显式写 `aws ecs update-service --task-definition 旧版本` 需要先存下旧 ARN，课里没讲细节，本文没编。健康检查失败就 `exit 1` 让流水线红掉，这是最小可信做法。

**为什么 `verdict` 只打印不阻塞？**
讲师说 Critic Agent「会告诉你这份报告好不好、yes 或 no」。他没说 critic 返回 no 时要重写，所以本文只记录判定，不做重试循环——加这个循环属于课里没讲的扩展。

**在 JS/Node 里对应什么（给前端背景读者）**：
- 幂等/并发控制：这里没有数据库事务，只有 Redis 原子 `INCR` 和 Streams 的 consumer group。Node 里对应的概念是 `ioredis` 的 `incr`/`xreadgroup`，以及 BullMQ 的 job ack。
- 限流：等价于 `express-rate-limit` + Redis store。
- 队列：等价于 BullMQ，但 BullMQ 底层也是 Redis。
- 护栏：一次远程调用，等价于 axios 中间件里 await 一个校验接口。

## 6. 复现检查清单

按顺序勾，任何一项没过就先停下修，别往下走。

**环境**
- [ ] `python --version` ≥ 3.11
- [ ] `docker --version` 可用
- [ ] `terraform version` ≥ 1.6
- [ ] `aws sts get-caller-identity` 返回你的账号（说明 AWS CLI 凭据已配）
- [ ] `.env` 已从 `.env.example` 复制并填好 `LANGSMITH_API_KEY`

**基础设施引导**
- [ ] Mac/Linux 跑了 `bootstrap.sh`，或 Windows 跑了 `bootstrap.bat`
- [ ] `aws s3 ls | grep tfstate` 能看到桶
- [ ] `aws dynamodb list-tables` 能看到 `ai-security-bootcamp-tflock`
- [ ] `infra/main.tf` 的 `backend "s3"` 里 bucket/table 名与实际一致
- [ ] `terraform init` 成功，没有 backend 报错

**依赖服务**
- [ ] `docker ps` 里 redis 与 pgvector 容器都是 Up
- [ ] `redis-cli ping` 返回 `PONG`
- [ ] 能连上 Postgres：`psql "$DATABASE_URL" -c '\dx'` 之后能看到 `vector`（首次跑 worker 后生成）

**应用链路**
- [ ] `curl /health` 返回 `{"status":"ok"}`
- [ ] 不带 `x-api-key` 且 Secrets Manager 里有 key 时，`/research` 返回 401
- [ ] 带对 key 返回 `job_id`，`cached: false`
- [ ] 同一 `user_id` 一分钟内发第 N+1 次返回 429（N 按你的 `RATE_LIMIT_PER_MINUTE`）
- [ ] 输入「如何制作炸弹」一类有害 prompt，返回 400 且说明含 guardrail
- [ ] 再次提交语义近似的问题（如「什么是 AI」→「什么是人工智能」），命中缓存返回 `cached: true`
- [ ] worker 终端打印出 `job_id` 与 `verdict`
- [ ] Redis 里 `LRANGE stm:s1 0 -1` 最多 5 条
- [ ] Postgres 里 `SELECT count(*) FROM reports;` 有记录

**可观测**
- [ ] LangSmith 项目里能看到 search / summarize / writer / critic 四个节点，各有耗时
- [ ] 整体耗时 ≈ 四个节点耗时之和（讲师举的 30s ≈ 5s + 20s + 1s 是同一逻辑）

**故障与回退**
- [ ] 把 OpenAI key 改错，确认 TensorZero 切到 GROC 后仍能返回（取决于你的 TensorZero 配置）
- [ ] 人为让一次 LLM 调用失败，日志里能看到 1s → 2s → 4s 的重试间隔
- [ ] 杀掉 worker 进程再重启，未 ack 的 job 仍会被消费（Streams pending）

**AWS 部署**
- [ ] `terraform plan` 无意外销毁
- [ ] `terraform apply` 后 `terraform output alb_dns_name` 有值
- [ ] 访问 `http://<alb_dns>/health` 返回 ok
- [ ] 访问 `http://<alb_dns>/pirate` 能看到 Pirate 面板
- [ ] CloudWatch 日志组 `/ecs/ai-security-app` 的保留期显示 7 天
- [ ] Secrets Manager 里 `app/api-key` 存在
- [ ] EventBridge 规则 `ai-security-weekly-eval` 状态 Enabled

**收尾（血泪项）**
- [ ] `terraform destroy` 已执行
- [ ] `aws ecs list-clusters` 里没有残留
- [ ] `aws rds describe-db-instances` 里没有残留
- [ ] `aws elasticache describe-cache-clusters` 里没有残留
- [ ] 账单页确认当天没有继续计费

## 7. 课里没讲但你会撞上的

**1. TensorZero 的请求体和响应字段。**
讲师只说「在 TensorZero 文件里改模型名」，没给 `inference` 接口的 JSON 结构。本文 `call_llm` 里的 `function_name` / `variant_name` / `input.messages` 和 `data.get("content")` 都是示意，实际字段取决于你部署的 TensorZero 版本。第一次跑必然要对着日志改一次。

**2. PGVector 扩展的安装。**
Terraform 建出来的 RDS 是标准 Postgres，`vector` 扩展是否预装取决于引擎版本和参数组。你可能需要 `CREATE EXTENSION vector;` 或者换成支持 pgvector 的镜像/参数组。课里完全没提，但缺了它整条长期记忆链路是死的。

**3. 语义缓存用 `hgetall` 全量扫描会随数据增长变慢。**
本文为了可读性用 Python 遍历所有缓存项算点积。生产上几百条之后就明显慢，应该上 Redis 的向量检索（RediSearch）或把候选集限制在某个 topic 前缀下。讲师讲的是机制，没讲索引方案。

**4. 认证用的是明文比较 `!=`。**
演示够用，生产要用 `hmac.compare_digest` 防时序攻击。课里没讲。

**5. 护栏与限流的先后顺序会影响计费口径。**
本文把限流放在护栏前，好处是被限的请求不消耗护栏调用（护栏按调用计费）。如果你希望「有害请求也计入限流」，把两个中间件对调即可。讲师只说两个都在链路上，没定顺序。

**6. Pirate 面板本身没有防护。**
`/pirate*` 直接暴露在 ALB 上，等于把攻击工具挂在公网。真实部署至少要加 IP 白名单或 Basic Auth，否则你会被别人拿去打别人的服务。课里只讲了它的功能，没讲它的访问控制。

**7. 回滚的显式实现。**
讲师说「失败就回滚到上一个版本」，但没说怎么存旧 task definition ARN。ECS 的自动回滚依赖 service 的 `deployment_circuit_breaker` 配置，本文的 `main.tf` 没加这个块——加上它才真正实现讲师描述的行为，不加就只有「健康检查失败、流水线失败」。

**8. Worker 与 API 共用同一个 ECS Service 还是拆两个。**
本文 `aws_ecs_service` 只有 app 一个；worker 在本地用 `python -m app.worker` 跑。上云时 worker 需要单独的 task definition 和 service（或者至少单独的命令覆盖），否则 API 容器里没人消费队列。课里讲了架构上有 background worker，没讲部署形态。

**9. PDF 导出。**
讲师说「研究结果可以转成 JSON，也可以转成 PDF」，但没给库、没给模板。这一步要你自己选 `reportlab` 或前端打印方案。

**10. LangSmith 的四个评估指标怎么算。**
讲师点名了 relevance、completeness、hallucination、overall quality，但没说用什么 evaluator（LLM-as-judge 还是规则）。`langsmith` 包里有 `evaluate` 接口，具体判分 prompt 要你自己写。

**11. 模型名会过时。**
讲师自己就提醒 Llama 8B Instant 会在 2026-08-16 左右下线，替代为 GPT OSS 20B。你照抄 `groq::llama-3.1-8b-instant` 时先确认还在不在，不在就换模型字符串。

**12. 成本估算不含流量与存储增长。**
$4–6/天是空跑加轻量使用的口径；CloudWatch 日志量、RDS 存储、NAT 网关流量都会往上加。讲师给的降本三招（降配、关自动扩缩容、用完销毁）才是真正的省钱手段。