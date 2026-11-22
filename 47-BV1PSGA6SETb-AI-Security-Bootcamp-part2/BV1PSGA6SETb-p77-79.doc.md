# AI Security Bootcamp part2（P077–P079）复现文档：Portkey 网关与 TensorZero 本地网关

## 1. 这一节做什么

这三节课把“LLM 网关”从概念推到可运行的两条链路：

1. **P077–P078：Portkey 网关功能验证**
   - 用 Portkey 网关做**加权负载均衡**：70% 流量给大模型、30% 给小模型，也可以改成 50/50、40/60。
   - 用 Portkey 网关做**缓存**：先验证 simple cache；知道 semantic cache 是付费能力；免费计划写 semantic 会静默回退到 simple。
   - 用 `stream=true` 验证**流式输出**。
   - 用 LangChain 的 `ChatOpenAI` + `base_url` 把请求“drop-in”接入 Portkey，而不是用 `ChatGroq`。
   - 最后有一个作业：把 retry、fallback、load balancing、cache、metadata 全部放进一份 Portkey 配置。

2. **P079：TensorZero
2. **P079：TensorZero 本地网关与网关概念复训**
   - 先用「直连 OpenAI」对比「App → 网关 → Provider」，讲清网关存在的理由：不同 SDK/API、没有集中日志、没有 A/B、换模型要改代码走 CI/CD、没有统一 API、没有指标。
   - 再讲 TensorZero 相对 Portkey / LiteLLM 的取舍：Portkey 网关开源但可观测性收费，TensorZero 两者都免费；真正的差异点是**自动模型优化 + 反馈训练循环**（用户点赞/点踩 → 存 Postgres → 按满意度自动调整流量比例；提示词也同理）。
   - 引入 TensorZero 的两个核心概念：**function（函数）＝你想做什么任务**，**variant（变体）＝这个任务由谁来做**；AB 测试就是给同一 function 的不同 variant 分配不同权重。
   - 最后用 Docker Compose 在本机拉起 **4 个服务**：Postgres（5432）、migration（一次性建表）、gateway（3000）、UI（4000，可选），目录结构是 `tensorzero_demo/` 下的 `docker-compose.yml` + `.env` + `config/tensorzero.toml`。

整份文档的复现顺序就是：先把 Portkey 网关跑通（负载均衡 → 缓存 → 流式 → LangChain drop-in → 全家桶配置），再把 TensorZero 的本地网关容器拉起来。**代码与命令一律给完整文件，你可以直接保存运行。**

---

## 2. 讲师原话

这一节把讲师在这三集里反复强调的判断原样搬过来，后面第 3、4 节的所有操作都是在落实这些话。

P077 开头先回收上一集的链路：模型可能因为 API 额度报错，也可能因为响应太慢而失败，网关会按你设定的次数重试，重试完还不行就 fallback 到另一个模型。这一集换一种路由方式——不是「坏了才切」，而是**一开始就把流量按比例分给多个模型**：

> "负载均衡很简单：100 个请求，70% 也就是 70 个发给这个模型，30% 发给另一个模型。这不是新概念，是很古老的软件工程概念，我们只是把它用在 LLM 上。"
> —— p077 [01:28]

![p077 01:49 讲师讲解负载均衡把请求按比例拆给大模型与小模型](images/p077_0109s.jpg)

演示时讲师把比例改成 50/50，然后连发 10 个问题，结果并不是严格的 5/5：

> "这次有 7 个请求发给了大模型，3 个发给了小模型。它并不总是精确按比例转发——有可能大模型回答得更快，于是新请求又被发给了大模型本身。"
> —— p077 [03:23]

![p077 03:02 讲师演示请求按比例分发到两个模型](images/p077_0182s.jpg)

负载均衡的适用场景，讲师一口气列了五个，这五个就是你在项目里能拿去写需求文档的理由：

> "我们可以在 A/B 测试、渐进式迁移、配额管理、零停机维护里用负载均衡——我们永远不想要停机，要的是容错系统。"
> —— p077 [03:51]

讲到缓存，讲师先把「为什么」说清楚：Amazon 那种站点上，大量用户问的是同一类问题，不应该每次都当成全新请求打给大模型。

> "缓存是什么？缓存就是一个小型数据库，它记录所有此前被问过的问题。如果又问了一个相似的问题，它就直接从缓存里给出答案，不会把这个问题发给大语言模型。"
> —— p077 [10:30]

![p077 09:07 讲师讲解缓存的定位：请求先进缓存再进模型](images/p077_0547s.jpg)

两种缓存的分界线，讲师用两句几乎同义的话做了对照——这是本节最需要记住的一句话：

> "简单缓存会检查问题是否完全一样；但『什么是 generative AI』和『讲一讲 generative AI』，这两个在语义上是相似的，词不一样，意思一样。这就是语义缓存。"
> —— p077 [11:29]

语义缓存内部怎么判同义，讲师给了一个具体机制名（注意，这是个概念名，不是要你手写实现）：

> "它在内部使用交叉编码器注意力机制，把每个词和每个词逐一比对，找出语义含义。"
> —— p077 [11:56]

然后是最容易踩坑的一句，直接影响你能不能用上 semantic：

> "要设置缓存你得写配置：cache mode 设为 simple。想加 semantic 可以加，但那是付费计划；即使你在免费计划上写了 semantic，它内部也会静默回退到 simple，因为你不在付费计划上。"
> —— p077 [13:52]

缓存带来的收益讲师用秒表量化了两次：第一次 996 毫秒未命中，第二次 63 毫秒命中；另一次 1276 毫秒未命中，第二次 548 毫秒命中，并节省了 token。控制台里能直接看到 cache miss / cache hit 与节省的 token 数。

![p077 12:46 讲师在控制台日志里对照缓存命中与未命中](images/p077_0766s.jpg)

P078 进入流式。讲师先给定义，再说参数在哪：

> "流式就是一块一块地返回，也就是大语言模型一边生成，我们就一边把响应显示出来。"
> —— p078 [00:52]

> "Portkey 也给了我们流式的能力。stream 等于 true，就是 chat completions create 里的那个参数。"
> —— p078 [01:46]

![p078 01:30 讲师演示流式输出逐块返回](images/p078_0090s.jpg)

接着是本集最关键的架构判断：为什么接 LangChain 时要选 `ChatOpenAI` 而不是 `ChatGroq`。

> "ChatGroq 在内部是打 Groq 的 API、Groq 的 base URL；而 ChatOpenAI 有一个叫 base_url 的参数，我们可以用它去打 Groq 的模型。为什么需要这个？因为 Portkey 的集成是和 ChatOpenAI 兼容的。"
> —— p078 [06:31]

![p078 07:29 讲师在编辑器里写 ChatOpenAI 指向 Portkey 网关](images/p078_0449s.jpg)

也就是说：`ChatGroq` 把目标地址写死了，你没法把它指到网关；`ChatOpenAI` 的协议格式与 Portkey 网关兼容，并且地址可换，所以拿它当“外壳”。

> "我们使用 ChatOpenAI，而不是 ChatGroq，因为 ChatOpenAI 与 Portkey 兼容。"
> —— p078 [07:30]

接好之后，讲师强调这次改造的成本几乎为零：

> "你在这里学到的是：不用改动任何一行逻辑，就能把 Portkey 集成进来。你只需要加一个 base URL，就这一个。"
> —— p078 [11:43]

![p078 11:28 讲师展示通过 Portkey 的请求被记录为 langchain demo](images/p078_0688s.jpg)

P079 开场先给 TensorZero 定范围，避免你把这一节当成可观测性课：

> "TensorZero 不只是网关，它还有可观测性的一面。但在这套内容里我们只讲网关部分，可观测性我们会碰一点，但不会完全展开。"
> —— p079 [00:28]

以及一条学习方法上的硬要求——这也是本套课“先概念后代码”的基调：

> "不要盯着代码看，要看概念。代码你可以用 Claude Codex 生成。你要理解的是概念。"
> —— p079 [00:57]

网关的定义，讲师用“中间层”三个字反复讲：

> "一个 LLM 网关坐在你的应用和 LLM 提供商之间，它就像中间层。提供商可以是 OpenAI、Groq、NVIDIA，任何东西。"
> —— p079 [05:37]

![p079 18:26 讲师画出应用—网关—提供商的中间层结构](images/p079_1106s.jpg)

网关最实际的收益是“换模型不用重部署应用”，讲师把时间账算得很清楚：

> "在生产里你要改代码就得重新部署，要跑 CI/CD 流水线，花的时间太长，而现在没人那么有耐心。有了网关，你只要改网关的 TOML 配置文件，把 OpenAI 换成 Groq，然后重启这个 Docker 容器，大概一到两分钟，整个应用就自动生效了。"
> —— p079 [17:02]

关于为什么选 TensorZero，讲师先摆 Portkey 的商业模式：

> "Portkey 的 LLM 网关是免费的、开源的，但可观测性那部分是付费的，他们就是从这里赚钱。而在 TensorZero 里，网关和可观测性都是免费的。"
> —— p079 [20:51]

再摆真正的差异点（讲师自己也很克制地说“其他家我不跟你们争”）：

> "真正让 TensorZero 出彩的是自动化模型优化和反馈训练循环。这是它和其他网关的区别，据我所知其他家没有这个训练循环和模型优化。"
> —— p079 [22:46]

![p079 09:56 讲师讲解中央日志：谁答的、答了什么都要能查](images/p079_0596s.jpg)

反馈循环怎么落地，讲师给了一个 1000 人的算例：

> "1000 个问题，现在是 50/50 分给 OpenAI 和 Groq。结果 200 人对 OpenAI 的答案满意，800 人对 Groq 满意，那它会自动把 OpenAI 降到 20%，把 Groq 提到 80%。因为人们更喜欢 Groq 的答案，那 Groq 就更好，我们就应该切过去。"
> —— p079 [27:33]

最后是 function / variant 的定义，讲师用一句话锁死：

> "函数是你想做什么，变体是你从哪里做。当一个函数被挂到某个提供商上，我们把它叫做变体。"
> —— p079 [29:26]

![p079 29:47 讲师区分子函数（任务）与变体（执行方）](images/p079_1787s.jpg)

> "假设 summarize 这个函数，80% 流量走 GPT 变体、20% 走 Groq 变体——每个函数都可以做各自的流量拆分。"
> —— p079 [33:13]

![p079 32:37 讲师演示同一函数下不同变体的流量比例](images/p079_1957s.jpg)

---

## 3. 从零复现

### 3.1 环境准备（Portkey 与 TensorZero 共用）

1. **Docker Desktop**：到 Docker 官网下载安装，装完确认后台引擎在跑（讲师的原话是：安装完成后确保 Docker Desktop 在后台运行，你能在底部看到引擎在跑）。
   
   ![p079 01:25 讲师展示 Docker Desktop 已安装并在后台运行](images/p079_0085s.jpg)

2. **Python 3.11 虚拟环境**：VS Code 里按 `Ctrl+Shift+P`，输入 `Python: Create Environment`，选 **Venv**，解释器选 **Python 3.11**（讲师说 3.12 也可以，但 3.11 更稳、能支持全部代码）。
   等价命令行做法：
   ```bash
   python3.11 -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   python -V                      # 应输出 Python 3.11.x
   ```
3. **两把 API Key**（讲师强调网关必须用两家以上提供商才演示得出来）：
   - **Groq Cloud**：注册免费账号，创建 API Key，额度大约是每天 100 次请求，练习足够。
   - **OpenAI**：充值 5 美元（讲师自己充 5 美元，做了多个项目还剩 4.82 美元），到 API Key 页面创建 key，命名 `test tensorzero`。
   
   ![p079 04:15 讲师展示 OpenAI 账单与 API Key 创建页](images/p079_0255s.jpg)

4. **Portkey**：注册后从控制台复制 **API Key** 与 **Gateway URL**（课里没有念出完整 URL，这一步请以你控制台复制到的为准），并在控制台里准备好两个模型（一个大模型、一个小模型）的 provider 凭据。

5. 安装依赖（**课里没讲版本号**，下面不锁版本）：
   ```bash
   pip install portkey-ai openai langchain-openai python-dotenv
   ```
   > 说明：`portkey-ai` 提供 `Portkey` 客户端与 `createHeaders`；`langchain-openai` 提供 `ChatOpenAI`。课里没有出现 `pip install` 的具体输出画面，包名以官方文档为准。

### 3.2 实验一：加权负载均衡

1. 新建目录 `portkey_lab/`，在其中创建 `.env`：
   ```
   PORTKEY_API_KEY=你的 Portkey key
   OPENAI_API_KEY=你的 OpenAI key
   GROQ_API_KEY=你的 Groq key
   PORTKEY_GATEWAY_URL=你的 Portkey 网关地址
   ```
2. 写 `load_balance.py`（完整代码见第 4 节），核心是：
   - 配置里 `strategy.mode = "loadbalance"`；
   - `targets` 里两个目标，各带一个 `weight`：0.7 / 0.3（讲师演示时也切成 0.5/0.5 和 0.4/0.6）；
   - 把这份 config 传给 Portkey 客户端。
3. 运行：
   ```bash
   python load_balance.py
   ```
4. 结果判读：讲师连发 10 个随机问题（“什么造就一部伟大的电影”“天为什么是蓝的”“飞机怎么停在空中的”），控制台统计显示 **7 个去了大模型、3 个去了小模型**；切到 40/60 后再次发起，UI 显示 55 个请求的分布。**不要指望每次都是精确比例**，讲师明确说大模型更快时新请求可能继续落到大模型。
5. 同时打开 Portkey 控制台的 Logs，确认两个模型都在实际处理请求（讲师描述了“70 billion、8 billion 两个模型都在动，请求数一条条往上涨”）。

### 3.3 实验二：缓存（simple 优先，semantic 作为付费能力了解）

1. 写 `cache_demo.py`（见第 4 节），关键配置只有一行语义：`cache: { mode: "simple" }`。想试 semantic 就改成 `"semantic"`，但**免费计划会被静默降级为 simple**。
2. 第一次运行，问一个此前没问过的问题，例如 `Define generative AI in one sentence.`，记录耗时（讲师实测 **996 毫秒**，日志显示 cache miss）。
3. **不改问题，第二次运行**，耗时降到 **63 毫秒**，日志显示 cache hit。
4. 换一个更长的生成任务（例如“写一首关于 LLM 网关的长诗”）做对照：第一次 **1276 毫秒**未命中，第二次 **548 毫秒**命中，控制台显示节省了 **0.121 tokens**；前一次实验显示节省 **0.01 tokens**。
5. 打开控制台的 Logs 页面，逐条核对 cache hit / miss 与 token 节省字段（字段名以你控制台实际显示为准）。

### 3.4 实验三：流式输出

1. 写 `stream_demo.py`，唯一新增就是 `stream=True`。
2. 运行后你应该看到文本一块一块追加打印，而不是等全部生成完再一次性出现。
3. 讲师还开了对照：直接在 ChatGPT 里让它“写一首关于 gen AI 的诗”，肉眼确认流式的观感，再回到代码确认自己实现了同样效果。

### 3.5 实验四：LangChain drop-in（第 8 个实验）

1. 写 `langchain_portkey.py`，要点四条：
   - 用 `ChatOpenAI`，**不要用 `ChatGroq`**；
   - `api_key` 传的是 **Portkey 的 key**（因为环境变量由 Portkey 托管）；
   - `base_url` 指向 **Portkey 网关地址**；
   - `model` 传你已经在 Portkey 里配好的模型名（讲师用的是 Groq 侧模型）；`temperature=0`。
2. 元数据通过 `createHeaders` 注入，讲师给的三组值是：
   - `user`: `langchain demo`
   - `environment`: `dev`
   - `feature`: `langchain integration`
3. 调用方式保持 LangChain 原生：`llm.invoke("...")`。讲师强调 `invoke` 是 LangChain 的标准方法（之前直接用 `ChatGroq` 时也是 `groq.invoke`）。
4. 运行后在 Portkey 控制台里应能看到一条 **langchain demo** 记录和对应的日志。

### 3.6 实验五（作业）：一份配置装下 retry + fallback + load balancing + cache + metadata

讲师明确布置了作业：写一个程序，在用户打到 LLM 之前放 Portkey 网关，**把所有配置写在同一个 config 里**——retry 配置、fallback、负载均衡、缓存、metadata。讲师说自己已经把答案放在 notebook 里，但建议你先自己写。第 4 节给出了这份「全家桶」配置，并标注了哪些字段是讲师在课上点过名的、哪些需要你按 Portkey 文档核对。

### 3.7 TensorZero 本地部署

1. 先跑前置检查（讲师说这段代码是 Claude 生成的，不用抠代码，看它检查了什么）：
   - Python 是否安装（应显示 3.11）
   - Docker 是否安装
   - docker compose 是否可用（Docker Desktop 自带）
2. 建目录（也可以让脚本自动生成，讲师演示时是脚本一键创建的）：
   ```bash
   mkdir -p tensorzero_demo/config
   ```
   最终目录：
   ```
   tensorzero_demo/
   ├── docker-compose.yml
   ├── .env
   └── config/
       └── tensorzero.toml
   ```
3. 写 `.env`（只放两把 provider key，讲师原话是：在这个 .env 里你会列出你的 API key，OpenAI 的和 Groq 的）。
4. 写 `docker-compose.yml`，四个服务与端口按讲师口述：
   - `postgres` → **5432**，存所有问题/答案/日志；
   - `migrations`（讲师念作 “gateway run postgres migration”）→ **一次性服务**，把 schema 里的表建到 Postgres；
   - `gateway` → **3000**，这是主服务，负责路由、AB 测试；
   - `ui` → **4000**，可选，就是 TensorZero 的 dashboard。
5. 写 `config/tensorzero.toml`：所有 function 和 variant 都列在这里（见第 4 节骨架，字段以官方 schema 为准）。
6. 启动：
   ```bash
   cd tensorzero_demo
   docker compose up -d
   docker compose ps
   ```
7. 验证：`curl http://localhost:3000/health`（路径课里没讲，以官方 quickstart 为准）；浏览器打开 `http://localhost:4000` 看 UI。
8. 后续改模型/改提示词：**只改 `tensorzero.toml`，然后 `docker compose restart gateway`**，不需要动你的应用代码、不需要走 CI/CD。讲师给的预期耗时是 **1–2 分钟**。

---

## 4. 完整代码

> 约定：下面所有文件都是**完整可保存**的。凡逐字稿里没有逐字念出的字段名/模型名，我都用注释标了「课里没念」，请以你控制台/官方文档为准，不要当成讲师原话。

### 4.1 `portkey_lab/.env`

```dotenv
# Portkey 控制台 -> API Key
PORTKEY_API_KEY=pk-xxxxxxxxxxxxxxxx

# Portkey 控制台 -> Gateway URL（课里没念出完整地址，复制你控制台里的）
PORTKEY_GATEWAY_URL=https://api.portkey.ai/v1

# 两家 provider 的 key（由 Portkey 的虚拟环境托管，脚本里不直接使用）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
```

### 4.2 `portkey_lab/load_balance.py`（负载均衡）

```python
import os
import random
import time

from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]

# 课里没念具体模型 slug：讲师口述为“large model / small model”，
# 演示面板上出现的是 70B 与 8B 两个规格。请换成你 Portkey 里配好的模型名。
LARGE_MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")
SMALL_MODEL = os.environ.get("SMALL_MODEL", "llama-3.1-8b-instant")

# 讲师原话：strategy 设为 loadbalance；参数还是那两个模型，
# 但这次多传一个 weight（70% / 30%）。想改 50/50、40/60 只改这两个数字。
LOAD_BALANCE_CONFIG = {
    "strategy": {
        "mode": "loadbalance",
    },
    "targets": [
        {
            "provider": "groq",
            "model": LARGE_MODEL,
            "weight": 0.7,
        },
        {
            "provider": "groq",
            "model": SMALL_MODEL,
            "weight": 0.3,
        },
    ],
}

QUESTIONS = [
    "What makes a great movie?",
    "Why is the sky blue?",
    "How do airplanes stay in the air?",
    "Explain Kubernetes in one paragraph.",
    "What is BGP used for?",
    "Why is Intel losing market share?",
    "Explain vector databases simply.",
    "What is prompt injection?",
    "How does HTTPS work?",
    "What is the difference between TCP and UDP?",
]


def main() -> None:
    client = Portkey(api_key=PORTKEY_API_KEY, config=LOAD_BALANCE_CONFIG)

    stats = {"large": 0, "small": 0}

    for i, question in enumerate(QUESTIONS, start=1):
        started = time.perf_counter()
        response = client.chat.completions.create(
            model=LARGE_MODEL,          # 真正生效的是 config 里的 targets
            messages=[{"role": "user", "content": question}],
            max_tokens=256,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000

        # 课里没讲如何从响应里读回“这次命中了哪个 target”，
        # 讲师是在 Portkey 控制台的 UI 上看到请求分布的。
        # 这里只打印耗时，分布请到控制台 Logs 里核对。
        print(f"[{i:02d}] {elapsed_ms:7.1f} ms | {question}")
        print(f"     -> {response.choices[0].message.content[:80]}...")

    print("\n请到 Portkey 控制台 Logs 页面查看两个模型各自的请求数（讲师实测 7:3 与 4:2）")
    print("本地统计占位：", stats)


if def_main_guard := "__main__":
    pass
```

> 上面最后两行是占位写法，请把结尾替换成标准入口：
> ```python
> if __name__ == "__main__":
>     main()
> ```
> 为了避免你在复制时误留错误语法，下面给出**该文件的正确结尾**，直接用它替换：
> ```python
> if __name__ == "__main__":
>     main()
> ```

### 4.3 `portkey_lab/load_balance.py`（正确结尾版，可直接整文件覆盖）

```python
import os
import time

from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]

LARGE_MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")
SMALL_MODEL = os.environ.get("SMALL_MODEL", "llama-3.1-8b-instant")

LOAD_BALANCE_CONFIG = {
    "strategy": {"mode": "loadbalance"},
    "targets": [
        {"provider": "groq", "model": LARGE_MODEL, "weight": 0.7},
        {"provider": "groq", "model": SMALL_MODEL, "weight": 0.3},
    ],
}

QUESTIONS = [
    "What makes a great movie?",
    "Why is the sky blue?",
    "How do airplanes stay in the air?",
    "Explain Kubernetes in one paragraph.",
    "What is BGP used for?",
    "Why is Intel losing market share?",
    "Explain vector databases simply.",
    "What is prompt injection?",
    "How does HTTPS work?",
    "What is the difference between TCP and UDP?",
]


def main() -> None:
    client = Portkey(api_key=PORTKEY_API_KEY, config=LOAD_BALANCE_CONFIG)

    for i, question in enumerate(QUESTIONS, start=1):
        started = time.perf_counter()
        response = client.chat.completions.create(
            model=LARGE_MODEL,
            messages=[{"role": "user", "content": question}],
            max_tokens=256,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        answer = response.choices[0].message.content or ""
        print(f"[{i:02d}] {elapsed_ms:7.1f} ms | {question}")
        print(f"     -> {answer[:80].replace(chr(10), ' ')}...")

    print("\n请到 Portkey 控制台 Logs 查看两个模型各自的请求数（讲师实测 7:3、4:2）")


if __name__ == "__main__":
    main()
```

### 4.4 `portkey_lab/cache_demo.py`（缓存 + 计时）

```python
import os
import time

from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]
MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")

# 讲师原话：cache mode 设为 simple；付费计划才能用 semantic，
# 免费计划写 semantic 会静默回退成 simple。
CACHE_CONFIG = {
    "cache": {"mode": "simple"},   # 付费账号可改为 "semantic"
}

QUESTION = "Define generative AI in one sentence."


def ask(client: Portkey, question: str, tag: str) -> None:
    started = time.perf_counter()
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": question}],
        max_tokens=256,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    text = response.choices[0].message.content or ""
    print
(f"[{tag}] {elapsed_ms:7.1f} ms")
    print(f"     -> {text[:120].replace(chr(10), ' ')}")


def main() -> None:
    client = Portkey(api_key=PORTKEY_API_KEY, config=CACHE_CONFIG)

    print(f"问题一：{QUESTION}")
    ask(client, QUESTION, "第一次（预期 cache miss，讲师实测 996 ms）")
    ask(client, QUESTION, "第二次（预期 cache hit，讲师实测 63 ms）")

    poem_question = "Write me a long poem on LLM gateways"
    print(f"\n问题二：{poem_question}")
    ask(client, poem_question, "第一次（预期 cache miss，讲师实测 1276 ms）")
    ask(client, poem_question, "第二次（预期 cache hit，讲师实测 548 ms）")

    print("\n请到 Portkey 控制台 Logs 逐条核对：cache miss / cache hit 与节省的 token")
    print("讲师两次实测分别节省 0.01 tokens 与 0.121 tokens")


if __name__ == "__main__":
    main()
```

运行方式一定要注意：**两次提问必须在同一个进程里连着跑**（上面 `main()` 就是这么写的），不要分两次 `python cache_demo.py`——虽然讲师在演示里确实是手动“再跑一次同一段代码”，但同一个脚本连跑两次更省事，也更能说明“第二次命中”。

### 4.5 `portkey_lab/stream_demo.py`（流式）

```python
import os

from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]
MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")

# 讲师演示用的是一句偏开放的问题，让输出足够长、能看清“一块一块”的效果
QUESTION = "If you could have dinner with anyone in history, who would it be and why?"


def main() -> None:
    client = Portkey(api_key=PORTKEY_API_KEY)

    # 讲师原话：stream = True 就是 chat.completions.create 里的那个参数
    stream = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": QUESTION}],
        stream=True,
    )

    collected = []
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            collected.append(delta)
            print(delta, end="", flush=True)

    print("\n\n----- 拼接后的完整响应 -----")
    print("".join(collected))


if __name__ == "__main__":
    main()
```

`flush=True` 是让终端立刻吐字的关键，**课里没讲**这个参数，但不加它在某些终端上会“攒一批再显示”，你会以为流式没生效。

### 4.6 `portkey_lab/langchain_portkey.py`（第 8 个实验：LangChain drop-in）

```python
import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from portkey_ai import createHeaders

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]
PORTKEY_GATEWAY_URL = os.environ["PORTKEY_GATEWAY_URL"]
GROQ_MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")

# 第 8 个实验：LangChain drop-in
# 讲师原话：这里用 ChatOpenAI，不用 ChatGroq。
# 原因：ChatGroq 内部把 Groq 的 base URL 写死了；ChatOpenAI 有 base_url 参数，
# 而 Portkey 的集成是跟 ChatOpenAI 兼容的。
portkey_llm = ChatOpenAI(
    api_key=PORTKEY_API_KEY,          # 注意：这里传的是 Portkey 的 key，不是 Groq 的 key
    base_url=PORTKEY_GATEWAY_URL,     # 这里指向 Portkey 网关，不是 Groq
    model=GROQ_MODEL,                 # 模型名用你已经在 Portkey 里配好的那个
    temperature=0,                    # 讲师原话：temperature 我们保持 0
    default_headers=createHeaders(
        api_key=PORTKEY_API_KEY,
        metadata={
            # 讲师逐条念出的三组 metadata
            "user": "langchain demo",
            "environment": "dev",
            "feature": "langchain integration",
        },
    ),
)

if __name__ == "__main__":
    # 讲师原话：invoke 是 LangChain 的标准方法，之前是 groq.invoke，这次是 portkey_llm.invoke
    response = portkey_llm.invoke("What is an LLM gateway? Answer in three sentences.")
    print(response.content)
```

![p078 04:29 讲师在文档里确认 ChatOpenAI 与 ChatGroq 的差别](images/p078_0269s.jpg)

跑完之后到 Portkey 控制台，你应当能看到一条 **langchain demo** 的记录，以及它对应的一条 log——这正是讲师用来证明“没改一行业务逻辑”的证据。

### 4.7 `portkey_lab/all_in_one_config.py`（作业：一份配置装下全部能力）

```python
import os

from dotenv import load_dotenv
from portkey_ai import Portkey

load_dotenv()

PORTKEY_API_KEY = os.environ["PORTKEY_API_KEY"]
LARGE_MODEL = os.environ.get("LARGE_MODEL", "llama-3.3-70b-versatile")
SMALL_MODEL = os.environ.get("SMALL_MODEL", "llama-3.1-8b-instant")

# 讲师布置的作业：在用户打到 LLM 之前放 Portkey 网关，
# 把 retry、fallback、load balancing、cache、metadata 全部写在一个 config 里。
#
# 诚实说明：讲师只说了“一份配置里全都有”，没有逐字念出组合后的字段嵌套方式。
# 下面 retry / cache / metadata / strategy 是讲师在本节里点过名的能力，
# 具体嵌套位置请对着 Portkey 官方 config 文档核对一遍再上线。
ALL_IN_ONE_CONFIG = {
    # ① 重试：上一集讲的能力，模型可能因额度报错，也可能因为太慢而失败
    "retry": {
        "attempts": 3,                       # 课里没念具体次数，按需改
        "on_status_codes": [429, 500, 502, 503, 504],   # 课里没念，按需改
    },

    # ② 缓存：simple 走精确匹配；付费计划可换 semantic
    "cache": {
        "mode": "simple",
    },

    # ③ 负载均衡：讲师演示的核心，70% 大模型 / 30% 小模型
    "strategy": {
        "mode": "loadbalance",
    },
    "targets": [
        {
            "provider": "groq",
            "model": LARGE_MODEL,
            "weight": 0.7,
        },
        {
            "provider": "groq",
            "model": SMALL_MODEL,
            "weight": 0.3,
            # ④ fallback：小模型这条链路上如果还想兜底，
            # 讲师上一集是用 strategy.mode = "fallback" 做的，
            # 和 loadbalance 同时出现时的嵌套写法课里没讲，请查官方文档。
        },
    ],

    # ⑤ metadata：讲师在 LangChain 那一节用了 user / environment / feature 三组
    "metadata": {
        "user": "langchain demo",
        "environment": "dev",
        "feature": "langchain integration",
    },
}

# 上一集里 fallback 的写法长这样（讲师原话：strategy 是 fallback）
FALLBACK_ONLY_CONFIG = {
    "strategy": {"mode": "fallback"},
    "targets": [
        {"provider": "groq", "model": LARGE_MODEL},
        {"provider": "groq", "model": SMALL_MODEL},
    ],
}


def main() -> None:
    client = Portkey(api_key=PORTKEY_API_KEY, config=ALL_IN_ONE_CONFIG)
    response = client.chat.completions.create(
        model=LARGE_MODEL,
        messages=[{"role": "user", "content": "What is an LLM gateway?"}],
    )
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
```

讲师对这份作业的态度很明确：**代码他已经放出来了，但建议你先自己写一遍**。所以上面这份当参考答案用，不要一上来就抄。

### 4.8 `tensorzero_demo/.env`

```dotenv
# 讲师原话：这个 .env 里列出你的 API key，OpenAI 的和 Groq 的
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
```

### 4.9 `tensorzero_demo/docker-compose.yml`

> 说明：讲师在这一段是**边滚动屏幕边口述**四个服务的职责与端口，没有逐字念出 YAML。
> 下面按他口述的四个服务、两个端口写出来，**镜像名与 migration 的启动参数属于「课里没念」**，
> 请以 TensorZero 官方 quickstart 的 compose 文件为准对照一遍。

```yaml
# 讲师口述：四个服务 —— postgres、migration、gateway、ui（ui 可选）
services:
  # 服务 1：Postgres 数据库
  # 讲师原话：它跑在 5432 端口，用来存所有信息——问了什么、答了什么、谁答的、各种日志
  postgres:
    image: postgres:16                      # 课里没念版本
    environment:
      POSTGRES_DB: tensorzero               # 课里没念库名，按官方示例
      POSTGRES_USER: tensorzero             # 课里没念用户名
      POSTGRES_PASSWORD: tensorzero         # 课里没念密码，本地练习用
    ports:
      - "5432:5432"
    volumes:
      - tensorzero_postgres:/var/lib/postgresql/data
    healthcheck:
      # 讲师原话：我们也会用这条命令做健康检查，判断数据库到底起没起来
      test: ["CMD-SHELL", "pg_isready -U tensorzero -d tensorzero"]
      interval: 1s
      timeout: 1s
      retries: 30
      start_period: 30s

  # 服务 2：migration —— 一次性服务
  # 讲师原话：它只跑一次，作用是把你在 schema 里列的表建到 Postgres 里
  migrations:
    image: tensorzero/gateway:latest        # 课里没念镜像名
    command: ["--run-postgres-migrations"]  # 课里没念参数名，以官方为准
    environment:
      TENSORZERO_POSTGRES_URL: postgres://tensorzero:tensorzero@postgres:5432/tensorzero
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"                           # 关键：一次性，别设成 always 无限重建

  # 服务 3：gateway —— 主服务
  # 讲师原话：这个服务跑在 3000 端口，这是主服务，就是你的 LLM 网关，
  # 负责路由、A/B 测试这些事情
  gateway:
    image: tensorzero/gateway:latest
    command: ["--config-file", "/app/config/tensorzero.toml"]
    volumes:
      - ./config:/app/config:ro
    environment:
      # 讲师原话：我们把 Groq 和 OpenAI 的 key 从 .env 里取出来，
      # 放进 TensorZero 网关里，让 key 留在网关里
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      TENSORZERO_POSTGRES_URL: postgres://tensorzero:tensorzero@postgres:5432/tensorzero
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      migrations:
        condition: service_completed_successfully

  # 服务 4：UI —— 可选
  # 讲师原话：这个服务负责可观测性，你想看某个问题是谁答的，就需要这个 UI，
  # 它跑在 4000 端口，是 TensorZero 的 dashboard
  ui:
    image: tensorzero/ui:latest             # 课里没念镜像名
    environment:
      TENSORZERO_GATEWAY_URL: http://gateway:3000   # 课里没念变量名
    ports:
      - "4000:4000"
    depends_on:
      - gateway

volumes:
  tensorzero_postgres:
```

### 4.10 `tensorzero_demo/config/tensorzero.toml`

```toml
# 讲师原话：所有 function、所有 variant 都列在这个 tensorzero.toml 里。
# 下面用他讲 dirty 的那个例子：summarize 函数，两个 variant，80/20 分流。
# 字段名以官方 schema 为准（课里没逐字念 TOML 内容）。

[functions.summarize]
type = "chat"

# variant 1：用 OpenAI 来干“summarize”这件事
# 讲师原话：当 summarize 这个函数被用在 OpenAI 上时，
# 为了可读性我把它命名成 summarize_gpt 变体
[functions.summarize.variants.summarize_gpt]
type = "chat_completion"
model = "openai::gpt-4o-mini"      # 课里没念具体模型名，换成你的生产级模型
weight = 0.8                       # 讲师举例：80% 流量走 GPT 变体
system_template = "Summarize the user's essay in about 60 words."

# variant 2：用 Groq 来干同一件事
# 讲师原话：用 Groq 模型做摘要时，我们叫它 summarize_groq 变体
[functions.summarize.variants.summarize_groq]
type = "chat_completion"
model = "groq::llama-3.3-70b-versatile"
weight = 0.2                       # 讲师举例：20% 流量走 Groq 变体
system_template = "Summarize the user's essay in about 60 words."

# 讲师原话：另一个函数可以自己定比例，比如 40-60 拆分，
# 每个函数都能做各自的流量拆分。下面留一个空位给你加第二个函数：
# [functions.chat]
# type = "chat"
# [functions.chat.variants.v1]
# type = "chat_completion"
# model = "groq::llama-3.3-70b-versatile"
# weight = 1.0
```

### 4.11 `tensorzero_demo/scripts_check_prereqs.py`（前置检查，可选）

```python
# 讲师原话：这段是 Claude 生成的，不要盯着代码看，看它检查了什么。
# 它检查三件事：Python 装没装、Docker 装没装、docker compose 有没有。
import shutil
import subprocess
import sys


def check_python() -> None:
    print(f"python: {sys.version.split()[0]}  (讲师用的是 3.11)")


def check_docker() -> None:
    docker = shutil.which("docker")
    print(f"docker: {'installed' if docker else 'MISSING —— 先装 Docker Desktop'}")


def check_compose() -> None:
    try:
        out = subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True, text=True, check=True,
        )
        print(f"docker compose: {out.stdout.strip()}")
    except Exception:
        print("docker compose: 不可用 —— Docker Desktop 自带，装好桌面端就有")


if __name__ == "__main__":
    check_python()
    check_docker()
    check_compose()
```

![p079 01:25 讲师先做前置检查：Python、Docker、docker compose 三件套](images/p079_0085s.jpg)

---

## 5. 逐行解释

### 5.1 `.env` 与环境变量

**为什么 key 全部走环境变量**：讲师在 P078 解释 LangChain 那一节时说得很直白——“因为 Portkey 在替我们管环境变量”。这句话有两层意思：一是你在应用里不该出现 provider 的明文 key；二是 Portkey 侧配置好 provider 凭据后，你的代码只认一把 `PORTKEY_API_KEY`。在 Node/前端项目里对应就是：key 永远不进浏览器 bundle，只放在服务端进程的 `process.env`，前端只调你自己的 BFF 接口。

**`PORTKEY_GATEWAY_URL` 为什么单独拎出来**：P078 那节的全部改造只做了两件事——换 base URL、换 key。所以这个变量必须显式存在，否则你没法在“直连”和“走网关”之间来回切。

### 5.2 负载均衡配置逐字段

- `strategy.mode = "loadbalance"`：讲师对照上一集说，上一集写 fallback 时 strategy 是 `fallback`，这一集是 `loadbalance`。**这个字段决定网关怎么理解后面那组 targets**：是“坏了才切”，还是“一开始就按比例分”。
- `targets[i].weight`：讲师原话——“这次我们多传一个参数 weight，70% / 30%”。这是负载均衡与 fallback 唯一的结构差异：fallback 的 targets 只是一个有序的兜底队列，不需要权重；loadbalance 必须有权重才能算比例。
- 为什么权重是小数而不是 `70`：总和必须是 1（或按比例归一）。你写 0.7/0.3、0.5/0.5、0.4/0.6 都行，讲师现场就改过这三组。**如果不归一（比如 70/30）**，行为取决于网关实现，课里没讲，别赌。
- 为什么 `create` 里还传了 `model`：因为 config 里的 targets 才是真正的路由表，外层 `model` 只是调用签名需要。所以你会看到“我传的是大模型名，但请求跑到了小模型”——这不是 bug。
- **响应里读不回命中目标**：讲师全程是在控制台 UI 上看分布的（“我打印在 UI 上了，这么多请求给了大模型和小模型”）。所以本地脚本只打印耗时，别硬编一个“命中哪个模型”的字段名——那种字段名课里没出现过。

### 5.3 缓存的三个判断

- `cache.mode = "simple"`：它做的是**精确字符串匹配**。讲师给的例子是同义不同词：“什么是 generative AI” vs “讲一讲 generative AI”，simple **判不出来**，这是它的能力边界。
- `cache.mode = "semantic"`：用交叉编码器注意力机制做词对词比对，找出语义等价。讲师明确这是**付费能力**，并且免费计划上写 semantic 不会报错，而是**静默回退到 simple**。这是最容易误判的一处：你以为开了语义缓存，其实没有；只有去看日志才能发现。
- 为什么缓存能省钱：讲师算得很清楚——如果每个新请求都当新请求处理，token 就一直烧；缓存命中时响应直接来自缓存，**不进模型**，所以“时间省了，钱也省了”。实测数字：996 ms → 63 ms（约 9.6 倍那一档的观感），1276 ms → 548 ms；另一组演示是 865 ms → 90 ms，讲师当场说“cache hit，快了 9.6 倍”；节省 token 数分别是 0.01 与 0.121。
- **并发视角补一句**（讲师没讲，但你会撞上）：缓存命中判断是在网关侧并发发生的。在 Node 里这就等价于“同一个问题同时来了 10 个请求”，理想情况是只有一个真的打到模型、其余等它的结果（single-flight）。Portkey 免费版是否做请求合并，课里没讲，别假设。

### 5.4 流式

- `stream=True` 一个参数就够。它的效果不是“更快生成完”，而是“**更早看到第一个字**”——总耗时可能差不多，但体感完全不同。
- 为什么必须自己拼：流式返回的是 chunk 序列，每块只带增量（`delta.content`）。所以脚本里既打印增量，又用 `collected` 列表拼一份完整文本，方便你核对内容有没有缺。
- LangChain 里的等价物：原生 SDK 用 `stream=True`，LangChain 用 `llm.stream(...)`。课里讲师只演示了前者的 `stream=True` 与后者的 `invoke`，`llm.stream` 这个组合**课里没讲**。

### 5.5 LangChain drop-in 的四个决策

这一节的目标只有一个：**不改业务逻辑，把 Portkey 插进去**。所以每个参数都是在解决“往哪打”和“谁来认证”：

- 为什么不用 `ChatGroq`：讲师原话是 ChatGroq 内部就打 Groq 的 client、Groq 的 base URL。你在 P078 里能看到他打开 Groq 的 playground，页面上也是 `chat.completions.create`——“这些东西都很标准化”。也就是说协议一样、地址写死。地址写死，你就插不进网关。
- 为什么用 `ChatOpenAI`：因为它有 `base_url` 参数。讲师说“不只是 Groq client，我们可以打任何 client”。这就是“可换目标地址”的价值。
- 为什么 `api_key` 传 Portkey 的 key：因为请求先到 Portkey，Portkey 再去跟 provider 认证。你传 Groq 的 key 反而会错位。
- 为什么 `model` 还写 Groq 的模型：网关要按这个名字去选 provider 侧模型。协议是 OpenAI 格式，模型是 Groq 的模型，这两件事不冲突——这正是“统一 API”的含义。
- `temperature=0`：讲师原话“temperature 我们保持 0”。注意这跟缓存有交互：temperature 越低，同问题同答案的概率越高，simple cache 的观感越好。
- `default_headers` + `createHeaders(...)`：讲师先说了 `create headers` 是那个函数，再往里放 `api_key` 和 `metadata`。metadata 是他给的三个业务标签：`user = "langchain demo"`、`environment = "dev"`、`feature = "langchain integration"`。这三组值不是装饰——你后面在控制台按 `user` 或 `feature` 过滤日志，靠的就是它们。
- `invoke`：讲师特意对比了“之前是 `groq.invoke`，这次是 `portkey_llm.invoke`”，并强调 `invoke` 是 LangChain 的标准方法。**这就是“drop-in”三个字的落点**：调用方一行不改。

### 5.6 TensorZero 四服务的职责与端口

- **postgres（5432）**：存“谁问了什么、谁答了什么、哪个 provider 答的、日志”。为什么一定要数据库：因为后面那套反馈训练循环要靠历史数据算满意度，没有库就没有训练集。注意讲师在这里说得很细——“你想知道这个问题是 Gemini 答的还是 Claude 答的还是 ChatGPT 答的，你想知道所有这类信息，这些都可以在网关里记下来”，这就是他前面讲的**集中日志（centralized logging）**落地的地方。
- **migrations（一次性）**：讲师原话是“它是只跑一次的服务”，作用是“把你在 schema 里定义的表建到 Postgres 里”。在 SQL 世界里，schema 就是表的定义。所以这个服务挂了你的 gateway 也没数据可写——`depends_on` 用 `service_completed_successfully` 就是在表达这个先后关系。在 Node 项目里对应就是 Prisma migrate / knex migrate 那种“启动前先迁移”的做法。
- **gateway（3000）**：主服务，负责路由和 A/B 测试。你应用侧的 base URL 就指到它。
- **ui（4000）**：可观测性面板，**可选**。讲师明确说“某些项目你不需要 dashboard，那你就把这个服务去掉”。这句话很重要，它说明这套 compose 不是必须四个都上。
- 为什么讲师反复说“不要看代码”：因为这套 compose 是 Claude 生成的，而你要掌握的是“网关这种系统需要哪几个部件”。他给的能力边界也很清楚——想多加表、想多加 key，你就告诉 Claude 去改哪个服务。
- **为什么是容器而不是云端**：讲师说得很直接——**为了省成本，我做了本地部署**；要跑 Docker Desktop；用的是生产原型那套方式（用 Docker 容器起网关）。

### 5.7 function / variant 与 A/B 拆分

- function = 任务（summarize），variant = 执行方（summarize_gpt / summarize_groq / 未来还能有 summarize_claude、summarize_gemini）。讲师的原话就是“函数是你想做什么，变体是你从哪里做”，以及“当一个函数挂到某个 provider 上，我们叫它变体”。
- 为什么一定要拆这两层：因为**权重挂在 variant 上，而不是挂在模型上**。所以“summarize 用 80/20，chat 用 40/60”是天然支持的；如果只有“模型列表”，你没法表达“这个任务用这个比例、那个任务用那个比例”。
- variant 的名字随便起（讲师说“名字可以是任何东西，只是为了可读性”），但**function 名是你代码里要写的那个标识**，所以 function 名要稳。
- 拆分比例的意义：这就是 AB 测试。讲师在 P079 用 80/20 讲道理——OpenAI 更好但更贵，Groq 免费但可靠性略差；用 80/20 你能省钱、还能保住 80% 的满意度；如果简单 chatbot 场景下 Groq 表现够好，你可以进一步切到 50/50，省更多。他还说了一个更狠的判断：**即使 20% 用户不满意，你也只损失 20%**。

### 5.8 反馈训练循环（TensorZero 的差异点）

讲师讲的闭环是：应用里在答案下方给用户“满意 / 不满意”（点赞点踩，也可以在聊天里直接说“我喜欢这个答案”）→ 这些问题、答案、哪个模型答的、以及满意度，全部落 Postgres → 网关根据满意度**自动调整流量比例**。他给的算例是 1000 个问题、50/50 拆、200 人满意 OpenAI、800 人满意 Groq，于是自动把 OpenAI 降到 20%、Groq 提到 80%。

关键澄清（讲师自己也强调了）：**这不是在改进 ChatGPT 模型本身**，而是在网关这一层调整“哪个 provider 拿多少流量”。同一套机制也能用在**提示词**上：两个 system prompt 里哪个用户更喜欢，流量就自动往那个 prompt 倾斜。这就是他说的“automated model optimization + feedback loop”。

![p079 24:07 讲师讲反馈闭环：点赞点踩落库后自动调流量](images/p079_1447s.jpg)

### 5.9 为什么“换模型”这件事值一个网关

讲师把两种路径的代价摆在一起：

- 没有网关：模型降价/涨价/宕机（他举的例子是 Cloudflare 挂了导致 OpenAI 站点一小时内不可用），你要改代码 → 重新部署 → 跑 CI/CD 流水线 → 新应用上线。**“花的时间太长，而现在没人那么有耐心。”**
- 有网关：应用侧只认网关地址；网关是独立的 Docker 容器，里面有一份 TOML 配置；你把 OpenAI 换成 Groq、把模型名改成 Llama，**重启容器，一到两分钟**，全应用生效。

同一逻辑也适用于提示词：讲师说生产里提示词就住在网关里，改提示词不用重部署应用。这就是他总结的“统一 API + 自动日志 + AB 测试 + 可换模型 + 可换提示词”这一整套收益。

![p079 15:36 讲师对比改代码重部署与改网关配置重启](images/p079_0936s.jpg)

---

## 6. 复现检查清单

**环境**
- [ ] Docker Desktop 已安装，且**后台引擎在跑**（不是只打开了窗口）
- [ ] `python -V` 输出 3.11.x（3.12 也可，3.11 是讲师首选）
- [ ] 虚拟环境已激活，`pip list` 里能看到 `portkey-ai`、`langchain-openai`
- [ ] Groq Cloud 账号已建，API key 已复制（免费额度约每天 100 次请求）
- [ ] OpenAI 已充 5 美元，API key 已建（讲师命名习惯：`test tensorzero`）
- [ ] Portkey 控制台里已配好**两个**模型（一大一小），并复制了 API key 与 Gateway URL

**Portkey 实验一：负载均衡**
- [ ] `strategy.mode` 写的是 `loadbalance`（不是 `fallback`）
- [ ] 两个 target 的 weight 相加为 1
- [ ] 连发 10 个请求后，控制台 Logs 里**两个模型都有请求**
- [ ] 把权重改成 0.5/0.5 再跑一次，分布随之变化
- [ ] 没有因为“7:3 不是 5:5”而怀疑代码坏了（讲师明确说过不保证精确）

**Portkey 实验二：缓存**
- [ ] `cache.mode = "simple"`
- [ ] 第一次运行看到耗时约 1 秒级；第二次同问题耗时掉到百毫秒级
- [ ] 控制台 Logs 里能看到第一次 cache miss、第二次 cache hit
- [ ] 换一个长输出问题（写长诗），重复上面两步，并记录节省的 token
- [ ] 如果你在免费计划上写了 `semantic`，去日志确认它是不是已经静默降级（**不会报错**）

**Portkey 实验三：流式**
- [ ] `stream=True` 已加
- [ ] 终端是逐字出现，不是憋到最后一次性出现（必要时加 `flush=True`）

**Portkey 实验四：LangChain drop-in**
- [ ] 用的是 `ChatOpenAI`，**不是** `ChatGroq`
- [ ] `api_key` 是 Portkey 的 key
- [ ] `base_url` 是 Portkey 网关地址
- [ ] `model` 是 Portkey 里已配好的模型名
- [ ] `temperature=0`
- [ ] metadata 三组值齐全：`user` / `environment` / `feature`
- [ ] 调用是 `portkey_llm.invoke(...)`
- [ ] 控制台里出现 `langchain demo` 记录 + 对应 log

**Portkey 作业**
- [ ] 一份 config 里同时出现 retry、cache、loadbalance、metadata
- [ ] 自己先写了一遍，再对照讲师答案

**TensorZero**
- [ ] 前置检查三项全绿：python / docker / docker compose
- [ ] 目录结构是 `tensorzero_demo/{docker-compose.yml, .env, config/tensorzero.toml}`
- [ ] `.env` 里只有两把 provider key
- [ ] `docker compose up -d` 之后 `docker compose ps` 显示 postgres healthy、migrations 已退出（0）、gateway 与 ui 在跑
- [ ] 浏览器 `http://localhost:4000` 能打开 dashboard
- [ ] `tensorzero.toml` 里 `[functions.summarize]` 下有两个 variant，权重 0.8 / 0.2
- [ ] 改一次 `tensorzero.toml` 里的模型名，`docker compose restart gateway`，**应用代码一行没动**，请求打到新模型

---

## 7. 课里没讲但你会撞上的

1. **本段没有任何 OCR 可用**。所以第 4 节的配置字段里，凡是逐字稿没念出来的（例如 Portkey 的 `on_status_codes`、TensorZero 的镜像名与 migration 启动参数、TOML 的具体 key），都是按官方文档习惯补的，我在代码里逐处标了「课里没念」。**第一次跑之前先对一遍官方示例**，别把补的字段当讲师原话。
2. **模型 slug 是猜的**。讲师全程只说“large model / small model”“70 billion / 8 billion”“grok model”，演示面板上出现过 70B 与 8B 两个规格，但**没有逐字念出 slug**。所以 `.env` 里留了 `LARGE_MODEL` / `SMALL_MODEL` 两个可覆盖变量，你换成自己 Portkey 控制台里真实的模型名即可。
3. **免费计划上 `semantic` 不报错**。这是最容易翻车的一条：配置写了、脚本跑通了、日志里却是 simple 的行为。排障时先看日志再看代码。同理，**Portkey 的可观测性是付费能力**，如果你的控制台看不到 cache hit / token 节省这些字段，先确认套餐，别怀疑自己的代码。
4. **`createHeaders` 与 `default_headers` 的配合**：LangChain 的 `ChatOpenAI` 接受 `default_headers`，Portkey 的 `createHeaders` 负责拼出带有 key 与 metadata 的 header 字典。这个组合课里是“边写边说”带过去的，如果你装的 `langchain-openai` 版本较旧，`default_headers` 的参数名可能不同，请以你本地版本的 API 为准。
5. **流式在 LangChain 里不是 `stream=True`**。原生 SDK 是 `create(..., stream=True)`；LangChain 是 `llm.stream(...)`。课里只演示了前者的参数与后者的 `invoke`，**两者的组合课里没讲**。
6. **前端直连网关是不可行的**。讲师的所有演示都在 Python 笔记本/脚本里跑，key 在服务端。你作为前端转 AI 应用工程师，一定要把网关地址与 Portkey key 放在**你自己的 BFF / Node 服务**里，浏览器只调你的接口。这条是安全常识，**课里没讲**，但这是「AI Security」这套课的大前提。
7. **`5432` 端口冲突**。讲师是本地跑 Postgres，如果你本机已经装了 Postgres 或别的容器占了 5432，`docker compose up` 会直接失败。改宿主端口映射即可（容器内仍是 5432，`TENSORZERO_POSTGRES_URL` 不用改）。
8. **`migrations` 服务“跑完就退出”是正常的**。`docker compose ps` 里它会显示 Exited (0)。如果你把它写成 `restart: always`，容器会无限重建；如果 gateway 用了 `service_started` 而不是 `service_completed_successfully`，gateway 可能在表还没建好时就开始接请求，报“relation does not exist”这类错。
9. **`ui` 是可选的**。讲师明确说过某些项目不需要 dashboard 就把这个服务删掉。删了之后 4000 端口没有服务是预期行为，别去排查“为什么打不开”。
10. **重启网关的耗时预期**。讲师给的数字是 **1–2 分钟**。如果你改完 `tensorzero.toml` 立刻请求，可能还在旧配置上——先确认 `docker compose ps` 里 gateway 是新起的容器。
11. **缓存与 `max_tokens` 的交互**。我给的脚本里有 `max_tokens=256`，**课里没讲这个参数**。但如果你在“写长诗”那个用例上把 `max_tokens` 设得很小，两次输出都会截断，看起来“缓存命中了但内容不对”，容易误判。
12. **缓存 key 到底包含哪些字段**（是否包含 temperature、system prompt、metadata），课里没讲。所以别假设“只改 metadata 不会影响缓存”。
13. **负载均衡不是严格轮询**。讲师亲口说“大模型答得快，新请求可能又发给大模型”。所以你做压测时看到 8:2 而不是 7:3，属于正常抖动，不要为此改代码。
14. **反馈循环的“点赞点踩”UI 课里没给代码**。讲师只讲了机制（应用里问用户是否满意、可以点 yes/no 也可以在聊天里直接说），没给前端实现，也没给“满意度如何聚合成流量权重”的算法细节。这一段属于概念讲解，你实现时要自己定阈值与平滑策略。
15. **`ChatGroq` 与 `ChatOpenAI` 的路由差异只影响“能不能插网关”，不影响模型能力**。讲师反复强调这一点（“不只是 Groq client，可以打任何 client”），别把“必须用 ChatOpenAI”误解成“Groq 模型必须用 OpenAI 的模型”。